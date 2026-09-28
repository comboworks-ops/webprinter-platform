# Production rollout checkpoint — 17 September 2026

As of **07:59 UTC (09:59 CEST), all three production sites are LIVE with checkout,
private uploads and live order-email processing enabled.** The exposed legacy
credential is rejected as both an API key and a bearer JWT. There are no pending
credential approvals or owner security actions for this cutover.

- Webprinter storefront: https://www.webprinter.dk/shop
- Onlinetryksager: https://www.onlinetryksager.dk/
- Salgsmapper: https://www.salgsmapper.dk/

Thomas completed migration, rotation and revocation. The dashboard confirms ECC
(P-256) key `198d14e4-e7a1-4f32-84ab-df91d958c692` is CURRENT and legacy HS256 key
`89165731-b437-4ba3-9d23-b182641c90ae` is REVOKED. Do not ask him to repeat any of
those steps. Legacy API keys remain disabled. Passwords and accounts were not reset.

## Final activation and checks

At 07:57 UTC, `finish-live-checkout.mjs --enable` passed the four retirement
probes, all dependency checks and enabled `STOREFRONT_CHECKOUT_ENABLED=true`.
The separate private-upload flag is true and email mode is live. A fresh secret
configuration check confirms all three at 07:59 UTC.

- Old credential: Storage rejects both old-key/old-bearer and new-public-key/old-
  bearer combinations (400 Unauthorized); REST rejects both (401). Modern secret
  reads still work. The temporary private old-key verification file was removed
  after the successful enable; do not rerun that one-shot script expecting it.
- Checkout creator/finalizer now reach their 400 identity validation instead of
  the former 503 pause. Private upload reaches 400 input validation. Email and
  production-job handlers reject unauthorized calls with 401. Unsigned Stripe
  callbacks return 400 invalid_webhook_signature.
- New signed URLs for both existing archived artwork references still download
  identical bytes after revocation. Original public URLs remain denied; wrong-
  order signing and anonymous access remain denied. All 91 object rows unchanged.
- All six apex/www aliases serve `dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX` with the
  reviewed bundle. Browser reloads render Webprinter /shop, Salgsmapper home and
  the Online poster page without captured console errors. Poster matrix is fully
  loaded: A3 / 4+0 / 135g mat / 10 copies, 157 kr plus 49 kr delivery before VAT.
- The scheduled live email worker returns HTTP 200 at 07:59 UTC, timed_out=false,
  claimed=0, sent=0, failed=0. Contact-email settings are preserved.
- Latest counts: 201 products, 357,913 generic price rows, four orders, three file
  records, 91 stored objects, zero checkout attempts and zero outbox rows. No real
  payment, supplier order, production upload or email was created by activation.

This proves deployment/configuration, public browsing and read/access controls.
It does not prove a fresh live customer/admin login or a real paid order through
webhook, email and production. See the remaining acceptance section below.

## Completed after Thomas approved all three specific updates

- Applied `storefront_tenant_write_boundaries` to LIVE `ziattmsmiirfweiuunfo`.
  Read-only SQL role simulations prove: the Salgsmapper/master owner manages
  exactly those two shops; the Onlinetryksager administrator manages only that
  shop; the master administrator manages all four shops and sees all 201 products
  and all four orders. Anonymous reads expose 30 published products, zero orders
  and zero order-file records. This is database role simulation, not authenticated
  browser/admin-save acceptance.
- Deployed and fetched back the exact reviewed Print.com packets:
  `pod2-pdf-preflight` v4, `pod2-order-submit` v11,
  `pod-shipping-possibilities` v13. Every source byte and JWT setting matches.
  No PDF was sent to Print.com and no shipping/production order was requested.
- Enabled the configured live order-email worker and cron job 3. Both direct
  authenticated invocation and scheduled invocation return HTTP 200 with
  claimed=0/sent=0; cron reports succeeded. No messages sent. Existing contact
  settings and shared Resend configuration are retained.
- Verified all 1,184 frontend source hashes still match the reviewed full v4
  candidate and all ten backend/migration packets retain their recorded hashes.
  The Data API grants check passes for 13 migration files.
- Promoted `dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX` using Vercel's production promotion.
  Direct alias API checks prove all six apex/www aliases for webprinter.dk,
  onlinetryksager.dk and salgsmapper.dk point to this deployment. All return HTTP
  200 and the expected `/assets/index-6V9acsMZ.js` bundle. Vercel `inspect` omits
  custom aliases in its printed summary; use the direct alias proof.
- Browser rendering passes for the three homepages, Webprinter `/shop`, and
  Onlinetryksager `/produkt/standard-plakater`. Posters show A3, 4+0, 135g paper,
  10 copies at 157 kr plus 49 kr delivery (206 kr before VAT). No browser console
  errors were captured on these three tabs. No checkout/upload/payment executed.
  Webprinter `/` remains the platform landing page; `/shop` is its storefront.
  Existing `webprinter demo` branding on Webprinter shop/Salgsmapper is preserved
  and remains an editorial follow-up, not an automatically changed tenant preset.

## Preservation and evidence

At 06:26 UTC, after the private-file migration, full-row hashes match across all 23 product/price/option/import
tables: **201 products, 357,913 generic price rows unchanged**. Four orders, three
order-file records and 91 stored objects remain. No new checkout attempts or
email outbox rows exist.

Evidence in `tmp/production-rollout-20260916/`:
- `public-domain-proof.json` and `verify-public-domains.mjs`
- `cutover-inventory-proof.json` and `verify-cutover-inventory.mjs`
- `live-email-enabled-proof.json` and `enable-live-email.mjs`
- `live-email-configuration-proof.json`
- `live-private-file-proof.json`: signed bytes match, original public URLs return
  400, wrong-order signing and anonymous reads denied; all 91 object rows unchanged.
- `local-key-consumers-proof.json`: both ignored local environment files now use
  modern public/server keys; service reads still see 201 products; anonymous orders=0.
- `finish-live-checkout.mjs`: read-only readiness by default; `--enable` first
  requires rejection of the old key, private storage, both security migrations,
  the active email cron and configured webhook. It pauses checkout again if its
  non-mutating endpoint validation fails. No payment/upload/supplier test is created.
- `live-admin.mjs` retrieves only the existing modern server key into process
  memory; a live bucket read succeeds. No secret key is logged or saved there.

The seven functions outside the 41 earlier migrations plus ten matched packets
were also read: setup-schema, platform-pagespeed, platform-sitemap,
pod-tenant-remove, pod2-tenant-remove, pod3-flyeralarm-request, send-quote-emails.
None reads the legacy service-role key. The removal endpoints remain paused.

## Completed private-file and key-consumer cutover

Thomas explicitly approved restricting public file downloads and reported saving
the webhook secret. The exact previously held private migration was resubmitted
through `apply_migration` and succeeded; the previous automatic-review block is
resolved. No renewed permission is needed for that migration.

- `restrict_order_file_storage_reads` is LIVE. The bucket is private, public
  upload/read policies are removed, and the binding RPC is installed. Two actual
  archived file references have frozen order/tenant bindings and working signed
  reads with identical bytes. The third existing `order_files` row is an older
  `aaaa...` fixture pointing to a public product/shipping logo in `product-images`,
  not artwork in `order-files`; that unrelated asset/row was left unchanged.
- The order-files CDN cache was purged, without deleting any bucket/object. Both
  original public artwork URLs now return 400; signed downloads still return the
  original bytes. Wrong-order supplier signing and anonymous reads/signing fail.
  No supplier request was sent. Read-only SQL role simulations show both stored
  links readable to master/Online administrators and the appropriate customer
  link readable to its owner. These are SQL authorization plus service-signed
  download checks, not fresh authenticated browser acceptance.
- `STOREFRONT_PRIVATE_FILES_ENABLED=true` is saved. User saved the correct
  `STOREFRONT_CHECKOUT_WEBHOOK_SECRET` at 06:16:49 UTC; the webhook now returns 400
  `invalid_webhook_signature` to unsigned requests instead of configuration 503.
  A real signed paid callback has not been exercised on LIVE. The existing Stripe
  account and Cookadeli endpoint are unchanged.
- The ignored `.env` and `.env.local` now use modern keys. The 38 scripts using
  legacy-named server settings were inspected: database calls use Supabase SDKs,
  which accept the replacement key. Two old helper scripts now read the server
  key from its non-browser variable. No importer, price update or tenant rename
  script was executed. Syntax checks and the 13-file Data API grants check pass.
- Both actual cron jobs use dedicated secrets and no old service-key Vault entry.
  The current Vercel production settings were privately pulled and confirmed at
  06:33 UTC: modern public key, correct live backend, no legacy server key. The
  temporary settings file was removed. Checkout subsequently enabled at 07:57 UTC;
  see the final activation above.

## Historical diagnosis — resolved by signing-key revocation

Thomas completed **Disable JWT-based API keys**. The dashboard now shows
**Re-enable JWT-based API keys**, and REST/Auth calls using the old API key return
401 `Legacy API keys are disabled`. This owner step succeeded; do not ask him to
repeat it or re-enable legacy keys.

The attempted checkout enable stopped before any flag write because the original
Storage retirement test still returned 200. A controlled header comparison at
06:37 UTC established the cause: the old service credential is also a valid
HS256 JWT. With the modern public API key plus that old bearer token, REST still
returns a private order row, and Storage still allows its privileged bucket read.
Responses are dynamic, not CDN cache hits. That established that the dashboard API-key toggle alone did not close the
exposure. Subsequent signing-key revocation closed this path; see final checks.

- Evidence: `legacy-disable-diagnostic.json`. No row contents or credentials were
  printed. `finish-live-checkout.mjs` now requires rejection of both old API-key
  and old bearer-token combinations on both REST and Storage before enabling.
- [Supabase signing-key documentation](https://supabase.com/docs/guides/auth/signing-keys)
  explains that legacy API keys are also JWTs and that revocation of the old
  signing key removes trust in those signatures. This supersedes the earlier
  assumption that API-key disable alone would complete retirement.
- At that earlier check, LIVE had not migrated and its public JWKS was empty.
  The owner subsequently migrated, rotated and revoked the old signing key. Auth
  token expiry remains 3,600 seconds. The agent did not reveal any signing secret.
- The isolated project already uses ES256. A fresh normal test-customer login
  produced an ES256 token, and both `verify_jwt=true` gateways reached their actual
  handlers: checkout returned its intentional 503 pause and private upload its
  expected 400 input validation. No 401 gateway rejection, payment or upload.
  Evidence: `isolated-es256-gateway-proof.json`. No direct JWT-secret verifier
  exists in the searched application/API/function source. Do not blanket-disable
  gateway checks based solely on the older documentation warning.
- All six public domains still serve v4; modern server reads and both signed
  artwork downloads work after the API-key disable. All 91 objects are unchanged.
  The live email cron remains active with a successful 06:42 UTC run.

## Remaining acceptance and existing backlog

The deployment and credential cutover are complete. No further approval is
pending for them. Remaining validation is fresh live customer/admin login and
persistence, plus a deliberate real paid order through saved artwork, order,
confirmation email, admin processing and production. Isolated success, duplicate,
failure and recovery tests remain separate evidence. The agent has not made a
real payment or supplier purchase. Existing users may need to sign in again after
revocation; their account passwords were not changed.

Existing editorial/demo labels, the 403 TypeScript diagnostics and dependency
advisory backlog remain documented; this release is not compiler/audit clean.
Physical production acceptance is separate from local CMYK/PDF checks.

Rollback: if a checkout issue appears, set STOREFRONT_CHECKOUT_ENABLED=false to
pause new payment creation while preserving paid-order finalization, email
recovery, all files/products/orders and restrictive access. Repair the specific
modern-key consumer. Never reactivate the exposed key or republish order-files.

Final evidence in tmp/production-rollout-20260916/: live-checkout-readiness-proof.json,
live-enabled-flags-proof.json, live-private-file-proof.json, public-domain-proof.json,
and live-post-rotation-probes.json. Earlier diagnostic artifacts are historical.
