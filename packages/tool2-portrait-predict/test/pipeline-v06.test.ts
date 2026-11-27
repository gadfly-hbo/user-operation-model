/**
 * v0.6 六阶段管线单测（P2-6）。
 *
 * 覆盖 M08 的验收要点：
 * - 六阶段各自可跑（阶段 01／02／03／04／05／06）；
 * - folds 是**冻结输入**（只读校验，不重生成）；
 * - 账号均值基线只用训练折（折内独立复算 V12）；
 * - 符号检验门槛生效（选择分层 PASS／FAIL_SIGNIFICANCE／FAIL_NOT_POSITIVE）；
 * - fail-closed 校验含 V9（连跑字节一致）与 V12。
 *
 * 外加 §9.2 三层守卫（类型层编译期断言 + 投影层白名单 + 行为层变异），
 * 以及 v0.4／v0.6 两套 Top-N 口径的术语隔离。
 *
 * 所有夹具均为**合成数据**，不含任何真实商品／人群样本。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  V06_FORBIDDEN_FIELDS,
  V06_TARGET_DIMENSIONS,
  type V06CompliantProductInput,
  type V06Sample,
} from '../src/pipeline/v06/lib/types.js';
import {
  V06_COMPLIANT_GROUPS,
  V06_FEATURE_GROUPS,
  buildV06Matrix,
  extractV06Tokens,
  normalizeV06Fabric,
  projectV06CompliantInput,
} from '../src/pipeline/v06/lib/features-v06.js';
import {
  V06_ALPHAS,
  normalizeV06Distribution,
  predictV06Dimension,
  trainV06Dimension,
  v06AccountMeanBaseline,
} from '../src/pipeline/v06/lib/train-v06.js';
import { prepareV06Dataset } from '../src/pipeline/v06/01-prepare-dataset.js';
import { loadFrozenV06Folds, validateV06Folds } from '../src/pipeline/v06/02-load-folds.js';
import {
  V06_ABLATION_LADDER,
  runV06Ablation,
  type V06AblationResult,
  type V06Config,
} from '../src/pipeline/v06/03-run-ablation.js';
import {
  V06_VARIANTS,
  selectV06FinalConfig,
  trainV06FinalModel,
  v06CoefficientHash,
  v06CoefficientRegion,
} from '../src/pipeline/v06/04-select-final.js';
import { buildV06BaselineComparison, evaluateV06 } from '../src/pipeline/v06/05-evaluate.js';
import { validateV06 } from '../src/pipeline/v06/06-validate.js';
import { jsSimilarity } from '@uom/core/model/metrics';

// ---------------------------------------------------------------------------
// §9.2 编译期守卫
// ---------------------------------------------------------------------------

/** 若任一禁读字段出现在合规输入类型里，下面这行会编译失败。 */
type AssertNoForbiddenField<TInput> = Extract<
  (typeof V06_FORBIDDEN_FIELDS)[number],
  keyof TInput
> extends never
  ? true
  : never;
export const _v06CompliantInputHasNoForbiddenField: AssertNoForbiddenField<V06CompliantProductInput> =
  true;

// ---------------------------------------------------------------------------
// 合成夹具
// ---------------------------------------------------------------------------

const DIM_LABELS: Record<string, [string, string]> = {
  预测性别: ['男', '女'],
  预测年龄: ['[18,24]', '[25,29]'],
  预测购买力: ['L1', 'L2'],
  预测城市等级: ['1', '2'],
  大服饰策略人群: ['潮流人群', '大众实用'],
  预测人生阶段: ['单身期', '已婚未育期'],
};

/** 合成一个样本：属性确定、六个维度的画像份额确定（男份额随序号变化）。 */
function syntheticSample(index: number): V06Sample {
  const input: V06CompliantProductInput = {
    sku: `S${String(index).padStart(3, '0')}`,
    fit: index % 2 === 0 ? '宽松型' : '修身型',
    fabric: index % 3 === 0 ? '棉' : '牛仔',
    category: index % 2 === 0 ? '外套' : '上衣',
    subcategory: index % 4 === 0 ? '棉外套' : '休闲外套',
    season: 'Q4',
    productAttribute: index % 5 === 0 ? '新品' : '老品',
    ipCollab: '',
    specialFunctionMaterial: index % 3 === 0 ? '防护' : '',
  };
  const maleShare = 0.1 + 0.05 * (index % 7);
  const portraits = {} as V06Sample['portraits'];
  for (const dimension of V06_TARGET_DIMENSIONS) {
    const [first, second] = DIM_LABELS[dimension]!;
    const share = dimension === '预测性别' ? maleShare : 0.3 + 0.02 * (index % 5);
    portraits[dimension] = { [first]: share, [second]: 1 - share };
  }
  return { sku: input.sku, input, portraits };
}

/** n 个合成样本（按款号升序，和归档的样本顺序契约一致）。 */
function syntheticSamples(n: number): V06Sample[] {
  return Array.from({ length: n }, (_, index) => syntheticSample(index)).sort((a, b) =>
    a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0,
  );
}

/** 把样本均分成 k 折的冻结 folds。 */
function syntheticFolds(samples: readonly V06Sample[], k: number): string[][] {
  const folds: string[][] = Array.from({ length: k }, () => []);
  samples.forEach((sample, index) => folds[index % k]!.push(sample.sku));
  return folds;
}

/** 读取管线源码，用于结构型守卫（去掉注释与字符串字面量后再检查）。 */
function readPipelineSource(relativePath: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../../src/pipeline/v06', relativePath), 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function stripStringLiterals(source: string): string {
  return source.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

// ---------------------------------------------------------------------------
// 特征抽取与 §9.2 守卫
// ---------------------------------------------------------------------------

describe('v0.6 合规特征抽取', () => {
  test('特征组只引用白名单客观属性字段', () => {
    const whitelist = new Set<string>([
      'fit',
      'fabric',
      'category',
      'subcategory',
      'season',
      'productAttribute',
      'ipCollab',
      'specialFunctionMaterial',
    ]);
    for (const [group, specs] of Object.entries(V06_FEATURE_GROUPS)) {
      for (const spec of specs) {
        assert.ok(whitelist.has(spec.field), `特征组 ${group} 引用了非白名单字段 ${spec.field}`);
        assert.notEqual(spec.field, 'sku');
      }
    }
    assert.deepEqual([...V06_COMPLIANT_GROUPS].sort(), [
      'attr',
      'cat',
      'craft',
      'fabric',
      'fit',
      'ip',
      'season',
      'subcat',
    ]);
  });

  test('不合规的归档特征组（FAB 关键词／交叉／性别修正／人工标签组）不出现', () => {
    for (const banned of ['kw', 'combo', 'gender', 'tags']) {
      assert.ok(!V06_COMPLIANT_GROUPS.includes(banned), `合规特征组不得包含 ${banned}`);
    }
  });

  test('投影层丢弃人工字段', () => {
    const raw = {
      sku: 'S001',
      fit: '宽松型',
      fabric: '棉',
      category: '外套',
      fab: '人工卖点文本',
      mindProduct: '心智产品',
      memoryPoint: '记忆点',
      groupTag: '群组打标',
      genderCorrected: '女',
    } as unknown as Parameters<typeof projectV06CompliantInput>[0];
    const projected = projectV06CompliantInput(raw);
    for (const forbidden of V06_FORBIDDEN_FIELDS) {
      assert.ok(!(forbidden in projected), `投影结果不得包含人工字段 ${forbidden}`);
    }
    assert.equal(projected.fit, '宽松型');
    assert.equal(projected.sku, 'S001');
  });

  test('行为层：注入人工字段不改变特征', () => {
    const groups = new Set(V06_COMPLIANT_GROUPS);
    const clean = projectV06CompliantInput({ sku: 'S001', fit: '宽松型', fabric: '牛仔' });
    const dirty = projectV06CompliantInput({
      sku: 'S001',
      fit: '宽松型',
      fabric: '牛仔',
      fab: '完全不同的人工卖点',
      mindProduct: '心智',
      memoryPoint: '记忆',
      groupTag: '群组',
      genderCorrected: '男',
    } as unknown as Parameters<typeof projectV06CompliantInput>[0]);
    assert.deepEqual([...extractV06Tokens(dirty, groups)], [...extractV06Tokens(clean, groups)]);
  });

  test('结构守卫：抽取器源码不访问任何人工字段', () => {
    const source = stripStringLiterals(stripComments(readPipelineSource('lib/features-v06.ts')));
    for (const forbidden of V06_FORBIDDEN_FIELDS) {
      // 用词边界匹配属性访问（`.fabric` 不应被 `.fab` 误伤）
      const pattern = new RegExp(`\\.${forbidden}\\b`);
      assert.ok(!pattern.test(source), `抽取器源码不得访问人工字段 ${forbidden}`);
    }
  });

  test('面料归一化沿用归档词典', () => {
    assert.equal(normalizeV06Fabric('棉'), 'cotton');
    assert.equal(normalizeV06Fabric('牛仔'), 'denim');
    assert.equal(normalizeV06Fabric(''), 'unknown');
    assert.equal(normalizeV06Fabric('无法归类的面料'), 'other');
  });

  test('词表规则：低频词剔除、恒定词剔除、特征名按字典序', () => {
    const samples = syntheticSamples(6);
    const groups = new Set(['fit', 'fabric']);
    const { matrix, featureNames } = buildV06Matrix(samples, samples, groups, 3);
    assert.ok(featureNames.length > 0);
    assert.deepEqual([...featureNames].sort(), featureNames);
    // 恒定词（season=Q4 出现在全部样本）不得进入词表
    assert.ok(!featureNames.includes('season_Q4'));
    for (const row of matrix) {
      assert.equal(row.length, featureNames.length);
    }
  });
});

// ---------------------------------------------------------------------------
// 训练与基线
// ---------------------------------------------------------------------------

describe('v0.6 训练与基线', () => {
  test('逐维度训练返回标签、alpha 与逐标签模型', () => {
    const samples = syntheticSamples(9);
    const groups = new Set(V06_COMPLIANT_GROUPS);
    const fit = trainV06Dimension('预测性别', samples, groups);
    // 标签按字典序（码位序）排序，与归档一致
    assert.deepEqual(fit.labels, ['女', '男']);
    assert.ok(V06_ALPHAS.includes(fit.alpha));
    assert.equal(fit.perLabel.length, fit.labels.length);
    assert.equal(fit.perLabel[0]!.weights.length, fit.featureNames.length);
  });

  test('预测输出是归一化的有限分布', () => {
    const samples = syntheticSamples(9);
    const groups = new Set(V06_COMPLIANT_GROUPS);
    const fit = trainV06Dimension('预测性别', samples, groups);
    const predictions = predictV06Dimension(fit, groups, samples.slice(0, 3));
    assert.equal(predictions.length, 3);
    for (const prediction of predictions) {
      const total = Object.values(prediction).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 1) < 1e-12);
      assert.ok(Object.values(prediction).every((value) => Number.isFinite(value) && value >= 0));
    }
  });

  test('负值截断归一化：全负时退化为均匀分布', () => {
    assert.deepEqual(normalizeV06Distribution(['a', 'b'], [-1, -2]), { a: 0.5, b: 0.5 });
    assert.deepEqual(normalizeV06Distribution(['a', 'b'], [1, 3]), { a: 0.25, b: 0.75 });
  });

  test('账号均值基线只用传入的训练样本', () => {
    const samples = syntheticSamples(6);
    const subset = samples.slice(0, 3);
    const baseline = v06AccountMeanBaseline('预测性别', subset);
    const expected =
      subset.reduce((sum, sample) => sum + (sample.portraits['预测性别']!['男'] ?? 0), 0) /
      subset.length;
    assert.ok(Math.abs((baseline['男'] ?? 0) - expected) < 1e-12);
    const global = v06AccountMeanBaseline('预测性别', samples);
    assert.notEqual(baseline['男'], global['男']);
  });
});

// ---------------------------------------------------------------------------
// 阶段 01：解析冻结 intake（fail-closed）
// ---------------------------------------------------------------------------

describe('阶段 01 prepare-dataset', () => {
  test('SKU 两侧不一致即 fail-closed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-'));
    const portraitDir = join(dir, 'raw-portraits');
    mkdirSync(portraitDir, { recursive: true });
    writeFileSync(
      join(portraitDir, 'S001_正.md'),
      ['| 标签类型 | 标签 | 占比 |', '|---|---|---|', '| 预测性别 | 女 | 60% |', '| 预测性别 | 男 | 40% |', ''].join(
        '\n',
      ),
      'utf8',
    );
    await assert.rejects(
      () =>
        prepareV06Dataset({
          portraitDir,
          productInfoXlsx: join(dir, 'missing.xlsx'),
        }),
      /ENOENT|不存在|无法读取|无法解析/,
    );
  });
});

// ---------------------------------------------------------------------------
// 阶段 02：冻结 folds（只读，不重生成）
// ---------------------------------------------------------------------------

describe('阶段 02 load-folds', () => {
  test('读取冻结 folds 且不修改源文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-folds-'));
    const path = join(dir, 'folds.json');
    const doc = {
      schema_version: 1,
      method: 'deterministic_stratified_5_fold',
      stratify_key: 'categoryGroup x genderCorrected',
      seed: 20260911,
      k: 2,
      fold_sizes: [2, 2],
      folds: [
        ['S000', 'S002'],
        ['S001', 'S003'],
      ],
    };
    writeFileSync(path, JSON.stringify(doc, null, 1), 'utf8');
    const before = statSync(path);
    const loaded = loadFrozenV06Folds(path);
    assert.equal(loaded.k, 2);
    assert.deepEqual(loaded.folds, doc.folds);
    const after = statSync(path);
    assert.equal(before.mtimeMs, after.mtimeMs);
    assert.equal(before.size, after.size);
  });

  test('校验出重叠、漏覆盖与不均衡', () => {
    const samples = syntheticSamples(4);
    const skus = samples.map((sample) => sample.sku);
    const good = {
      schemaVersion: 1,
      method: 'deterministic_stratified_5_fold',
      stratifyKey: 'categoryGroup x genderCorrected',
      seed: 20260911,
      k: 2,
      foldSizes: [2, 2],
      folds: [skus.slice(0, 2), skus.slice(2, 4)],
    };
    assert.deepEqual(validateV06Folds(good, skus), []);

    const overlapping = { ...good, folds: [skus.slice(0, 3), skus.slice(2, 4)] };
    assert.ok(validateV06Folds(overlapping, skus).length > 0);

    const missing = { ...good, folds: [skus.slice(0, 2), skus.slice(2, 3)] };
    assert.ok(validateV06Folds(missing, skus).length > 0);

    const unbalanced = { ...good, folds: [[skus[0]!], skus.slice(1, 4)] };
    assert.ok(validateV06Folds(unbalanced, skus).length > 0);
  });

  test('结构守卫：阶段 02 不含任何写文件路径（folds 不重生成）', () => {
    const source = stripStringLiterals(stripComments(readPipelineSource('02-load-folds.ts')));
    assert.ok(!source.includes('writeFileSync'));
    assert.ok(!source.includes('mkdirSync'));
    assert.ok(!source.includes('rmSync'));
  });
});

// ---------------------------------------------------------------------------
// 阶段 03：消融阶梯 + 折内基线
// ---------------------------------------------------------------------------

describe('阶段 03 run-ablation', () => {
  test('逐配置产出逐维指标与宏平均', () => {
    const samples = syntheticSamples(10);
    const folds = syntheticFolds(samples, 5);
    const results = runV06Ablation(samples, folds, V06_ABLATION_LADDER.slice(0, 2));
    assert.equal(results.length, 2);
    for (const result of results) {
      for (const dimension of V06_TARGET_DIMENSIONS) {
        const metrics = result.perDimension[dimension]!;
        assert.equal(metrics.n, samples.length);
        assert.ok(Math.abs(metrics.jsLift - (metrics.modelJs - metrics.baseJs)) < 1e-12);
        assert.equal(metrics.jsLiftSign.n, metrics.jsLiftSign.positive + metrics.jsLiftSign.negative);
      }
      assert.equal(result.rows.length, samples.length * V06_TARGET_DIMENSIONS.length);
    }
  });

  test('基线是折内基线：评估折的基线不等于全量基线', () => {
    const samples = syntheticSamples(10);
    const folds = syntheticFolds(samples, 5);
    const result = runV06Ablation(samples, folds, V06_ABLATION_LADDER.slice(0, 1))[0]!;
    const fold = 0;
    const trainSamples = samples.filter((sample) => !folds[fold]!.includes(sample.sku));
    const foldBaseline = v06AccountMeanBaseline('预测性别', trainSamples);
    const globalBaseline = v06AccountMeanBaseline('预测性别', samples);
    assert.notEqual(foldBaseline['男'], globalBaseline['男']);

    const row = result.rows.find(
      (item) => item.fold === fold && item.dimension === '预测性别',
    )!;
    const actual = samples.find((sample) => sample.sku === row.sku)!;
    const expectedJs = jsSimilarity(foldBaseline, actual.portraits['预测性别']!);
    assert.ok(Math.abs(row.baseJs - expectedJs) < 1e-12, '折内基线必须只用训练折样本');
  });
});

// ---------------------------------------------------------------------------
// 阶段 04：选择与最终模型
// ---------------------------------------------------------------------------

describe('阶段 04 select-final', () => {
  function fakeResult(
    name: string,
    jsLift: number,
    allPositive: boolean,
    allSignificant: boolean,
  ): V06AblationResult {
    // allPositive / allSignificant 是**门槛分类标志**（合成夹具，不参与数值一致性推导）
    const perDimension = {} as V06AblationResult['perDimension'];
    for (const dimension of V06_TARGET_DIMENSIONS) {
      perDimension[dimension] = {
        n: 10,
        modelJs: 0.9,
        baseJs: 0.8,
        jsLift,
        modelCos: 0.9,
        baseCos: 0.8,
        cosLift: jsLift,
        modelMae: 0.1,
        baseMae: 0.2,
        maeReduction: 0.1,
        modelTop1: 0.5,
        baseTop1: 0.5,
        top1Lift: 0,
        modelTop3: 1,
        baseTop3: 1,
        jsLiftSign: { p: allSignificant ? 0.001 : 0.4, positive: 8, negative: 2, n: 10 },
        cosLiftSign: { p: allSignificant ? 0.001 : 0.4, positive: 8, negative: 2, n: 10 },
      };
    }
    return {
      config: { name, groups: ['fit'] },
      perDimension,
      macro: {
        modelJs: 0.9,
        baseJs: 0.8,
        jsLift,
        modelCos: 0.9,
        baseCos: 0.8,
        cosLift: jsLift,
        modelMae: 0.1,
        baseMae: 0.2,
        maeReduction: 0.1,
        modelTop1: 0.5,
        baseTop1: 0.5,
        weightedBusinessJsLift: jsLift,
        allDimensionsJsPositive: allPositive,
        allDimensionsJsSignificant: allSignificant,
      },
      foldStability: {},
      featureCounts: {},
      rows: [],
    };
  }

  test('优先选「全为正且全部显著」的候选', () => {
    const selection = selectV06FinalConfig([
      fakeResult('a', 0.01, true, false),
      fakeResult('b', 0.02, true, true),
      fakeResult('c', 0.05, true, true),
    ]);
    assert.equal(selection.winner.name, 'c');
    assert.equal(selection.gate, 'PASS');
  });

  test('无显著候选时退到「全为正」并如实记 FAIL_SIGNIFICANCE', () => {
    const selection = selectV06FinalConfig([
      fakeResult('a', 0.01, true, false),
      fakeResult('b', 0.03, true, false),
    ]);
    assert.equal(selection.winner.name, 'b');
    assert.equal(selection.gate, 'FAIL_SIGNIFICANCE');
  });

  test('连「全为正」都没有时退到宏平均最大并记 FAIL_NOT_POSITIVE', () => {
    const selection = selectV06FinalConfig([
      fakeResult('a', 0.01, false, false),
      fakeResult('b', 0.03, false, false),
    ]);
    assert.equal(selection.winner.name, 'b');
    assert.equal(selection.gate, 'FAIL_NOT_POSITIVE');
  });

  test('strict 策略在「连全为正都没有」时 fail-closed（归档口径）', () => {
    // 归档的三级 fallback：达标 → 全为正 → 退出；strict 即保留第三级退出行为
    assert.throws(
      () =>
        selectV06FinalConfig(
          [fakeResult('a', 0.01, false, false)],
          'strict',
        ),
      /fail-closed|没有可用候选|no candidate/i,
    );
  });

  test('最终模型的系数区不含时间戳，且两次训练字节一致', () => {
    const samples = syntheticSamples(12);
    const config: V06Config = { name: 'test', groups: ['fit', 'fabric'] };
    const first = trainV06FinalModel(samples, config, { trainedAt: '2026-01-01T00:00:00.000Z' });
    const second = trainV06FinalModel(samples, config, { trainedAt: '2099-12-31T23:59:59.999Z' });
    assert.equal(v06CoefficientRegion(first), v06CoefficientRegion(second));
    assert.equal(v06CoefficientHash(first), v06CoefficientHash(second));
    assert.ok(!v06CoefficientRegion(first).includes('trainedAt'));
    assert.equal(first.provenance.sampleCount, samples.length);
    assert.equal(first.coefficients.dimensionModels.length, V06_TARGET_DIMENSIONS.length);
  });
});

// ---------------------------------------------------------------------------
// 阶段 05：评估与门槛
// ---------------------------------------------------------------------------

describe('阶段 05 evaluate', () => {
  test('门槛 1 由符号检验结果决定', () => {
    const samples = syntheticSamples(10);
    const folds = syntheticFolds(samples, 5);
    const ablation = runV06Ablation(samples, folds, V06_ABLATION_LADDER.slice(0, 2));
    const selection = selectV06FinalConfig(ablation);
    const artifact = trainV06FinalModel(samples, selection.winner);
    const metrics = evaluateV06({
      experiment: 'test',
      sampleCount: samples.length,
      selection,
      ablation,
      variants: ablation,
      finalModel: {
        alphas: Object.fromEntries(
          artifact.coefficients.dimensionModels.map((model) => [model.labelType, model.alpha]),
        ),
        featureCounts: Object.fromEntries(
          artifact.coefficients.dimensionModels.map((model) => [
            model.labelType,
            model.featureNames.length,
          ]),
        ),
      },
      controlConfig: V06_ABLATION_LADDER[0],
    });
    assert.equal(metrics.sampleCount, samples.length);
    assert.ok('gate1_all_dims_positive_significant' in metrics.acceptance);
    const gate1 = metrics.acceptance['gate1_all_dims_positive_significant']!;
    assert.equal(gate1.pass, selection.gate === 'PASS');
    const comparison = buildV06BaselineComparison(metrics);
    assert.ok('perDimension' in comparison);
  });
});

// ---------------------------------------------------------------------------
// 阶段 06：fail-closed 校验
// ---------------------------------------------------------------------------

describe('阶段 06 validate', () => {
  function buildValidationInput() {
    const samples = syntheticSamples(10);
    const folds = syntheticFolds(samples, 5);
    const ablation = runV06Ablation(samples, folds, V06_ABLATION_LADDER.slice(0, 2));
    const selection = selectV06FinalConfig(ablation);
    const artifact = trainV06FinalModel(samples, selection.winner);
    const metrics = evaluateV06({
      experiment: 'test',
      sampleCount: samples.length,
      selection,
      ablation,
      variants: ablation,
      finalModel: {
        alphas: Object.fromEntries(
          artifact.coefficients.dimensionModels.map((model) => [model.labelType, model.alpha]),
        ),
        featureCounts: Object.fromEntries(
          artifact.coefficients.dimensionModels.map((model) => [
            model.labelType,
            model.featureNames.length,
          ]),
        ),
      },
    });
    return { samples, folds, ablation, selection, artifact, metrics };
  }

  test('校验项覆盖 V1–V12，V9 与 V12 在列', () => {
    const input = buildValidationInput();
    const checks = validateV06({
      dataset: {
        schemaVersion: 1,
        experiment: 'test',
        targetDimensions: V06_TARGET_DIMENSIONS,
        samples: input.samples,
        intake: {
          portraitFileCount: 0,
          positivePortraitCount: 0,
          productInfoSha256: '',
          checksumEntries: 0,
          checksumMismatches: 0,
        },
      },
      folds: {
        schemaVersion: 1,
        method: 'deterministic_stratified_5_fold',
        stratifyKey: 'categoryGroup x genderCorrected',
        seed: 20260911,
        k: 5,
        foldSizes: input.folds.map((fold) => fold.length),
        folds: input.folds,
      },
      selection: input.selection,
      artifact: input.artifact,
      metrics: input.metrics,
      rerunFinalTraining: () => trainV06FinalModel(input.samples, input.selection.winner),
    });
    const ids = checks.map((check) => check.id);
    assert.ok(ids.includes('V9'));
    assert.ok(ids.includes('V12'));
    assert.ok(checks.some((check) => check.result === 'pass'));
  });

  test('V9：重跑结果不一致即 fail', () => {
    const input = buildValidationInput();
    const checks = validateV06({
      dataset: {
        schemaVersion: 1,
        experiment: 'test',
        targetDimensions: V06_TARGET_DIMENSIONS,
        samples: input.samples,
        intake: {
          portraitFileCount: 0,
          positivePortraitCount: 0,
          productInfoSha256: '',
          checksumEntries: 0,
          checksumMismatches: 0,
        },
      },
      folds: {
        schemaVersion: 1,
        method: 'deterministic_stratified_5_fold',
        stratifyKey: 'categoryGroup x genderCorrected',
        seed: 20260911,
        k: 5,
        foldSizes: input.folds.map((fold) => fold.length),
        folds: input.folds,
      },
      selection: input.selection,
      artifact: input.artifact,
      metrics: input.metrics,
      rerunFinalTraining: () => {
        const tampered = trainV06FinalModel(input.samples, input.selection.winner);
        tampered.coefficients.dimensionModels[0]!.alpha = 999;
        return tampered;
      },
    });
    assert.equal(checks.find((check) => check.id === 'V9')?.result, 'fail');
  });
});

// ---------------------------------------------------------------------------
// 术语隔离：v0.4 重叠比 与 v0.6 argmax 两套口径
// ---------------------------------------------------------------------------

describe('Top-N 口径隔离（v0.4 重叠比 vs v0.6 argmax）', () => {
  test('Top-1：实际分布只有零份额标签时两套口径分歧（重叠比 0 / argmax 命中 1）', async () => {
    const metrics = await import('@uom/core/model/metrics');
    const predicted = { a: 0.5, b: 0.3, c: 0.2 };
    assert.equal(metrics.top1Overlap(predicted, { a: 0 }), 0);
    assert.equal(metrics.top1Hit(predicted, { a: 0 }), 1);
  });

  test('Top-3：方向不对称时两套口径分歧（重叠比 2/3 / argmax 命中 1）', async () => {
    const metrics = await import('@uom/core/model/metrics');
    const predicted = { a: 0.5, b: 0.3, z: 0.2 };
    const actual = { a: 0.4, b: 0.3, c: 0.3 };
    assert.equal(metrics.top3Overlap(predicted, actual), 2 / 3);
    assert.equal(metrics.top3Hit(predicted, actual), 1);
  });
});
