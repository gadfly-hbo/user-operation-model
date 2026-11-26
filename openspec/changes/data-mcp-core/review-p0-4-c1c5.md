# P0-4 第五轮定向复验：C1 与 C5

> 本记录由**独立复核 Agent** 产出，复核者未参与候选 `b49fc04` 的任何创作。
> 复核性质：**第五轮定向复验**，只复验两项（C1 · 占比是必填项、C5 · 错误路径测试的变异存活率），外加 D3–D6 四项附带核对，**不做全量复核**。
> 前序记录：`openspec/changes/data-mcp-core/review-p0-4-final.md`（第四轮，候选 `8c2e6f1`，结论「不建议合并」，C1 与 C5 未过）。
> 除本文件外，复核过程未在候选仓库留下任何改动：源码变异全部改完即用 `git checkout -- packages/` 还原，复核脚本一律放在仓库外的 `/tmp/uom-rev-5/`。

---

## 候选身份

| 项 | 内容 |
| --- | --- |
| commit SHA | `b49fc04f25e7b3375d579e5feed7f9f010eef482`（detached HEAD 检出） |
| 提交标题 | `fix: 补完第四轮复验残留，占比为必填项，错误类型断言补全` |
| 提交时间 | 2026-11-26T22:58:08+08:00 |
| 复验时间 | 2026-11-26 22:59–23:05 CST |
| 复验工作目录 | `/tmp/uom-review-p0-4d`（隔离验证根；本文件为唯一新增文件） |
| 变异/探针脚本 | `/tmp/uom-rev-5/`（`mutate.py`、`counter-probe.py`、`c1-check.mjs`、`real-check.mjs`、`zero-trace.mjs`、`d6-enoent.mjs`、`probe-empty.mjs`），全部在仓库外 |
| 真实样本 | `/tmp/uom-review-p0-4d/data/domains/`（软链到主工作目录，**只读**，全程未写入） |
| 复核依据 | `docs/normalize-rules.md` §5.2／§7.1／§7.2／§7.3／§7.4／§7.5／§11；`packages/core/src/normalize/*`、`packages/core/src/portrait/*`；`packages/core/test/normalize.test.ts`；`docs/engineering-workflow.md` §5 |
| 数据处理 | 本记录只记录错误类型、判定行为、结构计数与变异结果；**不含店铺名、画像占比明细等业务数值** |

### 本轮候选相对上一轮的实际改动

`git diff 8c2e6f1 b49fc04 -- packages/core/src/` 只有两个文件：

1. `packages/core/src/normalize/index.ts`：抖音／京东的「不可解析」判据由 `share === undefined && tgi === undefined` 改为 `share === undefined`；同时删除 `share ?? 0` 的兜底写法。
2. `packages/core/src/normalize/xlsx.ts`：新增 `existsSync` 的 ENOENT 前置守卫，并在 `catch` 中透传 `code === 'ENOENT'`。

测试文件 `packages/core/test/normalize.test.ts` 新增「第四轮补强：错误类型与 kind 的完整断言」一组 12 条用例；规则文档 `docs/normalize-rules.md` 新增 §7.3／§7.4 并改写 §5.2／§11。

---

## 实跑基线

在 `/tmp/uom-review-p0-4d`（detached HEAD `b49fc04`）执行：

| # | 命令 | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `npm ci --ignore-scripts` | 0 | **PASS** — 0 vulnerabilities |
| 2 | `npm run check`（`tsc -b` + `node --test`） | 0 | **PASS** — `tests 101 / suites 23 / pass 101 / fail 0 / skipped 0 / todo 0` |
| 3 | `npm audit --audit-level=high` | 0 | **PASS** — `found 0 vulnerabilities` |
| 4 | `python3 .github/scripts/check-docs-links.py .` | 0 | **PASS** — 「检查相对链接 **47** 条，错误 0，告警 0」 |
| 5 | `python3 .github/scripts/check-data-guard.py .` | 0 | **PASS** — 「数据守卫通过」 |

基线 5 项全绿。作者自述的「101 例全过 / 0 漏洞 / 47 条链接无错误」**三项全部核对一致**。

> 说明：变异测试阶段结束后重新执行第 2 项，仍为 101/101 通过，确认变异全部还原、候选源码未被污染。

---

## C1 验证

### C1.1 实现判据（`packages/core/src/normalize/index.ts`）

三个平台归一化入口的「不可解析」判定当前均为：

```
const share = parseShare(...);
const tgi = parseTgi(...);          // 天猫无 TGI 列
if (share === undefined) {          // ← 占比不可解析即该行不可用
  unparsable += 1;
  continue;                          // ← 该行被跳过，不再写入 share: 0
}
...
if (Object.keys(platformLabels).length === 0) {
  throw new NormalizationError('parse-error', ...);   // ← 整列不可用即抛错
}
```

即：抖音／京东的判据**只**看占比，不再因 TGI 正常而放行；天猫原本即如此，未变。

### C1.2 逐场景实测（脚本 `/tmp/uom-rev-5/c1-check.mjs`，直接调用构建产物，不依赖作者测试）

| # | 场景 | 期望 | 实测 | 判定 |
| --- | --- | --- | --- | --- |
| 1 | 抖音：占比列全为垃圾值、TGI 列正常 | 抛 `NormalizationError`，`kind === 'parse-error'`，**不得产出 `share: 0`** | 抛出 `NormalizationError` / `kind='parse-error'`，消息「抖音画像的占比列无法解析出任何数值（共 2 行数据）」；未返回任何画像，`share===0` 的标签数 **0** | **PASS** |
| 2 | 京东：同上 | 同上 | 抛出 `NormalizationError` / `kind='parse-error'`，消息「京东画像的占比列无法解析出任何数值（共 2 行数据）」；`share===0` 的标签数 **0** | **PASS** |
| 3 | 天猫：同上（回归） | 同上 | 抛出 `NormalizationError` / `kind='parse-error'` | **PASS** |
| 4 | 抖音：1 坏行（占比坏、TGI 好）+ 1 好行 | 坏行跳过、好行 `share` 正确（**不是 0**）、记 error 级 `parse-error` | 坏行「男」**未进入投影**；好行「女」`share=0.6`；`issues` 1 条 `kind='parse-error'` / `severity='error'` | **PASS** |
| 5 | 京东：同上 | 同上 | 坏行「女」未进入投影；好行「男」`share=0.4`；`issues` 1 条 `parse-error` / `error` | **PASS** |
| 6 | 天猫：同上（回归） | 同上 | 坏行未进入投影；好行「男」`share=0.6`；`issues` 1 条 `parse-error` / `error` | **PASS** |
| 7 | 抖音：占比正常、TGI 缺失 | 该行仍可用，`tgi` 为 `undefined`，**不补 0** | `platformLabels` 中该项为 `{share: 0.6}`，无 `tgi` 字段；`issues` 为空 | **PASS** |

**C1 结论：PASS。** 上一轮点名的「抖音／京东『占比列整列损坏、TGI 正常』静默降级投影出 `share: 0`」子场景已消失，三平台口径统一为「占比必填、TGI 可选」，与文档 §7.3 一致。

### C1.3 真实样本回归（脚本 `/tmp/uom-rev-5/real-check.mjs` + `zero-trace.mjs`）

真实样本 6 份（抖音 CSV×2、京东 XLSX×2、天猫 XLSX×2）全部归一化成功，**无抛错、无 `parse-error` 级 issue**：

| 样本 | 投影维度 | 投影标签 | issue 分布 | 六维主干投影 |
| --- | --- | --- | --- | --- |
| 抖音 ×2 | 19 | 2939 | `unmapped-dimension`×2 + `unmapped-value`×1（全 warning） | gender 2 / age 5 / strategy_segment 8 / spending_power 3 / city_tier 6 / life_stage 3 |
| 京东 ×2 | 21 | 172 | `unmapped-dimension`×11 + `unmapped-value`×1（全 warning） | gender 2 / age 5 / strategy_segment 10 / spending_power 5 / city_tier 6 / life_stage 0 |
| 天猫 ×2 | 27 | 377 / 381 | `unmapped-dimension`×14（全 warning） | gender 2 / age 5 / strategy_segment 9 / spending_power 5 / city_tier 6 / life_stage 4 |

- 维度数／标签数与上一轮记录（抖音 19/2939、京东 21、天猫 27）完全一致，**六维投影未受影响**。
- `life_stage` 在京东缺失属维度目录未登记京东源维度（与 C1 无关，非本轮回归面）。
- 真实样本中投影出的 `share === 0` 标签，经回溯确认**全部来自源数据本身的 0 值**（抖音单份样本源行 2985 行，其中 426 行占比解析为 0），**不存在「占比不可解析却被写成 0」的行**：源占比不可解析的行数 = 0（其中 TGI 正常的 = 0）。

---

## C5 变异测试结果

### 方法

- 在隔离验证根 `/tmp/uom-review-p0-4d` 内逐条改坏源码或测试断言 → `npm run build && npm test` 全量跑 → 记录失败用例 → `git checkout -- packages/` 还原。
- **共 68 条变异**：
  - **redo 组 26 条**：逐条复刻上一轮的 M1–M26（含上一轮存活的 12 条：M6/M7/M10/M11/M12/M13/M19/M20/M21/M22/M24/M26）。
  - **new 组 25 条**：针对 D1 修复与新增断言新设计的变异（M27–M51），含任务书点名的 6 类变异点与「占比必填 → share 与 tgi 均不可解析」等。
  - **assert 组 17 条**：**改测试期望值**（把断言的期望 kind／severity／code 改错），用来验证新增断言**不是空转**。
- 基线未变异时 101/101 通过。

### 判定标准

**存活（未覆盖）** = 改坏后没有任何测试失败。**等价变异**（可观察行为不变）单独标注，不计入存活。

### 5.1 redo 组（复刻上一轮 26 条）：24 杀死 / 2 存活

| 变异 | 改了什么 | 哪些测试失败 | 判定 |
| --- | --- | --- | --- |
| M1 | 移除抖音「占比全不可解析→抛 `parse-error`」整段检查 | 占比列全部无法解析时抛错，不静默返回空画像；抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M2 | 抖音部分行 issue 的 `severity: 'error'` → `'warning'` | 部分行类型不符时记 error 级问题并保留可解析的行 | **KILLED** |
| M3 | 抖音部分行 `unparsable += 1` 删除 | 部分行类型不符时记 error 级问题并保留可解析的行 | **KILLED** |
| M4 | 天猫「只有表头」判定 `rows.length-1` → `rows.length` | 天猫只有表头时抛错 | **KILLED** |
| M5 | 京东「只有表头」判定 `rows.length-1` → `rows.length` | 京东只有表头时抛错 | **KILLED** |
| M6 | 移除天猫「占比全不可解析→抛 `parse-error`」 | 天猫：占比列全部不可解析时抛 parse-error | **KILLED**（上一轮存活） |
| M7 | 移除京东「占比全不可解析→抛 `parse-error`」 | 京东：占比列损坏但 TGI 正常时仍抛错 | **KILLED**（上一轮存活） |
| M8 | 商品表「只有表头」判定 `<2` → `<1` | 商品表只有表头时抛错 | **KILLED** |
| M9 | 渠道表「只有表头」判定 `<2` → `<1` | 渠道表只有表头时抛错 | **KILLED** |
| **M10** | 移除商品表「空表→抛 `parse-error`」 | 无 | **SURVIVED（等价变异）**，见 5.4 |
| **M11** | 移除渠道表「空表→抛 `parse-error`」 | 无 | **SURVIVED（等价变异）**，见 5.4 |
| M12 | 商品表「行主键为空 → 记 error 级 `missing-field`」不再记 issue | 商品表：行主键为空时记 error 级 missing-field | **KILLED**（上一轮存活） |
| M13 | 渠道表「行主键为空 → 记 error 级 `missing-field`」不再记 issue | 渠道表：行主键为空时记 error 级 missing-field | **KILLED**（上一轮存活） |
| M14 | `readXlsxRows` 不再把底层库异常包装为 `NormalizationError` | 零字节 XLSX 抛 NormalizationError 而非底层库的原始错误 | **KILLED** |
| M15 | 「源维度未登记」不再报错 | 源维度未登记的映射被拒绝 | **KILLED** |
| M16 | 天猫 L1–L5 方向反转 | 已确认的映射参与解析；天猫消费能力在方向确认后正常投影 | **KILLED** |
| M17 | 天猫 L 映射改回 `needs-confirmation` | 已确认的映射参与解析；当前没有待确认的映射；天猫消费能力在方向确认后正常投影 | **KILLED** |
| M18 | 抖音「占比全不可解析」改为返回空画像而非抛错 | 占比列全部无法解析时抛错，不静默返回空画像；抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M19 | 天猫部分行不再计数 | 天猫：部分行不可解析时记 error 级 parse-error | **KILLED**（上一轮存活） |
| M20 | 京东部分行不再计数 | 京东：部分行不可解析时记 error 级 parse-error | **KILLED**（上一轮存活） |
| M21 | 商品表缺款号列从抛 `missing-field` 退回「记 issue 返回空」 | 商品表：缺主键列抛 missing-field | **KILLED**（上一轮存活） |
| M22 | 渠道表缺店铺编码列从抛 `missing-field` 退回「记 issue 返回空」 | 渠道表：缺主键列抛 missing-field | **KILLED**（上一轮存活） |
| M23 | 天猫「只有表头」检查整体移除 | 天猫只有表头时抛错 | **KILLED** |
| M24 | `readXlsxRows` 在 sheet 不存在时抛原始 `Error` 而非返回 `[]` | 天猫 sheet 名不符时抛错 | **KILLED**（上一轮存活；用例已从正则 `/为空|sheet/` 收紧为断言 `err.name === 'NormalizationError'`） |
| M25 | 归一化层全部 `parse-error` 改写为 `missing-field` | 部分行类型不符…；抖音/京东/天猫「占比列损坏」三条；天猫/京东部分行两条；商品表/渠道表空表两条 | **KILLED** |
| M26 | 归一化层全部 `missing-field` 改写为 `parse-error` | 商品表/渠道表缺主键列两条；商品表/渠道表行主键为空两条 | **KILLED**（上一轮存活） |

**redo 组：上一轮存活的 12 条中，11 条本轮被杀死**（M6、M7、M12、M13、M19、M20、M21、M22、M24、M26，以及 M10/M11 之外的其余）；**仅 M10、M11 存活，且经实证为等价变异**（见 5.4）。

### 5.2 new 组（针对 D1 修复与新增断言，M27–M51）：24 杀死 / 1 存活

| 变异 | 改了什么 | 哪些测试失败 | 判定 |
| --- | --- | --- | --- |
| M27 | 抖音「占比必填」判定改回「share 与 tgi 均不可解析」（**退回第三轮失败模式**） | 抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M28 | 京东「占比必填」判定改回「share 与 tgi 均不可解析」（**退回第三轮失败模式**） | 京东：占比列损坏但 TGI 正常时仍抛错；京东：部分行不可解析时记 error 级 parse-error | **KILLED** |
| M29 | 抖音「占比必填」判定改为「tgi 不可解析即不可用」（占比坏但 TGI 好时写 `share: 0`） | 抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M30 | 抖音部分行 issue 的 `kind` `parse-error` → `unmapped-value` | 部分行类型不符时记 error 级问题并保留可解析的行 | **KILLED** |
| M31 | 京东部分行 issue 的 `kind` `parse-error` → `unmapped-value` | 京东：部分行不可解析时记 error 级 parse-error | **KILLED** |
| M32 | 天猫部分行 issue 的 `kind` `parse-error` → `unmapped-value` | 天猫：部分行不可解析时记 error 级 parse-error | **KILLED** |
| M33 | 京东部分行 issue 的 `severity` `error` → `warning` | 京东：部分行不可解析时记 error 级 parse-error | **KILLED** |
| M34 | 天猫部分行 issue 的 `severity` `error` → `warning` | 天猫：部分行不可解析时记 error 级 parse-error | **KILLED** |
| M35 | 商品表主键空行 issue 的 `kind` `missing-field` → `parse-error` | 商品表：行主键为空时记 error 级 missing-field | **KILLED** |
| M36 | 渠道表主键空行 issue 的 `kind` `missing-field` → `parse-error` | 渠道表：行主键为空时记 error 级 missing-field | **KILLED** |
| M37 | 商品表主键空行 issue 的 `severity` `error` → `warning` | 商品表：行主键为空时记 error 级 missing-field | **KILLED** |
| M38 | 渠道表主键空行 issue 的 `severity` `error` → `warning` | 渠道表：行主键为空时记 error 级 missing-field | **KILLED** |
| **M39** | 移除 `readXlsxRows` catch 中的 `if (code === 'ENOENT') throw error;` 透传分支 | 无 | **SURVIVED（等价变异／死代码）**，见 5.4 |
| M40 | 移除 `readXlsxRows` 的 `existsSync` ENOENT 前置守卫 | 文件不存在时保留 ENOENT 语义，不包装成 parse-error | **KILLED** |
| M41 | 商品表空表抛错 `kind` `parse-error` → `missing-field` | 商品表：空表抛 parse-error | **KILLED** |
| M42 | 渠道表空表抛错 `kind` `parse-error` → `missing-field` | 渠道表：空表抛 parse-error | **KILLED** |
| M43 | 商品表缺主键列抛错 `kind` `missing-field` → `parse-error` | 商品表：缺主键列抛 missing-field | **KILLED** |
| M44 | 渠道表缺主键列抛错 `kind` `missing-field` → `parse-error` | 渠道表：缺主键列抛 missing-field | **KILLED** |
| M45 | 抖音「占比全不可解析」抛错 `kind` `parse-error` → `missing-field` | 抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M46 | 京东「占比全不可解析」抛错 `kind` `parse-error` → `missing-field` | 京东：占比列损坏但 TGI 正常时仍抛错 | **KILLED** |
| M47 | 天猫「占比全不可解析」抛错 `kind` `parse-error` → `missing-field` | 天猫：占比列全部不可解析时抛 parse-error | **KILLED** |
| M48 | 抖音部分行不再跳过（坏行写成 `share: 0`，复现第三轮失败模式） | 占比列全部无法解析时抛错，不静默返回空画像；抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED** |
| M49 | combined：`existsSync` 守卫与 catch 中的 ENOENT 透传**同时**移除 | 文件不存在时保留 ENOENT 语义，不包装成 parse-error | **KILLED** |
| M50 | 京东部分行不再跳过（坏行写成 `share: 0`） | 京东：占比列损坏但 TGI 正常时仍抛错 | **KILLED** |
| M51 | 天猫部分行不再跳过（坏行写成 `share: 0`） | 天猫：占比列全部不可解析时抛 parse-error | **KILLED** |

> M27／M28／M29／M48 首次尝试时因替换文本残留旧行导致 TypeScript 编译失败（`<BUILD-FAILED>`），**不构成有效杀死**；已修正替换模式后重跑，四条均由真实测试失败杀死，上表为重跑结果。

### 5.3 assert 组（改测试期望值，验证新增断言非空转）：17 / 17 杀死

| 变异 | 改了什么 | 哪些测试失败 | 判定 |
| --- | --- | --- | --- |
| T1 | 抖音「占比列损坏但 TGI 正常」用例期望 `kind` `parse-error` → `missing-field` | 抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0 | **KILLED**（断言有效） |
| T2 | 京东同 T1 | 京东：占比列损坏但 TGI 正常时仍抛错 | **KILLED** |
| T3 | 天猫「占比列全部不可解析」用例期望 `kind` `parse-error` → `missing-field` | 天猫：占比列全部不可解析时抛 parse-error | **KILLED** |
| T4 | 商品表空表用例期望 `kind` `parse-error` → `missing-field` | 商品表：空表抛 parse-error | **KILLED** |
| T5 | 渠道表空表用例期望 `kind` `parse-error` → `missing-field` | 渠道表：空表抛 parse-error | **KILLED** |
| T6 | 商品表缺主键列用例期望 `kind` `missing-field` → `parse-error` | 商品表：缺主键列抛 missing-field | **KILLED** |
| T7 | 渠道表缺主键列用例期望 `kind` `missing-field` → `parse-error` | 渠道表：缺主键列抛 missing-field | **KILLED** |
| T8 | 商品表主键空行用例期望 issue `kind` `missing-field` → `parse-error` | 商品表：行主键为空时记 error 级 missing-field | **KILLED** |
| T9 | 渠道表主键空行用例期望 issue `kind` `missing-field` → `parse-error` | 渠道表：行主键为空时记 error 级 missing-field | **KILLED** |
| T10 | 抖音部分行用例期望 issue `kind` `parse-error` → `unmapped-value` | 部分行类型不符时记 error 级问题并保留可解析的行 | **KILLED** |
| T11 | 天猫部分行用例期望 issue `kind` `parse-error` → `unmapped-value` | 天猫：部分行不可解析时记 error 级 parse-error | **KILLED** |
| T12 | 京东部分行用例期望 issue `kind` `parse-error` → `unmapped-value` | 京东：部分行不可解析时记 error 级 parse-error | **KILLED** |
| T13 | ENOENT 用例断言 `error.code === 'ENOENT'` → `'ENOENT-XX'` | 文件不存在时保留 ENOENT 语义，不包装成 parse-error | **KILLED** |
| T14 | 商品表主键空行用例期望 `severity` `error` → `warning` | 商品表：行主键为空时记 error 级 missing-field | **KILLED** |
| T15 | 渠道表主键空行用例期望 `severity` `error` → `warning` | 渠道表：行主键为空时记 error 级 missing-field | **KILLED** |
| T16 | 京东部分行用例期望 `severity` `error` → `warning` | 京东：部分行不可解析时记 error 级 parse-error | **KILLED** |
| T17 | 天猫部分行用例期望 `severity` `error` → `warning` | 天猫：部分行不可解析时记 error 级 parse-error | **KILLED** |

**结论：任务书点名的第 6 类变异（把断言的期望 kind 改掉）17/17 全部被抓住，无一条空转断言。** 上一轮「抛错的 kind 基本未被断言（M26 全改仍存活）」的缺口已闭合。

### 5.4 三条存活变异的性质判定（等价变异，不计入覆盖缺口）

三条存活变异经**逐条实测行为对照**（脚本 `/tmp/uom-rev-5/probe-empty.mjs`）确认，改坏前后**可观察行为不变**，属于等价变异，**不是无覆盖行为**：

| 变异 | 实测对照 | 性质判定 |
| --- | --- | --- |
| M10 移除商品表 `rows.length === 0` 检查 | 原始：`name=NormalizationError kind=parse-error msg="商品表为空、sheet 不存在或无法解析"`；变异后：`name=NormalizationError kind=parse-error msg="商品表只有表头，没有数据行"` | **等价变异**：后一道 `rows.length < 2` 检查仍抛同类型同 kind 的错，仅消息文案不同。断言（name + kind）本就抓不到它；该行为本身被 M25／M41 覆盖（kind 一改即失败） |
| M11 移除渠道表 `rows.length === 0` 检查 | 同上，仅消息由「渠道表为空…」变为「渠道表只有表头…」 | **等价变异**，同上 |
| M39 移除 `readXlsxRows` catch 中的 ENOENT 透传分支 | 原始与变异后「文件不存在」均得 `code=ENOENT` 的标准 `Error` | **等价变异／死代码**：缺文件由 `existsSync` 守卫先拦截；且 exceljs 的 `readFile` 对缺文件**不产生可识别的 ENOENT**（M40 移除守卫后行为立刻改变并被测试抓住，即为佐证）。该 catch 分支实际不可达，保留无害。M49（两处同时移除）被杀死，证明「ENOENT 不被包装」这一行为本身**有测试保护** |

### 5.5 C5 结论

| 分组 | 总数 | 杀死 | 存活 | 存活中属等价变异 |
| --- | --- | --- | --- | --- |
| redo（复刻上轮 26 条） | 26 | 24 | 2 | 2（M10、M11） |
| new（针对 D1 与新增断言） | 25 | 24 | 1 | 1（M39） |
| assert（断言非空转） | 17 | 17 | 0 | — |
| **合计** | **68** | **65** | **3** | **3（全部）** |

**C5 结论：PASS。** 变异存活数由上一轮的 **12 / 26** 降为 **0 / 65**（3 条存活经实证均为等价变异，不对应任何无覆盖行为）。上一轮列出的 6 类无覆盖行为全部闭合：

| 上一轮的 6 类无覆盖行为 | 本轮对应变异 | 结果 |
| --- | --- | --- |
| 1. 天猫／京东「占比全不可解析」检查 | M6、M7、M46、M47 | 全部 KILLED |
| 2. 商品表／渠道表「空表」检查 | M10、M11、M41、M42 | KILLED（M10/M11 等价；kind 改动 M41/M42 被杀） |
| 3. 商品表／渠道表「行主键为空 → error 级 issue」 | M12、M13、M35–M38 | 全部 KILLED |
| 4. 天猫／京东「部分行 → error 级 issue」 | M19、M20、M30–M34 | 全部 KILLED |
| 5. 缺主键列 → 抛 `missing-field` | M21、M22、M43、M44 | 全部 KILLED |
| 6. 抛错 `kind` 未被断言 | M25、M26、T1–T7、T10–T13 | 全部 KILLED |

### 5.6 附带：断言强度反探针（counter-probe）

三条「部分行」用例目前只断言了「好行投影值正确」与「存在 error 级 issue」，**未直接断言坏行不进入投影**。反探针（脚本 `/tmp/uom-rev-5/counter-probe.py`，在候选测试里临时补断言后跑全量）结果：

| 探针 | 补入的断言 | 结果 |
| --- | --- | --- |
| P1 | 抖音部分行：坏行标签应为 `undefined` | **断言成立**（可加） |
| P2 | 京东部分行：坏行标签应为 `undefined`，好行 `share=0.4` | **断言成立**（可加） |
| P3 | 天猫部分行：坏行标签应为 `undefined`，好行 `share=0.6` | **断言成立**（可加） |

注：M48／M50／M51（把坏行改写成 `share: 0`）均已被杀死，说明「坏行不进入投影」这一行为**已被间接覆盖**（同一代码分支服务整列与部分行两种场景，改分支即整列用例失败）。补入上述直接断言只是把覆盖从「间接」变「显式」，属**加固建议，非缺陷**。

---

## 附带核对 D3–D6

### D3 · 规则文档 §7.1／§7.2／§7.3 与代码实际行为一致 —— **PASS**

逐条对照文档声明与**代码实际行为**（非文档自述）：

| 文档条目 | 代码位置与实际行为 | 一致性 |
| --- | --- | --- |
| §7.1 `parse-error` 触发：文件为空、只有表头无数据行、sheet 不存在、占比列无法解析出任何数值、底层库无法解析文件 | `index.ts` 三个入口 + `product.ts` + `channel.ts` + `xlsx.ts` 包装，逐条命中 | 一致 |
| §7.2 文件为空 → `parse-error` | 五入口一致（0 字节 XLSX 经 `readXlsxRows` 包装；0 字节 CSV 经 `parseCsvRows` 返回空数组） | 一致 |
| §7.2 只有表头没有数据行 → `parse-error` | 天猫／京东用 `headerIndex >= rows.length - 1`；商品／渠道用 `rows.length < 2` | 一致 |
| §7.2 sheet 名不符 → `parse-error` | `readXlsxRows` 返回 `[]` → 入口按「文件为空」抛 `parse-error` | 一致 |
| §7.2 缺必要列（维度列／标签列／占比列）→ `missing-field` | 抖音缺「…-占比」列；天猫／京东缺维度／标签／占比列；商品／渠道缺主键列 | 一致 |
| §7.2 **占比列全部无法解析 → `parse-error`** | **三平台一致**（上一轮抖音／京东不成立，本轮已修） | 一致 |
| §7.2 底层库无法解析文件 → `parse-error` | `readXlsxRows` 包装，四入口一致 | 一致 |
| §7.2 商品／渠道表缺主键列 → `missing-field` | 一致 | 一致 |
| §7.2 部分行类型不符 → 不抛错、跳过并记 `parse-error`（error 级） | 一致（见 C1.2 场景 4–6） | 一致 |
| §7.3 占比是必填项：不可解析即该行不可用并计入 `parse-error`；整列不可用则抛错；**不因 TGI 正常就伪造 `share: 0`** | 代码即 `if (share === undefined) { unparsable += 1; continue; }` + `platformLabels` 为空即抛错 | 一致 |
| §7.3 TGI 是可选项：不落位、不补 0 | `...(tgi !== undefined ? { tgi } : {})`，无 `tgi` 时字段缺省 | 一致 |
| §7.5「某个标签缺失 → 不补 0」 | 与 §7.3 不再冲突（上一轮「抖音／京东写 `share: 0`」的不一致已随 D1 消除） | 一致 |

**D3 判定：PASS。** 唯一残留是一处**文案级**瑕疵（见「残留问题 1」），不影响文档与行为的一致性判定。

### D4 · §5.2 改为「构造期强制」并含「源维度必须已登记」 —— **PASS**

- 文档现写：「校验在**构造期强制**：`MappingTable.add()` 一旦加入跨族映射即抛错并拒绝入库，不依赖运行期再调用 `validate()`。`validate()` 保留为审计接口。」——与 `registry.ts` 的 `add()` → `validateOne()` → `problems.length > 0` 即抛错并**不入库**的实际代码一致。
- 文档现写：「**源维度必须已登记**：映射的源原生维度名必须在维度目录的 `sourceDimensions`／`sourceDimensionPatterns` 中登记……同样在 `add()` 时被拒绝。」——与 `validateOne()` 中 `findBySourceDimension(...)` 返回 `undefined` 即报「源维度未登记」的实际代码一致（M15 变异被杀死即为佐证）。

### D5 · §11 提到源维度须先登记 —— **PASS**

§11 扩展方式表已改写为：`| 新增跨平台标签映射 | portrait/catalog/mappings.ts | 否（映射的源维度须先登记，否则 add() 拒绝） |`。

**附带观察（非缺陷）**：§11 末句「运行时还可直接调用 `DimensionRegistry.register()`、`MappingTable.add()`、`FieldCatalog.add()` 动态追加。」未再次重复该约束；表格行已覆盖，建议在该句补一句括注，避免 P0-5 误用。

### D6 · 文件不存在抛标准 ENOENT；过松的 sheet 用例已收紧 —— **PASS**

**行为实测**（脚本 `/tmp/uom-rev-5/d6-enoent.mjs`，直接调用构建产物）：

| 入口 | 文件不存在时的错误 | 判定 |
| --- | --- | --- |
| 抖音（CSV） | `name=Error` / `code=ENOENT` | **PASS** |
| 天猫（XLSX） | `name=Error` / `code=ENOENT` | **PASS** |
| 京东（XLSX） | `name=Error` / `code=ENOENT` | **PASS** |
| 商品表（XLSX） | `name=Error` / `code=ENOENT` | **PASS** |
| 渠道表（XLSX） | `name=Error` / `code=ENOENT` | **PASS** |

补充：路径为目录时报 `code=EISDIR`（未被误包装成 `parse-error`，符合 §7.4 精神）。

**用例收紧核对**：上一轮指出的「天猫 sheet 名不符」用例原为正则 `/为空|sheet/`（连原始 `Error('no sheet')` 都能匹配），现改为断言 `error.name === 'NormalizationError'`；M24（sheet 不存在时抛原始 `Error`）本轮被该用例**杀死**，收紧有效。

---

## 结论

### 逐项状态

| 复验项 | 状态 |
| --- | --- |
| C1 · 占比是必填项 | **PASS** — 三平台口径统一；「占比列整列损坏、TGI 正常」一律抛 `NormalizationError`/`parse-error`，不再产出 `share: 0`；部分行坏行跳过、好行 `share` 正确、记 error 级 `parse-error`；真实样本 6 份零 `parse-error`、六维投影不变 |
| C5 · 错误路径测试的变异存活率 | **PASS** — 68 条变异，存活 3 条，经实证**全部为等价变异**（M10／M11／M39），**对应行为的存活数为 0**；上一轮 26 条中存活的 12 条已收敛到 2 条等价变异 |
| D3 · 文档 §7.1／§7.2／§7.3 与实现一致 | **PASS** |
| D4 · §5.2 改为构造期强制 + 源维度必须已登记 | **PASS** |
| D5 · §11 提到源维度须先登记 | **PASS** |
| D6 · ENOENT 语义 + sheet 用例收紧 | **PASS** |

### 整体结论：**PASS**

本轮两项阻断面（C1、C5）**均已真正落地并可复验**：

- C1 的修复在代码层是**结构性**的（判据从「share 与 tgi 均不可解析」改为「share 不可解析」，并删除 `share ?? 0` 兜底），不是靠特判绕过；M27／M28 两个「退回第三轮行为」的变异被杀死即是最直接证据。
- C5 的覆盖从「12 条新增用例」升级为「每条断言都同时钉住 `err.name` 与 `err.kind`／`severity`」：17 条「改期望值」变异全部被抓住，无空转断言；上一轮 6 类无覆盖行为全部闭合。
- 基线 5 项检查全绿，作者自述数字（101 例 / 0 漏洞 / 47 条链接）全部核对一致。
- 真实样本回归：抖音／京东／天猫各 2 份，投影维度数与标签数与上一轮完全一致，`parse-error` 级 issue 为 0，投影中的 `share === 0` 标签经回溯全部来自源数据的真实 0 值。

### 残留问题（均非阻断）

1. **【文案级】抖音／京东部分行 issue 的消息与判定口径不符**：`packages/core/src/normalize/index.ts` 中抖音／京东的 issue 文案仍写「有 N 行的**占比与 TGI 均**无法解析为数值，已跳过」，但判定口径自 D1 起**只看占比**（TGI 缺失不算不可解析）。天猫文案「有 N 行的占比无法解析为数值」是准确的。建议把抖音／京东文案统一为「有 N 行的占比无法解析为数值，已跳过」，与 §7.3「TGI 是可选项」一致。当前无测试断言该文案，影响仅限排查体验。
2. **【观察】`readXlsxRows` 的 `catch` 中 ENOENT 透传分支实际不可达**（`packages/core/src/normalize/xlsx.ts`）：缺文件由 `existsSync` 守卫先拦截，且 exceljs 对缺文件不产生可识别的 ENOENT（M40 的 killed 行为佐证）。该分支是防御性冗余，可保留也可删除；**不得**在删除 `existsSync` 守卫的同时保留它作为唯一防线（M49 证明两处必须同时在位才能保住 ENOENT 语义）。
3. **【观察】商品表／渠道表「空表」与「只有表头」两道检查互为冗余**：错误类型与 kind 一致，仅消息不同，故 M10／M11 存活属等价变异。若希望消息可区分，可把两处检查的文案区分得更明确（当前已区分），无需改代码。
4. **【加固建议】三条「部分行」用例未显式断言坏行不进入投影**：M48／M50／M51 已证明该行为被间接覆盖（改分支即整列用例失败），反探针 P1–P3 证明补入「坏行标签为 `undefined`」断言在现实现下即成立。可作为后续加固，非缺陷。
5. **【观察 · 非阻断，沿用上一轮】JD 的 `life_stage` 六维主干维度未投影**：京东样本无 `life_stage` 对应源维度登记（`unmapped-dimension` 11 条），属维度目录覆盖缺口，与本轮 C1／C5 无关；建议在 P0-5 之前确认是否补登记。

### 未验证项

| 项 | 状态 | 影响 |
| --- | --- | --- |
| spill 拆分消费、跨体系护栏、天猫 L1–L5 方向 | **NOT_RUN**（仅以 M15／M16／M17 三条变异间接确认未回归） | 本轮任务范围限定为 C1／C5；这三项上一轮已 PASS，本轮未重新做完整复验 |
| 断网状态下的离线可用性 | **NOT_RUN** | MCP 层尚未实现，无可跑对象 |
| DM08 的 MCP 返回值一致性、DM04 跨文件冲突、DM05 聚合层级画像 | **NOT_RUN** | 属 P0-5 及后续批次 |
| P0 阶段门禁 | **NOT_RUN** | P0-5／P0-6／P0-7 未完成 |
| 工具2 侧背对背隔离实际生效 | **NOT_PROVED** | 类型层与目录层已编码，工具2 实现后仍须独立复核 |
| 产品验收 | **NOT_RUN** | 由用户对固定候选作出 |

### 是否建议合并到 `main`

**建议合并。**

理由：本轮指定的两个阻断面（C1、C5）**均已通过且可复验**——C1 的修复是结构性的、真实样本零回归；C5 的变异存活数从 12/26 降到 0/65（3 条存活经实证均为等价变异，不对应任何无覆盖行为），且上一轮点名的 6 类无覆盖行为逐条闭合；D3–D6 四项附带核对全部 PASS；基线 5 项检查全绿。残留的 5 条均为文案级或观察级，不构成合并门槛。

仍须按仓库交付纪律分别报告的事项（本记录只覆盖独立复核，不代替工程检查、CI、Git 推送与产品验收）：

1. 本记录**不代替** P0 阶段门禁——P0-5／P0-6／P0-7 尚未完成，`docs/engineering-workflow.md` §4.6 的门禁条件不因本轮 PASS 而满足。
2. 合并前请按 §5.3 专项最终检查核对「数据不出网」「匹配内核唯一性」「背对背隔离」三项在**本候选实际改动范围内**的结论。
3. 建议顺带修掉残留问题 1（抖音／京东 issue 文案改为「占比无法解析为数值」），该改动不涉及逻辑，但能避免 P0-5 的日志排查被误导。

### 复核边界声明

- 复核全程在隔离验证根 `/tmp/uom-review-p0-4d` 内进行；除本文件外**未新增任何仓库内文件**，源码与测试的变异全部以 `git checkout -- packages/` 还原，结束时 `git status --porcelain` 为空（还原后再跑 `npm run check` 仍为 101/101 通过，确认未污染候选）。
- 变异测试共 68 条，全部记录于本文件；首轮因替换文本残留导致的 4 条编译失败已重跑复核，未计入有效杀死。
- `data/domains/` 全程只读（软链至主工作目录），未写入；主工作目录 `/Users/huangbo/Dev/Projects/user-operation-model` **仅被只读访问**。
- 真实业务数据未离开本机，未进入本报告正文（本记录只记录错误类型、判定行为、结构计数与变异结果，不含店铺名与经营数值）。
- 本记录只复验 C1、C5 两项与 D3–D6 四项附带核对，**不代替**全量复核、工程检查、CI 或产品验收。
