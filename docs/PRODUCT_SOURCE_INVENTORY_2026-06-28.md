# Product Source Inventory - 2026-06-28

Purpose: protect the different product ownership paths while we make one
complete product/order flow production-ready.

This report is read-only. It does not change product, pricing, POD, or tenant
data.

## Why This Matters

Products in this project do not all come from the same system. Treating them as
one generic product type would risk breaking working imports, supplier links,
or pricing paths.

Current source families:

- Manual/admin Matrix V1 products
- Pixart / Firecrawl-style fetched wide-format products
- WMD fetched products
- POD v2 / Print.com-connected products
- Legacy/manual storformat products
- Static/category-style products

## Repeatable Check

Use the read-only audit script:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/audit-product-source-inventory.cjs
```

Useful variants:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/audit-product-source-inventory.cjs --json
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/audit-product-source-inventory.cjs --tenant-id <tenant-uuid>
```

The script only reads:

- `products`
- `generic_product_prices`
- storformat pricing tables

## Inventory Snapshot

Scanned products: `170`

By source flag:

| Source flag | Count | Meaning |
|---|---:|---|
| `manual-matrix-v1` | 146 | Normal Matrix Layout V1 products using `generic_product_prices` |
| `manual-or-legacy-storformat` | 8 | Storformat products using storformat-specific pricing tables |
| `manual-or-static` | 5 | Static/category or legacy products without Matrix V1 pricing rows |
| `pixart-fetch` | 6 | Pixart/fetched products, mainly wide-format/storformat |
| `pod-v2` | 3 | Print.com / POD v2-linked products |
| `wmd-fetch` | 2 | WIRmachenDRUCK fetched products |

By expected pricing store:

| Pricing store | Count | Notes |
|---|---:|---|
| `generic_product_prices` | 150 | Matrix Layout V1 storefront pricing |
| `storformat_tables` | 15 | Storformat calculators and fetched wide-format products |
| `product_specific_or_static` | 5 | Static/category/product-specific paths |

Potential published pricing-store issues found: `0`

## Aluminium Golden Product

`/produkt/aluminium`

Detected product:

- Product id: `6c546267-6585-4465-a4fe-857e3d343612`
- Name: `Aluminium Skilte`
- Published: yes
- `pricing_type`: `STORFORMAT`
- `technical_specs.source`: `pixart`
- `technical_specs.import_type`: `wide-format-rigids`
- `technical_specs.import_script`: `fetch-pixart-flat-surface-adhesive-import.mjs`
- Expected pricing store: `storformat_tables`

Storformat pricing table snapshot:

- `storformat_product_price_tiers`: 40 rows
- `storformat_m2_prices`: 16 rows
- `storformat_finish_prices`: 2 rows
- `generic_product_prices`: 0 rows, expected for this product

Important: do not try to "fix" aluminium by forcing it into
`generic_product_prices`. It is a Pixart/fetched STORFORMAT product and should
stay on that path unless we intentionally re-import or migrate it with approval.

## Product Source Guardrails

### Manual Matrix V1

Owned by:

- `products.pricing_structure`
- `generic_product_prices`
- Matrix Layout V1 admin workflow

Safe work:

- Edit/publish through the existing Matrix V1 admin flow.
- Export CSV backups before large price changes.
- Verify frontend price rows after publish.

Do not:

- Change core pricing calculations.
- Replace Matrix V1 data with storformat tables.

### Pixart / Fetched Wide Format

Owned by:

- `technical_specs.source = pixart`
- `technical_specs.import_script`
- `pricing_type = STORFORMAT`
- storformat pricing tables

Safe work:

- Validate product page, option buttons, dimensions, material rows, and checkout.
- Re-run the documented import script only when intentionally refreshing source
  data.

Do not:

- Delete or recreate product pricing tables manually.
- Convert to Matrix V1 just because `generic_product_prices` is empty.

### POD v2 / Print.com

Owned by:

- POD v2 catalog/import tables
- `technical_specs.is_pod_v2`
- `technical_specs.pod2_catalog_id`
- Matrix V1 output created by the POD v2 import flow

Safe work:

- Use the POD v2 import/merge/remove flows.
- Keep supplier submission/status work behind POD v2 functions.

Do not:

- Merge POD v2 into POD v1.
- Manually rewrite imported product matrices without preserving catalog linkage.

### WMD / Other Fetch Imports

Owned by:

- `technical_specs.source`
- `technical_specs.import_type`
- the matching fetch/import script

Safe work:

- Validate frontend rendering and checkout.
- Use the source script for re-imports.

Do not:

- Create parallel import paths for the same source family.

## Golden Path QA Status

Verified locally on `http://127.0.0.1:8082/produkt/aluminium`:

- Product page loads.
- Aluminium prices render from the storformat path.
- `Design online` opens the designer.
- Designer opens in the in-app browser after reducing the phone cutoff to 700px.
- Returning from designer marks the matching product selection as `Design klar`.
- Changing a price-driving quantity resets `Design klar` back to `Design online`.
- `Bestil nu` opens checkout/upload with the current aluminium quote.
- Checkout technical specs now carry storformat dimensions correctly:
  - net format: `1000 x 1000 mm`
  - gross format with bleed: `1006 x 1006 mm`
  - minimum resolution: `300 DPI`

## Next Practical Steps

1. Keep aluminium as the first golden-path product.
2. Upload or use designer output and verify proofing state.
3. Create Stripe PaymentIntent only after confirming the quote is current.
4. Repeat the same source-aware QA for:
   - one normal Matrix V1 product
   - one POD v2 / Print.com product
   - one WMD/fetched product
   - one legacy/manual storformat product

Rollback note: the inventory script and this document are additive. Remove
`scripts/audit-product-source-inventory.cjs` and this report if not wanted.
