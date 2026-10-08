8 October 2026 — current application release prepared from main 5d65b9cf plus reviewed local UI/designer changes. See docs/WEBPRINTER_RELEASE_2026-10-08.md. Preserve the original ui-cleanup work and staged edits; Banner Builder and backend/product publication remain separate.

28 September 2026 — automatic sales-folder 3D batch complete locally: Thomas approved 10 mm and authorized all sales folders in one pass. 143 review variants / 1,421 exact PDFs / 79 geometries; 142 configured catalogue variants share product/Designer/checkout rendering. A4/A5/A6/M65/21 × 21 cm, all linked capacities, flap/window/closure types and 4+0/4+4. Legacy 5 mm is modelled but unbound because its product selection metadata is absent. 46 tests, TS/lint/build, all-143 browser render/unfold checks, two-sided PDF rejection/preservation and six responsive widths pass. No publication/deployment. Read docs/3d-review/PROJECT.md and SALES_FOLDER_BATCH.md. Supersedes earlier 007-pending and one-at-a-time sales-folder notes.

28 September 2026 — 3D review handover for a fresh chat: read `docs/3d-review/PROJECT.md`. Candidates 001–006 are approved and enabled in local shared preview code; 007 (10 mm A4 sales folder) is ready for review but NOT approved. The canonical queue remains `docs/3d-review/plan.json`. `MODEL_REVIEW_TEMPLATE.md` supplies a worksheet; `NEXT_REVIEW.md` is intentionally blank. Preserve the existing models, exact-fingerprint approval scope, dirty work and open drafts. Product publication/hosted acceptance remain separate.

28 September 2026 — WebPrinter owns the shared 3D system: removed the single Salgsmapper product-ID dependency; models resolve from reviewed template fingerprints and product-owned presentation rules in pricing_structure.workspaceContent.preview3d. Array conditions keep section/value IDs compatible with the existing recursive import remapping; no SQL/pricing changes. Existing two-flap preview retained. Master catalogue currently contains Salgsmapper uden vinger, a different construction that remains unmodelled. No live master assignment/editor, product creation, publication or deployment performed. 25 tests, TS/lint/build and existing six-width login/upload/checkout browser regression pass locally; remapped tenant fixtures are not hosted import acceptance. See docs/FOLDER_3D_PREVIEW.md and output/qa/webprinter-3d-core/.

28 September 2026 — product-page upload correction: Upload fil now requires login in an inline dialog, uploads through the existing private-file service and shows actual artwork without navigating. The regular order action carries the file into checkout with proof approval required. Template/account changes clear the local draft; product-page reload persistence is not added. Removed hardcoded order-layout header overrides so saved shop branding remains consistent. 22 focused tests, whole-app TS, scoped lint/build, six-width browser QA, simulated login/upload/sign-out, variant reset, file-hash handoff and header parity across four routes pass. Authentication/storage intercepted; no hosted writes or deployment. Prior upload-shortcut navigation below is superseded. Evidence: output/qa/folder-inline-upload/report.json and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — compact product 3D controls and upload shortcut: one small specification line, corner camera controls and small fold buttons under the picture; removed the inline instruction/footer blocks. Eligible 4+0 previews include an Upload fil shortcut to the existing checkout upload/placement flow using the current price-panel action. Both calculator layouts, six widths each, a 320 px touch browser, selected-quote/template preservation and fresh PDF-to-3D passed. Eleven tests, TS, scoped lint and final build pass. Storage intercepted in QA; no hosted writes, saved layout change or deployment. Evidence: output/qa/folder-compact/report.json and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — corrected product-page 3D placement: ProductPrice now places a photo/3D switch in the actual product media area; removed price-summary modal actions. Shared renderer retains plain branded product colours and actual customer artwork in upload/designer. Salgsmapper currently saves layout 1; review uses existing Nordic Product Studio via orderDesign=2 (photo left, selections right, matrix below), without changing published branding. Actual-page six-width checks, quote preservation, fresh PDF upload, proof-placement-to-3D updates, latest designer artwork/state preservation, eleven tests, TS/lint/build all pass locally. Original designer tab preserved; storage writes intercepted; no hosted changes or deployment. Review: http://127.0.0.1:8160/produkt/standard-sales-mapper-kopi-2?force_domain=salgsmapper.dk&orderDesign=2. Evidence: output/qa/folder-placement/ and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — compact plain 3D folder in the product order section: shop-colour model without graphics/text; selected 4+0 shows white inside and 4+4 colours both sides. Exact product configuration mapping bridges the missing 4+4 template for illustration only; uploaded/designer artwork remains 4+0. Shared dialog now max 780 px / stage 350 px. Eleven tests, whole-app TS/build, scoped lint, six-width browser checks and real product selection/quote-preservation checks pass. No pricing/template data changes, hosted writes or deployment. Review: http://127.0.0.1:8160/folder-mockup.html. See docs/FOLDER_3D_PREVIEW.md.

27 September 2026 — customer-artwork 3D folder preview: added a shared lazy Three.js viewer to checkout uploads and the online designer for the reviewed A4 / two-flap / 1 mm / 4+0 template. Actual artwork follows each fold; guides stay out; orbit, zoom, clickable folds, keyboard controls and flat fallback included. Separate local try-it page: http://127.0.0.1:8160/folder-mockup.html. Eight focused tests, whole-app TypeScript/build, scoped lint and responsive/file/actual-page browser fixtures passed. Storage calls were intercepted locally; no production writes or deployment. Existing previews/drafts untouched. See docs/FOLDER_3D_PREVIEW.md.

27 September 2026 — banner size layout repaired: shared structural CSS accidentally capped the entire dimensions card at 90 px. Explicit header/meta classes, container-sized fields, full-width mobile slots and wrapping alternative hero remove overlapping inputs and squeezed headings. 80 field-level browser checks, area/keyboard interaction, app TypeScript and final build pass; existing Storformat lint baseline unchanged. Main source plus 8143/8144 copies updated; no hosted writes or deployment. Review screenshots refreshed. See docs/BANNER_DIMENSIONS_LAYOUT_FIX_2026-09-27.md.

27 September 2026 — saved-design propagation verified: actual Site Designer draft save/reload and publication through the tenant adapter passed for the four new designs in an isolated browser-local backend. Unpublished draft left the customer catalogue unchanged; all 16 normal customer route checks read the published theme without query overrides. No source fixes, hosted writes or deployment. See docs/PRINT_JOURNEY_ACCEPTANCE_2026-09-27.md.

27 September 2026 — connected shopping journey: Everyday Gifts, Format / Signage, Merch Studio and Print Partner now carry their styles through the customer catalogue, product ordering and checkout, including branded payment/proof portals. Original five themes and Printstudio preserved; order layout choices and pricing/checkout handlers unchanged. 72 responsive route checks, 16 alternate/dialog checks, custom-font/colour portal checks, 19 tests, TS/lint/build pass locally. No hosted save or deployment. See docs/PRINT_JOURNEY_QA_2026-09-27.md.

27 September 2026 — approved standard homepage collection: keep original choices 1–5; Everyday Gifts (6), Format / Signage (7), Merch Studio (8), Print Partner (9), and the restored Printstudio (10) are built into Site Design → Shopdesign. Both the normal editor and local comparison picker use the same ten-choice collection. Existing tenant selections and the Refined Familiar default remain unchanged. Implemented in the working source; no deployment or tenant save/publication. See docs/HOMEPAGE_DESIGNS_QA_2026-09-27.md. Production list page is the next task and is not changed here.

24 September 2026 — compact Fælles knapper follow-up: master controls now use Farver & form / Effekter / Knapbank groups and Normal / Hover / Valgt colour states, with the duplicate large preview removed. All effects/functions retained; locks stay in contextual page/button settings. Isolated preview now uses actual SiteDesignWorkspace/navigation, including Fælles knapper menu activation and connected product components. Six-width browser checks, local-lock/master propagation, bank apply, whole-app TS/build and changed-component lint pass. Active 8113 still untouched pending preservation of its unsaved draft and loading authorization; previous automatic-review block remains. See docs/SHARED_BUTTONS_2026-09-24.md.

24 September 2026 — Fælles knapper implemented in workspace: separate CTA/selection masters, ten effects, state colours/shape, selected-design reset, draft button bank, section and per-product locks; real storefront/price-grid wiring. 52 tests, whole-app TS/build, no new scoped lint signatures, isolated responsive/keyboard/persistence checks pass. Preview: http://127.0.0.1:8136/button-lab.html (synthetic, no backend). IMPORTANT: active 8113 source and unsaved user draft remain untouched. Automatic approval review blocked editor interaction because reload could lose the draft; user must preserve the draft and authorize loading changes before scoped runtime sync. 23 tested files and unchanged-active hashes recorded. No hosted writes/publication. See docs/SHARED_BUTTONS_2026-09-24.md.

24 September 2026 — section settings and exact bank selection: title opens section text/appearance; option opens its contextual bank with the exact product value first, including imported-only values. Hidden editor contents are grey/striped; full-box/button drag copies clear on pointer release; frame fits the complete product page. 43 focused tests, full TS/build, unchanged three-error lint baseline, authenticated local click/drag/hide and six-width checks pass. All 11 scoped files match active 8113 copy. Original unsaved user draft preserved; QA tab closed/viewport restored; no hosted save/publication. See docs/PRODUCT_CANVAS_SELECTION_2026-09-24.md.

24 September 2026 — product canvas direct editing: compact draggable section titles/+; no global bank or placement menu; clicking an option/matrix material opens its name and contextual bank in the left panel. Empty boxes support bank type selection, add/replace preserves source and price identities, current attributes feed preview. Optional choices toggle directly; required settings remain. 35 tests, full TS/build and unchanged lint baseline pass; actual click/drag/optional-toggle checks pass. No hosted writes/publication. Native reset dialog in agent QA IAB tab2 blocks final cleanup/responsive sweep; user asked to close it. See docs/PRODUCT_CANVAS_DIRECT_EDITING_2026-09-24.md.

23 September 2026 — unified matrix product canvas editor implemented locally: formats/materials/section content and appearance share the preview workspace; direct section/option drag, up/down/swap, placement undo, contextual searchable bank and edit-only controls. Reuses existing draft/apply guards; no pricing/POD/schema changes. 30 tests, whole-app typecheck/build, no lint regression and 320–1440 px authenticated preview checks pass. All 14 scoped files match active 8113 recovered copy. No hosted writes/publication; live save/readback and physical touch acceptance untested. Mac locked during final QA-tab reset/viewport cleanup; confirm that cleanup after unlock. See docs/PRODUCT_CANVAS_EDITOR_2026-09-23.md.

# Agent Handover

23 September 2026 — product image/large-file upload fixes implemented locally. Product image transfer retries/progress, reference-first removal, unsaved editor preservation; chunked 1 GiB checkout candidate with bounded hashing/PDF reads and server-side copy. 37 focused tests, recovered-copy TypeScript/build, local synthetic 1 GiB interrupted-transfer test pass. Live 50 MiB limit is intentionally retained until matching backend activation; delivery destination/retention and authenticated image upload acceptance remain open. No live writes/deployment. See docs/PRODUCT_UPLOAD_FIXES_2026-09-23.md.


22 September 2026 — legacy cleanup and scoped Site Design candidate: full application TS now 0 (previous 171 included one missing shared-file diagnostic; complete baseline 170). ESLint 2,354 → 1,980 errors / 156 warnings; all remaining errors are explicit any. 42 proven-unused files archived verbatim with hashes/import evidence. 50 source files repaired; pricing formulas and production rules preserved. New typecheck/health commands retain original rules and reject per-file/rule lint increases. 536 application tests; 51 scoped tests; 31 synthetic browser checks on each candidate; both production builds pass all six server routes. Recorded production baseline 1,184/1,184 hashes verified; scoped patch has 66 source changes plus presentation assets/config/lock housekeeping, API/shared backend unchanged. No deployment or live write. All 1,274 full-build inputs match the working repository; unrelated existing worktree changes remain. All three public shops still serve the recorded entry bundle; authenticated deployment metadata returned Vercel team-scope 403 and remains a release gate. Deployment freshness/authorization and real auth/order/device acceptance remain open; shop/product/devices pending. See docs/SITE_DESIGN_LEGACY_CLEANUP_2026-09-22.md and docs/SITE_DESIGN_RELEASE_PACKET_2026-09-22.md. Do not deploy the full-worktree artifact or replay the prior live permission migration.

22 September 2026 — Site Design remaining-item pass: user chose free/master-assigned templates; canonical creation is fixed at zero, assignment copy is explicit, and legacy prices/purchases remain. Application TS 380 → 171; src ESLint 2,731 → 2,354 errors, 173 warnings; all 10 hook-rule errors resolved without weakening checks. 199 local tests and 31 synthetic browser checks pass. Full local production build passes all six server routes with no packaging type error; 1,302 source/config files verified. Read-only schema introspection only; no hosted writes, payment, messages, supplier action or deployment. The artifact includes prior unrelated worktree changes and is not a scoped production release. Repository debt, auth/commercial/device acceptance remain; shop/product and available-device input is pending. See docs/SITE_DESIGN_RELEASE_PACKET_2026-09-22.md and the latest audit continuation. Preserve the existing worktree and permission restrictions.


21 September 2026 — Site Design continuation: all 102 known original build placeholders are downloaded and SHA-256 identical to prior verified recoveries. Fixed two browser-reproduced HeroSlider reduced-motion bugs: fallback text movement/delay and an initial video play request. Three local source files changed; existing branding/defaults/pricing/publishing are preserved. 66 application tests and 39 media browser checks (1280/768/390) pass. Same-environment TS 386 → 380, no new signatures; HeroSlider lint 4 → 0. Full current-source local Vercel production build passes with all six server routes and 1,289 matching source files; separate temporary dependencies, no deployment or hosted write. Billing choice, remaining type/lint debt, scoped frontend rollout and commercial/physical-device acceptance remain open. See `docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md` final section and `output/site-design-audit-2026-09-21/media-and-types/`. Preserve the dirty worktree and existing restrictive permissions.


21 September 2026 — product presentations 1/3/4/5 implemented locally as selectable Site Design homepage/catalogue layouts; option 4 has optional hover/focus motion, all use existing product data. 11 tests and eight-file syntax/transpilation pass. Final visual/build/type/lint and authenticated persistence acceptance remains open after dependency failures/browser timeouts. No hosted save/publish, pricing/POD/schema changes. See [implementation and QA evidence](../docs/PRODUCT_PRESENTATIONS_2026-09-21.md).


20 September 2026 — Jev supplier URL-import pilot prepared locally. Optional master-only suggestions, explicit category adoption with reanalysis, descriptive properties copied only to review notes; no pricing/POD writes. Default off without TYPESAFE_API_KEY and SUPPLIER_JEV_ENABLED. Client/handler/synthetic browser checks pass; no live Jev accuracy or hosted activation claimed. See `docs/JEV_SUPPLIER_IMPORT_PILOT_2026-09-20.md`.

20 September 2026 — selected wide-format 8 and machine 11 implemented in the actual app: product locator → STORFORMAT opens the interval workspace; machine-pricing opens the assisted cost test. Existing manager save, tools, library, simulator and profile forms are reused. Nearest-step wide-format rounding and gross-margin/upward machine rounding remain unchanged. Assistance compares configured machines; historical production learning/Jev is not connected. Normal app on 8113 uses the real backend; public catalogue works, admin acceptance awaits normal login. Separate synthetic 8112 browser checks verify save/reload and form connections. 26 tests/build/new-component lint pass; 403 baseline/current TS diagnostics, no additions. No production data writes or deployment. See `docs/PRODUCTION_WORKSPACES_IMPLEMENTATION_2026-09-20.md` for verification and rollback.

Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](../docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

Latest production rollout checkpoint (16 September, evening): **41 live functions now use modern keys**, verified ACTIVE; public unpublished pricing is closed and the hardened supplier explorer is live. All 201 products and 357,913 generic price rows remain unchanged across 23-table content checks. Vercel production build settings use the modern public key and private-upload flag; domains and live schema/bucket are unchanged. The old service key remains enabled. Thomas approved preserving live contact emails; send-contact-message v8 is deployed and verified without sending mail. Thomas also approved the existing OpenAI/Gemini image-sharing and provider-cost behavior; icon-studio-generate v7 is ACTIVE with exact source verification and a denied guest probe, without generating images. A separate live checkout-schema migration was rejected as premature before the matched release; no live DDL was applied. The full v4 candidate is now READY on its protected Vercel URL after fixing server-dependency packaging and protected same-origin asset fetches. The six customer domains remain on the existing deployment; the prepared Stripe callback has not been created. Three new asset-security tests pass; TypeScript remains at 403 diagnostics. Matched backend/file/frontend release and final key disable remain open. New isolated checkout snapshots retain production selections. 145 focused tests pass; TypeScript remains at 403 diagnostics. See [the current rollout checkpoint](../docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact versions, candidate, remaining audit findings, approvals and rollback. Earlier checkpoints below are historical.

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
Read [the current migration checkpoint](../docs/KEY_AND_FILE_MIGRATION_2026-09-16.md) for proof and rollback boundaries.

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


2026-09-16 VAT latest (13:49 CEST): DK-only launch confirmed. 25% VAT now added on
server and UI for the three launch shops; foreign delivery/new unknown seller
policy fails closed, foreign billing/location does not create an exemption.
Immutable orders.checkout_tax + outbox evidence installed isolated only, local
20260916112627/hosted20260916113115. Creator29/finalizer14/webhook14/dispatcher15/
status31 source matches all33 files. 60 tests, five Deno checks, grants/build pass.
Actual preview qcxqy1pbk (dpl_8xnFtHeULhbnS6nJJLDAsafgzkF7) charged TEST553.75,
443net+110.75VAT; order e1db04fe-23df-46be-8085-8a628923501b / attempt
4d9bac50-43d8-4400-9bc8-35ffb8f9e28d. One exact-hash file, two pending emails,
confirmation reload passed. Local saved-data email render/invoice amounts match;
invoice PDF/admin workflow acceptance remains. CountriesNO/DE/CY/oldnet443 rejected
hosted before writes; tax mutation denied, historical orders unchanged. Test effects
paused again checkout503/email409, cron inactive. No live changes or new emails.
See release packet/domestic-vat proof JSON. Production candidates remain stale;
continue RGB/file/security/admin/connected-payments/matched-live release checks.

2026-09-16 latest browser checkout (13:13 CEST): actual uploaded/approved 1200 ×
600 mm aluminium Designer PDF, Stripe TEST card, saved order and browser reload
verified. One order c63da1fa-22a9-48e5-b8f8-83f7273f14cd / attempt
30024f42-b4ca-4e84-9287-5d5acbf42988, one exact-hash finalized PDF and two pending
outbox records. WEBPRINTER suffix frozen, livemode=false. New protected static
preview joet1abr6 (dpl_4cJhRsNVvDFtrK2fjF5YRbZ6Bc7p) has explicit isolated/test-key
gate; ordinary preview stays payment-disabled. 34 focused tests/build pass.
Paused new checkout again (503), mail remains disabled (409), cron inactive.
No new email, supplier order, live alias or production backend change in this run.
HOLD: actual 443 kr ex-VAT was charged/saved without VAT. Need Thomas's pending
Denmark-only versus international launch answer before whole-system tax repair.
False RGB warning on verified CMYK PDF comes from normalized PDF.js rendering
operators and remains unfixed. Size/material blank on receipt; test banner covered
by modal; 3/2 mm safety discrepancy remains. Full production candidates below
are STALE after frontend changes. See docs/PRODUCTION_RELEASE_2026-09-16.md and
tmp/launch-email-20260916/browser-order-proof.json for current evidence. Historical
acceptance.mjs paused outbox count no longer covers the new queued notifications.

2026-09-16 common payment label: Thomas accepts WEBPRINTER for his three print
shops. Implemented a server-owned, frozen per-card suffix in the prepared creator
for those exact tenant IDs; no shared-account or routing changes. Existing
attempts retain old parameters. 22 focused tests/Deno check pass. Isolated creator
v26/JWT on deployed; all nine sources match. Post-deploy checkout 503/email 409
verified; no new payments/emails. Consult release packet; rollback must retain frozen suffixes on issued or
unbound attempts to preserve Stripe idempotency.

2026-09-16 shared-account answer: Thomas confirms Printmaker Stripe is shared
with “Crocodile” for the same company and wants to keep one account. Do not create
a second account or rename shared settings to Webprinter. Test-mode Business
details independently show COOKADELI as statement descriptor. Preserve connected
tenant routing; shared-company preference is not permission to merge other shops'
financial accounts. Per-card shop suffixes/reporting labels are proposed, not yet
implemented; see release packet for provider limits and remaining acceptance.

2026-09-16 browser follow-up: actual Designer-exported/stored aluminium PDF has
1200 × 600 mm trim, 3 mm bleed, CMYK FOGRA39, vector forms and outlined Danish text;
decoded page/form streams match the checkout storage copy. Not PDF/X sign-off.
Fixed reproduced cross-tab preview tenant selection using per-tab sessionStorage;
two regressions failed before, 32 focused checks/build now pass. Updated protected
preview q2ykt4y6m (dpl_8CiiuMEC6CGCQnV2bXBnnwKJrCtt) passes two-tab product →
Designer → generated approved PDF → checkout/reload with the correct shop.
Details and artifact paths: docs/PRODUCTION_RELEASE_2026-09-16.md. Browser Stripe
form remains untested; Designer/checkout safety labels differ (3/2 mm). All test
payment/mail/scheduler effects remain paused. Thomas was asked if the existing
Printmaker Stripe account's COOKADELI merchant name is intentional/shared.
Current production candidate is output/production-release-2026-09-16-tab-fix/.vercel/output:
1,163 hashes match current source, six API routes built and 305 static files passed
private-value scanning at 10:22 CEST. Not deployed. Earlier candidate below lacks
the tab repair and is preserved only as history.

2026-09-16 production preparation: `docs/PRODUCTION_RELEASE_2026-09-16.md` is the
current checkpoint. Full production artifact built with all six server routes;
no live alias switch. Live nullable address fields applied (20260915221814).
Isolated branded email dispatcher v7/status v23 source-verified and disabled;
31 email/20 checkout tests plus six hosted probes pass. Thomas approved creating
the restricted Resend test key, with support@onlinetryksager.dk selected from saved
shop settings. Login is complete; key 80e64154-5c01-42ea-a9f4-26628d09127c created
with sending-only webprinter.dk scope and installed ONLY under the dedicated
STOREFRONT_ORDER_EMAIL_RESEND_API_KEY on cyurochbkxggcobnxaxq. Three new TEST
payments finalized by signed webhook. Resend reports seven approved messages
Delivered; repeated calls produced no duplicates; customer send denied 403.
Thomas confirmed receiving some emails; complete-set/design approval remains open.
Cron job 1 with Vault secret
passed an automatic HTTP 200 run at 00:49 CEST, then was paused. Final state:
checkout=false, email=disabled, cron inactive; worker 409/checkout 503 verified;
five sent outbox rows, five other recipients untouched, three test products hidden.
Use docs/storefront-email-scheduler.sql; preserve private proof in
tmp/launch-email-20260916 and never publish private JSON/env files. No new approval
needed for the completed key setup. Existing Printmaker Stripe account
works in the browser; connector account differs. Continue inbox/browser full-order
acceptance, then matched production repairs and the three-domain switch. Preserve
all pre-existing staged and unstaged changes; no commit/push/staging was done.

Historical online preview (2026-09-15; superseded above): protected Vercel preview
`printmaker-web-craft-main-la8louip3-thomas-projects-d80b9ddd.vercel.app`, connected
to isolated Supabase `cyurochbkxggcobnxaxq`. Three shop catalogue/branding copies,
preview-only payment/outbound guards and test admin access are prepared. Read
`docs/ISOLATED_ONLINE_PREVIEW_2026-09-15.md` for final copy and verification status.
Do not promote this static test artifact to production. Vercel CLI/browser work;
the connector alone has a team-access error. No live domains/data changed.


2026-09-10 branded email follow-up (latest): local shared tenant-brand templates
and 36-preview gallery at http://127.0.0.1:8186/ are ready; 31 focused tests,
two Deno entrypoints and 24 width measurements pass. These latest changes are
NOT DEPLOYED. Resend API-key page access is now authorized and works; creating
the prepared sending-only webprinter.dk key was blocked by automatic review
pending explicit creation permission. That question and allowed test inbox are
still pending; no new key or email. Configure only the dedicated
STOREFRONT_ORDER_EMAIL_RESEND_API_KEY after approval and updated email-function
deployment. Never add a global RESEND_API_KEY to the staging branch, because
older copied contact/quote handlers use it without order-email scope guards.
Read the newest checkpoint in docs/launch-review-2026-09-10/verification.md.

2026-09-10 isolated staging (latest): approved branch `webprinter-launch-test`
(`cyurochbkxggcobnxaxq`, “yebbo project”, US$0.01344/hour + usage) is initialized
with schema only and synthetic fixtures. Seven prepared migrations, five Edge
functions and new staging-only tenant-boundary migration are deployed. Hosted
tenant/save checks: 29/29, previously 18 pass/11 fail. Stripe TEST payment checks:
18/18, including 3DS, duplicate signed callbacks and real 503-to-200 recovery.
Four paid test orders have one file and one pending email each; none sent.
Checkout creation/email are disabled. Next human step: authorize Resend API-key
access (automatic approval review blocked that page) and name an allowed test
inbox. Domain webprinter.dk is verified. Also confirm why Stripe's challenge
shows COOKADELI before changing shared account branding. No new approval needed
for the already accepted branch cost/organization or Stripe test access.
Read the current staging checkpoint in
`docs/launch-review-2026-09-10/verification.md` and `docs/LAUNCH_REGISTER.md`.
NEVER ship the ignored staging schema baseline to production. New tenant-policy
migration must ship with server finalization and matching frontend. No isolated
application frontend is connected yet; localhost 8110 remains live-connected.
No production payment/save/email rollout, real payment, supplier order or Git
index change. Existing type baseline remains 401 diagnostics. The prior pause
below is historical; preserve unrelated dirty work and existing live data.

2026-09-10 launch implementation: the named maintenance-endpoint exposure and
public catalog write grants are now remediated and verified on hosted Supabase.
Resume from the implementation checkpoint in
`docs/launch-review-2026-09-10/verification.md` and `docs/LAUNCH_REGISTER.md`.
Stripe test-dashboard sign-in and isolated-backend organization/cost selection
are the next human steps; payment/save/email acceptance remains open. Local
524 Node + six browser tests and build pass; 401 TypeScript diagnostics remain.
Preserve dirty work; the user authorized assessed improvements across earlier
code locks, including pricing, while considering all connected flows.

Last updated: 2026-07-08

Read these first:
1. `AGENTS.md`
2. `HANDOVER.md`
3. `AI_CONTINUITY.md`
4. `POD2_README.md`
5. `SYSTEM_OVERVIEW.md`

The root `HANDOVER.md` is now the current human-readable handover. The root
`AI_CONTINUITY.md` is the condensed AI startup file.

## Current Snapshot

Branch: `ui-cleanup`
Latest commit: `7932644 feat: polish tenant site design controls`
GitHub branch: `https://github.com/comboworks-ops/webprinter-platform/tree/ui-cleanup`
Live Vercel alias: `https://www.webprinter.dk`

The latest session was deployed to Vercel production successfully.

Current active direction:
- Make Webprinter commercially ready as a sellable web-to-print platform.
- Use owned tenants (`webprinter.dk`, `salgsmapper.dk`, and
  `onlinetryksager.dk`) as proof tenants.
- Treat Supplier Bank as a sourcing/staging engine, not the whole product.
- Roadmap: `docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md`.
- Read-only admin cockpit now exists at `/admin/commercial-readiness` with
  sidebar label `Driftsklarhed`. It reads live, defensive Supabase signals for
  tenant/product/template/SEO/order readiness, while Supplier Bank gate facts
  remain report-derived/read-only. It also shows first-product flow health:
  Matrix/STORFORMAT price rows, product template/designer-launch readiness, and
  approximate order traces for the selected proof product, plus prioritized
  `Flow-blokeringer og QA` issue links and a `Bevisflow pr. tenant` proof-step
  checklist with tenant-safe admin links. It also shows `Klar-til-demo beviser`
  so each tenant's commercial demo evidence and missing proof points are visible.
  The top `Ledelsesblik: næste handling` layer derives one read-only next action
  per tenant from those gaps.
  `Trykkeri-demo gate` summarizes platform-level demo readiness across tenant
  proof, price/designer/order evidence, order readiness, SEO, Supplier Bank
  risk, and demo/sales package.
  `Demo-køreplan for trykkeri` gives a read-only step-by-step presentation path
  for a print-house conversation.
  `Første pilotordre-plan` turns Webprinter's first controlled order into a
  read-only operating checklist before sales use.
  `Trykkeri-salgspakke` adds the CEO/sales package view: demo script,
  pilot-order proof, tenant showcase, onboarding, offer model, and risk
  boundaries.
  `Go/no-go launch board` is the top CEO view for what can be demoed, what is
  pilot-only, and what must not be promised yet.
  `Commercial ready scorecard` maps the roadmap's definition of commercial
  ready to current evidence: owned-tenant order, second tenant niche/template
  proof, traceable pricing/designer state, admin order handling, order/file
  readiness, payment/checkout clarity, customer dialogue visibility,
  mail/notification readiness, delivery/fulfillment readiness,
  legal/cookie/contact readiness, platform contact/lead readiness,
  SEO/analytics, Supplier Bank staging safety, and simple business pitch
  language. It is read-only and only links back to existing admin evidence.
  `Salgsmæssig bevismappe` maps each sales claim to proof, gaps, and admin
  evidence links before it is used in a pitch.
  A compact jump bar links directly to the key cockpit sections so the page can
  be used live in an internal review or print-house prep conversation.
  `SEO/Search Console bevis` reuses the existing Platform SEO Search Console
  hooks to show each owned domain's SEO rows, verified Search Console state,
  28-day clicks, impressions, CTR, and average position when connected. It is
  read-only and does not connect Google, write SEO rows, or mutate Search
  Console data.
  `Første trykkeripilot: tilbudsmodel` turns the print-house package into
  concrete offer lines: branded tenant/storefront, first product package,
  designer/upload/PDF, checkout/order intake, SEO reporting, Supplier Bank
  staging, support/onboarding, and commercial price frame. It remains read-only
  and does not set prices or mutate products/orders.
  `30-dages eksekveringsplan` maps the roadmap's first 30 days into an operator
  checklist: owned-tenant pilot paths, manual `admin@webprinter.dk` access
  verification, Webprinter flagship E2E flow, Salgsmapper template proof,
  price-preview warning visibility, WMD duplicate decision, Supplier Bank report
  visibility, and SEO/Search Console read-only connection. Product admin
  `Produkt & Priser` now has a read-only `Pris-preview status` card that counts
  Matrix rows, warns at `0` rows, summarizes very large Matrix imports, and
  labels STORFORMAT/MPA as separate pricing paths. Product overview also shows
  read-only price-health badges per product plus a Matrix OK / missing Matrix
  prices / special pricing summary. The summary chips are filter buttons, so
  operators can isolate missing Matrix-price products without opening each
  card. Publishing a Matrix product with `0` price rows now asks for explicit
  confirmation before saving, and the product `Klar` marker uses the same
  warning-only confirmation. Master-tenant release/send-to-tenant actions now
  reuse that price-health signal and warn before distributing a Matrix product
  with `0` price rows. It does not change pricing and only links to
  existing admin areas. Product overview also has a read-only storefront
  category-readiness strip that counts forside-knapper, hovedkategorier and
  underkategorier, and flags empty categories, invalid front-card selections
  and submenu categories without visible children. Storefront category cards
  now fall back to the first usable product in the category when the selected
  front-card product is missing or unpublished.
  `Pilot-gennemgang` is the practical read-only rehearsal list for the exact
  proof paths to witness before a print-house conversation: Webprinter
  product/price, designer or upload, order into admin, Salgsmapper
  template/download/designer, Onlinetryksager first product, SEO/Search Console,
  Supplier Bank as staging, and `admin@webprinter.dk` access.
  `Bevisfangst for generalprøve` is derived from the same pilot proof list and
  tells the operator what to capture, what counts as accepted, and which stop
  rule keeps the point out of an external trykkeridemo. It does not write notes,
  files, prices, products, ordrestatus, SEO data or Supplier Bank state.
  `Pilotdrift runbook` is the read-only operating checklist for the first
  controlled order: order data, product/price basis, design/upload/PDF check,
  payment decision, production owner, proof/customer communication, delivery,
  closeout, and sales evidence boundary. It does not mutate orders, payments,
  files, prices, products or publishing.
  `Ordredrift signaler` is the read-only tenant-level order operations summary
  that reads existing `orders` and current `order_files` rows to show total
  orders, file-ready orders, problem/reupload pressure, and missing/customer-file
  pressure without creating orders, moving status or changing files.
  `Betaling/checkout signaler` is the read-only tenant-level payment readiness
  summary that reads existing `tenant_payment_settings` and separates live
  Stripe, Stripe setup and manual/test payment decision states without invoking
  Stripe or changing fees.
  `Kundeservice signaler` is the read-only tenant-level customer/support
  summary that reads existing `order_messages` and `platform_messages` to show
  order-message volume, platform support-message volume, unread customer/tenant
  messages, and latest visible message without sending messages or marking
  anything as read.
  `Mail/notifikationer signaler` is the read-only tenant-level notification
  readiness summary that reads existing `tenants.settings` and
  `tenant_notifications` to show customer order-confirmation state, admin
  new-order mail state, tenant company email, unread internal notifications and
  whether admin order mails would be skipped because the company email is
  missing or invalid. It does not send emails, update settings or mark
  notifications as read.
  `Levering/fulfillment signaler` is the read-only tenant-level delivery and
  fulfillment summary that reads product `order_delivery`, existing order
  `delivery_type`/tracking values, `delivery_tracking` counts and
  `tenant_pod_shipping_profile` sender readiness. It does not change delivery
  methods, tracking, POD sender identity, order status, pricing or product
  setup.
  `Jura/cookie signaler` is the read-only tenant-level legal and consent
  summary that reads existing `tenants.settings.company`, public routes
  `/kontakt`, `/privatliv`, `/cookiepolitik` and `/betingelser`, the contact
  form's privacy-policy consent link, plus the current cookie banner/settings
  flow. It surfaces missing company email and missing CVR/address, while the
  cookie settings dialog now routes tenant terms to `/betingelser` and platform
  terms to `/handelsbetingelser` without losing localhost `force_domain`
  context. The tenant contact form also links its consent text to `/privatliv`
  with the same domain context, and the default tenant footer terms link now
  uses `/betingelser`. These links reuse the existing storefront tenant-context
  helper. The platform contact form also requires the same privacy-policy
  consent before a platform lead message can be submitted. It does not change
  cookies, tracking, legal text or tenant settings.
  `Platform henvendelser` is the read-only platform lead-readiness layer for
  the Webprinter sales site. It shows public contact fields, privacy consent,
  localhost-safe privacy links, and the existing `send-contact-message`/Resend
  mail handoff. Successful platform contact submissions are also logged as
  unread master messages in `platform_messages` with a `[PLATFORM LEAD]`
  prefix, and admin `Beskeder` labels that master thread as `Platform
  henvendelser` when lead messages exist. That thread is shown as a read-only
  log so operators do not mistake an internal note for an external email reply.
  Cockpittet læser nu de masterbeskeder som en read-only leadtæller med samlet
  antal, ulæste henvendelser og seneste tidspunkt. Admin `Beskeder` viser også
  et lille leadkort for den tråd med samlet antal
  platformhenvendelser, ulæste henvendelser, nyeste kundeemne, beskedpreview
  og en sikker `mailto:`-overdragelse til svar uden for den interne log.
  Cockpittets opfølgningslink åbner direkte samme mastertråd via
  `tenantId=00000000-0000-0000-0000-000000000000`. Den mastertråd bliver ikke
  auto-markeret som læst ved åbning, så ulæste platformhenvendelser forbliver
  synlige indtil et senere eksplicit leadflow håndterer dem. Admin header og
  sidebar tæller platformhenvendelser separat; hvis de er de eneste ulæste
  beskeder, åbner beskedikonet direkte samme mastertråd.
  Mail-overdragelsen forbliver QA indtil en kontrolleret indbakke/admin-test
  er bevidnet. Det opretter ikke en ny CRM-tabel, sender ikke testmails,
  ændrer ikke tracking, produkter, priser, ordrer eller Supplier Bank.
  `Adgangsberedskab for adminmail` is the read-only manual access checklist for
  `admin@webprinter.dk` across dashboard, products, product price, Salgsmapper
  templates, orders/customers, Platform SEO, Supplier Bank, tenant/domain
  context, payment, modules and settings. It does not mutate auth, roles,
  sessions or permissions.
  `Prioriteret handlingskø` is the read-only top operator queue that ranks the
  next actions across critical path, pilot proof, pilotdrift, admin access,
  go/no-go and the 30-day plan, so the cockpit starts with what to do next.
  `Trykkerimødepakke` is the read-only meeting-prep layer for the first
  print-house conversation: purpose, what may be shown, which proof points may
  be mentioned, what must not be promised, the commercial question to ask, and
  the next follow-up. It does not create offers, prices, emails, products or
  supplier changes.
  `Måleksekvering` is the read-only top execution layer for the active goal. It
  turns the work into six phases: cockpit ownership, owned-tenant proof,
  pilot proof/drift, adminmail access, first print-house meeting readiness, and
  visible sales evidence. It links to existing evidence and does not mutate
  prices, products, orders, auth, SEO, POD or Supplier Bank. It now also shows
  `Automatisering og menneskelig bevisførelse`: a read-only split between safe
  Codex/system work, manual browser/admin QA, and CEO/business decisions. The
  cockpit top now also has `Næste sikre handling`, which highlights the next
  safe system step, next manual proof step, and first live-blocking decision.
  `Browserrute til generalprøve` turns the pilot-proof items into a numbered
  manual route with tenant-safe links for the internal browser rehearsal.
  `Bevisfangst for generalprøve` adds capture, acceptance and stop rules for
  each route step without creating a write path.
  `Automatiseret browserbevis` is now part of `Bevisflow pr. tenant`. It points
  to `npm run check:commercial-proof`, a combined read-only gate that checks
  the commercial-readiness cockpit bindings and then runs Playwright against
  Webprinter Aluminium, Banner Builder Pro site-package preview, Salgsmapper
  category landing, Salgsmapper PDF/template/designer, Onlinetryksager category
  landing, and Onlinetryksager Flyers proof flows on localhost. It must remain
  a verification path only and
  must not write products, prices, orders, SEO, POD or Supplier Bank data.
  `npm run check:commercial-proof:write` runs the same gate and writes only the
  local report `docs/COMMERCIAL_PROOF_LATEST.md`.
  `npm run check:commercial-proof-report` verifies that report without
  rerunning the browser smoke. `npm run check:commercial-release` is the local
  pre-demo/pre-deploy gate that writes the report, verifies it, and runs the
  Vite production build. It also writes `docs/COMMERCIAL_RELEASE_LATEST.md`.
  `npm run check:commercial-release-report` verifies that release summary. The
  summary includes a read-only `git status --short --branch` snapshot and
  dirty-entry count, so local work-in-progress is visible in the proof trail.
  `npm run check:commercial-changeset`, `npm run check:commercial-changeset:write`
  and `npm run check:commercial-changeset-report` generate/verify
  `docs/COMMERCIAL_CHANGESET_LATEST.md`, which groups the dirty paths into
  review buckets with suggested review order and bucket-specific verification
  commands before any push/deploy decision. It also lists the first commercial
  proof-chain review packet with exact candidate files and hold reasons for the
  other buckets, plus read-only staging, staged-file validation and rollback
  command previews. `npm run check:commercial-application-source:write`
  writes/verifies `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md`, the second
  runtime review packet. It groups app-source changes by pricing/product,
  designer/PDF/template, tenant storefront/SEO/design, admin, checkout/account
  and build/config risk, and `npm run check:commercial-application-source-report`
  verifies that report without writing products, prices, orders, SEO, POD or
  Supplier Bank data. `npm run check:commercial-supabase:write` writes/verifies
  `docs/COMMERCIAL_SUPABASE_LATEST.md`, the Supabase review packet. It runs the
  existing grant/function exposure checks, lists migrations, Edge Functions,
  temp/config duplicates and local Supabase artifacts separately, and
  `npm run check:commercial-supabase-report` verifies that report without
  deploying or mutating database/function state. `npm run check:commercial-staged-packet`,
  `npm run check:commercial-staged-packet:write` and
  `npm run check:commercial-staged-packet-report` verify
  `docs/COMMERCIAL_STAGED_PACKET_LATEST.md`, the git-index safety packet that
  keeps forbidden local Supabase/debug artifacts, core pricing source, POD
  source and local tooling out of a commit/push/deploy packet unless explicitly
  approved. `npm run check:commercial-branch-freshness`,
  `npm run check:commercial-branch-freshness:write` and
  `npm run check:commercial-branch-freshness-report` verify
  `docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md`, the upstream safety packet that
  lists upstream-only commits/files and staged-packet overlap without fetching,
  pulling, merging, rebasing, committing, pushing or deploying. `npm run check:commercial-upstream-reconciliation`,
  `npm run check:commercial-upstream-reconciliation:write` and
  `npm run check:commercial-upstream-reconciliation-report` verify
  `docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md`, the overlap interpretation
  packet that classifies upstream/staged overlap as exact, represented,
  superseded or unresolved while staying read-only. `npm run check:commercial-owner-merge-readiness`,
  `npm run check:commercial-owner-merge-readiness:write` and
  `npm run check:commercial-owner-merge-readiness-report` verify
  `docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md`, the release-owner dry-run
  packet that uses a temporary Git index to overlay the staged packet on the
  upstream tree without pulling, rebasing, merging, staging, committing, pushing
  or deploying. `npm run check:commercial-release-owner-sequence`,
  `npm run check:commercial-release-owner-sequence:write` and
  `npm run check:commercial-release-owner-sequence-report` verify
  `docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md`, the ordered human
  branch-freshness, commit, deploy and stop-rule handoff. `npm run check:commercial-deploy-readiness`,
  `npm run check:commercial-deploy-readiness:write` and
  `npm run check:commercial-deploy-readiness-report` verify
  `docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md`, the read-only push/deploy
  decision report. That report may intentionally show `HOLD` when branch
  freshness, unstaged leftovers, held local artifacts, Supabase deploy scope or
  human release ownership still need a decision. `npm run check:commercial-release-handoff`,
  `npm run check:commercial-release-handoff:write` and
  `npm run check:commercial-release-handoff-report` verify
  `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md`, the release-owner handoff packet
  with suggested commit text, owner decisions, Supabase deploy scope, rollback
  note template and post-deploy tenant smoke routes. `npm run check:commercial-release-packet`,
  `npm run check:commercial-release-packet:write` and
  `npm run check:commercial-release-packet-report` verify
  `docs/COMMERCIAL_RELEASE_PACKET_LATEST.md`, the read-only open-first index
  over the whole commercial release packet. It remains read-only. The tenant proof runner retries once after the app's short
  Supabase transport cooldown only when a route reports the known temporary
  Supabase pause message.
  `Ekstern demo-grænse` is the read-only safety boundary for the first
  print-house conversation. It separates what may be shown externally, what is
  pilot-only, and what must stay internal, including Supplier Bank, SEO,
  payment and delivery promises. It does not mutate demo content, products,
  prices, payment, SEO or Supplier Bank.
  `Pilotaccept for trykkerikunde` is the read-only internal go/no-go gate before
  a real print-house pilot. It combines commercial-ready scorecard,
  external demo boundary, pilotdrift, adminmail access, offer model, and CEO
  decision queue. It does not create customers, offers, prices, payments,
  products or order changes.
  `Pilotansvarskort` is the read-only responsibility map for the first
  print-house pilot: CEO go/no-go, product package, operations, file/PDF
  control, admin access, SEO/reporting, Supplier Bank boundaries, economy,
  support and demo ownership. It does not assign roles, change permissions or
  mutate live data.
  `Pilotscope aftalegrundlag` is the read-only scope frame for the first
  print-house pilot. It lists what is included, what is excluded, and which
  business decision is still needed for tenant/branding, product package,
  designer/upload/PDF, checkout/order, SEO, Supplier Bank, support, price frame
  and pilot go/no-go. It does not create offers, prices or customer records.
  `Pilotonboarding plan` is the read-only sequence for what happens after a
  print house says yes to a pilot: internal accept, tenant/domain/brand, first
  product package, templates/upload, order/admin test, adminmail access,
  SEO/reporting, Supplier Bank boundaries, economy/support and internal
  rehearsal. It does not create tenants, products, customers, offers, roles or
  prices.
  `Pilotsucces og exitkriterier` is the read-only measurement layer for the
  first print-house pilot. It defines when the pilot can continue, when it
  should be paused, and when it can be converted to a paid first package, based
  only on existing cockpit evidence. It does not create customers, offers,
  products, prices, orders, roles, SEO rows or Supplier Bank changes.
  `Trykkeripilot handoff` is the read-only bridge from proof to first
  print-house conversation. It summarizes what may be shown, concrete pilot
  scope, CEO go/no-go, customer input after a yes, non-promises, and how pilot
  success is judged. It does not create offers, customers, prices, products,
  order status changes or supplier publishing.
  `Trykkeripilot Q&A` is the read-only answer layer for first-meeting questions:
  what can be shown, pilot scope, supplier/pricing automation, orders/files,
  payment/support, customer input, success criteria, go-live and next
  commercial decision. Every answer includes proof and a boundary so it stays a
  meeting aid, not a feature promise.
  `Første mødebrief` is the read-only five-step live meeting brief: open
  calmly, show only the short demo, ask the commercial pilot question, repeat
  non-promises, and end with the next action. It derives from meeting pack,
  Q&A, handoff and priority queue without creating offers, emails, customers,
  prices, products, order status or supplier publishing.
  `Eftermøde opfølgning` is the read-only post-meeting draft layer that turns
  the meeting brief and Q&A into recap, pilot proposal, customer input request,
  non-promises and internal next action. It does not send emails, create leads,
  offers or customers, change prices/products/order status, or publish Supplier
  Bank data.
  `Pilottilbud kladde` is the read-only first-offer preparation layer that
  turns follow-up, offer model, scope, pilotaccept and priority queue into
  offer sections without amounts: purpose, delivery package, customer input,
  attachable proof, non-promises, internal approval and support form. It does
  not send mail, create leads/offers/customers, set prices, mutate
  products/orders or publish Supplier Bank data.
  `Pilotaftale tjekliste` is the read-only agreement-readiness layer after the
  offer draft. It checks pilot purpose, scope, customer input, economy
  decision, responsibility/support, success/exit criteria and non-promises
  before any draft becomes a real customer agreement. It does not create
  contracts, customers, offers, prices, orders, emails, product changes or
  Supplier Bank publishing.
  `Pilotstart plan` is the read-only first-days plan after a print-house yes:
  internal accept, customer kickoff input, adminmail/access check,
  product/design path, first manual order, evidence packet and week-1 decision.
  It does not create tenants, products, prices, orders, roles, emails,
  contracts or Supplier Bank writes.
  `Pilot uge-1 rapport` is the read-only internal status view for the first
  pilot week. It summarizes start-plan progress, first order/file readiness,
  payment, support/mail pressure, delivery, SEO visibility and the
  continue/pause/convert decision from existing cockpit evidence. It does not
  create report files, customers, offers, prices, orders, emails, product
  changes or Supplier Bank writes.
  `Konverteringsklar pilot` is the read-only conversion gate after the first
  pilot week. It checks whether week-1 proof, agreement basis, offer
  boundaries, success criteria, economy/support decisions and Supplier Bank
  limitations are clear enough before a pilot becomes a paid first package. It
  does not create offers, contracts, customers, prices, products, orders, mails
  or Supplier Bank writes.
  `Betalt pilotpakke` is the read-only package worksheet after the conversion
  gate. It summarizes what a first print-house customer can buy after pilot
  proof: scope, non-promises, price/payment decisions, order/delivery,
  support/legal responsibility and next phase. It does not create offers,
  contracts, customers, prices, products, orders, mails, payment settings or
  Supplier Bank writes.
  `Første kundes onboarding` is the read-only setup board after the paid
  package. It lists customer input and internal checks for agreement boundary,
  tenant/brand, products/pricing responsibility, templates/file flow,
  order/payment/delivery, admin access, reporting/sourcing and internal
  rehearsal. It does not create tenants, customers, products, prices, orders,
  roles, mails, payments or Supplier Bank writes.
  `Setup-arbejdsordre` is the read-only internal setup work order after
  first-customer onboarding. It turns the customer input into setup tasks for
  package boundary, tenant/brand, products, templates, order path, admin
  access, reporting/sourcing and final rehearsal. It does not create tenants,
  customers, products, prices, orders, roles, mails, payments or Supplier Bank
  writes.
  `Kundekickoff agenda` is the read-only first-customer meeting agenda after
  the setup work order. It turns setup tasks into meeting points for pilot
  boundary, tenant/brand, products/pricing responsibility, files,
  order/payment/delivery, support/access, reporting/sourcing and next action.
  It does not send mails or create customers, offers, products, prices, orders,
  payments or Supplier Bank writes.
  `Kickoff opfølgning` is the read-only post-kickoff follow-up layer. It turns
  the customer kickoff agenda into recap, customer material request,
  product/pricing clarification, order/responsibility follow-up,
  reporting/sourcing boundary and next internal action. It does not send mails
  or create customers, offers, products, prices, orders, payments or Supplier
  Bank writes.
  `Kundemateriale checkpoint` is the read-only manual material gate after
  kickoff follow-up. It lists the customer material and decisions that must be
  manually confirmed before setup continues: brand, products/pricing
  responsibility, templates/files, order/payment/delivery, support/access,
  reporting/sourcing and next internal action. It does not fetch attachments,
  send mails or create customers, products, prices, orders, payments or
  Supplier Bank writes.
  `Frigivelse til produktion` is the read-only release-readiness gate before a
  push/deploy is treated as safe. It separates production build, localhost
  smoke checks, tenant proof, adminmail access, price/POD/Supplier Bank
  boundaries, deploy owner, rollback note and after-deploy tenant smoke checks.
  It does not create branches, commits, deployments, prices, products, orders,
  POD data or Supplier Bank writes.
  `Releasebevis og accept` is the read-only proof-capture layer for the release
  gate. It states what to capture for build/localhost, tenant flow, adminmail,
  data boundaries, deploy/rollback and live smoke tests, plus what counts as
  accepted and when to stop. It does not save files, write notes, create
  commits, deploy, or mutate orders, prices, products or Supplier Bank data.
  `npm run smoke:commercial-readiness` is now a read-only commercial smoke
  command for the owned tenant proof paths. It checks production by default,
  or localhost with `-- --base-url http://127.0.0.1:8083`. It verifies
  Webprinter, `/produkt/aluminium`, Salgsmapper, the Salgsmapper template PDF,
  admin cockpit routes, and shipped bundle markers without creating orders,
  writing products, touching prices, scraping suppliers, or using Supabase
  write paths.
  `npm run smoke:commercial-readiness:browser` adds Playwright-rendered checks
  and fails on the Danish temporary error screen. It caught the
  `/produkt/aluminium` first-load crash from reading `templateDownloadedAt` on
  a null checkout session; `ProductPricePanel` now preserves that timestamp
  only when an existing session and current template PDF URL both exist and
  match.
  The same browser smoke now clicks `Design online` on aluminium and the first
  Salgsmapper template product. It verifies `/designer` receives `order=1`,
  product context, return path, checkout session state, and the Salgsmapper
  `templatePdfUrl`, while remaining read-only and creating no orders or
  database writes. It also verifies the Salgsmapper `Download skabelon` link on
  the product page, including the expected PDF path, Danish download filename,
  `application/pdf` response and `%PDF` file header. It also clicks `Bestil nu`
  on those same product pages and verifies `/checkout/konfigurer` receives the
  active product, selected format, quantity, price totals, tenant context, and
  Salgsmapper template PDF context from session storage. The same smoke now
  verifies that checkout shows `Fil Upload` for both products, exposes an input
  accepting PDF/JPG/JPEG/PNG/TIFF, keeps `siteUpload` empty before any file is
  chosen, and keeps payment disabled before upload/customer details. It
  deliberately does not select a file because that would write to storage, and
  stops before upload, payment or order creation. It also installs a synthetic
  in-session upload for both products, approves it in the UI, clicks
  `Gå til betaling`, and verifies the Danish customer/delivery validation
  blocks payment before any Stripe payment intent, order-file storage write or
  order insert request is sent. With valid smoke customer and delivery details,
  it intercepts `stripe-create-payment-intent` before it reaches Supabase and
  verifies the outgoing tenant id, amount, quote productId/slug/quantity, upload
  path, standard delivery metadata, blind-shipping boundary, customer metadata
  and Salgsmapper variant labels. The stubbed response intentionally returns no
  Stripe secret, so no real payment form, payment intent, storage write or order
  insert can be created.
  The smoke command also includes a local no-write source contract that checks
  checkout still writes admin-readable `[PRODUKTIONSFLOW]`, `[SKABELON]`,
  `[SKABELON-DOWNLOAD]`, delivery and `order_files` markers, and that
  `Kunder & Ordrer` still reads those tags and file-readiness signals.
  It also checks the Stripe payment-intent edge function source still requires
  `checkout_quote`, recalculates the amount through server-side `pricing-read`,
  rejects client/server amount mismatches, includes delivery/option components,
  and writes server-quote metadata to Stripe.
  It also guards tenant payment readiness: admin `Betaling` must still expose
  Stripe Connect onboarding/status/disable and platform fee controls, Connect
  edge functions must still check tenant roles/ownership, checkout must still
  choose destination charges only when a connected Stripe account is live, and
  `Driftsklarhed` must keep payment/checkout signals read-only without creating
  Stripe accounts, changing fees or starting payments.
  It also guards the post-payment completion source path: successful payments
  must still persist `orders`, attach current `order_files`, trigger customer
  and admin order notifications, preserve POD v2 job creation, save optional
  customer addresses, surface persistence/notification warnings, clear Stripe
  return params, and show the customer an order number.
  The smoke also guards the order email source chain: checkout wrappers must
  still call `send-order-email` for customer confirmations and admin new-order
  notifications, and the edge function must still render delivery, billing,
  blind-shipping, sender, customer/admin links and Resend handoff details.
  It also guards admin order processing: `Kunder & Ordrer` must still update
  status/tracking/delivery fields, sync `[LEVERINGSMETODE]`, log status
  history, send status/problem emails, show production readiness and warnings,
  download invoices, and link to order messages.
  It also guards the customer order portal: `Mine ordrer` must still read the
  logged-in customer's orders, messages, tracking events and invoices, show
  tracking/estimated delivery, support customer replies, handle requested file
  reupload through `order-files` and `order_files`, and clear the reupload flag
  after a replacement file is accepted.
  It also guards the SEO/Search Console visibility layer: Platform SEO must
  still expose the Search Console admin route, use master-scoped Google
  `webmasters.readonly` access, keep verified sites, 28-day clicks,
  impressions, CTR and average position in read-only hooks, and surface those
  signals in `Driftsklarhed` without changing Google, SEO rows, products,
  prices or orders.
  It also guards the contact/lead handoff: Webprinter's public contact page must
  still render with privacy-policy consent, the tenant contact form must keep a
  real `/privatliv` link with storefront tenant context, `send-contact-message`
  must still validate, rate-limit, send Resend emails and log platform leads in
  `platform_messages`, and admin `Beskeder` must still surface the
  `Platform henvendelser` read-only follow-up thread.
  It also guards legal/cookie readiness: public platform and tenant legal
  routes must still respond, cookie banner/settings must keep Danish consent
  categories and accept/reject/custom controls, cookie settings must route
  tenant terms to `/betingelser` and platform terms to `/handelsbetingelser`
  without losing localhost tenant context, and `Driftsklarhed` must keep
  `Jura/cookie signaler` read-only without changing cookies, tracking,
  legal text or tenant settings.
  It also guards the executive cockpit layers: Måleksekvering, adminmail
  access readiness, Supplier Bank staging-runbook, print-house meeting pack,
  critical path, pilot intake, launch board, commercial-ready scorecard,
  sales evidence binder, decision queue and decision option cards must remain
  visible, linked from the cockpit navigation and read-only.
  It also guards the pilot-to-first-customer chain: demo boundary, pilot
  acceptance, responsibility/scope, handoff/Q&A, meeting brief, follow-up,
  offer draft, agreement checklist, pilot start, week-one report, conversion
  gate, paid pilot package, first-customer onboarding, setup work order,
  kickoff agenda/follow-up, customer-material checkpoint and production-release
  readiness must remain visible, linked and read-only.
  `Supplier Bank staging-runbook` is the read-only operating sequence for
  supplier-bank products: external source only, report candidate, explicit
  approval, draft import, price-row QA, separate publishing decision and tenant
  handoff. It derives blocker state from the existing Supplier Bank decisions
  and does not scrape, import, publish or mutate live prices, products, POD
  data or Supplier Bank data.
  `Beslutningsvalgkort` is the read-only CEO decision helper for the open sales
  blockers. It turns each current decision into recommended handling,
  alternatives, cost of waiting and a decision rule, without choosing for the
  owner or mutating products, prices, payments, Supplier Bank, SEO or tenants.
  `Kritisk sti til første trykkerisamtale` summarizes the smallest proof chain
  needed before approaching a print house.
  `Pilottrykkeri intake` lists the information needed from a future
  print-house customer before onboarding, while staying read-only.
  `Beslutningskø før salg` makes the remaining CEO/product decisions visible
  before any sales promise is made.
  It remains read-only.
- Local build note: ignored `dist` output had stale generated preview files
  that caused Vite cleanup errors. `vite.config.ts` now cleans the build output
  with a build-only pre-plugin and disables Vite's fragile `emptyOutDir` step,
  so Vite can build cleanly.
- Codex desktop shell note: global `npm` may be unavailable, and bundled
  `pnpm run build` can stop on pnpm's ignored-builds approval gate. In that
  environment, use:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.

## What Changed Recently

Major Site Design V2 and tenant storefront work:
- Complete visual theme presets.
- Ten color presets and five font presets.
- Advanced per-theme button effects.
- Contrast safeguards for generated buttons.
- Hero/banner transitions, text effects and parallax controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots that open the right side-panel editors.
- Download Tilbud button styling target.
- Product price panels now show `Download skabelon` beside `Design online`
  when the selected product/format resolves to a template PDF launch. This uses
  the same template resolution as the designer launch and does not mutate
  checkout, pricing, product or order data.
- Checkout/session traceability now records template PDF name/url and whether
  the customer clicked `Download skabelon`. Order creation writes
  `[PRODUKTIONSFLOW]`, `[SKABELON]` and `[SKABELON-DOWNLOAD]` tags into
  `status_note`, and `Kunder & Ordrer` displays a flow badge and flow filter in
  the order list plus full tags and attached-file notes in order detail so admin
  can distinguish designer export, customer upload and external template-based
  design.
- `Kunder & Ordrer` now also shows read-only production readiness from existing
  order flags and current `order_files`: `Klarhed` badge/filter plus a `Fil
  klar` count, without writing orders, files, prices or schema.
- Order detail includes a read-only `Produktionsklarhed` panel with flow,
  readiness, file counts, and next recommended handling step.
- Selecting `Under produktion` in order detail now shows a warning-only
  readiness guardrail when the order is not file-ready. It does not block saving
  or write any extra workflow state.
- The commercial readiness cockpit now mirrors order/file readiness at tenant
  level in `Ordredrift signaler`.
- The commercial-ready scorecard includes `Ordredrift og filklarhed er synlig`,
  so those order/file signals affect the top-level ready count.
- The commercial-ready scorecard includes `Betaling/checkout pilot er afklaret`,
  so payment-mode clarity affects the top-level ready count.
- The commercial-ready scorecard includes `Kundeservice og dialog er synlig`,
  so customer/order and tenant-support message readiness affects the top-level
  ready count.
- The commercial-ready scorecard includes `Mail og notifikationer er afklaret`,
  so order confirmation/admin-mail readiness affects the top-level ready count.
- The commercial-ready scorecard includes `Levering og fulfillment er synlig`,
  so delivery methods, tracking and POD sender readiness affect the top-level
  ready count.
- The commercial-ready scorecard includes `Jura, cookie og kontakt er synlig`,
  so public company identity, contact email, cookie consent and tenant
  legal-route QA affect the top-level ready count.
- The commercial-ready scorecard includes `Platformhenvendelser kan modtages og
  følges op`, so the platform's public contact/lead path is visible before a
  print-house sales conversation.
- SEO/tenant-shell fixes.
- POD v2 admin updates and Danish Print.com term mapping.

PDF designer/service foundation:
- Vector-preserved PDF import/edit flow now supports page selection, rotate,
  crop-to-document ratio, stamp text, signature text, and text color.
- Selected PDF backgrounds expose `PdfToolsPanel` with page switching,
  reopen/edit, replace selected PDF, CutContour handoff, PDF-service scan, and
  vector export handoff.
- Generic designer PDF-service foundation exists in
  `src/lib/designer/pdfService.ts` and
  `supabase/functions/designer-pdf-service/index.ts`, separate from POD v2.
- Remaining expansions: deploy `designer-pdf-service`, connect an external PDF
  processor for OCR/compression/repair/PDF-A/redaction/form flattening, and add
  deeper save/load/export regression automation.

Supplier product bank:
- Supabase project `ziattmsmiirfweiuunfo` is linked and the local CLI loads
  secrets from `.env.local`.
- Do not run broad `supabase db push` for supplier-bank work while migration
  history drift remains; use the single supplier-bank migration path documented
  in `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`.
- Supplier-bank migration `20260701120000_supplier_product_bank.sql` is applied
  remotely and marked applied. Refresh-queue migration
  `20260703003500_supplier_bank_refresh_queue.sql` is also applied.
- Supplier registry rows are seeded for WIRmachenDRUCK, Pixartprinting, and
  Print.com. Internal Webprinter, Salgsmapper/Sales Maba, Onlinetryksager, and
  localhost domains remain excluded.
- Edge Functions `supplier-bank-import-draft` and
  `supplier-bank-create-delta-review` are deployed.
- WIRmachenDRUCK full folder bank is stored, refreshed, review-accepted, and
  imported as unpublished Matrix Layout draft `wmd-folder-bank-20260703` with
  18,800 price rows.
- Print.com has six approved bank slices imported as unpublished Matrix Layout
  drafts: flyers, business cards, presentation folders, letterheads,
  business-card boxes, and `t-shirt-basic-7`.
- Pixart flat-surface adhesive is approved and imported through STORFORMAT as
  unpublished draft `pixart-flat-surface-adhesive-storformat-draft`.
- Pixart rigids/signs is the open gate: the stored bank snapshot is still the
  older Plastic-only baseline, while the local Plastic+Plexiglass candidate
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`
  has packet/preflight evidence ready. Do not write it to the bank without
  explicit approval.
- Latest read-only overview reports:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`,
  `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`,
  `docs/SUPPLIER_BANK_DECISION_QUEUE_20260703-111214.md`, and
  `docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_20260703-111214.md`. The executive
  summary links the current audit/approval/preflight evidence and separates
  safe preflight checks from approval-gated write commands. The latest status
  report now also links the Pixart URL confirmation checklist as a proof file.
- Latest report index:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`; it is a local
  read-only evidence map over already generated Supplier Bank reports. It did
  not call supplier pages, scrape, read Supabase, write supplier-bank rows,
  create products, publish products, or write live pricing.
  The report lookup now prefers stable latest paths for recurring proof files,
  so generated proof trails and the admin evidence panel keep pointing at
  current operator files instead of older timestamped copies. The stable proof
  set includes the index, status, goal snapshot, gate roadmap, approval packet,
  decision queue, executive summary, completion audit, imported draft QA, expansion packet,
  coverage gap plan, Pixart adapter/readiness, URL candidates/checklist, and
  the Pixart/Print.com no-write preflights.
- Latest approval packet:
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md`; it is read-only,
  separates safe check commands from write commands, and lists two approval
  candidates: high-priority Pixart rigids bank-only snapshot approval and
  medium-priority Print.com `placemats` bank-only snapshot approval. Both
  candidates show their no-write preflight/check command before the
  write-gated command(s), links the latest Pixart/Print.com no-write preflight
  reports, and includes the Pixart missing-family readiness blockers (`0/4`
  ready). It also lists exact approve and exact defer phrases per write
  candidate. No write command from the packet has been run.
- Latest expansion packet:
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_20260703-111157.md`; it is read-only
  and turns the five remaining coverage gaps into a safe execution order:
  Print.com `other`, then Pixart `banners`, `labels`, `posters`, and
  `rollups`. It separates executable safe commands from human checklist items
  and keeps write-flagged commands out of the safe checklist. It includes
  Pixart readiness before probe and shows `0/4` missing Pixart families ready
  until exact URLs and extractor profiles exist.
- Latest completion/evidence audit:
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_20260703-111157.md`; it proves 5/8
  audited requirements and keeps the overall supplier-bank goal open because
  Pixart rigids, remaining registered family coverage, and the high-priority
  decision are still unresolved. It now includes the latest Pixart rigids
  no-write preflight report, candidate rows/effective rows `18/18`, materials
  `Foamex 3mm` and `Clear Polycarbonate 3mm`, DKK range `182.7-976.83`, and
  the Pixart `0/4` missing-family readiness evidence with per-family blockers.
- Latest coverage-gap plan:
  `docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_20260703-111101.md`; it breaks the five
  missing families into Print.com `other` scoping plus Pixart adapter mappings
  for `banners`, `labels`, `posters`, and `rollups`.
- Latest gate roadmap:
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`; it is read-only and
  turns the current work into five ordered gates: Pixart rigids approval,
  Print.com `other`/placemats approval, missing Pixart family preparation,
  imported-draft QA, and completion recheck. It lists safe/check commands
  separately from approval-gated writes and now marks whether exact
  approve/defer phrases exist for a gate. It also links the latest Pixart URL
  confirmation checklist in the missing-family gate evidence. It did not call
  suppliers, write supplier-bank rows, create products, publish products, or
  write live pricing.
- Latest goal snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`; it is the current
  read-only operator-control view and keeps the goal open at 5/8 proved with
  3 open gates. Its latest proof-file section includes the URL confirmation
  checklist, status report, approval packet, roadmap, readiness, and preflight
  paths.
- Print.com `other` has fresh local/no-write scoping evidence from 2026-07-03
  13:17 local time. The broad catalog preview listed 856 Print.com products,
  kept 80 `other` candidates, fetched details for 12, and wrote
  `pricing_raw/supplier-bank-raw/print-com/other/20260703-131707.json` plus
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-131707.json`.
  The refreshed placemats named-policy price preview produced 4/4 valid DKK
  rows for quantities 10/25/50/100, DKK range `271.23-368.85`, and wrote
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-131715.json`.
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md` says it is ready
  for explicit bank-only write approval only. No supplier-bank rows, POD v2
  rows, products, publishing state, or live prices were written.
- Pixart missing-family readiness was refreshed at 2026-07-03 13:19 local
  time. The URL candidate report/checklist still shows 7 Pixart URL candidates,
  all `official_candidate_needs_confirmation`, with 0 confirmed exact URLs. The
  adapter/readiness reports still show 4/4 missing Pixart families blocked
  before probe (`posters`, `banners`, `rollups`, `labels`), 0
  extractor-supported profiles, 0 supplier-bank normalizer-supported profiles,
  and 0 confirmed exact URL candidates. Latest files are
  `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`,
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`,
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`, and
  `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`. No Pixart probe/scrape,
  bank write, product write, publishing, or live pricing write was run.
- The core Supplier Bank proof reports were refreshed at 2026-07-07 local time
  with no supplier scraping, no Supabase writes, no product writes, no
  publishing, and no live pricing writes. The refreshed reports show the
  supplier-bank goal is not complete yet: 4/8 completion requirements proved,
  3 open gates, 1 contradicted gate, 9/14 registered families covered,
  5 missing families, imported draft QA at 9 OK / 0 warnings / 1 error, and
  1 published imported target. The current full WMD folder draft
  `wmd-folder-bank-20260703` has 18,800 expected Matrix Layout rows and
  18,800 stored `generic_product_prices` rows. The remaining QA error is the
  older published WMD target `wmd-folder-bank-891a5cf1`; do not
  unpublish/archive it without explicit user approval. Refreshed latest paths
  include
  `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`,
  `docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md`,
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md`,
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md`,
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`,
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`,
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, and
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`.
- `/admin/supplier-bank` now surfaces the same five-step Gate roadmap above
  the decision queue. It is derived from already loaded supplier-bank state and
  is UI-only: no supplier calls, bank writes, product writes, publishing, or
  live pricing writes. It also surfaces Pixart URL candidates for missing
  families from supplier metadata or the checked-in registry fallback, keeping
  them clearly marked as candidates until exact URLs and extractor profiles are
  confirmed.
- `/admin/supplier-bank` also has a read-only top `Målestatus` panel derived
  from already loaded bank state. It summarizes family coverage, imported-draft
  QA, open approval/coverage gates, and the high-priority Pixart decision so the
  admin can see why the goal remains open without running CLI reports. It also
  lists plain-text safe check commands for coverage, draft QA, completion audit,
  and relevant preflight checks; these are not executable UI controls.
- `/admin/supplier-bank` now mirrors the Pixart readiness report in the browser
  for missing Pixart families. Missing-family cards and the top engineering
  readiness summary show the mapped Pixart profile, extractor support,
  supplier-bank normalizer support, and exact-URL confirmation from already
  loaded coverage/registry data. This is read-only and does not probe, scrape,
  write bank rows, create products, publish, or touch live pricing.
- The Gate roadmap's Pixart URL candidate panel now shows pending/confirmed/
  rejected counts plus a read-only manual URL confirmation checklist. The
  checklist keeps the human-review order explicit: open URL manually only,
  verify exact product/configurator URL, compare visible option shape with the
  planned profile/first slice, confirm extractor and supplier-bank normalizer
  support, and only then promote or reject with evidence. The safe checklist
  command is displayed as plain text, not an executable control.
- `/admin/supplier-bank` now also makes the supplier menu more business-facing:
  a top `Leverandør-menu` card shows each supplier with bank/missing family
  chips and ready/draft/blocked counts, and clicking a supplier jumps to the
  filtered product catalog. The selected supplier now has richer
  `Kataloghylder` cards per product family with ready/draft/blocked counts,
  price-line totals, DKK ranges, latest update time, and missing-family
  preview/URL-candidate state. These controls only filter already loaded bank
  rows; missing families and URL candidates stay planning-only and do not
  trigger probes, scrapes, imports, publishing, or live pricing writes. Each
  shelf also shows a read-only `Næste sikre skridt` and optional plain-text
  safe check command, not an executable UI action.
- Product cards in `/admin/supplier-bank` are business-first by default:
  source/preview, open-draft, and import actions stay visible, while refresh
  queueing and price-review creation sit behind a `Vis avanceret` toggle. This
  keeps the bank usable as a supplier product catalog without removing the
  controlled admin tools.
- Product cards also show compact read-only `Valgmuligheder` previews from
  normalized supplier-bank attributes, with group labels, value counts, and the
  first few visible values. This helps confirm formats/materials/finishes
  before opening the full preview.
- The product preview dialog now mirrors the safe workflow with a read-only
  `Næste sikre skridt` summary and optional plain-text safe check command. It
  does not run preflights, write bank rows, import drafts, publish, or change
  live prices by itself.
- The supplier-bank product browser shows active search/family/status/readiness
  filters as badges with a `Ryd filtre` button. This is local UI state only and
  does not touch supplier-bank rows, products, publishing, or live prices.
- `/admin/supplier-bank` also has an `Afventer godkendelse` panel for the
  current business approval candidates: Pixart rigids/signs and Print.com
  placemats. It is read-only and only changes the supplier filter when clicked;
  it does not run preflights, write bank snapshots, create drafts, publish, or
  write live prices. The cards now show a read-only "Hvis godkendt" / "Hvis
  afventer" impact strip so approval and deferral consequences are clear
  without exposing write controls. They also show guardrail badges such as
  no-write preflight present, explicit approval required, Matrix import
  blocked, and POD v2/live pricing untouched. Each card also shows the next
  safe no-write check command as plain text; it is not an executable UI action.
- `/admin/supplier-bank` product browsing now includes bank-status workflow
  filters (`Godkendt`, `Kladde`, `Gennemgaaet`, `Fejlet`) before the existing
  readiness filters. These are read-only filters over already loaded active bank
  rows; archived rows remain excluded from the admin browser query.
- `/admin/supplier-bank` also has a read-only `Manglende familier` panel that
  lists remaining supplier-family coverage gaps with current blockers and next
  safe steps. Pixart missing families remain blocked before probe/extract until
  exact URLs and profiles are confirmed; Print.com `other` remains the
  placemats bank-only approval gate. Clicking a row only filters the current
  browser view.
- Latest Pixart adapter mapping plan:
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_missing-pixart-families_20260703-111101.md`.
  It maps the missing Pixart families to proposed profile names, safe first
  slices, conversion-path assumptions, quality gates, and official Pixart URL
  candidates read from `config/supplier-bank/sources.json`
  `productFamilyUrlCandidates`. The report now separates URL candidate count
  from `confirmed_source_url` count; current confirmed exact URL candidates are
  `0/4`, and the profiles remain not implemented. No Pixart probe/scrape or
  bank write was run for those families.
- Latest Pixart readiness report:
  `docs/SUPPLIER_BANK_PIXART_READINESS_missing-pixart-families_20260703-111101.md`;
  it confirms 0/4 missing Pixart families are ready for a local/no-write probe
  because the profiles and exact product URLs are still missing. It now records
  registry-backed official Pixart URL candidates for posters, banners,
  rollups, and labels, but still blocks probe/extract until profile support and
  a candidate is manually promoted to `confirmed_source_url`. It is read-only
  and did not probe/scrape Pixart.
- Latest URL-candidate report:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_pixartprinting-all-families_20260703-111100.md`;
  it is read-only over `config/supplier-bank/sources.json`, confirms 7 Pixart
  URL candidates, 7 pending confirmation, 0 confirmed exact source URLs, and 0
  rejected. It did not call supplier pages, scrape, write bank rows, create
  products, publish products, or write live pricing.
- Latest URL-confirmation checklist:
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_pixartprinting-all-families_20260703-121623.md`;
  it is read-only over `config/supplier-bank/sources.json` and turns the 7
  Pixart candidate URLs across 4 missing families into a manual confirmation
  checklist. It requires exact product/configurator route, visible option-shape,
  login/cart blocker, and extractor-profile checks before a candidate may be
  promoted to `confirmed_source_url`. It did not call supplier pages, scrape,
  write bank rows, create products, publish products, or write live pricing.
- Latest Print.com `other` scoping report:
  `docs/SUPPLIER_BANK_PRINT_COM_OTHER_SCOPING_20260703-084329.md`; the latest
  local/no-write refresh listed 855 catalog products, captured 80 `other`
  candidates, and fetched 12 detail payloads at
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-092642.json`.
  The recommended first narrow price-policy candidate remains `placemats`.
  The refreshed named-policy preview
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-092659.json`
  passed 4/4 valid DKK rows and no-write write-plan validation. The latest
  decision queue lists it as a medium-priority bank-only approval choice.
  Latest preflight report
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-110649.md`
  confirms it is ready for explicit bank-only write approval. No supplier-bank
  write is approved for this family yet.
- Latest Pixart rigids no-write preflight report:
  `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-110648.md`. It confirms
  the Plastic+Plexiglass candidate has 18/18 effective rows, categories
  `Plastic` and `Plexiglass`, duplicate keys old/new `12/0`, DKK range
  `182.7-976.83`, and prints only approval-gated bank snapshot/delta-review
  commands. No supplier-bank write has been run.
- Latest imported draft QA: 10 checked, 10 OK, 0 warnings, 0 errors, and 0
  published targets. Matrix/STORFORMAT split is 9/1.
- No supplier-bank command should publish products or write live storefront
  pricing unless the user explicitly asks for that separate step.
- `/admin/supplier-bank` missing-family cards now include plain-text
  `Næste sikre check` commands. These are read-only operator hints, not UI
  actions: Pixart gaps point to readiness checks, Print.com `other` points to
  placemats no-write preflight, and generic gaps point to the coverage-gap
  plan.
- Those missing-family cards also show the first registry-backed URL candidate
  and evidence inline when available. The candidate remains planning-only unless
  its status is `confirmed_source_url`; showing it in the browser does not
  approve probe/extract, bank writes, product imports, publishing, or live
  pricing changes.
- `/admin/supplier-bank` now also has a read-only `Bevisfiler` panel with the
  latest local report paths for executive summary, completion audit, Pixart
  rigids preflight, Print.com placemats preflight, coverage gap plan, and Pixart
  readiness. The paths are operator evidence only; they do not run supplier
  calls, bank writes, imports, publishing, or live pricing updates.
- The `Bevisfiler` panel now also includes the latest goal-control snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, plus the latest
  approval packet `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` and
  gate roadmap `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`.
- Approval cards now include a read-only `Beslutningscheckliste` for Pixart
  rigids and Print.com placemats. It clarifies the allowed bank-only decision
  scope and explicitly excludes product import, publishing, POD v2 rows, and
  live pricing changes.
- Approval cards also show an exact approval phrase for each candidate. That
  phrase is inert UI text only; it is not standing approval and must not be
  treated as permission unless the user explicitly says it in the conversation.
- Supplier-bank CLI now has a read-only goal-control snapshot:
  `npm run supplier-bank:goal-snapshot` and
  `npm run supplier-bank:goal-snapshot:write`. It combines the completion
  audit, source coverage, import eligibility, imported-draft QA, decision
  queue, Pixart readiness, and latest proof-file paths into one operator view.
  It separates safe/check-only commands from approval-gated writes and prints
  the exact approval phrases plus exact deferral phrases for Pixart rigids and
  Print.com placemats. It must not scrape suppliers, write bank rows, create
  products, publish, or write live prices.
- The goal snapshot, completion audit, and gate roadmap now include an
  `Open Work By Gate Type` section. It separates business approval,
  engineering readiness, local preview, draft QA, and completion-proof gates so
  future sessions can see why the bank is usable but not complete without
  inferring that from several reports.
- `/admin/supplier-bank` now mirrors that gate-type structure in the read-only
  `Målestatus` panel. It shows business approval, engineering readiness,
  local preview, draft QA, and completion-proof buckets from already loaded
  browser state only. It does not call suppliers, write supplier-bank rows,
  import drafts, publish products, or change live pricing.
- Pixart missing-family readiness now splits extractor support from
  supplier-bank normalizer support. The latest adapter/readiness reports show
  `0/4` extractor-supported profiles, `0/4` normalizer-supported profiles, and
  `0/4` confirmed exact URLs for posters, banners, rollups, and labels. Keep
  probe/extract/normalization blocked for those families until all three gates
  are green.
- `/admin/supplier-bank` approval cards now show both an exact approval phrase
  and an exact afvent/defer phrase. The defer phrase is inert UI text only and
  must not be treated as permission to write anything.
- `/admin/supplier-bank` approval cards now also show a read-only `Bevisspor
  før beslutning` section. Pixart rigids links the operator to the
  candidate/baseline JSON, candidate packet, no-write preflight, and storformat
  review. Print.com placemats links to the local catalog/price previews,
  no-write preflight, coverage plan, and decision queue. This is navigation
  evidence only and must not be treated as approval to scrape, write bank rows,
  import products, publish, or update live prices.
- `/admin/supplier-bank` now has a read-only `Næste importvalg` queue above
  the selected supplier family shelves. It uses the current filters and
  existing import-readiness gates to rank ready, warning, blocked, and imported
  rows, then opens only the existing preview dialog. It does not approve bank
  products, call suppliers, write supplier-bank rows, import drafts, publish,
  or update live prices.
- `/admin/supplier-bank` now also surfaces `Faktiske bankprodukter` directly
  below the top KPI cards, before the report/goal panels. This was added after
  the admin page felt like text frames instead of a product bank. The cards show
  supplier, family, readiness, price-line count, DKK range, latest update, and
  draft/blocker note, and they only open the existing preview. On 2026-07-03 a
  service-role read confirmed 3 suppliers, 10 total bank products, 17 price
  snapshots, and 10 import jobs; active/non-archived UI coverage is 9 products.
- That same top section is now an `Enkel produktvaelger`: product-group buttons
  first, then product cards with normalized option previews. For WMD Foldere
  this exposes options such as material, format, foldetype, pages, and direction
  from the stored 18,800-row matrix. The preview dialog now supports exact
  Matrix Layout variant selection through `Konkret produktvalg`; selected
  attributes are passed to `supplier-bank-import-draft` as `rowFilter`, so the
  dry-run and final draft import use only matching normalized price rows.
  Imported variant drafts include the selection in their draft name/slug and
  import summary. Storformat products still require the separate storformat
  importer and remain blocked from generic Matrix import.
- The Supplier Bank browser is now intentionally picker-first. The normal
  first view is button-based: product group -> print house -> product. The old
  KPI/report/status panels are hidden behind `Vis teknisk overblik` so admins
  can handpick supplier products without reading the operator report first.
- Designer PDF processing now includes a disabled-by-default private
  Stirling-PDF adapter. Inputs are read under the authenticated user's RLS
  context, outputs are immutable and user-scoped, and the browser never sees
  the provider API key. Keep `STIRLING_PDF_ENABLED=false` until a private
  processor and commercial license decision are in place. See
  `docs/STIRLING_PDF_INTEGRATION.md` before deployment.

Important files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/ProductGrid.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/pages/admin/Pod2Admin.tsx`
- `src/lib/pod2/danishTerms.ts`
- `src/components/designer/PDFImportModal.tsx`
- `src/components/designer/PdfToolsPanel.tsx`
- `src/lib/designer/pdfService.ts`
- `supabase/functions/designer-pdf-service/index.ts`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`

## Safety Notes

- Local admin may write to production Supabase data.
- Do not change POD v1 or core pricing unless explicitly asked.
- Read `POD2_README.md` before touching POD v2.
- Preserve tenant-specific settings. Code is shared, settings are per tenant.
- Run `npm run build` before any deploy when npm is available. In the Codex
  desktop shell, use the bundled Node/Vite command above if npm is missing.

### Homepage repair checkpoint — 2026-09-08

Resume from the actual homepage `http://127.0.0.1:8110/?tenantId=00000000-0000-0000-0000-000000000000`,
not the design-review pages. Design 1 remains the recorded default. Shared print
catalog routing, mobile configured navigation, category scrolling, homepage
Storformat input handoff and mobile matrix overflow were repaired. The user
explicitly approved the existing adhesive product's visibility repair (7
materials + 4 finishes + 2 delivery choices); it was applied and browser-checked.
No price values, pricing calculations, tenant IDs, product publication flags or
unpublished drafts changed. Rollback and exact IDs are in
`output/design-exploration/homepage-repair-2026-09-08/adhesive-visibility-rollback.sql`.
Read `docs/HOMEPAGE_REPAIR_QA_2026-09-08.md` for scoped evidence and remaining
release work. Preserve the dirty worktree and other admin implementation work.

### Original storefront picture 1 correction — 2026-09-08

The preceding selection record was wrong: Thomas's original first concept is
Refined Familiar (`print-familiar`), the blue-header brochure banner with a
horizontal featured-product row. This is the system default; the side-menu
Precise Print Grid remains selectable. Original concept order is Familiar,
Product First, Nordic, Precise, Calm. Archived image filenames keep their old
numbers; use stable theme IDs and the corrected `display-order.json` mapping.
See `docs/STOREFRONT_DEFAULT_CORRECTION_2026-09-08.md`. Keep the other approved
page/order-flow selections intact.

The same correction now reaches tenant shops using the standard through shared
branding resolution. New tenants and unmarked legacy Classic shops inherit it;
explicit alternatives retain their selection. Hosted data is not bulk-written.
See the automatic tenant-inheritance section of the correction document for
preservation rules and deployment/proof boundaries.

## Connection repair checkpoint — 2026-09-08

Local repairs cover truthful/conflict-checked branding persistence, atomic server-verified checkout order/files, approved-byte hashes, customer replacement/read-receipt authorization, checkout address integrity and Designer save/login safeguards. Follow-up work adds server STORFORMAT parity, fixed/rate exact stored-price support, per-area dimension verification and a transactional email outbox with a controlled dispatcher. Read `docs/SYSTEM_CONNECTION_REPAIRS_2026-09-08.md` for the six-migration matched packet, verification and rollback. The linked backend is unchanged; payment/email effects default off. Missing product price data, optional operational follow-ups and genuine hosted acceptance remain open. The current local Stripe keys are live-mode; use the designated staging procedure. Preserve the dirty worktree, existing pricing formulas/POD behavior and selected designs.


## 2026-09-09 — Color profiles and production PDF

Local implementation uses display-density proofing, exact tenant/profile/hash resolution, FOGRA39/51/52 recipes, method/supplier-mode guidance, and a shared vector/real-CMYK production PDF builder. Saved design JSON now carries profile identity/hash and production color mode. FOGRA51/52 are official per-shop installations; development-only binaries stay in ignored `tmp/local-color-profiles`. No deployment or live product/order/profile writes were performed. See `docs/COLOR_MANAGEMENT_IMPLEMENTATION_2026-09-09.md` for setup, evidence, unsupported cases and selective rollback. Preserve the unrelated dirty worktree and the protected document/pasteboard/guide behavior.

## 2026-09-20 — All six order-flow layouts in publishable Site Design

Site Design now navigates and previews all six approved design pairs and lists their selections in the existing Publish confirmation. The complete selection remains in the existing branding draft/publish/saved-design/history model. Preview-only example content reuses customer layout components; the actual customer pages already read the published choices. Delayed preview retries now use the latest selection. See `docs/ORDER_FLOW_PUBLISHABLE_DESIGNS_2026-09-20.md` for exact scope, tests, screenshots, known diagnostics and selective rollback. Browser save/publish checks use intercepted synthetic settings only: no hosted tenant changes, payments, uploads, email or deployment were performed; authenticated hosted acceptance remains separate. Preserve the unrelated dirty worktree.


## 2026-09-20 — Selected product workspace picture 2

The selected ordering-form workspace now opens for existing matrix_layout_v1 products in ProductPriceManager (default/#workspace), with existing Product & prices retained. Real ProductPrice/Matrix rendering powers both editor and storefront; presentation drafts preserve source IDs/prices and Apply is tenant/freshness guarded. New unpriced choice placeholders remain drafts; actual priced-option creation still uses the existing editor. Source, browser, build, 33 tests, rollback and explicit hosted/upload proof boundaries: `docs/PRODUCT_WORKSPACE_IMPLEMENTATION_2026-09-20.md`. Browser review on 8112 uses synthetic data only. No deployment or hosted writes. Next: choose wide-format and combined machine/learning layouts. Preserve the dirty worktree.

### Follow-up: product locator connected

The selected finder now opens at `/admin/products`; search/format/material/status filters and image preview lead into the individual product editor, preserving URL/tenant context on return. Prior management remains under `view=manage`. Local 8112 mounts the actual overview and creator against synthetic data. See `docs/PRODUCT_LOCATOR_IMPLEMENTATION_2026-09-20.md` for evidence and selective rollback. Wide-format 7–9 and combined machine/AI 10–12 are ready for selection at `output/product-creation-concepts-2026-09-20/next-layouts.html`; no choice is assumed and no costing/learning logic changed.

## 2026-09-21 — Site Design control reconnection

Use `/admin/site-design-v2` (localhost 8113). Branding V2 now redirects here. Banner controls, dropdown colors, common primary button styles, extra gallery and USP use the existing renderers. Standard reset and Undo/Redo stay in the local branding draft; publication is separate. Master templates retain separate storage and are labelled `Designskabeloner til shops`. Classic editor/reserved colors are outside the main flow. Audit, retained legacy limitations and verification are in `docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md`; rollback only the task's selective patch in `output/site-design-audit-2026-09-21/`, preserving pre-existing source work. 27 focused tests and real local preview checks pass; no hosted writes or deployment; full build/type/lint remain unverified after dependency reads stalled.


## 2026-09-21 — Site Design continuation: connected actions and isolated previews

User approved continuing the Site Design cleanup plan. Local source work now connects shared primary styling to checkout/proof/payment/confirmation/standalone designer and featured side-promotion actions; preserves callbacks, pricing and selected layouts. Catalogue columns and featured image fit/scale consume the controls; ineffective preset geometry and repeated print controls are hidden. Master templates mount the same SiteDesignEditorV2 and explain template vs library publication; classic route redirects to canonical Site Design. Legacy source remains available for later deletion review.

Found and fixed cross-editor preview contamination: embedded PreviewBrandingProvider no longer listens to the global broadcast; SiteDesignPreviewFrame uses a per-instance channel for detached previews and validates its iframe message source. Browser proof with independent shop/master editors plus a detached window passed. Latest-ref synchronization stays in place.

Verification: 43 focused tests pass. In the fresh temporary dependency environment, current semantic TS diagnostics 368 vs 372 before, and touched-file lint diagnostics 429 vs 430 before; no introduced signatures. Full build remains blocked by dataless cloud image files; manifest/lock mismatch prevents npm ci. No package/lock replacement was applied. Isolated synthetic save→reload→publish→customer result and master draft/publication passed, with the separate shop unchanged. Five presets had correct heading defaults/no desktop overflow; 5-column catalogue and featured cover fit verified. Connected /admin/site-design-v2 on port 8113 was browser-verified ready.

Hosted writes/uploads/payments/deployment were not performed. Current connected master-template route still fails its existing role gate even with explicit platform context; source-level template-library handoff is connected, but hosted premade_designs writes/paid assignment are unverified. Full media/menu/device and commercial acceptance remain open. Do not weaken roles or assume synthetic tests prove hosted acceptance.

Review docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md and output/site-design-audit-2026-09-21/. continuation.diff is against /tmp/site-design-phase2/before, separate from first-pass implementation.diff. Reverse selective hunks only; repository has extensive unrelated changes. QA client under the evidence directory is clearly synthetic and was never part of the production entry point.


## 2026-09-21 — Site Design remaining-items pass

Connected master access is fixed without granting roles: deployed verify-admin omits isMasterAdmin, so the hook now reads stored roles instead of interpreting the missing field as false. Explicit false and tenant-context masking are preserved; email/localhost privilege shortcuts are removed. Real connected master editor and its two saved template reads were browser-verified; the user tab is back at Site Design on 8113 with Preview klar.

Shop libraries now include private templates assigned to that shop and validate assignment responses before success. Found that usePaidItems manufactured completed purchases without a payment provider; this is disabled, paid unassigned templates cannot apply, and the payment dialog explains the unavailable feature. Do not re-enable without server-verified payment finalization.

Migration supabase/migrations/20260921160543_site_design_library_access.sql restricts library edits/assignments to platform admins, scopes private reads, and forbids browser-created purchases. Applied ONLY to existing isolated webprinter-launch-test cyurochbkxggcobnxaxq (hosted ledger version 20260921161413). Transactional hosted role/assignment/branding CAS checks passed and all test DML rolled back. Live ziattmsmiirfweiuunfo is unchanged and still has broad authenticated library writes: reviewed live migration rollout remains open. Do not replay under the different timestamp on the isolated backend.

57 focused application tests and 27 local PostgreSQL assertions pass; isolated browser template save/reload/publish and disabled-payment checks pass. Nine menu presets across desktop/tablet/mobile preview widths have no horizontal document overflow. Corrected package-lock against unchanged package.json; clean temporary npm ci passes. Production-mode Vite build passes in a recovered copy: 95 active placeholder recoveries match prior release SHA-256 manifest, six unused backup files match index blobs. Original cloud files are unchanged. Same-environment semantic diagnostics remain 386 before/after; touched-file lint falls 59 to 55, no introduced signatures. These are not green repository-wide type/lint or a deployed/server build.

Read the final section of docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md and output/site-design-audit-2026-09-21/remaining/ for current evidence, source patch and unresolved signed-session hosted UI/upload/payment/device checks. No live shop writes, publication, uploads, product/pricing changes or production deployment. Preserve the dirty worktree; use selective rollback only, retaining the payment and permission safety boundaries.


## 2026-09-21 — Site Design signed-session hosted acceptance

The isolated hosted workflow now passes with genuine existing fixture Auth sessions and the public client key: master template save with real 640x360 JPEG upload, assignment to shop A, owner library read/apply, draft save/reload, confirmed isolated publish, and separate anonymous customer read. Shop A's exact original settings were restored through its owner's conflict-checked RPC; shop B stayed unchanged. Two named private template rows, one assignment and one thumbnail remain for review on cyurochbkxggcobnxaxq. Normal login/signup/recovery UI was not exercised; fixture credentials remain ignored and are not in the evidence packet.

Fixed a legacy PreviewShop redirect that replaced the canonical editor's explicit master tenant with an owned shop. Screenshot capture now uses the current editor iframe, origin and per-request ID/listener/timer; stale or foreign-frame responses and non-JPEG URLs are rejected. Parent/iframe preview messages are source-checked. Connected 8113 click-to-edit still opens the correct Banner inspector, with no saved content changes.

64 application tests and 13 genuine-session/API checks pass. Semantic TS remains 386 before/after; selected-path lint is 45 before/44 after, with no introduced signatures. Full local vercel build --prod passes for the frontend and all six server routes in the recovered source copy. api/sitemap.ts recovery matches the prior release SHA-256 manifest. Original cloud placeholders and existing repository diagnostics remain; no production deployment occurred.

Automatic approval review rejected applying the tested library permission migration to live ziattmsmiirfweiuunfo because explicit authorization for that persistent production RLS/grant change and its blast radius is required. A concrete approval request is pending; do not retry without approval. The migration remains installed ONLY on isolated cyurochbkxggcobnxaxq. No live-shop publication, library/asset writes or pricing changes. Real design purchases remain disabled pending a separately implemented server-confirmed payment flow.

Latest status, retained fixture IDs, exact boundaries and current remaining items: docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md, final section. Evidence and selective rollback patch: output/site-design-audit-2026-09-21/hosted/. Preserve the dirty worktree and security boundaries; do not reset whole files.


## 2026-09-21 — Approved live Site Design permission repair

User explicitly approved next steps subject to preserving existing work. The exact isolated-tested site_design_library_access migration is now APPLIED to live ziattmsmiirfweiuunfo, hosted ledger version 20260921185756. This supersedes the preceding pending-approval/rejection checkpoint. Isolated cyurochbkxggcobnxaxq remains at version 20260921161413; do not replay migrations under either timestamp. Fresh live before/after hashes confirm unchanged templates (2), assignments (0), purchases (0) and every tenant's settings. Live grants/policies match isolated exactly, read-only grant/anonymous probes pass, and the genuine connected master library still displays both existing templates. No data DML, live shop publication, charge or frontend deployment.

Expanded synthetic browser verification: 120 products, 12 categories/four children, nine menu presets at 1280/768/390 (27 combinations), search and nested access to product 120, Escape/focus checks, and six image transitions at mobile/desktop (12 combinations) pass. Physical devices/video/reduced-motion and full commerce remain outside coverage. QA viewport restored and localhost 8129 test server stopped.

Static/literal dynamic import graph: 564 reachable modules; old TenantBrandingSettings, UnifiedBrandingEditor, BrandingEditorV2, BrandingSettings and PreviewInteractionManager are inactive. Keep them under the no-destruction condition; TenantBrandingSettingsV2 is an active redirect. No application source changes this pass.

Cloud originals: 43 of the 102 known build placeholders are currently available; 59 remain dataless. Native download requests were accepted but sampled sitemap remains NotDownloaded/not downloading. No Git/release bytes overwrote originals. Existing 386 TypeScript diagnostic backlog remains; full recovered-copy build and previous 64 tests/13 signed-session checks are the latest code results. Keep billing disabled pending the user's free/assigned versus test-mode Stripe choice; no provider, fee or real charge is assumed. Frontend release requires a scoped packet separated from the unrelated dirty worktree and commercial acceptance.

Current audit: docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md, final section. Evidence: output/site-design-audit-2026-09-21/rollout/. Preserve the restrictive permission boundary and unrelated worktree edits.
