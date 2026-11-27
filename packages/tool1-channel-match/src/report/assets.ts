import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * 设计基底的来源。
 *
 * 报告复用工作台的设计系统（`site/web/assets/base.css`），生成时读取并内联，
 * 保证「样式只有一份」；找不到文件时明确报错，不静默降级成无样式页面。
 */
const BASE_CSS_RELATIVE = join('site', 'web', 'assets', 'base.css');

/**
 * 从给定目录向上找仓库根（含 `site/web/assets/base.css` 的那一层）。
 * 找不到返回 undefined，**不抛错**（输出守卫等场景需要「不在仓库内」的判定）。
 */
export function tryFindRepoRoot(start: string = process.cwd()): string | undefined {
  let dir = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, BASE_CSS_RELATIVE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** 从给定目录向上找到仓库根；找不到直接抛错。 */
export function findRepoRoot(start: string = process.cwd()): string {
  const found = tryFindRepoRoot(start);
  if (!found) {
    throw new Error(
      `找不到设计基底 ${BASE_CSS_RELATIVE}：从 ${resolve(start)} 向上未找到站点目录。请在仓库内运行，或先构建 site/web。`,
    );
  }
  return found;
}

/** 读取设计基底内容。 */
export function readBaseCss(start: string = process.cwd()): string {
  return readFileSync(join(findRepoRoot(start), BASE_CSS_RELATIVE), 'utf-8');
}
