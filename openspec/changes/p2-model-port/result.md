# P2-Model-Port 结果记录

> 规格：[spec.md](spec.md)（状态：已确认，2026-11-27；D-P2-1 = 方案 A）
> 累计实际范围：**P2-2（固化与溯源）**、**P2-3（模型公共库）**、**P2-4（v0.4 管线移植 + 忠实门）**、**P2-5（§9.2 合规特征集 + 合规基线）**、**P2-6（v0.6 六阶段移植）**、**P2-7（模型导出器 + 黄金测试）**、**P2-8（model-mlflow 登记，Staging）**。P2-11 起未开工。
> 执行分支：`work/p2-model-port`（独立工作树 `/tmp/uom-wt-p2`）。
> 原始日志：本工作树 `.local/p2/`（该目录被 `.gitignore` 的 `*.local` 规则忽略，不入库）。
> **证据丢失说明（2026-11-28）**：本工作树曾被 /tmp 清理删除后由主 agent 重建——git 提交完好，
> 但 `.local/` 内**前几轮的 RED 失败日志随工作树清理丢失、不可复得**；`models/`（模型包）已由
> `npm run pipeline:v06` 重跑再生（V9 系数区 sha256 逐位复现，见 §12.1）。
> 历史 RED 不补造记录，其结论以本文件当时记录的命令与计数为凭（§3.3／§4.4／§10.5）；
> 本轮（第四单）新写的测试有本轮真实 RED 留档（§12.2、`.local/p2/red-gate-conclusion.log`）。
> **第五轮（2026-11-28，复核修单）**：按 [review-p2.md](review-p2.md)（独立复核，结论 FAIL）完成 B1–B4／S1–S5／建议项修单，
> 全部新测试先取真 RED 留档于 `.local/p2/fix-review/`，处置与证据见 §14；模型包升版 v2 并登记（§8 第 25 条）。

## 1. 任务状态

| # | 任务 | 状态 | 验收条目 | 说明 |
| --- | --- | --- | --- | --- |
| P2-2 | 固化与溯源 | **PASS** | M01 / M13 | 见 §2 |
| P2-3 | 模型公共库（ridge / metrics / vocab） | **PASS** | M02 / M03 | 见 §3 |
| P2-4 | v0.4 管线移植 + 忠实门 | **PASS** | M05 | 见 §4 |
| P2-5 | §9.2 合规特征集 + 合规基线 | **PASS** | M06 / M07 | 见 §5 |
| P2-6 | v0.6 六阶段移植 | **PASS**（管线）／门槛未达标（如实记录） | M08 | 见 §10 |
| P2-7 | 导出器 + 黄金测试 | **PASS** | M09 | 见 §11 |
| P2-8 | model-mlflow 登记（Staging） | **PASS**（v1/v2 均 Staging；门槛未过如实入账，不得晋级） | M10 | 见 §12 |
| P2-9 | 文档与 result | **PASS**（本轮交付物齐全：本文件 + 溯源文档 + 基线文档 + 门槛结论入档 + 复核修单章 §14；复核 S8 状态词已改用标准词汇） | — | 后续文档维护随修复轮进行 |
| P2-10 | 全量检查 | 见 §7（前四轮 + **第五轮·复核修单** §7.3；断网自检 NOT_RUN，原因见 §7／§13.4） | M11 / M13 | 见 §7／§13.4 |
| P2-11 | 独立复核 | **PASS**（2026-11-28 由未参与候选的 `SDD·TDD 独立复核者` 完成，结论 **FAIL**（阻断 B1–B4），报告 [review-p2.md](review-p2.md)；修单见 §14，由主 agent 另派实现子代理完成、待独立复核者重验受影响范围） | — | [review-p2.md](review-p2.md) |
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
| 行为层 | ① **绕过投影层**直接喂抽取器：只差 `fab`（**有／无两种**）的原始输入特征必须完全一致（复核修单 B4 强化，杀「存在指示」型变异）；② 抽取器源码**不得以任何访问形态**出现人工字段——点号／`['fab']`／模板键／`in` 检查（方括号等形态在剥字符串字面量**之前**的源码上匹配，复核修单 B4）；③ 产出特征名必须可归属到白名单特征组（复核修单 B4） | 变异「把 fab 接回抽取器」→ 测试失败（三个存活变异重放全 KILLED，见 §14.2） |

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

- **P2-8 起全部未开工**（model-mlflow 登记、文档收尾、独立复核、PR、用户数据上的生产重训与晋级）。
- **P2-4／P2-5 范围内未做**：P2-7 的 Node 模型包导出器与固定输入黄金用例（属 P2-7）、model-mlflow 登记（属 P2-8）、
  生产数据重训与晋级（属 P2-13）。其中 **P2-7 已于本轮交付**（见 §11）。
- **P2-6／P2-7 范围内未做**：归档 v0.6 工件（`v06-artifacts`）与 26Q4 预测结果位的**继承**——
  按 spec §7 第 4／5 条不继承，本轮只固化参考、不引用其结论；
  v0.6 的 HTML 评估报告未移植（不在 P2 验收条目内）；folds 分层未重做（按 M08 冻结输入消费）。
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

### 7.1 P2-6 / P2-7 一轮（本轮追加）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | **PASS**（退出码 0；新增 12 个 TS 文件全部过 `strict` + `noUncheckedIndexedAccess`） |
| 单测（全量） | `npm test` | **PASS**（退出码 0；`tests 317 / pass 317 / fail 0`；本轮新增 **43** 条：core/portrait-md 5 + tool2/v06 管线 26 + 导出器 12） |
| v0.6 六阶段实跑 | `npm run pipeline:v06` | **PASS**（退出码 0；阶段 01–06 全部跑通，阶段 06 的 **12 条 fail-closed 校验全部 pass**；门槛 1/2/4 的**模型质量**结论为 FAIL，如实记录） |
| 忠实门（回归） | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | **PASS**（退出码 0；本轮未触碰 v0.4 管线，三数字容差 0 仍全过） |
| 溯源校验（回归） | `node scripts/verify-modelevol-provenance.mjs` | **PASS**（退出码 0；5 包一致） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（99 条相对链接，错误 0，告警 0） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（索引中无业务数据目录、数据文件或超大文件；`models/` 已加入 `.gitignore`） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（found 0 vulnerabilities；**未新增任何依赖**，未引入 xlsx） |
| 断网自检 | `npm run offline-check` | **NOT_RUN**（守卫自检段通过：13 个出网入口全部被拦截并归因；后续 `offline-e2e` 段因工作树 `data/` 无 `domains`/`source` 子目录，MCP server 启动失败而中断——与前两轮同因，按发单要求记 NOT_RUN，不记 PASS） |
| 工具1 黄金用例 | `npm run test:golden` | **NOT_RUN**（缺 `UOM_REFERENCE_ROOT`；本轮未触及 `packages/core/src/match/**` 评分逻辑） |
| CI | — | **NOT_RUN**（本轮不 push、不开 PR） |
| 独立复核 | — | **NOT_RUN**（须由未参与本候选的 `SDD·TDD 独立复核者` 执行；作者不自评） |
| 真实数据路径验证 | — | **NOT_RUN**（工程规范 §4.4：真实商品属性 → 预测画像 → 匹配全链路属 P2-13；本轮跑的是**归档固化数据**） |
| 归档只读性 | `git -C /Users/huangbo/Dev/Archive/ModelEvol status --short` | **PASS**（归档工作树无源码/数据改动；本轮全程只读） |

### 7.2 第四单一轮（2026-11-28：归位重构 + 门槛结论入包 + P2-8 登记，本轮追加）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | **PASS**（退出码 0；`strict` + `noUncheckedIndexedAccess` 无报错） |
| 单测（全量） | `npm test` | **PASS**（退出码 0；`tests 324 / pass 324 / fail 0`；本轮新增 7 条门槛结论用例） |
| 忠实门（回归） | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | **PASS**（退出码 0；两组数字容差 0 逐位复现：0.6957/0.9155/0.0825 与 0.7754/0.9300/0.0759，泄漏门禁 5/5 × 2 组；**未改动任何冻结数字**） |
| v0.6 六阶段实跑 | `npm run pipeline:v06` | **PASS**（退出码 0；V9 系数区 sha256 `79669a0f30938c0b…` 与 V4 冻结 folds `2ca273cb2a2b14df…` 归位重构后**逐位不变**；12 条校验全 PASS；门槛结论 FAIL_NOT_POSITIVE 如实复现） |
| 溯源校验 | `node scripts/verify-modelevol-provenance.mjs` | **PASS**（退出码 0；5 包一致） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（99 条相对链接，错误 0，告警 0） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（索引中无业务数据目录、数据文件或超大文件） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（found 0 vulnerabilities；本轮未新增任何依赖） |
| 断网自检 | `npm run offline-check` | **NOT_RUN**（守卫自检段 PASS：13 个出网入口全部被拦截并归因；`offline-e2e` 段因工作树 `data/` 无 `domains`/`source` 子目录失败——与前几轮同因，工作树无真实业务数据，按发单要求记 NOT_RUN，不把守卫段局部通过写成整体通过） |
| 工具1 黄金用例 | `npm run test:golden` | **NOT_RUN**（缺 `UOM_REFERENCE_ROOT`；本轮未触及 `packages/core/src/match/**` 评分逻辑） |
| model-mlflow 登记 | `node scripts/register-model-mlflow.mjs`（本地账本 127.0.0.1:5021） | **PASS**（`uom-tool2-portrait-v06` **v1** · Staging · READY；run `eb3855e624c5439d9829ca840510c6d3` FINISHED；门槛结论入 run params；读回核对与包字节三方一致；详见 §12） |
| CI | — | **NOT_RUN**（本轮不 push、不开 PR） |
| 独立复核 | — | **NOT_RUN**（须由未参与本候选的 `SDD·TDD 独立复核者` 执行；作者不自评；P2-11 由主 agent 另派） |
| 真实数据路径验证 | — | **NOT_RUN**（工程规范 §4.4：真实商品属性 → 预测画像 → 匹配全链路属 P2-13；本轮跑的是**归档固化数据**） |
| 归档只读性 | `git -C /Users/huangbo/Dev/Archive/ModelEvol status --short` | **PASS**（仅原有 `.DS_Store` 噪声，无源码/数据改动；本轮全程只读） |
| model-mlflow 只读性 | `git -C <model-mlflow> status --short` | **PASS**（登记后其 git 工作树干净——账本 store `workspace/mlflow/` 与交付 `workspace/exports/` 均为该仓 gitignore 区，未触碰其代码本体/配置/既有条目） |

### 7.3 第五轮·复核修单（2026-11-28，本轮追加）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | **PASS**（退出码 0；`strict` + `noUncheckedIndexedAccess` 无报错） |
| 单测（全量） | `npm test` | **PASS**（退出码 0；`tests 436 / pass 436 / fail 0`；较上轮 +24：复核修单 B2／B3／S1–S5／B4 守卫与建议项新测试） |
| `npm run check` | `npm run check` | **PASS**（build + test 全绿） |
| 忠实门（回归） | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | **PASS**（退出码 0；两组数字容差 0 逐位复现：0.6957/0.9155/0.0825 与 0.7754/0.9300/0.0759，泄漏门禁 5/5 × 2 组；**冻结数字未改动**） |
| v0.6 六阶段实跑 | `npm run pipeline:v06` | **PASS**（退出码 0；阶段 01–06 跑通，V1–V12 全 PASS；**V4 冻结 folds `2ca273cb2a2b14df…`、V9 系数区 `79669a0f30938c0b…` 与修单前逐位一致**；V10 首次带真实逐折断言、V12 首次真独立复算；模型包导出 **v2**） |
| 溯源校验 | `node scripts/verify-modelevol-provenance.mjs` | **PASS**（退出码 0；5 包一致，含 187 条内嵌清单） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（118 条相对链接，错误 0，告警 0） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（索引中无业务数据目录、数据文件或超大文件） |
| **归档内容守卫（本轮新增）** | `npm run check:archive-content` | **PASS**（黑名单 85 条运行时取自固化区、不入库；扫描 tracked 文本 172 个，0 命中；同一守卫在修单前对旧夹具**命中 1 处**——RED 证据 `.local/p2/fix-review/red-b1-guard.log`） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（found 0 vulnerabilities；本轮未新增任何依赖） |
| model-mlflow 登记 v2 | `node scripts/register-model-mlflow.mjs --package models/uom-tool2-portrait-v06/v2`（本地账本 127.0.0.1:5021，用后已停） | **PASS**（v2 · Staging · READY，run `abd1e4270fae4c4a83dd68cdfb200cfe`；v1 不动；S5 守卫实测拒绝非回环 `--url http://example.com:8080`） |
| 断网自检 | `npm run offline-check` | **NOT_RUN**（工作树 `data/` 无真实业务数据，MCP server 启动失败——与前几轮同因，不为变绿拷数据） |
| 工具1 黄金用例 | `npm run test:golden` | **NOT_RUN**（缺 `UOM_REFERENCE_ROOT`；本轮未触及 `packages/core/src/match/**` 评分逻辑） |
| CI | — | **NOT_RUN**（本轮不 push、不开 PR） |
| 归档只读性 | `find /Users/huangbo/Dev/Archive/ModelEvol -newermt 2026-11-26 -type f`（排除 .DS_Store/.qoder） | **PASS**（0 个文件，与复核命令 11 基线一致；本轮全程只读） |
| model-mlflow 只读性 | `git -C <model-mlflow> status --short` | **PASS**（v2 登记后仍干净；账本与 exports 均在其 gitignore 区） |

## 8. 与 spec 的偏差 / 需要决定的事项

1. **模型公共库范围略窄于 spec §1 交付物表述**：spec §1 写「单一 Ridge、单一指标、折内词表、特征抽取（词典外置为配置）」，本轮按发单只交付前 3 件；「特征抽取」与「词典外置为配置」留待 P2-4／P2-6。**需用户确认**：是否把「特征抽取」单列为 P2-3 的缺口。
2. **`jsSimilarity` 以薄封装形式落在 metrics.ts**：`packages/core/src/index/similarity.ts` 本身没有 `jsSimilarity` 函数（现有 `jsSimilarity` 是 `diffPortraits` 产出的字段），而该文件不在允许修改路径内，故 metrics 以 `1 - jensenShannonDistance` 封装实现。若要求 core 侧也导出 `jsSimilarity`，需追加该路径授权。
3. **截距口径统一为 ȳ**（见 §3.2 第 2 条）。P2-4 的忠实门若出现「容差 0」不通过，优先怀疑此处（`mean(Z)≈0` 的浮点差），届时需以证据决定是否加回 v0.4 的写法。
4. **`top1Hit` 保留 v0.6 空分布返回 1 的行为**（见 §3.2 第 6 条）。若独立复核认为该行为应改为 0，需要同步改测试与 v0.6 管线口径。
5. **`v06-experiment` 27 个文件含 1 个 macOS `.DS_Store`**（内容文件 26）。保留是为与归档目录逐字节一致、可复核；若独立复核认为应剔除，需重算包 sha256 并更新溯源文档。
6. **固化落点在主仓而非工作树**：按发单固化到主仓 gitignore 区，工作树 `data/` 为空；校验脚本用 `git rev-parse --git-common-dir` 定位主仓，不写死本机绝对路径。若主仓目录结构变化，需同步脚本的 `FIXED_ROOT_RELATIVE`。
7. **`.local/` 证据目录不入库**：仓库 `.gitignore` 的 `*.local` 规则匹配到 `.local` 目录本身，证据日志保持未跟踪；本文件中的命令与结论是持久证据。
8. **★ 越界一处，已获用户授权追认（2026-11-27）**：`packages/core/package.json` 的 `exports` 增加了 `"./model/*"` 子路径映射；spec §6 允许路径已同步登记该文件。
   原因：P2-4/P2-5 要求新包 `packages/tool2-portrait-predict/` 调用 P2-3 的 `packages/core/src/model/ridge.ts`
   （**不得自带第二份求解器**），而 core 包根未导出 `model/*`、`packages/core/src/index.ts` 又不在 spec §6 允许修改路径内。
   该改动**只增加一个子路径导出映射，不改任何源码、不改匹配内核、不改行为**。
   用户已选择**追认保留**；替代方案（追加 `packages/core/src/index.ts` 授权改为包根导出）不采用。
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
13. **★ 画像 Markdown 解析器的落位与 spec §6 不同（需裁定）**：spec §6 把「v0.7 同名求和解析器」登记在
    `packages/core/src/normalize/portrait-md.ts`，本轮实际落在 **`packages/core/src/model/portrait-md.ts`**。
    原因：`packages/core/package.json` 的 `exports` 目前只开放 `"."` 与 `"./model/*"`（2026-11-27 用户授权范围），
    `packages/core/src/index.ts` 又不在 spec §6 允许修改路径内，工具2 无法 `import '@uom/core/normalize/portrait-md'`；
    落在 `model/` 下即可用**已获授权**的 `./model/*` 子路径引用，无需新增授权。
    **需裁定**：是否追认该落位；或授权把 `"./normalize/*"` 加入 core 的 exports 并把文件移回 `normalize/`（本项目建议后者，归位更符合 spec 意图）。
    **【处置 2026-11-28，用户裁定一】已归位**：文件移回 spec 指定的 `packages/core/src/normalize/portrait-md.ts`，
    `packages/core/package.json` 追加 `exports["./normalize/*"]`（与第 8 条同一追认模式，spec §6 已同步登记）；
    行为不变由 V9/V4 双哈希逐位复现证明（§13.1）。
14. **★ 新增转发口 `packages/core/src/model/xlsx-rows.ts`**：只 `export { findHeaderRow, readXlsxRows } from '../normalize/xlsx.js'`，
    **不含任何实现**，目的是让工具2 引用到 core 的**同一份** XLSX 读取实现（M04「解析零新增」要求）而不必新增 exports 授权。
    若按第 13 条裁定把 `./normalize/*` 加入 exports，该转发口即可删除。
    **【处置 2026-11-28，用户裁定一】已删除**：`./normalize/*` 开放后该转发口失去存在理由，
    按项目纪律删除而非留壳；`01-prepare-dataset.ts` 改为直接 `import '@uom/core/normalize/xlsx'`
    （同一份实现，无第二份解析器）。
15. **★ 归档 folds 的分层键含人工字段**：冻结 `folds.json` 的 `stratify_key` 是 `categoryGroup x genderCorrected`，
    其中「性别修正」属人工字段。本移植**按 M08 要求把 folds 当作冻结输入消费**（只读 + 校验，不重生成），
    该字段**不进入预测路径**（特征抽取只读 §9.2 白名单）。但若将来要重做分层（例如改用纯客观字段分层），
    全部 OOF 数字都会变，须另立变更。
    **【已追认 2026-11-28，主 agent】**：folds 是归档冻结输入、只用于分组交叉验证，不进预测路径——
    接受「冻结分层含人工字段」这一事实（非预测特征，不违反 §9.2；复核 §4.2 S9 闭合）。
16. **★ v0.6 在 §9.2 合规特征集下未达归档验收门槛（FAIL，如实记录）**：门槛 1／2／4 为 FAIL（人生阶段 JS 提升 −0.0018、p=0.8358），
    门槛 3 PASS，门槛 5（fail-closed）PASS。管线机制本身全部达标（见 §10.3），**但模型质量未达标**。
    按 P2 规格 §7 第 4 条，v0.6 的验收结论本就**不继承**，故这不是「回归」，而是本移植自测的真实结论。
    **需裁定**：生产策略——是否接受「合规特征集下收益主要落在购买力／策略人群／城市等级三个维度」，
    或在 P2-13 用用户真实数据重估（归档 25Q4 单账号小样本结论不可外推）。
    **【处置 2026-11-28，用户裁定二】门槛未过的登记处置**：用户授权写入 model-mlflow 账本，
    但门槛未过必须如实入账本与 manifest——`manifest.gateConclusion` 由管线实际结果派生（§12／§13.2），
    门槛结论同时写入账本 run params；**Stage 只到 Staging**，晋级 Production 需 P2-13 真实数据重训
    并另获授权（晋级走 Registry，不回写包内 manifest）。生产策略本身仍待 P2-13 数据到位后重估。
17. **`models/` 加入 `.gitignore`**：spec §6 把 `models/**` 定义为「gitignore：登记副本」，但仓库 `.gitignore` 原本**没有**该规则。
    本轮按 §7「模型工件一律不入库」补上 `models/`（模型包与管线产物均落在该区，不入 git）。
18. **新增 `scripts/v06-pipeline.mjs` 与根 `package.json` 的 `pipeline:v06`**：`scripts/**` 未在 spec §6 明列，
    本轮沿用 P2-4 的 `scripts/fidelity-v04.mjs` 先例（同一变更内新增的门禁脚本）。**需追认该路径扩展**。
    **【处置 2026-11-28，用户已追认】**：spec §6 已同步登记 `scripts/**` 与根 `package.json`／`.gitignore`
    （2026-11-28 提交 `7f3e5e9`）；本轮在其上新增 `scripts/register-model-mlflow.mjs`（P2-8 登记入口）。
19. **v0.6 归档数字未逐值复现（NOT_PROVED）**：归档的 `oof_macro_js_lift 0.006`、`candidate_not_locked`
    与勘误前 JS 手工数值均在 spec §7 第 4／5 条的**不继承清单**内，且归档使用的是**含人工字段**的特征集。
    本移植不设「复现归档数字」的断言，也**未**为对齐而放宽或造假；本轮产出的是**合规特征集下自测数字**（§10.4）。

## 9. 交付清单

新增（tracked）：

- `docs/modelevol-provenance.md`（P2-2 创建；本轮扩展 v0.4 两包登记）
- `docs/match-model-baseline.md`（本轮新建：两组基线、口径、差异解释、限制；**本轮增补 §7 v0.6 协议基线**）
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

P2-6／P2-7 一轮新增（tracked）：

- `packages/core/src/model/portrait-md.ts`（同名标签求和解析器；见 §8 第 13 条）
- `packages/core/src/model/xlsx-rows.ts`（XLSX 读取助手的转发口；见 §8 第 14 条）
- `packages/core/test/portrait-md.test.ts`（5 条）
- `packages/tool2-portrait-predict/src/pipeline/v06/lib/types.ts`（v0.6 类型与常量）
- `packages/tool2-portrait-predict/src/pipeline/v06/lib/features-v06.ts`（§9.2 合规特征抽取）
- `packages/tool2-portrait-predict/src/pipeline/v06/lib/train-v06.ts`（训练与折内基线）
- `packages/tool2-portrait-predict/src/pipeline/v06/01-prepare-dataset.ts` … `06-validate.ts`（六阶段）
- `packages/tool2-portrait-predict/src/export/model-package.ts`、`src/export/predict-template.ts`（模型包导出器）
- `packages/tool2-portrait-predict/src/index.ts`（本轮增补 v06 与导出器的再导出）
- `packages/tool2-portrait-predict/test/pipeline-v06.test.ts`（26 条）、`test/export-model-package.test.ts`（12 条）
- `scripts/v06-pipeline.mjs`（六阶段端到端实跑 + 模型包导出；见 §8 第 18 条）
- 根 `package.json`（本轮新增 `pipeline:v06`）、`.gitignore`（本轮新增 `models/`；见 §8 第 17 条）

P2-8／第四单一轮新增与变更（tracked）：

- `scripts/register-model-mlflow.mjs`（P2-8 登记入口：与 Studio Host finalize 相同的本地 MLflow REST 账本序列；见 §12）
- `packages/core/src/normalize/portrait-md.ts`（由 `model/portrait-md.ts` 归位移入，git mv；见 §8 第 13 条处置）
- `packages/core/src/model/xlsx-rows.ts`（**已删除**：`./normalize/*` 开放后转发壳失去存在理由；见 §8 第 14 条处置）
- `packages/core/package.json`（exports 增补 `"./normalize/*"`；§6 已授权）
- `packages/tool2-portrait-predict/src/export/model-package.ts`（必填 `gateConclusion` 证据与派生逻辑）
- `packages/tool2-portrait-predict/test/export-model-package.test.ts`（新增「门槛结论」组 7 条）
- `packages/tool2-portrait-predict/src/pipeline/v06/01-prepare-dataset.ts`、`packages/core/test/portrait-md.test.ts`（import 归位更新）
- `scripts/v06-pipeline.mjs`（把阶段 04／05／06 实跑结果与双哈希传入导出器）
- `docs/match-model-baseline.md`（增补 §7.4 门槛结论入包与登记）

产物（**不在 git**，`.gitignore` 的 `models/` 命中）：

| 路径 | 内容 |
| --- | --- |
| `models/uom-tool2-portrait-v06/v1/` | 3 文件模型包（`predict.mjs` / `manifest.json` / `README.md`） |
| `models/work-v06/` | 管线中间产物（数据集、消融结果、模型工件、指标、基线对照、校验报告） |

固化数据（**不在 git**，位于主仓 `data/archive-modelevol/`）：

| 包 | 文件数 | 体积（字节） |
| --- | --- | --- |
| `v06-tmall-25q4/`（3 包合计） | 218 | 6 002 192 |
| `v04-holdout/work-package/train` | 4 | 53 064 245 |
| `v04-holdout/work-package/holdout` | 4 | 13 366 971 |

---

## 10. P2-6 v0.6 六阶段移植（M08）

### 10.1 交付物与归档来源对照

| 新文件 | 内容 | 归档来源（只读） |
| --- | --- | --- |
| `packages/core/src/model/portrait-md.ts` | 画像 Markdown 解析（**同名标签求和**，v0.7 语义） | `scripts/lib/core.mts:57-78`（归档为覆盖式，**不继承**，见 §7 第 6 条） |
| `packages/core/src/model/xlsx-rows.ts` | XLSX 读取助手的**转发口**（无实现） | `packages/core/src/normalize/xlsx.ts`（同一份实现，见 §8 第 14 条） |
| `.../v06/lib/types.ts` | 六维目标常量、合规输入类型、人工字段黑名单 | `scripts/lib/core.mts:17-47` |
| `.../v06/lib/features-v06.ts` | 合规特征抽取（声明式规格 + 面料词典） | `scripts/lib/features.mts:10-164` |
| `.../v06/lib/train-v06.ts` | 逐维训练、折内 alpha 选择、折内账号均值基线 | `scripts/lib/train.mts:17-121`、`lib/core.mts:282-300` |
| `.../v06/01-prepare-dataset.ts` | 阶段 01：解析冻结 intake（fail-closed） | `scripts/01-prepare-dataset.mts` |
| `.../v06/02-load-folds.ts` | 阶段 02：读取**冻结** folds 并校验（**不重生成**） | `scripts/02-make-folds.mts`（只取校验部分） |
| `.../v06/03-run-ablation.ts` | 阶段 03：合规消融阶梯 + 5 折 OOF + 折内基线配对 | `scripts/03-run-ablation.mts` |
| `.../v06/04-select-final.ts` | 阶段 04：变体、门槛选择、全量最终模型、确定性工件 | `scripts/04-select-final.mts` |
| `.../v06/05-evaluate.ts` | 阶段 05：指标、基线对照、验收矩阵 | `scripts/05-evaluate-report.mts`（只取 JSON 部分） |
| `.../v06/06-validate.ts` | 阶段 06：fail-closed 校验（V1–V12） | `scripts/06-validate.mts` |
| `scripts/v06-pipeline.mjs` | 六阶段端到端实跑 + 模型包导出 | 本项目自写（编排层） |

### 10.2 移植时修掉的归档问题

1. **第二份 Ridge 实现** → 一律走 `packages/core/src/model/ridge.ts` 的唯一 Cholesky 求解器（不自带第二份）。
2. **mean/std 双算** → `fitRidge` 一次算完并存进模型。
3. **矩阵重复构建** → 归档在标签循环里反复重建同一份矩阵，本移植提到循环外（结果不变，计算量下降）。
4. **覆盖式画像解析（丢份额）** → 换 v0.7 同名标签求和版。
5. **`xlsx@0.18.5` 高危漏洞** → 换 core 的 exceljs 读取（`xlsx-rows.ts` 转发同一实现）。
6. **cwd 耦合与绝对路径** → 全部路径由调用方注入；脚本用 `git rev-parse --git-common-dir` 定位主仓固化根。
7. **时间戳污染哈希区** → 工件拆「确定性系数区 + 溯源区」（P2 规格 §2.5），V9 才有可比性。
8. **`localeCompare` 排序** → 改码位序（跨机器可复现；本数据集定长同宽款号，两者同序）。
9. **归档 LOO 缺陷的同类问题**：归档 v0.4 的 fast LOO 回代写错（§4.5 第 6 条）；v0.6 侧本移植**未发现同类错误**，
   并用 V12 对折内基线做独立复算、对 V9 做连跑字节比对，两条都通过。

### 10.3 M08 验收条目逐条

M08 原文：「v0.6 管线：六阶段可跑；folds.json 作为**输入**冻结不重生成；账号均值基线只用训练折；符号检验门槛生效；fail-closed 校验含 V9（连跑字节一致）与 V12（基线折内独立复算）」

| # | 验收点 | 状态 | 证据 |
| --- | --- | --- | --- |
| M08-1 | 六阶段可跑 | **PASS** | `npm run pipeline:v06` 退出码 0；阶段 01–06 日志见 §10.5 |
| M08-2 | folds.json 作为输入冻结、不重生成 | **PASS** | 阶段 02 只读校验（`02-load-folds.ts` 源码无 `writeFileSync`/`mkdirSync`/`rmSync`，由结构守卫测试断言）；V4 用**钉死常量** `FROZEN_FOLDS_SHA256`（`frozen-inputs.ts`，值 `2ca273cb2a2b14df…`）与运行时哈希比对通过，阶段 02 后另有 `assertFrozenFoldsSha256` fail-closed 断言。**复核修单 B2 修正**：复核发现旧实现把同一运行时哈希同时当冻结值与实际值（自比较恒 PASS），冻结哈希只在文档里、代码未钉住——已按修单钉死并补「不一致即 fail」反向测试（§14） |
| M08-3 | 账号均值基线只用训练折 | **PASS** | `03-run-ablation.ts` 内 `v06AccountMeanBaseline(dimension, train)`；单测「基线是折内基线：评估折的基线不等于全量基线」；V12 独立复算 5 折全部通过（复核修单 B3 后为真独立复算） |
| M08-4 | 符号检验门槛生效 | **PASS** | `signTestPValue` 逐维配对检验（p<0.05）；选择分三级门槛（PASS／FAIL_SIGNIFICANCE／FAIL_NOT_POSITIVE），本轮结论 **FAIL_NOT_POSITIVE**；单测覆盖三个层级 + strict 策略 fail-closed |
| M08-5 | fail-closed 校验含 V9（连跑字节一致） | **PASS** | V9 用系数区 sha256 比对（`79669a0f…`）；实跑 pass，单测「V9：重跑结果不一致即 fail」验证该校验会真失败；复核修单 S2 另加系数区钉死校验 `assertFrozenCoefficientSha256`（§14） |
| M08-6 | fail-closed 校验含 V12（基线折内独立复算） | **PASS** | V12 用**独立实现**（`06-validate.ts` 内直接按训练折求均值，不调用 ablation 的 `v06AccountMeanBaseline`）逐折复算、与 ablation **实际使用**的基线（`runV06Ablation` 返回值）逐维逐标签比对，并按**各自维度**断言「折内基线 ≠ 全量基线」；实跑 pass。**复核修单 B3 修正**：复核发现旧实现用同一函数同入参「复算」（恒等式）、且全量基线固定按「预测性别」算却对六个维度比较（5/6 是跨维度比较）——已按修单重写并补泄漏／偏移／缺基线／恒定维度四条反向测试（§14） |

**M08 整体：PASS**（管线机制项全部达标）。
**但**：M08 不含「模型质量达标」这一条；模型质量见 §10.4（门槛 1/2/4 FAIL）。

### 10.4 实跑数字（合规特征集，自测结果，非归档结论）

数据：归档固化 25Q4 intake 93 款；5 折 OOF（冻结 folds）；折内账号均值基线。

| 项 | 值 |
| --- | --- |
| 宏平均 JS 提升 | 0.0096（模型 JS 0.9188 / 基线 JS 0.9092） |
| 宏平均余弦提升 / Share MAE 降幅 / 业务加权 JS 提升 | 0.0025 / 0.0054 / 0.0109 |
| 选中配置 | `V1_minus_subcat`（fit/fabric/attr/cat/craft/season/ip），最终词表 30 个 |
| 逐维 alpha | 性别 10／年龄 100／购买力 25／城市等级 50／策略人群 50／人生阶段 100 |
| 逐维 JS 提升（p） | 性别 +0.0189(0.2132)／年龄 +0.0015(0.4069)／购买力 +0.0199(0.0002)／城市等级 +0.0046(0.0035)／策略人群 +0.0144(0.0000)／**人生阶段 −0.0018(0.8358)** |
| 验收门槛 | 门槛 1 FAIL／门槛 2 FAIL／门槛 3 PASS／门槛 4 FAIL／门槛 5 PASS |

口径说明：归档的 `oof_macro_js_lift 0.006` 与 `candidate_not_locked` 属 **spec §7 不继承清单**（第 4／5 条），
且归档用的是**含人工字段**的特征集，本轮**不设**「复现归档数字」的断言，也未为对齐而放宽（§8 第 19 条）。
冻结数字与逐维明细已写入 `docs/match-model-baseline.md` §7。

### 10.5 RED → GREEN 证据

RED 方式：先建**只有导出签名、函数体抛 `not implemented`** 的骨架（保证断言失败是**行为失败**而非导入错误），再写测试并实跑。

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED | `npm run build && node --test --test-reporter=tap packages/core/dist/test/portrait-md.test.js packages/tool2-portrait-predict/dist/test/{pipeline-v06,export-model-package}.test.js` | 退出码 **1**；`tests 43 / pass 5 / fail 38`。失败原因**全部**是 `not implemented: <函数名>`（如 `not implemented: parsePortraitMd`／`not implemented: runV06Ablation`／`not implemented: buildV06ModelPackage`）；通过的 5 条是结构性守卫（只读源码，与实现无关） |
| GREEN | 同上 | 退出码 **0**；`tests 43 / pass 43 / fail 0` |
| 全量回归 | `npm test` | 退出码 **0**；`tests 317 / pass 317 / fail 0` |

日志：`.local/p2/red-p2-6-p2-7-test.log`、`.local/p2/green-p2-6-p2-7-test.log`（`.local/` 被 `.gitignore` 忽略，不入库）。

RED 期间修正过 3 处**测试自身**的缺陷（不是放宽断言）：① 解析夹具改用二进制可精确表示的占比（25%/25%/50%）；
② 结构守卫改用词边界正则（`.fabric` 不被 `.fab` 误伤）；③ 标签按码位序排序（`['女','男']`）的期望值修正。

### 10.6 §9.2 三层守卫（v0.6 路径）

| 层 | 手段 | 结果 |
| --- | --- | --- |
| 类型层 | `V06CompliantProductInput` 的字段集合里不存在 `fab`/`mindProduct`/`memoryPoint`/`groupTag`/`genderCorrected`；测试文件用 `Extract<…, keyof TInput> extends never ? true : never` 做**编译期断言** | 编译期即阻断越界 |
| 投影层 | `projectV06CompliantInput` 是人工字段进入下游的**唯一**入口，按白名单逐字段挑选 | 运行时白名单 |
| 行为层 | ① **绕过投影层**直接喂抽取器：只差人工字段（有／无两种）的特征**完全一致**；② 投影后注入同样无效；③ 抽取器源码**不得以任何访问形态**出现人工字段（点号／方括号／模板键／`in`，复核修单 B4）；④ 特征名白名单归属（复核修单 B4） | 变异「把人工字段接回抽取器」→ 测试失败（三个存活变异重放全 KILLED，见 §14.2） |

另外，阶段 06 的 **V8** 在实跑里复核「选中配置只用合规特征组、特征名前缀在合规命名空间内」；
**V7** 复核「工件里的标签全部可追溯到冻结 intake 的画像标签集合」（数据驱动的平台口径纯净检查，不硬编码任何外部标签表）。

## 11. P2-7 模型导出器 + 黄金测试（M09）

### 11.1 导出器与契约

`packages/tool2-portrait-predict/src/export/model-package.ts` 产出**恰好 3 个文件**：

| 文件 | 内容 |
| --- | --- |
| `predict.mjs` | 自包含预测模块（纯 Node 零依赖）：内嵌特征组规格、面料归一化规则、最终词表、逐标签系数；导出 `predict(rows)`；**不提供任何 HTTP 端点**、不监听端口 |
| `manifest.json` | `formatVersion: 1`；`model{name,version,stage}`；`data.fingerprint{sha256,rows,columns}`（**宿主侧计算**）；`metrics`；`training{splitSeed,task,targets,trainedAt,sessionRef}`；`usage{inputs,outputs,form}` |
| `README.md` | 加载用法、输入列、输出列、指标、数据指纹、训练信息、方法说明、口径与限制 |

- `usage.outputs` 为**扁平标量列**：每个 (维度, 标签) 一列，列名 `<维度>__<标签>`（本轮 32 列）。
- `data.fingerprint.sha256` 由**宿主侧**（导出器）对原始训练输入（管线阶段 01 产出的数据集文件）计算，本轮实测 `65cf98f6eeb88986…`。
- `manifest.model.stage` 只写初值；**晋级不回写**，Stage 以 model-mlflow 的 **Registry** 为准。
- **本单只产出与自校验模型包，未写进 model-mlflow**（登记属 P2-8，需另获用户授权）。

### 11.2 M09 验收条目逐条

M09 原文：「导出器：3 文件包、`formatVersion: 1`、`usage.outputs` 为扁平列；固定输入→精确期望分布（容差 0）的黄金测试；连跑两次字节一致」

| # | 验收点 | 状态 | 证据 |
| --- | --- | --- | --- |
| M09-1 | 3 文件包 | **PASS** | 单测「恰好 3 个文件，目录里没有多余产物」；实跑 `models/uom-tool2-portrait-v06/v1/` 实际 3 个文件 |
| M09-2 | `formatVersion: 1` | **PASS** | 单测「manifest.formatVersion 为 1」 |
| M09-3 | `usage.outputs` 为扁平列 | **PASS** | 单测「usage.outputs 是扁平列（<维度>__<标签>）」；实跑 32 列，列名形如 `预测城市等级__1` |
| M09-4 | 固定输入→精确期望分布（**容差 0**）的黄金测试 | **PASS** | 两条黄金用例：① **解析可算**用例（手写工件：男 = 0.25 + 0.5×1 = 0.75、女 = 0.75 − 0.5×1 = 0.25，`assert.equal` 精确相等）；② **训练产物冻结常量**用例（`预测性别__乙 = 0.7178879310344828`、`预测性别__甲 = 0.2821120689655172`，`assert.equal` 精确相等）。另有「导出包与管线口径一致」用例逐标签比对，锁住包内运行时与管线实现**逐位相同** |
| M09-5 | 连跑两次字节一致 | **PASS** | 单测「predict.mjs 两次构建字节一致」（sha256 相等）、「固定 trainedAt 时 manifest.json 也字节一致」、「训练两次的系数区字节一致」；实跑 V9 系数区 sha256 两次一致（`79669a0f…`） |
| M09-6 | 无 HTTP 预测端点 | **PASS** | 单测「包内无 HTTP 预测端点、无 HTTP 服务代码」：不得出现被引号包裹的 `/predict` 路由、不得出现 `createServer`／`node:http`／`.listen(` |
| M09-7 | `data_sha256` 由宿主计算 | **PASS** | 单测比对 manifest 的 `data.fingerprint.sha256` 与宿主独立算出的值；导出器对非 64 位十六进制直接抛错 |

**M09 整体：PASS。**

### 11.3 「不出现第二份抽取实现」的做法

模型包必须自包含零依赖，运行期无法 import 本项目源码。为避免出现第二份抽取实现：
导出器把**数据**（特征组规格、面料规则源码、词表、系数）从单一来源序列化进包里，
包内运行时代码只做**通用**的「取词项 → 组向量 → 线性打分 → 归一化」四步，
且逐步镜像 `packages/core/src/model/ridge.ts` 的 `predictRidge` 与 `lib/train-v06.ts` 的 `normalizeV06Distribution`
（同样的运算顺序、同样的截断与归一化），由「导出包与管线口径一致」用例逐值锁住。
M09 只要求 3 文件／formatVersion／扁平列／黄金测试／字节一致，未要求 CLI 包装，因此本包**不含** CLI 尾码
（model-mlflow 的 CLI 尾码由其宿主组包器追加；本项目导出器只提供 `import { predict }`，符合「消费方式仅 import 或 CLI」的契约）。

### 11.4 复跑方式

```bash
npm run build
npm run pipeline:v06        # 六阶段实跑 + 模型包导出（需固化数据；本地运行，CI 不跑）
npm test                    # 含黄金用例与字节一致用例（合成夹具，CI 可跑）
```

---

## 12. P2-8 model-mlflow 登记（M10，2026-11-28）

> 用户裁定（2026-11-28）：授权写入 `~/Dev/Projects/model-mlflow` 账本，但**门槛未过必须如实写进账本与
> manifest**，Stage 只到 **Staging**，不得晋级 Production（晋级需 P2-13 真实数据重训并另获授权）。

### 12.1 登记入口与约束遵守

| 项 | 内容 |
| --- | --- |
| 登记入口 | model-mlflow **既有的本地 MLflow REST 账本**（与 Studio Host `finalize_training` 同一入口、同一 experiment `mps-chat-training`、同一登记序列）；入口脚本 `scripts/register-model-mlflow.mjs` |
| 不改造约束 | **未修改** model-mlflow 代码本体、配置与既有条目（工程规范 §8.2）：MLflow server 由其启动器同款命令供给（`workspace/spikes/mlflow-chain/.venv` 的 mlflow 3.16.1，store=`workspace/mlflow/mlflow.db`，artifact root=`workspace/mlflow/mlflow-artifacts`，仅绑 `127.0.0.1:5021`）；该 store 与 `workspace/exports/` 均为该仓 gitignore 区，登记后其 git 工作树干净 |
| 副作用收口 | 登记完成后已停掉本次供给的 MLflow server（机器回到任务前状态；下次启动器运行按其「复用/供给」逻辑自理） |

### 12.2 登记结果（读回核对）

| 项 | 值 |
| --- | --- |
| Registry 条目身份 | `uom-tool2-portrait-v06` **v1**（新 RegisteredModel，版本号 = 既有最大 + 1） |
| Stage | **Staging**（读回 `current_stage=Staging`，`status=READY`；「训练自动入 Staging、晋级是用户动作」的契约如实执行） |
| 训练 run | `eb3855e624c5439d9829ca840510c6d3`（FINISHED，experiment `mps-chat-training`） |
| 包契约校验 | 恰好 3 文件（`predict.mjs`/`manifest.json`/`README.md`）、`formatVersion=1`、`usage.outputs` 32 条扁平列、`model.stage=Staging` |
| `data_sha256`（宿主计算） | `65cf98f6eeb889868be8edce71449d2ebaa510dbca3a0be3397a876b049e48bf`（对管线阶段 01 原始输入 `models/work-v06/dataset.json` 宿主侧独立重算，与 manifest 一致） |
| 门槛结论（账本 run params 原文） | `selected_variant=V1_minus_subcat`；`selection_gate=FAIL_NOT_POSITIVE`；`gate_gate1_all_dims_positive_significant=FAIL`；`gate_gate2_high_variability_dims=FAIL`；`gate_gate3_expansion_gain_over_control=PASS`；`gate_gate4_fold_stability=FAIL`；`gate_gate5_frozen_inputs_and_fail_closed=PASS`（阶段 06 V1–V12 判定，12/12 pass）；`macro_js_lift=0.0095752873551487`；`frozen_folds_sha256=2ca273cb2a2b14df…`；`coefficient_region_sha256=79669a0f30938c0b…`；`stage_ceiling=Staging`；`promotion_policy=Stage 上限 Staging；本包由归档数据训练且门槛未过，晋级 Production 需 P2-13（用户真实数据重训过生产门）并另获用户授权（晋级走 model-mlflow Registry，不回写本包 manifest）` |
| 包字节三方一致 | 本项目 `models/uom-tool2-portrait-v06/v1/` ↔ Registry source（run artifacts `packages/uom-tool2-portrait-v06-v1/`）↔ 交付路径 `workspace/exports/uom-tool2-portrait-v06/v1/`，3 文件 sha256 逐位一致 |
| 登记前置 fail-closed | manifest 门槛结论与 `models/work-v06/validation.json` 的管线产物一致（`selection_gate`、`selectedVariant` 逐项核对）才放行；缺结论、stage 非 Staging、data_sha256 重算不一致均拒绝登记 |
| `models/` 副本 | 保持 gitignore 不入库（`.gitignore` 的 `models/` 命中） |

## 13. 第四单执行记录（2026-11-28：A 归位 + B 门槛结论 + C 登记 + D 收尾）

### 13.1 A 归位重构（对应 §8 第 13／14 条处置）

- `git mv packages/core/src/model/portrait-md.ts packages/core/src/normalize/portrait-md.ts`（spec §6 指定落位）；
  更新 `packages/core/test/portrait-md.test.ts` 与 `01-prepare-dataset.ts` 的 import；
  `packages/core/package.json` 增补 `exports["./normalize/*"]`；**删除** `model/xlsx-rows.ts` 转发壳
  （`./normalize/*` 开放后失去存在理由；本项目纪律：被取代的东西删除而不是留壳）。
- **行为不变实证**：重构后 `npm run pipeline:v06` 的系数区 sha256 仍为
  `79669a0f30938c0b837589998adc4270d093050bd4c980400e76ee357568d6fa`（V9），
  冻结 folds sha256 仍为 `2ca273cb2a2b14dff9d2ae857e170aa02db89c0f50e36ced84f2625f4087ad22`（V4）——**两个哈希逐位不变**，
  阶段 01–06 与 12 条 fail-closed 校验全 PASS。日志：`.local/p2/pipeline-v06-after-A.log`。

### 13.2 B manifest 补记门槛结论（登记前置）

- **TDD 真 RED**：先写 7 条门槛结论测试再实跑——`tests 18 / pass 12 / fail 6`，
  6 条失败**全部为行为失败**（manifest 无 `gateConclusion`、缺结论不抛错、Production 不被拒、
  哈希/宏平均不校验等），非导入或环境失败。留档：`.local/p2/red-gate-conclusion.log`。
- **GREEN 最小实现**：`buildV06ModelPackage` 新增必填 `gateConclusion` 证据（阶段 04 selection／
  阶段 05 acceptance+macroJsLift／阶段 06 validationChecks／冻结 folds 与系数区双 sha256），
  `manifest.gateConclusion` 全部**派生**自该证据（不手写数值）；缺任一证据、gate1–gate4 未判定、
  阶段 06 校验缺失、哈希非法、宏平均非有限、门槛未过而写 Production → 一律抛错。
  `scripts/v06-pipeline.mjs` 把本次实跑的阶段 04／05／06 结果与双哈希传入导出器。
- **回归全绿**：该测试组 18/18（`.local/p2/green-gate-conclusion.log`）；全量 `npm test` 324/324；
  管线复跑后 V9／V4 双哈希仍逐位不变，黄金测试（容差 0）与连跑字节一致用例全绿；
  **未改动**已冻结的 v0.4 忠实门数字（0.6957/0.9155/0.0825）与合规基线数字（0.7754/0.9300/0.0759）。
- 实际入包结论见 §12.2 与 `docs/match-model-baseline.md` §7.4。

### 13.3 历史轮 RED 留档丢失的如实说明

工作树曾被 /tmp 清理删除后重建：`.local/` 内**前几轮（P2-3／P2-4／P2-6／P2-7）的 RED 失败日志不可复得**，
本轮**不补造历史 RED 记录**；历史 RED 结论以本文件 §3.3／§4.4／§10.5 当时记录的命令与计数为凭
（每轮 RED 均为「骨架函数抛 not implemented」的行为失败口径，非环境失败）。
`models/` 模型包已由 `npm run pipeline:v06` 重跑再生，V9 系数区 sha256 逐位复现冻结值（§13.1），
即再生包与丢失前的包在系数区字节一致。

### 13.4 未做项与 NOT_RUN 汇总（第四单）

- `npm run offline-check`：**NOT_RUN**（守卫自检段 PASS：13 个出网入口全部拦截归因；
  `offline-e2e` 段因工作树 `data/` 无真实业务数据失败——与前几轮同因，不为变绿拷数据）。
- `npm run test:golden`：**NOT_RUN**（缺 `UOM_REFERENCE_ROOT`；本轮未触及匹配内核）。
- P2-11 独立复核、P2-12 PR/CI/squash 合并、P2-13 真实数据重训与晋级、26Q4 回测：**NOT_RUN**
  （P2-11 由主 agent 另派非作者 agent；本轮不 push、不开 PR）。

### 13.5 本轮范围外发现（编号接 §8 第 19 条）

20. **`docs/match-model-baseline.md` §7 引语把 v0.6 协议写成「五阶段」**（括号里实际列了六个阶段，
    §7.3 结论段也写「六阶段」）：文字瑕疵，不影响数字与结论；本轮已随文档收尾一并修正为「六阶段」，
    并在 §7.4 增补门槛结论入包与登记的记录。
21. **model-mlflow 账本 store 在本机属首次创建**：`workspace/mlflow/mlflow.db` 此前不存在
    （本机从未跑过启动器的正式供给分支，既有 `e2e-mlflow`/`spikes` 两个 store 属测试/试验），
    本次登记即该账本的第一个条目。若用户在其他机器已有正式账本（启动器注释称数据随 git 同步），
    需注意两机账本合流策略——本机此账本现含且仅含本次 `uom-tool2-portrait-v06` v1 条目。
22. **MLflow param 值长度上限依赖**：登记把 `promotion_policy` 全文与 32 列 `targets` JSON 写进 run params
    （mlflow 3.16.1 实测接受）。若未来 model-mlflow 升级收紧 param 长度，登记脚本需改走 tags/artifact。

---

## 14. 复核修单（2026-11-28：review-p2.md B1–B4／S1–S5／建议项处置）

> 依据：[review-p2.md](review-p2.md)（独立复核结论 **FAIL**，阻断 4 项）。修单由主 agent 另派的实现子代理执行；
> **作者不自评复核**——受影响范围（§9.2 守卫、V4/V10/V12、夹具、登记）须由独立复核者重验，本节只是处置记录。
> TDD 纪律：每项先写测试取**真 RED**（本工作树 `.local/p2/fix-review/`，gitignore 区），再最小实现转 GREEN。
> RED 日志：`red-b1-guard.log`（B1）、`red-batch.log`（B2–S5+B4，17 条失败全部 `failureType: 'testCodeFailure'`，无环境失败）、
> `replay-1a-implicit.log`／`replay-1b-implicit.log`／`replay-1b-bracket.log`（变异重放）。
> GREEN 日志：`green-batch.log`（三测试文件 81/81）、`green-full-test.log`（全量 436/436）。

### 14.1 阻断项（B1–B4）

| 项 | 处置 | 证据（file:line 为修单后位置） |
| --- | --- | --- |
| **B1** 真实商品记录进 tracked 测试 | **PASS（已修）** | ① 夹具替换：`packages/core/test/model-v04.test.ts:173` 起改用合成样本 `SYN-0001`（版型/面料/卖点全部虚构，期望向量按词典手算：`fit_slim`、`fabric_cotton/spandex/blend/rib`、`style_casual×2/premium/designer×2/versatile`、`func_drape`、`scene_daily`），测试名与注释中「归档第 1 行」「109326100005」全部移除；② 全仓扫描：`node scripts/check-no-archive-content.mjs`（黑名单 85 条运行时取自固化区）扫 tracked 文本 172 个——修单前命中 1 处（即旧夹具，`red-b1-guard.log`），修后 0 命中（`green-b1-guard.log`）；`git grep 109326100005` 在 tracked 源码/测试中 0 命中；裸款号常量按复核 S7 口径保留（见 §8 第 24 条）；③ 新守卫：`scripts/check-no-archive-content.mjs`（`npm run check:archive-content`），黑名单运行时构造不入库，命中与固化区缺失均退出非 0；不纳入 `npm run check`（CI 无固化数据），本地提交前运行；④ `check-data-guard.py` 未拦住的原因与守卫设计记录于 §8 第 24 条 |
| **B2** V4 恒 PASS（自比较） | **PASS（已修）** | ① 钉死：新模块 `packages/tool2-portrait-predict/src/pipeline/v06/frozen-inputs.ts:21` 导出 `FROZEN_FOLDS_SHA256 = 2ca273cb2a2b14df…`（完整值取自 `docs/match-model-baseline.md` §7.4）；② 接线：`scripts/v06-pipeline.mjs:220` 阶段 02 后 `pipeline.assertFrozenFoldsSha256(foldsSha256)`（fail-closed）；validateV06 输入改为 `frozenFoldsSha256: pipeline.FROZEN_FOLDS_SHA256` + `actualFoldsSha256: foldsSha256`（不再自比较；结构守卫测试断言脚本里不得再出现 `frozenFoldsSha256: foldsSha256`）；③ 缺输入即 fail：`06-validate.ts` V4（见 S4）；④ 测试：`pipeline-v06.test.ts`「folds 被篡改一字节后重算的哈希必不等于钉死值，断言即抛错」（临时文件翻一字节 → sha256 变化 → 断言抛错）、「V4：冻结 folds 哈希与运行时哈希不一致即 fail」、「钉死常量与文档冻结值逐位一致」 |
| **B3** V12 恒等式 + 跨维度 bug | **PASS（已修）** | ① ablation 返回实际基线：`03-run-ablation.ts` 在折循环内记录 `foldBaselines['fold:<折号>:<维度>']`（`:124` 接口、`:162` 记录）并随结果返回；② 独立复算：`06-validate.ts` V12 内另写 `meanDistribution`（直接按训练折逐标签累加求均值，**不调用** `v06AccountMeanBaseline`），与传入基线逐维逐标签双向比对；③ 全量基线逐维度：V12 内逐维度计算自身全量基线并按**各自维度**断言「折内 ≠ 全量」（修掉固定按「预测性别」的跨维度比较）；④ fail-closed：缺 `foldBaselines` 或缺任一键即 fail；⑤ 管线接线：`scripts/v06-pipeline.mjs` 的 `foldBaselines` 改为 `ablation[0]?.foldBaselines`（不再由脚本自算一份）；⑥ 测试四条反向：泄漏（基线误用全量）→ fail；某维度偏移 → fail；缺基线 → fail；「画像恒定维度与其自身全量基线相同必须被抓」（旧实现该场景恒 PASS——跨维度 bug 的直接回归）；⑦ 实跑：V12 PASS（5 折，`check-pipeline.log`） |
| **B4** §9.2 守卫绕过（变异存活） | **PASS（已修，三变异重放全 KILLED）** | ① 结构守卫升级（v0.4 与 v0.6 都生效）：`model-v04.test.ts` / `pipeline-v06.test.ts` 的 `assertNoForbiddenFieldAccess`——方括号 `['fab']`／`["fab"]`／模板键 `` [`fab`] ``／`in` 检查在「剥注释、**保留字符串字面量**」层匹配（旧守卫先剥字符串导致方括号检查形同虚设），点号访问在剥字符串后匹配；② 行为层绕过投影层：两测试文件新用例直接把只差 `fab`（**有／无两种**）的原始输入喂给抽取器，断言特征完全一致——旧用例 clean/dirty 都过投影层且只比较有/有，杀不死「存在指示」型变异；③ 特征名白名单：两测试文件新增归属断言（v0.4 按版型词典＋面料 canonical＋语料取值归属；v0.6 按声明式规格语料取值归属），任何无法归属的特征名（如 `fab_present`）即失败；④ 三变异重放（KILLED 证据见 §14.2） |

### 14.2 三个存活变异重放结果（复核 §3 变异 1a-implicit／1b-implicit／1b-bracket）

| 变异 | 注入方式（重放） | 结果 | KILLED 证据 |
| --- | --- | --- | --- |
| 1a-implicit（v0.4） | `features-v04-compliant.ts` 的 `extractCompliantBaseFeatures` 以 `['f','a','b'].join('')` 取键、存在即加 `fit_fab_present` | **KILLED** | `replay-1a-implicit.log`：`fail 1`——「行为层：绕过投影层直接喂抽取器——只差 fab（有／无）的特征完全一致」；旧「投影层复核」用例仍 pass（证明旧盲区）。重放后已还原，32/32 绿 |
| 1b-implicit（v0.6） | `features-v06.ts` 的 `extractV06Tokens` 以 join 拼键读 fab、存在即加 `attr_<fab 文本>` | **KILLED** | `replay-1b-implicit.log`：`fail 1`——「行为层：绕过投影层直接喂抽取器——只差人工字段（有／无）的特征完全一致」。重放后已还原，46/46 绿 |
| 1b-bracket（v0.6） | 同处以 `(input as unknown as Record<string,string>)['fab']` 方括号接回 | **KILLED** | `replay-1b-bracket.log`：`fail 2`——「结构守卫：抽取器源码不得以任何访问形态读取人工字段」＋「行为层：绕过投影层…」。重放后已还原，46/46 绿；`git diff` 抽取器 0 行 |

说明：join 拼键属动态构造，静态结构守卫按设计不覆盖（守卫覆盖方括号／模板键／`in`／点号四类静态形态）；
该类变异由**行为层有/无对比**与**特征名归属白名单**杀死——三层防线各司其职。

### 14.3 应修项（S1–S5）

| 项 | 处置 | 证据 |
| --- | --- | --- |
| **S1** `productAttribute` 归类 | **PASS（用户已裁定，已披露＋已锁）** | 裁定与披露见 §8 第 23 条；取值集合钉死 `types.ts` `V06_PRODUCT_ATTRIBUTE_ALLOWED_VALUES = ['电商一年期','线下一年期','老品']`；阶段 01 fail-closed 校验 `01-prepare-dataset.ts`（逐样本 `assertV06ProductAttributeAllowed`，集合外含空值即拒绝）；测试三条：集合逐位锁定、合法放行/非法抛错、阶段 01 端到端拒绝（exceljs 造表）；spec §2.4 措辞由主 agent 同步（工作树内未提交改动，作者不代提交） |
| **S2** 系数区哈希无机器校验 | **PASS（已修）** | `frozen-inputs.ts` 钉死 `EXPECTED_COEFFICIENT_SHA256 = 79669a0f30938c0b…` + `assertFrozenCoefficientSha256`（缺失/非 sha256/不一致即抛错）；管线在阶段 04 后调用（`scripts/v06-pipeline.mjs`）；测试「系数区哈希不一致即抛错（换求解器／换数据场景）」；实跑逐位复现 `79669a0f…`（复核变异 4 的换求解器场景今后会在阶段 04 直接失败） |
| **S3** V10 恒 PASS | **PASS（已修）** | `06-validate.ts` V10 改为真实判定：逐折重算 OOF 词表，断言**最终词表 ⊇ 各折 OOF 词表**（该超集关系由 `buildV06Matrix` 词频单调性保证，若最终词表另有来源/被篡改即 fail），差异逐折记录进 detail；测试「最终词表缺折内 OOF 词项即 fail」（篡改 artifact 词表）；实跑 `final ⊇ OOF holds；fold 0: OOF 27 / 最终 30; …`（`check-pipeline.log`） |
| **S4** V1/V4 缺输入默认 pass | **PASS（已修）** | `06-validate.ts` V1：无 `checksumsFile` 即 fail；V4：缺任一哈希即 fail（均照 V9 的 fail-closed 写法）；测试「V1：未提供 intake 校验清单即 fail」「V4：缺任一哈希即 fail」；管线实跑始终传入两者（V1 187 files / V4 钉死比对） |
| **S5** 登记脚本 URL 无回环校验 | **PASS（已修）** | 新模块 `packages/tool2-portrait-predict/src/register/url-guard.ts` `assertLoopbackMlflowUrl`（只允许 `127.0.0.1`／`localhost`／`::1` 含端口；非 http(s)／非法 URL／其它主机一律抛错）；`scripts/register-model-mlflow.mjs` 在解析参数后、任何请求发出前调用（守卫模块加载失败也拒绝登记）；测试 `test/register-url-guard.test.ts` 3 条（回环放行含 `[::1]`、内网/域名/`0.0.0.0` 拒绝、协议与格式拒绝）；实测 `--url http://example.com:8080` 被拒（`check-pipeline.log` 同轮） |

### 14.4 建议项（复核 §4.3）

| 项 | 处置 | 证据 |
| --- | --- | --- |
| **S6** tool2 单一求解器／单一指标结构守卫 | **PASS（已加）** | `pipeline-v06.test.ts`「tool2 包级结构守卫」：递归扫描 `packages/tool2-portrait-predict/src/**/*.ts`，禁 `invertMatrix|gaussJordan|adjugate|cofactor|Math.log2|function (cosineSimilarity|jsSimilarity|fitRidge|predictRidge|choleskyFactor|solveCholesky)`；`@uom/core/*` 导入只允许 `model|normalize` 子路径（复核变异 4 的「新建 ridge-local」今后被此守卫抓住） |
| **S8** 状态词 | **PASS（已改）** | §1 P2-9「部分完成」改为按子项 `PASS`；全文状态只用 `PASS/FAIL/NOT_RUN/UNKNOWN/NOT_PROVED` |
| **S9** folds 分层键裁定 | **PASS（已闭合）** | §8 第 15 条改「已追认（主 agent，2026-11-28：冻结输入分组用途，非预测特征）」 |
| **S7／S10／S11** | **未处理（留主 agent／用户）** | S7 款号是否属业务数据的统一口径、S10 `package-lock.json` 入 §6 追认、S11 V11 弱断言——超出本修单授权，见 §14.5 |

### 14.5 仍需主 agent／用户处理

1. **独立复核者重验受影响范围**（工程规范 §5.1：作者修复后由复核者重验）：§9.2 三层守卫（B4）、V4／V10／V12（B2/B3/S3/S4）、v0.4 夹具与归档内容守卫（B1）、S1 取值集合、S5 URL 守卫、v2 登记一致性。
2. **spec §2.4 的 S1 修正与 spec §6 的 S10 追认**（`package-lock.json`）：spec 改动在工作树内（主 agent 已起草 §2.4），由主 agent 提交；S10 未动。
3. **S7 口径**：款号（及 tool1 既有品牌/店铺常量）是否属「业务数据」请用户统一口径。
4. **v1 的处置**：v1（Staging）保持不动；是否 archive v1 由用户决定（本修单不做任何 Stage 变更）。
5. 断网 e2e 与黄金 G1–G5：**NOT_RUN**（工作树无真实业务数据／无 `UOM_REFERENCE_ROOT`；本轮未触及匹配内核，`ridge.ts` 本轮无改动）。

### 14.6 修单涉及的文件清单

- 新增：`packages/tool2-portrait-predict/src/pipeline/v06/frozen-inputs.ts`、`packages/tool2-portrait-predict/src/register/url-guard.ts`、`packages/tool2-portrait-predict/test/register-url-guard.test.ts`、`scripts/check-no-archive-content.mjs`
- 修改：`packages/tool2-portrait-predict/src/pipeline/v06/{lib/types.ts,01-prepare-dataset.ts,03-run-ablation.ts,06-validate.ts}`、`packages/tool2-portrait-predict/src/index.ts`、`packages/tool2-portrait-predict/test/pipeline-v06.test.ts`、`packages/core/test/model-v04.test.ts`、`scripts/{v06-pipeline.mjs,register-model-mlflow.mjs}`、根 `package.json`（新增 `check:archive-content`）、`openspec/changes/p2-model-port/result.md`
- 未动：`packages/core/src/model/**`（除测试外零改动）、`docs/**`、归档与 model-mlflow 本体、`review-p2.md`
23. **★ 复核修单 S1——`productAttribute`（货品属性）的归类裁定与披露（2026-11-28 用户裁定，独立复核发现）**：
    原 §2.4 把 `productAttribute`（货品属性）与心智产品／记忆点／群组打标并列列为「人工判断字段」，
    但实现把它落在合规特征组 `attr`（`features-v06.ts` 的声明式规格），选中变体 `V1_minus_subcat` 含 `attr`，
    `usage.inputs` 与账本 `data_columns` 均含 `productAttribute`——属「实现者对硬约束边界自行重新归类」且未披露（复核 S1）。
    **用户裁定：追认为客观属性**——该列的实际取值只有三种生命周期类标签（`电商一年期`／`线下一年期`／`老品`），
    性质同白名单「上新类型」，不含人工判断，**保留在合规特征集**；spec §2.4 措辞由主 agent 同步修正（工作树内已改）。
    防回退措施：取值集合钉死在 `types.ts` 的 `V06_PRODUCT_ATTRIBUTE_ALLOWED_VALUES`，
    阶段 01 对每一样本 fail-closed 校验（`assertV06ProductAttributeAllowed`），
    出现集合外的任何值（含空值）即拒绝整个数据集；测试锁定集合本身与「集合外取值即失败」两条语义。
    **影响面**：若将来数据出现新生命周期标签，属数据契约变更，须另立变更并更新集合（不得静默放行）。
24. **★ 复核修单 B1——真实商品记录进入 tracked 测试（已修）**：`packages/core/test/model-v04.test.ts`
    曾把归档 `product_attributes.jsonl` 第 1 行真实记录（真实款号、属性组合、整段 FAB 卖点原文）逐字抄进测试夹具。
    已改为**合成样本**（虚构款号 `SYN-0001`、合成卖点文本，期望向量按词典逐项手算写死，特征位覆盖面与原夹具相当）。
    全仓扫描（对照主仓固化区）：tracked 文件中真实内容片段仅此一处（复现命令见 §14）；
    裸款号常量（`docs/match-model-baseline.md` 的 `109926124101`、`pipeline.test.ts` 的标识用款号）按复核 S7 口径保留——
    仅作标识、与 main 先例一致，不附带属性组合或文案。tool1 包内既有品牌／店铺常量属 main 既有先例，不在本变更范围。
    **`check-data-guard.py` 为什么没拦住**：它只查「git 索引里的数据目录／数据文件扩展名／超大文件」，
    不检查 tracked **文本文件的内容**。已补轻量守卫 `scripts/check-no-archive-content.mjs`
    （`npm run check:archive-content`）：运行时从主仓固化区读若干真实行现场构造子串黑名单
    （v0.4 商品属性 FAB 片段＋记录前缀、画像 CSV 数据行、v0.6 画像元信息行；黑名单不入库），
    对全部 tracked 文本文件做子串匹配，命中即退出非 0；固化区不可用同样退出非 0（fail-closed）。
    该守卫**不纳入 `npm run check`**（CI 无固化数据，也不得接触真实数据）；本地在提交前运行。
25. **★ 复核修单 C 项——模型包升版 v2 并登记（v1 不动）**：修单后 `npm run pipeline:v06` 复跑，
    `predict.mjs` 与已登记 v1 **逐字节一致**；`manifest.json` 相对 v1 的差异为 `model.version`（1→2）与
    `training.trainedAt`（设计上的非确定性溯源区），`gateConclusion`（含 V1–V12 的 id+result）、
    metrics、data 指纹、usage 全部逐位一致——门槛结论照旧如实（FAIL_NOT_POSITIVE）。
    按「manifest 字节有变即升版」的口径登记 **v2 · Staging**（用户已授权 Staging）：
    Registry `uom-tool2-portrait-v06` v2 · READY，run `abd1e4270fae4c4a83dd68cdfb200cfe`（FINISHED），
    `data_sha256` 与 v1 相同（`65cf98f6…`），folds/系数区双哈希与 v1 相同；v1（Staging，run `eb3855e6…`）保持不动；
    model-mlflow 代码本体未改（其 git 工作树干净），登记用后已停掉本地 MLflow server（127.0.0.1:5021）。