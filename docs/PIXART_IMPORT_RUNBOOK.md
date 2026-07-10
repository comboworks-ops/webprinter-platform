# Pixart Import Runbook (With UX/Logic Guardrails)

Last updated: February 25, 2026
Owner: Webprinter import workflow (`$pixart`)

## Purpose

This document defines the safe, repeatable process for importing Pixart wide-format products into Webprinter and the non-negotiable guardrails for Format + Storformat UX.

## What Was Completed

1. Pixart skill is now standardized and callable as `$pixart`.
2. The Pixart workflow is documented as end-to-end:
   - `probe` -> `extract` -> `validate` -> `import --dry-run` -> `import --publish`.
3. The script used for imports is:
   - `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
4. The script now supports profiles:
   - `--profile flat-surface-adhesive`
   - `--profile rigids`
5. Format/Storformat display support was aligned to keep image-button UX options available:
   - `small`, `medium`, `large`, `xl`, `xl_notext`.
6. Rigids extraction/import hardening is in place:
   - grid-stability wait after option/size changes
   - anti-spike clamping on base tiers and option deltas
   - separate option groups in layout rows: `Printing`, `White`, `Cut`, `Production`
7. Rigids re-publish completed for:
   - `Aluminium`
   - `Plexiglass`

## Non-Negotiable Guardrails

1. Do not remove or replace existing UX patterns in Format or Storformat without explicit approval.
2. Do not rewrite core pricing logic or schema behavior unless explicitly requested.
3. Use additive changes first; avoid destructive edits.
4. If a change requires structural UX changes, stop and send a clear change notice before implementing.
5. If risky, create and test on a third sandbox product instead of changing the production product directly.

## Change Notice Rule (Mandatory)

If a structural change is required, communicate this exact structure before coding:

1. What must change
2. Why it cannot be solved additively
3. Which UX elements are affected
4. Safer alternative (third product sandbox)
5. Rollback path

## Third Product Sandbox Policy

When uncertain or high-risk:

1. Create a separate sandbox product (for example: `<name>-sandbox`).
2. Apply new structure there only.
3. Validate with preview + admin checks.
4. Promote only after approval.
5. Keep original product unchanged until promotion is confirmed.

## Standard Pixart Import Procedure

1. Probe:
   - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile <profile> --url "<pixart-url>"`
2. Extract:
   - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile <profile> --url "<pixart-url>"`
3. Validate output in `pricing_raw/`:
   - Ensure rows exist for requested material x finish x area x quantity.
4. Dry-run import:
   - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --dry-run --input pricing_raw/<file>.json`
5. Live import:
   - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --input pricing_raw/<file>.json --tenant-id <tenant-uuid> --product-name "<name>" --product-slug <slug> --publish`
6. Admin QA:
   - Materials visible
   - Finish buttons visible
   - Quantities present
   - Prices render in preview matrix

## Supplier-Bank First Slice

When Pixart is being evaluated for the Supplier Product Bank, start with the
supplier-bank preview wrapper instead of the live import path:

```bash
node scripts/supplier-bank-cli.mjs pixart-bank-first-slice
```

Package alias:

```bash
npm run supplier-bank:pixart-first-slice:preview
```

This performs a registry validation, Pixart probe, and tiny local-only
extraction. It defaults to headful browser mode for the supplier-bank first
slice because the flat-surface quote grid was unavailable in headless mode
during testing. It must not write supplier-bank database rows, create
Webprinter products, publish products, or write live pricing.

Headless supplier-bank preview result on 2026-07-03:

- Profile: `flat-surface-adhesive`
- Probe: succeeded
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T00-56-55-442Z.json`
- Attempted rows: `3`
- Valid priced rows: `0`
- Error: `quantity-row-not-found`
- Bank write ready: `no`

Do not create Pixart supplier-bank snapshots until the quote-row extraction is
fixed or a rerun produces valid priced rows.

Safety note: Pixart dry-run import now refuses failed extraction artifacts with
`null` or empty price fields. A zero-priced dry-run from `quantity-row-not-found`
rows is not a valid import preview.

Headful supplier-bank preview result on 2026-07-03:

- Command: `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice`
- Profile: `flat-surface-adhesive`
- Probe: succeeded and found the price grid
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-03-23-032Z.json`
- Attempted rows: `3`
- Valid priced rows: `3`
- Supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-010323.json`
- Bank write ready: `yes`
- No supplier-bank database rows, Webprinter products, published products, or
  live pricing were written.

Next supplier-bank step: add a guarded Pixart bank snapshot writer using this
normalized preview shape, then review it before any storformat draft import.

Guarded supplier-bank writer:

```bash
node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot <preview.json>
```

This is preview-only unless `--write-bank` is added. Confirmed writes may touch
only supplier-bank staging tables and must not create Webprinter products,
publish products, or write live pricing.

Confirmed supplier-bank write on 2026-07-03:

- Preview input:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-010323.json`
- Supplier enabled state preserved: `false`
- Bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
- Bank product status: `draft`
- Price snapshot id: `8c5fcf2b-2c70-41b3-98cf-1cd6dd1cc98d`
- Rows: `3`
- DKK range: `183.59-550.62`
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Larger supplier-bank slice on 2026-07-03:

- Command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 1 --limit-laminations 2 --limit-areas 2 --limit-quantities 4 --require-valid-rows`
- Browser mode: `headful`
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-13-59-255Z.json`
- Attempted rows: `16`
- Valid priced rows: `16`
- Error counts: `{"none":16}`
- Supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-011359.json`
- Confirmed bank-only snapshot write:
  - scrape run id: `72bb4687-33db-4df1-b886-4a6538b88848`
  - bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
  - bank product status: `draft`
  - price snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - supplier enabled state preserved: `false`
  - rows: `16`
  - DKK range: `183.59-1837.5`
- Draft delta review created from the 3-row snapshot to the 16-row snapshot:
  - review id: `47219880-cfb2-48ce-8adc-56a54c304c75`
  - old snapshot id: `8c5fcf2b-2c70-41b3-98cf-1cd6dd1cc98d`
  - new snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - added rows: `13`
  - changed rows: `0`
  - removed rows: `0`
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Review commands for the staged Pixart bank product:

```bash
npm run supplier-bank:review-pixart
npm run supplier-bank:review-pixart:mark-reviewed:preview
```

The first command is read-only. The second command only previews the next
allowed status transition for the latest Pixart delta review. It does not
change the review unless the explicit CLI-only `--confirm-status-update` flag
is added.

Quality-gated wider slice on 2026-07-03:

- The previous `3 -> 16` Pixart delta review
  `47219880-cfb2-48ce-8adc-56a54c304c75` was marked `reviewed`.
- The flat-surface extractor was tightened to wait for stable price-grid reads
  after dimension and quantity changes.
- Pixart supplier-bank preview validation now rejects:
  - partial extractions where not all attempted rows have valid prices
  - duplicate price series across different area sizes for the same
    material/finish
- Two local previews were intentionally not written to the bank:
  - `20260703-012312.json`: duplicate area price series
  - `20260703-012639.json`: partial extraction, `30/45` valid rows
- Clean retry command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 1 --limit-laminations 3 --limit-areas 3 --limit-quantities 5 --require-valid-rows`
- Clean extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-28-57-997Z.json`
- Supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`
- Attempted/valid rows: `45/45`
- Confirmed bank-only snapshot write:
  - scrape run id: `9a1b1292-c387-48a1-b7bc-6c5296574a46`
  - price snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - rows: `45`
  - quantities: `1-5`
  - DKK range: `183.59-3387.44`
- Draft delta review created from the 16-row snapshot to the 45-row snapshot:
  - review id: `77d1dace-1493-4b0a-98cb-2423d01aded7`
  - old snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - new snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - added rows: `29`
  - changed rows: `0`
  - removed rows: `0`
- Pixart remains disabled/candidate, the bank product remains `draft`, no
  Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Two-material staged slice on 2026-07-03:

- The previous `16 -> 45` Pixart delta review
  `77d1dace-1493-4b0a-98cb-2423d01aded7` was marked `reviewed`.
- The supplier-bank wrapper now retries the Pixart extraction once with a fresh
  browser session if the extractor process fails before creating an artifact.
- `setRadioByValue` now waits for material/lamination radio inputs before
  failing, which made the two-material run reliable after a transient
  `not-found` state.
- One local attempt was intentionally not written to the bank:
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-35-31-287Z.json`
  - result: `74/90` valid rows
  - errors: one setup failure plus one missing quantity row
- Clean retry command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 2 --limit-laminations 3 --limit-areas 3 --limit-quantities 5 --require-valid-rows`
- Clean extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-38-23-443Z.json`
- Supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-013823.json`
- Attempted/valid rows: `90/90`
- Confirmed bank-only snapshot write:
  - scrape run id: `cc2ff1ca-ae2f-48c9-946a-e63ba1d54e22`
  - price snapshot id: `6b44be25-4128-45f1-948d-9019f8b8e025`
  - rows: `90`
  - materials: `2`
  - finishes: `3`
  - quantities: `1-5`
  - DKK range: `183.59-3387.44`
- Draft delta review created from the 45-row snapshot to the 90-row snapshot:
  - review id: `a5cf2712-7ad7-42e5-9dd2-1690f35f64c1`
  - old snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - new snapshot id: `6b44be25-4128-45f1-948d-9019f8b8e025`
  - added rows: `45`
  - changed rows: `0`
  - removed rows: `0`
- Pixart remains disabled/candidate, the bank product remains `draft`, no
  Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Stricter supplier-bank quality rejection on 2026-07-03:

- The latest `45 -> 90` Pixart delta review
  `a5cf2712-7ad7-42e5-9dd2-1690f35f64c1` is now `rejected`.
- Reason: stricter validation found stale duplicate quote series in wider
  Pixart flat-surface data.
- The 90-row preview `20260703-013823.json` now fails the stricter
  finish-series quality gate because `None` matches paid finishes for one
  material.
- The 16-row preview `20260703-011359.json` and 45-row preview
  `20260703-012857.json` both pass the current supplier-bank validation.
- A three-material attempt produced:
  - partial raw artifact:
    `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-47-06-080Z.json`
    (`120/135` valid rows)
  - full-row but stale raw artifact:
    `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-51-45-293Z.json`
    (`135/135` valid rows, rejected by duplicate area-series validation)
  - rejected local preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-015145.json`
- The supplier-bank wrapper now retries partial Pixart artifacts once with a
  fresh browser session before rejecting the run.
- The Pixart preview validator now rejects duplicate quote series where `None`
  matches a paid finish for the same material/area, in addition to duplicate
  quote series across different area sizes for the same material/finish. Equal
  Standard Matt and Standard Gloss prices are allowed.
- Do not convert the 90-row Pixart snapshot into products until option
  application/verification is hardened and a new wider preview passes all
  quality gates.

Selector/grid hardening follow-up on 2026-07-03:

- Flat-surface radio selection now verifies the requested visible option,
  instead of accepting hidden duplicate radio inputs.
- Flat-surface dimension changes now require a changed quote-grid signature
  before rows are trusted.
- The supplier-bank Pixart wrapper now forwards explicit `--materials` and
  `--laminations` overrides to the extractor.
- Default second material `Gloss Monomeric Self-Adhesive Vinyl` still fails
  the finish-series gate because `None` matches paid finishes.
- Targeted expansion with
  `Matt Monomeric Self-Adhesive Vinyl with Grey Back` also failed the same
  finish-series gate.
- Rejected artifacts from this pass:
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-59-29-640Z.json`
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-02-30-078Z.json`
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-05-43-897Z.json`
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-09-31-124Z.json`
  - rejected local previews: `20260703-015929.json`,
    `20260703-020230.json`, `20260703-020543.json`,
    `20260703-020931.json`
- Current safe supplier-bank Pixart baseline remains
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`.
- Admin draft import now blocks products with multiple snapshots unless the
  latest price-delta review is `accepted` and targets the latest price
  snapshot. The rejected 90-row Pixart snapshot therefore cannot be imported
  from `/admin/supplier-bank` or through `supplier-bank-import-draft`.

## Rigids Notes

1. `rigids` extraction defaults to headed Chromium because Pixart often hides quote grids in headless mode.
2. Rigids import creates one storformat product per selected category (`Plastic`, `Plexiglass`, `Multi-layer materials`, `Aluminium`, `Cardboard`).
3. Rigid option combinations are imported additively to preserve existing storformat pricing UX and avoid core resolver changes.
4. Source options are imported only when available in the active Pixart configuration state (for example, some materials only expose front-side printing).
5. If source rows are noisy, use the capped-delta import path instead of changing core storformat pricing logic.

## Definition of Done

1. Product exists with correct name/slug/category.
2. Material rows and finish buttons behave as expected.
3. Prices show in admin and preview.
4. Existing Format/Storformat UX remains intact for other products.
5. No unapproved structural UX or logic replacement was introduced.
