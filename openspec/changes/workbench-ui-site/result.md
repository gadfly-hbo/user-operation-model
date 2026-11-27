# 工作台 UI 视觉重设计 · 结果记录

日期 2026-11-27 · 分支 `work/p0-5-mcp`（与 P0-5 同分支，未单独开 PR）

## 交付内容

| 文件 | 说明 |
| --- | --- |
| `site/web/index.html` | 站点骨架：抬头条 + 左栏导航 + 工作区 + 抽屉 |
| `site/web/assets/base.css` | 设计基底：Nudge 变量、语义别名、组件样式、响应式 |
| `site/web/assets/demo-data.js` | 合成演示数据（全部虚构） |
| `site/web/assets/app.js` | 九页渲染、hash 路由、抽屉、主题、转置、标签联动 |
| `docs/ui-design.md` | 原型指针与视觉章节更新 |
| `README.md` | 目录树与打开方式更新 |

## 验收核对

| 标识 | 结果 | 证据 |
| --- | --- | --- |
| R1 合成数据 | PASS | `demo-data.js` 全文人工核对：无真实渠道数/款数/样本量，无本机路径；仅保留「缺失哪类文件」的描述。`docs/ui-demo/demo-data.js` 同步脱敏（真实 200/334/2,986/257 与 `data/domains` 路径已替换为合成值） |
| R2 视觉论点可见 | PASS | `base.css` `.ab` / `.ab__seam` / `.diffrow`；截图 `output/playwright/v2/review.png` |
| R3 核心指标 | PASS | 九页均含 `.ledger` 台账条（Playwright 逐页断言 `ledger`）；`.ledger__value` + `.ledger__unit` 单位降级 12px |
| R4 九页可用 | PASS | Playwright 遍历九页：`review:ledger ... flywheel:ledger`，`errs: []`；`lampText` 为「数据就绪 9 / 17」 |
| R5 响应式 | PASS | 420px 下九页 `scrollWidth <= innerWidth`；证据截图 `narrow-420.png` 实为 420×900 |
| R6 设计变量 | PASS | `:root` 定义 12 个 `--site-*`，`--paper/--card/--ink/--rule/--type-*/--sp-*` 全部引用它们；`--site-radius` 用于按钮/卡片/输入 |
| R7 零出网 | PASS | 无 `<link href="http...">`、无 `@import url()`、无 fetch/XHR；字体为系统栈 |

## 实际执行的检查

```
node --check site/web/assets/app.js        → 通过
node --check site/web/assets/demo-data.js  → 通过
python3 -m http.server 8899 (127.0.0.1)    → index/css/app/data 均 200
Playwright 九页遍历                         → 全部 OK，0 错误
Playwright 420px 溢出检查                   → 九页全部 OK
Playwright 交互冒烟                         → drawerOpen=true, Escape 关闭, 转置首列=商品名, theme=dark, 维度切换联动标签
```

截图证据（1440×1000）：`output/playwright/v2/` 下 12 张——九页各一张 + `drawer.png`、`review-dark.png`、`narrow-420.png`（420×900）。

## 独立复核（2026-11-27）

独立会话复核结论 FAIL，1 阻断 + 3 应修 + 1 建议，全部闭合如下：

| 级别 | 发现 | 闭合 |
| --- | --- | --- |
| 阻断 | 渠道画像库/商品画像库无台账条，R3「每页」不满足且 result.md 记 PASS | 两页补台账条（渠道：索引 168 / 有画像 6 / 最高覆盖率 / 数据月份；商品：索引 246 / 有单品画像 / 最高覆盖率 / 相似款检索）；Playwright 逐页断言 |
| 应修 | 权重与评级文案形成前端第二口径，且与讨论稿 §7.4 不一致 | 口径折叠区改为引用讨论稿 §7.4 的公式与权重（性别 0.10 / 年龄段 0.20 / 消费能力 0.15 / 城市等级 0.10 / 策略人群 0.25 / 人生阶段 0.20），评级 A/B/C + C 级内 <45 熔断；图例与抽屉文案统一，并注明「界面数值为合成示意，正式口径以 packages/core 配置为准」 |
| 应修 | result.md 引用了不存在的截图，`narrow-420.png` 实为 1440×1000 | 重拍全部 12 张；`narrow-420.png` 经像素校验为 420×900；记录改为只引用实际存在的文件 |
| 应修 | `docs/ui-design.md` 数据现状章节与实际站点不符（200/196、一列稀疏、留存页标注合成） | 改为 168/6、删除已不成立的描述，并注明画像库数字为合成值、真实就绪状态以 MCP 为准 |
| 建议 | 静态 HTML 写死 8/17；旧 demo 仍含真实规模数字与 `data/domains` 路径；`1 组可比样本`、`4 个有画像` 为真实就绪数 | 静态文案改 9/17；旧 demo 数据源块整体脱敏；新站渠道画像扩为 6 条合成记录，去掉与真实就绪数的巧合 |

复核中确认已正确、未改动的项：九页零 JS 错误、无横向溢出、零出网、背对背隔离可视、评审台无匹配分。

## 过程中发现并修复的缺陷

| # | 缺陷 | 原因 | 修复 |
| --- | --- | --- | --- |
| 1 | 首屏 JS 报 `dims is not defined`，整页空白 | 重写数据层时漏定义 `dims` 常量 | 补回 `const dims` |
| 2 | 大数字 48px + 「1 款」整体放大，观感粗重 | 单位与数值同字号 | 数值 30px + `.ledger__unit` 12px 分离 |
| 3 | 差异行占两行、纵向过长 | 数值行与强度条分行 | 改为单行 grid：维度 / 人工值 / 强度条 / 算法值 / 差值 |
| 4 | 人群占比条不显示填充 | `barlist__track/fill` 为 `span`，行内元素高度无效 | 加 `display:block` |
| 5 | 窄屏抬头与标题挤成多行 | 未做抬头折行与标题降级 | 860px 断点：抬头折行、隐藏副标题、标题降 20px、台账两列 |
| 6 | 切页后抽屉残留打开 | `goto` 未关闭抽屉 | `goto` 内调 `closeDrawer()` |
| 7 | 标签反查维度显示英文键名 | 直接渲染 `strategy_segment` | 增加 `TAG_DIM_LABEL` 中文映射 |
| 8 | 数据源就绪数被误改为 8 | 脱敏时误把 `get_product_portrait` 标为缺失 | 恢复为就绪（真实状态 9/17），仅把规模描述改为定性 |
| 9 | 匹配矩阵右侧拖出大片空白边框 | 表格容器撑满整宽但列数固定 | 加 `.table-wrap--fit`（`width: fit-content`），仅匹配矩阵使用 |

## 与 spec 的偏差

无范围偏差。`docs/ui-demo/` 按 spec 保留未删。

## 未验证项 / 已知限制

- **NOT_RUN**：Safari / Firefox 实机验证（仅 Chromium 内核 CLI）
- **NOT_RUN**：打印样式
- **NOT_PROVED**：Nudge 参数实际调节效果（仅保证变量被消费，未在 Design Workbench 内实测滑杆）
- 所有按钮（导出、固化决策、开始预测等）均为原型态，无真实动作

## 数据边界声明

站点内容全部为虚构值；发布到 Qoder Site 上传的是合成演示页面，不包含任何真实业务数据、本地路径或凭据。