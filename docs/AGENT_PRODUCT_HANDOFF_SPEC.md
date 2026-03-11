# Agent Product Handoff Spec

This document defines the preferred handoff format when an external agent or browser-based scraping system collects supplier product data for later import into WebPrinter.

## Goal

Allow another agent to:

- research a supplier product
- scrape prices, options, materials, and source evidence
- package the result into a strict file set

Then allow this system to:

- validate the package
- normalize it
- import it safely into WebPrinter

## Core Principle

External agents should do:

- research
- scraping
- extraction
- normalization into a strict package

This system should do:

- validation
- correction
- import
- WebPrinter-specific integration

Do not let external agents write directly into the repo or database.

## Preferred Package Format

Create one folder per imported product:

```text
handoff/
├─ product.json
├─ prices.csv
├─ sources.json
└─ description.md
```

## Files

### 1. `product.json`

Canonical metadata file.

Must contain:

- product name
- slug
- supplier
- source URLs
- formats
- materials
- option groups
- quantities
- intended row/column model
- category
- notes or exceptions

### 2. `prices.csv`

Canonical matrix price rows.

One row per actual price point.

Must never contain invented prices.

### 3. `sources.json`

Evidence log for the scrape.

Must contain:

- source URLs
- captured timestamp
- which page was used for which data
- notes about missing or uncertain values

### 4. `description.md`

Optional but recommended.

Used when an agent also extracts and drafts:

- product description
- translated text
- feature bullets

## Relation To Existing WebPrinter Import System

This repo already has two important patterns:

1. Product blueprint import:
   - `docs/PRODUCT_BLUEPRINT_SPEC.md`
   - `scripts/product-blueprint-cli.js`

2. Raw/clean fetch snapshots:
   - `pricing_raw/<slug>/<timestamp>.json`
   - `pricing_clean/<slug>/<timestamp>.csv`

The handoff package should be treated as the upstream input that can later be converted into:

- a product blueprint
- a `pricing_raw` JSON snapshot
- a `pricing_clean` CSV
- or a product-specific import script input

## Recommended Workflow

### External Agent

The external agent should:

1. scrape product pages
2. collect formats/materials/options
3. collect quantities and prices
4. preserve source URLs
5. output the package files

### WebPrinter Integration

In this chat/workflow:

1. you upload or paste the files
2. I validate structure and completeness
3. I normalize naming if needed
4. I convert it into the correct WebPrinter import shape
5. I import it safely

## Strict Rules For External Agents

External agents must:

- preserve original source URLs
- not invent prices
- not invent quantities
- keep one row per actual price point
- mark uncertainty explicitly
- not translate material names unless asked
- not collapse different option combinations into one row

External agents must not:

- write directly to Supabase
- write directly to repo pricing files
- guess missing variants
- omit source attribution

## `product.json` Example

```json
{
  "schema_version": 1,
  "product_name": "Standard Rollup",
  "slug": "standard-rollup",
  "supplier": "wir-machen-druck",
  "category": "storformat",
  "source_urls": [
    "https://example.com/rollup-85",
    "https://example.com/rollup-100"
  ],
  "formats": [
    "85 x 200 cm",
    "100 x 200 cm"
  ],
  "materials": [
    "510 g/m2 Frontlit PVC",
    "135 g/m2 PP-film matt"
  ],
  "option_groups": [
    {
      "name": "Format",
      "axis": "row",
      "values": ["85 x 200 cm", "100 x 200 cm"]
    },
    {
      "name": "Materiale",
      "axis": "column",
      "values": ["510 g/m2 Frontlit PVC", "135 g/m2 PP-film matt"]
    }
  ],
  "quantities": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "description_draft": "Kort dansk beskrivelse.",
  "notes": [
    "Kun første to materialer bruges",
    "Priser hentet fra to format-URLs"
  ]
}
```

## `prices.csv` Example

```csv
format,material,option_1_name,option_1_value,option_2_name,option_2_value,quantity,price,currency,source_url
85 x 200 cm,510 g/m2 Frontlit PVC,,,,,1,199.00,EUR,https://example.com/rollup-85
85 x 200 cm,510 g/m2 Frontlit PVC,,,,,2,299.00,EUR,https://example.com/rollup-85
100 x 200 cm,135 g/m2 PP-film matt,,,,,1,249.00,EUR,https://example.com/rollup-100
```

## `sources.json` Example

```json
{
  "schema_version": 1,
  "supplier": "wir-machen-druck",
  "captured_at": "2026-03-09T12:00:00Z",
  "evidence": [
    {
      "url": "https://example.com/rollup-85",
      "used_for": ["format", "prices", "materials"]
    },
    {
      "url": "https://example.com/rollup-100",
      "used_for": ["format", "prices"]
    }
  ],
  "warnings": []
}
```

## Best Practice Prompt For External Agents

Tell the external agent:

1. scrape the supplier product
2. output the result only as:
   - `product.json`
   - `prices.csv`
   - `sources.json`
   - optional `description.md`
3. preserve source URLs in every price/evidence row
4. do not invent missing values
5. do not return prose instead of files

## Next Planned Step

Later, this can be extended with:

- a validator script
- a converter from handoff package -> WebPrinter blueprint
- a loader that accepts uploaded JSON/CSV and turns it into a real import

## Related Files

- `docs/PRODUCT_BLUEPRINT_SPEC.md`
- `scripts/product-blueprint-cli.js`
- `scripts/product-import/`
- `pricing_raw/`
- `pricing_clean/`
