#!/usr/bin/env node
/**
 * P2-8：把 B 步产出的模型包登记进 model-mlflow 账本（用户 2026-11-28 已授权写入账本）。
 *
 * 登记入口 = model-mlflow 既有的 **本地 MLflow REST 账本**（与 Studio Host finalize 走同一入口，
 * 见 model-mlflow `services/studio-api/src/chat/pipeline.ts` 的登记序列与
 * `skills/model-training/scripts/build-package.mjs` 的包契约）。本脚本**只新增本次条目**，
 * **不修改 model-mlflow 的代码本体、配置或既有账本条目**（工程规范 §8.2「只消费不改造」）。
 *
 * 与 finalize 相同的登记序列（确定性的账本写动作）：
 *   1. ensureExperiment('mps-chat-training')（Studio 的唯一 experiment）
 *   2. createRun + logBatch(params: data_sha256/data_rows/data_columns/… + **门槛结论逐项**)
 *   3. ensureRegisteredModel → 版本号 = 既有最大版本 + 1
 *   4. 3 文件包落到 model-mlflow 的交付路径 `workspace/exports/<name>/v<version>/`
 *   5. 包拷入 run artifacts（`packages/<name>-v<version>/`，本地 file:// 直拷）
 *   6. createModelVersion(source=工件子目录 URI, run_id) → transition-stage **Staging**
 *   7. updateRun FINISHED；读回 Registry 核对 Stage 与包字节
 *
 * 登记前置校验（fail-closed，任一不过即退出非 0、run 置 FAILED）：
 *   - `--url`／`MPS_MLFLOW_URL` 必须是本机回环（127.0.0.1／localhost／::1，复核修单 S5）；
 *   - 包恰好 3 文件（predict.mjs / manifest.json / README.md）；
 *   - `formatVersion === 1`、`model.stage === 'Staging'`；
 *   - `manifest.gateConclusion` 存在且与管线产物（`models/work-v06/`）一致——门槛未过必须如实入账；
 *   - **复核修单 R2-S1**：包内 `gateConclusion.validationChecks` 与管线产物 `validation.json` 的
 *     checks 必须 **V1–V12 齐全且全部 pass 且逐条一致**，`gate5` 派生结论为 PASS——
 *     阶段 06 有 FAIL 的失败包一律拒绝登记（不能只看调用方传参）；
 *   - `data.fingerprint.sha256` 与宿主侧对原始输入（`models/work-v06/dataset.json`）的独立重算一致。
 *
 * Stage 只到 **Staging**：晋级 Production 需 P2-13 真实数据重训并另获用户授权（走 Registry 晋级）。
 * 本脚本只读本机文件、只访问 127.0.0.1 的本地 MLflow；业务数据不出网（工程规范 §7）。
 *
 * 用法：
 *   node scripts/register-model-mlflow.mjs \
 *     [--package models/uom-tool2-portrait-v06/v1] \
 *     [--work models/work-v06] \
 *     [--url http://127.0.0.1:5021] \
 *     [--mlflow-root ~/Dev/Projects/model-mlflow]
 */

import { createHash } from 'node:crypto';
import { existsSync, copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const PACKAGE_FILES = ['predict.mjs', 'manifest.json', 'README.md'];
const EXPERIMENT_NAME = 'mps-chat-training';

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    packageDir: join(REPO_ROOT, 'models', 'uom-tool2-portrait-v06', 'v1'),
    workDir: join(REPO_ROOT, 'models', 'work-v06'),
    url: process.env.MPS_MLFLOW_URL ?? 'http://127.0.0.1:5021',
    mlflowRoot: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--package') { out.packageDir = resolve(value); i += 1; }
    else if (arg === '--work') { out.workDir = resolve(value); i += 1; }
    else if (arg === '--url') { out.url = value; i += 1; }
    else if (arg === '--mlflow-root') { out.mlflowRoot = resolve(value); i += 1; }
    else fail(`未知参数：${arg}`);
  }
  return out;
}

/** 通过 git 公共目录定位主仓根（独立工作树场景下即主仓）。 */
function mainWorktreeRoot() {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!common) return undefined;
    return dirname(resolve(REPO_ROOT, common));
  } catch {
    return undefined;
  }
}

/** model-mlflow 仓根：显式参数 > 环境变量 > 主仓同级目录探测。 */
function resolveMlflowRoot(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.UOM_MODEL_MLFLOW_ROOT) candidates.push(resolve(process.env.UOM_MODEL_MLFLOW_ROOT));
  for (const base of [mainWorktreeRoot(), REPO_ROOT]) {
    if (base) candidates.push(join(dirname(base), 'model-mlflow'));
  }
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'workspace'))) return candidate;
  }
  fail(
    `找不到 model-mlflow 仓根（需含 workspace/）。用 --mlflow-root <路径> 或 UOM_MODEL_MLFLOW_ROOT 指定。` +
    `登记是写动作，不定位到仓根就不执行。`,
  );
}

async function mlflowApi(url, path, body, method = 'POST') {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`mlflow ${path} -> ${res.status} ${json.error_code ?? ''} ${json.message ?? ''}`.trim());
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mlflowRoot = resolveMlflowRoot(args.mlflowRoot);

  // ---- 复核修单 S5：登记地址只允许本机回环（在任何请求发出之前） ----
  let assertLoopbackMlflowUrl;
  let assertStage06ChecksRegistrable;
  try {
    ({ assertLoopbackMlflowUrl } = await import(
      pathToFileURL(join(REPO_ROOT, 'packages/tool2-portrait-predict/dist/src/register/url-guard.js')).href
    ));
    ({ assertStage06ChecksRegistrable } = await import(
      pathToFileURL(join(REPO_ROOT, 'packages/tool2-portrait-predict/dist/src/register/validation-gate.js')).href
    ));
  } catch {
    fail('无法加载 url-guard／validation-gate（请先 npm run build）——登记守卫缺位时拒绝登记（fail-closed）');
  }
  try {
    assertLoopbackMlflowUrl(args.url);
  } catch (error) {
    fail(error.message);
  }

  // ---- 登记前置校验（fail-closed） ----
  const missing = PACKAGE_FILES.filter((file) => !existsSync(join(args.packageDir, file)));
  if (missing.length > 0) fail(`模型包不完整，缺 ${missing.join('/')}：${args.packageDir}`);
  const extra = readdirSync(args.packageDir).filter((file) => !PACKAGE_FILES.includes(file));
  if (extra.length > 0) fail(`模型包应为恰好 3 文件，多出：${extra.join('/')}`);
  const manifest = JSON.parse(readFileSync(join(args.packageDir, 'manifest.json'), 'utf8'));
  if (manifest.formatVersion !== 1) fail(`manifest.formatVersion 必须为 1，实际 ${manifest.formatVersion}`);
  if (manifest.model.stage !== 'Staging') {
    fail(`Stage 只到 Staging（晋级需 P2-13 另获授权），包内 stage=${manifest.model.stage}`);
  }
  const gates = manifest.gateConclusion;
  if (!gates) fail('manifest 缺门槛结论（gateConclusion）——门槛未过必须如实入账，拒绝登记');

  // ---- 复核修单 R2-S1：候选包的阶段 06 校验记录必须 V1–V12 全 PASS（任一非 PASS 即拒绝） ----
  // 依据是包内 manifest 自带的校验记录（由导出器从管线阶段 06 实际结果派生），
  // 不是调用方传参；gate5 的派生结论必须与之相符。
  if (!Array.isArray(gates.validationChecks)) {
    fail('manifest.gateConclusion.validationChecks 缺失或不是数组——无法核验 V1–V12 全 PASS，拒绝登记');
  }
  try {
    assertStage06ChecksRegistrable(gates.validationChecks, 'manifest.gateConclusion.validationChecks');
  } catch (error) {
    fail(error.message);
  }
  if (gates.perGate?.gate5_frozen_inputs_and_fail_closed !== 'PASS') {
    fail(
      `manifest gate5（gate5_frozen_inputs_and_fail_closed）必须为 PASS 才可登记，实际 ` +
        `${String(gates.perGate?.gate5_frozen_inputs_and_fail_closed)}——校验失败包不得登记`,
    );
  }

  // data_sha256 宿主侧独立重算（对原始输入 dataset.json）
  const datasetPath = join(args.workDir, 'dataset.json');
  if (!existsSync(datasetPath)) fail(`找不到管线原始输入 ${datasetPath}，无法独立核对 data_sha256`);
  const recomputedDataSha = createHash('sha256').update(readFileSync(datasetPath)).digest('hex');
  if (recomputedDataSha !== manifest.data.fingerprint.sha256) {
    fail(`data_sha256 不一致：manifest=${manifest.data.fingerprint.sha256} 宿主重算=${recomputedDataSha}`);
  }

  // 门槛结论与管线产物一致性（models/work-v06/validation.json 由阶段 06 写出）
  const validationPath = join(args.workDir, 'validation.json');
  if (existsSync(validationPath)) {
    const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
    if (validation.selection?.gate !== gates.selectionGate) {
      fail(`门槛总判定与管线产物不一致：manifest=${gates.selectionGate} 管线=${validation.selection?.gate}`);
    }
    if (validation.selection?.winner?.name !== gates.selectedVariant) {
      fail(`选中变体与管线产物不一致：manifest=${gates.selectedVariant} 管线=${validation.selection?.winner?.name}`);
    }
    // 复核修单 R2-S1：管线校验产物同样必须全 PASS，且与包内记录逐条一致
    //（包被换过而产物没换——或反之——都会在这里现形）。
    if (!Array.isArray(validation.checks)) {
      fail(`管线校验产物 ${validationPath} 缺 checks 数组，无法核验阶段 06 结论`);
    }
    try {
      assertStage06ChecksRegistrable(validation.checks, `管线产物 ${validationPath}`);
    } catch (error) {
      fail(error.message);
    }
    const manifestRecords = gates.validationChecks.map((check) => `${check.id}=${check.result}`).join(',');
    const pipelineRecords = validation.checks.map((check) => `${check.id}=${check.result}`).join(',');
    if (manifestRecords !== pipelineRecords) {
      fail(
        `阶段 06 校验记录与管线产物不一致：\n  manifest: ${manifestRecords}\n  管线:     ${pipelineRecords}`,
      );
    }
  } else {
    fail(`找不到管线校验产物 ${validationPath}，门槛结论无法与管线结果核对`);
  }

  // ---- 登记序列（与 finalize 相同的入口） ----
  const modelName = manifest.model.name;
  const url = args.url;

  const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!health?.ok) {
    fail(`本地 MLflow 账本不可达：${url}/health。请先用 model-mlflow 启动器供给证据层` +
         `（workspace/spikes/mlflow-chain/.venv 的 mlflow 3.16.1，store=workspace/mlflow/mlflow.db，端口 5021）。`);
  }

  // 1. experiment（Studio 唯一 experiment）
  const search = await mlflowApi(url, `/api/2.0/mlflow/experiments/search?max_results=5&filter=${encodeURIComponent(`name = '${EXPERIMENT_NAME}'`)}`, undefined, 'GET');
  let experimentId = search.experiments?.find((e) => e.name === EXPERIMENT_NAME)?.experiment_id;
  if (!experimentId) {
    experimentId = (await mlflowApi(url, '/api/2.0/mlflow/experiments/create', { name: EXPERIMENT_NAME })).experiment_id;
  }

  // 2. run + params（含门槛结论逐项）+ metrics
  const runName = `${modelName}-p2-8`;
  const runId = (await mlflowApi(url, '/api/2.0/mlflow/runs/create', {
    experiment_id: experimentId,
    run_name: runName,
    start_time: Date.now(),
  })).run.info.run_id;

  const toParam = (key, value) => ({ key, value: String(value) });
  const params = [
    toParam('data_sha256', manifest.data.fingerprint.sha256),
    toParam('data_rows', manifest.data.fingerprint.rows),
    toParam('data_columns', JSON.stringify(manifest.data.fingerprint.columns)),
    toParam('split_seed', manifest.training.splitSeed),
    toParam('task', manifest.training.task),
    toParam('targets', JSON.stringify(manifest.training.targets)),
    toParam('model_name', modelName),
    toParam('goal', manifest.goal),
    toParam('session', manifest.training.sessionRef),
    // ---- 门槛结论（如实入账：门槛未过 → Stage 只到 Staging） ----
    toParam('selected_variant', gates.selectedVariant),
    toParam('selection_gate', gates.selectionGate),
    toParam('macro_js_lift', gates.macroJsLift),
    ...Object.entries(gates.perGate).map(([key, value]) => toParam(`gate_${key}`, value)),
    toParam('gate5_determined_by', gates.gate5DeterminedBy),
    toParam('frozen_folds_sha256', gates.frozenFoldsSha256),
    toParam('coefficient_region_sha256', gates.coefficientRegionSha256),
    toParam('stage_ceiling', gates.stageCeiling),
    toParam('promotion_policy', gates.promotionPolicy),
    toParam('package_source', 'user-operation-model scripts/v06-pipeline.mjs (P2 移植，归档固化数据)'),
  ];
  const metrics = Object.entries(manifest.metrics)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => ({ key, value, timestamp: Date.now(), step: 0 }));
  await mlflowApi(url, '/api/2.0/mlflow/runs/log-batch', { run_id: runId, params, metrics });

  const failRun = async (message) => {
    await mlflowApi(url, '/api/2.0/mlflow/runs/update', { run_id: runId, status: 'FAILED', end_time: Date.now() }).catch(() => {});
    fail(`${message}（run 已置 FAILED，无假成功）`);
  };

  try {
    // 3. Registry：RegisteredModel + 版本号 = 既有最大 + 1
    try {
      await mlflowApi(url, '/api/2.0/mlflow/registered-models/create', { name: modelName });
    } catch (error) {
      if (!String(error.message).includes('RESOURCE_ALREADY_EXISTS')) throw error;
    }
    const versions = (await mlflowApi(
      url,
      `/api/2.0/mlflow/model-versions/search?max_results=100&filter=${encodeURIComponent(`name='${modelName}'`)}`,
      undefined,
      'GET',
    )).model_versions ?? [];
    const version = versions.reduce((max, v) => Math.max(max, Number(v.version)), 0) + 1;

    // 4. 交付路径：workspace/exports/<name>/v<version>/（3 文件，先清后写）
    const packageDir = join(mlflowRoot, 'workspace', 'exports', modelName, `v${version}`);
    rmSync(packageDir, { recursive: true, force: true });
    mkdirSync(packageDir, { recursive: true });
    for (const file of PACKAGE_FILES) copyFileSync(join(args.packageDir, file), join(packageDir, file));

    // 5. 包入 run artifacts（本地 file:// 直拷，与 finalize 相同）
    const runInfo = (await mlflowApi(url, `/api/2.0/mlflow/runs/get?run_id=${encodeURIComponent(runId)}`, undefined, 'GET')).run.info;
    const artifactRoot = runInfo.artifact_uri.startsWith('file://')
      ? new URL(runInfo.artifact_uri).pathname
      : runInfo.artifact_uri;
    const relDir = `packages/${modelName}-v${version}`;
    const artifactChildDir = join(artifactRoot, relDir);
    mkdirSync(artifactChildDir, { recursive: true });
    for (const file of PACKAGE_FILES) copyFileSync(join(args.packageDir, file), join(artifactChildDir, file));
    const artifactChildUri = `${runInfo.artifact_uri.replace(/\/$/, '')}/${relDir}`;

    // 6. Model Version + Staging
    const created = (await mlflowApi(url, '/api/2.0/mlflow/model-versions/create', {
      name: modelName,
      source: artifactChildUri,
      run_id: runId,
    })).model_version;
    if (Number(created.version) !== version) {
      throw new Error(`registry version mismatch: expected ${version}, got ${created.version}`);
    }
    await mlflowApi(url, '/api/2.0/mlflow/model-versions/transition-stage', {
      name: modelName,
      version: String(version),
      stage: 'Staging',
      archive_existing_versions: false,
    });
    await mlflowApi(url, '/api/2.0/mlflow/runs/update', { run_id: runId, status: 'FINISHED', end_time: Date.now() });

    // 7. 读回核对：Stage、source、包字节
    const readBack = (await mlflowApi(
      url,
      `/api/2.0/mlflow/model-versions/get?name=${encodeURIComponent(modelName)}&version=${version}`,
      undefined,
      'GET',
    )).model_version;
    if (readBack.current_stage !== 'Staging') fail(`读回 Stage=${readBack.current_stage}，应为 Staging`);
    const sourceDir = readBack.source.startsWith('file://') ? new URL(readBack.source).pathname : readBack.source;
    for (const file of PACKAGE_FILES) {
      const registered = createHash('sha256').update(readFileSync(join(sourceDir, file))).digest('hex');
      const local = createHash('sha256').update(readFileSync(join(args.packageDir, file))).digest('hex');
      if (registered !== local) fail(`Registry 工件与本项目包字节不一致：${file}`);
      const delivered = createHash('sha256').update(readFileSync(join(packageDir, file))).digest('hex');
      if (delivered !== local) fail(`exports 交付副本与本项目包字节不一致：${file}`);
    }

    process.stdout.write(`PASS 登记 ${modelName} v${version}（Staging）\n`);
    process.stdout.write(`  run_id: ${runId}（FINISHED，experiment ${EXPERIMENT_NAME}）\n`);
    process.stdout.write(`  Registry: ${modelName} v${version} · stage=${readBack.current_stage} · status=${readBack.status}\n`);
    process.stdout.write(`  source: ${readBack.source}\n`);
    process.stdout.write(`  exports 交付路径: ${packageDir}\n`);
    process.stdout.write(`  data_sha256（宿主重算一致）: ${recomputedDataSha}\n`);
    process.stdout.write(`  门槛结论: ${gates.selectionGate} · ${gates.selectedVariant} · macro_js_lift=${gates.macroJsLift}\n`);
    process.stdout.write(`  约束: ${gates.promotionPolicy}\n`);
  } catch (error) {
    await failRun(`登记失败：${error.message}`);
  }
}

await main();
