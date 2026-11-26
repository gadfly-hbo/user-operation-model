# P0-5 独立复核记录

> 复核对象：P0-5「数据 MCP server」候选 · 复核人：独立复核 Agent（未参与候选任何部分）
> 相关：[spec.md](spec.md) · [result.md](result.md) · [工程规范 §5](../../../../docs/engineering-workflow.md)

---

## 候选身份

| 项 | 值 |
| --- | --- |
| 候选提交 | `21315bb` feat: P0-5 数据 MCP server（17 个工具） |
| 基线 | `d126ca2`（P0-3/P0-4 已合并） |
| 隔离验证根 | `/tmp/uom-review-p0-5`（detached HEAD 检出 `21315bb`） |
| 真实样本 | `data/domains/`（12 业务域、29 文件，只读软链，未写入） |
| 变更范围 | `packages/core/src/index/**`（4 文件）、`packages/data-mcp/**`（3 源 + 3 测试）、`docs/mcp-usage.md`、`README.md`、`openspec/changes/data-mcp-core/{spec,result}.md`、`package-lock.json`、`tsconfig.json` |
| 复核者动作 | 只读检查 + 在 `.local/`（gitignore）内做驱动脚本与变异；源文件改动仅用于变异，且以**文件备份**还原 |

**复核范围**：spec §3（DM01–DM16）、§6.1 P0-5 专项、§7 关键边界；工程规范 §4.3／§4.4／§4.6／§5.1／§5.3／§6／§7／§9.1／§9.2。
**不在本轮范围**：P0-2／P0-3／P0-4 已交付内容的重新复核（沿用其既往结论，仅在与 P0-5 接缝处抽查）。

---

## 实跑基线

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 依赖安装 | `npm ci --ignore-scripts` | PASS（213 包，0 vulnerabilities） |
| 类型检查 + 构建 + 单测 | `npm run check` | **PASS**（131 例全过，0 失败 0 跳过；core 101 + data-mcp 30） |
| 依赖审计 | `npm audit --audit-level=high` | PASS（0 vulnerabilities） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | PASS（**52 条**相对链接 0 错误） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | PASS |
| 真实 stdio 端到端 | `node packages/data-mcp/dist/src/bin.js` + MCP 客户端 | PASS（17 工具可列可调） |
| **断网实跑** | `sandbox-exec -p '(version 1)(allow default)(deny network*)'` 启动 server + 17 工具全调 | **PASS**（见 §D） |
| **出网 API 拦截** | `--import` 预加载拦截 `net/http/https/dns/tls` | **PASS**（`attempts=0`） |
| 独立复核 | 本文件 | 见 §结论 |

补充实测（非候选自述，均由复核者独立执行）：

- **DM08 抽样核对（真实文件 → 索引 → MCP 返回）**：对样本中一个平台画像文件逐条比对 **2985 个标签**的占比与 TGI，**不一致 0 条**。该项在候选的 `result.md` 中为 NOT_RUN。
- **索引规模复算**：商品记录 344 条（唯一款号 334）、渠道 200、画像 7、月份 3 个区间 —— 与 `result.md` 自述一致。
- **`packages/core/src/index/**` 单元测试覆盖**：**0 条直接测试**（`grep buildIndex|jensenShannon|cosineSimilarity|topOverlap|aggregatePortrait|searchByTag|similarProducts|diffPortraits|attributeJaccard` 在 `packages/core/test/` 无命中），覆盖全部来自 `packages/data-mcp/test/` 的间接集成测试。

---

## A. 按 spec §6.1 逐项核对

### A1 工具清单与参数契约 —— PASS

17 个工具名与讨论稿 §3.3 **逐字一致**：无多、无少、无改名。分类归属与 §6.1 表格一致。

| 讨论稿 §3.3 签名 | 实现 | 结论 |
| --- | --- | --- |
| `list_channels({month,type})` | 同 | 一致 |
| `get_channel_portrait({channelId,month})` | 同 | 一致 |
| `get_brand_portrait({scope,month})` | 同（`month` 接收但未生效） | 参数一致，语义见 A2 |
| `get_competitor_portrait({brand,month})` | 同 | 一致 |
| `list_products({category,season,channel,minPrice,maxPrice,keyword})` | 同（6 项全在） | 一致 |
| `get_product_dossier({spu})` | 同 | 一致 |
| `get_product_portrait({spu,dimensions})` | 同 + 可选 `month` | 一致（向后兼容扩展） |
| `get_portrait_aggregate({level,key})` | 同 | 一致 |
| `get_funnel({spu,phase})` | 同 | 一致 |
| `compare_product_channel({spu,channelId})` | 同 + 可选 `month` | 一致（向后兼容扩展） |
| `search_by_tag({dimension,label,scope,topN})` | 同（4 项全在） | 一致 |
| `search_similar_products({spu,topN})` | 同 | 一致 |
| `list_member_features({level,segment})` | 同 | 一致 |
| `get_retention_cohort({cohortMonth,metric})` | 同 | 一致 |
| `get_recency_distribution({month})` | 同 | 一致 |
| `get_channel_flow_matrix({month})` | 同 | 一致 |
| `get_diagnosis({month,type})` | 同 | 一致 |

生成给客户端的 JSON Schema 已核对：`required` 正确（如 `channelId`、`dimension+label`），类型正确（`topN` 为 integer）。参数类型非法由 SDK 层直接报错（`isError=true`，"Invalid arguments for tool ..."），不进入业务逻辑，**无静默兜底**。

> 注：spec 自身不一致——§1／§5／§8 与 DM07 写「16 个工具」，§6.1 写「17 个（讨论稿 §3.3 全量）」。讨论稿实为 17 个，实现取 17 是对的，但 DM07 字面（16 个）不成立。见 §发现 #20。

### A2 双层状态（接口就绪／数据就绪）—— FAIL

复核者逐个调用 17 个工具（真实样本 + 合成 fixture 两轮），**不采信自述**：

| 工具 | 接口层 | 数据层（实测） | 判定 |
| --- | --- | --- | --- |
| `list_channels` | 就绪 | 返回 200 个渠道 + 月份 | 可用 |
| `get_channel_portrait` | 就绪 | 可用（仅 1 个渠道能关联上画像，见 B8） | 可用 |
| **`get_brand_portrait`** | 就绪 | **`ok:true` + `portraits: []`（空结果，非 `data-not-ready`）** | **FAIL** |
| `get_competitor_portrait` | 就绪 | `data-not-ready` + 说明 | 未就位 |
| `list_products` | 就绪 | 可用（`channel` 过滤单独报 `data-not-ready`） | 可用 |
| `get_product_dossier` | 就绪 | 可用（`funnel`／`performance` 因源数据缺失为空） | 可用（数据缺口已披露） |
| `get_product_portrait` | 就绪 | 可用 | 可用 |
| `get_portrait_aggregate` | 就绪 | 品类层级可用（**TGI 聚合值错误，见 B9**） | 可用但有缺陷 |
| `get_funnel` | 就绪 | `data-not-ready` | 未就位 |
| `compare_product_channel` | 就绪 | 可用（**须命中能关联的渠道**） | 可用 |
| `search_by_tag` | 就绪 | 可用 | 可用 |
| `search_similar_products` | 就绪 | 可用（**画像分恒 0，见 B12**） | 可用但有偏差 |
| `list_member_features` | 就绪 | `data-not-ready` | 未就位 |
| `get_retention_cohort` | 就绪 | `data-not-ready` | 未就位 |
| `get_recency_distribution` | 就绪 | `data-not-ready` | 未就位 |
| `get_channel_flow_matrix` | 就绪 | `data-not-ready` | 未就位 |
| `get_diagnosis` | 就绪 | `data-not-ready` | 未就位 |

**实测结论：9 个工具返回真实数据，1 个（`get_brand_portrait`）返回空结果，7 个返回明确错误。**
候选自述「10 个全部返回真实数据 / 7 个未就位」**不成立**：第 10 个（品牌画像）返回的是空数组，被计入了「可用」。

### A3 数据未就位的工具是否返回 `data-not-ready` 而非空结果 —— PARTIAL

7 个已登记工具**全部**返回 `data-not-ready`，message 指明缺哪个文件、hint 指明缺什么数据 —— **PASS**。
但 `get_brand_portrait` 走的是另一条路径（`index.unavailable` 中没有它的键，条件恒真），返回 `ok:true` + 空数组 —— **FAIL**（详见 §发现 #1）。
另：数据根目录不存在或为空时，`list_channels` 返回 `ok:true` + `total:0`（既非 `data-not-ready` 也非错误）—— 见 §发现 #9。

### A4 `compare_product_channel` 是否含匹配分与评级 —— PASS

- 代码路径只产出差异：`dimensions[] / onlyInProduct / onlyInChannel / comparedDimensions`，无 `totalScore`、`grade`、`dimensionScores`。
- 真实数据实跑：序列化输出中 `score|grade|match|rating|总分|匹配分` 匹配结果为 `null`；顶层键仅 6 个。
- 变异 M4（强行塞入 `totalScore` + `grade`）被测试 **KILLED**（1 例失败）。
- 与讨论稿 §7.3 的 `DimensionDiff` 字段逐项对齐（`dimension/productTop3/channelTop3/distance/overlapTop3/jsSimilarity/cosine`）；`MatchResult`（含分与评级）正确地留给 P1。
- **边界守住**：无第二份评分口径、无权重、无阈值进入 MCP。

补充（不构成违规）：DM12 提到的「偏离度」在讨论稿 §7.3 中即 `DimensionDiff.distance`（该节标题为「画像差异与偏离度」），逐维返回已满足；无跨维聚合偏离度，与 §7.3 一致。

### A5 「已知的数据未就位项」表与实际行为是否一致 —— FAIL

spec §6.1 的表列出 7 项，与实测的 7 个 `data-not-ready` 工具**一一对应**。
但**作者漏列了 1 个实际不可用的工具**：`get_brand_portrait`（品牌人群画像未接入，实测返回空结果）。
且表内 2 项与实际行为有偏差：

| spec §6.1 表中表述 | 实测 | 判定 |
| --- | --- | --- |
| `get_portrait_aggregate` 的系列／爆款／IP 层级缺聚合口径表 | 确实返回 `data-not-ready`（含级别名） | 一致 |
| `list_products` 的 `channel` 过滤缺关联关系 | 确实返回 `data-not-ready` | 一致 |

漏列项：`get_brand_portrait`（品牌画像）、`get_channel_portrait` 的**样本量／画像覆盖率**（DM09 要求，见 B14）、`get_product_portrait` 的**月份**（源文件名无月份，返回空串，见 B13）。

---

## B. 实现正确性

### B6 相似度算法（`packages/core/src/index/similarity.ts`）—— PASS（含 1 条建议）

复核者手算 + 实测边界：

| 场景 | 实测 | 判定 |
| --- | --- | --- |
| 两边全空 | JS 散度 0、距离 0、余弦 0 | 无 NaN/除零 |
| 完全相同 | 散度 0、距离 0、余弦 1（浮点 0.9999999999999998） | 正确 |
| 完全不重叠 | 散度 1、距离 1、余弦 0 | 正确（log2 基准下散度上界 1 → 距离 ∈ [0,1]） |
| 单侧空分布 | 散度 0.5、距离 0.707、余弦 0 | 无 NaN；余弦对空侧返回 0（合理） |
| 占比全为 0 / 负值 | `toDistribution` 返回 `{}` | 无 NaN |
| `toDistribution` 输入含 NaN | 产出 NaN | **未防护**（源数据不会产生，属上游责任） |

JS 散度/距离/余弦/Top3 重合公式本身正确，`topOverlap` 用 `hits/max(len)` 的重叠系数，与讨论稿口径兼容。**未发现除零、NaN、越界**。

**建议**：`diffPortraits` 对「双方该维度都无标签」的情况给出 `distance=0 / jsSimilarity=1 / cosine=0` —— 同一维度上 JS 说「完全一致」而余弦说「完全不相关」。P1 的单维度分是 `0.60×JS + 0.25×余弦 + 0.15×Top3`，空维度会拿到 0.60 分。建议在共享内核里把「双方皆空」的维度排除出比较集（与「单侧独有维度」同样处理）。本轮不影响 MCP 返回值正确性。

### B7 索引构建扫描规则（`packages/core/src/index/build.ts`）—— PARTIAL

- **不误识别**（实测通过）：`08_指标体系/指标字典*.xlsx`、`10_商圈信息/*.xlsx`、`01_品牌信息/品牌清单*.xlsx`、`05/06/11/12` 目录的 xlsx 均未被当作画像；索引内画像恰好 7 份，与目录中的平台画像文件数一致。✓
- **不漏当前样本**：`04_商品信息/商品宽表.xlsx` 与 `商品-附加字段_modelevol建模用的商品信息表.xlsx` 都被识别为商品表；`02_渠道信息/渠道店铺宽表.xlsx` 被识别为渠道表。✓
- **扫描规则本身脆弱且未文档化**：平台识别同时依赖「路径含英文平台名」与「文件名以平台后缀结尾」两个条件。实测：中文平台目录 + 文件名**无**平台后缀的画像 CSV **被静默跳过**（`issues=0`，索引里查无此文件，无任何提示）。这正是 spec §10 Q1-2 约定的 `source/<渠道类型>/<实体>/<YYYY-MM>/` 布局可能踩到的形态。
- **一个坏文件会拖垮整个 server**：索引构建遇到不可解析文件直接抛 `NormalizationError`，`bin.ts` 捕获后退出（exitCode=1）→ 17 个工具全部不可用，而不是「跳过该文件 + 记一条 error 级 issue」。
- **无「未识别文件」的审计输出**：`buildIndex` 不产出任何「我看到但没认领」的清单。

### B8 实体关联（`channelEntityIds` / `findPortraitByEntityIds`）—— 结论核实

作者结论「7 份画像只有 1 份能关联到渠道宽表」—— **复核者独立核实，成立**，且**是数据缺口，不是实现缺陷**：

- 画像侧实体名是「品牌 + 门店名」全称；渠道宽表主键是店铺编码，`店铺` 列是简称/变体名。
- 4 个画像实体名中，只有 1 个在宽表的 `店铺` 列**精确命中**；另外 3 个都能在宽表里找到**同一家门店的变体名**（含后缀差异、区/大厦/MALL 等写法差异），并**不是**「不在 200 个渠道内」。
- 作者在 `result.md` §7 与 `docs/mcp-usage.md` 里写的「部分门店不在 200 个渠道内」**不准确** —— 真实缺口是**实体别名目录缺失**（规则文档 §2.3／§10 已如实登记「别名目录尚未建立」，这一点是对的）。
- 结论对实现的含义：M2 变异（去掉渠道实体关联）被 KILLED，说明「用店铺编码对外 + 内部按 `店铺` 名关联」的实现路径有测试保护；实现方式本身正确。

**遗留缺陷**：同月多平台画像被**按数组顺序静默取一份**。同一实体在同一个月同时有京东侧与抖音侧画像时，`findPortraitByEntityIds` 用 `matches.find(...)` 返回先到的那份（实测返回京东侧），且 `availableMonths` 会把该月**列两次**，调用方无法从返回值判断取到的是哪个平台。

### B9 聚合画像（`aggregatePortrait`）—— FAIL

**TGI 聚合公式错误，静默产出错值。** 代码把「加权平均」的结果又乘了一个 `weight = value.share`，且分母用的是**已经累加过当前值**的 `existing.share`：

- 实测（构造 2 份成员画像，share 分别 0.45／0.55，TGI 分别 95／110）：聚合结果 TGI = **55.18**，正确的 share 加权平均 ≈ **103.25**。差异极大且与输入不成单调关系。
- 真实样本未暴露该问题（仅 1 个商品有画像，且天猫侧无 TGI），所以**作者的自测与端到端验证都测不到**；变异 M5（改成简单平均）**SURVIVED**，佐证零覆盖。
- 占比（share）聚合口径本身合理：按「有该维度的成员数」平均，标签在部分成员缺失时按 0 计入，分布和为 1 —— 符合「缺失不插补」。但**该口径未写入规则文档**（DM05 要求「聚合口径写入规则文档」，`docs/normalize-rules.md` 全文无「聚合」章节）。

### B10 查询原语（`search_by_tag` / `search_similar_products` / `get_portrait_aggregate`）—— PARTIAL

- **`search_by_tag` 打分与聚合**：命中逻辑正确（按维度 → 标签精确匹配，取 share，降序，截 topN）；实测 `scope` 过滤、`topN` 截断均正确（`scope=product/channel` 分别只返回对应类型）。**但命中项不带平台标识**：实测同一次查询中，同一实体 + 同一月份出现**两条**命中（来自两个不同平台的画像，占比与 TGI 不同），调用方无法分辨哪条来自哪个平台 → 违反 DM15「可回溯到源平台」的精神。
- **`similarProducts` 的 Jaccard**：实现为「按属性键计数的平均 Jaccard」，键取 6 个客观属性（品类三级／版型／面料／IP），两侧都空的键不计入分母 —— 语义合理、无偏差式错误。但：
  1. **画像分缺失时按 0 计入**：无画像商品的总分上限被压到 0.5（属性 0.5 + 画像 0.5），有画像商品可到 1.0 → 无画像商品在 TopN 中被系统性压低。讨论稿 §4.1 对匹配内核的口径是「缺维度时对有效维度重归一化」，此处未照此处理。实测真实样本：5 个命中的 `portraitScore` 全为 0，`sharedDimensions` 全为 0。
  2. 权重 0.5／0.5 硬编码在代码里，不在配置中（与 §9.1「评分参数单一来源」的精神有张力；因不是匹配分，暂不判违规）。

### B11 缺月不回退的一致性 —— PARTIAL

- `findPortrait` 未指定月份且实体有多份画像时返回 `undefined`，由调用方报「必须指定 month」—— **PASS**。
- 一致性抽查（`get_channel_portrait` / `get_product_portrait` / `compare_product_channel` / `search_similar_products` / `get_product_dossier` / `get_portrait_aggregate`）：**没有任何工具偷偷回退到相邻月份**。`get_portrait_aggregate` 内部对成员画像用 `findPortrait`（无月），成员有多份画像时该成员被跳过（不取最近月）—— 行为是「不回退」而非「回退」，符合规则。
- 但**错误语义有两处不准**：
  1. `get_channel_portrait` 对「该渠道**没有任何画像**」返回 `kind='ambiguous'`、message「有多份画像，必须指定 month」—— 与事实相反（是 0 份），且此时无可用月份提示。实测可复现。
  2. `compare_product_channel` 传 `month` 时返回 `kind='not-found'`，而同类场景在 `get_channel_portrait` / `get_product_portrait` 是 `kind='month-mismatch'` —— 错误 kind 不统一；且产品侧画像月份为空串（源文件名无月份），导致**带 month 调用必然失败**，错误消息也未点明这一点。

### B12 错误路径与静默空结果 —— PARTIAL

| 场景 | 实测 kind / 行为 | 判定 |
| --- | --- | --- |
| 实体不存在（商品／渠道） | `not-found` + 提示用哪个工具查 | PASS |
| 月份不匹配 | `month-mismatch`（`get_channel_portrait`／`get_product_portrait`）／`not-found`（`compare_product_channel`） | kind 不统一 |
| 参数非法（scope） | `invalid-argument` | PASS |
| 参数类型非法 | SDK 层拦截，`isError=true` | PASS |
| 数据未接入 | `data-not-ready` + 缺哪个文件 | PASS（`get_brand_portrait` 除外） |
| 聚合层级未接入 | `data-not-ready` | PASS |
| 标签反查无命中 | `not-found`（非空数组） | PASS |
| **数据根缺失／为空** | `ok:true` + `total:0` | **FAIL（静默空结果）** |
| **品牌画像未接入** | `ok:true` + `portraits:[]` | **FAIL（静默空结果）** |
| **实体无画像**（`get_channel_portrait`） | `ambiguous` + 「有多份画像」 | **FAIL（消息与事实相反）** |

---

## C. 变异测试复验

方法：改源码 → `npm run build` → `npm test` → **用文件备份还原**（`.local/backup/`，不经 `git checkout --`）。还原后 `git status` 干净、md5 一致、131/131 复跑通过。

### C1 复现作者自述的 4 条

| 变异 | 做法 | 结果 | 与自述 |
| --- | --- | --- | --- |
| **M1** `findPortrait` 缺月回退到最近月 | 指定月无命中时回退到末份 | **KILLED**（1 例失败） | 一致 |
| **M2** 去掉渠道实体关联 | `channelEntityIds` 只返回店铺编码 | **KILLED**（3 例失败） | 一致 |
| **M3** 数据未就位改为返回空结果 | `notReady()` 返回 `ok({total:0})` | **KILLED**（8 例失败） | 一致 |
| **M4** `compare_product_channel` 塞入匹配分与评级 | 直接注入会被 **TS 类型挡住（编译失败）**；加类型断言后注入 `totalScore`+`grade` | **KILLED**（1 例失败） | 一致（补记：类型层本身是一道防线） |

**作者「4/4 KILLED」的声明属实。**

### C2 复核者自选 6 条（覆盖高风险行为）

| 变异 | 做法 | 结果 | 说明 |
| --- | --- | --- | --- |
| **M5** 聚合 TGI 公式改正确 | 错误加权平均 → 简单平均 | **SURVIVED** | 聚合 TGI 零覆盖（同时暴露 B9 的错值） |
| **M6** `findPortraitByEntityIds` 忽略 month | 去掉月份过滤 | **KILLED**（1 例失败） | 缺月不回退有保护 |
| **M7** `listChannels` 去掉 month 过滤 | 过滤条件置 false | **SURVIVED** | `list_channels` 的 month 过滤无断言 |
| **M8** `search_by_tag` 忽略 scope | 过滤条件置 false | **SURVIVED** | DM11 的 `scope` 无断言（实跑行为正确，但无回归保护） |
| **M9** `attributeJaccard` 分母改错 | `shared/(shared+1)` | **SURVIVED** | 相似款属性分无断言 |
| **M10** `get_brand_portrait` 恒返回 `data-not-ready` | 条件改 false | **SURVIVED** | 该工具的数据缺失路径零覆盖（与 §发现 #1 互为印证） |

**统计：10 条变异杀掉 6 条，存活 4 条。**存活集中在三处：`packages/core/src/index/**` 的聚合/过滤/评分原语、品牌画像分支。结论：作者的变异测试**方法有效、覆盖面不足**；`packages/core/src/index/**` 三个新模块**没有任何直接单元测试**，其行为保护完全依赖 `packages/data-mcp` 的间接集成测试。

---

## D. 规范 §5.3 专项最终检查

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| **四点原则 · Host 管环境** | PASS | 数据根由 `UOM_DATA_ROOT` 指定；进程内只读；运行期源码**零写文件调用**（grep `writeFile/mkdir/createWriteStream` 无命中）；不代业务判断 |
| **四点原则 · Agent 自主执行** | PASS | 工具自探测数据源、无固定流程限制；相似度原语置于 `packages/core` 供后续复用 |
| **四点原则 · 优先复用第三方能力** | PASS | 复用 `@modelcontextprotocol/server` v2 + zod v4；exceljs 沿用 P0-4；未自造协议/解析器 |
| **四点原则 · 减少人的操作** | PASS | 数据文件到位即自动可用（探测式）；无需手工维护清单或逐条审批读取 |
| **数据不出网 · 新增依赖出网路径** | PASS | 依赖树 188 包，逐名扫描**无遥测/分析/云 SDK/出网客户端**；唯一疑似 `undici-types` 只是 `@types/node` 的类型包 |
| **数据不出网 · 构建产物离线可用** | **PASS（本次实跑，非静态推断）** | `sandbox-exec` 禁止 network 后启动真实 server：17 工具全部可列可调（10 OK / 7 `data-not-ready`）；另用 `--import` 拦截 `net/http/https/dns/tls` 全量出网 API，**`attempts=0`** |
| **数据不出网 · CI 不接触真实数据** | PASS | CI 对本变更走 full 模式：`npm ci` → `npm run check` → `npm audit`；测试 fixture 运行时在 `tmpdir` 生成；`data/` 被 gitignore；数据守卫 PASS |
| **数据不出网 · 索引不落库** | PASS | 索引在进程内存中构建，不写 `.local/`、不产生业务数据副本 |
| **匹配内核唯一性** | PASS | 候选**未引入任何评分/评级逻辑**；无权重、无阈值；`compare_product_channel` 只产出差异（实测无 `totalScore`/`grade`）；M4 变异被 KILLED。**注**：相似度原语放在 `packages/core` 供 P1 复用，方向正确；相似款 0.5/0.5 权重硬编码在 `query.ts`，建议 P1 前迁到配置 |
| **背对背隔离** | PASS（本轮） | 候选未新增预测路径；`similarProducts` 使用的 6 个属性键均为客观属性（品类／版型／面料／IP）；dossier 同时给出 `attributes`／`predictionAttributes`／`comparisonOnly`，结构上可区分。**工具2 侧的路径级隔离属 P2，本轮 NOT_APPLICABLE** |
| **模型来源与版本** | NOT_APPLICABLE | 本轮无模型/移植代码 |
| **人的操作** | PASS | 无新增必做人工动作；数据接入靠探测；错误消息直接指明缺哪个文件 |
| **结果状态用词** | FAIL（部分） | `result.md` §3 验收表与候选实际状态不符（见 §发现 #2），存在把「未验证」表述为「已完成」的风险 |

---

## 发现

### 阻断

**#1 `get_brand_portrait` 返回空结果而非 `data-not-ready`（违反 spec §6.1 与 DM13；双层状态误报）**
- 位置：`packages/data-mcp/src/server.ts:173-184`；根因在 `packages/core/src/index/build.ts` 的 `DATA_SOURCE_PROBES` 未登记该工具。
- 证据：实测 `get_brand_portrait({scope:'target'})` → `{"ok":true,"data":{"scope":"target","portraits":[]}}`；`index.unavailable` 的键集合恒为 7 个，无 `get_brand_portrait`，故 `if (!index.unavailable.get_brand_portrait)` 恒真，其后的 `err('data-not-ready', …)` 分支是**不可达死代码**；变异 M10（把条件改 false）**SURVIVED**，证明该路径零覆盖。
- 影响：① 违反「数据未就位的工具返回明确错误并说明缺什么数据源，不返回空结果」；② 候选的「10 个可用」实为 9 个，README 与 `result.md` 的双层状态表述均**高估**；③ spec §6.1「已知的数据未就位项」表漏列该工具（应为 8 项）。
- 建议：把品牌画像加入 `DATA_SOURCE_PROBES`（探测 `data/domains/01_品牌信息/` 下的画像文件），或直接删除不可达分支并返回 `data-not-ready`；同步修正 README／`result.md` 的「10 个可用」与 spec §6.1 表；补一条断言该工具返回 `data-not-ready` 的测试。

**#2 交付记录的验收条目表与候选实际状态不符**
- 位置：`openspec/changes/data-mcp-core/result.md` §3「验收条目对应」。
- 证据：DM05 标 `NOT_RUN`「聚合层级画像未实现」—— 实际 P0-5 已实现品类层级；DM06–DM12 标 `NOT_RUN`「MCP 未开始」—— 实际 17 工具已交付；DM01／DM02 的「索引化存储未做」已由 P0-5 覆盖（内存索引）；DM08「MCP 返回值一致性未验证」—— 复核者已独立核对 2985 条、0 不一致，但**候选未做**。
- 影响：规范 §4.6 的 P0 门禁与 §5.2 的工程完成条件都以该表为准判读；表过期会把「已交付但有缺陷」误读成「未做」，也会把未验证项混过去。
- 建议：按 P0-5 实况重写 §3 表，逐条给出 `PASS`／`部分`／`NOT_RUN`／`FAIL` 与证据位置；DM08 明确写「候选 NOT_RUN，复核者独立抽样 2985 条一致」。

### 应修

**#3 `aggregatePortrait` 的 TGI 聚合公式错误，静默返回错值**（`packages/core/src/index/query.ts:305-317`）
- 证据：构造 2 份成员画像（share 0.45／0.55，TGI 95／110），聚合得 TGI **55.18**，正确加权平均约 **103.25**。公式把加权平均再乘 `weight = value.share`，且分母用了已累加的 `existing.share`。
- 影响：`get_portrait_aggregate` 是 17 个交付工具之一；一旦有 ≥2 个商品带 TGI 画像就会静默出错值。变异 M5 SURVIVED。
- 建议：改为按成员 share 的正规加权平均（或直接取算术平均并在规则文档写明口径），补单测覆盖「1 份成员」「2 份成员」「标签只在部分成员出现」三种情形。

**#4 聚合口径未写入规则文档**（DM05 明文要求）
- 证据：`docs/normalize-rules.md` 全文无「聚合」章节；`get_portrait_aggregate` 的 share 口径（按有该维度的成员数平均、缺失标签按 0 计入）与 TGI 口径均无书面定义。
- 建议：在规则文档补「聚合口径」一节，与 #3 一并落定。

**#5 「该实体没有任何画像」被报成「有多份画像」**（`packages/data-mcp/src/server.ts:136-144`）
- 证据：实测 `get_channel_portrait({channelId:'<一个无画像的渠道编码>'})` → `{"kind":"ambiguous","message":"渠道 <编码> 有多份画像，必须指定 month"}`，而该渠道实为 0 份画像，且无可用月份提示。
- 建议：区分「0 份」与「多份」两种 kind（如 `no-portrait` 与 `ambiguous`），或至少修正文案。

**#6 同月多平台画像被静默按数组序取一份，调用方无法分辨平台**（`packages/core/src/index/query.ts:43-53`）
- 证据：同一实体在同一个月存在两个平台的画像时，返回先到的那份（实测为京东侧）；`availableMonths` 把该月列两次。
- 建议：画像键加上平台维度，或在返回值中显式给出 `platform`；`availableMonths` 去重并标注平台。

**#7 `search_by_tag` 命中项不带平台标识，跨平台结果无法回溯**（`packages/core/src/index/query.ts:150-187`）
- 证据：实测一次查询中同一实体 + 同一月份出现两条命中（来自两个平台，占比与 TGI 不同），返回字段仅 `entityType/entityId/month/share/tgi/dimension/label`。
- 影响：与 DM15「逐条可追溯到源标签与源平台」相悖。
- 建议：`TagHit` 增加 `platform` 字段。

**#8 同款号在两张商品表各有一条，索引做「先到先得」的隐式合并且不记冲突**（`packages/core/src/index/build.ts` + `query.ts:14-16`）
- 证据：索引 344 条商品记录对应 334 个唯一款号，10 个款号各出现 2 次（分别来自商品主表与 ModelEvol 属性表），两条的字段目录规模与品类粒度都不同；`findProduct` 取数组首条，`list_products` 直接返回 344 行（含重复款号）。
- 影响：与 DM04「跨文件冲突按显式映射表处理并记录，不做隐式合并」相悖；同一款号的档案取决于表顺序，属隐性口径。
- 建议：索引构建时按款号合并或显式标记冲突源（并产出 conflict 级 issue），`findProduct` 的选择规则写入文档。

**#9 数据根缺失／为空时全部工具返回静默空结果**（`packages/core/src/index/build.ts` + server 各工具）
- 证据：`dataRoot` 指向不存在的目录时，`buildIndex` 不报错，索引为 0 商品／0 渠道／0 画像；`list_channels` → `ok:true, total:0`。
- 建议：索引为空时所有工具返回 `data-not-ready`（指出数据根路径），或至少让 `list_channels` 报「数据根为空/未挂载」。

**#10 未识别的数据文件被静默跳过，无任何提示**（`packages/core/src/index/build.ts:170-211`）
- 证据：中文平台目录 + 文件名无平台后缀的画像 CSV 不入索引，`issues` 长度为 0。
- 建议：产出「看到但未认领」的文件清单（warning 级 issue），并在 `docs/mcp-usage.md` 写明扫描/识别规则。

**#11 `packages/core/src/index/**` 无任何直接单元测试**（build / query / similarity 三个模块）
- 证据：`packages/core/test/` 无任何针对这三个模块的用例；变异 M5／M7／M8／M9／M10 全部 SURVIVED。相似度边界（空分布、单侧空、完全相同、完全不重叠）、扫描规则（不误识别指标字典／商圈表／品牌清单）、聚合口径三处均无断言。
- 建议：按 §4.3 补「正向／反向／边界／失败」四类断言，至少覆盖：相似度 4 类边界、扫描规则的正反例、聚合的 3 种成员构成、`scope`／`month` 过滤。

**#12 `search_similar_products` 的画像分缺失时按 0 计，系统性压低无画像商品**
- 证据：真实样本 5 个命中的 `portraitScore` 全 0、`sharedDimensions` 全 0；总分上限被压到 0.5。
- 建议：按「对有效分量重归一化」（讨论稿 §4.1 口径）处理，并在返回里标出画像分量是否可用。

**#13 单品画像的 `month` 为空串**
- 证据：源文件名不含月份，`get_product_portrait` 返回 `month:""`；月份列表也过滤掉了它。
- 影响：带 `month` 调用必然失败；跨期比较无法用月份定位。
- 建议：按 spec §10 Q6 的默认写 `unknown` 并在返回值显式标注；或从数据源补月份。

### 建议

**#14** `compare_product_channel` 带 `month` 时错误 kind 为 `not-found`，与其他工具的 `month-mismatch` 不统一（见 B11）。
**#15** `get_channel_portrait` 未返回 DM09 要求的「样本量、画像覆盖率」：类型里有 `sampleSize`／`coverage`，但全链路**无人写入**。源导出（平台画像明细表仅三列）确实没有该信息 → 属数据缺口，但未在 spec §6.1 已知缺口表披露，也未在响应中标注。
**#16** `list_channels` 只返回全局月份列表，不返回每个渠道的画像覆盖（讨论稿 §3.3 写「列出渠道及画像覆盖情况」）；对「该月有画像但门店未关联」的情况返回 `total:0` 且无解释。
**#17** `search_by_tag` 的 `scope` 非法值（如 `bogus`）返回 `not-found`，更适合 `invalid-argument`（`scope='brand'` 仍应按「无数据」处理）。
**#18** `list_products` 的 `category`／`keyword` 为子串包含匹配，过宽（如单字母会命中大量商品）。
**#19** 源文件含 U+FFFD 替换字符：`packages/data-mcp/src/server.ts:328` 的「品**␦**归属」**出现在用户可见的错误消息里**；`packages/core/src/normalize/project.ts:240` 的「不会被拆**␦**」为上一提交（P0-4）遗留。建议全仓扫 U+FFFD 并修正（候选自述只扫了 NUL 字节）。
**#20** spec.md 自身不一致：§1／§5／§8 与 DM07 写「16 个工具」，§6.1 与讨论稿 §3.3 为 17 个。建议更正 DM07 与 §1／§5／§8 的措辞（属范围/规格措辞，需按 §11 走版本说明或用户确认）。
**#21** spec §6.1 写「索引产物落在 `.local/`」，实现改为**内存索引**（不落库，对数据守卫更友好），但未在 `result.md` §6「与规格的偏差」登记。
**#22** `docs/mcp-usage.md` 与 `result.md` §7 的「部分门店不在 200 个渠道内」**不准确** —— 未关联的门店其实都在宽表里，只是名称不同（别名缺口）。`docs/normalize-rules.md` §10 的「画像样本仅覆盖 1 个门店实体」也不准确（3 家门店有画像）。建议改成「缺实体别名目录」。
**#23** 自述数字漂移：`result.md` §4 写「文档链接 47 条」，实测 52 条（候选 commit message 写的是 52，与实测一致）；「10 个工具返回真实数据」不成立（见 #1）。

### 观察

**#24** `compare_product_channel` 的 `onlyInProduct`／`onlyInChannel` 在真实数据上恒为空（商品与渠道两侧维度集合恰好相同），该分支在真实路径上未被数据触发。
**#25** `get_product_dossier` 返回的 `funnel`／`performance` 恒缺（源数据缺经营指标），属已披露的数据缺口；`product/types.ts` 的类型已预留字段。
**#26** 规范 §4.3「实现前先有 RED」在 P0-5 未遵守（候选在 `result.md` §7 自述「实现先于测试写下」）。这是**已如实披露的流程偏差**；变异测试可部分补偿，但补偿不了上面 4 条存活的变异所暴露的空洞。
**#27** CI 对本变更走 full 模式（`npm ci` → `npm run check` → `npm audit`）+ 数据守卫 job，CI 无真实数据；本地结果与 CI 结果按规范分别报告，不互相替代。

---

## 结论

**整体结论：FAIL（不建议按现状合并）。**

理由（阻断项两项，均属小改动、可在本候选内修完）：

1. **#1 `get_brand_portrait` 返回空结果而非明确错误**，直接违反 spec §6.1「数据未就位的工具返回明确错误并说明缺什么数据源，不返回空结果」与 DM13；同时使候选的「10 可用／7 未就位」双层状态表述失真，并漏列于 spec §6.1 的已知缺口表。
2. **#2 `result.md` 的验收条目表停留在 P0-5 之前**，把已交付项标成 `NOT_RUN`、把未验证项混在同表里；而 P0 阶段门禁（规范 §4.6）与工程完成条件（§5.2）都以该表判读。

另有 **#3 聚合 TGI 静默错值**（应修，但同样应在合并前修掉或明确降级为「仅 share 口径可用」）与 **#11 `packages/core/src/index/**` 零直接单测**（4 条变异存活）。

**已通过且不必重做**：工具清单与参数契约（17/17 与讨论稿一致）、stdio 传输与零网络监听、**断网实跑 PASS**（沙箱禁网 + 出网 API 拦截，`attempts=0`）、依赖无遥测/云 SDK、CI 不接触真实数据、数据只读、匹配分与评级未进入 MCP（边界守住）、缺月不回退在各工具一致、DM08 抽样一致性（复核者独立核对 2985 条、0 不一致）、作者自述 4/4 变异 KILLED 属实。

**是否建议合并**：**暂不建议**。建议作者在同分支修完 #1、#2（必须）与 #3、#11（强烈建议），补 §5.3 的对应证据后，重新提请复核；复核范围可限定在「受影响范围」（索引构建、聚合、结果记录、已知缺口表），无需重做已通过的断网与工具契约核对。

**是否建议进入 P0-6**：**有条件建议**。P0 阶段门禁（规范 §4.6）要求「真实数据可经 MCP 正确返回；`compare_product_channel` 与 `search_by_tag` 可用」——实测这两项在真实数据上可用且语义正确，DM08 的一致性也已由复核者独立抽样证明（2985 条 0 不一致），因此 **P0-6（真实数据端到端逐项核对与错误路径复现）具备开工条件**。但：
- 进入 P0-6 前应先修 #1（否则端到端核对会把「空结果」当成正常基线固化下来）与 #3；
- P0-6 的结论不得沿用本轮的 DM08 证据，须由执行方自己完成 ≥20 条抽样核对；
- P0 门禁的「正确返回」目前只能覆盖到品类层级聚合与 1 个可关联渠道，**跨渠道对比（DM12）仍只有 1 组可用样本**，门禁应按「局部通过」如实记录，不得表述为全量通过。

**未验证/未证明范围（本轮未做，不得计入通过）**：工具2 侧的预测路径级背对背隔离（P2）；黄金校验用例（评分逻辑本轮未动，属回归基线，本轮未跑）；P0-4 归一化层的重新复核（沿用既往结论）；CI 远端实跑（本地检查 PASS，CI 结果需另行确认）。
