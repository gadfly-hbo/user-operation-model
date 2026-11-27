/**
 * 工具1 断网验证。
 *
 * 在断网守卫下运行报告生成器，断言：
 * 1. 生成器正常退出，产物落盘
 * 2. **子进程的出网尝试次数为 0**
 * 3. 产物内无任何外网引用（图标走 data URI）
 * 4. 产物不含本机绝对路径
 *
 * 参考数据路径需要本机的参考数据目录；未提供时该步**明确标注未运行**，不静默通过。
 *
 * 用法：`npm run build && node scripts/offline-check/tool1-offline.mjs`
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guardPath = new URL('./block-net.mjs', import.meta.url).pathname;
const binPath = new URL('../../packages/tool1-channel-match/dist/src/bin.js', import.meta.url).pathname;
const repoRoot = new URL('../../', import.meta.url).pathname;

const outDir = mkdtempSync(join(tmpdir(), 'uom-tool1-offline-'));

function run(args) {
  const result = spawnSync(process.execPath, ['--import', guardPath, binPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function attemptsOf(stderr) {
  const match = stderr.match(/出网尝试次数: (\d+)/);
  return match ? Number(match[1]) : null;
}

/** 产物扫描：去��内联图标后不得出现任何外网引用。 */
function scanHtml(path) {
  const html = readFileSync(path, 'utf8');
  const withoutIcons = html.replace(/href="data:image\/svg\+xml,[^"]*"/g, 'href="data:icon"');
  for (const pattern of ['http', '//cdn', '@import', 'url(', 'fetch(', 'XMLHttpRequest', '<script src=']) {
    assert.ok(!withoutIcons.includes(pattern), `产物不应包含 ${pattern}`);
  }
  assert.ok(!html.includes(repoRoot), '产物不应包含本机绝对路径');
  assert.ok(!html.includes('/Users/'), '产物不应包含本机绝对路径');
  return html;
}

// 1. 合成演示报告
const demoPath = join(outDir, 'tool1-report.html');
const demo = run(['--demo', '--out', demoPath]);
assert.equal(demo.code, 0, `生成器退出码应为 0，实际 ${demo.code}：${demo.stderr}`);
assert.ok(existsSync(demoPath), '演示产物未落盘');
const demoAttempts = attemptsOf(demo.stderr);
assert.notEqual(demoAttempts, null, '未读到出网守卫计数');
assert.equal(demoAttempts, 0, `出网尝试次数应为 0，实际 ${demoAttempts}`);
scanHtml(demoPath);

// 2. 参考数据报告（需要本机参考数据）
const referenceRoot = process.env.UOM_REFERENCE_ROOT;
let referenceState = '未运行（未提供 UOM_REFERENCE_ROOT）';
if (referenceRoot) {
  const referenceOut = join(outDir, 'reference');
  const reference = run([
    '--dataset',
    'reference',
    '--reference-root',
    referenceRoot,
    '--month',
    '2026-10',
    '--out',
    referenceOut,
  ]);
  assert.equal(reference.code, 0, `参考数据生成退出码应为 0：${reference.stderr}`);
  const referenceAttempts = attemptsOf(reference.stderr);
  assert.notEqual(referenceAttempts, null, '未读到参考数据子进程的出网守卫计数');
  assert.equal(referenceAttempts, 0, `参考数据出网尝试次数应为 0，实际 ${referenceAttempts}`);
  scanHtml(join(referenceOut, 'index.html'));
  referenceState = 'PASS（出网尝试 0 次）';
}

console.log(
  `工具1 断网验证：演示报告 PASS（出网尝试 ${demoAttempts} 次）｜参考数据报告 ${referenceState}`,
);
