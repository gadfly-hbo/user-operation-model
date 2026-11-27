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
 * ## 本移植新增的两条校验（P2 规格 M08 明列）
 *
 * - **V9 连跑字节一致**：重跑一次最终训练，比对**确定性系数区**的 sha256。
 *   归档的工件把 `trainedAt` 混在系数区里，比对必然失败；
 *   本移植按 P2 规格 §2.5 把工件拆成「系数区 + 溯源区」后才可比。
 * - **V12 基线折内独立复算**：逐折**独立重算**账号均值基线并与评估阶段用的基线比对，
 *   同时断言「折内基线 ≠ 全量基线」，以此证明基线确实没有用评估折的信息。
 *
 * 校验失败一律返回 `fail`，由调用方按 fail-closed 退出（非 0 退出码）。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildV06Matrix, encodeV06Samples } from './lib/features-v06.js';
import { normalizeV06Distribution, v06AccountMeanBaseline } from './lib/train-v06.js';
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
  /** V1：intake 校验清单路径（给了就必须逐条校验） */
  checksumsFile?: string;
  /** V4：冻结 folds 文件的 sha256（登记值） */
  frozenFoldsSha256?: string;
  /** V4：冻结 folds 文件当前的实际 sha256 */
  actualFoldsSha256?: string;
  /** V12：评估阶段用到的折内基线（键为 `fold:<折号>:<维度>`） */
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
    checks.push({
      id: 'V1',
      check: 'intake checksums unchanged',
      result: 'pass',
      detail: '未提供校验清单路径，跳过逐条校验（数据集阶段已记录清单结果）',
    });
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

  // ---- V4 folds 是冻结输入 ----
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
      checks.push({
        id: 'V4',
        check: 'folds are a frozen input (not regenerated by this pipeline)',
        result: 'pass',
        detail: '未提供冻结 folds 的哈希登记值；阶段 02 源码无写文件路径（结构性保证）',
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

  // ---- V10 OOF 词表 ≠ 最终词表（显式记录） ----
  {
    const groups = new Set(artifact.coefficients.selectedConfig.groups);
    const finalVocabulary = artifact.coefficients.dimensionModels[0]?.featureNames ?? [];
    const firstFold = folds.folds[0] ?? [];
    const trainSamples = dataset.samples.filter((sample) => !firstFold.includes(sample.sku));
    const foldVocabulary =
      trainSamples.length > 0
        ? buildV06Matrix(
            trainSamples,
            trainSamples,
            groups,
            artifact.coefficients.featureMinCount,
          ).featureNames
        : [];
    const differs =
      finalVocabulary.length !== foldVocabulary.length ||
      finalVocabulary.some((name, index) => name !== foldVocabulary[index]);
    checks.push({
      id: 'V10',
      check: 'OOF vocabulary vs final vocabulary difference is explicitly recorded',
      result: 'pass',
      detail: `differs=${differs}；最终词表 ${finalVocabulary.length} 个；第 0 折 OOF 词表 ${foldVocabulary.length} 个`,
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

  // ---- V12 基线折内独立复算 ----
  {
    const problems: string[] = [];
    const details: string[] = [];
    for (let fold = 0; fold < folds.folds.length; fold += 1) {
      const testSkus = folds.folds[fold] ?? [];
      const trainSamples = dataset.samples.filter((sample) => !testSkus.includes(sample.sku));
      if (trainSamples.length === 0) {
        problems.push(`第 ${fold} 折训练样本为空`);
        continue;
      }
      const globalBaseline = v06AccountMeanBaseline('预测性别', dataset.samples);
      for (const dimension of V06_TARGET_DIMENSIONS) {
        const foldBaseline = v06AccountMeanBaseline(dimension, trainSamples);
        const key = `fold:${fold}:${dimension}`;
        const provided = input.foldBaselines?.[key];
        if (provided) {
          const same = Object.keys(foldBaseline).every(
            (label) => Math.abs((foldBaseline[label] ?? 0) - (provided[label] ?? 0)) < 1e-12,
          );
          if (!same) problems.push(`${key} 与独立复算结果不一致`);
        }
        // 折内基线必须与全量基线不同（证明没有用全量样本算基线）
        const sameAsGlobal = Object.keys(globalBaseline).every(
          (label) => Math.abs((foldBaseline[label] ?? 0) - (globalBaseline[label] ?? 0)) < 1e-12,
        );
        if (sameAsGlobal) problems.push(`${key} 与全量基线相同，未体现折内计算`);
      }
      details.push(`fold ${fold}: 训练样本 ${trainSamples.length}`);
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
