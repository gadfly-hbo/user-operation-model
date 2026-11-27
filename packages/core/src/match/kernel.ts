import {
  cosineSimilarity,
  jensenShannonDistance,
  toDistribution,
  topLabels,
  topOverlap,
} from '../index/similarity.js';
import { CORE_DIMENSION_IDS } from '../portrait/catalog/dimensions.js';
import {
  DISTRIBUTION_DIMENSIONS,
  MATCH_CONFIG,
  validateMatchConfig,
  type MatchConfig,
  type PriceBandRule,
  type PriceCondition,
} from './config.js';
import { isIntervalWindow } from './month.js';
import type {
  DimensionScore,
  Driver,
  MatchDimensionEvidence,
  MatchInput,
  MatchResult,
  PriceFit,
} from './types.js';

/**
 * 共享匹配内核。
 *
 * 工具1（事实画像入口）与工具2（预测画像入口）都调用这一个实现，
 * 差异只在画像来源。**不得在别处复制第二份评分逻辑。**
 */

const SPENDING_POWER = 'spending_power';

/** 一位小数。 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 百分比文本，最多两位小数。 */
function formatPercent(value: number): string {
  return String(Math.round(value * 10000) / 100);
}

function evaluateCondition(
  condition: PriceCondition,
  context: { high: number; low: number },
): boolean {
  const value = condition.field === 'high' ? context.high : context.low;
  switch (condition.op) {
    case 'ge':
      return value >= condition.value;
    case 'gt':
      return value > condition.value;
    case 'lt':
      return value < condition.value;
    case 'le':
      return value <= condition.value;
  }
}

/** 按顺序首次命中，返回命中的价格带规则。 */
export function matchPriceBand(
  bands: PriceBandRule[],
  price: number,
  context: { high: number; low: number },
): PriceBandRule | undefined {
  for (const band of bands) {
    if (price < band.priceMin) continue;
    if (band.priceMax !== undefined && price >= band.priceMax) continue;
    const allOf = band.allOf ?? [];
    const anyOf = band.anyOf ?? [];
    if (allOf.length > 0 && !allOf.every((condition) => evaluateCondition(condition, context))) {
      continue;
    }
    if (anyOf.length > 0 && !anyOf.some((condition) => evaluateCondition(condition, context))) {
      continue;
    }
    return band;
  }
  return undefined;
}

/** 渲染诊断文案。 */
function renderDiagnosis(
  template: string,
  price: number,
  high: number,
  low: number,
): string {
  return template
    .replace(/\{price\}/g, price.toFixed(1))
    .replace(/\{high\}/g, formatPercent(high))
    .replace(/\{low\}/g, formatPercent(low));
}

/** 分布维度的评分。 */
function scoreDistribution(
  productLabels: Record<string, { share: number }> | undefined,
  channelLabels: Record<string, { share: number }> | undefined,
  blend: MatchConfig['blend'],
): { score?: number; evidence?: MatchDimensionEvidence; reason?: DimensionScore['reason'] } {
  if (!productLabels) return { reason: 'product-missing' };
  if (!channelLabels) return { reason: 'channel-missing' };

  const productDistribution = toDistribution(productLabels);
  const channelDistribution = toDistribution(channelLabels);
  if (Object.keys(productDistribution).length === 0 || Object.keys(channelDistribution).length === 0) {
    return { reason: 'empty-distribution' };
  }

  const jsSimilarity = 1 - jensenShannonDistance(productDistribution, channelDistribution);
  const cosine = cosineSimilarity(productDistribution, channelDistribution);
  const productTop3 = topLabels(productLabels, 3);
  const channelTop3 = topLabels(channelLabels, 3);
  const top3Overlap = topOverlap(
    productTop3.map((item) => item.label),
    channelTop3.map((item) => item.label),
  );

  return {
    score: 100 * (blend.js * jsSimilarity + blend.cosine * cosine + blend.top3 * top3Overlap),
    evidence: {
      jsSimilarity,
      cosine,
      top3Overlap,
      productTop3: productTop3.map((item) => ({ label: item.label, share: item.share })),
      channelTop3: channelTop3.map((item) => ({ label: item.label, share: item.share })),
    },
  };
}

/**
 * 计算一次商品 × 渠道匹配。
 *
 * 纯函数：同输入必同输出。
 */
export function scoreMatch(
  matchInput: MatchInput,
  config: MatchConfig = MATCH_CONFIG,
): MatchResult {
  validateMatchConfig(config);

  const { product, channel, price } = matchInput;
  const dimensions: DimensionScore[] = [];

  // 消费能力维度：由真实价格与渠道消费力按可配置价格带表判定
  let priceFit: PriceFit | undefined;
  const channelSpending = channel.dimensions[SPENDING_POWER];
  if (price === undefined) {
    dimensions.push({
      dimension: SPENDING_POWER,
      score: null,
      weight: config.weights[SPENDING_POWER] ?? 0,
      available: false,
      reason: 'price-missing',
    });
  } else if (!channelSpending) {
    dimensions.push({
      dimension: SPENDING_POWER,
      score: null,
      weight: config.weights[SPENDING_POWER] ?? 0,
      available: false,
      reason: 'spending-power-missing',
    });
  } else {
    const highShare = config.spendingPower.highLabels.reduce(
      (sum, label) => sum + (channelSpending[label]?.share ?? 0),
      0,
    );
    const lowShare = config.spendingPower.lowLabels.reduce(
      (sum, label) => sum + (channelSpending[label]?.share ?? 0),
      0,
    );
    const band = matchPriceBand(config.spendingPower.bands, price, { high: highShare, low: lowShare });
    if (!band) {
      dimensions.push({
        dimension: SPENDING_POWER,
        score: null,
        weight: config.weights[SPENDING_POWER] ?? 0,
        available: false,
        reason: 'spending-power-missing',
      });
    } else {
      priceFit = {
        bandId: band.id,
        band: band.label,
        highShare,
        lowShare,
        penalty: band.penalty,
        diagnosis: renderDiagnosis(band.diagnosis, price, highShare, lowShare),
      };
      dimensions.push({
        dimension: SPENDING_POWER,
        score: band.score,
        weight: config.weights[SPENDING_POWER] ?? 0,
        available: true,
        priceFit,
      });
    }
  }

  // 分布维度：画像分布实算
  for (const dimension of DISTRIBUTION_DIMENSIONS) {
    const weight = config.weights[dimension] ?? 0;
    const outcome = scoreDistribution(
      product.dimensions[dimension],
      channel.dimensions[dimension],
      config.blend,
    );
    dimensions.push({
      dimension,
      score: outcome.score === undefined ? null : round1(outcome.score),
      weight,
      available: outcome.score !== undefined,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.evidence ? { evidence: outcome.evidence } : {}),
    });
  }

  const available = dimensions.filter((dimension) => dimension.available && dimension.score !== null);
  const availableDimensions = available.map((dimension) => dimension.dimension);
  const missingDimensions = dimensions
    .filter((dimension) => !dimension.available)
    .map((dimension) => ({
      dimension: dimension.dimension,
      reason: dimension.reason ?? ('empty-distribution' as const),
    }));

  const flags = {
    productMonthUnknown: product.month.trim() === '',
    channelApproximate: isIntervalWindow(channel.window ?? channel.month),
    priceMissing: price === undefined,
  };

  if (available.length < config.minAvailableDimensions) {
    return {
      spu: matchInput.spu,
      channelId: matchInput.channelId,
      month: matchInput.month,
      totalScore: null,
      grade: null,
      fuse: false,
      dimensions,
      availableDimensions,
      missingDimensions,
      positiveDrivers: [],
      negativeDrivers: [],
      ...(priceFit ? { priceFit } : {}),
      flags,
      error: 'insufficient-dimensions',
    };
  }

  const weightSum = available.reduce((sum, dimension) => sum + dimension.weight, 0);
  const weighted = available.reduce(
    (sum, dimension) => sum + (dimension.score ?? 0) * dimension.weight,
    0,
  ) / weightSum;

  const penalty = priceFit?.penalty ?? 0;
  const rawTotal = weighted + penalty;
  const totalScore = Math.min(
    config.clamp.max,
    Math.max(config.clamp.min, round1(rawTotal)),
  );
  const grade = totalScore >= config.grades.a ? 'A' : totalScore >= config.grades.b ? 'B' : 'C';

  const drivers = available.map((dimension) => ({
    dimension: dimension.dimension,
    score: dimension.score ?? 0,
    delta: round1((dimension.score ?? 0) - weighted),
    weight: dimension.weight,
  }));
  const positiveDrivers: Driver[] = drivers
    .filter((driver) => driver.delta >= config.driverThreshold)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 3);
  const negativeDrivers: Driver[] = drivers
    .filter((driver) => driver.delta <= -config.driverThreshold)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, 3);

  return {
    spu: matchInput.spu,
    channelId: matchInput.channelId,
    month: matchInput.month,
    totalScore,
    grade,
    fuse: totalScore < config.fuseThreshold,
    dimensions,
    availableDimensions,
    missingDimensions,
    positiveDrivers,
    negativeDrivers,
    ...(priceFit ? { priceFit } : {}),
    flags,
  };
}

/** 主干维度 id 列表（供调用方遍历）。 */
export const MATCH_DIMENSION_IDS = CORE_DIMENSION_IDS;
