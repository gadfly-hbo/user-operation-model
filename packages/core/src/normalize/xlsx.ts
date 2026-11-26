import { existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { NormalizationError } from './types.js';

/** 读 XLSX 的首个 sheet（或指定 sheet），返回二维字符串数组。 */
export async function readXlsxRows(path: string, sheetName?: string): Promise<string[][]> {
  // 文件不存在是调用方问题，显式抛标准 ENOENT，不混入解析错误语义
  if (!existsSync(path)) {
    const error = new Error(
      `ENOENT: no such file or directory, open '${path}'`,
    ) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(path);
  } catch (error) {
    // 兜底分支：上方的 existsSync 守卫已先拦截文件不存在，
    // 但若底层库未来抛出可识别的 ENOENT，仍保留其原始语义而非包装成解析错误。
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    throw new NormalizationError(
      'parse-error',
      `XLSX 无法解析：${(error as Error).message}`,
      path,
    );
  }
  const sheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    const cells: string[] = [];
    // exceljs 的 row.values 下标 0 为空，占位从 1 开始
    for (let i = 1; i < values.length; i += 1) cells.push(cellToString(values[i]));
    rows.push(cells);
  });
  return rows;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const rich = value as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((r) => r.text).join('');
    if (typeof rich.text === 'string') return rich.text;
    if (rich.result !== undefined) return String(rich.result);
    return '';
  }
  return String(value);
}

/**
 * 找到表头行：首个包含指定关键字之一的行。
 * 京东导出首行是合并单元格标题（如「人群=xxx」），需要跳过。
 */
export function findHeaderRow(rows: string[][], keywords: string[]): number {
  const index = rows.findIndex((row) =>
    row.some((cell) => keywords.some((keyword) => cell.trim() === keyword)),
  );
  return index === -1 ? 0 : index;
}
