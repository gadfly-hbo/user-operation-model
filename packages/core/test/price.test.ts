import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRetailAmount, resolveUnitPrice } from '../src/index.js';
import type { ProductDossier } from '../src/index.js';

/**
 * 真实成交单价解析的单一来源（切片 A · SA-08）。
 *
 * `resolveUnitPrice(product, month?)` 是唯一实现：
 * 该月经营指标（零售额、零售量均 > 0）→ actualUnitPrice → unitPrice → missing。
 */

function product(spec: Partial<ProductDossier>): ProductDossier {
  return { spu: 'SPU-P', schemaVersion: '0.2.0', ...spec };
}

describe('resolveUnitPrice · 单一来源（SA-08）', () => {
  test('该月经营指标的零售额与零售量齐全且 > 0 时优先（retail-amount-qty）', () => {
    const target = product({
      performance: { '2026-10': { retailAmount: 12020, retailQty: 40 } },
      price: { unitPrice: 1 },
    });
    assert.deepEqual(resolveUnitPrice(target, '2026-10'), {
      price: 300.5,
      source: 'retail-amount-qty',
    });
  });

  test('该月指标缺零售量时回落到主数据 actualUnitPrice', () => {
    const target = product({
      performance: { '2026-10': { retailAmount: 12020 } },
      price: { actualUnitPrice: 299 },
    });
    assert.deepEqual(resolveUnitPrice(target, '2026-10'), {
      price: 299,
      source: 'actual-unit-price',
    });
  });

  test('主数据 actualUnitPrice 优先于 unitPrice', () => {
    const target = product({ price: { actualUnitPrice: 299, unitPrice: 399 } });
    assert.deepEqual(resolveUnitPrice(target), { price: 299, source: 'actual-unit-price' });
  });

  test('无 actualUnitPrice 时用 unitPrice', () => {
    const target = product({ price: { unitPrice: 399 } });
    assert.deepEqual(resolveUnitPrice(target), { price: 399, source: 'unit-price' });
  });

  test('全部缺失 → missing，不插补兜底价', () => {
    assert.deepEqual(resolveUnitPrice(product({ price: {} })), { source: 'missing' });
    assert.deepEqual(resolveUnitPrice(product({})), { source: 'missing' });
  });

  test('零售额或零售量为 0／负值时不按该口径推导', () => {
    const zeroQty = product({ performance: { '2026-10': { retailAmount: 100, retailQty: 0 } } });
    assert.deepEqual(resolveUnitPrice(zeroQty, '2026-10'), { source: 'missing' });
    const negative = product({ performance: { '2026-10': { retailAmount: -5, retailQty: 2 } } });
    assert.deepEqual(resolveUnitPrice(negative, '2026-10'), { source: 'missing' });
  });

  test('不传 month 时跳过月度指标层（其次主数据）', () => {
    const target = product({
      performance: { '2026-10': { retailAmount: 12020, retailQty: 40 } },
      price: { unitPrice: 399 },
    });
    assert.deepEqual(resolveUnitPrice(target), { price: 399, source: 'unit-price' });
  });

  test('指定月没有指标时跳过月度指标层', () => {
    const target = product({
      performance: { '2026-09': { retailAmount: 12020, retailQty: 40 } },
      price: { unitPrice: 399 },
    });
    assert.deepEqual(resolveUnitPrice(target, '2026-10'), { price: 399, source: 'unit-price' });
  });

  test('两位小数舍入与既有口径一致', () => {
    const target = product({ performance: { '2026-10': { retailAmount: 100, retailQty: 3 } } });
    assert.deepEqual(resolveUnitPrice(target, '2026-10'), {
      price: 33.33,
      source: 'retail-amount-qty',
    });
  });
});

describe('resolveRetailAmount · 错配排序零售额（SA-08）', () => {
  test('该月经营指标的零售额优先', () => {
    const target = product({
      performance: { '2026-10': { retailAmount: 999 } },
      price: { retailAmount: 111 },
    });
    assert.equal(resolveRetailAmount(target, '2026-10'), 999);
  });

  test('该月无指标时用主数据零售额', () => {
    const target = product({
      performance: { '2026-09': { retailAmount: 999 } },
      price: { retailAmount: 111 },
    });
    assert.equal(resolveRetailAmount(target, '2026-10'), 111);
    assert.equal(resolveRetailAmount(target), 111);
  });

  test('两侧都没有 → undefined，不插补', () => {
    assert.equal(resolveRetailAmount(product({ price: {} }), '2026-10'), undefined);
  });
});
