import type { TagMapping } from '../types.js';

/**
 * 跨平台标签映射表。
 *
 * 这是**数据**不是逻辑：新增映射只需在此追加条目。每条映射都带 id，
 * 可回溯到源平台、源维度、源标签与目标词表。
 *
 * 硬规则：
 * 1. 泛人群体系（strategy_segment）与服饰体系（apparel_segment）**禁止互转**
 * 2. 未声明的组合**不自动推断**，投影时保留在 platformLabels 中不投影
 * 3. `status: 'needs-confirmation'` 的映射不参与投影
 */
export const TAG_MAPPINGS: TagMapping[] = [
  // ── 性别 ────────────────────────────────────────────────────
  ...(['douyin', 'tmall', 'jd'] as const).flatMap((platform) =>
    (['女', '男'] as const).map(
      (label): TagMapping => ({
        id: `gender.${platform}.${label}`,
        platform,
        sourceDimension: platform === 'jd' ? '性别' : '预测性别',
        sourceLabel: label,
        targetDimension: 'gender',
        targetLabel: label,
        confidence: 'exact',
        status: 'confirmed',
      }),
    ),
  ),

  // ── 策略人群（泛人群体系） ──────────────────────────────────
  ...([
    ['douyin', '八大消费群体', '新锐白领', '新锐白领', 'exact'],
    ['douyin', '八大消费群体', '都市蓝领', '都市蓝领', 'exact'],
    ['douyin', '八大消费群体', '精致妈妈', '精致妈妈', 'exact'],
    ['douyin', '八大消费群体', '小镇青年', '小镇青年', 'exact'],
    ['douyin', '八大消费群体', 'genz', 'Z世代', 'manual'],
    ['douyin', '八大消费群体', '资深中产', '资深白领', 'manual'],
    ['douyin', '八大消费群体', '都市银发', '银发族', 'manual'],
    ['douyin', '八大消费群体', '小镇中老年', '小镇老年', 'manual'],
    ['tmall', '大快消策略人群', '新锐白领', '新锐白领', 'exact'],
    ['tmall', '大快消策略人群', '都市蓝领', '都市蓝领', 'exact'],
    ['tmall', '大快消策略人群', '小镇中年', '小镇中年', 'exact'],
    ['tmall', '大快消策略人群', '小镇青年', '小镇青年', 'exact'],
    ['tmall', '大快消策略人群', '资深白领', '资深白领', 'exact'],
    ['tmall', '大快消策略人群', 'Z时代人群', 'Z世代', 'manual'],
    ['tmall', '大快消策略人群', '精致妈妈', '精致妈妈', 'exact'],
    ['tmall', '大快消策略人群', '小镇老年', '小镇老年', 'exact'],
    ['tmall', '大快消策略人群', '都市银发族', '银发族', 'manual'],
    ['jd', '十大靶群', '都市家庭', '都市家庭', 'exact'],
    ['jd', '十大靶群', '都市蓝领', '都市蓝领', 'exact'],
    ['jd', '十大靶群', '银发一族', '银发族', 'manual'],
    ['jd', '十大靶群', '小镇家庭', '小镇家庭', 'exact'],
    ['jd', '十大靶群', '都市Z世代', 'Z世代', 'manual'],
    ['jd', '十大靶群', '都市中产', '都市中产', 'exact'],
    ['jd', '十大靶群', '小镇青年', '小镇青年', 'exact'],
    ['jd', '十大靶群', '小镇中产', '小镇中产', 'exact'],
    ['jd', '十大靶群', '学生一族', '学生一族', 'exact'],
    ['jd', '十大靶群', '小镇中年', '小镇中年', 'exact'],
  ] as const).map(
    ([platform, sourceDimension, sourceLabel, targetLabel, confidence]): TagMapping => ({
      id: `strategy_segment.${platform}.${sourceLabel}`,
      platform,
      sourceDimension,
      sourceLabel,
      targetDimension: 'strategy_segment',
      targetLabel,
      confidence,
      status: 'confirmed',
    }),
  ),

  // ── 服饰策略人群（天猫独有，独立体系） ──────────────────────
  ...(['潮流人群', '大众实用', '低价有颜', '低价实惠', '品质生活', '高阶时尚'] as const).map(
    (label): TagMapping => ({
      id: `apparel_segment.tmall.${label}`,
      platform: 'tmall',
      sourceDimension: '大服饰策略人群',
      sourceLabel: label,
      targetDimension: 'apparel_segment',
      targetLabel: label,
      confidence: 'exact',
      status: 'confirmed',
    }),
  ),

  // ── 消费能力 ────────────────────────────────────────────────
  ...([
    ['douyin', '预测消费能力', '低消费', '低', 'exact'],
    ['douyin', '预测消费能力', '中消费', '中', 'exact'],
    ['douyin', '预测消费能力', '高消费', '高', 'exact'],
    ['jd', '购买力', '极低', '极低', 'exact'],
    ['jd', '购买力', '低', '低', 'exact'],
    ['jd', '购买力', '中', '中', 'exact'],
    ['jd', '购买力', '高', '高', 'exact'],
    ['jd', '购买力', '极高', '极高', 'exact'],
  ] as const).map(
    ([platform, sourceDimension, sourceLabel, targetLabel, confidence]): TagMapping => ({
      id: `spending_power.${platform}.${sourceLabel}`,
      platform,
      sourceDimension,
      sourceLabel,
      targetDimension: 'spending_power',
      targetLabel,
      confidence,
      status: 'confirmed',
      ...(platform === 'douyin'
        ? { note: '抖音仅三档，极低与极高无对应，保持未映射' }
        : {}),
    }),
  ),
  // 天猫 L1–L5 的方向已由用户确认（2026-11-26）：L1 最低购买力，L5 最高
  ...(['L1', 'L2', 'L3', 'L4', 'L5'] as const).map(
    (label): TagMapping => ({
      id: `spending_power.tmall.${label}`,
      platform: 'tmall',
      sourceDimension: '预测购买力',
      sourceLabel: label,
      targetDimension: 'spending_power',
      targetLabel: { L1: '极低', L2: '低', L3: '中', L4: '高', L5: '极高' }[label],
      confidence: 'manual',
      status: 'confirmed',
      note: 'L 数值与购买力的方向由用户确认：L1 最低、L5 最高（2026-11-26）',
    }),
  ),

  // ── 城市等级 ────────────────────────────────────────────────
  ...([
    ['douyin', '城市等级', '一线城市', '一线', 'exact'],
    ['douyin', '城市等级', '新一线城市', '新一线', 'exact'],
    ['douyin', '城市等级', '二线城市', '二线', 'exact'],
    ['douyin', '城市等级', '三线城市', '三线', 'exact'],
    ['douyin', '城市等级', '四线城市', '四线', 'exact'],
    ['douyin', '城市等级', '五线城市', '五线', 'exact'],
    ['jd', '城市线级', '一线', '一线', 'exact'],
    ['jd', '城市线级', '二线', '二线', 'exact'],
    ['jd', '城市线级', '三线', '三线', 'exact'],
    ['jd', '城市线级', '四线', '四线', 'exact'],
    ['jd', '城市线级', '五线', '五线', 'exact'],
    ['jd', '城市线级', '六线-1', '六线及以下', 'manual'],
    ['tmall', '预测城市等级', '1', '一线', 'manual'],
    ['tmall', '预测城市等级', '2', '二线', 'manual'],
    ['tmall', '预测城市等级', '3', '三线', 'manual'],
    ['tmall', '预测城市等级', '4', '四线', 'manual'],
    ['tmall', '预测城市等级', '5', '五线', 'manual'],
    ['tmall', '预测城市等级', '6', '六线及以下', 'manual'],
  ] as const).map(
    ([platform, sourceDimension, sourceLabel, targetLabel, confidence]): TagMapping => ({
      id: `city_tier.${platform}.${sourceLabel}`,
      platform,
      sourceDimension,
      sourceLabel,
      targetDimension: 'city_tier',
      targetLabel,
      confidence,
      status: 'confirmed',
      ...(platform === 'douyin'
        ? { note: '抖音「港澳台城市」在另两平台无对应，不建立映射' }
        : {}),
    }),
  ),

  // ── 人生阶段 ────────────────────────────────────────────────
  ...([
    ['douyin', '预测人生阶段', '单身一族', '单身期', 'manual'],
    ['douyin', '预测人生阶段', '二人世界', '已婚未育期', 'manual'],
    ['douyin', '预测人生阶段', '家有儿女', '养育期', 'manual'],
    ['tmall', '预测人生阶段', '单身期', '单身期', 'exact'],
    ['tmall', '预测人生阶段', '已婚未育期', '已婚未育期', 'exact'],
    ['tmall', '预测人生阶段', '养育期', '养育期', 'exact'],
    ['tmall', '预测人生阶段', '子女成年期', '子女成年期', 'exact'],
  ] as const).map(
    ([platform, sourceDimension, sourceLabel, targetLabel, confidence]): TagMapping => ({
      id: `life_stage.${platform}.${sourceLabel}`,
      platform,
      sourceDimension,
      sourceLabel,
      targetDimension: 'life_stage',
      targetLabel,
      confidence,
      status: 'confirmed',
      ...(platform === 'douyin'
        ? { note: '抖音无「子女成年期」档位' }
        : {}),
    }),
  ),
];
