# Pricing System (Matrix Layout V1)

This document describes how the Matrix Layout V1 pricing system works end-to-end: layout setup, CSV export/import, publishing to the frontend, and the data model behind it.

## 1) Overview

Matrix Layout V1 is a structured price-matrix system that:
- defines a vertical axis (rows),
- defines layout rows/sections (columns),
- exports a CSV template for bulk pricing,
- imports filled prices back into the generator, and
- publishes prices to `generic_product_prices` for the storefront.

The frontend renders the same structure and reads prices from the database.

## 2) Core Concepts

### Vertical Axis (Rows)
The vertical axis is one attribute type used for the left-hand table rows.  
Common examples: materials (paper type) or formats.

### Layout Rows & Sections (Columns)
Layout rows are groups of sections that become the selectable options.  
Each section:
- has a type (formats/materials/finishes/products),
- can be displayed as buttons, dropdown, or checkboxes,
- can be **required** or **optional**,
- can have a custom title/description (frontend display),
- can include thumbnails per value.

### Selection Mode (Required vs Optional)
Selection mode is configured per section in the backend:
- **Required**: always selected.
- **Optional (Valgfri)**: on the frontend, a checkbox appears next to the section title.  
  When checked, the section is highlighted and auto-selects the first option.  
  When unchecked, the section is disabled and excluded from the variant key.

### Pricing Structure (Stored on Product)
The complete layout is stored on `products.pricing_structure`, which includes:
- `vertical_axis` (type, value IDs, title, description, valueSettings)
- `layout_rows` (rows and sections)
- `quantities` (columns)
- `selection_mode`, `ui_mode`, `valueSettings`, `title`, `description`

## 3) Data Model

### Tables
- `product_attribute_groups`
- `product_attribute_values`
- `products.pricing_structure`
- `generic_product_prices`

### generic_product_prices
Each price row is stored as:
- `product_id`
- `variant_value` (vertical axis value ID)
- `variant_name` (sorted value ID key)
- `quantity`
- `price_dkk`
- `extra_data.selectionMap` (format/material + variantValueIds)

## 4) Backend Workflow

### A) Configure Layout
In the admin price generator:
1) Set the **vertical axis**.
2) Add **layout rows** and **sections**.
3) Set section titles/descriptions (frontend text).
4) Set **selection mode** (required/optional).
5) Optionally upload thumbnails per value.

### B) Export CSV
From "Prisliste Handlinger & CSV":
1) **Eksporter Skabelon (CSV)**  
2) Fill in prices in the quantity columns.

CSV rules:
- Line 1: `#meta;{...}` (required for strict layout mapping)
- Line 2: human headers (vertical axis + section titles + quantities)
- Delimiter: semicolon (`;`)
- Optional sections include blank values for the "none" option

### C) Import CSV
1) **Importer Udfyldt CSV**  
2) The system parses the file and:
   - reads `#meta` for strict column mapping,
   - auto-creates missing attribute values,
   - updates the layout and quantities,
   - fills the generator price map.

### D) Apply + Publish
1) **Brug priser i systemet** (apply imported prices to the generator)  
2) **Gem Prisliste (Matrix V1)** (publishes to `generic_product_prices`)

The frontend reads prices only after the publish step.

## 5) Frontend Behavior

### Rendering
The frontend uses `MatrixLayoutV1Renderer` to:
- render layout sections based on `pricing_structure`,
- render the matrix (rows = vertical axis, columns = quantities),
- look up prices in `generic_product_prices`.

### Optional Sections
If a section is optional:
- a checkbox appears next to the title,
- checking it highlights the section and auto-selects the first option,
- unchecking disables and clears the section.

### Thumbnails
Thumbnails uploaded in the backend are stored in `valueSettings` and displayed on the frontend after pushing Matrix V1.

## 6) Troubleshooting

### Prices do not appear on the frontend
1) Confirm you clicked **Gem Prisliste (Matrix V1)**.  
2) Confirm you are on the same product slug you published.  
3) If you changed the layout, **re-export** and re-import the CSV.  
4) Optional sections require base rows (blank option) in the CSV.

### CSV imports but nothing publishes
Check the publish toast and console:
- `generatorPrices entries: X`
- `Valid inserts: X`

### Large price sets
The frontend fetches all rows with pagination. If totals grow large, consider filtering or reducing combinations.

## 7) Fallback & Recovery

### Auto Backup (Price List Bank)
Every time you publish with **Gem Prisliste (Matrix V1)** the system creates an **AUTO BACKUP** entry in the Price List Bank.  
This snapshot includes:
- `pricing_structure`
- generator state (prices, markups, rounding, oplag)
- a saved price count

You can restore any backup from **Prisliste Bank** if something breaks.

### Manual Fallback
For extra safety:
1) Export the CSV before major changes.
2) Save a named snapshot in **Prisliste Bank**.

## 7) Notes

### Titles & Descriptions
Section titles/descriptions are display-only on the frontend; they do not affect matching or keys.

### Variant Keys
Variant keys are sorted value IDs (joined with `|`). Matching also uses `extra_data.selectionMap` so order does not matter.
