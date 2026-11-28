import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import {
  buildIndex,
  normalizeChannelTable,
  PRODUCT_FIELDS,
  TABLE_SPECS,
} from '../src/index.js';
import * as legacyFormats from '../src/normalize/catalog/legacy-formats.js';
import { ensureDir, makeTempDir, writeCsv, writeXlsx } from './helpers/fixtures.js';

/**
 * 数据模板包（data-templates 复核修单：openspec/changes/data-templates/review.md
 * 阻断 B1–B4、应修 R-1～R-5，spec §4 版式重做 + §5 DT7）。
 *
 * 1. DT1 版式（spec §4 重做）：说明全部移到「使用说明」「表目录」「列说明」三个
 *    sheet；每个数据 sheet 第 1 行＝表头（冻结）、第 2 行＝合成示例（首列「示例-」
 *    前缀、行尾「填写前删除本行」、高亮）、第 3 行起留空——说明行不得占用数据行。
 * 2. DT2 单一来源：README「格式模板」与 catalog 契约逐字一致；B 组＝商品主表 +
 *    渠道店铺宽表（表头与解析器实际消费列一致）；「商品客观属性」无加载点 →
 *    从模板与 README 模板块移除；平台画像写明文件名／sheet 名硬规则。
 * 3. DT3 防漂移（R-2）：重建结果与入库文件**全部 sheet 全部行**逐字一致，
 *    不只前几行——手改入库文件任意行必须 FAIL。
 * 4. DT7 业务侧往返（B1 的核心验收）：读入库 xlsx 的每个数据 sheet，删第 2 行
 *    示例、按「表目录」的文件名规则与格式另存为 CSV 和 XLSX（含解析器要求的
 *    sheet 名）到临时数据根，调真实 buildIndex → 每个 sheet 都必须被识别。
 *    不允许用蓝图拼 CSV 绕开真实文件。
 *
 * 本测试不读 `data/` 下的业务数据；`data/README.md` 是 tracked 说明文件，
 * 单一来源测试按 DT2 要求锁定它。示例数据全部合成（SYN-…／D00001 演示账号）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const TEMPLATE_PATH = join(REPO_ROOT, 'templates', '数据模板.xlsx');
const README_PATH = join(REPO_ROOT, 'data', 'README.md');
const GENERATOR_PATH = join(REPO_ROOT, 'scripts', 'build-data-templates.mjs');
const ARCHIVE_GUARD_SCRIPT = join(REPO_ROOT, 'scripts', 'check-no-archive-content.mjs');

/**
 * catalog 契约经 namespace 取用：修单新增常量（渠道店铺宽表表头等）在实现前
 * 缺失时，断言给出**产品级**失败信息，而不是整文件导入错误（§4.3：导入错误
 * 不算 RED）。GREEN 之后这些断言继续充当契约存在性锁。
 */
const CATALOG = legacyFormats as unknown as Record<string, unknown>;

function catalogStringArray(name: string, why: string): readonly string[] {
  const value = CATALOG[name];
  assert.ok(
    Array.isArray(value) && value.every((item) => typeof item === 'string'),
    `catalog/legacy-formats.ts 应固化 ${name}（${why}）`,
  );
  return value as readonly string[];
}

function catalogString(name: string, why: string): string {
  const value = CATALOG[name];
  assert.ok(
    typeof value === 'string' && value.length > 0,
    `catalog/legacy-formats.ts 应固化 ${name}（${why}）`,
  );
  return value as string;
}

/** 加载生成器模块（生成器是交付物本体；缺失即产品级失败，不是环境问题）。 */
async function importGenerator(): Promise<{
  templateBlueprint: () => Promise<unknown[]>;
  buildTemplateWorkbook: () => Promise<ExcelJS.Workbook>;
}> {
  try {
    return await import(pathToFileURL(GENERATOR_PATH).href);
  } catch (error) {
    assert.fail(
      `生成器 scripts/build-data-templates.mjs 无法加载（npm run templates:build 的实现缺失或损坏）: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** 读入库模板。 */
async function readCommittedWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  return workbook;
}

/** sheet → 全部行的字符串矩阵（rowCount／columnCount 全量，不留盲区）。 */
function sheetMatrix(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c += 1) {
      const value = row.getCell(c).value;
      cells.push(value == null ? '' : String(value));
    }
    rows.push(cells);
  }
  return rows;
}

/** 生成器在内存重建的模板 → sheet 名 → 全部行。 */
async function rebuildSheets(): Promise<Map<string, string[][]>> {
  const generator = await importGenerator();
  const workbook = await generator.buildTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as ArrayBuffer);
  const out = new Map<string, string[][]>();
  for (const sheet of loaded.worksheets) out.set(sheet.name, sheetMatrix(sheet));
  return out;
}

async function committedSheets(): Promise<Map<string, string[][]>> {
  const workbook = await readCommittedWorkbook();
  const out = new Map<string, string[][]>();
  for (const sheet of workbook.worksheets) out.set(sheet.name, sheetMatrix(sheet));
  return out;
}

function sheetText(rows: string[][]): string {
  return rows.flat().join('\n');
}

/** 说明型 sheet（不是「另存出去」的数据表）。 */
const NON_DATA_SHEETS = ['使用说明', '表目录', '列说明', '小红书画像', '时间范围声明'] as const;

/** 数据 sheet 名（A 组 12 + B 组 2 + C 组 3 + D 组 2）。 */
const DATA_SHEET_NAMES = [
  'funnel',
  'member-features',
  'cohort',
  'recency',
  'channel-flow',
  'diagnosis',
  'product-channel',
  'aggregate-groups',
  'product-performance',
  'channel-performance',
  'entity-alias',
  'portrait-conflicts',
  'products',
  'channels',
  '抖音画像长表',
  '京东画像表',
  '天猫画像表',
  'monthly-mix',
  'clearance-leap',
] as const;

/** sheet 名 → 「表名」列用的中文名（与「表目录」／「列说明」一致）。 */
function tableLabel(sheetName: string): string {
  if (sheetName === 'products') {
    return catalogString('PRODUCT_MASTER_LABEL', '商品主表表名契约');
  }
  if (sheetName === 'channels') {
    return catalogString('CHANNEL_STORE_LABEL', 'B2：渠道店铺宽表表名契约');
  }
  if (sheetName === 'monthly-mix') return '月度大盘人群贡献结构表';
  if (sheetName === 'clearance-leap') return '清仓客次季跃迁明细表';
  const specKey: Record<string, string> = {
    funnel: 'funnel',
    'member-features': 'memberFeatures',
    cohort: 'cohort',
    recency: 'recency',
    'channel-flow': 'channelFlow',
    diagnosis: 'diagnosis',
    'product-channel': 'productChannel',
    'aggregate-groups': 'aggregateGroups',
    'product-performance': 'productPerformance',
    'channel-performance': 'channelPerformance',
    'entity-alias': 'entityAlias',
    'portrait-conflicts': 'portraitConflicts',
  };
  if (specKey[sheetName]) return TABLE_SPECS[specKey[sheetName]]!.label;
  return sheetName;
}

/** D 组（P3 报表阶段）：解析器未实现，不参与 DT7 往返。 */
const PARSER_PENDING_SHEETS = ['monthly-mix', 'clearance-leap'] as const;

/** 每个 sheet 的期望表头来源（契约单一来源；channels 契约缺失时给出产品级失败）。 */
function expectedHeader(sheetName: string): readonly string[] {
  const specKey: Record<string, string> = {
    funnel: 'funnel',
    'member-features': 'memberFeatures',
    cohort: 'cohort',
    recency: 'recency',
    'channel-flow': 'channelFlow',
    diagnosis: 'diagnosis',
    'product-channel': 'productChannel',
    'aggregate-groups': 'aggregateGroups',
    'product-performance': 'productPerformance',
    'channel-performance': 'channelPerformance',
    'entity-alias': 'entityAlias',
    'portrait-conflicts': 'portraitConflicts',
  };
  if (specKey[sheetName]) {
    return TABLE_SPECS[specKey[sheetName]]!.columns.map((column) => column.name);
  }
  if (sheetName === 'products') {
    return catalogStringArray('PRODUCT_MASTER_HEADER', '商品主表表头契约（S4：列名须在字段目录 sources 内）');
  }
  if (sheetName === 'channels') {
    return catalogStringArray(
      'CHANNEL_STORE_WIDE_HEADER',
      'B2：渠道 sheet 表头必须与渠道店铺宽表解析器实际消费列一致',
    );
  }
  const portrait = legacyFormats.PORTRAIT_FORMATS.find((spec) => spec.label === sheetName);
  if (portrait) return portrait.demoHeader;
  if (sheetName === 'monthly-mix') {
    return ['月份', '人群类型', '买家数', '占比', 'MoM', 'YoY', '贡献GMV', 'GMV占比', 'AOV', '件单价', 'UPT'];
  }
  if (sheetName === 'clearance-leap') {
    return ['月份', '加购率', '画像重合度', '正价购买转化率'];
  }
  throw new Error(`未知的数据 sheet：${sheetName}`);
}

/* ── DT7：按「表目录」规则另存的路径／格式／sheet 名（与表目录硬规则互锁） ── */

interface SaveRule {
  /** CSV 另存的相对路径（文件名规则与表目录一致）。 */
  csv?: string;
  /** XLSX 另存的相对路径。 */
  xlsx?: string;
  /** 解析器要求的 sheet 名（无要求时测试用 Sheet1）。 */
  sheetName?: string;
}

const SAVE_RULES: Record<string, SaveRule> = {
  funnel: { csv: 'tables/funnel.csv', xlsx: 'tables/funnel.xlsx' },
  'member-features': { csv: 'tables/member-features.csv', xlsx: 'tables/member-features.xlsx' },
  cohort: { csv: 'retention/cohort.csv', xlsx: 'retention/cohort.xlsx' },
  recency: { csv: 'retention/recency.csv', xlsx: 'retention/recency.xlsx' },
  'channel-flow': { csv: 'retention/channel-flow.csv', xlsx: 'retention/channel-flow.xlsx' },
  diagnosis: { csv: 'retention/diagnosis.csv', xlsx: 'retention/diagnosis.xlsx' },
  'product-channel': { csv: 'tables/product-channel.csv', xlsx: 'tables/product-channel.xlsx' },
  'aggregate-groups': { csv: 'tables/aggregate-groups.csv', xlsx: 'tables/aggregate-groups.xlsx' },
  'product-performance': {
    csv: 'tables/product-performance.csv',
    xlsx: 'tables/product-performance.xlsx',
  },
  'channel-performance': {
    csv: 'tables/channel-performance.csv',
    xlsx: 'tables/channel-performance.xlsx',
  },
  'entity-alias': { csv: 'tables/entity-alias.csv', xlsx: 'tables/entity-alias.xlsx' },
  'portrait-conflicts': {
    csv: 'tables/portrait-conflicts.csv',
    xlsx: 'tables/portrait-conflicts.xlsx',
  },
  products: { xlsx: 'domains/04_商品信息/商品宽表.xlsx' },
  channels: { xlsx: 'domains/02_渠道信息/渠道店铺宽表.xlsx' },
  抖音画像长表: { csv: 'source/live/演示账号1/2026-10/2601-2612演示账号1_抖音.csv' },
  // 京东放在 tmall 目录：锁定「文件名后缀优先于所在目录」，京东不得被当天猫解析（B3）
  京东画像表: {
    xlsx: 'source/tmall/演示店铺/2026-10/2601-2612演示账号1_京东.xlsx',
    sheetName: 'Sheet0',
  },
  天猫画像表: {
    xlsx: 'domains/07_人群画像/天猫/2601-2612演示账号1_天猫.xlsx',
    sheetName: '明细',
  },
};

/** A 组 sheet → 索引字段（buildIndex 后必须非空）。 */
const A_INDEX_FIELDS: Array<[string, string]> = [
  ['funnel', 'funnel'],
  ['member-features', 'memberFeatures'],
  ['cohort', 'cohort'],
  ['recency', 'recency'],
  ['channel-flow', 'channelFlow'],
  ['diagnosis', 'diagnosis'],
  ['product-channel', 'productChannels'],
  ['aggregate-groups', 'aggregateGroups'],
  ['product-performance', 'productPerformance'],
  ['channel-performance', 'channelPerformance'],
  ['entity-alias', 'entityAliases'],
  ['portrait-conflicts', 'portraitConflicts'],
];

interface ExampleData {
  header: string[];
  dataRow: string[];
}

/**
 * 模拟业务侧「删第 2 行示例 → 从第 2 行起填数据」：
 * 第 1 行＝表头；第 2 行示例删掉后，用示例值（剥掉「示例-」前缀与行尾标注）
 * 作为填入的数据行（唯一可用的合成数据）。
 */
function exampleAsDataRow(sheetName: string, rows: string[][]): ExampleData {
  assert.ok(
    rows.length >= 2,
    `[${sheetName}] 数据 sheet 应至少有表头（第 1 行）与示例（第 2 行）两行`,
  );
  // 行尾标注是表头之外的一格：先剥掉行尾空单元格，得到真实表头宽度
  let width = rows[0]!.length;
  while (width > 0 && rows[0]![width - 1]!.trim() === '') width -= 1;
  const header = rows[0]!.slice(0, width).map((cell) => cell.trim());
  const example = rows[1]!;
  assert.match(
    example[0] ?? '',
    /^示例-/,
    `[${sheetName}] 第 2 行示例首列应有「示例-」前缀（spec §4）`,
  );
  assert.match(
    example[header.length] ?? '',
    /填写前删除本行/,
    `[${sheetName}] 第 2 行行尾应有「填写前删除本行」标注（spec §4）`,
  );
  const dataRow = example
    .slice(0, header.length)
    .map((cell, index) => (index === 0 ? cell.replace(/^示例-/, '') : cell));
  return { header, dataRow };
}

/** 把每个数据 sheet 按 SAVE_RULES 另存进临时数据根（真实写文件，不用蓝图拼）。 */
async function saveRoundTrip(root: string, useXlsx: boolean): Promise<{ spu: string; channelId: string }> {
  const workbook = await readCommittedWorkbook();
  let spu = '';
  let channelId = '';
  for (const sheetName of DATA_SHEET_NAMES) {
    const rule = SAVE_RULES[sheetName];
    if (!rule) continue; // D 组：解析器未实现，另行断言
    const sheet = workbook.getWorksheet(sheetName);
    assert.ok(sheet, `模板缺少数据 sheet「${sheetName}」`);
    const { header, dataRow } = exampleAsDataRow(sheetName, sheetMatrix(sheet));
    if (sheetName === 'products') spu = dataRow[0]!;
    if (sheetName === 'channels') channelId = dataRow[0]!;
    const target = useXlsx ? (rule.xlsx ?? rule.csv) : (rule.csv ?? rule.xlsx);
    assert.ok(
      target,
      `[${sheetName}] SAVE_RULES 未配置任何另存形态（表目录规则与测试夹具不同步）`,
    );
    ensureDir(dirname(join(root, target)));
    // 写入器按目标扩展名选择（表目录「允许格式」决定形态，与本次运行模式无关）
    if (target.endsWith('.xlsx')) {
      await writeXlsx(join(root, target), rule.sheetName ?? 'Sheet1', [header, dataRow]);
    } else {
      writeCsv(join(root, target), [header, dataRow]);
    }
  }
  assert.ok(spu, 'products sheet 未取到示例款号');
  assert.ok(channelId, 'channels sheet 未取到示例店铺编码');
  return { spu, channelId };
}

interface IndexLike {
  products?: Array<{ spu: string; category?: { l2?: string; l3?: string }; extra?: Record<string, string> }>;
  channels?: Array<{ channelId: string; name?: string }>;
  portraits?: Array<{
    entityId: string;
    month?: string;
    platformLabels: Record<string, unknown>;
    projections?: Record<string, { labels?: Record<string, unknown> }>;
  }>;
}

function assertRoundTripIndex(index: IndexLike, label: string, spu: string, channelId: string): void {
  for (const [sheetName, field] of A_INDEX_FIELDS) {
    const entries = (index as Record<string, unknown>)[field];
    assert.ok(
      Array.isArray(entries) && entries.length >= 1,
      `[${label}][${sheetName}] 按说明另存后未被识别：索引.${field} 为空`,
    );
  }
  const product = (index.products ?? []).find((item) => item.spu === spu);
  assert.ok(product, `[${label}] 商品宽表未被 buildIndex 识别（products 缺款号 ${spu}）`);
  assert.equal(
    product.category?.l3,
    '演示品类',
    `[${label}]「品类」列未按字段目录落到 category.l3（S4：表头须与字段目录 sources 一致）`,
  );
  assert.equal(
    product.category?.l2,
    '演示中类',
    `[${label}]「中类」列未按字段目录落到 category.l2（S4）`,
  );
  const channel = (index.channels ?? []).find((item) => item.channelId === channelId);
  assert.ok(channel, `[${label}] 渠道店铺宽表未被识别（channels 缺店铺编码 ${channelId}）`);
  assert.equal(channel.name, '演示账号1', `[${label}] 渠道「店铺」列未落到 name`);
  const platforms = new Set(
    (index.portraits ?? []).flatMap((portrait) => Object.keys(portrait.platformLabels)),
  );
  for (const platform of ['douyin', 'jd', 'tmall']) {
    assert.ok(platforms.has(platform), `[${label}] ${platform} 画像未被扫描识别`);
  }
  const jd = (index.portraits ?? []).find((portrait) => portrait.platformLabels['jd']);
  assert.ok(
    jd && jd.entityId === '演示账号1',
    `[${label}] 京东画像未被识别为京东实体（B3：京东不得被当天猫解析）`,
  );
  // R2-4：京东／天猫的实体与月份取自文件名（另存名「2601-2612演示账号1_京东.xlsx／_天猫.xlsx」）
  assert.equal(
    jd?.month,
    '2026-01~2026-12',
    `[${label}] 京东月份应按文件名「2601-2612」归属（R2-4：文件名须带月份与实体名）`,
  );
  const tmall = (index.portraits ?? []).find((portrait) => portrait.platformLabels['tmall']);
  assert.ok(
    tmall && tmall.entityId === '演示账号1',
    `[${label}] 天猫画像实体应按文件名归属（R2-4）`,
  );
  assert.equal(
    tmall?.month,
    '2026-01~2026-12',
    `[${label}] 天猫月份应按文件名「2601-2612」归属（R2-4）`,
  );
  const douyin = (index.portraits ?? []).find((portrait) => portrait.platformLabels['douyin']);
  assert.ok(
    douyin && douyin.entityId === '演示账号1' && douyin.month === '2026-01~2026-12',
    `[${label}] 抖音画像实体／月份应取自列名「2601-2612演示账号1-占比」（R2-1 基线）`,
  );
  // R2-2：示例维度名必须是平台原生维度名才能投影到统一维度（京东是「性别」，不是「预测性别」）
  const nativeGenderDimensions: Array<[string, string]> = [
    ['douyin', '预测性别'],
    ['jd', '性别'],
    ['tmall', '预测性别'],
  ];
  for (const [platform, dimensionName] of nativeGenderDimensions) {
    const portrait = (index.portraits ?? []).find((item) => item.platformLabels[platform]);
    const gender = portrait?.projections?.gender;
    assert.ok(
      gender != null && gender.labels != null && Object.keys(gender.labels).length >= 1,
      `[${label}] ${platform} 示例维度「${dimensionName}」未投影到统一维度 gender（R2-2：京东原生维度名是「性别」，照示例写成「预测性别」会整维丢失；模板示例行只有一行，投影含该行标签即可）`,
    );
  }
}

describe('DT0 交付物与工作簿结构', () => {
  test('入库模板存在（templates/数据模板.xlsx）', () => {
    assert.ok(
      existsSync(TEMPLATE_PATH),
      `templates/数据模板.xlsx 不存在：运行 npm run templates:build 生成并提交（当前不存在于 ${TEMPLATE_PATH}）`,
    );
  });

  test('生成器可在内存重建模板（npm run templates:build 的实现）', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    assert.ok(
      sheets.length >= 24,
      `模板应覆盖 说明 3 + A 12 + B 2 + C 4 + D 2 + E 1 ≥ 24 个 sheet，实际 ${sheets.length}`,
    );
  });

  test('sheet 名集合＝说明 3 + 数据 19（无 product-attributes），顺序符合 spec §3/§4', async () => {
    const workbook = await readCommittedWorkbook();
    const names = workbook.worksheets.map((sheet) => sheet.name);
    assert.equal(
      names.includes('product-attributes'),
      false,
      'B4：模板不得再有「product-attributes」sheet（商品客观属性无加载点）',
    );
    const expected = [
      '使用说明',
      '表目录',
      '列说明',
      // A 组 12
      ...DATA_SHEET_NAMES.slice(0, 12),
      // B 组 2
      ...DATA_SHEET_NAMES.slice(12, 14),
      // C 组 4（小红书画像紧跟三平台画像，同属 C 组）
      ...DATA_SHEET_NAMES.slice(14, 17),
      '小红书画像',
      // D 组 2
      ...DATA_SHEET_NAMES.slice(17),
      '时间范围声明',
    ];
    assert.deepEqual(
      names,
      expected,
      `sheet 名集合／顺序与 spec §3/§4 不一致：\n实际：${JSON.stringify(names)}\n期望：${JSON.stringify(expected)}`,
    );
  });
});

describe('DT1 版式（spec §4 重做）：说明不占用数据 sheet 的行', () => {
  test('每个数据 sheet：第 1 行＝表头（冻结）、第 2 行＝合成示例（「示例-」前缀＋行尾「填写前删除本行」＋高亮）、第 3 行起留空', async () => {
    const workbook = await readCommittedWorkbook();
    const problems: string[] = [];
    for (const sheetName of DATA_SHEET_NAMES) {
      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) {
        problems.push(`[${sheetName}] sheet 缺失`);
        continue;
      }
      const rows = sheetMatrix(sheet);
      const header = expectedHeader(sheetName);
      // 行尾「填写前删除本行」是额外一格，整表列数会比表头多 1：表头按前 N 列比对
      const headerCells = rows[0]?.slice(0, header.length).map((cell) => cell.trim()) ?? [];
      const trailing = rows[0]?.[header.length]?.trim() ?? '';
      if (JSON.stringify(headerCells) !== JSON.stringify([...header]) || trailing !== '') {
        problems.push(
          `[${sheetName}] 第 1 行必须是表头 ${JSON.stringify([...header])}，实际 ${JSON.stringify(rows[0])}`,
        );
      }
      if (rows.length < 2) {
        problems.push(`[${sheetName}] 缺第 2 行合成示例`);
        continue;
      }
      const example = rows[1]!;
      if (!/^示例-/.test(example[0] ?? '')) {
        problems.push(`[${sheetName}] 第 2 行示例首列应以「示例-」开头，实际 ${JSON.stringify(example[0])}`);
      }
      if (!/填写前删除本行/.test(example[header.length] ?? '')) {
        problems.push(`[${sheetName}] 第 2 行行尾应有「填写前删除本行」标注`);
      }
      if (rows.length !== 2) {
        problems.push(`[${sheetName}] 第 3 行起应留空（示例行之外不得有任何行），实际共 ${rows.length} 行`);
      }
      const firstCell = sheet.getRow(2).getCell(1);
      const fill = firstCell.fill as { type?: string; fgColor?: { argb?: string } } | undefined;
      if (fill?.type !== 'pattern' || !fill.fgColor?.argb) {
        problems.push(`[${sheetName}] 第 2 行示例应有底色高亮`);
      }
      const views = sheet.views as Array<{ ySplit?: number }> | undefined;
      if (views?.[0]?.ySplit !== 1) {
        problems.push(`[${sheetName}] 应冻结第 1 行（ySplit=1），实际 ${JSON.stringify(views?.[0])}`);
      }
    }
    assert.deepEqual(problems, [], `数据 sheet 版式与 spec §4 不一致：\n${problems.join('\n')}`);
  });

  test('「表目录」逐表写明：放到哪（含精确文件名规则）｜允许格式（含 sheet 名要求）｜必需性｜解锁什么｜解析器状态', async () => {
    const sheets = await committedSheets();
    const catalog = sheets.get('表目录');
    assert.ok(catalog, '模板缺少「表目录」sheet（spec §4）');
    const text = sheetText(catalog);
    const mustContain = [
      '表名',
      '数据 sheet 名',
      '文件名',
      '_抖音.csv',
      '_京东.xlsx',
      '_天猫.xlsx',
      'Sheet0',
      '明细',
      '店铺编码',
      '商品宽表',
      '渠道店铺宽表',
      'tables/funnel',
      'retention/cohort',
      '04_商品信息',
      '02_渠道信息',
      '均可',
      '仅 CSV',
      '仅 XLSX',
      '未实现',
      '解析器',
    ];
    const missing = mustContain.filter((keyword) => !text.includes(keyword));
    assert.deepEqual(
      missing,
      [],
      `「表目录」缺少文件名／格式／sheet 名硬规则关键词：${missing.join('、')}`,
    );
    // 逐表一行：每张数据表的表名都要在目录中出现
    const labels = [
      ...DATA_SHEET_NAMES.map((name) => tableLabel(name)),
      '小红书画像',
      '时间范围声明',
    ];
    const notListed = labels.filter((label) => !text.includes(label));
    assert.deepEqual(notListed, [], `「表目录」未列出这些表：${notListed.join('、')}`);
  });

  test('「列说明」一行一列，覆盖每张数据 sheet 的每一列', async () => {
    const sheets = await committedSheets();
    const doc = sheets.get('列说明');
    assert.ok(doc, '模板缺少「列说明」sheet（spec §4）');
    assert.deepEqual(
      doc[0]?.slice(0, 4),
      ['表名', '列名', '必需／可选', '口径说明'],
      '「列说明」第 1 行应为 表名｜列名｜必需／可选｜口径说明',
    );
    const listed = new Set<string>();
    for (const row of doc.slice(1)) {
      if (row[0]?.trim()) listed.add(`${row[0]?.trim()}｜${row[1]?.trim()}`);
    }
    const missing: string[] = [];
    for (const sheetName of DATA_SHEET_NAMES) {
      const label = tableLabel(sheetName);
      for (const column of expectedHeader(sheetName)) {
        if (!listed.has(`${label}｜${column}`)) missing.push(`${label}｜${column}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `「列说明」缺少这些表的列条目：${missing.slice(0, 12).join('、')}${missing.length > 12 ? ` 等 ${missing.length} 项` : ''}`,
    );
  });

  test('「使用说明」给出「删第 2 行示例 → 从第 2 行起填 → 按表目录文件名规则另存」步骤；声明填 README 不是文件', async () => {
    const sheets = await committedSheets();
    const usage = sheets.get('使用说明');
    assert.ok(usage, '模板缺少「使用说明」sheet');
    const text = sheetText(usage);
    for (const keyword of ['删除第 2 行', '表目录', '文件名', '数据时间范围声明', 'README']) {
      assert.ok(
        text.includes(keyword),
        `「使用说明」应包含「${keyword}」步骤要点（spec §4）`,
      );
    }
    assert.doesNotMatch(
      text,
      /第 4 行起为合成示例/,
      '「使用说明」不得再描述旧版式（第 4 行起示例）',
    );
  });

  test('小红书画像是说明型 sheet：报告原文放目录，不再写「另存为 CSV／XLSX」（建议 S-2）', async () => {
    const sheets = await committedSheets();
    const xhs = sheets.get('小红书画像');
    assert.ok(xhs, '模板缺少「小红书画像」sheet');
    const text = sheetText(xhs);
    const note = catalogString('XHS_NOTE', '小红书说明契约');
    assert.ok(text.includes(note.slice(0, 20)), '小红书画像 sheet 应包含 catalog XHS_NOTE 说明');
    assert.doesNotMatch(text, /另存/, `小红书画像 sheet 不得再让用户「另存」表格文件（其形态是 Markdown 报告）\n内容：${text}`);
  });

  test('时间范围声明 sheet：第 1 行表头＋声明项逐行（无空行占位，建议 S-1）；声明不落盘', async () => {
    const sheets = await committedSheets();
    const declaration = sheets.get('时间范围声明');
    assert.ok(declaration, '模板缺少「时间范围声明」sheet');
    assert.deepEqual(
      declaration[0]?.slice(0, 3),
      ['项', '内容', '写法示例'],
      '时间范围声明 sheet 第 1 行应为 项｜内容｜写法示例',
    );
    const items = declaration.slice(1).map((row) => row[0]?.trim()).filter(Boolean);
    assert.deepEqual(
      items,
      legacyFormats.DECLARATION_FIELDS.map((field) => field.item),
      '声明项应与 catalog DECLARATION_FIELDS 一致且逐行紧凑（无空行占位）',
    );
    for (const [index, field] of legacyFormats.DECLARATION_FIELDS.entries()) {
      assert.equal(
        declaration[1 + index]?.[2]?.trim(),
        field.example,
        `声明项「${field.item}」的写法示例应与 catalog 一致`,
      );
    }
  });

  test('示例全部合成：入库模板全文（所有 sheet 所有单元格）不含真实品牌／店铺名', async () => {
    const sheets = await committedSheets();
    const text = [...sheets.values()].map(sheetText).join('\n');
    assert.doesNotMatch(text, /森马/, '入库模板全文不得出现真实品牌／店铺名（DT4，读入库文件而非蓝图）');
  });
});

describe('DT2 单一来源：README「格式模板」↔ catalog 契约', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  test('README 平台表格列结构与 catalog 通用结构逐字一致', () => {
    for (const spec of legacyFormats.PORTRAIT_FORMATS) {
      assert.ok(
        readme.includes(spec.structureText),
        `README「格式模板」应含与 catalog 逐字一致的${spec.label}列结构：${spec.structureText}`,
      );
    }
  });

  test('README 平台硬规则与 catalog 文件名／格式／sheet 名契约逐字一致（B3；headerRule 如有一并锁定）', () => {
    const missing: string[] = [];
    for (const spec of legacyFormats.PORTRAIT_FORMATS) {
      const record = spec as unknown as Record<string, unknown>;
      for (const field of ['fileNameRule', 'saveFormat', 'sheetName'] as const) {
        const value = record[field];
        if (typeof value !== 'string' || value.length === 0) {
          missing.push(`${spec.label}.${field}（catalog 缺契约）`);
          continue;
        }
        if (!readme.includes(value)) missing.push(`${spec.label}.${field}：${value}`);
      }
      // R2-1：抖音的列名硬规则（实体与月份取自列名）也必须写进 README 平台硬规则
      const headerRule = record.headerRule;
      if (typeof headerRule === 'string' && headerRule.length > 0 && !readme.includes(headerRule)) {
        missing.push(`${spec.label}.headerRule：${headerRule}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `README「格式模板」与 catalog 平台硬规则不一致：\n${missing.join('\n')}`,
    );
  });

  test('README 商品主表表头块与 catalog 逐字一致，且每列都在字段目录 sources 内（S4）', () => {
    const header = catalogStringArray('PRODUCT_MASTER_HEADER', '商品主表表头契约');
    assert.ok(
      readme.includes(header.join(',')),
      `README「格式模板」缺少与 catalog 一致的商品主表表头（期望逐字：${header.join(',')}）`,
    );
    const unmapped = header.filter(
      (column) => !PRODUCT_FIELDS.some((field) => field.sources?.includes(column)),
    );
    assert.deepEqual(
      unmapped,
      [],
      `商品主表表头这些列不在字段目录 sources 内（照填会落 extra、字段丢失）：${unmapped.join('、')}`,
    );
  });

  test('README 渠道店铺宽表表头块与 catalog 逐字一致，且每个表头列都被解析器收进字段（B2）', async () => {
    const header = catalogStringArray('CHANNEL_STORE_WIDE_HEADER', 'B2：渠道 sheet 表头与解析器同源');
    assert.ok(
      readme.includes(header.join(',')),
      `README「格式模板」缺少渠道店铺宽表表头（期望逐字：${header.join(',')}）`,
    );
    // 行为锁：用这些表头构造渠道表，真实解析器必须把每列收进字段（不留 attributes）
    const dir = makeTempDir('uom-channel-header-');
    const rows = [
      [...header],
      header.map((column, index) => (column === '店铺编码' ? 'D00001' : `V${index}`)),
    ];
    const path = await writeXlsx(join(dir, '渠道店铺宽表.xlsx'), 'Sheet1', rows);
    const result = await normalizeChannelTable(path);
    assert.ok(result.channels.length === 1, '渠道店铺宽表表头应被真实解析器接受（≥1 行）');
    const channel = result.channels[0]!;
    assert.equal(channel.channelId, 'D00001', '「店铺编码」应作为主键 channelId');
    assert.equal(
      channel.attributes,
      undefined,
      `渠道表头必须全部是解析器已登记列（不得落 attributes）：${JSON.stringify(channel.attributes)}`,
    );
    assert.equal(channel.name, 'V1', '「店铺」列应落到 name');
  });

  test('README 不再提供「商品客观属性」表头块，并标明「当前无独立加载点、暂不需要提供」（B4）', () => {
    assert.doesNotMatch(
      readme,
      /款号,版型,面料,工艺,IP/,
      'README「格式模板」不得再给商品客观属性表头块（代码无加载点，照填会被当第二张商品表）',
    );
    assert.ok(
      /商品客观属性[^]*?(无.*加载点|暂不需要提供)/.test(readme),
      'README 应标明商品客观属性「无加载点、暂不需要提供」及其真实来源（商品信息表的列）',
    );
    assert.doesNotMatch(
      readme,
      /渠道层级对照表/,
      'README 不得再提供「渠道层级对照」简化表（B2：代码不消费）',
    );
  });

  test('README 抖音示例块行与 catalog 合成示例行逐字一致', () => {
    const expectedBlock = [
      legacyFormats.DOUYIN_PORTRAIT.demoHeader.join(','),
      ...legacyFormats.DOUYIN_PORTRAIT.exampleRows.map((row) => row.join(',')),
    ].join('\n');
    assert.ok(
      readme.includes(expectedBlock),
      `README 的抖音画像长表示例块应与 catalog 合成示例逐字一致：\n${expectedBlock}`,
    );
  });

  test('README 时间范围声明表与 catalog 声明结构镜像', () => {
    for (const field of legacyFormats.DECLARATION_FIELDS) {
      assert.ok(
        readme.includes(`| ${field.item} |`),
        `data/README.md「数据时间范围声明」表应含「${field.item}」项（catalog DECLARATION_FIELDS 与之镜像）`,
      );
    }
  });
});

describe('R2 第二轮应修：契约与措辞锁（review-round2 应修 1–4）', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  test('R2-1 抖音列名规则写清三处：使用说明／表目录（抖音行）／列说明（抖音列）', async () => {
    const rule = catalogString(
      'DOUYIN_HEADER_RULE',
      'R2-1：抖音画像实体与月份取自列名的硬规则（不改列名会全部静默归到演示实体）',
    );
    const sheets = await committedSheets();
    const usage = sheets.get('使用说明');
    assert.ok(usage, '模板缺少「使用说明」sheet');
    assert.ok(
      sheetText(usage).includes(rule),
      `「使用说明」应写明抖音列名规则（实体与月份取自第 3／4 列列名）：${rule}`,
    );
    const catalog = sheets.get('表目录');
    assert.ok(catalog, '模板缺少「表目录」sheet');
    assert.ok(
      sheetText(catalog).includes(rule),
      `「表目录」抖音行应写明抖音列名规则：${rule}`,
    );
    const doc = sheets.get('列说明');
    assert.ok(doc, '模板缺少「列说明」sheet');
    const douyinRows = doc.filter(
      (row) => row[0]?.trim() === legacyFormats.DOUYIN_PORTRAIT.label,
    );
    assert.ok(
      douyinRows.length >= legacyFormats.DOUYIN_PORTRAIT.demoHeader.length,
      '「列说明」应覆盖抖音画像长表每一列',
    );
    assert.ok(
      douyinRows.some((row) => row.some((cell) => cell.includes(rule))),
      `「列说明」抖音画像长表的列条目应写明抖音列名规则：${rule}`,
    );
  });

  test('R2-2 京东示例维度名＝京东原生维度「性别」；note 列出京东原生维度名', () => {
    const jd = legacyFormats.JD_PORTRAIT;
    assert.ok(jd.exampleRows.length >= 1, '京东画像契约应有示例行');
    for (const row of jd.exampleRows) {
      assert.equal(
        row[0],
        '性别',
        '京东原生维度名是「性别」（portrait/catalog/dimensions.ts jd sourceDimensions）；示例写成「预测性别」不会投影到统一维度（R2-2）',
      );
    }
    assert.match(
      jd.note,
      /京东原生维度名/,
      '京东 note 应列出京东原生维度名（性别／年龄／十大靶群／购买力／城市线级），业务侧照抄京东导出的维度名才能进统一投影（R2-2）',
    );
  });

  test('R2-3 抖音 XLSX 后果表述真实：表目录与 README 写「报错中断」，不再写「不被识别」', async () => {
    const sheets = await committedSheets();
    const catalog = sheets.get('表目录');
    assert.ok(catalog, '模板缺少「表目录」sheet');
    const catalogText = sheetText(catalog);
    assert.match(
      catalogText,
      /存成 XLSX 会导致索引构建报错中断/,
      '抖音存成 XLSX 实际会让 buildIndex 抛错中断（不是「不被识别」）——表目录须如实写后果（R2-3）',
    );
    assert.doesNotMatch(
      catalogText,
      /XLSX 不被识别/,
      '「XLSX 不被识别」与真实行为不符（探针：_抖音.xlsx 会让索引构建抛错中断）',
    );
    assert.match(
      readme,
      /存成 XLSX 会导致索引构建报错中断/,
      'data/README.md 平台硬规则须同步如实写抖音 XLSX 后果（R2-3）',
    );
  });

  test('R2-4 京东／天猫 fileNameRule 写明「文件名须带月份与实体名」', async () => {
    for (const spec of [legacyFormats.JD_PORTRAIT, legacyFormats.TMALL_PORTRAIT]) {
      assert.match(
        spec.fileNameRule,
        /月份与实体名|实体与月份取自文件名/,
        `${spec.label} 的 fileNameRule 应写明文件名须带月份与实体名（缺了会静默错挂到错误实体）——R2-4`,
      );
    }
    const sheets = await committedSheets();
    const catalog = sheets.get('表目录');
    assert.ok(catalog, '模板缺少「表目录」sheet');
    const hits = (sheetText(catalog).match(/实体与月份取自文件名/g) ?? []).length;
    assert.ok(
      hits >= 2,
      `「表目录」京东／天猫两行都应写明「实体与月份取自文件名」，实际命中 ${hits} 次（R2-4）`,
    );
  });
});

describe('DT4/建议①：归档内容守卫 xlsx 读取失败 fail-closed（review-round2 建议①）', () => {
  /** 合成黑名单源（fab ≥16 字即可派生出 ≥14 字片段）；不含任何真实业务内容。 */
  const SYNTHETIC_FAB = '合成演示卖点文本用于守卫自测的样例内容，不含任何真实业务信息';

  /**
   * 在临时目录搭一个最小 git 沙箱仓库：把**当前真实脚本**复制进去运行。
   * 脚本的 REPO_ROOT 取自身所在目录，且 import exceljs —— 因此复制运行
   * （软链 node_modules），而不是在真实仓库里跑（那里没有损坏的 tracked xlsx）。
   * 黑名单经 UOM_ARCHIVE_FIXED_ROOT 指向沙箱内合成 jsonl，不触真实归档数据。
   */
  async function runGuardSandbox(
    xlsxMode: 'broken' | 'needle' | 'clean',
  ): Promise<{ status: number | null; stdout: string; stderr: string }> {
    const sandbox = makeTempDir('uom-archive-guard-');
    symlinkSync(join(REPO_ROOT, 'node_modules'), join(sandbox, 'node_modules'), 'dir');
    mkdirSync(join(sandbox, 'scripts'), { recursive: true });
    const scriptCopy = join(sandbox, 'scripts', 'check-no-archive-content.mjs');
    writeFileSync(scriptCopy, readFileSync(ARCHIVE_GUARD_SCRIPT, 'utf8'), 'utf8');

    const archive = join(sandbox, 'archive-fixed');
    const jsonlDir = join(archive, 'v04-holdout', 'work-package', 'train');
    mkdirSync(jsonlDir, { recursive: true });
    writeFileSync(
      join(jsonlDir, 'product_attributes.jsonl'),
      `${JSON.stringify({ fab: SYNTHETIC_FAB })}\n`,
      'utf8',
    );

    mkdirSync(join(sandbox, 'templates'), { recursive: true });
    const xlsxPath = join(sandbox, 'templates', 'sandbox.xlsx');
    if (xlsxMode === 'broken') {
      writeFileSync(xlsxPath, '这不是 xlsx——故意写坏的字节流，用于触发读取失败', 'utf8');
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.addRow(['表头']);
      sheet.addRow([xlsxMode === 'needle' ? SYNTHETIC_FAB : '干净的合成内容']);
      await workbook.xlsx.writeFile(xlsxPath);
    }

    execFileSync('git', ['init', '-q'], { cwd: sandbox });
    execFileSync('git', ['add', 'templates/sandbox.xlsx', 'scripts/check-no-archive-content.mjs'], {
      cwd: sandbox,
    });
    execFileSync(
      'git',
      ['-c', 'user.name=guard-sandbox', '-c', 'user.email=guard-sandbox@local', 'commit', '-q', '-m', 'sandbox'],
      { cwd: sandbox },
    );

    const result = spawnSync(process.execPath, [scriptCopy], {
      cwd: sandbox,
      encoding: 'utf8',
      env: { ...process.env, UOM_ARCHIVE_FIXED_ROOT: archive },
    });
    return { status: result.status, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') };
  }

  test('tracked xlsx 读取失败 → 守卫退出 1（fail-closed），不再静默跳过', async () => {
    const result = await runGuardSandbox('broken');
    assert.equal(
      result.status,
      1,
      `损坏的 tracked xlsx 应让守卫 fail-closed 退出 1（现状：读取失败被静默跳过、守卫仍 exit 0）\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.match(result.stderr, /fail-closed/, '退出信息应说明是 fail-closed 处理');
  });

  test('tracked xlsx 单元格文本命中黑名单 → 退出 1（S3 行为回归锁）', async () => {
    const result = await runGuardSandbox('needle');
    assert.equal(
      result.status,
      1,
      `xlsx 单元格文本命中黑名单应退出 1\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.match(result.stderr, /归档真实内容片段/, '命中报告应指明 tracked 文件与黑名单条目');
  });

  test('干净 tracked xlsx → 退出 0（不误伤）', async () => {
    const result = await runGuardSandbox('clean');
    assert.equal(
      result.status,
      0,
      `干净 xlsx 不应被拦\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.match(result.stdout, /PASS/, '干净场景应输出 PASS');
  });
});

describe('DT3 防漂移：入库模板与代码契约全量一致（R-2：整 sheet 比对）', () => {
  test('重建结果与入库文件：sheet 集合与**全部行**逐字一致（含示例行与说明 sheet）', async () => {
    const committed = await committedSheets();
    const rebuilt = await rebuildSheets();
    const committedNames = [...committed.keys()];
    const rebuiltNames = [...rebuilt.keys()];
    assert.deepEqual(
      rebuiltNames,
      committedNames,
      `sheet 名集合不一致。\n重建：${JSON.stringify(rebuiltNames)}\n入库：${JSON.stringify(committedNames)}`,
    );
    const problems: string[] = [];
    for (const [name, rebuiltRows] of rebuilt) {
      const committedRows = committed.get(name)!;
      if (JSON.stringify(rebuiltRows) !== JSON.stringify(committedRows)) {
        const firstDiff = rebuiltRows.findIndex(
          (row, index) => JSON.stringify(row) !== JSON.stringify(committedRows[index]),
        );
        problems.push(
          `[${name}] 第 ${firstDiff + 1} 行起不一致（改了契约就要 npm run templates:build 重建并提交）：\n重建：${JSON.stringify(rebuiltRows[firstDiff])}\n入库：${JSON.stringify(committedRows[firstDiff])}`,
        );
      }
    }
    assert.deepEqual(problems, [], `入库模板与代码契约漂移：\n${problems.join('\n')}`);
  });
});

describe('DT7 业务侧往返：按「表目录」另存后真实解析器／buildIndex 全部识别', () => {
  test('CSV 形态：每个数据 sheet 删示例→按表目录另存 CSV→buildIndex 识别', async () => {
    const root = makeTempDir('uom-dt7-csv-');
    const { spu, channelId } = await saveRoundTrip(root, false);
    const index = (await buildIndex({ dataRoot: root })) as unknown as IndexLike;
    assertRoundTripIndex(index, 'CSV', spu, channelId);
  });

  test('XLSX 形态：京东 sheet「Sheet0」／天猫「明细」／渠道店铺宽表→buildIndex 识别', async () => {
    const root = makeTempDir('uom-dt7-xlsx-');
    const { spu, channelId } = await saveRoundTrip(root, true);
    const index = (await buildIndex({ dataRoot: root })) as unknown as IndexLike;
    assertRoundTripIndex(index, 'XLSX', spu, channelId);
  });

  test('D 组（monthly-mix／clearance-leap）标注解析器未实现，不参与往返冒充', async () => {
    for (const sheetName of PARSER_PENDING_SHEETS) {
      assert.ok(
        !(sheetName in SAVE_RULES),
        `${sheetName} 不应出现在往返规则里（解析器未实现，不得冒充可用）`,
      );
    }
    const sheets = await committedSheets();
    const catalog = sheets.get('表目录');
    assert.ok(catalog, '模板缺少「表目录」sheet');
    const text = sheetText(catalog);
    for (const sheetName of PARSER_PENDING_SHEETS) {
      const row = catalog.find((cells) => cells.some((cell) => cell.includes(sheetName)));
      assert.ok(row, `「表目录」应列出 ${sheetName}`);
      assert.match(
        sheetText([row!]),
        /未实现/,
        `「表目录」中 ${sheetName} 的解析器列应标注「未实现（P3 报表阶段）」`,
      );
    }
  });

  test('DT7/R2-1 抖音画像实体与月份取自列名：把第 3／4 列列名改成另一合成实体／月份后另存，归属随之变化', async () => {
    const workbook = await readCommittedWorkbook();
    const sheet = workbook.getWorksheet('抖音画像长表');
    assert.ok(sheet, '模板缺少「抖音画像长表」sheet');
    const { header, dataRow } = exampleAsDataRow('抖音画像长表', sheetMatrix(sheet));
    // 模拟业务侧把第 3／4 列列名改成自己的月份与实体名（合成：演示账号2 / 2701-2712）
    const renamedHeader = [...header];
    renamedHeader[2] = '2701-2712演示账号2-占比';
    renamedHeader[3] = '2701-2712演示账号2-tgi';
    const root = makeTempDir('uom-dt7-douyin-columns-');
    // 故意用与实体无关的目录与文件名：抖音的归属只看列名，不看文件名与所在目录
    const target = 'source/live/目录名与实体无关/2026-10/文件名不含实体_抖音.csv';
    ensureDir(dirname(join(root, target)));
    writeCsv(join(root, target), [renamedHeader, dataRow]);
    const index = (await buildIndex({ dataRoot: root })) as unknown as IndexLike;
    const douyin = (index.portraits ?? []).find((portrait) => portrait.platformLabels['douyin']);
    assert.ok(douyin, '改列名后的抖音画像应被扫描识别');
    assert.equal(
      douyin?.entityId,
      '演示账号2',
      '抖音实体应取自第 3／4 列列名（→ 演示账号2），而不是模板演示实体「演示账号1」或文件名／目录（R2-1：不改列名会全部静默归到演示实体）',
    );
    assert.equal(douyin?.month, '2027-01~2027-12', '抖音月份应取自列名前缀「2701-2712」（R2-1）');
  });

  test('DT7/R2-3 抖音画像存成 XLSX：索引构建报错中断（表目录「报错中断」措辞的行为依据）', async () => {
    const workbook = await readCommittedWorkbook();
    const sheet = workbook.getWorksheet('抖音画像长表');
    assert.ok(sheet, '模板缺少「抖音画像长表」sheet');
    const { header, dataRow } = exampleAsDataRow('抖音画像长表', sheetMatrix(sheet));
    const root = makeTempDir('uom-dt7-douyin-xlsx-');
    const target = 'source/live/演示账号1/2026-10/2601-2612演示账号1_抖音.xlsx';
    ensureDir(dirname(join(root, target)));
    await writeXlsx(join(root, target), 'Sheet1', [header, dataRow]);
    await assert.rejects(
      buildIndex({ dataRoot: root }),
      /抖音画像/,
      '抖音存成 XLSX 会让 buildIndex 抛错中断（不是静默跳过）——表目录／README 须如实写「报错中断」（R2-3）',
    );
  });

  test('DT7/R2-4 反向：京东文件名缺月份与实体名时静默错挂（fileNameRule 要求带月份与实体名的依据）', async () => {
    const workbook = await readCommittedWorkbook();
    const sheet = workbook.getWorksheet('京东画像表');
    assert.ok(sheet, '模板缺少「京东画像表」sheet');
    const { header, dataRow } = exampleAsDataRow('京东画像表', sheetMatrix(sheet));
    const root = makeTempDir('uom-dt7-jd-name-');
    const target = 'source/tmall/演示店铺/2026-10/画像_京东.xlsx';
    ensureDir(dirname(join(root, target)));
    await writeXlsx(join(root, target), 'Sheet0', [header, dataRow]);
    const index = (await buildIndex({ dataRoot: root })) as unknown as IndexLike;
    const jd = (index.portraits ?? []).find((portrait) => portrait.platformLabels['jd']);
    assert.ok(jd, '不合规文件名仍按后缀识别为京东（后缀优先于目录）');
    assert.equal(
      jd?.entityId,
      '画像',
      '文件名缺实体名时实体被静默错挂为文件名残留（「画像」）且不报错——fileNameRule 因此要求「<起止年月><实体名>_京东.xlsx」（R2-4）',
    );
    assert.equal(jd?.month, '', '文件名缺月份时月份为空（不猜测、不插补）');
  });
});
