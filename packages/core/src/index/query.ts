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
import { parsePeriod, periodCovers } from '../period/parse.js';
import {
  portraitLabelCovers,
  portraitMatchKind,
  selectPortrait,
  type PortraitMatchKind,
  type SelectPortraitResult,
} from '../period/select.js';

/** 按款号取商品档案。 */
export function findProduct(index: DataIndex, spu: string): ProductDossier | undefined {
  return index.products.find((product) => product.spu === spu);
}

/** 按店铺编码取渠道。 */
export function findChannel(index: DataIndex, channelId: string): ChannelRecord | undefined {
  return index.channels.find((channel) => channel.channelId === channelId);
}

/**
 * 取画像。**精确匹配，不回退**（切片 A 起委托 `selectPortrait`，SA-02）。
 *
 * 指定月份时按 exact＞window＞year＞unknown 取覆盖该月的最优一层；
 * 未指定月份且实体恰有一份画像时取该份。歧义与缺失都返回 undefined，
 * 需要区分「缺失」与「歧义」的调用方请直接用 `selectPortrait`。
 */
export function findPortrait(index: DataIndex, key: PortraitKey): NormalizedPortrait | undefined {
  const selection = selectPortrait(index, {
    entityType: key.entityType,
    entityIds: [key.entityId],
    ...(key.month ? { month: key.month } : {}),
  });
  return selection.status === 'found' ? selection.portrait : undefined;
}

/** 画像的来源平台（platformLabels 的第一个键）。 */
export function portraitPlatform(portrait: NormalizedPortrait): string {
  return Object.keys(portrait.platformLabels)[0] ?? '';
}

/**
 * 渠道在画像侧可能用到的实体标识。
 *
 * 优先是渠道宽表的店铺名（画像文件按店铺名命名），其次是店铺编码本身。
 *
 * 别名目录存在时，别名与规范名互相可达：画像实体名归一后仍能反查，
 * 渠道店铺名是别名时也能找到规范名对应的画像。
 */
export function channelEntityIds(index: DataIndex, channelId: string): string[] {
  const ids = new Set<string>([channelId]);
  const channel = findChannel(index, channelId);
  if (channel?.name) ids.add(channel.name);
  for (const alias of index.entityAliases ?? []) {
    if (!alias.alias || !alias.canonical) continue;
    if (alias.channelId && alias.channelId === channelId) {
      ids.add(alias.canonical);
      ids.add(alias.alias);
    }
    if (channel?.name && (alias.alias === channel.name || alias.canonical === channel.name)) {
      ids.add(alias.canonical);
      ids.add(alias.alias);
    }
  }
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
    // 同一月份可能命中多个平台，去重后再列出
    .filter((month, position, all) => all.indexOf(month) === position)
    .sort();
}

export interface ChannelFilter {
  month?: string;
  type?: string;
}

/**
 * 渠道列表。`month` 过滤的是**有画像覆盖的月份**（验收修正一）：
 * 与 `selectPortrait` 同一套覆盖规则（exact＞window＞year＞unknown），
 * 区间／年份画像覆盖该月即算有画像，不再按标签字面相等。
 */
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
      .filter(
        (portrait) =>
          !filter.month || portraitLabelCovers(portrait.month, filter.month),
      )
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
  /**
   * 按渠道过滤：店铺编码或店铺名。
   * 需要商品↔渠道关联数据（`data/tables/product-channel.csv`），
   * 关联数据缺失时不返回任何商品。
   */
  channel?: string;
}

/** 商品检索。 */
export function listProducts(index: DataIndex, filter: ProductFilter = {}): ProductDossier[] {
  // 按渠道过滤需要商品↔渠道关联数据；关联数据缺失时结果为空（不猜、不回退）
  const linkedSpus = filter.channel
    ? new Set(
        (index.productChannels ?? [])
          .filter((link) => resolveChannelIds(index, filter.channel!).has(link.channelId))
          .map((link) => link.spu),
      )
    : undefined;

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
    if (linkedSpus && !linkedSpus.has(product.spu)) return false;
    return true;
  });
}

/**
 * 把渠道过滤参数解析成店铺编码集合。
 *
 * 接受店铺编码或店铺名；查不到时保留原值，便于直接用编码命中关联表。
 */
export function resolveChannelIds(index: DataIndex, key: string): Set<string> {
  const ids = new Set<string>([key]);
  for (const channel of index.channels) {
    if (channel.channelId === key || channel.name === key) ids.add(channel.channelId);
  }
  return ids;
}

export interface TagHit {
  entityType: Portrait['entityType'];
  entityId: string;
  /** 画像来源平台（抖音／天猫／京东）。 */
  platform: string;
  month: string;
  share: number;
  tgi?: number;
  /** 命中的统一维度。 */
  dimension: string;
  /** 命中的标签值。 */
  label: string;
  /** 画像与所传 `month` 的匹配方式（仅带 `month` 查询时返回，SA-03）。 */
  match?: PortraitMatchKind;
}

/** 按人群标签反查实体。 */
export function searchByTag(
  index: DataIndex,
  params: { dimension: string; label: string; scope?: string; topN?: number; month?: string },
): TagHit[] {
  const scope = params.scope ?? 'all';
  const hits: TagHit[] = [];
  for (const portrait of index.portraits) {
    if (scope !== 'all' && portrait.entityType !== scope) continue;
    if (
      params.month !== undefined &&
      !periodCovers(parsePeriod(portrait.month), params.month)
    ) {
      continue;
    }
    const projection = portrait.projections[params.dimension];
    if (!projection) continue;
    const label = projection.labels[params.label];
    if (!label) continue;
    hits.push({
      entityType: portrait.entityType,
      entityId: portrait.entityId,
      platform: portraitPlatform(portrait),
      month: portrait.month,
      share: label.share,
      ...(label.tgi !== undefined ? { tgi: label.tgi } : {}),
      dimension: params.dimension,
      label: params.label,
      ...(params.month !== undefined ? { match: portraitMatchKind(portrait.month) } : {}),
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
  /** 是否参与过画像比较。无画像时画像分不计入总分。 */
  hasPortrait: boolean;
}

/**
 * 属性相似度：各属性键上的 Jaccard 系数的算术平均。
 *
 * 单键的 Jaccard = |交集| / |并集|；双方都缺失的属性键**跳过**（不计入分母）。
 */
export function attributeJaccard(a: ProductDossier, b: ProductDossier): number {
  const keys = ['category_l1', 'category_l2', 'category_l3', 'silhouette', 'fabric', 'ip'];
  const scores: number[] = [];
  for (const key of keys) {
    const left = new Set(a.attributes?.[key] ?? []);
    const right = new Set(b.attributes?.[key] ?? []);
    if (left.size === 0 && right.size === 0) continue;
    const union = new Set([...left, ...right]);
    let intersection = 0;
    for (const value of left) if (right.has(value)) intersection += 1;
    scores.push(intersection / union.size);
  }
  if (scores.length === 0) return 0;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

/**
 * 相似款 Look-back：属性相似度与画像相似度各占一半。
 *
 * 画像部分只在**双方都有数据**的统一维度上比较。
 * 带 `month`（SA-03）时目标与候选都改用覆盖该月的画像（selectPortrait 分层选取）；
 * 目标或候选在该月无画像时不回退相邻月份，画像分不计入。
 */
export function similarProducts(
  index: DataIndex,
  params: { spu: string; topN?: number; month?: string; platform?: string },
): SimilarHit[] {
  const target = findProduct(index, params.spu);
  if (!target) return [];
  const targetSelection = selectPortrait(index, {
    entityType: 'product',
    entityIds: [params.spu],
    ...(params.month !== undefined ? { month: params.month } : {}),
    ...(params.platform !== undefined ? { platform: params.platform } : {}),
  });
  const targetPortrait = targetSelection.status === 'found' ? targetSelection.portrait : undefined;

  const hits: SimilarHit[] = [];
  for (const candidate of index.products) {
    if (candidate.spu === params.spu) continue;
    const attributeScore = attributeJaccard(target, candidate);
    let portraitScore = 0;
    let sharedDimensions = 0;
    if (targetPortrait) {
      const candidateSelection = selectPortrait(index, {
        entityType: 'product',
        entityIds: [candidate.spu],
        ...(params.month !== undefined ? { month: params.month } : {}),
        ...(params.platform !== undefined ? { platform: params.platform } : {}),
      });
      const candidatePortrait =
        candidateSelection.status === 'found' ? candidateSelection.portrait : undefined;
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
    // 无画像可比时，画像分**不计入**总分，避免系统性压低无画像商品
    const hasPortrait = sharedDimensions > 0;
    const score = hasPortrait
      ? attributeScore * 0.5 + portraitScore * 0.5
      : attributeScore;
    hits.push({
      spu: candidate.spu,
      ...(candidate.name ? { name: candidate.name } : {}),
      score,
      attributeScore,
      portraitScore,
      sharedDimensions,
      hasPortrait,
    });
  }
  hits.sort((left, right) => right.score - left.score);
  return hits.slice(0, params.topN ?? 10);
}

/**
 * 聚合层级画像。
 *
 * 品类层级由商品档案的品类字段推导；系列／爆款／IP 层级需要**聚合口径表**
 * （`data/tables/aggregate-groups.csv`），表未接入时返回 undefined。
 * 聚合口径见归一化规则 §5.6。
 *
 * 带 `month`（SA-03）时只聚合各成员**覆盖该月**的画像（含全部平台）；
 * 不带 `month` 时成员有多份画像即视为不可唯一确定，该成员不参与聚合
 * （MCP 层用 `selectAggregateMembers` 把歧义显式返回给调用方）。
 */
export function aggregatePortrait(
  index: DataIndex,
  params: { level: string; key: string; month?: string },
): NormalizedPortrait | undefined {
  const members = aggregateMembers(index, params.level, params.key);
  if (members.length === 0) return undefined;

  const memberPortraits = members.flatMap((product) => {
    const own = index.portraits.filter(
      (portrait) => portrait.entityType === 'product' && portrait.entityId === product.spu,
    );
    if (params.month === undefined) {
      const selection = selectPortrait({ portraits: own }, {
        entityType: 'product',
        entityIds: [product.spu],
      });
      return selection.status === 'found' ? [selection.portrait] : [];
    }
    const month = params.month;
    return own.filter((portrait) => periodCovers(parsePeriod(portrait.month), month));
  });
  if (memberPortraits.length === 0) return undefined;

  const dimensions: Portrait['projections'] = {};
  const allDimensions = new Set(
    memberPortraits.flatMap((portrait) => Object.keys(portrait.projections)),
  );
  for (const dimension of allDimensions) {
    const accumulators = new Map<
      string,
      { share: number; tgiSum: number; tgiWeight: number }
    >();
    let counted = 0;
    for (const portrait of memberPortraits) {
      const projection = portrait.projections[dimension];
      if (!projection) continue;
      counted += 1;
      for (const [label, value] of Object.entries(projection.labels)) {
        const existing = accumulators.get(label) ?? { share: 0, tgiSum: 0, tgiWeight: 0 };
        existing.share += value.share;
        if (value.tgi !== undefined) {
          // TGI 按占比加权平均：Σ(tgiᵢ × shareᵢ) / Σ(shareᵢ)
          existing.tgiSum += value.tgi * value.share;
          existing.tgiWeight += value.share;
        }
        accumulators.set(label, existing);
      }
    }
    if (counted === 0) continue;
    // 占比取平均（各成员等权）；TGI 是按占比的加权平均，不再缩放
    const labels: Record<string, PortraitLabel> = {};
    for (const [label, accumulator] of accumulators) {
      labels[label] = {
        share: accumulator.share / counted,
        ...(accumulator.tgiWeight > 0
          ? { tgi: accumulator.tgiSum / accumulator.tgiWeight }
          : {}),
      };
    }
    dimensions[dimension] = { dimension, labels };
  }

  return {
    entityType: params.level,
    entityId: params.key,
    month: memberPortraits[0]?.month ?? '',
    platformLabels: {},
    projections: dimensions,
  };
}

/** 聚合层级的成员商品：品类由档案推导，其余按聚合口径表。 */
function aggregateMembers(index: DataIndex, level: string, key: string): ProductDossier[] {
  return level === 'category'
    ? index.products.filter((product) => {
        const category = product.category;
        const haystack = [category?.l1, category?.l2, category?.l3].filter(Boolean).join('/');
        return haystack.includes(key);
      })
    : productsByGroup(index, level, key);
}

/** 单个成员的画像选择结果（SA-03：聚合前显式暴露歧义）。 */
export interface AggregateMemberSelection {
  spu: string;
  selection: SelectPortraitResult;
}

/** 逐成员解析聚合画像。MCP 层用它把「成员多份画像」的歧义显式返回给调用方。 */
export function selectAggregateMembers(
  index: DataIndex,
  params: { level: string; key: string; month?: string },
): AggregateMemberSelection[] {
  return aggregateMembers(index, params.level, params.key).map((product) => ({
    spu: product.spu,
    selection: selectPortrait(index, {
      entityType: 'product',
      entityIds: [product.spu],
      ...(params.month !== undefined ? { month: params.month } : {}),
    }),
  }));
}

/** 按聚合口径表取某层级的成员商品。 */
function productsByGroup(index: DataIndex, level: string, key: string): ProductDossier[] {
  const groups = index.aggregateGroups;
  if (!groups || groups.length === 0) return [];
  const field = level as 'series' | 'hot' | 'ip';
  const spus = new Set(
    groups.filter((group) => group[field] === key).map((group) => group.spu),
  );
  if (spus.size === 0) return [];
  return index.products.filter((product) => spus.has(product.spu));
}

/** 商品↔渠道画像差异。**只产出差异，不产出匹配分与评级**（属 P1 匹配内核）。 */
export function compareProductChannel(
  index: DataIndex,
  params: {
    spu: string;
    channelId: string;
    month?: string;
    /** 商品侧平台消歧（SA-03）。 */
    productPlatform?: string;
    /** 渠道侧平台消歧（SA-03）。 */
    channelPlatform?: string;
  },
): ProductChannelComparison | undefined {
  const productSelection = selectPortrait(index, {
    entityType: 'product',
    entityIds: [params.spu],
    ...(params.month !== undefined ? { month: params.month } : {}),
    ...(params.productPlatform !== undefined ? { platform: params.productPlatform } : {}),
  });
  if (productSelection.status !== 'found') return undefined;

  const channelSelection = selectPortrait(index, {
    entityType: 'channel',
    entityIds: channelEntityIds(index, params.channelId),
    ...(params.month !== undefined ? { month: params.month } : {}),
    ...(params.channelPlatform !== undefined ? { platform: params.channelPlatform } : {}),
  });
  if (channelSelection.status !== 'found') return undefined;

  const diff = diffPortraits(productSelection.portrait, channelSelection.portrait);
  return {
    spu: params.spu,
    channelId: params.channelId,
    ...(params.month !== undefined ? { month: params.month } : {}),
    ...diff,
  };
}

