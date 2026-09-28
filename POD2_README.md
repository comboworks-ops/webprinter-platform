# POD v2 System (Print.com Integration) — High Priority

23 September 2026 — product image/large-file upload fixes implemented locally. Product image transfer retries/progress, reference-first removal, unsaved editor preservation; chunked 1 GiB checkout candidate with bounded hashing/PDF reads and server-side copy. 37 focused tests, recovered-copy TypeScript/build, local synthetic 1 GiB interrupted-transfer test pass. Live 50 MiB limit is intentionally retained until matching backend activation; delivery destination/retention and authenticated image upload acceptance remain open. No live writes/deployment. See docs/PRODUCT_UPLOAD_FIXES_2026-09-23.md.


Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

Latest production rollout checkpoint (16 September, evening): **41 live functions now use modern keys**, verified ACTIVE; public unpublished pricing is closed and the hardened supplier explorer is live. All 201 products and 357,913 generic price rows remain unchanged across 23-table content checks. Vercel production build settings use the modern public key and private-upload flag; domains and live schema/bucket are unchanged. The old service key remains enabled. Thomas approved preserving live contact emails; send-contact-message v8 is deployed and verified without sending mail. Thomas also approved the existing OpenAI/Gemini image-sharing and provider-cost behavior; icon-studio-generate v7 is ACTIVE with exact source verification and a denied guest probe, without generating images. A separate live checkout-schema migration was rejected as premature before the matched release; no live DDL was applied. The full v4 candidate is now READY on its protected Vercel URL after fixing server-dependency packaging and protected same-origin asset fetches. The six customer domains remain on the existing deployment; the prepared Stripe callback has not been created. Three new asset-security tests pass; TypeScript remains at 403 diagnostics. Matched backend/file/frontend release and final key disable remain open. New isolated checkout snapshots retain production selections. 145 focused tests pass; TypeScript remains at 403 diagnostics. See [the current rollout checkpoint](docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact versions, candidate, remaining audit findings, approvals and rollback. Earlier checkpoints below are historical.

Key/file security checkpoint (2026-09-16, 18:34 CEST): Thomas approved the
temporary deletion pause and isolated private-storage acceptance, preserving all
products. Both v1/v2 removal endpoints now return HTTP 409 without any database
calls (v24 isolated, v8 live). All 201 live products and checked price/option/import
contents are unchanged. 50 existing isolated functions migrated to modern keys.
POD v1 explorer and shipping quote handlers now restrict supplier access to the
intended master/product/price boundaries. POD v2 create-jobs requires exact shop
management or a completed checkout recovery capability; automatic paid forwarding
also requires completed payment evidence. Checkout supplies that capability.
PDF preflight corrections create a new signed file for re-approval rather than
overwriting approved artwork. Supplier file signing preserves the stable payload
fingerprint and uses the now-applied isolated order/file binding migration. The
isolated bucket is private, its old public CDN cache has been purged, and customer,
admin, history, capability, replacement and supplier-download checks pass. All
original files remain; no supplier production request was made. Live storage,
credentials and frontend remain unchanged. The removal pause is the only live
function deployment in this checkpoint. Keep
authorization and immutable records on rollback, pause new effects, and never
restore unsafe proxy/delete handlers. See
`docs/KEY_AND_FILE_MIGRATION_2026-09-16.md` before any further deployment.

Last updated: 2026-07-14

Storefront VAT companion (2026-09-16): the three launch shops now have a reviewed
DK-delivery-only checkout policy. VAT is added after existing catalogue/POD price
calculation; no supplier costs, price matrices, fulfillment jobs or supplier
submissions changed. Isolated creator/finalizer/webhook and confirmation/status
emails preserve frozen tax evidence in orders.checkout_tax and outbox. Existing
payments/jobs retain their amounts. See docs/PRODUCTION_RELEASE_2026-09-16.md for
versions and rollback: pause new effects, retain issued-payment reconciliation
and immutable tax data. This companion is not deployed to the live backend.

Local email companion (2026-09-10): order confirmations and status/problem
messages now share a published-tenant-brand template in storefrontEmailDesign.ts.
The latest template changes are not deployed. Test order mail now requires
STOREFRONT_ORDER_EMAIL_RESEND_API_KEY so installing its credential does not
activate copied legacy quote/contact handlers. This is email presentation and
credential selection only: no POD/pricing/production behavior or supplier
submission changed. Keep email disabled on rollback and preserve frozen retry
payloads/outbox rows; see the latest verification checkpoint.

Staging security/checkout companion (2026-09-10, latest): isolated branch
`cyurochbkxggcobnxaxq` now has the prepared account/checkout/email repairs and
`20260910164000_storefront_tenant_write_boundaries.sql`. The new restrictive
policies protect tenant controls, including `pod2_auto_forward`, and ordinary
storefront roles/products/prices/orders. No POD v1/v2 tables, pricing formulas,
supplier-submission code or supplier orders changed. This migration is NOT LIVE
and must ship with server order finalization plus the matching frontend; do not
deploy it alone over the legacy customer order INSERT path. Four Stripe TEST
payments finalized on staging, but no supplier/production fulfillment was
exercised. Email is queued and disabled. Keep restrictive authorization and
payment/order/file records on rollback; disable checkout/editing and repair the
specific legitimate operation. Never push the ignored staging schema baseline
to production. See the isolated staging checkpoint and full evidence in
`docs/launch-review-2026-09-10/verification.md`. Older “undeployed” companion
notes below remain true for the live backend, not this isolated branch.

Security companion (2026-09-10): deployed migration
`20260910154637_restrict_public_catalog_views_to_reads.sql` restricts both public
POD catalog projections to SELECT for anon/authenticated. Published-only reads
remain 3 POD v1 / 4 POD v2 rows; no source tables, prices, fulfillment or supplier
logic changed. Never roll back by restoring public write grants. See the
implementation checkpoint in `docs/launch-review-2026-09-10/verification.md`.

This document is the authoritative guide for POD v2 in this repo.
Read this first before changing anything in POD v2, pricing, or catalog flows.

---

## 1) Purpose
POD v2 is a **master‑tenant only** Print.com integration that lets us:
- Pull Print.com products into a curated POD catalog.
- Configure matrix layout + quantities.
- Import into the existing product configuration/pricing system **without touching core pricing logic**.
- Merge large imports safely when product combinations are huge.

It is **not** a replacement for the pricing engine or product configuration logic; it only feeds into them.

---

## 2) Hard Rules (Do Not Break These)
1) **Do not modify the core pricing system** (pricing engine, product configuration, MPA).
2) **Keep POD v1 intact**. POD v2 is separate.
3) **Master tenant only** for creation and catalog management:
   - `tenant_id = 00000000-0000-0000-0000-000000000000`
4) **Never delete catalog products directly** unless you also remove dependent imports/jobs.
5) **Split + merge** large price matrices (do not import giant matrices in one go).

---

## 3) Current UI Flow (Admin)
Route: `/admin/pod2`

Tabs:
- **API Explorer** — low‑level API runner (Print.com API)
- **Vælg produkt** — fetch products from provider, start configuration wizard
- **Konfigurer** — curate products (rename + publish toggle) and delete safely
- **Katalog** — tenant catalog view + import flow

Inline wizard in **Vælg produkt**:
- **Step 1: Vælg** (variants, quantities, markup, etc.)
- **Step 2: Layout** (drag‑and‑drop matrix layout)

---

## 4) Data Model (POD v2)
Main tables:
- `pod2_catalog_products` (master only)
- `pod2_catalog_attributes`
- `pod2_catalog_attribute_values`
- `pod2_catalog_price_matrix`
- `pod2_tenant_imports` (tenant)
- `pod2_fulfillment_jobs` (tenant, future)

Important fields:
- `pod2_catalog_products.supplier_product_data.matrix_mapping`
- `pod2_catalog_products.supplier_product_data.matrix_quantities`

These are **saved from the Step‑2 matrix wizard** and used for **all future imports**.

### Price contract

- `pod2_catalog_price_matrix.base_costs` is Webprinter's private supplier cost.
- `pod2_catalog_price_matrix.recommended_retail` is the Webprinter product price
  offered to tenant shops.
- A tenant imports the Webprinter price into its own product and may add its own
  customer-facing markup.
- `pod2_fulfillment_jobs.tenant_cost` is the Webprinter price owed by the tenant,
  resolved from `recommended_retail`. It must never be resolved from the private
  supplier cost.
- No additional wholesale margin is added during order creation. Webprinter's
  own margin is already part of the product price configured by the master.
- Existing fulfillment jobs keep their stored amount. This contract applies to
  newly created jobs; historical paid or submitted jobs are never repriced.

---

## 5) Edge Functions (POD v2)
Located in `supabase/functions/`:
- `pod2-explorer-request` — master-only, read-only Print.com API explorer; supplier writes are rejected
- `pod2-tenant-import` — import a catalog product into product configuration
- `pod2-tenant-merge` — merge multiple POD imports into one matrix product
- `pod2-tenant-remove` — remove tenant import
- `pod2-tenant-billing-setup` — create/reuse Stripe customer + SetupIntent for tenant POD v2 billing
- `pod2-create-jobs` — create a POD v2 fulfillment job from an order for products linked via `technical_specs.pod2_catalog_id`
- `pod2-tenant-approve-charge` — tenant approves + pays the Webprinter product price; job moves to `paid`
- `pod2-master-forward` — master marks paid jobs as forwarded to supplier; job moves to `submitted`
- `pod2-order-submit` — the only live Print.com order adapter; requires fresh server validation, payment evidence, and an atomic submission claim
- `pod2-printcom-sync-status` — master/cron read-only supplier status polling with non-regressive status transitions
- `pod2-submit-to-printcom` — disabled legacy adapter; returns `410 legacy_adapter_disabled`
- `pod2-pdf-preflight` — exists but **not deployed** (optional future feature)

Deployment reminder:
```
supabase functions deploy pod2-tenant-import
supabase functions deploy pod2-tenant-merge
supabase functions deploy pod2-tenant-remove
supabase functions deploy pod2-tenant-billing-setup
supabase functions deploy pod2-create-jobs
supabase functions deploy pod2-tenant-approve-charge
supabase functions deploy pod2-master-forward
supabase functions deploy pod2-order-submit
supabase functions deploy pod2-printcom-sync-status
supabase functions deploy pod2-submit-to-printcom
```

Admin routes:
- `/admin/pod2` — master catalog / API explorer
- `/admin/pod2-katalog` — tenant catalog import view
- `/admin/pod2-ordrer` — tenant approval queue + master forwarding queue
- `/admin/pod2-betaling` — tenant billing setup for POD v2

---

## 6) Known Limits / Safeguards
- **Price inserts are chunked** (500 rows per batch).
- **Matrix preview** is capped at **500 combinations** (UI safeguard).
- Large combinations should be imported in **chunks** and merged.
- Current POD v2 fulfillment requires a `paid` job. Payment evidence is either
  a server-verified Stripe PaymentIntent or a tenant whose server-side
  `pod2_auto_forward` flag created the job as paid.
- A real Print.com call is always preceded by a fresh server-side payload
  validation and a one-use database claim. A retained claim means the result
  is uncertain and blocks all retries until manual reconciliation.
- `submitted` means a supplier reference has been stored or a master operator
  has recorded a manual supplier reference. Status polling can then advance it
  to `processing`, `completed`, or `failed` without reopening terminal jobs.

Recommended:
- Import **base product** (formats + materials)
- Import add‑ons (lamination, foil, cutting) separately
- Use **Sammenflet** to combine

---

## 7) Delete / Reset Rules
If you delete a catalog product:
1) Delete related jobs (`pod2_fulfillment_jobs`)
2) Delete imports (`pod2_tenant_imports`)
3) Delete catalog product (`pod2_catalog_products`)

The Curate delete action now follows this order automatically.

---

## 8) What NOT to do
- Do not modify `product_price` components or pricing engine logic for POD v2.
- Do not store POD v2 data in existing pricing tables (except via `pod2-tenant-import`).
- Do not remove POD v2 RLS policies.

---

## 9) File/Component Map
UI:
- `src/pages/admin/Pod2Admin.tsx` — main POD v2 admin
- `src/pages/admin/Pod2Katalog.tsx` — catalog + import wizard (compact)

Hooks:
- `src/lib/pod2/hooks.ts`

DB:
- `supabase/migrations/20260128_pod2_system.sql`

---

## 10) Notes / Constraints
Print.com API endpoints used in this repo **do not provide categories or thumbnails**.
If categories are needed, add a manual SKU → category mapping layer later.

---

## 11) Safe “Next Work” Ideas
- Optional add‑on pricing (requires new pricing logic — do not start without approval).
- Optional category/tag mapping for POD catalog UI.
- Deploy `pod2-pdf-preflight` when ready.
- Supplier submission/status sync after `pod2-master-forward`.
- Dedicated print-house API adapter for sender/blind-shipping propagation.

---

## 12) TL;DR
POD v2 feeds into the existing product system without touching pricing logic.
Keep POD v1 intact.
Current fulfillment flow is tenant payment first, then master forwarding.

---

## 13) Print Production Control Center (2026-07-14)

`/admin/printproduktion` is the default master operating route for the POD v2
production workflow. It is an additive master-admin shell over the existing
POD v2 data, hooks, edge functions, selected-tenant transfer, and product/order
flows; it is not a new POD engine. A tenant-context request is redirected to
the ordinary product area and must not disclose supplier information.

### Normal master views

The normal route has five business-facing views:

1. `Overblik`
2. `Produkter`
3. `Distribution`
4. `Ordrer`
5. `Indstillinger`

Use the normal views for day-to-day work. Technical supplier diagnostics, raw
payload/dry-run detail, matrix tools, and manual forwarding stay under
`Avancerede værktøjer` rather than becoming a tenant-facing or default flow.

### Distribution and tenant boundary

- A distribution dialog always opens with no shops selected. `Vælg alle` is a
  separate, explicit action; it is never preselected.
- A product is sent only to the explicitly selected eligible shops. Closing and
  reopening the dialog clears the selection.
- The existing selected-tenant transfer continues to use
  `delivery_mode = pod_price_list` internally, but receiving tenants see an
  ordinary Webprinter product update, ordinary product/storefront pricing, and
  ordinary orders.
- Tenant-facing navigation and screens must not expose POD versions, supplier
  names or costs, credentials, API settings, matrix mapping, raw payloads,
  dry runs, or forwarding controls.

### Order submission boundary

`Kontrollér ordre` is server-side validation only and performs no supplier
write. A successful validation of the current order data is required before
the explicit `Send til produktion` confirmation can be enabled. Do not
automatically retry an uncertain real submission.

Migration `20260714190000_harden_print_production_submission.sql` enforces this
contract below the UI:

- tenant users can select their POD v2 jobs but cannot insert, update, or delete
  fulfillment state directly;
- `pod2_claim_printcom_submission` atomically accepts only `paid`, unsubmitted,
  unlocked jobs with an exact payload fingerprint validated within 15 minutes;
- Stripe-backed jobs are checked against Stripe for successful status, amount,
  currency, tenant, order, and job metadata before the claim;
- auto-forward jobs are accepted only while the tenant remains enabled for
  controlled forwarding;
- supplier references are duplicate-protected, and uncertain network/5xx/409
  results retain the lock instead of retrying;
- fulfillment-job creation is unique per order and catalog product, and tenant
  approval acquires an atomic state claim before creating a Stripe PaymentIntent
  with a stable idempotency key;
- manual forwarding requires a non-empty supplier reference and the same paid
  or auto-forward evidence;
- status synchronization accepts either an exact `master_admin` session or a
  constant-time checked 32+ character cron secret, limits each batch, and
  rejects status regression;
- product distribution rechecks publication, master readiness, supplier link,
  image/title, active Print.com connection, a complete fixed-price matrix, and
  recipient auto-forward eligibility inside the database transaction.

Only Print.com is currently permitted to report live submission and status sync
as ready, via the verified `pod2-order-submit` adapter. Other providers may be
used for catalog preparation only until their server-side adapter,
authorization, option translation, idempotency, and an explicitly authorized
real canary order pass the same acceptance contract. Never send a Print.com
payload to another supplier endpoint.

### Rollback and invariants

Rollback removes the new `Printproduktion` sidebar entry and route composition
while leaving POD v2 data and edge functions untouched. Keep these deployed
legacy/advanced routes available to the master operator during rollout,
including their
`force_domain` context when linked from the control center:

- `/admin/pod2` - supplier/API workbench
- `/admin/pod2-katalog` - catalog and matrix workbench
- `/admin/pod2-ordrer` - technical order handling/manual fallback
- `/admin/pod2-betaling` - historical tenant billing
- `/admin/pod` - POD v1
- `/admin/pod3` - Flyer Alarm workbench

All listed legacy POD routes are master-context gated in `src/pages/Admin.tsx`.
A tenant-context request is redirected to the ordinary product area. The
routes remain rollback tools without remaining tenant-accessible control
surfaces.

This control center does not change POD v1 tables, functions, routes, or UI
behavior. It does not change the pricing engine, product-price calculations,
or storefront pricing; existing pricing remains authoritative.


## Customer account companion UI — 2026-09-08

The customer account now uses selected design 2. POD v1/v2 pricing, tables and fulfillment logic are unchanged. The separate, locally prepared `20260908140250_customer_order_file_finalization.sql` migration adds `public.customer_finalize_order_file` and its private implementation for requested customer file replacements; it has **not been deployed**. See [the account handoff](docs/CUSTOMER_ACCOUNT_IMPLEMENTATION_2026-09-08.md) for ownership checks, explicit grants, storage-policy prerequisites, unverified backend behavior and rollback. The account stops before upload if this RPC is unavailable.

## Checkout connection repair companion — 2026-09-08

The undeployed storefront checkout v2 finalizer is additive and does not change POD v1/v2 pricing, tables or supplier-submission functions. It writes ordinary `orders`/`order_files` atomically after Stripe verification, then the frontend may invoke the existing `pod2-create-jobs` with the verified order ID. That optional follow-up is still interruptible. Customer replacement migration `20260908140250_customer_order_file_finalization.sql` now removes the unchecked customer file INSERT policy, so it must ship with the service-only storefront finalizer. See `docs/SYSTEM_CONNECTION_REPAIRS_2026-09-08.md` and its payment/account packets for new RPCs, function settings, test requirements and rollback. No migration/function deployment has occurred.

The same local repair now includes server quote validation for STORFORMAT using an exact copy of the existing calculator, and migration `20260908184205_storefront_order_email_outbox.sql`. Its service-only queue/claim/prepare/finish functions and `storefront-order-email-dispatch` cover confirmation emails; they do not submit supplier orders or replace `pod2-create-jobs`. Keep payment/email dispatch disabled through the matched staging setup, preserve uncertain payment/email records on rollback, and do not treat local parity/queue fixtures as proof of POD fulfillment.

The checkout email companion adds the undeployed `storefront-order-email-dispatch` Edge Function and private `storefront_order_email_outbox` via `20260908184205_storefront_order_email_outbox.sql`. New paid-order completions atomically queue customer and configured shop notifications. Dispatch is disabled by default and needs a dedicated scheduler secret, verified sender, environment mode, recipient allowlist for tests and configured HTTPS site origin. It does not submit supplier jobs. See [the email repair packet](docs/connection-repairs-email-2026-09-08.md) for retry/idempotency limits, explicit service-only grants, local verification, deployment requirements and rollback. No live email, schedule or deployment was performed.
