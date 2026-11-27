# P0-5 单点复核（合并条件闭合确认）

## 候选身份

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/huangbo/Dev/Projects/user-operation-model` |
| 隔离验证根 | `/tmp/uom-review-p0-5f`（detached HEAD） |
| 候选 commit | `f8c7c49`（`fix: 闭合第四轮极小范围复核的残留条件`） |
| 上游候选 | `e06628a` → `9df255a` → `26d173a` → `2cb9205` → `21315bb` |
| 远端状态 | `origin/work/p0-5-mcp` 已含 `f8c7c49`；PR #2 的 `headRefOid` 即 `f8c7c49e4eb58b8b25b432a6d87716fc53bffee0` |
| 复核范围 | 仅核对上一轮「有条件建议合并」的条件闭合情况（条件 1：两处 57 → 59；条件 2：M4 白名单守卫修复归属改回 `9df255a`）。**未重做上轮已通过的实测项**，除条件相关处必要的单点复现（见项 3） |
| 本轮新增证据 | 链接检查、用例数与分包拆分、索引规模与 conflict 数、工具可用性、一次 R11 变异复现 |
| 工作区纪律 | 变异用文件备份还原（未用 `git checkout --`），还原后 md5 与变异前逐位一致、`git status` 干净；本报告为唯一新增文件 |

> 本报告正文不写商品／款号／门店名等业务明细；只保留工程口径的聚合计数。

---

## 逐项核对

### 1 · 两处链接数（57 → 59）—— **PASS**

**实测**（候选工作区，报告创建前）：

```
$ python3 .github/scripts/check-docs-links.py .
检查相对链接 59 条，错误 0，告警 0        # 退出码 0
```

**文档核对**：

- `openspec/changes/data-mcp-core/result.md` §4「实际执行的检查」表（`result.md:124`）：现为 `PASS，**59 条**相对链接无错误` —— 与实测 59 **逐字一致**。
- 第四轮台账行（`result.md:376`）：原文「链接 57」已改为「链接数」，并指向新增的「本文数字的复核方式」小节，不再内嵌会漂移的数值。
- 全仓库 `*.md` 复查 `57 条`：**result.md 内 0 命中**；仅 `review-p0-5-minimal.md:26` 与 `:97` 两处保留 57 —— 该文件是第四轮复核的**时点记录**（当轮实测值即 57），属历史证据快照，非台账数字，不计为缺陷（观察项 O-5）。

**关于「本报告入库会使仓库级链接数变化」**：本报告**不使用任何相对 Markdown 链接**（文件路径一律用行内代码书写），因此入库后仓库级链接数**仍为 59**，与 §4 表一致，不产生新一轮数字漂移。

**结论：PASS。**

---

### 2 · M4 守卫的修复归属 —— **FAIL（部分闭合）**

**事实认定（以 git 历史为准）**：

| 提交 | 是否改动 `packages/data-mcp/test/mcp.test.ts` | 证据 |
| --- | --- | --- |
| `9df255a` | **是** | `git show 9df255a -- packages/data-mcp/test/mcp.test.ts` 的 hunk 把 `!serialized.includes('totalScore')` / `!serialized.includes('grade')` 两行**字面匹配**断言替换为 `assert.deepEqual(Object.keys(data).sort(), [...])`（顶层键精确集合）+ 维度键 `assert.deepEqual`（结构白名单） |
| `e06628a` | **否** | `git show e06628a -- packages/data-mcp/test/mcp.test.ts` 输出为空；该提交 `--stat` 仅含 `docs/normalize-rules.md`、`result.md`、`review-p0-5-minimal.md`、`packages/core/test/helpers/fixtures.ts`、`packages/core/test/index.test.ts` |
| `f8c7c49` | **否** | `git show f8c7c49 --stat` 仅含 `docs/normalize-rules.md`、`result.md` |

→ **结构白名单守卫的功能落地于 `9df255a`（第三轮）**，与上轮认定一致。

**归属表述现状**：

| 载体 | 表述 | 判定 |
| --- | --- | --- |
| `f8c7c49` commit message | 「M4 结构白名单守卫的修复归属改回 `9df255a`（功能在该提交落地，本提交仅在 commit message 与台账中重列，归属标注不准）」 | **已正确** |
| `result.md` 台账 | **未改**：`result.md:379`（第四轮台账「附」行）仍写「附 ｜ M4 守卫是**键名字面匹配**，换名即失效 ｜ 改为结构白名单；复验…→ **KILLED**」——在「第四轮极小范围复核」的「发现／修复」两列中，仍把**第三轮落地的代码改动**记为本轮修复；`result.md:370` 仍把「M4 字面守卫不牢」记作第四轮复核者的观察 | **未改** |
| PR #2 描述 | 「**守卫加固**：『不产出匹配分与评级』的守卫从键名字面匹配改为**结构白名单**，实现侧新增 `matchScore`／`rating` 之类字段同样会被拦下。」——未点名提交，且表述与事实一致 | **一致**（该点） |

**关键事实**：`git show f8c7c49 -- openspec/changes/data-mcp-core/result.md` 的 diff **没有任何 hunk 触及上述两行**；而 `f8c7c49` 的 commit message 恰恰写明「本提交仅在 commit message 与台账中重列，归属标注不准」，即**自己已识别出台账归属错误却未在台账落地**——属于该提交自己记录的「想改没改成」形态（§本文数字的复核方式 中「漂移根因 1」）。

**旁证（归属事实链可自查）**：第三轮台账 `result.md:356`（R7 行）已记「守卫改为**结构白名单**」，属**正确**归属；第四轮台账 `result.md:379` 又记一次，形成**同一处代码改动被记两次、其中一次归属错误**。

**另**：第四轮复核者本人的报告（`review-p0-5-minimal.md` 附带观察 B）对 M4 的判定是 **PASS**（「新的结构白名单…上轮『守卫对键名不敏感』的缺口**已闭合**」），即该观察实际出自第三轮（`review-p0-5-final.md:120`、`:177`），并非第四轮的新发现。

**结论：FAIL** —— commit message 已闭合，台账未闭合，条件 2 整体只完成一半。

---

### 3 · R11 变异描述 —— **FAIL（部分闭合）**

**候选自述**：`result.md:378` 现为「复验后 R11 变异 **KILLED（该测试文件 27 例中 20 例失败）**」，把原「27 例失败」更正为「27 例中 20 例失败」。

**独立复现（单点，未重做其他实测项）**：

- 方法：`cp` 备份 `packages/core/src/index/build.ts`（变异前 md5 `d05dbf94973de8f5246e47a3dddf305f`）→ 把 `detectPlatform` 改为**目录优先**（即台账所述「R11 平台识别顺序回退（目录优先）」）→ `npm run build` → 跑包内测试 → 备份还原 → md5 与 `git status` 复验。
- 实测：`packages/core/dist/test/index.test.js` = **27 例，20 例失败**（全 core 包 128 例中同样 20 例失败）。
- 补充复现：按第四轮报告所记的**另一种 R11 变异**（完整恢复 `2cb9205` 的旧 `detectPlatform`，含旧扩展名集合）重跑，结果同为 **27 例 / 20 例失败**。→ 「27 例失败」在两种可能变异下均不可复现。
- 还原后：`md5` 与变异前逐位一致、`git status` 干净、core 128 例与 data-mcp 31 例全过。

→ `result.md:378` 的新表述**准确**。

**残留**：`result.md:393`（第四轮「变异复验：4/4 KILLED」表）**仍写**「R11 平台识别顺序回退（目录优先） ｜ KILLED（**27 例失败**）」——即上轮被判定不准确的那句**在相邻表格中原样留存**。

`git show e06628a:openspec/changes/data-mcp-core/result.md` 显示该句在 `e06628a` 出现于两处（`:366`、`:381`），`f8c7c49` **只改了其中一处**。

**结论：FAIL** —— 一处已改准、一处未改，台账内自相矛盾。

---

### 4 · 台账数字与实测的一致性 —— **PASS（含 3 处建议级缺口）**

**§4「实际执行的检查」表逐行实测**（均在 `/tmp/uom-review-p0-5f` 候选工作区）：

| 台账行 | 台账值 | 实测 | 判定 |
| --- | --- | --- | --- |
| 类型检查 + 构建 `npm run build` | PASS，无错误 | 退出码 0，无输出 | **PASS** |
| 单元测试 `npm run test` | 159 例全过（core 128 + data-mcp 31），0 失败 0 跳过 | `ℹ tests 159 / pass 159 / fail 0 / skipped 0`；分包 `packages/core/dist/test/**/*.test.js` → **128**，`packages/data-mcp/dist/test/**/*.test.js` → **31** | **PASS** |
| 依赖审计 `npm audit --audit-level=high` | 0 vulnerabilities | `found 0 vulnerabilities` | **PASS** |
| 文档链接 `python3 .github/scripts/check-docs-links.py .` | 59 条，无错误 | `检查相对链接 59 条，错误 0，告警 0` | **PASS** |
| 数据守卫 `python3 .github/scripts/check-data-guard.py .` | PASS | `数据守卫通过：索引中无业务数据目录、数据文件或超大文件`（退出码 0） | **PASS** |
| 断网验证 | **NOT_RUN** | 本轮**未跑**（未做禁网沙箱） | **NOT_RUN**（台账如实标注，状态口径正确） |

**索引规模与 conflict（台账 §3 真实数据端到端表）**：

```
$ node --input-type=module -e "import {buildIndex} from './packages/core/dist/src/index.js'; const i=await buildIndex({dataRoot:'data'}); console.log(i.products.length, i.channels.length, i.portraits.length)"
334 200 7
```

- 商品／渠道／画像三项与台账**逐项一致**（**PASS**）。
- conflict 数：台账记 **123**；复核者自写等价命令按 `issue.kind` 统计得 `{"parse-error":19,"conflict":123,"unmapped-value":4,"unmapped-dimension":68}` → **123**，与台账**一致**（**PASS**）。
- 附带（服务于 P0-6 判断）：真实数据下 `index.unavailable` 为 **8** 个工具、可用 **9** 个（17 个工具总数），与台账 §3「9 个可用 / 8 个未就位」一致（**PASS**）。

**新增「本文数字的复核方式」小节的命令可执行性**：

| 命令 | 可直接执行 | 说明 |
| --- | --- | --- |
| `python3 .github/scripts/check-docs-links.py .` | **是**（仓库根目录执行，退出码 0，输出 59） | 无问题 |
| `npm run test` | **是**（159 例全过） | 无问题 |
| `node --test "packages/<pkg>/dist/test/**/*.test.js"` | **是** | **缺口**：`\<pkg\>` 为占位符，未列出实际包名（`core` / `data-mcp`）；实跑两个包分别为 128 / 31 |
| `node --input-type=module -e "import {buildIndex} from './packages/core/dist/src/index.js'; …"` | **是** | **缺口**：依赖先执行 `npm run build` 生成 `dist`，命令旁未注明；且该命令**不输出 conflict 数**，而 conflict 数被 §3／§5 引用 |

**结论：PASS** —— §4 表与 §3 引用数字全部与实测一致；命令本身可执行，缺口属**可执行性表述**层面（占位包名、缺 build 前置、conflict 无复核命令），不构成事实错误。

---

### 5 · 规则文档 §2.3 的平台后缀清单 —— **PASS**

**实现**（`packages/core/src/normalize/identity.ts:4-8`，`PLATFORM_SUFFIXES`）：

- 中文 **15** 项：抖音／天猫／京东／小红书／拼多多／快手／唯品会／淘宝／得物／视频号／微信／线下／实体店／直播／线下门店
- 英文 **9** 项：douyin／tmall／jd／xhs／pdd／ks／vip／taobao／offline

**文档**（`docs/normalize-rules.md` §2.3 级别 1 行，`f8c7c49` 已改）：中文 15 项 + 英文 9 项，**与实现逐项、逐序一一对应，无多无少**（该项自 `f8c7c49` 起成立）。

**结论：PASS。**

---

## 残留问题

按处理优先级排列。R-1、R-2 为**纯文本**，不触及实现。

| # | 级别 | 位置 | 问题 | 建议改法 |
| --- | --- | --- | --- | --- |
| **R-1** | **FAIL（条件 2 残留）** | `openspec/changes/data-mcp-core/result.md:379`、`:370` | M4 结构白名单守卫的归属仍记在「第四轮」名下（功能实际落地于 `9df255a`）；`f8c7c49` 只改了 commit message，台账未落地 | `:379` 改为「**第三轮（`9df255a`）已改为结构白名单**；第四轮复核复跑『实现侧新增 `matchScore`／`rating`』→ KILLED」；`:370` 把「M4 字面守卫不牢」从第四轮观察中移除（第四轮判定为 PASS，见 `review-p0-5-minimal.md` 附带观察 B） |
| **R-2** | **FAIL（条件 3 残留）** | `openspec/changes/data-mcp-core/result.md:393` | 仍写「R11 平台识别顺序回退（目录优先）｜KILLED（**27 例失败**）」，与同文件 `:378` 的「27 例中 20 例失败」自相矛盾；实测两种可能变异下均为 **27 例 / 20 例失败** | 改为「KILLED（该测试文件 27 例中 20 例失败）」 |
| R-3 | 建议 | PR #2 描述 | 台账数字过期：「159 例全过（**core 129 + data-mcp 30**）」（实际 128 + 31）、「文档相对链接 **57 条**」（实际 59）、「第四轮极小范围复核 \| **NOT_RUN**」（已完成，结论在 `result.md` §5）、「三轮独立复核」表述过期。**其「守卫加固」一条与事实一致，无需改** | 同步 PR 描述的三处数字与复核轮次表述 |
| R-4 | 建议 | `result.md`「本文数字的复核方式」小节 | ① 无 conflict 数的复核命令（所列命令只输出三项），而 conflict 数被 §3／§5 引用；② 分包命令用 `\<pkg\>` 占位符，未列 `core`／`data-mcp`；③ 索引规模命令需先 `npm run build`，未注明 | 补 1 条 conflict 统计命令；占位符换成实际包名；命令前加「（需先 `npm run build`）」 |
| O-5 | 观察（既存，非本轮引入） | `result.md:75`、`:62` | ① §2 任务清单表 P0-5 行写「**30 例**测试」，data-mcp 包现为 **31** 例；② §1 写「**7 个**缺数据的工具返回 `data-not-ready`」，而 §4／§7 写「**8 个**未就位工具」——实测 `index.unavailable` 为 **8**、可用 **9**。7 对应测试里的 7 项通用循环，品牌画像另计，但文档未说明该口径 | 同步为 31 例；`:62` 的 7 补一句口径说明或改为 8 |
| O-6 | 观察（既存，**NOT_RUN**） | `result.md:129` vs `:97` | 断网验证在 §4 表标 `NOT_RUN`、§3 DM14 标 `PASS`（依据 `review-p0-5.md` §D 的禁网实跑）。该证据产出于 `2cb9205`，而 `packages/core/src` 在 `26d173a` 有改动（平台识别／实体名／Jaccard，均为纯逻辑改动）。**本轮未重跑禁网实测** | 或在 §4 表注明「第一轮复核于 `2cb9205` 已实跑，后续核心层改动为纯逻辑」，或由复核者补一次禁网实跑 |

**已验证无问题的项**：代码实现侧无缺陷（M4 守卫结构白名单在位且对改名敏感；`compare_product_channel` 真实数据返回的顶层键实测为 `channelId, comparedDimensions, dimensions, onlyInChannel, onlyInProduct, spu`，**不含任何 score／grade／rating 键**）；测试 159 例全过；链接 59 条 0 错；审计 0 漏洞；数据守卫通过；`search_by_tag`、`compare_product_channel` 在真实数据上均可取到结果（P0 门禁所列两工具可用）。

---

## 结论

### 合并条件是否闭合

**部分闭合。**

| 条件 | 判定 | 依据 |
| --- | --- | --- |
| 条件 1（硬性）：两处 57 → 59 | **PASS** | §4 表 = 59，实测 = 59；第四轮台账改为引用式表述；result.md 内无 57 残留 |
| 条件 2（可选）：M4 白名单守卫归属改回 `9df255a` | **FAIL（半闭合）** | commit message 已改；**台账 `result.md:379`／`:370` 未改**，与功能实际落地提交不符 |
| 条件 3（作者自加）：R11 变异描述更正 | **FAIL（半闭合）** | `:378` 已改准；`:393` 仍留旧的不准确表述 |

### 是否建议合并

**有条件建议合并。**

- **代码侧无缺陷**，本轮复核到的全部工程检查（构建、159 例测试、链接 59、审计 0、守卫、索引规模、工具可用性）**均为 PASS**，条件 1 已闭合。
- 残留 R-1、R-2 是 `result.md` 内的**两处纯文本**（各 1 行），不触及实现与测试，不改变任何结论；R-3（PR 描述数字）同属文本同步。
- 建议**在同一个 PR 内补齐 R-1、R-2（并建议顺带补 R-3、R-4）**后合并；补齐只需一次**逐行文本复核**（核那几行），**不必重做任何实测项**，也不需要再走一轮完整复核。
- 若作者选择先合并、后补文本，则需在 PR 上明示这两行台账归属/数字仍待修正——**不得表述为「已全部闭合」**。

### 是否建议进入 P0-6

**暂不建议，建议补齐 R-1／R-2 后即进入。**

1. P0 门禁条件本身（`docs/engineering-workflow.md` §4.6：**归一化规则文档完成**；**真实数据可经 MCP 正确返回**；**`compare_product_channel` 与 `search_by_tag` 可用**）经核对**已满足**：规则文档 §2.3 平台后缀清单与实现逐项一致（项 5 PASS）、§7.2 已补 DM09「画像无样本量／覆盖率 → 相应键为 undefined」缺失语义（实测 `docs/normalize-rules.md:311`）、真实数据下 9/8 工具可用、两个门禁工具实测可取结果。
2. 但规范 §5.2 要求「独立复核完成，发现已处理」，而条件 2／条件 3 各有一处台账未落地（R-1、R-2）——**发现尚未全部处理**。这是**文本级门禁，不是重测门禁**。
3. 建议动作：作者在同一 PR 内补 R-1、R-2 → 复核者做一次**逐行文本复核**（只核那 2–4 行）→ 确认后即可开启 P0-6，无需重做本轮任何实测。
