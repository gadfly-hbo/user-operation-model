# P2-Model-Port

P2 规格：移植 ModelEvol v0.4／v0.6 → 工具2（属性→六维画像预测）→ 登记 model-mlflow

> 状态：**已确认**（2026-11-27）。D-P2-1 拍板为**方案 A**。
> 相关：[工程规范 §8](../../../docs/engineering-workflow.md#8-模型与依赖来源约束) · [产品讨论稿 §4.2](../../../docs/产品讨论稿-v0.1.md) · 盘点报告（只读调研，见 §2 来源说明）

---

## 1. 目标、授权与本轮交付

### 目标

按已决策的**路线 A（移植优先）**交付工具2 首版：移植 ModelEvol v0.4 的跨期验证协议与特征集、v0.6 的训练管线骨架，重训后登记 model-mlflow；Studio 训练链作为演进留口不启用。

### 本轮交付

| 交付物 | 说明 |
| --- | --- |
| 固化与溯源 | v0.6 实验／工件／25Q4 intake（归档中 untracked）固化到本项目**gitignore 区**，溯源清单入档（tracked，只含路径／哈希／日期） |
| 模型公共库 | `packages/core/src/model/`：单一 Ridge、单一指标、折内词表、特征抽取（词典外置为配置） |
| v0.4 管线移植 | 特征→训练→温度校准→跨期验证→LOO alpha 选择→泄漏门禁 |
| v0.6 管线移植 | 六阶段（prepare→folds→ablation→select→evaluate→validate），folds 冻结为输入 |
| Node 模型包导出器 | 新写：六维分布 → model-mlflow 扁平列契约；manifest `formatVersion: 1` |
| model-mlflow 登记 | 复制到 `models/<name>/vN`，校验 manifest，Stage 以 Registry 为准 |
| 黄金与复现门禁 | 固定输入→精确期望分布（容差 0）；连跑两次字节一致 |

### 授权

用户于 2026-11-27 确认开本线。**D-P2-1 未拍板前不开工 P2-4 之后的任务。**

---

## 2. 固定基线与盘点事实

盘点方式：只读调研代理对 `/Users/huangbo/Dev/Archive/ModelEvol` 与 `/Users/huangbo/Dev/Projects/model-mlflow` 逐文件核对（路径与行号证据存于调研会话，本规格只引用结论）。

### 2.1 资产位置

| 资产 | 位置（归档内） | 状态 |
| --- | --- | --- |
| v0.4 Ridge／特征／预测 | `src/capabilities/product-channel-fit/single-product-portrait-supervised.ts`（`trainRidge`:569、特征抽取:364、交叉特征选择:413、温度校准:1027/1102） | tracked |
| v0.4 跨期协议与 23 款留出 | `experiments/2026-07-11-v0.4-expanded-temporal-holdout/orchestrate.ts`（`evaluateHoldout`:292-367、`HOLDOUT_OVERLAP_IDS`:57、LOO alpha:427-540、泄漏门禁:698-703） | tracked |
| v0.4 基线数字权威源 | `artifacts/v0.4-…/artifact-manifest.json`（strict-23：top1 0.6957 / top3 0.9155 / share MAE 0.0825；`artifact_status: locked`） | tracked |
| v0.4 训练数据 | 同实验 `work-package/{train,holdout}/`（83+24 款；CSV 25 个 labelType 中仅 6 维有用，约 75% 体积无用） | tracked |
| v0.6 六阶段管线 | `experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/{01..06}-*.mts` + `lib/{core,features,train}.mts` | **untracked，须固化** |
| v0.6 工件 | `artifacts/v0.6-…/`（`lock_status: not_locked`，`oof_macro_js_lift: 0.006`） | **untracked，须固化** |
| v0.6 训练数据 | `data/incoming/2026-09-11-tmall-guanqi-25q4-portraits/`（189 文件，含 `checksums.sha256`） | **untracked，须固化** |

### 2.2 必修项（规范 §8.1 明列，盘点确认）

- **绝对路径写死 8 处**：`orchestrate.ts:40`（`/Users/huangbo/Dev/ModelEvol`）、`:43`（跨仓依赖已退役的 `pls`）等；v0.6 六脚本为仓库根相对前缀（cwd 耦合）
- **Ridge 10 份实现**（Gauss-Jordan／Cholesky／高斯消元／Gram 四族）→ 抽 1 份 Cholesky
- **CSV/XLSX 解析 16+ 份**，其中 `single-product-portrait-calibration.ts:211` 的 `line.split(",")` **无引号处理** → 全部改用本项目 `normalize/csv.ts`／`normalize/xlsx.ts`（exceljs）
- **指标 4 家族** → 抽 1 份；**`top1` 同名不同义**：v0.4 是**重叠比**、v0.6 是 **argmax 相等**，验收线定义在 v0.4 口径上
- **`xlsx@0.18.5` 高危漏洞确认在锁文件里**（归档 `package-lock.json:650-654`）→ 不继承
- **类型检查覆盖缺口**：归档 `tsconfig` 只含 `src/**/*.ts`，v0.4 orchestrate 与 v0.6 全部 `.mts` **从未被类型检查** → 本项目新包必须登记进根 `tsconfig.json` references

### 2.3 语言与导出器

- v0.4／v0.6 **均为 TypeScript/Node**，全仓零 pandas/sklearn/numpy → 「Python 训练→导出 Node」**不需要**，训练全程留 TS
- 归档**没有任何 Node 模型包导出器**（grep `predict.mjs`/`formatVersion` 零命中）→ 八部件自写：特征抽取器内嵌、系数、归一化参数（v0.6 的 mean/std 逐标签重复存了一份，可去重）、词表、后处理（v0.4 softmax+温度 与 v0.6 clip+归一 **不同，禁止合并**）、manifest、CLI 尾码（可选）
- **契约冲突**：model-mlflow 的 `usage.outputs` 是扁平标量列，而 P2 输出是六维分布 → 本规格定死：**每个 (维度,标签) 一列**，列名 `<dimension>__<label>`，写进 `usage.outputs`

### 2.4 与硬约束 §9.2 的冲突（**D-P2-1 的来源**）

- v0.4 的特征输入只有 3 个字段：`fitType`／`fabric`／**`fab`**。`fab` 是**营销卖点长文本**，属 §9.2 明令禁读的「人工 FAB 卖点」
- v0.6 的 `Sample` 另带 `mindProduct`（心智产品）、`memoryPoint`（记忆点）、`groupTag`（群组打标），同属人工判断字段。`productAttribute`（货品属性）**不在此列**——2026-11-28 用户裁定（独立复核 S1）：追认为客观属性，其实际取值为三种生命周期类标签，性质同白名单「上新类型」，不含人工判断，允许进入合规特征集；须有测试锁住取值集合，出现其它值即失败，并在 result 披露
- §9.2 白名单：品类、版型、面料、工艺、价格带、季节、上新类型、IP
- **结论**：生产模型必须剔除 `fab` 等人工字段；而 v0.4 的 0.6957 基线是**含 fab** 跑出来的 → 合规特征集下该数字不可复现，验收线必须重定义（见 D-P2-1）

### 2.5 可复现性缺口（盘点实测）

| 缺口 | 位置 | 处置 |
| --- | --- | --- |
| `trainedAt`/`generatedAt` 时间戳污染被哈希区 | v0.6 `04-select-final.mts:198`、v0.4 `supervised.ts:711` | 工件拆「确定性系数区（参与哈希）+ 溯源区（不参与）」 |
| v0.6 alpha 选择依赖样本数组顺序 | `train.mts:41` 内层折按下标轮转；顺序由 `01:72` 的 `sort(sku localeCompare)` 钉住 | 把「按 sku 排序」写成显式契约并加测试 |
| OOF 词表 ≠ 最终词表 | `features.mts:156` 的 `c < trainSamples.length` 使最终（全 93 款）特征列表与折内（74/75 款）不同 | 导出器冻结**最终**词表供运行时使用；门禁校验「OOF 词表≠最终词表」被显式记录 |
| cwd 耦合 | v0.6 六脚本的仓库根相对前缀 | 全部改为配置/CLI 注入 |

### 2.6 model-mlflow 契约（盘点确认）

- 包 = 恰好 3 文件：`predict.mjs` / `manifest.json` / `README.md`；`formatVersion` 必须为 1（读侧强校验）
- `data_sha256` 由 Host 侧对原始输入计算；登记 params 三件套 `data_sha256/rows/columns`
- 登记即 Staging；**唯一治理写动作是晋级**；`manifest.model.stage` 晋级不回写 → Stage 以 Registry 为准
- **无任何 `/predict` 端点**；消费方式仅 `import { predict }` 或 CLI → 若需 HTTP 由本项目补薄适配层，不改 Studio

---

## 3. 待拍板决策

### D-P2-1（**已确认：方案 A**，2026-11-27）· 验收线重定义

§9.2 是硬约束，`fab`／心智产品／记忆点／群组打标必须剔除，**这一点不问**。要拍板的是它的后果：

| 方案 | 内容 | 代价 |
| --- | --- | --- |
| **A（✅ 已采用）** | 验收拆两道门：① **移植忠实门**——用**原特征集**（含 fab）在归档 v0.4 数据上复现 0.6957/0.9155/0.0825（容差 0），证明移植没坏；② **生产门**——**§9.2 合规特征集**在同一跨期协议上重算基线（在归档数据上），生产模型须不低于**这个合规基线** | 合规基线数字会比 0.6957 低（fab 是有信息量的特征），需接受 |
| B | 生产门仍要求不低于 0.6957 | 合规特征集大概率达不到 → P2 门禁永远关不上，或逼人在特征上作弊 |
| C | 申请豁免 §9.2 允许 fab 进预测路径 | 违反硬约束，背对背机制失效，业务价值归零 |

### D-P2-2（规格自定，不需拍板）· 分布→扁平列

每个 (维度,标签) 一列，列名 `<dimension>__<label>`，写入 `usage.outputs`；CLI 尾码按同列名输出。

### D-P2-3（规格自定）· 用户数据到位前的登记状态

生产模型在**用户数据**上重训并通过生产门之前，只登记 **Staging / `candidate_not_locked`**，不晋级 Production；归档数据上训出的模型只作对照与忠实性证据。

---

## 4. 验收条目

| 标识 | 验收条目 |
| --- | --- |
| M01 | 固化完成：v0.6 实验（27 文件）／工件（2）／25Q4 intake（189）落到 `data/archive-modelevol/`（gitignore），`docs/modelevol-provenance.md`（tracked）登记来源路径、固化日期、逐包 sha256；**不含业务数据进 git** |
| M02 | 单一 Ridge：10 份→1 份 Cholesky（`packages/core/src/model/ridge.ts`），修掉 v0.6 的 mean/std 双算；变异「换回 Gauss-Jordan」被测试抓住 |
| M03 | 单一指标：`top1Overlap/top3Overlap`（v0.4 重叠比）与 `top1Hit`（v0.6 argmax）**不同名共存**；js/cos/shareMae/符号检验各一份；复用 `index/similarity.ts` 既有 JS/余弦，不复制 |
| M04 | 解析零新增：CSV/XLSX 全走 `normalize/csv.ts`／`normalize/xlsx.ts`；`split(",")` 引号缺陷被修复且有测试；依赖审计 0 漏洞、不引入 xlsx |
| M05 | v0.4 忠实门：原特征集在归档数据上复现 **0.6957 / 0.9155 / 0.0825（strict-23）**，容差 0；温度校准值一并移植 |
| M06 | §9.2 合规门：生产特征只含白名单字段；**测试断言特征抽取器读不到 fab/心智产品/记忆点/群组打标**（变异「把 fab 接回」必须失败） |
| M07 | 合规基线：合规特征集在归档数据上按 v0.4 协议重算，数字冻结为生产门基线 |
| M08 | v0.6 管线：六阶段可跑；folds.json 作为**输入**冻结不重生成；账号均值基线只用训练折；符号检验门槛生效；fail-closed 校验含 V9（连跑字节一致）与 V12（基线折内独立复算） |
| M09 | 导出器：3 文件包、`formatVersion: 1`、`usage.outputs` 为扁平列；固定输入→精确期望分布（容差 0）的黄金测试；连跑两次字节一致 |
| M10 | 登记：复制到 `models/<name>/vN`；manifest 校验（formatVersion/输入列/输出目标/data_sha256）；Stage 以 Registry 为准；**不修改 Studio** |
| M11 | 类型覆盖：新包登记进根 tsconfig references；移植文件全部过 strict + noUncheckedIndexedAccess |
| M12 | 不继承清单执行到位（§7）：v0.7 结论、narrow_reeval、26Q4 预测、v0.5 混合口径、v0.6 验收当达标、pls 依赖、xlsx、覆盖式画像解析 |
| M13 | 数据边界：固化数据只落 gitignore 区；溯源文档只含哈希与路径；CI 不接触归档与真实数据 |

---

## 5. 范围与不做事项

**做**：§1 交付物 + M01–M13。

**不做**：

| 不做 | 归属 |
| --- | --- |
| Studio 训练链启用 | 演进留口 |
| 修改 model-mlflow 本体 | 只消费不改造；升级需授权 |
| 26Q4 回测 | 数据未到（归档 `raw-portraits/` 为空） |
| 用户数据上的生产重训 | 待 P0 数据补齐（另立任务 P2-13） |
| HTTP 预测服务 | 需要时另立薄适配层变更 |
| v0.7 lift 建模 | 结论失败，只取其缺失语义三件（同名求和、Top-N 交集、缺失不插补） |

---

## 6. 允许修改路径

```
data/archive-modelevol/**            # gitignore：固化区
docs/modelevol-provenance.md         # tracked：溯源（只含路径/哈希/日期）
packages/core/src/model/**           # 新建：ridge / metrics / vocab / features / train / holdout-eval
packages/core/package.json           # 仅 exports 增补 "./model/*" 与 "./normalize/*" 子路径映射（2026-11-27／28 用户追认；不改源码、不改行为）
packages/core/src/normalize/portrait-md.ts   # v0.7 同名求和解析器（替换覆盖式）
packages/core/src/normalize/missing-registry.ts
packages/core/src/normalize/topn-intersect.ts
packages/tool2-portrait-predict/**   # 新建：六阶段管线 + 导出器 + 薄适配（如需）
packages/core/test/**  packages/tool2-portrait-predict/test/**
models/**                            # gitignore：登记副本（manifest 校验记录入 docs）
tsconfig.json                        # 登记新包 references
scripts/**                           # 校验与管线入口：fidelity-v04 / v06-pipeline / verify-modelevol-provenance（2026-11-28 用户追认）
package.json  package-lock.json  .gitignore   # 根脚本登记（test:fidelity-v04 / pipeline:v06）、新增工作区包的锁文件必然变化（S10 追认）与 models/ 忽略（2026-11-28 追认）
docs/match-model-baseline.md         # 冻结基线与门槛结论记录（2026-11-28 追认）
docs/engineering-workflow.md         # 仅 §7.1 增「款号口径」一行（2026-11-28 用户裁定 S7）
openspec/changes/p2-model-port/**
```

不改 `packages/core/src/match/**`、`packages/tool1-channel-match/**`、`packages/data-mcp/**`、`site/web/**`。

---

## 7. 明确不继承清单

1. v0.7 全部结论（G1 p=0.061、G2 3/5、「不建议生产采用」）与其 `narrow_reeval`（post-hoc 挑维，自注「not a new unbiased test」）
2. 26Q4 全部未回测预测与 v0.8 回测骨架的结果位
3. v0.5 全系跨平台混合口径
4. v0.6 的验收结论当达标（`oof_macro_js_lift 0.006`、`candidate_not_locked`，与 top1 验收线不是同一把尺）
5. v0.6 勘误前的 JS 手工数值（「经复算无法精确还原」）
6. v0.6 的覆盖式画像解析（丢份额）→ 换 v0.7 同名求和版
7. 抖音期标签体系（v0.6 已列 20 个抖音专属标签为污染黑名单）
8. 对 `pls` 仓的一切依赖
9. `xlsx@0.18.5`
10. 归档的 adapter/skill/command 同步体系与一切会话快照路径

**可取（方法非结论）**：v0.7 的同名标签求和、Top-N 取交集、缺失不插补、V9/V12 校验设计。

---

## 8. 任务目标执行清单

**本轮目标**：完成移植忠实门与合规基线，产出可登记的 Staging 模型包与导出器；生产重训等用户数据。

| # | 任务 | 完成条件 | 验收 | 阻塞 |
| --- | --- | --- | --- | --- |
| P2-1 | 规格与 D-P2-1 确认 | 用户拍板方案 A/B/C | **PASS**（方案 A，2026-11-27） | — |
| P2-2 | 固化与溯源 | M01 | M01/M13 | 否 |
| P2-3 | 模型公共库（ridge/metrics/vocab） | 先 RED 后 GREEN；M02/M03 | M02–M04 | 否 |
| P2-4 | v0.4 管线移植 + 忠实门 | M05 复现三数字（容差 0） | M05 | P2-2/3 |
| P2-5 | §9.2 合规特征集 + 合规基线 | M06/M07 | M06/M07 | **D-P2-1** |
| P2-6 | v0.6 六阶段移植 | M08 | M08 | P2-3 |
| P2-7 | 导出器 + 黄金测试 | M09 | M09 | P2-4/6 |
| P2-8 | model-mlflow 登记（Staging） | M10 | M10 | P2-7 |
| P2-9 | 文档与 result | 溯源、口径、未验证项齐全 | — | P2-8 |
| P2-10 | 全量检查 | 构建/单测/断网/链接/守卫/审计 | M11/M13 | P2-9 |
| P2-11 | 独立复核（SDD·TDD 独立复核者） | 覆盖 M01–M13 与 §9.2 | — | P2-10 |
| P2-12 | PR / CI / 授权 squash 合并 | — | — | P2-11 |
| P2-13 | 用户数据到位后生产重训 + 生产门 | 不低于合规基线；晋级另授权 | M07 | **P0 数据** |

**并行关系**：P2-3 与 P2-2 并行；P2-6 与 P2-4 并行（路径不重叠：v0.4 在 core/model，v0.6 在 tool2 pipeline）；P2-5 等 D-P2-1。

---

## 9. 适用检查计划

| 检查 | 方式 | 期望 |
| --- | --- | --- |
| 忠实门 | 归档数据 + 原特征集跑 v0.4 协议 | 0.6957/0.9155/0.0825，容差 0 |
| 合规门 | 白名单特征 + 同协议 | ≥ 冻结的合规基线 |
| 黄金 | 固定输入行 → 精确期望分布 | 容差 0 |
| 复现 | 连跑两次 | 系数区字节一致 |
| §9.2 | 变异「接回 fab」 | 测试失败 |
| 断网/守卫/审计/链接 | 仓库脚本 | 全过；0 漏洞；不引入 xlsx |
| 独立复核 | SDD·TDD 独立复核者 | 见 result.md |

**结果状态用词**：`PASS` / `FAIL` / `NOT_RUN` / `UNKNOWN` / `NOT_PROVED`。

---

## 10. 未决问题

| # | 问题 | 当前默认 |
| --- | --- | --- |
| D-P2-1 | 验收线重定义（合规基线 vs 原 0.6957） | **已拍板方案 A**（2026-11-27） |
| 1 | 合规基线数字（剔除 fab 后） | P2-5 实跑后冻结，先不预设 |
| 2 | 生产重训数据集 | 待 P0 数据补齐；归档数据只作对照 |
| 3 | 薄 HTTP 适配层是否需要 | 暂不需要（工具1/报表直接 import） |
