# P1 工具1 候选独立复验报告（review-p1-recheck）

> 复验者：**独立复验 Agent**（未参与 `08cbc9b` / `1bb9768` 的任何实现，也不是上一轮复核者）
> 复验日期：2026-11-27 · 复验对象分支：`work/tool1-match-kernel`
> 上一轮报告：[review-p1.md](review-p1.md)（阻断 0／应修 4／建议 5）· 被复验规格：[spec.md](spec.md) · 作者自述：[result.md](result.md)
> 规范：[工程规范 §4.3／§5.1／§5.3／§7／§9.1](../../../docs/engineering-workflow.md)

---

## 1. 复验范围与候选身份

### 1.1 候选身份

| 项 | 值 | 核验方式 |
| --- | --- | --- |
| 候选 commit | `1bb9768f1884106b0e5da427b9cc96cf738597a8` | `git rev-parse HEAD` |
| 分支 | `work/tool1-match-kernel` | `git branch --show-current` |
| 基线（上一轮复核对象） | `08cbc9b` | `git log --oneline` |
| 复验前工作区 | clean | `git status --porcelain`（空） |
| 本轮变更规模 | 16 files changed, 572 insertions(+), 75 deletions(-) | `git show --stat 1bb9768` |

### 1.2 本轮实际执行的命令（可复现）

```
npm run build                                        # PASS，无错误
npm test                                             # 203 例，pass 203 / fail 0 / skipped 0
node --test packages/core/dist/test/**/*.test.js      # core 150（core 41 + index 27 + match 22 + normalize 60）
node --test packages/tool1-channel-match/dist/test/** # 工具1 22
node --test packages/data-mcp/dist/test/**           # data-mcp 31
UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden      # PASS，五条 + 锚点 A/C
UOM_REFERENCE_ROOT=... npm run offline-check          # PASS，三关（13 入口 / 17 工具 9 就绪 8 not-ready / 工具1 出网 0 次）
node packages/tool1-channel-match/dist/src/bin.js --dataset reference --month 2026-10 --out /tmp/...
node packages/tool1-channel-match/dist/src/bin.js --dataset data --data-root data --month 2024-01 --out /tmp/...
node packages/tool1-channel-match/dist/src/bin.js --demo --out /tmp/...  以及  --demo --out site/web/tool1-report.html
python3 .github/scripts/check-docs-links.py .         # 86 条相对链接，错误 0，告警 0
python3 .github/scripts/check-data-guard.py .         # 通过
npm audit --audit-level=high                          # found 0 vulnerabilities
Playwright（Chromium 1254，file://）打开 site/web/tool1-report.html 与 site/web/index.html
```

### 1.3 变异实验的还原纪律（不使用 git checkout/reset/stash/restore）

方法：**复制备份 → 改 → 构建 → 跑测试 → 用备份覆盖还原 → md5 校验**。备份目录 `/tmp/uom-recheck/backup/`。

| 文件 | 变异前 md5 | 全部还原后 md5 | 一致 |
| --- | --- | --- | --- |
| `packages/core/src/match/config.ts` | `5df4bbe459511674984007f284986cbc` | `5df4bbe459511674984007f284986cbc` | ✅ |
| `packages/tool1-channel-match/src/report/render.ts` | `e976c594d3e0f02e9fbeee7d74a4dc55` | `e976c594d3e0f02e9fbeee7d74a4dc55` | ✅ |
| `site/web/tool1-report.html`（被 CLI 重写） | `62227f6dfb7611bb472ce27954032779` | `62227f6dfb7611bb472ce27954032779` | ✅（内容逐字相同） |

还原后复跑：`npm run build` PASS、`npm test` **203/203 PASS**、`git status --porcelain` 为空、`git diff` 为空。

### 1.4 复验者自身的副作用披露

为验证输出路径守卫，我曾从子目录执行 CLI 并把**真实数据报告**写到 `site/web/tmp-bypass-check.html/`（见 N2 的复现）。该产物**由我在发现后立即删除**，`git status` 全程未见任何该路径的暂存或提交；`git ls-files site/web` 仍为 5 个原有文件。除此之外未在仓库内留下任何文件。

---

## 2. 逐项结论表

### 2.1 四项应修项（R1–R4）

| # | 结论 | 复验者独立验证证据 |
| --- | --- | --- |
| **R1** 渲染层参数单一来源 | **PASS（附残余 N1，建议级）** | ①全仓 grep：渲染层**不再有**热力图分档、图例、混合比例、裁剪区间的字面量副本（`render.ts:28-34` 的 `heatClass` 已改为读 `config.grades.a / config.grades.b / config.fuseThreshold`；`render.ts:376-381` 图例、`render.ts:395-407` 口径折叠区全部由 `config` 渲染，权重表由 `config.weights` 枚举生成）。②**重放上一轮复现**：把 `MATCH_CONFIG.grades` 改为 `{a: 85, b: 65}` → 重建 → 重新生成参考数据报告，逐单元比对「内核评级 vs 热力图 class」：**不一致 0 个**（上一轮为 8 个）；评级分布随之变为 A 50 / B 26 / C 2。③还原后 `config.ts` md5 一致，重生成报告的 `match-results.json` md5 `8d93a7b0b3d7ef69f96c2992976af9b8` 与 `mismatch.csv` md5 `b726def7ea1955ce50409149e7f46dad` 与变异前**完全一致**。④**新增单测有效性**（独立验证）：把 `render.ts` 的 `heatClass` 重新写死 `80/60/45` → `npm test` **1 例失败**（「热力图分档与图例跟随配置里的评级门槛…」），说明新测试真能抓住这类分叉。**残余**：台账条注释仍写死阈值 → 见 N1。 |
| **R2** 站点权重副本 | **PASS（附观察 N3、N4）** | `site/web/assets/app.js` 已删除公式、权重全表与阈值副本：全文件 grep `0.10\|0.25\|权重\|0.60 ×` 仅命中注释性文字（`:298`、`:396-398`）；原 `:1007` 的前端硬编码分级改为 `DEMO_BANDS`（`:1010-1011`）；技术口径折叠区改为指向 `packages/core` 的 `MATCH_CONFIG`（版本 `p1-2026-11-uncalibrated`）与工具1 报告页。**站点页面仍正常渲染**：`node --check app.js` / `node --check demo-data.js` 均通过；Playwright 打开 `site/web/index.html` → 切到「货渠匹配」页：**控制台 0 错误、0 外部请求、48 个 `.heat__cell`、抽屉可开（「92 / A 级 · 建议主推」）、「打开工具1 报告（合成演示）」入口链接存在（1 个）**。`demoBands` 只作用于合成示意数据这一声明**成立**：站点匹配矩阵的分数是 `demo-data.js` 里的**写死合成数值**（站点不重算任何分数，不存在第二份评分实现），且页面已声明「本页数值全部为合成演示数据，不反映真实匹配结果」。 |
| **R3** 价格带分支覆盖 | **PASS** | 9 条价格带规则的**分数、惩罚、bandId 三元组全部有断言**，逐条映射见 §4.2。**重放上一轮三处变异**（每次「改 → 构建 → npm test → 备份覆盖还原 → md5 校验」）：①`200-399-matched` 条件 `0.28 → 0.05` → **1 例失败**（「中端价位但渠道高消费不足时落兜底档并扣分」）；②`200-399-fallback` `score 70 → 30 / penalty −3 → −9` → **1 例失败**（同上）；③`400-499-matched` `score 90 → 55` → **1 例失败**（「中高客单带：达标与不达标两条分支分别命中」）。三次还原后 md5 均回到 `5df4bbe459511674984007f284986cbc`，复跑 203/203 通过。 |
| **R4** 输出路径守卫 | **PASS（限定范围，附 N2 中/低）** | CLI 实测（`--dataset reference` 真实数据产物）：写 `packages/tmp-guard-check` → **拒绝**（exit 1，「拒绝把真实数据产物写到仓库跟踪路径 packages/tmp-guard-check」）；`site/web/tmp-guard-check` → **拒绝**；`docs/tmp-guard-check` → **拒绝**；`openspec/tmp-guard-check` → **拒绝**；`output/tmp-guard-check` → **拒绝**；`data/domains/tmp-guard-check` → **拒绝**；写 `data/reports/tmp-recheck` → **成功**（78 单元 / mismatch 78 行）；写仓库外 `/tmp/uom-recheck/real-outside` → **成功**。`--demo` 合成演示：写 `site/web/tool1-report.html` → **成功**（md5 与已提交版本一致）；写 `packages/tmp-guard-check/x.html` → **拒绝**；写 `/tmp/uom-recheck/demo-outside.html` → **成功**。**判断**：守卫满足规格 §7.5 的意图——真实数据产物的仓库内落点被收紧到**只有 `data/reports/`**，仓库跟踪路径（`packages/ site/ docs/ openspec/ output/ scripts/ .github/`）与 `data/` 其余部分一律拒绝；**真实数据的边界未被放宽**。`result.md` §9 偏差 3 记录的「演示产物需落在站点报告页」例外**可接受**：它只对**合成演示**开一个白名单（`site/web/tool1-report.html`），合成数据不含业务明细，且真实数据模式**没有**对应白名单——真实数据无法以任何形式进入站点跟踪路径。**但守卫的仓库根取自 `process.cwd()`，从子目录调用可用 `../` 绕过 → N2。** |

### 2.2 建议项（S1–S5）

| # | 结论 | 复验者独立验证证据 |
| --- | --- | --- |
| **S1** 测试数拆分 | **PASS** | 我实跑分包统计：**core 150**（`core.test` 41 + `index.test` 27 + **`match.test` 22** + `normalize.test` 60）、**工具1 22**、**data-mcp 31**，合计 **203**，与 `result.md` §5 写的「203 例全过（core 150〔含内核 22〕+ 工具1 22 + data-mcp 31）」**逐项一致**，非照抄。 |
| **S2** Demo 与渲染器一致 | **PASS** | 用当前代码重新生成 Demo 到 `/tmp/uom-recheck/demo1.html`、`demo2.html`：**两次 md5 相同**（`62227f6dfb7611bb472ce27954032779`），且与已提交的 `site/web/tool1-report.html` **逐字相同**（`diff` 无输出，md5 相同）。 |
| **S3** 黄金脚本头注释措辞 | **PASS** | 现注释为「本文件只含**标识符与聚合评分**（款号、店铺名、单品均价、0–100 匹配分）；不含零售额／零售量／UV／退货率等经营明细」——与事实相符：脚本内数字只有款号（`109726113007` 等）、`¥318.69/85.95/626.83` 类单价与 0–100 分；grep `零售额|零售量|退货率|UV|毛利|GMV|成交额` 在脚本中**仅命中该句注释本身**。 |
| **S4** 旧口径 A 级占比 | **PASS** | `result.md` §7 已标注「**推断（未实测）**：…本轮只做了 5 条用例的新旧对照，未跑全量旧口径对照」，并说明不做全量对照的理由（会引入第二套评分逻辑）。表述与事实相符。 |
| **S5** `data/README.md` 示例数值 | **观察（未处理，符合作者声明）** | `data/README.md:109` 仍含 `预测性别,男,39.26%,90.62089851674344`；`git log` 显示该文件最后修改于 P0 提交 `d126ca2`，**非本候选引入**。仅记录观察。 |

### 2.3 回归确认

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `npm run build` | **PASS** | `tsc -b` 无错误 |
| `npm test` | **PASS** | 203 例，pass 203 / fail 0 / skipped 0 / todo 0 |
| 黄金回归 | **PASS（本地）／NOT_RUN（CI）** | 五条全 PASS；G1=95.4 A、G5=42.0 C 两条锚点保持 A／C；G3 记「87.7 A（旧 B）」、G4 记「68.9 B（旧 C）」；8 个输入文件 SHA-256 前缀与 `result.md` §6 **逐个一致**。CI 不跑黄金（工作流无该步骤）仍为 `NOT_RUN` |
| 断网三关 | **PASS** | 守卫自检「13 个出网入口全部被正确拦截并归因」；MCP「工具 17｜数据就绪 9｜data-not-ready 8｜意外 0｜出网尝试 0」；工具1「演示报告 PASS（出网尝试 0 次）｜参考数据报告 PASS（出网尝试 0 次）」 |
| 文档链接 | **PASS** | 86 条相对链接，错误 0，告警 0 |
| 数据守卫 | **PASS** | 「索引中无业务数据目录、数据文件或超大文件」 |
| 依赖审计 | **PASS** | found 0 vulnerabilities |
| 参考数据报告复现 | **PASS** | 78 单元、**A 58 / B 19 / C 1**、熔断 **1**、无空分；`mismatch.csv` **78 行**（+表头 = 79 行）、BOM `efbbbf`、表头逐字等于 spec §7.1 列顺序（行尾为 CRLF）、`priority` 降序（首 945159.1 → 末 13939.34）；与 `result.md` §7 **一致** |
| `data/` 1×1 冒烟 | **PASS（结论一致）** | `101526100201 × 1OCD7S0011 → 89.9 A`、`priceMissing=true`、`spending_power:price-missing`、CSV 0 行、notes「199 个渠道在 2024-01 无画像」「333 款商品在 2024-01 无画像」——与 `result.md` §7 一致；作者仍如实标注「不能作为多渠道路径验收」 |
| 合成 Demo 浏览器验证 | **PASS** | `file://` 打开 `site/web/tool1-report.html`：矩阵 **8 商品 × 6 渠道 = 48 格**；转置（点「按渠道找商品」→ `#matrix-row` hidden=true、`#matrix-col` hidden=false）生效；抽屉可开可关，含 **6 行**六维明细（分数/权重/证据）；主题切换 `data-theme=dark` 生效；CSV 按钮存在，内嵌 CSV 6428 字符、带 BOM、文件名 `mismatch-2026-10.csv`；错配清单页内显示 20 行（Top 20）；**420px 视口 `scrollWidth−clientWidth = 0`**；**控制台 0 错误、0 外部请求（仅 file:/data:）** |
| 站点「货渠匹配」页浏览器验证 | **PASS** | 48 个 `.heat__cell`、抽屉内容正常（「92 / A 级 · 建议主推」）、工具1 报告入口存在、技术口径折叠区已改为指向 `MATCH_CONFIG`；**控制台 0 错误、0 外部请求** |

### 2.4 数据边界复查

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 仓库内无业务数据 | **PASS** | `git ls-files data/` → 仅 `data/README.md`；`git ls-files | grep -Ei '\.(csv|xlsx|xls)$'` → **无**；无 `match-results.json` / `mismatch.csv` / 报告产物入库 |
| 脚本与口径文档无经营明细 | **PASS** | `scripts/golden-tool1.mjs` 与 `docs/match-calibration.md` 中的数字只有款号、店铺名、单品均价（¥318.69 / ¥85.95 / ¥626.83）、0–100 匹配分与维度分；`[0-9]{6,}` 命中项仅为款号字符串；无零售额／零售量／UV／退货率数值 |
| 报告产物不含本机路径与外网引用 | **PASS** | 参考数据报告 `index.html`：`/Users/` 命中 **0**；`http(s)://` 命中 **1**，为 data-URI favicon 内的 SVG 命名空间 `http://www.w3.org/2000/svg`（不发请求）；断网实跑出网 0 次 |
| 入库截图 | **PASS（含观察 N6）** | `output/playwright/tool1-report-light.png` 经复验者查看为**合成演示数据**截图（横幅「合成演示数据」、演示商品/演示渠道名、SPU-2601 等），无真实业务数据 |

---

## 3. 新发现

> 分级沿用上一轮口径：**阻断**（红线违反）> **应修**（触及硬约束/验收条目字面要求）> **建议**（质量与口径一致性）> **观察**。本轮**阻断 0**。

### N1 —— R1 残余：渲染层台账条注释仍写死阈值（建议级）

- **位置**：`packages/tool1-channel-match/src/report/render.ts:178-179`
  ```
  { label: '高匹配单元', value: high, tone: 'high', note: '≥ 80 分，建议主推' },
  { label: '熔断单元', value: fused, tone: 'low', note: '< 45 分，不建议投放' },
  ```
- **现象**：这是渲染层**最后一处**阈值字面量副本（热力图分档、图例、口径折叠区均已改由 `config` 渲染）。台账的**计数**取自内核返回值（`grade === 'A'` / `result.fuse`），**正确**；只有**注释文字**写死。
- **复现（实测）**：`MATCH_CONFIG.grades → {a: 85, b: 65}` → 重建 → 重新生成参考数据报告 → 同一页面同时出现
  - 图例：`建议主推 · ≥ 85`、台账注释：`≥ 80 分，建议主推`（且「高匹配单元」计数为 50，与 `≥ 80` 的字面含义不符）
  - 口径折叠区：`评级：A ≥ 85，B 65–84.9，C < 65`
  → 页面自相矛盾。
- **覆盖缺口**：没有任何单测断言台账条注释（grep `ledger|≥ 80|80 分` 在 `packages/tool1-channel-match/test/` 内 0 命中）。
- **建议改法**：`note: \`≥ ${config.grades.a} 分，建议主推\`` / `note: \`< ${config.fuseThreshold} 分，不建议投放\``（`ledger()` 需接收 `config`），并补一条断言。
- **影响**：无评分影响，仅页面文案；属 R1 的收尾遗漏。

### N2 —— 输出路径守卫以 `process.cwd()` 为仓库根，子目录调用可用 `../` 绕过（建议级偏高，触及 §7 硬约束的可执行性）

- **位置**：`packages/tool1-channel-match/src/report/output-guard.ts:31`（`repoRoot: string = process.cwd()`）、`:33`（`relative(resolve(repoRoot), resolve(target))`）；调用点 `packages/tool1-channel-match/src/bin.ts:143`、`:164`（均不传 `repoRoot`）。
- **现象**：守卫判定「是否在仓库内」时，把**当前工作目录**当作仓库根。正常用法（仓库根执行 `npm run tool1`）下守卫有效；但从子目录执行时，指向仓库内跟踪路径的 `../` 路径会被判成「仓库之外」而**放行**。
- **复现（实测，exit 0，真实数据报告写入仓库跟踪路径）**：
  ```
  cd packages
  UOM_REFERENCE_ROOT="..." node tool1-channel-match/dist/src/bin.js \
      --dataset reference --month 2026-10 --out ../site/web/tmp-bypass-check.html
  → 已生成 /Users/.../user-operation-model/site/web/tmp-bypass-check.html
    index.html（401499 字节）· mismatch.csv（78 行）· match-results.json（78 个单元）
  ```
  守卫未报错；真实业务数据（78 单元、零售额、款号）落在 `site/web/` 这一 **git 跟踪目录**内。对照：从仓库根执行同一目标 `--out site/web/tmp-guard-check` 被正确拒绝。
  （复验者已立即删除该产物，`git status` 全程干净。）
- **建议改法**：守卫的仓库根改用已有工具 `packages/tool1-channel-match/src/report/assets.ts:13` 的 `findRepoRoot()`（按 `site/web/assets/base.css` 定位真实仓库根），而不是 `process.cwd()`；或对 `resolve()` 后的绝对路径再做一次「是否位于仓库跟踪前缀下」的判定。
- **影响面**：默认入口（仓库根执行）不受影响；风险仅在非常规调用姿势下出现，但与 §7「业务数据不出网/不入跟踪路径」的**可执行性**直接相关。

### N3 —— 站点 `demoBands` 与 `MATCH_CONFIG` 当前取值重合，属第二份数字副本（观察级）

- **位置**：`site/web/assets/demo-data.js:225`（`const demoBands = { a: 80, b: 60, fuse: 45 };`）、`site/web/assets/app.js:301-305`、`:360-361`、`:1010-1011`。
- **判断**：作者的声明「只作用于合成示意数据」**成立**——站点矩阵分数是写死的合成值，站点不重算分数，不存在第二份**评分实现**；页面口径区已声明「正式评分口径只在 packages/core 的 MATCH_CONFIG 里定义一处」「本页数值全部为合成演示数据，不反映真实匹配结果」。因此**不构成口径混淆**，但 `demoBands` 的数值恰好等于正式阈值，一旦 `MATCH_CONFIG` 调整，站点图例会**静默滞后**且读者难以察觉它与正式口径同形。
- **建议**：图例标注「示意分档（合成演示用）」，或构建期从 `MATCH_CONFIG` 生成该分档。

### N4 —— `docs/ui-demo/demo-app.js` 仍保留公式、权重全表与阈值副本（观察级，非本候选引入）

- **位置**：`docs/ui-demo/demo-app.js:269`、`:272`、`:297-298`、`:323-326`（`0.60 × JS + 0.25 × 余弦 + 0.15 × Top3`、`[25, 99.5]`、六维权重全表、`A ≥ 80 / B 60–79.9 / C < 60 / < 45`）。
- **判断**：`docs/ui-demo/` 是 P0（`d747e86`）保留的「旧版 UI 原型，仅作历史对照，不再维护」（`README.md:110`、`docs/ui-design.md:203`），**非本候选引入**。但全仓 grep「第二份权重常量」仍会命中它，与 R2 的清理口径不一致。
- **建议**：登记为后续清理项（删除或明确标注为历史快照、不作为口径）。

### N5 —— `result.md` 的 R1/R2 表述偏强（观察级）

- **位置**：`openspec/changes/tool1-match-kernel/result.md:78`「**复核后补齐**：渲染层与站点不再保留阈值／权重副本（R1、R2）」、`:82`、`:175`。
- **判断**：因 N1 残留，渲染层仍有 2 行阈值字面量（台账条注释），「不再保留阈值副本」不成立（站点侧成立）。建议改为「热力图分档、图例、口径折叠区已改由 `MATCH_CONFIG` 渲染；台账条注释为残余（见 N1）」。

### N6 —— `output/playwright/**` 截图在 git 跟踪路径内（观察级）

- **判断**：本轮新增的三张 `tool1-report-*.png` 经查看为**合成演示**截图，无真实业务数据。但 `output/` 不在 `.gitignore` 中，属跟踪路径；真实数据报告的截图若被误放入即构成业务数据入库风险。
- **建议**：把 `output/` 加入 `.gitignore`，或明确「只允许合成演示截图入库」的约束。

---

## 4. 复验者独立实测的关键数值

### 4.1 测试数拆分（S1 复核）

| 包 | 计数 | 明细 |
| --- | ---: | --- |
| `packages/core` | **150** | `core.test` 41 + `index.test` 27 + **`match.test` 22**（内核）+ `normalize.test` 60 |
| `packages/tool1-channel-match` | **22** | — |
| `packages/data-mcp` | **31** | — |
| 合计 | **203** | pass 203 / fail 0 / skipped 0 / todo 0 |

### 4.2 九条价格带规则的覆盖映射（R3 复核）

| bandId | 分数 | 惩罚 | 覆盖用例（`packages/core/test/match.test.ts`） |
| --- | ---: | ---: | --- |
| `under-100` | 95 | 0 | `:202`「平价带无条件命中」 |
| `100-199` | 88 | 0 | `:80`「五个分布维度都得 100 分，消费能力按价格带判定…」 |
| `200-399-matched` | 92 | 0 | `:194`「中端价位且渠道高消费达标时不扣分」 |
| `200-399-fallback` | 70 | −3 | `:209`「中端价位但渠道高消费不足时落兜底档并扣分」 |
| `400-499-matched` | 90 | 0 | `:218`「中高客单带：达标与不达标两条分支分别命中」（前半） |
| `400-499-fallback` | 58 | −6.5 | `:218` 同上（后半） |
| `500-matched` | 93 | 0 | `:243`「高消费占比达标时高客单命中高档位」 |
| `500-break` | 32 | −10.5 | `:181`「高客单且渠道购买力断层时命中断层档并给出全局惩罚」 |
| `500-fallback` | 68 | −4 | `:234`「高客单但未达断层条件时落兜底档」 |

**9/9 条规则的「分数 + 惩罚 + bandId」三元组均有断言**；上一轮指出的 3 条零覆盖规则（`200-399-fallback`、`400-499-matched`、`400-499-fallback`）已补齐，且三条变异各自被独立用例抓住。

### 4.3 R1 变异前后对比（`grades: {a:80,b:60}` → `{a:85,b:65}`）

| 项 | 变异前 | 变异后 |
| --- | --- | --- |
| 评级分布（A/B/C） | 58 / 19 / 1 | 50 / 26 / 2 |
| **「内核评级 vs 热力图 class」不一致的单元数** | 0 | **0**（上一轮同一复现为 **8**） |
| 图例文案 | 「建议主推 · ≥ 80」 | 「建议主推 · ≥ 85」（随配置） |
| 口径折叠区 | 「评级：A ≥ 80，B 60–79.9，C < 60」 | 「评级：A ≥ 85，B 65–84.9，C < 65」 |
| 台账条注释 | 「≥ 80 分，建议主推」 | **仍为「≥ 80 分，建议主推」→ N1** |

### 4.4 参考数据报告（2026-10）与 `data/` 冒烟

| 项 | 复验者实测 | `result.md` §7 | 一致 |
| --- | --- | --- | :-: |
| 评分单元 | 78 | 78 | ✅ |
| 评级 A/B/C | 58 / 19 / 1 | 58 / 19 / 1 | ✅ |
| 熔断 | 1 | 1 | ✅ |
| 错配清单行数 | 78（+表头 79，BOM `efbbbf`，CRLF） | 78 | ✅ |
| 优先级排序 | 降序（945159.1 → 13939.34） | 降序 | ✅ |
| 报告内 `/Users/` | 0 | 0 | ✅ |
| 报告内 `http(s)://` | 1（data-URI favicon 的 SVG 命名空间） | 同 | ✅ |
| `data/` 可评分单元 | `101526100201 × 1OCD7S0011 → 89.9 A` | 同 | ✅ |
| `data/` 缺价标记 | `priceMissing=true` / `spending_power:price-missing` | 同 | ✅ |
| `data/` 错配清单 | 0 行 | 0 行 | ✅ |

### 4.5 合成 Demo 浏览器实测

| 项 | 实测 |
| --- | --- |
| 矩阵 | 8 商品 × 6 渠道 = 48 格；两个视角共 156 个 `heat__cell` |
| 转置 | 「按渠道找商品」→ `#matrix-row.hidden=true`、`#matrix-col.hidden=false` |
| 抽屉 | 可开可关；六维明细 **6 行**（分数/权重/证据，含 JS/余弦/Top3 与客单带、高低消占比） |
| 主题 | 「暗色」→ `document.documentElement.dataset.theme = "dark"` |
| CSV | 按钮存在；内嵌 CSV 6428 字符，首字节 BOM，文件名 `mismatch-2026-10.csv` |
| 错配清单 | 页内 20 行（Top 20） |
| 420px 横向溢出 | `scrollWidth − clientWidth = 0` |
| 控制台 / 外部请求 | **0 错误 / 0 外部请求** |

### 4.6 黄金回归五条（复跑）

| 用例 | 旧总分/评级 | 新总分/评级 | 客单分 | 惩罚 | 结论 |
| --- | --- | --- | ---: | ---: | --- |
| G1（锚点） | 91.9 A | 95.4 A | 92 | 0 | PASS |
| G2 | 91.2 A | 95.3 A | 95 | 0 | PASS |
| G3 | 78.2 B | 87.7 A（旧 B） | 93 | 0 | PASS |
| G4 | 59.2 C | 68.9 B（旧 C） | 68 | −4 | PASS |
| G5（锚点） | 40.9 C | 42.0 C | 32 | −10.5 | PASS |

输入文件 SHA-256 前缀 8 个与 `result.md` §6 逐个一致。

---

## 5. 未验证项

| 项 | 状态 | 原因 |
| --- | --- | --- |
| CI 实跑（本候选） | **NOT_RUN** | 候选未开 PR，工作流未触发；本地等价命令已全跑 |
| 站点线上页面渲染 | **NOT_RUN** | 站点为私有，外部匿名访问返回 401；本轮只验了本地 `file://` |
| 用户对 Demo 的 UI 审核结论 | **NOT_PROVED** | 属仓库外人机交互，仓库内无凭据 |
| 规范 §5.3 专项最终检查 | **NOT_RUN** | 本轮只核了「工具1 是否只消费内核」「复用既有相似度函数／`buildIndex`」「数据边界」；**最少用户操作路径、复用第三方 SDK 的依据未逐项核对** |
| P1 阶段门禁判定 | **NOT_RUN** | 门禁通过判定权在流程，不在本报告 |
| 权重 NDCG 校准（Q4） | **NOT_RUN** | 缺成交明细与售罄率；且作者已明示不做全量旧口径对照（会引入第二套评分逻辑），result.md 已标「推断（未实测）」 |
| 工具2 背对背全链路 | **NOT_RUN** | 本轮未做工具2（内核输入契约无人工画像字段通道属静态确认） |
| 站点发布态页面与线上渲染一致性 | **NOT_RUN** | 同「站点线上页面渲染」 |

---

## 6. 结论

**建议合并**，条件是同轮补掉 **N1**（两行台账注释改由 `config` 渲染）与 **N2**（守卫仓库根改用 `findRepoRoot()`）——两处改动都很小（合计约 5 行），且直接对应「渲染层参数单一来源」与「真实数据不入仓库跟踪路径」两条硬约束的**可执行性**。若团队决定延后，须在 `result.md` 明确记录 N1/N2 为已知缺口并写明后续轮次归属。

理由：

- **四项应修项实质闭合**：R1（渲染层分档/图例/口径区已随 `MATCH_CONFIG` 联动，上一轮的「内核评 B、热力图涂 A 色」在 78 单元上**复现为 0**，且新单测能抓住重新写死的分叉）、R2（站点已无公式/权重/阈值副本，页面浏览器实测 0 错误）、R3（9 条价格带规则的分数+惩罚+bandId 全部有断言，三处变异各自被独立用例抓住）、R4（真实数据产物只落 `data/reports/`，六类仓库跟踪路径与 `data/domains` 全部拒绝，演示产物只落站点报告页，仓库外临时目录放行；**真实数据边界未被放宽**）。
- **无红线违反**：全仓唯一 `scoreMatch`、唯一价格带表、唯一相似度实现；仓库与 CI 无业务数据；产物 0 外网请求、0 本机路径。
- **回归全绿**：build PASS、203/203 单测、黄金回归五条 + 锚点 PASS、断网三关 PASS、链接/守卫/审计 PASS、参考数据 78 单元与 A58/B19/C1/熔断 1/清单 78 行复现一致、合成 Demo 与站点页面浏览器实测零错误。
- **新发现均非阻断**：N1、N2 为建议级（其余为观察级），不影响当前基线的正确性——R1/R2/R3/R4 的行为在本轮所有实测场景中均正确。

**声明**：本报告**不代替** P1 阶段门禁（工程规范 §4.6）、**不代替**规范 §5.3 的专项最终检查、**不代替** CI、**不代替**产品验收（看板形态与错配清单的业务可用性属产品判断）；本轮所有结果仅覆盖上文列明的复验范围与命令。

---

*复验者未参与候选任何实现；全程未使用 `git checkout --` / `git reset` / `git stash` / `git restore`；变异实验全部经备份覆盖还原并 md5 校验；复验结束时 `git status --porcelain` 为空、`git diff` 为空、`npm test` 203/203 通过、黄金回归 PASS、浏览器实测零错误。*
