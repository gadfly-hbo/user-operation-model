# P2-Model-Port 结果记录

> 规格：[spec.md](spec.md)（状态：已确认，2026-11-27；D-P2-1 = 方案 A）
> 本轮实际范围：**P2-2（固化与溯源）**、**P2-3（模型公共库）**。P2-4 起未开工。
> 执行分支：`work/p2-model-port`（独立工作树 `/tmp/uom-wt-p2`）。
> 原始日志：本工作树 `.local/p2/`（该目录被 `.gitignore` 的 `*.local` 规则忽略，不入库）。

## 1. 任务状态

| # | 任务 | 状态 | 验收条目 | 说明 |
| --- | --- | --- | --- | --- |
| P2-2 | 固化与溯源 | **PASS** | M01 / M13 | 见 §2 |
| P2-3 | 模型公共库（ridge / metrics / vocab） | **PASS** | M02 / M03 | 见 §3 |
| P2-4 | v0.4 管线移植 + 忠实门 | **NOT_RUN** | M05 | 本轮未开工 |
| P2-5 | §9.2 合规特征集 + 合规基线 | **NOT_RUN** | M06 / M07 | 本轮未开工 |
| P2-6 | v0.6 六阶段移植 | **NOT_RUN** | M08 | 本轮未开工 |
| P2-7 | 导出器 + 黄金测试 | **NOT_RUN** | M09 | 本轮未开工 |
| P2-8 | model-mlflow 登记（Staging） | **NOT_RUN** | M10 | 本轮未开工 |
| P2-9 | 文档与 result | 部分完成（本文件 + 溯源文档） | — | 其余随 P2-7/P2-8 |
| P2-10 | 全量检查 | 部分完成（见 §5） | M11 / M13 | 离线检查、黄金用例因环境缺数据未跑 |
| P2-11 | 独立复核 | **NOT_RUN** | — | 须由 `SDD·TDD 独立复核者` 执行，本轮作者不自评 |
| P2-12 | PR / CI / squash 合并 | **NOT_RUN** | — | 本轮不 push、不开 PR |
| P2-13 | 用户数据到位后生产重训 | **NOT_RUN** | M07 | 等 P0 数据 |

## 2. P2-2 固化与溯源（M01 / M13）

### 2.1 做了什么

| 项 | 结果 |
| --- | --- |
| 归档源（只读，未修改） | `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit` |
| 固化落点 | 主仓 `/Users/huangbo/Dev/Projects/user-operation-model/data/archive-modelevol/v06-tmall-25q4/`（`.gitignore` 的 `data/*` 命中，**不入 git**） |
| 复制方式 | `cp -R`（归档 → 固化根），未改动归档任何文件 |
| 溯源文档（tracked） | `docs/modelevol-provenance.md`（只含路径／哈希／日期／文件数／体积，无业务数值） |
| 校验脚本（tracked） | `scripts/verify-modelevol-provenance.mjs`（重算固化目录哈希与文档比对，不一致退出非 0） |

固化的三个包（镜像归档相对结构）：

| 包 ID | 归档内位置 | 文件数 | 体积（字节） | 包 sha256 |
| --- | --- | --- | --- | --- |
| `v06-experiment` | `experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/` | 27 | 2310348 | `a85d6e998991354339644585fccb52e9641dea98e148f264d580cf59264e75c9` |
| `v06-artifacts` | `artifacts/v0.6-2026-09-11-tmall-guanqi-portrait-only/` | 2 | 210905 | `e12892ca223550732a66cb58696a5ea5b17a90fa92a74e4f11ff6b81df070eb6` |
| `v06-intake-25q4` | `data/incoming/2026-09-11-tmall-guanqi-25q4-portraits/` | 189 | 3480939 | `ebb20f8e42d6f6a187c218e71949f884d701ea1596ba8cec3d7abb6e6a164865` |

包 sha256 算法（文档与脚本同一实现）：包内全部文件按相对路径码位升序，每行 `<文件 sha256>  <相对路径>\n` 拼接后再取 sha256。

### 2.2 哈希比对结果

| 比对 | 结果 |
| --- | --- |
| 归档目录 ↔ 固化副本逐文件 sha256（218 文件） | **一致，0 处差异**（文件集合与内容均一致） |
| 归档 `checksums.sha256`（187 条）↔ 固化副本 | **187/187 一致，0 处差异**，无缺失条目、无无法解析行 |
| 固化落点是否进 git | 否：`git -C <主仓> status --short` 为空；`git ls-files data/` 仅 `data/README.md` |
| 归档本体是否被修改 | 否（只读复制，未写入归档） |

### 2.3 校验脚本行为（实测）

| 场景 | 命令 | 退出码 |
| --- | --- | --- |
| 正常（工作树内运行，自动定位主仓固化根） | `node scripts/verify-modelevol-provenance.mjs` | **0**（3 包 PASS，含内嵌 187 条清单一致） |
| 篡改检测（对副本追加 1 字节） | `node scripts/verify-modelevol-provenance.mjs --root <副本>` | **1**（报体积不一致 + 包 sha256 不一致） |
| 固化根不存在 | `node scripts/verify-modelevol-provenance.mjs --root <不存在路径>` | **1**（三个包均报「固化副本不存在或不可读」） |

### 2.4 明确未固化的范围（spec §7 不继承清单）

未复制：v0.7 全部、26Q4 预测实验与 26Q4 实际画像 intake、v0.8 回测骨架、v0.5 全系。
`v06-experiment` 包内 `predictions/26q4/` 随实验目录整体固化（原始来源留痕），其**结果位不继承**、不作基线或验收依据（已在溯源文档写明）。

## 3. P2-3 模型公共库（M02 / M03）

### 3.1 交付物

| 文件 | 内容 | 来源标注（工程规范 §8.1 规则 2） |
| --- | --- | --- |
| `packages/core/src/model/ridge.ts` | 单一 Cholesky Ridge 求解器 + 单一 standardize | 文件头写明归档绝对路径与逻辑行号（v0.4 `single-product-portrait-supervised.ts:542-584/675-691`、v0.6 `lib/core.mts:194-279`） |
| `packages/core/src/model/metrics.ts` | 单一指标集：JS/余弦（复用 core 既有实现）+ `shareMae` + 两套 Top-N 口径 + 符号检验 | 文件头写明 v0.6 `lib/core.mts:116-188`、v0.4 `orchestrate.ts:292-340` |
| `packages/core/src/model/vocab.ts` | 折内词表构建（minCount 外置、按名排序、eval 未见 token 映 0、OOF≠最终词表显式化） | 文件头写明 v0.6 `lib/features.mts:142-164` |
| `packages/core/test/model.test.ts` | 19 个测试（3 个 suite） | — |

未新增第三方依赖；未引入 xlsx；未改动 `packages/core/src/index/**`、`packages/core/src/match/**`、`tsconfig.json`（core 已在根 references 内，`packages/core/tsconfig.json` 的 `include` 已覆盖 `src/**/*.ts`）。

### 3.2 关键口径决定（含与两份来源的对账）

1. **求解器唯一**：v0.4「矩阵求逆 + Gauss-Jordan」与 v0.6「高斯消元」统一为 Cholesky 分解 + 前回代。α>0 时 `XᵀX+αI` 正定；α=0 且特征共线时主元抬到最小抖动，保证结果有限、不抛错。
2. **截距统一为 ȳ**：v0.4 的 `ȳ − wᵀ·mean(Z)` 与 v0.6 的 `ȳ` 在实数域等价（Z 已中心化 ⇒ `Zᵀ1=0` ⇒ `Zᵀy = Zᵀ(y−ȳ)`），差别仅 `mean(Z)≈0` 的浮点噪声。
3. **mean/std 只算一次**：`standardize` 是唯一实现，训练结果内持久化 mean/std，预测复用同一份（修掉 v0.6 的 `solveRidge` 与 `fitRidgeStandardized` 双算）。
4. **指标两套口径并存且改名**：
   - `top1Overlap` / `top3Overlap` = v0.4 重叠比（`|predicted TopN ∩ actual TopN| / |actual TopN|`，实际侧只取 `share>0`）；
   - `top1Hit` / `top3Hit` = v0.6 argmax（`top3Hit` 方向不对称：预测侧 argmax ∈ 实际侧 Top3）；
   - 两者在 Top-3 上必然不同（测试样例 2/3 vs 1），Top-1 仅在边界输入分歧（实际分布为空或只有零份额标签：0 vs 1）。
5. **JS/余弦不复制**：`metrics.ts` 直接 `import` 并再导出 `packages/core/src/index/similarity.ts` 的 `cosineSimilarity`；`jsSimilarity` 是 `1 - jensenShannonDistance` 的薄封装，metrics 文件内不出现第二份散度公式。
6. **忠实保留的一处 v0.6 行为**：`top1Hit` 对两个空分布返回 1（v0.6 `lib/core.mts:152-156` 的 `undefined === undefined`），已在代码注释与本文件标注，调用方不得传空分布。
7. **修掉的 v0.6 缺陷**：`shareMae` 空并集返回 NaN → 改为 0（v0.4 写法）；余弦空分布 NaN → 复用 core 的 0。
8. **词表偏斜显式化**：`buildFoldVocabulary` 同时返回 `foldVocab`（逐折，只用该折样本计数）与 `finalVocab`（全样本），并给出 `skew`（`onlyInFinal` / `onlyInFold`）；不做静默统一。`minCount` 为必填参数，不再写死 3。

### 3.3 RED → GREEN 证据

RED 方式：先建**只有导出签名、函数体抛 `not implemented`** 的骨架（保证断言失败是**行为失败**而非导入错误，符合工程规范 §4.3），随后写测试并实跑。

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED | `npm run build && node --test packages/core/dist/test/model.test.js` | 退出码 **1**；`tests 19 / pass 2 / fail 17`。失败项：`与手算小矩阵对照（容差 1e-9）`、`α→0 退化为 OLS`、`奇异输入不产生 NaN 也不抛错`、`standardize 对零方差列做除零保护`、`standardize 只算一次`、`Cholesky 分解可单独调用且能解回原方程`、`JS 相似度与余弦复用 core 既有实现`、`shareMae`、`top1/top3 重叠比`、`top1Hit/top3Hit 与重叠比口径不同`、`top1 两口径同值`、`signTestPValue ×2`、`词表计数只来自训练折`、`minCount 外置`、`向量值按出现次数`、`OOF≠最终词表显式化`（失败原因均为 `not implemented: <函数名>`）。通过的 2 条是结构型变异守卫（只读源码，与实现无关） |
| GREEN | 同上 | 退出码 **0**；`tests 19 / pass 19 / fail 0` |

日志：`.local/p2/red-model-test.log`、`.local/p2/green-model-test.log`。

### 3.4 变异守卫有效性（实测，非声明）

| 变异 | 期望 | 实测 |
| --- | --- | --- |
| A：`solveCholesky` 换成内联 Gauss-Jordan（奇异时抛错） | 被抓住 | `fail 1`：奇异输入不产生 NaN 也不抛错 ✗ 被抓 ✓ |
| B：换回带 `invertMatrix` 命名的 v0.4 求逆版 | 行为守卫 + 结构守卫同时抓住 | `fail 2`：奇异输入用例 + `变异守卫：源码只保留 Cholesky 一条求解路径` ✓ |
| C：metrics 内重写一份 JS 散度（`Math.log2`） | 同一性守卫 + 结构守卫同时抓住 | `fail 2`：`JS 相似度与余弦复用 core 既有实现` + `变异守卫：metrics 内没有第二份 JS/余弦实现` ✓ |

三次变异均已回滚，回滚后 `npm run build` + 19/19 通过。
说明：数值本身无法区分求解器族，故结构守卫与失败语义守卫必须并存；两者均在 `packages/core/test/model.test.ts` 内。

## 4. 未做项与本轮边界

- **P2-4 起全部未开工**（v0.4 管线、§9.2 合规特征集、v0.6 六阶段、导出器、model-mlflow 登记、文档收尾、独立复核、PR）。
- 特征抽取（`features.ts`）与训练/留出评估不在本轮发单范围，词表模块只对「token 列表」编程，不绑定特征抽取实现。
- 未改 `packages/core/src/index.ts`：`packages/core/src/index/**` 不在 spec §6 允许修改路径内，故本轮 `model/*` 未从包根再导出；后续任务若需对外导出，需先取得该路径的修改授权或由 spec 追加。
- 未新增依赖、未引入 xlsx、未改 `tsconfig.json`、未触碰 `packages/core/src/match/**`、`packages/tool1-channel-match/**`、`packages/data-mcp/**`。

## 5. 适用检查结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | **PASS**（退出码 0，`strict` + `noUncheckedIndexedAccess` 无报错） |
| 单测（全量） | `npm test` | **PASS**（退出码 0；`tests 223 / pass 223 / fail 0`，含本轮新增 19 条） |
| 溯源校验 | `node scripts/verify-modelevol-provenance.mjs` | **PASS**（退出码 0；3 包一致 + 内嵌 187 条清单一致） |
| 文档链接 | `python3 .github/scripts/check-docs-links.py .` | **PASS**（检查 96 条相对链接，错误 0，告警 0） |
| 数据守卫 | `python3 .github/scripts/check-data-guard.py .` | **PASS**（索引中无业务数据目录、数据文件或超大文件） |
| 依赖审计 | `npm audit --audit-level=high` | **PASS**（found 0 vulnerabilities） |
| 断网自检 | `npm run offline-check` | **NOT_RUN**（守卫自检段通过：13 个出网入口全部被拦截并归因；后续 `offline-e2e` 段因工作树 `data/` 无 `domains`/`source` 子目录，MCP server 启动失败而中断——工作树无真实业务数据，按发单要求记 NOT_RUN） |
| 工具1 黄金用例 | `npm run test:golden` | **NOT_RUN**（缺 `UOM_REFERENCE_ROOT`，抖音参考数据不在本机环境；本轮未触及匹配内核） |
| CI | — | **NOT_RUN**（本轮不 push、不开 PR） |
| 独立复核 | — | **NOT_RUN**（须由未参与本候选的 `SDD·TDD 独立复核者` 执行；作者不自评） |
| 真实数据路径验证 | — | **NOT_RUN**（工程规范 §4.4：工具2 模型链路属 P2-4 起任务，本轮只交付库级组件，无业务数据可跑） |

## 6. 与 spec 的偏差 / 需要决定的事项

1. **模型公共库范围略窄于 spec §1 交付物表述**：spec §1 写「单一 Ridge、单一指标、折内词表、特征抽取（词典外置为配置）」，本轮按发单只交付前 3 件；「特征抽取」与「词典外置为配置」留待 P2-4／P2-6。**需用户确认**：是否把「特征抽取」单列为 P2-3 的缺口。
2. **`jsSimilarity` 以薄封装形式落在 metrics.ts**：`packages/core/src/index/similarity.ts` 本身没有 `jsSimilarity` 函数（现有 `jsSimilarity` 是 `diffPortraits` 产出的字段），而该文件不在允许修改路径内，故 metrics 以 `1 - jensenShannonDistance` 封装实现。若要求 core 侧也导出 `jsSimilarity`，需追加该路径授权。
3. **截距口径统一为 ȳ**（见 §3.2 第 2 条）。P2-4 的忠实门若出现「容差 0」不通过，优先怀疑此处（`mean(Z)≈0` 的浮点差），届时需以证据决定是否加回 v0.4 的写法。
4. **`top1Hit` 保留 v0.6 空分布返回 1 的行为**（见 §3.2 第 6 条）。若独立复核认为该行为应改为 0，需要同步改测试与 v0.6 管线口径。
5. **`v06-experiment` 27 个文件含 1 个 macOS `.DS_Store`**（内容文件 26）。保留是为与归档目录逐字节一致、可复核；若独立复核认为应剔除，需重算包 sha256 并更新溯源文档。
6. **固化落点在主仓而非工作树**：按发单固化到主仓 gitignore 区，工作树 `data/` 为空；校验脚本用 `git rev-parse --git-common-dir` 定位主仓，不写死本机绝对路径。若主仓目录结构变化，需同步脚本的 `FIXED_ROOT_RELATIVE`。
7. **`.local/` 证据目录不入库**：仓库 `.gitignore` 的 `*.local` 规则匹配到 `.local` 目录本身，证据日志保持未跟踪；本文件中的命令与结论是持久证据。

## 7. 交付清单

新增（tracked）：

- `docs/modelevol-provenance.md`
- `scripts/verify-modelevol-provenance.mjs`
- `packages/core/src/model/ridge.ts`
- `packages/core/src/model/metrics.ts`
- `packages/core/src/model/vocab.ts`
- `packages/core/test/model.test.ts`
- `openspec/changes/p2-model-port/result.md`（本文件）

固化数据（**不在 git**，位于主仓 `data/archive-modelevol/v06-tmall-25q4/`）：218 个文件、6 002 192 字节。
