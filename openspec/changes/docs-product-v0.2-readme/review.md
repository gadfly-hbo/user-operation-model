# R-10 文档变更 · 独立复核报告

- 复核者：`SDD·TDD 独立复核者`（未参与候选任何部分；全程只读）
- 复核日期：2026-11-28
- 候选：工作树 `/Users/huangbo/Dev/Projects/user-operation-model/.qoder/worktrees/agent-SDD-TDD-6a86938f`，分支 `docs/product-v0.2-readme`，HEAD **`f01daa4`**，基线 `main @ 2ce0564`（merge-base 已核对 = 2ce0564）；4 个提交 `ef6f138`、`a1949b6`、`abe5365`、`f01daa4`；15 个文件，+964 / −608
- 依据（只读）：候选内 `docs/architecture-review-v1.md` §7（R-1～R-10 已拍板、R-11／R-12 待拍板）；主仓库草稿原件 `/Users/huangbo/Dev/Projects/user-operation-model/docs/产品讨论稿-v0.2.md`（绝对路径读取）
- 隔离遵守：每条命令显式 `cd <候选工作树>`，未在主仓库根执行命令；无任何 git 写操作；候选工作树复核前后 `git status --porcelain` 均为 0 行；仅写入 `/Users/huangbo/Dev/Projects/user-operation-model/.local/review-docs/`

## 总结论：**PASS（附带条件：应修 1 项，需处理或由负责人明确接受）**

阻断 0 · 应修 1 · 建议 6

---

## 1. 预期清单（打开实现前从依据导出）

| # | 预期 | 来源 |
| --- | --- | --- |
| E1 | 只改 `.md`；无代码／测试／配置／数据；`package.json` 与锁文件未动 | 任务 §1 |
| E2 | `产品讨论稿-v0.1.md → v0.2.md` 被 git 识别为重命名（保留历史） | 任务 §2 |
| E3 | 候选 v0.2 与草稿原件一致，仅允许 §8 切片 A 状态的事实性修订 | 任务 §2、实现者自述 |
| E4 | D1–D12 逐条对应 R-1～R-10；无未拍板项写成已决；R-11／R-12 → Q8／Q9 仍「待定」；Q4／Q6／Q7 仍「待定」 | 梳理报告 §7、任务 §2 |
| E5 | 「## 8. 交付节奏（建议）」标题原文保留 | 任务 §2 |
| E6 | 全仓无 `产品讨论稿-v0.1` 引用；v0.2 相对链接可解析；`#8-交付节奏建议` 锚点存在 | 任务 §3 |
| E7 | `openspec/` 历史只改链接路径；现行文档显示文字统一 v0.2；历史显示文字不动 | 任务 §3 |
| E8 | `AGENTS.md`、`docs/engineering-workflow.md` 相对基线只改链接路径与显示文字 | 任务 §4 |
| E9 | README 陈述可从仓库核实；包真实存在或标「规划中」；命令在根 `scripts` 或与 mcp-usage 一致；无易过期数字 | 任务 §5 |
| E10 | `architecture-review-v1.md` 与原件差异仅限：文首「未入库」陈述、v0.1→v0.2 链接、切片 A 状态；无业务数据 | 任务 §6 |
| E11 | 四项检查退出码 0 | 任务 §7 |
| E12 | 规范 §5.3 专项：文档内容不违反 §7.1 口径（金额／属性组合不入库）；无职责越界 | 工程规范 §5.3、§7.1 |

## 2. 实跑命令与结果（均在候选工作树内）

| # | 命令 | 退出码／结果 |
| --- | --- | --- |
| C1 | `git rev-parse --short=7 HEAD`；`git rev-parse --abbrev-ref HEAD`；`git status --porcelain=v1` | `f01daa4`；`docs/product-v0.2-readme`；0 行 |
| C2 | `git diff --name-status -M 2ce0564..f01daa4`；`-c core.quotepath=false diff --name-only … \| grep -v '\.md$'` | 15 个文件全为 `.md`（非 md 匹配为 0） |
| C3 | `git diff --stat 2ce0564..f01daa4 -- package.json package-lock.json pnpm-lock.yaml yarn.lock` | 空 |
| C4 | `git -c core.quotepath=false diff -M --stat 2ce0564..f01daa4 -- docs/`；`-M1% --name-status`；`-M50% --name-status` | 默认阈值显示 **D v0.1 + A v0.2**；`-M1%` 显示 **R024**（相似度 24%） |
| C5 | `diff docs/产品讨论稿-v0.2.md <主仓库草稿原件>` | 退出 1，**仅第 405 行**一处差异；sha256 两者不同（预期） |
| C6 | `git show 2ce0564:docs/产品讨论稿-v0.1.md \| diff - <草稿原件>` | 退出 1，532 行差异（主 agent 草稿的实质改写，日志 `v01-vs-draft.diff`） |
| C7 | `grep -rn "产品讨论稿-v0.1" . --include='*.md'`（排除 node_modules/.git/.qoder/.local） | 退出 1，**零命中** |
| C8 | `grep -rn "产品讨论稿" …` | 24 处引用，全部指向 `产品讨论稿-v0.2.md` |
| C9 | `git diff 2ce0564..f01daa4 -- AGENTS.md`；`-- docs/engineering-workflow.md`；`-- openspec/`；`-- docs/{data-source-review,match-kernel,mcp-usage,ui-design}.md` | 各文件仅 2 行（`engineering-workflow.md` 2 处），逐行核对见 §3 |
| C10 | `diff <主仓库 docs/architecture-review-v1.md> docs/architecture-review-v1.md` | 退出 1，**仅 4 行**：第 3、7、304、364 行 |
| C11 | `git merge-base --is-ancestor 22c55f4 main`；`git log --oneline -1 22c55f4` | 是祖先；`22c55f4 refactor: 切片 A … (#8)` |
| C12 | `python3 .github/scripts/check-docs-links.py .` | **0**；检查 161 条，错误 0，告警 0 |
| C13 | `python3 .github/scripts/check-data-guard.py .` | **0**；索引中无业务数据目录、数据文件或超大文件 |
| C14 | `npm run check:archive-content` | **0**；黑名单 85 条，扫描 tracked 文本 208 个＋xlsx 1 个，PASS（说明见 §4） |
| C15 | `git diff --check 2ce0564..f01daa4` | **0**；输出 0 字节 |
| C16 | 独立锚点校验（自写 GFM slug 实现，不依赖项目脚本） | 180 条链接，46 条带锚点，真实失败 0（2 条为我对根相对路径 `/docs/…` 的误判，位于本候选未改的 `.github/PULL_REQUEST_TEMPLATE.md`）；`#8-交付节奏建议` 存在 |
| C17 | 变异测试（脚本**副本**去掉 `.local` 排除项，跑在 `.local/` 下的隔离副本） | 基线 161/0/0 与原脚本一致；改坏文件链接 → `ERROR`，退出 **1**；改坏标题锚点 → 仅 `WARN`，不阻断 |
| C18 | README 事实核对（`ls packages/`、`git ls-files templates/ site/`、根 `package.json` scripts、`.gitignore`、`TOOL_NAMES`、`bin.ts` 旗标、各 docs grep） | 见 §3 第 5 项 |
| C19 | 收尾 `git status --porcelain=v1 \| wc -l`；`rev-parse HEAD`；`rev-parse main` | 0；`f01daa4`；`2ce0564`（候选未合并） |

日志：`/Users/huangbo/Dev/Projects/user-operation-model/.local/review-docs/{check-docs-links,check-data-guard,check-archive-content,git-diff-check}.log`、`v01-vs-draft.diff`、`check-docs-links.nolocal.py`（变异用脚本副本）。变异副本目录已删除。

## 3. 逐项结论

### 1. 只改了文档 — **PASS**
C2／C3：15 个文件全部 `.md`；`package.json` 与锁文件无差异。`git diff --summary` 仅 `create`（architecture-review、v0.2）与 `delete`（v0.1）。

### 2. 讨论稿升版忠实度 — **PASS，附 1 项预期偏差（建议 S1）**
- **E2 偏差**：`git diff -M --stat`（默认 50% 阈值）**未**显示重命名，而是 `D v0.1（523 行）+ A v0.2（463 行）`；`-M1%` 才显示 `R024`。原因：v0.2 是主 agent 草稿对 v0.1 的实质改写（C6：532 行差异），相似度天然只有 24%，不在实现者可控范围；且项目走 squash 合并，即使拆成「先纯改名、后改内容」两个提交，squash 后对基线的单一差异仍是 24%，默认 `git log --follow` 不会跨越。历史本身未丢（`git show 2ce0564:docs/产品讨论稿-v0.1.md` 可取），丢失的只是默认阈值下的自动重命名识别。无仓库级配置可降低默认阈值。
- **E3 PASS**：C5 候选 v0.2 与草稿原件逐字节仅第 405 行不同：`候选完成：三轮独立复核通过（附带条件），待授权合并` → `已合并（PR #8，\`main @ 22c55f4\`）`。该事实经 C11 核实为真。与实现者自述「只改一处」完全一致，无任何其它实质改动。
- **E4 PASS**：D1／D2 为 v0.1 既有（2026-11-26）；D3↔R-1、D4↔R-2、D5↔R-3、D6↔R-4、D7↔R-5、D8↔R-6、D9↔R-7、D10↔R-8、D11↔R-9、D12↔R-10，一一同日（2026-11-28）。R-11／R-12 **未**进入决策表，对应 v0.2:427–428 的 Q8／Q9 仍标「**待定**」；Q4（:423）、Q6（:425）、Q7（:426）仍「**待定**」；Q10–Q12 亦待定。D3 的「带令牌；MCP 与浏览器共用同一套工具」与 D4 的「显式返回歧义、不静默、不回退相邻月份」超出 R 行原文，但均见于已获批的梳理报告（:85、:306–307、:391 切片 A 定稿规格），属已批条目的设计细化而非新决策。
- **E5 PASS**：v0.2:389 `## 8. 交付节奏（建议）` 原文保留。
- §8 状态词核对（:393–410）：P0–P4 与切片 A–F 的状态与仓库事实一致（切片 A 已合并经 C11 核实；`packages/` 仅 core、data-mcp、tool1-channel-match、tool2-portrait-predict；`openspec/changes/` 无报表类变更，「留存与回购报表 未开始」属实）。

### 3. 链接 — **PASS**
- **E6 PASS**：C7 零命中；C12 161 条链接 0 错误；C16 独立实现交叉验证 0 真实失败；`docs/engineering-workflow.md:105` 的 `产品讨论稿-v0.2.md#8-交付节奏建议` 在 v0.2 中存在（标题「8. 交付节奏（建议）」按 GFM 规则去标点、空格转连字符即得）。注意：项目检查器对锚点只告警不阻断（C17 MUT-1），锚点正确性以 C16 为准。
- **E7 PASS**：C9 逐行核对 `openspec/` 5 个文件各 1 行、仅路径 `v0.1→v0.2`，无其它文字改动。`data-mcp-core/spec.md:6`、`tool1-match-kernel/spec.md:6` 显示文字仍为「产品讨论稿 v0.1」（历史未动，符合预期）；`p2-model-port/spec.md:6` 显示文字无版本号。现行文档（`AGENTS.md`:5,9、`README.md`:3,9,41、`docs/engineering-workflow.md`:7,105、`docs/data-source-review.md`:5、`docs/architecture-review-v1.md`:7）显示文字均为 v0.2；`docs/match-kernel.md`:3、`docs/mcp-usage.md`:4、`docs/ui-design.md`:4 显示文字本就不含版本号。

### 4. 入口文档只改链接 — **PASS**
C9：`AGENTS.md` 2 行（:5、:9）、`docs/engineering-workflow.md` 2 行（:7、:105），差异仅为链接路径与「v0.1→v0.2」显示文字，无任何其它改动。

### 5. README 事实性 — **PASS，附建议 S3–S5**
逐条核实：

| README 陈述 | 证据 | 结论 |
| --- | --- | --- |
| :9 「v0.2 现行版本…D1–D12 决策已记录」 | v0.2:10–21 共 12 条 | 真 |
| :10 「工程规范 v1.0」 | `engineering-workflow.md`:3「版本 v1.0」 | 真 |
| :11 「六个切片…切片 A 已合并」 | 梳理报告 :304–309 六行；C11 | 真 |
| :12 「数据 MCP 17 个工具（stdio）；未就位见 mcp-usage」 | `mcp-usage.md`:33「工具清单（17 个）」、:104 `data-not-ready`；`packages/data-mcp/src/server.ts` `TOOL_NAMES` 实数 17 | 真 |
| :13 「工具1 已交付（P1）…权重未经真实数据校准」 | `match-kernel.md`:3「P1 交付」、:53「权重未经真实业务数据校准」、:114–115 看板与错配清单 | 真 |
| :14 「工具2 已交付：移植与 Staging 登记；科学门槛未过」 | `match-model-baseline.md`:145–146 门槛 1／2 FAIL；:161–162 Staging、Stage 上限 Staging | 真；「标『实验基线』」见 S3 |
| :15 「留存与回购报表 未开始」 | `packages/` 无 reports；`openspec/changes/` 无对应变更 | 真 |
| :16 「模板包已交付 `templates/数据模板.xlsx`」 | `git ls-files` 有该文件 | 真 |
| :17 「UI 原型 `site/web`，合成演示数据」 | `git ls-files site/` 5 个文件；`ui-design.md`:131「均为合成演示数据」 | 真 |
| :44–47 四个包 | `ls packages/` 一致 | 真 |
| :48–50 `uom-services`／`workbench-server`／`reports` 标「规划中」 | 均不存在；梳理报告 :268、:291、:306–309 对应切片 C／D／F | 真，已标规划中 |
| :54–55 `models/`、`data/` 不入库 | `.gitignore`:25 `models/`、:3 `data/*` | 真 |
| :62 `npm run check` | 根 scripts：`build && test` | 真 |
| :65 `npm run tool1 -- --demo --out …` | scripts 有 `tool1`；`packages/tool1-channel-match/src/bin.ts`:22,40 有 `--demo`／`--out` | 真 |
| :68–69 `npm run build`；`UOM_DATA_ROOT=data node packages/data-mcp/dist/src/bin.js` | scripts 有 `build`；`mcp-usage.md`:11 同一命令 | 真 |
| :72 `npm run templates:build` | scripts 有 | 真 |
| :80–83 四条本地检查 | `check`、`test:golden` 在 scripts；两个 python 脚本已实跑退出 0 | 真 |
| :92–95 四个 catalog 文件；`ProductDossier.extra`／`Portrait.platformLabels` | 四文件 `ls` 存在；`product/types.ts`:123、`portrait/types.ts`:76 | 真 |

未发现不实陈述。无测试用例数等硬编码；「17 个工具」「D1–D12」为会随演进过期的现状数字（见 S4）。

### 6. 梳理报告入库 — **差异范围 PASS；业务数据口径 应修（F1）**
- C10：相对主工作树原件仅 4 行——:3「未入库」→「已随 R-10 文档变更入库」；:7 链接 v0.1→v0.2；:304 切片 A 行追加「已合并（PR #8，`main @ 22c55f4`）」；:364「本文未入库、未提交」→「已随 R-10 文档变更入库；梳理阶段未改任何代码与既有文档」。全部在允许集合内。
- 业务数据：无店铺名（渠道已写作「某渠道」）、无款号码值（`[A-Z]{2,}[0-9]{5,}` 零命中）、无经营数值；C14 归档内容守卫 PASS（85 条黑名单）。**但 :341（R-11 行）引用了黄金锚点的「具体金额＋商品属性」组合**，见 F1。

### 7. 检查命令 — **PASS**（C12–C15 全部退出码 0）
说明：(a) `check:archive-content` 在工作树无 `node_modules` 的情况下跑通，是 Node 向上解析到主仓库 `node_modules` 加载 `exceljs`（只读加载，未在主仓库根执行命令）；该脚本按自身逻辑读取主仓库 `data/archive-modelevol` 构建黑名单，仅输出计数——这是项目守卫脚本的既定行为与任务点名的检查项，我未人工查看 `data/` 内容。(b) 未运行 `npm run check`（构建＋测试）：纯文档变更，规范 §6 CI 表对纯文档只要求差异格式、编码、引用完整性。

### 规范 §5.3 专项（E12）
四点原则／匹配内核唯一／背对背隔离／模型来源：本候选不触及代码与配置，**不适用**，不据此宣称既有实现合规。数据不出网：仅 F1 一处口径问题；CI 不接触真实数据不受影响。人的操作：无新增必做动作。

## 4. 发现

### 阻断
无。

### 应修
**F1 · `docs/architecture-review-v1.md:341`（R-11 行）含具体金额＋商品属性组合；`docs/产品讨论稿-v0.2.md:460–461`（附录 B）沿用 v0.1 的金额＋属性＋店铺名**
- 依据：工程规范 §7.1「金额与任何数值样本属业务数据，一律不得入库；标识符不得与属性或文案组合出现」。
- 事实：同一金额在基线已存在于 6 个已跟踪文件（`engineering-workflow.md:75`、`match-calibration.md:23`、`match-kernel.md:27`、v0.1:520、`data-templates/result.md:110`、`tool1-match-kernel/review-p1-recheck.md:76`），R-11 正为此而设且**尚未拍板**。候选对 v0.2:460–461 是原样沿用（不新增泄漏），但对梳理报告是**新增一处**（已匿名化渠道）。用户已在阅读该梳理稿后批准 R-10「入库」，故不列阻断。
- 影响：在 R-11 拍板前把待裁定项再落一处；若 R-11 最终选「改成代号」，需多改一个文件。
- 闭合路径（二选一）：合并前取得 R-11 拍板（白名单）并在本记录注明；或把 :341 的金额改为占位（如「¥XXX.XX」）。

### 建议
- **S1 · 重命名识别（`git diff -M --stat 2ce0564..f01daa4 -- docs/`）**：预期「显示重命名」未满足——相似度 24%（`R024`），默认阈值 50% 不识别。非实现者可修（草稿内容为主 agent 所定、squash 合并下无法通过拆提交规避）。需追溯历史时用 `git log --follow -M24% -- docs/产品讨论稿-v0.2.md` 或 `git show 2ce0564:docs/产品讨论稿-v0.1.md`。请主 agent 裁定是否接受此偏差。
- **S2 · `openspec/changes/data-mcp-core/review-p0-2.md:18`、`review-p0-5-minimal.md:54`**：反引号内的文件路径（非 Markdown 链接）由 `v0.1.md` 改为 `v0.2.md`，使历史复核记录引用了当时不存在的版本。属任务「全仓链接改路径」的既定范围且保证路径可解析，但存在事实漂移；可考虑在路径后缀注「（原名 v0.1）」或维持现状并在本记录注明。同目录 `spec.md:6`（两处）显示文字 v0.1 → 指向 v0.2 的文字／路径不一致，为任务明示的设计，仅记录。
- **S3 · `README.md:14`**：「标『实验基线』」来自 D8（v0.2:17，2026-11-28 决策），全仓代码与 `match-model-baseline.md` 均无此标签（grep 仅命中 README、梳理报告 R-6、v0.2）；该行末「见 docs/match-model-baseline.md」只能支撑「门槛未过、Staging 上限」，不能支撑标签本身。建议改为「按 D8 标『实验基线』」或把指针改指讨论稿，避免把已决未实现的标签写成现行状态。
- **S4 · `README.md:9`、`:12`**：「D1–D12」「17 个工具」是会随演进过期的现状数字（无测试用例数类硬编码，符合要求）。可选：保留数字的同时已给出指针（mcp-usage），现状可接受。
- **S5 · `README.md:79–84` 本地检查**：未列 `npm run check:archive-content`（根 scripts 存在、本次实跑 PASS、且是本仓库唯一能扫出归档内容片段的守卫）。建议补一行。
- **S6 · `docs/产品讨论稿-v0.2.md:16`（D7）**：R-5 建议列末尾的「需你确认或转业务侧确认」未在 v0.2 任何位置保留为待办（全文无「业务侧确认」）。D7 本身忠实于已批规则；此为草稿层面的遗漏，不在实现者改动范围，供主 agent 判断是否需作为开放项登记。

## 5. TDD 真实性
纯文档变更，无测试可做变异；改以检查器变异替代（C17）：文件链接改坏可被捕获（退出 1），锚点改坏仅告警。结果记录引用的 PASS 均对应本次实跑（C12–C15 日志在本目录）。

## 6. 未验证项
- GitHub 服务端渲染的锚点行为：仅按 GFM 规则本地推断＋独立 slug 实现（C16），未在 GitHub 页面点击验证。
- PR #8 页面未打开核对，以 git 历史 `22c55f4 … (#8)` 与 `2ce0564` 回填提交为据。
- S2 所涉历史复核引用的 §7.1–§7.4／§3.3 在 v0.2 中是否与 v0.1 同义，未逐节复算。
- `check:archive-content` 黑名单内容未人工查看（脚本行为）。
- 未运行 `npm run check`（构建＋测试）、`test:golden`、`offline-check`：超出纯文档变更的检查选择，未运行即记 `NOT_RUN`，不据此宣称整体通过。
