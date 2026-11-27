/**
 * v0.4 跨期留出评估 —— strict-23 口径（Top1 / Top3 重叠比 + Share MAE）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/orchestrate.ts`
 *   逻辑位置：`evaluateHoldout`（第 292–367 行）。
 *
 * 口径（与归档逐条对齐）：
 * - **Top1 / Top3**：重叠比口径 `|预测 TopN ∩ 实际 TopN| / |实际 TopN|`，
 *   实际侧只取 `share > 0` 的标签；实际侧为空记 0。指标实现复用
 *   `packages/core/src/model/metrics.ts` 的 `top1Overlap` / `top3Overlap`（v0.4 口径），
 *   **不另写一份**（工程规范 §9.1 同类要求）。
 * - **Share MAE**：标签并集上的平均绝对份额差，复用 `metrics.ts` 的 `shareMae`。
 * - **聚合**：先算逐维均值，再对六个维度做宏平均。
 *
 * 排序稳定性：归档用 `Array.prototype.sort`（V8 稳定排序），并列时保留插入序。
 * 本模块构造分布时**按模型标签序（字典序）插入预测侧、按 CSV 序插入实际侧**，
 * 使并列打破顺序与归档一致（`metrics.ts` 的 `topLabels` 同样是稳定排序）。
 */

import { shareMae, top1Overlap, top3Overlap } from './metrics.js';
import { predictPortrait, type V04PortraitModel } from './train-v04.js';
import type { V04FeatureSet } from './features-v04.js';
import type { SamplePackage, SamplePackageProduct } from './sample-package.js';

/** 单维指标。 */
export interface HoldoutPerDimensionMetrics {
  top1: number;
  top3: number;
  shareMae: number;
}

/** 留出集整体指标。 */
export interface HoldoutMetrics {
  sampleCount: number;
  avgTop1: number;
  avgTop3: number;
  shareMae: number;
  perDimension: Record<string, HoldoutPerDimensionMetrics>;
}

/**
 * 在留出包上评估模型。
 *
 * @param excludeSkuIds 需要排除的 SKU（strict 口径排除与训练集重叠的款）
 */
export function evaluateHoldout<TInput>(options: {
  model: V04PortraitModel;
  holdout: SamplePackage;
  featureSet: V04FeatureSet<TInput>;
  toInput: (product: SamplePackageProduct) => TInput;
  targetDimensions: readonly string[];
  excludeSkuIds?: ReadonlySet<string>;
}): HoldoutMetrics {
  const { model, holdout, featureSet, toInput, targetDimensions, excludeSkuIds } = options;
  const products = holdout.products.filter(
    (product) => !excludeSkuIds || !excludeSkuIds.has(product.skuId),
  );

  const perDimSums = new Map<string, { top1: number; top3: number; shareMae: number; count: number }>();

  for (const product of products) {
    const predicted = predictPortrait({
      model,
      input: toInput(product),
      featureSet,
      // 归档用 100，保证每个维度的全部标签都参与评估
      outputTopNPerDimension: 100,
    });
    const actualRows = holdout.portraitRows.filter(
      (row) => row.skuId === product.skuId && row.sourceProductKey === product.sourceProductKey,
    );

    for (const dimension of targetDimensions) {
      const predictedDim = predicted.filter((row) => row.labelType === dimension);
      const actualDim = actualRows.filter(
        (row) => row.labelType === dimension && row.share !== null && row.share > 0,
      );

      // 分布构造：预测侧保留全部标签（含 0 份额），实际侧只保留 share > 0 的标签
      const predictedDistribution: Record<string, number> = {};
      for (const row of predictedDim) predictedDistribution[row.label] = row.share;
      const actualDistribution: Record<string, number> = {};
      for (const row of actualDim) actualDistribution[row.label] = row.share ?? 0;

      const top1 = top1Overlap(predictedDistribution, actualDistribution);
      const top3 = top3Overlap(predictedDistribution, actualDistribution);
      const mae = shareMae(predictedDistribution, actualDistribution);

      const aggregate = perDimSums.get(dimension) ?? { top1: 0, top3: 0, shareMae: 0, count: 0 };
      aggregate.top1 += top1;
      aggregate.top3 += top3;
      aggregate.shareMae += mae;
      aggregate.count += 1;
      perDimSums.set(dimension, aggregate);
    }
  }

  const perDimension: Record<string, HoldoutPerDimensionMetrics> = {};
  let sumTop1 = 0;
  let sumTop3 = 0;
  let sumShareMae = 0;
  for (const dimension of targetDimensions) {
    const aggregate = perDimSums.get(dimension);
    if (!aggregate || aggregate.count === 0) {
      perDimension[dimension] = { top1: 0, top3: 0, shareMae: 0 };
      continue;
    }
    const metrics: HoldoutPerDimensionMetrics = {
      top1: aggregate.top1 / aggregate.count,
      top3: aggregate.top3 / aggregate.count,
      shareMae: aggregate.shareMae / aggregate.count,
    };
    perDimension[dimension] = metrics;
    sumTop1 += metrics.top1;
    sumTop3 += metrics.top3;
    sumShareMae += metrics.shareMae;
  }

  return {
    sampleCount: products.length,
    avgTop1: sumTop1 / targetDimensions.length,
    avgTop3: sumTop3 / targetDimensions.length,
    shareMae: sumShareMae / targetDimensions.length,
    perDimension,
  };
}
