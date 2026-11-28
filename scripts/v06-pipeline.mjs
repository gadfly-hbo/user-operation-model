#!/usr/bin/env node
/**
 * P2-6 / P2-7：v0.6 六阶段管线端到端实跑 + 模型包导出（本地运行，CI 不跑）。
 *
 * 门禁内容（对齐 P2 规格 M08 / M09）：
 *
 * ## 阶段 01–06（v0.6 六阶段）
 * 1. `prepare`：解析**归档固化**的 25Q4 intake（93 款正样本画像 + 商品信息表），
 *    fail-closed 校验 intake 校验清单、SKU 交叉核对、六维完整性。
 * 2. `folds`：读取**冻结**的 `folds.json` 作为输入并校验完整性（**不重生成**）。
 * 3. `ablation`：合规特征组消融阶梯 + 5 折 OOF，与**折内**账号均值基线逐款配对。
 * 4. `select`：二轮变体 → 按符号检验门槛选配置 → 全量最终模型 → 确定性工件。
 * 5. `evaluate`：指标、基线对照、验收矩阵（门槛结论如实记录）。
 * 6. `validate`：fail-closed 校验（含 V9 连跑字节一致、V12 基线折内独立复算）。
 *
 * ## 模型包导出（P2-7 / M09）
 * 产出 3 文件包（`predict.mjs` / `manifest.json` / `README.md`），`formatVersion: 1`，
 * `usage.outputs` 为扁平列 `<维度>__<标签>`，`data_sha256` 由宿主侧计算，
 * **无 HTTP 预测端点**。导出物落 `models/`（gitignore 区，不入库）。
 *
 * 缺固化数据 → **明确失败**，不跳过、不静默通过。
 * 本脚本只读本机文件，不访问网络；产物只落 gitignore 区。
 *
 * 用法：
 *   node scripts/v06-pipeline.mjs
 *   node scripts/v06-pipeline.mjs --root /path/to/data/archive-modelevol/v06-tmall-25q4
 *   UOM_V06_FIXED_ROOT=/path/to/v06-tmall-25q4 node scripts/v06-pipeline.mjs
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

/** 固化根（相对主仓）：v0.6 包在固化总根下的子目录。 */
const FIXED_ROOT_RELATIVE = join('data', 'archive-modelevol', 'v06-tmall-25q4');

/** 固化包内相对路径。 */
const INTAKE_RELATIVE = join('data', 'incoming', '2026-09-11-tmall-guanqi-25q4-portraits');
const FOLDS_RELATIVE = join(
  'experiments',
  '2026-09-11-v0.6-tmall-guanqi-portrait-only',
  'outputs',
  'folds.json',
);

/** 产物目录（gitignore 区）。 */
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'models', 'work-v06');
const DEFAULT_PACKAGE_DIR = join(REPO_ROOT, 'models', 'uom-tool2-portrait-v06', 'v1');

/** 解析命令行参数。 */
function parseArgs(argv) {
  const out = { root: undefined, out: DEFAULT_OUT_DIR, packageDir: DEFAULT_PACKAGE_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '-r') {
      const value = argv[i + 1];
      if (!value) throw new Error('--root 缺少参数');
      out.root = resolve(value);
      i += 1;
    } else if (arg.startsWith('--root=')) {
      out.root = resolve(arg.slice('--root='.length));
    } else if (arg === '--out') {
      const value = argv[i + 1];
      if (!value) throw new Error('--out 缺少参数');
      out.out = resolve(value);
      i += 1;
    } else if (arg.startsWith('--out=')) {
      out.out = resolve(arg.slice('--out='.length));
    } else if (arg === '--package-dir') {
      const value = argv[i + 1];
      if (!value) throw new Error('--package-dir 缺少参数');
      out.packageDir = resolve(value);
      i += 1;
    } else if (arg.startsWith('--package-dir=')) {
      out.packageDir = resolve(arg.slice('--package-dir='.length));
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return out;
}

/** 通过 git 公共目录定位主仓根（独立工作树场景下即主仓）。 */
function mainWorktreeRoot() {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!common) return undefined;
    return dirname(resolve(REPO_ROOT, common));
  } catch {
    return undefined;
  }
}

/** 目录是否是 v0.6 固化包根（含 intake 目录）。 */
function isV06PackageRoot(dir) {
  return existsSync(join(dir, INTAKE_RELATIVE));
}

/** 定位 v0.6 固化包根。 */
function resolveV06Root(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.UOM_V06_FIXED_ROOT) candidates.push(resolve(process.env.UOM_V06_FIXED_ROOT));
  if (process.env.UOM_ARCHIVE_FIXED_ROOT) {
    const total = resolve(process.env.UOM_ARCHIVE_FIXED_ROOT);
    candidates.push(total, join(total, 'v06-tmall-25q4'));
  }
  const mainRoot = mainWorktreeRoot();
  if (mainRoot) candidates.push(join(mainRoot, FIXED_ROOT_RELATIVE));
  candidates.push(join(REPO_ROOT, FIXED_ROOT_RELATIVE));

  for (const candidate of candidates) {
    if (isV06PackageRoot(candidate)) return candidate;
    const nested = join(candidate, 'v06-tmall-25q4');
    if (isV06PackageRoot(nested)) return nested;
  }
  return undefined;
}

/** 目录里唯一的 .xlsx（商品信息表）；多于一个即 fail-closed。 */
function discoverProductInfoXlsx(dir) {
  const files = readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.xlsx'));
  if (files.length !== 1) {
    fail(`FAIL 商品信息表目录应有且只有一个 .xlsx，实际 ${files.length} 个：${dir}`);
  }
  return join(dir, files[0]);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** 写 JSON（确定性：键序由构造顺序决定；缩进 2 空格）。 */
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`FAIL 参数错误：${error.message}`);
    return;
  }

  const fixedRoot = resolveV06Root(args.root);
  if (!fixedRoot) {
    fail(
      `FAIL 找不到 v0.6 固化数据。可用 --root <路径> 或环境变量 UOM_V06_FIXED_ROOT 指定` +
        `（期望目录含 ${INTAKE_RELATIVE}）。六阶段不允许在数据缺失时跳过。`,
    );
    return;
  }
  const intakeDir = join(fixedRoot, INTAKE_RELATIVE);
  const foldsPath = join(fixedRoot, FOLDS_RELATIVE);
  if (!existsSync(foldsPath)) {
    fail(`FAIL 冻结 folds 不存在：${foldsPath}`);
    return;
  }

  const pipelinePath = join(
    REPO_ROOT,
    'packages/tool2-portrait-predict/dist/src/index.js',
  );
  if (!existsSync(pipelinePath)) {
    fail(`FAIL 找不到构建产物 ${pipelinePath}，请先执行 npm run build。`);
    return;
  }

  const pipeline = await import(pipelinePath);
  const lines = [];
  const say = (line) => {
    lines.push(line);
    process.stdout.write(`${line}\n`);
  };

  say(`v0.6 六阶段管线实跑 · 固化根 ${fixedRoot}`);
  say('');

  // ---- 阶段 01：prepare ----
  const dataset = await pipeline.prepareV06Dataset({
    portraitDir: join(intakeDir, 'raw-portraits'),
    // 商品信息表文件名取自归档目录（文件名本身含店铺口径，不写进本仓库源码）：
    // raw-product-info 下有且只有一个 .xlsx，按目录发现取用。
    productInfoXlsx: discoverProductInfoXlsx(join(intakeDir, 'raw-product-info')),
    checksumsFile: join(intakeDir, 'checksums.sha256'),
    manifestFile: join(fixedRoot, 'experiments', '2026-09-11-v0.6-tmall-guanqi-portrait-only', 'data-manifest.json'),
  });
  say(`阶段 01 prepare · 样本 ${dataset.samples.length} 款 · intake 校验 ${dataset.intake.checksumEntries} 条 / 不匹配 ${dataset.intake.checksumMismatches} 条`);

  // ---- 阶段 02：folds（冻结输入） ----
  const foldsDoc = pipeline.loadFrozenV06Folds(foldsPath);
  const foldErrors = pipeline.validateV06Folds(foldsDoc, dataset.samples.map((s) => s.sku));
  if (foldErrors.length > 0) {
    fail(`FAIL-CLOSED: 冻结 folds 校验不过：${foldErrors.join('；')}`);
    return;
  }
  const foldsSha256 = createHash('sha256').update(readFileSync(foldsPath)).digest('hex');
  say(`阶段 02 folds · 冻结输入 ${foldsDoc.k} 折（${foldsDoc.foldSizes.join('/')}）· 分层键 ${foldsDoc.stratifyKey} · sha256 ${foldsSha256.slice(0, 16)}…`);

  // ---- 阶段 03：ablation ----
  const ablation = pipeline.runV06Ablation(dataset.samples, foldsDoc.folds, pipeline.V06_ABLATION_LADDER);
  for (const result of ablation) {
    say(
      `  消融 ${result.config.name} · js_lift ${result.macro.jsLift.toFixed(4)} · ` +
        `cos_lift ${result.macro.cosLift.toFixed(4)} · mae 降幅 ${result.macro.maeReduction.toFixed(4)} · ` +
        `加权 ${result.macro.weightedBusinessJsLift.toFixed(4)} · 全为正 ${result.macro.allDimensionsJsPositive} · 全显著 ${result.macro.allDimensionsJsSignificant}`,
    );
  }

  // ---- 阶段 04：select ----
  const variants = pipeline.runV06Ablation(dataset.samples, foldsDoc.folds, pipeline.V06_VARIANTS);
  for (const result of variants) {
    say(
      `  变体 ${result.config.name} · js_lift ${result.macro.jsLift.toFixed(4)} · ` +
        `全为正 ${result.macro.allDimensionsJsPositive} · 全显著 ${result.macro.allDimensionsJsSignificant}`,
    );
  }
  const selection = pipeline.selectV06FinalConfig(variants, 'degrade-with-record');
  const artifact = pipeline.trainV06FinalModel(dataset.samples, selection.winner);
  const coefficientHash = pipeline.v06CoefficientHash(artifact);
  say(`阶段 04 select · 选中 ${selection.winner.name} · 门槛结论 ${selection.gate} · 系数区 sha256 ${coefficientHash.slice(0, 16)}…`);

  // ---- 阶段 05：evaluate ----
  const metrics = pipeline.evaluateV06({
    experiment: dataset.experiment,
    sampleCount: dataset.samples.length,
    selection,
    ablation,
    variants,
    finalModel: {
      alphas: Object.fromEntries(artifact.coefficients.dimensionModels.map((m) => [m.labelType, m.alpha])),
      featureCounts: Object.fromEntries(
        artifact.coefficients.dimensionModels.map((m) => [m.labelType, m.featureNames.length]),
      ),
    },
    controlConfig: pipeline.V06_ABLATION_LADDER[0],
  });
  say(`阶段 05 evaluate · 宏平均 js_lift ${metrics.macro.jsLift.toFixed(4)} · 门槛 1 ${metrics.acceptance['gate1_all_dims_positive_significant']?.pass}`);
  for (const [gate, result] of Object.entries(metrics.acceptance)) {
    say(`  门槛 ${gate} · ${result.pass === null ? '由 06 判定' : result.pass ? 'PASS' : 'FAIL'}`);
  }

  // ---- 阶段 06：validate ----
  const foldBaselines = {};
  for (let fold = 0; fold < foldsDoc.folds.length; fold += 1) {
    const testSkus = foldsDoc.folds[fold];
    const trainSamples = dataset.samples.filter((s) => !testSkus.includes(s.sku));
    for (const dimension of pipeline.V06_TARGET_DIMENSIONS) {
      foldBaselines[`fold:${fold}:${dimension}`] = pipeline.v06AccountMeanBaseline(
        dimension,
        trainSamples,
      );
    }
  }
  const checks = pipeline.validateV06({
    dataset,
    folds: foldsDoc,
    selection,
    artifact,
    metrics,
    rerunFinalTraining: () => pipeline.trainV06FinalModel(dataset.samples, selection.winner),
    checksumsFile: join(intakeDir, 'checksums.sha256'),
    frozenFoldsSha256: foldsSha256,
    actualFoldsSha256: foldsSha256,
    foldBaselines,
  });
  say('阶段 06 validate：');
  let failed = 0;
  for (const check of checks) {
    if (check.result !== 'pass') failed += 1;
    say(`  ${check.id} ${check.result === 'pass' ? 'PASS' : 'FAIL'} · ${check.check}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  // ---- 产物落盘（gitignore 区） ----
  mkdirSync(args.out, { recursive: true });
  const datasetPath = join(args.out, 'dataset.json');
  writeJson(datasetPath, dataset);
  writeJson(join(args.out, 'ablation-results.json'), {
    ladder: ablation.map((result) => ({
      config: result.config.name,
      groups: result.config.groups,
      macro: result.macro,
      perDimension: result.perDimension,
      foldStability: result.foldStability,
      featureCounts: result.featureCounts,
    })),
    variants: variants.map((result) => ({
      config: result.config.name,
      groups: result.config.groups,
      macro: result.macro,
      perDimension: result.perDimension,
      foldStability: result.foldStability,
    })),
  });
  writeJson(join(args.out, 'model-artifact.json'), artifact);
  writeJson(join(args.out, 'metrics.json'), metrics);
  writeJson(join(args.out, 'baseline-comparison.json'), pipeline.buildV06BaselineComparison(metrics));
  writeJson(join(args.out, 'validation.json'), { checks, selection: { winner: selection.winner, gate: selection.gate } });

  // ---- 模型包导出（P2-7） ----
  const inputColumns = [
    ...new Set(
      selection.winner.groups.flatMap((group) =>
        pipeline.V06_FEATURE_GROUPS[group].map((spec) => spec.field),
      ),
    ),
  ].sort();
  const fingerprint = {
    sha256: createHash('sha256').update(readFileSync(datasetPath)).digest('hex'),
    rows: dataset.samples.length,
    columns: inputColumns,
  };
  const flatMetrics = {
    macro_js_lift: metrics.macro.jsLift,
    macro_cos_lift: metrics.macro.cosLift,
    macro_mae_reduction: metrics.macro.maeReduction,
    macro_weighted_business_js_lift: metrics.macro.weightedBusinessJsLift,
    ...Object.fromEntries(
      Object.entries(metrics.perDimension).flatMap(([dimension, item]) => [
        [`${dimension}__js_lift`, item.jsLift],
        [`${dimension}__base_js`, item.baseJs],
        [`${dimension}__sign_test_p`, item.jsLiftSign.p],
      ]),
    ),
  };
  rmSync(args.packageDir, { recursive: true, force: true });
  const written = pipeline.writeV06ModelPackage(
    {
      artifact,
      metrics: flatMetrics,
      fingerprint,
      // 门槛结论证据：全部来自本次管线实跑的阶段 04／05／06 结果（不手写数值），
      // 由导出器派生进 manifest.gateConclusion（P2-8 登记前置：门槛未过如实入包，Stage 只到 Staging）。
      gateConclusion: {
        selection,
        acceptance: metrics.acceptance,
        macroJsLift: metrics.macro.jsLift,
        validationChecks: checks,
        frozenFoldsSha256: foldsSha256,
        coefficientRegionSha256: coefficientHash,
      },
      name: 'uom-tool2-portrait-v06',
      version: 1,
      stage: 'Staging',
      goal: '商品客观属性 → 六维人群画像分布（v0.6 六阶段管线移植，§9.2 合规特征集）',
      splitSeed: foldsDoc.seed,
      sessionRef: 'p2-6-p2-7',
      trainedAt: artifact.provenance.trainedAt,
      method:
        'v0.6 六阶段管线（prepare→folds→ablation→select→evaluate→validate）移植；' +
        '逐维度逐标签 one-vs-rest Ridge（唯一 Cholesky 求解器），折内 alpha 选择；' +
        '§9.2 合规特征集；后处理为负值截断 + 按维度归一化。',
    },
    args.packageDir,
    { overwrite: true },
  );
  say(`模型包导出 · ${written.dir} · ${Object.keys(written.filePaths).length} 个文件`);

  say('');
  say(`产物目录 ${args.out}`);
  if (failed > 0) {
    fail(`\nFAIL-CLOSED: 阶段 06 有 ${failed} 条校验未通过。`);
    return;
  }
  say('六阶段实跑通过：fail-closed 校验全部 PASS。');
}

await main();
