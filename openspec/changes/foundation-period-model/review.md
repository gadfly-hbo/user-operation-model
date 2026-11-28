# 切片 A「时间与选择语义」独立复核报告

复核者：`SDD·TDD 独立复核者`（未参与候选任何部分，全程只读）
复核时间：2026-11-28
日志目录：`/Users/huangbo/Dev/Projects/user-operation-model/.local/review-slice-a/`（`logs/`、`copy/`、`expectations.md`、`mutations.mjs`、`mutations-batch2.mjs`、`demo-explain-check.mjs`）

---

## 1. 复核范围与候选身份

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/huangbo/Dev/Projects/user-operation-model` |
| 候选工作树 | `.qoder/worktrees/agent-SDD-TDD-d0463d03` |
| 分支 | `work/foundation-period-model` |
| 候选 HEAD | `a1ae9ba8a408571d436c5ff041ed4c57f995af13`（前 7 位 `a1ae9ba`，核对一致） |
| 基线 / merge-base | `main @ d138592`（核对一致） |
| 工作树状态 | `git status --porcelain` 为空；仅 `packages/*/dist/` 被忽略（本复核重建，属构建产物） |
| 提交范围 | `d138592..a1ae9ba` 共 11 个提交、47 个文件（+3482 / −588） |
| 规格 | `openspec/changes/foundation-period-model/spec.md`（v0.1 + 末尾 v0.2 验收修正，按有效规格对待） |
| 结果记录 | 同目录 `result.md` |

**隔离声明**：未修改候选工作树任何源码／测试／规格／证据；未做任何 git 写操作；变异只在 `.local/review-slice-a/copy/`（`cp -R` 整个候选工作树含 `node_modules`）进行，还原一律从候选工作树重新拷贝文件覆盖（未用 `git checkout/restore/reset/stash`）。变异结束后逐一 `cmp` 了 10 个被改文件与候选工作树逐字节一致，并重建、重跑相关测试全绿（见 §6 末）。本报告与日志不含任何业务数值、店铺名、款号、画像份额；出现的标识符均来自合成 fixture 或演示 fixture。

### 实际执行的命令与退出码

| # | 命令（工作目录） | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `git -C <工作树> rev-parse HEAD` / `status --porcelain` / `merge-base main HEAD` | 0 | 身份一致、工作树干净 |
| 2 | `git diff --stat/--name-status d138592..a1ae9ba` | 0 | 见上 |
| 3 | `npm run check`（候选工作树，重建 dist） | 0 | **608/608 PASS**，0 TS 错误（`logs/check.log`） |
| 4 | `UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden` | 0 | 黄金回归通过，G1–G5 全部 PASS（与脚本内冻结基线比较；`scripts/` 无改动）；日志与主 agent `accept/golden.log` 除我追加的 `EXIT=` 行外逐行一致（`logs/golden.log`） |
| 5 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 0 | 忠实门通过；日志与 `accept/fidelity.log` 一致（`logs/fidelity.log`） |
| 6 | `node --import ./scripts/offline-check/block-net.mjs scripts/offline-check/guard-selftest.mjs` | 0 | 13 个出网入口全部拦截（`logs/offline-guard-selftest.log`） |
| 7 | `npm run check:archive-content` | 0 | PASS |
| 8 | `python3 .github/scripts/check-docs-links.py .` | 0 | 145 条链接 0 错误 |
| 9 | `python3 .github/scripts/check-data-guard.py .` | 0 | PASS |
| 10 | 副本：`node packages/tool1-channel-match/dist/src/bin.js --demo --out /tmp/uom-review-slice-a/demo/tool1-report.html` | 0 | 与入库的 `site/web/tool1-report.html` **逐字节一致**（sha256 前缀 `d96c6934c16d2725`）。注：CLI 拒绝把演示产物写进仓库内（含 `.local/`），改写到 `/tmp` |
| 11 | 副本：`node --import ./scripts/offline-check/block-net.mjs review-probe.mjs`（合成 fixture + `InMemoryTransport`，调用 8 个工具） | 0 | 守卫计数 0；结果见 §3/§7（`logs/mcp-probe.log`） |
| 12 | 副本：守卫下 `fetch("http://127.0.0.1:9/")`（单独进程，仅回环） | 0 | **守卫未拦截全局 `fetch`**（计数仍为 0；请求由 undici 自身以「bad port」失败）——与主 agent 所述一致 |
| 13 | 副本：`node mutations.mjs` / `node mutations-batch2.mjs` | 0 | 21/21 变异被杀死；还原后重建 exit 0、相关测试 227/227 与 85/85 全绿 |
| 14 | `node demo-explain-check.mjs <副本> <demo-diff-report.json>` | 0 | 20 个变化单元 = 恰好 20 个存在单侧标签的单元，单侧标签只出现在 `strategy_segment` |
| 15 | `git diff --stat d138592..a1ae9ba -- package.json package-lock.json packages/*/package.json` | 0 | 空 |
| 16 | 同上 `-- packages/core/src/product/catalog/fields.ts`、`-- packages/core/src/model packages/tool2-portrait-predict`、`-- scripts .github templates` | 0 | 均为空 |

**未运行（NOT_RUN）**：`npm run offline-check` 端到端段（需真实数据，按任务约定不跑）；CI；真实数据上的 MCP 调用与工具1 运行（只审了主 agent 的 `capture.mjs`/`compare.mjs` 与 `probe.log`，未重跑 `capture.mjs`）；真实数据 `data/` 只按授权只读访问了黄金参考目录与 fidelity 归档目录。

---

## 2. 预期清单（打开实现之前导出）

全文见 `expectations.md`（落盘时间 20:32，早于读取任何实现文件）。摘要（P01–P57）：

- **SA-01**：`2026-10`→month；`2025-07~2026-06`→window；`2024`→`{kind:year,label:"2024-01~2024-12"}`；`""`→unknown；`2026-13`→unknown；`periodCovers` 单月相等／区间与年闭区间／unknown 永不覆盖；年份画像 `period.kind=year` 且 `month` 与之同步；旧 `match/month.ts` 与工具1 挑选函数删除。
- **SA-02**：签名与三种返回形态；不带 month 恰一份 found、多份 ambiguous(month)；带 month 按 exact＞window＞year＞unknown 取最优层，同层多平台未给 platform → ambiguous(platform)，给了取该平台，同平台重复文件取索引顺序首份；任何情况不回退相邻月；（推断）platform 给定但不在最优层 → not-found；（v0.2）非法 month → `invalid-month` 且零查找；`PLATFORM_PREFERENCE` 抖音＞天猫＞京东、其余名称序。
- **SA-03**：七个工具 `month?`；compare 的 `productPlatform?/channelPlatform?`；多平台 → `ambiguous`（message 列平台、hint 提示传 platform）；similar 无 month 多份 → ambiguous；aggregate 同理；`search_by_tag` 可选 month 且命中带匹配方式；工具1 两路径走 `selectPortrait`、notes 写明数量；（v0.2）非法 month → `invalid-argument`／CLI 非零退出无产物；`list_channels` 同源覆盖规则。
- **SA-04/05**：`schemaVersion==="0.2.0"`；performance/funnel/channelPerformance 按月键控；空月 → `unknown`；无丢弃、无「取最新月份」记录；dossier 带 month 四类只含覆盖该月、全无 → `month-mismatch` 列可用月份；不带 month 全部；单数 `portrait` 移除。
- **SA-06**：JS／余弦／Top3 都在公共标签重归一化分布上算；证据带 `excludedProductLabels/excludedChannelLabels`；无公共标签 → `no-common-labels` 不加权；compare/similar/aggregate 同口径；`MATCH_CONFIG.version` 递增且文档记「未校准」；share=0 标签的处理需核对。
- **SA-07～SA-12**：notes 写多平台取用数量；四份文档与实现一致；单价四级优先级与零／负值；`index.months` 四类并集、`availableMonths`；既有行为保持；六条门禁；演示报告「不变或逐单元可解释」且解释须经复核者独立核对。

---

## 3. 逐条 SA 结论

状态词只用 `PASS` / `FAIL` / `NOT_RUN` / `UNKNOWN` / `NOT_PROVED`。「PASS」指验收条目在规格明示的主路径与边界上成立；边缘缺陷按 §7 分级，不掩盖。

| 标识 | 结论 | 依据 |
| --- | --- | --- |
| **SA-01** | **PASS** | `period/parse.ts:10-64`：单月／区间／年份／空串／非法归类与预期一致；年份 → `2024-01~2024-12`（`parse.ts:57-61`），`YYYY-01~YYYY-12` 也识别为 year（:50-52）；起止倒置、端点非法 → unknown。`periodCovers`（:72-82）单月相等、区间闭区间、unknown false。实测边界：`"0000"`、`"2610"` → year；`"2024-1"`、`"2026-00"`、`"2026-12~2026-01"`、`"2024-13"` → unknown。`normalize/index.ts finalizePortrait`（:302-308）写入 `period` 且 `month = period.label`；`identity.ts:131-132` 年份段 → 全年区间。旧 `match/month.ts`、工具1 `dataset/portrait.ts`、`findPortraitByEntityIds` 已删除；全仓源码／测试／`docs/` 无残留引用（仅历史 openspec 归档记录提及，符合规范 §11）。变异 M04a/M04b/M19 被杀死 |
| **SA-02** | **PASS**（附应修-3、应修-4） | `period/select.ts:98-164`：month 校验先行（:103-105，零查找）；不带 month 恰一份／多份（:119-130）；带 month 分层取最优（:134-144），不覆盖者为 null 不参与 → 结构上不可能回退相邻月；platform 先过滤、无候选 → not-found（:112-116，满足推断预期 P15）；同层多平台 → ambiguous(platform)（:152-163）；同平台重复取索引顺序首份。实测：无月份画像作为最低层可被选中（match=unknown），不带 month 多份 → ambiguous(month)。`PLATFORM_PREFERENCE` 顺序正确（:20），`platformId` 别名 抖音/天猫/京东 → douyin/tmall/jd。变异 M03/M10/M11/M17 被杀死。缺陷：`platform: ''` 绕过歧义（见 §7 应修-3）；带空白の month 校验通过但永不命中（应修-4） |
| **SA-03** | **PASS**（附应修-1、应修-2、应修-6） | MCP：七个工具均有 `month?`（`server.ts:206,242,428,512,559,650,726,761`），compare 有 `productPlatform?/channelPlatform?`（:651-652），`get_channel_portrait/get_product_portrait/search_similar_products` 有 `platform?`；歧义统一走 `selectPortraitOrError`（:101-158）；similar 目标先单独解析（:770-781），aggregate 不带 month 逐成员检查歧义（:581-595）；`readMonth`（:170-185）→ `invalid-argument`；工具1 `bin.ts:161` 在任何产物前 `validateMonthOption`，`main().catch` → exit 1。工具1 `data-root.ts:88-108 pickByPreference` 走 `selectPortrait` + `PLATFORM_PREFERENCE`，notes 写数量（:189-193）；`reference.ts` 两条路径走 `selectPortrait`。离线守卫下探针：同月多平台 → `ambiguous` 且 message 列平台；非法 month → `invalid-argument`；`search_by_tag` 带 month 的命中 `match ∈ {exact, window}`。变异 M09a/M09b/M15/M18/M20 被杀死。缺陷：最优层为不同区间标签的多平台歧义时 hint 错指「传 month」（应修-1）；hint 把区间／年份标签列为「可用月份」但入参校验拒绝它们（应修-2）；校验被扩展到 5 个未列工具（应修-6） |
| `search_by_tag` 不带 `month` 时无 `match` 的判断 | — | **判定：可接受。** 规格「完整可观察结果」#2 原句「`search_by_tag` 新增可选 `month`，命中结果带匹配方式」紧跟「新增可选 month」，自然读法是「带 month 查询时命中带匹配方式」；无参照月时「匹配方式」无定义（单月标签叫 exact 并不表示与任何月匹配）。`mcp-usage.md:62` 已明确「带 `month` 时…命中结果带匹配方式」，`TagHit.match` 注释同义（`query.ts:211-212`），实现、类型、文档三者一致。建议不改 |
| **SA-04** | **PASS**（附建-3、建-4） | `product/types.ts`：`schemaVersion` 注释、`FunnelByMonth`、`performance: Record<string, PerformanceMetrics>`、`channelPerformance: Record<渠道, Record<月份, …>>`；`normalize/product.ts:89` → `'0.2.0'`；`build.ts applyProductPerformance`（:677-708）按月键控全部保留、不再 `pickLatest`、不再记塌缩 issue；`applyProductChannel`（:748-777）按渠道→月份；`applyFunnel`（:805-815）月份×阶段、同阶段覆盖不重复；空月经 `textCell` → undefined → `'unknown'` 键（三处一致）。变异 M05/M06 被杀死。注意：同月重复行后写覆盖且无 issue（建-4）；渠道侧 `ChannelRecord.performance` 仍取最新月份（建-3，SA-04 字面只约束 ProductDossier） |
| **SA-05** | **PASS** | `server.ts:421-503`：`portraits: [{month, platform, projections}]`（:438-447）；带 month 时 performance/funnel/channelPerformance 用 `pickMonthKey` 只取该月键（:449-461）；四类皆无 → `month-mismatch` 并列可用月份（:463-488）；单数 `portrait` 已从类型与返回移除。主 agent 探针与我的探针一致。变异 M09a/M12 被杀死 |
| **SA-06** | **PASS**（附建-1） | `similarity.ts:59-83 restrictToCommonLabels`：公共键交集各自 `toDistribution` 重归一化，单侧标签排序列出；`kernel.ts:115-161` JS／余弦／Top3 全部用 `restriction.*`，无公共标签 → `no-common-labels`（:119-136），`available=false` 不入加权（:243-250, :289-293）；`diffPortraits`（`similarity.ts:162-223`）同函数同口径，`comparedDimensions` 排除不可用维度；`types.ts` 增 `excludedProductLabels?/excludedChannelLabels?` 与 `MissingReason 'no-common-labels'`；`config.ts` 仅版本号与注释变化（权重／价格带／评级／熔断逐字未动）；`match-calibration.md §6` 新增一行说明「技术修复、仍记未校准」。黄金 G1–G5 逐字一致（我复跑）。变异 M01/M02 被杀死。未决点：share=0 的标签仍计入「公共标签」（建-1） |
| **SA-07** | **PASS**（附应修-5） | `match-kernel.md §1/§4/§5/§8`（608 例与我实跑一致）、`normalize-rules.md §2.1/§5.5/§12.9`、`match-calibration.md §6`、`mcp-usage.md` 逐条与代码一致；工具1 notes 文案含数量与优先级（`data-root.ts:189-193`）；docs-links 0 错误。但 `normalize-rules.md:530` 仍有一句描述被删除的旧行为（应修-5） |
| **SA-08** | **PASS** | `match/price.ts:39-51`：该月零售额、零售量均 > 0 → `retail-amount-qty`（两位小数）→ `actualUnitPrice` → `unitPrice` → `missing`；`positive()` 排除 0／负；`resolveRetailAmount`（:56-60）该月指标优先、其次主数据。`build.ts` 不再写回 `price`（`deriveActualUnitPrice` 调用已移除，函数成死代码——作者已记为范围外）；工具1 `data-root.ts:163-168` 与 `reference.ts:206-228` 都走它。变异 M07 被杀死（core 与 tool1 测试均失败） |
| **SA-09** | **PASS** | `build.ts:355-369` 四类来源并集、区间标签字面保留、空月不入；`availableMonths`（`query.ts:79-95`）未改语义；工具1 `indexMonths`（`data-root.ts:41-59`）调用 `availableMonths` 后按「单月取本身、区间／年份取结束月」转自然月（v0.2）。变异 M13 被杀死 |
| **SA-10** | **PASS** | 缺月不回退（selectPortrait 结构保证 + 测试）；`insufficient-dimensions` 路径未动（`kernel.ts:270-287`）；价格缺失不插补（`price.ts:50`，tool1 测试）；`data-not-ready` 探测与一致性守卫测试（`p0-completion.test.ts`）全过；`fields.ts` diff 为空，`predictionAttributes/comparisonOnly` 生成逻辑 diff 仅 schemaVersion 一行；原测试全过 |
| **SA-11** | **PASS** | 六条门禁我全部复跑，退出码均 0（§1 表 #3–#9）；黄金与 fidelity 日志与主 agent 证据一致 |
| **SA-12**（v0.2 判据） | **PASS**（演示部分）／真实数据快照部分 **NOT_PROVED**（附应修-7） | 演示：入库报告与候选代码重新生成结果逐字节一致；我用 fixture 独立重算：48 单元中恰好 20 个存在单侧标签（全部只在 `strategy_segment`），与 `demo-diff-report.json` 的 20 个变化单元完全重合，其余 28 个标签集合相同的单元逐位不变——「变化全部可由被排除的单侧标签解释」成立，v0.2 修正的三条理由（含 U6 反转）核实为真。真实数据快照：只审脚本（见 §7 应修-7），且真实数据无经营指标／漏斗／成交表（334 款 `hasPerformance/hasFunnel/hasChannelPerformance` 全为 false），该证据不覆盖 SA-04/05/08/09 的真实数据面 |

---

## 4. TDD 真实性结论

逐个打开 `.local/slice-a/red/*.log`，核对失败是否为**目标断言失败**：

| 验收 | RED 日志 | 判定 | 说明 |
| --- | --- | --- | --- |
| SA-01 | `red/SA-01.log` | **有效** | 13 例均为 `ERR_ASSERTION`（stub 全返回 unknown），如 `'0.1.0' !== '0.2.0'` 类；6 例通过的是负向用例（空串／非法→unknown），合理 |
| SA-02 | `red/SA-02.log` | **有效** | 16 例断言失败（status/kind/platforms 期望不符） |
| SA-03（core + MCP） | `red/SA-03.log` | **有效** | `searchByTag`/`similarProducts`/MCP 各工具均为断言失败 |
| SA-03（工具1 data-root 路径）、SA-08 工具1 集成、SA-09 `indexMonths`、工具1 年份 match | 同上 `:408-472` | **NOT_PROVED** | 「data/ 正式路径 · 期间语义（切片 A）」5 例的 RED 全是 **fixture 错误** `ENOENT …/tables/product-performance.csv`（临时目录未建 `tables/`），不是目标断言；后续修正后的 RED 只覆盖 v0.2 两项（`run3-fix1+2-tool1.log`）。核心等价行为（`selectPortrait` 分层、`PLATFORM_PREFERENCE`）在 core 层有有效 RED，且变异 M07/M10/M11 证明工具1 测试确有判别力 |
| SA-04 | `red/SA-04-08-09.log` | **部分有效** | 有效：schemaVersion、多月全保留、空月→unknown（performance）、渠道→月份、不再写回 price、`index.months` 并集。**NOT_PROVED**：`漏斗按「月份 × 阶段」`（:6 ✔）、`渠道成交源行月份为空归入 unknown`（:8 ✔）、`不再产生「档案取最新月份」问题记录`（:4 ✔） 在 RED 时已通过——RED 抓取时代码已部分实现（`performance` 当时已按月键控但只留一个月，:63-81）。`wip-check.log`（19:55）已 556/556 全绿，说明无更早的失败现场 |
| SA-05 | `red/SA-05.log`（与 SA-03 同一次运行） | **有效** | `month-mismatch` 为断言失败；另 2 例是读取不存在字段 `portraits` 的 `TypeError`（功能缺失型失败，可接受但非断言） |
| SA-06 | `red/SA-06.log` | **有效** | 7/7 断言失败（`no-common-labels`、excluded 标签、版本号、黄金锚定前提） |
| SA-08（`resolveUnitPrice`／`resolveRetailAmount`） | 同 SA-04 日志 `:16-31` | **NOT_PROVED** | `price.test.ts` 12 例在「RED」时 **12/12 通过**，即抓 RED 时 `price.ts` 已实现；SA-08 唯一有效的 RED 是「索引不再写回 price」。按规范 §4.3「后补测试不能伪造历史失败」，此项应永久记 `NOT_PROVED`；测试本身的判别力由变异 M07 独立证明 |
| SA-09 | 同 SA-04 日志 | **有效** | 2 例断言失败 |
| v0.2 三处修正 | `red/run3-fix1-core.log`（5 失败）、`run3-fix1-mcp.log`（13 失败）、`run3-fix1+2-tool1.log`（2 失败）→ 对应 GREEN 32/32、34/34、16/16；`run3-cli-invalid-month.log` exit 1 | **有效** | 均为断言失败；CLI 非零退出无产物有日志 |

GREEN 日志与现状一致：`green/SA-01.log` 20/20、`SA-02.log` 20/20、`SA-03.log` 37/37、`SA-04-08-09.log` 23/23、`SA-06.log` 7/7；候选 HEAD 全量 608/608（我复跑）。

**改动的既有测试逐个判断**：

| 测试 | 判断 |
| --- | --- |
| `core/test/index.test.ts`「按平台名确定性选择」→「显式歧义 + platform 消歧」 | **覆盖转移**：偷选是被规格（U1）修掉的缺陷；新断言仍验证确定性（两次调用 deepEqual）、平台列表与消歧后 `match==='window'` |
| `core/test/p0-tables.test.ts` 别名两例改走 `selectPortrait` | **覆盖转移**：入口换成唯一实现，断言等价（not-found 显式断言） |
| `p0-tables.test.ts`「零售额与零售量齐全时推出真实成交单价」→「不再写回 price」 | **覆盖转移**：正向推导改由 `price.test.ts` 承接；缺零售量不推导的断言保留并加强（该月指标不带 retailQty） |
| `data-mcp/test/p0-completion.test.ts` schemaVersion | 契约升版的必要同步，非削弱 |
| `core/test/match.test.ts` 两处黄金期望 | **覆盖转移，非削弱**：(a) 「性别分布不相交」在公共标签口径下会因维度不可用而「得分 0＜40」假阳性，改为同标签集、相反分布 `{女:.02,男:.98}`，阈值 `<40` 不变；(b) 「极低分裁剪到下限 25」原输入在 新口径下五维全部不可用 → `insufficient-dimensions`，改为同标签集极端错位构造，并用自定义 `clamp.min=60` 保留**精确**钳制断言 `totalScore === 60`；默认配置下改为 `≥ clamp.min`。我手算该构造的原始分约 54（含消费能力惩罚后更低）确实低于 60，钳制断言有效 |
| `tool1/test/dataset.test.ts`「indexMonths 保留字面标签」→ 索引层直接断言 | **覆盖转移**：原不变量改由 `buildIndex` 直接断言 `index.months` 保留字面标签，报告层另锁自然月口径；M13 被杀死说明有效 |

**结论**：核心验收（SA-01/02/06/09、v0.2 三处）TDD 真实；SA-08 的 `resolveUnitPrice`、SA-04 的三个用例、工具1 侧集成（SA-03/08/09）**先 RED 后 GREEN 不可证明**，须在 `result.md` 如实记 `NOT_PROVED`（见应修-6）。测试有效性由 21 个变异全部被杀死独立背书（§6）。

---

## 5. 硬约束逐条结论

| 约束 | 结论 | 证据 |
| --- | --- | --- |
| 匹配内核唯一 | **PASS** | 全仓无第二份评分逻辑：工具1 `data-root.ts`/`reference.ts` 只组数据并调用 core；`config.ts` diff 仅 `version` 与注释（blend/weights/grades/fuseThreshold/clamp/spendingPower 逐字未动）；`kernel.ts` 改动仅 `scoreDistribution` 内的公共标签口径、`channelApproximate` 改用 `parsePeriod`（对区间／年份行为等价，黄金逐字一致）。报告渲染层仍从 `ReportInput.config` 取参数。`portrait-input.ts` 的 `includes('~')` 是窗口识别的字符串启发式（建-9），不是评分逻辑副本 |
| 背对背隔离 | **PASS** | `git diff d138592..a1ae9ba -- packages/core/src/product/catalog/fields.ts` 为空；`normalize/product.ts` 仅 schemaVersion 一行；`predictionAttributes`/`comparisonOnly` 相关测试全过（608/608） |
| 数据不出网 | **PASS**（附守卫覆盖范围说明） | 无新增依赖（`package.json`/`package-lock.json`/`packages/*/package.json` 无变化）；diff 新增行无网络调用（`fetch/http/net/dns/child_process` 等 grep 为空，命中的只是 `RegExp.exec`）；diff 内无数据文件；`site/web/tool1-report.html` 与合成 fixture 重新生成结果逐字节一致 → 只含合成演示数据。**离线可用**：守卫自检 13 入口拦截；守卫下合成 fixture 起 MCP 内存传输并调用 8 个工具，守卫计数 0。**守卫范围如实说明**：守卫只补丁 `net`/`http`/`dns` 的 13 个入口，**不拦全局 `fetch`**（我实测：守卫下 `fetch` 计数仍为 0）与其它潜在通道；「计数 0」只证明未经由这 13 个入口出网，源码层面我另行确认无 `fetch`/网络调用。端到端 `offline-check` NOT_RUN |
| 模型来源可溯 | **PASS** | `git diff --stat d138592..a1ae9ba -- packages/core/src/model packages/tool2-portrait-predict` 为空；fidelity 门复跑 PASS、日志与作者一致 |
| 范围（允许修改路径） | **应修-6** | 严格对照 spec「允许修改路径」，`packages/core/src/portrait/types.ts`（新增可选 `period?: Period`，类型级、SA-01 所必需）不在清单内且 `result.md` 未列为偏差；`packages/tool1-channel-match/scripts/demo-equivalence.mjs` 由 spec v0.2 点名，视为已授权。`scripts/**`、`.github/**`、`templates/**`、根 `package.json`、`site/**`（除演示报告）均无改动 |

---

## 6. 变异复现表

全部在 `.local/review-slice-a/copy/` 进行；每个变异：改源码 → `npx tsc -b` → `node --test <测试文件>` → 从候选工作树拷回该文件。日志 `logs/mutations.log`、`logs/mutations-batch2.log`、`logs/mutations.json`、`logs/mutations-batch2.json`。

| 变异 | 文件 | 跑的测试 | 结果 |
| --- | --- | --- | --- |
| M01 相似度公共标签改回并集（JS/余弦/Top3） | `core/src/match/kernel.ts` | core common-labels、match、period-query | **杀死**（2/38 失败） |
| M02 去掉 `no-common-labels`（无公共标签给 0 分且可用） | `core/src/match/kernel.ts` | core common-labels、match | **杀死**（1/30） |
| M03 去掉 `selectPortrait` 的 `invalid-month` 校验 | `core/src/period/select.ts` | core portrait-select、mcp period-query、tool1 dataset | **杀死**（3/74；由 core 用例杀死，MCP 自带校验） |
| M04a `parsePeriod` 年份改回单月 `YYYY-01` | `core/src/period/parse.ts` | core period | **杀死**（3/20） |
| M04b `identity.ts` 文件名年份改回 `YYYY-01` | `core/src/normalize/identity.ts` | core period/portrait-select/period-query、tool1 dataset、mcp period-query | **杀死**（5/102） |
| M05 `schemaVersion` 改回 `0.1.0` | `core/src/normalize/product.ts` | core dossier-monthly、mcp p0-completion | **杀死**（2/56） |
| M06 漏斗按月键控改为丢弃月份 | `core/src/index/build.ts` | core dossier-monthly | **杀死**（1/11） |
| M07 `resolveUnitPrice` 调换优先级（先 unitPrice） | `core/src/match/price.ts` | core price、tool1 dataset | **杀死**（3/28） |
| M08 `list_channels` month 过滤改回字面相等 | `core/src/index/query.ts` | core period-query、mcp period-query | **杀死**（3/42） |
| M09a dossier `month-mismatch` 改成静默返回空数据 | `data-mcp/src/server.ts` | mcp period-query | **杀死**（1/34） |
| M09b 其它画像工具 `month-mismatch` 改成 `not-found` | `data-mcp/src/server.ts` | mcp period-query | **杀死**（1/34） |
| M10 `PLATFORM_PREFERENCE` 去掉抖音优先 | `core/src/period/select.ts` | core portrait-select、tool1 dataset | **杀死**（2/40） |
| M11 分层顺序打乱（window 优先于 exact） | `core/src/period/select.ts` | core portrait-select/index、tool1 dataset | **杀死**（1/67） |
| M12 dossier 带 month 不过滤指标／漏斗／成交 | `data-mcp/src/server.ts` | mcp period-query | **杀死**（2/34） |
| M13 `index.months` 只取画像来源 | `core/src/index/build.ts` | core dossier-monthly、tool1 dataset | **杀死**（1/27） |
| M15 工具1 `validateMonthOption` 空操作 | `tool1/src/dataset/data-root.ts` | tool1 dataset | **杀死**（1/16） |
| M17 同层多平台不再报 ambiguous（静默取首份） | `core/src/period/select.ts` | core portrait-select/index、mcp period-query | **杀死**（5/85） |
| M18 `search_similar_products` 目标多份不再报 ambiguous | `data-mcp/src/server.ts` | mcp period-query | **杀死**（1/34） |
| M19 `periodCovers` 区间改开区间 | `core/src/period/parse.ts` | core period、portrait-select | **杀死**（2/44） |
| M20 aggregate 不带 month 不再因成员歧义报错 | `data-mcp/src/server.ts` | mcp period-query | **杀死**（1/34） |

**存活：0。** 说明：M03/M09a/M13 第一版写法编译失败（TS 类型收窄），已改成等价且可编译的写法重跑（第二批），结论以第二批为准。还原后：10 个被改文件与候选逐字节一致；`tsc -b` exit 0；相关测试 227/227 与 85/85 通过。

未被变异覆盖的缺口（供后续补测，非缺陷）：share=0 标签的处理；`platform: ''`；带空白的 month；不同区间标签的同层多平台 hint；同月重复指标行的覆盖。

---

## 7. 发现

### 阻断
未发现。

### 应修（建议 squash 合并前处理，并由主 agent 重验受影响范围；不处理则须在 `result.md` 记为已知限制并由负责人接受）

1. **多平台歧义的 hint 在「同层区间标签不同」时指错方向** — `packages/data-mcp/src/server.ts:117-132`（`selectPortraitOrError`；`get_portrait_aggregate` 的 :590 同模式）。分支以 `selection.months.length > 1` 判定「月份歧义」，而 `selectPortrait` 在 reason=`platform` 时 `months` 是该层各画像的**字面标签**。实测（合成数据：抖音 `2026-07~2026-09` + 天猫 `2026-08~2026-10`，查 `2026-09`）返回 `ambiguous`，message 含平台，但 hint 为「传 month 参数（可用月份：2026-07~2026-09、2026-08~2026-10）」——调用方已传 month，照 hint 传区间标签又会被拒为 `invalid-argument`。与 SA-03「hint 提示传 platform」不符。修法：按 `selection.reason === 'month'` 分支。置信度：高（已实测复现）。
2. **hint 列出的「可用月份」是 `month` 校验拒绝的值** — `server.ts:124, 147, 155, 590` 与 `select.ts:103-105`。v0.2 把 `month` 收紧为自然月，但歧义／`month-mismatch` 的 hint 仍直接列出画像字面标签。主 agent 探针显示真实数据 7 份画像中 5 份是区间／年份标签，对这些渠道不带 month 查询时，hint 列出的「可用月份」全部无法作为入参。建议 hint 改为「自然月，须落在以下期间内：…」或列出期间覆盖的自然月。置信度：高（代码与探针均确认）。
3. **`selectPortrait` 的 `platform: ''` 绕过平台歧义** — `packages/core/src/period/select.ts:112`（真值判断）与 `:147`（`!== undefined`）不一致。实测：无 platform → `ambiguous`，`platform: ''` → **`found`**（静默取首份）。MCP 层已用 `args.platform !== ''` 挡住（`server.ts:251,519,663,770`），但 core 是公共 API。修法：两处统一为「非空串才视为指定」。置信度：高。
4. **带首尾空白的 `month` 通过校验却永不命中** — `select.ts:103-106` 用 `isNaturalMonth`（内部 trim）校验，`:132-144` 与 `parse.ts:75-78` 用原串比较；`server.ts:170-176` 原样透传。实测 `month: "2026-10 "` → `not-found`（MCP 将报 `month-mismatch`「在 2026-10 无画像」），而 `"2026-10"` → `found`。修法：校验后取 `parsePeriod(m).month` 作为规范值，或拒绝非规范写法。置信度：高。
5. **文档残留旧行为** — `docs/normalize-rules.md:530`：「…是为了不改变既有的查询行为（同月多平台画像按平台名确定性选择，见 `packages/core/src/index/query.ts`）」。该行为已被本候选移除（现为 `ambiguous`）。SA-07 的「逐条对照」应覆盖此句。置信度：高。
6. **`result.md` 记录不完整／状态词不准确** — `openspec/changes/foundation-period-model/result.md`：
   (a) `packages/core/src/portrait/types.ts` 不在 spec 允许路径内，未列入「改动文件」或「偏差」（:62-73、:89-95）；
   (b) `month` 校验被扩展到 5 个未列工具（`get_brand_portrait` :296、`get_competitor_portrait` :324、`get_recency_distribution` :875、`get_channel_flow_matrix` :902、`get_diagnosis` :935），「偏差」只提了未纳入的 `get_retention_cohort`（:95）；其中 `get_brand_portrait` 的 `month` 参数本就未参与过滤（既有问题），`get_competitor_portrait` 仍按字面相等过滤（:338），年份标签改为全年区间后该工具再也无法用 month 命中年份画像；
   (c) SA-08、SA-04（三例）、SA-03/08/09 工具1 侧的 RED 不成立（§4），却以「RED→GREEN 日志」记 PASS——按规范 §10 应记 `NOT_PROVED`；
   (d) 工具1 RED 的 fixture `ENOENT` 未披露。置信度：高。
7. **真实数据等价证据的解释缺口** — `.local/slice-a/equiv/compare.mjs:46-50` 只比 `semanticHash`（总分按 1 位小数取整后的字段），但快照里同一单元的 `dimensionsHash` 前后**不同**（`snapshot-before.json` m-2024-01 与 `snapshot-after.json` m-2024-12），`channelsHash`/`resultsHash` 亦不同，`compare.log` 未比对也未解释；语义哈希相同不能排除小于 0.05 的原始分变化（演示数据已证明：标签集合相同时证据逐位不变，故该差异应来自单侧标签排除，属 SA-06 预期，但需主 agent 用只输出键名／计数的结构化 diff 确认并记录）。另：真实数据无经营指标／漏斗／成交表，`hasPerformance/hasFunnel/hasChannelPerformance` 全 false，该证据不覆盖 SA-04/05/08/09 的真实数据面，应在结论中写明。我**未重跑** `capture.mjs`（只审脚本）。置信度：中高（差异事实确定，原因未核实 → `UNKNOWN`）。

### 建议

1. `similarity.ts:63`：`share === 0` 的标签仍算「公共标签」（实测构造：商品 `{A:1,B:0}` 对渠道 `{B:1}` → 公共集 `{B}`，JS 距离非零、余弦因范数为 0 返回 0、Top3 重合 1）。是否应把 0 份额标签视为「不存在」需与归一化规则 §5.5 对齐并补测；现状与旧口径一致，非回归。
2. 无月份画像的口径在工具间不一致：`selectPortrait` 将其作为最低层（任意月可命中，`match: unknown`），`list_channels` 也算覆盖；但 `get_product_dossier` 带 month（`server.ts:441-444`）、`search_by_tag` 带 month（`query.ts:222-227`）、`aggregatePortrait` 带 month（`query.ts:385`）用 `periodCovers` 直接排除。同一商品会出现 `get_product_portrait({month})` found 而 `get_product_dossier({month})` `month-mismatch`。规格字面两者皆可，建议统一或写入 `mcp-usage.md`。
3. 渠道侧经营指标仍取最新月份 — `packages/core/src/index/build.ts:728-734`（`applyChannelPerformance` 仍用 `pickLatest` 并记录「档案取最新月份」issue）。SA-04 字面只约束 `ProductDossier`，但与 R-2 同类；`normalize-rules.md:573`「同一款号／渠道多个月的记录全部保留」易被读成渠道指标也按月。建议记为范围外发现（归切片 B/C）并修文案。
4. `build.ts:700-708`、`:805-815`、`:766-772`：同款同月（或同渠道同月）重复行后写覆盖且不记 issue（基线同样不记，非回归）。
5. `server.ts:173`：`month: ""` 按「未传」处理（有意设计，注释写明），`mcp-usage.md:102` 只说「不是自然月即 `invalid-argument`」，建议补一句。
6. `toMatchPortraitInput`（`portrait-input.ts:17`）、`monthWithinScope`（`build.ts:616-621`）、`demo/fixture.ts:377` 各自用 `includes('~')` 识别区间，是 `period/` 之外的第二套窗口判定；建议后续统一到 `parsePeriod`。
7. `reference.ts:214-228` 用 `as ProductDossier` 伪造档案以复用 `resolveUnitPrice`；`unit-price` 来源不再像基线那样四舍五入到两位小数（黄金不受影响）。建议改成显式的最小输入类型或补舍入。
8. `product/types.ts:114-118`：描述「单品人群画像」的 JSDoc 挂在了 `funnel` 字段上（注释错位）。
9. `parsePeriod("0000")`、`"2610"` 归为 year；`periodCovers(period, "2024-1")` 对非自然月入参按字典序比较会返回 true（`parse.ts:78`）；`selectPortrait({ month: null })` 抛 `TypeError`（类型系统与 MCP zod 都挡住，仅核心 API 防御）。建议在 `periodCovers` 注明「month 须为自然月」。
10. `get_brand_portrait` 的 `month` 参数未参与过滤（既有）、`get_competitor_portrait` 仍字面相等（见应修-6b）——建议记为范围外发现。

---

## 8. 对 `result.md` 偏差与范围外记录的意见

| 记录 | 意见 |
| --- | --- |
| 偏差 1（商品侧多平台 MCP 集成测试由渠道侧承接） | **如实、可接受**：MCP 两侧走同一 `selectPortraitOrError`，core 层有商品侧多平台用例；但 hint 缺陷（应修-1）说明「同一实现」也需要对 hint 文案做商品／渠道两侧验证 |
| 偏差 2（`reference.ts` 保留文件名序 tie-break） | **如实、可接受**：单平台参考数据路径，不涉及平台优先级 |
| 偏差 3／4（SA-12 判据修正、U6 反转） | **理由核实为真**（§3 SA-12 独立重算）；脚本判据「带被排除标签即算可解释」是必要条件而非因果证明，我用标签集合差异独立交叉验证后成立 |
| 偏差 5（`get_retention_cohort.cohortMonth` 未校验） | 如实；但遗漏了已改的 5 个未列工具（应修-6b），应补记 |
| 范围外 1（文件名带月份前缀时 entityId 保留「款号」前缀） | 如实；归切片 B 合理。它会影响同款跨月画像关联，即 SA-02 在真实数据上的可用面，建议在主 agent 验收结论里点名 |
| 范围外 2（`deriveActualUnitPrice` 死代码） | 如实；仍从 `normalize/index.ts:46` 转出口 |
| 未记录 | `portrait/types.ts` 越出允许路径（应修-6a）；渠道侧指标仍塌缩（建-3）；`dimensionsHash` 未解释（应修-7）；TDD `NOT_PROVED` 项（应修-6c） |
| 「逐项状态」SA-01～SA-12 全 PASS | 行为层面我同意；**TDD 证据层面 SA-08、SA-04（部分）、SA-03/09（工具1 侧）应为 `NOT_PROVED`**，不是 PASS。SA-12 真实数据部分作者已自记 `NOT_PROVED`，处理正确 |

**是否应升级**：应修-1、2（hint 可用性）与应修-6（记录真实性）建议在合并前修正；其余可随切片 B/C 处理。

---

## 9. 总结论

**PASS（附带条件）**

- 无阻断项。四条硬约束全部成立；SA-01～SA-12 的行为层面逐条核实成立；六条门禁我独立复跑全部退出码 0；21 个变异全部被杀死；入库演示报告可由候选逐字节复现且变化全部可解释。
- **附带条件（合并前）**：处理应修-1～应修-7，其中应修-6（`result.md` 补记越界路径、未列工具的校验扩展、TDD `NOT_PROVED` 项与 fixture `ENOENT`）与应修-5（文档残句）为记录／文档修正，应修-1～4 为小范围代码修正（均在 `select.ts`／`server.ts`，各有现成测试文件可加用例；修正后主 agent 重验 `data-mcp/test/period-query.test.ts`、`core/test/portrait-select.test.ts` 与 docs-links）。不处理者须在 `result.md` 记为已知限制并由负责人接受，不得记为 PASS。
- **永久性 `NOT_PROVED`（无法补救，只能如实记录）**：`resolveUnitPrice`／`resolveRetailAmount`、SA-04 三例、工具1 侧 SA-03/08/09 集成的「先 RED 后 GREEN」。
- **未核实项**：真实数据 `dimensionsHash` 差异的原因（`UNKNOWN`，需主 agent 结构化 diff）；真实数据上 SA-04/05/08/09 的等价（数据中无相关表，`NOT_PROVED`）；`npm run offline-check` 端到端、CI（`NOT_RUN`）；断网守卫不覆盖全局 `fetch`，「计数 0」仅对 13 个入口成立。
