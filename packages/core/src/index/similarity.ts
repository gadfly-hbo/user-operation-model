import type { DimensionDiff, PortraitKey, ProductChannelComparison } from './types.js';
import type { Portrait, PortraitLabel } from '../portrait/types.js';

/**
 * 分布相似度工具。
 *
 * 匹配内核（P1）也用同一组函数，因此放在 `packages/core`，
 * 避免 MCP 层与匹配层各算一套。
 */

/** 把标签集合归一化为概率分布（占比之和为 1）。 */
export function toDistribution(
  labels: Record<string, PortraitLabel>,
): Record<string, number> {
  const total = Object.values(labels).reduce((sum, label) => sum + label.share, 0);
  if (total <= 0) return {};
  const distribution: Record<string, number> = {};
  for (const [key, label] of Object.entries(labels)) {
    distribution[key] = label.share / total;
  }
  return distribution;
}

/** 把标签集合在重归一化后的占比下还原为标签对象（保留 TGI）。 */
export function renormalizedLabels(
  raw: Record<string, PortraitLabel>,
): Record<string, PortraitLabel> {
  const distribution = toDistribution(raw);
  return Object.fromEntries(
    Object.entries(distribution).map(([key, share]) => {
      const tgi = raw[key]?.tgi;
      return [key, { share, ...(tgi !== undefined ? { tgi } : {}) }];
    }),
  );
}

/** 两侧标签集合按公共标签裁剪后的结果。 */
export interface CommonLabelRestriction {
  /** 商品侧公共标签（重归一化占比）。 */
  product: Record<string, number>;
  /** 渠道侧公共标签（重归一化占比）。 */
  channel: Record<string, number>;
  /** 商品侧公共标签对象（重归一化占比，保留 TGI），供 Top3 使用。 */
  productLabels: Record<string, PortraitLabel>;
  /** 渠道侧公共标签对象（重归一化占比，保留 TGI），供 Top3 使用。 */
  channelLabels: Record<string, PortraitLabel>;
  /** 被排除的商品侧单侧标签（升序）。 */
  excludedProductLabels: string[];
  /** 被排除的渠道侧单侧标签（升序）。 */
  excludedChannelLabels: string[];
}

/**
 * 只保留两侧共有的标签，并在公共集合上重归一化（切片 A · SA-06，R-3）。
 *
 * 单侧独有的标签不参与距离计算，也不被当作 0。没有公共标签时返回 undefined，
 * 调用方按「维度不可用（no-common-labels）」处理。
 */
export function restrictToCommonLabels(
  productLabels: Record<string, PortraitLabel>,
  channelLabels: Record<string, PortraitLabel>,
): CommonLabelRestriction | undefined {
  const common = Object.keys(productLabels).filter((key) => key in channelLabels);
  if (common.length === 0) return undefined;
  const restrictedProduct = Object.fromEntries(
    common.map((key) => [key, productLabels[key]!]),
  );
  const restrictedChannel = Object.fromEntries(
    common.map((key) => [key, channelLabels[key]!]),
  );
  return {
    product: toDistribution(restrictedProduct),
    channel: toDistribution(restrictedChannel),
    productLabels: renormalizedLabels(restrictedProduct),
    channelLabels: renormalizedLabels(restrictedChannel),
    excludedProductLabels: Object.keys(productLabels)
      .filter((key) => !(key in channelLabels))
      .sort(),
    excludedChannelLabels: Object.keys(channelLabels)
      .filter((key) => !(key in productLabels))
      .sort(),
  };
}

/** JS 散度（散度形式，0-1）。 */
export function jensenShannonDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let divergence = 0;
  for (const key of keys) {
    const pi = p[key] ?? 0;
    const qi = q[key] ?? 0;
    const mi = (pi + qi) / 2;
    if (mi > 0) {
      if (pi > 0) divergence += 0.5 * pi * Math.log2(pi / mi);
      if (qi > 0) divergence += 0.5 * qi * Math.log2(qi / mi);
    }
  }
  return Math.max(0, divergence);
}

/** JS 距离（散度的平方根，0-1）。 */
export function jensenShannonDistance(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  return Math.sqrt(jensenShannonDivergence(p, q));
}

/** 余弦相似度。 */
export function cosineSimilarity(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let dot = 0;
  let normP = 0;
  let normQ = 0;
  for (const key of keys) {
    const pi = p[key] ?? 0;
    const qi = q[key] ?? 0;
    dot += pi * qi;
    normP += pi * pi;
    normQ += qi * qi;
  }
  if (normP === 0 || normQ === 0) return 0;
  return dot / (Math.sqrt(normP) * Math.sqrt(normQ));
}

/** 两个 Top3 集合的重合度 0-1。 */
export function topOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const hits = a.filter((label) => setB.has(label)).length;
  return hits / Math.max(a.length, b.length);
}

/** 按占比取 Top N 标签。 */
export function topLabels(
  labels: Record<string, PortraitLabel>,
  n: number,
): { label: string; share: number; tgi?: number }[] {
  return Object.entries(labels)
    .sort((left, right) => right[1].share - left[1].share)
    .slice(0, n)
    .map(([label, value]) => ({
      label,
      share: value.share,
      ...(value.tgi !== undefined ? { tgi: value.tgi } : {}),
    }));
}

/**
 * 计算两组画像的逐维度差异。
 *
 * 只比较**双方都有数据**的维度；单侧独有的维度单独列出，不计入差异。
 * 每个维度只在**公共标签的重归一化分布**上计算（R-3）；两侧没有公共标签的
 * 维度标记 `no-common-labels`，不参与 `comparedDimensions`。
 */
export function diffPortraits(
  product: Portrait,
  channel: Portrait,
): Pick<
  ProductChannelComparison,
  'dimensions' | 'onlyInProduct' | 'onlyInChannel' | 'comparedDimensions'
> {
  const productDimensions = Object.keys(product.projections);
  const channelDimensions = Object.keys(channel.projections);
  const shared = productDimensions.filter((dimension) =>
    channelDimensions.includes(dimension),
  );

  const dimensions: DimensionDiff[] = shared.map((dimension) => {
    const productLabels = product.projections[dimension]!.labels;
    const channelLabels = channel.projections[dimension]!.labels;
    const restriction = restrictToCommonLabels(productLabels, channelLabels);
    if (!restriction) {
      return {
        dimension,
        productTop3: [],
        channelTop3: [],
        distance: 0,
        overlapTop3: 0,
        jsSimilarity: 0,
        cosine: 0,
        excludedProductLabels: Object.keys(productLabels).filter((key) => !(key in channelLabels)).sort(),
        excludedChannelLabels: Object.keys(channelLabels).filter((key) => !(key in productLabels)).sort(),
        reason: 'no-common-labels' as const,
      };
    }
    const p = restriction.product;
    const q = restriction.channel;
    const productTop3 = topLabels(restriction.productLabels, 3);
    const channelTop3 = topLabels(restriction.channelLabels, 3);
    return {
      dimension,
      productTop3,
      channelTop3,
      distance: jensenShannonDistance(p, q),
      overlapTop3: topOverlap(
        productTop3.map((item) => item.label),
        channelTop3.map((item) => item.label),
      ),
      jsSimilarity: 1 - jensenShannonDistance(p, q),
      cosine: cosineSimilarity(p, q),
      ...(restriction.excludedProductLabels.length > 0
        ? { excludedProductLabels: restriction.excludedProductLabels }
        : {}),
      ...(restriction.excludedChannelLabels.length > 0
        ? { excludedChannelLabels: restriction.excludedChannelLabels }
        : {}),
    };
  });

  return {
    dimensions,
    onlyInProduct: productDimensions.filter((d) => !channelDimensions.includes(d)),
    onlyInChannel: channelDimensions.filter((d) => !productDimensions.includes(d)),
    comparedDimensions: dimensions.filter((entry) => entry.reason === undefined).length,
  };
}

/** 画像定位键的可读形式。 */
export function describeKey(key: PortraitKey): string {
  return `${key.entityType}:${key.entityId}${key.month ? `@${key.month}` : ''}`;
}
