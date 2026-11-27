/**
 * v0.6 合规特征抽取（§9.2 白名单）。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/features.mts`
 *   逻辑位置：`FABRIC_RULES` / `normalizeFabric`（第 10–32 行）、
 *   `featureTokens`（第 95–135 行）、`buildMatrix`（第 142–164 行）。
 *
 * ## 与归档的差异（必须知悉）
 *
 * 1. **人工字段全部剔除**（工程规范 §9.2）：归档的特征组
 *    `kw`（FAB 关键词）、`combo`（面料×FAB 交叉）、`gender`（性别修正）、
 *    `tags`（记忆点／群组打标／特殊功能材质／心智产品）
 *    触及人工判断字段，本移植**不继承**。归档 `tags` 里只有「特殊功能/材质」
 *    属客观属性，单独拆成合规组 `craft`。
 * 2. **特征组用声明式规格描述**（`V06_FEATURE_GROUPS`）：抽取逻辑与「哪些字段进哪一组」
 *    分离，导出器把同一份规格序列化进自包含模型包，避免出现第二份抽取实现。
 * 3. **品类特征用原始品类**（归档 `cat` 组用的是 `categoryGroup` 粗分组）：
 *    原始品类同属白名单客观属性且更细；分层不再重做（folds 冻结），故 `categoryGroup`
 *    不再需要，不移植。
 * 4. 归档 `buildMatrix` 的词表规则（`count >= minCount && count < 训练样本数`）原样保留：
 *    低频词剔除、**全样本恒定的词剔除**（否则该列在标准化后为 0）。
 *
 * 面料归一化词典原样搬运归档的 12 条规则与匹配顺序（含归档首条正则里的 `jitn` 拼写，
 * 按忠实移植保留，不做「顺手修正」——修正会改变英文 `denim` 文本的命中结果）。
 */

import type { V06CompliantProductInput, V06Sample } from './types.js';

/** 特征抽取方式。 */
export type V06FeatureKind =
  /** 原值 one-hot（前缀 + 原值） */
  | 'onehot'
  /** 面料归一化后 one-hot（前缀 + 归一化面料类别） */
  | 'fabric'
  /** 按分隔符拆成原子词后逐个 one-hot */
  | 'tokens';

/** 一个字段在某特征组里的抽取规则。 */
export interface V06FieldSpec {
  /** 合规输入里的字段名（必须是白名单字段） */
  field: keyof V06CompliantProductInput;
  /** 特征名前缀 */
  prefix: string;
  /** 抽取方式 */
  kind: V06FeatureKind;
}

/**
 * 面料归一化规则（归档 `lib/features.mts:10-23` 原样搬运，顺序即匹配优先级）。
 *
 * 序列化成模型包时保存的是**正则源码**，模型包运行时重新构造 RegExp，
 * 因此规则只有这一处定义。
 */
export const V06_FABRIC_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/牛仔|jitn/i, 'denim'],
  [/羊毛|美利奴|羊仔毛|粗纺/, 'wool'],
  [/羊绒|cashmere/i, 'cashmere'],
  [/腈纶/, 'acrylic'],
  [/莱赛尔|天丝|lyocell/i, 'lyocell'],
  [/莫代尔|modal/i, 'modal'],
  [/锦纶|尼龙|尼丝/, 'nylon'],
  [/棉涤|涤棉|混纺|交织/, 'blend'],
  [/棉/, 'cotton'],
  [/涤|化纤|弹力丝|雪纺/, 'polyester'],
  [/针织|罗纹|毛织/, 'knit'],
  [/丝绒|绒布/, 'velvet'],
];

/** 工艺／材质字段的原子词分隔符（源码形式，供模型包运行时重建 RegExp）。 */
export const V06_TOKEN_SEPARATOR_PATTERN = '[-+/、，,;；\\s]+';

/** 工艺／材质字段的原子词分隔符。 */
const TOKEN_SEPARATOR = new RegExp(V06_TOKEN_SEPARATOR_PATTERN);

/** 合规特征组 → 字段规则。 */
export const V06_FEATURE_GROUPS: Record<string, readonly V06FieldSpec[]> = {
  fit: [{ field: 'fit', prefix: 'fit_', kind: 'onehot' }],
  fabric: [{ field: 'fabric', prefix: 'fabric_', kind: 'fabric' }],
  attr: [{ field: 'productAttribute', prefix: 'attr_', kind: 'onehot' }],
  cat: [{ field: 'category', prefix: 'cat_', kind: 'onehot' }],
  subcat: [{ field: 'subcategory', prefix: 'subcat_', kind: 'onehot' }],
  season: [{ field: 'season', prefix: 'season_', kind: 'onehot' }],
  ip: [{ field: 'ipCollab', prefix: 'ip_', kind: 'onehot' }],
  craft: [{ field: 'specialFunctionMaterial', prefix: 'craft_', kind: 'tokens' }],
};

/** 合规特征组名单（全部为 §9.2 白名单客观属性）。 */
export const V06_COMPLIANT_GROUPS: readonly string[] = [
  'fit',
  'fabric',
  'attr',
  'cat',
  'subcat',
  'season',
  'ip',
  'craft',
];

/** 把面料文本归一化到归档的 12 个类别之一（未命中为 `other`，空值为 `unknown`）。 */
export function normalizeV06Fabric(fabric: string): string {
  const value = (fabric ?? '').trim();
  if (!value) return 'unknown';
  for (const [pattern, name] of V06_FABRIC_RULES) {
    if (pattern.test(value)) return name;
  }
  return 'other';
}

/** 投影层：把商品原始字段裁成合规输入（人工字段在此丢弃）。 */
export function projectV06CompliantInput(raw: {
  sku: string;
  fit?: string;
  fabric?: string;
  category?: string;
  subcategory?: string;
  season?: string;
  productAttribute?: string;
  ipCollab?: string;
  specialFunctionMaterial?: string;
}): V06CompliantProductInput {
  return {
    sku: raw.sku,
    fit: raw.fit ?? '',
    fabric: raw.fabric ?? '',
    category: raw.category ?? '',
    subcategory: raw.subcategory ?? '',
    season: raw.season ?? '',
    productAttribute: raw.productAttribute ?? '',
    ipCollab: raw.ipCollab ?? '',
    specialFunctionMaterial: raw.specialFunctionMaterial ?? '',
  };
}

/** 抽取单个样本的特征词项（词 → 出现次数）。 */
export function extractV06Tokens(
  input: V06CompliantProductInput,
  groups: ReadonlySet<string>,
): Map<string, number> {
  const tokens = new Map<string, number>();
  const add = (name: string): void => {
    tokens.set(name, (tokens.get(name) ?? 0) + 1);
  };

  for (const group of groups) {
    const specs = V06_FEATURE_GROUPS[group];
    if (!specs) throw new Error(`未知特征组：${group}`);
    for (const spec of specs) {
      const raw = String(input[spec.field] ?? '').trim();
      if (spec.kind === 'onehot') {
        if (raw) add(`${spec.prefix}${raw}`);
      } else if (spec.kind === 'fabric') {
        const canonical = normalizeV06Fabric(raw);
        if (canonical !== 'unknown') add(`${spec.prefix}${canonical}`);
      } else {
        for (const part of raw.split(TOKEN_SEPARATOR)) {
          const token = part.trim();
          if (token) add(`${spec.prefix}${token}`);
        }
      }
    }
  }
  return tokens;
}

/** 按给定的特征名顺序把样本编码成数值行（词表外的词记 0）。 */
export function encodeV06Samples(
  samples: readonly V06Sample[],
  groups: ReadonlySet<string>,
  featureNames: readonly string[],
): number[][] {
  return samples.map((sample) => {
    const tokens = extractV06Tokens(sample.input, groups);
    return featureNames.map((name) => tokens.get(name) ?? 0);
  });
}

/**
 * 按训练样本建词表并给评估样本编码。
 *
 * 词表规则（归档 `lib/features.mts:142-164`）：词项在训练样本里出现次数
 * `>= minCount` 且 `< 训练样本数` 才保留；特征名按字典序排序。
 */
export function buildV06Matrix(
  trainSamples: readonly V06Sample[],
  evalSamples: readonly V06Sample[],
  groups: ReadonlySet<string>,
  minCount = 3,
): { matrix: number[][]; featureNames: string[] } {
  const counts = new Map<string, number>();
  for (const sample of trainSamples) {
    for (const name of extractV06Tokens(sample.input, groups).keys()) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const featureNames = [...counts.entries()]
    .filter(([, count]) => count >= minCount && count < trainSamples.length)
    .map(([name]) => name)
    .sort();
  return { matrix: encodeV06Samples(evalSamples, groups, featureNames), featureNames };
}
