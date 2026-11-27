import type { MatchPortraitInput } from '@uom/core';

/**
 * 数据集模型。
 *
 * 两条数据路径（`data/` 正式路径、抖音参考数据只读路径）产出同一结构，
 * 匹配内核与报告渲染器都不感知来源。
 */

/** 数据集里的商品。 */
export interface DatasetProduct {
  spu: string;
  name?: string;
  /** 真实成交单价；缺失时不插补。 */
  price?: number;
  /** 价格来源口径。 */
  priceSource?: 'actual-unit-price' | 'retail-amount-qty' | 'unit-price' | 'missing';
  /** 零售额（错配清单排序用）。 */
  retailAmount?: number;
  /** 所选月的画像；缺失时该商品不进矩阵。 */
  portrait?: MatchPortraitInput;
  /** 画像来源平台。 */
  portraitPlatform?: string;
  /** 画像月份匹配方式。 */
  portraitMatch?: 'exact' | 'window' | 'unknown';
}

/** 数据集里的渠道。 */
export interface DatasetChannel {
  id: string;
  name: string;
  type?: string;
  /** 所选月的画像；缺失时该渠道不进矩阵。 */
  portrait?: MatchPortraitInput;
  portraitPlatform?: string;
  portraitMatch?: 'exact' | 'window' | 'unknown';
}

/** 数据集。 */
export interface MatchDataset {
  /** 数据来源类型。 */
  source: 'data' | 'reference';
  /** 数据集说明（不含本机绝对路径）。 */
  sourceLabel: string;
  /** 计算所用自然月。 */
  selectedMonth: string;
  /** 可用月份（升序）。 */
  months: string[];
  products: DatasetProduct[];
  channels: DatasetChannel[];
  /** 数据覆盖与口径说明。 */
  notes: string[];
}
