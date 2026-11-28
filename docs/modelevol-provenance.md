# ModelEvol 归档固化溯源

> 记录 P2 工具2 移植所依赖的 ModelEvol 归档资产的**固化结果**：来源路径、哈希、日期、文件数与体积。
> 本文件**只含路径、哈希、日期、文件数、体积与款号标识**，不含任何业务数值与业务内容（份额、占比、金额、样本指标、属性组合、卖点文案一律不出现）。款号只是标识符、不属业务数据（2026-11-28 用户裁定，口径见工程规范 §7.1）。
> 校验命令：`node scripts/verify-modelevol-provenance.mjs`（不一致即退出非 0）。

依据：[工程规范 §8.1 模型与依赖来源约束](engineering-workflow.md#81-modelevol已退役归档) 规则 3「untracked 文件须先固化」、[P2 规格 M01／M13](../openspec/changes/p2-model-port/spec.md)。

## 1. 固化位置与边界

| 项 | 值 |
| --- | --- |
| 只读来源根 | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit` |
| 来源性质 | **只读参考源**。固化过程只读取，**不修改归档本体**（工程规范 §8.1 规则 1） |
| 固化落点（固化根） | `<主仓工作树>/data/archive-modelevol/`（各包在根下有独立子目录） |
| 落点性质 | 位于主仓 **gitignore 区**（`.gitignore` 的 `data/*` 命中），**不进入 git、不进入 CI**（M13） |
| 固化日期 | 2026-11-27 |
| 复制方式 | `cp -R`（归档 → 固化根），逐文件 sha256 复核 |

固化根按归档内的相对结构镜像保存（`experiments/` / `artifacts/` / `data/incoming/` / `work-package/`），便于逐包回溯到来源路径。

固化根随附的 `checksums.sha256` 来自归档原件，是 intake 包（189 文件）的原始清单，本文件与固化副本均未改写它。

## 2. 包清单

| 包 ID | 归档源绝对路径 | 固化落点（相对固化根） | 文件数 | 体积（字节） | 包 sha256 | 固化日期 |
| --- | --- | --- | --- | --- | --- | --- |
| `v06-experiment` | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only` | `v06-tmall-25q4/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only` | 27 | 2310348 | `a85d6e998991354339644585fccb52e9641dea98e148f264d580cf59264e75c9` | 2026-11-27 |
| `v06-artifacts` | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/artifacts/v0.6-2026-09-11-tmall-guanqi-portrait-only` | `v06-tmall-25q4/artifacts/v0.6-2026-09-11-tmall-guanqi-portrait-only` | 2 | 210905 | `e12892ca223550732a66cb58696a5ea5b17a90fa92a74e4f11ff6b81df070eb6` | 2026-11-27 |
| `v06-intake-25q4` | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/data/incoming/2026-09-11-tmall-guanqi-25q4-portraits` | `v06-tmall-25q4/data/incoming/2026-09-11-tmall-guanqi-25q4-portraits` | 189 | 3480939 | `ebb20f8e42d6f6a187c218e71949f884d701ea1596ba8cec3d7abb6e6a164865` | 2026-11-27 |
| `v04-holdout-train` | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/work-package/train` | `v04-holdout/work-package/train` | 4 | 53064245 | `95e44e372a3e55110871257b76694ba7620a256e0a8ab23059a0b20fc2000be3` | 2026-11-27 |
| `v04-holdout-holdout` | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/work-package/holdout` | `v04-holdout/work-package/holdout` | 4 | 13366971 | `6acb1f7ed7435b10d87a0784529c924b5c88bee15f2eb67ea3bafa2202cf5343` | 2026-11-27 |

说明：

- `v06-experiment` 的 27 个文件含 1 个 macOS `.DS_Store` 元数据文件（内容文件 26 个），随目录一并固化以保证与归档目录逐字节一致。
- `v06-intake-25q4` 的 189 个文件 = 187 个受 `checksums.sha256` 覆盖的数据文件 + `checksums.sha256` 本身 + `README.md`。
- `v04-holdout-*` 两个包是 v0.4 跨期验证协议的**训练包（83 款）与留出包（24 款）**，
  各含 `product_attributes.jsonl` / `platform_portrait.csv` / `source_manifest.json` / `quality_report.json` 四个文件，
  **原样固化**（不做 6 维抽取的有损改写，抽取在管线内做）。
  两包 `platform_portrait.csv` 的 sha256 与归档 `split-manifest.json` 登记的
  `train.checksum` / `test.checksum` **逐位一致**，即固化副本与 v0.4 当次训练／评估所读字节完全相同。

## 3. 哈希算法（校验脚本与本文件使用同一算法）

包级 sha256 定义：

1. 递归列出包内**全部文件**（含隐藏文件），相对路径以 `/` 分隔；
2. 按相对路径**码位升序**排序（不依赖 locale，保证跨机一致）；
3. 每行拼接 `<文件 sha256><两个空格><相对路径>\n`；
4. 对全部行拼接结果取 sha256，即包 sha256。

逐文件 sha256 为文件字节流的 sha256（`crypto.createHash('sha256')`），与 `sha256sum`/`shasum -a 256` 一致。

## 4. 固化一致性核对结果

| 核对项 | 结果 |
| --- | --- |
| 归档目录 ↔ 固化副本逐文件 sha256 比对（218 文件，v0.6 三个包） | **0 处差异**（文件集合一致、内容一致） |
| 归档 `checksums.sha256`（187 条）↔ 固化副本逐条比对 | **187/187 一致，0 处差异** |
| 归档 v0.4 work-package ↔ 固化副本逐文件 sha256 比对（8 文件） | **0 处差异**（原样复制，未做任何有损改写） |
| v0.4 两包 `platform_portrait.csv` sha256 ↔ 归档 `split-manifest.json` 登记的 `train.checksum` / `test.checksum` | **逐位一致**（与 v0.4 当次训练／评估所读字节相同） |
| 固化落点是否进 git | 否（`.gitignore` 的 `data/*` 命中；`git ls-files data/` 仅 `data/README.md`） |
| 归档本体是否被修改 | 否（只读复制） |

## 5. 许可范围

- 固化内容为 **只读参考**：仅用于按[工程规范 §8.1 规则 2](engineering-workflow.md#81-modelevol已退役归档)移植方法与管线骨架，并留存来源标识。
- 固化内容**不得**作为业务结论、验收基线或对外交付物；模型与指标口径以本项目规格为准。
- 未经用户授权，**不得**修改归档本体或 ModelEvol／model-mlflow 资产（工程规范 §8、§8.3）。
- 固化副本属于本机业务数据，遵守「业务数据不出网」（工程规范 §7）：不出网、不入 git、不进 CI。

## 6. 不继承清单与不固化范围

结论不继承（[P2 规格 §7 明确不继承清单](../openspec/changes/p2-model-port/spec.md)）：

1. v0.7 全部结论与其 `narrow_reeval`；
2. 26Q4 全部未回测预测与 v0.8 回测骨架的结果位；
3. v0.5 全系跨平台混合口径；
4. v0.6 的验收结论当达标；
5. v0.6 勘误前的 JS 手工数值；
6. v0.6 覆盖式画像解析；
7. 抖音期标签体系；
8. 对 `pls` 仓的依赖；
9. `xlsx@0.18.5`；
10. 归档的 adapter/skill/command 同步体系与会话快照路径。

不固化的归档目录（本轮范围外，未复制到固化根）：

- v0.7 实验与工件（`experiments/2026-09-12-v0.7-tmall-lift-modeling/`、`artifacts/v0.7-2026-09-12-tmall-lift-modeling/`）；
- 26Q4 预测实验与 26Q4 实际画像 intake（`experiments/2026-09-11-v0.6-26q4-future-prediction/`、`data/incoming/tmall-guanqi-26q4-actual-portraits/`）；
- v0.8 回测骨架（`experiments/2026-09-12-v0.8-26q4-backtest/`）；
- v0.5 全系（`experiments/2026-09-06-v0.5-d-account-fit-diagnosis-2608/`）。

`v06-experiment` 包内 `predictions/26q4/` 下的预测产物随实验目录一并固化，作为**原始来源留痕**；其结果位按上文第 2 条不继承、不作为任何基线或验收依据。
