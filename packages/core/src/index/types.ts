import type { Portrait } from '../portrait/types.js';
import type { ProductDossier } from '../product/types.js';
import type { ChannelRecord, NormalizationIssue, NormalizedPortrait } from '../normalize/types.js';

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
