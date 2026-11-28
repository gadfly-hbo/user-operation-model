#!/usr/bin/env node
/**
 * P2-4/P2-5 移植忠实门（本地运行，CI 不跑）。
 *
 * 门禁内容（对齐 P2 规格 M05 / M06 / M07）：
 *
 * ## 第一组：移植忠实性（原特征集，含 FAB 卖点）
 * 在**归档固化的 v0.4 work-package** 上跑移植后的 v0.4 跨期协议，要求：
 * - strict-23（25Q3 留出，排除已知重叠款号 109926124101）：
 *   top1 = 0.6957、top3 = 0.9155、share MAE = 0.0825，**容差 0**
 *   （归档权威源：`artifacts/v0.4-2026-07-11-expanded-temporal-holdout/artifact-manifest.json`，
 *    其 `metrics.holdout_strict_23` 按 4 位小数登记）；
 * - all-24：top1 = 0.7014、top3 = 0.9190、share MAE = 0.0830（容差 0）；
 * - 选中 alpha = 50；训练样本 = 83；特征数 = 156；交叉特征数 = 94；
 * - 温度校准六值与归档 `experiment-record.md:62` 完全一致；
 * - 泄漏门禁 5 条全部 pass。
 *
 * ## 第二组：§9.2 合规基线（合规特征集，白名单字段）
 * 同一 split、同一 alpha 选择规则、同一温度校准流程下重算 strict-23 三数字，
 * 作为**生产门基线**冻结。数字由实跑得出（见 `docs/match-model-baseline.md`）。
 *
 * 缺固化数据 / 缺归档 → **明确失败**，不跳过、不静默通过。
 * 本脚本只读本机文件，不访问网络、不写业务数据。
 *
 * 用法：
 *   node scripts/fidelity-v04.mjs
 *   node scripts/fidelity-v04.mjs --root /path/to/data/archive-modelevol/v04-holdout
 */

import { existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

/** 固化根（相对主仓）。 */
const FIXED_ROOT_RELATIVE = join('data', 'archive-modelevol', 'v04-holdout');

/** 原特征集基线（归档 artifact-manifest.json，4 位小数登记）。 */
const ORIGINAL_BASELINE = {
  strict23: { top1: '0.6957', top3: '0.9155', shareMae: '0.0825' },
  all24: { top1: '0.7014', top3: '0.9190', shareMae: '0.0830' },
  selectedAlpha: 50,
  trainRowCount: 83,
  featureCount: 156,
  combinationFeatureCount: 94,
  temperatures: {
    预测性别: 0.4,
    预测年龄段: 0.2,
    预测消费能力: 0.4,
    城市等级: 0.2,
    八大消费群体: 0.2,
    预测人生阶段: 0.4,
  },
};

/** 合规基线（实跑冻结，4 位小数；生产门以此为准）。 */
const COMPLIANT_BASELINE = {
  strict23: { top1: '0.7754', top3: '0.9300', shareMae: '0.0759' },
  selectedAlpha: 50,
};

/** 解析命令行参数。 */
function parseArgs(argv) {
  const out = { root: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '-r') {
      const value = argv[i + 1];
      if (!value) throw new Error('--root 缺少参数');
      out.root = resolve(value);
      i += 1;
    } else if (arg.startsWith('--root=')) {
      out.root = resolve(arg.slice('--root='.length));
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return out;
}

/** 通过 git 公共目录定位主仓根（独立工作树时指向主仓）。 */
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

function resolveFixedRoot(explicit) {
  const forced =
    explicit ??
    (process.env.UOM_ARCHIVE_FIXED_ROOT ? resolve(process.env.UOM_ARCHIVE_FIXED_ROOT) : undefined);
  if (forced) return forced;
  const candidates = [];
  const mainRoot = mainWorktreeRoot();
  if (mainRoot) candidates.push(join(mainRoot, FIXED_ROOT_RELATIVE));
  candidates.push(join(REPO_ROOT, FIXED_ROOT_RELATIVE));
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return undefined;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const failures = [];
const lines = [];

function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures.push(`${name}：实际 ${actual} ≠ 期望 ${expected}`);
  return ok ? 'PASS' : 'FAIL';
}

function format4(value) {
  return value.toFixed(4);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`FAIL 参数错误：${error.message}`);
    return;
  }

  const fixedRoot = resolveFixedRoot(args.root);
  if (!fixedRoot) {
    fail(
      `FAIL 找不到固化数据。可用 --root <路径> 或环境变量 UOM_ARCHIVE_FIXED_ROOT 指定` +
        `（期望目录：${FIXED_ROOT_RELATIVE}，其下应有 work-package/train 与 work-package/holdout）。`,
    );
    return;
  }
  const workPackage = join(fixedRoot, 'work-package');
  for (const name of ['train', 'holdout']) {
    const dir = join(workPackage, name);
    if (!existsSync(dir)) {
      fail(`FAIL 固化数据不完整：缺少 ${dir}。忠实门不允许在数据缺失时跳过。`);
      return;
    }
  }

  const pipelinePath = join(
    REPO_ROOT,
    'packages/tool2-portrait-predict/dist/src/pipeline/run-v04-fidelity.js',
  );
  if (!existsSync(pipelinePath)) {
    fail(`FAIL 找不到构建产物 ${pipelinePath}，请先执行 npm run build。`);
    return;
  }

  const { loadV04Packages, runV04Fidelity, originalFeatureSetChoice, compliantFeatureSetChoice } =
    await import(pipelinePath);

  lines.push(`v0.4 移植忠实门 · 固化根 ${fixedRoot}`);
  lines.push('');

  const packages = loadV04Packages(fixedRoot);
  const original = runV04Fidelity({ packages, choice: originalFeatureSetChoice() });
  const compliant = runV04Fidelity({ packages, choice: compliantFeatureSetChoice() });

  // ---- 第一组：移植忠实性 ----
  lines.push('第一组 · 移植忠实门（原特征集，含 FAB；对照归档 v0.4 基线）');
  lines.push('项目 | 实际 | 期望 | 结论');
  lines.push('--- | --- | --- | ---');
  const rows = [
    ['strict-23 top1', format4(original.strict23.avgTop1), ORIGINAL_BASELINE.strict23.top1],
    ['strict-23 top3', format4(original.strict23.avgTop3), ORIGINAL_BASELINE.strict23.top3],
    ['strict-23 share MAE', format4(original.strict23.shareMae), ORIGINAL_BASELINE.strict23.shareMae],
    ['all-24 top1', format4(original.all24.avgTop1), ORIGINAL_BASELINE.all24.top1],
    ['all-24 top3', format4(original.all24.avgTop3), ORIGINAL_BASELINE.all24.top3],
    ['all-24 share MAE', format4(original.all24.shareMae), ORIGINAL_BASELINE.all24.shareMae],
    ['选中 alpha', String(original.selectedAlpha), String(ORIGINAL_BASELINE.selectedAlpha)],
    ['训练样本数', String(original.trainRowCount), String(ORIGINAL_BASELINE.trainRowCount)],
    ['特征数', String(original.featureCount), String(ORIGINAL_BASELINE.featureCount)],
    ['交叉特征数', String(original.combinationFeatureCount), String(ORIGINAL_BASELINE.combinationFeatureCount)],
  ];
  for (const [name, actual, expected] of rows) {
    lines.push(`${name} | ${actual} | ${expected} | ${check(name, actual, expected)}`);
  }
  for (const [dimension, expected] of Object.entries(ORIGINAL_BASELINE.temperatures)) {
    const actual = original.temperatures[dimension];
    const name = `温度 · ${dimension}`;
    lines.push(`${name} | ${actual} | ${expected} | ${check(name, actual, expected)}`);
  }
  const leakageOk = original.leakageChecks.every((item) => item.result === 'pass');
  if (!leakageOk) {
    failures.push(
      `泄漏门禁未全过：${original.leakageChecks
        .filter((item) => item.result !== 'pass')
        .map((item) => `${item.check}（${item.detail ?? ''}）`)
        .join('；')}`,
    );
  }
  lines.push(`泄漏门禁（5 条） | ${original.leakageChecks.filter((i) => i.result === 'pass').length}/5 pass | 5/5 pass | ${leakageOk ? 'PASS' : 'FAIL'}`);

  // ---- 第二组：合规基线 ----
  lines.push('');
  lines.push('第二组 · §9.2 合规基线（白名单特征集；生产门门槛）');
  lines.push('项目 | 实际 | 期望 | 结论');
  lines.push('--- | --- | --- | ---');
  const compliantRows = [
    ['strict-23 top1', format4(compliant.strict23.avgTop1), COMPLIANT_BASELINE.strict23.top1],
    ['strict-23 top3', format4(compliant.strict23.avgTop3), COMPLIANT_BASELINE.strict23.top3],
    ['strict-23 share MAE', format4(compliant.strict23.shareMae), COMPLIANT_BASELINE.strict23.shareMae],
    ['选中 alpha', String(compliant.selectedAlpha), String(COMPLIANT_BASELINE.selectedAlpha)],
  ];
  for (const [name, actual, expected] of compliantRows) {
    lines.push(`${name} | ${actual} | ${expected} | ${check(name, actual, expected)}`);
  }
  const compliantLeakageOk = compliant.leakageChecks.every((item) => item.result === 'pass');
  if (!compliantLeakageOk) {
    failures.push('合规基线的泄漏门禁未全过');
  }
  lines.push(`泄漏门禁（5 条） | ${compliant.leakageChecks.filter((i) => i.result === 'pass').length}/5 pass | 5/5 pass | ${compliantLeakageOk ? 'PASS' : 'FAIL'}`);

  lines.push('');
  lines.push('逐维 strict-23 指标（原特征集）：');
  for (const [dimension, metrics] of Object.entries(original.strict23.perDimension)) {
    lines.push(
      `  ${dimension}：top1=${metrics.top1.toFixed(4)} top3=${metrics.top3.toFixed(4)} shareMae=${metrics.shareMae.toFixed(4)}`,
    );
  }
  lines.push('逐维 strict-23 指标（合规特征集）：');
  for (const [dimension, metrics] of Object.entries(compliant.strict23.perDimension)) {
    lines.push(
      `  ${dimension}：top1=${metrics.top1.toFixed(4)} top3=${metrics.top3.toFixed(4)} shareMae=${metrics.shareMae.toFixed(4)}`,
    );
  }

  process.stdout.write(`${lines.join('\n')}\n`);

  if (failures.length > 0) {
    process.stderr.write(`\n忠实门未通过：\n- ${failures.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write('\n忠实门通过：v0.4 移植忠实性（容差 0）与 §9.2 合规基线均达标。\n');
}

await main();
