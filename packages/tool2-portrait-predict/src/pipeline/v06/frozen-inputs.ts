/**
 * v0.6 冻结输入的钉死哈希与 fail-closed 断言（复核修单 B2／S2）。
 *
 * 复核发现（review-p2.md B2／S2）：
 * - V4 曾把**同一运行时哈希**同时当冻结值与实际值（`scripts/v06-pipeline.mjs` 自比较恒 PASS），
 *   folds.json 被重生成时管线 12/12 仍全绿；
 * - 冻结系数区哈希没有机器校验，换掉求解器（变异 4）后哈希变化仍「六阶段实跑通过」。
 *
 * 本模块把两个冻结值钉死为常量（与 `docs/match-model-baseline.md` §7.4、result.md §13.1 同源），
 * 并提供 fail-closed 断言：实际哈希**缺失或不一致即抛错**，由管线在阶段 02／04 后立即调用。
 *
 * 冻结值语义：
 * - `FROZEN_FOLDS_SHA256`：归档冻结 `folds.json` 文件字节的 sha256
 *   （主仓 `data/archive-modelevol/v06-tmall-25q4/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/outputs/folds.json`）；
 * - `EXPECTED_COEFFICIENT_SHA256`：**本固化数据集**（93 款 intake、§9.2 合规特征集、
 *   选中配置 `V1_minus_subcat`）最终训练工件确定性系数区的 sha256。
 *   换数据集（P2-13 用户数据重训）必须另立变更更新该常量，不得静默改值。
 */

/** 归档冻结 folds.json 的 sha256（钉死，不得改写）。 */
export const FROZEN_FOLDS_SHA256 = '2ca273cb2a2b14dff9d2ae857e170aa02db89c0f50e36ced84f2625f4087ad22';

/** 固化数据集上最终模型系数区的期望 sha256（钉死，不得改写）。 */
export const EXPECTED_COEFFICIENT_SHA256 = '79669a0f30938c0b837589998adc4270d093050bd4c980400e76ee357568d6fa';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** V4：实际 folds 哈希缺失或不等于冻结值即抛错（fail-closed，不默认 pass）。 */
export function assertFrozenFoldsSha256(actual: string | undefined): void {
  if (actual === undefined || actual === '') {
    throw new Error(`冻结 folds 哈希未提供——folds 是冻结输入，缺比对值即 fail-closed`);
  }
  if (!SHA256_PATTERN.test(actual)) {
    throw new Error(`冻结 folds 哈希不是 64 位十六进制 sha256：${actual}`);
  }
  if (actual !== FROZEN_FOLDS_SHA256) {
    throw new Error(
      `冻结 folds 哈希不一致：实际 ${actual} ≠ 钉死 ${FROZEN_FOLDS_SHA256}` +
        `（folds 被重生成或替换——六阶段拒绝在非冻结输入上运行）`,
    );
  }
}

/** S2：实际系数区哈希缺失或不等于钉死期望值即抛错（换求解器/改数据即 FAIL）。 */
export function assertFrozenCoefficientSha256(actual: string | undefined): void {
  if (actual === undefined || actual === '') {
    throw new Error(`系数区哈希未提供——无法与钉死期望值比对，fail-closed`);
  }
  if (!SHA256_PATTERN.test(actual)) {
    throw new Error(`系数区哈希不是 64 位十六进制 sha256：${actual}`);
  }
  if (actual !== EXPECTED_COEFFICIENT_SHA256) {
    throw new Error(
      `系数区哈希与钉死期望值不一致：实际 ${actual} ≠ 期望 ${EXPECTED_COEFFICIENT_SHA256}` +
        `（求解器／特征／数据任一变化都会走到这里——须先确认冻结值是否应随之更新并另立变更）`,
    );
  }
}
