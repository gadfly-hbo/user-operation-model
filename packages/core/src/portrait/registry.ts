import type {
  BandRule,
  DimensionId,
  DimensionSpec,
  PlatformId,
  TagMapping,
} from './types.js';
import { DIMENSIONS } from './catalog/dimensions.js';
import { TAG_MAPPINGS } from './catalog/mappings.js';
import { AGE_BAND_RULES, UNIFIED_AGE_RANGES } from './catalog/age-bands.js';

/** 维度注册表。可运行时追加维度，不改代码。 */
export class DimensionRegistry {
  private readonly specs = new Map<DimensionId, DimensionSpec>();

  constructor(specs: readonly DimensionSpec[] = DIMENSIONS) {
    for (const spec of specs) this.register(spec);
  }

  /** 追加维度。重复 id 抛错，避免静默覆盖。 */
  register(spec: DimensionSpec): void {
    if (this.specs.has(spec.id)) {
      throw new Error(`维度已存在: ${spec.id}`);
    }
    this.specs.set(spec.id, spec);
  }

  /** 追加或覆盖维度。用于运行时热更新场景。 */
  upsert(spec: DimensionSpec): void {
    this.specs.set(spec.id, spec);
  }

  get(id: DimensionId): DimensionSpec | undefined {
    return this.specs.get(id);
  }

  has(id: DimensionId): boolean {
    return this.specs.has(id);
  }

  list(): DimensionSpec[] {
    return [...this.specs.values()];
  }

  /** 六维主干的维度 id。匹配内核只消费这几个。 */
  coreIds(): DimensionId[] {
    return this.list()
      .filter((s) => s.core)
      .map((s) => s.id);
  }

  /** 按平台的原生维度名反查维度定义。 */
  findBySourceDimension(platform: PlatformId, sourceDimension: string): DimensionSpec | undefined {
    for (const spec of this.specs.values()) {
      const names = spec.sourceDimensions?.[platform] ?? [];
      if (names.includes(sourceDimension)) return spec;
      const patterns = spec.sourceDimensionPatterns?.[platform] ?? [];
      if (patterns.some((pattern) => patternToRegExp(pattern).test(sourceDimension))) return spec;
    }
    return undefined;
  }

  platforms(): PlatformId[] {
    const set = new Set<PlatformId>();
    for (const spec of this.specs.values()) {
      for (const platform of spec.platforms) set.add(platform);
    }
    return [...set];
  }

  /** 结构自检。返回问题清单，空数组表示通过。 */
  validate(): string[] {
    const problems: string[] = [];
    for (const spec of this.specs.values()) {
      if (!spec.id.trim()) problems.push('维度 id 为空');
      if (!spec.label.trim()) problems.push(`维度 ${spec.id} 缺少中文名`);
      if (spec.core && (!spec.labels || spec.labels.length === 0)) {
        problems.push(`主干维度 ${spec.id} 必须定义统一词表`);
      }
      if (spec.labels) {
        const seen = new Set<string>();
        for (const label of spec.labels) {
          if (seen.has(label)) problems.push(`维度 ${spec.id} 词表重复: ${label}`);
          seen.add(label);
        }
      }
    }
    return problems;
  }
}

/** 跨平台标签映射表。可运行时追加映射。 */
/** 把带 `*` 的通配模式编译为正则。 */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export class MappingTable {
  private readonly byId = new Map<string, TagMapping>();
  private readonly bySource = new Map<string, TagMapping[]>();
  private readonly registry: DimensionRegistry;

  constructor(
    mappings: readonly TagMapping[] = TAG_MAPPINGS,
    registry: DimensionRegistry = new DimensionRegistry(),
  ) {
    this.registry = registry;
    for (const mapping of mappings) this.add(mapping);
  }

  /**
   * 追加映射。
   *
   * 跨体系互转等结构性问题在此**直接拒绝**，不靠运行期调用 `validate()` 才发现。
   */
  add(mapping: TagMapping): void {
    if (this.byId.has(mapping.id)) {
      throw new Error(`映射 id 已存在: ${mapping.id}`);
    }
    const problems = this.validateOne(mapping);
    if (problems.length > 0) {
      throw new Error(`映射 ${mapping.id} 校验失败: ${problems.join('；')}`);
    }
    this.byId.set(mapping.id, mapping);
    const key = MappingTable.sourceKey(mapping.platform, mapping.sourceDimension, mapping.sourceLabel);
    const bucket = this.bySource.get(key);
    if (bucket) bucket.push(mapping);
    else this.bySource.set(key, [mapping]);
  }

  /** 复合键。用 JSON 数组编码，避免控制字符与分隔符歧义。 */
  private static sourceKey(platform: PlatformId, dimension: string, label: string): string {
    return JSON.stringify([platform, dimension, label]);
  }

  get(id: string): TagMapping | undefined {
    return this.byId.get(id);
  }

  list(): TagMapping[] {
    return [...this.byId.values()];
  }

  /** 精确解析一条已确认的映射。 */
  resolve(
    platform: PlatformId,
    sourceDimension: string,
    sourceLabel: string,
  ): TagMapping | undefined {
    const found = this.bySource.get(MappingTable.sourceKey(platform, sourceDimension, sourceLabel));
    return found?.find((m) => m.status === 'confirmed');
  }

  /** 解析出全部候选（含待确认），供审计使用。 */
  resolveAll(
    platform: PlatformId,
    sourceDimension: string,
    sourceLabel: string,
  ): TagMapping[] {
    return this.bySource.get(MappingTable.sourceKey(platform, sourceDimension, sourceLabel)) ?? [];
  }

  /** 同一源标签被映射到不同目标 —— 冲突清单。 */
  conflicts(): string[] {
    const found: string[] = [];
    for (const [key, bucket] of this.bySource) {
      const targets = new Set(bucket.map((m) => `${m.targetDimension}/${m.targetLabel}`));
      if (targets.size > 1) {
        found.push(`${key} → ${[...targets].join(', ')}`);
      }
    }
    return found;
  }

  /**
   * 与维度注册表交叉校验：
   * 目标维度必须存在；目标标签必须在该维度的统一词表内；不得跨体系互转。
   */
  validate(registry: DimensionRegistry = this.registry): string[] {
    const problems: string[] = [];
    for (const mapping of this.byId.values()) {
      problems.push(...this.validateOne(mapping, registry));
    }
    return problems;
  }

  /** 单条映射的结构校验。 */
  validateOne(mapping: TagMapping, registry: DimensionRegistry = this.registry): string[] {
    const problems: string[] = [];
    const target = registry.get(mapping.targetDimension);
    if (!target) {
      problems.push(`目标维度未登记: ${mapping.targetDimension}`);
      return problems;
    }
    if (target.labels && !target.labels.includes(mapping.targetLabel)) {
      problems.push(`目标标签不在维度 ${target.id} 词表内: ${mapping.targetLabel}`);
    }
    // 源维度必须已在维度目录登记，否则无法判定体系族，禁止入库。
    const sourceSpec = registry.findBySourceDimension(mapping.platform, mapping.sourceDimension);
    if (!sourceSpec) {
      problems.push(
        `源维度未登记: ${mapping.platform}/${mapping.sourceDimension}`,
      );
    } else if (sourceSpec.family && target.family && sourceSpec.family !== target.family) {
      // 禁止跨体系互转
      problems.push(
        `跨体系互转：源维度 ${sourceSpec.id}(${sourceSpec.family}) → 目标维度 ${target.id}(${target.family})`,
      );
    }
    return problems;
  }
}

/** 有序分档（年龄等）的归并规则表。可运行时追加。 */
export class BandResolver {
  private readonly rules: BandRule[] = [];
  private rangeTable: Record<string, [number, number]>;

  constructor(
    rules: readonly BandRule[] = AGE_BAND_RULES,
    ranges: Record<string, [number, number]> = UNIFIED_AGE_RANGES,
  ) {
    for (const rule of rules) this.add(rule);
    this.rangeTable = ranges;
  }

  /** 目标档的数值区间表。用于按重叠比例拆分跨边界源档。 */
  ranges(): Record<string, [number, number]> {
    return this.rangeTable;
  }

  add(rule: BandRule): void {
    this.rules.push(rule);
  }

  resolve(platform: PlatformId, sourceBand: string): BandRule | undefined {
    return this.rules.find((r) => r.platform === platform && r.sourceBand === sourceBand);
  }

  list(): BandRule[] {
    return [...this.rules];
  }

  platforms(): PlatformId[] {
    return [...new Set(this.rules.map((r) => r.platform))];
  }

  /** 有映射但精度受损的档位清单。 */
  lossyBands(): string[] {
    return this.rules
      .filter((r) => r.precision === 'partial' || r.precision === 'lossy' || r.precision === 'unmapped')
      .map((r) => `${r.platform}/${r.sourceBand} (${r.precision})`);
  }
}
