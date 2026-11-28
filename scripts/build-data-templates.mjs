#!/usr/bin/env node
/**
 * 数据模板包生成器（变更 `openspec/changes/data-templates/`；复核修单按
 * spec §4 重做版式——review.md 阻断 B1–B4／应修 R-1）。
 *
 * 从代码契约装配 `templates/数据模板.xlsx`：
 * - A 组 12 张新表：表头与必需性取自 `packages/core/src/normalize/catalog/tables.ts`
 *   （`TABLE_SPECS`），放到哪取自 `packages/core/src/index/build.ts`（`TABLE_SOURCES`）；
 * - B 组既有主数据：商品主表 + 渠道店铺宽表（`legacy-formats.ts`；不再提供代码
 *   不消费的「渠道层级对照」与「商品客观属性」——review.md B2／B4）；
 * - C 组平台画像：抖音／京东／天猫（含**文件名／格式／sheet 名硬规则**，B3）；
 *   小红书为说明型 sheet（Markdown 报告，不另存表格）；
 * - D 组（monthly-mix／clearance-leap）：按《要数清单》第 9、10 项列要求，
 *   「表目录」标注解析器未实现（P3 报表阶段）；
 * - E 组：时间范围声明（填在 data/README.md，不是文件）。
 *
 * 版式（spec §4，2026-11-28 重做）：
 * - 「使用说明」「表目录」「列说明」三个说明 sheet 承载全部说明；
 * - 每个数据 sheet：第 1 行＝表头（冻结）；第 2 行＝合成示例（首列「示例-」前缀、
 *   行尾红字「填写前删除本行」、底色高亮）；第 3 行起留空。
 *   **说明行不占用数据 sheet 的行**——业务侧删掉第 2 行示例、填入数据后，
 *   另存出来的文件第 1 行就是表头，可被解析器直接识别（spec §4 硬要求、DT7）。
 *
 * 边界（DT5）：**不读 `data/`**、不出网、零新增依赖（exceljs 是 @uom/core 既有依赖）。
 * 示例行全部合成：款号 `SYN-…`、店铺 `D0…` 演示账号、品牌「演示品牌」、
 * 标签用通用枚举值；不含任何真实店铺／商品／人群名称或数值。
 *
 * 运行：`npm run templates:build`（需先 `npm run build` 产出 core 的 dist 契约）。
 * 防漂移测试（`packages/core/test/data-templates.test.ts`）调用本文件的
 * `templateBlueprint()`／`buildTemplateWorkbook()` 在内存重建并与入库文件
 * **全量逐行**比对（review.md R-2）。
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const CORE_DIST = join(REPO_ROOT, 'packages', 'core', 'dist', 'src');
const OUTPUT_PATH = join(REPO_ROOT, 'templates', '数据模板.xlsx');

/** 加载 core 编译后的契约（tables.ts、legacy-formats.ts、index/build.ts、字段目录）。 */
async function loadCoreContracts() {
  const modules = [
    ['normalize/catalog/tables.js'],
    ['normalize/catalog/legacy-formats.js'],
    ['index/build.js'],
    ['product/catalog/fields.js'],
  ].map(([file]) => join(CORE_DIST, file));
  for (const file of modules) {
    if (!existsSync(file)) {
      throw new Error(`缺少 packages/core 构建产物 dist/src/${file.replace(CORE_DIST + '/', '')}：先运行 npm run build`);
    }
  }
  const [tables, legacy, build, fields] = await Promise.all(
    modules.map((file) => import(pathToFileURL(file).href)),
  );
  return { tables, legacy, build, fields };
}

/** A 组列的必需性／口径（取自列契约的 required 与 type）。 */
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

/** 商品主表合成示例行（与 legacy PRODUCT_MASTER_HEADER 对齐）。 */
const PRODUCT_EXAMPLE_ROWS = [
  [
    'SYN-0001', 'SYN-0001-01', '演示商品', '演示品类', '演示中类', '秋季',
    '299', '19900', '100', '199', '0.67', '0.45', '0.03', '0.10', '5000', '0.02',
  ],
];

/** C 组画像 sheet 的逐列必需性。 */
const PORTRAIT_REQUIREMENT_ROWS = {
  douyin: ['必需（文本：六统一维度之一）', '必需（文本）', '必需（占比：含%则除以100）', '可选（TGI 缺失留空，不要填 0）'],
  jd: ['必需（文本）', '必需（文本）', '必需（占比：已是小数，0.5＝50%）', '可选（TGI 缺失留空，不要填 0）'],
  tmall: ['必需（文本）', '必需（文本）', '必需（占比：含%则除以100）'],
};

/** D 组（P3 报表预备）：解析器未实现，按要数清单第 9、10 项列要求备好表头。 */
const D_GROUP = [
  {
    name: 'monthly-mix',
    label: '月度大盘人群贡献结构表',
    requirement: 'P1 级 · 报表 R1 底表 · 解析器未实现（P3 报表阶段）',
    unlocks: '报表 R1（要数清单第 9 项）',
    header: ['月份', '人群类型', '买家数', '占比', 'MoM', 'YoY', '贡献GMV', 'GMV占比', 'AOV', '件单价', 'UPT'],
    columnNotes: [
      '必需（文本）', '必需（文本）', '可选（数值）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）',
      '可选（占比：含%则除以100）', '可选（数值）', '可选（占比：含%则除以100）', '可选（数值）', '可选（数值）', '可选（数值）',
    ],
    exampleRows: [['2026-10', '首购新客', '100', '20%', '5%', '10%', '50000', '25%', '500', '250', '2']],
    note: '人群类型取值：首购新客／二回老客／成熟活跃老客／同季跨年老客／休眠流失召回客；解析器未实现（P3 报表阶段），文件先按本表头备好',
  },
  {
    name: 'clearance-leap',
    label: '清仓客次季跃迁明细表',
    requirement: 'P1 级 · 报表 R5 底表 · 解析器未实现（P3 报表阶段）',
    unlocks: '报表 R5（要数清单第 10 项）',
    header: ['月份', '加购率', '画像重合度', '正价购买转化率'],
    columnNotes: [
      '必需（文本）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）', '可选（占比：含%则除以100）',
    ],
    exampleRows: [['2026-10', '15%', '60%', '8%']],
    note: '季末清仓新客在次季新品的加购率、画像重合度、正价购买转化率；解析器未实现（P3 报表阶段），文件先按本表头备好',
  },
];

/** 商品主表逐列口径（从商品字段目录的 sources 反查，不手写第二份）。 */
function productColumnNotes(header, productFields) {
  return header.map((column) => {
    const field = (productFields ?? []).find(
      (candidate) => Array.isArray(candidate.sources) && candidate.sources.includes(column),
    );
    if (!field) return '可选（文本；字段目录未登记，归一化落 extra 不参与映射）';
    const kind =
      field.type === 'number' ? '数值' : field.type === 'boolean' ? '布尔' : '文本';
    return `${field.required ? '必需' : '可选'}（${kind}；字段：${field.label}）`;
  });
}

/** 渠道店铺宽表逐列口径（主键列必需，其余可选）。 */
function channelColumnNotes(header, legacy) {
  return header.map((column) =>
    column === legacy.CHANNEL_STORE_KEY ? '必需（文本，主键）' : '可选（文本）',
  );
}

/**
 * 组装模板蓝图（纯数据；测试与写文件共用这一份）。
 *
 * sheet.kind：usage（使用说明）／catalog（表目录）／columnDoc（列说明）／
 * data（数据 sheet）／text（说明型，如小红书）／declaration（E 组）。
 */
export async function templateBlueprint() {
  const { tables, legacy, build, fields } = await loadCoreContracts();
  const dataSheets = [];

  // ── A 组：12 张新表（TABLE_SPECS × TABLE_SOURCES） ─────────────
  for (const entry of A_GROUP) {
    const spec = tables.TABLE_SPECS[entry.key];
    if (!spec) throw new Error(`TABLE_SPECS 缺少「${entry.key}」契约`);
    const sources = build.TABLE_SOURCES[entry.key];
    if (!sources) throw new Error(`TABLE_SOURCES 缺少「${entry.key}」落盘路径`);
    const targetText =
      `data/${sources[0]}` +
      (sources.length > 1
        ? `（也认 ${sources.slice(1).map((path) => `data/${path}`).join('、')}）`
        : '');
    dataSheets.push({
      kind: 'data',
      name: entry.name,
      group: 'A',
      label: spec.label,
      target: targetText,
      fileNameRule: `文件名必须精确为 ${entry.name}.csv 或 ${entry.name}.xlsx（解析器按精确文件名探测，其它名字不会被读取、静默跳过）`,
      saveFormats: 'CSV 或 XLSX 均可（同名换扩展名；XLSX 数据放第 1 个 sheet，无 sheet 名要求）',
      requirement: entry.requirement,
      unlocks: entry.unlocks,
      parserStatus: '已实现',
      header: spec.columns.map((column) => column.name),
      columnNotes: spec.columns.map(columnRequirement),
      exampleRows: A_EXAMPLE_ROWS[entry.name] ?? [],
      note: `主键：${spec.key.join('＋')}`,
    });
  }

  // ── B 组：既有主数据（商品主表 + 渠道店铺宽表；B2／B4 修单后不再有另两张） ──
  dataSheets.push(
    {
      kind: 'data',
      name: 'products',
      group: 'B',
      label: legacy.PRODUCT_MASTER_LABEL,
      target: 'data/domains/04_商品信息/（文件名含「商品…信息表」或「商品宽表」即被识别，如 商品宽表.xlsx）',
      fileNameRule: '文件名须含「商品…信息表」或「商品宽表」（如 商品宽表.xlsx）；放到 data/domains/04_商品信息/',
      saveFormats: '仅 XLSX（CSV 不被扫描识别；数据放第 1 个 sheet，第 1 行＝表头）',
      requirement: '必需',
      unlocks: '商品主数据：工具1／工具2／索引的商品档案基础',
      parserStatus: '已实现',
      header: [...legacy.PRODUCT_MASTER_HEADER],
      columnNotes: productColumnNotes(legacy.PRODUCT_MASTER_HEADER, fields.PRODUCT_FIELDS),
      exampleRows: PRODUCT_EXAMPLE_ROWS,
      note: legacy.PRODUCT_MASTER_NOTE,
    },
    {
      kind: 'data',
      name: 'channels',
      group: 'B',
      label: legacy.CHANNEL_STORE_LABEL,
      target: 'data/domains/02_渠道信息/（文件名含「渠道…宽表」或「店铺…宽表」，如 渠道店铺宽表.xlsx）',
      fileNameRule: '文件名须含「渠道…宽表」或「店铺…宽表」（如 渠道店铺宽表.xlsx）；放到 data/domains/02_渠道信息/',
      saveFormats: `仅 XLSX（数据放第 1 个 sheet，第 1 行＝表头；必需列「${legacy.CHANNEL_STORE_KEY}」）`,
      requirement: '必需（≥2 渠道时）',
      unlocks: '渠道主数据：画像↔渠道关联、跨渠道对比',
      parserStatus: '已实现',
      header: [...legacy.CHANNEL_STORE_WIDE_HEADER],
      columnNotes: channelColumnNotes(legacy.CHANNEL_STORE_WIDE_HEADER, legacy),
      // spec §4：第 2 行＝示例（一行），第 3 行起留空；多行示例看 data/README.md 模板块
      exampleRows: [legacy.CHANNEL_STORE_EXAMPLE_ROWS[0]].map((row) => [...row]),
      note: legacy.CHANNEL_STORE_NOTE,
    },
  );

  // ── C 组：平台画像（抖音 CSV／京东、天猫 XLSX；文件名与 sheet 名硬规则见契约） ──
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
    dataSheets.push({
      kind: 'data',
      name: spec.label,
      group: 'C',
      label: spec.label,
      target: spec.targetDirs,
      fileNameRule: spec.fileNameRule,
      saveFormats:
        spec.sheetName === '—（CSV 无 sheet）'
          ? spec.saveFormat
          : `${spec.saveFormat}；sheet 名：${spec.sheetName}`,
      requirement: PORTRAIT_REQUIREMENTS[spec.platform],
      unlocks: PORTRAIT_UNLOCKS[spec.platform],
      parserStatus: '已实现',
      header: [...spec.demoHeader],
      columnNotes: PORTRAIT_REQUIREMENT_ROWS[spec.platform],
      // spec §4：第 2 行＝示例（一行），第 3 行起留空；完整示例看 data/README.md 模板块
      exampleRows: [spec.exampleRows[0]].map((row) => [...row]),
      note: spec.note,
    });
  }

  // 小红书画像（说明型，不另存表格）
  const xhsSheet = {
    kind: 'text',
    name: legacy.XHS_LABEL,
    group: 'C',
    label: legacy.XHS_LABEL,
    target: 'data/domains/07_人群画像/小红书/（Markdown 报告原样放）',
    fileNameRule: 'Markdown 报告原文（.md），原样放目录，不改名格式',
    saveFormats: 'Markdown 报告原文（无表格格式，不需要生成表格文件）',
    requirement: '可选（报告原文）',
    unlocks: 'AI-FAB 动态提炼素材（不入归一化层）',
    parserStatus: '不入归一化层（AI-FAB 提炼）',
    lines: [
      `${legacy.XHS_NOTE}`,
      '不需要生成 CSV／XLSX 表格文件：小红书画像是自然语言分析报告，数值散落正文，不可枚举成表格，把报告原文放到「放到哪」写的目录即可。',
    ],
  };

  // ── D 组：P3 报表预备（解析器未实现，按要数清单第 9、10 项列要求） ──
  const dSheets = D_GROUP.map((sheet) => ({
    kind: 'data',
    name: sheet.name,
    group: 'D',
    label: sheet.label,
    target: `data/retention/${sheet.name}.csv`,
    fileNameRule: `文件名必须精确为 ${sheet.name}.csv（放到 data/retention/）`,
    saveFormats: 'CSV（解析器未实现，到位前无消费方；先按本表头备好）',
    requirement: sheet.requirement,
    unlocks: sheet.unlocks,
    parserStatus: '未实现（P3 报表阶段）',
    header: sheet.header,
    columnNotes: sheet.columnNotes,
    exampleRows: sheet.exampleRows,
    note: sheet.note,
  }));

  // ── E 组：时间范围声明（填在 README，不是文件） ─────────────────
  const declarationSheet = {
    kind: 'declaration',
    name: '时间范围声明',
    group: 'E',
    label: legacy.DECLARATION_LABEL,
    target: 'data/README.md「数据时间范围声明」表（填在 README，不是单独文件）',
    fileNameRule: '不落盘（无文件）',
    saveFormats: '不落盘（把各项内容填进 data/README.md 的声明表）',
    requirement: '建议（未填写时索引覆盖全部扫描文件）',
    unlocks: '索引按声明范围裁剪（不补齐、缺月不回退）',
    parserStatus: '已实现（索引构建时读 README）',
    header: ['项', '内容', '写法示例'],
    rows: legacy.DECLARATION_FIELDS.map((field) => [field.item, '', field.example]),
    note: legacy.DECLARATION_NOTE,
  };

  // ── 「表目录」：一行一表（spec §4） ────────────────────────────
  const catalogSheets = [...dataSheets, xhsSheet, ...dSheets, declarationSheet];
  const catalogSheet = {
    kind: 'catalog',
    name: '表目录',
    group: '说明',
    label: '表目录',
    header: ['表名', '数据 sheet 名', '放到哪（含精确文件名规则）', '允许格式（含 sheet 名要求）', '必需性', '解锁什么', '解析器'],
    rows: catalogSheets.map((sheet) => [
      sheet.label,
      sheet.name,
      `${sheet.target}；${sheet.fileNameRule}`,
      sheet.saveFormats,
      sheet.requirement,
      sheet.unlocks,
      sheet.parserStatus,
    ]),
  };

  // ── 「列说明」：一行一列（spec §4） ────────────────────────────
  const columnDocSheet = {
    kind: 'columnDoc',
    name: '列说明',
    group: '说明',
    label: '列说明',
    header: ['表名', '列名', '必需／可选', '口径说明'],
    rows: [...dataSheets, ...dSheets].flatMap((sheet) =>
      sheet.header.map((column, index) => [
        sheet.label,
        column,
        sheet.columnNotes[index] ?? '',
        sheet.note ?? '',
      ]),
    ),
  };

  // ── 「使用说明」：总体步骤（spec §4） ──────────────────────────
  const usageSheet = {
    kind: 'usage',
    name: '使用说明',
    group: '说明',
    label: '数据模板包使用说明',
    lines: [
      '本模板包由代码契约生成：npm run templates:build（先 npm run build）。表头不要手改；契约改动后重新生成并提交（防漂移测试会做全量比对）。',
      '第 1 步 找表：在「表目录」sheet 找到要提供的表，看清「放到哪（含文件名规则）」「允许格式（含 sheet 名要求）」「必需性」「解析器」四列。',
      '第 2 步 填数：打开对应数据 sheet——第 1 行是表头（不要改），第 2 行是合成示例（高亮，行尾标「填写前删除本行」）；删除第 2 行示例，从第 2 行起填入自己的数据。',
      '第 3 步 另存：把该 sheet 单独另存为「表目录」写的格式与文件名（文件名规则必须精确遵守：如京东须以 _京东.xlsx 结尾且 sheet 名为 Sheet0、天猫 sheet 名为 明细、抖音仅 CSV；A 组散表 CSV 或 XLSX 均可），放到「放到哪」写的目录。不要把多张表合并在一个文件里。',
      '第 4 步 声明：数据时间范围声明填在 data/README.md 的「数据时间范围声明」表（见「时间范围声明」sheet），不是单独文件；HTML 注释占位符里的内容视为未填写。',
      '示例数据全部为合成演示：款号 SYN-…、店铺 D00001 演示账号1／D00002 演示账号2、品牌「演示品牌」、画像标签用通用枚举值；不含任何真实业务数据。',
      '缺失与冲突原则：缺失不插补、缺月不回退、跨平台画像冲突不隐式合并（docs/normalize-rules.md §7、§12）。业务数据一律留在本机，不上传、不进仓库（data/ 除外说明文件）、不进 CI。',
    ],
  };

  return [
    usageSheet,
    catalogSheet,
    columnDocSheet,
    ...dataSheets,
    xhsSheet,
    ...dSheets,
    declarationSheet,
  ];
}

/** 组装工作簿（内存中构建；防漂移测试用 writeBuffer 与入库文件全量比对）。 */
export async function buildTemplateWorkbook() {
  const sheets = await templateBlueprint();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'scripts/build-data-templates.mjs（数据模板包生成器）';

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    switch (sheet.kind) {
      case 'usage':
        writeLinesSheet(ws, sheet.lines);
        break;
      case 'catalog':
      case 'columnDoc':
        writeGridSheet(ws, sheet.header, sheet.rows);
        break;
      case 'text':
        writeLinesSheet(ws, sheet.lines);
        break;
      case 'declaration':
        writeDeclarationSheet(ws, sheet);
        break;
      default:
        writeDataSheet(ws, sheet);
        break;
    }
  }

  // 列宽：说明列放宽，其余适中
  for (const ws of workbook.worksheets) {
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 30;
    for (let c = 3; c <= Math.max(ws.columnCount, 6); c += 1) {
      ws.getColumn(c).width = 26;
    }
  }
  return workbook;
}

/**
 * 数据 sheet 版式（spec §4）：第 1 行＝表头（冻结）；第 2 行＝合成示例
 * （首列「示例-」前缀、行尾红字「填写前删除本行」、底色高亮）；第 3 行起留空。
 */
function writeDataSheet(ws, sheet) {
  const headerRow = ws.getRow(1);
  sheet.header.forEach((cell, i) => {
    headerRow.getCell(i + 1).value = cell;
  });
  headerRow.font = { bold: true };
  for (let c = 1; c <= sheet.header.length; c += 1) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  }
  headerRow.commit();
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.exampleRows.forEach((example, index) => {
    const rowNumber = 2 + index;
    const row = ws.getRow(rowNumber);
    example.forEach((cell, i) => {
      row.getCell(i + 1).value = i === 0 ? `示例-${cell}` : cell;
    });
    row.getCell(sheet.header.length + 1).value = '填写前删除本行';
    row.font = { bold: true, color: { argb: 'FFC00000' } };
    for (let c = 1; c <= sheet.header.length + 1; c += 1) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    }
    row.commit();
  });
}

/** 表目录／列说明：第 1 行表头（冻结），第 2 行起逐行内容。 */
function writeGridSheet(ws, header, rows) {
  const headerRow = ws.getRow(1);
  header.forEach((cell, i) => {
    headerRow.getCell(i + 1).value = cell;
  });
  headerRow.font = { bold: true };
  for (let c = 1; c <= header.length; c += 1) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  }
  headerRow.commit();
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((row, index) => {
    const target = ws.getRow(2 + index);
    row.forEach((cell, i) => {
      target.getCell(i + 1).value = cell;
    });
    target.commit();
  });
}

/** E 组声明表：第 1 行表头，第 2 行起为声明项（内容列留空待填进 README）。 */
function writeDeclarationSheet(ws, sheet) {
  writeGridSheet(ws, sheet.header, sheet.rows);
}

/** 说明型 sheet（使用说明／小红书）：一行一句话。 */
function writeLinesSheet(ws, lines) {
  lines.forEach((line, index) => {
    const row = ws.getRow(1 + index);
    row.getCell(1).value = line;
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
