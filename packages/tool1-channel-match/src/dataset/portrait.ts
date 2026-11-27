import { coversMonth, isIntervalWindow, parsePortraitWindow } from '@uom/core';
import type { MatchPortraitInput } from '@uom/core';
import type { NormalizedPortrait } from '@uom/core';

/**
 * 画像挑选与转换。
 *
 * 时间窗规则（见 P1 规格 §6.4）：单月画像必须等于所选月；区间画像覆盖所选月时
 * 可用但标注近似；无月份画像按静态事实画像使用。**不回退到相邻月份。**
 */

/** 画像与所选月的匹配方式。 */
export type PortraitMatch = 'exact' | 'window' | 'unknown';

/** 归一化画像 → 内核输入。 */
export function toMatchPortraitInput(portrait: NormalizedPortrait): MatchPortraitInput {
  const dimensions: MatchPortraitInput['dimensions'] = {};
  for (const [dimension, projection] of Object.entries(portrait.projections)) {
    dimensions[dimension] = Object.fromEntries(
      Object.entries(projection.labels).map(([label, value]) => [label, { share: value.share }]),
    );
  }
  const window = portrait.month.includes('~') ? portrait.month : undefined;
  return {
    dimensions,
    month: portrait.month,
    ...(window ? { window } : {}),
    ...(Object.keys(portrait.platformLabels)[0]
      ? { platform: Object.keys(portrait.platformLabels)[0] }
      : {}),
  };
}

/** 画像标签是否覆盖所选月。 */
export function portraitCovers(portrait: NormalizedPortrait, month: string): PortraitMatch | null {
  if (portrait.month.trim() === '') return 'unknown';
  if (portrait.month === month) return 'exact';
  if (isIntervalWindow(portrait.month) && coversMonth(portrait.month, month)) return 'window';
  return null;
}

/**
 * 从候选画像里挑出可用于所选月的那一份。
 *
 * 优先精确月，其次区间覆盖，最后无月份。命中多份同类型时按平台名确定性选择。
 */
export function pickPortrait(
  candidates: NormalizedPortrait[],
  month: string,
): { portrait: NormalizedPortrait; match: PortraitMatch } | undefined {
  const scored = candidates
    .map((portrait) => ({ portrait, match: portraitCovers(portrait, month) }))
    .filter((item): item is { portrait: NormalizedPortrait; match: PortraitMatch } => item.match !== null);
  if (scored.length === 0) return undefined;

  const rank: Record<PortraitMatch, number> = { exact: 0, window: 1, unknown: 2 };
  scored.sort((left, right) => {
    const byMatch = rank[left.match] - rank[right.match];
    if (byMatch !== 0) return byMatch;
    const leftPlatform = Object.keys(left.portrait.platformLabels)[0] ?? '';
    const rightPlatform = Object.keys(right.portrait.platformLabels)[0] ?? '';
    return leftPlatform.localeCompare(rightPlatform);
  });
  const best = scored[0]!;
  return { portrait: best.portrait, match: best.match };
}

/** 解析画像标签为月份与区间。 */
export function readWindow(label: string): { month?: string; window?: string } {
  return parsePortraitWindow(label);
}
