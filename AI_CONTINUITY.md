28 September 2026 — automatic sales-folder 3D batch complete locally: Thomas approved 10 mm and authorized all sales folders in one pass. 143 review variants / 1,421 exact PDFs / 79 geometries; 142 configured catalogue variants share product/Designer/checkout rendering. A4/A5/A6/M65/21 × 21 cm, all linked capacities, flap/window/closure types and 4+0/4+4. Legacy 5 mm is modelled but unbound because its product selection metadata is absent. 46 tests, TS/lint/build, all-143 browser render/unfold checks, two-sided PDF rejection/preservation and six responsive widths pass. No publication/deployment. Read docs/3d-review/PROJECT.md and SALES_FOLDER_BATCH.md. Supersedes earlier 007-pending and one-at-a-time sales-folder notes.

28 September 2026 — 3D review handover for a fresh chat: read `docs/3d-review/PROJECT.md`. Candidates 001–006 are approved and enabled in local shared preview code; 007 (10 mm A4 sales folder) is ready for review but NOT approved. The canonical queue remains `docs/3d-review/plan.json`. `MODEL_REVIEW_TEMPLATE.md` supplies a worksheet; `NEXT_REVIEW.md` is intentionally blank. Preserve the existing models, exact-fingerprint approval scope, dirty work and open drafts. Product publication/hosted acceptance remain separate.

28 September 2026 — WebPrinter owns the shared 3D system: removed the single Salgsmapper product-ID dependency; models resolve from reviewed template fingerprints and product-owned presentation rules in pricing_structure.workspaceContent.preview3d. Array conditions keep section/value IDs compatible with the existing recursive import remapping; no SQL/pricing changes. Existing two-flap preview retained. Master catalogue currently contains Salgsmapper uden vinger, a different construction that remains unmodelled. No live master assignment/editor, product creation, publication or deployment performed. 25 tests, TS/lint/build and existing six-width login/upload/checkout browser regression pass locally; remapped tenant fixtures are not hosted import acceptance. See docs/FOLDER_3D_PREVIEW.md and output/qa/webprinter-3d-core/.

28 September 2026 — product-page upload correction: Upload fil now requires login in an inline dialog, uploads through the existing private-file service and shows actual artwork without navigating. The regular order action carries the file into checkout with proof approval required. Template/account changes clear the local draft; product-page reload persistence is not added. Removed hardcoded order-layout header overrides so saved shop branding remains consistent. 22 focused tests, whole-app TS, scoped lint/build, six-width browser QA, simulated login/upload/sign-out, variant reset, file-hash handoff and header parity across four routes pass. Authentication/storage intercepted; no hosted writes or deployment. Prior upload-shortcut navigation below is superseded. Evidence: output/qa/folder-inline-upload/report.json and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — compact product 3D controls and upload shortcut: one small specification line, corner camera controls and small fold buttons under the picture; removed the inline instruction/footer blocks. Eligible 4+0 previews include an Upload fil shortcut to the existing checkout upload/placement flow using the current price-panel action. Both calculator layouts, six widths each, a 320 px touch browser, selected-quote/template preservation and fresh PDF-to-3D passed. Eleven tests, TS, scoped lint and final build pass. Storage intercepted in QA; no hosted writes, saved layout change or deployment. Evidence: output/qa/folder-compact/report.json and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — corrected product-page 3D placement: ProductPrice now places a photo/3D switch in the actual product media area; removed price-summary modal actions. Shared renderer retains plain branded product colours and actual customer artwork in upload/designer. Salgsmapper currently saves layout 1; review uses existing Nordic Product Studio via orderDesign=2 (photo left, selections right, matrix below), without changing published branding. Actual-page six-width checks, quote preservation, fresh PDF upload, proof-placement-to-3D updates, latest designer artwork/state preservation, eleven tests, TS/lint/build all pass locally. Original designer tab preserved; storage writes intercepted; no hosted changes or deployment. Review: http://127.0.0.1:8160/produkt/standard-sales-mapper-kopi-2?force_domain=salgsmapper.dk&orderDesign=2. Evidence: output/qa/folder-placement/ and docs/FOLDER_3D_PREVIEW.md.

28 September 2026 — compact plain 3D folder in the product order section: shop-colour model without graphics/text; selected 4+0 shows white inside and 4+4 colours both sides. Exact product configuration mapping bridges the missing 4+4 template for illustration only; uploaded/designer artwork remains 4+0. Shared dialog now max 780 px / stage 350 px. Eleven tests, whole-app TS/build, scoped lint, six-width browser checks and real product selection/quote-preservation checks pass. No pricing/template data changes, hosted writes or deployment. Review: http://127.0.0.1:8160/folder-mockup.html. See docs/FOLDER_3D_PREVIEW.md.

27 September 2026 — shop template constraints: compact cards clear stale desktop grid positions, quantity buttons reflow as whole controls, and explicit button newlines remain supported. Print media and thumbnail frames are bounded below navigation. 18 actual-shop responsive cases plus 36 isolated stress/regression cases, TypeScript and production build pass. Original editor and selected Nordic design preserved; no save/publication. Photo/menu collision was not exactly reproduced; containment safeguards were verified. See docs/SHOP_TEMPLATE_CONSTRAINTS_2026-09-27.md.

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

23 September 2026 — configuration gallery implemented locally in Produktside → Billeder og produkttekst. Single-option and AND-combination images, specificity priority, general thumbnails/manual selection reset, existing draft/apply path; matrix row gallery mapping stays presentation-only. 23 focused tests, production build and 320–1440 px real preview checks pass; no hosted write/upload/publication. Workspace/runtime ten-file hashes match. Final whole-app typecheck had one unrelated concurrent checkout Json.mode error. See docs/PRODUCT_CONFIGURATION_GALLERY_2026-09-23.md and scoped evidence. Preserve earlier image upload and publish/send controls.

# Webprinter AI Continuity

23 September 2026 — checkout proof/value follow-up: outside JPG/PNG approval now prepares a matching PDF, exposes warning acceptance, and removes the clipped approval border. Selected-product card uses actual calculator quantity tiers, with paper/options edit preserving artwork/customer drafts and requiring reapproval. Actual 350gr matsilk 75→100/150 prices corrected in the display (504→579/734 kr); pricing formulas untouched. 18 tests, active-copy typecheck/build and isolated six-width UI checks pass. New hosted image-to-PDF round-trip remains untested. Active 8113 recovered copy synchronized; no deployment/live writes. See docs/CHECKOUT_REVIEW_AND_VALUE_2026-09-23.md.

23 September 2026 — product publish/tenant controls restored in default Find products. Root cause: ProductLocator early return omitted existing management actions/dialog; management link was buried below filters. Same issue in both source copies. Reused unchanged publish/send handlers, mounted existing send dialog in both views, exposed management link at top. Real master browser dialog/recipient options and six viewport widths verified without publishing/sending; typecheck/build and three locator tests pass. All three scoped files match active recovered localhost copy. Preserve workflow entry points and verify actual serving root on future edits. See docs/PRODUCT_ACTIONS_REPAIR_2026-09-23.md.

23 September 2026 — IMPORTANT localhost source correction: active port 8113 (PID 34561) serves /private/tmp/featured-product-review-2026-09-22/app, NOT the workspace. User found upload fixes missing. Synced only 12 scoped frontend upload/approval files and pinned missing packages; actual served module verified and actual running copy typechecks. Image-size draft restored to 105%. Browser extension blocked diagnostic file selection; user retry and real upload/readback/preview still pending. Backend remains 50 MiB. Check lsof cwd and served source before claiming future workspace changes are visible. Evidence: output/upload-localhost-repair-2026-09-23/ and docs/PRODUCT_UPLOAD_FIXES_2026-09-23.md.

23 September 2026 — checkout approval follow-up: branded approval/review actions above uploaded preview; direct and Corrector approval focus the existing order summary after closing the dialog. Full-designer handoff and production-artifact guards preserved. Ten proof tests, recovered-copy typecheck/build and synthetic responsive/focus checks pass. Local only; upload activation/delivery open items remain in docs/PRODUCT_UPLOAD_FIXES_2026-09-23.md.

23 September 2026 — product image/large-file upload fixes implemented locally. Product image transfer retries/progress, reference-first removal, unsaved editor preservation; chunked 1 GiB checkout candidate with bounded hashing/PDF reads and server-side copy. 37 focused tests, recovered-copy TypeScript/build, local synthetic 1 GiB interrupted-transfer test pass. Live 50 MiB limit is intentionally retained until matching backend activation; delivery destination/retention and authenticated image upload acceptance remain open. No live writes/deployment. See docs/PRODUCT_UPLOAD_FIXES_2026-09-23.md.


22 September 2026 — legacy cleanup and scoped Site Design candidate: full application TS now 0 (previous 171 included one missing shared-file diagnostic; complete baseline 170). ESLint 2,354 → 1,980 errors / 156 warnings; all remaining errors are explicit any. 42 proven-unused files archived verbatim with hashes/import evidence. 50 source files repaired; pricing formulas and production rules preserved. New typecheck/health commands retain original rules and reject per-file/rule lint increases. 536 application tests; 51 scoped tests; 31 synthetic browser checks on each candidate; both production builds pass all six server routes. Recorded production baseline 1,184/1,184 hashes verified; scoped patch has 66 source changes plus presentation assets/config/lock housekeeping, API/shared backend unchanged. No deployment or live write. All 1,274 full-build inputs match the working repository; unrelated existing worktree changes remain. All three public shops still serve the recorded entry bundle; authenticated deployment metadata returned Vercel team-scope 403 and remains a release gate. Deployment freshness/authorization and real auth/order/device acceptance remain open; shop/product/devices pending. See docs/SITE_DESIGN_LEGACY_CLEANUP_2026-09-22.md and docs/SITE_DESIGN_RELEASE_PACKET_2026-09-22.md. Do not deploy the full-worktree artifact or replay the prior live permission migration.

22 September 2026 — Site Design remaining-item pass: user chose free/master-assigned templates; canonical creation is fixed at zero, assignment copy is explicit, and legacy prices/purchases remain. Application TS 380 → 171; src ESLint 2,731 → 2,354 errors, 173 warnings; all 10 hook-rule errors resolved without weakening checks. 199 local tests and 31 synthetic browser checks pass. Full local production build passes all six server routes with no packaging type error; 1,302 source/config files verified. Read-only schema introspection only; no hosted writes, payment, messages, supplier action or deployment. The artifact includes prior unrelated worktree changes and is not a scoped production release. Repository debt, auth/commercial/device acceptance remain; shop/product and available-device input is pending. See docs/SITE_DESIGN_RELEASE_PACKET_2026-09-22.md and the latest audit continuation. Preserve the existing worktree and permission restrictions.


21 September 2026 — Site Design continuation: all 102 known original build placeholders are downloaded and SHA-256 identical to prior verified recoveries. Fixed two browser-reproduced HeroSlider reduced-motion bugs: fallback text movement/delay and an initial video play request. Three local source files changed; existing branding/defaults/pricing/publishing are preserved. 66 application tests and 39 media browser checks (1280/768/390) pass. Same-environment TS 386 → 380, no new signatures; HeroSlider lint 4 → 0. Full current-source local Vercel production build passes with all six server routes and 1,289 matching source files; separate temporary dependencies, no deployment or hosted write. Billing choice, remaining type/lint debt, scoped frontend rollout and commercial/physical-device acceptance remain open. See `docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md` final section and `output/site-design-audit-2026-09-21/media-and-types/`. Preserve the dirty worktree and existing restrictive permissions.


21 September 2026 — product presentations 1/3/4/5 implemented locally as selectable Site Design homepage/catalogue layouts; option 4 has optional hover/focus motion, all use existing product data. 11 tests and eight-file syntax/transpilation pass. Final visual/build/type/lint and authenticated persistence acceptance remains open after dependency failures/browser timeouts. No hosted save/publish, pricing/POD/schema changes. See [implementation and QA evidence](docs/PRODUCT_PRESENTATIONS_2026-09-21.md).


20 September 2026 — selected wide-format 8 and machine 11 implemented in the actual app: product locator → STORFORMAT opens the interval workspace; machine-pricing opens the assisted cost test. Existing manager save, tools, library, simulator and profile forms are reused. Nearest-step wide-format rounding and gross-margin/upward machine rounding remain unchanged. Assistance compares configured machines; historical production learning/Jev is not connected. Normal app on 8113 uses the real backend; public catalogue works, admin acceptance awaits normal login. Separate synthetic 8112 browser checks verify save/reload and form connections. 26 tests/build/new-component lint pass; 403 baseline/current TS diagnostics, no additions. No production data writes or deployment. See `docs/PRODUCTION_WORKSPACES_IMPLEMENTATION_2026-09-20.md` for verification and rollback.

20 September 2026 — local graphic guidance: Thomas selected the combination of proposal 2's side menu/next navigation and proposal 1's instructional visuals. Implemented five lessons at `/grafisk-vejledning`, preserving the original detailed guides below. Examples use 3 mm bleed outside trim and 3 mm safety inside trim, matching the current designer; actual product templates remain authoritative. Browser desktop/mobile navigation, zoom, template catalogue and detailed disclosures pass; scoped lint and build pass. Global TypeScript remains at 403 diagnostics elsewhere. No deployment, pricing/POD, database or branding writes. See `docs/GRAFISK_VEJLEDNING_IMPLEMENTATION_2026-09-20.md` and the selection manifest in `output/design-exploration/grafisk-vejledning-2026-09-20/`.

Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

Latest production rollout checkpoint (16 September, evening): **41 live functions now use modern keys**, verified ACTIVE; public unpublished pricing is closed and the hardened supplier explorer is live. All 201 products and 357,913 generic price rows remain unchanged across 23-table content checks. Vercel production build settings use the modern public key and private-upload flag; domains and live schema/bucket are unchanged. The old service key remains enabled. Thomas approved preserving live contact emails; send-contact-message v8 is deployed and verified without sending mail. Thomas also approved the existing OpenAI/Gemini image-sharing and provider-cost behavior; icon-studio-generate v7 is ACTIVE with exact source verification and a denied guest probe, without generating images. A separate live checkout-schema migration was rejected as premature before the matched release; no live DDL was applied. The full v4 candidate is now READY on its protected Vercel URL after fixing server-dependency packaging and protected same-origin asset fetches. The six customer domains remain on the existing deployment; the prepared Stripe callback has not been created. Three new asset-security tests pass; TypeScript remains at 403 diagnostics. Matched backend/file/frontend release and final key disable remain open. New isolated checkout snapshots retain production selections. 145 focused tests pass; TypeScript remains at 403 diagnostics. See [the current rollout checkpoint](docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact versions, candidate, remaining audit findings, approvals and rollback. Earlier checkpoints below are historical.

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
Read [the current migration checkpoint](docs/KEY_AND_FILE_MIGRATION_2026-09-16.md) for proof and rollback boundaries.

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


Latest VAT checkpoint (2026-09-16, 13:49 CEST): Thomas confirmed initial delivery
to DK with VAT. Implemented explicit dk-domestic-v1 for the three launch shops,
25% on net products/options/shipping. No foreign-billing/IP zero-VAT shortcut;
foreign delivery or unconfigured seller policy rejects new checkout. Future EU
consumer/business/export rules differ (official sources in release packet).
Local migration 20260916112627 installed ONLY isolated as 20260916113115; immutable
orders.checkout_tax and matching outbox snapshots. Creator29/finalizer14/webhook14/
dispatcher15/status31 deployed, all 33 sources match. 60 tests, five Deno checks,
11-migration grants check and build pass. Hosted country/net-amount denial and
tax immutability pass. Actual protected qcxqy1pbk browser test charged 553.75 TEST
(443 net +110.75 VAT), order e1db04fe-23df-46be-8085-8a628923501b, attempt
4d9bac50-43d8-4400-9bc8-35ffb8f9e28d. One exact-hash PDF, two unsent emails with
matching tax, confirmation survives reload. Email renderer/invoice amount helper
agree; complete invoice PDF/admin UI not accepted. Checkout503/email409 paused;
cron never enabled, no new email/real money/supplier/live changes. Earlier attempts
unchanged. Production snapshots stale; RGB warning/security/admin/connected-routing
and matched live rollout remain. Read docs/PRODUCTION_RELEASE_2026-09-16.md first.

Latest browser/payment checkpoint (2026-09-16, 13:13 CEST): actual Webprinter
1200 × 600 mm aluminium PDF upload/approval → Stripe TEST card payment → one
saved order/file + two pending emails → reload confirmation passed. Attempt
30024f42-b4ca-4e84-9287-5d5acbf42988, order c63da1fa-22a9-48e5-b8f8-83f7273f14cd,
livemode=false, WEBPRINTER suffix. Finalized PDF hash equals inspected upload.
New protected checkout preview joet1abr6 / dpl_4cJhRsNVvDFtrK2fjF5YRbZ6Bc7p;
explicit exact-backend/test-key gate, two payment-handler exceptions only,
34 focused tests/build pass. Checkout paused again (503), email disabled (409),
cron inactive; no new email/supplier/live payment. Full production artifacts below
are now STALE after frontend changes; no domain/production rollout.
BLOCKER: 443 kr ex-VAT is charged as 443 kr; frontend and server both omit VAT.
Pending question: Denmark-only delivery at launch or international immediately?
Do not assume the answer or change old frozen payment amounts. False RGB warning
also reproduced on independently verified CMYK PDF because PDF.js rendering ops
normalize CMYK to RGB; fix trustworthy validation, never claim colour success
from rendering ops. Receipt size/material blank; test banner hidden behind modal.
Read docs/PRODUCTION_RELEASE_2026-09-16.md first for exact evidence and remaining
security/admin/connected-payment/matched-deployment work. Earlier paused helper's
five-allowlisted-row assertion is historical now that two more emails are queued.

Payment label chosen (2026-09-16): Thomas accepts WEBPRINTER for payments from
Webprinter, Salgsmapper and Onlinetryksager. Prepared stripe-create-payment-intent
now freezes that card suffix into quote_snapshot only for those three IDs; old
attempts preserve their original parameters and other tenants remain unchanged.
22 checkout/handler tests and Deno check pass. No shared account branding/routing
change. Isolated creator v26/JWT on deployed; all nine sources match. Checkout
503/email worker 409 still reject new effects. No new payment/email. Read release
packet for production limits and retry-safe rollback.

Shared Stripe clarification (2026-09-16): Thomas confirmed the account is shared
with “Crocodile” under the same company and explicitly rejects creating a second
account for that company. Preserve the existing Printmaker account and other
integration. Read-only test-dashboard Business details confirm COOKADELI is the
configured statement descriptor. The earlier shared-account question is answered.
See release packet for per-payment shop metadata/suffix options and account-level
receipt limits; no Stripe settings, routing or code changed in this clarification.

Browser follow-up (2026-09-16): actual 1200 × 600 mm Designer Print PDF and
checkout storage copy verified: 3 mm bleed, FOGRA39 CMYK, outlined Danish text
and vector shapes, identical decoded page/form streams. Not PDF/X certification.
Found/fixed preview shop selection leaking between tabs: useShopSettings now
pins per sessionStorage tab, retaining localStorage as new-tab preference.
Two regressions failed before; all 32 focused checks and preview build pass.
Updated protected preview: printmaker-web-craft-main-q2ykt4y6m-thomas-projects-d80b9ddd.vercel.app,
deployment dpl_8CiiuMEC6CGCQnV2bXBnnwKJrCtt. Hosted two-tab test retained Webprinter
through product/Designer/PDF/checkout/reload while another tab used Onlinetryksager.
Payment/mail/scheduler remain paused. Browser Stripe form still untested; safety
label is 3 mm in Designer vs 2 mm in checkout. Read release packet for artifacts.
Refreshed production artifact: output/production-release-2026-09-16-tab-fix/.vercel/output;
1,163 hashes match current source, six API routes built, 305 static files secret-
scanned clean at 10:22 CEST. Earlier candidate below lacks the tab fix; retain as
history only. This new production artifact has not been deployed.
Asked Thomas whether Printmaker Stripe's COOKADELI merchant name reflects a shared
account; do not change shared account branding without resolving that question.

Production preparation (2026-09-16): read `docs/PRODUCTION_RELEASE_2026-09-16.md`.
Full production Vercel build passed with six server routes; artifact is private in
`output/production-release-2026-09-16/.vercel/output`. Domains remain unchanged.
Live address-column repair applied as hosted migration 20260915221814. Latest
branded mail deployed to isolated backend (dispatcher v7, status v23), exact source
verified, 31 email + 20 checkout tests pass. Thomas approved creation of the
domain-restricted test sending key and chose the saved shop contact address:
support@onlinetryksager.dk. Resend sign-in is complete; sending-only webprinter.dk
key 80e64154-5c01-42ea-a9f4-26628d09127c is installed ONLY as
STOREFRONT_ORDER_EMAIL_RESEND_API_KEY on cyurochbkxggcobnxaxq. No global key.
Three new TEST payments each finalized via signed webhook into an order/file.
Resend reports exactly seven approved confirmations/operator/status/problem
messages Delivered. Duplicate dispatch/status calls produced no extra messages;
customer status-send was denied 403. Thomas confirmed receiving some emails;
do not infer receipt of all seven or visual approval from that confirmation.
Vault-backed cron job 1 ran at 00:49 CEST with HTTP 200/all-zero counters, then
was paused. Checkout=false, email mode=disabled, cron inactive; authenticated
worker probe 409 and checkout 503 verified. Five sent outbox rows remain; five
non-allowlisted rows are untouched at zero attempts. Three fixture products hidden.
Read docs/storefront-email-scheduler.sql and the release packet for reuse/rollback.
Do not repeat the resolved key-creation approval request.
Existing Printmaker Stripe test dashboard remains accessible; do not substitute
the different account offered by the new Stripe connector. Full browser order and
inbox/client acceptance and the matched production backend/frontend rollout remain.

Historical online preview (2026-09-15; superseded above): protected Vercel preview
`printmaker-web-craft-main-la8louip3-thomas-projects-d80b9ddd.vercel.app`, connected
to isolated Supabase `cyurochbkxggcobnxaxq`. Three shop catalogue/branding copies,
preview-only payment/outbound guards and test admin access are prepared. Read
`docs/ISOLATED_ONLINE_PREVIEW_2026-09-15.md` for final copy and verification status.
Do not promote this static test artifact to production. Vercel CLI/browser work;
the connector alone has a team-access error. No live domains/data changed.


Email scope clarification (2026-09-10): Thomas explicitly deferred an email
designer and special-offer/campaign tools in the Social Hub. Current work is
standard transactional order/status emails with published tenant branding.
Do not build the email editor or marketing-send workflow in this launch pass.
This clarification does not answer the pending new-key approval/test-inbox questions.

Branded emails (2026-09-10, latest): user authorized Resend key-page access and
tenant-colored standard letters. Page access works. Creating the prepared new
key (Webprinter launch test, Sending access, webprinter.dk only) was separately
blocked by automatic approval review; explicit create-key approval and test
inbox questions are pending. NO new key or email. Shared local order-email
shell now covers nine variants with published branding, tenant names/logos,
safe colors/fonts, and frozen retry payloads. 31 tests, two Deno entrypoints
and 24 responsive measurements pass. Preview at http://127.0.0.1:8186/ and
`output/email-design-2026-09-10/index.html`; read-only static server, synthetic
orders, live published branding reads only. NO deployment of these latest edits.
Deploy both updated email functions plus storefrontEmailDesign.ts before tests.
Store the new key as STOREFRONT_ORDER_EMAIL_RESEND_API_KEY: TEST mode now requires
this scoped name. Do NOT set global RESEND_API_KEY on staging, because copied
legacy contact/quote functions use it outside the order-email allowlist.
Read the newest email checkpoint in docs/launch-review-2026-09-10/verification.md.
Email stays disabled; the earlier four staging outbox rows are unchanged.
Contact/quote/Auth letters and actual inbox/client verification remain open.

Isolated launch staging (2026-09-10, latest): Thomas approved the schema-only
Supabase branch `webprinter-launch-test` / `cyurochbkxggcobnxaxq` in “yebbo
project”, US$0.01344/hour plus usage, and signed into Stripe Test mode. Seven
prepared repair migrations and five matching functions are deployed/read back
there. Historical branch replay failed: an ignored guarded schema-only baseline
in `tmp/launch-staging-20260910/bootstrap/` repaired this empty branch. NEVER
merge that baseline into root migrations or production. Five synthetic users,
two shops and two products; no live business data copied.
New `20260910164000_storefront_tenant_write_boundaries.sql` fixes 11 reproduced
tenant/save failures on staging; 29/29 hosted checks now pass. It is NOT LIVE
and must ship with the finalizer/frontend packet because it restricts direct
customer order inserts. No price formulas/amounts or POD submission changed.
Stripe TEST guest/customer success, decline/cancel, 3DS, duplicate callbacks
and actual 503-to-200 webhook recovery pass: four paid test orders, one file
and pending email each, zero live-mode attempts. Final payment checks 18/18.
Checkout creation and email sending are disabled for the pause. Resend domain
webprinter.dk is verified, but automatic approval review blocked opening API-key
settings pending explicit credential authorization; an approved test inbox is
also needed. Stripe challenge says COOKADELI: confirm shared-account/merchant
name before any branding change. No email or supplier order sent.
Resume from the isolated staging checkpoint in
`docs/launch-review-2026-09-10/verification.md`, safe evidence
`staging-acceptance.json`, and `docs/LAUNCH_REGISTER.md`. No isolated application
frontend is connected yet; ordinary localhost 8110 still uses live services.
Live payment/save/email and new tenant-policy rollout, remaining security/key
rotation, signup, actual production files/processing and full UI acceptance
remain open. This supersedes the sign-in/cost pause in the historical entry below.

Launch implementation (2026-09-10, after the audit): the six maintenance
functions are now deployed with JWT checks and strict local-only guards;
`20260910154637_restrict_public_catalog_views_to_reads.sql` is deployed.
Downloaded source matches; 12 hosted denial checks and both public-role catalog
reads pass, with unchanged 3/4 published counts. The local legacy-menu test and
25 MB upload copy are corrected. 524 Node tests, six isolated browser tests,
the catalog SQL fixture, six Deno entrypoints and build pass; 401 app TypeScript
diagnostics remain. See the implementation checkpoint in
`docs/launch-review-2026-09-10/verification.md`. Pause for Stripe test-dashboard
sign-in and the isolated-backend organization/cost choice. No payment/email
repair deployment or frontend deployment occurred; historical credential
rotation and broader security acceptance remain open. Thomas explicitly lifted
earlier code locks, including pricing, for assessed system-wide improvements;
preserve connected behavior, shop data and unrelated dirty work.

Launch audit (2026-09-10): read `docs/LAUNCH_REGISTER.md` and its linked
`docs/launch-review-2026-09-10/verification.md` before release work. Current
localhost 8110 works through the aluminium checkout-to-Designer handoff;
520/521 Node tests and the build pass, while 402 app TypeScript diagnostics
remain. Actual hosted source/metadata confirms older unguarded admin/seed
endpoints, writable owner-rights public catalog views, and absent September
payment/account/branding/email backend repairs. Close those security gaps
first, then use the existing Stripe test environment with an isolated backend
for transaction acceptance. The test Git branch already contains current core
frontend work plus payment guards; ordinary localhost still uses shared data
and live-mode Stripe configuration. This audit changed documentation only.
No hosted mutation, payment, email, staging, commit, push or deploy occurred.

Checkout empty-file state (2026-09-09): the “Filen ser klar ud” card no longer
appears before upload/check completion. Review and approval require the current
file/preview and idle processing; restored unchecked uploads use manual review.
Ten focused tests and the actual empty-checkout browser check pass. See
`docs/CHECKOUT_FILE_APPROVAL_STATE_2026-09-09.md`. No upload, payment or live-data
write was performed for this correction.

Pixart price correction (2026-09-09): the user also approved implementing the
separate piece-size/count pricing basis. Local `per_piece_quotes` now retains
full retail order quotes for exact quantities, interpolates only within each
quantity's captured piece-area range, and fails closed outside coverage. The
existing Pixart agent/importer, admin, storefront and exact checkout mirror
carry that model. A real-component isolated browser fixture reproduces
184 / 354 / 531 / 708 kr at 120 × 80 cm; unsupported selections clear checkout,
and admin save/remount retains the model and anchors. The additive migration
and supplier replacement remain local and unapplied. The real product still
uses the corrected legacy lookup (172 / 343 kr for 1 / 2 pieces). Read
`docs/STORFORMAT_PRICE_CORRECTION_2026-09-09.md` before continuing the review;
preserve the existing payment release hold and unrelated dirty worktree.
72 focused tests, the build and the offline migration fixture pass. The
separate protected `.agents/skills/pixart/SKILL.md` copy still needs explicit
sync approval after an automatic-review rejection; do not bypass that block.

System landing simplification (2026-09-09): `/platform` now restores the original
sliding product illustrations, shows calculator/designer/order capabilities in
one compact area, reserves a clearly labelled future-film slot, and explains
the shared platform's ongoing development alongside AI. Read
`docs/LANDING_PAGE_SIMPLIFICATION_2026-09-09.md` for browser and build evidence.
The calculator uses isolated example values with the unchanged pricing engine;
no tenant/product settings were written. The previous illustrative tour assets
remain available. This local revision supersedes the tall landing layout in
`docs/LANDING_PAGE_DESIGN_QA_2026-09-08.md`; it does not change release gates.

Storefront context/header correction (2026-09-09): explicit localhost demo
selection now persists across bare-root navigation; settings and catalog caches
respect route/tenant context. The storefront keeps full navigation on laptop
and tablet widths, using a second row before the phone menu below 640px.
Other header consumers keep their existing policy. Read
`docs/STOREFRONT_CONTEXT_HEADER_QA_2026-09-09.md` for real-backend browser evidence
and limits. Salgsmapper's saved `webprinter demo` logo text was identified but
not changed; the final local preview is the actual master demo. Source changes
are local and undeployed; preserve tenant branding and selected menu presets.

Machine setup refinement (2026-09-08): machine-pricing forms/workbenches now use small corners and clearable numeric fields. The new-machine dialog shows live format fit and machine cost from unsaved inputs through the existing simulator, with accurate square-cornered sheet geometry. Cutting is an explicitly unsaved test estimate; existing pricing engines and saved machine schema are unchanged. Read `docs/MACHINE_SETUP_QA_2026-09-08.md` for local browser/test evidence and limits.

Product dropdown selection (2026-09-08): nine approved menus are implemented locally; **gallery #5 Search & Discover is the dropdown default**, and #6 Editorial Feature is excluded. The other eight are selectable in Site Design independently of the overall shop theme. This does not change the Refined Familiar storefront-theme default. Read `docs/DROPDOWN_MENU_IMPLEMENTATION_2026-09-08.md` for the exact selection, responsive/browser evidence, 23 passing tests, build result and hosted-save boundary. Preserve the user's chosen menu when applying another theme.

Connection repairs (2026-09-08): read `docs/SYSTEM_CONNECTION_REPAIRS_2026-09-08.md` before changing checkout, branding or customer files. Local v2 payment finalization, settings CAS, customer permissions/replacements, address preservation and Designer save safeguards have source and synthetic database/browser tests. The follow-up adds STORFORMAT server quotes using the exact existing formula, verified per-area option dimensions, and a transactional confirmation email queue/dispatcher. Missing stored fixed/rate prices remain blocked. Six migrations plus matching payment/email functions and frontend remain undeployed; new payments and email dispatch default off. Current local Stripe keys are live-mode, and no isolated staging environment was established. Read the hosted acceptance packet before any real test. Preserve existing pricing formulas/POD behavior, selected presets and dirty work; never bulk-push pending migrations.

Layout harmony (2026-09-08): shared spacing/fluid typography and measured
desktop-to-compact headers now cover the storefront, account and platform;
admin navigation becomes a vertical compact list below 1200px. Use
`.agent/skills/ui-layout-consistency/SKILL.md` for future UI changes. Local
scope and responsive evidence: `docs/LAYOUT_HARMONY_QA_2026-09-08.md`.
Selected presets and tenant branding remain intact; this work is not deployed.

Remaining-issues follow-up (2026-09-08): Site Design save ordering and Support
workspace scoping are fixed locally; 322 source tests and an isolated runtime
candidate build pass. App TypeScript is reduced from 492 to 423 diagnostics
and is still not clean. See `docs/remaining-issues-2026-09-08/README.md` for the
exact release manifest and proof boundaries. The subsequent Salgsmapper repair
attached the verified one-page 1 mm / 4+0 template to the live product at 16:49
UTC; all 580 prices/options and the old 5 mm template are unchanged. Actual
Designer/export/return checks pass with real backend reads and current local
frontend code. See `docs/remaining-issues-2026-09-08/salgsmapper-fix.md`.
No schema, pricing, Git staging, commit or deployment changes were made.

Latest storefront selection correction (2026-09-08): original picture 1 is
**Refined Familiar** (`print-familiar`), with the blue header and photographic
brochure banner. It replaces the incorrectly recorded Precise Print Grid
default. All five remain selectable in Site Design; other page/order-flow
selections are unchanged. Use `docs/STOREFRONT_DEFAULT_CORRECTION_2026-09-08.md`
and the corrected `output/design-exploration/webprinter-2026-09-07/display-order.json`
instead of the earlier numeric selection notes.

Tenant inheritance follow-up: the standard is resolved in the shared branding
merge for all tenants, replacing the previous localhost/master-only override.
Missing themes and unmarked legacy `classic` inherit picture 1; explicit
presets and tenant custom content/branding survive. See the tenant-inheritance
section of the correction document. This is local source work until deployed.

Last updated: 2026-07-08
Purpose: give future AI/Codex instances immediate context before they edit code.

Start here, then read `HANDOVER.md`, `POD2_README.md` and
`SYSTEM_OVERVIEW.md`.

## One-Minute Summary

Launch planning entry point (added 2026-09-06):
[`docs/LAUNCH_REGISTER.md`](docs/LAUNCH_REGISTER.md) is the compact capability,
evidence and next-action register. It separates local work, deployed behavior
and unverified flows using the 5 September review baseline. Start with L01
(reproducible local setup), then L02 (aluminium checkout-to-designer dimensions).
The proposed early-October assisted pilot is not a confirmed release date.
Keep the broader roadmap and historical go-live log; update the register after
actual verification rather than adding another readiness dashboard.

Webprinter is a multi-tenant SaaS platform for print shops. It has tenant
storefronts, an admin panel, a Site Design V2 visual editor, a product price
calculator/matrix system, a print designer, SEO tooling and a POD v2 Print.com
integration.

Current active direction: make Webprinter commercially ready as a sellable
web-to-print platform. Use the owned tenants (`webprinter.dk`,
`salgsmapper.dk`, and `onlinetryksager.dk`) as proof tenants, and keep Supplier
Bank as a staging/sourcing engine behind the platform, not as the product by
itself.

Parked future direction (recorded 2026-08-25): an AI print-shop operator could
eventually configure a tenant shell through validated conversational actions.
This is not an active implementation task and must wait until the existing
product, pricing, template, designer, checkout, order, payment, and fulfillment
flows are proven. Read `docs/FUTURE_AI_PRINT_SHOP_OPERATOR.md` before proposing
or starting that work.

POD v2 price ownership is explicit: Webprinter privately stores supplier cost,
sets the Webprinter product price offered to tenants, and tenants add their own
customer-facing markup. A fulfillment job's `tenant_cost` is the Webprinter
product price, not the supplier cost. Do not introduce another automatic
wholesale-margin layer during order creation.

The newest work was a large Site Design V2 and storefront polish pass:
- Complete visual theme presets.
- Stronger color and font presets.
- Different advanced button effects per theme.
- Contrast safeguards for buttons and hero CTAs.
- Hero/banner animation controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots for side-panel editing.
- SEO/tenant-shell updates.
- POD v2 admin improvements and Danish Print.com label mapping.

The current branch `ui-cleanup` was committed, pushed and deployed to Vercel
production:
- Commit: `7932644 feat: polish tenant site design controls`
- Live: `https://www.webprinter.dk`

## Architecture Snapshot

Frontend:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Framer Motion
- TanStack Query
- React Router

Backend:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- RLS policies

Deployment:
- Vercel production alias: `https://www.webprinter.dk`

Important multi-tenant behavior:
- Storefront code is shared.
- Tenant-specific branding/SEO/product data is stored in Supabase.
- Code changes deploy globally, but saved tenant settings remain per tenant.
- Localhost often points at the same Supabase data as production.

## Current Priority Areas

### Commercial Readiness Roadmap

North-star plan:
- `docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md`

CEO-level recommendation:
- Prioritize complete tenant order flows over broad supplier scraping.
- Prove one owned tenant can take a real order end to end.
- Prove Salgsmapper as the focused template/sales-folder tenant.
- Keep Supplier Bank imports unpublished until explicit business approval.
- Add read-only admin readiness visibility before adding write automation.

Implemented read-only admin route:
- `/admin/commercial-readiness`
- Sidebar label: `Driftsklarhed`
- Purpose: show tenant pilot status, product/designer/checkout/SEO readiness,
  Supplier Bank gate status, and next safe operational steps. It must remain
  read-only unless a later task explicitly approves write behavior.
- The route now reads live, defensive Supabase signals for tenant existence,
  product counts, published product counts, first product price rows, active
  designer templates, SEO rows, and order counts. Supplier Bank gate numbers
  remain report-derived/read-only.
- It also checks first-product flow health: Matrix vs STORFORMAT price rows,
  product template/designer-launch readiness, and approximate order traces for
  the selected proof product. These checks are observational only.
- It now surfaces prioritized `Flow-blokeringer og QA` issues with direct admin
  links, while remaining read-only.
- It also includes `Bevisflow pr. tenant`: five read-only proof steps per owned
  tenant with tenant-safe admin links for product/domain, price preview,
  designer/template, checkout/order, and SEO visibility.
- It now includes `Automatiseret browserbevis` under the tenant proof flow.
  The cockpit points operators to `npm run check:commercial-proof`, which first
  checks commercial-readiness binding/script drift and then runs the Playwright
  proof smoke for Webprinter Aluminium order/upload, Banner Builder Pro
  site-package preview, Salgsmapper category landing, Salgsmapper PDF
  template/designer handoff, Onlinetryksager category landing, and
  Onlinetryksager Flyers order/upload. The gate
  retries once after the app's short Supabase transport cooldown when a route
  returns the known temporary Supabase pause message, but it still fails real
  route/content/template/order errors.
  is read-only: it does not write products, prices, orders, SEO, POD or
  Supplier Bank data. `npm run check:commercial-proof:write` runs the same gate
  and writes the local evidence artifact `docs/COMMERCIAL_PROOF_LATEST.md`.
  `npm run check:commercial-proof-report` verifies that local report without
  rerunning the browser smoke. `npm run check:commercial-release` is the local
  pre-demo/pre-deploy gate: it writes the proof report, verifies it, and runs
  the Vite production build. It also writes the compact release summary
  `docs/COMMERCIAL_RELEASE_LATEST.md`. `npm run check:commercial-release-report`
  verifies that summary artifact. The release summary also includes a read-only
  `git status --short --branch` snapshot so a dirty local worktree is visible
  in the proof trail instead of being mistaken for a clean release candidate.
  `npm run check:commercial-changeset`, `npm run check:commercial-changeset:write`
  and `npm run check:commercial-changeset-report` generate/verify
  `docs/COMMERCIAL_CHANGESET_LATEST.md`, a review-bucket summary of the current
  dirty worktree for release prep with suggested review order and
  bucket-specific verification commands. It also calls out the first
  commercial proof-chain review packet with exact candidate files and hold
  reasons for the other buckets, plus read-only staging, staged-file validation
  and rollback command previews. `npm run check:commercial-application-source:write`
  writes/verifies `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md`, the second
  runtime review packet. It groups app-source changes by pricing/product,
  designer/PDF/template, tenant storefront/SEO/design, admin, checkout/account
  and build/config risk, and `npm run check:commercial-application-source-report`
  verifies that report without writing products, prices, orders, SEO, POD or
  Supplier Bank data. `npm run check:commercial-supabase:write` writes/verifies
  `docs/COMMERCIAL_SUPABASE_LATEST.md`, the Supabase review packet. It runs the
  existing grant/function exposure checks, lists migrations, Edge Functions,
  temp/config duplicates and local Supabase artifacts separately, and
  `npm run check:commercial-supabase-report` verifies the report without
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
  over the whole commercial release packet. It remains read-only.
- It now includes `Klar-til-demo beviser`, a read-only acceptance/evidence layer
  showing which tenant proof points are actually proven and which are still
  missing before a tenant can be demoed commercially.
- It now includes `Ledelsesblik: næste handling`, which derives one read-only
  next best action per tenant from the current evidence gaps.
- It now includes `Trykkeri-demo gate`, a read-only platform-level gate summary
  for print-house demo readiness across tenant proof, evidence, orders, SEO,
  Supplier Bank risk, and sales/demo package.
- It now includes `Demo-køreplan for trykkeri`, a read-only sales/demo sequence
  that turns the cockpit into a guided print-house presentation.
- It now includes `Første pilotordre-plan`, a read-only operating checklist for
  proving one controlled Webprinter order before using the system in sales.
- It now includes `Trykkeri-salgspakke`, a read-only CEO/sales readiness layer
  for demo script, pilot-order proof, tenant showcase, onboarding, offer model,
  and risk boundaries.
- It now includes `Go/no-go launch board`, a read-only CEO view of what can be
  demoed, what is pilot-only, and what must not be promised yet.
- It now includes `Commercial ready scorecard`, a read-only scorecard mapped
  directly to the roadmap's definition of commercial ready for a first
  print-house conversation: end-to-end owned-tenant order, second tenant
  niche/template proof, traceable pricing/designer state, admin order handling,
  order/file readiness, payment/checkout clarity, customer dialogue visibility,
  mail/notification readiness, delivery/fulfillment readiness, legal/cookie/contact
  readiness, platform contact/lead readiness, SEO/analytics visibility, Supplier
  Bank staging safety, and simple business pitch language.
  It only aggregates existing cockpit evidence and links to the relevant admin
  areas.
- It now includes `Salgsmæssig bevismappe`, a read-only binder that maps each
  possible sales claim to current proof, missing gaps, and the relevant admin
  evidence link.
- It now has a compact cockpit jump bar with anchors to the key commercial
  sections, so operators can move directly between launch, proof, demo,
  pilot-order, sales, decisions, blockers, and tenant evidence.
- It now includes `SEO/Search Console bevis`, a read-only visibility layer for
  the three owned domains. It reuses the existing Platform SEO Search Console
  hooks and shows SEO row count, verified Search Console site state, 28-day
  clicks, impressions, CTR, and average position when connected. It does not
  connect Google, write SEO rows, or change Search Console data.
- It now includes `Første trykkeripilot: tilbudsmodel`, a read-only offer
  framing layer for the first print-house conversation. It lists package lines
  for branded tenant/storefront, first product package, designer/upload/PDF,
  checkout/order intake, SEO reporting, Supplier Bank staging, support/onboarding,
  and commercial price frame. It shows current proof and the CEO/business
  decision still needed, but does not set prices or change products/orders.
- It now includes `30-dages eksekveringsplan`, a read-only operator checklist
  mapped to the roadmap's 30-day plan: owned-tenant pilot paths, manual
  `admin@webprinter.dk` access verification, Webprinter flagship E2E flow,
  Salgsmapper template proof, price-preview warning visibility, WMD duplicate
  decision, Supplier Bank report visibility, and SEO/Search Console read-only
  connection. Product admin `Produkt & Priser` now has a read-only
  `Pris-preview status` card that counts Matrix rows, warns at `0` rows,
  summarizes very large Matrix imports, and labels STORFORMAT/MPA as separate
  pricing paths. Product overview also shows read-only price-health badges per
  product plus a Matrix OK / missing Matrix prices / special pricing summary.
  The summary chips are filter buttons, so operators can isolate missing
  Matrix-price products without opening each card. Publishing a Matrix product
  with `0` price rows now asks for explicit confirmation before saving, and the
  product `Klar` marker uses the same warning-only confirmation. Master-tenant
  release/send-to-tenant actions now reuse the same read-only price-health signal
  and warn before distributing a Matrix product with `0` price rows.
  Product overview also shows a read-only storefront category-readiness strip
  with forside-knapper, hovedkategorier, underkategorier, empty category
  warnings, invalid front-card warnings and submenu-without-children warnings.
  Storefront category cards fall back to the first usable product in the
  category if the selected front-card product is missing or unpublished.
  It links to existing admin areas and does not run login tests, imports,
  publishing, price changes, or SEO writes.
- It now includes `Pilot-gennemgang`, a read-only manual rehearsal checklist for
  the proof paths that must be witnessed before an external print-house
  conversation: Webprinter product/price, designer or upload handoff, order into
  admin, Salgsmapper template/download/designer proof, Onlinetryksager first
  product choice, SEO/Search Console visibility, Supplier Bank staging boundary,
  and `admin@webprinter.dk` access.
- It now includes `Bevisfangst for generalprøve`, a read-only checklist derived
  from the same pilot proof items. It tells the operator what to capture, what
  counts as accepted, and which stop rule keeps a point out of an external
  trykkeridemo. It does not write notes, files, prices, products, ordrestatus,
  SEO data or Supplier Bank state.
- It now includes `Pilotdrift runbook`, a read-only operating checklist for
  handling the first controlled order in admin: customer/order data, product and
  price basis, design/upload/PDF check, payment decision, production owner,
  proof/customer communication, delivery/closeout, and what may be saved as
  sales evidence. It does not change order statuses, payments, files, prices,
  products or publishing.
- It now includes `Ordredrift signaler`, a read-only tenant-level order
  operations summary. It reads existing `orders` and current `order_files` rows
  to show total orders, file-ready orders, problem/reupload pressure, and
  missing/customer-file pressure for each owned tenant. It does not create
  orders, move status, change files, or mutate pricing/products.
- It now includes `Betaling/checkout signaler`, a read-only tenant-level payment
  readiness summary. It reads existing `tenant_payment_settings` to show whether
  Stripe is live-ready, under setup, or whether a pilot order should stay as
  test/manual payment. It does not invoke Stripe, create accounts, change fees,
  or start payments.
- It now includes `Kundeservice signaler`, a read-only tenant-level
  customer/support summary. It reads existing `order_messages` and
  `platform_messages` to show order-message volume, platform support-message
  volume, unread customer/tenant messages, and latest visible message per owned
  tenant. It does not send messages, mark messages as read, or mutate support
  threads.
- It now includes `Mail/notifikationer signaler`, a read-only tenant-level
  notification readiness summary. It reads existing `tenants.settings` and
  `tenant_notifications` to show customer order-confirmation state, admin
  new-order mail state, tenant company email, unread internal notifications and
  whether admin order mails would be skipped because the company email is
  missing or invalid. It does not send emails, update settings or mark
  notifications as read.
- It now includes `Levering/fulfillment signaler`, a read-only tenant-level
  delivery and fulfillment summary. It reads product `order_delivery`, existing
  order `delivery_type`/tracking values, `delivery_tracking` counts and
  `tenant_pod_shipping_profile` sender readiness. It does not change delivery
  methods, tracking, POD sender identity, order status, pricing or product
  setup.
- It now includes `Jura/cookie signaler`, a read-only tenant-level legal and
  consent summary. It reads existing `tenants.settings.company` and compares it
  with the existing public routes `/kontakt`, `/privatliv`, `/cookiepolitik`
  and `/betingelser`, the contact form's privacy-policy consent link, plus the
  current cookie banner/settings flow. It surfaces missing company email and
  missing CVR/address, while the cookie settings dialog now routes tenant terms
  to `/betingelser` and platform terms to `/handelsbetingelser` without losing
  localhost `force_domain` context. The tenant contact form also links its
  consent text to `/privatliv` with the same domain context, and the default
  tenant footer terms link now uses `/betingelser`. These links reuse the
  existing storefront tenant-context helper. The platform contact form also
  requires the same privacy-policy consent before a platform lead message can be
  submitted. It does not change cookies, tracking, legal text or tenant
  settings.
- It now includes `Platform henvendelser`, a read-only platform lead-readiness
  layer for the Webprinter sales site. It shows that the public platform contact
  form has required contact fields and privacy consent, that the privacy link
  preserves `webprinter.dk` context on localhost, and that successful platform
  contact messages use the existing `send-contact-message`/Resend mail handoff
  while also being logged as unread master messages in `platform_messages` with
  a `[PLATFORM LEAD]` prefix. Admin `Beskeder` labels that master thread as
  `Platform henvendelser` when lead messages exist, and shows that thread as a
  read-only log so operators do not mistake an internal note for an external
  e-mail svar. Cockpittet læser nu også de samme masterbeskeder som en
  read-only leadtæller med samlet antal, ulæste henvendelser og seneste
  tidspunkt.
  Admin `Beskeder` viser nu også et lille operatørkort i den tråd:
  samlet antal platformhenvendelser, ulæste henvendelser, nyeste kundeemne,
  beskedpreview og en sikker `mailto:`-overdragelse til svar uden for den
  interne log. Cockpittets opfølgningslink åbner direkte samme mastertråd via
  `tenantId=00000000-0000-0000-0000-000000000000`. Den mastertråd bliver ikke
  auto-markeret som læst ved åbning, så ulæste platformhenvendelser forbliver
  synlige indtil et senere eksplicit leadflow håndterer dem. Admin header og
  sidebar tæller platformhenvendelser separat; hvis de er de eneste ulæste
  beskeder, åbner beskedikonet direkte samme mastertråd.
  Mail-overdragelsen forbliver QA indtil en kontrolleret indbakke/admin-test
  er bevidnet.
  Det opretter ikke en ny CRM-tabel, sender ikke testmails, ændrer ikke
  tracking, produkter, priser, ordrer eller Supplier Bank.
- It now includes `Adgangsberedskab for adminmail`, a read-only manual access
  checklist for `admin@webprinter.dk` across dashboard, products, product price,
  Salgsmapper templates, orders/customers, Platform SEO, Supplier Bank,
  tenant/domain context, payment, modules and settings. It does not change auth,
  roles, sessions or permissions.
- It now includes `Prioriteret handlingskø`, a read-only top operator queue
  that ranks the next actions across critical path, pilot proof, pilotdrift,
  admin access, go/no-go and 30-day plan, so the cockpit starts with what to do
  next instead of only showing separate evidence sections.
- It now includes `Trykkerimødepakke`, a read-only meeting-prep layer for the
  first print-house conversation: meeting purpose, what may be shown, which
  proof points may be mentioned, what must not be promised, the commercial
  question to ask, and the next follow-up. It does not create offers, prices,
  emails, products or supplier changes.
- It now includes `Måleksekvering`, a read-only top execution layer that turns
  the active commercial goal into six trackable phases: cockpit ownership,
  owned-tenant proof, pilot proof/drift, adminmail access, first print-house
  meeting readiness, and visible sales evidence. It links back to existing
  evidence only and does not mutate prices, products, orders, auth, SEO, POD or
  Supplier Bank. The same section now includes `Automatisering og menneskelig
  bevisførelse`, which separates what Codex/system work can continue safely,
  what requires manual browser/admin QA, and what requires CEO/business decision.
  It is derived from existing cockpit evidence and remains read-only. The top of
  the cockpit now also includes `Næste sikre handling`, a three-lane focus strip
  for the next safe system step, next manual proof step, and first live-blocking
  business decision. `Browserrute til generalprøve` now compresses the existing
  pilot-proof cards into a numbered manual route with tenant-safe links for the
  internal rehearsal before an external print-house conversation. `Bevisfangst
  for generalprøve` sits beside that route and defines capture, acceptance and
  stop rules for each step.
- It now includes `Ekstern demo-grænse`, a read-only safety boundary for the
  first print-house conversation. It separates what may be shown externally,
  what is pilot-only, and what must stay internal, including Supplier Bank,
  SEO, payment and delivery promises. It does not change demo content,
  products, prices, payment, SEO or Supplier Bank.
- It now includes `Pilotaccept for trykkerikunde`, a read-only internal go/no-go
  gate before a real print-house pilot. It combines the commercial-ready
  scorecard, external demo boundary, pilotdrift, adminmail access, offer model,
  and CEO decision queue. It does not create customers, offers, prices,
  payments, products or order changes.
- It now includes `Pilotansvarskort`, a read-only responsibility map for the
  first print-house pilot: CEO go/no-go, product package, operations, file/PDF
  control, admin access, SEO/reporting, Supplier Bank boundaries, economy,
  support and demo ownership. It does not assign roles, change permissions or
  mutate live data.
- It now includes `Pilotscope aftalegrundlag`, a read-only scope frame for the
  first print-house pilot. It lists what is included, what is excluded, and
  which business decision is still needed for tenant/branding, product package,
  designer/upload/PDF, checkout/order, SEO, Supplier Bank, support, price frame
  and pilot go/no-go. It does not create offers, prices or customer records.
- It now includes `Pilotonboarding plan`, a read-only sequence for what happens
  after a print house says yes to a pilot: internal accept, tenant/domain/brand,
  first product package, templates/upload, order/admin test, adminmail access,
  SEO/reporting, Supplier Bank boundaries, economy/support and internal
  rehearsal. It does not create tenants, products, customers, offers, roles or
  prices.
- It now includes `Pilotsucces og exitkriterier`, a read-only measurement layer
  for the first print-house pilot. It defines when the pilot can continue, when
  it should be paused, and when it can be converted to a paid first package,
  based only on existing cockpit evidence. It does not create customers, offers,
  products, prices, orders, roles, SEO rows or Supplier Bank changes.
- It now includes `Trykkeripilot handoff`, a read-only bridge from pilot proof
  to first print-house conversation. It summarizes what may be shown, the
  concrete pilot scope, CEO go/no-go, customer input after a yes, what must not
  be promised yet, and how pilot success will be judged. It does not create
  offers, customers, prices, products, order status changes or supplier
  publishing.
- It now includes `Trykkeripilot Q&A`, a read-only answer layer for the first
  print-house meeting. It answers likely questions about what can be shown,
  pilot scope, supplier/pricing automation, orders/files, payment/support,
  customer input, success criteria, go-live and next commercial decision. Each
  answer links to proof and a boundary so the conversation does not become a
  feature promise. It does not create offers, customers, prices, products,
  order status, SEO data or Supplier Bank publishing.
- It now includes `Første mødebrief`, a read-only five-step live meeting brief:
  open calmly, show only the short demo, ask the commercial pilot question,
  repeat the non-promises, and end with the next action. It is derived from the
  meeting pack, Q&A, handoff and priority queue, and does not create offers,
  emails, customers, prices, products, order status or supplier publishing.
- It now includes `Eftermøde opfølgning`, a read-only post-meeting draft layer
  that turns the meeting brief and Q&A into recap, pilot proposal, customer
  input request, non-promises and internal next action. It does not send emails,
  create leads/offers/customers, change prices/products/order status, or
  publish Supplier Bank data.
- It now includes `Pilottilbud kladde`, a read-only first-offer preparation
  layer that converts follow-up, offer model, scope, pilotaccept and priority
  queue into offer sections without amounts: purpose, delivery package, customer
  input, attachable proof, non-promises, internal approval and support form. It
  does not send mail, create leads/offers/customers, set prices, mutate
  products/orders or publish Supplier Bank data.
- It now includes `Pilotaftale tjekliste`, a read-only agreement-readiness
  layer after the offer draft. It checks pilot purpose, scope, customer input,
  economy decision, responsibility/support, success/exit criteria and
  non-promises before any draft becomes a real customer agreement. It does not
  create contracts, customers, offers, prices, orders, emails, product changes
  or Supplier Bank publishing.
- It now includes `Pilotstart plan`, a read-only first-days plan after a
  print-house yes: internal accept, customer kickoff input, adminmail/access
  check, product/design path, first manual order, evidence packet and week-1
  decision. It does not create tenants, products, prices, orders, roles,
  emails, contracts or Supplier Bank writes.
- It now includes `Pilot uge-1 rapport`, a read-only internal status view for
  the first pilot week. It summarizes start-plan progress, first order/file
  readiness, payment, support/mail pressure, delivery, SEO visibility and the
  continue/pause/convert decision from existing cockpit evidence. It does not
  create report files, customers, offers, prices, orders, emails, product
  changes or Supplier Bank writes.
- It now includes `Konverteringsklar pilot`, a read-only conversion gate after
  the first pilot week. It checks whether week-1 proof, agreement basis, offer
  boundaries, success criteria, economy/support decisions and Supplier Bank
  limitations are clear enough before a pilot becomes a paid first package. It
  does not create offers, contracts, customers, prices, products, orders, mails
  or Supplier Bank writes.
- It now includes `Betalt pilotpakke`, a read-only package worksheet after the
  conversion gate. It summarizes what a first print-house customer can buy
  after pilot proof: scope, non-promises, price/payment decisions,
  order/delivery, support/legal responsibility and next phase. It does not
  create offers, contracts, customers, prices, products, orders, mails,
  payment settings or Supplier Bank writes.
- It now includes `Første kundes onboarding`, a read-only setup board after the
  paid package. It lists customer input and internal checks for agreement
  boundary, tenant/brand, products/pricing responsibility, templates/file flow,
  order/payment/delivery, admin access, reporting/sourcing and internal
  rehearsal. It does not create tenants, customers, products, prices, orders,
  roles, mails, payments or Supplier Bank writes.
- It now includes `Setup-arbejdsordre`, a read-only internal setup work order
  after first-customer onboarding. It turns the customer input into setup tasks
  for package boundary, tenant/brand, products, templates, order path, admin
  access, reporting/sourcing and final rehearsal. It does not create tenants,
  customers, products, prices, orders, roles, mails, payments or Supplier Bank
  writes.
- It now includes `Kundekickoff agenda`, a read-only first-customer meeting
  agenda after the setup work order. It turns setup tasks into meeting points
  for pilot boundary, tenant/brand, products/pricing responsibility, files,
  order/payment/delivery, support/access, reporting/sourcing and next action.
  It does not send mails or create customers, offers, products, prices, orders,
  payments or Supplier Bank writes.
- It now includes `Kickoff opfølgning`, a read-only post-kickoff follow-up
  layer. It turns the customer kickoff agenda into recap, customer material
  request, product/pricing clarification, order/responsibility follow-up,
  reporting/sourcing boundary and next internal action. It does not send mails
  or create customers, offers, products, prices, orders, payments or Supplier
  Bank writes.
- It now includes `Kundemateriale checkpoint`, a read-only manual material gate
  after kickoff follow-up. It lists the customer material and decisions that
  must be manually confirmed before setup continues: brand, products/pricing
  responsibility, templates/files, order/payment/delivery, support/access,
  reporting/sourcing and next internal action. It does not fetch attachments,
  send mails or create customers, products, prices, orders, payments or
  Supplier Bank writes.
- It now includes `Frigivelse til produktion`, a read-only release-readiness
  gate before a push/deploy is treated as safe. It separates production build,
  localhost smoke checks, tenant proof, adminmail access, price/POD/Supplier
  Bank boundaries, deploy owner, rollback note and after-deploy tenant smoke
  checks. It does not create branches, commits, deployments, prices, products,
  orders, POD data or Supplier Bank writes.
- It now includes `Releasebevis og accept`, a read-only proof-capture layer for
  the release gate. It states what to capture for build/localhost, tenant flow,
  adminmail, data boundaries, deploy/rollback and live smoke tests, plus what
  counts as accepted and when to stop. It does not save files, write notes,
  create commits, deploy, or mutate orders, prices, products or Supplier Bank
  data.
- It now has a read-only commercial smoke command:
  `npm run smoke:commercial-readiness`. By default it checks
  `https://www.webprinter.dk`; pass
  `-- --base-url http://127.0.0.1:8083` for localhost. It verifies the owned
  tenant proof routes, the Salgsmapper PDF template, admin cockpit routes, and
  shipped bundle markers for `Download skabelon`, `Produktionsklarhed`,
  `templatePdfUrl`, and `sales-mapper`. It does not create orders, write
  products, touch prices, scrape suppliers, or call Supabase write paths.
  `npm run smoke:commercial-readiness:browser` adds Playwright-rendered checks
  for the same commercial proof surface and fails if a page renders the Danish
  temporary error screen. This caught and fixed the `/produkt/aluminium`
  first-load crash where `ProductPricePanel` compared two missing template URLs
  as equal and then read `templateDownloadedAt` from a null checkout session.
  The browser smoke now also clicks `Design online` from `/produkt/aluminium`
  and from the first Salgsmapper template product, then verifies `/designer`
  receives `order=1`, product context, return path, checkout session state, and
  for Salgsmapper the correct `templatePdfUrl`. This proves product-to-designer
  handoff without creating orders or writing database state. It also verifies
  the Salgsmapper `Download skabelon` link on the product page, including the
  expected PDF path, Danish download filename, `application/pdf` response and
  `%PDF` file header. It also clicks `Bestil nu` from the same two product pages
  and verifies
  `/checkout/konfigurer` receives the current product, selected format,
  quantity, price totals, tenant context, and Salgsmapper template PDF context
  in session storage. It now also verifies that checkout shows the `Fil Upload`
  panel for both products, exposes an input accepting PDF/JPG/JPEG/PNG/TIFF,
  keeps `siteUpload` empty before any file is chosen, and keeps payment disabled
  before upload/customer details. That upload check deliberately does not select
  a real file, because doing so would write to storage; all checkout checks stop
  before upload, payment or order creation. The browser smoke also installs a
  synthetic in-session upload for both products, approves it in the UI, clicks
  `Gå til betaling`, and verifies the Danish customer/delivery validation
  blocks payment before any Stripe payment intent, order-file storage write or
  order insert request is sent. With valid smoke customer and delivery details,
  the same browser smoke intercepts `stripe-create-payment-intent` before it
  reaches Supabase and verifies the outgoing tenant id, amount, quote
  productId/slug/quantity, upload path, standard delivery metadata,
  blind-shipping boundary, customer metadata and Salgsmapper variant labels.
  The stubbed response intentionally returns no Stripe secret, so no real
  payment form, payment intent, storage write or order insert can be created.
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
- It now includes `Supplier Bank staging-runbook`, a read-only operating
  sequence for supplier-bank products: external source only, report candidate,
  explicit approval, draft import, price-row QA, separate publishing decision
  and tenant handoff. It derives blocker state from the existing Supplier Bank
  decisions and does not scrape, import, publish or mutate live prices,
  products, POD data or Supplier Bank data.
- It now includes `Beslutningsvalgkort`, a read-only CEO decision helper for
  the open sales blockers. It turns each current decision into recommended
  handling, alternatives, cost of waiting and a decision rule, without choosing
  for the owner or mutating products, prices, payments, Supplier Bank, SEO or
  tenants.
- It now includes `Kritisk sti til første trykkerisamtale`, a read-only six-step
  summary of the smallest proof chain needed before approaching a print house.
- It now includes `Pilottrykkeri intake`, a read-only checklist for the
  information needed from a future print-house customer before onboarding:
  tenant/domain, brand, first products, pricing responsibility, templates,
  checkout/payment/order handoff, SEO/reporting, and sourcing boundaries.
- It now includes `Beslutningskø før salg`, a read-only queue of CEO/product
  decisions that must be made before the platform is presented as commercially
  ready.
- Local build note: ignored `dist` output had stale generated preview files
  that caused Vite cleanup errors. `vite.config.ts` now cleans the build output
  with a build-only pre-plugin and disables Vite's fragile `emptyOutDir` step,
  so Vite can build cleanly.
- Codex desktop shell note: global `npm` may be unavailable, and bundled
  `pnpm run build` can stop on pnpm's ignored-builds approval gate. In that
  environment, use the bundled Node runtime directly:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.

Key related plans:
- `docs/GOLDEN_PRODUCT_FLOW_PLAN_2026-06-28.md`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`
- `docs/API_ROLLOUT_PLAN.md`

### System Review Recommendations

Latest non-destructive review:
- `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`

Main recommendation:
- Harden service-role Edge Functions, Stripe amount calculation, admin role
  verification, and PDF-service input ownership before adding more large
  product surfaces.
- Clean duplicate/conflict artifacts only on a dedicated cleanup branch.

### Site Design V2

Main goal: admins should click storefront areas in preview and edit those areas
in the side panel.

Recent work:
- Added/expanded visual presets in `SiteDesignEditorV2.tsx`.
- Added theme-wide button surface controls and motion parameters.
- Added option/matrix box controls and hotspots.
- Connected price panel Download Tilbud styling target.
- Added page transitions and dropdown motion presets.
- Added ten versioned shopdesigns as a presentation layer separate from themes.
  They now resolve complete component recipes for header, product dropdown,
  category navigation, catalogue, product cards, product page, checkout,
  footer and motion without changing products, pricing, content or brand
  colours. Five product-menu patterns can be selected independently.
  See `docs/SHOP_TEMPLATE_SYSTEM_2026-07-27.md`.
- Site Design V2 preview can now open exact product pages, product overview,
  checkout and homepage from one selector. Its product-menu button exposes the
  real storefront dropdown/submenu, and desktop preview renders at a fixed
  1280 x 800 viewport before scaling into the editor. Preview URL
  normalization prevents tenant query parameters from becoming part of a
  product slug. The collapsed editor control now lives in the action bar as a
  pencil button instead of a floating expansion arrow.
- Preview navigation and click editing are explicitly separated. Legacy
  product-option selection messages are ignored unless click editing is
  active, so ordering controls work normally in navigation mode. The preview
  toolbar uses a crosshair control labelled `Redigér` / `Redigering aktiv` to
  make the active editing state unambiguous.

Key files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/hooks/useBrandingDraft.ts`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/admin/ProduktvalgknapperSection.tsx`

### Storefront Header, Dropdowns and Hero

Recent work:
- Header dropdown presets and motion.
- Split-preview dropdown can use current campaign/framed product.
- Removed unnecessary image frames around PNG product images.
- Stabilized dropdown product hover so it zooms smoothly without lateral shift.
- Hero banner gained text animations, slide transitions and parallax controls.
- Hero buttons now protect against unreadable text and support `rgba(...)`.

Key files:
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/admin/HeaderSection.tsx`
- `src/components/admin/BannerEditor.tsx`

### Product Price Page

Recent work:
- Dynamic option buttons now have richer hover/selected styling.
- Matrix option buttons and white-format option buttons share more styling
  logic.
- Product grid CTAs and order buttons use theme-specific surfaces.
- Download Tilbud is style-targetable.
- Contrast helpers prevent unreadable text on theme-generated buttons.
- When a product/format resolves to a template PDF launch, the price/action
  panel now shows `Download skabelon` beside `Design online`. It uses the same
  product template resolution as the designer launch and does not write
  checkout, pricing, product or order data.
- The checkout session now remembers the resolved template PDF name/url and
  whether the customer clicked `Download skabelon`. Design-ready signatures
  include template context, so a stale design is invalidated if the product
  template changes.

Key files:
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/lib/checkout/siteCheckoutSession.ts`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/product-price-page/StorformatConfigurator.tsx`
- `src/components/ProductGrid.tsx`
- `src/lib/pricing/selectorStyling.ts`

### Checkout And Order Traceability

Recent work:
- Checkout writes `[PRODUKTIONSFLOW]`, `[SKABELON]` and
  `[SKABELON-DOWNLOAD]` lines into `status_note` when an order is created, so
  admin can see whether the order came from designer export, customer upload,
  or external design via downloaded template.
- `Kunder & Ordrer` displays these production/template tags in the order list
  as a compact flow badge with a flow filter, in the order detail product card,
  and in `order_files.notes`, including whether the attached file came from
  designer export or customer upload.
- `Kunder & Ordrer` also reads current `order_files` rows to show a read-only
  `Klarhed` badge/filter and `Fil klar` count, so operators can separate orders
  with production files from orders that are waiting for customer files, require
  reupload, have problems, or still need manual control.
- Order detail now includes a read-only `Produktionsklarhed` panel with flow,
  readiness, current/all file counts, and the next recommended handling step.
- When an operator selects `Under produktion`, the status form shows a
  warning-only readiness guardrail if the order still has a problem, needs a
  reupload, lacks a current production file, waits for customer file, is closed,
  or needs manual control. It does not block saving or mutate workflow state.
- The commercial readiness cockpit mirrors this at tenant level in
  `Ordredrift signaler`, so pilot/demo review can see order/file readiness
  pressure without opening every order.
- `Commercial ready scorecard` now includes `Ordredrift og filklarhed er
  synlig`, so file-ready/order-pressure signals affect the CEO-level readiness
  count.
- `Commercial ready scorecard` also includes `Betaling/checkout pilot er
  afklaret`, so payment-mode clarity affects the CEO-level readiness count.
- `Commercial ready scorecard` also includes `Kundeservice og dialog er
  synlig`, so customer/order and tenant-support message readiness affects the
  CEO-level readiness count.
- `Commercial ready scorecard` also includes `Mail og notifikationer er
  afklaret`, so order confirmation/admin-mail readiness affects the CEO-level
  readiness count.
- `Commercial ready scorecard` also includes `Levering og fulfillment er
  synlig`, so delivery methods, tracking and POD sender readiness affect the
  CEO-level readiness count.
- `Commercial ready scorecard` also includes `Jura, cookie og kontakt er
  synlig`, so public company identity, contact email, cookie consent and
  tenant legal-route QA affect the CEO-level readiness count.
- `Commercial ready scorecard` also includes `Platformhenvendelser kan modtages
  og følges op`, so the platform's public contact/lead path is visible before a
  print-house sales conversation.

Key files:
- `src/pages/FileUploadConfiguration.tsx`
- `src/components/admin/OrderManager.tsx`
- `src/lib/checkout/siteCheckoutSession.ts`

### SEO and Tenant Shell

Recent work:
- Storefront SEO metadata path was adjusted for tenant shops.
- Migration added for public page SEO metadata reads.
- Tenant shell was adjusted as part of making SEO visible on tenant storefronts.

Key files:
- `api/tenant-shell.ts`
- `src/components/SEO.tsx`
- `src/components/storefront/StorefrontSeo.tsx`
- `supabase/migrations/20260427130500_public_read_page_seo_metadata.sql`

### PDF Designer + Service Foundation

Recent work:
- Added vector-preserved PDF editing in the designer: rotate, crop, stamp,
  signature, text color, multipage switching, selected-PDF replacement, and
  reopen/edit selected PDF.
- Added `PdfToolsPanel` for selected PDF backgrounds with PDF metadata,
  page controls, CutContour handoff, vector export handoff, PDF-service scan,
  and a compact design-product-flow checklist.
- Added generic PDF-service foundation separate from POD v2:
  `src/lib/designer/pdfService.ts` and
  `supabase/functions/designer-pdf-service/index.ts`.
- Playwright Chromium smoke test passed for import, edit, replace, service
  scan, and vector export dialog with no console errors.

Remaining expansion:
- Deploy `designer-pdf-service` before relying on the edge runtime.
- Wire in a real external PDF processor for OCR, compression, repair, PDF/A,
  true redaction, and form flattening. These are capability placeholders now.
- Add save/load/export regression automation for edited PDF backgrounds.
- Keep Stirling-PDF as inspiration unless legal/deployment/privacy review
  approves direct production reuse.

Key files:
- `src/components/designer/PDFImportModal.tsx`
- `src/components/designer/PdfToolsPanel.tsx`
- `src/lib/designer/pdfService.ts`
- `src/pages/Designer.tsx`
- `supabase/functions/designer-pdf-service/index.ts`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`

### Supplier Product Bank

Planned additive architecture:
- `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`
- `.agents/skills/supplier-product-bank/SKILL.md`

Purpose:
- Create a backend/admin bank of supplier print-house products and prices.
- Scrape/API-fetch supplier data into snapshots and normalized bank records.
- Let admins review, translate to Danish, categorize, and approve products.
- Import into existing Webprinter product/pricing structures only by explicit
  admin action.

Safety:
- This is not POD v1 and not POD v2.
- Do not reuse POD tables.
- Do not push scraped prices directly into live storefront products.
- Do not change core pricing logic.
- Reuse Matrix Layout V1, storformat, product attribute, and generic price
  publisher patterns only after bank review/dry-run approval.
- Salgsmapper/Sales Maba is internal and must not be used as an external
  supplier source.
- External supplier candidates must be listed in
  `config/supplier-bank/sources.json` and pass
  `scripts/supplier-bank-cli.mjs validate-supplier-sources` before new scraping
  work begins.

Recent status:
- 2026-08-16: Scrapling `0.4.8` is integrated as a guarded, read-only hybrid
  extraction engine. The persistent runtime lives under
  `$CODEX_HOME/tools/webprinter-scrapling/0.4.8`; repository entry points are
  `scripts/product-import/scrapling/run.sh` and
  `scripts/product-import/scrapling/extract.py`. The generic local chain is
  Playwright -> Scrapling HTTP -> basic static HTML -> Firecrawl. Existing
  WIRmachenDRUCK Playwright/API adapters remain authoritative for dynamic
  prices. Scrapling captures robots status, redirects, metadata, same-host
  links/images/PDFs, response size, and a source hash, and has no bank, product,
  pricing, or publishing write capability. The DIN Lang category live check
  found the same 8 product links; all 17 product-import tests and the production
  build passed.
- Supabase project `ziattmsmiirfweiuunfo` is linked. Do not run broad
  `supabase db push` for supplier-bank work while migration history drift
  remains; use the single-file migration/repair path documented in
  `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`.
- Supplier-bank migrations, master-admin RLS/grants, source registry, Edge
  Functions, CLI runbook, and `/admin/supplier-bank` browser are in place.
- Supplier registry is seeded for WIRmachenDRUCK, Pixartprinting, and
  Print.com. Webprinter, Sales Maba/Salgsmapper, Onlinetryksager, and localhost
  remain internal exclusions, not external suppliers.
- WIRmachenDRUCK full folder bank is stored, refreshed, review-accepted, and
  imported as an unpublished Matrix Layout draft `wmd-folder-bank-20260703`
  with 18,800 price rows.
- Print.com has six approved bank slices imported as unpublished Matrix Layout
  drafts: flyers, business cards, presentation folders, letterheads,
  business-card boxes, and `t-shirt-basic-7`. The t-shirt import preserves the
  locked `Stoerrelsesfordeling` metadata and quantity-match rule.
- Pixart flat-surface adhesive is approved in the bank and imported through the
  STORFORMAT path as unpublished draft
  `pixart-flat-surface-adhesive-storformat-draft`.
- Pixart rigids/signs is still a decision gate: stored bank snapshot is the
  older Plastic-only baseline, while a local Plastic+Plexiglass candidate is
  prepared at
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`.
  Candidate packet/preflight reports are ready, but no bank write should happen
  without explicit approval.
- Coverage is currently 9/14 registered supplier families. Missing registered
  families are Pixart `banners`, `labels`, `posters`, `rollups`, and Print.com
  `other`.
- Print.com `other` now has fresh local/no-write scoping evidence from
  2026-07-03 13:17 local time: broad catalog discovery listed 856 Print.com
  products, kept 80 `other` candidates, fetched details for 12, and wrote local
  raw/normalized previews at
  `pricing_raw/supplier-bank-raw/print-com/other/20260703-131707.json` and
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-131707.json`.
  The refreshed placemats named-policy price preview passed 4/4 DKK rows,
  quantities 10/25/50/100, DKK range `271.23-368.85`, and wrote
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-131715.json`.
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md` marks it ready
  for explicit bank-only write approval only; no supplier-bank rows, POD v2
  rows, products, publishing state, or live prices were written.
- Pixart missing-family readiness was refreshed at 2026-07-03 13:19 local
  time. The read-only URL candidate report/checklist still shows 7 Pixart URL
  candidates, all `official_candidate_needs_confirmation`, with 0 confirmed
  exact URLs. The adapter/readiness reports still show 4/4 missing Pixart
  families blocked before probe (`posters`, `banners`, `rollups`, `labels`),
  0 extractor-supported profiles, 0 supplier-bank normalizer-supported
  profiles, and 0 confirmed exact URL candidates. Latest files:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`,
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`,
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`, and
  `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`. No Pixart probe/scrape,
  bank write, product write, publishing, or live pricing write was run.
- `/admin/supplier-bank` mirrors the Pixart readiness report for missing
  families: each Pixart coverage gap shows extractor support, supplier-bank
  normalizer support, exact-URL confirmation, and the mapped profile name. This
  is read-only UI state from existing coverage/registry data; it does not probe,
  scrape, write bank rows, create products, publish, or touch live pricing.
- `/admin/supplier-bank` now also makes the Pixart URL confirmation gate more
  actionable in the Gate roadmap. The Pixart URL candidate panel shows pending,
  confirmed, and rejected counts plus a read-only manual checklist: human-open
  the URL only, verify exact product/configurator URL, compare visible option
  shape to the planned profile/first slice, confirm extractor and supplier-bank
  normalizer support, and only then promote or reject with evidence. The
  displayed checklist command is plain text and does not execute anything.
- Latest imported draft QA checked 10 imported targets: 10 OK, 0 warnings, 0
  errors, and 0 published targets. Matrix/STORFORMAT split is 9/1.
- The current read-only planning reports were refreshed at 2026-07-07
  local time. They show the supplier-bank goal is not complete yet:
  4/8 requirements proved, 3 open, 1 contradicted, 9/14 covered families,
  5 missing families, imported draft QA at 9 OK / 0 warnings / 1 error, and
  1 published imported target:
  - `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`
  - `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`
  - `docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md`
  - `docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md`
  - `docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md`
  - `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`
  - `docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST.md`
  - `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`
  - `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`
  - `docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST.md`
  - `docs/SUPPLIER_BANK_PRINT_COM_OTHER_SCOPING_20260703-084329.md`
  - `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md`
  - `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md`
  - `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`
  - `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`
  - `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`
  - `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`
- The current full WIRmachenDRUCK folder draft `wmd-folder-bank-20260703`
  has 18,800 expected Matrix Layout rows and 18,800 stored
  `generic_product_prices` rows. The remaining imported-draft QA error is an
  older WMD target, `wmd-folder-bank-891a5cf1`, which is already published.
  Do not unpublish/archive it without explicit user approval.
- Latest report index:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`.
  It is a local read-only evidence map over already generated Supplier Bank
  reports. It did not call supplier pages, scrape, read Supabase, write
  supplier-bank rows, create products, publish products, or write live pricing.
  Recurring proof reports now prefer stable latest paths when building proof
  trails, so timestamp churn does not make the admin evidence links look stale.
  The stable proof set includes the index, status, goal snapshot, gate roadmap,
  approval packet, decision queue, executive summary, completion audit,
  imported draft QA, expansion packet, coverage gap plan, Pixart adapter/readiness, URL
  candidates/checklist, and the Pixart/Print.com no-write preflights.
- `/admin/supplier-bank` now includes a read-only five-step Gate roadmap,
  decision queue, Draft QA, and "Næste udvidelser" panels derived from the
  same import/coverage gates as the CLI. The roadmap is UI-only and does not
  scrape suppliers, write bank rows, import products, publish, or write live
  pricing. The roadmap now also shows Pixart URL candidates from supplier
  metadata when available, with a checked-in registry fallback for already
  seeded rows; these are still planning-only and do not make probe/extract
  runnable.
- `/admin/supplier-bank` also shows a top-level read-only `Målestatus` panel
  derived from already loaded bank state. It summarizes family coverage, draft
  QA, open approval/coverage gates, and the high-priority Pixart decision so the
  admin page explains why the supplier-bank goal remains open. The panel also
  lists plain-text safe check commands such as coverage, draft QA, completion
  audit, and relevant preflight checks; these are not executable UI actions.
- The supplier-bank browser also has an operator-focused top `Leverandør-menu`:
  each supplier shows bank/missing family chips plus ready/draft/blocked counts,
  and clicking a supplier jumps to the filtered product catalog. The selected
  supplier view now shows richer `Kataloghylder` per product family with
  ready/draft/blocked counts, price-line totals, DKK ranges, and missing-family
  preview/URL-candidate state. These controls only filter visible bank
  products; missing-family and URL-candidate rows remain planning-only and do
  not start probes, scrapes, imports, publishing, or live price writes. Each
  shelf also shows a read-only `Næste sikre skridt` and, when useful, a
  plain-text safe check command such as a readiness/preflight command; these
  are not executable UI controls.
- Product cards are now business-first by default: admins see source/preview,
  open-draft, and import actions first. Refresh queueing and price-review
  creation are hidden behind a `Vis avanceret` toggle so the product bank reads
  like an import catalog instead of a technical workbench until advanced tools
  are needed.
- Product cards also show compact read-only `Valgmuligheder` previews from
  normalized bank attributes, such as format/material/finish groups with value
  counts and the first few values. This makes supplier products easier to scan
  before opening the full product preview.
- The product preview dialog now shows a read-only `Næste sikre skridt`
  summary with route-specific guidance and optional plain-text safe check
  commands. It does not execute preflights, writes, imports, publishing, or
  live price changes.
- The product browser now shows active search/family/status/readiness filters
  as badges plus a `Ryd filtre` control. This only resets local UI filters and
  does not touch supplier-bank data, products, publishing, or prices.
- The browser now also has an `Afventer godkendelse` panel that presents the
  Pixart rigids/signs and Print.com placemats approval candidates in business
  language. It is display-only and only filters to the supplier when clicked;
  it does not run preflights, write supplier-bank rows, import drafts, publish,
  or write live pricing. The cards also show a read-only "Hvis godkendt" /
  "Hvis afventer" impact strip so the business consequence of approving or
  deferring the gate is visible without adding executable write controls. They
  also show guardrail badges such as no-write preflight present, explicit
  approval required, Matrix import blocked, and POD v2/live pricing untouched.
  Each card also shows the next safe no-write check command as plain text; it
  is not an executable UI action.
- The product bank browser now includes bank-status workflow filters
  (`Godkendt`, `Kladde`, `Gennemgaaet`, `Fejlet`) layered before the existing
  readiness filters. They only filter already loaded active bank rows; archived
  bank products remain excluded by the browser query.
- The browser now also has a read-only `Manglende familier` coverage-gap panel.
  It lists each missing registered supplier family with the current blocker and
  next safe step. Pixart rows show the missing profile/exact-URL blocker before
  probe/extract; Print.com `other` shows the placemats bank-only approval gate.
  Clicking a row only filters the visible supplier/family.
- Main next business decision: approve the Pixart rigids Plastic+Plexiglass
  bank-only snapshot, or keep the current Plastic-only snapshot in review. The
  completion audit proves 5/8 audited requirements and keeps the overall goal
  open because Pixart rigids, remaining registered family coverage, and the
  high-priority decision are still unresolved. The coverage-gap plan breaks the
  five missing families into Print.com `other` scoping plus Pixart adapter
  mappings for `banners`, `labels`, `posters`, and `rollups`. Next expansion
  should start as local/no-write previews only.
- The latest approval packet
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` is read-only and
  separates safe checks from write commands. It lists two approval candidates:
  high-priority Pixart rigids bank-only snapshot approval and medium-priority
  Print.com `placemats` bank-only snapshot approval. Both candidates now show
  their no-write preflight/check command before the write-gated command(s). It
  also repeats the three open requirements from the completion audit, links the
  latest Pixart/Print.com no-write preflight reports, and includes the Pixart
  missing-family readiness blockers (`0/4` ready). It also lists exact approve
  and exact defer phrases per write candidate. No write command from that packet
  has been run.
- The latest completion audit
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_20260703-111157.md` is read-only and
  proves 5/8 audited requirements. It now includes the latest Pixart rigids
  no-write preflight report, candidate rows/effective rows `18/18`, materials
  `Foamex 3mm` and `Clear Polycarbonate 3mm`, and DKK range `182.7-976.83`.
- The latest expansion packet
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_20260703-111157.md` is read-only and
  turns the five remaining coverage gaps into a safe execution order:
  Print.com `other`, then Pixart `banners`, `labels`, `posters`, and `rollups`.
  It separates executable safe commands from human checklist items, keeps
  write-flagged commands out of the safe checklist, includes the Pixart
  readiness-before-probe section (`0/4` missing Pixart families ready), and
  repeats that Pixart rigids and Print.com placemats still need explicit
  bank-only approval before any write.
- The latest gate roadmap
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md` is read-only and
  combines the open decisions, coverage gaps, Pixart readiness blockers,
  Pixart URL-candidate counts, imported-draft QA, and latest proof files into
  five ordered gates. It reports Pixart rigids approval first, Print.com
  `other`/placemats second, missing Pixart family preparation third, clean
  draft QA fourth, and completion recheck fifth. It now marks whether exact
  approve/defer phrases are present for a gate and links the latest Pixart URL
  confirmation checklist. It did not call suppliers, write bank rows, create
  products, publish products, or write live pricing.
- Print.com `other` scoping has now refreshed as a local/no-write preview:
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-092642.json`
  captures 80 candidates with 12 detail payloads from 855 listed catalog
  products. The recommended first narrow price-policy candidate remains
  `placemats`. The refreshed named-policy preview at
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-092659.json`
  passed 4/4 valid DKK rows and no-write write-plan validation, but no
  supplier-bank write is approved yet. The decision queue surfaces this as a
  medium-priority bank-only approval choice while Print.com `other` is missing
  from stored coverage. The latest no-write preflight report
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-110649.md`
  confirms the refreshed preview is ready for explicit bank-only write
  approval. Only run `--write-bank` after explicit approval.
- Pixart rigids latest no-write preflight report:
  `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-110648.md`. It confirms
  the Plastic+Plexiglass candidate has 18/18 effective rows, categories
  `Plastic` and `Plexiglass`, duplicate keys old/new `12/0`, DKK range
  `182.7-976.83`, and prints only approval-gated bank snapshot/delta-review
  commands. No supplier-bank write has been run.
- Pixart adapter mapping has been regenerated as one combined missing-family
  report:
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_missing-pixart-families_20260703-111101.md`.
  It maps the registered missing Pixart families to proposed profile names,
  safe first-slice shapes, and official Pixart URL candidates read from
  `config/supplier-bank/sources.json` `productFamilyUrlCandidates`. The URL
  candidates are not treated as confirmed exact source URLs unless their status
  is `confirmed_source_url`. Current confirmed exact URL candidates are `0/4`.
  Profiles are still not implemented, so probe/extract remains blocked. No
  Pixart probe/scrape or supplier-bank write has been run for those families.
- Latest Pixart readiness report:
  `docs/SUPPLIER_BANK_PIXART_READINESS_missing-pixart-families_20260703-111101.md`.
  It checks the four missing Pixart families and confirms 0/4 are ready for a
  local/no-write probe because `posters`, `banners`, `rollups`, and `labels`
  do not yet have supported extractor profiles or exact confirmed Pixart
  product URLs. It now records registry-backed official URL candidates for each
  family and a separate confirmed exact URL count, but the report is still
  read-only and did not probe/scrape Pixart.
- Latest URL-candidate report:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_pixartprinting-all-families_20260703-111100.md`.
  It checks only the registry and shows 7 Pixart URL candidates, 7 pending
  confirmation, 0 confirmed exact source URLs, and 0 rejected. It did not call
  supplier pages, scrape, write supplier-bank rows, create products, publish
  products, or write live pricing.
- Latest URL-confirmation checklist:
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_pixartprinting-all-families_20260703-121623.md`.
  It turns the 7 Pixart candidate URLs across 4 missing families into a manual
  review checklist for confirming exact product/configurator routes, option
  shape, login/cart blockers, and extractor-profile readiness. It is
  registry-only and did not call supplier pages, scrape, write supplier-bank
  rows, create products, publish products, or write live pricing.

### POD v2

POD v2 is a Print.com integration for master-admin curation and tenant imports.
It feeds data into the existing product system. It must not replace or alter
core pricing logic unless explicitly approved.

Recent work:
- Danish term mapping for Print.com import wizard labels.
- Admin UI/catalog/order improvements.
- Minor request function adjustment.

Key files:
- `POD2_README.md`
- `src/pages/admin/Pod2Admin.tsx`
- `src/pages/admin/Pod2Katalog.tsx`
- `src/pages/admin/Pod2Ordrer.tsx`
- `src/lib/pod2/danishTerms.ts`
- `supabase/functions/pod2-explorer-request/index.ts`

## Safety Rules for Future AI Agents

Do:
- Prefer additive changes.
- Preserve tenant data and tenant-specific settings.
- Run `npm run build` after frontend changes when npm is available. In the
  Codex desktop shell, use the bundled Node/Vite command from the local build
  note above if npm is missing.
- Use existing branding and pricing types instead of inventing parallel config.
- Keep theme changes in the branding model and storefront renderers.
- Respect reduced-motion settings for Framer Motion work.

Do not:
- Reset the branch or revert user changes without explicit instruction.
- Change core pricing calculations casually.
- Merge POD v2 into POD v1.
- Hard-delete POD v2 catalog/import data manually.
- Assume localhost is safe test data.

## Last Known Validation

Local:
- `npm run build` passed in an earlier shell with npm available.
- 2026-07-07 Codex desktop verification used:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.
  It passed with only the known Vite warnings.

## Supplier Product Bank Continuity

Latest admin UI adjustment:
- `/admin/supplier-bank` now shows plain-text `Næste sikre check` commands on
  each missing-family card. These are guidance only and do not execute from the
  browser. Pixart gaps point to readiness checks, Print.com `other` points to
  the placemats no-write preflight, and generic gaps point to the coverage-gap
  plan.
- Missing-family cards also show the first registry-backed URL candidate and
  evidence inline when one exists. These URLs remain planning-only unless their
  status is explicitly `confirmed_source_url`; they do not make Pixart probe or
  extraction runnable by themselves.
- `/admin/supplier-bank` now includes a read-only `Bevisfiler` panel with the
  latest local report paths for executive summary, completion audit, Pixart
  rigids preflight, Print.com placemats preflight, coverage gap plan, and Pixart
  readiness. These paths are documentation only and do not execute supplier
  calls, bank writes, imports, publishing, or live price updates.
- The `Bevisfiler` panel now also includes the latest goal-control snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, plus the latest
  approval packet `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` and
  gate roadmap `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`.
- Approval cards now include a read-only `Beslutningscheckliste` that separates
  what the business decision may approve from what remains forbidden. It is
  guidance only and does not add any write controls.
- Approval cards also show an exact plain-text approval phrase for Pixart
  rigids and Print.com placemats. The phrase is inert UI text; it only helps a
  human give explicit approval later and does not approve or run anything by
  itself.
- Supplier-bank CLI now has a read-only goal-control snapshot:
  `npm run supplier-bank:goal-snapshot` and
  `npm run supplier-bank:goal-snapshot:write`. It combines the completion
  audit, source coverage, import eligibility, imported-draft QA, decision
  queue, Pixart readiness, and latest proof-file paths. It separates safe
  checks from approval-gated write commands and prints the exact approval
  phrases plus exact deferral phrases for Pixart rigids and Print.com
  placemats. It must not scrape suppliers, write supplier-bank rows, create
  products, publish products, or write live pricing.
- The latest goal snapshot, completion audit, and gate roadmap now include an
  `Open Work By Gate Type` section. It separates business approval gates,
  engineering readiness gates, local preview gates, imported-draft QA, and
  completion proof so it is clear what can move with checks versus what still
  needs explicit approval or profile/URL work.
- `/admin/supplier-bank` now mirrors that gate-type structure inside the
  read-only `Målestatus` panel. It shows business approval, engineering
  readiness, local preview, draft QA, and completion-proof buckets from already
  loaded browser state. This is display-only and does not call suppliers, write
  supplier-bank rows, import drafts, publish products, or change live pricing.
- Pixart missing-family readiness now separates extractor support from
  supplier-bank normalizer support. The latest adapter/readiness reports show
  `0/4` extractor-supported profiles, `0/4` normalizer-supported profiles, and
  `0/4` confirmed exact URLs for posters, banners, rollups, and labels. Do not
  run Pixart probe, extract, normalization, bank writes, imports, publishing, or
  live pricing for those families until all three gates are green.
- `/admin/supplier-bank` approval cards now show both an exact approval phrase
  and an exact afvent/defer phrase. The defer phrase is also inert UI text; it
  only gives the user a precise way to keep a gate on hold without approving
  bank writes, draft imports, publishing, or live pricing changes.
- `/admin/supplier-bank` approval cards now include a read-only `Bevisspor før
  beslutning` section. Pixart rigids points to the candidate/baseline JSON,
  candidate packet, no-write preflight, and storformat review. Print.com
  placemats points to the local catalog/price previews, no-write preflight,
  coverage plan, and decision queue. These are proof paths only; they do not
  add buttons, write flags, supplier calls, imports, publishing, or live price
  updates.
- `/admin/supplier-bank` now shows a read-only `Næste importvalg` queue above
  the selected supplier family shelves. It ranks the currently filtered bank
  rows by ready/warning/blocked/imported state and opens only the existing
  preview dialog. It does not approve products, call suppliers, write
  supplier-bank rows, import drafts, publish products, or update live prices.
- `/admin/supplier-bank` now also shows `Faktiske bankprodukter` immediately
  below the top KPI cards so admins see the real supplier products before the
  longer goal/report panels. The cards show supplier, family, readiness,
  price-line count, DKK range, latest snapshot/update date, and draft/blocker
  note; clicking a card opens the existing preview only. Backend verification
  on 2026-07-03 showed 3 suppliers, 10 total bank products, 17 snapshots, and
  10 import jobs; active/non-archived browser coverage remains 9 products.
- That top bank section is now an `Enkel produktvaelger`: first choose a
  product group such as Foldere/Flyers/Visitkort, then choose a product card.
  Product cards show normalized option previews like format, material,
  foldetype, pages, and direction where the bank product has those attributes.
  The preview dialog now has `Konkret produktvalg` buttons for those
  attributes. For Matrix Layout supplier-bank products, the selected values are
  sent as `rowFilter` to `supplier-bank-import-draft`, which dry-runs and
  imports only matching normalized price rows as a separate unpublished draft.
  Storformat products remain blocked to their separate storformat import path.
- `/admin/supplier-bank` is now picker-first instead of report-first. The main
  view hides the KPI strip and long supplier-bank status/report panels by
  default. Admins first see button rows for product group, print house, and
  product. The old operational reports are behind `Vis teknisk overblik`.
- Keep Supplier Bank as a staging layer. Do not scrape suppliers, write bank
  snapshots, import drafts, publish products, or change live pricing unless the
  user explicitly approves that exact write path.

Vercel:
- Production build passed.
- Deployment completed.
- Alias applied to `https://www.webprinter.dk`.

Known warnings:
- Large Vite chunks.
- Supabase client mixed dynamic/static imports.
- `pdfjs-dist` eval warning.
- `lcms-wasm` browser externalization warning.

These warnings existed during successful deployment.

Designer PDF processing (2026-07-10):
- `designer-pdf-service` now has a disabled-by-default private Stirling-PDF
  adapter for form flattening, repair, conservative compression, OCR, PDF/A,
  permanent redaction, and gated text-editor conversion.
- The edge function reads storage through the authenticated user's RLS context,
  sends files to Stirling with a server-only API key, stores immutable outputs
  under the user's ID, and returns a short-lived signed URL.
- The designer never replaces the source automatically. The user must choose
  `Brug i design` or download the result. Permanent redaction is rasterized and
  labeled as such.
- Fabric/vector PDF export remains authoritative. Stirling does not replace
  PDF/X, bleed, font, output-intent, spot-colour, or overprint preflight.
- Configuration and rollback: `docs/STIRLING_PDF_INTEGRATION.md`.
- Vector PDF export now creates a page matching the document/print area and
  embeds the selected original PDF page using the Fabric object's artboard
  position, scale, and rotation. The screen preview may be rasterized, but the
  uploaded PDF stays vector in the production PDF. For apparel designs with a
  PDF base, that PDF is the primary order production file and PNG remains the
  preview; non-PDF apparel designs keep the existing PNG-first behavior.

## If Continuing Visual Theme Work

Check these first:
- Are the generated colors readable in normal, hover and selected states?
- Does the theme affect header, hero, USP, products, matrix, price panel and
  option buttons consistently?
- Does a tenant's saved branding override still work?
- Does preview click-to-edit open the correct side panel section?
- Does mobile still fit without overlap?

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
```

If deploying:

```bash
git status --short --branch
git add -A
git commit -m "..."
git push -u origin ui-cleanup
vercel deploy . --prod -y
```

## Print Production Control Center (2026-07-14)

### Implementation status

- `/admin/printproduktion` is the default master-admin Print Production Control
  Center. Its five normal views are `Overblik`, `Produkter`, `Distribution`,
  `Ordrer`, and `Indstillinger`.
- The route is master-context gated. A tenant-context request redirects to the
  ordinary product area while preserving `force_domain`; tenant navigation no
  longer exposes normal POD controls.
- Product distribution uses the existing selected-tenant transfer path. The
  selection starts empty every time the dialog opens, `Vælg alle` is explicit,
  and the selection is cleared on close. Receiving tenants see ordinary
  Webprinter product/update language rather than supplier or POD details.
- `Kontrollér ordre` is dry-run-only validation. A current successful
  validation is required before an explicit real submission confirmation; an
  uncertain response is not automatically retried.
- Print.com is the only adapter currently allowed to advertise live submission
  and status synchronization. Other suppliers remain catalog-preparation only.

### Key files

- `src/pages/admin/PrintProduction.tsx` - master-context gate and redirect.
- `src/components/admin/print-production/PrintProductionShell.tsx` - the
  five-view shell and normal/advanced boundary.
- `src/components/admin/print-production/PrintProductionOverview.tsx`,
  `PrintProductionProducts.tsx`, `PrintProductionDistribution.tsx`,
  `PrintProductionOrders.tsx`, and `PrintProductionSettings.tsx` - the
  operational views.
- `src/lib/print-production/` - read model, readiness, selected-shop
  distribution, navigation, order-validation/submission safeguards, and
  focused tests.
- `src/components/admin/print-production/AdvancedToolsLinks.tsx` - legacy
  rollback/diagnostic links with `force_domain` preservation.
- `src/pages/Admin.tsx`, `src/components/admin/AdminSidebar.tsx`,
  `src/components/admin/TenantUpdates.tsx`, and
  `src/components/admin/ShopModules.tsx` - route registration, master-only
  navigation, and the ordinary tenant-product boundary.

### Safety and rollback decisions

- POD v1 and its routes remain intact. POD v2 remains the production
  integration; this adds an operating shell only.
- Existing pricing and product-price calculations remain authoritative and
  unchanged. Supplier Bank remains separate.
- The legacy rollback routes remain deployed but are master-context gated:
  `/admin/pod2`,
  `/admin/pod2-katalog`, `/admin/pod2-ordrer`, `/admin/pod2-betaling`,
  `/admin/pod`, and `/admin/pod3`. Rollback removes the new sidebar entry and
  route composition without deleting POD, product, price, order, or tenant
  data.
- No live supplier order, real distribution, or real import was run in
  automated QA. The controller owns fresh-server, signed-in desktop/mobile
  browser QA after this documentation commit.

### Approved corrective hardening wave (2026-07-14)

- The user approved hardening Print.com submission, server-side validation and
  duplicate protection, payment/auto-forward evidence, master-gating legacy
  POD routes, and strict server-side product readiness before distribution.
- Migration `20260714190000_harden_print_production_submission.sql` narrows
  tenant fulfillment access to `SELECT`, adds validation/payment/lock audit
  fields, adds supplier-reference uniqueness, and creates the private
  service-role-only `pod2_claim_printcom_submission` RPC.
- `pod2-order-submit` is the only live Print.com order path. It requires exact
  `master_admin`, a `paid` job, Stripe or server auto-forward evidence, a fresh
  matching dry-run fingerprint, an atomic claim, an approved Print.com origin,
  and a complete server-validated payload.
- Uncertain network, conflict, rate-limit, or supplier 5xx outcomes retain the
  database lock. The UI shows `Indsendelse skal afklares` and does not offer a
  second live attempt. Definitive 4xx validation/auth rejections release the
  claim and require a new dry run.
- `pod2-submit-to-printcom` is deliberately disabled with HTTP 410. The API
  explorer is read-only. Manual forwarding requires a supplier reference and
  server payment evidence. Status sync is bounded and cannot regress terminal
  jobs.
- Job creation is duplicate-protected per order and catalog product. Tenant
  approval claims `awaiting_approval` atomically before creating a Stripe
  PaymentIntent with a stable job-scoped idempotency key; uncertain Stripe
  results remain `payment_pending` for reconciliation.
- `/admin/pod`, `/admin/pod-katalog`, `/admin/pod-ordrer`,
  `/admin/pod-betaling`, `/admin/pod2`, `/admin/pod2-katalog`,
  `/admin/pod2-ordrer`, `/admin/pod2-betaling`, and `/admin/pod3` are now
  master-context gated. Their underlying POD v1/v2 data and behavior were not
  removed.
- Distribution now fails closed in the RPC unless the master product is ready
  and published and the POD catalog, supplier link, image/title, fixed price
  matrix, active connection, and selected tenant eligibility are current.
- Rollback instructions are embedded at the top of the migration. Do not clear
  a retained submission lock merely to make a retry button work; first verify
  at the supplier that no order exists.

### Corrective hardening rollout state (2026-07-14)

- The linked Supabase project has migration
  `20260714190000_harden_print_production_submission.sql` applied and recorded.
  Preflight found three fulfillment jobs, zero duplicate order/catalog pairs,
  and zero duplicate Print.com references.
- The hardened `pod2-order-submit`, disabled legacy adapter, explorer, status
  sync, manual forwarding, job creation, tenant charge approval, and POD2X
  proxy functions are deployed and active. The status-sync endpoint remains
  gateway-public for cron delivery but rejects calls without exact master auth
  or the configured long cron secret.
- The frontend route gate and Printproduktion presentation changes passed the
  production build and local signed-in browser QA. They were not Vercel-deployed
  in this wave because the working branch is 43 commits ahead and contains
  unrelated unfinished changes; deploy them only through the next reviewed
  frontend release.
- No live Print.com order and no Stripe charge was created during rollout or QA.

### Verification commands

Use the bundled runtime when invoking Node, pnpm, or Vite:

```bash
PATH=/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node --test --experimental-strip-types src/lib/print-production/*.test.ts
PATH=/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec eslint src/lib/print-production src/components/admin/print-production src/pages/admin/PrintProduction.tsx
PATH=/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vite build
```

2026-07-14 local result: all 58 focused `src/lib/print-production` tests
passed; the scoped ESLint command passed; and the Vite production build passed.
The build retained the pre-existing dependency/chunk warnings (including
`lcms-wasm`, `pdfjs-dist`, mixed import, and large-chunk warnings) without a
build error.

### Remaining live canary requirement

Before live supplier use, an authorized master operator must explicitly approve
and place one controlled real Print.com canary order. Afterward, verify the
stored supplier order reference and status synchronization. Automated QA must
continue to use `Kontrollér ordre` with `dryRun: true` and must not place a live
supplier order, distribute a real product, or import a real product without
separate explicit approval of the exact product and tenant shops.

## Designer Return Flow and Folder Templates (2026-08-03)

- Order launches now carry two explicit internal destinations: `backTo` returns
  to the originating product configurator, while `returnTo` continues to
  `/checkout/konfigurer`. Both are validated as internal paths and use history
  replacement to prevent a product/designer browser loop.
- Returning to a Matrix Layout V1 product restores the checkout session's exact
  section values, row, and quantity. A folder therefore returns to the same
  format, spine, print, material, and quantity instead of resetting to defaults.
- Product PDF templates are exact-match records. `format` and `configuration`
  (for example `A4` + `5 mm ryg`) must match the current selection; the runtime
  no longer falls back to the first PDF or to a hard-coded Salgsmapper file.
- A product-template record can carry `designerTemplateId` plus copied artboard,
  bleed, and safe-area metadata. The product editor copies these values when an
  admin connects a designer template, allowing anonymous storefront launches
  without making tenant-private template-library rows public.
- Legacy linked PDFs without copied dimensions are measured from their real PDF
  page size in the designer. Technical template overlays remain locked,
  non-printing, excluded from export, and no longer mark a new design as edited.
- Verified locally on the Salgsmapper standard product: A4 + 5 mm opens the
  existing PDF on a 504 x 371 mm artboard and Back returns directly to the same
  A4 + 5 mm order selection. A4 + 1 mm and A5 + 5 mm correctly report that the
  template is missing and do not expose the designer button.
- Current template inventory is intentionally incomplete. The standard product
  has one verified A4 + 5 mm PDF; the other nine format/spine combinations need
  real source PDFs (or an explicit production decision that a verified dieline
  is shared) before they should be connected. The three other Salgsmapper folder
  products currently have no product-template records.

### 2026-09-08 — actual homepage and catalog repair

- Plain local master homepage uses the recorded `print-precise` default (design
  1 with desktop category rail); do not redirect the user back to design review.
- Print-theme `/produkter` and category-filtered `/shop` routes now resolve the
  category URL into the published catalog instead of repeating the home hero
  and featured product. Five categories, all 20 product destinations and five
  information-page destinations were browser-checked.
- Homepage Storformat choices now carry widthCm/heightCm/qty to the existing
  calculator; 80 × 100 cm, two aluminium items = 698 kr before delivery on both
  pages and after reload. No pricing calculations changed.
- With explicit user approval, made only the existing published adhesive
  product's 7 materials, 4 finishes and 2 delivery options public in the linked
  database. Exact guarded apply/rollback files and post-checks are under
  `output/design-exploration/homepage-repair-2026-09-08/`.
- Mobile header now uses the same configured links as desktop; responsive
  matrix overflow and category route scroll position were corrected. Normal
  product pages hide design review controls unless `orderDesign` is explicit.
- See `docs/HOMEPAGE_REPAIR_QA_2026-09-08.md`. Local UI/build proof is not complete
  checkout/payment/fulfillment or every imported-price proof. No deployment.


## 2026-09-09 — Color profiles and production PDF

Local implementation uses display-density proofing, exact tenant/profile/hash resolution, FOGRA39/51/52 recipes, method/supplier-mode guidance, and a shared vector/real-CMYK production PDF builder. Saved design JSON now carries profile identity/hash and production color mode. FOGRA51/52 are official per-shop installations; development-only binaries stay in ignored `tmp/local-color-profiles`. No deployment or live product/order/profile writes were performed. See `docs/COLOR_MANAGEMENT_IMPLEMENTATION_2026-09-09.md` for setup, evidence, unsupported cases and selective rollback. Preserve the unrelated dirty worktree and the protected document/pasteboard/guide behavior.


## 2026-09-20 — Selected product workspace picture 2

The selected ordering-form workspace now opens for existing matrix_layout_v1 products in ProductPriceManager (default/#workspace), with existing Product & prices retained. Real ProductPrice/Matrix rendering powers both editor and storefront; presentation drafts preserve source IDs/prices and Apply is tenant/freshness guarded. New unpriced choice placeholders remain drafts; actual priced-option creation still uses the existing editor. Source, browser, build, 33 tests, rollback and explicit hosted/upload proof boundaries: `docs/PRODUCT_WORKSPACE_IMPLEMENTATION_2026-09-20.md`. Browser review on 8112 uses synthetic data only. No deployment or hosted writes. Next: choose wide-format and combined machine/learning layouts. Preserve the dirty worktree.

### Follow-up: product locator connected

The selected finder now opens at `/admin/products`; search/format/material/status filters and image preview lead into the individual product editor, preserving URL/tenant context on return. Prior management remains under `view=manage`. Local 8112 mounts the actual overview and creator against synthetic data. See `docs/PRODUCT_LOCATOR_IMPLEMENTATION_2026-09-20.md` for evidence and selective rollback. Wide-format 7–9 and combined machine/AI 10–12 are ready for selection at `output/product-creation-concepts-2026-09-20/next-layouts.html`; no choice is assumed and no costing/learning logic changed.

## 2026-09-21 — Site Design control reconnection and cleanup

Site Design is now the canonical shop appearance editor; Branding V2 redirects to it. PrintHero uses the existing banner engine, common buttons reach hero/catalog/featured/product-order renderers, dropdown zero RGB values are fixed, Banner 2 and USP are primary sections, and old reserved color controls/duplicate navigation are hidden. Undo/Redo is local branding history; standard reset is now an undoable draft transformation, not an immediate publication. Master templates remain separate and are labelled accordingly. See `docs/SITE_DESIGN_CONNECTION_AUDIT_2026-09-21.md` and the selective patch/evidence in `output/site-design-audit-2026-09-21/`. Authenticated localhost 8113 preview checks and 27 focused tests pass; full build/type/lint stalled on the local dependency environment. No live saves, publication, uploads, pricing changes or deployment. Preserve the unrelated dirty worktree; do not use whole-file Git resets.


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
