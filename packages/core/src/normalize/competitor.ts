import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { detectPlatform } from './platform.js';
import {
  normalizeDouyinPortrait,
  normalizeJdPortrait,
  normalizeTmallPortrait,
} from './index.js';
import type { NormalizationIssue, NormalizedPortrait } from './types.js';

/**
 * 竞品人群画像解析。
 *
 * 目录：`data/domains/07_人群画像/竞品/`。
 * 竞品画像是**独立的实体类型**（competitor），不进渠道画像，
 * 也不参与品牌／渠道画像的检索。
 */
export async function parseCompetitorPortraits(dir: string): Promise<{
  portraits: NormalizedPortrait[];
  issues: NormalizationIssue[];
}> {
  const portraits: NormalizedPortrait[] = [];
  const issues: NormalizationIssue[] = [];
  if (!existsSync(dir)) return { portraits, issues };

  for (const file of listFiles(dir)) {
    const platform = detectPlatform(file);
    if (!platform) {
      issues.push({
        kind: 'parse-error',
        severity: 'warning',
        message: `竞品目录下未识别的数据文件，已跳过：${basename(file)}`,
      });
      continue;
    }
    const options = { entityType: 'competitor' } as const;
    const portrait =
      platform === 'douyin'
        ? normalizeDouyinPortrait(file, options)
        : platform === 'tmall'
          ? await normalizeTmallPortrait(file, options)
          : await normalizeJdPortrait(file, options);
    portraits.push(portrait);
    issues.push(...(portrait.issues ?? []));
  }

  return { portraits, issues };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
