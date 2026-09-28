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

## 2026-09-08 — published Selvklæbende Print visibility restored

The homepage repair reproduced an empty public calculator for
`pixart-flat-surface-adhesive` (`ede9872f-a8f8-4475-94bc-d7cb257d224e`).
Read-only inspection found 7 existing materials, 4 finishes and 2 delivery
choices marked `tenant`; the existing public-read policies require `public`.
The 56 material price tiers already existed.

After the user explicitly approved “Apply this visibility repair”, a guarded
transaction changed only those 13 exact rows to `public` in project
`ziattmsmiirfweiuunfo`. No pricing values, pricing calculations, tenant IDs,
policies, product publish flags, or unpublished drafts changed. Post-query
counts are 7/7, 4/4 and 2/2 public. The unauthenticated local browser now shows
the material matrix and calculates 179 kr for the default one-item selection,
and 357 kr for two items (100 × 100 cm, before delivery).

Exact apply and guarded rollback scripts:
`output/design-exploration/homepage-repair-2026-09-08/adhesive-visibility-apply.sql`
and `adhesive-visibility-rollback.sql` in the same directory. Rollback has not
been executed. See `docs/HOMEPAGE_REPAIR_QA_2026-09-08.md` for the local UI checks
and the distinction between route verification and complete order validation.
