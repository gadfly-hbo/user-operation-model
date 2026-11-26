import type { BandRule } from '../types.js';

/**
 * 年龄段归并规则。
 *
 * 统一目标档：`18-23 / 24-30 / 31-40 / 41-50 / 50+`
 *
 * 这是**数据**不是逻辑：新增平台或调整档位边界只需在此追加或修改条目。
 *
 * 已知的跨平台边界冲突：**50 岁**在抖音与京东归入 41-50、在天猫归入 50+，
 * 两者不可调和。凡受此影响的源档位一律标 partial 并在 note 写明，
 * 不做人为统一，也不做静默取一。
 *
 * 另一类损失方向相反：**下界以下**（如京东 16~20 岁中的 16-17 岁）
 * 在统一词表中没有落点，因此这类规则没有 spill，只标 partial 并写明缺口。
 */
export const AGE_BAND_RULES: BandRule[] = [
  // ── 抖音：10 档，边界与统一档位基本对齐 ────────────────────
  { platform: 'douyin', sourceBand: '18-19', targetBand: '18-23', precision: 'exact' },
  { platform: 'douyin', sourceBand: '20-23', targetBand: '18-23', precision: 'exact' },
  { platform: 'douyin', sourceBand: '24-30', targetBand: '24-30', precision: 'exact' },
  { platform: 'douyin', sourceBand: '31-35', targetBand: '31-40', precision: 'exact' },
  { platform: 'douyin', sourceBand: '36-40', targetBand: '31-40', precision: 'exact' },
  { platform: 'douyin', sourceBand: '41-45', targetBand: '41-50', precision: 'exact' },
  {
    platform: 'douyin',
    sourceBand: '46-50',
    targetBand: '41-50',
    precision: 'partial',
    note: '50 岁在抖音计入 41-50，在天猫计入 50+，跨平台口径冲突',
  },
  { platform: 'douyin', sourceBand: '51-55', targetBand: '50+', precision: 'exact' },
  { platform: 'douyin', sourceBand: '56-59', targetBand: '50+', precision: 'exact' },
  { platform: 'douyin', sourceBand: '60+', targetBand: '50+', precision: 'exact' },

  // ── 天猫：9 档，闭区间跨目标边界 ────────────────────────────
  {
    platform: 'tmall',
    sourceBand: '[18,24]',
    targetBand: '18-23',
    precision: 'partial',
    spill: '24-30',
    note: '闭区间上界 24 落入 24-30',
  },
  { platform: 'tmall', sourceBand: '[25,29]', targetBand: '24-30', precision: 'exact' },
  {
    platform: 'tmall',
    sourceBand: '[30,34]',
    targetBand: '31-40',
    precision: 'partial',
    spill: '24-30',
    note: '闭区间下界 30 落入 24-30',
  },
  { platform: 'tmall', sourceBand: '[35,39]', targetBand: '31-40', precision: 'exact' },
  {
    platform: 'tmall',
    sourceBand: '[40,44]',
    targetBand: '41-50',
    precision: 'partial',
    spill: '31-40',
    note: '闭区间下界 40 落入 31-40',
  },
  { platform: 'tmall', sourceBand: '[45,49]', targetBand: '41-50', precision: 'exact' },
  {
    platform: 'tmall',
    sourceBand: '[50,54]',
    targetBand: '50+',
    precision: 'partial',
    spill: '41-50',
    note: '闭区间下界 50 与抖音口径冲突（抖音计入 41-50）',
  },
  { platform: 'tmall', sourceBand: '[55,59]', targetBand: '50+', precision: 'exact' },
  { platform: 'tmall', sourceBand: '>=60', targetBand: '50+', precision: 'exact' },

  // ── 京东：13 档，起始段与成人体系不对齐 ────────────────────
  {
    platform: 'jd',
    sourceBand: '0~15岁',
    targetBand: null,
    precision: 'unmapped',
    note: '童装口径，与成人服饰人群无对应；不并入任何目标档',
  },
  {
    platform: 'jd',
    sourceBand: '16~20岁',
    targetBand: '18-23',
    precision: 'partial',
    note: '闭区间下界 16-17 岁低于统一档位下界，在统一词表中无落点；上界 20 岁落在 18-23',
  },
  {
    platform: 'jd',
    sourceBand: '21~25岁',
    targetBand: '18-23',
    precision: 'partial',
    spill: '24-30',
    note: '闭区间上界 25 落入 24-30',
  },
  { platform: 'jd', sourceBand: '26~30岁', targetBand: '24-30', precision: 'exact' },
  { platform: 'jd', sourceBand: '31~35岁', targetBand: '31-40', precision: 'exact' },
  { platform: 'jd', sourceBand: '36~40岁', targetBand: '31-40', precision: 'exact' },
  { platform: 'jd', sourceBand: '41~45岁', targetBand: '41-50', precision: 'exact' },
  {
    platform: 'jd',
    sourceBand: '46~50岁',
    targetBand: '41-50',
    precision: 'partial',
    note: '50 岁在京东计入 41-50，在天猫计入 50+，跨平台口径冲突',
  },
  { platform: 'jd', sourceBand: '51~55岁', targetBand: '50+', precision: 'exact' },
  { platform: 'jd', sourceBand: '56~60岁', targetBand: '50+', precision: 'exact' },
  { platform: 'jd', sourceBand: '61~65岁', targetBand: '50+', precision: 'exact' },
  { platform: 'jd', sourceBand: '66~70岁', targetBand: '50+', precision: 'exact' },
  { platform: 'jd', sourceBand: '71岁及以上', targetBand: '50+', precision: 'exact' },
];

/** 统一年龄档位词表，与 dimensions 目录中的 age 维度保持一致。 */
export const UNIFIED_AGE_BANDS = ['18-23', '24-30', '31-40', '41-50', '50+'];
