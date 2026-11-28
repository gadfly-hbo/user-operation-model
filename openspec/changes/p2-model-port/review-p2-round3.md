# P2-Model-Port 独立复核报告 · 第三轮（review-p2-round3）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分；全程只读源码／测试／规格／数据／账本，唯一写入为本文件）
> 复核日期：2026-11-28
> 复核对象：作者按第二轮复核应修（R2-S1／R2-S2）与建议项 1–5 修单后的候选 `work/p2-model-port` @ **`c287587`**（范围限定复核，工程规范 §5.1）
> 结论：**FAIL（阻断 1 项，仅涉文档完整性；本轮代码实质通过）**；应修 4 项、建议 7 项，见 §4
> 本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

---

## 1. 候选身份与命令清单

### 1.1 候选身份

| 项 | 值 |
| --- | --- |
| 基线 | 本地 `main` @ `42de110`（merge-base 同为 `42de110`） |
| 候选 | `work/p2-model-port` @ **`c287587`**；相对 main 52 文件，全部落在 spec §6 允许路径内；禁区（`core/src/match/**`、`tool1-channel-match/**`、`data-mcp/**`、`site/web/**`）零改动 |
| 本轮差异 | `git diff c287587^ c287587`：10 文件（+622／−82）——导出器、V12、登记守卫（新）、两脚本、三测试文件、baseline 文档、result |
| 复核工作树 | `/tmp/uom-review-p2-r3`（`git worktree add --detach`）；临时文件只落其 gitignore 区 `.local/` |
| 数据 | 只读使用主仓 `data/archive-modelevol/`，未拷数据（篡改测试用符号链接根，仅 1 份 `folds.json` 副本被改 1 字节，该文件只含款号标识） |
| 账本 | model-mlflow `mlflow.db` 以 SQLite **只读**查询；**未启动 MLflow server、零登记、零 Stage 变更** |

### 1.2 预期清单（打开实现前导出）

- **R2-S1**：(a) `deriveGateConclusion` 在任一校验非 pass／V1–V12 不全／未知编号时抛错、不产出可登记包；(b) 管线 `failed > 0` 时不写不删 `models/` 下的包、退出非 0、既有包字节不变；(c) 登记脚本在**首个 HTTP 请求前**拒绝非 PASS 包（manifest 与 `validation.json` 两处），缺守卫即拒；(d) 校验 FAIL 与科学门槛 `FAIL_NOT_POSITIVE` 严格区分。
- **R2-S2**：`actualFoldsSha256` 改成 `pipeline.FROZEN_FOLDS_SHA256` 或字面量 → AST 守卫 FAIL；篡改 folds 一字节 → 真实 V4 路径 FAIL。
- **V12 新语义**：单维等值只记录不拦截；整折全维等值才 fail；泄漏（基线误用全量）仍 KILLED；「不误报」用例有区分力。
- **记录**：§8 第 20–25 条归位、编号连续、交叉引用一致；§1 P2-11 无歧义；baseline attr 说明 ≡ spec §2.4；夹具改值后允许集合未被放宽。
- **回归不得变化**：447/447、忠实门 `0.6957/0.9155/0.0825`、合规 `0.7754/0.9300/0.0759`、V4 `2ca273cb…`、V9 `79669a0f…`、`FAIL_NOT_POSITIVE`、五个守卫与 audit 全过。

### 1.3 实际运行的命令与结果（均在 `/tmp/uom-review-p2-r3`，除注明外）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-p2-r3 c287587`；`npm ci --ignore-scripts`；`npm run build` | 215 包、0 漏洞；`tsc -b` 退出 0 |
| 2 | `npm run check`（初态一次、全部变异还原后终态一次） | **退出 0；tests 447 / pass 447 / fail 0** |
| 3 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 退出 0；strict-23 `0.6957/0.9155/0.0825`、all-24 `0.7014/0.9190/0.0830`、alpha 50、83 行、156/94、温度六值、泄漏 5/5；合规 `0.7754/0.9300/0.0759`、alpha 50、泄漏 5/5 |
| 4 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol npm run pipeline:v06`（初态与终态各一次） | 退出 0；93 款、5 折 19/19/19/18/18；V1–V12 全 PASS；V4 `2ca273cb2a2b14df…`、V9 `79669a0f30938c0b…`；门槛 **`FAIL_NOT_POSITIVE`**；导出 v2 三文件，`predict.mjs` `9b742947…`、`README.md` `e1bef2a9…` |
| 5 | `node scripts/verify-modelevol-provenance.mjs` | 退出 0；5 包 PASS，内嵌 187 条一致 |
| 6 | `python3 .github/scripts/check-docs-links.py .`（**c287587 干净检出**） | **退出 1；125 条相对链接，错误 4，告警 0**（全部指向 `review-p2-round2.md`，见 B-1）。临时放入该未跟踪文件后复跑：退出 0、126 条 0 错（复现作者计数），测后删除 |
| 7 | `python3 .github/scripts/check-data-guard.py .` | 退出 0 |
| 8 | `npm run check:archive-content` | 退出 0；黑名单 85 条；tracked 文本 **179** 个，0 命中 |
| 9 | `npm audit --audit-level=high` | found 0 vulnerabilities |
| 10 | `sqlite3 -readonly "file:<model-mlflow>/workspace/mlflow/mlflow.db?mode=ro"` | `uom-tool2-portrait-v06` v1（run `eb3855e6…`）／v2（run `abd1e427…`）均 Staging/READY；最大版本 2；无 Production／Archived |
| 11 | `git -C <model-mlflow> status --porcelain`；归档 `git status --porcelain`（排除 `.DS_Store`）与 `find -newermt` | 均为空／0；归档 11-28 10:00 后改动文件 0；model-mlflow `workspace/` 10:30 后改动 0 |
| 12 | 包字节 `shasum -a 256`（我的复跑／实现者副本／model-mlflow `exports/…/v2`） | `predict.mjs`、`README.md` 三处逐位一致；manifest 相对已登记 v2 仅多 `gateConclusion.validationChecks` 与 `trainedAt` |
| 13 | 登记门密闭测试台（§2.1 表；fetch 被预加载模块记录并拦截、假 model-mlflow 根、回环关闭端口） | 12 个拒绝用例 **fetch 尝试 0**；正向用例停在首个请求（尝试 1） |
| 14 | `.local/v12-probe.mjs`、`.local/v4-probe.mjs`（真实管线产物，内存内改画像） | 见 §2.3、§2.2 |
| 15 | 变异测试（§3）与还原 | 每次还原后 sha256 ＝ 提交 blob、`git diff --stat` 0 行；**未使用** `git checkout / reset / stash / restore` |
| 16 | 只读查看 `/tmp/uom-wt-p2/.local/p2/fix-r2/` | 见 §2.6 |

未运行：`npm run offline-check`（e2e 段需真实业务数据）、`npm run test:golden`（缺 `UOM_REFERENCE_ROOT`）、CI、PR、真实 MLflow 登记序列、P2-13。

---

## 2. 各项结论

### 2.1 R2-S1 fail-closed 导出与登记门 —— 行为 **PASS**；接线层回归保护 **NOT_PROVED**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| ① 泄漏 → 不导出、退出非 0、既有包字节不变 | **PASS** | 变异 M1（`03-run-ablation.ts:161` 基线改用全量）：V12 FAIL → `阶段 06 有 1 条校验未通过——按 fail-closed 跳过模型包导出`，退出 1；`models/uom-tool2-portrait-v06/v2/` 三文件 sha256 **与 mtime（10:55:55）均不变**（失败运行 10:56:57）；诊断留在 `models/work-v06/validation.json`（V12=fail，无 stage） |
| ② 非 PASS 包在首个请求前被拒 | **PASS**（对下表全部构造） | 登记门测试台：`--url http://127.0.0.1:1`、假 model-mlflow 根、fetch 记录器（不发任何请求） |
| ③ 现状：全 PASS + `FAIL_NOT_POSITIVE` → 仍导出、登记门放行 | **PASS** | 命令 4 实跑导出 v2；manifest `selectionGate=FAIL_NOT_POSITIVE`、`gate5=PASS`、12 条 pass；用例 G 过全部前置、停在首个请求 `GET /health`（被拦截） |
| ④ 两种失败严格区分 | **PASS** | 导出器只看 `validationChecks`（`model-package.ts:186-200`），门槛结论如实入包；登记门只核校验记录与派生 `gate5`，不看 `selectionGate`；管线 `failed` 只计校验结果（`v06-pipeline.mjs:291-295`） |
| 守卫缺位即拒 | **PASS** | 脚本副本置于无 `dist` 的根 → `无法加载 url-guard／validation-gate…拒绝登记`，fetch 0 |
| 函数级回归保护 | **PASS** | M6a／M6b／M6d／M6e 四个「去掉拒绝」变异全部 KILLED |
| **脚本接线层回归保护** | **NOT_PROVED（应修 R3-S2、建议 R3-A1）** | M8a：删除登记脚本两处守卫调用后 75/75 全绿，一致失败包（用例 K）走到首个请求；M7b：管线导出门控文本不变而失效后 50/50 全绿 |

登记门测试台（干净脚本）：

| 用例 | 构造 | 结果 | fetch 尝试 |
| --- | --- | --- | --- |
| A | 既有好包 + 失败运行的 `validation.json`（M1 自然产生，V12=fail） | 拒：`管线产物…的 V12 校验结果不是 pass` | 0 |
| B | manifest `V4=fail`，`validation.json` 全 PASS | 拒：`manifest…的 V4 校验结果不是 pass` | 0 |
| C／C2 | manifest 全 PASS；`validation.json` 缺 V12／V12=fail | 拒：缺记录／不是 pass | 0 |
| D | manifest 无 `validationChecks`（已登记 v2 的形态） | 拒：`缺失或不是数组` | 0 |
| E | manifest 派生 `gate5=FAIL` | 拒 | 0 |
| F | manifest 记录顺序与管线产物不同 | 拒：`与管线产物不一致` | 0 |
| **G（正向）** | 全 PASS + `FAIL_NOT_POSITIVE` | 过全部前置，停在首个请求 | **1**（`GET http://127.0.0.1:1/health`，被拦截，未发出） |
| H | `validation.json` 缺失 | 拒 | 0 |
| I | manifest 缺 V10、多一条重复 V1（条数仍 12） | 拒：`缺少校验记录：V10` | 0 |
| J | manifest `result='PASS'`（大小写变体） | 拒 | 0 |
| K | 一致失败包：manifest 与 `validation.json` 同带 `V12=fail`、`gate5` 手标 PASS | 拒：manifest V12 不是 pass | 0 |

### 2.2 R2-S2 B2 守卫 —— 指定重放 **PASS**；同类绕过仍存在（**NOT_PROVED**，应修 R3-S1）

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| `actualFoldsSha256` → `pipeline.FROZEN_FOLDS_SHA256` | **PASS（KILLED）** | 变异 M4b：`结构守卫（R2-S2·AST）` FAIL（50：49/1）。二轮原样重放 M-B2-bypass（两处同改）、仅改断言实参（M4a）亦 KILLED |
| `actualFoldsSha256` → 字面量 | **PASS（KILLED）** | 变异 M4c：同守卫 FAIL |
| 改名中间量（`runtimeFoldsHash = foldsSha256`） | **PASS（KILLED）** | 变异 M4f：同守卫 FAIL |
| 行为层：篡改 folds 一字节 | **PASS** | 符号链接根（真实文件只读、仅 `folds.json` 副本 `seed` 首位 2→3，sha256 `30725a4d…`）：未变异管线在阶段 02 失败 `冻结 folds 哈希不一致：实际 30725a4d… ≠ 钉死 2ca273cb…`，退出 1，无任何产物；真实 folds 哈希不变。另以真实数据直调 `validateV06`：诚实哈希 V4=pass，篡改哈希 V4=fail，其余 11 项全 pass |
| **定义点绕过（自创）** | **SURVIVED** | 变异 M4d（`v06-pipeline.mjs:223` 改 `const foldsSha256 = pipeline.FROZEN_FOLDS_SHA256`）：全量 **447/447 全绿**；在篡改根上管线**退出 0、V4 PASS、12/12、导出 3 文件**，且日志打印的是钉死哈希而非文件实际哈希。M4e（`let` + 重赋值）同样 50/50。M4h（`:248` `coefficientHash` 同手法）50/50 |

### 2.3 V12 新语义 —— **PASS**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 泄漏仍 KILLED | **PASS** | M1：单测 4 条行为失败（含正向的「V12 不误报」用例），管线 V12 FAIL；M5g（复算≠提供判定失效）被「泄漏即 fail」「偏移即 fail」两条 KILLED |
| 单维等值只记录、整折全维才 fail | **PASS** | 独立探针（真实管线产物，内存内改画像）：1 维恒定 → pass、逐折记录该维；5 维恒定 → pass、记录 5 维；6 维恒定 → fail `折内性无法证明`；泄漏叠加 0／1／5 维恒定 → 全部 fail |
| 「不误报」用例有区分力 | **PASS** | M5b（退回旧语义「单维等值即 fail」）被该用例 KILLED；M5f（不再输出等值记录）被 `detail 须含「预测年龄」` 断言 KILLED；M5e（去掉整折判定）被「整折六维…必须被抓」KILLED |
| 文档同步 | **PASS** | `docs/match-model-baseline.md:174-177` 与 `06-validate.ts` 头注、V12 `check` 文本一致 |

### 2.4 记录与编号 —— **FAIL（B-1）**；其余 PASS，附应修 R3-S4

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| §8 第 20–25 条归位、编号连续 | **PASS** | §8 为 1–22（20＝S1 货品属性、21＝B1、22＝v2 登记，`result.md:443-476`）；§13.5 为 23–25「编号接 §8 第 22 条」；两组编号互换的说明在 `:863` |
| 交叉引用一致 | **PASS** | tracked 内对 §8 第 20／21／22 条的引用（`baseline.md:113`、`result.md:13,806`）均指向正确条目 |
| §1 P2-11 无歧义 | **PASS** | `result.md:30`「第一轮 FAIL → 修单（§14）→ 第二轮 PASS」，不再出现「PASS…结论 FAIL」并排 |
| baseline attr 说明 ≡ spec §2.4 | **PASS** | `baseline.md:113` 与 `spec.md:68` 均为「用户裁定追认为客观属性、三种生命周期标签、集合钉死 + 阶段 01 fail-closed」；`types.ts:77-81` 本轮未改 |
| 夹具改值后允许集合未放宽 | **PASS** | tool2 测试内 `'新品'` 0 处（改为 `'电商一年期'`）；集合仍为 `电商一年期／线下一年期／老品`；`core/test/normalize.test.ts` 的 `'新品'` 属工具1 上新类型列，非本字段 |
| **`check-docs-links` 在候选提交上** | **FAIL** | 见 B-1 |
| 第二轮建议项处置完整 | **应修** | R2-A2、R2-A6 在 result.md 中 0 处提及（R3-S4） |

### 2.5 回归 —— 除 `check-docs-links` 外全部 **PASS**

忠实门两组数字容差 0；V4／V9 双哈希与 `FAIL_NOT_POSITIVE` 逐位不变；`verify-modelevol-provenance`、`check-data-guard`、`check:archive-content`、`npm audit` 全过；禁区零改动；`predict.mjs`／`README.md` 与已登记 v2 逐字节一致；账本 v1／v2 Staging、无 v3、无 Production；归档与 model-mlflow 本体未被触碰。**`check-docs-links` 在 c287587 干净检出上为 FAIL（B-1）**。

### 2.6 TDD 真实性（本轮） —— **PASS**

`red-r2.log`：TAP `tests 75 / pass 65 / fail 10`，10 条全部 `failureType: 'testCodeFailure'`，0 条导入／环境错误；登记守卫 4 条为骨架 `not implemented: assertStage06ChecksRegistrable`（与项目既有口径一致），其余 6 条为对既有实现的行为断言失败（导出器 3、V12 不误报 1、管线导出门控结构守卫 1、登记入口结构守卫 1），拆分与作者所述一致。守卫类用例（V4 行为层、AST）对修单前正确脚本本就通过，作者未称其 RED，而以变异日志佐证：`mutation-b2-old-guard-survives.log` 46/46 → `replay-mb2-bypass.log` 报错文本与我的 M4b 逐字一致。`green-full-check.log` 447/447。历史轮 RED 仍为 NOT_PROVED（与一、二轮一致）。

---

## 3. 变异表

还原一律为字节备份 `cp` → `touch` → 重建，并核对 sha256 ＝ 提交 blob、`git diff --stat` 0 行、`dist/` 无标记（TS 目标）。**未使用** `git checkout / reset / stash / restore`。

| # | 变异点 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| M1 | `03-run-ablation.ts:161` 基线改用全量 `samples` | 单测失败；管线不导出、包不变 | pipeline-v06 50：46/4（行为失败）；管线退出 1、V12 FAIL、跳过导出；v2 包三文件 sha256 与 mtime 不变 | **KILLED** |
| M4-full | `v06-pipeline.mjs:226,287` → 常量（二轮 M-B2-bypass 原样） | AST 守卫 FAIL | 50：49/1 | **KILLED** |
| M4a／M4b／M4c／M4f | `:226` 实参→常量／`:287`→常量／→字面量／→别名 | AST 守卫 FAIL | 各 50：49/1 | **KILLED** |
| **M4d** | `:223` 定义点 `const foldsSha256 = pipeline.FROZEN_FOLDS_SHA256` | 守卫 FAIL | pipeline-v06 50/50、全量 447/447；篡改根上管线退出 0、12/12、导出 | **SURVIVED** |
| M4e／M4h | `:223` `let` + 重赋值为常量／`:248` `coefficientHash` 定义点→常量 | 守卫 FAIL | 各 50/50 | **SURVIVED** |
| M5b | `06-validate.ts:431` 退回旧语义（单维等值即 fail） | 不误报用例 FAIL | 50：49/1 | **KILLED** |
| M5e／M5f | `:436` 去掉整折判定／`:441` 不再输出等值记录 | FAIL | 各 50：49/1 | **KILLED** |
| M5g | `:426` 复算≠提供判定运行时失效 | FAIL | 50：48/2 | **KILLED** |
| M6a／M6b | `model-package.ts:187`／`:196` 去掉失败／缺记录拒导出 | FAIL | 三文件 75：各 74/1 | **KILLED** |
| **M6c** | `model-package.ts:186` `!== 'pass'` → `=== 'fail'` | FAIL | 75/75 | **SURVIVED** |
| M6d／M6e | `validation-gate.ts:64` 宽松比较／`:73` 去掉缺记录拒绝 | FAIL | 各 75：74/1 | **KILLED** |
| M7a | `v06-pipeline.mjs:327-331` 导出门控整块删除 | 结构守卫 FAIL | 50：49/1 | **KILLED** |
| **M7b** | `:327` `failed > 0 && false`（文本不变、门控失效），叠加 M1 | — | 50/50；管线：导出器抛错退出 1，但**预置的既有包目录已被 `rmSync` 删除** | **SURVIVED** |
| **M8a** | `register-model-mlflow.mjs:162-166,197-201` 两处守卫调用删除 | 结构守卫 FAIL | 75/75；A–F 仍被交叉核对／gate5／形态拦下，**K 走到首个请求** | **SURVIVED** |

终态：`npm run check` 447/447；干净管线 12/12、双哈希不变；`git status --porcelain` 0 行。

---

## 4. 发现清单

### 4.1 阻断（进 PR 前必须处理）

**B-1 · 固定候选上 `check-docs-links` 为 FAIL，result.md 却记 PASS**
`openspec/changes/p2-model-port/result.md:14、30（两处）、840` 链接 `review-p2-round2.md`；`git cat-file -e c287587:…/review-p2-round2.md` 不存在——该第二轮报告只在实现者工作树里未跟踪（`??`），不在候选提交内。`result.md:369`（§7.4）记「126 条…错误 0」**PASS**、`:863` 记「125 条 0 错」。
影响：以 c287587 直接开 PR，仓库内留 4 条断链，P2-11 行「第二轮 PASS」的证据指针悬空，且记录对固定候选不实（属发单「回归不得变化」项：二轮在干净检出上为 122 条 0 错）。CI 完整模式不跑该检查（`.github/workflows/check.yml:90-91` 仅 docs 模式），不会自动暴露。
处置：把 `review-p2-round2.md` 与本报告随 PR 入库后复跑 `python3 .github/scripts/check-docs-links.py .`（预期 0 错），并同步修正 §7.4 措辞。此项不涉及代码，无需实现者返工。

### 4.2 应修（PR 内一并处理或紧随其后；均不改变当前候选的行为正确性）

**R3-S1 · B2／S2 钉死守卫只锁「使用点」形态，可经「定义点」退回自比较**
`scripts/v06-pipeline.mjs:223`（`foldsSha256` 定义）、`:248`（`coefficientHash` 定义）；守卫 `packages/tool2-portrait-predict/test/pipeline-v06.test.ts:1110-1194` 只判使用点标识符是否叫 `foldsSha256`／`coefficientHash`，不看这两个变量在哪、怎样得到。
影响（M4d 实测）：一行定义点变异 → 447/447 全绿；篡改 folds 的根上管线 12/12 并导出，日志打印钉死哈希而非文件实际哈希——与二轮 R2-S2 同一本质，只是换了入口。
方向：稳的做法是让 `validateV06` 接收 `foldsPath` 自算哈希并内部调用钉死断言（去掉两个入参，二轮已建议）；最小补丁是 AST 追加对两个变量声明的判定（`const`、无重新赋值、初始化式分别为 `createHash('sha256').update(readFileSync(foldsPath)).digest('hex')` 与 `pipeline.v06CoefficientHash(artifact)`）。

**R3-S2 · 登记入口的结构守卫以声明位置充当「调用点」，删掉守卫调用后测试全绿**
`test/register-validation-gate.test.ts:79-87`：`source.indexOf('assertStage06ChecksRegistrable')` 命中的是 `scripts/register-model-mlflow.mjs:126` 的 `let` 声明，而非 `:163`／`:198` 的调用。
影响（M8a 实测）：两处调用删除后 75/75；manifest 与 `validation.json` 同带失败记录、`gate5` 手标 PASS 的包（用例 K）可过全部前置走到首个请求。`result.md:855`「守卫在任何请求发出前调用（结构守卫测试锁定）」表述过强。
方向：AST 统计 `assertStage06ChecksRegistrable(...)` 调用 ≥ 2 且先于首个 `fetch(`/`mlflowApi(` 调用；或把前置校验抽成可单测函数。

**R3-S3 · 第二轮建议 7 项中 2 项无处置记录**
`result.md:838` 标题写「建议项 1–5」，表中缺 R2-A2（归档内容守卫抽样盲区）与 R2-A6（S6 为命名绊线），全文 0 处提及。
影响：读者会以为二轮建议已全部处置。方向：补两行「本单不修／留待后续」。

**R3-S4 ·（候选外，未复核）实现者工作树未提交的 §16 预先写下本轮结论**
`/tmp/uom-wt-p2/openspec/changes/p2-model-port/result.md`（mtime 10:52:41，未提交，不在 c287587 内）新增 §16「专项最终检查」，写有「独立复核…三轮完成」「发现的问题：无阻断」「结论：通过」并链接尚未存在的本报告。
影响：与本轮结论（B-1 阻断、R3-S1／R3-S2 应修）不符；入库前须按本报告改写，§5.3 结论不得先于复核结论落笔。该项我未复核其内容。

### 4.3 建议

- **R3-A1 · 管线导出门控同为文本守卫，且 `rmSync` 先于内存构建**（`v06-pipeline.mjs:327-331、359-360`）。M7b 实测：门控失效时导出器自身仍 fail-closed（退出 1、不产出包），但既有包目录已先被删除。现状不可达（校验 FAIL 时门控先触发；全 PASS 时导出器不抛），属纵深。方向：先 `buildV06ModelPackage`（内存）再 `rmSync` + 写盘；脚本直接复用 `assertStage06ChecksRegistrable`（需从 `index.ts` 导出，现仅导出 `url-guard`）替代自计数。
- **R3-A2 · 导出器对非 `pass/fail` 字面值的严格比较未被测试锁定**（M6c 存活，`model-package.ts:186`）；登记守卫同款已锁定。补一条 `'PASS'`／`undefined` 结果值的导出拒绝用例即可。
- **R3-A3 · V1–V12 编号表与「齐全且全 pass」判定有两份字面拷贝**（`model-package.ts:126-127、180-200` 与 `validation-gate.ts:20-33、48-78`），注释称「同源约定」但无共享常量；建议导出器直接调用 `assertStage06ChecksRegistrable`。
- **R3-A4 · `06-validate.ts:417、433`** `anyDimensionProvesFoldInternal` 只写不读。
- **R3-A5 · `docs/match-model-baseline.md:113`** 白名单括注并列「上新类型」与「货品属性」，但包内 `usage.inputs` 无「上新类型」列（实际为 `category/fabric/fit/ipCollab/productAttribute/season/specialFunctionMaterial`），易被读成两个输入。
- **R3-A6 · 计数与拆分**：`result.md:371`「177 个」实为 179（本轮新增 2 个 tracked 文件）；`:363`「+11」总数正确，但导出器净增 2（新 3 条中 1 条替换旧 gate5 用例）、管线文件净增 4（「结构守卫（R2-S1）」未列）；旧 20–22 与 23–25 两组编号互换仅在 `:863` 说明，二轮报告（历史件）里的「§8-23＝S1」按新编号会指到别的条目，建议在 §8 顶部加一行新旧对照。
- **R3-A7 · 还原方法提醒**：`cp -p` 还原保留旧 mtime，`tsc -b` 视为未变更，`dist/` 会残留变异 JS（本轮实际遇到，已 `touch` + 重建并核对）。作者对 `dist` 做的变异已确认还原（实现者工作树 `03-run-ablation.js:65` 为 `train`）。

---

## 5. 结论

**FAIL —— 不建议以 `c287587` 现状直接进 PR。** 唯一阻断 B-1 是文档完整性问题：候选提交链接了未入库的第二轮报告，`check-docs-links` 在干净检出上失败而记录写 PASS。**入库 `review-p2-round2.md` 与本报告、复跑链接检查后即建议进 PR**；受影响范围仅文档链接与记录措辞，重验成本很低，无需第四轮全量复核，也不需要实现者改代码。

已独立确认的正面结论：R2-S1 行为闭合（泄漏 → V12 FAIL → 不导出、既有包字节与 mtime 不变、退出 1；12 类非 PASS 包全部在首个请求前被拒；全 PASS + `FAIL_NOT_POSITIVE` 照常导出并放行到首个请求；两种失败严格区分）；R2-S2 指定的三种重放全部被 AST 守卫 KILLED，篡改 folds 一字节在阶段 02 与真实 V4 路径均 FAIL；V12 新语义在 7 个独立场景下符合声明且泄漏仍被抓住；忠实门、双哈希、`FAIL_NOT_POSITIVE`、五个守卫、审计、禁区、账本与归档只读性均无回归；本轮 RED 证据真实。

应修 R3-S1（定义点绕过）与 R3-S2（登记守卫接线可删）表明：两个脚本里的接线仍只有文本／形态层面的回归保护，函数级守卫本身是扎实的。建议按「自包含判定 + 可单测的前置函数」收口，而不是继续叠加形态规则。

---

## 6. 未验证项与说明

- `offline-check` e2e 段、`test:golden`（G1–G5）、CI、PR、P2-13 真实数据路径：**NOT_RUN**（与 result.md 口径一致）。
- 真实 MLflow 登记序列（`register-model-mlflow.mjs:213-347`）：**NOT_RUN**——按发单不登记；本轮该段未改，仅以 fetch 记录器验证到首个请求为止。
- 历史轮（P2-3／4／6／7）RED：仍 **NOT_PROVED**。
- §16「专项最终检查」、阶段门禁、§5.3、CI、产品验收：不在本复核范围，本报告不代替。
- 原始日志存于复核工作树 `.local/`（63 份），随工作树清理删除、未持久化；关键输出已摘入本报告 §1–§3。
- 复核期间实现者工作树出现的未提交改动（§16）非本人所为；主仓 `git status` 全程为空。
