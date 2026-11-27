import {
  buildIndex,
  channelEntityIds,
  isIntervalWindow,
  parseMonthLabel,
  type DataIndex,
} from '@uom/core';
import { pickPortrait, toMatchPortraitInput } from './portrait.js';
import type { MatchDataset } from './types.js';

/**
 * `data/` 正式路径的数据集适配。
 *
 * 复用归一化层与索引查询原语，不另建数据访问逻辑。
 */

export interface DataRootDatasetOptions {
  /** 数据根目录，默认 `data`。 */
  dataRoot: string;
  /** 计算所用自然月；缺省取渠道画像覆盖的最新月份。 */
  month?: string;
}

/** 索引里出现过的月份（区间取结束月）。 */
export function indexMonths(index: DataIndex): string[] {
  const months = new Set<string>();
  for (const portrait of index.portraits) {
    if (portrait.entityType !== 'channel') continue;
    const label = portrait.month.trim();
    if (label === '') continue;
    if (isIntervalWindow(label)) {
      const end = label.split('~')[1];
      if (end) months.add(end);
      continue;
    }
    const parsed = parseMonthLabel(label);
    if (parsed && !parsed.includes('~')) months.add(parsed);
  }
  return [...months].sort();
}

/** 构建 `data/` 数据集。 */
export async function buildDataRootDataset(
  options: DataRootDatasetOptions,
): Promise<MatchDataset> {
  const index = await buildIndex({ dataRoot: options.dataRoot });
  const months = indexMonths(index);
  const notes: string[] = [];

  const selectedMonth =
    options.month ??
    (months.length > 0 ? months[months.length - 1]! : new Date().toISOString().slice(0, 7));
  if (months.length === 0) {
    notes.push('索引中没有可用的渠道画像月份，矩阵为空。');
  }

  // 渠道：店铺编码为 ID，店铺名为显示名
  const channels = [];
  let channelsWithoutPortrait = 0;
  for (const channel of index.channels) {
    const ids = channelEntityIds(index, channel.channelId);
    const candidates = index.portraits.filter(
      (portrait) => portrait.entityType === 'channel' && ids.includes(portrait.entityId),
    );
    const picked = pickPortrait(candidates, selectedMonth);
    if (!picked) {
      channelsWithoutPortrait += 1;
      continue;
    }
    channels.push({
      id: channel.channelId,
      name: channel.name ?? channel.channelId,
      ...(channel.channelType ? { type: channel.channelType } : {}),
      portrait: toMatchPortraitInput(picked.portrait),
      portraitPlatform: Object.keys(picked.portrait.platformLabels)[0],
      portraitMatch: picked.match,
    });
  }
  if (channelsWithoutPortrait > 0) {
    notes.push(`${channelsWithoutPortrait} 个渠道在 ${selectedMonth} 无画像，未进入矩阵。`);
  }

  // 商品：有画像的款号
  const products = [];
  let withoutPortrait = 0;
  let withoutPrice = 0;
  for (const product of index.products) {
    const candidates = index.portraits.filter(
      (portrait) => portrait.entityType === 'product' && portrait.entityId === product.spu,
    );
    const picked = pickPortrait(candidates, selectedMonth);
    if (!picked) {
      withoutPortrait += 1;
      continue;
    }
    const price = product.price ?? {};
    let unitPrice: number | undefined;
    let priceSource: 'actual-unit-price' | 'retail-amount-qty' | 'unit-price' | 'missing' = 'missing';
    if (price.actualUnitPrice !== undefined && price.actualUnitPrice > 0) {
      unitPrice = price.actualUnitPrice;
      priceSource = 'actual-unit-price';
    } else if (
      price.retailAmount !== undefined &&
      price.retailAmount > 0 &&
      price.retailQty !== undefined &&
      price.retailQty > 0
    ) {
      unitPrice = Math.round((price.retailAmount / price.retailQty) * 100) / 100;
      priceSource = 'retail-amount-qty';
    } else if (price.unitPrice !== undefined && price.unitPrice > 0) {
      unitPrice = price.unitPrice;
      priceSource = 'unit-price';
    } else {
      withoutPrice += 1;
    }
    products.push({
      spu: product.spu,
      ...(product.name ? { name: product.name } : {}),
      ...(unitPrice === undefined ? {} : { price: unitPrice }),
      priceSource,
      ...(price.retailAmount === undefined ? {} : { retailAmount: price.retailAmount }),
      portrait: toMatchPortraitInput(picked.portrait),
      portraitPlatform: Object.keys(picked.portrait.platformLabels)[0],
      portraitMatch: picked.match,
    });
  }
  if (withoutPortrait > 0) {
    notes.push(`${withoutPortrait} 款商品在 ${selectedMonth} 无画像，未进入矩阵。`);
  }
  if (withoutPrice > 0) {
    notes.push(`${withoutPrice} 款商品缺成交单价，消费能力维度不参与评分，且不插补兜底价。`);
  }
  if (index.issues.length > 0) {
    notes.push(`归一化过程记录 ${index.issues.length} 条问题（详见索引 issues）。`);
  }
  notes.push(
    `零售额为商品级指标，无渠道级分解；错配优先级表示组合调整优先级，不代表该渠道实际销售额。`,
  );

  return {
    source: 'data',
    sourceLabel: `本地数据（${options.dataRoot}）`,
    selectedMonth,
    months,
    products,
    channels,
    notes,
  };
}
