import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
  // 英文目录：构造「目录名与文件名平台不一致」的场景，
  // 用于锁定「文件名后缀优先于目录」的识别顺序
  mkdirSync(join(domains, '07_人群画像', 'douyin'), { recursive: true });

  await writeXlsx(join(domains, '04_商品信息', '商品宽表.xlsx'), 'Sheet1', [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-002', '演示品牌', '2026', '短袖T恤', 'T恤', '299', '100002', '18-24岁', 'ACCESS'],
    ['SPU-003', '演示品牌', '2026', '羽绒服', '短羽绒服', '599', '100003', '25-30岁', 'CORE'],
    ['SPU-004', '演示品牌', '2026', '短袖T恤', 'T恤', '259', '100004', '18-24岁', 'ACCESS'],
    ['SPU-006', '演示品牌', '2026', '短袖T恤', '长袖T恤', '279', '100006', '18-24岁', 'ACCESS'],
  ]);

  // 第二张商品表，含与第一张重复的款号 SPU-001（用于跨表重复款号的冲突检测）
  await writeXlsx(join(domains, '04_商品信息', '商品附加信息表.xlsx'), 'Sheet1', [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-005', '演示品牌', '2026', '卫衣', '连帽卫衣', '399', '100005', '18-24岁', 'ACCESS'],
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

  // 同一实体同月的天猫画像（XLSX，sheet 名「明细」）：用于检验多平台命中时的确定性选择
  await writeXlsx(
    join(domains, '07_人群画像', 'douyin', '2507-2606_演示账号1画像数据_天猫.xlsx'),
    '明细',
    [
      ['标签类型', '一级标签(标签值)', '占比'],
      ['预测性别', '男', '35.00%'],
      ['预测性别', '女', '65.00%'],
      ['八大消费群体', '都市银发', '1.00%'],
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

/* ── P0 数据收尾夹具 ────────────────────────────────────────────────────
 *
 * 全部为合成数据，不含任何真实业务数据。
 */

/** P0 新增表的默认内容（相对 data 根目录的路径 → CSV 行）。 */
export const P0_TABLE_ROWS: Record<string, string[][]> = {
  'tables/funnel.csv': [
    ['款号', '月份', '阶段', '浏览', '收藏', '加购', '购买', '直接购买', '退货'],
    ['SPU-001', '2026-01', 'launch', '1000', '100', '50', '40', '10', '2'],
    ['SPU-001', '2026-02', 'growth', '1200', '150', '60', '55', '15', '3'],
    ['SPU-002', '2026-01', 'launch', '800', '80', '40', '30', '8', ''],
  ],
  'tables/member-features.csv': [
    ['特征层级', '特征分组', '特征字段', '特征值', '说明'],
    ['体型版型', '版型', '偏好版型', '宽松', '偏好宽松剪裁'],
    ['风格审美', '风格', '偏好风格', '简约', ''],
    ['时令节律', '季节', '购买季节', '秋冬', ''],
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
    ['2026-01', '31-60', '80', '10.0%', '卫衣', '天猫', '38.0%'],
    ['2026-01', '>365', '30', '3.8%', 'T恤', '线下门店', ''],
  ],
  'retention/channel-flow.csv': [
    ['月份', '来源渠道', '回购渠道', '回购人数', '跨渠道回购率'],
    ['2026-01', '抖音直播', '天猫', '30', '12.5%'],
    ['2026-01', '抖音直播', '抖音直播', '210', '87.5%'],
    ['2026-01', '天猫', '天猫', '90', ''],
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
    ['2026-01', '清仓客次季跃迁', '', '', '', '22.0%', '65.0%', '8.0%'],
  ],
  'tables/product-channel.csv': [
    ['款号', '店铺编码', '月份', '零售额', '零售量'],
    ['SPU-001', 'D00001', '2026-01', '12000', '60'],
    ['SPU-002', 'D00001', '2026-01', '8000', '40'],
    ['SPU-003', 'D00002', '2026-01', '20000', '50'],
  ],
  'tables/aggregate-groups.csv': [
    ['款号', '系列', '爆款组', 'IP'],
    ['SPU-001', '基础系列', '爆款A', '-'],
    ['SPU-002', '基础系列', '爆款B', '-'],
    ['SPU-003', '羽绒系列', '爆款A', '热播IP'],
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
    ['SPU-002', '2026-01', '8000', '40', '', '6%', '4%', '', '4200', ''],
    ['SPU-003', '2026-02', '20000', '50', '70%', '', '3%', '50%', '3000', '1.8%'],
  ],
  'tables/channel-performance.csv': [
    ['店铺编码', '月份', '成交额', '成交件数', '转化率', '客单价', '毛利率'],
    ['D00001', '2026-01', '50000', '200', '3.0%', '250', '42%'],
    ['D00002', '2026-01', '30000', '100', '2.0%', '300', ''],
  ],
  'tables/entity-alias.csv': [
    ['规范实体名', '别名', '店铺编码', '平台'],
    ['演示账号3', '演示账号3旗舰店', 'D00003', '抖音'],
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
  /** `data/README.md` 的声明内容；null 表示不写 README。 */
  declaration?: { months?: string; channels?: string; products?: string } | null;
  /** 冲突映射表的处置方式。 */
  conflictResolution?: 'keep-a' | 'keep-b' | 'manual';
}

/**
 * 生成 P0 数据收尾用的合成数据根目录。
 *
 * 含商品宽表、渠道宽表、抖音／天猫画像、品牌画像、竞品画像，
 * 以及可选的新增表（漏斗／留存／别名／冲突／关联／聚合／经营指标）。
 */
export async function createP0DataRoot(options: P0FixtureOptions = {}): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-p0-'));
  const domains = join(root, 'domains');
  const portraitDir = join(domains, '07_人群画像', '抖音');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(join(domains, '01_品牌信息'), { recursive: true });
  mkdirSync(portraitDir, { recursive: true });
  mkdirSync(join(domains, '07_人群画像', '天猫'), { recursive: true });
  mkdirSync(join(domains, '07_人群画像', '竞品'), { recursive: true });

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
    ['演示品牌', '内容渠道', 'D00003', '演示账号3', '抖音', '抖音', '核心店', '广州', '营业', '2024-01-01'],
  ]);

  // 渠道画像：抖音（演示账号1）
  writeCsv(join(portraitDir, '2507-2606_演示账号1画像数据_抖音.csv'), [
    ['标签类型', '标签', '2507-2606演示账号1-占比', '2507-2606演示账号1-tgi'],
    ['预测性别', '男', '39.26%', '90.62'],
    ['预测性别', '女', '60.74%', '144.11'],
    ['八大消费群体', '都市银发', '3.10%', '120.50'],
    ['八大消费群体', 'genz', '8.20%', '133.30'],
  ]);

  // 渠道画像：天猫（演示账号1，同月同实体 —— 构成跨平台冲突对）
  await writeXlsx(
    join(domains, '07_人群画像', '天猫', '2507-2606_演示账号1画像数据_天猫.xlsx'),
    '明细',
    [
      ['标签类型', '一级标签(标签值)', '占比'],
      ['预测性别', '男', '35.00%'],
      ['预测性别', '女', '65.00%'],
      ['八大消费群体', '都市银发', '1.00%'],
    ],
  );

  // 渠道画像：抖音（演示账号3旗舰店 —— 需别名目录才能与 D00003 关联）
  writeCsv(join(portraitDir, '2507-2606_演示账号3旗舰店画像数据_抖音.csv'), [
    ['标签类型', '标签', '2507-2606演示账号3旗舰店-占比', '2507-2606演示账号3旗舰店-tgi'],
    ['预测性别', '男', '45.00%', '95.00'],
    ['预测性别', '女', '55.00%', '110.00'],
    ['八大消费群体', 'genz', '12.00%', '120.00'],
  ]);

  // 单品画像
  for (const spu of ['SPU-001', 'SPU-002', 'SPU-003']) {
    writeCsv(join(portraitDir, `款号${spu}_抖音.csv`), [
      ['标签类型', '标签', `${spu}-占比`, `${spu}-tgi`],
      ['预测性别', '男', '45.00%', '95.00'],
      ['预测性别', '女', '55.00%', '110.00'],
      ['八大消费群体', '都市银发', '2.00%', '110.00'],
      ['八大消费群体', 'genz', '15.00%', '150.00'],
    ]);
  }

  // 品牌画像（探测表要求：文件名含「品牌」且含「画像」）
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

  // 新增表
  const include = options.include ?? Object.keys(P0_TABLE_ROWS);
  for (const relativePath of include) {
    const rows = options.tables?.[relativePath] ?? P0_TABLE_ROWS[relativePath];
    if (!rows) throw new Error(`未知的新增表：${relativePath}`);
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    let content = rows;
    if (relativePath === 'tables/portrait-conflicts.csv' && options.conflictResolution) {
      content = rows.map((row, index) =>
        index === 0 ? row : [...row.slice(0, 4), options.conflictResolution!, ...row.slice(5)],
      );
    }
    writeCsv(target, content);
  }

  // data/README.md 的时间范围声明
  if (options.declaration !== null) {
    const declaration = options.declaration ?? {};
    writeFileSync(
      join(root, 'README.md'),
      [
        '# 数据存放目录',
        '',
        '## 数据时间范围声明',
        '',
        '| 项 | 内容 |',
        '| --- | --- |',
        `| 覆盖月份 | ${declaration.months ?? ''} |`,
        `| 渠道范围 | ${declaration.channels ?? ''} |`,
        `| 商品范围 | ${declaration.products ?? ''} |`,
        '| 已知缺失 | 无 |',
        '| 说明 | 合成夹具 |',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  return root;
}
