/**
 * XLSX 读取助手的**转发出口**（不是第二份实现）。
 *
 * 背景：工具2 包（`packages/tool2-portrait-predict`）需要读 v0.6 冻结 intake 的
 * 商品信息表（XLSX）。P2 规格 M04 要求「CSV/XLSX 全走 `normalize/csv.ts`／`normalize/xlsx.ts`」，
 * 因此**不允许**在工具2 侧另写一份读表实现。
 *
 * 但 `packages/core/package.json` 的 `exports` 目前只开放了 `"."` 与 `"./model/*"`
 * （2026-11-27 用户授权范围），`packages/core/src/index.ts` 又不在 P2 规格 §6 的允许修改路径内，
 * 因此工具2 无法直接 `import '@uom/core/normalize/xlsx'`。
 *
 * 本文件在**已获授权的** `packages/core/src/model/**` 路径下开一个转发口，
 * 让工具2 能以 `@uom/core/model/xlsx-rows` 引用到**同一份**实现，
 * 既不复制逻辑、也不改动 core 的任何既有行为。
 *
 * 若后续把 `"./normalize/*"` 加入 core 的 exports（或把读表助手并入 core 包根导出），
 * 本转发口即可删除，调用方改为直接引用即可。
 */

export { findHeaderRow, readXlsxRows } from '../normalize/xlsx.js';
