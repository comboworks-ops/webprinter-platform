# Fetch Log: Silketryk T-Shirt

Date: 2026-02-26  
Source URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-weiss-fruit-of-the-loom-mit-einer-druckposition.html`

## Imported Product

- Name: `silketryk t-shirt`
- Slug: `silketryk-t-shirt`
- Category: `tekstiltryk`
- Pricing type: `matrix_layout_v1`

## Matrix Setup

- Vertical material:
  - `T-Shirt Herren Budget, weiß - Fruit of the Loom`
- Silketryk buttons:
  - `Siebdruck - 1/0-farbig`
  - `Siebdruck - 2/0-farbig`
  - `Siebdruck - 3/0-farbig`
  - `Siebdruck - 4/0-farbig`
- Print position selector:
  - `Vorne bedruckt`
  - `Hinten bedruckt`
  - `Brust links bedruckt aus Sicht der Trägerin/des Trägers`
  - `Brust rechts bedruckt aus Sicht der Trägerin/des Trägers`
- Quantities:
  - `25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 100, 125, 150, 200, 250, 300, 400, 500, 700, 1000`

## Price Transform

- Supplier value used: `EUR per shirt`
- Converted to total EUR before markup:
  - `total_eur = unit_eur * quantity`
- Conversion and tiers:
  - `dkk_base = total_eur * 7.6`
  - tiers:
    - `<= 2000`: `x1.6`
    - `<= 5000`: `x1.5`
    - `<= 10000`: `x1.4`
    - `> 10000`: `x1.3`

## Non-pricing Size Distribution

Configured in `products.technical_specs.size_distribution`:

- `Small`
- `Medium`
- `Large`
- `XL`
- `2XL`
- `3XL`
- `4XL`
- `5XL`

This is non-pricing metadata and does not alter matrix price logic.

Lock reference:
- `scripts/product-import/tshirt-size-distribution-lock.js`
- `docs/TSHIRT_FETCH_LOCK.md`

## Run Artifacts

- Dry-run snapshot:
  - `pricing_raw/silketryk-t-shirt/20260226-103203.json`
  - `pricing_clean/silketryk-t-shirt/20260226-103203.csv`
- Live-run snapshot:
  - `pricing_raw/silketryk-t-shirt/20260226-112139.json`
  - `pricing_clean/silketryk-t-shirt/20260226-112139.csv`

## Result

- Product ID: `10f9d82e-d2b7-476b-931e-c624a7af3d8a`
- Inserted price rows: `336` (`4 print modes x 4 positions x 21 quantities`)

---

# Fetch Log: Silketryk T-Shirt 2 (Front + Front/Back)

Date: 2026-02-27  
Front-only URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-weiss-fruit-of-the-loom-mit-einer-druckposition.html`  
Front+back URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-weiss-fruit-of-the-loom-mit-zwei-druckpositionen.html`

## Imported Product

- Name: `Silk T-shirt 2`
- Slug: `silk-t-shirt-2`
- Category: `tekstiltryk`
- Pricing type: `matrix`

## Matrix Setup

- Vertical material:
  - `T-Shirt Herren Budget, weiß - Fruit of the Loom`
- Print scope buttons:
  - `Print on front of T-shirt`
  - `Print on back and front of T-shirt`
- Silketryk buttons:
  - `Siebdruck - 1/0-farbig`
  - `Siebdruck - 2/0-farbig`
  - `Siebdruck - 3/0-farbig`
  - `Siebdruck - 4/0-farbig`
- Front position selector:
  - `Vorne bedruckt`
  - `Hinten bedruckt`
  - `Brust links bedruckt aus Sicht der Trägerin/des Trägers`
  - `Brust rechts bedruckt aus Sicht der Trägerin/des Trägers`
- Back position selector:
  - `Hinten bedruckt`
  - `Brust links bedruckt aus Sicht der Trägerin/des Trägers`
  - `Brust rechts bedruckt aus Sicht der Trägerin/des Trägers`
  - `Ingen bagtryk` (front-only scope placeholder)
- Quantities:
  - `25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 100, 125, 150, 200, 250, 300, 400, 500, 700, 1000`

## Price Transform

- Supplier value used: `EUR per shirt`
- Converted to total EUR before markup:
  - `total_eur = unit_eur * quantity`
- Conversion and tiers:
  - `dkk_base = total_eur * 7.6`
  - tiers:
    - `<= 2000`: `x1.6`
    - `<= 5000`: `x1.5`
    - `<= 10000`: `x1.4`
    - `> 10000`: `x1.3`

## Run Artifacts

- Dry-run snapshot:
  - `pricing_raw/silk-t-shirt-2/20260227-095546.json`
  - `pricing_clean/silk-t-shirt-2/20260227-095546.csv`
- Live-run snapshot:
  - `pricing_raw/silk-t-shirt-2/20260227-100903.json`
  - `pricing_clean/silk-t-shirt-2/20260227-100903.csv`

## Result

- Product ID: `4f0c2554-2679-490a-823f-46bc4cedc079`
- Inserted price rows: `1344` (`2 print scopes x 4 print modes x 4 front positions x 4 back positions x 21 quantities`)

---

# Fetch Log: Color T-shirts (Farbig + Color Selector)

Date: 2026-02-27  
Source URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-einer-druckposition.html`

## Imported Product

- Name: `Color T-shirts`
- Slug: `color-t-shirts`
- Category: `tekstiltryk`
- Pricing type: `matrix`

## Matrix Setup

- Vertical material:
  - `T-Shirt Herren Budget, farbig - Fruit of the Loom`
- Silketryk buttons:
  - `Siebdruck - 1/0-farbig`
  - `Siebdruck - 2/0-farbig`
  - `Siebdruck - 3/0-farbig`
  - `Siebdruck - 4/0-farbig`
- Print position selector:
  - `Vorne bedruckt`
  - `Hinten bedruckt`
  - `Brust links bedruckt aus Sicht der Trägerin/des Trägers`
  - `Brust rechts bedruckt aus Sicht der Trägerin/des Trägers`
- T-shirt color selector (non-pricing):
  - `11` options scraped from supplier dropdown (`zusatzfeld[...]`)
- Quantities:
  - `25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 100, 125, 150, 200, 250, 300, 400, 500, 700, 1000`

## Price Transform

- Supplier value used: `EUR per shirt`
- Converted to total EUR before markup:
  - `total_eur = unit_eur * quantity`
- Conversion and tiers:
  - `dkk_base = total_eur * 7.6`
  - tiers:
    - `<= 2000`: `x1.6`
    - `<= 5000`: `x1.5`
    - `<= 10000`: `x1.4`
    - `> 10000`: `x1.3`

## Run Artifacts

- Dry-run snapshot:
  - `pricing_raw/color-t-shirts/20260227-105751.json`
  - `pricing_clean/color-t-shirts/20260227-105751.csv`
- Live-run snapshot:
  - `pricing_raw/color-t-shirts/20260227-110050.json`
  - `pricing_clean/color-t-shirts/20260227-110050.csv`

## Result

- Product ID: `b2dca751-3b82-48ea-ab56-e2324329e38e`
- Inserted price rows: `3696` (`11 colors x 4 print modes x 4 positions x 21 quantities`)

---

# Fetch Log: Color T-shirt 4+4 (Combined Position 1 + 4+4)

Date: 2026-02-27  
Front-only URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-einer-druckposition.html`  
Front+back URL: `https://www.wir-machen-druck.de/tshirt-herren-budget-farbig-fruit-of-the-loom-mit-zwei-druckpositionen.html`

## Imported Product

- Name: `Color T-shirt 4+4`
- Slug: `color-t-shirt-4-plus-4`
- Category: `tekstiltryk`
- Pricing type: `matrix`

## Matrix Setup

- Vertical material:
  - `T-Shirt Herren Budget, farbig - Fruit of the Loom`
- Print scope buttons:
  - `Print position 1`
  - `4+4`
- Silketryk buttons:
  - `Siebdruck - 1/0-farbig`
  - `Siebdruck - 2/0-farbig`
  - `Siebdruck - 3/0-farbig`
  - `Siebdruck - 4/0-farbig`
- T-shirt color selector:
  - `11` options scraped from supplier dropdown (`zusatzfeld[...]`)
- Print position selectors:
  - `Print position 1` (4 options)
  - `Print position 2` (3 supplier options + `Ingen print position 2` placeholder for `Print position 1` scope)
- Quantities:
  - `25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 100, 125, 150, 200, 250, 300, 400, 500, 700, 1000`

## Price Transform

- Supplier value used: `EUR per shirt`
- Converted to total EUR before markup:
  - `total_eur = unit_eur * quantity`
- Conversion and tiers:
  - `dkk_base = total_eur * 7.6`
  - tiers:
    - `<= 2000`: `x1.6`
    - `<= 5000`: `x1.5`
    - `<= 10000`: `x1.4`
    - `> 10000`: `x1.3`

## Run Artifacts

- Dry-run snapshot:
  - `pricing_raw/color-t-shirt-4-plus-4/20260227-111749.json`
  - `pricing_clean/color-t-shirt-4-plus-4/20260227-111749.csv`
- Live-run snapshot:
  - `pricing_raw/color-t-shirt-4-plus-4/20260227-112704.json`
  - `pricing_clean/color-t-shirt-4-plus-4/20260227-112704.csv`

## Result

- Product ID: `0c40adc1-d572-4939-93de-a33a0288e7fd`
- Inserted price rows: `14784` (`11 colors x (Print position 1 + 4+4 combinations) x 21 quantities`)
