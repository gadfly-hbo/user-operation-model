import type { PortraitLabel, PlatformId } from '../portrait/types.js';
import { BandResolver, DimensionRegistry, MappingTable } from '../portrait/registry.js';
import { parseCsvRows } from './csv.js';
import { parseFileNameEntity, parsePortraitEntityId } from './identity.js';
import { projectPortraitLabels, type ProjectContext } from './project.js';
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
  if (rows.length < 2) return emptyPortrait(options);

  const header = rows[0] ?? [];
  const shareColumn = header.findIndex((cell) => cell.trim().endsWith('-占比'));
  const tgiColumn = header.findIndex((cell) => cell.trim().endsWith('-tgi'));

  const identifier = shareColumn >= 0 ? header[shareColumn]!.trim() : '';
  const parsedIdentifier = parsePortraitEntityId(identifier);

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  for (const row of rows.slice(1)) {
    const dimension = row[0]?.trim();
    const label = row[1]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareColumn]);
    const tgi = parseTgi(row[tgiColumn]);
    if (share === undefined && tgi === undefined) continue;
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = share === undefined ? { share: 0, ...(tgi !== undefined ? { tgi } : {}) } : { share, ...(tgi !== undefined ? { tgi } : {}) };
  }

  return finalizePortrait('douyin', platformLabels, {
    ...options,
    entityId: options.entityId ?? parsedIdentifier?.entityId ?? '',
    month: options.month ?? parsedIdentifier?.month ?? '',
  }, ctx);
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
  const headerIndex = findHeaderRow(rows, ['标签类型']);
  const header = rows[headerIndex] ?? [];
  const dimensionIndex = header.findIndex((c) => c.trim() === '标签类型');
  // 标签列必须排除维度列本身：「标签类型」本身也包含「标签」二字
  const labelIndex = header.findIndex(
    (c, i) => i !== dimensionIndex && c.trim().includes('标签'),
  );
  const shareIndex = header.findIndex((c) => c.trim() === '占比');

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  for (const row of rows.slice(headerIndex + 1)) {
    const dimension = row[dimensionIndex]?.trim();
    const label = row[labelIndex]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareIndex]);
    if (share === undefined) continue;
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = { share };
  }

  const fromName = parseFileNameEntity(path);
  return finalizePortrait('tmall', platformLabels, {
    ...options,
    entityId: options.entityId ?? fromName?.entityId ?? '',
    month: options.month ?? fromName?.month ?? '',
  }, ctx);
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
  const headerIndex = findHeaderRow(rows, ['标签名']);
  const header = rows[headerIndex] ?? [];
  const dimensionIndex = header.findIndex((c) => c.trim() === '标签名');
  const labelIndex = header.findIndex((c) => c.trim() === '枚举值');
  const shareIndex = header.findIndex((c) => c.trim() === '占比');
  const tgiIndex = header.findIndex((c) => c.trim() === 'TGI');

  const platformLabels: Record<string, Record<string, PortraitLabel>> = {};
  for (const row of rows.slice(headerIndex + 1)) {
    const dimension = row[dimensionIndex]?.trim();
    const label = row[labelIndex]?.trim();
    if (!dimension || !label) continue;
    const share = parseShare(row[shareIndex]);
    const tgi = parseTgi(row[tgiIndex]);
    if (share === undefined && tgi === undefined) continue;
    platformLabels[dimension] ??= {};
    platformLabels[dimension]![label] = {
      share: share ?? 0,
      ...(tgi !== undefined ? { tgi } : {}),
    };
  }

  const fromName = parseFileNameEntity(path);
  return finalizePortrait('jd', platformLabels, {
    ...options,
    entityId: options.entityId ?? fromName?.entityId ?? '',
    month: options.month ?? fromName?.month ?? '',
  }, ctx);
}

function finalizePortrait(
  platform: PlatformId,
  platformLabels: Record<string, Record<string, PortraitLabel>>,
  options: NormalizeOptions,
  ctx: ProjectContext,
): NormalizedPortrait {
  const { projections, issues } = projectPortraitLabels(platform, platformLabels, ctx);
  return {
    entityType: options.entityType ?? 'channel',
    entityId: options.entityId ?? '',
    month: options.month ?? '',
    platformLabels: { [platform]: platformLabels },
    projections,
    issues,
  };
}

function emptyPortrait(options: NormalizeOptions): NormalizedPortrait {
  return {
    entityType: options.entityType ?? 'channel',
    entityId: options.entityId ?? '',
    month: options.month ?? '',
    platformLabels: {},
    projections: {},
    issues: [],
  };
}

export type { ChannelRecord, NormalizationIssue, NormalizedPortrait, ProductNormalizationResult, ChannelNormalizationResult };
