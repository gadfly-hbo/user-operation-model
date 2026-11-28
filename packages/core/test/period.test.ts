import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  normalizeTmallPortrait,
  parseFileNameEntity,
  parsePeriod,
  periodCovers,
  periodMonths,
} from '../src/index.js';
import { tmallPortraitXlsx, makeTempDir } from './helpers/fixtures.js';

/**
 * 期间模型（切片 A · SA-01）。
 *
 * 月份是一等公民：parsePeriod 解析四类期间；periodCovers 判定覆盖；
 * 年份写法归一为全年区间并标注 year（近似）；画像写入 period 字段。
 */

describe('parsePeriod · 四类期间', () => {
  test('单月标签解析为 month', () => {
    assert.deepEqual(parsePeriod('2026-10'), {
      kind: 'month',
      label: '2026-10',
      month: '2026-10',
    });
  });

  test('区间标签解析为 window，带起止', () => {
    assert.deepEqual(parsePeriod('2025-07~2026-06'), {
      kind: 'window',
      label: '2025-07~2026-06',
      start: '2025-07',
      end: '2026-06',
    });
  });

  test('年份解析为 year，标签是全年区间（R-7）', () => {
    assert.deepEqual(parsePeriod('2024'), {
      kind: 'year',
      label: '2024-01~2024-12',
      start: '2024-01',
      end: '2024-12',
    });
  });

  test('整年窗口标签（YYYY-01~YYYY-12）识别为 year，保证标签与期间可互相还原', () => {
    assert.deepEqual(parsePeriod('2024-01~2024-12'), {
      kind: 'year',
      label: '2024-01~2024-12',
      start: '2024-01',
      end: '2024-12',
    });
    assert.equal(parsePeriod('2024-01~2024-11').kind, 'window', '不足整年仍是 window');
    assert.equal(parsePeriod('2023-01~2024-12').kind, 'window', '跨年整十二个月仍是 window');
  });

  test('空串解析为 unknown', () => {
    assert.deepEqual(parsePeriod(''), { kind: 'unknown', label: '' });
    assert.deepEqual(parsePeriod('   '), { kind: 'unknown', label: '' });
  });

  test('非法月份解析为 unknown，不猜测', () => {
    assert.equal(parsePeriod('2026-13').kind, 'unknown');
    assert.equal(parsePeriod('2026-13').label, '2026-13');
    assert.equal(parsePeriod('不是月份').kind, 'unknown');
    assert.equal(parsePeriod('2026-1').kind, 'unknown');
  });

  test('区间里任一端非法即为 unknown', () => {
    assert.equal(parsePeriod('2026-13~2027-01').kind, 'unknown');
    assert.equal(parsePeriod('2026-01~2026-14').kind, 'unknown');
  });

  test('起倒置的区间为 unknown', () => {
    assert.equal(parsePeriod('2026-06~2025-07').kind, 'unknown');
  });
});

describe('periodCovers · 覆盖判定', () => {
  test('单月必须相等', () => {
    const period = parsePeriod('2026-10');
    assert.equal(periodCovers(period, '2026-10'), true);
    assert.equal(periodCovers(period, '2026-09'), false, '相邻月份不得回退');
    assert.equal(periodCovers(period, '2026-11'), false);
  });

  test('区间覆盖起止之间的月份（含端点）', () => {
    const period = parsePeriod('2025-07~2026-06');
    assert.equal(periodCovers(period, '2025-07'), true, '起始月覆盖');
    assert.equal(periodCovers(period, '2026-06'), true, '结束月覆盖');
    assert.equal(periodCovers(period, '2025-12'), true);
    assert.equal(periodCovers(period, '2025-06'), false);
    assert.equal(periodCovers(period, '2026-07'), false);
  });

  test('年份覆盖该年 1 月到 12 月', () => {
    const period = parsePeriod('2024');
    assert.equal(periodCovers(period, '2024-01'), true);
    assert.equal(periodCovers(period, '2024-12'), true);
    assert.equal(periodCovers(period, '2024-06'), true);
    assert.equal(periodCovers(period, '2023-12'), false);
    assert.equal(periodCovers(period, '2025-01'), false);
  });

  test('unknown 不覆盖任何月份', () => {
    const period = parsePeriod('');
    assert.equal(periodCovers(period, '2026-10'), false);
    assert.equal(periodCovers(period, ''), false);
  });
});

describe('periodMonths · 展开为具体月份', () => {
  test('单月展开为自身', () => {
    assert.deepEqual(periodMonths(parsePeriod('2026-10')), ['2026-10']);
  });

  test('区间按日历展开（跨年）', () => {
    assert.deepEqual(periodMonths(parsePeriod('2025-11~2026-02')), [
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    assert.deepEqual(periodMonths(parsePeriod('2026-03~2026-05')), ['2026-03', '2026-04', '2026-05']);
  });

  test('年份展开为 12 个月', () => {
    assert.deepEqual(periodMonths(parsePeriod('2024')), [
      '2024-01',
      '2024-02',
      '2024-03',
      '2024-04',
      '2024-05',
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
    ]);
  });

  test('unknown 展开为空', () => {
    assert.deepEqual(periodMonths(parsePeriod('')), []);
  });
});

describe('年份画像（R-7：年导出不再伪装成 1 月）', () => {
  test('文件名里的 4 位年份解析为全年区间', () => {
    const parsed = parseFileNameEntity('/x/2024_演示店_天猫.xlsx');
    assert.equal(parsed?.entityId, '演示店');
    assert.equal(parsed?.month, '2024-01~2024-12', '年份必须是全年区间，不是 2024-01');
  });

  test('年份画像的 month 与 period 同步写入（近似口径）', async () => {
    const dir = makeTempDir('uom-period-');
    const path = await tmallPortraitXlsx(join(dir, '2024_演示店_天猫.xlsx'), [
      ['预测性别', '男', '35.00%'],
      ['预测性别', '女', '65.00%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, { entityType: 'channel' });
    assert.equal(portrait.month, '2024-01~2024-12');
    assert.deepEqual(portrait.period, {
      kind: 'year',
      label: '2024-01~2024-12',
      start: '2024-01',
      end: '2024-12',
    });
  });

  test('单月与区间画像同样写入 period 字段', async () => {
    const dir = makeTempDir('uom-period-');
    const monthly = await tmallPortraitXlsx(join(dir, '2026-10_演示店_天猫.xlsx'), [
      ['预测性别', '男', '35.00%'],
    ]);
    const monthlyPortrait = await normalizeTmallPortrait(monthly, { entityType: 'channel' });
    assert.equal(monthlyPortrait.month, '2026-10');
    assert.deepEqual(monthlyPortrait.period, {
      kind: 'month',
      label: '2026-10',
      month: '2026-10',
    });

    const windowed = await tmallPortraitXlsx(join(dir, '2507-2606_演示店画像数据_天猫.xlsx'), [
      ['预测性别', '男', '35.00%'],
    ]);
    const windowedPortrait = await normalizeTmallPortrait(windowed, { entityType: 'channel' });
    assert.equal(windowedPortrait.month, '2025-07~2026-06');
    assert.deepEqual(windowedPortrait.period, {
      kind: 'window',
      label: '2025-07~2026-06',
      start: '2025-07',
      end: '2026-06',
    });
  });

  test('无月份画像的 period 为 unknown', async () => {
    const dir = makeTempDir('uom-period-');
    const path = await tmallPortraitXlsx(join(dir, '款号SPU-900_天猫.xlsx'), [
      ['预测性别', '男', '35.00%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, { entityType: 'product' });
    assert.equal(portrait.month, '');
    assert.deepEqual(portrait.period, { kind: 'unknown', label: '' });
  });
});
