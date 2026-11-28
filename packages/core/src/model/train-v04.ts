/**
 * v0.4 训练与预测 —— 逐维逐标签 one-vs-rest 份额回归 + 温度校准 + 分布预测。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/src/capabilities/product-channel-fit/single-product-portrait-supervised.ts`
 *   逻辑位置：`SUPERVISED_TARGET_DIMENSIONS`（第 43–50 行）、`DimensionModel`（第 62–73 行）、
 *   `trainSupervisedPortraitModel`（第 657–719 行）、`computeDimensionScores`（第 725–738 行）、
 *   `softmaxWithTemperature`（第 740–750 行）、`predictDimension`（第 752–772 行）、
 *   `predictSupervisedPortrait`（第 794–849 行）、`mseShares`（第 1018–1025 行）、
 *   `calibrateSupervisedTemperatures`（第 1027–1100 行）、`applySupervisedTemperatures`（第 1102–1113 行）、
 *   `round2` / `round3`（第 1271–1277 行）。
 *
 * 移植纪律：
 * - **求解器唯一**：Ridge 走 `packages/core/src/model/ridge.ts` 的 Cholesky 实现
 *   （`fitRidge`），本文件**不自带第二份求解器**（工程规范 §9.1 同类要求）。
 * - 标准化参数（mean/std）只由 `fitRidge` 算一次并随模型持久化，预测侧复用同一份。
 * - 温度校准沿用归档的 LOO 网格搜索（温度候选表外置为常量）。
 */

import { fitRidge } from './ridge.js';
import {
  addCombinationFeatures,
  selectFrequentCombinationFeatures,
  type V04FeatureSet,
} from './features-v04.js';
import type { TargetsByDimension } from './sample-package.js';

/** 六个目标维度（顺序即归档 `SUPERVISED_TARGET_DIMENSIONS`）。 */
export const SUPERVISED_TARGET_DIMENSIONS: readonly string[] = [
  '预测性别',
  '预测年龄段',
  '预测消费能力',
  '城市等级',
  '八大消费群体',
  '预测人生阶段',
];

/** 温度校准候选表（归档 `calibrateSupervisedTemperatures` 的默认网格）。 */
export const CALIBRATION_TEMPERATURE_GRID: readonly number[] = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 5.0];

/** 交叉特征最小频次（归档 `trainSupervisedPortraitModel` 默认 `minCombinationFreq = 8`）。 */
export const DEFAULT_MIN_COMBINATION_FREQ = 8;

/** 模型版本标识（溯源用）。 */
export const V04_MODEL_VERSION = 'uom-portrait-ridge-v04';

/** 单维模型。 */
export interface V04DimensionModel {
  labelType: string;
  isClosed: boolean;
  labels: string[];
  featureNames: string[];
  /** weights[labelIndex][featureIndex] */
  weights: number[][];
  intercepts: number[];
  featureMean: number[];
  featureStd: number[];
  alpha: number;
  /** 温度（closed 维后处理） */
  temperature?: number;
}

/** 六维画像模型。 */
export interface V04PortraitModel {
  version: string;
  featureSetId: string;
  sampleCount: number;
  /** 正则强度 α */
  alpha: number;
  targetDimensions: readonly string[];
  dimensionModels: V04DimensionModel[];
  combinationFeatureNames: string[];
}

/** 预测输出行。 */
export interface V04PredictedRow {
  labelType: string;
  label: string;
  share: number;
}

/** 四舍五入到两位小数（归档 `round2`）。 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 训练六维模型。
 *
 * @param samples 训练样本（顺序即份额数组索引顺序）
 * @param targetsByDimension 逐维目标份额
 * @param featureSet 特征集（决定抽取口径与交叉特征分组）
 */
export function trainSupervisedPortraitModel<TInput>(options: {
  samples: readonly TInput[];
  targetsByDimension: TargetsByDimension;
  featureSet: V04FeatureSet<TInput>;
  alpha?: number;
  enableCombinationFeatures?: boolean;
  minCombinationFreq?: number;
}): V04PortraitModel {
  const {
    samples,
    targetsByDimension,
    featureSet,
    alpha = 1.0,
    enableCombinationFeatures = true,
    minCombinationFreq = DEFAULT_MIN_COMBINATION_FREQ,
  } = options;

  // 基础特征 → 交叉特征名单 → 特征矩阵（列名按字典序，与归档一致）
  const baseFeatureRecords = samples.map((sample) => featureSet.extractBase(sample));
  const combinationFeatureNames = enableCombinationFeatures
    ? selectFrequentCombinationFeatures(baseFeatureRecords, minCombinationFreq, featureSet.groups)
    : [];
  const featureRecords = baseFeatureRecords.map((base) =>
    addCombinationFeatures(base, combinationFeatureNames, featureSet.groups),
  );
  const featureNames = [...new Set(featureRecords.flatMap((record) => Object.keys(record)))].sort();
  const X = featureRecords.map((record) => featureNames.map((name) => record[name] ?? 0));

  const dimensionModels: V04DimensionModel[] = [];
  for (const labelType of SUPERVISED_TARGET_DIMENSIONS) {
    const dimMap = targetsByDimension.get(labelType);
    if (!dimMap) continue;
    const labels = [...dimMap.keys()].sort();
    const isClosed = SUPERVISED_TARGET_DIMENSIONS.includes(labelType);
    const weights: number[][] = [];
    const intercepts: number[] = [];
    let featureMean: number[] = [];
    let featureStd: number[] = [];
    for (const label of labels) {
      const y = dimMap.get(label) ?? [];
      // 单一求解器：Ridge 走 packages/core/src/model/ridge.ts（Cholesky）
      const fitted = fitRidge(X, y, alpha);
      weights.push(fitted.weights);
      intercepts.push(fitted.intercept);
      featureMean = fitted.mean;
      featureStd = fitted.std;
    }
    dimensionModels.push({
      labelType,
      isClosed,
      labels,
      featureNames,
      weights,
      intercepts,
      featureMean,
      featureStd,
      alpha,
    });
  }

  return {
    version: V04_MODEL_VERSION,
    featureSetId: featureSet.id,
    sampleCount: samples.length,
    alpha,
    targetDimensions: SUPERVISED_TARGET_DIMENSIONS,
    dimensionModels,
    combinationFeatureNames,
  };
}

/** 计算某维的回归得分（标准化空间线性打分）。 */
export function computeDimensionScores(model: V04DimensionModel, features: Record<string, number>): number[] {
  const featureVector = model.featureNames.map((name) => features[name] ?? 0);
  const standardized = featureVector.map(
    (value, j) => (value - model.featureMean[j]!) / model.featureStd[j]!,
  );
  const scores: number[] = [];
  for (let i = 0; i < model.labels.length; i += 1) {
    let score = model.intercepts[i]!;
    for (let j = 0; j < standardized.length; j += 1) {
      score += model.weights[i]![j]! * standardized[j]!;
    }
    scores.push(score);
  }
  return scores;
}

/** 带温度的 softmax（归档 `softmaxWithTemperature`）。 */
export function softmaxWithTemperature(scores: readonly number[], temperature: number): number[] {
  if (temperature <= 0 || !Number.isFinite(temperature)) {
    const clipped = scores.map((score) => Math.max(0, score));
    const total = clipped.reduce((a, b) => a + b, 0);
    return total > 0 ? clipped.map((score) => score / total) : clipped.map(() => 1 / clipped.length);
  }
  const maxScore = Math.max(...scores);
  const expScores = scores.map((score) => Math.exp((score - maxScore) / temperature));
  const total = expScores.reduce((a, b) => a + b, 0);
  return total > 0 ? expScores.map((score) => score / total) : scores.map(() => 1 / scores.length);
}

/** 单维预测：得分 → 分布 → 两位小数。 */
export function predictDimension(model: V04DimensionModel, features: Record<string, number>): V04PredictedRow[] {
  const scores = computeDimensionScores(model, features);
  const shares = model.isClosed
    ? softmaxWithTemperature(scores, model.temperature ?? 1.0)
    : scores.map((score) => Math.min(1, Math.max(0, score)));
  return model.labels.map((label, i) => ({
    labelType: model.labelType,
    label,
    share: round2(shares[i]!),
  }));
}

/**
 * 全维预测：得分 → 分布 → Top-N 截断 → closed 维再归一 → 两位小数。
 */
export function predictPortrait<TInput>(options: {
  model: V04PortraitModel;
  input: TInput;
  featureSet: V04FeatureSet<TInput>;
  outputTopNPerDimension?: number;
}): V04PredictedRow[] {
  const { model, input, featureSet, outputTopNPerDimension = 10 } = options;
  const baseFeatures = featureSet.extractBase(input);
  const features =
    model.combinationFeatureNames.length === 0
      ? baseFeatures
      : addCombinationFeatures(baseFeatures, model.combinationFeatureNames, featureSet.groups);

  const rows: V04PredictedRow[] = [];
  for (const dimModel of model.dimensionModels) {
    const dimRows = predictDimension(dimModel, features);
    const sorted = dimRows.sort((a, b) => b.share - a.share).slice(0, outputTopNPerDimension);
    // closed 维在 Top-N 截断后再归一，让剩余份额之和回到 1
    if (dimModel.isClosed) {
      const total = sorted.reduce((sum, row) => sum + row.share, 0);
      if (total > 0) {
        for (const row of sorted) row.share = round2(row.share / total);
      }
    }
    rows.push(...sorted);
  }
  return rows;
}

/** 份额向量之间的均方误差（归档 `mseShares`）。 */
function mseShares(predicted: readonly number[], actual: readonly number[]): number {
  const len = Math.max(predicted.length, actual.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += ((predicted[i] ?? 0) - (actual[i] ?? 0)) ** 2;
  }
  return sum / len;
}

/** 温度校准：LOO 折上按 MSE 选温度。 */
export function calibrateTemperatures<TInput>(options: {
  samples: readonly TInput[];
  targetsByDimension: TargetsByDimension;
  featureSet: V04FeatureSet<TInput>;
  alpha: number;
  temperatures?: readonly number[];
}): { temperatures: Record<string, number>; perDimensionMse: Record<string, number> } {
  const {
    samples,
    targetsByDimension,
    featureSet,
    alpha,
    temperatures = CALIBRATION_TEMPERATURE_GRID,
  } = options;

  const observations = new Map<string, { scores: number[][]; actualShares: number[][] }>();
  for (const labelType of SUPERVISED_TARGET_DIMENSIONS) {
    observations.set(labelType, { scores: [], actualShares: [] });
  }

  for (let i = 0; i < samples.length; i += 1) {
    const heldOut = samples[i]!;
    const trainSamples = [...samples.slice(0, i), ...samples.slice(i + 1)];
    // 折外份额：按样本下标剔除（依赖目标份额索引对齐，已由 assertTargetAlignment 校验）
    const trainTargets: TargetsByDimension = new Map();
    for (const [labelType, dimMap] of targetsByDimension) {
      const foldMap = new Map<string, number[]>();
      for (const [label, values] of dimMap) {
        foldMap.set(label, values.filter((_, index) => index !== i));
      }
      trainTargets.set(labelType, foldMap);
    }

    const foldModel = trainSupervisedPortraitModel({
      samples: trainSamples,
      targetsByDimension: trainTargets,
      featureSet,
      alpha,
    });
    const baseFeatures = featureSet.extractBase(heldOut);
    const features =
      foldModel.combinationFeatureNames.length === 0
        ? baseFeatures
        : addCombinationFeatures(baseFeatures, foldModel.combinationFeatureNames, featureSet.groups);

    for (const dimModel of foldModel.dimensionModels) {
      if (!dimModel.isClosed) continue;
      const observation = observations.get(dimModel.labelType);
      if (!observation) continue;
      const scores = computeDimensionScores(dimModel, features);
      const actualShares = dimModel.labels.map(
        (label) => targetsByDimension.get(dimModel.labelType)?.get(label)?.[i] ?? 0,
      );
      observation.scores.push(scores);
      observation.actualShares.push(actualShares);
    }
  }

  const result: { temperatures: Record<string, number>; perDimensionMse: Record<string, number> } = {
    temperatures: {},
    perDimensionMse: {},
  };
  for (const labelType of SUPERVISED_TARGET_DIMENSIONS) {
    const observation = observations.get(labelType);
    if (!observation || observation.scores.length === 0) continue;
    let bestTemperature = 1.0;
    let bestMse = Infinity;
    for (const temperature of temperatures) {
      let mseSum = 0;
      for (let k = 0; k < observation.scores.length; k += 1) {
        const predictedShares = softmaxWithTemperature(observation.scores[k]!, temperature);
        mseSum += mseShares(predictedShares, observation.actualShares[k]!);
      }
      const mse = mseSum / observation.scores.length;
      if (mse < bestMse) {
        bestMse = mse;
        bestTemperature = temperature;
      }
    }
    result.temperatures[labelType] = bestTemperature;
    result.perDimensionMse[labelType] = bestMse;
  }
  return result;
}

/** 把校准温度写回模型。 */
export function applyTemperatures(
  model: V04PortraitModel,
  temperatures: Readonly<Record<string, number>>,
): V04PortraitModel {
  return {
    ...model,
    dimensionModels: model.dimensionModels.map((dim) => ({
      ...dim,
      temperature: temperatures[dim.labelType] ?? dim.temperature,
    })),
  };
}
