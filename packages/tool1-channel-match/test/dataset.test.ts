import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { buildIndex } from '@uom/core';
import {
  buildDataRootDataset,
  buildReferenceDataset,
  parseReferenceMonth,
  scoreDataset,
} from '../src/index.js';

/**
 * 数据集适配的单测。
 *
 * 用**合成**目录结构验证两条数据路径：参考数据只读路径与 `data/` 正式路径。
 * 真实业务数据不进仓库，测试也不依赖本机参考目录。
 */

const SIX_DIMENSION_ROWS: [string, string, string, string][] = [
  ['预测性别', '女', '92%', '180'],
  ['预测性别', '男', '8%', '20'],
  ['预测年龄段', '18-23', '35%', '120'],
  ['预测年龄段', '24-30', '40%', '150'],
  ['预测年龄段', '31-40', '15%', '60'],
  ['预测年龄段', '41-50', '7%', '30'],
  ['预测年龄段', '50+', '3%', '12'],
  ['八大消费群体', '新锐白领', '30%', '140'],
  ['八大消费群体', '都市蓝领', '20%', '90'],
  ['八大消费群体', '精致妈妈', '20%', '95'],
  ['八大消费群体', 'Z世代', '18%', '110'],
  ['八大消费群体', '小镇青年', '12%', '60'],
  ['预测消费能力', '高消费', '30%', '200'],
  ['预测消费能力', '中消费', '45%', '120'],
  ['预测消费能力', '低消费', '25%', '60'],
  ['城市等级', '一线', '30%', '160'],
  ['城市等级', '新一线', '30%', '140'],
  ['城市等级', '二线', '25%', '100'],
  ['城市等级', '三线', '15%', '60'],
  ['预测人生阶段', '单身期', '60%', '150'],
  ['预测人生阶段', '已婚未育期', '20%', '80'],
  ['预测人生阶段', '养育期', '20%', '70'],
];

function writeCsv(path: string, rows: string[][]): void {
  const body = rows
    .map((row) => row.map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\r\n');
  writeFileSync(path, `﻿${body}`, 'utf8');
}

function douyinPortrait(path: string, entityId: string, month = ''): void {
  writeCsv(path, [
    ['标签类型', '标签', `${month}${entityId}-占比`, `${month}${entityId}-tgi`],
    ...SIX_DIMENSION_ROWS,
  ]);
}

describe('参考数据 · 月份解析', () => {
  test('识别三种月份写法', () => {
    assert.equal(parseReferenceMonth('森马Semir服饰号直播成交2610画像数据.csv'), '2026-10');
    assert.equal(parseReferenceMonth('森马官旗26年10月-商品卡画像数据.csv'), '2026-10');
    assert.equal(parseReferenceMonth('森马官旗26年8月-短视频画像数据.csv'), '2026-08');
  });

  test('无法解析时返回 undefined，不猜测', () => {
    assert.equal(parseReferenceMonth('画像数据.csv'), undefined);
    assert.equal(parseReferenceMonth('成交9913画像数据.csv'), undefined);
  });
});

describe('参考数据 · 只读适配', () => {
  function buildRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'uom-ref-'));
    mkdirSync(join(root, '直播', '演示账号A'), { recursive: true });
    mkdirSync(join(root, '直播', '演示账号B'), { recursive: true });
    mkdirSync(join(root, '商品卡', '演示旗舰店'), { recursive: true });
    mkdirSync(join(root, 'TOP20商品', '商品单款人群画像数据'), { recursive: true });

    douyinPortrait(join(root, '直播', '演示账号A', '演示账号A直播成交2610画像数据.csv'), '演示账号A');
    douyinPortrait(join(root, '直播', '演示账号B', '演示账号B直播成交2509画像数据.csv'), '演示账号B');
    douyinPortrait(
      join(root, '商品卡', '演示旗舰店', '演示官旗26年10月-商品卡画像数据.csv'),
      '演示旗舰店',
    );
    douyinPortrait(
      join(root, 'TOP20商品', '商品单款人群画像数据', 'SPU-9001画像数据.csv'),
      'SPU-9001',
    );
    douyinPortrait(
      join(root, 'TOP20商品', '商品单款人群画像数据', 'SPU-9002画像数据.csv'),
      'SPU-9002',
    );

    writeCsv(join(root, 'TOP20商品', '商品数据表.csv'), [
      ['款号', '商品名称', '零售额', '零售量', '件单价'],
      ['SPU-9001', '演示商品一', '12020', '40', '300'],
      ['SPU-9002', '演示商品二', '', '', ''],
    ]);
    return root;
  }

  test('渠道按 `<类型>:<目录名>` 命名，并只保留所选月有画像的实体', () => {
    const dataset = buildReferenceDataset({ root: buildRoot(), month: '2026-10' });
    const ids = dataset.channels.map((channel) => channel.id).sort();
    assert.deepEqual(ids, ['card:演示旗舰店', 'live:演示账号A']);
    assert.ok(
      dataset.notes.some((note) => note.includes('演示账号B')),
      '缺该月画像的渠道应记录在说明里',
    );
  });

  test('价格按 零售额÷零售量 解析；缺指标的款号价格缺失且不插补', () => {
    const dataset = buildReferenceDataset({ root: buildRoot(), month: '2026-10' });
    const withMetrics = dataset.products.find((product) => product.spu === 'SPU-9001');
    const withoutMetrics = dataset.products.find((product) => product.spu === 'SPU-9002');
    assert.equal(withMetrics?.price, 300.5);
    assert.equal(withMetrics?.priceSource, 'retail-amount-qty');
    assert.equal(withMetrics?.name, '演示商品一');
    assert.equal(withoutMetrics?.price, undefined);
    assert.equal(withoutMetrics?.priceSource, 'missing');
  });

  test('单品画像无月份，按静态事实画像使用', () => {
    const dataset = buildReferenceDataset({ root: buildRoot(), month: '2026-10' });
    for (const product of dataset.products) {
      assert.equal(product.portraitMatch, 'unknown');
      assert.equal(product.portrait?.month, '');
    }
  });

  test('评分覆盖每个「商品 × 渠道」组合，缺价单元带缺价标记', () => {
    const dataset = buildReferenceDataset({ root: buildRoot(), month: '2026-10' });
    const results = scoreDataset(dataset);
    assert.equal(results.length, dataset.products.length * dataset.channels.length);
    assert.ok(results.some((result) => result.flags.priceMissing));
    assert.ok(results.every((result) => result.totalScore !== null));
  });

  test('参考数据根目录不存在时明确报错', () => {
    assert.throws(
      () => buildReferenceDataset({ root: join(tmpdir(), 'uom-not-exist-dir') }),
      /参考数据根目录不存在/,
    );
  });
});

async function buildDataRoot(): Promise<string> {
    const root = mkdtempSync(join(tmpdir(), 'uom-tool1-data-'));
    const domains = join(root, 'domains');
    mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
    mkdirSync(join(domains, '04_商品信息'), { recursive: true });
    mkdirSync(join(domains, '07_人群画像', '抖音'), { recursive: true });

    const channelBook = new ExcelJS.Workbook();
    const channelSheet = channelBook.addWorksheet('Sheet1');
    channelSheet.addRow(['店铺编码', '店铺', '渠道类型', '平台']);
    channelSheet.addRow(['D00001', '演示账号A', '抖音直播', '抖音']);
    await channelBook.xlsx.writeFile(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'));

    const productBook = new ExcelJS.Workbook();
    const productSheet = productBook.addWorksheet('Sheet1');
    productSheet.addRow(['款号', '吊牌价', '中类', '小类']);
    productSheet.addRow(['SPU-9001', '299', '短袖T恤', 'T恤']);
    await productBook.xlsx.writeFile(join(domains, '04_商品信息', '商品宽表.xlsx'));

    douyinPortrait(
      join(domains, '07_人群画像', '抖音', '2026-10_演示账号A_抖音.csv'),
      '演示账号A',
      '2026-10',
    );
    douyinPortrait(
      join(domains, '07_人群画像', '抖音', '款号SPU-9001_抖音.csv'),
      'SPU-9001',
    );
    return root;
}

describe('data/ 正式路径 · 适配', () => {
  test('按店铺名关联到渠道画像，按款号关联到单品画像', async () => {
    const root = await buildDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2026-10' });
    assert.equal(dataset.channels.length, 1);
    assert.equal(dataset.channels[0]?.id, 'D00001');
    assert.equal(dataset.channels[0]?.portraitMatch, 'exact');
    assert.equal(dataset.products.length, 1);
    assert.equal(dataset.products[0]?.spu, 'SPU-9001');
    assert.equal(dataset.products[0]?.portraitMatch, 'unknown');
  });

  test('所选月无画像时不回退到相邻月份', async () => {
    const root = await buildDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2025-01' });
    assert.equal(dataset.channels.length, 0);
    assert.ok(dataset.notes.some((note) => note.includes('无画像')));
  });

  test('缺成交单价时价格缺失，不插补兜底价', async () => {
    const root = await buildDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2026-10' });
    assert.equal(dataset.products[0]?.price, undefined);
    assert.equal(dataset.products[0]?.priceSource, 'missing');
    const results = scoreDataset(dataset);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.flags.priceMissing, true);
  });
});

/** 多月份／多平台／年份画像 + 按月经营指标的合成数据根。 */
async function buildPeriodDataRoot(): Promise<string> {
    const root = mkdtempSync(join(tmpdir(), 'uom-tool1-period-'));
    const domains = join(root, 'domains');
    const douyinDir = join(domains, '07_人群画像', '抖音');
    const tmallDir = join(domains, '07_人群画像', '天猫');
    mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
    mkdirSync(join(domains, '04_商品信息'), { recursive: true });
    mkdirSync(douyinDir, { recursive: true });
    mkdirSync(tmallDir, { recursive: true });

    const channelBook = new ExcelJS.Workbook();
    const channelSheet = channelBook.addWorksheet('Sheet1');
    channelSheet.addRow(['店铺编码', '店铺', '渠道类型', '平台']);
    channelSheet.addRow(['D00001', '演示账号A', '抖音直播', '抖音']);
    channelSheet.addRow(['D00002', '演示账号B', '抖音直播', '抖音']);
    channelSheet.addRow(['D00003', '演示账号C', '抖音直播', '抖音']);
    await channelBook.xlsx.writeFile(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'));

    const productBook = new ExcelJS.Workbook();
    const productSheet = productBook.addWorksheet('Sheet1');
    productSheet.addRow(['款号', '吊牌价', '中类', '小类']);
    productSheet.addRow(['SPU-9001', '299', '短袖T恤', 'T恤']);
    productSheet.addRow(['SPU-9002', '399', '短袖T恤', 'T恤']);
    await productBook.xlsx.writeFile(join(domains, '04_商品信息', '商品宽表.xlsx'));

    // 渠道画像：演示账号A 两个月（2026-09／2026-10）+ 2026-10 天猫（同月多平台）
    douyinPortrait(join(douyinDir, '2026-09_演示账号A_抖音.csv'), '演示账号A', '2026-09');
    douyinPortrait(join(douyinDir, '2026-10_演示账号A_抖音.csv'), '演示账号A', '2026-10');
    const tmallBook = new ExcelJS.Workbook();
    const tmallSheet = tmallBook.addWorksheet('明细');
    tmallSheet.addRow(['标签类型', '一级标签(标签值)', '占比']);
    tmallSheet.addRow(['预测性别', '女', '50%']);
    tmallSheet.addRow(['预测性别', '男', '50%']);
    tmallSheet.addRow(['八大消费群体', '新锐白领', '30%']);
    tmallSheet.addRow(['八大消费群体', '都市蓝领', '20%']);
    tmallSheet.addRow(['八大消费群体', '精致妈妈', '20%']);
    tmallSheet.addRow(['八大消费群体', 'Z世代', '18%']);
    tmallSheet.addRow(['八大消费群体', '小镇青年', '12%']);
    tmallSheet.addRow(['预测年龄段', '18-23', '35%']);
    tmallSheet.addRow(['预测年龄段', '24-30', '40%']);
    tmallSheet.addRow(['预测年龄段', '31-40', '15%']);
    tmallSheet.addRow(['预测年龄段', '41-50', '7%']);
    tmallSheet.addRow(['预测年龄段', '50+', '3%']);
    tmallSheet.addRow(['预测消费能力', '高消费', '30%']);
    tmallSheet.addRow(['预测消费能力', '中消费', '45%']);
    tmallSheet.addRow(['预测消费能力', '低消费', '25%']);
    tmallSheet.addRow(['城市等级', '一线', '30%']);
    tmallSheet.addRow(['城市等级', '新一线', '30%']);
    tmallSheet.addRow(['城市等级', '二线', '25%']);
    tmallSheet.addRow(['城市等级', '三线', '15%']);
    tmallSheet.addRow(['预测人生阶段', '单身期', '60%']);
    tmallSheet.addRow(['预测人生阶段', '已婚未育期', '20%']);
    tmallSheet.addRow(['预测人生阶段', '养育期', '20%']);
    await tmallBook.xlsx.writeFile(join(tmallDir, '2026-10_演示账号A画像数据_天猫.xlsx'));

    // 演示账号B：区间画像；演示账号C：年份画像（R-7 全年区间）
    douyinPortrait(join(douyinDir, '2507-2606_演示账号B_抖音.csv'), '演示账号B', '2507-2606');
    writeCsv(join(douyinDir, '2024_演示账号C_抖音.csv'), [
      ['标签类型', '标签', '2024_演示账号C-占比', '2024_演示账号C-tgi'],
      ...SIX_DIMENSION_ROWS,
    ]);

    // 单品画像：SPU-9001 无月份；SPU-9002 两个月
    douyinPortrait(join(douyinDir, '款号SPU-9001_抖音.csv'), 'SPU-9001');
    douyinPortrait(join(douyinDir, '款号SPU-9002_2609_抖音.csv'), 'SPU-9002', '2026-09');
    douyinPortrait(join(douyinDir, '款号SPU-9002_2610_抖音.csv'), 'SPU-9002', '2026-10');

    mkdirSync(join(root, 'tables'), { recursive: true });
    writeCsv(join(root, 'tables', 'product-performance.csv'), [
      ['款号', '月份', '零售额', '零售量', '售罄率', '退货率', '退款率', '毛利率', 'UV', '转化率'],
      ['SPU-9001', '2026-09', '6000', '30', '80%', '5%', '3%', '45%', '5000', '2.5%'],
      ['SPU-9001', '2026-10', '12000', '40', '85%', '4%', '2%', '46%', '6000', '3.0%'],
      ['SPU-9002', '2026-10', '9000', '30', '70%', '', '', '', '', ''],
    ]);
    writeCsv(join(root, 'tables', 'product-channel.csv'), [
      ['款号', '店铺编码', '月份', '零售额', '零售量'],
      ['SPU-9001', 'D00001', '2026-09', '6000', '30'],
      ['SPU-9001', 'D00001', '2026-10', '12000', '40'],
    ]);
    return root;
}

describe('data/ 正式路径 · 期间语义（切片 A）', () => {
  test('索引层 index.months 仍保留字面标签并集（SA-09 不变），selectedMonth 取最新具体月', async () => {
    const root = await buildPeriodDataRoot();
    // 报告层 dataset.months 已改自然月（验收修正二）；索引层字面并集由 SA-09 锁定
    const index = await buildIndex({ dataRoot: root });
    assert.ok(
      index.months.includes('2025-07~2026-06'),
      `索引层应保留区间字面标签：${index.months.join('、')}`,
    );
    assert.ok(index.months.includes('2024-01~2024-12'), '索引层应保留年份字面标签');
    const dataset = await buildDataRootDataset({ dataRoot: root });
    assert.equal(dataset.selectedMonth, '2026-10');
  });

  test('单价走 resolveUnitPrice：该月经营指标优先（SA-08）', async () => {
    const root = await buildPeriodDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2026-10' });
    const product = dataset.products.find((item) => item.spu === 'SPU-9001');
    assert.equal(product?.price, 300, '12000 / 40 = 300');
    assert.equal(product?.priceSource, 'retail-amount-qty');
    assert.equal(product?.retailAmount, 12000);
  });

  test('多平台画像按显式优先级取用并在 notes 写明数量（SA-03）', async () => {
    const root = await buildPeriodDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2026-10' });
    const channel = dataset.channels.find((item) => item.id === 'D00001');
    assert.equal(channel?.portraitPlatform, 'douyin', '优先级抖音＞天猫');
    assert.ok(
      dataset.notes.some((note) => note.includes('多平台') && note.includes('1')),
      `notes 应写明多平台取用数量：${dataset.notes.join(' / ')}`,
    );
  });

  test('年份画像匹配方式标 year（SA-02 分层）', async () => {
    const root = await buildPeriodDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root, month: '2024-06' });
    const channel = dataset.channels.find((item) => item.id === 'D00003');
    assert.ok(channel, '年份画像覆盖 2024-06');
    assert.equal(channel?.portraitMatch, 'year');
  });
});

describe('验收修正一 · --month 入参必须是自然月', () => {
  test('data 路径收到非法 month 直接报错，不生成数据集', async () => {
    const root = await buildDataRoot();
    await assert.rejects(
      () => buildDataRootDataset({ dataRoot: root, month: '2026-13' }),
      /month 必须是 YYYY-MM，收到 2026-13/,
    );
    await assert.rejects(
      () => buildDataRootDataset({ dataRoot: root, month: '2025-07~2026-06' }),
      /month 必须是 YYYY-MM/,
    );
  });
});

describe('第二轮复核 N1 · month 入参严格校验（run5）', () => {
  test('带空白／YYMM 写法一律拒绝，不生成数据集（单价与指标不得静默落空）', async () => {
    const root = await buildDataRoot();
    for (const month of ['2026-10 ', ' 2026-10', '2610']) {
      await assert.rejects(
        () => buildDataRootDataset({ dataRoot: root, month }),
        /month 必须是 YYYY-MM/,
        `month=${month} 应在边界层拒绝（T1/T3 形态）`,
      );
    }
  });

  test('参考数据路径同样拒绝非法写法', () => {
    const root = mkdtempSync(join(tmpdir(), 'uom-ref-invalid-month-'));
    mkdirSync(join(root, '直播', '演示账号A'), { recursive: true });
    douyinPortrait(join(root, '直播', '演示账号A', '演示账号A直播成交2610画像数据.csv'), '演示账号A');
    writeCsv(join(root, '商品数据表.csv'), [
      ['款号', '商品名称', '零售额', '零售量', '件单价'],
      ['SPU-9001', '演示商品一', '12020', '40', '300'],
    ]);
    for (const month of ['2026-10 ', '2610']) {
      assert.throws(
        () => buildReferenceDataset({ root, month }),
        /month 必须是 YYYY-MM/,
        `month=${month} 应在边界层拒绝`,
      );
    }
  });
});

describe('验收修正二 · 可用月份列表恢复为自然月', () => {
  test('indexMonths：单月取本身，区间／年份取结束月，去重升序', async () => {
    const root = await buildPeriodDataRoot();
    const dataset = await buildDataRootDataset({ dataRoot: root });
    assert.deepEqual(
      dataset.months,
      ['2024-12', '2026-06', '2026-09', '2026-10'],
      `报告月份列表应是自然月：${dataset.months.join('、')}`,
    );
    assert.equal(dataset.selectedMonth, '2026-10', '默认月的计算保持现状');
  });
});
