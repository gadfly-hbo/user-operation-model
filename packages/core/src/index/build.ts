import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  normalizeChannelTable,
  normalizeDouyinPortrait,
  normalizeJdPortrait,
  normalizeProductTable,
  normalizeTmallPortrait,
} from '../normalize/index.js';
import { detectEntityType, detectPlatform } from '../normalize/platform.js';
import { parseCompetitorPortraits } from '../normalize/competitor.js';
import { parseFunnelTable } from '../normalize/funnel.js';
import { parseMemberFeatureTable } from '../normalize/member-features.js';
import {
  parseChannelFlowTable,
  parseCohortTable,
  parseDiagnosisTable,
  parseRecencyTable,
} from '../normalize/retention.js';
import {
  parseAggregateGroupTable,
  parseEntityAliasTable,
  parsePortraitConflictTable,
  parseProductChannelTable,
} from '../normalize/relations.js';
import {
  deriveActualUnitPrice,
  parseChannelPerformanceTable,
  parseProductPerformanceTable,
} from '../normalize/performance.js';
import {
  parseDataDeclaration,
  parseMonthRange,
  scopeTokens,
  toDeclaration,
} from '../normalize/declaration.js';
import { platformId } from '../normalize/catalog/tables.js';
import type { NormalizationIssue } from '../normalize/types.js';
import type { DataIndex } from './types.js';
import type {
  AggregateGroupEntry,
  ChannelFlowEntry,
  ChannelPerformanceEntry,
  CohortEntry,
  DataRangeDeclaration,
  DiagnosisEntry,
  EntityAliasEntry,
  FunnelEntry,
  MemberFeatureEntry,
  NormalizedPortrait,
  PortraitConflictEntry,
  ProductChannelEntry,
  ProductPerformanceEntry,
  RecencyEntry,
} from '../normalize/types.js';
import type { ChannelRecord } from '../normalize/types.js';
import type { ProductDossier } from '../product/types.js';

/** 索引构建选项。 */
export interface BuildIndexOptions {
  /** 数据根目录，默认 `data`。 */
  dataRoot?: string;
  /** 只扫这些子目录，默认 `domains` 与 `source`。 */
  scanDirs?: string[];
}

/** 需要探测的数据源。探测不到时对应工具返回明确错误。 */
export interface DataSourceProbe {
  tool: string;
  /** 返回 undefined 表示数据就绪，否则返回缺失说明。 */
  probe: (dataRoot: string) => string | undefined;
}

const firstExisting = (dataRoot: string, candidates: readonly string[]): string | undefined =>
  candidates.find((candidate) => existsSync(join(dataRoot, candidate)));

/**
 * 新增表的候选文件路径。
 *
 * **探测与加载共用这一份**：避免「探测说就绪、加载却找不到文件」这类漂移
 * （P0 的 E1 教训：探测说就绪但处理器是桩）。
 */
export const TABLE_SOURCES = {
  funnel: ['tables/funnel.csv', 'tables/funnel.xlsx', 'domains/08_指标体系/funnel.csv'],
  memberFeatures: ['tables/member-features.csv', 'tables/member-features.xlsx'],
  cohort: ['retention/cohort.csv', 'retention/cohort.xlsx', 'tables/cohort.csv'],
  recency: ['retention/recency.csv', 'retention/recency.xlsx', 'tables/recency.csv'],
  channelFlow: [
    'retention/channel-flow.csv',
    'retention/channel-flow.xlsx',
    'tables/channel-flow.csv',
  ],
  diagnosis: ['retention/diagnosis.csv', 'retention/diagnosis.xlsx', 'tables/diagnosis.csv'],
  entityAlias: ['tables/entity-alias.csv', 'tables/entity-alias.xlsx'],
  portraitConflicts: ['tables/portrait-conflicts.csv', 'tables/portrait-conflicts.xlsx'],
  productChannel: ['tables/product-channel.csv', 'tables/product-channel.xlsx'],
  aggregateGroups: ['tables/aggregate-groups.csv', 'tables/aggregate-groups.xlsx'],
  productPerformance: ['tables/product-performance.csv', 'tables/product-performance.xlsx'],
  channelPerformance: ['tables/channel-performance.csv', 'tables/channel-performance.xlsx'],
} as const;

/** 竞品画像目录（相对数据根）。 */
export const COMPETITOR_DIR = 'domains/07_人群画像/竞品';

const fileProbe =
  (candidates: readonly string[], message: string) =>
  (dataRoot: string): string | undefined =>
    firstExisting(dataRoot, candidates) ? undefined : message;

/**
 * 数据源探测表。
 *
 * 探测结果决定工具的「数据是否就绪」层状态。数据补齐后自动生效，
 * 不需要改代码。
 */
export const DATA_SOURCE_PROBES: DataSourceProbe[] = [
  {
    tool: 'get_brand_portrait',
    probe: (dataRoot) => {
      const dir = join(dataRoot, 'domains', '01_品牌信息');
      const found = existsSync(dir)
        ? listFiles(dir).some((file) => detectEntityType(file) === 'brand')
        : false;
      return found
        ? undefined
        : '品牌人群画像未接入：期望 data/domains/01_品牌信息/ 下有品牌画像文件（当前只有品牌清单）';
    },
  },
  {
    tool: 'get_competitor_portrait',
    probe: (dataRoot) => {
      const dir = join(dataRoot, 'domains', '07_人群画像', '竞品');
      return existsSync(dir)
        ? undefined
        : '竞品人群画像未接入：期望 data/domains/07_人群画像/竞品/ 下有竞品画像文件';
    },
  },
  {
    tool: 'get_funnel',
    probe: fileProbe(
      TABLE_SOURCES.funnel,
      '生命周期漏斗未接入：期望按款按月的浏览／收藏／加购／购买／直接购买／退货数据（data/tables/funnel.csv）',
    ),
  },
  {
    tool: 'list_member_features',
    probe: fileProbe(
      TABLE_SOURCES.memberFeatures,
      '会员特征字典未接入：期望业务方案 §5.2 的字段表（data/tables/member-features.csv）',
    ),
  },
  {
    tool: 'get_retention_cohort',
    probe: fileProbe(
      TABLE_SOURCES.cohort,
      'Cohort 留存数据未接入：期望按首购月份分群的 Day30/60/90 留存（data/retention/cohort.csv）',
    ),
  },
  {
    tool: 'get_recency_distribution',
    probe: fileProbe(
      TABLE_SOURCES.recency,
      '老客 Recency 分布未接入：期望按上次购买时间切片的回购人数（data/retention/recency.csv）',
    ),
  },
  {
    tool: 'get_channel_flow_matrix',
    probe: fileProbe(
      TABLE_SOURCES.channelFlow,
      '老客跨渠道流转矩阵未接入：期望来源渠道→回购渠道的流转矩阵（data/retention/channel-flow.csv）',
    ),
  },
  {
    tool: 'get_diagnosis',
    probe: fileProbe(
      TABLE_SOURCES.diagnosis,
      '三大诊断数据未接入：期望二回断崖／虚假繁荣／清仓客跃迁的判定输入（data/retention/diagnosis.csv）',
    ),
  },
];

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export { detectEntityType, detectPlatform };

/**
 * 从数据目录构建索引。
 *
 * 扫描 `domains/` 与 `source/` 两个区，按文件名与目录结构识别四类数据源：
 * 商品宽表、渠道宽表、平台画像文件、聚合口径表。
 *
 * 另外接入新增表（漏斗／留存／别名／冲突／关联／聚合／经营指标）与
 * `data/README.md` 的时间范围声明。表文件不存在时**保持现状**。
 */
export async function buildIndex(options: BuildIndexOptions = {}): Promise<DataIndex> {
  const dataRoot = options.dataRoot ?? 'data';
  const scanDirs = options.scanDirs ?? ['domains', 'source'];
  const issues: NormalizationIssue[] = [];

  if (!existsSync(dataRoot)) {
    throw new Error(`数据根目录不存在：${dataRoot}`);
  }
  const foundScanDirs = scanDirs.filter((dir) => existsSync(join(dataRoot, dir)));
  if (foundScanDirs.length === 0) {
    throw new Error(
      `数据根目录 ${dataRoot} 下没有可扫描的子目录（期望 ${scanDirs.join(' 或 ')}）`,
    );
  }
  const portraits: NormalizedPortrait[] = [];
  const products: DataIndex['products'] = [];
  const channels: DataIndex['channels'] = [];

  // ── 新增表（表文件不存在时保持现状） ────────────────────────────
  const entityAliases = await loadTable(dataRoot, TABLE_SOURCES.entityAlias, parseEntityAliasTable);
  const portraitConflicts = await loadTable(
    dataRoot,
    TABLE_SOURCES.portraitConflicts,
    parsePortraitConflictTable,
  );
  const productChannels = await loadTable(
    dataRoot,
    TABLE_SOURCES.productChannel,
    parseProductChannelTable,
  );
  const aggregateGroups = await loadTable(
    dataRoot,
    TABLE_SOURCES.aggregateGroups,
    parseAggregateGroupTable,
  );
  const productPerformance = await loadTable(
    dataRoot,
    TABLE_SOURCES.productPerformance,
    parseProductPerformanceTable,
  );
  const channelPerformance = await loadTable(
    dataRoot,
    TABLE_SOURCES.channelPerformance,
    parseChannelPerformanceTable,
  );
  const funnel = await loadTable(dataRoot, TABLE_SOURCES.funnel, parseFunnelTable);
  const memberFeatures = await loadTable(
    dataRoot,
    TABLE_SOURCES.memberFeatures,
    parseMemberFeatureTable,
  );
  const cohort = await loadTable(dataRoot, TABLE_SOURCES.cohort, parseCohortTable);
  const recency = await loadTable(dataRoot, TABLE_SOURCES.recency, parseRecencyTable);
  const channelFlow = await loadTable(dataRoot, TABLE_SOURCES.channelFlow, parseChannelFlowTable);
  const diagnosis = await loadTable(dataRoot, TABLE_SOURCES.diagnosis, parseDiagnosisTable);

  // ── 数据时间范围声明 ────────────────────────────────────────────
  const parsedDeclaration = parseDataDeclaration(join(dataRoot, 'README.md'));

  const competitorRoot = join(dataRoot, COMPETITOR_DIR);
  for (const scanDir of scanDirs) {
    const root = join(dataRoot, scanDir);
    for (const file of listFiles(root)) {
      const relativePath = relative(root, file);
      const lower = file.toLowerCase();

      // 竞品目录由竞品解析器单独处理，不进渠道／品牌画像
      if (file.startsWith(competitorRoot + sep)) continue;

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        if (/商品.*信息表|商品宽表/.test(relativePath)) {
          const result = await normalizeProductTable(file);
          issues.push(...result.issues);
          for (const product of result.products) {
            const existing = products.find((item) => item.spu === product.spu);
            if (existing) {
              issues.push({
                kind: 'conflict',
                severity: 'warning',
                sourceLabel: product.spu,
                message: `款号 ${product.spu} 在多张商品表中重复（${relativePath}），保留先到的一条，未做隐式合并`,
              });
              continue;
            }
            products.push(product);
          }
          continue;
        }
        if (/渠道.*宽表|店铺.*宽表/.test(relativePath)) {
          const result = await normalizeChannelTable(file);
          channels.push(...result.channels);
          issues.push(...result.issues);
          continue;
        }
        const platform = detectPlatform(file);
        if (platform) {
          const entityType = detectEntityType(file);
          const options2 = { entityType };
          const portrait =
            platform === 'douyin'
              ? normalizeDouyinPortrait(file, options2)
              : platform === 'tmall'
                ? await normalizeTmallPortrait(file, options2)
                : await normalizeJdPortrait(file, options2);
          portraits.push(portrait);
          issues.push(...(portrait.issues ?? []));
          continue;
        }
      }

      if (lower.endsWith('.csv')) {
        const platform = detectPlatform(file);
        if (platform === 'douyin') {
          const portrait = normalizeDouyinPortrait(file, { entityType: detectEntityType(file) });
          portraits.push(portrait);
          issues.push(...(portrait.issues ?? []));
          continue;
        }
      }

      issues.push({
        kind: 'parse-error',
        severity: 'warning',
        message: `未识别的数据文件，已跳过：${relativePath}`,
      });
    }
  }

  // ── 竞品画像（独立实体类型，不进渠道／品牌画像） ──────────────────
  const competitor = await parseCompetitorPortraits(join(dataRoot, COMPETITOR_DIR));
  issues.push(...competitor.issues);

  // ── 实体别名归一（DC04） ───────────────────────────────────────
  const aliased = applyEntityAliases(portraits, entityAliases, issues);

  // ── 跨平台画像冲突处置（DC05） ─────────────────────────────────
  const resolved = applyPortraitConflicts(aliased, portraitConflicts, issues);

  // ── 时间范围声明裁剪（DC06） ───────────────────────────────────
  const declaration = resolveDeclaration(parsedDeclaration, channels, products, resolved);
  const scopedPortraits = applyDeclaration(resolved, declaration, issues);
  const scopedChannels = applyChannelScope(channels, declaration, issues);
  const scopedProducts = applyProductScope(products, declaration, issues);

  // ── 经营指标与商品↔渠道关联（DC07／DC09） ──────────────────────
  applyProductPerformance(scopedProducts, productPerformance, issues);
  applyChannelPerformance(scopedChannels, channelPerformance, issues);
  applyProductChannel(scopedProducts, productChannels, issues);
  applyFunnel(scopedProducts, funnel);

  const months = [...new Set(scopedPortraits.map((portrait) => portrait.month).filter(Boolean))].sort();
  const unavailable: Record<string, string> = {};
  for (const probe of DATA_SOURCE_PROBES) {
    const missing = probe.probe(dataRoot);
    if (missing) unavailable[probe.tool] = missing;
  }

  const index: DataIndex = {
    builtAt: new Date().toISOString(),
    dataRoot,
    months,
    products: scopedProducts,
    channels: scopedChannels,
    portraits: scopedPortraits,
    issues,
    unavailable,
    declaration,
  };

  // 新表字段只在表文件到位时出现：无表时索引与现状逐字一致
  if (entityAliases) index.entityAliases = entityAliases;
  if (portraitConflicts) index.portraitConflicts = portraitConflicts;
  if (productChannels) index.productChannels = productChannels;
  if (aggregateGroups) index.aggregateGroups = aggregateGroups;
  if (productPerformance) index.productPerformance = productPerformance;
  if (channelPerformance) index.channelPerformance = channelPerformance;
  if (funnel) index.funnel = funnel;
  if (memberFeatures) index.memberFeatures = memberFeatures;
  if (cohort) index.cohort = cohort;
  if (recency) index.recency = recency;
  if (channelFlow) index.channelFlow = channelFlow;
  if (diagnosis) index.diagnosis = diagnosis;
  if (competitor.portraits.length > 0) index.competitorPortraits = competitor.portraits;

  return index;
}

/** 读新增表：文件不存在时返回 undefined（保持现状），存在时解析。 */
async function loadTable<T>(
  dataRoot: string,
  candidates: readonly string[],
  parse: (path: string) => Promise<T[]>,
): Promise<T[] | undefined> {
  const found = firstExisting(dataRoot, candidates);
  if (!found) return undefined;
  return parse(join(dataRoot, found));
}

/**
 * 实体别名归一。
 *
 * 画像实体名先归一到规范名，再关联渠道宽表。**只做实体名归一，
 * 不做画像内容合并**。
 */
function applyEntityAliases(
  portraits: NormalizedPortrait[],
  aliases: EntityAliasEntry[] | undefined,
  issues: NormalizationIssue[],
): NormalizedPortrait[] {
  if (!aliases || aliases.length === 0) return portraits;
  const map = new Map<string, string>();
  for (const entry of aliases) {
    if (!entry.alias || !entry.canonical) continue;
    if (entry.alias === entry.canonical) continue;
    map.set(entry.alias, entry.canonical);
  }
  if (map.size === 0) return portraits;

  return portraits.map((portrait) => {
    const canonical = map.get(portrait.entityId);
    if (!canonical) return portrait;
    issues.push({
      kind: 'entity-alias',
      severity: 'warning',
      sourceLabel: portrait.entityId,
      message: `画像实体名「${portrait.entityId}」按实体别名目录归一为「${canonical}」`,
    });
    return { ...portrait, entityId: canonical };
  });
}

/**
 * 跨平台画像冲突处置。
 *
 * - 有显式映射：按处置保留一侧（keep-a／keep-b），manual 两侧都留并提示人工处理
 * - 无显式映射：**保持现状**（两侧都保留），记 conflict issue，**不隐式合并**
 */
function applyPortraitConflicts(
  portraits: NormalizedPortrait[],
  conflicts: PortraitConflictEntry[] | undefined,
  issues: NormalizationIssue[],
): NormalizedPortrait[] {
  const groups = new Map<string, NormalizedPortrait[]>();
  for (const portrait of portraits) {
    const key = `${portrait.entityType}|${portrait.entityId}|${portrait.month}`;
    const list = groups.get(key) ?? [];
    list.push(portrait);
    groups.set(key, list);
  }

  const dropped = new Set<NormalizedPortrait>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const platforms = group.map((portrait) => Object.keys(portrait.platformLabels)[0] ?? '');
    const rule = findConflictRule(conflicts, first, platforms);
    const label = `${first.entityType} ${first.entityId} ${first.month || '未知月份'}`;

    if (!rule) {
      issues.push({
        kind: 'conflict',
        severity: 'warning',
        sourceLabel: first.entityId,
        message: `${label} 存在多平台画像（${platforms.join('、')}），未登记显式冲突映射，保留全部且未做隐式合并`,
      });
      continue;
    }

    if (rule.resolution === 'manual') {
      issues.push({
        kind: 'conflict',
        severity: 'error',
        sourceLabel: first.entityId,
        message: `${label} 的多平台画像冲突按冲突映射表标记为人工处理（${rule.note ?? '无说明'}），两侧均保留，未做隐式合并`,
      });
      continue;
    }

    const keep = rule.resolution === 'keep-a' ? rule.platformA : rule.platformB;
    const remove = rule.resolution === 'keep-a' ? rule.platformB : rule.platformA;
    for (const portrait of group) {
      const platform = Object.keys(portrait.platformLabels)[0] ?? '';
      if (platformId(platform) === platformId(remove)) dropped.add(portrait);
    }
    issues.push({
      kind: 'conflict',
      severity: 'warning',
      sourceLabel: first.entityId,
      message: `${label} 的多平台画像冲突按冲突映射表处置：保留 ${keep}，移除 ${remove}${rule.note ? `（${rule.note}）` : ''}`,
    });
  }

  if (dropped.size === 0) return portraits;
  return portraits.filter((portrait) => !dropped.has(portrait));
}

/** 找匹配的冲突映射条目。 */
function findConflictRule(
  conflicts: PortraitConflictEntry[] | undefined,
  portrait: NormalizedPortrait,
  platforms: string[],
): PortraitConflictEntry | undefined {
  if (!conflicts || conflicts.length === 0) return undefined;
  const scope = new Set(platforms.map(platformId));
  for (const rule of conflicts) {
    if (rule.entity !== portrait.entityId) continue;
    if (rule.month && rule.month !== portrait.month) continue;
    if (!scope.has(platformId(rule.platformA)) || !scope.has(platformId(rule.platformB))) continue;
    return rule;
  }
  return undefined;
}

/**
 * 解析声明并匹配范围标识。
 *
 * 渠道／商品范围用标识清单声明；能在索引里找到对应记录的标识才生效。
 */
function resolveDeclaration(
  parsed: ReturnType<typeof parseDataDeclaration>,
  channels: ChannelRecord[],
  products: ProductDossier[],
  portraits: NormalizedPortrait[],
): DataRangeDeclaration {
  const channelScope = scopeTokens(parsed.channelsText);
  const productScope = scopeTokens(parsed.productsText);
  const channelIds = channelScope
    .map((token) => {
      const hit = channels.find(
        (channel) => channel.channelId === token || channel.name === token,
      );
      return hit?.channelId;
    })
    .filter((id): id is string => Boolean(id));
  const spus = productScope
    .map((token) => {
      const hit = products.find((product) => product.spu === token || product.name === token);
      return hit?.spu;
    })
    .filter((spu): spu is string => Boolean(spu));

  const notes = [...parsed.notes];
  if (channelScope.length > 0 && channelIds.length === 0) {
    notes.push(`渠道范围声明（${parsed.channelsText}）里的标识在索引中找不到，未按渠道裁剪`);
  }
  if (productScope.length > 0 && spus.length === 0) {
    notes.push(`商品范围声明（${parsed.productsText}）里的标识在索引中找不到，未按商品裁剪`);
  }
  // 声明里出现但索引里没有的画像实体，按「不在声明范围内」处理
  if (parsed.declared && portraits.length === 0) {
    notes.push('声明范围内没有任何画像记录');
  }

  return toDeclaration(parsed, channelIds, spus);
}

/** 按声明的覆盖月份裁剪画像。 */
function applyDeclaration(
  portraits: NormalizedPortrait[],
  declaration: DataRangeDeclaration,
  issues: NormalizationIssue[],
): NormalizedPortrait[] {
  if (declaration.months.length === 0) return portraits;
  const scope = new Set(declaration.months);
  const kept: NormalizedPortrait[] = [];
  for (const portrait of portraits) {
    if (portrait.month === '') {
      issues.push({
        kind: 'scope-excluded',
        severity: 'warning',
        sourceLabel: portrait.entityId,
        message: `画像 ${portrait.entityType}/${portrait.entityId} 没有月份信息，无法判定是否在声明范围内，已保留`,
      });
      kept.push(portrait);
      continue;
    }
    if (monthWithinScope(portrait.month, scope)) {
      kept.push(portrait);
      continue;
    }
    issues.push({
      kind: 'scope-excluded',
      severity: 'warning',
      sourceLabel: portrait.entityId,
      message: `画像 ${portrait.entityType}/${portrait.entityId} 的月份 ${portrait.month} 不在声明的覆盖月份范围（${declaration.months[0]} ~ ${declaration.months[declaration.months.length - 1]}）内，已跳过`,
    });
  }
  return kept;
}

/**
 * 月份是否**完全**落在声明范围内。
 *
 * 区间月份（如 `2025-07~2026-06`）要求区间内的每个月都在声明范围内：
 * 画像内部的分布无法裁剪，只有一部分落在范围内时整份跳过。
 */
function monthWithinScope(month: string, scope: Set<string>): boolean {
  if (scope.has(month)) return true;
  if (!month.includes('~')) return false;
  const [start, end] = month.split('~');
  if (!start || !end) return false;
  const months = parseMonthRange(`${start} ~ ${end}`);
  return months.length > 0 && months.every((item) => scope.has(item));
}

/** 按声明的渠道范围裁剪渠道与渠道画像。 */
function applyChannelScope(
  channels: ChannelRecord[],
  declaration: DataRangeDeclaration,
  issues: NormalizationIssue[],
): ChannelRecord[] {
  if (declaration.channels.length === 0) return channels;
  const scope = new Set(declaration.channels);
  const kept = channels.filter(
    (channel) => scope.has(channel.channelId) || (channel.name ? scope.has(channel.name) : false),
  );
  for (const channel of channels) {
    if (kept.includes(channel)) continue;
    issues.push({
      kind: 'scope-excluded',
      severity: 'warning',
      sourceLabel: channel.channelId,
      message: `渠道 ${channel.channelId}（${channel.name ?? '无店铺名'}）不在声明的渠道范围内，已跳过`,
    });
  }
  return kept;
}

/** 按声明的商品范围裁剪商品。 */
function applyProductScope(
  products: ProductDossier[],
  declaration: DataRangeDeclaration,
  issues: NormalizationIssue[],
): ProductDossier[] {
  if (declaration.products.length === 0) return products;
  const scope = new Set(declaration.products);
  const kept = products.filter((product) => scope.has(product.spu));
  for (const product of products) {
    if (kept.includes(product)) continue;
    issues.push({
      kind: 'scope-excluded',
      severity: 'warning',
      sourceLabel: product.spu,
      message: `商品 ${product.spu} 不在声明的商品范围内，已跳过`,
    });
  }
  return kept;
}

/**
 * 填充商品经营指标。
 *
 * - 缺失字段保持缺失，**不插补**
 * - 零售额与零售量齐全时推出真实成交单价（仅当单价原本缺失）
 * - 同款号多个月份时取最新月份，其余记 issue
 */
function applyProductPerformance(
  products: ProductDossier[],
  entries: ProductPerformanceEntry[] | undefined,
  issues: NormalizationIssue[],
): void {
  if (!entries || entries.length === 0) return;
  const bySpu = new Map<string, ProductPerformanceEntry[]>();
  for (const entry of entries) {
    const list = bySpu.get(entry.spu) ?? [];
    list.push(entry);
    bySpu.set(entry.spu, list);
  }

  for (const product of products) {
    const rows = bySpu.get(product.spu);
    if (!rows || rows.length === 0) continue;
    const latest = pickLatest(rows);
    if (rows.length > 1) {
      issues.push({
        kind: 'parse-error',
        severity: 'warning',
        sourceLabel: product.spu,
        message: `款号 ${product.spu} 的经营指标覆盖 ${rows.length} 个月份，档案取最新月份 ${latest.month ?? '未知'}`,
      });
    }

    const performance: NonNullable<ProductDossier['performance']> = {};
    if (latest.sellThroughRate !== undefined) performance.sellThroughRate = latest.sellThroughRate;
    if (latest.returnRate !== undefined) performance.returnRate = latest.returnRate;
    if (latest.refundRate !== undefined) performance.refundRate = latest.refundRate;
    if (latest.grossMargin !== undefined) performance.grossMargin = latest.grossMargin;
    if (latest.uv !== undefined) performance.uv = latest.uv;
    if (latest.conversionRate !== undefined) performance.conversionRate = latest.conversionRate;
    if (Object.keys(performance).length > 0) product.performance = performance;

    product.price ??= {};
    if (product.price.retailAmount === undefined && latest.retailAmount !== undefined) {
      product.price.retailAmount = latest.retailAmount;
    }
    if (product.price.retailQty === undefined && latest.retailQty !== undefined) {
      product.price.retailQty = latest.retailQty;
    }
    const unitPrice = deriveActualUnitPrice(
      product.price.actualUnitPrice,
      product.price.retailAmount,
      product.price.retailQty,
    );
    if (unitPrice !== undefined && product.price.actualUnitPrice === undefined) {
      product.price.actualUnitPrice = unitPrice;
    }
  }
}

/** 填充渠道经营指标。 */
function applyChannelPerformance(
  channels: ChannelRecord[],
  entries: ChannelPerformanceEntry[] | undefined,
  issues: NormalizationIssue[],
): void {
  if (!entries || entries.length === 0) return;
  const byChannel = new Map<string, ChannelPerformanceEntry[]>();
  for (const entry of entries) {
    const list = byChannel.get(entry.channelId) ?? [];
    list.push(entry);
    byChannel.set(entry.channelId, list);
  }

  for (const channel of channels) {
    const rows = byChannel.get(channel.channelId);
    if (!rows || rows.length === 0) continue;
    const latest = pickLatest(rows);
    if (rows.length > 1) {
      issues.push({
        kind: 'parse-error',
        severity: 'warning',
        sourceLabel: channel.channelId,
        message: `渠道 ${channel.channelId} 的经营指标覆盖 ${rows.length} 个月份，档案取最新月份 ${latest.month ?? '未知'}`,
      });
    }
    channel.performance = {
      ...(latest.month ? { month: latest.month } : {}),
      ...(latest.gmv !== undefined ? { gmv: latest.gmv } : {}),
      ...(latest.orderCount !== undefined ? { orderCount: latest.orderCount } : {}),
      ...(latest.conversionRate !== undefined ? { conversionRate: latest.conversionRate } : {}),
      ...(latest.aov !== undefined ? { aov: latest.aov } : {}),
      ...(latest.grossMargin !== undefined ? { grossMargin: latest.grossMargin } : {}),
    };
  }
}

/** 填充商品↔渠道成交。 */
function applyProductChannel(
  products: ProductDossier[],
  entries: ProductChannelEntry[] | undefined,
  issues: NormalizationIssue[],
): void {
  if (!entries || entries.length === 0) return;
  const bySpu = new Map<string, ProductChannelEntry[]>();
  for (const entry of entries) {
    const list = bySpu.get(entry.spu) ?? [];
    list.push(entry);
    bySpu.set(entry.spu, list);
  }

  for (const product of products) {
    const rows = bySpu.get(product.spu);
    if (!rows || rows.length === 0) continue;
    const byChannel = new Map<string, ProductChannelEntry[]>();
    for (const row of rows) {
      const list = byChannel.get(row.channelId) ?? [];
      list.push(row);
      byChannel.set(row.channelId, list);
    }
    const performance: NonNullable<ProductDossier['channelPerformance']> = {};
    for (const [channelId, channelRows] of byChannel) {
      const latest = pickLatest(channelRows);
      if (channelRows.length > 1) {
        issues.push({
          kind: 'parse-error',
          severity: 'warning',
          sourceLabel: product.spu,
          message: `款号 ${product.spu} 在渠道 ${channelId} 的成交记录覆盖 ${channelRows.length} 个月份，档案取最新月份 ${latest.month ?? '未知'}`,
        });
      }
      performance[channelId] = {
        ...(latest.retailAmount !== undefined ? { retailAmount: latest.retailAmount } : {}),
        ...(latest.retailQty !== undefined ? { retailQty: latest.retailQty } : {}),
      };
    }
    if (Object.keys(performance).length > 0) product.channelPerformance = performance;
  }
}

/** 取最新月份的一条（月份相同时取后出现的一条）。 */
function pickLatest<T extends { month?: string }>(rows: T[]): T {
  return [...rows].sort((left, right) => (left.month ?? '').localeCompare(right.month ?? '')).at(-1)!;
}

/**
 * 把漏斗挂到单品档案。
 *
 * 只挂登记过的阶段（launch／growth／clearance）；未登记的阶段保留在漏斗表里，
 * 可经 `get_funnel` 查询，但不进档案的阶段枚举。
 */
function applyFunnel(
  products: ProductDossier[],
  entries: FunnelEntry[] | undefined,
): void {
  if (!entries || entries.length === 0) return;
  const bySpu = new Map<string, FunnelEntry[]>();
  for (const entry of entries) {
    const list = bySpu.get(entry.spu) ?? [];
    list.push(entry);
    bySpu.set(entry.spu, list);
  }
  for (const product of products) {
    const rows = bySpu.get(product.spu);
    if (!rows || rows.length === 0) continue;
    const metrics = rows
      .filter((row) => row.phase === 'launch' || row.phase === 'growth' || row.phase === 'clearance')
      .map((row) => ({ phase: row.phase as 'launch' | 'growth' | 'clearance', metrics: row.metrics }));
    if (metrics.length > 0) product.funnel = metrics;
  }
}
