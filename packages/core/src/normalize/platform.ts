import { sep } from 'node:path';

/**
 * 平台与实体类型识别。
 *
 * 放在归一化层，供索引构建与竞品画像解析共用，避免两处规则漂移。
 */

/** 判断画像文件属于哪个平台。 */
export function detectPlatform(path: string): 'douyin' | 'tmall' | 'jd' | undefined {
  const normalized = path.split(sep).join('/');
  // 文件名后缀优先于所在目录：同一目录下可混放多平台文件
  if (normalized.endsWith('_抖音.csv') || normalized.endsWith('_抖音.xlsx')) return 'douyin';
  if (normalized.endsWith('_天猫.csv') || normalized.endsWith('_天猫.xlsx')) return 'tmall';
  if (normalized.endsWith('_京东.csv') || normalized.endsWith('_京东.xlsx')) return 'jd';
  if (/\/douyin\//.test(normalized)) return 'douyin';
  if (/\/tmall\//.test(normalized)) return 'tmall';
  if (/\/jd\//.test(normalized)) return 'jd';
  return undefined;
}

/**
 * 画像实体的类型。
 *
 * - 带「款号」的是商品
 * - 带「品牌」且带「画像」的是品牌
 * - 其余是渠道／门店
 *
 * 探测表的品牌判定与此保持一致，避免「探测说就绪但索引里没有 brand 实体」。
 */
export function detectEntityType(path: string): 'product' | 'channel' | 'brand' {
  const name = path.split(sep).pop() ?? '';
  if (/款号/.test(name)) return 'product';
  if (/品牌/.test(name) && /画像/.test(name)) return 'brand';
  return 'channel';
}
