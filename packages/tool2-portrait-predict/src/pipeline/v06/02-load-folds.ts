/**
 * 阶段 02：读取**冻结**的 folds.json 作为输入，并校验其完整性。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/02-make-folds.mts`
 *   逻辑位置：分层键与种子（第 26–27 行）、分层洗牌与轮转分配（第 29–55 行）、
 *   fail-closed 完整性断言（第 57–72 行）、输出结构（第 74–90 行）。
 *
 * ## 关键口径：folds 是**输入**，不重生成
 *
 * P2 规格 M08 明确要求「`folds.json` 作为**输入**冻结不重生成」。
 * 因此本阶段**只读 + 校验**，不实现任何生成分层/分配逻辑；
 * 归档 `02-make-folds.mts` 的洗牌与分配代码**不移植**。
 *
 * 冻结分层键是 `categoryGroup x genderCorrected`（归档 `folds.json` 的 `stratify_key`），
 * 其中 `genderCorrected`（性别修正）属人工字段。
 * **该字段只出现在「已冻结的划分结果」里，不进入预测路径**：
 * 预测路径的特征抽取只读 §9.2 白名单字段（见 `lib/features-v06.ts`）。
 * 重做分层会改动全部 OOF 数字，属另立变更的范围（见 result.md 范围外发现）。
 */

import { readFileSync } from 'node:fs';

/** 冻结的 folds 文档结构（对齐归档 `outputs/folds.json`）。 */
export interface V06FoldsDoc {
  schemaVersion: number;
  method: string;
  stratifyKey: string;
  seed: number;
  k: number;
  foldSizes: number[];
  folds: string[][];
}

/** 读取冻结的 folds 文档（只读；不写回、不重生成）。 */
export function loadFrozenV06Folds(path: string): V06FoldsDoc {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    schema_version?: number;
    method?: string;
    stratify_key?: string;
    seed?: number;
    k?: number;
    fold_sizes?: number[];
    folds?: string[][];
  };
  if (!Array.isArray(raw.folds)) {
    throw new Error(`FAIL-CLOSED: 冻结 folds 文件缺少 folds 数组（${path}）`);
  }
  return {
    schemaVersion: raw.schema_version ?? 1,
    method: raw.method ?? 'unknown',
    stratifyKey: raw.stratify_key ?? 'unknown',
    seed: raw.seed ?? 0,
    k: raw.k ?? raw.folds.length,
    foldSizes: raw.fold_sizes ?? raw.folds.map((fold) => fold.length),
    folds: raw.folds,
  };
}

/**
 * 校验冻结 folds 的完整性，返回错误列表（空数组 = 通过）。
 *
 * 判据（对齐归档 `02-make-folds.mts:57-72`）：
 * 1. 折数与声明一致；
 * 2. 所有款号恰好出现一次（不重不漏）；
 * 3. 折大小之差不超过 1（分层均衡）；
 * 4. 覆盖的款号集合与数据集一致；
 * 5. 登记的 `fold_sizes` 与实际折大小一致。
 */
export function validateV06Folds(doc: V06FoldsDoc, skuIds: readonly string[]): string[] {
  const errors: string[] = [];

  if (doc.folds.length !== doc.k) {
    errors.push(`折数 ${doc.folds.length} 与声明的 k=${doc.k} 不一致`);
  }

  const flat = doc.folds.flat();
  const unique = new Set(flat);
  if (unique.size !== flat.length) {
    errors.push('折之间存在重复款号');
  }

  const skuSet = new Set(skuIds);
  const missing = skuIds.filter((sku) => !unique.has(sku));
  const extra = flat.filter((sku) => !skuSet.has(sku));
  if (missing.length > 0) errors.push(`fold 未覆盖的款号：${missing.join(',')}`);
  if (extra.length > 0) errors.push(`fold 里的未知款号：${extra.join(',')}`);

  const sizes = doc.folds.map((fold) => fold.length);
  if (sizes.length > 0 && Math.max(...sizes) - Math.min(...sizes) > 1) {
    errors.push(`折大小不均衡：${sizes.join(',')}`);
  }
  if (doc.foldSizes.length > 0 && doc.foldSizes.join(',') !== sizes.join(',')) {
    errors.push(`登记的 fold_sizes（${doc.foldSizes.join(',')}）与实际（${sizes.join(',')}）不一致`);
  }

  return errors;
}
