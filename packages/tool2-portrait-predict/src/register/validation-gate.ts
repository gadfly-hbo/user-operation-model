/**
 * 登记前置守卫（复核修单 R2-S1）：候选包的阶段 06 校验记录必须 V1–V12 全 PASS。
 *
 * 复核发现（review-p2-round2.md §5.2 R2-S1）：阶段 06 有 FAIL 的失败包此前仍可导出，
 * 且登记脚本的前置校验不核 V1–V12——fail-closed 失败的包可能被登记为 Staging。
 * 本守卫与 `url-guard.ts` 同层：登记入口在任何请求发出前调用，非全 PASS 即拒绝。
 *
 * 判定依据是**包内 manifest 的校验记录**（`gateConclusion.validationChecks`，
 * 由导出器从管线阶段 06 实际结果派生）与**管线校验产物**（`models/work-v06/validation.json`
 * 的 `checks`），不得只看调用方传参。
 */

/** 一条阶段 06 校验记录（与 `V06ValidationCheck` 的 id/result 子集同形）。 */
export interface V06ValidationCheckRecord {
  id: string;
  result: 'pass' | 'fail';
}

/** 阶段 06 的固定校验编号（V1–V12）。 */
export const STAGE06_CHECK_IDS: readonly string[] = [
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
];

/**
 * 断言一组阶段 06 校验记录「V1–V12 齐全且全部 pass」；任一条件不满足即抛错
 * （fail-closed：调用方必须拒绝导出／登记，不得把失败包放行）。
 *
 * 判定条件（与 `06-validate.ts` 的 V12 同款 fail-closed 风格，条件显式写进报错）：
 * - 必须是非空数组；
 * - V1–V12 每条都必须在记录里（缺任一条即无法证明全 PASS，拒绝）；
 * - 每条 result 严格等于 `'pass'`（`'PASS'`／空白等一律拒绝，不宽容大小写）；
 * - 出现 V1–V12 之外的未知编号同样拒绝（校验集被篡改或来源不可信）。
 *
 * @param checks 校验记录（来自 manifest 或管线校验产物）
 * @param sourceLabel 记录来源标签（仅用于报错定位，如「manifest.gateConclusion」）
 */
export function assertStage06ChecksRegistrable(
  checks: ReadonlyArray<V06ValidationCheckRecord>,
  sourceLabel: string,
): void {
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error(
      `FAIL-CLOSED: ${sourceLabel} 没有阶段 06 校验记录——无法证明 V1–V12 全 PASS，拒绝放行`,
    );
  }
  const byId = new Map<string, string>();
  for (const record of checks) {
    if (!record || typeof record.id !== 'string' || !STAGE06_CHECK_IDS.includes(record.id)) {
      throw new Error(
        `FAIL-CLOSED: ${sourceLabel} 出现未知校验编号「${String(record?.id)}」——校验集与管线约定（V1–V12）不符，拒绝放行`,
      );
    }
    if (record.result !== 'pass') {
      throw new Error(
        `FAIL-CLOSED: ${sourceLabel} 的 ${record.id} 校验结果不是 pass（实际 ${String(record.result)}）——` +
          `阶段 06 有 FAIL 的包不得导出／登记`,
      );
    }
    byId.set(record.id, record.result);
  }
  const missing = STAGE06_CHECK_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(
      `FAIL-CLOSED: ${sourceLabel} 缺少校验记录：${missing.join('／')}——记录不齐全不等于全 PASS，拒绝放行`,
    );
  }
}
