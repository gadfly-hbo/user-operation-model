/**
 * R2-S1（复核修单，review-p2-round2.md）：登记前必须核验候选包的阶段 06 校验记录
 * V1–V12 全 PASS——任一非 PASS 即拒绝登记（fail-closed，不看调用方传参，只看
 * 包内 manifest 校验记录与管线校验产物）。
 *
 * 复核发现：阶段 06 有 FAIL 的包此前可被登记脚本放行（前置校验只核 3 文件／
 * formatVersion／Staging／gateConclusion 存在／data_sha256，不核 V1–V12）。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  STAGE06_CHECK_IDS,
  assertStage06ChecksRegistrable,
  type V06ValidationCheckRecord,
} from '../src/register/validation-gate.js';
import type * as tsNS from 'typescript';

/** 全 PASS 的 12 条记录（与正常管线产物同形）。 */
function allPassRecords(): V06ValidationCheckRecord[] {
  return STAGE06_CHECK_IDS.map((id) => ({ id, result: 'pass' as const }));
}

describe('登记校验守卫（R2-S1）：阶段 06 校验记录必须 V1–V12 全 PASS', () => {
  test('全 12 条 PASS 放行（全 PASS 但科学门槛 FAIL_NOT_POSITIVE 的包仍可登记——回归保护）', () => {
    assert.doesNotThrow(() => assertStage06ChecksRegistrable(allPassRecords(), 'manifest.gateConclusion'));
  });

  test('任一校验 FAIL 即拒绝（构造带 FAIL 校验记录的包 → 登记必须拒绝）', () => {
    for (const failing of ['V4', 'V9', 'V12']) {
      const records = allPassRecords().map((record) =>
        record.id === failing ? { ...record, result: 'fail' as const } : record,
      );
      assert.throws(
        () => assertStage06ChecksRegistrable(records, 'manifest.gateConclusion'),
        new RegExp(failing),
        `V${failing} 为 fail 的包必须被拒绝`,
      );
    }
  });

  test('缺任一 V1–V12 记录即拒绝（不齐全不等于全 PASS）', () => {
    const missingV12 = allPassRecords().filter((record) => record.id !== 'V12');
    assert.throws(() => assertStage06ChecksRegistrable(missingV12, 'manifest.gateConclusion'), /V12/);
    assert.throws(() => assertStage06ChecksRegistrable([], 'manifest.gateConclusion'), /阶段 06|校验/);
  });

  test('非法形态（非数组／未知 id／非法 result）一律拒绝', () => {
    assert.throws(
      () => assertStage06ChecksRegistrable(undefined as unknown as V06ValidationCheckRecord[], 'x'),
      /阶段 06|校验/,
    );
    assert.throws(
      () =>
        assertStage06ChecksRegistrable(
          [...allPassRecords(), { id: 'V99', result: 'pass' }],
          'manifest.gateConclusion',
        ),
      /V99|未知/,
      '未知校验编号不得静默放行',
    );
    assert.throws(
      () =>
        assertStage06ChecksRegistrable(
          allPassRecords().map((r) => (r.id === 'V1' ? { ...r, result: 'PASS ' as unknown as 'pass' } : r)),
          'manifest.gateConclusion',
        ),
      /result|V1/,
      '非 pass/fail 字面值不得静默放行',
    );
  });

  test('结构守卫（R3-S2·AST）：登记入口必须在任何请求发出前**调用**回环校验与两处校验记录核验', async () => {
    // 第三轮复核 M8a：旧守卫用 `source.indexOf('assertStage06ChecksRegistrable')` 判「存在」，
    // 命中的是 `let` 声明而非调用——删掉两处守卫调用后 75/75 全绿，一致失败包能走到首个请求。
    // 本守卫改用 AST 判定「调用」：回环校验 ≥1 处、校验记录核验 ≥2 处（manifest 与管线产物），
    // 且全部先于 main 流程中的首个 fetch 调用语句；模块加载期不得出现任何 fetch。
    const tsModule = await import('typescript');
    const ts: typeof tsNS = (tsModule as unknown as { default?: typeof tsNS }).default ?? tsModule;
    const here = dirname(fileURLToPath(import.meta.url));
    const scriptPath = resolve(here, '../../../../scripts/register-model-mlflow.mjs');
    const sourceFile = ts.createSourceFile(
      scriptPath,
      readFileSync(scriptPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );

    /** 收集节点子树内的调用名；**不进入嵌套函数体**（那里不是当前执行流）。 */
    const collectFlowCalls = (node: tsNS.Node, visit: (name: string) => void): void => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)
      ) {
        return;
      }
      if (ts.isCallExpression(node)) {
        const calleeName = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)
            ? node.expression.name.text
            : undefined;
        if (calleeName) visit(calleeName);
      }
      node.forEachChild((child: tsNS.Node) => collectFlowCalls(child, visit));
    };

    const GUARDS = ['assertLoopbackMlflowUrl', 'assertStage06ChecksRegistrable'];
    const guardStatements = new Map<string, number[]>();
    let firstRequestStatement = -1;
    let moduleLevelFetch = false;

    // 模块加载期（main 之前）不得出现 fetch——函数声明的体不在加载期执行，跳过
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement)) continue;
      collectFlowCalls(statement, (name) => {
        if (name === 'fetch') moduleLevelFetch = true;
      });
    }
    assert.ok(!moduleLevelFetch, '模块加载期（await main() 之前）不得发起任何 fetch 请求');

    // main 函数体顶层语句流：守卫调用与首个请求都发生在其中
    const mainDeclaration = sourceFile.statements.find(
      (statement): statement is tsNS.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === 'main' && statement.body !== undefined,
    );
    assert.ok(mainDeclaration, '登记脚本应含 main 函数');
    const flow = [...mainDeclaration.body!.statements];
    flow.forEach((statement, index) => {
      collectFlowCalls(statement, (name) => {
        if (GUARDS.includes(name)) {
          const list = guardStatements.get(name) ?? [];
          list.push(index);
          guardStatements.set(name, list);
        }
        if (name === 'fetch' && firstRequestStatement < 0) firstRequestStatement = index;
      });
    });

    assert.ok(
      firstRequestStatement >= 0,
      'main 流程应包含首个真实请求（健康检查 fetch）',
    );
    const loopbackCalls = guardStatements.get('assertLoopbackMlflowUrl') ?? [];
    assert.ok(
      loopbackCalls.length >= 1,
      '登记入口必须实际调用 assertLoopbackMlflowUrl（let 声明／导入不算调用）',
    );
    for (const index of loopbackCalls) {
      assert.ok(
        index < firstRequestStatement,
        `回环校验调用（语句 ${index}）必须先于首个请求（语句 ${firstRequestStatement}）`,
      );
    }
    const gateCalls = guardStatements.get('assertStage06ChecksRegistrable') ?? [];
    assert.ok(
      gateCalls.length >= 2,
      `assertStage06ChecksRegistrable 必须至少实际调用两次（manifest 包内记录与管线产物），实际 ${gateCalls.length} 处——删守卫调用即放行失败包`,
    );
    for (const index of gateCalls) {
      assert.ok(
        index < firstRequestStatement,
        `校验记录核验调用（语句 ${index}）必须先于首个请求（语句 ${firstRequestStatement}）`,
      );
    }
    // 两处核验的依据：manifest 包内记录 + 管线产物 validation.json（不采信调用方传参）
    assert.ok(
      sourceFile.text.includes('gates.validationChecks'),
      '登记脚本必须核验 manifest.gateConclusion.validationChecks（包内记录）',
    );
    assert.ok(
      sourceFile.text.includes('validation.checks'),
      '登记脚本必须核验管线校验产物 validation.json 的 checks',
    );
  });
});

// ---------------------------------------------------------------------------
// 行为层（R3-S2）：打桩 fetch（不联网）——非 PASS 包与回环外 URL 必须在首个请求前被拒，
// 守卫全过的好包应走到首个请求（证明打桩与守卫顺序都真实生效）。
// ---------------------------------------------------------------------------

describe('登记入口行为守卫（R3-S2）：fetch 打桩', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '../../../..');
  const registerScriptPath = resolve(repoRoot, 'scripts', 'register-model-mlflow.mjs');

  /** 在临时目录写一个 fetch 打桩模块：记录每次调用到日志文件并抛错（零联网）。 */
  function writeFetchStub(sandbox: string): string {
    const stubPath = join(sandbox, 'fetch-stub.mjs');
    writeFileSync(
      stubPath,
      [
        "import { appendFileSync } from 'node:fs';",
        'const log = process.env.UOM_TEST_FETCH_LOG;',
        'globalThis.fetch = async (input) => {',
        "  appendFileSync(log, String(input) + '\\n', 'utf8');",
        "  throw new Error('测试打桩：登记脚本的任何网络请求都必须被拦截');",
        '};',
        '',
      ].join('\n'),
      'utf8',
    );
    return stubPath;
  }

  interface Fixture {
    sandbox: string;
    packageDir: string;
    workDir: string;
    mlflowRoot: string;
  }

  /** 合成登记台：3 文件包 + 管线产物（validation.json / dataset.json）+ 假 model-mlflow 根。 */
  function makeFixture(sandbox: string, checks: V06ValidationCheckRecord[], gate5: 'PASS' | 'FAIL'): Fixture {
    const packageDir = join(sandbox, 'package');
    const workDir = join(sandbox, 'work');
    const mlflowRoot = join(sandbox, 'model-mlflow');
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(workDir, { recursive: true });
    mkdirSync(join(mlflowRoot, 'workspace'), { recursive: true });

    const selectionGate = 'FAIL_NOT_POSITIVE';
    const winner = 'V1_minus_subcat';
    writeFileSync(join(workDir, 'dataset.json'), '{"rows":1}\n', 'utf8');
    const dataSha = createHash('sha256').update(readFileSync(join(workDir, 'dataset.json'))).digest('hex');
    writeFileSync(
      join(workDir, 'validation.json'),
      `${JSON.stringify({ checks, selection: { winner: { name: winner }, gate: selectionGate } }, null, 2)}\n`,
      'utf8',
    );

    const manifest = {
      formatVersion: 1,
      model: { name: 'uom-tool2-portrait-v06', version: 9, stage: 'Staging' },
      goal: 'synthetic fixture（无真实数据）',
      data: { fingerprint: { sha256: dataSha, rows: 1, columns: ['fit'] } },
      metrics: { macro_js_lift: 0.01 },
      gateConclusion: {
        selectedVariant: winner,
        selectionGate,
        macroJsLift: 0.01,
        perGate: { gate5_frozen_inputs_and_fail_closed: gate5 },
        validationChecks: checks,
        frozenFoldsSha256: 'b'.repeat(64),
        coefficientRegionSha256: 'c'.repeat(64),
      },
      training: {
        splitSeed: 1,
        task: 'multi_distribution_regression',
        targets: [],
        trainedAt: '2026-01-01T00:00:00.000Z',
        sessionRef: 'synthetic',
      },
      usage: { inputs: ['fit'], outputs: [], form: 'predict(rows) -> rows' },
    };
    writeFileSync(join(packageDir, 'predict.mjs'), 'export const predict = (rows) => rows;\n', 'utf8');
    writeFileSync(join(packageDir, 'README.md'), '# synthetic fixture\n', 'utf8');
    writeFileSync(join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return { sandbox, packageDir, workDir, mlflowRoot };
  }

  interface RunResult {
    status: number;
    output: string;
    fetchAttempts: string[];
  }

  /** 以打桩 fetch 运行真实登记脚本（子进程，--import 预加载打桩模块），返回退出码／输出／fetch 尝试。 */
  function runRegister(fixture: Fixture, extraArgs: string[]): RunResult {
    const fetchLog = join(fixture.sandbox, 'fetch-attempts.log');
    const stubPath = writeFetchStub(fixture.sandbox);
    const result = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(stubPath).href, registerScriptPath, ...extraArgs],
      {
        encoding: 'utf8',
        timeout: 120000,
        env: { ...process.env, UOM_TEST_FETCH_LOG: fetchLog },
      },
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    let fetchAttempts: string[] = [];
    try {
      fetchAttempts = readFileSync(fetchLog, 'utf8').split('\n').filter(Boolean);
    } catch {
      fetchAttempts = [];
    }
    return { status: result.status ?? -1, output, fetchAttempts };
  }

  test('一致失败包（manifest 与管线产物同带 V12=fail、gate5 手标 PASS）→ 必须拒绝且 fetch 调用次数为 0', () => {
    // 第三轮 M8a 的逃逸包：删掉两处守卫调用后它能走到首个请求。守卫在位时必须在请求前拦下。
    const sandbox = mkdtempSync(join(tmpdir(), 'uom-reg-k-'));
    const checks = STAGE06_CHECK_IDS.map((id) =>
      id === 'V12' ? ({ id, result: 'fail' } as V06ValidationCheckRecord) : ({ id, result: 'pass' } as V06ValidationCheckRecord),
    );
    const fixture = makeFixture(sandbox, checks, 'PASS');
    const run = runRegister(fixture, [
      '--package', fixture.packageDir,
      '--work', fixture.workDir,
      '--mlflow-root', fixture.mlflowRoot,
      '--url', 'http://127.0.0.1:1',
    ]);
    assert.notEqual(run.status, 0, `非 PASS 包必须被拒绝，实际退出码 ${run.status}。输出：\n${run.output.slice(0, 1500)}`);
    assert.match(run.output, /V12 校验结果不是 pass/, '拒绝原因必须写明 V12 校验不是 pass');
    assert.deepStrictEqual(
      run.fetchAttempts,
      [],
      `非 PASS 包必须在首个请求前被拒——实际 fetch 尝试：${JSON.stringify(run.fetchAttempts)}`,
    );
  });

  test('回环外 URL → 必须在 fetch 前拒绝且 fetch 调用次数为 0', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'uom-reg-url-'));
    const checks = STAGE06_CHECK_IDS.map((id) => ({ id, result: 'pass' } as V06ValidationCheckRecord));
    const fixture = makeFixture(sandbox, checks, 'PASS');
    const run = runRegister(fixture, [
      '--package', fixture.packageDir,
      '--work', fixture.workDir,
      '--mlflow-root', fixture.mlflowRoot,
      '--url', 'http://example.com:8080',
    ]);
    assert.notEqual(run.status, 0, `回环外 URL 必须被拒绝，实际退出码 ${run.status}`);
    assert.match(run.output, /回环/, '拒绝原因必须写明非回环地址');
    assert.deepStrictEqual(
      run.fetchAttempts,
      [],
      `回环外 URL 必须在任何请求发出前被拒——实际 fetch 尝试：${JSON.stringify(run.fetchAttempts)}`,
    );
  });

  test('正向对照：全 PASS + FAIL_NOT_POSITIVE 的好包过全部入口守卫、走到首个请求（打桩拦截，零联网）', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'uom-reg-pass-'));
    const checks = STAGE06_CHECK_IDS.map((id) => ({ id, result: 'pass' } as V06ValidationCheckRecord));
    const fixture = makeFixture(sandbox, checks, 'PASS');
    const run = runRegister(fixture, [
      '--package', fixture.packageDir,
      '--work', fixture.workDir,
      '--mlflow-root', fixture.mlflowRoot,
      '--url', 'http://127.0.0.1:1',
    ]);
    assert.notEqual(run.status, 0, '打桩 fetch 抛错后脚本应失败退出（账本不可达），不得假成功');
    assert.match(run.output, /本地 MLflow 账本不可达/, '好包应走到健康检查请求、被打桩拦截');
    assert.strictEqual(
      run.fetchAttempts.length,
      1,
      `好包应恰好发起首个健康检查请求（被拦截），实际：${JSON.stringify(run.fetchAttempts)}`,
    );
    assert.ok(
      run.fetchAttempts[0]?.includes('/health'),
      `首个请求应是健康检查，实际：${run.fetchAttempts[0]}`,
    );
  });
});
