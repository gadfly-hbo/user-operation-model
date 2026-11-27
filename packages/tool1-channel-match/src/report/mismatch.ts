import type { MatchResult } from '@uom/core';
import { dimensionLabel } from './labels.js';
import type { MismatchRow, ReportInput } from './types.js';

/**
 * 错配清单。
 *
 * 排序口径：`优先级 = 零售额 × (1 - 匹配分/100)`，降序。
 * 这比按匹配分排序更接近真实的组货调整优先级——高销售却低匹配的组合排在前面。
 *
 * **口径限制**：零售额是商品级指标，没有渠道级分解，因此该排序表示
 * 「组合调整优先级」，**不代表该渠道的实际销售额**。
 */

/** 未进入排序的单元及原因。 */
export interface SkippedMismatch {
  spu: string;
  channelId: string;
  reason: string;
}

/** 错配清单的计算结果。 */
export interface MismatchList {
  /** 全部已排序单元。 */
  rows: MismatchRow[];
  /** 未进入排序的单元。 */
  skipped: SkippedMismatch[];
}

function driverText(drivers: { dimension: string; delta: number }[]): string {
  return drivers.map((driver) => dimensionLabel(driver.dimension)).join(' / ');
}

/** 计算错配清单。 */
export function buildMismatchList(input: ReportInput): MismatchList {
  const productBySpu = new Map(input.products.map((product) => [product.spu, product]));
  const channelById = new Map(input.channels.map((channel) => [channel.id, channel]));
  const rows: MismatchRow[] = [];
  const skipped: SkippedMismatch[] = [];

  for (const result of input.results) {
    if (result.totalScore === null || result.grade === null) {
      skipped.push({
        spu: result.spu,
        channelId: result.channelId,
        reason: result.error === 'insufficient-dimensions' ? '可用维度不足，未产出匹配分' : '未评分',
      });
      continue;
    }
    const product = productBySpu.get(result.spu);
    const channel = channelById.get(result.channelId);
    if (!product || !channel) {
      skipped.push({ spu: result.spu, channelId: result.channelId, reason: '商品或渠道不在清单中' });
      continue;
    }
    if (product.retailAmount === undefined) {
      skipped.push({ spu: result.spu, channelId: result.channelId, reason: '缺零售额，无法计算错配优先级' });
      continue;
    }

    const score = result.totalScore;
    const flags: string[] = [];
    if (result.flags.productMonthUnknown) flags.push('单品画像无月份');
    if (result.flags.channelApproximate) flags.push('渠道画像为区间口径');
    if (result.flags.priceMissing) flags.push('缺价格');

    rows.push({
      rank: 0,
      spu: product.spu,
      productName: product.name,
      channelId: channel.id,
      channelName: channel.name,
      month: result.month,
      score,
      grade: result.grade,
      fuse: result.fuse,
      retailAmount: product.retailAmount,
      priority: product.retailAmount * (1 - score / 100),
      positiveDrivers: driverText(result.positiveDrivers),
      negativeDrivers: driverText(result.negativeDrivers),
      ...(product.price !== undefined ? { price: product.price } : {}),
      ...(result.priceFit ? { priceBand: result.priceFit.band, penalty: result.priceFit.penalty } : {}),
      flags,
    });
  }

  rows.sort(
    (left, right) =>
      right.priority - left.priority ||
      left.score - right.score ||
      left.spu.localeCompare(right.spu) ||
      left.channelId.localeCompare(right.channelId),
  );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { rows, skipped };
}

/** 错配清单的 CSV 列顺序（固定）。 */
export const MISMATCH_COLUMNS = [
  'rank',
  'spu',
  'product_name',
  'channel_id',
  'channel_name',
  'month',
  'score',
  'grade',
  'fuse',
  'retail_amount',
  'priority',
  'positive_drivers',
  'negative_drivers',
  'price',
  'high_share',
  'low_share',
  'penalty',
  'price_band',
  'flags',
] as const;

/** 生成错配清单 CSV（UTF-8 含 BOM，Excel 可直接打开）。 */
export function mismatchCsv(input: ReportInput, rows: MismatchRow[]): string {
  const escapeCell = (value: unknown): string => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [MISMATCH_COLUMNS.join(',')];
  for (const row of rows) {
    const result = input.results.find(
      (item) => item.spu === row.spu && item.channelId === row.channelId,
    );
    const priceFit = result?.priceFit;
    lines.push(
      [
        row.rank,
        row.spu,
        row.productName,
        row.channelId,
        row.channelName,
        row.month,
        row.score,
        row.grade,
        row.fuse ? 'yes' : 'no',
        row.retailAmount,
        Math.round(row.priority * 100) / 100,
        row.positiveDrivers,
        row.negativeDrivers,
        row.price ?? '',
        priceFit?.highShare === undefined ? '' : Math.round(priceFit.highShare * 10000) / 100,
        priceFit?.lowShare === undefined ? '' : Math.round(priceFit.lowShare * 10000) / 100,
        priceFit?.penalty ?? '',
        row.priceBand ?? '',
        row.flags.join(' / '),
      ]
        .map((cell) => escapeCell(cell))
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** 供渲染层复用的结果索引。 */
export function indexResults(results: MatchResult[]): Map<string, MatchResult> {
  const index = new Map<string, MatchResult>();
  for (const result of results) {
    index.set(`${result.spu}::${result.channelId}`, result);
  }
  return index;
}
