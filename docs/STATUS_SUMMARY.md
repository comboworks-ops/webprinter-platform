# Status Summary (Pricing System Work)

Date: 2026-01-17

## Current State
- Matrix Layout V1 pricing works end-to-end on frontend with pagination.
- Optional sections use a checkbox toggle on the frontend (valgfri).
- Prices now render in frontend; debug line removed.
- Auto-backups are created in Price List Bank on every Matrix V1 publish.
- Thumbnails from backend price layout are persisted and shown on frontend.

## Key Files Updated
- src/components/product-price-page/MatrixLayoutV1Renderer.tsx
- src/components/product-price-page/ProductPricePanel.tsx
- src/pages/ProductPrice.tsx
- src/components/admin/ProductAttributeBuilder.tsx
- docs/PRICING_SYSTEM.md

## Admin Workflow (Quick Reminder)
1) Configure layout in Price Generator.
2) Export CSV, fill prices, import.
3) Click "Brug priser i systemet".
4) Click "Gem Prisliste (Matrix V1)" to publish.

## Optional Sections (Valgfri)
- Each optional section shows a checkbox in frontend.
- Checking enables the section and auto-selects the first option.
- Unchecking clears the selection.

## CSV Notes
- CSV uses semicolon delimiter.
- First row is #meta;{...} and must be preserved for strict mapping.
- Optional sections include blank rows for "none".

## Auto Backup
- Every "Gem Prisliste (Matrix V1)" creates an AUTO BACKUP in Price List Bank.
- Backups contain pricing_structure + generator state.

## Pending / If Needed
- Add Excel-friendly export mode (sep=; line + importer handling).
- Create git branch + commit for a code fallback (if requested).
