# P2-Model-Port 独立复核报告（review-p2）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分，全程只读源码/测试/规格/数据）
> 复核日期：2026-11-28
> 结论：**FAIL**（阻断 4 项，见 §4.1；修复后需重验受影响范围）
> 本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

---

## 1. 候选身份与实际运行的命令

### 1.1 候选身份

| 项 | 值 |
| --- | --- |
| 基线 | 本地 `main` @ `42de110` |
| 候选 | `work/p2-model-port` @ `a8e5a69`（合并提交，无冲突）；P2 提交链 `739e850 → … → 98ac7a3` |
| 差异 | `git diff main...HEAD`：44 文件，+9515 / −1 |
| 复核工作树 | `/tmp/uom-review-p2`（`git worktree add --detach`），构建产物与 `models/`、`.local/` 均落在 gitignore 区 |
| 数据 | 只读使用主仓 `data/archive-modelevol/`（v04-holdout、v06-tmall-25q4），未拷贝进工作树 |

### 1.2 预期清单（打开实现前从 spec §4 M01–M13 导出）

M01 固化 27/2/189 落 gitignore 区 + provenance 只含路径/哈希/日期；M02 唯一 Cholesky、修 mean/std 双算、换回 Gauss-Jordan 被抓；M03 `top1Overlap/top3Overlap` 与 `top1Hit` 不同名共存、js/cos/shareMae/符号检验各一份、复用 `index/similarity.ts`；M04 CSV/XLSX 全走 `normalize/*`、引号缺陷有测试、0 漏洞无 xlsx；M05 strict-23 `0.6957/0.9155/0.0825` 容差 0 + 温度值；M06 变异接回 fab 必失败；M07 合规基线按 v0.4 协议重算冻结；M08 六阶段可跑、folds 冻结不重生成、基线只用训练折、符号检验门槛生效、V9/V12；M09 3 文件、formatVersion 1、扁平列、黄金容差 0、连跑字节一致；M10 复制到 `models/<name>/vN`、manifest 4 项校验、Stage 以 Registry 为准、不改 Studio；M11 根 tsconfig references、strict + noUncheckedIndexedAccess；M12 §7 十项不继承；M13 固化只在 gitignore 区、CI 不触真实数据。

### 1.3 实际运行的命令与结果

| # | 命令（在 `/tmp/uom-review-p2`，除注明外） | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-p2 a8e5a69` | OK |
| 2 | `npm ci --ignore-scripts && npm run build` | 退出 0；`found 0 vulnerabilities` |
| 3 | `npm test` | **412/412 pass**，0 fail |
| 4 | `npm run check` | 退出 0 |
| 5 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 第一组 strict-23 `0.6957/0.9155/0.0825`、all-24 `0.7014/0.9190/0.0830`、alpha 50、83 行、156/94、温度六值、泄漏 5/5 **全 PASS**；第二组 `0.7754/0.9300/0.0759`、alpha 50、泄漏 5/5 **全 PASS** |
| 6 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol npm run pipeline:v06` | 退出 0；阶段 01–06 跑通；93 款、5 折 19/19/19/18/18；选中 `V1_minus_subcat`；门槛 `FAIL_NOT_POSITIVE`；V1–V12 全 PASS；系数区 `79669a0f30938c0b…`；folds `2ca273cb2a2b14df…`；数据指纹 `65cf98f6eeb88986…`；宏平均 js_lift `0.0095752873551487` |
| 7 | `node scripts/verify-modelevol-provenance.mjs` | 5 包 PASS（含 187 条内嵌清单一致） |
| 8 | `python3 .github/scripts/check-data-guard.py .` / `check-docs-links.py .` | 通过 / 118 条链接 0 错 |
| 9 | `npm audit --audit-level=high` | found 0 vulnerabilities |
| 10 | `shasum -a 256` folds.json（固化副本 vs 归档原件） | 一致 `2ca273cb…` |
| 11 | `git -C ~/Dev/Archive/ModelEvol status --porcelain`；`find … -newermt 2026-11-26`（排除 .DS_Store） | 非 .DS_Store 的 tracked 改动 = 0；2026-11-26 后改动文件 = 0；untracked 条目 mtime 全在 9 月 |
| 12 | `git -C ~/Dev/Projects/model-mlflow status --porcelain` | 空 |
| 13 | `sqlite3 "file:…/workspace/mlflow/mlflow.db?mode=ro" …` | 1 个 RegisteredModel `uom-tool2-portrait-v06` v1 `Staging`/`READY`；run `eb3855e624c5439d9829ca840510c6d3` FINISHED；params 含 `selection_gate=FAIL_NOT_POSITIVE`、gate1–5、`macro_js_lift`、双哈希、`stage_ceiling=Staging`、`promotion_policy`；无 Production、无 alias |
| 14 | 包字节三方比对（本次复跑 / `/tmp/uom-wt-p2/models` / model-mlflow `workspace/exports`） | `predict.mjs`、`README.md` 逐位一致；`manifest.json` 仅 `training.trainedAt` 不同（设计上的非确定性溯源区） |
| 15 | 只读查看 `/tmp/uom-wt-p2/.local/p2/` | 见 §2.B |
| 16 | 变异测试（§3）与还原 | 每次还原后 `git diff --stat` 为空；最终 `git status --porcelain` 0 行 |

未运行：`npm run offline-check`（需真实业务数据目录，工作树无）、`npm run test:golden`（缺 `UOM_REFERENCE_ROOT`）、CI、PR、P2-13。

---

## 2. A–F 逐项结论

### A. 规格符合性 —— **FAIL**（M06、M08 未达；其余 PASS）

| 条目 | 结论 | 证据 |
| --- | --- | --- |
| M01 | PASS | 命令 7：5 包哈希与 `docs/modelevol-provenance.md` 一致；`git ls-files data/` 不含固化区 |
| M02 | PASS | `packages/core/src/model/ridge.ts` 唯一 Cholesky；`train-v06.ts:151-157` 经 `fitRidge` 一次算完 mean/std；守卫 `model.test.ts:176-182` |
| M03 | PASS | `metrics.ts` 导出 `top1Overlap/top3Overlap/top1Hit/top3Hit/shareMae/signTestPValue`；`model.test.ts:186-194` 断言 `cosineSimilarity` 与 core 同一函数；`model.test.ts:215-230` 两口径分歧用例 |
| M04 | PASS | `sample-package.ts:29` 走 `normalize/csv.js`；新代码无 `split(',')`；`model-v04.test.ts:406` 引号逗号用例；`package-lock.json` 无 `xlsx`；audit 0 |
| M05 | PASS | 命令 5：两组数字与 `scripts/fidelity-v04.mjs:42-57`、归档 manifest 逐位一致。注：**「容差 0」实现为 `toFixed(4)` 字符串比对**（`fidelity-v04.mjs:126-133`），与归档 4 位小数登记口径一致，脚本头已说明 |
| M06 | **FAIL** | 点号写法 `.fab` 被结构守卫抓住，但 **`input['fab']` 方括号写法与「fab 存在指示」变异均存活**（§3 变异 1a-implicit / 1b-implicit / 1b-bracket）。原因：`pipeline-v06.test.ts:222` 正则 `\.{forbidden}\b` 要求点号且先剥字符串字面量；`pipeline-v06.test.ts:204-215` 行为层用例的 clean/dirty **都先过投影层**，抽取器从未见到人工字段；`model-v04.test.ts:438-445` 只比较两段**都非空**的 fab，不含有/无对比。spec §9「变异接回 fab → 测试失败」未达 |
| M07 | PASS | 命令 5 第二组；`fidelity-v04.mjs:60-63` 冻结；`docs/match-model-baseline.md:66-67, 86-87` 写明「不能外推、须随 P2-13 重算」 |
| M08 | **FAIL** | 六阶段可跑（命令 6）、folds 文件确与归档一致、`03-run-ablation.ts:152` 基线只用 `train`（变异 5 被抓）、符号检验三级门槛有单测。**但 V4 在实际管线里是自比较**：`scripts/v06-pipeline.mjs:209` 算出 `foldsSha256`，`:275-276` 把同一变量同时传作 `frozenFoldsSha256` 与 `actualFoldsSha256`，`06-validate.ts:152-153` 比对恒等；冻结值 `2ca273cb…` 只在文档里，代码未钉住（全仓 grep 仅 result.md / baseline.md 命中）。**V12 的「独立复算」不独立**：`v06-pipeline.mjs:256-266` 用 `v06AccountMeanBaseline(dimension, trainSamples)` 生成 `foldBaselines`，`06-validate.ts:353` 用同一函数同一入参「复算」，`:357-360` 比对恒等，ablation 真正用到的基线从未被比对；且 `:351` `globalBaseline` 固定按 `'预测性别'` 算，却在 `:363-365` 对全部六个维度比较 → 5/6 维度是跨维度比较、必然「不同」。另 V10 `:320-325` 无条件 `pass` 却计入「12/12 pass」；V1 `:97-104`、V4 `:162-169` 输入缺失时默认 `pass`（V9 `:282-288` 是正确范例） |
| M09 | PASS | 命令 6：3 文件、`formatVersion: 1`、32 列 `<维度>__<标签>`；`export-model-package.test.ts` 黄金用例 `assert.equal`；命令 14 三方字节一致；`model-package.ts:209-213` 拒绝非 Staging |
| M10 | PASS | 命令 13；`register-model-mlflow.mjs:120-153` 登记 fail-closed（3 文件、formatVersion、Staging、data_sha256 重算、与 validation.json 核对）；model-mlflow 工作树干净（命令 12）；门槛结论如实进 manifest 与账本 |
| M11 | PASS | 根 `tsconfig.json` references 增 tool2；`tsconfig.base.json:8-9` strict + noUncheckedIndexedAccess；构建 0 报错 |
| M12 | PASS | 代码常量/断言中无 v0.7、v0.5、26Q4、v0.6 归档数字；无 `pls`；无 xlsx；画像解析为同名求和版；归档 LOO 回代错误（`orchestrate.ts:405-414` 确认存在）未被复刻，`03-select-alpha.ts` 无自有三角求解 |
| M13 | PASS | 固化区 gitignore；CI（`.github/workflows/check.yml`）只跑 `npm run check` + `npm audit`，不跑忠实门/管线；但 tracked **测试夹具**含真实记录，见 D |

### B. TDD 真实性 —— **PASS（第四单）/ NOT_PROVED（前三单历史 RED）**

- 第四单留档 `/tmp/uom-wt-p2/.local/p2/red-gate-conclusion.log`：TAP `# tests 18 / pass 12 / fail 6`，6 条失败全部 `failureType: 'testCodeFailure'`（`ERR_ASSERTION` / `Missing expected exception`），**行为失败非环境失败**，与 result.md §13.2「18/12/6」一致；`green-gate-conclusion.log` 18/18；`npm-test-green.log` 324/324。
- 该目录仅有 11-28 09:13–09:20 的第四单日志，与 §13.3「前几轮 RED 随工作树清理丢失」相符；result.md **如实披露、未补造**。
- 历史轮次（P2-3/4/6/7）RED 只能以 result.md §3.3/§4.4/§10.5 的计数为凭：**NOT_PROVED**。§4.5 第 3/4/5 条附带新增的测试（CSV 引号、readJsonl、assertTargetAlignment）无独立 RED 计数：NOT_PROVED。
- 未发现把后补测试写成历史 RED 的表述。

### C. 硬约束与变异测试 —— **FAIL**（见 §3；§9.2 变异 3 项存活，单一求解器守卫在 tool2 缺位）

### D. 数据不出网 —— **FAIL**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 零新增第三方依赖 | PASS | `package-lock.json` 差异仅新增 workspace 链接 `@uom/tool2-portrait-predict`（`@uom/core: *`） |
| 不引入 xlsx | PASS | 锁文件与源码无 `xlsx` |
| 新代码出网路径 | PASS（附应修） | 唯一 `fetch` 在 `register-model-mlflow.mjs:103,159`，默认 `http://127.0.0.1:5021`；但 `:57,65` 接受任意 `--url`/`MPS_MLFLOW_URL`，**无回环 host 校验**（S6） |
| CI 不触真实数据 | PASS | 见 M13 |
| 文档/result/夹具不含真实名称与数值样本 | **FAIL** | `packages/core/test/model-v04.test.ts:173-183`：从归档 `product_attributes.jsonl` 第 1 行**逐字抄入一款真实商品的完整记录**（真实款号、版型/面料属性、整段 FAB 营销卖点原文），注释自述「取自归档 work-package 第 1 行样本」。`.gitignore` 与 `check-data-guard.py` 只拦数据文件，拦不住测试里的业务内容。另真实款号常量见 S7 |

### E. 模型来源可溯 —— **PASS**

溯源 5 包一致（命令 7）；归档无 2026-11-26 后任何非 .DS_Store 改动、无非 .DS_Store 的 tracked 改动（命令 11）；model-mlflow 工作树干净、账本 `workspace/mlflow/` 与 `workspace/exports/` 在其 gitignore 区（命令 12）；账本只读查询：v1 Staging/READY、门槛结论完整入 params、无 Production（命令 13）。未起 MLflow server。

### F. 记录诚实性 —— **FAIL**（两处证据陈述不实；其余用词基本合规）

- 门槛 `FAIL_NOT_POSITIVE` 在 result.md §1/§8-16/§10.3–10.4/§12.2/§13.2、baseline.md §7.3、manifest、包 README 均显眼位置：PASS。
- 断网 e2e、黄金 G1–G5、CI、PR、P2-13、真实数据路径均如实 `NOT_RUN`；v0.6 归档数字 `NOT_PROVED`：PASS。
- **不实 1**：result.md §10.3 M08-2「V4 用冻结文件 sha256 比对通过」——实际是运行时哈希自比较（A/M08）。
- **不实 2**：result.md §10.3 M08-6「与评估期基线逐值比对」——实际比对的是脚本自算的同一函数结果，不是 ablation 用到的基线。
- 用词：§1 P2-9「部分完成」不在 `PASS/FAIL/NOT_RUN/UNKNOWN/NOT_PROVED` 之列（S8）。

---

## 3. 变异测试表

还原方式：先 `cp` 到 `.local/mut-backup/`，变异后 `cp` 回；变异 4 用手工反向 `Edit` 还原并删除新建文件。**未使用** `git checkout / reset / stash / restore`。

| # | 变异点 | 预期 | 实际 | 结果 | 还原证据 |
| --- | --- | --- | --- | --- | --- |
| 1a-implicit | `core/src/model/features-v04-compliant.ts` `extractCompliantBaseFeatures`：以 `['f','a','b'].join('')` 取键、存在即加 `fit_` 前缀特征（绕过类型层与结构守卫） | 测试失败 | 构建 0；`model-v04` + `pipeline` 49/49 pass | **SURVIVED** | `cp` 备份；`git diff --stat` 0 行 |
| 1a-explicit | 同处改为 `(input as unknown as {fab?: string}).fab` | 测试失败 | 1 fail：`结构层：合规抽取器源码不读取任何人工字段` | KILLED | 同上 |
| 1b-implicit | `tool2/.../v06/lib/features-v06.ts` `extractV06Tokens`：同 1a-implicit 手法 | 测试失败 | 构建 0；`pipeline-v06` + `export` 45/45 pass | **SURVIVED** | `cp` 备份；`git diff --stat` 0 行 |
| 1b-bracket | 同处改为 `(input as Record<string,string>)['fab']`（最自然写法） | 测试失败 | 45/45 pass | **SURVIVED** | 同上 |
| 2 | `tool2/src/export/model-package.ts` `deriveGateConclusion`：`perGate` 全写 `'PASS'`、`selectionGate:'PASS'` | 测试失败 | 2 fail（`门槛结论逐项与管线结果一致`、`gate5 由阶段 06 校验判定`） | KILLED | `cp` 备份；diff 0 行 |
| 3a | `scripts/fidelity-v04.mjs` 冻结 `strict23.top1` 末位 +1 | `test:fidelity-v04` FAIL | `strict-23 top1：实际 ≠ 期望 FAIL`，退出 1 | KILLED | `cp` 备份；diff 0 行 |
| 3b | `core/src/model/holdout-eval.ts:77` `share > 0` → `>= 0` | FAIL | 忠实门 PASS、单测 30/30 | SURVIVED（**等价变异**：留出数据实际侧无 share=0 行，过滤条件在该数据上无效；不作为忠实门缺陷） | `cp` 备份；diff 0 行 |
| 3c | `core/src/model/features-v04.ts:43` 面料词典首条改为不命中 | FAIL | 忠实门 9 项 FAIL（两组 top3/MAE/特征数 141≠156/交叉 80≠94）；单测 4 fail | KILLED | `cp` 备份；diff 0 行 |
| 4 | tool2 新建 `v06/lib/ridge-local.ts`（`invertMatrix` Gauss-Jordan + `fitRidgeLocal`），`train-v06.ts` 训练改走它、仅预测仍用 core | 结构守卫或评审识别 | 构建 0；`npm test` 412/412；`pipeline:v06` 12/12 PASS、系数区哈希由 `79669a0f…` 变为 `7a448251…` 仍「六阶段实跑通过」 | **SURVIVED**（无守卫；按发单记建议 S3；同时证明冻结系数哈希无机器校验 S2） | 反向 `Edit` + `rm ridge-local.ts`；`git status --porcelain` 0 行、diff 0 行；源码 grep `MUTATION` 0 命中 |
| 5 | `tool2/.../v06/03-run-ablation.ts:152` 基线改用全量 `samples` | 测试失败 | 1 fail：`基线是折内基线：评估折的基线不等于全量基线` | KILLED | `cp` 备份；diff 0 行 |

变异后终态：重新 `npm run build` + `npm test` 412/412；`git status --porcelain` 0 行。

---

## 4. 发现清单

### 4.1 阻断（进 PR 前必须修）

**B1 · §7：真实商品记录进入 tracked 测试文件**
`packages/core/test/model-v04.test.ts:173-183`。影响：PR 推送即把归档原始导出的一段逐字内容（含人工 FAB 卖点原文）送上远端，违反硬约束「业务数据不出网」与发单「夹具不得出现真实商品名称与数值样本」。
修正方向：改用能产出同一期望特征向量的**合成**输入（期望向量本身是词频计数，不含业务数值，可保留）；「与归档逐键一致」已由本地 `fidelity-v04` 在 107 样本上覆盖（result.md §4.3），不损失覆盖。

**B2 · M08：V4「folds 冻结」校验恒 PASS（自比较），冻结哈希未钉住**
`scripts/v06-pipeline.mjs:209, 275-276`；`06-validate.ts:150-170`；result.md §10.3 M08-2 证据陈述不实。
影响：folds.json 被重生成时管线 12/12 仍 PASS，并把新哈希写进 manifest 与账本。间接兜底只有 `verify-modelevol-provenance.mjs`（folds.json 在 27 文件包内，包哈希 `a85d6e99…` 已钉），但管线不跑它。
修正方向：在脚本或配置钉住 `FROZEN_FOLDS_SHA256`（与 baseline.md §7.4 同源）作为 `frozenFoldsSha256`；V4 缺输入时默认 `fail`（照 V9 写法）；补「V4：哈希不一致即 fail」反向单测；同步修正 result.md M08-2 文字。

**B3 · M08：V12「基线折内独立复算」不独立，且跨维度比较 bug**
`scripts/v06-pipeline.mjs:256-266`；`06-validate.ts:351-366`；result.md §10.3 M08-6 证据陈述不实。
影响：V12 无法发现 ablation 用了非折内基线；「≠全量基线」断言只对 `预测性别` 真实生效。
修正方向：让 `runV06Ablation` 返回逐折基线并把它传入 V12 比对；`globalBaseline` 改为逐维度计算；补「V12：传入错误基线即 fail」反向单测；同步修正 result.md M08-6 文字。

**B4 · M06/§9.2：守卫存在绕过路径（变异 1a-implicit、1b-implicit、1b-bracket 存活）**
`pipeline-v06.test.ts:204-215`（行为层未触达抽取器）、`:222`（正则只匹配点号访问）、`model-v04.test.ts:438-445`（只比较有/有）。
影响：以最自然的 `input['fab']` 方式接回人工字段，全部测试仍绿；spec §9「变异接回 fab → 测试失败」未达。
修正方向：行为层直接调用抽取器、绕过投影层注入人工字段，并加入「空 vs 非空」对比；结构守卫改为同时匹配 `\[\s*['"]fab['"]\s*\]` 等方括号访问（在剥字符串字面量**之前**匹配，或单独一遍）。

### 4.2 应修

**S1 · `productAttribute`（货品属性）归类与 spec §2.4 矛盾，未披露、未裁定 —— 需用户裁定**
`packages/tool2-portrait-predict/src/pipeline/v06/lib/types.ts:52-53` 把它标注为「上新类型／货品属性（客观属性）」；`features-v06.ts:80` `attr` 组；选中变体 `V1_minus_subcat` 含 `attr`，`usage.inputs` 与账本 `data_columns` 含 `productAttribute`。而 `spec.md` §2.4 原文把 `productAttribute`（货品属性）与心智产品/记忆点/群组打标并列为「同属人工判断字段」。只读抽查该列取值为三种生命周期类标签（不抄录），性质接近白名单「上新类型」；M06/D-P2-1 的禁读清单未列它，故**满足 M06 字面**。但硬约束边界被实现者自行重新归类，result.md §8 未披露。
修正方向：在 result.md §8 显式披露并取得用户裁定；若确认客观，按规范以用户确认另起版本说明修正 spec §2.4；若判人工，移除 `attr` 组、重跑管线并重新登记（V9/V4 哈希与 §7.2 数字随之变化）。

**S2 · 冻结系数区哈希与 v0.6 数字无任何机器校验**
`docs/match-model-baseline.md:164-166` 写「复跑必须逐位重现」，但 V9 只比连跑两次（变异 4 换求解器后哈希变为 `7a448251…` 仍全过）。
修正方向：在 `v06-pipeline.mjs` 对固化数据集钉住 `EXPECTED_COEFFICIENT_SHA256 = 79669a0f…`（与 V9 分开的一条断言），不一致即退出非 0；可选同时钉 `macroJsLift`。

**S3 · V10 恒 PASS 却计入「12/12 pass」**
`06-validate.ts:320-325` 无条件 `pass`，结果进入 `gate5DeterminedBy`、manifest 与账本。
修正方向：要么改为真实断言（如最终词表 ⊇ 各折词表、差异已写入工件），要么标 `info` 并从 pass 计数中排除。

**S4 · V1/V4 输入缺失时默认 pass（fail-open）**
`06-validate.ts:97-104`、`:162-169`。修正方向：照 V9（`:282-288`）缺输入即 `fail`。

**S5 · 登记脚本 URL 无回环校验**
`scripts/register-model-mlflow.mjs:57, 65, 103, 159`。影响：`--url http://<远端>` 会把模型包 artifact POST 到非本机。修正方向：`new URL(url).hostname ∈ {127.0.0.1, localhost, ::1}` 否则 `fail`。

### 4.3 建议

- **S6 · tool2 包无「单一求解器/单一指标」结构守卫**（变异 4 存活）。`model.test.ts:176-182, 265-278` 只扫 core 两个文件。建议在 tool2 测试加守卫：扫描 `packages/tool2-portrait-predict/src/**/*.ts` 不得出现 `invertMatrix|gaussJordan|adjugate|cofactor|function cosineSimilarity|Math.log2`，且 `fitRidge/predictRidge/jsSimilarity/...` 只从 `@uom/core/model/*` 导入。
- **S7 · 真实款号常量入库（与 main 先例一致）**：`03-select-alpha.ts:45, 51`、`scripts/fidelity-v04.mjs:9`（注释）、`docs/match-model-baseline.md:15, 24`、`pipeline.test.ts:53-54, 157-179`。main 上 `scripts/golden-tool1.mjs`、`packages/core/test/normalize.test.ts` 已有品牌/店铺/SPU/价格先例，故不升级；但 `docs/modelevol-provenance.md:4` 自述「不含任何业务数值」，建议用户明确「款号是否属业务数据」并统一口径。
- **S8 · 状态词**：result.md §1 P2-9「部分完成」改为合规状态词（按子项 `PASS`/`NOT_RUN`）。
- **S9 · 开放裁定未闭合**：result.md §8 第 15 条（冻结 folds 分层键含人工字段 `genderCorrected`）仍为「需裁定」、无【处置】；已如实披露，但进 PR 前应有用户结论或明确带入 PR 议题。
- **S10 · `package-lock.json` 不在 spec §6 允许路径**：仅为新增 workspace 链接的必然后果，建议在 §6 补一句追认以免下次复核争议。
- **S11 · V11** 实质是 TS 联合类型的运行时重述（`06-validate.ts:329-338`），弱但无害；可并入门槛选择函数的单测。

---

## 5. 结论

**FAIL —— 不建议以当前候选进 PR。** 阻断项：B1（真实商品记录入 tracked 测试）、B2（V4 自比较、冻结 folds 哈希未钉）、B3（V12 非独立复算 + 跨维度 bug）、B4（§9.2 守卫可被方括号/存在指示变异绕过）。B2/B3/B4 修复均为小改动并需各补一条反向单测；S1 需用户裁定后决定是改文档还是重跑重登记。

已独立确认的正面结论：忠实门两组数字容差 0 复现；v0.6 六阶段可跑且 V9/V4 哈希、数据指纹、`FAIL_NOT_POSITIVE` 与文档/账本逐位一致；模型包三方字节一致、Staging 登记如实、无 Production；零新增依赖、无 xlsx、归档与 model-mlflow 本体未被修改；第四单 RED 真实。

**本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。** 未验证项：`offline-check`、`test:golden`、CI、前三单历史 RED、真实用户数据路径（P2-13）。作者修复后须重验受影响范围（§9.2 守卫、V4/V12、夹具、result.md 对应段落）。
