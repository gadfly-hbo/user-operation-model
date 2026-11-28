import { CORE_DIMENSION_IDS } from '../portrait/catalog/dimensions.js';
import type { DimensionId } from '../portrait/types.js';

/**
 * 匹配内核的参数单一来源。
 *
 * 权重、评分混合比例、价格带规则、评级与熔断阈值、裁剪区间、驱动阈值
 * 全部在这里定义。工具1 与工具2 都从这里取，任何其他目录不得另写一份。
 */

/** 价格带条件作用的字段。 */
export type PriceConditionField = 'high' | 'low';

/** 价格带条件的比较符。 */
export type PriceConditionOp = 'ge' | 'gt' | 'lt' | 'le';

/** 一条价格带条件。 */
export interface PriceCondition {
  field: PriceConditionField;
  op: PriceConditionOp;
  /** 阈值，占比 0-1。 */
  value: number;
}

/**
 * 一条价格带规则。
 *
 * 规则按数组顺序**首次命中**：同一价格区间内先判具体条件，最后一条无条件规则是兜底。
 */
export interface PriceBandRule {
  id: string;
  /** 价格带名称（用于展示）。 */
  label: string;
  /** 价格下界（含）。 */
  priceMin: number;
  /** 价格上界（不含）；缺省表示无上界。 */
  priceMax?: number;
  /** 全部满足才命中。 */
  allOf?: PriceCondition[];
  /** 任一满足即命中。 */
  anyOf?: PriceCondition[];
  /** 命中的维度原始分。 */
  score: number;
  /** 全局扣分（≤ 0）。 */
  penalty: number;
  /** 诊断文案模板，占位符 `{price}` `{high}` `{low}`。 */
  diagnosis: string;
}

/** 评分配置。 */
export interface MatchConfig {
  /** 配置版本，随口径变化递增。 */
  version: string;
  /** 单维度分的混合比例，和必须为 1。 */
  blend: { js: number; cosine: number; top3: number };
  /** 六维权重。 */
  weights: Record<DimensionId, number>;
  /** 评级门槛。 */
  grades: { a: number; b: number };
  /** 熔断阈值（只做显示标记，不改变评级）。 */
  fuseThreshold: number;
  /** 总分裁剪区间。 */
  clamp: { min: number; max: number };
  /** 驱动因素的偏差门槛（分）。 */
  driverThreshold: number;
  /** 产出总分所需的最少可用维度数。 */
  minAvailableDimensions: number;
  /** 消费能力维度：标签口径与价格带规则。 */
  spendingPower: {
    /** 高消费标签集合。 */
    highLabels: string[];
    /** 低消费标签集合。 */
    lowLabels: string[];
    /** 价格带规则，按顺序首次命中。 */
    bands: PriceBandRule[];
  };
}

/**
 * 匹配内核配置（初值，未经真实数据校准）。
 *
 * **权重与阈值来自讨论稿 §7.4 的初值，未经真实业务数据校准，只能记「已调整」，不得标「已优化」。**
 *
 * 版本 `sa-2026-11-common-labels-uncalibrated`（切片 A · SA-06）：相似度改为
 * 只在公共标签的重归一化分布上计算。来源是**技术修复**（落实归一化规则 §5.5
 * 的既定口径），不是数据校准；权重仍未校准。
 */
export const MATCH_CONFIG: MatchConfig = {
  version: 'sa-2026-11-common-labels-uncalibrated',
  blend: { js: 0.6, cosine: 0.25, top3: 0.15 },
  weights: {
    gender: 0.1,
    age: 0.2,
    spending_power: 0.15,
    city_tier: 0.1,
    strategy_segment: 0.25,
    life_stage: 0.2,
  },
  grades: { a: 80, b: 60 },
  fuseThreshold: 45,
  clamp: { min: 25, max: 99.5 },
  driverThreshold: 1,
  minAvailableDimensions: 3,
  spendingPower: {
    highLabels: ['高', '极高'],
    lowLabels: ['低', '极低'],
    bands: [
      {
        id: 'under-100',
        label: '平价引流带',
        priceMin: 0,
        priceMax: 100,
        score: 95,
        penalty: 0,
        diagnosis: '平价爆品(单价¥{price})具备全域极佳向下兼容性，无转化门槛',
      },
      {
        id: '100-199',
        label: '大众消费带',
        priceMin: 100,
        priceMax: 200,
        score: 88,
        penalty: 0,
        diagnosis: '大众常青价位(单价¥{price})与渠道消费力高度稳健匹配',
      },
      {
        id: '200-399-matched',
        label: '中端主力带',
        priceMin: 200,
        priceMax: 400,
        allOf: [{ field: 'high', op: 'ge', value: 0.28 }],
        score: 92,
        penalty: 0,
        diagnosis: '中端主力价位(单价¥{price})在渠道高消费客群({high}%)支撑下承接充沛',
      },
      {
        id: '200-399-fallback',
        label: '中端主力带',
        priceMin: 200,
        priceMax: 400,
        score: 70,
        penalty: -3,
        diagnosis: '中端单品单价 ¥{price}，但渠道低消占 {low}%，大促期需加强活动机制',
      },
      {
        id: '400-499-matched',
        label: '中高客单带',
        priceMin: 400,
        priceMax: 500,
        allOf: [{ field: 'high', op: 'ge', value: 0.34 }],
        score: 90,
        penalty: 0,
        diagnosis: '中高客单(单价¥{price})获得渠道高消费人群良好承接',
      },
      {
        id: '400-499-fallback',
        label: '中高客单带',
        priceMin: 400,
        priceMax: 500,
        score: 58,
        penalty: -6.5,
        diagnosis: '客单偏高：单价 ¥{price}，但渠道高消费仅 {high}%，存在一定决策阻力',
      },
      {
        id: '500-matched',
        label: '高客单重工带',
        priceMin: 500,
        allOf: [
          { field: 'high', op: 'ge', value: 0.38 },
          { field: 'low', op: 'le', value: 0.32 },
        ],
        score: 93,
        penalty: 0,
        diagnosis: '高客单重工款(单价¥{price})与渠道高购买力客群({high}%)高度吻合，契合打爆',
      },
      {
        id: '500-break',
        label: '高客单重工带',
        priceMin: 500,
        anyOf: [
          { field: 'high', op: 'lt', value: 0.25 },
          { field: 'low', op: 'ge', value: 0.45 },
        ],
        score: 32,
        penalty: -10.5,
        diagnosis:
          '客单价×购买力断层：单品单价高达 ¥{price}，但渠道低消费达 {low}%(高消仅{high}%)，严重断层',
      },
      {
        id: '500-fallback',
        label: '高客单重工带',
        priceMin: 500,
        score: 68,
        penalty: -4,
        diagnosis: '高客单单价 ¥{price}，渠道低消费达 {low}%，建议叠加满减券降低决策门槛',
      },
    ],
  },
};

/** 分布维度：六维中除消费能力外的五维，由画像分布实算。 */
export const DISTRIBUTION_DIMENSIONS: DimensionId[] = CORE_DIMENSION_IDS.filter(
  (id) => id !== 'spending_power',
);

/** 校验配置。**不通过直接抛错，不静默降级。** */
export function validateMatchConfig(config: MatchConfig = MATCH_CONFIG): void {
  const problems: string[] = [];

  const blendSum = config.blend.js + config.blend.cosine + config.blend.top3;
  if (Math.abs(blendSum - 1) > 1e-9) {
    problems.push(`blend 之和应为 1，实际 ${blendSum}`);
  }

  for (const dimension of CORE_DIMENSION_IDS) {
    const weight = config.weights[dimension];
    if (weight === undefined) problems.push(`缺少维度权重：${dimension}`);
    else if (!(weight > 0)) problems.push(`维度权重必须为正：${dimension}`);
  }
  for (const dimension of Object.keys(config.weights)) {
    if (!CORE_DIMENSION_IDS.includes(dimension)) {
      problems.push(`权重含非主干维度：${dimension}`);
    }
  }

  if (!(config.grades.a > config.grades.b)) problems.push('评级门槛必须 A > B');
  if (!(config.fuseThreshold < config.grades.b)) problems.push('熔断阈值必须低于 B 级门槛');
  if (!(config.clamp.min < config.clamp.max)) problems.push('裁剪区间必须 min < max');
  if (!(config.minAvailableDimensions >= 1)) problems.push('最少可用维度数必须 ≥ 1');
  if (config.minAvailableDimensions > CORE_DIMENSION_IDS.length) {
    problems.push('最少可用维度数不能超过主干维度数');
  }
  if (!(config.driverThreshold >= 0)) problems.push('驱动阈值不能为负');
  if (!config.version.trim()) problems.push('配置版本不能为空');

  const { highLabels, lowLabels, bands } = config.spendingPower;
  if (highLabels.length === 0) problems.push('高消费标签集合不能为空');
  if (lowLabels.length === 0) problems.push('低消费标签集合不能为空');
  const overlap = highLabels.filter((label) => lowLabels.includes(label));
  if (overlap.length > 0) problems.push(`高／低消费标签重叠：${overlap.join('、')}`);

  // 价格带：区间必须连续、不重叠，每个区间最后一条是无条件兜底
  let expectedMin = 0;
  let currentStart: number | null = null;
  let currentMax: number | undefined;
  let rangeHasFallback = false;
  const closeRange = () => {
    if (currentStart !== null && !rangeHasFallback) {
      problems.push(`价格带区间 [${currentStart},…) 缺少兜底规则`);
    }
  };
  for (const rule of bands) {
    if (currentStart === null || rule.priceMin !== currentStart) {
      closeRange();
      if (rule.priceMin !== expectedMin) {
        problems.push(`价格带区间不连续：期望起点 ${expectedMin}，实际 ${rule.priceMin}`);
      }
      currentStart = rule.priceMin;
      currentMax = rule.priceMax;
      rangeHasFallback = false;
    } else if (rule.priceMax !== currentMax) {
      problems.push(`同一价格区间内规则的 priceMax 不一致：${rule.id}`);
    }
    const hasCondition = (rule.allOf?.length ?? 0) + (rule.anyOf?.length ?? 0) > 0;
    if (!hasCondition) rangeHasFallback = true;
    expectedMin = rule.priceMax ?? Number.POSITIVE_INFINITY;
  }
  closeRange();
  if (bands.length > 0 && bands[bands.length - 1]!.priceMax !== undefined) {
    problems.push('最后一个价格带区间必须无上界');
  }

  if (problems.length > 0) {
    throw new Error(`匹配内核配置校验失败：\n- ${problems.join('\n- ')}`);
  }
}

/** 校验并返回配置，便于在加载期一次性检查。 */
export function loadMatchConfig(config: MatchConfig = MATCH_CONFIG): MatchConfig {
  validateMatchConfig(config);
  return config;
}
