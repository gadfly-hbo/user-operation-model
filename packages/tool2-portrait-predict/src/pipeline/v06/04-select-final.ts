/**
 * 阶段 04：二轮变体 → 配置选择 → 全量最终模型 → 确定性工件。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/04-select-final.mts`
 *   逻辑位置：`VARIANTS`（第 23–29 行）、`runOof`（第 60–93 行）、`summarize`（第 95–147 行）、
 *   选择规则（第 168–180 行）、最终模型（第 182–193 行）、工件结构（第 195–217 行）。
 *
 * ## 选择规则（与归档的差异，必须知悉）
 *
 * 归档口径：优先「六维 JS 提升全为正 **且** 符号检验全部显著」的候选；
 * 没有则退到「六维 JS 提升全为正」；再没有就 **fail-closed 退出**。
 *
 * 本移植保留前两级，并把第三级（无可用候选）改成**降级并如实记录**：
 * 归档那一组数字本身已被 P2 规格 §7 第 4／5 条排除在继承范围外
 * （「v0.6 的验收结论当达标」「勘误前的 JS 手工数值经复算无法精确还原」），
 * 因此**不得**把归档的达标结论当成本移植的达标依据，也**不得**为了「跑通」
 * 而放宽门槛。本移植的做法是：门槛照常计算、照常记录，
 * 没有候选达标时选「宏平均 JS 提升最大」的候选并把门槛结论记成 `FAIL_*`，
 * 由阶段 05／06 把它作为**未达标事实**报出。
 *
 * `policy: 'strict'` 保留归档的 fail-closed 行为（无达标候选即抛错）。
 *
 * ## 工件的确定性／溯源分区
 *
 * P2 规格 §2.5 要求把工件拆成「确定性系数区（参与哈希）+ 溯源区（不参与）」：
 * `coefficients` 区只含模型系数与词表（**不含时间戳**），`provenance` 区含
 * 训练时间、来源路径等溯源信息。`v06CoefficientHash` 只对系数区取 sha256，
 * 因此**连跑两次必须字节一致**（M08 的 V9 校验依赖这一点）。
 */

import { createHash } from 'node:crypto';

import type { V06AblationResult, V06Config } from './03-run-ablation.js';
import { trainV06Dimension, V06_ALPHAS, V06_MIN_COUNT } from './lib/train-v06.js';
import { V06_EXPERIMENT_ID, V06_TARGET_DIMENSIONS, type V06Sample } from './lib/types.js';

/** 二轮变体（围绕合规特征集的增减）。 */
export const V06_VARIANTS: readonly V06Config[] = [
  {
    name: 'V0_full_compliant',
    groups: ['fit', 'fabric', 'attr', 'cat', 'subcat', 'craft', 'season', 'ip'],
  },
  {
    name: 'V1_minus_subcat',
    groups: ['fit', 'fabric', 'attr', 'cat', 'craft', 'season', 'ip'],
  },
  {
    name: 'V2_minus_craft',
    groups: ['fit', 'fabric', 'attr', 'cat', 'subcat', 'season', 'ip'],
  },
  { name: 'V3_core', groups: ['fit', 'fabric', 'attr', 'cat'] },
  {
    name: 'V4_plus_subcat_craft',
    groups: ['fit', 'fabric', 'attr', 'cat', 'subcat', 'craft'],
  },
];

/** 选择门槛结论。 */
export type V06SelectionGate =
  /** 六维 JS 提升全为正且符号检验全部显著（p < 0.05） */
  | 'PASS'
  /** 六维 JS 提升全为正，但符号检验未全部显著 */
  | 'FAIL_SIGNIFICANCE'
  /** 连「全为正」都未达成 */
  | 'FAIL_NOT_POSITIVE';

/** 选择策略。 */
export type V06SelectionPolicy = 'degrade-with-record' | 'strict';

/** 选择结果。 */
export interface V06Selection {
  winner: V06Config;
  gate: V06SelectionGate;
  criteria: string;
  candidates: Array<{
    name: string;
    allPositive: boolean;
    allSignificant: boolean;
    macroJsLift: number;
    weightedBusinessJsLift: number;
  }>;
}

/** 工件的确定性系数区。 */
export interface V06CoefficientRegion {
  targetDimensions: string[];
  featureMinCount: number;
  alphaCandidates: number[];
  selectedConfig: { name: string; groups: string[] };
  dimensionModels: Array<{
    labelType: string;
    labels: string[];
    alpha: number;
    featureNames: string[];
    models: Array<{ w: number[]; b: number; mean: number[]; std: number[] }>;
  }>;
}

/** 最终模型工件。 */
export interface V06ModelArtifact {
  version: string;
  scope: string;
  /** 确定性系数区（参与哈希） */
  coefficients: V06CoefficientRegion;
  /** 溯源区（不参与哈希） */
  provenance: {
    trainedAt: string;
    experiment: string;
    sampleCount: number;
    notes: string[];
  };
}

/** 宏平均指标里的加权业务 JS 提升（归档口径：购买力 0.40 / 人生阶段 0.35 / 服饰策略人群 0.25）。 */
export function v06WeightedBusinessJsLift(
  perDimension: Record<string, { jsLift: number }>,
): number {
  return (
    0.4 * (perDimension['预测购买力']?.jsLift ?? 0) +
    0.35 * (perDimension['预测人生阶段']?.jsLift ?? 0) +
    0.25 * (perDimension['大服饰策略人群']?.jsLift ?? 0)
  );
}

/** 按门槛规则选出最终配置。 */
export function selectV06FinalConfig(
  results: readonly V06AblationResult[],
  policy: V06SelectionPolicy = 'degrade-with-record',
): V06Selection {
  if (results.length === 0) {
    throw new Error('selectV06FinalConfig: 没有可用的候选结果');
  }

  const candidates = results.map((result) => ({
    name: result.config.name,
    allPositive: result.macro.allDimensionsJsPositive,
    allSignificant: result.macro.allDimensionsJsSignificant,
    macroJsLift: result.macro.jsLift,
    weightedBusinessJsLift: result.macro.weightedBusinessJsLift,
  }));

  const byMacroLift = (left: (typeof candidates)[number], right: (typeof candidates)[number]): number =>
    right.macroJsLift - left.macroJsLift;

  const passing = candidates.filter((item) => item.allPositive && item.allSignificant);
  const positive = candidates.filter((item) => item.allPositive);

  let winner: (typeof candidates)[number];
  let gate: V06SelectionGate;
  if (passing.length > 0) {
    winner = [...passing].sort(byMacroLift)[0]!;
    gate = 'PASS';
  } else if (positive.length > 0) {
    winner = [...positive].sort(byMacroLift)[0]!;
    gate = 'FAIL_SIGNIFICANCE';
  } else {
    if (policy === 'strict') {
      throw new Error(
        'FAIL-CLOSED: no candidate with all-dimension positive JS lift（没有六维 JS 提升全为正的候选）',
      );
    }
    winner = [...candidates].sort(byMacroLift)[0]!;
    gate = 'FAIL_NOT_POSITIVE';
  }

  const config = results.find((result) => result.config.name === winner.name)!.config;
  return {
    winner: config,
    gate,
    criteria:
      'all dims JS lift positive & sign-test significant (p<0.05) → all dims JS lift positive → max macro JS lift',
    candidates,
  };
}

/** 用全量样本训练最终模型并产出工件。 */
export function trainV06FinalModel(
  samples: readonly V06Sample[],
  config: V06Config,
  options?: { alphas?: readonly number[]; minCount?: number; trainedAt?: string },
): V06ModelArtifact {
  if (samples.length === 0) throw new Error('trainV06FinalModel: 训练样本为空');
  const alphas = options?.alphas ?? V06_ALPHAS;
  const minCount = options?.minCount ?? V06_MIN_COUNT;
  const groups = new Set(config.groups);

  const dimensionModels = V06_TARGET_DIMENSIONS.map((dimension) => {
    const fit = trainV06Dimension(dimension, samples, groups, { alphas, minCount });
    return {
      labelType: dimension,
      labels: fit.labels,
      alpha: fit.alpha,
      featureNames: fit.featureNames,
      models: fit.perLabel.map((model) => ({
        w: model.weights,
        b: model.intercept,
        mean: model.mean,
        std: model.std,
      })),
    };
  });

  return {
    version: 'uom-tool2-portrait-v06-1',
    scope: 'tmall_only_compliant_v06',
    coefficients: {
      targetDimensions: [...V06_TARGET_DIMENSIONS],
      featureMinCount: minCount,
      alphaCandidates: [...alphas],
      selectedConfig: { name: config.name, groups: [...config.groups] },
      dimensionModels,
    },
    provenance: {
      trainedAt: options?.trainedAt ?? new Date().toISOString(),
      experiment: V06_EXPERIMENT_ID,
      sampleCount: samples.length,
      notes: [
        'v0.6 六阶段管线移植；§9.2 合规特征集（不含 FAB／心智产品／记忆点／群组打标／性别修正）。',
        '系数区为确定性内容（参与哈希）；provenance 区为溯源信息（不参与哈希）。',
      ],
    },
  };
}

/** 工件的确定性系数区文本（规范 JSON，键序固定）。 */
export function v06CoefficientRegion(artifact: V06ModelArtifact): string {
  return JSON.stringify(artifact.coefficients, null, 2);
}

/** 系数区 sha256（连跑两次必须一致）。 */
export function v06CoefficientHash(artifact: V06ModelArtifact): string {
  return createHash('sha256').update(v06CoefficientRegion(artifact), 'utf8').digest('hex');
}
