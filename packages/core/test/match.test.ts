import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CONFIG,
  scoreMatch,
  type MatchConfig,
  type MatchInput,
  type MatchPortraitInput,
} from '../src/index.js';

/**
 * 匹配内核的单测。
 *
 * 覆盖：六维真实计算、缺维度重归一化、缺价格不插补、价格带判定、
 * 评级与熔断、裁剪、驱动因素、配置单一来源与「无占位分」。
 */

const BASE_PROFILE: Record<string, Record<string, number>> = {
  gender: { 女: 0.98, 男: 0.02 },
  age: { '18-23': 0.12, '24-30': 0.44, '31-40': 0.28, '41-50': 0.11, '50+': 0.05 },
  strategy_segment: {
    新锐白领: 0.18,
    都市蓝领: 0.16,
    精致妈妈: 0.2,
    Z世代: 0.12,
    小镇青年: 0.08,
    资深白领: 0.1,
    银发族: 0.06,
    小镇中年: 0.1,
  },
  spending_power: { 低: 0.2, 中: 0.5, 高: 0.3 },
  city_tier: { 一线: 0.2, 新一线: 0.24, 二线: 0.22, 三线: 0.18, 四线: 0.1, 五线: 0.06 },
  life_stage: { 单身期: 0.42, 已婚未育期: 0.18, 养育期: 0.4 },
};

type Profile = Record<string, Record<string, number>>;

function portrait(overrides: Profile = {}, month = '2026-10'): MatchPortraitInput {
  const dimensions: MatchPortraitInput['dimensions'] = {};
  for (const [dimension, labels] of Object.entries(BASE_PROFILE)) {
    const override = overrides[dimension];
    // 给了覆盖值就整维度替换，保证「完全相反」这类场景是真的不相交
    const merged = override ?? labels;
    dimensions[dimension] = Object.fromEntries(
      Object.entries(merged).map(([label, share]) => [label, { share }]),
    );
  }
  return { dimensions, month };
}

function input(
  product: MatchPortraitInput,
  channel: MatchPortraitInput,
  price?: number,
): MatchInput {
  return {
    spu: 'SPU-TEST',
    channelId: 'CH-TEST',
    month: '2026-10',
    product,
    channel,
    ...(price === undefined ? {} : { price }),
  };
}

function dimensionOf(
  result: ReturnType<typeof scoreMatch>,
  dimension: string,
): { score: number | null; available: boolean; reason?: string } {
  const found = result.dimensions.find((item) => item.dimension === dimension);
  assert.ok(found, `结果中应包含维度 ${dimension}`);
  return {
    score: found.score,
    available: found.available,
    ...(found.reason ? { reason: found.reason } : {}),
  };
}

describe('匹配内核 · 完全一致的画像', () => {
  test('五个分布维度都得 100 分，消费能力按价格带判定，总分为权重加权和', () => {
    const result = scoreMatch(input(portrait(), portrait(), 199));

    for (const dimension of ['gender', 'age', 'strategy_segment', 'city_tier', 'life_stage']) {
      assert.equal(dimensionOf(result, dimension).score, 100, `${dimension} 应为满分`);
    }
    assert.equal(dimensionOf(result, 'spending_power').score, 88);
    assert.equal(result.priceFit?.bandId, '100-199');
    assert.equal(result.priceFit?.penalty, 0);

    // (100×0.10 + 100×0.20 + 88×0.15 + 100×0.10 + 100×0.25 + 100×0.20) = 98.2
    assert.equal(result.totalScore, 98.2);
    assert.equal(result.grade, 'A');
    assert.equal(result.fuse, false);
    assert.equal(result.flags.priceMissing, false);
  });

  test('同输入两次产出完全相同的结果', () => {
    const first = scoreMatch(input(portrait(), portrait(), 199));
    const second = scoreMatch(input(portrait(), portrait(), 199));
    assert.deepEqual(first, second);
  });
});

describe('匹配内核 · 维度差异是真实计算的', () => {
  test('城市等级分布完全不相交时该维度分数明显下降，且总分随之下降', () => {
    const same = scoreMatch(input(portrait(), portrait(), 199));
    const opposed = scoreMatch(
      input(portrait(), portrait({ city_tier: { 六线及以下: 1 } }), 199),
    );

    const sameCity = dimensionOf(same, 'city_tier').score ?? 0;
    const opposedCity = dimensionOf(opposed, 'city_tier').score ?? 0;
    assert.equal(sameCity, 100, '一致时城市等级为满分');
    assert.ok(opposedCity < 40, `不相交时城市等级应显著下降，实际 ${opposedCity}`);
    assert.ok((opposed.totalScore ?? 0) < (same.totalScore ?? 0), '总分应随维度差异下降');
  });

  test('性别分布不相交时性别维度分数下降', () => {
    const result = scoreMatch(input(portrait(), portrait({ gender: { 男: 1 } }), 199));
    const gender = dimensionOf(result, 'gender').score ?? 0;
    assert.ok(gender < 40, `性别维度应显著下降，实际 ${gender}`);
  });
});

describe('匹配内核 · 缺失语义', () => {
  test('渠道缺一个维度时该维度剔除并对剩余维度重归一化', () => {
    const channel = portrait();
    delete channel.dimensions.city_tier;
    const result = scoreMatch(input(portrait(), channel, 199));

    assert.equal(dimensionOf(result, 'city_tier').available, false);
    assert.equal(dimensionOf(result, 'city_tier').reason, 'channel-missing');
    assert.ok(!result.availableDimensions.includes('city_tier'));

    // (10 + 20 + 13.2 + 25 + 20) / 0.90 = 98.0
    assert.equal(result.totalScore, 98);
    assert.equal(result.missingDimensions.length, 1);
  });

  test('商品侧缺画像标记为 product-missing', () => {
    const product = portrait();
    delete product.dimensions.life_stage;
    const result = scoreMatch(input(product, portrait(), 199));
    assert.equal(dimensionOf(result, 'life_stage').reason, 'product-missing');
  });

  test('占比全为 0 的维度视为空分布，不参与评分', () => {
    const channel = portrait({ city_tier: { 一线: 0, 新一线: 0, 二线: 0, 三线: 0, 四线: 0, 五线: 0 } });
    const result = scoreMatch(input(portrait(), channel, 199));
    assert.equal(dimensionOf(result, 'city_tier').reason, 'empty-distribution');
  });

  test('缺价格时不插补兜底价：消费能力维度剔除、无惩罚、并标记缺价', () => {
    const result = scoreMatch(input(portrait(), portrait()));

    const spending = dimensionOf(result, 'spending_power');
    assert.equal(spending.available, false);
    assert.equal(spending.reason, 'price-missing');
    assert.equal(result.flags.priceMissing, true);
    assert.equal(result.priceFit, undefined);
    // 其余五维满分，重归一化后为 100，超出上界被裁剪到 99.5
    assert.equal(result.totalScore, 99.5);
  });

  test('可用维度不足 3 个时不产出总分', () => {
    const channel = portrait();
    delete channel.dimensions.age;
    delete channel.dimensions.city_tier;
    delete channel.dimensions.life_stage;
    delete channel.dimensions.spending_power;
    const result = scoreMatch(input(portrait(), channel, 199));

    assert.equal(result.totalScore, null);
    assert.equal(result.grade, null);
    assert.equal(result.error, 'insufficient-dimensions');
    assert.equal(result.availableDimensions.length, 2);
  });
});

describe('匹配内核 · 客单承接', () => {
  test('高客单且渠道购买力断层时命中断层档并给出全局惩罚', () => {
    const result = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.55, 中: 0.26, 高: 0.19 } }), 626.83),
    );

    assert.equal(dimensionOf(result, 'spending_power').score, 32);
    assert.equal(result.priceFit?.bandId, '500-break');
    assert.equal(result.priceFit?.penalty, -10.5);
    assert.ok(result.priceFit?.diagnosis.includes('断层'));
    assert.equal(result.totalScore, 79.3);
    assert.equal(result.grade, 'B');
  });

  test('中端价位且渠道高消费达标时不扣分', () => {
    const result = scoreMatch(input(portrait(), portrait(), 318.69));
    assert.equal(dimensionOf(result, 'spending_power').score, 92);
    assert.equal(result.priceFit?.bandId, '200-399-matched');
    assert.equal(result.priceFit?.penalty, 0);
    assert.equal(result.totalScore, 98.8);
  });

  test('平价带无条件命中', () => {
    const result = scoreMatch(input(portrait(), portrait(), 99));
    assert.equal(dimensionOf(result, 'spending_power').score, 95);
    assert.equal(result.priceFit?.bandId, 'under-100');
    assert.equal(result.priceFit?.penalty, 0);
  });

  test('中端价位但渠道高消费不足时落兜底档并扣分', () => {
    const result = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.2, 中: 0.7, 高: 0.1 } }), 318.69),
    );
    assert.equal(dimensionOf(result, 'spending_power').score, 70);
    assert.equal(result.priceFit?.bandId, '200-399-fallback');
    assert.equal(result.priceFit?.penalty, -3);
  });

  test('中高客单带：达标与不达标两条分支分别命中', () => {
    const matched = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.2, 中: 0.4, 高: 0.4 } }), 450),
    );
    assert.equal(dimensionOf(matched, 'spending_power').score, 90);
    assert.equal(matched.priceFit?.bandId, '400-499-matched');
    assert.equal(matched.priceFit?.penalty, 0);

    const fallback = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.7, 中: 0.2, 高: 0.1 } }), 450),
    );
    assert.equal(dimensionOf(fallback, 'spending_power').score, 58);
    assert.equal(fallback.priceFit?.bandId, '400-499-fallback');
    assert.equal(fallback.priceFit?.penalty, -6.5);
  });

  test('高客单但未达断层条件时落兜底档', () => {
    const result = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.38, 中: 0.31, 高: 0.31 } }), 626.83),
    );
    assert.equal(dimensionOf(result, 'spending_power').score, 68);
    assert.equal(result.priceFit?.bandId, '500-fallback');
    assert.equal(result.priceFit?.penalty, -4);
  });

  test('高消费占比达标时高客单命中高档位', () => {
    const result = scoreMatch(
      input(portrait(), portrait({ spending_power: { 低: 0.29, 中: 0.31, 高: 0.4 } }), 626.83),
    );
    assert.equal(dimensionOf(result, 'spending_power').score, 93);
    assert.equal(result.priceFit?.bandId, '500-matched');
    assert.equal(result.priceFit?.penalty, 0);
  });
});

describe('匹配内核 · 评级、熔断与裁剪', () => {
  test('评级门槛与熔断阈值可配置，默认配置下同一输入是 B 级且不熔断', () => {
    const breaking = portrait({ spending_power: { 低: 0.55, 中: 0.26, 高: 0.19 } });
    const byDefault = scoreMatch(input(portrait(), breaking, 626.83));
    assert.equal(byDefault.totalScore, 79.3);
    assert.equal(byDefault.grade, 'B');
    assert.equal(byDefault.fuse, false);

    const config: MatchConfig = {
      ...MATCH_CONFIG,
      grades: { a: 95, b: 85 },
      fuseThreshold: 80,
    };
    const tuned = scoreMatch(input(portrait(), breaking, 626.83), config);
    assert.equal(tuned.totalScore, 79.3);
    assert.equal(tuned.grade, 'C');
    assert.equal(tuned.fuse, true);
  });

  test('极低分被裁剪到下限并判为 C 级熔断', () => {
    const result = scoreMatch(
      input(
        portrait({
          gender: { 女: 1 },
          age: { '18-23': 1 },
          strategy_segment: { 新锐白领: 1 },
          spending_power: { 低: 1 },
          city_tier: { 一线: 1 },
          life_stage: { 单身期: 1 },
        }),
        portrait({
          gender: { 男: 1 },
          age: { '50+': 1 },
          strategy_segment: { 都市家庭: 1 },
          spending_power: { 低: 1 },
          city_tier: { 六线及以下: 1 },
          life_stage: { 子女成年期: 1 },
        }),
        626.83,
      ),
    );
    assert.equal(result.totalScore, 25);
    assert.equal(result.grade, 'C');
    assert.equal(result.fuse, true);
  });
});

describe('匹配内核 · 驱动因素', () => {
  test('正负向驱动最多各 3 条，且偏差需达到阈值', () => {
    const result = scoreMatch(input(portrait(), portrait(), 199));
    assert.ok(result.positiveDrivers.length <= 3);
    assert.ok(result.negativeDrivers.length <= 3);
    assert.ok(result.positiveDrivers.every((driver) => driver.delta >= MATCH_CONFIG.driverThreshold));
    assert.ok(result.negativeDrivers.every((driver) => driver.delta <= -MATCH_CONFIG.driverThreshold));
    assert.ok(
      result.negativeDrivers.some((driver) => driver.dimension === 'spending_power'),
      '消费能力维度分偏低，应成为负向驱动',
    );
  });
});

describe('匹配内核 · 参数单一来源', () => {
  test('改配置会改变结果，说明权重来自配置而非散落常量', () => {
    const config: MatchConfig = {
      ...MATCH_CONFIG,
      weights: { ...MATCH_CONFIG.weights, spending_power: 0.6 },
    };
    const defaultResult = scoreMatch(input(portrait(), portrait(), 199));
    const tuned = scoreMatch(input(portrait(), portrait(), 199), config);
    assert.notEqual(defaultResult.totalScore, tuned.totalScore);
  });

  test('非法配置直接抛错，不静默降级', () => {
    const config: MatchConfig = {
      ...MATCH_CONFIG,
      blend: { js: 0.5, cosine: 0.25, top3: 0.15 },
    };
    assert.throws(() => scoreMatch(input(portrait(), portrait(), 199), config), /配置校验失败/);
  });
});

describe('匹配内核 · 时间窗标记', () => {
  test('单品画像无月份、渠道画像为区间时给出对应标记', () => {
    const product = portrait({}, '');
    const channel = portrait({}, '2025-07~2026-06');
    const result = scoreMatch({
      spu: 'SPU-TEST',
      channelId: 'CH-TEST',
      month: '2026-06',
      product,
      channel,
      price: 199,
    });
    assert.equal(result.flags.productMonthUnknown, true);
    assert.equal(result.flags.channelApproximate, true);
  });
});
