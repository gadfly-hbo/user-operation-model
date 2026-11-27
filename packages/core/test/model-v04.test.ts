import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPLIANT_FEATURE_GROUPS,
  COMPLIANT_FORBIDDEN_FIELDS,
  V04_COMPLIANT_FEATURE_SET,
  extractCompliantBaseFeatures,
  projectCompliantInput,
  type V04CompliantProductInput,
} from '../src/model/features-v04-compliant.js';
import {
  FABRIC_KEYWORDS,
  FIT_TYPE_CATEGORIES,
  FUNCTION_KEYWORDS,
  SCENE_KEYWORDS,
  STYLE_KEYWORDS,
  V04_COMBINATION_FEATURE_GROUPS,
  V04_ORIGINAL_FEATURE_SET,
  addCombinationFeatures,
  categorizeFitType,
  extractBaseSupervisedFeatures,
  extractKeywords,
  extractSupervisedFeatures,
  generateCombinationFeatures,
  getFeatureGroup,
  mergeCounts,
  selectFrequentCombinationFeatures,
  type V04OriginalProductInput,
} from '../src/model/features-v04.js';
import {
  CALIBRATION_TEMPERATURE_GRID,
  SUPERVISED_TARGET_DIMENSIONS,
  applyTemperatures,
  calibrateTemperatures,
  computeDimensionScores,
  predictPortrait,
  softmaxWithTemperature,
  trainSupervisedPortraitModel,
  type V04PortraitModel,
} from '../src/model/train-v04.js';
import { evaluateHoldout } from '../src/model/holdout-eval.js';
import {
  assertTargetAlignment,
  buildTargetsByDimension,
  loadSamplePackage,
  parsePlatformPortraitCsv,
  readJsonl,
  type SamplePackage,
} from '../src/model/sample-package.js';

/**
 * `packages/core/src/model/**` 的 v0.4 管线单测（P2-4 / P2-5）。
 *
 * 覆盖：
 * - 特征抽取（词典外置、版型归类、关键词计数、交叉特征选择与生成）；
 * - 训练与预测（逐维逐标签回归、温度 softmax、Top-N 截断、closed 维再归一）；
 * - 跨期留出评估（Top1/Top3 重叠比、Share MAE、逐维均值后宏平均）；
 * - 样本包读取（最小 JSONL reader、CSV 引号处理、目标份额索引对齐 fail-closed）；
 * - §9.2 合规守卫（类型层 + 行为层 + 结构层）。
 *
 * 期望特征向量取自归档 work-package 第 1 行样本（`109326100005`），
 * 由归档 `extractBaseSupervisedFeatures` 独立算出后固化在此。
 */

/** 读取模型模块的 TypeScript 源码，用于结构型变异守卫。 */
function readModelSource(fileName: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../../src/model', fileName), 'utf8');
}

/** 去掉注释，只留可执行代码（结构守卫不能被文档里的历史名词误伤）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** 去掉字符串字面量（避免黑名单常量里的字段名误伤结构守卫）。 */
function stripStringLiterals(source: string): string {
  return source.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

// ---------------------------------------------------------------------------
// §9.2 编译期守卫：合规输入类型里不允许出现任何人工字段
// ---------------------------------------------------------------------------

type ForbiddenField = 'fab' | 'mentalProduct' | 'memoryPoint' | 'groupTag';
/** 若任一禁读字段出现在合规输入类型里，下面这行会编译失败（never 不可赋 true）。 */
type AssertNoForbiddenField<TInput> = Extract<ForbiddenField, keyof TInput> extends never ? true : never;
export const _compliantInputHasNoForbiddenField: AssertNoForbiddenField<V04CompliantProductInput> = true;

// ---------------------------------------------------------------------------
// 合成数据集
// ---------------------------------------------------------------------------

const SYNTH_DIM = '预测性别';

/** 4 个样本，标签份额固定（男 0.3 / 女 0.7），版型与面料各异。 */
const SYNTH_SAMPLES: V04OriginalProductInput[] = [
  { skuId: 'S1', fitType: '修身型', fabric: '全棉', fab: '修身显瘦' },
  { skuId: 'S2', fitType: '宽松型', fabric: '牛仔', fab: '宽松休闲' },
  { skuId: 'S3', fitType: '合体型', fabric: '羊毛', fab: '通勤商务' },
  { skuId: 'S4', fitType: 'A型', fabric: '真丝', fab: '优雅法式' },
];

const SYNTH_TARGETS = new Map<string, Map<string, number[]>>([
  [
    SYNTH_DIM,
    new Map<string, number[]>([
      ['男', [0.3, 0.3, 0.3, 0.3]],
      ['女', [0.7, 0.7, 0.7, 0.7]],
    ]),
  ],
]);

function synthHoldout(): SamplePackage {
  const products = SYNTH_SAMPLES.map((s) => ({
    skuId: s.skuId,
    sourceProductKey: s.skuId,
    fitType: s.fitType,
    fabric: s.fabric,
    fab: s.fab,
  }));
  const portraitRows = products.flatMap((p) => [
    { skuId: p.skuId!, sourceProductKey: p.sourceProductKey!, labelType: SYNTH_DIM, label: '男', share: 0.2, tgi: null },
    { skuId: p.skuId!, sourceProductKey: p.sourceProductKey!, labelType: SYNTH_DIM, label: '女', share: 0.8, tgi: null },
  ]);
  return { path: '<synthetic>', products, portraitRows };
}

describe('v0.4 特征抽取：词典外置 + 基础特征', () => {
  test('五本词典是外置的冻结配置对象（可直接断言条目）', () => {
    assert.deepEqual(FIT_TYPE_CATEGORIES['slim'], ['修身', '紧身', '收腰', 'X型']);
    assert.deepEqual(FIT_TYPE_CATEGORIES['loose'], ['宽松', '阔腿', '直筒', '小宽松', '特宽松']);
    assert.deepEqual(FIT_TYPE_CATEGORIES['regular'], ['合体', '合体型']);
    assert.deepEqual(FIT_TYPE_CATEGORIES['a_line'], ['A型', 'A字']);
    assert.deepEqual(FIT_TYPE_CATEGORIES['h_line'], ['H型']);
    assert.deepEqual(FIT_TYPE_CATEGORIES['o_line'], ['O型']);
    // 词典条目总数（归档原样搬运，任何增删都会被这条断言抓住）
    assert.equal(FABRIC_KEYWORDS.length, 28);
    assert.equal(STYLE_KEYWORDS.length, 61);
    assert.equal(FUNCTION_KEYWORDS.length, 14);
    assert.equal(SCENE_KEYWORDS.length, 7);
    assert.equal(FABRIC_KEYWORDS[0]!.keyword, '棉');
    assert.equal(FABRIC_KEYWORDS[0]!.canonical, 'fabric_cotton');
  });

  test('版型归类命中首个匹配分组，未命中归 other', () => {
    assert.equal(categorizeFitType('修身型'), 'slim');
    assert.equal(categorizeFitType('紧身型'), 'slim');
    assert.equal(categorizeFitType('宽松阔腿'), 'loose');
    assert.equal(categorizeFitType('特宽松型'), 'loose');
    assert.equal(categorizeFitType('合体型'), 'regular');
    assert.equal(categorizeFitType('A型'), 'a_line');
    assert.equal(categorizeFitType('H型'), 'h_line');
    assert.equal(categorizeFitType('O型'), 'o_line');
    assert.equal(categorizeFitType('未知版型'), 'other');
  });

  test('关键词命中按 canonical 计数（多关键词命中同一 canonical 时累加）', () => {
    assert.deepEqual(extractKeywords('莱赛尔天丝', FABRIC_KEYWORDS), { fabric_lyocell: 2 });
    assert.deepEqual(extractKeywords('棉+氨纶', FABRIC_KEYWORDS), { fabric_cotton: 1, fabric_spandex: 1 });
    assert.deepEqual(extractKeywords('什么都没有', FABRIC_KEYWORDS), {});
  });

  test('mergeCounts 同名键累加', () => {
    assert.deepEqual(mergeCounts({ a: 1, b: 2 }, { b: 3, c: 4 }), { a: 1, b: 5, c: 4 });
  });

  test('work-package 第 1 行样本的基础特征向量与归档一致（手算期望）', () => {
    // 归档 work-package/train/product_attributes.jsonl 第 1 行：109326100005
    const sample: V04OriginalProductInput = {
      skuId: '109326100005',
      sourceProductKey: '109326100005',
      fitType: '修身型',
      fabric: '混交+氨纶',
      fab:
        '1.荡领短袖T恤\r\n2.薄感粘棉腈弹1X1罗纹\r\n3.自然垂坠褶皱，修饰颈线，轻松穿出慵懒高级感，' +
        '日常搭配更显品味，下摆插片分割，巧妙藏肉不臃肿，多种身材都能穿出松弛显瘦的时髦效果。',
    };
    assert.deepEqual(extractBaseSupervisedFeatures(sample), {
      fit_slim: 1,
      fabric_spandex: 1,
      fabric_blend: 1,
      fabric_cotton: 1,
      fabric_rib: 1,
      style_casual: 2,
      style_slimming: 1,
      style_premium: 1,
      style_designer: 1,
      func_drape: 1,
      scene_daily: 1,
    });
  });
});

describe('v0.4 交叉特征：只跨组、只留高频', () => {
  test('getFeatureGroup 按前缀判定组别', () => {
    assert.equal(getFeatureGroup('fit_slim', V04_COMBINATION_FEATURE_GROUPS), 'fit_');
    assert.equal(getFeatureGroup('fabric_cotton', V04_COMBINATION_FEATURE_GROUPS), 'fabric_');
    assert.equal(getFeatureGroup('unknown_x', V04_COMBINATION_FEATURE_GROUPS), null);
  });

  test('同组特征不产生交叉特征，跨组且命中名单才产出', () => {
    const base = { fit_slim: 1, fit_loose: 0, fabric_cotton: 1, style_casual: 1 };
    const combos = generateCombinationFeatures(
      base,
      new Set(['fit_slim__fabric_cotton', 'fit_slim__style_casual', 'fit_slim__fit_loose']),
      V04_COMBINATION_FEATURE_GROUPS,
    );
    assert.deepEqual(combos, { 'fit_slim__fabric_cotton': 1, 'fit_slim__style_casual': 1 });
  });

  test('selectFrequentCombinationFeatures 按样本频次过滤并排序', () => {
    const records: Record<string, number>[] = [
      { fit_slim: 1, fabric_cotton: 1 },
      { fit_slim: 1, fabric_cotton: 1 },
      { fit_slim: 1, fabric_cotton: 1 },
      { fit_slim: 1, fabric_denim: 1 },
    ];
    const names = selectFrequentCombinationFeatures(records, 3, V04_COMBINATION_FEATURE_GROUPS);
    assert.deepEqual(names, ['fit_slim__fabric_cotton']);
    // 阈值降到 1 时两个组合都留下，且按名排序
    assert.deepEqual(selectFrequentCombinationFeatures(records, 1, V04_COMBINATION_FEATURE_GROUPS), [
      'fit_slim__fabric_cotton',
      'fit_slim__fabric_denim',
    ]);
  });

  test('extractSupervisedFeatures 在无交叉特征名单时只返回基础特征', () => {
    const sample = SYNTH_SAMPLES[0]!;
    assert.deepEqual(extractSupervisedFeatures(sample, []), extractBaseSupervisedFeatures(sample));
  });

  test('addCombinationFeatures 在名单为空时原样返回', () => {
    const base = { fit_slim: 1 };
    assert.equal(addCombinationFeatures(base, [], V04_COMBINATION_FEATURE_GROUPS), base);
  });
});

describe('v0.4 训练与预测', () => {
  test('训练产出六维模型骨架（标签字典序、权重维度、alpha）', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
      alpha: 2.5,
    });
    assert.equal(model.sampleCount, 4);
    assert.equal(model.alpha, 2.5);
    assert.equal(model.dimensionModels.length, 1);
    const dim = model.dimensionModels[0]!;
    assert.equal(dim.labelType, SYNTH_DIM);
    assert.equal(dim.isClosed, true);
    assert.deepEqual(dim.labels, ['女', '男']);
    assert.equal(dim.weights.length, 2);
    assert.equal(dim.weights[0]!.length, dim.featureNames.length);
    assert.equal(dim.intercepts.length, 2);
    assert.equal(dim.featureMean.length, dim.featureNames.length);
    assert.equal(dim.featureStd.length, dim.featureNames.length);
    assert.deepEqual([...dim.featureNames], [...dim.featureNames].sort());
  });

  test('温度 softmax：温度为正时归一化，非正时退化为截断归一', () => {
    const shares = softmaxWithTemperature([1, 2, 3], 1);
    assert.equal(shares.length, 3);
    assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    assert.ok((shares[2] ?? 0) > (shares[1] ?? 0));
    const clipped = softmaxWithTemperature([-1, 0, 3], 0);
    assert.equal(clipped[0], 0);
    assert.ok(Math.abs(clipped.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  });

  test('预测链：softmax → Top-N 截断 → closed 维再归一 → 两位小数', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const rows = predictPortrait({ model, input: SYNTH_SAMPLES[0]!, featureSet: V04_ORIGINAL_FEATURE_SET });
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => Number.isFinite(row.share) && row.share >= 0));
    // closed 维再归一后份额之和 ≈ 1（每位两位小数，误差 ≤ 0.005 × 标签数）
    const total = rows.reduce((sum, row) => sum + row.share, 0);
    assert.ok(Math.abs(total - 1) <= 0.005 * rows.length, `份额和=${total}`);
    // 两位小数
    assert.ok(rows.every((row) => Math.abs(row.share * 100 - Math.round(row.share * 100)) < 1e-9));
  });

  test('Top-N 截断只保留前 N 个标签', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const rows = predictPortrait({
      model,
      input: SYNTH_SAMPLES[0]!,
      featureSet: V04_ORIGINAL_FEATURE_SET,
      outputTopNPerDimension: 1,
    });
    assert.equal(rows.length, 1);
  });

  test('温度校准在候选表内选出温度并给出逐维 MSE', () => {
    const result = calibrateTemperatures({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
      alpha: 1,
    });
    assert.ok(CALIBRATION_TEMPERATURE_GRID.includes(result.temperatures[SYNTH_DIM]!));
    assert.ok(result.perDimensionMse[SYNTH_DIM]! >= 0);
  });

  test('applyTemperatures 把温度写回对应维度', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const calibrated = applyTemperatures(model, { [SYNTH_DIM]: 0.4 });
    assert.equal(calibrated.dimensionModels[0]!.temperature, 0.4);
    assert.equal(model.dimensionModels[0]!.temperature, undefined);
  });

  test('computeDimensionScores 返回与标签数等长的得分', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const dim = model.dimensionModels[0]!;
    const scores = computeDimensionScores(dim, extractBaseSupervisedFeatures(SYNTH_SAMPLES[0]!));
    assert.equal(scores.length, dim.labels.length);
    assert.ok(scores.every((s) => Number.isFinite(s)));
  });
});

describe('v0.4 跨期留出评估', () => {
  test('逐维指标按重叠比口径计算，再对六维宏平均', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const metrics = evaluateHoldout({
      model,
      holdout: synthHoldout(),
      featureSet: V04_ORIGINAL_FEATURE_SET,
      toInput: (product) => ({
        skuId: product.skuId,
        sourceProductKey: product.sourceProductKey,
        fitType: product.fitType ?? '',
        fabric: product.fabric ?? '',
        fab: product.fab ?? '',
      }),
      targetDimensions: SUPERVISED_TARGET_DIMENSIONS,
    });
    assert.equal(metrics.sampleCount, 4);
    const dim = metrics.perDimension[SYNTH_DIM]!;
    assert.ok(dim.top1 >= 0 && dim.top1 <= 1);
    assert.ok(dim.top3 >= 0 && dim.top3 <= 1);
    assert.ok(dim.shareMae >= 0);
    // 宏平均 = 各维均值之和 / 维度数
    const dims = Object.values(metrics.perDimension);
    const sumTop1 = dims.reduce((s, d) => s + d.top1, 0);
    assert.ok(Math.abs(metrics.avgTop1 - sumTop1 / dims.length) < 1e-12);
  });

  test('excludeSkuIds 命中的样本不参与评估', () => {
    const model = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    const metrics = evaluateHoldout({
      model,
      holdout: synthHoldout(),
      featureSet: V04_ORIGINAL_FEATURE_SET,
      toInput: (product) => ({
        skuId: product.skuId,
        sourceProductKey: product.sourceProductKey,
        fitType: product.fitType ?? '',
        fabric: product.fabric ?? '',
        fab: product.fab ?? '',
      }),
      targetDimensions: SUPERVISED_TARGET_DIMENSIONS,
      excludeSkuIds: new Set(['S1']),
    });
    assert.equal(metrics.sampleCount, 3);
  });
});

describe('样本包读取', () => {
  test('最小 JSONL reader：去 BOM、跳空行、逐行解析', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uom-jsonl-'));
    const path = resolve(dir, 'a.jsonl');
    writeFileSync(path, '﻿{"a":1}\n\n{"a":2}\n', 'utf-8');
    assert.deepEqual(readJsonl<{ a: number }>(path), [{ a: 1 }, { a: 2 }]);
  });

  test('CSV 解析正确处理带引号的逗号取值（修掉归档 split(",") 缺陷）', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uom-csv-'));
    const path = resolve(dir, 'p.csv');
    writeFileSync(
      path,
      'skuId,sourceProductKey,labelType,label,share,tgi\nS1,S1,预测性别,"女, 强",0.7,1\n',
      'utf-8',
    );
    const rows = parsePlatformPortraitCsv(path);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.label, '女, 强');
    assert.equal(rows[0]!.share, 0.7);
  });

  test('目标份额索引不对齐时 fail-closed', () => {
    const misaligned = new Map<string, Map<string, number[]>>([
      [SYNTH_DIM, new Map<string, number[]>([['男', [0.3]]])],
    ]);
    assert.throws(() => assertTargetAlignment(misaligned, 4), /索引不对齐/);
    assert.doesNotThrow(() => assertTargetAlignment(SYNTH_TARGETS, 4));
  });

  test('buildTargetsByDimension 汇总逐维逐标签份额', () => {
    const pkg = synthHoldout();
    const targets = buildTargetsByDimension(pkg.products, pkg.portraitRows, [SYNTH_DIM]);
    assert.deepEqual(targets.get(SYNTH_DIM)?.get('男'), [0.2, 0.2, 0.2, 0.2]);
    assert.deepEqual(targets.get(SYNTH_DIM)?.get('女'), [0.8, 0.8, 0.8, 0.8]);
  });
});

describe('§9.2 背对背隔离：合规特征集守卫', () => {
  test('行为层：输入里的 fab 变化不影响合规特征（把 fab 接回抽取器则失败）', () => {
    const base: V04CompliantProductInput & { fab: string } = {
      skuId: 'C1',
      fitType: '修身型',
      fabric: '全棉',
      fab: '修身显瘦 高级',
    };
    const other: V04CompliantProductInput & { fab: string } = { ...base, fab: '完全不同的一段卖点文本' };
    assert.deepEqual(extractCompliantBaseFeatures(base), extractCompliantBaseFeatures(other));
    // 断言结果里没有任何来自 fab 的特征名
    const keys = Object.keys(extractCompliantBaseFeatures(base));
    assert.ok(!keys.some((key) => key.includes('style_') || key.includes('func_') || key.includes('scene_')));
  });

  test('投影层：projectCompliantInput 丢弃全部人工字段', () => {
    const projected = projectCompliantInput({
      skuId: 'C1',
      fitType: '修身型',
      fabric: '全棉',
      category: '短袖T恤',
      subCategory: '其他短袖T恤',
      season: 'Q2',
      productLifecycle: '电商新品',
      ipCollaboration: '',
      specialFunctionOrMaterial: '凉感-接触凉感',
      // 以下为人工字段，投影后必须不存在
      fab: '卖点',
      mentalProduct: '心智',
      memoryPoint: '记忆点',
      groupTag: '显瘦T',
    } as Parameters<typeof projectCompliantInput>[0]);
    for (const forbidden of COMPLIANT_FORBIDDEN_FIELDS) {
      assert.ok(!(forbidden in projected), `投影结果不应含 ${forbidden}`);
    }
    assert.equal(projected.category, '短袖T恤');
    assert.equal(projected.specialFunctionOrMaterial, '凉感-接触凉感');
  });

  test('合规特征只来自白名单字段（品类/季节/上新类型/IP/工艺各自成组）', () => {
    const features = extractCompliantBaseFeatures({
      skuId: 'C1',
      fitType: '修身型',
      fabric: '全棉',
      category: '短袖T恤',
      subCategory: '其他短袖T恤',
      season: 'Q2',
      productLifecycle: '电商新品',
      ipCollaboration: '联名A',
      specialFunctionOrMaterial: '凉感-接触凉感',
    });
    assert.deepEqual(features, {
      fit_slim: 1,
      fabric_cotton: 1,
      cat_短袖T恤: 1,
      cat_sub_其他短袖T恤: 1,
      season_Q2: 1,
      lifecycle_电商新品: 1,
      ip_联名A: 1,
      craft_凉感: 1,
      craft_接触凉感: 1,
    });
  });

  test('结构层：合规抽取器源码不读取任何人工字段', () => {
    const code = stripStringLiterals(stripComments(readModelSource('features-v04-compliant.ts')));
    for (const forbidden of COMPLIANT_FORBIDDEN_FIELDS) {
      assert.ok(
        !new RegExp(`\\.\\s*${forbidden}\\b`).test(code),
        `合规抽取器不得读取 ${forbidden}`,
      );
      assert.ok(
        !new RegExp(`\\[\\s*['"]${forbidden}['"]\\s*\\]`).test(code),
        `合规抽取器不得按 ${forbidden} 取值`,
      );
    }
  });

  test('合规特征集的分组前缀都在白名单组内', () => {
    assert.deepEqual(COMPLIANT_FEATURE_GROUPS, [
      'fit_',
      'fabric_',
      'cat_',
      'season_',
      'lifecycle_',
      'ip_',
      'craft_',
    ]);
    assert.equal(V04_COMPLIANT_FEATURE_SET.id, 'v04-compliant');
  });
});

describe('v0.4 模型工件结构', () => {
  test('模型记录特征集标识，便于溯源', () => {
    const model: V04PortraitModel = trainSupervisedPortraitModel({
      samples: SYNTH_SAMPLES,
      targetsByDimension: SYNTH_TARGETS,
      featureSet: V04_ORIGINAL_FEATURE_SET,
    });
    assert.equal(model.featureSetId, 'v04-original');
    assert.deepEqual([...model.targetDimensions], [...SUPERVISED_TARGET_DIMENSIONS]);
  });
});

describe('样本包读取（真实文件）', () => {
  test('loadSamplePackage 在缺少目录时明确失败', () => {
    assert.throws(() => loadSamplePackage('/nonexistent/uom/v04'), /ENOENT|no such file/);
  });
});
