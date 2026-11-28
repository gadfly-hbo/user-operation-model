#!/usr/bin/env node
// 演示报告等价比对（切片 A · SA-12 验收修正）。
//
// 用法：node demo-equivalence.mjs <before.json> <after.json> <out.json>
// 输入是 dump-demo.mjs 导出的两份演示结果 JSON（{ generatedAt, configVersion, results }）。
//
// 判据：变化单元必须全部可由「被排除的单侧标签」解释——SA-06 把相似度改为只在
// 公共标签的重归一化分布上计算后，单侧标签被排除会改变该维度的得分与证据；
// 不带被排除标签的差异视为无法解释，脚本以非零退出码报告。
//
// 数值比较带 1e-9 容差：重归一化会把 Top3 证据里的展示占比留下浮点尾差
// （如 0.36 → 0.36000000000000004），得分与相似度本身逐位一致；这是表示噪声，
// 不是口径差异。除此之外的结构差异（维度增删、missingReason、评级、熔断）一律算变化。
import { readFileSync, writeFileSync } from 'node:fs';

const [beforePath, afterPath, outPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outPath) {
  console.error('用法：node demo-equivalence.mjs <before.json> <after.json> <out.json>');
  process.exit(2);
}

const EPSILON = 1e-9;

/** 数值感知的深比较：数字按容差，列表按序，其余按相等。 */
function isEquivalent(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= EPSILON;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isEquivalent(item, b[index]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => isEquivalent(a[key], b[key]))
    );
  }
  return a === b;
}

const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));
const unitKey = (unit) => `${unit.spu}|${unit.channelId}`;
const beforeByUnit = new Map(before.results.map((unit) => [unitKey(unit), unit]));

const changedUnits = [];
const dimensionCounts = {};
const gradeMigrations = {};
let unchanged = 0;
let unexplained = 0;

for (const unit of after.results) {
  const key = unitKey(unit);
  const old = beforeByUnit.get(key);
  if (!old) {
    console.error(`无法解释：单元 ${key} 在基线中不存在`);
    process.exit(1);
  }
  beforeByUnit.delete(key);
  if (isEquivalent(unit, old)) {
    unchanged += 1;
    const migration = `${old.grade}->${unit.grade}`;
    gradeMigrations[migration] = (gradeMigrations[migration] ?? 0) + 1;
    continue;
  }
  const changedDimensions = [];
  const excludedProductLabels = [];
  const excludedChannelLabels = [];
  let explainable = true;
  for (const dimension of unit.dimensions) {
    const oldDimension = old.dimensions.find((item) => item.dimension === dimension.dimension);
    if (isEquivalent(dimension, oldDimension)) continue;
    changedDimensions.push(dimension.dimension);
    dimensionCounts[dimension.dimension] = (dimensionCounts[dimension.dimension] ?? 0) + 1;
    const evidence = dimension.evidence ?? {};
    const product = evidence.excludedProductLabels ?? [];
    const channel = evidence.excludedChannelLabels ?? [];
    excludedProductLabels.push(...product);
    excludedChannelLabels.push(...channel);
    // 可解释 = 该维度带被排除的单侧标签（SA-06 公共标签口径的直接后果）
    if (product.length === 0 && channel.length === 0) explainable = false;
  }
  if (!explainable) unexplained += 1;
  changedUnits.push({
    unit: key,
    changedDimensions,
    explainable,
    excludedProductLabels,
    excludedChannelLabels,
    totalScoreBefore: old.totalScore,
    totalScoreAfter: unit.totalScore,
    scoreDelta: Math.abs((unit.totalScore ?? 0) - (old.totalScore ?? 0)),
    gradeBefore: old.grade,
    gradeAfter: unit.grade,
  });
  const migration = `${old.grade}->${unit.grade}`;
  gradeMigrations[migration] = (gradeMigrations[migration] ?? 0) + 1;
}

if (beforeByUnit.size > 0) {
  console.error(`无法解释：基线中有 ${beforeByUnit.size} 个单元在改动后消失`);
  process.exit(1);
}

const deltas = changedUnits.map((unit) => unit.scoreDelta);
const report = {
  criterion: '变化单元必须全部可由「被排除的单侧标签」解释；数值比较带 1e-9 容差（重归一化浮点尾差）',
  beforeConfigVersion: before.configVersion,
  afterConfigVersion: after.configVersion,
  totalUnits: after.results.length,
  unchanged,
  changed: changedUnits.length,
  changedDimensions: dimensionCounts,
  allChangesExplained: unexplained === 0,
  unexplainedCount: unexplained,
  changedUnits,
  scoreDelta: {
    max: deltas.length > 0 ? Math.max(...deltas) : 0,
    mean: deltas.length > 0 ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0,
  },
  gradeMigrations,
};

writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  [
    `units=${report.totalUnits} unchanged=${unchanged} changed=${changedUnits.length}`,
    `dims=${JSON.stringify(dimensionCounts)}`,
    `scoreDelta max=${report.scoreDelta.max.toFixed(4)} mean=${report.scoreDelta.mean.toFixed(4)}`,
    `migrations=${JSON.stringify(gradeMigrations)}`,
    unexplained === 0 ? 'RESULT: 全部变化可由被排除的单侧标签解释' : `RESULT: ${unexplained} 个单元无法解释`,
  ].join(' · '),
);
process.exit(unexplained === 0 ? 0 : 1);
