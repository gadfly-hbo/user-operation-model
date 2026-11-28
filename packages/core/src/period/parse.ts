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

/** 年份标签 `YYYY`。 */
const YEAR_PATTERN = /^(\d{4})$/;

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

  const year = YEAR_PATTERN.exec(text);
  if (year) {
    const value = year[1]!;
    return { kind: 'year', label: `${value}-01~${value}-12`, start: `${value}-01`, end: `${value}-12` };
  }

  return { kind: 'unknown', label: text };
}

/** 是否为合法自然月写法 `YYYY-MM`（01–12 月）。查询入参校验的唯一来源（验收修正一）。 */
export function isNaturalMonth(label: string): boolean {
  return parsePeriod(label).kind === 'month';
}

/** 期间是否覆盖给定自然月 `YYYY-MM`。unknown 不覆盖任何月。 */
export function periodCovers(period: Period, month: string): boolean {
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
