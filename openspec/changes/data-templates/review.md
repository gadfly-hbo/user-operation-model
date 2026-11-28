# Data-Templates · 独立复核报告（DT-5）

> 复核者：SDD·TDD 独立复核者（未参与候选任何部分，全程只读；唯一写入为本文件）
> 候选：`work/data-templates` @ **`6173a33`**（4 个提交：`4ce38e4` 规格／`be3fd41` 实现／`1b2750b` 结果回填／`6173a33` 主 agent 收尾）
> 基线：`main` @ `14bc15c`（merge-base；`origin/main` 为 `a506dc6`，二者仅差 `openspec/changes/p2-model-port/result.md` 1 行文档提交，不影响本复核）
> 日期：2026-11-28 · 结论：**FAIL（不建议以当前候选进 PR；阻断项均在模板／契约／文档层，修复范围不超出 spec §6 允许路径）**

### 结论速览

| 项 | 结论 | 一句话依据 |
| --- | --- | --- |
| DT1 覆盖与版式 | PASS | 23 sheet 齐全；E 组第 3 行空、小红书用法文案不适用为建议级 |
| DT2 单一来源 | PASS | A＝`TABLE_SPECS`、B/C＝`legacy-formats.ts`、README↔catalog 受锁（M1/M1b/M2a/M2b 均 FAIL） |
| DT3 防漂移 | PASS（有缺口） | 第 1–3 行受锁；示例行与标注不受锁（M3 13/13 仍 PASS） |
| DT4 零真实数据 | PASS | 独立比对 ~439 万 needle／token，可疑 0 |
| DT4 archive-content 覆盖 xlsx 内容 | NOT_PROVED | 脚本按设计跳过 `.xlsx`，由独立比对替代 |
| DT4 守卫白名单／.gitignore | PASS | 精确路径；例外只有一条 |
| DT5 零依赖／不读 data/ | PASS | lock 零差异；生成器 IO 仅 dist 与 templates/ |
| DT6 文档 | PASS | 指针、旧名、tables/ 说明均核对 |
| §6 允许路径 | PASS | `.gitignore` 追认为主 agent 决定，待用户确认记录 |
| B 业务侧可用性 | **FAIL** | 按说明另存 12/12 报错；channels／product-attributes 契约无消费代码；京东／天猫 sheet 名陷阱 |
| C TDD 真实性与记录 | PASS | RED 为交付物缺失＋README 真分叉，非环境失败；result.md 滞后于 6173a33 |
| offline-check／test:golden／npm audit | NOT_RUN | 需真实数据／参考资产授权；锁文件零差异 |

---

## 0. 复核范围与约束

- 先读规格与结果记录导出预期，再打开实现；源文件、测试、规格只读。
- 真实数据：主工作树 `data/` **只读**，仅在内存中提取标识做子串比对，未复制、未落盘；本报告不含任何真实名称／数值。
- 隔离根：`git worktree add --detach /tmp/uom-review-tpl 6173a33`（任务指定；这是唯一的 git 元数据写操作，不改任何分支／提交），临时数据根 `/tmp/uom-review-tpl-data/`（全合成）。变异用文件备份还原，**未使用** `git checkout`／`reset`／`stash`／`restore`。
- 未运行：`npm run offline-check`、`npm run test:golden`（需真实数据／参考资产授权，且本变更未触及评分内核）、`npm audit`（锁文件与 main 零差异，结果同基线）——均记 **NOT_RUN**。

## 1. 预期清单（打开实现前，从 spec §5／§8 与 AGENTS.md 导出）

| 标识 | 预期 |
| --- | --- |
| DT1 | 23 sheet＝说明 1＋A 12＋B 3＋C 4＋D 2＋E 1；数据 sheet：第 1 行 表名｜放到哪｜必需性｜解锁什么，第 2 行表头冻结，第 3 行 必需／可选＋口径，第 4 行合成示例带「填写时删除」，第 5 行起留空；顶部有「另存为单独 CSV／XLSX，CSV 与 XLSX 均可」说明 |
| DT2 | A 组表头／必需性逐列＝`TABLE_SPECS`（顺序＋required）；B／C＝`legacy-formats.ts`；README「格式模板」与 catalog 逐字一致且有测试锁定 |
| DT3 | 内存重建 vs 入库文件：sheet 名集合／表头／必需性任一不一致即 FAIL；纳入 `npm run check`；改契约不重建 → FAIL |
| DT4 | 示例全合成，xlsx 全单元格与真实数据的实体名／款号／店铺名比对 0 命中；`check:archive-content` 覆盖 `templates/`；守卫放行只针对该文件；`.gitignore` 例外只放行该文件 |
| DT5 | `package.json`／`package-lock.json` 零第三方变化；生成脚本不读 `data/`、不出网 |
| DT6 | 要数清单顶部指针；README 指针＋「另存为」；旧名 `product-metrics`／`channel-metrics`／`aggregation` 不再出现；README「不从 tables/ 读取」与代码一致 |
| §6 | 改动只在允许路径；`match/**`、`tool1/**`、`tool2/**`、`data-mcp/**`、`site/web/**`、`data/`（除 README.md）未触碰 |
| §4.3 | RED 为行为失败而非环境失败；结果记录状态词只用 PASS／FAIL／NOT_RUN／UNKNOWN／NOT_PROVED |
| 业务可用（spec §8「模板可用」） | 每 sheet 另存后被真实解析器识别；「放到哪」与代码扫描路径一致；「解锁什么」不夸大 |

## 2. 命令清单与结果

| # | 命令（均在 `/tmp/uom-review-tpl`） | 结果 |
| --- | --- | --- |
| 1 | `git worktree add --detach /tmp/uom-review-tpl 6173a33` | HEAD＝6173a33 |
| 2 | `npm ci --ignore-scripts` → `npm run build` | exit 0／exit 0 |
| 3 | `npm test` | **tests 467／pass 467／fail 0** |
| 4 | `npm run check`（变异全部还原后复跑） | **467／467，fail 0**；`git status`／`git diff` 为空，5 个被变异文件 sha256 与变异前一致 |
| 5 | `python3 .github/scripts/check-data-guard.py .` | 「数据守卫通过」exit 0 |
| 6 | `python3 .github/scripts/check-docs-links.py .` | 相对链接 139 条，错误 0，告警 0 |
| 7 | `git check-ignore` 探针 | `templates/数据模板.xlsx` 不被忽略；`templates/other.xlsx`、`templates/sub/数据模板.xlsx`、`data/x.csv` 仍被忽略 |
| 8 | openpyxl 独立打开 xlsx 全量导出（不用生成器） | 23 sheet；21 个带表头的 sheet `freeze_panes=A3`（使用说明、小红书两个说明型无表头不冻结）；版式见 §3.A |
| 9 | 复核 harness（exceljs 读入库 xlsx → 真实 `dist` 解析器／`buildIndex`） | 见 §3.B |
| 10 | 零真实数据比对（`data/` 只读、内存提取、输出仅计数／掩码） | 见 §3.A DT4 |
| 11 | `npm run templates:build` 后与入库文件比对 | 单元格逐字一致；字节差异仅 `docProps/core.xml` 的 created／modified 时间戳 |
| 12 | 变异 M1／M1b／M2a／M2b／M3／M4 | 见 §4 |

## 3. 逐项结论

### A. 规格符合性

**DT1 — PASS（附 3 条建议级偏差）**
- 覆盖：openpyxl 读出入库文件 sheet 顺序＝使用说明、A 12（funnel…portrait-conflicts）、B 3（products／channels／product-attributes）、C 4（抖音画像长表／京东画像表／天猫画像表／小红书画像）、D 2（monthly-mix／clearance-leap）、E 1（时间范围声明），共 23。
- 版式：21 个带表头 sheet 均为 r1「表名：…｜放到哪：…｜必需性：…｜解锁什么：…｜用法：…｜口径：…」、r2 表头、r3 必需／可选（逐列对齐，E 组除外）、r4 起示例行行尾「← 示例行（合成数据），填写时删除」（红字＋底色），`freeze_panes=A3`；C 组与 channels 为 2 行示例（符合 §3「2 行合成示例」）；其余留空。
- 偏差：① E 组第 3 行为空（蓝图有 `requirementRow` 但装配层未写，`scripts/build-data-templates.mjs:331-343`）；② 小红书 sheet 的 c5「用法」仍写「另存为 CSV 或 XLSX…第 4 行起为合成示例」，而该 sheet 无表示例、应为 Markdown 报告（`build-data-templates.mjs:304-310` 对说明型未分支）；③ D 组第 1 行已标注「解析器未做（P3 报表阶段）」✓。

**DT2 — PASS（但「固化」的 B 组契约与真实解析器不符，见 B）**
- A 组：入库 r2 逐列＝`TABLE_SPECS[*].columns[].name`（顺序一致），r3 的「必需」＝`required: true`，M1／M1b 变异证明逐列受锁。
- B／C：入库表头＝`legacy-formats.ts` 常量（`PRODUCT_MASTER_HEADER` 17 列、`CHANNEL_HIERARCHY_HEADER` 5 列、`PRODUCT_ATTRIBUTES_HEADER` 5 列、三平台 `demoHeader`）；README「格式模板」节 4 个 csv 块首行与 catalog 逐字一致，M2a／M2b 变异证明 README↔catalog 双向受锁。

**DT3 — PASS（覆盖范围有缺口，见 M3）**
- M1 改列名、M1b 改必需性、M2a 改 legacy 表头、M2b 改 README 块 → 均精确 FAIL 于「重建结果与入库文件…逐字一致」／「README 表头代码块…」；已纳入 `npm run check`（`npm test` 跑 `packages/*/dist/test/**`）。
- 缺口：比对只到第 1–3 行（`packages/core/test/data-templates.test.ts:164-181`）；M3 篡改入库文件第 4 行示例、追加第 6 行、删除「填写时删除」标注 → **13/13 仍 PASS**。

**DT4 — 零真实数据 PASS／守卫白名单 PASS／`check:archive-content` 覆盖 xlsx 内容 NOT_PROVED**
- 零真实数据（独立比对，非作者测试）：从主工作树 `data/` 提取 487,234 个 needle（文件名／目录名／CSV·XLSX 单元格／抖音列名实体／有辨识度数值／domains·reports 文本）＋archive 文本 3,875,303 个 token（223 文件）＋24,312 个未见于公共语料的 2 字中文 token；与入库 xlsx 579 个非空单元格比对：原始命中 532 → 去重 207 个 needle **全部**已存在于仓库 tracked 公共文本（通用词汇，如「数据时间范围声明」「不回退」）；**可疑 0**。旧 README「格式模板」节原有的真实占比／TGI 长小数样本（本变更已替换为合成值）在模板中 0 次。
- `check-data-guard.py`：`ALLOWED_TRACKED_FILES = {"templates/数据模板.xlsx"}` 精确路径，其余规则未动（`.github/scripts/check-data-guard.py:26,50-51`）；CI 调用该脚本（`.github/workflows/check.yml:22`）。
- `check:archive-content`：`scripts/check-no-archive-content.mjs:179` `if (!isTextFile(path)) continue;`，`.xlsx` 不在文本扩展名集合 → **模板内容不在该守卫扫描范围**（result.md §5 已自述）。DT4 该子项按字面「目录被遍历」成立、按实质「内容被扫描」不成立 → NOT_PROVED，由上一条独立比对替代。
- `.gitignore`：仅 `!templates/数据模板.xlsx` 一条例外，探针证明不放宽其它路径。

**DT5 — PASS**
- `git diff main...HEAD -- package.json` 仅 `+ "templates:build": "node scripts/build-data-templates.mjs"`；`package-lock.json` 零差异；exceljs 4.4.0 为 `@uom/core` 既有依赖。
- 生成器 IO：`existsSync`（dist 契约）、`mkdirSync(templates)`、`workbook.xlsx.writeFile(templates/数据模板.xlsx)`；无 `data/` 读取、无 http/https/net/fetch/child_process（`scripts/build-data-templates.mjs:25-49,430-438`）。

**DT6 — PASS（附 1 条应修）**
- `docs/data-request.md:7` 顶部指针 ✓；`data/README.md:36,118` 指针＋「另存为」✓；三个旧名在 README／data-request／normalize-rules 中 0 命中 ✓。
- README「商品主表、渠道主数据不从 `tables/` 读取」为真：`build.ts:207` 默认只扫 `domains`／`source`，商品表按 `/商品.*信息表|商品宽表/`（`build.ts:275`）、渠道表按 `/渠道.*宽表|店铺.*宽表/`（`build.ts:293`）识别；`tables/` 只出现在 `TABLE_SOURCES` 的散表路径。但「商品客观属性」一句失真：代码**没有任何**独立的客观属性加载点，属性只能作为商品表列经 `FieldCatalog` 映射进入（见 B-4）。
- 「解锁什么」与要数清单逐项一致，未夸大：product-channel 有意省略「渠道级错配排序」（要数清单第 73 行自述未接入）✓；无人写「到位即自动生成报表」。

**§6 路径 — PASS（附 1 条应修）**：11 个变更文件全部落在允许路径；未触碰禁止目录。`6173a33` 在已确认的 spec §6 追加 `.gitignore` 一行并注明「主 agent 追认」（见 R-6）。

### B. 业务侧视角可用性 — **FAIL**

harness 从**入库 xlsx** 取第 2 行表头＋第 4 行起示例，按三种「另存为」形态喂给 `packages/core/dist` 的真实解析器／`buildIndex`（临时数据根全合成）：

| 场景 | 结果 | 判定 |
| --- | --- | --- |
| A 组 12 张：干净 CSV／XLSX（表头在第 1 行＋示例行） | 12/12 解析成功（entries=1） | 入库示例行本身有效（独立于作者测试，作者测试取的是生成器蓝图而非入库文件） |
| A 组 12 张：**按模板说明操作**（删示例行，保留第 1–3 行，数据从第 4 行起） | **12/12 THROW `missing-field`**（如「生命周期漏斗表缺少必要列「款号」，实际表头：表名：生命周期漏斗表、放到哪：…」） | **阻断 B-1** |
| A 组 12 张：整 sheet 原样另存 | 12/12 THROW `missing-field` | 同上 |
| S1 products 干净 XLSX→`domains/04_商品信息/商品宽表.xlsx` | 识别；但 `商品品类`／`二级品类`／`企划件单价` 落入 `extra`，`category=null`（字段目录来源列是 中类／小类／品类，`product/catalog/fields.ts:43-46`） | 应修 R-3 |
| S2 products 整 sheet 原样另存 | THROW `商品表缺少款号列` | B-1 |
| S3 products 另存为 **CSV** 放模板所写目录 | 「未识别的数据文件，已跳过」 | 应修 R-1 |
| S4 channels 按模板表头（渠道标识…）干净 XLSX→`02_渠道信息/渠道店铺宽表.xlsx` | **buildIndex THROW `渠道表缺少店铺编码列，无法确定主键`**（`normalize/channel.ts:38-42`） | **阻断 B-2** |
| S5 channels 存为 `channels.xlsx` | 未识别、跳过 | R-1 |
| S6／S6b／S6c product-attributes 按模板放到 `04_商品信息/建模商品信息表.xlsx` | 被当作**第二张商品主表**（文件名命中 `build.ts:275`）：同款号记「重复，保留先到的一条」；属性表排序在前时**抢占**商品档案（name／category／price 全空，真实宽表行被丢弃）；`工艺`／`IP` 落 `extra`（目录来源列是 `特殊功能/材质`、`IP/联名`，`fields.ts:52-53`） | **阻断 B-4** |
| S7 抖音 `…_抖音.csv`→`source/live/…/2026-10/` | 识别（entity 演示账号1，month 2026-01~2026-12） | — |
| S8／S9 抖音 文件名不含 `_抖音`（放模板所写两个目录） | 「未识别的数据文件，已跳过」（`platform.ts:13-18`：中文目录不匹配 `/douyin/`，须以 `_抖音.csv` 结尾） | 应修 R-1 |
| S10 抖音 整 sheet 原样另存 | THROW `抖音画像缺少「…-占比」列` | B-1 |
| S11 京东 sheet 名＝`Sheet0`、文件名以 `_京东.xlsx` 结尾 | 识别 | — |
| S12 京东 **sheet 名保持模板名「京东画像表」**另存 | **THROW `京东画像文件为空、sheet「Sheet0」不存在`**（`normalize/index.ts:224`） | **阻断 B-3** |
| S13 京东 文件名仅「含」京东（模板原文「文件名含「京东」」）放 `source/tmall/` | 被识别为**天猫**，THROW `天猫画像文件为空、sheet「明细」不存在` | B-3 |
| S14 京东 放 `domains/07_人群画像/京东/` 不带 `_京东` 后缀 | 未识别、跳过 | R-1 |
| S15 天猫 sheet 名＝`明细` | 识别 | — |
| S16 天猫 sheet 名保持「天猫画像表」 | **THROW `天猫画像文件为空、sheet「明细」不存在`**（`index.ts:146`） | B-3 |
| S17／S18 天猫／京东 另存为 CSV | 未识别、跳过（`build.ts:315-323` CSV 分支只处理抖音） | R-1 |

根因：spec §4「顶部说明：每个 sheet 另存为单独的 CSV 或 XLSX…CSV 与 XLSX 均可」被原样写进每个 sheet 的 c5 与「使用说明」第 2–3 条，但 ① 解析器把文件第 0 行当表头（`table.ts:38`、`index.ts:83`、`product.ts:30`），说明里从未写「另存前删除第 1、3 行，让表头成为第 1 行」；② B／C 组只接受 XLSX＋特定文件名／sheet 名，说明却写「CSV 与 XLSX 均可」。作者测试用蓝图拼出「表头＋示例」再喂解析器（`data-templates.test.ts:252-278,280-327`），且京东／天猫显式用 `Sheet0`／`明细` 写 xlsx——绕开了真实「另存为」流程；B 组三张表没有任何解析器验证（result.md §4「模板可用」只列 A 组与 C 组）。

### C. TDD 真实性与记录 — PASS（附 2 条应修）

- RED 证据 `.local/data-templates/red-round1.log`：13 项 11 FAIL／2 PASS；`test at …:86/89/94/115/128/155/179/194/207/218` 与编译产物 `test(` 行号逐一对上。失败原因：交付物缺失（模板文件、生成器模块）×9、README↔catalog 真分叉（缺商品客观属性块、抖音块仍是旧样本）×2——均非环境／依赖失败；2 个 PASS 是已成立的回归锁。注意：「模板可用」类测试的 RED 只是「生成器模块不存在」，示例行解析失败从未被作者观察到 RED（复核者用 M4 补证该测试有牙）。
- 防漂移反向证据 `anti-drift-flip.log`：`[products] 第 1 行…不一致` 12/13，与 M2a 一致；`check.log` 467/467 来自干净树（无「漂移演示改动」字样）。
- 测试源在 RED 后有增补：「示例行全部合成」从 L236 移到 L243（DT1 测试追加了对装配层「填写时删除」标注的断言），该断言无独立 RED。
- 状态词：§5 检查表用 PASS／NOT_RUN，offline-check／golden／audit 如实 NOT_RUN／PASS 分列；§1 任务清单用「完成／未做」而非标准词（语义无歧义，建议统一为 PASS／NOT_RUN）。未发现「未运行写成 PASS」。
- 记录滞后：result.md 末次更新在 `1b2750b`，未反映 `6173a33`——仍写「`.gitignore` 不在允许修改路径内…以 `git add -f` 加入」（第 57 行）与「README 仍把三张表列在 `tables/` 下…留主 agent 决定」（第 131 行），两者已在 `6173a33` 改掉。

## 4. 变异表（均在 `/tmp/uom-review-tpl`，备份于 `/tmp/uom-review-scratch/backups/`，手工还原）

| # | 变异 | 重建 | 预期 | 实际 | 还原核对 |
| --- | --- | --- | --- | --- | --- |
| M1 | `tables.ts` FUNNEL `浏览`→`浏览量`，不重建模板 | `npm run build` | FAIL | **FAIL** `[funnel] 第 2 行表头不一致`（12/13） | sha 复原，status 空，13/13 |
| M1b | `tables.ts` MEMBER_FEATURES `特征层级` 加 `required: true` | 同上 | FAIL | **FAIL** `[member-features] 第 3 行必需性／口径不一致` | 同上 |
| M2a | `legacy-formats.ts` `吊牌价`→`吊牌价(元)` | 同上 | FAIL | **FAIL ×2** `[products] 第 2 行表头不一致`＋`README…缺少商品主表表头` | sha 复原、重建后 13/13 |
| M2b | README「渠道层级对照表」块首行加 `,备注` | 无需 | FAIL | **FAIL** `README…缺少渠道层级对照表头`（首次运行因 M2a 的 dist 残留多报一条 DT3，重建后复跑归因干净） | sha 复原 |
| M3 | 入库 xlsx：funnel r4c1 改值、r6 塞行、删 r4 行尾「填写时删除」标注 | 无需 | 期望 FAIL | **13/13 PASS（缺口）** | sha 复原（43e9ea5f…） |
| M4 | 生成器 funnel 示例 `浏览`→`abc` | 无需 | FAIL | **FAIL** `生命周期漏斗表的「浏览」 的数值不可解析：abc` | sha 复原 |

## 5. 发现清单

### 阻断
- **B-1 另存流程必然报错（A 组 12 张＋抖音＋products）**：`scripts/build-data-templates.mjs:302-303,415-416`（用法文案）与 `data/README.md:36,118`、`docs/data-request.md:7`、`spec.md:52`；解析器 `table.ts:38`、`normalize/index.ts:83`、`product.ts:30` 以第 0 行为表头。影响：业务方按说明「删示例行→另存 CSV／XLSX」后，每张 A 表 `missing-field`，`buildIndex` 整体抛错，MCP 全部不可用。修法：文案改为「另存前删除第 1、3 行与示例行，使表头成为文件第 1 行」并加一条按说明流程导出的测试；spec §4 同步。
- **B-2 `channels` sheet 表头与唯一渠道解析器不兼容**：`legacy-formats.ts:43-49`（`渠道标识…层级`）vs `channel.ts:38-42`（必需 `店铺编码`）；README `:152-158`。影响：照填→放到模板所写路径→`buildIndex` 抛 `渠道表缺少店铺编码列`。修法：表头改为渠道店铺宽表实际列（店铺编码／店铺／平台／渠道类型／渠道等级…，`channel.ts:6-21`），或把 sheet 改为说明型「请直接提供渠道店铺宽表」；B 组补真实解析器测试。
- **B-3 京东／天猫另存为 XLSX 必报错＋京东命名提示错误**：`build-data-templates.mjs:205`（「文件名含「京东」」）vs `platform.ts:15`（须以 `_京东.xlsx` 结尾）、`index.ts:146,224`（sheet 须为 `明细`／`Sheet0`）。影响：S12／S16 直接抛错；S13 被当天猫解析、抛出误导性错误。修法：三平台 sheet 写明「仅 XLSX／CSV、sheet 名、文件名后缀」。
- **B-4 `product-attributes` sheet 无加载点且会伪装成商品主表**：`build-data-templates.mjs:192`（放到哪）＋`build.ts:275`＋`fields.ts:52-53`。影响：按说明另存→同款号时可能抢占商品档案（S6b），`工艺`／`IP` 永不进预测属性。修法：删 sheet 或改为「这些是商品信息表的列（版型／面料／特殊功能/材质／IP/联名），不单独成文件」。

### 应修
- **R-1 「放到哪」缺少硬性命名规则且「CSV 与 XLSX 均可」对 B／C 组不成立**：`build-data-templates.mjs:168,180,204-206`、`platform.ts:13-18`、`build.ts:274-323`。影响：S3／S5／S8／S9／S14／S17／S18 均为**静默跳过**（仅 issue 警告），业务方以为给了数据却无效果。同类问题在 `data/README.md`「source/」节与要数清单第 1 项已存在，模板是新的单一入口，应一并写清。
- **R-2 防漂移与「零真实数据」不覆盖入库文件的示例行**：`data-templates.test.ts:164-181`（只比 1–3 行）、`:381-394`（只查蓝图、仅匹配单一品牌名正则）；`check-no-archive-content.mjs:179` 跳过 xlsx。影响：M3 证明手改入库文件加任意行不会被任何检查发现，DT4「示例行合成词表经测试断言」只对生成器成立。修法：比对全部行（或固定 `created/modified` 后比字节），合成词表断言改为读入库文件。
- **R-3 `products` 表头 3 列不在字段目录**：`legacy-formats.ts:18-36`（商品品类／二级品类／企划件单价）vs `fields.ts:43-46`。影响：照模板建的商品表无品类，工具2 预测输入缺「品类」（§9.2 列明的客观属性）。属 README 既有表头被「固化」，固化时应校正。
- **R-4 result.md 滞后于 `6173a33`**：`result.md:57,131`。影响：记录与候选不一致（§5.2 第 4 条）。修法：回填 .gitignore 例外与 README tables/ 修正。
- **R-5 B 组与「按说明另存」流程无解析器测试**：`data-templates.test.ts:235-342`。spec §8「模板可用：每 sheet 另存 CSV 后被解析器识别」对 B 组 NOT_PROVED。

### 建议
- S-1 E 组 sheet 第 3 行空（`build-data-templates.mjs:331-343`）。
- S-2 小红书 sheet c5「用法」文案不适用（`build-data-templates.mjs:304-310`）。
- S-3 cohort／recency／channel-flow／diagnosis「解锁什么：报表 R2／R3／R4／R6」可加「（报表阶段未做）」避免误读，与 D 组口径一致。
- S-4 守卫白名单 `continue` 在大小检查之前（`check-data-guard.py:50-51` vs `:61-65`），模板文件同时绕过 5 MiB 上限；移到大小检查之后。
- S-5 README 声明表示例用 `SPU-001 SPU-002`，模板 E 组用 `SYN-0001 SYN-0002`（`legacy-formats.ts:150` vs `README.md:20`）；DT2 structureText 测试用 `readme.includes` 全文匹配（`data-templates.test.ts:188-195`），可限定在「格式模板」节。
- S-6 `spec.md:78` 由主 agent 在已确认规格上追加 `.gitignore` 路径（「主 agent 追认」）；按规范 §11 范围变更需用户确认——请在 result.md／PR 说明中记录用户确认。
- S-7 生成器每次重跑字节不同（仅 `docProps/core.xml` 时间戳），可固定 `workbook.created/modified` 以获得可复现产物。
- S-8 抖音 sheet「放到哪」未列 `source/short-video/`、`source/offline/`（README 列出）；线下画像也须 `_抖音.csv` 后缀才被识别——范围外，记入后续。
- S-9 `.local/data-templates/red-round1.log` 含旧 README 的半真实示例片段（忽略目录，未入库），提醒 .local 不放业务片段。

## 6. 结论

**FAIL — 不建议以 `6173a33` 进 PR。** 阻断项 4 条（B-1～B-4）全部属于「业务方照填也会报错／静默无效／伪装成主表」：模板的「另存为」说明与解析器表头约定冲突、`channels` 与 `product-attributes` 两张 sheet 的契约没有对应消费代码、京东／天猫 sheet 名与文件名规则缺失。修复只需改 `scripts/build-data-templates.mjs`、`catalog/legacy-formats.ts`、`data/README.md`、`docs/data-request.md`、`spec.md §4` 与测试（均在 §6 允许路径内），改后需重建模板并补「按说明流程另存→解析」的测试，再交非作者重验受影响范围。DT2／DT3／DT5、零真实数据、守卫白名单、TDD 真实性本身均 PASS。

本复核不代替阶段门禁、§5.3 专项检查、CI 与产品验收。离线「关网仍能跑」未实测（offline-check NOT_RUN）；§5.3 四点原则仅就本变更核对：无新增依赖／出网路径（DT5）、未触及评分内核与背对背字段、新增人工动作为「另存＋删行」且有目的——但其说明目前不足以让业务方一次做对。

证据位置：命令输出与 harness 日志在 `/tmp/uom-review-scratch/`（临时，无业务数据；含 `partA.log`、`partBC.log`、`s6-variants.log`、`dt4-compare2.log`、`m1..m4-test.log`、`final-check.log`）；工作树与临时数据根已按任务清理。
