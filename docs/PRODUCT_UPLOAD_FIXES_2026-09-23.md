# Product images and large checkout files — 23 September 2026

Local implementation only. No production database changes, storage uploads,
emails, payments, publishing or deployment were performed in this task.

## Findings and changes

- The connected product editor logged `StorageUnknownError: Supabase request
  timeout`, followed by the shared 30-second backend cooldown and an image-delete
  failure. Read-only HTTP checks found both Storage hostnames responding.
- Product-card images now use resumable transfers through the direct Storage
  hostname, with bounded retries, progress, fresh immutable object names and no
  persistent upload credentials. Image size/type limits remain 5 MiB, JPG/PNG/WebP.
- Removing a card image first saves and confirms a null product reference. It
  does not depend on Storage deletion. Shared assets are retained because cloned
  products can reference them. Zero-row/denied database writes are errors.
- Hover-image saves change only the image setting and propagate failures.
  Image-only product updates preserve other unsaved editor fields.
- Storage failures no longer pause unrelated database requests.
- Direct checkout uploads have a chunked 1 GiB implementation, real byte progress,
  separate preparation/upload/verification labels, reduced-motion support and a
  duplicate-upload guard. Browser hashing reads 2 MiB chunks; PDF preview uses local
  byte ranges and contour inspection reads bounded chunks. Private files are not
  downloaded again by the browser before payment; the server remains authoritative.
- Checkout copies files inside Storage and hashes the immutable destination as a
  stream using native SHA-256, checking the recorded size and approved digest
  before making payment possible. Missing/changed files still fail closed.

## Verification

- 37 focused tests passed: 11 upload/hash/reference/timeout tests, 13 checkout and
  upload-capability tests, and 13 checkout entrypoint regression tests.
- The actual resumable browser helper transferred 1,073,741,824 synthetic bytes to
  a localhost test server. The server simulated a failed chunk response; upload
  resumed with the exact matching checksum. This is not a hosted Supabase test.
- Browser fixture verified removal success, denied-save preservation, PDF range
  preview, desktop appearance and 390px layout without horizontal overflow.
- Browser control rejected the fixture file chooser with `Not allowed`.
  Authenticated product image upload/readback has therefore NOT been proven.
- Full application TypeScript: 0 diagnostics in the recovered source copy with
  current locally available sources overlaid. Focused lint passed for the upload
  component, progress component, hashing, PDF-range and storage helpers.
- Production-mode Vite frontend build passed in that copy. Existing bundle-size
  warnings remain. No deployment/server-route packaging claim is made.
- The new migration passes the repository Data API grant checker. It creates no
  new tables/views/functions and changes no grants or RLS.
- npm clean-install dry run passed. Two pinned dependencies were added
  (`tus-js-client@4.3.1`, `hash-wasm@4.12.0`); existing dependency versions were
  preserved. npm also populated missing optional dependency lock entries.

Evidence: `output/upload-fixes-2026-09-23/`. The before snapshots and patch are
relative to task start, preserving unrelated pre-existing worktree changes.

## Activation and delivery still required

1. Decide delivery destination and retention. The user was asked whether to use a
   secure link with the paid-order notification and remove the file after confirmed
   download, keep it for seven days, or deliver to another service. No answer was
   received in this pass. No automatic deletion or new delivery mechanism was
   enabled. Sending a link does not itself remove the stored file.
2. The existing operator email queue is scheduled every minute (verified read-only);
   it is not proof of immediate delivery or inbox receipt. Do not claim the new
   large-file handoff is complete based on this existing scheduler.
3. Verify global Storage file limits/plan, and test the matching migration and
   functions in the isolated backend, including a real 1 GiB upload, signed read,
   checksum verification within hosted CPU/wall-time limits and operator access.
4. Apply `20260923085708_checkout_one_gb_upload_limit.sql` only in a matched release.
   It raises the upload metadata constraint and private order-files bucket limit
   to 1 GiB; it is currently UNAPPLIED. Keep the bucket private.
5. Deploy the changed shared modules with `storefront-file-access` and the checkout
   functions importing `storefrontCheckoutRuntime.ts`, preserving deployed auth,
   modern keys and all payment checks. Verify before enabling the frontend.
6. Set `VITE_STOREFRONT_LARGE_UPLOADS=true` in the scoped frontend release only after
   the above. Until then the local/frontend helper continues advertising/enforcing
   50 MiB, preventing false promises against the unchanged live backend.
7. Perform authenticated image upload/remove/readback acceptance using an agreed
   isolated product. Do not use ordinary localhost as disposable staging.

Rollback: disable the large-upload frontend flag first and restore the previous
scoped frontend/functions if necessary. Preserve existing large claims/files; do
not shrink the database constraint while they exist. Restore the bucket limit
captured in preflight only after handling in-flight transfers. Image changes can be
reversed with the task-start patch, without resetting unrelated product/editor work.

## Follow-up: approval above the preview

- Added branded “Godkend fil og fortsæt” and “Åbn korrektur” controls directly
  above the preview. Successful approval becomes “Fortsæt til bestilling”.
- Both direct approval and Corrector approval focus and scroll to “Din bestilling”
  on the existing checkout page. Radix closes before focus moves. Scrolling respects
  reduced motion, and no payment is submitted by the approval action.
- Processing disables review; files requiring manual review have no quick-approve
  shortcut. Changed artwork still requires a production export. Approval fingerprints,
  file replacement invalidation, payment validation and tenant scope are unchanged.
- Corrector retains its existing full-designer handoff, including the product,
  template and checkout return context; professional-PDF-only exceptions remain.
- Ten existing proof eligibility/artifact tests pass. TypeScript has zero diagnostics,
  component lint and the production-mode frontend build pass in the recovered copy.
- A synthetic browser fixture using the actual component and extracted page handlers
  verified direct and Corrector approval focus, processing, manual review and the
  changed-placement guard. Widths 1440, 1280, 1024, 768, 390 and 320 have no overflow;
  the approval button stays above the preview. Fresh-load console has no errors.
- This is local UI evidence, not authenticated end-to-end checkout/designer acceptance.
  No new deployment, backend write or large-file delivery/retention activation occurred.

Evidence and the follow-up-only patch: `output/checkout-approval-2026-09-23/`.

## Localhost correction after user retry (23 September)

Root cause of the missing local fixes: PID 34561 / port 8113 was serving
`/private/tmp/featured-product-review-2026-09-22/app`, not this working repository.
Its upload components and private-file helper predated this task. The prior
homepage check proved availability, not that the fixed source was being served.

Synchronized the 12 scoped frontend upload/approval files and installed their
missing pinned dependency packages into that running copy. Preserved before copies
and SHA-256 manifest in `output/upload-localhost-repair-2026-09-23/`. Verified the
HTTP-served ProductImageUpload module contains resumableUpload and confirmed
reference persistence. All 12 source files match the working repository. Full
TypeScript on the ACTUAL running copy now has zero diagnostics; ten focused tests
pass. The Vite dependency update reloaded the editor; visible text/settings were
checked and its unsaved 105 percent image-scale value restored without saving.

The selected A4 Folder belongs to master tenant
`00000000-0000-0000-0000-000000000000`; its preview uses that same tenant. Master
is the administration label; webprinter demo is the rendered storefront branding.
Read-only database inspection still showed no saved image on this product.

The real Aluminium product -> Upload fil og bestil -> checkout path was opened.
The browser extension rejected selecting the diagnostic PDF with `Not allowed`;
no file was uploaded by the agent. User was given the documented extension setting
and asked to retry the photo through the normal file picker. Authenticated upload,
image preview after persistence, removal and order-attachment acceptance remain
UNVERIFIED. Do not infer successful upload from this source sync or the old fixtures.

The shared backend still has the 52,428,800-byte upload constraint. The current
50 MB label is accurate; the 1 GiB backend migration/functions/global Storage limit
and delivery/retention decision remain unresolved. No backend mutations or deployment
were performed in this correction.


## Browser-verified transfer repair (23 September, approximately 12:20 CEST)

The connected server on 127.0.0.1:8113 runs `/private/tmp/featured-product-review-2026-09-22/app` via `tmp/start-webprinter-connected-recovered.mjs`. Repair files were synchronized into that running copy as well as the workspace. Master admin and webprinter demo are the admin/storefront views of the same master tenant in these checks.

Real browser reproduction found checkout TUS returning HTTP 400 (`Invalid Compact JWS`) with the private signed token; adding anonymous bearer authentication returned an RLS rejection and was reverted. Current uploads up to 50 MiB now use the established standard signed PUT endpoint with XMLHttpRequest progress. Product images use standard authenticated POST, preserving the existing immutable object names and database readback. TUS is reserved for the disabled large-file rollout; guest TUS authentication still needs resolution before enabling that flag.

The previous TUS helper set native XHR timeout even though tus-js-client does not handle its timeout callback. It now owns an inactivity deadline that rejects and aborts, preventing permanently busy UI. Standard uploads explicitly handle timeout, network error, and abort.

Progress now lives inside the order drop box. Preparing/verification use a small spinner; actual transfer shows percent and bytes. ProductPresentation scale uses a CSS string: numeric scale had become invalid CSS and silently disappeared from the DOM.

Authenticated real-browser checks (no order/payment submitted):
- Uploaded the user's selected `tryksager_onlinetryksager.png` to Salgsmapper uden vinger; image and card preview loaded.
- Removed its product reference successfully and reuploaded the same user-selected picture through the standard transport. Reload retained the image. The underlying prior image asset was not purged.
- Card size 100% -> 105% changed actual preview style from `scale: 1` to `scale: 1.05`; restored 100% without saving unrelated fields.
- Tiny PDF uploaded and opened Corrector with accurate wrong-size warning. A synthetic 1006 mm PDF uploaded, approved in Corrector, returned to same checkout with payment enabled. Cleared synthetic attachment afterward; no payment clicked.
- TypeScript app check passed. Nine focused tests passed for private upload, image reference persistence, standard progress/error/timeout/abort, and resumable cancellation.

Still pending: enabling 1 GiB on the shared backend, resolving guest large-file transport, defining immediate delivery destination and retention/cleanup. The visible 50 MB label remains truthful until those changes are completed.
