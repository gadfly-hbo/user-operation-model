import type { DataIndex } from '../index/types.js';
import { platformId } from '../normalize/catalog/tables.js';
import type { NormalizedPortrait } from '../normalize/types.js';
import { isNaturalMonth, parsePeriod, periodCovers } from './parse.js';

/**
 * 画像选择（切片 A · SA-02）。
 *
 * core 一处实现，MCP 与工具1 共用。歧义显式返回，不静默挑选；
 * **任何情况不回退到相邻月份。**
 */

/** 参与选择的画像来源（索引或其子集）。 */
export type PortraitSource = Pick<DataIndex, 'portraits'>;

/** 画像与所选月的匹配方式。 */
export type PortraitMatchKind = 'exact' | 'window' | 'year' | 'unknown';

/** 多平台消歧的显式优先级：抖音＞天猫＞京东，其余按名称序兜底。 */
export const PLATFORM_PREFERENCE = ['douyin', 'tmall', 'jd'] as readonly string[];

/** 匹配层的优先序：exact＞window＞year＞unknown。 */
const TIER_RANK: Record<PortraitMatchKind, number> = { exact: 0, window: 1, year: 2, unknown: 3 };

/** 选择结果。 */
export type SelectPortraitResult =
  | { status: 'found'; portrait: NormalizedPortrait; match: PortraitMatchKind }
  | { status: 'not-found' }
  | {
      status: 'ambiguous';
      /** 歧义维度：月份或平台。 */
      reason: 'month' | 'platform';
      /** 候选画像的月份标签（去重升序）。 */
      months: string[];
      /** 候选画像的来源平台（去重升序）。 */
      platforms: string[];
    }
  /** `month` 入参不是自然月 `YYYY-MM`（验收修正一）：不做任何查找。 */
  | { status: 'invalid-month'; month: string };

export interface SelectPortraitQuery {
  entityType: string;
  /** 实体标识候选（渠道侧可同时是店铺编码与店铺名）。 */
  entityIds: string[];
  /** 计算所用自然月 `YYYY-MM`；不传时实体须只有一份画像。 */
  month?: string;
  /** 指定来源平台消歧（接受中文或平台标识写法）。 */
  platform?: string;
}

/** 期间类型 → 匹配形态：单月为 exact。 */
function toMatchKind(kind: 'month' | 'window' | 'year'): PortraitMatchKind {
  return kind === 'month' ? 'exact' : kind;
}

/** 画像月份标签对应的匹配形态（period 层唯一判定，查询层共用）。 */
export function portraitMatchKind(month: string): PortraitMatchKind {
  const period = parsePeriod(month);
  return period.kind === 'unknown' ? 'unknown' : toMatchKind(period.kind);
}

/** 画像标签相对所选月的匹配层（null 表示不覆盖；unknown 标签对任意月都可参与）。 */
function tierOfLabel(label: string, month: string): PortraitMatchKind | null {
  const period = parsePeriod(label);
  if (period.kind === 'unknown') return 'unknown';
  return periodCovers(period, month) ? toMatchKind(period.kind) : null;
}

/** 画像标签相对所选月的匹配层（null 表示不覆盖）。 */
function tierOf(portrait: NormalizedPortrait, month: string): PortraitMatchKind | null {
  return tierOfLabel(portrait.month, month);
}

/**
 * 画像标签相对自然月是否可被选中（与 `selectPortrait` 的分层规则同源）。
 * `list_channels` 等调用方用它统一「该月有画像」的判定（验收修正一）。
 */
export function portraitLabelCovers(label: string, month: string): boolean {
  return tierOfLabel(label, month) !== null;
}

/** 画像自身标签对应的匹配形态。 */
function kindOf(portrait: NormalizedPortrait): PortraitMatchKind {
  return portraitMatchKind(portrait.month);
}

/** 画像的来源平台（platformLabels 的第一个键）。 */
function platformOf(portrait: NormalizedPortrait): string {
  return Object.keys(portrait.platformLabels)[0] ?? '';
}

/** 去重升序。 */
function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** 画像标签是否覆盖所选月（SA-02 主逻辑）。 */
export function selectPortrait(
  source: PortraitSource,
  query: SelectPortraitQuery,
): SelectPortraitResult {
  // month 必须是自然月（验收修正一）：区间标签、越界月份一律拒绝，不做任何查找
  if (query.month !== undefined && !isNaturalMonth(query.month)) {
    return { status: 'invalid-month', month: query.month };
  }
  const ids = new Set(query.entityIds.filter((id) => id !== ''));
  let candidates = source.portraits.filter(
    (portrait) => portrait.entityType === query.entityType && ids.has(portrait.entityId),
  );

  // 指定平台：先在候选集上过滤（中文写法归一到平台标识再比较）
  if (query.platform) {
    const wanted = platformId(query.platform);
    candidates = candidates.filter((portrait) => platformId(platformOf(portrait)) === wanted);
    if (candidates.length === 0) return { status: 'not-found' };
  }

  // 不带 month：恰一份 → found；多份 → ambiguous(month)
  if (query.month === undefined) {
    if (candidates.length === 0) return { status: 'not-found' };
    if (candidates.length === 1) {
      return { status: 'found', portrait: candidates[0]!, match: kindOf(candidates[0]!) };
    }
    return {
      status: 'ambiguous',
      reason: 'month',
      months: uniqueSorted(candidates.map((portrait) => portrait.month).filter((m) => m !== '')),
      platforms: uniqueSorted(candidates.map(platformOf).filter((p) => p !== '')),
    };
  }

  const month = query.month;
  // 带 month：按 exact＞window＞year＞unknown 取最优一层，**不回退到相邻月份**
  const scored = candidates
    .map((portrait) => ({ portrait, tier: tierOf(portrait, month) }))
    .filter((item): item is { portrait: NormalizedPortrait; tier: PortraitMatchKind } =>
      item.tier !== null,
    );
  if (scored.length === 0) return { status: 'not-found' };

  const bestTier = scored.reduce((best, item) =>
    TIER_RANK[item.tier] < TIER_RANK[best] ? item.tier : best,
  'unknown' as PortraitMatchKind);
  const tier = scored.filter((item) => item.tier === bestTier);

  // 指定了 platform：候选集已按平台过滤，同平台多份（重复文件）取索引顺序首份
  if (query.platform !== undefined) {
    return { status: 'found', portrait: tier[0]!.portrait, match: bestTier };
  }

  // 该层仅一份，或多份同平台（重复文件）→ 取索引顺序首份
  const platforms = uniqueSorted(tier.map((item) => platformOf(item.portrait)).filter((p) => p !== ''));
  if (platforms.length <= 1) {
    return { status: 'found', portrait: tier[0]!.portrait, match: bestTier };
  }

  // 多份且平台不同 → ambiguous(platform)
  return {
    status: 'ambiguous',
    reason: 'platform',
    months: uniqueSorted(tier.map((item) => item.portrait.month).filter((m) => m !== '')),
    platforms,
  };
}
