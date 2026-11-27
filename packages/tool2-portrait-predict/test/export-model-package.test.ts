/**
 * 模型包导出器 + 黄金测试（P2-7 / M09）。
 *
 * 覆盖：
 * - 包恰好 3 个文件（`predict.mjs` / `manifest.json` / `README.md`）；
 * - `manifest.formatVersion === 1`；
 * - `manifest.usage.outputs` 为**扁平列**（`<维度>__<标签>`），`usage.inputs` 为白名单列；
 * - `data.fingerprint.sha256` 由宿主侧对原始输入计算（测试独立复算比对）；
 * - **无 `/predict` 端点**（包内不起 HTTP 服务）；
 * - 黄金测试：固定输入行 → **精确**期望分布（容差 0）；
 * - 连跑两次：模型区（`predict.mjs`）字节一致。
 *
 * 夹具全部为**合成数据**：手写工件与合成训练集，不含任何真实商品／人群样本。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildV06ModelPackage,
  writeV06ModelPackage,
} from '../src/export/model-package.js';
import { trainV06FinalModel } from '../src/pipeline/v06/04-select-final.js';
import { V06_TARGET_DIMENSIONS, type V06Sample } from '../src/pipeline/v06/lib/types.js';

// ---------------------------------------------------------------------------
// 合成夹具
// ---------------------------------------------------------------------------

const FIXED_TRAINED_AT = '2026-01-01T00:00:00.000Z';

/** 手写工件：单维度、单特征，系数可手算 → 期望分布可解析验证。 */
function handwrittenArtifact() {
  return {
    version: 'uom-tool2-portrait-v06-1',
    scope: 'synthetic',
    coefficients: {
      targetDimensions: ['预测性别'],
      featureMinCount: 3,
      alphaCandidates: [5],
      selectedConfig: { name: 'handwritten', groups: ['fit'] },
      dimensionModels: [
        {
          labelType: '预测性别',
          labels: ['男', '女'],
          alpha: 5,
          featureNames: ['fit_宽松型'],
          models: [
            { w: [0.5], b: 0.25, mean: [0], std: [1] },
            { w: [-0.5], b: 0.75, mean: [0], std: [1] },
          ],
        },
      ],
    },
    provenance: {
      trainedAt: FIXED_TRAINED_AT,
      experiment: 'synthetic',
      sampleCount: 2,
      notes: [],
    },
  };
}

/** 合成训练集（两个维度，单一特征取值有区分度）。 */
function syntheticSamples(): V06Sample[] {
  return Array.from({ length: 8 }, (_, index) => {
    const male = 0.2 + 0.05 * (index % 5);
    const portraits = {} as V06Sample['portraits'];
    for (const dimension of V06_TARGET_DIMENSIONS) {
      const share = dimension === '预测性别' ? male : 0.4;
      portraits[dimension] = { 甲: share, 乙: 1 - share };
    }
    return {
      sku: `S${String(index).padStart(3, '0')}`,
      input: {
        sku: `S${String(index).padStart(3, '0')}`,
        fit: index % 2 === 0 ? '宽松型' : '修身型',
        fabric: '棉',
        category: '外套',
        subcategory: '棉外套',
        season: 'Q4',
        productAttribute: '新品',
        ipCollab: '',
        specialFunctionMaterial: '',
      },
      portraits,
    };
  }).sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}

/** 宿主侧计算的原始输入指纹。 */
function hostFingerprint(rows: number, columns: string[]) {
  const payload = JSON.stringify({ rows, columns });
  return {
    sha256: createHash('sha256').update(payload, 'utf8').digest('hex'),
    rows,
    columns,
  };
}

const BASE_INPUT = {
  artifact: handwrittenArtifact(),
  metrics: { js_lift: 0.01 },
  fingerprint: hostFingerprint(93, ['fit', 'fabric']),
  name: 'uom-tool2-portrait-v06',
  version: 1,
  stage: 'Staging',
  goal: '合成夹具',
  splitSeed: 20260911,
  sessionRef: 'synthetic',
  trainedAt: FIXED_TRAINED_AT,
  method: '合成夹具说明',
};

// ---------------------------------------------------------------------------
// 包结构
// ---------------------------------------------------------------------------

describe('模型包结构', () => {
  test('恰好 3 个文件，目录里没有多余产物', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-pkg-'));
    const target = join(dir, 'v1');
    writeV06ModelPackage(BASE_INPUT, target);
    assert.deepEqual(readdirSync(target).sort(), ['README.md', 'manifest.json', 'predict.mjs']);
  });

  test('manifest.formatVersion 为 1', () => {
    const built = buildV06ModelPackage(BASE_INPUT);
    const manifest = JSON.parse(built.files['manifest.json']);
    assert.equal(manifest.formatVersion, 1);
    assert.equal(manifest.model.name, BASE_INPUT.name);
    assert.equal(manifest.model.version, 1);
    assert.equal(manifest.model.stage, 'Staging');
  });

  test('usage.outputs 是扁平列（<维度>__<标签>），usage.inputs 是白名单列', () => {
    const built = buildV06ModelPackage(BASE_INPUT);
    const manifest = JSON.parse(built.files['manifest.json']);
    assert.deepEqual(manifest.usage.outputs, ['预测性别__男', '预测性别__女']);
    for (const column of manifest.usage.outputs) {
      assert.match(column, /^[^\s]+__.+$/);
    }
    assert.ok(manifest.usage.inputs.includes('fit'));
    assert.ok(!manifest.usage.inputs.includes('fab'));
    assert.ok(!manifest.usage.inputs.includes('genderCorrected'));
  });

  test('data.fingerprint.sha256 是宿主侧对原始输入算出的值', () => {
    const built = buildV06ModelPackage(BASE_INPUT);
    const manifest = JSON.parse(built.files['manifest.json']);
    assert.equal(manifest.data.fingerprint.sha256, BASE_INPUT.fingerprint.sha256);
    assert.equal(manifest.data.fingerprint.rows, BASE_INPUT.fingerprint.rows);
    assert.deepEqual(manifest.data.fingerprint.columns, BASE_INPUT.fingerprint.columns);
  });

  test('包内无 HTTP 预测端点、无 HTTP 服务代码', () => {
    const built = buildV06ModelPackage(BASE_INPUT);
    for (const [name, content] of Object.entries(built.files)) {
      // 端点判据：不得出现被引号包裹的 `/predict` 路由
      assert.ok(
        !content.includes("'/predict'") && !content.includes('"/predict"'),
        `${name} 不得出现 HTTP 预测路由`,
      );
      assert.ok(!content.includes('createServer'), `${name} 不得启动 HTTP 服务`);
      assert.ok(!content.includes('node:http'), `${name} 不得引入 HTTP 模块`);
      assert.ok(!/\.listen\s*\(/.test(content), `${name} 不得监听端口`);
    }
  });
});

// ---------------------------------------------------------------------------
// 黄金测试（容差 0）
// ---------------------------------------------------------------------------

describe('黄金测试：固定输入行 → 精确期望分布', () => {
  test('解析可算的期望分布（手写工件，容差 0）', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-pkg-golden-'));
    const target = join(dir, 'v1');
    writeV06ModelPackage(BASE_INPUT, target);
    const module = await import(pathToFileURL(join(target, 'predict.mjs')).href);
    const rows = module.predict([
      {
        fit: '宽松型',
        fabric: '棉',
        category: '外套',
        subcategory: '棉外套',
        season: 'Q4',
        productAttribute: '新品',
        ipCollab: '',
        specialFunctionMaterial: '',
      },
    ]);
    assert.equal(rows.length, 1);
    // 手算：男 = 0.25 + 0.5 × (1 − 0) / 1 = 0.75；女 = 0.75 − 0.5 × 1 = 0.25；归一化后不变
    assert.equal(rows[0]['预测性别__男'], 0.75);
    assert.equal(rows[0]['预测性别__女'], 0.25);
  });

  test('训练所得工件的期望分布是冻结常量（容差 0）', async () => {
    const samples = syntheticSamples();
    const artifact = trainV06FinalModel(samples, { name: 'golden', groups: ['fit'] });
    const dir = mkdtempSync(join(tmpdir(), 'uom-pkg-golden2-'));
    const target = join(dir, 'v1');
    writeV06ModelPackage(
      {
        ...BASE_INPUT,
        artifact,
        fingerprint: hostFingerprint(samples.length, ['fit']),
      },
      target,
    );
    const module = await import(pathToFileURL(join(target, 'predict.mjs')).href);
    const rows = module.predict([
      {
        fit: '宽松型',
        fabric: '棉',
        category: '外套',
        subcategory: '棉外套',
        season: 'Q4',
        productAttribute: '新品',
        ipCollab: '',
        specialFunctionMaterial: '',
      },
    ]);
    // 冻结常量：由本仓库实现的既定输出冻结而成；实现变更必须同步更新本断言。
    // 标签按字典序（码位序）排列：乙 < 甲，因此 models[0] 属于「乙」。
    assert.equal(rows[0]['预测性别__乙'], 0.7178879310344828);
    assert.equal(rows[0]['预测性别__甲'], 0.2821120689655172);
  });
});

// ---------------------------------------------------------------------------
// 可复现性
// ---------------------------------------------------------------------------

describe('可复现性：连跑两次字节一致', () => {
  test('predict.mjs 两次构建字节一致', () => {
    const first = buildV06ModelPackage(BASE_INPUT);
    const second = buildV06ModelPackage(BASE_INPUT);
    assert.equal(first.files['predict.mjs'], second.files['predict.mjs']);
    assert.equal(
      createHash('sha256').update(first.files['predict.mjs'], 'utf8').digest('hex'),
      createHash('sha256').update(second.files['predict.mjs'], 'utf8').digest('hex'),
    );
  });

  test('固定 trainedAt 时 manifest.json 也字节一致', () => {
    const first = buildV06ModelPackage(BASE_INPUT);
    const second = buildV06ModelPackage(BASE_INPUT);
    assert.equal(first.files['manifest.json'], second.files['manifest.json']);
  });

  test('训练两次的系数区字节一致', () => {
    const samples = syntheticSamples();
    const config = { name: 'repro', groups: ['fit', 'fabric'] };
    const first = trainV06FinalModel(samples, config, { trainedAt: FIXED_TRAINED_AT });
    const second = trainV06FinalModel(samples, config, { trainedAt: '2099-01-01T00:00:00.000Z' });
    assert.equal(
      createHash('sha256').update(JSON.stringify(first.coefficients), 'utf8').digest('hex'),
      createHash('sha256').update(JSON.stringify(second.coefficients), 'utf8').digest('hex'),
    );
  });
});

// ---------------------------------------------------------------------------
// 导出包与管线预测的一致性
// ---------------------------------------------------------------------------

describe('导出包与管线口径一致', () => {
  test('同一输入行上，导出包的预测与管线预测逐值相同', async () => {
    const samples = syntheticSamples();
    const artifact = trainV06FinalModel(samples, { name: 'consistency', groups: ['fit'] });
    const dir = mkdtempSync(join(tmpdir(), 'uom-pkg-consistency-'));
    const target = join(dir, 'v1');
    writeV06ModelPackage(
      { ...BASE_INPUT, artifact, fingerprint: hostFingerprint(samples.length, ['fit']) },
      target,
    );
    const module = await import(pathToFileURL(join(target, 'predict.mjs')).href);
    const rows = module.predict([
      {
        fit: '宽松型',
        fabric: '棉',
        category: '外套',
        subcategory: '棉外套',
        season: 'Q4',
        productAttribute: '新品',
        ipCollab: '',
        specialFunctionMaterial: '',
      },
    ]);
    const expected = artifact.coefficients.dimensionModels[0]!;
    const x = expected.featureNames.map((name) => (name === 'fit_宽松型' ? 1 : 0));
    const raw = expected.models.map((model) => {
      let value = model.b;
      for (let j = 0; j < x.length; j += 1) {
        value += model.w[j]! * ((x[j]! - model.mean[j]!) / model.std[j]!);
      }
      return value;
    });
    const clipped = raw.map((value) => Math.max(0, value));
    const total = clipped.reduce((a, b) => a + b, 0);
    const normalized = total > 0 ? clipped.map((value) => value / total) : [];
    // 逐标签对应（labels 与 models 同序）
    expected.labels.forEach((label, index) => {
      assert.equal(rows[0][`预测性别__${label}`], normalized[index]);
    });
  });
});
