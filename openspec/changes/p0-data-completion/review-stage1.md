# P0-Data-Completion · 阶段一独立复核报告

> 复核者：SDD·TDD 独立复核者（未参与本候选任何部分）
> 复核日期：2026-11-27
> 对应规格：[spec.md](spec.md)（DC01–DC11）· 作者自述：[result.md](result.md)

---

## 1. 候选身份与工作区纪律

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/huangbo/Dev/Projects/user-operation-model` |
| 候选 | commit `7d585ff`（父提交 `41109c8`；分支 `work/p0-data-completion`） |
| 复核工作树 | `/tmp/uom-wt-review-data`（detached @ 7d585ff，工作树 clean） |
| main 基线快照 | `/tmp/uom-main-base`（`git archive 41109c8` 提取，只读构建，未做任何 git 写操作） |
| 变异实验区 | `/Users/huangbo/Dev/Projects/user-operation-model/.local/review-mut`（工作区完整副本，项目忽略目录） |
| 变异备份 | `.local/review-bak/`（`server.ts.bak`／`build.ts.bak`／`table.ts.bak` + `md5-orig.txt`） |
| 真实数据 | 主仓 `data/`（只读；`tables/`、`retention/` 为空目录，无新表） |

纪律执行：候选源码/测试/规格零修改（复核结束时工作树 `git status` 为空、三份变异目标 md5 与原值一致：`ff72b108…`／`5525266a…`／`67ec4d0e…`）；未做任何 git 写操作；临时脚本与产物只写 `/tmp/uom-review/` 与 `.local/`；主仓未提交的 `docs/data-request.md` 修改（复核者之外所为）不在本候选内，未评价。

构建与全量测试（独立实跑）：

- `npm ci --ignore-scripts && npm run build` → **PASS**
- `npm test` → **292 / 292 PASS**（与作者自述一致；main 基线独立实跑 204/204，204 + 88 = 292 核实）

## 2. 预期清单（从验收导出，先于阅读实现完成）

由 spec DC01–DC11 导出、在打开实现前固定：

- **E1 (DC01)**：7 个桩工具真实实现；fixture 到位返回真实结果；缺文件 → `data-not-ready` 且指名缺失文件，不返回空结果
- **E2 (DC02)**：空文件/仅表头/缺必需列/数值不可解析 → `NormalizationError`，不静默空结果
- **E3 (DC03)**：守卫测试锁死「探测说就绪 ⇒ 处理器非桩」
- **E4 (DC04)**：别名目录存在 → 实体名归一再关联、逐条可追溯；不存在 → 与现状逐字一致
- **E5 (DC05)**：冲突映射存在 → 按处置；不存在 → 保持现状、记 conflict、不隐式合并（spec 括注「保留先到一条」与「保持现状」并列，本身有歧义）
- **E6 (DC06)**：声明填写 → 只覆盖声明范围、范围外记 issue 跳过；未填写 → 现状 + 记「未声明」
- **E7 (DC07)**：关联表存在 → `list_products` `channel` 过滤可用且错配清单可输出渠道级销售额；不存在 → `data-not-ready`
- **E8 (DC08)**：聚合口径表存在 → series/hot/ip；不存在 → 仅 category，口径 §5.6
- **E9 (DC09)**：经营指标填充；缺失不插补；零售额/量齐全推真实成交单价
- **E10 (DC10)**：无新增第三方依赖；新代码零出网
- **E11 (DC11)**：未登记标签/维度不投影，有测试
- **E12**：DC12–DC16 一律 NOT_RUN，不得写成通过

## 3. 逐项结论表

| 复核项 | 结论 | 独立证据（命令/实验） |
| --- | --- | --- |
| DC01 真实实现（7 工具） | **PASS** | 真实 MCP stdio（spawn `bin.js`，JSON-RPC over stdio）+ 自建合成 fixture：get_funnel／get_retention_cohort／get_recency_distribution／get_diagnosis／get_channel_flow_matrix／list_member_features／get_competitor_portrait 全部返回真实解析结果（含 `上新`→launch 别名归一、`40%`→0.4 口径、competitor 独立实体类型）；缺文件 7/7 返回 `data-not-ready` 且消息指名缺失文件（funnel.csv、cohort.csv 等），0 个空结果 |
| DC02 错误路径 | **PASS** | stdio 实跑 4 种坏输入（空文件/仅表头/缺必需列/数值「一千」）→ 启动即抛 `NormalizationError`（missing-field/parse-error），消息可辨，不静默空结果；另有单测锁定 |
| DC03 一致性守卫 | **PASS** | 变异 M1（get_funnel 处理器改回无条件 `notReady`）→ 守卫测试 `get_funnel：fixture 满足探测条件时不得返回 data-not-ready` **失败**（KILLED）。守卫逐工具遍历 `DATA_SOURCE_PROBES` 且有覆盖率自检 |
| DC04 别名目录 | **PASS** | 真实数据对照（无表）逐字一致；合成契约表抽验：画像实体「别名店名」→ 归一「规范店名」、记 `entity-alias` issue、`channelEntityIds` 同含店铺编码/规范名/别名；`entity-alias.csv` 列契约（规范实体名,别名,店铺编码,平台）与 normalize-rules §12.4 一致 |
| DC05 冲突映射 | **PASS（口径待用户确认，见 F4）** | 真实数据 1 处真实冲突（森马广州越秀区北京路店 2025-07~2026-06，jd+douyin）：候选「两侧保留 + conflict issue」，查询结果与 main 逐字一致（§4 对照）；变异 M3（无映射时静默丢弃一侧）→ 测试失败（KILLED）；变异 M6（keep-a/keep-b 不再移除）→ 测试失败（KILLED） |
| DC06 README 声明 | **PASS** | 真实数据：`declaration.declared=false`，notes 记「数据时间范围未声明：声明表为空（占位符不算填写）」；合成抽验：声明 2025-07~2026-06 后 2024-01 画像被跳过记 `scope-excluded`、月份未知画像保留并记 issue、HTML 注释占位视为未填 |
| DC07 商品↔渠道 | **部分 PASS**：`channel` 过滤与 `channelSales` **PASS**；「错配清单可输出渠道级销售额」**NOT_RUN**（工具1 不在允许路径，已如实记 result.md §6；但 §2 整项标 PASS 不妥，见 F1） | stdio 实跑 `list_products {channel}`（真实数据缺表 → data-not-ready 与 main 一致；合成关联表 → 过滤生效、`channelSales` 逐月零售额/量返回）；`packages/tool1-channel-match/**` diff 为空 |
| DC08 聚合层级 | **PASS** | 合成口径表：`aggregatePortrait(level=series)` 返回 entityType=series；无表时 series → data-not-ready（与 main 逐字一致）；口径 §5.6 复用既有聚合实现 |
| DC09 经营指标 | **PASS** | 合成抽验：缺失列（退货率/退款率/转化率）保持缺失、不插补（M2 把缺失填 0 → 测试失败，KILLED）；成交单价 6000/20=300 推算且仅在原单价缺失时写入；多月份取最新并记 issue（代码审阅 `pickLatest`） |
| DC10 依赖与出网 | **PASS** | `git diff 41109c8..7d585ff -- package.json package-lock.json packages/*/package.json` 为空（零新增依赖）；`npm audit --audit-level=high` 0 漏洞；`npm run offline-check`（指向主仓真实 data/）：守卫 13 个出网入口全拦截、17 工具 9 就绪/8 data-not-ready/0 意外、**出网尝试 0**、工具1 演示+参考数据报告均 PASS（0 出网）；新代码静态扫描无 `node:net/http/dns/fetch` |
| DC11 未登记不投影 | **PASS** | `p0-invariance.test.ts` 两条用例真实断言注册表行为（未登记维度保留在平台原生标签并记 issue；已登记维度下未映射标签记 unmapped-value 不投影），沿用 DM15 语义 |
| DC12–DC16（阶段二） | **NOT_RUN**（真实数据未到位） | 与 spec §9「数据到位前一律 NOT_RUN」一致；result.md 未写成通过 |
| 作者自述核对 | **基本属实，2 处计数不实 + 1 处文档过时**（F2/F3） | 见下 |

作者自述逐条复核：

| 声称 | 复核结果 |
| --- | --- |
| `npm test` 292/292 | **属实**（独立实跑 292/292；基线 204 独立实跑核实） |
| RED core 14 过/27 败（41 用例） | **属实**（`.local/p0/red-core.txt` 叶子用例计数 14/27，失败均为行为断言 ERR_ASSERTION，非导入/环境失败） |
| RED mcp 25 过/20 败（45 用例） | **属实**（`red-mcp.txt` 计数 25/20） |
| 新增 88 例 | **属实**（35 + 8 + 45 = 88） |
| p0-tables 35 例 / p0-invariance 10 例 / p0-completion 45 例 | **不实**：p0-invariance 实为 **8** 例（§3 表内部 35+10+45=90 与「新增 88」自相矛盾，见 F2） |
| RED→GREEN 41/41 | **不完整**：现存 core p0 为 43 例；「千分位数值按真实值解析」「数值列部分匹配」2 例在 RED 日志中不存在（后补无 RED 记录，见 F2）。复核已验证该 2 例有杀死力（M4） |
| 文档链接 100 条 0 错 | **属实**（`check-docs-links.py` 复跑：100 条，0 错 0 警） |
| 数据守卫通过 | **属实**（复跑通过） |
| 依赖审计 0 漏洞 | **属实**（复跑 0） |
| 黄金回归 G1–G5 通过、锚点评级不变 | **属实**（`UOM_REFERENCE_ROOT=~/工作/抖音货渠匹配/75-抖音人货匹配看板 npm run test:golden`：G1 锚点 91.9 A → 95.4 A、G5 锚点 40.9 C → 42 C，全 PASS） |
| 真实 data/ 自检 334/200/7、3 个月份、declared=false、1 处冲突 | **属实**（独立构建索引逐项吻合；冲突为 森马广州越秀区北京路店 2025-07~2026-06 jd+douyin） |
| 范围核对（只落允许路径） | **属实**（diff 25 文件全部落在 spec §6 清单；match/、tool1、site/web、product/types.ts 零改动） |
| 断网检查 NOT_RUN | 当时成立；**复核已实跑补证 PASS**（建议回填 result.md，见 S2） |

result.md §7 四条范围外记录核对：

1. **§7-1 DC05「两侧保留」与 main 一致性**：**属实**。对照实验：冲突实体查询结果与 main 逐字一致（同为确定性选 douyin），产品/渠道/画像/月份/unavailable 全部逐字一致，差异仅 1 条新增 conflict issue（§7-2 已声明）。spec DC05 括注「保留先到一条」与「保持现状」自相矛盾，实现取「保持现状」= 真实现状，处置合理，**但需用户确认口径并同步规格表述（F4）**。
2. **§7-3 留存三表缺 `月份` 列**：**属实**。`docs/data-request.md`（7d585ff）第 6–8 项确无 `月份` 列，而 Recency／流转／诊断解析器必需列含 `月份`（catalog/tables.ts:139-178）。该文第 5、64 行另有过时表述（F3）。
3. **§7-3 渠道级错配排序未做但已暴露 `channelSales`**：**属实**。`list_products` 返回 `channelSales`（server.ts 渠道过滤分支），tool1 侧未接入（不在允许路径，已记 NOT_RUN）。
4. **§7-4 `get_portrait_aggregate` 非法 level 改 `invalid-argument`**：行为属实（真实数据对照中唯一差异，符合 result.md 记录），但「已进 mcp-usage 文档」不完全成立（S1）。

文档一致性（normalize-rules §12 ↔ 实现逐字段核对）：12 张表的必需/可选列、指标键（day30/day60/day90/next_season）、占比「含 % 除 100」口径、文本空值与 `-` 视为缺失、错误路径抛 `NormalizationError`、别名只归一不合并、冲突三情形表、声明区间「整份跳过」语义、经营指标字段映射与单价推算条件、竞品 competitor 实体类型——**全部与 `catalog/tables.ts` 及各解析器一致，PASS**。mcp-usage「探测到文件即自动可用」的错误说法**已明确纠正**（mcp-usage.md:77-79），就绪条件表述准确。

## 4. 变异清单（备份→改→跑→备份覆盖还原→md5 校验）

全部在 `.local/review-mut/` 副本内进行；每例还原后 md5 与原值一致，收尾全量 `npm test` 292/292 复绿。

| # | 变异（关键实现改坏处） | 目标 | 结果 | 判定 |
| --- | --- | --- | --- | --- |
| M1 | `server.ts` get_funnel 处理器改回无条件 `notReady('get_funnel')` | DC03 守卫 | `get_funnel：fixture 满足探测条件时不得返回 data-not-ready` 失败（另 1 条 DC01 用例同败） | **KILLED** |
| M2 | `build.ts` 经营指标缺失值插补 `sellThroughRate = … ?? 0` | 缺失不插补（DC09） | `商品经营指标填充 performance，缺失字段不插补` 失败 | **KILLED** |
| M3 | `build.ts` 无冲突映射时静默丢弃一侧且不记 issue | 不隐式合并（DC05） | `映射表不存在时保持现状：两侧都保留且记冲突，不隐式合并` 失败（现状不变性用例同败） | **KILLED** |
| M4 | `table.ts` `strictNumber` 退化为 `parseFloat` 部分匹配（千分位截断/尾部垃圾接受） | 自设：数值解析严格性 | `千分位数值按真实值解析` 与 `数值列部分匹配抛错` 两条均失败 | **KILLED** |
| M5 | `table.ts` `percentCell` 含 `%` 不再除以 100 | 自设：占比口径 | 4 条失败（Cohort、诊断、商品/渠道经营指标） | **KILLED** |
| M6 | `build.ts` keep-a/keep-b 不再移除任何一侧 | 自设：显式映射处置 | `映射表存在时按处置保留一侧` 失败 | **KILLED** |

合计 **KILLED 6 / SURVIVED 0**。还原证据：`md5(server.ts, build.ts, table.ts) = ff72b108cf9c30569b0c7d08846a52f1 / 5525266a91557ab92103460395180bd0 / 67ec4d0e67c1dfd65ca1728ee32351f5`，与变异前备份一致（`.local/review-bak/md5-orig.txt`）。

（注：复核环境曾出现 `/tmp` 工作树编辑回写延迟，M1 首次在 `/tmp` 副本的实跑实际跑到了未变异代码；已按协议改在 `.local/review-mut/` 副本重做并以 md5 验证变异生效后才计数，上表结果全部来自生效后的实跑。）

## 5. 真实数据对照结论（DC04/DC05/现状不变性）

方法：`git archive 41109c8` 得 main 代码独立构建；两侧各自经 **真实 MCP stdio** 对主仓 `data/` 调用全部 17 个工具 × 27 组入参（含边界入参），逐字节比对；另对索引层做逐字段比对（脚本 `/tmp/uom-review/`，未入仓）。

| 对照 | 结果 |
| --- | --- |
| 工具清单 | 两侧均 17 个，名称一致 |
| 27 组工具调用输出 | **逐字一致，唯一差异**：`get_portrait_aggregate {level:"foo"}` 由 `data-not-ready` 改 `invalid-argument`（result.md §7-4 声明的有意变更，非法入参报错更准确；合法层级与 main 一致） |
| 索引 products/channels/portraits/months/unavailable | **逐字一致**（334 商品、200 渠道、7 画像、3 个月份） |
| 索引 issues | 仅多 1 条 DC05 要求的 conflict 记录（result.md §7-2 已声明），无 main-only 记录 |
| 冲突实体查询（森马广州越秀区北京路店 2025-07~2026-06） | main 与候选返回**逐字一致**（确定性选 douyin；两侧画像均保留在索引） |
| 唯一可关联渠道（1OCD7S0011 → 2024-01 画像） | 逐字一致 |

结论：**无新表时候选行为与 main 逐字一致**（除已声明并记录的 1 条 issue 与 1 处有意报错类型变更），E4/E5 的「不存在时与现状一致」成立。

## 6. 发现清单

### 阻断

无。

### 应修

| # | 发现 | 位置 | 影响 |
| --- | --- | --- | --- |
| F1 | **状态词不实：DC07 整项标 PASS，但验收含「错配清单可输出渠道级销售额」，该项实际 NOT_RUN**（工具1 不在允许修改路径，已记 §6）。属「局部通过表述为整体通过」，违反工程规范 §10 状态词纪律 | `openspec/changes/p0-data-completion/result.md:36`（§2 表）与 `:144`（§6 表自相矛盾）；spec.md:61 | 交付记录夸大完成度；应改为「部分完成/后半句 NOT_RUN（另立变更）」 |
| F2 | **结果记录计数与 RED 证据覆盖不实**：①p0-invariance 标「10 个用例」实际 8（35+10+45=90 ≠「新增 88」）；②RED/GREEN core 记 41 用例，现存 43——「千分位数值按真实值解析」「数值列部分匹配抛错」2 例系 GREEN 后补、无 RED 留档（RED 日志叶子用例 41 与现存 43 名单差集恰为此 2 例）。后补测试本身有杀死力（M4），但按规范 §4.3「后补测试不能伪造历史失败」应如实标注补加 | `result.md:77`（§3 表）、`result.md:95-98`（§4 表） | 证据链可追溯性打折；应更正计数并注明 2 例为后补加固测试 |
| F3 | **业务向要数清单表述已过时且修正理由不实**：`docs/data-request.md` 第 5 行「7 类数据…尚未实现解析器，文件到位后我们还需要一轮开发才能用上」、第 64 行「当前这 7 个工具是占位实现，文件到位也不会自动可用」在本候选后不再成立（mcp-usage 已同步纠正，此文件未改）；且 result.md §7-3 称「docs/data-request.md 不在本轮允许修改路径内」与 spec §6 允许清单**不符**（清单明列 `docs/data-request.md`） | `docs/data-request.md:5`、`:64`；`result.md:166`；`spec.md:129` | 业务侧据要数清单会误判交付状态、可能延迟给数或要求重复开发；应更新表述（或明确交由后续文档修订并改注理由） |
| F4 | **DC05 口径偏差待用户确认**：spec DC05 括注「保留先到一条」与「保持现状」矛盾，实现取「两侧都保留」（复核证实与 main 真实行为逐字一致）。result.md §7-1 已如实记录并提交决定，但规格口径未闭环 | `spec.md:57`；`result.md:151-155`；`packages/core/src/index/build.ts:463-471`（无映射分支） | 不阻断代码正确性；PR 前需用户确认口径并在规格留版本说明，避免规格与实现长期背离 |

### 建议

| # | 发现 | 位置 | 影响 |
| --- | --- | --- | --- |
| S1 | `get_portrait_aggregate` 非法 level → `invalid-argument` 仅记于 result.md，mcp-usage 未明示（通用错误表不足以说明该工具行为变更）；§7-4「已记录」措辞易被误读为已进使用文档 | `docs/mcp-usage.md:56,102`；`result.md:172` | 使用方对非法入参返回类型有认知差；建议在 mcp-usage 该工具行补一句 |
| S2 | result.md §5 的「断网检查 NOT_RUN」「独立复核 NOT_RUN」可用本报告证据回填（offline-check 实跑 PASS：17 工具 9/8、0 出网、工具1 双报告 PASS；golden G1–G5 PASS） | `result.md:119-121` | 记录滞后于事实；回填后交付说明更完整 |

## 7. 未验证项

| 项 | 状态 | 说明 |
| --- | --- | --- |
| DC12–DC16（阶段二） | **NOT_RUN** | 真实业务数据未到位；本复核不评价 |
| 工具1 错配清单渠道级销售额（DC07 后半句） | **NOT_RUN** | 不在候选范围（tool1 未改）；已列 F1 状态词问题 |
| 5 条业务口径确认（spec §10） | **NOT_RUN** | 等业务侧回话；实现按「不猜口径」处理，未逐条验证语义正确性 |
| 新表的 XLSX 读取分支 | **NOT_PROVED** | 独立抽验与作者测试均以 CSV 为主；`readDataTable` 的 XLSX 分支复用既有 `readXlsxRows`，风险低但未独立实证 |
| keep-a/keep-b 显式映射在**真实数据**上的端到端效果 | **NOT_RUN** | 真实数据无映射表；由合成测试 + M6 变异覆盖 |
| CI 流水线 | **NOT_RUN** | 属交付流程另行执行项；本复核只做本地工程检查 |
| macOS/浏览器真实路径、产品验收、§5.3 专项最终检查 | **NOT_RUN** | 不属本复核范围或需用户/主 agent 另行执行 |

## 8. 结论

**建议进入 PR（附条件）**：DC01–DC06、DC08–DC11 独立验证 **PASS**，DC07 除渠道级错配排序一句（NOT_RUN，另立变更）外 PASS；真实数据下与 main 逐字一致（除 2 处已声明差异）；6 项变异全部 KILLED，测试有真实杀死力；TDD 红绿证据真实（RED 失败均为行为断言），仅 2 例后补测试需补注。硬约束（数据不出网、缺失不插补、别名/冲突不隐式合并）全部有独立验证。

**附条件**：F1–F3 应在 PR 合并前修正（状态词、计数记录、要数清单过时表述），F4 需用户确认口径后同步规格说明；S1/S2 可随 PR 顺手处理。

**声明**：本复核只覆盖 DC01–DC11 的工程验收与上述实跑检查，**不代替**阶段门禁（P0 门禁结论）、规范 §5.3 专项最终检查、CI 结果与用户产品验收；DC12–DC16 在真实数据到位前保持 NOT_RUN。本报告全部结论基于独立实跑命令与上述证据位置，未采用作者自测替代独立验证。
