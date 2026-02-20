# PROJECT_BRIEF

Status: Analysis-only snapshot for safe automation planning.
Scope: Product creation and pricing import architecture (no refactor, no pricing logic changes).

## 1. PRODUCT SYSTEM

### Primary product storage
- Core table: `products`.
- Current product shape (from Supabase types) includes: `id`, `tenant_id`, `name`, `slug`, `category`, `pricing_type`, `pricing_structure`, `technical_specs`, `banner_config`, publish flags, and presentation fields.
- Main schema roots:
  - `supabase/migrations/20251125074647_9293a1f7-5469-446d-952d-2c7813534ae7.sql`
  - `supabase/migrations/20260101100000_enable_multitenancy.sql`
  - `src/integrations/supabase/types.ts` (`products`)

### How products are created in admin
- Route registration: `src/pages/Admin.tsx`
  - `/admin/create-product` -> `ProductCreator`
  - `/admin/products` -> `ProductOverview`
  - `/admin/product/:slug` -> `ProductPriceManager`
- Create flow (`src/components/admin/ProductCreator.tsx`):
  - Resolves tenant using `resolveAdminTenant()`.
  - Inserts new row in `products` with defaults:
    - `pricing_type: "matrix"`
    - `is_published: false`
    - default `technical_specs` (width/height/bleed/min_dpi).
  - Supports preset category/preset key (`product_categories`, `preset_key`).

### How products are edited in admin
- `ProductOverview` (`src/components/admin/ProductOverview.tsx`):
  - Fetches products by resolved tenant.
  - Handles publish toggle and network release toggle (`is_available_to_tenants`).
  - Supports targeted tenant notification via RPC `send_product_to_tenants`.
- `ProductPriceManager` (`src/components/admin/ProductPriceManager.tsx`):
  - Central product editor for details, pricing, options, custom fields, specs, machine config, CSV tools.
  - Uses `ProductAttributeBuilder` for matrix-v1/generic pricing configuration.

### How products render on frontend
- Shop page: `src/pages/Shop.tsx` (theme wrapper).
- Product grid/listing: `src/components/ProductGrid.tsx`
  - Queries `products` by `tenant_id` and `is_published=true`.
  - Resolves display price via `getProductDisplayPrice`.
- Product page: `src/pages/ProductPrice.tsx`
  - Fetches `products` by slug.
  - Loads `pricing_structure`, dynamic options, and optional machine config.
  - For matrix-v1 products, delegates rendering to `MatrixLayoutV1Renderer`.

## 2. OPTIONS / VARIANTS

### Variant representation model
- Matrix-v1 definition is stored in `products.pricing_structure`.
- Canonical structure includes:
  - `mode: "matrix_layout_v1"`
  - `vertical_axis` (row axis)
  - `layout_rows[].columns[]` (format/material/finish/product sections)
  - `quantities`.
- Source types: `src/types/pricingStructure.ts`.

### Attribute and option tables
- Attribute groups/values (matrix dimensions):
  - `product_attribute_groups`
  - `product_attribute_values`
  - Defined in `supabase/migrations/20260108100000_attribute_builder.sql`.
- Optional add-ons/options:
  - `product_option_groups`
  - `product_options`
  - `product_option_group_assignments`
  - Roots in `supabase/migrations/20251208120855_3145a7dc-4ce6-44ed-bf77-88beb57fcd84.sql` + later tenantization.
- `product_options.price_mode` exists in current schema/types (`fixed`, `per_quantity`, `per_area` usage in UI/runtime).

### Runtime usage
- Frontend options UI: `src/components/product-price-page/DynamicProductOptions.tsx`.
- Price matrix renderer: `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`.
- Matrix price rows map by combination key (`variant_name`) + vertical axis value (`variant_value`) + quantity.

## 3. PRICING SYSTEM

### Where pricing data lives
- Primary generic matrix storage: `generic_product_prices`.
- Additional specialized/legacy product tables still used by current UI/utilities:
  - `print_flyers`, `folder_prices`, `visitkort_prices`, `poster_prices`, `poster_rates`, `sticker_rates`, `sign_rates`, `sign_prices`, `banner_rates`, `banner_prices`, `foil_prices`, `beachflag_prices`, `booklet_rates`, `salesfolder_rates`.
- Storformat pricing family (m2/tier-based): `storformat_*` tables.
- Machine pricing config tables: `machines`, `ink_sets`, `materials`, `finish_options`, `pricing_profiles`, `margin_profiles`, `margin_profile_tiers`, `product_pricing_configs`.

### Pricing matrix storage pattern
- `generic_product_prices` row shape:
  - `product_id`, `tenant_id`, `variant_name`, `variant_value`, `quantity`, `price_dkk`, `extra_data`.
- Unique conflict key (enforced):
  - `(product_id, variant_name, variant_value, quantity)`.
- Roots:
  - `supabase/migrations/20251208122019_d90ef466-ab1c-4424-bf9f-0dd1f6673bca.sql`
  - `supabase/migrations/20260202000001_prevent_duplicate_prices.sql`

### Interpolation logic locations
- Matrix/attribute builder interpolation:
  - `src/components/admin/ProductAttributeBuilder.tsx`
  - Key helpers include `interpolatePrice` and `computeFinalPriceForContext*`.
- Storformat interpolation:
  - `src/utils/storformatPricing.ts`
  - `src/lib/storformat-pricing/types.ts`

### Relevant pricing modules/services
- DB fetch/adapters: `src/utils/pricingDatabase.ts`.
- Static/fallback matrices + calculators: `src/utils/productPricing.ts`.
- Shop card “from price”: `src/utils/productPriceDisplay.ts`.
- Machine pricing engine:
  - FE pure engine: `src/lib/pricing/machinePricingEngine.ts`
  - Edge function: `supabase/functions/calculate-machine-price/index.ts`.

## 4. IMPORT / CSV LOGIC

### Existing importers
- Pricing Hub (project/folder-based CSV workflow):
  - UI: `src/pages/admin/PricingHub.tsx`
  - State + parse/merge: `src/hooks/usePricingHub.ts`
  - Publish: `src/components/admin/pricing-hub/PublishDialog.tsx`
- Product-level bulk CSV tools:
  - `src/components/admin/BulkCSVImport.tsx`
  - `src/components/admin/BulkCSVTools.tsx`
  - `src/components/admin/BulkCSVExport.tsx`

### Expected CSV patterns
- Pricing Hub supports `;` and `,` and maps aliases for Quantity/Size/Material/Finish/Price.
- Requirements and operator contract:
  - `docs/PRICING_HUB_CSV_IMPORT_REQUIREMENTS.md`
- Product-level bulk importer expects table-specific fixed columns (e.g. generic matrix: `variant_name,variant_value,quantity,price_dkk`).

### Publish behavior (important)
- Pricing Hub publish currently:
  - Ensures attribute groups/values exist.
  - Writes `products.pricing_structure` (`matrix_layout_v1`).
  - Deletes old `generic_product_prices` for target product.
  - Inserts rebuilt rows in batches.
- Product attribute builder save (`handlePushMatrixLayoutV1`) follows same replace/upsert pattern and stable key conventions.

### Seed scripts/helpers
- Edge seed functions:
  - `supabase/functions/seed-generic-prices/index.ts`
  - `supabase/functions/seed-product-prices/index.ts`
  - `supabase/functions/seed-folder-prices/index.ts`
- Local utility scripts for inspection/debug:
  - `scripts/debug_prices.ts`, `scripts/check_duplicate_products.ts`, `scripts/inspect_attribute_values.ts`, etc.

## 5. MULTI-TENANT STRUCTURE

### tenant_id usage
- Tenant scoping is pervasive across product/pricing/option tables.
- Tenant resolution helpers:
  - Admin: `src/lib/adminTenant.ts` (`resolveAdminTenant`)
  - Shop context: `src/hooks/useShopSettings.ts`
- Product queries in admin/storefront consistently filter by resolved `tenant_id`.

### RLS assumptions and policy model
- Baseline multi-tenant migration:
  - `supabase/migrations/20260101100000_enable_multitenancy.sql`
- Access helpers used by policies:
  - `public.has_role(...)`
  - `public.can_access_tenant(...)`
  - See later updates in `20241214100000_fix_master_admin_access.sql` and `20260101623000_allow_master_admin_page_seo.sql`.
- Public storefront read behavior is explicitly enabled for selected tables in later policy migrations (`allow_public_select`/follow-up fixes).

### Supabase interactions/back-end APIs
- RPC/function flow used in product distribution:
  - `send_product_to_tenants` (targeted notifications)
  - `sync_specific_product` (deep copy product + related pricing/options/fields)
- Key migrations:
  - `supabase/migrations/20260101170000_deep_sync_products.sql`
  - `supabase/migrations/20260210000001_targeted_product_release.sql`

## 6. KEY FILE PATHS

### Admin product editor
- `src/pages/Admin.tsx`
- `src/components/admin/ProductOverview.tsx`
- `src/components/admin/ProductCreator.tsx`
- `src/components/admin/ProductPriceManager.tsx`
- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/admin/OptionGroupManager.tsx`

### Storefront product display
- `src/pages/Shop.tsx`
- `src/components/ProductGrid.tsx`
- `src/pages/ProductPrice.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/product-price-page/MachineConfigurator.tsx`

### Pricing modules
- `src/utils/pricingDatabase.ts`
- `src/utils/productPricing.ts`
- `src/utils/productPriceDisplay.ts`
- `src/lib/pricing/machinePricingEngine.ts`
- `src/utils/storformatPricing.ts`
- `src/lib/storformat-pricing/types.ts`

### Import/automation-related modules
- `src/pages/admin/PricingHub.tsx`
- `src/hooks/usePricingHub.ts`
- `src/components/admin/pricing-hub/PublishDialog.tsx`
- `src/components/admin/BulkCSVImport.tsx`
- `src/components/admin/BulkCSVTools.tsx`
- `src/components/admin/BulkCSVExport.tsx`

### Supabase schema and functions
- `supabase/migrations/20251125074647_9293a1f7-5469-446d-952d-2c7813534ae7.sql`
- `supabase/migrations/20251208122019_d90ef466-ab1c-4424-bf9f-0dd1f6673bca.sql`
- `supabase/migrations/20260108100000_attribute_builder.sql`
- `supabase/migrations/20260213000000_pricing_hub.sql`
- `supabase/migrations/20260101100000_enable_multitenancy.sql`
- `supabase/functions/calculate-machine-price/index.ts`

## 7. DO NOT TOUCH ZONE

These are high-risk modules for automation/refactor and should be treated as protected unless explicitly approved.

### Business-critical pricing logic
- `src/utils/productPricing.ts`
- `src/lib/pricing/machinePricingEngine.ts`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/admin/ProductAttributeBuilder.tsx` (especially matrix-v1 push/interpolation/key logic)

### Pricing Hub locked workflow
- `src/pages/admin/PricingHub.tsx`
- `src/hooks/usePricingHub.ts`
- `src/components/admin/pricing-hub/*`
- Lock notes: `.agent/workflows/pricing-hub-protected.md`

### Tenant/RLS core behavior
- `src/lib/adminTenant.ts`
- `src/hooks/useShopSettings.ts` tenant resolution paths
- `public.can_access_tenant` / `public.has_role` migration chain
- Product sync/release RPC migration logic (`sync_specific_product`, `send_product_to_tenants`)

### Additional protected domains (from safety boundaries)
- Designer/preflight/export/soft-proof protected files under:
  - `src/components/designer/*`
  - `src/lib/designer/export/*`
  - `src/utils/preflightChecks.ts`
  - `src/workers/colorProofing.worker.ts`
- POD v1 and POD v2 isolation zones:
  - `src/lib/pod/*`
  - `src/lib/pod2/*`

## 8. SAFE INTEGRATION POINTS (FOR NEW IMPORTER/AUTOMATION)

Goal: add automation without changing pricing math, product architecture, or existing admin behavior.

### Preferred low-risk integration path
- Add an **adapter layer** that transforms external input into the same payload shape already used by Pricing Hub publish.
- Recommended location (new additive module):
  - `src/lib/pricing-import/` (or `src/hooks/` for UI-driven usage)
- Adapter output should target existing publish contract:
  - mapped attributes (format/material/finish)
  - quantities
  - rows that become `generic_product_prices` inserts
  - `matrix_layout_v1` structure compatible with current renderer.

### Use existing publish pipeline instead of new write logic
- Safest approach is to call existing flow boundaries already proven in:
  - `PublishDialog` publish sequence
  - `ProductAttributeBuilder` matrix-v1 save sequence
- Avoid introducing a second independent pricing writer that diverges on key composition or dedupe rules.

### Optional backend extension (additive)
- If background automation is needed, add a new queue/staging table + processor (edge function) that:
  - validates and normalizes external rows,
  - then invokes existing write conventions (same conflict keys, same replace behavior).
- Do not modify machine pricing engine or existing interpolation modules.

### Guardrails for safe rollout
- Keep all writes tenant-scoped (`tenant_id` + resolved admin tenant).
- Preserve existing admin UI routes and flows unchanged.
- Add only additive feature flags/UI entry points for automation.
- Validate against one full publish cycle and storefront price check before enabling broadly.

---

This brief is intended as the reusable architecture reference for upcoming automation tasks to avoid repeated full-repo rescans.
