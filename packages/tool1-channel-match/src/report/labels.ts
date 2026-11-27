import { DIMENSIONS } from '@uom/core';

/**
 * 维度显示名。
 *
 * 词表来自 `packages/core` 的维度目录（单一来源）；这里只做展示用的缩写，
 * 去掉口径说明里的括号内容（如「策略人群（泛人群）」→「策略人群」）。
 */
const LABELS = new Map(
  DIMENSIONS.map((dimension) => [dimension.id, dimension.label.replace(/（[^）]*）/g, '')]),
);

/** 维度显示名；未登记的维度回落到原标识。 */
export function dimensionLabel(id: string): string {
  return LABELS.get(id) ?? id;
}
