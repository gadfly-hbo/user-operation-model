import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  aggregatePortrait,
  availableMonths,
  channelEntityIds,
  compareProductChannel,
  findChannel,
  findPortrait,
  findPortraitByEntityIds,
  findProduct,
  listChannels,
  listProducts,
  searchByTag,
  similarProducts,
  type DataIndex,
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

  // ── 渠道 ───────────────────────────────────────────────────
  register(
    'list_channels',
    {
      title: '列出渠道',
      description: '列出渠道及其画像覆盖情况。可按月份与渠道类型过滤。',
      inputSchema: z.object({
        month: z.string().optional().describe('月份 YYYY-MM 或区间；过滤有画像的渠道'),
        type: z.string().optional().describe('渠道类型或平台，如「抖音」「天猫」「实体店」'),
      }),
    },
    (args) => {
      const channels = listChannels(index, {
        ...(typeof args.month === 'string' ? { month: args.month } : {}),
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
      }),
    },
    (args) => {
      const channelId = String(args.channelId ?? '');
      const month = typeof args.month === 'string' ? args.month : undefined;
      const channel = findChannel(index, channelId);
      if (!channel) {
        return err('not-found', `渠道 ${channelId} 不在索引中`, '用 list_channels 查看可用渠道');
      }
      const entityIds = channelEntityIds(index, channelId);
      const portrait = findPortraitByEntityIds(index, {
        entityType: 'channel',
        entityIds,
        ...(month ? { month } : {}),
      });
      if (!portrait) {
        const months = availableMonths(index, 'channel', entityIds);
        return err(
          month ? 'month-mismatch' : 'ambiguous',
          month
            ? `渠道 ${channelId} 在 ${month} 无画像`
            : `渠道 ${channelId} 有多份画像，必须指定 month`,
          months.length ? `可用月份：${months.join('、')}` : undefined,
        );
      }
      return ok({
        channelId,
        channel,
        month: portrait.month,
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
      if (!index.unavailable.get_brand_portrait) {
        const portraits = index.portraits.filter(
          (portrait) => portrait.entityType === 'brand',
        );
        return ok({ scope, portraits });
      }
      return err(
        'data-not-ready',
        '品牌人群画像未接入：期望 data/domains/01_品牌信息/ 下有品牌画像文件',
        '当前 01_品牌信息 只有品牌清单，没有人群画像',
      );
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
    () => notReady('get_competitor_portrait'),
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
      if (typeof args.channel === 'string' && args.channel !== '') {
        return err(
          'data-not-ready',
          '按渠道过滤商品暂不可用：现有数据源中商品表与渠道表没有关联键',
          '需另提供商品→渠道的归属数据',
        );
      }
      const products = listProducts(index, {
        ...(typeof args.category === 'string' ? { category: args.category } : {}),
        ...(typeof args.season === 'string' ? { season: args.season } : {}),
        ...(typeof args.keyword === 'string' ? { keyword: args.keyword } : {}),
        ...(typeof args.minPrice === 'number' ? { minPrice: args.minPrice } : {}),
        ...(typeof args.maxPrice === 'number' ? { maxPrice: args.maxPrice } : {}),
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
        })),
      });
    },
  );

  register(
    'get_product_dossier',
    {
      title: '取单品全量档案',
      description: '取单品的属性、FAB、画像、漏斗与经营指标。',
      inputSchema: z.object({
        spu: z.string().describe('款号'),
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const product = findProduct(index, spu);
      if (!product) {
        return err('not-found', `商品 ${spu} 不在索引中`, '用 list_products 查看可用商品');
      }
      const portrait = findPortrait(index, { entityType: 'product', entityId: spu });
      return ok({
        ...product,
        portrait: portrait
          ? { month: portrait.month, projections: portrait.projections }
          : undefined,
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
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const month = typeof args.month === 'string' ? args.month : undefined;
      const portrait = findPortrait(index, {
        entityType: 'product',
        entityId: spu,
        ...(month ? { month } : {}),
      });
      if (!portrait) {
        const months = availableMonths(index, 'product', spu);
        return err(
          month ? 'month-mismatch' : 'ambiguous',
          month ? `商品 ${spu} 在 ${month} 无画像` : `商品 ${spu} 无画像或有多份画像`,
          months.length ? `可用月份：${months.join('、')}` : undefined,
        );
      }
      const dimensions = Array.isArray(args.dimensions) ? (args.dimensions as string[]) : undefined;
      const projections = dimensions
        ? Object.fromEntries(
            Object.entries(portrait.projections).filter(([key]) => dimensions.includes(key)),
          )
        : portrait.projections;
      return ok({
        spu,
        month: portrait.month,
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
      }),
    },
    (args) => {
      const level = String(args.level ?? '');
      const key = String(args.key ?? '');
      if (level !== 'category') {
        return err(
          'data-not-ready',
          `聚合层级 ${level} 未接入：需要聚合口径表（品��归属哪个系列／爆款／IP）`,
          '当前仅支持 category 层级，可由商品档案的品类字段推导',
        );
      }
      const portrait = aggregatePortrait(index, { level, key });
      if (!portrait) {
        return err('not-found', `品类 ${key} 下没有带画像的商品`);
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
    () => notReady('get_funnel'),
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
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      const channelId = String(args.channelId ?? '');
      const month = typeof args.month === 'string' ? args.month : undefined;
      const comparison = compareProductChannel(index, { spu, channelId, ...(month ? { month } : {}) });
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
            productMonths.length ? `商品可用月份：${productMonths.join('、')}` : undefined,
            channelMonths.length ? `渠道可用月份：${channelMonths.join('、')}` : undefined,
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
      }),
    },
    (args) => {
      const dimension = String(args.dimension ?? '');
      const label = String(args.label ?? '');
      const hits = searchByTag(index, {
        dimension,
        label,
        ...(typeof args.scope === 'string' ? { scope: args.scope } : {}),
        ...(typeof args.topN === 'number' ? { topN: args.topN } : {}),
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
      }),
    },
    (args) => {
      const spu = String(args.spu ?? '');
      if (!findProduct(index, spu)) {
        return err('not-found', `商品 ${spu} 不在索引中`);
      }
      const hits = similarProducts(index, {
        spu,
        ...(typeof args.topN === 'number' ? { topN: args.topN } : {}),
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
    () => notReady('list_member_features'),
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
    () => notReady('get_retention_cohort'),
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
    () => notReady('get_recency_distribution'),
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
    () => notReady('get_channel_flow_matrix'),
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
    () => notReady('get_diagnosis'),
  );

  return server;
}
