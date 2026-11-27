import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

/**
 * 测试用的合成数据目录。
 *
 * 目录结构与真实数据一致（业务域目录 + 文件命名），
 * 但内容全部是合成的，不含任何真实业务数据。
 */

export interface FixtureOptions {
  /** 渠道数。 */
  channels?: number;
  /** 商品数。 */
  products?: number;
  /** 渠道画像的月份。 */
  month?: string;
}

/** 生成一个符合索引扫描规则的合成数据根目录。 */
export async function createFixtureDataRoot(options: FixtureOptions = {}): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-mcp-fixture-'));
  const channelCount = options.channels ?? 2;
  const productCount = options.products ?? 2;
  const month = options.month ?? '2507-2606';

  const domains = join(root, 'domains');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(join(domains, '07_人群画像', '抖音'), { recursive: true });

  // 商品宽表
  const productRows: (string | number)[][] = [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
  ];
  for (let i = 1; i <= productCount; i += 1) {
    productRows.push([
      `SPU-${String(i).padStart(3, '0')}`,
      '演示品牌',
      '2026',
      i % 2 === 0 ? '羽绒服' : '短袖T恤',
      i % 2 === 0 ? '短羽绒服' : 'T恤',
      199 * i,
      `100000${i}`,
      '18-24岁',
      'ACCESS',
    ]);
  }
  await writeSheet(join(domains, '04_商品信息', '商品宽表.xlsx'), productRows);

  // 渠道宽表
  const channelRows: (string | number)[][] = [
    ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
  ];
  for (let i = 1; i <= channelCount; i += 1) {
    channelRows.push([
      '演示品牌',
      '内容渠道',
      `D${String(i).padStart(5, '0')}`,
      `演示账号${i}`,
      i === 1 ? '抖音' : '天猫',
      i === 1 ? '抖音' : '天猫',
      '核心店',
      '上海',
      '营业',
      '2024-01-01',
    ]);
  }
  await writeSheet(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'), channelRows);

  // 渠道画像（抖音长表）
  const portraitRows = [
    ['标签类型', '标签', `${month}演示账号1-占比`, `${month}演示账号1-tgi`],
    ['预测性别', '男', '39.26%', '90.62'],
    ['预测性别', '女', '60.74%', '144.11'],
    ['预测年龄段', '18-19', '2.79%', '93.73'],
    ['预测年龄段', '20-23', '9.74%', '151.21'],
    ['预测年龄段', '24-30', '26.14%', '196.92'],
    ['八大消费群体', '都市银发', '3.10%', '120.50'],
    ['八大消费群体', 'genz', '8.20%', '133.30'],
    ['预测消费能力', '高消费', '10.00%', '110.00'],
    ['城市等级', '新一线城市', '5.00%', '105.00'],
    ['预测人生阶段', '单身一族', '20.00%', '95.00'],
  ];
  writeCsv(join(domains, '07_人群画像', '抖音', `${month}_演示账号1画像数据_抖音.csv`), portraitRows);

  // 单品画像
  const productPortraitRows = [
    ['标签类型', '标签', `SPU-001-占比`, `SPU-001-tgi`],
    ['预测性别', '男', '45.00%', '95.00'],
    ['预测性别', '女', '55.00%', '110.00'],
    ['预测年龄段', '18-19', '5.00%', '100.00'],
    ['预测年龄段', '20-23', '12.00%', '140.00'],
    ['八大消费群体', '都市银发', '2.00%', '110.00'],
    ['八大消费群体', 'genz', '15.00%', '150.00'],
    ['预测消费能力', '高消费', '12.00%', '108.00'],
    ['城市等级', '新一线城市', '8.00%', '110.00'],
    ['预测人生阶段', '单身一族', '30.00%', '120.00'],
  ];
  writeCsv(join(domains, '07_人群画像', '抖音', '款号SPU-001_抖音.csv'), productPortraitRows);

  return root;
}

async function writeSheet(path: string, rows: (string | number)[][]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  for (const row of rows) sheet.addRow(row);
  await workbook.xlsx.writeFile(path);
}

function writeCsv(path: string, rows: string[][]): void {
  const body = rows.map((row) => row.join(',')).join('\r\n');
  writeFileSync(path, `﻿${body}`, 'utf8');
}
