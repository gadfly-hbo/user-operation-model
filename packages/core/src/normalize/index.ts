import type { PortraitLabel, PlatformId } from '../portrait/types.js';
import { BandResolver, DimensionRegistry, MappingTable } from '../portrait/registry.js';
import { parseCsvRows } from './csv.js';
import { parseFileNameEntity, parsePortraitEntityId } from './identity.js';
import { projectPortraitLabels, type ProjectContext } from './project.js';
import { NormalizationError } from './types.js';
import type {
  ChannelNormalizationResult,
  ChannelRecord,
  NormalizationIssue,
  NormalizeOptions,
  NormalizedPortrait,
  ProductNormalizationResult,
} from './types.js';
import { findHeaderRow, readXlsxRows } from './xlsx.js';
import { parseShare, parseTgi } from './values.js';
import { normalizeChannelTable } from './channel.js';
import { normalizeProductTable } from './product.js';

export * from './types.js';
export { parseCsvRows, parseCsvText } from './csv.js';
export { parseMonthLabel, parsePortraitEntityId, parseFileNameEntity } from './identity.js';
export { parseShare, parseTgi, parseNumber } from './values.js';
export { projectPortraitLabels, type ProjectContext } from './project.js';
export { normalizeProductTable } from './product.js';
export { normalizeChannelTable } from './channel.js';

/** 默认投影上下文。目录数据即配置，进程内共享。 */
export function defaultProjectContext(): ProjectContext {
  return {
    registry: new DimensionRegistry(),
    mappings: new MappingTable(),
    bands: new BandResolver(),
  };
}

/**
 * 抖音画像归一化。
 *
 * CSV 结构：`标签类型, 标签, <起止年月+实体名>-占比, <起止年月+实体名>-tgi`
 */
export function normalizeDouyinPortrait(
  path: string,
  options: NormalizeOptions = {},
  ctx: ProjectContext = defaultProjectContext(),
): NormalizedPortrait {
  const rows = parseCsvRows(path);
  if (rows.length === 0) {
    throw new NormalizationError('parse-error', '抖音画像文件为空或无法解析', path);
  }
  if (rows.length < 2) {
    throw new NormalizationError('parse-error', '抖音画像文件只有表头，没有数据行', path);
  }

  const header = rows[0] ?? [];
  const shareColumn = header.findIndex((cell) => cell.trim().endsWith('-占比'));
  const tgiColumn = header.findIndex((cell) => cell.trim().endsWith('-tgi'));
  if (shareColumn === -1) {
    throw new NormalizationError('missing-field', '抖音画像缺少「…-占比」列', path);
  }

  const identifier = shareColumn >= 0 ? header[shareColumn]!.trim() : '';
  const parsedIdentifier = parsePortraitEntityId(identifier);

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  let unparsable = 0;
  for (const row of rows.slice(1)) {
    const dimension = row[0]?.trim();
    const label = row[1]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareColumn]);
    const tgi = parseTgi(row[tgiColumn]);
    // 占比是必填项：占比不可解析即视为该行不可用，
    // 不因 TGI 正常就伪造 share=0。
    if (share === undefined) {
      unparsable += 1;
      continue;
    }
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = { share, ...(tgi !== undefined ? { tgi } : {}) };
  }

  if (Object.keys(platformLabels).length === 0) {
    throw new NormalizationError(
      'parse-error',
      `抖音画像的占比列无法解析出任何数值（共 ${rows.length - 1} 行数据）`,
      path,
    );
  }

  const issues: NormalizationIssue[] = [];
  if (unparsable > 0) {
    issues.push({
      kind: 'parse-error',
      platform: 'douyin',
      severity: 'error',
      message: `有 ${unparsable} 行的占比与 TGI 均无法解析为数值，已跳过`,
    });
  }

  return finalizePortrait('douyin', platformLabels, {
    ...options,
    entityId: options.entityId ?? parsedIdentifier?.entityId ?? '',
    month: options.month ?? parsedIdentifier?.month ?? '',
  }, ctx, issues);
}

/**
 * 天猫画像归一化。
 *
 * XLSX 结构：`标签类型 | 一级标签(标签值) | 占比`，**无 TGI**。
 */
export async function normalizeTmallPortrait(
  path: string,
  options: NormalizeOptions = {},
  ctx: ProjectContext = defaultProjectContext(),
): Promise<NormalizedPortrait> {
  const rows = await readXlsxRows(path, '明细');
  if (rows.length === 0) {
    throw new NormalizationError('parse-error', '天猫画像文件为空、sheet「明细」不存在或无数据行', path);
  }
  const headerIndex = findHeaderRow(rows, ['标签类型']);
  if (headerIndex === -1) {
    throw new NormalizationError('missing-field', '天猫画像缺少「标签类型」列', path);
  }
  const header = rows[headerIndex] ?? [];
  const dimensionIndex = header.findIndex((c) => c.trim() === '标签类型');
  // 标签列必须排除维度列本身：「标签类型」本身也包含「标签」二字
  const labelIndex = header.findIndex(
    (c, i) => i !== dimensionIndex && c.trim().includes('标签'),
  );
  const shareIndex = header.findIndex((c) => c.trim() === '占比');
  if (dimensionIndex === -1 || labelIndex === -1 || shareIndex === -1) {
    throw new NormalizationError(
      'missing-field',
      `天猫画像缺少必要列（维度列=${dimensionIndex} 标签列=${labelIndex} 占比列=${shareIndex}）`,
      path,
    );
  }

  if (headerIndex >= rows.length - 1) {
    throw new NormalizationError('parse-error', '天猫画像只有表头，没有数据行', path);
  }

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  let unparsable = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const dimension = row[dimensionIndex]?.trim();
    const label = row[labelIndex]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareIndex]);
    if (share === undefined) {
      unparsable += 1;
      continue;
    }
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = { share };
  }

  if (Object.keys(platformLabels).length === 0) {
    throw new NormalizationError(
      'parse-error',
      `天猫画像的占比列无法解析出任何数值（共 ${rows.length - headerIndex - 1} 行数据）`,
      path,
    );
  }

  const issues: NormalizationIssue[] = [];
  if (unparsable > 0) {
    issues.push({
      kind: 'parse-error',
      platform: 'tmall',
      severity: 'error',
      message: `有 ${unparsable} 行的占比无法解析为数值，已跳过`,
    });
  }

  const fromName = parseFileNameEntity(path);
  return finalizePortrait('tmall', platformLabels, {
    ...options,
    entityId: options.entityId ?? fromName?.entityId ?? '',
    month: options.month ?? fromName?.month ?? '',
  }, ctx, issues);
}

/**
 * 京东画像归一化。
 *
 * XLSX 结构：`标签名 | 枚举值 | 占比 | TGI`，占比已是小数。
 */
export async function normalizeJdPortrait(
  path: string,
  options: NormalizeOptions = {},
  ctx: ProjectContext = defaultProjectContext(),
): Promise<NormalizedPortrait> {
  const rows = await readXlsxRows(path, 'Sheet0');
  if (rows.length === 0) {
    throw new NormalizationError('parse-error', '京东画像文件为空、sheet「Sheet0」不存在或无数据行', path);
  }
  const headerIndex = findHeaderRow(rows, ['标签名']);
  if (headerIndex === -1) {
    throw new NormalizationError('missing-field', '京东画像缺少「标签名」列', path);
  }
  const header = rows[headerIndex] ?? [];
  const dimensionIndex = header.findIndex((c) => c.trim() === '标签名');
  const labelIndex = header.findIndex((c) => c.trim() === '枚举值');
  const shareIndex = header.findIndex((c) => c.trim() === '占比');
  const tgiIndex = header.findIndex((c) => c.trim() === 'TGI');
  if (dimensionIndex === -1 || labelIndex === -1 || shareIndex === -1) {
    throw new NormalizationError(
      'missing-field',
      `京东画像缺少必要列（维度列=${dimensionIndex} 枚举列=${labelIndex} 占比列=${shareIndex}）`,
      path,
    );
  }

  if (headerIndex >= rows.length - 1) {
    throw new NormalizationError('parse-error', '京东画像只有表头，没有数据行', path);
  }

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  let unparsable = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const dimension = row[dimensionIndex]?.trim();
    const label = row[labelIndex]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareIndex]);
    const tgi = parseTgi(row[tgiIndex]);
    // 占比是必填项：占比不可解析即视为该行不可用，
    // 不因 TGI 正常就伪造 share=0。
    if (share === undefined) {
      unparsable += 1;
      continue;
    }
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = { share, ...(tgi !== undefined ? { tgi } : {}) };
  }

  if (Object.keys(platformLabels).length === 0) {
    throw new NormalizationError(
      'parse-error',
      `京东画像的占比列无法解析出任何数值（共 ${rows.length - headerIndex - 1} 行数据）`,
      path,
    );
  }

  const issues: NormalizationIssue[] = [];
  if (unparsable > 0) {
    issues.push({
      kind: 'parse-error',
      platform: 'jd',
      severity: 'error',
      message: `有 ${unparsable} 行的占比与 TGI 均无法解析为数值，已跳过`,
    });
  }

  const fromName = parseFileNameEntity(path);
  return finalizePortrait('jd', platformLabels, {
    ...options,
    entityId: options.entityId ?? fromName?.entityId ?? '',
    month: options.month ?? fromName?.month ?? '',
  }, ctx, issues);
}

function finalizePortrait(
  platform: PlatformId,
  platformLabels: Record<string, Record<string, PortraitLabel>>,
  options: NormalizeOptions,
  ctx: ProjectContext,
  extraIssues: NormalizationIssue[] = [],
): NormalizedPortrait {
  const { projections, issues } = projectPortraitLabels(platform, platformLabels, ctx);
  return {
    entityType: options.entityType ?? 'channel',
    entityId: options.entityId ?? '',
    month: options.month ?? '',
    platformLabels: { [platform]: platformLabels },
    projections,
    issues: [...extraIssues, ...issues],
  };
}

export type { ChannelRecord, NormalizationIssue, NormalizedPortrait, ProductNormalizationResult, ChannelNormalizationResult };
