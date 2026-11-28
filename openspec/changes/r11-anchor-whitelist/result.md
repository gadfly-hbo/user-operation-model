# r11-anchor-whitelist — 结果记录

日期：2026-11-28。执行者：SDD·TDD 实现者（分支 `docs/r11-anchor-whitelist`，基点 `main @ 9770c67`）。

## 实际交付（对应验收标识）

- **A1 PASS**：`docs/engineering-workflow.md` §7.1 表格在「口径：什么算业务数据」行之后新增「口径：可公开的回归锚点白名单」行——黄金校验用例（G1–G5，含 §4.3 两条基准锚点）的输入描述（单价、商品属性、渠道名）与冻结分数为已公开回归契约，见于 match-calibration.md、讨论稿附录 B 代号表述、`scripts/golden-tool1.mjs` 用例标签及既有变更记录；依据 2026-11-28 用户裁定（R-11）；范围仅限已登记锚点，新增须另行登记。新增行不含金额。
- **A2 PASS**：`docs/产品讨论稿-v0.2.md` 决策记录表末尾追加 D13（黄金锚点口径；R-11 白名单 + R-12 字段白名单以工具2 严格清单为准、切片 E 落实；2026-11-28）；§9 Q8、Q9 状态列由「**待定**：…」改为「✅ D13」，问题文字保留（与既有已决行 Q5「✅ D3：…」格式一致）。
- **A3 PASS**：`docs/architecture-review-v1.md` §7 表头说明句末补「R-11、R-12 于 2026-11-28 按建议拍板（D13）」，其余未动。
- **A4 PASS**：四项检查全绿（见下）。

## 检查命令与结果

| 检查 | 命令 | 结果 | 证据 |
| --- | --- | --- | --- |
| 相对链接 | `python3 .github/scripts/check-docs-links.py .` | PASS：165 条链接，错误 0，告警 0 | `.local/docs-change/r11-anchor-whitelist/check-docs-links.log` |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | PASS：无业务数据目录／数据文件／超大文件 | `.local/docs-change/r11-anchor-whitelist/check-data-guard.log` |
| 空白错误 | `git diff --check` | PASS：无输出 | `.local/docs-change/r11-anchor-whitelist/git-diff-check.log` |
| 金额 grep | `grep -nE '¥ ?[0-9]+\.[0-9]{2}' docs/engineering-workflow.md` | PASS：仅命中既有第 75 行（§4.3，本次未动）；新增 §7.1 行不在其中 | `.local/docs-change/r11-anchor-whitelist/amount-grep.log` |

证据目录：`/Users/huangbo/Dev/Projects/user-operation-model/.local/docs-change/r11-anchor-whitelist/`（主仓库 `.local/`，不入库）。

## 状态

**PASS**（限本变更范围）。

## NOT_RUN / 未验证项

- `npm run check` NOT_RUN：本变更不触及代码，按交接口径不适用；未改动任何会使其失败的文件。
- 独立复核 NOT_RUN：按交付纪律由未参与本候选的复核者另行执行，本文不代替。
- 金额白名单的语义合理性（措辞是否与冻结基线文档一致）属复核者裁量，作者自述不构成验收。

## 与 spec 的偏差

- 起点偏差：交接声明工作树起点应为 `main @ 9770c67`，实际工作树停在 `fae2759`（`work/foundation-identity-health`，含无关切片代码提交）。已改从 `main @ 9770c67` 新建本分支，未带入任何无关提交；需主 agent 知悉。
- 其余无偏差。

## 已知限制与后续点（未在本变更范围，留主 agent 裁量）

- `docs/architecture-review-v1.md` 顶部拍板状态注（第 5 行）仍写「新增待拍板 **R-11、R-12**」，按「不改其它内容」指令未动。
- `docs/产品讨论稿-v0.2.md` 附录 B 两处注（「待 R-11 裁定」「锚点里的单价是否算业务数据见 §9 Q8」）未动——D13 已使其语义成立，后续文档整理可收口为指向 D13。
- R-12（字段白名单以工具2 严格清单为准）的代码落实归切片 E。

## 交付回填（主 agent，2026-11-28）

| 项 | 结果 |
| --- | --- |
| 用户授权 | 2026-11-28 常设授权（按推荐执行；推送／PR／CI／绿了合并默认授权） |
| 独立复核 | PASS（应修 1：两处「待拍板」旧注，已修并入库 `review.md`） |
| 推送 | `docs/r11-anchor-whitelist @ b553026` |
| PR | [#10](https://github.com/gadfly-hbo/user-operation-model/pull/10) |
| CI | Check 运行 `46157174978`：两项 `SUCCESS`；`mergeStateStatus` CLEAN |
| 合并 | squash 合并到 `main @ ad254d1`（`--match-head-commit`）；远端分支已删；本地 `main` 已快进；工作树与本地分支已删（删前核对树与 squash 提交零差异） |
