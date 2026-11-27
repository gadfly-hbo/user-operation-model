/**
 * 人群运营工作台 · 交互脚本。
 * 纯前端原型：无网络请求，无后端依赖，数据来自同目录 demo-data.js（合成值）。
 */
(() => {
  const D = window.DEMO;
  const work = document.getElementById('work');
  const rail = document.getElementById('rail');
  const DIMS = ['性别', '年龄段', '策略人群', '消费能力', '城市等级', '人生阶段'];

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const state = {
    page: 'review',
    spu: D.reviewBatch.candidates[0].spu,
    matchAxis: 'row', // row = 商品→渠道，col = 渠道→商品
    tagDim: 'strategy_segment',
    tagLabel: '都市蓝领',
    decision: {},
  };

  /* ── 主题 ─────────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('uom-theme', t);
    document.getElementById('themeBtn').textContent = t === 'dark' ? '亮色' : '暗色';
  }
  document.getElementById('themeBtn').addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  /* ── 抽屉 ─────────────────────────────────────────────────── */
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('backdrop');
  function openDrawer(title, body, foot) {
    document.getElementById('drawerTitle').textContent = title;
    document.getElementById('drawerBody').innerHTML = body;
    document.getElementById('drawerFoot').innerHTML = foot || '';
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.getElementById('drawerClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ── 通用片段 ─────────────────────────────────────────────── */
  function ledger(cells) {
    return `<div class="ledger">${cells
      .map(
        (c) => `<div class="ledger__cell"${c.tone ? ` data-tone="${c.tone}"` : ''}>
        <div class="ledger__label">${c.dot ? `<span class="dot dot--${c.dot}"></span>` : ''}${esc(c.label)}</div>
        <div class="ledger__value${c.small ? ' ledger__value--sm' : ''}">${esc(c.value)}${c.unit ? `<span class="ledger__unit">${esc(c.unit)}</span>` : ''}</div>
        ${c.note ? `<div class="ledger__note">${esc(c.note)}</div>` : ''}
      </div>`
      )
      .join('')}</div>`;
  }

  function chip(text, tone) {
    return `<span class="chip${tone ? ' chip--' + tone : ''}">${esc(text)}</span>`;
  }

  /** 差异行：维度 · 人工值 ⇜差异条⇝ 算法值 · 差值。 */
  function diffRow(d) {
    const width = Math.min(100, d.delta * 3.2);
    return `<div class="diffrow">
      <span class="diffrow__dim">${esc(d.dim)}</span>
      <span class="diffrow__val diffrow__val--human">${esc(d.manual)}</span>
      <span class="diffrow__link" title="差异强度 ${d.delta}pp"><i class="${d.align}" style="width:${width}%"></i></span>
      <span class="diffrow__val diffrow__val--algo">${esc(d.algo)}</span>
      <span class="diffrow__delta diffrow__delta--${d.align}">差 ${d.delta}pp</span>
    </div>`;
  }

  /** 差异谱：六维差异强度的可视化概览，按差异幅度降序。 */
  function spectrum(diff) {
    if (!diff.length) return '';
    const max = Math.max(...diff.map((d) => d.delta), 1);
    const sorted = [...diff].sort((a, b) => b.delta - a.delta);
    const bars = sorted
      .map(
        (d) => `<div class="spectrum__col">
        <span class="spectrum__num">${d.delta}</span>
        <div class="spectrum__bar spectrum__bar--${d.align}" style="height:${Math.max(4, (d.delta / max) * 100)}%"></div>
        <span class="spectrum__label">${esc(d.dim)}</span>
      </div>`
      )
      .join('');
    return `<div class="spectrum">${bars}</div>
      <div class="spectrum__scale"><span>差异小</span><span>单位：pp（百分点）</span><span>差异大</span></div>`;
  }

  /* ── 页面：选品评审台 ─────────────────────────────────────── */
  function pageReview() {
    const b = D.reviewBatch;
    const c = b.candidates.find((x) => x.spu === state.spu) || b.candidates[0];
    const count = (s) => b.candidates.filter((x) => x.status === s).length;

    const cands = b.candidates
      .map(
        (x) => `<button class="cand${x.spu === state.spu ? ' is-active' : ''}" data-spu="${esc(x.spu)}">
        <span class="cand__top">
          <span class="dot dot--${x.statusTone}"></span>
          <span class="cand__spu">${esc(x.spu)}</span>
          <span class="cand__note" style="margin-left:auto;font-size:11px;color:var(--ink-3)">${esc(x.price)}</span>
        </span>
        <span class="cand__name">${esc(x.name)}</span>
        <span class="cand__meta">
          <span>${esc(x.category)}</span>
          <span>·</span>
          <span>${x.similarity === null ? '未比对' : '重合 ' + x.similarity + '%'}</span>
        </span>
      </button>`
      )
      .join('');

    const manual = c.manual;
    const pred = c.predicted;

    const diffBody = c.diff.length
      ? `<div>${c.diff.map((d) => diffRow(d)).join('')}</div>
        <div class="tally">
          ${chip('高度吻合 ' + c.diff.filter((d) => d.align === 'high').length, 'success')}
          ${chip('存在偏离 ' + c.diff.filter((d) => d.align === 'mid').length, 'warning')}
          ${chip('显著冲突 ' + c.diff.filter((d) => d.align === 'low').length, 'danger')}
        </div>`
      : '<div class="empty"><div class="empty__title">人工画像未提交，暂无可校对的差异</div></div>';

    const decisions = [
      { k: '放量', t: '放量定单', d: '按正常或追加深度备货' },
      { k: '测款', t: '小单快反', d: '浅备 + 锁定面料，私域定向测' },
      { k: '降级', t: '降级首发', d: '压首单深度，要求专属流量资源' },
      { k: '改话术', t: '修正 FAB', d: '保留货品，拆多版本详情页 AB 测试' },
    ];
    const activeAction = state.decision[c.spu] ?? c.action ?? '';

    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">选品评审 · ${esc(b.name)}</div>
          <h1 class="page-title">三方对账：商品部人工画像 vs 算法预测画像</h1>
          <p class="page-desc">数据月份 ${esc(b.month)}。两侧在提交前互不可见，比对只发生在校对层；结论落到款式分类与备货动作。</p>
        </div>
        <div class="page-actions">
          <button class="btn">导出评审纪要</button>
          <button class="btn btn--primary">固化本轮决策</button>
        </div>
      </div>

      ${ledger([
      { label: '待评审', value: count('待评审'), unit: '款', tone: 'pending', note: '其中 1 款阻塞' },
      { label: '共识款', value: count('共识款'), unit: '款', tone: 'consensus', dot: 'consensus', note: '画像重合度 ≥ 75%' },
      { label: '盲区款', value: count('盲区款'), unit: '款', tone: 'blind', dot: 'blind', note: '算法看好，人工看衰' },
      { label: '争议款', value: count('争议款'), unit: '款', tone: 'dispute', dot: 'dispute', note: '人工看好，算法看衰' },
      { label: '异化款', value: count('异化款'), unit: '款', tone: 'diverge', dot: 'diverge', note: '人群理解错位' },
    ])}

      <div class="desk">
        <!-- 候选目录 -->
        <section class="card">
          <div class="card__head"><span class="card__title">候选商品</span><span class="hint">${b.candidates.length} 款</span></div>
          <div class="card__body card__body--flush">
            <div class="cands">${cands}</div>
          </div>
        </section>

        <!-- 对账工作区 -->
        <div class="stack">
          <!-- ① 背对背 -->
          <section class="block">
            <div class="block__head">
              <span class="block__title">① 背对背 · 各自独立产出</span>
              <span class="block__sub">提交前互不可见</span>
            </div>
            <div class="ab">
              <div class="ab__side ab__side--human">
                <div class="ab__who">
                  <span class="ab__badge ab__badge--human">人</span>
                  <span class="ab__who-text">商品部人工画像</span>
                </div>
                <div class="field">
                  <label class="field__label" for="m-pos">人工人群定位</label>
                  <input class="field__input" id="m-pos" value="${esc(manual.position)}" />
                </div>
                <div class="field">
                  <label class="field__label" for="m-old">人工新老客比例</label>
                  <input class="field__input" id="m-old" value="${esc(manual.oldNew)}" />
                </div>
                <div class="field">
                  <label class="field__label" for="m-ch">人工首发渠道</label>
                  <input class="field__input" id="m-ch" value="${esc(manual.channel)}" />
                </div>
                <div class="hint">负责人 ${esc(manual.owner)} · 提交时间 2026-10-18</div>
              </div>

              <div class="ab__seam"><span>互不可见</span></div>

              <div class="ab__side ab__side--algo">
                <div class="ab__who">
                  <span class="ab__badge ab__badge--algo">机</span>
                  <span class="ab__who-text">算法预测画像</span>
                </div>
                <div class="field__label">Top 3 目标人群包</div>
                <div class="barlist">
                  ${pred.segments
                    .map(
                      (s) => `<div class="barlist__row">
                    <span class="barlist__label" title="${esc(s.name)}">${esc(s.name)}</span>
                    <span class="barlist__track"><span class="barlist__fill" style="width:${(s.share * 100).toFixed(0)}%"></span></span>
                    <span class="barlist__val">${(s.share * 100).toFixed(0)}%</span>
                  </div>`
                    )
                    .join('')}
                </div>
                <div class="hint mt-2">置信度 ${pred.segments.map((s) => `${esc(s.name)} ${(s.confidence * 100).toFixed(0)}%`).join(' · ')}</div>
                ${pred.riskFlags.length ? `<div class="mt-2">${chip(pred.riskFlags[0], 'warning')}</div>` : ''}
              </div>
            </div>
          </section>

          <!-- ② 面对面 -->
          <section class="block">
            <div class="block__head">
              <span class="block__title">② 面对面 · 逐维度校对</span>
              <span class="block__sub">${esc(c.status)} · ${esc(c.reviewState)}</span>
            </div>
            <div class="card">
              ${spectrum(c.diff)}
              ${diffBody}
              <div style="padding:var(--sp-3) var(--sp-4)">
                <details class="tech">
                  <summary>差异计算口径</summary>
                  <div class="tech__body">维度对齐后逐项比对 Top1 标签与占比：
JS 散度距离（0–1）与 Top3 重合度并列呈现。
缺失维度不补零，按「未知」排除并单独提示，不计入冲突。</div>
                </details>
              </div>
            </div>
          </section>
        </div>

        <!-- ③ 决策 -->
        <section class="card desk__decision">
          <div class="card__head">
            <span class="card__title">③ 决策</span>
            ${chip(c.status, c.statusTone)}
          </div>
          <div class="card__body decision">
            <div>
              <div class="field__label">建议动作</div>
              <div class="decision__proposal">${esc(c.decision)}</div>
            </div>
            <div>
              <div class="field__label">判定理由</div>
              <div class="decision__why">${esc(c.rationale)}</div>
            </div>
            <div>
              <div class="field__label">选择动作类型</div>
              <div class="stack" style="gap:var(--sp-2)">
                ${decisions
                  .map(
                    (d) => `<div class="option${d.k === activeAction ? ' is-active' : ''}" data-action="${esc(d.k)}" data-spu="${esc(c.spu)}" role="button" tabindex="0">
                  <span class="option__mark"></span>
                  <span>
                    <span class="option__title">${esc(d.t)}</span>
                    <span class="option__desc" style="display:block">${esc(d.d)}</span>
                  </span>
                </div>`
                  )
                  .join('')}
              </div>
            </div>
            <details class="tech">
              <summary>款式分类规则</summary>
              <div class="tech__body">共识款：画像重合度 ≥ 75%
盲区款：商品部低评价，算法高覆盖且高置信
争议款：商品部高评价，算法容量显著不足
异化款：双方均看好但人群结构理解不同</div>
            </details>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ── 页面：货渠匹配 ───────────────────────────────────────── */
  /**
   * 合成演示矩阵的配色分档（来自 demo-data.js）。
   * 仅用于本页的**合成示意数据**；正式匹配口径（评级门槛、熔断阈值、权重）只在
   * packages/core 的 MATCH_CONFIG 里定义一处，工具1 报告页按该配置渲染。
   */
  const DEMO_BANDS = D.demoBands;
  function heatGrade(v) {
    if (v >= DEMO_BANDS.a) return 'a';
    if (v >= DEMO_BANDS.b) return 'b';
    if (v >= DEMO_BANDS.fuse) return 'c';
    return 'x';
  }

  function pageMatch() {
    const ch = D.matchChannels;
    const pr = D.matchProducts;
    const byRow = state.matchAxis === 'row';

    // 行=商品、列=渠道
    const headers = byRow ? ch : pr;
    const bodyRows = byRow
      ? pr.map((p, i) => ({ label: p.name, cells: D.matchMatrix[i], ref: p, ids: ch.map((c) => c.id) }))
      : ch.map((c, j) => ({
          label: c.name,
          cells: D.matchMatrix.map((row) => row[j]),
          ref: c,
          ids: pr.map((p) => p.id),
        }));

    const rows = bodyRows
      .map(
        (r) => `<tr>
        <th class="heat__label">${esc(r.label)}</th>
        ${r.cells
          .map(
            (v, k) => `<td class="heat__cell heat__cell--${heatGrade(v)}"
              data-p="${esc(byRow ? r.ref.id : r.ids[k])}"
              data-c="${esc(byRow ? r.ids[k] : r.ref.id)}"
              data-v="${v}"
              title="${esc(byRow ? r.ref.name : r.ids[k])} × ${esc(byRow ? r.ids[k] : r.ref.name)}：${v}">${v}</td>`
          )
          .join('')}
      </tr>`
      )
      .join('');

    const flat = D.matchMatrix.flat();

    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">工具 1 · 货渠匹配</div>
          <h1 class="page-title">商品 × 渠道匹配矩阵</h1>
          <p class="page-desc">六维加权评分 + 客单承接。点击任一格查看该组合的正负向证据与运营建议。</p>
        </div>
        <div class="page-actions">
          <a class="btn" href="./tool1-report.html">打开工具1 报告（合成演示）</a>
        </div>
      </div>

      ${ledger([
      { label: '候选商品', value: pr.length, note: '款号级' },
      { label: '候选渠道', value: ch.length, note: '8 类渠道实体' },
      { label: '高匹配格', value: flat.filter((v) => v >= DEMO_BANDS.a).length, tone: 'high', note: `≥ ${DEMO_BANDS.a} 分，建议主推` },
      { label: '熔断格', value: flat.filter((v) => v < DEMO_BANDS.fuse).length, tone: 'low', note: `< ${DEMO_BANDS.fuse} 分，不建议` },
    ])}

      <div class="tools">
        <span class="tools__label">视角</span>
        <div class="segmented" id="matchAxis">
          <button type="button" aria-pressed="${byRow}" data-axis="row">按商品找渠道</button>
          <button type="button" aria-pressed="${!byRow}" data-axis="col">按渠道找商品</button>
        </div>
        <select class="input" aria-label="渠道类型"><option>全部渠道类型</option><option>抖音直播</option><option>天猫</option><option>实体店</option></select>
        <select class="input" aria-label="价格区间"><option>全部价格</option><option>&lt; ¥300</option><option>¥300–500</option><option>&gt; ¥500</option></select>
        <div class="tools__spacer"></div>
        <div class="legend">
          ${D.matchLegend
            .map(
              (l) => `<span class="legend__item">
            <span class="legend__swatch heat__cell--${l.tone === 'strong' ? 'a' : l.tone === 'mid' ? 'b' : l.tone === 'weak' ? 'c' : 'x'}"></span>
            ${esc(l.grade)} · ${esc(l.label)}
          </span>`
            )
            .join('')}
        </div>
      </div>

      <div class="table-wrap table-wrap--fit mb-3">
        <table class="heat">
          <thead><tr><th class="corner">${byRow ? '商品 \\ 渠道' : '渠道 \\ 商品'}</th>${headers
            .map((h) => `<th>${esc(h.name)}</th>`)
            .join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <details class="tech">
        <summary>评分口径与维度权重</summary>
        <div class="tech__body">正式评分口径只在 packages/core 的 MATCH_CONFIG 里定义一处（版本 p1-2026-11-uncalibrated），本页不复制公式、权重与阈值。
口径出处：产品讨论稿 §7.4（工具 1／工具 2 共用匹配内核）；逐条口径与权重见「工具1 报告」页底部的「评分口径与维度权重」折叠区，以及 docs/match-kernel.md。
本页数值全部为合成演示数据，不反映真实匹配结果；正式口径下权重为初值、未经真实数据校准，记「已调整」，不得称「已优化」。</div>
      </details>
    </div>`;
  }

  /* ── 页面：新品预测 ───────────────────────────────────────── */
  function pagePredict() {
    const p = D.predict;
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">工具 2 · 新品预测</div>
          <h1 class="page-title">客观属性 → 人群画像预测</h1>
          <p class="page-desc">预测路径只读取与人工判断无因果关系的客观属性，人工画像字段在界面上单独封存、不可进入预测。</p>
        </div>
        <div class="page-actions">
          <button class="btn">导出预测卡</button>
          <button class="btn btn--primary">送入货渠匹配</button>
        </div>
      </div>

      ${ledger([
      { label: 'Top1 目标人群', value: p.segments[0].name, tone: 'accent', small: true, note: '占比 ' + (p.segments[0].share * 100).toFixed(0) + '%' },
      { label: '预测置信度', value: (p.segments[0].confidence * 100).toFixed(0) + '%', tone: 'high', note: '按字段覆盖率折减' },
      { label: '相似历史款', value: p.similar.length, note: '可用于回测' },
      { label: '风险旗标', value: p.risks.length, tone: 'mid', note: '基线非训练模型' },
    ])}

      <div class="grid-2">
        <section class="card">
          <div class="card__head">
            <span class="card__title">输入 · 商品客观属性</span>
            ${chip('不含人工画像', 'info')}
          </div>
          <div class="card__body">
            <div class="field__label">预测可用字段</div>
            ${Object.entries(p.input)
              .map(
                ([k, v]) => `<div class="field">
              <label class="field__label" for="in-${esc(k)}">${esc(p.fieldLabels[k] ?? k)}</label>
              <input class="field__input" id="in-${esc(k)}" value="${esc(v)}" />
            </div>`
              )
              .join('')}

            <div class="field__label mt-4">人工侧字段 · 封存，不进预测路径</div>
            ${Object.entries(p.manualOnly)
              .map(
                ([k, v]) => `<div class="field">
              <label class="field__label" for="mo-${esc(k)}">${esc(p.fieldLabels[k] ?? k)}</label>
              <input class="field__input" id="mo-${esc(k)}" value="${esc(v)}" disabled />
            </div>`
              )
              .join('')}
            <div class="hint mt-2">人工侧字段只参与背对背的人工画像产出；预测路径只读上面的客观属性。</div>
            <button class="btn btn--primary mt-4" style="width:100%;justify-content:center" type="button">开始预测画像</button>
            <details class="tech mt-3">
              <summary>背对背隔离说明</summary>
              <div class="tech__body">预测路径只允许：品类／版型／面料／工艺／价格带／季节／上新类型／IP。
人工人群定位、人工新老客比例、人工首发渠道、人工 FAB 卖点一律不得进入。
校验点在字段目录的 usage 标记 + 独立复核。</div>
            </details>
          </div>
        </section>

        <section class="card">
          <div class="card__head"><span class="card__title">输出 · 预测画像与依据</span></div>
          <div class="card__body">
            <div class="field__label">Top 3 目标人群包</div>
            <div class="barlist mb-4">
              ${p.segments
                .map(
                  (s) => `<div class="barlist__row">
                <span class="barlist__label">${esc(s.name)}</span>
                <span class="barlist__track"><span class="barlist__fill" style="width:${(s.share * 100).toFixed(0)}%"></span></span>
                <span class="barlist__val">${(s.share * 100).toFixed(0)}%</span>
              </div>`
                )
                .join('')}
            </div>

            <div class="field__label">六维标签分布</div>
            <div class="table-wrap mb-4">
              <table class="data">
                <tbody>
                  ${p.dims
                    .map(
                      (d) => `<tr><td class="muted">${esc(d.dim)}</td><td>${esc(d.label)}</td><td class="num">${(d.share * 100).toFixed(1)}%</td></tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>

            <div class="field__label">相似历史商品</div>
            <div class="table-wrap mb-4">
              <table class="data">
                <tbody>
                  ${p.similar
                    .map(
                      (s) => `<tr><td class="mono">${esc(s.spu)}</td><td>${esc(s.name)}<span class="hint" style="display:block">${esc(s.note)}</span></td><td class="num">${s.score.toFixed(2)}</td></tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>

            <div class="diag">
              <div class="diag__flag diag__flag--warn"></div>
              <div class="diag__body">
                <div class="diag__title">${esc(p.risks.join(' · '))}</div>
                <div class="diag__desc">${esc(p.riskNote)}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ── 页面：画像库 ─────────────────────────────────────────── */
  function pageChannelProfile() {
    const total = D.channelProfiles.length;
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">数据与画像</div>
          <h1 class="page-title">渠道画像库</h1>
          <p class="page-desc">渠道 / 店铺 / 账号 / 门店的人群画像，经统一维度归一后可在跨平台间比较。</p>
        </div>
        <div class="page-actions"><button class="btn btn--primary">批量货渠匹配分析</button></div>
      </div>
      ${ledger([
      { label: '索引渠道', value: 168, note: '全部渠道实体' },
      { label: '有画像', value: total, tone: 'accent', note: '可参与匹配' },
      { label: '最高覆盖率', value: (Math.max(...D.channelProfiles.map((c) => c.coverage)) * 100).toFixed(0), unit: '%', tone: 'high', note: '归一后可比较' },
      { label: '数据月份', value: '2026-10', small: true, tone: 'mid', note: '部分渠道为 09' },
    ])}
      <div class="tools">
        <input class="input" placeholder="搜索渠道名或编码" aria-label="搜索渠道" />
        <select class="input" aria-label="渠道类型"><option>全部类型</option><option>抖音直播</option><option>天猫</option><option>实体店</option></select>
        <select class="input" aria-label="月份"><option>2026-10</option><option>2026-09</option></select>
        <div class="tools__spacer"></div>
        <span class="tools__hint">当前索引 168 个渠道，其中 ${total} 个有画像</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>编码</th><th>渠道</th><th>类型</th><th>平台</th><th>月份</th><th class="num">覆盖率</th><th class="num">样本量</th><th>主要特征</th></tr></thead>
          <tbody>
            ${D.channelProfiles
              .map(
                (c) => `<tr>
              <td class="mono">${esc(c.id)}</td><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${esc(c.platform)}</td>
              <td class="nowrap">${esc(c.month)}</td><td class="num">${(c.coverage * 100).toFixed(0)}%</td><td class="num">${c.sample.toLocaleString()}</td>
              <td class="muted">${esc(c.top.join(' · '))}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="empty">其余 ${168 - total} 个渠道暂无人群画像数据</div>
    </div>`;
  }

  function pageProductProfile() {
    const total = D.productProfiles.length;
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">数据与画像</div>
          <h1 class="page-title">商品画像库</h1>
          <p class="page-desc">品类 / 系列 / 款号的真实消费人群，支持跨渠道对比与相似款钻取。</p>
        </div>
        <div class="page-actions"><button class="btn">导入商品属性表</button></div>
      </div>
      ${ledger([
      { label: '索引商品', value: 246, note: '款号级' },
      { label: '有单品画像', value: total, tone: 'accent', note: '可参与匹配' },
      { label: '最高覆盖率', value: (Math.max(...D.productProfiles.map((p) => p.coverage)) * 100).toFixed(0), unit: '%', tone: 'high', note: '归一后可比较' },
      { label: '相似款检索', value: '可用', small: true, tone: 'mid', note: '基于属性与画像' },
    ])}
      <div class="tools">
        <input class="input" placeholder="搜索款号或商品名" aria-label="搜索商品" />
        <select class="input" aria-label="品类"><option>全部品类</option><option>短袖 T 恤</option><option>羽绒服</option></select>
        <div class="tools__spacer"></div>
        <span class="tools__hint">索引 246 款；${total} 款有单品画像</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>款号</th><th>商品</th><th>品类</th><th>月份</th><th class="num">覆盖率</th><th>主要特征</th></tr></thead>
          <tbody>
            ${D.productProfiles
              .map(
                (p) => `<tr>
              <td class="mono">${esc(p.spu)}</td><td>${esc(p.name)}</td><td>${esc(p.cat)}</td>
              <td class="nowrap">${esc(p.month)}</td><td class="num">${(p.coverage * 100).toFixed(0)}%</td><td class="muted">${esc(p.top.join(' · '))}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ── 页面：标签反查 ───────────────────────────────────────── */
  const TAG_DIM_LABEL = {
    strategy_segment: '策略人群',
    city_tier: '城市等级',
    spending_power: '消费能力',
    gender: '性别',
  };

  function pageTagSearch() {
    const hits = D.tagHits[state.tagDim + '|' + state.tagLabel] || [];
    const maxTgi = hits.length ? Math.max(...hits.map((h) => h.tgi)) : 1;
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">数据与画像</div>
          <h1 class="page-title">标签反查</h1>
          <p class="page-desc">按人群标签反查商品与渠道：人群反过来找货。TGI 越高，代表该实体相对基准人群越偏好此标签。</p>
        </div>
      </div>
      <div class="tools">
        <span class="tools__label">维度</span>
        <select class="input" id="tagDim">
          ${Object.keys(D.tagIndex)
            .map(
              (k) =>
                `<option value="${esc(k)}"${k === state.tagDim ? ' selected' : ''}>${esc(TAG_DIM_LABEL[k] ?? k)}</option>`
            )
            .join('')}
        </select>
        <select class="input" id="tagLabel">
          ${D.tagIndex[state.tagDim]
            .map((l) => `<option value="${esc(l)}"${l === state.tagLabel ? ' selected' : ''}>${esc(l)}</option>`)
            .join('')}
        </select>
        <select class="input" aria-label="范围"><option>全部</option><option>仅商品</option><option>仅渠道</option></select>
        <div class="tools__spacer"></div>
        <span class="tools__hint">仅统一维度上的标签可反查；平台原生未映射标签不参与</span>
      </div>
      ${ledger([
      { label: '命中实体', value: hits.length, note: `${TAG_DIM_LABEL[state.tagDim] ?? state.tagDim} · ${state.tagLabel}` },
      { label: '其中商品', value: hits.filter((h) => h.type === '商品').length },
      { label: '其中渠道', value: hits.filter((h) => h.type === '渠道').length },
      { label: '最高 TGI', value: hits.length ? Math.max(...hits.map((h) => h.tgi)) : '—', tone: 'accent', note: '相对基准人群' },
    ])}
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>实体</th><th>类型</th><th>月份</th><th class="num">占比</th><th class="num">TGI</th><th style="width:26%">TGI 强度</th></tr></thead>
          <tbody>
            ${
              hits.length
                ? hits
                    .map(
                      (h) => `<tr>
                <td>${esc(h.entity)}</td><td>${chip(h.type, h.type === '商品' ? 'info' : 'algo')}</td>
                <td class="nowrap">${esc(h.month)}</td><td class="num">${(h.share * 100).toFixed(1)}%</td><td class="num">${h.tgi}</td>
                <td><span class="barlist__track" style="display:block"><span class="barlist__fill" style="display:block;width:${((h.tgi / maxTgi) * 100).toFixed(0)}%"></span></span></td>
              </tr>`
                    )
                    .join('')
                : '<tr><td colspan="6" class="muted" style="text-align:center;padding:28px">该标签当前无命中实体</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ── 页面：数据源管理 ─────────────────────────────────────── */
  function pageDatasource() {
    const tools = D.datasource.tools;
    const okCount = tools.filter((t) => t.ok).length;
    const missing = tools.filter((t) => !t.ok);
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">数据与画像</div>
          <h1 class="page-title">数据源管理</h1>
          <p class="page-desc">每个工具的数据就绪状态与缺失原因。文件到位即自动启用，无需改代码。</p>
        </div>
        <div class="page-actions"><button class="btn btn--primary">导入数据包</button></div>
      </div>
      ${ledger([
      { label: '工具数据就绪', value: okCount + ' / ' + tools.length, tone: okCount === tools.length ? 'high' : 'mid' },
      { label: '待补数据源', value: missing.length, tone: 'mid', note: '文件到位即自动启用' },
      { label: '导入批次', value: D.datasource.batches.length, note: '最近 4 个' },
      { label: '数据月份', value: '2026-10', note: '最新可用' },
    ])}
      <div class="grid-2">
        <section class="card">
          <div class="card__head"><span class="card__title">工具数据就绪</span>${chip(missing.length + ' 项待补', 'warning')}</div>
          <div class="card__body card__body--flush">
            <table class="data">
              <thead><tr><th>工具</th><th style="width:74px">状态</th><th>说明</th></tr></thead>
              <tbody>
                ${tools
                  .map(
                    (t) => `<tr>
                  <td class="mono">${esc(t.name)}</td>
                  <td>${chip(t.ok ? '就绪' : '待补', t.ok ? 'success' : 'warning')}</td>
                  <td class="muted">${esc(t.note)}</td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
        <section class="card">
          <div class="card__head"><span class="card__title">导入批次</span></div>
          <div class="card__body card__body--flush">
            <table class="data">
              <thead><tr><th>批次</th><th>来源</th><th>规模</th><th>状态</th><th>导入时间</th></tr></thead>
              <tbody>
                ${D.datasource.batches
                  .map(
                    (b) => `<tr>
                  <td class="mono">${esc(b.id)}</td><td>${esc(b.source)}</td><td class="muted">${esc(b.rows)}</td>
                  <td>${chip(b.status, 'success')}</td><td class="muted nowrap">${esc(b.at)}</td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ── 页面：留存与回购 ─────────────────────────────────────── */
  function pageRetention() {
    const r = D.retention;

    // cohort 热力：留存率越高颜色越深（单色蓝序列）
    const cohortCell = (v) => {
      if (v === null || v === undefined) {
        return `<td class="heat__cell heat__cell--none">—</td>`;
      }
      const g = v >= 17 ? 'a' : v >= 12 ? 'b' : v >= 8 ? 'c' : 'd';
      return `<td class="heat__cell heat__cell--${g}">${v}</td>`;
    };
    const cohortRows = r.cohorts
      .map(
        (c) => `<tr>
        <th class="heat__label">${esc(c.m)} <span class="muted">${c.n.toLocaleString()}</span></th>
        ${cohortCell(c.d30)}${cohortCell(c.d60)}${cohortCell(c.d90)}${cohortCell(c.next)}
      </tr>`
      )
      .join('');

    // 流转矩阵：回流比例越高越深
    const flowCell = (v) => {
      const g = v >= 0.6 ? 'a' : v >= 0.25 ? 'b' : 'c';
      return `<td class="heat__cell heat__cell--${g}">${(v * 100).toFixed(0)}%</td>`;
    };
    const flowRows = r.flow.rows
      .map(
        (rowName, i) =>
          `<tr><th class="heat__label">${esc(rowName)}</th>${(r.flow.v[i] ?? [])
            .map(flowCell)
            .join('')}</tr>`
      )
      .join('');

    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">经营 · 需求三</div>
          <h1 class="page-title">留存与回购</h1>
          <p class="page-desc">大盘人群结构 · Cohort 留存 · 老客来源时效 · 跨渠道流转 · 三大诊断。</p>
        </div>
        <div class="page-actions">
          <select class="input" aria-label="统计月份"><option>2026-10</option><option>2026-09</option></select>
          <button class="btn">导出</button>
        </div>
      </div>

      ${ledger([
      { label: '当月买家', value: '30万', note: '五类客群合计' },
      { label: '二回跃迁', value: '13.6%', tone: 'high', note: 'D60，高于 10% 阈值' },
      { label: '召回客占比', value: '25%', tone: 'mid', note: '毛利 35%，接近警戒线' },
      { label: '清仓客次季转化', value: '1.2%', tone: 'low', note: '低于 2% 基线' },
    ])}

      <section class="block">
        <div class="block__head">
          <span class="block__title">月度大盘人群贡献结构</span>
          <span class="block__sub">买家数、GMV 贡献与连带率</span>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>客群</th><th class="num">买家数</th><th>占比</th><th class="num">MoM</th><th class="num">YoY</th><th class="num">GMV</th><th class="num">GMV 占比</th><th class="num">客单价</th><th class="num">连带率</th></tr></thead>
            <tbody>
              ${r.structure
                .map(
                  (s) => `<tr>
                <td>${esc(s.seg)}</td><td class="num">${s.buyers.toLocaleString()}</td><td>${esc(s.share)}</td>
                <td class="num">${esc(s.mom)}</td><td class="num">${esc(s.yoy)}</td>
                <td class="num">${esc(s.gmv)}</td><td class="num">${esc(s.gmvShare)}</td>
                <td class="num">${esc(s.aov)}</td><td class="num">${esc(s.upt)}</td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2">
        <div>
          <section class="block">
            <div class="block__head">
              <span class="block__title">新客 Cohort 留存（%）</span>
              <span class="block__sub">颜色越深留存越高</span>
            </div>
            <div class="table-wrap">
              <table class="heat heat--blue">
                <thead><tr><th class="corner">首购月 \\ 留存</th><th>D30</th><th>D60</th><th>D90</th><th>次季正价</th></tr></thead>
                <tbody>${cohortRows}</tbody>
              </table>
            </div>
          </section>

          <section class="block">
            <div class="block__head"><span class="block__title">老客来源时效分布</span></div>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Recency</th><th class="num">回购人数</th><th>占比</th><th>主推品类</th><th>主要渠道</th><th class="num">毛利率</th></tr></thead>
                <tbody>
                  ${r.recency
                    .map(
                      (x) => `<tr><td>${esc(x.band)}</td><td class="num">${x.buyers.toLocaleString()}</td>
                    <td>${esc(x.share)}</td><td class="muted">${esc(x.cat)}</td><td class="muted">${esc(x.channel)}</td>
                    <td class="num">${esc(x.margin)}</td></tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div>
          <section class="block">
            <div class="block__head">
              <span class="block__title">老客跨渠道流转矩阵</span>
              <span class="block__sub">行=来源，列=回流</span>
            </div>
            <div class="table-wrap">
              <table class="heat heat--flow">
                <thead><tr><th class="corner">来源 \\ 回流</th>${r.flow.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
                <tbody>${flowRows}</tbody>
              </table>
            </div>
          </section>

          <section class="block">
            <div class="block__head"><span class="block__title">三大诊断</span></div>
            ${r.diagnosis
              .map(
                (d) => `<div class="diag">
              <div class="diag__flag diag__flag--${d.flag === 'ok' ? 'ok' : d.flag === 'warn' ? 'warn' : 'bad'}"></div>
              <div class="diag__body">
                <div class="diag__title">${esc(d.title)} ${chip(d.metric, 'neutral')}</div>
                <div class="diag__desc">${esc(d.desc)}</div>
              </div>
            </div>`
              )
              .join('')}
          </section>
        </div>
      </div>
    </div>`;
  }

  /* ── 页面：复盘飞轮 ───────────────────────────────────────── */
  function pageFlywheel() {
    return `
    <div class="page is-active">
      <div class="page-head">
        <div>
          <div class="page-head__eyebrow">经营</div>
          <h1 class="page-title">复盘飞轮</h1>
          <p class="page-desc">决策 → 行动 → 反馈 → 复盘，把每次判断沉淀成下一次可复用的经验。</p>
        </div>
        <div class="page-actions"><button class="btn btn--primary">记录新决策</button></div>
      </div>
      ${ledger([
      { label: '决策记录', value: D.flywheel.length },
      { label: '待复盘', value: D.flywheel.filter((f) => f.state === '待复盘').length, tone: 'mid' },
      { label: '已验证', value: D.flywheel.filter((f) => f.state === '已验证').length, tone: 'high' },
      { label: '需调整', value: D.flywheel.filter((f) => f.state === '需调整').length, tone: 'low' },
    ])}
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>目标商品</th><th>目标渠道</th><th>推荐依据</th><th>行动</th><th>日期</th><th>状态</th></tr></thead>
          <tbody>
            ${D.flywheel
              .map(
                (f) => `<tr>
              <td class="mono">${esc(f.spu)}</td><td>${esc(f.target)}</td>
              <td class="muted">${esc(f.basis)}</td><td>${esc(f.action)}</td>
              <td class="muted nowrap">${esc(f.date)}</td>
              <td>${chip(f.state, f.tone)}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ── 导航 ─────────────────────────────────────────────────── */
  const NAV = [
    {
      group: '决策主线',
      items: [
        { id: 'review', name: '选品评审台', note: '' },
        { id: 'match', name: '货渠匹配', note: 'P1' },
        { id: 'predict', name: '新品预测', note: 'P2' },
      ],
    },
    {
      group: '数据与画像',
      items: [
        { id: 'channel-profile', name: '渠道画像库' },
        { id: 'product-profile', name: '商品画像库' },
        { id: 'tag-search', name: '标签反查' },
        { id: 'datasource', name: '数据源管理', note: String(D.datasource.tools.filter((t) => !t.ok).length), warn: true },
      ],
    },
    {
      group: '经营',
      items: [
        { id: 'retention', name: '留存与回购', note: 'P3' },
        { id: 'flywheel', name: '复盘飞轮' },
      ],
    },
  ];

  const PAGES = {
    review: pageReview,
    match: pageMatch,
    predict: pagePredict,
    'channel-profile': pageChannelProfile,
    'product-profile': pageProductProfile,
    'tag-search': pageTagSearch,
    datasource: pageDatasource,
    retention: pageRetention,
    flywheel: pageFlywheel,
  };

  function renderNav() {
    let n = 1;
    rail.innerHTML = NAV.map(
      (g) => `<div class="rail__group">
      <div class="rail__label">${esc(g.group)}</div>
      ${g.items
        .map((it) => {
          const idx = String(n++).padStart(2, '0');
          return `<button class="rail__item" type="button" data-page="${esc(it.id)}">
            <span class="idx">${idx}</span><span>${esc(it.name)}</span>
            ${it.note ? `<span class="rail__note${it.warn ? ' rail__note--warn' : ''}">${esc(it.note)}</span>` : ''}
          </button>`;
        })
        .join('')}
    </div>`
    ).join('');
  }

  /* ── 事件绑定 ─────────────────────────────────────────────── */
  function bind() {
    work.querySelectorAll('[data-spu]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        state.spu = el.getAttribute('data-spu');
        render();
      });
    });

    work.querySelectorAll('[data-action]').forEach((el) => {
      const pick = () => {
        state.decision[el.getAttribute('data-spu')] = el.getAttribute('data-action');
        render();
      };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
    });

    work.querySelectorAll('.heat__cell[data-p]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const p = D.matchProducts.find((x) => x.id === cell.dataset.p);
        const c = D.matchChannels.find((x) => x.id === cell.dataset.c);
        const v = Number(cell.dataset.v);
        const grade = v >= DEMO_BANDS.a ? 'A 级 · 建议主推' : v >= DEMO_BANDS.b ? 'B 级 · 建议微调' : v >= DEMO_BANDS.fuse ? 'C 级 · 慎选' : 'C 级 · 熔断不建议';
        const tone = v >= DEMO_BANDS.a ? 'success' : v >= DEMO_BANDS.b ? 'info' : v >= DEMO_BANDS.fuse ? 'warning' : 'danger';
        openDrawer(
          `${p.name} × ${c.name}`,
          `<div class="hint">匹配分</div>
           <div class="drawer__score">${v}</div>
           <div class="row mt-2" style="gap:8px">
             ${chip(grade, tone)}${chip(c.type, 'neutral')}${chip(c.grade, 'neutral')}
           </div>
           <div class="mt-4">
             <div class="field__label">正向驱动</div>
             ${D.matchDetail.positive.map((t) => `<div class="kv"><span class="kv__mark" style="color:var(--sev-high)">+</span><span>${esc(t)}</span></div>`).join('')}
             <div class="field__label mt-3">负向拦截</div>
             ${D.matchDetail.negative.map((t) => `<div class="kv"><span class="kv__mark" style="color:var(--sev-low)">−</span><span>${esc(t)}</span></div>`).join('')}
             <div class="field__label mt-3">运营建议</div>
             <div style="font-size:13px">${esc(D.matchDetail.advice)}</div>
             <div class="field__label mt-3">风险提示</div>
             ${D.matchDetail.risks.map((t) => `<div class="hint">· ${esc(t)}</div>`).join('')}
           </div>`,
          `<button class="btn">加入决策记录</button><button class="btn btn--primary">模拟目标用户反馈</button>`
        );
      });
    });

    const dimSel = work.querySelector('#tagDim');
    const labelSel = work.querySelector('#tagLabel');
    if (dimSel && labelSel) {
      dimSel.addEventListener('change', () => {
        state.tagDim = dimSel.value;
        state.tagLabel = D.tagIndex[state.tagDim][0];
        render();
      });
      labelSel.addEventListener('change', () => {
        state.tagLabel = labelSel.value;
        render();
      });
    }

    const axisBox = work.querySelector('#matchAxis');
    if (axisBox) {
      axisBox.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.matchAxis = btn.getAttribute('data-axis');
          render();
        });
      });
    }
  }

  function render() {
    work.innerHTML = PAGES[state.page]();
    rail.querySelectorAll('.rail__item').forEach((n) => {
      if (n.dataset.page === state.page) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
    bind();
  }

  function goto(page, updateHash) {
    state.page = page;
    closeDrawer();
    if (updateHash !== false) history.replaceState(null, '', '#' + page);
    render();
    work.scrollTop = 0;
  }

  rail.addEventListener('click', (e) => {
    const item = e.target.closest('.rail__item');
    if (item) goto(item.dataset.page);
  });

  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '');
    if (PAGES[page]) goto(page, false);
  });

  /* ── 启动 ─────────────────────────────────────────────────── */
  const readyCount = D.datasource.tools.filter((t) => t.ok).length;
  const totalCount = D.datasource.tools.length;
  document.getElementById('lampText').textContent = `数据就绪 ${readyCount} / ${totalCount}`;
  document.getElementById('lamp').dataset.state = readyCount === totalCount ? 'full' : 'partial';
  document.getElementById('lamp').title = `${totalCount - readyCount} 个工具的数据源尚未接入`;

  renderNav();
  applyTheme(localStorage.getItem('uom-theme') || 'light');
  const initial = location.hash.replace('#', '');
  goto(PAGES[initial] ? initial : 'review', false);
})();
