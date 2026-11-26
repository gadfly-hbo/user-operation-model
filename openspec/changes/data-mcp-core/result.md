# Data-MCP-Core：实施记录

> 变更：[spec.md](spec.md) · 规格状态：待用户确认（实现已按规格起步，见下）

## 1. 本轮实际完成

**P0-2 统一维度集与类型定义 —— 已完成。**

| 交付物 | 路径 | 状态 |
| --- | --- | --- |
| 画像核心类型 | `packages/core/src/portrait/types.ts` | PASS |
| 统一维度目录（37 个维度） | `packages/core/src/portrait/catalog/dimensions.ts` | PASS |
| 跨平台标签映射表（69 条） | `packages/core/src/portrait/catalog/mappings.ts` | PASS |
| 年龄段归并规则（32 条） | `packages/core/src/portrait/catalog/age-bands.ts` | PASS |
| 维度注册表 / 映射表 / 归并解析器 | `packages/core/src/portrait/registry.ts` | PASS |
| 商品档案类型 | `packages/core/src/product/types.ts` | PASS |
| 商品字段目录（62 个字段） | `packages/core/src/product/catalog/fields.ts` | PASS |
| 字段目录与背对背隔离判定 | `packages/core/src/product/fields.ts` | PASS |
| 单元测试（27 例） | `packages/core/test/core.test.ts` | PASS |
| 工程骨架（npm workspaces + tsc project references） | `package.json`、`tsconfig*.json`、`packages/core/` | PASS |

**样例数据已就位**：`data/domains/` 下 12 个业务域、29 个文件（3.6 MiB），来源 `semir-mvp-samples`。数据留在本地，未入库（`.gitignore` 排除 `data/` 下除 `README.md` 外的一切）。

## 2. 任务清单状态

| # | 任务 | 状态 | 依据 |
| --- | --- | --- | --- |
| P0-1 | 数据就位与字段映射确认 | **部分** | 样例已就位；字段映射表已从实际列名建立；但**经营指标缺失**，来源数据仅含主数据 |
| P0-2 | 统一维度集与类型定义 | **PASS** | 见 §1 |
| P0-3 | 归一化规则文档 | NOT_RUN | 待 P0-4 实现时同步产出 |
| P0-4 | 归一化实现 | NOT_RUN | 本轮未开始 |
| P0-5 | MCP server 与 16 个工具 | NOT_RUN | 本轮未开始；可依 P0-2 的目录直接开工 |
| P0-6 | 真实数据端到端验证 | NOT_RUN | 依赖 P0-4／P0-5 |
| P0-7 | 离线与数据守卫验证 | **部分** | 数据守卫与链接检查本地通过；**断网验证未做**（尚无 MCP 可断网运行） |
| P0-8 | 独立复核与交付 | NOT_RUN | 待完整候选 |

## 3. 验收条目对应

| 条目 | 状态 | 说明 |
| --- | --- | --- |
| DM02 | **部分** | 统一维度集与词表已建立；**投影执行逻辑属 P0-4**，本轮未实现「平台原生标签保留 + 投影可回溯」的运行路径 |
| DM15 | **部分** | 映射表 69 条均带 id、源平台、源维度、源标签、目标维度与目标标签，可追溯性在数据结构层已满足；**投影时按表取值的执行逻辑属 P0-4**；「禁止互转」已由测试强制 |
| DM16 | **部分** | 32 条年龄归并规则均带 `precision` 与 `spill`/`note`；投影时写入 `precisionLoss` 属 P0-4 |
| 背对背隔离（§4.4） | **部分** | 字段目录以 `usage` 编码隔离，9 个人工定位字段被排除在预测路径外，**已由测试覆盖**；工具2 侧的实际隔离由 P2 实现并复核 |

## 4. 实际执行的检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 + 构建 | `npm run build`（`tsc -b`） | PASS，无错误无警告 |
| 单元测试 | `npm run test` | PASS，27 例全过，0 失败 0 跳过 |
| 依赖审计 | `npm audit --audit-level=high` | PASS，0 vulnerabilities |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | PASS，38 条相对链接无错误 |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | PASS，索引中无业务数据 |
| 离线验证 | —— | **NOT_RUN**，无 MCP 可运行 |
| 独立复核 | —— | **NOT_RUN**，候选未完整 |

## 5. 与规格的偏差

无范围偏差。两处细化记录如下：

1. **天猫「预测购买力」L1–L5 的映射标记为 `needs-confirmation`**，不参与投影。数据源未标明 L 数值与购买力的方向，猜测即引入错误。该项在映射表中保留条目并附说明，待确认后改状态即可生效，不需改代码。
2. **抖音「城市等级」的「港澳台城市」不建立映射** —— 另两平台无对应档位。按「不自动推断未声明映射」处理，保留在 `platformLabels` 中不投影。

## 6. 已知限制

- **映射表覆盖的是当前样例出现的枚举值**。真实数据导入时若出现新枚举值，映射表不会自动命中，该标签会保留在 `platformLabels` 而不投影 —— 这是设计意图（不自动推断），但需要在归一化时统计「未映射标签」并提示补充映射
- **扩展维度的标签词表未定义**，按 identity 投影（沿用平台原值）。若后续需要跨平台对齐扩展维度，需再补词表
- **商品字段目录的 `sources` 覆盖两张实际来源表**（商品宽表、ModelEvol 建模表）。实际数据源若换表结构，需更新 `sources` 或新增字段条目

## 7. 下一步

1. 用户确认本规格（§1 范围、§10 剩余三项待拍板）
2. P0-3 + P0-4：归一化规则文档与实现，投影逻辑在此落地
3. P0-5：MCP server 与 16 个工具，可直接复用 P0-2 的目录
4. 补数据：商品经营指标、渠道经营指标、多渠道人群画像（缺这三样 P0 门禁过不了）
