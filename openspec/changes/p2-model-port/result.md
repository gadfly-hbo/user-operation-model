# P2-Model-Port 结果记录

> 规格：[spec.md](spec.md)（状态：已确认，2026-11-27；D-P2-1 = 方案 A）
> 累计实际范围：**P2-2（固化与溯源）**、**P2-3（模型公共库）**、**P2-4（v0.4 管线移植 + 忠实门）**、**P2-5（§9.2 合规特征集 + 合规基线）**。P2-6 起未开工。
> 执行分支：`work/p2-model-port`（独立工作树 `/tmp/uom-wt-p2`）。
> 原始日志：本工作树 `.local/p2/`（该目录被 `.gitignore` 的 `*.local` 规则忽略，不入库）。

## 1. 任务状态

| # | 任务 | 状态 | 验收条目 | 说明 |
| --- | --- | --- | --- | --- |
| P2-2 | 固化与溯源 | **PASS** | M01 / M13 | 见 §2 |
| P2-3 | 模型公共库（ridge / metrics / vocab） | **PASS** | M02 / M03 | 见 §3 |
| P2-4 | v0.4 管线移植 + 忠实门 | **PASS** | M05 | 见 §4 |
| P2-5 | §9.2 合规特征集 + 合规基线 | **PASS** | M06 / M07 | 见 §5 |
| P2-6 | v0.6 六阶段移植 | **NOT_RUN** | M08 | 本轮未开工 |
| P2-7 | 导出器 + 黄金测试 | **NOT_RUN** | M09 | 本轮未开工 |
| P2-8 | model-mlflow 登记（Staging） | **NOT_RUN** | M10 | 本轮未开工 |
| P2-9 | 文档与 result | 部分完成（本文件 + 溯源文档 + 基线文档） | — | 其余随 P2-7/P2-8 |
| P2-10 | 全量检查 | 部分完成（见 §7） | M11 / M13 | 离线检查、黄金用例因环境缺数据未跑 |
| P2-11 | 独立复核 | **NOT_RUN** | — | 须由 `SDD·TDD 独立复核者` 执行，本轮作者不自评 |
| P2-12 | PR / CI / squash 合并 | **NOT_RUN** | — | 本轮不 push、不开 PR |
| P2-13 | 用户数据到位后生产重训 | **NOT_RUN** | M07 | 等 P0 数据 |

## 2. P2-2 固化与溯源（M01 / M13）

### 2.1 做了什么

| 项 | 结果 |
| --- | --- |
| 归档源（只读，未修改） | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit` |
| 固化落点 | 主仓 `/Users/huangbo/Dev/Projects/user-operation-model/data/archive-modelevol/v06-tmall-25q4/`（`.gitignore` 的 `data/*` 命中，**不入 git**） |
| 复制方式 | `cp -R`（归档 → 固化根），未改动归档任何文件 |
| 溯源文档（tracked） | `docs/modelevol-provenance.md`（只含路径／哈希／日期／文件数／体积，无业务数值） |
| 校验脚本（tracked） | `scripts/verify-modelevol-provenance.mjs`（重算固化目录哈希与文档比对，不一致退出非 0） |

固化的三个包（镜像归档相对结构）：

| 包 ID | 归档内位置 | 文件数 | 体积（字节） | 包 sha256 |
| --- | --- | --- | --- | --- |
| `v06-experiment` | `experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/` | 27 | 2310348 | `a85d6e998991354339644585fccb52e9641dea98e148f264d580cf59264e75c9` |
| `v06-artifacts` | `artifacts/v0.6-2026-09-11-tmall-guanqi-portrait-only/` | 2 | 210905 | `e12892ca223550732a66cb58696a5ea5b17a90fa92a74e4f11ff6b81df070eb6` |
| `v06-intake-25q4` | `data/incoming/2026-09-11-tmall-guanqi-25q4-portraits/` | 189 | 3480939 | `ebb20f8e42d6f6a187c218e71949f884d701ea1596ba8cec3d7abb6e6a164865` |

包 sha256 算法（文档与脚本同一实现）：包内全部文件按相对路径码位升序，每行 `<文件 sha256>  <相对路径>\n` 拼接后再取 sha256。

### 2.2 哈希比对结果

| 比对 | 结果 |
| --- | --- |
| 归档目录 ↔ 固化副本逐文件 sha256（218 文件） | **一致，0 处差异**（文件集合与内容均一致） |
| 归档 `checksums.sha256`（187 条）↔ 固化副本 | **187/187 一致，0 处差异**，无缺失条目、无无法解析行 |
| 固化落点是否进 git | 否：`git -C <主仓> status --short` 为空；`git ls-files data/` 仅 `data/README.md` |
| 归档本体是否被修改 | 否（只读复制，未写入归档） |

### 2.3 校验脚本行为（实测）

| 场景 | 命令 | 退出码 |
| --- | --- | --- |
| 正常（工作树内运行，自动定位主仓固化根） | `node scripts/verify-modelevol-provenance.mjs` | **0**（3 包 PASS，含内嵌 187 条清单一致） |
| 篡改检测（对副本追加 1 字节） | `node scripts/verify-modelevol-provenance.mjs --root <副本>` | **1**（报体积不一致 + 包 sha256 不一致） |
| 固化根不存在 | `node scripts/verify-modelevol-provenance.mjs --root <不存在路径>` | **1**（三个包均报「固化副本不存在或不可读」） |

### 2.4 明确未固化的范围（spec §7 不继承清单）

未复制：v0.7 全部、26Q4 预测实验与 26Q4 实际画像 intake、v0.8 回测骨架、v0.5 全系。
`v06-experiment` 包内 `predictions/26q4/` 随实验目录整体固化（原始来源留痕），其**结果位不继承**、不作基线或验收依据（已在溯源文档写明）。

## 3. P2-3 模型公共库（M02 / M03）

### 3.1 交付物

| 文件 | 内容 | 来源标注（工程规范 §8.1 规则 2） |
| --- | --- | --- |
| `packages/core/src/model/ridge.ts` | 单一 Cholesky Ridge 求解器 + 单一 standardize | 文件头写明归档绝对路径与逻辑行号（v0.4 `single-product-portrait-supervised.ts:542-584/675-691`、v0.6 `lib/core.mts:194-279`） |
| `packages/core/src/model/metrics.ts` | 单一指标集：JS/余弦（复用 core 既有实现）+ `shareMae` + 两套 Top-N 口径 + 符号检验 | 文件头写明 v0.6 `lib/core.mts:116-188`、v0.4 `orchestrate.ts:292-340` |
| `packages/core/src/model/vocab.ts` | 折内词表构建（minCount 外置、按名排序、eval 未见 token 映 0、OOF≠最终词表显式化） | 文件头写明 v0.6 `lib/features.mts:142-164` |
| `packages/core/test/model.test.ts` | 19 个测试（3 个 suite） | — |

未新增第三方依赖；未引入 xlsx；未改动 `packages/core/src/index/**`、`packages/core/src/match/**`、`tsconfig.json`（core 已在根 references 内，`packages/core/tsconfig.json` 的 `include` 已覆盖 `src/**/*.ts`）。

### 3.2 关键口径决定（含与两份来源的对账）

1. **求解器唯一**：v0.4「矩阵求逆 + Gauss-Jordan」与 v0.6「高斯消元」统一为 Cholesky 分解 + 前回代。α>0 时 `XᵀX+αI` 正定；α=0 且特征共线时主元抬到最小抖动，保证结果有限、不抛错。
2. **截距统一为 ȳ**：v0.4 的 `ȳ − wᵀ·mean(Z)` 与 v0.6 的 `ȳ` 在实数域等价（Z 已中心化 ⇒ `Zᵀ1=0` ⇒ `Zᵀy = Zᵀ(y−ȳ)`），差别仅 `mean(Z)≈0` 的浮点噪声。
3. **mean/std 只算一次**：`standardize` 是唯一实现，训练结果内持久化 mean/std，预测复用同一份（修掉 v0.6 的 `solveRidge` 与 `fitRidgeStandardized` 双算）。
4. **指标两套口径并存且改名**：
   - `top1Overlap` / `top3Overlap` = v0.4 重叠比（`|predicted TopN ∩ actual TopN| / |actual TopN|`，实际侧只取 `share>0`）；
   - `top1Hit` / `top3Hit` = v0.6 argmax（`top3Hit` 方向不对称：预测侧 argmax ∈ 实际侧 Top3）；
   - 两者在 Top-3 上必然不同（测试样例 2/3 vs 1），Top-1 仅在边界输入分歧（实际分布为空或只有零份额标签：0 vs 1）。
5. **JS/余弦不复制**：`metrics.ts` 直接 `import` 并再导出 `packages/core/src/index/similarity.ts` 的 `cosineSimilarity`；`jsSimilarity` 是 `1 - jensenShannonDistance` 的薄封装，metrics 文件内不出现第二份散度公式。
6. **忠实保留的一处 v0.6 行为**：`top1Hit` 对两个空分布返回 1（v0.6 `lib/core.mts:152-156` 的 `undefined === undefined`），已在代码注释与本文件标注，调用方不得传空分布。
7. **修掉的 v0.6 缺陷**：`shareMae` 空并集返回 NaN → 改为 0（v0.4 写法）；余弦空分布 NaN → 复用 core 的 0。
8. **词表偏斜显式化**：`buildFoldVocabulary` 同时返回 `foldVocab`（逐折，只用该折样本计数）与 `finalVocab`（全样本），并给出 `skew`（`onlyInFinal` / `onlyInFold`）；不做静默统一。`minCount` 为必填参数，不再写死 3。

### 3.3 RED → GREEN 证据

RED 方式：先建**只有导出签名、函数体抛 `not implemented`** 的骨架（保证断言失败是**行为失败**而非导入错误，符合工程规范 §4.3），随后写测试并实跑。

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED | `npm run build && node --test packages/core/dist/test/model.test.js` | 退出码 **1**；`tests 19 / pass 2 / fail 17`。失败项：`与手算小矩阵对照（容差 1e-9）`、`α→0 退化为 OLS`、`奇异输入不产生 NaN 也不抛错`、`standardize 对零方差列做除零保护`、`standardize 只算一次`、`Cholesky 分解可单独调用且能解回原方程`、`JS 相似度与余弦复用 core 既有实现`、`shareMae`、`top1/top3 重叠比`、`top1Hit/top3Hit 与重叠比口径不同`、`top1 两口径同值`、`signTestPValue ×2`、`词表计数只来自训练折`、`minCount 外置`、`向量值按出现次数`、`OOF≠最终词表显式化`（失败原因均为 `not implemented: <函数名>`）。通过的 2 条是结构型变异守卫（只读源码，与实现无关） |
| GREEN | 同上 | 退出码 **0**；`tests 19 / pass 19 / fail 0` |

日志：`.local/p2/red-model-test.log`、`.local/p2/green-model-test.log`。

### 3.4 变异守卫有效性（实测，非声明）

| 变异 | 期望 | 实测 |
| --- | --- | --- |
| A：`solveCholesky` 换成内联 Gauss-Jordan（奇异时抛错） | 被抓住 | `fail 1`：奇异输入不产生 NaN 也不抛错 ✗ 被抓 ✓ |
| B：换回带 `invertMatrix` 命名的 v0.4 求逆版 | 行为守卫 + 结构守卫同时抓住 | `fail 2`：奇异输入用例 + `变异守卫：源码只保留 Cholesky 一条求解路径` ✓ |
| C：metrics 内重写一份 JS 散度（`Math.log2`） | 同一性守卫 + 结构守卫同时抓住 | `fail 2`：`JS 相似度与余弦复用 core 既有实现` + `变异守卫：metrics 内没有第二份 JS/余弦实现` ✓ |

三次变异均已回滚，回滚后 `npm run build` + 19/19 通过。
说明：数值本身无法区分求解器族，故结构守卫与失败语义守卫必须并存；两者均在 `packages/core/test/model.test.ts` 内。

## 4. P2-4 v0.4 管线移植 + 忠实门（M05）

### 4.1 固化（v0.4 work-package → 主仓 gitignore 区）

| 项 | 结果 |
| --- | --- |
| 归档源（只读，未修改） | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/work-package/{train,holdout}` |
| 固化落点 | 主仓 `/Users/huangbo/Dev/Projects/user-operation-model/data/archive-modelevol/v04-holdout/work-package/{train,holdout}`（`.gitignore` 的 `data/*` 命中，**不入 git**） |
| 复制方式 | `cp -R`，**原样复制**（不做 6 维抽取的有损改写，抽取在管线内做） |
| 逐文件 sha256 比对 | **8 文件全部一致，0 处差异** |
| 包 sha256 | train `95e44e37…00be3`（4 文件 / 53 064 245 字节）、holdout `6acb1f7e…5343`（4 文件 / 13 366 971 字节） |
| 独立佐证 | 两包 `platform_portrait.csv` 的 sha256 与归档 `split-manifest.json` 登记的 `train.checksum` / `test.checksum` **逐位一致** → 固化副本就是 v0.4 当次训练／评估所读的字节 |
| 溯源登记 | `docs/modelevol-provenance.md` 新增两行包登记（tracked，只含路径／哈希／日期／文件数／体积）；`scripts/verify-modelevol-provenance.mjs` 扩展为覆盖 **5 个包** |

### 4.2 移植文件（每个文件头写明来源路径与行号，工程规范 §8.1 规则 2）

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `packages/core/src/model/features-v04.ts` | 五本词典（外置为冻结配置对象）+ `categorizeFitType` / `extractKeywords` / `mergeCounts` / `generateCombinationFeatures` / `selectFrequentCombinationFeatures` | 归档 `single-product-portrait-supervised.ts:200-464` |
| `packages/core/src/model/features-v04-compliant.ts` | §9.2 合规特征集（白名单投影 + 合规抽取） | 本项目自写（非归档移植），见 §5 |
| `packages/core/src/model/train-v04.ts` | 训练（逐维逐标签 one-vs-rest、minCombinationFreq=8、isClosed）、温度校准（候选表外置）、预测链（softmax+温度 → Top-N → closed 再归一 → round2） | 归档 `single-product-portrait-supervised.ts:657-719 / 725-853 / 1018-1113` |
| `packages/core/src/model/holdout-eval.ts` | `evaluateHoldout`（Top1/Top3 重叠比 + Share MAE + 六维宏平均） | 归档 `orchestrate.ts:292-367` |
| `packages/core/src/model/sample-package.ts` | 最小 JSONL reader + work-package 读取 + 目标份额构造 + 索引对齐 fail-closed | 归档 `single-product-portrait-calibration.ts:196-251`、`single-product-portrait-supervised.ts:590-651` |
| `packages/tool2-portrait-predict/src/pipeline/03-select-alpha.ts` | fast LOO alpha 选择 + alpha 选择规则（top1→top3→较小 alpha）+ 泄漏门禁 5 条 | 归档 `orchestrate.ts:427-540 / 695-714` |
| `packages/tool2-portrait-predict/src/pipeline/run-v04-fidelity.ts` | 编排：读固化数据 → 特征 → alpha → 温度 → 最终训练 → strict-23 评估 → 泄漏门禁 | 归档 `orchestrate.ts:547-776` |
| `packages/core/src/model/ridge.ts`（增补） | `solveCholeskyFactorized`（复用同一次 Cholesky 分解解多个右端项） | 本项目自建，扩展自同一 Cholesky 求解器 |

### 4.3 忠实门实跑数字（`npm run test:fidelity-v04`，容差 0）

| 断言 | 实测 | 归档期望 | 结论 |
| --- | --- | --- | --- |
| strict-23 top1 | 0.6957 | 0.6957 | **PASS** |
| strict-23 top3 | 0.9155 | 0.9155 | **PASS** |
| strict-23 share MAE | 0.0825 | 0.0825 | **PASS** |
| all-24 top1 / top3 / share MAE | 0.7014 / 0.9190 / 0.0830 | 同 | **PASS** |
| 选中 alpha | 50 | 50 | **PASS** |
| 训练样本数 | 83 | 83 | **PASS** |
| 特征数 / 交叉特征数 | 156 / 94 | 156 / 94 | **PASS** |
| 温度六值 | 性别 0.4／年龄段 0.2／消费能力 0.4／城市等级 0.2／消费群体 0.2／人生阶段 0.4 | 同（`experiment-record.md:62`） | **PASS** |
| 泄漏门禁 | 5/5 pass | 5/5 pass | **PASS** |

容差口径：归档权威源 `artifact-manifest.json` 按 **4 位小数**登记，忠实门按 `toFixed(4)` 逐位比对（容差 0）。

补充证据：移植后的特征抽取与归档 `extractBaseSupervisedFeatures` 在 **107 个样本**（83 训练 + 24 留出）上
逐键比对**0 差异**，交叉特征名单（train 94 个 / holdout 4 个）**逐位一致**。

### 4.4 RED → GREEN 证据

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED（core/model/v04） | `npm run build && node --test --test-reporter=tap packages/core/dist/test/model-v04.test.js` | 退出码 **1**；`tests 30 / pass 19 / fail 11`，失败原因均为 `not implemented: <函数名>`（**行为失败**，非导入/环境失败） |
| GREEN（同上） | 同上 | 退出码 **0**；`tests 30 / pass 30 / fail 0` |
| RED（ridge 增补） | `node --test --test-reporter=tap packages/core/dist/test/model.test.js` | 退出码 **1**；`tests 21 / pass 19 / fail 2`，失败原因 `not implemented: solveCholeskyFactorized` |
| GREEN（同上） | 同上 | 退出码 **0**；`tests 21 / pass 21 / fail 0` |
| RED（tool2 管线） | `node --test --test-reporter=tap packages/tool2-portrait-predict/dist/test/pipeline.test.js` | 退出码 **1**；`tests 19 / pass 9 / fail 10`，失败原因 `not implemented: selectAlpha / runLeakageGate` |
| GREEN（同上） | 同上 | 退出码 **0**；`tests 19 / pass 19 / fail 0` |

日志：`.local/p2/red-model-v04-test.log`、`red-ridge-factorized.log`、`red-tool2-pipeline.log`
及对应 `green-*.log`（`.local/` 被 `.gitignore` 忽略，不入库）。

### 4.5 移植口径决定（含**一处必须知悉的归档缺陷修正**）

1. **求解器唯一**：训练与 LOO alpha 选择都走 `packages/core/src/model/ridge.ts` 的 Cholesky
   （`fitRidge` / `choleskyFactor` + `solveCholeskyFactorized`），**未自带第二份求解器**。
   实测：Cholesky 解出的权重与归档 Gauss-Jordan 工件的最大绝对差 **3.05e-16**，
   但 strict-23 三数字**逐位相同**（容差 0 成立）。
2. **截距统一为 ȳ**（P2-3 §3.2 第 2 条的既定口径）：忠实门容差 0 **通过**，未触发回退到归档写法。
3. **CSV 解析统一走 `packages/core/src/normalize/csv.ts`**：修掉归档 `line.split(",")` 无引号处理的错列缺陷
   （新增用例：标签值含逗号时仍解析为一个字段）。
4. **JSONL reader 收敛为一处**（`sample-package.ts` 的 `readJsonl`），加测试（BOM／空行／逐行解析）。
5. **目标份额索引对齐 fail-closed**：归档把缺失 (样本,标签) 的 0 补在**数组末尾**（会导致份额与样本错位）。
   本项目照搬该语义以保忠实，同时加 `assertTargetAlignment` 前置校验：固化数据上 6 维 × 全部标签均对齐
   （逐标签取值数 = 83），因此错位未发生；一旦不对齐即抛错而非错位训练。
6. **★ 归档 fast LOO 的线性求解是错的（已修）**：归档 `orchestrate.ts:405-414` 的 `backwardSubstitution`
   累加项写作 `lt[i][k] * x[k]`，而 Cholesky 因子只填了下三角、上三角恒为 0，
   于是该累加项恒为 0，回代退化成「只除以对角元」。实测证据：同一 (A, rhs) 下，
   归档路径解出的权重残差 ‖A·w − rhs‖∞ ≈ **16.4**，正确解残差 ≈ **7e-15**。
   **后果**：归档登记的 `loo_results`（含 `split-manifest.json`）在数值上无效。
   本移植改用本项目唯一 Cholesky 求解器并让 LOO 打分与最终模型统一（截距 ȳ），
   因此 **LOO 各 alpha 的具体数值与归档不同**；但**选中的 alpha 仍是 50**（忠实门断言项），
   且最终三数字不受影响——最终模型走 `trainSupervisedPortraitModel`，不经过 LOO 路径。
   该修正已在 `03-select-alpha.ts` 文件头与 `docs/match-model-baseline.md` §6 写明。

---

## 5. P2-5 §9.2 合规特征集 + 合规基线（M06 / M07）

### 5.1 白名单与禁读字段

| 白名单（读） | 归档 v0.4 属性字段 | 抽取方式 |
| --- | --- | --- |
| 版型 | `fitType` | 复用归档 `FIT_TYPE_CATEGORIES` 归类 → `fit_*` |
| 面料 | `fabric` | 复用归档 `FABRIC_KEYWORDS` → `fabric_*` |
| 品类 | `category` / `subCategory` | 归一化取值 → `cat_*` / `cat_sub_*`（同组，不互为交叉） |
| 季节 | `season` | → `season_*` |
| 上新类型 | `productLifecycle` | → `lifecycle_*` |
| IP | `ipCollaboration` | → `ip_*` |
| 工艺/材质 | `specialFunctionOrMaterial` | 按分隔符拆原子词 → `craft_*` |

禁读字段：`fab`（人工 FAB 卖点）、`mentalProduct`（心智产品）、`memoryPoint`（记忆点）、`groupTag`（群组打标）。

### 5.2 三层守卫（M06）

| 层 | 手段 | 结果 |
| --- | --- | --- |
| 类型层 | `V04CompliantProductInput` 的字段集合里**不存在**禁读字段；测试文件里用 `Extract<ForbiddenField, keyof TInput> extends never ? true : never` 做**编译期断言** | 编译期即阻断越界 |
| 投影层 | `projectCompliantInput` 是人工字段进入下游的**唯一**入口，按白名单逐字段挑选 | 运行时白名单 |
| 行为层 | ① 输入里塞入不同 `fab` → 合规特征必须**完全一致**；② 抽取器源码**不得出现** `.fab` / `['fab']` 等访问（结构守卫，去注释与字符串字面量后检查） | 变异「把 fab 接回抽取器」→ 测试失败 |

交叉特征只在白名单组内生成（分组前缀 `fit_` / `fabric_` / `cat_` / `season_` / `lifecycle_` / `ip_` / `craft_`）。

### 5.3 合规基线（实跑冻结，容差 0）

同一 v0.4 跨期协议（同 split、同 alpha 选择规则、同温度校准流程）下重算 strict-23：

| 指标 | 合规基线 | 原特征集基线（仅对照） |
| --- | --- | --- |
| top1 | **0.7754** | 0.6957 |
| top3 | **0.9300** | 0.9155 |
| share MAE | **0.0759** | 0.0825 |
| 选中 alpha | 50 | 50 |
| 特征数 / 交叉特征数 | 117 / 42 | 156 / 94 |

两组数字已冻结进 `scripts/fidelity-v04.mjs` 的**第二组断言**与新建的 `docs/match-model-baseline.md`。

### 5.4 差异解释（与 spec §10 预期相反，已如实记录）

P2 规格 §10 预期「合规基线数字会比 0.6957 低（fab 是有信息量的特征）」，**实测合规基线更高**。
经核对归档数据，原因是：归档 24 款留出商品的 `category` / `subCategory` / `season` /
`productLifecycle` / `ipCollaboration` / `specialFunctionOrMaterial` **全部为空**
（原始 `product_attributes.jsonl` 即如此），因此合规模型在留出集上实际只用得到**版型 + 面料**；
同时 FAB 长文本在 83 行样本上贡献了 94 个高维稀疏交叉特征、易过拟合
（`八大消费群体` Top1 0.3478 → 0.6957，`城市等级` Top1 0.3478 → 0.3913）。
逐维明细与「生产门以合规基线为准」的结论见 `docs/match-model-baseline.md` §3。

**该结论不构成放宽验收**：生产门仍以冻结的合规基线 **0.7754 / 0.9300 / 0.0759** 为门槛；
且该基线是在留出集缺白名单字段的口径下测得，不能外推到字段齐全的数据（须随 P2-13 重算）。


## 6. 未做项与本轮边界

- **P2-6 起全部未开工**（v0.6 六阶段、导出器、model-mlflow 登记、黄金用例、文档收尾、独立复核、PR）。
- **P2-4／P2-5 范围内未做**：P2-7 的 Node 模型包导出器与固定输入黄金用例（属 P2-7）、model-mlflow 登记（属 P2-8）、
  生产数据重训与晋级（属 P2-13）。
- 未改 `packages/core/src/index.ts`：`packages/core/src/index/**` 不在 spec §6 允许修改路径内，故 `model/*` 仍未从包根再导出；
  新包通过 `@uom/core/model/*` 子路径导入（见 §8 第 8 条）。
- 未新增依赖、未引入 xlsx、未触碰 `packages/core/src/match/**`、`packages/tool1-channel-match/**`、`packages/data-mcp/**`、`site/web/**`。
- 忠实门与合规基线均在**归档固化数据**上跑通；用户真实数据路径尚未验证（工程规范 §4.4 的「工具2 模型」行属 P2-13）。

## 7. 适用检查结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | **PASS**（退出码 0，`strict` + `noUncheckedIndexedAccess` 无报错；新包已登记进根 tsconfig references） |
| 单测（全量） | `npm test` | **PASS**（退出码 0；`tests 274 / pass 274 / fail 0`，含本轮新增 51 条：core/model-v04 30 + ridge 增补 2 + tool2 管线 19） |
| 忠实门 | `npm run test:fidelity-v04` | **PASS**（退出码 0；第一组移植忠实性容差 0 全过 + 第二组合规基线全过；泄漏门禁 5/5 × 2 组） |
| 溯源校验 | `node scripts/verify-modelevol-provenance.mjs` | **PASS**（退出码 0；**5 包**一致，含 v0.4 两包 + 内嵌 187 条清单一致） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（检查 99 条相对链接，错误 0，告警 0） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（索引中无业务数据目录、数据文件或超大文件） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（found 0 vulnerabilities） |
| 断网自检 | `npm run offline-check` | **NOT_RUN**（守卫自检段通过：13 个出网入口全部被拦截并归因；后续 `offline-e2e` 段因工作树 `data/` 无 `domains`/`source` 子目录，MCP server 启动失败而中断——工作树无真实业务数据，按发单要求记 NOT_RUN） |
| 工具1 黄金用例 | `npm run test:golden` | **NOT_RUN**（缺 `UOM_REFERENCE_ROOT`，抖音参考数据不在本机环境；本轮未触及匹配内核，但本轮扩展了 `packages/core/src/model/ridge.ts`，按规范 §9.3 仍建议在有参考数据的环境补跑） |
| CI | — | **NOT_RUN**（本轮不 push、不开 PR） |
| 独立复核 | — | **NOT_RUN**（须由未参与本候选的 `SDD·TDD 独立复核者` 执行；作者不自评） |
| 真实数据路径验证 | — | **NOT_RUN**（工程规范 §4.4：真实商品属性 → 预测画像 → 匹配全链路属 P2-13；本轮跑的是**归档固化数据**上的模型链路，非用户真实数据） |
| 归档只读性 | `git -C /Users/huangbo/Dev/Archive/ModelEvol status --short` | **PASS**（归档工作树无源码/数据改动，仅原有 `.DS_Store` 噪声；本轮全程只读） |

## 8. 与 spec 的偏差 / 需要决定的事项

1. **模型公共库范围略窄于 spec §1 交付物表述**：spec §1 写「单一 Ridge、单一指标、折内词表、特征抽取（词典外置为配置）」，本轮按发单只交付前 3 件；「特征抽取」与「词典外置为配置」留待 P2-4／P2-6。**需用户确认**：是否把「特征抽取」单列为 P2-3 的缺口。
2. **`jsSimilarity` 以薄封装形式落在 metrics.ts**：`packages/core/src/index/similarity.ts` 本身没有 `jsSimilarity` 函数（现有 `jsSimilarity` 是 `diffPortraits` 产出的字段），而该文件不在允许修改路径内，故 metrics 以 `1 - jensenShannonDistance` 封装实现。若要求 core 侧也导出 `jsSimilarity`，需追加该路径授权。
3. **截距口径统一为 ȳ**（见 §3.2 第 2 条）。P2-4 的忠实门若出现「容差 0」不通过，优先怀疑此处（`mean(Z)≈0` 的浮点差），届时需以证据决定是否加回 v0.4 的写法。
4. **`top1Hit` 保留 v0.6 空分布返回 1 的行为**（见 §3.2 第 6 条）。若独立复核认为该行为应改为 0，需要同步改测试与 v0.6 管线口径。
5. **`v06-experiment` 27 个文件含 1 个 macOS `.DS_Store`**（内容文件 26）。保留是为与归档目录逐字节一致、可复核；若独立复核认为应剔除，需重算包 sha256 并更新溯源文档。
6. **固化落点在主仓而非工作树**：按发单固化到主仓 gitignore 区，工作树 `data/` 为空；校验脚本用 `git rev-parse --git-common-dir` 定位主仓，不写死本机绝对路径。若主仓目录结构变化，需同步脚本的 `FIXED_ROOT_RELATIVE`。
7. **`.local/` 证据目录不入库**：仓库 `.gitignore` 的 `*.local` 规则匹配到 `.local` 目录本身，证据日志保持未跟踪；本文件中的命令与结论是持久证据。
8. **★ 越界一处，需用户确认**：`packages/core/package.json` 的 `exports` 增加了 `"./model/*"` 子路径映射。
   原因：P2-4/P2-5 要求新包 `packages/tool2-portrait-predict/` 调用 P2-3 的 `packages/core/src/model/ridge.ts`
   （**不得自带第二份求解器**），而 core 包根未导出 `model/*`、`packages/core/src/index.ts` 又不在 spec §6 允许修改路径内。
   该改动**只增加一个子路径导出映射，不改任何源码、不改匹配内核、不改行为**。
   若不接受，替代方案是追加 `packages/core/src/index.ts` 的修改授权并改为包根导出。
9. **★ 溯源脚本的固化根语义放宽**：`scripts/verify-modelevol-provenance.mjs` 的 `FIXED_ROOT_RELATIVE`
   由 `data/archive-modelevol/v06-tmall-25q4` 改为 `data/archive-modelevol`（**总根**），
   各包在文档里登记相对路径（`v06-tmall-25q4/...`、`v04-holdout/...`）。物理目录位置不变；
   `--root` 参数语义随之从「v06 包根」变为「归档固化总根」。原 P2-2 的 3 包仍逐位校验通过。
10. **归档 LOO alpha 选择指标数值无效（已修，见 §4.5 第 6 条）**：本移植不复刻归档的错误回代。
    忠实门断言的是**选中 alpha = 50**（仍成立）与最终三数字（不受影响），**不**断言归档的 `loo_results` 数值。
    若独立复核要求逐值对齐归档 `split-manifest.json` 的 `loo_results`，则必须先确认是否要复刻一个已知错误的求解路径。
11. **合规基线高于原特征集基线（与 spec §10 预期相反）**：已在 §5.4 与 `docs/match-model-baseline.md` §3 写明原因
    （归档留出集缺白名单字段 + FAB 文本特征高维易过拟合）。生产门仍以合规基线为门槛，**不放宽**。
12. **合规模型的留出集输入被降级**：归档 24 款留出商品的品类／季节／上新类型／IP／工艺字段全为空，
    合规模型在这些字段上只能取默认值。该基线**不能外推**到字段齐全的数据（须随 P2-13 重算）。

## 9. 交付清单

新增（tracked）：

- `docs/modelevol-provenance.md`（P2-2 创建；本轮扩展 v0.4 两包登记）
- `docs/match-model-baseline.md`（本轮新建：两组基线、口径、差异解释、限制）
- `scripts/verify-modelevol-provenance.mjs`（P2-2 创建；本轮扩展为 5 包）
- `scripts/fidelity-v04.mjs`（本轮新建：移植忠实门 + 合规基线两组断言）
- `packages/core/src/model/ridge.ts`（P2-3 创建；本轮增补 `solveCholeskyFactorized`）
- `packages/core/src/model/metrics.ts`、`vocab.ts`（P2-3 创建）
- `packages/core/src/model/features-v04.ts`（本轮新建）
- `packages/core/src/model/features-v04-compliant.ts`（本轮新建）
- `packages/core/src/model/sample-package.ts`（本轮新建）
- `packages/core/src/model/train-v04.ts`（本轮新建）
- `packages/core/src/model/holdout-eval.ts`（本轮新建）
- `packages/core/test/model.test.ts`（P2-3 创建；本轮增补 2 条）
- `packages/core/test/model-v04.test.ts`（本轮新建，30 条）
- `packages/tool2-portrait-predict/`（本轮新建包：`package.json` / `tsconfig.json` / `src/index.ts` / `src/pipeline/03-select-alpha.ts` / `src/pipeline/run-v04-fidelity.ts` / `test/pipeline.test.ts`，19 条）
- `tsconfig.json`（本轮登记新包 references）、`package.json`（本轮新增 `test:fidelity-v04`）
- `packages/core/package.json`（本轮增补 `exports["./model/*"]`，见 §8 第 8 条）
- `openspec/changes/p2-model-port/result.md`（本文件）

固化数据（**不在 git**，位于主仓 `data/archive-modelevol/`）：

| 包 | 文件数 | 体积（字节） |
| --- | --- | --- |
| `v06-tmall-25q4/`（3 包合计） | 218 | 6 002 192 |
| `v04-holdout/work-package/train` | 4 | 53 064 245 |
| `v04-holdout/work-package/holdout` | 4 | 13 366 971 |
