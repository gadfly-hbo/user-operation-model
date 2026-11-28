# Data-Templates · 实施结果（DT-2／DT-3／DT-4）

> 变更：[spec.md](spec.md)（本单范围：DT-2／DT-3／DT-4；DT-5 复核与 DT-6 PR 由主 agent 另行安排）
> 执行：SDD·TDD 实现者 · 分支 `work/data-templates`（基线 `4ce38e4`，未 push）
> 独立复核：**未做**（DT-5 待安排，见 §7）

---

## 1. 任务清单状态（对应 spec §7）

| # | 任务 | 状态 | 证据 |
| --- | --- | --- | --- |
| DT-1 | 规格与任务清单 | **完成（前置）** | spec.md（用户 2026-11-28 确认） |
| DT-2 | 契约固化 + 生成脚本 + 防漂移测试（TDD 先 RED） | **完成** | §2、§3；RED→GREEN 见 §4 |
| DT-3 | 生成模板 + 文档指针 + README 旧名修正 | **完成** | §2；`templates/数据模板.xlsx` 已生成并入库 |
| DT-4 | 全量检查 | **完成**（两项 NOT_RUN，见 §5） | §5 |
| DT-5 | 独立复核 | **未做** | 主 agent 安排 |
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

> **入库方式说明**：`.gitignore` 有全局 `*.xlsx` 且 `.gitignore` 不在本变更允许修改路径内，模板按 spec「tracked」要求以 `git add -f templates/数据模板.xlsx` 单文件加入；数据守卫侧由 DT4 显式白名单对应放行。

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

## 6. 模板 sheet 清单（23 个）

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

1. **`tables/products.csv`／`channels.csv`／`product-attributes.csv` 的加载断链（范围外，未改）**：`data/README.md` 目录说明仍把这三张表列在 `tables/` 下（必需／建议），但代码实际只从 `data/domains/04_商品信息/`、`data/domains/02_渠道信息/` 的 XLSX 加载商品与渠道主数据（`packages/core/src/index/build.ts` 只扫 `domains/`、`source/`；全仓库 grep 无 `products.csv` 等加载点）。模板这三个 sheet 的「放到哪」按代码实际写了 `data/domains/…` 路径。是否修正 README 目录说明（以及是否让 `tables/` 下的 CSV 也被加载）超出本轮授权（spec §3 只授权修三个旧名），**留主 agent／用户决定**。
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
