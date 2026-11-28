import { parseCsvRows } from './csv.js';
import { readXlsxRows } from './xlsx.js';
import { NormalizationError } from './types.js';
import type { TableSpec } from './catalog/tables.js';

/**
 * 新增表的统一读取入口。
 *
 * CSV 走既有解析器（`parseCsvRows`，处理 BOM／引号／CRLF），
 * XLSX 走 exceljs（`readXlsxRows`）。**不新增依赖、不出网。**
 *
 * 结构性错误一律抛 `NormalizationError`，不返回空结果：
 * - 文件为空 → `parse-error`
 * - 只有表头没有数据行 → `parse-error`
 * - 缺必要列 → `missing-field`
 * - 数值列不可解析 → `parse-error`
 */

/** 读进来的表。 */
export interface DataTable {
  /** 文件路径（错误信息用）。 */
  path: string;
  /** 表头（已去空白）。 */
  header: string[];
  /** 数据行（与表头对齐；全空行已剔除）。 */
  rows: string[][];
  /** 列名 → 列下标。 */
  columns: Map<string, number>;
}

/** 读 CSV 或 XLSX 表。 */
export async function readDataTable(path: string): Promise<DataTable> {
  const lower = path.toLowerCase();
  const raw = lower.endsWith('.csv') ? parseCsvRows(path) : await readXlsxRows(path);
  if (raw.length === 0) {
    throw new NormalizationError('parse-error', '表文件为空或无法解析', path);
  }
  const header = (raw[0] ?? []).map((cell) => cell.trim());
  const columns = new Map<string, number>();
  header.forEach((name, index) => {
    if (name !== '' && !columns.has(name)) columns.set(name, index);
  });
  const rows = raw.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) {
    throw new NormalizationError('parse-error', '表文件只有表头，没有数据行', path);
  }
  return { path, header, rows, columns };
}

/** 按候选列名找列下标（先精确，后忽略大小写）。 */
export function findColumn(table: DataTable, names: string[]): number | undefined {
  for (const name of names) {
    const index = table.columns.get(name);
    if (index !== undefined) return index;
  }
  const lowered = names.map((name) => name.toLowerCase());
  for (const [name, index] of table.columns) {
    if (lowered.includes(name.toLowerCase())) return index;
  }
  return undefined;
}

/** 文本单元格。空值与 `-` 视为缺失（**不补默认值**）。 */
export function textCell(row: string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const raw = (row[index] ?? '').trim();
  if (raw === '' || raw === '-') return undefined;
  return raw;
}

/** 必需文本单元格。缺失或为空 → 抛 `missing-field`。 */
export function requireText(
  row: string[],
  index: number | undefined,
  label: string,
  path: string,
): string {
  const value = textCell(row, index);
  if (value === undefined) {
    throw new NormalizationError('missing-field', `${label} 的必填项为空`, path);
  }
  return value;
}

/**
 * 严格的数值解析。
 *
 * 与既有 `parseNumber` 的区别：**不做部分匹配**。`parseFloat('1,000')` 会得到
 * `1`（静默截断），`parseFloat('一千')` 会得到 `NaN`。新增表按 DC02 要求
 * 「数值不可解析即抛错，不静默」，因此这里先去掉千分位再整体匹配。
 */
function strictNumber(raw: string): number | undefined {
  const text = raw.replace(/,/g, '').trim();
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/** 数值单元格。空值／`-` → undefined；不可解析 → 抛 `parse-error`。 */
export function numberCell(
  row: string[],
  index: number | undefined,
  label: string,
  path: string,
): number | undefined {
  if (index === undefined) return undefined;
  const raw = (row[index] ?? '').trim();
  if (raw === '' || raw === '-') return undefined;
  const value = strictNumber(raw);
  if (value === undefined) {
    throw new NormalizationError(
      'parse-error',
      `${label} 的数值不可解析：${raw}`,
      path,
    );
  }
  return value;
}

/**
 * 占比单元格。
 *
 * 口径与画像投影一致：**含 `%` 则除以 100，否则按原值**（见归一化规则 §4.6）。
 */
export function percentCell(
  row: string[],
  index: number | undefined,
  label: string,
  path: string,
): number | undefined {
  if (index === undefined) return undefined;
  const raw = (row[index] ?? '').trim();
  if (raw === '' || raw === '-') return undefined;
  const isPercent = raw.endsWith('%');
  const value = strictNumber(isPercent ? raw.slice(0, -1) : raw);
  if (value === undefined) {
    throw new NormalizationError('parse-error', `${label} 的占比不可解析：${raw}`, path);
  }
  return isPercent ? value / 100 : value;
}

/**
 * 按列契约解析列下标。
 *
 * 缺必需列 → `missing-field` 抛错；可选列缺失不报错，只是取不到值。
 */
export function resolveColumns(table: DataTable, spec: TableSpec): Map<string, number> {
  const resolved = new Map<string, number>();
  for (const column of spec.columns) {
    const index = findColumn(table, [column.name, ...(column.aliases ?? [])]);
    if (index === undefined) {
      if (column.required) {
        throw new NormalizationError(
          'missing-field',
          `${spec.label}缺少必要列「${column.name}」，实际表头：${table.header.join('、')}`,
          table.path,
        );
      }
      continue;
    }
    resolved.set(column.name, index);
  }
  return resolved;
}

/**
 * 读取一行的指标列。
 *
 * - 有值 → 进 `metrics`（键为指标键，缺省用列名）
 * - 空值或列不存在 → 进 `missing`（**显式标记缺失，不插补**）
 * - 有值但不可解析 → 抛 `parse-error`
 */
export function readMetrics(
  row: string[],
  columns: Map<string, number>,
  spec: TableSpec,
  path: string,
): { metrics: Record<string, number>; missing: string[] } {
  const metrics: Record<string, number> = {};
  const missing: string[] = [];
  for (const column of spec.columns) {
    if (!column.metric) continue;
    const key = column.metricKey ?? column.name;
    const index = columns.get(column.name);
    const value =
      column.type === 'percent'
        ? percentCell(row, index, `${spec.label}的「${column.name}」`, path)
        : numberCell(row, index, `${spec.label}的「${column.name}」`, path);
    if (value === undefined) {
      missing.push(key);
      continue;
    }
    metrics[key] = value;
  }
  return { metrics, missing };
}
