/**
 * 新增表的列契约与口径登记。
 *
 * 列名以《要数清单》（`docs/data-request.md`）为准，本文件是**唯一来源**：
 * 解析器按契约取列，不在解析器里写死列名或指标词表。
 * 口径说明见 `docs/normalize-rules.md` §12。
 */

/** 列的值类型口径。 */
export type ColumnType = 'text' | 'number' | 'percent';

export interface ColumnSpec {
  /** 规范列名。 */
  name: string;
  /** 同义列名（导出里出现过的其它写法）。 */
  aliases?: string[];
  /** 是否必需列。缺必需列 → `missing-field` 抛错。 */
  required?: boolean;
  /** 值类型。 */
  type?: ColumnType;
  /** 是否是指标列（指标列参与「缺失即缺失」的显式标记）。 */
  metric?: boolean;
  /** 指标键：按指标名取值时用；缺省用列名。 */
  metricKey?: string;
}

export interface TableSpec {
  /** 表的中文名（错误信息与文档用）。 */
  label: string;
  /** 主键列（按顺序）。 */
  key: string[];
  /** 列契约。 */
  columns: ColumnSpec[];
}

/** 漏斗阶段别名 → 规范阶段。 */
export const FUNNEL_PHASE_ALIASES: Record<string, string> = {
  launch: 'launch',
  上新: 'launch',
  首发: 'launch',
  growth: 'growth',
  增长: 'growth',
  clearance: 'clearance',
  清仓: 'clearance',
};

/** 诊断类型别名 → 规范类型。 */
export const DIAGNOSIS_TYPE_ALIASES: Record<string, string> = {
  二回断崖: '二回断崖',
  second_purchase_cliff: '二回断崖',
  虚假繁荣: '虚假繁荣',
  false_prosperity: '虚假繁荣',
  清仓客次季跃迁: '清仓客次季跃迁',
  clearance_leap: '清仓客次季跃迁',
};

/** 聚合层级 → 口径表列名。 */
export const AGGREGATE_LEVEL_COLUMNS: Record<string, string> = {
  series: '系列',
  hot: '爆款组',
  ip: 'IP',
};

/** 平台别名 → 平台标识。 */
export const PLATFORM_ALIASES: Record<string, string> = {
  抖音: 'douyin',
  douyin: 'douyin',
  天猫: 'tmall',
  tmall: 'tmall',
  淘宝: 'tmall',
  京东: 'jd',
  jd: 'jd',
  小红书: 'xhs',
  xhs: 'xhs',
  拼多多: 'pdd',
  pdd: 'pdd',
  快手: 'ks',
  ks: 'ks',
  唯品会: 'vip',
  vip: 'vip',
  得物: 'dewu',
  线下: 'offline',
  实体店: 'offline',
  offline: 'offline',
};

/** 把平台写法归一到平台标识。 */
export function platformId(raw: string): string {
  const text = raw.trim();
  return PLATFORM_ALIASES[text] ?? PLATFORM_ALIASES[text.toLowerCase()] ?? text;
}

/** 漏斗表列契约。 */
const FUNNEL: TableSpec = {
  label: '生命周期漏斗表',
  key: ['款号', '月份', '阶段'],
  columns: [
    { name: '款号', required: true },
    { name: '月份' },
    { name: '阶段', required: true },
    { name: '浏览', type: 'number', metric: true },
    { name: '收藏', type: 'number', metric: true },
    { name: '加购', type: 'number', metric: true },
    { name: '购买', type: 'number', metric: true },
    { name: '直接购买', type: 'number', metric: true },
    { name: '退货', type: 'number', metric: true },
  ],
};

/** 会员特征字典列契约。 */
const MEMBER_FEATURES: TableSpec = {
  label: '会员特征字典',
  key: ['特征字段', '特征值'],
  columns: [
    { name: '特征层级' },
    { name: '特征分组' },
    { name: '特征字段', required: true },
    { name: '特征值', required: true },
    { name: '说明' },
  ],
};

/** Cohort 留存列契约。 */
const COHORT: TableSpec = {
  label: 'Cohort 留存表',
  key: ['首购月份'],
  columns: [
    { name: '首购月份', required: true },
    { name: '买家数', type: 'number' },
    { name: 'Day30留存率', aliases: ['day30', 'D30', '30日留存率'], type: 'percent', metric: true, metricKey: 'day30' },
    { name: 'Day60留存率', aliases: ['day60', 'D60', '60日留存率'], type: 'percent', metric: true, metricKey: 'day60' },
    { name: 'Day90留存率', aliases: ['day90', 'D90', '90日留存率'], type: 'percent', metric: true, metricKey: 'day90' },
    { name: '次季正价跃迁率', aliases: ['次季正价跃迁'], type: 'percent', metric: true, metricKey: 'next_season' },
  ],
};

/** 老客 Recency 分布列契约。 */
const RECENCY: TableSpec = {
  label: '老客 Recency 分布表',
  key: ['月份', '上次购买天数切片'],
  columns: [
    { name: '月份', required: true },
    { name: '上次购买天数切片', required: true },
    { name: '回购人数', type: 'number' },
    { name: '老客内占比', type: 'percent' },
    { name: '唤醒主推品类' },
    { name: '主要购买渠道' },
    { name: '平均毛利率', type: 'percent' },
  ],
};

/** 跨渠道流转矩阵列契约。 */
const CHANNEL_FLOW: TableSpec = {
  label: '跨渠道流转矩阵表',
  key: ['月份', '来源渠道', '回购渠道'],
  columns: [
    { name: '月份', required: true },
    { name: '来源渠道', required: true },
    { name: '回购渠道', required: true },
    { name: '回购人数', type: 'number' },
    { name: '跨渠道回购率', type: 'percent' },
  ],
};

/** 三大诊断输入列契约。 */
const DIAGNOSIS: TableSpec = {
  label: '三大诊断输入表',
  key: ['月份', '诊断类型'],
  columns: [
    { name: '月份', required: true },
    { name: '诊断类型', required: true },
    { name: '大促新客第60天二回比例', aliases: ['大促新客二回比例', '二回比例'], type: 'percent', metric: true },
    { name: 'Recency超180天占比', aliases: ['Recency大于180天占比', '老客超180天占比'], type: 'percent', metric: true },
    { name: '平均毛利率', type: 'percent', metric: true },
    { name: '加购率', type: 'percent', metric: true },
    { name: '画像重合度', type: 'percent', metric: true },
    { name: '正价转化率', type: 'percent', metric: true },
  ],
};

/** 商品 ↔ 渠道关联列契约。 */
const PRODUCT_CHANNEL: TableSpec = {
  label: '商品↔渠道关联表',
  key: ['款号', '店铺编码'],
  columns: [
    { name: '款号', required: true },
    { name: '店铺编码', required: true },
    { name: '月份' },
    { name: '零售额', type: 'number' },
    { name: '零售量', type: 'number' },
  ],
};

/** 聚合口径列契约。 */
const AGGREGATE_GROUPS: TableSpec = {
  label: '聚合口径表',
  key: ['款号'],
  columns: [
    { name: '款号', required: true },
    { name: '系列' },
    { name: '爆款组' },
    { name: 'IP' },
  ],
};

/** 商品经营指标列契约。 */
const PRODUCT_PERFORMANCE: TableSpec = {
  label: '商品经营指标表',
  key: ['款号'],
  columns: [
    { name: '款号', required: true },
    { name: '月份' },
    { name: '零售额', type: 'number' },
    { name: '零售量', type: 'number' },
    { name: '售罄率', type: 'percent' },
    { name: '退货率', type: 'percent' },
    { name: '退款率', type: 'percent' },
    { name: '毛利率', type: 'percent' },
    { name: 'UV', type: 'number' },
    { name: '转化率', type: 'percent' },
  ],
};

/** 渠道经营指标列契约。 */
const CHANNEL_PERFORMANCE: TableSpec = {
  label: '渠道经营指标表',
  key: ['店铺编码'],
  columns: [
    { name: '店铺编码', required: true },
    { name: '月份' },
    { name: '成交额', type: 'number' },
    { name: '成交件数', type: 'number' },
    { name: '转化率', type: 'percent' },
    { name: '客单价', type: 'number' },
    { name: '毛利率', type: 'percent' },
  ],
};

/** 实体别名目录列契约。 */
const ENTITY_ALIAS: TableSpec = {
  label: '实体别名目录',
  key: ['规范实体名', '别名'],
  columns: [
    { name: '规范实体名', required: true },
    { name: '别名', required: true },
    { name: '店铺编码' },
    { name: '平台' },
  ],
};

/** 画像冲突显式映射列契约。 */
const PORTRAIT_CONFLICTS: TableSpec = {
  label: '画像冲突显式映射表',
  key: ['款号或实体', '平台A', '平台B'],
  columns: [
    { name: '款号或实体', required: true },
    { name: '月份' },
    { name: '平台A', required: true },
    { name: '平台B', required: true },
    { name: '处置', required: true },
    { name: '说明' },
  ],
};

/** 全部新增表的列契约。 */
export const TABLE_SPECS: Record<string, TableSpec> = {
  funnel: FUNNEL,
  memberFeatures: MEMBER_FEATURES,
  cohort: COHORT,
  recency: RECENCY,
  channelFlow: CHANNEL_FLOW,
  diagnosis: DIAGNOSIS,
  productChannel: PRODUCT_CHANNEL,
  aggregateGroups: AGGREGATE_GROUPS,
  productPerformance: PRODUCT_PERFORMANCE,
  channelPerformance: CHANNEL_PERFORMANCE,
  entityAlias: ENTITY_ALIAS,
  portraitConflicts: PORTRAIT_CONFLICTS,
};
