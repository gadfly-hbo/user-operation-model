/**
 * B／C 组既有格式契约（data-templates DT2 固化）。
 *
 * 这里固化的是「新增 12 表之外」的既有输入格式契约：商品主表、渠道层级对照、
 * 商品客观属性、四平台画像列结构与 README 时间范围声明表。
 *
 * 单一来源约束（data-templates DT2）：
 * - `data/README.md`「格式模板」节的表头块与这里**逐字一致**，由
 *   `packages/core/test/data-templates.test.ts` 锁定，不再分叉；
 * - `templates/数据模板.xlsx` 的 B／C 组 sheet 由 `scripts/build-data-templates.mjs`
 *   从本文件装配，不手写第二份。
 *
 * 示例行全部为**合成演示数据**：款号 `SYN-…`、店铺 `D0…` 演示账号、
 * 品牌「演示品牌」、标签用通用枚举值；不得出现真实店铺／商品／人群名称或数值。
 */

/** 商品主表表头（SKU 级，一款多行时按款号去重）。 */
export const PRODUCT_MASTER_HEADER: readonly string[] = [
  '款号',
  'ID',
  '商品名称',
  '商品品类',
  '二级品类',
  '季节',
  '吊牌价',
  '企划件单价',
  '零售额',
  '零售量',
  '件单价',
  '零售折扣',
  '经营毛利率',
  '零售退款率',
  '退货退款率',
  'UV',
  '转化率',
];

export const PRODUCT_MASTER_LABEL = '商品主表';
export const PRODUCT_MASTER_NOTE =
  'SKU 级，一款多行时按款号去重（保留首行）；指标口径以《指标字典-品牌经营业务》为准';

/** 渠道层级对照表头。 */
export const CHANNEL_HIERARCHY_HEADER: readonly string[] = [
  '渠道标识',
  '渠道名称',
  '渠道类型',
  '所属品牌',
  '层级',
];

export const CHANNEL_HIERARCHY_LABEL = '渠道层级对照表';
export const CHANNEL_HIERARCHY_NOTE =
  '渠道主数据可直接用 data/domains/02_渠道信息/ 的渠道店铺宽表 XLSX（含「店铺编码」列，归一化按它取主键），不必另建对照表';

/** 商品客观属性表头（背对背隔离 §9.2 的客观属性集的最小目录形态）。 */
export const PRODUCT_ATTRIBUTES_HEADER: readonly string[] = ['款号', '版型', '面料', '工艺', 'IP'];

export const PRODUCT_ATTRIBUTES_LABEL = '商品客观属性表';
export const PRODUCT_ATTRIBUTES_NOTE =
  '客观属性（工具2 预测输入只认品类／版型／面料／工艺／价格带／季节／上新类型／IP 这类客观字段）；列名对应字段目录：「版型」→ silhouette、「面料」→ fabric、「工艺」→ 特殊功能/材质、「IP」→ IP/联名';

/** 平台画像列结构（通用写法，与 data/README.md「格式模板」平台表格逐字一致）。 */
export const DOUYIN_STRUCTURE_TEXT = '标签类型, 标签, <起止年月+实体名>-占比, <起止年月+实体名>-tgi';
export const JD_STRUCTURE_TEXT = '标签名, 枚举值, 占比, TGI';
export const TMALL_STRUCTURE_TEXT = '标签类型, 一级标签(标签值), 占比';

/** 平台画像格式契约。 */
export interface PortraitFormatSpec {
  /** 平台标识（与 `platformId` 一致）。 */
  platform: string;
  /** sheet／文档用中文名。 */
  label: string;
  /** 通用列结构（README 平台表格用，`, ` 分隔）。 */
  structureText: string;
  /** 模板 sheet 与 README 示例块用的具体表头（合成演示实体）。 */
  demoHeader: readonly string[];
  /** 合成示例行（与 demoHeader 对齐）。 */
  exampleRows: readonly (readonly string[])[];
  /** 是否有 TGI 列。 */
  hasTgi: boolean;
  /** 口径说明。 */
  note: string;
}

/** 抖音画像长表契约（CSV；实体与月份写在占比／TGI 列名里）。 */
export const DOUYIN_PORTRAIT: PortraitFormatSpec = {
  platform: 'douyin',
  label: '抖音画像长表',
  structureText: DOUYIN_STRUCTURE_TEXT,
  demoHeader: ['标签类型', '标签', '2601-2612演示账号1-占比', '2601-2612演示账号1-tgi'],
  exampleRows: [
    ['预测性别', '男', '50.00%', '100'],
    ['预测性别', '女', '50.00%', '100'],
  ],
  hasTgi: true,
  note: '标签类型至少覆盖六个统一维度：预测性别、预测年龄段、策略人群、消费能力、城市等级、预测人生阶段；原始年龄段档位不要提前归并（三平台分档各不相同）；TGI 缺失留空，不要填 0',
};

/** 京东画像契约（XLSX，sheet「Sheet0」，占比已是小数）。 */
export const JD_PORTRAIT: PortraitFormatSpec = {
  platform: 'jd',
  label: '京东画像表',
  structureText: JD_STRUCTURE_TEXT,
  demoHeader: ['标签名', '枚举值', '占比', 'TGI'],
  exampleRows: [
    ['预测性别', '男', '0.5', '100'],
    ['预测性别', '女', '0.5', '100'],
  ],
  hasTgi: true,
  note: '京东占比导出已是小数（0.5＝50%），按原值读取；TGI 缺失留空，不要填 0',
};

/** 天猫画像契约（XLSX，sheet「明细」，无 TGI）。 */
export const TMALL_PORTRAIT: PortraitFormatSpec = {
  platform: 'tmall',
  label: '天猫画像表',
  structureText: TMALL_STRUCTURE_TEXT,
  demoHeader: ['标签类型', '一级标签(标签值)', '占比'],
  exampleRows: [
    ['预测性别', '男', '50.00%'],
    ['预测性别', '女', '50.00%'],
  ],
  hasTgi: false,
  note: '天猫导出无 TGI 列，缺失与 0 是两回事，不要补 0；年龄档为闭区间写法（如 [18,24]），不要提前归并',
};

/** 四平台画像契约集合（小红书不可枚举，单独说明）。 */
export const PORTRAIT_FORMATS: readonly PortraitFormatSpec[] = [
  DOUYIN_PORTRAIT,
  JD_PORTRAIT,
  TMALL_PORTRAIT,
];

/** 小红书画像说明（自然语言报告，不可枚举）。 */
export const XHS_LABEL = '小红书画像';
export const XHS_NOTE =
  '小红书是自然语言分析报告，数值散落正文，不可枚举：把报告原文（Markdown）原样放到 data/domains/07_人群画像/小红书/ 即可，不入归一化层，后续由 AI-FAB 动态提炼';

/** README 时间范围声明表结构（镜像 data/README.md「数据时间范围声明」）。 */
export interface DeclarationField {
  /** 表里的「项」名。 */
  item: string;
  /** 写法示例。 */
  example: string;
}

export const DECLARATION_FIELDS: readonly DeclarationField[] = [
  { item: '覆盖月份', example: '2026-07 ~ 2026-11（区间）或 2026-07（单月）' },
  { item: '渠道范围', example: '标识清单，空格或标点分隔（如 D00001 演示账号1）' },
  { item: '商品范围', example: '标识清单（如 SYN-0001 SYN-0002）' },
  { item: '已知缺失', example: '缺什么写什么（如某月仅有品牌画像，无渠道画像）' },
  { item: '说明', example: '任何影响归一化口径的例外' },
];

export const DECLARATION_LABEL = '数据时间范围声明';
export const DECLARATION_NOTE =
  '声明填在 data/README.md 的「数据时间范围声明」表里（不是单独文件），在索引构建时生效，用于裁剪覆盖范围；HTML 注释占位符里的内容视为未填写。声明不补齐：范围外的记录跳过并记 issue，缺月不回退';
