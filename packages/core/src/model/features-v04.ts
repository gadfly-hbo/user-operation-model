/**
 * v0.4 特征抽取 —— **原特征集**（含 FAB 卖点），仅用于「移植忠实门」对照。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `/Users/huangbo/Dev/Archive/ModelEvol/src/capabilities/product-channel-fit/single-product-portrait-supervised.ts`
 *   逻辑位置：`FIT_TYPE_CATEGORIES`（第 200–207 行）、`FABRIC_KEYWORDS`（第 209–238 行）、
 *   `STYLE_KEYWORDS`（第 240–302 行）、`FUNCTION_KEYWORDS`（第 304–319 行）、
 *   `SCENE_KEYWORDS`（第 321–329 行）、`categorizeFitType`（第 335–341 行）、
 *   `extractKeywords`（第 343–352 行）、`mergeCounts`（第 354–362 行）、
 *   `extractBaseSupervisedFeatures`（第 364–377 行）、`COMBINATION_FEATURE_GROUPS`（第 379 行）、
 *   `getFeatureGroup`（第 381–386 行）、`generateCombinationFeatures`（第 388–411 行）、
 *   `selectFrequentCombinationFeatures`（第 413–443 行）、`addCombinationFeatures`（第 445–453 行）、
 *   `extractSupervisedFeatures`（第 455–464 行）。
 *
 * **移植纪律（工程规范 §8.1 规则 2「移植须留来源标识」）**：
 * - 五本词典**外置为冻结配置对象**（下方常量），不散落在函数体里；词典内容逐条原样搬运。
 * - 交叉特征只在**特征组之间**生成（`fit_` / `fabric_` / `style_` / `func_` / `scene_`）。
 *
 * **本文件只服务忠实门**：它的特征输入含 `fab`（人工 FAB 卖点），
 * 属工程规范 §9.2 明令禁读字段，**不得进入生产预测路径**。
 * 合规特征集见 `features-v04-compliant.ts`。
 */

/** 词典条目：命中的关键词 → 规范化特征名。 */
export interface KeywordEntry {
  /** 待匹配关键词（大小写不敏感） */
  readonly keyword: string;
  /** 规范化后的特征名 */
  readonly canonical: string;
}

/** 版型分类词典（来源原样搬运）。 */
export const FIT_TYPE_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  slim: ["修身", "紧身", "收腰", "X型"],
  loose: ["宽松", "阔腿", "直筒", "小宽松", "特宽松"],
  regular: ["合体", "合体型"],
  a_line: ["A型", "A字"],
  h_line: ["H型"],
  o_line: ["O型"],
};

export const FABRIC_KEYWORDS: readonly KeywordEntry[] = [
  { keyword: "棉", canonical: "fabric_cotton" },
  { keyword: "氨纶", canonical: "fabric_spandex" },
  { keyword: "莱赛尔", canonical: "fabric_lyocell" },
  { keyword: "天丝", canonical: "fabric_lyocell" },
  { keyword: "涤纶", canonical: "fabric_polyester" },
  { keyword: "聚酯纤维", canonical: "fabric_polyester" },
  { keyword: "粘胶", canonical: "fabric_viscose" },
  { keyword: "粘纤", canonical: "fabric_viscose" },
  { keyword: "腈纶", canonical: "fabric_acrylic" },
  { keyword: "锦纶", canonical: "fabric_nylon" },
  { keyword: "尼龙", canonical: "fabric_nylon" },
  { keyword: "莫代尔", canonical: "fabric_modal" },
  { keyword: "羊毛", canonical: "fabric_wool" },
  { keyword: "真丝", canonical: "fabric_silk" },
  { keyword: "桑蚕丝", canonical: "fabric_silk" },
  { keyword: "牛仔", canonical: "fabric_denim" },
  { keyword: "雪纺", canonical: "fabric_chiffon" },
  { keyword: "罗纹", canonical: "fabric_rib" },
  { keyword: "针织", canonical: "fabric_knit" },
  { keyword: "梭织", canonical: "fabric_woven" },
  { keyword: "混纺", canonical: "fabric_blend" },
  { keyword: "交织", canonical: "fabric_blend" },
  { keyword: "混交", canonical: "fabric_blend" },
  { keyword: "斜纹", canonical: "fabric_twill" },
  { keyword: "提花", canonical: "fabric_jacquard" },
  { keyword: "双面", canonical: "fabric_double_face" },
  { keyword: "水洗", canonical: "fabric_washed" },
  { keyword: "肌理", canonical: "fabric_texture" },
];

export const STYLE_KEYWORDS: readonly KeywordEntry[] = [
  { keyword: "复古", canonical: "style_vintage" },
  { keyword: "怀旧", canonical: "style_vintage" },
  { keyword: "休闲", canonical: "style_casual" },
  { keyword: "松弛", canonical: "style_casual" },
  { keyword: "慵懒", canonical: "style_casual" },
  { keyword: "舒适", canonical: "style_casual" },
  { keyword: "通勤", canonical: "style_commute" },
  { keyword: "职场", canonical: "style_commute" },
  { keyword: "办公", canonical: "style_commute" },
  { keyword: "商务", canonical: "style_commute" },
  { keyword: "干练", canonical: "style_commute" },
  { keyword: "运动", canonical: "style_sporty" },
  { keyword: "健身", canonical: "style_sporty" },
  { keyword: "瑜伽", canonical: "style_sporty" },
  { keyword: "户外", canonical: "style_outdoor" },
  { keyword: "工装", canonical: "style_utilitarian" },
  { keyword: "机能", canonical: "style_utilitarian" },
  { keyword: "甜美", canonical: "style_sweet" },
  { keyword: "俏皮", canonical: "style_sweet" },
  { keyword: "可爱", canonical: "style_sweet" },
  { keyword: "简约", canonical: "style_minimal" },
  { keyword: "极简", canonical: "style_minimal" },
  { keyword: "基础", canonical: "style_minimal" },
  { keyword: "设计感", canonical: "style_designer" },
  { keyword: "解构", canonical: "style_designer" },
  { keyword: "拼接", canonical: "style_designer" },
  { keyword: "不对称", canonical: "style_designer" },
  { keyword: "显瘦", canonical: "style_slimming" },
  { keyword: "修身", canonical: "style_slimming" },
  { keyword: "收腰", canonical: "style_slimming" },
  { keyword: "宽松", canonical: "style_loose" },
  { keyword: "廓形", canonical: "style_loose" },
  { keyword: "oversize", canonical: "style_loose" },
  { keyword: "包容", canonical: "style_loose" },
  { keyword: "学院", canonical: "style_preppy" },
  { keyword: "校园", canonical: "style_preppy" },
  { keyword: "青春", canonical: "style_preppy" },
  { keyword: "文艺", canonical: "style_artsy" },
  { keyword: "高知", canonical: "style_artsy" },
  { keyword: "科技", canonical: "style_tech" },
  { keyword: "三防", canonical: "style_tech" },
  { keyword: "环保", canonical: "style_eco" },
  { keyword: "森柔", canonical: "style_eco" },
  { keyword: "高级", canonical: "style_premium" },
  { keyword: "精致", canonical: "style_premium" },
  { keyword: "轻奢", canonical: "style_premium" },
  { keyword: "辣妹", canonical: "style_trendy" },
  { keyword: "街头", canonical: "style_trendy" },
  { keyword: "潮流", canonical: "style_trendy" },
  { keyword: "法式", canonical: "style_french" },
  { keyword: "优雅", canonical: "style_elegant" },
  { keyword: "温柔", canonical: "style_gentle" },
  { keyword: "遮肉", canonical: "style_slimming" },
  { keyword: "随性", canonical: "style_casual" },
  { keyword: "不挑", canonical: "style_versatile" },
  { keyword: "百搭", canonical: "style_versatile" },
  { keyword: "线条", canonical: "style_slimming" },
  { keyword: "剪裁", canonical: "style_designer" },
  { keyword: "立体", canonical: "style_designer" },
  { keyword: "层次", canonical: "style_designer" },
  { keyword: "分割", canonical: "style_designer" },
];

export const FUNCTION_KEYWORDS: readonly KeywordEntry[] = [
  { keyword: "三防", canonical: "func_waterproof" },
  { keyword: "防护", canonical: "func_protective" },
  { keyword: "凉感", canonical: "func_cooling" },
  { keyword: "弹力", canonical: "func_stretch" },
  { keyword: "透气", canonical: "func_breathable" },
  { keyword: "亲肤", canonical: "func_skinfriendly" },
  { keyword: "防晒", canonical: "func_sunproof" },
  { keyword: "抗菌", canonical: "func_antibacterial" },
  { keyword: "易打理", canonical: "func_easycare" },
  { keyword: "速干", canonical: "func_quickdry" },
  { keyword: "保暖", canonical: "func_warm" },
  { keyword: "垂坠", canonical: "func_drape" },
  { keyword: "挺括", canonical: "func_structured" },
  { keyword: "抽绳", canonical: "func_adjustable" },
];

export const SCENE_KEYWORDS: readonly KeywordEntry[] = [
  { keyword: "日常", canonical: "scene_daily" },
  { keyword: "约会", canonical: "scene_date" },
  { keyword: "聚会", canonical: "scene_party" },
  { keyword: "上班", canonical: "scene_work" },
  { keyword: "出游", canonical: "scene_travel" },
  { keyword: "度假", canonical: "scene_vacation" },
  { keyword: "居家", canonical: "scene_home" },
];


/** 交叉特征分组前缀（组内不生成交叉特征）。 */
export const V04_COMBINATION_FEATURE_GROUPS: readonly string[] = [
  'fit_',
  'fabric_',
  'style_',
  'func_',
  'scene_',
];

/** 原特征集的输入（三段人工/客观混合字段，仅忠实门使用）。 */
export interface V04OriginalProductInput {
  skuId: string;
  sourceProductKey?: string;
  /** 版型 */
  fitType: string;
  /** 面料 */
  fabric: string;
  /** FAB 卖点长文本（**人工字段，§9.2 禁读**） */
  fab: string;
}

/**
 * 特征集抽象：训练、预测、评估三段共用同一份抽取口径。
 *
 * @typeParam TInput 抽取器的输入类型。合规特征集的输入类型**不含**任何人工画像字段，
 *                    类型层面即阻断 §9.2 越界（见 `features-v04-compliant.ts`）。
 */
export interface V04FeatureSet<TInput> {
  /** 特征集标识（写入模型工件，用于溯源） */
  readonly id: string;
  /** 交叉特征分组前缀 */
  readonly groups: readonly string[];
  /** 抽取基础特征（不含交叉特征） */
  extractBase(input: TInput): Record<string, number>;
}

/** 版型归类：命中任一模式即返回该类，否则 `other`。 */
export function categorizeFitType(fitType: string): string {
  const lower = fitType.toLowerCase();
  for (const [category, patterns] of Object.entries(FIT_TYPE_CATEGORIES)) {
    if (patterns.some((pattern) => lower.includes(pattern.toLowerCase()))) return category;
  }
  return 'other';
}

/** 按词典统计关键词命中次数（同一 canonical 命中多个关键词时累加）。 */
export function extractKeywords(text: string, dictionary: readonly KeywordEntry[]): Record<string, number> {
  const lower = text.toLowerCase();
  const found = new Map<string, number>();
  for (const { keyword, canonical } of dictionary) {
    if (lower.includes(keyword.toLowerCase())) {
      found.set(canonical, (found.get(canonical) ?? 0) + 1);
    }
  }
  return Object.fromEntries(found);
}

/** 合并多份计数字典（同名键累加）。 */
export function mergeCounts(...records: readonly Record<string, number>[]): Record<string, number> {
  const merged = new Map<string, number>();
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      merged.set(key, (merged.get(key) ?? 0) + value);
    }
  }
  return Object.fromEntries(merged);
}

/** 取特征名所属分组前缀；不属于任何分组时返回 null。 */
export function getFeatureGroup(name: string, groups: readonly string[]): string | null {
  for (const prefix of groups) {
    if (name.startsWith(prefix)) return prefix;
  }
  return null;
}

/**
 * 生成交叉特征：仅当两个基础特征**分属不同分组**且都非零时，才在命中名单内产出 `k1__k2`。
 *
 * 键序与归档一致（按基础特征记录的对象键序两两配对），保证组合名集合可复现。
 */
export function generateCombinationFeatures(
  baseFeatures: Record<string, number>,
  comboNames: ReadonlySet<string>,
  groups: readonly string[],
): Record<string, number> {
  const combos: Record<string, number> = {};
  const keys = Object.keys(baseFeatures);
  for (let i = 0; i < keys.length; i += 1) {
    const k1 = keys[i]!;
    if (baseFeatures[k1] === 0) continue;
    const g1 = getFeatureGroup(k1, groups);
    if (!g1) continue;
    for (let j = i + 1; j < keys.length; j += 1) {
      const k2 = keys[j]!;
      if (baseFeatures[k2] === 0) continue;
      const g2 = getFeatureGroup(k2, groups);
      if (!g2 || g1 === g2) continue;
      const comboKey = `${k1}__${k2}`;
      if (comboNames.has(comboKey)) combos[comboKey] = 1;
    }
  }
  return combos;
}

/**
 * 选出出现频次 ≥ `minFrequency` 的交叉特征名（按名排序）。
 *
 * 频次口径：**含该组合的样本数**（同一组合在一个样本内只计一次）。
 */
export function selectFrequentCombinationFeatures(
  baseFeatureRecords: readonly Record<string, number>[],
  minFrequency: number,
  groups: readonly string[],
): string[] {
  const freq = new Map<string, number>();
  for (const record of baseFeatureRecords) {
    const seen = new Set<string>();
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i += 1) {
      const k1 = keys[i]!;
      if (record[k1] === 0) continue;
      const g1 = getFeatureGroup(k1, groups);
      if (!g1) continue;
      for (let j = i + 1; j < keys.length; j += 1) {
        const k2 = keys[j]!;
        if (record[k2] === 0) continue;
        const g2 = getFeatureGroup(k2, groups);
        if (!g2 || g1 === g2) continue;
        const comboKey = `${k1}__${k2}`;
        if (!seen.has(comboKey)) {
          seen.add(comboKey);
          freq.set(comboKey, (freq.get(comboKey) ?? 0) + 1);
        }
      }
    }
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= minFrequency)
    .map(([key]) => key)
    .sort();
}

/** 把命中的交叉特征合并进基础特征记录。 */
export function addCombinationFeatures(
  baseFeatures: Record<string, number>,
  combinationFeatureNames: readonly string[],
  groups: readonly string[],
): Record<string, number> {
  if (combinationFeatureNames.length === 0) return baseFeatures;
  const comboFeatures = generateCombinationFeatures(baseFeatures, new Set(combinationFeatureNames), groups);
  return mergeCounts(baseFeatures, comboFeatures);
}

/**
 * 原特征集的基础特征抽取：版型 one-hot + 面料关键词 + FAB 关键词（面料/风格/功能/场景）。
 *
 * @see 归档 `extractBaseSupervisedFeatures`（第 364–377 行）
 */
export function extractBaseSupervisedFeatures(sample: V04OriginalProductInput): Record<string, number> {
  const fitCategory = categorizeFitType(sample.fitType);
  const fitOneHot: Record<string, number> = { [`fit_${fitCategory}`]: 1 };

  const fabricFeatures = extractKeywords(sample.fabric, FABRIC_KEYWORDS);
  const fabStyleFeatures = extractKeywords(sample.fab, STYLE_KEYWORDS);
  const fabFunctionFeatures = extractKeywords(sample.fab, FUNCTION_KEYWORDS);
  const fabSceneFeatures = extractKeywords(sample.fab, SCENE_KEYWORDS);
  const fabFabricFeatures = extractKeywords(sample.fab, FABRIC_KEYWORDS);

  return mergeCounts(fitOneHot, fabricFeatures, fabFabricFeatures, fabStyleFeatures, fabFunctionFeatures, fabSceneFeatures);
}

/** 原特征集：基础特征 + 交叉特征。 */
export function extractSupervisedFeatures(
  sample: V04OriginalProductInput,
  combinationFeatureNames: readonly string[],
): Record<string, number> {
  const baseFeatures = extractBaseSupervisedFeatures(sample);
  if (combinationFeatureNames.length === 0) return baseFeatures;
  return addCombinationFeatures(baseFeatures, combinationFeatureNames, V04_COMBINATION_FEATURE_GROUPS);
}

/** 原特征集实例（忠实门专用）。 */
export const V04_ORIGINAL_FEATURE_SET: V04FeatureSet<V04OriginalProductInput> = {
  id: 'v04-original',
  groups: V04_COMBINATION_FEATURE_GROUPS,
  extractBase: extractBaseSupervisedFeatures,
};
