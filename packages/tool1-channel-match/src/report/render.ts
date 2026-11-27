import type { MatchConfig, MatchResult } from '@uom/core';
import { escapeHtml, embedJson } from './escape.js';
import { dimensionLabel } from './labels.js';
import { buildMismatchList, indexResults, mismatchCsv } from './mismatch.js';
import { readBaseCss } from './assets.js';
import { REPORT_CSS } from './styles.js';
import type { MismatchRow, ReportInput } from './types.js';

/**
 * 静态报告渲染。
 *
 * 产物是**自包含 HTML**：样式内联、数据内联、无任何外网请求，
 * `file://` 直接打开即可用。真实数据版本只落本地，合成数据版本可随站点发布。
 */

export interface RenderOptions {
  /** 设计基底内容；默认从 `site/web/assets/base.css` 读取。 */
  baseCss?: string;
  /** 错配清单在页面上显示的条数；CSV 始终是全量。 */
  topN?: number;
}

/**
 * 热力图色阶：A ≥ 评级 A 门槛、B ≥ 评级 B 门槛、C ≥ 熔断阈值，熔断阈值以下为红。
 *
 * 阈值全部来自**计算结果所用的同一份配置**，不在渲染层写死第二份。
 */
function heatClass(score: number | null, config: MatchConfig): string {
  if (score === null) return 'none';
  if (score >= config.grades.a) return 'a';
  if (score >= config.grades.b) return 'b';
  if (score >= config.fuseThreshold) return 'c';
  return 'x';
}

function gradeLabel(grade: 'A' | 'B' | 'C' | null, fuse: boolean): string {
  if (grade === null) return '未评分';
  if (grade === 'A') return 'A 级 · 建议主推';
  if (grade === 'B') return 'B 级 · 建议微调';
  return fuse ? 'C 级 · 熔断不建议' : 'C 级 · 慎选';
}

function gradeTone(grade: 'A' | 'B' | 'C' | null, fuse: boolean): string {
  if (grade === null) return 'pending';
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  return fuse ? 'danger' : 'warning';
}

function advice(result: MatchResult): string {
  if (result.totalScore === null || result.grade === null) {
    return '可用维度不足，暂不给出投放建议；先补齐缺失维度的画像。';
  }
  if (result.fuse) return '不建议投放：客单与人群断层明显，优先换渠道或改款。';
  if (result.grade === 'A') return '建议主推：人群与渠道高度契合，可作为该渠道的主推款。';
  if (result.grade === 'B') return '建议微调：整体匹配尚可，重点补齐负向驱动最强的维度。';
  return '慎选：核心客群存在错位，建议先小量测试或调整货品结构。';
}

/** 单元格抽屉内容。服务端渲染，客户端只负责注入。 */
function renderCellDetail(
  result: MatchResult | undefined,
  reason: string | undefined,
  productName: string,
  channelName: string,
  channelType: string | undefined,
): string {
  if (!result) {
    return `<div class="hint">${escapeHtml(productName)} × ${escapeHtml(channelName)}</div>
      <div class="empty mt-2">
        <div class="empty__title">该组合未参与评分</div>
        <div>${escapeHtml(reason ?? '无画像')}</div>
      </div>`;
  }

  const score = result.totalScore;
  const chips = [
    `<span class="chip chip--${gradeTone(result.grade, result.fuse)}">${escapeHtml(
      gradeLabel(result.grade, result.fuse),
    )}</span>`,
    channelType ? `<span class="chip">${escapeHtml(channelType)}</span>` : '',
    result.fuse ? '<span class="chip chip--danger">熔断</span>' : '',
  ].join('');

  const dimensionRows = result.dimensions
    .map((dimension) => {
      const label = dimensionLabel(dimension.dimension);
      if (!dimension.available) {
        return `<tr class="is-missing">
          <td>${escapeHtml(label)}</td>
          <td class="num">—</td>
          <td class="num">${escapeHtml(dimension.weight)}</td>
          <td>${escapeHtml(dimension.reason ?? '不可用')}</td>
        </tr>`;
      }
      const evidence = dimension.evidence
        ? `JS ${dimension.evidence.jsSimilarity.toFixed(2)} · 余弦 ${dimension.evidence.cosine.toFixed(
            2,
          )} · Top3 ${Math.round(dimension.evidence.top3Overlap * 100)}%`
        : dimension.priceFit
          ? `${escapeHtml(dimension.priceFit.band)} · 高消 ${formatShare(
              dimension.priceFit.highShare,
            )} · 低消 ${formatShare(dimension.priceFit.lowShare)}`
          : '';
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td class="num">${dimension.score === null ? '—' : dimension.score.toFixed(1)}</td>
        <td class="num">${escapeHtml(dimension.weight)}</td>
        <td class="evidence">${escapeHtml(evidence)}</td>
      </tr>`;
    })
    .join('');

  const drivers = (list: typeof result.positiveDrivers, mark: string, tone: string): string =>
    list.length === 0
      ? '<div class="hint">无</div>'
      : list
          .map(
            (driver) =>
              `<div class="kv"><span class="kv__mark" style="color:var(--${tone})">${mark}</span><span>${escapeHtml(
                dimensionLabel(driver.dimension),
              )} ${driver.score.toFixed(1)} 分（偏差 ${driver.delta > 0 ? '+' : ''}${driver.delta.toFixed(
                1,
              )}）</span></div>`,
          )
          .join('');

  const flags: string[] = [];
  if (result.flags.productMonthUnknown) flags.push('单品画像无月份（源数据未提供）');
  if (result.flags.channelApproximate) flags.push('渠道画像为区间口径，覆盖所选月');
  if (result.flags.priceMissing) flags.push('缺价格，消费能力维度未参与');

  const priceFitBlock = result.priceFit
    ? `<div class="field__label mt-3">客单承接</div>
       <div class="hint">${escapeHtml(result.priceFit.diagnosis)}</div>
       <div class="hint mt-2">价格带 ${escapeHtml(result.priceFit.band)} · 惩罚 ${result.priceFit.penalty}</div>`
    : '';

  return `<div class="hint">${escapeHtml(productName)} × ${escapeHtml(channelName)}</div>
    <div class="drawer__score mt-2">${score === null ? '—' : score.toFixed(1)}</div>
    <div class="row mt-2" style="gap:8px;flex-wrap:wrap">${chips}</div>
    <div class="mt-3">
      <table class="dimtable">
        <thead><tr><th>维度</th><th class="num">分数</th><th class="num">权重</th><th>证据</th></tr></thead>
        <tbody>${dimensionRows}</tbody>
      </table>
    </div>
    <div class="field__label mt-3">正向驱动</div>
    ${drivers(result.positiveDrivers, '+', 'sev-high')}
    <div class="field__label mt-3">负向驱动</div>
    ${drivers(result.negativeDrivers, '−', 'sev-low')}
    ${priceFitBlock}
    ${
      flags.length > 0
        ? `<div class="field__label mt-3">口径标记</div>${flags
            .map((flag) => `<div class="hint">· ${escapeHtml(flag)}</div>`)
            .join('')}`
        : ''
    }
    <div class="field__label mt-3">建议</div>
    <div style="font-size:13px">${escapeHtml(advice(result))}</div>`;
}

function formatShare(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${Math.round(value * 10000) / 100}%`;
}

function ledger(input: ReportInput, results: Map<string, MatchResult>): string {
  const scored = [...results.values()].filter((result) => result.totalScore !== null);
  const high = scored.filter((result) => result.grade === 'A').length;
  const fused = scored.filter((result) => result.fuse).length;
  const full = scored.filter((result) => result.availableDimensions.length === 6).length;
  const cells = [
    { label: '候选商品', value: input.products.length, note: '款号级' },
    { label: '候选渠道', value: input.channels.length, note: '渠道实体' },
    { label: '已评分单元', value: scored.length, note: `共 ${input.products.length * input.channels.length} 格` },
    { label: '高匹配单元', value: high, tone: 'high', note: '≥ 80 分，建议主推' },
    { label: '熔断单元', value: fused, tone: 'low', note: '< 45 分，不建议投放' },
    { label: '六维全可用', value: full, tone: 'accent', note: '六个维度均参与评分' },
  ];
  return `<div class="ledger">${cells
    .map(
      (cell) => `<div class="ledger__cell"${cell.tone ? ` data-tone="${cell.tone}"` : ''}>
        <div class="ledger__label">${escapeHtml(cell.label)}</div>
        <div class="ledger__value">${escapeHtml(cell.value)}</div>
        ${cell.note ? `<div class="ledger__note">${escapeHtml(cell.note)}</div>` : ''}
      </div>`,
    )
    .join('')}</div>`;
}

/** 匹配矩阵的一个视角。行＝商品、列＝渠道，或相反。 */
function renderMatrix(
  input: ReportInput,
  results: Map<string, MatchResult>,
  config: MatchConfig,
  axis: 'row' | 'col',
): string {
  const byRow = axis === 'row';
  const headers: { name: string }[] = byRow ? input.channels : input.products;
  const rowItems: { name: string; spu?: string; id?: string }[] = byRow
    ? input.products
    : input.channels;
  const columnItems: { name: string; spu?: string; id?: string }[] = byRow
    ? input.channels
    : input.products;

  const head = `<thead><tr><th class="corner">${byRow ? '商品 \\ 渠道' : '渠道 \\ 商品'}</th>${headers
    .map((item) => `<th>${escapeHtml(item.name)}</th>`)
    .join('')}</tr></thead>`;

  const body = rowItems
    .map((rowItem) => {
      const cells = columnItems.map((columnItem) => {
        const spu = byRow ? rowItem.spu! : columnItem.spu!;
        const channelId = byRow ? columnItem.id! : rowItem.id!;
        const result = results.get(`${spu}::${channelId}`);
        const score = result?.totalScore ?? null;
        const label = byRow ? rowItem.name : columnItem.name;
        const other = byRow ? columnItem.name : rowItem.name;
        const title = result
          ? `${label} × ${other}：${score === null ? '未评分' : score.toFixed(1)}`
          : `${label} × ${other}：无画像`;
        return `<td class="heat__cell heat__cell--${heatClass(score, config)}"
          data-cell="${escapeHtml(`${spu}::${channelId}`)}"
          title="${escapeHtml(title)}">${score === null ? '—' : score.toFixed(0)}</td>`;
      });
      return `<tr><th class="heat__label">${escapeHtml(rowItem.name)}</th>${cells.join('')}</tr>`;
    })
    .join('');

  return `<div class="table-wrap matrix"${byRow ? '' : ' hidden'} id="matrix-${axis}">
    <table class="heat"><caption class="visually-hidden"></caption>${head}<tbody>${body}</tbody></table>
  </div>`;
}

function renderMismatchTable(rows: MismatchRow[]): string {
  if (rows.length === 0) {
    return '<div class="empty"><div class="empty__title">没有可排序的错配单元</div><div>缺零售额或未评分的单元不进入排序</div></div>';
  }
  const body = rows
    .map(
      (row) => `<tr>
        <td class="miss__rank">${row.rank}</td>
        <td>${escapeHtml(row.productName)}<div class="mono">${escapeHtml(row.spu)}</div></td>
        <td>${escapeHtml(row.channelName)}</td>
        <td class="miss__score">${row.score.toFixed(1)}</td>
        <td>${escapeHtml(gradeLabel(row.grade, row.fuse))}</td>
        <td class="num">${row.retailAmount.toLocaleString('zh-CN')}</td>
        <td class="miss__priority">${Math.round(row.priority).toLocaleString('zh-CN')}</td>
        <td class="cell-drivers">${escapeHtml(row.negativeDrivers || '—')}</td>
      </tr>`,
    )
    .join('');
  return `<div class="table-wrap"><table class="data miss">
      <thead><tr>
        <th>#</th><th>商品</th><th>渠道</th><th class="num">匹配分</th><th>评级</th>
        <th class="num">零售额</th><th class="num">错配优先级</th><th>主要负向驱动</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

const CLIENT_SCRIPT = `
(() => {
  const dataEl = document.getElementById('report-data');
  const data = dataEl ? JSON.parse(dataEl.textContent) : { cells: {}, csv: '' };

  /* 主题：与工作台同一套记忆键 */
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('uom-theme', theme); } catch (error) { /* 隐私模式下忽略 */ }
    if (themeBtn) themeBtn.textContent = theme === 'dark' ? '亮色' : '暗色';
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }
  let stored = 'light';
  try { stored = localStorage.getItem('uom-theme') || 'light'; } catch (error) { /* 忽略 */ }
  applyTheme(stored);

  /* 视角切换：商品→渠道 / 渠道→商品 */
  document.querySelectorAll('[data-axis]').forEach((button) => {
    button.addEventListener('click', () => {
      const axis = button.getAttribute('data-axis');
      document.querySelectorAll('[data-axis]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other === button));
      });
      document.querySelectorAll('.matrix').forEach((matrix) => {
        matrix.hidden = matrix.id !== 'matrix-' + axis;
      });
    });
  });

  /* 抽屉：内容由服务端渲染，客户端只做注入 */
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('backdrop');
  function openDrawer(title, html) {
    const titleEl = document.getElementById('drawerTitle');
    if (titleEl) titleEl.textContent = title;
    const body = document.getElementById('drawerBody');
    if (body) body.innerHTML = html;
    if (drawer) drawer.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-open');
    const close = document.getElementById('drawerClose');
    if (close) close.focus();
  }
  function closeDrawer() {
    if (drawer) drawer.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
  }
  document.querySelectorAll('[data-cell]').forEach((cell) => {
    cell.addEventListener('click', () => {
      const key = cell.getAttribute('data-cell');
      openDrawer(cell.getAttribute('title') || '详情', data.cells[key] || '<div class="hint">无详情</div>');
    });
  });
  const closeBtn = document.getElementById('drawerClose');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  /* 错配清单 CSV：本地 Blob 下载，不发任何网络请求 */
  const csvBtn = document.getElementById('csvBtn');
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      const blob = new Blob(['\\ufeff' + data.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.csvName || 'mismatch.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }
})();
`;

/** 渲染静态报告。 */
export function renderReport(input: ReportInput, options: RenderOptions = {}): string {
  const baseCss = options.baseCss ?? readBaseCss();
  const config = input.config;
  const topN = options.topN ?? 20;
  const results = indexResults(input.results);
  const unscoredByKey = new Map(
    (input.unscored ?? []).map((cell) => [`${cell.spu}::${cell.channelId}`, cell.reason]),
  );
  const { rows, skipped } = buildMismatchList(input);
  const csv = mismatchCsv(input, rows);

  // 每个单元格的抽屉内容在服务端渲染，客户端不再重复拼装
  const cellDetails: Record<string, string> = {};
  for (const product of input.products) {
    for (const channel of input.channels) {
      const key = `${product.spu}::${channel.id}`;
      const result = results.get(key);
      if (!result && !unscoredByKey.has(key)) continue;
      cellDetails[key] = renderCellDetail(
        result,
        unscoredByKey.get(key),
        product.name,
        channel.name,
        channel.type,
      );
    }
  }

  const legend = [
    { grade: 'A', label: `建议主推 · ≥ ${config.grades.a}`, tone: 'a' },
    { grade: 'B', label: `建议微调 · ${config.grades.b}–${config.grades.a - 0.1}`, tone: 'b' },
    { grade: 'C', label: `慎选 · ${config.fuseThreshold}–${config.grades.b - 0.1}`, tone: 'c' },
    { grade: '熔断', label: `不建议 · < ${config.fuseThreshold}（C 级内）`, tone: 'x' },
  ];

  const metaRows = [
    { label: '数据集', value: input.meta.source },
    { label: '计算月', value: input.meta.month },
    { label: '配置版本', value: input.meta.configVersion },
    { label: '生成时间', value: input.meta.generatedAt },
  ];

  const notes = [...input.meta.notes];
  if (skipped.length > 0) {
    notes.push(`未进入错配排序的单元 ${skipped.length} 个（缺零售额或未评分）。`);
  }

  const techBody = [
    '口径出处：产品讨论稿 §7.4（工具 1／工具 2 共用匹配内核）。',
    `单维度分 = ${config.blend.js} × JS 相似度 + ${config.blend.cosine} × 余弦相似度 + ${config.blend.top3} × Top3 重合度；缺维度时对有效维度重归一化。`,
    '消费能力维度由可配置客单承接表按「价格带 × 渠道高／低消费占比」判定，并给出全局惩罚。',
    `综合分 = Σ(维度分 × 权重) / Σ可用权重 + 客单惩罚，四舍五入 1 位小数，裁剪到 [${config.clamp.min}, ${config.clamp.max}]。`,
    `评级：A ≥ ${config.grades.a}，B ${config.grades.b}–${config.grades.a - 0.1}，C < ${config.grades.b}；C 级内 < ${config.fuseThreshold} 标记为熔断（只做显示，不改变评级）。`,
    '维度权重：' +
      Object.entries(config.weights)
        .map(([dimension, weight]) => `${dimensionLabel(dimension)} ${weight}`)
        .join(' · '),
    '错配优先级 = 零售额 × (1 - 匹配分/100)，降序；零售额为商品级指标，无渠道级分解，该排序表示组合调整优先级，不代表该渠道实际销售额。',
    `配置版本：${config.version}（权重为初值，未经真实数据校准，记「已调整」，不得称「已优化」）。`,
  ].join('\n');

  const demoBanner = input.meta.isDemo
    ? `<div class="report__banner">
        <span class="chip chip--warning">合成演示数据</span>
        <span>本页数值均为合成示意，仅用于版式与交互评审，不代表任何真实业务结果；真实数据版本只在本地生成，不随站点发布。</span>
      </div>`
    : `<div class="report__banner report__banner--local">
        <span class="chip chip--info">真实数据</span>
        <span>本报告含真实业务数据，只在本机生成与查看，不随站点发布，也请勿外传。</span>
      </div>`;

  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(input.meta.title)}</title>
<meta name="description" content="工具 1 货渠匹配看板：商品 × 渠道匹配矩阵、六维证据与错配清单。${escapeHtml(
    input.meta.source,
  )}。" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231a1a2e'/%3E%3Cpath d='M6 22 L14 10 L18 16 L22 12 L26 22 Z' fill='%23d97757'/%3E%3C/svg%3E" />
<style>
${baseCss}
${REPORT_CSS}
</style>
</head>
<body class="report">
<div class="report__wrap">
  <header class="report__head">
    <div>
      <div class="page-head__eyebrow">工具 1 · 货渠匹配看板</div>
      <h1 class="page-title">${escapeHtml(input.meta.title)}</h1>
      <p class="page-desc">六维加权评分 + 客单承接。点击任一格查看该组合的逐维证据、正负向驱动与客单诊断。</p>
    </div>
    <div class="report__actions">
      ${input.meta.isDemo ? '<span class="chip chip--warning">合成演示数据</span>' : ''}
      <button class="icon-btn" id="csvBtn" type="button">导出错配清单 CSV</button>
      <button class="icon-btn" id="themeBtn" type="button" aria-label="切换明暗主题">暗色</button>
    </div>
  </header>

  <div class="report__meta">
    ${metaRows
      .map((row) => `<span>${escapeHtml(row.label)}<b>${escapeHtml(row.value)}</b></span>`)
      .join('')}
  </div>

  ${demoBanner}

  <section class="report__section">
    ${ledger(input, results)}
    <div class="tools">
      <span class="tools__label">视角</span>
      <div class="segmented" id="axisBox">
        <button type="button" aria-pressed="true" data-axis="row">按商品找渠道</button>
        <button type="button" aria-pressed="false" data-axis="col">按渠道找商品</button>
      </div>
      <div class="tools__spacer"></div>
      <div class="legend">
        ${legend
          .map(
            (item) => `<span class="legend__item">
              <span class="legend__swatch heat__cell--${item.tone}"></span>
              ${escapeHtml(item.grade)} · ${escapeHtml(item.label)}
            </span>`,
          )
          .join('')}
      </div>
    </div>
    ${renderMatrix(input, results, config, 'row')}
    ${renderMatrix(input, results, config, 'col')}
  </section>

  <section class="report__section">
    <div class="block__head">
      <span class="block__title">错配清单</span>
      <span class="block__sub">按 零售额 × (1 - 匹配分) 降序，输出「高销售低匹配」的组货调整优先级</span>
    </div>
    ${renderMismatchTable(rows.slice(0, topN))}
  </section>

  ${
    notes.length > 0
      ? `<section class="report__section">
          <div class="block__head"><span class="block__title">数据覆盖与口径</span></div>
          <ul class="report__notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
        </section>`
      : ''
  }

  <details class="tech">
    <summary>评分口径与维度权重</summary>
    <div class="tech__body">${escapeHtml(techBody)}</div>
  </details>
</div>

<div class="drawer-backdrop" id="backdrop"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
  <div class="drawer__head">
    <span class="drawer__title" id="drawerTitle">匹配明细</span>
    <button class="icon-btn" id="drawerClose" type="button" aria-label="关闭抽屉">关闭</button>
  </div>
  <div class="drawer__body" id="drawerBody"></div>
</aside>

<script id="report-data" type="application/json">${embedJson({
    cells: cellDetails,
    csv,
    csvName: `mismatch-${input.meta.month}.csv`,
  })}</script>
<script>
${CLIENT_SCRIPT}
</script>
</body>
</html>
`;
}
