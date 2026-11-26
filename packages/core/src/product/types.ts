/**
 * 商品档案类型。
 *
 * 可扩展性约定：字段目录（catalog/fields.ts）是数据，登记一个新字段即可让
 * 归一化层识别它。未登记的字段不会被丢弃，而是进入 `ProductDossier.extra`。
 */

/** 字段允许的使用场景。 */
export type FieldUsage =
  /** 可作为工具2 预测模型的输入（客观属性） */
  | 'prediction'
  /** 可用于人工画像与算法画像的比对层 */
  | 'comparison';

/** 字段取值类型。 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'text';

/** 单个字段的目录条目。 */
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /**
   * 允许的使用场景。
   * - `['prediction', 'comparison']` 客观属性，两边可用
   * - `['comparison']` 仅比对层可用 —— **禁止进入预测路径**
   */
  usage: FieldUsage[];
  /** 来源表列名候选。 */
  sources?: string[];
  note?: string;
}

/** 价格信息。 */
export interface PriceInfo {
  tagPrice?: number;
  overseasTagPrice?: number;
  unitPrice?: number;
  retailAmount?: number;
  retailQty?: number;
  /** 真实成交单价，优先由零售额/零售量推出。 */
  actualUnitPrice?: number;
  discount?: number;
}

/** FAB 三层拆解。 */
export interface FabInfo {
  feature?: string[];
  advantage?: string[];
  benefit?: string[];
}

/** 生命周期行为漏斗。 */
export interface FunnelMetrics {
  phase: 'launch' | 'growth' | 'clearance';
  metrics: Record<string, number>;
}

/** 单品经营指标。 */
export interface PerformanceMetrics {
  sellThroughRate?: number;
  returnRate?: number;
  refundRate?: number;
  grossMargin?: number;
  upt?: number;
  newCustomerShare?: number;
  conversionRate?: number;
  uv?: number;
  stockoutRate?: number;
}

/** 单品全生命周期档案。 */
export interface ProductDossier {
  /** 款号，主键。 */
  spu: string;
  /** 数据契约版本，随结构演进而更新。 */
  schemaVersion: string;
  name?: string;
  brand?: string;
  gender?: string;
  category?: {
    l1?: string;
    l2?: string;
    l3?: string;
    code?: string;
  };
  season?: string;
  productSeason?: string;
  launchType?: string;
  price?: PriceInfo;
  fab?: FabInfo;
  /** 客观属性集合，键取自字段目录。 */
  attributes?: Record<string, string[]>;
  /**
   * 预测路径可见的客观属性子集。
   * 由字段目录的 `usage` 推导，与 `attributes` 的区别是不含任何人工定位字段。
   */
  predictionAttributes?: Record<string, string[]>;
  /**
   * 仅比对层可见的人工定位字段。
   * 背对背隔离约束下，这些字段不得进入预测路径。
   */
  comparisonOnly?: Record<string, string[]>;
  portrait?: { month: string };
  funnel?: FunnelMetrics[];
  performance?: PerformanceMetrics;
  channelPerformance?: Record<string, { retailAmount?: number; retailQty?: number }>;
  /** 未在字段目录登记的字段原样保留，不丢数据。 */
  extra?: Record<string, unknown>;
}
