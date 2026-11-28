import { existsSync, readFileSync } from 'node:fs';
import type { DataRangeDeclaration } from './types.js';

/**
 * `data/README.md` 的「数据时间范围声明」解析。
 *
 * 声明表是 Markdown 表格。当前模板里内容写在 HTML 注释占位符中，
 * 解析要容忍这种写法：**注释内容视为未填写**。
 *
 * 覆盖规则（见 `docs/normalize-rules.md` §12.6）：
 * - 覆盖月份可解析 → 索引只覆盖该月份范围，范围外记 issue 跳过
 * - 渠道范围／商品范围用标识清单（空格或标点分隔）声明，
 *   能在索引里找到对应记录的标识才生效；找不到则不裁剪并记说明
 * - 未填写 → 保持现状（覆盖全部扫描结果），索引里记录「未声明」
 */

/** 声明解析结果（标识清单的匹配在索引构建时完成）。 */
export interface ParsedDeclaration {
  /** 是否已填写（至少一项范围有内容）。 */
  declared: boolean;
  /** 覆盖月份集合（YYYY-MM）。 */
  months: string[];
  /** 覆盖月份原文。 */
  monthsText: string;
  /** 渠道范围原文。 */
  channelsText: string;
  /** 商品范围原文。 */
  productsText: string;
  /** 声明表原文（按项名索引）。 */
  raw: Record<string, string>;
  /** 解析说明。 */
  notes: string[];
}

/** 未声明的声明对象。 */
export function undeclaredDeclaration(reason: string): ParsedDeclaration {
  return {
    declared: false,
    months: [],
    monthsText: '',
    channelsText: '',
    productsText: '',
    raw: {},
    notes: [`数据时间范围未声明：${reason}`],
  };
}

/** 解析 `data/README.md` 的声明表。 */
export function parseDataDeclaration(path: string): ParsedDeclaration {
  if (!existsSync(path)) {
    return undeclaredDeclaration('未找到 data/README.md');
  }
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.includes('数据时间范围声明'));
  if (headingIndex === -1) {
    return undeclaredDeclaration('README 中没有「数据时间范围声明」小节');
  }

  const items = new Map<string, string>();
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line.startsWith('#')) break;
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    const name = stripComment(cells[0] ?? '');
    if (name === '' || name === '项') continue;
    items.set(name, stripComment(cells.slice(1).join(' ').trim()));
  }

  const raw: Record<string, string> = {};
  for (const [name, value] of items) raw[name] = value;

  const monthsText = raw['覆盖月份'] ?? '';
  const channelsText = raw['渠道范围'] ?? '';
  const productsText = raw['商品范围'] ?? '';
  const notes: string[] = [];
  const months = parseMonthRange(monthsText);
  if (monthsText !== '' && months.length === 0) {
    notes.push(`覆盖月份声明无法解析为月份：${monthsText}`);
  }

  const declared = months.length > 0 || channelsText !== '' || productsText !== '';
  if (!declared) {
    notes.push('数据时间范围未声明：声明表为空（占位符不算填写）');
  }

  return { declared, months, monthsText, channelsText, productsText, raw, notes };
}

/** 去掉 HTML 注释占位符里的内容（占位符视为未填写）。 */
function stripComment(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * 解析覆盖月份。
 *
 * `2026-01` → 该月；`2025-07 ~ 2026-06` → 从起始月到结束月的闭区间。
 */
export function parseMonthRange(text: string): string[] {
  const matches = [...text.matchAll(/(\d{4})-(\d{2})/g)];
  if (matches.length === 0) return [];
  const start = matches[0]!;
  const end = matches.length > 1 ? matches[matches.length - 1]! : start;
  const startYear = Number(start[1]);
  const startMonth = Number(start[2]);
  const endYear = Number(end[1]);
  const endMonth = Number(end[2]);
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return [];
  if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) return [];

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  // 上限 240 个月，避免异常声明把索引构建拖垮
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 240) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** 把范围声明原文切成标识清单（空格或标点分隔）。 */
export function scopeTokens(text: string): string[] {
  return text
    .split(/[\s,，、;；/|]+/)
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

/** 构造索引里的声明对象（标识清单在索引构建时匹配）。 */
export function toDeclaration(
  parsed: ParsedDeclaration,
  channels: string[],
  products: string[],
): DataRangeDeclaration {
  return {
    declared: parsed.declared,
    months: parsed.months,
    channels,
    products,
    raw: parsed.raw,
    notes: parsed.notes,
  };
}
