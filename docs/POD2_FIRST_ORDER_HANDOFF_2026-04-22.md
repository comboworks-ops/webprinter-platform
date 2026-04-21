# POD v2 First Real Order Handoff — 2026-04-22

Checkpoint after the first real POD v2 order successfully flowed
tenant → master → Print.com. Use this as the entrypoint for the next
session picking up on POD v2 work.

## 1. Read this first

Before changing POD v2 code, read in this order:
- `POD2_README.md`
- `AI_CONTINUITY.md`
- `.agent/HANDOVER.md`
- `docs/POD2_WHITE_LABEL_HANDOVER.md`
- this document

## 2. What shipped this session

All commits on `main`, pushed to Vercel.

### Checkout / payments
- **Stripe Connect flow switched from direct charges to destination
  charges** (`stripe-create-payment-intent`). PI now lives on the
  platform account; funds transfer via `transfer_data.destination` +
  `on_behalf_of`. Client uses the plain platform publishable key — no
  `stripeAccount` option, no Elements remount traps. Commit `3c28bdc`.
- `automatic_payment_methods: { enabled: true }` set explicitly on both
  connected and platform-only PI paths.
- Memoized `loadStripe` in `StripePaymentForm` as a belt-and-suspenders
  guard against Elements remounting. Commit `552f8f0`.

### POD v2 fulfillment
- **Auto-create job at checkout** — POD products now create the POD v2
  fulfillment job automatically right after order insert, so tenants no
  longer need to click "Opret job fra ordre". Fire-and-forget; manual
  button kept as fallback. (`FileUploadConfiguration.tsx`)
- **Dropped role gate on `pod2-create-jobs`** — checkout invokes it as
  an anonymous customer, so the admin role check was silently 403'ing.
  The orderId itself is the authorization (tenant_id, product, qty all
  come from the order row; idempotent via the existing-job check).
  Commit `4e4bbc1`.
- **`pod2_auto_forward` flag on tenants** — when true, POD v2 jobs skip
  the tenant approve+charge gate and go straight to `status=paid` for
  master forwarding. Intended for self-owned tenants
  (onlinetryksager.dk, salgsmapper.dk) where charging yourself is pure
  Stripe-fee burn. Master-only toggle. Migration
  `20260421000000_tenants_pod2_auto_forward.sql`.
- **Variant signature stripped from POD v2 Ordrer UI** — shows
  `product_name × qty` and order ref instead of the Print.com slug
  dump.
- **Delivery fields written to orders row** — checkout now persists
  `delivery_address`, `delivery_zip`, `delivery_country` (was only
  saving `delivery_city` and a `[LEVERING]` status_note tag). Without
  this, the Print.com shipment address came out with empty
  street/postcode. Commit `01bd712`.

### Print.com submission (`pod2-order-submit`)
- **Passthrough fallback for uncurated catalog products** — when
  `supplier_product_data` has no `attribute_map` or `fixed_options`,
  the variant_signature is forwarded to Print.com as-is. Works because
  POD v2 variant signatures are already in Print.com's native slug
  vocabulary. Emits a warning in the dry-run output so we know
  curation is pending. Commit `01bd712`.
- **`copies` option injected from `qty`** — Print.com's `/orders`
  validator requires `options.copies` alongside the item-level
  `quantity`. Default to qty when the signature/curation doesn't
  provide it. Commit `4ee2487`.
- **Retry gate loosened** — jobs at `status=submitted` with
  `printcom_order_id = null` can retry. Covers the case where "Marker
  som videresendt manuelt" flipped status without actually calling
  Print.com. Commit `4bd1a46`.

### Admin UX
- Admin order detail shows parsed delivery address, recipient,
  recipient company, shipping method, sender mode, billing — all
  pulled from `[LEVERING]`, `[MODTAGER]`, `[MODTAGER-FIRMA]`,
  `[LEVERINGSMETODE]`, `[AFSENDER]`, `[FAKTURERING]` status_note tags.
- Leveringsmetode editable inline; save syncs the `[LEVERINGSMETODE]`
  tag back into `status_note`.

## 3. First successful order

- Order number: `WP260421-792470`
- Order id: `a3536358-54ba-42b6-b5ee-15deeef3c0f4`
- POD v2 job: `65d81a63-aca0-4c46-bb6e-fd95ff6eb2b6`
- Tenant: onlinetryksager (`7cb851f5-c792-40b1-a79a-1f7c7b5f668c`)
- Product: flyers × 50, A5, 135gr gesatineerd MC
- Sender: custom white-label = Onlinetryksager
- Status: `submitted`, Print.com order id stored in
  `pod2_fulfillment_jobs.printcom_order_id`

## 4. Env flags currently in play

- `VITE_USE_POD2_ORDER_SUBMIT` (client) — default `true`, routes
  submission to `pod2-order-submit` (new single POST). Set to `false`
  to fall back to legacy `pod2-submit-to-printcom` (7-step pipeline).
  Both edge functions remain deployed.
- `pod2_auto_forward` (DB column on `tenants`) — enabled for
  onlinetryksager and salgsmapper. Toggles approve+charge bypass.
- `PRINTCOM_BILLING_*` (edge function env) — master billing address
  used in `pod2-order-submit`. Falls back to sensible defaults if
  unset.

## 5. Follow-ups, ordered by value

1. **Print.com webhook handler** — incoming webhook to flip
   `pod2_fulfillment_jobs.status` from `submitted` → `processing` →
   `completed` as Print.com produces and ships the order. Right now
   jobs sit at `submitted` forever. New edge function
   `pod2-printcom-webhook`.
2. **PDF-only preflight for POD v2 checkout** — the first order
   shipped as PNG and Print.com accepted it, but this won't hold for
   all products. Either enforce PDF upload in
   `FileUploadConfiguration.tsx` for POD v2 products, or auto-convert
   PNG/JPG → print-ready PDF (CMYK, bleed, DPI) before creating the
   job. `pod2-pdf-preflight` is scaffolded but not deployed.
3. **Master curation UI for catalog products** — `pod2-get-price` +
   curation of `attribute_map` and `fixed_options` on
   `pod2_catalog_products.supplier_product_data`. Today we're relying
   on passthrough, which works because variant signatures already
   match Print.com vocabulary, but any Print.com schema drift would
   break us silently.
4. **"Marker som videresendt manuelt" footgun** — the manual fallback
   button in the forward dialog flips status to `submitted` without
   calling Print.com, indistinguishable from a real submission in the
   job list. Add a confirmation, relabel, or hide behind a disclosure
   unless the operator explicitly needs it.
5. **Designer → preview handoff** — preserve changes when returning
   to order page (carry-over from pre-launch todo list).
6. **Audit + enable designer setup on missing products**
   (carry-over).
7. **Clean up synthetic test rows** (carry-over).

## 6. Known quirks / gotchas

- `pod2-order-submit` writes `printcom_last_error` but not the full
  request payload on failure — if you need to reproduce a rejection,
  re-run the dry-run with the same job.
- The passthrough warning (`No curated attribute_map — forwarding
  variant_signature to Print.com as-is`) is surfaced in the dry-run
  output but not in the submitted-job list. Once curation is done,
  this warning disappears.
- Checkout auto-create is fire-and-forget — if `pod2-create-jobs`
  fails, the customer still sees a success page. The "Opret job fra
  ordre" button in POD v2 Ordrer is the manual backfill path. The
  role gate is dropped, so tenant admins and master admins can both
  run it.
- Stripe destination charges: the tenant's Stripe dashboard will show
  the transfer, not a direct payment. The customer sees the
  platform's statement descriptor by default unless overridden.

## 7. Key files

- `supabase/functions/stripe-create-payment-intent/index.ts`
- `supabase/functions/pod2-create-jobs/index.ts`
- `supabase/functions/pod2-order-submit/index.ts`
- `supabase/functions/pod2-master-forward/index.ts`
- `src/components/checkout/StripePaymentForm.tsx`
- `src/pages/FileUploadConfiguration.tsx`
- `src/pages/admin/Pod2Ordrer.tsx`
- `src/components/admin/OrderManager.tsx`
- `supabase/migrations/20260421000000_tenants_pod2_auto_forward.sql`
