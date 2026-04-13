# Storformat Visibility Log

Last updated: 2026-03-16

## Incident: `aluminium` lost material/white options and price on storefront

Affected product:
- `products.slug = aluminium`
- product id: `6c546267-6585-4465-a4fe-857e3d343612`

Symptom:
- storefront showed only the size inputs
- no material choices
- no `Selektiv hvid print`
- no prices

What actually happened:
- the product and storformat pricing data still existed
- the storefront uses the `anon` Supabase role
- `anon` could read:
  - `storformat_configs`
  - tier tables
  - `storformat_m2_prices`
  - `storformat_finish_prices`
- but `anon` could not read:
  - `storformat_materials`
  - `storformat_finishes`
  - `storformat_products`

Root cause:
1. The `aluminium` item rows had `visibility = 'tenant'` instead of `public`
2. The `printmaker-dev` Supabase project was missing the public-read policies for:
   - `storformat_materials`
   - `storformat_finishes`
   - `storformat_products`

Why the page broke:
- without readable materials/finishes/products, `StorformatConfigurator` had no selectable values
- no valid selection meant no calculated price

Fix applied:
1. Updated existing `aluminium` rows to `visibility = 'public'`
2. Applied missing public-read RLS policies for:
   - `storformat_materials`
   - `storformat_finishes`
   - `storformat_products`
3. Applied public-read RLS policies for supporting storefront storformat tables:
   - `storformat_configs`
   - `storformat_material_price_tiers`
   - `storformat_finish_price_tiers`
   - `storformat_product_price_tiers`
   - `storformat_product_fixed_prices`
4. Patched importer:
   - `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
   - master-tenant rigids imports now create storformat materials/finishes/products with `visibility = 'public'`

Verification:
- as `anon`, `aluminium` now returns:
  - materials: `2`
  - finishes: `2`
  - products: `5`
  - configs: `1`
  - tiers/prices: readable

Follow-up risk:
- other historic Pixart rigids products may have been imported before the visibility fix
- if a similar product disappears from storefront, check:
  - row visibility
  - missing public-read RLS policies

Rollback note:
- drop the public-read policies added in:
  - `supabase/migrations/20260316090000_storformat_storefront_public_support.sql`
  - `supabase/migrations/20260316093000_storformat_public_items.sql`
- revert row visibility changes from `public` back to prior values only if storefront public access should be removed intentionally
