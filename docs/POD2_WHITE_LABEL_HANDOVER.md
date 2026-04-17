# POD v2 White-Label + Print.com Submission — Handover

**Date:** 2026-04-17
**Status:** Deployed to Supabase (DB + edge function). Frontend shipped with the
`feat(pod2): tenant white-label sender + automated Print.com submission` commit.
**Risk level:** Moderate. The submission pipeline is idempotent and resumable,
but the first few live runs should be watched.

---

## What this ships

Two paired changes that complete the POD v2 tenant fulfillment loop:

1. **Tenant white-label** — each tenant shop can configure a sender identity
   (company name, contact, address, logo) and a `sender_mode`
   (`standard` | `blind` | `custom`). That identity is snapshotted onto every
   POD fulfillment job at creation time.

2. **Automated Print.com submission** — the master admin can push a paid POD job
   straight to Print.com via the new `pod2-submit-to-printcom` edge function.
   The previous "Videresend" flow (master copies details into Print.com
   manually) is kept as a dashed-border fallback inside the same dialog.

---

## User-facing surfaces

### Tenant shop admin
`ShopSettings` → new **POD afsender-identitet** card
(`TenantPodShippingProfile.tsx`).

Fields:
- `sender_mode` radio: standard / blind / custom
- All address + contact fields + logo upload (Supabase Storage bucket)
- Fields greyed out when mode = `standard`

### Master admin
`/admin/pod2-ordrer` → per-job **Videresend** dialog now shows:
- **Primary block**: "Send til Print.com"
  - `paymentMethod` picker (default `invoice`, alt `psp`)
  - `dryRun` checkbox for smoke-testing
  - Running step + last error shown inline while the job progresses
- **Fallback block** (dashed border): legacy manual forward

---

## Data model

### New table: `tenant_pod_shipping_profile`
PK = `tenant_id`. RLS: tenant can CRUD own row; master can read all.

Columns: `sender_mode`, `sender_company_name`, `sender_contact_name`,
`sender_email`, `sender_phone`, `sender_street`, `sender_house_number`,
`sender_postcode`, `sender_city`, `sender_country`, `sender_vat_number`,
`sender_logo_url`, `printcom_contact_id` (text — Print.com IDs are opaque),
`printcom_sticky_slip_id` (text — logo upload handle).

Migration: `20260417090000_pod2_tenant_shipping_profile_remote_applied.sql`.

### New columns on `pod2_fulfillment_jobs`
Snapshot of sender at job creation:
- `sender_address_json` (jsonb) — full address snapshot (custom mode only)
- `sender_logo_url` (text) — always carried if the profile has one

Print.com submission state:
- `printcom_cart_id`, `printcom_cart_item_id`, `printcom_printjob_id`,
  `printcom_design_id`, `printcom_order_id`
- `printcom_order_raw` (jsonb) — full Print.com order response for audit
- `printcom_submission_step` enum: `contact | logo | cart | sender | files |
  finalize | submit | null`
- `printcom_last_error` (text), `printcom_last_attempt_at` (timestamptz)

Migration: `20260417100000_pod2_printcom_linkage_remote_applied.sql`.

---

## Submission pipeline

`supabase/functions/pod2-submit-to-printcom/index.ts`. Idempotent 7-step
pipeline, stored step by step in `printcom_submission_step`. Failure persists
`printcom_last_error` + step — next invocation resumes from the last successful
step.

| Step | Writes | Notes |
|------|--------|-------|
| `contact` | `tenant_pod_shipping_profile.printcom_contact_id` | POST /contacts |
| `logo` | `tenant_pod_shipping_profile.printcom_sticky_slip_id` | 2-step presigned S3 via `/stickyslip/retrieveUploadUrl` |
| `cart` | `printcom_cart_id`, `printcom_cart_item_id`, `printcom_printjob_id`, `printcom_design_id` | POST /carts + add item |
| `sender` | — | PATCH cart item with sender address + logo sticky slip |
| `files` | — | Upload customer print files (fetched from `order_files` table, public URL → 2-step presigned S3 via `/printjob/{id}/uploadEndpoints`) |
| `finalize` | — | Lock down cart item |
| `submit` | `printcom_order_id`, `printcom_order_raw`, job.status → `submitted` | POST /orders with `paymentMethod` (invoice/psp) |

### Invocation
```ts
// src/lib/pod2/hooks.ts
const { mutateAsync } = usePodSubmitToPrintcom();
await mutateAsync({ jobId, paymentMethod: 'invoice', dryRun: false });
```

### Auth
Reuses `pod2_supplier_connections` (same pattern as `pod2-explorer-request`).
Tries bearer token; falls back to `X-API-Key` on 401.

### Master-only
The edge function hard-checks `user_id === master UUID
(00000000-0000-0000-0000-000000000000)` before doing anything.

### Idempotency
- Every sub-step first calls `refreshJob()` and skips if the relevant linkage
  column is already populated.
- Safe to retry a failed job from the UI without creating duplicate carts or
  contacts.

---

## Code map

| Layer | File |
|-------|------|
| DB migrations | `supabase/migrations/20260417090000_*.sql`, `20260417100000_*.sql` |
| Edge function | `supabase/functions/pod2-submit-to-printcom/index.ts` |
| Job creation (snapshot) | `supabase/functions/pod2-create-jobs/index.ts` (tenantProfile lookup) |
| Tenant settings UI | `src/components/admin/TenantPodShippingProfile.tsx` + `ShopSettings.tsx` wire-up |
| Master admin UI | `src/pages/admin/Pod2Ordrer.tsx` |
| React hooks | `src/lib/pod2/hooks.ts` — `usePodSubmitToPrintcom`, `usePodMasterForwardJob` (kept as fallback) |
| Types | `src/lib/pod2/types.ts` — `PodFulfillmentJob.printcom_*` fields |

---

## How the white-label snapshot is resolved

At job creation time in `pod2-create-jobs`:

1. If the order's `status_note` has an explicit `AFSENDER-LÆGE` /
   `AFSENDER:` tag, that per-order override wins.
2. Otherwise look up `tenant_pod_shipping_profile` for the tenant.
3. If profile exists and `sender_mode !== 'standard'`, snapshot it onto the job.
4. `sender_logo_url` is always carried if the profile has one — the submission
   adapter decides per-mode whether to actually attach it.
5. Default = `standard` (no snapshot, Print.com uses its own branding).

---

## What I didn't do / known gaps

- **No retry UI for mid-pipeline failures.** The dialog surfaces the failing
  step + error, and clicking "Send til Print.com" again will resume — but there
  is no explicit "retry" button or manual step-skip override.
- **No test coverage.** This is by design — Print.com has no sandbox worth
  shelling out for, and mocking the 7-step flow would be theater.
- **Logo upload** assumes the `sender_logo_url` is a public Supabase Storage
  URL. If it ever becomes private, the edge function will need a signed URL.
- **`dryRun` is all-or-nothing** — it skips the final `POST /orders` only.
  Contact / cart / files still get created on Print.com's side.
- **Master-only enforcement** is done in the edge function, not in RLS on the
  tenant table. The tenant can always read/write their own profile regardless.
- **Column `printcom_contact_id` is `text`, not `uuid`.** Print.com returns
  opaque string IDs. Don't try to `::uuid` cast them.

---

## First live run checklist

1. As tenant admin on a shop with a POD product: open `ShopSettings` → POD
   afsender-identitet. Pick `custom`, fill address, upload logo, save.
2. As a customer: place an order on that shop's POD product through normal
   checkout. Pay.
3. As master at `/admin/pod2-ordrer`: the job should show with
   `sender_mode=custom` and the tenant's address snapshot.
4. Click **Videresend** → **Send til Print.com** → leave payment = invoice →
   check `dryRun` on first attempt.
5. Expected progression: `contact → logo → cart → sender → files → finalize`
   then stop (dry run). Inspect the Print.com cart in their dashboard.
6. If that looks right, uncheck `dryRun` and re-run — same job resumes, hits
   `submit`, creates an order, job.status → `submitted`,
   `printcom_order_id` populated.

If any step fails, `printcom_last_error` has the diagnostic. The failing step
is the one currently in `printcom_submission_step` — retry once the root cause
is fixed; the function will resume from that step.
