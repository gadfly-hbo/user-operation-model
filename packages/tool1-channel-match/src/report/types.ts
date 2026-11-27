import type { MatchConfig, MatchResult } from '@uom/core';

/** 报告里的商品。 */
export interface ReportProduct {
  spu: string;
  name: string;
  /** 零售额（错配清单排序用）。缺该值的商品不进入排序。 */
  retailAmount?: number;
  /** 真实成交单价。 */
  price?: number;
}

/** 报告里的渠道。 */
export interface ReportChannel {
  id: string;
  name: string;
  type?: string;
}

/** 不可评分的单元及其原因。 */
export interface UnscoredCell {
  spu: string;
  channelId: string;
  reason: string;
}

/** 报告元信息。 */
export interface ReportMeta {
  /** 报告标题。 */
  title: string;
  /** 数据集说明。合成数据必须显式标注。 */
  source: string;
  /** 是否为合成演示数据。 */
  isDemo: boolean;
  /** 计算所用自然月。 */
  month: string;
  /** 生成时间（由调用方给定，保证可复现）。 */
  generatedAt: string;
  /** 评分配置版本。 */
  configVersion: string;
  /** 数据覆盖与口径说明。 */
  notes: string[];
}

/** 渲染报告所需的全部输入。 */
export interface ReportInput {
  meta: ReportMeta;
  /**
   * 评分配置（**与计算结果所用的是同一份**）。
   * 渲染层不再写死评级阈值、熔断阈值、混合比例与裁剪区间，全部从这里取，
   * 避免出现第二份参数副本。
   */
  config: MatchConfig;
  products: ReportProduct[];
  channels: ReportChannel[];
  /** 已评分单元的结果。 */
  results: MatchResult[];
  /** 已知不可评分的单元及原因。 */
  unscored?: UnscoredCell[];
}

/** 错配清单的一行。 */
export interface MismatchRow {
  rank: number;
  spu: string;
  productName: string;
  channelId: string;
  channelName: string;
  month: string;
  score: number;
  grade: 'A' | 'B' | 'C';
  fuse: boolean;
  retailAmount: number;
  /** 错配优先级 = 零售额 × (1 - 匹配分/100)。 */
  priority: number;
  positiveDrivers: string;
  negativeDrivers: string;
  price?: number;
  priceBand?: string;
  penalty?: number;
  flags: string[];
}
