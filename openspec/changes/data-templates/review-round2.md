# Data-Templates · 独立复核报告（第二轮 · 范围限定重验）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分，全程只读；唯一写入为本文件）
> 候选：`work/data-templates` @ **`2a86d49`**（任务书写 `eb1f4f0`，该对象不存在；以开工时 `git rev-parse work/data-templates` 实际值为准）。相对第一轮候选 `6173a33` 新增 4 个提交：`6017afd` 规格修订／`c9db5fc` 修单代码＋模板／`e4a8568`+`2a86d49` 修单文档
> **候选在复核期间前进**：收尾时分支 tip 为 **`dece365`**（仅 `spec.md` §6 追加 1 行：追认 `scripts/check-no-archive-content.mjs` 路径）。`git diff --name-only 2a86d49 dece365` 只有 `openspec/changes/data-templates/spec.md`；模板 blob 同为 `69fea54…`；代码／测试／守卫／package 文件零变化——本报告对代码、模板、测试、守卫的全部结论**适用于 `dece365`**；唯「§6 允许路径」一项在 `2a86d49` 时该脚本尚不在清单内（result.md §9.6 如实标「待确认」），到 `dece365` 才闭合。复核者未参与该提交。
> 基线：本地 `main` @ `14bc15c`（merge-base；`origin/main` `a506dc6` 与之仅差 1 行文档提交，不影响本复核）
> 范围：第一轮阻断 B1–B4 的修复＋应修 S1–S5 回归＋DT7 往返＋记录与范围；**不重验**第一轮已 PASS 且本轮未改动的项（DT5 零依赖／生成器不读 `data/`）
> 日期：2026-11-28 · 结论：**PASS（无阻断；5 条应修建议合并前处理，其中 2 条为模板指引本身失真）**

### 结论速览

| 项 | 结论 | 一句话依据 |
| --- | --- | --- |
| B1 版式重做 | PASS | 24 sheet；19 个数据 sheet 均 r1 表头(ySplit=1)／r2「示例-」前缀＋红字「填写前删除本行」＋底色／r3 起空（exceljs 独立读） |
| B1 / DT7 业务侧往返（核心） | PASS | 自写 harness 17 张照「表目录」另存（A 组 CSV／XLSX／数字录入三形态）→ 真实 `buildIndex` 全部识别，0 静默跳过、0 error |
| B2 channels 契约 | PASS | 表头 14 列＝`channel.ts` `COLUMN_MAP` 14 键；行为锁存在且 M-D 证明有牙 |
| B3 平台硬规则 | PASS（附应修 #3/#4） | 京东 `_京东.xlsx`+`Sheet0` 放 `source/tmall/` 仍解析为 jd；`_京东.csv`／商品 CSV 静默跳过与措辞一致；抖音 XLSX 实为**抛错中断**非「不被识别」 |
| B4 product-attributes | PASS | sheet 已删；README「无独立加载点」与 `normalize/product.ts`／`fields.ts`／`build.ts` 一致；products 另存后只成 1 张商品表、无「多张商品表中重复」 |
| S1 防漂移整 sheet | PASS | M-A（表头）双 FAIL；M-A2（仅示例值）DT3 FAIL；M-C（改契约不重建）4 FAIL |
| S2 archive-content 覆盖 xlsx | PASS | 基线「xlsx 单元格文本 1 个」0 命中；M-B 注入归档片段 → exit 1 命中该文件 |
| S3 products 表头＝字段目录 | PASS | 16 列全在 `PRODUCT_FIELDS.sources`；往返 `category.l3/l2` 真实落位 |
| S4 result.md 与 tip 一致 | PASS（附建议） | §8 已回填 `c9db5fc`；§9 与 tip 实测一致（475/475、sha `03b21d5a…`）；首轮数字未标注处见建议 |
| S5 B 组解析器测试 | PASS | DT7 products／channels 往返＋B2 行为锁＋S4 字段目录锁 |
| §6 路径／守卫／.gitignore／零依赖 | PASS（§6 以 `dece365` 为准） | 13 个文件全在允许路径（`scripts/check-no-archive-content.mjs` 的追认在复核期间提交 `dece365`，`2a86d49` 时尚缺）；`package-lock.json` 零差异；`data/` 仅 README.md；`.gitignore` 与守卫白名单只放行精确路径（探针） |
| TDD 真实性（修单轮） | PASS | `.local/…/red-fixround.log` 21 项 15 FAIL／6 PASS，失败名与现测试一一对应；`flip-a.log` 19/2 与 §9.4 一致 |
| offline-check／test:golden | NOT_RUN | 需真实数据／参考资产授权；本轮仍未触及评分内核 |

---

## 0. 复核范围与约束

- 顺序：先读 spec §4／§5 DT7／§3 B 组与 result.md §8–§9，**在打开实现前**写下预期清单（§1），再读 diff、解析器与作者测试。
- 隔离：`git worktree add --detach /tmp/uom-review-tpl-r2 2a86d49`（唯一 git 元数据写，不改分支／提交）；临时数据根 `/tmp/uom-review-tpl-r2-data/`（全合成，仅模板示例值）；harness 与日志在 `/tmp/uom-r2-scratch/`。**未使用** `git checkout`／`reset`／`stash`／`restore`，变异一律文件备份还原并以 sha256／`cmp`／`git diff` 证明。
- 真实数据：主工作树 `data/` 只读；仅在 M-B 中由脚本把归档黑名单同源片段（18 字）写入工作树副本的一个单元格，**未打印、未落日志**，随即以备份覆盖还原。本报告不含任何真实名称／数值。

## 1. 预期清单（打开实现前导出）

| 标识 | 预期 |
| --- | --- |
| E1 | 「使用说明」四步（找表→删第 2 行→从第 2 行填→按表目录规则另存）＋声明填 README 不落盘 |
| E2 | 「表目录」每行：表名｜sheet 名｜放到哪（精确文件名规则）｜允许格式（含 sheet 名）｜必需性｜解锁什么｜解析器状态 |
| E3 | 「列说明」：表名｜列名｜必需／可选｜口径 |
| E4 | 数据 sheet：r1 表头冻结；r2 示例（首列「示例-」＋行尾红字「填写前删除本行」）；r3 起空；款号 `SYN-`、店铺 `D0…` |
| E5/DT7 | 业务侧照说明另存→真实解析器全部识别；测试须从 xlsx 读、实际写文件、走真实解析；「照说明做却报错」即 FAIL |
| E6 | products 表头＝解析器实际必需列且每列在字段目录 `sources` 内 |
| E7 | channels 表头＝`normalize/channel.ts` 实际消费列；「渠道层级对照」已删；行为锁有效 |
| E8 | `product-attributes` 已删；README「无独立加载点、暂不需要提供」理由与 `normalize/product.ts`／`product/catalog/fields.ts`／`index/build.ts` 一致 |
| E9 | 三平台写清文件名后缀／格式／sheet 名／目录，且与 `platform.ts`／`normalize/index.ts`／`build.ts` 一致（`_京东.xlsx` 后缀优先于目录；京东不得被当天猫解析） |
| E10 | 防漂移整 sheet 全行比对（含示例行）；改契约不重建→FAIL |
| E11 | `check:archive-content` 扫描 tracked xlsx 单元格文本；注入真实片段→FAIL |
| E12–E17 | 守卫白名单／`.gitignore` 只放行该文件；零新增依赖；`data/` 仅 README.md；文档口径一致；§6 允许路径⊇实际 diff；状态词真实 |

## 2. 命令清单与结果（均在 `/tmp/uom-review-tpl-r2`）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-tpl-r2 2a86d49` | HEAD＝2a86d49；`templates/数据模板.xlsx` sha256 `03b21d5a651d1857a752e08545e40bbe30253821c02bae92e0922fa263b51ef6`（＝result.md §9.4 所述） |
| 2 | `npm ci --ignore-scripts` → `npm run build` | exit 0／0 |
| 3 | `npm test` | **tests 475／pass 475／fail 0**（＝预期 475） |
| 4 | `node --test packages/core/dist/test/data-templates.test.js` | 21／21 |
| 5 | `node /tmp/uom-r2-scratch/inspect.mjs`（exceljs 独立读入库模板） | 24 sheet；版式 0 问题；输出表目录全文供逐表对照 |
| 6 | `node roundtrip.mjs csv｜xlsx｜typed`（自写 harness：删 r2→按表目录另存→真实 `buildIndex`） | 三形态均 **17/17 识别，skipped=0，errorIssues=0**；products=1（`l3=演示品类,l2=演示中类`）；channels `D00001/演示账号1`；portraits `douyin/jd/tmall` 同实体 `演示账号1` |
| 7 | `node jd-dimension.mjs`（对照实验） | 模板京东示例「预测性别」→ `projections=[]`＋`unmapped-dimension`；改「性别」→ `projections=["gender"]`；天猫示例 → `["gender"]` |
| 8 | `node edge-probes.mjs`（8 个措辞边界探针） | 见 §3.B3 |
| 9 | `npm run check:archive-content`（干净／变异／还原） | PASS（85 条黑名单，文本 188＋xlsx 1）／**FAIL exit 1**／PASS |
| 10 | `python3 .github/scripts/check-data-guard.py .` | 「数据守卫通过」exit 0 |
| 11 | `python3 .github/scripts/check-docs-links.py .` | 相对链接 139 条，错误 0，告警 0 |
| 12 | `git check-ignore` 探针 | `templates/数据模板.xlsx` 不被忽略；`templates/other.xlsx`、`templates/sub/数据模板.xlsx`、`data/x.csv` 仍被忽略 |
| 13 | `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| 14 | `git diff --name-only main...work/data-templates`；`-- package-lock.json`；`-- data/` | 13 文件；`2a86d49` 时 §6 覆盖 12 个（`check-no-archive-content.mjs` 待追认），`dece365` 追认后 13 个全闭合；lock 零差异；`data/` 仅 `README.md` |
| 15 | 只读 `.local/data-templates/fix-review/{red-fixround,flip-a,flip-b}.log` 摘要行 | RED 21 项 15 FAIL／6 PASS；Flip A 19 pass／2 FAIL（DT1＋DT3）；flip-b.log 存在 |
| 16 | 变异 M-A／M-A2／M-B／M-C／M-D（§4） | 全部按预期 FAIL，全部还原 |
| 17 | 还原后复跑：`npm test`／模板测试／`git diff`／xlsx sha | 475/475；21/21；`git diff` 空；sha `03b21d5a…` 不变 |

## 3. 逐项结论

### B1 版式 — PASS
exceljs 独立读入库文件（不用生成器、不用作者测试）：sheet 顺序 使用说明｜表目录｜列说明｜A 12｜products｜channels｜抖音｜京东｜天猫｜小红书画像｜monthly-mix｜clearance-leap｜时间范围声明（24）。19 个数据 sheet：r1 表头无空列、`views[0].ySplit=1`；r2 首列 `示例-`、行尾第 N+1 格「填写前删除本行」、字色 `FFC00000`、底色 `FFFFF2CC`；`rowCount=2`（r3 起空）。「表目录」7 列与 spec §4 一致；「列说明」表头＝表名｜列名｜必需／可选｜口径说明；「使用说明」含四步＋README 声明；小红书 sheet 无「另存」；声明 sheet r1 表头＋5 项逐行。

### B1 / DT7 业务侧往返 — PASS
自写 harness（`roundtrip.mjs`，不复用 `data-templates.test.ts` 的 `saveRoundTrip`）：从入库 xlsx 取 r1 表头与 r2 示例（剥前缀与行尾标注），按「表目录」逐表规则另存到临时数据根：A 组 `tables/`／`retention/`（表目录首列路径），products→`domains/04_商品信息/商品宽表.xlsx`，channels→`domains/02_渠道信息/渠道店铺宽表.xlsx`，抖音→`source/live/演示账号1/2026-10/2601-2612演示账号1_抖音.csv`，京东→`source/tmall/演示账号1/2026-10/2601-2612演示账号1_京东.xlsx`（sheet `Sheet0`），天猫→同目录 `_天猫.xlsx`（sheet `明细`）。XLSX 另存时 sheet 名保留模板名（模拟「移动或复制→新工作簿」）。三形态：A 组 CSV／A 组 XLSX（表目录「均可」）／数字单元格录入（`30%`→0.3、`1000`→数字）。结果三形态均：12 个 A 字段各 1 条；products 1 条且 `category.l3/l2` 落位；channels 识别；三平台画像识别，京东在 `source/tmall/` 下仍为 `jd`；**无「未识别的数据文件」**、无 error 级 issue（仅 2 条预期 warning：多平台未登记冲突映射、京东示例维度未映射，见应修 #2）。
作者 DT7 测试核对：`readCommittedWorkbook()` 读入库 xlsx（`:85-89`）→ `exampleAsDataRow` 剥前缀／标注（`:298-322`）→ `ensureDir`+`writeXlsx`/`writeCsv` **实际写文件**（`:342-348`）→ `buildIndex({dataRoot})`（`:761-772`）；非蓝图拼 CSV。京东夹具放 `source/tmall/` 并断言 `platformLabels.jd` 实体（`:262-265,390-394`）。

### B2 channels — PASS
入库表头 14 列＝`legacy-formats.ts:64-79` ＝`normalize/channel.ts:6-21` `COLUMN_MAP` 14 键（逐列同名，无多余、无遗漏）；「渠道层级对照」在模板、README、`docs/`、`normalize-rules.md` 均 0 命中（`git grep`）。行为锁测试 `data-templates.test.ts:669-692`：用表头构造渠道表→真实 `normalizeChannelTable`→`channelId`／`name` 落位、`attributes` 为 undefined；**M-D** 删解析器一条映射→该测试精确 FAIL（`不得落 attributes：{"关店时间":"V13"}`）。

### B3 平台硬规则 — PASS（附应修 #3、#4）
表目录／README 逐字包含 `fileNameRule`／`saveFormat`／`sheetName`（DT2 测试 `:633-651` 锁定）。与代码对照：`platform.ts:13-18` 后缀优先于目录（`_京东.xlsx`→jd，即便在 `/tmall/` 目录）；`normalize/index.ts:146,224` 天猫 `明细`／京东 `Sheet0`；`build.ts:315-323` CSV 分支只处理抖音。探针：P2 抖音无后缀→静默跳过 ✓；P3 `_京东.csv`→静默跳过 ✓；P7 商品 CSV→静默跳过 ✓；P4 京东 sheet 名未改→抛错（规则已写明）✓。**偏差**：P1 抖音存 XLSX→`detectPlatform=douyin`→`normalizeDouyinPortrait`→**THROW「抖音画像缺少「…-占比」列」，整个 `buildIndex` 中断**，与表目录／README「XLSX 不被识别」「静默跳过（不报错、不生效）」不符（应修 #3）。

### B4 product-attributes — PASS（附建议）
sheet 集合无 `product-attributes`（DT0 `:414-421`）；`data/README.md:88,161` 标「当前无独立加载点，暂不需要单独提供」。代码核对：`normalize/product.ts:30-36` 列→`FieldCatalog.findBySource`；`fields.ts:52-57` `IP/联名`／`特殊功能/材质`／`版型`／`面料` 为商品表来源列；`index/build.ts` 无独立属性加载点（只有 `:275` 商品表正则）——README 理由属实。B4 反向：products 另存后 `index.products.length===1`、无「多张商品表中重复」issue；其余 16 张另存文件无一命中 `/商品.*信息表|商品宽表/`。

### S1–S5 回归 — PASS
- S1：DT3 比对全部 sheet 全部行（`:733-756`）。M-A 表头→DT1＋DT3 FAIL；M-A2 仅示例值→DT3 FAIL；M-C 改契约不重建→4 FAIL。第一轮 M3 缺口关闭。
- S2：`check-no-archive-content.mjs:159-181,213-220` 抽 tracked xlsx 全部单元格；基线输出「xlsx 单元格文本 1 个」；M-B 注入→FAIL exit 1（只报路径＋黑名单编号，不回显内容）。
- S3：`PRODUCT_MASTER_HEADER` 16 列全部出现在 `PRODUCT_FIELDS[*].sources`（测试 `:653-667`）；往返 `category.l3=演示品类`／`l2=演示中类`。
- S4：result.md §8 含 `c9db5fc`；§9.1 RED／GREEN 数字、§9.3 检查输出、§9.4 sha 前缀与 tip 实测一致。
- S5：B 组有真实解析器验证（DT7 products／channels＋B2 行为锁＋S3 目录锁）。

### 记录与范围 — PASS（§6 以 `dece365` 为准）
`git diff --name-only main...work/data-templates` 13 个文件。在复核 tip `2a86d49`，§6 允许路径 ⊇ 12 个文件，**`scripts/check-no-archive-content.mjs` 不在清单内**（result.md §9.6 第 1 条如实记「待主 agent 确认」）；复核期间主 agent 提交 `dece365` 在 §6 追认该路径（仅 1 行文档），13 个文件全部闭合。`.gitignore` 仅 `!templates/数据模板.xlsx` 一条例外；守卫 `ALLOWED_TRACKED_FILES` 仅该路径（`check-data-guard.py:26,50-52`）。`package.json` 仅 `templates:build`；lock 零差异；生成器 import 仅 node 内建＋exceljs（4.4.0，既有）。`data/` 仅 `README.md`。文档口径：`data/README.md:36,88,116-161`、`docs/data-request.md:7,11`、模板「使用说明」三处对「删第 2 行→按表目录另存／抖音仅 CSV／京东天猫仅 XLSX＋sheet 名／商品渠道仅 XLSX」口径一致。

### TDD 真实性（修单轮） — PASS
`.local/…/red-fixround.log`：21 项 15 FAIL／6 PASS，失败名为版式／表目录／列说明／使用说明／B2–B4／DT7 等现测试名（无导入错误）；`flip-a.log` 19/2（DT1＋DT3）与 §9.4 一致。状态词：§1／§9.2 用 PASS／NOT_RUN，未发现「未运行写成 PASS」；offline-check／test:golden 如实 NOT_RUN。

## 4. 变异表（备份 `/tmp/uom-r2-scratch/backups/`，手工还原）

| # | 变异 | 预期 | 实际 | 还原核对 |
| --- | --- | --- | --- | --- |
| M-A | 入库 xlsx `channels!r1c3` 渠道品牌→渠道品牌X | FAIL | **FAIL** 2/21：DT1「第 1 行必须是表头」＋DT3「全部行逐字一致」 | cp 备份→sha `03b21d5a…` 一致，`git status` 空 |
| M-A2 | 入库 xlsx `funnel!r2c2` 2026-10→2026-11（仅示例值） | FAIL | **FAIL** 1/21：DT3「[funnel] 第 2 行起不一致」（DT1 不报，符合分工） | 同上 |
| M-B | 入库 xlsx `funnel!r2c5` ← 归档黑名单同源片段（18 字，不打印） | `check:archive-content` FAIL | **FAIL exit 1**：`ERROR tracked 文件含归档真实内容片段: templates/数据模板.xlsx（黑名单 #0…）`；还原后 PASS exit 0 | cp 备份→sha 一致，`git diff` 空 |
| M-C | dist 契约 `吊牌价`→`吊牌价(元)`，不重建模板 | FAIL | **FAIL** 4/21：DT1／DT2（README 块）／DT3／列说明 | **注意**：`tsc -b` 增量不重 emit 未变 src 的产物，须以备份 cp 还原；`cmp` 与变异前 dist 逐字一致 |
| M-D | src `normalize/channel.ts` 删 `关店时间→closeDate`，`npm run build` | B2 行为锁 FAIL | **FAIL** 1/21：「渠道表头必须全部是解析器已登记列（不得落 attributes）：{"关店时间":"V13"}」 | cp 备份→`cmp` 一致；重建后 21/21、475/475，`git diff` 空 |

## 5. 发现清单

### 阻断
无。

### 应修（建议合并前处理；均为文案／示例层，改动在 §6 允许路径内，改后需 `npm run templates:build` 重建并复跑 21／475）
1. **抖音画像 sheet：使用说明要求「表头不要改」，但抖音实体与月份取自列名**。`scripts/build-data-templates.mjs:376`（「表头不要手改」）、`:378`（「第 1 行是表头（不要改）」）；`legacy-formats.ts:133`（demoHeader `2601-2612演示账号1-占比`）、`:139`（note 未写列名规则）、`:140`（fileNameRule 未写实体／月份）。探针 P8：把抖音 CSV 放进真实账号目录、列名保留示例 → 画像实体＝`演示账号1`、月份 `2026-01~2026-12`（`normalize/index.ts:90-92`，目录与文件名不参与）。影响：业务方照「使用说明」操作，抖音画像全部归到演示实体，无法关联真实渠道，**无任何报错**。修法：使用说明第 2 步改为「表头不要改，**抖音画像长表除外**：第 3／4 列列名须改为 `<起止年月><实体名>-占比／-tgi`（实体名与渠道宽表「店铺」一致）」；抖音 note／表目录同步。
2. **京东示例行维度名用「预测性别」，京东的真实源维度名是「性别」**。`legacy-formats.ts:153-154`（本变更新引入；main 的 README 无京东示例块）；`portrait/catalog/dimensions.ts:21,30,39,53,62`（京东：性别／年龄／十大靶群／购买力／城市线级）。对照实验：示例原样→`projections=[]`＋`unmapped-dimension` warning；改「性别」→`projections=["gender"]`。影响：照示例填写的京东画像性别不进统一维度，跨平台对比丢京东侧。修法：示例改「性别」，note 列出京东原生维度名。
3. **「XLSX 不被识别」与真实行为不符**。`legacy-formats.ts:141`（流入表目录与 `data/README.md:131`）；`data/README.md:116`「不按规则命名的文件会被静默跳过（不报错、不生效）」。探针 P1：`_抖音.xlsx` 被 `platform.ts:13` 识别为 douyin→`build.ts:303-305`→CSV 解析器→**THROW 中断整个索引**。影响：业务方存错格式时得到与原因无关的报错且全部工具不可用，文档却承诺「不报错」。修法：措辞改「仅 CSV；存成 XLSX 会解析报错并中断索引构建」。（解析器行为属既有代码，不在本变更范围。）
4. **京东／天猫 fileNameRule 未写「文件名须带月份与实体名」**。`legacy-formats.ts:158,176`；`docs/data-request.md:11` 有此要求但模板未引用。探针 P5／P6：`画像_京东.xlsx`（Sheet0 正确）→ 实体 `画像`、月份空（`identity.ts:22-40` 剥噪后残留），静默错挂。修法：fileNameRule 补「形如 `<起止年月><实体名>_京东.xlsx`，实体名与渠道宽表「店铺」一致」。
5. **spec §8「模板可用」行仍写「解析通过或按预期报「示例行」类错误」**（`spec.md:106`），与 §4 硬要求／DT7「任何照说明做却报错即 FAIL」（`:51,65`）矛盾。属已确认规格，按规范 §11 由主 agent／用户修订，复核者不改。

### 建议
- `funnel` 表目录「也认 `data/domains/08_指标体系/funnel.csv`」（`build-data-templates.mjs:186-190` 来自 `TABLE_SOURCES`）：实测可加载但同时产生「未识别的数据文件，已跳过」warning（`build.ts:325-329` 扫描 `domains/`）——可删掉该备选路径或注明。
- products sheet／列说明未列可选客观属性行（版型／面料／特殊功能/材质／IP/联名…，`fields.ts:52-57`）：照填的商品表不会给工具2 提供这些预测属性；README `:161` 只有散文＋`fields.ts` 指针。可在列说明加一句「客观属性作为商品表的可选列，列名见字段目录」。
- DT7 可补两条断言：`index.products.length === 1`＋无「多张商品表中重复」issue（锁 B4 反向）；`portrait.projections` 含 `gender`（锁应修 #2，防止示例维度名再漂移）。
- `data-templates.test.ts:617`「示例全部合成」仍只匹配单一真实品牌名正则；CI 无黑名单，实质防护依赖本地 `check:archive-content`，可在注释说明。
- `scripts/check-no-archive-content.mjs:215-219`：xlsx 读取失败 `continue` 静默跳过（fail-open），可改为记错退出。
- result.md：`:41,43,44` 仍为首轮数字（31,783 bytes／23 sheet／渠道对照＋客观属性表头／13 项）而未标「首轮」（§6 已标）；`:148`「（本文件所在提交）」在 tip 为 `2a86d49`／`dece365` 时已不指向该提交；`:206` §9.6 第 1 条仍写「待确认路径授权」而 spec §6 已在 `dece365` 追认；`:51` 复述旧示例占比数值（规范 §7.1 占比属业务数据，记录里不必复述）。
- 第一轮 S-4（守卫白名单 `continue` 在大小检查前）／S-6（`.gitignore` 追认需用户确认记录）仍未处理，作者已记 NOT_RUN；随 PR 说明处理。

## 6. 结论

**PASS — 建议进 PR**，前提是应修 #1–#4 在同一 PR 内修掉并重建模板（均为文案／示例改动＋`npm run templates:build`＋复跑 21／475；#1 关系到抖音画像能否关联真实渠道，优先级最高），#5 由主 agent／用户修订 spec §8。第一轮阻断 B1–B4 全部关闭且有测试与变异证据；应修 S1–S5 全部关闭。修 #1–#4 后建议由非作者做一次**轻量重验**（模板测试 21／全量 475＋按新说明重跑抖音往返），不必全量第三轮。

本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。未实测「关网仍能跑」（offline-check NOT_RUN）；§5.3 四点原则仅就本变更核对：零新增依赖／出网路径、未触及评分内核与背对背字段；新增人工动作仍是「删示例行＋按规则另存」，#1 说明当前会误导抖音列名。

### 未验证项
- `npm run offline-check`／`npm run test:golden`：**NOT_RUN**（需真实数据／参考资产授权；本变更未触及 `match/**`）。
- CI：未运行（本报告为本地隔离工作树结果）。
- 真实业务数据下的往返：**NOT_PROVED**（仅合成示例行；真实导出的维度名／列名变体不在本轮范围）。
- 小红书／D 组／E 组：说明型或解析器未实现，不参与往返，只核版式与措辞。

证据位置：harness 与日志 `/tmp/uom-r2-scratch/`（`inspect.mjs`、`roundtrip.mjs`、`jd-dimension.mjs`、`edge-probes.mjs`、`mA/A2/B/C/D-*.log`、`backups/`；临时、无业务数据）。工作树 `/tmp/uom-review-tpl-r2` 与临时数据根 `/tmp/uom-review-tpl-r2-data` 已清理。
