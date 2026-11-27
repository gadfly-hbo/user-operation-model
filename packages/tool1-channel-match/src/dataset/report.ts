import { MATCH_CONFIG, scoreMatch, type MatchResult } from '@uom/core';
import type { ReportInput } from '../report/types.js';
import type { MatchDataset } from './types.js';

/**
 * 数据集 → 匹配结果 → 报告输入。
 *
 * 评分只走 `packages/core` 的共享内核，这里不出现任何评分公式。
 */

/** 对数据集中的每个「商品 × 渠道」组合打分。 */
export function scoreDataset(dataset: MatchDataset): MatchResult[] {
  const results: MatchResult[] = [];
  for (const product of dataset.products) {
    if (!product.portrait) continue;
    for (const channel of dataset.channels) {
      if (!channel.portrait) continue;
      results.push(
        scoreMatch({
          spu: product.spu,
          channelId: channel.id,
          month: dataset.selectedMonth,
          product: product.portrait,
          channel: channel.portrait,
          ...(product.price === undefined
            ? {}
            : { price: product.price, priceSource: product.priceSource ?? 'missing' }),
        }),
      );
    }
  }
  return results;
}

/** 组装报告输入。 */
export function buildReportInput(
  dataset: MatchDataset,
  results: MatchResult[],
  generatedAt: string,
): ReportInput {
  return {
    meta: {
      title: `工具 1 · 货渠匹配看板（${dataset.sourceLabel}）`,
      source: dataset.sourceLabel,
      isDemo: false,
      month: dataset.selectedMonth,
      generatedAt,
      configVersion: MATCH_CONFIG.version,
      notes: dataset.notes,
    },
    products: dataset.products.map((product) => ({
      spu: product.spu,
      name: product.name ?? product.spu,
      ...(product.retailAmount === undefined ? {} : { retailAmount: product.retailAmount }),
      ...(product.price === undefined ? {} : { price: product.price }),
    })),
    channels: dataset.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      ...(channel.type ? { type: channel.type } : {}),
    })),
    results,
  };
}
