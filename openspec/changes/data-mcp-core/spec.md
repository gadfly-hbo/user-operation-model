# Data-MCP-Core

P0 阶段规格：数据归一化层 + 数据 MCP

> 状态：**待用户确认**。本规格为规范 §4.1 要求的变更规格，尚未开始实现。
> 相关：[工程规范](../../../docs/engineering-workflow.md) · [产品讨论稿 v0.1](../../../docs/产品讨论稿-v0.1.md)

## 1. 目标、授权和本轮交付

### 目标

交付 P0 阶段的两个产物，使讨论稿 §3 的「人-货-渠」统一数据契约可被调用：

1. **数据归一化层** —— 把用户提供的原始导出文件转成统一画像索引与商品档案
2. **数据 MCP** —— 以 stdio 暴露讨论稿 §3.3 的 16 个查询工具

### 本轮交付

| 交付物 | 说明 |
| --- | --- |
| 归一化规则文档 | `docs/normalize-rules.md`：字段映射、维度归一、缺失语义、冲突处理 |
| 统一维度集与类型定义 | `packages/core/src/portrait/`、`packages/core/src/product/` |
| 归一化实现 | `packages/core/src/normalize/` |
| 数据 MCP server | `packages/data-mcp/`，stdio |
| 脱敏样例 | `fixtures/`，供单测与 CI 使用 |

### 授权

用户已授权推进 P0（2026-11-26）。本规格确认后即进入实现。**数据源提供前不能完成 P0 门禁**，见[第 10 节](#10-未决问题)。

## 2. 固定基线与当前事实

- 基线：`main` @ `6ef2d41`（工程规范 v1.0 建立）
- 仓库当前**无任何运行时代码**，无 `package.json`
- 技术栈已定：TypeScript / Node ≥ 22.19，单仓库多包（讨论稿 §6）
- 参考资产（只读）：抖音工具的 `data_pipeline.py` 画像解析与零依赖 XLSX 解析；ModelEvol 的 `cleaning-rules.md` 清洗规则

## 3. 验收条目

验收以**外部可观察结果**描述，编号供独立复核逐项核对。

### 数据层

| 标识 | 验收条目 |
| --- | --- |
| DM01 | 归一化层可将原始导出文件转成统一画像索引，覆盖商品、渠道、品牌实体 |
| DM02 | 索引中每条画像记录含维度名、标签、占比、TGI；**商品侧与渠道侧使用同一套维度命名**（讨论稿 §3.2） |
| DM03 | 商品档案含讨论稿 §7.2 定义的字段；**缺失字段保留缺失标记，不插补** |
| DM04 | 跨文件冲突（同款在不同平台画像不一致）按显式映射表处理并记录，**不做隐式合并** |
| DM05 | 品类／系列／爆款／IP 四个聚合层级的画像可由基础画像算出，聚合口径写入规则文档 |

### MCP

| 标识 | 验收条目 |
| --- | --- |
| DM06 | MCP server 以 stdio 启动，**无网络监听**，可被 MCP 客户端连接并列出工具 |
| DM07 | 工具清单与讨论稿 §3.3 的 16 个工具一致，参数与返回结构符合 §7 类型定义 |
| DM08 | `get_product_portrait` 返回的标签占比与 TGI 与源文件逐项一致（抽样 ≥ 20 条记录核对） |
| DM09 | `get_channel_portrait` 返回渠道画像及样本量、画像覆盖率 |
| DM10 | `get_product_dossier` 返回单品的属性、FAB、画像、漏斗、经营指标 |
| DM11 | `search_by_tag` 按人群标签反查商品／渠道／人群，支持 `scope` 与 `topN`，返回命中项及占比 |
| DM12 | `compare_product_channel` 返回商品↔渠道的六维差异（双方 Top3、距离、JS／cosine）与偏离度 |

### 边界与健壮性

| 标识 | 验收条目 |
| --- | --- |
| DM13 | 数据缺失、文件为空、格式不符时返回**明确错误**，不静默返回空结果 |
| DM14 | **断网状态下 MCP 全流程可用**；CI 环境下不接触任何真实数据；数据守卫检查通过 |

## 4. 数据契约

以讨论稿 §7 为初稿，实现时在 `packages/core/src/portrait/types.ts` 与 `packages/core/src/product/types.ts` 落地。**类型定义是单一来源**，MCP 与后续工具1／工具2／报表共用。

```ts
type PortraitLabel = { share: number; tgi?: number };
type Portrait = {
  entityType: 'product' | 'channel' | 'brand' | 'category' | 'series' | 'ip' | 'competitor';
  entityId: string;
  month: string;
  dimension: string;
  labels: Record<string, PortraitLabel>;
  sampleSize?: number;
  coverage?: number;
};
```

`ProductDossier`、`DimensionDiff`、`MatchResult` 见讨论稿 §7.2–§7.4，本轮只落地前两项。

## 5. 范围与不做事项

### 本轮做

- 归一化规则文档与实现
- 统一维度集、类型定义、画像索引
- 数据 MCP 的 16 个工具

### 本轮不做

| 不做 | 归属 |
| --- | --- |
| 匹配评分、评级、看板 | P1 工具1 |
| 属性→画像预测模型、训练管线、model-mlflow 接入 | P2 工具2 |
| 留存与回购报表 | P3 |
| 背对背／面对面校对与四大款式分类 | P4 |
| 向量库、嵌入模型 | 无必要，单文件索引足够 |
| MCP 鉴权、多客户端并发 | 规模未到，stdio 单进程无此问题 |
| 商品图片托管、报表导出 | 分别在 P1／P3 |

## 6. 允许修改路径

```
packages/core/src/portrait/**
packages/core/src/product/**
packages/core/src/normalize/**
packages/data-mcp/**
fixtures/**
docs/normalize-rules.md
package.json  package-lock.json  tsconfig.json
openspec/changes/data-mcp-core/**
.github/workflows/check.yml      # 仅在需要补充检查时
```

**`packages/core` 中匹配评分相关目录不在本轮范围**，避免提前实现 P1 内容。

## 7. 关键边界

| 边界 | 规则 |
| --- | --- |
| 数据只读 | 数据目录只读挂载；任何写入只落 `.local/`（已 gitignore）或显式输出目录 |
| 不出网 | 归一化与 MCP 运行期**零网络请求**；不引入带遥测或云 API 的依赖 |
| 传输 | MCP 仅 stdio，不监听端口，不做鉴权 |
| 缺失语义 | 缺失维度**不插补**，进 registry 显式标记（继承 ModelEvol v0.7 缺失语义处理） |
| 跨平台 | 标签映射必须显式声明，**禁止隐式合并**（ModelEvol v0.5「同款优先抖音画像」导致渠道语义混淆，本项目不继承） |
| 维度单一来源 | 维度定义只在 `packages/core` 一处，MCP 不得自建维度名 |
| TGI 语义 | TGI 相对何种基准须在规则文档写明，不得隐式假定为大盘 |

## 8. 任务目标执行清单

> 顶部：本轮目标 = 交付 P0 数据层与数据 MCP，通过 P0 阶段门禁。
> 每项标注可核对的完成条件，对应验收条目。

| # | 任务 | 完成条件 | 验收 | 阻塞 |
| --- | --- | --- | --- | --- |
| P0-1 | 确认数据源与字段映射 | 归一化规则文档的字段映射表填满，五个数据源问题有答案 | — | **用户供数** |
| P0-2 | 统一维度集与类型定义 | `packages/core` 中类型与维度常量就位，单测覆盖 | DM02 | 否 |
| P0-3 | 归一化规则文档 | `docs/normalize-rules.md` 完成，含缺失、冲突、聚合口径 | DM03–DM05 | 部分依赖 P0-1 |
| P0-4 | 归一化实现 | 真实文件跑通，产出索引，抽样核对一致 | DM01, DM08 | 依赖 P0-1 |
| P0-5 | MCP server 与 16 个工具 | stdio 可连接，工具清单与 §3.3 一致 | DM06, DM07, DM09–DM12 | 依赖 P0-2 |
| P0-6 | 真实数据端到端验证 | 真实文件下逐项核对通过，错误路径可复现 | DM08, DM13 | 依赖 P0-4/5 |
| P0-7 | 离线与数据守卫验证 | 断网跑通全流程；CI 无真实数据；守卫脚本通过 | DM14 | 否 |
| P0-8 | 独立复核与交付 | 非作者复核完成，`result.md` 记录实际结果与未验证项 | — | 依赖 P0-6/7 |

**顺序**：P0-2 与 P0-7 可立即开工；P0-1 是全局阻塞项，拿到数据源前 P0-4／P0-6 无法进行；P0-3 可先写结构、字段映射留待 P0-1 填实。

**范围外问题处理**：按规范 §4.5 第 3 条，发现的无关问题记入 `result.md` 的范围外问题段，不顺手改。

## 9. 适用检查计划

| 检查 | 方式 | 期望 |
| --- | --- | --- |
| 类型检查与单测 | `npm run check` | 全绿，覆盖归一化与工具契约 |
| 黄金用例 | `packages/core` 的抖音工具两条基准用例 | 通过（评分逻辑本轮未动，作为回归基线） |
| 抽样核对 | 真实文件 → 索引 → MCP 返回，逐项比对 | DM08 一致率 100% |
| 错误路径 | 空文件、缺列、类型不符 | 返回明确错误，非空结果 |
| 离线验证 | 断网后跑通 MCP 全流程 | 通过 |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | 通过 |
| 链接检查 | `python3 .github/scripts/check-docs-links.py .` | 通过 |
| 依赖审计 | `npm audit --audit-level=high` | 无高危 |
| 独立复核 | 非作者 Agent，按验收条目逐项核对 | 见 `result.md` |

**结果状态用词**：`PASS` / `FAIL` / `NOT_RUN` / `UNKNOWN` / `NOT_PROVED`。禁止把未运行表述为通过。

## 10. 未决问题

### 阻塞项：Q1 数据源（用户）

| # | 问题 | 影响 |
| --- | --- | --- |
| 1 | 来源系统与导出格式（巨量云图／电商罗盘／天猫数据银行／自有 BI？） | 归一化实现方式 |
| 2 | 文件组织方式（按月分文件还是累计表） | 索引结构与 `month` 字段来源 |
| 3 | 字段命名是否与抖音／天猫一致 | 映射表规模 |
| 4 | 商品主表与画像表用什么键关联（款号／商品 ID） | 实体关联实现 |
| 5 | 历史跨度与数据量级 | 内存索引可行性 |

### 待用户拍板

| # | 问题 | 建议 |
| --- | --- | --- |
| 6 | 画像数据的 `month` 缺失时如何处理（用文件目录名／文件内字段／标为 unknown） | 用文件目录名兜底，缺失则标 `unknown`，不猜 |
| 7 | 品类／系列／爆款／IP 聚合是否本轮就实现，还是留到 P1 之后 | 本轮实现（DM05），否则 P1 缺少聚合底座 |
| 8 | `search_by_tag` 的标签空间用哪套：仅统一六维，还是含会员特征字典的扩展标签 | 本轮只做六维，扩展标签待数据源确认 |

### 不阻塞、后续推进

- 单元测试框架选择（node:test 或 vitest）：倾向 `node:test`，零额外依赖，贴合「不引出网依赖」约束
- 索引存储：JSON 文件 vs SQLite；倾向 JSON（万级商品量级下足够，且可读可 diff）
