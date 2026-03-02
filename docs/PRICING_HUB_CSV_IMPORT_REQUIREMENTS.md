# Pricing Hub CSV Import Requirements (Locked)

Last updated: 2026-02-10

This document is the source of truth for Pricing Hub CSV import behavior and the agreed workflow updates.

## Scope

- Keep existing pricing logic unchanged.
- Keep POD v1 and POD v2 boundaries unchanged.
- Changes are additive in CSV import, mapping, and publish flow.

## Goal

Enable bulk CSV imports (including scraped data) so they can be:

- reviewed in Pricing Hub,
- merged into a project batch,
- mapped to product attributes (format, material, finish, quantity),
- pushed to Product Configuration,
- saved and published so frontend uses the latest prices.

## CSV Input Contract

Pricing Hub accepts semicolon or comma separated CSV and matches columns by aliases.

### Required

- `Quantity` (or alias)
- `Price` (or alias)

### Optional but strongly recommended

- `Size` / format
- `Material` or `Paper weight`
- `Finish`

### Alias mapping (current implementation)

- quantity: `Quantity`, `Antal`, `Stk`, `QTY`
- size: `Size`, `Format`, `Storrelse`
- material: `Material`, `Materiale`, `Papir`, `Paper`, `Medie`, `Media`
- paperWeight: `Paper weight`, `Weight`, `Grammage`, `Papirvagt`, `gsm`, `Gramvagt`
- finish: `Finish`, `Efterbehandling`, `Coating`, `Lak`, `Surface`
- price: `Price (DKK)`, `Price`, `Pris`, `DKK`, `Pris (DKK)`

## Normalization Rules

- Delimiter auto-detect: `;` if more semicolons than commas in header row, otherwise `,`.
- Quantity: parsed as integer; rows with invalid or `<= 0` quantity are skipped.
- Price: non-digits are stripped before integer parsing.
- Finish: normalized to lowercase in parsed variants.
- Material fallback: if material is missing and paper weight is present, material is derived as `<paperWeight>g`.

## Project Merge Behavior

- Each import stores raw rows in `pricing_hub_imports.csv_data`.
- Project `combined_data` appends imported rows.
- Project `detected_attributes` is merged across imports:
- formats
- materials
- finishes
- quantities
- columnMap

This supports large batches with thousands of rows and incremental imports into the same project.

## Mapping and Naming Requirements

- Filename/folder labels must not force product format names.
- Imported format/material/finish values must stay editable in Product Configuration.
- Finish values are expected to be reusable as a finish type later.
- A new CSV that represents a new finish for an existing format/material matrix must be mergeable into the same project.

## Publish + Frontend Consistency (Lock)

To prevent old prices from reappearing on frontend:

- Product Configuration re-save must replace old matrix rows for the product.
- Variant key must include all non-vertical selections (not only finish ids).
- Existing `generic_product_prices` for the product are deleted before upsert in the locked flow.

To preserve mapped value metadata:

- Publish uses mapping display names.
- Format values persist `width_mm` and `height_mm` when provided.
- Optional image URL is persisted to `meta.image`.

Reference lock notes: `.agent/workflows/pricing-hub-protected.md`

## Known Operational Pitfalls

- `pricing_hub_projects.created_by` FK error:
- occurs when auth user id does not exist in required user/profile relation.
- fix by ensuring the user exists in the referenced table before creating project.
- UUID SQL error (`22P02`):
- caused by invalid literal formatting (for example leading `<` `>` in UUID/email values).

## Operator Workflow

1. Create or open a Pricing Hub project.
2. Import one or more CSV files.
3. Verify detected attributes and row preview.
4. Map values (rename format/material/finish as needed).
5. Push to Product Configuration.
6. Save product combinations.
7. Publish to webshop.
8. Verify frontend price for at least 2-3 quantities.

## CSV Builder Prompt Template (for ChatGPT or other LLM)

Use this prompt when converting scraped price data into a valid Pricing Hub CSV:

```text
Convert the provided scraped pricing table into a clean CSV for Pricing Hub.
Output only CSV with one header row and no explanations.
Use semicolon delimiter.
Required columns: Quantity;Size;Material;Finish;Price (DKK)
Rules:
- Quantity must be whole numbers only.
- Price (DKK) must be integer DKK with no currency symbols and no decimals.
- Keep one row per unique variant combination (Quantity + Size + Material + Finish).
- Remove duplicate rows; if duplicates exist, keep the newest/highest confidence row.
- Keep Size values as printable formats (for example A4, A5, 210x297mm).
- Keep Material and Finish as short labels, not long descriptions.
- If Material is missing but paper weight exists, use "<weight>g".
- Do not leave Quantity or Price blank.
Return valid CSV only.
```

## Rollback Note

If regressions appear, restore known good versions of:

- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/admin/pricing-hub/PublishDialog.tsx`
- `src/hooks/usePricingHub.ts`

Then repeat the operator workflow and verify frontend prices update after save + publish.
