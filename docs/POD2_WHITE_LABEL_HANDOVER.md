# POD v2 White-Label + Print.com Submission — Handover

**Date:** 2026-04-20
**Status:** Verified end-to-end against the live Print.com API. First real order
`6002102581` (Print.com internal id `2106321`) was accepted on 2026-04-20, held
at `MANUALCHECK` (expected — our test used a logo PNG as the print file), and
cancelled manually via platform.print.com.
**Risk level:** Low for the submission mechanics themselves. Moderate for
rolling out to real tenant traffic — we still lack a curation UI, so adding a
new Print.com SKU requires hand-writing a `supplier_product_data` row.

---

## Architecture (the correct mental model)

Tenants never touch Print.com. The platform owns one Print.com account
(WebPrinter / Printmaker ApS). The flow is:

1. **Master curates** a Print.com SKU into WebPrinter's catalog
   (`pod2_catalog_products`), attaching a `supplier_product_data` blob that
   tells the submission adapter how to translate a customer's config into
   Print.com option slugs.
2. **Master shares** that catalog product to tenants via the existing
   product-transfer system (`send_product_to_tenants` RPC →
   `clone_product_for_tenant_release` copy-on-transfer). Tenants see it as a
   native WebPrinter product and can customize photos/text/price.
3. **Customer** buys from the tenant's shop through normal checkout. Tenant is
   billed in their own currency on their own Stripe.
4. **Tenant pays master** for the POD cost (handled by existing
   `pod2-tenant-approve-charge`, not touched in this work).
5. **Master forwards to Print.com** via the `pod2-order-submit` edge function
   — a single `POST /orders`. WebPrinter is the Print.com customer; WebPrinter
   gets Print.com's invoice.

Tenants never see Print.com option slugs, pricing schemas, or supplier
countries. All of that lives on the master's catalog row.

---

## What this ships

1. **Tenant white-label** — each tenant shop configures a sender identity
   (company, contact, address, logo, `sender_mode ∈ standard|blind|custom`).
   That identity is snapshotted onto every POD fulfillment job at creation
   time and forwarded as `senderAddress` + `stickySlipImageUrl` on the
   Print.com order item.

2. **Single-call Print.com adapter** — `pod2-order-submit` replaces the older
   `pod2-submit-to-printcom` (which was built against a fictional 7-step
   cart/contacts/stickyslip API that Print.com does not have). The new
   adapter makes one `POST /orders` call with sender, file, and logo inline.

3. **Feature flag with legacy fallback** — `USE_POD2_ORDER_SUBMIT` (defaults
   `true`) in `src/lib/api/featureFlags.ts` picks between the new adapter and
   the legacy one. Both edge functions remain deployed until the new one has
   real production runs behind it.

---

## User-facing surfaces

### Tenant shop admin
`ShopSettings` → **POD afsender-identitet** card
(`src/components/admin/TenantPodShippingProfile.tsx`).

### Master admin
`/admin/pod2-ordrer` → per-job **Videresend** dialog:

- **Primary block — "Send til Print.com"**
  - Payment method picker (`invoice` default, `psp` alternate).
  - `Dry run` checkbox (defaults **on** for safety on a new job).
  - **Inline result panel** renders right in the dialog:
    - Blue card on dry run — lists the Print.com options that would be sent
      and collapsible full payload.
    - Green card on real success — shows Print.com's order id and full
      response.
    - Red card on failure — shows Print.com's raw rejection message, the
      response body, and the payload we sent. No DevTools needed.
- **Fallback block** (dashed border) — legacy manual forward, for cases where
  the operator handles the order outside Print.com entirely.

---

## Data model

### `tenant_pod_shipping_profile`
PK = `tenant_id`. RLS: tenant CRUDs own row; master reads all. Holds
sender identity + logo.

Migration: `20260417090000_pod2_tenant_shipping_profile_remote_applied.sql`.

### `pod2_fulfillment_jobs` added columns
- `sender_address_json` (jsonb) — snapshot at job-creation time.
- `sender_logo_url` (text).
- `printcom_order_id` (text — opaque Print.com id).
- `printcom_order_raw` (jsonb) — full Print.com order response for audit.
- `printcom_submission_step` (text) — kept for backward compat with the legacy
  pipeline; the new adapter only ever writes `"submit"` on success.
- `printcom_last_error` (text), `printcom_last_attempt_at` (timestamptz).

Legacy columns `printcom_cart_id`, `printcom_cart_item_id`,
`printcom_printjob_id`, `printcom_design_id` still exist in the schema. The
new adapter leaves them NULL; they're only populated if you flip the feature
flag back to the legacy pipeline.

Migration: `20260417100000_pod2_printcom_linkage_remote_applied.sql`.

### `pod2_catalog_products.supplier_product_data` (jsonb)

The curation blob. Example for `printed-letterheads`:

```json
{
  "printcom_sku": "printed-letterheads",
  "supplier_country": "NL",
  "fixed_options": {
    "size": "a4",
    "bundle": "bundle_per_100",
    "urgency": "standard",
    "material": "90gr_biotop",
    "printtype": "44",
    "printingmethod": "digital"
  },
  "attribute_map": [
    { "webprinter_attr": "copies", "printcom_option": "copies", "from_qty": true }
  ]
}
```

- `fixed_options` — Print.com option slugs that are the same for every order of
  this catalog product.
- `attribute_map[]` — entries that vary per order.
  - `from_qty: true` — pull the value from `pod2_fulfillment_jobs.qty`.
  - Otherwise pulled from the order's `variant_signature` / product_configuration
    (`"size:a4|paper:130g"` parses to `{size:"a4", paper:"130g"}`).
  - Optional `values: { "webprinter_val": "printcom_slug" }` translation map.
  - Optional `required: true` + `default: "..."` to force a fallback.
- `supplier_country` — sent as `supplierCountry` on the order item; biases
  Print.com toward a specific production facility.

**All slug values must match Print.com's real schema** — fetch via
`GET https://api.print.com/products/{sku}` with
`Authorization: PrintApiKey <key>` and read the `properties[]` array to see
valid option slugs. Violations come back as `"failed to validate option: …"`.

---

## Submission pipeline

`supabase/functions/pod2-order-submit/index.ts`. Not idempotent in the
old sense — there's no resume-from-step state machine, because there's only
one step. Retrying a failed submission just retries the one `POST /orders`
call.

### Input
```ts
{ jobId: string; paymentMethod?: "invoice" | "psp"; dryRun?: boolean }
```

### Output shapes
```ts
// dryRun
{ success: true, dryRun: true, payload, warnings: string[] }

// real success
{ success: true, job, payload, response, warnings: string[] }

// Print.com rejected (edge function returns 502)
{ success: false, error: string, payload, response }
```

The hook `usePodSubmitToPrintcom` unpacks the 502 body off `error.context`
so the red card can display Print.com's real rejection message plus the
payload we sent.

### Auth
The adapter reads `pod2_supplier_connections.auth_header_mode`. For Print.com
the verified working mode is `authorization_printapikey`, which sends
`Authorization: PrintApiKey <key>`. Bearer and X-API-Key are supported
fallbacks for other providers or future experimentation, but Print.com itself
requires `PrintApiKey`.

### Master-only enforcement
Edge function checks `user_roles` for `tenant_id = MASTER_TENANT_ID` and role
in `("admin", "master_admin")` before doing anything. Tenant auth tokens are
rejected at the gate.

### Billing address
Pulled from edge-function env (`supabase secrets set`):
`PRINTCOM_BILLING_COMPANY`, `PRINTCOM_BILLING_FIRST_NAME`, `_LAST_NAME`,
`_STREET`, `_HOUSE_NUMBER`, `_POSTCODE`, `_CITY`, `_COUNTRY`, `_EMAIL`,
`_PHONE`, `_VAT`. This is WebPrinter's address, not the tenant's.

### Address normalization
- `normalizeCountry()` maps `"DANMARK"/"Denmark"/"Sverige"/…` → ISO-2.
- `splitStreet()` takes `"Stationsvej 17"` → `{street:"Stationsvej",
  houseNumber:"17"}`. Print.com requires them split.

### Feature flag
```ts
// src/lib/api/featureFlags.ts
USE_POD2_ORDER_SUBMIT = true  // default — new single-call adapter
// Set VITE_USE_POD2_ORDER_SUBMIT=false to revert to legacy
```

The hook (`src/lib/pod2/hooks.ts` `usePodSubmitToPrintcom`) routes to
`pod2-order-submit` when the flag is true and `pod2-submit-to-printcom`
(legacy) when false.

---

## Code map

| Layer | File |
|-------|------|
| Real adapter (single POST /orders) | `supabase/functions/pod2-order-submit/index.ts` |
| Legacy adapter (fictional 7-step, kept) | `supabase/functions/pod2-submit-to-printcom/index.ts` |
| Feature flag | `src/lib/api/featureFlags.ts` |
| Job creation (sender snapshot) | `supabase/functions/pod2-create-jobs/index.ts` |
| Tenant settings UI | `src/components/admin/TenantPodShippingProfile.tsx` + `ShopSettings.tsx` |
| Master admin UI + inline result panel | `src/pages/admin/Pod2Ordrer.tsx` |
| React hooks + error unwrapping | `src/lib/pod2/hooks.ts` → `usePodSubmitToPrintcom` |
| Types | `src/lib/pod2/types.ts` — `PodFulfillmentJob.printcom_*` fields |
| DB migrations | `supabase/migrations/20260417090000_*.sql`, `20260417100000_*.sql` |

---

## White-label sender resolution (unchanged)

At job creation time in `pod2-create-jobs`:

1. Per-order override in `orders.status_note` wins (`AFSENDER:` tag).
2. Otherwise look up `tenant_pod_shipping_profile` for the tenant.
3. If the profile's `sender_mode !== 'standard'`, snapshot it onto the job.
4. Default = `standard` — no sender snapshot; Print.com ships in its own
   branding.

The new adapter only emits `item.senderAddress` when
`sender_mode === 'custom'` and `sender_address_json` is present.
`stickySlipImageUrl` is set whenever `sender_logo_url` is present on the job.

---

## Known gaps / not-yet-built

- **No curation UI.** Adding a new Print.com SKU to the catalog requires
  hand-writing `supplier_product_data` via SQL. Next task is
  `pod2-get-price` + a master-only curation form that introspects the
  Print.com product's `properties[]` and lets the operator pick which to
  fix and which to map from customer config.
- **No Print.com cancel from our UI.** Print.com's cancel/delete endpoints
  sit behind a different (SigV4-style) auth that the public `PrintApiKey`
  can't invoke. Operators cancel via **platform.print.com** directly.
- **`dryRun` is all-or-nothing** — it skips the `POST /orders` call entirely.
  Unlike the legacy pipeline it does **not** create dangling carts/contacts on
  Print.com's side, because nothing is created until the final POST.
- **File URL must be publicly fetchable by Print.com.** The adapter uses the
  current `order_files.file_url` — if that ever becomes a private Supabase
  Storage URL, this will need a signed URL step.
- **File validation is Print.com's job.** The submission succeeds structurally
  even if the attached file is nonsense (we proved this — a logo PNG went
  through). Print.com holds the order at `MANUALCHECK` and rejects in their
  own review. Don't assume a green card means the file is good.
- **Legacy pipeline still deployed** at `pod2-submit-to-printcom`. Keep it
  until several real orders have been processed by the new adapter without
  incident, then remove.

---

## First live run checklist

### Prereqs (do once)
1. `supabase secrets set` the eleven `PRINTCOM_BILLING_*` env vars to
   WebPrinter's own address + VAT.
2. Confirm `pod2_supplier_connections` has one `is_active = true` row with
   `base_url = https://api.print.com` and
   `auth_header_mode = 'authorization_printapikey'`.
3. Curate at least one catalog product's `supplier_product_data` with a real
   Print.com SKU. Validate slugs against
   `GET https://api.print.com/products/{sku}`.

### Per-run
1. Share the catalog product to a tenant via the existing product-transfer
   flow.
2. Tenant configures `POD afsender-identitet` (if they want custom branding)
   and receives a customer order.
3. Tenant approves + pays through `/admin/pod2-ordrer`.
4. Master at `/admin/pod2-ordrer` → **Videresend** → ensure **Dry run** is
   checked → **Test (dry run)**.
5. Blue card appears. Read the options list — every slug must match
   Print.com's schema. If anything looks wrong, fix `supplier_product_data`
   (no redeploy needed — env/DB changes are live).
6. Uncheck Dry run → **Send til Print.com**.
7. Green card = success. Print.com order id is in the card and in
   `pod2_fulfillment_jobs.printcom_order_id`. Red card = the message tells you
   which option/field Print.com rejected; fix and retry.

---

## Verification run on 2026-04-20

- Test job: `aaaa0000-0000-0000-0000-000000000003` (synthetic seed).
- Catalog: `printed-letterheads` @ NL, digital printing, 25 copies.
- Result: Print.com order id `2106321` / order number `6002102581`, total
  213.94 DKK, status `ORDERRECEIVED` → `MANUALCHECK` (as expected; test file
  was a PNG logo, not a real PDF).
- Cancelled manually via platform.print.com.

Every layer verified: auth, master-only gate, option translation, sender
address, billing, `stickySlipImageUrl`, real Print.com pricing, dry-run mode,
error unwrapping.
