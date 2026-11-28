/**
 * 自包含预测模块模板（`predict.mjs` 生成器）。
 *
 * 依据：P2 规格 §2.3「特征抽取器内嵌、系数、归一化参数、词表、后处理」，
 * 以及 model-mlflow 的包契约（`predict.mjs` 导出 `predict(rows)`，纯 Node 零依赖）。
 *
 * ## 为什么是「声明式规格 + 微型运行时」
 *
 * 模型包必须**自包含、零依赖**（拷走即用），所以抽取逻辑无法在运行期 import 本项目源码。
 * 为避免出现「第二份抽取实现」，本模板把**数据**（特征组规格、面料归一化规则、
 * 最终词表、逐标签系数）从单一来源序列化进包里，运行时代码只做**通用**的
 * 「取词项 → 组向量 → 线性打分 → 归一化」四步。
 * 规格与本项目管线用的是**同一份** `V06_FEATURE_GROUPS`（见导出器测试的同源断言）。
 *
 * ## 后处理口径
 *
 * v0.6 口径：**负值截断为 0 → 按维度归一化**。
 * **不与 v0.4 的 softmax + 温度校准合并**（P2 规格 §2.3 明令禁止）。
 *
 * ## 数值一致性
 *
 * 运行时的打分与归一化步骤**逐步镜像** `packages/core/src/model/ridge.ts` 的
 * `predictRidge` 与 `lib/train-v06.ts` 的 `normalizeV06Distribution`
 * （同样的运算顺序、同样的截断与归一化），因此导出包的输出与管线输出**逐位相同**
 * （由导出器测试的「导出包与管线口径一致」用例守住）。
 */

import type { V06ModelArtifact } from '../pipeline/v06/04-select-final.js';
import {
  V06_FABRIC_RULES,
  V06_FEATURE_GROUPS,
  V06_TOKEN_SEPARATOR_PATTERN,
} from '../pipeline/v06/lib/features-v06.js';

/** 序列化特征组规格（只保留被选中的组）。 */
function serializeSpec(groups: readonly string[]): string {
  const selected: Record<string, unknown[]> = {};
  for (const group of groups) {
    const specs = V06_FEATURE_GROUPS[group];
    if (!specs) throw new Error(`未知特征组：${group}`);
    selected[group] = specs.map((spec) => ({
      field: spec.field,
      prefix: spec.prefix,
      kind: spec.kind,
    }));
  }
  return JSON.stringify(selected, null, 2);
}

/** 序列化面料归一化规则（正则以源码保存，运行时重建 RegExp）。 */
function serializeFabricRules(): string {
  return JSON.stringify(
    V06_FABRIC_RULES.map(([pattern, name]) => [pattern.source, name]),
    null,
    2,
  );
}

/** 生成 `predict.mjs` 的源码文本。 */
export function renderV06PredictModule(input: {
  artifact: V06ModelArtifact;
  inputColumns: readonly string[];
  outputColumns: readonly string[];
}): string {
  const artifact = input.artifact;
  const groups = artifact.coefficients.selectedConfig.groups;
  const featureNames = artifact.coefficients.dimensionModels[0]?.featureNames ?? [];
  const models: Record<string, unknown> = {};
  for (const model of artifact.coefficients.dimensionModels) {
    models[model.labelType] = {
      labels: model.labels,
      alpha: model.alpha,
      models: model.models,
    };
  }

  return `/**
 * 自包含模型包预测模块（formatVersion 1 对应物）。
 *
 * 由 uom-tool2-portrait-predict 的模型包导出器生成：纯 Node 零依赖，拷走即用。
 *
 * 用法：
 *   import { predict } from './predict.mjs';
 *   const rows = predict([{ ${input.inputColumns[0] ?? 'fit'}: '...' }]);
 *
 * 输出键为扁平列名 \`<维度>__<标签>\`（与 manifest.usage.outputs 一一对应）。
 * 本模块**不提供任何 HTTP 端点**。
 */

// --- 特征组规格（数据，来自单一来源 V06_FEATURE_GROUPS）---
const SPEC = ${serializeSpec(groups)};

// --- 面料归一化规则（数据，来自单一来源 V06_FABRIC_RULES）---
const FABRIC_RULES = ${serializeFabricRules()}.map(([source, name]) => [new RegExp(source, 'i'), name]);

// --- 工艺/材质原子词分隔符（数据）---
const TOKEN_SEPARATOR = new RegExp(${JSON.stringify(V06_TOKEN_SEPARATOR_PATTERN)});

// --- 最终词表（折外全量样本统计；与折内 OOF 词表可能不同，见 manifest 说明）---
const FEATURE_NAMES = ${JSON.stringify(featureNames, null, 2)};

// --- 逐维度逐标签模型（确定性系数区）---
const MODELS = ${JSON.stringify(models, null, 2)};

const INPUT_COLUMNS = ${JSON.stringify(input.inputColumns)};
const OUTPUT_COLUMNS = ${JSON.stringify(input.outputColumns)};

function normalizeFabric(fabric) {
  const value = String(fabric ?? '').trim();
  if (!value) return 'unknown';
  for (const [pattern, name] of FABRIC_RULES) {
    if (pattern.test(value)) return name;
  }
  return 'other';
}

function extractTokens(row) {
  const tokens = new Map();
  const add = (name) => tokens.set(name, (tokens.get(name) ?? 0) + 1);
  for (const specs of Object.values(SPEC)) {
    for (const spec of specs) {
      const raw = String(row[spec.field] ?? '').trim();
      if (spec.kind === 'onehot') {
        if (raw) add(spec.prefix + raw);
      } else if (spec.kind === 'fabric') {
        const canonical = normalizeFabric(raw);
        if (canonical !== 'unknown') add(spec.prefix + canonical);
      } else {
        for (const part of raw.split(TOKEN_SEPARATOR)) {
          const token = part.trim();
          if (token) add(spec.prefix + token);
        }
      }
    }
  }
  return tokens;
}

function buildVector(row) {
  const tokens = extractTokens(row);
  return FEATURE_NAMES.map((name) => tokens.get(name) ?? 0);
}

function predictDimension(model, row) {
  const vector = buildVector(row);
  const raw = model.models.map((labelModel) => {
    let value = labelModel.b;
    for (let j = 0; j < vector.length; j += 1) {
      value += labelModel.w[j] * ((vector[j] - labelModel.mean[j]) / labelModel.std[j]);
    }
    return value;
  });
  const clipped = raw.map((value) => Math.max(0, value));
  const total = clipped.reduce((sum, value) => sum + value, 0);
  const distribution = {};
  model.labels.forEach((label, index) => {
    distribution[label] = total > 0 ? clipped[index] / total : 1 / model.labels.length;
  });
  return distribution;
}

/**
 * 预测：每行输入 → 每行输出（附加 \`<维度>__<标签>\` 扁平列）。
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Array<Record<string, number>>}
 */
export function predict(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [dimension, model] of Object.entries(MODELS)) {
      const distribution = predictDimension(model, row);
      for (const [label, share] of Object.entries(distribution)) {
        out[dimension + '__' + label] = share;
      }
    }
    return out;
  });
}

export const __contract = { formatVersion: 1, inputColumns: INPUT_COLUMNS, outputColumns: OUTPUT_COLUMNS };
`;
}
