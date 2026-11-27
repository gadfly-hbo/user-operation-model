/**
 * v0.6 六阶段管线的类型与常量。
 *
 * 来源（ModelEvol 只读归档，固化与溯源见 `docs/modelevol-provenance.md`）：
 * - `.../experiments/2026-09-11-v0.6-tmall-guanqi-portrait-only/scripts/lib/core.mts`
 *   逻辑位置：`TARGET_DIMENSIONS`（第 17–25 行）、`Sample`（第 30–47 行）。
 *
 * ## §9.2 背对背隔离（工程规范 §9.2）
 *
 * 归档 `Sample` 带 `mindProduct`（心智产品）、`memoryPoint`（记忆点）、
 * `groupTag`（群组打标）、`fab`（人工 FAB 卖点）、`genderCorrected`（性别修正）
 * 五个**人工判断字段**，并把它们直接送进特征抽取。本移植**不继承**：
 * 预测路径的输入类型 `V06CompliantProductInput` **只含客观属性**
 * （品类／版型／面料／工艺／季节／上新类型／IP），
 * 人工字段由 `projectV06CompliantInput`（投影层）在入口处丢弃。
 */

/** v0.6 的六个目标维度（单平台原生标签，无跨平台映射）。 */
export const V06_TARGET_DIMENSIONS = [
  '预测性别',
  '预测年龄',
  '预测购买力',
  '预测城市等级',
  '大服饰策略人群',
  '预测人生阶段',
] as const;

export type V06TargetDimension = (typeof V06_TARGET_DIMENSIONS)[number];

/** 标签 → 份额 的分布。 */
export type V06Distribution = Record<string, number>;

/**
 * 合规商品属性输入（预测路径唯一允许的输入形状）。
 *
 * **类型层守卫**：本类型里不存在任何人工判断字段，
 * 越界访问在 TypeScript 编译期即被阻断。
 */
export interface V06CompliantProductInput {
  /** 商品款号（仅作样本标识，不进特征） */
  sku: string;
  /** 版型（客观属性） */
  fit: string;
  /** 面料（客观属性） */
  fabric: string;
  /** 品类（客观属性） */
  category: string;
  /** 子品类（客观属性） */
  subcategory: string;
  /** 季节（客观属性） */
  season: string;
  /** 上新类型／货品属性（客观属性） */
  productAttribute: string;
  /** IP 联名（客观属性） */
  ipCollab: string;
  /** 工艺／材质（客观属性） */
  specialFunctionMaterial: string;
}

/** 合规输入里**禁止出现**的人工判断字段（类型层与行为层守卫共用）。 */
export const V06_FORBIDDEN_FIELDS: readonly string[] = [
  'fab',
  'mindProduct',
  'memoryPoint',
  'groupTag',
  'genderCorrected',
];

/** 一个训练样本：合规输入 + 六个维度的实际成交人群画像。 */
export interface V06Sample {
  sku: string;
  input: V06CompliantProductInput;
  portraits: Record<V06TargetDimension, V06Distribution>;
}

/** 冻结的实验标识（与归档一致，仅作溯源标注）。 */
export const V06_EXPERIMENT_ID = '2026-09-11-v0.6-tmall-guanqi-portrait-only';

/** 冻结的分层键（归档 folds.json 的 `stratify_key`；本移植**不重做分层**）。 */
export const V06_FROZEN_STRATIFY_KEY = 'categoryGroup x genderCorrected';

/** 归档冻结的分层随机种子。 */
export const V06_FROZEN_FOLD_SEED = 20260911;
