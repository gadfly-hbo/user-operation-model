import type { FieldSpec, FieldUsage } from '../types.js';

/**
 * 商品字段目录。
 *
 * 这是**数据**不是逻辑：新增字段在此追加条目即可，归一化层按 `sources`
 * 自动识别源列。新增字段不要求改动核心代码。
 *
 * `usage` 决定字段能否进入工具2 的预测输入：
 * - `['prediction', 'comparison']` 客观属性
 * - `['comparison']` 人工定位字段，**禁止进入预测路径**（背对背隔离）
 *
 * 来源表：
 * - `商品宽表.xlsx`（SKU 级，200 行 47 列）
 * - `商品-附加字段_modelevol建模用的商品信息表.xlsx`（款号级，257 行 23 列）
 */
export const PRODUCT_FIELDS: FieldSpec[] = [
  // ── 标识与关联 ──────────────────────────────────────────────
  { key: 'spu', label: '款号', type: 'string', required: true, usage: ['prediction', 'comparison'], sources: ['款号'] },
  { key: 'sku_id', label: 'SKU', type: 'string', required: false, usage: ['comparison'], sources: ['SKU'] },
  { key: 'skc_id', label: 'SKC', type: 'string', required: false, usage: ['comparison'], sources: ['SKC'] },
  { key: 'barcode', label: 'SKU 条形码', type: 'string', required: false, usage: ['comparison'], sources: ['SKU条形码'] },
  { key: 'supplier_barcode', label: '供应商条形码', type: 'string', required: false, usage: ['comparison'], sources: ['供应商条形码'] },
  { key: 'platform_product_id', label: '平台商品 ID', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['天猫id', '商品ID', 'ID'] },
  { key: 'platform_link', label: '平台商品链接', type: 'string', required: false, usage: ['comparison'], sources: ['天猫链接', '链接'] },

  // ── 客观商品属性 ────────────────────────────────────────────
  { key: 'brand', label: '品牌', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['商品品牌', '品牌'] },
  { key: 'name', label: '商品名称', type: 'string', required: false, usage: ['comparison'], sources: ['商品名称'] },
  { key: 'gender', label: '性别', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['性别'] },
  {
    key: 'gender_correction',
    label: '性别修正',
    type: 'string',
    required: false,
    usage: ['prediction', 'comparison'],
    sources: ['性别修正'],
    note: '从历史成交回算的事实修正，非人工画像。新款预测不得使用该款自身的修正值，应从同类历史款推算',
  },
  { key: 'year', label: '年份', type: 'number', required: false, usage: ['prediction', 'comparison'], sources: ['年份'] },
  { key: 'season', label: '季节', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['季节'] },
  { key: 'product_season', label: '产品季', type: 'string', required: false, usage: ['prediction'], sources: ['产品季'] },
  { key: 'category_l1', label: '产品链（大类）', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['产品链（大类）'] },
  { key: 'category_l2', label: '中类', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['中类'] },
  { key: 'category_l2_code', label: '中类编码', type: 'string', required: false, usage: ['prediction'], sources: ['中类编码'] },
  { key: 'category_l3', label: '小类', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['小类'] },
  { key: 'product_line', label: '产品线', type: 'string', required: false, usage: ['prediction'], sources: ['产品线', '产品线编码'] },
  { key: 'goods_category', label: '货品分类', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['货品分类'] },
  { key: 'item_attr', label: '款属性', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['款属性'] },
  { key: 'launch_type', label: '上新类型', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['货品属性', '上新类型'] },
  { key: 'mind_product', label: '心智产品', type: 'string', required: false, usage: ['prediction'], sources: ['心智产品'] },
  { key: 'ip', label: 'IP / 联名', type: 'string', required: false, usage: ['prediction', 'comparison'], sources: ['IP/联名'] },
  { key: 'special_material', label: '特殊功能 / 材质', type: 'string', required: false, usage: ['prediction'], sources: ['特殊功能/材质'] },
  { key: 'memory_point', label: '记忆点', type: 'string', required: false, usage: ['prediction'], sources: ['记忆点'] },
  { key: 'group_tag', label: '群组打标', type: 'string', required: false, usage: ['prediction'], sources: ['群组打标'] },
  { key: 'silhouette', label: '版型', type: 'string', required: false, usage: ['prediction'], sources: ['版型'] },
  { key: 'fabric', label: '面料', type: 'string', required: false, usage: ['prediction'], sources: ['面料'] },
  { key: 'fab', label: 'FAB', type: 'text', required: false, usage: ['prediction'], sources: ['FAB'] },
  { key: 'spec', label: '规格', type: 'string', required: false, usage: ['prediction'], sources: ['规格'] },
  { key: 'plane', label: '平面', type: 'string', required: false, usage: ['prediction'], sources: ['平面'] },
  { key: 'collar', label: '领型', type: 'string', required: false, usage: ['prediction'], sources: ['领型'] },
  { key: 'length', label: '长度', type: 'string', required: false, usage: ['prediction'], sources: ['长度'] },
  { key: 'all_domain', label: '全域款', type: 'boolean', required: false, usage: ['prediction'], sources: ['全域款'] },
  { key: 'o2o', label: 'O2O', type: 'boolean', required: false, usage: ['prediction'], sources: ['O2O'] },
  { key: 'new_or_old', label: '新老品', type: 'string', required: false, usage: ['prediction'], sources: ['新老品'] },
  { key: 'goods_type', label: '货品类型', type: 'string', required: false, usage: ['prediction'], sources: ['货品类型'] },
  { key: 'light_supply_type', label: '轻供类型', type: 'string', required: false, usage: ['prediction'], sources: ['轻供类型'] },
  { key: 'batch', label: '批次', type: 'string', required: false, usage: ['comparison'], sources: ['批次'] },
  { key: 'season_code', label: '季节码', type: 'string', required: false, usage: ['prediction'], sources: ['季节码'] },
  { key: 'material_code', label: '物料编码', type: 'string', required: false, usage: ['prediction'], sources: ['物料编码'] },
  { key: 'size_code', label: '尺码编号', type: 'string', required: false, usage: ['comparison'], sources: ['尺码编号'] },
  { key: 'size_name', label: '尺码名称', type: 'string', required: false, usage: ['comparison'], sources: ['尺码名称'] },
  { key: 'color_code', label: '颜色编号', type: 'string', required: false, usage: ['comparison'], sources: ['颜色编号'] },
  { key: 'color_name', label: '颜色名称', type: 'string', required: false, usage: ['comparison'], sources: ['颜色名称'] },

  // ── 价格 ────────────────────────────────────────────────────
  { key: 'tag_price', label: '吊牌价', type: 'number', required: false, usage: ['prediction', 'comparison'], sources: ['吊牌价'] },
  { key: 'overseas_tag_price', label: '海外吊牌价', type: 'number', required: false, usage: ['comparison'], sources: ['海外吊牌价'] },
  { key: 'retail_amount', label: '零售额', type: 'number', required: false, usage: ['comparison'], sources: ['零售额'] },
  { key: 'retail_qty', label: '零售量', type: 'number', required: false, usage: ['comparison'], sources: ['零售量'] },
  { key: 'unit_price', label: '件单价', type: 'number', required: false, usage: ['comparison'], sources: ['件单价'] },
  { key: 'retail_discount', label: '零售折扣', type: 'number', required: false, usage: ['comparison'], sources: ['零售折扣'] },
  { key: 'gross_margin', label: '经营毛利率', type: 'number', required: false, usage: ['comparison'], sources: ['经营毛利率'] },
  { key: 'refund_rate', label: '零售退款率', type: 'number', required: false, usage: ['comparison'], sources: ['零售退款率'] },
  { key: 'return_refund_rate', label: '退货退款率', type: 'number', required: false, usage: ['comparison'], sources: ['退货退款率'] },
  { key: 'uv', label: 'UV', type: 'number', required: false, usage: ['comparison'], sources: ['UV'] },
  { key: 'conversion_rate', label: '转化率', type: 'number', required: false, usage: ['comparison'], sources: ['转化率'] },

  // ── 人工定位字段：仅比对层，禁止进入预测路径 ─────────────────
  {
    key: 'target_age',
    label: '年龄段',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['年龄段'],
    note: '商品部人工定位的人群年龄',
  },
  {
    key: 'product_positioning',
    label: '商品定位',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['商品定位'],
    note: '商品部人工定位',
  },
  {
    key: 'promo_group',
    label: '推广群组',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['推广群组'],
    note: '商品部人工打标',
  },
  {
    key: 'product_group',
    label: '商品群',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['商品群'],
    note: '商品部人工打标',
  },
  {
    key: 'scene',
    label: '场景',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['场景'],
    note: '商品部人工设定',
  },
  {
    key: 'extension',
    label: '延续款',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['延续款'],
    note: '企划决策结果，非客观属性',
  },
  {
    key: 'theme',
    label: '主题',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['主题'],
    note: '企划决策结果，非客观属性',
  },
  {
    key: 'story_line',
    label: '故事线',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['故事线'],
    note: '企划决策结果，非客观属性',
  },
  {
    key: 'product_manager',
    label: '产品经理',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['产品经理'],
  },
  {
    key: 'group',
    label: '组别',
    type: 'string',
    required: false,
    usage: ['comparison'],
    sources: ['组别'],
  },
];

/** 字段用途的便捷别名。 */
export const PREDICTION: FieldUsage[] = ['prediction'];
export const COMPARISON: FieldUsage[] = ['comparison'];
export const BOTH: FieldUsage[] = ['prediction', 'comparison'];
