/**
 * 阶段 06：fail-closed 校验（含 M08 要求的 V9／V12）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/06-validate.mts`
 *   逻辑位置：校验骨架与 `check()`（第 19–23 行）、intake 校验清单（第 26–35 行）、
 *   数据集完整性（第 38–54 行）、folds 完整性（第 57–64 行）、
 *   工件结构与预测自检（第 66–98 行）、平台口径纯净（第 100–112 行）、
 *   验收门槛记录（第 114–119 行）、fail-closed 退出（第 125–128 行）。
 *
 * ## 本移植新增的两条校验（P2 规格 M08 明列；语义经复核修单 B2／B3／S3／S4 修正）
 *
 * - **V9 连跑字节一致**：重跑一次最终训练，比对**确定性系数区**的 sha256。
 *   归档的工件把 `trainedAt` 混在系数区里，比对必然失败；
 *   本移植按 P2 规格 §2.5 把工件拆成「系数区 + 溯源区」后才可比。
 * - **V12 基线折内独立复算**：用**独立实现**（本文件内直接按训练折求均值，不调用
 *   ablation 的 `v06AccountMeanBaseline`）逐折复算账号均值基线，与 ablation **实际使用**
 *   的基线（由 `runV06Ablation` 返回、调用方传入）逐维逐标签比对；同时按**各自维度**
 *   断言「折内基线 ≠ 全量基线」，证明基线确实没有用评估折的信息。
 *   缺基线输入即 fail（fail-closed）。
 *
 * 其余修单修正：V1／V4 缺输入时 fail（不再默认 pass）；V4 的冻结值由
 * `frozen-inputs.ts` 钉死常量提供（不得用运行时哈希自比较）；V10 改为真实判定
 * （最终词表必须是各折 OOF 词表的超集，差异显式记录）。
 *
 * 校验失败一律返回 `fail`，由调用方按 fail-closed 退出（非 0 退出码）。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildV06Matrix, encodeV06Samples } from './lib/features-v06.js';
import { normalizeV06Distribution } from './lib/train-v06.js';
import { V06_COMPLIANT_GROUPS } from './lib/features-v06.js';
import { V06_TARGET_DIMENSIONS } from './lib/types.js';
import type { V06Dataset } from './01-prepare-dataset.js';
import type { V06FoldsDoc } from './02-load-folds.js';
import { validateV06Folds } from './02-load-folds.js';
import type { V06ModelArtifact, V06Selection } from './04-select-final.js';
import { v06CoefficientHash } from './04-select-final.js';
import type { V06Metrics } from './05-evaluate.js';

/** 一条校验结论。 */
export interface V06ValidationCheck {
  /** 校验编号（V1…V12） */
  id: string;
  /** 校验描述 */
  check: string;
  result: 'pass' | 'fail';
  detail?: string;
}

/** 校验输入。 */
export interface V06ValidateInput {
  dataset: V06Dataset;
  folds: V06FoldsDoc;
  selection: V06Selection;
  artifact: V06ModelArtifact;
  metrics: V06Metrics;
  /** V9：重跑一次最终训练（必须返回新的工件对象） */
  rerunFinalTraining?: () => V06ModelArtifact;
  /** V1：intake 校验清单路径（给了就必须逐条校验；**缺省即 V1 fail**，复核修单 S4） */
  checksumsFile?: string;
  /** V4：冻结 folds 的钉死 sha256（来自 `frozen-inputs.ts`；缺省即 V4 fail，复核修单 B2／S4） */
  frozenFoldsSha256?: string;
  /** V4：冻结 folds 文件当前的实际 sha256（缺省即 V4 fail，复核修单 B2／S4） */
  actualFoldsSha256?: string;
  /** V12：ablation **实际使用**的折内基线（`runV06Ablation` 返回值；键 `fold:<折号>:<维度>`；缺省即 V12 fail，复核修单 B3） */
  foldBaselines?: Record<string, Record<string, number>>;
}

/** 文件字节流的 sha256。 */
function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** 跑完整套校验，返回逐条结论（`fail` 即需 fail-closed 退出）。 */
export function validateV06(input: V06ValidateInput): V06ValidationCheck[] {
  const checks: V06ValidationCheck[] = [];
  const { dataset, folds, selection, artifact, metrics } = input;

  // ---- V1 intake 校验清单 ----
  {
    if (input.checksumsFile) {
      const root = dirname(input.checksumsFile);
      const lines = readFileSync(input.checksumsFile, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      let mismatches = 0;
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const expected = parts[0];
        const relative = parts[1];
        if (!expected || !relative) continue;
        if (sha256File(join(root, relative.replace(/^\.\//, ''))) !== expected) mismatches += 1;
      }
      checks.push({
        id: 'V1',
        check: 'intake checksums unchanged',
        result: mismatches === 0 ? 'pass' : 'fail',
        detail: `${lines.length} files, ${mismatches} mismatches`,
      });
    } else {
      // 复核修单 S4：fail-open（缺输入默认 pass）改为 fail-closed，照 V9 的写法
      checks.push({
        id: 'V1',
        check: 'intake checksums unchanged',
        result: 'fail',
        detail: '未提供 intake 校验清单路径，无法逐条校验（fail-closed，不默认 pass）',
      });
    }
  }

  // ---- V2 数据集完整性 ----
  {
    const problems: string[] = [];
    if (dataset.samples.length === 0) problems.push('样本为空');
    const skus = new Set(dataset.samples.map((sample) => sample.sku));
    if (skus.size !== dataset.samples.length) problems.push('款号重复');
    for (const sample of dataset.samples) {
      for (const dimension of V06_TARGET_DIMENSIONS) {
        const distribution = sample.portraits[dimension];
        if (!distribution || Object.keys(distribution).length === 0) {
          problems.push(`${sample.sku} 缺维度 ${dimension}`);
          continue;
        }
        const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
        if (Math.abs(total - 1) > 1e-9) {
          problems.push(`${sample.sku}/${dimension} 份额合计 ${total}`);
        }
        if (Object.values(distribution).some((value) => !Number.isFinite(value) || value < 0)) {
          problems.push(`${sample.sku}/${dimension} 份额非法`);
        }
      }
    }
    checks.push({
      id: 'V2',
      check: 'dataset integrity (samples, unique SKUs, six dimensions normalized)',
      result: problems.length === 0 ? 'pass' : 'fail',
      detail:
        problems.length === 0
          ? `${dataset.samples.length} samples, six dimensions complete`
          : problems.slice(0, 5).join('; '),
    });
  }

  // ---- V3 folds 完整性 ----
  {
    const errors = validateV06Folds(folds, dataset.samples.map((sample) => sample.sku));
    checks.push({
      id: 'V3',
      check: 'folds cover every SKU exactly once and stay balanced',
      result: errors.length === 0 ? 'pass' : 'fail',
      detail: errors.length === 0 ? `${folds.folds.length} folds` : errors.join('; '),
    });
  }

  // ---- V4 folds 是冻结输入（复核修单 B2／S4：与钉死值比对；缺任一值即 fail） ----
  {
    if (input.frozenFoldsSha256 && input.actualFoldsSha256) {
      const same = input.frozenFoldsSha256 === input.actualFoldsSha256;
      checks.push({
        id: 'V4',
        check: 'folds are a frozen input (not regenerated by this pipeline)',
        result: same ? 'pass' : 'fail',
        detail: same
          ? `frozen folds sha256 ${input.frozenFoldsSha256.slice(0, 16)}…`
          : `登记 ${input.frozenFoldsSha256} ≠ 实际 ${input.actualFoldsSha256}`,
      });
    } else {
      // 复核修单 B2／S4：冻结值缺失时不得默认 pass（旧实现此处 fail-open，
      // 且管线曾把同一运行时哈希同时当冻结值与实际值——自比较恒 PASS）。
      // 冻结值由 `frozen-inputs.ts` 的 FROZEN_FOLDS_SHA256 钉死，管线必须显式传入。
      checks.push({
        id: 'V4',
        check: 'folds are a frozen input (not regenerated by this pipeline)',
        result: 'fail',
        detail: '未提供冻结 folds 的哈希登记值或实际值（fail-closed，不默认 pass）',
      });
    }
  }

  // ---- V5 工件结构一致 ----
  {
    const problems: string[] = [];
    const dimensionModels = artifact.coefficients.dimensionModels;
    if (dimensionModels.length !== V06_TARGET_DIMENSIONS.length) {
      problems.push(`维度模型数 ${dimensionModels.length} ≠ ${V06_TARGET_DIMENSIONS.length}`);
    }
    for (const model of dimensionModels) {
      if (model.labels.length < 2) problems.push(`${model.labelType} 标签少于 2 个`);
      if (model.models.length !== model.labels.length) {
        problems.push(`${model.labelType} 模型数与标签数不一致`);
      }
      for (const labelModel of model.models) {
        if (labelModel.w.length !== model.featureNames.length) {
          problems.push(`${model.labelType} 权重维度与特征名数不一致`);
        }
        const values = [labelModel.b, ...labelModel.w, ...labelModel.mean, ...labelModel.std];
        if (values.some((value) => !Number.isFinite(value))) {
          problems.push(`${model.labelType} 含非有限数值`);
        }
      }
    }
    checks.push({
      id: 'V5',
      check: 'artifact structure consistent (labels/weights/features finite)',
      result: problems.length === 0 ? 'pass' : 'fail',
      detail: problems.length === 0 ? `${dimensionModels.length} dimension models` : problems.join('; '),
    });
  }

  // ---- V6 预测自检（归一且有限） ----
  {
    const groups = new Set(artifact.coefficients.selectedConfig.groups);
    let ok = true;
    const detail: string[] = [];
    for (const model of artifact.coefficients.dimensionModels) {
      const probe = dataset.samples.slice(0, 3);
      const matrix = encodeV06Samples(probe, groups, model.featureNames);
      for (let index = 0; index < probe.length; index += 1) {
        const row = matrix[index]!;
        const raw = model.models.map((labelModel) => {
          let value = labelModel.b;
          for (let j = 0; j < row.length; j += 1) {
            value += labelModel.w[j]! * ((row[j]! - labelModel.mean[j]!) / labelModel.std[j]!);
          }
          return value;
        });
        const distribution = normalizeV06Distribution(model.labels, raw);
        const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
        if (Math.abs(total - 1) > 1e-9 || Object.values(distribution).some((v) => !Number.isFinite(v) || v < 0)) {
          ok = false;
          detail.push(`${model.labelType} 分布非法`);
        }
      }
    }
    checks.push({
      id: 'V6',
      check: 'artifact produces normalized finite distributions on probe samples',
      result: ok ? 'pass' : 'fail',
      detail: ok ? 'probe samples ok' : detail.join('; '),
    });
  }

  // ---- V7 平台口径纯净（标签必须来自冻结 intake 的画像标签集合） ----
  {
    const datasetLabels = new Set<string>();
    for (const sample of dataset.samples) {
      for (const dimension of V06_TARGET_DIMENSIONS) {
        for (const label of Object.keys(sample.portraits[dimension] ?? {})) datasetLabels.add(label);
      }
    }
    const foreign: string[] = [];
    for (const model of artifact.coefficients.dimensionModels) {
      for (const label of model.labels) {
        if (!datasetLabels.has(label)) foreign.push(`${model.labelType}/${label}`);
      }
    }
    checks.push({
      id: 'V7',
      check: 'no foreign taxonomy labels in artifact (all labels come from the frozen intake)',
      result: foreign.length === 0 ? 'pass' : 'fail',
      detail: foreign.length === 0 ? 'all labels traceable to intake' : foreign.join(', '),
    });
  }

  // ---- V8 §9.2 合规 ----
  {
    const problems: string[] = [];
    const groups = artifact.coefficients.selectedConfig.groups;
    for (const group of groups) {
      if (!V06_COMPLIANT_GROUPS.includes(group)) problems.push(`非合规特征组 ${group}`);
    }
    // 特征名前缀必须落在合规组的命名空间内（fit_/fabric_/attr_/cat_/subcat_/season_/ip_/craft_）
    const allowedPrefixes = ['fit', 'fabric', 'attr', 'cat', 'subcat', 'season', 'ip', 'craft'];
    for (const model of artifact.coefficients.dimensionModels) {
      for (const featureName of model.featureNames) {
        const prefix = featureName.split('_')[0]!;
        if (!allowedPrefixes.includes(prefix)) problems.push(`特征名 ${featureName} 前缀不在合规集合`);
      }
    }
    checks.push({
      id: 'V8',
      check: '§9.2 compliance: only whitelist feature groups and no manual-field features',
      result: problems.length === 0 ? 'pass' : 'fail',
      detail: problems.length === 0 ? `groups: ${groups.join(',')}` : problems.join('; '),
    });
  }

  // ---- V9 连跑两次字节一致 ----
  {
    if (!input.rerunFinalTraining) {
      checks.push({
        id: 'V9',
        check: 'two consecutive runs produce byte-identical coefficient region',
        result: 'fail',
        detail: '未提供重跑入口，无法验证',
      });
    } else {
      const rerun = input.rerunFinalTraining();
      const first = v06CoefficientHash(artifact);
      const second = v06CoefficientHash(rerun);
      checks.push({
        id: 'V9',
        check: 'two consecutive runs produce byte-identical coefficient region',
        result: first === second ? 'pass' : 'fail',
        detail: first === second ? `coefficient sha256 ${first.slice(0, 16)}…` : `${first} ≠ ${second}`,
      });
    }
  }

  // ---- V10 最终词表 ⊇ 各折 OOF 词表（复核修单 S3：真实判定，差异显式记录） ----
  {
    const groups = new Set(artifact.coefficients.selectedConfig.groups);
    const finalVocabulary = artifact.coefficients.dimensionModels[0]?.featureNames ?? [];
    const problems: string[] = [];
    const notes: string[] = [];
    for (let fold = 0; fold < folds.folds.length; fold += 1) {
      const testSkus = folds.folds[fold] ?? [];
      const trainSamples = dataset.samples.filter((sample) => !testSkus.includes(sample.sku));
      if (trainSamples.length === 0) {
        problems.push(`第 ${fold} 折训练样本为空`);
        continue;
      }
      const foldVocabulary =
        buildV06Matrix(
          trainSamples,
          trainSamples,
          groups,
          artifact.coefficients.featureMinCount,
        ).featureNames;
      const missing = foldVocabulary.filter((name) => !finalVocabulary.includes(name));
      if (missing.length > 0) {
        problems.push(`第 ${fold} 折 OOF 词表有 ${missing.length} 个词不在最终词表（如 ${missing[0]}）`);
      }
      notes.push(`fold ${fold}: OOF ${foldVocabulary.length} / 最终 ${finalVocabulary.length}`);
    }
    checks.push({
      id: 'V10',
      check: 'final vocabulary is a superset of every fold OOF vocabulary; differences recorded',
      result: problems.length === 0 ? 'pass' : 'fail',
      detail:
        problems.length === 0
          ? `final ⊇ OOF holds；${notes.join('; ')}`
          : problems.join('; '),
    });
  }

  // ---- V11 符号检验门槛结论已记录 ----
  {
    const gate = selection.gate;
    const known = gate === 'PASS' || gate === 'FAIL_SIGNIFICANCE' || gate === 'FAIL_NOT_POSITIVE';
    checks.push({
      id: 'V11',
      check: 'sign-test threshold outcome is recorded (PASS / FAIL_SIGNIFICANCE / FAIL_NOT_POSITIVE)',
      result: known ? 'pass' : 'fail',
      detail: `selection gate = ${gate}`,
    });
  }

  // ---- V12 基线折内独立复算（复核修单 B3：独立实现 + 逐维度比对 + fail-closed） ----
  {
    const problems: string[] = [];
    const details: string[] = [];
    // 独立实现：**不调用** `v06AccountMeanBaseline`（ablation 用的那一份），
    // 在此直接按训练折逐标签累加求均值。两份实现口径必须一致，
    // 否则 ablation 基线有任何偏差（例如误用全量样本）都会在这里现形。
    const meanDistribution = (
      samples: readonly V06Dataset['samples'][number][],
      dimension: string,
    ): Record<string, number> => {
      const sums: Record<string, number> = {};
      for (const sample of samples) {
        const distribution = (sample.portraits as Record<string, Record<string, number>>)[dimension] ?? {};
        for (const [label, value] of Object.entries(distribution)) {
          sums[label] = (sums[label] ?? 0) + value;
        }
      }
      const count = samples.length || 1;
      const means: Record<string, number> = {};
      for (const label of Object.keys(sums)) means[label] = (sums[label] ?? 0) / count;
      return means;
    };
    const sameDistribution = (left: Record<string, number>, right: Record<string, number>): boolean => {
      const labels = new Set([...Object.keys(left), ...Object.keys(right)]);
      return [...labels].every(
        (label) => Math.abs((left[label] ?? 0) - (right[label] ?? 0)) < 1e-12,
      );
    };

    if (!input.foldBaselines || Object.keys(input.foldBaselines).length === 0) {
      problems.push('未提供 ablation 实际使用的折内基线，无法独立复算（fail-closed）');
    } else {
      // 全量基线逐维度计算（旧实现固定按「预测性别」算、却对六个维度比较——
      // 其余五维成了跨维度比较、必然「不同」，断言恒真）。
      const globalByDimension = new Map<string, Record<string, number>>();
      for (const dimension of V06_TARGET_DIMENSIONS) {
        globalByDimension.set(dimension, meanDistribution(dataset.samples, dimension));
      }
      for (let fold = 0; fold < folds.folds.length; fold += 1) {
        const testSkus = folds.folds[fold] ?? [];
        const trainSamples = dataset.samples.filter((sample) => !testSkus.includes(sample.sku));
        if (trainSamples.length === 0) {
          problems.push(`第 ${fold} 折训练样本为空`);
          continue;
        }
        for (const dimension of V06_TARGET_DIMENSIONS) {
          const recomputed = meanDistribution(trainSamples, dimension);
          const key = `fold:${fold}:${dimension}`;
          const provided = input.foldBaselines[key];
          if (!provided) {
            problems.push(`${key} 缺少 ablation 实际使用的基线`);
            continue;
          }
          if (!sameDistribution(recomputed, provided)) {
            problems.push(`${key} 与独立复算结果不一致（ablation 基线可疑）`);
          }
          const globalBaseline = globalByDimension.get(dimension)!;
          if (sameDistribution(recomputed, globalBaseline)) {
            problems.push(`${key} 与本维度全量基线相同，未体现折内计算`);
          }
        }
        details.push(`fold ${fold}: 训练样本 ${trainSamples.length}`);
      }
    }
    checks.push({
      id: 'V12',
      check: 'account-mean baseline recomputed independently inside each fold',
      result: problems.length === 0 ? 'pass' : 'fail',
      detail: problems.length === 0 ? details.join('; ') : problems.slice(0, 5).join('; '),
    });
  }

  void metrics;
  return checks;
}
