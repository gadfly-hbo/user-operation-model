# 数据 MCP 使用说明

> P0-5 交付物 · 2026-11-26
> 相关：[工程规范](engineering-workflow.md) · [归一化规则](normalize-rules.md) · [产品讨论稿 §3](产品讨论稿-v0.1.md)

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
| `list_channels` | `month?` `type?` | 列出渠道与画像覆盖月份 |
| `get_channel_portrait` | `channelId` `month?` | 取渠道画像；**缺月不静默回退**，返回 `month-mismatch` 并列出可用月份 |

### 品牌与竞品

| 工具 | 参数 | 数据状态 |
| --- | --- | --- |
| `get_brand_portrait` | `scope` `month?` | `scope` 必须为 `target`／`all`，否则 `invalid-argument`；品牌画像数据未接入时返回 `data-not-ready` |
| `get_competitor_portrait` | `brand` `month?` | **解析器已实现**：竞品画像放在 `data/domains/07_人群画像/竞品/`，文件到位后可用；目录存在但无可识别文件时返回 `data-not-ready` |

### 商品

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `list_products` | `category?` `season?` `keyword?` `minPrice?` `maxPrice?` `channel?` | `channel` 过滤需商品↔渠道关联数据（`data/tables/product-channel.csv`）：**解析器已实现**，表到位后可用；表未到位时返回 `data-not-ready` |
| `get_product_dossier` | `spu` | 单品全量档案（属性 + FAB + 画像 + 漏斗 + 经营指标） |
| `get_product_portrait` | `spu` `dimensions?` `month?` | 单品画像，可限定统一维度 |
| `get_portrait_aggregate` | `level` `key` | `category` 始终可用；`series`／`hot`／`ip` 需聚合口径表（`data/tables/aggregate-groups.csv`）：**解析器已实现**，表到位后可用；表未到位时返回 `data-not-ready` |
| `get_funnel` | `spu` `phase` | **解析器已实现**：漏斗表 `data/tables/funnel.csv` 到位后可用；表未到位时返回 `data-not-ready` |

### 对比与检索

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `compare_product_channel` | `spu` `channelId` `month?` | 逐维度差异：双方 Top3、JS 距离、JS 相似度、余弦、Top3 重合度。**只产出差异，不产出匹配分与评级**（属 P1 匹配内核） |
| `search_by_tag` | `dimension` `label` `scope?` `topN?` | 按统一维度标签反查实体；未命中返回 `not-found` |
| `search_similar_products` | `spu` `topN?` | 属性相似度与画像相似度各占一半，返回分解得分 |

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
| `month-mismatch` | 实体存在，但该月无画像 |
| `ambiguous` | 实体有多份画像，必须指定 `month` |
| `data-not-ready` | 该工具的数据源未接入 |
| `invalid-argument` | 参数不合法 |

**空结果与数据缺失严格区分**：数据未就位时返回 `data-not-ready` 并指明缺哪个文件，**不返回空数组**。

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
