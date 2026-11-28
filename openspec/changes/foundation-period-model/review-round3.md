# 切片 A「时间与选择语义」· 第三轮独立复核报告

复核者：`SDD·TDD 独立复核者`（未参与候选任何部分，含 run5 修单；全程只读）
复核时间：2026-11-28
范围：只验第二轮复核（`.local/review-slice-a/round2/review-round2.md`）留下的应修 N1、N2、N3 是否真正修掉、有无新回归；顺带核对建议 S1、S2、S4、S5、S6
日志与脚本：`/Users/huangbo/Dev/Projects/user-operation-model/.local/review-slice-a/round3/`（`logs/`、`mutations.mjs`、`copy/r3-probe.mjs`）
状态词只用 `PASS`／`FAIL`／`NOT_RUN`／`UNKNOWN`／`NOT_PROVED`。

---

## 0. 从验收条目导出的预期清单（打开实现之前列出）

| # | 来源 | 预期 |
| --- | --- | --- |
| E1 | N1 修法 (b)／spec v0.4 | `isNaturalMonth` 严格 `^\d{4}-(0[1-9]|1[0-2])$`，不 trim、不接受 YYMM／区间／年份；`selectPortrait`、`periodCovers`、MCP `readMonth`／`readRequiredMonth`、工具1 `validateMonthOption` 同源 |
| E2 | N1 | D2／D3／D4（dossier 带空白／YYMM 指标静默落空）、T1（工具1 接受非法月）、T3（单价回退主数据）全部改为**显式拒绝**；`month: ""` 仍按未传 |
| E3 | N1／S1 | `parsePeriod` 标签解析不变（`2610`→`2026-10`、`2024`→year）；YYMM 碰撞窗口写入文档；v0.3「带空白按规范月查找」在 v0.4 明确作废 |
| E4 | N2 | C3／C3b 提示 `platform` 且传了即命中；C4／C4b 提示 `month` 且传了即命中（不再死循环）；C5 message 不把无月份那份说成「在某月」；S2 aggregate `months=[]` 提示可操作 |
| E5 | N2 | 第二轮 C1（同层区间标签不同 → platform）、C2（跨月 → month）、month-mismatch 提示未被改坏 |
| E6 | N3 | `result.md` 原话披露 `run4-fix2` RED 为 stash 回退事后取证、只证判别力、时序 `NOT_PROVED`；计数 GREEN 208/208、RED 20 中 9；SA-12 注明 334 款证据来源；补记 `monthWithinScope` 上限差异；永久性 `NOT_PROVED` 清单含 run4-fix2 |
| E7 | TDD | 测试提交在实现提交之前；新测试在修前实现上按目标断言失败（非环境／fixture／测试代码错误）；RED 日志与之相符 |
| E8 | 回归 | `npm run check` 全过；黄金／fidelity 冻结数字不变；边界路径零改动；演示报告字节不变；无新增依赖／数据文件 |

---

## 1. 候选身份与实际命令

| 项 | 值 |
| --- | --- |
| 工作树 | `/Users/huangbo/Dev/Projects/user-operation-model/.qoder/worktrees/agent-SDD-TDD-d0463d03`，分支 `work/foundation-period-model` |
| 候选 HEAD | `5490659`（前 7 位一致）；第二轮候选 `9e10e31`；merge-base `d138592` = `main` |
| 工作树状态 | `git status --porcelain` 为空、`git stash list` 为空（开始与结束各核一次） |
| 修单范围 | `9e10e31..5490659` 4 个提交、12 个文件（+317／−39）：`fb89328` test（仅 4 个测试文件）→ `a4ee40e` fix（`parse.ts`、`select.ts`、`server.ts`、`data-root.ts`）→ `ac1d8b3` docs → `5490659` docs(result) |
| 边界 | `git diff d138592..5490659 --stat -- packages/core/src/product/catalog/fields.ts packages/core/src/model packages/tool2-portrait-predict scripts .github templates package.json package-lock.json 'packages/*/package.json'` 输出为空；整切片 diff 中除 `site/web/tool1-report.html`（v0.2 授权）外无允许路径之外的文件；修单 diff 内无 csv／xlsx／json／lock 文件 |

**隔离声明**：未修改候选工作树任何文件；未做任何 git 写操作（含 stash）；变异与探针只在 `round3/copy/`（`cp -R` 整个候选含 `node_modules`）进行，还原一律从候选工作树 `cp` 覆盖，结束 `cmp` 四个被改文件均 IDENTICAL；实现回退只用了只读的 `git show 9e10e31:<path> >` 副本路径。主仓库只写 `.local/review-slice-a/round3/`。未读 `data/` 真实数据（例外只有 §1 表 #5、#6 两条只读门禁命令；黄金／fidelity 日志数值与店名已遮蔽，只保留 PASS 行与退出码）。探针全部用合成夹具，在断网守卫下运行（出网尝试 0）。本报告不含业务数值、店铺名、款号、画像份额。

| # | 命令（候选工作树内，除注明外） | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `git rev-parse --short=7 HEAD`／`branch --show-current`／`status --porcelain`／`stash list`／`merge-base main HEAD` | 0 | 身份一致、干净、无 stash（`5490659`，复核结束后再核仍一致） |
| 2 | `git diff 9e10e31..5490659 --stat`、`git log --stat 9e10e31..5490659`、`git show --stat fb89328` | 0 | 4 提交 12 文件；`fb89328` 只含 4 个测试文件 |
| 3 | `npm run check` | 0 | 构建 0 个 TS 错误；**647/647** PASS（第二轮 634，+13）（`logs/check.log`） |
| 4 | 上条边界 diff | 0 | 空 |
| 5 | `UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden` | 0 | G1–G5 全 PASS（`logs/golden.log`，数值已遮蔽） |
| 6 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 0 | 全 PASS（`logs/fidelity.log`，已遮蔽） |
| 7 | `npm run check:archive-content` | 0 | PASS |
| 8 | `python3 .github/scripts/check-docs-links.py .` | 0 | 145 条链接，0 错误 0 告警 |
| 9 | `python3 .github/scripts/check-data-guard.py .` | 0 | PASS |
| 10 | `node --import ./scripts/offline-check/block-net.mjs scripts/offline-check/guard-selftest.mjs` | 0 | 13 个出网入口全部拦截 |
| 11 | 副本：`npx tsc -b`；`node packages/tool1-channel-match/dist/src/bin.js --demo --out /tmp/uom-review-r3-demo.html`；`cmp` 候选 `site/web/tool1-report.html` | 0／0／0 | **逐字节一致**（sha256 前缀 `d96c6934c16d2725`，与前两轮相同；`site/` 不在修单 diff 内） |
| 12 | 副本：把 4 个实现文件覆盖为 `git show 9e10e31:<path>` → `tsc -b` → 跑 3 个新测试文件 | 构建 0；测试 1 | core 56 例 **5 失败**、tool1 18 例 **2 失败**、MCP 19 例 **7 失败**（见 §5；`logs/tdd-revert-*.log`） |
| 13 | 副本：守卫下 `node --import ./scripts/offline-check/block-net.mjs r3-probe.mjs`（合成夹具 + `InMemoryTransport` + 工具1 CLI 子进程） | 0 | 守卫出网计数 0；结果见 §2／§3／§8（`logs/probe.json`） |
| 14 | 副本：`node mutations.mjs`（12 个变异，每个：改副本源码 → `tsc -b` → `node --test` → 从候选 `cp` 还原 → `cmp`） | 0 | 11 杀死／1 存活（等价变异）；4 个被改文件还原后 `cmp` 全部 IDENTICAL，副本重新 `tsc -b` 退出码 0（`logs/mutations.log`、`mutations.json`） |

**NOT_RUN**：`npm run offline-check` 端到端段（需真实数据）；CI（未推送）；真实数据上的 MCP／工具1 运行（第二轮已记 `NOT_PROVED` 的范围不变）。

---

## 2. N1 · `month` 边界层严格校验 —— **PASS**

| 核对点 | 结论 | 实测证据 |
| --- | --- | --- |
| core `isNaturalMonth` 严格正则、不 trim | PASS | `parse.ts:13` `NATURAL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/`；`parse.ts:94-96` 直接 `test`，不再经 `parsePeriod`。探针：`'2026-10 '`、`' 2026-10'`、`'2610'`、`'2026-13'`、`'2026-1'`、`'2024'`、`'2025-07~2026-06'`、`''`、`'2026-00'`、`'2026-10\n'`、全角数字 → false；`'2026-10'`／`'2025-01'`／`'2026-12'` → true。变异 M01 杀死（4 失败） |
| `selectPortrait` 删除规范化 | PASS | `select.ts:114-120`：`!isNaturalMonth` → `invalid-month`，否则原串即查找值；探针 `'2026-10 '`、`' 2026-09'`、`'2610'`、`'2025-07~2026-06'`、`'2026-13'`、`'2024'`、`''` → `invalid-month`（零查找）。`select.ts` 内已无 `parsePeriod(...).month` 规范化。变异 M02 杀死（7 失败，含 v0.2 既有三例） |
| `periodCovers` 守卫 | PASS | `parse.ts:128-130`；探针 `'2610'`、`'2024-1'`、`'2026-10 '`、`' 2026-10'`、window 对 `'2610'` → false；`'2026-10'` → true。变异 M03 杀死（1 失败：`periodCovers(year,'2024-1')` 在无守卫下因字典序为 true） |
| `parse.ts` JSDoc 与行为一致 | PASS | `parse.ts:86-93`（严格判断、不裁空白、不接受 YYMM、宽松解析只用于标签）、`parse.ts:121-127`（`periodCovers` 入参）；第二轮 S3 指出的「`2610` 一律 false」字面不符已消除 |
| MCP `readMonth`／`readRequiredMonth` 同一判断 | PASS | `server.ts:193`、`:208` 均 `isNaturalMonth`；13 个调用点（10 个 `readMonth` + 3 个 `readRequiredMonth`）。探针逐个工具传 `'2610'`、`'2026-10 '`、`' 2026-10'`、`'2025-07~2026-06'`、`'2026-13'`：`list_channels`、`get_channel_portrait`、`get_product_portrait`、`get_brand_portrait`、`get_competitor_portrait`、`get_product_dossier`、`search_similar_products`、`get_portrait_aggregate`、`compare_product_channel`、`search_by_tag`、`get_recency_distribution`、`get_channel_flow_matrix`、`get_diagnosis` **13/13 → `invalid-argument`**；message 形如 `month 必须是 YYYY-MM，收到 2026-10 `（回显原值）、hint `自然月写法示例：2026-10`。变异 M07（`readMonth` 不校验）杀死 12 失败、M08（`readRequiredMonth` 不校验）杀死 3 失败——MCP 层有自己的判别测试，不只靠 core |
| `month: ""` 仍按未传 | PASS | `server.ts:192`；探针 `get_product_dossier({spu, month:''})` 与不传 `month` 的返回逐字节相同 |
| 工具1 `validateMonthOption` | PASS | `data-root.ts:35-40` 走 `isNaturalMonth`（本批只改注释，代码随单一来源收紧）；`bin.ts:160-161` 在加载数据前校验，`reference.ts:132` 亦先校验。探针 CLI：`--month 2610`／`"2026-10 "`／`" 2026-10"`／`2025-07~2026-06` → **exit 1、产物目录 0 个文件**、stderr 尾行 `month 必须是 YYYY-MM，收到 …`；`--demo --month 2610` 同样 exit 1 零产物；既有 `2026-13` 仍拒绝。变异 M06 杀死（3 失败） |
| D2／D3／D4 形态由静默改为拒绝 | PASS | 探针 `get_product_dossier({spu:'SPU-003', month:'2026-10 '})` → `invalid-argument`（第二轮为 `ok` 且 `performance`／`funnel`／`channelPerformance` 全空）；`' 2026-09'`、`'2610'` 同。对照 D1：`month:'2026-10'` → `ok`，`performance` 键为 `['2026-10']`（夹具含该月经营指标） |
| T1／T3 形态 | PASS | T1：`buildDataRootDataset`／`buildReferenceDataset` 对三种写法均抛 `month 必须是 YYYY-MM`（`tool1/test/dataset.test.ts` run5 两例 + 探针 CLI）。T3：`data-root.ts:150-171` 的 `selectedMonth` 只来自已校验的 `options.month` 或 `indexMonths`（自然月），`resolveUnitPrice`／`resolveRetailAmount` 不再收到原串。渠道入口 `'2610'`：第二轮被当 `2026-10` 命中，现 `invalid-argument`；`'2026-10'` 对照 `ok` |
| 标签解析未受影响 | PASS | 探针 `parsePeriod('2610')`→`month 2026-10`、`'2412'` 同理、`'2024'`→`year`、`'2025-07~2026-06'`→`window`、`'0000'`／`'9999'`／`'2113'`→unknown；`identity.ts` 不在修单 diff 内，既有测试随 647 全过 |
| 文档一致 | PASS（附建议 S3） | `mcp-usage.md:100`（严格判断：不裁空白、不接受 YYMM）、`:103`（无月份形态措辞）；`normalize-rules.md:37-41`（S1 碰撞窗口 + 入参严格判断）；`spec.md` v0.4 节 `:133` 明确「v0.3 的『带首尾空白的 `month` 按规范月查找』作废，改为严格校验」并给出理由。docs-links 0 错误。轮空枚举漏 `2000`，见 §8 S3 |

---

## 3. N2 · 歧义提示对无月份画像形态 —— **PASS**

实现：`select.ts:37`（`ambiguous` 结果新增 `hasMonthless`，两处分支 `:144`、`:178`）；`server.ts:122-125`：

```
allShareOneMonth = months.length === 1 && !hasMonthless
platformHint     = platforms.length > 1 && (reason === 'platform' || months.length === 0 || allShareOneMonth)
```

| 形态（合成夹具，`logs/probe.json` `n2`） | 结论 | 实测 |
| --- | --- | --- |
| **C3** 两份无月份、不同平台、不带 month（D00007） | PASS | `ambiguous`，message「渠道 D00007 有多平台画像（平台：douyin、tmall）」（不再有「在  有多平台」），hint「传 platform 参数消歧（可选平台：douyin、tmall）」；第二轮是「传 month 参数（没有可作为 month 的画像期间）」 |
| **C3b** 传 `platform:'douyin'`／`'tmall'` | PASS | 均 `ok` |
| **C4** 无月份 + `2026-10`、同平台、不带 month（D00008） | PASS | message「有多份画像（月份：2026-10）」，hint「传 month 参数（可用月份：2026-10）」；不再提示 platform |
| **C4b** 传 `month:'2026-10'` | PASS | `ok`（exact 层）；只传 `platform:'douyin'` 仍 `ambiguous` 且提示**传 month**——死循环消失（第二轮照旧提示传 platform） |
| **C5** 无月份（抖音）+ `2026-10`（天猫）、不带 month（D00009） | PASS | message「有多份画像（月份：2026-10；平台：douyin、tmall）」（无「在某月有多平台画像」），hint 传 month；传 `month:'2026-10'`／`'2026-11'`／`platform:'douyin'` 均 `ok` |
| **S2** aggregate 成员全无月份（SPU-004） | PASS | message「成员 SPU-004 有多份画像（无月份）」，hint「成员为无月份画像：传任意月份（YYYY-MM）即可聚合（无月份画像对任意月份均参与）」；传 `month:'2026-10'` → `ok` |
| 第二轮 C1：抖音 `2026-07~2026-09` + 天猫 `2026-08~2026-10`，查 `2026-09` | PASS（未改坏） | 「在 2026-09 有多平台画像（平台：douyin、tmall）」+ 传 platform；传 `platform:'tmall'` → `ok` |
| 第二轮 C2：同平台两份区间、不带 month | PASS（未改坏） | 列出两个区间标签，hint「传 month 参数（区间／年份画像：month 须为落在 … 内的自然月（YYYY-MM））」；传 `month:'2025-03'` → `ok` |
| month-mismatch（两个单月标签） | PASS（未改坏） | 「渠道 D00001 在 2026-11 无画像」，hint「可用月份：2026-09、2026-10」 |
| 商品侧／similar／compare 共用判定 | PASS | `get_product_portrait({spu:'SPU-005'})`、`search_similar_products` → 提示传 month（可用月份：2026-10），传月 `ok`；`compare_product_channel` 对 D00008 提示传 month、对 D00007 提示传 `channelPlatform` |

变异：M04（条件改回 `months.length === 1 || reason === 'platform'`）杀死 3 失败（C3、C4、C5）；M05a（不带 month 分支 `hasMonthless` 恒 false）杀死 1（C5）；M09（aggregate `months=[]` 提示退回旧文案）杀死 1（S2）；M10（message 无条件带「在 <月>」）杀死 1（C3）。

---

## 4. N3 · 记录 —— **PASS（附应修 R3-1，见 §8）**

| 核对句 | 结论 | 位置与实测 |
| --- | --- | --- |
| 原话披露 `run4-fix2-hints.log` RED 为 `git stash` 回退重取、只证判别力、时序 `NOT_PROVED` | PASS | `result.md:126`：与第二轮建议原话逐句对应（事后取证／`git stash`／20 例中 9 例／不证明先红后绿／`NOT_PROVED`／判别力由复核变异背书）；`:124` 由「逐条均先真实 RED」改为「除 run4-fix2 组（见下方如实披露）外」 |
| 计数 | PASS | `result.md:130` GREEN `208/208`（原 10/10）；`:126`、`:130` RED `20 例中 9 例`；我核对日志：`red/run4-fix2-hints.log` 20 例 9 失败、`green/run4-fix2-hints.log` 208/208 |
| SA-12 注明 334 款计数证据来源（S5） | PASS | `result.md:36`：注明来自 `accept/capture-*.log`、复核者未读真实数据记 `UNKNOWN` |
| 补记 `monthWithinScope` 上限差异（S4） | PASS | `result.md:105` 偏差 8 |
| 「第二轮复核后修正」小节列 N1／N2／N3 修法与证据路径 | PASS | `result.md:156-164`；我核对 `red/green/run5-*.log` 存在且计数与所述一致（`n1-core` 56 例 5 失败、`n1-tool1` 18 例 2 失败、`n1n2-mcp-hints` 19 例、CLI 修前 exit 0 有产物→修后 exit 1 零产物） |
| 永久性 `NOT_PROVED` 清单含 run4-fix2 | PASS | `result.md:172` 累计清单；`:3` 状态行同步 |
| 「本轮逐条先真实 RED（目标断言失败，零环境／fixture 错误）」 | **FAIL（局部）** | `result.md:158` 与 `green/run5-final.log:16`「19 例中 8 失败，全 ERR_ASSERTION」不准确：C4b 一例是测试代码 `TypeError`，见 §5 与应修 R3-1 |
| 本轮门禁数字 | PASS | `result.md:174` 647/647 与我复跑一致 |

---

## 5. TDD 时序（run5）

- **提交顺序**：`fb89328`（test，只含 `period.test.ts`、`portrait-select.test.ts`、`period-hints.test.ts`、`dataset.test.ts`）在 `a4ee40e`（fix）之前，PASS。四次提交集中在 21:27:24–21:27:30，说明是在工作树里完成 RED→GREEN 后一次性提交；提交时间戳本身不能证明时序。
- **RED 日志内容**（`red/run5-*.log`，mtime 21:21:33–21:21:50，早于 GREEN 日志 21:23:04–21:24:03）：
  - `run5-n1-core.log`：56 例 5 失败，全部 `ERR_ASSERTION`（`periodCovers '2610'`、`isNaturalMonth`、三例 `invalid-month`）。
  - `run5-n1-tool1.log`：18 例 2 失败，`ERR_ASSERTION`（Missing expected rejection／exception）。
  - `run5-n1n2-mcp-hints.log`：19 例 8 失败，其中 **7 个 `ERR_ASSERTION`**（D2、D3/D4、渠道 `2610`、C3、C4、C5、S2），**1 个 `TypeError: Cannot read properties of undefined (reading '0')`**（C4b，`period-hints.test.js:266:36`）。
  - `run5-n1-cli.log`：`2610`、`"2026-10 "` 修前 exit 0 且产生产物（缺陷形态），GREEN 为 exit 1 零产物。
- **独立复现判别力**：副本把 4 个实现文件覆盖为 `9e10e31` 版本后跑入库测试——core 5 失败（与 RED 日志同一组）、tool1 2 失败（同）、MCP **7 失败**（与 RED 日志的 7 个断言失败同一组）。**C4b 在修前实现上通过**。
- **判定**：14 例（5+2+7）目标断言 RED 成立且提交顺序正确 → **PASS**；C4b 的「RED」不成立——RED 时的测试源与入库版不同（入库版用 `.find`／`length===2`，无 `[0]` 读取），入库版 C4b 是现状锁定测试（修前修后都通过），其 TDD 时序记 **NOT_PROVED**（无碍，该例本就不是为了驱动实现）。

---

## 6. 既有测试改动判断

| 测试 | 改动 | 判断 |
| --- | --- | --- |
| `core/test/period.test.ts:147` `periodCovers(p,'2610')` `true`→`false` | 契约收紧的**覆盖转移**，非削弱 | 不变量「非自然月入参不得按写法猜测比较」保留且更严；同组新增 `'2026-10 '` → false 与整组 `isNaturalMonth` 断言（12 个用例）。第二轮 N1／S3 指出的 JSDoc 与断言矛盾以此方式解决（取 v0.4 方案 (b)） |
| `core/test/portrait-select.test.ts:296-320` 带空白两例 `found`→`invalid-month` | 契约收紧的覆盖转移，非削弱 | 断言由 `status === 'found'` 升级为 `deepEqual({status:'invalid-month', month})`；`'2026-13 '` 既有拒绝例保留，新增 `'2610' → invalid-month`。规范写法的命中用例（exact／window／year）未动 |
| `period-hints.test.ts` 新增夹具（SPU-004／005、演示账号7／8／9） | 纯新增 | 既有断言未删（`git diff … | grep '^-.*assert'` 只有上述 3 行改写） |

`result.md:166-170` 对两处改写的解释与我的判断一致。

---

## 7. 变异表（全部在 `round3/copy/`，还原后 4 文件 `cmp` IDENTICAL，副本重新构建退出码 0）

| 变异 | 文件 | 跑的测试 | 结果 |
| --- | --- | --- | --- |
| M01 `isNaturalMonth` 改回 `parsePeriod(label).kind === 'month'`（可 trim、接受 YYMM） | `core/src/period/parse.ts:95` | core period + portrait-select | **杀死**（4 失败） |
| M02 `selectPortrait` 删除 `invalid-month` 分支 | `core/src/period/select.ts:116` | 同上 | **杀死**（7 失败） |
| M03 `periodCovers` 去掉自然月守卫 | `core/src/period/parse.ts:129` | 同上 | **杀死**（1 失败） |
| M04 N2 平台提示条件改回 `months.length === 1 \|\| reason === 'platform'` | `data-mcp/src/server.ts:123-125` | mcp period-hints + period-query + p0-completion（98 例） | **杀死**（3 失败：C3、C4、C5） |
| M05a 不带 month 分支 `hasMonthless` 恒 false | `core/src/period/select.ts:144` | mcp period-hints | **杀死**（1 失败：C5） |
| M05b 带 month 分支 `hasMonthless` 恒 false | `core/src/period/select.ts:178` | mcp period-hints | **存活（等价变异）**：该分支 `reason === 'platform'` 已使 `platformHint` 为真，字段对现有提示判定无影响；core 层无断言锁定该分支的 `hasMonthless`（建议 S4） |
| M06 工具1 `validateMonthOption` 空操作 | `tool1/src/dataset/data-root.ts:38` | tool1 dataset | **杀死**（3 失败） |
| M07 MCP `readMonth` 不校验 | `data-mcp/src/server.ts:193` | mcp 三套件 | **杀死**（12 失败） |
| M08 MCP `readRequiredMonth` 不校验 | `data-mcp/src/server.ts:208` | mcp 三套件 | **杀死**（3 失败：recency／flow-matrix／diagnosis） |
| M09 aggregate `months=[]` 提示退回旧文案 | `data-mcp/src/server.ts:630-632` | mcp period-hints | **杀死**（1 失败：S2） |
| M10 message 无条件带「在 <月>」 | `data-mcp/src/server.ts:130` | mcp period-hints | **杀死**（1 失败：C3） |
| M11 回归哨兵：`platform: ''` 绕过歧义（第二轮应修-3） | `core/src/period/select.ts:109` | core portrait-select | **杀死**（2 失败）——确认本轮未改坏 |

**存活 1（等价变异）**。

---

## 8. 新发现

### 阻断
未发现。四条硬约束仍成立（边界 diff 空；黄金与 fidelity 复跑 PASS；无新增依赖；diff 内无数据文件与网络调用；探针在守卫下出网计数 0）。

### 应修（合并前处理；不处理须在 `result.md` 记为已知限制并由负责人接受）

**R3-1 · 记录：run5 MCP 组的 RED 计数与「零错误」表述不准确，C4b 测试在 RED 后被改写且未披露**
- 位置：`openspec/changes/foundation-period-model/result.md:158`（「本轮逐条先真实 RED（目标断言失败，零环境／fixture 错误）」）；`.local/slice-a/green/run5-final.log:16`（「19 例中 8 失败，全 ERR_ASSERTION」）。
- 事实：`red/run5-n1n2-mcp-hints.log` 的 8 个失败中，C4b 是 `TypeError: Cannot read properties of undefined (reading '0')`——测试代码自身错误，按规范 §4.3 不算产品 RED；RED 时的测试源与入库版不同（入库版 `period-hints.test.ts:351-364` 用 `.find`／`length===2`），入库版 C4b 在修前实现上通过（§5 独立复现：19 例 7 失败）。C4b 是现状锁定测试（证明「只传 platform 仍是歧义」），不是 RED→GREEN；其测试名「死循环留存证明」与断言（`withPlatform.ok === false`）在修前也成立。
- 影响：只影响记录真实性，不影响代码正确性（N2 的判别力由其余 7 例 + 变异 M04／M05a／M09／M10 独立背书）。
- 修法：`result.md` 与 `run5-final.log` 口径改为「19 例中 7 例目标断言失败 + 1 例测试代码 TypeError（C4b）」，并注明 C4b 在 RED 后改写为现状锁定测试、其 TDD 时序 `NOT_PROVED`。

### 建议

- **S1（N2 同根，措辞）** `packages/data-mcp/src/server.ts:127-134`：带 `month`、最优层为无月份画像且多平台时，message 仍写「在 <month> 有多平台画像」（探针 X1：D00007 `month:'2026-11'` → 「渠道 D00007 在 2026-11 有多平台画像（平台：douyin、tmall）」），而两份画像都是无月份（命中方式 unknown）。hint 方向正确（传 platform 即 `ok`），与 `server.ts:121` 注释立下的「不得把无月份画像说成在某月」原则不一致。修法：`selection.hasMonthless && selection.months.length === 0` 时不带「在 <月>」。
- **S2（注释）** `packages/core/src/period/select.ts:112-113`「规范化上移到边界层（MCP readMonth／工具1 validateMonthOption）」与实现不符——边界层不规范化而是拒绝（v0.4，`server.ts:186-187`、`data-root.ts:35`）。第二轮 S6 要求改注释，本轮改后仍留此误导句；建议改为「边界层以同一 `isNaturalMonth` 严格拒绝，不做规范化」。
- **S3（文档）** `docs/normalize-rules.md:39` 与 `spec.md:134`：轮空到全年区间分支的枚举「只有 1900、1913–1999、2013–2099、2100」漏了 **`2000`**（末两位 `00` 不成月份，实测 `parsePeriod('2000')`→year）。碰撞窗口枚举（2001–2012、1901–1912、2101–2112）本身正确。
- **S4（等价变异）** M05b 存活：`select.ts:178` 带 `month` 分支的 `hasMonthless` 无 core 层断言、对现有提示判定无影响。可在 `portrait-select.test.ts` 加一例锁定该分支 `hasMonthless: true`（API 契约），或该分支不下发该字段。
- **S5（备注，非缺陷）** `isNaturalMonth('0000-01')` 为 true（只校验格式不校验年份范围）；与修前（`parsePeriod` 同样放行）一致、spec v0.4 只要求「四位年」，非回归，记一笔。

---

## 9. 总结论

**PASS（附带条件）**

- N1 **PASS**（core／MCP 13 个工具／工具1 两条数据路径与 CLI 全部显式拒绝，不再静默；标签解析、`month: ""` 语义、黄金／fidelity 不变）；N2 **PASS**（C3／C3b、C4／C4b、C5、S2 全部按形态给出可操作提示，C1／C2／month-mismatch 未改坏）；N3 **PASS 附 R3-1**。TDD 时序：14 例目标断言 RED 成立、提交顺序 test→fix，**PASS**；C4b 一例 NOT_PROVED。既有测试改动均为契约收紧的覆盖转移。
- 八项门禁我独立复跑全部退出码 0（647/647）；演示报告逐字节一致；边界路径零改动；12 个变异 11 杀死、1 个等价存活。
- **附带条件（合并前）**：处理应修 R3-1（仅记录，改 `result.md` 与 `run5-final.log` 口径）；建议 S1–S4 可随后续切片或并入本次（S1 若改代码需补一例 RED→GREEN 并重验 `period-hints.test.ts`）。不处理者须在 `result.md` 记为已知限制并由负责人接受。
- **永久性 `NOT_PROVED`（如实保留）**：第二轮累计清单不变（SA-08 `resolveUnitPrice`／`resolveRetailAmount`、SA-04 三例、工具1 侧集成、run4-fix2 组）；本轮新增 C4b（现状锁定测试，无实现驱动意义）。
- **未核实项**：真实数据面（`NOT_RUN`，未读 `data/`；SA-04／05／08／09 真实数据 `NOT_PROVED` 沿第二轮）；CI、`npm run offline-check` 端到端 `NOT_RUN`；`selectPortraitOrError` 中「`months=[]` 且平台 ≤ 1」的 month 提示分支（`server.ts:149`，同平台多份无月份画像不带 month）我未能构造出触发它的夹具，可达性 `UNKNOWN`；run5 时序的日志 mtime 属文件系统元数据，非强证明，结论以提交顺序 + 日志内容 + 独立复现判别力三者一致为据。
