# 切片 A · 时间与选择语义（底座重构 1/6）

> 状态：**已授权起草并发单**（用户 2026-11-28 对 `docs/architecture-review-v1.md` §7 的 R-1～R-10 回复「按建议」）。
> 依据裁决：**R-2** 档案按月份展开（升 schemaVersion）、**R-3** 标签口径听归一化规则 §5.5（只比公共标签）、**R-7** 年份记成全年区间并标近似、**R-9** 先做切片 A。
> 上游：`docs/architecture-review-v1.md` §4.1（A1–A7）、§4.3（C2、C5）、§6 切片 A、附录 B。

## 任务目标执行清单

**本轮目标**：让月份成为一等公民，歧义不再静默；落实 R-2／R-3／R-7。

**预期交付**：`packages/core/src/period/`；时间感知的商品档案与索引；带命中方式的画像选择（core 一处实现，MCP 与工具1 共用）；相似度只比公共标签；真实成交单价解析单一来源；相关测试与文档。黄金用例与 P2 冻结数字不变。

| # | 阶段 | 任务 | 完成条件 |
| --- | --- | --- | --- |
| 1 | 期间模型 | 新建 `period/`：期间解析、覆盖判定、平台优先级；收编 `match/month.ts` 与工具1 的画像挑选 | SA-01 全过；`match/month.ts` 与工具1 重复实现删除 |
| 2 | 画像选择 | `selectPortrait` + MCP／工具1 改用；同月多平台显式消歧 | SA-02、SA-03 全过；工具1 黄金不变 |
| 3 | 档案时间序列 | 经营指标／漏斗／渠道成交按月存取；`schemaVersion` 升版；单价解析单一来源 | SA-04、SA-05、SA-08 全过 |
| 4 | 标签口径 | 相似度、差异、相似款、内核全部改为公共标签 | SA-06 全过；黄金 G1–G5 数字不变 |
| 5 | 接口与文档 | MCP 参数与错误同步；三份口径文档更新 | SA-07、SA-09、SA-10 全过 |
| 6 | 收尾 | 全量检查、等价证据、结果记录 | SA-11、SA-12 全过；`result.md` 逐项状态如实 |

## 完整可观察结果

1. **年导出不再伪装成 1 月**：`2024_演示店_天猫.xlsx` 的画像月份标签为 `2024-01~2024-12`，期间类型 `year`（近似）。
2. **同一款有多个月份画像时不再静默变「没有」**（以 `2026-09`、`2026-10` 两份为例）：
   - `get_product_dossier({ spu, month: "2026-10" })` 返回覆盖该月的画像、该月的经营指标／漏斗／渠道成交；不传 `month` 时返回全部月份（按月键控）；
   - `search_similar_products({ spu, month: "2026-10" })` 用该月画像计算；不传 `month` 且该款有多份画像时返回 `ambiguous` 并列出可用月份，**不再退化成只比属性**；
   - `get_portrait_aggregate({ level, key, month: "2026-10" })` 只聚合各成员覆盖该月的画像；不传 `month` 且成员有多份画像时返回 `ambiguous`；
   - `search_by_tag` 新增可选 `month`，命中结果带匹配方式。
3. **同月多平台不再按平台名偷选**：MCP 查询返回 `ambiguous` 并列出平台，新增可选 `platform` 参数消歧；工具1 批量取用按显式优先级（抖音＞天猫＞京东，其余按名称序）并在报告 notes 写明取用了多少个。
4. **跨平台比较只看公共标签**：商品性别 `{男: 0.6, 女: 0.4}` 对渠道 `{男: 0.6, 未知: 0.4}`，性别维度分为 100，证据里列出被排除的单侧标签；两侧没有公共标签时该维度不可用（原因 `no-common-labels`），不参与加权。`compare_product_channel`、`search_similar_products` 与内核同一口径。
5. **指标不再塌缩**：同款多个月的经营指标全部保留并各带月份；漏斗按「月份 × 阶段」存放，同阶段不重复；索引 `months` 汇总画像、经营指标、漏斗、商品↔渠道四类来源的月份。
6. **单价只有一处推导**：`resolveUnitPrice(product, month?)` 是唯一实现，索引构建与工具1 都调它。

## 验收标识

| 标识 | 内容 |
| --- | --- |
| **SA-01** | `parsePeriod`：`2026-10`→month；`2025-07~2026-06`→window；`2024`→`{kind: year, label: "2024-01~2024-12"}`；空串→unknown；`2026-13`→unknown。`periodCovers`：单月须相等；区间／年须起止之间；unknown 不覆盖任何月。年标签由 `normalize/*Portrait` 写入画像（`period` 字段，`month` 与之同步） |
| **SA-02** | `selectPortrait(index, { entityType, entityIds, month?, platform? })` 返回 `found{portrait, match: exact｜window｜year｜unknown}`、`not-found` 或 `ambiguous{reason: month｜platform, months, platforms}`。不带 `month`：恰一份→found；多份→ambiguous(month)。带 `month`：按 exact＞window＞year＞unknown 取最优一层；该层仅一份→found；多份且平台不同→未给 `platform` 时 ambiguous(platform)，给了则取该平台；多份同平台（重复文件）取索引顺序首份。**任何情况不回退到相邻月份** |
| **SA-03** | MCP：`get_channel_portrait`／`get_product_portrait`／`compare_product_channel`（`productPlatform?`、`channelPlatform?`）／`get_product_dossier`／`search_similar_products`／`get_portrait_aggregate`／`search_by_tag` 支持 `month?`；多平台歧义返回 `ambiguous`，message 列出平台、hint 提示传 `platform`。工具1：`data-root` 与 `reference` 两条数据路径改用 `selectPortrait`，多平台取用按 `PLATFORM_PREFERENCE` 并在 notes 写明 |
| **SA-04** | `ProductDossier.schemaVersion === "0.2.0"`；`performance` 为 `Record<月份, PerformanceMetrics>`；`funnel` 为 `Record<月份, Record<阶段, 指标>>`；`channelPerformance` 为 `Record<渠道, Record<月份, 成交>>`。源行月份为空时归入键 `unknown`。多月份无任何丢弃，不再产生「档案取最新月份」问题记录 |
| **SA-05** | `get_product_dossier({ spu, month? })`：带 `month` 时画像（`portraits: [{ month, platform, projections }]`）、指标、漏斗、渠道成交只含覆盖该月的；该月四类数据都没有时返回 `month-mismatch` 并列出可用月份；不带 `month` 返回全部。原单数 `portrait` 字段移除 |
| **SA-06** | 相似度：JS、余弦、Top3 重合度都在**公共标签的重归一化分布**上计算；`MatchDimensionEvidence` 与 `DimensionDiff` 增加 `excludedProductLabels`、`excludedChannelLabels`；无公共标签→维度不可用（`MissingReason` 增 `no-common-labels`）。`MATCH_CONFIG.version` 递增并在口径文档说明来源（技术修复，非数据校准，仍记「未校准」） |
| **SA-07** | 工具1 报告 notes 写明多平台取用数量；`mcp-usage.md`、`normalize-rules.md`（§2.1 年份行、§5.5 实现说明、§12.9 按月存取）、`match-kernel.md`（配置版本、缺失语义、检查命令的用例数）、`match-calibration.md`（§6 标签口径）与实现一致，由文档链接检查与逐条对照确认 |
| **SA-08** | `resolveUnitPrice(product, month?)`：有该月经营指标且零售额、零售量均 > 0 → `retail-amount-qty`；否则主数据 `actualUnitPrice` → `actual-unit-price`；否则 `unitPrice` → `unit-price`；否则 `missing`。索引构建不再把按月指标写回 `price`；工具1 `data-root` 与错配排序的零售额都走它（该月指标优先，其次主数据） |
| **SA-09** | `index.months` 为四类来源月份的并集（区间标签按字面保留，与现状一致）；core 提供 `availableMonths(index, entityType, entityIds)`，工具1 `indexMonths` 改为调用它 |
| **SA-10** | 既有行为保持：缺月不回退；`insufficient-dimensions`；价格缺失不插补；`data-not-ready` 探测与处理器一致性守卫不变；背对背字段（`predictionAttributes`／`comparisonOnly`）零改动且原测试全过 |
| **SA-11** | 全量检查：`npm run check` 全过；`UOM_REFERENCE_ROOT=… npm run test:golden` PASS 且 G1–G5 五个新总分与冻结基线逐字一致；`UOM_ARCHIVE_FIXED_ROOT=<主仓>/data/archive-modelevol/v04-holdout npm run test:fidelity-v04` PASS 且两组冻结数字逐位不变；`npm run check:archive-content`、`python3 .github/scripts/check-docs-links.py .`、`python3 .github/scripts/check-data-guard.py .` 全过 |
| **SA-12** | 等价证据：工具1 合成演示报告在改动前后各生成一次，`match-results.json` 除 `generatedAt` 与 `configVersion` 外逐字节一致；证据存 `.local/slice-a/equiv/` |

## 范围与不做事项

**做**：SA-01～SA-12。

**不做**（归后续切片，发现相关问题只记录不修）：

| 不做 | 归属 |
| --- | --- |
| 身份解析、未关联画像提示、数据健康视图、来源目录、issue 聚合、文件级 fail-closed | 切片 B |
| 商品主表 SKU 级口径与模板说明（R-5） | 切片 B |
| 服务层、工具注册表、匹配编排、新增 MCP 工具 | 切片 C |
| 工作台服务与 UI、工具2 消费链路、评审与报表 | 切片 D–F |
| README、产品讨论稿升版、`docs/architecture-review-v1.md` 入库 | 独立文档变更（R-10） |
| 内核公式、权重、价格带、评级阈值、熔断阈值 | 不动（仅 SA-06 的标签集合口径） |
| `packages/core/src/model/**`、`packages/tool2-portrait-predict/**`、`scripts/**`、`.github/**`、`templates/**`、`site/**`、根 `package.json` | 不改；不新增依赖 |

## 允许修改路径

```
packages/core/src/period/**                 # 新建
packages/core/src/index/**                  # build.ts / query.ts / types.ts
packages/core/src/match/**                  # month.ts 删除并迁入 period/；kernel.ts、types.ts 仅 SA-06 相关；新增 portrait-input.ts、price.ts
packages/core/src/product/**                # types.ts（schemaVersion 与按月结构）
packages/core/src/normalize/**              # identity.ts 年份、index.ts finalizePortrait 写 period；其余仅在编译必需时
packages/core/src/index.ts                  # 导出更新
packages/core/test/**
packages/data-mcp/src/**  packages/data-mcp/test/**
packages/tool1-channel-match/src/**  packages/tool1-channel-match/test/**
docs/normalize-rules.md  docs/match-kernel.md  docs/match-calibration.md  docs/mcp-usage.md
openspec/changes/foundation-period-model/**
```

## 关键边界

- **内核唯一**：评分公式与参数不动；黄金用例是回归锚，数字必须逐字一致。参考数据矩阵两侧标签集合完全相同（78 个组合实测），公共标签口径不应改变任何黄金数字；若实跑有变，**停止并报告**，不得调参凑数。
- **背对背**：`predictionAttributes`／`comparisonOnly` 及其测试零改动。
- **模型可溯**：P2 冻结数字与 `packages/core/src/model/**` 零改动；fidelity 门禁必须复跑。
- **数据不出网**：不新增依赖；业务数据不入库；主工作树 `data/` 下的真实业务数据**不得读取、复制、修改**（唯一例外 `data/README.md`）；黄金与 fidelity 只读各自固定的参考／归档目录。
- **TDD**：每条验收先有能检出目标行为错误的真实 RED，再最小 GREEN；RED／GREEN 日志落 `.local/slice-a/`。环境、导入、fixture 失败不算 RED。
- **测试改动**：删除或改写既有断言须在 `result.md` 说明覆盖如何保留；不得靠削弱断言变绿。

## 适用检查计划

`npm run check`、`npm run test:golden`、`npm run test:fidelity-v04`、`npm run check:archive-content`、`.github/scripts/check-docs-links.py`、`.github/scripts/check-data-guard.py`、SA-12 演示报告等价比对；`packages/core/test/data-templates.test.ts`（随 `npm run check` 运行，锁定 `data/README.md` 与代码契约逐字一致）必须仍过。`npm run offline-check` 在无数据工作树预期失败，记 `NOT_RUN` 并写明原因，不拷数据变绿。

## 未决问题（不阻塞开工，用户可否决；否决则按新口径另起修单）

| # | 事项 | 本规格取法 |
| --- | --- | --- |
| U1 | 同月多平台在 MCP 里由「按平台名取一份」改为 `ambiguous` | 取 `ambiguous` + `platform` 参数（「歧义不再静默」的直接落实） |
| U2 | Top3 重合度是否也只在公共标签上算 | 是（R-3 的直接推论；否则单侧标签会占掉 Top3 名额、人为压低重合度） |
| U3 | 源行月份为空的指标／漏斗如何归档 | 归入 `unknown` 键，使用方按静态事实处理 |
| U4 | 内核配置版本号 | 递增为 `sa-2026-11-common-labels-uncalibrated` |
| U5 | `get_product_dossier` 的画像形态 | 由单个 `portrait` 改为 `portraits` 数组（全部月份或指定月） |
| U6 | 站点里的合成演示报告 `site/web/tool1-report.html` 是否重新生成 | 不重新生成（避免无关 diff）；路径不在允许修改范围内 |

## v0.2（2026-11-28 验收修正）

主 agent 验收实测发现三处与实现不一致，修正如下（只追加，不改上方原文）：

- **SA-12 判据修正**：「`match-results.json` 除 `generatedAt` 与 `configVersion` 外逐字节一致」对演示报告不成立——SA-06 把相似度改为只在公共标签的重归一化分布上计算后，合成演示数据里商品与渠道的策略人群标签集合本就不同，且 `configVersion` 随 SA-06 递增，逐字节一致与 SA-06 直接相抵触。判据改为**「不变或逐单元可解释」**：重新生成演示报告入库，由可重复比对脚本（`packages/tool1-channel-match/scripts/demo-equivalence.mjs`）证明 48 单元中 28 不变、20 变化且全部只有 `strategy_segment` 一维、每个变化维度都带被排除的单侧标签（0 个无法解释）。
- **U6 反转**：「站点演示报告不重新生成」改为「重新生成并入库」——理由同上：SA-06 落地后入库报告已与内核口径不一致，口径一致优先于避免 diff（`site/web/tool1-report.html` 本次允许改）。
- **SA-03 增补「`month` 入参校验」与「`list_channels` 覆盖规则」**：验收实测发现 `selectPortrait` 把区间标签（如 `2024-07~2025-06`）当 `month` 也按重叠匹配放行、`2026-13` 只是静默返回 `not-found`，与规格中 `month` 的自然月（`YYYY-MM`）定义不符；`list_channels({ month })` 用标签字面相等，导致区间／年份画像永远匹配不上任何自然月。修正：非法 `month` 显式拒绝（core 返回 `invalid-month`、MCP 返回 `invalid-argument`、工具1 命令行非零退出且不生成产物），`list_channels` 改用与 `selectPortrait` 同源的覆盖规则（exact＞window＞year＞unknown）判断「该月有画像」。

## v0.3（2026-11-28 独立复核后修正）

独立复核（`.local/review-slice-a/review.md`，结论 PASS 附带条件）后由主 agent 发单修正，只追加，不改上方原文。逐条理由：

- **允许路径增 `packages/core/src/portrait/types.ts`**：SA-01 把期间写进画像必需该类型上的可选 `period` 字段，属类型级必需改动，原清单遗漏（复核应修-6a），本次追认。
- **SA-04 扩展到渠道经营指标按月**：R-2「档案按月份展开」渠道侧不能例外，`ChannelRecord.performance` 同步改为 `Record<月份, …>`、空月归 `unknown`（复核建议 3 升级为应修）。
- **`month` 校验覆盖所有接受该参数的工具**：`get_brand_portrait`、`get_competitor_portrait`、`get_recency_distribution`、`get_channel_flow_matrix`、`get_diagnosis` 一并先校验再查数据（复核应修-6b；`get_retention_cohort.cohortMonth` 参数名非 month、语义不同，仍不纳入，见 result.md 偏差）。
- **`get_competitor_portrait` 的 month 改为与其它工具同源的覆盖规则**：年份标签改为全年区间后，字面相等使该工具永远无法用 month 命中年份画像；无月份竞品画像作为最低层保留并标 `match: "unknown"`（复核应修-6b／建议 10 的该工具部分）。
- **`parsePeriod` 的 YYMM 优先于四位年份**：归一化规则 §2.1 规定 `2610`→`2026-10`，四位数字先按 YYMM 解（月份 01–12 合法才算），否则按四位年份解且年份限定 1900–2100；`periodCovers` 对非自然月入参一律 false（复核建议 9）。
- **无月份画像在各工具间统一为「最低层可用」**：与 `selectPortrait`／`list_channels` 同口径，带 month 的 `get_product_dossier`／`search_by_tag`／`get_portrait_aggregate`／`get_competitor_portrait` 不再把无月份画像排除，命中带 `match: "unknown"`（复核建议 2 升级为应修；同一款此前会出现 portrait 有结果而 dossier 报 month-mismatch）。
- **歧义与缺失提示的可用期间不得是入参校验拒绝的值**：hint 按 `selection.reason` 分支（平台歧义提示传 platform），单月标签直接列为可用月份，区间／年份标签写「须为落在该期间内的自然月」（复核应修-1、应修-2）。
- **`platform: ''` 视为未指定、带首尾空白的 `month` 按规范月查找**：core 公共 API 与 MCP 层判定一致（复核应修-3、应修-4）。
