# Supplier Product Bank - WMD Full Folder Status

Date: 2026-07-02
Last updated: 2026-07-03
Scope: WIRmachenDRUCK folder bank, supplier-bank staging, draft Webprinter product import

## Current Status

The supplier-bank foundation is in place for the WIRmachenDRUCK folder product family.

- Supplier: WIRmachenDRUCK
- Bank product key: `wmd-folder-bank`
- Bank product id: `891a5cf1-7884-4344-9bab-8071c38b6443`
- Bank status: `approved`
- Product family: `folders`
- Normalized price rows: `18,800`
- Formats: `9`
- Materials: `5`
- Surfaces: `2`
- Fold types: `3`
- Page counts: `4`
- Orientations: `2`
- Quantity range: `50-20000`
- DKK range: `102-41899`

The earlier small pilot is retained only as an archive reference:

- Pilot key: `wmd-folder-bank-pilot`
- Pilot status: `archived`
- Pilot rows: `180`

## Imported Draft Products

A refreshed explicit draft import has been created from the approved bank
product after accepting the latest price delta review.

- Current refreshed draft product id: `3c3ac550-6ca2-433f-8d45-b4bc38273d76`
- Current refreshed draft slug: `wmd-folder-bank-20260703`
- Current refreshed draft name: `WIRmachenDRUCK Foldere 20260703`
- Published: `false`
- Pricing type: `matrix`
- Price rows inserted: `18,800`
- Import job id: `41ae96a8-f9d4-4702-bfa8-6cf9b0863bcb`

The earlier draft remains available as an unpublished reference from the first
full-bank import:

- Draft product id: `09e39172-1148-4429-b082-01c0f1232f09`
- Draft slug: `wmd-folder-bank-891a5cf1`
- Draft name: `WIRmachenDRUCK Foldere`
- Published: `false`
- Pricing type: `matrix`
- Price rows inserted: `18,660`
- Import job id: `4b226329-7c45-49c3-836a-4f28aca5e100`

Local admin routes:

- Supplier bank: `http://127.0.0.1:8083/admin/supplier-bank`
- Current refreshed draft product: `http://127.0.0.1:8083/admin/product/wmd-folder-bank-20260703`
- Earlier draft product: `http://127.0.0.1:8083/admin/product/wmd-folder-bank-891a5cf1`

## Price Delta Review Baseline

A first draft price review has been created from the latest two full WMD bank
snapshots. This is a bank-only review record; it does not update storefront
products or live prices.

- Review id: `408afed3-7b85-471a-8c48-f932f377a3f7`
- Status: `draft`
- Old snapshot id: `3c8efd31-8340-45a6-89db-3d9688048265`
- New snapshot id: `aca951d0-6963-400d-8509-d8995cdc3bf2`
- Old rows: `18,660`
- New rows: `18,660`
- Changed rows: `0`
- Added rows: `0`
- Removed rows: `0`
- Unchanged rows: `18,660`
- Net changed-row delta: `0 DKK`

## Latest Refresh And Review

A clean full WMD refresh was completed after hardening the importer to
retry supplier detail pages and fail closed on partial scrapes.

- Refresh timestamp/file key: `20260703-014857`
- Raw snapshot: `pricing_raw/wmd-folder-bank/20260703-014857.json`
- Clean CSV: `pricing_clean/wmd-folder-bank/20260703-014857.csv`
- Normalized snapshot: `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-014857.json`
- Failed detail pages: `0`
- Extracted supplier rows: `19,397`
- Normalized price rows: `18,800`
- New price snapshot id: `93245d78-d7cf-4ec4-91b6-6df1968f1766`
- Total stored price snapshots: `3`

A second draft price review compares the previous clean snapshot with the new
refresh. This is also bank-only and does not update storefront products or live
prices.

- Review id: `1756f5d0-48c5-4012-8949-a4726e4efe99`
- Status: `accepted`
- Old snapshot id: `aca951d0-6963-400d-8509-d8995cdc3bf2`
- New snapshot id: `93245d78-d7cf-4ec4-91b6-6df1968f1766`
- Old rows: `18,660`
- New rows: `18,800`
- Changed rows: `78`
- Increased rows: `67`
- Decreased rows: `11`
- Added rows: `380`
- Removed rows: `240`
- Unchanged rows: `18,342`
- Net changed-row delta: `12,207 DKK`

## Latest Queue Processor Run

The first queued WMD refresh request has also been processed through the guarded
refresh queue worker. This run used a stored clean WMD CSV to prove the queue
flow without performing another fresh supplier scrape.

- Refresh job id: `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`
- Queue status after read-back: `succeeded`
- Queue started: `2026-07-03 00:42:36.281+00`
- Queue finished: `2026-07-03 00:42:57.873+00`
- Source clean CSV: `pricing_clean/wmd-folder-bank/20260703-014857.csv`
- New normalized snapshot: `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-024236.json`
- New supplier-bank price snapshot id: `aabc6392-d662-4e4c-b0f4-94fcb7cc5f18`
- Total stored price snapshots: `4`
- New delta review id: `11888446-b2c1-417e-932b-fb43eef09a24`
- Delta review status: `accepted`
- Accepted read-back: `2026-07-03T00:46:50.433+00:00`
- Changed rows: `0`
- Added rows: `0`
- Removed rows: `0`
- Unchanged rows: `18,800`
- Net changed-row delta: `0 DKK`

Read-only review after the queue run confirms the current imported draft
`wmd-folder-bank-20260703` remains unpublished with `18,800` price rows and
matches the latest supplier-bank snapshot.

## Safeguards Confirmed

- Supplier-bank data remains separate from POD v1 and POD v2.
- The full WMD product was imported as an unpublished draft.
- The archived pilot is hidden from the normal supplier-bank list.
- Scraped prices were not pushed directly into published storefront products.
- The first full-bank price review is stored only in `supplier_bank_price_delta_reviews`.
- The latest full-bank refresh created only supplier-bank scrape/snapshot/review rows.
- The queued refresh processor created only supplier-bank scrape/snapshot/review rows and updated the refresh queue audit row.
- The draft import uses existing Matrix Layout V1/generic price structures.
- The draft product includes supplier-bank technical metadata for traceability.
- DIN format dimensions were corrected before the final draft verification:
  - DIN Lang: `99 x 210 mm`
  - DIN A7: `74 x 105 mm`
  - DIN A6: `105 x 148 mm`
  - DIN A5: `148 x 210 mm`
  - DIN A4: `210 x 297 mm`

## Files Changed In This Slice

- `scripts/fetch-folders-import.js`
  - Added retry handling for transient WMD network failures.
  - Preserves approved/archived supplier-bank status on refresh.
  - Corrects DIN format dimensions in normalized WMD folder data.
  - Retries each WMD detail page in a fresh browser page during live scrape refreshes.
  - Refuses to create/write a supplier-bank snapshot if any detail page still fails.
  - Blocks `--allow-partial-bank-snapshot` from being combined with `--write-bank`.
- `scripts/product-import/shared/folders-matrix.js`
  - Treats blank numeric values as `null`, not zero.
- `scripts/supplier-bank-cli.mjs`
  - Preserves approved/archived supplier-bank status on refresh.
  - Adds full-bank WMD aliases: `apply-wmd-bank` and `verify-wmd-bank`.
  - Adds `refresh-wmd-bank`, a focused post-setup WMD supplier-bank snapshot refresh wrapper.
  - Adds `review-wmd-refresh`, a read-only import/reimport decision aid for the refreshed WMD bank.
  - Adds `update-delta-review-status`, a guarded bank-only delta-review status transition command.
  - Adds process/request timeout guards for remote supplier-bank operations.
  - Keeps the old `*-pilot` commands for the archived pilot reference.
  - Links stored delta reviews to the exact old/new supplier-bank price snapshot ids.
  - Avoids duplicate delta reviews for the same stored snapshot pair.
  - Adds `process-refresh-queue`, a guarded refresh queue processor that previews by default.
- `scripts/sql/wmd-latest-delta-review-state.sql`
  - Adds a read-only linked-Supabase SQL fallback for the latest WMD review state.
- `scripts/sql/wmd-mark-latest-delta-review-reviewed.sql`
  - Adds a guarded linked-Supabase SQL fallback for the latest WMD review `draft -> reviewed` transition.
  - Updates only `supplier_bank_price_delta_reviews.status` and `updated_at`.
- `scripts/sql/wmd-accept-latest-delta-review.sql`
  - Adds a guarded linked-Supabase SQL fallback for the latest WMD review `reviewed -> accepted` transition.
  - Updates only `supplier_bank_price_delta_reviews.status` and `updated_at`.
- `scripts/sql/supabase-db-health.sql`
  - Adds a minimal linked-Supabase database health query before supplier-bank SQL retries.
- `supabase/migrations/20260703003500_supplier_bank_refresh_queue.sql`
  - Adds `supplier_bank_refresh_jobs` as a master-admin refresh request queue with explicit grants and RLS.
  - Queue rows do not scrape suppliers, create snapshots, import products, publish products, or write live pricing by themselves.
- `package.json`
  - Points `supplier-bank:apply-wmd:preview` and `supplier-bank:verify-wmd` at the full WMD bank.
  - Adds `supplier-bank:refresh-wmd:preview` as a no-write refresh preview shortcut.
  - Adds `supplier-bank:review-wmd` for the read-only refreshed-bank decision check.
  - Adds `supplier-bank:review-wmd:mark-reviewed:preview` for previewing the next WMD delta-review status transition.
  - Adds `supplier-bank:process-refresh-queue:preview` for previewing queued supplier-bank refresh jobs.
  - Adds SQL retry aliases: `supplier-bank:db-health:sql`, `supplier-bank:wmd-review-state:sql`, `supplier-bank:wmd-review-mark-reviewed:sql`, and `supplier-bank:wmd-review-accept:sql`.
  - Adds explicit pilot aliases for the archived miniature dataset.
- `supabase/functions/supplier-bank-import-draft/index.ts`
  - Writes richer Matrix Layout price metadata so the price preview can resolve selected variants.
- `src/pages/admin/SupplierBank.tsx`
  - Hides archived products from the normal product list.
  - Blocks import from archived/failed bank products.
  - Avoids loading all normalized price rows in the preview panel.
  - Shows when a bank product already has an imported draft and links directly to that draft product.
  - Disables duplicate draft import actions when the imported draft slug is known.
  - Shows supplier price snapshot counts per product.
  - Adds a guarded `Opret prisreview` action that is disabled until two snapshots exist and writes only a draft delta review.
  - Shows recent price-delta reviews with changed/added/removed counts and bank-only status controls.
  - Shows recent refresh queue requests and active queue count.
  - Adds a guarded `Ko refresh` action that inserts a queue row only and disables duplicate active queue requests.
- `src/components/admin/ProductPriceManager.tsx`
  - Counts large `generic_product_prices` tables before loading rows.
  - Opens large supplier-imported matrices in a lightweight admin mode.
- `src/components/admin/ProductAttributeBuilder.tsx`
  - Skips automatic restoration of more than 5,000 published price rows into the browser editor.
  - Shows an explicit `Indlæs priser til redigering` action when admins need the full price set in the generator.

## Verification

Completed checks:

- `node --check scripts/fetch-folders-import.js`
- `node --check scripts/product-import/shared/folders-matrix.js`
- `node --check scripts/supplier-bank-cli.mjs`
- `node scripts/supplier-bank-cli.mjs apply-wmd-bank`
- `node scripts/supplier-bank-cli.mjs refresh-wmd-bank`
- `node scripts/supplier-bank-cli.mjs refresh-wmd-bank --from-clean-csv pricing_clean/wmd-folder-bank/20260701-182956.csv`
- `node scripts/supplier-bank-cli.mjs refresh-wmd-bank --confirm-bank-write`
  - Started a fresh WMD scrape.
  - Aborted before DB write because the supplier site returned skipped/partial detail pages.
  - Remote WMD bank remained unchanged: `2` snapshots, `1` import job, `1` delta review.
- `node scripts/supplier-bank-cli.mjs refresh-wmd-bank --confirm-bank-write`
  - Completed a clean fresh WMD scrape after retry hardening.
  - Wrote supplier-bank scrape run `8e8e417a-3305-4a88-988b-c11ed046891c`.
  - Wrote supplier-bank price snapshot `93245d78-d7cf-4ec4-91b6-6df1968f1766`.
  - Remote WMD bank now has `3` snapshots, `1` import job, and `2` delta reviews.
- `node scripts/fetch-folders-import.js import --bank-snapshot-only --write-bank --allow-partial-bank-snapshot --from-clean-csv pricing_clean/wmd-folder-bank/20260701-182956.csv --name "WIRmachenDRUCK Foldere" --slug wmd-folder-bank`
  - Correctly refused with `--allow-partial-bank-snapshot cannot be used together with --write-bank`.
- `node scripts/supplier-bank-cli.mjs verify-wmd-bank`
- `node scripts/supplier-bank-cli.mjs review-wmd-refresh`
- `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed`
  - Preview only; no status update was written.
  - Confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` is currently `draft`.
  - Confirmed allowed next status is `reviewed`.
- `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status accepted`
  - Correctly refused `draft -> accepted`; latest WMD review must be moved to `reviewed` first.
- `SUPPLIER_BANK_CLI_TIMEOUT_MS=45000 SUPPLIER_BANK_SUPABASE_TIMEOUT_MS=20000 node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed --confirm-status-update`
  - Timed out before Supabase returned a database response.
  - No product import, publishing, or live pricing write was attempted.
- `curl --max-time 90` keyed Supabase REST read for `supplier_bank_suppliers`
  - Timed out with no database response.
  - Treat latest WMD review status as unchanged until a successful read-back proves otherwise.
- Supabase connector `_execute_sql`
  - Returned `Connection terminated due to connection timeout`.
- Supabase restore/resume check
  - Returned that project `ziattmsmiirfweiuunfo` is `ACTIVE_HEALTHY`, but may take a while to fully restore.
- `node scripts/supabase-cli.mjs db query --linked "select now() as db_time;"`
  - Returned `Failed to create login role: Connection terminated due to connection timeout`.
- `npm run supplier-bank:db-health:sql`
  - Later succeeded with `db_time = 2026-07-03 00:22:11.01956+00`.
- `npm run supplier-bank:wmd-review-state:sql`
  - Confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` was `draft`.
- `npm run supplier-bank:wmd-review-mark-reviewed:sql`
  - Updated latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` to `reviewed`.
  - No product import, publishing, or live pricing write was performed.
- `npm run supplier-bank:wmd-review-state:sql`
  - Fresh read-back confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` is `reviewed`, updated at `2026-07-03 00:22:27.32231+00`.
- `node scripts/supplier-bank-cli.mjs review-wmd-refresh`
  - Read-only CLI review now confirms latest review status is `reviewed`.
  - Existing imported draft remains unpublished with `18,660` rows while latest bank snapshot has `18,800` rows.
  - Recommendation is to create a new draft or explicit reimport plan after review.
- `npm run supplier-bank:wmd-review-accept:sql`
  - Updated latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` from `reviewed` to `accepted`.
  - No product import, publishing, or live pricing write was performed by this review-status update.
- `npm run supplier-bank:wmd-review-state:sql`
  - Fresh read-back confirmed latest review `1756f5d0-48c5-4012-8949-a4726e4efe99` is `accepted`, updated at `2026-07-03 00:26:08.092186+00`.
- `node scripts/supplier-bank-cli.mjs import-normalized-snapshot pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-014857.json --tenant 00000000-0000-0000-0000-000000000000 --name "WIRmachenDRUCK Foldere 20260703" --slug wmd-folder-bank-20260703`
  - Previewed a refreshed unpublished draft import with `18,800` rows.
- `node scripts/supplier-bank-cli.mjs import-normalized-snapshot pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-014857.json --tenant 00000000-0000-0000-0000-000000000000 --name "WIRmachenDRUCK Foldere 20260703" --slug wmd-folder-bank-20260703 --write-draft-product`
  - Created refreshed unpublished draft product `3c3ac550-6ca2-433f-8d45-b4bc38273d76`.
  - Inserted `18,800` draft price rows.
- Supabase read-back for `wmd-folder-bank-20260703`
  - Confirmed `is_published = false`, `pricing_type = matrix`, and `price_rows = 18800`.
- Supplier-bank import-job audit insert
  - Created import job `41ae96a8-f9d4-4702-bfa8-6cf9b0863bcb` for refreshed draft `3c3ac550-6ca2-433f-8d45-b4bc38273d76`.
- `node scripts/supplier-bank-cli.mjs review-wmd-refresh`
  - Read-only CLI review now confirms latest review status is `accepted`.
  - Current imported draft is `wmd-folder-bank-20260703`, unpublished with `18,800` rows.
  - Draft rows match the latest bank snapshot.
- `node scripts/supabase-cli.mjs db query --linked --file supabase/migrations/20260703003500_supplier_bank_refresh_queue.sql`
  - Applied the additive refresh queue table remotely.
- `node scripts/supabase-cli.mjs migration repair --linked --status applied 20260703003500`
  - Recorded the refresh queue migration as applied.
- Supabase read-back for `supplier_bank_refresh_jobs`
  - Confirmed the table exists and initially had `0` rows.
- Supplier-bank refresh queue insert
  - Created WMD refresh job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`.
  - Status: `queued`.
  - Tool: `playwright`.
  - No supplier scrape, snapshot, product import, publishing, or live pricing write was performed.
- `node scripts/supplier-bank-cli.mjs process-refresh-queue`
  - Previewed queued WMD job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`.
  - Confirmed supported scope is WIRmachenDRUCK `wmd-folder-bank` `price_refresh`.
  - No supplier scrape, snapshot, product import, publishing, or live pricing write was performed in preview mode.
- `node scripts/supplier-bank-cli.mjs process-refresh-queue --confirm-process --from-clean-csv pricing_clean/wmd-folder-bank/20260703-014857.csv`
  - Processed queued WMD job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2`.
  - Wrote supplier-bank scrape run `5a997194-78c5-42b7-b478-84e81ea03fc4`.
  - Wrote supplier-bank price snapshot `aabc6392-d662-4e4c-b0f4-94fcb7cc5f18`.
  - Created draft delta review `11888446-b2c1-417e-932b-fb43eef09a24`.
  - Delta review has `0` changed rows, `0` added rows, and `0` removed rows.
  - Marked the refresh queue job `succeeded`.
  - No product import, publishing, or live storefront pricing write was performed.
- Supabase read-back for `supplier_bank_refresh_jobs`
  - Confirmed job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2` is `succeeded`.
  - Confirmed `result_summary` points to the old/new normalized snapshots used by the worker.
- `node scripts/supplier-bank-cli.mjs review-wmd-refresh`
  - Read-only CLI review now confirms latest snapshot `aabc6392-d662-4e4c-b0f4-94fcb7cc5f18`.
  - Latest delta review `11888446-b2c1-417e-932b-fb43eef09a24` is `draft` with no row changes before review approval.
  - Current imported draft `wmd-folder-bank-20260703` remains unpublished and still matches the latest bank snapshot.
- `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status reviewed --confirm-status-update`
  - Moved zero-change review `11888446-b2c1-417e-932b-fb43eef09a24` from `draft` to `reviewed`.
  - No product import, publishing, or live storefront pricing write was performed.
- `node scripts/supplier-bank-cli.mjs update-delta-review-status --latest-wmd --status accepted --confirm-status-update`
  - Moved zero-change review `11888446-b2c1-417e-932b-fb43eef09a24` from `reviewed` to `accepted`.
  - No product import, publishing, or live storefront pricing write was performed.
- Supabase read-back for latest WMD review and queue
  - Confirmed latest review `11888446-b2c1-417e-932b-fb43eef09a24` is `accepted`.
  - Confirmed latest queue job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2` is `succeeded`.
- `node scripts/supplier-bank-cli.mjs compare-normalized-snapshots pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260702-005302.json pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260702-233129.json --write-delta-review --limit 5`
- `node scripts/supplier-bank-cli.mjs compare-normalized-snapshots pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260702-233129.json pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank/20260703-014857.json --write-delta-review --limit 10`
- `/Users/thomasprintmaker/.deno/bin/deno check supabase/functions/supplier-bank-import-draft/index.ts`
- `node_modules/.bin/tsc --noEmit`
- `node_modules/.bin/vite build`
- `curl -I http://127.0.0.1:8083/admin/supplier-bank`
- `curl -I http://127.0.0.1:8083/admin/product/wmd-folder-bank-891a5cf1`
- Supabase read-back of bank product, latest price snapshot, draft product, DIN dimensions, price-row count, import job, and delta reviews.
- Admin large-matrix loading path now avoids auto-hydrating all 18,660 WMD price rows on page open.
- Supplier bank UI now exposes the existing WMD draft instead of presenting the same bank row as a fresh import only.
- Full WMD bank has three stored price snapshots, so the admin price-review action is available for this product.
- Price-review status controls are limited to `draft -> reviewed -> accepted/rejected` and do not update storefront prices.
- Day-to-day WMD helper scripts now target the full `wmd-folder-bank`; pilot checks are explicit `:pilot` commands.
- Full WMD bank now has two draft delta reviews linked to their exact stored snapshot ids.
- A focused WMD refresh preview exists for creating the next supplier-bank snapshot without rerunning migration or function deploy setup.
- Confirmed live WMD refresh now fails closed if supplier pages are partial; no partial remote snapshot was written.
- Read-only refresh review now confirms the current refreshed draft has `18,800` price rows and matches the latest bank snapshot.
- Guarded status-transition flow moved the latest delta review from `draft` to `reviewed` to `accepted`.
- Confirmed the CLI now exits with a clear timeout instead of hanging when Supabase database-backed requests stall.
- Added exact SQL fallback files and package aliases so WMD review transitions can be retried without reconstructing queries.
- Latest WMD delta review is `accepted` with a fresh read-back.
- Current refreshed WMD draft `wmd-folder-bank-20260703` is unpublished, has `18,800` rows, and has supplier-bank import-job audit `41ae96a8-f9d4-4702-bfa8-6cf9b0863bcb`.
- WMD refresh job `dc956ed4-9e36-4087-a127-86e9d1ed7dd2` has been processed successfully through the guarded queue worker.
- Latest zero-change queue delta review `11888446-b2c1-417e-932b-fb43eef09a24` is accepted with fresh read-back.
- Refresh queue processor preview and confirmed mode have both been verified for WMD.

## Practical Next Steps

1. Open the supplier bank in the admin and visually confirm the WMD row shows the refreshed draft `wmd-folder-bank-20260703`.
2. Confirm the WMD row shows `4 snapshots`.
3. Confirm the latest price review appears as an `accepted` zero-change review in the `Prisreviews` panel.
4. Open `http://127.0.0.1:8083/admin/product/wmd-folder-bank-20260703` and visually confirm the lightweight large-matrix notice/button appears as expected.
5. Keep `wmd-folder-bank-20260703` unpublished until manual admin/product QA is complete.
6. Generalize the refresh queue worker beyond WMD folders only after the next supplier/product source is chosen.
