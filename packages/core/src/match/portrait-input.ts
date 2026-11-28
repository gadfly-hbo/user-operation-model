import type { MatchPortraitInput } from './types.js';
import type { NormalizedPortrait } from '../normalize/types.js';
import { parsePeriod } from '../period/parse.js';

/**
 * 归一化画像 → 匹配内核输入（切片 A · SA-05 起 core 单一来源）。
 *
 * 工具1 的两条数据路径（`data/` 正式路径、抖音参考数据只读路径）都经由本转换，
 * 不再各自维护第二份字段映射。窗口识别走 `parsePeriod` 的期间类型
 * （复核建议 6：区间与年份画像都是近似窗口，不再用 `includes('~')` 字符串启发式）。
 */
export function toMatchPortraitInput(portrait: NormalizedPortrait): MatchPortraitInput {
  const dimensions: MatchPortraitInput['dimensions'] = {};
  for (const [dimension, projection] of Object.entries(portrait.projections)) {
    dimensions[dimension] = Object.fromEntries(
      Object.entries(projection.labels).map(([label, value]) => [label, { share: value.share }]),
    );
  }
  const kind = parsePeriod(portrait.month).kind;
  const window = kind === 'window' || kind === 'year' ? portrait.month : undefined;
  return {
    dimensions,
    month: portrait.month,
    ...(window ? { window } : {}),
    ...(Object.keys(portrait.platformLabels)[0]
      ? { platform: Object.keys(portrait.platformLabels)[0] }
      : {}),
  };
}
