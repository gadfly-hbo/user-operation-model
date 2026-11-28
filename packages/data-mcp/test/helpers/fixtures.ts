import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

async function writeSheet(
  path: string,
  rows: (string | number)[][],
  sheetName = 'Sheet1',
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) sheet.addRow(row);
  await workbook.xlsx.writeFile(path);
}

function writeCsv(path: string, rows: string[][]): void {
  const body = rows.map((row) => row.join(',')).join('\r\n');
  writeFileSync(path, `﻿${body}`, 'utf8');
}

/* ── P0 数据收尾夹具 ────────────────────────────────────────────────────
 *
 * 与 core 包的夹具各自独立（不跨包耦合），内容全部合成。
 */

/** P0 新增表的默认内容（相对 data 根目录的路径 → CSV 行）。 */
export const P0_TABLE_ROWS: Record<string, string[][]> = {
  'tables/funnel.csv': [
    ['款号', '月份', '阶段', '浏览', '收藏', '加购', '购买', '直接购买', '退货'],
    ['SPU-001', '2026-01', 'launch', '1000', '100', '50', '40', '10', '2'],
    ['SPU-002', '2026-01', 'launch', '800', '80', '40', '30', '8', ''],
  ],
  'tables/member-features.csv': [
    ['特征层级', '特征分组', '特征字段', '特征值', '说明'],
    ['体型版型', '版型', '偏好版型', '宽松', '偏好宽松剪裁'],
    ['行为派生', 'RFM', '最近购买间隔天数', '90', 'RFM 派生'],
  ],
  'retention/cohort.csv': [
    ['首购月份', '买家数', 'Day30留存率', 'Day60留存率', 'Day90留存率', '次季正价跃迁率'],
    ['2026-01', '1000', '35.5%', '28.2%', '21.0%', '12.0%'],
    ['2026-02', '1200', '33.1%', '25.0%', '18.5%', '10.5%'],
  ],
  'retention/recency.csv': [
    ['月份', '上次购买天数切片', '回购人数', '老客内占比', '唤醒主推品类', '主要购买渠道', '平均毛利率'],
    ['2026-01', '1-30', '120', '15.0%', '羽绒服', '抖音直播', '42.5%'],
    ['2026-01', '>365', '30', '3.8%', 'T恤', '线下门店', ''],
  ],
  'retention/channel-flow.csv': [
    ['月份', '来源渠道', '回购渠道', '回购人数', '跨渠道回购率'],
    ['2026-01', '抖音直播', '天猫', '30', '12.5%'],
    ['2026-01', '抖音直播', '抖音直播', '210', '87.5%'],
  ],
  'retention/diagnosis.csv': [
    [
      '月份',
      '诊断类型',
      '大促新客第60天二回比例',
      'Recency超180天占比',
      '平均毛利率',
      '加购率',
      '画像重合度',
      '正价转化率',
    ],
    ['2026-01', '二回断崖', '18.0%', '', '', '', '', ''],
    ['2026-01', '虚假繁荣', '', '35.0%', '38.0%', '', '', ''],
  ],
  'tables/product-channel.csv': [
    ['款号', '店铺编码', '月份', '零售额', '零售量'],
    ['SPU-001', 'D00001', '2026-01', '12000', '60'],
    ['SPU-002', 'D00002', '2026-01', '8000', '40'],
  ],
  'tables/aggregate-groups.csv': [
    ['款号', '系列', '爆款组', 'IP'],
    ['SPU-001', '基础系列', '爆款A', '-'],
    ['SPU-002', '基础系列', '爆款B', '-'],
  ],
  'tables/product-performance.csv': [
    [
      '款号',
      '月份',
      '零售额',
      '零售量',
      '售罄率',
      '退货率',
      '退款率',
      '毛利率',
      'UV',
      '转化率',
    ],
    ['SPU-001', '2026-01', '12000', '60', '80%', '5%', '3%', '45%', '5000', '2.5%'],
  ],
  'tables/channel-performance.csv': [
    ['店铺编码', '月份', '成交额', '成交件数', '转化率', '客单价', '毛利率'],
    ['D00001', '2026-01', '50000', '200', '3.0%', '250', '42%'],
  ],
  'tables/entity-alias.csv': [
    ['规范实体名', '别名', '店铺编码', '平台'],
    ['演示账号2', '演示账号2旗舰店', 'D00002', '天猫'],
  ],
  'tables/portrait-conflicts.csv': [
    ['款号或实体', '月份', '平台A', '平台B', '处置', '说明'],
    ['演示账号1', '2025-07~2026-06', '抖音', '天猫', 'keep-a', '抖音口径优先'],
  ],
};

/** P0 夹具选项。 */
export interface P0FixtureOptions {
  /** 要写入的新表路径（相对 data 根）。默认写入全部。 */
  include?: string[];
  /** 覆盖单个表的内容（路径 → 行）。 */
  tables?: Record<string, string[][]>;
}

/**
 * 生成含 P0 新增表的合成数据根目录。
 *
 * 除商品／渠道／画像外，还写入品牌画像与竞品画像，
 * 使 `DATA_SOURCE_PROBES` 的每个探测条件都能被满足。
 */
export async function createP0DataRoot(options: P0FixtureOptions = {}): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-mcp-p0-'));
  const domains = join(root, 'domains');
  const portraitDir = join(domains, '07_人群画像', '抖音');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(join(domains, '01_品牌信息'), { recursive: true });
  mkdirSync(portraitDir, { recursive: true });
  mkdirSync(join(domains, '07_人群画像', '竞品'), { recursive: true });

  await writeSheet(join(domains, '04_商品信息', '商品宽表.xlsx'), [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-002', '演示品牌', '2026', '短袖T恤', 'T恤', '299', '100002', '18-24岁', 'ACCESS'],
  ]);

  await writeSheet(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'), [
    ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
    ['演示品牌', '内容渠道', 'D00001', '演示账号1', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '搜索渠道', 'D00002', '演示账号2', '天猫', '天猫', '核心店', '上海', '营业', '2024-01-01'],
  ]);

  writeCsv(join(portraitDir, '2507-2606_演示账号1画像数据_抖音.csv'), [
    ['标签类型', '标签', '2507-2606演示账号1-占比', '2507-2606演示账号1-tgi'],
    ['预测性别', '男', '39.26%', '90.62'],
    ['预测性别', '女', '60.74%', '144.11'],
    ['八大消费群体', '都市银发', '3.10%', '120.50'],
  ]);

  writeCsv(join(portraitDir, '款号SPU-001_抖音.csv'), [
    ['标签类型', '标签', 'SPU-001-占比', 'SPU-001-tgi'],
    ['预测性别', '男', '45.00%', '95.00'],
    ['预测性别', '女', '55.00%', '110.00'],
    ['八大消费群体', '都市银发', '2.00%', '110.00'],
  ]);

  // 品牌画像：探测表要求文件名含「品牌」且含「画像」
  writeCsv(join(domains, '01_品牌信息', '演示品牌人群画像_抖音.csv'), [
    ['标签类型', '标签', '演示品牌-占比', '演示品牌-tgi'],
    ['预测性别', '男', '40.00%', '100.00'],
    ['预测性别', '女', '60.00%', '105.00'],
  ]);

  // 竞品画像
  writeCsv(join(domains, '07_人群画像', '竞品', '竞品A画像数据_抖音.csv'), [
    ['标签类型', '标签', '竞品A-占比', '竞品A-tgi'],
    ['预测性别', '男', '30.00%', '88.00'],
    ['预测性别', '女', '70.00%', '112.00'],
  ]);

  const include = options.include ?? Object.keys(P0_TABLE_ROWS);
  for (const relativePath of include) {
    const rows = options.tables?.[relativePath] ?? P0_TABLE_ROWS[relativePath];
    if (!rows) throw new Error(`未知的新增表：${relativePath}`);
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeCsv(target, rows);
  }

  return root;
}

/* ── 切片 A 夹具：多月份／多平台画像 + 按月表数据（SA-03／SA-05） ──────────
 *
 * 全部为合成数据：
 * - D00001 演示账号1：抖音画像 2026-09 与 2026-10 两份（跨月）
 * - D00002 演示账号2：抖音画像 2507-2606 区间一份
 * - D00003 演示账号3：2026-10 抖音 + 天猫两份（同月多平台）
 * - SPU-001：抖音画像 2026-09／2026-10 两份 + 2026-10 天猫一份（跨月且同月多平台）；
 *   经营指标／漏斗／商品↔渠道成交均有 2026-09 与 2026-10 两个月份
 */
export async function createPeriodDataRoot(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-mcp-period-'));
  const domains = join(root, 'domains');
  const douyinDir = join(domains, '07_人群画像', '抖音');
  const tmallDir = join(domains, '07_人群画像', '天猫');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(douyinDir, { recursive: true });
  mkdirSync(tmallDir, { recursive: true });

  await writeSheet(join(domains, '04_商品信息', '商品宽表.xlsx'), [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-002', '演示品牌', '2026', '短袖T恤', 'T恤', '299', '100002', '18-24岁', 'ACCESS'],
  ]);
  await writeSheet(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'), [
    ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
    ['演示品牌', '内容渠道', 'D00001', '演示账号1', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00002', '演示账号2', '天猫', '天猫', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00003', '演示账号3', '京东', '京东', '核心店', '上海', '营业', '2024-01-01'],
  ]);

  const genderRows = (male: string, female: string): string[][] => [
    ['预测性别', '男', male, '100.00'],
    ['预测性别', '女', female, '100.00'],
    ['八大消费群体', '都市银发', '3.00%', '110.00'],
  ];

  writeCsv(join(douyinDir, '2026-09_演示账号1画像数据_抖音.csv'), [
    ['标签类型', '标签', '2026-09演示账号1-占比', '2026-09演示账号1-tgi'],
    ...genderRows('40.00%', '60.00%'),
  ]);
  writeCsv(join(douyinDir, '2026-10_演示账号1画像数据_抖音.csv'), [
    ['标签类型', '标签', '2026-10演示账号1-占比', '2026-10演示账号1-tgi'],
    ...genderRows('30.00%', '70.00%'),
  ]);
  writeCsv(join(douyinDir, '2507-2606_演示账号2画像数据_抖音.csv'), [
    ['标签类型', '标签', '2507-2606演示账号2-占比', '2507-2606演示账号2-tgi'],
    ...genderRows('50.00%', '50.00%'),
  ]);
  writeCsv(join(douyinDir, '2026-10_演示账号3画像数据_抖音.csv'), [
    ['标签类型', '标签', '2026-10演示账号3-占比', '2026-10演示账号3-tgi'],
    ...genderRows('20.00%', '80.00%'),
  ]);

  writeCsv(join(douyinDir, '款号SPU-001_2609_抖音.csv'), [
    ['标签类型', '标签', '2026-09SPU-001-占比', '2026-09SPU-001-tgi'],
    ...genderRows('45.00%', '55.00%'),
  ]);
  writeCsv(join(douyinDir, '款号SPU-001_2610_抖音.csv'), [
    ['标签类型', '标签', '2026-10SPU-001-占比', '2026-10SPU-001-tgi'],
    ...genderRows('45.00%', '55.00%'),
  ]);
  writeCsv(join(douyinDir, '款号SPU-002_2610_抖音.csv'), [
    ['标签类型', '标签', '2026-10SPU-002-占比', '2026-10SPU-002-tgi'],
    ...genderRows('10.00%', '90.00%'),
  ]);

  await writeSheet(
    join(tmallDir, '2026-10_演示账号3画像数据_天猫.xlsx'),
    [['标签类型', '一级标签(标签值)', '占比'], ['预测性别', '男', '25.00%'], ['预测性别', '女', '75.00%']],
    '明细',
  );

  const include = [
    'tables/product-performance.csv',
    'tables/product-channel.csv',
    'tables/funnel.csv',
    'tables/aggregate-groups.csv',
  ];
  const rows: Record<string, string[][]> = {
    'tables/product-performance.csv': [
      ['款号', '月份', '零售额', '零售量', '售罄率', '退货率', '退款率', '毛利率', 'UV', '转化率'],
      ['SPU-001', '2026-09', '6000', '30', '80%', '5%', '3%', '45%', '5000', '2.5%'],
      ['SPU-001', '2026-10', '12000', '40', '85%', '4%', '2%', '46%', '6000', '3.0%'],
    ],
    'tables/product-channel.csv': [
      ['款号', '店铺编码', '月份', '零售额', '零售量'],
      ['SPU-001', 'D00001', '2026-09', '6000', '30'],
      ['SPU-001', 'D00001', '2026-10', '12000', '40'],
    ],
    'tables/funnel.csv': [
      ['款号', '月份', '阶段', '浏览', '收藏', '加购', '购买', '直接购买', '退货'],
      ['SPU-001', '2026-09', 'launch', '1000', '100', '50', '40', '10', '2'],
      ['SPU-001', '2026-10', 'growth', '1200', '150', '60', '55', '15', '3'],
    ],
    'tables/aggregate-groups.csv': [
      ['款号', '系列', '爆款组', 'IP'],
      ['SPU-001', '基础系列', '爆款A', '-'],
      ['SPU-002', '基础系列', '爆款B', '-'],
    ],
  };
  for (const relativePath of include) {
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeCsv(target, rows[relativePath]!);
  }

  return root;
}
