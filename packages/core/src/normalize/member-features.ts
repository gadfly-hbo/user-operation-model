import { TABLE_SPECS } from './catalog/tables.js';
import { readDataTable, requireText, resolveColumns, textCell } from './table.js';
import type { MemberFeatureEntry } from './types.js';

/**
 * 会员特征字典解析。
 *
 * 字段集按业务方案 §5.2：`特征层级, 特征分组, 特征字段, 特征值, 说明`。
 * `特征层级` 与 `特征分组` 可选——缺列时该维度不参与过滤，不报错。
 */
export async function parseMemberFeatureTable(path: string): Promise<MemberFeatureEntry[]> {
  const spec = TABLE_SPECS.memberFeatures!;
  const table = await readDataTable(path);
  const columns = resolveColumns(table, spec);
  const entries: MemberFeatureEntry[] = [];

  for (const row of table.rows) {
    const field = requireText(row, columns.get('特征字段'), spec.label, table.path);
    const value = requireText(row, columns.get('特征值'), spec.label, table.path);
    const level = textCell(row, columns.get('特征层级'));
    const segment = textCell(row, columns.get('特征分组'));
    const note = textCell(row, columns.get('说明'));
    entries.push({
      field,
      value,
      ...(level ? { level } : {}),
      ...(segment ? { segment } : {}),
      ...(note ? { note } : {}),
    });
  }

  return entries;
}
