import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { buildIndex } from '@uom/core';
import { createServer } from '../src/index.js';
import { createPeriodDataRoot } from './helpers/fixtures.js';

/**
 * 切片 A · MCP 期间查询语义（SA-03／SA-05）。
 *
 * month／platform 参数、歧义显式返回、档案按月形态。
 */

interface ToolPayload<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { kind: string; message: string; hint?: string };
}

let client: Client;

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolPayload> {
  const result = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const text = result.content?.[0]?.text ?? '{}';
  return JSON.parse(text) as ToolPayload;
}

before(async () => {
  const dataRoot = await createPeriodDataRoot();
  const index = await buildIndex({ dataRoot });
  const server = createServer(index);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'uom-period-test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

after(async () => {
  await client?.close();
});

describe('SA-03 · get_channel_portrait 的 month 与 platform', () => {
  test('带 month 命中覆盖该月的区间画像', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00002', month: '2026-01' });
    assert.equal(payload.ok, true, `应命中区间画像：${JSON.stringify(payload.error)}`);
    const data = payload.data as { month: string };
    assert.equal(data.month, '2025-07~2026-06');
  });

  test('跨月多份画像不传 month 报 ambiguous 并列出可用月份', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00001' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('2026-09'), 'hint 应列出可用月份');
    assert.ok(payload.error?.hint?.includes('2026-10'), 'hint 应列出可用月份');
  });

  test('同月多平台报 ambiguous：message 列平台、hint 提示传 platform', async () => {
    const noMonth = await call('get_channel_portrait', { channelId: 'D00003' });
    assert.equal(noMonth.ok, false);
    assert.equal(noMonth.error?.kind, 'ambiguous');
    assert.ok(noMonth.error?.message.includes('douyin'), 'message 应列出平台');
    assert.ok(noMonth.error?.message.includes('tmall'), 'message 应列出平台');
    assert.ok(noMonth.error?.hint?.includes('platform'), 'hint 应提示传 platform');

    const withMonth = await call('get_channel_portrait', {
      channelId: 'D00003',
      month: '2026-10',
    });
    assert.equal(withMonth.ok, false, '同月多平台且未给 platform 时仍应歧义');
    assert.equal(withMonth.error?.kind, 'ambiguous');
    assert.ok(withMonth.error?.hint?.includes('platform'), 'hint 应提示传 platform');
  });

  test('month + platform 消歧后取该平台画像', async () => {
    const payload = await call('get_channel_portrait', {
      channelId: 'D00003',
      month: '2026-10',
      platform: '天猫',
    });
    assert.equal(payload.ok, true, `应按平台消歧：${JSON.stringify(payload.error)}`);
    const data = payload.data as { platformLabels: Record<string, unknown> };
    assert.deepEqual(Object.keys(data.platformLabels), ['tmall']);
  });
});

describe('SA-03 · get_product_portrait 的 month', () => {
  test('跨月画像不传 month 报 ambiguous 并列月份', async () => {
    const payload = await call('get_product_portrait', { spu: 'SPU-001' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('2026-09'), 'hint 应列出可用月份');
    assert.ok(payload.error?.hint?.includes('2026-10'), 'hint 应列出可用月份');
  });

  test('带 month 取覆盖该月的画像', async () => {
    const payload = await call('get_product_portrait', { spu: 'SPU-001', month: '2026-10' });
    assert.equal(payload.ok, true, `应按月取画像：${JSON.stringify(payload.error)}`);
    const data = payload.data as { platformLabels: Record<string, unknown>; month: string };
    assert.equal(data.month, '2026-10');
    assert.deepEqual(Object.keys(data.platformLabels), ['douyin']);
  });

  test('该月无画像报 month-mismatch，不回退相邻月份', async () => {
    const payload = await call('get_product_portrait', { spu: 'SPU-001', month: '2026-11' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'month-mismatch');
    assert.ok(payload.error?.hint?.includes('2026-09'), 'hint 应列出可用月份');
  });
});

describe('SA-03 · compare_product_channel 的期间与平台消歧', () => {
  test('商品多月份且未给 month 报 ambiguous 并提示传 month', async () => {
    const payload = await call('compare_product_channel', {
      spu: 'SPU-001',
      channelId: 'D00001',
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('month'), '多月份歧义应提示传 month');
  });

  test('指定 month 与 productPlatform 后命中', async () => {
    const payload = await call('compare_product_channel', {
      spu: 'SPU-001',
      channelId: 'D00001',
      month: '2026-10',
      productPlatform: '抖音',
    });
    assert.equal(payload.ok, true, `应消歧成功：${JSON.stringify(payload.error)}`);
    const data = payload.data as { month?: string; comparedDimensions: number };
    assert.equal(data.month, '2026-10');
    assert.ok(data.comparedDimensions > 0);
  });

  test('渠道同月多平台且未给 channelPlatform 报 ambiguous', async () => {
    const payload = await call('compare_product_channel', {
      spu: 'SPU-001',
      channelId: 'D00003',
      month: '2026-10',
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('channelPlatform'), 'hint 应提示传 channelPlatform');
  });

  test('指定 channelPlatform 后命中', async () => {
    const payload = await call('compare_product_channel', {
      spu: 'SPU-001',
      channelId: 'D00003',
      month: '2026-10',
      channelPlatform: '天猫',
    });
    assert.equal(payload.ok, true, `应消歧成功：${JSON.stringify(payload.error)}`);
    const data = payload.data as { month?: string; comparedDimensions: number };
    assert.equal(data.month, '2026-10');
    assert.ok(data.comparedDimensions > 0);
  });
});

describe('SA-03 · search_by_tag 与 search_similar_products 的 month', () => {
  test('search_by_tag 带 month 只命中覆盖该月的画像，且带匹配方式', async () => {
    const payload = await call('search_by_tag', { dimension: 'gender', label: '男', month: '2026-10' });
    assert.equal(payload.ok, true);
    const data = payload.data as { hits: { month: string; match?: string }[] };
    assert.ok(data.hits.length > 0);
    for (const hit of data.hits) {
      assert.ok(
        hit.month === '2026-10' || hit.month === '2025-07~2026-06',
        `不应命中不覆盖 2026-10 的画像：${hit.month}`,
      );
      assert.ok(hit.match, '命中结果应带匹配方式');
    }
  });

  test('search_similar_products 多份画像不传 month 报 ambiguous 并列月份', async () => {
    const payload = await call('search_similar_products', { spu: 'SPU-001' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('2026-09'), '应列出可用月份');
    assert.ok(payload.error?.hint?.includes('2026-10'), '应列出可用月份');
  });

  test('search_similar_products 带 month 用该月画像计算', async () => {
    const payload = await call('search_similar_products', { spu: 'SPU-001', month: '2026-10' });
    assert.equal(payload.ok, true, `应按月计算：${JSON.stringify(payload.error)}`);
    const data = payload.data as { hits: { spu: string; hasPortrait: boolean }[] };
    const hit = data.hits.find((item) => item.spu === 'SPU-002');
    assert.ok(hit, '应命中 SPU-002');
    assert.equal(hit.hasPortrait, true, '候选与目标都用该月画像时画像分应参与');
  });
});

describe('SA-03 · get_portrait_aggregate 的 month', () => {
  test('成员有多份画像且不传 month 报 ambiguous', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'category', key: 'T恤' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('month'), '应提示传 month');
  });

  test('带 month 聚合各成员覆盖该月的画像', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'category', key: 'T恤', month: '2026-10' });
    assert.equal(payload.ok, true, `应按月聚合：${JSON.stringify(payload.error)}`);
    const data = payload.data as { entityType: string };
    assert.equal(data.entityType, 'category');
  });
});

describe('SA-05 · get_product_dossier 按月形态', () => {
  test('不传 month 返回全部月份的 portraits 数组，无单数 portrait', async () => {
    const payload = await call('get_product_dossier', { spu: 'SPU-001' });
    assert.equal(payload.ok, true);
    const data = payload.data as {
      portraits: { month: string; platform: string; projections: Record<string, unknown> }[];
      performance?: Record<string, unknown>;
      portrait?: unknown;
    };
    assert.ok(!('portrait' in data), '单数 portrait 字段应移除');
    assert.equal(data.portraits.length, 2, '应有 2026-09 与 2026-10 两份抖音画像');
    const keys = data.portraits.map((item) => `${item.month}/${item.platform}`).sort();
    assert.deepEqual(keys, ['2026-09/douyin', '2026-10/douyin']);
    for (const item of data.portraits) {
      assert.ok(item.projections && Object.keys(item.projections).length > 0, '应含 projections');
    }
    assert.deepEqual(Object.keys(data.performance ?? {}).sort(), ['2026-09', '2026-10']);
  });

  test('带 month 时画像、指标、漏斗、渠道成交只含该月', async () => {
    const payload = await call('get_product_dossier', { spu: 'SPU-001', month: '2026-10' });
    assert.equal(payload.ok, true);
    const data = payload.data as {
      portraits: { month: string }[];
      performance?: Record<string, unknown>;
      funnel?: Record<string, unknown>;
      channelPerformance?: Record<string, Record<string, unknown>>;
    };
    assert.deepEqual(
      data.portraits.map((item) => item.month).sort(),
      ['2026-10'],
    );
    assert.deepEqual(Object.keys(data.performance ?? {}), ['2026-10']);
    assert.deepEqual(Object.keys(data.funnel ?? {}), ['2026-10']);
    assert.deepEqual(Object.keys(data.channelPerformance?.D00001 ?? {}), ['2026-10']);
  });

  test('该月四类数据都没有时报 month-mismatch 并列出可用月份', async () => {
    const payload = await call('get_product_dossier', { spu: 'SPU-001', month: '2026-11' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'month-mismatch');
    assert.ok(payload.error?.hint?.includes('2026-09'), '应列出可用月份');
    assert.ok(payload.error?.hint?.includes('2026-10'), '应列出可用月份');
  });
});
