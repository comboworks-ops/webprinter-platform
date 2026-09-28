# Webprinter launch register

Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

Latest production cutover checkpoint (16 September, 21:50 UTC): **rollout started; LIVE checkout is temporarily paused; customer domains still show the prior version.** Eight additive migrations and seven matched handlers are deployed; all seven handlers were fetched back and match their reviewed source. The dedicated Stripe success callback now exists on the existing Printmaker account; its signing secret awaits the owner's Save action in the prepared live Supabase form. The email scheduler is installed inactive with dedicated protected configuration and no messages sent. Automatic approval review stopped the tenant access-rule migration and the Print.com PDF-checker/order-handler deployments; exact approval questions are pending. The live order-files bucket remains public, pending those matched dependencies; the exposed legacy key is not disabled. No new payments, supplier orders, PDFs, or emails were created. The full v4 frontend candidate remains READY but has not been promoted. See [the current rollout checkpoint](PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact progress, evidence, pending actions and rollback. Earlier checkpoints below are historical.

Latest key/file checkpoint (2026-09-16, 18:34 CEST): Thomas approved both
previously blocked actions, conditional on preserving products. Import deletion
is paused by zero-database-call HTTP 409 handlers in BOTH environments (v24 test,
v8 live for each removal endpoint). All 201 live products, 357,913 generic price
rows, options and imports are unchanged; full content checksums match across 23
tables in each backend. The isolated order-files bucket is now private. Its CDN
cache was purged after two old public URLs remained cached; all 11 original file
references then passed signed reads and public denial. Customer/tenant ownership,
history, paid files, supplier signed download without submission, anonymous
denials, immutable artwork, temporary PDF cleanup, signed-in capabilities and
replacement upload pass. All 20 original stored objects remain; the replacement
adds one file revision, with all 12 references bound and the old files retained.
The live file bucket, frontend, domain aliases and credentials remain unchanged.
50 existing isolated functions use modern keys; the removal endpoints need no
keys. Checkout/email remain paused; no payment, email or supplier order sent.
The exposed old live service key is still enabled. Current full production build,
matched live rollout, credential disable and browser acceptance remain open.
Prior 120 focused tests/build passed; 403 TypeScript diagnostics remain.
Read [the current migration checkpoint](KEY_AND_FILE_MIGRATION_2026-09-16.md) for proof and rollback boundaries.

Latest seller/key checkpoint (2026-09-16, 15:00 CEST): Thomas confirmed the
three-shop platform scope and Printmaker ApS as the invoice seller. Both isolated
and LIVE tenant settings now contain invoice_name Printmaker ApS, CVR 42683043,
and Stationsvej 17, 8544 Mørke for the three launch IDs. Shop/company display names,
branding and unrelated settings are preserved. Source admin invoice reads the
separate legal name; ShopSettings can edit it and preserves other company fields.
The real saved-order QA PDF now shows the correct seller/CVR/address, 25% VAT,
553.75 paid and no payment deadline. Four invoice tests and a fresh 12.00s full
build pass; six APIs, 1171 source hashes and 305 static secret scans verified.
Fresh candidate output/production-release-2026-09-16-printmaker-seller is NOT
deployed; previous colour-invoice candidate is stale after these source edits.
Existing modern Supabase public/secret keys are available. Modern public REST
and tenant-context probes passed live; backend consumers have NOT migrated and
old keys remain enabled. Current Supabase docs no longer permit legacy rotation:
use the staged modern-key migration in docs/PRODUCTION_KEY_REPLACEMENT.md.
Admin login/password is separate and unchanged. No new credentials, schema,
functions, live deployment, emails or payments. Live seller DATA changes above
are the explicit exception to earlier no-live-change checkpoints. File privacy,
production configuration snapshots and matched live rollout remain open.
See docs/PRODUCTION_RELEASE_2026-09-16.md for proof paths and remaining gates.

Latest release checkpoint (2026-09-16, 14:41 CEST): colour warning repaired by
removing the invalid PDF.js display-RGB inference; PDFs now require honest manual
colour review. Actual uploaded CMYK file on protected iv86ueuq5 preview shows the
neutral notice and 3 mm safety. Paid invoices use billing tags/frozen VAT and no
new due date; missing seller CVR blocks issuance. Staging admin API transitions
processing/production/problem and denied customer update pass; restored pending,
no mail/supplier/payment. 72 tests, full production build (six APIs), 1171 source
hashes, 305 static secret scans and grants check pass; 403 TS diagnostics remain.
Candidate output/production-release-2026-09-16-colour-invoice NOT deployed.
Old production service-role JWT issued Dec 2025 still grants admin access; exposed-
key rotation item remains open. Live order-files remains public. Await answers on
other apps using this backend and common Printmaker ApS seller/CVR/address. See
docs/PRODUCTION_RELEASE_2026-09-16.md and docs/PRODUCTION_KEY_REPLACEMENT.md.
No live credentials, seller settings, schema/functions or domain changes.


Updated: 2026-09-16 · Owner: Thomas · Status: **HOLD — VAT-inclusive browser test payment/order/PDF verified; remaining checks and matched live rollout remain**

Start here to see what belongs in the first release, what is known, and what to do next. This is the execution index; the [commercial roadmap](WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md) holds the broader direction and the [go-live log](GO_LIVE_READINESS_LOG.md) retains historical checks and the final launch decision.

**VAT resolved on staging — 16 September 13:49 CEST:** Denmark-only launch is
confirmed. The actual browser test now charges 553.75 kr = 443.00 net +110.75 VAT,
with one saved order, one exact-hash PDF and two pending emails carrying identical
tax evidence. Confirmation survives reload. Foreign delivery/old net-only amounts
are rejected before writes. Invoice amount helper/email renderer use the saved
breakdown; historical payments are not repriced. 60 focused tests, five Deno
checks, explicit grants and build pass. Test effects are paused again; no new
email, real payment, supplier action or live rollout. See the [release packet](PRODUCTION_RELEASE_2026-09-16.md)
for new preview qcxqy1pbk, exact versions, migration mapping and remaining checks.
Foreign customer location alone does not grant VAT exemption; international seller,
EU consumer/business and export tax treatment remain a later configured scope.

**Latest, 16 September 13:13 CEST:** the real Webprinter aluminium checkout now
passes PDF upload/approval → Stripe TEST card → one saved order/file → reload
confirmation. Finalized file hash matches the inspected 1200 × 600 mm CMYK PDF.
Two new emails are queued but unsent. Checkout is paused again (503), email
disabled (409), cron inactive. **The flow exposed a VAT blocker: 443 kr excluding
VAT is also the Stripe charge/saved total.** Delivery-country scope is awaiting
Thomas's answer before the tax repair. The RGB warning is also false for this
verified CMYK file because it scans normalized rendering operators. Neither
defect is repaired yet. New explicit checkout-test preview/34 tests/build and all
remaining details are in the [release packet](PRODUCTION_RELEASE_2026-09-16.md).
Earlier full production candidates are now stale; all live aliases remain unchanged.

**16 September deployment checkpoint:** Thomas authorized the three-site rollout.
The full production build, including six server routes, is prepared and verified.
The optional address-field repair is deployed on the live database. Latest branded
email functions are deployed and source-verified on the isolated backend. Thomas
approved the restricted Resend test key, which is now created and installed only
on staging. Three new Stripe TEST payments each produced an order and file through
the signed webhook. Resend reports seven test confirmations/operator/status/problem
messages delivered to support@onlinetryksager.dk; repeated calls produced no duplicates.
The Vault-backed scheduler passed one automatic HTTP 200 run, then was paused along
with checkout and email sending. Thomas confirmed receiving some test emails;
the complete set and visual/client approval remain unconfirmed.
Older key-access/creation blockers below are historical. All three live-domain
aliases remain unchanged. See the
[release packet, exact versions and remaining work](PRODUCTION_RELEASE_2026-09-16.md).


**Browser/PDF checkpoint — 16 September:** actual Designer export and stored
checkout PDF have correct 1200 × 600 mm trim, 3 mm bleed and CMYK vector artwork.
A reproduced cross-tab shop switch is repaired: each preview tab retains its own
shop through Designer → checkout → reload. Two regression tests failed before
the change; all 32 focused checks and the updated preview build pass. Actual
browser payment, supplier acceptance and the 3 mm/2 mm safety-label mismatch
remain open. The release packet contains exact artifacts and hosted evidence.

**Online review — updated 16 September:** the latest UI is available in a protected
[three-shop preview](https://printmaker-web-craft-main-q2ykt4y6m-thomas-projects-d80b9ddd.vercel.app/shop?tenantId=00000000-0000-0000-0000-000000000000),
connected to the isolated backend. See [setup, verification and update instructions](ISOLATED_ONLINE_PREVIEW_2026-09-15.md).
The historical localhost and 9 September preview still use live data. This new
preview is for browsing and design review; payments and outgoing email are disabled.
Production release remains HOLD.

## Target and scope

Current authorized target: update the three existing live sites after the matched repairs and acceptance checks. The earlier planning target was a supported print-house pilot around early October 2026, beginning with one shop and 3–5 reviewed products. The exact broader pilot catalogue and external print houses still need selection.

On 10 September Thomas authorized implementing the launch repairs and reviewing previously locked areas, including pricing, where changes improve the system as a whole. He subsequently approved an isolated Supabase branch in the existing “yebbo project” organization at the quoted US$0.01344/hour (about $0.32/day, plus usage), and signed into the existing Stripe account for test transactions. Assess connected flows and verify any behavior change. Public launch, customer communications and supplier orders remain separate. Preserve existing shop data and unrelated dirty work.

## Capability register

**Scope clarification — 10 September:** Thomas deferred an email designer and special-offer/campaign creation in the Social Hub to a later stage. They are not part of the current launch repairs. Current email work covers standard transactional order/status messages that inherit published shop branding; do not add a campaign builder or marketing-send workflow now.

**Current review: 10 September 2026.** [Full verification evidence](launch-review-2026-09-10/verification.md) and [all 545 scanned Markdown files](launch-review-2026-09-10/document-index.md). The table below supersedes earlier capability status only within its stated evidence. Historical session notes remain below.

The storefront, calculator, checkout handoff and designer render locally. **The six named maintenance endpoints are disabled on the live backend, and both public catalog views are read-only for public roles.** Deployed source readback, 12 denied HTTP requests and unchanged catalog reads verify that narrow repair. See the [implementation checkpoint](launch-review-2026-09-10/verification.md#implementation-checkpoint--10-september-2026) and [security evidence](launch-review-2026-09-10/security-remediation.json).

**The isolated branch `webprinter-launch-test` (`cyurochbkxggcobnxaxq`) now has the matched repair backend, synthetic test accounts/orders and isolated copies of the three shop catalogues and published branding (15 September).** Hosted testing exposed 11 tenant-boundary/save failures; a new migration fixes them on staging, where all 29 checks pass. Stripe TEST guest/customer success, decline, cancellation, 3DS, duplicate delivery and recovery after a deliberately blocked finalization pass. Four paid test orders each have one file and one pending email; no real money or email was sent. Checkout creation and email sending are disabled for the pause. See the [staging checkpoint](launch-review-2026-09-10/verification.md#isolated-staging-checkpoint--10-september-2026) and [staging evidence](launch-review-2026-09-10/staging-acceptance.json). The new tenant restrictions and payment/save/email packet are **not deployed to the live backend**.

**Email design follow-up — updated 16 September:** the shared template covers nine order-message variants and inherits published tenant branding. [Saved design preview](../output/email-design-2026-09-10/index.html) includes the three shops and a clearly labelled red-brand example. 31 focused tests, two Deno checks and 24 browser layout measurements pass. The latest renderer is deployed to staging, and Resend reports seven authorized test messages delivered. Their actual shop identity, Reply-To and tenant order links were inspected; Onlinetryksager's rendered logo/orange accent was verified. The test key, recipient and automatic schedule are configured; test effects are paused. Inbox/client appearance, remaining Auth/contact/quote letters and live rollout remain separate checks.

Local review: [Webprinter shop](http://127.0.0.1:8110/?tenantId=00000000-0000-0000-0000-000000000000). This is the current `ui-cleanup` worktree, port 8110/PID 3823, using the existing hosted data and live-mode Stripe public configuration. Avoid payment tests here; the separate protected test deployment has a frontend payment blocker.

| ID / capability | Current evidence | Remaining launch acceptance |
| --- | --- | --- |
| L01 · Development and release baseline | Build passes. Legacy-menu compatibility test corrected without changing selected menus. 524/524 Node tests across 90 files and 6/6 isolated numeric-input browser tests pass; 401 TypeScript diagnostics remain. | Review critical-path type errors; freeze the exact frontend/backend release artifact. These latest local edits are not a frontend deployment. |
| L02 · Product → designer dimensions | 16 September hosted preview: aluminium 120 × 60 cm → actual 1200 × 600 mm Designer → generated/stored approved PDF → checkout/reload. Correct 3 mm PDF bleed and shop identity. | Reconcile Designer 3 mm vs checkout 2 mm safety guide; extend proof to other advertised formats and production acceptance. |
| L03 · Exact options, price and template | Today, aluminium 100 × 100 cm = 436 kr; 120 × 60 cm = 314 kr plus 129 kr delivery, 443 kr through checkout. Master has 20 published products; all 18 matrix products have stored generic rows. Salgsmapper 1 mm template repair is recorded complete on 8 Sep. | Prove each advertised product/combination/server quote. Review the published adhesive product's old stored price model before promotion; new quote-model migration/data remain unapplied. |
| L04 · Upload, file checks and PDF export | 16 September actual browser export and stored-file comparison prove the single-page aluminium trim/bleed, outlined Danish text/vector artwork and four-channel FOGRA39 profile. Approved Designer file survives checkout reload. | Prove external uploads, imported PDFs, multi-sided files, failure recovery and print-house acceptance. Output is not PDF/X certified. Review public artwork storage and remaining product profiles. |
| L05 · Checkout and payment | Isolated backend has seven repair migrations, the tenant-boundary companion and five matching functions with exact source readback. 18 final payment checks pass, including guest/customer, decline/cancel, completed 3DS, duplicates and signed-webhook recovery. Four TEST payments produced four orders/files/outbox rows. Live creator remains v13 and lacks the matching finalizer/webhook packet. | Exercise the actual matching storefront frontend against this branch, verify connected-account charging where advertised, and deploy the reviewed frontend/backend packet together. Checkout creation is currently disabled on staging. |
| L06 · Order processing and fulfillment | Existing POD/production code and historical first-order evidence exist. No complete current-release order exercised today. POD job handoff remains interruptible in browser. | Demonstrate paid order → durable job/reconciliation → production file → supplier/manual production → status, invoice and refund/recovery responsibilities. |
| L07 · Tenant identity, access and domains | Live maintenance endpoint/catalog fixes pass. Staging tenant tests reproduced 11 failures before the new restrictive policies and pass 29/29 afterward, covering two owners/customers, platform admin, role escalation, settings/products/prices and order access. Live metadata has no mismatched tenant/product references among 357,913 generic price rows. | Deploy tenant restrictions with the matched checkout packet, not alone: direct customer order insertion becomes restricted. Confirm old credential rotation; review remaining legacy pricing/RPC/storage policies, signup and native-domain routing. This is not a complete security sign-off. |
| L08 · Notifications, delivery and support | Latest branded dispatcher v7/status v23 deployed on staging. Restricted dedicated Resend key installed; seven approved test messages provider-confirmed Delivered, including three shop confirmations, two operator emails, production status and test problem notice. Duplicate calls sent no extra mail; customer send denied 403; scheduler run returned 200. | Confirm recipient inbox/client appearance, complete matched live email configuration and schedule, and integrate remaining contact/quote/Auth letters. Test checkout/email/scheduler are paused; non-allowlisted historical emails remain untouched. |
| L09 · Storefront loading, copy and motion | Current real-data storefront renders; no captured product/checkout console errors. Main bundle 9.82 MB / 2.58 MB gzip. Demo/misspelled branding, English options, generic social links and conflicting contact details remain visible. | Finish production copy and details; measure loading on phone/network; recheck chosen design, navigation, responsive checkout and consent. |
| L10 · Site designer | Staging authenticated API checks now prove owner branding save/reload, stale-write protection, clean cross-shop denial and platform-admin saves. Customer file replacement/retry, read receipts and address isolation also pass there. The live backend still lacks these repair migrations. | Prove the actual draft/save/publish/reopen UI in two shops on the isolated backend, then deploy the matching packet. Preserve selected presets. |
| L11 · Product setup and everyday admin | Substantial existing admin UI, local fixture/source QA and historical owner-read proof. Today signed-out access correctly denied. | Use intended owner account to create/edit a reviewed test product, save/reload settings and process a test order against real hosted policies. |
| L12 · Signup, contact, legal and discoverability | Shop-scoped login, contact form and print guidance render. No signup/reset mail, legal acceptance or actual domain launch performed. | Verify real signup/reset redirects, contact receipt, legal/company details, consent persistence, canonical/sitemap behavior, domain/TLS and launch claims. |
| L13 · Supplier Bank / catalog expansion | Mature staging/import tooling and many historical reports. Data/import approval remains separate from platform release. | Review advertised supplier/product coverage and costs; do not activate new families or change prices through an audit. |
| L14 · Company Hub / business reordering | Foundation and request workflow exist; not re-exercised today. | If advertised at launch, prove real membership, scoped catalog, reorder, order/payment and operator handling. Otherwise keep outside launch promises. |
| L15 · AI operator, ERP expansion, optional PDF service | Explicitly future/optional work. Hosted `erp-shadow-dispatch` and `designer-pdf-service` are absent; main designer/export has its own local implementation. | Defer optional features while completing advertised core flows. Do not describe optional-service absence as a failure of every PDF export. |

## Next work in order

1. **Finish recipient review (L08).** Resend setup, seven delivered messages, duplicate checks and the automatic scheduler are verified on staging. Thomas confirmed receiving some; complete-set/client appearance remains open. Preserve the paused configuration until the next controlled test. Do not install a global `RESEND_API_KEY` on staging: it would activate older copied contact/quote handlers outside the order-email guards.
2. **Finish matching test frontend acceptance (L01/L04/L05/L10).** The protected isolated frontend now proves Designer file generation, storage and checkout reload. Ordinary localhost 8110 still uses live services. Add a controlled Stripe TEST checkout configuration, then exercise the actual payment form, external file approval, design/account saves and operator screens; the current review preview intentionally blocks payment.
3. **Complete the security release packet (L07).** Keep the already deployed maintenance/catalog repairs. Review remaining authorization and historical exposed-key rotation; pair the new tenant restrictions with payment/finalizer/frontend deployment. Never push the staging-only schema baseline to production or blindly replay the broken historical migration chain.
4. **Prove a complete customer order (L02–L08).** Reuse the successful hosted payment/duplicate/recovery evidence, then add actual production PDFs, customer/operator UI access, email receipt, durable production/reconciliation and operational failure handling.
5. **Finish every advertised journey (L03/L09–L12).** Test the chosen catalog, account/design save/reopen, admin save/publish, mobile/copy/performance, invoices/refunds/support, legal/contact and actual domains. The compatibility test is fixed; critical-path compiler errors remain.
6. **Rehearse and release.** Verify the exact hosted artifact, run a controlled production canary and record Thomas's launch decision, support ownership, monitoring and rollback. Then begin promotion.

### Decisions needed for completion

- First launch shop and advertised products; a small reviewed catalog reduces the initial test matrix, while every advertised product still needs acceptance.
- Existing Stripe connected-account ownership/destination-charge scope and shared merchant identity. Thomas confirmed Printmaker is shared with “Crocodile”, wants one company account, and accepts WEBPRINTER as the common payment label for the three print shops. The prepared creator now freezes that per-card suffix for new attempts; 22 checkout tests and Deno check pass. Account-wide prefix/receipts remain shared (test descriptor COOKADELI), and live statement/provider acceptance is open. The account-sharing and print-shop label choices are answered.
- Recipient review of the seven delivered test messages. Resend key creation, exact test inbox, isolated backend/preview, Supabase organization/cost and Stripe sign-in decisions are complete.
- Production owner, file/profile requirements, invoice/refund procedure and support contact for the selected products.
- Final public-domain rollout timing after acceptance. The 15 September protected preview uses the isolated database; it is not a public-domain promotion.

The previous four-week outline was a planning suggestion, not a delivery commitment. The current ordered gates above govern the next work; no dependable launch date is set until security and transaction acceptance are closed.

## How to keep this useful

Update the relevant row after work; do not create a new dashboard or parallel readiness report for every task. Record **date, environment, revision, exact route/product, observed result and evidence link**. Keep failures until a later proof explicitly closes them. Source inspection, test pass, local browser pass, deployment and production acceptance are separate milestones.

A pilot is ready only when all required rows are accepted for its named scope, the file/order/payment/production trail is repeatable, tenant isolation is proven, and the final owner decision is recorded in the [go-live log](GO_LIVE_READINESS_LOG.md). A deferred feature is excluded from the promise; it is not marked complete.

## Latest update

- **2026-09-10, branded email preparation:** Implemented a shared local email design for confirmation, guest/operator, processing, production, shipment, delivery, action-needed and cancellation variants. Published tenant branding is selected server-side and the provider payload freezes before any send/retry; sender display name varies by shop while the verified mailbox stays configured. Read-only live branding supplied preview colors/logos; no live shop settings changed. Added dedicated test email-key selection to avoid enabling legacy contact/quote handlers. 31 focused tests, two Deno entrypoints and 24 width measurements pass; browser screenshots inspected for blue, orange and red examples. No new deployment, provider call, key creation or email. Resend access succeeded, but automatic review blocked creating the prepared sending-only key pending explicit creation permission; approved test inbox also pending.

- **2026-09-10, isolated staging:** Created the approved schema-only branch in “yebbo project”; repaired its failed historical bootstrap without copying customer data. Deployed seven prepared migrations, five functions and the new tenant-boundary migration. Hosted tenant/save checks improved from 18 pass / 11 fail to 29/29 pass. Stripe TEST success, decline, cancellation, 3DS, duplicate callback and a genuine HTTP 503 → retry → HTTP 200 recovery pass; four test payments produced one order/file/pending confirmation each. Checkout/email creation are disabled pending Resend key authorization and an approved inbox. Resend domain is already verified. No live business data, real payments, email, supplier order or frontend deployment; newer tenant and payment repairs remain staging-only. See the current staging checkpoint above. This supersedes the Stripe-login/backend-choice pause below.

- **2026-09-10, implementation:** Closed the two named endpoint/view findings on hosted Supabase with verified rejection/read behavior; corrected the local legacy-menu assertion and upload-limit copy. 524 Node tests, six browser fixtures, the SQL permission fixture, six Deno entrypoints and the build pass. 401 app TypeScript diagnostics remain. Stripe test-dashboard navigation reaches sign-in; only the main Supabase branch exists. Pause for Stripe login and the isolated-backend organization/cost decision before matched payment/save/email acceptance. The old key-rotation task is still unverified. No business records, prices, payments, emails or supplier orders changed; no frontend deploy or Git index change.

- **2026-09-06:** Created from the [5 September review baseline](LAUNCH_REVIEW_BASELINE_2026-09-05.md). No new runtime validation or defect fixes in this documentation task. Next: L01.
- **2026-09-06, subsequent local repair:** Replaced the broken dependency symlink using the frozen lockfile; manifest and lockfile hashes stayed identical. Confirmed Vite listener/checkout and aluminium-route HTTP 200; production build and 48 contract tests pass. Browser tool reports the Mac is locked, so canvas, exported PDF and return-flow proof remain open. No application-source changes or deployment. Next: unlock Mac and complete L02 in the browser.
- **2026-09-06, interactive localhost:** Restarted port 8110 and visually verified the exact aluminium route in Codex. Size controls, pricing matrix and total rendered; no console errors captured. Mac unlock blocker is cleared. Left the tab open for the user's review; designer/PDF proof remains pending.

- **2026-09-07, resumed system review:** Restarted loopback Vite at `127.0.0.1:8110`, PID 12175, and verified its working directory is this checkout. Branch `ui-cleanup`, HEAD `c0ee02839e4329c6c8543101e4fca4d9d0222cda` plus existing dirty work. In the browser, aluminium 100 × 100 cm, 1 piece, white 3 mm board, product price 436 kr and delivery 129 kr retained a 565 kr total through `/checkout/konfigurer?force_domain=webprinter.dk`. The checkout designer button opened `widthMm=1000&heightMm=1000&bleedMm=3&safeMm=2`; the designer heading shows 1000 × 1000 mm. Added one temporary blue rectangle and attempted Print PDF export with bleed. The dialog returned to the editor, but browser download capture timed out and no matching PDF was found in Downloads; this does **not** establish a valid PDF or an application export defect. No captured error logs; a Framer Motion deprecation warning was present. The narrow editor preview also leaves little canvas space beside the properties panel. `Fortsæt til checkout` was not exercised: source inspection shows it uploads the generated file to Supabase Storage, and localhost shares hosted data. No order, payment, production-file upload, application-source edit or deployment. L02 remains open for a captured PDF with measured page boxes, the non-square case and the production-file return flow.

- **2026-09-07, actual PDF verification (22:34–22:37 CEST):** Continued on the same local checkout/server. An isolated Chrome tab using the same product and dimensions downloaded the real application output without any source instrumentation; the original in-app designer remained open. This clears the missing-artifact blocker for inspection, but does not prove why the in-app download failed. Three one-page files were captured from Downloads and preserved under `output/verification/aluminium-pdf-2026-09-07/`:
  - [1000 × 1000 mm, bleed on](../output/verification/aluminium-pdf-2026-09-07/1000x1000-bleed.pdf): MediaBox **1006 × 1006 mm**, image 6287 × 6287 px.
  - [1000 × 1000 mm, bleed off](../output/verification/aluminium-pdf-2026-09-07/1000x1000-no-bleed.pdf): MediaBox **1000 × 1000 mm**, image 6250 × 6250 px.
  - [1200 × 600 mm, bleed on](../output/verification/aluminium-pdf-2026-09-07/1200x600-bleed.pdf): MediaBox **1206 × 606 mm**, image 7537 × 3787 px. This rectangular case was launched directly into the designer, not through checkout. A horizontal fold guide was added deliberately and does not appear in the exported rendering.
  - All PDFs were parsed with pypdf and rendered with Poppler; all three renders were visually inspected. The blue rectangle remains centered with the expected proportions. Trim/safety guides and selection handles are absent. **Grey editor outline is visibly baked into both bleed-on PDFs**; the no-bleed control has clean white edges. Source tracing finds the document background has an editor stroke (`EditorCanvas.tsx`, background rectangle), while `hideExportGuides.ts` includes that background in export without removing its stroke. This is an export defect at the outer bleed boundary, not the trim line.
  - All files contain one flattened `/DeviceRGB` image at approximately **158.7 ppi**, only an explicit `/MediaBox`, and no `/OutputIntents`. This confirms the current Print PDF route uses the proofed RGB capture; it is not evidence of vector preservation, embedded CMYK output or a PDF/X workflow. Color/resolution suitability needs the pilot printer's production requirements.
  - [Machine-readable measurements and SHA-256 hashes](../output/verification/aluminium-pdf-2026-09-07/measurements.json) accompany the PDFs and PNG renders. No application-source edit, order, payment, upload, save-to-account or deployment was performed. L02 is partially proven locally; L04 must address the outline and production metadata before production approval. Non-square checkout forwarding, upload-to-checkout return and deployed behavior remain unverified.

- **2026-09-07, export fixes authorized and implemented locally:**
  - `hideExportGuides.ts` now temporarily clears only the document background's editor stroke and stroke width, preserves its fill, invalidates its render cache and restores the exact stroke/visibility/export state after success or failure. Customer artwork borders are untouched. Added success/failure regression cases; both failed before the fix and pass afterward.
  - New `setPdfPageBoxes.ts` sets explicit point-based `/TrimBox` and `/BleedBox` on the current jsPDF page and rejects mismatched/invalid geometry. Connected to Print/Proof download exports, raster checkout-file generation and every page of linked-template checkout PDFs. Original-upload pass-through and vector-preserved PDF routes were not changed. Five serialized-PDF tests cover square, landscape, portrait, no bleed and multiple pages; they failed without the helper and pass with it.
  - New `exportRasterScale.ts` replaces the hook's incorrect 96 dpi assumption with the actual editor pixels-per-millimetre value. Existing intended targets remain 300 ppi through 1000 mm trim length, 150 ppi above 1000 mm through 2000 mm, and 100 ppi above 2000 mm, capped at 10000 pixels on either captured axis. The square-metre-with-bleed case calculates about 252.5 ppi at the cap; a 1200 × 600 mm design targets 150 ppi. This is calculated/tested resolution, not a post-fix downloaded-file measurement. Worker color transforms and proof overlay behavior are unchanged.
  - Verification: **19 focused tests pass**, production Vite build passes, focused helper typecheck and diff whitespace check pass. Whole-project TypeScript checking still has **493 diagnostics**; an in-memory check substituting the exact pre-edit file snapshots reports the same 493, with **zero added diagnostics**. Build retains existing chunk/LCMS warnings. Logs and pre-edit snapshots are in ignored `tmp/pdf-export-fix-before/`; no branch switch or existing dirty edits were discarded.
  - **Browser limitation:** an existing Chrome handle, a fresh Chrome test tab and browser availability query each timed out; browser control reset its session. Therefore no post-fix PDF or visual proof is claimed. Repeat the three preserved baseline cases once browser control is available; also inspect saturated colors, an object crossing the trim edge, guide restoration and unchanged soft-proof overlay. Do not close L04 based only on these code/tests/build results.
  - Color choice was presented to Thomas; no answer arrived during the independent implementation. Existing flattened RGB/proof color behavior is retained as the stated interim assumption. Choosing and embedding the correct production ICC profile, vector requirements and printer acceptance remain open; this work does not claim CMYK or PDF/X output.
  - Rollback is limited to this turn's outline restoration, finishing-box calls/helper and physical raster-scale wiring/helper, using the pre-edit snapshots to distinguish earlier dirty work. No DB, pricing, order, upload, payment, publication or deployment change.

- **2026-09-07, visual overhaul exploration:** Thomas requested five close-to-current Webprinter directions, then three variations of each existing site preset. Captured the loaded local master storefront and ordering section. Generated and displayed five independent storefront concepts; numeric selection order is saved in `output/design-exploration/webprinter-2026-09-07/display-order.json`. No option selected or implemented. The source has 30 named visual presets (90 requested follow-up variations), recorded in `preset-inventory.json`; these are still planned. The brief preserves blue Webprinter identity and current print-commerce tasks, with typography, spacing, simple controls, responsive and motion criteria. These are static concepts, not working UI, animation verification or changes to stored branding. The broader admin/site-editor redesign remains later scope. Browser access recovered for visual reference capture; this did not re-run the pending post-fix PDF download checks.

- **2026-09-08, selected storefront designs implemented locally:** Thomas selected all five concepts and made displayed option 1 (Precise Print Grid) the new default; options 2–5 are selectable presets. Registered five print themes and added their image picker to the existing Site Design draft workflow, with older themes/effects collapsed beneath it. Existing explicit theme choices, tenant identity, navigation, authored copy and product configuration are preserved; no hosted branding save or publication occurred. Development-only comparison is available at `/shop?tenantId=00000000-0000-0000-0000-000000000000&design=1` through `design=5` on port 8110. All five designs were compared against their selected reference and checked at desktop 1488 × 1058, tablet 768 × 1024 and phone 390 × 844 without horizontal overflow or failed images. Shared picker, mobile menu, product search, quantity and size updates worked; the product link opened the real aluminium pricing page with tenant context. Three preset contract tests and the final production build pass; whole-project TypeScript remains at 493 pre-existing diagnostics, zero added. [Design QA](../design-qa.md) records fixes, screenshots, intentional live-data differences and verification boundaries. No pricing/POD calculations, DB, order, payment or deployment changes. The further 90 legacy-preset concepts and broader editor redesign remain planned. L02/L04 post-fix PDF/production proof remain open.

- **2026-09-08, order-flow visual exploration:** Thomas requested page-by-page choices extending the approved storefront designs across the calculator and checkout journey. Created and displayed 18 independent concept images: three each for calculator, combined file/contact/delivery checkout, file proof, designer, payment and confirmation. Grounded in the approved storefront references, captured local aluminium calculator/checkout/designer and existing proof/payment/success component source. The adhesive product currently reports no storformat materials or price; preserved that observation without changing pricing. Added a local [design review page](../output/design-exploration/order-flow-2026-09-08/review.html) with default/alternative choices and notes per page, browser-local persistence and JSON export. All six groups and 18 images load; selection/persistence/zoom checks pass, and desktop/phone review layouts have no horizontal overflow. User selections are pending. [Review notes](../output/design-exploration/order-flow-2026-09-08/REVIEW_NOTES.md) record numbering, generated-copy corrections, exact-geometry and VAT/Stripe validation boundaries. These are static visual options, not implemented order pages or production proof. No application UI, pricing/POD logic, hosted branding, storage upload, payment, order, schema or publication changes. Earlier PDF and commercial-readiness gates remain open.

## 8 September 2026 — selected order-flow UI

Implemented the approved per-page defaults/alternatives: product 2/1, checkout 6/4, proof 7/9, designer 12/11, payment 13/15 and confirmation 16/18. Site Design now has a draft picker for each pair; no hosted save or publication was performed. Local UI and responsive checks are recorded in [the implementation note](ORDER_FLOW_DESIGNS_2026-09-08.md) and [design QA](../design-qa.md). Existing storefront QA is preserved in [its archived report](STOREFRONT_DESIGN_QA_2026-09-08.md).

The actual aluminium quantity/price selection, checkout transition, delivery changes, contact editing and designer tool/layout switching were exercised. Proof/payment/confirmation visual checks use explicitly labelled example data. This update does **not** close L02 or L04, verify real payment/order/email/fulfillment, or establish readiness for publication.

## 8 September 2026 — system debug review

[Current debug report](SYSTEM_DEBUG_REVIEW_2026-09-08.md): production build and 260 source tests pass; the refreshed owned-tenant browser check passes 11/12. Actual master and tenant-context admin reads, order detail, Site Design and design library were checked with the owner's master session. The non-square aluminium checkout/designer/back journey preserves 1200 × 600 mm; PDF/file return remains open. Fixed tenant support read receipts and stale browser assertions locally. Hold release for the reproduced Site Design saved-style overwrite, missing default 1 mm folder template, inconsistent support context, and exact release-packet preparation. Separate-tenant authorization, hosted save/reload and transaction acceptance remain unproven. No push, deploy or business-data write occurred.

## 10 September 2026 — current launch audit

Scanned the project Markdown inventory, reran 89 Node test files/build/type/grant/exposure checks, exercised the public local order journey through the Designer, and read the actual hosted migrations, function source and database privileges. The current capability table and completion order above are refreshed. Security exposure and absent backend repairs keep launch on hold. No application-source fix, business-data mutation, payment, email, supplier operation, Git staging/commit/push or deployment occurred. [Evidence and tool/access requirements](launch-review-2026-09-10/verification.md).
