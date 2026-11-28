export * from './portrait/types.js';
export * from './period/index.js';
export { DimensionRegistry, MappingTable, BandResolver } from './portrait/registry.js';
export { DIMENSIONS, CORE_DIMENSION_IDS } from './portrait/catalog/dimensions.js';
export { TAG_MAPPINGS } from './portrait/catalog/mappings.js';
export { AGE_BAND_RULES, UNIFIED_AGE_BANDS } from './portrait/catalog/age-bands.js';

export * from './product/types.js';
export { FieldCatalog, allowsUsage } from './product/fields.js';
export { PRODUCT_FIELDS } from './product/catalog/fields.js';

export * from './normalize/index.js';

export * from './index/types.js';
export * from './index/build.js';
export * from './index/query.js';
export * from './index/similarity.js';

export * from './match/types.js';
export {
  MATCH_CONFIG,
  DISTRIBUTION_DIMENSIONS,
  validateMatchConfig,
  loadMatchConfig,
} from './match/config.js';
export type {
  MatchConfig,
  PriceBandRule,
  PriceCondition,
  PriceConditionField,
  PriceConditionOp,
} from './match/config.js';
export { scoreMatch } from './match/kernel.js';
export { resolveUnitPrice, resolveRetailAmount, type ResolvedUnitPrice, type UnitPriceInput } from './match/price.js';
export { toMatchPortraitInput } from './match/portrait-input.js';
