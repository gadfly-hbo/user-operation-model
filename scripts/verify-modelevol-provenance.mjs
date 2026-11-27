#!/usr/bin/env node
/**
 * ModelEvol 归档固化溯源校验。
 *
 * 用途：重算主仓固化目录（gitignore 区）内各包的文件数、体积与包 sha256，
 * 与 `docs/modelevol-provenance.md` 登记值逐项比对；任何不一致即以非 0 退出码阻断。
 *
 * 定位规则（避免写死本机绝对路径）：
 *   1. 命令行参数 `--root <固化根>`；
 *   2. 环境变量 `UOM_ARCHIVE_FIXED_ROOT`；
 *   3. 主仓工作树：脚本所在仓的 `git rev-parse --git-common-dir` 指向的公共 git 目录的上级目录
 *      （独立工作树场景下即主仓根）；
 *   4. 回退：脚本所在仓根目录下的同名固化根。
 *
 * 用法：
 *   node scripts/verify-modelevol-provenance.mjs
 *   node scripts/verify-modelevol-provenance.mjs --root /path/to/data/archive-modelevol/v06-tmall-25q4
 *
 * 退出码：0 全部一致；1 存在不一致；2 校验前置条件缺失（文档/固化根不可读）。
 *
 * 本脚本只读本地文件，不访问网络、不写入固化区。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DOC_PATH = join(REPO_ROOT, 'docs', 'modelevol-provenance.md');
const FIXED_ROOT_RELATIVE = join('data', 'archive-modelevol', 'v06-tmall-25q4');

/** 解析命令行参数。 */
function parseArgs(argv) {
  const out = { root: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '-r') {
      const value = argv[i + 1];
      if (!value) throw new Error('--root 缺少参数');
      out.root = resolve(value);
      i += 1;
    } else if (arg.startsWith('--root=')) {
      out.root = resolve(arg.slice('--root='.length));
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return out;
}

/** 通过 git 公共目录定位主仓根（独立工作树时指向主仓）。 */
function mainWorktreeRoot() {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!common) return undefined;
    const abs = resolve(REPO_ROOT, common);
    return dirname(abs);
  } catch {
    return undefined;
  }
}

function resolveFixedRoot(explicit) {
  // 显式指定的固化根不再回退：指定了却读不到必须是显式失败，不能静默换目录。
  const forced = explicit ?? (process.env.UOM_ARCHIVE_FIXED_ROOT ? resolve(process.env.UOM_ARCHIVE_FIXED_ROOT) : undefined);
  if (forced) return forced;
  const candidates = [];
  const mainRoot = mainWorktreeRoot();
  if (mainRoot) candidates.push(join(mainRoot, FIXED_ROOT_RELATIVE));
  candidates.push(join(REPO_ROOT, FIXED_ROOT_RELATIVE));
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return undefined;
}

/** 递归列出包内全部文件（相对路径，'/' 分隔），按码位升序排序。 */
function listPackageFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(root);
  return out
    .map((full) => ({ full, rel: relative(root, full).split(sep).join('/') }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** 包 sha256：逐行 `<文件 sha256>  <相对路径>\n` 拼接后再取 sha256。 */
function packageDigest(files) {
  const lines = files.map((f) => `${sha256File(f.full)}  ${f.rel}\n`);
  return createHash('sha256').update(lines.join('')).digest('hex');
}

/** 解析溯源文档的「包清单」表格。 */
function parseDocPackages(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .slice(1, trimmed.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 7) continue;
    const id = cells[0].replace(/`/g, '');
    if (!/^v06-[a-z0-9-]+$/.test(id)) continue;
    rows.push({
      id,
      source: cells[1].replace(/`/g, ''),
      dstRel: cells[2].replace(/`/g, ''),
      fileCount: Number(cells[3]),
      bytes: Number(cells[4]),
      sha256: cells[5].replace(/`/g, ''),
      date: cells[6].replace(/`/g, ''),
    });
  }
  return rows;
}

/** 若包内带 checksums.sha256，校验其每一条清单与固化副本一致。 */
function verifyEmbeddedManifest(packageRoot, files) {
  const manifestPath = join(packageRoot, 'checksums.sha256');
  if (!files.some((f) => f.rel === 'checksums.sha256')) return null;
  const problems = [];
  let checked = 0;
  for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([0-9a-f]{64})\s+\.\/(.+)$/);
    if (!match) {
      problems.push(`无法解析的清单行：${trimmed.slice(0, 40)}`);
      continue;
    }
    const [, expected, rel] = match;
    const target = join(packageRoot, rel);
    checked += 1;
    let actual;
    try {
      actual = sha256File(target);
    } catch {
      problems.push(`清单条目缺失：${rel}`);
      continue;
    }
    if (actual !== expected) problems.push(`清单条目不一致：${rel}`);
  }
  return { checked, problems };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`FAIL 参数错误：${error.message}`);
    return 2;
  }

  let markdown;
  try {
    markdown = readFileSync(DOC_PATH, 'utf8');
  } catch {
    console.error(`FAIL 无法读取溯源文档：${DOC_PATH}`);
    return 2;
  }

  const packages = parseDocPackages(markdown);
  if (packages.length === 0) {
    console.error(`FAIL 溯源文档未登记任何包：${DOC_PATH}`);
    return 2;
  }

  const fixedRoot = resolveFixedRoot(args.root);
  if (!fixedRoot) {
    console.error(
      `FAIL 找不到固化根。可用 --root <路径> 或环境变量 UOM_ARCHIVE_FIXED_ROOT 指定（期望目录结构：${FIXED_ROOT_RELATIVE}）。`,
    );
    return 2;
  }

  console.log(`固化根：${fixedRoot}`);
  console.log(`溯源文档：${DOC_PATH}`);

  let failed = false;
  for (const pkg of packages) {
    const packageRoot = join(fixedRoot, pkg.dstRel);
    let files;
    try {
      files = listPackageFiles(packageRoot);
    } catch {
      console.error(`FAIL ${pkg.id}：固化副本不存在或不可读（${packageRoot}）`);
      failed = true;
      continue;
    }
    const bytes = files.reduce((sum, f) => sum + statSync(f.full).size, 0);
    const digest = packageDigest(files);
    const problems = [];
    if (files.length !== pkg.fileCount) {
      problems.push(`文件数不一致：期望 ${pkg.fileCount}，实际 ${files.length}`);
    }
    if (bytes !== pkg.bytes) {
      problems.push(`体积不一致：期望 ${pkg.bytes}，实际 ${bytes}`);
    }
    if (digest !== pkg.sha256) {
      problems.push(`包 sha256 不一致：期望 ${pkg.sha256}，实际 ${digest}`);
    }
    const manifest = verifyEmbeddedManifest(packageRoot, files);
    if (manifest) {
      if (manifest.problems.length > 0) {
        problems.push(...manifest.problems);
      } else {
        console.log(`  ${pkg.id}：内嵌 checksums.sha256 ${manifest.checked} 条全部一致`);
      }
    }
    if (problems.length > 0) {
      failed = true;
      console.error(`FAIL ${pkg.id}（${pkg.dstRel}）`);
      for (const problem of problems) console.error(`  - ${problem}`);
    } else {
      console.log(
        `PASS ${pkg.id}（${pkg.dstRel}）：${files.length} 文件 / ${bytes} 字节 / sha256 ${digest}`,
      );
    }
  }

  if (failed) {
    console.error('FAIL 溯源校验未通过：固化副本与溯源文档不一致。');
    return 1;
  }
  console.log('PASS 溯源校验通过：固化副本与溯源文档完全一致。');
  return 0;
}

process.exit(main());
