/**
 * 画像时间窗规则。
 *
 * 单月画像必须等于所选月；区间画像覆盖所选月时可用但标注为近似；
 * 单品画像无月份时按静态事实画像使用。**任何情况都不回退到相邻月份。**
 */

/** 单月标签 `YYYY-MM`。 */
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** 区间标签 `YYYY-MM~YYYY-MM`。 */
const WINDOW_PATTERN = /^(\d{4})-(\d{2})~(\d{4})-(\d{2})$/;

/** 画像标签解析结果。 */
export interface PortraitWindow {
  /** 单月标签。 */
  month?: string;
  /** 区间标签。 */
  window?: string;
}

/** 解析画像的月份标签。空串表示源数据无月份。 */
export function parsePortraitWindow(label: string): PortraitWindow {
  const text = label.trim();
  if (text === '') return {};
  if (MONTH_PATTERN.test(text)) return { month: text };
  const window = WINDOW_PATTERN.exec(text);
  if (window) {
    return { month: window[1]!, window: `${window[1]}~${window[3]}` };
  }
  return {};
}

/** 是否是区间标签。 */
export function isIntervalWindow(label: string): boolean {
  return WINDOW_PATTERN.test(label.trim());
}

/**
 * 画像标签是否覆盖给定自然月。
 *
 * - 单月：完全相等
 * - 区间：起始月 ≤ 目标月 ≤ 结束月
 */
export function coversMonth(label: string, month: string): boolean {
  const parsed = parsePortraitWindow(label);
  if (parsed.month && !parsed.window) return parsed.month === month;
  if (parsed.window) {
    const [start, end] = parsed.window.split('~');
    return Boolean(start && end && start <= month && month <= end);
  }
  return false;
}
