# Agent Price Fetch Handoff Spec

This spec is only for external price fetching.

It is **not** for creating products in WebPrinter.

It is **not** for writing code into the repo.

It is **not** for writing data into the database.

## Purpose

Allow an external agent to:

- scrape supplier price data
- collect options, materials, formats, quantities, and source evidence
- return a strict artifact package

Then allow this system to:

- validate the fetched data
- normalize it
- convert it into the right WebPrinter import flow
- integrate it into the real system

## Ownership Split

### External agent does

- browsing
- scraping
- evidence capture
- structured output

### Codex / WebPrinter integration does

- validation
- naming cleanup
- WebPrinter product mapping
- import into the actual system

## Required Output Package

```text
price-fetch/
├─ fetch-result.json
├─ prices.csv
├─ sources.json
└─ notes.md
```

`notes.md` is optional.

## File Purposes

### 1. `fetch-result.json`

Canonical structured scrape result.

Must include:

- supplier
- source URLs
- formats
- materials
- option groups
- quantity list
- currency
- scrape notes

### 2. `prices.csv`

Canonical raw price rows.

One line per actual scraped price point.

### 3. `sources.json`

Evidence log.

Must capture:

- source pages
- what each page was used for
- scrape timestamp
- warnings / missing values

### 4. `notes.md`

Optional human note file.

Use only for:

- supplier quirks
- hidden options
- difficult pages
- scrape uncertainties

## Strict Rules

The external agent must:

- preserve source URLs
- preserve original supplier values unless explicitly told to translate them
- keep one row per actual price point
- not invent missing prices
- not invent missing options
- record uncertainty explicitly

The external agent must not:

- create products in WebPrinter
- assume tenant ids
- write import scripts
- write directly into `pricing_raw/` or `pricing_clean/`
- write directly to Supabase

## `fetch-result.json` Example

```json
{
  "schema_version": 1,
  "supplier": "wir-machen-druck",
  "product_label": "Standard Rollup",
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
      "values": ["85 x 200 cm", "100 x 200 cm"]
    },
    {
      "name": "Materiale",
      "values": ["510 g/m2 Frontlit PVC", "135 g/m2 PP-film matt"]
    }
  ],
  "quantities": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "currency": "EUR",
  "notes": [
    "Prices came from two format-specific pages"
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

## Integration Rule

When this package comes back into this chat, the next step is:

- validate the fetch package
- decide whether it is complete enough
- convert it into the correct WebPrinter import path

That conversion is done here, not by the external agent.

## Related Internal Files

- `docs/PRODUCT_BLUEPRINT_SPEC.md`
- `scripts/product-blueprint-cli.js`
- `pricing_raw/`
- `pricing_clean/`
