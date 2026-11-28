/**
 * 阶段 03：特征组消融阶梯 + 5 折 OOF，与**折内**账号均值基线逐款配对。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/03-run-ablation.mts`
 *   逻辑位置：`LADDER`（第 35–53 行）、`runConfig`（第 71–192 行）、
 *   逐维聚合（第 133–156 行）、宏平均与业务加权（第 158–176 行）、
 *   折稳定性（第 178–189 行）。
 * - `.../scripts/lib/core.mts`：`jsSimilarity` / `cosineSimilarity` / `shareMae` /
 *   `top1Hit` / `top3Hit` / `signTestPValue`（第 116–188 行）。
 *
 * ## 移植说明
 *
 * - **指标全部复用** `packages/core/src/model/metrics.ts`（唯一实现）：
 *   JS／余弦／Share MAE／`top1Hit`／`top3Hit`／符号检验。
 * - **账号均值基线只用训练折**：`v06AccountMeanBaseline(dimension, train)`，评估折不参与（M08 要求）。
 * - **消融阶梯按 §9.2 重定义**：归档阶梯里的 `kw`（FAB 关键词）、`combo`（面料×FAB 交叉）、
 *   `gender`（性别修正）、`tags`（记忆点／群组打标／心智产品）触及人工字段，**不继承**；
 *   归档 `tags` 中唯一客观的「特殊功能/材质」拆成独立合规组 `craft`。
 *   合规阶梯见 `V06_ABLATION_LADDER`。
 * - **符号检验门槛**：逐维 `js_lift` 的配对差做双侧精确二项检验（p < 0.05 为显著）。
 */

import {
  cosineSimilarity,
  jsSimilarity,
  shareMae,
  signTestPValue,
  top1Hit,
  top3Hit,
} from '@uom/core/model/metrics';

import { predictV06Dimension, trainV06Dimension, v06AccountMeanBaseline } from './lib/train-v06.js';
import { V06_TARGET_DIMENSIONS, type V06Distribution, type V06Sample } from './lib/types.js';

/** 一个消融配置。 */
export interface V06Config {
  name: string;
  groups: readonly string[];
}

/** 合规消融阶梯（由少到多，全部只用 §9.2 白名单特征组）。 */
export const V06_ABLATION_LADDER: readonly V06Config[] = [
  { name: 'C0_fit_fabric', groups: ['fit', 'fabric'] },
  { name: 'C1_plus_attr', groups: ['fit', 'fabric', 'attr'] },
  { name: 'C2_plus_cat', groups: ['fit', 'fabric', 'attr', 'cat'] },
  { name: 'C3_plus_subcat', groups: ['fit', 'fabric', 'attr', 'cat', 'subcat'] },
  { name: 'C4_plus_craft', groups: ['fit', 'fabric', 'attr', 'cat', 'subcat', 'craft'] },
  {
    name: 'C5_full_compliant',
    groups: ['fit', 'fabric', 'attr', 'cat', 'subcat', 'craft', 'season', 'ip'],
  },
];

/** 单个 (款号, 维度) 的 OOF 配对结果。 */
export interface V06OofRow {
  sku: string;
  dimension: string;
  fold: number;
  modelJs: number;
  baseJs: number;
  modelCos: number;
  baseCos: number;
  modelMae: number;
  baseMae: number;
  modelTop1: number;
  baseTop1: number;
  modelTop3: number;
  baseTop3: number;
}

/** 逐维聚合指标。 */
export interface V06PerDimensionMetrics {
  n: number;
  modelJs: number;
  baseJs: number;
  jsLift: number;
  modelCos: number;
  baseCos: number;
  cosLift: number;
  modelMae: number;
  baseMae: number;
  maeReduction: number;
  modelTop1: number;
  baseTop1: number;
  top1Lift: number;
  modelTop3: number;
  baseTop3: number;
  jsLiftSign: { p: number; positive: number; negative: number; n: number };
  cosLiftSign: { p: number; positive: number; negative: number; n: number };
}

/** 宏平均指标（归档业务加权口径：购买力 0.40 / 人生阶段 0.35 / 服饰策略人群 0.25）。 */
export interface V06MacroMetrics {
  modelJs: number;
  baseJs: number;
  jsLift: number;
  modelCos: number;
  baseCos: number;
  cosLift: number;
  modelMae: number;
  baseMae: number;
  maeReduction: number;
  modelTop1: number;
  baseTop1: number;
  weightedBusinessJsLift: number;
  allDimensionsJsPositive: boolean;
  allDimensionsJsSignificant: boolean;
}

/** 一个消融配置的完整结果。 */
export interface V06AblationResult {
  config: V06Config;
  perDimension: Record<string, V06PerDimensionMetrics>;
  macro: V06MacroMetrics;
  foldStability: Record<string, { mean: number; std: number }>;
  featureCounts: Record<string, number>;
  rows: V06OofRow[];
  /**
   * 评估期**实际使用**的逐折账号均值基线（键 `fold:<折号>:<维度>`）。
   * 复核修单 B3：V12 必须与这份基线独立比对（而不是由管线用同一函数重算一份自比较），
   * 否则 ablation 泄漏（基线误用全量数据）时管线级校验无从发现。
   */
  foldBaselines: Record<string, V06Distribution>;
}

/** 均值（空集合返回 0，避免 NaN）。 */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 跑一轮消融阶梯（5 折 OOF + 折内账号均值基线配对）。 */
export function runV06Ablation(
  samples: readonly V06Sample[],
  folds: readonly string[][],
  configs: readonly V06Config[],
): V06AblationResult[] {
  const bySku = new Map(samples.map((sample) => [sample.sku, sample]));

  return configs.map((config) => {
    const groups = new Set(config.groups);
    const rows: V06OofRow[] = [];
    const featureCounts: Record<string, number> = {};
    // 复核修单 B3：记录评估期**实际使用**的逐折基线，供 V12 独立比对
    //（基线与配置无关，各配置相同，取首配置的即可代表）。
    const foldBaselines: Record<string, V06Distribution> = {};

    for (let fold = 0; fold < folds.length; fold += 1) {
      const testSkus = folds[fold] ?? [];
      const train = samples.filter((sample) => !testSkus.includes(sample.sku));
      const test = testSkus.map((sku) => bySku.get(sku)).filter((sample) => sample !== undefined);
      if (train.length === 0) {
        throw new Error(`runV06Ablation: 第 ${fold} 折的训练样本为空`);
      }

      for (const dimension of V06_TARGET_DIMENSIONS) {
        const fit = trainV06Dimension(dimension, train, groups);
        featureCounts[dimension] = fit.featureNames.length;
        const predictions = predictV06Dimension(fit, groups, test);
        const baseline = v06AccountMeanBaseline(dimension, train);
        foldBaselines[`fold:${fold}:${dimension}`] = baseline;
        for (let index = 0; index < test.length; index += 1) {
          const sample = test[index]!;
          const actual = sample.portraits[dimension];
          const predicted = predictions[index]!;
          rows.push({
            sku: sample.sku,
            dimension,
            fold,
            modelJs: jsSimilarity(predicted, actual),
            baseJs: jsSimilarity(baseline, actual),
            modelCos: cosineSimilarity(predicted, actual),
            baseCos: cosineSimilarity(baseline, actual),
            modelMae: shareMae(predicted, actual),
            baseMae: shareMae(baseline, actual),
            modelTop1: top1Hit(predicted, actual),
            baseTop1: top1Hit(baseline, actual),
            modelTop3: top3Hit(predicted, actual),
            baseTop3: top3Hit(baseline, actual),
          });
        }
      }
    }

    const perDimension: Record<string, V06PerDimensionMetrics> = {};
    for (const dimension of V06_TARGET_DIMENSIONS) {
      const dimensionRows = rows.filter((row) => row.dimension === dimension);
      perDimension[dimension] = {
        n: dimensionRows.length,
        modelJs: mean(dimensionRows.map((row) => row.modelJs)),
        baseJs: mean(dimensionRows.map((row) => row.baseJs)),
        jsLift: mean(dimensionRows.map((row) => row.modelJs - row.baseJs)),
        modelCos: mean(dimensionRows.map((row) => row.modelCos)),
        baseCos: mean(dimensionRows.map((row) => row.baseCos)),
        cosLift: mean(dimensionRows.map((row) => row.modelCos - row.baseCos)),
        modelMae: mean(dimensionRows.map((row) => row.modelMae)),
        baseMae: mean(dimensionRows.map((row) => row.baseMae)),
        maeReduction: mean(dimensionRows.map((row) => row.baseMae - row.modelMae)),
        modelTop1: mean(dimensionRows.map((row) => row.modelTop1)),
        baseTop1: mean(dimensionRows.map((row) => row.baseTop1)),
        top1Lift: mean(dimensionRows.map((row) => row.modelTop1 - row.baseTop1)),
        modelTop3: mean(dimensionRows.map((row) => row.modelTop3)),
        baseTop3: mean(dimensionRows.map((row) => row.baseTop3)),
        jsLiftSign: signTestPValue(dimensionRows.map((row) => row.modelJs - row.baseJs)),
        cosLiftSign: signTestPValue(dimensionRows.map((row) => row.modelCos - row.baseCos)),
      };
    }

    const macro: V06MacroMetrics = {
      modelJs: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.modelJs)),
      baseJs: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.baseJs)),
      jsLift: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.jsLift)),
      modelCos: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.modelCos)),
      baseCos: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.baseCos)),
      cosLift: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.cosLift)),
      modelMae: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.modelMae)),
      baseMae: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.baseMae)),
      maeReduction: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.maeReduction)),
      modelTop1: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.modelTop1)),
      baseTop1: mean(V06_TARGET_DIMENSIONS.map((d) => perDimension[d]!.baseTop1)),
      weightedBusinessJsLift:
        0.4 * perDimension['预测购买力']!.jsLift +
        0.35 * perDimension['预测人生阶段']!.jsLift +
        0.25 * perDimension['大服饰策略人群']!.jsLift,
      allDimensionsJsPositive: V06_TARGET_DIMENSIONS.every((d) => perDimension[d]!.jsLift > 0),
      allDimensionsJsSignificant: V06_TARGET_DIMENSIONS.every(
        (d) => perDimension[d]!.jsLiftSign.p < 0.05,
      ),
    };

    // 折稳定性：逐折的 JS 提升均值的均值与总体标准差
    const foldStability: Record<string, { mean: number; std: number }> = {};
    for (const dimension of V06_TARGET_DIMENSIONS) {
      const perFold = folds.map((_, fold) => {
        const foldRows = rows.filter((row) => row.dimension === dimension && row.fold === fold);
        return mean(foldRows.map((row) => row.modelJs - row.baseJs));
      });
      const average = mean(perFold);
      foldStability[dimension] = {
        mean: average,
        std: Math.sqrt(mean(perFold.map((value) => (value - average) ** 2))),
      };
    }

    return { config, perDimension, macro, foldStability, featureCounts, rows, foldBaselines };
  });
}
