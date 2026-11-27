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
| R1 合成数据 | PASS | `demo-data.js` 全文人工核对：无真实渠道数/款数/样本量，无本机路径；仅保留「缺失哪类文件」的描述 |
| R2 视觉论点可见 | PASS | `base.css` `.ab` / `.ab__seam` / `.diffrow`；评审台截图见 `output/playwright/v2/review-3.png` |
| R3 核心指标 | PASS | `.ledger__value` + `.ledger__unit`（单位降级 12px）；截图 ledger 区 |
| R4 九页可用 | PASS | Playwright 遍历九页：`review:OK ... flywheel:OK`，`errs: []` |
| R5 响应式 | PASS | 420px 下九页 `scrollWidth <= innerWidth`（`OK 420<=420` 及各页 OK） |
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

截图证据（1440×1000 与整页）：`output/playwright/v2/`
`review-3.png`、`match.png`、`drawer.png`、`predict-3.png`、`retention-full.png`、`review-dark.png`、`narrow-review-2.png` 等。

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