import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  aggregatePortrait,
  availableMonths,
  channelEntityIds,
  compareProductChannel,
  describeAvailablePeriods,
  DIAGNOSIS_TYPE_ALIASES,
  findChannel,
  findProduct,
  FUNNEL_PHASE_ALIASES,
  isNaturalMonth,
  listChannels,
  listProducts,
  portraitLabelCovers,
  portraitMatchKind,
  portraitPlatform,
  resolveChannelIds,
  searchByTag,
  selectAggregateMembers,
  selectPortrait,
  similarProducts,
  type DataIndex,
  type NormalizedPortrait,
} from '@uom/core';
import { err, ok, toMcp, type ToolResult } from './result.js';

/** 首版工具清单，与产品讨论稿 §3.3 一一对应。 */
export const TOOL_NAMES = [
  'list_channels',
  'get_channel_portrait',
  'get_brand_portrait',
  'get_competitor_portrait',
  'list_products',
  'get_product_dossier',
  'get_product_portrait',
  'get_portrait_aggregate',
  'get_funnel',
  'compare_product_channel',
  'search_by_tag',
  'search_similar_products',
  'list_member_features',
  'get_retention_cohort',
  'get_recency_distribution',
  'get_channel_flow_matrix',
  'get_diagnosis',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * 构建 MCP server。
 *
 * 传入的索引是**只读**的，工具不写任何文件、不发起网络请求。
 */
export function createServer(index: DataIndex): McpServer {
  const server = new McpServer({ name: 'uom-data', version: '0.1.0' });

  /** 数据未就位时的统一错误。 */
  const notReady = (tool: ToolName): ToolResult<never> => {
    const reason = index.unavailable[tool];
    if (!reason) {
      return err('data-not-ready', `工具 ${tool} 的数据源未接入`, '请检查 data/ 目录下的数据源');
    }
    return err('data-not-ready', reason, `工具 ${tool} 暂不可用`);
  };

  const register = <T>(
    name: ToolName,
    config: {
      title: string;
      description: string;
      inputSchema: z.ZodObject<z.ZodRawShape>;
    },
    handler: (args: Record<string, unknown>) => ToolResult<T>,
  ): void => {
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
        inputSchema: config.inputSchema,
      },
      async (args: Record<string, unknown>) => toMcp(handler(args ?? {})),
    );
  };

  /** 画像查询参数（切片 A · SA-03：歧义显式返回，不按平台名偷选）。 */
  interface PortraitQuery {
    /** 实体的显示名（错误消息用），如「渠道 D00001」。 */
    label: string;
    entityType: 'channel' | 'product';
    entityIds: string[];
    month?: string;
    platform?: string;
    /** 平台消歧参数名（compare 的两侧分别是 productPlatform／channelPlatform）。 */
    platformParam?: string;
  }

  /**
   * 用 core 的 `selectPortrait` 解析画像；找不到或歧义时直接产出错误结果。
   * **任何情况不回退到相邻月份。**
   */
  const selectPortraitOrError = (
    query: PortraitQuery,
  ): { portrait: NormalizedPortrait } | { error: ToolResult<never> } => {
    const selection = selectPortrait(index, {
      entityType: query.entityType,
      entityIds: query.entityIds,
      ...(query.month !== undefined ? { month: query.month } : {}),
      ...(query.platform !== undefined ? { platform: query.platform } : {}),
    });
    if (selection.status === 'found') return { portrait: selection.portrait };
    if (selection.status === 'ambiguous') {
      const platformParam = query.platformParam ?? 'platform';
      // hint 按 reason 分支（复核应修-1）：平台歧义提示传 platform，
      // 跨月歧义提示传 month；同月多平台（reason=month 且只涉及一个月）的
      // 消歧入口同样是 platform（SA-03 主路径）。
      const monthHint = selection.months.length === 1 || selection.reason === 'platform';
      if (monthHint) {
        const monthLabel = selection.reason === 'platform'
          ? query.month ?? selection.months[0] ?? ''
          : selection.months[0] ?? '';
        return {
          error: err(
            'ambiguous',
            `${query.label} 在 ${monthLabel} 有多平台画像（平台：${selection.platforms.join('、')}）`,
            `传 ${platformParam} 参数消歧（可选平台：${selection.platforms.join('、')}）`,
          ),
        };
      }
      return {
        error: err(
          'ambiguous',
          `${query.label} 有多份画像（月份：${selection.months.join('、')}${selection.platforms.length > 1 ? `；平台：${selection.platforms.join('、')}` : ''}）`,
          `传 month 参数（${describeAvailablePeriods(selection.months)}）`,
        ),
      };
    }
    const months = availableMonths(index, query.entityType, query.entityIds);
    if (months.length === 0) {
      return {
        error: err('not-found', `${query.label} 在索引中没有人群画像`),
      };
    }
    if (query.month !== undefined) {
      return {
        error: err(
          'month-mismatch',
          `${query.label} 在 ${query.month} 无画像`,
          describeAvailablePeriods(months),
        ),
      };
    }
    return {
      error: err(
        'not-found',
        `${query.label} 没有可唯一确定的画像`,
        describeAvailablePeriods(months),
      ),
    };
  };

  /** 记录里只保留指定月份键（缺失返回 undefined）。 */
  function pickMonthKey<T>(record: Record<string, T> | undefined, month: string): Record<string, T> | undefined {
    const hit = record?.[month];
    return hit ? { [month]: hit } : undefined;
  }

  /**
   * 读取并校验可选 `month` 入参（验收修正一）：必须是自然月 `YYYY-MM`。
   * 缺省与空串按「未传」处理；非法写法直接返回 `invalid-argument`，不做查找。
   */
  const readMonth = (
    args: Record<string, unknown>,
  ): { month?: string } | { error: ToolResult<never> } => {
    if (typeof args.month !== 'string' || args.month === '') return { month: undefined };
    if (!isNaturalMonth(args.month)) {
      return {
        error: err(
          'invalid-argument',
          `month 必须是 YYYY-MM，收到 ${args.month}`,
          '自然月写法示例：2026-10',
        ),
      };
    }
    return { month: args.month };
  };

  /** 必填 `month` 入参的读取与校验（验收修正一）：任何非 `YYYY-MM` 写法都拒绝。 */
  const readRequiredMonth = (args: Record<string, unknown>): string | ToolResult<never> => {
    const value = typeof args.month === 'string' ? args.month : '';
    if (!isNaturalMonth(value)) {
      return err(
        'invalid-argument',
        `month 必须是 YYYY-MM，收到 ${value}`,
        '自然月写法示例：2026-10',
      );
    }
    return value;
  };

  // ── 渠道 ───────────────────────────────────────────────────
  register(
    'list_channels',
    {
      title: '列出渠道',
      description: '列出渠道及其画像覆盖情况。可按月份与渠道类型过滤。',
      inputSchema: z.object({
        month: z.string().optional().describe('月份 YYYY-MM；过滤该月有画像覆盖的渠道'),
        type: z.string().optional().describe('渠道类型或平台，如「抖音」「天猫」「实体店」'),
      }),
    },
    (args) => {
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const channels = listChannels(index, {
        ...(month !== undefined ? { month } : {}),
        ...(typeof args.type === 'string' ? { type: args.type } : {}),
      });
      return ok({
        total: channels.length,
        months: index.months,
        channels: channels.map((channel) => ({
          channelId: channel.channelId,
          name: channel.name,
          platform: channel.platform,
          channelType: channel.channelType,
          channelGrade: channel.channelGrade,
          city: channel.city,
          storeStatus: channel.storeStatus,
          ...(channel.performance ? { performance: channel.performance } : {}),
        })),
      });
    },
  );

  register(
    'get_channel_portrait',
    {
      title: '取渠道人群画像',
      description: '取指定渠道的人群画像（平台原生标签 + 统一维度投影）。缺月不静默回退。',
      inputSchema: z.object({
        channelId: z.string().describe('店铺编码'),
        month: z.string().optional().describe('月份 YYYY-MM；不传时该渠道须只有一份画像'),
        platform: z.string().optional().describe('平台消歧：抖音／天猫／京东（同月多平台时必传）'),
      }),
    },
    (args) => {
      const channelId = String(args.channelId ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const platform = typeof args.platform === 'string' && args.platform !== '' ? args.platform : undefined;
      const channel = findChannel(index, channelId);
      if (!channel) {
        return err('not-found', `渠道 ${channelId} 不在索引中`, '用 list_channels 查看可用渠道');
      }
      const entityIds = channelEntityIds(index, channelId);
      const selection = selectPortraitOrError({
        label: `渠道 ${channelId}`,
        entityType: 'channel',
        entityIds,
        month,
        platform,
      });
      if ('error' in selection) return selection.error;
      const portrait = selection.portrait;
      return ok({
        channelId,
        channel,
        month: portrait.month,
        platform: portraitPlatform(portrait),
        sampleSize: portrait.sampleSize,
        coverage: portrait.coverage,
        projections: portrait.projections,
        platformLabels: portrait.platformLabels,
        issues: portrait.issues ?? [],
      });
    },
  );

  // ── 品牌与竞品 ─────────────────────────────────────────────
  register(
    'get_brand_portrait',
    {
      title: '取品牌人群画像',
      description: '取品牌目标人群或全域人群画像。',
      inputSchema: z.object({
        scope: z.string().describe('目标人群 target 或全域人群 all'),
        month: z.string().optional(),
      }),
    },
    (args) => {
      const scope = String(args.scope ?? '');
      if (scope !== 'target' && scope !== 'all') {
        return err('invalid-argument', `scope 必须是 target 或 all，收到 ${scope}`);
      }
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const unavailable = index.unavailable['get_brand_portrait'];
      if (unavailable) {
        return err('data-not-ready', unavailable, '工具 get_brand_portrait 暂不可用');
      }
      const portraits = index.portraits.filter(
        (portrait) => portrait.entityType === 'brand',
      );
      if (portraits.length === 0) {
        return err('not-found', '索引中没有品牌人群画像');
      }
      return ok({ scope, portraits });
    },
  );

  register(
    'get_competitor_portrait',
    {
      title: '取竞品人群画像',
      description: '取指定竞品品牌的人群画像。',
      inputSchema: z.object({
        brand: z.string().describe('竞品品牌名'),
        month: z.string().optional(),
      }),
    },
    (args) => {
      const brand = String(args.brand ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const portraits = index.competitorPortraits ?? [];
      if (portraits.length === 0) {
        const reason = index.unavailable['get_competitor_portrait'];
        return err(
          'data-not-ready',
          reason ??
            '竞品画像目录存在但没有可识别的画像文件：期望 data/domains/07_人群画像/竞品/ 下有抖音／天猫／京东画像文件',
          '工具 get_competitor_portrait 暂不可用',
        );
      }
      // month 走与其它工具同源的覆盖规则（复核应修-6）：区间／年份画像覆盖该月
      // 即命中；无月份画像作为最低层保留，match 为 unknown
      const byBrand = portraits.filter((portrait) => matchesEntityName(portrait.entityId, brand));
      const matched =
        month !== undefined
          ? byBrand.filter((portrait) => portraitLabelCovers(portrait.month, month))
          : byBrand;
      if (matched.length === 0) {
        return err(
          'not-found',
          month !== undefined
            ? `竞品 ${brand} 在 ${month} 没有画像（可用期间：${describeAvailablePeriods(
                availableMonths(index, 'competitor', byBrand.map((portrait) => portrait.entityId)),
              )}）`
            : `竞品 ${brand} 在索引中没有人群画像`,
          `已接入的竞品：${[...new Set(portraits.map((portrait) => portrait.entityId))].join('、')}`,
        );
      }
      return ok({
        brand,
        month: matched[0]?.month,
        portraits: matched.map((portrait) => ({
          ...portrait,
          ...(month !== undefined ? { match: portraitMatchKind(portrait.month) } : {}),
        })),
      });
    },
  );

  // ── 商品 ───────────────────────────────────────────────────
  register(
    'list_products',
    {
      title: '商品检索',
      description: '按品类、季节、关键词、价格区间检索商品档案。',
      inputSchema: z.object({
        category: z.string().optional(),
        season: z.string().optional(),
        keyword: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        channel: z.string().optional().describe('按渠道过滤；需商品与渠道的关联数据'),
      }),
    },
    (args) => {
      const channel = typeof args.channel === 'string' && args.channel !== '' ? args.channel : undefined;
      let channelIds: Set<string> | undefined;
      if (channel) {
        const links = index.productChannels ?? [];
        if (links.length === 0) {
          return err(
            'data-not-ready',
            '按渠道过滤商品暂不可用：现有数据源中商品表与渠道表没有关联键',
            '需另提供商品→渠道的归属数据',
          );
        }
        channelIds = resolveChannelIds(index, channel);
        const known = index.channels.some((item) => channelIds!.has(item.channelId));
        if (!known) {
          return err('not-found', `渠道 ${channel} 不在索引中`, '用 list_channels 查看可用渠道');
        }
      }
      const products = listProducts(index, {
        ...(typeof args.category === 'string' ? { category: args.category } : {}),
        ...(typeof args.season === 'string' ? { season: args.season } : {}),
        ...(typeof args.keyword === 'string' ? { keyword: args.keyword } : {}),
        ...(typeof args.minPrice === 'number' ? { minPrice: args.minPrice } : {}),
        ...(typeof args.maxPrice === 'number' ? { maxPrice: args.maxPrice } : {}),
        ...(channel ? { channel } : {}),
      });
      return ok({
        total: products.length,
        products: products.map((product) => ({
          spu: product.spu,
          name: product.name,
          brand: product.brand,
          category: product.category,
          season: product.season,
          price: product.price,
          ...(channelIds
            ? {
                channelSales: (index.productChannels ?? [])
                  .filter(
                    (link) => link.spu === product.spu && channelIds!.has(link.channelId),
                  )
                  .map((link) => ({
                    channelId: link.channelId,
                    ...(link.month ? { month: link.month } : {}),
                    ...(link.retailAmount !== undefined ? { retailAmount: link.retailAmount } : {}),
                    ...(link.retailQty !== undefined ? { retailQty: link.retailQty } : {}),
                  })),
              }
            : {}),
        })),
      });
    },
  );

  register(
    'get_product_dossier',
    {
      title: '取单品全量档案',
      description: '取单品的属性、FAB、按月画像、漏斗与经营指标。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
        month: z.string().optional().describe('月份 YYYY-MM；不传时返回全部月份'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const product = findProduct(index, spu);
      if (!product) {
        return err('not-found', `商品 ${spu} 不在索引中`, '用 list_products 查看可用商品');
      }
      const own = index.portraits.filter(
        (portrait) => portrait.entityType === 'product' && portrait.entityId === spu,
      );
      // 与 selectPortrait／list_channels 同一口径（复核建议 2 升级）：
      // 无月份画像任何月都可作为最低层命中，不再被 periodCovers 直接排除
      const selected = month
        ? own.filter((portrait) => portraitLabelCovers(portrait.month, month))
        : own;
      const portraits = selected.map((portrait) => ({
        month: portrait.month,
        platform: portraitPlatform(portrait),
        projections: portrait.projections,
        match: portraitMatchKind(portrait.month),
      }));

      // 带 month 时四类数据都只含覆盖该月的记录（SA-05）
      const performance = month ? pickMonthKey(product.performance, month) : product.performance;
      const funnel = month ? pickMonthKey(product.funnel, month) : product.funnel;
      const channelPerformance = month
        ? Object.fromEntries(
            Object.entries(product.channelPerformance ?? {})
              .map(([channelId, months]) => [channelId, pickMonthKey(months, month)] as const)
              .filter((entry): entry is [string, Record<string, { retailAmount?: number; retailQty?: number }>] =>
                entry[1] !== undefined,
              ),
          )
        : product.channelPerformance;

      const hasAny = (record: Record<string, unknown> | undefined): boolean =>
        record !== undefined && Object.keys(record).length > 0;
      if (
        month !== undefined &&
        portraits.length === 0 &&
        !hasAny(performance) &&
        !hasAny(funnel) &&
        !hasAny(channelPerformance)
      ) {
        const portraitMonths = availableMonths(index, 'product', spu);
        const dataMonths = [
          ...new Set([
            ...Object.keys(product.performance ?? {}),
            ...Object.keys(product.funnel ?? {}),
            ...Object.values(product.channelPerformance ?? {}).flatMap((months) =>
              Object.keys(months),
            ),
          ]),
        ]
          .filter((key) => key !== 'unknown')
          .sort();
        return err(
          'month-mismatch',
          `商品 ${spu} 在 ${month} 没有画像、经营指标、漏斗或渠道成交`,
          describeAvailablePeriods([...portraitMonths, ...dataMonths]),
        );
      }

      const { performance: _p, funnel: _f, channelPerformance: _c, ...rest } = product;
      return ok({
        ...rest,
        ...(performance !== undefined ? { performance } : {}),
        ...(funnel !== undefined ? { funnel } : {}),
        ...(channelPerformance !== undefined ? { channelPerformance } : {}),
        portraits,
      });
    },
  );

  register(
    'get_product_portrait',
    {
      title: '取单品人群画像',
      description: '取指定单品的人群画像，可限定统一维度。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
        dimensions: z.array(z.string()).optional().describe('统一维度名列表'),
        month: z.string().optional(),
        platform: z.string().optional().describe('平台消歧：抖音／天猫／京东（同月多平台时必传）'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const platform =
        typeof args.platform === 'string' && args.platform !== '' ? args.platform : undefined;
      const selection = selectPortraitOrError({
        label: `商品 ${spu}`,
        entityType: 'product',
        entityIds: [spu],
        month,
        platform,
      });
      if ('error' in selection) return selection.error;
      const portrait = selection.portrait;
      const dimensions = Array.isArray(args.dimensions) ? (args.dimensions as string[]) : undefined;
      const projections = dimensions
        ? Object.fromEntries(
            Object.entries(portrait.projections).filter(([key]) => dimensions.includes(key)),
          )
        : portrait.projections;
      return ok({
        spu,
        month: portrait.month,
        platform: portraitPlatform(portrait),
        sampleSize: portrait.sampleSize,
        coverage: portrait.coverage,
        projections,
        platformLabels: portrait.platformLabels,
        issues: portrait.issues ?? [],
      });
    },
  );

  register(
    'get_portrait_aggregate',
    {
      title: '取聚合层级画像',
      description: '取品类／系列／爆款／IP 层级的人群画像。',
      inputSchema: z.object({
        level: z.string().describe('category / series / hot / ip'),
        key: z.string().describe('层级下的具体键，如品类名'),
        month: z.string().optional().describe('月份 YYYY-MM；只聚合各成员覆盖该月的画像'),
      }),
    },
    (args) => {
      const level = String(args.level ?? '');
      const key = String(args.key ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      if (!['category', 'series', 'hot', 'ip'].includes(level)) {
        return err(
          'invalid-argument',
          `level 必须是 category／series／hot／ip，收到 ${level}`,
        );
      }
      if (level !== 'category' && !(index.aggregateGroups ?? []).length) {
        return err(
          'data-not-ready',
          `聚合层级 ${level} 未接入：需要聚合口径表（商品归属哪个系列／爆款／IP）`,
          '当前仅支持 category 层级，可由商品档案的品类字段推导',
        );
      }
      // 不带 month：先逐成员解析，成员有多份画像时显式歧义（SA-03）
      if (month === undefined) {
        const members = selectAggregateMembers(index, { level, key });
        const ambiguousMember = members.find((member) => member.selection.status === 'ambiguous');
        if (ambiguousMember && ambiguousMember.selection.status === 'ambiguous') {
          const selection = ambiguousMember.selection;
          return err(
            'ambiguous',
            `成员 ${ambiguousMember.spu} 有多份画像（月份：${selection.months.join('、')}）`,
            `传 month 参数（${describeAvailablePeriods(selection.months)}）`,
          );
        }
      }
      const portrait = aggregatePortrait(index, { level, key, ...(month ? { month } : {}) });
      if (!portrait) {
        // 品类层级的文案与既有实现保持一致（现状不变性）
        return err(
          'not-found',
          level === 'category'
            ? `品类 ${key} 下没有带画像的商品`
            : `聚合层级 ${level} 下没有键 ${key} 的带画像商品`,
        );
      }
      return ok(portrait);
    },
  );

  register(
    'get_funnel',
    {
      title: '取生命周期漏斗',
      description: '取单品在指定生命周期阶段的浏览／收藏／加购／购买／退货数据。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
        phase: z.string().describe('launch / growth / clearance'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const phase = String(args.phase ?? '');
      const rows = index.funnel ?? [];
      if (rows.length === 0) return notReady('get_funnel');
      const normalizedPhase =
        FUNNEL_PHASE_ALIASES[phase] ?? FUNNEL_PHASE_ALIASES[phase.toLowerCase()] ?? phase;
      const matched = rows.filter(
        (row) => row.spu === spu && (phase === '' || row.phase === normalizedPhase),
      );
      if (matched.length === 0) {
        const phases = [...new Set(rows.filter((row) => row.spu === spu).map((row) => row.phase))];
        return err(
          'not-found',
          `款号 ${spu} 在阶段 ${phase} 没有漏斗数据`,
          phases.length > 0 ? `该款号可用阶段：${phases.join('、')}` : '该款号没有漏斗数据',
        );
      }
      return ok({ spu, phase: normalizedPhase, rows: matched });
    },
  );

  // ── 对比与检索 ─────────────────────────────────────────────
  register(
    'compare_product_channel',
    {
      title: '商品↔渠道画像差异',
      description:
        '比较商品与渠道的人群画像差异：逐维度 Top3、JS 距离、余弦、Top3 重合度。只产出差异，不产出匹配分与评级。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
        channelId: z.string().describe('店铺编码'),
        month: z.string().optional(),
        productPlatform: z.string().optional().describe('商品侧平台消歧：抖音／天猫／京东'),
        channelPlatform: z.string().optional().describe('渠道侧平台消歧：抖音／天猫／京东'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const channelId = String(args.channelId ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const productPlatform =
        typeof args.productPlatform === 'string' && args.productPlatform !== ''
          ? args.productPlatform
          : undefined;
      const channelPlatform =
        typeof args.channelPlatform === 'string' && args.channelPlatform !== ''
          ? args.channelPlatform
          : undefined;
      const productSelection = selectPortraitOrError({
        label: `商品 ${spu}`,
        entityType: 'product',
        entityIds: [spu],
        month,
        platform: productPlatform,
        platformParam: 'productPlatform',
      });
      if ('error' in productSelection) return productSelection.error;
      const channelSelection = selectPortraitOrError({
        label: `渠道 ${channelId}`,
        entityType: 'channel',
        entityIds: channelEntityIds(index, channelId),
        month,
        platform: channelPlatform,
        platformParam: 'channelPlatform',
      });
      if ('error' in channelSelection) return channelSelection.error;
      const comparison = compareProductChannel(index, {
        spu,
        channelId,
        ...(month !== undefined ? { month } : {}),
        ...(productPlatform !== undefined ? { productPlatform } : {}),
        ...(channelPlatform !== undefined ? { channelPlatform } : {}),
      });
      if (!comparison) {
        const productMonths = availableMonths(index, 'product', spu);
        const channelMonths = availableMonths(
          index,
          'channel',
          channelEntityIds(index, channelId),
        );
        return err(
          'not-found',
          `无法比较：商品 ${spu} 或渠道 ${channelId} 缺少对应画像`,
          [
            productMonths.length ? `商品侧：${describeAvailablePeriods(productMonths)}` : undefined,
            channelMonths.length ? `渠道侧：${describeAvailablePeriods(channelMonths)}` : undefined,
          ]
            .filter(Boolean)
            .join('；'),
        );
      }
      return ok(comparison);
    },
  );

  register(
    'search_by_tag',
    {
      title: '按人群标签反查',
      description: '按统一维度下的标签值反查商品／渠道／人群及其占比与 TGI。',
      inputSchema: z.object({
        dimension: z.string().describe('统一维度名，如 strategy_segment / city_tier'),
        label: z.string().describe('标签值，如 银发族'),
        scope: z.string().optional().describe('product / channel / brand / all'),
        topN: z.number().int().optional(),
        month: z.string().optional().describe('月份 YYYY-MM；只命中覆盖该月的画像，命中带匹配方式'),
      }),
    },
    (args) => {
      const dimension = String(args.dimension ?? '');
      const label = String(args.label ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const hits = searchByTag(index, {
        dimension,
        label,
        ...(typeof args.scope === 'string' ? { scope: args.scope } : {}),
        ...(typeof args.topN === 'number' ? { topN: args.topN } : {}),
        ...(month !== undefined ? { month } : {}),
      });
      if (hits.length === 0) {
        return err(
          'not-found',
          `没有实体命中维度 ${dimension} 的标签 ${label}`,
          '该标签可能只存在于平台原生标签中（未建立映射），或索引数据量不足',
        );
      }
      return ok({ dimension, label, total: hits.length, hits });
    },
  );

  register(
    'search_similar_products',
    {
      title: '相似款 Look-back',
      description: '按属性相似度与人群画像相似度查找相似款。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
        topN: z.number().int().optional(),
        month: z.string().optional().describe('月份 YYYY-MM；目标与候选都改用覆盖该月的画像'),
        platform: z.string().optional().describe('目标画像的平台消歧'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const monthResult = readMonth(args);
      if ('error' in monthResult) return monthResult.error;
      const month = monthResult.month;
      const platform =
        typeof args.platform === 'string' && args.platform !== '' ? args.platform : undefined;
      if (!findProduct(index, spu)) {
        return err('not-found', `商品 ${spu} 不在索引中`);
      }
      // 目标画像先单独解析，把「多份画像」的歧义显式返回，不退化成只比属性（SA-03）
      const targetSelection = selectPortraitOrError({
        label: `商品 ${spu}`,
        entityType: 'product',
        entityIds: [spu],
        month,
        platform,
      });
      if ('error' in targetSelection) return targetSelection.error;
      const hits = similarProducts(index, {
        spu,
        ...(typeof args.topN === 'number' ? { topN: args.topN } : {}),
        ...(month !== undefined ? { month } : {}),
        ...(platform !== undefined ? { platform } : {}),
      });
      return ok({ spu, total: hits.length, hits });
    },
  );

  // ── 会员与留存 ─────────────────────────────────────────────
  register(
    'list_member_features',
    {
      title: '会员特征字典',
      description: '查询会员特征字典（体型版型／风格审美／时令节律／价格渠道）。',
      inputSchema: z.object({
        level: z.string().optional(),
        segment: z.string().optional(),
      }),
    },
    (args) => {
      const level = typeof args.level === 'string' && args.level !== '' ? args.level : undefined;
      const segment =
        typeof args.segment === 'string' && args.segment !== '' ? args.segment : undefined;
      const features = index.memberFeatures ?? [];
      if (features.length === 0) return notReady('list_member_features');
      const matched = features.filter(
        (feature) =>
          (level === undefined || feature.level === level) &&
          (segment === undefined || feature.segment === segment),
      );
      return ok({
        total: matched.length,
        levels: [...new Set(features.map((feature) => feature.level ?? ''))].filter(Boolean),
        features: matched,
      });
    },
  );

  register(
    'get_retention_cohort',
    {
      title: 'Cohort 留存',
      description: '按首购月份分群的新客 Cohort 留存数据。',
      inputSchema: z.object({
        cohortMonth: z.string().describe('首购月份 YYYY-MM'),
        metric: z.string().describe('留存指标，如 day30 / day60 / day90'),
      }),
    },
    (args) => {
      const cohortMonth = String(args.cohortMonth ?? '');
      const metric = String(args.metric ?? '');
      const rows = index.cohort ?? [];
      if (rows.length === 0) return notReady('get_retention_cohort');
      const row = rows.find((item) => item.cohortMonth === cohortMonth);
      if (!row) {
        return err(
          'not-found',
          `首购月份 ${cohortMonth} 没有 Cohort 留存数据`,
          `可用分群：${[...new Set(rows.map((item) => item.cohortMonth))].join('、')}`,
        );
      }
      const value = row.metrics[metric];
      if (value === undefined) {
        return err(
          'not-found',
          `分群 ${cohortMonth} 没有指标 ${metric}`,
          `可用指标：${Object.keys(row.metrics).join('、') || '无'}`,
        );
      }
      return ok({
        cohortMonth,
        metric,
        value,
        ...(row.buyers !== undefined ? { buyers: row.buyers } : {}),
        missing: row.missing,
      });
    },
  );

  register(
    'get_recency_distribution',
    {
      title: '老客 Recency 分布',
      description: '按上次购买时间切片的老客来源分布。',
      inputSchema: z.object({
        month: z.string().describe('统计月份 YYYY-MM'),
      }),
    },
    (args) => {
      const monthResult = readRequiredMonth(args);
      if (typeof monthResult !== 'string') return monthResult;
      const month = monthResult;
      const rows = index.recency ?? [];
      if (rows.length === 0) return notReady('get_recency_distribution');
      const matched = rows.filter((row) => row.month === month);
      if (matched.length === 0) {
        return err(
          'not-found',
          `${month} 没有 Recency 分布数据`,
          `可用月份：${[...new Set(rows.map((row) => row.month ?? ''))].filter(Boolean).join('、')}`,
        );
      }
      return ok({ month, rows: matched });
    },
  );

  register(
    'get_channel_flow_matrix',
    {
      title: '老客跨渠道流转矩阵',
      description: '来源渠道到当月回购渠道的流转矩阵与跨渠道回购率。',
      inputSchema: z.object({
        month: z.string().describe('统计月份 YYYY-MM'),
      }),
    },
    (args) => {
      const monthResult = readRequiredMonth(args);
      if (typeof monthResult !== 'string') return monthResult;
      const month = monthResult;
      const rows = index.channelFlow ?? [];
      if (rows.length === 0) return notReady('get_channel_flow_matrix');
      const matched = rows.filter((row) => row.month === month);
      if (matched.length === 0) {
        return err(
          'not-found',
          `${month} 没有跨渠道流转数据`,
          `可用月份：${[...new Set(rows.map((row) => row.month ?? ''))].filter(Boolean).join('、')}`,
        );
      }
      const matrix: Record<string, Record<string, number>> = {};
      for (const row of matched) {
        if (row.buyers === undefined) continue;
        matrix[row.from] ??= {};
        matrix[row.from]![row.to] = row.buyers;
      }
      return ok({ month, rows: matched, matrix });
    },
  );

  register(
    'get_diagnosis',
    {
      title: '三大诊断',
      description: '二回断崖／虚假繁荣／清仓客跃迁三项诊断。',
      inputSchema: z.object({
        month: z.string().describe('统计月份 YYYY-MM'),
        type: z.string().describe('诊断类型'),
      }),
    },
    (args) => {
      const monthResult = readRequiredMonth(args);
      if (typeof monthResult !== 'string') return monthResult;
      const month = monthResult;
      const type = String(args.type ?? '');
      const rows = index.diagnosis ?? [];
      if (rows.length === 0) return notReady('get_diagnosis');
      const normalizedType =
        DIAGNOSIS_TYPE_ALIASES[type] ?? DIAGNOSIS_TYPE_ALIASES[type.toLowerCase()] ?? type;
      const matched = rows.filter(
        (row) => row.month === month && row.type === normalizedType,
      );
      if (matched.length === 0) {
        return err(
          'not-found',
          `${month} 没有 ${type} 的诊断数据`,
          `可用类型：${[...new Set(rows.map((row) => row.type))].join('、')}`,
        );
      }
      const first = matched[0]!;
      return ok({
        month,
        type: normalizedType,
        metrics: first.metrics,
        missing: first.missing,
        rows: matched,
      });
    },
  );

  return server;
}

/** 实体名匹配：完全相等，或一方包含另一方（实体名常带「品牌」等前后缀）。 */
function matchesEntityName(entityId: string, brand: string): boolean {
  if (!brand) return false;
  return entityId === brand || entityId.includes(brand) || brand.includes(entityId);
}
