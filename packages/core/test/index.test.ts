import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  aggregatePortrait,
  attributeJaccard,
  availableMonths,
  buildIndex,
  channelEntityIds,
  cosineSimilarity,
  findPortraitByEntityIds,
  findProduct,
  jensenShannonDistance,
  listChannels,
  searchByTag,
  similarProducts,
  topOverlap,
} from '../src/index.js';
import { createFixtureIndexRoot } from './helpers/fixtures.js';

/**
 * `packages/core/src/index/**` 的直接单测。
 *
 * 覆盖复核中发现的测试缺口：聚合 TGI 公式、list_channels 的月份过滤、
 * search_by_tag 的 scope、属性 Jaccard 分母、跨平台确定性选择。
 */

describe('分布相似度的边界', () => {
  test('完全相同的分布距离为 0、余弦为 1', () => {
    const p = { a: 0.5, b: 0.5 };
    assert.equal(jensenShannonDistance(p, p), 0);
    assert.ok(Math.abs(cosineSimilarity(p, p) - 1) < 1e-12);
  });

  test('完全不重叠的分布距离为 1、余弦为 0', () => {
    const p = { a: 1 };
    const q = { b: 1 };
    assert.ok(Math.abs(jensenShannonDistance(p, q) - 1) < 1e-12);
    assert.equal(cosineSimilarity(p, q), 0);
  });

  test('空分布不产生 NaN', () => {
    const empty = {};
    const p = { a: 1 };
    // 单边为空时 JS 散度为 0.5，距离为 √0.5
    assert.ok(Math.abs(jensenShannonDistance(empty, p) - Math.sqrt(0.5)) < 1e-12);
    assert.equal(jensenShannonDistance(empty, empty), 0);
    assert.equal(cosineSimilarity(empty, p), 0);
    assert.equal(cosineSimilarity(empty, empty), 0);
  });

  test('Top3 重合度：完全重合为 1，无交集为 0', () => {
    assert.equal(topOverlap(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
    assert.equal(topOverlap(['a', 'b'], ['x', 'y']), 0);
  });
});

describe('索引构建', () => {
  test('数据根不存在时抛错，不返回空索引', async () => {
    await assert.rejects(
      () => buildIndex({ dataRoot: join('/tmp', 'definitely-not-a-real-root-xyz') }),
      /数据根目录不存在/,
    );
  });

  test('数据根下没有可扫描子目录时抛错', async () => {
    const empty = await createFixtureIndexRoot();
    await assert.rejects(
      () => buildIndex({ dataRoot: empty, scanDirs: ['不存在'] }),
      /没有可扫描的子目录/,
    );
  });

  test('未识别的数据文件被记为问题而不是静默跳过', async () => {
    const root = await createFixtureIndexRoot();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(root, 'domains', '04_商品信息', '未知文件.xlsx'), 'x');
    const index = await buildIndex({ dataRoot: root });
    assert.ok(
      index.issues.some((issue) => issue.message.includes('未识别的数据文件')),
      '未识别文件应被记录',
    );
  });

  test('商品表之间同款号重复时记冲突，不静默合并', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    // 断言具体的冲突条目，而不是「有问题就行」
    const conflict = index.issues.find(
      (issue) => issue.kind === 'conflict' && issue.sourceLabel === 'SPU-001',
    );
    assert.ok(conflict, `应记录 SPU-001 的跨表冲突，实际问题：${JSON.stringify(index.issues)}`);
    assert.ok(conflict.message.includes('未做隐式合并'));
    // 重复款号只保留一条
    assert.equal(index.products.filter((p) => p.spu === 'SPU-001').length, 1);
    // 非重复款号都保留
    assert.ok(index.products.some((p) => p.spu === 'SPU-005'));
  });
});

describe('渠道查询', () => {
  test('list_channels 按月份过滤只保留有该月画像的渠道', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const all = listChannels(index);
    const filtered = listChannels(index, { month: '2025-07~2026-06' });
    assert.ok(all.length >= filtered.length);
    assert.equal(filtered.length, 1, '只有演示账号1 有该月画像');
    assert.equal(filtered[0]?.channelId, 'D00001');
  });

  test('list_channels 按类型过滤', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    assert.equal(listChannels(index, { type: '天猫' }).length, 1);
    assert.equal(listChannels(index, { type: '抖音' }).length, 1);
  });

  test('渠道实体标识同时包含店铺编码与店铺名', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const ids = channelEntityIds(index, 'D00001');
    assert.ok(ids.includes('D00001'));
    assert.ok(ids.includes('演示账号1'));
  });

  test('同月多平台命中时按平台名确定性选择', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const candidates = channelEntityIds(index, 'D00001');
    const matched = index.portraits.filter(
      (portrait) =>
        portrait.entityType === 'channel' &&
        candidates.includes(portrait.entityId) &&
        portrait.month === '2025-07~2026-06',
    );
    assert.ok(matched.length >= 2, 'fixture 应包含同月多平台的两份画像');

    const portrait = findPortraitByEntityIds(index, {
      entityType: 'channel',
      entityIds: candidates,
      month: '2025-07~2026-06',
    });
    assert.ok(portrait);
    // 抖音 < 天猫（字母序），两次调用结果必须一致
    assert.deepEqual(Object.keys(portrait.platformLabels), ['douyin']);
    const again = findPortraitByEntityIds(index, {
      entityType: 'channel',
      entityIds: candidates,
      month: '2025-07~2026-06',
    });
    assert.deepEqual(Object.keys(again!.platformLabels), ['douyin']);
  });

  test('availableMonths 对同月多平台去重', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const months = availableMonths(index, 'channel', ['D00001', '演示账号1']);
    assert.deepEqual(months, ['2025-07~2026-06']);
  });

  test('画像能通过店铺名关联到渠道', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    // 同月多平台时必须明确月份，否则无法唯一确定
    const portrait = findPortraitByEntityIds(index, {
      entityType: 'channel',
      entityIds: channelEntityIds(index, 'D00001'),
      month: '2025-07~2026-06',
    });
    assert.ok(portrait);
    assert.equal(portrait.entityId, '演示账号1');
  });
});

describe('标签反查', () => {
  test('scope 过滤生效', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const all = searchByTag(index, { dimension: 'strategy_segment', label: '银发族' });
    const products = searchByTag(index, {
      dimension: 'strategy_segment',
      label: '银发族',
      scope: 'product',
    });
    const channels = searchByTag(index, {
      dimension: 'strategy_segment',
      label: '银发族',
      scope: 'channel',
    });
    assert.ok(all.length >= 2);
    assert.ok(products.every((hit) => hit.entityType === 'product'));
    assert.ok(channels.every((hit) => hit.entityType === 'channel'));
    assert.equal(products.length + channels.length, all.length);
  });

  test('命中项带平台标识', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const hits = searchByTag(index, { dimension: 'gender', label: '男' });
    assert.ok(hits.length > 0);
    assert.ok(hits.every((hit) => hit.platform.length > 0));
  });

  test('未映射的原生标签不被反查到', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const hits = searchByTag(index, { dimension: 'user_constellation', label: '天秤座' });
    assert.equal(hits.length, 0);
  });
});

describe('相似款', () => {
  test('无画像商品的画像分不计入总分', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const hits = similarProducts(index, { spu: 'SPU-001' });
    const withoutPortrait = hits.filter((hit) => !hit.hasPortrait);
    assert.ok(withoutPortrait.length > 0, 'fixture 应包含无画像的候选商品');

    // 断言不放在条件分支内：每个无画像候选的得分都必须等于属性分，
    // 若实现错误地把缺失画像分按 0 计入，得分会小于属性分
    for (const hit of withoutPortrait) {
      assert.equal(
        hit.score,
        hit.attributeScore,
        '无画像时总分必须等于属性分（画像分不按 0 计入）',
      );
    }

    // 取一个属性确实相似的无画像候选（SPU-004 与 SPU-001 同品类同小类），
    // 断言其属性分大于 0 —— 否则上面的相等断言在两种实现下都成立，等于空转
    const similar = withoutPortrait.find((hit) => hit.spu === 'SPU-004');
    assert.ok(similar, 'fixture 应包含与目标同品类的无画像候选 SPU-004');
    assert.ok(
      similar.attributeScore > 0,
      `SPU-004 的属性分应大于 0，实际 ${similar.attributeScore}`,
    );
  });

  test('属性完全相同的商品属性相似度为 1', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const hits = similarProducts(index, { spu: 'SPU-001' });
    const same = hits.find((hit) => hit.spu === 'SPU-002');
    assert.ok(same);
    assert.ok(Math.abs(same.attributeScore - 1) < 1e-9, '同品类同小类的属性分应为 1');
  });

  test('属性部分重叠时相似度落在正确区间', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const a = findProduct(index, 'SPU-001')!;
    const b = findProduct(index, 'SPU-006')!;
    // SPU-001：l2={短袖T恤} l3={T恤}
    // SPU-006：l2={短袖T恤} l3={长袖T恤}
    // l2 完全相同（1.0），l3 无交集（0.0），平均 0.5
    //
    // 注：当前商品属性字段均为**单值**，此时「并集分母」与「共享 key 数」两种
    // 口径在数学上等价（都得到 0.5）。实现采用并集分母（口径更正确，
    // 多值数据下才有区别），因此这里只断言结果值，不断言口径。
    assert.ok(
      Math.abs(attributeJaccard(a, b) - 0.5) < 1e-9,
      `属性相似度应为 0.5，实际 ${attributeJaccard(a, b)}`,
    );
  });

  test('不包含自身', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const hits = similarProducts(index, { spu: 'SPU-001' });
    assert.ok(!hits.some((hit) => hit.spu === 'SPU-001'));
  });
});

describe('聚合画像', () => {
  test('TGI 按占比加权平均，不是简单平均也不是首值', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const portrait = aggregatePortrait(index, { level: 'category', key: '短袖T恤' });
    assert.ok(portrait);
    const gender = portrait.projections.gender;
    assert.ok(gender);
    const male = gender.labels['男'];
    assert.ok(male);
    assert.ok(male.tgi !== undefined, '聚合后应保留 TGI');
    // 两个成员：SPU-001 占比 0.45、TGI 95；SPU-002 占比 0.20、TGI 195
    // 加权平均 = (95×0.45 + 195×0.20) / (0.45 + 0.20)
    const expected = (95 * 0.45 + 195 * 0.2) / (0.45 + 0.2);
    assert.ok(
      Math.abs((male.tgi ?? 0) - expected) < 1e-9,
      `TGI 应为加权平均 ${expected}，实际 ${male.tgi}`,
    );
    assert.ok(Math.abs((male.tgi ?? 0) - 95) > 1e-6, '不应等于首值');
  });

  test('占比按成员数平均', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    const portrait = aggregatePortrait(index, { level: 'category', key: '短袖T恤' });
    assert.ok(portrait);
    const gender = portrait.projections.gender;
    const male = gender?.labels['男'];
    assert.ok(male);
    assert.ok(male.share > 0 && male.share <= 1, '占比应为 0-1 之间的值');
  });

  test('未接入的层级返回 undefined', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    assert.equal(aggregatePortrait(index, { level: 'series', key: 'X' }), undefined);
  });
});
