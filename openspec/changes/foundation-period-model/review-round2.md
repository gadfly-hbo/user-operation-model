# 切片 A「时间与选择语义」· 第二轮独立复核报告

复核者：`SDD·TDD 独立复核者`（未参与候选任何部分，含修单；全程只读）
复核时间：2026-11-28
范围：只验第一轮复核（`.local/review-slice-a/review.md`）之后的修单是否把问题真正修掉、是否引入回归
日志与脚本：`/Users/huangbo/Dev/Projects/user-operation-model/.local/review-slice-a/round2/`（`logs/`、`mutations.mjs`、`copy/`）
状态词只用 `PASS`／`FAIL`／`NOT_RUN`／`UNKNOWN`／`NOT_PROVED`。

---

## 1. 候选身份与实际命令

| 项 | 值 |
| --- | --- |
| 工作树 | `/Users/huangbo/Dev/Projects/user-operation-model/.qoder/worktrees/agent-SDD-TDD-d0463d03`，分支 `work/foundation-period-model` |
| 候选 HEAD | `9e10e31`（前 7 位核对一致）；第一轮候选 `a1ae9ba`；merge-base `d138592` = `main` |
| 工作树状态 | `git status --porcelain` 为空；`git stash list` 为空（复核开始与结束各核一次） |
| 修单范围 | `a1ae9ba..9e10e31` 共 6 个提交、25 个文件（+710／−121），无删除文件 |
| 整切片范围 | `d138592..9e10e31` 48 个文件 |
| 边界 | `git diff d138592..9e10e31 -- packages/core/src/product/catalog/fields.ts packages/core/src/model packages/tool2-portrait-predict scripts .github templates package.json package-lock.json 'packages/*/package.json'` 输出为空（退出码 0） |

**隔离声明**：未修改候选工作树任何文件；未做任何 git 写操作；变异只在 `round2/copy/`（`cp -R` 整个候选含 `node_modules`）进行，还原一律从候选工作树 `cp` 覆盖，结束逐个 `cmp` 一致（见 §6）；主仓库只写 `.local/review-slice-a/round2/`。未读 `data/` 真实数据（例外只有 §1 表 #8、#9 两条只读门禁命令）。本报告不含业务数值、店铺名、款号、画像份额；`logs/golden.log`、`logs/fidelity.log` 的数值与店名已遮蔽，只保留 PASS 行与退出码。

| # | 命令（候选工作树内，除注明外） | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `git rev-parse --short=7 HEAD` / `branch --show-current` / `status --porcelain` / `stash list` / `merge-base main HEAD` | 0 | 身份一致、干净、无 stash |
| 2 | `git diff a1ae9ba..9e10e31 --stat/--name-status`、`git log --oneline a1ae9ba..9e10e31` | 0 | 6 提交 25 文件 |
| 3 | `npm run check` | 0 | 构建 0 TS 错误；**634/634** PASS（第一轮 608，+26）（`logs/check.log`） |
| 4 | 上条边界 diff | 0 | 空 |
| 5 | `UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden` | 0 | G1–G5 全 PASS，与冻结基线一致（`logs/golden.log`，数值已遮蔽） |
| 6 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 0 | 全 PASS，冻结数字不变（`logs/fidelity.log`，已遮蔽） |
| 7 | `npm run check:archive-content` | 0 | PASS |
| 8 | `python3 .github/scripts/check-docs-links.py .` | 0 | 145 条链接，0 错误 0 告警 |
| 9 | `python3 .github/scripts/check-data-guard.py .` | 0 | PASS（无输出） |
| 10 | `node --import ./scripts/offline-check/block-net.mjs scripts/offline-check/guard-selftest.mjs` | 0 | 13 个出网入口全部拦截 |
| 11 | 副本：`npx tsc -b`；`node packages/tool1-channel-match/dist/src/bin.js --demo --out /tmp/uom-review-r2-demo.html`；`cmp` 入库 `site/web/tool1-report.html` | 0 / 0 / 0 | **逐字节一致**（sha256 前缀 `d96c6934c16d2725`，与第一轮相同；`site/**` 不在修单 diff 内） |
| 12 | 副本：守卫下 `r2-probe.mjs`（合成夹具 + `InMemoryTransport`） | 0 | 守卫计数 0；结果见 §2／§3／§7（`logs/probe.log`） |
| 13 | 副本：守卫下 `r2-probe2.mjs`（compare 两侧 hint、`validateMonthOption`、`resolveUnitPrice` 原样入参） | 0 | 守卫计数 0（`logs/probe2.log`） |
| 14 | `node mutations.mjs`（12 个变异，每个：改副本源码 → `tsc -b` → `node --test` → 从候选 `cp` 还原） | 0 | 11 杀死／1 存活（等价变异），6 个被改文件还原后 `cmp` 全部一致（`logs/mutations.log`、`.json`） |

**NOT_RUN**：`npm run offline-check` 端到端段（需真实数据）；CI（未推送）；真实数据上的 MCP／工具1 运行与 `capture.mjs` 重跑（只审主 agent 的 `real-unit-structured-diff.json` 结构，未读真实数据）。

---

## 2. 第一轮应修 1–7 逐条结论

| # | 结论 | 实测证据 |
| --- | --- | --- |
| 应修-1 平台歧义 hint 指错方向 | **PASS** | 第一轮复现形态（抖音 `2026-07~2026-09` + 天猫 `2026-08~2026-10`，查 `2026-09`）：`get_channel_portrait` → `ambiguous`，message「…在 2026-09 有多平台画像（平台：douyin、tmall）」，hint「传 platform 参数消歧（可选平台：douyin、tmall）」（probe C1）；`compare_product_channel` 同形态 hint 指 `channelPlatform`（probe E1）；不带 month 的跨月歧义 hint 仍指 month（C2）。`get_portrait_aggregate` 不带 month 的成员歧义提示固定为「传 month」（`server.ts:610-613`）：对同月多平台成员该提示**可操作**（带 month 时聚合含全部平台，`query.ts:361`），判定 PASS，措辞见建议 S2。变异 R2-M01 杀死 |
| 应修-2 hint「可用期间」是校验拒绝的值 | **PASS** | 区间／年份标签 → 「month 须为落在 2025-07~2026-06 内的自然月（YYYY-MM）」（可操作，`describeAvailablePeriods`，`parse.ts:95-109`）；单月标签 → 「可用月份：2026-09、2026-10」（测试 `period-hints.test.ts:169-185`）；dossier `month-mismatch`、compare not-found、aggregate 同走该函数（`server.ts:153,161,512,613,728-729`）。变异 R2-M09 杀死。无月份画像形态的文案问题另记 N2 |
| 应修-3 `platform: ''` 绕过歧义 | **PASS** | `selectPortrait({…, month:'2026-10', platform:''})` → `ambiguous(platform)`；不带 month 多份 → `ambiguous(month)`（probe B1、`portrait-select.test.ts:275-292`）；`select.ts:83-85` 两处统一。变异 R2-M07 杀死 |
| 应修-4 带空白 `month` 等价于规范写法 | **FAIL（端到端）**；`selectPortrait` 层 PASS | core：`month:'2026-10 '` → `found(exact)`（probe B2）。但 **MCP `readMonth`／`readRequiredMonth`（`server.ts:176-203`）与工具1 `validateMonthOption`（`data-root.ts:36-41`）仍原样透传**：`get_product_dossier({spu, month:'2026-10 '})` → `ok`，`portraits` 命中 exact，但 `performance`／`funnel`／`channelPerformance` **全部为空**（probe D2；`' 2026-09'`、`'2610'` 同样，D3／D4），而同一数据 `month:'2026-10'` 返回该月三类数据（D1）；工具1 `resolveUnitPrice(product,'2026-10 ')` 回退到主数据 `unit-price` 而非该月 `retail-amount-qty`（probe T3）。第一轮是可见的 `month-mismatch`，修后变成**静默丢指标／静默换价源**。见新发现 N1 |
| 应修-5 `normalize-rules.md` 残句 | **PASS** | `docs/normalize-rules.md:530` 改为「同月多平台画像在查询时返回 `ambiguous`，可用 `platform` 参数消歧（…不再按平台名确定性选择）」，与 `select.ts` 现行行为一致；docs-links 0 错误 |
| 应修-6 `result.md` 记录 | **PASS**（另见 N3：run4 自身的记录） | (a) `portrait/types.ts` 已入「改动文件」与偏差 6；(b) 5 个未列工具的 `month` 校验入偏差 7（`get_brand_portrait` 不过滤另记范围外 4）；(c) SA-03／SA-04／SA-08 行把「行为 PASS」与「先 RED 后 GREEN `NOT_PROVED`」分开写，并保留「永久性 `NOT_PROVED`」段；(d) 工具1 5 例 RED 为 fixture `ENOENT` 在 SA-03 行披露。范围外发现补至 5 条（含重复行覆盖、`get_brand_portrait`、守卫不拦 `fetch`） |
| 应修-7 真实数据等价的解释 | **PASS**（引用与转述）；真实数据面本身 `NOT_PROVED` | `result.md` SA-12 行引用 `accept/real-unit-structured-diff.json` 并如实转述：我核对该 JSON 的键结构——`totalScoreSame/gradeSame/fuseSame/availableSame/missingSame/priceFitSame` 均 true，各维度 `scoreSame…top3OverlapSame` 均 true，`evidenceDiffKeys` 仅 `productTop3/channelTop3`，`flags.channelApproximate` false→true——与 `result.md` 表述一致；并写明真实数据无经营指标／漏斗／成交表，SA-04／05／08／09 真实数据面 `NOT_PROVED`。主 agent 「334 款全 false」的计数我未读真实数据，记 `UNKNOWN`（主 agent 证据） |

---

## 3. 主 agent 升级为应修的项

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `parsePeriod` YYMM 优先 | **PASS**（附 N1 的副作用、S1） | `2610`→`2026-10`、`2412`→`2024-12`、`2024`→year、`0000`／`9999`→unknown（probe A 段）；`periodCovers(period,'2024-1')` false；`identity.ts` 不在修单 diff 内，`parseMonthLabel` 同为 YYMM 优先（`identity.ts:59-65`），normalize 既有测试随 634 全过。变异 R2-M02、R2-M03 杀死。注意 `periodCovers(p,'2610')` 为 **true**（作者测试 `period.test.ts:146` 亦如此断言），与 `parse.ts:114` JSDoc「`2610` 这类非自然月一律返回 false」及 spec v0.3「非自然月入参一律 false」字面不符（N1／S3） |
| `get_competitor_portrait({month})` 覆盖规则 | **PASS** | 年份画像查 `2024-06` 命中 `match:'year'`；无月份画像 `match:'unknown'`；不带 month 不产生 `match`（`period-hints.test.ts:188-214`）。变异 R2-M04 杀死 |
| 无月份画像各工具口径一致 | **PASS** | `selectPortrait`、`list_channels`、`get_product_dossier({month})`、`search_by_tag({month})`、`get_portrait_aggregate({month})` 同走 `portraitLabelCovers`（`query.ts:118,226,385`；`server.ts:466`）；probe D1／C12 与 `period-hints.test.ts:216-246` 一致。变异 R2-M06、R2-M10、R2-M12 杀死 |
| 渠道经营指标 | **PASS** | `ChannelRecord.performance: Record<string, ChannelPerformance>`（`normalize/types.ts:41-46`），空月 → `unknown`，`pickLatest` 与「档案取最新月份」issue 已删（`build.ts:720-749`）；`list_channels` 原样返回按月映射（`server.ts:236`）；商品侧键规则一致（`build.ts:697`）。变异 R2-M05 杀死；`p0-tables.test.ts:503-529` 锁定多月全保留 |
| `includes('~')` 全部改走 `parsePeriod` | **PASS** | `packages/*/src` 内只剩注释提及；`portrait-input.ts:19-20`、`build.ts:617-625`、`demo/fixture.ts:377-379` 均用 `parsePeriod(...).kind`。对规范化标签（年份标签为 `YYYY-01~YYYY-12`）行为等价；演示报告逐字节一致 |
| `reference.ts` 去强转；`unit-price` 两位小数 | **PASS** | `priceInput: Pick<ProductDossier,'price'|'performance'>`，无 `as ProductDossier`；`round2(unitPrice)`（`price.ts:57`）。变异 R2-M11 杀死 |
| JSDoc 归位 | **PASS** | `product/types.ts:116` `funnel` 有自己的描述；错位的「单品人群画像」注释已删 |
| share=0 锁定测试与文档句 | **PASS** | `common-labels.test.ts:135-162` 两例与 `similarity.ts` 按键存在性取公共标签的实现一致；`normalize-rules.md:221` 补句一致 |
| `mcp-usage.md` `month: ""` | **PASS** | `mcp-usage.md:102`「`month` 传空串按未传处理」；probe C7 实测等同未传 |

---

## 4. TDD 证据（run4）

| RED 日志 | 判定 | 说明 |
| --- | --- | --- |
| `red/run4-fix1-core-period.log` | **有效** | 54 例中 7 失败，全部 `ERR_ASSERTION`，对应当次目标（YYMM、1900–2100、`periodCovers` 守卫、`platform:''`、空白 month）。注：日志里「四位年份限定…（1899／2101 → unknown）」一例的期望与入库测试（`2101` → `2021-01`）不同，说明测试在 RED 后被改写；入库断言在修前代码下同样会失败（旧代码返回 year），不影响结论，但 `result.md` 未提及 |
| `red/run4-fix2-hints.log` | **目标断言失败成立；时序 NOT_PROVED** | 20 例中 9 失败，全部 `ERR_ASSERTION`（hint 内容、竞品覆盖、无月份画像纳入、dossier），无环境／fixture 错误 |
| `red/run4-fix3-channel-monthly.log` | **有效** | 36 例中 2 失败，均为目标断言（按月键、不塌缩） |
| `red/run4-fix4-price.log` | **有效** | 13 例中 1 失败（unit-price 两位小数） |
| `green/run4-fix5-share-zero.log` | **如实** | 现状锁定，`result.md` 写明「预期直接 GREEN」 |

GREEN：fix1 116/116、fix2 208/208、fix3 126/126、fix4 89/89、fix5 9/9；候选 HEAD 634/634（我复跑）。

**关于 `run4-fix2-hints.log` 以 `git stash` 回退实现重取 RED 的判定**：
- **能证明**：新增测试对修前实现（`a1ae9ba` 状态）有判别力——9 例在该实现下按目标断言失败；我的变异 R2-M01／M04／M06／M09／M12 独立复证了同一判别力。
- **不能证明**：先红后绿的时序。它是「先有实现、再回退取证」，按规范 §4.3「后补测试不能伪造历史失败」与 §10「记录候选和输入身份、实际命令与退出结果…不只交摘要」，该组的 TDD 时序应记 `NOT_PROVED`。
- **披露情况**：`result.md` 全文无 `stash`／回退取证的说明，`result.md:123` 反而写「逐条均先真实 RED（目标断言失败）再最小 GREEN」——**未披露，记为应修 N3**。
- 建议 `result.md` 原话：「`run4-fix2-hints.log` 的 RED 为事后取证：修正夹具后以 `git stash` 暂时回退实现重取（20 例中 9 例目标断言失败），证明测试对修前实现的判别力，**不证明先红后绿的时序**；该组修正的 TDD 时序记 `NOT_PROVED`，判别力另由复核变异独立背书。」另：`result.md:127` 写 `green/run4-fix2-hints.log`（10/10），日志实为 208/208；作者口径「24 例」与 RED 日志 20 例不符，一并改准。
- **stash 残留**：`git -C <工作树> stash list` 为空（开始与结束各核一次）。

---

## 5. 修单改动的既有测试

`a1ae9ba..9e10e31` 删除的断言行只在三个文件（`git diff … | grep '^-.*assert'`），无删除测试：

| 测试 | 判断 |
| --- | --- |
| `core/test/index.test.ts:103-106` 「list_channels 按月份过滤」：入参 `2025-07~2026-06` → `2025-12` | **覆盖转移**。旧入参是区间标签，v0.2 契约下 `month` 须为自然月；`a1ae9ba` 时该用例能过只是因为旧 `periodCovers` 对区间入参做字符串比较（`'2025-07' <= '2025-07~2026-06' <= '2026-06'`）。新入参取区间内自然月，不变量（只保留覆盖该月的渠道、恰 1 个、`D00001`）原样保留 |
| `core/test/p0-tables.test.ts:489-501` 渠道指标：`performance.gmv` → `performance['2026-01'].gmv` | **契约同步，非削弱**。`ChannelPerformance.month` 字段随 R-2 删除；「缺失字段不插补」断言保留，并新增多月全保留／空月 unknown／无塌缩记录用例（:503-529） |
| `data-mcp/test/p0-completion.test.ts:346` month-mismatch hint 字串 | **精确字串重锁**，kind／message 不变量保留，非削弱 |
| `core/test/price.test.ts` | 仅新增用例 |

---

## 6. 变异复现（全部在 `round2/copy/`，还原后 6 文件 `cmp` 与候选一致）

| 变异 | 文件 | 跑的测试 | 结果 |
| --- | --- | --- | --- |
| R2-M01 hint 的 reason 分支对调（`months.length>1 && reason!=='platform'` 才给平台提示） | `data-mcp/src/server.ts:121` | mcp period-hints、period-query、p0-completion | **杀死**（8 失败） |
| R2-M02 `parsePeriod` 去掉 YYMM 优先 | `core/src/period/parse.ts:63` | core period、portrait-select、index | **杀死**（3 失败） |
| R2-M03 `periodCovers` 去掉自然月入参守卫 | `core/src/period/parse.ts:118-120` | core period、period-query、portrait-select；mcp period-query | **杀死**（1 失败） |
| R2-M04 `get_competitor_portrait` 改回字面相等 | `data-mcp/src/server.ts` | mcp period-hints | **杀死**（2 失败） |
| R2-M05 渠道指标改回只留最新月份 | `core/src/index/build.ts` applyChannelPerformance | core p0-tables、dossier-monthly | **杀死**（1 失败） |
| R2-M06 `get_product_dossier({month})` 改回排除无月份画像 | `data-mcp/src/server.ts:466` | mcp period-hints | **杀死**（1 失败） |
| R2-M07 `selectPortrait` `platform` 判断改回 `!== undefined` | `core/src/period/select.ts:84` | core portrait-select | **杀死**（2 失败） |
| R2-M08 `selectPortrait` 不再取规范月标签（`month = query.month`） | `core/src/period/select.ts:116` | core portrait-select | **存活**（等价变异：`periodCovers` 内部对入参再 `parsePeriod`，规范化在 `selectPortrait` 内冗余；见 S3） |
| R2-M09 `describeAvailablePeriods` 退回直接列标签 | `core/src/period/parse.ts` | mcp period-hints、p0-completion | **杀死**（3 失败） |
| R2-M10 `searchByTag` 带 month 改回排除无月份画像 | `core/src/index/query.ts:226` | core period-query | **杀死**（1 失败） |
| R2-M11 `unit-price` 不再两位小数 | `core/src/match/price.ts:57` | core price、tool1 dataset | **杀死**（1 失败） |
| R2-M12 `aggregatePortrait` 带 month 改回排除无月份画像 | `core/src/index/query.ts:385` | core period-query、mcp period-hints | **杀死**（1 失败） |

**存活 1（等价变异）**。还原核对：`server.ts`、`parse.ts`、`build.ts`、`select.ts`、`query.ts`、`price.ts` 六个文件 `cmp` 均 IDENTICAL；副本重新 `tsc -b` 退出码 0。

---

## 7. 新发现

### 阻断
未发现。四条硬约束仍成立（边界 diff 空；黄金与 fidelity 复跑 PASS；无新增依赖；diff 内无数据文件与网络调用）。

### 应修（合并前处理，并由主 agent 重验受影响范围；不处理须在 `result.md` 记为已知限制并由负责人接受）

**N1 · `month` 的规范化只做在 `selectPortrait` 内部，边界层仍原样透传，带空白／YYMM 写法在按月键查找上静默失效（含一处回归）**
- 位置：`packages/data-mcp/src/server.ts:176-203`（`readMonth`／`readRequiredMonth` 返回 `args.month` 原串）；`server.ts:167-170, 476-481`（`pickMonthKey` 用原串查 `performance[month]`）；`packages/tool1-channel-match/src/dataset/data-root.ts:36-41, 167, 171`（`validateMonthOption` 只校验不规范化，`resolveUnitPrice`／`resolveRetailAmount` 收原串）；`dataset/reference.ts:160`（`file.month === selectedMonth` 原串比较）。
- 实测（合成数据，`logs/probe.log` D 段、`probe2.log` T 段）：`get_product_dossier({spu, month:'2026-10 '})` → `ok`，`portraits:[['2026-10','exact']]`，`perfKeys:[]`、`funnelKeys:[]`、`chPerf:{}`；`month:'2610'`、`' 2026-09'` 同样。`resolveUnitPrice({performance:{'2026-10':{retailAmount,retailQty}}, price:{unitPrice}}, '2026-10 ')` → `unit-price`（应为 `retail-amount-qty`）；`'2610'` 同；`resolveRetailAmount(…,'2610')` → `undefined`。
- 回归面：`'2610'` 在 `a1ae9ba` 被 MCP 拒绝（`invalid-argument`）与工具1 拒绝（非零退出）；run4 让 `parsePeriod('2610')` 成为 month 后，`isNaturalMonth('2610')` 为 true，MCP 与工具1（probe T1：`'2026-10 '`、`' 2026-10'`、`'2610'` 均 accepted）现在接受它，但下游按原串查月键全部落空。带空白写法在 `a1ae9ba` 是可见的 `month-mismatch`／「无画像，未进入矩阵」，现在是静默结果。
- 与规格的对应：spec v0.3「带首尾空白的 `month` 按规范月查找」只在 `selectPortrait` 成立；`mcp-usage.md:102`「不是自然月 `YYYY-MM` 即 `invalid-argument`」与 `parse.ts:114` JSDoc「`2610` 一律 false」均与现行行为不符。
- 修法（二选一，并补 MCP／工具1 层的 RED→GREEN）：(a) 边界规范化——`readMonth`／`readRequiredMonth`／`validateMonthOption` 返回 `parsePeriod(m).month`，调用方只用返回值；(b) 输入校验改用严格 `YYYY-MM` 正则（不 trim、不接受 YYMM），标签解析仍用 `parsePeriod`。无论哪种，改正 `parse.ts:114` JSDoc 与 spec v0.3「一律 false」的措辞（或改掉 `period.test.ts:146` 的 `2610 → true` 断言，二者取一）。

**N2 · 歧义 hint 对「无月份画像」形态判定不全（一处回归、一处既有死循环）**
- 位置：`packages/data-mcp/src/server.ts:121-140`。条件 `selection.months.length === 1 || selection.reason === 'platform'` 把「候选中只有一个非空月份标签」一律当成平台歧义。
- (a) **回归**：同一实体两份无月份画像、平台不同、不带 month（`months=[]`，`platforms=[douyin,tmall]`）→ message「有多份画像（月份：；平台：douyin、tmall）」，hint「传 month 参数（没有可作为 month 的画像期间）」（probe C3）。正确方向是 `platform`（传 `platform:'douyin'` 即命中，C3b）。`a1ae9ba` 的分支是 `months.length > 1` 才给 month 提示，该形态当时给的是 platform 提示；run4 改写后走错。
- (b) **既有（非回归）**：无月份画像 + `2026-10` 画像、同平台、不带 month → 「在 2026-10 有多平台画像（平台：douyin）」+「传 platform 参数消歧（可选平台：douyin）」；照做后仍 `ambiguous` 且提示相同（probe C4／C4b），正确方向是 `month`（B5b）。
- 同根：无月份 + `2026-10` 不同平台时 message 说「在 2026-10 有多平台画像」，对无月份那份（match 为 unknown）不准确（C5）。
- 修法：平台提示只在 `platforms.length > 1` 且（`reason==='platform'` 或候选全部共享同一非空月份标签）时给出；`months=[]` 给 platform 提示；单平台多月给 month 提示。补上述三例 RED→GREEN（`period-hints.test.ts` 现有夹具加两份无月份画像即可）。

**N3 · `result.md` 未披露 `run4-fix2` RED 的取证方式，且计数写错**
- 位置：`openspec/changes/foundation-period-model/result.md:123`（「逐条均先真实 RED…再最小 GREEN」）、`:127`（「10/10」，日志 208/208）。
- 判定与建议原话见 §4。

### 建议

- **S1** `parsePeriod` YYMM 优先使四位年份 **2001–2012、1901–1912** 被解成月份（probe：`2012`→`2020-12`、`2005`→`2020-05`）。与 `identity.ts:59-65` 一致、属 spec v0.3 既定取法，非缺陷；但建议在 `normalize-rules.md §2.1` 与 spec 写明该碰撞窗口——真实数据若有这些年份的年导出会被当成月份。
- **S2** `get_portrait_aggregate` 不带 month 的成员歧义提示固定「传 month 参数（…）」（`server.ts:610-613`）：对同月多平台成员可操作，但 `months=[]` 时「没有可作为 month 的画像期间」误导（传任意 month 即可聚合）；随 N2 一并按形态措辞。
- **S3** R2-M08 存活：`select.ts:116` 的规范化与 `periodCovers` 内部的 `parsePeriod` 互为冗余，`portrait-select.test.ts` 的空白 month 用例不区分规范化发生在哪一层。与 N1 同根——规范化应上移到边界，并在 MCP／工具1 层补「带空白／YYMM 的 month 在 dossier 指标与单价上等价」的用例，届时该变异才有意义。
- **S4** `monthWithinScope` 由 `parseMonthRange`（240 个月上限，`declaration.ts:122`）换成 `periodMonths`（无上限）：对规范化标签等价，仅 >240 个月的异常区间行为不同；可忽略，记一笔。
- **S5** `result.md` SA-12 行「334 款 `hasPerformance` 全 false」为主 agent 计数，我未读真实数据核实（`UNKNOWN`）；建议注明证据来源为 `capture-*.log`。
- **S6** `select.ts:107-117` 注释写「带首尾空白的写法等价于规范写法」，宜注明「仅在 `selectPortrait` 内；边界层规范化见 N1」。

---

## 8. 总结论

**PASS（附带条件）**

- 第一轮应修 1、2、3、5、6、7 **PASS**；应修-4 在 `selectPortrait` 层 PASS、端到端 **FAIL**（N1）。主 agent 升级的 9 项全部 PASS。六条门禁 + 守卫自检我独立复跑全部退出码 0（634/634）；演示报告逐字节一致；边界路径零改动；12 个变异 11 杀死、1 个等价存活。
- **附带条件（合并前）**：处理 N1（代码）、N2（代码）、N3（记录）。N1、N2 各有现成测试文件可加用例；修正后主 agent 重验 `data-mcp/test/period-hints.test.ts`、`period-query.test.ts`、`core/test/portrait-select.test.ts`、`tool1/test/dataset.test.ts` 与 docs-links。不处理者须在 `result.md` 记为已知限制并由负责人接受，不得记为 PASS。
- **永久性 `NOT_PROVED`（如实保留，无法补救）**：第一轮已记的 SA-08／SA-04 三例／工具1 侧集成；本轮新增 `run4-fix2` 组（hint、竞品覆盖、无月份画像纳入）的先红后绿时序。
- **未核实项**：真实数据 `capture.mjs` 未重跑（`NOT_RUN`，只审主 agent 结构化 diff 的键）；真实数据上 SA-04／05／08／09（`NOT_PROVED`，数据无相关表，主 agent 结论）；`npm run offline-check` 端到端、CI（`NOT_RUN`）；守卫只覆盖 13 个入口、不拦全局 `fetch`（第一轮已记，归切片 C）。
