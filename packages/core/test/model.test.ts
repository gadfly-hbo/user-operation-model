import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  choleskyFactor,
  fitRidge,
  predictRidge,
  solveCholesky,
  standardize,
} from '../src/model/ridge.js';
import * as metrics from '../src/model/metrics.js';
import {
  buildFoldVocabulary,
  buildVocabulary,
  vectorize,
} from '../src/model/vocab.js';
import {
  cosineSimilarity as coreCosineSimilarity,
  jensenShannonDistance,
} from '../src/index/similarity.js';

/**
 * `packages/core/src/model/**` 的单测（P2-3 模型公共库）。
 *
 * 覆盖：
 * - Ridge 单一 Cholesky 求解器（手算矩阵对照、α→0 退化 OLS、奇异输入不 NaN、零方差列）；
 * - 指标单一来源（复用 `index/similarity.ts` 的 JS/余弦；v0.4 重叠比与 v0.6 argmax 两套口径并存）；
 * - 折内词表（不泄漏 eval 折、minCount 外置、按名排序、OOF 词表 ≠ 最终词表显式化）。
 *
 * 变异守卫：ridge 用「奇异输入不抛错 + 源码结构」双保险挡住换回 Gauss-Jordan；
 * metrics 用「函数同一性 + 源码结构」挡住第二份 JS/余弦实现。
 */

/** 读取模型模块的 TypeScript 源码，用于结构型变异守卫。 */
function readModelSource(fileName: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // 编译产物位于 packages/core/dist/test/，源码位于 packages/core/src/model/
  return readFileSync(resolve(here, '../../src/model', fileName), 'utf8');
}

/**
 * 去掉注释，只留可执行代码。
 *
 * 变异守卫只应检查**代码**，不能被文档注释里的历史名词（Gauss-Jordan 等）误伤。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Ridge：单一 Cholesky 求解器', () => {
  // 手算基准矩阵：X 每列均值 1、标准差 1（总体口径），故标准化后 Z 为 ±1 组合。
  const X = [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ];
  const y = [0, 1, 2, 3];

  test('与手算小矩阵对照（容差 1e-9）', () => {
    // Z = [[-1,-1],[-1,1],[1,-1],[1,1]]；ZᵀZ = 4I；Zᵀ(y-ȳ) = [4, 2]；ȳ = 1.5
    // α=1 → (4I + I)w = [4,2] → w = [0.8, 0.4]，截距 = ȳ = 1.5
    const model = fitRidge(X, y, 1);
    assert.ok(Math.abs(model.weights[0]! - 0.8) < 1e-9, `w0=${model.weights[0]}`);
    assert.ok(Math.abs(model.weights[1]! - 0.4) < 1e-9, `w1=${model.weights[1]}`);
    assert.ok(Math.abs(model.intercept - 1.5) < 1e-9, `b=${model.intercept}`);

    // 预测值手算：ŷ = b + w₀·(x₀-1)/1 + w₁·(x₁-1)/1
    assert.ok(Math.abs(predictRidge(model, [0, 0]) - 0.3) < 1e-9);
    assert.ok(Math.abs(predictRidge(model, [0, 2]) - 1.1) < 1e-9);
    assert.ok(Math.abs(predictRidge(model, [2, 0]) - 1.9) < 1e-9);
    assert.ok(Math.abs(predictRidge(model, [2, 2]) - 2.7) < 1e-9);
  });

  test('α→0 退化为 OLS（同一矩阵的正规方程解 w=[1, 0.5]）', () => {
    // α=0：4I·w = [4,2] → w = [1, 0.5]
    const ols = fitRidge(X, y, 0);
    assert.ok(Math.abs(ols.weights[0]! - 1) < 1e-9, `w0=${ols.weights[0]}`);
    assert.ok(Math.abs(ols.weights[1]! - 0.5) < 1e-9, `w1=${ols.weights[1]}`);
    assert.ok(Math.abs(ols.intercept - 1.5) < 1e-9);

    // α 极小时同样逼近 OLS
    const tiny = fitRidge(X, y, 1e-12);
    assert.ok(Math.abs(tiny.weights[0]! - 1) < 1e-9, `w0=${tiny.weights[0]}`);
    assert.ok(Math.abs(tiny.weights[1]! - 0.5) < 1e-9, `w1=${tiny.weights[1]}`);
  });

  test('奇异输入不产生 NaN 也不抛错（换回 Gauss-Jordan 会被这条抓住）', () => {
    // 两列完全共线，α=0 时 ZᵀZ 秩亏：Cholesky 主元非正，走最小抖动兜底
    const singularX = [
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
    ];
    const model = fitRidge(singularX, [1, 2, 3, 4], 0);
    assert.equal(model.weights.length, 2);
    for (const w of model.weights) assert.ok(Number.isFinite(w), `权重非有限值：${w}`);
    assert.ok(Number.isFinite(model.intercept));
    const prediction = predictRidge(model, [2, 4]);
    assert.ok(Number.isFinite(prediction));
  });

  test('standardize 对零方差列做除零保护（std||1）', () => {
    const constantColumn = [
      [1, 5],
      [1, 7],
      [1, 9],
    ];
    const { scaled, mean, std } = standardize(constantColumn);
    assert.ok(Math.abs(mean[0]! - 1) < 1e-12);
    assert.equal(std[0], 1, '零方差列的 std 必须兜底为 1');
    assert.ok(Math.abs(std[1]! - Math.sqrt(8 / 3)) < 1e-12);
    for (const row of scaled) {
      assert.ok(Number.isFinite(row[0]!));
      assert.equal(row[0], 0);
    }

    // 训练路径同样不得出现 NaN
    const model = fitRidge(constantColumn, [1, 2, 3], 1);
    for (const w of model.weights) assert.ok(Number.isFinite(w));
    assert.ok(Number.isFinite(predictRidge(model, [1, 5])));
  });

  test('standardize 只算一次：模型内归一化参数与 standardize 输出一致', () => {
    const model = fitRidge(X, y, 1);
    const once = standardize(X);
    assert.deepEqual(model.mean, once.mean);
    assert.deepEqual(model.std, once.std);
    // 手算基准：两列均值均为 1、标准差均为 1
    assert.deepEqual(model.mean, [1, 1]);
    assert.deepEqual(model.std, [1, 1]);
  });

  test('Cholesky 分解可单独调用且能解回原方程', () => {
    const A = [
      [4, 2],
      [2, 3],
    ];
    const b = [16, 12];
    const L = choleskyFactor(A);
    assert.ok(Math.abs(L[0]![0]! - 2) < 1e-12);
    assert.ok(Math.abs(L[1]![1]! - Math.sqrt(2)) < 1e-12);
    const x = solveCholesky(A, b);
    // 解：A·x = b → x = [3, 2]
    assert.ok(Math.abs(x[0]! - 3) < 1e-9, `x0=${x[0]}`);
    assert.ok(Math.abs(x[1]! - 2) < 1e-9, `x1=${x[1]}`);
  });

  test('变异守卫：源码只保留 Cholesky 一条求解路径', () => {
    const source = stripComments(readModelSource('ridge.ts'));
    assert.match(source, /cholesky/i, '必须存在 Cholesky 分解实现');
    // Gauss-Jordan / 显式求逆的标记一旦出现在代码里即视为换回第二份求解器
    assert.doesNotMatch(source, /invertMatrix|gaussJordan|adjugate|cofactor/i);
    assert.doesNotMatch(source, /Math\.pow\(\s*[^,]+,\s*-1\s*\)/, '不得用求逆代替 Cholesky');
  });
});

describe('指标：单一来源 + 两套口径并存', () => {
  test('JS 相似度与余弦复用 core 既有实现（函数同一性）', () => {
    assert.equal(metrics.cosineSimilarity, coreCosineSimilarity);
    const p = { a: 0.5, b: 0.5 };
    const q = { a: 0.3, b: 0.7 };
    assert.ok(
      Math.abs(metrics.jsSimilarity(p, q) - (1 - jensenShannonDistance(p, q))) < 1e-12,
    );
    assert.ok(Math.abs(metrics.cosineSimilarity(p, q) - coreCosineSimilarity(p, q)) < 1e-15);
  });

  test('shareMae：标签并集上的平均绝对份额差', () => {
    // 并集 {A,B,C}：|0.5-0.3| + |0.5-0| + |0-0.7| = 1.4，MAE = 1.4/3
    const value = metrics.shareMae({ A: 0.5, B: 0.5 }, { A: 0.3, C: 0.7 });
    assert.ok(Math.abs(value - 1.4 / 3) < 1e-12, `shareMae=${value}`);
    assert.equal(metrics.shareMae({}, {}), 0, '空分布不得出现 NaN');
  });

  test('top1/top3 重叠比（v0.4 口径）：分母是实际 Top-N 集合大小', () => {
    const predicted = { A: 0.4, B: 0.3, C: 0.2, D: 0.1 };
    const actual = { A: 0.5, B: 0.3, E: 0.2 };
    // actual Top1 = {A}，predicted Top1 = {A} → 1/1
    assert.equal(metrics.top1Overlap(predicted, actual), 1);
    // actual Top3 = {A,B,E}，predicted Top3 = {A,B,C} → 2/3
    assert.ok(Math.abs(metrics.top3Overlap(predicted, actual) - 2 / 3) < 1e-12);

    const swapped = { B: 0.5, A: 0.4, C: 0.1 };
    assert.equal(metrics.top1Overlap(swapped, actual), 0, 'Top1 不命中即为 0');
  });

  test('top1Hit/top3Hit（v0.6 argmax 口径）与重叠比口径给出不同结果', () => {
    const predicted = { A: 0.4, B: 0.3, C: 0.2, D: 0.1 };
    const actual = { A: 0.5, B: 0.3, E: 0.2 };
    // Top3：v0.4 重叠比 2/3，v0.6 argmax 命中 1 —— 同一样本、两种口径、不同结果
    assert.ok(Math.abs(metrics.top3Overlap(predicted, actual) - 2 / 3) < 1e-12);
    assert.equal(metrics.top3Hit(predicted, actual), 1);

    // Top1：两口径在空分布边界上分歧（v0.4 有空守卫返回 0，v0.6 是 argmax 严格相等返回 1）
    assert.equal(metrics.top1Overlap({}, {}), 0);
    assert.equal(metrics.top1Hit({}, {}), 1);

    // Top1：实际分布只剩零份额标签时同样分歧 —— v0.4 的实际侧只取 share>0（集合为空 → 0），
    // v0.6 的 argmax 不做过滤（两侧都是 A → 1）
    assert.equal(metrics.top1Overlap({ A: 0.5, B: 0.5 }, { A: 0 }), 0);
    assert.equal(metrics.top1Hit({ A: 0.5, B: 0.5 }, { A: 0 }), 1);
  });

  test('top1 重叠比与 top1Hit 在常规样本上同值（口径等价区，差异只在 Top3 与空边界）', () => {
    const predicted = { A: 0.6, B: 0.4 };
    const actual = { A: 0.5, B: 0.5 };
    assert.equal(metrics.top1Overlap(predicted, actual), 1);
    assert.equal(metrics.top1Hit(predicted, actual), 1);
  });

  test('signTestPValue：双侧精确二项，与手算对照', () => {
    // 7 正 3 负（n=10）：尾和 = (C(10,7)+C(10,8)+C(10,9)+C(10,10))/2^10 = 176/1024
    const diffs = [1, -1, 1, 1, -1, 1, 1, 1, -1, 1];
    const result = metrics.signTestPValue(diffs);
    assert.equal(result.n, 10);
    assert.equal(result.positive, 7);
    assert.equal(result.negative, 3);
    assert.ok(Math.abs(result.p - (2 * 176) / 1024) < 1e-12, `p=${result.p}`);

    // 全正 10 例：p = 2 * (1/1024)
    const allPositive = metrics.signTestPValue(Array.from({ length: 10 }, () => 1));
    assert.ok(Math.abs(allPositive.p - 2 / 1024) < 1e-12, `p=${allPositive.p}`);
  });

  test('signTestPValue：零差丢弃，全零时 p=1', () => {
    const result = metrics.signTestPValue([0, 0, 1, -1]);
    assert.equal(result.n, 2, '零差必须丢弃');
    assert.equal(result.positive, 1);
    assert.equal(result.negative, 1);
    assert.ok(Math.abs(result.p - 1) < 1e-12);

    const allZero = metrics.signTestPValue([0, 0, 0]);
    assert.equal(allZero.n, 0);
    assert.equal(allZero.p, 1);
  });

  test('变异守卫：metrics 内没有第二份 JS/余弦实现', () => {
    const source = stripComments(readModelSource('metrics.ts'));
    assert.match(
      source,
      /from '\.\.\/index\/similarity\.js'/,
      '必须从既有 similarity 模块导入 JS/余弦',
    );
    assert.doesNotMatch(source, /Math\.log2/, '不得在 metrics 内重写 JS 散度公式');
    assert.doesNotMatch(
      source,
      /function\s+cosineSimilarity\s*\(/,
      '不得在 metrics 内另定义一份余弦相似度',
    );
  });
});

describe('折内词表', () => {
  test('词表计数只来自训练折，eval 折未见 token 映 0', () => {
    const trainFold = [
      ['a', 'x'],
      ['a', 'y'],
    ];
    const evalFold = [['a', 'z']];
    const result = buildFoldVocabulary([trainFold, evalFold], { minCount: 1 });
    const trainVocab = result.foldVocab[0]!;
    // 'z' 只在 eval 折出现，绝不能进入训练折词表
    assert.ok(!trainVocab.featureNames.includes('z'));
    // 'a' 在训练折 2 个样本中恒定出现 → 按 v0.6 口径（count < 样本数）剔除
    assert.ok(!trainVocab.featureNames.includes('a'));
    assert.deepEqual(trainVocab.featureNames, ['x', 'y']);
    // eval 样本向量化后全部为 0（未知 token 不插补）
    assert.deepEqual(vectorize(evalFold[0]!, trainVocab), [0, 0]);
  });

  test('minCount 外置为参数，按名排序', () => {
    const samples = [
      ['b', 'c'],
      ['a'],
      ['c'],
    ];
    const loose = buildVocabulary(samples, { minCount: 1 });
    const strict = buildVocabulary(samples, { minCount: 2 });
    assert.deepEqual(loose.featureNames, ['a', 'b', 'c']);
    assert.deepEqual(strict.featureNames, ['c'], '只出现 1 次的 token 在 minCount=2 时被剔除');
    assert.equal(loose.counts['c'], 2);
  });

  test('向量值按 token 出现次数计，词表计数按样本数计', () => {
    const samples = [['a', 'a']];
    const vocab = buildVocabulary(samples, { minCount: 1, dropConstant: false });
    assert.equal(vocab.counts['a'], 1, '同一样本内重复 token 只计一次样本数');
    assert.deepEqual(vectorize(['a', 'a'], vocab), [2], '向量化按出现次数计值');
  });

  test('OOF 词表 ≠ 最终词表被显式返回，不做静默统一', () => {
    const fold0 = [
      ['t', 'u'],
      ['t', 'v'],
    ];
    const fold1 = [['w'], ['x']];
    const result = buildFoldVocabulary([fold0, fold1], { minCount: 1 });
    assert.equal(result.foldVocab.length, 2);
    // 't' 在第 0 折内恒定 → 折内词表剔除；在全部样本上不恒定 → 最终词表保留
    assert.ok(!result.foldVocab[0]!.featureNames.includes('t'));
    assert.ok(!result.foldVocab[1]!.featureNames.includes('t'));
    assert.ok(result.finalVocab.featureNames.includes('t'));
    assert.ok(result.skew[0]!.onlyInFinal.includes('t'));
    assert.deepEqual(result.skew[0]!.onlyInFold, []);
  });
});
