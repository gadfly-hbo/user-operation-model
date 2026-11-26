export * from './portrait/types.js';
export { DimensionRegistry, MappingTable, BandResolver } from './portrait/registry.js';
export { DIMENSIONS, CORE_DIMENSION_IDS } from './portrait/catalog/dimensions.js';
export { TAG_MAPPINGS } from './portrait/catalog/mappings.js';
export { AGE_BAND_RULES, UNIFIED_AGE_BANDS } from './portrait/catalog/age-bands.js';

export * from './product/types.js';
export { FieldCatalog, allowsUsage } from './product/fields.js';
export { PRODUCT_FIELDS } from './product/catalog/fields.js';

export * from './normalize/index.js';
