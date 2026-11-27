/**
 * Ridge 回归 —— 本项目**唯一**的 Ridge 实现（单一求解器 + 单一标准化）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/src/capabilities/product-channel-fit/single-product-portrait-supervised.ts`
 *   逻辑位置：`computeMeanStd` / `standardize`（第 542–563 行）、`trainRidge`（第 569–584 行）；
 *   配套调用点 `standardize(X)` → `trainRidge(scaled, y, alpha)`（第 675–691 行）、预测（第 727–733 行）。
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/core.mts`
 *   逻辑位置：`solveRidge`（第 194–253 行）、`predictRidge`（第 255–262 行）、`fitRidgeStandardized`（第 264–279 行）。
 *
 * 移植时修掉的问题（工程规范 §8.1「移植时必须修掉」）：
 * 1. **Ridge 多实现 → 单一 Cholesky**：v0.4 用「矩阵求逆 + Gauss-Jordan」，v0.6 用「高斯消元」，
 *    归档内共 10 份实现。本文件只保留 Cholesky 分解 + 前回代（`choleskyFactor` / `solveCholesky`）。
 * 2. **mean/std 双算**：v0.6 的 `solveRidge` 内部算一遍 mean/std，`fitRidgeStandardized` 又算一遍。
 *    本文件把标准化收敛为 `standardize` 一处，训练与预测共用同一份 mean/std（模型内持久化）。
 * 3. **绝对路径与 cwd 耦合**：本文件不读写任何文件，不含路径。
 *
 * 口径说明（两套来源在数学上等价，此处统一为一份实现）：
 * - v0.4 对 **标准化后** 的特征解 `(ZᵀZ + αI)w = Zᵀy`，截距 `ȳ - wᵀ·mean(Z)`；
 *   v0.6 对 **中心化 y** 解 `(ZᵀZ + αI)w = Zᵀ(y - ȳ)`，截距 `ȳ`。
 *   因 `Zᵀ1 = 0`（Z 各列已中心化），`Zᵀy = Zᵀ(y - ȳ)`，两式在实数域完全等价，
 *   截距 `ȳ - wᵀ·mean(Z)` 与 `ȳ` 的差别只是 `mean(Z) ≈ 0` 的浮点噪声。本实现取后者（更简洁、跨来源一致）。
 * - 正则项一律为 `XᵀX + αI`（与两份来源一致，不做 n 倍缩放）。
 *
 * 数值约定：均值取 `Σx/n`，标准差取 `sqrt(Σ(x-mean)²/n)`（总体口径，与两份来源一致），
 * 零方差列的 std 兜底为 1（防除零）。Cholesky 主元非正（矩阵非正定，如 α=0 且特征共线）时
 * 加最小抖动兜底，保证结果有限、不抛错、不产生 NaN。
 */

/** 训练好的 Ridge 模型（含推理所需的标准化参数）。 */
export interface RidgeModel {
  /** 标准化空间下的特征权重 */
  weights: number[];
  /** 截距（标准化空间的均值基线 ȳ） */
  intercept: number;
  /** 各列均值（standardize 产出，只算一次） */
  mean: number[];
  /** 各列标准差（standardize 产出，只算一次） */
  std: number[];
  /** 正则强度 α */
  alpha: number;
}

/** 标准化结果。 */
export interface StandardizedMatrix {
  scaled: number[][];
  mean: number[];
  std: number[];
}

/** Cholesky 主元非正时的最小抖动（相对矩阵尺度另加一个下限）。 */
const JITTER_FLOOR = 1e-12;

/**
 * 标准化：逐列减均值、除标准差。
 *
 * 唯一实现：v0.4 `standardize` 与 v0.6 `solveRidge` 内的内联版本都收敛到这里。
 * 零方差列的 std 兜底为 1（避免除零产生 NaN/Infinity）。
 */
export function standardize(X: number[][]): StandardizedMatrix {
  const n = X.length;
  if (n === 0) throw new Error('standardize: 矩阵为空');
  const p = X[0]!.length;
  const mean: number[] = [];
  const std: number[] = [];
  for (let j = 0; j < p; j += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += X[i]![j]!;
    const columnMean = sum / n;
    let squared = 0;
    for (let i = 0; i < n; i += 1) squared += (X[i]![j]! - columnMean) ** 2;
    mean.push(columnMean);
    std.push(Math.sqrt(squared / n) || 1);
  }
  const scaled = X.map((row) => row.map((value, j) => (value - mean[j]!) / std[j]!));
  return { scaled, mean, std };
}

/**
 * Cholesky 分解 A = L·Lᵀ，返回下三角阵 L。
 *
 * α>0 时 A = ZᵀZ + αI 正定，分解稳定；A 非正定时（例如 α=0 且特征完全共线），
 * 主元会被抬到最小抖动，保证后续求解得到有限解而不是 NaN。
 */
export function choleskyFactor(A: number[][]): number[][] {
  const n = A.length;
  if (n === 0) throw new Error('choleskyFactor: 矩阵为空');
  let scale = 0;
  for (let i = 0; i < n; i += 1) scale = Math.max(scale, Math.abs(A[i]![i]!));
  const jitter = Math.max(JITTER_FLOOR, scale * JITTER_FLOOR);
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let j = 0; j < n; j += 1) {
    let diagonal = A[j]![j]!;
    for (let k = 0; k < j; k += 1) diagonal -= L[j]![k]! ** 2;
    if (!(diagonal > jitter)) diagonal = jitter;
    L[j]![j] = Math.sqrt(diagonal);
    for (let i = j + 1; i < n; i += 1) {
      let value = A[i]![j]!;
      for (let k = 0; k < j; k += 1) value -= L[i]![k]! * L[j]![k]!;
      L[i]![j] = value / L[j]![j]!;
    }
  }
  return L;
}

/** 用 Cholesky 分解求解 A·x = b（前代 + 回代）。 */
export function solveCholesky(A: number[][], b: number[]): number[] {
  const L = choleskyFactor(A);
  const n = L.length;
  if (b.length !== n) throw new Error('solveCholesky: 右端项维度与矩阵不一致');
  const y: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i]!;
    for (let k = 0; k < i; k += 1) sum -= L[i]![k]! * y[k]!;
    y[i] = sum / L[i]![i]!;
  }
  const x: number[] = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i]!;
    for (let k = i + 1; k < n; k += 1) sum -= L[k]![i]! * x[k]!;
    x[i] = sum / L[i]![i]!;
  }
  return x;
}

/**
 * 用**已分解**的 Cholesky 因子求解 A·x = b（前代 + 回代）。
 *
 * 与 `solveCholesky(A, b)` 的区别：后者内部会先做一次 Cholesky 分解；
 * 本函数接收 `choleskyFactor(A)` 的产物，在**多右端项**场景（同一设计矩阵的多个标签）
 * 里可复用同一次分解，避免重复分解。求解口径与 `solveCholesky` 完全一致。
 *
 * @param L `choleskyFactor(A)` 的返回值（下三角）
 * @param b 右端项
 */
export function solveCholeskyFactorized(L: number[][], b: number[]): number[] {
  const n = L.length;
  if (b.length !== n) throw new Error('solveCholeskyFactorized: 右端项维度与矩阵不一致');
  const y: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i]!;
    for (let k = 0; k < i; k += 1) sum -= L[i]![k]! * y[k]!;
    y[i] = sum / L[i]![i]!;
  }
  const x: number[] = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i]!;
    for (let k = i + 1; k < n; k += 1) sum -= L[k]![i]! * x[k]!;
    x[i] = sum / L[i]![i]!;
  }
  return x;
}

/**
 * 训练 Ridge：标准化 → 解 (ZᵀZ + αI)w = Zᵀ(y - ȳ)。
 *
 * @param X 训练矩阵（n × p）
 * @param y 目标向量（n）
 * @param alpha 正则强度（≥0；0 即普通最小二乘）
 */
export function fitRidge(X: number[][], y: number[], alpha: number): RidgeModel {
  if (X.length === 0) throw new Error('fitRidge: 训练矩阵为空');
  if (X.length !== y.length) throw new Error('fitRidge: 特征矩阵与目标向量长度不一致');
  if (!Number.isFinite(alpha) || alpha < 0) throw new Error('fitRidge: alpha 必须是非负有限数');

  const { scaled, mean, std } = standardize(X);
  const n = scaled.length;
  const p = mean.length;

  let ySum = 0;
  for (const value of y) ySum += value;
  const yMean = ySum / n;

  const A: number[][] = [];
  const rhs: number[] = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j += 1) {
    const row: number[] = new Array<number>(p).fill(0);
    for (let k = 0; k < p; k += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += scaled[i]![j]! * scaled[i]![k]!;
      row[k] = sum + (j === k ? alpha : 0);
    }
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += scaled[i]![j]! * (y[i]! - yMean);
    rhs[j] = sum;
    A.push(row);
  }

  const weights = solveCholesky(A, rhs);
  return { weights, intercept: yMean, mean, std, alpha };
}

/** 用训练好的模型预测单条样本（标准化在推理侧用同一份 mean/std）。 */
export function predictRidge(model: RidgeModel, x: number[]): number {
  if (x.length !== model.weights.length) {
    throw new Error('predictRidge: 特征维度与模型不一致');
  }
  let value = model.intercept;
  for (let j = 0; j < x.length; j += 1) {
    value += model.weights[j]! * ((x[j]! - model.mean[j]!) / model.std[j]!);
  }
  return value;
}
