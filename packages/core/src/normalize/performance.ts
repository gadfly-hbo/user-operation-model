import { TABLE_SPECS } from './catalog/tables.js';
import {
  numberCell,
  percentCell,
  readDataTable,
  requireText,
  resolveColumns,
  textCell,
} from './table.js';
import type { ChannelPerformanceEntry, ProductPerformanceEntry } from './types.js';

/**
 * 经营指标表解析。
 *
 * 口径以《指标字典-品牌经营业务》为准；业务侧未确认指标编码前，
 * 按列名直读，缺失字段保持缺失（**不插补**）。
 */

/** 商品经营指标表解析。 */
export async function parseProductPerformanceTable(
  path: string,
): Promise<ProductPerformanceEntry[]> {
  const spec = TABLE_SPECS.productPerformance!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: ProductPerformanceEntry[] = [];

  for (const row of table.rows) {
    const spu = requireText(row, columns.get('款号'), spec.label, table.path);
    const month = textCell(row, columns.get('月份'));
    const retailAmount = numberCell(
      row,
      columns.get('零售额'),
      `${spec.label}的「零售额」`,
      table.path,
    );
    const retailQty = numberCell(
      row,
      columns.get('零售量'),
      `${spec.label}的「零售量」`,
      table.path,
    );
    const sellThroughRate = percentCell(
      row,
      columns.get('售罄率'),
      `${spec.label}的「售罄率」`,
      table.path,
    );
    const returnRate = percentCell(
      row,
      columns.get('退货率'),
      `${spec.label}的「退货率」`,
      table.path,
    );
    const refundRate = percentCell(
      row,
      columns.get('退款率'),
      `${spec.label}的「退款率」`,
      table.path,
    );
    const grossMargin = percentCell(
      row,
      columns.get('毛利率'),
      `${spec.label}的「毛利率」`,
      table.path,
    );
    const uv = numberCell(row, columns.get('UV'), `${spec.label}的「UV」`, table.path);
    const conversionRate = percentCell(
      row,
      columns.get('转化率'),
      `${spec.label}的「转化率」`,
      table.path,
    );
    entries.push({
      spu,
      ...(month ? { month } : {}),
      ...(retailAmount !== undefined ? { retailAmount } : {}),
      ...(retailQty !== undefined ? { retailQty } : {}),
      ...(sellThroughRate !== undefined ? { sellThroughRate } : {}),
      ...(returnRate !== undefined ? { returnRate } : {}),
      ...(refundRate !== undefined ? { refundRate } : {}),
      ...(grossMargin !== undefined ? { grossMargin } : {}),
      ...(uv !== undefined ? { uv } : {}),
      ...(conversionRate !== undefined ? { conversionRate } : {}),
    });
  }

  return entries;
}

/** 渠道经营指标表解析。 */
export async function parseChannelPerformanceTable(
  path: string,
): Promise<ChannelPerformanceEntry[]> {
  const spec = TABLE_SPECS.channelPerformance!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: ChannelPerformanceEntry[] = [];

  for (const row of table.rows) {
    const channelId = requireText(row, columns.get('店铺编码'), spec.label, table.path);
    const month = textCell(row, columns.get('月份'));
    const gmv = numberCell(
      row,
      columns.get('成交额'),
      `${spec.label}的「成交额」`,
      table.path,
    );
    const orderCount = numberCell(
      row,
      columns.get('成交件数'),
      `${spec.label}的「成交件数」`,
      table.path,
    );
    const conversionRate = percentCell(
      row,
      columns.get('转化率'),
      `${spec.label}的「转化率」`,
      table.path,
    );
    const aov = numberCell(
      row,
      columns.get('客单价'),
      `${spec.label}的「客单价」`,
      table.path,
    );
    const grossMargin = percentCell(
      row,
      columns.get('毛利率'),
      `${spec.label}的「毛利率」`,
      table.path,
    );
    entries.push({
      channelId,
      ...(month ? { month } : {}),
      ...(gmv !== undefined ? { gmv } : {}),
      ...(orderCount !== undefined ? { orderCount } : {}),
      ...(conversionRate !== undefined ? { conversionRate } : {}),
      ...(aov !== undefined ? { aov } : {}),
      ...(grossMargin !== undefined ? { grossMargin } : {}),
    });
  }

  return entries;
}

/**
 * 由零售额与零售量推出真实成交单价。
 *
 * **仅当单价原本缺失时**返回推算值；已有值一律保留原值。
 * 零售额或零售量任一缺失时不推算（不插补）。
 */
export function deriveActualUnitPrice(
  existing: number | undefined,
  retailAmount: number | undefined,
  retailQty: number | undefined,
): number | undefined {
  if (existing !== undefined) return existing;
  if (retailAmount === undefined || retailQty === undefined) return undefined;
  if (retailQty === 0) return undefined;
  return Math.round((retailAmount / retailQty) * 100) / 100;
}
