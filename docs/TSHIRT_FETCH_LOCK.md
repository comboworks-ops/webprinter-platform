# T-shirt Fetch Lock

Date: 2026-02-27  
Scope: T-shirt product imports only

## Purpose

Lock the size-distribution behavior so it is always present for t-shirt imports and never applied globally to unrelated products.

## Locked Source

- `scripts/product-import/tshirt-size-distribution-lock.js`
- Exported helper: `buildTshirtTechnicalSpecs({ widthMm, heightMm, formatLabel })`

## Locked Rules

1. Applies only to t-shirt fetch/import scripts.
2. Must include `technical_specs.size_distribution` with:
   - `enabled: true`
   - `title: "Størrelsesfordeling"`
   - `enforce_quantity_match: true`
   - fields:
     - `Small`
     - `Medium`
     - `Large`
     - `XL`
     - `2XL`
     - `3XL`
     - `4XL`
     - `5XL`
3. Must remain non-pricing metadata (no price math changes).
4. Must not change generic fetch, fetch2, pixart, or core pricing engines.

## Current Script Binding

- `scripts/fetch-silketryk-tshirt-import.mjs`
- `scripts/fetch-silketryk-tshirt-import.js`

Both now use the shared lock helper for create/update payloads.

## Rollback

If a regression occurs:
1. Revert only t-shirt import script changes and lock helper.
2. Keep storefront/product pricing logic unchanged.
