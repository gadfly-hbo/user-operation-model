import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeDouyinPortrait,
  parseCsvRows,
  resolveRetailAmount,
  resolveUnitPrice,
  selectPortrait,
  toMatchPortraitInput,
  type ProductDossier,
} from '@uom/core';
import type { MatchDataset } from './types.js';
import { validateMonthOption } from './data-root.js';

/**
 * 抖音参考数据的**只读**适配器。
 *
 * 规则：
 * - 只读：不复制、不改名、不改写参考目录里的任何文件
 * - 渠道实体：`<类型>:<目录名>`，同名店铺跨渠道类型不冲突
 * - 月份来自文件名（`成交YYMM`、`YY年M月`、`YYYY-MM`），解析不出来就记问题并跳过
 * - 单品画像没有月份，按静态事实画像使用（内核会标记 `monthUnknown`）
 */

export interface ReferenceDatasetOptions {
  /** 参考数据根目录。 */
  root: string;
  /** 计算所用自然月；缺省取渠道画像覆盖的最新月份。 */
  month?: string;
}

/** 渠道类型目录 → 类型名。 */
const CHANNEL_DIRS: { dir: string; type: string; label: string }[] = [
  { dir: '直播', type: 'live', label: '抖音直播' },
  { dir: '商品卡', type: 'card', label: '抖音商品卡' },
  { dir: '短视频', type: 'short', label: '抖音短视频' },
];

/** 从文件名解析月份。支持 `成交YYMM`、`YY年M月`、`YYYY-MM`。 */
export function parseReferenceMonth(fileName: string): string | undefined {
  const byDeal = /成交(\d{2})(\d{2})/.exec(fileName);
  if (byDeal) {
    const year = 2000 + Number(byDeal[1]);
    const month = Number(byDeal[2]);
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, '0')}`;
  }
  const byChinese = /(\d{2})年(\d{1,2})月/.exec(fileName);
  if (byChinese) {
    const year = 2000 + Number(byChinese[1]);
    const month = Number(byChinese[2]);
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, '0')}`;
  }
  const byIso = /(\d{4})-(\d{2})/.exec(fileName);
  if (byIso) {
    const month = Number(byIso[2]);
    if (month >= 1 && month <= 12) return `${byIso[1]}-${byIso[2]}`;
  }
  return undefined;
}

interface ReferenceChannelFile {
  entityDir: string;
  type: string;
  typeLabel: string;
  file: string;
  month: string;
}

function listChannelFiles(root: string): { files: ReferenceChannelFile[]; skipped: string[] } {
  const files: ReferenceChannelFile[] = [];
  const skipped: string[] = [];
  for (const { dir, type, label } of CHANNEL_DIRS) {
    const dirPath = join(root, dir);
    if (!existsSync(dirPath)) continue;
    for (const entity of readdirSync(dirPath)) {
      const entityPath = join(dirPath, entity);
      if (!statSync(entityPath).isDirectory()) continue;
      const entityFiles = readdirSync(entityPath).filter((name) => name.toLowerCase().endsWith('.csv'));
      for (const name of entityFiles) {
        const month = parseReferenceMonth(name);
        if (!month) {
          skipped.push(`${dir}/${entity}/${name}`);
          continue;
        }
        files.push({ entityDir: entity, type, typeLabel: label, file: join(entityPath, name), month });
      }
    }
  }
  return { files, skipped };
}

/** 商品经营指标表的一行。 */
interface ProductMetrics {
  name?: string;
  retailAmount?: number;
  retailQty?: number;
  unitPrice?: number;
}

function readProductMetrics(root: string): Map<string, ProductMetrics> {
  const metrics = new Map<string, ProductMetrics>();
  const tablePath = join(root, 'TOP20商品', '商品数据表.csv');
  if (!existsSync(tablePath)) return metrics;
  const rows = parseCsvRows(tablePath);
  if (rows.length === 0) return metrics;
  const header = rows[0]!.map((cell) => cell.trim());
  const index = (name: string): number => header.indexOf(name);
  const cell = (row: string[], name: string): string | undefined => {
    const at = index(name);
    return at >= 0 ? row[at]?.trim() : undefined;
  };
  const number = (value: string | undefined): number | undefined => {
    if (value === undefined || value === '') return undefined;
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  for (const row of rows.slice(1)) {
    const spu = cell(row, '款号');
    if (!spu) continue;
    metrics.set(spu, {
      name: cell(row, '商品名称') || undefined,
      retailAmount: number(cell(row, '零售额')),
      retailQty: number(cell(row, '零售量')),
      unitPrice: number(cell(row, '件单价')),
    });
  }
  return metrics;
}

/** 构建参考数据集。 */
export function buildReferenceDataset(options: ReferenceDatasetOptions): MatchDataset {
  validateMonthOption(options.month);
  const root = options.root;
  if (!existsSync(root)) {
    throw new Error(`参考数据根目录不存在：${root}`);
  }

  const { files, skipped } = listChannelFiles(root);
  const months = [...new Set(files.map((file) => file.month))].sort();
  if (months.length === 0) {
    throw new Error(`参考数据中没有可解析月份的渠道画像：${root}`);
  }
  const selectedMonth = options.month ?? months[months.length - 1]!;

  const metrics = readProductMetrics(root);
  const notes: string[] = [];
  if (skipped.length > 0) {
    notes.push(`${skipped.length} 个渠道画像文件无法解析月份，已跳过。`);
  }

  // 渠道：只保留所选月有画像的实体
  const channels = [];
  const byEntity = new Map<string, ReferenceChannelFile[]>();
  for (const file of files) {
    const key = `${file.type}:${file.entityDir}`;
    byEntity.set(key, [...(byEntity.get(key) ?? []), file]);
  }
  const missingChannels: string[] = [];
  for (const [key, entityFiles] of byEntity) {
    const candidates = entityFiles.filter((file) => file.month === selectedMonth);
    if (candidates.length === 0) {
      missingChannels.push(key);
      continue;
    }
    const chosen = candidates.sort((left, right) => left.file.localeCompare(right.file))[0]!;
    const portrait = normalizeDouyinPortrait(chosen.file, {
      entityType: 'channel',
      entityId: key,
      month: selectedMonth,
    });
    // 画像与所选月的匹配方式统一走 core 的 selectPortrait（切片 A · SA-03）
    const selection = selectPortrait(
      { portraits: [portrait] },
      { entityType: 'channel', entityIds: [key], month: selectedMonth },
    );
    channels.push({
      id: key,
      name: chosen.entityDir,
      type: chosen.typeLabel,
      portrait: toMatchPortraitInput(portrait),
      portraitPlatform: 'douyin',
      portraitMatch: selection.status === 'found' ? selection.match : ('exact' as const),
    });
  }
  if (missingChannels.length > 0) {
    const listed = missingChannels.slice(0, 10).join('、');
    notes.push(
      `${missingChannels.length} 个渠道实体在 ${selectedMonth} 无画像，未进入矩阵：${listed}${missingChannels.length > 10 ? ' 等' : ''}`,
    );
  }

  // 商品：有单品画像的款号
  const portraitDir = join(root, 'TOP20商品', '商品单款人群画像数据');
  const products = [];
  let withoutPrice = 0;
  if (existsSync(portraitDir)) {
    for (const name of readdirSync(portraitDir).filter((file) => file.toLowerCase().endsWith('.csv'))) {
      const spu = name.replace(/画像数据\.csv$/i, '').trim();
      if (!spu) continue;
      const portrait = normalizeDouyinPortrait(join(portraitDir, name), {
        entityType: 'product',
        entityId: spu,
        month: '',
      });
      const row = metrics.get(spu);
      // 单价与零售额统一走 core 的单一来源（切片 A · SA-08）：
      // 参考数据的零售额／零售量放在所选月的指标层，件单价视为主数据 unitPrice。
      // 只组解析所需的最小输入（Pick<ProductDossier,'price'|'performance'>），不伪造档案
      const priceInput: Pick<ProductDossier, 'price' | 'performance'> = {
        ...(row
          ? {
              performance: {
                [selectedMonth]: {
                  ...(row.retailAmount !== undefined ? { retailAmount: row.retailAmount } : {}),
                  ...(row.retailQty !== undefined ? { retailQty: row.retailQty } : {}),
                },
              },
            }
          : {}),
        price: {
          ...(row?.unitPrice !== undefined ? { unitPrice: row.unitPrice } : {}),
          ...(row?.retailAmount !== undefined ? { retailAmount: row.retailAmount } : {}),
        },
      };
      const resolvedPrice = resolveUnitPrice(priceInput, selectedMonth);
      const price = resolvedPrice.source === 'missing' ? undefined : resolvedPrice.price;
      const priceSource = resolvedPrice.source;
      if (resolvedPrice.source === 'missing') withoutPrice += 1;
      const retailAmount = resolveRetailAmount(priceInput, selectedMonth);
      // 单品画像无月份：selectPortrait 按 unknown 层取用，不回退
      const selection = selectPortrait(
        { portraits: [portrait] },
        { entityType: 'product', entityIds: [spu], month: selectedMonth },
      );
      products.push({
        spu,
        name: row?.name ?? spu,
        ...(price === undefined ? {} : { price }),
        priceSource,
        ...(retailAmount === undefined ? {} : { retailAmount }),
        portrait: toMatchPortraitInput(portrait),
        portraitPlatform: 'douyin',
        portraitMatch: selection.status === 'found' ? selection.match : ('unknown' as const),
      });
    }
  }
  if (withoutPrice > 0) {
    notes.push(`${withoutPrice} 款商品缺零售额与件单价，价格缺失：消费能力维度不参与评分，且不插补兜底价。`);
  }
  notes.push(
    `单品画像源文件不含月份，按静态事实画像使用，界面标注「单品画像无月份」。`,
  );
  notes.push(
    `渠道画像按 ${selectedMonth} 选取；商品侧零售额为商品级指标，无渠道级分解。`,
  );

  return {
    source: 'reference',
    sourceLabel: '抖音参考数据（只读）',
    selectedMonth,
    months,
    products,
    channels,
    notes,
  };
}
