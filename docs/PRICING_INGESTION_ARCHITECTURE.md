# Pricing Ingestion Architecture

This document describes the current extractor -> normalizer -> publisher structure for production pricing imports.

The goal is to reduce duplicated importer logic without changing current database contracts, pricing behavior, or frontend compatibility.

## 1) Layer Model

### Extractors
Extractor scripts stay source-aware and product-family-aware.

Examples:
- `scripts/fetch-standard-rollup-import.js`
- `scripts/fetch-salesmapper-import.js`
- `scripts/fetch-color-tshirt-import.js`
- `scripts/fetch2-wmd-roll-labels.mjs`
- `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
- `scripts/fetch-pixart-rigids-import.mjs`
- `scripts/fetch-wmd-neon-posters.mjs`

These scripts still own:
- supplier navigation and scraping
- supplier JSON/API payload handling
- product-family-specific source mapping
- product metadata choices

### Normalizers
Shared canonical records now live under:
- `scripts/product-import/shared/normalized-pricing.js`

Current shared entry points:
- `createNormalizedPricingRecord(...)`
- `createNormalizedMatrixRecord(...)`

The normalized payload is internal only. It is not a DB table and does not change current published row semantics.

### Publishers
Shared matrix publisher helpers now live under:
- `scripts/product-import/shared/matrix-publisher.js`

Current shared responsibilities:
- attribute group provisioning
- attribute value provisioning
- `MatrixLayoutV1` construction
- `generic_product_prices` row generation
- delete + batch insert publish workflow

Validation helpers live under:
- `scripts/product-import/shared/validation.js`

Conversion rule definitions live under:
- `scripts/product-import/shared/conversion.js`

## 2) Canonical Normalized Schema

Each normalized record contains:
- `schemaVersion`
- `target`
  Currently `matrix-layout-v1` for matrix publishers. The schema also allows non-matrix targets.
- `supplier`
- `sourceType`
- `sourceUrl`
- `supplierProductType`
- `productFamily`
- `importerKey`
- `sourceKey`
- `extractedAt`
- `quantity`
- `supplierCurrency`
- `supplierPrice`
- `convertedPriceDkk`
- `finalPriceDkk`
- `conversionRuleKey`
- `markupInputs`
- `dimensions`
  Currently `widthMm`, `heightMm`, `areaM2`
- `selections`
  Canonical dimension/value map before DB UUID resolution
- `labels`
- `sourceIdentifiers`
- `extraData`
  Source traceability and publish metadata that must survive to `generic_product_prices.extra_data`
- `rawPayload`

For matrix products, `selections` is the bridge between importer output and UUID-backed publish rows.

## 3) Shared Conversion Rules

Named conversion rules are defined in `scripts/product-import/shared/conversion.js`.

Current rule families:
- `wmd_tiered_fx_7_5`
- `wmd_tiered_fx_7_6`
- `wmd_roll_labels_threshold_fx_7_6`
- `pixart_markup_80pct_fx_7_6`

Important:
- This centralizes rule names and math.
- It does not standardize business results across importers.
- Existing 7.5 / 7.6 / tier / threshold / markup differences are preserved.

## 4) Shared Matrix Publisher Contract

`publishNormalizedMatrixProduct(...)` expects:
- ensured `productId`
- `tenantId`
- `matrixConfig`
- `normalizedRows`
- optional `productUpdate`
- optional `deleteByTenant`

`matrixConfig` defines:
- vertical axis metadata
- layout sections
- group names and kinds
- section IDs and row IDs
- UI mode and selection mode
- value ordering
- selection map behavior
- which sections participate in `variantValueIds`
- which IDs are copied into `extra_data`

This keeps current `generic_product_prices` semantics intact:
- `variant_name` = sorted pipe-joined non-vertical selected UUIDs
- `variant_value` = vertical axis UUID
- `extra_data.selectionMap` remains importer-compatible

## 5) Current Adoption

### Shared matrix publisher
These paths now publish through the shared matrix layer:
- `scripts/product-import/supabase-import.js`
- `scripts/fetch-standard-rollup-import.js`
- `scripts/fetch-salesmapper-import.js`
- `scripts/fetch-color-tshirt-import.js`

Compatibility wrapper:
- `scripts/fetch-color-tshirt-import.mjs` now forwards to the `.js` implementation

### Shared conversion only
These paths keep their existing publish/storage model but now use the shared conversion engine:
- `scripts/fetch2-wmd-roll-labels.mjs`
- `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
- `scripts/fetch-pixart-rigids-import.mjs`

### Still importer-specific
These remain on their current importer-local publish implementation for now:
- `scripts/fetch-wmd-neon-posters.mjs`
- remaining `fetch-salesmapper-*` scripts
- remaining folder/flyer/poster/visit-card matrix scripts
- remaining t-shirt variants (`silketryk`, `4x4`, etc.)
- POD2 / POD2X flows

Those scripts can be ported incrementally onto the same shared layer without changing their CLI contract.

## 6) Validation Rules

Shared validation currently checks:
- empty import batches
- non-integer or missing quantities
- missing required selections
- duplicate normalized price keys
- broken matrix config definitions
- missing required dimensions where a config explicitly requires them

Optional warning support exists for suspicious price spikes, but it is not forced on every importer.

## 7) Adding a New Matrix Importer

1. Build extractor-specific source rows.
2. Convert source rows into normalized records with `createNormalizedMatrixRecord(...)`.
3. Define a `matrixConfig` matching the current product layout contract.
4. Ensure or create the target product.
5. Call `publishNormalizedMatrixProduct(...)`.
6. Keep any product-specific technical specs, descriptions, and category logic in the importer.

## 8) Dry Run vs Live Import

Recommended pattern:
- extractor continues to produce raw snapshot files under `pricing_raw/`
- cleaned files continue to be written under `pricing_clean/` where applicable
- `--dry-run` validates and summarizes without DB writes
- live mode ensures product/update + publish rows

## 9) Compatibility Notes

The shared architecture is additive and intentionally conservative:
- no DB schema change
- no change to `MatrixLayoutV1` frontend contract
- no change to `generic_product_prices` key semantics
- no change to publish delete-then-reinsert behavior
- no change to importer CLI entry points

The remaining duplicated scripts should be migrated onto the shared layer one family at a time, starting with the folder/salesmapper matrix imports because they share the same publish shape.
