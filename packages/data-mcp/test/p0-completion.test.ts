import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { buildIndex, DATA_SOURCE_PROBES } from '@uom/core';
import { createServer } from '../src/index.js';
import { createFixtureDataRoot, createP0DataRoot } from './helpers/fixtures.js';

/**
 * P0 数据收尾的 MCP 层验收。
 *
 * - DC01：7 个占位工具改为真实实现（文件到位 → 真实结果；文件缺失 → data-not-ready）
 * - DC03：探测表与处理器一致性守卫（探测说就绪 ⇒ 处理器不得返回 data-not-ready）
 * - DC07／DC08：商品↔渠道过滤与聚合层级
 * - 现状不变性：其余工具的返回与 main 基线一致
 */

interface ToolPayload<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { kind: string; message: string; hint?: string };
}

async function connect(dataRoot: string): Promise<Client> {
  const index = await buildIndex({ dataRoot });
  const server = createServer(index);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'uom-p0-test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolPayload> {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
  };
  const text = result.content?.[0]?.text ?? '{}';
  return JSON.parse(text) as ToolPayload;
}

/** 递归子集断言：expected 的每处都必须与 actual 相同，actual 可有额外字段。 */
function assertSubset(actual: unknown, expected: unknown, path = '$'): void {
  if (expected === null || typeof expected !== 'object') {
    assert.deepEqual(actual, expected, `${path} 与 main 基线不一致`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path} 应为数组`);
    assert.equal(actual!.length, expected.length, `${path} 长度与 main 基线不一致`);
    expected.forEach((item, index) => assertSubset(actual![index], item, `${path}[${index}]`));
    return;
  }
  assert.ok(actual !== null && typeof actual === 'object', `${path} 应为对象`);
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    assert.ok(
      key in (actual as Record<string, unknown>),
      `${path}.${key} 在当前实现中缺失`,
    );
    assertSubset((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
  }
}

describe('7 个占位工具的真实实现（DC01）', () => {
  let client: Client;

  before(async () => {
    client = await connect(await createP0DataRoot());
  });

  after(async () => {
    await client?.close();
  });

  test('get_competitor_portrait 返回竞品画像', async () => {
    const payload = await call(client, 'get_competitor_portrait', { brand: '竞品A' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { brand: string; portraits: unknown[] };
    assert.equal(data.brand, '竞品A');
    assert.equal(data.portraits.length, 1);
  });

  test('get_funnel 返回指定款号与阶段的漏斗数据', async () => {
    const payload = await call(client, 'get_funnel', { spu: 'SPU-001', phase: 'launch' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { rows: { metrics: Record<string, number> }[] };
    assert.equal(data.rows.length, 1);
    assert.equal(data.rows[0]!.metrics['浏览'], 1000);
  });

  test('list_member_features 返回特征字典并支持层级过滤', async () => {
    const payload = await call(client, 'list_member_features', {});
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { total: number; features: { field: string }[] };
    assert.equal(data.total, 2);

    const filtered = await call(client, 'list_member_features', { level: '行为派生' });
    const filteredData = filtered.data as { total: number; features: { field: string }[] };
    assert.equal(filteredData.total, 1);
    assert.equal(filteredData.features[0]!.field, '最近购买间隔天数');
  });

  test('get_retention_cohort 返回指定分群与指标', async () => {
    const payload = await call(client, 'get_retention_cohort', {
      cohortMonth: '2026-01',
      metric: 'day30',
    });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { cohortMonth: string; value: number; buyers?: number };
    assert.equal(data.cohortMonth, '2026-01');
    assert.ok(Math.abs(data.value - 0.355) < 1e-9);
    assert.equal(data.buyers, 1000);
  });

  test('get_retention_cohort 指标不存在时报 not-found 并列出可用指标', async () => {
    const payload = await call(client, 'get_retention_cohort', {
      cohortMonth: '2026-01',
      metric: 'day365',
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
    assert.ok(payload.error?.hint?.includes('day30'));
  });

  test('get_recency_distribution 返回指定月份的切片分布', async () => {
    const payload = await call(client, 'get_recency_distribution', { month: '2026-01' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { rows: { bucket: string; buyers?: number }[] };
    assert.equal(data.rows.length, 2);
    assert.deepEqual(data.rows.map((row) => row.bucket).sort(), ['1-30', '>365']);
  });

  test('get_channel_flow_matrix 返回来源→回购渠道矩阵', async () => {
    const payload = await call(client, 'get_channel_flow_matrix', { month: '2026-01' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as {
      rows: { from: string; to: string; buyers?: number }[];
      matrix: Record<string, Record<string, number>>;
    };
    assert.equal(data.rows.length, 2);
    assert.equal(data.matrix['抖音直播']?.['天猫'], 30);
  });

  test('get_diagnosis 返回指定类型与月份的诊断指标', async () => {
    const payload = await call(client, 'get_diagnosis', { month: '2026-01', type: '二回断崖' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { type: string; metrics: Record<string, number> };
    assert.equal(data.type, '二回断崖');
    assert.ok(Math.abs((data.metrics['大促新客第60天二回比例'] ?? 0) - 0.18) < 1e-9);
  });

  test('get_diagnosis 类型不存在时报 not-found', async () => {
    const payload = await call(client, 'get_diagnosis', { month: '2026-01', type: '不存在的诊断' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
  });
});

describe('文件缺失时仍返回 data-not-ready（DC01）', () => {
  let client: Client;

  before(async () => {
    client = await connect(await createFixtureDataRoot());
  });

  after(async () => {
    await client?.close();
  });

  const cases: { tool: string; args: Record<string, unknown>; expect: string }[] = [
    { tool: 'get_competitor_portrait', args: { brand: '竞品A' }, expect: '竞品' },
    { tool: 'get_funnel', args: { spu: 'SPU-001', phase: 'launch' }, expect: 'funnel.csv' },
    { tool: 'list_member_features', args: {}, expect: 'member-features.csv' },
    { tool: 'get_retention_cohort', args: { cohortMonth: '2026-01', metric: 'day30' }, expect: 'cohort.csv' },
    { tool: 'get_recency_distribution', args: { month: '2026-01' }, expect: 'recency.csv' },
    { tool: 'get_channel_flow_matrix', args: { month: '2026-01' }, expect: 'channel-flow.csv' },
    { tool: 'get_diagnosis', args: { month: '2026-01', type: '二回断崖' }, expect: 'diagnosis.csv' },
  ];

  for (const item of cases) {
    test(`${item.tool} 缺文件时报 data-not-ready 且说明缺哪个文件`, async () => {
      const payload = await call(client, item.tool, item.args);
      assert.equal(payload.ok, false, `${item.tool} 缺文件时不得返回空结果`);
      assert.equal(payload.error?.kind, 'data-not-ready');
      assert.ok(
        payload.error?.message.includes(item.expect),
        `${item.tool} 的说明应指出缺 ${item.expect}，实际：${payload.error?.message}`,
      );
    });
  }
});

describe('探测表与处理器一致性守卫（DC03）', () => {
  let client: Client;

  before(async () => {
    client = await connect(await createP0DataRoot());
  });

  after(async () => {
    await client?.close();
  });

  const toolArgs: Record<string, Record<string, unknown>> = {
    get_brand_portrait: { scope: 'all' },
    get_competitor_portrait: { brand: '竞品A' },
    get_funnel: { spu: 'SPU-001', phase: 'launch' },
    list_member_features: {},
    get_retention_cohort: { cohortMonth: '2026-01', metric: 'day30' },
    get_recency_distribution: { month: '2026-01' },
    get_channel_flow_matrix: { month: '2026-01' },
    get_diagnosis: { month: '2026-01', type: '二回断崖' },
  };

  test('探测表里的每个工具都被本守卫覆盖', () => {
    for (const probe of DATA_SOURCE_PROBES) {
      assert.ok(
        toolArgs[probe.tool],
        `守卫未覆盖探测表中的工具：${probe.tool}`,
      );
    }
  });

  for (const probe of DATA_SOURCE_PROBES) {
    test(`${probe.tool}：fixture 满足探测条件时不得返回 data-not-ready`, async () => {
      const payload = await call(client, probe.tool, toolArgs[probe.tool] ?? {});
      assert.notEqual(
        payload.error?.kind,
        'data-not-ready',
        `${probe.tool} 探测说就绪，处理器却返回 data-not-ready：${payload.error?.message ?? ''}`,
      );
      assert.equal(payload.ok, true, `${probe.tool} 应返回真实结果：${JSON.stringify(payload)}`);
    });
  }
});

describe('商品↔渠道与聚合层级（DC07／DC08）', () => {
  let client: Client;

  before(async () => {
    client = await connect(await createP0DataRoot());
  });

  after(async () => {
    await client?.close();
  });

  test('list_products 的 channel 过滤在关联表到位后可用', async () => {
    const payload = await call(client, 'list_products', { channel: 'D00001' });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { total: number; products: { spu: string }[] };
    assert.equal(data.total, 1);
    assert.equal(data.products[0]!.spu, 'SPU-001');
  });

  test('list_products 返回渠道级成交额', async () => {
    const payload = await call(client, 'list_products', { channel: 'D00001' });
    const data = payload.data as {
      products: { spu: string; channelSales?: { month: string; retailAmount?: number }[] }[];
    };
    assert.equal(data.products[0]!.channelSales?.[0]?.retailAmount, 12000);
  });

  test('get_portrait_aggregate 支持 series 层级', async () => {
    const payload = await call(client, 'get_portrait_aggregate', {
      level: 'series',
      key: '基础系列',
    });
    assert.equal(payload.ok, true, JSON.stringify(payload));
    const data = payload.data as { entityType: string };
    assert.equal(data.entityType, 'series');
  });

  test('get_portrait_aggregate 的 hot 层级不可用时报 not-found 而不是空结果', async () => {
    const payload = await call(client, 'get_portrait_aggregate', { level: 'hot', key: '不存在的爆款组' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'not-found');
  });
});

describe('现状不变性：其余工具与 main 基线一致', () => {
  let client: Client;

  before(async () => {
    client = await connect(await createFixtureDataRoot());
  });

  after(async () => {
    await client?.close();
  });

  const baseline: {
    tool: string;
    args: Record<string, unknown>;
    expected: unknown;
  }[] = [
    {
      tool: 'list_channels',
      args: {},
      expected: {
        ok: true,
        data: {
          total: 2,
          months: ['2025-07~2026-06'],
          channels: [
            {
              channelId: 'D00001',
              name: '演示账号1',
              platform: '抖音',
              channelType: '抖音',
              channelGrade: '核心店',
              city: '上海',
              storeStatus: '营业',
            },
            {
              channelId: 'D00002',
              name: '演示账号2',
              platform: '天猫',
              channelType: '天猫',
              channelGrade: '核心店',
              city: '上海',
              storeStatus: '营业',
            },
          ],
        },
      },
    },
    {
      tool: 'get_channel_portrait',
      args: { channelId: 'D00001' },
      expected: {
        ok: true,
        data: { channelId: 'D00001', month: '2025-07~2026-06' },
      },
    },
    {
      tool: 'get_channel_portrait',
      args: { channelId: 'D00001', month: '2020-01' },
      expected: {
        ok: false,
        error: {
          kind: 'month-mismatch',
          message: '渠道 D00001 在 2020-01 无画像',
          hint: '可用月份：2025-07~2026-06',
        },
      },
    },
    {
      tool: 'get_channel_portrait',
      args: { channelId: 'NOPE' },
      expected: { ok: false, error: { kind: 'not-found' } },
    },
    {
      tool: 'get_brand_portrait',
      args: { scope: 'all' },
      expected: {
        ok: false,
        error: {
          kind: 'data-not-ready',
          message:
            '品牌人群画像未接入：期望 data/domains/01_品牌信息/ 下有品牌画像文件（当前只有品牌清单）',
        },
      },
    },
    {
      tool: 'get_brand_portrait',
      args: { scope: '乱填' },
      expected: {
        ok: false,
        error: { kind: 'invalid-argument', message: 'scope 必须是 target 或 all，收到 乱填' },
      },
    },
    {
      tool: 'list_products',
      args: { keyword: 'T恤' },
      expected: {
        ok: true,
        data: {
          total: 1,
          products: [{ spu: 'SPU-001', brand: '演示品牌', price: { tagPrice: 199 } }],
        },
      },
    },
    {
      tool: 'list_products',
      args: { channel: 'D00001' },
      expected: {
        ok: false,
        error: {
          kind: 'data-not-ready',
          message: '按渠道过滤商品暂不可用：现有数据源中商品表与渠道表没有关联键',
        },
      },
    },
    {
      tool: 'get_product_dossier',
      args: { spu: 'SPU-001' },
      expected: {
        ok: true,
        data: { spu: 'SPU-001', schemaVersion: '0.1.0', price: { tagPrice: 199 } },
      },
    },
    {
      tool: 'get_product_portrait',
      args: { spu: 'SPU-001', dimensions: ['gender'] },
      expected: {
        ok: true,
        data: { spu: 'SPU-001', month: '', projections: { gender: { dimension: 'gender' } } },
      },
    },
    {
      tool: 'get_portrait_aggregate',
      args: { level: 'category', key: 'T恤' },
      expected: { ok: true, data: { entityType: 'category', entityId: 'T恤' } },
    },
    {
      tool: 'get_portrait_aggregate',
      args: { level: 'series', key: 'X' },
      expected: {
        ok: false,
        error: {
          kind: 'data-not-ready',
          message: '聚合层级 series 未接入：需要聚合口径表（商品归属哪个系列／爆款／IP）',
        },
      },
    },
    {
      tool: 'compare_product_channel',
      args: { spu: 'SPU-001', channelId: 'D00001' },
      expected: {
        ok: true,
        data: {
          spu: 'SPU-001',
          channelId: 'D00001',
          comparedDimensions: 6,
          onlyInProduct: [],
          onlyInChannel: [],
        },
      },
    },
    {
      tool: 'search_by_tag',
      args: { dimension: 'strategy_segment', label: '银发族' },
      expected: { ok: true, data: { dimension: 'strategy_segment', label: '银发族', total: 2 } },
    },
    {
      tool: 'search_by_tag',
      args: { dimension: 'gender', label: '不存在的标签' },
      expected: { ok: false, error: { kind: 'not-found' } },
    },
    {
      tool: 'search_similar_products',
      args: { spu: 'SPU-001', topN: 5 },
      expected: { ok: true, data: { spu: 'SPU-001', total: 1 } },
    },
  ];

  for (const item of baseline) {
    test(`${item.tool} ${JSON.stringify(item.args)} 与 main 基线一致`, async () => {
      const payload = await call(client, item.tool, item.args);
      assertSubset(payload, item.expected);
    });
  }
});
