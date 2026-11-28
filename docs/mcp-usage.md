# 数据 MCP 使用说明

> P0-5 交付物 · 2026-11-26
> 相关：[工程规范](engineering-workflow.md) · [归一化规则](normalize-rules.md) · [产品讨论稿 §3](产品讨论稿-v0.2.md)

## 启动

```bash
npm install
npm run build
UOM_DATA_ROOT=data node packages/data-mcp/dist/src/bin.js
```

- 传输：**stdio**（不监听任何端口）
- 数据根目录由 `UOM_DATA_ROOT` 指定，默认 `data`
- 运行期**零网络请求**，只读本地数据
- 索引在进程启动时构建，**不落库进 git**

## 客户端接入

```json
{
  "mcpServers": {
    "uom-data": {
      "command": "node",
      "args": ["/绝对路径/user-operation-model/packages/data-mcp/dist/src/bin.js"],
      "env": { "UOM_DATA_ROOT": "/绝对路径/user-operation-model/data" }
    }
  }
}
```

## 工具清单（17 个）

### 渠道

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `list_channels` | `month?` `type?` | 列出渠道与画像覆盖月份。`month` 必须是自然月 `YYYY-MM`；判断「该月有画像」与画像查询同一套覆盖规则（exact＞window＞year＞unknown，区间／年份画像覆盖该月即列出）；不带 `month` 时列出全部 |
| `get_channel_portrait` | `channelId` `month?` `platform?` | 取渠道画像；**缺月不静默回退**，返回 `month-mismatch` 并列出可用月份。同月多平台画像返回 `ambiguous`（message 列平台、hint 提示传 `platform`），传 `platform`（抖音／天猫／京东）消歧 |

### 品牌与竞品

| 工具 | 参数 | 数据状态 |
| --- | --- | --- |
| `get_brand_portrait` | `scope` `month?` | `scope` 必须为 `target`／`all`，否则 `invalid-argument`；品牌画像数据未接入时返回 `data-not-ready` |
| `get_competitor_portrait` | `brand` `month?` | **解析器已实现**：竞品画像放在 `data/domains/07_人群画像/竞品/`，文件到位后可用；目录存在但无可识别文件时返回 `data-not-ready`。`month` 与其它工具同口径：区间／年份画像覆盖该月即命中，无月份画像作为最低层命中并标 `match: "unknown"` |

### 商品

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `list_products` | `category?` `season?` `keyword?` `minPrice?` `maxPrice?` `channel?` | `channel` 过滤需商品↔渠道关联数据（`data/tables/product-channel.csv`）：**解析器已实现**，表到位后可用；表未到位时返回 `data-not-ready` |
| `get_product_dossier` | `spu` `month?` | 单品全量档案（属性 + FAB + 漏斗 + 经营指标）。画像在 `portraits` 数组（`{ month, platform, projections }`，按月键控）：带 `month` 时画像、指标、漏斗、渠道成交只含覆盖该月的记录；该月四类数据都没有时返回 `month-mismatch` 并列出可用月份；不带 `month` 返回全部月份（切片 A · SA-05，原单数 `portrait` 字段移除） |
| `get_product_portrait` | `spu` `dimensions?` `month?` `platform?` | 单品画像，可限定统一维度；同月多平台时用 `platform` 消歧 |
| `get_portrait_aggregate` | `level` `key` `month?` | `category` 始终可用；`series`／`hot`／`ip` 需聚合口径表（`data/tables/aggregate-groups.csv`）：**解析器已实现**，表到位后可用；表未到位时返回 `data-not-ready`（带 hint「当前仅支持 category 层级…」）。**`level` 不在 `category`／`series`／`hot`／`ip` 之内（如 `foo`、空串、大小写不符的 `Series`）返回 `invalid-argument`**，message 形如 `level 必须是 category／series／hot／ip，收到 …`（末尾附收到的原值）；这是 P0 数据收尾阶段一的有意变更，阶段一之前返回 `data-not-ready`。带 `month` 时只聚合各成员覆盖该月的画像；不带 `month` 且成员有多份画像时返回 `ambiguous` |
| `get_funnel` | `spu` `phase` | **解析器已实现**：漏斗表 `data/tables/funnel.csv` 到位后可用；表未到位时返回 `data-not-ready` |

### 对比与检索

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `compare_product_channel` | `spu` `channelId` `month?` `productPlatform?` `channelPlatform?` | 逐维度差异：双方 Top3、JS 距离、JS 相似度、余弦、Top3 重合度；每维度带被排除的单侧标签（`excludedProductLabels`／`excludedChannelLabels`），某维度无公共标签时不可用（`no-common-labels`）。**只产出差异，不产出匹配分与评级**（属 P1 匹配内核）。同月多平台时用 `productPlatform`／`channelPlatform` 分别消歧 |
| `search_by_tag` | `dimension` `label` `scope?` `topN?` `month?` | 按统一维度标签反查实体；未命中返回 `not-found`。带 `month` 时只命中覆盖该月的画像，命中结果带匹配方式（`match`：exact／window／year／unknown） |
| `search_similar_products` | `spu` `topN?` `month?` `platform?` | 属性相似度与画像相似度各占一半，返回分解得分。目标有多份画像且未传 `month` 时返回 `ambiguous`（不退化成只比属性）；带 `month` 时目标与候选都改用覆盖该月的画像 |

### 会员与留存

| 工具 | 参数 | 数据状态 |
| --- | --- | --- |
| `list_member_features` | `level?` `segment?` | **解析器已实现**：特征字典 `data/tables/member-features.csv` 到位后可用；表未到位时返回 `data-not-ready` |
| `get_retention_cohort` | `cohortMonth` `metric` | **解析器已实现**：`data/retention/cohort.csv` 到位后可用；指标键 `day30`／`day60`／`day90`／`next_season` |
| `get_recency_distribution` | `month` | **解析器已实现**：`data/retention/recency.csv` 到位后可用 |
| `get_channel_flow_matrix` | `month` | **解析器已实现**：`data/retention/channel-flow.csv` 到位后可用，返回逐行明细与 `matrix` 矩阵 |
| `get_diagnosis` | `month` `type` | **解析器已实现**：`data/retention/diagnosis.csv` 到位后可用；类型 `二回断崖`／`虚假繁荣`／`清仓客次季跃迁` |

连同 `get_brand_portrait` 与 `get_competitor_portrait`，共 **8 个工具**在当前 `data/` 下仍返回 `data-not-ready`——**但与 P0 之前的区别是：这 8 个工具的解析器都已实现**（`get_brand_portrait` 除外，它本来就有真实实现），数据文件到位后即可用，不需要再改代码。

> **纠正 P0 记录**：P0 的「接口已就绪，探测到文件即自动可用」对上述 7 个工具**不成立**——当时它们的处理器是纯桩，文件到位也不会自动可用。本轮已补齐实现，并有回归测试锁死「探测说就绪 ⇒ 处理器不是桩」（见 `packages/data-mcp/test/p0-completion.test.ts`）。

列契约与口径见[归一化规则 §12](normalize-rules.md#12-p0-数据收尾新增表)。

## 返回结构

所有工具返回统一信封：

```json
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "kind": "month-mismatch", "message": "…", "hint": "可用月份：…" } }
```

失败时 MCP 响应的 `isError` 为 `true`。

### 错误类型

| kind | 含义 |
| --- | --- |
| `not-found` | 实体不在索引中 |
| `month-mismatch` | 实体存在，但该月无画像（列出可用月份） |
| `ambiguous` | 实体有多份画像无法唯一确定：跨月多份时列出可用月份、提示传 `month`；同月多平台时列出平台、提示传 `platform`（compare 两侧为 `productPlatform`／`channelPlatform`）。候选含**无月份画像**时按形态措辞（第二轮复核修正）：候选全无月份且平台多于一个 → 提示传 `platform`；单平台多月、或无月份与有月份混合 → 提示传 `month`，message 不说「在某月有多平台画像」；成员聚合的候选全无月份时提示「传任意月份（YYYY-MM）即可聚合」 |
| `data-not-ready` | 该工具的数据源未接入 |
| `invalid-argument` | 参数不合法。`month` 不是自然月 `YYYY-MM`（含区间标签、`2026-13`、`2026-1`）时返回此类，message 形如 `month 必须是 YYYY-MM，收到 …`；所有接受 `month` 的工具都先校验再查数据（`month` 传**空串按未传处理**）。校验是**严格判断**（第二轮复核修正）：**不裁首尾空白**（`"2026-10 "` 拒绝）、**不接受 `2610` 等 YYMM 写法**（`2610` 只在画像标签／文件名里按月份解，不是入参写法）——避免这类写法在按月键查找时静默返回空指标 |

**空结果与数据缺失严格区分**：数据未就位时返回 `data-not-ready` 并指明缺哪个文件，**不返回空数组**。

**无月份画像各工具同口径**（复核修正统一）：实体只有无月份画像时，任何 `month` 查询都可命中它，作为最低层（`match: "unknown"`）——适用于 `get_product_portrait`／`get_product_dossier`（`portraits` 条目带 `match` 字段）／`search_by_tag`／`get_portrait_aggregate`／`get_competitor_portrait`；不传 `month` 时无月份画像照常参与，且不产生 `match` 字段。区间／年份画像覆盖查询月即命中（`match` 为 `window`／`year`）。

**非法入参单独成类**：`invalid-argument` 表示参数本身不合法（取值不在允许集合内，含 `month` 写法非法），与「数据没到位」的 `data-not-ready` 是两回事。逐工具的非法入参行为见上表（如 `get_portrait_aggregate` 的 `level`、`get_brand_portrait` 的 `scope`）。

## 实体标识说明

渠道侧存在**两套标识**：

- 渠道宽表主键：**店铺编码**（如 `1OCD7S0011`）
- 画像文件命名：**品牌 + 门店名**（如 `森马广州越秀区北京路店`）

MCP 对外统一用**店铺编码**查询，内部通过渠道宽表的 `店铺` 字段关联画像实体名。两者对不上时返回 `not-found` 并列出可用月份。

> **已知数据问题**：现有样例的 7 份画像中只有 1 份能关联到渠道宽表——画像文件名用「品牌+门店名」全称，渠道宽表 `店铺` 列用简称（如「森马广州北京路旗舰店」），字符串不相等；200 个渠道覆盖森马、巴拉巴拉等多个品牌，与画像所属品牌不同。见[归一化规则 §10](normalize-rules.md#10-已知数据质量问题)。

**别名目录可修复这类断链**：提供 `data/tables/entity-alias.csv`（`规范实体名, 别名, 店铺编码, 平台`）后，画像实体名先归一为规范名再关联渠道宽表，且渠道查询的候选标识同时包含别名与规范名。口径见[归一化规则 §12.4](normalize-rules.md#124-实体别名目录)。

## 数据源探测

工具的「数据是否就绪」由**数据目录探测**决定，不由代码写死：

| 工具 | 探测的文件 |
| --- | --- |
| `get_brand_portrait` | `data/domains/01_品牌信息/` 下含「画像」字样的文件 |
| `get_competitor_portrait` | `data/domains/07_人群画像/竞品/` 目录 |
| `get_funnel` | `data/tables/funnel.csv` |
| `list_member_features` | `data/tables/member-features.csv` |
| `get_retention_cohort` | `data/retention/cohort.csv` |
| `get_recency_distribution` | `data/retention/recency.csv` |
| `get_channel_flow_matrix` | `data/retention/channel-flow.csv` |
| `get_diagnosis` | `data/retention/diagnosis.csv` |

**探测与实现必须成对**：探测表里登记的每个数据源都必须有非桩处理器。回归测试 `packages/data-mcp/test/p0-completion.test.ts` 对 `DATA_SOURCE_PROBES` 的每个工具断言「fixture 满足探测条件时，处理器不返回 `data-not-ready`」。

新增表（别名目录、冲突映射、商品↔渠道关联、聚合口径、经营指标）不在探测表里——它们不决定工具是否可用，只在文件存在时改变索引内容。
