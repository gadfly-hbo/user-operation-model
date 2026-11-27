import { basename } from 'node:path';

/** 文件名末尾常见的平台后缀，解析实体标识时剥离。 */
const PLATFORM_SUFFIXES = new Set([
  '抖音', '天猫', '京东', '小红书', '拼多多', '快手', '唯品会', '淘宝', '得物',
  '视频号', '微信', '线下', '实体店', '直播', '线下门店',
  'douyin', 'tmall', 'jd', 'xhs', 'pdd', 'ks', 'vip', 'taobao', 'offline',
]);

/**
 * 实体名末尾的噪声词。
 *
 * 平台画像的文件名常带「…画像数据」这类后缀（如
 * `2507-2606_演示账号1画像数据_天猫.xlsx`），解析出的实体名需要剥掉这些词，
 * 否则同一个实体在不同平台会得到不同的 entityId，无法关联。
 */
const ENTITY_NAME_NOISE = ['画像数据', '人群画像', '人群数据', '画像', '数据', '明细'];

/** 剥离实体名末尾的噪声词。 */
function stripEntityNoise(entityId: string): string {
  // 先去掉按 '_' 分段的平台后缀（如「…_天猫」），再剥末尾噪声词
  const segments = entityId.split('_').filter((part) => part !== '');
  const kept = segments.filter((part) => !PLATFORM_SUFFIXES.has(part.toLowerCase()));
  let result = (kept.length > 0 ? kept : segments).join('_');
  let changed = true;
  while (changed) {
    changed = false;
    for (const noise of ENTITY_NAME_NOISE) {
      if (result.endsWith(noise) && result.length > noise.length) {
        result = result.slice(0, -noise.length);
        changed = true;
      }
    }
  }
  return result;
}

/**
 * 月份与实体标识的解析。
 *
 * 支持的月份写法：
 * - `2026-10` → `2026-10`
 * - `2610` → `2026-10`
 * - `2507-2606` → `2025-07~2026-06`（区间）
 *
 * 无法识别时返回 null，**不猜测**。
 */
export function parseMonthLabel(label: string): string | null {
  const text = label.trim();
  if (text === '') return null;

  let match = /^(\d{4})-(\d{2})$/.exec(text);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
  }

  match = /^(\d{2})(\d{2})$/.exec(text);
  if (match) {
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    const year = 2000 + Number(match[1]);
    return `${year}-${match[2]}`;
  }

  match = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(text);
  if (match) {
    const startMonth = Number(match[2]);
    const endMonth = Number(match[4]);
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return null;
    const startYear = 2000 + Number(match[1]);
    const endYear = 2000 + Number(match[3]);
    return `${startYear}-${match[2]}~${endYear}-${match[4]}`;
  }

  return null;
}

/**
 * 从抖音画像列名或文件名中拆出实体标识与月份。
 *
 * - `2507-2606森马广州越秀区北京路店-占比` → 实体「森马广州越秀区北京路店」，月份区间
 * - `款号101526100201` → 实体「101526100201」
 * - `2024_森马工联大厦购物中心店_天猫` → 实体「森马工联大厦购物中心店」，年份 `2024`
 */
export function parsePortraitEntityId(raw: string): { entityId: string; month?: string } | null {
  const text = raw.trim();
  if (text === '') return null;

  const stripped = text.replace(/-(占比|tgi)$/, '');

  // 按优先级尝试月份前缀，区间写法必须先于短写法匹配
  const prefixPatterns = [
    /^(\d{4}-\d{2})/,
    /^(\d{4}-\d{2}-\d{2})/,
    /^(\d{2}\d{2}-\d{2}\d{2})/,
    /^(\d{2}\d{2})/,
    /^(\d{4})/,
  ];
  for (const pattern of prefixPatterns) {
    const match = pattern.exec(stripped);
    if (!match) continue;
    const month = parseMonthLabel(match[1]!);
    if (!month) continue;
    const rest = stripped.slice(match[1]!.length).replace(/^[_-]/, '');
    if (rest !== '') return { entityId: stripEntityNoise(rest), month };
    return { entityId: stripEntityNoise(stripped), month };
  }

  // 只按下划线切分，避免把「2507-2606」这类月份区间拆开
  const segments = stripped
    .split('_')
    .filter((s) => s !== '')
    .filter((s) => !PLATFORM_SUFFIXES.has(s.toLowerCase()));
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    if (segment.startsWith('款号') && segment.length > 2) {
      return { entityId: segment.slice(2) };
    }
    if (segment === '款号' && segments[i + 1]) {
      return { entityId: segments[i + 1]! };
    }
    // 文件名中的月份段，如「透视分析_2507-2606_门店名_京东」
    const month = parseMonthLabel(segment);
    if (month && segments[i + 1]) {
      return { entityId: stripEntityNoise(segments[i + 1]!), month };
    }
    // 4 位年份段，如「2024_门店名_天猫」
    if (/^\d{4}$/.test(segment) && segments[i + 1]) {
      return { entityId: stripEntityNoise(segments[i + 1]!), month: `${segment}-01` };
    }
  }

  if (segments.length === 1) return { entityId: stripEntityNoise(segments[0]!) };
  return null;
}

/** 从文件名（不含扩展名）拆出实体标识与月份。 */
export function parseFileNameEntity(filePath: string): { entityId: string; month?: string } | null {
  const name = basename(filePath).replace(/\.[^.]+$/, '');
  return parsePortraitEntityId(name);
}
