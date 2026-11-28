# 文档变更 · 产品讨论稿升 v0.2、README 改现状、梳理报告入库

> 依据：用户 2026-11-28 批准的 R-10（见 `docs/architecture-review-v1.md` §7）。纯文档变更，不涉及代码、测试、依赖。

## 完整可观察结果

1. `docs/产品讨论稿-v0.2.md` 取代 v0.1（git 保留历史），内容为主 agent 草稿：工作台定为产品形态，D1–D12 决策记录，Q4／Q6／Q7／Q8／Q9／Q10–Q13 标「待定」；标题「## 8. 交付节奏（建议）」原文保留。
2. `docs/architecture-review-v1.md` 入库；文首与 §8 的「未入库」陈述改为已入库；切片 A 状态为已合并。
3. 全仓指向 `产品讨论稿-v0.1.md` 的链接改到 v0.2；现行文档（`AGENTS.md`、`README.md`、`docs/*.md`）的链接显示文字统一为 v0.2；`openspec/changes/` 下的历史记录只改路径。
4. `README.md` 改写为当前交付状态：每条陈述可从仓库核实，不写会过期的数字。
5. `AGENTS.md` 与 `docs/engineering-workflow.md` 相对基线只改链接。

## 验收标识

| 标识 | 内容 |
| --- | --- |
| DOC-1 | 只改 `.md`；`package.json` 与锁文件未动 |
| DOC-2 | v0.2 与主 agent 草稿逐字节一致，除事实性修订（切片 A 已合并）与复核后的修订（金额改代号、补 Q13） |
| DOC-3 | D1–D12 逐条对应 R-1～R-10；未拍板项未被写成已决 |
| DOC-4 | 全仓无 `产品讨论稿-v0.1` 引用；相对链接与 `#8-交付节奏建议` 锚点可解析 |
| DOC-5 | 入口两文件只改链接；历史记录只改路径 |
| DOC-6 | README 陈述可核实；无测试用例数等易过期数字（带指针的现状数字可接受） |
| DOC-7 | 新增文档不含金额、店铺名＋属性组合等业务数据 |
| DOC-8 | 文档链接检查、数据守卫、归档内容守卫、`git diff --check` 全过 |

## 允许修改路径

`docs/产品讨论稿-v0.1.md`（删除）、`docs/产品讨论稿-v0.2.md`、`docs/architecture-review-v1.md`、`README.md`、`AGENTS.md`（仅链接）、`docs/*.md`（仅链接）、`openspec/changes/**/*.md`（历史记录仅链接路径）、`openspec/changes/docs-product-v0.2-readme/**`。
