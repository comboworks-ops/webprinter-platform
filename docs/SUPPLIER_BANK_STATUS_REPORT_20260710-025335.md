# Supplier Bank Status Report

Generated: 2026-07-10T00:53:35.529Z
Registry: /Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/config/supplier-bank/sources.json
Archived products: excluded

## Scope

- Read-only supplier-bank status report.
- No supplier scraping.
- No supplier-bank writes.
- No product creation or publishing.
- No live pricing writes.
- Salgsmapper/Sales Maba is internal and excluded as an external supplier source.

## Coverage

- Registry suppliers: 3
- Seeded suppliers: 3
- Sources with bank products: 3
- Covered families: 9/25
- Missing families: 16

## Current Proof Trail

- Completion audit: `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`
- Approval packet: `docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md`
- Decision queue: `docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md`
- Executive summary: `docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST.md`
- Expansion packet: `docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md`
- Gate roadmap: `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`
- URL candidate report: `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`
- URL confirmation checklist: `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`
- Pixart rigids no-write preflight: `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md`
- Print.com placemats no-write preflight: `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md`

### Supplier Rows

- Pixartprinting (pixartprinting)
  - Status: candidate / disabled
  - Action: Fix blocked staged product
  - Expected families: banners, labels, posters, rollups, signs, stickers
  - Staged families: signs, stickers
  - Missing families: banners, labels, posters, rollups
  - Readiness: ready:0 needs_approval:0 imported:1 blocked:1
  - Next: Kør Pixart storformat dry-run og brug den eksplicitte draft-import, hvis previewet er godkendt.
- WIRmachenDRUCK (wir-machen-druck)
  - Status: active / enabled
  - Action: Expand staged supplier
  - Expected families: banners, books, business_cards, flyers, folders, labels, letterheads, posters, rollups, sales_folders, signs, stickers
  - Staged families: folders
  - Missing families: banners, books, business_cards, flyers, labels, letterheads, posters, rollups, sales_folders, signs, stickers
  - Readiness: ready:0 needs_approval:0 imported:1 blocked:0
  - Next: Udvid med næste dry extraction: flyers.
- Print.com (print-com)
  - Status: candidate / disabled
  - Action: Expand staged supplier
  - Expected families: business_cards, flyers, folders, letterheads, other, packaging, tshirts
  - Staged families: business_cards, flyers, folders, letterheads, packaging, tshirts
  - Missing families: other
  - Readiness: ready:0 needs_approval:0 imported:6 blocked:0
  - Next: Udvid med næste dry extraction: other.

## Import Eligibility

- Products checked: 9
- Ready now: 0
- Ready after bank approval: 0
- Already imported: 8
- Blocked: 1

### Products (9 of 9)

- blokeret | Pixart pladematerialer
  - Supplier/key: Pixartprinting / pixart-rigids
  - Family/status: signs / approved
  - Import route: storformat
  - Snapshots/latest: 1 / 728afc26-9348-4946-becb-2b747b3b1646
  - Latest review: none
  - DKK range: 182.7-689.09
  - Import note: Pixart rigids rows require the storformat conversion path before draft import.
- allerede importeret | businesscard-boxes
  - Supplier/key: Print.com / businesscard-boxes
  - Family/status: packaging / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / a71987cc-9ba3-4000-9623-fba4ca04981e
  - Latest review: none
  - DKK range: 101.09-505.71
  - Import note: businesscard-boxes-cb5b6871
- allerede importeret | businesscards
  - Supplier/key: Print.com / businesscards
  - Family/status: business_cards / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / 12284622-173c-4ffc-b3cb-b7deb21aae75
  - Latest review: none
  - DKK range: 196.82-225.97
  - Import note: businesscards-ee38a8ad
- allerede importeret | Flyers
  - Supplier/key: Print.com / flyers
  - Family/status: flyers / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / 7004554c-df96-4ff2-a2a5-53fd56dea0c0
  - Latest review: none
  - DKK range: 194.88-271.08
  - Import note: flyers-310b7eb7
- allerede importeret | Pixart selvklaebende folie
  - Supplier/key: Pixartprinting / pixart-flat-surface-adhesive
  - Family/status: stickers / approved
  - Import route: storformat
  - Snapshots/latest: 5 / 476e02a8-6f18-4505-905e-6df328ea22fb
  - Latest review: accepted (latest)
  - DKK range: 183.59-3387.44
  - Import note: pixart-flat-surface-adhesive-storformat-draft
- allerede importeret | presentation-Mapper
  - Supplier/key: Print.com / presentation-folders
  - Family/status: folders / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / abb777e0-2d3f-409c-b7ea-991d77d2d102
  - Latest review: none
  - DKK range: 786.55-1675.71
  - Import note: presentation-folders-f919f4c7
- allerede importeret | printed-Brevpapir
  - Supplier/key: Print.com / printed-letterheads
  - Family/status: letterheads / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / be86a2d1-79ea-4182-9074-a34da67a9c02
  - Latest review: none
  - DKK range: 676.51-807.8
  - Import note: printed-letterheads-9669dc1c
- allerede importeret | t-shirt-basic-7
  - Supplier/key: Print.com / t-shirt-basic-7
  - Family/status: tshirts / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 1 / ef0a9118-16f6-4352-8d4b-6be13e9fbacc
  - Latest review: none
  - DKK range: 597.5-5359.19
  - Import note: t-shirt-basic-7-c508852f
- allerede importeret | WIRmachenDRUCK Foldere
  - Supplier/key: WIRmachenDRUCK / wmd-folder-bank
  - Family/status: folders / approved
  - Import route: matrix_layout_v1
  - Snapshots/latest: 4 / aabc6392-d662-4e4c-b0f4-94fcb7cc5f18
  - Latest review: accepted (latest)
  - DKK range: 102-41899
  - Import note: wmd-folder-bank-20260703

## Imported Draft QA

- Imported drafts checked: 10
- OK: 9
- Warnings: 0
- Errors: 1
- Published targets found: 1
- Matrix/storformat imports: 9/1

### Draft QA Issues

- FEJL | WIRmachenDRUCK Foldere
  - Supplier/key: WIRmachenDRUCK / wmd-folder-bank
  - Target: wmd-folder-bank-891a5cf1
  - Errors: Target product is published; supplier-bank imports should remain unpublished until explicit approval.
  - Warnings: none

## Recommended Next Step

Supplier: Pixartprinting (pixartprinting)
Action type: Fix blocked staged product
Next action: Kør Pixart storformat dry-run og brug den eksplicitte draft-import, hvis previewet er godkendt.

### Safe/checklist steps

1. Review latest no-write decision packet: /Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-075836.md
2. Review stored-snapshot storformat report: docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-075859.md
3. Business decision needed: either keep current Plastic-only stored snapshot in review, or explicitly approve the bank-only write of the improved Plastic+Plexiglass candidate.
4. Keep Pixart disabled/candidate and keep generic Matrix Layout import blocked.

### Approval-gated write commands

Do not run these until explicit supplier-bank write approval is given.

1. Only after explicit bank-write approval: node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot '/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json' --write-bank
2. After bank write only: node scripts/supplier-bank-cli.mjs compare-normalized-snapshots '/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json' '/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json' --write-delta-review --notes "Pixart rigids visible-option two-category candidate"

### Recheck commands

```bash
npm run supplier-bank:review-source-coverage
npm run supplier-bank:review-import-eligibility
npm run supplier-bank:completion-audit
```

## Pixart Rigids Decision State

- Candidate: `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`
- Baseline: `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json`
- Packet report: `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main/docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-075836.md`
- Preflight report: `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-124404.md`
- Storformat review: `docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-075859.md`
- Packet ready: yes
- Preflight ready: yes
- Candidate rows/effective rows: `18/18`
- Candidate categories: Plastic, Plexiglass
- Candidate materials: Foamex 3mm, Clear Polycarbonate 3mm
- Candidate DKK range: `182.7-976.83`
- Duplicate keys old/new: `12/0`
- Added/removed rows: `18/3`

Decision: the improved Pixart rigids candidate is prepared for explicit bank-only write approval, but no write has been performed by this report.

## Guardrails

- Keep Pixart wide-format products on the storformat path, not the generic Matrix draft importer.
- Pixart rigids candidate data remains local-only until explicit supplier-bank `--write-bank` approval.
- Print.com supplier-bank data must stay separate from POD v2 tables.
- New imported products should stay unpublished drafts unless publishing is explicitly approved.
