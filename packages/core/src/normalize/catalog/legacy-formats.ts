/**
 * B／C 组既有格式契约（data-templates DT2 固化；复核修单 B2／B3／B4／S4 修订；
 * 第二轮复核应修 R2-1～R2-4 再修订：抖音列名规则、京东示例维度、
 * 抖音 XLSX 后果如实、京东／天猫文件名带月份与实体名——review-round2.md）。
 *
 * 这里固化的是「新增 12 表之外」的既有输入格式契约：商品主表、渠道店铺宽表
 * （不再提供代码不消费的「渠道层级对照」简化表——review.md B2）、三平台画像的
 * 列结构、合成示例与**文件名／格式／sheet 名硬规则**（review.md B3），
 * 以及 README 时间范围声明表。
 *
 * 「商品客观属性」独立表已删除（review.md B4）：代码没有任何独立的客观属性
 * 加载点，客观属性（品类／版型／面料／工艺材质／IP 等）只能作为商品信息表的
 * 列经字段目录（`packages/core/src/product/catalog/fields.ts` 的 `sources`）
 * 映射进入，不单独成文件。
 *
 * 单一来源约束（data-templates DT2）：
 * - `data/README.md`「格式模板」节的表头块与硬规则文字与这里**逐字一致**，由
 *   `packages/core/test/data-templates.test.ts` 锁定，不再分叉；
 * - `templates/数据模板.xlsx` 的 B／C 组 sheet 由 `scripts/build-data-templates.mjs`
 *   从本文件装配，不手写第二份；
 * - 渠道店铺宽表表头与 `normalize/channel.ts` 的列映射同源，由行为锁测试
 *   （每个表头列都必须被解析器收进字段、不留 attributes）保证不漂移。
 *
 * 示例行全部为**合成演示数据**：款号 `SYN-…`、店铺 `D0…` 演示账号、
 * 品牌「演示品牌」、标签用通用枚举值；不得出现真实店铺／商品／人群名称或数值。
 */

/**
 * 商品主表表头（SKU 级，一款多行时按款号去重）。
 *
 * 列名与商品字段目录（`product/catalog/fields.ts`）的 `sources` 对齐：
 * 「品类」→ category_l3、「中类」→ category_l2；不提供目录外的列
 * （复核 R-3／S4：「商品品类」「二级品类」「企划件单价」不在目录内，
 * 照填会落 extra、品类丢失，预测输入缺品类）。
 */
export const PRODUCT_MASTER_HEADER: readonly string[] = [
  '款号',
  'ID',
  '商品名称',
  '品类',
  '中类',
  '季节',
  '吊牌价',
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
  'SKU 级，一款多行时按款号去重（保留首行）；列名与商品字段目录 sources 对齐（品类→小类、中类→中类），目录外的列会落 extra 不参与字段映射；指标口径以《指标字典-品牌经营业务》为准';

/**
 * 渠道店铺宽表表头（review.md B2 修单）。
 *
 * 与 `normalize/channel.ts` 的列映射同源：「店铺编码」是主键必需列
 * （缺它解析器抛 `渠道表缺少店铺编码列`）；其余列可选；表头之外的列
 * 也会收进 attributes 不丢数据。行为锁测试保证每个表头列都被解析器消费。
 */
export const CHANNEL_STORE_WIDE_HEADER: readonly string[] = [
  '店铺编码',
  '店铺',
  '渠道品牌',
  '平台',
  '渠道类型',
  '渠道等级',
  '一级渠道',
  '二级渠道',
  '省份',
  '城市',
  '城市级别',
  '门店状态',
  '开店时间',
  '关店时间',
];

/** 渠道店铺宽表主键列（与解析器的必需列检查同源语义）。 */
export const CHANNEL_STORE_KEY = '店铺编码';

export const CHANNEL_STORE_LABEL = '渠道店铺宽表';
export const CHANNEL_STORE_NOTE =
  '渠道主数据按 data/domains/02_渠道信息/ 的渠道店铺宽表提供：「店铺编码」是主键必需列，其余列可选；未列出的列也会收进 attributes 不丢数据。不再提供代码不消费的「渠道层级对照」简化表（复核 B2）';

/** 渠道店铺宽表合成示例（与 CHANNEL_STORE_WIDE_HEADER 对齐）。 */
export const CHANNEL_STORE_EXAMPLE_ROWS: readonly (readonly string[])[] = [
  ['D00001', '演示账号1', '演示品牌', '抖音', '抖音直播', '核心店', '内容渠道', '品牌自播', '上海', '上海', '新一线', '营业', '2024-01-01', ''],
  ['D00002', '演示旗舰店', '演示品牌', '天猫', '天猫旗舰', '旗舰店', '电商渠道', '品牌旗舰店', '浙江', '杭州', '新一线', '营业', '2024-01-01', ''],
];

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
  /**
   * 文件名硬规则（review.md B3／R-1）：不按规则命名的文件**静默跳过**，
   * 业务方以为给了数据却没有效果。
   */
  fileNameRule: string;
  /**
   * 表头硬规则（review-round2 应修 R2-1）：平台画像的实体／月份取自哪里、
   * 业务侧要改什么。目前仅抖音需要（实体与月份取自第 3／4 列列名）；
   * 京东／天猫取自文件名，要求写在 fileNameRule 里。
   */
  headerRule?: string;
  /** 允许的文件格式（按解析器实际；「CSV 与 XLSX 均可」只对真正两者都认的表成立）。 */
  saveFormat: string;
  /** XLSX 的 sheet 名要求（CSV 无 sheet，写「—」）。 */
  sheetName: string;
  /** 目录约定。 */
  targetDirs: string;
}

/**
 * 抖音列名硬规则（review-round2 应修 R2-1，最高优先级）：
 * 抖音画像的**实体名与月份取自列名**（`normalize/index.ts` 从「…-占比」列名解析，
 * `normalize/identity.ts` `parsePortraitEntityId`），文件名与所在目录不参与。
 * 业务侧必须把模板第 3／4 列列名改成自己的「起止年月＋实体名」，否则画像会
 * **静默**全部归到模板演示实体「演示账号1」，无法与渠道宽表关联，且无任何报错。
 */
export const DOUYIN_HEADER_RULE =
  '抖音画像长表例外：第 3／4 列列名必须改为「<起止年月><实体名>-占比」与「<起止年月><实体名>-tgi」（如 2601-2612演示账号1-占比）——抖音画像的实体名与月份取自列名，不是文件名或所在目录；不改列名会把画像全部静默归到模板演示实体「演示账号1」，实体名须与渠道店铺宽表「店铺」列一致';

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
  note:
    '标签类型至少覆盖六个统一维度：预测性别、预测年龄段、策略人群、消费能力、城市等级、预测人生阶段；原始年龄段档位不要提前归并（三平台分档各不相同）；TGI 缺失留空，不要填 0；'
    + DOUYIN_HEADER_RULE,
  fileNameRule:
    '文件名须以「_抖音.csv」结尾（后缀精确匹配，且优先于所在目录；只含「抖音」不够；文件名不参与实体／月份识别——实体与月份取自列名）',
  headerRule: DOUYIN_HEADER_RULE,
  // review-round2 应修 R2-3：抖音存成 XLSX 会被 platform.ts 当 douyin、按 CSV 文本
  // 解析二进制 → 找不到「…-占比」列 → NormalizationError 中断整个 buildIndex，
  // 不是「不被识别／静默跳过」，措辞必须如实。
  saveFormat: '仅 CSV（抖音解析器按 CSV 文本读取；存成 XLSX 会导致索引构建报错中断，不是静默跳过）',
  sheetName: '—（CSV 无 sheet）',
  targetDirs: 'data/source/live/<账号名>/<YYYY-MM>/、data/source/product-card/<店铺名>/<YYYY-MM>/ 或 data/domains/07_人群画像/抖音/',
};

/** 京东画像契约（XLSX，sheet「Sheet0」，占比已是小数）。 */
export const JD_PORTRAIT: PortraitFormatSpec = {
  platform: 'jd',
  label: '京东画像表',
  structureText: JD_STRUCTURE_TEXT,
  demoHeader: ['标签名', '枚举值', '占比', 'TGI'],
  // review-round2 应修 R2-2：京东原生维度名是「性别」（不是「预测性别」，
  // 见 portrait/catalog/dimensions.ts jd sourceDimensions）——示例照真实导出
  // 的京东维度名给，照「预测性别」填的行不进统一维度投影（gender 丢失）。
  exampleRows: [
    ['性别', '男', '0.5', '100'],
    ['性别', '女', '0.5', '100'],
  ],
  hasTgi: true,
  note: '京东原生维度名：性别、年龄、十大靶群、购买力、城市线级——照京东导出的原生维度名填写才能投影到统一维度（写成抖音的「预测性别」不进投影）；京东占比导出已是小数（0.5＝50%），按原值读取；TGI 缺失留空，不要填 0',
  // review-round2 应修 R2-4：京东实体与月份取自文件名（identity.ts parseFileNameEntity），
  // 缺了会静默错挂（如「画像_京东.xlsx」→ 实体「画像」、月份空，无报错）。
  fileNameRule:
    '文件名须为「<起止年月><实体名>_京东.xlsx」形式：带月份与实体名且以「_京东.xlsx」结尾（如 2601-2612演示账号1_京东.xlsx；只含「京东」不够；实体与月份取自文件名，缺了会静默错挂到错误实体；后缀优先于所在目录，放 source/tmall/ 也会被识别为京东）',
  saveFormat: '仅 XLSX（CSV 不被识别）',
  sheetName: '必须为 Sheet0',
  targetDirs: 'data/source/tmall/<店铺名>/<YYYY-MM>/ 或 data/domains/07_人群画像/京东/',
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
  // review-round2 应修 R2-4：天猫实体与月份同样取自文件名，缺了静默错挂。
  fileNameRule:
    '文件名须为「<起止年月><实体名>_天猫.xlsx」形式：带月份与实体名且以「_天猫.xlsx」结尾（如 2601-2612演示账号1_天猫.xlsx；实体与月份取自文件名，缺了会静默错挂；后缀精确匹配，且优先于所在目录）',
  saveFormat: '仅 XLSX（CSV 不被识别）',
  sheetName: '必须为 明细',
  targetDirs: 'data/source/tmall/<店铺名>/<YYYY-MM>/ 或 data/domains/07_人群画像/天猫/',
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
