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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STAGE06_CHECK_IDS,
  assertStage06ChecksRegistrable,
  type V06ValidationCheckRecord,
} from '../src/register/validation-gate.js';

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

  test('结构守卫：登记入口必须在任何请求发出前核验 manifest 校验记录与管线产物（不采信调用方传参）', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, '../../../../scripts/register-model-mlflow.mjs'), 'utf8');
    const gateCall = source.indexOf('assertStage06ChecksRegistrable');
    assert.ok(gateCall >= 0, '登记脚本必须调用 assertStage06ChecksRegistrable');
    // 首个真实请求点是健康检查（此前的 fetch( 出现只是 mlflowApi 辅助函数的定义）
    const firstRequest = source.indexOf('const health = await fetch');
    assert.ok(firstRequest >= 0, '登记脚本应包含健康检查请求');
    assert.ok(
      gateCall < firstRequest,
      `校验记录核验（偏移 ${gateCall}）必须先于第一个真实请求（偏移 ${firstRequest}）`,
    );
    // 校验记录必须读自 manifest（包内）与 validation.json（管线产物），不是调用方参数
    assert.ok(
      source.includes('gates.validationChecks'),
      '登记脚本必须核验 manifest.gateConclusion.validationChecks（包内记录）',
    );
    assert.ok(
      source.includes('validation.checks'),
      '登记脚本必须核验管线校验产物 validation.json 的 checks',
    );
  });
});
