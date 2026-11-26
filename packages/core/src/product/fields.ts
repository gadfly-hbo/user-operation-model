import type { FieldSpec, FieldUsage } from './types.js';
import { PRODUCT_FIELDS } from './catalog/fields.js';

/** 商品字段目录。可运行时追加字段。 */
export class FieldCatalog {
  private readonly fields = new Map<string, FieldSpec>();

  constructor(fields: readonly FieldSpec[] = PRODUCT_FIELDS) {
    for (const field of fields) this.add(field);
  }

  /** 追加字段。重复 key 抛错。 */
  add(field: FieldSpec): void {
    if (this.fields.has(field.key)) {
      throw new Error(`字段已存在: ${field.key}`);
    }
    this.fields.set(field.key, field);
  }

  get(key: string): FieldSpec | undefined {
    return this.fields.get(key);
  }

  has(key: string): boolean {
    return this.fields.has(key);
  }

  list(): FieldSpec[] {
    return [...this.fields.values()];
  }

  /**
   * 该字段是否**禁止进入预测路径**（背对背隔离）。
   * 判据：`usage` 不含 `prediction`。
   */
  isExcludedFromPrediction(key: string): boolean {
    const field = this.fields.get(key);
    if (!field) return true;
    return !field.usage.includes('prediction');
  }

  /** 可用于工具2 预测输入的字段 key。 */
  predictionKeys(): string[] {
    return this.list()
      .filter((f) => f.usage.includes('prediction'))
      .map((f) => f.key);
  }

  /** 可用于画像比对层的字段 key。 */
  comparisonKeys(): string[] {
    return this.list()
      .filter((f) => f.usage.includes('comparison'))
      .map((f) => f.key);
  }

  /** 仅比对层可用、被预测路径排除的字段 key。 */
  excludedFromPredictionKeys(): string[] {
    return this.list()
      .filter((f) => !f.usage.includes('prediction'))
      .map((f) => f.key);
  }

  /** 按源列名反查字段 key。 */
  findBySource(sourceColumn: string): FieldSpec[] {
    return this.list().filter((f) => f.sources?.includes(sourceColumn));
  }

  /** 结构自检。返回问题清单，空数组表示通过。 */
  validate(): string[] {
    const problems: string[] = [];
    for (const field of this.fields.values()) {
      if (!field.key.trim()) problems.push('字段 key 为空');
      if (!field.label.trim()) problems.push(`字段 ${field.key} 缺少中文名`);
      if (field.usage.length === 0) problems.push(`字段 ${field.key} 未声明 usage`);
      if (!field.sources || field.sources.length === 0) {
        problems.push(`字段 ${field.key} 未声明来源列，源表新增同名列时将无法自动识别`);
      }
    }
    return problems;
  }
}

/** 从字段的 usage 判定允许的场景。 */
export function allowsUsage(field: FieldSpec, usage: FieldUsage): boolean {
  return field.usage.includes(usage);
}
