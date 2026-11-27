import { dirname, relative, resolve } from 'node:path';
import { tryFindRepoRoot } from './assets.js';

/**
 * 输出路径守卫。
 *
 * 规则（工程规范 §7 与 P1 规格 §7.5）：
 * - 真实数据产物只允许落在 `data/reports/` 之下
 * - 合成演示产物只允许落在站点的报告页 `site/web/tool1-report.html`
 * - 仓库跟踪路径（`packages/`、`site/`、`docs/`、`openspec/`、`output/`、`scripts/`）一律拒绝
 * - 仓库之外的路径（临时目录等）允许
 */

/** 产物类型。 */
export type OutputMode = 'demo' | 'report';

/** 合成演示产物在站点内的唯一合法位置。 */
export const DEMO_ARTIFACT_PATH = 'site/web/tool1-report.html';

/** 真实数据产物的合法根目录。 */
export const REPORT_ROOT_PATH = 'data/reports';

/** 仓库内禁止写入的跟踪路径。 */
const FORBIDDEN_PREFIXES = ['packages', 'site', 'docs', 'openspec', 'output', 'scripts', '.github'];

/**
 * 校验输出路径。**不合法时抛错**，不静默改写到别处。
 */
export function assertOutputTarget(
  target: string,
  mode: OutputMode,
  repoRoot?: string,
): void {
  const absolute = resolve(target);
  // 仓库根**从目标路径自身向上定位**（再退回当前目录），
  // 不能只认当前工作目录：否则在子目录里用 `../` 指向仓库内的跟踪路径会被误判为「仓库之外」而放行。
  const root = repoRoot ?? tryFindRepoRoot(dirname(absolute)) ?? tryFindRepoRoot(process.cwd());
  if (!root) return; // 不在任何仓库内
  const relativePath = relative(root, absolute);
  // 仓库之外：允许（例如临时目录）
  if (relativePath.startsWith('..')) return;

  const normalized = relativePath.split('/').join('/');
  if (mode === 'demo') {
    if (normalized === DEMO_ARTIFACT_PATH) return;
    throw new Error(
      `拒绝把合成演示产物写到 ${normalized}：演示产物只允许落在 ${DEMO_ARTIFACT_PATH}（或仓库之外的临时目录）。`,
    );
  }
  if (normalized === REPORT_ROOT_PATH || normalized.startsWith(`${REPORT_ROOT_PATH}/`)) return;
  if (FORBIDDEN_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    throw new Error(`拒绝把真实数据产物写到仓库跟踪路径 ${normalized}：只允许 ${REPORT_ROOT_PATH}/ 之下。`);
  }
  throw new Error(
    `拒绝把真实数据产物写到 ${normalized}：只允许 ${REPORT_ROOT_PATH}/ 之下（或仓库之外的临时目录）。`,
  );
}
