/**
 * 人群画像核心类型。
 *
 * 可扩展性约定：这里的标识类型全部是**开放字符串**（`string` 别名），
 * 不是封闭 union。新增维度、平台、标签值只需在目录（catalog）中登记，
 * 不需要修改本文件，也不需要改动任何逻辑代码。
 */

/** 统一维度标识。新增维度在 dimensions 目录登记即可。 */
export type DimensionId = string;

/** 数据来源平台标识。新增平台在 dimensions 目录登记即可。 */
export type PlatformId = string;

/** 投影模式。 */
export type ProjectionMode =
  /** 按跨平台映射表对齐到统一词表 */
  | 'mapping'
  /** 按有序分档归并规则投影 */
  | 'bands'
  /** 沿用平台原值，仅归并维度 */
  | 'identity';

/** 维度取值形态。 */
export type DimensionKind =
  /** 无序分类，如性别 */
  | 'nominal'
  /** 有序分档，如年龄段、城市等级 */
  | 'ordinal'
  /** 连续数值 */
  | 'numeric';

/**
 * 画像实体类型。开放字符串：新增实体类型无需改此处。
 * 约定值：product / channel / brand / category / series / ip / competitor / mall
 */
export type EntityType = string;

/** 单个标签的占比与相对偏好度。 */
export interface PortraitLabel {
  /** 占比，0-1。 */
  share: number;
  /** TGI。部分平台（如天猫）不提供，此字段缺失。缺失不等于 0。 */
  tgi?: number;
}

/** 统一维度的投影结果。 */
export interface PortraitProjection {
  dimension: DimensionId;
  labels: Record<string, PortraitLabel>;
  /** 归并到该维度时发生精度损失（如源档位跨目标边界）。 */
  precisionLoss?: boolean;
  /** 造成精度损失的具体源档位。 */
  lossySources?: string[];
  /** 平台原生标签未参与投影时，记录被丢弃的源维度。 */
  unmappedSourceDimensions?: string[];
}

/** 一份完整的画像记录。 */
export interface Portrait {
  entityType: EntityType;
  entityId: string;
  /** 数据月份 YYYY-MM。 */
  month: string;
  /**
   * 平台原生标签，按 `平台 → 原生维度 → 标签值` 三层分组完整保留，
   * 不做投影、不丢信息。
   */
  platformLabels: Record<PlatformId, Record<string, Record<string, PortraitLabel>>>;
  /** 统一维度投影。 */
  projections: Record<DimensionId, PortraitProjection>;
  /** 样本量。 */
  sampleSize?: number;
  /** 画像覆盖率 0-1。 */
  coverage?: number;
}

/** 维度定义。 */
export interface DimensionSpec {
  id: DimensionId;
  /** 中文名，业务侧可读。 */
  label: string;
  kind: DimensionKind;
  /** 是否为匹配内核使用的六维主干。 */
  core: boolean;
  /** 提供该维度原生字段的平台。 */
  platforms: PlatformId[];
  /**
   * 各平台的**原生维度名**。用于把平台原始字段定位到统一维度。
   */
  sourceDimensions?: Partial<Record<PlatformId, string[]>>;
  /**
   * 各平台的原生维度名**通配模式**（`*` 匹配任意串）。
   * 用于覆盖无法穷举的同族维度，如天猫各品类「…价格段偏好」。
   */
  sourceDimensionPatterns?: Partial<Record<PlatformId, string[]>>;
  /** 目标标签词表。有序维度须按值从低到高排列。 */
  labels?: string[];
  /** 投影模式。 */
  projection: ProjectionMode;
  /**
   * 体系族。用于强制「泛人群体系」与「服饰体系」不得互转。
   * 未声明族号的维度不参与互转检查。
   */
  family?: string;
  description?: string;
}

/** 跨平台标签映射的置信类型。 */
export type MappingConfidence =
  /** 同名同义，逐字对应 */
  | 'exact'
  /** 人工判定为等价 */
  | 'manual'
  /** 按规则推导 */
  | 'derived';

/** 单条跨平台标签映射。 */
export interface TagMapping {
  id: string;
  platform: PlatformId;
  /** 平台原生维度名（如「八大消费群体」）。 */
  sourceDimension: string;
  /** 平台原生标签值（如「都市银发」）。 */
  sourceLabel: string;
  targetDimension: DimensionId;
  targetLabel: string;
  confidence: MappingConfidence;
  /** 映射状态。未确认的映射不参与投影。 */
  status: 'confirmed' | 'needs-confirmation';
  note?: string;
}

/** 年龄等有序分档的归并精度。 */
export type BandPrecision =
  /** 源档位完整落在目标档内 */
  | 'exact'
  /** 源档位跨越目标边界 */
  | 'partial'
  /** 语义近似但不完全等价 */
  | 'lossy'
  /** 无对应目标 */
  | 'unmapped';

/** 单条有序分档归并规则。 */
export interface BandRule {
  platform: PlatformId;
  /** 源档位原始写法。 */
  sourceBand: string;
  /** 目标档位。unmapped 时为 null。 */
  targetBand: string | null;
  precision: BandPrecision;
  /** 部分落入的次要目标档。 */
  spill?: string;
  note?: string;
}
