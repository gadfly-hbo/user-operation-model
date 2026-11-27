/**
 * 阶段 05：评估产物（指标、基线对照、验收矩阵）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/05-evaluate-report.mts`
 *   逻辑位置：验收矩阵（第 32–58 行）、`metrics.json`（第 79–116 行）、
 *   `baseline-comparison.json`（第 118–141 行）。
 *
 * ## 移植说明
 *
 * - 归档同阶段还写 HTML 报告；本移植**只出 JSON 指标与基线对照**
 *   （HTML 报告不在 P2 验收条目内，且归档报告含渠道口径描述，不在本轮范围）。
 * - **验收门槛照常计算**：门槛 1「六维 JS 提升全为正且符号检验全部显著（p<0.05）」、
 *   门槛 2「高变异维度（购买力／人生阶段／性别）至少 2/3 显著为正」、
 *   门槛 3「相对对照组 C0 有增益」、门槛 4「各折 JS 提升均值为正」。
 *   门槛结论**如实记录**，不因流水线跑通而放宽。
 * - 归档的 `generatedAt` 时间戳不写进本产物（本产物是纯确定性指标文档，
 *   时间戳由调用方放在溯源区）。
 */

import type {
  V06AblationResult,
  V06Config,
  V06MacroMetrics,
  V06PerDimensionMetrics,
} from './03-run-ablation.js';
import type { V06Selection } from './04-select-final.js';
import { V06_TARGET_DIMENSIONS } from './lib/types.js';

/** 验收门槛的一条结论。 */
export interface V06AcceptanceGate {
  pass: boolean | null;
  detail: Record<string, unknown>;
  requirement?: string;
}

/** 评估指标文档。 */
export interface V06Metrics {
  schemaVersion: 1;
  experiment: string;
  evaluation: string;
  sampleCount: number;
  selectedConfig: string;
  selectionGate: string;
  perDimension: Record<string, V06PerDimensionMetrics>;
  macro: V06MacroMetrics;
  foldStability: Record<string, { mean: number; std: number }>;
  finalModel: { alphas: Record<string, number>; featureCounts: Record<string, number> };
  ablationLadder: Array<{
    config: string;
    groups: string[];
    jsLift: number;
    cosLift: number;
    maeReduction: number;
    weighted: number;
    allPositive: boolean;
    allSignificant: boolean;
  }>;
  variantRound: Array<{
    name: string;
    groups: string[];
    jsLift: number;
    allPositive: boolean;
    allSignificant: boolean;
  }>;
  acceptance: Record<string, V06AcceptanceGate>;
  riskFlags: string[];
}

/** 评估输入。 */
export interface V06EvaluateInput {
  experiment: string;
  sampleCount: number;
  selection: V06Selection;
  ablation: readonly V06AblationResult[];
  variants: readonly V06AblationResult[];
  finalModel: { alphas: Record<string, number>; featureCounts: Record<string, number> };
  /** 对照组（阶梯里的第一个配置，通常是最简特征集） */
  controlConfig?: V06Config;
}

/** 高变异维度（归档 `05-evaluate-report.mts:27`）。 */
const HIGH_VARIABILITY_DIMENSIONS = ['预测购买力', '预测人生阶段', '预测性别'] as const;

/** 产出评估指标文档。 */
export function evaluateV06(input: V06EvaluateInput): V06Metrics {
  const winner =
    [...input.variants, ...input.ablation].find(
      (result) => result.config.name === input.selection.winner.name,
    ) ?? input.variants[0] ?? input.ablation[0];
  if (!winner) throw new Error('evaluateV06: 找不到胜出配置的评估结果');

  const perDimension = winner.perDimension;
  const macro = winner.macro;
  const control =
    input.ablation.find((result) => result.config.name === input.controlConfig?.name) ??
    input.ablation[0];

  const gate1Detail: Record<string, unknown> = {};
  for (const dimension of V06_TARGET_DIMENSIONS) {
    gate1Detail[dimension] = {
      lift: perDimension[dimension]!.jsLift,
      p: perDimension[dimension]!.jsLiftSign.p,
    };
  }

  const highVariabilityOk = HIGH_VARIABILITY_DIMENSIONS.filter(
    (dimension) =>
      perDimension[dimension]!.jsLift > 0 && perDimension[dimension]!.jsLiftSign.p < 0.05,
  );
  const highVariabilityDetail: Record<string, unknown> = {};
  for (const dimension of HIGH_VARIABILITY_DIMENSIONS) {
    highVariabilityDetail[dimension] = {
      lift: perDimension[dimension]!.jsLift,
      p: perDimension[dimension]!.jsLiftSign.p,
    };
  }

  const acceptance: Record<string, V06AcceptanceGate> = {
    gate1_all_dims_positive_significant: {
      pass: macro.allDimensionsJsPositive && macro.allDimensionsJsSignificant,
      detail: gate1Detail,
      requirement: '六维 JS 提升全为正且符号检验 p<0.05',
    },
    gate2_high_variability_dims: {
      pass: highVariabilityOk.length >= 2,
      detail: highVariabilityDetail,
      requirement: '>=2/3 高变异维度显著为正',
    },
    gate3_expansion_gain_over_control: {
      pass: control ? macro.jsLift > control.macro.jsLift : null,
      detail: {
        control: control?.config.name ?? null,
        control_js_lift: control?.macro.jsLift ?? null,
        selected_js_lift: macro.jsLift,
      },
      requirement: '扩展特征集相对对照组有 OOF 增益',
    },
    gate4_fold_stability: {
      pass: Object.values(winner.foldStability).every((item) => item.mean > 0),
      detail: winner.foldStability as unknown as Record<string, unknown>,
      requirement: '各维度各折 JS 提升均值为正',
    },
    gate5_frozen_inputs_and_fail_closed: {
      pass: null,
      detail: { verifiedBy: '06-validate' },
    },
  };

  return {
    schemaVersion: 1,
    experiment: input.experiment,
    evaluation: '5-fold OOF, paired against fold-internal account-mean baseline',
    sampleCount: input.sampleCount,
    selectedConfig: input.selection.winner.name,
    selectionGate: input.selection.gate,
    perDimension,
    macro,
    foldStability: winner.foldStability,
    finalModel: input.finalModel,
    ablationLadder: input.ablation.map((result) => ({
      config: result.config.name,
      groups: [...result.config.groups],
      jsLift: result.macro.jsLift,
      cosLift: result.macro.cosLift,
      maeReduction: result.macro.maeReduction,
      weighted: result.macro.weightedBusinessJsLift,
      allPositive: result.macro.allDimensionsJsPositive,
      allSignificant: result.macro.allDimensionsJsSignificant,
    })),
    variantRound: input.variants.map((result) => ({
      name: result.config.name,
      groups: [...result.config.groups],
      jsLift: result.macro.jsLift,
      allPositive: result.macro.allDimensionsJsPositive,
      allSignificant: result.macro.allDimensionsJsSignificant,
    })),
    acceptance,
    riskFlags: [
      'small_sample',
      'single_account_single_quarter',
      'no_temporal_validation_within_tmall',
      'absolute_lift_small_baseline_js_near_1',
      'compliant_feature_set_excludes_fab_and_manual_fields',
      'folds_are_frozen_input_stratified_by_a_manual_field',
    ],
  };
}

/** 基线对照文档（模型 vs 折内账号均值基线的逐维配对结果）。 */
export function buildV06BaselineComparison(metrics: V06Metrics): Record<string, unknown> {
  const perDimension: Record<string, unknown> = {};
  for (const dimension of V06_TARGET_DIMENSIONS) {
    const item = metrics.perDimension[dimension]!;
    perDimension[dimension] = {
      model_js: item.modelJs,
      baseline_js: item.baseJs,
      model_top1: item.modelTop1,
      baseline_top1: item.baseTop1,
      js_lift: item.jsLift,
      p: item.jsLiftSign.p,
      wins: item.jsLiftSign.positive,
      losses: item.jsLiftSign.negative,
    };
  }
  return {
    baseline: 'account-mean portrait computed within training folds only',
    perDimension,
    macro: metrics.macro,
  };
}
