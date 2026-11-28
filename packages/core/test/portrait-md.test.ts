/**
 * 画像 Markdown 解析（同名标签求和）单测。
 *
 * 覆盖：正向解析、同名标签求和（v0.7 语义，覆盖归档的丢份额缺陷）、
 * 维度内归一化、非法行跳过、空输入、文件读取。
 *
 * 期望值全部用手算构造的合成文本，**不含任何真实业务数据**。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parsePortraitMd,
  parsePortraitMdFile,
  portraitDistributionToObject,
} from '../src/normalize/portrait-md.js';

/** 合成画像文本：两个维度，其中一个维度含同名标签两行。 */
const SAMPLE_TEXT = [
  '# 合成画像',
  '',
  '| 标签类型 | 标签 | 占比 | TGI |',
  '|---|---|---|---|',
  '| 预测性别 | 女 | 60% |  |',
  '| 预测性别 | 男 | 40% |  |',
  '| 预测年龄段 | [18,24] | 25% |  |',
  '| 预测年龄段 | [18,24] | 25% |  |',
  '| 预测年龄段 | [25,29] | 50% |  |',
  '| 其它行 | 无占比 |  |  |',
  '',
].join('\n');

describe('画像 Markdown 解析', () => {
  test('解析出维度与标签份额', () => {
    const parsed = parsePortraitMd(SAMPLE_TEXT);
    assert.deepEqual([...parsed.keys()], ['预测性别', '预测年龄段']);
    assert.deepEqual(portraitDistributionToObject(parsed.get('预测性别')!), {
      女: 0.6,
      男: 0.4,
    });
  });

  test('同名标签求和（v0.7 语义，不继承归档的覆盖式丢份额）', () => {
    const parsed = parsePortraitMd(SAMPLE_TEXT);
    const age = parsed.get('预测年龄段')!;
    // 同名两行 25% + 25% = 50%（覆盖式解析会只留 25%），再按维度合计 100% 归一化 → 0.5 / 0.5
    assert.equal(age['[18,24]'], 0.5);
    assert.equal(age['[25,29]'], 0.5);
  });

  test('每个维度的份额合计为 1', () => {
    const parsed = parsePortraitMd(SAMPLE_TEXT);
    for (const distribution of parsed.values()) {
      const total = Object.values(distribution).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 1) < 1e-12, `维度份额合计应为 1，实际 ${total}`);
    }
  });

  test('无占比的行被跳过，空文本返回空结果', () => {
    const parsed = parsePortraitMd('| 标签类型 | 标签 | 占比 |\n|---|---|---|\n| X | Y |  |\n');
    assert.equal(parsed.size, 0);
    assert.equal(parsePortraitMd('').size, 0);
  });

  test('从文件读取与从文本解析结果一致', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uom-portrait-'));
    const path = join(dir, 'sample.md');
    writeFileSync(path, SAMPLE_TEXT, 'utf8');
    assert.deepEqual(
      portraitDistributionToObject(parsePortraitMdFile(path).get('预测性别')!),
      portraitDistributionToObject(parsePortraitMd(SAMPLE_TEXT).get('预测性别')!),
    );
  });
});
