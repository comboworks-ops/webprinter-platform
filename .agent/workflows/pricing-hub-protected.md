---
description: Protected Pricing Hub CSV import + publish flow (locked)
---

# Pricing Hub CSV Import and Publish (LOCKED)

The Pricing Hub CSV import and publish flow is stable and should be treated as **locked**. Do not modify this system without explicit user approval.

## Requirements Source
- CSV import requirements and operator workflow are documented in:
- `docs/PRICING_HUB_CSV_IMPORT_REQUIREMENTS.md`

## Protected Files
- `src/pages/admin/PricingHub.tsx` - Pricing Hub UI and CSV workflow entry points
- `src/hooks/usePricingHub.ts` - CSV parsing, attribute detection, import aggregation
- `src/components/admin/pricing-hub/*` - Matrix builder, preview, and publish flow

## What Must Be Preserved
- Standalone behavior: must not alter core pricing logic or MPA engine
- CSV parsing and attribute detection must remain backwards compatible
- Matrix builder mapping must output the same meta layout used by the Smart Price Generator
- Publish flow must only provision attributes/values and prices for the selected product

## If Changes Are Needed
- Get explicit approval first
- Keep changes minimal and additive
- Validate with at least one real CSV import and publish test

## Last Verified Working
- 2026-02-08 (manual review)

## Lock Fixes (2026-02-09)

These fixes are now part of the locked behavior and should not be removed without explicit approval.

### A) Product Configuration re-save must replace old matrix rows
- File: `src/components/admin/ProductAttributeBuilder.tsx`
- Function: `handlePushMatrixLayoutV1`
- Locked behavior:
- `variant_name` must include all non-vertical selections (not only finish variant IDs).
- Save flow must delete existing `generic_product_prices` for the product before upsert.
- Why:
- Prevents stale/legacy keys from surviving and showing old prices on frontend after a new save.

### B) Pricing Hub mapping metadata must persist to product attributes
- File: `src/components/admin/pricing-hub/PublishDialog.tsx`
- Function: `handlePublish` (`ensureValue` helper)
- Locked behavior:
- Use mapping `displayName` when creating/updating values.
- For format values, persist `width_mm` and `height_mm` when provided.
- Persist optional image URL into `meta.image`.
- Why:
- Ensures mapped/renamed values are reusable in Product Configuration and design-online flows.

## Rollback Note (If Regression)

Use non-destructive file restore for these files only:

```bash
git checkout <known-good-ref> -- src/components/admin/ProductAttributeBuilder.tsx
git checkout <known-good-ref> -- src/components/admin/pricing-hub/PublishDialog.tsx
```

Then verify:
- Re-save product prices and confirm frontend reflects latest prices.
- Publish from Pricing Hub and confirm renamed values + format dimensions still persist.
