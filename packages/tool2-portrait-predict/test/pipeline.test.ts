import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALPHA_GRID,
  DOCUMENTED_DUPLICATE_SKU_IDS,
  HOLDOUT_OVERLAP_IDS,
  fastLooAlphaSelection,
  runLeakageGate,
  selectAlpha,
} from '../src/pipeline/03-select-alpha.js';
import {
  compliantFeatureSetChoice,
  loadV04Packages,
  originalFeatureSetChoice,
  runV04Fidelity,
} from '../src/pipeline/run-v04-fidelity.js';
import {
  V04_COMPLIANT_FEATURE_SET,
  type V04CompliantProductInput,
} from '@uom/core/model/features-v04-compliant';
import type { TargetsByDimension } from '@uom/core/model/sample-package';

/**
 * 工具2（预测画像）管线单测（P2-4 / P2-5）。
 *
 * 覆盖：alpha 选择规则、fast LOO 的输出形态、泄漏门禁的 5 条判据、
 * 固化数据读取的 fail-closed、两套特征集的口径隔离。
 */

const DIM = '预测性别';

/** 合成训练数据：4 个样本，标签份额固定。 */
function syntheticTraining(): {
  samples: V04CompliantProductInput[];
  targetsByDimension: TargetsByDimension;
} {
  const samples: V04CompliantProductInput[] = [
    { skuId: 'S1', fitType: '修身型', fabric: '全棉' },
    { skuId: 'S2', fitType: '宽松型', fabric: '牛仔' },
    { skuId: 'S3', fitType: '合体型', fabric: '羊毛' },
    { skuId: 'S4', fitType: 'A型', fabric: '真丝' },
  ];
  const targetsByDimension: TargetsByDimension = new Map([
    [DIM, new Map<string, number[]>([['男', [0.3, 0.3, 0.3, 0.3]], ['女', [0.7, 0.7, 0.7, 0.7]]])],
  ]);
  return { samples, targetsByDimension };
}

/** 健康的泄漏门禁输入（含归档登记的已知重叠款号）。 */
function healthyGateInput() {
  return {
    trainSkuIds: ['T1', 'T2', 'T3', '109926124101'],
    holdoutSkuIds: ['H1', '109926124101'],
    trainSourceBatchIds: ['q2_portrait_train_batch_20260708'],
    holdoutSourceBatchIds: ['25q3_holdout_20260711'],
    holdoutTimeWindows: ['2025Q3'],
    evaluatedSampleCount: 1,
  };
}

describe('alpha 选择规则', () => {
  test('top1 优先', () => {
    assert.equal(
      selectAlpha([
        { alpha: 1, top1: 0.5, top3: 0.9 },
        { alpha: 50, top1: 0.6, top3: 0.2 },
      ]),
      50,
    );
  });

  test('top1 相同则比 top3', () => {
    assert.equal(
      selectAlpha([
        { alpha: 1, top1: 0.5, top3: 0.9 },
        { alpha: 50, top1: 0.5, top3: 0.7 },
      ]),
      1,
    );
  });

  test('top1/top3 都相同则取较小 alpha', () => {
    assert.equal(
      selectAlpha([
        { alpha: 50, top1: 0.5, top3: 0.9 },
        { alpha: 0.5, top1: 0.5, top3: 0.9 },
      ]),
      0.5,
    );
  });

  test('空结果明确失败', () => {
    assert.throws(() => selectAlpha([]), /没有可用的 LOO 结果/);
  });
});

describe('fast LOO alpha 选择', () => {
  test('每个 alpha 返回一条结果，取值落在 [0,1]', () => {
    const { samples, targetsByDimension } = syntheticTraining();
    const results = fastLooAlphaSelection(
      { samples, targetsByDimension, featureSet: V04_COMPLIANT_FEATURE_SET },
      [1, 10, 50],
    );
    assert.equal(results.length, 3);
    for (const result of results) {
      assert.ok(result.top1 >= 0 && result.top1 <= 1);
      assert.ok(result.top3 >= 0 && result.top3 <= 1);
    }
    assert.deepEqual(results.map((r) => r.alpha), [1, 10, 50]);
  });

  test('默认 alpha 网格与归档一致', () => {
    assert.deepEqual([...ALPHA_GRID], [0.1, 0.5, 1, 2, 5, 10, 50]);
  });

  test('样本不足时明确失败', () => {
    const { targetsByDimension } = syntheticTraining();
    assert.throws(
      () =>
        fastLooAlphaSelection({
          samples: [{ skuId: 'S1', fitType: '修身型', fabric: '全棉' }],
          targetsByDimension,
          featureSet: V04_COMPLIANT_FEATURE_SET,
        }),
      /训练样本不足/,
    );
  });
});

describe('泄漏门禁：5 条判据', () => {
  test('健康输入下 5 条全部 pass', () => {
    const checks = runLeakageGate(healthyGateInput());
    assert.equal(checks.length, 5);
    assert.ok(checks.every((check) => check.result === 'pass'), JSON.stringify(checks));
  });

  test('出现未登记的重叠款号即 fail', () => {
    const base = healthyGateInput();
    const input = {
      ...base,
      trainSkuIds: [...base.trainSkuIds, 'H2'],
      holdoutSkuIds: [...base.holdoutSkuIds, 'H2'],
    };
    const checks = runLeakageGate(input);
    assert.equal(checks[0]!.result, 'fail');
    assert.ok((checks[0]!.detail ?? '').includes('H2'));
  });

  test('strict 样本数与已知重叠数不一致即 fail', () => {
    const input = { ...healthyGateInput(), evaluatedSampleCount: 2 };
    const checks = runLeakageGate(input);
    assert.equal(checks[1]!.result, 'fail');
  });

  test('留出款号进入训练集即 fail', () => {
    const input = { ...healthyGateInput(), trainSkuIds: ['T1', 'T2', 'T3', '109926124101', 'H1'] };
    const checks = runLeakageGate(input);
    assert.equal(checks[2]!.result, 'fail');
  });

  test('出现未来批次即 fail', () => {
    const input = {
      ...healthyGateInput(),
      holdoutSourceBatchIds: ['26q3_future_prediction_20260711'],
    };
    const checks = runLeakageGate(input);
    assert.equal(checks[3]!.result, 'fail');
  });

  test('训练包内出现重复款号即 fail', () => {
    const input = { ...healthyGateInput(), trainSkuIds: ['T1', 'T1', 'T3', '109926124101'] };
    const checks = runLeakageGate(input);
    assert.equal(checks[4]!.result, 'fail');
  });

  test('已知重叠款号与登记的重复款号是归档记录值', () => {
    assert.deepEqual([...HOLDOUT_OVERLAP_IDS], ['109926124101']);
    assert.deepEqual([...DOCUMENTED_DUPLICATE_SKU_IDS], ['109926124001', '109926124101']);
  });
});

describe('特征集口径隔离', () => {
  test('原特征集与合规特征集是不同标识', () => {
    assert.equal(originalFeatureSetChoice().id, 'v04-original');
    assert.equal(compliantFeatureSetChoice().id, 'v04-compliant');
  });

  test('合规投影丢弃人工字段', () => {
    const projected = compliantFeatureSetChoice().toInput({
      skuId: 'C1',
      fitType: '修身型',
      fabric: '全棉',
      fab: '卖点',
      mentalProduct: '心智',
      memoryPoint: '记忆点',
      groupTag: '显瘦T',
    });
    // 合规输入类型里没有人工字段，因此只能用运行时键检查
    for (const forbidden of ['fab', 'mentalProduct', 'memoryPoint', 'groupTag']) {
      assert.equal(forbidden in projected, false, `合规投影不应含 ${forbidden}`);
    }
    assert.equal(projected.fitType, '修身型');
    assert.equal(projected.fabric, '全棉');
  });

  test('原特征集保留 FAB（忠实门对照用）', () => {
    const projected = originalFeatureSetChoice().toInput({
      skuId: 'C1',
      fitType: '修身型',
      fabric: '全棉',
      fab: '卖点',
    });
    assert.equal(projected.fab, '卖点');
  });
});

describe('固化数据读取', () => {
  test('缺少固化目录时明确失败', () => {
    assert.throws(() => loadV04Packages('/nonexistent/uom/v04-holdout'), /ENOENT|no such file/);
  });
});

describe('管线编排', () => {
  test('缺少固化数据时不产出结果（fail-closed）', () => {
    assert.throws(
      () =>
        runV04Fidelity({
          packages: { root: '/nonexistent', train: { path: '', products: [], portraitRows: [] }, holdout: { path: '', products: [], portraitRows: [] } },
          choice: compliantFeatureSetChoice(),
        }),
      /训练样本|目标份额|对齐/,
    );
  });
});
