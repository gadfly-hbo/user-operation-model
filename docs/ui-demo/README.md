# 人群运营工作台 · UI Demo

静态单页原型，纯 HTML + CSS + 原生 JS。**无构建、无依赖、无网络请求。**

## 打开

直接双击 `index.html`，或起一个静态服务：

```bash
python3 -m http.server 8899 --directory docs/ui-demo
# http://127.0.0.1:8899/index.html
```

## 页面

| hash | 页面 | 对应能力 |
| --- | --- | --- |
| `#review` | 选品评审台（默认） | 背对背 → 面对面 → 决策，业务方案核心 |
| `#match` | 货渠匹配 | 工具 1：热力图 + 明细抽屉 |
| `#predict` | 新品预测 | 工具 2：属性 → 画像 + 依据 |
| `#channel-profile` | 渠道画像库 | MCP 查询 |
| `#product-profile` | 商品画像库 | MCP 查询 |
| `#tag-search` | 标签反查 | MCP `search_by_tag` |
| `#datasource` | 数据源管理 | 17 个工具的就绪状态与缺失原因 |
| `#retention` | 留存与回购 | 需求三：结构 / Cohort / Recency / 流转 / 诊断 |
| `#flywheel` | 复盘飞轮 | 决策 → 行动 → 反馈 → 复盘 |

## 说明

- 全部数据为**合成演示数据**，不含任何真实业务数据
- 亮/暗主题切换（记忆到 localStorage）
- 设计说明见 [`../ui-design.md`](../ui-design.md)
