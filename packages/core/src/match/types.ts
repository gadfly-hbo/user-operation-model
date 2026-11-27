import type { DimensionId } from '../portrait/types.js';

/**
 * 匹配内核的数据契约。
 *
 * 内核是纯函数：输入商品／渠道画像与价格，输出总分、评级与逐维证据。
 * 工具1（事实画像入口）与工具2（预测画像入口）共用这套契约，差异只在画像来源。
 */

/** 参与匹配的画像（统一维度投影 + 时间信息）。 */
export interface MatchPortraitInput {
  /** 统一维度投影：维度 → 标签 → 占比（0-1）。 */
  dimensions: Partial<Record<DimensionId, Record<string, { share: number }>>>;
  /** 画像月份 `YYYY-MM`；空串表示源数据无月份。 */
  month: string;
  /** 画像时间窗；区间画像为 `YYYY-MM~YYYY-MM`。 */
  window?: string;
  /** 画像来源平台（抖音／天猫／京东）。 */
  platform?: string;
}

/** 单次匹配的输入。 */
export interface MatchInput {
  spu: string;
  channelId: string;
  /** 计算所用自然月 `YYYY-MM`。 */
  month: string;
  product: MatchPortraitInput;
  channel: MatchPortraitInput;
  /** 真实成交单价；undefined 表示缺失，**不插补**。 */
  price?: number;
  priceSource?: PriceSource;
}

/** 单价的来源口径。 */
export type PriceSource =
  | 'actual-unit-price'
  | 'retail-amount-qty'
  | 'unit-price'
  | 'missing';

/** 分布维度的相似度证据。 */
export interface MatchDimensionEvidence {
  /** JS 相似度 0-1。 */
  jsSimilarity: number;
  /** 余弦相似度 0-1。 */
  cosine: number;
  /** Top3 重合度 0-1。 */
  top3Overlap: number;
  productTop3: { label: string; share: number }[];
  channelTop3: { label: string; share: number }[];
}

/** 客单承接（消费能力维度）的判定结果。 */
export interface PriceFit {
  /** 命中的价格带规则 id。 */
  bandId: string;
  /** 价格带名称。 */
  band: string;
  /** 渠道高消费占比 0-1。 */
  highShare?: number;
  /** 渠道低消费占比 0-1。 */
  lowShare?: number;
  /** 全局扣分（≤ 0）。 */
  penalty: number;
  /** 诊断文案。 */
  diagnosis: string;
}

/** 单个维度的评分结果。 */
export interface DimensionScore {
  dimension: DimensionId;
  /** 维度分 0-100；不可用时为 null。 */
  score: number | null;
  /** 该维度在配置中的权重。 */
  weight: number;
  /** 是否参与加权。 */
  available: boolean;
  /** 不可用原因。 */
  reason?: MissingReason;
  /** 分布维度的相似度证据。 */
  evidence?: MatchDimensionEvidence;
  /** 消费能力维度的客单承接结果。 */
  priceFit?: PriceFit;
}

/** 维度不可用的原因。 */
export type MissingReason =
  | 'product-missing'
  | 'channel-missing'
  | 'empty-distribution'
  | 'price-missing'
  | 'spending-power-missing';

/** 正向／负向驱动。 */
export interface Driver {
  dimension: DimensionId;
  /** 维度分。 */
  score: number;
  /** 相对加权分的偏差（正为正向驱动，负为负向驱动）。 */
  delta: number;
  /** 该维度权重。 */
  weight: number;
}

/** 匹配结果中的口径标记。 */
export interface MatchFlags {
  /** 单品画像无月份（源数据未提供）。 */
  productMonthUnknown: boolean;
  /** 渠道画像为区间且覆盖所选月。 */
  channelApproximate: boolean;
  /** 价格缺失。 */
  priceMissing: boolean;
}

/** 单次匹配的结果。 */
export interface MatchResult {
  spu: string;
  channelId: string;
  month: string;
  /** 总分 0-100（1 位小数）；维度不足时为 null。 */
  totalScore: number | null;
  grade: 'A' | 'B' | 'C' | null;
  /** 熔断标记（总分低于熔断阈值）。只做显示，不改变评级。 */
  fuse: boolean;
  dimensions: DimensionScore[];
  availableDimensions: DimensionId[];
  missingDimensions: { dimension: DimensionId; reason: MissingReason }[];
  positiveDrivers: Driver[];
  negativeDrivers: Driver[];
  priceFit?: PriceFit;
  flags: MatchFlags;
  /** 无法产出总分时的原因。 */
  error?: 'insufficient-dimensions';
}
