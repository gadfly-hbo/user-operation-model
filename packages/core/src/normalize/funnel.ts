import { TABLE_SPECS, FUNNEL_PHASE_ALIASES } from './catalog/tables.js';
import {
  readDataTable,
  readMetrics,
  requireText,
  resolveColumns,
  textCell,
} from './table.js';
import type { FunnelEntry } from './types.js';

/**
 * 生命周期漏斗表解析。
 *
 * 一行一款一月一阶段：`款号, 月份, 阶段, 浏览, 收藏, 加购, 购买, 直接购买, 退货`。
 * 指标缺失显式标记在 `missing`，**不插补 0**。
 */
export async function parseFunnelTable(path: string): Promise<FunnelEntry[]> {
  const spec = TABLE_SPECS.funnel!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: FunnelEntry[] = [];

  for (const row of table.rows) {
    const spu = requireText(row, columns.get('款号'), spec.label, table.path);
    const month = textCell(row, columns.get('月份'));
    const rawPhase = requireText(row, columns.get('阶段'), spec.label, table.path);
    // 未登记的阶段保留原值，不猜测归并
    const phase =
      FUNNEL_PHASE_ALIASES[rawPhase] ?? FUNNEL_PHASE_ALIASES[rawPhase.toLowerCase()] ?? rawPhase;
    const { metrics, missing } = readMetrics(row, columns, spec, table.path);
    entries.push({
      spu,
      ...(month ? { month } : {}),
      phase,
      metrics,
      missing,
    });
  }

  return entries;
}
