# Data-Templates · 独立复核报告（第三轮 · 轻量重验）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分，全程只读；唯一写入为本文件）
> 候选：`work/data-templates` @ **`9a8f337`**（`git rev-parse work/data-templates` 核实；复核期间 tip 未前进）
> 基线：merge-base `main` @ `14bc15c`（任务书与 spec 写 `a506dc6`；本地 `main` 比之多 1 个纯文档提交 `14bc15c`，与本候选无交集，不影响结论——与第二轮报告同样注记）
> 范围：第二轮应修 R2-1～R2-4＋建议①（守卫 fail-closed）的重验，加回归与范围核对；**不重验**第一、二轮已 PASS 且本轮未改动的项（B1–B4／S1–S5／DT5 零依赖／生成器不读 `data/`）
> 日期：2026-11-28 · 结论：**PASS — 建议进 PR（阻断 0／应修 0／建议 3）**

本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。

## 1. 预期清单（打开实现前，从 spec §4／§5／§8 与 review-round2 应修 #1–#4 导出）

| 标识 | 预期 |
| --- | --- |
| E-R2-1 | 「使用说明」「表目录」抖音行、「列说明」抖音列三处都写明：实体与月份取自第 3／4 列列名、**必须改为自己的**；行为：改列名为另一合成实体／月份后另存 → `buildIndex` 归属随列名；列名不改 → 仍归「演示账号1」且无报错（说明必要，非多余警告） |
| E-R2-2 | 京东示例第 1 列＝「性别」；照说明另存 XLSX → `projections.gender` 存在 |
| E-R2-3 | 表目录／`data/README.md`／`docs/data-request.md` 三处都写抖音存 XLSX 会让索引构建报错中断；实际存 XLSX → `buildIndex` rejects |
| E-R2-4 | 表目录写明京东／天猫文件名「带月份与实体名，以 `_京东.xlsx`／`_天猫.xlsx` 结尾」；正向按文件名归属；`画像_京东.xlsx` → 静默错挂 |
| E-S1 | 损坏 tracked xlsx → `check-no-archive-content.mjs` 退出非 0；干净仓库 → 0 命中 exit 0 |
| E-REG | 485/485；diff 路径 ⊆ spec §6；`data/` 仅 README.md；lock 零差异；archive-content／data-guard／docs-links／audit 全过 |
| E-TDD | `.local/…/red-r2.log` 的 7 FAIL 对应本次测试且为产品级；变异 1–2 处关键实现 → 相关测试 FAIL |

## 2. 命令清单与结果（均在隔离工作树 `/tmp/uom-review-tpl-r3`）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-tpl-r3 9a8f337` | HEAD＝9a8f337；`templates/数据模板.xlsx` sha256 `f97048014ec4170f515a34b4d324628834d030626f07df5d3e13f7fe893790b0`（复核前后一致） |
| 2 | `npm ci --ignore-scripts` → `npm run build` | exit 0／0 |
| 3 | `npm test`（修单基线＋全部变异还原后各一次） | **tests 485／pass 485／fail 0**（两次） |
| 4 | `node --test packages/core/dist/test/data-templates.test.js` | 31／31 |
| 5 | `node /tmp/uom-r3-scratch/inspect.mjs`（exceljs 独立读入库模板，不用生成器与契约常量） | 24 sheet；三处关键措辞逐处子串核对见 §3；输出表目录抖音／京东／天猫行全文与列说明抖音／京东行 |
| 6 | `node roundtrip.mjs`（**自写 harness**：读入库 xlsx → 删第 2 行示例 → 填合成数据 → 按表目录另存 → 真实 `buildIndex`） | 17 条断言 **全部 PASS**，见 §3 |
| 7 | `node guard-sandbox.mjs`（自建沙箱：复制当前真实脚本＋坏 xlsx＋合成 jsonl 黑名单，`UOM_ARCHIVE_FIXED_ROOT` 指沙箱） | broken → **exit 1**（stderr 含「fail-closed」，不回显内容）；needle → exit 1；clean → exit 0 |
| 8 | `npm run check:archive-content`（干净工作树） | PASS exit 0：黑名单 85 条，文本 189＋xlsx 1，0 命中（＝result.md §10.3） |
| 9 | `python3 .github/scripts/check-data-guard.py .` | 「数据守卫通过」exit 0 |
| 10 | `python3 .github/scripts/check-docs-links.py .` | 相对链接 139 条，错误 0，告警 0 |
| 11 | `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| 12 | `git diff --name-only main...work/data-templates` | 14 文件，全部在 spec §6（含追认的 `.gitignore`、`scripts/check-no-archive-content.mjs`）；`-- package-lock.json` 0 行；`-- data/` 仅 `README.md` |
| 13 | `git check-ignore` 探针 | 仅 `templates/数据模板.xlsx` 可入库；`templates/other.xlsx`、`templates/sub/数据模板.xlsx`、`data/x.csv` 仍被忽略 |
| 14 | 只读 `.local/data-templates/fix-r2/red-r2.log` | 31 项 **24 PASS／7 FAIL**；失败名＝R2-1／R2-2／R2-3／R2-4／守卫 fail-closed／DT7 CSV／DT7 XLSX，均为 `AssertionError` 产品级（契约缺失、示例「预测性别」、措辞缺失、守卫 exit 0、jd gender 未投影），无导入／环境错误；`green-templates.log` 31/31、`check.log` 485/485 |
| 15 | 变异 M1／M1b／M2／M3／M3b／M4（§4） | 全部按预期 FAIL，全部还原 |
| 16 | 还原后：`npm test`／模板测试／`git status`／`cmp dist`／xlsx sha | 485/485；31/31；`git diff` 空；dist 与变异前逐字一致；sha `f9704801…` 不变 |

未使用 `git checkout`／`reset`／`stash`／`restore`；变异一律 `cp` 备份还原并以 sha256／`cmp`／`git diff` 证明。主工作树 `data/` 未读取、未复制；本报告不含任何真实名称／数值（所有数据为模板合成示例或自造合成值）。

## 3. 逐项结论

### R2-1 抖音列名规则 — PASS
- **三处措辞**（独立子串核对）：「第 3／4 列列名必须改为」「实体名与月份取自列名」「不改列名会把画像全部静默归到模板演示实体「演示账号1」」在 使用说明 r4／表目录抖音行「放到哪」列／列说明抖音 4 行「口径说明」列 **三处均为 true**；列说明第 3／4 列「必需／可选」格另写「列名须为「<起止年月><实体名>-占比」——实体名与月份取自该列名」。
- **自己按说明做一遍**：读抖音 sheet（r1 表头、r2「示例-预测性别,男,50.00%,100」＋行尾「填写前删除本行」）→ 第 3／4 列列名改 `2701-2712演示账号2-占比／-tgi` → 删示例行、填合成数据 → 另存 CSV 到 `source/live/演示账号2/2027-01/2701-2712演示账号2_抖音.csv` → `buildIndex`：`entityId="演示账号2"`、`month="2027-01~2027-12"`，无 error／未识别 issue。目录与文件名故意与实体无关的变体同样 `演示账号2`。
- **反向**：列名不改、放进 `演示账号2/2027-01/` 且文件名带 `2701-2712演示账号2` → `entityId="演示账号1"`、`month="2026-01~2026-12"`，**0 error issue**（静默）——说明确属必要。
- 探针：删示例后只留表头另存 → 抛「抖音画像文件只有表头，没有数据行」（空数据报错属合理行为，记录不计缺陷）。

### R2-2 京东示例维度 — PASS
入库「京东画像表」r2＝`示例-性别,男,0.5,100`（首列「性别」）。另存 `Sheet0` 到 `source/tmall/演示账号1/2026-10/2601-2612演示账号1_京东.xlsx` → `projections=["gender"]`（`labels.男`），无 unmapped issue。对照：「预测性别」→ `projections=[]`（修前状态）。列说明京东 4 行口径列均列出京东原生维度名并警示。

### R2-3 抖音 XLSX 后果 — PASS（附建议 1）
表目录「允许格式」：「仅 CSV（抖音解析器按 CSV 文本读取；存成 XLSX 会导致索引构建报错中断，不是静默跳过）」；`data/README.md:116,131` 同义两处；`docs/data-request.md:13`「抖音画像存成 `.xlsx` 会让索引构建报错中断」。三处均不再出现「XLSX 不被识别」。**实跑**：抖音 sheet 另存 XLSX 放 `source/live/…/2601-2612演示账号1_抖音.xlsx` → `buildIndex` **rejects**「抖音画像缺少「…-占比」列」，与文案一致。

### R2-4 京东／天猫文件名规则 — PASS
表目录两行含「带月份与实体名且以「_京东.xlsx」结尾」／「…「_天猫.xlsx」结尾」、「实体与月份取自文件名，缺了会静默错挂」。正向：`2601-2612演示账号1_京东.xlsx`（Sheet0）／`_天猫.xlsx`（明细）放在无关目录下 → 均 `entityId=演示账号1`、`month=2026-01~2026-12`。反向：`画像_京东.xlsx`／`画像_天猫.xlsx` → 不报错、`entityId="画像"`、`month=""`、0 error（静默错挂，规则必要）。

### 建议① 守卫 fail-closed — PASS
自建沙箱（非作者测试）：复制 `scripts/check-no-archive-content.mjs` ＋ tracked 坏 xlsx ＋ 合成 jsonl 黑名单 → **exit 1**，stderr「tracked xlsx 无法读取（按违规处理，不回显内容）… fail-closed」，坏文件内容未回显；xlsx 单元格命中合成黑名单 → exit 1；干净 xlsx → exit 0。干净工作树实跑 PASS（85／189＋1／0 命中）。实现核对：`scripts/check-no-archive-content.mjs:220-224` 读取失败入 `xlsxErrors`，`:252-259` 命中检查后 `exit 1`。

### 回归与范围 — PASS
485/485；14 个 diff 文件全部落在 spec §6 允许路径；`data/` 仅 `README.md`；`package-lock.json` 零差异（`package.json` 仅 `templates:build`）；`.gitignore` 仅一条精确例外；守卫白名单仅该路径（第一轮已核，本轮 diff 未变）。状态词核对：result.md §10 的 485／31／139／85 均与实跑一致；`offline-check`／`test:golden` 如实 NOT_RUN。

## 4. 变异表（隔离工作树内；备份 `/tmp/uom-r3-scratch/backups/`，`cp` 还原）

| # | 变异 | 预期 | 实际 | 还原核对 |
| --- | --- | --- | --- | --- |
| M1 | `legacy-formats.ts` 京东示例「性别」→「预测性别」，`npm run build` | FAIL | **FAIL 2/31**：R2-2＋DT3（DT7 读入库 xlsx 未变故不报，分工正确） | src 还原、重建后 `cmp` dist 与变异前一致；31/31 |
| M1b | 仅手改入库 xlsx 京东！r2c1 →「示例-预测性别」，不重建 | FAIL | **FAIL 3/31**：DT3＋DT7 CSV＋DT7 XLSX（「jd 示例维度「性别」未投影到统一维度 gender」） | sha 回到 `f9704801…`，`git diff` 空 |
| M2 | 守卫 `xlsxErrors.push` 改回静默 `continue` | FAIL | **FAIL 1/31**：「tracked xlsx 读取失败 → 守卫退出 1」 | 还原 9091 bytes，`git diff` 空 |
| M3 | `build-data-templates.mjs` 表目录不再拼 `headerRule` | FAIL | **FAIL 1/31**：DT3 | 还原，`git diff` 空 |
| M3b | M3 ＋ `npm run templates:build` 重建模板 | FAIL | **FAIL 1/31**：R2-1「「表目录」抖音行应写明抖音列名规则」 | 脚本＋xlsx 双还原，sha 一致 |
| M4 | 抖音 `saveFormat` 改回「XLSX 不被识别」，`npm run build` | FAIL | **FAIL 2/31**：DT2（README↔catalog）＋DT3 | src 还原、`cmp` dist 一致；31/31 |

## 5. 发现清单

### 阻断
无。

### 应修
无。

### 建议（不阻塞进 PR）
1. **`docs/data-request.md:13` 措辞与另两处不完全同字**：「会让索引构建报错中断」vs 表目录／README「存成 XLSX 会导致索引构建报错中断」。语义一致，但该文件不在 DT2 逐字锁范围（测试未引用 `data-request.md`），后续若调整表目录措辞不会同步到这里。可顺手对齐或加一条断言。
2. **模板「使用说明」r7 写「店铺 D00001 演示账号1／D00002 演示账号2」**，而契约 `CHANNEL_STORE_EXAMPLE_ROWS[1]` 与 `data/README.md:158` 的 D00002 是「演示旗舰店」。均为合成标识，无业务影响，但同一模板内自相矛盾；改 `build-data-templates.mjs:391` 一处即可（需重建模板）。
3. **守卫 xlsx 抽取只按 `.xlsx` 扩展名**（`check-no-archive-content.mjs:217`）：tracked 的旧格式 `.xls` 会落入 `isTextFile` 分支被静默跳过。当前仓库无 tracked `.xls`（`git ls-files` 核实），且 `*.xls` 全局忽略（`.gitignore:7`），属潜在缺口；可在同一分支把 `.xls` 也纳入「读不了即 fail-closed」。

## 6. 结论

**PASS — 建议进 PR。** 第二轮应修 R2-1～R2-4 与建议①全部关闭，且每项都有「文案三处＋真实 `buildIndex` 行为＋变异有牙」三重证据；回归 485/485、四项检查全过、范围与零依赖核对无偏差。建议 1–3 为文案对齐与潜在缺口，不构成合并阻塞。

本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。§5.3 四点原则仅就本变更核对：零新增依赖／出网路径、未触及评分内核与背对背字段；新增人工动作仍是「删示例行＋改抖音列名＋按规则另存」，本轮已把「改列名」的必要性写清并经反向实测。

### 未验证项
- `npm run offline-check`／`npm run test:golden`：**NOT_RUN**（需真实数据／参考资产授权；本变更未触及 `match/**`）。
- CI：未运行（本报告为本地隔离工作树结果）。
- 真实业务数据下的往返：**NOT_PROVED**（仅合成示例行；真实导出的维度名／列名变体不在本轮范围）。
- 第一、二轮已 PASS 且本轮未改动的项（B1–B4／S1–S5／DT5）未重验。

证据位置：harness 与日志 `/tmp/uom-r3-scratch/`（`inspect.mjs`／`roundtrip.mjs`／`guard-sandbox.mjs`／`mutate.mjs`、同名 `.log`、`test-final.log`、`backups/`；临时、全合成、无业务数据）。工作树 `/tmp/uom-review-tpl-r3`、临时数据根 `/tmp/uom-review-tpl-r3-data` 与守卫沙箱已清理。
