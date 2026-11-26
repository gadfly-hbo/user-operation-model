import type { DataIndex, PortraitKey, ProductChannelComparison } from './types.js';
import type { Portrait } from '../portrait/types.js';
import type { NormalizedPortrait } from '../normalize/types.js';
import type { ProductDossier } from '../product/types.js';
import type { PortraitLabel } from '../portrait/types.js';
import type { ChannelRecord } from '../normalize/types.js';
import {
  diffPortraits,
  jensenShannonDistance,
  toDistribution,
} from './similarity.js';

/** 按款号取商品档案。 */
export function findProduct(index: DataIndex, spu: string): ProductDossier | undefined {
  return index.products.find((product) => product.spu === spu);
}

/** 按店铺编码取渠道。 */
export function findChannel(index: DataIndex, channelId: string): ChannelRecord | undefined {
  return index.channels.find((channel) => channel.channelId === channelId);
}

/**
 * 取画像。**精确匹配，不回退**。
 *
 * 指定月份时只取该月的画像；未指定月份时取该实体唯一的一份画像，
 * 实体有多份（跨月）时返回 undefined，由调用方要求明确月份。
 */
export function findPortrait(index: DataIndex, key: PortraitKey): NormalizedPortrait | undefined {
  return findPortraitByEntityIds(index, {
    entityType: key.entityType,
    entityIds: [key.entityId],
    ...(key.month ? { month: key.month } : {}),
  });
}

/**
 * 取画像，实体标识可以是多个候选。
 *
 * 渠道画像的文件名/列名用的是**店铺名**，而渠道宽表的主键是**店铺编码**，
 * 两者通过渠道宽表的 `店铺` 字段关联。渠道侧查询需同时尝试两种标识。
 */
export function findPortraitByEntityIds(
  index: DataIndex,
  key: { entityType: Portrait['entityType']; entityIds: string[]; month?: string },
): NormalizedPortrait | undefined {
  const ids = new Set(key.entityIds.filter(Boolean));
  const matches = index.portraits.filter(
    (portrait) => portrait.entityType === key.entityType && ids.has(portrait.entityId),
  );
  if (key.month) return matches.find((portrait) => portrait.month === key.month);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * 渠道在画像侧可能用到的实体标识。
 *
 * 优先是渠道宽表的店铺名（画像文件按店铺名命名），其次是店铺编码本身。
 */
export function channelEntityIds(index: DataIndex, channelId: string): string[] {
  const ids = new Set<string>([channelId]);
  const channel = findChannel(index, channelId);
  if (channel?.name) ids.add(channel.name);
  return [...ids];
}

/** 某实体可用的月份列表。 */
export function availableMonths(
  index: DataIndex,
  entityType: Portrait['entityType'],
  entityId: string | string[],
): string[] {
  const ids = new Set(Array.isArray(entityId) ? entityId : [entityId]);
  return index.portraits
    .filter(
      (portrait) =>
        portrait.entityType === entityType && ids.has(portrait.entityId),
    )
    .map((portrait) => portrait.month)
    .filter(Boolean)
    .sort();
}

export interface ChannelFilter {
  month?: string;
  type?: string;
}

/** 渠道列表。`month` 过滤的是**有画像的月份**。 */
export function listChannels(index: DataIndex, filter: ChannelFilter = {}): ChannelRecord[] {
  // 画像侧的实体标识可能是店铺名，与店铺编码通过渠道宽表关联
  const channelIdByEntityId = new Map<string, string>();
  for (const channel of index.channels) {
    channelIdByEntityId.set(channel.channelId, channel.channelId);
    if (channel.name) channelIdByEntityId.set(channel.name, channel.channelId);
  }
  const portraitChannels = new Set(
    index.portraits
      .filter((portrait) => portrait.entityType === 'channel')
      .filter((portrait) => !filter.month || portrait.month === filter.month)
      .map((portrait) => channelIdByEntityId.get(portrait.entityId))
      .filter((id): id is string => Boolean(id)),
  );
  return index.channels.filter((channel) => {
    if (filter.type && channel.channelType !== filter.type && channel.platform !== filter.type) {
      return false;
    }
    if (filter.month && !portraitChannels.has(channel.channelId)) return false;
    return true;
  });
}

export interface ProductFilter {
  category?: string;
  season?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
}

/** 商品检索。 */
export function listProducts(index: DataIndex, filter: ProductFilter = {}): ProductDossier[] {
  return index.products.filter((product) => {
    if (filter.category) {
      const category = product.category;
      const haystack = [category?.l1, category?.l2, category?.l3].filter(Boolean).join('/');
      if (!haystack.includes(filter.category)) return false;
    }
    if (filter.season && product.season !== filter.season) return false;
    if (filter.keyword) {
      const haystack = [
        product.name ?? '',
        product.spu,
        ...(product.attributes?.['category_l3'] ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(filter.keyword.toLowerCase())) return false;
    }
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      const price = product.price?.actualUnitPrice ?? product.price?.unitPrice;
      if (price === undefined) return false;
      if (filter.minPrice !== undefined && price < filter.minPrice) return false;
      if (filter.maxPrice !== undefined && price > filter.maxPrice) return false;
    }
    return true;
  });
}

export interface TagHit {
  entityType: Portrait['entityType'];
  entityId: string;
  month: string;
  share: number;
  tgi?: number;
  /** 命中的统一维度。 */
  dimension: string;
  /** 命中的标签值。 */
  label: string;
}

/** 按人群标签反查实体。 */
export function searchByTag(
  index: DataIndex,
  params: { dimension: string; label: string; scope?: string; topN?: number },
): TagHit[] {
  const scope = params.scope ?? 'all';
  const hits: TagHit[] = [];
  for (const portrait of index.portraits) {
    if (scope !== 'all' && portrait.entityType !== scope) continue;
    const projection = portrait.projections[params.dimension];
    if (!projection) continue;
    const label = projection.labels[params.label];
    if (!label) continue;
    hits.push({
      entityType: portrait.entityType,
      entityId: portrait.entityId,
      month: portrait.month,
      share: label.share,
      ...(label.tgi !== undefined ? { tgi: label.tgi } : {}),
      dimension: params.dimension,
      label: params.label,
    });
  }
  hits.sort((left, right) => right.share - left.share);
  return hits.slice(0, params.topN ?? 50);
}

export interface SimilarHit {
  spu: string;
  name?: string;
  score: number;
  attributeScore: number;
  portraitScore: number;
  sharedDimensions: number;
}

/** 属性 Jaccard 相似度。 */
export function attributeJaccard(a: ProductDossier, b: ProductDossier): number {
  const keys = ['category_l1', 'category_l2', 'category_l3', 'silhouette', 'fabric', 'ip'];
  let shared = 0;
  let total = 0;
  for (const key of keys) {
    const left = new Set(a.attributes?.[key] ?? []);
    const right = new Set(b.attributes?.[key] ?? []);
    if (left.size === 0 && right.size === 0) continue;
    total += 1;
    for (const value of left) if (right.has(value)) shared += 1;
  }
  if (total === 0) return 0;
  return shared / total;
}

/**
 * 相似款 Look-back：属性相似度与画像相似度各占一半。
 *
 * 画像部分只在**双方都有数据**的统一维度上比较。
 */
export function similarProducts(
  index: DataIndex,
  params: { spu: string; topN?: number },
): SimilarHit[] {
  const target = findProduct(index, params.spu);
  if (!target) return [];
  const targetPortrait = findPortrait(index, { entityType: 'product', entityId: params.spu });

  const hits: SimilarHit[] = [];
  for (const candidate of index.products) {
    if (candidate.spu === params.spu) continue;
    const attributeScore = attributeJaccard(target, candidate);
    let portraitScore = 0;
    let sharedDimensions = 0;
    if (targetPortrait) {
      const candidatePortrait = findPortrait(index, {
        entityType: 'product',
        entityId: candidate.spu,
      });
      if (candidatePortrait) {
        const shared = Object.keys(targetPortrait.projections).filter((dimension) =>
          candidatePortrait.projections[dimension],
        );
        sharedDimensions = shared.length;
        if (shared.length > 0) {
          let total = 0;
          for (const dimension of shared) {
            const p = toDistribution(targetPortrait.projections[dimension]!.labels);
            const q = toDistribution(candidatePortrait.projections[dimension]!.labels);
            total += jensenShannonDistance(p, q);
          }
          portraitScore = 1 - total / shared.length;
        }
      }
    }
    const score = attributeScore * 0.5 + portraitScore * 0.5;
    hits.push({
      spu: candidate.spu,
      ...(candidate.name ? { name: candidate.name } : {}),
      score,
      attributeScore,
      portraitScore,
      sharedDimensions,
    });
  }
  hits.sort((left, right) => right.score - left.score);
  return hits.slice(0, params.topN ?? 10);
}

/**
 * 聚合层级画像。
 *
 * 目前只支持品类层级（由商品档案的品类字段推导）。系列／爆款／IP 层级
 * 需要聚合口径表，未接入时由调用方返回明确错误。
 */
export function aggregatePortrait(
  index: DataIndex,
  params: { level: string; key: string },
): NormalizedPortrait | undefined {
  if (params.level !== 'category') return undefined;

  const members = index.products.filter((product) => {
    const category = product.category;
    const haystack = [category?.l1, category?.l2, category?.l3].filter(Boolean).join('/');
    return haystack.includes(params.key);
  });
  if (members.length === 0) return undefined;

  const memberPortraits = members
    .map((product) =>
      findPortrait(index, { entityType: 'product', entityId: product.spu }),
    )
    .filter((portrait): portrait is Portrait => Boolean(portrait));
  if (memberPortraits.length === 0) return undefined;

  const dimensions: Portrait['projections'] = {};
  const allDimensions = new Set(
    memberPortraits.flatMap((portrait) => Object.keys(portrait.projections)),
  );
  for (const dimension of allDimensions) {
    const labels: Record<string, PortraitLabel> = {};
    let counted = 0;
    for (const portrait of memberPortraits) {
      const projection = portrait.projections[dimension];
      if (!projection) continue;
      counted += 1;
      for (const [label, value] of Object.entries(projection.labels)) {
        const existing = labels[label] ?? { share: 0 };
        existing.share += value.share;
        if (value.tgi !== undefined) {
          const weight = existing.share > 0 ? value.share : 1;
          existing.tgi =
            existing.tgi === undefined
              ? value.tgi
              : (existing.tgi * (1 - value.share / (existing.share + value.share)) +
                  value.tgi * (value.share / (existing.share + value.share))) * weight;
        }
        labels[label] = existing;
      }
    }
    if (counted === 0) continue;
    for (const label of Object.keys(labels)) {
      labels[label]!.share /= counted;
    }
    dimensions[dimension] = { dimension, labels };
  }

  return {
    entityType: 'category',
    entityId: params.key,
    month: memberPortraits[0]?.month ?? '',
    platformLabels: {},
    projections: dimensions,
  };
}

/** 商品↔渠道画像差异。**只产出差异，不产出匹配分与评级**（属 P1 匹配内核）。 */
export function compareProductChannel(
  index: DataIndex,
  params: { spu: string; channelId: string; month?: string },
): ProductChannelComparison | undefined {
  const productPortrait = findPortrait(index, {
    entityType: 'product',
    entityId: params.spu,
    ...(params.month ? { month: params.month } : {}),
  });
  if (!productPortrait) return undefined;

  const channelPortrait = findPortraitByEntityIds(index, {
    entityType: 'channel',
    entityIds: channelEntityIds(index, params.channelId),
    ...(params.month ? { month: params.month } : {}),
  });
  if (!channelPortrait) return undefined;

  const diff = diffPortraits(productPortrait, channelPortrait);
  return {
    spu: params.spu,
    channelId: params.channelId,
    ...(params.month ? { month: params.month } : {}),
    ...diff,
  };
}

