import { MATCH_CONFIG, scoreMatch } from '@uom/core';
import { DEMO_CHANNELS, DEMO_PRODUCTS, toPortraitInput } from './fixture.js';
import type { ReportInput } from '../report/types.js';

/**
 * 合成演示报告的构建。
 *
 * 数值由**真实匹配内核**在合成画像上算出，因此 Demo 与正式产物同源：
 * 同一套公式、同一套配置、同一个渲染器。
 */

/** 演示的计算月。 */
export const DEMO_MONTH = '2026-10';

/** 演示的固定生成时间，保证产物可复现。 */
export const DEMO_GENERATED_AT = '2026-11-27 00:00';

export function buildDemoReport(): ReportInput {
  const results = [];
  for (const product of DEMO_PRODUCTS) {
    for (const channel of DEMO_CHANNELS) {
      results.push(
        scoreMatch({
          spu: product.spu,
          channelId: channel.id,
          month: DEMO_MONTH,
          product: toPortraitInput(product.profile, product.month),
          channel: toPortraitInput(channel.profile, channel.month),
          ...(product.price === undefined
            ? {}
            : { price: product.price, priceSource: 'retail-amount-qty' as const }),
        }),
      );
    }
  }

  return {
    meta: {
      title: '工具 1 · 货渠匹配看板（合成演示）',
      source: '合成演示数据',
      isDemo: true,
      month: DEMO_MONTH,
      generatedAt: DEMO_GENERATED_AT,
      configVersion: MATCH_CONFIG.version,
      notes: [
        '本页全部为合成示意值，商品、渠道、人群占比与零售额均为虚构，不对应任何真实企业或款号。',
        '真实数据版本由工具在本机生成，只落在本地输出目录，不随站点发布。',
        '演示商品 H 缺价格：消费能力维度不参与评分，且不插补兜底价。',
        '演示线下店 A 的画像为区间口径（2025-07~2026-10），覆盖计算月，按近似口径标注。',
        '权重为初值，未经真实数据校准，按「已调整」记录，不得称「已优化」。',
      ],
    },
    products: DEMO_PRODUCTS.map((product) => ({
      spu: product.spu,
      name: product.name,
      retailAmount: product.retailAmount,
      ...(product.price === undefined ? {} : { price: product.price }),
    })),
    channels: DEMO_CHANNELS.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
    })),
    results,
  };
}
