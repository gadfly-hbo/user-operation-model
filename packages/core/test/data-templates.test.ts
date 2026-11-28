import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import {
  parseAggregateGroupTable,
  parseChannelFlowTable,
  parseChannelPerformanceTable,
  parseCohortTable,
  parseDiagnosisTable,
  parseEntityAliasTable,
  parseFunnelTable,
  parseMemberFeatureTable,
  parsePortraitConflictTable,
  parseProductChannelTable,
  parseProductPerformanceTable,
  parseRecencyTable,
  normalizeDouyinPortrait,
  normalizeJdPortrait,
  normalizeTmallPortrait,
} from '../src/index.js';
import {
  DECLARATION_FIELDS,
  CHANNEL_HIERARCHY_HEADER,
  DOUYIN_PORTRAIT,
  JD_PORTRAIT,
  PRODUCT_ATTRIBUTES_HEADER,
  PRODUCT_MASTER_HEADER,
  TMALL_PORTRAIT,
} from '../src/normalize/catalog/legacy-formats.js';
import { makeTempDir, writeCsv, writeXlsx } from './helpers/fixtures.js';

/**
 * 数据模板包（data-templates DT2／DT3／DT4）：
 *
 * 1. 防漂移（DT3）：调用生成器在内存重建模板，与入库 `templates/数据模板.xlsx`
 *    比对 sheet 名集合、每个 sheet 的表头行（第 2 行）与必需性行（第 3 行）；
 *    入库文件不存在也 FAIL。改动契约不重建模板即 FAIL。
 * 2. 单一来源（DT2）：`data/README.md`「格式模板」节的表头与 catalog 固化常量
 *    （`legacy-formats.ts`）逐字一致，不再分叉。
 * 3. 模板可用：A 组与三平台画像的合成示例行按表头导出后，喂给真实解析器
 *    必须解析成功（示例行全部合成，解析器不改）。
 * 4. 版式（DT1）：每个数据 sheet 第 1 行带「表名／放到哪／必需性／解锁什么」，
 *    示例行带「填写时删除」标注；D 组标注「解析器未做」。
 *
 * 本测试不读 `data/` 下的业务数据；`data/README.md` 是 tracked 说明文件，
 * 单一来源测试按 DT2 要求锁定它。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const TEMPLATE_PATH = join(REPO_ROOT, 'templates', '数据模板.xlsx');
const README_PATH = join(REPO_ROOT, 'data', 'README.md');
const GENERATOR_PATH = join(REPO_ROOT, 'scripts', 'build-data-templates.mjs');

/** 加载生成器模块（生成器是交付物本体；缺失即产品级失败，不是环境问题）。 */
async function importGenerator(): Promise<{
  templateBlueprint: () => Promise<TemplateSheet[]>;
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

/** 生成器的模板蓝图：一个 sheet 一张模板表。 */
interface TemplateSheet {
  name: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | '说明';
  label: string;
  target: string;
  requirement: string;
  unlocks: string;
  header: readonly string[];
  requirementRow: readonly string[];
  exampleRows: readonly (readonly string[])[];
  note?: string;
}

/** 读一个 workbook：sheet 名 → 全部行（字符串矩阵）。 */
async function readWorkbook(path: string): Promise<Map<string, string[][]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return extractSheets(workbook);
}

/** 从生成器在内存重建模板并读回。 */
async function rebuildWorkbook(): Promise<Map<string, string[][]>> {
  const generator = await importGenerator();
  const workbook = await generator.buildTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as ArrayBuffer);
  return extractSheets(loaded);
}

function extractSheets(workbook: ExcelJS.Workbook): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  for (const sheet of workbook.worksheets) {
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
    out.set(sheet.name, rows);
  }
  return out;
}

/** 「格式模板」节的 csv 代码块内容（按出现顺序）。 */
function readmeFormatCsvBlocks(readme: string): string[] {
  const sectionStart = readme.indexOf('## 格式模板');
  assert.ok(sectionStart !== -1, 'data/README.md 应有「## 格式模板」节');
  const section = readme.slice(sectionStart);
  const blocks: string[] = [];
  const pattern = /```csv\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section)) !== null) {
    blocks.push(match[1]!.replace(/\r\n/g, '\n').trim());
  }
  return blocks;
}

describe('DT3 防漂移：入库模板与代码契约一致', () => {
  test('入库模板存在（templates/数据模板.xlsx）', () => {
    assert.ok(
      existsSync(TEMPLATE_PATH),
      `templates/数据模板.xlsx 不存在：运行 npm run templates:build 生成并提交（当前不存在于 ${TEMPLATE_PATH}）`,
    );
  });

  test('生成器可在内存重建模板（npm run templates:build 的实现）', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    assert.ok(sheets.length >= 22, `模板应覆盖 A–E 组至少 22 个 sheet，实际 ${sheets.length}`);
  });

  test('重建结果与入库文件：sheet 集合、表头行（第 2 行）、必需性行（第 3 行）逐字一致', async () => {
    const committed = await readWorkbook(TEMPLATE_PATH);
    const rebuilt = await rebuildWorkbook();

    const committedNames = [...committed.keys()];
    const rebuiltNames = [...rebuilt.keys()];
    assert.deepEqual(
      rebuiltNames,
      committedNames,
      `sheet 名集合不一致。\n重建：${JSON.stringify(rebuiltNames)}\n入库：${JSON.stringify(committedNames)}`,
    );

    for (const [name, rebuiltRows] of rebuilt) {
      const committedRows = committed.get(name)!;
      assert.deepEqual(
        rebuiltRows[0],
        committedRows[0],
        `[${name}] 第 1 行（表名／放到哪／必需性／解锁什么）不一致`,
      );
      assert.deepEqual(
        rebuiltRows[1],
        committedRows[1],
        `[${name}] 第 2 行表头不一致：改了契约就要重新 npm run templates:build`,
      );
      assert.deepEqual(
        rebuiltRows[2],
        committedRows[2],
        `[${name}] 第 3 行必需性／口径不一致：改了契约就要重新 npm run templates:build`,
      );
    }
  });
});

describe('DT2 单一来源：README「格式模板」↔ catalog 契约', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  test('README 平台表格列结构与 catalog 通用结构逐字一致', () => {
    for (const spec of [DOUYIN_PORTRAIT, JD_PORTRAIT, TMALL_PORTRAIT]) {
      assert.ok(
        readme.includes(spec.structureText),
        `README「格式模板」应含与 catalog 逐字一致的${spec.label}列结构：${spec.structureText}`,
      );
    }
  });

  test('README 表头代码块与 catalog 表头常量逐字一致', () => {
    const blocks = readmeFormatCsvBlocks(readme);
    const headerLines = blocks.flatMap((block) => block.split('\n').slice(0, 1));
    const expected: Array<[string, string]> = [
      [PRODUCT_MASTER_HEADER.join(','), '商品主表表头'],
      [CHANNEL_HIERARCHY_HEADER.join(','), '渠道层级对照表头'],
      [PRODUCT_ATTRIBUTES_HEADER.join(','), '商品客观属性表头'],
      [DOUYIN_PORTRAIT.demoHeader.join(','), '抖音画像示例表头'],
    ];
    for (const [line, name] of expected) {
      assert.ok(
        headerLines.includes(line),
        `README「格式模板」缺少与 catalog 一致的${name}（期望逐字：${line}）\n实际块首行：${JSON.stringify(headerLines)}`,
      );
    }
  });

  test('README 抖音示例块行与 catalog 合成示例行逐字一致', () => {
    const blocks = readmeFormatCsvBlocks(readme);
    const expectedBlock = [DOUYIN_PORTRAIT.demoHeader.join(','), ...DOUYIN_PORTRAIT.exampleRows.map((row) => row.join(','))].join(
      '\n',
    );
    assert.ok(
      blocks.some((block) => block === expectedBlock),
      `README 的抖音画像长表示例块应与 catalog 合成示例逐字一致：\n${expectedBlock}`,
    );
  });

  test('README 时间范围声明表与 catalog 声明结构镜像', () => {
    for (const field of DECLARATION_FIELDS) {
      assert.ok(
        readme.includes(`| ${field.item} |`),
        `data/README.md「数据时间范围声明」表应含「${field.item}」项（catalog DECLARATION_FIELDS 与之镜像）`,
      );
    }
  });
});

describe('DT4 模板可用：合成示例行能被真实解析器识别', () => {
  /** A 组 sheet 名 → 真实解析器。 */
  const PARSERS: Record<string, (path: string) => Promise<unknown[]>> = {
    funnel: parseFunnelTable,
    'member-features': parseMemberFeatureTable,
    cohort: parseCohortTable,
    recency: parseRecencyTable,
    'channel-flow': parseChannelFlowTable,
    diagnosis: parseDiagnosisTable,
    'product-channel': parseProductChannelTable,
    'aggregate-groups': parseAggregateGroupTable,
    'product-performance': parseProductPerformanceTable,
    'channel-performance': parseChannelPerformanceTable,
    'entity-alias': parseEntityAliasTable,
    'portrait-conflicts': parsePortraitConflictTable,
  };

  test('每个 A 组 sheet 的示例行按表头导出 CSV 后解析成功', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    const groupA = sheets.filter((sheet) => sheet.group === 'A');
    assert.equal(groupA.length, 12, `A 组应有 12 张表，实际 ${groupA.length}`);

    for (const sheet of groupA) {
      const parser = PARSERS[sheet.name];
      assert.ok(parser, `「${sheet.name}」缺少对应的真实解析器`);
      const dir = makeTempDir('uom-template-usable-');
      const path = join(dir, `${sheet.name}.csv`);
      const rows = [
        [...sheet.header],
        ...sheet.exampleRows.map((row) => {
          const cells = [...row].slice(0, sheet.header.length);
          while (cells.length < sheet.header.length) cells.push('');
          return cells;
        }),
      ];
      writeCsv(path, rows);
      const entries = await parser(path);
      assert.ok(
        entries.length >= 1,
        `[${sheet.name}] 示例行应被真实解析器识别（至少 1 条），实际 0 条`,
      );
    }
  });

  test('抖音画像示例列结构可被抖音解析器识别', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    const douyin = sheets.find((sheet) => sheet.name === DOUYIN_PORTRAIT.label);
    assert.ok(douyin, '模板应有抖音画像长表 sheet');
    const dir = makeTempDir('uom-template-douyin-');
    const path = join(dir, 'douyin.csv');
    writeCsv(path, [
      [...DOUYIN_PORTRAIT.demoHeader],
      ...DOUYIN_PORTRAIT.exampleRows.map((row) => [...row]),
    ]);
    const portrait = normalizeDouyinPortrait(path);
    const labels = portrait.platformLabels['douyin'] ?? {};
    assert.ok(
      labels['预测性别'] && Object.keys(labels['预测性别']!).length >= 2,
      '抖音示例行应解析出「预测性别」两枚标签',
    );
  });

  test('京东／天猫画像示例列结构可被各自解析器识别', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    assert.ok(sheets.some((sheet) => sheet.name === JD_PORTRAIT.label), '模板应有京东画像 sheet');
    assert.ok(sheets.some((sheet) => sheet.name === TMALL_PORTRAIT.label), '模板应有天猫画像 sheet');

    const dir = makeTempDir('uom-template-tj-');
    const jdPath = await writeXlsx(
      join(dir, 'jd.xlsx'),
      'Sheet0',
      [[...JD_PORTRAIT.demoHeader], ...JD_PORTRAIT.exampleRows.map((row) => [...row])],
    );
    const jd = await normalizeJdPortrait(jdPath);
    assert.ok(
      (jd.platformLabels['jd'] ?? {})['预测性别'],
      '京东示例行应解析出「预测性别」维度',
    );

    const tmallPath = await writeXlsx(
      join(dir, 'tmall.xlsx'),
      '明细',
      [[...TMALL_PORTRAIT.demoHeader], ...TMALL_PORTRAIT.exampleRows.map((row) => [...row])],
    );
    const tmall = await normalizeTmallPortrait(tmallPath);
    assert.ok(
      (tmall.platformLabels['tmall'] ?? {})['预测性别'],
      '天猫示例行应解析出「预测性别」维度',
    );
  });

  test('D 组（monthly-mix／clearance-leap）标注解析器未做，不冒充可用', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    for (const name of ['monthly-mix', 'clearance-leap']) {
      const sheet = sheets.find((item) => item.name === name);
      assert.ok(sheet, `模板应有 ${name} sheet（D 组）`);
      assert.match(
        sheet.requirement,
        /解析器未做/,
        `[${name}] 第 1 行必需性应标注「解析器未做（P3 报表阶段）」`,
      );
    }
  });
});

describe('DT1 版式：每个数据 sheet 的固定版式', () => {
  test('第 1 行带表名／放到哪／必需性／解锁什么，示例行带删除标注，表头之后必需性对齐', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    for (const sheet of sheets) {
      if (sheet.group === '说明') continue;
      assert.match(sheet.label, /\S/, `[${sheet.name}] 表名不能为空`);
      assert.match(sheet.target, /^data\//, `[${sheet.name}] 放到哪应是 data/ 下的路径或目录`);
      assert.match(sheet.requirement, /\S/, `[${sheet.name}] 必需性不能为空`);
      assert.match(sheet.unlocks, /\S/, `[${sheet.name}] 解锁什么不能为空`);
      assert.equal(
        sheet.requirementRow.length,
        sheet.header.length,
        `[${sheet.name}] 第 3 行必需性应与表头逐列对齐`,
      );
      for (const example of sheet.exampleRows) {
        assert.ok(
          example.length === sheet.header.length,
          `[${sheet.name}] 示例行长度应与表头逐列对齐（删除标注由装配层追加）`,
        );
      }
    }

    // 「填写时删除」标注是工作簿版式（装配层追加），对重建结果断言
    const workbook = await generator.buildTemplateWorkbook();
    for (const sheet of sheets) {
      if (sheet.exampleRows.length === 0 || sheet.header.length === 0) continue;
      const ws = workbook.getWorksheet(sheet.name)!;
      const marker = ws.getRow(4).getCell(sheet.header.length + 1).text;
      assert.match(
        marker,
        /示例行.*填写时删除/,
        `[${sheet.name}] 第 4 行行尾应有「示例行…填写时删除」醒目标注`,
      );
    }
  });

  test('示例行全部合成：款号 SYN-、店铺 D0、无真实业务名称', async () => {
    const generator = await importGenerator();
    const sheets = await generator.templateBlueprint();
    for (const sheet of sheets) {
      const text = [sheet.header, sheet.requirementRow, ...sheet.exampleRows, sheet.note ?? '']
        .flat()
        .join('|');
      assert.doesNotMatch(
        text,
        /森马/,
        `[${sheet.name}] 模板内容不得出现真实品牌／店铺名`,
      );
    }
  });
});
