/**
 * UI Demo 交互脚本。纯前端演示，无后端依赖。
 */
(() => {
  const D = window.DEMO;
  const main = document.getElementById('main');
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let currentPage = 'review';
  let selectedSpu = D.reviewBatch.candidates[0].spu;
  let selectedMatch = null;
  let matchMode = 'sku-to-channel';
  let tagDim = 'strategy_segment';
  let tagLabel = '都市蓝领';

  /* ── 主题 ─────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('uom-theme', t);
    document.getElementById('themeBtn').textContent = t === 'dark' ? '◑ 亮色' : '◐ 暗色';
  }
  window.toggleTheme = () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  /* ── 抽屉 ─────────────────────────────────────────────── */
  window.closeDrawer = () => {
    document.getElementById('drawer').classList.remove('is-open');
    document.getElementById('backdrop').classList.remove('is-open');
    selectedMatch = null;
  };
  function openDrawer(title, body, foot) {
    document.getElementById('drawerTitle').textContent = title;
    document.getElementById('drawerBody').innerHTML = body;
    document.getElementById('drawerFoot').innerHTML = foot || '';
    document.getElementById('drawer').classList.add('is-open');
    document.getElementById('backdrop').classList.add('is-open');
  }

  /* ── 页面片段 ─────────────────────────────────────────── */
  function summaryRow(cells) {
    return `<div class="summary">${cells
      .map(
        (c) => `<div class="summary__cell ${c.tone ? 'summary__cell--' + c.tone : ''}">
        <div class="summary__label">${esc(c.label)}</div>
        <div class="summary__value">${esc(c.value)}</div>
        ${c.note ? `<div class="summary__note">${esc(c.note)}</div>` : ''}
      </div>`
      )
      .join('')}</div>`;
  }


  /** 差异行：维度名 + 人工值 ↔ 算法值 + 差异强度条。 */
  function diffRow(d) {
    const alignLabel = { high: '高度吻合', mid: '存在偏离', low: '显著冲突' }[d.align] || '';
    const alignTone = { high: 'success', mid: 'warning', low: 'danger' }[d.align] || 'neutral';
    const width = Math.min(100, d.delta * 3.2);
    return `<div class="diffrow">
      <div class="diffrow__head">
        <div class="diffrow__dim">${esc(d.dim)}</div>
        <div class="diffrow__val diffrow__val--manual">${esc(d.manual)}</div>
        <div class="diffrow__arrow">↔</div>
        <div class="diffrow__val diffrow__val--algo">${esc(d.algo)}<span class="diffrow__delta">差 ${d.delta}pp</span></div>
      </div>
      <div class="diffbar" title="${esc(alignLabel)}">
        <div class="diffbar__fill diffbar__fill--${alignTone}" style="width:${width}%"></div>
      </div>
    </div>`;
  }

  function pageReview() {
    const b = D.reviewBatch;
    const c = b.candidates.find((x) => x.spu === selectedSpu) || b.candidates[0];
    const counts = {
      共识款: b.candidates.filter((x) => x.status === '共识款').length,
      盲区款: b.candidates.filter((x) => x.status === '盲区款').length,
      争议款: b.candidates.filter((x) => x.status === '争议款').length,
      异化款: b.candidates.filter((x) => x.status === '异化款').length,
      待评审: b.candidates.filter((x) => x.status === '待评审').length,
    };

    const list = b.candidates
      .map(
        (x) => `<tr data-spu="${esc(x.spu)}" class="${x.spu === selectedSpu ? 'is-selected' : ''}" style="cursor:pointer">
      <td class="mono">${esc(x.spu)}</td>
      <td>${esc(x.name)}</td>
      <td>${esc(x.category)}</td>
      <td class="num">${esc(x.price)}</td>
      <td><span class="badge badge--${x.statusTone}">${esc(x.status)}</span></td>
      <td class="num">${x.similarity === null ? '<span class="muted">—</span>' : x.similarity + '%'}</td>
    </tr>`
      )
      .join('');

    const manual = c.manual;
    const pred = c.predicted;

    const diffRows = c.diff.length
      ? c.diff.map((d) => diffRow(d)).join('')
      : '<div class="empty"><div class="empty__title">该款尚无人工画像，无差异可比</div></div>';

    const decisions = [
      { k: '放量', t: '放量定单', d: '按正常或追加深度备货' },
      { k: '测款', t: '小单快反', d: '浅备 + 锁定面料，私域定向测' },
      { k: '降级', t: '降级首发', d: '压首单深度，要求专属流量资源' },
      { k: '改话术', t: '修正 FAB', d: '保留货品，拆多版本详情页 AB 测试' },
    ];

    return `
    <div class="page is-active" id="page-review">
      <div class="context-row">
        <div>
          <h1 class="page-title">选品评审台</h1>
          <p class="page-desc">${esc(b.name)} · 数据月份 ${esc(b.month)} · 双方互不可见预测值的独立产出</p>
        </div>
        <div class="context-actions">
          <button class="btn">导出评审纪要</button>
          <button class="btn btn--primary">固化本轮决策</button>
        </div>
      </div>

      ${summaryRow([
      { label: '待评审', value: counts['待评审'] + ' 款', note: '其中 1 款阻塞' },
      { label: '共识款', value: counts['共识款'], tone: 'success', note: '重合度 ≥ 75%' },
      { label: '盲区款', value: counts['盲区款'], tone: 'accent', note: '算法看好，经验看衰' },
      { label: '争议款', value: counts['争议款'], tone: 'warning', note: '经验看好，算法看衰' },
      { label: '异化款', value: counts['异化款'], note: '人群理解错位' },
    ])}

      <div class="toolbar">
        <span class="toolbar__label">候选商品</span>
        <div class="segmented">
          <button aria-pressed="true">全部 ${b.candidates.length}</button>
          <button aria-pressed="false">待评审</button>
          <button aria-pressed="false">有争议</button>
        </div>
        <div class="toolbar__spacer"></div>
        <span class="toolbar__label">视图</span>
        <div class="segmented">
          <button aria-pressed="true">决策视图</button>
          <button aria-pressed="false">分析视图</button>
        </div>
      </div>

      <div class="table-wrap mb-3">
        <table class="data">
          <thead><tr>
            <th>款号</th><th>商品</th><th>品类</th><th style="text-align:right">吊牌价</th>
            <th>款式分类</th><th style="text-align:right">画像重合度</th>
          </tr></thead>
          <tbody>${list}</tbody>
        </table>
      </div>

      <div class="lanes">
        <!-- 背对背 -->
        <section class="lane">
          <div class="lane__head">
            <span class="lane__title"><span class="lane__step">1</span> 背对背 · 独立产出</span>
            <span class="badge badge--neutral">互不可见</span>
          </div>
          <div class="lane__body">
            <div class="mb-3">
              <div class="field__label">商品部人工画像（人工提交）</div>
              <div class="field"><input class="field__input" value="${esc(manual.position)}" aria-label="人工人群定位" /></div>
              <div class="field"><input class="field__input" value="${esc(manual.oldNew)}" aria-label="人工新老客比例" /></div>
              <div class="field"><input class="field__input" value="${esc(manual.channel)}" aria-label="人工首发渠道" /></div>
              <div class="hint">负责人 ${esc(manual.owner)} · 提交时间 2026-10-18</div>
            </div>
            <div>
              <div class="field__label">算法预测画像（模型产出）</div>
              <div class="barlist">
                ${pred.segments
                  .map(
                    (s) => `<div class="barlist__row">
                  <div class="barlist__label">${esc(s.name)}</div>
                  <div class="barlist__track"><div class="barlist__fill" style="width:${(s.share * 100).toFixed(0)}%"></div></div>
                  <div class="barlist__val">${(s.share * 100).toFixed(0)}%</div>
                </div>`
                  )
                  .join('')}
              </div>
              <div class="hint mt-2">置信度 ${pred.segments.map((s) => s.name + ' ' + (s.confidence * 100).toFixed(0) + '%').join(' · ')}</div>
              ${
                pred.riskFlags.length
                  ? `<div class="mt-2"><span class="badge badge--warning">${esc(pred.riskFlags[0])}</span></div>`
                  : ''
              }
            </div>
          </div>
        </section>

        <!-- 面对面 -->
        <section class="lane">
          <div class="lane__head">
            <span class="lane__title"><span class="lane__step">2</span> 面对面 · 逐维度校对</span>
            <span class="badge badge--${c.statusTone}">${esc(c.status)}</span>
          </div>
          <div class="lane__body">
            ${
              c.diff.length
                ? `<div class="barlist mb-2">
              ${c.diff.map((d) => diffRow(d)).join('')}
            </div>
            <div class="row" style="gap:16px;flex-wrap:wrap">
              <span class="badge badge--success">高度吻合 ${c.diff.filter((d) => d.align === 'high').length}</span>
              <span class="badge badge--warning">存在偏离 ${c.diff.filter((d) => d.align === 'mid').length}</span>
              <span class="badge badge--danger">显著冲突 ${c.diff.filter((d) => d.align === 'low').length}</span>
            </div>`
                : '<div class="empty"><div class="empty__title">人工画像未提交，无法校对</div></div>'
            }
            <details class="tech">
              <summary>差异计算口径</summary>
              <div class="tech__body">维度对齐后逐项比对 Top1 标签与占比：
JS 散度距离（0–1）与 Top3 重合度并列呈现。
缺失维度不补零，按「未知」排除并单独提示，不计入冲突。</div>
            </details>
          </div>
        </section>

        <!-- 决策 -->
        <section class="lane">
          <div class="lane__head">
            <span class="lane__title"><span class="lane__step">3</span> 决策</span>
            <span class="badge badge--neutral">${esc(c.reviewState)}</span>
          </div>
          <div class="lane__body">
            <div class="field__label">建议动作</div>
            <div class="mb-3" style="font-size:13px">${esc(c.decision)}</div>
            <div class="field__label">判定理由</div>
            <div class="mb-3" style="font-size:13px;color:var(--text-secondary)">${esc(c.rationale)}</div>
            <div class="field__label">选择动作类型</div>
            ${decisions
              .map(
                (d) => `<div class="decision${d.k === '放量' && c.status === '共识款' ? ' is-active' : ''}">
              <div class="decision__mark"></div>
              <div class="decision__body">
                <div class="decision__title">${esc(d.t)}</div>
                <div class="decision__desc">${esc(d.d)}</div>
              </div>
            </div>`
              )
              .join('')}
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

  function pageMatch() {
    const ch = D.matchChannels;
    const pr = D.matchProducts;
    const head = ch
      .map((c) => `<th>${esc(c.name)}</th>`)
      .join('');
    const rows = pr
      .map((p, i) => {
        const cells = D.matchMatrix[i]
          .map((v, j) => {
            const tone = v >= 80 ? 'var(--success-500)' : v >= 60 ? 'var(--info-500)' : v >= 45 ? 'var(--warning-500)' : 'var(--danger-500)';
            // 用 color-mix 控制底色深浅，字色随之切换，保证任何分数都可读
            const mix = Math.round(Math.max(12, Math.min(88, (v - 20) / 78 * 100)));
            const fg = v >= 60 ? '#fff' : 'var(--text-primary)';
            return `<td class="heat__cell" data-p="${esc(p.id)}" data-c="${esc(ch[j].id)}" data-v="${v}"
              style="background:color-mix(in srgb, ${tone} ${mix}%, var(--bg-surface));color:${fg}"
              title="${esc(p.name)} × ${esc(ch[j].name)}：${v}">${v}</td>`;
          })
          .join('');
        return `<tr><th class="heat__label">${esc(p.name)}</th>${cells}</tr>`;
      })
      .join('');

    return `
    <div class="page is-active" id="page-match">
      <div class="context-row">
        <div>
          <h1 class="page-title">货渠匹配</h1>
          <p class="page-desc">规则版匹配（工具 1）· 六维加权评分 + 客单承接 · 点击单元格查看明细</p>
        </div>
        <div class="context-actions">
          <button class="btn">导出匹配报告</button>
        </div>
      </div>

      ${summaryRow([
      { label: '候选商品', value: pr.length, note: '款号级' },
      { label: '候选渠道', value: ch.length, note: '8 类渠道实体' },
      { label: '高匹配格', value: D.matchMatrix.flat().filter((v) => v >= 80).length, tone: 'success', note: '≥ 80 分' },
      { label: '熔断格', value: D.matchMatrix.flat().filter((v) => v < 45).length, tone: 'danger', note: '< 45 分' },
    ])}

      <div class="toolbar">
        <span class="toolbar__label">视角</span>
        <div class="segmented" id="matchMode">
          <button aria-pressed="${matchMode === 'sku-to-channel'}" data-m="sku-to-channel">按商品找渠道</button>
          <button aria-pressed="${matchMode === 'channel-to-sku'}" data-m="channel-to-sku">按渠道找商品</button>
        </div>
        <select class="input input--sm" aria-label="渠道类型"><option>全部渠道类型</option><option>抖音直播</option><option>天猫</option><option>实体店</option></select>
        <select class="input input--sm" aria-label="价格区间"><option>全部价格</option><option>&lt; ¥300</option><option>¥300–500</option><option>&gt; ¥500</option></select>
        <div class="toolbar__spacer"></div>
        <span class="hint">评分含客单承接扣分；地域与品类维度按真实分布计算</span>
      </div>

      <div class="table-wrap">
        <table class="heat">
          <thead><tr><th class="heat__corner">商品 \\ 渠道</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <details class="tech">
        <summary>评分口径与维度权重</summary>
        <div class="tech__body">口径出处：产品讨论稿 §7.4（工具 1／工具 2 共用匹配内核）。
单维度分 = 0.60 × JS 相似度 + 0.25 × 余弦相似度 + 0.15 × Top3 重合度；缺维度时对有效维度重归一化。
综合分 = Σ(维度分 × 权重) / Σ权重 + 客单惩罚，裁剪到 [25, 99.5]。
权重（初值，待真实数据校准）：性别 0.10 · 年龄段 0.20 · 消费能力 0.15 · 城市等级 0.10 · 策略人群 0.25 · 人生阶段 0.20。
评级：A ≥ 80，B 60–79.9，C &lt; 60；C 级内 &lt; 45 分触发熔断（不建议投放）。
界面数值为合成示意；正式口径以 packages/core 配置为准。</div>
      </details>
    </div>`;
  }

  function pagePredict() {
    const p = D.predict;
    return `
    <div class="page is-active" id="page-predict">
      <div class="context-row">
        <div>
          <h1 class="page-title">新品预测</h1>
          <p class="page-desc">属性 → 人群画像预测（工具 2）· 只吃客观属性，不吃人工画像</p>
        </div>
        <div class="context-actions">
          <button class="btn">导出预测卡</button>
          <button class="btn btn--primary">送入货渠匹配</button>
        </div>
      </div>

      ${summaryRow([
      { label: 'Top1 目标人群', value: p.segments[0].name, tone: 'accent', note: '占比 ' + (p.segments[0].share * 100).toFixed(0) + '%' },
      { label: '预测置信度', value: (p.segments[0].confidence * 100).toFixed(0) + '%', note: '按字段覆盖率折减' },
      { label: '相似历史款', value: p.similar.length, note: '可用于回测' },
      { label: '风险旗标', value: p.risks.length, tone: 'warning', note: 'baseline 非训练模型' },
    ])}

      <div class="grid-2">
        <section class="lane">
          <div class="lane__head"><span class="lane__title">输入 · 商品客观属性</span><span class="badge badge--neutral">不含人工画像</span></div>
          <div class="lane__body">
            <div class="field__label">预测可用字段（客观属性）</div>
            ${Object.entries(p.input)
              .map(
                ([k, v]) => `<div class="field">
              <label class="field__label">${esc(p.fieldLabels[k] ?? k)}</label>
              <input class="field__input" value="${esc(v)}" />
            </div>`
              )
              .join('')}
            <div class="field__label mt-3">人工侧字段（不进预测路径）</div>
            ${Object.entries(p.manualOnly)
              .map(
                ([k, v]) => `<div class="field">
              <label class="field__label">${esc(p.fieldLabels[k] ?? k)}</label>
              <input class="field__input" value="${esc(v)}" disabled style="opacity:.6;cursor:not-allowed" />
            </div>`
              )
              .join('')}
            <div class="hint mt-2">人工侧字段只参与背对背的人工画像产出；预测路径只读上面的客观属性。</div>
            <button class="btn btn--primary mt-3" style="width:100%;justify-content:center">开始预测画像</button>
            <details class="tech">
              <summary>背对背隔离说明</summary>
              <div class="tech__body">预测路径只允许：品类／版型／面料／工艺／价格带／季节／上新类型／IP。
人工人群定位、人工新老客比例、人工首发渠道、人工 FAB 卖点一律不得进入。
校验点在字段目录的 usage 标记 + 独立复核。</div>
            </details>
          </div>
        </section>

        <section class="lane">
          <div class="lane__head"><span class="lane__title">输出 · 预测画像与依据</span></div>
          <div class="lane__body">
            <div class="field__label">Top 3 目标人群包</div>
            <div class="barlist mb-3">
              ${p.segments
                .map(
                  (s) => `<div class="barlist__row">
                <div class="barlist__label">${esc(s.name)}</div>
                <div class="barlist__track"><div class="barlist__fill" style="width:${(s.share * 100).toFixed(0)}%"></div></div>
                <div class="barlist__val">${(s.share * 100).toFixed(0)}%</div>
              </div>`
                )
                .join('')}
            </div>
            <div class="field__label">六维标签分布</div>
            <table class="data mb-3">
              <tbody>
                ${p.dims
                  .map(
                    (d) => `<tr><td class="muted">${esc(d.dim)}</td><td>${esc(d.label)}</td><td class="num">${(d.share * 100).toFixed(1)}%</td></tr>`
                  )
                  .join('')}
              </tbody>
            </table>
            <div class="field__label">相似历史商品</div>
            <table class="data mb-3">
              <tbody>
                ${p.similar
                  .map(
                    (s) => `<tr><td class="mono">${esc(s.spu)}</td><td>${esc(s.name)}</td><td class="num">${s.score.toFixed(2)}</td></tr>`
                  )
                  .join('')}
              </tbody>
            </table>
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

  function pageChannelProfile() {
    return `
    <div class="page is-active" id="page-channel-profile">
      <div class="context-row">
        <div>
          <h1 class="page-title">渠道画像库</h1>
          <p class="page-desc">渠道 / 店铺 / 账号 / 门店的人群画像 · 数据来自 MCP</p>
        </div>
        <div class="context-actions"><button class="btn btn--primary">批量货渠匹配分析</button></div>
      </div>
      <div class="toolbar">
        <input class="input input--sm" placeholder="搜索渠道名或编码" aria-label="搜索渠道" />
        <select class="input input--sm" aria-label="渠道类型"><option>全部类型</option><option>抖音直播</option><option>天猫</option><option>实体店</option></select>
        <select class="input input--sm" aria-label="月份"><option>2026-10</option><option>2026-09</option></select>
        <div class="toolbar__spacer"></div>
        <span class="hint">当前索引 168 个渠道，部分有画像</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>编码</th><th>渠道</th><th>类型</th><th>平台</th><th>月份</th><th style="text-align:right">覆盖率</th><th style="text-align:right">样本量</th><th>主要特征</th></tr></thead>
          <tbody>
            ${D.channelProfiles
              .map(
                (c) => `<tr>
              <td class="mono">${esc(c.id)}</td><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${esc(c.platform)}</td>
              <td class="nowrap">${esc(c.month)}</td>
              <td class="num">${(c.coverage * 100).toFixed(0)}%</td>
              <td class="num">${c.sample.toLocaleString()}</td>
              <td class="muted">${esc(c.top.join(' · '))}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="empty">其余渠道暂无人群画像数据</div>
    </div>`;
  }

  function pageProductProfile() {
    return `
    <div class="page is-active" id="page-product-profile">
      <div class="context-row">
        <div>
          <h1 class="page-title">商品画像库</h1>
          <p class="page-desc">品类 / 系列 / 款号的真实消费人群 · 跨渠道对比与相似款钻取</p>
        </div>
        <div class="context-actions"><button class="btn">导入商品属性表</button></div>
      </div>
      <div class="toolbar">
        <input class="input input--sm" placeholder="搜索款号或商品名" aria-label="搜索商品" />
        <select class="input input--sm" aria-label="品类"><option>全部品类</option><option>短袖 T 恤</option><option>羽绒服</option></select>
        <div class="toolbar__spacer"></div>
        <span class="hint">索引 246 款；单品画像覆盖少量款</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>款号</th><th>商品</th><th>品类</th><th>月份</th><th style="text-align:right">覆盖率</th><th>主要特征</th></tr></thead>
          <tbody>
            ${D.productProfiles
              .map(
                (p) => `<tr>
              <td class="mono">${esc(p.spu)}</td><td>${esc(p.name)}</td><td>${esc(p.cat)}</td>
              <td class="nowrap">${esc(p.month)}</td><td class="num">${(p.coverage * 100).toFixed(0)}%</td>
              <td class="muted">${esc(p.top.join(' · '))}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function pageTagSearch() {
    const hits = D.tagHits[tagDim + '|' + tagLabel] || [];
    return `
    <div class="page is-active" id="page-tag-search">
      <div class="context-row">
        <div>
          <h1 class="page-title">标签反查</h1>
          <p class="page-desc">按人群标签反查商品与渠道 · 人群反过来找货</p>
        </div>
      </div>
      <div class="toolbar">
        <span class="toolbar__label">维度</span>
        <select class="input input--sm" id="tagDim">
          ${Object.keys(D.tagIndex)
            .map(
              (k) => `<option value="${esc(k)}"${k === tagDim ? ' selected' : ''}>${esc(k)}</option>`
            )
            .join('')}
        </select>
        <select class="input input--sm" id="tagLabel">
          ${D.tagIndex[tagDim]
            .map(
              (l) => `<option value="${esc(l)}"${l === tagLabel ? ' selected' : ''}>${esc(l)}</option>`
            )
            .join('')}
        </select>
        <select class="input input--sm" aria-label="范围"><option>全部</option><option>仅商品</option><option>仅渠道</option></select>
        <div class="toolbar__spacer"></div>
        <span class="hint">仅统一维度上的标签可反查；平台原生未映射标签不参与</span>
      </div>
      ${summaryRow([
      { label: '命中实体', value: hits.length, note: tagDim + ' · ' + tagLabel },
      { label: '其中商品', value: hits.filter((h) => h.type === '商品').length },
      { label: '其中渠道', value: hits.filter((h) => h.type === '渠道').length },
      { label: '最高 TGI', value: hits.length ? Math.max(...hits.map((h) => h.tgi)) : '—', tone: 'accent', note: '相对基准人群' },
    ])}
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>实体</th><th>类型</th><th>月份</th><th style="text-align:right">占比</th><th style="text-align:right">TGI</th></tr></thead>
          <tbody>
            ${
              hits.length
                ? hits
                    .map(
                      (h) => `<tr>
                <td>${esc(h.entity)}</td><td><span class="badge badge--neutral">${esc(h.type)}</span></td>
                <td class="nowrap">${esc(h.month)}</td>
                <td class="num">${(h.share * 100).toFixed(1)}%</td>
                <td class="num">${h.tgi}</td>
              </tr>`
                    )
                    .join('')
                : '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">该标签当前无命中实体</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function pageDatasource() {
    const okCount = D.datasource.tools.filter((t) => t.ok).length;
    return `
    <div class="page is-active" id="page-datasource">
      <div class="context-row">
        <div>
          <h1 class="page-title">数据源管理</h1>
          <p class="page-desc">工具数据就绪状态 · 缺失原因 · 导入批次</p>
        </div>
        <div class="context-actions"><button class="btn btn--primary">导入数据包</button></div>
      </div>
      ${summaryRow([
      { label: '工具数据就绪', value: okCount + ' / ' + D.datasource.tools.length, tone: okCount === D.datasource.tools.length ? 'success' : 'warning' },
      { label: '待补数据源', value: D.datasource.tools.length - okCount, tone: 'warning', note: '文件到位即自动启用' },
      { label: '导入批次', value: D.datasource.batches.length, note: '最近 4 个' },
      { label: '数据月份', value: '2026-10', note: '最新可用' },
    ])}
      <div class="grid-2">
        <section class="lane">
          <div class="lane__head"><span class="lane__title">工具数据就绪</span><span class="badge badge--warning">${D.datasource.tools.length - okCount} 项待补</span></div>
          <div class="lane__body lane__body--flush">
            <table class="data">
              <thead><tr><th>工具</th><th>状态</th><th>说明</th></tr></thead>
              <tbody>
                ${D.datasource.tools
                  .map(
                    (t) => `<tr>
                  <td class="mono">${esc(t.name)}</td>
                  <td><span class="badge badge--${t.ok ? 'success' : 'warning'}">${t.ok ? '就绪' : '待补'}</span></td>
                  <td class="muted">${esc(t.note)}</td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
        <section class="lane">
          <div class="lane__head"><span class="lane__title">导入批次</span></div>
          <div class="lane__body lane__body--flush">
            <table class="data">
              <thead><tr><th>批次</th><th>来源</th><th>规模</th><th>状态</th><th>导入时间</th></tr></thead>
              <tbody>
                ${D.datasource.batches
                  .map(
                    (b) => `<tr>
                  <td class="mono">${esc(b.id)}</td><td>${esc(b.source)}</td><td class="muted">${esc(b.rows)}</td>
                  <td><span class="badge badge--success">${esc(b.status)}</span></td>
                  <td class="muted nowrap">${esc(b.at)}</td>
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

  function pageRetention() {
    const r = D.retention;
    const maxC = 21;
    // 颜色按留存率高低映射（不是按列固定），空值为中性底
    const cell = (v, tone) => {
      if (v === null || v === undefined) {
        return `<td class="heat__cell" style="background:var(--bg-inset);color:var(--text-tertiary)">—</td>`;
      }
      const mix = Math.round(Math.max(10, Math.min(88, (v / 25) * 100)));
      const fg = v >= 13 ? '#fff' : 'var(--text-primary)';
      return `<td class="heat__cell" style="background:color-mix(in srgb, ${tone} ${mix}%, var(--bg-surface));color:${fg}">${v}</td>`;
    };
    const cohortRows = r.cohorts
      .map(
        (c) => `<tr>
      <th class="heat__label">${esc(c.m)} <span class="muted">${c.n.toLocaleString()}</span></th>
      ${cell(c.d30, 'var(--info-500)')}
      ${cell(c.d60, 'var(--accent-600)')}
      ${cell(c.d90, 'var(--accent-600)')}
      ${cell(c.next, 'var(--success-500)')}
    </tr>`
      )
      .join('');

    const flowRows = r.flow.rows
      .map(
        (rowName, i) =>
          `<tr><th class="heat__label">${esc(rowName)}</th>${(r.flow.v[i] ?? [])
            .map(
              (v) =>
                `<td class="heat__cell" style="background:${v >= 0.6 ? 'var(--accent-600)' : v >= 0.2 ? 'var(--accent-300)' : 'var(--bg-inset)'};color:${v >= 0.6 ? '#fff' : 'var(--text-primary)'}">${(v * 100).toFixed(0)}%</td>`
            )
            .join('')}</tr>`
      )
      .join('');

    return `
    <div class="page is-active" id="page-retention">
      <div class="context-row">
        <div>
          <h1 class="page-title">留存与回购</h1>
          <p class="page-desc">大盘人群结构 · Cohort 留存 · 老客来源 · 跨渠道流转 · 三大诊断</p>
        </div>
        <div class="context-actions">
          <select class="input input--sm" aria-label="统计月份"><option>2026-10</option><option>2026-09</option></select>
          <button class="btn">导出</button>
        </div>
      </div>

      ${summaryRow([
      { label: '当月买家', value: '30万', note: '五类客群合计' },
      { label: '二回跃迁', value: '13.6%', tone: 'success', note: 'D60，高于 10% 阈值' },
      { label: '召回客占比', value: '25%', tone: 'warning', note: '毛利 35%，接近警戒线' },
      { label: '清仓客次季转化', value: '1.2%', tone: 'danger', note: '低于 2% 基线' },
    ])}

      <section class="mb-3">
        <h2 class="section-title">月度大盘人群贡献结构</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>客群</th><th style="text-align:right">买家数</th><th>占比</th><th style="text-align:right">MoM</th><th style="text-align:right">YoY</th><th style="text-align:right">GMV</th><th style="text-align:right">GMV 占比</th><th style="text-align:right">客单价</th><th style="text-align:right">连带率</th></tr></thead>
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
        <section>
          <h2 class="section-title">新客 Cohort 留存（%）</h2>
          <div class="table-wrap mb-3">
            <table class="heat cohort">
              <thead><tr><th class="heat__corner">首购月 \\ 留存</th><th>D30</th><th>D60</th><th>D90</th><th>次季正价</th></tr></thead>
              <tbody>${cohortRows}</tbody>
            </table>
          </div>
          <h2 class="section-title">老客来源时效分布</h2>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Recency</th><th style="text-align:right">回购人数</th><th>占比</th><th>主推品类</th><th>主要渠道</th><th style="text-align:right">毛利率</th></tr></thead>
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

        <section>
          <h2 class="section-title">老客跨渠道流转矩阵</h2>
          <div class="table-wrap mb-3">
            <table class="heat">
              <thead><tr><th class="heat__corner">来源 \\ 回流</th>${r.flow.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
              <tbody>${flowRows}</tbody>
            </table>
          </div>
          <h2 class="section-title">三大诊断</h2>
          ${r.diagnosis
            .map(
              (d) => `<div class="diag">
            <div class="diag__flag diag__flag--${d.flag === 'ok' ? 'ok' : d.flag === 'warn' ? 'warn' : 'bad'}"></div>
            <div class="diag__body">
              <div class="diag__title">${esc(d.title)} <span class="badge badge--neutral">${esc(d.metric)}</span></div>
              <div class="diag__desc">${esc(d.desc)}</div>
            </div>
          </div>`
            )
            .join('')}
        </section>
      </div>
    </div>`;
  }

  function pageFlywheel() {
    return `
    <div class="page is-active" id="page-flywheel">
      <div class="context-row">
        <div>
          <h1 class="page-title">复盘飞轮</h1>
          <p class="page-desc">决策 → 行动 → 反馈 → 复盘，沉淀判断记忆</p>
        </div>
        <div class="context-actions"><button class="btn btn--primary">记录新决策</button></div>
      </div>
      ${summaryRow([
      { label: '决策记录', value: D.flywheel.length },
      { label: '待复盘', value: D.flywheel.filter((f) => f.state === '待复盘').length, tone: 'warning' },
      { label: '已验证', value: D.flywheel.filter((f) => f.state === '已验证').length, tone: 'success' },
      { label: '需调整', value: D.flywheel.filter((f) => f.state === '需调整').length, tone: 'danger' },
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
              <td><span class="badge badge--${f.tone}">${esc(f.state)}</span></td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

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

  function render() {
    main.innerHTML = PAGES[currentPage]();
    bindPage();
  }

  function bindPage() {
    main.querySelectorAll('[data-spu]').forEach((row) => {
      row.addEventListener('click', () => {
        selectedSpu = row.getAttribute('data-spu');
        render();
      });
    });

    main.querySelectorAll('.heat__cell[data-p]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const p = D.matchProducts.find((x) => x.id === cell.dataset.p);
        const c = D.matchChannels.find((x) => x.id === cell.dataset.c);
        const v = Number(cell.dataset.v);
        selectedMatch = { p, c, v };
        openDrawer(
          `${p.name} × ${c.name}`,
          `<div class="summary__label">匹配分</div>
           <div style="font-size:30px;font-weight:600;letter-spacing:-0.02em">${v}</div>
           <div class="row mt-2" style="gap:8px">
             <span class="badge badge--${v >= 80 ? 'success' : v >= 60 ? 'info' : 'warning'}">${v >= 80 ? 'A 级 · 建议主推' : v >= 60 ? 'B 级 · 建议微调' : 'C 级 · 慎选'}</span>
             <span class="badge badge--neutral">${esc(c.type)}</span>
           </div>
           <div class="mt-4">
             <div class="field__label">正向驱动</div>
             ${D.matchDetail.positive.map((t) => `<div class="row" style="gap:6px;margin-bottom:4px"><span class="badge badge--success">+</span>${esc(t)}</div>`).join('')}
             <div class="field__label mt-3">负向拦截</div>
             ${D.matchDetail.negative.map((t) => `<div class="row" style="gap:6px;margin-bottom:4px"><span class="badge badge--danger">−</span>${esc(t)}</div>`).join('')}
             <div class="field__label mt-3">运营建议</div>
             <div style="font-size:13px">${esc(D.matchDetail.advice)}</div>
             <div class="field__label mt-3">风险提示</div>
             ${D.matchDetail.risks.map((t) => `<div class="hint">· ${esc(t)}</div>`).join('')}
           </div>`,
          `<button class="btn">加入决策记录</button><button class="btn btn--primary">模拟目标用户反馈</button>`
        );
      });
    });

    const dimSel = main.querySelector('#tagDim');
    const labelSel = main.querySelector('#tagLabel');
    if (dimSel && labelSel) {
      dimSel.addEventListener('change', () => {
        tagDim = dimSel.value;
        tagLabel = D.tagIndex[tagDim][0];
        render();
      });
      labelSel.addEventListener('change', () => {
        tagLabel = labelSel.value;
        render();
      });
    }

    const modeBox = main.querySelector('#matchMode');
    if (modeBox) {
      modeBox.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          matchMode = btn.dataset.m;
          render();
        });
      });
    }
  }

  function goto(page, updateHash) {
    document.querySelectorAll('.nav-item').forEach((n) => {
      if (n.dataset.page === page) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
    currentPage = page;
    if (updateHash !== false) history.replaceState(null, '', '#' + page);
    render();
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => goto(item.dataset.page));
  });

  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '');
    if (PAGES[page]) goto(page, false);
  });

  applyTheme(localStorage.getItem('uom-theme') || 'light');
  const initial = location.hash.replace('#', '');
  goto(PAGES[initial] ? initial : 'review', false);
})();
