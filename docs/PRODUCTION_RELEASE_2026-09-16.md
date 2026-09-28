# Three-shop production release — 16 September 2026

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

Status: **HOLD — VAT, false RGB warning and paid-invoice behavior repaired on staging/local; active old administrator key, file privacy and matched live rollout remain open**.
Thomas authorized implementing the fixes and bringing the three existing sites
online. Preserve the existing Stripe integration, shop data and published designs.
The email designer and Social Hub campaigns remain outside this release.

## Latest — confirmed seller and API-key migration, 16 September 15:00 CEST

Thomas confirmed this project serves the three-shop multi-tenant platform and
its own admin/import system. No separate application is known. All three shops
invoice as Printmaker ApS, CVR 42683043, Stationsvej 17, 8544 Mørke. These answers
resolve the two questions in the preceding checkpoint.

**Live data change:** merged only `settings.company.invoice_name`, `cvr`, and
`address` for the three launch tenants on BOTH live `ziattmsmiirfweiuunfo` and
isolated `cyurochbkxggcobnxaxq`. Atomic before/after comparisons confirmed unchanged
shop names, unrelated settings and unrelated company fields. Readback confirms
all six records; none has an extra zip/city that could conflict with the address.
Evidence: `tmp/launch-email-20260916/printmaker-seller-readback.json`.
No database schema, Edge Function, payment, email or domain deployment changed.

`OrderManager` now uses `company.invoice_name` before the existing company/shop
fallback. `ShopSettings` exposes the legal invoice name and preserves other
company fields when saving, including bank details. Existing branding names are
not repurposed as legal seller names. These source changes await frontend release;
the already deployed frontend does not yet read the new legal-name field.
The saved VAT test order was read without mutation and the actual invoice PDF
regenerated/rendered/visually inspected: Printmaker ApS and confirmed CVR/address,
443.00 net +110.75 VAT =553.75 paid, correct billing details, no new due date.
Evidence: `tmp/launch-email-20260916/invoice-printmaker-proof.json` and
`tmp/pdfs/checkout-invoice-printmaker-test.pdf`. This is a local QA invoice, not
an issued accounting document or full admin browser acceptance. Four invoice
tests pass. Earlier paid-order/admin transition evidence remains separate.

Fresh full candidate: `output/production-release-2026-09-16-printmaker-seller`,
built from current source with downloaded production settings in 12.00s.
All six API routes, 1171 source hashes and 305 static files pass verification;
no private configuration value was found in static output. See its build-proof.json.
The earlier colour-invoice candidate is now stale. No candidate deployed and the
protected preview still shows the preceding colour/invoice revision.

**Credential migration remains open.** Existing modern default public and secret
keys were found in the production dashboard; no key was created, revealed or
changed. The existing modern public key passed read-only live REST and tenant
lookup probes, including the currently JWT-verified gateway. Evidence:
`tmp/launch-email-20260916/modern-public-key-probes.json`. This does not prove
backend-secret replacement or authenticated workflows. There are 54 actual live
Edge Functions, and deployed versions must be reviewed independently of local
source. Current Supabase guidance explicitly no longer allows legacy key rotation;
migrate consumers to modern keys before disabling legacy keys. User admin login
and password are unrelated to this change and should not be shared. See the
updated `PRODUCTION_KEY_REPLACEMENT.md` for the staged migration and sources.

File privacy, frozen production configuration, connected-account acceptance and
the matched live frontend/backend/webhook release remain open. For rollback of
this UI change, keep the existing invoice seller-completeness guard; the additive
invoice_name field can stay unused. Do not revert confirmed CVR/address to blanks
or restore a compromised credential. No new schema/edge rollback is required.

## Earlier — colour warning and invoice repairs, 16 September 14:41 CEST

Thomas authorized proceeding with the remaining fixes and matched release. The
false RGB classification is repaired: a generated CMYK regression PDF produces
RGB **display** operators in PDF.js, proving the original inference invalid.
Checkout no longer interprets those operators as source colour. All uploaded
PDFs explicitly report colour verification as unresolved and retain manual
review; this is not a new source-colour or supplier preflight engine. The
unqualified “perfect/ready to print” heading is removed. Default checkout safety
is now 3 mm, matching Designer; explicit product/session margins, including zero,
are preserved.

The real protected preview accepted the previously inspected CMYK aluminium PDF:
no false RGB warning, manual colour-review notice, 1206 × 606 mm including bleed,
and 3 mm safety zone. The upload automation ignored its requested timeout and
stalled for roughly 22 minutes before completing. No payment/order was created.
New preview: https://printmaker-web-craft-main-iv86ueuq5-thomas-projects-d80b9ddd.vercel.app
(READY / Preview; isolated backend only; never promote this static test artifact).

Invoice generation now uses the saved billing record instead of delivery details,
marks immutable finalized checkout payments BETALT, omits a new payment deadline
and bank-transfer request, and wraps long item descriptions. Legacy order deadlines
are based on order creation, not the download date. Incomplete checkout evidence
or missing seller name/address/CVR blocks the admin invoice action. The actual
PDF generator was exercised against the saved 553.75-kr test order and visually
inspected: 443.00 net / 110.75 VAT / 553.75 paid, correct billing record and no due
date. This is a local TEST document, not an issued/accepted invoice: Webprinter's
stored CVR is empty. Full admin browser invoice acceptance remains open.

Authenticated staging admin API checks changed only test order
`e1db04fe-23df-46be-8085-8a628923501b` through processing, production and problem,
then restored pending. A different customer could not update it. Payment/tax
identities and the unsent outbox remained unchanged. No supplier job or email.
Proof: `tmp/launch-email-20260916/invoice-and-admin-proof.json`.

72 focused tests pass (colour and invoice regressions failed before their fixes).
Preview build 9.63s; full production build 8.90s, all six API functions included.
Fresh private candidate: `output/production-release-2026-09-16-colour-invoice`;
1,171 current source hashes match and 305 static files pass private-value scanning.
No production deployment. The grant check passes 11 migrations and diff check is
clean. Current TypeScript run reports 403 diagnostics, none in the files changed
in this checkpoint; do not claim compiler cleanliness or compare unaligned old
baseline line counts as a regression result.

**Live security remains a blocker:** the local production service-role JWT was
issued 8 December 2025 and still receives HTTP 200 from the Auth administrator
endpoint as of 14:07 CEST. The February exposure/rotation item remains open.
No key was printed, changed or revoked. See `docs/PRODUCTION_KEY_REPLACEMENT.md`.
The live `order-files` bucket is still public; privacy remediation must preserve
existing file/Designer/order consumers. That issue, missing frozen production
configuration/receipt details, connected-account acceptance and the coordinated
live backend/webhook/frontend rollout remain open.

Pending user answers: whether this Supabase project serves other applications,
and whether all three shops should invoice as Printmaker ApS / CVR 42683043 /
Stationsvej 17, 8544 Mørke. Do not infer these answers or modify live credentials
or seller details while waiting. No live aliases/schema/functions changed.
Checkout/email remain paused; rollback of these local UI changes must retain
honest colour uncertainty and the paid order/tax evidence.

## Latest — Denmark delivery and VAT verified, 16 September 13:49 CEST

Thomas confirmed **delivery to Denmark for the initial launch, with VAT included
in the payable amount**. Foreign sellers and cross-border delivery rules belong
to a later expansion. His proposed blanket VAT exemption for customers ordering
from abroad is not implemented: customer location or foreign billing details do
not alone establish an exemption. [Skat's EU consumer guidance](https://skat.dk/erhverv/moms/moms-ved-handel-med-udlandet/moms-ved-salg-til-private/salg-til-private-i-eu),
[EU business documentation requirements](https://skat.dk/erhverv/moms/moms-ved-handel-med-udlandet/moms-ved-handel-med-virksomheder/moms-ved-handel-med-lande-i-eu/dokumentationskrav-ved-handel-med-lande-i-eu)
and [exports outside the EU](https://skat.dk/erhverv/moms/moms-ved-handel-med-udlandet/moms-ved-handel-med-virksomheder/moms-ved-handel-med-lande-uden-for-eu/moms-ved-salg-af-varer-og-ydelser-i-lande-uden-for-eu)
were checked. EU consumer VAT, qualifying intra-EU business sales and documented
exports are different cases. No Stripe Tax registrations or account settings changed.

Implemented explicit `dk-domestic-v1` policy for the three launch shop IDs. New
payments require DK delivery and add 25% VAT to the existing net product, options
and delivery total, rounded once in integer øre. Other seller policies and foreign
delivery fail closed rather than becoming zero-tax payments. Client tax fields
and billing-country hints cannot override the calculation. Existing attempts
retain frozen amounts/routing/descriptor/idempotency, including historical net-only
test payments. Catalogue/POD price formulas and stored prices are unchanged.

`orders.checkout_tax` stores the server-frozen breakdown; a private invoker trigger
copies and validates it from the attempt and rejects subsequent changes. The
email outbox captures the same evidence. Receipts, confirmation/status email
renderers and the invoice amount helper use it. Historical checkout orders without
tax evidence cannot generate an invented VAT invoice. Legacy/manual invoice
conventions remain separate. The existing checkout-session `totalPrice` stays net
so returning/reloading cannot add VAT to a previously VAT-inclusive subtotal.
The payment/confirmation dialogs now retain a visible test-mode notice.

Local migration `20260916112627_storefront_domestic_vat_snapshot.sql` is installed
on isolated `cyurochbkxggcobnxaxq` as hosted version **20260916113115**. Do not
bulk-push history to reconcile that timestamp. No live schema/functions changed.
All **33 deployed dependency files** exactly match source:

| Handler | Isolated version | JWT gateway |
| --- | --- | --- |
| stripe-create-payment-intent | 29 | on |
| stripe-finalize-checkout | 14 | on |
| stripe-storefront-webhook | 14 | off; signed Stripe webhook |
| storefront-order-email-dispatch | 15 | off; dedicated worker bearer |
| send-order-email | 31 | on |

**Acceptance:** five new-payment regression cases failed before the repair; all
60 focused checkout/tax/email tests now pass, as do all five Deno entrypoints,
the grants check across 11 migrations, and the isolated build (12.58 seconds).
Hosted NO/DE/CY requests and a DK request with the old 44,300-øre total each returned
409 without creating an attempt. Server reconciliation quoted **55,375 øre**.
The tax/order trigger rejected a tax mutation, and the earlier 443-kr test order
remains unchanged. Both new/replaced trigger functions are invokers with fixed
search paths and no anon/authenticated EXECUTE grant. Advisors still report the
pre-existing catalog-view/legacy-function/Auth findings; this is not an overall
security pass. [Advisor reference](https://supabase.com/docs/guides/database/database-linter).

New protected static preview:
`https://printmaker-web-craft-main-qcxqy1pbk-thomas-projects-d80b9ddd.vercel.app`,
deployment `dpl_8xnFtHeULhbnS6nJJLDAsafgzkF7`, READY / Preview. Actual browser
checkout displayed **314 + 129 = 443.00 kr net, 110.75 kr VAT, 553.75 kr payable**;
NO delivery disabled payment, and DK reload kept the same amount. Uploaded and
approved the independently inspected CMYK PDF, then paid with Stripe's test card:

- Attempt `4d9bac50-43d8-4400-9bc8-35ffb8f9e28d`, PaymentIntent
  `pi_3UGHHDLlYyddTjie0BS5i1TN`, completed / `livemode=false` / WEBPRINTER suffix.
- Order `e1db04fe-23df-46be-8085-8a628923501b`, number
  `WP-4D9BAC5043D844009BC835FFB8F9E28D`: 553.75 kr and the exact frozen tax breakdown.
- Exactly one finalized PDF; its SHA-256 matches the inspected original.
- Exactly two unsent outbox messages contain the same tax/gross values. The actual
  email renderer and invoice amount helper were run locally against saved data;
  both show 443.00 / 110.75 / 553.75. No new email was sent and no invoice PDF or
  complete admin invoice UI was accepted in this check.
- Browser confirmation, including VAT, survives full reload without duplication.

Proof files: `tmp/launch-email-20260916/domestic-vat-{source-proof,probes,order-proof}.json`,
with repeatable scripts and locally rendered `domestic-vat-email.html`. Keep private
configuration files private. Checkout is paused again (503), email disabled (409),
and the scheduler was not activated. No real payment or supplier order occurred.

The VAT blocker below is resolved **on staging**; the RGB warning and the other
listed file/security/admin/connected-payment release checks remain open. Production
artifacts still require a fresh full build and the reviewed matched rollout.
Rollback: pause new checkout/email effects; retain tax snapshots and finalization
for existing intents. Never remove VAT from an issued amount or rewrite old orders.

## Latest browser payment checkpoint — 13:13 CEST

The actual Webprinter aluminium checkout completed using Stripe's public test
card in the existing Printmaker account. The product was 120 × 60 cm / 1200 ×
600 mm, Hvid alu-plade 3mm, quantity 1. Uploaded the inspected Designer-exported
`output/pdf/launch-2026-09-16/aluminium-browser-print.pdf`, approved it in the
real proof dialog, filled synthetic customer/delivery details and submitted
the actual Payment Element. The AI-agent declaration was selected; optional
Link account-saving fields were left empty. No real money, supplier request or
new email was sent.

Protected checkout-only test preview:
`https://printmaker-web-craft-main-joet1abr6-thomas-projects-d80b9ddd.vercel.app`,
deployment `dpl_4cJhRsNVvDFtrK2fjF5YRbZ6Bc7p`, READY / Preview. The normal browsing
preview `q2ykt4y6m` remains separate. Both are static test artifacts without the
six production API routes and must never be promoted to the live domains.

The new explicit build switch `--checkout-test` requires the isolated backend,
its matching anon-key project and a `pk_test_` public key. Runtime gating also
requires isolated mode, the explicit test flag and the exact HTTPS backend
origin. Only payment creation/finalization join the three existing read-handler
exceptions; email, supplier, unknown/malformed handlers and other backend origins
remain blocked. Ordinary preview builds keep payment disabled. **34 focused
isolation/tenant/account/Designer tests and the preview production build pass.**

- Attempt `30024f42-b4ca-4e84-9287-5d5acbf42988`, payment
  `pi_3UGGcZLlYyddTjie0IBkSoNQ`: completed, `livemode=false`, 44,300 øre,
  server-frozen statement suffix `WEBPRINTER`.
- Exactly one saved order `c63da1fa-22a9-48e5-b8f8-83f7273f14cd`, number
  `WP-30024F42B4CA4E8492875D5ACBF42988`, pending / TEST, no production.
- Exactly one finalized PDF was downloaded from isolated storage and hashed.
  SHA-256 `5a8c424b4664e9c782cd5c84599f9434c8e2426eb7dfebda175861e0fea995cf`
  exactly matches the inspected upload.
- Two outbox messages remain pending with zero attempts. Sending stayed disabled.
- A full browser reload restored the same completed order confirmation. Database
  readback still found one order, one file and two outbox records.
- Afterwards checkout creation was disabled again (HTTP 503), mail dispatcher
  returned `email_dispatch_disabled` / HTTP 409, and cron job 1 was verified
  inactive. The webhook/finalizer remain available for already-issued intents.

Repeatable bounded proof: `tmp/launch-email-20260916/browser-order-proof.mjs`
and `browser-order-proof.json`. The earlier `acceptance.mjs paused` phase has a
historical exact count of five allowlisted outbox rows; do not rerun that count
unchanged now that this browser order has added two pending notifications.

### Defects found during this actual flow

**VAT is a release blocker.** The UI labels 314 kr product + 129 kr delivery as
443 kr excluding VAT, yet both `checkoutTotal` and server
`roundCheckoutAmounts` send only 44,300 øre to Stripe. The completed test order
also saves 443 kr. This run proves payment and persistence, not correct tax
charging. Thomas has been asked whether launch deliveries should be Denmark
only or include other countries immediately; no answer has been received yet.
Resolve the selling/tax scope and update the server quote, checkout breakdown,
immutable attempt/order amounts and dependent email/invoice/refund displays
together. Preserve historical attempt amounts/idempotency. Do not merely add
25% in the browser or silently restrict supported countries. Official reference
checked: [Skat — I gang med moms](https://skat.dk/erhverv/moms/i-gang-med-moms).

**The PDF colour warning is a false positive for this inspected CMYK file.**
Checkout scans PDF.js rendering operators for RGB; PDF.js normalizes source
CMYK into display RGB, so these operators cannot establish the original PDF
colour space. Independent recursive inspection found 60 CMYK `k` operations
and zero source RGB operations in this file's page/forms. The real UI nonetheless
claimed RGB and requested re-export. This remains unfixed. Replace that check
with a trustworthy original-PDF analysis or explicitly report colour validation
as unknown; do not equate a rendered preview with production colour validation.
Keep the separate supplier/platform preflight and manual production review.

Other observed details: the confirmation's size/material values are blank even
though the checkout configuration contains them; the full-screen payment and
confirmation dialogs cover the page-level test banner; Designer/checkout safety
labels still differ (3/2 mm). Stripe reported an unregistered preview domain for
Apple Pay and an older-integration advisory. Card payment succeeded; wallet and
connected-account acceptance were not established by it.

**Both earlier production candidates are now stale** after the new frontend
test-mode changes. Their recorded source-hash matches describe their build time,
not the current tree. Rebuild the full production artifact after the VAT/flow
repairs; neither candidate nor the new preview has changed a live alias.

## Completed in this checkpoint

- **10:22 CEST refresh after the tab-isolation fix:** a new production candidate
  is built in `output/production-release-2026-09-16-tab-fix/.vercel/output`.
  All 1,163 source hashes match the current checkout, all six API functions are
  present, and 305 static files contain none of the scanned private production
  configuration values. `build-proof.json` records these checks. Actual production
  Vercel settings were pulled and validated again. This candidate is now historical
  after the later browser test-mode changes; the earlier artifact below also
  lacks the tab repair.
- Created a production source snapshot of 1,163 files with SHA-256 inventory at
  `output/production-release-2026-09-16/source-manifest.json`. It includes `api/`
  and the original tenant routing, unlike the isolated static review preview.
- Pulled the actual production Vercel configuration. Verified the exact project,
  live Supabase URL and public anon key, live Stripe public-key prefix, disabled
  isolated-preview flag, and absence of private keys under `VITE_` names.
- **Full Vercel production build passed**, including favicon, llms, robots,
  sitemap, storefront-brandmark and tenant-shell functions. Artifact is saved in
  `output/production-release-2026-09-16/.vercel/output`. All 305 static files
  were checked against private production environment values; no match found.
  This is build proof, not hosted acceptance or a production deployment.
- Deployed the latest branded mail source to isolated Supabase
  `cyurochbkxggcobnxaxq`: `storefront-order-email-dispatch` v7 (dedicated bearer,
  gateway JWT off) and `send-order-email` v23 (JWT on). Downloaded all dependency
  files and verified exact equality to local source. Email remains disabled.
- **31 email tests**, **20 checkout tests**, two Deno entrypoint checks and the
  explicit-grants check across ten changed migrations passed. Six hosted probes
  confirmed disabled new test checkout and rejected unauthorized email calls.
- Applied the additive address-column repair to **live** Supabase
  `ziattmsmiirfweiuunfo`. All four new fields are nullable text and were verified
  through `information_schema`. No customer values or policies were rewritten.
  Hosted migration history: `20260915221814_checkout_customer_profile_address_details`;
  this corresponds to local `20260908172325_checkout_customer_profile_address_details.sql`.
  Do not bulk-push migration history to reconcile the timestamp difference.

## Resend and three-shop email acceptance

Thomas explicitly approved creating the prepared Resend key, Sending access
restricted to `webprinter.dk`, and storing it only in the isolated test backend.
He asked to use the contact address already configured in the system. Live
company settings for both Onlinetryksager and Salgsmapper identify
**support@onlinetryksager.dk**, which is the selected test recipient.

Thomas completed sign-in. Created Resend key **Webprinter launch test —
cyurochbkxggcobnxaxq**, ID `80e64154-5c01-42ea-a9f4-26628d09127c`, with Sending
access restricted to verified `webprinter.dk`. Stored it only as
`STOREFRONT_ORDER_EMAIL_RESEND_API_KEY` in the isolated backend. The key value
was not printed or saved locally, and the transfer clipboard was cleared.
No global `RESEND_API_KEY` was added: copied legacy handlers must not gain
unrestricted sending access.

At approximately 00:43–00:44 CEST, three new Stripe TEST payments of DKK 149
completed in the existing Printmaker account. Each signed webhook independently
saved one order, one finalized production-file reference and two outbox intents
before the recovery endpoint was invoked. Synthetic products were hidden after
payment preparation. These are explicitly labelled TEST / no production orders.

| Shop | Saved isolated order | Customer confirmation provider ID |
| --- | --- | --- |
| Webprinter | `d391348b-a9cf-4665-a6b6-e1b6b0367706` | `93ad101f-e2ee-4a17-9f5e-83d058137136` |
| Onlinetryksager | `4337eb84-d7c3-4cdc-9449-aaa0fe32402b` | `f80c6066-a82e-4741-880a-cb1c6b9b3d7c` |
| Salgsmapper | `8e4341d8-c47e-4be8-864d-915b11dcbfce` | `deca76eb-c030-4141-97a9-2e98234ddecf` |

The real dispatcher accepted five messages: three customer confirmations and
two operator notifications, all to **support@onlinetryksager.dk**. An immediate
second dispatch claimed/sent zero. Webprinter's separate operator message to
info@webprinter.dk remained pending with zero attempts because that address is
not allowlisted. No earlier non-allowlisted test mail was sent.

An authenticated synthetic platform admin then requested an Onlinetryksager
production-status email twice. Resend recorded one message
`d5734f48-ca26-4312-9bed-bdc05b8c1e0b`; an explicit TEST file-problem message is
`bc614302-14e2-4846-bb5a-ecadfa83231e`. A customer attempting the status-send
endpoint was denied with HTTP 403. The other two operator-message IDs are
`deb7c521-434b-4f42-b6af-5a82c31998e9` and
`bd2e5d1e-79c2-47b3-83d0-643970005737`.

**Resend's authenticated activity page showed exactly seven messages, all
Delivered.** Detail pages confirmed the corresponding shop names, Reply-To
contacts and tenant-specific order links. The rendered Onlinetryksager letter
showed its orange accent and logo. The common verified sender mailbox is
ordre@webprinter.dk; its display name changes by shop. Webprinter and Salgsmapper
used their configured text identities. This is provider-reported delivery;
Thomas subsequently confirmed receiving some emails. This confirms actual
inbox receipt for an unspecified subset, not all seven messages or design approval.
Gmail/Outlook/Apple
Mail rendering and the current browser payment form are not proven by this run.

Private repeatable test/proof files are in `tmp/launch-email-20260916/`.
Do not publish `*-private.json` or environment files. Preserve the completed
orders, immutable files and outbox/provider history; do not reset sent rows.

## Automatic dispatch and paused configuration

Installed `pg_cron` on the isolated backend only, hosted migration
`20260915224651_storefront_email_scheduler_extension`. Added the backend origin
and existing dedicated worker bearer to Supabase Vault, then installed the
one-minute `storefront-order-email-dispatch` job (ID 1). Its stored SQL reads
the bearer from Vault; the credential value is absent from the job text.
Browser roles have no Vault schema usage. No public application objects or
browser grants were added.

At **00:49:00 CEST** the scheduled SQL ran successfully and its actual HTTP
response was **200**, with all counters zero. This separately proves scheduling,
authenticated worker access and no duplicate mail after the five queued sends.
No new mail was queued for that empty scheduler test. The reusable installation
SQL is [storefront-email-scheduler.sql](storefront-email-scheduler.sql); it
creates the job inactive. This follows Supabase's documented
[Vault-backed function scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

After acceptance, the job was set **inactive**, checkout creation remained
**false**, and order-email mode was returned to **disabled**. Key, recipient
allowlist, Vault configuration, orders and provider evidence remain available
for the next controlled test. The signed webhook and finalizer remain available
to reconcile already-issued payments. This configuration is not installed live.

The existing Stripe **Printmaker** test dashboard (`acct_1KEH0SLlYyddTjie`) is
accessible. The newer Stripe connector only lists a different Onlinetryksager
account (`acct_16CdkJJVJ05AJlNv`, test). Do not change the integration account to
match that connector. Earlier payment proof used the Printmaker account.
Live tenant payment settings name connected destination `acct_1SsioWLn79xiiQuz`
for both tenant shops; Salgsmapper's saved `payouts_enabled` is false while the
other shop's is true. Verify actual account readiness and destination-charge
behavior rather than editing the saved status blindly.

### Shared Stripe account decision — 16 September

Thomas confirmed that the Printmaker Stripe account is shared with the other
business/brand he called “Crocodile”, under the same company. He explicitly does
not want a second Stripe account for that company. Preserve this account and the
other integration; do not rename the whole account to Webprinter or create an
additional account merely to separate shop branding. This answers the earlier
shared-account question, but does not remove payment acceptance requirements.

Read-only dashboard inspection of `acct_1KEH0SLlYyddTjie` in **test mode** confirmed
that its statement descriptor is currently **COOKADELI**. This is a configured
value, not merely an inference from the earlier 3DS screen. Live-mode public
details were not changed or independently rechecked in this follow-up.

The current payment creator already tags charges with `tenant_id` and checkout
attempt identity, but sets no human-readable payment description or
`statement_descriptor_suffix`. Proposed separation within the existing account:
retain shop-branded application checkout/order emails, add clear trusted shop
labels for payment reporting, and use a per-card-payment suffix after the shared
account prefix. Stripe limits the full prefix/separator/suffix to 22 characters;
suffixes do not replace the shared merchant identity and are card-only. The
actual prefix and short shop labels still need review before implementation.
Stripe's own receipt branding/public details are account-level for platform
charges; do not change them per request or promise independent receipt/3DS
branding simply by tagging a payment. Existing connected-account destinations
and `on_behalf_of` must be assessed separately, not removed to merge unrelated
tenant businesses into Thomas's account.

Official sources checked 16 September:
[statement descriptors](https://docs.stripe.com/get-started/account/statement-descriptors),
[receipt branding](https://docs.stripe.com/receipts), and
[account separation guidance](https://support.stripe.com/questions/create-and-manage-multiple-stripe-accounts).
Stripe instructs independently operating businesses/websites to use separate
accounts even when they share a legal entity. Confirm that the intended shared
business activities fit the existing account before live rollout; the user's
same-company preference is not provider approval. No account settings, payment
routing, credentials or new payments were changed in this follow-up.

**Subsequent payment-label choice:** Thomas accepts **Webprinter** as the common
payment name for Webprinter, Salgsmapper and Onlinetryksager. Implemented the
card `statement_descriptor_suffix` **WEBPRINTER** in the prepared creator for
exactly these three tenant IDs. Shop-specific transactional email designs remain
separate. This suffix is 10 characters, so it fits Stripe's 22-character total
even with a 10-character shared prefix plus `* `; it does not replace the prefix,
change Stripe's account-wide receipts/3DS identity or rename Crocodile's account.

The approved label is saved server-side in the new attempt's `quote_snapshot`
before payment creation. Creation retries reuse that frozen value; pre-existing
attempts without it retain their original Stripe parameters. Client-supplied
labels are ignored. Independent tenant payments, charge destinations, fees,
amounts, existing metadata and Stripe account settings are unchanged. No database
migration or frontend rebuild is required for this Edge Function change.
All **22** focused checkout/handler tests and the Deno entrypoint check pass,
including the three approved shops, another tenant, connected routing/fees,
identical retry parameters and old unbound attempts.

Deployment status: isolated `stripe-create-payment-intent` **v26**, JWT enabled,
deployed to `cyurochbkxggcobnxaxq`; all nine source files match local code exactly.
Post-deploy probes confirm checkout HTTP 503 and email worker HTTP 409; the five
sent outbox rows and five non-allowlisted pending rows are unchanged. No payment
or email was issued during this check. Source proof is saved as
`tmp/launch-email-20260916/payment-label-source-proof.json`.
Production rollout and an actual card-statement display remain unverified.
Rollback: disable new checkout creation first. Preserve reading the frozen
statement suffix for already prepared attempts until they are reconciled; blindly
restoring an older creator could change the parameters of an issued but unbound
Stripe intent. No account-wide branding change is required for this suffix.

## Actual Designer file and two-shop browser verification — 16 September

In the protected isolated preview, selected Webprinter aluminium at 120 × 60 cm:
314 kr product plus 129 kr delivery, 443 kr excluding VAT. Opened the real
Designer at 1200 × 600 mm, added synthetic text (including ÆØÅ/æøå) and a vector
shape, and exported **Print PDF / CMYK / include bleed** through the actual UI.
The downloaded PDF has one page, a 1206 × 606 mm MediaBox/BleedBox and a
1200 × 600 mm TrimBox inset by 3 mm. The embedded output intent is ISO Coated v2
300% (FOGRA39), four channels. Three vector Form XObjects and no image XObjects
were found; the text is outlined. A rendered page showed the Danish characters
and shape without clipping, selection controls or Designer guides.

Evidence: `output/pdf/launch-2026-09-16/aluminium-browser-print.pdf`, SHA-256
`5a8c424b4664e9c782cd5c84599f9434c8e2426eb7dfebda175861e0fea995cf`, with sibling
PNG/JSON inspection files. This PDF explicitly is **not PDF/X certified**;
print-house acceptance, imported PDF preservation and multi-sided products are
not established by this simple export.

The real **Fortsæt til checkout** action generated and uploaded a production PDF
to isolated `order-files` storage. Stored object:
`designer-production/6c546267-6585-4465-a4fe-857e3d343612-1789546055434-Design_til_Aluminium_Skilte.pdf`.
The downloaded storage copy has identical page geometry, decoded page stream and
all three decoded vector Form streams to the inspected export. Comparison is in
`output/pdf/launch-2026-09-16/checkout-pdf-comparison.json`. Metadata/file hashes
may differ between the two exports. No supplier order was submitted.

This browser test exposed a real preview defect: another open shop could replace
the shared localStorage shop preference while the first tab was in the Designer.
Returning to a checkout URL without `tenantId` then showed the second shop.
`useShopSettings` now stores each local/isolated tab's selected shop in
sessionStorage, retaining localStorage only as a last-used preference for new
tabs. Two regressions failed before the change and pass after it; all **32**
focused tenant, account, Designer navigation and isolation tests pass.

Updated protected preview:
`https://printmaker-web-craft-main-q2ykt4y6m-thomas-projects-d80b9ddd.vercel.app`,
deployment `dpl_8CiiuMEC6CGCQnV2bXBnnwKJrCtt`, READY / Preview. In two real tabs,
Webprinter remained selected through bare product navigation, Designer production
file generation, bare checkout return and a full reload, while Onlinetryksager
remained selected in the other tab. Checkout retained its approved Designer PDF,
1200 × 600 mm dimensions and 443 kr total. No warning/error console entries were
captured in the checked tab. This fixes the observed preview navigation defect;
the current browser Stripe payment form remains untested and disabled.

Remaining file/UI detail: the Designer shows 3 mm safety distance, while the
checkout preview labels 2 mm. Actual trim/bleed are correct; reconcile the safety
guide configuration before treating every product guide as accepted.
No checkout/email gate or scheduled job was enabled during this browser check.
The configured test email site URL still names the earlier preview; update it
before a later controlled send, without rewriting already frozen sent payloads.

## Coordinated switch still required

1. Resolve delivery-country/tax scope and repair the VAT omission in server quote,
   checkout, saved order and dependent documents. The real browser card payment,
   approved file, saved order and reload recovery now pass for one Webprinter
   aluminium configuration; extend corrected-price acceptance to the other shops
   and complete recipient review and admin-processing proof.
2. Verify each advertised pricing model and actual production PDF output, and
   resolve the outstanding security/credential and public-artwork findings in
   `docs/LAUNCH_REGISTER.md` and `docs/SECURITY_FOLLOWUPS.md`.
3. Install the remaining matched schema/functions and register the **live**
   storefront webhook in the existing Stripe platform account. Keep subscription
   billing separate. Coordinate the new creator and frontend with the restrictive
   file/order policies; those policies break old browser order insertion.
4. Enable configured production effects and deploy the production artifact only
   after hosted acceptance. **Never promote the isolated review artifact.**
5. Check all three real domains, tenant login/editing, catalogue, approved file,
   paid order, email and admin processing. An owner must perform any actual live
   payment acceptance transaction. Record the result and unresolved limitations.

The existing production deployment is
`dpl_3HKtXdnXFpE5Ygj2VboG8mdfjtNg`, created 28 July, URL
`printmaker-web-craft-main-nn2a1zmm4-thomas-projects-d80b9ddd.vercel.app`.
It serves the apex and www forms of webprinter.dk, salgsmapper.dk and
onlinetryksager.dk. **These aliases were not changed.**

Rollback: the address columns can remain without the new frontend; preserve
their saved values. For the payment release, first stop new payment creation and
email dispatch while retaining the finalizer/webhook and immutable files to
reconcile issued payments. Restoring the previous frontend does not make it safe
to restore broad customer writes or remove payment records.

## Repeatable local build

`scripts/prepare-production-release.mjs` creates a fresh source inventory,
validates downloaded production configuration with `--verify`, and creates an
external build workspace with `--build-workspace`. It never deploys or changes Git.
Environment files and artifacts remain ignored and private; do not share them.

The refreshed build workspace is `/private/tmp/webprinter-production-release-bnjcHu`;
the earlier one was `/private/tmp/webprinter-production-release-n0SKIH`.
Vercel 56's repository discovery selected the parent checkout for earlier nested
build attempts, and its dependency installer then stopped on unapproved package
build scripts. Build outside the repository and use
`VERCEL_INSTALL_COMPLETED=1` with the existing dependencies for both Vite and API
builders. The local project settings use an empty install command and
`node node_modules/vite/bin/vite.js build`; remote project settings were not changed.
Do not rerun a package install or approve dependency scripts merely to repeat this
build. First run `vercel pull --yes --environment=production` in the fresh candidate:
the root `.vercel/project.json` may lack the downloaded `settings` object required
by `--build-workspace`. Latest log:
`tmp/launch-email-20260916/production-build-after-tab-fix.log`; earlier log:
`tmp/launch-online-20260915/production-build-20260916-isolated.log`.

The broad pre-existing TypeScript backlog remains; this checkpoint does not claim
compiler cleanliness or a full-system release sign-off. No Git commit, push,
reset, staging operation, supplier order or live-customer email was performed.
The seven explicitly authorized test messages above are the only email sends.
