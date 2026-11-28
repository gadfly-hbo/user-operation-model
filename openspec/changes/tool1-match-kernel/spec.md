# Tool1-Match-Kernel

P1 阶段规格：工具1 共享匹配内核 + 六维评分 + 静态看板 + 错配清单

> 状态：**待用户确认**。本规格为规范 §4.1 要求的变更规格，确认后才开始实现。
> 相关：[工程规范](../../../docs/engineering-workflow.md) · [产品讨论稿 v0.1](../../../docs/产品讨论稿-v0.2.md) · [P0 实施记录](../data-mcp-core/result.md) · [UI 设计说明](../../../docs/ui-design.md)

---

## 1. 目标、授权与本轮交付

### 目标

交付 P1 工具1，并满足阶段门禁（规范 §4.6）：**六个匹配维度全部真实计算（无占位分）；黄金用例通过；错配清单可出**。

匹配内核实现于 `packages/core`，**工具1 与后续工具2 共用同一实现**（D1）。本轮只做事实画像入口；预测画像入口属 P2。

### 本轮交付

| 交付物 | 说明 |
| --- | --- |
| 共享匹配内核 | `packages/core/src/match/`：单维度评分、缺维度重归一化、客单承接、综合分、评级、正负向驱动 |
| 评分配置单一来源 | 权重、评分混合比例、价格带规则、评级与熔断阈值、裁剪区间全部集中一处，带加载校验 |
| 数据集适配 | `data/` 正式路径；抖音参考数据只读适配（不复制、不改三方资产），产出同一 `MatchDataset` |
| 静态看板 | 商品 × 渠道匹配矩阵 + 单元格明细抽屉，自包含 HTML，沿用 `site/web` 设计系统 |
| 错配清单 | 按 `零售额 × (1 - 匹配分/100)` 降序，输出优先级与依据，可导出 CSV |
| 黄金回归 | 五条抖音基准用例的新基线冻结 + 新旧对照 + 口径变化说明（本地真实数据运行，CI 不跑） |
| 合成数据 UI Demo | 与正式模板同源，先交用户审核（规范 §4.1），审核通过后才接真实数据 |
| 使用说明与记录 | `docs/match-kernel.md`、本变更 `result.md` |

### 本轮已确认决策（2026-11-27）

| 决策 | 结论 |
| --- | --- |
| 黄金用例口径 | **同评级 + 冻结新基线**：两条锚点保持 A／C；五条新值冻结为 P1 回归基线；B→A、C→B 两处评级上移写入口径报告 |
| 真实数据验收 | **只读适配抖音参考数据**：不复制、不改三方资产；`data/` 正式路径待用户补多渠道数据后使用 |
| 交付形态（Q5） | **静态自包含 HTML + CSV**：无端口、无外网；不做本地服务 |
| 权重校准（Q4） | **冻结初值**：无成交与售罄率数据，NDCG 正匹配口径无法计算；只记「已调整（未校准）」，不标「已优化」 |
| Excel（Q6） | P1 不做 Excel；错配清单导出 CSV，Excel 留待 P3 报表统一决定 |

### 开工依据

- P0 门禁经独立复核：归一化规则文档完成、真实数据可经 MCP 返回、`compare_product_channel` 与 `search_by_tag` 可用；但 **DM12 跨渠道对比只有 1 组样本，P0 门禁属「局部通过」**，不得表述为全量通过。
- 用户于 2026-11-27 明确要求从 P0 收尾进入 P1，并确认上述四项决策。

---

## 2. 固定基线与当前事实

### 2.1 仓库基线

- 基线：`main` @ `d747e86`（PR #2 合并后），工作区干净
- `npm run build` 通过；`npm test` **159 例**全过；`npm run offline-check` 断网守卫通过
- 已有可复用实现：`packages/core/src/index/similarity.ts` 的 `toDistribution`／`jensenShannonDivergence`／`jensenShannonDistance`／`cosineSimilarity`／`topOverlap`／`topLabels`；`packages/core/src/index/query.ts` 的索引查询原语
- 可复用设计系统：`site/web/assets/base.css` 的 `--site-*` 变量与 `.ledger`／`.heat`／`.drawer`／`.panel`／`.tech` 等组件类；站点数据为合成演示，不接真实数据

### 2.2 数据事实（只写聚合计数，不写业务明细）

| 数据集 | 现状 | 对 P1 的含义 |
| --- | --- | --- |
| `data/` 正式路径 | 1 个渠道实体（6 份画像导出）＋ 1 份单品画像；商品与渠道只有主数据，无经营指标 | 可做 1×1 冒烟；**不能作为多渠道路径验收** |
| 抖音参考数据（`~/工作/抖音货渠匹配/product/数据输入`） | 6 个渠道实体（直播 4／商品卡 1／短视频 1）× 月度画像；13 款单品画像；100 款商品经营指标（含零售额／零售量／毛利率／退货率／UV） | **P1 真实数据验收与黄金回归使用此数据集**；只读，不复制 |
| 六维覆盖 | 商品与渠道两侧的六个统一维度均可投影（性别 2／年龄 5／策略人群 8／消费能力 3／城市等级 6／人生阶段 3 个标签） | 六维真实计算在数据上可行 |

### 2.3 旧黄金用例与新公式的试算事实
工程规范 §4.3 与讨论稿附录 B 记录的五条抖音用例，其旧分来自 L1 距离公式，且地域同频／品类共振是写死的 85／84。按讨论稿 §7.4 新公式（JS 60% + 余弦 25% + Top3 15%，城市等级与人生阶段替换占位分）在 2026-10 切片上试算：

| # | 用例（2026-10） | 旧总分／评级 | 新公式试算／评级 | 客单分／惩罚（新旧应一致） |
| --- | --- | --- | --- | --- |
| 1 | ¥318.69 短羽绒 @ 直播账号 A | 91.9 A | 95.4 A | 92 / 0 |
| 2 | ¥85.95 卫衣 @ 直播账号 B | 91.2 A | 95.3 A | 95 / 0 |
| 3 | ¥626.83 长羽绒 @ 直播账号 B | 78.2 B | 87.7 A | 93 / 0 |
| 4 | ¥626.83 长羽绒 @ 商品卡店铺 B | 59.2 C | 68.9 B | 68 / -4.0 |
| 5 | ¥626.83 长羽绒 @ 直播账号 C | 40.9 C | 42.0 C | 32 / -10.5 |

**结论**：

- 两条锚点（#1、#5）评级保持 A／C；五条用例的客单承接维度与惩罚与旧工具**逐条一致**，证明输入管线（画像归一化、价格核算、消费能力标签）忠实。
- #3 由 B 升 A、#4 由 C 升 B：来自「城市等级、人生阶段真实计算替换 85／84 占位分」与「JS／余弦／Top3 替换 L1 距离」，属**口径变化**，不是缺陷；须在口径报告中逐条说明。
- 上述为可行性试算，**不是实现后基线**。正式基线由实现后的内核在真实数据上重跑并冻结；若与试算不一致，须查明原因并记录，**不得改写期望值掩盖实现偏差**。

---

### 2.4 UI Demo 的实现方式（2026-11-27 用户要求：先出 Demo 再开发，UI 遵循 @sites 插件规范）

- **生成器优先**：Demo 不是另写一份前端，而是**匹配内核 + 报告渲染器的真实产物**。
  渲染器读 `site/web/assets/base.css` 并内联，数据内嵌，产出**自包含 HTML**；
  合成 fixture 走的是同一套内核与同一个渲染器，因此 Demo 与正式产物同源，
  不存在「Demo 一套实现、正式一套实现」的漂移。
- **落在站点里**：Demo 产物写入 `site/web/tool1-report.html`，作为工作台站点的一个独立文档页；
  站点的「货渠匹配」页增加入口链接。站点描述符 `site/.人群运营工作台.qoder.site` 通过
  `update_design_workbench` 登记新页面（`/tool1-report.html`）。
- **插件规范流程**：现有站点更新路径 —— 保留既有设计系统（无 `designStyle`，沿用 `--site-*` 变量与组件类）、
  不新建站点、不引入第二套组件库；本地预览 → 用户审核 → 获授权后再发布。
- **发布边界**：站点只承载**合成演示数据**；真实数据版本只落本地输出目录，**不随站点发布**。
- **本轮不做**：不把真实数据接进站点、不做站点后端、不改站点的合成数据页。

## 3. 验收条目

验收以外部可观察结果描述，编号供独立复核逐项核对。

### 内核

| 标识 | 验收条目 |
| --- | --- |
| T1-01 | **匹配内核单一实现**：`packages/core/src/match/` 暴露 `scoreMatch`；工具1 只消费内核，**不得出现第二份评分公式或权重常量**；静态检查 + 独立复核确认 |
| T1-02 | **公式与参数**：单维度分 = `100 × (0.60 × JS 相似度 + 0.25 × 余弦相似度 + 0.15 × Top3 重合度)`；综合分 = `Σ(维度分 × 权重) / Σ可用权重 + 客单惩罚`，四舍五入 1 位小数，裁剪到 `[25, 99.5]`；A ≥ 80、B 60–79.9、C < 60；熔断阈值 45（只做标记，不改变评级） |
| T1-03 | **六维真实计算**：性别、年龄段、策略人群、城市等级、人生阶段由画像分布实算；消费能力由真实价格与渠道高／低消费占比按可配置价格带表实算；**不得出现任何写死占位分**（85／84 或常数维度） |
| T1-04 | **缺失语义**：缺维度（单侧无画像／空分布）从加权中剔除并按剩余维度重归一化，列出缺项；缺价格**不插补 199**，消费能力维度剔除且无惩罚，列出缺价；可用维度少于 3 时**不产出总分**，返回 `insufficient-dimensions`，看板标注「维度不足」 |
| T1-05 | **参数单一来源**：权重、混合比例、价格带规则、评级／熔断阈值、裁剪区间、驱动阈值全部在 `MATCH_CONFIG`，加载时校验；测试通过改配置改变输出，证明无散落常量 |
| T1-06 | **输出结构确定性**：同输入同输出；输出总分、评级、熔断标记、六维分明细（含证据）、可用／缺失维度、正负向驱动（阈值 1 分，最多各 3 条）、客单适配（价格带／高消低消占比／惩罚／诊断）、画像时间窗标记 |
| T1-07 | **黄金回归**：两条锚点保持 A／C；五条新基线冻结为回归断言；客单分与惩罚逐条等于旧值；评级变化写入口径报告；回归脚本在参考数据缺失时**明确失败**，CI 记为 `NOT_RUN` |
| T1-08 | **数据集适配**：`data/` 与抖音参考数据只读路径产出同一 `MatchDataset`；参考数据不复制、不修改；无画像组合不评分并给出原因；价格解析顺序为「成交单价 ← 零售额÷零售量 ← 件单价」，**不使用兜底价** |
| T1-09 | **时间窗规则**：单月画像必须等于所选月；区间画像覆盖所选月时可用并标 `approximate`；单品画像无月份时静态使用并标 `monthUnknown`；**不得回退到相邻月份或相邻区间** |
| T1-10 | **匹配矩阵**：商品 × 渠道矩阵含总分、评级、熔断、覆盖率与缺画像标记；支持商品→渠道／渠道→商品两个视角；点击单元格可查看六维分、正负向驱动、客单诊断与时间窗标记 |
| T1-11 | **错配清单**：按 `零售额 × (1 - 匹配分/100)` 降序；输出商品、渠道、分数、评级、零售额、优先级、正负向驱动；CSV 为 UTF-8（含 BOM），列名与顺序固定 |
| T1-12 | **看板形态**：静态自包含 HTML，`file://` 直接打开；零外网请求（无 CDN、无外部字体、无统计）；沿用 `--site-*` 变量、台账条、热力图、抽屉与 `<details>`；所有业务字符串转义 |
| T1-13 | **UI Demo 门禁**：先以合成数据生成 Demo 交用户审核；审核通过后才接真实数据生成正式产物；Demo 与正式模板同源（同一渲染器 + 同一内核）；Demo 走 Qoder Sites 现有站点更新路径（设计系统不变、登记新页面、本地预览后再发布） |
| T1-14 | **真实路径**：在抖音参考数据 2026-10 上生成完整看板与清单（13 款有画像商品 × 6 渠道），记录覆盖率与未评分原因；在 `data/` 上做 1×1 冒烟并如实标注不能作为多渠道路径验收 |
| T1-15 | **数据边界**：真实产物只落 `data/reports/`（已 gitignore）；仓库与 CI 无业务数据；数据目录只读；生成器断网可跑；报告不含本机绝对路径 |
| T1-16 | **未校准声明**：权重与阈值记录为「已调整（未校准）」，口径报告说明变化来源；不得标「已优化」；Q4 校准另立变更 |

---

## 4. 匹配内核设计

### 4.1 输入与输出

内核为纯函数，不读文件、不发网络请求，便于工具1／工具2 共用与单测。

```ts
// 输入：六维投影（标签 → 占比 0-1）+ 真实价格
interface MatchPortraitInput {
  dimensions: Partial<Record<DimensionId, Record<string, { share: number }>>>;
  /** 画像月份；空串表示源数据无月份（单品画像常见）。 */
  month: string;
  /** 画像时间窗；区间画像时为 `YYYY-MM~YYYY-MM`。 */
  window?: string;
}

interface MatchInput {
  spu: string;
  channelId: string;
  product: MatchPortraitInput;
  channel: MatchPortraitInput;
  /** 计算所用自然月 YYYY-MM。 */
  month: string;
  /** 真实成交单价；undefined 表示缺失，不插补。 */
  price?: number;
  priceSource?: 'actual-unit-price' | 'retail-amount-qty' | 'unit-price' | 'missing';
}

interface MatchResult {
  spu: string;
  channelId: string;
  month: string;
  totalScore: number | null;      // 1 位小数；维度不足时为 null
  grade: 'A' | 'B' | 'C' | null;
  fuse: boolean;                  // totalScore < 45
  dimensions: DimensionScore[];   // 六项，含 available / score / evidence
  availableDimensions: DimensionId[];
  missingDimensions: { dimension: DimensionId; reason: string }[];
  positiveDrivers: Driver[];
  negativeDrivers: Driver[];
  priceFit?: PriceFit;
  flags: {
    productMonthUnknown: boolean;
    channelApproximate: boolean;  // 区间画像覆盖所选月
    priceMissing: boolean;
  };
  error?: 'insufficient-dimensions';
}
```

- `DimensionScore` 含 `dimension`、`label`、`score`（1 位小数）、`weight`、`available`、缺失原因；分布维度附 `jsSimilarity`／`cosine`／`top3Overlap`／双方 Top3；消费能力维度附价格带、高消／低消占比、惩罚与诊断。
- 内部计算保留全精度，**只在输出时四舍五入 1 位小数**；总分用未取整的维度分加权。
- 工具2 后续只需把「预测画像」按同一 `MatchPortraitInput` 传入，不改评分逻辑。

### 4.2 维度与权重

六维取自 `packages/core` 维度目录的 `core: true` 维度，不另立词表：

| 维度 ID | 名称 | 权重（初值） | 评分来源 |
| --- | --- | --- | --- |
| `gender` | 预测性别 | 0.10 | 分布相似度 |
| `age` | 预测年龄段 | 0.20 | 分布相似度（5 档统一龄段） |
| `spending_power` | 消费能力 | 0.15 | 客单承接表（价格 × 渠道高／低消占比） |
| `city_tier` | 城市等级 | 0.10 | 分布相似度 |
| `strategy_segment` | 策略人群 | 0.25 | 分布相似度 |
| `life_stage` | 预测人生阶段 | 0.20 | 分布相似度 |

**分布维度 = 六维中除 `spending_power` 外的五维**。权重为讨论稿 §7.4 初值，未经真实数据校准，只能记「已调整」。权重和不必为 1，按可用维度的权重和归一化。

### 4.3 分布维度评分

对每个分布维度：

```
JS 相似度 = 1 - JS 距离（散度平方根的 0-1 值）
余弦相似度 = 两侧占比分布（各自归一化后）的余弦
Top3 重合度 = |Top3 交集| / max(|Top3 产品|, |Top3 渠道|)
单维度分 = 100 × (0.60 × JS 相似度 + 0.25 × 余弦相似度 + 0.15 × Top3 重合度)
```

- 复用 `packages/core/src/index/similarity.ts` 的既有函数，**不复制第二份相似度实现**。
- 任一侧该维度缺失或分布为空（占比和 ≤ 0）→ 该维度不可用，不参与加权，并记录原因。
- 不设维度分下限；总分裁剪只发生在综合分。

### 4.4 消费能力与客单承接

消费能力维度分由**可配置价格带表**给出，与旧抖音工具的口径一致（原样保留为配置表）：

| 价格区间 | 渠道消费力条件 | 维度分 | 全局惩罚 |
| --- | --- | ---: | ---: |
| `< 100` | 无条件 | 95 | 0 |
| `100–199.99` | 无条件 | 88 | 0 |
| `200–399.99` | 高消费占比 ≥ 28% | 92 | 0 |
| `200–399.99` | 其他 | 70 | -3.0 |
| `400–499.99` | 高消费占比 ≥ 34% | 90 | 0 |
| `400–499.99` | 其他 | 58 | -6.5 |
| `≥ 500` | 高消 ≥ 38% 且低消 ≤ 32% | 93 | 0 |
| `≥ 500` | 高消 < 25% 或低消 ≥ 45% | 32 | -10.5 |
| `≥ 500` | 其他 | 68 | -4.0 |

- 高消费占比 = 统一维度 `spending_power` 中标签 `高` 与 `极高` 的占比之和；低消费占比 = `低` 与 `极低` 之和。抖音只有三档时即为 `高`／`低`。
- 表按价格区间分组、组内按顺序**首次命中**；每个价格区间必须有兜底行。
- 价格缺失或渠道 `spending_power` 缺失 → 该维度不可用，**不产生惩罚**，并标记 `priceMissing`。
- 诊断文案由配置模板给出（可含价格与高／低消占比），看板展示；不是评分输入。

### 4.5 综合分、评级与熔断

```
加权分 = Σ(维度分 × 权重) / Σ(可用维度权重)
总分 = clamp(round1(加权分 + 惩罚), 25, 99.5)
评级 = A（总分 ≥ 80）｜B（60 ≤ 总分 < 80）｜C（总分 < 60）
熔断 = 总分 < 45（只做显示标记，不改变评级）
```

- 评级用**取整后的总分**判定，避免 79.96 显示为 80.0 却评 B 的不一致。
- 可用维度少于 `minAvailableDimensions`（初值 3）→ `totalScore: null`、`error: 'insufficient-dimensions'`，看板标注「维度不足」，不猜分数。

### 4.6 驱动因素

- 以加权分（不含惩罚）为基准，`偏差 = 维度分 - 加权分`。
- 正向驱动：偏差 ≥ `driverThreshold`（初值 1.0）按偏差降序取 Top3；负向驱动：偏差 ≤ -阈值按偏差升序取 Top3。
- 每条驱动含维度名、维度分、偏差、权重；看板用于「主要差异点」与运营建议。

### 4.7 参数配置与校验

`packages/core/src/match/config.ts` 导出冻结的 `MATCH_CONFIG` 与 `validateMatchConfig`：

```ts
interface MatchConfig {
  version: string;                 // 'p1-2026-11-uncalibrated'
  blend: { js: 0.60; cosine: 0.25; top3: 0.15 };
  weights: Record<DimensionId, number>;   // 六维
  grades: { a: 80; b: 60 };
  fuseThreshold: 45;
  clamp: { min: 25; max: 99.5 };
  driverThreshold: 1.0;
  minAvailableDimensions: 3;
  spendingPower: {
    highLabels: ['高', '极高'];
    lowLabels: ['低', '极低'];
    bands: PriceBandRule[];        // 有序、首次命中；每区间有兜底
  };
}
```

校验至少覆盖：混合比例和为 1；六维权重齐全且 > 0；A > B > 熔断阈值 > 0；裁剪区间合法；价格带区间连续不重叠且每个区间有兜底；高／低消标签非空且不重叠；版本号非空。校验失败直接抛错，不静默降级。

### 4.8 模块布局与复用关系

```
packages/core/src/match/
  types.ts        # MatchInput / MatchResult / DimensionScore / Driver / PriceFit / MatchConfig
  config.ts       # MATCH_CONFIG + validateMatchConfig
  kernel.ts       # scoreMatch（纯函数）
  month.ts        # 画像时间窗与选定月匹配规则
```

- `packages/core/src/index.ts` 增加导出。
- 工具1、工具2、看板生成器都从这里取评分；**任何其他目录不得出现评分公式或权重常量**。
- 不修改 `similarity.ts` 的既有行为；只在 match 层组合调用。

---

## 5. 黄金用例口径（已确认：同评级 + 冻结新基线）

### 5.1 验收方式

| 项 | 规则 |
| --- | --- |
| 锚点 | #1 必须为 A、#5 必须为 C（工程规范 §4.3 的两条最低门槛） |
| 五条新基线 | 实现后将五条总分冻结为回归断言（1 位小数）；若与 §2.3 试算不一致，须查明原因并记录，不得改期望值掩盖 |
| 客单维度 | 五条的消费能力维度分与惩罚必须等于旧值（92/95/93/68/32；0/0/0/-4.0/-10.5） |
| 新旧对照 | 五条旧值／新值／评级变化写入 `docs/match-calibration.md`（口径报告） |
| 评级变化 | #3 B→A、#4 C→B 必须逐条解释：哪些维度替换了占位分、哪些维度分变化最大 |
| 运行环境 | `UOM_REFERENCE_ROOT` 指向参考数据根；脚本缺失数据时**明确失败**，不跳过 |
| CI | **不运行**（无真实数据），结果记 `NOT_RUN`；本地运行证据写入 `result.md`，含输入文件 SHA-256 清单 |
| 变异 | 至少验证「去掉城市等级维度」「把某维度写死为常数」「价格带条件反转」三类变异能被黄金／单测抓住 |

### 5.2 输入管线一致性证据

黄金脚本同时记录：五条用例的单价（由零售额÷零售量核算）、渠道高／低消占比、价格带判定与惩罚。以上须与旧工具口径逐条一致；这是「数据管线忠实」的证据，与「新评分口径不同」分开表述。

### 5.3 回归脚本

- 位置：`scripts/golden-tool1.mjs`（本地验收脚本，不属于 `npm test`，CI 不跑）
- 命令：`UOM_REFERENCE_ROOT=... npm run test:golden`
- 输出：五条对照表 + 输入文件 SHA-256 + 断言结果；任一条不一致退出码非 0。
- 参考数据快照变化时，需用户确认后重新冻结基线（另记版本），不自动漂移。

---

## 6. 数据集适配

### 6.1 统一数据集

两个数据路径产出同一结构，内核不感知来源：

```ts
interface MatchProduct {
  spu: string;
  name?: string;
  price?: number;
  priceSource: 'actual-unit-price' | 'retail-amount-qty' | 'unit-price' | 'missing';
  retailAmount?: number;
  portrait?: MatchPortraitInput;
  portraitPlatform?: string;
}

interface MatchChannel {
  id: string;              // data/：店铺编码；参考数据：`<类型>:<实体名>`
  name: string;
  type?: string;
  portrait?: MatchPortraitInput;   // 所选月的画像
  portraitPlatform?: string;
}

interface MatchDataset {
  source: 'data' | 'reference';
  sourceLabel: string;
  selectedMonth: string;
  months: string[];
  products: MatchProduct[];
  channels: MatchChannel[];
  notes: string[];         // 覆盖率、缺失、近似口径、未评分原因
}
```

### 6.2 `data/` 正式路径

- 用 `buildIndex({ dataRoot })` 构建索引，复用 `findProduct`／`findChannel`／`findPortraitByEntityIds`／`channelEntityIds`。
- 商品：有画像的款号进入矩阵；价格取 `actualUnitPrice` → `retailAmount/retailQty` → `unitPrice` → 缺失。**不使用吊牌价**。
- 渠道：有画像的渠道进入矩阵；店铺编码为 ID，店铺名为显示名。
- 当前 `data/` 只有 1 个渠道实体，矩阵为 1×1 冒烟，**不能作为多渠道路径验收**。

### 6.3 抖音参考数据只读路径

- 根目录由 `UOM_REFERENCE_ROOT` 或 `--reference-root` 指定，默认不写死本机路径。
- **只读**：不复制、不重命名、不改文件；产物只写输出目录。
- 识别规则：
  - `直播/<账号>/*.csv` → 抖音直播；`商品卡/<店铺>/*.csv` → 抖音商品卡；`短视频/<店铺>/*.csv` → 抖音短视频。
  - 渠道实体 ID 为 `<类型>:<目录名>`，避免同名店铺跨类型冲突。
  - 月份从文件名解析：`成交YYMM`、`YY年M月`，并兼容 `YYYY-MM`；无法解析记 issue 并跳过，不静默。
  - 单品画像：`TOP20商品/商品单款人群画像数据/<款号>画像数据.csv`；款号取自文件名，月份为**未知**（源文件不含月份）。
  - 商品经营指标：`TOP20商品/商品数据表.csv`，读取款号、商品名称、零售额、零售量、件单价；13 款画像与经营指标全部有交集。
- 渠道画像用 `normalizeDouyinPortrait` 解析，显式传入从目录／文件名得到的 `entityId` 与 `month`；**不修改归一化层的既有行为**。

### 6.4 月份与时间窗规则

| 情形 | 规则 |
| --- | --- |
| 默认月 | 参考数据：渠道画像文件中最新的可解析月份；`data/`：渠道画像覆盖的最新单月（区间按其结束月计入）。`--month` 显式覆盖 |
| 单月画像 | 必须等于所选月，否则该组合不评分（`month-mismatch`） |
| 区间画像 | 所选月落在区间内 → 可用，标记 `channelApproximate: true` 与 `portraitWindow`；否则不评分 |
| 单品画像无月份 | 静态使用，标记 `productMonthUnknown: true`；不猜月份 |
| 单品画像有月份 | 必须与所选月一致或区间覆盖，否则不评分；**不回退** |
| 多平台同实体同月 | 按 P0 的确定性平台选择，记录 `portraitPlatform`；歧义无法消解时不评分并说明 |

### 6.5 价格解析

| 顺序 | 来源 | 说明 |
| --- | --- | --- |
| 1 | `actualUnitPrice` | `data/` 商品档案已有成交单价 |
| 2 | `retailAmount / retailQty` | 两者均 > 0 时计算，保留 2 位小数 |
| 3 | `unitPrice` | 件单价 > 0 |
| — | 缺失 | `priceSource: 'missing'`，消费能力维度剔除、无惩罚、看板标注；**不继承抖音工具的 199 兜底价** |

---

## 7. 看板与错配清单

### 7.1 输出形态（已确认）

- 默认输出目录：`data/reports/tool1/<source>-<month>/`（已 gitignore）
- 产物：`index.html`（自包含）＋ `mismatch.csv`＋ `match-results.json`（全部单元格结果，供审计）
- 命令示例：

```bash
npm run build
UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" \
  npm run tool1 -- --dataset reference --month 2026-10 --out data/reports/tool1
npm run tool1 -- --dataset data --data-root data --month 2026-06 --out data/reports/tool1
```

- HTML 不写本机绝对路径；数据集只显示 `reference`／`data` 与月份。
- CSV 列固定：`rank, spu, product_name, channel_id, channel_name, month, score, grade, fuse, retail_amount, priority, positive_drivers, negative_drivers, price, high_share, low_share, penalty, price_band, flags`；UTF-8 含 BOM。

### 7.2 匹配矩阵

- 行＝商品、列＝渠道；支持转置为渠道 × 商品。
- 单元格显示总分（无分数显示「—」）；按 A／B／C／熔断配色，另给缺画像／维度不足／月份不匹配的具体原因。
- 台账条：有画像商品数／有画像渠道数／已评分数／熔断数／六维全可用数。
- 单元格抽屉：六维分明细（分数、权重、证据）、正负向驱动、客单诊断、时间窗标记（`monthUnknown`／`approximate`／平台）。

### 7.3 错配清单

- `priority = 零售额 × (1 - 匹配分/100)`，降序；仅包含已评分单元。
- 表列：排序、商品、渠道、匹配分、评级、零售额、错配优先级、主要负向驱动。
- **口径说明**（`<details>`）：零售额是商品级指标，无渠道级分解；该排序表示组合调整优先级，不代表该渠道的实际销售额。缺零售额的商品不进入排序并列出。
- 默认显示 Top 20，`--top` 可调；完整清单在 CSV 与 JSON。

### 7.4 UI 沿用与 Demo 门禁

- 沿用 `site/web` 设计系统：`--site-*` 变量、暖纸画布、台账条、热力图、抽屉、`<details>`、亮／暗主题；生成时读取 `site/web/assets/base.css` 并内联，避免第二份 token。
- 生成器在找不到 `base.css` 时**明确报错**，不静默降级为无样式页面。
- **先出 Demo**：用合成画像（不含任何真实业务数据）生成 `site/web/tool1-report.html` 交用户审核；审核通过后才接真实数据。Demo 与正式模板同源，正式产物不进仓库、不进站点。
- Demo 页在站点内的入口：「货渠匹配」页右上角的「打开工具1 报告（合成演示）」链接。
- 站点只承载合成数据；真实数据版本落在本地输出目录，**不随站点发布**。
- 不在 `site/web` 中接入任何真实数据；站点既有的合成数据页保持原样。

### 7.5 离线、转义与安全

- 报告无 `http://`、`https://`、`//cdn`、`@import`、外部字体、`fetch`／`XHR`、iframe；生成器运行期零网络请求。
- 所有业务字符串（商品名、渠道名、诊断文案）经 HTML 转义；JSON 内嵌时转义 `</script>`。
- 数据目录只读；写操作只落 `--out` 指定目录（默认 `data/reports/`），拒绝写到数据源目录或仓库跟踪路径（`packages/`、`site/`、`docs/`）。

---

## 8. 范围与不做事项

### 本轮做

- 共享匹配内核、评分配置、时间窗规则
- `data/` 与抖音参考数据适配
- 匹配矩阵、错配清单、静态看板、CSV
- 合成数据 Demo、单测、黄金回归、口径报告、使用说明
- P1 工程检查与独立复核

### 本轮不做

| 不做 | 归属 |
| --- | --- |
| 属性→画像预测模型、训练、model-mlflow 接入 | P2 工具2 |
| 权重／阈值的数据校准（NDCG） | 待成交与售罄数据，另立变更 |
| TGI 空间评分 | 数据源 TGI 覆盖不全，按 P0 修正 C2 仍在 share 空间 |
| Excel 导出、留存与回购报表 | P3 |
| 背对背／面对面校对与四大款式分类 | P4 |
| MCP 工具契约变更、MCP 内产出匹配分 | 保持 P0 契约；匹配分只在 P1 内核 |
| 本地服务、端口监听、鉴权 | 本轮静态产物；Q5 已确认 |
| 真实数据接入 `site/web` 或任何云端发布 | 数据不出网 |
| 改动抖音工具、ModelEvol、model-mlflow 本体 | 只读参考 |
| 多渠道正式数据验收 | 待用户补数据；本轮以参考数据闭合工程门禁 |

---

## 9. 允许修改路径

```
packages/core/src/match/**                 # 新建：内核、配置、时间窗
packages/core/src/index.ts                 # 增加导出
packages/core/test/match.test.ts           # 新建：内核单测
packages/tool1-channel-match/**            # 新建：数据集适配、矩阵、清单、报告生成器
packages/tool1-channel-match/test/**       # 新建：适配器、矩阵、清单、HTML 测试
scripts/golden-tool1.mjs                   # 新建：本地黄金回归脚本
scripts/offline-check/**                   # 增加工具1 断网检查
site/web/tool1-report.html                 # Demo 产物（生成物，合成数据，可入库）
site/web/assets/app.js                     # 站点「货渠匹配」页增加 Demo 入口链接
site/web/assets/base.css                   # 仅新增 .btn 作为链接时的去下划线样式
docs/match-kernel.md                       # 新建：内核口径与使用说明
docs/match-calibration.md                  # 新建：新旧口径对照与评级变化说明
docs/ui-design.md                          # 更新：指向新的报告页
openspec/changes/tool1-match-kernel/**     # 本记录
package.json                               # 新增 npm script：tool1 / test:golden
output/playwright/**                        # 浏览器验证截图（沿用既有约定）
```

- **不新增第三方依赖**；静态 HTML／CSV／文件读写均用 Node 标准库与既有依赖。
- 若实现中确需超出上述路径，先在 spec 的偏差段与 `result.md` 记录，再按规范 §4.5 处理，不顺手扩大范围。
- `data/`、`site/web/`、`packages/data-mcp/**`、`packages/core/src/index/similarity.ts` 的既有行为不在本轮改动范围。

---

## 10. 关键边界

| 边界 | 规则 |
| --- | --- |
| 数据不出网 | 参考数据只读；真实产物只落 `data/reports/`；仓库、CI、Demo 不含真实业务数据；报告不含本机绝对路径 |
| 匹配内核唯一 | 评分公式与参数只在 `packages/core/src/match/`；工具1 不得有第二份 |
| 无占位分 | 禁止 85／84 或任何常数维度；测试用输入变化抓常数实现 |
| 缺失不插补 | 缺维度重归一化并列出；缺价格不兜底 199；缺画像不评分；不回退月份 |
| 时间窗透明 | 区间画像与无月份单品画像必须在结果与界面显式标记 |
| 参数集中 | 权重、混合比例、价格带、评级／熔断阈值、裁剪区间、驱动阈值只在 `MATCH_CONFIG` |
| 未校准诚实 | 只记「已调整（未校准）」，不标「已优化」；口径报告说明变化来源 |
| 只读三方资产 | 不修改抖音工具与数据；不复制参考数据入仓 |
| 静态离线 | 报告无外网请求；生成器断网可跑；无端口监听 |
| UI 门禁 | 合成 Demo 经用户审核后才接真实数据；布局变化须重新出 Demo |

---

## 11. 任务目标执行清单

**本轮目标**：交付 P1 工具1 的共享匹配内核、六维真实评分、静态看板与错配清单，满足 P1 门禁，并以参考数据完成真实路径验收。

**预期交付**：`packages/core/src/match/` 内核、`packages/tool1-channel-match/` 生成器、参考数据上的完整看板与清单、黄金回归与口径报告、独立复核后的 PR。

| # | 阶段 | 任务 | 完成条件 | 验收 | 阻塞 |
| --- | --- | --- | --- | --- | --- |
| P1-1 | 规格 | 本 spec 与清单交用户确认 | 用户确认四项决策与范围；无未决口径 | — | **用户确认** |
| P1-2 | 内核 | 类型、配置、校验、时间窗规则 | 先写测试取得真实 RED；配置校验测试全绿 | T1-02/05/09 | 否 |
| P1-3 | 内核 | 六维评分、缺失语义、客单承接、综合分、驱动 | 单测覆盖正反向／边界／缺维度／缺价格／常数变异；无占位分 | T1-01–06 | P1-2 |
| P1-4 | 数据 | `data/` 与参考数据适配 | 两路径产出同一结构；参考数据只读；月份／价格规则测试 | T1-08/09 | P1-3 |
| P1-5 | 黄金 | 真实数据黄金回跑、基线冻结、口径报告 | 锚点 A／C；五条客单分与惩罚一致；SHA-256 与结果入 `result.md` | T1-07/16 | P1-4、参考数据 |
| P1-6 | 产物 | 矩阵、错配清单、CSV、JSON | 排序与列契约测试；缺画像／缺价格不进入排序并列出 | T1-10/11 | P1-4 |
| P1-7 | Demo | 合成数据看板 Demo 交审 | 模板与正式同源；零外网；用户明确审核结果 | T1-12/13 | **用户审核** |
| P1-8 | 产物 | 正式静态 HTML 生成器接线真实数据 | 参考数据 2026-10 生成完整产物；无绝对路径；零外网 | T1-12/14/15 | P1-5/6/7 |
| P1-9 | 验证 | 真实路径与冒烟 | 参考数据 13×6 记录覆盖率；`data/` 1×1 冒烟并标注局限 | T1-14 | P1-8 |
| P1-10 | 文档 | 使用说明、口径报告、`result.md` | 配置版本、权重「已调整」、命令、证据、失败／未验证项齐全 | T1-16 | P1-5/9 |
| P1-11 | 检查 | 构建／测试／断网／链接／审计／守卫 | 全部适用检查通过；黄金本地 PASS、CI `NOT_RUN` 如实记录 | — | P1-10 |
| P1-12 | 复核 | 非作者独立复核 | 覆盖内核唯一性、无占位分、黄金、断网、UI、数据边界；发现已处理 | — | P1-11 |
| P1-13 | 交付 | PR、CI、获授权 squash 合并 | 完整候选、PR 描述、CI 结果、合并授权 | — | P1-12 |

**当前状态（2026-11-27）**

| 任务 | 状态 | 证据 |
| --- | --- | --- |
| P1-1 | **PASS** | 用户 2026-11-27 确认 UI、spec、任务清单 |
| P1-2 | **PASS** | `packages/core/src/match/{types,config,month}.ts`；配置校验（混合比例和、六维权重、门槛顺序、价格带连续性与兜底） |
| P1-3 | **PASS** | `packages/core/src/match/kernel.ts` + `packages/core/test/match.test.ts`；**真实 RED**：占位实现（各维写死 85）下 18 例中 17 例失败；实现后 **18/18 通过**，全仓 **195/195** 通过 |
| P1-4 | **PASS** | `packages/tool1-channel-match/src/dataset/**`；参考数据只读适配 + `data/` 正式路径，产出同一结构；10 例适配测试 |
| P1-5 | **PASS** | `scripts/golden-tool1.mjs` 五条 PASS（锚点 A/C 保持）；`docs/match-calibration.md` 记录新旧对照与评级变化 |
| P1-6 | **PASS** | 错配清单与 CSV：排序口径、列顺序、BOM、缺零售额不入排序均有测试 |
| P1-7 | **PASS** | Demo 由真实内核 + 渲染器产出；浏览器验证通过；**用户已确认 UI**；站点已发布（含合成数据） |
| P1-8 | **PASS** | `--dataset reference\|data` 均产出 index.html / mismatch.csv / match-results.json；真实产物只落 `data/reports/` |
| P1-9 | **部分** | 参考数据 13×6 全量跑通；`data/` 仅 **1×1** 冒烟（当前只有 1 个渠道实体可关联画像），不能作为多渠道路径验收 |
| P1-10 | **PASS** | `docs/match-kernel.md`、`docs/match-calibration.md`、本变更 `result.md` |
| P1-11 | **PASS** | 构建、195 例单测、黄金回归（本地）、断网三关（守卫自检／MCP 端到端／工具1 生成器）、链接、守卫、审计全过 |
| P1-12 | **NOT_RUN** | 独立复核未做；交付前必须补（规范 §5.1） |
| P1-13 | **未开始** | PR／CI／合并待用户授权 |

**顺序说明**：P1-2～P1-4 可连续推进；P1-5 需要参考数据在位；P1-7 是用户审核门禁，未过不接真实数据；P1-12 未过不合并。

---

## 12. 适用检查计划

| 检查 | 方式 | 期望 |
| --- | --- | --- |
| 类型检查与单测 | `npm run build && npm test` | 全绿；新增内核与工具1 测试 |
| 黄金回归 | `UOM_REFERENCE_ROOT=... npm run test:golden` | 锚点 A／C；五条基线与客单分／惩罚一致；CI 不跑 |
| 真实路径 | 参考数据 2026-10 生成看板与 CSV；`data/` 1×1 冒烟 | 产物完整；覆盖率与未评分原因明确 |
| 断网 | `npm run offline-check` + 工具1 生成器断网运行 | 出网尝试 0 次 |
| 报告离线 | 扫描 HTML：外链／字体／fetch／XHR | 0 命中 |
| UI | Playwright 打开 Demo 与真实产物（file://） | 矩阵、抽屉、转置、CSV、亮暗主题；420px 无横向溢出；控制台无错误 |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | 通过 |
| 链接检查 | `python3 .github/scripts/check-docs-links.py .` | 通过 |
| 依赖审计 | `npm audit --audit-level=high` | 无高危（不新增依赖） |
| 变异 | 常数维度／去掉城市等级／价格带反转／核心里程碑 | 抓住回归 |
| 独立复核 | 非作者 Agent，按验收条目逐项核对 | 见 `result.md` |

**结果状态用词**：`PASS` / `FAIL` / `NOT_RUN` / `UNKNOWN` / `NOT_PROVED`。黄金回归在 CI 为 `NOT_RUN`，不得写成整体通过。

---

## 13. 未决问题与待补数据

| # | 问题 | 当前处置 |
| --- | --- | --- |
| Q4 | 权重校准 | **已确认冻结初值**，记「已调整（未校准）」；待成交与售罄数据后另立校准变更 |
| Q5 | 静态还是服务 | **已确认静态 HTML + CSV** |
| Q6 | 是否 Excel | P1 不做；P3 报表统一决定 |
| — | 多渠道正式数据 | 待用户提供；P1 工程门禁以参考数据闭合，但**用户自有数据的多渠道路径验收为 `NOT_PROVEN`** |
| — | 参考数据中单品画像无月份 | P1 按静态事实画像使用并显式标记；若后续提供按月单品画像，按时间窗规则严格匹配 |
| — | 商品零售额无渠道级分解 | 错配清单使用商品级零售额，口径说明中披露；若有渠道级成交数据，另立变更升级排序 |
| — | DM12（P0 跨渠道对比）仅 1 组样本 | 保持「局部通过」记录；P1 参考数据路径可补充跨渠道样本，但不改写 P0 门禁历史 |