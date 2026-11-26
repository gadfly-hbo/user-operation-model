import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

/** 临时工作目录，测试结束由系统清理。 */
export function makeTempDir(prefix = 'uom-norm-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 写 CSV（UTF-8 带 BOM，贴近真实导出）。 */
export function writeCsv(path: string, rows: string[][]): string {
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  writeFileSync(path, `﻿${body}`, 'utf8');
  return path;
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** 写 XLSX 单 sheet。 */
export async function writeXlsx(
  path: string,
  sheetName: string,
  rows: (string | number | null)[][],
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) sheet.addRow(row);
  await workbook.xlsx.writeFile(path);
  return path;
}

/** 抖音画像 CSV：一个实体一列。 */
export function douyinPortraitCsv(
  path: string,
  entityId: string,
  month: string,
  rows: [string, string, string, string][],
): string {
  return writeCsv(path, [
    ['标签类型', '标签', `${month}${entityId}-占比`, `${month}${entityId}-tgi`],
    ...rows,
  ]);
}

/** 天猫画像 XLSX：只有占比，无 TGI。 */
export async function tmallPortraitXlsx(
  path: string,
  rows: [string, string, string][],
): Promise<string> {
  return writeXlsx(path, '明细', [['标签类型', '一级标签(标签值)', '占比'], ...rows]);
}

/** 京东画像 XLSX：标签名 / 枚举值 / 占比 / TGI。 */
export async function jdPortraitXlsx(
  path: string,
  rows: [string, string, string, string][],
): Promise<string> {
  return writeXlsx(path, 'Sheet0', [['标签名', '枚举值', '占比', 'TGI'], ...rows]);
}
