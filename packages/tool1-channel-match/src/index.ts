export * from './report/types.js';
export * from './dataset/index.js';
export { renderReport, type RenderOptions } from './report/render.js';
export {
  buildMismatchList,
  mismatchCsv,
  indexResults,
  MISMATCH_COLUMNS,
  type MismatchList,
  type SkippedMismatch,
} from './report/mismatch.js';
export { escapeHtml, embedJson } from './report/escape.js';
export {
  assertOutputTarget,
  DEMO_ARTIFACT_PATH,
  REPORT_ROOT_PATH,
  type OutputMode,
} from './report/output-guard.js';
export { findRepoRoot, readBaseCss } from './report/assets.js';
export { REPORT_CSS } from './report/styles.js';
export { buildDemoReport, DEMO_MONTH, DEMO_GENERATED_AT } from './demo/build.js';
export { DEMO_CHANNELS, DEMO_PRODUCTS, toPortraitInput } from './demo/fixture.js';
