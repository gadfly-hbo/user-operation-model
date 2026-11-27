/**
 * 阶段 01：把冻结的 intake 解析成实验数据集（fail-closed）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/01-prepare-dataset.mts`
 *   逻辑位置：文件数断言（第 27–28 行）、SKU 交叉核对（第 31–40 行）、
 *   六维完整性断言（第 48–51 行）、按 sku 排序（第 72 行）、数据清单（第 78–105 行）。
 * - `.../scripts/lib/core.mts`：`listPositivePortraitFiles`（第 302–306 行）、
 *   `readProductInfo`（第 85–101 行）、`sha256`（第 49–51 行）。
 *
 * ## 与归档的差异
 *
 * 1. **画像解析换同名求和版**：归档用 `lib/core.mts` 的覆盖式解析（丢份额），
 *    本移植改用 `packages/core/src/model/portrait-md.ts`（v0.7 同名求和语义）。
 * 2. **XLSX 解析换 exceljs**：归档用 `xlsx@0.18.5`（高危漏洞，不继承），
 *    本移植走 `packages/core/src/normalize/xlsx.ts`（exceljs，经 `model/xlsx-rows` 转发口引用）。
 * 3. **cwd 耦合 → 路径注入**：归档的路径是仓库根相对前缀，本移植全部由调用方注入。
 * 4. **样本排序改为码位序**：归档用 `sku.localeCompare`（受 locale 影响），
 *    本移植用码位比较（`<` / `>`），保证跨机器可复现（本数据集款号定长同宽，两者同序）。
 *
 * ## fail-closed 判据
 *
 * - 正样本画像文件数与冻结清单登记值不一致 → 抛错；
 * - 画像侧与商品信息侧的款号集合不一致（含重复款号）→ 抛错；
 * - 任一样本缺任一目标维度 → 抛错；
 * - 解析出的分布非有限或份额为负 → 抛错；
 * - intake 校验清单（`checksums.sha256`）有任一条不匹配 → 抛错。
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parsePortraitMd } from '@uom/core/model/portrait-md';
import { readXlsxRows } from '@uom/core/model/xlsx-rows';

import { projectV06CompliantInput } from './lib/features-v06.js';
import {
  V06_EXPERIMENT_ID,
  V06_TARGET_DIMENSIONS,
  type V06Sample,
  type V06TargetDimension,
} from './lib/types.js';

/** intake 路径（全部由调用方注入，不写死本机绝对路径）。 */
export interface V06IntakePaths {
  /** 画像目录（内含 `<sku>_正.md` / `<sku>_负.md`） */
  portraitDir: string;
  /** 商品信息表（XLSX） */
  productInfoXlsx: string;
  /** intake 校验清单（`checksums.sha256`），可选但给了就必须校验 */
  checksumsFile?: string;
  /** 冻结数据清单（`data-manifest.json`），给了就用作期望样本数来源 */
  manifestFile?: string;
}

/** intake 指纹（只含统计量，不含业务数值）。 */
export interface V06IntakeFingerprint {
  portraitFileCount: number;
  positivePortraitCount: number;
  productInfoSha256: string;
  checksumEntries: number;
  checksumMismatches: number;
}

/** 实验数据集。 */
export interface V06Dataset {
  schemaVersion: 1;
  experiment: string;
  targetDimensions: readonly string[];
  samples: V06Sample[];
  intake: V06IntakeFingerprint;
}

/** 商品信息表里读到的字段 → 归档列名。 */
const PRODUCT_INFO_COLUMN = {
  sku: '款号',
  fit: '版型',
  fabric: '面料',
  category: '品类',
  subcategory: '小类',
  season: '季节',
  productAttribute: '货品属性',
  ipCollab: 'IP/联名',
  specialFunctionMaterial: '特殊功能/材质',
} as const;

/** 文件字节流的 sha256（与归档 `sha256` 同口径）。 */
function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** 按码位序比较款号（跨机器可复现，不受 locale 影响）。 */
function compareSku(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** 校验 intake 的 `checksums.sha256` 清单，返回 [条目数, 不匹配数]。 */
function verifyIntakeChecksums(checksumsFile: string): [number, number] {
  const lines = readFileSync(checksumsFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const root = dirname(checksumsFile);
  let entries = 0;
  let mismatches = 0;
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const expected = parts[0];
    const relative = parts[1];
    if (!expected || !relative) continue;
    entries += 1;
    const actual = sha256File(join(root, relative.replace(/^\.\//, '')));
    if (actual !== expected) mismatches += 1;
  }
  return [entries, mismatches];
}

/** 解析并校验 intake，产出数据集。任何判据不过即抛错（fail-closed）。 */
export async function prepareV06Dataset(paths: V06IntakePaths): Promise<V06Dataset> {
  // 1. intake 校验清单（冻结输入完整性）
  let checksumEntries = 0;
  let checksumMismatches = 0;
  if (paths.checksumsFile) {
    [checksumEntries, checksumMismatches] = verifyIntakeChecksums(paths.checksumsFile);
    if (checksumMismatches > 0) {
      throw new Error(
        `FAIL-CLOSED: intake 校验清单有 ${checksumMismatches} 条不匹配（共 ${checksumEntries} 条）`,
      );
    }
  }

  // 2. 正样本画像文件
  const portraitFiles = readdirSync(paths.portraitDir)
    .filter((file) => file.endsWith('_正.md'))
    .sort(compareSku);
  if (portraitFiles.length === 0) {
    throw new Error(`FAIL-CLOSED: 画像目录没有任何正样本文件（${paths.portraitDir}）`);
  }

  // 3. 期望样本数（冻结清单登记值）
  if (paths.manifestFile) {
    const manifest = JSON.parse(readFileSync(paths.manifestFile, 'utf8')) as {
      frozen_inputs?: { portraits_positive_count?: number };
    };
    const expected = manifest.frozen_inputs?.portraits_positive_count;
    if (typeof expected === 'number' && expected !== portraitFiles.length) {
      throw new Error(
        `FAIL-CLOSED: 正样本画像文件数 ${portraitFiles.length} ≠ 冻结清单登记值 ${expected}`,
      );
    }
  }

  // 4. 商品信息表（exceljs 解析，缺失即 ENOENT）
  const rows = await readXlsxRows(paths.productInfoXlsx);
  const header = rows[0] ?? [];
  const columnIndex = (name: string): number => header.indexOf(name);
  const skuColumn = columnIndex(PRODUCT_INFO_COLUMN.sku);
  if (skuColumn < 0) {
    throw new Error(`FAIL-CLOSED: 商品信息表缺少「${PRODUCT_INFO_COLUMN.sku}」列`);
  }

  const products = new Map<string, Record<string, string>>();
  for (const row of rows.slice(1)) {
    const sku = (row[skuColumn] ?? '').trim();
    if (!sku) continue;
    if (products.has(sku)) {
      throw new Error(`FAIL-CLOSED: 商品信息表存在重复款号 ${sku}`);
    }
    const record: Record<string, string> = {};
    for (const [key, column] of Object.entries(PRODUCT_INFO_COLUMN)) {
      record[key] = (row[columnIndex(column)] ?? '').trim();
    }
    products.set(sku, record);
  }

  // 5. SKU 交叉核对
  const skuIds = portraitFiles.map((file) => file.replace(/_正\.md$/, ''));
  const onlyInPortraits = skuIds.filter((sku) => !products.has(sku));
  const onlyInProducts = [...products.keys()].filter((sku) => !skuIds.includes(sku));
  if (onlyInPortraits.length > 0 || onlyInProducts.length > 0) {
    throw new Error(
      `FAIL-CLOSED: 画像与商品信息款号不一致；仅画像有 ${onlyInPortraits.join(',')}；` +
        `仅商品信息有 ${onlyInProducts.join(',')}`,
    );
  }

  // 6. 逐样本解析画像（六维必须齐全）
  const samples: V06Sample[] = [];
  for (const file of portraitFiles) {
    const sku = file.replace(/_正\.md$/, '');
    const dimensions = parsePortraitMd(readFileSync(join(paths.portraitDir, file), 'utf8'));
    const portraits = {} as V06Sample['portraits'];
    for (const dimension of V06_TARGET_DIMENSIONS) {
      const distribution = dimensions.get(dimension);
      if (!distribution || Object.keys(distribution).length === 0) {
        throw new Error(`FAIL-CLOSED: ${sku} 缺目标维度 ${dimension}`);
      }
      for (const [label, share] of Object.entries(distribution)) {
        if (!Number.isFinite(share) || share < 0) {
          throw new Error(`FAIL-CLOSED: ${sku} 的 ${dimension}/${label} 份额非法（${share}）`);
        }
      }
      portraits[dimension as V06TargetDimension] = distribution;
    }
    const product = products.get(sku)!;
    samples.push({
      sku,
      input: projectV06CompliantInput({
        sku,
        fit: product.fit,
        fabric: product.fabric,
        category: product.category,
        subcategory: product.subcategory,
        season: product.season,
        productAttribute: product.productAttribute,
        ipCollab: product.ipCollab,
        specialFunctionMaterial: product.specialFunctionMaterial,
      }),
      portraits,
    });
  }

  // 7. 样本顺序契约：按款号码位序（alpha 选择的内层折依赖样本顺序）
  samples.sort((left, right) => compareSku(left.sku, right.sku));

  return {
    schemaVersion: 1,
    experiment: V06_EXPERIMENT_ID,
    targetDimensions: V06_TARGET_DIMENSIONS,
    samples,
    intake: {
      portraitFileCount: readdirSync(paths.portraitDir).length,
      positivePortraitCount: portraitFiles.length,
      productInfoSha256: sha256File(paths.productInfoXlsx),
      checksumEntries,
      checksumMismatches,
    },
  };
}
