#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { buildDemoReport } from './demo/build.js';
import {
  buildDataRootDataset,
  buildReferenceDataset,
  buildReportInput,
  scoreDataset,
} from './dataset/index.js';
import type { MatchDataset } from './dataset/types.js';
import { buildMismatchList, mismatchCsv } from './report/mismatch.js';
import { renderReport } from './report/render.js';
import type { ReportInput } from './report/types.js';

/**
 * 工具1 命令行入口。
 *
 * 三种产物：
 * - `--demo`         合成演示报告（不含真实业务数据，可随站点发布）
 * - `--dataset reference`  抖音参考数据（只读）的真实报告
 * - `--dataset data`        `data/` 正式路径的真实报告
 *
 * 真实产物的输出目录默认在 `data/reports/` 下（已 gitignore），**不得发布**。
 */

interface Args {
  demo: boolean;
  dataset: 'data' | 'reference' | null;
  dataRoot: string;
  referenceRoot: string | undefined;
  month: string | undefined;
  out: string | undefined;
  top: number;
}

const USAGE = `用法：
  uom-tool1 --demo [--out <文件路径>] [--top <条数>]
  uom-tool1 --dataset reference [--reference-root <目录>] [--month <YYYY-MM>] [--out <目录>] [--top <条数>]
  uom-tool1 --dataset data [--data-root <目录>] [--month <YYYY-MM>] [--out <目录>] [--top <条数>]

  --demo             生成合成演示报告（默认输出 site/web/tool1-report.html）
  --dataset          数据来源：reference（抖音参考数据，只读）｜data（本地 data/ 目录）
  --reference-root   参考数据根目录，缺省取环境变量 UOM_REFERENCE_ROOT
  --data-root        本地数据根目录，默认 data
  --month            计算所用自然月，缺省取数据中最新可用月
  --out              输出路径：--demo 为文件路径，其余为输出目录
  --top              错配清单在页面上显示的条数，默认 20（CSV 始终是全量）
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    demo: false,
    dataset: null,
    dataRoot: 'data',
    referenceRoot: process.env.UOM_REFERENCE_ROOT,
    month: undefined,
    out: undefined,
    top: 20,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} 需要一个参数`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--demo':
        args.demo = true;
        break;
      case '--dataset': {
        const value = next();
        if (value !== 'data' && value !== 'reference') {
          throw new Error(`--dataset 只接受 data 或 reference，实际 ${value}`);
        }
        args.dataset = value;
        break;
      }
      case '--data-root':
        args.dataRoot = next();
        break;
      case '--reference-root':
        args.referenceRoot = next();
        break;
      case '--month':
        args.month = next();
        break;
      case '--out':
        args.out = next();
        break;
      case '--top': {
        const value = Number(next());
        if (!Number.isInteger(value) || value <= 0) throw new Error('--top 需要一个正整数');
        args.top = value;
        break;
      }
      case '--help':
      case '-h':
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数：${arg}\n${USAGE}`);
    }
  }
  if (args.demo && args.dataset) {
    throw new Error('--demo 与 --dataset 不能同时使用');
  }
  if (!args.demo && !args.dataset) {
    throw new Error(`需要指定 --demo 或 --dataset。\n${USAGE}`);
  }
  return args;
}

/** 禁止写进数据源目录。 */
function assertNotDataSource(target: string): void {
  const relativePath = relative(process.cwd(), resolve(target));
  if (relativePath.startsWith('..')) return;
  const [first] = relativePath.split('/');
  if (first === 'data' && relativePath.split('/').length > 1) {
    // data/ 下的产物目录是允许的（data/reports/…），但不能写进数据源区
    const second = relativePath.split('/')[1];
    if (second !== 'reports') {
      throw new Error(`拒绝写入数据源目录：${target}`);
    }
  }
}

async function buildDataset(args: Args): Promise<MatchDataset> {
  if (args.dataset === 'reference') {
    if (!args.referenceRoot) {
      throw new Error('缺少参考数据根目录：请用 --reference-root 或环境变量 UOM_REFERENCE_ROOT');
    }
    return buildReferenceDataset({
      root: args.referenceRoot,
      ...(args.month ? { month: args.month } : {}),
    });
  }
  return buildDataRootDataset({
    dataRoot: args.dataRoot,
    ...(args.month ? { month: args.month } : {}),
  });
}

function writeRealReport(dataset: MatchDataset, args: Args): void {
  const results = scoreDataset(dataset);
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const input: ReportInput = buildReportInput(dataset, results, generatedAt);
  const html = renderReport(input, { topN: args.top });
  const { rows } = buildMismatchList(input);
  const csv = mismatchCsv(input, rows);

  const outDir = resolve(args.out ?? `data/reports/tool1/${dataset.source}-${dataset.selectedMonth}`);
  assertNotDataSource(outDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'index.html'), html, 'utf-8');
  writeFileSync(resolve(outDir, 'mismatch.csv'), csv, 'utf-8');
  writeFileSync(
    resolve(outDir, 'match-results.json'),
    `${JSON.stringify({ dataset: { ...dataset, products: dataset.products.length }, results }, null, 2)}\n`,
    'utf-8',
  );
  process.stdout.write(
    `已生成 ${outDir}\n  index.html（${html.length} 字节）· mismatch.csv（${rows.length} 行）· match-results.json（${results.length} 个单元）\n  数据集：${dataset.sourceLabel} · 计算月：${dataset.selectedMonth}\n`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.demo) {
    const input = buildDemoReport();
    const html = renderReport(input, { topN: args.top });
    const out = resolve(args.out ?? 'site/web/tool1-report.html');
    assertNotDataSource(out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html, 'utf-8');
    process.stdout.write(`已生成 ${out}（${html.length} 字节，合成演示数据）\n`);
    return;
  }

  const dataset = await buildDataset(args);
  writeRealReport(dataset, args);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
