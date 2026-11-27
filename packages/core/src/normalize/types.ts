import type { EntityType, Portrait } from '../portrait/types.js';
import type { ProductDossier } from '../product/types.js';

/** 归一化过程中发现的问题。 */
export interface NormalizationIssue {
  kind:
    | 'unmapped-dimension'
    | 'unmapped-value'
    | 'missing-field'
    | 'conflict'
    | 'entity-alias'
    | 'scope-excluded'
    | 'parse-error';
  /** 严重度。未映射类问题不阻断流程，解析错误与冲突是阻断级。 */
  severity: 'warning' | 'error';
  platform?: string;
  sourceDimension?: string;
  sourceLabel?: string;
  message: string;
}

/** 归一化后的画像，附带问题清单。 */
export type NormalizedPortrait = Portrait & { issues?: NormalizationIssue[] };

/** 渠道记录。 */
export interface ChannelRecord {
  channelId: string;
  name?: string;
  brand?: string;
  platform?: string;
  channelType?: string;
  channelGrade?: string;
  firstChannel?: string;
  secondChannel?: string;
  province?: string;
  city?: string;
  cityTier?: string;
  storeStatus?: string;
  openDate?: string;
  closeDate?: string;
  /** 渠道经营指标（`data/tables/channel-performance.csv`）。缺失字段不插补。 */
  performance?: ChannelPerformance;
  attributes?: Record<string, string>;
}

/** 商品归一化结果。 */
export interface ProductNormalizationResult {
  products: ProductDossier[];
  issues: NormalizationIssue[];
}

/** 渠道归一化结果。 */
export interface ChannelNormalizationResult {
  channels: ChannelRecord[];
  issues: NormalizationIssue[];
}

/** 归一化选项。 */
export interface NormalizeOptions {
  /**
   * 实体类型。**开放字符串**：新增实体类型（如 competitor）无需改此处。
   */
  entityType?: EntityType;
  entityId?: string;
  month?: string;
}

/**
 * 归一化过程中的致命错误。
 *
 * 与「该月无画像」这类**正常的空结果**区分开：结构性错误（文件损坏、
 * 格式不符、缺关键列）必须抛出，调用方才能区分「数据坏了」与「没数据」。
 */
export class NormalizationError extends Error {
  constructor(
    readonly kind: NormalizationIssue['kind'],
    message: string,
    readonly source?: string,
  ) {
    super(message);
    this.name = 'NormalizationError';
  }
}

/* ── P0 数据收尾新增表的条目类型 ──────────────────────────────────────────
 *
 * 列结构与口径见 `docs/normalize-rules.md` §12；解析器实现见
 * `packages/core/src/normalize/`。缺失字段一律保持 undefined，**不插补**。
 */

/** 实体别名条目（`data/tables/entity-alias.csv`）。 */
export interface EntityAliasEntry {
  /** 规范实体名。 */
  canonical: string;
  /** 别名：导出文件里出现过的写法。 */
  alias: string;
  /** 店铺编码。 */
  channelId?: string;
  /** 平台（抖音／天猫／京东…）。 */
  platform?: string;
}

/** 画像冲突显式映射条目（`data/tables/portrait-conflicts.csv`）。 */
export interface PortraitConflictEntry {
  /** 款号或实体。 */
  entity: string;
  /** 月份；空表示适用于所有月份。 */
  month?: string;
  /** 平台 A。 */
  platformA: string;
  /** 平台 B。 */
  platformB: string;
  /** 处置：keep-a 留 A / keep-b 留 B / manual 人工处理。 */
  resolution: 'keep-a' | 'keep-b' | 'manual';
  /** 说明。 */
  note?: string;
}

/** 商品 ↔ 渠道归属与成交（`data/tables/product-channel.csv`）。 */
export interface ProductChannelEntry {
  spu: string;
  channelId: string;
  month?: string;
  retailAmount?: number;
  retailQty?: number;
}

/** 聚合口径条目（`data/tables/aggregate-groups.csv`）。 */
export interface AggregateGroupEntry {
  spu: string;
  /** 系列。 */
  series?: string;
  /** 爆款组。 */
  hot?: string;
  /** IP。 */
  ip?: string;
}

/** 商品经营指标（`data/tables/product-performance.csv`）。 */
export interface ProductPerformanceEntry {
  spu: string;
  month?: string;
  retailAmount?: number;
  retailQty?: number;
  sellThroughRate?: number;
  returnRate?: number;
  refundRate?: number;
  grossMargin?: number;
  uv?: number;
  conversionRate?: number;
}

/** 渠道经营指标（`data/tables/channel-performance.csv`）。 */
export interface ChannelPerformanceEntry {
  channelId: string;
  month?: string;
  gmv?: number;
  orderCount?: number;
  conversionRate?: number;
  aov?: number;
  grossMargin?: number;
}

/** 渠道经营指标（落在渠道档案上）。 */
export interface ChannelPerformance {
  month?: string;
  gmv?: number;
  orderCount?: number;
  conversionRate?: number;
  aov?: number;
  grossMargin?: number;
}

/** 生命周期漏斗条目（`data/tables/funnel.csv`）。 */
export interface FunnelEntry {
  spu: string;
  month?: string;
  phase: string;
  /** 指标名 → 数值。缺失的指标不落位。 */
  metrics: Record<string, number>;
  /** 该行缺失的指标名（显式标记，不插补）。 */
  missing: string[];
}

/** 会员特征字典条目（`data/tables/member-features.csv`）。 */
export interface MemberFeatureEntry {
  /** 特征字段名。 */
  field: string;
  /** 特征值。 */
  value: string;
  /** 特征层级（如 体型版型／风格审美）。 */
  level?: string;
  /** 特征分组。 */
  segment?: string;
  /** 说明。 */
  note?: string;
}

/** Cohort 留存条目（`data/retention/cohort.csv`）。 */
export interface CohortEntry {
  /** 首购月份。 */
  cohortMonth: string;
  /** 分群买家数。 */
  buyers?: number;
  /** 指标名 → 数值。 */
  metrics: Record<string, number>;
  /** 缺失的指标名。 */
  missing: string[];
}

/** 老客 Recency 分布条目（`data/retention/recency.csv`）。 */
export interface RecencyEntry {
  month?: string;
  /** 上次购买天数切片（如 `1-30`）。 */
  bucket: string;
  /** 回购人数。 */
  buyers?: number;
  /** 老客内占比。 */
  shareOfOldCustomers?: number;
  /** 唤醒主推品类。 */
  wakeCategory?: string;
  /** 主要购买渠道。 */
  mainChannel?: string;
  /** 平均毛利率。 */
  grossMargin?: number;
}

/** 跨渠道流转条目（`data/retention/channel-flow.csv`）。 */
export interface ChannelFlowEntry {
  month?: string;
  /** 来源渠道。 */
  from: string;
  /** 当月回购渠道。 */
  to: string;
  /** 跨渠道回购人数。 */
  buyers?: number;
  /** 跨渠道回购率。 */
  crossChannelRate?: number;
}

/** 诊断条目（`data/retention/diagnosis.csv`）。 */
export interface DiagnosisEntry {
  month?: string;
  /** 诊断类型（二回断崖／虚假繁荣／清仓客次季跃迁）。 */
  type: string;
  /** 指标名 → 数值。 */
  metrics: Record<string, number>;
  /** 缺失的指标名。 */
  missing: string[];
}

/** 数据时间范围声明（`data/README.md` 的「数据时间范围声明」表）。 */
export interface DataRangeDeclaration {
  /** 是否已声明（声明表已填写且可解析）。 */
  declared: boolean;
  /** 覆盖月份集合（YYYY-MM）。未声明或不可解析时为空。 */
  months: string[];
  /** 渠道范围标识集合。空表示未按渠道裁剪。 */
  channels: string[];
  /** 商品范围标识集合。空表示未按商品裁剪。 */
  products: string[];
  /** 声明表原文（按项名索引）。 */
  raw: Record<string, string>;
  /** 解析说明（含「未声明」）。 */
  notes: string[];
}
