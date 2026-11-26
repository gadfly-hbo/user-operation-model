import type { FieldSpec } from '../product/types.js';
import { FieldCatalog } from '../product/fields.js';
import type { ProductDossier } from '../product/types.js';
import { NormalizationError } from './types.js';
import type { NormalizationIssue, ProductNormalizationResult } from './types.js';
import { readXlsxRows } from './xlsx.js';
import { parseNumber } from './values.js';

/**
 * 商品宽表归一化。
 *
 * - 字段落位由 `FieldCatalog` 的 `sources` 驱动，新增源列无需改代码
 * - SKU 级数据按款号去重到款号级
 * - 人工定位字段进入 `comparisonOnly`，**不进入 `predictionAttributes`**
 * - 未登记的列进入 `extra`，不丢数据
 */
export async function normalizeProductTable(
  path: string,
  catalog: FieldCatalog = new FieldCatalog(),
): Promise<ProductNormalizationResult> {
  const issues: NormalizationIssue[] = [];
  const rows = await readXlsxRows(path);
  if (rows.length === 0) {
    throw new NormalizationError('parse-error', '商品表为空、sheet 不存在或无法解析', path);
  }
  if (rows.length < 2) {
    throw new NormalizationError('parse-error', '商品表只有表头，没有数据行', path);
  }

  const header = rows[0]!.map((cell) => cell.trim());
  const columnFields = new Map<number, FieldSpec>();
  for (const [index, column] of header.entries()) {
    if (column === '') continue;
    const matches = catalog.findBySource(column);
    if (matches.length > 0) columnFields.set(index, matches[0]!);
  }

  const spuIndex = findIndexOfKey(columnFields, 'spu');
  if (spuIndex === undefined) {
    throw new NormalizationError('missing-field', '商品表缺少款号列，无法确定主键', path);
  }

  const seen = new Map<string, number>();
  const products: ProductDossier[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    const spu = row[spuIndex]?.trim();
    if (!spu) {
      issues.push({
        kind: 'missing-field',
        severity: 'error',
        sourceLabel: `第 ${rowIndex + 1} 行`,
        message: '该行款号为空，已跳过',
      });
      continue;
    }

    if (seen.has(spu)) {
      issues.push({
        kind: 'conflict',
        severity: 'warning',
        sourceLabel: spu,
        message: `款号 ${spu} 在源表出现多行（SKU 级明细），已按款号去重保留首行`,
      });
      continue;
    }
    seen.set(spu, rowIndex);
    products.push(buildDossier(row, header, columnFields, catalog, spu));
  }

  return { products, issues };
}

function findIndexOfKey(columnFields: Map<number, FieldSpec>, key: string): number | undefined {
  for (const [index, field] of columnFields) {
    if (field.key === key) return index;
  }
  return undefined;
}

function buildDossier(
  row: string[],
  header: string[],
  columnFields: Map<number, FieldSpec>,
  catalog: FieldCatalog,
  spu: string,
): ProductDossier {
  const dossier: ProductDossier = { spu, schemaVersion: '0.1.0' };
  const attributes: Record<string, string[]> = {};
  const predictionAttributes: Record<string, string[]> = {};
  const comparisonOnly: Record<string, string[]> = {};
  const extra: Record<string, string> = {};

  for (const [index, column] of header.entries()) {
    if (column === '') continue;
    const raw = (row[index] ?? '').trim();
    if (raw === '') continue;

    const field = columnFields.get(index);
    if (!field) {
      extra[column] = raw;
      continue;
    }

    const value = field.type === 'number' ? String(parseNumber(raw) ?? raw) : raw;
    attributes[field.key] = [value];
    if (field.usage.includes('prediction')) predictionAttributes[field.key] = [value];
    else comparisonOnly[field.key] = [value];

    applyStructuredField(dossier, field.key, raw);
  }

  dossier.attributes = attributes;
  dossier.predictionAttributes = predictionAttributes;
  dossier.comparisonOnly = comparisonOnly;
  if (Object.keys(extra).length > 0) dossier.extra = extra;

  // 未登记字段不应进入预测可见集合
  for (const key of Object.keys(dossier.predictionAttributes ?? {})) {
    if (!catalog.has(key) || catalog.isExcludedFromPrediction(key)) {
      delete dossier.predictionAttributes[key];
    }
  }

  return dossier;
}

function applyStructuredField(dossier: ProductDossier, key: string, raw: string): void {
  switch (key) {
    case 'name':
      dossier.name = raw;
      break;
    case 'brand':
      dossier.brand = raw;
      break;
    case 'gender':
      dossier.gender = raw;
      break;
    case 'tag_price':
      dossier.price ??= {};
      dossier.price.tagPrice = parseNumber(raw);
      break;
    case 'overseas_tag_price':
      dossier.price ??= {};
      dossier.price.overseasTagPrice = parseNumber(raw);
      break;
    case 'retail_amount':
      dossier.price ??= {};
      dossier.price.retailAmount = parseNumber(raw);
      break;
    case 'retail_qty':
      dossier.price ??= {};
      dossier.price.retailQty = parseNumber(raw);
      break;
    case 'unit_price':
      dossier.price ??= {};
      dossier.price.unitPrice = parseNumber(raw);
      break;
    case 'retail_discount':
      dossier.price ??= {};
      dossier.price.discount = parseNumber(raw);
      break;
    case 'category_l1':
      dossier.category ??= {};
      dossier.category.l1 = raw;
      break;
    case 'category_l2':
      dossier.category ??= {};
      dossier.category.l2 = raw;
      break;
    case 'category_l3':
      dossier.category ??= {};
      dossier.category.l3 = raw;
      break;
    case 'category_l2_code':
      dossier.category ??= {};
      dossier.category.code = raw;
      break;
    case 'season':
      dossier.season = raw;
      break;
    case 'product_season':
      dossier.productSeason = raw;
      break;
    case 'launch_type':
      dossier.launchType = raw;
      break;
    case 'fabric':
      dossier.attributes ??= {};
      dossier.attributes.fabric = [raw];
      break;
    case 'silhouette':
      dossier.attributes ??= {};
      dossier.attributes.silhouette = [raw];
      break;
    case 'fab':
      dossier.fab = { feature: [raw] };
      break;
    default:
      break;
  }
}
