# R-10 文档变更 · 复核后修订重验（第二轮）

- 复核者：`SDD·TDD 独立复核者`（未参与候选任何部分；全程只读）
- 候选：工作树 `/Users/huangbo/Dev/Projects/user-operation-model/.qoder/worktrees/agent-SDD-TDD-6a86938f`，分支 `docs/product-v0.2-readme`，HEAD **`4eb13f9`**（已核对），上一轮候选 `f01daa4`，基线 `main @ 2ce0564`（merge-base = 2ce0564）；修订范围 `f01daa4..4eb13f9` 共 1 个提交、6 个文件（+207 / −4）
- 隔离：命令均以 `cd <候选工作树>` 或 `git -C <候选工作树>` 执行，未在主仓库根执行命令；无 git 写操作；候选 `git status --porcelain` 复核前后均 0 行；仅写入 `/Users/huangbo/Dev/Projects/user-operation-model/.local/review-docs/round2/`

## 总结论：**PASS（附带条件：应修 2、建议 2；阻断 0）**

上一轮要求落实的修订全部落实，未引入阻断性问题。新发现的 2 项应修都是记录文字与事实的偏差，可在交付回填时一并改掉。

## 命令与退出码（均在候选工作树内）

| # | 命令 | 退出码／结果 |
| --- | --- | --- |
| C1 | `git rev-parse --short=7 HEAD`；`git branch --show-current`；`git status --porcelain`；`git merge-base main HEAD` | `4eb13f9`；`docs/product-v0.2-readme`；0 行；`2ce0564`（= `main`） |
| C2 | `git diff --name-status f01daa4..4eb13f9` | 6 个文件（M 3、A 3）；`\| grep -v '\.md$'` 无输出 |
| C3 | `git diff f01daa4..4eb13f9`（README、梳理报告、讨论稿） | hunk 仅 `README.md:14`、`+:84`；`architecture-review-v1.md:341`；`产品讨论稿-v0.2.md +:432`、`:460-461 → :461-464` |
| C4 | `diff` ＋ `shasum -a 256`：上一轮报告 vs `openspec/changes/docs-product-v0.2-readme/review.md` | 退出 0；sha256 相同；均 141 行 |
| C5 | `grep -nE '¥ ?[0-9]+\.[0-9]{2}'` 于梳理报告与 v0.2（另查全角元与三位整数两位小数） | **0 命中**；阳性对照：同一 pattern 在 `f01daa4` 命中 1 ＋ 2 |
| C6 | 店铺名片段 grep（v0.2、梳理报告、README、本变更 spec／result） | 仅 `v0.2:462` 的代号化渠道名命中；对照 `f01daa4` 命中 2 |
| C7 | 款号形态 `[A-Z]{2,}[0-9]{5,}` 于新增文档 | 0 命中 |
| C8 | `grep check:archive-content package.json README.md` | `package.json:23`（`node scripts/check-no-archive-content.mjs`）；`README.md:84` |
| C9 | `python3 .github/scripts/check-docs-links.py .` | **0**；163 条，错误 0，告警 0 |
| C10 | `python3 .github/scripts/check-data-guard.py .` | **0** |
| C11 | `git diff --check f01daa4..4eb13f9` | **0**；0 字节 |
| C12 | 加跑 `npm run check:archive-content` | **0**；黑名单 85 条、tracked 文本 211 ＋ xlsx 1，PASS（黑名单运行时取自主仓 data 目录，与上一轮行为相同） |
| C13 | `git diff --quiet f01daa4..4eb13f9 -- AGENTS.md docs/engineering-workflow.md` | 0（无差异） |
| C14 | `git worktree list`；`git fsck --connectivity-only`；收尾 `git status --porcelain \| wc -l` | 3 个工作树登记正常；fsck 退出 0（仅悬空对象，未追查）；0 |

日志：同目录 `check-docs-links.log`、`check-data-guard.log`、`git-diff-check.log`、`check-archive-content.log`。

## 逐项结论

| # | 项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | 应修 F1：金额与「店铺名＋属性」组合 | **PASS** | C5／C6 两文件 0 命中，阳性对照证明 pattern 有效；R-11 行（`architecture-review-v1.md:341`）与附录 B（`v0.2:461-462`）均改代号，`v0.2:464` 有一句口径说明 |
| 2 | 建议 S3：README 工具2 行 | **PASS** | `README.md:14` 改为「按讨论稿 D8 应在工作台标『实验基线』，该呈现待后续切片落地」；与 D8（`v0.2:17`）、已批 R-6（`architecture-review-v1.md:336`）一致；全仓含「实验基线」的只有 README、梳理报告、讨论稿与本变更两份记录，「待落地」属实；指向的 `docs/match-model-baseline.md`、`docs/产品讨论稿-v0.2.md` 存在 |
| 3 | 建议 S5：README 本地检查块 | **PASS** | `README.md:84` 已列；根 `package.json:23` 有该脚本；`package.json` 本次未动 |
| 4 | 建议 S6：§9 新增 Q13 | **PASS** | `v0.2:432` 标「**待定**」；13 条 Q 中 9 条待定（Q4、Q6–Q13）；措辞为「规则已批准；…落地前确认是否转业务侧核对」，未把待拍板事项写成已决。用词见建议 N3 |
| 5 | 新增变更记录 | **PASS**（附 N1、N2） | `review.md` 与上一轮报告逐字节相同（C4）；处理表 F1／S3／S5／S6「已修」均与 diff 相符，S1／S2／S4 标「接受」、未谎称已修；「过程事故」与任务给定事实一致，并多披露两项不利细节（原位残留指针文件、删除一个受跟踪文件），未见夸大或缩小；事故经过本身未复核 |
| 6 | 无新问题 | **PASS** | 6 个文件全 `.md`；D1–D12 表（`v0.2:10-21`）无 hunk；Q4／Q6–Q9（`:423-428`）与 Q10–Q12 未改、仍待定；`:389`「## 8. 交付节奏（建议）」在；两入口文件无差异（C13）。新发现见下，均非阻断 |
| 7 | 检查 | **PASS** | C9–C11 退出 0；加跑 C12 退出 0 |

## 新发现

### 应修

**N1 · R-11 行对黄金脚本的描述与事实不符；`result.md` 沿用的计数少计**
- 位置：`docs/architecture-review-v1.md:341`（R-11 行括注）；`openspec/changes/docs-product-v0.2-readme/result.md:12`。
- 事实：R-11 行称「黄金脚本本身只硬编码款号与渠道标识，价格从参考数据读」。实际 `scripts/golden-tool1.mjs:32-70` 五条用例的 `label` 与 `channel` 字符串硬编码了「金额＋商品属性＋店铺名」；只有参与计算的取值来自参考数据。该脚本与 `main` 逐字节一致，属预存、非本候选引入。
- 计数：讨论稿原附录 B 的那个金额，在基线见于 8 个已跟踪文件（上一轮记 6 个），本变更修掉 v0.2 一处后 HEAD 仍余 7 个（含 `openspec/changes/tool1-match-kernel/spec.md:70-74`、`review-p1.md:204`、黄金脚本）。`result.md:12` 写「基线里既有的 6 处…不在本变更范围」：少计，且这 6 处里有一处恰在本变更内修掉。
- 另：该行仍称这些金额「在讨论稿附录 B…里都有」，而附录 B 本次已改代号，行内未同步。
- 影响：R-11 待拍板，行内描述会让决策者低估「改成代号」选项的清理面。
- 闭合：改写 R-11 行括注与 `result.md:12` 的计数；脚本本身留给 R-11，本变更不动。

**N2 · `result.md:26`「见本记录末尾『交付回填』」是前向引用**
- 事实：本提交的 `result.md` 没有该节（标题只有执行信息／复核发现与处理／过程事故／检查／状态）；变更目录内只有针对 `f01daa4` 的复核报告。即修订后候选 `4eb13f9` 的四项检查与第二轮复核在记录里尚无落点，而 spec DOC-8 与状态 `PASS` 已写。
- 影响：记录先于证据（本轮实跑四项均为退出 0，见 C9–C12）。
- 闭合：交付回填时补本轮检查退出码并把本轮报告入库，或把 `:26` 改指本轮报告。

### 建议

- **N3 · `docs/产品讨论稿-v0.2.md:432`、`:464` 新增交叉引用未定义**：「切片 B2」全仓无定义，已跟踪文档只有「切片 B」（`architecture-review-v1.md:305`、`:348`），而 `architecture-review-v1.md:139` 的「B2」是发现编号（同月多平台取一份），易混；`:464` 用「R-11」，紧邻的下一行同一议题写「§9 Q8」。建议统一写「切片 B」与「§9 Q8（梳理报告 R-11）」。
- **N4 · `spec.md:22`（DOC-6）「无易过期数字」与 `result.md:16`（S4 接受现状数字）字面不一致**。建议 DOC-6 改为「无硬编码测试数等；现状数字须带指针」。

## 未验证项

- 「过程事故」经过本身（`NOT_RUN`）：仅核对记录与任务给定事实一致、未夸大缩小；旁证为 C14（工作树登记正常、连通性检查退出 0）。
- 附录 B 保留的回归锚点评分分值是否属工程规范 §7.1「数值样本」，未判定（v0.1 即有，上一轮未列为发现，归 Q8／R-11）。
- GitHub 页面锚点渲染未点击验证；`npm run check`、`test:golden` 未运行（纯文档变更，`NOT_RUN`）。
- S1／S2／S4 标「接受」属负责人裁定，我只核对了未谎称已修。

## 摘要

总结论 PASS（无阻断；新增应修 2、建议 2）。上一轮 F1／S3／S5／S6 未落实 0。新发现：R-11 行对黄金脚本描述不实、result.md 计数少计、「交付回填」为前向引用。报告：主仓 `.local/review-docs/round2/review.md`
