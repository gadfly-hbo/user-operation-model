/**
 * v0.6 训练核心：逐维度逐标签 one-vs-rest Ridge 份额回归 + 折内 alpha 选择 + 账号均值基线。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/train.mts`
 *   逻辑位置：`ALPHAS`（第 17 行）、`trainDimension`（第 27–87 行）、
 *   `predictDimension`（第 89–100 行）、`accountMeanBaseline`（第 103–108 行）、
 *   `normalizeDist`（归档 `lib/core.mts:282-290`）。
 *
 * ## 移植时修掉的问题
 *
 * 1. **第二份 Ridge 实现**：归档 `lib/core.mts` 自带高斯消元求解器，
 *    本移植一律走 `packages/core/src/model/ridge.ts` 的**唯一** Cholesky 求解器
 *    （`fitRidge` / `predictRidge`），不自带第二份。
 * 2. **mean/std 双算**：归档 `solveRidge` 内部算一遍、`fitRidgeStandardized` 又算一遍；
 *    本移植用 `fitRidge` 一次算完并把 mean/std 存进模型。
 * 3. **矩阵重复构建**：归档在标签循环里反复 `buildMatrix(innerTrain, innerTrain, ...)`，
 *    同一份矩阵被重建 N 次；本移植把矩阵提到循环外（结果不变，计算量显著下降）。
 *
 * ## 口径
 *
 * - alpha 候选 `[5, 10, 25, 50, 100]`，按**训练集内** 3 折（按下标轮转）的平均 JS 相似度选优。
 * - 预测：逐标签线性得分 → **负值截断为 0** → 按维度归一化（v0.6 口径；
 *   **不与 v0.4 的 softmax+温度合并**，见 P2 规格 §2.3）。
 * - 账号均值基线：**只用传入的训练样本**计算（折内基线，不泄漏评估折）。
 */

import { fitRidge, predictRidge } from '@uom/core/model/ridge';
import { jsSimilarity } from '@uom/core/model/metrics';

import { buildV06Matrix, encodeV06Samples } from './features-v06.js';
import type { V06Distribution, V06Sample, V06TargetDimension } from './types.js';

/** alpha 候选网格（归档 `lib/train.mts:17`）。 */
export const V06_ALPHAS: readonly number[] = [5, 10, 25, 50, 100];

/** 折内词表最小出现次数（归档 `buildMatrix` 默认 `minCount = 3`）。 */
export const V06_MIN_COUNT = 3;

/** alpha 选择的内层折数（归档 `lib/train.mts:38-41`）。 */
export const V06_INNER_FOLDS = 3;

/** 单个标签的回归模型（与 core 的 `RidgeModel` 同形，便于直接序列化）。 */
export interface V06LabelModel {
  weights: number[];
  intercept: number;
  mean: number[];
  std: number[];
  alpha: number;
}

/** 一个维度的训练结果。 */
export interface V06DimensionFit {
  labels: string[];
  perLabel: V06LabelModel[];
  alpha: number;
  featureNames: string[];
}

/** 负值截断后按维度归一化；全为 0 时退化为均匀分布。 */
export function normalizeV06Distribution(
  labels: readonly string[],
  raw: readonly number[],
): V06Distribution {
  const clipped = raw.map((value) => Math.max(0, value));
  const total = clipped.reduce((sum, value) => sum + value, 0);
  const out: V06Distribution = {};
  labels.forEach((label, index) => {
    out[label] = total > 0 ? (clipped[index] ?? 0) / total : 1 / labels.length;
  });
  return out;
}

/** 训练集内层折的划分（按下标轮转，与归档 `lib/train.mts:38-41` 同口径）。 */
function buildInnerFolds(sampleCount: number): number[][] {
  const folds: number[][] = Array.from({ length: V06_INNER_FOLDS }, () => []);
  for (let index = 0; index < sampleCount; index += 1) {
    folds[index % V06_INNER_FOLDS]!.push(index);
  }
  return folds;
}

/** 训练一个维度模型（alpha 在训练集内 3 折选择）。 */
export function trainV06Dimension(
  dimension: V06TargetDimension,
  trainSamples: readonly V06Sample[],
  groups: ReadonlySet<string>,
  options?: { alphas?: readonly number[]; minCount?: number },
): V06DimensionFit {
  const alphas = options?.alphas ?? V06_ALPHAS;
  const minCount = options?.minCount ?? V06_MIN_COUNT;
  if (trainSamples.length === 0) {
    throw new Error(`trainV06Dimension: 维度 ${dimension} 的训练样本为空`);
  }

  const { matrix, featureNames } = buildV06Matrix(trainSamples, trainSamples, groups, minCount);
  const labels = [
    ...new Set(trainSamples.flatMap((sample) => Object.keys(sample.portraits[dimension] ?? {}))),
  ].sort();

  // 内层 3 折：按下标轮转（样本顺序由「按款号排序」契约钉住，见 01 阶段）
  const innerFolds = buildInnerFolds(trainSamples.length);

  const scoreAlpha = (alpha: number): number => {
    const scores: number[] = [];
    for (let fold = 0; fold < innerFolds.length; fold += 1) {
      const testIndexes = innerFolds[fold]!;
      const trainIndexes = trainSamples
        .map((_, index) => index)
        .filter((index) => !testIndexes.includes(index));
      const innerTrain = trainIndexes.map((index) => trainSamples[index]!);
      if (innerTrain.length === 0 || testIndexes.length === 0) continue;

      const innerLabels = [
        ...new Set(innerTrain.flatMap((sample) => Object.keys(sample.portraits[dimension] ?? {}))),
      ].sort();

      // 矩阵只构建一次（归档在标签循环里重复构建同一份矩阵）
      const { matrix: innerMatrix } = buildV06Matrix(innerTrain, innerTrain, groups, minCount);
      const fits = innerLabels.map((label) =>
        fitRidge(
          innerMatrix,
          innerTrain.map((sample) => sample.portraits[dimension]?.[label] ?? 0),
          alpha,
        ),
      );
      const evalSamples = testIndexes.map((index) => trainSamples[index]!);
      const { matrix: evalMatrix } = buildV06Matrix(innerTrain, evalSamples, groups, minCount);

      for (let position = 0; position < testIndexes.length; position += 1) {
        const sample = evalSamples[position]!;
        const row = evalMatrix[position]!;
        const raw = fits.map((fit) => predictRidge(fit, row));
        const predicted = normalizeV06Distribution(innerLabels, raw);
        scores.push(jsSimilarity(predicted, sample.portraits[dimension] ?? {}));
      }
    }
    return scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : -1;
  };

  let bestAlpha = alphas[0]!;
  let bestScore = -Infinity;
  for (const alpha of alphas) {
    const score = scoreAlpha(alpha);
    if (score > bestScore + 1e-12) {
      bestScore = score;
      bestAlpha = alpha;
    }
  }

  const perLabel = labels.map((label) =>
    fitRidge(
      matrix,
      trainSamples.map((sample) => sample.portraits[dimension]?.[label] ?? 0),
      bestAlpha,
    ),
  );
  return { labels, perLabel, alpha: bestAlpha, featureNames };
}

/** 用训练好的维度模型预测评估样本。 */
export function predictV06Dimension(
  fit: V06DimensionFit,
  groups: ReadonlySet<string>,
  evalSamples: readonly V06Sample[],
): V06Distribution[] {
  // 用**拟合时的词表**编码（不重新按 minCount 建表），保证权重维度对齐
  const matrix = encodeV06Samples(evalSamples, groups, fit.featureNames);
  return evalSamples.map((_, index) => {
    const row = matrix[index]!;
    const raw = fit.perLabel.map((model) => predictRidge(model, row));
    return normalizeV06Distribution(fit.labels, raw);
  });
}

/**
 * 账号均值基线：**只用传入的训练样本**。
 *
 * 归档 `meanAccumulateDists`（`lib/core.mts:292-300`）口径：逐标签累加后除以样本数。
 */
export function v06AccountMeanBaseline(
  dimension: V06TargetDimension,
  trainSamples: readonly V06Sample[],
): V06Distribution {
  const accumulator: V06Distribution = {};
  for (const sample of trainSamples) {
    for (const [label, value] of Object.entries(sample.portraits[dimension] ?? {})) {
      accumulator[label] = (accumulator[label] ?? 0) + value;
    }
  }
  const count = trainSamples.length || 1;
  for (const label of Object.keys(accumulator)) {
    accumulator[label] = (accumulator[label] ?? 0) / count;
  }
  return accumulator;
}
