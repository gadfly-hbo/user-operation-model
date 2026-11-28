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
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  V06_FORBIDDEN_FIELDS,
  V06_PRODUCT_ATTRIBUTE_ALLOWED_VALUES,
  V06_TARGET_DIMENSIONS,
  assertV06ProductAttributeAllowed,
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
import { validateV06, type V06ValidateInput } from '../src/pipeline/v06/06-validate.js';
import {
  EXPECTED_COEFFICIENT_SHA256,
  FROZEN_FOLDS_SHA256,
  assertFrozenCoefficientSha256,
  assertFrozenFoldsSha256,
} from '../src/pipeline/v06/frozen-inputs.js';
import type { V06ModelArtifact } from '../src/pipeline/v06/04-select-final.js';
import { jsSimilarity } from '@uom/core/model/metrics';
import type * as tsNS from 'typescript';

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
    productAttribute: index % 5 === 0 ? '电商一年期' : '老品',
    ipCollab: '',
    specialFunctionMaterial: index % 3 === 0 ? '防护' : '',
  };
  const maleShare = 0.1 + 0.05 * (index % 7);
  // 取值随 index%7 变化：若按 index%5 取周期值，5 折恰好成对移除同残差样本，
  // 会出现「折内均值 == 全量均值」的巧合等值，令 V12 的折内性断言误报。
  const otherShare = 0.3 + 0.02 * (index % 7);
  const portraits = {} as V06Sample['portraits'];
  for (const dimension of V06_TARGET_DIMENSIONS) {
    const [first, second] = DIM_LABELS[dimension]!;
    const share = dimension === '预测性别' ? maleShare : otherShare;
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

/**
 * 人工字段的**访问形态**黑名单（复核修单 B4）：
 * 在「剥注释、保留字符串字面量」的源码上匹配——方括号／模板键／`in` 检查这些形态
 * 一旦先剥字符串就会失效（旧守卫正是因此被 `['fab']` 方括号变异绕过）。
 */
function forbiddenAccessPatterns(field: string): RegExp[] {
  return [
    new RegExp(`\\[\\s*['"\`]${field}['"\`]\\s*\\]`), // ['fab'] / ["fab"] / [`fab`]
    new RegExp(`['"\`]${field}['"\`]\\s+in\\b`), // 'fab' in input
  ];
}

/** 断言抽取器源码不存在任何人工字段访问形态（点号在剥字符串后查，其余形态在保留字符串时查）。 */
function assertNoForbiddenFieldAccess(source: string, label: string): void {
  const withStrings = stripComments(source);
  const bare = stripStringLiterals(withStrings);
  for (const forbidden of V06_FORBIDDEN_FIELDS) {
    for (const pattern of forbiddenAccessPatterns(forbidden)) {
      assert.ok(
        !pattern.test(withStrings),
        `${label} 不得以方括号／模板键／in 形态访问人工字段 ${forbidden}`,
      );
    }
    assert.ok(!new RegExp(`\\.\\s*${forbidden}\\b`).test(bare), `${label} 不得访问人工字段 ${forbidden}`);
  }
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

  test('行为层：绕过投影层直接喂抽取器——只差人工字段（有／无）的特征完全一致', () => {
    // 复核修单 B4：旧用例的 clean/dirty 都先过投影层，人工字段到不了抽取器，
    // 「存在即加特征」型变异（有 fab 就多一个特征）因此存活。这里绕过投影层，
    // 直接把带／不带 `fab` 的原始输入喂给抽取器：任何「读 fab」的变异都会让两边不同。
    const groups = new Set(V06_COMPLIANT_GROUPS);
    const clean: V06CompliantProductInput = {
      sku: 'S001',
      fit: '宽松型',
      fabric: '牛仔',
      category: '外套',
      subcategory: '棉外套',
      season: 'Q4',
      productAttribute: '老品',
      ipCollab: '',
      specialFunctionMaterial: '防护',
    };
    const withFab = {
      ...clean,
      fab: '一段人工卖点文本',
      mindProduct: '心智产品',
      memoryPoint: '记忆点',
      groupTag: '群组打标',
      genderCorrected: '男',
    } as unknown as V06CompliantProductInput;
    const withOtherFab = { ...withFab, fab: '另一段完全不同的人工卖点' } as unknown as V06CompliantProductInput;
    assert.deepEqual([...extractV06Tokens(withFab, groups)], [...extractV06Tokens(clean, groups)]);
    assert.deepEqual([...extractV06Tokens(withOtherFab, groups)], [...extractV06Tokens(clean, groups)]);
  });

  test('行为层（投影层复核）：投影后注入人工字段同样不改变特征', () => {
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

  test('结构守卫：抽取器源码不得以任何访问形态读取人工字段（点号／方括号／模板键／in）', () => {
    assertNoForbiddenFieldAccess(readPipelineSource('lib/features-v06.ts'), '抽取器');
  });

  test('特征名白名单：所有产出特征名必须可归属到白名单特征组（无法归属即失败）', () => {
    // 复核修单 B4：像 V7 对标签做的那样做数据驱动归属——每个产出特征名都必须能由
    // 白名单字段的语料取值（或面料归一化类别）解释；`fab_present` 之类无法归属的
    // 特征名一律失败。
    const groups = new Set(V06_COMPLIANT_GROUPS);
    const corpus: V06CompliantProductInput[] = [
      {
        sku: 'W1',
        fit: '修身型',
        fabric: '棉',
        category: '上衣',
        subcategory: 'T恤',
        season: 'Q2',
        productAttribute: '电商一年期',
        ipCollab: '',
        specialFunctionMaterial: '凉感-抗菌',
      },
      {
        sku: 'W2',
        fit: '宽松型',
        fabric: '牛仔',
        category: '外套',
        subcategory: '棉外套',
        season: 'Q4',
        productAttribute: '老品',
        ipCollab: '联名A',
        specialFunctionMaterial: '三防',
      },
      { sku: 'W3', fit: '合体型', fabric: '无法归类的面料', category: '裙装', subcategory: '', season: '', productAttribute: '线下一年期', ipCollab: '', specialFunctionMaterial: '' },
      { sku: 'W4', fit: '宽松型', fabric: '', category: '外套', subcategory: '棉外套', season: 'Q4', productAttribute: '老品', ipCollab: '', specialFunctionMaterial: '防护' },
    ];
    const separator = /[-+/、，,;；\s]+/;
    const allowed = new Set<string>();
    for (const input of corpus) {
      allowed.add(`fit_${input.fit}`);
      const fabricClass = normalizeV06Fabric(input.fabric);
      if (fabricClass !== 'unknown') allowed.add(`fabric_${fabricClass}`);
      if (input.category) allowed.add(`cat_${input.category}`);
      if (input.subcategory) allowed.add(`subcat_${input.subcategory}`);
      if (input.season) allowed.add(`season_${input.season}`);
      if (input.productAttribute) allowed.add(`attr_${input.productAttribute}`);
      if (input.ipCollab) allowed.add(`ip_${input.ipCollab}`);
      for (const token of input.specialFunctionMaterial.split(separator)) {
        if (token.trim()) allowed.add(`craft_${token.trim()}`);
      }
    }
    const produced = new Set<string>();
    for (const input of corpus) {
      for (const name of extractV06Tokens(input, groups).keys()) produced.add(name);
    }
    assert.ok(produced.size > 0);
    // 语料本身要覆盖多个组，避免归属断言变成空洞放行
    for (const prefix of ['fit_', 'fabric_', 'attr_', 'cat_', 'craft_']) {
      assert.ok([...produced].some((name) => name.startsWith(prefix)), `语料应覆盖 ${prefix} 组`);
    }
    for (const name of produced) {
      assert.ok(allowed.has(name), `特征名 ${name} 无法归属到任何白名单特征组`);
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
// 冻结输入哈希（复核修单 B2／S2）
// ---------------------------------------------------------------------------

describe('冻结输入哈希钉死（B2／S2）', () => {
  test('钉死常量与文档冻结值逐位一致（docs/match-model-baseline.md §7.4）', () => {
    assert.equal(FROZEN_FOLDS_SHA256, '2ca273cb2a2b14dff9d2ae857e170aa02db89c0f50e36ced84f2625f4087ad22');
    assert.equal(EXPECTED_COEFFICIENT_SHA256, '79669a0f30938c0b837589998adc4270d093050bd4c980400e76ee357568d6fa');
  });

  test('folds 被篡改一字节后重算的哈希必不等于钉死值，断言即抛错', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-tamper-'));
    const path = join(dir, 'folds.json');
    writeFileSync(path, '{"k":5,"folds":[["S1","S2"],["S3","S4"]]}', 'utf8');
    const before = createHash('sha256').update(readFileSync(path)).digest('hex');
    writeFileSync(path, '{"k":5,"folds":[["S1","S2"],["S3","S5"]]}', 'utf8'); // 篡改一个字节
    const after = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.notEqual(before, after, '一字节篡改必须改变 sha256');
    assert.notEqual(after, FROZEN_FOLDS_SHA256);
    assert.throws(() => assertFrozenFoldsSha256(after), /冻结 folds/);
    assert.doesNotThrow(() => assertFrozenFoldsSha256(FROZEN_FOLDS_SHA256));
    assert.throws(() => assertFrozenFoldsSha256(undefined), /冻结 folds|未提供/);
  });

  test('系数区哈希不一致即抛错（换求解器／换数据场景），一致才放行', () => {
    assert.throws(() => assertFrozenCoefficientSha256('f'.repeat(64)), /系数区/);
    assert.throws(() => assertFrozenCoefficientSha256(undefined), /系数区|未提供/);
    assert.doesNotThrow(() => assertFrozenCoefficientSha256(EXPECTED_COEFFICIENT_SHA256));
  });
});

// ---------------------------------------------------------------------------
// 货品属性取值集合（复核修单 S1，2026-11-28 用户追认）
// ---------------------------------------------------------------------------

describe('货品属性取值集合（S1）', () => {
  test('合法取值就是三种生命周期类标签（用户裁定追认为客观属性）', () => {
    assert.deepEqual([...V06_PRODUCT_ATTRIBUTE_ALLOWED_VALUES].sort(), ['电商一年期', '线下一年期', '老品']);
  });

  test('三种合法值放行；集合外的任何值（含空值与人工判断文本）一律抛错', () => {
    for (const value of V06_PRODUCT_ATTRIBUTE_ALLOWED_VALUES) {
      assert.doesNotThrow(() => assertV06ProductAttributeAllowed(value));
    }
    assert.throws(() => assertV06ProductAttributeAllowed('运营人工判断的新值'), /货品属性/);
    assert.throws(() => assertV06ProductAttributeAllowed('老品 '), /货品属性|trim/);
    assert.throws(() => assertV06ProductAttributeAllowed(''), /货品属性/);
  });

  test('阶段 01 fail-closed：货品属性出现集合外的值即拒绝整个数据集', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-attr-'));
    const portraitDir = join(dir, 'raw-portraits');
    mkdirSync(portraitDir, { recursive: true });
    const header = ['| 标签类型 | 标签 | 占比 |', '|---|---|---|'];
    const rows = V06_TARGET_DIMENSIONS.flatMap((dimension) => {
      const [first, second] = DIM_LABELS[dimension]!;
      return [`| ${dimension} | ${first} | 60% |`, `| ${dimension} | ${second} | 40% |`];
    });
    writeFileSync(join(portraitDir, 'S901_正.md'), [...header, ...rows, ''].join('\n'), 'utf8');

    const columns = ['款号', '版型', '面料', '品类', '小类', '季节', '货品属性', 'IP/联名', '特殊功能/材质'];
    const record = ['S901', '修身型', '棉', '上衣', 'T恤', 'Q4', '', '', ''];
    const ExcelJS = (await import('exceljs')).default;
    const writeXlsx = async (productAttribute: string): Promise<string> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('商品');
      sheet.addRow(columns);
      sheet.addRow([...record.slice(0, 6), productAttribute, '', '']);
      const path = join(dir, `product-info-${productAttribute.length || 0}.xlsx`);
      await workbook.xlsx.writeFile(path);
      return path;
    };

    // 合法取值 → prepare 放行
    const goodPath = await writeXlsx('老品');
    const dataset = await prepareV06Dataset({ portraitDir, productInfoXlsx: goodPath });
    assert.equal(dataset.samples.length, 1);
    assert.equal(dataset.samples[0]!.input.productAttribute, '老品');

    // 集合外取值 → 整个数据集被拒绝（fail-closed）
    const badPath = await writeXlsx('运营临时打的标签');
    await assert.rejects(
      () => prepareV06Dataset({ portraitDir, productInfoXlsx: badPath }),
      /货品属性/,
    );
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

  test('消融结果返回它**实际使用**的逐折基线（V12 独立比对的输入，复核修单 B3）', () => {
    const samples = syntheticSamples(10);
    const folds = syntheticFolds(samples, 5);
    const result = runV06Ablation(samples, folds, V06_ABLATION_LADDER.slice(0, 1))[0]!;
    assert.ok(result.foldBaselines, '消融结果必须携带它实际使用的折内基线');
    for (let fold = 0; fold < folds.length; fold += 1) {
      const train = samples.filter((sample) => !folds[fold]!.includes(sample.sku));
      for (const dimension of V06_TARGET_DIMENSIONS) {
        const key = `fold:${fold}:${dimension}`;
        const provided = result.foldBaselines[key];
        assert.ok(provided, `缺少 ${key} 的基线`);
        const expected = v06AccountMeanBaseline(dimension, train);
        for (const [label, value] of Object.entries(expected)) {
          assert.ok(
            Math.abs((provided[label] ?? 0) - value) < 1e-12,
            `${key}/${label} 与折内均值不一致`,
          );
        }
      }
    }
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
      foldBaselines: {},
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
  function buildValidationInput(customSamples?: V06Sample[]) {
    const samples = customSamples ?? syntheticSamples(10);
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

  /** 校验清单 fixture：临时目录里一个文件 + 对应 checksums.sha256（V1 全 pass 需要）。 */
  function makeChecksumsFile(): string {
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-v1-'));
    const payload = join(dir, 'synthetic-payload.txt');
    writeFileSync(payload, 'synthetic', 'utf8');
    const sha = createHash('sha256').update(readFileSync(payload)).digest('hex');
    const listPath = join(dir, 'checksums.sha256');
    writeFileSync(listPath, `${sha}  synthetic-payload.txt\n`, 'utf8');
    return listPath;
  }

  function toValidateInput(
    input: ReturnType<typeof buildValidationInput>,
  ): Omit<V06ValidateInput, 'checksumsFile' | 'frozenFoldsSha256' | 'actualFoldsSha256' | 'foldBaselines'> {
    return {
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
    };
  }

  function makeChecks(
    input: ReturnType<typeof buildValidationInput>,
    overrides: Partial<V06ValidateInput> = {},
  ) {
    return validateV06({ ...toValidateInput(input), ...overrides });
  }

  /** 正常管线的完整输入：ablation 实际基线 + 钉死哈希 + 校验清单。 */
  function fullPassOverrides(input: ReturnType<typeof buildValidationInput>): Partial<V06ValidateInput> {
    return {
      checksumsFile: makeChecksumsFile(),
      frozenFoldsSha256: FROZEN_FOLDS_SHA256,
      actualFoldsSha256: FROZEN_FOLDS_SHA256,
      foldBaselines: input.ablation[0]!.foldBaselines,
    };
  }

  test('校验项覆盖 V1–V12（V9／V12 在列）且完整输入下全部 pass', () => {
    const input = buildValidationInput();
    const checks = makeChecks(input, fullPassOverrides(input));
    const ids = checks.map((check) => check.id);
    for (let index = 1; index <= 12; index += 1) {
      assert.ok(ids.includes(`V${index}`), `缺少校验项 V${index}`);
    }
    const failed = checks.filter((check) => check.result !== 'pass');
    assert.deepEqual(
      failed.map((check) => [check.id, check.detail]),
      [],
      `完整输入下应全 pass，失败项：${failed.map((check) => check.id).join(',')}`,
    );
  });

  test('V1：未提供 intake 校验清单即 fail（fail-closed，不再默认 pass）', () => {
    const input = buildValidationInput();
    const checks = makeChecks(input, {});
    assert.equal(checks.find((check) => check.id === 'V1')?.result, 'fail');
  });

  test('V4：冻结 folds 哈希与运行时哈希不一致即 fail（folds 被重生成场景）', () => {
    const input = buildValidationInput();
    const checks = makeChecks(input, {
      ...fullPassOverrides(input),
      actualFoldsSha256: 'a'.repeat(64),
    });
    assert.equal(checks.find((check) => check.id === 'V4')?.result, 'fail');
  });

  test('V4：缺任一哈希即 fail（fail-closed，不再默认 pass）', () => {
    const input = buildValidationInput();
    const missingFrozen = makeChecks(input, {
      checksumsFile: makeChecksumsFile(),
      actualFoldsSha256: FROZEN_FOLDS_SHA256,
      foldBaselines: input.ablation[0]!.foldBaselines,
    });
    assert.equal(missingFrozen.find((check) => check.id === 'V4')?.result, 'fail');
    const missingActual = makeChecks(input, {
      checksumsFile: makeChecksumsFile(),
      frozenFoldsSha256: FROZEN_FOLDS_SHA256,
      foldBaselines: input.ablation[0]!.foldBaselines,
    });
    assert.equal(missingActual.find((check) => check.id === 'V4')?.result, 'fail');
  });

  test('V4 行为层（R2-S2）：folds 篡改一字节 → 运行时重算哈希 → 真实判定路径必 FAIL', () => {
    // 复核者绕过手法（M-B2-bypass）把 actual 一侧退回钉死常量后，篡改 folds 仍 V4 PASS。
    // 本用例锁定行为语义：临时文件翻一字节 → 按运行时重算 sha256 → 喂给真实 V4 判定路径
    // （assertFrozenFoldsSha256 与 validateV06 的 actualFoldsSha256 入参）→ 必须 FAIL。
    const dir = mkdtempSync(join(tmpdir(), 'uom-v06-v4-behavior-'));
    const foldsPath = join(dir, 'folds.json');
    const original = '{"schemaVersion":1,"k":5,"seed":20260911,"folds":[["S1","S2"],["S3","S4"]]}';
    writeFileSync(foldsPath, original, 'utf8');
    const honestHash = createHash('sha256').update(readFileSync(foldsPath)).digest('hex');
    const tampered = original.replace('"seed":20260911', '"seed":20260912'); // 恰好差 1 字节
    assert.notEqual(tampered, original);
    writeFileSync(foldsPath, tampered, 'utf8');
    const runtimeHash = createHash('sha256').update(readFileSync(foldsPath)).digest('hex');
    assert.notEqual(runtimeHash, honestHash, '一字节篡改必须改变运行时哈希');
    assert.notEqual(runtimeHash, FROZEN_FOLDS_SHA256, '篡改后的哈希必不等于钉死值');

    // 真实判定路径 ①：阶段 02 的钉死断言（管线在导出前调用）
    assert.throws(() => assertFrozenFoldsSha256(runtimeHash), /冻结 folds/);
    // 真实判定路径 ②：阶段 06 的 V4（比对钉死值与运行时哈希）
    const input = buildValidationInput();
    const checks = makeChecks(input, { ...fullPassOverrides(input), actualFoldsSha256: runtimeHash });
    const v4 = checks.find((check) => check.id === 'V4')!;
    assert.equal(v4.result, 'fail', `篡改 folds 后 V4 必须失败，实际：${v4.detail}`);
  });

  test('V9：重跑结果不一致即 fail', () => {
    const input = buildValidationInput();
    const checks = makeChecks(input, {
      ...fullPassOverrides(input),
      rerunFinalTraining: () => {
        const tampered = trainV06FinalModel(input.samples, input.selection.winner);
        tampered.coefficients.dimensionModels[0]!.alpha = 999;
        return tampered;
      },
    });
    assert.equal(checks.find((check) => check.id === 'V9')?.result, 'fail');
  });

  test('V10：最终词表缺折内 OOF 词项即 fail（真实判定，不再恒 PASS）', () => {
    const input = buildValidationInput();
    const featureNames = input.artifact.coefficients.dimensionModels[0]!.featureNames;
    assert.ok(featureNames.length > 1, '夹具词表应非平凡');
    input.artifact.coefficients.dimensionModels[0]!.featureNames = featureNames.slice(1);
    const checks = makeChecks(input, fullPassOverrides(input));
    assert.equal(checks.find((check) => check.id === 'V10')?.result, 'fail');
  });

  test('V12：未提供 ablation 折内基线即 fail（fail-closed）', () => {
    const input = buildValidationInput();
    const checks = makeChecks(input, { checksumsFile: makeChecksumsFile(), frozenFoldsSha256: FROZEN_FOLDS_SHA256, actualFoldsSha256: FROZEN_FOLDS_SHA256 });
    assert.equal(checks.find((check) => check.id === 'V12')?.result, 'fail');
  });

  test('V12：ablation 基线泄漏为全量基线即 fail', () => {
    const input = buildValidationInput();
    const leaked: Record<string, Record<string, number>> = {};
    for (let fold = 0; fold < input.folds.length; fold += 1) {
      for (const dimension of V06_TARGET_DIMENSIONS) {
        leaked[`fold:${fold}:${dimension}`] = v06AccountMeanBaseline(dimension, input.samples);
      }
    }
    const checks = makeChecks(input, { ...fullPassOverrides(input), foldBaselines: leaked });
    assert.equal(checks.find((check) => check.id === 'V12')?.result, 'fail');
  });

  test('V12：任一维度基线被偏移即 fail（逐维度逐标签比对）', () => {
    const input = buildValidationInput();
    const baselines: Record<string, Record<string, number>> = {
      ...(input.ablation[0]!.foldBaselines ?? {}),
    };
    const key = 'fold:0:预测性别';
    const shifted = { ...(baselines[key] ?? {}) };
    const firstLabel = Object.keys(shifted)[0]!;
    shifted[firstLabel] = (shifted[firstLabel] ?? 0) + 0.05;
    baselines[key] = shifted;
    const checks = makeChecks(input, { ...fullPassOverrides(input), foldBaselines: baselines });
    assert.equal(checks.find((check) => check.id === 'V12')?.result, 'fail');
  });

  test('V12：「≠全量基线」按各自维度语义判定——整折六维折内基线全部等于全量基线必须被抓', () => {
    // 复核修单 B3 回归：旧实现把全量基线固定按「预测性别」计算，却对六个维度都比较——
    // 其余五维是跨维度比较、必然「不同」，断言恒真。R2 建议项 4 之后 V12 的判定语义：
    // 单个维度折内==全量（画像恒定）只记录不拦截；**整折所有维度**都等于各自全量基线时，
    // 折内性完全无法证明（整折泄漏与全维恒定不可区分）→ 必须判 fail（fail-closed）。
    // 本夹具让六维画像全部恒定：无论新旧实现、正确按维比较都会命中——跨维度 bug 同样被杀。
    const samples: V06Sample[] = Array.from({ length: 10 }, (_, index) => {
      const base = syntheticSample(index);
      const portraits = {} as V06Sample['portraits'];
      for (const dimension of V06_TARGET_DIMENSIONS) {
        const [first, second] = DIM_LABELS[dimension]!;
        portraits[dimension] = { [first]: 0.4, [second]: 0.6 };
      }
      return { ...base, portraits };
    }).sort((left, right) => (left.sku < right.sku ? -1 : left.sku > right.sku ? 1 : 0));
    const input = buildValidationInput(samples);
    const checks = makeChecks(input, fullPassOverrides(input));
    assert.equal(checks.find((check) => check.id === 'V12')?.result, 'fail');
  });

  test('V12 不误报（R2 建议项 4）：仅单个维度画像恒定（折内==全量）→ 记录差异、不判 fail', () => {
    // 合法情形：某维度画像对所有样本恒定 → 折内均值必然等于全量均值。
    // 该维度无法单独区分折内／全量，但其余维度的「折内 ≠ 全量」证明了折内计算 → 不拦截。
    const samples: V06Sample[] = Array.from({ length: 10 }, (_, index) => {
      const base = syntheticSample(index);
      const portraits = { ...base.portraits };
      portraits['预测年龄'] = { '[18,24]': 0.4, '[25,29]': 0.6 };
      return { ...base, portraits };
    }).sort((left, right) => (left.sku < right.sku ? -1 : left.sku > right.sku ? 1 : 0));
    const input = buildValidationInput(samples);
    const checks = makeChecks(input, fullPassOverrides(input));
    const v12 = checks.find((check) => check.id === 'V12')!;
    assert.equal(v12.result, 'pass', `单维恒定不得误报，实际 detail：${v12.detail}`);
    assert.ok(
      v12.detail?.includes('预测年龄'),
      `V12 输出必须写明判定条件与等值维度（可审计），实际 detail：${v12.detail}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 包级结构守卫（复核建议项 S6：单一求解器／单一指标；B2 管线脚本接线）
// ---------------------------------------------------------------------------

describe('tool2 包级结构守卫', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  function listSourceFiles(root: string): string[] {
    return readdirSync(root, { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => entry.endsWith('.ts'))
      .map((entry) => resolve(root, entry));
  }

  test('包内不出现第二份 Ridge／指标实现；core 能力只经 @uom/core/model|normalize 子路径引用', () => {
    const files = listSourceFiles(resolve(here, '../../src'));
    assert.ok(files.length >= 10, `应扫描到 tool2 源码文件，实际 ${files.length}`);
    const banned =
      /invertMatrix|gaussJordan|adjugate|cofactor|Math\.log2|function\s+(?:cosineSimilarity|jsSimilarity|fitRidge|predictRidge|choleskyFactor|solveCholesky)/i;
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      assert.ok(!banned.test(code), `${file} 疑似内嵌第二份求解器／指标实现`);
      for (const match of code.matchAll(/from\s+['"](@uom\/core\/[^'"]+)['"]/g)) {
        assert.ok(
          /^@uom\/core\/(model|normalize)\//.test(match[1]!),
          `core 能力只允许经 @uom/core/model|normalize 子路径引用：${match[1]}`,
        );
      }
    }
  });

  test('结构守卫：管线脚本 V4 用钉死常量、不做运行时自比较（B2）；基线来自 ablation 实际值（B3）；系数区有钉死校验（S2）', () => {
    const source = stripComments(readFileSync(resolve(here, '../../../../scripts/v06-pipeline.mjs'), 'utf8'));
    assert.ok(source.includes('assertFrozenFoldsSha256'), '管线必须在阶段 02 后做 folds 钉死校验（B2）');
    assert.ok(source.includes('assertFrozenCoefficientSha256'), '管线必须在阶段 04 后做系数区钉死校验（S2）');
    assert.ok(
      source.includes('ablation[0]?.foldBaselines'),
      'V12 必须比对 ablation 实际使用的折内基线（B3）',
    );
  });

  test('结构守卫（R2-S2·AST）：validate 入参与钉死断言的实参必须来自运行时变量——字面量与常量标识符形态一律拒绝', async () => {
    // 复核者绕过手法（M-B2-bypass）：把 actualFoldsSha256 / assertFrozenFoldsSha256 实参
    // 改成钉死常量 `pipeline.FROZEN_FOLDS_SHA256`（常量比常量，自比较恒 PASS）后，
    // 旧的「禁止某一写法」文本守卫 436 全绿。这里改用 AST 形态判定：
    // `actualFoldsSha256` 与两个钉死断言的实参必须是**运行时变量（标识符）**——
    // 字符串字面量与 `pipeline.FROZEN_FOLDS_SHA256` 这类常量标识符（成员访问）都过不了。
    const tsModule = await import('typescript');
    const ts: typeof tsNS = (tsModule as unknown as { default?: typeof tsNS }).default ?? tsModule;
    const scriptPath = resolve(here, '../../../../scripts/v06-pipeline.mjs');
    const sourceFile = ts.createSourceFile(
      scriptPath,
      readFileSync(scriptPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );

    const properties = new Map<string, tsNS.Expression[]>();
    const assertCalls = new Map<string, tsNS.Expression[]>();
    const walk = (node: tsNS.Node): void => {
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
        const list = properties.get(node.name.text) ?? [];
        list.push(node.initializer);
        properties.set(node.name.text, list);
      }
      if (ts.isCallExpression(node) && node.arguments.length === 1) {
        // 兼容两种调用形态：直接调用 assertFrozenXxx(...) 与经命名空间 pipeline.assertFrozenXxx(...)
        const calleeName = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)
            ? node.expression.name.text
            : undefined;
        if (calleeName?.startsWith('assertFrozen')) {
          const list = assertCalls.get(calleeName) ?? [];
          list.push(node.arguments[0]!);
          assertCalls.set(calleeName, list);
        }
      }
      node.forEachChild(walk);
    };
    sourceFile.forEachChild(walk);

    const isFrozenConstantAccess = (expression: tsNS.Expression): boolean =>
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'pipeline' &&
      expression.name.text === 'FROZEN_FOLDS_SHA256';
    // actual 一侧必须是运行时哈希变量 `foldsSha256` 本名——字符串字面量、
    // `pipeline.FROZEN_FOLDS_SHA256`、以及改名的中间常量标识符一律拒绝。
    const isRuntimeFoldsVariable = (expression: tsNS.Expression): boolean =>
      ts.isIdentifier(expression) && expression.text === 'foldsSha256';

    // V4 输入侧：frozen 一侧必须取钉死常量，actual 一侧必须是运行时变量
    const frozenSides = properties.get('frozenFoldsSha256') ?? [];
    assert.ok(frozenSides.length >= 1, '脚本必须向 validate 传入 frozenFoldsSha256');
    for (const initializer of frozenSides) {
      assert.ok(
        isFrozenConstantAccess(initializer),
        `frozenFoldsSha256 必须取钉死常量 pipeline.FROZEN_FOLDS_SHA256，实际：${initializer.getText(sourceFile)}`,
      );
    }
    const actualSides = properties.get('actualFoldsSha256') ?? [];
    assert.ok(actualSides.length >= 1, '脚本必须向 validate 传入 actualFoldsSha256');
    for (const initializer of actualSides) {
      assert.ok(
        isRuntimeFoldsVariable(initializer),
        `actualFoldsSha256 必须取运行时哈希变量 foldsSha256（字面量／常量标识符／改名中间量即自比较），实际：${initializer.getText(sourceFile)}`,
      );
    }

    // 阶段 02／04 的钉死断言：实参必须是运行时变量（不得拿常量喂给自己）
    for (const [name, variable] of [
      ['assertFrozenFoldsSha256', 'foldsSha256'],
      ['assertFrozenCoefficientSha256', 'coefficientHash'],
    ] as const) {
      const callArguments = assertCalls.get(name) ?? [];
      assert.ok(callArguments.length >= 1, `管线必须调用 ${name}`);
      for (const argument of callArguments) {
        assert.ok(
          ts.isIdentifier(argument) && argument.text === variable,
          `${name} 的实参必须是运行时变量 ${variable}（字面量／常量标识符即自比较），实际：${argument.getText(sourceFile)}`,
        );
      }
    }
  });

  test('结构守卫（R3-S1·AST）：定义点必须由运行时计算赋值——foldsSha256 来自读取 folds 文件字节的 sha256，coefficientHash 来自 v06CoefficientHash', async () => {
    // 第三轮复核 M4d／M4e／M4h：使用点守卫只锁 validate 入参与断言实参的形态，
    // 定义点改成 `const foldsSha256 = pipeline.FROZEN_FOLDS_SHA256`（或 let + 重赋值）后
    // 全量 447 全绿、篡改 folds 的根上管线 12/12 并导出。本守卫把**定义点**一并锁死：
    // 两个哈希变量必须是 const、恰好定义一次、定义后不得重新赋值（别名中间量／重赋值即绕过），
    // 且初始化式必须是「读取 folds 文件字节 → sha256」与 `pipeline.v06CoefficientHash(artifact)` 的运行时计算。
    const tsModule = await import('typescript');
    const ts: typeof tsNS = (tsModule as unknown as { default?: typeof tsNS }).default ?? tsModule;
    const scriptPath = resolve(here, '../../../../scripts/v06-pipeline.mjs');
    const sourceFile = ts.createSourceFile(
      scriptPath,
      readFileSync(scriptPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );

    const declarations = new Map<string, { initializers: tsNS.Expression[]; constKeyword: boolean }>();
    const reassigned = new Set<string>();
    const walk = (node: tsNS.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const entry = declarations.get(node.name.text) ?? { initializers: [], constKeyword: false };
        if ((node.parent.flags & ts.NodeFlags.Const) !== 0) entry.constKeyword = true;
        if (node.initializer) entry.initializers.push(node.initializer);
        declarations.set(node.name.text, entry);
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        reassigned.add(node.left.text);
      }
      node.forEachChild(walk);
    };
    sourceFile.forEachChild(walk);

    const isSimpleAlias = (expression: tsNS.Expression): boolean =>
      ts.isStringLiteral(expression) ||
      ts.isNumericLiteral(expression) ||
      ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression);

    // ---- foldsSha256：必须由「读取 folds 文件字节 → sha256」的运行时计算赋值 ----
    const folds = declarations.get('foldsSha256');
    assert.ok(folds, '管线脚本必须定义 foldsSha256');
    assert.ok(
      folds.constKeyword,
      'foldsSha256 必须以 const 定义（let + 重赋值即定义点绕过，复核 M4e）',
    );
    assert.strictEqual(folds.initializers.length, 1, 'foldsSha256 必须恰好定义（初始化）一次');
    assert.ok(
      !reassigned.has('foldsSha256'),
      'foldsSha256 定义后不得重新赋值（复核 M4e：let + 重赋值为常量）',
    );
    const foldsInit = folds.initializers[0]!;
    assert.ok(
      !isSimpleAlias(foldsInit),
      `foldsSha256 禁止以字面量／常量标识符／别名中间量直接赋值（定义点绕过，复核 M4d），实际：${foldsInit.getText(sourceFile)}`,
    );
    // 形态：createHash('sha256').update(readFileSync(foldsPath)).digest('hex')
    assert.ok(
      ts.isCallExpression(foldsInit) &&
        ts.isPropertyAccessExpression(foldsInit.expression) &&
        foldsInit.expression.name.text === 'digest' &&
        foldsInit.arguments.length === 1 &&
        ts.isStringLiteral(foldsInit.arguments[0]!) &&
        foldsInit.arguments[0]!.text === 'hex',
      `foldsSha256 必须经 digest('hex') 产出，实际：${foldsInit.getText(sourceFile)}`,
    );
    const digestReceiver = (foldsInit as tsNS.CallExpression).expression as tsNS.PropertyAccessExpression;
    const updateCall = digestReceiver.expression;
    assert.ok(
      ts.isCallExpression(updateCall) &&
        ts.isPropertyAccessExpression(updateCall.expression) &&
        updateCall.expression.name.text === 'update' &&
        updateCall.arguments.length === 1 &&
        ts.isCallExpression(updateCall.arguments[0]!) &&
        ts.isIdentifier(updateCall.arguments[0]!.expression) &&
        updateCall.arguments[0]!.expression.text === 'readFileSync' &&
        updateCall.arguments[0]!.arguments.length === 1 &&
        ts.isIdentifier(updateCall.arguments[0]!.arguments[0]!) &&
        updateCall.arguments[0]!.arguments[0]!.text === 'foldsPath',
      `foldsSha256 必须来自 readFileSync(foldsPath) 的文件字节（运行时读取），实际：${updateCall.getText(sourceFile)}`,
    );
    const updateReceiver = (updateCall as tsNS.CallExpression).expression as tsNS.PropertyAccessExpression;
    const createHashCall = updateReceiver.expression;
    assert.ok(
      ts.isCallExpression(createHashCall) &&
        ts.isIdentifier(createHashCall.expression) &&
        createHashCall.expression.text === 'createHash' &&
        createHashCall.arguments.length === 1 &&
        ts.isStringLiteral(createHashCall.arguments[0]!) &&
        createHashCall.arguments[0]!.text === 'sha256',
      `foldsSha256 必须用 sha256 计算，实际：${createHashCall.getText(sourceFile)}`,
    );

    // ---- coefficientHash：必须由 pipeline.v06CoefficientHash(artifact) 运行时派生 ----
    const coefficient = declarations.get('coefficientHash');
    assert.ok(coefficient, '管线脚本必须定义 coefficientHash');
    assert.ok(
      coefficient.constKeyword,
      'coefficientHash 必须以 const 定义（复核 M4h：定义点改常量即绕过）',
    );
    assert.strictEqual(coefficient.initializers.length, 1, 'coefficientHash 必须恰好定义（初始化）一次');
    assert.ok(
      !reassigned.has('coefficientHash'),
      'coefficientHash 定义后不得重新赋值',
    );
    const coefficientInit = coefficient.initializers[0]!;
    assert.ok(
      ts.isCallExpression(coefficientInit) &&
        ts.isPropertyAccessExpression(coefficientInit.expression) &&
        ts.isIdentifier(coefficientInit.expression.expression) &&
        coefficientInit.expression.expression.text === 'pipeline' &&
        coefficientInit.expression.name.text === 'v06CoefficientHash' &&
        coefficientInit.arguments.length === 1 &&
        ts.isIdentifier(coefficientInit.arguments[0]!) &&
        coefficientInit.arguments[0]!.text === 'artifact',
      `coefficientHash 必须由 pipeline.v06CoefficientHash(artifact) 运行时派生（字面量／常量标识符即绕过，复核 M4h），实际：${coefficientInit.getText(sourceFile)}`,
    );
  });

  test('结构守卫（R2-S1／R3-A1）：模型包导出被阶段 06 结果门控——有 FAIL 不导出、不覆盖既有包；包目录清理只发生在内存构建成功之后', () => {
    const source = stripComments(readFileSync(resolve(here, '../../../../scripts/v06-pipeline.mjs'), 'utf8'));
    const gateIndex = source.indexOf('failed > 0');
    const exportIndex = source.indexOf('writeV06ModelPackage(');
    assert.ok(gateIndex >= 0, '脚本必须统计阶段 06 失败数');
    assert.ok(exportIndex >= 0, '脚本必须包含模型包导出调用');
    assert.ok(
      gateIndex < exportIndex,
      `阶段 06 失败门控（偏移 ${gateIndex}）必须先于导出调用（偏移 ${exportIndex}）`,
    );
    // 复核第三轮 R3-A1（M7b）：脚本先 rmSync 再构建时，导出门控一旦失效，既有包目录会先被删除。
    // 清理动作必须交由导出器在**内存构建成功之后**执行（cleanDirectoryFirst），脚本内不得自带 rmSync。
    assert.ok(
      source.includes('cleanDirectoryFirst'),
      '包目录清理必须经导出器 cleanDirectoryFirst（构建成功后才清理+落盘）',
    );
    assert.ok(
      !source.includes('rmSync('),
      '导出路径不得在脚本里自行 rmSync 包目录（构建失败时不得破坏既有包）——改用导出器 cleanDirectoryFirst',
    );
  });
});

// ---------------------------------------------------------------------------
// 行为守卫（R3-S1）：真实脚本路径上的 folds 篡改必 FAIL（需要归档固化数据；CI 无数据时跳过）
// ---------------------------------------------------------------------------

describe('管线脚本行为守卫（R3-S1）', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '../../../..');
  const scriptPath = resolve(repoRoot, 'scripts', 'v06-pipeline.mjs');
  const INTAKE_RELATIVE = join('data', 'incoming', '2026-09-11-tmall-guanqi-25q4-portraits');
  const FOLDS_RELATIVE = join(
    'experiments',
    '2026-09-11-v0.6-tmall-guanqi-portrait-only',
    'outputs',
    'folds.json',
  );

  /** 与管线脚本同序定位固化 v0.6 包根；找不到（CI 无固化数据）返回 undefined。 */
  function resolveFixedV06Root(): string | undefined {
    const candidates: string[] = [];
    if (process.env.UOM_V06_FIXED_ROOT) candidates.push(resolve(process.env.UOM_V06_FIXED_ROOT));
    if (process.env.UOM_ARCHIVE_FIXED_ROOT) {
      candidates.push(resolve(process.env.UOM_ARCHIVE_FIXED_ROOT));
      candidates.push(join(resolve(process.env.UOM_ARCHIVE_FIXED_ROOT), 'v06-tmall-25q4'));
    }
    try {
      const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (common) {
        candidates.push(
          join(dirname(resolve(repoRoot, common)), 'data', 'archive-modelevol', 'v06-tmall-25q4'),
        );
      }
    } catch {
      // git 不可用时跳过该候选
    }
    candidates.push(join(repoRoot, 'data', 'archive-modelevol', 'v06-tmall-25q4'));
    for (const candidate of candidates) {
      if (existsSync(join(candidate, INTAKE_RELATIVE)) && existsSync(join(candidate, FOLDS_RELATIVE))) {
        return candidate;
      }
    }
    return undefined;
  }

  const fixedRoot = resolveFixedV06Root();

  test('行为层：真实脚本路径上 folds 被换成篡改副本（走实际读取与哈希计算）→ 阶段 02 必 FAIL、不导出', { skip: !fixedRoot && '需要归档固化数据（CI 无固化数据，不接触真实数据）' }, () => {
    const root = fixedRoot!;
    const sandbox = mkdtempSync(join(tmpdir(), 'uom-v06-tamper-'));
    const fakeRoot = join(sandbox, 'fixed-root');
    const outDir = join(sandbox, 'work');
    const packageDir = join(sandbox, 'package');
    mkdirSync(join(fakeRoot, dirname(FOLDS_RELATIVE)), { recursive: true });

    // 临时根：除 folds.json 外逐文件符号链接到真实固化包（只读），folds.json 用篡改副本
    const walk = (source: string, target: string, relative: string): void => {
      mkdirSync(target, { recursive: true });
      for (const entry of readdirSync(source, { withFileTypes: true })) {
        const childRelative = join(relative, entry.name);
        if (childRelative === FOLDS_RELATIVE) continue;
        const childSource = join(source, entry.name);
        const childTarget = join(target, entry.name);
        if (entry.isDirectory()) walk(childSource, childTarget, childRelative);
        else symlinkSync(childSource, childTarget);
      }
    };
    walk(root, fakeRoot, '');

    // 篡改副本：真实 folds.json 字节翻 1 字节（seed 数值首位数字 +1）——哈希随之改变
    const realFolds = readFileSync(join(root, FOLDS_RELATIVE));
    const marker = Buffer.from('"seed":');
    const markerIndex = realFolds.indexOf(marker);
    assert.ok(markerIndex >= 0, 'folds.json 应含 seed 字段');
    const tampered = Buffer.from(realFolds);
    let digitIndex = markerIndex + marker.length;
    while (digitIndex < tampered.length && (tampered[digitIndex] === 32 || tampered[digitIndex] === 9)) {
      digitIndex += 1; // 跳过冒号后的空白（"seed": 20260911）
    }
    const digit = tampered[digitIndex]!;
    assert.ok(digit >= 48 && digit <= 56, `seed 首位应是数字，实际 ${String.fromCharCode(digit)}`);
    tampered[digitIndex] = digit + 1;
    const realSha = createHash('sha256').update(realFolds).digest('hex');
    const tamperedSha = createHash('sha256').update(tampered).digest('hex');
    assert.notEqual(tamperedSha, realSha, '一字节篡改必须改变文件哈希');
    writeFileSync(join(fakeRoot, FOLDS_RELATIVE), tampered);

    // 跑真实脚本：显式 --root（沙箱根）与 --out／--package-dir（沙箱），不触碰主仓 models/
    const result = spawnSync(
      process.execPath,
      [scriptPath, '--root', fakeRoot, '--out', outDir, '--package-dir', packageDir],
      { encoding: 'utf8', timeout: 300000 },
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    assert.notEqual(
      result.status,
      0,
      `篡改 folds 的根上管线必须失败，实际退出码 ${result.status}。输出：\n${output.slice(0, 2000)}`,
    );
    assert.ok(
      output.includes('阶段 02'),
      '失败必须发生在阶段 02（folds）——应已走过阶段 01。输出：\n' + output.slice(0, 2000),
    );
    assert.ok(
      output.includes('冻结 folds 哈希不一致'),
      `阶段 02 必须以「冻结 folds 哈希不一致」失败（哈希来自实际读取的文件字节）。输出：\n${output.slice(0, 2000)}`,
    );
    assert.ok(
      !existsSync(join(packageDir, 'manifest.json')),
      '失败运行不得导出任何模型包',
    );
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
