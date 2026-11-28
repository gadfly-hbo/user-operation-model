import { TABLE_SPECS } from './catalog/tables.js';
import {
  numberCell,
  readDataTable,
  requireText,
  resolveColumns,
  textCell,
} from './table.js';
import { NormalizationError } from './types.js';
import type {
  AggregateGroupEntry,
  EntityAliasEntry,
  PortraitConflictEntry,
  ProductChannelEntry,
} from './types.js';

/**
 * 关联与映射类表：商品↔渠道、聚合口径、实体别名、画像冲突映射。
 *
 * 这些表只提供**关联关系**，不做画像内容合并（见工程规范 §7「别名不隐式合并」）。
 */

/** 商品 ↔ 渠道归属与成交表解析。 */
export async function parseProductChannelTable(path: string): Promise<ProductChannelEntry[]> {
  const spec = TABLE_SPECS.productChannel!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: ProductChannelEntry[] = [];

  for (const row of table.rows) {
    const spu = requireText(row, columns.get('款号'), spec.label, table.path);
    const channelId = requireText(row, columns.get('店铺编码'), spec.label, table.path);
    const month = textCell(row, columns.get('月份'));
    const retailAmount = numberCell(
      row,
      columns.get('零售额'),
      `${spec.label}的「零售额」`,
      table.path,
    );
    const retailQty = numberCell(
      row,
      columns.get('零售量'),
      `${spec.label}的「零售量」`,
      table.path,
    );
    entries.push({
      spu,
      channelId,
      ...(month ? { month } : {}),
      ...(retailAmount !== undefined ? { retailAmount } : {}),
      ...(retailQty !== undefined ? { retailQty } : {}),
    });
  }

  return entries;
}

/** 聚合口径表解析（款号 → 系列／爆款组／IP）。 */
export async function parseAggregateGroupTable(path: string): Promise<AggregateGroupEntry[]> {
  const spec = TABLE_SPECS.aggregateGroups!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: AggregateGroupEntry[] = [];

  for (const row of table.rows) {
    const spu = requireText(row, columns.get('款号'), spec.label, table.path);
    const series = textCell(row, columns.get('系列'));
    const hot = textCell(row, columns.get('爆款组'));
    const ip = textCell(row, columns.get('IP'));
    entries.push({
      spu,
      ...(series ? { series } : {}),
      ...(hot ? { hot } : {}),
      ...(ip ? { ip } : {}),
    });
  }

  return entries;
}

/** 实体别名目录解析。 */
export async function parseEntityAliasTable(path: string): Promise<EntityAliasEntry[]> {
  const spec = TABLE_SPECS.entityAlias!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: EntityAliasEntry[] = [];

  for (const row of table.rows) {
    const canonical = requireText(row, columns.get('规范实体名'), spec.label, table.path);
    const alias = requireText(row, columns.get('别名'), spec.label, table.path);
    const channelId = textCell(row, columns.get('店铺编码'));
    const platform = textCell(row, columns.get('平台'));
    entries.push({
      canonical,
      alias,
      ...(channelId ? { channelId } : {}),
      ...(platform ? { platform } : {}),
    });
  }

  return entries;
}

/** 画像冲突显式映射表解析。 */
export async function parsePortraitConflictTable(path: string): Promise<PortraitConflictEntry[]> {
  const spec = TABLE_SPECS.portraitConflicts!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: PortraitConflictEntry[] = [];

  for (const row of table.rows) {
    const entity = requireText(row, columns.get('款号或实体'), spec.label, table.path);
    const month = textCell(row, columns.get('月份'));
    const platformA = requireText(row, columns.get('平台A'), spec.label, table.path);
    const platformB = requireText(row, columns.get('平台B'), spec.label, table.path);
    const rawResolution = requireText(row, columns.get('处置'), spec.label, table.path);
    const resolution = rawResolution.toLowerCase().replace(/[\s_]/g, '-');
    if (resolution !== 'keep-a' && resolution !== 'keep-b' && resolution !== 'manual') {
      throw new NormalizationError(
        'parse-error',
        `${spec.label}的处置无法识别：${rawResolution}（可用：keep-a／keep-b／manual）`,
        table.path,
      );
    }
    const note = textCell(row, columns.get('说明'));
    entries.push({
      entity,
      ...(month ? { month } : {}),
      platformA,
      platformB,
      resolution,
      ...(note ? { note } : {}),
    });
  }

  return entries;
}
