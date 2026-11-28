import type { Portrait } from '../portrait/types.js';
import type { ProductDossier } from '../product/types.js';
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
  NormalizationIssue,
  NormalizedPortrait,
  PortraitConflictEntry,
  ProductChannelEntry,
  ProductPerformanceEntry,
  RecencyEntry,
} from '../normalize/types.js';
import type { ChannelRecord } from '../normalize/types.js';

/**
 * 数据索引。
 *
 * 索引是归一化结果的**只读投影**，由 `buildIndex` 从数据目录扫描产出。
 * 索引本身不落库进 git，构建产物写入 `.local/`。
 */
export interface DataIndex {
  /** 构建时间（ISO 字符串）。 */
  builtAt: string;
  /** 数据根目录。 */
  dataRoot: string;
  /** 索引覆盖的月份，升序。区间月份（如 `2025-07~2026-06`）按字面保留。 */
  months: string[];
  products: ProductDossier[];
  channels: ChannelRecord[];
  portraits: NormalizedPortrait[];
  /** 构建过程中的问题清单。 */
  issues: NormalizationIssue[];
  /**
   * 数据未就位的工具名 → 缺什么数据源的说明。
   * 这些工具调用时返回明确错误，不返回空结果。
   */
  unavailable: Record<string, string>;

  /* ── P0 数据收尾新增表 ──────────────────────────────────────────────
   *
   * 全部为可选：表文件不存在时保持现状（与 main 逐字一致）。
   */

  /** 实体别名目录（`data/tables/entity-alias.csv`）。 */
  entityAliases?: EntityAliasEntry[];
  /** 跨文件画像冲突显式映射（`data/tables/portrait-conflicts.csv`）。 */
  portraitConflicts?: PortraitConflictEntry[];
  /** 商品 ↔ 渠道归属与成交（`data/tables/product-channel.csv`）。 */
  productChannels?: ProductChannelEntry[];
  /** 聚合口径（`data/tables/aggregate-groups.csv`）。 */
  aggregateGroups?: AggregateGroupEntry[];
  /** 商品经营指标（`data/tables/product-performance.csv`）。 */
  productPerformance?: ProductPerformanceEntry[];
  /** 渠道经营指标（`data/tables/channel-performance.csv`）。 */
  channelPerformance?: ChannelPerformanceEntry[];
  /** 生命周期漏斗（`data/tables/funnel.csv`）。 */
  funnel?: FunnelEntry[];
  /** 会员特征字典（`data/tables/member-features.csv`）。 */
  memberFeatures?: MemberFeatureEntry[];
  /** Cohort 留存（`data/retention/cohort.csv`）。 */
  cohort?: CohortEntry[];
  /** 老客 Recency 分布（`data/retention/recency.csv`）。 */
  recency?: RecencyEntry[];
  /** 跨渠道流转矩阵（`data/retention/channel-flow.csv`）。 */
  channelFlow?: ChannelFlowEntry[];
  /** 三大诊断输入（`data/retention/diagnosis.csv`）。 */
  diagnosis?: DiagnosisEntry[];
  /** 竞品人群画像（`data/domains/07_人群画像/竞品/`）。 */
  competitorPortraits?: NormalizedPortrait[];
  /** 数据时间范围声明（`data/README.md`）。 */
  declaration?: DataRangeDeclaration;
}

/** 画像实体的检索定位。 */
export interface PortraitKey {
  entityType: Portrait['entityType'];
  entityId: string;
  month?: string;
}

/** 两个分布在同一维度上的差异。 */
export interface DimensionDiff {
  dimension: string;
  productTop3: { label: string; share: number; tgi?: number }[];
  channelTop3: { label: string; share: number; tgi?: number }[];
  /** JS 距离（0 = 完全一致）。 */
  distance: number;
  /** Top3 标签重合度 0-1。 */
  overlapTop3: number;
  jsSimilarity: number;
  cosine: number;
}

/** 商品与渠道的画像差异。 */
export interface ProductChannelComparison {
  spu: string;
  channelId: string;
  month?: string;
  dimensions: DimensionDiff[];
  /** 只在一方出现的维度。 */
  onlyInProduct: string[];
  onlyInChannel: string[];
  /** 参与比较的维度数。 */
  comparedDimensions: number;
}
