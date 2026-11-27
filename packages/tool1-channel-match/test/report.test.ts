import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, type MatchPortraitInput, type MatchResult } from '@uom/core';
import {
  buildDemoReport,
  buildMismatchList,
  mismatchCsv,
  renderReport,
  type ReportInput,
} from '../src/index.js';

/**
 * 报告渲染与错配清单的单测。
 *
 * 关键守卫：产物自包含且零外网、业务字符串必须转义、
 * 错配排序口径固定、CSV 列顺序固定。
 */

function portrait(shares: Record<string, Record<string, number>>): MatchPortraitInput {
  const dimensions: MatchPortraitInput['dimensions'] = {};
  for (const [dimension, labels] of Object.entries(shares)) {
    dimensions[dimension] = Object.fromEntries(
      Object.entries(labels).map(([label, share]) => [label, { share }]),
    );
  }
  return { dimensions, month: '2026-10' };
}

const BASE: Record<string, Record<string, number>> = {
  gender: { 女: 0.9, 男: 0.1 },
  age: { '18-23': 0.2, '24-30': 0.4, '31-40': 0.25, '41-50': 0.1, '50+': 0.05 },
  strategy_segment: { 新锐白领: 0.3, 精致妈妈: 0.25, Z世代: 0.2, 小镇青年: 0.15, 都市蓝领: 0.1 },
  spending_power: { 低: 0.25, 中: 0.5, 高: 0.25 },
  city_tier: { 一线: 0.3, 新一线: 0.3, 二线: 0.25, 三线: 0.15 },
  life_stage: { 单身期: 0.5, 已婚未育期: 0.25, 养育期: 0.25 },
};

function result(spu: string, channelId: string, price = 199): MatchResult {
  return scoreMatch({
    spu,
    channelId,
    month: '2026-10',
    product: portrait(BASE),
    channel: portrait(BASE),
    price,
  });
}

function reportInput(results: MatchResult[], products?: ReportInput['products']): ReportInput {
  return {
    meta: {
      title: '测试报告',
      source: '合成演示数据',
      isDemo: true,
      month: '2026-10',
      generatedAt: '2026-11-27 00:00',
      configVersion: 'test',
      notes: ['测试说明'],
    },
    products:
      products ??
      results.map((item) => ({
        spu: item.spu,
        name: `商品 ${item.spu}`,
        retailAmount: 100_000,
        price: 199,
      })),
    channels: [...new Set(results.map((item) => item.channelId))].map((id) => ({
      id,
      name: `渠道 ${id}`,
      type: '抖音直播',
    })),
    results,
  };
}

describe('静态报告 · 离线与自包含', () => {
  test('产物不含任何外网引用', () => {
    const html = renderReport(reportInput([result('SPU-1', 'CH-1')]));
    // 内联图标走 data URI，扫描前先摘掉，避免把它当成外部请求
    const withoutIcons = html.replace(/href="data:image\/svg\+xml,[^"]*"/g, 'href="data:icon"');
    for (const pattern of [
      'http',
      '//cdn',
      '@import',
      'url(',
      'fetch(',
      'XMLHttpRequest',
      '<script src=',
      '<link rel="stylesheet"',
      '<iframe',
    ]) {
      assert.ok(!withoutIcons.includes(pattern), `产物不应包含 ${pattern}`);
    }
    assert.ok(html.includes('rel="icon" href="data:image/svg+xml'));
  });

  test('产物包含匹配矩阵、错配清单、抽屉与技术口径说明', () => {
    const html = renderReport(reportInput([result('SPU-1', 'CH-1')]));
    assert.ok(html.includes('商品 × 渠道匹配矩阵'));
    assert.ok(html.includes('错配清单'));
    assert.ok(html.includes('id="drawer"'));
    assert.ok(html.includes('评分口径与维度权重'));
    assert.ok(html.includes('合成演示数据'));
  });

  test('业务字符串被转义，不会注入脚本', () => {
    const input = reportInput([result('SPU-1', 'CH-1')], [
      { spu: 'SPU-1', name: '<script>alert("x")</script>', retailAmount: 1000 },
    ]);
    const html = renderReport(input);
    assert.ok(!html.includes('<script>alert'), '商品名中的脚本标签必须被转义');
    assert.ok(html.includes('&lt;script&gt;alert'));
  });
});

describe('错配清单', () => {
  test('按 零售额 × (1 - 匹配分/100) 降序排列', () => {
    const input: ReportInput = {
      ...reportInput([result('SPU-A', 'CH-1'), result('SPU-B', 'CH-1')]),
      products: [
        { spu: 'SPU-A', name: '高销售低匹配', retailAmount: 1_000_000, price: 199 },
        { spu: 'SPU-B', name: '低销售高匹配', retailAmount: 100_000, price: 199 },
      ],
    };
    const { rows } = buildMismatchList(input);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.spu, 'SPU-A');
    assert.ok(rows[0]!.priority >= (rows[1]!.priority ?? 0));
    for (let index = 1; index < rows.length; index += 1) {
      assert.ok(
        (rows[index - 1]!.priority ?? 0) >= (rows[index]!.priority ?? 0),
        '错配优先级必须降序',
      );
    }
  });

  test('缺零售额的商品不进入排序，并记录原因', () => {
    const input: ReportInput = {
      ...reportInput([result('SPU-A', 'CH-1')]),
      products: [{ spu: 'SPU-A', name: '缺零售额' }],
    };
    const { rows, skipped } = buildMismatchList(input);
    assert.equal(rows.length, 0);
    assert.equal(skipped.length, 1);
    assert.ok(skipped[0]!.reason.includes('零售额'));
  });

  test('CSV 带 BOM 且列顺序固定', () => {
    const input = reportInput([result('SPU-A', 'CH-1')]);
    const { rows } = buildMismatchList(input);
    const csv = mismatchCsv(input, rows);
    assert.ok(csv.startsWith('﻿'));
    const header = csv.replace(/^﻿/, '').split('\r\n')[0]!;
    assert.equal(
      header,
      'rank,spu,product_name,channel_id,channel_name,month,score,grade,fuse,retail_amount,priority,positive_drivers,negative_drivers,price,high_share,low_share,penalty,price_band,flags',
    );
  });
});

describe('合成演示报告', () => {
  test('可渲染且覆盖全部商品与渠道组合', () => {
    const input = buildDemoReport();
    const html = renderReport(input);
    assert.ok(html.includes('合成演示数据'));
    assert.ok(input.results.length > 0);
    for (const product of input.products) {
      assert.ok(html.includes(product.name), `报告应包含商品 ${product.name}`);
    }
    for (const channel of input.channels) {
      assert.ok(html.includes(channel.name), `报告应包含渠道 ${channel.name}`);
    }
  });

  test('演示数据里存在缺价格与区间口径两类标记', () => {
    const input = buildDemoReport();
    assert.ok(
      input.results.some((item) => item.flags.priceMissing),
      '演示应包含缺价格的单元',
    );
    assert.ok(
      input.results.some((item) => item.flags.channelApproximate),
      '演示应包含区间口径的渠道画像',
    );
  });
});
