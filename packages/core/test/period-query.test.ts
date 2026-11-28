import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
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
