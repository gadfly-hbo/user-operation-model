/**
 * v0.4 协议的 **§9.2 合规特征集** —— 生产预测路径唯一允许的特征抽取器。
 *
 * 工程规范 §9.2「背对背隔离约束」：工具2 的预测路径**不得读取**商品部人工画像字段
 * （人工定位人群、人工新老客比例、人工推荐渠道、人工 FAB 卖点）；预测输入仅限
 * 品类／版型／面料／工艺／价格带／季节／上新类型／IP 等客观属性。
 *
 * **白名单（读）**：`fitType`（版型）、`fabric`（面料）、`category` / `subCategory`（品类）、
 * `season`（季节）、`productLifecycle`（上新类型）、`ipCollaboration`（IP）、
 * `specialFunctionOrMaterial`（工艺/材质）。
 *
 * **黑名单（禁读）**：`fab`（人工 FAB 卖点）、`mentalProduct`（心智产品）、
 * `memoryPoint`（记忆点）、`groupTag`（群组打标），以及任何其他人工定位字段。
 *
 * 三层防线：
 * 1. **类型层**：`V04CompliantProductInput` 的字段集合里**不存在**黑名单字段，
 *    TS 编译期即阻断越界（`model-v04.test.ts` 有编译期断言）。
 * 2. **投影层**：`projectCompliantInput` 是**唯一**把商品记录映射进合规输入的入口，
 *    它按白名单逐字段挑选，人工字段根本没有进入下游的通道。
 * 3. **行为层**：即便调用方强行塞入 `fab`（多字段类型），抽取结果也必须完全一致
 *    （`fab` 不被读取）；变异「把 fab 接回抽取器」会被守卫测试抓住。
 *
 * 与归档的关系：归档 v0.4 的特征抽取读 `fitType` / `fabric` / `fab`（见
 * `features-v04.ts`），其中 `fab` 属人工字段。本文件**不是**归档代码的移植，
 * 而是按 §9.2 白名单重新定义的抽取口径；版型与面料两段**复用**归档词典
 * （`FIT_TYPE_CATEGORIES` / `FABRIC_KEYWORDS`），不另写第二份词典。
 */

import {
  FABRIC_KEYWORDS,
  extractKeywords,
  mergeCounts,
  type V04FeatureSet,
} from './features-v04.js';
import { categorizeFitType } from './features-v04.js';

/**
 * 合规商品属性输入。
 *
 * 注意这里**没有** `fab` / `mentalProduct` / `memoryPoint` / `groupTag`，
 * 也没有任何价格带以外的人工判断字段——类型本身就是第一道防线。
 */
export interface V04CompliantProductInput {
  skuId: string;
  sourceProductKey?: string;
  /** 版型（客观属性） */
  fitType: string;
  /** 面料（客观属性） */
  fabric: string;
  /** 品类（客观属性） */
  category?: string;
  /** 子品类（客观属性） */
  subCategory?: string;
  /** 季节（客观属性） */
  season?: string;
  /** 上新类型（客观属性） */
  productLifecycle?: string;
  /** IP 联名（客观属性） */
  ipCollaboration?: string;
  /** 工艺/材质（客观属性） */
  specialFunctionOrMaterial?: string;
}

/** 合规特征集的人工字段黑名单（类型层与行为层守卫共用）。 */
export const COMPLIANT_FORBIDDEN_FIELDS: readonly string[] = [
  'fab',
  'mentalProduct',
  'memoryPoint',
  'groupTag',
];

/** 合规特征集的交叉特征分组前缀（组内不生成交叉特征）。 */
export const COMPLIANT_FEATURE_GROUPS: readonly string[] = [
  'fit_',
  'fabric_',
  'cat_',
  'season_',
  'lifecycle_',
  'ip_',
  'craft_',
];

/** 工艺/材质字段的分隔符（用于把复合取值拆成原子词）。 */
const CRAFT_SEPARATORS = /[-+/、，,;；\s]+/;

/** 归一化一个取值：去首尾空白；空串视为缺失。 */
function normalizeValue(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * 把商品记录投影成**白名单内**的合规输入。
 *
 * 这是人工字段进入下游的唯一可能入口，因此必须显式逐字段挑选：
 * 白名单外的字段（`fab` / `mentalProduct` / `memoryPoint` / `groupTag` …）一律丢弃。
 */
export function projectCompliantInput(product: {
  skuId: string;
  sourceProductKey?: string;
  fitType?: string;
  fabric?: string;
  category?: string;
  subCategory?: string;
  season?: string;
  productLifecycle?: string;
  ipCollaboration?: string;
  specialFunctionOrMaterial?: string;
}): V04CompliantProductInput {
  return {
    skuId: product.skuId,
    sourceProductKey: product.sourceProductKey,
    fitType: product.fitType ?? '',
    fabric: product.fabric ?? '',
    category: product.category,
    subCategory: product.subCategory,
    season: product.season,
    productLifecycle: product.productLifecycle,
    ipCollaboration: product.ipCollaboration,
    specialFunctionOrMaterial: product.specialFunctionOrMaterial,
  };
}

/**
 * 合规特征抽取：版型 one-hot + 面料关键词 + 品类/季节/上新类型/IP/工艺 词项。
 *
 * - 品类（`category` / `subCategory`）→ `cat_*` / `cat_sub_*`（同组，不互为交叉）；
 * - 季节 → `season_*`；上新类型 → `lifecycle_*`；IP → `ip_*`；
 * - 工艺/材质 → 按分隔符拆成原子词 → `craft_*`（同组内不交叉）。
 *
 * **不读 `fab`、不读任何人工定位字段。**
 */
export function extractCompliantBaseFeatures(input: V04CompliantProductInput): Record<string, number> {
  const fitCategory = categorizeFitType(input.fitType);
  const features: Record<string, number> = { [`fit_${fitCategory}`]: 1 };

  const fabricFeatures = extractKeywords(input.fabric, FABRIC_KEYWORDS);
  Object.assign(features, fabricFeatures);

  const category = normalizeValue(input.category);
  if (category) features[`cat_${category}`] = 1;

  const subCategory = normalizeValue(input.subCategory);
  if (subCategory) features[`cat_sub_${subCategory}`] = 1;

  const season = normalizeValue(input.season);
  if (season) features[`season_${season}`] = 1;

  const lifecycle = normalizeValue(input.productLifecycle);
  if (lifecycle) features[`lifecycle_${lifecycle}`] = 1;

  const ip = normalizeValue(input.ipCollaboration);
  if (ip) features[`ip_${ip}`] = 1;

  const craft = normalizeValue(input.specialFunctionOrMaterial);
  if (craft) {
    for (const part of craft.split(CRAFT_SEPARATORS)) {
      const token = part.trim();
      if (token) features[`craft_${token}`] = 1;
    }
  }

  return mergeCounts(features);
}

/** 合规特征集实例（生产路径唯一允许的特征抽取器）。 */
export const V04_COMPLIANT_FEATURE_SET: V04FeatureSet<V04CompliantProductInput> = {
  id: 'v04-compliant',
  groups: COMPLIANT_FEATURE_GROUPS,
  extractBase: extractCompliantBaseFeatures,
};
