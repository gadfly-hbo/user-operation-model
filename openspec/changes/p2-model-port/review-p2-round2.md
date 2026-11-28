# P2-Model-Port 独立复核报告 · 第二轮（review-p2-round2）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分；全程只读源码／测试／规格／数据／账本，唯一写入为本文件）
> 复核日期：2026-11-28
> 复核对象：作者按第一轮复核（[review-p2.md](review-p2.md)，结论 FAIL）修单后的候选
> 结论：**PASS（无阻断）**；应修 2 项、建议 7 项，见 §5。**建议进 PR**（应修项改动很小，建议在 PR 内一并处理或紧随其后）。
> 本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

---

## 1. 候选身份与命令清单

### 1.1 候选身份

| 项 | 值 |
| --- | --- |
| 基线 | 本地 `main` @ `42de110`（merge-base 同为 `42de110`） |
| 候选 | `work/p2-model-port` @ **`096ccaa`**（`096ccaac9758f52b1023188a31591e3bfd3b0adb`） |
| 差异 | `git diff --stat main...096ccaa`：50 文件，+10787 / −1；全部落在 spec §6 允许路径内（§4.D 核对） |
| 复核工作树 | `/tmp/uom-review-p2-r2`（`git worktree add --detach`，构建产物、`models/`、临时文件均落在 gitignore 区 `.local/`） |
| 数据 | 只读使用主仓 `data/archive-modelevol/`（v04-holdout、v06-tmall-25q4），**未拷数据、未出网**（B2 篡改实测用符号链接临时根，仅 93 个款号标识组成的 folds.json 被篡改 1 字节，测后删除） |
| 账本 | model-mlflow `workspace/mlflow/mlflow.db` 以 SQLite **只读**（`-readonly` + `mode=ro`）查询；未启动 MLflow server（5021 无监听） |

### 1.2 预期清单（打开实现前，从 spec §4 M01–M13 与第一轮 B1–B4／S1–S5 导出）

- **B1** 夹具为合成样本且期望向量与词典手算一致；tracked 文件无真实款号／FAB 片段；新守卫黑名单运行时取自固化区、不入库、不把真实内容写进日志；把第一轮真实记录塞回 tracked 测试 → 守卫 FAIL；还原后 `git diff` 为空。
- **B2** `FROZEN_FOLDS_SHA256` 与 `docs/match-model-baseline.md` 逐位一致；V4 用钉死值 vs 运行时哈希（不自比较）；篡改 folds 一字节 → 必 FAIL。
- **B3** V12 独立复算不调用 `v06AccountMeanBaseline`；全量基线逐维度；ablation 基线泄漏 → V12 必 FAIL。
- **B4** 第一轮三个存活变异（v0.4 join 拼键＋存在指示／v0.6 同手法／v0.6 `input['fab']`）必 KILLED；自创绕过如实记录由哪层杀死。
- **S1** `productAttribute` 三种生命周期标签钉死、逐样本 fail-closed 含空值；spec §2.4／实现／result 三者一致。
- **S2** 系数区 sha256 钉死并与文档一致；换求解器 → 必 FAIL。**S3** V10 真判定。**S4** V1／V4 缺输入即 fail。**S5** `--url` 只接受回环。
- **S6** tool2 加 `invertMatrix` → 必 FAIL。**S8** 状态词。**S9** §8-15 已追认。**S7／S10** 工程规范 §7.1、溯源自述、spec §6 一致且不与硬约束 1 矛盾。
- **C** 忠实门 strict-23 `0.6957/0.9155/0.0825`、合规 `0.7754/0.9300/0.0759` 容差 0；V4 `2ca273cb…`、V9 `79669a0f…`；`FAIL_NOT_POSITIVE` 如实；model-mlflow 工作树干净，v1／v2 均 Staging、无 Production；v2 manifest／predict 与我复跑一致（predict 与 v1 逐字节一致）。
- **D** 全部检查实跑；result §14 每条 PASS 有证据且不夸大；未运行项保持 NOT_RUN；无「整体通过」类表述；全仓无属性组合／文案／数值样本（§7.1 新口径）。

### 1.3 实际运行的命令与结果（均在 `/tmp/uom-review-p2-r2`，除注明外）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-p2-r2 096ccaa` | OK |
| 2 | `npm ci --ignore-scripts` → `npm run build` | 215 包；`tsc -b` 退出 0 |
| 3 | `npm run check` | **退出 0；tests 436 / pass 436 / fail 0**（变异全部还原后终态再跑一次，同结果） |
| 4 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 退出 0；strict-23 `0.6957/0.9155/0.0825`、all-24 `0.7014/0.9190/0.0830`、alpha 50、83 行、156/94、温度六值、泄漏 5/5；合规 `0.7754/0.9300/0.0759`、alpha 50、泄漏 5/5 —— 全 PASS |
| 5 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol npm run pipeline:v06` | 退出 0；93 款、5 折 19/19/19/18/18；选中 `V1_minus_subcat`；**`FAIL_NOT_POSITIVE`**；V1–V12 全 PASS；V4 `2ca273cb2a2b14df…`、V9 `79669a0f30938c0b…`；导出 v2 3 文件 |
| 6 | `node scripts/verify-modelevol-provenance.mjs` | 退出 0；5 包 PASS（含 187 条内嵌清单） |
| 7 | `python3 .github/scripts/check-docs-links.py .` | 退出 0；**122** 条链接 0 错 0 告警（result §7.3 写 118，计数陈旧） |
| 8 | `python3 .github/scripts/check-data-guard.py .` | 退出 0 |
| 9 | `npm run check:archive-content` | 退出 0；黑名单 85 条（运行时取自主仓固化区）；扫 tracked 文本 **177** 个（result 写 172，陈旧）；0 命中 |
| 10 | `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| 11 | `node --import ./scripts/offline-check/block-net.mjs scripts/register-model-mlflow.mjs --url http://example.com:8080 …`（及 `MPS_MLFLOW_URL=http://192.168.1.10:5021`） | 两次均退出 1：「必须是本机回环…拒绝」；断网守卫记录**出网尝试 0 次** |
| 12 | `sqlite3 -readonly "file:<model-mlflow>/workspace/mlflow/mlflow.db?mode=ro"` | RegisteredModel `uom-tool2-portrait-v06`：**v1 Staging/READY**（run `eb3855e6…`）、**v2 Staging/READY**（run `abd1e427…`）；Production/Archived 0；alias 0；两 run FINISHED；v1 与 v2 的 run params **逐字相同**（`selection_gate=FAIL_NOT_POSITIVE`、gate1/2/4 FAIL、gate3/5 PASS、`frozen_folds_sha256=2ca273cb…`、`coefficient_region_sha256=79669a0f…`、`macro_js_lift=0.0095752873551487`、`stage_ceiling=Staging`） |
| 13 | 包字节 `shasum -a 256`（exports v1/v2、run artifacts v1/v2、我的复跑、作者工作树） | `predict.mjs` 六处同为 `9b742947…`（**v2 与 v1 逐字节一致**）；`README.md` v2 四处同为 `e1bef2a9…`；`manifest.json` v2 exports＝run artifact＝作者工作树 `29e233bd…`，我的复跑与之语义 diff 仅 `training.trainedAt`；v1↔v2 manifest 仅 `model.version`（1→2）与 `trainedAt` |
| 14 | `git -C <model-mlflow> status --porcelain` | 空（HEAD `22590f5`） |
| 15 | `find ~/Dev/Archive/ModelEvol -newermt 2026-11-26 -type f`（排除 .DS_Store/.qoder）；`git status --porcelain` 分类 | 改动文件 **0**；13 条全为原有 untracked（`??`），tracked 改动 0 |
| 16 | 自写穷举扫描 `.local/scan-archive-content.mjs`（只输出路径／计数） | 见 §2.A B1 |
| 17 | 守卫探针 `.local/probe-b1-guard.mjs`（整条记录／仅 FAB／仅属性组合） | 见 §2.A B1 与 §4 变异表 |
| 18 | 变异测试（§4）与还原 | 每次还原后 `git diff --stat` 0 行；终态 `git status --porcelain` 0 行；复核工作树／主仓／作者工作树／model-mlflow 四处状态均空 |

未运行：`npm run offline-check`（e2e 段需真实业务数据）、`npm run test:golden`（缺 `UOM_REFERENCE_ROOT`）、CI、PR、P2-13 —— 与 result.md 的 NOT_RUN 口径一致。

---

## 2. A. 第一轮阻断是否真正关闭

### B1 · 真实商品记录进 tracked 测试 —— **PASS（已关闭）**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 夹具为合成样本 | PASS | `packages/core/test/model-v04.test.ts:208-214`：`SYN-0001`／`修身型`／`棉氨纶混纺罗纹`／`休闲慵懒显高级，设计感剪裁，垂坠面料，日常百搭`。我的扫描 [e]：这些面料／卖点片段在 v0.4 固化区出现 **0 次**（`修身型` 为通用版型词典值） |
| 期望向量手算 | PASS（11 项全部一致） | 按 `features-v04.ts` 词典逐项手算：`修身型`→`fit_slim`；面料 `棉氨纶混纺罗纹` 命中 棉／氨纶／罗纹／混纺 → `fabric_cotton/spandex/rib/blend` 各 1；卖点 61 条风格词命中 休闲＋慵懒（casual 2）、设计感＋剪裁（designer 2）、高级（premium 1）、百搭（versatile 1）；14 条功能词命中 垂坠（drape 1）；7 条场景词命中 日常（daily 1）；卖点无面料词典词（「面料」不是条目）。与 `:215-227` 的期望完全一致 |
| tracked 无真实款号／FAB | PASS | 穷举扫描：199 个款号中仅 **2 个**出现在 7 处（`03-select-alpha.ts:45,51`、`pipeline.test.ts:53,179`、`fidelity-v04.mjs:9`、`baseline.md:15,24`、`result.md:791`），均为泄漏门禁的重叠／重复款号**标识**，未与属性或文案组合（S7 口径）；**107 条 FAB 全文 10-gram 13072 个窗口 0 命中**；319288 行画像 CSV、31745 行画像 md 整行 0 命中；IP 联名取值 0 命中 |
| 守卫黑名单运行时取、不入库 | PASS | `scripts/check-no-archive-content.mjs:78-140` 运行时读固化区构造；脚本与仓库不含任何片段（穷举扫描覆盖守卫脚本本身） |
| 守卫不回显真实内容 | PASS | `:190` 命中只输出 `路径（黑名单 #编号（来源标签，长度 N））`；`:200` 同；无任何写文件调用 |
| 守卫 fail-closed | PASS | 补丁副本（`.local/guard-patched.mjs`，固化区不可达）→ 退出 1「找不到归档固化区…fail-closed」 |
| 塞回真实记录 → FAIL → 还原 | PASS | 整条记录（train 第 1 行）→ **退出 1**（黑名单 #0/#1 fab 片段、#2 记录前缀）；仅 FAB → 退出 1；还原后文件 sha256 `77e61ee5…` 与提交 blob 逐位一致、`git status` 0 行 |
| 守卫覆盖盲区（记录，不升级） | 见建议 R2-A2 | 仅「属性组合」（去款号、去 FAB）注入 → 守卫 **退出 0**；黑名单为抽样（`:39` 前 12 条记录／每条 2 片段／6 行 CSV／8 个 md） |

### B2 · V4 自比较、冻结哈希未钉 —— **PASS（已关闭）**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 钉死值与文档逐位一致 | PASS | 脚本比对：`frozen-inputs.ts:21` `FROZEN_FOLDS_SHA256 = 2ca273cb2a2b14df…7ad22` ＝ `baseline.md:165` ＝ `result.md:668` ＝ **固化区 folds.json 实际 sha256**；`:24` `EXPECTED_COEFFICIENT_SHA256 = 79669a0f…d6fa` ＝ `baseline.md:128,164` |
| V4 钉死值 vs 运行时哈希 | PASS | `scripts/v06-pipeline.mjs:217` 运行时算 `foldsSha256`；`:220` `assertFrozenFoldsSha256(foldsSha256)`；`:280-281` `frozenFoldsSha256: pipeline.FROZEN_FOLDS_SHA256, actualFoldsSha256: foldsSha256`；`06-validate.ts:160-183` 比对两入参，缺任一即 fail |
| 篡改 folds 一字节 → FAIL | PASS | 符号链接临时根，`"seed":20260911→20260912`（差 1 字节）：管线**退出 1**，阶段 02 `冻结 folds 哈希不一致：实际 e97a9a0d… ≠ 钉死 2ca273cb…`（`frozen-inputs.js:33` ← `v06-pipeline.mjs:220`）；主仓固化区 folds.json 哈希不变；临时根已删 |
| 结构守卫回归覆盖 | **应修 R2-S2** | 自创变异 M-B2-bypass（把 `:220` 改为断言常量自身、`:281` 改为 `actualFoldsSha256: pipeline.FROZEN_FOLDS_SHA256`）：`npm test` 436/436 全绿；篡改根上管线退出 0 且 `V4 PASS`——守卫 `pipeline-v06.test.ts:1050-1066` 只锁 `frozen` 侧与函数名 |

### B3 · V12 非独立复算＋跨维度 bug —— **PASS（已关闭）**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 不调用 `v06AccountMeanBaseline` | PASS | `06-validate.ts:29-42` 导入清单无该函数；`:371-386` 本地 `meanDistribution` 独立实现；`:411` 用它复算 |
| 全量基线逐维度 | PASS | `:399-402` 对 `V06_TARGET_DIMENSIONS` 逐维 `meanDistribution(dataset.samples, dimension)`；`:421-424` 按本维度断言 |
| 比对的是 ablation 实际使用的基线 | PASS | `03-run-ablation.ts:161-162` 同一 `baseline` 对象既用于打分（`:172-180`）也记入 `foldBaselines`；`v06-pipeline.mjs:270` `ablation[0]?.foldBaselines`；缺键即 fail（`:414-417`） |
| 泄漏 → FAIL（实做） | PASS | 变异 B3-LEAK（`:161` 改用 `samples`）：单测 46 中 **3 fail**（基线是折内基线／消融返回实际基线／完整输入全 pass）；管线**退出 1**，`V12 FAIL · fold:0:预测性别 与独立复算结果不一致（ablation 基线可疑）…` |

### B4 · §9.2 守卫绕过 —— **PASS（三个存活变异重放全 KILLED）**

| 变异 | 结果 | 杀死层 |
| --- | --- | --- |
| ① v0.4 join 拼键＋存在指示 | KILLED（`model-v04` 32：fail 1） | 行为层「绕过投影层…有／无 fab 特征一致」（`model-v04.test.ts:468-487`） |
| ② v0.6 join 拼键＋存在指示 | KILLED（64：fail 1） | 行为层（`pipeline-v06.test.ts:242-269`） |
| ③ v0.6 `(input as Record<string,string>)['fab']` | KILLED（64：fail 2） | 结构守卫「不得以方括号／模板键／in 形态访问」（`:287-289`，正则 `:160-165` 在保留字符串字面量的源码上匹配）＋行为层 |

自创绕过（如实记录）：`Reflect.get(input,'fab')`、解构 `const {fab} = input`、v0.4 `Object.keys` 动态取键、v0.6 声明式规格 `field:'fab'` 注入 —— **全部 KILLED**，但前三个**结构守卫均未命中、只靠行为层**；声明式注入由「特征组只引用白名单字段」用例（`:187-203`）＋行为层杀死。**一个更深的手法存活**（解构读 fab 且以内容为条件，见 §4 O5 与建议 R2-A1）。

作者修单轮 RED 证据（只读查看 `/tmp/uom-wt-p2/.local/p2/fix-review/`）：`red-batch.log` TAP `# tests 81 / pass 64 / fail 17`，17 条 `failureType: 'testCodeFailure'`，无 `ERR_MODULE_NOT_FOUND`／导入失败；`green-batch.log` 81/81；`green-full-test.log` 436/436；三份 `replay-*.log` 的失败用例与我独立重放结果**逐条一致**；`red-b1-guard.log` 命中 1 处（旧夹具）→ `green-b1-guard.log` 0 命中。**修单轮 TDD 真实性：PASS。**

---

## 3. B. 应修与建议项 · C. 冻结数字与登记 · D. 回归与诚实性

### B. 应修与建议项

| 项 | 结论 | 证据 |
| --- | --- | --- |
| S1 `productAttribute` | PASS | `types.ts:77-81` 钉死 `['电商一年期','线下一年期','老品']`；`84-92` 集合外（含空值）抛错；`01-prepare-dataset.ts:214` 逐样本断言（值已 `trim`）；测试 `pipeline-v06.test.ts:407-458`（集合锁定／合法放行非法抛错／阶段 01 端到端 exceljs 造表拒绝）。实跑 93 款全部在集合内。spec §2.4（`spec.md:68`）、result §8-23（`result.md:777-786`）、实现三处一致 |
| S2 系数区钉死 | PASS | 换求解器（临时 `ridge-local.ts` Gauss-Jordan `invertMatrix`，训练改走它）：管线阶段 04 **退出 1**「实际 7a448251… ≠ 期望 79669a0f…」（与第一轮变异 4 观测哈希一致）；S6 守卫同时 FAIL |
| S3 V10 真判定 | PASS | `06-validate.ts:315-350` 逐折重算 OOF 词表断言超集；把 `:344` 改回恒 `'pass'` → 单测「V10：最终词表缺折内 OOF 词项即 fail」FAIL（KILLED） |
| S4 V1／V4 缺输入 fail | PASS | `06-validate.ts:105-113`、`:172-182`；单测 `:918-947` |
| S5 `--url` 回环 | PASS | `url-guard.ts:12-33`（`new URL` 归一化后主机名 ∈ {127.0.0.1, localhost, ::1}；`localhost@evil`／`0.0.0.0`／内网均拒）；`register-model-mlflow.mjs:119-134` 在任何 `fetch`（`:104,175`）之前调用，模块加载失败即拒；实测见 §1.3 #11 |
| S6 单一求解器／指标守卫 | PASS（对指定场景）／有限（见 R2-A6） | `pipeline-v06.test.ts:1033-1048`：加 `invertMatrix` → FAIL「疑似内嵌第二份求解器」；换名（`inv`/`fitLocal`）→ 436/436 全绿（命名绊线，真正机器锁是 S2 钉死哈希，且只在本地跑） |
| S8 状态词 | PASS（附建议 R2-A3） | result.md 全文无「部分完成／整体通过／验收通过」类状态词；`全绿` 仅用于带计数的命令结果描述；§1 P2-11「PASS…结论 FAIL」措辞易误读 |
| S9 §8-15 | PASS | `result.md:400-401`「【已追认 2026-11-28，主 agent】」 |
| S7／S10 文档一致 | PASS | `engineering-workflow.md:199`（diff 仅此 1 行）；`modelevol-provenance.md:4`「款号只是标识符、不属业务数据」；`spec.md:164`（package-lock.json）、`:166`（§7.1 一行）。全仓无任何文档称款号属业务数据；与 AGENTS.md 硬约束 1 不矛盾（标识符口径写在 §7.1 同一约束下） |

### C. 冻结数字与登记一致性 —— **PASS（无回归）**

- 忠实门两组数字容差 0（§1.3 #4）；管线 V4 `2ca273cb…`、V9 `79669a0f…`（#5）；`FAIL_NOT_POSITIVE` 在管线输出、manifest `gateConclusion.selectionGate`、账本 params、baseline.md §7.3 均如实（#5、#12、#13）。
- model-mlflow：工作树干净；v1／v2 **均 Staging/READY**、无 Production／Archived／alias；v2 的 `predict.mjs`、`README.md` 与我复跑及作者工作树逐字节一致，`manifest.json` 仅 `trainedAt` 不同；`predict.mjs` 与 v1 逐字节一致（#13）。

### D. 回归与诚实性 —— **PASS（附建议 R2-A3）**

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `check`／`test` 436／`fidelity`／`pipeline`／`provenance`／`docs-links`／`data-guard`／`archive-content`／`audit` | 全部 PASS | §1.3 #3–#10 |
| result §14 每条 PASS 有证据 | PASS | B1–B4、S1–S6 我均独立重放或实测（§2、§3.B）；§14.2 三条 KILLED 证据与我的重放一致 |
| 未运行项 | 如实 NOT_RUN | §7.3、§14.5-5：断网 e2e、黄金 G1–G5、CI、PR、P2-13 均保持 NOT_RUN |
| 「整体通过」类表述 | 未发现 | grep 无命中；§10.3「M08 整体：PASS」紧随「但：M08 不含模型质量达标」的限定，属对 M08 验收条目本身的陈述 |
| 全仓内容扫描（§7.1 新口径） | PASS | §2.A B1：无属性组合／文案／数值样本；仅 2 个标识符款号、通用词典值（版型／面料词／品类名／季节码／生命周期标签） |
| 范围与边界 | PASS | 变更文件全部在 spec §6；`packages/core/src/match/**`、tool1、data-mcp、site/web 未动；CI 工作流未改且不跑 fidelity／pipeline／archive-content；只读脚本无写调用；新代码仅登记脚本有 `fetch`（回环守卫之后） |
| 归档只读性 | PASS | §1.3 #15 |

---

## 4. 变异表

还原方式：先 `cp` 到 `.local/mut-backup/`，变异后 `cp` 回；新建文件用 `rm` 删除并清理 `dist/` 残留后重建。**未使用** `git checkout / reset / stash / restore`。

| # | 变异点 | 预期 | 实际 | 结果 | 还原证据 |
| --- | --- | --- | --- | --- | --- |
| R1（重放 1a-implicit） | `core/src/model/features-v04-compliant.ts` `extractCompliantBaseFeatures`：`[['f','a','b'].join('')]` 取键，存在即加 `fit_fab_present` | 测试失败 | build 0；`model-v04` 32：pass 31 / fail 1（行为层 有／无 fab） | **KILLED**（行为层） | `cp` 备份；diff 0 行 |
| R2（重放 1b-implicit） | `tool2/.../lib/features-v06.ts` `extractV06Tokens`：同手法加 `attr_<fab>` | 测试失败 | 64：63 / 1（行为层） | **KILLED**（行为层） | 同上 |
| R3（重放 1b-bracket） | 同处 `(input as unknown as Record<string,string>)['fab']` | 测试失败 | 64：62 / 2（结构守卫＋行为层） | **KILLED**（结构＋行为） | 同上 |
| O1（自创） | 同处 `Reflect.get(input as object, 'fab')` | — | 63 / 1（行为层）；**结构守卫未命中** | KILLED（仅行为层兜底） | 同上 |
| O2（自创） | 同处 `const { fab: fabText } = input as unknown as Record<string,string>` | — | 63 / 1（行为层）；结构守卫未命中 | KILLED（仅行为层兜底） | 同上 |
| O3（自创） | v0.4 `Object.keys(input)` 动态匹配键名加 `fit_fab_present` | — | 31 / 1（行为层）；结构守卫未命中 | KILLED（仅行为层兜底） | 同上 |
| O4（自创） | v0.6 `V06_FEATURE_GROUPS.attr` 注入 `{ field: 'fab' as keyof …, prefix: 'attr_', kind: 'onehot' }` | — | 62 / 2（「特征组只引用白名单字段」＋行为层）；归属用例未触发 | KILLED（声明式白名单＋行为层） | 同上 |
| **O5（自创）** | v0.6 解构读 fab，**仅当含「显瘦」时**加 `attr_fab_slimming` | — | **64 / 64 全绿** | **SURVIVED**（结构／行为／归属三层均未命中） | 同上 |
| B3-LEAK | `03-run-ablation.ts:161` 基线改用全量 `samples` | 单测＋V12 FAIL | 单测 46：43 / 3；管线退出 1，`V12 FAIL …与独立复算结果不一致` | **KILLED** | `cp` 备份；diff 0；干净管线复跑 12/12 |
| S2／S6 | 新建 `lib/ridge-local.ts`（`invertMatrix` Gauss-Jordan + `fitRidgeLocal`），`train-v06.ts` 两处 `fitRidge` 改走它 | S6 FAIL＋管线 FAIL | `npm test` 436：435 / 1（S6 守卫）；管线阶段 04 退出 1（`7a448251…` ≠ `79669a0f…`） | **KILLED** | `rm` 临时文件＋dist 残留；status 0 行 |
| S6-bypass（自创） | 同一求解器换名 `inv`／`fitLocal` | — | `npm test` 436 / 436 全绿 | SURVIVED（S6 为命名绊线；同数值路径已由 S2 钉死哈希证明会抓） | 同上 |
| S3-V10 | `06-validate.ts:344` V10 `result` 恒 `'pass'` | 测试失败 | 46：45 / 1 | **KILLED** | `cp` 备份；diff 0 |
| **M-B2-bypass（自创）** | `scripts/v06-pipeline.mjs:220` → `assertFrozenFoldsSha256(pipeline.FROZEN_FOLDS_SHA256)`；`:281` → `actualFoldsSha256: pipeline.FROZEN_FOLDS_SHA256`（常量比常量） | 结构守卫 FAIL | `npm test` 436 / 436 全绿；篡改根上管线**退出 0**、`V4 PASS · frozen folds sha256 2ca273cb…`（实际 folds 为 `e97a9a0d…`） | **SURVIVED** | `cp` 备份；sha256 `27d22a9c…` 与提交 blob 一致 |
| B1-guard-full | train 第 1 行整条记录追加到 `core/test/model-v04.test.ts` 末尾 | 守卫 FAIL | 退出 1（#0/#1 fab 片段、#2 记录前缀） | **KILLED** | sha256 与提交 blob 一致；status 0 |
| B1-guard-fab | 仅追加该记录的 FAB 文本 | 守卫 FAIL | 退出 1（#0/#1） | **KILLED** | 同上 |
| B1-guard-attrs（自创） | 仅追加去款号、去 FAB 的属性组合 JSON | 守卫应 FAIL（§7.1） | 退出 0 PASS | **SURVIVED（守卫盲区）** | 同上 |
| B2-tamper | 符号链接临时根，folds.json `seed` 改 1 字节 | 管线 FAIL | 退出 1，阶段 02 `冻结 folds 哈希不一致` | **KILLED** | 固化区哈希不变；临时根已删 |

变异后终态：`npm run check` 436/436；`check:archive-content` PASS；`git status --porcelain` 0 行；tracked 文件 `REVIEW-MUTATION／REVIEW-PROBE` 标记 0 处；`dist/` 无 `ridge-local*／lin-local*` 残留。

---

## 5. 发现清单

### 5.1 阻断

无。第一轮 B1–B4 均经独立重放／实测确认关闭。

### 5.2 应修（建议 PR 内一并处理；改动都很小）

**R2-S1 · 阶段 06 有校验 FAIL 时管线仍导出／覆盖模型包，登记脚本不拦截 gate5=FAIL**
`scripts/v06-pipeline.mjs:284-315`（校验后无条件落盘）、`:343-373`（`rmSync` 后无条件导出到 `models/uom-tool2-portrait-v06/v2`，即登记脚本的默认 `--package`）、`:378-381`（最后才 `fail`）；`scripts/register-model-mlflow.mjs:136-169`（前置校验只核 3 文件／formatVersion／Staging／gateConclusion 存在／data_sha256／`selection.gate` 与 `winner.name`，**不核 V1–V12 是否全 pass**）。
影响（B3-LEAK 实测）：V12 FAIL 时管线退出 1，但 `models/.../v2/manifest.json` 已被重写并带 `gate5=FAIL（11/12 pass）`；随后登记脚本能通过全部前置校验、只卡在账本不可达——即一个 fail-closed 失败的包仍可被登记为 Staging。当前候选在固化数据上 12/12、账本条目诚实，故不升级为阻断。
修正方向：`failed > 0` 时不导出登记包（或导出到隔离目录），仅保留 `work-v06` 诊断产物；登记脚本增加「`validation.json` 全部 `pass` 且 manifest `gate5 == 'PASS'`」前置校验；补一条反向单测。

**R2-S2 · B2 结构守卫形态特异，可经 `actual` 一侧退回自比较**
`packages/tool2-portrait-predict/test/pipeline-v06.test.ts:1050-1066`：只断言含 `frozenFoldsSha256: pipeline.FROZEN_FOLDS_SHA256`、不含 `frozenFoldsSha256: foldsSha256`、含 `assertFrozenFoldsSha256`／`assertFrozenCoefficientSha256`、含 `ablation[0]?.foldBaselines`；**未锁** `actualFoldsSha256: foldsSha256` 与 `assertFrozenFoldsSha256(foldsSha256)` 的实参。
影响（M-B2-bypass 实测）：把断言改成常量比常量、`actual` 改成常量后 436/436 全绿，篡改 folds 的根上 V4 仍 PASS。
修正方向：守卫追加 `source.includes('actualFoldsSha256: foldsSha256')` 与 `source.includes('assertFrozenFoldsSha256(foldsSha256)')`；更稳的做法是让 `validateV06` 接收 `foldsPath` 自行算哈希并内部调用 `assertFrozenFoldsSha256`，使 V4 自包含、不再依赖调用方传两个值。

### 5.3 建议

- **R2-A1 · §9.2 三层守卫存在一个「内容条件型」盲区（O5 存活）**。`features-v06.ts:136-164`；守卫在 `pipeline-v06.test.ts:160-180`（结构：四类静态形态）、`:242-269`（行为：有／无 fab 与两段 fab 文本）、`:291-349`（归属）。解构＋`as unknown as` 读 fab 且以内容为条件时三层都不命中。实际数据流里 `fab` 到不了抽取器（`01-prepare-dataset.ts:217-227` 显式白名单投影、`run-v04-fidelity.ts:90` `projectCompliantInput`、类型层无该字段），故为纵深防御的缺口而非生产漏洞。低成本加固：结构守卫增加「剥注释后源码上 `\bfab\b` 等禁读字段的裸标识符／整串字面量命中即失败」（v0.4 需豁免 `COMPLIANT_FORBIDDEN_FIELDS` 声明行或把常量移出抽取器文件）；行为层探针增加一段含词典触发词的 fab 文本。
- **R2-A2 · 归档内容守卫是抽样黑名单，不覆盖「仅属性组合」**。`scripts/check-no-archive-content.mjs:39`（12 条记录／2 片段／6 行／8 文件）、`:104-107`（记录前缀 60 字符含款号）、`:183-185`（tracked 文件不可读时静默 `continue`）。按 §7.1 新口径属性组合属业务数据，建议增加「去款号去 FAB 的属性组合 JSON」needle 或全量遍历 107 条记录；不可读文件应计数并告警。
- **R2-A3 · result.md 结构与计数**：§8 第 23–25 条物理位置在 §14.6 之后（`result.md:777-806`），不在 §8（§8 止于第 22 条 `:419`），读者在 §8 找不到 S1／B1／v2 登记的裁定与处置；§1 P2-11 状态「**PASS**（…结论 **FAIL**…）」（`:28`）易被读成复核通过，建议改为「已完成（第一轮 FAIL → 第二轮见 review-p2-round2.md）」之类不与状态词混淆的写法；§7.3 计数陈旧（链接 118→实跑 122；守卫扫描 172→实跑 177）。
- **R2-A4 · `docs/match-model-baseline.md:113`** 特征集行以「上新类型」指代 `attr` 组，未写明它读的是 `货品属性（productAttribute）` 及 2026-11-28 追认口径（result §8-23、spec §2.4 已写）。
- **R2-A5 · V12「折内 ≠ 全量」断言可能误报**（`06-validate.ts:421-424`）：折均值与全量均值巧合相等、或某维度画像恒定时会 fail；作者夹具注释 `pipeline-v06.test.ts:115-116` 已自述该巧合。方向是 fail-closed（安全），但 P2-13 真实数据上可能误拦，建议在 `baseline.md §7.5` 限制项记录，或在「复算==提供」时降级为记录项。
- **R2-A6 · S6 守卫为命名绊线**（`pipeline-v06.test.ts:1036-1037`）：换名的第二份求解器可过单测；真正的机器锁是 S2 钉死哈希，且只在本地有固化数据时运行（CI 不跑）。建议在 result/baseline 如实记为已知限制。
- **R2-A7 · 夹具取值习惯化**：`pipeline-v06.test.ts:110` `syntheticSample` 用 `'新品'` 作 `productAttribute`（不在 S1 锁定集合内；夹具绕过阶段 01 故不触发），建议改用合法值。

---

## 6. 结论

**PASS —— 建议以 `096ccaa` 进 PR。** 无阻断项：第一轮 B1–B4 经独立重放与实测确认关闭（三个存活变异 KILLED；folds 一字节篡改即 FAIL；基线泄漏即 V12 FAIL；真实记录塞回即守卫 FAIL 且还原逐字节一致）；S1–S6、S8、S9、S7／S10 均有对应证据；冻结数字、`FAIL_NOT_POSITIVE`、v1／v2 Staging 登记与账本一致且无 Production；`check`／`test` 436／忠实门／管线／溯源／链接／数据守卫／归档内容守卫／审计全部实跑通过；归档与 model-mlflow 本体未被修改；修单轮 RED 证据真实。

应修 2 项（R2-S1 校验失败仍导出可登记包＋登记不核 V-checks；R2-S2 B2 结构守卫可经 `actual` 一侧退回自比较）与建议 7 项均不改变当前候选的正确性结论，建议在 PR 内一并处理或紧随其后立项。

**本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。** 未验证项：`offline-check` e2e 段、`test:golden`（G1–G5）、CI、PR、P2-13 真实数据路径；前三单历史 RED 仍为 NOT_PROVED（与第一轮一致）。
