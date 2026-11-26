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
    id: 'gender', projection: 'mapping',
    label: '预测性别',
    kind: 'nominal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['预测性别'], tmall: ['预测性别'], jd: ['性别'] },
    labels: ['女', '男'],
    description: '三平台原生名称不同（预测性别／性别），取值一致',
  },
  {
    id: 'age', projection: 'bands',
    label: '预测年龄段',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['预测年龄段'], tmall: ['预测年龄'], jd: ['年龄'] },
    labels: ['18-23', '24-30', '31-40', '41-50', '50+'],
    description: '三平台原始分档不同（抖音10档／天猫9档／京东13档），按归并规则投影',
  },
  {
    id: 'strategy_segment', projection: 'mapping', family: 'general',
    label: '策略人群（泛人群）',
    kind: 'nominal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['八大消费群体'], tmall: ['大快消策略人群'], jd: ['十大靶群'] },
    labels: [
      '新锐白领', '都市蓝领', '精致妈妈', 'Z世代', '小镇青年', '资深白领',
      '银发族', '小镇中年', '小镇老年', '都市家庭', '小镇家庭',
      '都市中产', '小镇中产', '学生一族',
    ],
    description:
      '抖音「八大消费群体」／天猫「大快消策略人群」／京东「十大靶群」是同一体系的不同渠道命名，投影到此统一词表',
  },
  {
    id: 'spending_power', projection: 'mapping',
    label: '消费能力',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['预测消费能力'], tmall: ['预测购买力'], jd: ['购买力'] },
    labels: ['极低', '低', '中', '高', '极高'],
    description: '抖音仅三档（低／中／高），映射到五档时极低与极高无对应',
  },
  {
    id: 'city_tier', projection: 'mapping',
    label: '城市等级',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['城市等级'], tmall: ['预测城市等级'], jd: ['城市线级'] },
    labels: ['一线', '新一线', '二线', '三线', '四线', '五线', '六线及以下'],
    description: '抖音七档含「新一线」与「港澳台」，后两者在另两平台无对应',
  },
  {
    id: 'life_stage', projection: 'mapping',
    label: '预测人生阶段',
    kind: 'ordinal',
    core: true,
    platforms: ['douyin', 'tmall'], sourceDimensions: { douyin: ['预测人生阶段'], tmall: ['预测人生阶段'] },
    labels: ['单身期', '已婚未育期', '养育期', '子女成年期'],
    description: '京东无该维度',
  },

  // ── 服饰体系（独立，禁止与泛人群互转） ──────────────────────
  {
    id: 'apparel_segment', projection: 'mapping', family: 'apparel',
    label: '服饰策略人群',
    kind: 'nominal',
    core: false,
    platforms: ['tmall'], sourceDimensions: { tmall: ['大服饰策略人群'] },
    labels: ['潮流人群', '大众实用', '低价有颜', '低价实惠', '品质生活', '高阶时尚'],
    description:
      '天猫独有的服饰体系，与泛人群体系无对应关系，禁止互转；抖音／京东无此维度',
  },

  // ── 扩展维度（不做跨平台词表统一，沿用平台原值） ────────────
  { id: 'region', projection: 'identity', label: '地域分布', kind: 'nominal', core: false, platforms: ['douyin', 'jd', 'tmall'], sourceDimensions: { douyin: ['地域分布'], jd: ['常用收货省份'] } },
  { id: 'city', projection: 'identity', label: '城市', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'], sourceDimensions: { douyin: ['城市'], tmall: ['预测常驻城市'] } },
  { id: 'occupation', projection: 'identity', label: '预测职业', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['预测职业'], tmall: ['预测职业'], jd: ['职业'] } },
  { id: 'education', projection: 'identity', label: '教育程度', kind: 'ordinal', core: false, platforms: ['jd', 'tmall'], sourceDimensions: { jd: ['学历'], tmall: ['预测教育程度'] } },
  { id: 'marital_status', projection: 'identity', label: '婚姻状况', kind: 'nominal', core: false, platforms: ['jd'], sourceDimensions: { jd: ['婚姻状况'] } },
  { id: 'household_type', projection: 'identity', label: '预测家户类型', kind: 'nominal', core: false, platforms: ['tmall'], sourceDimensions: { tmall: ['预测家户类型'] } },
  { id: 'phone_brand', projection: 'identity', label: '手机品牌', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['手机品牌'], tmall: ['预测使用的手机品牌'], jd: ['客户当前使用手机品牌'] } },
  { id: 'phone_price_band', projection: 'identity', label: '手机价格段', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall'], sourceDimensions: { douyin: ['手机价格'], tmall: ['手机价格段偏好'] } },
  { id: 'purchase_amount_band', projection: 'identity', label: '消费金额段', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['电商消费金额'], tmall: ['月均消费金额'], jd: ['用户月平均支付订单总额'] } },
  { id: 'purchase_frequency', projection: 'identity', label: '消费频次', kind: 'ordinal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['电商消费频次'], tmall: ['月均购物频次偏好'], jd: ['用户月支付订单数量'] } },
  { id: 'discount_sensitivity', projection: 'identity', label: '折扣敏感度', kind: 'ordinal', core: false, platforms: ['tmall', 'jd'], sourceDimensions: { tmall: ['折扣敏感度'], jd: ['商品折扣率偏好'] } },
  { id: 'promotion_sensitivity', projection: 'identity', label: '促销敏感度', kind: 'ordinal', core: false, platforms: ['jd'], sourceDimensions: { jd: ['促销敏感度'] } },
  { id: 'evaluation_sensitivity', projection: 'identity', label: '评价敏感度', kind: 'ordinal', core: false, platforms: ['jd'], sourceDimensions: { jd: ['评价敏感度'] } },
  { id: 'category_affinity', projection: 'identity', label: '类目偏好', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'], sourceDimensions: { douyin: ['电商品类成交偏好'], tmall: ['一级类目高偏好'] } },
  { id: 'category_affinity_l2', projection: 'identity', label: '二级类目偏好', kind: 'nominal', core: false, platforms: ['tmall'], sourceDimensionPatterns: { tmall: ['二级类目高偏好'] } },
  { id: 'brand_affinity', projection: 'identity', label: '品牌偏好', kind: 'nominal', core: false, platforms: ['douyin'], sourceDimensions: { douyin: ['电商品牌成交偏好'] } },
  { id: 'user_generation', projection: 'identity', label: '用户年代', kind: 'ordinal', core: false, platforms: ['jd'], sourceDimensions: { jd: ['用户年代'] } },
  { id: 'lifestyle_interest', projection: 'identity', label: '生活方式兴趣', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { douyin: ['抖音视频观看兴趣分类'] }, sourceDimensionPatterns: { tmall: ['*人群_生活方式'], jd: ['*爱好者'] } },
  { id: 'content_preference', projection: 'identity', label: '内容偏好', kind: 'nominal', core: false, platforms: ['douyin', 'tmall'], sourceDimensions: { douyin: ['触点互动偏好'] }, sourceDimensionPatterns: { tmall: ['内容类型偏好人群'] } },
  { id: 'category_price_band', projection: 'identity', label: '品类价格段偏好', kind: 'nominal', core: false, platforms: ['tmall'], sourceDimensionPatterns: { tmall: ['*价格段偏好'] } },
  { id: 'shopping_time', projection: 'identity', label: '购物时间分布', kind: 'nominal', core: false, platforms: ['douyin', 'tmall', 'jd'], sourceDimensions: { tmall: ['购物时间分布'], jd: ['无线端购物活跃时段-近7天'] } },
  { id: 'beauty_persona', projection: 'identity', label: '美妆特色人群', kind: 'nominal', core: false, platforms: ['douyin'], sourceDimensions: { douyin: ['美妆行业特色人群'] } },
  { id: 'platform_activity', projection: 'identity', label: '平台活跃度', kind: 'nominal', core: false, platforms: ['douyin'], sourceDimensions: { douyin: ['抖音活跃用户', '头条活跃用户', '西瓜活跃用户', '火山活跃用户'] } },
  { id: 'children_age', projection: 'identity', label: '孩子预测年龄', kind: 'nominal', core: false, platforms: ['jd'], sourceDimensions: { jd: ['孩子预测年龄'] } },
  { id: 'car_owned', projection: 'identity', label: '是否有车', kind: 'nominal', core: false, platforms: ['tmall', 'jd'], sourceDimensions: { tmall: ['预测是否有车'], jd: ['有车一族'] } },
  { id: 'house_owned', projection: 'identity', label: '是否有房', kind: 'nominal', core: false, platforms: ['tmall', 'jd'], sourceDimensions: { tmall: ['预测住房状态'], jd: ['有房人群'] } },
  { id: 'user_constellation', projection: 'identity', label: '用户星座', kind: 'nominal', core: false, platforms: ['tmall'], sourceDimensions: { tmall: ['预测用户星座'] } },
  { id: 'height', projection: 'identity', label: '预测身高', kind: 'ordinal', core: false, platforms: ['tmall'], sourceDimensions: { tmall: ['预测用户身高'] } },
  { id: 'weight', projection: 'identity', label: '预测体重', kind: 'ordinal', core: false, platforms: ['tmall'], sourceDimensions: { tmall: ['预测用户体重'] } },
];

/** 六维主干维度的 id 集合。匹配内核只消费这六个维度。 */
export const CORE_DIMENSION_IDS = DIMENSIONS.filter((d) => d.core).map((d) => d.id);
