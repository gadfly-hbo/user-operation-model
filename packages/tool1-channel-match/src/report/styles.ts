/**
 * 报告页专属样式。
 *
 * 设计系统（颜色、间距、字号、组件类）全部来自 `site/web/assets/base.css`，
 * 生成时内联；这里只补报告自身的布局，不另建一套 token。
 */
export const REPORT_CSS = `
/* ── 报告页布局 ─────────────────────────────────────────── */
.report { padding: var(--sp-5) var(--sp-6) var(--sp-6); }
.report__wrap { max-width: 1320px; margin: 0 auto; }
.report__head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--sp-4); margin-bottom: var(--sp-3);
}
.report__actions { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.report__meta {
  display: flex; flex-wrap: wrap; gap: 4px var(--sp-4);
  font-size: var(--type-meta); color: var(--ink-3); margin-bottom: var(--sp-4);
}
.report__meta b {
  font-weight: 600; color: var(--ink-2);
  font-variant-numeric: tabular-nums; margin-left: 4px;
}
.report__section { margin-bottom: var(--sp-5); }
.report__notes {
  display: flex; flex-direction: column; gap: 4px;
  font-size: var(--type-meta); color: var(--ink-3); margin-top: var(--sp-2);
}
.report__notes li { list-style: none; }
.report__notes li::before { content: "· "; }
.report__flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.report__banner {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: 8px var(--sp-3); margin-bottom: var(--sp-4);
  border: 1px solid color-mix(in srgb, var(--sev-mid) 40%, var(--rule));
  border-radius: var(--site-radius);
  background: color-mix(in srgb, var(--sev-mid) 8%, var(--card));
  font-size: var(--type-meta); color: var(--ink-2);
}
.report__banner--local {
  border-color: color-mix(in srgb, var(--algo) 40%, var(--rule));
  background: color-mix(in srgb, var(--algo) 7%, var(--card));
}
.matrix { overflow: auto; }
.matrix[hidden] { display: none; }
.matrix table { width: max-content; min-width: 100%; }

/* ── 错配清单 ───────────────────────────────────────────── */
table.miss td.miss__priority {
  font-variant-numeric: tabular-nums; font-weight: 600; text-align: right;
}
table.miss td.miss__score { font-variant-numeric: tabular-nums; text-align: right; }
table.miss td.miss__rank { color: var(--ink-3); font-variant-numeric: tabular-nums; }
table.miss .cell-drivers { color: var(--ink-2); }

/* ── 抽屉内的维度表 ─────────────────────────────────────── */
table.dimtable { width: 100%; border-collapse: collapse; font-size: var(--type-meta); }
table.dimtable th {
  text-align: left; font-weight: 600; color: var(--ink-3);
  padding: 6px 8px; border-bottom: 1px solid var(--rule); white-space: nowrap;
}
table.dimtable td { padding: 6px 8px; border-bottom: 1px solid var(--rule); }
table.dimtable tr:last-child td { border-bottom: 0; }
table.dimtable td.num { text-align: right; font-variant-numeric: tabular-nums; }
table.dimtable tr.is-missing td { color: var(--ink-3); }
table.dimtable td.evidence { color: var(--ink-3); font-family: var(--font-mono); font-size: 11px; }

@media (max-width: 860px) {
  .report { padding: var(--sp-4) var(--sp-3) var(--sp-5); }
  .report__head { flex-direction: column; align-items: stretch; }
  .report__actions { justify-content: flex-start; }
}
`;
