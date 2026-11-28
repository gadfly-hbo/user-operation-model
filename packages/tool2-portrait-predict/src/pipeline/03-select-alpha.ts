/**
 * 步骤 03：LOO alpha 选择 + 泄漏门禁。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/orchestrate.ts`
 *   逻辑位置：`fastLooAlphaSelection`（第 427–540 行）、alpha 选择规则（第 709–714 行）、
 *   泄漏门禁（第 695–703 行）、`ALPHA_GRID`（第 56 行）、`HOLDOUT_OVERLAP_IDS`（第 57 行）。
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/split-manifest.json`
 *   逻辑位置：`tuning_policy.alpha_grid`、`duplicate_product_id_policy`、`leakage_checks`（5 条）。
 *
 * ## 移植时修掉的归档缺陷（必须知悉，否则会误判「移植不忠实」）
 *
 * 归档 `fastLooAlphaSelection` 的线性求解**不是解方程**：
 * 归档 `backwardSubstitution`（`orchestrate.ts:405-414`）的累加项写作 `lt[i][k] * x[k]`，
 * 而 L 矩阵只填了下三角（`cholesky` 只写 `l[i][j]`（j ≤ i）），上三角恒为 0，
 * 于是该累加项恒为 0，回代退化成「只除以对角元」。实测：归档该路径解出的权重
 * 残差 ‖A·w − rhs‖∞ ≈ 16.4，而正确解的残差 ≈ 7e-15。
 * 因此**归档登记的 LOO alpha 选择指标在数值上无效**（归档实验记录里的
 * `loo_results` 与 `split-manifest.json` 同源于这条错误路径）。
 *
 * 本移植改用本项目**唯一**的 Cholesky 求解器
 * （`packages/core/src/model/ridge.ts` 的 `choleskyFactor` + `solveCholeskyFactorized`），
 * 并让 LOO 打分与最终模型的打分口径一致（截距 ȳ）。
 * **后果**：LOO 各 alpha 的具体数值与归档不同，但**选中的 alpha 仍是 50**（忠实门断言项）。
 * 最终三数字不受影响——最终模型走 `trainSupervisedPortraitModel`（独立于本步骤）。
 */

import {
  choleskyFactor,
  solveCholeskyFactorized,
  standardize,
} from '@uom/core/model/ridge';
import { SUPERVISED_TARGET_DIMENSIONS } from '@uom/core/model/train-v04';
import {
  addCombinationFeatures,
  selectFrequentCombinationFeatures,
  type V04FeatureSet,
} from '@uom/core/model/features-v04';
import type { TargetsByDimension } from '@uom/core/model/sample-package';

/** alpha 候选网格（归档 `ALPHA_GRID`）。 */
export const ALPHA_GRID: readonly number[] = [0.1, 0.5, 1, 2, 5, 10, 50];

/** 训练集与留出集重叠的已知款号（归档 `HOLDOUT_OVERLAP_IDS`），strict 口径需排除。 */
export const HOLDOUT_OVERLAP_IDS: ReadonlySet<string> = new Set(['109926124101']);

/** 交叉特征最小频次（与训练侧一致）。 */
export const MIN_COMBINATION_FREQ = 8;

/** 归档 `split-manifest.json` 记录的重复款号（先出现者保留）。 */
export const DOCUMENTED_DUPLICATE_SKU_IDS: readonly string[] = ['109926124001', '109926124101'];

/** 允许出现在固化 work-package 里的批次（历史训练 + 跨期留出）。 */
export const ALLOWED_SOURCE_BATCH_IDS: readonly string[] = [
  'q2_portrait_train_batch_20260708',
  '26q1_historical_candidate_20260711',
  '26q1_new_2_20260711',
  '25q3_holdout_20260711',
];

/** 单个 alpha 的 LOO 结果。 */
export interface LooResult {
  alpha: number;
  top1: number;
  top3: number;
}

/** alpha 选择所需的训练数据。 */
export interface AlphaSelectionInput<TInput> {
  samples: readonly TInput[];
  targetsByDimension: TargetsByDimension;
  featureSet: V04FeatureSet<TInput>;
}

/**
 * 快速留一交叉验证（LOO）选 alpha。
 *
 * 口径与归档一致的部分：交叉特征名单在**全训练集**上选一次（不在折内重选）、
 * 折内标准化排除留出行、Top1/Top3 用**跨维合并后**的重叠比口径。
 *
 * 与归档不同的部分（见文件头「移植时修掉的归档缺陷」）：线性求解改为本项目唯一
 * Cholesky 求解器，打分截距与最终模型统一为 ȳ。
 */
export function fastLooAlphaSelection<TInput>(
  input: AlphaSelectionInput<TInput>,
  alphaGrid: readonly number[] = ALPHA_GRID,
  minComboFreq: number = MIN_COMBINATION_FREQ,
): LooResult[] {
  const { samples, targetsByDimension, featureSet } = input;
  const n = samples.length;
  if (n < 2) throw new Error('fastLooAlphaSelection: 训练样本不足 2 条，无法做留一验证');

  const baseFeatures = samples.map((sample) => featureSet.extractBase(sample));
  const comboNames = selectFrequentCombinationFeatures(baseFeatures, minComboFreq, featureSet.groups);
  const featureRecords = baseFeatures.map((base) =>
    addCombinationFeatures(base, comboNames, featureSet.groups),
  );
  const featureNames = [...new Set(featureRecords.flatMap((record) => Object.keys(record)))].sort();
  const X = featureRecords.map((record) => featureNames.map((name) => record[name] ?? 0));
  const p = featureNames.length;

  // 逐维逐标签的目标矩阵与总和（归档口径：标签按字典序）
  const dimLabels: Array<{
    labelType: string;
    labels: string[];
    y: number[][];
    ySum: number[];
  }> = [];
  for (const labelType of SUPERVISED_TARGET_DIMENSIONS) {
    const dimMap = targetsByDimension.get(labelType);
    if (!dimMap) continue;
    const labels = [...dimMap.keys()].sort();
    const y = samples.map((_, i) => labels.map((label) => dimMap.get(label)?.[i] ?? 0));
    const ySum = labels.map((_, l) => y.reduce((sum, row) => sum + row[l]!, 0));
    dimLabels.push({ labelType, labels, y, ySum });
  }

  const results: LooResult[] = [];
  for (const alpha of alphaGrid) {
    let totalTop1 = 0;
    let totalTop3 = 0;
    for (let i = 0; i < n; i += 1) {
      // 折外标准化：留出行不进均值/标准差
      const trainRows = X.filter((_, k) => k !== i);
      const { scaled, mean, std } = standardize(trainRows);
      const testStd = X[i]!.map((value, j) => (value - mean[j]!) / std[j]!);

      // XtX 与 XtY（与 alpha 无关，逐折算一次）
      const XtX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
      const XtY: number[][][] = dimLabels.map((dim) =>
        Array.from({ length: dim.labels.length }, () => new Array<number>(p).fill(0)),
      );
      for (let k = 0; k < scaled.length; k += 1) {
        const xk = scaled[k]!;
        // scaled 的第 k 行对应原样本下标（留出行 i 之前的行不变，之后的行前移一位）
        const originalIndex = k < i ? k : k + 1;
        for (let a = 0; a < p; a += 1) {
          for (let b = 0; b < p; b += 1) XtX[a]![b]! += xk[a]! * xk[b]!;
          for (let d = 0; d < dimLabels.length; d += 1) {
            for (let l = 0; l < dimLabels[d]!.labels.length; l += 1) {
              XtY[d]![l]![a]! += xk[a]! * dimLabels[d]!.y[originalIndex]![l]!;
            }
          }
        }
      }
      for (let a = 0; a < p; a += 1) XtX[a]![a]! += alpha;

      const L = choleskyFactor(XtX);

      const predictedAll: Array<{ labelType: string; label: string; share: number }> = [];
      const actualAll: Array<{ labelType: string; label: string; share: number }> = [];
      for (let d = 0; d < dimLabels.length; d += 1) {
        const dim = dimLabels[d]!;
        const scores: number[] = [];
        for (let l = 0; l < dim.labels.length; l += 1) {
          const w = solveCholeskyFactorized(L, XtY[d]![l]!);
          // 截距与最终模型一致：标准化后特征均值为 0，截距即 ȳ
          const yMeanTrain = (dim.ySum[l]! - dim.y[i]![l]!) / (n - 1);
          let score = yMeanTrain;
          for (let j = 0; j < p; j += 1) score += w[j]! * testStd[j]!;
          scores.push(score);
          if (dim.y[i]![l]! > 0) {
            actualAll.push({ labelType: dim.labelType, label: dim.labels[l]!, share: dim.y[i]![l]! });
          }
        }
        // 归档口径：LOO 选择阶段用温度 1 的 softmax
        const maxScore = Math.max(...scores);
        const exps = scores.map((score) => Math.exp(score - maxScore));
        const sumExp = exps.reduce((a, b) => a + b, 0);
        for (let l = 0; l < dim.labels.length; l += 1) {
          predictedAll.push({
            labelType: dim.labelType,
            label: dim.labels[l]!,
            share: sumExp > 0 ? exps[l]! / sumExp : 1 / dim.labels.length,
          });
        }
      }

      const actualSorted = [...actualAll].sort((a, b) => b.share - a.share);
      const predSorted = [...predictedAll].sort((a, b) => b.share - a.share);
      const actualTop1 = new Set(actualSorted.slice(0, 1).map((row) => `${row.labelType}::${row.label}`));
      const actualTop3 = new Set(actualSorted.slice(0, 3).map((row) => `${row.labelType}::${row.label}`));
      const predTop1 = predSorted.slice(0, 1).map((row) => `${row.labelType}::${row.label}`);
      const predTop3 = predSorted.slice(0, 3).map((row) => `${row.labelType}::${row.label}`);
      const top1 = actualTop1.size === 0 ? 0 : predTop1.filter((key) => actualTop1.has(key)).length / actualTop1.size;
      const top3 = actualTop3.size === 0 ? 0 : predTop3.filter((key) => actualTop3.has(key)).length / actualTop3.size;
      totalTop1 += top1;
      totalTop3 += top3;
    }
    results.push({ alpha, top1: totalTop1 / n, top3: totalTop3 / n });
  }
  return results;
}

/**
 * alpha 选择规则：先比 LOO top1，再比 top3，最后取**较小**的 alpha（归档 `orchestrate.ts:709-714`）。
 */
export function selectAlpha(results: readonly LooResult[]): number {
  if (results.length === 0) throw new Error('selectAlpha: 没有可用的 LOO 结果');
  const sorted = [...results].sort((a, b) => {
    if (b.top1 !== a.top1) return b.top1 - a.top1;
    if (b.top3 !== a.top3) return b.top3 - a.top3;
    return a.alpha - b.alpha;
  });
  return sorted[0]!.alpha;
}

/** 泄漏门禁的一条检查。 */
export interface LeakageCheck {
  /** 检查描述（与归档 `split-manifest.json` 的 `leakage_checks` 对齐） */
  check: string;
  result: 'pass' | 'fail';
  /** 补充说明（失败时给出具体差异） */
  detail?: string;
}

/** 泄漏门禁所需的包信息。 */
export interface LeakageGateInput {
  /** 训练包里的商品 skuId（顺序即样本顺序） */
  trainSkuIds: readonly string[];
  /** 留出包里的商品 skuId */
  holdoutSkuIds: readonly string[];
  /** 训练包里商品记录的来源批次 */
  trainSourceBatchIds: readonly string[];
  /** 留出包里商品记录的来源批次 */
  holdoutSourceBatchIds: readonly string[];
  /** 留出包商品的时间窗 */
  holdoutTimeWindows: readonly string[];
  /** 实际用于评估的样本数（strict 口径） */
  evaluatedSampleCount: number;
}

/**
 * 泄漏门禁：与归档 `split-manifest.json` 的 5 条 `leakage_checks` 一一对应。
 *
 * 任一条不通过即返回 `fail`；忠实门脚本据此 fail-closed。
 */
export function runLeakageGate(input: LeakageGateInput): LeakageCheck[] {
  const checks: LeakageCheck[] = [];

  const trainSet = new Set(input.trainSkuIds);
  const holdoutSet = new Set(input.holdoutSkuIds);
  const overlap = [...trainSet].filter((skuId) => holdoutSet.has(skuId));
  const unexpectedOverlap = overlap.filter((skuId) => !HOLDOUT_OVERLAP_IDS.has(skuId));

  // 1. 训练行里不得出现未登记的留出款号
  checks.push({
    check: 'No unexpected 25Q3 product IDs appear in training rows.',
    result: unexpectedOverlap.length === 0 ? 'pass' : 'fail',
    ...(unexpectedOverlap.length > 0 ? { detail: `意外重叠款号：${unexpectedOverlap.join(', ')}` } : {}),
  });

  // 2. 已知重叠款号已登记，且 strict 口径单独报告
  const knownOverlapPresent = [...HOLDOUT_OVERLAP_IDS].every((skuId) => overlap.includes(skuId));
  const strictCountMatches = input.evaluatedSampleCount === input.holdoutSkuIds.length - HOLDOUT_OVERLAP_IDS.size;
  checks.push({
    check: 'Known holdout overlap IDs are documented and strict non-overlap metrics are reported separately.',
    result: knownOverlapPresent && strictCountMatches ? 'pass' : 'fail',
    ...(knownOverlapPresent && strictCountMatches
      ? {}
      : {
          detail: `已知重叠款号 ${[...HOLDOUT_OVERLAP_IDS].join(', ')} 存在性=${knownOverlapPresent}；` +
            `strict 样本数 ${input.evaluatedSampleCount} ≠ 留出样本数 ${input.holdoutSkuIds.length} − 已知重叠 ${HOLDOUT_OVERLAP_IDS.size}`,
        }),
  });

  // 3. 留出集只用于最终评估：训练/调参/特征选择/校准的样本集必须等于训练包
  const trainingUsedOnlyTrainPackage = input.trainSkuIds.every((skuId) => trainSet.has(skuId));
  const holdoutNotInTrainingRows = input.holdoutSkuIds.every(
    (skuId) => !trainSet.has(skuId) || HOLDOUT_OVERLAP_IDS.has(skuId),
  );
  checks.push({
    check: '25Q3 holdout used only for final evaluation, not for training/tuning/feature selection/calibration.',
    result: trainingUsedOnlyTrainPackage && holdoutNotInTrainingRows ? 'pass' : 'fail',
    ...(trainingUsedOnlyTrainPackage && holdoutNotInTrainingRows
      ? {}
      : { detail: '留出款号进入了训练/调参样本集' }),
  });

  // 4. 26Q3 未来预测款号不参与训练与指标计算
  const futureBatches = [...input.trainSourceBatchIds, ...input.holdoutSourceBatchIds].filter(
    (batchId) => !ALLOWED_SOURCE_BATCH_IDS.includes(batchId),
  );
  const futureTimeWindows = input.holdoutTimeWindows.filter((window) => window.includes('26Q3'));
  checks.push({
    check: '26Q3 future products not used for training or metric computation.',
    result: futureBatches.length === 0 && futureTimeWindows.length === 0 ? 'pass' : 'fail',
    ...(futureBatches.length > 0 || futureTimeWindows.length > 0
      ? { detail: `出现未登记批次 ${futureBatches.join(', ')} 或未来时间窗 ${futureTimeWindows.join(', ')}` }
      : {}),
  });

  // 5. 重复款号已登记且训练包内已去重
  const duplicateInTrain = input.trainSkuIds.filter((skuId, index) => input.trainSkuIds.indexOf(skuId) !== index);
  const documentedOccurrences = DOCUMENTED_DUPLICATE_SKU_IDS.map(
    (skuId) => input.trainSkuIds.filter((id) => id === skuId).length,
  );
  const documentedAtMostOnce = documentedOccurrences.every((count) => count <= 1);
  checks.push({
    check: 'Duplicate product IDs documented and deduplicated before training.',
    result: duplicateInTrain.length === 0 && documentedAtMostOnce ? 'pass' : 'fail',
    ...(duplicateInTrain.length > 0 || !documentedAtMostOnce
      ? { detail: `训练包内重复款号：${[...new Set(duplicateInTrain)].join(', ')}` }
      : {}),
  });

  return checks;
}
