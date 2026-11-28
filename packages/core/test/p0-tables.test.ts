import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  aggregatePortrait,
  buildIndex,
  channelEntityIds,
  selectPortrait,
  listProducts,
  NormalizationError,
  type DataIndex,
} from '../src/index.js';
import { createP0DataRoot, P0_TABLE_ROWS } from './helpers/fixtures.js';

/**
 * P0 数据收尾：新增表的解析与索引接入。
 *
 * 覆盖 DC01／DC02（解析器与错误路径）、DC04–DC09（别名／冲突／声明／
 * 关联／聚合／经营指标）。
 *
 * 测试一律走 `buildIndex` 真实入口：解析器是索引构建的一环，
 * 单元级「抛错」必须表现为索引构建失败，而不是静默空结果。
 */

/** 取索引里的新表（未接入时为 undefined）。 */
function table<T>(index: DataIndex, key: string): T[] | undefined {
  const holder = index as unknown as Record<string, unknown>;
  return holder[key] as T[] | undefined;
}

describe('漏斗表（DC01／DC02）', () => {
  test('文件到位时解析出真实行与指标', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ spu: string; month?: string; phase: string; metrics: Record<string, number>; missing: string[] }>(
      index,
      'funnel',
    );
    assert.ok(rows, '漏斗表应被接入索引');
    assert.equal(rows!.length, 3);
    const first = rows!.find((row) => row.spu === 'SPU-001' && row.month === '2026-01');
    assert.ok(first);
    assert.equal(first!.phase, 'launch');
    assert.equal(first!.metrics['浏览'], 1000);
    assert.equal(first!.metrics['购买'], 40);
    assert.equal(first!.metrics['直接购买'], 10);
  });

  test('缺失的指标列显式标记为缺失，不插补 0', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ spu: string; missing: string[]; metrics: Record<string, number> }>(index, 'funnel');
    const second = rows!.find((row) => row.spu === 'SPU-002');
    assert.ok(second);
    assert.ok(second!.missing.includes('退货'), '缺失的指标应被显式标记');
    assert.equal(second!.metrics['退货'], undefined, '缺失指标不得落位为 0');
  });

  test('空文件抛 NormalizationError，不返回空结果', async () => {
    const root = await createP0DataRoot({ tables: { 'tables/funnel.csv': [] } });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });

  test('只有表头没有数据行抛 NormalizationError', async () => {
    const root = await createP0DataRoot({
      tables: { 'tables/funnel.csv': [P0_TABLE_ROWS['tables/funnel.csv']![0]!] },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });

  test('缺必要列（款号）抛 NormalizationError', async () => {
    const root = await createP0DataRoot({
      tables: {
        'tables/funnel.csv': [
          ['月份', '阶段', '浏览'],
          ['2026-01', 'launch', '1000'],
        ],
      },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });

  test('数值列不可解析抛 NormalizationError，不静默丢行', async () => {
    const root = await createP0DataRoot({
      tables: {
        'tables/funnel.csv': [
          P0_TABLE_ROWS['tables/funnel.csv']![0]!,
          ['SPU-001', '2026-01', 'launch', '一千', '100', '50', '40', '10', '2'],
        ],
      },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });

  test('千分位数值按真实值解析，不被静默截断', async () => {
    const root = await createP0DataRoot({
      tables: {
        'tables/funnel.csv': [
          P0_TABLE_ROWS['tables/funnel.csv']![0]!,
          ['SPU-001', '2026-01', 'launch', '1,000', '100', '50', '40', '10', '2'],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ metrics: Record<string, number> }>(index, 'funnel');
    assert.equal(rows![0]!.metrics['浏览'], 1000, '千分位不得被截断成 1');
  });

  test('数值列部分匹配（如 1000元）抛错，不静默接受', async () => {
    const root = await createP0DataRoot({
      tables: {
        'tables/funnel.csv': [
          P0_TABLE_ROWS['tables/funnel.csv']![0]!,
          ['SPU-001', '2026-01', 'launch', '1000元', '100', '50', '40', '10', '2'],
        ],
      },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });
});

describe('会员特征字典（DC01／DC02）', () => {
  test('解析出特征字段与层级分组', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ field: string; value: string; level?: string; segment?: string }>(
      index,
      'memberFeatures',
    );
    assert.ok(rows);
    assert.equal(rows!.length, 4);
    const rfm = rows!.find((row) => row.field === '最近购买间隔天数');
    assert.ok(rfm);
    assert.equal(rfm!.level, '行为派生');
    assert.equal(rfm!.segment, 'RFM');
  });

  test('缺必要列（特征值）抛 NormalizationError', async () => {
    const root = await createP0DataRoot({
      tables: {
        'tables/member-features.csv': [
          ['特征层级', '特征字段'],
          ['行为派生', '最近购买间隔天数'],
        ],
      },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });
});

describe('留存四表（DC01／DC02）', () => {
  test('Cohort 留存按首购月份与指标解析', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ cohortMonth: string; buyers?: number; metrics: Record<string, number> }>(
      index,
      'cohort',
    );
    assert.ok(rows);
    assert.equal(rows!.length, 2);
    const january = rows!.find((row) => row.cohortMonth === '2026-01');
    assert.ok(january);
    assert.equal(january!.buyers, 1000);
    assert.ok(Math.abs((january!.metrics['day30'] ?? 0) - 0.355) < 1e-9, '留存率按占比口径解析');
  });

  test('Recency 分布解析切片与缺失的毛利率', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ month?: string; bucket: string; buyers?: number; grossMargin?: number }>(
      index,
      'recency',
    );
    assert.ok(rows);
    assert.equal(rows!.length, 3);
    const dormant = rows!.find((row) => row.bucket === '>365');
    assert.ok(dormant);
    assert.equal(dormant!.month, '2026-01');
    assert.equal(dormant!.grossMargin, undefined, '空毛利率不插补');
  });

  test('跨渠道流转矩阵解析来源与回购渠道', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ month?: string; from: string; to: string; buyers?: number }>(index, 'channelFlow');
    assert.ok(rows);
    assert.equal(rows!.length, 3);
    const cross = rows!.find((row) => row.to === '天猫');
    assert.ok(cross);
    assert.equal(cross!.from, '抖音直播');
    assert.equal(cross!.buyers, 30);
  });

  test('三大诊断按类型解析各自指标', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    const rows = table<{ type: string; metrics: Record<string, number>; missing: string[] }>(
      index,
      'diagnosis',
    );
    assert.ok(rows);
    assert.equal(rows!.length, 3);
    const cliff = rows!.find((row) => row.type === '二回断崖');
    assert.ok(cliff);
    assert.ok(Math.abs((cliff!.metrics['大促新客第60天二回比例'] ?? 0) - 0.18) < 1e-9);
    assert.ok(cliff!.missing.includes('加购率'), '不适用于该类型的指标显式标记缺失');
  });

  test('留存表只有表头时抛 NormalizationError', async () => {
    const root = await createP0DataRoot({
      tables: { 'retention/cohort.csv': [P0_TABLE_ROWS['retention/cohort.csv']![0]!] },
    });
    await assert.rejects(
      () => buildIndex({ dataRoot: root }),
      (error: unknown) => error instanceof NormalizationError,
    );
  });
});

describe('实体别名目录（DC04）', () => {
  test('别名目录存在时画像实体名先归一再关联渠道', async () => {
    const root = await createP0DataRoot({ include: ['tables/entity-alias.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const aliases = table<{ canonical: string; alias: string; channelId?: string }>(index, 'entityAliases');
    assert.ok(aliases);
    assert.equal(aliases!.length, 1);
    assert.equal(aliases![0]!.canonical, '演示账号3');
    assert.equal(aliases![0]!.alias, '演示账号3旗舰店');
    assert.equal(aliases![0]!.channelId, 'D00003');

    // 画像实体名被归一为规范名
    const selection = selectPortrait(index, {
      entityType: 'channel',
      entityIds: channelEntityIds(index, 'D00003'),
    });
    assert.ok(selection.status === 'found', '别名归一后 D00003 应能关联到画像');
    if (selection.status === 'found') {
      assert.equal(selection.portrait.entityId, '演示账号3');
    }
  });

  test('别名目录不存在时行为与现状一致：关联不上，且不改画像实体名', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    assert.equal(table(index, 'entityAliases'), undefined);
    const selection = selectPortrait(index, {
      entityType: 'channel',
      entityIds: channelEntityIds(index, 'D00003'),
    });
    assert.equal(selection.status, 'not-found', '无别名目录时不应凭空关联上');
    const raw = index.portraits.find((item) => item.entityId === '演示账号3旗舰店');
    assert.ok(raw, '画像实体名保持原样');
  });

  test('别名目录反查规范名：渠道店铺名是别名时也能关联', async () => {
    const root = await createP0DataRoot({ include: ['tables/entity-alias.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const ids = channelEntityIds(index, 'D00003');
    assert.ok(ids.includes('演示账号3'), '渠道候选标识应含规范名');
  });
});

describe('跨文件冲突显式映射（DC05）', () => {
  test('映射表存在时按处置保留一侧', async () => {
    const root = await createP0DataRoot({
      include: ['tables/portrait-conflicts.csv'],
      conflictResolution: 'keep-a',
    });
    const index = await buildIndex({ dataRoot: root });
    const matched = index.portraits.filter(
      (portrait) => portrait.entityId === '演示账号1' && portrait.month === '2025-07~2026-06',
    );
    assert.equal(matched.length, 1, 'keep-a 应只保留平台A的画像');
    assert.deepEqual(Object.keys(matched[0]!.platformLabels), ['douyin']);
    assert.ok(
      index.issues.some(
        (issue) => issue.kind === 'conflict' && issue.message.includes('冲突映射'),
      ),
      '冲突处置应留下可追溯记录',
    );
  });

  test('处置为 manual 时两侧都保留并提示人工处理', async () => {
    const root = await createP0DataRoot({
      include: ['tables/portrait-conflicts.csv'],
      conflictResolution: 'manual',
    });
    const index = await buildIndex({ dataRoot: root });
    const matched = index.portraits.filter(
      (portrait) => portrait.entityId === '演示账号1' && portrait.month === '2025-07~2026-06',
    );
    assert.equal(matched.length, 2, 'manual 不做隐式合并');
    assert.ok(
      index.issues.some((issue) => issue.message.includes('人工')),
      'manual 处置应提示人工处理',
    );
  });

  test('映射表不存在时保持现状：两侧都保留且记冲突，不隐式合并', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    const matched = index.portraits.filter(
      (portrait) => portrait.entityId === '演示账号1' && portrait.month === '2025-07~2026-06',
    );
    assert.equal(matched.length, 2, '无映射表时不做隐式合并');
    assert.ok(
      index.issues.some(
        (issue) =>
          issue.kind === 'conflict' &&
          issue.message.includes('演示账号1') &&
          issue.message.includes('未做隐式合并'),
      ),
      '应记 conflict issue 并说明未做隐式合并',
    );
  });
});

describe('README 时间范围声明（DC06）', () => {
  test('声明填写后索引只覆盖声明范围，范围外记 issue 跳过', async () => {
    const root = await createP0DataRoot({
      include: [],
      declaration: { months: '2025-07 ~ 2026-06', channels: 'D00001', products: 'SPU-001 SPU-002' },
    });
    const index = await buildIndex({ dataRoot: root });
    const declaration = index.declaration;
    assert.ok(declaration);
    assert.equal(declaration!.declared, true);
    assert.deepEqual(declaration!.months, [
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ]);

    // 渠道范围裁剪
    assert.equal(index.channels.length, 1);
    assert.equal(index.channels[0]!.channelId, 'D00001');
    // 商品范围裁剪
    assert.equal(index.products.length, 2);
    assert.deepEqual(index.products.map((product) => product.spu).sort(), ['SPU-001', 'SPU-002']);
    // 被裁掉的记录要留下 issue
    assert.ok(
      index.issues.some((issue) => issue.message.includes('D00002')),
      '范围外的渠道应被记 issue',
    );
  });

  test('声明未填写时保持现状，并在索引里记录「未声明」', async () => {
    const root = await createP0DataRoot({ include: [], declaration: {} });
    const index = await buildIndex({ dataRoot: root });
    const declaration = index.declaration;
    assert.ok(declaration);
    assert.equal(declaration!.declared, false);
    assert.ok(
      declaration!.notes.some((note) => note.includes('未声明')),
      '索引应记录「未声明」',
    );
    assert.equal(index.channels.length, 3, '未声明时不裁剪渠道');
    assert.equal(index.products.length, 3, '未声明时不裁剪商品');
  });

  test('声明的月份范围外画像被跳过并记 issue', async () => {
    const root = await createP0DataRoot({
      include: [],
      declaration: { months: '2026-01 ~ 2026-06' },
    });
    const index = await buildIndex({ dataRoot: root });
    const outOfRange = index.portraits.filter(
      (portrait) => portrait.month === '2025-07~2026-06',
    );
    assert.equal(outOfRange.length, 0, '范围外画像应被跳过');
    assert.ok(
      index.issues.some((issue) => issue.message.includes('2025-07~2026-06')),
      '跳过的画像应留下 issue',
    );
  });
});

describe('商品 ↔ 渠道关联（DC07）', () => {
  test('关联表存在时按渠道过滤商品可用', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-channel.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const links = table<{ spu: string; channelId: string; month?: string; retailAmount?: number }>(
      index,
      'productChannels',
    );
    assert.ok(links);
    assert.equal(links!.length, 3);

    const filtered = listProducts(index, { channel: 'D00001' });
    assert.deepEqual(filtered.map((product) => product.spu).sort(), ['SPU-001', 'SPU-002']);
  });

  test('关联表不存在时按渠道过滤返回空（现状：MCP 层报 data-not-ready）', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    assert.equal(table(index, 'productChannels'), undefined);
    assert.equal(listProducts(index, { channel: 'D00001' }).length, 0);
    assert.equal(listProducts(index).length, 3, '不带渠道过滤时不受影响');
  });
});

describe('聚合口径表（DC08）', () => {
  test('口径表存在时支持 series／hot／ip 层级', async () => {
    const root = await createP0DataRoot({ include: ['tables/aggregate-groups.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const series = aggregatePortrait(index, { level: 'series', key: '基础系列' });
    assert.ok(series, '系列层级应可聚合');
    assert.equal(series!.entityType, 'series');
    assert.ok(series!.projections.gender, '聚合结果应含统一维度投影');

    const hot = aggregatePortrait(index, { level: 'hot', key: '爆款A' });
    assert.ok(hot);
    assert.equal(hot!.entityType, 'hot');

    const ip = aggregatePortrait(index, { level: 'ip', key: '热播IP' });
    assert.ok(ip);
    assert.equal(ip!.entityType, 'ip');
  });

  test('口径表不存在时非 category 层级返回 undefined（现状）', async () => {
    const root = await createP0DataRoot({ include: [] });
    const index = await buildIndex({ dataRoot: root });
    assert.equal(aggregatePortrait(index, { level: 'series', key: '基础系列' }), undefined);
    assert.equal(aggregatePortrait(index, { level: 'category', key: '短袖T恤' })?.entityType, 'category');
  });
});

describe('经营指标接入（DC09）', () => {
  test('商品经营指标按月填充 performance，缺失字段不插补', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.ok(product?.performance?.['2026-01'], '指标应落在该月键下');
    assert.ok(Math.abs((product!.performance!['2026-01']!.sellThroughRate ?? 0) - 0.8) < 1e-9);
    assert.ok(Math.abs((product!.performance!['2026-01']!.grossMargin ?? 0) - 0.45) < 1e-9);
    assert.equal(product!.performance!['2026-01']!.uv, 5000);

    const partial = index.products.find((item) => item.spu === 'SPU-002');
    assert.ok(partial?.performance?.['2026-01']);
    assert.equal(partial!.performance!['2026-01']!.sellThroughRate, undefined, '缺失的售罄率不插补');
    assert.equal(partial!.performance!['2026-01']!.grossMargin, undefined, '缺失的毛利率不插补');
    assert.equal(partial!.performance!['2026-01']!.conversionRate, undefined, '缺失的转化率不插补');
    assert.ok(Math.abs((partial!.performance!['2026-01']!.returnRate ?? 0) - 0.06) < 1e-9);
  });

  test('按月指标的零售额／零售量落在 performance 键下（SA-08：不再写回 price）', async () => {
    const root = await createP0DataRoot({ include: ['tables/product-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.equal(product?.performance?.['2026-01']?.retailAmount, 12000);
    assert.equal(product?.performance?.['2026-01']?.retailQty, 60);
    assert.equal(product?.price?.actualUnitPrice, undefined, '单价解析统一走 resolveUnitPrice');
  });

  test('缺零售量时该月指标不带零售量，不推出成交单价', async () => {
    const root = await createP0DataRoot({
      include: ['tables/product-performance.csv'],
      tables: {
        'tables/product-performance.csv': [
          P0_TABLE_ROWS['tables/product-performance.csv']![0]!,
          ['SPU-001', '2026-01', '12000', '', '80%', '5%', '3%', '45%', '5000', '2.5%'],
        ],
      },
    });
    const index = await buildIndex({ dataRoot: root });
    const product = index.products.find((item) => item.spu === 'SPU-001');
    assert.equal(product?.performance?.['2026-01']?.retailQty, undefined, '缺零售量不落位');
    assert.equal(product?.price?.actualUnitPrice, undefined, '缺零售量不推出成交单价');
  });

  test('渠道经营指标填充渠道档案，缺失字段不插补', async () => {
    const root = await createP0DataRoot({ include: ['tables/channel-performance.csv'] });
    const index = await buildIndex({ dataRoot: root });
    const channel = index.channels.find((item) => item.channelId === 'D00001');
    assert.ok(channel?.performance);
    assert.equal(channel!.performance!.gmv, 50000);
    assert.equal(channel!.performance!.orderCount, 200);
    assert.ok(Math.abs((channel!.performance!.conversionRate ?? 0) - 0.03) < 1e-9);

    const second = index.channels.find((item) => item.channelId === 'D00002');
    assert.ok(second?.performance);
    assert.equal(second!.performance!.grossMargin, undefined, '缺失的毛利率不插补');
  });
});

describe('新表接入不破坏既有索引', () => {
  test('新增表存在时商品与渠道档案仍完整', async () => {
    const root = await createP0DataRoot();
    const index = await buildIndex({ dataRoot: root });
    assert.equal(index.products.length, 3);
    assert.equal(index.channels.length, 3);
    assert.ok(index.portraits.length >= 5);
  });

  test('README 声明不存在时按未声明处理', async () => {
    const root = await createP0DataRoot({ include: [], declaration: null });
    const index = await buildIndex({ dataRoot: root });
    assert.equal(index.declaration?.declared, false);
  });

  test('索引构建不写文件（数据不出网、不产生副作用）', async () => {
    const root = await createP0DataRoot();
    const before = new Set(readDirDeep(root));
    await buildIndex({ dataRoot: root });
    const after = new Set(readDirDeep(root));
    assert.deepEqual([...after].sort(), [...before].sort());
  });
});

function readDirDeep(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out;
}
