# P0-5 最终确认（候选 `b6985eb`）

> 复核性质：P0-5 **最后一次确认**，只核上一轮「有条件建议合并」的条件闭合情况 + 复核者新提的 N-4／N-5 门禁项。
> 复核人：独立复核 Agent（未参与候选任何部分）
> 隔离验证根：`/tmp/uom-review-p0-5h`（detached HEAD 于 `b6985eb`），真实样本只读
> 上一轮报告：`openspec/changes/data-mcp-core/review-p0-5-close.md`（第五轮/单点复核，已入库）
>
> **文件名偏差声明**：委托要求的输出路径 `review-p0-5-final.md` **已被占用** —— 该文件是 `9df255a` 提交的**第三轮复核报告**（首行「# P0-5 第三轮限范围复验」），且被 `result.md:358` 与 `review-p0-5-minimal.md:5/17/48` 以相对链接引用。覆盖它会销毁第三轮复核原始证据并打断 2 条已通过的相对链接（`check-docs-links.py` 将由 0 错变为报错）。故本轮报告写入 **`review-p0-5-final-confirm.md`**，内容未改动任何既有文件。

---

## 候选身份

| 项 | 值 |
| --- | --- |
| 候选 commit | `b6985eb`（父 `7ce7ed7`） |
| HEAD | `b6985ebbb86fb492d9bd236b71cf34f99cea668c`（已核对） |
| 初始工作区状态 | `git status` 干净（已核对） |
| 本轮变更文件（5 个） | `openspec/changes/data-mcp-core/result.md`、`package.json`、`scripts/offline-check/{block-net.mjs, guard-selftest.mjs, offline-e2e.mjs}` |
| 上轮候选 | `7ce7ed7` |
| 本轮复核动作 | 只读复核 + 3 次变异破坏（均以**文件备份**还原，未用 `git checkout --`） |

**候选身份确认：PASS。**

---

## 逐项核对（1–6）

### 1 · N-1 · 第四轮台账的归属 —— **PASS**

**事实链已独立核对：**

| 证据 | 内容 |
| --- | --- |
| `review-p0-5-final.md:120` | 第三轮报告：「守卫是**键名字面匹配**…把匹配分写成 `matchScore`/`rating` 或只写 `score` 时，**测试全部通过（SURVIVED）**」 |
| `review-p0-5-final.md:177` | 第三轮报告 §发现表第 5 行：M4 字面守卫列为**应修** |
| `review-p0-5-minimal.md:162–173` | 第四轮报告附带观察 B：「M4 守卫改为结构白名单后…→ **KILLED**…上轮『守卫对键名不敏感』的缺口**已闭合**」＝第四轮判定 **PASS** |
| `git show --stat 9df255a` | 落地结构白名单改动的提交即 `9df255a`（第三轮）；`result.md:379` 已如实标注「**落地于 `9df255a`**」 |

**当前 `result.md:370` 表述**：「…并追加观察：R11 用例实际未锁住。**（本行此前把「M4 字面守卫不牢」也记为第四轮观察，实际该观察出自第三轮，本轮复核者的第四轮原件判定为 PASS —— 归属已更正。）**」

→ 表述与事实**一致**：观察归第三轮、第四轮判定为 PASS、修复落地于 `9df255a`，三点互相印证。**PASS。**

> **给下一位复核者的死路提示**：委托给的对照命令 `git show 9df255a -- openspec/changes/data-mcp-core/review-p0-5.md` **输出为空** —— `9df255a` 新增的是 `review-p0-5-final.md`，未改 `review-p0-5.md`。第三轮原件是 `review-p0-5-final.md`。

### 2 · N-2 · §2 表与 §3／§4 的口径 —— **PASS**

三处关于「断网验证」的表述现**完全一致**，且全仓库无「断网验证未做／断网实跑未做」残留（`grep` 复扫 `result.md` 全文，0 命中）：

| 位置 | 现状 |
| --- | --- |
| `result.md:77` §2 表 P0-7 行 | **PASS**：「**断网实跑已完成**（`npm run offline-check`…9 可用 / 8 data-not-ready / 0 意外，出网尝试 0 次）」 |
| `result.md:97` §3 DM14 | **PASS**：「因 `packages/core/src` 后续有改动，本轮**重跑**…**出网尝试次数 0**」 |
| `result.md:129` §4 断网验证行 | **PASS**：「含两道门禁：① 守卫自检…② 端到端…**出网尝试 0 次**」 |

**P0-6 表述是否与「P0 门禁尚未通过」相符（`result.md:76`）：**

> 「**部分** ｜ 归一化层与 MCP 层均已用真实数据验证（§4）；**MCP 层的端到端仍缺 ≥20 条自做抽样**（现有 DM08 证据由独立复核产出，未沿用）」

→ 状态保持 **部分**（非 PASS），并显式写出未闭合的具体缺口与「证据由复核者产出、作者未沿用」这一归属说明。**未把局部通过表述为整体通过。** 与 PR 描述的「P0 阶段门禁 ｜ NOT_RUN ｜ 缺商品经营指标、渠道经营指标、多渠道人群画像」口径一致。**PASS。**

> **观察（不阻断）**：`result.md:97` DM14 末尾给的可复现命令是 `npm run build && node scripts/offline-check/offline-e2e.mjs`，只复现了 §4 两道门禁中的**后一道**（端到端），不含**前一道**（守卫自检）。建议改为指向 `npm run offline-check`。

### 3 · N-3 · §2 表 P0-4 行的用例数 —— **PASS**

- `result.md:74` 现写「core 包 **128** 例单测」。
- 实测（隔离根内 `npm run build` 后分包跑）：`packages/core` → `tests 128 / pass 128 / fail 0`；`packages/data-mcp` → `tests 31 / pass 31 / fail 0`；合计 **159 / 159 pass / 0 fail / 0 skipped**。

→ 与 §2 表、§4（`result.md:122`「159 例全过（core 128 + data-mcp 31）」）及 PR 描述三处口径**全部吻合**。**PASS。**

### 4 · N-4 · 断网守卫的覆盖面 —— **PASS（任务列举范围内）**，但记录到 3 类残留缺口

**独立实测方式**：自写探针脚本（置于隔离根**之外** `/tmp/probe-n4/`，不入库），以 `--import` 预加载候选的 `block-net.mjs` 后**逐个真实触发**出网入口，判据为错误码 `EBLOCKEDNET`。

**委托列举的 8 类入口，实测 21 个调用点全部被拦截（21/21）：**

| 入口 | 实测结果 |
| --- | --- |
| `net.connect` / `net.createConnection` / `net.request` | BLOCKED（3/3） |
| `new net.Socket().connect(...)` | BLOCKED（拦截名 `net.Socket.prototype.connect`） |
| `http.request` / `http.get` / `https.request` / `https.get` | BLOCKED（4/4） |
| `dns.lookup` / `dns.resolve`（回调版） | BLOCKED（另实测 `dns.resolve4`／`dns.resolve6` 亦 BLOCKED） |
| `dns.promises.lookup` / `resolve` / `resolve4` / `resolve6` | BLOCKED（4/4） |
| `new dns.Resolver().resolve(...)` / `.lookup(...)` | BLOCKED（另实测 `.resolve4`／`.resolve6` 亦 BLOCKED） |
| `tls.connect` | BLOCKED |

**`dns.Resolver` 覆盖是否真能生效（委托特别点名）—— 已证实生效，非只读失效：**

- 预加载后 `dns.promises.Resolver === dns.Resolver` 实测为 **`false`**（补丁前为 `true`）→ 证明 `dns.Resolver` 属性**可写**，`GuardedResolver` 子类确实被装上（未触发 ESM 严格模式下的 `TypeError`，预加载本身无异常）。
- `new dns.Resolver().resolve('…')` 抛出的错误消息为 `[断网守卫] 尝试出网被拦截: dns.Resolver.resolve`，拦截来自**该类自身**，非旁路。
- 附带确认：`dns.promises.lookup` 的拦截**可写**（`dns.promises` 对象的属性可赋值，非冻结）。

**补充测得的残留缺口（超出委托列举范围，作为观察记录，不在本项判 FAIL）：**

| 缺口 | 实测 |
| --- | --- |
| `dns.resolveAny` / `dns.reverse` / `dns.resolveMx` / `dns.resolveTxt`（回调版） | **NOT_BLOCKED** |
| `dns.promises.resolveAny` / `dns.promises.reverse` | **NOT_BLOCKED** |
| `new dns.promises.Resolver().resolve(...)` | **NOT_BLOCKED**（`dns.promises` 持有补丁前捕获的**另一个** Resolver 类引用） |
| `new dns.Resolver().resolveAny(...)` / `.reverse(...)` | NOT_BLOCKED（`GuardedResolver` 只覆写了 `resolve/resolve4/resolve6/lookup`） |
| `dns.Resolver.prototype.lookup` | **在 Node 中本就不存在**（实测 `typeof === 'undefined'`）—— 守卫自造的 `GuardedResolver.lookup` 覆盖的是一个**原生没有对应物**的方法名 |
| `global fetch` | 实际被拦（经 `net.connect` 间接命中），`http2.connect` 被 `tls.connect` 拦下 |
| 守卫计数口径 | `attempts.size` 为**去重后的入口名个数**，不是尝试次数；未拦截的路径（见上）**不会**被计入 |

**本项结论：委托列举的 8 类入口 21/21 实际拦截生效 → PASS。** 残留缺口列入「残留问题」。

### 5 · N-5 · 端到端脚本的断言与退出码门禁 —— **端到端断言门禁 PASS；守卫自检门禁 FAIL**

#### 5a · 端到端断言与退出码 —— **PASS**

- `npm run build` → 退出码 **0**。
- `npm run offline-check` → 退出码 **0**，输出「工具 17 | 数据就绪 9 | data-not-ready 8 | 意外 0 | 出网尝试 0」。

**故意破坏一个断言（文件备份还原）—— 门禁确实能拦住：**

| 变异 | 实测 |
| --- | --- |
| A：`assert.equal(attempts, 0, …)` → `assert.equal(attempts, 1, …)`（破坏「出网尝试 0」这条最吃重的断言） | `npm run offline-check` 退出码 **1**，`AssertionError: MUTATION: 出网尝试次数应为 0，实际 0` |
| A2：`EXPECTED_TOOLS = 17` → `16` | 退出码 **1**，`AssertionError: 工具数应为 16，实际 17` |

→ 四道断言（意外集合、9 就绪、8 未就绪、出网尝试 0）+ 工具数断言**确实挂在退出码上**。**PASS。**

#### 5b · `guard-selftest.mjs` 能否证明守卫有效 —— **FAIL**

**自检逻辑的判据缺陷**：`guard-selftest.mjs` 对每个入口只检查「抛出的错误码是否等于 `EBLOCKEDNET`」；**任何非 `EBLOCKEDNET` 的错误都被记为「其它错误」并被排除在失败集合之外**（`bad = attempts.filter(a => a.includes('未被拦截'))`）。因此：

- **既不能区分「被这一条拦截」与「被别的入口拦下」**（只看到错误码，看不到拦截名）；
- **不能区分「被拦截」与「因别的原因失败」**。

**故意移除一个拦截（文件备份还原）—— 自检没有失败：**

| 变异 | 实测结果 |
| --- | --- |
| B1：移除整个 `dns.Resolver = GuardedResolver`（`dns.Resolver` 的 resolve/resolve4/resolve6/lookup 拦截全部失效） | `guard-selftest` 退出码 **0（判为通过）**。两条用例报「其它错误」（`The "rrtype" argument must be of type st…` / `(intermediate value).lookup is not a function`），**未被计入失败** |
| B2：移除 `net.Socket.prototype.connect` 拦截 | `guard-selftest` 退出码 **0（判为通过）**。`net.Socket().connect` 用例报「已拦截」，但拦截来自 **`dns.lookup`**（错误消息实测为 `[断网守卫] 尝试出网被拦截: dns.lookup`），并非被移除的那一条；守卫自身计数为 **9**（缺 `net.Socket.prototype.connect`）而自检仍称「已拦截」 |

**B2 的后果（实证）**：移除 `net.Socket.prototype.connect` 拦截后，`new net.Socket().connect(80, '<字面量 IP>')`（不经 DNS）**完全未被拦截，真实 TCP 连接离开了本机**（进程因套接字保持打开被我终止）。用**未改动**的候选守卫跑同一调用则被拦下（拦截名 `net.Socket.prototype.connect`）。

→ 守卫**本身**对委托列举的入口确实有效（见第 4 项），但**守卫自检作为回归门禁不可靠**：至少 10 条用例中的 2 条无法察觉拦截被移除，且对「字面量 IP 直连」这一路径根本无覆盖。§4 与 PR 描述中「守卫自检 —— 故意走 10 个出网入口…必须全部被拦截」在**当前代码下为真**，但作为**防回归门禁**其检出能力弱于表述。**本小项 FAIL。**

### 6 · N-6 · PR 描述 —— **FAIL（文字未统一）**

只读查询 `gh pr view 2 --json body`（未改 PR）：PR #2 仍为 `OPEN`，`work/p0-5-mcp` → `main`。

**未闭合项：**

1. **「三轮独立复核」表述仍在 2 处**，与同文档的「五轮 + 单点复核」并存 —— 上一轮点名的矛盾**未消除**：
   - 「## 变更内容」段首：「…并修复其**三轮独立复核**发现。」
   - 「## 变更记录」段：「独立复核记录：`review-p0-5.md`（第一轮）、`review-p0-5-final.md`（第三轮）；**三轮复核**的发现与处理见 `result.md`」
2. **复核记录清单已过期**：仓库现存在册 4 份 P0-5 复核报告（`review-p0-5.md` 第一轮、`review-p0-5-final.md` 第三轮、`review-p0-5-minimal.md` 第四轮、`review-p0-5-close.md` 第五轮/单点），PR 描述只列了 2 份，**漏列第四轮与单点复核**。
3. **「累计 6 阻断 + 22 应修」不可与 `result.md` §5 对账**：§5 逐轮台账记录的 P0-5 阻断为 **12 条**（第一轮 E1/E2＝2；第二轮 R1/R2/R3＝3；第三轮 R2/R3/R3/R4＝4；第四轮 项2＝1；单点复核 R-1/R-2＝2）；PR 的「6 阻断」实为其 6 条 bullet 的**精选子集**（E1、E2、R1、R2、R3、第三轮 R4）。「22 应修」恰等于第一轮 11 ＋ 第二轮 11，即第三／四／单点三轮的**非阻断项被排除**，与同句「累计…五轮 + 单点复核」的口径不符。措辞「累计」不准确。

**本轮已闭合的子项（确认）：**

| 上轮所列 | 现状 | 实测 |
| --- | --- | --- |
| 「core 129 + data-mcp 30」 | 已改为「core 128 + data-mcp 31」 | 128 / 31 / 合计 159，与实测一致 |
| 「文档相对链接 57 条」 | 已改为 59 条 | `check-docs-links.py`：59 条、0 错、0 告警、退出码 0 |
| 「第四轮极小范围复核 ｜ NOT_RUN」表行 | 已移除 | 结果状态表现存 7 行，无该行 |
| 「守卫加固」一条 | 保留，与事实一致 | 结构白名单在位 |

→ PR 描述的**数字已同步**，但**轮次口径与记录清单未统一**。**FAIL（纯文本，与上轮 N-1／N-2 同性质）。**

---

## 残留问题

| # | 级别 | 问题 | 位置 | 建议 |
| --- | --- | --- | --- | --- |
| **R1** | 阻断（门禁质量） | `guard-selftest.mjs` 的失败判据只看错误码，移除拦截后**自检仍判通过**（B1、B2 两次变异均退出码 0）；B2 下 `new net.Socket().connect(80, '<IP 字面量>')` 真实出网未被拦 | `scripts/offline-check/guard-selftest.mjs` | ①「其它错误」也计入失败；②按**拦截名**归因（守卫可把入口名写进错误消息／自定义字段，自检断言该字段）；③补一条不经 DNS 的字面量 IP 连接用例 |
| **R2** | 应修（纯文本） | PR 描述仍存「三轮独立复核」2 处，与「五轮 + 单点复核」并存；复核记录清单漏列第四轮与单点复核；「累计 6 阻断 + 22 应修」不可与 §5 对账 | PR #2 描述 | 统一为「五轮 + 单点复核」，补全 4 份报告路径，把计数改为可对账口径或改为按轮次分列 |
| **R3** | 观察 | 守卫未覆盖 `dns.resolveAny/resolveMx/resolveTxt/reverse`、`dns.promises.resolveAny/reverse`、`dns.promises.Resolver` 实例、`dns.Resolver` 的 `resolveAny/reverse` 等 DNS 出口 | `scripts/offline-check/block-net.mjs` | 按需补齐；或明确在文件中声明「仅覆盖 §4 列出的入口」 |
| **R4** | 观察 | `dns.Resolver.prototype.lookup` 在 Node 中不存在，守卫自造了该方法名，自检中该用例覆盖的是原生没有的 API | 同上 + `guard-selftest.mjs` | 改为覆盖 `dns.promises.Resolver`（真正存在的 Promise 版 Resolver，当前**未**被拦截） |
| **R5** | 观察 | 守卫退出计数为**去重入口名个数**而非尝试次数，未拦截路径不计数；§4「出网尝试 0 次」应理解为「无被拦截入口被触发」 | `block-net.mjs` / `result.md:129` | 计数语义在文档中写明，或改为同时输出尝试总次数 |
| **R6** | 观察 | `result.md:97` DM14 的可复现命令只覆盖两道门禁中的后一道 | `result.md:97` | 指向 `npm run offline-check` |

---

## 结论

### 是否建议合并 —— **有条件建议合并**

- 委托核的 6 项中：N-1 **PASS**、N-2 **PASS**、N-3 **PASS**、N-4 **PASS**（列举范围内 21/21 实测生效）、N-5a **PASS**、N-6 **FAIL**、N-5b **FAIL**。
- **P0-5 交付物本体无缺陷**：守卫对列举的全部出网入口**实际生效**；端到端断言与退出码门禁**确实能拦住**被破坏的断言（实测退出码 1）；§2／§3／§4 三处口径已统一；用例数、链接数、审计、数据守卫均经复核实测吻合。
- 残留 R1（守卫自检作为回归门禁的检出能力）与 R2（PR 描述文字与计数口径）均为**小改**，不触及交付物的功能性。
- 条件（建议作者一并处理后再合并）：
  1. **R2**：PR 描述统一轮次口径、补全 4 份复核报告路径、把「累计 6 阻断 + 22 应修」改为可对账口径（纯文本）。
  2. **R1**：`guard-selftest.mjs` 的失败判据收紧（「其它错误」计为失败 + 按拦截名归因 + 补字面量 IP 直连用例），并重跑 `npm run offline-check` 确认退出码 0。
- 条件闭合后，本候选即可**无条件合并**；合并后仍应按仓库纪律另做一次**独立复核**（最终独立复核不可由作者自评代替）。

### 是否建议进入 P0-6 —— **暂不建议立即进入；条件闭合后即可进入**

理由：

1. **门禁未过**：工程规范要求「未过门禁不进入下一阶段」。当前 **P0 阶段门禁为 NOT_RUN**（缺商品经营指标、渠道经营指标、多渠道人群画像），`result.md:76` 的 P0-6 自身状态仍为 **部分**，明确写着「MCP 层的端到端仍缺 ≥20 条自做抽样」。
2. **R1 未闭合**：P0-6 是「真实数据端到端验证」，其验收正依赖断网/守卫这条证据链；守卫自检的检出缺陷若不先修，P0-6 的证据强度不足。
3. **P0-6 的实际前置是补数据**：PR 描述与 §8 均把「补数据」列为下一步。先启动「补数据」，再据以完成 P0-6 的 ≥20 条自做抽样与多渠道画像核对，是更省返工的顺序。

→ **建议**：先闭 R1、R2 → 再启动 P0-6 的数据补齐 → 数据到位后开展 P0-6 抽样与多渠道画像验证 → 达标后再判 P0 阶段门禁。

---

## 复核过程留痕

| 动作 | 结果 |
| --- | --- |
| 变异 A / A2（破坏 e2e 断言） | 退出码各为 **1**，已用文件备份还原，md5 与候选一致 |
| 变异 B1 / B2（移除守卫拦截） | `guard-selftest` 退出码各为 **0**（未被检出），已用文件备份还原，md5 与候选一致 |
| 破坏性调用的副作用 | B2 下对字面量 IP 的直连曾真实建立 TCP 连接（无载荷、随即终止）；其余变异均无出网 |
| 结束时 `git status` | 仅本报告文件为新增未跟踪；三个脚本与候选 md5 一致 |
