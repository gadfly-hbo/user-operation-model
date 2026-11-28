/**
 * 评估指标 —— 本项目**唯一**的指标实现（工程规范 §9.1 同类要求：禁止第二份逻辑）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/core.mts`
 *   逻辑位置：`jsSimilarity`（第 116–127 行）、`cosineSimilarity`（第 129–142 行）、
 *   `shareMae`（第 144–150 行）、`top1Hit`（第 152–156 行）、`top3Hit`（第 158–165 行）、
 *   `signTestPValue`（第 168–188 行）。
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-07-11-v0.4-expanded-temporal-holdout/orchestrate.ts`
 *   逻辑位置：`evaluateHoldout`（第 292–340 行）里的 `top1` / `top3` **重叠比**口径与 `shareMae`。
 *
 * 移植时修掉的问题：
 * 1. **JS / 余弦双实现**：v0.6 在 `lib/core.mts` 里另写了一份 JS 散度与余弦，与本项目
 *    `packages/core/src/index/similarity.ts` 的既有实现重复。本模块**直接复用**既有实现
 *    （`jsSimilarity` 是 `1 - jensenShannonDistance` 的薄封装，`cosineSimilarity` 直接再导出），
 *    不在本文件内出现第二份公式。
 * 2. **同名不同义的 `top1`**：v0.4 的 `top1` 是**重叠比**，v0.6 的 `top1` 是**argmax 相等**，
 *    数值口径不同却同名。本模块用**不同名字**并存并写明口径差异：
 *    - `top1Overlap` / `top3Overlap`：**v0.4 重叠比口径**——
 *      `|predicted TopN ∩ actual TopN| / |actual TopN|`，分母是**实际** Top-N 集合大小，
 *      因此 Top3 的取值可以是 0、1/3、2/3、1；实际侧只取 `share > 0` 的标签（v0.4 的 `actualDim` 过滤）。
 *    - `top1Hit` / `top3Hit`：**v0.6 argmax 口径**——
 *      `top1Hit` 判两侧 argmax 是否相等；`top3Hit` 判**预测侧 argmax**是否落在**实际侧 Top3** 内
 *      （v0.6 的 `top3Q.includes(topP)`，注意方向不对称）。两侧都不做 `share > 0` 过滤。
 *    两套口径在 Top-3 上必然给出不同结果；Top-1 上仅在边界输入（实际分布为空或只有零份额标签）
 *    才分歧——这正是「同名不同义」的落点，测试显式锁住。
 * 3. **空分布 NaN**：v0.6 的 `shareMae` 在标签并集为空时返回 `NaN`，`cosineSimilarity` 在空分布时
 *    返回 `NaN`。本模块改用 v0.4 的带守卫写法（空 → 0）与既有 core 实现（空 → 0）。
 * 4. **忠实保留的一处 v0.6 行为**：`top1Hit` 对两个空分布返回 1（两侧 argmax 均为 `undefined`，严格相等）。
 *    该行为来自 v0.6 `lib/core.mts:152-156`，此处**显式保留并标注**，调用方不得传入空分布。
 *
 * 签名方向统一为 `(predicted, actual)`。
 */

import { cosineSimilarity, jensenShannonDistance } from '../index/similarity.js';

/** 标签 → 份额 的分布。 */
export type Distribution = Record<string, number>;

/**
 * 余弦相似度：直接复用 `packages/core/src/index/similarity.ts` 的既有实现（本模块不另写一份）。
 */
export { cosineSimilarity };

/** JS 相似度 = 1 − JS 距离，复用既有实现的散度计算。 */
export function jsSimilarity(p: Distribution, q: Distribution): number {
  return 1 - jensenShannonDistance(p, q);
}

/** 标签并集上的平均绝对份额差（并集为空时返回 0，不产生 NaN）。 */
export function shareMae(p: Distribution, q: Distribution): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  if (keys.size === 0) return 0;
  let total = 0;
  for (const key of keys) total += Math.abs((p[key] ?? 0) - (q[key] ?? 0));
  return total / keys.size;
}

/**
 * 按份额降序取前 n 个标签（并列时保持插入顺序，与来源实现的稳定排序一致）。
 *
 * @param onlyPositive 是否只保留 `share > 0` 的标签（v0.4 的实际侧过滤）
 */
function topLabels(dist: Distribution, n: number, onlyPositive: boolean): string[] {
  const entries = Object.entries(dist).filter(([, share]) => !onlyPositive || share > 0);
  entries.sort((left, right) => right[1] - left[1]);
  return entries.slice(0, n).map(([label]) => label);
}

/** 分布的 argmax 标签（并列时取插入序最靠前的一个）。 */
function argmaxLabel(dist: Distribution): string | undefined {
  let best: string | undefined;
  let bestShare = Number.NEGATIVE_INFINITY;
  for (const [label, share] of Object.entries(dist)) {
    if (share > bestShare) {
      best = label;
      bestShare = share;
    }
  }
  return best;
}

/**
 * v0.4 重叠比口径的 Top1：`|predicted Top1 ∩ actual Top1| / |actual Top1|`。
 *
 * 实际侧只取 `share > 0` 的标签；实际侧集合为空时返回 0（v0.4 的 `actualTop1.size === 0 ? 0` 守卫）。
 */
export function top1Overlap(predicted: Distribution, actual: Distribution): number {
  const actualTop = topLabels(actual, 1, true);
  if (actualTop.length === 0) return 0;
  const actualSet = new Set(actualTop);
  const predictedTop = topLabels(predicted, 1, false);
  const hits = predictedTop.filter((label) => actualSet.has(label)).length;
  return hits / actualTop.length;
}

/**
 * v0.4 重叠比口径的 Top3：`|predicted Top3 ∩ actual Top3| / |actual Top3|`。
 *
 * 分母是实际 Top3 集合大小（最多 3），因此取值可以是 0、1/3、2/3、1。
 */
export function top3Overlap(predicted: Distribution, actual: Distribution): number {
  const actualTop = topLabels(actual, 3, true);
  if (actualTop.length === 0) return 0;
  const actualSet = new Set(actualTop);
  const predictedTop = topLabels(predicted, 3, false);
  const hits = predictedTop.filter((label) => actualSet.has(label)).length;
  return hits / actualTop.length;
}

/**
 * v0.6 argmax 口径的 Top1：两侧 argmax 严格相等记 1，否则 0。
 *
 * 忠实保留 v0.6 的边界行为：两个空分布返回 1（argmax 均为 `undefined`）。
 */
export function top1Hit(predicted: Distribution, actual: Distribution): number {
  return argmaxLabel(predicted) === argmaxLabel(actual) ? 1 : 0;
}

/**
 * v0.6 argmax 口径的 Top3：**预测侧 argmax** 是否落在**实际侧 Top3** 内（v0.6 的方向不对称）。
 *
 * 与 `top3Overlap` 是两套口径：同一对样本上二者可以给出不同结果。
 */
export function top3Hit(predicted: Distribution, actual: Distribution): number {
  const predictedTop = argmaxLabel(predicted);
  if (predictedTop === undefined) return 0;
  return topLabels(actual, 3, false).includes(predictedTop) ? 1 : 0;
}

/**
 * 配对差值的双侧精确二项符号检验（零差丢弃）。
 *
 * 来源：v0.6 `lib/core.mts:168-188`。`|d| ≤ 1e-12` 视为零差并丢弃；
 * p 值为尾部概率的两倍（上限 1）。
 */
export function signTestPValue(diffs: number[]): {
  p: number;
  positive: number;
  negative: number;
  n: number;
} {
  const nonZero = diffs.filter((d) => Math.abs(d) > 1e-12);
  const positive = nonZero.filter((d) => d > 0).length;
  const negative = nonZero.length - positive;
  const n = nonZero.length;
  if (n === 0) return { p: 1, positive: 0, negative: 0, n: 0 };

  const logFactorial = (k: number): number => {
    let total = 0;
    for (let i = 2; i <= k; i += 1) total += Math.log(i);
    return total;
  };
  const binomLogPmf = (k: number): number =>
    logFactorial(n) - logFactorial(k) - logFactorial(n - k) + n * Math.log(0.5);

  const observed = Math.max(positive, negative);
  let tail = 0;
  for (let k = observed; k <= n; k += 1) tail += Math.exp(binomLogPmf(k));
  const p = Math.min(1, 2 * tail);
  return { p, positive, negative, n };
}
