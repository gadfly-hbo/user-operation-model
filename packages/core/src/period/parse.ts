/**
 * 期间模型（切片 A · SA-01）。
 *
 * 月份是一等公民：四类期间（单月／区间／年份／未知）、覆盖判定与展开。
 * 年份导出按 R-7 记为全年区间并标注 year（近似），不再伪装成该年 1 月。
 * **任何查询都不回退到相邻月份。**
 */

/** 单月标签 `YYYY-MM`。 */
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** 区间标签 `YYYY-MM~YYYY-MM`。 */
const WINDOW_PATTERN = /^(\d{4})-(\d{2})~(\d{4})-(\d{2})$/;

/** 四位数字：先按 YYMM 月份解，月份分量非法时按四位年份解（复核修正）。 */
const FOUR_DIGIT_PATTERN = /^(\d{4})$/;

/** 期间类型。 */
export type PeriodKind = 'month' | 'window' | 'year' | 'unknown';

/** 解析后的期间。 */
export type Period =
  | { kind: 'month'; label: string; month: string }
  | { kind: 'window'; label: string; start: string; end: string }
  | { kind: 'year'; label: string; start: string; end: string }
  | { kind: 'unknown'; label: string };

/** 标签里的月份分量是否合法（1–12 月）。 */
function validMonthComponent(text: string): boolean {
  const month = Number(text.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** 解析期间标签。识别不了的写法返回 unknown（保留原标签），不猜测。 */
export function parsePeriod(label: string): Period {
  const text = label.trim();
  if (text === '') return { kind: 'unknown', label: '' };

  const single = MONTH_PATTERN.exec(text);
  if (single && validMonthComponent(text)) {
    return { kind: 'month', label: text, month: text };
  }

  const window = WINDOW_PATTERN.exec(text);
  if (window) {
    const start = `${window[1]}-${window[2]}`;
    const end = `${window[3]}-${window[4]}`;
    if (validMonthComponent(start) && validMonthComponent(end) && start <= end) {
      // 恰为同一自然年的 1 月到 12 月：这是年份聚合（R-7），不是任意区间
      if (start === `${window[1]}-01` && end === `${window[1]}-12`) {
        return { kind: 'year', label: text, start, end };
      }
      return { kind: 'window', label: text, start, end };
    }
  }

  const four = FOUR_DIGIT_PATTERN.exec(text);
  if (four) {
    // 归一化规则 §2.1：YYMM 是月份写法（2610 → 2026-10），先于四位年份尝试。
    // 与 normalize/identity.ts 的 parseMonthLabel 同一顺序。
    const yymm = four[1]!;
    const monthComponent = Number(yymm.slice(2, 4));
    if (monthComponent >= 1 && monthComponent <= 12) {
      const month = `20${yymm.slice(0, 2)}-${yymm.slice(2, 4)}`;
      return { kind: 'month', label: month, month };
    }
    // 四位年份：限定 1900–2100，超出（含 0000／9999）一律 unknown，不猜测
    const yearValue = Number(yymm);
    if (yearValue >= 1900 && yearValue <= 2100) {
      return {
        kind: 'year',
        label: `${yymm}-01~${yymm}-12`,
        start: `${yymm}-01`,
        end: `${yymm}-12`,
      };
    }
    return { kind: 'unknown', label: text };
  }

  return { kind: 'unknown', label: text };
}

/** 是否为合法自然月写法 `YYYY-MM`（01–12 月）。查询入参校验的唯一来源（验收修正一）。 */
export function isNaturalMonth(label: string): boolean {
  return parsePeriod(label).kind === 'month';
}

/**
 * 把画像的月份标签说成人能使用的 `month` 入参提示（复核应修-2）。
 *
 * 画像标签可能是区间或年份，直接把它们列成「可用月份」会诱导调用方传回
 * 入参校验拒绝的值。单月标签直接列出；区间／年份标签写成
 * 「month 须为落在 `<标签>` 内的自然月（YYYY-MM）」；unknown 标签不可用，不列出。
 */
export function describeAvailablePeriods(labels: string[]): string {
  const months: string[] = [];
  const ranges: string[] = [];
  for (const label of [...new Set(labels)].sort()) {
    const period = parsePeriod(label);
    if (period.kind === 'month') months.push(period.month);
    else if (period.kind === 'window' || period.kind === 'year') ranges.push(period.label);
  }
  const parts: string[] = [];
  if (months.length > 0) parts.push(`可用月份：${months.join('、')}`);
  if (ranges.length > 0) {
    parts.push(`区间／年份画像：month 须为落在 ${ranges.join('、')} 内的自然月（YYYY-MM）`);
  }
  return parts.length > 0 ? parts.join('；') : '没有可作为 month 的画像期间';
}

/**
 * 期间是否覆盖给定自然月 `YYYY-MM`。unknown 不覆盖任何月。
 *
 * `month` 必须是自然月写法（复核修正）：`2024-1`、`2610` 这类非自然月
 * 一律返回 false，不做字典序或写法层面的猜测比较；首尾空白按规范写法处理。
 */
export function periodCovers(period: Period, rawMonth: string): boolean {
  const parsed = parsePeriod(rawMonth);
  if (parsed.kind !== 'month') return false;
  const month = parsed.month;
  switch (period.kind) {
    case 'month':
      return period.month === month;
    case 'window':
    case 'year':
      return period.start <= month && month <= period.end;
    case 'unknown':
      return false;
  }
}

/** 把区间／年期间的起止展开为具体月份（升序，含端点）。 */
function expandRange(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  while (true) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    if (year === Number(end.slice(0, 4)) && month === Number(end.slice(5, 7))) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** 把期间展开为具体月份。unknown 展开为空。 */
export function periodMonths(period: Period): string[] {
  switch (period.kind) {
    case 'month':
      return [period.month];
    case 'window':
    case 'year':
      return expandRange(period.start, period.end);
    case 'unknown':
      return [];
  }
}
