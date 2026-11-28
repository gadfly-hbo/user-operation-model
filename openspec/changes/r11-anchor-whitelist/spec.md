# r11-anchor-whitelist — 黄金锚点口径登记

## 目标

落实架构梳理报告 R-11 的裁定（用户 2026-11-28 按建议拍板，记为产品讨论稿 D13）：把工具1 黄金校验用例（G1–G5，含 §4.3 两条基准锚点）的输入描述（单价、商品属性、渠道名）与冻结分数登记为工程规范 §7.1 的「可公开的回归锚点白名单」，不视为业务数据入库；同步把讨论稿 §9 的 Q8／Q9 由待定转为已决。纯文档变更，不改任何代码、测试、脚本。

## 允许修改路径

- `docs/engineering-workflow.md`（仅 §7.1 表格新增一行）
- `docs/产品讨论稿-v0.2.md`（决策记录表追加 D13；§9 Q8／Q9 状态改 ✅ D13）
- `docs/architecture-review-v1.md`（§7 表头说明补一句拍板记录）
- `openspec/changes/r11-anchor-whitelist/`（本目录）

## 明确不做

- 不改写 `openspec/changes/docs-product-v0.2-readme/result.md` 等任何历史记录
- 不复制任何具体金额或分数到新增文字
- 不触及 `scripts/`、`packages/`、测试文件
- 不放宽白名单以外的金额、属性组合或画像份额口径

## 验收标识

1. A1：工程规范 §7.1「口径：什么算业务数据」行之后新增「口径：可公开的回归锚点白名单」行，含依据（2026-11-28 用户裁定，R-11）、范围限定（仅限已登记锚点、新增须另行登记），且该新增行不含任何金额
2. A2：讨论稿决策记录表末尾有 D13 行（含 R-11 白名单与 R-12 字段白名单口径、日期 2026-11-28）；§9 Q8、Q9 状态列为 ✅ D13，问题文字保留
3. A3：architecture-review-v1.md §7 的 R-11／R-12 表头说明处含「R-11、R-12 于 2026-11-28 按建议拍板（D13）」，其余内容不变
4. A4：`check-docs-links.py` 零错误；`check-data-guard.py` 通过；`git diff --check` 干净；工程规范中含金额行仅限既有行（新增行不在其中）

## 适用检查计划

`python3 .github/scripts/check-docs-links.py .`、`python3 .github/scripts/check-data-guard.py .`、`git diff --check`、`grep -nE '¥ ?[0-9]+\.[0-9]{2}' docs/engineering-workflow.md`（新增行不得命中）。本变更不触及代码，`npm run check` 不适用；不改动任何会使其失败的文件。

## 任务目标执行清单

- [x] 读入口文档、工程规范 §4.3／§7.1／§9.3、梳理报告 §7 R-11／R-12、讨论稿 §9 Q8／Q9、match-calibration.md 结构、openspec 约定
- [x] 三处文档编辑（A1–A3）
- [x] 检查并留存证据（A4）
- [x] result.md 据实记录并提交

## 未决问题

无（R-11／R-12 均已按建议拍板；R-12 的字段白名单落实归切片 E，不在本变更范围）。
