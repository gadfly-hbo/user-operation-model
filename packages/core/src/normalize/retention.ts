import { DIAGNOSIS_TYPE_ALIASES, TABLE_SPECS } from './catalog/tables.js';
import {
  numberCell,
  percentCell,
  readDataTable,
  readMetrics,
  requireText,
  resolveColumns,
  textCell,
} from './table.js';
import type {  ChannelFlowEntry,
  CohortEntry,
  DiagnosisEntry,
  RecencyEntry,
} from './types.js';

/**
 * 留存四表解析：Cohort 留存、Recency 分布、跨渠道流转矩阵、三大诊断。
 *
 * 口径见《要数清单》第 5–8 项与 `docs/normalize-rules.md` §12。
 * 指标缺失显式标记，**不插补**。
 */

/** Cohort 留存表解析。 */
export async function parseCohortTable(path: string): Promise<CohortEntry[]> {
  const spec = TABLE_SPECS.cohort!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: CohortEntry[] = [];

  for (const row of table.rows) {
    const cohortMonth = requireText(row, columns.get('首购月份'), spec.label, table.path);
    const buyers = numberCell(
      row,
      columns.get('买家数'),
      `${spec.label}的「买家数」`,
      table.path,
    );
    const { metrics, missing } = readMetrics(row, columns, spec, table.path);
    entries.push({
      cohortMonth,
      ...(buyers !== undefined ? { buyers } : {}),
      metrics,
      missing,
    });
  }

  return entries;
}

/** 老客 Recency 分布表解析。 */
export async function parseRecencyTable(path: string): Promise<RecencyEntry[]> {
  const spec = TABLE_SPECS.recency!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: RecencyEntry[] = [];

  for (const row of table.rows) {
    const month = requireText(row, columns.get('月份'), spec.label, table.path);
    const bucket = requireText(
      row,
      columns.get('上次购买天数切片'),
      spec.label,
      table.path,
    );
    const buyers = numberCell(
      row,
      columns.get('回购人数'),
      `${spec.label}的「回购人数」`,
      table.path,
    );
    const shareOfOldCustomers = percentCell(
      row,
      columns.get('老客内占比'),
      `${spec.label}的「老客内占比」`,
      table.path,
    );
    const wakeCategory = textCell(row, columns.get('唤醒主推品类'));
    const mainChannel = textCell(row, columns.get('主要购买渠道'));
    const grossMargin = percentCell(
      row,
      columns.get('平均毛利率'),
      `${spec.label}的「平均毛利率」`,
      table.path,
    );
    entries.push({
      month,
      bucket,
      ...(buyers !== undefined ? { buyers } : {}),
      ...(shareOfOldCustomers !== undefined ? { shareOfOldCustomers } : {}),
      ...(wakeCategory ? { wakeCategory } : {}),
      ...(mainChannel ? { mainChannel } : {}),
      ...(grossMargin !== undefined ? { grossMargin } : {}),
    });
  }

  return entries;
}

/** 跨渠道流转矩阵表解析。 */
export async function parseChannelFlowTable(path: string): Promise<ChannelFlowEntry[]> {
  const spec = TABLE_SPECS.channelFlow!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: ChannelFlowEntry[] = [];

  for (const row of table.rows) {
    const month = requireText(row, columns.get('月份'), spec.label, table.path);
    const from = requireText(row, columns.get('来源渠道'), spec.label, table.path);
    const to = requireText(row, columns.get('回购渠道'), spec.label, table.path);
    const buyers = numberCell(
      row,
      columns.get('回购人数'),
      `${spec.label}的「回购人数」`,
      table.path,
    );
    const crossChannelRate = percentCell(
      row,
      columns.get('跨渠道回购率'),
      `${spec.label}的「跨渠道回购率」`,
      table.path,
    );
    entries.push({
      month,
      from,
      to,
      ...(buyers !== undefined ? { buyers } : {}),
      ...(crossChannelRate !== undefined ? { crossChannelRate } : {}),
    });
  }

  return entries;
}

/** 三大诊断输入表解析。 */
export async function parseDiagnosisTable(path: string): Promise<DiagnosisEntry[]> {
  const spec = TABLE_SPECS.diagnosis!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: DiagnosisEntry[] = [];

  for (const row of table.rows) {
    const month = requireText(row, columns.get('月份'), spec.label, table.path);
    const rawType = requireText(row, columns.get('诊断类型'), spec.label, table.path);
    // 未登记的诊断类型保留原值，不猜测归并
    const type =
      DIAGNOSIS_TYPE_ALIASES[rawType] ?? DIAGNOSIS_TYPE_ALIASES[rawType.toLowerCase()] ?? rawType;
    const { metrics, missing } = readMetrics(row, columns, spec, table.path);
    entries.push({ month, type, metrics, missing });
  }

  return entries;
}
