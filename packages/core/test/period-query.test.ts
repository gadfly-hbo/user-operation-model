import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  listChannels,
  searchByTag,
  similarProducts,
  type DataIndex,
  type NormalizedPortrait,
  type PortraitProjection,
} from '../src/index.js';

/**
 * 切片 A · core 查询层的期间语义（SA-03）。
 *
 * searchByTag／similarProducts 接受 month 后只使用覆盖该月的画像，
 * 命中结果带匹配方式；找不到不回退相邻月份。
 */

/** 构造一份最小画像。 */
function mk(
  entityId: string,
  month: string,
  platform: string,
  maleShare: number,
): NormalizedPortrait {
  const projections: Record<string, PortraitProjection> = {
    gender: {
      dimension: 'gender',
      labels: { 男: { share: maleShare }, 女: { share: 1 - maleShare } },
    },
  };
  return {
    entityType: 'product',
    entityId,
    month,
    platformLabels: { [platform]: {} },
    projections,
  };
}

const INDEX = {
  portraits: [
    mk('SPU-A', '2026-09', 'douyin', 0.4),
    mk('SPU-A', '2026-10', 'douyin', 0.45),
    mk('SPU-B', '2026-10', 'douyin', 0.1),
    mk('SPU-W', '2025-07~2026-12', 'tmall', 0.5),
  ],
  products: [
    { spu: 'SPU-A', name: '商品A' },
    { spu: 'SPU-B', name: '商品B' },
    { spu: 'SPU-W', name: '商品W' },
  ],
  channels: [],
  months: ['2026-09', '2026-10', '2025-07~2026-12'],
  unavailable: {},
  issues: [],
} as unknown as DataIndex;

describe('searchByTag · month 过滤与匹配方式（SA-03）', () => {
  test('只命中覆盖该月的画像，命中带 match', () => {
    const hits = searchByTag(INDEX, {
      dimension: 'gender',
      label: '男',
      month: '2026-10',
    } as Parameters<typeof searchByTag>[1]);
    assert.deepEqual(
      hits.map((hit) => `${hit.entityId}/${hit.month}`).sort(),
      ['SPU-A/2026-10', 'SPU-B/2026-10', 'SPU-W/2025-07~2026-12'],
    );
    for (const hit of hits) {
      assert.ok((hit as { match?: string }).match, '命中结果应带匹配方式');
    }
    const windowHit = hits.find((hit) => hit.entityId === 'SPU-W');
    assert.equal((windowHit as { match?: string } | undefined)?.match, 'window');
  });

  test('不传 month 时行为不变：全部画像命中、无 match 字段', () => {
    const hits = searchByTag(INDEX, { dimension: 'gender', label: '男' });
    assert.equal(hits.length, 4);
    assert.ok(hits.every((hit) => (hit as { match?: string }).match === undefined));
  });
});

describe('similarProducts · month 选取（SA-03）', () => {
  test('带 month 时目标与候选都用覆盖该月的画像', () => {
    const hits = similarProducts(INDEX, {
      spu: 'SPU-A',
      month: '2026-10',
    } as Parameters<typeof similarProducts>[1]);
    const hitB = hits.find((hit) => hit.spu === 'SPU-B');
    assert.ok(hitB, '应命中 SPU-B');
    assert.equal(hitB.hasPortrait, true, '该月画像参与比较时画像分应计入');
    assert.ok(hitB.portraitScore > 0);
  });

  test('目标该月无画像时不回退相邻月份', () => {
    const hits = similarProducts(INDEX, {
      spu: 'SPU-A',
      month: '2026-11',
    } as Parameters<typeof similarProducts>[1]);
    const hitB = hits.find((hit) => hit.spu === 'SPU-B');
    assert.ok(hitB);
    assert.equal(hitB.hasPortrait, false, '缺月不回退，画像分不计入');
  });
});

describe('验收修正一 · list_channels 按覆盖规则判断「该月有画像」', () => {
  /** 渠道画像覆盖形态：单月／区间／年份各一份。 */
  const CHANNEL_INDEX = {
    portraits: [
      { ...mk('演示账号月', '2026-10', 'douyin', 0.4), entityType: 'channel' },
      { ...mk('演示账号区间', '2025-07~2026-06', 'tmall', 0.5), entityType: 'channel' },
      { ...mk('演示账号年', '2024-01~2024-12', 'jd', 0.6), entityType: 'channel' },
    ],
    products: [],
    channels: [
      { channelId: 'D-M', name: '演示账号月', platform: '抖音', channelType: '直播' },
      { channelId: 'D-W', name: '演示账号区间', platform: '天猫', channelType: '店铺' },
      { channelId: 'D-Y', name: '演示账号年', platform: '京东', channelType: '店铺' },
    ],
    months: ['2026-10', '2025-07~2026-06', '2024-01~2024-12'],
    unavailable: {},
    issues: [],
  } as unknown as DataIndex;

  test('区间画像覆盖的月份应列出渠道（不再按字面相等）', () => {
    const ids = listChannels(CHANNEL_INDEX, { month: '2026-01' }).map((c) => c.channelId);
    assert.ok(ids.includes('D-W'), `区间画像覆盖 2026-01 的渠道应列出：${ids.join('、')}`);
  });

  test('年份画像覆盖的月份应列出渠道', () => {
    const ids = listChannels(CHANNEL_INDEX, { month: '2024-06' }).map((c) => c.channelId);
    assert.deepEqual(ids, ['D-Y']);
  });

  test('无画像覆盖的月份 → 列表为空，不回退', () => {
    const ids = listChannels(CHANNEL_INDEX, { month: '2026-07' }).map((c) => c.channelId);
    assert.deepEqual(ids, []);
  });

  test('不带 month 行为不变：全部渠道列出', () => {
    assert.equal(listChannels(CHANNEL_INDEX).length, 3);
  });
});
