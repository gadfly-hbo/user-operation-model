import type {
  DimensionId,
  DimensionSpec,
  PlatformId,
  PortraitLabel,
  PortraitProjection,
} from '../portrait/types.js';
import type { BandResolver, DimensionRegistry, MappingTable } from '../portrait/registry.js';
import type { NormalizationIssue } from './types.js';

/** 投影上下文。 */
export interface ProjectContext {
  registry: DimensionRegistry;
  mappings: MappingTable;
  bands: BandResolver;
}

export interface ProjectResult {
  projections: Record<DimensionId, PortraitProjection>;
  issues: NormalizationIssue[];
}

/** 标签累加器：占比直接相加，TGI 按占比加权平均。 */
interface LabelAccumulator {
  share: number;
  tgiSum: number;
  tgiWeight: number;
}

interface DimensionAccumulator {
  dimension: DimensionId;
  labels: Record<string, LabelAccumulator>;
  lossySources: string[];
}

/**
 * 把平台原生标签投影到统一维度。
 *
 * 三种投影模式（由维度目录的 `projection` 字段决定）：
 * - `mapping`  按跨平台映射表对齐到统一词表（核心维度）
 * - `bands`    按有序分档归并规则投影（年龄）
 * - `identity` 沿用平台原值，仅归并维度（扩展维度）
 *
 * 标签命名空间规则：当一个目标维度在同一平台有多个原生来源，
 * 或该来源由通配模式匹配而来时，目标标签带原生维度名前缀，
 * 避免不同原生维度的同名标签互相覆盖。
 */
export function projectPortraitLabels(
  platform: PlatformId,
  platformLabels: Record<string, Record<string, PortraitLabel>>,
  ctx: ProjectContext,
): ProjectResult {
  const issues: NormalizationIssue[] = [];
  const accumulators = new Map<DimensionId, DimensionAccumulator>();

  const index = buildSourceIndex(platform, platformLabels, ctx.registry);

  for (const [sourceDimension, sourceLabels] of Object.entries(platformLabels)) {
    const target = index.get(sourceDimension);
    if (!target) {
      issues.push({
        kind: 'unmapped-dimension',
        platform,
        sourceDimension,
        severity: 'warning',
        message: `原生维度「${sourceDimension}」未登记到统一维度，保留在平台原生标签中不投影`,
      });
      continue;
    }

    for (const [sourceLabel, label] of Object.entries(sourceLabels)) {
      switch (target.mode) {
        case 'mapping':
          projectMapped(platform, sourceDimension, sourceLabel, label, target, ctx, accumulators, issues);
          break;
        case 'bands':
          projectBanded(platform, sourceDimension, sourceLabel, label, target, ctx, accumulators, issues);
          break;
        case 'identity':
          projectIdentity(
            platform,
            sourceDimension,
            sourceLabel,
            label,
            target,
            accumulators,
            issues,
          );
          break;
      }
    }
  }

  const projections: Record<DimensionId, PortraitProjection> = {};
  for (const [dimensionId, accumulator] of accumulators) {
    const labels: Record<string, PortraitLabel> = {};
    for (const [label, acc] of Object.entries(accumulator.labels)) {
      const projected: PortraitLabel = { share: acc.share };
      if (acc.tgiWeight > 0) projected.tgi = acc.tgiSum / acc.tgiWeight;
      labels[label] = projected;
    }
    const projection: PortraitProjection = { dimension: dimensionId, labels };
    if (accumulator.lossySources.length > 0) {
      projection.precisionLoss = true;
      projection.lossySources = accumulator.lossySources;
    }
    projections[dimensionId] = projection;
  }

  return { projections, issues };
}

interface SourceTarget {
  dimension: DimensionId;
  mode: 'mapping' | 'bands' | 'identity';
  /** 目标标签是否需要加原生维度名前缀。 */
  usePrefix: boolean;
}

function buildSourceIndex(
  platform: PlatformId,
  platformLabels: Record<string, unknown>,
  registry: DimensionRegistry,
): Map<string, SourceTarget> {
  const index = new Map<string, SourceTarget>();
  const nativeDimensions = Object.keys(platformLabels);
  const exactCount = new Map<DimensionId, number>();

  for (const spec of registry.list()) {
    for (const name of spec.sourceDimensions?.[platform] ?? []) {
      index.set(name, {
        dimension: spec.id,
        mode: spec.projection ?? 'mapping',
        usePrefix: false,
      });
      exactCount.set(spec.id, (exactCount.get(spec.id) ?? 0) + 1);
    }
  }

  // 通配模式匹配在精确匹配之后，已被精确占用的原生维度不再被模式覆盖
  for (const spec of registry.list()) {
    const patterns = spec.sourceDimensionPatterns?.[platform] ?? [];
    if (patterns.length === 0) continue;
    for (const native of nativeDimensions) {
      if (index.has(native)) continue;
      if (!patterns.some((pattern) => matchPattern(pattern, native))) continue;
      index.set(native, {
        dimension: spec.id,
        mode: spec.projection ?? 'identity',
        usePrefix: true,
      });
    }
  }

  // 同一维度有多个精确来源时，标签需要命名空间
  for (const [name, target] of index) {
    if ((exactCount.get(target.dimension) ?? 0) > 1) {
      index.set(name, { ...target, usePrefix: true });
    }
  }

  return index;
}

function matchPattern(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function projectMapped(
  platform: PlatformId,
  sourceDimension: string,
  sourceLabel: string,
  label: PortraitLabel,
  target: SourceTarget,
  ctx: ProjectContext,
  accumulators: Map<DimensionId, DimensionAccumulator>,
  issues: NormalizationIssue[],
): void {
  const mapping = ctx.mappings.resolve(platform, sourceDimension, sourceLabel);
  if (!mapping) {
    issues.push({
      kind: 'unmapped-value',
      platform,
      sourceDimension,
      sourceLabel,
      severity: 'warning',
      message: `标签「${sourceLabel}」在维度「${sourceDimension}」下无已确认映射，保留原生值不投影`,
    });
    return;
  }
  accumulate(accumulators, mapping.targetDimension, mapping.targetLabel, label);
}

function projectBanded(
  platform: PlatformId,
  sourceDimension: string,
  sourceLabel: string,
  label: PortraitLabel,
  target: SourceTarget,
  ctx: ProjectContext,
  accumulators: Map<DimensionId, DimensionAccumulator>,
  issues: NormalizationIssue[],
): void {
  const rule = ctx.bands.resolve(platform, sourceLabel);
  if (!rule || rule.targetBand === null) {
    issues.push({
      kind: 'unmapped-value',
      platform,
      sourceDimension,
      sourceLabel,
      severity: 'warning',
      message: `档位「${sourceLabel}」无对应目标档，保留原生值不投影`,
    });
    return;
  }
  const accumulator = ensure(accumulators, target.dimension);
  if (rule.precision === 'partial' || rule.precision === 'lossy') {
    accumulator.lossySources.push(sourceLabel);
  }
  accumulate(accumulators, target.dimension, rule.targetBand, label);
}

function projectIdentity(
  platform: PlatformId,
  sourceDimension: string,
  sourceLabel: string,
  label: PortraitLabel,
  target: SourceTarget,
  accumulators: Map<DimensionId, DimensionAccumulator>,
  issues: NormalizationIssue[],
): void {
  const targetLabel = target.usePrefix ? `${sourceDimension}·${sourceLabel}` : sourceLabel;
  accumulate(accumulators, target.dimension, targetLabel, label);
}

function ensure(
  accumulators: Map<DimensionId, DimensionAccumulator>,
  dimension: DimensionId,
): DimensionAccumulator {
  const existing = accumulators.get(dimension);
  if (existing) return existing;
  const created: DimensionAccumulator = { dimension, labels: {}, lossySources: [] };
  accumulators.set(dimension, created);
  return created;
}

function accumulate(
  accumulators: Map<DimensionId, DimensionAccumulator>,
  dimension: DimensionId,
  label: string,
  value: PortraitLabel,
): void {
  const accumulator = ensure(accumulators, dimension);
  const existing = accumulator.labels[label];
  if (!existing) {
    accumulator.labels[label] = {
      share: value.share,
      tgiSum: value.tgi !== undefined ? value.tgi * value.share : 0,
      tgiWeight: value.tgi !== undefined ? value.share : 0,
    };
    return;
  }
  existing.share += value.share;
  if (value.tgi !== undefined) {
    existing.tgiSum += value.tgi * value.share;
    existing.tgiWeight += value.share;
  }
}

/** 维度目录的默认投影模式：定义了统一词表的维度用 mapping，其余用 identity。 */
export function defaultProjectionMode(spec: DimensionSpec): 'mapping' | 'identity' {
  return spec.labels && spec.labels.length > 0 ? 'mapping' : 'identity';
}
