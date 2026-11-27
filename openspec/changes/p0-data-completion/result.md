# P0-Data-Completion · 阶段一实施结果

> 变更：[spec.md](spec.md)（验收条目 DC01–DC11 为本轮范围；DC12–DC16 为阶段二）
> 执行：SDD·TDD 实现者 · 分支 `work/p0-data-completion`
> 基线：`main` @ `41109c8`

---

## 1. 任务清单状态（对应 spec §8）

| # | 阶段 | 任务 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| DC-1 | 清单 | 要数清单与口径问题交用户 | **完成（前置）** | `docs/data-request.md`（`41109c8` 已入库） |
| DC-2 | 实现 | 7 个解析器 + MCP 处理器 | **完成** | §3 DC01/02/03；RED→GREEN 见 §4 |
| DC-3 | 实现 | 别名目录 + 冲突映射 + README 声明 + 关联表 + 聚合表 | **完成** | §3 DC04–DC08 |
| DC-4 | 实现 | 经营指标接入 | **完成** | §3 DC09 |
| DC-5 | 口径 | 5 条口径确认回话 | **未开始（等用户／业务侧）** | 本轮不涉及代码 |
| DC-6 | 文档 | 规则文档与 MCP 说明同步 | **完成** | `docs/normalize-rules.md` §12、`docs/mcp-usage.md`、`data/README.md` |
| DC-7 | 验证 | 阶段一全量检查 | **完成** | §5 检查结果 |
| DC-8 | 复核 | 非作者独立复核 | **完成** | 报告见 [review-stage1.md](review-stage1.md)：阻断 0、应修 F1–F4、建议 S1–S2；F1–F3 与 S1–S2 已按意见修正（见 §7-5），F4 待用户确认 |
| DC-9 | 交付 | PR、CI、获授权 squash 合并 | **未开始（本轮只提交分支，不 push）** | — |
| DC-10 | 阶段二 | 真实数据接入验证 | **NOT_RUN**（数据未到位） | §6 |

---

## 2. 交付了什么

| 验收 | 交付 | 状态 |
| --- | --- | --- |
| DC01 | 7 个占位工具的真实实现（漏斗／会员特征／Cohort／Recency／流转矩阵／诊断／竞品画像） | **PASS** |
| DC02 | 每个新解析器的错误路径：空文件／只有表头／缺必要列／数值不可解析 → 抛 `NormalizationError` | **PASS** |
| DC03 | 探测表与处理器一致性守卫测试（`DATA_SOURCE_PROBES` 全覆盖） | **PASS** |
| DC04 | 实体别名目录：画像实体名先归一再关联渠道宽表；无目录时与现状逐字一致 | **PASS** |
| DC05 | 跨文件冲突显式映射：按表处置；无表时两侧全部保留并记 conflict issue | **PASS**（口径 2026-11-27 用户拍板追认，spec 已同步；见 §7-1） |
| DC06 | README 时间范围声明：填写后索引只覆盖声明范围；未填写记「未声明」 | **PASS** |
| DC07 | 商品↔渠道关联表：到位后 `list_products` 的 `channel` 过滤可用，**且错配清单可输出渠道级销售额**；未到位仍 `data-not-ready` | **NOT_PROVED**（拆项见下，整项取最弱状态） |
| DC07-a | 关联表存在时 `list_products` 的 `channel` 过滤可用（合成关联表实测：过滤生效，`channelSales` 返回逐月零售额/零售量） | **PASS** |
| DC07-b | 关联表不存在时返回 `data-not-ready`（与 main 现状逐字一致） | **PASS** |
| DC07-c | 错配清单可输出**渠道级销售额**（工具1 侧接入） | **NOT_RUN**（`packages/tool1-channel-match/**` 不在本变更允许修改路径，见 §6、§7-4） |
| DC08 | 聚合口径表：到位后 `series`／`hot`／`ip` 层级可聚合，口径沿用 §5.6 | **PASS** |
| DC09 | 经营指标接入：`ProductDossier.performance` 与渠道经营字段；缺失不插补；成交单价可推出 | **PASS** |
| DC10 | 不新增第三方依赖（CSV 走既有解析器、XLSX 走 exceljs）；新代码零出网 | **PASS** |
| DC11 | 未登记的新标签／新维度不参与投影（沿用 registry 行为，补了测试） | **PASS** |
| — | 现状不变性：无新表时索引关键字段与其余 10 个工具的返回与 main 基线一致 | **PASS**（差异见 §7-2） |

> **DC07 整项状态说明（按独立复核 F1 修正）**：DC07 的验收原文含两半——「`list_products` 的 `channel` 过滤可用」与「错配清单可输出渠道级销售额」。前半（DC07-a、DC07-b）已 **PASS**；后半（DC07-c）属工具1 侧，**本变更未改该包**，实际 **NOT_RUN**。整项取最弱状态 → **NOT_PROVED**，不得表述为整体通过。工具1 侧接入需另立变更（见 §7-4）。

---

## 3. 新增／修改文件清单

### 新增（源码）

| 文件 | 作用 |
| --- | --- |
| `packages/core/src/normalize/table.ts` | 新增表的统一读取（CSV/XLSX）、列解析、单元格取值、指标缺失标记 |
| `packages/core/src/normalize/catalog/tables.ts` | **列契约唯一来源**：12 张新表的必需／可选列、指标键、阶段与诊断类型别名、平台别名 |
| `packages/core/src/normalize/funnel.ts` | 漏斗表解析 |
| `packages/core/src/normalize/member-features.ts` | 会员特征字典解析 |
| `packages/core/src/normalize/retention.ts` | Cohort／Recency／流转矩阵／诊断四表解析 |
| `packages/core/src/normalize/relations.ts` | 商品↔渠道、聚合口径、实体别名、冲突映射四表解析 |
| `packages/core/src/normalize/performance.ts` | 商品／渠道经营指标解析 + 成交单价推算 |
| `packages/core/src/normalize/declaration.ts` | README 时间范围声明解析（容忍 HTML 注释占位符） |
| `packages/core/src/normalize/competitor.ts` | 竞品画像解析（competitor 实体类型） |
| `packages/core/src/normalize/platform.ts` | 平台／实体类型识别（从 `index/build.ts` 迁出，供两处共用） |

### 修改（源码）

| 文件 | 改动 |
| --- | --- |
| `packages/core/src/normalize/types.ts` | 新增 12 类表条目类型；`NormalizationIssue` 增加 `entity-alias`／`scope-excluded`；`ChannelRecord` 增加 `performance`；`NormalizeOptions.entityType` 放宽为开放字符串 |
| `packages/core/src/normalize/index.ts` | 导出新增解析器与列契约 |
| `packages/core/src/index/types.ts` | `DataIndex` 增加 13 个可选的新表字段 + `declaration` |
| `packages/core/src/index/build.ts` | 载入新表；别名归一；冲突处置；声明裁剪；经营指标与关联表接入；`TABLE_SOURCES` 探测与加载共用一份候选路径 |
| `packages/core/src/index/query.ts` | `listProducts` 支持 `channel` 过滤；`aggregatePortrait` 支持 series／hot／ip；`channelEntityIds` 纳入别名目录 |
| `packages/data-mcp/src/server.ts` | 7 个桩处理器替换为真实实现；`list_products` 渠道过滤与渠道级成交；`get_portrait_aggregate` 层级扩展 |

### 新增（测试）

| 文件 | 覆盖 |
| --- | --- |
| `packages/core/test/p0-tables.test.ts` | DC01/02/04–DC09（35 个用例） |
| `packages/core/test/p0-invariance.test.ts` | 现状不变性、DC10、DC11（8 个用例） |
| `packages/data-mcp/test/p0-completion.test.ts` | DC01/03/07/08 + MCP 层现状不变性（45 个用例） |

测试夹具全部合成（`packages/core/test/helpers/fixtures.ts`、`packages/data-mcp/test/helpers/fixtures.ts`），无任何真实业务数据。

### 修改（文档）

`docs/normalize-rules.md`（新增 §12 与若干既有条目更新）、`docs/mcp-usage.md`、`data/README.md`（声明表写法 + 新增表清单）、`docs/data-request.md`（`125ae8f` 补留存四表的 `月份` 列；复核修正单再改过时表述，见 §7-5）。

---

## 4. RED → GREEN 证据

真 RED 先行：先写测试并运行，保留失败输出，再写最小实现。

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED（core） | `node --test packages/core/dist/test/p0-{tables,invariance}.test.js` | **41 用例：14 通过 / 27 失败**（失败均为行为断言，非导入或定位错误） |
| RED（mcp） | `node --test packages/data-mcp/dist/test/p0-completion.test.js` | **45 用例：25 通过 / 20 失败** |
| GREEN（core） | 同 RED 命令 | **43 / 43 通过**（现存 43 例 = RED 时的 41 例 + 2 例 GREEN 后补，见下方披露） |
| GREEN（mcp） | 同 RED 命令 | 45 / 45 通过 |
| GREEN（全量） | `npm test` | **292 / 292 通过**（基线 204 + 新增 88 = p0-tables 35 + p0-invariance 8 + p0-completion 45） |

失败输出留档：`.local/p0/red-core.txt`、`.local/p0/red-mcp.txt`（`.local/` 已被 `.gitignore` 排除，不入库）。

> **后补测试披露（按独立复核 F2 修正）**：core 的 `千分位数值按真实值解析，不被静默截断` 与 `数值列部分匹配（如 1000元）抛错，不静默接受` 这 2 例是 **RED 之后补写**的——`.local/p0/red-core.txt` 的 41 条叶子用例名单中**不存在**它们，**没有各自的 RED 失败留档**（核对方式：按用例名取差集，现存 43 例与 RED 的 41 例差集恰为此 2 条）。补写目的是加固数值解析严格性；这 2 例有真实杀死力（复核变异 M4 使其失败），但按工程规范 §4.3「后补测试不能伪造历史失败」，此处如实标注为后补，不补造 RED 记录。RED 日志中的 41 例失败**全部**是行为断言。

RED 阶段的失败项举例（core）：`漏斗表应被接入索引`（`index.funnel` 为 undefined）、`空文件抛 NormalizationError`（索引构建未抛错）、`别名目录存在时画像实体名先归一`（entityId 未归一）、`口径表存在时支持 series／hot／ip 层级`（返回 undefined）、`零售额与零售量齐全时推出真实成交单价`（`actualUnitPrice` 为 undefined）。

> RED 之前先补了**类型声明**（`DataIndex` 的可选字段、各表条目类型、`ProductFilter.channel`），否则测试无法编译——类型声明不含行为，RED 全部落在断言上。

---

## 5. 检查结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查与构建 | `npm run build` | **PASS** |
| 全量单测 | `npm test` | **PASS**（292/292） |
| 匹配内核黄金回归 | `UOM_REFERENCE_ROOT=... npm run test:golden` | **PASS**（G1–G5 全通过，锚点评级不变） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（见 §5-1） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（见 §5-1） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（0 漏洞） |
| 断网检查 | `npm run offline-check` | **PASS**（守卫自检 13 个出网入口全部被拦截并归因；17 工具 9 就绪 / 8 data-not-ready / 0 意外、**出网尝试 0**；工具1 演示报告 PASS。参考数据报告未跑——未设 `UOM_REFERENCE_ROOT`，见 §5-1） |
| 阶段二验收 DC12–DC16 | — | **NOT_RUN**（真实数据未到位） |
| 独立复核 | [review-stage1.md](review-stage1.md) | **完成**（SDD·TDD 独立复核者，未参与本候选）：阻断 0、应修 F1–F4、建议 S1–S2；变异 6/6 KILLED；真实数据下与 main 逐字一致。F1–F4 与 S1–S2 均已处置（F4 由用户 2026-11-27 拍板追认现状并同步规格措辞，见 §7-1、§7-5） |

### 5-1 检查输出摘要

```
check-docs-links.py: 检查相对链接 107 条，错误 0，告警 0
check-data-guard.py: 数据守卫通过：索引中无业务数据目录、数据文件或超大文件
npm audit --audit-level=high: found 0 vulnerabilities

# npm run offline-check
守卫自检通过：13 个出网入口全部被正确拦截并归因
工具 17 | 数据就绪 9 | data-not-ready 8 | 意外 0 | 出网尝试 0
断网端到端验证通过：17 个工具在无网络条件下全部可调用，无任何出网尝试。
工具1 断网验证：演示报告 PASS（出网尝试 0 次）｜参考数据报告 未运行（未提供 UOM_REFERENCE_ROOT）

# UOM_REFERENCE_ROOT=<抖音参考数据目录> npm run test:golden
G1（锚点） 91.9 A → 95.4 A PASS｜G2 91.2 A → 95.3 A PASS｜G3 78.2 B → 87.7 A PASS
G4 59.2 C → 68.9 B PASS｜G5（锚点）40.9 C → 42 C PASS｜黄金回归通过
```

### 5-2 真实数据路径自检（非 CI，仅本机）

用仓库 `data/` 目录构建索引：商品 334、渠道 200、画像 7、月份 `['2024-01','2024-07~2025-06','2025-07~2026-06']`——与 P0 基线一致；`declaration.declared = false`（未声明），并记录「未声明」。真实数据中检出 1 处跨平台画像冲突（`森马广州越秀区北京路店 2025-07~2026-06`：jd + douyin），已按 DC05 记 conflict issue、两侧保留。

---

## 6. 未做项与未验证项

| 项 | 状态 | 原因 |
| --- | --- | --- |
| DC12–DC16（阶段二：真实数据验收、MCP 就绪数提升、跨渠道对比、别名目录真实效果、留存五表抽样核对） | **NOT_RUN** | 真实业务数据未到位；不写成通过 |
| 工具1 错配清单的**渠道级销售额**（DC07-c，后半句） | **NOT_RUN** | `packages/tool1-channel-match/**` 不在本变更允许修改路径内；本轮已把渠道级成交暴露到 MCP（`list_products` 的 `channelSales`），工具1 侧接入需另立变更。DC07 整项因此记 **NOT_PROVED**（见 §2） |
| 5 条业务口径确认（spec §10 未决问题） | **NOT_RUN** | 等用户／业务侧回话；本轮按「不猜口径、按列名直读并标口径待确认」实现 |

> 原记 **NOT_RUN** 的两项已在本单补齐并回填：`npm run offline-check` → **PASS**（见 §5）、独立复核 → **完成**（见 §5 与 [review-stage1.md](review-stage1.md)）。两项均未在此表中保留，避免记录滞后于事实。

---

## 7. 与规格的偏差与需要主 agent／用户决定的事项

### 7-1 DC05 冲突口径（复核 F4，2026-11-27 用户拍板已结案）

实现为：**无冲突映射表时，两侧画像都保留**，并记 `conflict` issue（写明冲突的平台对与「未登记显式映射，未做隐式合并」）。只有登记了映射表（`keep-a`／`keep-b`）才真正移除一侧；`manual` 两侧都留并提示人工处理。

理由：无表就丢弃一侧会改变既有查询行为（同月多平台画像按平台名确定性选择），与本轮「现状不变性」的要求冲突，也会让「探测说就绪但结果变了」这类差异静默发生。要真正移除一侧，必须有显式映射表——这正是 DC05 的本意。**用户裁定（2026-11-27）**：**追认现状**——无映射表时两侧画像全部保留 + 记 `conflict` issue，不按「先到一条」丢弃；实现与测试**不变**。据此已同步 `spec.md`：状态行加修订记录、§3 DC05 验收条目改写、§7 边界表「别名不隐式合并」一行改写。商品表内部重复行的「保留先到一条」是既有索引行为，与本条无关，未改动。

### 7-2 无新表时索引与 main 的唯一差异

`index.issues` 会多出跨平台画像冲突记录（DC05 要求记录冲突）；其余关键字段（月份、商品、渠道、画像、探测说明）与 main 逐字一致，由 `packages/core/test/p0-invariance.test.ts` 锁定。真实 `data/` 下多出 1 条 issue（见 §5-2）。

### 7-3 `docs/data-request.md` 与实现的列契约差异（已同步）

1. **留存三表（Recency／流转矩阵／诊断）需要 `月份` 列**：三个 MCP 工具都按月检索，`月份` 是必需列。原要数清单第 6–8 项未列该列 → **已在 `125ae8f` 补齐**（第 6–9 项均标注「必带 `月份` 列」）。
2. **渠道／商品范围的声明写法**：实现要求用标识清单（`D00001 演示账号1`），散文式描述（"抖音直播 4 个账号"）无法解析成标识，遇到时会**不裁剪并记说明**（不猜）。`data/README.md` 已给出写法示例。

**更正（前一句与 spec §6 不符）**：`docs/data-request.md` **在**本变更的允许修改路径内（spec §6 明列）。该文中「7 类数据尚未实现解析器、文件到位也不会自动可用」的过时表述已在**本单**按实现现状改写（复核 F3），见 §7-5。

### 7-4 其它记录在案、未在本轮修的问题

| 问题 | 影响 | 处置 |
| --- | --- | --- |
| `get_portrait_aggregate` 对**非法 level**（如 `foo`）的返回从 `data-not-ready` 改为 `invalid-argument` | 非法入参的报错更准确；合法层级（category／series／hot／ip）的返回与 main 一致 | 有意变更，已记录；本单已把该行为补进 `docs/mcp-usage.md` 的工具行（复核 S1），实测返回 `invalid-argument`／`level 必须是 category／series／hot／ip，收到 …`；如需严格逐字一致可回退 |
| 竞品画像目录若存在文件，实体类型由「channel/brand」变为「competitor」 | 真实 `data/` 无该目录，当前无影响 | 有意为之（竞品不应混进渠道画像），已在本文件与归一化规则 §12.10 记录 |
| 竞品画像按实体名匹配用了「相等或互相包含」 | 同名不同实体的竞品可能误匹配 | 保守做法，等业务侧给出稳定的竞品标识后再收紧 |
| 商品／渠道经营指标多月份时档案只取最新月份 | 跨月对比需另行查询 | 已在 issue 中记录被跳过的月份数，规则已写入归一化规则 §12.9 |
| `data/README.md` 的声明解析只认 Markdown 表格 | 非表格写法会被忽略 | 按既有模板实现，未扩大解析面 |

### 7-5 独立复核应修项修正记录（复核 F1–F3、S1–S2）

复核报告：[review-stage1.md](review-stage1.md)（SDD·TDD 独立复核者，未参与本候选任何部分）。

| 发现 | 状态 | 修正位置 | 要点 |
| --- | --- | --- | --- |
| **F1** DC07「半句 NOT_RUN 却整项 PASS」 | **已修正** | 本文件 §2（DC07 拆为 DC07-a/b/c）、§2 表下说明、§6 | 三个子断言各自记真实状态；整项取最弱 → **NOT_PROVED**，并写明已验证部分与未运行原因 |
| **F2** 用例计数与 RED 覆盖不实 | **已修正** | 本文件 §3（p0-invariance 10 → **8**）、§4（GREEN core 41/41 → **43/43**）及新增披露段 | 计数按实际重数（35 + 8 + 45 = 88；RED 叶子 41 = 14 通过 / 27 失败）；如实披露 2 例为 RED 后补、无各自 RED 留档，不补造 RED 记录 |
| **F3** `docs/data-request.md` 表述过时 + 「不在允许路径」与 spec §6 不符 | **已修正** | `docs/data-request.md` 第 5 行与「我们这边收到数据后做的事」整节；本文件 §7-3 | 按实现现状改写：已实现的写「已实现」并指向代码位置；确实未做的（第 9、10 项归 P3 报表阶段、工具1 渠道级错配排序）写明归属 |
| **S1** `mcp-usage.md` 未说明非法 level 行为 | **已修正** | `docs/mcp-usage.md` 的 `get_portrait_aggregate` 行 | 按实测写：非法 level → `invalid-argument`；合法非 category 层级但无口径表 → `data-not-ready` + hint |
| **S2** 断网检查与独立复核状态滞后 | **已修正** | 本文件 §5、§5-1、§6 表下说明 | 断网检查 **PASS**（13 入口全拦截归因；17 工具 9/8/0；出网尝试 0）；独立复核**已完成**，报告见 `review-stage1.md`；F4 待用户确认 |
| **F4** DC05 冲突口径（spec 括注「保留先到一条」与「保持现状」并列） | **已结案（用户拍板）** | 本文件 §7-1；`spec.md` 状态行修订记录、§3 DC05、§7 边界表 | 用户 2026-11-27 裁定**追认现状**（无映射表 → 两侧全留 + 记 conflict issue），实现与测试不变；原括注「保留先到一条」作废，spec 措辞已同步 |

本单修正的文件：`openspec/changes/p0-data-completion/result.md`、`openspec/changes/p0-data-completion/review-stage1.md`（复核报告入库）、`docs/data-request.md`、`docs/mcp-usage.md`。**未改任何解析器／索引／MCP 代码行为**。

---

## 8. 范围核对

本轮改动仅落在 spec §6 允许路径内：`packages/core/src/normalize/**`、`packages/core/src/index/**`、`packages/data-mcp/src/server.ts`、两包 `test/**`、`docs/normalize-rules.md`、`docs/mcp-usage.md`、`docs/data-request.md`、`data/README.md`、`openspec/changes/p0-data-completion/**`。

未改：`packages/core/src/match/**`、`packages/tool1-channel-match/**`、`site/web/**`、`packages/core/src/product/types.ts`（商品档案类型未改，`performance`／`funnel`／`channelPerformance` 字段本就存在）。

复核应修项修正单（本单）只动了记录与文档：`openspec/changes/p0-data-completion/result.md`、`openspec/changes/p0-data-completion/review-stage1.md`、`docs/data-request.md`、`docs/mcp-usage.md`；**解析器／索引／MCP 代码零改动**（`npm test` 292/292 不变）。

`data/` 下未新增任何文件；业务数据不入库（`check-data-guard.py` 通过）。
