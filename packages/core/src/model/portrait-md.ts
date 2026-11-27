/**
 * 画像 Markdown 解析（**同名标签求和**版）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/capabilities/product-channel-fit/experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/core.mts`
 *   逻辑位置：`parsePortraitMd`（第 57–78 行）。
 *
 * ## 移植时修掉的归档缺陷（工程规范 §7「明确不继承清单」第 6 条）
 *
 * 归档 `parsePortraitMd` 对**同名标签**用**覆盖**语义（`dist[label] = share`）：
 * 同一维度里同名标签再次出现时，前一次的份额被**丢弃**，分布总份额因此偏低。
 * P2 规格 §7 第 6 条明确要求：**不继承 v0.6 的覆盖式画像解析（丢份额）**，
 * 改用 **v0.7 的同名标签求和**语义。因此本实现对同名标签**累加**，
 * 再按维度归一化到 1。
 *
 * ## 口径
 *
 * - 输入行格式：`| 标签类型 | 标签 | 占比% | ... |`（其余列忽略）。
 * - 只认**百分比**取值（`占比` 列）；无法解析的行直接跳过。
 * - 归一化：按维度把各标签份额归一化到合计 1（与归档一致）。
 * - 空维度不产生条目；空文本返回空 Map。
 *
 * 本文件不读写业务数据之外的内容，也不访问网络；只做纯文本解析。
 */

import { readFileSync } from 'node:fs';

/** 标签 → 份额 的分布。 */
export interface PortraitDistribution {
  [label: string]: number;
}

/** 匹配画像表格行：`| 标签类型 | 标签 | 占比% |`（与归档同一行式）。 */
const PORTRAIT_ROW = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)%/;

/** 解析画像 Markdown 文本，返回「维度 → 标签份额分布」。 */
export function parsePortraitMd(text: string): Map<string, PortraitDistribution> {
  const dimensions = new Map<string, PortraitDistribution>();
  for (const line of text.split('\n')) {
    const matched = PORTRAIT_ROW.exec(line);
    if (!matched) continue;
    const dimension = matched[1]!;
    const label = matched[2]!;
    const share = Number(matched[3]!) / 100;
    if (!Number.isFinite(share)) continue;
    const distribution = dimensions.get(dimension) ?? {};
    // 同名标签求和（v0.7 语义；归档是覆盖式，会丢份额）
    distribution[label] = (distribution[label] ?? 0) + share;
    dimensions.set(dimension, distribution);
  }

  // 按维度归一化到 1（与归档一致）
  for (const distribution of dimensions.values()) {
    const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
    if (total <= 0) continue;
    for (const label of Object.keys(distribution)) {
      distribution[label] = (distribution[label] ?? 0) / total;
    }
  }
  return dimensions;
}

/** 读取并解析画像 Markdown 文件。 */
export function parsePortraitMdFile(path: string): Map<string, PortraitDistribution> {
  // 读取失败保持 Node 原生 ENOENT 语义（不吞异常、不改写错误类型）
  return parsePortraitMd(readFileSync(path, 'utf8'));
}

/** 把分布转成普通对象（键序保持解析顺序）。 */
export function portraitDistributionToObject(
  distribution: PortraitDistribution,
): Record<string, number> {
  return { ...distribution };
}
