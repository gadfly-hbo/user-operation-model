# user-operation-model

服饰零售「人-货-渠」人群运营模型的工程实现。

把商品部的买手经验与会员数据部的算法预测放进同一套画像坐标系，做**背对背预测**与**面对面校对**，并用数据驱动全生命周期的货品调拨与人群运营。

## 当前状态

**仓库仅含规范与设计文档，代码尚未启动。**

| 交付物 | 状态 |
| --- | --- |
| [产品讨论稿 v0.1](docs/产品讨论稿-v0.1.md) | 已评审，D1／D2 两项架构决策已确认 |
| [工程规范](docs/engineering-workflow.md) | v1.0，作为本项目开发流程的唯一详细来源 |
| [变更记录机制](openspec/README.md) | 已建立，首个变更待 P0 启动时创建 |
| 数据 MCP | 未开始（阻塞于数据源） |
| 工具1／工具2 | 未开始 |
| 留存与回购报表 | 未开始 |

## 三条需求

1. **数据 MCP** —— 基于《零售服饰人群运营模型》「从消费者视角重新认识人、货、渠」，把渠道画像、货品画像、人群画像统一成同一套标签维度 + 占比 + TGI 的数据契约，暴露为本地可调用的 MCP
2. **模型一：货与渠匹配** —— 工具1 走事实画像入口（抖音范式规则匹配），工具2 走预测画像入口（ModelEvol 范式可版本化模型），共享同一匹配内核
3. **模型二：留存与回购** —— Cohort 留存、月度大盘人群结构、老客 Recency 穿透、跨渠道流转矩阵、三大诊断面板

## 仓库布局

```
.
├── AGENTS.md                    # 工程入口
├── docs/
│   ├── 产品讨论稿-v0.1.md        # 产品方向、范围、架构决策
│   └── engineering-workflow.md  # 工程规范（流程唯一详细来源）
├── openspec/
│   ├── README.md                # 变更记录机制
│   └── changes/<change-id>/     # 每项变更的 spec.md 与 result.md
├── packages/                    # 代码包（P0 起逐步建立）
│   ├── core/                    # 统一维度集、映射表、字段目录（数据契约的单一来源）
│   ├── data-mcp/                # MCP server（stdio）
│   ├── tool1-channel-match/     # 规则匹配与看板
│   ├── tool2-model-match/       # 属性→画像→匹配，含 model-mlflow 消费
│   └── reports/                 # 留存与回购报表集
├── models/                      # 精确版本锁定的模型包（不放权重大文件）
└── data/                        # 本地数据（gitignore，不上云）
```

## 本地开发

```bash
npm install
npm run check     # 类型检查 + 构建 + 单元测试
```

## 扩展性约定

`packages/core` 的目录（catalog）是**数据**，处理逻辑不硬编码字段：

| 要扩展什么 | 改哪里 | 是否需要改逻辑代码 |
| --- | --- | --- |
| 新增画像维度 | `packages/core/src/portrait/catalog/dimensions.ts` | 否 |
| 新增平台标签映射 | `packages/core/src/portrait/catalog/mappings.ts` | 否 |
| 调整年龄等分档边界 | `packages/core/src/portrait/catalog/age-bands.ts` | 否 |
| 新增商品字段 | `packages/core/src/product/catalog/fields.ts` | 否 |

运行时还可直接调用 `DimensionRegistry.register()`、`MappingTable.add()`、`FieldCatalog.add()` 动态追加。

未在目录登记的内容不会被丢弃：商品档案的未知字段进入 `ProductDossier.extra`，画像的未映射标签保留在 `Portrait.platformLabels`。

## 四条硬约束

1. **业务数据不出网** —— 原始导出、画像索引、成交数据、报表产物全部留在本机；MCP 走 stdio；CI 不接触真实数据
2. **匹配内核唯一** —— 工具1／工具2 共用 `packages/core`，禁止第二份评分逻辑
3. **背对背隔离** —— 预测路径不得读取商品部人工画像字段，否则机制失效
4. **模型来源可溯** —— ModelEvol 只读参考、model-mlflow 只消费不改造，失败结论不继承

详见[工程规范](docs/engineering-workflow.md)与 [AGENTS.md](AGENTS.md)。

## 外部参考资产（只读）

| 资产 | 位置 | 用途 |
| --- | --- | --- |
| 抖音货渠匹配 | `~/工作/抖音货渠匹配` | 工具1 的评分规范、数据管道、看板形态 |
| ModelEvol 归档 | `~/Dev/Archive/ModelEvol` | 工具2 的模型设计与训练管线来源 |
| model-mlflow | `~/Dev/Projects/model-mlflow` | 模型治理账本与模型包来源 |

## 数据 MCP

```bash
npm run build
UOM_DATA_ROOT=data node packages/data-mcp/dist/src/bin.js
```

stdio 传输、零网络请求、只读本地数据。17 个工具，其中 10 个已接入真实数据、7 个的数据源待补（返回明确错误并指明缺哪个文件）。详见 [docs/mcp-usage.md](docs/mcp-usage.md)。

## 本地检查

```bash
# 文档相对链接
python3 .github/scripts/check-docs-links.py .

# 数据不出网守卫（检查 git 索引）
python3 .github/scripts/check-data-guard.py .
```
