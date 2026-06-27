# Supabase Function Security Inventory - 2026-06-27

This inventory was created as a non-destructive hardening step. It classifies
the current Supabase Edge Functions by intended exposure and next action.

Current function count observed locally: 50 directories under
`supabase/functions`.

Superpowers execution plan:
- `docs/superpowers/plans/2026-06-27-edge-function-hardening-phase-1.md`

Phase 1 implementation now makes every function exposure decision explicit in
`supabase/config.toml`.

Public/no-JWT functions:
- `send-contact-message`
- `stripe-subscription-webhook`

All other local function directories currently have `verify_jwt = true`.

The safest posture remains: make function exposure intentional in config and in
code, and keep local/dev-only functions guarded even when JWT is required.

## Phase 1 Implementation Status

Completed:
- Shared Edge Function HTTP/auth/local-only helpers added.
- Local/dev-only functions guarded with `requireLocalOnly(req)`.
- Function exposure checker added as `npm run check:supabase-functions`.
- Supabase function `verify_jwt` config made explicit for all 50 function
  directories.

Remaining:
- Server-side Stripe checkout amount recalculation.
- PDF service ownership, size, and URL restrictions.
- Supplier API key server-side encryption/write path.
- Function-by-function migration to shared auth helpers beyond Phase 1.

## Classification

| Function | Category | Current risk | Recommended action |
| --- | --- | --- | --- |
| `calculate-machine-price` | Pricing/server calculation | Uses service role; pricing-sensitive. | Keep authenticated or server-only. Add explicit config and typed input validation before production reliance. |
| `catalog-read` | Public read | Uses service role for tenant/catalog reads. | Keep public/read-only if needed, but validate tenant inputs and keep response shape stable. |
| `create-admin-user` | Local/dev-only admin tool | Uses service role and Auth admin APIs. Phase 1 added local-only and master-admin gates. | Keep guarded; do not deploy as a normal production endpoint. |
| `designer-pdf-service` | Future PDF service | Hardened with auth, HTTPS/private-host rejection, PDF header checks, and 25 MB limit. Still accepts remote URLs. | Prefer Supabase storage-object inputs before broad production reliance. Add rate limits before heavy OCR/compress providers. |
| `icon-studio-generate` | Authenticated AI generation | Checks auth and role/module access; uses AI keys and service role. | Good candidate for shared auth helper. Add request size/rate limits if not already covered. |
| `platform-pagespeed` | External public utility | Calls PageSpeed API from caller-provided URL. | Add allowed host/tenant checks before exposing broadly. |
| `platform-sitemap` | Public read | Likely public platform output. | Keep public if read-only; document intended public status. |
| `pod-create-jobs` | Authenticated POD workflow | Checks user and roles; uses service role for job creation. | Keep admin/tenant-gated. Add explicit config. |
| `pod-explorer-request` | Authenticated supplier proxy | Checks user/roles; proxies supplier API. | Keep admin-gated. Validate paths and provider response shape. |
| `pod-shipping-possibilities` | Supplier lookup | Uses service role and supplier API. | Verify intended caller. Add auth/tenant gate if not public. |
| `pod-tenant-approve-charge` | Authenticated billing/POD | Checks user/roles; uses Stripe and service role. | Keep admin/tenant-gated. Add explicit config. |
| `pod-tenant-billing-setup` | Authenticated billing/POD | Checks user/roles; uses Stripe and service role. | Keep admin/tenant-gated. Add explicit config. |
| `pod-tenant-import` | Authenticated POD import | Checks user/roles; writes product/pricing data. | Keep admin/tenant-gated; preserve POD v1 rules. |
| `pod-tenant-merge` | Authenticated POD merge | Checks user/roles; mutates product/pricing structures. | Keep admin/tenant-gated; require careful review before changes. |
| `pod-tenant-remove` | Authenticated destructive POD cleanup | Checks user/roles; deletes POD-imported records. | Keep gated and document delete order. Do not broaden access. |
| `pod2-create-jobs` | Checkout/order-driven POD v2 | Comment says order existence is authorization; uses service role. | Review ownership and order status checks before production reliance. |
| `pod2-explorer-request` | Authenticated supplier proxy | Checks user/roles; proxies supplier API. | Keep admin-gated. Validate paths and provider response shape. |
| `pod2-master-forward` | Authenticated master/admin POD v2 | Checks user/roles; updates fulfillment jobs. | Keep admin-gated. Add explicit config. |
| `pod2-order-submit` | Authenticated POD v2 submit | Checks user/roles; submits to Print.com and mutates jobs. | Keep master/admin-gated. Validate supplier responses. |
| `pod2-pdf-preflight` | File processing/POD v2 | Hardened with auth, product tenant access checks, HTTPS/private-host rejection, storage path validation, and 50 MB auto-fix limit. Still depends on public PDF URLs for Print.com. | Move toward storage-path-only inputs and signed URLs so caller-provided URLs are not part of the contract. |
| `pod2-printcom-sync-status` | Authenticated supplier sync | Checks user/roles; updates jobs. | Keep admin-gated. Add explicit config. |
| `pod2-submit-to-printcom` | Authenticated supplier submit | Checks user/roles; uploads files/logos to Print.com. | Keep admin-gated. Verify file ownership and URL restrictions. |
| `pod2-tenant-approve-charge` | Authenticated billing/POD v2 | Checks user/roles; uses Stripe and service role. | Keep admin/tenant-gated. Add explicit config. |
| `pod2-tenant-billing-setup` | Authenticated billing/POD v2 | Checks user/roles; uses Stripe and service role. | Keep admin/tenant-gated. Add explicit config. |
| `pod2-tenant-import` | Authenticated POD v2 import | Checks user/roles; writes product/pricing data. | Keep additive/POD v2-only. Do not alter core pricing without approval. |
| `pod2-tenant-merge` | Authenticated POD v2 merge | Checks user/roles; mutates products/prices. | Keep admin-gated; require focused tests before changes. |
| `pod2-tenant-remove` | Authenticated destructive POD v2 cleanup | Checks user/roles; deletes imported data. | Keep gated and follow POD v2 delete order. |
| `pod2x-printcom-proxy` | Authenticated supplier proxy | Calls `auth.getUser`; proxies Print.com. | Ensure role/module gate exists before broad use. Validate allowed paths. |
| `pod3-flyeralarm-request` | Supplier/demo proxy | Uses demo token; no auth signal found in quick scan. | Treat as local/demo-only or add auth/tenant gate before exposing. |
| `pricing-read` | Public read | Uses service role for pricing reads. | Public read is acceptable if response is intended; keep calculation read-only and stable. |
| `product-detail-read` | Public read | Uses service role for product reads. | Public read is acceptable if tenant scoping is strict. |
| `search-console` | Platform SEO OAuth/API | Uses Google secrets and service role. | Make master-admin-only; validate OAuth state and redirect behavior. |
| `seed-folder-prices` | Local/dev seed tool | Uses service role and upserts pricing. Phase 1 added a local-only guard. | Keep guarded; consider moving out of deployable functions later. |
| `seed-generic-prices` | Local/dev seed tool | Uses service role and upserts pricing. Phase 1 added a local-only guard. | Keep guarded; consider moving out of deployable functions later. |
| `seed-product-prices` | Local/dev seed tool | Uses service role; deletes and upserts pricing data. Phase 1 added a local-only guard. | Keep guarded; highest priority to keep out of normal production use. |
| `send-contact-message` | Public form | Explicitly public; uses Resend and service role for tenant recipient lookup. | Keep public with rate limits. Consider provider-backed rate limit/captcha if abused. |
| `send-order-email` | Order email | Uses Resend; quick scan did not show auth. | Verify intended caller. Add order ownership/server-only trigger before production use. |
| `send-quote-emails` | Authenticated quote email | Explicit JWT required, but rate key uses untrusted `x-user-id`. | Derive rate key from verified user/session, not caller header. |
| `setup-schema` | Local/dev schema setup | Creates policies/schema. Phase 1 added a local-only guard. | Keep guarded; consider moving out of deployable functions later. |
| `stripe-connect-account-session` | Authenticated Stripe Connect | Checks auth/roles; uses Stripe/service role. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-connect-create-or-get` | Authenticated Stripe Connect | Checks auth/roles; uses Stripe/service role. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-connect-disable` | Authenticated Stripe Connect | Checks auth/roles; updates tenant payment settings. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-connect-sync-status` | Authenticated Stripe Connect | Checks auth/roles; updates tenant payment settings. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-create-payment-intent` | Checkout/payment | Uses Stripe/service role and trusts client amount/tenant. | Recalculate amount server-side from order/quote/product selections. |
| `stripe-subscription-create-checkout` | Authenticated subscription billing | Checks auth/roles; uses Stripe/service role. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-subscription-create-portal` | Authenticated subscription billing | Checks auth/roles; uses Stripe/service role. | Keep admin/tenant-gated. Add explicit config. |
| `stripe-subscription-webhook` | Stripe webhook | Uses Stripe signature and service role. | Keep public webhook route; verify signature and no JWT requirement. |
| `tenant-context-read` | Public/context read with optional auth | Uses service role; optionally reads auth/user roles. | Keep read-only; document public fields and avoid leaking admin-only data. |
| `test-env` | Local/dev diagnostic | Phase 1 changed this to guarded boolean-only environment presence. | Keep guarded or remove later. |
| `verify-admin` | Auth verification helper | Explicit JWT required; checks `user_roles`. | Keep. Prefer reusing this pattern in other admin functions. |

## Highest-Value Safe Next Steps

1. Replace `stripe-create-payment-intent` with a server-calculated amount
   contract.
2. Continue PDF hardening by replacing caller-provided URLs with server-resolved
   storage objects or signed URLs.
3. Add a shared auth/role helper for Edge Functions, then migrate admin/service
   functions gradually.
4. Keep local/dev-only functions guarded and consider moving them out of
   `supabase/functions` later.

## Suggested Exposure Policy

Use this policy when reviewing or deploying functions:

| Exposure | Requirements |
| --- | --- |
| Public read | Read-only, tenant scoped, typed inputs, stable response shape. |
| Public form | Strict validation, rate limiting, no service-role mutation except narrow server-owned write/send. |
| Authenticated user | JWT required, derive user from verified token, no trusted caller headers. |
| Tenant admin | JWT required, role/tenant ownership checked server-side. |
| Master admin | JWT required, `master_admin` checked server-side. |
| Webhook | Provider signature verified; no browser CORS dependency. |
| Local/dev-only | Not deployed, or hard-gated by deployment secret plus production hard stop. |

## Notes

- The current repo config explicitly marks all 50 function directories observed
  locally.
- This inventory is based on static local code inspection, not live Supabase
  deployment state.
- Phase 1 code changes guarded local/dev-only functions; this inventory is not a
  live deployment audit.
