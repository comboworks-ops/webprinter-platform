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
