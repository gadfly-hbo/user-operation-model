/**
 * 样本包（work-package）读取 —— v0.4 固化数据的唯一入口。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/src/capabilities/product-channel-fit/single-product-portrait-calibration.ts`
 *   逻辑位置：`readJsonl`（第 196–203 行）、`parsePlatformPortraitCsv`（第 205–236 行）、
 *   `loadSingleProductPortraitSamplePackage`（第 238–251 行）。
 * - `/Users/huangbo/Dev/Archive/ModelEvol/src/capabilities/product-channel-fit/single-product-portrait-supervised.ts`
 *   逻辑位置：`loadSupervisedTrainingData`（第 590–651 行）—— 训练样本与逐维目标份额的构造。
 *
 * 移植时修掉的问题（工程规范 §8.1「移植时必须修掉」）：
 * 1. **CSV 解析无引号处理**：归档 `parsePlatformPortraitCsv` 用 `line.split(",")`，
 *    取值里出现逗号（带引号包裹）时会错列。本模块**统一走**本项目
 *    `packages/core/src/normalize/csv.ts` 的 `parseCsvRows`（正确处理引号转义、CRLF、BOM）。
 * 2. **JSONL 解析重复实现**：归档在多处重复写 `readJsonl`。本模块提供**唯一**最小实现。
 * 3. **绝对路径与 cwd 耦合**：本模块只接受调用方传入的目录，不含任何硬编码路径。
 *
 * 训练目标份额的**索引对齐语义**（忠实保留归档行为）：
 * 归档把某个 (维度, 标签) 的份额按「遍历样本的顺序」追加进数组；若某样本缺该标签，
 * 归档会在**数组末尾**补 0（而不是补在该样本的位置），导致后续样本的份额错位。
 * 这是归档的已知缺陷。本模块**照搬**该语义以保证忠实性，同时提供
 * `assertTargetAlignment` 做**数据完整性前置校验**：一旦某个 (维度, 标签) 不是
 * 每个样本都有，该数据集就不满足索引对齐前提，管线必须 fail-closed 而不是错位训练。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCsvRows } from '../normalize/csv.js';

/** 样本包里的商品记录（保留原始字段；人工字段是否进入下游由调用方决定）。 */
export interface SamplePackageProduct {
  skuId: string;
  sourceProductKey?: string;
  fitType?: string;
  fabric?: string;
  fab?: string;
  category?: string;
  subCategory?: string;
  season?: string;
  productLifecycle?: string;
  ipCollaboration?: string;
  specialFunctionOrMaterial?: string;
  [key: string]: unknown;
}

/** 样本包里的平台画像行。 */
export interface SamplePackagePortraitRow {
  skuId: string;
  sourceProductKey: string;
  labelType: string;
  label: string;
  share: number | null;
  tgi: number | null;
}

/** 一个样本包（商品 + 画像行）。 */
export interface SamplePackage {
  /** 包目录 */
  path: string;
  /** 商品记录（JSONL 顺序） */
  products: SamplePackageProduct[];
  /** 画像行（CSV 顺序） */
  portraitRows: SamplePackagePortraitRow[];
}

/** 逐维目标份额：维度 → 标签 → 逐样本份额数组。 */
export type TargetsByDimension = Map<string, Map<string, number[]>>;

/**
 * 最小 JSONL reader：去 BOM、逐行 `JSON.parse`、跳过空行。
 *
 * 归档在多处重复实现同一逻辑（`single-product-portrait-calibration.ts:196`、
 * `orchestrate.ts:71`），本模块收敛为唯一实现。
 */
export function readJsonl<T>(path: string): T[] {
  const content = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

/**
 * 解析 `platform_portrait.csv`。
 *
 * 列序：`skuId,sourceProductKey,labelType,label,share,tgi,source,sourceType,sourceBatchId,dataVersion,timeWindow,qualityFlags`。
 * 走本项目 `normalize/csv.ts`（正确处理引号），**修掉**归档 `line.split(",")` 的错列缺陷。
 */
export function parsePlatformPortraitCsv(path: string): SamplePackagePortraitRow[] {
  const rows = parseCsvRows(path);
  const dataRows = rows.slice(1);
  const result: SamplePackagePortraitRow[] = [];
  for (const fields of dataRows) {
    if (fields.length < 6) continue;
    const shareText = (fields[4] ?? '').trim();
    const tgiText = (fields[5] ?? '').trim();
    const share = shareText === '' || shareText === '-' ? null : Number(shareText);
    const tgi = tgiText === '' || tgiText === '-' ? null : Number(tgiText);
    result.push({
      skuId: (fields[0] ?? '').trim(),
      sourceProductKey: (fields[1] ?? '').trim(),
      labelType: (fields[2] ?? '').trim(),
      label: (fields[3] ?? '').trim(),
      share: Number.isFinite(share) ? share : null,
      tgi: Number.isFinite(tgi) ? tgi : null,
    });
  }
  return result;
}

/** 读取一个样本包目录（`product_attributes.jsonl` + `platform_portrait.csv`）。 */
export function loadSamplePackage(packagePath: string): SamplePackage {
  const products = readJsonl<SamplePackageProduct>(join(packagePath, 'product_attributes.jsonl'));
  const portraitRows = parsePlatformPortraitCsv(join(packagePath, 'platform_portrait.csv'));
  return { path: packagePath, products, portraitRows };
}

/**
 * 构造逐维目标份额（忠实移植归档 `loadSupervisedTrainingData` 的目标构造部分）。
 *
 * @param products 商品记录（顺序即样本顺序）
 * @param portraitRows 画像行
 * @param targetDimensions 参与建模的维度名白名单
 */
export function buildTargetsByDimension(
  products: readonly SamplePackageProduct[],
  portraitRows: readonly SamplePackagePortraitRow[],
  targetDimensions: readonly string[],
): TargetsByDimension {
  const targetsByDimension: TargetsByDimension = new Map();
  for (const product of products) {
    const rows = portraitRows.filter(
      (row) => row.skuId === product.skuId && row.sourceProductKey === product.sourceProductKey,
    );
    for (const row of rows) {
      if (!targetDimensions.includes(row.labelType)) continue;
      let dimMap = targetsByDimension.get(row.labelType);
      if (!dimMap) {
        dimMap = new Map<string, number[]>();
        targetsByDimension.set(row.labelType, dimMap);
      }
      let labelList = dimMap.get(row.label);
      if (!labelList) {
        labelList = [];
        dimMap.set(row.label, labelList);
      }
      labelList.push(row.share ?? 0);
    }
  }
  // 归档的补零语义：缺失的 (样本, 标签) 在**末尾**补 0（见文件头说明）。
  for (const [labelType, dimMap] of targetsByDimension) {
    const labels = [...dimMap.keys()];
    for (const product of products) {
      for (const label of labels) {
        const rows = portraitRows.filter(
          (row) =>
            row.skuId === product.skuId &&
            row.sourceProductKey === product.sourceProductKey &&
            row.labelType === labelType &&
            row.label === label,
        );
        if (rows.length === 0) {
          const list = dimMap.get(label);
          if (list) list.push(0);
        }
      }
    }
  }
  return targetsByDimension;
}

/**
 * 前置校验：每个 (维度, 标签) 的份额数组长度必须等于样本数。
 *
 * 长度不等意味着归档的「末尾补零」语义会错位（份额与样本对不上），
 * 此时训练结果不可信，必须 fail-closed。
 */
export function assertTargetAlignment(
  targetsByDimension: TargetsByDimension,
  sampleCount: number,
): void {
  for (const [labelType, dimMap] of targetsByDimension) {
    for (const [label, values] of dimMap) {
      if (values.length !== sampleCount) {
        throw new Error(
          `目标份额索引不对齐：维度「${labelType}」标签「${label}」有 ${values.length} 个取值，样本数 ${sampleCount}`,
        );
      }
    }
  }
}
