/**
 * 模型包导出器（对齐 model-mlflow 的消费契约）。
 *
 * 依据：
 * - P2 规格 §1「Node 模型包导出器」与 §2.6「model-mlflow 契约」。
 * - 工程规范 §8.2「model-mlflow（Model Pack Studio）」：只消费不改造。
 * - model-mlflow 的组包契约（只读参考：`~/Dev/Projects/model-mlflow/skills/model-training/scripts/build-package.mjs`
 *   与 `workspace/exports/<name>/vN/` 的实际产物）。
 *
 * ## 契约要点
 *
 * - 包 = **恰好 3 个文件**：`predict.mjs` / `manifest.json` / `README.md`；
 * - `manifest.formatVersion` = **1**（读侧强校验）；
 * - `manifest.data.fingerprint.sha256` 由**宿主侧**对原始输入计算（导出器即宿主侧组包器），
 *   同时登记 `rows` / `columns`；
 * - `manifest.usage.outputs` 为**扁平标量列**：每个 (维度, 标签) 一列，列名 `<维度>__<标签>`；
 * - `manifest.gateConclusion` 由管线阶段 04／05／06 的**实际结果**派生（选中变体、门槛总判定、
 *   逐门槛结果、gate5 由 V1–V12 判定、宏平均 js_lift、系数区／冻结 folds 双 sha256、
 *   「Stage 上限 Staging，晋级需 P2-13 真实数据重训并另获授权」），缺任一证据即抛错；
 * - `manifest.model.stage` 只写初值 `Staging` 且随晋级**不回写**，Stage 以 Registry 为准；
 * - **无 `/predict` 端点**：包只提供 `import { predict }`，不起 HTTP 服务。
 *
 * 本单产出与自校验模型包；写入 model-mlflow 账本属 P2-8（用户 2026-11-28 已授权，Stage 只到 Staging）。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { V06_FEATURE_GROUPS } from '../pipeline/v06/lib/features-v06.js';
import type { V06ModelArtifact, V06SelectionGate } from '../pipeline/v06/04-select-final.js';
import type { V06ValidationCheck } from '../pipeline/v06/06-validate.js';
import { renderV06PredictModule } from './predict-template.js';

/** 模型包的输入。 */
export interface V06ModelPackageInput {
  /** 最终模型工件（确定性系数区） */
  artifact: V06ModelArtifact;
  /** 指标（扁平标量，写进 `manifest.metrics`） */
  metrics: Record<string, number>;
  /** 数据指纹（宿主侧计算） */
  fingerprint: { sha256: string; rows: number; columns: string[] };
  /**
   * 门槛结论证据（**必填**）：由管线阶段 04／05／06 的实际结果组装；
   * 导出器只从这份结构化证据**派生** manifest 的门槛结论，缺任一项即抛错。
   * 登记属 P2-8 的前置条件：门槛未过必须如实写进 manifest，Stage 只到 Staging。
   */
  gateConclusion: V06GateConclusionInput;
  /** 模型名（kebab-case） */
  name: string;
  /** 版本号（从 1 起） */
  version: number;
  /** Stage 初值：**只允许 Staging**（晋级走 model-mlflow Registry，且需 P2-13 后另获授权） */
  stage?: 'Staging';
  /** 训练目标说明 */
  goal?: string;
  /** 切分种子 */
  splitSeed?: number;
  /** 来源会话标识 */
  sessionRef?: string;
  /** 训练时间（进 manifest 的 `training.trainedAt`，不进系数区） */
  trainedAt?: string;
  /** 方法说明（进 README） */
  method?: string;
}

/** 门槛证据：选择结果（阶段 04）+ 验收矩阵（阶段 05）+ 校验结论（阶段 06）+ 双哈希。 */
export interface V06GateConclusionInput {
  /** 阶段 04 的选择结果（只取胜出配置名与门槛总判定） */
  selection: { winner: { name: string }; gate: V06SelectionGate };
  /** 阶段 05 验收矩阵（gate1–gate4 已判定；gate5 的 pass 为 null，由阶段 06 判定） */
  acceptance: Record<string, { pass: boolean | null }>;
  /** 宏平均 JS 提升（阶段 05 实测值） */
  macroJsLift: number;
  /** 阶段 06 fail-closed 校验结论（V1–V12；gate5 由这组判定；导出器只读 id 与 result） */
  validationChecks: ReadonlyArray<Pick<V06ValidationCheck, 'id' | 'result'>>;
  /** 冻结 folds 文件 sha256（V4 比对值） */
  frozenFoldsSha256: string;
  /** 确定性系数区 sha256（V9 比对值） */
  coefficientRegionSha256: string;
}

/** 产出的模型包（3 个文件的内容）。 */
export interface V06ModelPackage {
  files: {
    'predict.mjs': string;
    'manifest.json': string;
    'README.md': string;
  };
  manifest: Record<string, unknown>;
}

/** 模型名合法性（对齐 model-mlflow 的 `^[a-z][a-z0-9-]{1,40}$`）。 */
const MODEL_NAME_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;

/** 从工件的选中配置推导输入列（白名单客观属性，按字典序去重）。 */
function deriveInputColumns(artifact: V06ModelArtifact): string[] {
  const columns = new Set<string>();
  for (const group of artifact.coefficients.selectedConfig.groups) {
    const specs = V06_FEATURE_GROUPS[group];
    if (!specs) throw new Error(`未知特征组：${group}`);
    for (const spec of specs) columns.add(spec.field);
  }
  return [...columns].sort();
}

/** 扁平输出列（每个 (维度, 标签) 一列）。 */
function deriveOutputColumns(artifact: V06ModelArtifact): string[] {
  return artifact.coefficients.dimensionModels.flatMap((model) =>
    model.labels.map((label) => `${model.labelType}__${label}`),
  );
}

/** 阶段 05 验收矩阵的固定门槛键（与 05-evaluate.ts 的 `acceptance` 键一致）。 */
const GATE_KEYS = [
  'gate1_all_dims_positive_significant',
  'gate2_high_variability_dims',
  'gate3_expansion_gain_over_control',
  'gate4_fold_stability',
  'gate5_frozen_inputs_and_fail_closed',
] as const;

/** 阶段 05 的判定结果 → PASS／FAIL；未判定（null/缺失）即抛错，不静默。 */
function gateResultLabel(pass: boolean | null | undefined, key: string): 'PASS' | 'FAIL' {
  if (pass === true) return 'PASS';
  if (pass === false) return 'FAIL';
  throw new Error(`门槛结论未判定：${key} 的 pass 为 ${pass}——登记前必须有阶段 05 的判定结果`);
}

/** manifest 的门槛结论块（全部字段由管线证据派生，见 `deriveGateConclusion`）。 */
export interface V06GateConclusion {
  selectedVariant: string;
  selectionGate: V06SelectionGate;
  macroJsLift: number;
  perGate: Record<string, 'PASS' | 'FAIL'>;
  gate5DeterminedBy: string;
  frozenFoldsSha256: string;
  coefficientRegionSha256: string;
  stageCeiling: 'Staging';
  promotionPolicy: string;
}

/**
 * 从管线实际结果派生 manifest 的门槛结论块。
 * 所有数值均来自传入的阶段 04／05／06 证据结构，本函数**不手写**任何数值或自由文本；
 * 缺任一必需证据（总判定、逐门槛矩阵、阶段 06 校验、双哈希）即抛错（缺结论即失败）。
 */
function deriveGateConclusion(input: V06GateConclusionInput): V06GateConclusion {
  const knownGates: ReadonlySet<string> = new Set(['PASS', 'FAIL_SIGNIFICANCE', 'FAIL_NOT_POSITIVE']);
  if (!knownGates.has(input.selection.gate)) {
    throw new Error(
      `门槛总判定必须是 PASS／FAIL_SIGNIFICANCE／FAIL_NOT_POSITIVE：${String(input.selection.gate)}`,
    );
  }
  if (!input.selection.winner?.name) {
    throw new Error('门槛结论缺失：缺选中变体（selection.winner.name）');
  }
  if (!Number.isFinite(input.macroJsLift)) {
    throw new Error(`门槛结论缺失：宏平均 js_lift 不是有限数值：${String(input.macroJsLift)}`);
  }
  for (const key of ['frozenFoldsSha256', 'coefficientRegionSha256'] as const) {
    if (!/^[0-9a-f]{64}$/.test(input[key])) {
      throw new Error(`门槛结论缺失：${key} 必须是 64 位十六进制 sha256`);
    }
  }
  if (!Array.isArray(input.validationChecks) || input.validationChecks.length === 0) {
    throw new Error('门槛结论缺失：没有阶段 06 校验结论，gate5 无法由 V1–V12 判定');
  }

  const perGate: Record<string, 'PASS' | 'FAIL'> = {};
  for (const key of GATE_KEYS) {
    if (key === 'gate5_frozen_inputs_and_fail_closed') continue; // gate5 不取自阶段 05，由阶段 06 判定
    const entry = input.acceptance?.[key];
    if (!entry) throw new Error(`门槛结论缺失：阶段 05 验收矩阵缺 ${key}`);
    perGate[key] = gateResultLabel(entry.pass, key);
  }
  const failedChecks = input.validationChecks.filter((check) => check.result !== 'pass');
  perGate['gate5_frozen_inputs_and_fail_closed'] = failedChecks.length === 0 ? 'PASS' : 'FAIL';

  return {
    selectedVariant: input.selection.winner.name,
    selectionGate: input.selection.gate,
    macroJsLift: input.macroJsLift,
    perGate,
    gate5DeterminedBy: `阶段 06 校验 V1-V12 判定（${input.validationChecks.length - failedChecks.length}/${input.validationChecks.length} pass）`,
    frozenFoldsSha256: input.frozenFoldsSha256,
    coefficientRegionSha256: input.coefficientRegionSha256,
    stageCeiling: 'Staging',
    promotionPolicy:
      'Stage 上限 Staging；本包由归档数据训练且门槛未过，晋级 Production 需 P2-13（用户真实数据重训过生产门）并另获用户授权（晋级走 model-mlflow Registry，不回写本包 manifest）',
  };
}

/** 产出模型包的 3 个文件内容。 */
export function buildV06ModelPackage(input: V06ModelPackageInput): V06ModelPackage {
  if (!MODEL_NAME_PATTERN.test(input.name)) {
    throw new Error(`模型名必须匹配 ^[a-z][a-z0-9-]{1,40}$：${input.name}`);
  }
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error(`模型版本必须是 ≥1 的整数：${input.version}`);
  }
  if (!/^[0-9a-f]{64}$/.test(input.fingerprint.sha256)) {
    throw new Error(`data_sha256 必须是 64 位十六进制 sha256：${input.fingerprint.sha256}`);
  }
  if (!input.gateConclusion) {
    throw new Error(
      '门槛结论缺失：模型包登记（P2-8）前必须带管线门槛结论（gateConclusion，来自阶段 04／05／06 实际结果）',
    );
  }
  if (input.stage !== undefined && input.stage !== 'Staging') {
    throw new Error(
      `Stage 上限 Staging：晋级 Production 需 P2-13 真实数据重训并另获用户授权（且由 model-mlflow Registry 晋级完成），不得在导出时写 ${input.stage}`,
    );
  }
  const gateConclusion = deriveGateConclusion(input.gateConclusion);

  const inputColumns = deriveInputColumns(input.artifact);
  const outputColumns = deriveOutputColumns(input.artifact);

  const predictSource = renderV06PredictModule({
    artifact: input.artifact,
    inputColumns,
    outputColumns,
  });

  const manifest: Record<string, unknown> = {
    formatVersion: 1,
    model: { name: input.name, version: input.version, stage: input.stage ?? 'Staging' },
    goal: input.goal ?? '',
    data: { fingerprint: input.fingerprint },
    metrics: input.metrics,
    gateConclusion,
    training: {
      splitSeed: input.splitSeed ?? null,
      task: 'multi_distribution_regression',
      targets: outputColumns,
      trainedAt: input.trainedAt ?? new Date().toISOString(),
      sessionRef: input.sessionRef ?? '',
    },
    usage: {
      inputs: inputColumns,
      outputs: outputColumns,
      form: 'predict(rows) -> rows',
    },
  };

  const metricLines = Object.entries(input.metrics)
    .map(([key, value]) => `- \`${key}\`: ${typeof value === 'number' ? Number(value.toFixed(6)) : String(value)}`)
    .join('\n');

  const gateLines = Object.entries(gateConclusion.perGate)
    .map(([key, value]) => `- \`${key}\`: **${value}**`)
    .join('\n');

  const readme = `# ${input.name} v${input.version}

自包含模型包（formatVersion 1）：纯 Node 零依赖，拷走即用，不依赖 MLflow。

## 加载用法

\`\`\`js
import { predict } from "./predict.mjs";
const rows = predict([{ ${inputColumns[0] ?? 'fit'}: "..." }]);
// → 每行附加 ${outputColumns.slice(0, 2).map((c) => `"${c}"`).join(', ')} 等扁平列
\`\`\`

本包**不提供任何 HTTP 预测端点**（无路由、无监听、无鉴权）；如需 HTTP 暴露，由本项目侧另建薄适配层。

## 输入列（§9.2 白名单客观属性）

${inputColumns.map((column) => `- \`${column}\``).join('\n')}

## 输出列（每个「维度__标签」一列）

${outputColumns.map((column) => `- \`${column}\``).join('\n')}

## 指标

${metricLines || '- （无）'}

## 门槛结论（由管线阶段 04／05／06 实际结果生成，如实记录、未放宽）

- 选中配置: \`${String(gateConclusion.selectedVariant)}\`
- 门槛总判定: **${String(gateConclusion.selectionGate)}**（宏平均 js_lift ${String(gateConclusion.macroJsLift)}）
${gateLines}
- ${String(gateConclusion.gate5DeterminedBy)}
- 系数区 sha256: \`${String(gateConclusion.coefficientRegionSha256)}\`
- 冻结 folds sha256: \`${String(gateConclusion.frozenFoldsSha256)}\`

**${String(gateConclusion.promotionPolicy)}**

## 数据指纹

- sha256: \`${input.fingerprint.sha256}\`
- 行数 × 列数: ${input.fingerprint.rows} × ${input.fingerprint.columns.length}（列名见 manifest）

## 训练

- 切分种子: ${input.splitSeed ?? '—'}
- 目标: ${input.goal || '—'}
- 来源会话: ${input.sessionRef || '—'}

## 方法说明

${input.method || '（未提供）'}

## 口径与限制

- Stage 以 model-mlflow 的 **Registry** 为准；包内 \`manifest.model.stage\` 晋级时不回写。
- 后处理为 v0.6 口径：**负值截断为 0 → 按维度归一化**（不含 v0.4 的 softmax + 温度校准）。
- 特征集为 §9.2 合规白名单，不含 FAB 卖点、心智产品、记忆点、群组打标、性别修正等人工判断字段。
- 词表为**最终（全量样本）词表**，与折内 OOF 词表可能不同。
`;

  return {
    files: {
      'predict.mjs': predictSource,
      'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
      'README.md': readme,
    },
    manifest,
  };
}

/** 把模型包写到目标目录（目录会被创建；同名文件已存在即抛错，避免静默覆盖）。 */
export function writeV06ModelPackage(
  input: V06ModelPackageInput,
  outDir: string,
  options?: { overwrite?: boolean },
): { dir: string; filePaths: Record<string, string> } {
  const built = buildV06ModelPackage(input);
  mkdirSync(outDir, { recursive: true });
  const filePaths: Record<string, string> = {};
  for (const [name, content] of Object.entries(built.files)) {
    const path = join(outDir, name);
    if (existsSync(path) && !options?.overwrite) {
      throw new Error(`模型包文件已存在，拒绝静默覆盖：${path}`);
    }
    writeFileSync(path, content, 'utf8');
    filePaths[name] = path;
  }
  return { dir: outDir, filePaths };
}
