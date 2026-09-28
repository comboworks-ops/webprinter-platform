# Production rollout checkpoint — 16 September 2026

Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

## Active cutover update — 16 September, 21:40 UTC

Thomas's “could you please get it live?” authorizes the previously presented
coordinated three-site switch and dedicated Stripe callback. **Live checkout is
currently paused** by the newly deployed creator v14 pending configuration and
verification. Public domains still point to the July 28 deployment.

- Eight exact prepared migrations applied successfully: checkout finalization,
  email outbox, domestic VAT snapshot, private-file capability foundation,
  branding compare-and-swap, storformat quote source model, customer file
  finalization and message read receipts. Existing business data is retained.
- Live matched functions deployed: creator v14, finalizer v1, signed webhook v1,
  file access v1, email dispatcher v1, send-order-email v16, pod2-create-jobs v13.
- Stripe endpoint `we_1UGQQzLlYyddTjieATsjFiVN` created ACTIVE on existing account
  `acct_1KEH0SLlYyddTjie`, only `payment_intent.succeeded`, pointing to the live
  `stripe-storefront-webhook`. Cookadeli's callback is unchanged. Signing secret
  has not yet been stored in Supabase; checkout must remain paused until it is.
- Automatic approval review rejected the tenant write-boundary migration for
  broad RLS disruption risk. Subsequent live read-only proof: 16 legitimate
  owner/admin/master shop scopes, none denied by the proposed predicate; zero
  mismatched price/product tenants; one old unscoped order retains owner read.
- Automatic approval review rejected PDF-preflight deployment because it sends
  customer PDFs to Print.com and may create a corrected copy. No supplier request
  or file correction was performed. Order-submit and shipping packets remain
  pending. The private-bucket migration remains unapplied.
- Fresh baseline before cutover: 4 orders, 3 order files, 91 storage objects.
  No new checkout attempts or email outbox rows. All 1,184 candidate source hashes,
  ten backend packets and ten migration hashes still match prepared release v4.

### Update at 21:50 UTC — waiting for owner responses

- Post-migration full-row checksums still match across all 23 product/pricing
  tables: **201 products and 357,913 generic price rows unchanged**. Orders remain
  4, order files 3, stored files 91, checkout attempts 0 and email outbox 0.
  Evidence: `tmp/production-rollout-20260916/cutover-inventory-proof.json`.
- All seven new live deployments were fetched back: every file byte and gateway
  setting matches its prepared packet. Proof: `tmp/production-rollout-20260916/cutover-progress.json`.
- The tenant migration was resubmitted with the new 16-scope compatibility proof;
  automatic review again rejected its broad production RLS/trigger scope. Do not
  retry or execute indirectly until the specific owner approval arrives.
- `pod2-order-submit` was also rejected because its existing production capability
  can send customer PDFs, recipient details and paid jobs to Print.com and mutate
  fulfillment state. Specific deployment approval is pending; no order submitted.
  `pod-shipping-possibilities` remains unattempted. Neither rejected packet was
  installed through another route.
- Dedicated order-email Edge secret and matching Vault entries are configured.
  `STOREFRONT_ORDER_EMAIL_MODE=disabled`; site URL is `https://www.webprinter.dk`.
  Cron job 3, `storefront-order-email-dispatch`, is installed every minute but
  **inactive** and reads its credential from Vault. The existing contact sender,
  shared Resend key and existing jobs are retained.
- Fresh HTTP checks: checkout creator 503 `checkout_backend_not_ready`; empty
  finalizer 400 `checkout_identity_required`; private file access 503
  `private_files_not_enabled`; status-email, job creation and email dispatcher
  deny guests with 401. The email dispatcher's valid dedicated credential returns
  409 `email_dispatch_disabled`; unsigned webhook 503 `webhook_not_configured`.
  No payment, email, upload or supplier call was executed. Probe harness first
  assumed every denial was 401, then was corrected to each handler's source
  contract; these were harness expectation errors, not changed production logic.
- Stripe's signing secret was copied privately and hidden again. The live
  Supabase Secrets form is open with `STOREFRONT_CHECKOUT_WEBHOOK_SECRET` as Name
  and the Value field focused. Owner must paste and Save under the browser
  credential-entry handoff rule. Do not place the credential in chat or logs.
- Pending user questions cover the exact tenant access-rule migration, Print.com
  PDF checking/corrected-copy behavior, and existing supplier order/shipping
  compatibility. Earlier general rollout approval remains valid for other work.

Resume: obtain those answers, verify saved webhook secret, complete held backend
dependencies and private storage cutover, purge storage CDN cache (not objects),
promote v4, verify the real domains, then enable and verify checkout/email. Finish
remaining legacy-key consumers before the separate owner credential-disable step.

Rollback: keep new checkout paused if any dependency fails; preserve all data,
new payment records and modern keys. Do not restore unsafe authorization or
exposed credentials. Do not promote until the matched private-file and backend
dependencies pass. The historical preparation report below predates this update.

## Earlier preparation checkpoint

Status at the earlier checkpoint: **HOLD for domain replacement and legacy-key disable.** Thomas authorized
the production rollout and key migration, conditional on retaining all existing
products. This checkpoint continues the earlier private-file staging acceptance.
A full candidate is deployed on its protected Vercel URL. No customer domain,
live schema, live bucket or credential revocation has changed in this checkpoint. No payment, email, image generation or supplier
request was sent.

## Completed live changes

- **41 existing Edge Functions migrated and their ACTIVE versions verified.**
  Most packets preserve the actually deployed source and change only key lookup;
  they require modern injected keys and cannot fall back to the exposed legacy
  credential on hosted deployments. Gateway settings and user authentication are
  preserved. Exact versions: `tmp/production-rollout-20260916/live-deployment-after-icon.json`
  and `live-key-migration-progress-final.json` in the same directory.
- `pricing-read` **v21 live / v38 isolated** now requires published products in
  both tenant and master lookups. Automatic review identified the omission in the
  old source. The regression exercises all three lookup paths; live read probes
  return 404 for the known unpublished product and 200 with 385 rows for published
  posters. No catalogue rows or prices were modified.
- `pod-explorer-request` **v14 live** uses the previously tested hardened source:
  master authorization before credentials, allowlisted product/quote operations
  and supplier hosts, bounded bodies, timeouts and redaction. Guest probe returns
  401 without calling the supplier. No supplier order or quote was requested.
- Live modern-public-key storefront lookup works; a guest cannot enter tenant
  administration. These are public/denied-request checks, not an authenticated
  production customer/admin acceptance claim.
- Vercel production build configuration now has the existing modern public key
  and `VITE_STOREFRONT_PRIVATE_FILES=true`. The latter is explicitly non-sensitive:
  Vercel initially redacted a sensitive public flag on pull, which was caught by
  validation and corrected before deployment. Existing running sites retain their
  previous bundled configuration until a new deployment is promoted.

Product preservation: before/after full-row hashes match across **23 tables in
each backend**. All **201 live products and 357,913 generic price rows** remain,
including options, imports, specialized prices and catalogue matrices. Evidence:
`tmp/production-rollout-20260916/preservation-{before,after}.json`.
The two destructive import-removal endpoints remain paused at live v8 / test v24.

## Release source and isolated backend

- All 13 application PDF.js loaders now enforce `isEvalSupported:false`, the
  documented mitigation for GHSA-wgrm-67xf-hhpq. Bytes and rendering settings are
  retained. A regression checks all loader call sites and hostile option override.
- jsPDF is **4.2.1**, React Router DOM **6.30.6**, and direct/nested DOMPurify
  **3.4.13**. Dependency changes are scoped; install scripts were disabled.
  Pre-change package/lock/workspace copies are retained privately for comparison.
- The existing production SVG whitelist was extracted into a tested guard and
  now also checks SVG namespaces. Normal geometry and local clipping are retained;
  script, event, image, pattern, gradient and external-reference injection probes
  fail before document import. Existing raster handling for images and gradients
  is preserved. Fabric remains at its existing major version.
- New checkout attempts freeze server-resolved format, dimensions, material,
  variants and paid option names. Orders retain the description, and receipts use
  the saved snapshot. Browser display labels cannot supply these catalogue names.
  Stored selections survive later catalogue edits; pre-existing attempts retain
  their original contract and retry parameters. No existing order is rewritten.
- Isolated checkout creator **v36**, finalizer **v20**, and signed webhook **v20**
  include these changes. Checkout/email remain paused there; no new payment.
- **145 focused tests pass**, Deno checks pass, Data API grants pass for 13
  migrations and function-exposure checks pass for 60 functions.
  TypeScript remains at **403 diagnostics**; three new test-only type diagnostics
  were corrected. Do not claim compiler cleanliness or full-suite acceptance.
- The existing isolated paid order was read and its QA invoice regenerated with
  jsPDF 4.2.1, rendered and visually inspected: Printmaker ApS, CVR/address, billing
  details, 443.00 net +110.75 VAT =553.75 paid, no new due date. It is a local test
  invoice, not an issued invoice or accounting action.

Latest production candidate:
`output/production-release-2026-09-16-private-modern-v4`.
Protected deployment: `dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX`,
https://printmaker-web-craft-main-lt8q42ls6-thomas-projects-d80b9ddd.vercel.app.
All **1,184 source hashes**, six server routes, their Supabase dependency traces,
and 305 static-file private-key-pattern scans pass. The modern public key and
private-upload production flags were retained. Three new asset-fetch tests pass;
TypeScript remains at **403 diagnostics**, none in the new helper/tests.

The first prebuilt upload failed because a node_modules symlink outside the
build root omitted server dependencies. `prepare-production-release.mjs` now
copies the existing locked packages inside the isolated workspace (no install
scripts). A subsequent hosted check exposed a protected-preview self-fetch issue:
HTML/favicon handlers now forward only the incoming Vercel access cookie/header
to the same origin and reject redirects without forwarding credentials. Vercel
Edge requires manual redirect checking, covered by the new tests. Guidance:
https://vercel.com/docs/deployment-protection.

All six live apex/www shop domains were observed on the July 28 deployment
`dpl_3HKtXdnXFpE5Ygj2VboG8mdfjtNg`; no `promote` was run. Evidence:
`tmp/production-rollout-20260916/live-domain-preservation.log` and `deploy-v4.log`.
Versions v2/v3 and their earlier deployment attempts are superseded. Do not
promote the static isolated preview or any earlier candidate.

Matched backend preparation: `output/production-backend-release-2026-09-16`
contains exact packets for ten functions and ten reviewed migrations with hashes.
Nothing from that packet was applied live. Pre-schema read-only inventory records
**4 existing orders, 3 file references and 91 stored order-file objects**, with
hashes; one historical order has a null tenant. Its records are retained. The live
bucket remains public. See `live-pre-schema-readiness.json` in the evidence folder.

The final dependency audit still reports **24 advisories (1 critical, 16 high,
7 moderate)**. jsPDF/DOMPurify findings are removed. PDF.js and Fabric remain
reported by version despite the application mitigations above. Remaining findings
include native-canvas installation dependencies (tar/brace-expansion), build CSS
dependencies and two React Router advisories. This is not a clean audit. Review
actual runtime exposure before claiming the broader dependency backlog closed;
do not silently force incompatible major updates in the Designer.

## Approval-review holds

Two prepared key-only deployments were initially rejected by automatic approval review.
Both are now resolved by explicit user approval. No rejection was bypassed:

1. `send-contact-message`: review requires explicit production email permission.
   Existing behavior sends submitted name/contact/message through Resend to the
   shop support address and sends the customer's acknowledgement. Current company
   addresses are `info@webprinter.dk` and `support@onlinetryksager.dk`. Thomas explicitly approved preserving contact emails in the next turn.
   Version **8** is now ACTIVE with exact deployed-source verification. An empty
   request receives the expected 400 before any database or email operation, proving
   modern-key module initialization without sending a message. Evidence:
   `tmp/production-rollout-20260916/contact-key-migration-proof.json`.
2. `icon-studio-generate`: unlike isolation, LIVE has OpenAI and Gemini credentials.
   Existing admin/owner/staff and module checks precede generation, but review
   requires explicit permission for reference-image/prompt egress and provider
   costs. Thomas explicitly approved this clarified behavior. Version **7** is now
   ACTIVE, all fetched source files match the key-only packet, and an unauthenticated
   request returns 401 before provider access. No image generation was requested.
   Evidence: `tmp/production-rollout-20260916/icon-key-migration-proof.json`.

The attempted live checkout foundation migration was rejected by automatic approval
review because restrictive order/storage triggers must ship with the matching
frontend and backend. **No live DDL was applied.** Prepare and verify the complete
coordinated release before requesting the specific remaining cutover approval.
Do not retry this migration through a different tool or a partial SQL workaround.

Stripe is signed into the correct Printmaker account `acct_1KEH0SLlYyddTjie`.
The Create destination form is prepared but **not submitted**: name Webprinter
storefront orders, endpoint `/functions/v1/stripe-storefront-webhook` on the live
Supabase host, Your account scope, snapshot payload, account API version
2020-08-27, only payment_intent.succeeded. The existing Cookadeli destination is
untouched. The shared-account event feed includes other successful payments; the
handler ignores those without the storefront contract marker. Browser policy
requires confirmation at creation for this new access to payment event data.
No webhook signing secret was created, revealed or stored.
Both concrete permissions (new Stripe event feed and coordinated live switch with
a temporary checkout pause) were requested together; replies are pending.

Hosted read-only acceptance: all three tenant homepages render on v4, including
the existing Webprinter banner preset. Salgsmapper still has the stored
"webprinter demo" header/footer label; this was not overwritten. Master posters
correctly show unavailable because that product is unpublished there; the live
published poster belongs to Onlinetryksager and renders correctly there: A3,
4+0, 135g matte, 10 units, 157 kr + 49 kr shipping = 206 kr before VAT.
No order/payment was started. No v4 server errors were found during
the homepage checks. These are public rendering checks, not payment/account
acceptance. Evidence: `candidate-hosted-proof.json` in the evidence directory.

## Remaining coordinated cutover

Both earlier email/provider approvals are resolved. Remaining work:

1. Finish the six matched functional consumers:
   creator, send-order-email, pod2-create-jobs, pod2-pdf-preflight,
   pod2-order-submit and pod-shipping-possibilities. Use the hardened staged source,
   not original unsafe key-only packets. Deploy new finalizer/webhook/file-access
   and email dispatcher with their required schema/configuration.
2. Apply reviewed additive LIVE checkout, outbox, tax, saved-design/customer-file,
   message and tenant-boundary migrations in dependency order. LIVE currently has
   only the September catalogue-grant and account-address repairs. Do not apply
   the isolated schema baseline or bulk-push timestamp mismatches. Inspect optional
   storformat column/constraint presence before its additive migration.
3. Configure the dedicated storefront webhook on the existing Stripe account
   `acct_1KEH0SLlYyddTjie`, preserving subscription/other-company integrations.
   LIVE presently lacks `STOREFRONT_CHECKOUT_WEBHOOK_SECRET`. Keep new checkout
   closed until its webhook and order/email recovery paths are ready. Production
   emails need explicit live mode and their dedicated worker authorization/config.
4. Deploy the full matched frontend and complete the private LIVE bucket cutover
   only when readers and binding RPC are ready. Purge the order-files **CDN cache**
   using the tested Storage endpoint; never delete the bucket or objects. Verify
   old public URLs deny, owned customer/admin signed reads work and foreign-tenant
   reads fail. Recheck original file and product inventories.
5. Migrate local script/private environment, cron/Vault and external consumers.
   The old live service key remains enabled; **41 migrated functions do not close
   the exposure**. Only after all consumers and the frontend work with modern
   keys, hand the final legacy-disable submission to the owner as required by the
   browser credential-change policy. Never request the admin password or change
   Auth signing keys. Verify the old key is rejected afterward.
6. Verify all three hosted shops, authenticated customer/admin operation and
   actual product selections. A real-money acceptance and supplier/physical PDF
   acceptance remain distinct owner/production steps.

Rollback: retain products, prices, orders, files, frozen paid snapshots and all
recovery handlers. Pause new checkout/email if integration checks fail. Repair
modern-key consumers; never restore an exposed key or the unsafe public pricing,
unrestricted supplier proxy or destructive removal handlers. The PDF dependency
changes need their security mitigations retained in any compatible rollback.

Evidence directory: `tmp/production-rollout-20260916/`. It contains private
configuration-adjacent artifacts; do not publish it. No Git commit/push or bulk
staging was performed.
