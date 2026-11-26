/**
 * 占比与 TGI 的解析。
 *
 * 占比的口径在各平台不统一：
 * - 抖音／天猫导出百分比字符串（`39.26%`）
 * - 京东导出小数（`0.6`）
 * 因此按「含 % 则除以 100，否则按原值」处理，不做二次猜测。
 *
 * 缺失一律返回 undefined，**不补 0**（缺失与 0 是两回事）。
 */
export function parseShare(raw: string | number | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).trim();
  if (text === '' || text === '-' || text === 'NaN') return undefined;

  if (text.endsWith('%')) {
    const value = Number.parseFloat(text.slice(0, -1));
    return Number.isFinite(value) ? value / 100 : undefined;
  }
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}

/** TGI 解析。缺失返回 undefined。 */
export function parseTgi(raw: string | number | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).trim();
  if (text === '' || text === '-' || text === 'NaN') return undefined;
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}

/** 数值字段解析，空值返回 undefined。 */
export function parseNumber(raw: string | number | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).trim();
  if (text === '' || text === '-') return undefined;
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}
