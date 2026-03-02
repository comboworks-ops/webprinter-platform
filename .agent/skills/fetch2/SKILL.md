---
name: fetch2
description: Extract and import configurable free-size pricing from WIRmachenDRUCK label products using supplier JSON pricing endpoints, with additive storformat product creation.
---

# Fetch2 Skill

Use this skill for WIRmachenDRUCK products that require:
- free size input (`width`/`height` up to supplier limits)
- quantity ladder extraction
- material dropdown extraction
- delivery price variants (standard/express columns)
- deterministic price transforms (FX + tiered markup)

Current script:
- `scripts/fetch2-wmd-roll-labels.mjs`

Current profile covered:
- `Hochwertige Etiketten auf Rolle, freie Größe rechteckig`
- URL: `https://www.wir-machen-druck.de/hochwertige-etiketten-auf-rolle-freie-groesse-rechteckig.html#content-view`

## Guardrails

- Keep changes additive.
- Do not change existing pricing engines or renderer logic.
- Do not alter existing Fetch/Pixart scripts unless explicitly requested.
- Use dry extraction and review output before any import/publish step.

## Workflow

1. Probe the product contract
- Command:
  - `node scripts/fetch2-wmd-roll-labels.mjs probe --url "<supplier-url>"`
- Confirm:
  - `articleId`, `categoryId`, material list, delivery options, max-size hints

2. Extract quote matrix (rectangle/circle + quantity + size + delivery variants)
- Command:
  - `node scripts/fetch2-wmd-roll-labels.mjs extract --url "<supplier-url>"`
- Optional controls:
  - `--materials "<csv ids or label fragments>"`
  - `--quantities "10,100,200,250,500,1000,2000,3000,4000,5000,7000,10000,15000,20000,30000"`
  - `--sizes "1x1,2x2,3x3,4x4,5x5,7x7,10x10,12x12,15x15,20x20"`
  - `--shapes rectangle,circle`
  - `--limit-materials 3 --limit-quantities 5 --limit-sizes 3` (fast test)

3. Apply conversion rule
- Defaults in script:
  - `EUR * 7.6`
  - base DKK `<= 3000`: `+70%`
  - base DKK `> 3000`: `+60%`
  - round to step `1`
- Override flags:
  - `--eur-to-dkk`, `--markup-low-pct`, `--markup-high-pct`, `--threshold-dkk`, `--rounding-step`

4. Use generated artifacts
- Output files:
  - `pricing_raw/wmd-roll-labels-free-size-<timestamp>.json`
  - `pricing_raw/wmd-roll-labels-free-size-<timestamp>.csv`
  - `pricing_raw/wmd-roll-labels-free-size-<timestamp>.summary.csv`
- The summary file includes cheapest and fastest delivery values per `(material,size,quantity)`.

5. Import to backend (new product only, additive)
- Dry run first:
  - `node scripts/fetch2-wmd-roll-labels.mjs import --dry-run --input "<json>"`
- Then import:
  - `node scripts/fetch2-wmd-roll-labels.mjs import --input "<json>" --tenant-id "<uuid>" --product-name "<name>" --product-slug "<slug>" --publish`
- Optional controls:
  - `--delivery-mode cheapest|fastest|both` (default `both`)
  - `--quantities "<csv>"` to override config quantities
  - `--category "<name>" --description "<text>"`
  - omit `--input` to use latest `pricing_raw/wmd-roll-labels-free-size-*.json`

## Notes

- Circle rows are derived from rectangle quotes (same price, with `radius_cm` attached).
- Extraction conversion uses supplier net price (`response.price`) as base.
- Import only upserts one target product by slug and rewrites storformat rows for that product id; existing products are untouched.
- The script calls `/wmdrest/article/get-price` with live session token and current option defaults from the page.
