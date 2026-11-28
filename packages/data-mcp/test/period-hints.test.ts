import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { buildIndex } from '@uom/core';
import { createServer } from '../src/index.js';

/**
 * 复核修正（run4）· MCP 提示与覆盖口径。
 *
 * - 应修 1／2：歧义与 month-mismatch 的 hint 按 selection.reason 分支，
 *   且「可用期间」由 `describeAvailablePeriods` 表达——区间／年份标签
 *   不再被当作可直接传入的 month（入参校验会拒绝它们）。
 * - 应修 6（建议 10 升级）：`get_competitor_portrait` 的 month 改为与其它工具
 *   同源的覆盖规则；无月份画像作为最低层保留并标 `match: "unknown"`。
 * - 建议 2 升级：无月份画像在 dossier／search_by_tag／aggregate 带 month 时
 *   不再被直接排除（与 selectPortrait／list_channels 同口径）。
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

async function writeSheet(path: string, rows: (string | number)[][]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('明细');
  for (const row of rows) sheet.addRow(row);
  await workbook.xlsx.writeFile(path);
}

function writeCsv(path: string, rows: string[][]): void {
  const body = rows.map((row) => row.join(',')).join('\r\n');
  writeFileSync(path, `﻿${body}`, 'utf8');
}

/** 夹具：区间／年份标签画像 + 无月份画像 + 同实体不同区间的双平台画像。 */
async function createHintsDataRoot(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'uom-mcp-hints-'));
  const domains = join(root, 'domains');
  const douyinDir = join(domains, '07_人群画像', '抖音');
  const tmallDir = join(domains, '07_人群画像', '天猫');
  const competitorDir = join(domains, '07_人群画像', '竞品');
  mkdirSync(join(domains, '04_商品信息'), { recursive: true });
  mkdirSync(join(domains, '02_渠道信息'), { recursive: true });
  mkdirSync(douyinDir, { recursive: true });
  mkdirSync(tmallDir, { recursive: true });
  mkdirSync(competitorDir, { recursive: true });

  await writeSheet(join(domains, '04_商品信息', '商品宽表.xlsx'), [
    ['款号', '商品品牌', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位'],
    ['SPU-001', '演示品牌', '2026', '短袖T恤', 'T恤', '199', '100001', '18-24岁', 'ACCESS'],
    ['SPU-003', '演示品牌', '2026', '短袖T恤', 'T恤', '299', '100003', '18-24岁', 'ACCESS'],
    ['SPU-004', '演示品牌', '2026', '短袖T恤', 'T恤', '399', '100004', '18-24岁', 'ACCESS'],
    ['SPU-005', '演示品牌', '2026', '短袖T恤', 'T恤', '499', '100005', '18-24岁', 'ACCESS'],
  ]);
  await writeSheet(join(domains, '02_渠道信息', '渠道店铺宽表.xlsx'), [
    ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
    ['演示品牌', '内容渠道', 'D00001', '演示账号1', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00004', '演示账号4', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00005', '演示账号5', '天猫', '天猫', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00006', '演示账号6', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00007', '演示账号7', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00008', '演示账号8', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
    ['演示品牌', '内容渠道', 'D00009', '演示账号9', '抖音', '抖音', '核心店', '上海', '营业', '2024-01-01'],
  ]);

  const genderRows = (columnPrefix: string, male: string): string[][] => [
    ['标签类型', '标签', `${columnPrefix}-占比`, `${columnPrefix}-tgi`],
    ['预测性别', '男', male, '100.00'],
    ['预测性别', '女', '50.00%', '100.00'],
  ];

  // 演示账号4（复核应修-1 复现形态）：抖音 2026-07~2026-09 + 天猫 2026-08~2026-10
  // 抖音长表的月份取自列名前缀（<期间><实体>-占比），文件名与列名须一致
  writeCsv(join(douyinDir, '2607-2609_演示账号4画像数据_抖音.csv'), genderRows('2607-2609演示账号4', '40.00%'));
  await writeSheet(join(tmallDir, '2608-2610_演示账号4画像数据_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '35.00%'],
    ['预测性别', '女', '65.00%'],
  ]);

  // 演示账号5：同平台两份区间画像（不带 month → ambiguous(month)，标签是区间）
  writeCsv(join(douyinDir, '2501-2506_演示账号5画像数据_抖音.csv'), genderRows('2501-2506演示账号5', '45.00%'));
  writeCsv(join(douyinDir, '2507-2512_演示账号5画像数据_抖音.csv'), genderRows('2507-2512演示账号5', '55.00%'));

  // 演示账号6：年份导出（标签为全年区间）；tmall 画像的月份取自文件名，
  // 抖音长表列名解析不了四位年份，因此年份画像用天猫 xlsx 形态
  await writeSheet(join(tmallDir, '2024_演示账号6画像数据_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '60.00%'],
    ['预测性别', '女', '40.00%'],
  ]);

  // 演示账号1：2026-09 与 2026-10 两个单月画像（month-mismatch 提示用）
  writeCsv(join(douyinDir, '2026-09_演示账号1画像数据_抖音.csv'), genderRows('2026-09演示账号1', '40.00%'));
  writeCsv(join(douyinDir, '2026-10_演示账号1画像数据_抖音.csv'), genderRows('2026-10演示账号1', '30.00%'));

  // SPU-003：只有无月份画像（建议 2 升级：带 month 查询仍可用）
  writeCsv(join(douyinDir, '款号SPU-003_抖音.csv'), genderRows('SPU-003', '70.00%'));

  // SPU-004：两份无月份画像、平台不同（第二轮复核 N2 · aggregate 成员歧义的 months=[] 形态）
  writeCsv(join(douyinDir, '款号SPU-004_抖音.csv'), genderRows('SPU-004', '75.00%'));
  await writeSheet(join(tmallDir, '款号SPU-004_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '25.00%'],
    ['预测性别', '女', '75.00%'],
  ]);

  // SPU-005：无月份 + 2026-10、同平台（第二轮复核 N2 · C4 的商品侧形态）
  writeCsv(join(douyinDir, '款号SPU-005_抖音.csv'), genderRows('SPU-005', '70.00%'));
  writeCsv(join(douyinDir, '2026-10_款号SPU-005_抖音.csv'), genderRows('2026-10SPU-005', '60.00%'));

  // 演示账号7（第二轮复核 N2 · C3）：两份无月份画像、平台不同、不带 month
  writeCsv(join(douyinDir, '演示账号7画像数据_抖音.csv'), genderRows('演示账号7', '40.00%'));
  await writeSheet(join(tmallDir, '演示账号7画像数据_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '35.00%'],
    ['预测性别', '女', '65.00%'],
  ]);

  // 演示账号8（第二轮复核 N2 · C4）：无月份 + 2026-10、同平台、不带 month
  writeCsv(join(douyinDir, '演示账号8画像数据_抖音.csv'), genderRows('演示账号8', '40.00%'));
  writeCsv(join(douyinDir, '2026-10_演示账号8画像数据_抖音.csv'), genderRows('2026-10演示账号8', '30.00%'));

  // 演示账号9（第二轮复核 N2 · C5）：无月份（抖音）+ 2026-10（天猫）、不带 month
  writeCsv(join(douyinDir, '演示账号9画像数据_抖音.csv'), genderRows('演示账号9', '40.00%'));
  await writeSheet(join(tmallDir, '2026-10_演示账号9画像数据_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '45.00%'],
    ['预测性别', '女', '55.00%'],
  ]);

  // 竞品：一份年份画像（tmall xlsx，月份取自文件名）+ 一份无月份画像（抖音 csv）
  await writeSheet(join(competitorDir, '2024_竞品甲画像数据_天猫.xlsx'), [
    ['标签类型', '一级标签(标签值)', '占比'],
    ['预测性别', '男', '30.00%'],
    ['预测性别', '女', '70.00%'],
  ]);
  writeCsv(join(competitorDir, '竞品乙画像数据_抖音.csv'), genderRows('竞品乙', '80.00%'));

  return root;
}

before(async () => {
  const dataRoot = await createHintsDataRoot();
  const index = await buildIndex({ dataRoot });
  const server = createServer(index);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'uom-hints-test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

after(async () => {
  await client?.close();
});

describe('复核应修-1 · 平台歧义的 hint 指向 platform，不再误指 month', () => {
  test('最优层为不同区间标签的双平台画像：查 2026-09 → ambiguous，hint 提示传 platform', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00004', month: '2026-09' });
    assert.equal(payload.ok, false, JSON.stringify(payload));
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.message.includes('douyin'), 'message 应列出平台');
    assert.ok(payload.error?.message.includes('tmall'), 'message 应列出平台');
    assert.ok(payload.error?.hint?.includes('platform'), 'hint 应提示传 platform');
    assert.ok(
      !payload.error?.hint?.includes('传 month'),
      `hint 不得误指 month（调用方已传）：${payload.error?.hint}`,
    );
    assert.ok(
      !payload.error?.hint?.includes('可用月份'),
      `平台歧义的 hint 不应列「可用月份」：${payload.error?.hint}`,
    );
  });
});

describe('复核应修-2 · hint 的「可用期间」不能是入参校验拒绝的值', () => {
  test('同平台两份区间画像的歧义：hint 说明区间内自然月，不把区间标签当可用月份', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00005' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('传 month'), '跨月歧义应提示传 month');
    assert.ok(payload.error?.hint?.includes('2025-01~2025-06'), 'hint 应列出画像区间标签');
    assert.ok(payload.error?.hint?.includes('自然月'), `hint 应说明只能传区间内自然月：${payload.error?.hint}`);
    assert.ok(
      !payload.error?.hint?.includes('可用月份：2025-01~2025-06'),
      `区间标签不得被列为可用月份：${payload.error?.hint}`,
    );
  });

  test('单月标签仍直接列为可用月份', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00001', month: '2026-11' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'month-mismatch');
    assert.ok(
      payload.error?.hint?.includes('可用月份：2026-09、2026-10'),
      `单月标签应列为可用月份：${payload.error?.hint}`,
    );
  });

  test('只有年份画像的渠道查无覆盖月份：hint 说明须为全年区间内的自然月', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00006', month: '2025-06' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'month-mismatch');
    assert.ok(payload.error?.hint?.includes('2024-01~2024-12'), 'hint 应列出年份区间标签');
    assert.ok(payload.error?.hint?.includes('自然月'), `hint 应说明自然月要求：${payload.error?.hint}`);
  });
});

describe('复核应修-6 · get_competitor_portrait 的 month 走覆盖规则', () => {
  test('年份画像覆盖查询月即可命中（不再按字面相等）', async () => {
    const payload = await call('get_competitor_portrait', { brand: '竞品甲', month: '2024-06' });
    assert.equal(payload.ok, true, `年份画像应覆盖 2024-06：${JSON.stringify(payload.error)}`);
    const data = payload.data as { portraits: { month: string; match?: string }[] };
    assert.equal(data.portraits.length, 1);
    assert.equal(data.portraits[0]?.month, '2024-01~2024-12');
    assert.equal(data.portraits[0]?.match, 'year');
  });

  test('无月份画像作为最低层保留，match 为 unknown', async () => {
    const payload = await call('get_competitor_portrait', { brand: '竞品乙', month: '2026-01' });
    assert.equal(payload.ok, true, `无月份画像应作为最低层命中：${JSON.stringify(payload.error)}`);
    const data = payload.data as { portraits: { month: string; match?: string }[] };
    assert.equal(data.portraits.length, 1);
    assert.equal(data.portraits[0]?.month, '');
    assert.equal(data.portraits[0]?.match, 'unknown');
  });

  test('不带 month 行为不变', async () => {
    const payload = await call('get_competitor_portrait', { brand: '竞品乙' });
    assert.equal(payload.ok, true);
    const data = payload.data as { portraits: { match?: string }[] };
    assert.equal(data.portraits.length, 1);
    assert.equal(data.portraits[0]?.match, undefined, '不带 month 不产生 match 字段');
  });
});

describe('复核建议 2 升级 · 无月份画像在带 month 的各工具间口径一致', () => {
  test('get_product_dossier 带 month 仍返回无月份画像（不再 month-mismatch）', async () => {
    const payload = await call('get_product_dossier', { spu: 'SPU-003', month: '2026-10' });
    assert.equal(payload.ok, true, `无月份画像应按最低层可用：${JSON.stringify(payload.error)}`);
    const data = payload.data as { portraits: { month: string; match?: string }[] };
    assert.equal(data.portraits.length, 1);
    assert.equal(data.portraits[0]?.month, '');
    assert.equal(data.portraits[0]?.match, 'unknown');
  });

  test('search_by_tag 带 month 命中无月份画像且 match 为 unknown', async () => {
    const payload = await call('search_by_tag', {
      dimension: 'gender',
      label: '男',
      scope: 'product',
      month: '2026-10',
    });
    assert.equal(payload.ok, true);
    const data = payload.data as { hits: { entityId: string; month: string; match?: string }[] };
    const hit = data.hits.find((item) => item.entityId === 'SPU-003');
    assert.ok(hit, '无月份画像应命中');
    assert.equal(hit?.match, 'unknown');
  });

  test('get_portrait_aggregate 带 month 纳入无月份画像成员', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'category', key: '短袖T恤', month: '2026-10' });
    assert.equal(payload.ok, true, `聚合应纳入无月份画像：${JSON.stringify(payload.error)}`);
    const data = payload.data as { entityType: string };
    assert.equal(data.entityType, 'category');
  });
});

describe('第二轮复核 N1 · month 入参在 MCP 边界层严格校验（run5）', () => {
  test('dossier：尾部空白的 month → invalid-argument，不得静默返回空指标（D2 形态）', async () => {
    // SPU-003 有无月份画像：修前该入参返回 ok 且画像命中、经营指标静默落空
    const payload = await call('get_product_dossier', { spu: 'SPU-003', month: '2026-10 ' });
    assert.equal(payload.ok, false, `带空白 month 必须在边界层拒绝：${JSON.stringify(payload)}`);
    assert.equal(payload.error?.kind, 'invalid-argument');
    assert.ok(
      payload.error?.message.includes('month 必须是 YYYY-MM，收到 2026-10 '),
      `message 应沿用既有措辞并回显原值：${payload.error?.message}`,
    );
  });

  test('dossier：前导空白（D3 形态）与 YYMM（D4 形态）同样拒绝', async () => {
    for (const month of [' 2026-09', '2610']) {
      const payload = await call('get_product_dossier', { spu: 'SPU-003', month });
      assert.equal(payload.ok, false, `month=${month} 应被拒绝：${JSON.stringify(payload)}`);
      assert.equal(payload.error?.kind, 'invalid-argument', `month=${month} 的错误类型`);
    }
  });

  test('渠道画像入口同样先校验再查数据（2610 修前被当 2026-10 命中）', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00001', month: '2610' });
    assert.equal(payload.ok, false, `YYMM 写法应被拒绝：${JSON.stringify(payload)}`);
    assert.equal(payload.error?.kind, 'invalid-argument');
  });
});

describe('第二轮复核 N2 · 无月份画像形态的歧义提示（run5）', () => {
  test('C3：两份无月份画像、不同平台、不带 month → 提示传 platform，不误指 month', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00007' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.message.includes('douyin'), 'message 应列出平台');
    assert.ok(payload.error?.message.includes('tmall'), 'message 应列出平台');
    assert.ok(
      !payload.error?.message.includes('在  有多平台'),
      `无月份形态不得写成「在某月有多平台画像」：${payload.error?.message}`,
    );
    assert.ok(payload.error?.hint?.includes('传 platform'), `应提示传 platform：${payload.error?.hint}`);
    assert.ok(payload.error?.hint?.includes('可选平台：douyin、tmall'));
    assert.ok(
      !payload.error?.hint?.includes('没有可作为 month 的画像期间'),
      `months 为空时不得误导为「传 month」：${payload.error?.hint}`,
    );
  });

  test('C3b：按提示传 platform 即可命中（无月份画像按平台过滤后唯一）', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00007', platform: 'douyin' });
    assert.equal(payload.ok, true, `传 platform 应消歧：${JSON.stringify(payload.error)}`);
  });

  test('C4：无月份 + 2026-10、同平台、不带 month → 提示传 month（旧提示传 platform 是死循环）', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00008' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('传 month'), `单平台形态应提示传 month：${payload.error?.hint}`);
    assert.ok(
      payload.error?.hint?.includes('可用月份：2026-10'),
      `hint 应列出可用的单月标签：${payload.error?.hint}`,
    );
    assert.ok(
      !payload.error?.hint?.includes('platform'),
      `可选平台只有一个时不得提示传 platform：${payload.error?.hint}`,
    );
  });

  test('C4b：照 month 提示传 2026-10 命中 exact；照旧 platform 提示仍是歧义（死循环留存证明）', async () => {
    // 商品侧形态（dossier 的 portraits 带 match 字段）
    const withMonth = await call('get_product_dossier', { spu: 'SPU-005', month: '2026-10' });
    assert.equal(withMonth.ok, true, `传 month 应命中 exact 层：${JSON.stringify(withMonth.error)}`);
    const data = withMonth.data as { portraits: { month: string; match?: string }[] };
    // dossier 按「覆盖该月的全部画像」列出：2026-10 exact + 无月份 unknown 两层都在
    assert.equal(data.portraits.length, 2);
    const exact = data.portraits.find((portrait) => portrait.match === 'exact');
    assert.equal(exact?.month, '2026-10', 'exact 层在列，说明传 month 能按月取到该画像');

    const withPlatform = await call('get_channel_portrait', { channelId: 'D00008', platform: 'douyin' });
    assert.equal(withPlatform.ok, false, '只传 platform 无法消歧（同平台两份画像）');
    assert.equal(withPlatform.error?.kind, 'ambiguous');
  });

  test('C5：无月份 + 2026-10、不同平台、不带 month → 提示传 month，message 不说「在某月有多平台画像」', async () => {
    const payload = await call('get_channel_portrait', { channelId: 'D00009' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(payload.error?.hint?.includes('传 month'), `混合形态应提示传 month：${payload.error?.hint}`);
    assert.ok(
      !payload.error?.message.includes('有多平台画像'),
      `候选含无月份画像时不得说「在某月有多平台画像」：${payload.error?.message}`,
    );
  });

  test('S2：aggregate 成员全无月份（months=[]）的提示可操作，不再说「没有可作为 month 的画像期间」', async () => {
    const payload = await call('get_portrait_aggregate', { level: 'category', key: '短袖T恤' });
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'ambiguous');
    assert.ok(
      !payload.error?.hint?.includes('没有可作为 month 的画像期间'),
      `months 为空时该说法误导（传任意月份即可聚合）：${payload.error?.hint}`,
    );
    assert.ok(
      payload.error?.hint?.includes('任意月份'),
      `hint 应说明传任意月份即可：${payload.error?.hint}`,
    );

    const withMonth = await call('get_portrait_aggregate', {
      level: 'category',
      key: '短袖T恤',
      month: '2026-10',
    });
    assert.equal(withMonth.ok, true, `照提示传任意月份即可聚合：${JSON.stringify(withMonth.error)}`);
  });
});
