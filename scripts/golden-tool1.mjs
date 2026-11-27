#!/usr/bin/env node
/**
 * P1 黄金回归（本地运行，CI 不跑）。
 *
 * 口径（2026-11-27 用户确认）：**同评级 + 冻结新基线**。
 * - 两条锚点必须保持原评级：#1 → A、#5 → C
 * - 五条用例的新总分冻结为回归基线
 * - 五条的客单承接维度分与全局惩罚必须与旧抖音工具逐条一致（输入管线忠实性的证据）
 *
 * 用法：
 *   UOM_REFERENCE_ROOT="$HOME/工作/抖音货渠匹配/product/数据输入" npm run test:golden
 *
 * 缺参考数据时**明确失败**，不跳过、不静默通过。
 * 本文件含款号与店铺名（与工程规范 §4.3 已记录的基准用例一致），不含任何业务数值明细。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReferenceDataset,
  scoreDataset,
} from '../packages/tool1-channel-match/dist/src/dataset/index.js';

const GOLDEN_MONTH = '2026-10';

/** 黄金用例表：旧值来自抖音工具评分规范，新值为本内核冻结的基线。 */
const CASES = [
  {
    id: 'G1',
    label: '¥318.69 女款短羽绒服 @ 直播·森马Semir服饰号',
    spu: '109726113007',
    channel: 'live:森马Semir服饰号',
    old: { total: 91.9, grade: 'A', power: 92, penalty: 0 },
    expect: { total: 95.4, grade: 'A' },
    anchor: true,
  },
  {
    id: 'G2',
    label: '¥85.95 女款连帽卫衣 @ 直播·森马官方旗舰店',
    spu: '101725116010',
    channel: 'live:森马官方旗舰店',
    old: { total: 91.2, grade: 'A', power: 95, penalty: 0 },
    expect: { total: 95.3, grade: 'A' },
    anchor: false,
  },
  {
    id: 'G3',
    label: '¥626.83 女款长羽绒服 @ 直播·森马官方旗舰店',
    spu: '109726113013',
    channel: 'live:森马官方旗舰店',
    old: { total: 78.2, grade: 'B', power: 93, penalty: 0 },
    expect: { total: 87.7, grade: 'A' },
    anchor: false,
  },
  {
    id: 'G4',
    label: '¥626.83 女款长羽绒服 @ 商品卡·森马官方旗舰店',
    spu: '109726113013',
    channel: 'card:森马官方旗舰店',
    old: { total: 59.2, grade: 'C', power: 68, penalty: -4 },
    expect: { total: 68.9, grade: 'B' },
    anchor: false,
  },
  {
    id: 'G5',
    label: '¥626.83 女款长羽绒服 @ 直播·森马旗舰店',
    spu: '109726113013',
    channel: 'live:森马旗舰店',
    old: { total: 40.9, grade: 'C', power: 32, penalty: -10.5 },
    expect: { total: 42, grade: 'C' },
    anchor: true,
  },
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const root = process.env.UOM_REFERENCE_ROOT;
if (!root) {
  fail('缺少 UOM_REFERENCE_ROOT：请指向抖音参考数据根目录后重跑。');
}
if (!existsSync(root)) {
  fail(`参考数据根目录不存在：${root}`);
}

const dataset = buildReferenceDataset({ root, month: GOLDEN_MONTH });
const results = scoreDataset(dataset);

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputFiles = [
  join(root, 'TOP20商品', '商品数据表.csv'),
  join(root, 'TOP20商品', '商品单款人群画像数据', '109726113007画像数据.csv'),
  join(root, 'TOP20商品', '商品单款人群画像数据', '101725116010画像数据.csv'),
  join(root, 'TOP20商品', '商品单款人群画像数据', '109726113013画像数据.csv'),
  join(root, '直播', '森马Semir服饰号', '森马Semir服饰号直播成交2610画像数据.csv'),
  join(root, '直播', '森马官方旗舰店', '森马官旗账号直播成交2610画像数据.csv'),
  join(root, '直播', '森马旗舰店', '森马旗舰账号直播成交2610画像数据.csv'),
  join(root, '商品卡', '森马官方旗舰店', '森马官旗26年10月-商品卡画像数据.csv'),
];

const failures = [];
const lines = [];
lines.push(`黄金回归 · 计算月 ${GOLDEN_MONTH} · 配置 ${dataset.sourceLabel}`);
lines.push('');
lines.push('用例 | 旧总分/评级 | 新总分/评级 | 客单分 | 惩罚 | 结论');
lines.push('--- | --- | --- | --- | --- | ---');

for (const testCase of CASES) {
  const result = results.find(
    (item) => item.spu === testCase.spu && item.channelId === testCase.channel,
  );
  if (!result) {
    failures.push(`${testCase.id} 未找到匹配单元（${testCase.spu} × ${testCase.channel}）`);
    lines.push(`${testCase.id} | — | 未找到 | — | — | FAIL`);
    continue;
  }
  const power = result.dimensions.find((item) => item.dimension === 'spending_power');
  const powerScore = power?.score ?? null;
  const penalty = result.priceFit?.penalty ?? 0;
  const total = result.totalScore;
  const grade = result.grade;

  const problems = [];
  if (total !== testCase.expect.total) {
    problems.push(`总分 ${total} ≠ 基线 ${testCase.expect.total}`);
  }
  if (grade !== testCase.expect.grade) {
    problems.push(`评级 ${grade} ≠ 基线 ${testCase.expect.grade}`);
  }
  if (powerScore !== testCase.old.power) {
    problems.push(`客单维度分 ${powerScore} ≠ 旧工具 ${testCase.old.power}`);
  }
  if (penalty !== testCase.old.penalty) {
    problems.push(`惩罚 ${penalty} ≠ 旧工具 ${testCase.old.penalty}`);
  }
  if (testCase.anchor && grade !== testCase.old.grade) {
    problems.push(`锚点评级 ${grade} ≠ 旧工具 ${testCase.old.grade}`);
  }
  if (problems.length > 0) {
    failures.push(`${testCase.id} ${testCase.label}：${problems.join('；')}`);
  }

  const gradeShift = grade !== testCase.old.grade ? `（旧 ${testCase.old.grade}）` : '';
  lines.push(
    `${testCase.id}${testCase.anchor ? '（锚点）' : ''} | ${testCase.old.total} ${testCase.old.grade} | ${total} ${grade}${gradeShift} | ${powerScore} | ${penalty} | ${problems.length === 0 ? 'PASS' : 'FAIL'}`,
  );
}

lines.push('');
lines.push('输入文件 SHA-256：');
for (const file of inputFiles) {
  if (!existsSync(file)) {
    lines.push(`  （缺失）${file}`);
    continue;
  }
  lines.push(`  ${sha256(file)}  ${file.replace(`${root}/`, '')}`);
}

process.stdout.write(`${lines.join('\n')}\n`);

if (failures.length > 0) {
  process.stderr.write(`\n黄金回归未通过：\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write('\n黄金回归通过。\n');
