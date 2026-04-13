---
name: neon-posters
description: Extract and import WIRmachenDRUCK neon poster pricing for fixed DIN sizes (A4-A0, B2-B0). Creates one combined matrix-priced product with format buttons and color options.
---

# Neon Posters Skill

Use this skill for WIRmachenDRUCK neon poster products with:
- Fixed DIN sizes (A4, A3, A2, A1, A0, B2, B1, B0) as format buttons
- Neon paper colors (Yellow, Green, Red) as selectable color options
- 80 g/m² neon paper
- Full quantity ladder (50-10000)

Source URL category:
- `https://www.wir-machen-druck.de/plakate-neonpapier-hochformat-guenstig-drucken,category,28289.html`

Script:
- `scripts/fetch-wmd-neon-posters.mjs`

## Guardrails

- Keep changes additive.
- Do not change existing pricing engines or renderer logic.
- Do not alter other fetch scripts unless explicitly requested.
- Use dry extraction and review output before any import/publish step.

## Workflow

1. Probe a specific size page
- Command:
  - `node scripts/fetch-wmd-neon-posters.mjs probe --size A3`
- Confirm:
  - `articleId`, `categoryId`, color options, delivery options

2. Extract price matrix for all sizes
- Command:
  - `node scripts/fetch-wmd-neon-posters.mjs extract`
- Optional controls:
  - `--sizes "A4,A3,A2,A1,A0,B2,B1,B0"` (default: all)
  - `--quantities "50,100,150,200,250,500,750,1000,1500,2000,2500,3000,4000,5000,6000,7000,8000,9000,10000"` (default)
  - `--limit-sizes 1 --limit-quantities 2` (fast test)
- Output:
  - `pricing_raw/wmd-neon-posters-<timestamp>.json`
  - `pricing_raw/wmd-neon-posters-<timestamp>.csv`

3. Apply conversion rule
- Defaults in script:
  - `EUR * 7.6`
  - base DKK `<= 3000`: `+70%`
  - base DKK `> 3000`: `+60%`
  - round to step `1`
- Override flags:
  - `--eur-to-dkk`, `--markup-low-pct`, `--markup-high-pct`, `--threshold-dkk`, `--rounding-step`

4. Import dry-run
- Command:
  - `node scripts/fetch-wmd-neon-posters.mjs import --dry-run`
- Check summary counts

5. Live import and publish
- Command:
  - `node scripts/fetch-wmd-neon-posters.mjs import --tenant-id <uuid> --publish`
- Creates one combined product with:
  - `products` (`pricing_type=matrix`, `pricing_structure` with format row and color vertical axis)
  - `generic_product_prices` (format × color × quantity price grid)
- Deletes any old per-size products (neon-plakater-a4, neon-plakater-a3, etc.)

## Product Structure

Creates a single combined product:

| Element | Value |
|---------|-------|
| Product name | `Neon Plakater` |
| Product slug | `neon-plakater` |
| Pricing type | `matrix` |
| Format row | `A4`, `A3`, `A2`, `A1`, `A0`, `B2`, `B1`, `B0` (buttons) |
| Color vertical axis | `Neon Gul`, `Neon Grøn`, `Neon Rød` |
| Quantities | `50, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000` |

**Note:** Each format×color combination has different prices (Red is ~10% more expensive than Yellow/Green), stored in `generic_product_prices`.

## Product Page URLs

| Size | Dimensions (mm) | Product page path |
|------|-----------------|-------------------|
| A4 | 210×297 | `/plakat-din-a4-210-x-297-cm-einseitig-schwarz-bedruckt-10.html` |
| A3 | 297×420 | `/plakat-din-a3-297-x-420-cm-einseitig-schwarz-bedruckt-10.html` |
| A2 | 420×594 | `/plakat-din-a2-420-x-594-cm-einseitig-schwarz-bedruckt-10.html` |
| A1 | 594×841 | `/plakat-din-a1-594-x-841-cm-einseitig-schwarz-bedruckt-10.html` |
| A0 | 841×1189 | `/plakat-din-a0-841-x-1189-cm-einseitig-schwarz-bedruckt-10.html` |
| B2 | 500×700 | `/plakat-b2-500-x-700-cm-einseitig-schwarz-bedruckt-10.html` |
| B1 | 700×1000 | `/plakat-b1-700-x-1000-cm-einseitig-schwarz-bedruckt-10.html` |
| B0 | 1000×1400 | `/plakat-b0-1000-x-1400-cm-einseitig-schwarz-bedruckt-10.html` |

## Defaults

- Quantities: `50, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000`
- Colors: `Neon Gul, Neon Grøn, Neon Rød` (each with own prices)
- Formats: `A4, A3, A2, A1, A0, B2, B1, B0`
- Conversion: `eur_to_dkk=7.6`, tiered markup (70%/60% at 3000 DKK threshold)

## Notes

- **Colors have different prices**: Red (Rot) is typically ~10% more expensive than Yellow/Green.
- **Single combined product**: All sizes are in one product with format buttons (not separate products per size).
- Uses `pricing_type: "matrix"` with `generic_product_prices` table (NOT storformat).
- The script uses WMD's `/wmdrest/article/get-price` endpoint.
- Import deletes old per-size products (neon-plakater-a4, etc.) if they exist.
- Only "Alle Plakate gleiches Motiv" (all same design) variants are imported.
- B1 and B0 sizes only have Neon Gul available at WMD (Green/Red not offered for these sizes).
