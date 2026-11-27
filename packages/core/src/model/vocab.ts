/**
 * 折内特征词表 —— 单一实现，计数只来自训练折。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/features.mts`
 *   逻辑位置：`buildMatrix`（第 142–164 行）—— 折内计数、`minCount` 过滤、按名排序、eval 未见 token 映 0。
 *
 * 移植时修掉／显式化的问题：
 * 1. **minCount 写死**：v0.6 的 `buildMatrix` 把 `minCount = 3` 写成默认参数。本模块把它外置为必填参数
 *    （`VocabularyOptions.minCount`），由调用方按实验配置传入。
 * 2. **OOF 词表 ≠ 最终词表的偏斜被静默统一**：v0.6 的 `features.mts:156` 用 `c < trainSamples.length`
 *    过滤掉「在训练折内恒定出现」的 token，因此**折内词表（74/75 款）与最终词表（全部样本）不同**。
 *    本模块**显式**返回 `foldVocab`（逐折）与 `finalVocab`（全样本）两份，并给出偏斜诊断 `skew`，
 *    不做静默统一。导出器应冻结**最终词表**供运行时使用，门禁须显式校验该偏斜（见 P2 规格 §2.5）。
 * 3. **计数口径**：词表计数 = **含该 token 的样本数**（同一样本内重复 token 只计一次，与 v0.6 的
 *    `Map` 键口径一致）；向量化时按 token 在样本内的**出现次数**取值。
 */

/** 单个样本的特征 token 列表。 */
export type SampleTokens = readonly string[];
/** 一折的样本集合。 */
export type Fold = readonly SampleTokens[];

/** 词表构建参数。 */
export interface VocabularyOptions {
  /** token 至少出现的样本数（外置参数，不写死） */
  minCount: number;
  /** 是否剔除在训练折内恒定出现的 token（v0.6 口径 `count < 样本数`）。默认 true。 */
  dropConstant?: boolean;
}

/** 一份词表。 */
export interface Vocabulary {
  /** 特征名（按码位升序） */
  featureNames: string[];
  /** token → 含它的样本数 */
  counts: Record<string, number>;
  /** 本次使用的 minCount */
  minCount: number;
  /** 参与计数的样本数 */
  sampleCount: number;
}

/** 折内词表与最终词表之间的偏斜诊断。 */
export interface FoldVocabularySkew {
  /** 折序号 */
  foldIndex: number;
  /** 出现在最终词表但不在该折词表的 token */
  onlyInFinal: string[];
  /** 出现在该折词表但不在最终词表的 token */
  onlyInFold: string[];
}

/** 折内词表与最终词表（**不做静默统一**）。 */
export interface FoldVocabulary {
  /** 逐折词表（每份只用该折样本计数） */
  foldVocab: Vocabulary[];
  /** 全样本词表（运行时导出应冻结这一份） */
  finalVocab: Vocabulary;
  /** 逐折偏斜诊断 */
  skew: FoldVocabularySkew[];
}

/**
 * 按训练折样本构建词表。
 *
 * 过滤规则：保留 `count >= minCount` 的 token；`dropConstant` 为真时再剔除
 * `count >= 样本数`（即在训练折内恒定出现）的 token。
 */
export function buildVocabulary(
  samples: readonly SampleTokens[],
  options: VocabularyOptions,
): Vocabulary {
  const { minCount, dropConstant = true } = options;
  if (!Number.isInteger(minCount) || minCount < 1) {
    throw new Error('buildVocabulary: minCount 必须是 ≥ 1 的整数');
  }
  const counter = new Map<string, number>();
  for (const sample of samples) {
    for (const token of new Set(sample)) {
      counter.set(token, (counter.get(token) ?? 0) + 1);
    }
  }
  const featureNames = [...counter.entries()]
    .filter(([token, count]) => count >= minCount && (!dropConstant || count < samples.length))
    .map(([token]) => token)
    .sort();
  const counts = Object.fromEntries([...counter.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { featureNames, counts, minCount, sampleCount: samples.length };
}

/** 按词表把样本 token 变成数值向量（值 = token 在样本内的出现次数，未出现为 0）。 */
export function vectorize(tokens: SampleTokens, vocabulary: Vocabulary): number[] {
  const counter = new Map<string, number>();
  for (const token of tokens) counter.set(token, (counter.get(token) ?? 0) + 1);
  return vocabulary.featureNames.map((name) => counter.get(name) ?? 0);
}

/**
 * 构建逐折词表与最终词表。
 *
 * 每折词表**只**用该折样本计数（不泄漏其他折，尤其不泄漏 eval 折）；
 * 最终词表用全部折的样本计数。两者不同是**已知且被显式记录**的偏斜，不是缺陷。
 */
export function buildFoldVocabulary(
  folds: readonly Fold[],
  options: VocabularyOptions,
): FoldVocabulary {
  const foldVocab = folds.map((fold) => buildVocabulary(fold, options));
  const allSamples: SampleTokens[] = [];
  for (const fold of folds) allSamples.push(...fold);
  const finalVocab = buildVocabulary(allSamples, options);
  const finalSet = new Set(finalVocab.featureNames);
  const skew: FoldVocabularySkew[] = foldVocab.map((vocab, foldIndex) => {
    const foldSet = new Set(vocab.featureNames);
    return {
      foldIndex,
      onlyInFinal: finalVocab.featureNames.filter((name) => !foldSet.has(name)),
      onlyInFold: vocab.featureNames.filter((name) => !finalSet.has(name)),
    };
  });
  return { foldVocab, finalVocab, skew };
}
