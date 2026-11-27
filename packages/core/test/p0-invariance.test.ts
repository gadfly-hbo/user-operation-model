import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from '../src/index.js';
import { createFixtureIndexRoot } from './helpers/fixtures.js';

/**
 * 现状不变性、依赖边界与投影登记约束。
 *
 * - 现状不变性：无任何新表时，索引关键字段与 main 基线逐字一致
 * - DC10：不新增第三方依赖，新代码零出网
 * - DC11：新标签／新维度不登记映射表就不参与投影
 */

/** main 基线快照（在 main 分支上抓取，见 openspec/changes/p0-data-completion/result.md）。 */
const MAIN_BASELINE = {
  months: ['2024-07~2025-06', '2025-07~2026-06'],
  productCount: 6,
  productSpus: ['SPU-001', 'SPU-002', 'SPU-003', 'SPU-004', 'SPU-005', 'SPU-006'],
  productPrice: {
    'SPU-001': { tagPrice: 199 },
    'SPU-002': { tagPrice: 299 },
    'SPU-003': { tagPrice: 599 },
    'SPU-004': { tagPrice: 259 },
    'SPU-005': { tagPrice: 399 },
    'SPU-006': { tagPrice: 279 },
  } as Record<string, Record<string, number>>,
  channelCount: 2,
  channelIds: ['D00001', 'D00002'],
  portraitCount: 5,
  portraits: [
    { entityType: 'channel', entityId: '演示账号1', month: '2025-07~2026-06', platform: 'tmall', dimensions: ['gender'] },
    { entityType: 'channel', entityId: '演示账号1', month: '2025-07~2026-06', platform: 'douyin', dimensions: ['age', 'city_tier', 'gender', 'life_stage', 'spending_power', 'strategy_segment'] },
    { entityType: 'channel', entityId: '演示旗舰店', month: '2024-07~2025-06', platform: 'douyin', dimensions: ['gender', 'strategy_segment'] },
    { entityType: 'product', entityId: 'SPU-001', month: '', platform: 'douyin', dimensions: ['gender', 'spending_power', 'strategy_segment'] },
    { entityType: 'product', entityId: 'SPU-002', month: '', platform: 'douyin', dimensions: ['gender', 'strategy_segment'] },
  ],
  unavailable: {
    get_brand_portrait:
      '品牌人群画像未接入：期望 data/domains/01_品牌信息/ 下有品牌画像文件（当前只有品牌清单）',
    get_competitor_portrait:
      '竞品人群画像未接入：期望 data/domains/07_人群画像/竞品/ 下有竞品画像文件',
    get_funnel:
      '生命周期漏斗未接入：期望按款按月的浏览／收藏／加购／购买／直接购买／退货数据（data/tables/funnel.csv）',
    list_member_features:
      '会员特征字典未接入：期望业务方案 §5.2 的字段表（data/tables/member-features.csv）',
    get_retention_cohort:
      'Cohort 留存数据未接入：期望按首购月份分群的 Day30/60/90 留存（data/retention/cohort.csv）',
    get_recency_distribution:
      '老客 Recency 分布未接入：期望按上次购买时间切片的回购人数（data/retention/recency.csv）',
    get_channel_flow_matrix:
      '老客跨渠道流转矩阵未接入：期望来源渠道→回购渠道的流转矩阵（data/retention/channel-flow.csv）',
    get_diagnosis:
      '三大诊断数据未接入：期望二回断崖／虚假繁荣／清仓客跃迁的判定输入（data/retention/diagnosis.csv）',
  },
};

/** 画像快照的排序键（与实现无关，避免依赖目录遍历顺序）。 */
function portraitKey(item: {
  entityType: string;
  entityId: string;
  month: string;
  platform: string;
}): string {
  return `${item.entityType}|${item.entityId}|${item.month}|${item.platform}`;
}

describe('现状不变性', () => {
  test('无任何新表时索引关键字段与 main 基线一致', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });

    assert.deepEqual([...index.months].sort(), MAIN_BASELINE.months);
    assert.equal(index.products.length, MAIN_BASELINE.productCount);
    assert.deepEqual(
      index.products.map((product) => product.spu).sort(),
      MAIN_BASELINE.productSpus,
    );
    for (const product of index.products) {
      assert.deepEqual(product.price ?? {}, MAIN_BASELINE.productPrice[product.spu] ?? {});
    }
    assert.equal(index.channels.length, MAIN_BASELINE.channelCount);
    assert.deepEqual(index.channels.map((channel) => channel.channelId).sort(), MAIN_BASELINE.channelIds);
    assert.equal(index.portraits.length, MAIN_BASELINE.portraitCount);

    const portraits = index.portraits
      .map((portrait) => ({
        entityType: portrait.entityType,
        entityId: portrait.entityId,
        month: portrait.month,
        platform: Object.keys(portrait.platformLabels).join(','),
        dimensions: Object.keys(portrait.projections).sort(),
      }))
      .sort((left, right) => portraitKey(left).localeCompare(portraitKey(right)));
    const expected = [...MAIN_BASELINE.portraits].sort((left, right) =>
      portraitKey(left).localeCompare(portraitKey(right)),
    );
    assert.deepEqual(portraits, expected);
  });

  test('无任何新表时未就位工具的说明与 main 一致', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    assert.deepEqual(index.unavailable, MAIN_BASELINE.unavailable);
  });

  test('无任何新表时索引不出现新表字段', async () => {
    const root = await createFixtureIndexRoot();
    const index = await buildIndex({ dataRoot: root });
    for (const key of [
      'entityAliases',
      'portraitConflicts',
      'productChannels',
      'aggregateGroups',
      'productPerformance',
      'channelPerformance',
      'funnel',
      'memberFeatures',
      'cohort',
      'recency',
      'channelFlow',
      'diagnosis',
      'competitorPortraits',
    ]) {
      assert.equal(
        (index as unknown as Record<string, unknown>)[key],
        undefined,
        `无新表时索引不应带 ${key}`,
      );
    }
  });
});

describe('DC10 依赖与出网边界', () => {
  test('归一化层新代码只依赖 node 内置、exceljs 与包内模块', () => {
    const dir = new URL('../../src/normalize/', import.meta.url);
    const files = listFiles(dir);
    assert.ok(files.length > 0, '应能读到归一化层源码');
    const allowed = new Set(['exceljs']);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('.')) continue;
        assert.ok(
          allowed.has(specifier),
          `${file} 引入了未登记的第三方依赖：${specifier}`,
        );
      }
    }
  });

  test('包依赖清单未被扩张', () => {
    const core = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(core.dependencies ?? {}).sort(), ['exceljs']);

    const mcp = JSON.parse(
      readFileSync(
        new URL('../../../data-mcp/package.json', import.meta.url),
        'utf8',
      ),
    ) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(mcp.dependencies ?? {}).sort(), [
      '@modelcontextprotocol/server',
      '@uom/core',
      'zod',
    ]);
  });

  test('新代码不含网络调用', () => {
    const dir = new URL('../../src/normalize/', import.meta.url);
    for (const file of listFiles(dir)) {
      const source = readFileSync(file, 'utf8');
      for (const forbidden of ['node:http', 'node:https', 'node:net', 'fetch(', 'XMLHttpRequest']) {
        assert.ok(
          !source.includes(forbidden),
          `${file} 出现了疑似出网调用：${forbidden}`,
        );
      }
    }
  });
});

describe('DC11 未登记不投影', () => {
  test('未登记的原生维度不投影，保留在平台原生标签并记 issue', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uom-dc11-'));
    const dir = join(root, 'domains', '07_人群画像', '抖音');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2507-2606_神秘实体画像数据_抖音.csv'),
      [
        '标签类型,标签,2507-2606神秘实体-占比,2507-2606神秘实体-tgi',
        '预测性别,男,40.00%,100.00',
        '神秘新维度,甲,30.00%,120.00',
      ].join('\n'),
      'utf8',
    );
    const index = await buildIndex({ dataRoot: root });
    const portrait = index.portraits[0];
    assert.ok(portrait);
    assert.equal(portrait!.projections['神秘新维度'], undefined, '未登记维度不投影');
    assert.ok(portrait!.platformLabels['douyin']?.['神秘新维度'], '原生标签保留不丢数据');
    assert.ok(
      index.issues.some(
        (issue) => issue.kind === 'unmapped-dimension' && issue.sourceDimension === '神秘新维度',
      ),
      '应记 unmapped-dimension',
    );
  });

  test('已登记维度下未映射的标签不投影，记 unmapped-value', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uom-dc11b-'));
    const dir = join(root, 'domains', '07_人群画像', '抖音');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2507-2606_神秘实体画像数据_抖音.csv'),
      [
        '标签类型,标签,2507-2606神秘实体-占比,2507-2606神秘实体-tgi',
        '预测性别,男,40.00%,100.00',
        '预测性别,未知性别值,10.00%,120.00',
      ].join('\n'),
      'utf8',
    );
    const index = await buildIndex({ dataRoot: root });
    const portrait = index.portraits[0];
    assert.ok(portrait);
    assert.equal(
      portrait!.projections['gender']?.labels['未知性别值'],
      undefined,
      '未映射标签不投影',
    );
    assert.ok(
      index.issues.some(
        (issue) => issue.kind === 'unmapped-value' && issue.sourceLabel === '未知性别值',
      ),
      '应记 unmapped-value',
    );
  });
});

/** 递归列出目录下的文件。 */
function listFiles(dir: URL): string[] {
  const root = dir.pathname;
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out;
}

/** 取出源码里的 import 说明符（跳过 `import type` 的类型导入也一并检查，更严格）。 */
function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    out.push(match[1]!);
  }
  return out;
}
