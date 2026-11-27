/**
 * v0.4 跨期协议编排：读固化数据 → 特征 → alpha 选择 → 温度校准 → 最终训练 → strict-23 评估。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/orchestrate.ts`
 *   逻辑位置：主流程（第 547–776 行）——alpha 选择（第 705–714 行）、温度校准（第 727–737 行）、
 *   最终训练（第 730–740 行）、strict-23 评估（第 763–775 行）。
 *
 * 数据来源：**固化区**（`<主仓>/data/archive-modelevol/v04-holdout/work-package/{train,holdout}`，
 * 主仓 gitignore 区，不入 git）。本模块只读本地文件，不出网、不写业务数据。
 */

import { join } from 'node:path';

import {
  buildTargetsByDimension,
  assertTargetAlignment,
  loadSamplePackage,
  type SamplePackage,
  type SamplePackageProduct,
  type TargetsByDimension,
} from '@uom/core/model/sample-package';
import {
  SUPERVISED_TARGET_DIMENSIONS,
  applyTemperatures,
  calibrateTemperatures,
  trainSupervisedPortraitModel,
  type V04PortraitModel,
} from '@uom/core/model/train-v04';
import { evaluateHoldout, type HoldoutMetrics } from '@uom/core/model/holdout-eval';
import {
  V04_ORIGINAL_FEATURE_SET,
  type V04FeatureSet,
  type V04OriginalProductInput,
} from '@uom/core/model/features-v04';
import {
  V04_COMPLIANT_FEATURE_SET,
  projectCompliantInput,
  type V04CompliantProductInput,
} from '@uom/core/model/features-v04-compliant';

import {
  ALPHA_GRID,
  HOLDOUT_OVERLAP_IDS,
  fastLooAlphaSelection,
  runLeakageGate,
  selectAlpha,
  type LeakageCheck,
  type LooResult,
} from './03-select-alpha.js';

/** 固化根下的 work-package 相对路径。 */
export const V04_WORK_PACKAGE_RELATIVE = join('work-package');

/** 一套特征集 + 其输入投影（供泛型管线使用）。 */
export interface V04FeatureSetChoice<TInput> {
  id: string;
  featureSet: V04FeatureSet<TInput>;
  toInput: (product: SamplePackageProduct) => TInput;
}

/** 固化数据里的训练包与留出包。 */
export interface V04Packages {
  /** 固化根 */
  root: string;
  train: SamplePackage;
  holdout: SamplePackage;
}

/** 原特征集（含 FAB 卖点）——**仅忠实门对照用**，不得进入生产预测路径。 */
export function originalFeatureSetChoice(): V04FeatureSetChoice<V04OriginalProductInput> {
  return {
    id: 'v04-original',
    featureSet: V04_ORIGINAL_FEATURE_SET,
    toInput: (product) => ({
      skuId: product.skuId,
      sourceProductKey: product.sourceProductKey,
      fitType: product.fitType || 'X型',
      fabric: product.fabric ?? '',
      fab: product.fab ?? '',
    }),
  };
}

/** 合规特征集（§9.2 白名单）——生产预测路径唯一允许的抽取器。 */
export function compliantFeatureSetChoice(): V04FeatureSetChoice<V04CompliantProductInput> {
  return {
    id: 'v04-compliant',
    featureSet: V04_COMPLIANT_FEATURE_SET,
    toInput: (product) => projectCompliantInput(product),
  };
}

/**
 * 读取固化 work-package（训练包 + 留出包）。
 *
 * 缺目录 / 缺文件时**明确失败**，不静默跳过（忠实门依赖 fail-closed）。
 */
export function loadV04Packages(root: string): V04Packages {
  const workPackage = join(root, V04_WORK_PACKAGE_RELATIVE);
  const train = loadSamplePackage(join(workPackage, 'train'));
  const holdout = loadSamplePackage(join(workPackage, 'holdout'));
  if (train.products.length === 0) throw new Error(`固化训练包没有商品记录：${workPackage}/train`);
  if (holdout.products.length === 0) throw new Error(`固化留出包没有商品记录：${workPackage}/holdout`);
  return { root, train, holdout };
}

/** 一次完整 v0.4 跨期协议跑批的结果。 */
export interface V04FidelityResult {
  /** 特征集标识 */
  featureSetId: string;
  /** 训练样本数 */
  trainRowCount: number;
  /** 选中的 alpha */
  selectedAlpha: number;
  /** 各 alpha 的 LOO 结果 */
  looResults: LooResult[];
  /** 温度校准结果（逐维） */
  temperatures: Record<string, number>;
  /** 温度校准的逐维 MSE */
  perDimensionMse: Record<string, number>;
  /** strict-23（排除已知重叠款号）指标 */
  strict23: HoldoutMetrics;
  /** all-24（不排除）指标 */
  all24: HoldoutMetrics;
  /** 泄漏门禁结果 */
  leakageChecks: LeakageCheck[];
  /** 最终特征数 */
  featureCount: number;
  /** 最终交叉特征数 */
  combinationFeatureCount: number;
  /** 最终模型（内存态，供导出器与黄金用例使用） */
  model: V04PortraitModel;
}

/**
 * 跑一遍 v0.4 跨期协议。
 *
 * 步骤（与归档 `orchestrate.ts` 主流程一致）：
 * 1. 由固化训练包构造样本与逐维目标份额（索引不对齐则 fail-closed）；
 * 2. fast LOO 选 alpha（规则：top1 → top3 → 较小 alpha）；
 * 3. 在训练集上做温度校准（LOO 折，候选温度表固定）；
 * 4. 用选中 alpha 在**全部训练样本**上训练最终模型，并写入校准温度；
 * 5. 在留出包上评估：strict-23（排除已知重叠款号）与 all-24；
 * 6. 跑泄漏门禁（5 条）。
 */
export function runV04Fidelity<TInput>(options: {
  packages: V04Packages;
  choice: V04FeatureSetChoice<TInput>;
  alphaGrid?: readonly number[];
}): V04FidelityResult {
  const { packages, choice } = options;
  const alphaGrid = options.alphaGrid ?? ALPHA_GRID;

  // 1. 训练样本与目标份额
  const samples = packages.train.products.map((product) => choice.toInput(product));
  const targetsByDimension: TargetsByDimension = buildTargetsByDimension(
    packages.train.products,
    packages.train.portraitRows,
    SUPERVISED_TARGET_DIMENSIONS,
  );
  assertTargetAlignment(targetsByDimension, samples.length);

  // 2. alpha 选择
  const looResults = fastLooAlphaSelection(
    { samples, targetsByDimension, featureSet: choice.featureSet },
    alphaGrid,
  );
  const selectedAlpha = selectAlpha(looResults);

  // 3. 温度校准
  const calibration = calibrateTemperatures({
    samples,
    targetsByDimension,
    featureSet: choice.featureSet,
    alpha: selectedAlpha,
  });

  // 4. 最终训练
  const baseModel = trainSupervisedPortraitModel({
    samples,
    targetsByDimension,
    featureSet: choice.featureSet,
    alpha: selectedAlpha,
  });
  const model = applyTemperatures(baseModel, calibration.temperatures);

  // 5. 留出评估
  const strict23 = evaluateHoldout({
    model,
    holdout: packages.holdout,
    featureSet: choice.featureSet,
    toInput: choice.toInput,
    targetDimensions: SUPERVISED_TARGET_DIMENSIONS,
    excludeSkuIds: HOLDOUT_OVERLAP_IDS,
  });
  const all24 = evaluateHoldout({
    model,
    holdout: packages.holdout,
    featureSet: choice.featureSet,
    toInput: choice.toInput,
    targetDimensions: SUPERVISED_TARGET_DIMENSIONS,
  });

  // 6. 泄漏门禁
  const leakageChecks = runLeakageGate({
    trainSkuIds: packages.train.products.map((product) => product.skuId),
    holdoutSkuIds: packages.holdout.products.map((product) => product.skuId),
    trainSourceBatchIds: packages.train.products.map(
      (product) => (product.sourceBatchId as string | undefined) ?? '',
    ),
    holdoutSourceBatchIds: packages.holdout.products.map(
      (product) => (product.sourceBatchId as string | undefined) ?? '',
    ),
    holdoutTimeWindows: packages.holdout.products.map(
      (product) => (product.timeWindow as string | undefined) ?? '',
    ),
    evaluatedSampleCount: strict23.sampleCount,
  });

  return {
    featureSetId: choice.id,
    trainRowCount: samples.length,
    selectedAlpha,
    looResults,
    temperatures: calibration.temperatures,
    perDimensionMse: calibration.perDimensionMse,
    strict23,
    all24,
    leakageChecks,
    featureCount: model.dimensionModels[0]?.featureNames.length ?? 0,
    combinationFeatureCount: model.combinationFeatureNames.length,
    model,
  };
}
