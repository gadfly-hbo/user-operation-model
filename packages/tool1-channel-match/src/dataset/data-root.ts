import {
  availableMonths,
  buildIndex,
  channelEntityIds,
  parsePeriod,
  periodMonths,
  PLATFORM_PREFERENCE,
  platformId,
  resolveRetailAmount,
  resolveUnitPrice,
  selectPortrait,
  toMatchPortraitInput,
  type DataIndex,
  type NormalizedPortrait,
  type PortraitMatchKind,
} from '@uom/core';
import type { MatchDataset } from './types.js';

/**
 * `data/` 正式路径的数据集适配。
 *
 * 复用归一化层与索引查询原语，不另建数据访问逻辑。
 * 画像选择统一走 core 的 `selectPortrait`（切片 A · SA-03／SA-05）；
 * 同月多平台按显式优先级（`PLATFORM_PREFERENCE`）取用，并在报告 notes 写明数量。
 */

export interface DataRootDatasetOptions {
  /** 数据根目录，默认 `data`。 */
  dataRoot: string;
  /** 计算所用自然月；缺省取渠道画像覆盖的最新具体月份。 */
  month?: string;
}

/** 索引里出现过的渠道画像月份（SA-09：来自 core 的 `availableMonths`，区间标签按字面保留）。 */
export function indexMonths(index: DataIndex): string[] {
  const ids = [
    ...new Set(
      index.portraits
        .filter((portrait) => portrait.entityType === 'channel')
        .map((portrait) => portrait.entityId),
    ),
  ];
  return availableMonths(index, 'channel', ids);
}

/** 把平台列表按显式优先级排序：抖音＞天猫＞京东，其余按名称序兜底。 */
function orderPlatformsByPreference(platforms: string[]): string[] {
  const preferred = PLATFORM_PREFERENCE.filter((id) =>
    platforms.some((platform) => platformId(platform) === id),
  );
  const rest = platforms
    .filter((platform) => !PLATFORM_PREFERENCE.includes(platformId(platform)))
    .sort();
  return [...preferred, ...rest];
}

interface MultiPlatformCounter {
  count: number;
}

/**
 * 批量取用一份画像（SA-03）：先用 `selectPortrait` 按 exact＞window＞year＞unknown
 * 选层；同层多平台歧义时按 `PLATFORM_PREFERENCE` 显式取用其一并计数。
 */
function pickByPreference(
  index: DataIndex,
  query: { entityType: string; entityIds: string[] },
  month: string,
  multiPlatform: MultiPlatformCounter,
): { portrait: NormalizedPortrait; match: PortraitMatchKind } | undefined {
  const selection = selectPortrait(index, { ...query, month });
  if (selection.status === 'found') return selection;
  if (selection.status !== 'ambiguous') return undefined;
  multiPlatform.count += 1;
  for (const platform of orderPlatformsByPreference(selection.platforms)) {
    const resolved = selectPortrait(index, { ...query, month, platform });
    if (resolved.status === 'found') return resolved;
  }
  return undefined;
}

/** 构建 `data/` 数据集。 */
export async function buildDataRootDataset(
  options: DataRootDatasetOptions,
): Promise<MatchDataset> {
  const index = await buildIndex({ dataRoot: options.dataRoot });
  const months = indexMonths(index);
  const notes: string[] = [];

  // 选择用的是具体自然月：区间／年份标签按字面保留在 months 里，
  // 展开成具体月份后取最新（与既有口径一致）
  const concreteMonths = [
    ...new Set(months.flatMap((label) => periodMonths(parsePeriod(label)))),
  ].sort();
  const selectedMonth =
    options.month ??
    (concreteMonths.length > 0
      ? concreteMonths[concreteMonths.length - 1]!
      : new Date().toISOString().slice(0, 7));
  if (months.length === 0) {
    notes.push('索引中没有可用的渠道画像月份，矩阵为空。');
  }

  const multiPlatform: MultiPlatformCounter = { count: 0 };

  // 渠道：店铺编码为 ID，店铺名为显示名
  const channels = [];
  let channelsWithoutPortrait = 0;
  for (const channel of index.channels) {
    const ids = channelEntityIds(index, channel.channelId);
    const picked = pickByPreference(index, { entityType: 'channel', entityIds: ids }, selectedMonth, multiPlatform);
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
    const picked = pickByPreference(
      index,
      { entityType: 'product', entityIds: [product.spu] },
      selectedMonth,
      multiPlatform,
    );
    if (!picked) {
      withoutPortrait += 1;
      continue;
    }
    // 单价与零售额统一走 core 的单一来源（SA-08）：该月指标优先，其次主数据，缺失不插补
    const resolvedPrice = resolveUnitPrice(product, selectedMonth);
    const unitPrice = resolvedPrice.source === 'missing' ? undefined : resolvedPrice.price;
    const priceSource = resolvedPrice.source;
    if (resolvedPrice.source === 'missing') withoutPrice += 1;
    const retailAmount = resolveRetailAmount(product, selectedMonth);
    products.push({
      spu: product.spu,
      ...(product.name ? { name: product.name } : {}),
      ...(unitPrice === undefined ? {} : { price: unitPrice }),
      priceSource,
      ...(retailAmount === undefined ? {} : { retailAmount }),
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
  if (multiPlatform.count > 0) {
    notes.push(
      `${multiPlatform.count} 个实体在 ${selectedMonth} 命中多平台画像，按显式优先级（抖音＞天猫＞京东，其余按名称序）取用其一。`,
    );
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

