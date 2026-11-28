#!/usr/bin/env node
/**
 * B1 数据守卫（复核修单新增）：tracked 文本文件不得包含归档 work-package 的真实业务内容。
 *
 * 背景（review-p2.md B1）：`packages/core/test/model-v04.test.ts` 曾把归档
 * `product_attributes.jsonl` 第 1 行真实商品记录（款号、属性组合、整段 FAB 卖点原文）逐字抄进
 * tracked 测试。既有 `check-data-guard.py` 只查「数据目录／数据文件／超大文件」，
 * 拦不住**测试源码里的业务内容**——本脚本补上这一层。
 *
 * 做法（黑名单不入库）：运行时从主仓 `data/archive-modelevol/` 固化区读取若干真实行，
 * 现场构造子串黑名单，再对 `git ls-files` 的全部 tracked 文本文件做子串匹配。
 * 黑名单内容**只存在于运行期内存**，本脚本与仓库里都不含任何真实业务片段。
 *
 * 黑名单来源（均为归档固化区，gitignore）：
 *   1. `v04-holdout/work-package/{train,holdout}/product_attributes.jsonl`
 *      前 N 行里非空 `fab` 字段的中段片段（FAB 卖点原文），以及记录前缀（款号+属性组合）；
 *   2. `v04-holdout/work-package/{train,holdout}/platform_portrait.csv`
 *      前 N 条数据行（整行画像数值，含真实款号与份额小数）；
 *   3. `v06-tmall-25q4/data/incoming/<intake>/raw-portraits/*.md`
 *      前 N 个文件的「人群组名／来源文件」行（真实店铺／人群名称与账号文件名）。
 *
 * 输出纪律：命中时只打印文件路径与黑名单条目编号＋长度，**不回显黑名单内容**（避免日志二次留存）。
 *
 * 退出码：命中或固化区不可用 → 1（fail-closed，不静默跳过）；干净 → 0。
 *
 * 运行方式（本地；CI 无固化数据、不跑本脚本）：
 *   node scripts/check-no-archive-content.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

/** 每类黑名单的取样上限（控制运行时长；样本行远多于上限时随机取前 N 行已足够代表）。 */
const LIMITS = { jsonlRecords: 12, fabFragmentsPerRecord: 2, csvRows: 6, portraitFiles: 8 };

/** 文本文件按扩展名判定；无扩展名的逐字节探查（含 NUL 即视为二进制）。 */
const TEXT_EXTENSIONS = new Set([
  '', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
  '.html', '.css', '.py', '.sh', '.svg', '.xml',
]);

function mainWorktreeRoot() {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!common) return undefined;
    return dirname(resolve(REPO_ROOT, common));
  } catch {
    return undefined;
  }
}

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

/** 从 FAB 长文本取 2 个代表性片段（跳过开头编号列表，取中段与后段），片段过短则丢弃。 */
function fabFragments(fab) {
  const text = String(fab ?? '').replace(/\r?\n/g, '');
  const fragments = [];
  if (text.length < 16) return fragments;
  const offsets = [Math.floor(text.length * 0.35), Math.floor(text.length * 0.7)];
  for (const offset of offsets.slice(0, LIMITS.fabFragmentsPerRecord)) {
    const fragment = text.slice(offset, offset + 18);
    if (fragment.length >= 14) fragments.push(fragment);
  }
  return fragments;
}

/** 构造黑名单：全部内容来自运行时读取的归档固化区，不写入任何文件。 */
function buildNeedles(archiveRoot) {
  const needles = [];
  const add = (source, value) => {
    const text = String(value ?? '').trim();
    if (text.length >= 14 && !needles.some((n) => n.value === text)) {
      needles.push({ source, value: text });
    }
  };

  // 1. v0.4 商品属性 JSONL：FAB 卖点片段 + 记录前缀（款号+属性组合）
  for (const split of ['train', 'holdout']) {
    const jsonl = join(archiveRoot, 'v04-holdout', 'work-package', split, 'product_attributes.jsonl');
    if (!existsSync(jsonl)) continue;
    const lines = readFileSync(jsonl, 'utf8').split('\n').filter((line) => line.trim().length > 0);
    let used = 0;
    for (const line of lines) {
      if (used >= LIMITS.jsonlRecords) break;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (!record || typeof record !== 'object') continue;
      used += 1;
      for (const fragment of fabFragments(record.fab)) add(`v04/${split} fab 片段`, fragment);
      // 记录前缀：款号 + 首个属性字段组合（含 FAB 的记录才有指纹意义）
      if (String(record.fab ?? '').trim().length > 0) {
        add(`v04/${split} 记录前缀`, line.slice(0, 60));
      }
    }

    // 2. v0.4 画像 CSV：整行数据（真实款号 + 份额小数）
    const csv = join(archiveRoot, 'v04-holdout', 'work-package', split, 'platform_portrait.csv');
    if (existsSync(csv)) {
      const rows = readFileSync(csv, 'utf8').split('\n').filter((line) => line.trim().length > 0);
      for (const row of rows.slice(1, 1 + LIMITS.csvRows)) add(`v04/${split} 画像行`, row);
    }
  }

  // 3. v0.6 画像 Markdown：人群组名／来源文件行（真实店铺／人群名称）
  const intakeRoot = join(archiveRoot, 'v06-tmall-25q4', 'data', 'incoming');
  if (existsSync(intakeRoot)) {
    const intakeDirs = readdirSync(intakeRoot).filter((name) => !name.startsWith('.'));
    for (const intake of intakeDirs) {
      const portraitDir = join(intakeRoot, intake, 'raw-portraits');
      if (!existsSync(portraitDir)) continue;
      const files = readdirSync(portraitDir).filter((f) => f.endsWith('.md')).slice(0, LIMITS.portraitFiles);
      for (const file of files) {
        const lines = readFileSync(join(portraitDir, file), 'utf8').split('\n');
        for (const line of lines) {
          // 只取含人群组名／来源文件名的行（真实店铺／人群名称与账号文件标识）
          if (/人群组名|来源文件/.test(line)) {
            const text = line.replace(/^[\s\-|]+/, '').trim();
            if (text.length >= 14) add(`v06 画像元信息`, text.split('（')[0].trim());
          }
        }
      }
    }
  }

  return needles;
}

function isTextFile(path) {
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) return false;
  return true;
}

function looksBinary(content) {
  return content.includes('\u0000');
}

/**
 * xlsx 单元格文本抽取（data-templates 复核修单 S3）。
 *
 * `.xlsx` 是二进制 zip，原先按扩展名跳过 → 模板内容不在扫描范围（review.md
 * DT4 子项 NOT_PROVED）。现在把 tracked xlsx 的全部单元格抽成文本后走同一份
 * 黑名单比对；exceljs 是 @uom/core 既有依赖，不新增依赖、不出网。
 */
async function extractXlsxText(path) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(join(REPO_ROOT, path));
  const parts = [];
  for (const sheet of workbook.worksheets) {
    parts.push(sheet.name);
    for (let row = 1; row <= sheet.rowCount; row += 1) {
      for (let column = 1; column <= sheet.columnCount; column += 1) {
        const value = sheet.getRow(row).getCell(column).value;
        if (value == null) continue;
        if (typeof value === 'object') {
          const rich = value;
          if (Array.isArray(rich.richText)) parts.push(rich.richText.map((part) => part.text).join(''));
          else if (typeof rich.text === 'string') parts.push(rich.text);
          else if (rich.result !== undefined) parts.push(String(rich.result));
        } else {
          parts.push(String(value));
        }
      }
    }
  }
  return parts.join('\n');
}

async function run() {
  const envRoot = process.env.UOM_ARCHIVE_FIXED_ROOT;
  const candidates = [];
  if (envRoot) candidates.push(resolve(envRoot));
  const mainRoot = mainWorktreeRoot();
  if (mainRoot) candidates.push(join(mainRoot, 'data', 'archive-modelevol'));
  candidates.push(join(REPO_ROOT, 'data', 'archive-modelevol'));

  const archiveRoot = candidates.find((candidate) => existsSync(candidate));
  if (!archiveRoot) {
    fail(
      `找不到归档固化区（${candidates.join(' / ')}）。本守卫需要主仓固化数据做黑名单，` +
        `可用 UOM_ARCHIVE_FIXED_ROOT 指定。缺数据按 fail-closed 处理，不静默跳过。`,
    );
  }

  const needles = buildNeedles(archiveRoot);
  if (needles.length === 0) {
    fail('黑名单为空：固化区里没有取到任何样本行，守卫无法工作（fail-closed）。');
  }

  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((p) => p.length > 0);

  const hits = [];
  let scanned = 0;
  let xlsxScanned = 0;
  for (const path of tracked) {
    let content;
    if (extname(path).toLowerCase() === '.xlsx') {
      // 二进制 zip：抽单元格文本后比对（S3），不再按扩展名跳过
      try {
        content = await extractXlsxText(path);
      } catch {
        continue;
      }
      xlsxScanned += 1;
    } else {
      if (!isTextFile(path)) continue;
      try {
        content = readFileSync(join(REPO_ROOT, path), 'utf8');
      } catch {
        continue;
      }
      if (looksBinary(content)) continue;
    }
    scanned += 1;
    for (let index = 0; index < needles.length; index += 1) {
      if (content.includes(needles[index].value)) {
        hits.push({ path, needle: `#${index}（${needles[index].source}，长度 ${needles[index].value.length}）` });
      }
    }
  }

  process.stdout.write(
    `归档内容守卫：黑名单 ${needles.length} 条（运行时取自 ${archiveRoot}），` +
      `扫描 tracked 文本文件 ${scanned - xlsxScanned} 个＋xlsx 单元格文本 ${xlsxScanned} 个。\n`,
  );
  if (hits.length > 0) {
    for (const hit of hits) process.stderr.write(`ERROR tracked 文件含归档真实内容片段: ${hit.path}（黑名单 ${hit.needle}）\n`);
    process.stderr.write('FAIL tracked 文件不得包含归档真实业务内容（B1 数据边界）。\n');
    process.exit(1);
  }
  process.stdout.write('PASS：tracked 文件不含归档真实内容片段。\n');
}

run();
