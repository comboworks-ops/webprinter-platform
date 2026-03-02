---
name: pixart
description: Extract Pixart wide-format pricing and import it into Webprinter storformat products end-to-end (probe, extract, validate, import, publish). Use when a user provides a Pixart URL and wants a finished product with materials, finish buttons, quantities, and m² tier pricing.
---

# Pixart Skill

Use this skill when the user asks for Pixart wide-format imports and wants prices fetched and turned into publishable storformat products.

Supported profiles:
- `flat-surface-adhesive`
- `rigids`

Primary script:
- `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`

Invocation label:
- `$pixart`

Guardrails reference:
- `docs/PIXART_IMPORT_RUNBOOK.md`

## Workflow

1. Confirm import inputs
- `profile` (`flat-surface-adhesive` or `rigids`)
- `url` (Pixart page)
- `tenant_id` (default master tenant allowed)
- `product_name` and `product_slug`
- area anchors (default `1,2,3,4,5,10,12,15,20`)
- quantities (default `1..20`)
- finish set (default includes None, Standard matt/gloss, UV matt/gloss)
- FX and markup:
  - `flat-surface-adhesive`: default `eur_to_dkk=7.6`, `markup_pct=80`
  - `rigids`: default `eur_to_dkk=7.6`, `markup_pct=0`

2. Probe the page first
- Run:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile <profile> --url <pixart-url>`
- Verify materials + laminations exist before extraction.

3. Extract price matrix
- Run:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile <profile> --url <pixart-url>`
- Optional debug mode:
  - `... extract --url <pixart-url> --headful`
- Output:
  - `pricing_raw/pixart-<profile>-<timestamp>.json`
  - `pricing_raw/pixart-<profile>-<timestamp>.csv`

4. Validate extraction
- Confirm tuples exist for all requested combinations:
  - `material x lamination x area_m2 x quantity`
- Confirm usable price fields:
  - `fastest_quote_eur` (left column)
  - `cheapest_quote_eur` (right column)
  - derived per-m² values

5. Run dry-run import
- Run:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --dry-run --input <json-file>`
- Check summary counts:
  - parsed rows
  - materials/finishes/variants
  - quantities

6. Live import and publish
- Run:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --input <json-file> --tenant-id <tenant-uuid> --product-name "<name>" --product-slug <slug> --publish`
- This creates/updates a full storformat product with:
  - `products` (`pricing_type=STORFORMAT`)
  - `storformat_configs` (layout + quantities + vertical axis)
  - material tiers (`storformat_materials`, `storformat_material_price_tiers`, `storformat_m2_prices`)
  - finish tiers (`storformat_finishes`, `storformat_finish_price_tiers`, `storformat_finish_prices`)
  - delivery variants in `storformat_products` (standard + optional fast)

7. Post-import check
- Open product in admin and verify:
  - materials appear as rows
  - finishes appear as buttons
  - quantities `1..20` present
  - prices render in preview matrix

## Commands

- Probe:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile flat-surface-adhesive --url <pixart-url>`
- Probe (rigids):
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile rigids --url <pixart-url> --categories "Plastic,Plexiglass,Multi-layer materials,Aluminium,Cardboard"`
- Extract:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile flat-surface-adhesive --url <pixart-url>`
- Extract (rigids):
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile rigids --url <pixart-url> --categories "Plastic,Plexiglass,Multi-layer materials,Aluminium,Cardboard"`
- Fast test extraction:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs extract --profile <profile> --limit-materials 1 --limit-laminations 1 --limit-areas 1 --limit-quantities 3`
- Import dry-run:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --dry-run --input pricing_raw/<file>.json`
- Import live + publish:
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile <profile> --input pricing_raw/<file>.json --tenant-id <tenant-uuid> --product-name "<name>" --product-slug <slug> --eur-to-dkk 7.6 --markup-pct 80 --publish`

- Rigids multi-product import (creates one product per category):
  - `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile rigids --input pricing_raw/<file>.json --categories "Plastic,Plexiglass,Multi-layer materials,Aluminium,Cardboard" --publish`

## Defaults

- Materials (7 target items):
  - `Matt Monomeric Self-Adhesive Vinyl`
  - `Gloss Monomeric Self-Adhesive Vinyl`
  - `Matt Monomeric Self-Adhesive Vinyl with Grey Back`
  - `Gloss Polymeric Self-Adhesive Vinyl with grey back`
  - `Transparent Self-Adhesive Vinyl`
  - `Matt PVC-Free Film with Grey Back`
  - `White PVC-Free EasyWall`

- Laminations:
  - `None`
  - `Standard Matt`
  - `Standard Gloss`
  - `UV Filter 5 Matt`
  - `UV Filter 5 Gloss`

- Area anchors (m²):
  - `1,2,3,4,5,10,12,15,20`

- Quantities:
  - `1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20`

- Conversion defaults:
  - `flat-surface-adhesive`: `eur_to_dkk=7.6`, `markup_pct=80`, `factor=13.68`
  - `rigids`: `eur_to_dkk=7.6`, `markup_pct=0`, `factor=7.6`

- Rigids categories (default):
  - `Plastic`
  - `Plexiglass`
  - `Multi-layer materials`
  - `Aluminium`
  - `Cardboard`

## Notes

- Pixart is dynamic; quote values may appear after a delay. The script waits and retries automatically.
- The price grid shows multiple delivery-date columns; use the rightmost value as cheapest.
- For `rigids`, headed Chromium is used by default because Pixart often suppresses quote grids in headless mode. Use `--headless` only if needed.
- Rigids extraction now waits for grid stability after option/size changes to avoid stale quotes.
- Rigids import applies anti-spike tier clamping (base tiers + option deltas) to prevent extreme outliers from bad source states.
- Rigids layout uses separate sections for `Printing`, `White`, `Cut`, and `Production` (Standard/Fast) where data exists.
- If Pixart changes markup, update selectors in `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`.
- Keep pricing imports additive and tenant-scoped; do not overwrite unrelated product pricing.
- If an import fails, rerun in this order: `probe` -> `extract --headful` -> `import --dry-run` -> live `import`.
- Do not remove or replace existing Format/Storformat UX during imports; use a sandbox product for risky structural experiments.
