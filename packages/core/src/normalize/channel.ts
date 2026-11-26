import type { ChannelNormalizationResult, ChannelRecord, NormalizationIssue } from './types.js';
import { readXlsxRows } from './xlsx.js';

/** 渠道宽表的列名到字段的对应。 */
const COLUMN_MAP: Record<string, keyof ChannelRecord> = {
  店铺编码: 'channelId',
  店铺: 'name',
  渠道品牌: 'brand',
  平台: 'platform',
  渠道类型: 'channelType',
  渠道等级: 'channelGrade',
  一级渠道: 'firstChannel',
  二级渠道: 'secondChannel',
  省份: 'province',
  城市: 'city',
  城市级别: 'cityTier',
  门店状态: 'storeStatus',
  开店时间: 'openDate',
  关店时间: 'closeDate',
};

/**
 * 渠道宽表归一化。
 *
 * 未在对应表中的列进入 `attributes`，不丢数据。
 */
export async function normalizeChannelTable(path: string): Promise<ChannelNormalizationResult> {
  const issues: NormalizationIssue[] = [];
  const rows = await readXlsxRows(path);
  if (rows.length < 2) return { channels: [], issues };

  const header = rows[0]!.map((cell) => cell.trim());
  const channelIdIndex = header.findIndex((column) => column === '店铺编码');
  if (channelIdIndex === -1) {
    issues.push({
      kind: 'missing-field',
      severity: 'error',
      message: '渠道表缺少店铺编码列，无法确定主键',
    });
    return { channels: [], issues };
  }

  const channels: ChannelRecord[] = [];
  for (const row of rows.slice(1)) {
    const channelId = row[channelIdIndex]?.trim();
    if (!channelId) continue;

    const record: ChannelRecord = { channelId };
    const attributes: Record<string, string> = {};

    header.forEach((column, index) => {
      if (column === '') return;
      const raw = (row[index] ?? '').trim();
      if (raw === '') return;

      const target = COLUMN_MAP[column];
      if (target) {
        (record[target] as string) = raw;
      } else {
        attributes[column] = raw;
      }
    });

    if (Object.keys(attributes).length > 0) record.attributes = attributes;
    channels.push(record);
  }

  return { channels, issues };
}
