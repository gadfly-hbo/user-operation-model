#!/usr/bin/env node
/**
 * 数据模板包生成器（变更 `openspec/changes/data-templates/`，任务 DT-2／DT-3）。
 *
 * 从代码契约装配 `templates/数据模板.xlsx`：
 * - A 组 12 张新表：表头与必需性取自 `packages/core/src/normalize/catalog/tables.ts`
 *   （`TABLE_SPECS`），落到哪取自 `packages/core/src/index/build.ts`（`TABLE_SOURCES`）；
 * - B／C 组既有格式：`packages/core/src/normalize/catalog/legacy-formats.ts`（DT2 固化）；
 * - D 组（monthly-mix／clearance-leap）：按《要数清单》第 9、10 项列要求，标注「解析器未做」；
 * - E 组：时间范围声明表（镜像 data/README.md，填在 README 不是文件）。
 *
 * 版式（spec §4）：第 1 行 表名｜放到哪｜必需性｜解锁什么；第 2 行表头（冻结）；
 * 第 3 行 必需／可选｜口径；第 4 行起合成示例行（醒目标注「填写时删除」）；其余留空。
 * 每个 sheet 顶部说明「另存为单独 CSV 或 XLSX，放到第 1 行写的路径」。
 *
 * 边界（DT5）：**不读 `data/`**、不出网、零新增依赖（exceljs 是 @uom/core 既有依赖）。
 * 示例行全部合成：款号 `SYN-…`、店铺 `D0…` 演示账号、品牌「演示品牌」、
 * 标签用通用枚举值；不含任何真实店铺／商品／人群名称或数值。
 *
 * 运行：`npm run templates:build`（需先 `npm run build` 产出 core 的 dist 契约）。
 * 防漂移测试（`packages/core/test/data-templates.test.ts`）调用本文件的
 * `templateBlueprint()`／`buildTemplateWorkbook()` 在内存重建并与入库文件比对。
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const CORE_DIST = join(REPO_ROOT, 'packages', 'core', 'dist', 'src');
const OUTPUT_PATH = join(REPO_ROOT, 'templates', '数据模板.xlsx');

/** 加载 core 编译后的契约（tables.ts、legacy-formats.ts 与 index/build.ts 的产物）。 */
async function loadCoreContracts() {
  const modules = [
    ['normalize/catalog/tables.js'],
    ['normalize/catalog/legacy-formats.js'],
    ['index/build.js'],
  ].map(([file]) => join(CORE_DIST, file));
  for (const file of modules) {
    if (!existsSync(file)) {
      throw new Error(`缺少 packages/core 构建产物 dist/src/${file.replace(CORE_DIST + '/', '')}：先运行 npm run build`);
    }
  }
  const [tables, legacy, build] = await Promise.all(modules.map((file) => import(pathToFileURL(file).href)));
  return { tables, legacy, build };
}

/** 第 3 行的逐列必需性／口径（取自列契约的 required 与 type）。 */
function columnRequirement(column) {
  const kind =
    column.type === 'percent'
      ? '占比：含%则除以100'
      : column.type === 'number'
        ? '数值'
        : '文本';
  return `${column.required ? '必需' : '可选'}（${kind}）`;
}

/** A 组 12 张新表：必需性与解锁什么取自《要数清单》（docs/data-request.md）对应项。 */
const A_GROUP = [
  { key: 'funnel', name: 'funnel', requirement: 'P2 级 · 可选（到位即生效）', unlocks: '漏斗查询、T+7 验真（要数清单第 14 项）' },
  { key: 'memberFeatures', name: 'member-features', requirement: 'P1 级 · 可选（到位即生效）', unlocks: '会员特征查询、工具2 特征（要数清单第 11 项）' },
  { key: 'cohort', name: 'cohort', requirement: 'P1 级 · 可选（到位即生效）', unlocks: '报表 R2（要数清单第 5 项）' },
  { key: 'recency', name: 'recency', requirement: 'P1 级 · 可选（到位即生效）', unlocks: '报表 R3（要数清单第 6 项）' },
  { key: 'channelFlow', name: 'channel-flow', requirement: 'P1 级 · 可选（到位即生效）', unlocks: '报表 R4（要数清单第 7 项）' },
  { key: 'diagnosis', name: 'diagnosis', requirement: 'P1 级 · 可选（到位即生效）', unlocks: '报表 R6 红黄绿灯（要数清单第 8 项）' },
  { key: 'productChannel', name: 'product-channel', requirement: 'P0 级 · 可选（到位后支持按渠道筛商品）', unlocks: '按渠道筛商品、渠道级成交（要数清单第 4 项）' },
  { key: 'aggregateGroups', name: 'aggregate-groups', requirement: 'P2 级 · 可选（到位后支持 series／hot／ip 聚合）', unlocks: '聚合画像的系列／爆款／IP 层级（要数清单第 15 项）' },
  { key: 'productPerformance', name: 'product-performance', requirement: 'P0 级 · 可选（到位后单品档案带经营指标）', unlocks: '错配清单的真实排序、权重校准（要数清单第 2 项）' },
  { key: 'channelPerformance', name: 'channel-performance', requirement: 'P0 级 · 可选（到位后渠道档案带经营指标）', unlocks: '渠道档案补全、跨渠道对比的业务侧证据（要数清单第 3 项）' },
  { key: 'entityAlias', name: 'entity-alias', requirement: 'P3 级 · 可选（到位后画像↔渠道关联修复）', unlocks: '同门店跨期导出名不一致的断链修复（要数清单第 16 项）' },
  { key: 'portraitConflicts', name: 'portrait-conflicts', requirement: '可选（到位后跨平台冲突按显式映射处置）', unlocks: '跨平台画像冲突显式处置，不隐式合并（见 data/README.md 与归一化规则 §12.5）' },
];

/** A 组合成示例行（与 TABLE_SPECS 列序对齐；全部合成数据）。 */
const A_EXAMPLE_ROWS = {
  funnel: [['SYN-0001', '2026-10', '上新', '1000', '100', '50', '40', '10', '2']],
  'member-features': [['一级特征', '价格渠道', '价格带', '高', '示例行：业务方案 §5.2 字段集']],
  cohort: [['2026-01', '100', '30%', '20%', '15%', '5%']],
  recency: [['2026-10', '1-30', '50', '25%', '演示品类', 'D00001', '50%']],
  'channel-flow': [['2026-10', 'D00001', 'D00002', '10', '10%']],
  diagnosis: [['2026-10', '二回断崖', '20%', '', '', '', '', '']],
  'product-channel': [['SYN-0001', 'D00001', '2026-10', '10000', '100']],
  'aggregate-groups': [['SYN-0001', '演示系列', '演示爆款组', '演示IP']],
  'product-performance': [['SYN-0001', '2026-10', '10000', '100', '60%', '10%', '5%', '50%', '1000', '3%']],
  'channel-performance': [['D00001', '2026-10', '50000', '200', '3%', '250', '45%']],
  'entity-alias': [['演示账号1', '演示账号1旧导出名', 'D00001', '抖音']],
  'portrait-conflicts': [['SYN-0001', '2026-10', '抖音', '天猫', 'keep-a', '示例行：保留抖音侧']],
};

/** B 组合成示例行（legacy-formats 表头之外的示例内容）。 */
const B_EXAMPLE_ROWS = {
  products: [[
    'SYN-0001', 'SYN-0001-01', '演示商品', '演示品类', '演示二级品类', '秋季',
    '299', '199', '19900', '100', '199', '0.67', '0.45', '0.03', '0.10', '5000', '0.02',
  ]],
  channels: [
    ['D00001', '演示账号1', '抖音直播', '演示品牌', '账号'],
    ['D00002', '演示账号2', '抖音商品卡', '演示品牌', '店铺'],
  ],
  'product-attributes': [['SYN-0001', '演示版型', '演示面料', '演示工艺', '演示IP']],
};

/** B 组逐列必需性（与 legacy-formats 表头对齐）。 */
const B_REQUIREMENT_ROWS = {
  products: [
    '必需（文本）', '可选（文本）', '可选（文本）', '可选（文本）', '可选（文本）', '可选（文本）',
    '可选（数值）', '可选（数值）', '可选（数值）', '可选（数值）', '可选（数值）', '可选（数值）',
    '可选（数值）', '可选（数值）', '可选（数值）', '可选（数值）', '可选（数值）',
  ],
  channels: ['必需（文本）', '必需（文本）', '可选（文本）', '可选（文本）', '可选（文本）'],
  'product-attributes': ['必需（文本）', '可选（文本）', '可选（文本）', '可选（文本）', '可选（文本）'],
};

/** C 组画像 sheet 的逐列必需性。 */
const PORTRAIT_REQUIREMENT_ROWS = {
  douyin: ['必需（文本：六统一维度之一）', '必需（文本）', '必需（占比：含%则除以100）', '可选（TGI 缺失留空，不要填 0）'],
  jd: ['必需（文本）', '必需（文本）', '必需（占比：已是小数，0.5＝50%）', '可选（TGI 缺失留空，不要填 0）'],
  tmall: ['必需（文本）', '必需（文本）', '必需（占比：含%则除以100）'],
};

/** 组装模板蓝图（纯数据；测试与写文件共用这一份）。 */
export async function templateBlueprint() {
  const { tables, legacy, build } = await loadCoreContracts();
  const sheets = [];

  sheets.push({
    name: '使用说明',
    group: '说明',
    label: '数据模板包使用说明',
    target: '（工作簿级说明，不落盘）',
    requirement: '—',
    unlocks: '—',
    header: [],
    requirementRow: [],
    exampleRows: [],
  });

  // ── A 组：12 张新表（TABLE_SPECS × TABLE_SOURCES） ─────────────
  for (const entry of A_GROUP) {
    const spec = tables.TABLE_SPECS[entry.key];
    if (!spec) throw new Error(`TABLE_SPECS 缺少「${entry.key}」契约`);
    const sources = build.TABLE_SOURCES[entry.key];
    if (!sources) throw new Error(`TABLE_SOURCES 缺少「${entry.key}」落盘路径`);
    sheets.push({
      name: entry.name,
      group: 'A',
      label: spec.label,
      target: `data/${sources[0]}`,
      requirement: entry.requirement,
      unlocks: entry.unlocks,
      header: spec.columns.map((column) => column.name),
      requirementRow: spec.columns.map(columnRequirement),
      exampleRows: A_EXAMPLE_ROWS[entry.name] ?? [],
      note: `主键：${spec.key.join('＋')}`,
    });
  }

  // ── B 组：既有主数据（legacy-formats 固化） ────────────────────
  sheets.push(
    {
      name: 'products',
      group: 'B',
      label: legacy.PRODUCT_MASTER_LABEL,
      target: 'data/domains/04_商品信息/（商品宽表等 XLSX，文件名含「商品…信息表／商品宽表」即被识别）',
      requirement: '必需',
      unlocks: '商品主数据：工具1／工具2／索引的商品档案基础',
      header: [...legacy.PRODUCT_MASTER_HEADER],
      requirementRow: B_REQUIREMENT_ROWS.products,
      exampleRows: B_EXAMPLE_ROWS.products,
      note: legacy.PRODUCT_MASTER_NOTE,
    },
    {
      name: 'channels',
      group: 'B',
      label: legacy.CHANNEL_HIERARCHY_LABEL,
      target: 'data/domains/02_渠道信息/（渠道店铺宽表 XLSX）',
      requirement: '必需（≥2 渠道时；可直接用渠道店铺宽表）',
      unlocks: '渠道主数据：画像↔渠道关联、跨渠道对比',
      header: [...legacy.CHANNEL_HIERARCHY_HEADER],
      requirementRow: B_REQUIREMENT_ROWS.channels,
      exampleRows: B_EXAMPLE_ROWS.channels,
      note: legacy.CHANNEL_HIERARCHY_NOTE,
    },
    {
      name: 'product-attributes',
      group: 'B',
      label: legacy.PRODUCT_ATTRIBUTES_LABEL,
      target: 'data/domains/04_商品信息/（建模商品信息表 XLSX，与商品宽表同目录）',
      requirement: '建议（P2 工具2 用）',
      unlocks: '工具2 预测画像的客观属性输入、聚合口径',
      header: [...legacy.PRODUCT_ATTRIBUTES_HEADER],
      requirementRow: B_REQUIREMENT_ROWS['product-attributes'],
      exampleRows: B_EXAMPLE_ROWS['product-attributes'],
      note: legacy.PRODUCT_ATTRIBUTES_NOTE,
    },
  );

  // ── C 组：平台画像（抖音长表 CSV／京东、天猫 XLSX／小红书说明） ──
  const PORTRAIT_TARGETS = {
    douyin: 'data/source/live/<账号名>/<YYYY-MM>/、data/source/product-card/<店铺名>/<YYYY-MM>/ 或 data/domains/07_人群画像/抖音/（CSV）',
    jd: 'data/source/tmall/<店铺名>/<YYYY-MM>/（文件名含「京东」）或 data/domains/07_人群画像/京东/（XLSX）',
    tmall: 'data/source/tmall/<店铺名>/<YYYY-MM>/ 或 data/domains/07_人群画像/天猫/（XLSX）',
  };
  const PORTRAIT_REQUIREMENTS = {
    douyin: 'P0 级 · 多渠道画像源（六统一维度）',
    jd: '可选（跨平台画像）',
    tmall: '可选（跨平台画像）',
  };
  const PORTRAIT_UNLOCKS = {
    douyin: '货渠匹配的真实多通道路径、跨渠道对比（要数清单第 1 项）',
    jd: '跨平台画像对比',
    tmall: '跨平台画像对比',
  };
  for (const spec of legacy.PORTRAIT_FORMATS) {
    sheets.push({
      name: spec.label,
      group: 'C',
      label: spec.label,
      target: PORTRAIT_TARGETS[spec.platform],
      requirement: PORTRAIT_REQUIREMENTS[spec.platform],
      unlocks: PORTRAIT_UNLOCKS[spec.platform],
      header: [...spec.demoHeader],
      requirementRow: PORTRAIT_REQUIREMENT_ROWS[spec.platform],
      exampleRows: spec.exampleRows.map((row) => [...row]),
      note: spec.note,
    });
  }
  sheets.push({
    name: legacy.XHS_LABEL,
    group: 'C',
    label: legacy.XHS_LABEL,
    target: 'data/domains/07_人群画像/小红书/（Markdown 报告原样放）',
    requirement: '可选（报告原文）',
    unlocks: 'AI-FAB 动态提炼素材（不入归一化层）',
    header: [],
    requirementRow: [],
    exampleRows: [],
    note: legacy.XHS_NOTE,
  });

  // ── D 组：P3 报表预备（解析器未做，按要数清单第 9、10 项列要求） ──
  sheets.push(
    {
      name: 'monthly-mix',
      group: 'D',
      label: '月度大盘人群贡献结构表',
      target: 'data/retention/monthly-mix.csv',
      requirement: 'P1 级 · 报表 R1 底表 · 解析器未做（P3 报表阶段）',
      unlocks: '报表 R1（要数清单第 9 项）',
      header: ['月份', '人群类型', '买家数', '占比', 'MoM', 'YoY', '贡献GMV', 'GMV占比', 'AOV', '件单价', 'UPT'],
      requirementRow: [
        '必需（文本）', '必需（文本）', '可选（数值）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）',
        '可选（占比：含%则除以100）', '可选（数值）', '可选（占比：含%则除以100）', '可选（数值）', '可选（数值）', '可选（数值）',
      ],
      exampleRows: [['2026-10', '首购新客', '100', '20%', '5%', '10%', '50000', '25%', '500', '250', '2']],
      note: '人群类型取值：首购新客／二回老客／成熟活跃老客／同季跨年老客／休眠流失召回客；解析器未做（P3 报表阶段），文件先按本表头备好',
    },
    {
      name: 'clearance-leap',
      group: 'D',
      label: '清仓客次季跃迁明细表',
      target: 'data/retention/clearance-leap.csv',
      requirement: 'P1 级 · 报表 R5 底表 · 解析器未做（P3 报表阶段）',
      unlocks: '报表 R5（要数清单第 10 项）',
      header: ['月份', '加购率', '画像重合度', '正价购买转化率'],
      requirementRow: [
        '必需（文本）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）',
      ],
      exampleRows: [['2026-10', '15%', '60%', '8%']],
      note: '季末清仓新客在次季新品的加购率、画像重合度、正价购买转化率；解析器未做（P3 报表阶段），文件先按本表头备好',
    },
  );

  // ── E 组：时间范围声明（填在 README，不是文件） ─────────────────
  sheets.push({
    name: '时间范围声明',
    group: 'E',
    label: legacy.DECLARATION_LABEL,
    target: 'data/README.md「数据时间范围声明」表（填在 README，不是单独文件）',
    requirement: '建议（未填写时索引覆盖全部扫描文件）',
    unlocks: '索引按声明范围裁剪（不补齐、缺月不回退）',
    header: ['项', '内容', '写法示例'],
    requirementRow: ['必需（文本）', '必填（写在 README 表内）', '—'],
    exampleRows: [],
    note: legacy.DECLARATION_NOTE,
    declarationRows: legacy.DECLARATION_FIELDS.map((field) => [field.item, '', field.example]),
  });

  return sheets;
}

/** 组装工作簿（内存中构建；防漂移测试用 writeBuffer 比对入库文件）。 */
export async function buildTemplateWorkbook() {
  const sheets = await templateBlueprint();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'scripts/build-data-templates.mjs（数据模板包生成器）';

  const USAGE_NOTE =
    '用法：本 sheet 另存为单独的 CSV 或 XLSX，放到「放到哪」写的路径（CSV 与 XLSX 均可）；第 4 行起为合成示例，填写时删除';
  const usageNoteFor = (sheet) => {
    if (sheet.group === '说明') return '说明：本 sheet 是工作簿级使用说明，不落盘';
    if (sheet.group === 'E') {
      return '用法：本 sheet 不落盘——把各项内容填到「放到哪」写的 data/README.md「数据时间范围声明」表（对照「写法示例」列）';
    }
    return USAGE_NOTE;
  };

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);

    // ── 第 1 行：表名｜放到哪｜必需性｜解锁什么｜用法｜口径 ──────
    const titleRow = ws.getRow(1);
    titleRow.getCell(1).value = `表名：${sheet.label}`;
    titleRow.getCell(2).value = `放到哪：${sheet.target}`;
    titleRow.getCell(3).value = `必需性：${sheet.requirement}`;
    titleRow.getCell(4).value = `解锁什么：${sheet.unlocks}`;
    titleRow.getCell(5).value = usageNoteFor(sheet);
    if (sheet.note) titleRow.getCell(6).value = `口径：${sheet.note}`;
    titleRow.font = { bold: true };

    if (sheet.group === '说明') {
      writeUsageSheet(ws);
      continue;
    }

    // ── E 组声明表：第 2 行表头 + 第 4 行起为声明项（镜像 README） ──
    if (sheet.group === 'E') {
      writeHeaderRow(ws, sheet.header);
      for (const [index, row] of sheet.declarationRows.entries()) {
        const rowNumber = 4 + index;
        const target = ws.getRow(rowNumber);
        row.forEach((cell, i) => {
          target.getCell(i + 1).value = cell;
        });
        target.commit();
      }
      freezeHeader(ws);
      continue;
    }

    // ── 小红书说明型 sheet：无表头，A3 起为说明文字 ──────────────
    if (sheet.header.length === 0) {
      const noteRow = ws.getRow(3);
      noteRow.getCell(1).value = sheet.note ?? '';
      noteRow.font = { color: { argb: 'FF404040' } };
      noteRow.alignment = { wrapText: true };
      noteRow.commit();
      continue;
    }

    // ── 常规数据 sheet：表头／必需性／示例行 ─────────────────────
    writeHeaderRow(ws, sheet.header);
    const requirementRow = ws.getRow(3);
    sheet.requirementRow.forEach((cell, i) => {
      requirementRow.getCell(i + 1).value = cell;
    });
    requirementRow.font = { italic: true };
    requirementRow.commit();

    sheet.exampleRows.forEach((example, index) => {
      const rowNumber = 4 + index;
      const row = ws.getRow(rowNumber);
      example.forEach((cell, i) => {
        row.getCell(i + 1).value = cell;
      });
      // 醒目标注：行内红字＋底色，行尾再放一个「填写时删除」标记格
      row.getCell(sheet.header.length + 1).value = '← 示例行（合成数据），填写时删除';
      row.font = { bold: true, color: { argb: 'FFC00000' } };
      for (let c = 1; c <= sheet.header.length + 1; c += 1) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      }
      row.commit();
    });

    freezeHeader(ws);
  }

  // 列宽：说明列放宽，其余适中
  for (const ws of workbook.worksheets) {
    ws.getColumn(1).width = 34;
    ws.getColumn(2).width = 30;
    for (let c = 3; c <= Math.max(ws.columnCount, 6); c += 1) {
      ws.getColumn(c).width = 24;
    }
  }
  return workbook;
}

/** 写第 2 行表头（冻结、加底色）。 */
function writeHeaderRow(ws, header) {
  const row = ws.getRow(2);
  header.forEach((cell, i) => {
    row.getCell(i + 1).value = cell;
  });
  row.font = { bold: true };
  for (let c = 1; c <= header.length; c += 1) {
    row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  }
  row.commit();
}

/** 冻结第 1–2 行（表头行冻结）。 */
function freezeHeader(ws) {
  ws.views = [{ state: 'frozen', ySplit: 2 }];
}

/** 使用说明 sheet 的正文。 */
function writeUsageSheet(ws) {
  const lines = [
    '本模板包由代码契约生成：npm run templates:build（先 npm run build）。表头不要手改；契约改动后重新生成并提交（防漂移测试会比对）。',
    '每个 sheet 是一张输入表：第 1 行写「表名｜放到哪｜必需性｜解锁什么」；第 2 行是表头（不要改）；第 3 行是逐列必需／可选与口径；第 4 行起是合成示例行（填写时删除整行），其余留空。',
    '填写时把每个 sheet 另存为单独的 CSV 或 XLSX，放到该 sheet 第 1 行「放到哪」写的路径（CSV 与 XLSX 均可）；不要把多张表合并在一个文件里。',
    '示例数据全部为合成演示：款号 SYN-…、店铺 D00001 演示账号1／D00002 演示账号2、品牌「演示品牌」、画像标签用通用枚举值；不含任何真实业务数据。',
    '数据时间范围声明填在 data/README.md 的「数据时间范围声明」表（见「时间范围声明」sheet），不是单独文件；HTML 注释占位符里的内容视为未填写。',
    '缺失与冲突原则：缺失不插补、缺月不回退、跨平台画像冲突不隐式合并（docs/normalize-rules.md §7、§12）。业务数据一律留在本机，不上传、不进仓库（data/ 除外说明文件）、不进 CI。',
  ];
  lines.forEach((line, index) => {
    const row = ws.getRow(3 + index);
    row.getCell(1).value = `${index + 1}. ${line}`;
    row.alignment = { wrapText: true };
    row.commit();
  });
}

/** 入口：写出 templates/数据模板.xlsx。 */
export async function main() {
  const workbook = await buildTemplateWorkbook();
  mkdirSync(join(REPO_ROOT, 'templates'), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_PATH);
  process.stdout.write(
    `已生成 templates/数据模板.xlsx（${workbook.worksheets.length} 个 sheet；示例行全部为合成数据；生成器未读取 data/）\n`,
  );
  return OUTPUT_PATH;
}

const invokedDirectly =
  process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`模板生成失败：${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
