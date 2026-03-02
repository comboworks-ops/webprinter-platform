# PRODUCT_BLUEPRINT_SPEC

Version: `1`
Purpose: Define a strict YAML blueprint format for safe product creation + UL-based pricing imports into existing Webprinter tables/UI.

## Design Constraints
- Additive only. No refactor of pricing engine, interpolation, rendering, or admin product architecture.
- Imported products/prices must stay editable in current admin UI.
- Tenant scoping is mandatory (`tenant_id` everywhere on writes).
- New products are created as draft (`is_published: false`).

## YAML Schema (Strict)

```yaml
version: 1
tenant_id: "<uuid>"

product:
  name: "<string>"
  slug: "<kebab-case>"
  description: "<string>"
  category: "tryksager" | "storformat"
  preset_key: "custom"                # optional, default: custom
  icon_text: "<string>"               # optional, default: product.name
  image_url: "https://..."            # optional
  technical_specs:                      # optional
    width_mm: 210
    height_mm: 297
    bleed_mm: 3
    min_dpi: 300
    is_free_form: false
    standard_format: "A4"

matrix:
  vertical_axis: "materials" | "formats"   # optional, default: materials
  format:
    group_name: "Format"                     # optional, default: Format
    value_name: "Standard"                   # required
    width_mm: 210                             # optional
    height_mm: 297                            # optional
    image_url: "https://..."                # optional
  material:
    group_name: "Materiale"                  # optional, default: Materiale
    value_name: "Standard"                   # required
    image_url: "https://..."                # optional

pricing_import:
  type: "ul_prices"
  url: "https://..."
  ul_selector: "ul.price-list"               # CSS selector for target UL
  eur_to_dkk: 7.5                             # optional, default: 7.5
  rounding_step: 1                            # optional, default: 1
  default_quantity_start: 1                   # optional, default: 1
  default_quantity_step: 1                    # optional, default: 1
  tiers:                                      # optional, default shown below
    - max_dkk_base: 3000
      multiplier: 1.5
    - max_dkk_base: 10000
      multiplier: 1.4
    - multiplier: 1.3
```

## Strict Validation Rules
- Unknown keys are rejected.
- `tenant_id` must be a UUID.
- `version` must be `1`.
- `product.slug` must be kebab-case (`[a-z0-9-]`).
- `pricing_import.type` must be `ul_prices`.
- `tiers` must be ordered by `max_dkk_base` ascending when provided.
- A terminal tier without `max_dkk_base` is allowed and recommended.

## Mapping to Existing Product/Pricing Model

### Product
- Table: `products`
- Writes:
  - create if `(tenant_id, slug)` does not exist
  - `pricing_type = matrix`
  - `is_published = false` on create
  - `pricing_structure` updated to `matrix_layout_v1` on import

### Attribute model
- Tables: `product_attribute_groups`, `product_attribute_values`
- Ensures a `format` and `material` group/value for the product.
- Optional format dimensions are stored on format value (`width_mm`, `height_mm`) to remain admin/designer compatible.

### Prices
- Table: `generic_product_prices`
- Rows are replaced for the product during non-dry import (delete old, insert new).
- Conflict shape remains compatible with existing system:
  - `product_id`, `variant_name`, `variant_value`, `quantity`, `price_dkk`, `extra_data`.

### Matrix structure
- `products.pricing_structure` written as `matrix_layout_v1` with:
  - vertical axis on materials
  - required format selector
  - quantities from imported rows.

## `ul_prices` Extraction + Transform

### Extraction order
1. Firecrawl scrape (primary)
2. Playwright browser fallback (if Firecrawl fails / empty selector result / dynamic page)
3. Static HTML fallback for public non-interactive pages (only if both above fail)

### UL parsing
- Collect text from all `<li>` under `ul_selector`.
- Parse EUR number per LI robustly (`€12.5`, `12,50 EUR`, `1.234,56 €`, etc.).
- Quantity parsing:
  - use LI quantity hints when present (`100 stk`, `qty: 250`, etc.)
  - fallback to sequence using `default_quantity_start` + `default_quantity_step`.

### Price transform
For each parsed row:
- `dkk_base = eur * eur_to_dkk`
- tier by `dkk_base`
- `dkk_final = round_to_step(dkk_base * tier_multiplier, rounding_step)`

Default tiers:
- `<= 3000 => 1.5`
- `<= 10000 => 1.4`
- `> 10000 => 1.3`

## Snapshot Outputs
- Raw extractor snapshot:
  - `pricing_raw/<slug>/<timestamp>.json`
- Cleaned transform snapshot:
  - `pricing_clean/<slug>/<timestamp>.csv`

These snapshots are created in both normal and dry-run imports.

## CLI Contract
- `pnpm product:validate <blueprint.yml>`
- `pnpm product:import <blueprint.yml> [--dry-run]`

Dry-run guarantees:
- no database writes
- extractor + transform + snapshot generation still run
- prints intended DB actions.
