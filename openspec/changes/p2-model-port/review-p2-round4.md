# P2-Model-Port 独立复核报告 · 第四轮（review-p2-round4，范围限定）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分；全程只读源码／测试／规格／数据／账本，唯一写入为本文件）
> 复核日期：2026-11-28
> 复核对象：作者按第三轮复核应修（R3-S1／R3-S2／R3-S3）与建议项修单后的候选 `work/p2-model-port` @ **`f390894`**（规范 §5.1「作者修复后重验受影响范围」）
> 结论：**PASS（无阻断）**；应修 1 项（记录状态陈旧，仅文档）、建议 6 项，见 §4。**建议进 PR**（入库前由主 agent 顺手更新 result.md §1 三行即可）。
> 本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

---

## 1. 候选身份与命令清单

### 1.1 候选身份

| 项 | 值 |
| --- | --- |
| 基线 | 本地 `main` @ `42de110`（merge-base 同为 `42de110`） |
| 候选 | `work/p2-model-port` @ **`f390894`**（`git rev-parse` = `f39089493726c7a5a83540cd1f094bd1c20f1351`） |
| 本轮差异 | `git diff --stat c287587 f390894`：10 文件（+1094／−33）——`568777e` 入库 round2／round3 报告；`fc55ddb` 修单；`f390894` 回填链接检查。全部落在 spec §6 允许路径内 |
| 相对 main | 54 个文件，全部落在 spec §6 允许路径内；禁区（`core/src/match/**`、`tool1-channel-match/**`、`data-mcp/**`、`site/web/**`）`git diff --stat` 为空 |
| 复核工作树 | `/tmp/uom-review-p2-r4`（`git worktree add --detach`）；临时文件只落其 gitignore 区 `.local/`（`git check-ignore -v` 命中 `.gitignore:34:*.local`） |
| 数据 | 只读使用主仓 `data/archive-modelevol/`（`UOM_ARCHIVE_FIXED_ROOT`），未拷数据；篡改测试用符号链接沙箱根，仅 1 份 `folds.json` 副本翻 1 字节（seed 首位 2→3，sha `30725a4d…`），真实文件哈希前后均为 `2ca273cb…ad22` |
| 账本 | model-mlflow `mlflow.db` 以 `sqlite3 -readonly …?mode=ro` 查询；**零登记、零 Stage 变更**；未启动 MLflow server |
| 实现者工作树 `/tmp/uom-wt-p2` | 只读查看 `.local/p2/fix-r3/` 日志；`git status --porcelain` 仅其原有 ` M result.md`（§16，非本人所为） |

### 1.2 预期清单（打开实现前导出）

- **R3-S1**：(a) `foldsSha256` 定义点改 `pipeline.FROZEN_FOLDS_SHA256`／字面量／`let`＋重赋值 → AST 守卫 FAIL；`coefficientHash` 定义点改常量 → FAIL；(b) 自创形态（别名中间量、`??`／`||` 兜底、函数作用域遮蔽）逐项记录 KILLED／SURVIVED；(c) 行为层：真实脚本路径＋篡改 folds → 阶段 02 FAIL、无包导出；(d) 还原后 `git diff` 为空、sha256＝提交 blob。
- **R3-S2**：(a) 删除登记脚本两处守卫调用 → AST 守卫 FAIL；(b) fetch 打桩用例零联网：非 PASS 包 fetch 尝试 0；回环外 URL fetch 前拒绝；(c) 自创形态（守卫后移、IIFE 包裹、调用保留但实参置空吞错、`fetch` 别名）逐项记录。
- **R3-S3**：§15.2 补 R2-A2／R2-A6；§7.4 链接检查行改为干净检出条件；干净检出 `check-docs-links` 退出 0。
- **回归不得变化**：454/454；忠实门 `0.6957/0.9155/0.0825`、合规 `0.7754/0.9300/0.0759` 容差 0；V4 `2ca273cb…`、V9 `79669a0f…`；`FAIL_NOT_POSITIVE`；`verify-modelevol-provenance`、`check-data-guard`、`check:archive-content`、`npm audit` 全过；禁区零改动；model-mlflow 工作树干净、账本 v1／v2 Staging、无 Production。

### 1.3 实际运行的命令与结果（均在 `/tmp/uom-review-p2-r4`，除注明外）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-p2-r4 f390894`；`npm ci --ignore-scripts`；`npm run build` | 退出 0；found 0 vulnerabilities；`tsc -b` 退出 0 |
| 2 | `npm run check`（初态一次、全部变异还原＋重建 dist 后终态一次） | **两次均退出 0；tests 454 / pass 454 / fail 0 / skipped 0** |
| 3 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` | 退出 0；strict-23 `0.6957/0.9155/0.0825`、all-24 `0.7014/0.9190/0.0830`、alpha 50、83 行、156/94、温度六值、泄漏 5/5；合规 `0.7754/0.9300/0.0759`、alpha 50、泄漏 5/5 |
| 4 | `UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol npm run pipeline:v06`（初态／终态各一次） | 退出 0；93 款、5 折 19/19/19/18/18；V1–V12 全 PASS；V4 `2ca273cb2a2b14dff9d2ae857e170aa02db89c0f50e36ced84f2625f4087ad22`、V9 `79669a0f30938c0b837589998adc4270d093050bd4c980400e76ee357568d6fa`；门槛 **`FAIL_NOT_POSITIVE`**；导出 v2 三文件 |
| 5 | 包字节 `shasum -a 256`（我的复跑／实现者副本／model-mlflow `exports/…/v2`） | `predict.mjs` `9b742947…`、`README.md` `e1bef2a9…` 三处逐位一致；manifest 相对已登记 v2 结构差异仅 2 处：`gateConclusion.validationChecks`（新增）、`training.trainedAt`（非确定性溯源区） |
| 6 | `node scripts/verify-modelevol-provenance.mjs` | 退出 0；5 包 PASS，内嵌 187 条一致 |
| 7 | `python3 .github/scripts/check-docs-links.py .`（**f390894 干净检出**） | **退出 0；检查相对链接 128 条，错误 0，告警 0**（与 §15.5 所记 128 条一致） |
| 8 | `python3 .github/scripts/check-data-guard.py .` | 退出 0 |
| 9 | `npm run check:archive-content` | 退出 0；黑名单 85 条；tracked 文本 **181** 个，0 命中（与 §7.4 所记一致） |
| 10 | `npm audit --audit-level=high` | found 0 vulnerabilities |
| 11 | `sqlite3 -readonly "file:<model-mlflow>/workspace/mlflow/mlflow.db?mode=ro"` | `uom-tool2-portrait-v06` v1（run `eb3855e6…` 09:18:01）／v2（run `abd1e427…` 10:08:58）均 Staging/READY；`current_stage` 非 Staging 计数 0；`workspace/` 内最后写入 10:08:58（早于第三轮），本轮零写入 |
| 12 | `git -C <model-mlflow> status --porcelain`；`find <ModelEvol 归档> -newermt 2026-11-26 -type f`（排除 .DS_Store／.qoder） | 空；0 个文件（归档 `??` 条目为其原有 untracked 状态，非改动） |
| 13 | 禁区 `git diff --stat 42de110 f390894 -- packages/core/src/match packages/tool1-channel-match packages/data-mcp site/web` | 空 |
| 14 | `node --test …/dist/test/pipeline-v06.test.js`（初态） | 52/52，skipped 0（本机可达固化数据，行为层用例实跑） |
| 15 | `node --test …/dist/test/register-validation-gate.test.js`（初态） | 8/8 |
| 16 | 手工行为层：`.local/tamper-root`（逐文件符号链接真实包，仅 `folds.json` 篡改副本）→ `node scripts/v06-pipeline.mjs --root .local/tamper-root --out .local/tamper-out --package-dir .local/tamper-pkg` | **退出 1**；阶段 01 通过后阶段 02 `冻结 folds 哈希不一致：实际 30725a4d… ≠ 钉死 2ca273cb…`；`--out`／`--package-dir` 目录均未创建；真实 folds 哈希不变 |
| 17 | 直接探针 `.local/probe-k.mjs`（未变异脚本，fetch 打桩，合成夹具） | 一致失败包 K → 退出 1、`V12 校验结果不是 pass`、**fetch 0**；全 PASS 好包 → 过全部入口守卫、停在首个 `GET …/health`（fetch 1，被拦截）；`--url http://example.com:8080` → `必须是本机回环`、**fetch 0** |
| 18 | 变异测试（§3）：`.local/mutate.mjs`（先核对全部锚点命中数再改；运行后由内存字节备份还原并核对 sha256＝HEAD blob） | 见 §3；每次还原后 `git status --porcelain` 0 行 |
| 19 | 只读查看 `/tmp/uom-wt-p2/.local/p2/fix-r3/` 日志与备份 | 见 §2.5 |
| 20 | 终态：`npm run build`（`touch` 后重建）→ `grep -c R4-M7b dist/src/export/model-package.js` | 0（dist 无变异残留） |

出网说明：唯一网络访问为任务指定命令 `npm ci`／`npm audit` 访问 npm registry（依赖元数据）；无业务数据出网，`fetch` 打桩用例零联网。

未运行：`npm run offline-check`（e2e 段需真实业务数据）、`npm run test:golden`（缺 `UOM_REFERENCE_ROOT`）、CI、PR、真实 MLflow 登记序列、P2-13。

---

## 2. 各项结论

### 2.1 R3-S1 定义点守卫 —— **PASS**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 指定重放 M4d／M4e／M4h、二轮 M4c | **PASS（全部 KILLED）** | 变异表 §3：AST 守卫 `pipeline-v06.test.ts:1206-1327` 报「定义点绕过，复核 M4d」「必须以 const 定义（复核 M4e）」「coefficientHash 必须由 pipeline.v06CoefficientHash(artifact) 运行时派生…实际：pipeline.EXPECTED_COEFFICIENT_SHA256」 |
| 自创形态 N1 别名中间量／N2 `??` 兜底／N3 `\|\|` 兜底 | **PASS（KILLED）** | 各 52：50/2、51/1、51/1；报「禁止以字面量／常量标识符／别名中间量直接赋值」「必须经 digest('hex') 产出」 |
| 自创形态 N4 函数作用域遮蔽 `createHash`（形态不变、语义篡改） | **AST SURVIVED／行为层 KILLED** | 52：51/1——「篡改 folds 的根上管线必须失败，实际退出码 0」（M4d 同款输出）。结论：形态守卫不解语义，由行为层（`:1401-1465`）兜底；CI 无固化数据时该用例 skip（见 R4-A1） |
| 行为层（作者用例本名实跑） | **PASS** | 初态／终态 `npm run check` skipped 0，本机实跑通过 |
| 行为层（我的手工复现） | **PASS** | 命令 16：阶段 02 FAIL、无包导出、无产物目录、真实文件哈希不变 |
| M4d 双杀 | **PASS** | 52：50/2（AST＋行为层），与作者 `replay-r3s1-m4d-killed.log` 计数一致 |

### 2.2 R3-S2 登记入口守卫 —— **PASS**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 指定重放 M8a（删两处调用） | **PASS（双杀）** | 8：6/2——AST「必须至少实际调用两次…实际 0 处」＋行为层一致失败包失败 |
| 自创 N5 守卫调用挪到首个请求之后 | **PASS（双杀）** | 8：6/2——AST「校验记录核验调用（语句 17）必须先于首个请求（语句 6）」＋行为层 |
| 自创 N6 两处调用包 IIFE 箭头函数 | **PASS（AST FAIL，保守）** | 8：7/1——「实际 0 处」（嵌套函数不计入 main 流程）；行为层 3 条仍过。守卫对无害形态也拒绝，属保守而非漏报 |
| 自创 N7 调用保留、实参置 `[]` 并吞错 | **AST SURVIVED／行为层 KILLED** | 8：7/1；直接探针（N7＋K 包）→ **fetch 尝试 1**（`/health`），由「一致失败包…fetch 调用次数为 0」用例抓住 |
| 自创 N8 `fetch` 别名（`httpFetch`）＋守卫后移＋后续补一条直呼 `fetch` | **AST SURVIVED／行为层 KILLED** | 8：7/1；探针 K 包 fetch 尝试 1。AST 只认 `fetch` 本名，行为层兜底 |
| 自创 N9 仅把管线产物那一处核验调用实参置空并吞错 | **AST SURVIVED／行为等价** | 8/8 全绿；但探针 K 与 M（manifest 全 PASS、validation.json 带 V12=fail）仍被拒且 fetch 0——manifest 核验＋「记录逐条一致」比对（`register-model-mlflow.mjs:202-208`）兜底，第二处调用为纵深冗余（R4-A4） |
| 行为层用例（零联网） | **PASS** | 命令 15、17：K → fetch 0；回环外 URL → fetch 0；好包 → 恰好 1 次 `/health` 被拦截 |
| 脚本实现零改动 | **PASS** | `register-model-mlflow.mjs` 在 `c287587..f390894` 无差异（sha `12e8d567…` 两提交相同） |

### 2.3 R3-A1／A3／A4 重验（§15.5 第 2 项点名） —— **PASS**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| R3-A1 清理顺序 | **PASS（变异 KILLED）** | `model-package.ts:367-387`：先 `buildV06ModelPackage`（内含 `deriveGateConclusion` fail-closed）再 `rmSync`；变异 R4-M7b（把 `rmSync` 挪到构建前）→ `export-model-package.test.js` 22：21/1（「构建抛错时不得动既有包目录」）；脚本已无自带 `rmSync`（`v06-pipeline.mjs:45` 导入表、`:390` 传 `cleanDirectoryFirst: true`） |
| R3-A3 清单单一来源 | **PASS** | `model-package.ts:35,127` 引用 `register/validation-gate.ts:20` 的 `STAGE06_CHECK_IDS` |
| R3-A4 死变量 | **PASS** | `grep anyDimensionProvesFoldInternal packages/tool2-portrait-predict/src` 0 处 |
| R3-A2（导出器严格比较未被测试锁定，三轮 M6c） | **NOT_RUN（如实）** | `model-package.ts:187` 仍 `!== 'pass'`；`result.md:919` 记 NOT_RUN，未冒充已修 |

### 2.4 R3-S3 与记录 —— 记录内容 **PASS**；任务状态表陈旧 **应修（R4-S1）**

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| §15.2 补 R2-A2／R2-A6 | **PASS** | `result.md:870`（R2-A2 本单不修、`NOT_PROVED`）、`:871`（R2-A6 记为已知限制）；`docs/match-model-baseline.md:178` 新增 S6 命名绊线说明；`scripts/check-no-archive-content.mjs` 本轮零改动 |
| §7.4 链接检查行改为干净检出条件 | **PASS** | `result.md:372`：「在两份复核报告入库后的干净检出上 PASS；入库前干净检出曾有 4 条断链（第三轮 B-1）；…结果记于 §15.5」 |
| 干净检出链接检查（f390894） | **PASS** | 命令 7：128 条，0 错，退出 0（B-1 关闭确认） |
| §1 P2-11／P2-10 行与首段 | **应修** | `result.md:33` 仍「第一轮 FAIL → 修单（§14）→ 第二轮 PASS」，未反映第三轮 FAIL（B-1）与 B-1 已关闭；`:4`「P2-11 起未开工」；`:32` P2-10 行只指到 §7.3；第七轮无 §7.5 检查表（454／128／181 只在 §15.5 散文） |
| R3-A2／R3-A5 状态词 | **PASS** | `:919-920` 记 NOT_RUN，与实际一致 |

### 2.5 TDD 真实性（本轮） —— **PASS**

只读核对 `/tmp/uom-wt-p2/.local/p2/fix-r3/`（日志时间 11:17–11:24，早于提交 `fc55ddb` 11:27:15）：

- `mutation-r3s1-m4d-old-guard-survives.log`：旧测试文件 50/50（无 R3-S1·AST 用例）＝缺口复现；`mutation-r3s2-m8a-old-guard-survives.log`：旧文本守卫 5/5 ＝缺口复现。
- `replay-r3s1-m4d-killed.log` 52：50/2、`replay-r3s1-m4e-killed.log`／`…m4h…` 各 52：51/1、`replay-r3s2-m8a-killed.log` 8：6/2——用例名与本候选一致，计数与我的重放逐项相同。
- `red-r3a1-clean-dir-first.log`：22：21/1，`AssertionError: 成功导出后目录应恰好 3 文件` ＝对旧导出器的真 RED（行为断言，非环境失败）。
- `green-full-check.log`：454/454；`pipeline-v06-r3.log`：V4／V9 双哈希与 `FAIL_NOT_POSITIVE` 逐位同我的复跑。
- 备份链：`backup-register-model-mlflow.mjs`＝`12e8d567…`（＝HEAD blob）、`backup-v06-pipeline.fixed.mjs`＝`e0eaf24a…`（＝f390894 blob）、`backup-v06-pipeline.mjs`＝`ff1a6bcd…`（＝c287587 blob）、`model-package.head.ts`＝`cfbe42c1…`（＝c287587 blob）——作者还原与提交一致。
- 历史轮（P2-3／4／6／7）RED 仍 NOT_PROVED（日志已随 /tmp 清理丢失，与前三轮口径一致）。

### 2.6 回归 —— **PASS**

454/454；忠实门与合规门两组数字容差 0；V4／V9 双哈希、`FAIL_NOT_POSITIVE` 逐位不变；`predict.mjs`／`README.md` 与已登记 v2 逐字节一致；`verify-modelevol-provenance`、`check-data-guard`、`check:archive-content`（181 个 tracked 文本）、`npm audit` 全过；`check-docs-links` 在干净检出 128 条 0 错（第三轮唯一阻断 B-1 关闭）；禁区零改动；model-mlflow 工作树干净、账本 v1／v2 Staging、无 Production／Archived、本轮零写入；归档 11-26 后改动文件 0。

### 2.7 专项检查（规范 §5.3 相关项，仅就本轮差异）

- 数据不出网：本轮无新增依赖（`package.json`／`package-lock.json` 在 `c287587..f390894` 零差异）；AST 守卫用既有 devDependency `typescript`；fetch 打桩用例零联网；登记脚本默认地址回环、S5 守卫在位 —— **PASS**
- 重复已有能力：V1–V12 清单合并为单一来源（R3-A3）；两份测试文件各有一份 AST 遍历辅助（R4-A6，仅测试代码）—— **PASS（附建议）**
- 隐藏副作用：导出器清理后置（R3-A1）；行为用例在系统临时目录留沙箱且不清理（R4-A2）—— **PASS（附建议）**
- 状态词：R3-A2／R3-A5 记 NOT_RUN 如实；§1 任务表三行陈旧（R4-S1）—— **应修**

---

## 3. 变异表

还原一律由 `.local/mutate.mjs` 以内存字节备份写回并核对 sha256＝HEAD blob；TS 变异另 `touch`＋`npm run build` 重建并核对 dist 无标记；**未使用** `git checkout / reset / stash / restore`。锚点命中数不符即拒绝改动（本轮 0 次误中）。

| # | 变异点 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| M4d（重放） | `v06-pipeline.mjs:223` 定义点 → `pipeline.FROZEN_FOLDS_SHA256` | AST FAIL | pipeline-v06 52：50/2（AST＋行为层「实际退出码 0」） | **KILLED** |
| M4c（重放） | `:223` 定义点 → 字面量 `2ca273cb…ad22` | AST FAIL | 52：50/2 | **KILLED** |
| M4e（重放） | `:223` `let`＋重赋值为常量 | AST FAIL | 52：50/2 | **KILLED** |
| M4h（重放） | `:248` `coefficientHash` → `pipeline.EXPECTED_COEFFICIENT_SHA256` | AST FAIL | 52：51/1 | **KILLED** |
| **N1（自创）** | `:223` 先 `const frozenFoldsAlias = pipeline.FROZEN_FOLDS_SHA256` 再 `foldsSha256 = frozenFoldsAlias` | AST FAIL | 52：50/2 | **KILLED** |
| **N2（自创）** | `:223` `digest('hex') ?? pipeline.FROZEN_FOLDS_SHA256` | AST FAIL | 52：51/1（行为层仍过：兜底为死代码） | **KILLED** |
| **N3（自创）** | `:223` `digest('hex') \|\| pipeline.FROZEN_FOLDS_SHA256` | AST FAIL | 52：51/1 | **KILLED** |
| **N4（自创）** | `main` 体内加函数声明遮蔽 `createHash`，`digest()` 恒返回钉死常量（形态不变） | 记录 | 52：51/1——**AST 存活**，行为层「篡改 folds 的根上管线必须失败，实际退出码 0」 | **AST SURVIVED／行为层 KILLED** |
| R4-M7b | `model-package.ts:372-375` `rmSync` 挪到 `buildV06ModelPackage` 之前 | R3-A1 用例 FAIL | export 22：21/1 | **KILLED** |
| M8a（重放） | `register-model-mlflow.mjs:162-166,197-201` 两处守卫调用删除 | AST FAIL | 8：6/2（AST＋一致失败包） | **KILLED** |
| **N5（自创）** | 健康检查 `fetch` 挪到「登记前置校验」之前（守卫调用整体后移） | AST FAIL | 8：6/2（AST「语句 17 必须先于首个请求（语句 6）」＋行为层） | **KILLED** |
| **N6（自创）** | 两处守卫调用包 `(() => { … })()` | 记录 | 8：7/1——AST「实际 0 处」（保守拒绝无害形态） | **KILLED（AST，保守）** |
| **N7（自创）** | 两处调用保留、实参置 `[]`、`fail(error.message)` 改 `void error` | 记录 | 8：7/1——**AST 存活**；探针 K 包 fetch 尝试 1 | **AST SURVIVED／行为层 KILLED** |
| **N8（自创）** | `const httpFetch = fetch` 发首个请求＋守卫后移＋后续补一条直呼 `fetch` | 记录 | 8：7/1——**AST 存活**（只认 `fetch` 本名）；探针 K 包 fetch 尝试 1 | **AST SURVIVED／行为层 KILLED** |
| **N9（自创）** | 仅第二处（管线产物）调用实参置空并吞错 | 记录 | 8/8 全绿；探针 K／M 包仍被拒、fetch 0（一致性比对兜底） | **SURVIVED（行为等价）** |

终态：`npm run check` 454/454；干净管线 12/12、双哈希不变、包字节不变；`git status --porcelain` 0 行；`dist/` 无变异标记。

---

## 4. 发现清单

### 4.1 阻断

无。

### 4.2 应修（PR 内一并处理；不改变候选行为正确性）

**R4-S1 · result.md §1 任务状态表未随第三轮结论更新**
`openspec/changes/p2-model-port/result.md:33`（P2-11 行）仍为「第一轮 FAIL → 修单（§14）→ 第二轮 PASS」，说明栏只链接 round2 报告——第三轮 **FAIL**（B-1）及其由 `568777e` 关闭的事实只写在 `:16-17` 的引言与 §15.5；`:4`「P2-11 起未开工」；`:32` P2-10 行只指到 §7.3，第七轮（本候选）的检查结果（454/454、链接 128、守卫扫描 181、audit）只在 §15.5 散文，无 §7.5 表。
影响：读者从任务表读到的是过时的复核状态，与规范 §10「状态词如实」不符（文档层面，不影响代码）。
方向：更新 §1 三行（P2-11 写全四轮结论并链接 round3／round4 报告；P2-11 行与本轮结论一致），补一张 §7.5「第七轮」检查表（数值直接取本报告 §1.3 与作者 §15.5 日志）。可由主 agent 在回填本轮结果时一并完成，无需实现者返工。

### 4.3 建议

- **R4-A1 · AST 守卫的语义边界已由行为层兜底，但管线行为层在 CI 上跳过**：N4（函数作用域遮蔽 `createHash`）、N7／N8（调用保留但实参置空、`fetch` 别名）对 AST 守卫存活，全部由行为层用例杀死；其中 `pipeline-v06.test.ts:1401` 在无固化数据时 skip（CI 即如此），登记侧 fetch 打桩用例不依赖数据、CI 会跑。现状可接受（PR 必经独立复核）；若要收口，按三轮建议让 `validateV06` 自接收 `foldsPath` 自算哈希并内部调用钉死断言，形态守卫退为辅助。
- **R4-A2 · 行为用例的临时沙箱不清理**：`pipeline-v06.test.ts:1403`、`register-validation-gate.test.ts:304/325/344` `mkdtempSync` 后无 `t.after` 清理；本机系统临时目录现存 `uom-v06-tamper-*` 96 个、`uom-reg-*` 18 个（不含我已清理的自身运行 24＋24＋8）。每个 tamper 沙箱含一份篡改副本 `folds.json`（款号标识，留在本机、非出网，但属派生副本残留）。方向：`t.after(() => rmSync(sandbox, { recursive: true, force: true }))`。
- **R4-A3 · K 用例断言顺序**：`register-validation-gate.test.ts:315-321` 先断 `status !== 0`（fetch 打桩抛错同样导致非 0），守卫失效时失败信息落在 `:316`「拒绝原因必须写明 V12…」而非 `:317` 的 fetch 次数。测试仍能杀死（M8a／N5／N7／N8 实测），只是诊断不直接；把 `fetchAttempts` 深比较放首位即可。
- **R4-A4 · 第二处核验调用为纵深冗余（N9）**：仅置空该调用时 AST 存活、8/8 全绿，但 manifest 核验＋记录逐条一致比对（`register-model-mlflow.mjs:202-208`）仍把 K／M 两类包拒在首个请求前。无需返工；如想锁定，可补三轮用例 C（manifest 全 PASS、validation.json 带 fail）。
- **R4-A5 · 阶段 02／04 钉死断言以未捕获异常退出**（`v06-pipeline.mjs:226,251`）：退出 1、无产物，行为正确；但输出为堆栈直出，与脚本其余 `FAIL-CLOSED:` 文案（`:220,329`）不一致，日志可读性略差。
- **R4-A6 · 两份测试文件各自复制了一份 TS AST 遍历／callee 名解析辅助**（`pipeline-v06.test.ts:1139-1160,1225-1241`；`register-validation-gate.test.ts:98-116`）。建议抽到 test 工具模块；非必须。
- 三轮遗留 R3-A2（导出器 `'PASS'`／`undefined` 结果值拒绝用例）、R3-A5（baseline「上新类型」措辞）：作者记 NOT_RUN 如实，维持开放，由主 agent／用户决定是否立项。

---

## 5. 结论

**PASS —— 建议以 `f390894` 进 PR**（入库前由主 agent 按 R4-S1 更新 result.md §1 三行并补 §7.5 表；均不涉及代码，无需第四轮之后的代码复核）。

本轮独立确认的正面结论：R3-S1 定义点守卫对指定重放（M4c／M4d／M4e／M4h）与自创形态（别名中间量、`??`／`||` 兜底）全部 KILLED，行为层在真实脚本路径上把篡改 folds 拒在阶段 02 且无包导出（我的手工复现与作者用例一致），语义级篡改（N4）虽过 AST 但被行为层杀死；R3-S2 登记入口守卫对 M8a、守卫后移、IIFE 包裹全部 FAIL，三条 fetch 打桩用例零联网（非 PASS 包 fetch 0、回环外 URL fetch 0、好包恰停首个 `/health`），实参置空与 `fetch` 别名两类语义绕过均由行为层兜底杀死；R3-A1 清理顺序变异 KILLED、V1–V12 清单单一来源、死变量已删；R3-S3 两行已补记、§7.4 行改为干净检出条件、干净检出链接检查 128 条 0 错（第三轮阻断 B-1 关闭）；TDD 证据（旧守卫放行复现 → 新守卫杀死重放、R3-A1 真 RED）与提交一致；忠实门、合规门、双哈希、`FAIL_NOT_POSITIVE`、五个守卫、审计、禁区、账本与归档只读性均无回归。

本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

---

## 6. 未验证项与说明

- `offline-check` e2e 段、`test:golden`（G1–G5）、CI、PR（P2-12）、P2-13 真实数据路径：**NOT_RUN**（与 result.md 口径一致）。
- 真实 MLflow 登记序列（`register-model-mlflow.mjs:213-347`）：**NOT_RUN**——按发单不登记；本轮该段未改，仅以 fetch 打桩验证到首个请求为止。
- 历史轮（P2-3／4／6／7）RED：仍 **NOT_PROVED**。
- 实现者工作树未提交的 §16「专项最终检查」：不在候选内，**未复核**；按 §15.5「仍需主 agent／用户处理」第 1 项，须按第三轮与本轮结论改写。
- 阶段门禁、§5.3、CI、产品验收：不在本复核范围，本报告不代替。
- 原始日志存于复核工作树 `.local/`（npm-ci／build／check 初终态／fidelity／pipeline 初终态／provenance／docs-links／data-guard／archive-content／audit／各变异 `mut-*.log` 与 `last-mutation-output.log`／`spec-*.json`／`mutate.mjs`／`probe-k.mjs`），随工作树清理删除、未持久化；关键输出已摘入本报告 §1–§3。
- 我在系统临时目录创建的探针／测试沙箱已清理（仅删除 11:30 之后的 `uom-v06-tamper-*`／`uom-reg-*`／`uom-review-probe-*`）；更早的同名沙箱（作者与前三轮遗留）未动。
- 复核期间主仓 `git status` 全程为空；model-mlflow 与归档本体零写入。
