import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { buildIndex } from '@uom/core';
import { createServer, TOOL_NAMES } from '../src/index.js';
import { createFixtureDataRoot } from './helpers/fixtures.js';

/**
 * MCP 层测试。
 *
 * 用 `InMemoryTransport.createLinkedPair()` 在进程内建立真实的 MCP 协议连接，
 * 客户端与 server 走完整的 initialize / tools/list / tools/call 流程。
 */

let dataRoot = '';
let client: Client;

interface ToolPayload<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { kind: string; message: string; hint?: string };
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolPayload> {
  const result = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const text = result.content?.[0]?.text ?? '{}';
  return JSON.parse(text) as ToolPayload;
}

before(async () => {
  dataRoot = await createFixtureDataRoot();
  const index = await buildIndex({ dataRoot });
  const server = createServer(index);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'uom-test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

after(async () => {
  await client?.close();
});

describe('MCP 工具注册', () => {
  test('17 个工具全部注册，名称与讨论稿一致', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [...TOOL_NAMES].sort());
    assert.equal(TOOL_NAMES.length, 17);
  });

  test('每个工具都有描述与输入 schema', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.ok(tool.description && tool.description.length > 0, `${tool.name} 缺少描述`);
      assert.ok(tool.inputSchema, `${tool.name} 缺少输入 schema`);
    }
  });

  test('工具被标记为只读', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} 应标记为只读`);
    }
  });
});

describe('渠道类工具', () => {
  test('list_channels 返回渠道与画像月份', async () => {
    const payload = await call('list_channels');
    assert.equal(payload.ok, true);
    const data = payload.data as { total: number; months: string[]; channels: unknown[] };
    assert.equal(data.total, 2);
    assert.deepEqual(data.months, ['2025-07~2026-06']);
  });

  test('list_channels 按类型过滤', async () => {
    const payload = await call('list_channels', { type: '抖音' });
    const data = payload.data as { total: number };
    assert.equal(data.total, 1);
  });

  test('get_channel_portrait 返回投影', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00001' });
    assert.equal(payload.ok, true);
    const data = payload.data as { projections: Record<string, { labels: unknown }> };
    assert.ok(data.projections.gender);
    assert.ok(data.projections.strategy_segment);
  });

  test('get_channel_portrait 缺月时报 month-mismatch，不静默回退', async () => {
    const payload = await call('get_channel_portrait', {
      channelId: 'D00001',
      month: '2020-01',
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'month-mismatch');
    assert.ok(payload.error?.hint?.includes('2025-07~2026-06'));
  });

  test('get_channel_portrait 渠道不存在时报 not-found', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'NOPE' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
  });
});

describe('商品类工具', () => {
  test('list_products 按关键词检索', async () => {
    const payload = await call('list_products', { keyword: 'T恤' });
    const data = payload.data as { total: number };
    assert.equal(data.total, 1);
  });

  test('list_products 按 channel 过滤时明确报数据未就位', async () => {
    const payload = await call('list_products', { channel: 'D00001' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'data-not-ready');
    assert.ok(payload.error?.message.includes('关联键'));
  });

  test('get_product_dossier 返回单品档案', async () => {
    const payload = await call('get_product_dossier', { spu: 'SPU-001' });
    assert.equal(payload.ok, true);
    const data = payload.data as { spu: string; price?: { tagPrice?: number } };
    assert.equal(data.spu, 'SPU-001');
    assert.equal(data.price?.tagPrice, 199);
  });

  test('get_product_dossier 商品不存在时报 not-found', async () => {
    const payload = await call('get_product_dossier', { spu: 'NOPE' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
  });

  test('get_product_portrait 支持维度过滤', async () => {
    const payload = await call('get_product_portrait', {
      spu: 'SPU-001',
      dimensions: ['gender'],
    });
    assert.equal(payload.ok, true);
    const data = payload.data as { projections: Record<string, unknown> };
    assert.deepEqual(Object.keys(data.projections), ['gender']);
  });

  test('get_portrait_aggregate 支持品类层级', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'category', key: 'T恤' });
    assert.equal(payload.ok, true);
    const data = payload.data as { entityType: string; projections: Record<string, unknown> };
    assert.equal(data.entityType, 'category');
  });

  test('get_portrait_aggregate 未接入的层级报 data-not-ready', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'series', key: 'X' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'data-not-ready');
  });
});

describe('对比与检索工具', () => {
  test('compare_product_channel 返回逐维度差异且不含匹配分', async () => {
    const payload = await call('compare_product_channel', {
      spu: 'SPU-001',
      channelId: 'D00001',
    });
    assert.equal(payload.ok, true);
    const data = payload.data as {
      comparedDimensions: number;
      dimensions: { dimension: string; distance: number; jsSimilarity: number; cosine: number }[];
    };
    assert.ok(data.comparedDimensions > 0);
    assert.ok(data.dimensions.every((d) => d.distance >= 0 && d.distance <= 1));
    assert.ok(data.dimensions.every((d) => d.jsSimilarity >= 0 && d.jsSimilarity <= 1));
    // 用**结构白名单**断言，而不是匹配字面键名——
    // 换成 matchScore / rating / score 之类的名字同样应被拦下
    assert.deepEqual(
      Object.keys(data).sort(),
      [
        'channelId',
        'comparedDimensions',
        'dimensions',
        'month',
        'onlyInChannel',
        'onlyInProduct',
        'spu',
      ].filter((key) => key in data).sort(),
    );
    assert.deepEqual(
      Object.keys(data.dimensions[0] ?? {}).sort(),
      [
        'channelTop3',
        'cosine',
        'dimension',
        'distance',
        'jsSimilarity',
        'overlapTop3',
        'productTop3',
      ],
    );
  });

  test('search_by_tag 按统一维度反查', async () => {
    const payload = await call('search_by_tag', { dimension: 'strategy_segment', label: '银发族' });
    assert.equal(payload.ok, true);
    const data = payload.data as { total: number; hits: { entityId: string }[] };
    assert.ok(data.total >= 1);
    assert.ok(data.hits.some((hit) => hit.entityId.includes('演示账号1')));
  });

  test('search_by_tag 未命中时报 not-found', async () => {
    const payload = await call('search_by_tag', { dimension: 'gender', label: '不存在的标签' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
  });

  test('search_similar_products 返回相似款并给出分解得分', async () => {
    const payload = await call('search_similar_products', { spu: 'SPU-001', topN: 5 });
    assert.equal(payload.ok, true);
    const data = payload.data as {
      hits: { spu: string; score: number; attributeScore: number; portraitScore: number }[];
    };
    assert.ok(data.hits.length >= 1);
    assert.ok(data.hits[0]!.spu !== 'SPU-001', '不应包含自身');
    assert.ok(data.hits[0]!.score >= 0);
  });
});

describe('数据未就位的工具', () => {
  const notReadyTools = [
    'get_competitor_portrait',
    'get_funnel',
    'list_member_features',
    'get_retention_cohort',
    'get_recency_distribution',
    'get_channel_flow_matrix',
    'get_diagnosis',
  ];

  for (const tool of notReadyTools) {
    test(`${tool} 返回明确错误并说明缺什么数据`, async () => {
      const payload = await call(tool, { brand: 'X', spu: 'SPU-001', phase: 'launch', cohortMonth: '2026-01', metric: 'day30', month: '2026-01', type: 'all' });
      assert.equal(payload.ok, false, `${tool} 应返回错误而非空结果`);
      assert.equal(payload.error?.kind, 'data-not-ready');
      assert.ok(payload.error?.message && payload.error.message.length > 0);
    });
  }
});

describe('参数校验', () => {
  test('get_brand_portrait 的 scope 非法时报 invalid-argument', async () => {
    const payload = await call('get_brand_portrait', { scope: '乱填' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'invalid-argument');
  });

  test('get_brand_portrait 在品牌画像未接入时报 data-not-ready，不是空结果', async () => {
    const payload = await call('get_brand_portrait', { scope: 'all' });
    assert.equal(payload.ok, false, '数据未就位必须返回错误而非空结果');
    assert.equal(payload.error?.kind, 'data-not-ready');
    assert.ok(payload.error?.message.includes('品牌人群画像'));
  });
});
