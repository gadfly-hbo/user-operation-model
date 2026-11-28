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

/** 单品经营指标。 */
export interface PerformanceMetrics {
  /** 该月零售额（`product-performance.csv`）。缺失不插补。 */
  retailAmount?: number;
  /** 该月零售量（`product-performance.csv`）。缺失不插补。 */
  retailQty?: number;
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

/**
 * 生命周期漏斗（切片 A · SA-04）：按「月份 × 阶段」存放，同阶段不重复。
 * 源行月份为空时归入键 `unknown`。
 */
export type FunnelByMonth = Record<
  string,
  Partial<Record<'launch' | 'growth' | 'clearance', Record<string, number>>>
>;

/** 单品全生命周期档案。 */
export interface ProductDossier {
  /** 款号，主键。 */
  spu: string;
  /**
   * 数据契约版本，随结构演进而更新。
   * `0.2.0`（切片 A · SA-04）：经营指标／漏斗／渠道成交按月存取，
   * 单数 `portrait` 字段由 `portraits` 数组取代。
   */
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
  /** 生命周期漏斗，按「月份 × 阶段」存放（SA-04）；源行月份为空归入 `unknown`。 */
  funnel?: FunnelByMonth;
  /** 单品经营指标，按月份键控（SA-04）；源行月份为空归入 `unknown`。 */
  performance?: Record<string, PerformanceMetrics>;
  /** 商品↔渠道成交，按「渠道 → 月份 → 成交」键控（SA-04）。 */
  channelPerformance?: Record<string, Record<string, { retailAmount?: number; retailQty?: number }>>;
  /** 未在字段目录登记的字段原样保留，不丢数据。 */
  extra?: Record<string, unknown>;
}
