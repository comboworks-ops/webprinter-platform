# Brochure product and page Designer — current handoff, 2026-10-06

The human explicitly approved proceeding with Supplier Bank staging and creation
of the new unpublished product, prices and templates. Approval is applied, not
pending. Full completion is blocked by **hosted PostgreSQL disk exhaustion**.

The bank draft, one native unpublished product, six groups, 215 values and all
19 immutable PDF/Designer templates are saved and verified. Exactly 2,152,000 of
5,073,527 price rows are saved; 2,921,527 remain. Product ID:
1f494aac-e4f2-47a2-96ab-b4b6955382ef. Slug: brochurer-med-traadhaeftning.
The product's publication/readiness/tenant-availability flags remain false.

Authoritative review and current acceptance:
[Full review](../output/brochure-2026-10-06/review/complete/report.md).
[Completion audit](../output/brochure-2026-10-06/review/complete/goal-completion-audit.json).
[Native partial readback](../output/brochure-2026-10-06/review/complete/persisted-product-partial-verification.json).
[Capacity evidence](../output/brochure-2026-10-06/review/complete/capacity-recovery.json).

## Capacity recovery

Project printmaker-dev, ref ziattmsmiirfweiuunfo, is on Pro. Inserts fail with
No space left on device. Database data is approximately 5.94 GB; WAL/system
also need disk. Suggested capacity is 32 GB, a headroom estimate. On gp3 this
is approximately $3/month beyond the included 8 GB. Current provisioned disk
has not been verified because the Supabase dashboard requires login. A paid
expansion decision and authenticated Supabase session were requested. No paid
infrastructure change or data deletion occurred.

Preserve SAME packet, checksums, allocated IDs, bank/product receipts and originals.
After space is available, resume the existing insert-only importer:

```sh
node scripts/product-import/import-brochure-product-draft.mjs output/brochure-2026-10-06/review/complete/import-manifest.json --confirm-product-draft
```

It checks existing rows and inserts missing deterministic IDs. Do not invoke
replaceGenericProductPrices, reset receipts or regenerate the allocated plan.
REST HEAD exact-count queries currently return HTTP 500; independent Supabase
management SQL count succeeds. Final exact native counts remain mandatory.
Once all prices finish, produce actual-ID document bindings and run the full
post-write schema-v2 manifest validator. This has NOT happened yet.

## Implemented and checked

One-page configurator: portrait/landscape/square plus free sizes; paper/cover
weights in matrix; cover/dispersion buttons; 38 original quantities through 10,000.
Classic wire and full-colour duplex fixed; no ring binding or 3D. All 708 supplier
articles, 19 fixed sizes, 148 Danish material labels and exact original mappings
are covered. Fixed A3 is 297×420 mm. Free dimensions are 98–297 mm BOTH axes,
step 0.1 mm, 8–120 pages. Fixed page counts go in fours from 8 to 152 where offered;
55 is unsupported and requires choosing 56. No silent rounding or interpolation.

All prices use existing wmd_tiered_fx_7_5 conversion/markup unchanged. 205 fee classes
were verified by 7,191 native quotes. 5,073,527 rows are canonical projections,
not independently fetched native quotes. Zero unresolved fixed variants and
173,872 exact source document bindings. Preserve genuine non-monotonic tiers.
19 clean vector templates have exact trim, 3 mm bleed/safe area and locked,
non-printing guides. The explicit 210×99 mm source MediaBox exception is retained.

Actual saved-product Designer accepts 8 and 152-page PDF fixtures automatically,
shows all thumbnails, restores locally and links only reading pairs 2–3, 4–5 etc.
Front/back are single pages. One immutable source asset is referenced by page index.
Fresh exports retain each page's original painting instructions, exact ICC bytes,
boxes and 1:1 geometry. A brochure-only serialization wrapper preserves precision
through Fabric cloning; shared export modules/global precision were not changed.
See qa/persisted-product-8-page-export.json and
qa/persisted-product-152-page-export.json under the run directory.

105 focused tests, fresh frontend TypeScript and production build pass. The
build contains only 19 public brochure PDFs; DEV catalogs/source-price artifacts
are not bundled. Six real viewport widths pass without outer horizontal overflow.
The actual checkout handler passes synthetic native free-quote/tenant/attribute/
quantity/dimension/VAT/tampering checks. It has not been deployed or used to pay.

## Browser and acceptance

Local one-page preview: http://127.0.0.1:8160/brochure-preview.
Real-component free-size harness: http://127.0.0.1:8160/brochure-native-preview.
Actual saved product/template Designer is retained in the task's browser tabs.
The unsigned storefront correctly hides the unpublished draft. An existing
signed-in Webprinter session is needed for native storefront/account save/reopen
and checkout-return acceptance. Local restore passes; authenticated acceptance,
full price insertion, final document binding and post-write validation remain open.
Hosted/device/printer acceptance, publication and deployment remain separate.

Preserve unrelated staged/unstaged changes and original source/production data.
No DDL, RLS changes, POD v1 changes, shared pricing formula changes, publication,
paid order or destructive cleanup occurred. Rollback keeps only this own draft
unpublished and disables its brochure presentation metadata while retaining assets.
