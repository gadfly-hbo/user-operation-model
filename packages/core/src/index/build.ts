import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  normalizeChannelTable,
  normalizeDouyinPortrait,
  normalizeJdPortrait,
  normalizeProductTable,
  normalizeTmallPortrait,
} from '../normalize/index.js';
import type { NormalizationIssue } from '../normalize/types.js';
import type { DataIndex } from './types.js';
import type { NormalizedPortrait } from '../normalize/types.js';

/** 索引构建选项。 */
export interface BuildIndexOptions {
  /** 数据根目录，默认 `data`。 */
  dataRoot?: string;
  /** 只扫这些子目录，默认 `domains` 与 `source`。 */
  scanDirs?: string[];
}

/** 需要探测的数据源。探测不到时对应工具返回明确错误。 */
export interface DataSourceProbe {
  tool: string;
  /** 返回 undefined 表示数据就绪，否则返回缺失说明。 */
  probe: (dataRoot: string) => string | undefined;
}

const firstExisting = (dataRoot: string, candidates: string[]): string | undefined =>
  candidates.find((candidate) => existsSync(join(dataRoot, candidate)));

/**
 * 数据源探测表。
 *
 * 探测结果决定工具的「数据是否就绪」层状态。数据补齐后自动生效，
 * 不需要改代码。
 */
export const DATA_SOURCE_PROBES: DataSourceProbe[] = [
  {
    tool: 'get_brand_portrait',
    probe: (dataRoot) => {
      const dir = join(dataRoot, 'domains', '01_品牌信息');
      const found = existsSync(dir)
        ? listFiles(dir).some((file) => detectEntityType(file) === 'brand')
        : false;
      return found
        ? undefined
        : '品牌人群画像未接入：期望 data/domains/01_品牌信息/ 下有品牌画像文件（当前只有品牌清单）';
    },
  },
  {
    tool: 'get_competitor_portrait',
    probe: (dataRoot) => {
      const dir = join(dataRoot, 'domains', '07_人群画像', '竞品');
      return existsSync(dir)
        ? undefined
        : '竞品人群画像未接入：期望 data/domains/07_人群画像/竞品/ 下有竞品画像文件';
    },
  },
  {
    tool: 'get_funnel',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'tables/funnel.csv',
        'tables/funnel.xlsx',
        'domains/08_指标体系/funnel.csv',
      ]);
      return found
        ? undefined
        : '生命周期漏斗未接入：期望按款按月的浏览／收藏／加购／购买／直接购买／退货数据（data/tables/funnel.csv）';
    },
  },
  {
    tool: 'list_member_features',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'tables/member-features.csv',
        'tables/member-features.xlsx',
      ]);
      return found
        ? undefined
        : '会员特征字典未接入：期望业务方案 §5.2 的字段表（data/tables/member-features.csv）';
    },
  },
  {
    tool: 'get_retention_cohort',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'retention/cohort.csv',
        'retention/cohort.xlsx',
        'tables/cohort.csv',
      ]);
      return found
        ? undefined
        : 'Cohort 留存数据未接入：期望按首购月份分群的 Day30/60/90 留存（data/retention/cohort.csv）';
    },
  },
  {
    tool: 'get_recency_distribution',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'retention/recency.csv',
        'retention/recency.xlsx',
        'tables/recency.csv',
      ]);
      return found
        ? undefined
        : '老客 Recency 分布未接入：期望按上次购买时间切片的回购人数（data/retention/recency.csv）';
    },
  },
  {
    tool: 'get_channel_flow_matrix',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'retention/channel-flow.csv',
        'retention/channel-flow.xlsx',
        'tables/channel-flow.csv',
      ]);
      return found
        ? undefined
        : '老客跨渠道流转矩阵未接入：期望来源渠道→回购渠道的流转矩阵（data/retention/channel-flow.csv）';
    },
  },
  {
    tool: 'get_diagnosis',
    probe: (dataRoot) => {
      const found = firstExisting(dataRoot, [
        'retention/diagnosis.csv',
        'retention/diagnosis.xlsx',
        'tables/diagnosis.csv',
      ]);
      return found
        ? undefined
        : '三大诊断数据未接入：期望二回断崖／虚假繁荣／清仓客跃迁的判定输入（data/retention/diagnosis.csv）';
    },
  },
];

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** 判断画像文件属于哪个平台。 */
function detectPlatform(path: string): 'douyin' | 'tmall' | 'jd' | undefined {
  const normalized = path.split(sep).join('/');
  // 文件名后缀优先于所在目录：同一目录下可混放多平台文件
  if (normalized.endsWith('_抖音.csv') || normalized.endsWith('_抖音.xlsx')) return 'douyin';
  if (normalized.endsWith('_天猫.csv') || normalized.endsWith('_天猫.xlsx')) return 'tmall';
  if (normalized.endsWith('_京东.csv') || normalized.endsWith('_京东.xlsx')) return 'jd';
  if (/\/douyin\//.test(normalized)) return 'douyin';
  if (/\/tmall\//.test(normalized)) return 'tmall';
  if (/\/jd\//.test(normalized)) return 'jd';
  return undefined;
}

/**
 * 画像实体的类型。
 *
 * - 带「款号」的是商品
 * - 带「品牌」且带「画像」的是品牌
 * - 其余是渠道／门店
 *
 * 探测表的品牌判定与此保持一致，避免「探测说就绪但索引里没有 brand 实体」。
 */
export function detectEntityType(path: string): 'product' | 'channel' | 'brand' {
  const name = path.split(sep).pop() ?? '';
  if (/款号/.test(name)) return 'product';
  if (/品牌/.test(name) && /画像/.test(name)) return 'brand';
  return 'channel';
}

/**
 * 从数据目录构建索引。
 *
 * 扫描 `domains/` 与 `source/` 两个区，按文件名与目录结构识别四类数据源：
 * 商品宽表、渠道宽表、平台画像文件、聚合口径表。
 */
export async function buildIndex(options: BuildIndexOptions = {}): Promise<DataIndex> {
  const dataRoot = options.dataRoot ?? 'data';
  const scanDirs = options.scanDirs ?? ['domains', 'source'];
  const issues: NormalizationIssue[] = [];

  if (!existsSync(dataRoot)) {
    throw new Error(`数据根目录不存在：${dataRoot}`);
  }
  const foundScanDirs = scanDirs.filter((dir) => existsSync(join(dataRoot, dir)));
  if (foundScanDirs.length === 0) {
    throw new Error(
      `数据根目录 ${dataRoot} 下没有可扫描的子目录（期望 ${scanDirs.join(' 或 ')}）`,
    );
  }
  const portraits: NormalizedPortrait[] = [];
  const products: DataIndex['products'] = [];
  const channels: DataIndex['channels'] = [];

  for (const scanDir of scanDirs) {
    const root = join(dataRoot, scanDir);
    for (const file of listFiles(root)) {
      const relativePath = relative(root, file);
      const lower = file.toLowerCase();

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        if (/商品.*信息表|商品宽表/.test(relativePath)) {
          const result = await normalizeProductTable(file);
          issues.push(...result.issues);
          for (const product of result.products) {
            const existing = products.find((item) => item.spu === product.spu);
            if (existing) {
              issues.push({
                kind: 'conflict',
                severity: 'warning',
                sourceLabel: product.spu,
                message: `款号 ${product.spu} 在多张商品表中重复（${relativePath}），保留先到的一条，未做隐式合并`,
              });
              continue;
            }
            products.push(product);
          }
          continue;
        }
        if (/渠道.*宽表|店铺.*宽表/.test(relativePath)) {
          const result = await normalizeChannelTable(file);
          channels.push(...result.channels);
          issues.push(...result.issues);
          continue;
        }
        const platform = detectPlatform(file);
        if (platform) {
          const entityType = detectEntityType(file);
          const options2 = { entityType };
          const portrait =
            platform === 'douyin'
              ? normalizeDouyinPortrait(file, options2)
              : platform === 'tmall'
                ? await normalizeTmallPortrait(file, options2)
                : await normalizeJdPortrait(file, options2);
          portraits.push(portrait);
          issues.push(...(portrait.issues ?? []));
          continue;
        }
      }

      if (lower.endsWith('.csv')) {
        const platform = detectPlatform(file);
        if (platform === 'douyin') {
          const portrait = normalizeDouyinPortrait(file, { entityType: detectEntityType(file) });
          portraits.push(portrait);
          issues.push(...(portrait.issues ?? []));
          continue;
        }
      }

      issues.push({
        kind: 'parse-error',
        severity: 'warning',
        message: `未识别的数据文件，已跳过：${relativePath}`,
      });
    }
  }

  const months = [...new Set(portraits.map((portrait) => portrait.month).filter(Boolean))].sort();
  const unavailable: Record<string, string> = {};
  for (const probe of DATA_SOURCE_PROBES) {
    const missing = probe.probe(dataRoot);
    if (missing) unavailable[probe.tool] = missing;
  }

  return {
    builtAt: new Date().toISOString(),
    dataRoot,
    months,
    products,
    channels,
    portraits,
    issues,
    unavailable,
  };
}
