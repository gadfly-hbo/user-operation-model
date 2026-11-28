import type { ProductDossier } from '../product/types.js';
import type { PriceSource } from './types.js';

/**
 * 单价与零售额解析的单一来源（切片 A · SA-08）。
 *
 * `resolveUnitPrice(product, month?)` 是唯一实现：
 * 该月经营指标（零售额、零售量均 > 0）→ 主数据 actualUnitPrice → unitPrice → missing。
 * 索引构建不再把按月指标写回 `price`；工具1 与错配排序都从这里取。
 */

/** 单价解析结果。 */
export interface ResolvedUnitPrice {
  /** 解析出的单价；undefined 表示缺失（不插补）。 */
  price?: number;
  /** 来源口径。 */
  source: PriceSource;
}

/**
 * 单价与零售额解析所需的最小输入（复核修正）。
 *
 * `ProductDossier` 天然满足该结构；工具1 的参考数据路径不再需要
 * 伪造完整档案（去掉 `as ProductDossier` 强转）。
 */
export type UnitPriceInput = Pick<ProductDossier, 'price' | 'performance'>;

/** 两位小数。 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 指标是否为有效正数。 */
function positive(value: number | undefined): value is number {
  return value !== undefined && value > 0;
}

/** 指定月的经营指标（无月份或无该月记录时为 undefined）。 */
function monthMetrics(product: UnitPriceInput, month?: string) {
  if (month === undefined) return undefined;
  return product.performance?.[month];
}

/**
 * 解析真实成交单价。**唯一实现**——索引构建与工具1 都调用它。
 */
export function resolveUnitPrice(product: UnitPriceInput, month?: string): ResolvedUnitPrice {
  const metrics = monthMetrics(product, month);
  if (metrics && positive(metrics.retailAmount) && positive(metrics.retailQty)) {
    return { price: round2(metrics.retailAmount! / metrics.retailQty!), source: 'retail-amount-qty' };
  }
  if (positive(product.price?.actualUnitPrice)) {
    return { price: product.price?.actualUnitPrice, source: 'actual-unit-price' };
  }
  if (positive(product.price?.unitPrice)) {
    // P1 基线对 unit-price 来源同样保留两位小数（复核修正）
    return { price: round2(product.price?.unitPrice!), source: 'unit-price' };
  }
  return { source: 'missing' };
}

/**
 * 解析错配排序用的零售额：该月指标优先，其次主数据，缺失不插补。
 */
export function resolveRetailAmount(product: UnitPriceInput, month?: string): number | undefined {
  const metrics = monthMetrics(product, month);
  if (metrics?.retailAmount !== undefined) return metrics.retailAmount;
  return product.price?.retailAmount;
}
