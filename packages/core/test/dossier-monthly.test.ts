import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../src/index.js';
import { createP0DataRoot, P0_TABLE_ROWS } from './helpers/fixtures.js';

/**
 * 商品档案的按月结构（切片 A · SA-04）与索引月份并集（SA-09）。
 *
 * - 经营指标／漏斗／渠道成交按月存取，多月份无任何丢弃
 * - 「档案取最新月份」的问题记录不再产生
 * - 源行月份为空归入 `unknown` 键（U3）
 * - 索引构建不再把按月指标写回 `price`（SA-08 的一半）
 * - `index.months` 汇总画像、经营指标、漏斗、商品↔渠道四类来源（SA-09）
 */

describe('商品档案 · 按月结构（SA-04）', () => {
  test('schemaVersion 升为 0.2.0（按月结构契约）', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    for (const product of index.products) {
      assert.equal(product.schemaVersion, '0.2.0');
    }
  });

  test('经营指标按月份键控，多月份全部保留', async () => {
    const root = await createP0DataRoot({
      include: ['tables/product-performance.csv'],
      tables: {
        'tables/product-performance.csv': [
          P0_TABLE_ROWS['tables/product-performance.csv']![0]!,
          ['SPU-001', '2026-01', '12000', '60', '80%', '5%', '3%', '45%', '5000', '2.5%'],
          ['SPU-001', '2026-02', '9000', '45', '85%', '6%', '2%', '44%', '4800', '2.2%'],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.performance);
    assert.deepEqual(Object.keys(product.performance).sort(), ['2026-01', '2026-02'], '两个月都要在');
    assert.equal(product.performance['2026-01']!.uv, 5000);
    assert.equal(product.performance['2026-02']!.uv, 4800);
    assert.equal(product.performance['2026-01']!.retailAmount, 12000);
    assert.equal(product.performance['2026-02']!.retailQty, 45);
  });

  test('不再产生「档案取最新月份」问题记录（SA-04）', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    assert.ok(
      !index.issues.some((issue) => issue.message.includes('档案取最新月份')),
      '塌缩记录必须移除',
    );
  });

  test('源行月份为空时归入 unknown 键（U3）', async () => {
    const root = await createP0DataRoot({
      include: ['tables/product-performance.csv'],
      tables: {
        'tables/product-performance.csv': [
          P0_TABLE_ROWS['tables/product-performance.csv']![0]!,
          ['SPU-001', '', '7000', '35', '90%', '', '', '', '', ''],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.performance?.unknown, '空月份必须归入 unknown 键');
    assert.equal(product.performance.unknown!.retailAmount, 7000);
  });

  test('漏斗按「月份 × 阶段」存放，同阶段不重复', async () => {
    const root = await createP0DataRoot({ include: ['tables/funnel.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.funnel);
    assert.deepEqual(Object.keys(product.funnel).sort(), ['2026-01', '2026-02']);
    assert.equal(product.funnel['2026-01']!.launch?.['浏览'], 1000);
    assert.equal(product.funnel['2026-02']!.growth?.['购买'], 55);
    // 同一月份同阶段只有一份
    assert.equal(Object.keys(product.funnel['2026-01']!).filter((p) => p === 'launch').length, 1);
  });

  test('渠道成交按「渠道 → 月份」键控，多月份保留', async () => {
    const root = await createP0DataRoot({
      include: ['tables/product-channel.csv'],
      tables: {
        'tables/product-channel.csv': [
          P0_TABLE_ROWS['tables/product-channel.csv']![0]!,
          ['SPU-001', 'D00001', '2026-01', '12000', '60'],
          ['SPU-001', 'D00001', '2026-02', '8000', '40'],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.channelPerformance?.D00001);
    assert.deepEqual(Object.keys(product.channelPerformance.D00001).sort(), ['2026-01', '2026-02']);
    assert.equal(product.channelPerformance.D00001!['2026-01']!.retailAmount, 12000);
    assert.equal(product.channelPerformance.D00001!['2026-02']!.retailQty, 40);
  });

  test('渠道成交源行月份为空归入 unknown 键', async () => {
    const root = await createP0DataRoot({
      include: ['tables/product-channel.csv'],
      tables: {
        'tables/product-channel.csv': [
          P0_TABLE_ROWS['tables/product-channel.csv']![0]!,
          ['SPU-001', 'D00001', '', '5000', '25'],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.channelPerformance?.D00001?.unknown);
    assert.equal(product.channelPerformance.D00001!.unknown!.retailAmount, 5000);
  });

  test('索引构建不再把按月指标写回 price（SA-08）', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.equal(product?.price?.retailAmount, undefined, '按月零售额不得写回主数据 price');
    assert.equal(product?.price?.retailQty, undefined, '按月零售量不得写回主数据 price');
    assert.equal(
      product?.price?.actualUnitPrice,
      undefined,
      '按月指标推出的单价不得写回主数据 price；单价解析统一走 resolveUnitPrice',
    );
    // 月度指标本身保留（单价解析的输入）
    assert.equal(product?.performance?.['2026-01']?.retailAmount, 12000);
    assert.equal(product?.performance?.['2026-01']?.retailQty, 60);
  });

  test('商品主表自身的价格字段保持不变', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.equal(product?.price?.tagPrice, 199, '商品宽表的吊牌价不动');
  });
});

describe('索引月份并集（SA-09）', () => {
  test('index.months 汇总画像、经营指标、漏斗、商品↔渠道四类来源', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    // 画像月份：2024-07~2025-06 / 2025-07~2026-06（区间按字面保留）
    // 表来源：product-performance 2026-01/2026-02、funnel 2026-01/2026-02、product-channel 2026-01
    assert.ok(index.months.includes('2025-07~2026-06'), '画像区间按字面保留');
    assert.ok(index.months.includes('2026-01'), '经营指标月份入并集');
    assert.ok(index.months.includes('2026-02'), '漏斗月份入并集');
    assert.ok(!index.months.some((month) => month === ''), '空月份不得入并集');
    const sorted = [...index.months].sort();
    assert.deepEqual(index.months, sorted, '月份升序');
  });

  test('无新表时 months 与画像来源一致（现状不变）', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    assert.deepEqual([...index.months].sort(), ['2025-07~2026-06']);
  });
});
