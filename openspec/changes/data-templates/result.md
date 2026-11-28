# Data-Templates · 实施结果（DT-2／DT-3／DT-4＋复核修单）

> 变更：[spec.md](spec.md)（首轮范围 DT-2／DT-3／DT-4；DT-5 复核已完成；DT-6 PR 由主 agent 另行安排）
> 执行：SDD·TDD 实现者 · 分支 `work/data-templates`（基线 `4ce38e4`，未 push）
> 独立复核：**已完成，结论 FAIL**（`review.md` @ `6173a33`：阻断 B1–B4／应修 R-1～R-5／建议 9 条）；复核修单见 **§9**（2026-11-28 本轮）

---

## 1. 任务清单状态（对应 spec §7）

| # | 任务 | 状态 | 证据 |
| --- | --- | --- | --- |
| DT-1 | 规格与任务清单 | **完成（前置）** | spec.md（用户 2026-11-28 确认；§4 版式与 DT7 已按复核修订） |
| DT-2 | 契约固化 + 生成脚本 + 防漂移测试（TDD 先 RED） | **完成** | §2、§3；首轮 RED→GREEN 见 §4 |
| DT-3 | 生成模板 + 文档指针 + README 旧名修正 | **完成** | §2；`templates/数据模板.xlsx` 已生成并入库 |
| DT-4 | 全量检查 | **完成**（两项 NOT_RUN，见 §5） | §5 |
| DT-5 | 独立复核 | **完成：FAIL** | `review.md`（阻断 4 条全在业务侧可用性）；修单见 §9 |
| DT-6 | PR／CI／授权 squash 合并 | **未做** | 主 agent 安排；本单未 push |

---

## 2. 交付了什么

| 验收 | 交付 | 状态 |
| --- | --- | --- |
| DT1 | 模板覆盖 §3 全部表：23 个 sheet = A 组 12 + B 组 3 + C 组 4 + D 组 2 + E 组 1 + 「使用说明」；数据 sheet 版式符合 §4（第 1 行表名｜放到哪｜必需性｜解锁什么｜用法｜口径；第 2 行表头冻结；第 3 行必需／可选＋口径；第 4 行起合成示例行，行尾「← 示例行（合成数据），填写时删除」红字标注） | **PASS**（清单见 §6） |
| DT2 | 单一来源：A 组表头／必需性直接读 `TABLE_SPECS`（`packages/core/src/normalize/catalog/tables.ts`）；B／C 组固化进 `catalog/legacy-formats.ts`；`data/README.md`「格式模板」节改为与之一致，13 项测试锁定「README 模板块 ↔ catalog」不再分叉 | **PASS** |
| DT3 | 防漂移：`packages/core/test/data-templates.test.ts` 调用生成器内存重建，与入库文件逐字比对 sheet 名集合＋每表第 1–3 行；任一不一致即 FAIL，已纳入 `npm run check`。**两个方向都实测过**：入库文件缺失 → FAIL；改契约不重建 → FAIL（`[products] 第 1 行…不一致`，见 §4） | **PASS** |
| DT4 | 零真实业务数据：示例行全合成（款号 `SYN-…`、店铺 `D00001/D00002 演示账号`、品牌「演示品牌」、通用枚举值）；`check:archive-content` 扫描遍历全部 tracked 文件（含 `templates/`，说明见 §5）；`check-data-guard.py` 以**显式白名单** `ALLOWED_TRACKED_FILES = {"templates/数据模板.xlsx"}` 只放行该路径，其余规则未放宽 | **PASS** |
| DT5 | 零新增第三方依赖（exceljs 为 `@uom/core` 既有依赖）；生成器文件 IO 只有 core dist 契约的 `existsSync`（grep 证实），不读 `data/`、不出网 | **PASS** |
| DT6 | 文档：`docs/data-request.md` 顶部加模板包指针（1 行）；`data/README.md` 目录说明加模板指针与「另存为」说明，旧名 `product-metrics`／`channel-metrics`／`aggregation` 三行删除（同名正确条目在「P0 数据收尾新增表」清单中，不留两套叫法）；`docs/normalize-rules.md` §12 经 grep 核对无旧名、列名无变化，**无需同步** | **PASS** |

---

## 3. 新增／修改文件清单

### 新增

| 文件 | 作用 |
| --- | --- |
| `templates/数据模板.xlsx` | 模板包（tracked；31,783 bytes；23 sheet；示例行全合成） |
| `scripts/build-data-templates.mjs` | 生成器：`npm run templates:build`；从 `TABLE_SPECS`×`TABLE_SOURCES`＋`legacy-formats` 装配；导出 `templateBlueprint()`／`buildTemplateWorkbook()` 供测试内存重建 |
| `packages/core/src/normalize/catalog/legacy-formats.ts` | B／C 组契约唯一来源：商品主表／渠道对照／商品客观属性表头、抖音／京东／天猫画像结构与合成示例、小红书说明、README 时间范围声明结构 |
| `packages/core/test/data-templates.test.ts` | 防漂移＋单一来源＋模板可用（真实解析器跑示例行）＋版式断言，13 项 |

### 修改

| 文件 | 改动 |
| --- | --- |
| `package.json` | 仅新增 `templates:build` 脚本 |
| `data/README.md` | 「格式模板」节改为与 catalog 一致（附锁定说明与模板包用法）；抖音示例块真实数值样本（39.26%／90.62… 等）替换为合成示例；目录说明加模板指针；删除三个旧名行 |
| `docs/data-request.md` | 顶部加 1 行模板包指针 |
| `.github/scripts/check-data-guard.py` | 新增显式白名单 `ALLOWED_TRACKED_FILES`（只放行 `templates/数据模板.xlsx`），其余规则未动 |

未触碰：`packages/core/src/match/**`、`packages/tool1-channel-match/**`、`packages/tool2-portrait-predict/**`、`packages/data-mcp/**`、`site/web/**`、`data/` 下除 `README.md` 外任何文件（未读取、未复制、未修改）。

> **入库方式说明**：模板文件经 `.gitignore` 例外 `!templates/数据模板.xlsx` 正常入库（例外由主 agent 在 spec §6 追认，见 `6173a33`）；数据守卫侧由 DT4 显式白名单对应放行。
>
> **首轮遗留两项已在 `6173a33` 处理**（首轮记录滞后，已回填）：① `.gitignore` 追加例外；② `data/README.md` 目录说明不再把三张 B 组表列在 `tables/` 下（改为按代码实际加载路径说明）。

---

## 4. RED → GREEN

### 真 RED（实现前，留档 `.local/data-templates/red-round1.log`）

13 项测试 11 FAIL / 2 PASS（PASS 的两项是已成立即被锁定的回归锁：平台列结构、声明表镜像）：

```text
✖ 入库模板存在（templates/数据模板.xlsx）
  AssertionError: templates/数据模板.xlsx 不存在：运行 npm run templates:build 生成并提交
✖ 生成器可在内存重建模板（npm run templates:build 的实现）
  AssertionError: 生成器 scripts/build-data-templates.mjs 无法加载…: Cannot find module '…/scripts/build-data-templates.mjs'
✖ README 表头代码块与 catalog 表头常量逐字一致
  AssertionError: README「格式模板」缺少与 catalog 一致的商品客观属性表头（期望逐字：款号,版型,面料,工艺,IP）
✖ README 抖音示例块行与 catalog 合成示例行逐字一致
ℹ pass 2
ℹ fail 11
```

失败原因均为产品级（交付物缺失、README↔catalog 分叉），非环境／导入故障。

### GREEN

- `npm run check`：**467／467 PASS**（含新增 13 项；`0 fail`；日志 `.local/data-templates/check.log`）
- 单文件重跑：`node --test packages/core/dist/test/data-templates.test.js` → 13 pass / 0 fail

### 防漂移反向验证（改契约不重建）

临时把 `legacy-formats.ts` 的商品主表 note 加「（漂移演示改动）」并重建 core 后不改模板：防漂移测试 **FAIL**（`[products] 第 1 行（表名／放到哪／必需性／解锁什么）不一致`，留档 `anti-drift-flip.log`）；还原后 13/13 PASS。契约改动的两个方向（漏重建、文件缺失）都被测试拦截。

### 模板可用（真实解析器跑示例行）

- A 组 12 张：示例行按表头导出内存 CSV → 对应真实解析器全部解析成功（≥1 条）
- C 组：抖音 CSV → `normalizeDouyinPortrait` 解析出「预测性别」两枚标签；京东／天猫 XLSX → 各自解析器解析出「预测性别」维度（示例行为合成数据，未改任何解析器）
- D 组：断言标注「解析器未做」，不冒充可用

---

## 5. 检查结果（DT-4）

| 检查 | 命令 | 结果 | 关键输出 |
| --- | --- | --- | --- |
| 构建＋全量测试 | `npm run check` | **PASS** | `tests 467 / pass 467 / fail 0` |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS** | 相对链接 138 条，错误 0，告警 0 |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS** | 白名单只放行模板文件；索引中无业务数据目录／数据文件／超大文件 |
| 归档内容 | `npm run check:archive-content` | **PASS** | 黑名单 85 条，扫描 tracked 文本文件 186 个，0 命中 |
| 依赖审计 | `npm audit --audit-level=high` | **PASS** | `found 0 vulnerabilities` |
| 断网 e2e | `npm run offline-check` | **NOT_RUN** | `offline-e2e.mjs` 以真实 `data/` 为数据根启动 MCP 并断言 9 个工具返回真实数据（`dataRoot = repo/data`）；本单无读取 `data/` 授权，按交接指示记 NOT_RUN |
| 黄金脚本 | `npm run test:golden` | **NOT_RUN** | `scripts/golden-tool1.mjs` 需读取 `~/工作/抖音货渠匹配` 真实参考资产，本单无授权。缓解：本轮未改评分内核任何文件（只新增 catalog 常量与测试）；两条黄金价格锚点（¥318.69／¥626.83）的价格带用例在单测 `match.test.ts` 内持续回归，467 项全绿 |

**归档内容守卫对 `templates/` 的覆盖口径（DT4 说明）**：`scripts/check-no-archive-content.mjs` 遍历 `git ls-files` 全部 tracked 文件，`templates/` 下的 tracked 文件都进入扫描循环；文本文件按黑名单逐字比对，`.xlsx`（二进制 zip）不在文本逐字扫描范围——该脚本不在本变更允许修改路径内，未改动。模板内容边界由三层保障：生成器只从 catalog 契约合成（不读 `data/`）、防漂移测试锁定入库文件与契约逐字一致、示例行合成词表经测试断言（不得含真实品牌／店铺名）。

**暂存清单核对**：提交前逐项核对，`data/` 下仅 `data/README.md`（DT6 明确允许），无任何业务数据文件。

---

## 6. 模板 sheet 清单（首轮 23 个——已被 §9 修单按 spec §4 重做为 24 个，此处保留首轮事实）

| 组 | sheet |
| --- | --- |
| 说明 | 使用说明（工作簿级：另存为用法、合成声明、声明表入口、缺失冲突原则、再生成命令） |
| A（12） | `funnel`、`member-features`、`cohort`、`recency`、`channel-flow`、`diagnosis`、`product-channel`、`aggregate-groups`、`product-performance`、`channel-performance`、`entity-alias`、`portrait-conflicts` |
| B（3） | `products`（商品主表）、`channels`（渠道层级对照）、`product-attributes`（商品客观属性） |
| C（4） | `抖音画像长表`、`京东画像表`、`天猫画像表`、`小红书画像`（说明型：报告原文放 `data/domains/07_人群画像/小红书/`） |
| D（2） | `monthly-mix`、`clearance-leap`（第 1 行标注「解析器未做（P3 报表阶段）」，表头按要数清单第 9、10 项） |
| E（1) | `时间范围声明`（镜像 README 声明表；第 1 行注明「不落盘，填在 data/README.md」） |

---

## 7. 范围外发现／未做项／待主 agent 决定

1. **`tables/products.csv`／`channels.csv`／`product-attributes.csv` 的加载断链（范围外，未改）**：首轮时 `data/README.md` 目录说明曾把这三张表列在 `tables/` 下——**该 README 失真已在 `6173a33` 修正**（§7 原记录滞后，此处回填）；「商品客观属性无加载点、从模板移除」由复核修单 B4 完成（§9）。代码实际只从 `data/domains/04_商品信息/`、`data/domains/02_渠道信息/` 的 XLSX 加载商品与渠道主数据（`packages/core/src/index/build.ts` 只扫 `domains/`、`source/`）。是否让 `tables/` 下的 CSV 也被加载超出本轮授权，**留主 agent／用户决定**。
2. **DT-5 独立复核未做**：须由非作者复核者在断网环境复核（含「关网仍能跑」实测）；本 result.md 不构成复核结论。
3. **DT-6 未做**：未 push、未建 PR；提交在 `work/data-templates` 本地分支。
4. **`npm run offline-check`／`test:golden` NOT_RUN**：均需真实数据或真实参考资产，本单无读取授权；复核时若授权读 `data/` 可补跑。
5. `.local/data-templates/` 内为 RED／防漂移日志与 check 日志（无业务数据），按规范保留供复核者访问。

---

## 8. 提交

| 提交 | 内容 |
| --- | --- |
| `be3fd41` | `feat: 数据模板包——B/C 组契约固化+生成器+防漂移测试+模板入库+文档指针与守卫白名单`（本单全部交付物，8 文件 +1029/−11） |
| （本文件所在提交） | `docs: 回填 data-templates 结果记录（DT-2～DT-4）` |

---

## 9. 复核修单（2026-11-28，依据 `review.md` FAIL：阻断 B1–B4／应修 R-1～R-5／建议 9 条）

### 9.1 TDD

先按修订后的 spec §4／DT7 重写 `packages/core/test/data-templates.test.ts`（21 项）取**真 RED**，再最小实现转 GREEN：

- **RED**（`.local/data-templates/fix-review/red-fixround.log`）：21 项 **15 FAIL／6 PASS**。失败全部为产品级（无导入／环境错误）：旧版式说明行占用数据 sheet 第 1 行×多表、「表目录／列说明」缺失、channels 契约常量缺失、README 平台硬规则／新表头分叉、商品客观属性块仍在、DT7 按说明另存必报错（`第 2 行示例首列应有「示例-」前缀`）、product-attributes sheet 仍在。PASS 的 6 项是已成立的回归锁（全量防漂移、合成词表、结构镜像等）。
- **GREEN**：`node --test packages/core/dist/test/data-templates.test.js` → **21/21**；全量 `npm run check` → **475/475**（修单前 467）。

### 9.2 逐条状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| **B1** 说明行占用数据 sheet 第 1 行 | **PASS** | 版式重做：说明全部移入「使用说明／表目录／列说明」；数据 sheet 第 1 行＝表头（冻结 ySplit 1）、第 2 行＝示例（首列「示例-」＋行尾红字「填写前删除本行」＋底色高亮）、第 3 行起留空（`scripts/build-data-templates.mjs` `writeDataSheet`；DT1 版式测试）。**DT7 往返**：读入库 xlsx 每个数据 sheet → 删第 2 行示例 → 按「表目录」规则实际写 CSV 与 XLSX 文件到两个临时数据根 → 真实 `buildIndex`：A 组 12 索引字段非空、商品／渠道被扫描、三平台画像识别（2 个 DT7 测试 GREEN，未用蓝图拼文件） |
| **B2** `channels` 表头无代码消费 | **PASS** | sheet 改为「渠道店铺宽表」：表头＝`CHANNEL_STORE_WIDE_HEADER`（14 列，`legacy-formats.ts` 固化，与 `normalize/channel.ts` 列映射同源）；行为锁测试：用该表头构造渠道表，真实 `normalizeChannelTable` 每列都收进字段、不留 `attributes`，「店铺编码」落 `channelId`；DT7 往返 `channels→buildIndex` 识别 `D00001`。「渠道层级对照」简化表从模板与 README 删除 |
| **B3** 京东／天猫 sheet 名与文件名规则未写 | **PASS** | `PortraitFormatSpec` 增加 `fileNameRule／saveFormat／sheetName／targetDirs`（抖音：须 `_抖音.csv` 结尾、仅 CSV；京东：须 `_京东.xlsx` 结尾、sheet `Sheet0`、仅 XLSX；天猫：须 `_天猫.xlsx` 结尾、sheet `明细`、仅 XLSX）。「表目录」逐表写明；README「平台硬规则」逐字锁定（DT2 测试）。DT7：京东文件放 `source/tmall/` 且以 `_京东.xlsx`+`Sheet0` 保存 → `platformLabels['jd']`（**不被当天猫解析**，后缀优先于目录）；天猫 `_天猫.xlsx`+`明细` → `tmall` |
| **B4** `product-attributes` 无加载点 | **PASS** | sheet 从模板删除（DT0 断言 sheet 集合无 `product-attributes`）；`data/README.md` 标明「**当前无独立加载点，暂不需要单独提供**」并写真实来源。来源已核实（读代码非猜）：P2 预测属性不是独立文件，而是商品信息表（`domains/04_商品信息/` XLSX）中列名命中的列，经字段目录 `packages/core/src/product/catalog/fields.ts` 的 `sources`（版型／面料／特殊功能/材质／IP/联名等）映射进 `predictionAttributes`（`normalize/product.ts:30-36`；`build.ts` 无任何独立属性加载点）。README 同时警示：单独属性表会被当第二张商品表抢占档案（复核 S6b 场景） |
| **S1** 「放到哪」缺文件名规则、「CSV 与 XLSX 均可」对 B/C 不成立 | **PASS** | 由 B3 一并解决：表目录逐表含精确文件名规则与允许格式；DT7 的路径／格式夹具与表目录关键词互锁（`Sheet0／明细／_京东.xlsx／_抖音.csv／店铺编码…` 缺一即 FAIL） |
| **S2** 防漂移不覆盖示例行 | **PASS** | DT3 改为**整 sheet 全行比对**（重建 vs 入库，全部 sheet 全部行）；「示例全部合成」断言改为读入库文件全文。反证 **Flip A**：手改入库 xlsx 第 2 行值＋第 6 行塞行 → 版式测试与全量比对**双 FAIL**（`.local/data-templates/fix-review/flip-a.log`）；还原后 sha256 与改前一致、21/21 GREEN。首轮 M3 缺口关闭 |
| **S3** `check:archive-content` 跳过 xlsx | **PASS** | `scripts/check-no-archive-content.mjs`：tracked `.xlsx` 用 exceljs 抽**全部单元格文本**进同一黑名单扫描（运行输出「xlsx 单元格文本 1 个」）；实跑 PASS 0 命中。注意：该文件不在 spec §6 路径清单，按修单 S3 指令修改——**待主 agent 在 PR 说明确认此路径授权** |
| **S4** products 表头 3 列不在字段目录 | **PASS** | `PRODUCT_MASTER_HEADER` 修正为 16 列：`商品品类→品类`（`category_l3` 的 sources）、`二级品类→中类`（`category_l2`）、移除 `企划件单价`（目录无映射；件单价已有）。测试锁「表头每列都在字段目录 sources 内」＋DT7 断言 `category.l3/l2` 真实落位。生成器逐列口径从字段目录反查，不手写 |
| **S5** result.md 滞后、B 组无解析器测试 | **PASS** | 本章节即逐条记录；首轮滞后项（`.gitignore`／README tables/）已在 §3／§7 回填；B 组解析器验证含在 DT7（products／channels 往返）＋B2 行为锁 |
| 建议 S-1 E 组第 3 行空 | **PASS** | E sheet 重排：第 1 行表头（项｜内容｜写法示例），第 2 行起声明项逐行，无空行占位 |
| 建议 S-2 小红书用法文案 | **PASS** | 「小红书画像」sheet 不再出现「另存」（测试断言 `doesNotMatch /另存/`），文案改为「不需要生成 CSV／XLSX 表格文件」 |
| 建议 S-3～S-9 其余 7 条 | **NOT_RUN（记录不修）** | S-3「解锁什么」加（报表阶段未做）：措辞增强，D 组已在表目录标「解析器未实现」，留后续；S-4 守卫白名单 `continue` 顺序：模板 31 KB 远小于 5 MiB 上限，无实际风险；S-5 README `SPU-001` 与模板 `SYN-0001` 均为合成标识、语义无歧义；S-6 `.gitignore` 追认需用户确认（spec §6 已注记，PR 说明需带）；S-7 生成器时间戳字节差：防漂移比内容不比字节，无影响；S-8 抖音放到哪未列 `source/short-video/`、`source/offline/`：README `source/` 表已列，且「`_抖音.csv` 后缀」口径已写入平台硬规则，完整目录清单留后续；S-9 本轮 `.local` 日志无业务片段（RED 日志仅含合成样本） |
| 文档口径一致 | **PASS** | `data/README.md`（目录说明指针改为「删第 2 行示例→按表目录文件名规则另存」；`tables/` 节标注客观属性无加载点；格式模板节＝新商品表头＋渠道店铺宽表块（含 2 行合成示例）＋平台硬规则逐字契约＋客观属性说明）；`docs/data-request.md`（顶部指针同口径；「怎么给」第 3 条改为命名硬规则）。与模板「使用说明」步骤一致；`check-docs-links.py` 139 条 0 错误 |

### 9.3 检查结果（修单后全量实跑）

| 检查 | 命令 | 结果 | 关键输出 |
| --- | --- | --- | --- |
| 构建＋全量测试 | `npm run check` | **PASS** | `tests 475 / pass 475 / fail 0` |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS** | 相对链接 139 条，错误 0，告警 0 |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS** | 白名单只放行模板文件；索引中无业务数据 |
| 归档内容 | `npm run check:archive-content` | **PASS** | 黑名单 85 条，扫描文本 188 个＋**xlsx 单元格文本 1 个**，0 命中（S3 生效） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS** | `found 0 vulnerabilities` |
| 断网 e2e | `npm run offline-check` | **NOT_RUN** | 同 §5：需真实 `data/` 授权 |
| 黄金脚本 | `npm run test:golden` | **NOT_RUN** | 同 §5：需真实参考资产授权；本轮未改评分内核任何文件 |

### 9.4 防漂移反向验证（两个方向都有牙）

| 变异 | 预期 | 实际 |
| --- | --- | --- |
| Flip A：手改入库 xlsx（funnel 第 2 行示例值＋第 6 行塞行） | FAIL | **FAIL**：版式测试「第 3 行起应留空，实际共 6 行」＋全量比对「[funnel] 第 2 行起不一致」 |
| Flip B：`legacy-formats.ts` 吊牌价→吊牌价(元)，不重建模板 | FAIL | **FAIL**：版式测试 products 第 1 行不一致＋列说明缺「商品主表｜吊牌价(元)」 |

两次变异均以备份还原（无 `git checkout`），还原后 sha256 与改前逐字一致（模板 `03b21d5a…`、catalog `7d6627cd…`），复跑 21/21 GREEN。

### 9.5 修单后的模板 sheet 清单（24 个）

使用说明｜表目录｜列说明（说明 3）＋ A 组 12（funnel…portrait-conflicts）＋ `products`（商品主表）＋ `channels`（渠道店铺宽表）＋ `抖音画像长表／京东画像表／天猫画像表` ＋ `小红书画像`（说明型，Markdown 报告）＋ `monthly-mix／clearance-leap`（D 组，表目录标「解析器未实现（P3 报表阶段）」）＋ `时间范围声明`（填 `data/README.md`，不落盘）。

### 9.6 仍待主 agent／用户处理

1. `scripts/check-no-archive-content.mjs` 的路径授权确认（spec §6 未列，按修单 S3 修改）。
2. S-6：spec §6 `.gitignore` 追认记录需用户确认（PR 说明带上）。
3. DT-6：push／PR／独立重验与 squash 合并待授权。
4. `offline-check`／`test:golden` 仍 NOT_RUN（需真实数据／参考资产授权）。
