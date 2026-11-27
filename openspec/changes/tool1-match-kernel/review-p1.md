# P1 工具1 候选独立复核报告（review-p1）

> 复核者：**非作者独立复核 Agent**（未参与 `08cbc9b` 的任何实现）
> 复核日期：2026-11-27 · 复核对象分支：`work/tool1-match-kernel`
> 被复核规格：[spec.md](spec.md) · 作者自述：[result.md](result.md) · 口径：[match-calibration.md](../../../docs/match-calibration.md) · [match-kernel.md](../../../docs/match-kernel.md)
> 规范：[工程规范 §4.3／§4.6／§5.1／§7／§9.1／§9.3](../../../docs/engineering-workflow.md)

---

## 1. 复核范围与候选身份

### 1.1 候选身份

| 项 | 值 | 核验方式 |
| --- | --- | --- |
| 候选 commit | `08cbc9bdb727c7626280a06a7c587ec3d2dd7316` | `git rev-parse HEAD` |
| 分支 | `work/tool1-match-kernel` | `git branch --show-current` |
| 基线 | `d747e86`（P0 收尾，PR #2） | `git log --oneline` |
| 变更规模 | 43 files changed, 6328 insertions(+), 2 deletions(-) | `git show --stat 08cbc9b` |
| 复核前工作区 | clean | `git status --porcelain`（空） |

### 1.2 本轮实际执行的命令（复现用）

```
npm run build                                  # PASS，无错误
npm test                                       # 195 例，pass 195 / fail 0 / skipped 0
UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden   # PASS，五条 + 两锚点
UOM_REFERENCE_ROOT=... npm run offline-check   # PASS，守卫自检 13 入口 / MCP 17 工具 / 工具1 出网 0 次
env -u UOM_REFERENCE_ROOT npm run test:golden  # exit 1，明确报错「缺少 UOM_REFERENCE_ROOT」
UOM_REFERENCE_ROOT=/tmp/definitely-not-here-123 npm run test:golden  # exit 1，「参考数据根目录不存在」
python3 .github/scripts/check-docs-links.py .  # 检查 79 条相对链接，错误 0，告警 0
python3 .github/scripts/check-data-guard.py .  # 数据守卫通过
npm audit --audit-level=high                   # found 0 vulnerabilities
node packages/tool1-channel-match/dist/src/bin.js --dataset reference --month 2026-10 --out /tmp/uom-review-tool1
node packages/tool1-channel-match/dist/src/bin.js --dataset data --data-root data --month 2024-01 --out /tmp/uom-review-tool1-data
node packages/tool1-channel-match/dist/src/bin.js --demo --out /tmp/uom-review-demo.html
```

### 1.3 检查过的文件

`packages/core/src/match/{types,config,kernel,month}.ts`、`packages/core/test/match.test.ts`、
`packages/tool1-channel-match/src/{bin.ts,dataset/*,report/*,demo/*}`、`packages/tool1-channel-match/test/*`、
`scripts/golden-tool1.mjs`、`scripts/offline-check/{tool1-offline,block-net,guard-selftest,offline-e2e}.mjs`、
`site/web/{tool1-report.html,assets/app.js,assets/base.css}`、`docs/{match-kernel,match-calibration,ui-design}.md`、
`openspec/changes/tool1-match-kernel/{spec,result}.md`、`.github/workflows/check.yml`、`.gitignore`。

### 1.4 工作区纪律（变异实验还原）

- **全程未使用** `git checkout --` / `git reset` / `git stash` / `git restore`（这些命令会连带还原未跟踪新文件，破坏候选）。
- 采用「复制备份 → 改 → 构建 → 跑测试 → 用备份覆盖还原 → md5 校验」方式。
- 备份目录：`/tmp/uom-backup/{kernel.ts,config.ts,render.ts,golden-tool1.mjs}`。

| 文件 | 变异前 md5 | 全部还原后 md5 | 一致 |
| --- | --- | --- | --- |
| `packages/core/src/match/kernel.ts` | `622ba6c47bc0b46295fb5172b03dcf69` | `622ba6c47bc0b46295fb5172b03dcf69` | ✅ |
| `packages/core/src/match/config.ts` | `5df4bbe459511674984007f284986cbc` | `5df4bbe459511674984007f284986cbc` | ✅ |
| `packages/tool1-channel-match/src/report/render.ts` | `d52663a74e7bc3cb2d311cc972c59f5a` | `d52663a74e7bc3cb2d311cc972c59f5a` | ✅ |
| `scripts/golden-tool1.mjs` | `f92511dbe35da60f0ade2d504353279b` | `f92511dbe35da60f0ade2d504353279b` | ✅ |

**收尾状态**：`git status --porcelain` 为空、`git diff` 为空；`npm run build && npm test` 复跑 195/195 通过；黄金回归复跑 PASS。

### 1.5 未纳入本轮复核（明确标 NOT_RUN）

| 项 | 状态 | 原因 |
| --- | --- | --- |
| CI 实跑（本候选未开 PR，CI 未触发） | `NOT_RUN` | 候选未推送；本地等价命令已全跑 |
| 站点线上页面渲染 | `NOT_RUN` | 站点私有，外部访问 401（作者 result.md §9 已如此标注） |
| 用户对 Demo 的 UI 审核结论 | `NOT_PROVED` | 属仓库外的人机交互，仓库内无凭据 |
| 工具2 背对背全链路 | `NOT_RUN` | 本轮未做工具2（只做静态确认，见 §2 硬约束表） |
| NDCG 权重校准 | `NOT_RUN` | 缺成交明细与售罄率（Q4） |

---

## 2. 逐项结论表

### 2.1 验收条目 T1-01 … T1-16

| 标识 | 结论 | 证据（复核者独立复跑） |
| --- | --- | --- |
| **T1-01** 匹配内核单一实现 | **FAIL**（限定范围） | `packages/core/src/match/kernel.ts:139` 导出唯一 `scoreMatch`；`packages/tool1-channel-match/src/dataset/report.ts:19`、`src/demo/build.ts:23` **只调用** `scoreMatch`，无第二份评分实现；客单价格带表仅 `config.ts:103-193` 一处（grep `priceMin/allOf/500-break` 全仓命中仅 config.ts + 一条测试断言）。**但「不得出现第二份评分公式或权重常量」不成立**：公式与阈值在 `render.ts:391-394` 有第二份，`site/web/assets/app.js:391-394` 有完整权重全表。→ R1、R2 |
| **T1-02** 公式与参数 | **PASS** | `kernel.ts:123`（`100 × (blend.js×JS + blend.cosine×余弦 + blend.top3×Top3)`）、`:256-268`（加权/惩罚/裁剪/评级）逐项与讨论稿 §7.4 一致；我用**独立脚本**从原始 CSV 复算五条用例，总分/评级/客单分/惩罚/六维分**逐条一致**（§4）。注：result.md「单测逐值断言」不成立 → R3 |
| **T1-03** 六维真实计算 | **PASS** | 变异 M1（`city_tier` 写死 85）→ `npm test` **9 例失败**（含「城市等级分布完全不相交时该维度分数明显下降」），黄金回归 5 条全 FAIL。无任何写死 85/84 的维度分；grep 全仓无 85/84 维度分常量（`docs/`、`openspec/` 里的 85/84 均为**旧口径的说明文字**） |
| **T1-04** 缺失语义 | **PASS** | `kernel.ts:151-202`（缺价 → 维度不可用、无惩罚、`priceMissing`）、`:222-229`（缺项与原因）、`:237-254`（`available < 3` → `totalScore: null` + `insufficient-dimensions`）、`:256-260`（按可用维度权重和重归一化）。变异 M3a（不重归一化）→ 2 例失败；M3b（不剔除缺价维度）→ 1 例失败。`data/` 1×1 实跑：`spending_power:price-missing` 被正确剔除 |
| **T1-05** 参数单一来源 | **FAIL** | 内核部分 PASS：`MATCH_CONFIG`（`config.ts:84`）+ `validateMatchConfig`（`:203`，覆盖混合比例和、六维权重、门槛顺序、价格带连续性与兜底、标签不重叠、版本非空），改配置改变输出有单测（`match.test.ts:270-278`）、非法配置抛错有单测（`:280-286`）。**UI 部分 FAIL**：评级/熔断阈值 `80/60/45` 在 `packages/tool1-channel-match/src/report/render.ts:26-28` 是字面量，混合比例 `0.60/0.25/0.15`、裁剪区间 `[25, 99.5]`、评级文案在 `:391-394` 是字面量；`render.ts` 未 import `MATCH_CONFIG`。→ R1、R2 |
| **T1-06** 输出结构确定性 | **PASS** | `match.test.ts:95-99` deepEqual 用例通过；我自己对同一输入连续两次调用结果完全相同；输出含总分/评级/熔断/六维明细（含 evidence）/可用·缺失维度/正负向驱动（≤3 条、阈值 1）/priceFit（价格带·高低消占比·惩罚·诊断）/flags（`productMonthUnknown`·`channelApproximate`·`priceMissing`） |
| **T1-07** 黄金回归 | **PASS（本地）／NOT_RUN（CI）** | 本地复跑：五条 PASS，G1=A、G5=C 两条锚点保持；`.github/workflows/check.yml` 全文无 golden 步骤 → CI 确为 `NOT_RUN`，与声明一致；参考数据只读（脚本只用 `readFileSync`/`existsSync`） |
| **T1-08** 数据集适配 | **PASS** | `reference.ts`（只读适配）与 `data-root.ts`（`buildIndex` 复用）产出同一 `MatchDataset`（`dataset/types.ts`）；价格顺序 `data-root.ts:99-115` = actualUnitPrice → retailAmount/retailQty → unitPrice → missing，**无兜底价**；`reference.ts:194-202` 同序；实测 `data/` 路径缺价时 `priceSource='missing'`、`priceMissing=true` |
| **T1-09** 时间窗规则 | **PASS** | `match/month.ts:45-53`（单月相等、区间覆盖、无标签不匹配）；`dataset/portrait.ts:35-68`（exact/window/unknown，不回退）；实测参考数据 78 单元 `flags.productMonthUnknown=78`、`channelApproximate=0`；`data/` 路径 `2024-01` 选出 199 渠道无画像（不回退到相邻月） |
| **T1-10** 匹配矩阵 | **PASS** | 浏览器实测（Playwright，file:// 打开合成 Demo）：`#matrix-row` 8 商品×6 渠道、`#matrix-col` 6 渠道×8 商品，点「按渠道找商品」后 `matrix-row.hidden=true` / `matrix-col.hidden=false`（转置生效）；点单元格抽屉打开，内容含六维分+权重+证据、正向/负向驱动、客单承接诊断；台账条含候选商品/渠道/已评分单元/高匹配/熔断/六维全可用 |
| **T1-11** 错配清单 | **PASS** | `mismatch.csv` 首字节 `efbbbf`（BOM）；表头逐字等于 spec §7.1 列顺序；78 行 + 表头；手算核对排序口径：3029356.1×(1−0.688)=945159.1 ✓、3097064.78×(1−0.718)=873372.27 ✓、3029356.1×(1−0.782)=660399.63 ✓；缺零售额不入排序有单测 |
| **T1-12** 看板形态 | **PASS** | 浏览器实测 `external: []`（路由拦截所有非 file:/data: 请求，0 次）、控制台 0 error、页面 0 error；`file://` 直开可用；`base.css` 内联；亮暗主题切换生效（`data-theme=dark`）；420px 视口 `scrollWidth−clientWidth = 0`（无横向溢出）；业务字符串转义有单测 |
| **T1-13** UI Demo 门禁 | **部分：NOT_PROVED** | Demo 与正式同源 **PASS**：我重新生成 Demo 与 `site/web/tool1-report.html` diff 仅差 1 段 CSS（见 S2），同一渲染器同一内核（`demo/build.ts:23` 调 `scoreMatch`）。**「用户已审核通过」NOT_PROVED**：仓库内无凭据，result.md §3/P1-7 的 PASS 属仓库外事实声明；`site/web/assets/app.js:347` 入口链接存在；站点页为合成数据（`external:[]`、无真实款号/店铺名） |
| **T1-14** 真实路径 | **PASS** | 参考数据 2026-10 实跑：**78 单元**（13 商品 × 6 渠道）、评级 **A 58 / B 19 / C 1**、熔断 1、flags 仅 `productMonthUnknown=78`、缺价 0 —— 与 result.md §7 逐字一致；`data/` 1×1 冒烟实跑：`101526100201 × 1OCD7S0011 → 89.9 A`、`priceMissing=true`、`mismatch.csv` 0 行、notes 记「199 个渠道在 2024-01 无画像」「未进入错配排序的单元 1 个」—— 与 result.md §7 一致；作者已如实标注「不能作为多渠道路径验收」 |
| **T1-15** 数据边界 | **PASS**（附 R4） | `git ls-files data/` → 仅 `data/README.md`；全仓 tracked 无 `.csv/.xlsx/.xls`；`data/` 已在 `.gitignore`（`data/*` + `!data/README.md`）；真实产物落 `data/reports/tool1/**`（已忽略，未进 git）；报告不含 `/Users/`（实测 0 次）、`http`（0 次，仅 data-URI 图标内含 SVG 命名空间）；生成器断网实跑出网 0 次。**但输出路径守卫未覆盖 `packages/`、`site/`、`docs/`** → R4 |
| **T1-16** 未校准声明 | **PASS** | `config.ts:85` 版本 `p1-2026-11-uncalibrated`；`config.ts:82`、`docs/match-kernel.md:51`、`docs/match-calibration.md:44`、`render.ts:396`、`demo/build.ts:50`、报告产物内均写「已调整」并显式写「不得称『已优化』」；全仓 grep 无「已优化」的肯定用法（仅出现在「不得称已优化」的禁止句中） |

### 2.2 四条硬约束

| 硬约束 | 结论 | 依据 |
| --- | --- | --- |
| **1. 业务数据不出网** | **PASS**（附 R4、S3） | 见 T1-15；`.github/workflows/check.yml` 不下载/不挂载任何真实数据；`guard-selftest` 13 个出网入口全拦截；参考数据只读（脚本只用 `readFileSync`）；`check-data-guard.py` 通过。**遗留**：①输出目录守卫未覆盖仓库跟踪路径（R4）；②`scripts/golden-tool1.mjs` 注释称「不含任何业务数值明细」，实际内嵌单价与旧分（S3，属聚合量，可接受） |
| **2. 匹配内核唯一** | **PASS（红线未被违反）／§9.1 字面要求未完全满足** | 无第二份**评分实现**：全仓唯一 `scoreMatch`（`packages/core/src/match/kernel.ts:139`），工具1 与 Demo 都只消费它；客单价格带表唯一（`config.ts:103-193`）；六维权重唯一（`config.ts:87-94`，`render.ts` 的抽屉权重取自内核返回值 `result.dimensions[].weight`，无字面量副本）。**但**：`render.ts:26-28,391-394` 复制了评级/熔断阈值与公式文案；`site/web/assets/app.js:391-394,1007` 复制了六维权重全表与分级阈值 → R1、R2 |
| **3. 背对背隔离** | **PASS（本轮范围内）** | 本轮未做工具2。匹配内核只消费六维统一维度（`kernel.ts:205` `DISTRIBUTION_DIMENSIONS`），输入契约 `MatchPortraitInput` 只含 `dimensions/month/window`，**无任何人工画像字段通道**；全仓 grep `人工人群定位/人工新老客比例/人工首发渠道/FAB 卖点/人工画像` 仅命中 P0 既有文件（`packages/core/test/core.test.ts:216`、`packages/core/src/product/catalog/fields.ts:38`），本候选未新增此类读取路径 |
| **4. 模型来源可溯** | **NOT_APPLICABLE（本轮不适用）** | 本轮未接触 ModelEvol / model-mlflow；参考数据（抖音）以**只读**方式适配，`reference.ts` 无写操作；`packages/tool1-channel-match` 未新增运行时第三方依赖（`exceljs` 为既有仓库依赖，`packages/core/package.json` 与 `packages/data-mcp/package.json` 已在用，本轮仅在 tool1 的 devDependencies 复用） |

### 2.3 变异测试（复核者自证测试有效性）

| # | 变异 | 位置 | 结果 |
| --- | --- | --- | --- |
| **M1** | 把 `city_tier` 维度分写死为常数 85 | `kernel.ts:205-211` | **✅ 抓住**。`npm test`：**9 例失败**（完全一致画像 / 城市等级不相交 / 缺维度重归一化 / 空分布 / 缺价格不插补 / 维度不足 / 客单断层 / 中端不扣分 / 评级阈值可配置）。黄金回归：**5 条全 FAIL**（95.4→94.8、95.3→94.1、87.7→86.8、68.9→68.6、42→41.9） |
| **M2** | 篡改价格带判定条件：`200-399-matched` 高消阈值 `0.28 → 0.05` | `config.ts:127` | **❌ 未抓住**。`npm test` 仍 **195/195 通过**，黄金回归仍 **PASS**。进一步把 `200-399-fallback` 的 `score 70→30 / penalty −3→−9`、`400-499-matched` 的 `score 90→55` 也**未被任何测试或黄金用例抓住**（195/195 + golden PASS） |
| **M3a** | 缺维度时不重归一化（`/ weightSum → / 1`） | `kernel.ts:256-260` | **✅ 抓住**。2 例失败：「渠道缺一个维度时该维度剔除并对剩余维度重归一化」「缺价格时不插补兜底价」 |
| **M3b** | 不剔除缺价维度（缺价时把 `spending_power` 当作可用、分数 0） | `kernel.ts:151-158` | **✅ 抓住**。1 例失败：「缺价格时不插补兜底价：消费能力维度剔除、无惩罚、并标记缺价」 |
| **M4** | 报告产物注入外网引用（`<a href="https://cdn.example.com/...">`） | `render.ts:424` | **✅ 抓住**。`npm test` 1 例失败（「产物不含任何外网引用」）；`npm run offline-check` 断言崩溃（非静默通过） |
| **M5** | 黄金脚本期望值改错（`95.4 → 95.5`） | `scripts/golden-tool1.mjs:34` | **✅ 抓住**。输出 `G1（锚点） | 91.9 A | 95.4 A | 92 | 0 | FAIL` + 错误明细「G1 …：总分 95.4 ≠ 基线 95.5」，**退出码 1**，明确指出是哪一条 |

> 变异覆盖结论：四类必测变异中 **3 类（M1 / M3 / M4）有效**；**M2（价格带条件篡改）无效**，且进一步确认 `200-399-fallback`、`400-499-matched`、`400-499-fallback` 三条价格带规则**在 195 例单测与五条黄金用例中完全未被命中**。→ R3。

### 2.4 黄金回归脚本有效性

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 正常跑是否真通过 | **PASS** | 我复跑：五条全 PASS、G1=A、G5=C；退出码 0 |
| 缺环境变量是否**明确失败**（不静默跳过） | **PASS** | `env -u UOM_REFERENCE_ROOT` → stderr「缺少 UOM_REFERENCE_ROOT：请指向抖音参考数据根目录后重跑。」，**exit 1** |
| 参考目录不存在是否明确失败 | **PASS** | stderr「参考数据根目录不存在：/tmp/…」，**exit 1** |
| 期望值改错是否真失败并指出是哪条 | **PASS** | 见 M5 |
| 断言的五条与 `docs/match-calibration.md` 表格、`result.md` §6 是否逐字一致 | **PASS** | 逐条核对：G1 91.9 A→95.4 A / 92 / 0；G2 91.2 A→95.3 A / 95 / 0；G3 78.2 B→87.7 A / 93 / 0；G4 59.2 C→68.9 B / 68 / −4.0；G5 40.9 C→42.0 C / 32 / −10.5 —— 三处（脚本 / 口径文档 / result.md）**完全一致**，无差异 |
| 输入文件 SHA-256 是否可溯 | **PASS** | 我复跑所得 8 个哈希与 result.md §6 所列前缀**逐个一致**（`7673ffe9…` / `434f2d36…` / `0d784c74…` / `6d9ce17d…` / `05307272…` / `4a833e1b…` / `6cf8b6c4…` / `2c076e29…`） |

### 2.5 文档与实现一致性

| 文档主张 | 结论 | 实测 |
| --- | --- | --- |
| 195 例单测全过 | **PASS** | 195/195，0 失败 0 跳过 |
| 拆分「core 159 + 内核 18 + 工具1 18」 | **FAIL** | 实测 `npm test` 195 = **core 146**（`core.test` 41 + `index.test` 27 + `normalize.test` 60 + **`match.test` 18**）+ **tool1 18** + **data-mcp 31**。core 是 146 不是 159，data-mcp 的 31 例未列出 → S1（总数对、拆分错） |
| 「T1-02 单测逐值断言」 | **FAIL** | 单测只断言了 88 / 92 / 93 / 32 四个价格带值；95（<100）、70、90、58、68 无单测断言，且 200-399-fallback / 400-499 两条分支完全无覆盖 → R3 |
| 参考数据 78 单元、A 58 / B 19 / C 1、熔断 1 | **PASS** | 我独立统计 `match-results.json`：78 单元、A58/B19/C1、fuse 1、nullScore 0 |
| 六维明细（`match-calibration.md` §2） | **PASS** | 我独立复算五条的六维分，与文档表格**逐个数字一致**（见 §4） |
| `data/` 1×1 冒烟结论 | **PASS** | 实跑复现：`101526100201 × 1OCD7S0011 → 89.9 A`、缺价、清单 0 行、notes 记「199 个渠道无画像」 |
| 断网守卫自检 13 入口 / MCP 17 工具 9 就绪 8 not-ready 0 意外 0 出网 / 工具1 出网 0 次 | **PASS** | `npm run offline-check` 输出逐字复现 |
| `npm audit --audit-level=high` 0 漏洞 | **PASS** | found 0 vulnerabilities |
| 文档链接检查 | **PASS** | 79 条相对链接，错误 0，告警 0 |
| 数据守卫 | **PASS** | 「索引中无业务数据目录、数据文件或超大文件」 |
| CI 不跑黄金、不接触真实数据 | **PASS** | `.github/workflows/check.yml` 全文无 golden 步骤、无数据挂载 |
| 「旧口径在同一批数据上的 A 级占比明显更低」 | **NOT_PROVED** | 本轮只做了 5 条用例的新旧对照，**未跑全量 78 单元的旧口径对照**。属定性推断（依据「占位分 85/84 被真实维度替换」的机制分析），建议标注为推断 → S4 |

---

## 3. 发现清单

### 阻断（0 项）

**无。** 未发现违反四条硬约束红线的缺陷：没有第二份评分实现、没有占位分、没有业务数据进仓或出网、没有人工画像字段读取路径。

### 应修（4 项）

#### R1 —— UI 层存在评级/熔断阈值与评分公式的第二份硬编码（违反 T1-05、§9.1「不散落在代码里」）

- **位置**：`packages/tool1-channel-match/src/report/render.ts:23-30`（`heatClass` 的 `80 / 60 / 45`）、`:371-374`（图例文案 `≥ 80` / `60–79.9` / `45–59.9` / `< 45`）、`:391-394`（techBody 的 `0.60 × JS + 0.25 × 余弦 + 0.15 × Top3`、`[25, 99.5]`、`A ≥ 80 / B 60–79.9 / C < 60`、`< 45`）
- **现象**：该文件**未 import `MATCH_CONFIG`**（全仓 grep `MATCH_CONFIG` 只命中 `dataset/report.ts`、`demo/build.ts`）。阈值与公式以字面量写死，配置变更时不会同步。
- **复现（实测）**：把 `MATCH_CONFIG.grades` 改为 `{a: 85, b: 65}` 并重建、重新生成参考数据报告 →
  - 内核给 `109726101004 × live:森马Semir服饰号`（总分 **83.3**）判 **B** 级；
  - 但该单元格仍渲染为 `class="heat__cell heat__cell--a"`（A 级配色），HTML 片段实测：
    `<td class="heat__cell heat__cell--a" data-cell="109726101004::live:森马Semir服饰号" title="…：83.3">83</td>`
  - 同时页面「评分口径与维度权重」仍写「A ≥ 80，B 60–79.9，C < 60；C 级内 < 45 标记为熔断」。
  - 该区间在 78 单元里命中 **8 个**。
- **建议改法**：`render.ts` 从 `@uom/core` 导入 `MATCH_CONFIG`，`heatClass` 改用 `config.grades.a / config.grades.b / config.fuseThreshold`，图例与 `techBody` 的阈值、混合比例、裁剪区间一律由 `config.blend` / `config.clamp` / `config.grades` 渲染；补一条单测断言「热力图分档与 `MATCH_CONFIG.grades` 联动」。

#### R2 —— `site/web/assets/app.js` 仍保留整份权重/阈值/公式副本（仓库内第二份权重常量）

- **位置**：`site/web/assets/app.js:391-394`（公式 + 六维权重 `0.10/0.20/0.15/0.10/0.25/0.20` + 评级阈值 + 裁剪区间）、`:354`（`v >= 80` 计数与文案）、`:1007`（`v >= 80 ? 'A 级' : v >= 60 ? 'B 级' : v >= 45 ? 'C 级'` 前端分级）
- **现象**：这是 P0 工作台的遗留文案（本次候选只改了 1 行入口链接），但 **P1 正是确立 `MATCH_CONFIG` 为唯一来源的轮次**，全仓因此存在第二份权重常量（用户的 grep 判据会命中）。站点是已发布的公开页面，权重一旦变更，站点口径会与内核静默分叉。
- **复现（实测）**：`grep -n "0\.10\|0\.25" site/web/assets/app.js` 命中 `:393`；`grep -n "MATCH_CONFIG" site/web/assets/app.js` 无命中。
- **建议改法**：把该折叠区改为由 `packages/core/src/match/config.ts` 生成（构建期注入或改为链接到工具1 报告页的口径说明），并在页面上标注「正式口径以 `packages/core` 的 `MATCH_CONFIG`（版本 `p1-2026-11-uncalibrated`）为准」；删除 `:1007` 的前端硬编码分级或注明它只作用于合成演示数。

#### R3 —— 价格带两条分支零覆盖，篡改不被任何测试或黄金用例抓住

- **位置**：`packages/core/src/match/config.ts:133-140`（`200-399-fallback` score 70 / penalty −3.0）、`:142-159`（`400-499-matched` 90、`400-499-fallback` 58 / −6.5）；覆盖缺口在 `packages/core/test/match.test.ts`（只用到价格 199 / 318.69 / 626.83）
- **现象**：三条规则在 195 例单测与五条黄金用例中**从未被命中**（黄金五条的价格带命中的是 `under-100` / `100-199` / `200-399-matched` / `500-matched` / `500-fallback` / `500-break`）。
- **复现（实测）**：
  - 变异 `config.ts:127` `0.28 → 0.05` → `npm test` 195/195 PASS、黄金 PASS；
  - 变异 `config.ts:138-139` `score 70 → 30`、`penalty −3 → −9` → 195/195 PASS、黄金 PASS；
  - 变异 `config.ts:147` `score 90 → 55` → 195/195 PASS、黄金 PASS。
  - 即：**价格带判定条件被篡改且不被发现**。
- **附带影响**：`openspec/changes/tool1-match-kernel/result.md:79`「T1-02 公式与参数 PASS｜与讨论稿 §7.4 一致；**单测逐值断言**」不成立。
- **建议改法**：在 `match.test.ts` 补 3 条断言：①价格 318.69 + 渠道高消 10%（低消 20%）→ 维度分 70、penalty −3、bandId `200-399-fallback`；②价格 450 + 高消 40% → 90、`400-499-matched`；③价格 450 + 高消 10% → 58、penalty −6.5、`400-499-fallback`。同时在 result.md 把「单测逐值断言」改为与事实相符的措辞。

#### R4 —— 输出目录守卫未覆盖仓库跟踪路径（spec §7.5 未实现）

- **位置**：`packages/tool1-channel-match/src/bin.ts:117-129`（`assertNotDataSource`）
- **现象**：规格 §7.5 要求「写操作只落 `--out` 指定目录，**拒绝写到数据源目录或仓库跟踪路径（`packages/`、`site/`、`docs/`）**」。实现只拦 `data/`（且 `data/reports/` 放行），**未拦 `packages/`、`site/`、`docs/`**。
- **复现（实测）**：
  - `node packages/tool1-channel-match/dist/src/bin.js --demo --out packages/tmp-guard-check/x.html` → **写盘成功，exit 0**（实测产物落盘，已手工删除，工作区已复验 clean）；
  - `--demo --out data/tmp-guard-check/x.html` → 被拒（「拒绝写入数据源目录」），说明 `data/` 分支有效、其余路径无守卫。
  - 风险路径：`--dataset reference --out packages/…` 会把**真实业务报告**写进 git 跟踪目录，存在误提交风险（当前尚未发生）。
- **建议改法**：把守卫扩到 `packages/`、`site/`、`docs/`、`openspec/`、`output/`（`--demo` 的默认输出 `site/web/tool1-report.html` 走显式白名单），并补一条单测。

### 建议（5 项）

| # | 位置 | 现象 / 建议 |
| --- | --- | --- |
| **S1** | `openspec/changes/tool1-match-kernel/result.md:100` | 「195 例全过（**core 159** + 内核 18 + 工具1 18）」拆分错误。实测 195 = core 146（含内核 18）+ tool1 18 + **data-mcp 31**。总数正确，拆分里的 159 是基线期的全量数（见 spec §2.1）被误标成 core，且漏列 data-mcp 31。建议改为「core 146（含内核 18）+ 工具1 18 + data-mcp 31 = 195」。提交信息里的「新增内核 18 + 工具1 18」表述无误。 |
| **S2** | `site/web/tool1-report.html` | 用当前代码重新生成 Demo 后与已提交版本 diff **差一段 CSS**（`.report__banner--local` 共 4 行，已提交版缺失）。功能无差异（该类只用于本地数据横幅，Demo 不触发），但「Demo 与正式同源」的可复现性不完全。建议在交付前重新生成并提交，或注明生成命令与代码版本。 |
| **S3** | `scripts/golden-tool1.mjs:14` | 头注释称「本文件含款号与店铺名…**不含任何业务数值明细**」，但 `CASES[].label` 内嵌了单价（¥318.69 / ¥85.95 / ¥626.83）与旧分（91.9 / 91.2 / 78.2 / 59.2 / 40.9）。**如实评价**：这些是**聚合派生量**（单品均价与 0–100 匹配分），不含零售额/零售量/UV/退货率等经营明细；且两条锚点的价与旧分早在 P0 就已随 `docs/engineering-workflow.md` §4.3 进入公开仓库。因此**可接受**，但注释措辞与事实不符，建议改为「只含标识符与聚合评分，不含经营明细」，以免后续复核误判为越界。 |
| **S4** | `openspec/changes/tool1-match-kernel/result.md:151` | 「旧口径在同一批数据上的 A 级占比明显更低」**未实测**——本轮只跑了 5 条用例的新旧对照，未跑全量 78 单元旧口径。该结论方向与 §3 的机制分析一致，但属推断。建议标注为「推断，未实测」，或补一次全量旧口径对照。 |
| **S5** | `data/README.md:100-110` | 含格式示例数值（如 `预测性别,男,39.26%,90.62089851674344`），实体名已脱敏为「森马某店」。属 P0 遗留、非本候选引入，仅作观察记录。 |

---

## 4. 复核者独立算出的关键数值

### 4.1 五条黄金用例的独立复算（不调用被测实现）

方法：自写脚本（`/tmp/recompute-all.mjs`）**不使用 `@uom/core` 的任何函数**——自己解析原始 CSV、自己写六维投影表、自己实现 JS 距离／余弦／Top3 重合度／价格带判定／加权与裁剪，只按 `docs/match-kernel.md` 的公式与权重计算。价格按「零售额 ÷ 零售量」从 `TOP20商品/商品数据表.csv` 现算。

| 用例 | 单价（零售额÷零售量） | 渠道高消/低消 | 命中价格带 | 性别 | 年龄段 | 消费能力 | 城市等级 | 策略人群 | 人生阶段 | 加权分 | 惩罚 | **我的总分/评级** | 期望 | 一致 |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | :-: |
| G1 | 3097064.78 ÷ 9718 = **318.69** | 35.19% / 33.47% | 200-399-matched | 99.5 | 98.7 | 92 | 91.1 | 92.0 | 99.0 | 95.400000 | 0 | **95.4 A** | 95.4 A | ✅ |
| G2 | 85.95 | 40.00% / 29.45% | under-100 | 96.4 | 91.2 | 95 | 97.7 | 97.6 | 95.2 | — | 0 | **95.3 A** | 95.3 A | ✅ |
| G3 | 626.83 | 40.00% / 29.45% | 500-matched | 97.2 | 81.2 | 93 | 94.4 | 84.7 | 85.9 | — | 0 | **87.7 A** | 87.7 A | ✅ |
| G4 | 626.83 | 31.84% / 38.40% | 500-fallback | 91.0 | 64.2 | 68 | 87.8 | 70.2 | 72.1 | — | −4.0 | **68.9 B** | 68.9 B | ✅ |
| G5 | 626.83 | 17.84% / 55.63% | 500-break | 85.1 | 42.2 | 32 | 86.1 | 52.0 | 45.9 | — | −10.5 | **42.0 C** | 42.0 C | ✅ |

**结论**：我的独立复算与内核输出、黄金基线、`docs/match-calibration.md` §2 的六维明细表**三方逐字一致**（含 G1 的 `js=0.992251 / cos=0.999997 / top3=1.0` 等中间量级）。这同时证明：单维度公式、加权与归一化、价格带判定、惩罚、裁剪、评级**全部按文档口径正确实现**。

### 4.2 我实测的评级分布与作者自述的差异

| 项 | 作者自述（result.md §7） | 我的实测 | 差异 |
| --- | --- | --- | --- |
| 评分单元 | 78（13 × 6） | 78 | 无 |
| 评级分布 | A 58 / B 19 / C 1 | **A 58 / B 19 / C 1** | 无 |
| 熔断 | 1 | 1 | 无 |
| 口径标记 | 单品画像无月份 78 / 缺价 0 / 区间渠道 0 | `productMonthUnknown=78`，`priceMissing=0`，`channelApproximate=0` | 无 |
| 错配清单行数 | 78 | 78（+表头 79 行，含 BOM `efbbbf`） | 无 |
| `data/` 可关联渠道 | 1（200 中仅 1） | 1（notes：199 个渠道在 2024-01 无画像） | 无 |
| `data/` 可评分单元 | `101526100201 × 1OCD7S0011 → 89.9 A` | `101526100201 × 1OCD7S0011 → 89.9 A`，`spending_power:price-missing` | 无 |
| `data/` 错配清单 | 0 行 | 0 行（notes：未进入错配排序的单元 1 个） | 无 |
| 黄金输入 SHA-256 | 8 个前缀 | 8 个完整哈希，前缀逐个一致 | 无 |

**结论：作者自述的所有可核对数字与实跑完全一致，未发现「声称已做但数字对不上」的情况。** 唯一的表述性偏差是 S1（测试数拆分）与 S4（旧口径全量对比未实测）。

### 4.3 我独立测出的、文档未记载的数值

| 观察 | 数值 | 说明 |
| --- | --- | --- |
| A 级占比 | 58/78 = **74.4%** | 与 result.md「74%」一致；评级区分度偏弱属实（留待 Q4） |
| 阈值分叉影响面 | 78 单元中 **8 个**（10.3%）落在 [80,85) | 若把 `grades.a` 调到 85，这 8 个单元会出现「内核评 B、热力图涂 A 级配色」的错配（R1 的影响量级） |
| 价格带规则覆盖率 | 9 条规则中被命中 **6 条**；`200-399-fallback`、`400-499-matched`、`400-499-fallback` **3 条零覆盖** | R3 |
| 站点工作台页与工具1 报告页的口径副本 | `site/web/assets/app.js` 有 **1 份**权重全表 + **3 处**阈值 + **1 处**公式 | R2 |
| Demo 产物与当前渲染器的差异 | **1 段 CSS（4 行）** | S2 |

---

## 5. 未验证项与建议

1. **本报告不代替 P1 阶段门禁（工程规范 §4.6）**。P1 门禁的三条是「六个匹配维度全部真实计算（无占位分）；黄金用例通过；错配清单可出」——就这三条而言证据是充分的（变异 M1 证明无占位分、黄金本地 PASS、清单可出），但**门禁的通过判定权在流程，不在本报告**。
2. **本报告不代替规范 §5.3 的专项最终检查**（实际职责、复用依据、最少用户操作路径）。我只核了「工具1 是否只消费内核」「是否复用既有相似度函数」「是否复用 `buildIndex`」；**「最少用户操作路径」「复用第三方 SDK 的依据」未逐项核对**。
3. **本报告不代替 CI**。CI 未在本候选上运行（未开 PR），本地等价命令已全跑并复现。
4. **本报告不代替产品验收**。看板形态、交互体验、错配清单的业务可用性属产品判断；我只做了浏览器层的机械验证（抽屉、转置、主题、420px 无溢出、零外网、零控制台错误）。
5. **「用户已审核 UI」是仓库外事实**，本报告记为 NOT_PROVED，不据此判 PASS。
6. **R1/R2/R3/R4 建议在合并前处理**（R3 会让 T1-02/T1-05 的表述继续失真；R1/R2 是硬约束「评分参数单一来源」的落地缺口；R4 是数据边界守卫的实际缺口）。若决定延后处理，请在 `result.md` 明确记录为已知缺口并写明后续轮次归属。
7. **建议补一次全量旧口径对照**（78 单元），使 result.md §7 的「旧口径 A 级占比明显更低」从推断升为实测（S4）。

---

## 6. 结论

**建议合并**，但**有条件**：先处理 R3（价格带分支零覆盖，且 result.md 的「单测逐值断言」表述与事实不符）与 R1/R2（评分参数在 UI 层的第二份副本，直接触及 T1-05 与 §9.1 的字面要求）；R4（输出路径守卫）建议在同一轮补齐，因为它关系到「业务数据不出网」的可执行性。

理由：

- **核心实现可信**：五条黄金用例由我**独立重算**（不调用被测实现）逐字复现；评分公式、权重、价格带、惩罚、裁剪、评级均按 `docs/match-kernel.md` 正确落地；无占位分、无第二份评分实现、无业务数据进仓或出网。
- **测试有效性部分成立**：四类必测变异中三类被有效抓住；价格带条件篡改一类**不被抓住**，是本轮最实质的质量缺口（但它不影响当前基线正确性——基线已被我独立复算验证）。
- **发现的问题均为「应修」而非「阻断」**：4 项应修 + 5 项建议，无红线违反。

若团队选择先合再修，请在 `openspec/changes/tool1-match-kernel/result.md` 补记 R1–R4 的归属与后续轮次，并更正 result.md 中「core 159」「单测逐值断言」两处表述。

---

*复核者未参与候选任何实现；未提交、未推送任何改动；变异实验全部经备份覆盖还原并 md5 校验；复核结束时 `git status` 干净、`git diff` 为空、`npm test` 195/195 通过、黄金回归 PASS。*
