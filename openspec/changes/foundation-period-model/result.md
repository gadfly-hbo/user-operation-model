# 切片 A · 时间与选择语义 — 结果记录

> 状态：实现收口，待独立复核。**本文不构成整体交付完成的宣称**；最终独立复核不可由作者自评代替。

## 执行信息

- 执行分支：`work/foundation-period-model`（工作树 `.qoder/worktrees/agent-SDD-TDD-d0463d03`）
- 基线：`d138592`（PR #7 合并后主干）
- 候选 HEAD：`64bfd14`（`91bf1e4` 规格起，SA-01～SA-09 五个实现提交 + 本次验收修正三个提交）
- 本次新增提交：
  - `9f2b033` fix: month 入参自然月校验、list_channels 覆盖规则与工具1 可用月份恢复自然月
  - `a0560e8` fix: 演示报告按 SA-06 公共标签口径重新生成并入库，附可重复等价比对脚本
  - `64bfd14` docs: SA-07 口径文档同步与切片 A 验收修正附录（spec v0.2）

## 逐项状态（SA-01～SA-12）

证据目录：`/Users/huangbo/Dev/Projects/user-operation-model/.local/slice-a/`（下文简写 `.local/slice-a/`）。全套测试以候选 HEAD 上 `npm run check`（exit 0，608/608）统一背书；逐项 RED→GREEN 日志另附。

| 标识 | 状态 | 证据 |
| --- | --- | --- |
| SA-01 | **PASS** | RED→GREEN 日志 `.local/slice-a/red|green/SA-01.log`；`packages/core/test/period.test.ts` 随 `npm run check` 全过 |
| SA-02 | **PASS** | `.local/slice-a/red|green/SA-02.log`；`core/test/portrait-select.test.ts`（含验收修正一的 invalid-month 四例）全过 |
| SA-03 | **PASS**（含 v0.2 增补） | `.local/slice-a/red|green/SA-03.log`；本次增补的 month 校验与 list_channels 覆盖规则：RED `red/run3-fix1-core|run3-fix1-mcp.log`（core 5 失败、MCP 13 失败，均为目标断言）→ GREEN `green/run3-fix1-core.log`（32/32）、`green/run3-fix1-mcp.log`（34/34）；命令行非法 month 非零退出且无产物：`green/run3-cli-invalid-month.log`（exit 1） |
| SA-04 | **PASS** | `.local/slice-a/red|green/SA-04-08-09.log`；`core/test/dossier-monthly.test.ts` 全过 |
| SA-05 | **PASS** | `.local/slice-a/red|green/SA-05.log`；`data-mcp/test/period-query.test.ts` dossier 各例全过 |
| SA-06 | **PASS** | `.local/slice-a/red|green/SA-06.log`；`core/test/common-labels.test.ts` 全过；黄金复跑数字逐字一致（见 SA-11） |
| SA-07 | **PASS** | 本批 `64bfd14`：normalize-rules §2.1/§5.5/§12.9、match-kernel §1/§4/§5/§8（用例数 608 为实跑数）、match-calibration §6、mcp-usage（新参数、portraits 数组、ambiguous 新含义、invalid-argument、list_channels 覆盖规则）；`green/run3-docs-links.log`（exit 0，145 链接 0 错误） |
| SA-08 | **PASS** | `.local/slice-a/red|green/SA-04-08-09.log`；`core/test/price.test.ts` 全过 |
| SA-09 | **PASS** | 同上；索引层 `index.months` 字面不变量改由 `tool1/test/dataset.test.ts`「索引层 index.months 仍保留字面标签并集」锁定（覆盖保留说明见下）；core `availableMonths` 语义未改 |
| SA-10 | **PASS** | 见下节「回归核对」 |
| SA-11 | **PASS** | 见下节「门禁复跑」 |
| SA-12 | **PASS**（判据按 spec v0.2） | 演示报告比对：`green/run3-*` 与 `.local/slice-a/equiv/demo-diff-report.json`（48 单元：28 不变、20 变化且全部只有 `strategy_segment`、0 个无法解释，exit 0）；真实数据前后快照为主 agent 验收证据，引用 `.local/slice-a/equiv/snapshot-before.json`、`snapshot-after.json`、`capture-before.log`、`capture-after.log`，**结论见验收记录**，本文 `NOT_PROVED` 代替主 agent 下结论 |

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
- `packages/core/src/product/types.ts`、`normalize/identity.ts`、`normalize/index.ts`、`normalize/product.ts`、`src/index.ts`
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

## 与规格的偏差

1. **平台消歧的 MCP 集成测试由渠道侧承接**：夹具中同月多平台样本在渠道侧（D00003 抖音+天猫）；商品侧消歧语义由 core 单测（SPU-D/SPU-E 多平台）与 `get_product_portrait` 的 month 用例覆盖，MCP 层两侧走同一 `selectPortrait` 实现，故未为商品侧另建同月多平台夹具。
2. **`reference.ts` 渠道文件级 tie-break 保留文件名序**：参考数据路径为单平台，同月同实体多文件时按文件名序取首份（P1 既有行为），未引入 `PLATFORM_PREFERENCE` 排序；多平台优先级只在 `data/` 路径生效并在 notes 写明。
3. **SA-12 判据修正**（spec v0.2 已记录）：逐字节一致与 SA-06 相抵触，改为「不变或逐单元可解释」；比对脚本对数值带 1e-9 容差（重归一化在 Top3 展示占比上留浮点尾差，得分与相似度逐位一致），判据、容差理由与输出格式均在脚本头注释写明。
4. **U6 反转**（spec v0.2 已记录）：演示报告重新生成并入库。
5. `get_retention_cohort` 的 `cohortMonth` 未纳入本批 month 校验：参数名非 `month`、语义为首购月份且不在任务列出的工具范围内；如需统一另立小修。

## 范围外发现（只记录不修，归切片 B）

1. **单品画像文件名带月份前缀时 entityId 保留「款号」前缀**：如 `款号SPU-9002_2609_抖音.csv` 解析出的 entityId 与无月份文件（`款号SPU-9002_抖音.csv`）不一致，影响同款跨月画像关联（identity.ts 的「款号」剥离规则未覆盖该形态）。
2. **`deriveActualUnitPrice` 成为死代码**：`normalize/performance.ts` 导出、`normalize/index.ts` 转出口，SA-08 后 src 内无任何调用方（仅构建产物 .d.ts 引用）；删除与否归切片 B 一并裁剪。

## 已知限制与 NOT_RUN 汇总

- `npm run offline-check` 端到端段 NOT_RUN（无数据工作树预期失败；守卫自检段 PASS）。
- CI NOT_RUN（未推送）；真实数据前后快照与比对为主 agent 验收证据，本文仅引用路径，不下结论（`NOT_PROVED`）。
- 工具1 `--demo` 路径不接受 `month`，未做校验语义（无入参入口）。
- 演示报告比对脚本不入 `npm run check`，作为 SA-12 证据工具按需手跑（用法见脚本头注释）。
