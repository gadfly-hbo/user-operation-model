import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CONFIG,
  diffPortraits,
  scoreMatch,
  type MatchPortraitInput,
  type Portrait,
  type PortraitProjection,
} from '../src/index.js';

/**
 * 相似度的公共标签口径（切片 A · SA-06）。
 *
 * JS、余弦、Top3 重合度都在**公共标签的重归一化分布**上计算；
 * 证据与差异里列出被排除的单侧标签；无公共标签 → 维度不可用
 * （MissingReason `no-common-labels`），不参与加权。
 */

function labels(spec: Record<string, number>): PortraitProjection['labels'] {
  return Object.fromEntries(Object.entries(spec).map(([key, share]) => [key, { share }]));
}

function projection(dimension: string, spec: Record<string, number>): PortraitProjection {
  return { dimension, labels: labels(spec) };
}

function portrait(projections: Record<string, Record<string, number>>): Portrait {
  return {
    entityType: 'product',
    entityId: 'P',
    month: '2026-10',
    platformLabels: {},
    projections: Object.fromEntries(
      Object.entries(projections).map(([dimension, spec]) => [dimension, projection(dimension, spec)]),
    ),
  };
}

function matchInput(spec: Record<string, Record<string, number>>, month = '2026-10'): MatchPortraitInput {
  return {
    dimensions: Object.fromEntries(
      Object.entries(spec).map(([dimension, specLabels]) => [dimension, labels(specLabels)]),
    ),
    month,
  };
}

describe('内核 · 公共标签重归一化（SA-06）', () => {
  test('单侧标签被排除后剩余分布重归一化：{男.6,女.4} vs {男.6,未知.4} 性别维度满分', () => {
    const result = scoreMatch({
      spu: 'SPU',
      channelId: 'CH',
      month: '2026-10',
      product: matchInput({ gender: { 男: 0.6, 女: 0.4 } }),
      channel: matchInput({ gender: { 男: 0.6, 未知: 0.4 } }),
      price: 199,
    });
    const gender = result.dimensions.find((item) => item.dimension === 'gender');
    assert.ok(gender?.available, '有公共标签「男」时维度可用');
    assert.equal(gender?.score, 100, '公共标签上双方分布一致 → 满分');
    assert.equal(gender?.evidence?.excludedProductLabels?.[0], '女');
    assert.equal(gender?.evidence?.excludedChannelLabels?.[0], '未知');
    // Top3 在公共标签上：只剩「男」，重合度 1
    assert.deepEqual(
      gender?.evidence?.productTop3.map((item) => item.label),
      ['男'],
    );
    assert.ok(Math.abs((gender?.evidence?.productTop3[0]?.share ?? 0) - 1) < 1e-9, '重归一化后占比为 1');
  });

  test('两侧没有公共标签 → 维度不可用（no-common-labels），不参与加权', () => {
    const result = scoreMatch({
      spu: 'SPU',
      channelId: 'CH',
      month: '2026-10',
      product: matchInput({
        gender: { 男: 1 },
        age: { '18-23': 1 },
        city_tier: { 一线: 1 },
        strategy_segment: { 新锐白领: 1 },
        life_stage: { 单身期: 1 },
      }),
      channel: matchInput({
        gender: { 未知: 1 },
        age: { '24-30': 1 },
        city_tier: { 三线: 1 },
        strategy_segment: { 银发族: 1 },
        life_stage: { 养育期: 1 },
        spending_power: { 低: 0.2, 中: 0.5, 高: 0.3 },
      }),
      price: 199,
    });
    const gender = result.dimensions.find((item) => item.dimension === 'gender');
    assert.equal(gender?.available, false, '无公共标签 → 维度不可用');
    assert.equal(gender?.reason, 'no-common-labels');
    assert.ok(!result.availableDimensions.includes('gender'));
    assert.ok(
      result.missingDimensions.some(
        (item) => item.dimension === 'gender' && item.reason === 'no-common-labels',
      ),
    );
  });

  test('公共标签与非公共标签混合时，分数只由公共部分决定', () => {
    const commonOnly = scoreMatch({
      spu: 'SPU',
      channelId: 'CH',
      month: '2026-10',
      product: matchInput({ gender: { 男: 0.5, 女: 0.5 } }),
      channel: matchInput({ gender: { 男: 0.5, 女: 0.5 } }),
      price: 199,
    });
    const withNoise = scoreMatch({
      spu: 'SPU',
      channelId: 'CH',
      month: '2026-10',
      product: matchInput({ gender: { 男: 0.4, 女: 0.4, 仅商品侧: 0.2 } }),
      channel: matchInput({ gender: { 男: 0.4, 女: 0.4, 仅渠道侧: 0.2 } }),
      price: 199,
    });
    const a = commonOnly.dimensions.find((item) => item.dimension === 'gender')?.score;
    const b = withNoise.dimensions.find((item) => item.dimension === 'gender')?.score;
    assert.ok(a !== null && b !== null);
    assert.ok(Math.abs(a! - b!) < 1e-9, '单侧噪声标签不得影响公共标签上的维度分');
    assert.equal(withNoise.dimensions.find((item) => item.dimension === 'gender')?.evidence?.excludedProductLabels?.[0], '仅商品侧');
    assert.equal(withNoise.dimensions.find((item) => item.dimension === 'gender')?.evidence?.excludedChannelLabels?.[0], '仅渠道侧');
  });

  test('内核配置版本递增为 sa-2026-11-common-labels-uncalibrated（U4）', () => {
    assert.equal(MATCH_CONFIG.version, 'sa-2026-11-common-labels-uncalibrated');
  });
});

describe('compare 差异 · 公共标签口径（SA-06）', () => {
  test('DimensionDiff 列出被排除的单侧标签', () => {
    const diff = diffPortraits(
      portrait({ gender: { 男: 0.6, 女: 0.4 } }),
      portrait({ gender: { 男: 0.6, 未知: 0.4 } }),
    );
    const gender = diff.dimensions[0]!;
    assert.equal(gender.dimension, 'gender');
    assert.deepEqual(gender.excludedProductLabels, ['女']);
    assert.deepEqual(gender.excludedChannelLabels, ['未知']);
    assert.equal(gender.reason, undefined, '有公共标签时维度可用');
    assert.ok(Math.abs(gender.distance) < 1e-9, '公共标签上一致 → 距离 0');
    assert.equal(diff.comparedDimensions, 1);
  });

  test('无公共标签的维度标记 no-common-labels 且不参与 comparedDimensions', () => {
    const diff = diffPortraits(
      portrait({ gender: { 男: 1 } }),
      portrait({ gender: { 女: 1 } }),
    );
    const gender = diff.dimensions[0]!;
    assert.equal(gender.reason, 'no-common-labels');
    assert.deepEqual(gender.excludedProductLabels, ['男']);
    assert.deepEqual(gender.excludedChannelLabels, ['女']);
    assert.deepEqual(gender.productTop3, []);
    assert.deepEqual(gender.channelTop3, []);
    assert.equal(diff.comparedDimensions, 0, '不可用维度不计入比较维度数');
  });

  test('两侧标签集合完全相同时，距离与占比与旧口径一致（黄金锚定前提）', () => {
    const same = { 男: 0.3926, 女: 0.6074 };
    const diff = diffPortraits(portrait({ gender: same }), portrait({ gender: same }));
    const gender = diff.dimensions[0]!;
    assert.equal(gender.reason, undefined);
    // 空列表省略不落字段（SA-12 等价比对的序列化前提）
    assert.equal(gender.excludedProductLabels, undefined);
    assert.equal(gender.excludedChannelLabels, undefined);
    assert.ok(Math.abs(gender.distance) < 1e-9);
    assert.equal(gender.overlapTop3, 1);
    assert.ok(Math.abs(gender.cosine - 1) < 1e-9);
    assert.ok(Math.abs((gender.productTop3[0]?.share ?? 0) - 0.6074) < 1e-9, '重归一化后占比与原值一致（和为 1）');
  });
});
