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

/**
 * 生成一个符合索引扫描规则的合成数据根目录。
 *
 * 与 data-mcp 包的同名 helper 各自独立，避免跨包耦合测试夹具。
 */
export async function createFixtureIndexRoot(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-core-index-'));
  const domains = join(root, 'domains');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(join(domains, '07_人群画像', '抖音'), { recursive: true });

  await writeXlsx(join(domains, '04_商品信息', '商品宽表.xlsx'), 'Sheet1', [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-002', '演示品牌', '2026', '短袖T恤', 'T恤', '299', '100002', '18-24岁', 'ACCESS'],
    ['SPU-003', '演示品牌', '2026', '羽绒服', '短羽绒服', '599', '100003', '25-30岁', 'CORE'],
  ]);

  await writeXlsx(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'), 'Sheet1', [
    ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
    ['演示品牌', '内容渠道', 'D00001', '演示账号1', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '搜索渠道', 'D00002', '演示旗舰店', '天猫', '天猫', '旗舰店', '杭州', '营业', '2024-01-01'],
  ]);

  writeCsv(
    join(domains, '07_人群画像', '抖音', '2507-2606_演示账号1画像数据_抖音.csv'),
    [
      ['标签类型', '标签', '2507-2606演示账号1-占比', '2507-2606演示账号1-tgi'],
      ['预测性别', '男', '39.26%', '90.62'],
      ['预测性别', '女', '60.74%', '144.11'],
      ['预测年龄段', '18-19', '2.79%', '93.73'],
      ['预测年龄段', '20-23', '9.74%', '151.21'],
      ['八大消费群体', '都市银发', '3.10%', '120.50'],
      ['八大消费群体', 'genz', '8.20%', '133.30'],
      ['预测消费能力', '高消费', '10.00%', '110.00'],
      ['城市等级', '新一线城市', '5.00%', '105.00'],
      ['预测人生阶段', '单身一族', '20.00%', '95.00'],
    ],
  );

  // 第二个成员有画像，用于检验聚合 TGI 的加权平均（与 SPU-001 的 TGI 不同）
  writeCsv(
    join(domains, '07_人群画像', '抖音', '款号SPU-002_抖音.csv'),
    [
      ['标签类型', '标签', 'SPU-002-占比', 'SPU-002-tgi'],
      ['预测性别', '男', '20.00%', '195.00'],
      ['预测性别', '女', '80.00%', '125.00'],
      ['八大消费群体', '都市银发', '4.00%', '160.00'],
      ['八大消费群体', 'genz', '9.00%', '118.00'],
    ],
  );

  // 第二个渠道有画像但月份不同：用于检验 list_channels 的月份过滤确实生效
  writeCsv(
    join(domains, '07_人群画像', '抖音', '2407-2506_演示旗舰店画像数据_抖音.csv'),
    [
      ['标签类型', '标签', '2407-2506演示旗舰店-占比', '2407-2506演示旗舰店-tgi'],
      ['预测性别', '男', '50.00%', '100.00'],
      ['预测性别', '女', '50.00%', '100.00'],
      ['八大消费群体', '都市银发', '1.00%', '105.00'],
    ],
  );

  writeCsv(
    join(domains, '07_人群画像', '抖音', '款号SPU-001_抖音.csv'),
    [
      ['标签类型', '标签', 'SPU-001-占比', 'SPU-001-tgi'],
      ['预测性别', '男', '45.00%', '95.00'],
      ['预测性别', '女', '55.00%', '110.00'],
      ['八大消费群体', '都市银发', '2.00%', '110.00'],
      ['八大消费群体', 'genz', '15.00%', '150.00'],
      ['预测消费能力', '高消费', '12.00%', '108.00'],
    ],
  );

  return root;
}
