import type { DimensionSpec } from '../types.js';

/**
 * 统一维度目录。
 *
 * 这是**数据**不是逻辑：新增维度只需在此追加一条，不需要改动任何处理代码。
 * 运行时也可用 `DimensionRegistry.register()` 动态追加。
 *
 * 词表约定：
 * - `core: true` 的六维主干定义了跨平台统一词表，用于匹配内核计算
 * - 扩展维度不做跨平台词表对齐，投影时沿用平台原值（identity 投影）
 * - `labels` 省略即表示该维度不做跨平台词表统一
 */
export const DIMENSIONS: DimensionSpec[] = [
  // ── 六维主干 ────────────────────────────────────────────────
  {
    id: 'gender',
    label: '预测性别',
    kind: 'nominal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'],
    labels: ['女', '男'],
    description: '三平台原生名称不同（预测性别／性别），取值一致',
  },
  {
    id: 'age',
    label: '预测年龄段',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'],
    labels: ['18-23', '24-30', '31-40', '41-50', '50+'],
    description: '三平台原始分档不同（抖音10档／天猫9档／京东13档），按归并规则投影',
  },
  {
    id: 'strategy_segment',
    label: '策略人群（泛人群）',
    kind: 'nominal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'],
    labels: [
      '新锐白领', '都市蓝领', '精致妈妈', 'Z世代', '小镇青年', '资深白领',
      '银发族', '小镇中年', '小镇老年', '都市家庭', '小镇家庭',
      '都市中产', '小镇中产', '学生一族',
    ],
    description:
      '抖音「八大消费群体」／天猫「大快消策略人群」／京东「十大靶群」是同一体系的不同渠道命名，投影到此统一词表',
  },
  {
    id: 'spending_power',
    label: '消费能力',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'],
    labels: ['极低', '低', '中', '高', '极高'],
    description: '抖音仅三档（低／中／高），映射到五档时极低与极高无对应',
  },
  {
    id: 'city_tier',
    label: '城市等级',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'],
    labels: ['一线', '新一线', '二线', '三线', '四线', '五线', '六线及以下'],
    description: '抖音七档含「新一线」与「港澳台」，后两者在另两平台无对应',
  },
  {
    id: 'life_stage',
    label: '预测人生阶段',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall'],
    labels: ['单身期', '已婚未育期', '养育期', '子女成年期'],
    description: '京东无该维度',
  },

  // ── 服饰体系（独立，禁止与泛人群互转） ──────────────────────
  {
    id: 'apparel_segment',
    label: '服饰策略人群',
    kind: 'nominal',
    core: false,
    platforms: ['tmall'],
    labels: ['潮流人群', '大众实用', '低价有颜', '低价实惠', '品质生活', '高阶时尚'],
    description:
      '天猫独有的服饰体系，与泛人群体系无对应关系，禁止互转；抖音／京东无此维度',
  },

  // ── 扩展维度（不做跨平台词表统一，沿用平台原值） ────────────
  { id: 'region', label: '地域分布', kind: 'nominal', core: false, platforms: ['douyin', 'jd', 'tmall'] },
  { id: 'city', label: '城市', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'] },
  { id: 'occupation', label: '预测职业', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'education', label: '教育程度', kind: 'ordinal', core: false, platforms: ['jd', 'tmall'] },
  { id: 'marital_status', label: '婚姻状况', kind: 'nominal', core: false, platforms: ['jd'] },
  { id: 'household_type', label: '预测家户类型', kind: 'nominal', core: false, platforms: ['tmall'] },
  { id: 'phone_brand', label: '手机品牌', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'phone_price_band', label: '手机价格段', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall'] },
  { id: 'purchase_amount_band', label: '消费金额段', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'purchase_frequency', label: '消费频次', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'discount_sensitivity', label: '折扣敏感度', kind: 'ordinal', core: false, platforms: ['tmall', 'jd'] },
  { id: 'promotion_sensitivity', label: '促销敏感度', kind: 'ordinal', core: false, platforms: ['jd'] },
  { id: 'evaluation_sensitivity', label: '评价敏感度', kind: 'ordinal', core: false, platforms: ['jd'] },
  { id: 'category_affinity', label: '类目偏好', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'] },
  { id: 'brand_affinity', label: '品牌偏好', kind: 'nominal', core: false, platforms: ['douyin'] },
  { id: 'user_generation', label: '用户年代', kind: 'ordinal', core: false, platforms: ['jd'] },
  { id: 'lifestyle_interest', label: '生活方式兴趣', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'content_preference', label: '内容偏好', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'] },
  { id: 'category_price_band', label: '品类价格段偏好', kind: 'nominal', core: false, platforms: ['tmall'] },
  { id: 'shopping_time', label: '购物时间分布', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'] },
  { id: 'beauty_persona', label: '美妆特色人群', kind: 'nominal', core: false, platforms: ['douyin'] },
  { id: 'platform_activity', label: '平台活跃度', kind: 'nominal', core: false, platforms: ['douyin'] },
  { id: 'children_age', label: '孩子预测年龄', kind: 'nominal', core: false, platforms: ['jd'] },
  { id: 'car_owned', label: '是否有车', kind: 'nominal', core: false, platforms: ['tmall', 'jd'] },
  { id: 'house_owned', label: '是否有房', kind: 'nominal', core: false, platforms: ['tmall', 'jd'] },
  { id: 'user_constellation', label: '用户星座', kind: 'nominal', core: false, platforms: ['tmall'] },
  { id: 'height', label: '预测身高', kind: 'ordinal', core: false, platforms: ['tmall'] },
  { id: 'weight', label: '预测体重', kind: 'ordinal', core: false, platforms: ['tmall'] },
];

/** 六维主干维度的 id 集合。匹配内核只消费这六个维度。 */
export const CORE_DIMENSION_IDS = DIMENSIONS.filter((d) => d.core).map((d) => d.id);
