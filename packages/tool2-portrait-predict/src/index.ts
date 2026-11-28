/**
 * 工具2（预测画像）管线入口。
 *
 * P2-4：`03-select-alpha`（LOO alpha 选择 + 泄漏门禁）与 `run-v04-fidelity`（v0.4 跨期协议编排）。
 * P2-6：v0.6 六阶段管线（prepare→folds→ablation→select→evaluate→validate）。
 * P2-7：模型包导出器（3 文件包、formatVersion 1、扁平输出列）。
 */
export * from './pipeline/03-select-alpha.js';
export * from './pipeline/run-v04-fidelity.js';
export * from './pipeline/v06/lib/types.js';
export * from './pipeline/v06/lib/features-v06.js';
export * from './pipeline/v06/lib/train-v06.js';
export * from './pipeline/v06/01-prepare-dataset.js';
export * from './pipeline/v06/02-load-folds.js';
export * from './pipeline/v06/03-run-ablation.js';
export * from './pipeline/v06/04-select-final.js';
export * from './pipeline/v06/05-evaluate.js';
export * from './pipeline/v06/06-validate.js';
export * from './pipeline/v06/frozen-inputs.js';
export * from './register/url-guard.js';
export * from './export/model-package.js';
export * from './export/predict-template.js';
