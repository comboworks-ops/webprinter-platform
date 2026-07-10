# Supplier Product Bank Plan

Date: 2026-07-01
Status: planning / additive architecture
Scope: backend/admin product bank for supplier-sourced print products

## Goal

Create a master-admin product bank of print-house products and prices. The bank
is a staging and review layer: supplier data can be scraped, normalized,
translated, priced, compared, and refreshed without automatically changing live
storefront products.

Admins should be able to browse product families such as flyers, folders,
sales folders, banners, signs, t-shirts, books, posters, labels, and business
cards, then import a selected bank product into the existing Webprinter product
system with an explicit action.

## Important Boundary

This is not POD v1 and not POD v2. It should not reuse POD tables. It is a
supplier catalog / product bank that can feed the existing product and pricing
tables only after review and approval.

Do not change core pricing logic. The import step should reuse existing
Matrix Layout V1, storformat, product attribute, and generic price publisher
patterns.

## Current Assets To Reuse

- Existing Fetch skill: supplier page scraping into Matrix Layout V1.
- Existing Fetch2 skill: WIRmachenDRUCK free-size / dynamic endpoint extraction.
- Existing Pixart skill and scripts for wide-format imports.
- Supplier source registry:
  - `config/supplier-bank/sources.json`
  - validates external print-house sources before scraping
  - keeps Webprinter, Sales Maba/Salgsmapper, Onlinetryksager, and localhost in
    internal exclusions
- Existing product-blueprint tooling and snapshots.
- Existing normalized pricing helpers:
  - `scripts/product-import/shared/normalized-pricing.js`
  - `scripts/product-import/shared/conversion.js`
- Existing admin/product model:
  - `products`
  - `product_attribute_groups`
  - `product_attribute_values`
  - `generic_product_prices`
  - storformat tables where relevant

## Proposed Layers

### 1. Supplier Registry

Stores print houses and integration metadata.

Suggested fields:
- `id`
- `name`
- `slug`
- `website_url`
- `country_code`
- `currency`
- `integration_type`: `api`, `scrape`, `playwright`, `manual`
- `enabled`
- `notes`
- timestamps

Examples:
- WIRmachenDRUCK
- Pixartprinting
- Print.com
- Avilo
- other Danish or EU print houses supplied later

Do not list Salgsmapper/Sales Maba as a supplier source. It is one of our own
systems and belongs on the internal storefront/tenant side, not in the external
supplier bank.

### 2. Supplier Product Bank

Stores normalized product drafts independent of live storefront products.

Suggested fields:
- `id`
- `supplier_id`
- `supplier_product_key`
- `source_url`
- `source_hash`
- `product_family`: `flyers`, `folders`, `sales_folders`, `banners`, `signs`, `tshirts`, etc.
- `name_original`
- `name_da`
- `description_original`
- `description_da`
- `status`: `draft`, `reviewed`, `approved`, `archived`, `failed`
- `source_language`
- `target_language`: usually `da`
- `normalized_attributes`
- `normalized_pricing_summary`
- `raw_snapshot_path`
- `last_scraped_at`
- `last_price_checked_at`
- `scrape_status`
- timestamps

### 3. Supplier Price Snapshots

Stores versioned price data. Prices should be immutable per scrape run so we
can compare changes over time.

Suggested fields:
- `id`
- `bank_product_id`
- `supplier_id`
- `scrape_run_id`
- `currency`
- `conversion_rule_key`
- `raw_price_rows`
- `normalized_price_rows`
- `price_min_dkk`
- `price_max_dkk`
- `quantity_min`
- `quantity_max`
- `checksum`
- timestamps

### 4. Scrape Runs

Stores every crawl/extract attempt and makes failures auditable.

Suggested fields:
- `id`
- `supplier_id`
- `started_by`
- `mode`: `catalog_discovery`, `product_extract`, `price_refresh`
- `tool`: `firecrawl`, `playwright`, `supplier_api`, `manual_upload`
- `status`: `running`, `succeeded`, `partial`, `failed`
- `input`
- `summary`
- `error`
- timestamps

### 5. Import Jobs

Stores explicit admin import actions into existing product systems.

Suggested fields:
- `id`
- `bank_product_id`
- `target_tenant_id`
- `target_product_id`
- `import_mode`: `matrix_layout_v1`, `storformat`, `pod2_catalog_reference`
- `status`: `draft`, `dry_run`, `imported`, `failed`
- `import_summary`
- `rollback_note`
- timestamps

### 6. Price Delta Reviews

Stores manual comparison reviews between two supplier price snapshots before a
refresh is accepted.

Suggested fields:
- `id`
- `supplier_id`
- `bank_product_id`
- `old_price_snapshot_id`
- `new_price_snapshot_id`
- `supplier_product_key`
- `product_family`
- `old_snapshot_path`
- `new_snapshot_path`
- `threshold_pct`
- `status`: `draft`, `reviewed`, `accepted`, `rejected`
- `change_summary`
- `changed_rows`
- `added_rows`
- `removed_rows`
- `notes`
- timestamps

## Category Model

Start with a flat controlled taxonomy:

- `flyers`
- `folders`
- `sales_folders`
- `business_cards`
- `posters`
- `banners`
- `signs`
- `rollups`
- `stickers`
- `labels`
- `books`
- `letterheads`
- `tshirts`
- `packaging`
- `other`

Later this can map to the existing product category hierarchy without forcing
every supplier into one frontend category immediately.

## Scraping Strategy

Use a supplier adapter per print house.

Adapter responsibilities:
- discover product URLs where legal and practical
- extract product details
- extract or calculate valid option combinations
- extract prices or call supplier price endpoints
- normalize labels into Danish
- create versioned snapshots
- never publish directly to storefront products

Recommended tool order:
1. Supplier API or JSON endpoint, when available.
2. Existing optimized Playwright scripts for complex dynamic suppliers.
3. Firecrawl for simpler catalog/product pages and text extraction.
4. Static HTML fetch as a fallback for simple pages.

## Danish Normalization

Each adapter should output:
- original supplier text
- Danish display text
- normalized attribute keys
- normalized attribute values

Examples:
- `Auflage` -> `Oplag`
- `Format` -> `Format`
- `Papier` / `Material` -> `Materiale`
- `Veredelung` -> `Efterbehandling`
- `Lieferzeit` -> `Leveringstid`
- `4/4-farbig` -> `4/4 farvet`
- `beidseitig` -> `dobbeltsidet`

Store the original too. Danish text is editable in the bank before import.

## Price Policy

Supplier prices should be stored separately from Webprinter selling prices.

For every normalized row keep:
- supplier currency
- supplier net/gross flag if known
- supplier raw price
- conversion rule
- converted DKK base
- proposed selling price DKK
- markup inputs

Price refresh can be scheduled later, but the first phase should be manual
or dry-run because supplier pages can change structure unexpectedly.

## Admin UX

New master-admin page suggestion: `/admin/supplier-bank`

Views:
- supplier list
- product bank browser
- product detail with source snapshot, Danish text, option matrix, and price summary
- scrape run logs
- import dry-run preview
- import result / linked product

Key controls:
- filter by supplier
- filter by product family
- status tabs: draft, reviewed, approved, failed
- search product name
- run scrape / refresh prices
- approve product
- import to tenant/shop

## Import Flow

1. Admin opens supplier bank.
2. Admin selects an approved bank product.
3. System shows dry-run import preview:
   - product name and slug
   - target tenant
   - attributes and values
   - quantities
   - price rows
   - pricing target: Matrix Layout V1 or storformat
4. Admin clicks import.
5. Import creates or updates the target product using existing product/publisher patterns.
6. Product is draft by default unless admin explicitly publishes.

## Automation Phases

### Phase 1: Foundation

- Add plan and skill.
- Add database migration for supplier registry, bank products, price snapshots,
  scrape runs, and import jobs.
- Add RLS with master-admin-only write access.
- Add TypeScript types/helpers for normalized bank products.

### Phase 2: Admin Browser

- Add `/admin/supplier-bank`.
- Read from bank tables.
- Product family filters and status workflow.
- Show normalized pricing summary.

### Phase 3: First Supplier Adapter

- Start with one known supplier and one product family.
- Recommended pilot: WIRmachenDRUCK sales folders or flyers because existing
  scripts already understand WMD price extraction.
- Store snapshots only. Do not import live products in the first pilot.

### Phase 4: Import Button

- Add dry-run import preview.
- Reuse existing Matrix Layout V1 publisher and normalized pricing helpers.
- Create draft products only.

### Phase 5: Price Refresh

- Manual refresh first.
- Add scheduled refresh only after adapters are stable.
- Store price deltas and require approval before changing imported live products.

### Phase 6: More Suppliers

- Add supplier adapters one by one:
  - WIRmachenDRUCK
  - Pixartprinting
  - Print.com catalog bridge, if useful
  - Avilo
  - user-supplied print houses

## Risks

- Supplier terms may restrict scraping or automated price extraction.
- Some suppliers require sessions, cookies, or dynamic quote endpoints.
- Price tables can change without warning.
- Imported prices must not silently overwrite live storefront pricing.
- Different suppliers express the same product options differently.
- German, English, Italian, and Danish supplier language must be normalized
  without losing original meaning.

## Recommended First Practical Step

Build the foundation and pilot it on one supplier/product family:

1. Validate the supplier-source registry and internal-domain exclusions.
2. Create the supplier-bank schema with master-admin safeguards.
3. Build a local adapter contract and snapshot writer.
4. Convert one existing WIRmachenDRUCK script to write into the bank instead
   of publishing directly.
5. Add a read-only admin browser.
6. Add import only after the bank data is visible and trusted.

## Implementation Started

Initial foundation added:

- Migration:
  - `supabase/migrations/20260701120000_supplier_product_bank.sql`
  - includes `supplier_bank_price_delta_reviews` for stored manual refresh
    comparisons
- Shared frontend/types module:
  - `src/lib/supplier-bank/types.ts`
  - `src/lib/supplier-bank/index.ts`
- Read-only master-admin browser:
  - `src/pages/admin/SupplierBank.tsx`
  - route: `/admin/supplier-bank`
  - sidebar link: Platform -> Supplier Bank
  - starts with a simple business browser: choose product group, choose print
    house, search product, then open preview/import. The simple product grid
    shows visible/total match counts and has `Vis flere` / `Vis alle`, so
    larger supplier families are not hidden behind the first few product cards.
  - shows draft-import QA warnings before the simple browser when imported
    supplier-bank target products are published or have row/pricing issues,
    with manual product-admin links only. It does not auto-unpublish or repair
    live products.
  - shows supplier/product/run counts, price summary, source links, and guarded
    bank-product status actions
  - includes a read-only dry-run import preview dialog showing target import
    mode, attribute groups, price summary, latest price snapshot, and sample
    normalized price rows
  - shows latest stored price-delta reviews with changed/added/removed row
    counts and guarded review/accept/reject status actions
  - can request a draft price-delta review from the latest two stored price
    snapshots for a bank product
  - shows stored price-snapshot counts per bank product and disables price
    review until at least two snapshots exist
  - shows recent `supplier_bank_import_jobs` records so explicit draft imports
    have a visible audit trail
  - shows a read-only five-step Gate roadmap derived from existing loaded
    supplier-bank state; it lists Pixart rigids approval, Print.com
    `other`/placemats, missing Pixart family preparation, imported-draft QA,
    and completion recheck without calling suppliers or writing bank/product
    data
  - shows Pixart URL candidates for missing families from supplier metadata or
    the checked-in registry fallback; these links remain planning-only until an
    exact product URL and extractor profile are confirmed
  - shows a business-facing supplier menu with bank/missing family chips and a
    selected-supplier product-family strip; those controls only filter already
    loaded bank products and do not probe, scrape, import, publish, or write
    live prices
  - shows an `Afventer godkendelse` panel for the current approval candidates
    (Pixart rigids/signs and Print.com placemats); it is read-only and only
    changes the supplier filter, so it does not run preflights, write bank
    rows, create drafts, publish, or write live prices
  - includes bank-status workflow filters (`Godkendt`, `Kladde`,
    `Gennemgaaet`, `Fejlet`) layered before readiness filters; these only
    filter loaded active bank rows and do not expose archived products
  - shows a read-only `Manglende familier` coverage-gap panel with current
    blockers and next safe steps for missing registered supplier families;
    Pixart gaps remain blocked before probe/extract until exact URLs and
    profiles are confirmed, and Print.com `other` stays the placemats
    bank-only approval gate
- Price delta Edge Function:
  - `supabase/functions/supplier-bank-create-delta-review/index.ts`
  - registered with `verify_jwt = true`
  - requires master-admin auth
  - compares only stored supplier-bank price snapshots
  - writes only a draft `supplier_bank_price_delta_reviews` row
  - does not refresh suppliers, import products, publish products, or write
    live pricing
- Draft import Edge Function:
  - `supabase/functions/supplier-bank-import-draft/index.ts`
  - registered with `verify_jwt = true`
  - requires master-admin auth
  - supports dry-run preview and approved-product draft import
  - refuses non-approved bank products for write mode
  - refuses to overwrite an existing product slug
  - creates only an unpublished draft product and a supplier-bank import job
  - rolls back the unpublished draft product, attributes, prices, and import
    job if a later insert fails during the same request
- Supplier bank CLI:
  - `scripts/supplier-bank-cli.mjs`
  - includes `validate-supplier-sources` for the external supplier-source
    registry and internal-domain exclusion gate
  - includes `seed-supplier-sources`, dry-run by default, for upserting only
    `supplier_bank_suppliers` rows after migration approval
  - includes `verify-supplier-sources`, read-only, for comparing remote
    `supplier_bank_suppliers` rows against the source registry
  - includes `smoke-wmd-bank-pilot`, no-write, for exercising the local WMD
    pilot path before remote apply
  - includes `preflight-wmd-bank-pilot`, no-write, for CLI syntax, WMD smoke,
    supplier-bank Edge Function type checks, Supabase grant checks, and
    function exposure checks
  - includes a no-write `doctor` readiness command for migration/write-bank
    preflight checks
  - includes full WMD helper aliases `apply-wmd-bank` and `verify-wmd-bank`
    for the current `wmd-folder-bank` dataset
  - includes `refresh-wmd-bank`, preview-only by default, for creating the next
    full WMD supplier-bank scrape run and price snapshot after initial setup
  - includes `review-import-eligibility`, read-only, for auditing which bank
    products are ready, need approval, are already imported, or are blocked by
    the latest price-review/snapshot guard
  - includes `review-source-coverage`, read-only, for comparing registered
    supplier-source product families with the active staged bank products and
    highlighting missing coverage before the next supplier expansion
  - includes `plan-next-expansion`, read-only, for ranking the current supplier
    backlog and printing the next safe command path from the same coverage and
    import-eligibility guards
  - keeps `apply-wmd-bank-pilot` and `verify-wmd-bank-pilot` for the archived
    miniature pilot dataset
  - guarded WMD apply commands preview by default and require
    `--confirm-remote-write` before remote migration, Edge Function deploy,
    and write-bank
  - package aliases exist for no-write/preview operations:
    `supplier-bank:doctor`, `supplier-bank:validate-sources`,
    `supplier-bank:seed-sources:preview`, `supplier-bank:smoke-wmd`,
    `supplier-bank:smoke-wmd:report`, `supplier-bank:preflight-wmd`,
    `supplier-bank:apply-wmd:preview`, `supplier-bank:refresh-wmd:preview`,
    `supplier-bank:plan-next-expansion`,
    `supplier-bank:print-com-plan-first-slice`,
    `supplier-bank:verify-sources`, `supplier-bank:verify-wmd`,
    `supplier-bank:apply-wmd-pilot:preview`, and
    `supplier-bank:verify-wmd-pilot`
  - prepares raw and normalized bank snapshots from existing product
    blueprints
  - only writes to bank tables when `--write-bank` is passed
  - previews normalized supplier-bank snapshots as draft Matrix Layout V1
    products with `import-normalized-snapshot`
  - can create an unpublished draft product only when
    `--write-draft-product` is explicitly passed
  - compares normalized snapshots for manual price-refresh delta review with
    `compare-normalized-snapshots`
  - can store a delta review only when `--write-delta-review` is explicitly
    passed
- External WMD folder pilot blueprint:
  - `blueprints/supplier-bank-wmd-folder-pilot.yml`
- Supplier source registry:
  - `config/supplier-bank/sources.json`
  - WIRmachenDRUCK is the active pilot source
  - Pixartprinting and Print.com are candidate sources
  - Sales Maba/Salgsmapper and Onlinetryksager are internal exclusions, not
    supplier sources
- WIRmachenDRUCK folder importer bank-only mode:
  - `scripts/fetch-folders-import.js import --bank-snapshot-only`
  - extracts real WMD folder rows
  - writes raw, clean, and normalized supplier-bank snapshots
  - can write to supplier-bank tables only when `--write-bank` is explicitly
    paired with `--bank-snapshot-only`
  - exits before live product/publisher code

This first implementation slice is intentionally non-publishing:

- no supplier scrape jobs are scheduled
- no supplier rows are seeded
- no live products are created or updated
- no prices are written to `generic_product_prices`

The active admin mutations are intentionally guarded: bank-product review
status, draft price-delta review creation/status changes, and explicit draft
product import for approved bank products. None of these publish products or
accept supplier price changes into live storefront pricing.

The dry-run import preview is read-only. It loads the latest
`supplier_bank_price_snapshots` row for the selected bank product and previews
how the product would map toward Matrix Layout V1. The real import button is
still disabled.

The price-delta review panel is also bank-only. It reads
`supplier_bank_price_delta_reviews` and can update only review status:
draft -> reviewed, reviewed -> accepted/rejected. It does not refresh supplier
prices, import products, publish products, or write live pricing.

The admin "Price review" action calls `supplier-bank-create-delta-review`. It
requires two stored supplier-bank price snapshots for the product, compares
those snapshots, and creates a draft `supplier_bank_price_delta_reviews` row.
The admin browser shows snapshot count/latest snapshot date per product and
keeps the action disabled until two snapshots are present. It does not create a
fresh supplier scrape by itself.

The read-only CLI import eligibility audit mirrors the admin import guard:

```bash
npm run supplier-bank:review-import-eligibility
```

It checks stored supplier-bank products, price snapshots, latest delta reviews,
and import jobs, and reports whether each product is ready, ready after bank
approval, already imported, or blocked. It does not scrape suppliers, create
products, publish products, or write live pricing. It excludes archived bank
products by default so the CLI audit matches the admin browser; use
`--include-archived` for old pilot/history rows.

The read-only source coverage audit compares the supplier-source registry with
active bank products:

```bash
npm run supplier-bank:review-source-coverage
```

It reports covered and missing product families per supplier, excludes archived
bank products by default, includes readiness counts plus the next suggested
action per supplier, and performs no scraping, product creation, publishing, or
pricing writes.

The explicit draft import button now calls `supplier-bank-import-draft`. The
button only enables for approved bank products, and the function independently
enforces the same rule. The function creates Matrix Layout V1 attributes,
generic price rows, and a `supplier_bank_import_jobs` record, but the product is
always `is_published = false`. If a write fails after the draft product has
been created, the function attempts to delete only that newly-created
unpublished draft and its related attribute/price/import-job rows.

The admin browser shows recent `supplier_bank_import_jobs` with import mode,
status, row counts, target product id, and rollback note. After a successful
draft import, the browser adds the returned import job to the visible audit
panel without requiring a reload.

### Draft Product Import CLI Added

### Supplier Bank Readiness Check

The supplier-bank CLI includes a no-write local WMD pilot smoke run:

```bash
node scripts/supplier-bank-cli.mjs smoke-wmd-bank-pilot
```

Convenience alias:

```bash
npm run supplier-bank:smoke-wmd
```

Current result:

- validates supplier-source registry
- previews 3 supplier seed rows with 1 enabled and 2 disabled candidates
- compares WMD pilot snapshots as 180 unchanged rows
- previews Matrix Layout V1 draft import with 180 price rows and quantities
  50-20000
- previews the guarded remote apply command
- performs no Supabase writes, live product writes, or live pricing writes

The smoke run can also write a dated report:

```bash
node scripts/supplier-bank-cli.mjs smoke-wmd-bank-pilot --limit 3 --write-report
```

Convenience alias:

```bash
npm run supplier-bank:smoke-wmd:report
```

Current report:

- `docs/SUPPLIER_PRODUCT_BANK_WMD_PILOT_SMOKE_2026-07-01.md`

The stronger local preflight is:

```bash
node scripts/supplier-bank-cli.mjs preflight-wmd-bank-pilot
```

Convenience alias:

```bash
npm run supplier-bank:preflight-wmd
```

It performs no writes and covers CLI syntax, the WMD smoke path, both
supplier-bank Edge Function Deno checks, Supabase Data API grant checks, and
Supabase function exposure checks.

The supplier-bank CLI validates the supplier-source registry before new source
work:

```bash
node scripts/supplier-bank-cli.mjs validate-supplier-sources
```

Convenience alias:

```bash
npm run supplier-bank:validate-sources
```

Current result:

- external sources: 3
- active sources: 1 (`wir-machen-druck`)
- candidate sources: 2 (`pixartprinting`, `print-com`)
- internal exclusions include Webprinter, Sales Maba/Salgsmapper,
  Onlinetryksager, and localhost
- no Supabase writes

The supplier-bank CLI can also preview the supplier registry rows that will
become the first supplier list in the bank:

```bash
node scripts/supplier-bank-cli.mjs seed-supplier-sources
```

Convenience alias:

```bash
npm run supplier-bank:seed-sources:preview
```

Current dry-run result:

- supplier rows: 3
- enabled rows: 1 (`wir-machen-druck`)
- disabled/candidate rows: 2 (`pixartprinting`, `print-com`)
- target table: `supplier_bank_suppliers`
- no scraping
- no live product writes
- no live pricing writes

After the migration is applied and bank-table writes are approved:

```bash
node scripts/supplier-bank-cli.mjs seed-supplier-sources --write-bank
```

This writes only supplier registry rows. It does not create bank products,
price snapshots, live products, or `generic_product_prices` rows.

After seeding, verify the remote supplier registry without writes:

```bash
node scripts/supplier-bank-cli.mjs verify-supplier-sources
```

Before the migration is applied this fails read-only with a clear message that
`supplier_bank_suppliers` is not readable yet. After a successful remote apply,
it should report all three expected supplier rows and no mismatches.

The supplier-bank CLI includes a no-write readiness check:

```bash
node scripts/supplier-bank-cli.mjs doctor
```

Convenience alias:

```bash
npm run supplier-bank:doctor
```

It checks for the supplier-bank migration, registered Edge Function source,
WMD normalized snapshots, WMD clean CSVs, Supabase credentials, and Deno
availability. It also prints the guarded commands to run after credentials are
available, including `supabase db push` and the WMD `--bank-snapshot-only
--write-bank` command. Missing required credentials return a non-zero exit so
the check can be used as a preflight gate.

Current local result:

- migration, Edge Function sources/config, WMD normalized snapshot, WMD clean
  CSV, Supabase URL, and service-role env are present
- required blocker: `SUPABASE_ACCESS_TOKEN` is missing
- Deno is installed at `/Users/thomasprintmaker/.deno/bin/deno`
- `deno check` passes for both supplier-bank Edge Functions:
  - `supabase/functions/supplier-bank-import-draft/index.ts`
  - `supabase/functions/supplier-bank-create-delta-review/index.ts`
- next guarded write command printed by `doctor` uses
  `scripts/fetch-folders-import.js import --bank-snapshot-only --write-bank`
  with `pricing_clean/wmd-folder-bank-pilot/20260701-124922.csv`

### Guarded WMD Remote Apply

The supplier-bank CLI includes a single guarded wrapper for the remote WMD pilot
step:

```bash
node scripts/supplier-bank-cli.mjs apply-wmd-bank-pilot
```

By default this is preview-only and prints the exact commands. It does not run
remote writes. To run the sequence after credentials are present and the user
approves remote writes:

```bash
node scripts/supplier-bank-cli.mjs apply-wmd-bank-pilot --confirm-remote-write
```

The confirmed path refuses unless `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_URL`/`VITE_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are present.
It runs:

- `scripts/supplier-bank-cli.mjs validate-supplier-sources`
- `node_modules/.bin/supabase migration list`
- `node_modules/.bin/supabase db push`
- `scripts/supplier-bank-cli.mjs seed-supplier-sources --write-bank`
- `node_modules/.bin/supabase functions deploy supplier-bank-import-draft supplier-bank-create-delta-review --use-api`
- `scripts/fetch-folders-import.js import --bank-snapshot-only --write-bank`
- `scripts/supplier-bank-cli.mjs verify-supplier-sources`
- `scripts/supplier-bank-cli.mjs verify-wmd-bank-pilot`

The supplier seed writes only `supplier_bank_suppliers`, and the WMD importer
still writes only supplier-bank product/snapshot tables in this mode. The
sequence must not write live storefront products or live pricing. The final two
steps are read-only verification gates.

After the remote apply, verify that the supplier-bank rows are present without
performing any writes:

```bash
node scripts/supplier-bank-cli.mjs verify-wmd-bank-pilot
```

This checks the WIRmachenDRUCK supplier, the `wmd-folder-bank-pilot` bank
product, the latest stored price snapshot, recent import jobs, and recent price
delta reviews. It reads only supplier-bank tables and does not scrape supplier
pages, import products, publish products, or write live pricing.

The supplier-bank CLI now has a guarded draft import path from a normalized
snapshot:

```bash
node scripts/supplier-bank-cli.mjs import-normalized-snapshot \
  pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json \
  --tenant 00000000-0000-0000-0000-000000000000 \
  --name "WMD Folder Draft" \
  --slug wmd-folder-draft
```

Default behavior is preview-only and performs no Supabase writes.

Validation result:

- source supplier: `wir-machen-druck`
- source product key: `wmd-folder-bank-pilot`
- target import mode: Matrix Layout V1
- price rows: 180
- quantities: 50-20000
- price range: 121-5073 DKK
- formats/materials/surfaces: 1/5/2
- folds/pages/orientations: 1/1/1
- no Supabase writes

`--write-draft-product` is available for a later approved run. It requires a
target tenant, refuses to overwrite an existing product slug, creates the
product unpublished, and uses the existing Matrix Layout publisher.

### Manual Price Delta Review Added

The supplier-bank CLI now compares two normalized snapshots before any price
refresh is accepted:

```bash
node scripts/supplier-bank-cli.mjs compare-normalized-snapshots \
  pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-124922.json \
  pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json \
  --limit 5
```

Validation result for the two WMD pilot snapshots:

- old rows: 180
- new rows: 180
- changed rows: 0
- added rows: 0
- removed rows: 0
- unchanged rows: 180
- duplicate keys: 0
- no Supabase writes

This covers the first manual delta-review gate. A later UI or scheduled refresh
can reuse the same comparison logic before updating bank records or imported
draft products.

The migration now includes `supplier_bank_price_delta_reviews`, guarded by the
same master-admin RLS and explicit grants as the other supplier-bank tables.
The CLI can store a comparison after migration/auth is available:

```bash
node scripts/supplier-bank-cli.mjs compare-normalized-snapshots \
  pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-124922.json \
  pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json \
  --write-delta-review \
  --notes "Manual WMD pilot comparison"
```

This writes only `supplier_bank_price_delta_reviews`; it does not update live
products or live prices.

Next implementation slice should be a single pilot adapter that writes snapshots
and normalized bank data only.

### Pilot Smoke Run

Validated the WIRmachenDRUCK folder pilot in shape-only mode:

```bash
node scripts/supplier-bank-cli.mjs ingest-blueprint \
  blueprints/supplier-bank-wmd-folder-pilot.yml \
  --supplier-slug wir-machen-druck \
  --supplier-name WIRmachenDRUCK \
  --supplier-website https://www.wir-machen-druck.de \
  --product-family folders \
  --no-extract
```

Result:

- created raw snapshot under `pricing_raw/supplier-bank/wir-machen-druck/wmd-folder-pilot/`
- created normalized snapshot under `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-pilot/`
- wrote no Supabase rows
- created no live product
- wrote no `generic_product_prices` rows
- used external WIRmachenDRUCK source URL, not Salgsmapper/Sales Maba

### External WMD Extraction Milestone

Validated the existing WIRmachenDRUCK folder importer in bank-only mode:

```bash
node scripts/fetch-folders-import.js import \
  --bank-snapshot-only \
  --max-detail-pages 1 \
  --name "WMD Folder Bank Pilot" \
  --slug wmd-folder-bank-pilot
```

Result:

- fetched 1 external WIRmachenDRUCK detail page
- extracted 192 raw supplier rows
- prepared 180 transformed/normalized rows
- created raw snapshot:
  - `pricing_raw/wmd-folder-bank-pilot/20260701-124922.json`
- created clean CSV:
  - `pricing_clean/wmd-folder-bank-pilot/20260701-124922.csv`
- created normalized supplier-bank snapshot:
  - `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-124922.json`
- wrote no Supabase rows
- created no live product
- wrote no `generic_product_prices` rows

This proves Phase 3 can use an existing WMD supplier script as a bank adapter
without publishing to storefront pricing.

### Bank DB Write Mode Added

The WIRmachenDRUCK folder importer now supports explicit supplier-bank table
writes:

```bash
node scripts/fetch-folders-import.js import \
  --bank-snapshot-only \
  --write-bank \
  --from-clean-csv pricing_clean/wmd-folder-bank-pilot/20260701-124922.csv \
  --name "WMD Folder Bank Pilot" \
  --slug wmd-folder-bank-pilot
```

Safety boundaries:

- `--write-bank` is rejected unless `--bank-snapshot-only` is also present.
- The writer requires a Supabase service-role key.
- It writes only:
  - `supplier_bank_suppliers`
  - `supplier_bank_scrape_runs`
  - `supplier_bank_products`
  - `supplier_bank_price_snapshots`
- It does not create or update live products.
- It does not write to `generic_product_prices`.

Validated locally without DB writes by replaying the clean CSV:

```bash
node scripts/fetch-folders-import.js import \
  --bank-snapshot-only \
  --from-clean-csv pricing_clean/wmd-folder-bank-pilot/20260701-124922.csv \
  --name "WMD Folder Bank Pilot" \
  --slug wmd-folder-bank-pilot
```

Result:

- loaded 180 rows from the clean WMD CSV
- wrote a new normalized supplier-bank snapshot
- created no live product
- wrote no live prices

Supabase migration application status:

- Workspace is linked to project `ziattmsmiirfweiuunfo`.
- `SUPABASE_ACCESS_TOKEN` is available locally through `.env.local`.
- `supabase db push --dry-run` is not safe in this repository because the
  remote migration history contains drift from older local/remote migrations.
- The supplier-bank migration was therefore applied with the safer single-file
  path:
  - `supabase db query --linked --file supabase/migrations/20260701120000_supplier_product_bank.sql`
  - `supabase migration repair --linked --status applied 20260701120000`
- The supplier-bank tables now exist remotely, and `20260701120000` appears in
  remote migration history.

### Remote WMD Pilot Applied

Remote apply status on 2026-07-01:

- Seeded `supplier_bank_suppliers` with three external supplier rows:
  - WIRmachenDRUCK enabled/active
  - Pixartprinting disabled/candidate
  - Print.com disabled/candidate
- Deployed Edge Functions:
  - `supplier-bank-import-draft`
  - `supplier-bank-create-delta-review`
- Wrote the WMD folder pilot into supplier-bank tables only.
- Verified remote WMD bank product:
  - supplier: WIRmachenDRUCK
  - product key: `wmd-folder-bank-pilot`
  - status: `draft`
  - scrape status: `fresh`
  - normalized rows: 180
  - quantities: 50-20000
  - DKK range: 121-5073
  - stored price snapshots: 1
  - latest price snapshot: `96792727-f5e6-428e-83b5-a9a405fd3f2c`
- Live storefront products were not created or updated.
- Live `generic_product_prices` were not written.

### Full WMD Folder Bank Imported As Draft

Remote full-folder status on 2026-07-02:

- Wrote the full WIRmachenDRUCK folder bank into supplier-bank tables.
- Marked the full bank product approved:
  - supplier: WIRmachenDRUCK
  - product key: `wmd-folder-bank`
  - product id: `891a5cf1-7884-4344-9bab-8071c38b6443`
  - normalized rows: 18,660
  - formats: 9
  - materials: 5
  - surfaces: 2
  - folds: 3
  - page counts: 4
  - orientations: 2
  - DKK range: 102-41899
- Archived the earlier small pilot product `wmd-folder-bank-pilot`.
- Created an explicit unpublished draft Webprinter product:
  - product id: `09e39172-1148-4429-b082-01c0f1232f09`
  - slug: `wmd-folder-bank-891a5cf1`
  - pricing type: `matrix`
  - generic price rows: 18,660
- Corrected DIN format dimensions before final verification.
- Made the normal WMD package helpers target the full `wmd-folder-bank`;
  archived pilot checks now use explicit `:pilot` commands.
- Created the first full-bank draft price delta review:
  - review id: `408afed3-7b85-471a-8c48-f932f377a3f7`
  - old snapshot id: `3c8efd31-8340-45a6-89db-3d9688048265`
  - new snapshot id: `aca951d0-6963-400d-8509-d8995cdc3bf2`
  - changed/added/removed rows: `0/0/0`
  - unchanged rows: `18,660`
- Added a focused full WMD refresh preview command:
  - command: `node scripts/supplier-bank-cli.mjs refresh-wmd-bank`
  - confirmed bank-only write: `node scripts/supplier-bank-cli.mjs refresh-wmd-bank --confirm-bank-write`
  - no migration apply, no Edge Function deploy, no live product writes, and no live pricing writes
- Attempted a confirmed live WMD refresh on 2026-07-03:
  - aborted before remote DB write because supplier pages returned skipped/partial detail pages
  - remote WMD bank remained unchanged at 2 stored snapshots
  - no new delta review was created from partial data
- Hardened live WMD refresh behavior:
  - retries each supplier detail page in a fresh browser page
  - refuses supplier-bank snapshot creation if any detail page still fails
  - blocks partial snapshots from remote `--write-bank`
- Completed a clean confirmed full WMD refresh after retry hardening:
  - refresh key: `20260703-014857`
  - scrape run id: `8e8e417a-3305-4a88-988b-c11ed046891c`
  - price snapshot id: `93245d78-d7cf-4ec4-91b6-6df1968f1766`
  - failed detail pages: `0`
  - normalized rows: `18,800`
  - stored snapshots for `wmd-folder-bank`: `3`
- Created the second full-bank draft price delta review:
  - review id: `1756f5d0-48c5-4012-8949-a4726e4efe99`
  - old snapshot id: `aca951d0-6963-400d-8509-d8995cdc3bf2`
  - new snapshot id: `93245d78-d7cf-4ec4-91b6-6df1968f1766`
  - changed/added/removed rows: `78/380/240`
  - unchanged rows: `18,342`
  - net changed-row delta: `12,207 DKK`
- Added read-only WMD refreshed-bank review command:
  - command: `node scripts/supplier-bank-cli.mjs review-wmd-refresh`
  - package alias: `supplier-bank:review-wmd`
  - current decision: existing imported draft has `18,660` rows, latest bank snapshot has `18,800` rows
  - recommendation: keep draft unpublished until latest delta review is accepted
- Added guarded WMD delta-review status transition command:
  - command: `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed`
  - package preview alias: `supplier-bank:review-wmd:mark-reviewed:preview`
  - preview confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` is still `draft`
  - allowed workflow is `draft -> reviewed -> accepted/rejected`
  - no supplier scrape, product import, publishing, or live pricing writes
- Added supplier-bank CLI timeout guards:
  - `SUPPLIER_BANK_CLI_TIMEOUT_MS` controls the process-level deadline, default `120000`
  - `SUPPLIER_BANK_SUPABASE_TIMEOUT_MS` controls direct Supabase request aborts where supported, default `30000`
  - this prevents remote supplier-bank commands from hanging indefinitely when Supabase/database requests stall
- Attempted to advance the latest WMD delta review to `reviewed`:
  - command: `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed --confirm-status-update`
  - result: timed out before Supabase returned a database response
  - direct keyed Supabase REST verification also timed out after `90` seconds
  - Supabase connector `_execute_sql` returned `Connection terminated due to connection timeout`
  - current remote status should be treated as unchanged until a successful read-back proves otherwise
- Added linked-Supabase SQL fallback files for the WMD review step:
  - DB health: `scripts/sql/supabase-db-health.sql`
  - read-only state: `scripts/sql/wmd-latest-delta-review-state.sql`
  - guarded transition: `scripts/sql/wmd-mark-latest-delta-review-reviewed.sql`
  - both are scoped to WIRmachenDRUCK `wmd-folder-bank` and only touch/read supplier-bank review rows
- Added package aliases for the SQL fallback:
  - `supplier-bank:db-health:sql`
  - `supplier-bank:wmd-review-state:sql`
  - `supplier-bank:wmd-review-mark-reviewed:sql`
- Supabase restore/resume check reported project `ACTIVE_HEALTHY`, but database SQL still returned connection timeouts.
- Retried after the database recovered:
  - `supplier-bank:db-health:sql` returned `db_time = 2026-07-03 00:22:11.01956+00`
  - `supplier-bank:wmd-review-state:sql` confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` was `draft`
  - `supplier-bank:wmd-review-mark-reviewed:sql` updated only that review to `reviewed`
  - fresh read-back confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` is `reviewed`, updated at `2026-07-03 00:22:27.32231+00`
- Added guarded SQL and package alias for the next business-decision step:
  - SQL: `scripts/sql/wmd-accept-latest-delta-review.sql`
  - alias: `supplier-bank:wmd-review-accept:sql`
  - only allows `reviewed -> accepted` on the latest WMD bank review row
- Added additive supplier-bank refresh queue:
  - migration: `supabase/migrations/20260703003500_supplier_bank_refresh_queue.sql`
  - table: `supplier_bank_refresh_jobs`
  - explicit Data API grants and master-admin RLS included
  - queue rows are audit/request records only; they do not scrape, create snapshots, import products, publish products, or write live prices by themselves
- Added admin UI refresh queue controls:
  - reads recent `supplier_bank_refresh_jobs`
  - shows active refresh request count
  - lets admins enqueue a bank-only price refresh request per product
  - disables duplicate queue requests while a product has `queued` or `running` refresh job
- Applied and recorded refresh-queue migration remotely:
  - `node scripts/supabase-cli.mjs db query --linked --file supabase/migrations/20260703003500_supplier_bank_refresh_queue.sql`
  - `node scripts/supabase-cli.mjs migration repair --linked --status applied 20260703003500`
- Queued first WMD refresh request:
  - refresh job id: `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`
  - bank product id: `891a5cf1-7884-4344-9bab-8071c38b6443`
  - status: `queued`
  - tool: `playwright`
- Added refresh queue processor CLI:
  - command: `node scripts/supplier-bank-cli.mjs process-refresh-queue`
  - package preview alias: `supplier-bank:process-refresh-queue:preview`
  - preview-only by default
  - first supported worker scope: WIRmachenDRUCK `wmd-folder-bank` `price_refresh`
  - confirmed mode marks a queue job `running`, calls the existing fail-closed `refresh-wmd-bank --confirm-bank-write`, creates the next delta review from the two latest normalized snapshots, and marks the queue job `succeeded` or `failed`
  - confirmed mode still does not import products, publish products, or write live storefront pricing
- Verified refresh queue processor preview against queued WMD job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`.
- Ran the confirmed refresh queue processor against the queued WMD job using the
  stored clean WMD CSV, so no fresh supplier scrape was needed for this worker
  proof:
  - command: `node scripts/supplier-bank-cli.mjs process-refresh-queue --confirm-process --from-clean-csv pricing_clean/wmd-folder-bank/20260703-014857.csv`
  - refresh job id: `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`
  - queue status after read-back: `succeeded`
  - new normalized snapshot: `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-024236.json`
  - new supplier-bank price snapshot id: `aabc6392-d662-4e4c-b0f4-94fcb7cc5f18`
  - new delta review id: `11888446-b2c1-417e-932b-fb43eef09a24`
  - initial delta review status: `draft`
  - changed/added/removed rows: `0/0/0`
  - latest imported draft `wmd-folder-bank-20260703` still has `18,800` rows and matches the latest bank snapshot
  - no product import, publishing, or live storefront pricing write was performed by the queue processor
- Moved the zero-change queue delta review through the normal guarded review
  workflow:
  - review id: `11888446-b2c1-417e-932b-fb43eef09a24`
  - transition 1: `draft -> reviewed`
  - transition 2: `reviewed -> accepted`
  - accepted read-back: `2026-07-03T00:46:50.433+00:00`
  - changed/added/removed rows remained `0/0/0`
  - no product import, publishing, or live storefront pricing write was performed
- Added current status note:
  - `docs/SUPPLIER_PRODUCT_BANK_WMD_FULL_STATUS_2026-07-02.md`

## Goal Checklist

- [x] Define supplier-bank architecture separate from POD v1/POD v2.
- [x] Add master-admin supplier-bank schema plan.
- [x] Add migration for suppliers, products, price snapshots, scrape runs, and import jobs.
- [x] Add explicit Data API grants and master-admin RLS.
- [x] Add shared supplier-bank types and product family taxonomy.
- [x] Add read-only `/admin/supplier-bank` browser shell.
- [x] Add supplier-bank skill/runbook.
- [x] Add external supplier-source registry with internal-domain exclusions.
- [x] Add CLI validation for supplier sources before scraping.
- [x] Add guarded supplier-source seed command, dry-run by default.
- [x] Add read-only supplier-source remote verification command.
- [x] Add no-write WMD pilot smoke command for local end-to-end readiness.
- [x] Add no-write WMD pilot local preflight command for smoke, Deno, and
  Supabase policy gates.
- [x] Add snapshot-only supplier-bank CLI.
- [x] Add supplier-bank CLI readiness/doctor command.
- [x] Add guarded WMD remote apply command that previews by default and
  requires explicit confirmation before remote writes.
- [x] Add no-write remote verification command for the WMD supplier-bank pilot.
- [x] Prove an external WMD folder extraction can write normalized bank snapshots without live product/pricing writes.
- [x] Add a DB write mode for WMD folder bank snapshots, guarded by `--bank-snapshot-only`.
- [x] Add review/approve/archive status controls for supplier-bank products.
- [x] Add read-only dry-run import preview.
- [x] Add guarded CLI preview/write path for draft Matrix Layout product imports from normalized snapshots.
- [x] Add manual normalized-snapshot price delta review.
- [x] Add schema and guarded CLI write option for storing price delta reviews.
- [x] Show stored price delta reviews in admin browser with review status controls.
- [x] Add explicit admin UI/Edge Function import button that creates draft products only.
- [x] Add admin UI/Edge Function action that creates draft price-delta reviews from stored snapshots.
- [x] Show recent supplier-bank import jobs in the admin browser.
- [x] Apply the supplier-bank migration to the target Supabase project.
- [x] Seed supplier registry rows into `supplier_bank_suppliers`.
- [x] Run the WMD folder bank writer against Supabase after the migration is applied.
- [x] Show stored supplier-bank records in the admin browser.
- [x] Import the full WMD folder bank as an unpublished draft Matrix Layout product.
- [x] Create the first full WMD draft price review from the latest two stored snapshots.
- [x] Add focused full WMD supplier-bank refresh preview/write command after initial setup.
- [x] Fail closed when a live WMD refresh has skipped/partial supplier detail pages.
- [x] Complete a fresh full WMD refresh after supplier pages return cleanly, then create the next delta review.
- [x] Add read-only refreshed WMD review command and confirm current draft is behind the latest bank snapshot.
- [x] Add guarded CLI preview/write path for WMD delta-review status transitions.
- [x] Add timeout guard so supplier-bank remote commands do not hang indefinitely.
- [x] Add exact linked-Supabase SQL fallback files for WMD review state read-back and `draft -> reviewed`.
- [x] Add package aliases for DB health, WMD review read-back, and guarded mark-reviewed SQL.
- [x] Successfully move latest WMD delta review from `draft` to `reviewed` and verify with a fresh read-back.
- [x] Add guarded SQL/package alias for the next `reviewed -> accepted` decision.
- [x] Accept latest WMD delta review, create refreshed unpublished 18,800-row draft, and verify with read-back.
- [x] Add admin supplier refresh queue action/table so refresh requests are auditable and do not silently change products/prices.
- [x] Add a guarded CLI processor preview/confirmed path for queued WMD refresh jobs.
- [x] Run/QA the confirmed queue processor once for WMD using a stored clean CSV and verify the queue row, snapshot, and zero-change draft delta review.
- [x] Accept the zero-change queue delta review through the guarded `draft -> reviewed -> accepted` workflow.
- [x] Add a read-only next-expansion planner that ranks supplier/family backlog from current registry coverage and import guards.
- [x] Add guarded Pixart safe-baseline restore preview command for the rejected latest 90-row snapshot.
- [ ] Choose the next external supplier/product family and generalize the queue worker beyond WMD folders.

## Recommended Next Expansion

Use Pixartprinting as the next supplier-bank expansion candidate for
wide-format products before Print.com bridging.

Reasoning:

- Pixartprinting is already listed as a candidate external supplier in
  `config/supplier-bank/sources.json`.
- It covers product families that broaden the bank beyond WMD folders:
  `posters`, `banners`, `signs`, `rollups`, `stickers`, and `labels`.
- The repo already has a dedicated Pixart skill and script:
  - `.agents/skills/pixart/SKILL.md`
  - `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
- `AGENTS.md` explicitly says to reuse the Pixart skill/script for Pixart
  wide-format imports and not create a parallel import flow.

Safe first Pixart slice:

1. Pick one Pixart profile, preferably `flat-surface-adhesive`.
2. Run a no-write probe against the chosen Pixart URL.
3. Run a limited extraction into local raw/CSV files only.
4. Normalize the extracted rows into supplier-bank snapshot shape.
5. Do not create or publish Webprinter products in the first Pixart bank slice.
6. After review, add a guarded bank-only write path that mirrors the WMD
   supplier-bank boundaries: supplier-bank scrape run, bank product, price
   snapshot, and draft delta review only.
7. Only after bank review should Pixart data be converted into a draft
   storformat product.

Current Pixart first-slice preview command:

```bash
node scripts/supplier-bank-cli.mjs pixart-bank-first-slice
```

Package alias:

```bash
npm run supplier-bank:pixart-first-slice:preview
```

The preview wrapper defaults to headful browser mode for Pixart because the
flat-surface quote grid was unavailable in headless mode during testing. It
still performs local-only work.

Earlier headless local run on 2026-07-03:

- Supplier-source registry validation passed.
- Pixart probe succeeded for the default `flat-surface-adhesive` URL.
- Probe found the Pixart page title, material options, lamination options,
  width/height inputs, and custom quantity input.
- Tiny extraction attempted `1` material, `1` lamination, `1` area, and `3`
  quantities.
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T00-56-55-442Z.json`
- Attempted rows: `3`
- Valid priced rows: `0`
- Error counts: `{"quantity-row-not-found":3}`
- Bank write ready: `no`
- No supplier-bank rows, products, published products, or live prices were
  written.
- Safety fix added after this run: Pixart dry-run import now treats `null` and
  empty price fields as invalid, so a failed extraction artifact with zero valid
  priced rows is refused instead of being interpreted as zero-price rows.

Latest headful local run on 2026-07-03:

- Command: `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice`
- Browser mode: `headful`
- Supplier-source registry validation passed.
- Pixart probe succeeded for the default `flat-surface-adhesive` URL.
- Probe found `9` material options, `5` lamination options, width/height
  inputs, custom quantity input, quantity buttons, and the price grid.
- Tiny extraction attempted `1` material, `1` lamination, `1` area, and `3`
  quantities.
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-03-23-032Z.json`
- Attempted rows: `3`
- Valid priced rows: `3`
- Error counts: `{"none":3}`
- Bank write ready: `yes`
- Local supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-010323.json`
- Preview summary:
  - product key: `pixart-flat-surface-adhesive`
  - product family: `stickers`
  - rows: `3`
  - quantities: `1-3`
  - DKK range: `183.59-550.62`
- Pixart storformat dry-run import accepted the successful extraction artifact.
- No supplier-bank database rows, products, published products, or live prices
  were written.

Conclusion: Pixart is the correct next expansion candidate and the first
bank-safe local slice now works. The next step is to extend this from a tiny
local preview into a guarded Pixart bank snapshot writer, still without
creating or publishing Webprinter products.

Guarded Pixart bank snapshot writer added:

```bash
node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot <preview.json>
```

Package preview alias:

```bash
npm run supplier-bank:pixart-write:preview -- <preview.json>
```

The writer is preview-only by default. The confirmed path requires
`--write-bank` and writes only supplier-bank staging rows.

Confirmed Pixart bank-only write on 2026-07-03:

- Command:
  `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-010323.json --write-bank`
- Supplier id: `5128e6e3-8e15-486d-aea3-08aa49155c2f`
- Supplier enabled state preserved: `false`
- Scrape run id: `9cdecb49-ad24-4ce1-97ca-20698865f297`
- Bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
- Bank product key: `pixart-flat-surface-adhesive`
- Bank product status: `draft`
- Product family: `stickers`
- Price snapshot id: `8c5fcf2b-2c70-41b3-98cf-1cd6dd1cc98d`
- Normalized rows: `3`
- Quantities: `1-3`
- DKK range: `183.59-550.62`
- Checksum:
  `4dd1cf39fecdcc941d5f0c26e4fffbfa8d77690d5f9fc50b4ba991819e600aba`
- Read-back confirmed the row in Supabase with `scrape_status = fresh`.
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Pixart larger staged slice on 2026-07-03:

- Command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 1 --limit-laminations 2 --limit-areas 2 --limit-quantities 4 --require-valid-rows`
- Browser mode: `headful`
- Extraction artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-13-59-255Z.json`
- Local supplier-bank normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-011359.json`
- Attempted rows: `16`
- Valid priced rows: `16`
- Error counts: `{"none":16}`
- Confirmed bank-only write:
  - supplier id: `5128e6e3-8e15-486d-aea3-08aa49155c2f`
  - supplier enabled state preserved: `false`
  - scrape run id: `72bb4687-33db-4df1-b886-4a6538b88848`
  - bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
  - bank product status: `draft`
  - price snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - checksum:
    `de82c4190947e9c7caef3e97c4d0a8ed8c43c41b268f8cc12427501becf68136`
- `compare-normalized-snapshots` now supports both WMD camelCase snapshots and
  Pixart supplier-bank preview snapshots with snake_case row fields.
- Draft delta review created:
  - review id: `47219880-cfb2-48ce-8adc-56a54c304c75`
  - old snapshot id: `8c5fcf2b-2c70-41b3-98cf-1cd6dd1cc98d`
  - new snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - old/new rows: `3/16`
  - added rows: `13`
  - changed rows: `0`
  - removed rows: `0`
- Supabase read-back confirmed:
  - supplier slug: `pixartprinting`
  - supplier enabled: `false`
  - product family: `stickers`
  - product status: `draft`
  - scrape status: `fresh`
  - stored snapshots: `2`
  - latest snapshot rows: `16`
  - latest review status: `draft`
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Pixart review tooling added after the second staged snapshot:

- Read-only review command:
  `node scripts/supplier-bank-cli.mjs review-pixart-refresh`
- Package alias:
  `npm run supplier-bank:review-pixart`
- Preview-only status transition:
  `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-pixart --status reviewed`
- Package preview alias:
  `npm run supplier-bank:review-pixart:mark-reviewed:preview`
- The review command reads only supplier-bank suppliers/products/snapshots,
  delta reviews, and import-job audit rows.
- The status command remains guarded by `--confirm-status-update` and may
  update only `supplier_bank_price_delta_reviews.status` and `updated_at`.
- No scraping, product import, publishing, or live pricing writes are performed
  by these review commands.

Pixart quality-gated 45-row staged slice on 2026-07-03:

- Previous Pixart delta review
  `47219880-cfb2-48ce-8adc-56a54c304c75` was moved from `draft` to
  `reviewed` with:
  `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-pixart --status reviewed --confirm-status-update`
- Flat-surface extraction now waits for stable grid reads after dimension and
  quantity changes.
- Pixart bank preview validation now refuses:
  - partial extractions where any attempted row failed
  - duplicate price series across different areas for the same material/finish
- Rejected local-only previews:
  - `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012312.json`
    because area price series were duplicated/stale
  - `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012639.json`
    because the source extraction was partial (`30/45` valid rows)
- Clean retry command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 1 --limit-laminations 3 --limit-areas 3 --limit-quantities 5 --require-valid-rows`
- Clean raw artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-28-57-997Z.json`
- Clean normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`
- Attempted/valid rows: `45/45`
- Confirmed bank-only write:
  - supplier id: `5128e6e3-8e15-486d-aea3-08aa49155c2f`
  - supplier enabled state preserved: `false`
  - scrape run id: `9a1b1292-c387-48a1-b7bc-6c5296574a46`
  - bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
  - bank product status: `draft`
  - price snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - checksum:
    `108e72bfa732e7dc86ee3e351d7d186d66c74238c0ffb5c1e24c3e72c025395d`
- Draft delta review created:
  - review id: `77d1dace-1493-4b0a-98cb-2423d01aded7`
  - old snapshot id: `0363ad13-d9ab-474b-a77c-11f8ac0490b6`
  - new snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - old/new rows: `16/45`
  - added rows: `29`
  - changed rows: `0`
  - removed rows: `0`
- Supabase read-back confirmed:
  - supplier slug: `pixartprinting`
  - supplier enabled: `false`
  - product status: `draft`
  - scrape status: `fresh`
  - stored snapshots: `3`
  - latest snapshot rows: `45`
  - latest review status: `draft`
  - previous review status: `reviewed`
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Next Pixart step: review the draft `16 -> 45` delta and mark it `reviewed` if
the added rows look right, then expand cautiously to the next dimension
(probably one more material or one more lamination), keeping the same quality
gates before any draft storformat product conversion.

Pixart two-material staged slice on 2026-07-03:

- Previous Pixart delta review
  `77d1dace-1493-4b0a-98cb-2423d01aded7` was moved from `draft` to
  `reviewed` with:
  `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-pixart --status reviewed --confirm-status-update`
- The supplier-bank wrapper now retries the Pixart extraction subprocess once
  with a fresh browser session if it fails before producing an artifact.
- The Pixart extractor now waits for flat-surface material/lamination radio
  inputs before failing, which prevents transient page-load states from
  breaking the first combo setup.
- Rejected local-only two-material artifact:
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-35-31-287Z.json`
  - attempted/valid rows: `90/74`
  - result: no normalized preview, no bank write
- Clean retry command:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 2 --limit-laminations 3 --limit-areas 3 --limit-quantities 5 --require-valid-rows`
- Clean raw artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-38-23-443Z.json`
- Clean normalized preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-013823.json`
- Attempted/valid rows: `90/90`
- Confirmed bank-only write:
  - supplier id: `5128e6e3-8e15-486d-aea3-08aa49155c2f`
  - supplier enabled state preserved: `false`
  - scrape run id: `cc2ff1ca-ae2f-48c9-946a-e63ba1d54e22`
  - bank product id: `ec44179a-b165-475f-b9d2-2b48e635fff7`
  - bank product status: `draft`
  - price snapshot id: `6b44be25-4128-45f1-948d-9019f8b8e025`
  - checksum:
    `a289749ea47c1b0fde7f91966b7d1978ff2c348305e2f298d246f9a324d31fa2`
- Draft delta review created:
  - review id: `a5cf2712-7ad7-42e5-9dd2-1690f35f64c1`
  - old snapshot id: `d4f0cf21-fac4-4dd8-8821-3130024f887e`
  - new snapshot id: `6b44be25-4128-45f1-948d-9019f8b8e025`
  - old/new rows: `45/90`
  - added rows: `45`
  - changed rows: `0`
  - removed rows: `0`
- Supabase read-back confirmed:
  - supplier slug: `pixartprinting`
  - supplier enabled: `false`
  - product status: `draft`
  - scrape status: `fresh`
  - stored snapshots: `4`
  - latest snapshot rows: `90`
  - latest review status: `draft`
  - previous review status: `reviewed`
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Pixart stricter quality rejection on 2026-07-03:

- The `45 -> 90` delta review
  `a5cf2712-7ad7-42e5-9dd2-1690f35f64c1` was briefly moved to `reviewed`,
  then moved to `rejected` after a stricter validation pass found stale finish
  and area series in the wider Pixart data.
- The previously stored 90-row preview
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-013823.json`
  now fails the stricter finish-series quality gate because `None` matches
  paid finishes for one material.
- The previously stored 45-row preview
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`
  passes the current refined validation.
- The 16-row preview
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-011359.json`
  also passes the current Pixart supplier-bank validation.
- Three-material expansion was attempted with:
  `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --limit-materials 3 --limit-laminations 3 --limit-areas 3 --limit-quantities 5 --require-valid-rows`
- First three-material artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-47-06-080Z.json`
  was rejected as partial (`120/135` valid rows).
- The supplier-bank wrapper was fixed so partial Pixart artifacts are retried
  once with a fresh browser session, not only extractor process failures.
- Retry artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-51-45-293Z.json`
  reached `135/135` valid rows but was rejected by the duplicate area-series
  quality gate; its local normalized preview
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-015145.json`
  must not be written to supplier-bank tables.
- The Pixart preview validator now rejects duplicate quote series where `None`
  matches a paid finish for the same material/area, in addition to duplicate
  quote series across different areas for the same material/finish. Equal
  Standard Matt and Standard Gloss price series are allowed because suppliers
  may price those finishes identically.
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Next Pixart step: keep Pixart as a disabled/candidate supplier and do not
convert the 90-row snapshot into products. Fix the Pixart option
application/verification so selected material and lamination states are proven
before reading quotes, then rerun from the passing 45-row baseline and expand
one dimension at a time.

Pixart extraction hardening follow-up on 2026-07-03:

- The flat-surface extractor now verifies that the requested visible radio
  option is selected, rather than accepting any hidden input with the same
  value.
- The flat-surface extractor now treats unchanged quote-grid signatures after
  dimension changes as stale data.
- The supplier-bank Pixart wrapper now forwards explicit `--materials` and
  `--laminations` overrides to the Pixart extractor, so targeted material
  expansion can avoid known-problem materials.
- Rejected no-write default two-material artifacts after the selector/grid
  hardening:
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T01-59-29-640Z.json`
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-02-30-078Z.json`
  - `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-05-43-897Z.json`
  - related rejected previews:
    `20260703-015929.json`, `20260703-020230.json`,
    `20260703-020543.json`
- The default second material, `Gloss Monomeric Self-Adhesive Vinyl`, still
  fails the finish-series gate because `None` matches paid finishes.
- A targeted material override was tested:
  `--materials "Matt Monomeric Self-Adhesive Vinyl,Matt Monomeric Self-Adhesive Vinyl with Grey Back"`
- Targeted raw artifact:
  `pricing_raw/pixart-flat-surface-adhesive-2026-07-03T02-09-31-124Z.json`
  reached `90/90` valid rows but was rejected because
  `Matt Monomeric Self-Adhesive Vinyl with Grey Back` also has `None` matching
  paid finishes.
- Rejected targeted local preview:
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-020931.json`
  must not be written to supplier-bank tables.
- The current safe Pixart baseline remains
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`
  (`45` rows: one material, three finishes, three areas, five quantities).
- No Webprinter product was created, no product was published, and no live
  storefront pricing was written.

Pixart recovery guidance added on 2026-07-03:

- `node scripts/supplier-bank-cli.mjs review-pixart-refresh` now scans local
  Pixart supplier-bank preview JSON files with the same quality gates used by
  `write-pixart-bank-snapshot`.
- Added guarded recovery command:
  `node scripts/supplier-bank-cli.mjs restore-pixart-safe-baseline`
  - package preview alias:
    `supplier-bank:pixart-restore-safe-baseline:preview`
  - preview-only by default
  - refuses to run unless the latest Pixart delta review is `rejected` and
    targets the latest remote snapshot
  - confirmed recovery requires explicit `--write-bank --write-delta-review`
  - confirmed recovery writes only a restored supplier-bank price snapshot and
    a draft recovery delta review
  - no supplier scrape, Webprinter product creation, publishing, or live
    storefront pricing write is performed
- Pixart safe-baseline recovery was executed bank-only on 2026-07-03:
  - restored safe snapshot ID: `476e02a8-6f18-4505-905e-6df328ea22fb`
  - recovery review ID: `86e083c4-28c9-4274-a84f-c316482e9265`
  - recovery review moved through `draft -> reviewed -> accepted`
  - Pixart bank product `pixart-flat-surface-adhesive` was approved in the
    supplier bank only
  - Pixart supplier remains disabled/candidate
  - no Webprinter product was created, no product was published, and no live
    storefront pricing was written
- `node scripts/supplier-bank-cli.mjs plan-next-expansion` now points Pixart
  blocked-product recovery to `restore-pixart-safe-baseline` instead of asking
  for another first-slice extraction.
- `/admin/supplier-bank` supplier coverage and product next-action guidance
  now points blocked Pixart products to the safe-baseline restore preview path
  instead of generic price-review wording.
- Added read-only Print.com bridge planner:
  `node scripts/supplier-bank-cli.mjs plan-print-com-bank-slice`
  - package alias: `supplier-bank:print-com-plan-first-slice`
  - validates the supplier-source registry and reads current Print.com bank
    coverage
  - defaults to the first registered Print.com family, currently `flyers`,
    unless `--family` is supplied
  - reuses POD v2 API knowledge only as a credential-safe catalog bridge
  - writes no supplier-bank rows, no POD v2 rows, no products, no publishing
    changes, and no live storefront pricing
  - the next real adapter step after this planner should save local raw and
    normalized preview JSON under
    `pricing_raw/supplier-bank-normalized/print-com/` before any bank write
    exists
- Added local-only Print.com catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family flyers`
  - package alias: `supplier-bank:print-com-first-slice:preview`
  - reads the active POD/POD2 Print.com connection and calls catalog/detail
    endpoints only
  - writes local raw and normalized preview JSON under
    `pricing_raw/supplier-bank-*/print-com/flyers/`
  - does not write supplier-bank rows, POD v2 rows, products, publishing
    changes, or live storefront pricing
  - first successful preview on 2026-07-03 listed `855` Print.com products,
    found `1` flyer candidate (`flyers`), fetched detail successfully, and
    detected `25` attribute groups / `234` options
  - preview remains not bank-write-ready until price rows and quality gates are
    added
- Added local-only Print.com folders catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family folders --limit 60 --details-limit 8`
  - package alias: `supplier-bank:print-com-folders-first-slice:preview`
  - writes local raw and normalized preview JSON under
    `pricing_raw/supplier-bank-*/print-com/folders/`
  - 2026-07-03 preview listed `855` Print.com products, found `7` folder
    candidates, and fetched details for `7/7`
  - candidates included `presentation-folders` (sales-folder style, A4/A5
    spine options and business-card slits) and `folders` (folded leaflets)
  - preview path:
    `pricing_raw/supplier-bank-normalized/print-com/folders/20260703-054233.json`
  - no supplier-bank rows, POD v2 rows, products, publishing changes, or live
    storefront pricing were written
- Added local-only Print.com business-card catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family business_cards --limit 20 --details-limit 8`
  - package alias:
    `supplier-bank:print-com-business-cards-first-slice:preview`
  - expanded the Print.com business-card keyword matcher to include
    `businesscard` / `businesscards`, because the standard SKU has no space
  - 2026-07-03 preview listed `855` Print.com products, found `4`
    business-card candidates, and fetched details for `4/4`
  - candidates: `businesscard-boxes`, `businesscards`,
    `multiloft-businesscards`, and `luxurious-businesscards`
  - preview path:
    `pricing_raw/supplier-bank-normalized/print-com/business_cards/20260703-055011.json`
  - no supplier-bank rows, POD v2 rows, products, publishing changes, or live
    storefront pricing were written by the discovery preview
- Added local-only Print.com letterhead catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family letterheads --limit 30 --details-limit 10`
  - package alias: `supplier-bank:print-com-letterheads-first-slice:preview`
  - 2026-07-03 preview listed `855` Print.com products, found `1`
    letterhead candidate, and fetched details for `1/1`
  - candidate: `printed-letterheads`
  - preview path:
    `pricing_raw/supplier-bank-normalized/print-com/letterheads/20260703-055407.json`
  - no supplier-bank rows, POD v2 rows, products, publishing changes, or live
    storefront pricing were written by the discovery preview
- Added local-only Print.com packaging catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family packaging --limit 80 --details-limit 12`
  - package alias:
    `supplier-bank:print-com-packaging-first-slice:preview`
  - 2026-07-03 preview listed `855` Print.com products, found `33`
    packaging candidates, and fetched details for `12/12`
  - first simple priced candidate selected: `businesscard-boxes`
  - other probed candidates (`burger-boxes`, `slider-boxes`, and
    `wineboxes-pet-felt`) rejected normal `copies` values because they appear
    to require hidden/product-specific copy-range rules, so they must remain
    catalog-only until that rule is understood
  - preview path:
    `pricing_raw/supplier-bank-normalized/print-com/packaging/20260703-060020.json`
  - no supplier-bank rows, POD v2 rows, products, publishing changes, or live
    storefront pricing were written by the discovery preview
- Added local-only Print.com flyer price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --family flyers --sku flyers`
  - package alias: `supplier-bank:print-com-price-preview`
  - uses the active POD/POD2 Print.com connection and the batch price endpoint
    for a tiny explicit flyer configuration
  - writes local raw and normalized price preview JSON under
    `pricing_raw/supplier-bank-*/print-com/flyers/prices/`
  - does not write supplier-bank rows, POD v2 rows, products, publishing
    changes, or live storefront pricing
  - added named policy `flyers-core-a5-130gsm-gloss` for the first safe flyer
    slice: `flyers`, `A5`, `130gsm gloss`, `4/0`, no finish, digital printing,
    `bundle_per_100`, DK/DKK, quantities `10/50/100/250`
  - the named policy preview on 2026-07-03 produced `4/4` valid rows with DKK
    prices `194.88`, `207.40`, `222.87`, and `271.08`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/flyers/prices/20260703-053047.json`
  - the preview is marked bank-write-ready only when that named policy and the
    quality gates pass
- Added local-only Print.com sales-folder price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy presentation-folders-a4-1mm-slits-300gsm-gloss`
  - package alias: `supplier-bank:print-com-sales-folder-price-preview`
  - named policy covers `presentation-folders`, A4 1 mm spine with
    business-card slits, 300gsm gloss, 4/0, punched contour, no lamination,
    digital print, standard urgency, DK/DKK, quantities `10/50/100/250`
  - 2026-07-03 policy preview produced `4/4` valid rows with DKK prices
    `786.55`, `934.75`, `1120.01`, and `1675.71`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/folders/prices/20260703-054442.json`
  - `write-print-com-bank-snapshot` preview accepted the file: rows `4`,
    quantities `10-250`, DKK range `786.55-1675.71`, option signatures `1`
  - this preview was written to supplier-bank tables and approved on
    2026-07-03 as a bank-only product:
    - bank product ID: `f919f4c7-2dc5-458d-81a0-31647cadd5c0`
    - price snapshot ID: `abb777e0-2d3f-409c-b7ea-991d77d2d102`
    - scrape run ID: `afce7290-c0d3-4aee-a04e-f71d9dee5942`
    - checksum:
      `5c7aab61fac8289809a0a802df3f87e105b1d6a083433b34ecedf1a3f3eef3c6`
    - supplier enabled preserved as `no` / candidate
    - bank product status: `approved`
  - read-only draft-import preview is safe for explicit admin import:
    draft slug `presentation-folders-f919f4c7`, no existing target slug,
    `4/4` rows map to `generic_product_prices`, quantities `10/50/100/250`,
    DKK range `786.55-1675.71`, and customer-facing groups are trimmed to
    Materiale plus `size`, `printtype`, and `finish`
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added local-only Print.com standard business-card price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy businesscards-standard-85x55-300gsm-gloss`
  - package alias: `supplier-bank:print-com-business-card-price-preview`
  - named policy covers `businesscards`, 85 x 55 mm horizontal, 300gsm gloss,
    4/0, no lamination, no special finish, default business-card delivery,
    digital print, `bundle_per_50`, DK/DKK, quantities `25/50/100/250`
  - 2026-07-03 policy preview produced `4/4` valid rows with DKK prices
    `196.82`, `202.46`, `210.09`, and `225.97`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/business_cards/prices/20260703-055110.json`
  - `write-print-com-bank-snapshot` preview accepted the file: rows `4`,
    quantities `25-250`, DKK range `196.82-225.97`, option signatures `1`
  - this preview was written to supplier-bank tables and approved on
    2026-07-03 as a bank-only product:
    - bank product ID: `ee38a8ad-1e7c-4e6c-9e2d-f8a3dd6a4aef`
    - price snapshot ID: `12284622-173c-4ffc-b3cb-b7deb21aae75`
    - scrape run ID: `4c951646-ccd0-4b15-b18a-4e295d0f9726`
    - checksum:
      `b20e07511b42c7ea0f40346df483ea4ddd446f7952bd7be8f1f947a8fb57ee94`
    - supplier enabled preserved as `no` / candidate
    - bank product status: `approved`
  - read-only draft-import preview is safe for explicit admin import:
    draft slug `businesscards-ee38a8ad`, no existing target slug, `4/4`
    rows map to `generic_product_prices`, quantities `25/50/100/250`, DKK
    range `196.82-225.97`, and customer-facing groups are trimmed to
    Materiale plus `printtype`, `finish`, and `size`
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added local-only Print.com A4 letterhead price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy letterheads-a4-90gsm-4-0`
  - package alias: `supplier-bank:print-com-letterhead-price-preview`
  - named policy covers `printed-letterheads`, A4, 90gsm uncoated premium
    white, 4/0, digital print, standard delivery, `bundle_per_100`, DK/DKK,
    quantities `100/150/200/250`
  - low `25/50` quantities are intentionally excluded because Print.com's total
    price response decreases between some low quantities for this configuration
  - 2026-07-03 policy preview produced `4/4` valid rows with DKK prices
    `676.51`, `721.50`, `762.88`, and `807.80`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/letterheads/prices/20260703-055604.json`
  - `write-print-com-bank-snapshot` preview accepted the file: rows `4`,
    quantities `100-250`, DKK range `676.51-807.8`, option signatures `1`
  - this preview was written to supplier-bank tables and approved on
    2026-07-03 as a bank-only product:
    - bank product ID: `9669dc1c-5228-47ef-aae5-88fa0700fbc8`
    - price snapshot ID: `be86a2d1-79ea-4182-9074-a34da67a9c02`
    - scrape run ID: `f3048781-ca4b-4cb9-a074-2a4253e2b118`
    - checksum:
      `ef3c09b0bde1c1a03201b2a8b4eaaf15cf41a7870732053f6bcdba4031ed5658`
    - supplier enabled preserved as `no` / candidate
    - bank product status: `approved`
  - read-only draft-import preview is safe for explicit admin import:
    draft slug `printed-letterheads-9669dc1c`, no existing target slug, `4/4`
    rows map to `generic_product_prices`, quantities `100/150/200/250`, DKK
    range `676.51-807.8`, and customer-facing groups are trimmed to Materiale
    plus `size` and `printtype`
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added local-only Print.com packaging price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy businesscard-boxes-90x60x60-unprinted`
  - package alias: `supplier-bank:print-com-packaging-price-preview`
  - named policy covers `businesscard-boxes`, 90 x 60 x 60 mm unprinted
    business-card boxes, 300gsm Duplex White, raw-material/unprinted
    production, standard urgency, DK/DKK, quantities `10/25/50`
  - `100+` quantities are intentionally excluded because Print.com rejects
    them for this configuration
  - 2026-07-03 policy preview produced `3/3` valid rows with DKK prices
    `101.09`, `252.79`, and `505.71`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/packaging/prices/20260703-060356.json`
  - `write-print-com-bank-snapshot` preview accepted the file: rows `3`,
    quantities `10-50`, DKK range `101.09-505.71`, option signatures `1`
  - this preview was written to supplier-bank tables and approved on
    2026-07-03 as a bank-only product:
    - bank product ID: `cb5b6871-1a2b-4c91-b2c1-75a4142c9712`
    - price snapshot ID: `a71987cc-9ba3-4000-9623-fba4ca04981e`
    - scrape run ID: `581d1016-04c6-4f0d-9100-cfa07bda91c1`
    - checksum:
      `3597b2cb16f516f9b16d3c712691f4fbd0ff27f29bd40fc844c351601818894b`
    - supplier enabled preserved as `no` / candidate
    - bank product status: `approved`
  - read-only draft-import preview is safe for explicit admin import:
    draft slug `businesscard-boxes-cb5b6871`, no existing target slug, `3/3`
    rows map to `generic_product_prices`, quantities `10/25/50`, DKK range
    `101.09-505.71`, and customer-facing groups are trimmed to Materiale plus
    `printtype` and `size`
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added local-only Print.com t-shirt catalog discovery preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family tshirts --limit 80 --details-limit 16`
  - package alias:
    `supplier-bank:print-com-tshirts-first-slice:preview`
  - 2026-07-03 preview listed `855` Print.com products, found `32`
    t-shirt candidates, and fetched details for `16/16`
  - first simple priced candidate selected: `t-shirt-basic-7`
    (Russell Classic T-shirt)
  - preview path:
    `pricing_raw/supplier-bank-normalized/print-com/tshirts/20260703-060635.json`
  - no supplier-bank rows, POD v2 rows, products, publishing changes, or live
    storefront pricing were written by the discovery preview
- Added local-only Print.com t-shirt price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy tshirt-basic-7-front-transfer-black-s`
  - package alias: `supplier-bank:print-com-tshirt-price-preview`
  - named policy covers `t-shirt-basic-7`, Russell Classic T-shirt, black,
    Unisex S, front heat transfer, standard urgency, DK/DKK, quantities
    `10/25/50/100`
  - the policy intentionally omits unused back/chest/sleeve position keys
    because Print.com rejects the automatic all-position transfer configuration
  - 2026-07-03 policy preview produced `4/4` valid rows with DKK prices
    `597.50`, `1426.70`, `2828.51`, and `5359.19`
  - policy preview path:
    `pricing_raw/supplier-bank-normalized/print-com/tshirts/prices/20260703-060916.json`
  - `write-print-com-bank-snapshot` preview accepted the file: rows `4`,
    quantities `10-100`, DKK range `597.5-5359.19`, option signatures `1`
  - this preview was written to supplier-bank tables and approved on
    2026-07-03 as a bank-only product:
    - bank product ID: `c508852f-b726-43a7-93f4-472228718cc8`
    - price snapshot ID: `ef0a9118-16f6-4352-8d4b-6be13e9fbacc`
    - scrape run ID: `859c53ba-cd69-402a-985a-b4d1d03d2f0c`
    - checksum:
      `e7e99ae330771669f5463355287fcacca18fdeacb476070ca450e1f1b748719c`
    - supplier enabled preserved as `no` / candidate
    - bank product status: `approved`
  - `supplier-bank-import-draft` was updated and deployed to Supabase project
    `ziattmsmiirfweiuunfo` so explicit supplier-bank t-shirt draft imports
    include locked `Størrelsesfordeling` metadata from
    `scripts/product-import/tshirt-size-distribution-lock.js`
  - read-only draft-import preview is safe for explicit admin import:
    draft slug `t-shirt-basic-7-c508852f`, no existing target slug, `4/4`
    rows map to `generic_product_prices`, quantities `10/25/50/100`, DKK
    range `597.5-5359.19`, customer-facing groups are trimmed to Materiale
    plus `printtype` and `size`, and the t-shirt size distribution has
    `8` fields with quantity-match enforcement
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added Print.com bank snapshot write-plan validator:
  `node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot <price-preview.json>`
  - package alias: `supplier-bank:print-com-write-preview`
  - preview mode writes nothing
  - validates DKK rows, positive prices, unique row keys, required Print.com
    options, matching row counts, no row errors, and non-decreasing prices
    across quantities for each option signature
  - `--write-bank` fails closed while `bank_write_ready` is false unless an
    explicit `--allow-preview-bank-write` override is supplied after review
  - the first named-policy flyer slice is now stored in the supplier bank; wider
    Print.com families/options still require their own policies and validation
- Print.com `flyers` first bank snapshot was written on 2026-07-03:
  - bank product ID: `310b7eb7-f8b3-48a9-8549-51582095f5f2`
  - price snapshot ID: `7004554c-df96-4ff2-a2a5-53fd56dea0c0`
  - scrape run ID: `fb50dde4-4731-4a83-845c-9496dfec9457`
  - checksum:
    `4bbe5767bbbd8937cd7f3702efc4ef0e444d1659d5e597c7284b4c681b6e1fe6`
  - supplier enabled preserved as `no` / candidate
  - bank product approved after validation
  - no Webprinter product was created, no product was published, no POD v2
    table was written, and no live storefront pricing row was written
- Added read-only stored-bank draft-import preview:
  `node scripts/supplier-bank-cli.mjs preview-bank-draft-import --supplier-slug print-com --product-key flyers`
  - package alias: `supplier-bank:preview-print-com-draft-import`
  - uses the same import gate as the admin UI and Edge Function
  - normalizes WMD-style and Print.com attribute shapes before previewing the
    Matrix Layout V1 draft import
  - Print.com `flyers` preview on 2026-07-03 is safe for explicit draft import:
    latest snapshot `7004554c-df96-4ff2-a2a5-53fd56dea0c0`, draft slug
    `flyers-310b7eb7`, no existing target slug, `4/4` rows map to
    `generic_product_prices`, quantities `10/50/100/250`, DKK range
    `194.88-271.08`
  - Print.com draft-import mapping now trims fixed technical API options:
    customer-facing anchor groups are `material`, `size`, `printtype`, and
    `finish`; other options are only exposed when they vary across rows, while
    the full supplier options remain in price-row metadata
  - deployed `supplier-bank-import-draft` to Supabase project
    `ziattmsmiirfweiuunfo` after the Print.com attribute-mapping fix
  - no product was created, no publishing state changed, and no live pricing
    row was written by this preview
- Added an explicit CLI draft-write flag for stored supplier-bank products:
  `node scripts/supplier-bank-cli.mjs preview-bank-draft-import --supplier-slug <slug> --product-key <key> --write-draft-product`
  - no package alias exists for the write path; it must be typed explicitly
  - uses the same import gate and Matrix Layout V1 conversion checks as the
    read-only preview/admin Edge Function
  - refuses unsafe previews and existing target slugs
  - creates only unpublished `pricing_type=matrix` draft products
  - writes `supplier_bank_import_jobs` audit rows with
    `import_mode=matrix_layout_v1`
  - if a write fails after draft creation, it attempts to remove only that
    unpublished draft and related `product_attribute_*`,
    `generic_product_prices`, and supplier-bank import-job rows
- 2026-07-03 guarded Print.com draft imports were run successfully:
  - `flyers` -> `flyers-310b7eb7`
    (`89e137ab-00b9-4159-b832-7e8403af143b`), `4` price rows,
    import job `12b454fb-a916-42b0-8a10-1bcbe12cbc35`
  - `businesscards` -> `businesscards-ee38a8ad`
    (`7272e574-5196-4b58-a2d6-27d2cc2f45ad`), `4` price rows,
    import job `47ab4811-4a44-4f4c-9a87-520d03d18423`
  - `presentation-folders` -> `presentation-folders-f919f4c7`
    (`ad979da9-e465-4139-a5dd-da636cbd1cd3`), `4` price rows,
    import job `8c19ffb4-2dbe-4199-ad75-42e9708285ef`
  - `printed-letterheads` -> `printed-letterheads-9669dc1c`
    (`1d1b25dc-8d73-4e0b-8b5c-0d8bd29e2125`), `4` price rows,
    import job `95c6957a-e458-407a-bc1f-c59bc6fe9c49`
  - `businesscard-boxes` -> `businesscard-boxes-cb5b6871`
    (`06fbdacb-68b0-42ae-90f1-6a4f5378b21e`), `3` price rows,
    import job `8a278164-6851-4526-b20d-b21d3fc19456`
  - `t-shirt-basic-7` -> `t-shirt-basic-7-c508852f`
    (`f1bf166b-aaad-4493-9cda-a3d8570ae291`), `4` price rows,
    import job `9e9b651f-0641-4e80-9302-3aae1b6a5b4a`
  - all six drafts are unpublished, `pricing_type=matrix`,
    `technical_specs.source=supplier-bank`, and have matching
    `generic_product_prices` row counts
  - the t-shirt draft preserves the locked `Størrelsesfordeling` size
    distribution with quantity-match enforcement
  - `review-import-eligibility` now reports all `8/8` staged products as
    `allerede importeret` and `0` blocked
- Added guarded bank-only product approval command:
  `node scripts/supplier-bank-cli.mjs approve-bank-product`
  - package preview alias: `supplier-bank:approve-pixart:preview`
  - requires the same import gate as the admin UI
  - updates only `supplier_bank_products.status` to `approved` when confirmed
  - does not create products, publish products, or write live pricing
- Current local preview scan:
  - preview files checked: `11`
  - passing/failing previews: `3/8`
  - latest passing preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-012857.json`
  - latest passing rows: `45`
  - latest failing preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-flat-surface-adhesive/20260703-020931.json`
    because `None` matches paid finish price series for the grey-back material
- No-write recovery checks passed:
  - `write-pixart-bank-snapshot 20260703-012857.json` preview accepts the
    45-row baseline and writes nothing.
  - `compare-normalized-snapshots 20260703-013823.json 20260703-012857.json`
    reports `0` changed rows, `0` added rows, `45` removed rows, and `45`
    unchanged rows.
- Recovery remains bank-only and requires explicit approval before remote
  `--write-bank` or `--write-delta-review` is used.

Admin supplier-bank import guard added on 2026-07-03:

- `/admin/supplier-bank` now blocks draft import when a product has multiple
  snapshots but no price review, a draft review, a reviewed-but-not-accepted
  review, or a rejected latest review.
- The admin guard also checks that the latest price review targets the latest
  stored price snapshot.
- Rejected reviews are shown as destructive badges and explain why import is
  blocked in both the product card and import preview dialog.
- The `supplier-bank-import-draft` Edge Function enforces the same accepted
  latest-review/latest-snapshot rule before any draft product rows are written.
- A single initial snapshot can still be imported as a draft after explicit
  admin action, but refresh/changed-price paths must be accepted first.
- The admin summary shows import eligibility as `klar / blokeret`, using the
  same guard as the card buttons, preview dialog, and Edge Function.

Additional Pixart conversion guard added on 2026-07-03:

- `pixart-flat-surface-adhesive` is intentionally blocked from the generic
  Matrix Layout V1 draft import path even though its latest supplier-bank price
  review is accepted.
- Read-only preview showed `45/45` Pixart rows with prices, but `0` rows could
  become `generic_product_prices` and no Matrix Layout attribute groups could
  be built. This is expected for the current wide-format Pixart snapshot shape.
- `/admin/supplier-bank`, `review-import-eligibility`, `plan-next-expansion`,
  and `supplier-bank-import-draft` now fail closed with a storformat-conversion
  message for this bank product.
- Next Pixart product-conversion work should reuse
  `scripts/fetch-pixart-flat-surface-adhesive-import.mjs` storformat import
  mapping and add a guarded supplier-bank storformat draft path before any
  Pixart draft product is created.
- Added read-only Pixart supplier-bank storformat dry-run bridge:
  `node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import`
  - package alias: `supplier-bank:pixart-storformat-preview`
  - fetches the latest accepted Pixart bank snapshot and writes a derived local
    preview file under `pricing_raw/supplier-bank-storformat-preview/`
  - invokes the existing Pixart importer in dry-run mode only:
    `scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --dry-run`
  - 2026-07-03 preview file:
    `pricing_raw/supplier-bank-storformat-preview/pixartprinting/pixart-flat-surface-adhesive/20260703-062758.json`
  - dry-run summary: `45` parsed rows, `1` material, `2` finishes, `2`
    delivery variants, `5` quantities, product slug
    `pixart-flat-surface-adhesive-storformat-draft`, publish `false`
  - no supplier scrape, bank write, product creation, publishing state, or live
    pricing write occurred
- Added a guarded Pixart storformat draft-create path on the same CLI command:
  `node scripts/supplier-bank-cli.mjs preview-pixart-storformat-import --write-draft-product`
  - no package alias exists for the write path; it must be typed explicitly
  - always runs the storformat dry-run first
  - refuses to overwrite an existing target tenant/product slug
  - calls the existing Pixart storformat importer without `--publish`
  - verifies the created product is unpublished and `pricing_type=STORFORMAT`
  - writes a `supplier_bank_import_jobs` audit row with `import_mode=storformat`
  - if the live import fails after creating a new unpublished Pixart draft, it
    attempts to remove only that unpublished Pixart/STORFORMAT draft and its
    related `storformat_*` rows
- 2026-07-03 guarded Pixart draft import was run successfully:
  - product id: `a992aa43-0ad4-4f7b-be69-6117ca7b9c2c`
  - product slug: `pixart-flat-surface-adhesive-storformat-draft`
  - product state: unpublished, `pricing_type=STORFORMAT`, `technical_specs.source=pixart`
  - supplier-bank import job id: `78f44771-6070-4c7c-a61a-ed1da9b4d5d0`
  - verified row counts: `1` config, `1` material, `2` finishes, `2` delivery
    variants, `15` material tiers, `15` material m2 prices, `30` finish tiers,
    `2` finish prices, `15` delivery variant tiers
  - `review-import-eligibility` now reports Pixart as `allerede importeret`;
    `plan-next-expansion` now moves the next recommendation to Print.com draft
    imports and later Pixart family expansion
- Pixart expansion planner corrected on 2026-07-03:
  - the source registry still lists Pixart families `posters`, `banners`,
    `signs`, `rollups`, `stickers`, and `labels`
  - the current Pixart adapter only has implemented supplier-bank preview
    mappings for `flat-surface-adhesive -> stickers` and `rigids -> signs`
  - `plan-next-expansion` and `review-source-coverage` now describe the next
    supported Pixart expansion as `signs` instead of implying posters are
    already supported by the current adapter
  - `pixart-bank-first-slice` now forwards `--categories` to the existing
    Pixart script, so rigids can be tested as a narrow category slice
- 2026-07-03 Pixart rigids/signs first-slice preview was run successfully:
  - command:
    `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile rigids --categories Plastic --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful --require-valid-rows`
  - source artifact:
    `pricing_raw/pixart-rigids-2026-07-03T04-48-56-531Z.json`
  - normalized preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json`
  - extraction result: `15/15` valid priced rows, error counts `{"none":15}`
  - preview write-plan:
    `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json`
  - write-plan result: product key `pixart-rigids`, family `signs`, `15`
    rows, quantities `1-3`, DKK range `182.7-689.09`
  - confirmed supplier-bank-only write was later run after review:
    `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json --write-bank`
  - supplier-bank write result:
    - supplier id: `5128e6e3-8e15-486d-aea3-08aa49155c2f`
    - scrape run id: `1888d582-917a-4d80-b025-15b173d2864f`
    - bank product id: `9ca26076-27a2-45fb-997f-e6fb7d7cf865`
    - price snapshot id: `728afc26-9348-4946-becb-2b747b3b1646`
    - checksum:
      `d0e7983a5e172530eb869cdb10e0d705311b0cc351a18eaadb95e54fa38a0e38`
    - Pixart supplier remained disabled/candidate
  - bank product approval was then run explicitly:
    `node scripts/supplier-bank-cli.mjs approve-bank-product --supplier-slug pixartprinting --product-key pixart-rigids --confirm-status-update`
    and set `pixart-rigids` to `approved`
  - no Webprinter product, publishing state, or live pricing rows were written
    by the rigids supplier-bank write/approval steps
- Pixart rigids generic-import guard added on 2026-07-03:
  - `pixart-rigids` is intentionally blocked from the generic Matrix Layout V1
    draft import path, just like the Pixart flat-surface/sticker bank product
  - `review-import-eligibility --limit 24` now reports `Pixart pladematerialer`
    as `blokeret` with:
    `Pixart rigids rows require the storformat conversion path before draft import.`
  - `plan-next-expansion` now recommends:
    `node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import`
    instead of a generic draft import
  - added package alias:
    `supplier-bank:pixart-rigids-storformat-preview`
- Added read-only Pixart rigids supplier-bank storformat dry-run bridge:
  `node scripts/supplier-bank-cli.mjs preview-pixart-rigids-storformat-import`
  - fetches the latest approved `pixart-rigids` supplier-bank snapshot
  - writes a derived local preview under:
    `pricing_raw/supplier-bank-storformat-preview/pixartprinting/pixart-rigids/`
  - invokes the existing Pixart importer in dry-run mode:
    `scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile rigids --dry-run`
  - 2026-07-03 preview file:
    `pricing_raw/supplier-bank-storformat-preview/pixartprinting/pixart-rigids/20260703-065823.json`
  - dry-run category result:
    - category/product: `Plastic` -> `Pixart pladematerialer Plastic`
    - product slug: `pixart-rigids-storformat-draft-plastic`
    - source rows: `15`
    - materials: `1`
    - white options: `1`
    - printing options: `3`
    - cut options: `2`
    - delivery options: `2`
    - publish: `false`
  - no supplier scrape, supplier-bank write, product creation, publishing
    state, or live pricing write occurred
  - rigids remains dry-run only from the supplier-bank CLI until the category
    split and markup policy are reviewed
- Added repeatable Pixart rigids storformat review gate:
  `node scripts/supplier-bank-cli.mjs review-pixart-rigids-storformat-preview`
  - package alias:
    `supplier-bank:pixart-rigids-storformat-review`
  - optional report flag:
    `node scripts/supplier-bank-cli.mjs review-pixart-rigids-storformat-preview --write-report`
  - 2026-07-03 report:
    `docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-070216.md`
  - review result:
    - profile/key/rows/positive prices passed
    - category split is intentionally narrow: `Plastic`
    - material: `Foamex 3mm`
    - areas: `1 m2`
    - quantities: `1,2,3`
    - option combinations: `5`
    - cheapest quote EUR range: `24.04-90.67`
  - remaining blockers before any draft product:
    - missing the remaining rigids/sign categories
    - area and quantity range are still first-slice only
    - rigids markup policy is still review-only and currently `0%`
    - CLI intentionally blocks rigids draft creation until those decisions are
      approved
- Added Pixart extraction recovery normalizer on 2026-07-03:
  `node scripts/supplier-bank-cli.mjs normalize-pixart-extraction-preview <raw-extraction.json> --profile rigids`
  - use this when a Pixart browser extraction succeeds but the supplier-bank
    wrapper misses the new raw artifact before creating the normalized preview
  - fixed the latest-extraction finder so timestamped files such as
    `pixart-rigids-2026-...json` are matched, while transformed import files
    such as `pixart-rigids-plastic-transformed-...json` are ignored
  - fixed rigids normalized `supplier_row_key` so it includes category,
    material, printing, white, cut, area, size, and quantity; this prevents
    duplicate row keys across rigids option combinations
  - added a rigids quality gate for multi-category previews: if all requested
    categories produce the exact same material set, the preview fails closed as
    suspicious category/material coverage
- 2026-07-03 broader Pixart rigids category preview was run locally:
  - command:
    `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile rigids --categories Plastic,Plexiglass --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful --require-valid-rows`
  - wrapper result:
    - Pixart probe found both `Plastic` and `Plexiglass`
    - extraction succeeded with `27/27` priced rows
    - raw artifact:
      `pricing_raw/pixart-rigids-2026-07-03T05-07-21-762Z.json`
    - wrapper initially failed to detect the new artifact because transformed
      rigids files sorted after timestamped extraction files; this is now fixed
  - normalized with:
    `node scripts/supplier-bank-cli.mjs normalize-pixart-extraction-preview pricing_raw/pixart-rigids-2026-07-03T05-07-21-762Z.json --profile rigids`
  - normalized preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-050721.json`
  - normalized preview result:
    - rows: `27`
    - categories: `Plastic`, `Plexiglass`
    - material count: `1` (`Foamex 3mm`)
    - finish/option combinations: `5`
    - quantities: `1-3`
    - area range: `1 m2`
    - DKK range: `182.7-814.87`
    - duplicate supplier row keys after fix: `0`
  - bank write-plan preview passed without writes:
    `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-050721.json`
  - storformat dry-run from the raw extraction passed without product writes:
    `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile rigids --input pricing_raw/pixart-rigids-2026-07-03T05-07-21-762Z.json --dry-run --tenant-id 00000000-0000-0000-0000-000000000000 --product-prefix "Pixart pladematerialer" --product-slug-prefix pixart-rigids-storformat-expanded-draft --categories Plastic,Plexiglass`
    - dry-run product split:
      - `Pixart pladematerialer Plastic`, slug
        `pixart-rigids-storformat-expanded-draft-plastic`, `15` rows
      - `Pixart pladematerialer Plexiglass`, slug
        `pixart-rigids-storformat-expanded-draft-plexiglass`, `12` rows
  - no supplier-bank rows, products, publishing state, or live pricing rows
    were written
  - caution: both categories currently extracted `Foamex 3mm`; treat this as a
    broader category-path validation, not final Plexiglass material coverage,
    until category-specific material selection is verified
  - after the stricter multi-category quality gate was added, the same
    27-row preview correctly fails the bank write-plan with:
    `Pixart rigids preview failed quality gate: category material coverage is suspicious (Plastic, Plexiglass all use Foamex 3mm)`
  - the original single-category Plastic baseline
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-044856.json`
    still passes write-plan preview and remains the safe remote baseline
- Pixart rigids visible-option fix and verified two-category preview on
  2026-07-03:
  - updated `scripts/fetch-pixart-flat-surface-adhesive-import.mjs` so rigids
    option discovery and option selection use only visible DOM controls; hidden
    fallback controls are no longer considered available or clickable
  - probe command:
    `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs probe --profile rigids --categories Plastic,Plexiglass --headful`
  - probe result after the fix:
    - `Plastic` first visible material: `Foamex 3mm`
    - `Plexiglass` first visible material: `Clear Polycarbonate 3mm`
    - visible counts are included in probe output for option diagnostics
  - extraction command:
    `node scripts/supplier-bank-cli.mjs pixart-bank-first-slice --profile rigids --categories Plastic,Plexiglass --limit-materials 1 --limit-areas 1 --limit-quantities 3 --headful --require-valid-rows`
  - raw artifact:
    `pricing_raw/pixart-rigids-2026-07-03T05-18-55-751Z.json`
  - normalized preview:
    `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`
  - normalized preview result:
    - rows: `18`
    - categories: `Plastic`, `Plexiglass`
    - materials: `Foamex 3mm`, `Clear Polycarbonate 3mm`
    - finish/option combinations: `5`
    - quantities: `1-3`
    - area range: `1 m2`
    - DKK range: `182.7-976.83`
    - duplicate supplier row keys: `0`
  - bank write-plan preview passed without writes:
    `node scripts/supplier-bank-cli.mjs write-pixart-bank-snapshot pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`
  - storformat dry-run passed without product writes:
    `node scripts/fetch-pixart-flat-surface-adhesive-import.mjs import --profile rigids --input pricing_raw/pixart-rigids-2026-07-03T05-18-55-751Z.json --dry-run --tenant-id 00000000-0000-0000-0000-000000000000 --product-prefix "Pixart pladematerialer" --product-slug-prefix pixart-rigids-storformat-visible-draft --categories Plastic,Plexiglass`
    - `Plastic` dry-run: `15` rows, `1` material, `3` printing options,
      `2` cut options, `2` delivery variants
    - `Plexiglass` dry-run: `3` rows, `1` material, `1` printing option,
      `1` cut option, `2` delivery variants
  - no supplier-bank rows, products, publishing state, or live pricing rows
    were written
  - no-write comparison against the stored Plastic baseline reported old/new
    effective rows `3/18`, added/removed rows `18/3`, changed rows `0`, and
    duplicate supplier row keys old/new `12/0`; the old effective row count is
    lower than the physical `15` baseline rows because the old key shape did
    not include every rigids option dimension
  - candidate review report:
    `docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-051855.md`
  - repeatable no-write review command added:
    `node scripts/supplier-bank-cli.mjs review-pixart-rigids-bank-candidate`
    (package alias:
    `npm run supplier-bank:pixart-rigids-bank-candidate-review`)
  - repeatable no-write decision packet added:
    `node scripts/supplier-bank-cli.mjs review-pixart-rigids-candidate-packet`
    (package alias:
    `npm run supplier-bank:pixart-rigids-candidate-packet`)
    - runs candidate comparison, bank snapshot write-plan preview, and the
      Pixart rigids storformat dry-run from the candidate raw extraction
    - can write a local packet report under `docs/`
    - does not scrape suppliers, write supplier-bank rows, create products,
      publish products, or write live pricing
  - repeatable no-write bank-write preflight added:
    `node scripts/supplier-bank-cli.mjs preflight-pixart-rigids-bank-write`
    (package alias:
    `npm run supplier-bank:pixart-rigids-bank-write-preflight`)
    - verifies the candidate preview, baseline preview, latest packet report,
      duplicate-key status, category/material coverage, and write-plan preview
    - prints the explicit `--write-bank` command plus the post-write delta
      review command
    - does not scrape suppliers, write supplier-bank rows, create products,
      publish products, or write live pricing
  - next gate: review whether this 18-row two-category slice should become a
    new supplier-bank snapshot, then use `--write-bank` only after explicit
    bank-write approval

### Combined Status Report Command

- Added a combined no-write status command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-status-report --write-report`
  - package aliases:
    - `npm run supplier-bank:status-report`
    - `npm run supplier-bank:status-report:write`
  - combines registry/source coverage, stored product import eligibility, and
    next-expansion planning into one Markdown report under `docs/`
  - reuses the same bank-readiness and import-route gates as
    `review-import-eligibility`, `review-source-coverage`, and
    `plan-next-expansion`
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing
- Updated the status planner so Pixart rigids recognizes completed local
  packet/preflight evidence. When the improved local candidate is ready, the
  report now shows the actual human decision gate instead of repeatedly asking
  for the packet/preflight commands:
  - keep the current stored Plastic-only snapshot in review, or
  - explicitly approve a bank-only write of the Plastic+Plexiglass candidate
  - no status report command performs that write

### Imported Draft QA Command

- Added a read-only imported-draft QA command:
  `node scripts/supplier-bank-cli.mjs review-imported-drafts --write-report`
  - package aliases:
    - `npm run supplier-bank:review-imported-drafts`
    - `npm run supplier-bank:review-imported-drafts:report`
  - checks imported supplier-bank draft jobs against target products
  - verifies target products still exist, remain unpublished, and use the
    expected Matrix Layout or STORFORMAT pricing mode
  - compares Matrix Layout drafts against `generic_product_prices` row counts
    from the import summary where available
  - checks basic STORFORMAT material/finish/variant table counts
  - writes a local Markdown report under `docs/`
  - does not scrape suppliers, write supplier-bank rows, edit products,
    publish products, or write live pricing
- The combined status report now includes the imported-draft QA summary so the
  main planning report shows whether imported drafts still exist, remain
  unpublished, and have matching Matrix/STORFORMAT row counts. The full draft
  QA report remains available through `review-imported-drafts --write-report`.

### Decision Queue Report Command

- Added a read-only decision queue command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-decision-queue --write-report`
  - package aliases:
    - `npm run supplier-bank:decision-queue`
    - `npm run supplier-bank:decision-queue:write`
  - turns the current supplier-bank state into a short human decision list
  - includes the Pixart rigids approval gate, imported-draft QA state, and
    remaining supplier coverage choices
  - prints guarded commands only as follow-up options; it does not execute
    write commands
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing
- Added a matching read-only decision queue panel to `/admin/supplier-bank`.
  - computes open decisions from supplier products, price reviews, coverage
    gaps, refresh queue state, and imported target product publish state
  - warns if a supplier-bank import target ever appears published
  - includes imported-draft QA status in the browser: target publish state,
    pricing type, Matrix `generic_product_prices` row counts, and basic
    STORFORMAT material/variant counts
  - shows a compact Draft QA dashboard card and per-product draft QA line so
    imported drafts can be reviewed without opening the CLI report first
  - adds a business-facing "Næste udvidelser" panel that ranks supplier-family
    gaps and blocked supplier decisions from the same read-only coverage data
  - keeps the browser path non-destructive: no supplier scrape, no supplier-bank
    write, no product edit, no publishing, and no live pricing write

### Approval Packet Report Command

- Added a read-only approval packet command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-approval-packet --write-report`
  - package aliases:
    - `npm run supplier-bank:approval-packet`
    - `npm run supplier-bank:approval-packet:write`
  - combines the decision queue, completion-audit evidence, imported-draft QA,
    Pixart rigids evidence, and Print.com `placemats` readiness into one
    business approval packet
  - separates safe preflight/check commands from commands that include write
    flags and require explicit approval
  - writes a local Markdown report under `docs/`
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing

### Expansion Packet Report Command

- Added a read-only expansion packet command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-expansion-packet --write-report`
  - package aliases:
    - `npm run supplier-bank:expansion-packet`
    - `npm run supplier-bank:expansion-packet:write`
  - combines missing-family coverage gaps, Pixart adapter mapping plan rows,
    open approval candidates, and imported-draft QA into one ordered expansion
    packet
  - keeps write-flagged commands out of the safe expansion checklist while
    still showing which approval gates remain open
  - writes a local Markdown report under `docs/`
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing

### Executive Summary Report Command

- Added a read-only executive summary command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-executive-summary --write-report`
  - package aliases:
    - `npm run supplier-bank:executive-summary`
    - `npm run supplier-bank:executive-summary:write`
  - produces a concise business overview for owner/CEO review
  - summarizes supplier coverage, imported-draft QA, open decisions, Pixart
    rigids evidence, and the next practical supplier-bank steps
  - keeps technical write commands behind explicit approval language
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing

### Completion Audit Report Command

- Added a read-only completion/evidence audit command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-completion-audit --write-report`
  - package aliases:
    - `npm run supplier-bank:completion-audit`
    - `npm run supplier-bank:completion-audit:write`
  - maps the supplier-bank goal to concrete evidence-backed requirements:
    supplier registry, WMD full folder bank, Print.com first slices, Pixart
    flat-surface STORFORMAT path, imported-draft QA, Pixart rigids, supplier
    coverage, and high-priority decisions
  - reports each requirement as `PROVED`, `PARTIAL`, `OPEN`, or
    `CONTRADICTED`
  - explicitly keeps the overall goal incomplete while Pixart rigids approval,
    remaining registered family coverage, or other high-priority decisions are
    still open
  - writes a local Markdown report under `docs/` when `--write-report` is
    supplied
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing

### Coverage Gap Plan Command

- Added a read-only coverage-gap plan command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-coverage-gap-plan --write-report`
  - package aliases:
    - `npm run supplier-bank:coverage-gap-plan`
    - `npm run supplier-bank:coverage-gap-plan:write`
  - turns missing registered supplier/product families into concrete next
    actions
  - distinguishes:
    - `scoping_needed`, e.g. Print.com `other`, where catalog discovery can
      start but a narrow SKU/policy must be chosen before price preview
    - `adapter_mapping_needed`, e.g. Pixart banners/labels/posters/rollups,
      where the existing Pixart script needs a supplier-bank profile/mapping
      before extraction should be claimed as covered
    - `preview_supported`, where an existing no-write preview command exists
  - writes a local Markdown report under `docs/` when `--write-report` is
    supplied
  - does not scrape suppliers, write supplier-bank rows, create products,
    publish products, or write live pricing

### Print.com Other Scoping Preview

- Ran the registered Print.com `other` scoping path as a local/no-write preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-first-slice --family other --limit 80 --details-limit 12`
  - listed 855 Print.com catalog products
  - captured 80 `other` candidates
  - fetched 12/12 detail payloads with 0 detail errors
  - wrote raw snapshot
    `pricing_raw/supplier-bank-raw/print-com/other/20260703-084329.json`
  - wrote normalized preview
    `pricing_raw/supplier-bank-normalized/print-com/other/20260703-084329.json`
  - documented review in
    `docs/SUPPLIER_BANK_PRINT_COM_OTHER_SCOPING_20260703-084329.md`
- Added package alias:
  `npm run supplier-bank:print-com-other-first-slice:preview`
- Recommended first narrow `other` candidate is `placemats`, because it has a
  normal print-product shape with quantities 10/25/50/100 and clear
  print/material/finish/size fields.
- Ran first local/no-write `placemats` price preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --family other --sku placemats --quantity-limit 4`
  - returned 4/4 valid DKK price rows
  - selected `a4_landscape`, `135gr_gesatineerd_mc`, `40`, `geen`, standard
    urgency, and quantities 10/25/50/100
  - wrote normalized preview
    `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-084742.json`
  - did not write supplier-bank rows, products, POD v2 rows, or live pricing
- Added named policy `placemats-a4-landscape-135gsm-coated-4-0` and package
  alias `npm run supplier-bank:print-com-placemats-price-preview` for
  repeatable validation.
- Ran named-policy preview:
  `node scripts/supplier-bank-cli.mjs print-com-bank-price-preview --policy placemats-a4-landscape-135gsm-coated-4-0`
  - returned 4/4 valid DKK price rows
  - marked the source preview bank-write-ready
  - wrote normalized preview
    `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-084838.json`
- Ran no-write write-plan validation:
  `node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-084838.json`
  - rows: 4
  - quantities: 10-100
  - DKK range: 271.23-368.85
  - preview only; no supplier-bank rows were written
- Do not write `placemats` or any `other` product to the supplier bank until
  explicit approval is given for `--write-bank`.
- Decision queue now surfaces the local bank-write-ready `placemats` preview
  as a medium-priority approval choice while Print.com `other` is still missing
  from stored supplier-bank coverage. The proposed command remains explicit
  and bank-only:
  `node scripts/supplier-bank-cli.mjs write-print-com-bank-snapshot pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-084838.json --write-bank`
- Added no-write Print.com `placemats` bank-write preflight:
  `node scripts/supplier-bank-cli.mjs preflight-print-com-placemats-bank-write --write-report`
  - package aliases:
    - `npm run supplier-bank:print-com-placemats-bank-write-preflight`
    - `npm run supplier-bank:print-com-placemats-bank-write-preflight:write`
  - validates the latest local bank-write-ready `placemats` preview
  - confirms Print.com `other` is still missing from stored supplier-bank
    coverage before showing the approval command
  - writes a local Markdown report under `docs/` when `--write-report` is
    supplied
  - first report written:
    `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-090317.md`
  - latest refreshed report:
    `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-110649.md`
  - does not call Print.com, write supplier-bank rows, write POD v2 tables,
    create products, publish products, or write live pricing

### Pixart Adapter Mapping Plan Command

- Added a read-only Pixart adapter mapping plan command:
  `node scripts/supplier-bank-cli.mjs supplier-bank-pixart-adapter-plan --write-report`
  - package aliases:
    - `npm run supplier-bank:pixart-adapter-plan`
    - `npm run supplier-bank:pixart-adapter-plan:write`
  - maps the missing Pixart registered families `banners`, `labels`,
    `posters`, and `rollups` to proposed profile names, source-route
    assumptions, first-slice shapes, and quality gates
  - supports `--family <family>` for one missing Pixart family at a time
  - updates the coverage-gap checklist so Pixart adapter gaps start with this
    mapping plan before any probe/extraction work
  - writes a local Markdown report under `docs/` when `--write-report` is
    supplied
  - first report written:
    `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_20260703-085339.md`
  - refreshed coverage-gap report written:
    `docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_20260703-085356.md`
  - does not run Pixart probes, scrape suppliers, write supplier-bank rows,
    create products, publish products, or write live pricing

## Information Needed From User

- List of supplier websites.
- Whether we have supplier API access or only public pages.
- Which product family should be the pilot.
- Preferred markup/conversion policy per supplier.
- Whether price refresh should be manual, scheduled, or approval-based.
