# user-operation-model

服饰零售「人-货-渠」人群运营模型的工程实现。产品形态是**人群运营工作台**：在本机把人、货、渠三侧画像放进同一套「标签维度 + 占比 + TGI」坐标系，支撑「背对背预测 → 面对面校对」的决策闭环。产品方向与范围见[产品讨论稿 v0.2](docs/产品讨论稿-v0.2.md)，开发流程见[工程规范](docs/engineering-workflow.md)。

## 当前状态

| 交付物 | 状态 |
| --- | --- |
| [产品讨论稿 v0.2](docs/产品讨论稿-v0.2.md) | 现行版本：人群运营工作台定为产品形态，D1–D12 决策已记录 |
| [工程规范](docs/engineering-workflow.md) | v1.0，本项目开发流程的唯一详细来源 |
| [架构梳理与重构方案](docs/architecture-review-v1.md) | 已入库；底座重构按六个切片推进，切片 A（时间与选择语义）已合并 |
| 数据 MCP | 已交付：17 个工具（stdio）；哪些工具的数据未就位见 [docs/mcp-usage.md](docs/mcp-usage.md) |
| 工具1（货渠匹配） | 已交付（P1）：共享匹配内核 + 静态看板 + 错配清单；权重未经真实数据校准 |
| 工具2（画像预测） | 已交付：ModelEvol v0.4／v0.6 移植与 Staging 登记；科学门槛未过，标「实验基线」不进生产，见 [docs/match-model-baseline.md](docs/match-model-baseline.md) |
| 留存与回购报表 | 未开始 |
| 业务侧数据模板包 | 已交付：`templates/数据模板.xlsx`，由代码契约生成 |
| 工作台 UI 原型 | 已交付：`site/web`（静态站点，合成演示数据），设计说明见 [docs/ui-design.md](docs/ui-design.md) |

## 三条需求

1. **数据服务** —— 把渠道画像、货品画像、人群画像统一成同一套标签维度 + 占比 + TGI 的数据契约，经本地 MCP（stdio）暴露给 Agent 与工作台
2. **模型一：货与渠匹配** —— 工具1 走事实画像入口（抖音范式规则匹配与看板），工具2 走预测画像入口（ModelEvol 范式可版本化模型），共享 `packages/core` 的唯一匹配内核
3. **模型二：留存与回购** —— Cohort 留存、月度大盘人群结构、老客 Recency 穿透、跨渠道流转矩阵、三大诊断面板

## 四条硬约束

违反任一条即视为缺陷，不得以「先跑起来」放宽。

1. **业务数据不出网** —— 原始导出、画像索引、成交数据、报表产物一律留在本机；MCP 走 stdio，本地服务只绑 `127.0.0.1`；CI 不接触任何真实数据
2. **匹配内核唯一** —— 工具1／工具2 共用 `packages/core` 的评分实现，禁止复制第二份逻辑；改动须通过黄金校验用例
3. **背对背隔离** —— 工具2 的预测路径不得读取商品部人工画像字段，预测输入仅限品类／版型／面料／工艺／价格带／季节／上新类型／IP 等客观属性
4. **模型来源可溯** —— ModelEvol 只读参考、model-mlflow 只消费不改造；移植留来源标识，失败结论不继承；模型包精确版本锁定，Stage 以 Registry 为准

详见[工程规范](docs/engineering-workflow.md)与 [AGENTS.md](AGENTS.md)。

## 仓库布局

```
.
├── AGENTS.md                    # 工程入口
├── docs/                        # 工程规范、产品讨论稿 v0.2、架构梳理、口径与使用说明
├── openspec/changes/            # 每项变更的 spec.md 与 result.md
├── packages/
│   ├── core/                    # 领域核心：数据契约、归一化、匹配内核（唯一评分实现）
│   ├── data-mcp/                # 数据 MCP（stdio）
│   ├── tool1-channel-match/     # 工具1：命令行 + 静态看板
│   ├── tool2-portrait-predict/  # 工具2：ModelEvol 移植、训练管线与模型包导出
│   ├── uom-services/            # 规划中：工具注册表 + 应用服务（底座切片 C）
│   ├── workbench-server/        # 规划中：工作台服务（底座切片 D）
│   └── reports/                 # 规划中：留存与回购报表（底座切片 F）
├── scripts/                     # 黄金回归、模板生成、断网守卫等脚本
├── site/web/                    # 工作台 UI 原型（静态、合成数据）
├── templates/                   # 业务侧数据模板包（由代码契约生成）
├── models/                      # 模型包（本地，不入库）
└── data/                        # 本地数据（不入库）
```

## 本地开发

```bash
npm install
npm run check        # 构建 + 全量测试

# 工具1：合成数据演示报告
npm run tool1 -- --demo --out output/tool1-demo.html

# 数据 MCP（stdio；启动与客户端接入详见 docs/mcp-usage.md）
npm run build
UOM_DATA_ROOT=data node packages/data-mcp/dist/src/bin.js

# 业务侧数据模板包（由 packages/core 的代码契约生成）
npm run templates:build
```

数据 MCP 运行期零网络请求、只读本地数据；`data/` 下的业务数据不入库、不出网。

## 本地检查

```bash
npm run check                                     # 构建 + 全量测试
npm run test:golden                               # 匹配内核黄金校验用例
python3 .github/scripts/check-docs-links.py .     # 文档相对链接
python3 .github/scripts/check-data-guard.py .     # 数据不出网守卫（检查 git 索引）
```

## 扩展性约定

`packages/core` 的目录（catalog）是**数据**，处理逻辑不硬编码字段：

| 要扩展什么 | 改哪里 | 是否需要改逻辑代码 |
| --- | --- | --- |
| 新增画像维度 | `packages/core/src/portrait/catalog/dimensions.ts` | 否 |
| 新增平台标签映射 | `packages/core/src/portrait/catalog/mappings.ts` | 否 |
| 调整年龄等分档边界 | `packages/core/src/portrait/catalog/age-bands.ts` | 否 |
| 新增商品字段 | `packages/core/src/product/catalog/fields.ts` | 否 |

未在目录登记的内容不会被丢弃：商品档案的未知字段进入 `ProductDossier.extra`，画像的未映射标签保留在 `Portrait.platformLabels`。

## 外部参考资产（只读）

| 资产 | 位置 | 用途 |
| --- | --- | --- |
| 抖音货渠匹配 | `~/工作/抖音货渠匹配` | 工具1 的评分规范、数据管道、看板形态 |
| ModelEvol 归档 | `~/Dev/Archive/ModelEvol` | 工具2 的模型设计与训练管线来源 |
| model-mlflow | `~/Dev/Projects/model-mlflow` | 模型治理账本与模型包来源 |

未经用户授权不允许改造三方资产本体，只允许随官方版本升级（升级也要用户授权）。
