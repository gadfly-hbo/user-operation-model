import type { Portrait } from '../portrait/types.js';
import type { ProductDossier } from '../product/types.js';

/** 归一化过程中发现的问题。 */
export interface NormalizationIssue {
  kind:
    | 'unmapped-dimension'
    | 'unmapped-value'
    | 'missing-field'
    | 'conflict'
    | 'parse-error';
  /** 严重度。未映射类问题不阻断流程，解析错误与冲突是阻断级。 */
  severity: 'warning' | 'error';
  platform?: string;
  sourceDimension?: string;
  sourceLabel?: string;
  message: string;
}

/** 归一化后的画像，附带问题清单。 */
export type NormalizedPortrait = Portrait & { issues?: NormalizationIssue[] };

/** 渠道记录。 */
export interface ChannelRecord {
  channelId: string;
  name?: string;
  brand?: string;
  platform?: string;
  channelType?: string;
  channelGrade?: string;
  firstChannel?: string;
  secondChannel?: string;
  province?: string;
  city?: string;
  cityTier?: string;
  storeStatus?: string;
  openDate?: string;
  closeDate?: string;
  attributes?: Record<string, string>;
}

/** 商品归一化结果。 */
export interface ProductNormalizationResult {
  products: ProductDossier[];
  issues: NormalizationIssue[];
}

/** 渠道归一化结果。 */
export interface ChannelNormalizationResult {
  channels: ChannelRecord[];
  issues: NormalizationIssue[];
}

/** 归一化选项。 */
export interface NormalizeOptions {
  entityType?: 'product' | 'channel' | 'brand';
  entityId?: string;
  month?: string;
}

/**
 * 归一化过程中的致命错误。
 *
 * 与「该月无画像」这类**正常的空结果**区分开：结构性错误（文件损坏、
 * 格式不符、缺关键列）必须抛出，调用方才能区分「数据坏了」与「没数据」。
 */
export class NormalizationError extends Error {
  constructor(
    readonly kind: NormalizationIssue['kind'],
    message: string,
    readonly source?: string,
  ) {
    super(message);
    this.name = 'NormalizationError';
  }
}
