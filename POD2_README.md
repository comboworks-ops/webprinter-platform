# POD v2 System (Print.com Integration) — High Priority

Last updated: 2026-07-14

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

---

## 5) Edge Functions (POD v2)
Located in `supabase/functions/`:
- `pod2-explorer-request` — master-only, read-only Print.com API explorer; supplier writes are rejected
- `pod2-tenant-import` — import a catalog product into product configuration
- `pod2-tenant-merge` — merge multiple POD imports into one matrix product
- `pod2-tenant-remove` — remove tenant import
- `pod2-tenant-billing-setup` — create/reuse Stripe customer + SetupIntent for tenant POD v2 billing
- `pod2-create-jobs` — create a POD v2 fulfillment job from an order for products linked via `technical_specs.pod2_catalog_id`
- `pod2-tenant-approve-charge` — tenant approves + pays supplier cost; job moves to `paid`
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
