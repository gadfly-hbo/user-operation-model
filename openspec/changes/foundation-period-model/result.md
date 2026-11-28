# 切片 A · 时间与选择语义 — 结果记录

> 状态：实现收口；**三轮独立复核均完成，结论均为 `PASS` 附带条件**——第一轮 [review.md](review.md)（候选 `a1ae9ba`），第二轮 [review-round2.md](review-round2.md)（候选 `9e10e31`），第三轮 [review-round3.md](review-round3.md)（候选 `5490659`）。复核应修的处理见文末「验收修正」「第二轮复核后修正」与「专项最终检查与收口」三节；第三轮遗留的记录更正与顺延项以「专项最终检查与收口」一节为准。**本文不构成整体交付完成的宣称**；最终验收由主 agent 与用户作出，push／PR／合并须用户另行授权。

## 执行信息

- 执行分支：`work/foundation-period-model`（工作树 `.qoder/worktrees/agent-SDD-TDD-d0463d03`）
- 基线：`d138592`（PR #7 合并后主干）
- 复核候选 HEAD（代码与文档收口）：`a1ae9ba`
- 复核后修正提交（run4）：
  - `dc3326b` fix: selectPortrait 空串平台与空白月份、parsePeriod YYMM 优先与 periodCovers 入参守卫（复核应修 3/4 + 建议 9）
  - `2a9ef12` fix: 歧义 hint 按 reason 分支并列出可用期间、竞品画像覆盖规则、无月份画像各工具统一为最低层可用（复核应修 1/2/6 + 建议 2 升级）
  - `84cb492` fix: 渠道经营指标按月键控展开（复核建议 3 升级·R-2 渠道侧）
  - `2e4dea5` fix: 单价解析收窄为最小输入类型并恢复 unit-price 两位小数、窗口识别统一走 parsePeriod、JSDoc 归位（复核建议 6/7/8）
  - `0f1199a` test/docs: 锁定 share=0 公共标签口径并补文档（复核建议 1；应修 5 + 建议 5）
  - 本次 result.md／spec v0.3 追加提交
- 修正轮 RED／GREEN 日志：`.local/slice-a/red|green/run4-*.log`

## 逐项状态（SA-01～SA-12）

证据目录：`/Users/huangbo/Dev/Projects/user-operation-model/.local/slice-a/`（下文简写 `.local/slice-a/`）。全套测试以候选 HEAD 上 `npm run check`（exit 0，608/608）统一背书；逐项 RED→GREEN 日志另附。

| 标识 | 状态 | 证据 |
| --- | --- | --- |
| SA-01 | **PASS** | RED→GREEN 日志 `.local/slice-a/red|green/SA-01.log`；`packages/core/test/period.test.ts` 随 `npm run check` 全过 |
| SA-02 | **PASS** | `.local/slice-a/red|green/SA-02.log`；`core/test/portrait-select.test.ts`（含验收修正一的 invalid-month 四例）全过 |
| SA-03 | **PASS**（含 v0.2 增补）；工具1 侧集成的「先 RED 后 GREEN」**NOT_PROVED** | `.local/slice-a/red|green/SA-03.log`；本次增补的 month 校验与 list_channels 覆盖规则：RED `red/run3-fix1-core|run3-fix1-mcp.log`（core 5 失败、MCP 13 失败，均为目标断言）→ GREEN `green/run3-fix1-core.log`（32/32）、`green/run3-fix1-mcp.log`（34/34）；命令行非法 month 非零退出且无产物：`green/run3-cli-invalid-month.log`（exit 1）。**如实记录（复核 §4）**：「data/ 正式路径 · 期间语义（切片 A）」5 例当时的 RED 全是 fixture `ENOENT …/tables/product-performance.csv`（临时目录未建 `tables/`），不是目标断言，工具1 侧 SA-03/08/09 集成的先 RED 后 GREEN 不可证明，记 `NOT_PROVED`；核心等价行为（`selectPortrait` 分层、`PLATFORM_PREFERENCE`）在 core 层有有效 RED，测试判别力由复核变异 M07/M10/M11/M15 独立背书 |
| SA-04 | **PASS**（行为）；其中「漏斗按『月份 × 阶段』」「渠道成交空月入 unknown」「不再产生取最新月份记录」三例的 RED **NOT_PROVED** | `.local/slice-a/red|green/SA-04-08-09.log`；`core/test/dossier-monthly.test.ts` 全过。**如实记录（复核 §4）**：抓取 `SA-04-08-09.log` 时这三例已通过（代码当时已部分实现），非目标断言失败，先 RED 后 GREEN 不可证明；其余用例（schemaVersion、多月全保留、空月→unknown（performance）、渠道→月份、不再写回 price、`index.months` 并集）RED 有效。渠道侧按月展开（v0.3）的 RED→GREEN 见「验收修正」第 3 条，证据完整 |
| SA-05 | **PASS** | `.local/slice-a/red|green/SA-05.log`；`data-mcp/test/period-query.test.ts` dossier 各例全过 |
| SA-06 | **PASS** | `.local/slice-a/red|green/SA-06.log`；`core/test/common-labels.test.ts` 全过；黄金复跑数字逐字一致（见 SA-11）。share=0 口径锁定测试（run4 补）为现状锁定，见「验收修正」第 8 条 |
| SA-07 | **PASS** | 本批 `64bfd14`：normalize-rules §2.1/§5.5/§12.9、match-kernel §1/§4/§5/§8（用例数 608 为实跑数）、match-calibration §6、mcp-usage（新参数、portraits 数组、ambiguous 新含义、invalid-argument、list_channels 覆盖规则）；`green/run3-docs-links.log`（exit 0，145 链接 0 错误）。run4 补：mcp-usage 无月份画像统一口径与 `month` 空串语义、normalize-rules §5.5 share=0 说明与 §12.5 旧行为残句清除、§12.9 渠道侧按月措辞 |
| SA-08 | **PASS**（行为）；`resolveUnitPrice`／`resolveRetailAmount` 的「先 RED 后 GREEN」**NOT_PROVED** | `.local/slice-a/red|green/SA-04-08-09.log`；`core/test/price.test.ts` 全过。**如实记录（复核 §4）**：抓 RED 时 `price.test.ts` 12 例已全部通过（`price.ts` 当时已实现），SA-08 唯一有效 RED 是「索引不再写回 price」；按规范 §4.3 记 `NOT_PROVED`（永久性，无法补救），测试判别力由变异 M07 独立证明。run4 的 unit-price 舍入修正有完整 RED→GREEN（见「验收修正」第 6 条） |
| SA-09 | **PASS** | 同上；索引层 `index.months` 字面不变量改由 `tool1/test/dataset.test.ts`「索引层 index.months 仍保留字面标签并集」锁定（覆盖保留说明见下）；core `availableMonths` 语义未改 |
| SA-10 | **PASS** | 见下节「回归核对」 |
| SA-11 | **PASS** | 见下节「门禁复跑」 |
| SA-12 | **PASS**（判据按 spec v0.2，演示部分）／真实数据快照部分 **NOT_PROVED** | 演示报告比对：`green/run3-*` 与 `.local/slice-a/equiv/demo-diff-report.json`（48 单元：28 不变、20 变化且全部只有 `strategy_segment`、0 个无法解释，exit 0）；真实数据前后快照引用 `.local/slice-a/equiv/snapshot-before.json`、`snapshot-after.json`、`capture-before.log`、`capture-after.log`。**主 agent 结论（结构化 diff，引用 `.local/slice-a/accept/real-unit-structured-diff.json`）**：真实数据中唯一进入矩阵的匹配对（改动前 `--month 2024-01` ↔ 改动后 `--month 2024-12`）总分、评级、熔断、各维度分、JS、余弦、Top3 重合度、可用与缺失维度、价格承接全部一致；差异仅 `flags.channelApproximate`（false→true，年份区间现被识别为近似，符合 R-7）与证据里 Top3 展示占比的浮点尾差（`productTop3`／`channelTop3` 两个键，复核 §7 应修-7 的解释缺口就此闭合）。**真实数据无经营指标／漏斗／成交表**（334 款 `hasPerformance/hasFunnel/hasChannelPerformance` 全 false；该计数来自主 agent 的验收抓取日志 `.local/slice-a/accept/capture-*.log`，第二轮复核者未读真实数据，记 `UNKNOWN`——S5），SA-04／05／08／09 的真实数据面未覆盖，记 `NOT_PROVED` |

## 回归核对（SA-10）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 缺月不回退 | PASS | `core/test/portrait-select.test.ts`、`data-mcp/test/period-query.test.ts`（该月无画像报 month-mismatch）、`tool1/test/dataset.test.ts`（所选月无画像时不回退）随 `npm run check` 全过 |
| `insufficient-dimensions` | PASS | `core/test/match.test.ts` 相关断言全过 |
| 价格缺失不插补 | PASS | `core/test/price.test.ts`、`tool1/test/dataset.test.ts`（缺成交单价不插补兜底价）全过 |
| 数据源探测与处理器一致性守卫 | PASS | `data-mcp/test/p0-completion.test.ts` 随 `npm run check` 全过 |
| 背对背字段零改动 | PASS | `git diff d138592 -- packages/core/src/product/catalog/fields.ts` 输出为空（`.local/slice-a/green/run3-sa10-gitdiff.log`）；`predictionAttributes`／`comparisonOnly` 既有测试（`core/test/core.test.ts`、`normalize.test.ts`、`model-v04.test.ts`）全过 |
| 模型与工具2 零改动 | PASS | `git diff --stat d138592 -- packages/core/src/model packages/tool2-portrait-predict` 为空（同上日志） |
| 范围外目录（scripts/.github/templates/根 package.json） | PASS | 同上日志：除 `site/web/tool1-report.html`（本次允许改）与授权路径外无改动 |

## 门禁复跑（SA-11，修正后全部重跑）

日志在 `.local/slice-a/green/run3-*.log`：

| 命令 | 退出码 | 结果 | 备注 |
| --- | --- | --- | --- |
| `npm run check` | 0 | PASS | 608/608，`green/run3-check.log` |
| `UOM_REFERENCE_ROOT=… npm run test:golden` | 0 | PASS | G1–G5 新总分与 `docs/match-calibration.md` 冻结基线逐字一致；`run3-golden.log` 与上一轮 `run2-golden.log` 逐字节一致，含输入 SHA-256 清单 |
| `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 0 | PASS | 两组冻结数字逐位不变；`run3-fidelity.log` 与 `run2-fidelity.log` 逐字节一致 |
| `npm run check:archive-content` | 0 | PASS | `run3-archive-content.log` |
| `python3 .github/scripts/check-docs-links.py .` | 0 | PASS | 145 条相对链接，0 错误 0 告警 |
| `python3 .github/scripts/check-data-guard.py .` | 0 | PASS | 索引中无业务数据目录、数据文件或超大文件 |
| `node --import ./scripts/offline-check/block-net.mjs scripts/offline-check/guard-selftest.mjs` | 0 | PASS | 13 个出网入口全部拦截 |
| `npm run offline-check`（端到端段） | — | **NOT_RUN** | 无数据工作树预期失败；按任务约定不拷数据凑绿，只跑守卫自检段（上行） |
| CI | — | **NOT_RUN** | 未推送、未开 PR；CI 不在本次授权范围 |

## 改动文件（按目录归纳，d138592..64bfd14）

- `packages/core/src/period/**`（新建：parse.ts、select.ts、index.ts；本批增 `isNaturalMonth`、`portraitLabelCovers`、`invalid-month` 分支）
- `packages/core/src/match/`（month.ts 删除；新增 portrait-input.ts、price.ts；kernel.ts／config.ts／types.ts 仅 SA-06 标签集合口径与版本号）
- `packages/core/src/index/`（build.ts、query.ts、types.ts、similarity.ts；query.ts 本批改 listChannels 覆盖规则）
- `packages/core/src/product/types.ts`（schemaVersion 与按月结构；JSDoc 归位）、**`packages/core/src/portrait/types.ts`**（新增可选 `period?: Period` 字段——SA-01 写入画像期间所必需，spec v0.3 追认）、`normalize/identity.ts`、`normalize/index.ts`、`normalize/product.ts`、`normalize/types.ts`（渠道指标按月结构）、`src/index.ts`
- `packages/core/test/**`（period、portrait-select、period-query、dossier-monthly、price、common-labels 新增；index、p0-tables、match、normalize 等既有测试按 SA-03/06 调整）
- `packages/data-mcp/src/server.ts`（month/platform 参数、portraits 数组、本批 readMonth/readRequiredMonth 校验）；`packages/data-mcp/test/**`
- `packages/tool1-channel-match/src/`（bin.ts、dataset/data-root.ts、dataset/reference.ts、dataset/index.ts；dataset/portrait.ts 删除）；`test/dataset.test.ts`；`scripts/demo-equivalence.mjs`（新增）
- `docs/normalize-rules.md`、`docs/match-kernel.md`、`docs/match-calibration.md`、`docs/mcp-usage.md`
- `site/web/tool1-report.html`（重新生成入库，spec v0.2·U6 反转授权）
- `openspec/changes/foundation-period-model/spec.md`（末尾追加 v0.2 节）与本 result.md

## 公共 API 变化

新增：`parsePeriod`、`periodCovers`、`periodMonths`、`Period`／`PeriodKind`、`selectPortrait`、`SelectPortraitQuery`／`SelectPortraitResult`（含 `invalid-month`）、`PortraitMatchKind`、`portraitMatchKind`、`portraitLabelCovers`（本批）、`PLATFORM_PREFERENCE`、`isNaturalMonth`（本批）、`availableMonths`、`selectAggregateMembers`、`toMatchPortraitInput`、`resolveUnitPrice`、`resolveRetailAmount`、`TagHit.match`；工具1 侧 `indexMonths`、`validateMonthOption`（本批）。

删除：`match/month.ts` 全部导出（`parsePortraitWindow`／`isIntervalWindow`／`coversMonth`／`PortraitWindow`）；工具1 `dataset/portrait.ts` 的 `pickPortrait`／`portraitCovers`／`readWindow`；core `findPortraitByEntityIds`；MCP `get_product_dossier` 单数 `portrait` 字段。

## 改动的既有测试及覆盖保留

- `core/test/index.test.ts`「按平台名确定性选择」→ 改锁「显式歧义 + platform 消歧」：偷选行为是被修掉的缺陷，消歧语义由新断言承接。
- `core/test/p0-tables.test.ts` 别名两条改走 `selectPortrait`：同一覆盖语义，入口换成唯一实现。
- `tool1/test/dataset.test.ts`（本批）：原「indexMonths 保留字面标签」改为「索引层 index.months 仍保留字面标签并集（直接 buildIndex 断言）」——SA-09 的原不变量**保留**，另由新用例锁定报告层自然月口径；测试辅助函数 `buildDataRoot`／`buildPeriodDataRoot` 提升到模块作用域（仅为复用，无断言变化）。
- `data-mcp/test/p0-completion.test.ts`：随 `schemaVersion` 升 0.2.0 的字段断言同步（SA-04）。
- `core/test/match.test.ts`：SA-06 后黄金用例期望值随公共标签口径更新，权重／公式断言未削弱。
- `core/test/index.test.ts`「list_channels 按月份过滤」（run4）：原用例把区间标签直接当 `month` 入参传（v0.2 前的字面用法），`periodCovers` 收紧非自然月后按新契约改传自然月 `2025-12`，断言不变量（只保留覆盖该月的渠道）保留。
- `core/test/p0-tables.test.ts`「渠道经营指标填充渠道档案」（run4）：渠道指标按月键控后断言改为 `performance['2026-01']` 形态，「缺失字段不插补」不变量保留；另增两月展开／空月 unknown／无塌缩记录用例。
- `data-mcp/test/p0-completion.test.ts` month-mismatch hint（run4）：hint 由「可用月份：<区间标签>」改为 `describeAvailablePeriods` 表达（区间标签不再是入参校验拒绝的「可用月份」），kind／message 不变量保留。

## 与规格的偏差

1. **平台消歧的 MCP 集成测试由渠道侧承接**：夹具中同月多平台样本在渠道侧（D00003 抖音+天猫）；商品侧消歧语义由 core 单测（SPU-D/SPU-E 多平台）与 `get_product_portrait` 的 month 用例覆盖，MCP 层两侧走同一 `selectPortrait` 实现，故未为商品侧另建同月多平台夹具。
2. **`reference.ts` 渠道文件级 tie-break 保留文件名序**：参考数据路径为单平台，同月同实体多文件时按文件名序取首份（P1 既有行为），未引入 `PLATFORM_PREFERENCE` 排序；多平台优先级只在 `data/` 路径生效并在 notes 写明。
3. **SA-12 判据修正**（spec v0.2 已记录）：逐字节一致与 SA-06 相抵触，改为「不变或逐单元可解释」；比对脚本对数值带 1e-9 容差（重归一化在 Top3 展示占比上留浮点尾差，得分与相似度逐位一致），判据、容差理由与输出格式均在脚本头注释写明。
4. **U6 反转**（spec v0.2 已记录）：演示报告重新生成并入库。
5. `get_retention_cohort` 的 `cohortMonth` 未纳入本批 month 校验：参数名非 `month`、语义为首购月份且不在任务列出的工具范围内；如需统一另立小修。
6. **`packages/core/src/portrait/types.ts` 越出原允许路径**（复核应修-6a）：SA-01 把期间写进画像必需类型上的可选 `period` 字段，原清单遗漏且当时未记偏差；spec v0.3 已追认。
7. **`month` 校验扩展到 5 个规格未列的工具**（复核应修-6b）：`get_brand_portrait`、`get_competitor_portrait`、`get_recency_distribution`、`get_channel_flow_matrix`、`get_diagnosis` 一并先校验再查数据，主 agent 在 spec v0.3 追认；`get_retention_cohort.cohortMonth` 仍未纳入（见偏差 5）。其中 `get_competitor_portrait` 的 month 过滤已按 v0.3 改为覆盖规则；`get_brand_portrait` 的 `month` 参数本身未参与过滤（既有问题，见范围外发现）。
8. **已知差异（第二轮复核 S4）**：`monthWithinScope` 在 run4（建议 6）由 `parseMonthRange`（240 个月上限）换成 `periodMonths`（无上限）——对规范化标签两者等价，仅对超过 240 个月的异常区间行为不同（前者会因超限拒绝，后者照常展开）。可忽略，记一笔备查。

## 范围外发现（只记录不修，归切片 B）

1. **单品画像文件名带月份前缀时 entityId 保留「款号」前缀**：如 `款号SPU-9002_2609_抖音.csv` 解析出的 entityId 与无月份文件（`款号SPU-9002_抖音.csv`）不一致，影响同款跨月画像关联（identity.ts 的「款号」剥离规则未覆盖该形态）。
2. **`deriveActualUnitPrice` 成为死代码**：`normalize/performance.ts` 导出、`normalize/index.ts` 转出口，SA-08 后 src 内无任何调用方（仅构建产物 .d.ts 引用）；删除与否归切片 B 一并裁剪。
3. **同款同月（或同渠道同月）重复指标行后写覆盖且不记 issue**（复核建议 4）：`build.ts` 的指标／漏斗／商品↔渠道填充均为后写覆盖；基线同样不记，非回归。归切片 B。
4. **`get_brand_portrait` 的 `month` 参数未参与过滤**（复核建议 10 剩余部分）：参数已校验但不过滤品牌画像集合，既有行为。归切片 C。
5. **断网守卫不拦全局 `fetch`**（复核 §5）：守卫只补丁 `net`／`http`／`dns` 的 13 个入口，「计数 0」只对该 13 个入口成立。归切片 C。

## 已知限制与 NOT_RUN 汇总

- `npm run offline-check` 端到端段 NOT_RUN（无数据工作树预期失败；守卫自检段 PASS）。
- CI NOT_RUN（未推送）；真实数据前后快照与比对为主 agent 验收证据，本文仅引用路径，不下结论（`NOT_PROVED`）。
- 工具1 `--demo` 路径不接受 `month`，未做校验语义（无入参入口）。
- 演示报告比对脚本不入 `npm run check`，作为 SA-12 证据工具按需手跑（用法见脚本头注释）。

## 验收修正（独立复核后，run4）

复核报告（`.local/review-slice-a/review.md` §7）应修 1–7 与本次处理的对应关系。除 run4-fix2 组（见下方如实披露）外，逐条先真实 RED（目标断言失败）再最小 GREEN；日志在 `.local/slice-a/red|green/run4-*.log`。

**如实披露（第二轮复核 N3，采纳复核者原话）**：`run4-fix2-hints.log` 的 RED 为事后取证——修正夹具后以 `git stash` 暂时回退实现重取（20 例中 9 例目标断言失败），证明测试对修前实现的判别力，**不证明先红后绿的时序**；该组修正的 TDD 时序记 `NOT_PROVED`，判别力另由复核变异独立背书。

| 复核条目 | 处理 | 证据（RED → GREEN） |
| --- | --- | --- |
| 应修-1 平台歧义 hint 指错方向（`selectPortraitOrError` 与 `get_portrait_aggregate` 同模式） | hint 按 `selection.reason` 分支：reason=`platform` 或同月多平台提示传 platform（compare 两侧为 `productPlatform`／`channelPlatform`）；跨月歧义才提示 month。复核者的复现形态（抖音 `2026-07~2026-09` + 天猫 `2026-08~2026-10` 查 `2026-09`）有专测锁定 | `red/run4-fix2-hints.log`（20 例中 9 例目标断言失败，取证方式见上方披露）→ `green/run4-fix2-hints.log`（208/208） |
| 应修-2 hint「可用月份」是入参校验拒绝的值 | core 新增纯函数 `describeAvailablePeriods(labels)`（`period/parse.ts`）：单月标签直接列为可用月份；区间／年份标签写「month 须为落在 `<标签>` 内的自然月（YYYY-MM）」；`selectPortraitOrError` 全部 hint、`get_portrait_aggregate`、dossier `month-mismatch`、compare not-found 统一走它 | 同上（复核应修-2 组；单月标签直列与年份标签说明各有专测） |
| 应修-3 `platform: ''` 绕过平台歧义 | `select.ts` 统一为「非空字符串才算指定」，空串等同未指定 → 照常 `ambiguous` | `red/run4-fix1-core-period.log`（7 失败含本条 2 例）→ `green/run4-fix1-core-period.log`（116/116） |
| 应修-4 带首尾空白的 `month` 过校验却永不命中 | 校验通过后以 `parsePeriod(m).month` 规范月标签为查找值（trim），`"2026-10 "` 等价 `"2026-10"`；非法写法仍 `invalid-month` 且零查找 | 同上（3 例） |
| 应修-5 文档残留旧行为（normalize-rules 约 530 行「按平台名确定性选择」） | 改为现行行为表述（返回 `ambiguous`，可用 `platform` 消歧）；docs-links 通过 | `green/run4-final.log`（docs-links 段） |
| 应修-6 result.md 记录不完整／状态词不准确 | (a)(b) 见「与规格的偏差」6、7；(c) SA-08 `resolveUnitPrice`／`resolveRetailAmount`、SA-04 三例、工具1 侧 SA-03/08/09 集成的「先 RED 后 GREEN」记 `NOT_PROVED`（行为 PASS 与 TDD 证据分开写，见逐项状态表）；(d) 工具1 侧 5 例 RED 为 fixture `ENOENT`（临时目录未建 `tables/`）已在 SA-03 行披露 | 本文各表（记录修正，无代码） |
| 应修-7 真实数据等价证据解释缺口 | 主 agent 结构化 diff（`.local/slice-a/accept/real-unit-structured-diff.json`）：总分、评级、熔断、各维度分、JS、余弦、Top3 重合度、可用与缺失维度、价格承接全部一致；差异仅 `flags.channelApproximate`（false→true，R-7 预期）与 Top3 展示占比浮点尾差；真实数据无经营指标／漏斗／成交表，SA-04/05/08/09 真实数据面 `NOT_PROVED`（已写入 SA-12 行） | 结构化 diff JSON（主 agent 产出，本文引用） |

复核「建议」中被主 agent 升级为应修、本次一并处理：

| 建议 | 处理 | 证据 |
| --- | --- | --- |
| 建议 9 `parsePeriod('2610')`／`'2412'` 被当年份；`periodCovers` 字典序误判 | 四位数字先按 YYMM 解（01–12 合法才算，`2610`→month `2026-10`、`2412`→`2024-12`），否则按四位年份解且限定 1900–2100（`0000`／`9999`→unknown）；`periodCovers` 对非自然月入参一律 false；`identity.ts` 既有路径零改动（年份→全年区间、`2610`→月份既有测试仍过） | `red/run4-fix1-core-period.log` → `green/run4-fix1-core-period.log` |
| 建议 10（部分）＋应修-6b `get_competitor_portrait` month 字面相等 | 改为与其它工具同源的覆盖规则（`portraitLabelCovers`）；无月份竞品画像最低层保留并标 `match: "unknown"`；带 month 命中带 `match` 字段，不带 month 不产生 | `red/run4-fix2-hints.log` → `green/run4-fix2-hints.log` |
| 建议 2 无月份画像口径不一致 | `get_product_dossier`（带 `match` 字段）、`searchByTag`、`aggregatePortrait` 统一为最低层可用（`match: "unknown"`）；口径写入 `docs/mcp-usage.md` | 同上 + core `red` 同日志（searchByTag 2 例） |
| 建议 3 渠道经营指标塌缩成最新月 | `ChannelRecord.performance` 改 `Record<月份, ChannelPerformance>`（空月归 `unknown`，与商品侧一致），删除 `pickLatest` 与「档案取最新月份」记录；`list_channels` 直接返回按月映射；normalize-rules §12.9 措辞同步 | `red/run4-fix3-channel-monthly.log`（2 失败）→ `green/run4-fix3-channel-monthly.log`（126/126） |
| 建议 6 区间识别第二套判定 | `portrait-input.ts`、`build.ts` `monthWithinScope`、tool1 `demo/fixture.ts` 统一改用 `parsePeriod` 的 kind（区间与年份都按窗口处理，行为等价；纯重构，等价证据为重构前后相关套件全绿） | `green/run4-fix4-price-refactor.log`（89/89，重构后）+ `npm run check`（最终门禁） |
| 建议 7 `reference.ts` 强转 `as ProductDossier`；unit-price 不舍入 | `resolveUnitPrice`／`resolveRetailAmount` 参数收窄为 `Pick<ProductDossier, 'price' | 'performance'>`（新增导出类型 `UnitPriceInput`），去掉强转；`unit-price` 来源恢复两位小数四舍五入（P1 基线） | `red/run4-fix4-price.log`（1 失败）→ `green/run4-fix4-price-refactor.log` |
| 建议 8 JSDoc 错位 | 「单品人群画像」注释移除（该字段已不存在），`funnel` 字段获得自己的描述 | 代码注释，随 `green/run4-fix4-price-refactor.log` 套件通过 |
| 建议 1 share=0 标签 | 保持现状（双侧都有记录的 0 份额是「观测到的 0」，算公共标签；单侧无记录才是单侧独有），补 2 个锁定测试；normalize-rules §5.5 实现说明补一句 | `green/run4-fix5-share-zero.log`（9/9，锁定测试为现状锁定、预期直接 GREEN） |
| 建议 5 `month: ""` 语义 | `docs/mcp-usage.md` 错误类型表补「空串按未传处理」 | 文档，docs-links 通过 |

**永久性 `NOT_PROVED`（无法补救，如实保留）**：SA-08 `resolveUnitPrice`／`resolveRetailAmount`、SA-04 三例（漏斗按月、渠道成交空月入 unknown、不再产生取最新月份记录）、工具1 侧 SA-03／08／09 集成的「先 RED 后 GREEN」——行为层面 PASS（复核逐条核实），TDD 证据层面不可证明，测试判别力由复核变异（M05–M07、M13、M15）独立背书。

**修正轮门禁**：见下表 run4 各行；修正过程中工具1 演示报告重新生成后与入库版逐字节一致（`green/run4-final.log` 附比对输出），黄金 G1–G5 逐字不变。

## 第二轮复核后修正（run5）

第二轮复核（`.local/review-slice-a/round2/review-round2.md`，PASS 附带条件）应修 N1／N2／N3 的处理。本轮逐条先真实 RED（目标断言失败，零环境／fixture 错误）再最小 GREEN；日志在 `.local/slice-a/red|green/run5-*.log`。

| 复核条目 | 处理 | 证据（RED → GREEN） |
| --- | --- | --- |
| N1 `month` 边界层严格校验（采用复核报告方案 (b)） | `isNaturalMonth` 改为严格正则 `^\d{4}-(0[1-9]|1[0-2])$`（不 trim、不接受 YYMM、不接受区间／年份标签），`selectPortrait`（删除「带空白按规范月查找」，v0.3 该取法作废）与 `periodCovers` 同源使用；MCP `readMonth`／`readRequiredMonth` 与工具1 `validateMonthOption` 走同一判断，代码零改动即收紧（单一来源）。探针形态全覆盖：D2／D3／D4（dossier 带空白／YYMM → `invalid-argument`，修前是 ok 且指标静默落空）、渠道入口 `2610`（修前被当 `2026-10` 命中）、T1/T3（工具1 两条数据路径与 CLI 非法月非零退出、零产物） | `red/run5-n1-core.log`（56 例中 5 失败）→ `green/run5-n1-core.log`（56/56）；`red/run5-n1n2-mcp-hints.log` → `green/run5-n1n2-mcp-hints.log`（19/19）；`red/run5-n1-tool1.log`（18 例中 2 失败）→ `green/run5-n1-tool1.log`（18/18）；CLI 探针 `red/run5-n1-cli.log`（`2610`／`2026-10 ` 修前 exit 0 且产生产物）→ `green/run5-n1-cli.log`（exit 1、零产物，`2026-10` 对照 exit 0） |
| N2 无月份画像形态的歧义提示 | `selectPortrait` 歧义结果新增 `hasMonthless`；MCP 提示按形态判定：平台提示只在「可选平台多于一个」且（reason=`platform`／候选全无月份／候选全部共享同一非空月份标签）时给出；单平台多月（C4/C4b，修前提示传 platform 是死循环）与无月份+有月份混合（C5，修前 message 误写「在某月有多平台画像」）提示传 month；C3/C3b（两份无月份不同平台）提示传 platform；`get_portrait_aggregate` 在 `months=[]` 时提示「传任意月份（YYYY-MM）即可聚合」（S2，修前「没有可作为 month 的画像期间」误导） | 同 `run5-n1n2-mcp-hints.log`（C3/C3b/C4/C4b/C5/S2 六例 RED→GREEN） |
| N3 result.md 如实披露与计数更正 | 「验收修正」节按复核者原话披露 `run4-fix2` RED 的 `git stash` 事后取证；`green/run4-fix2-hints.log` 计数 10/10 → 208/208（RED 为 20 例中 9 例）；SA-12 行注明 334 款计数的证据来源 `accept/capture-*.log`（S5）；偏差 8 补记 `monthWithinScope` 上限差异（S4）；「永久性 NOT_PROVED」清单加入 run4-fix2 组（见下） | 本节与上文（记录修正，无代码） |

**改动的既有测试及覆盖保留（本轮）**：

- `core/test/period.test.ts`「periodCovers 对非自然月入参一律 false」：`periodCovers(p,'2610')` 由断言 `true` 改为 `false`——**契约收紧的覆盖转移**：`2610` 是画像标签写法（`parsePeriod` 不变，仍解为 `2026-10`），但不是 `month` 入参写法；不变量（非自然月入参不得按写法猜测比较）保留并更严格（新增带空白入参断言）。
- `core/test/portrait-select.test.ts`「带首尾空白的 month 等价于规范写法」两例：由断言 `found` 改为 `invalid-month`——同一覆盖转移（v0.4 作废 v0.3 该取法）；`'2026-13 '` 带空白拒绝用例不变，新增 `'2610' → invalid-month`。
- 夹具新增（`period-hints.test.ts`）：演示账号7／8／9 与 SPU-004／005（无月份、混合、跨平台形态），既有断言未削弱。

**永久性 `NOT_PROVED`（无法补救，如实保留，累计）**：第一轮已记的 SA-08 `resolveUnitPrice`／`resolveRetailAmount`、SA-04 三例、工具1 侧 SA-03／08／09 集成；第二轮新增 **run4-fix2 组**（hint 按 reason 分支、竞品覆盖规则、无月份画像纳入）的先红后绿时序——判别力由复核变异 R2-M01／M04／M06／M09／M12 独立背书。本轮 run5 三组修正的 RED→GREEN 时序完整。

**本轮门禁**：`npm run check` 647/647（exit 0）；黄金、fidelity、archive-content、docs-links、data-guard、守卫自检与演示报告字节比对见 `green/run5-*.log`。

## 专项最终检查与收口（主 agent，规范 §5.3）

> 写入时机：第三轮独立复核结论之后。候选 `5490659`（基线 `d138592`）。检查范围限本变更及其接缝；不据此宣称未检查的既有实现已合规。主 agent 在该候选上亲跑：`npm run check` 647/647；黄金 G1–G5 与冻结基线逐行一致；fidelity 通过；archive-content、docs-links（145 条）、data-guard 通过；演示报告与入库文件逐字节一致；真实数据前后快照比对「无非预期差异」（证据 `/Users/huangbo/Dev/Projects/user-operation-model/.local/slice-a/accept/`）。

### 第三轮复核遗留的处理

| 项 | 处理 |
| --- | --- |
| **R3-1（记录）** | run5 MCP 组的 RED 实为「19 例中 7 例目标断言失败 + 1 例测试代码自身的 `TypeError`（C4b）」，不是上文「第二轮复核后修正」与 `green/run5-final.log` 所写的「8 例全为断言失败、零错误」；C4b 的测试在 RED 之后改写为现状锁定用例，其先红后绿时序记 `NOT_PROVED`（判别力由其余 7 例与第三轮变异 M04／M05a／M09／M10 背书）。**以本节为准**；日志为证据原件，不改写 |
| 建议 S1–S5 | **主 agent 决定顺延至切片 B1 一并处理，须由用户在授权合并时确认接受**：S1 无月份画像与带月份画像混合、多平台时的 message 措辞（`packages/data-mcp/src/server.ts` 约 127–134）；S2 `packages/core/src/period/select.ts` 约 112–113 的注释仍写「规范化上移到边界层」，与实现（边界层严格拒绝、不规范化）不符；S3 `docs/normalize-rules.md` 年份枚举与 `spec.md` v0.4 漏列 `2000`；S4 `hasMonthless` 在带 `month` 分支缺 core 层断言（第三轮等价变异 M05b 存活）；S5 `isNaturalMonth('0000-01')` 放行属格式校验、与修前一致（备注）。不顺延则另起修单 |

### 六项检查

| 检查项 | 范围与证据 | 发现 | 结论 |
| --- | --- | --- | --- |
| 四点原则 | 纯领域重构，不新增环境职责；不新增依赖（`package.json` 与锁文件零改动）；期间解析与画像选择从三处（`match/month.ts`、工具1 挑选函数、core 查询）收成一处并删除原处；MCP 以显式歧义与参数错误取代静默取值，Agent 获得的信息只增不减；提示语可操作 | 无新增必做人工操作 | 通过 |
| 数据不出网 | 无新增依赖；diff 内无网络调用、无数据文件；`site/web/tool1-report.html` 与合成 fixture 重新生成结果逐字节一致；离线守卫自检 13 入口拦截 | **已知限制**：守卫不拦全局 `fetch`（主 agent 与三轮复核各自实测），「计数 0」只对这 13 个入口成立；源码层已确认无 `fetch`。归切片 C 补守卫 | 通过（含一项已记录限制） |
| 匹配内核唯一性 | 全仓无第二份评分逻辑或阈值字面量；`packages/core/src/match/config.ts` 只动版本号与注释（权重、价格带、评级、熔断逐字未动）；公共标签口径只在 `index/similarity.ts` 一处，内核、差异、相似款、聚合同源；黄金 G1–G5 三轮复核与主 agent 各自复跑逐字不变 | 无 | 通过 |
| 背对背隔离 | `packages/core/src/product/catalog/fields.ts` 零改动；`predictionAttributes`／`comparisonOnly` 生成逻辑只随 `schemaVersion` 变一行；既有测试全过 | 无 | 通过 |
| 模型来源与版本 | `packages/core/src/model/**`、`packages/tool2-portrait-predict/**` 零改动；fidelity 门禁三轮复跑通过，两组冻结数字逐位不变 | 无 | 通过 |
| 人的操作 | 未新增任何必做动作；`data/README.md` 未改；`month` 入参收紧为 `YYYY-MM`（原先区间标签会被选择器静默接受，不属文档化用法），提示语与 `indexMonths`／`availableMonths` 给出可用的自然月 | 无 | 通过 |

### 结论

**通过（限切片 A 范围）。** 带以下如实保留项，不得表述为整体无保留通过：

- **永久性 `NOT_PROVED`（TDD 先红后绿时序）**：`resolveUnitPrice`／`resolveRetailAmount`；SA-04 三例（漏斗按月、渠道成交空月入 unknown、不再产生取最新月份记录）；工具1 侧 SA-03／08／09 集成；`run4-fix2` 组（hint、竞品覆盖、无月份画像纳入——该组 RED 为 `git stash` 回退实现后重取的事后取证）；run5 的 C4b。测试判别力由三轮复核的变异复现独立背书（三轮共 45 个变异，43 杀死、2 个等价存活）。
- **`NOT_RUN`**：`npm run offline-check` 端到端段（无数据工作树）；CI（未推送）。
- **真实数据覆盖面**：现有样本无经营指标／漏斗／成交表，SA-04／05／08／09 的真实数据面 `NOT_PROVED`；唯一进入矩阵的真实匹配对前后各维度分一致（`.local/slice-a/accept/real-unit-structured-diff.json`）。
- **范围外发现（已登记，归后续切片）**：单品画像文件名带月份前缀时 entityId 保留「款号」前缀（B1）；`deriveActualUnitPrice` 死代码（B1）；同月重复行覆盖无 issue（B1）；`get_retention_cohort.cohortMonth` 未校验（B1）；`get_brand_portrait` 的 `month` 未参与过滤（C）；断网守卫不拦 `fetch`（C）。
- **过程披露**：本切片由三位实现者分五批完成（单个子代理有轮次上限，第一批到限中止）；主 agent 验收中拦下并退回两处自行发挥（区间标签被当月份放行、工具1 可选月份变成区间标签）；第一轮复核指出主 agent 所写规格 SA-12 的「演示报告逐字节一致」与已拍板的 R-3 相抵触，已以 v0.2 修正节更正。

## 交付回填（主 agent，2026-11-28）

| 项 | 结果 |
| --- | --- |
| 用户授权 | 2026-11-28 对「推送分支、开 PR、跑 CI、绿了合并」回复「授权」 |
| 推送 | `work/foundation-period-model @ 7ccaee3`（复核过的候选，未再改动） |
| PR | [#8](https://github.com/gadfly-hbo/user-operation-model/pull/8)，53 个文件（+5026／−643） |
| CI | Check 运行 `46150986745`：数据不出网守卫 `SUCCESS`、校验 `SUCCESS`（`headSha` = `7ccaee3`）；`mergeStateStatus` CLEAN |
| 合并 | squash 合并到 `main @ 22c55f4`（`--match-head-commit 7ccaee3`），2026-11-28 13:43 UTC；远端分支已删；本地 `main` 已快进并在合并后的主干上复跑 `npm run check` 647/647 |
| 第三轮复核建议 S1–S5 | 顺延切片 B1，已并入 `openspec/changes/foundation-identity-health/spec.md` 的 SB-10 |
| 保留项 | 上文「永久性 `NOT_PROVED`」「`NOT_RUN`」「真实数据覆盖面」「范围外发现」原样保留，不因合并而改写 |

本回填不改变上文任何状态词。
