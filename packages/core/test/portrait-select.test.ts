import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_PREFERENCE,
  selectPortrait,
  type NormalizedPortrait,
  type PortraitProjection,
} from '../src/index.js';

/**
 * 画像选择（切片 A · SA-02）。
 *
 * core 一处实现，MCP 与工具1 共用。歧义显式返回（month／platform 两种），
 * **任何情况不回退到相邻月份**；多份同平台（重复文件）取索引顺序首份。
 */

/** 构造一份最小画像。 */
function mk(
  entityType: string,
  entityId: string,
  month: string,
  platform: string,
): NormalizedPortrait {
  const projections: Record<string, PortraitProjection> = {
    gender: { dimension: 'gender', labels: { 男: { share: 0.5 }, 女: { share: 0.5 } } },
  };
  return {
    entityType,
    entityId,
    month,
    platformLabels: { [platform]: {} },
    projections,
  };
}

const SOURCE = {
  portraits: [
    mk('product', 'SPU-A', '2026-09', 'douyin'),
    mk('product', 'SPU-A', '2026-10', 'douyin'),
    mk('product', 'SPU-B', '2025-07~2026-06', 'tmall'),
    mk('product', 'SPU-C', '', 'douyin'),
    mk('product', 'SPU-D', '2026-10', 'douyin'),
    mk('product', 'SPU-D', '2026-10', 'tmall'),
    mk('product', 'SPU-E', '2025-01~2026-06', 'douyin'),
    mk('product', 'SPU-E', '2025-07~2026-06', 'tmall'),
    // SPU-F：同月同平台重复文件
    mk('product', 'SPU-F', '2026-10', 'jd'),
    mk('product', 'SPU-F', '2026-10', 'jd'),
    // SPU-SINGLE：只有一份画像
    mk('product', 'SPU-SINGLE', '2026-10', 'douyin'),
  ],
};

describe('selectPortrait · 不带 month', () => {
  test('恰一份 → found，match 反映画像自身的期间形态', () => {
    const result = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-SINGLE'] });
    assert.equal(result.status, 'found');
    if (result.status === 'found') {
      assert.equal(result.portrait.month, '2026-10');
      assert.equal(result.match, 'exact');
    }
  });

  test('多份（跨月）→ ambiguous(month)，列出可用月份与平台', () => {
    const result = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-A'] });
    assert.equal(result.status, 'ambiguous');
    if (result.status === 'ambiguous') {
      assert.equal(result.reason, 'month');
      assert.deepEqual(result.months, ['2026-09', '2026-10']);
      assert.deepEqual(result.platforms, ['douyin']);
    }
  });

  test('多份（同月多平台）→ ambiguous(month)，months 单值、platforms 列全', () => {
    const result = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-D'] });
    assert.equal(result.status, 'ambiguous');
    if (result.status === 'ambiguous') {
      assert.equal(result.reason, 'month');
      assert.deepEqual(result.months, ['2026-10']);
      assert.deepEqual(result.platforms, ['douyin', 'tmall']);
    }
  });

  test('零候选 → not-found', () => {
    const result = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-NONE'] });
    assert.equal(result.status, 'not-found');
  });

  test('区间与无月份画像的 match 形态', () => {
    const windowed = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-B'] });
    assert.ok(windowed.status === 'found' && windowed.match === 'window');
    const unknown = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-C'] });
    assert.ok(unknown.status === 'found' && unknown.match === 'unknown');
  });
});

describe('selectPortrait · 带 month（分层取最优：exact＞window＞year＞unknown）', () => {
  test('恰有一份精确月 → found(exact)', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-A'],
      month: '2026-10',
    });
    assert.ok(result.status === 'found');
    assert.equal(result.status === 'found' ? result.match : '', 'exact');
  });

  test('精确月优先于区间（同实体同月有 window 也有 exact）', () => {
    const source = {
      portraits: [
        mk('product', 'SPU-X', '2025-01~2026-06', 'douyin'),
        mk('product', 'SPU-X', '2026-03', 'douyin'),
      ],
    };
    const result = selectPortrait(source, {
      entityType: 'product',
      entityIds: ['SPU-X'],
      month: '2026-03',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') {
      assert.equal(result.match, 'exact');
      assert.equal(result.portrait.month, '2026-03');
    }
  });

  test('只有区间覆盖时 → found(window)', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-B'],
      month: '2025-12',
    });
    assert.ok(result.status === 'found' && result.match === 'window');
  });

  test('只有年份覆盖时 → found(year)', () => {
    const source = { portraits: [mk('product', 'SPU-Y', '2024', 'douyin')] };
    const result = selectPortrait(source, {
      entityType: 'product',
      entityIds: ['SPU-Y'],
      month: '2024-06',
    });
    assert.ok(result.status === 'found' && result.match === 'year');
  });

  test('分层顺序：window 覆盖优先于 year 与 unknown', () => {
    const source = {
      portraits: [
        mk('product', 'SPU-Z', '', 'douyin'),
        mk('product', 'SPU-Z', '2024', 'douyin'),
        mk('product', 'SPU-Z', '2025-01~2026-06', 'douyin'),
      ],
    };
    const result = selectPortrait(source, {
      entityType: 'product',
      entityIds: ['SPU-Z'],
      month: '2025-12',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') {
      assert.equal(result.match, 'window');
      assert.equal(result.portrait.month, '2025-01~2026-06');
    }
  });

  test('无精确／区间／年份覆盖时，无月份画像按静态事实兜底 → found(unknown)', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-C'],
      month: '2026-10',
    });
    assert.ok(result.status === 'found' && result.match === 'unknown');
  });

  test('任何情况不回退到相邻月份：只有 2026-09 时查 2026-10 → not-found', () => {
    const source = { portraits: [SOURCE.portraits[0]!] };
    const result = selectPortrait(source, {
      entityType: 'product',
      entityIds: ['SPU-A'],
      month: '2026-10',
    });
    assert.equal(result.status, 'not-found', '相邻月份不得回退');
  });
});

describe('selectPortrait · 同月多平台歧义', () => {
  test('带 month、多平台、未给 platform → ambiguous(platform) 列出平台', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-D'],
      month: '2026-10',
    });
    assert.equal(result.status, 'ambiguous');
    if (result.status === 'ambiguous') {
      assert.equal(result.reason, 'platform');
      assert.deepEqual(result.months, ['2026-10']);
      assert.deepEqual(result.platforms, ['douyin', 'tmall']);
    }
  });

  test('带 month + platform → 取该平台的画像（中文写法归一）', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-D'],
      month: '2026-10',
      platform: '天猫',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') {
      assert.deepEqual(Object.keys(result.portrait.platformLabels), ['tmall']);
    }
  });

  test('带 month + platform 但该平台无候选 → not-found', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-D'],
      month: '2026-10',
      platform: '京东',
    });
    assert.equal(result.status, 'not-found');
  });

  test('同月同平台重复文件 → 取索引顺序首份，不歧义', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-F'],
      month: '2026-10',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') {
      assert.equal(result.portrait, SOURCE.portraits[8], '必须是索引顺序的第一份');
    }
  });

  test('区间层多平台 → ambiguous(platform)，months 列出各区间的字面标签', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-E'],
      month: '2025-12',
    });
    assert.equal(result.status, 'ambiguous');
    if (result.status === 'ambiguous') {
      assert.equal(result.reason, 'platform');
      assert.deepEqual(result.months, ['2025-01~2026-06', '2025-07~2026-06']);
      assert.deepEqual(result.platforms, ['douyin', 'tmall']);
    }
  });

  test('不带 month + platform：先按平台过滤再判定份数', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-D'],
      platform: 'douyin',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') {
      assert.deepEqual(Object.keys(result.portrait.platformLabels), ['douyin']);
    }
  });
});

describe('selectPortrait · 实体类型隔离与平台优先级', () => {
  test('entityType 不匹配的画像不参与选择', () => {
    const source = { portraits: [mk('channel', 'SPU-A', '2026-10', 'douyin')] };
    const result = selectPortrait(source, { entityType: 'product', entityIds: ['SPU-A'] });
    assert.equal(result.status, 'not-found');
  });

  test('平台优先级：抖音＞天猫＞京东（U1 消歧的显式顺序）', () => {
    assert.deepEqual([...PLATFORM_PREFERENCE], ['douyin', 'tmall', 'jd']);
  });
});

describe('复核修正 · platform 空串与 month 首尾空白（run4）', () => {
  test("platform: '' 等同未指定：同层多平台照常 ambiguous(platform)", () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-D'],
      month: '2026-10',
      platform: '',
    });
    assert.equal(result.status, 'ambiguous', '空串不得绕过平台歧义');
    if (result.status === 'ambiguous') {
      assert.equal(result.reason, 'platform');
      assert.deepEqual(result.platforms, ['douyin', 'tmall']);
    }
  });

  test("platform: '' 不带 month：多份照常 ambiguous(month)", () => {
    const result = selectPortrait(SOURCE, { entityType: 'product', entityIds: ['SPU-A'], platform: '' });
    assert.equal(result.status, 'ambiguous');
    if (result.status === 'ambiguous') assert.equal(result.reason, 'month');
  });

  test("带首尾空白的 month 等价于规范写法（'2026-10 ' → found）", () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-SINGLE'],
      month: '2026-10 ',
    });
    assert.equal(result.status, 'found', '校验通过后应按规范月标签查找');
  });

  test("前导空白的 month 同样命中（' 2026-09' → found(exact)）", () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-A'],
      month: ' 2026-09',
    });
    assert.ok(result.status === 'found');
    if (result.status === 'found') assert.equal(result.match, 'exact');
  });

  test('带空白的非法写法仍拒绝（2026-13 带空格 → invalid-month）', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-SINGLE'],
      month: ' 2026-13 ',
    });
    assert.deepEqual(result, { status: 'invalid-month', month: ' 2026-13 ' });
  });
});

describe('验收修正一 · month 入参必须是自然月', () => {
  test('区间标签当 month → invalid-month，不按重叠匹配放行', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-E'],
      month: '2024-07~2025-06',
    });
    assert.deepEqual(result, { status: 'invalid-month', month: '2024-07~2025-06' });
  });

  test('月份超出 01–12（2026-13）→ invalid-month，不静默返回 not-found', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-SINGLE'],
      month: '2026-13',
    });
    assert.deepEqual(result, { status: 'invalid-month', month: '2026-13' });
  });

  test('写法不完整（2026-1）→ invalid-month，零候选也不得报 not-found（不做任何查找）', () => {
    const result = selectPortrait({ portraits: [] }, {
      entityType: 'product',
      entityIds: ['SPU-NONE'],
      month: '2026-1',
    });
    assert.deepEqual(result, { status: 'invalid-month', month: '2026-1' });
  });

  test('合法自然月不受影响', () => {
    const result = selectPortrait(SOURCE, {
      entityType: 'product',
      entityIds: ['SPU-SINGLE'],
      month: '2026-10',
    });
    assert.equal(result.status, 'found');
  });
});
