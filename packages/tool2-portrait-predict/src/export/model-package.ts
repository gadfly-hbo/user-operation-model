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
 * - `manifest.model.stage` 随晋级**不回写**，Stage 以 Registry 为准（导出器只写初值）；
 * - **无 `/predict` 端点**：包只提供 `import { predict }`，不起 HTTP 服务。
 *
 * 本单**只产出与自校验**模型包，**不写进 model-mlflow**（登记属 P2-8，需另获授权）。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { V06_FEATURE_GROUPS } from '../pipeline/v06/lib/features-v06.js';
import type { V06ModelArtifact } from '../pipeline/v06/04-select-final.js';
import { renderV06PredictModule } from './predict-template.js';

/** 模型包的输入。 */
export interface V06ModelPackageInput {
  /** 最终模型工件（确定性系数区） */
  artifact: V06ModelArtifact;
  /** 指标（扁平标量，写进 `manifest.metrics`） */
  metrics: Record<string, number>;
  /** 数据指纹（宿主侧计算） */
  fingerprint: { sha256: string; rows: number; columns: string[] };
  /** 模型名（kebab-case） */
  name: string;
  /** 版本号（从 1 起） */
  version: number;
  /** Stage 初值（晋级不回写，Registry 为准） */
  stage?: string;
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
