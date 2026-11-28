# Data-Templates（数据模板包）

> 状态：**已确认**（2026-11-28 用户：「需要做模板」）。
> 基线：`main` @ `a506dc6`（P2 已合并）。
> 相关：[要数清单](../../../docs/data-request.md) · [数据目录说明](../../../data/README.md) · [归一化规则 §12](../../../docs/normalize-rules.md)

---

## 1. 目标

给业务侧一份**可直接填写**的数据模板包：每张输入表一个 sheet，表头、必需／可选、口径、落盘路径全部给出。模板**由代码契约生成**，不手写第二份，不会过期。

解决的用户痛点：契约散在三份文档里全是文字，业务侧得自己对照建表头，容易错。

---

## 2. 交付物

| 交付物 | 说明 |
| --- | --- |
| `templates/数据模板.xlsx` | tracked；多 sheet，每表一个 sheet；示例行全部合成 |
| `scripts/build-data-templates.mjs` | `npm run templates:build`，从代码契约生成模板，不读 `data/` |
| 防漂移测试 | 重新生成并与入库文件比对，纳入 `npm run check` |
| 文档指针 | 要数清单、数据目录说明顶部指向模板包与用法 |

---

## 3. 覆盖范围（以代码实际加载为准）

| 组 | 表 | 契约来源 |
| --- | --- | --- |
| A · 12 张新表 | funnel、member-features、cohort、recency、channel-flow、diagnosis、product-channel、aggregate-groups、product-performance、channel-performance、entity-alias、portrait-conflicts | `packages/core/src/normalize/catalog/tables.ts`（`TABLE_SPECS`）× `packages/core/src/index/build.ts`（`TABLE_SOURCES` 落盘路径） |
| B · 既有主数据 | 商品主表（`domains/04_商品信息/` 商品宽表）、渠道店铺宽表（`domains/02_渠道信息/`）——**表头以解析器实际必需列为准**，不再提供代码不消费的「渠道层级对照」简化表；「商品客观属性」当前**无任何加载点**，从模板移除并在 README 标明「暂不需要提供」 | 解析器必需列（`packages/core/src/normalize/` 对应实现）——本轮**固化进 catalog**（见 DT2） |
| C · 平台画像示例 | 抖音长表、京东、天猫（表头 + 合成示例 + **精确文件名与 sheet 名规则**）；小红书标注「不可枚举，按报告原文放」 | `data/README.md`「格式模板」——同上固化 |
| D · P3 预备 | monthly-mix、clearance-leap（按要数清单第 9、10 项列要求） | 要数清单；sheet 顶部标注「解析器未做（P3 报表阶段）」 |
| E · 声明 | 时间范围声明表（镜像 `data/README.md` 表格，说明「填在 README，不是文件」） | `data/README.md` |

`data/README.md` 目录说明中与代码不一致的旧名字（`product-metrics`、`channel-metrics`、`aggregation`）按代码实际加载的文件名修正，不留两套叫法。

---

## 4. 版式（2026-11-28 按独立复核阻断 B1 重做：说明不得占用数据 sheet 的行）

| sheet 类型 | 内容 |
| --- | --- |
| 「使用说明」 | 总体步骤：① 在「表目录」找到表 → ② 打开对应数据 sheet，**删除第 2 行示例** → ③ 从第 2 行起填数据 → ④ 按「表目录」写的**文件名规则与格式**另存到**放到哪**。另注明：时间范围声明填在 `data/README.md`，不是文件 |
| 「表目录」 | 一行一表：表名 ｜ 数据 sheet 名 ｜ **放到哪（含精确文件名规则，如须以 `_京东.xlsx` 结尾）** ｜ **允许格式（CSV／XLSX 按解析器实际，含 sheet 名要求）** ｜ 必需性 ｜ 解锁什么（取自要数清单，不夸大） ｜ 解析器是否已实现 |
| 「列说明」 | 一行一列：表名 ｜ 列名 ｜ 必需／可选 ｜ 口径说明 |
| 每个数据 sheet | **第 1 行＝表头（冻结）**；第 2 行＝合成示例（高亮、首列前缀「示例-」、行尾红字「填写前删除本行」）；第 3 行起留空。示例行款号一律 `SYN-…`，店铺 `D0…` 演示账号，标签用通用枚举 |

**硬要求**：业务侧按「使用说明」操作后另存出来的文件，**必须能被真实解析器识别**（见 DT7）。

---

## 5. 验收条目

| 标识 | 验收条目 |
| --- | --- |
| DT1 | 模板覆盖 §3 全部表；每个 sheet 版式符合 §4 |
| DT2 | **单一来源**：A 组表头／必需性直接读 `TABLE_SPECS`；B／C 组文字模板固化为代码契约（如 `catalog/legacy-formats.ts`），`data/README.md` 的「格式模板」节改为与之一致，并加测试锁定「README 模板块 ↔ catalog」不再分叉 |
| DT3 | **防漂移**：测试调用生成器在内存重建，与入库 `templates/数据模板.xlsx` 比对 sheet 名集合、每表表头、必需性；任一不一致即 FAIL；纳入 `npm run check` |
| DT4 | **零真实业务数据**：示例行全合成；`check:archive-content` 的扫描范围覆盖 `templates/`；`check-data-guard.py` 对 `templates/*.xlsx` 的放行必须是**显式白名单**（只放行该路径），不得放宽其它规则 |
| DT5 | 零新增第三方依赖（用已有 exceljs 写）；生成脚本不读 `data/`，不出网 |
| DT6 | 文档：要数清单顶部加「模板包在哪／怎么用」；`data/README.md` 目录说明加指针与「另存为」说明；归一化规则 §12 若有列名修正同步 |
| DT7 | **业务侧往返测试**：测试模拟业务侧操作——读入库 xlsx 的每个数据 sheet，删第 2 行示例，按「表目录」的文件名规则与格式另存为 CSV **和** XLSX（含解析器要求的 sheet 名），放进临时数据根 → 调用真实解析器／`buildIndex` → **每个 sheet 都必须被识别**；任何「照说明做却报错」即 FAIL。防漂移比对覆盖**整个 sheet 内容**（含示例行），不只前几行 |

---

## 6. 允许修改路径

```
templates/**
scripts/build-data-templates.mjs
package.json                              # 仅 scripts 增 templates:build
packages/core/src/normalize/catalog/**    # 固化 B/C 组契约
packages/core/test/**                     # 防漂移与一致性测试
.github/scripts/check-data-guard.py       # 仅显式放行 templates/数据模板.xlsx
.gitignore                               # 仅增 !templates/数据模板.xlsx 例外（主 agent 追认，避免 git add -f 绕过全局 *.xlsx）
docs/data-request.md  data/README.md  docs/normalize-rules.md
openspec/changes/data-templates/**
```

不改 `packages/core/src/match/**`、`packages/tool1-channel-match/**`、`packages/tool2-portrait-predict/**`、`packages/data-mcp/**`、`site/web/**`；**不改 `data/` 下除 `README.md` 外的任何文件**。

---

## 7. 任务目标执行清单

| # | 任务 | 完成条件 | 验收 |
| --- | --- | --- | --- |
| DT-1 | 规格与任务清单 | 本文件 | — |
| DT-2 | 契约固化 + 生成脚本 + 防漂移测试（TDD：先写比对测试取真 RED） | `npm run templates:build` 生成；比对测试 GREEN | DT2／DT3 |
| DT-3 | 生成模板 + 文档指针 + README 旧名修正 | DT1／DT6 | DT1／DT6 |
| DT-4 | 全量检查 | check／docs-links／data-guard／archive-content／audit 全过 | DT4／DT5 |
| DT-5 | 独立复核（SDD·TDD 独立复核者） | 非作者复核报告 | M 全 |
| DT-6 | PR／CI／授权 squash 合并 | 用户授权后 | — |

---

## 8. 检查计划

| 检查 | 方式 | 期望 |
| --- | --- | --- |
| 防漂移 | `npm run check` 内 | GREEN；改动 catalog 不重建模板即 FAIL |
| 模板可用 | 业务侧视角：每 sheet 另存 CSV 后被解析器识别（合成示例行跑一遍解析） | 解析通过或按预期报「示例行」类错误 |
| 数据守卫 | `check-data-guard.py` | 显式白名单只放行模板文件 |
| 归档内容 | `check:archive-content` | 0 命中 |
| 依赖 | `npm audit --audit-level=high` | 0 漏洞 |
| 复核 | 非作者 | 见 `result.md` |
