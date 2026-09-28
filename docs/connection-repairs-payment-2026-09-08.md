# Storefront payment connection repairs — 8 September 2026

## Result and boundary

Local contract v2 prepares an immutable production-file copy and durable checkout snapshot before creating a PaymentIntent. The browser completion endpoint and signed webhook use the same atomic database finalizer. A paid order and its file rows either commit together or remain retryable; duplicate callbacks share one order/payment identity. Address line 2 and ISO country are preserved. This work has not been deployed and no Stripe payment, hosted upload, business-data write or hosted migration was performed.

The change intentionally remains **disabled by default**. The follow-up [server quote repair](connection-repairs-pricing-2026-09-08.md) now supports configured STORFORMAT, uniquely stored fixed/rate/matrix prices and verified per-area options. Unsupported or incomplete pricing setups still stop before payment. POD v1/v2 pricing and supplier submission code are unchanged.

## Files and contract

- `supabase/functions/stripe-create-payment-intent/index.ts`: v2 creator and existing generic quote calculation with strict tenant/product/published, unambiguous quantity match, exact client/server amount and delivery checks. Browser metadata cannot override protected Stripe metadata.
- `supabase/functions/stripe-finalize-checkout/index.ts`: authenticated-account or guest recovery-token completion/cancellation; retrieves Stripe state server-side.
- `supabase/functions/stripe-storefront-webhook/index.ts`: verifies Stripe signature over raw bytes, handles only storefront-v2 `payment_intent.succeeded`, and returns non-2xx on failed finalization so Stripe retries.
- `supabase/functions/_shared/storefrontCheckout.ts`, `storefrontCheckoutRuntime.ts`: input, identity, amount/currency/mode/destination checks; immutable artifact copying and shared finalization.
- `supabase/migrations/20260908171743_storefront_checkout_finalization.sql`: CLI-generated additive migration, service-only attempt/cancellation tables, service-only invoker RPCs, unique order/payment references and protected immutable storage paths.
- `src/lib/checkout/checkoutArtifact.ts`: SHA-256 over the exact approved artifact bytes. The parent repair integrates the frontend and recovery UI separately.

Create body:

```ts
{
  contract_version: 2,
  checkout_attempt_id: UUID,
  checkout_access_token: UUID, // independently generated, retained across return/retry
  tenant_id: UUID,
  amount_ore: integer,
  currency: "dkk",
  checkout_quote: existingSelection,
  checkout_order: {
    customer_email, customer_name, customer_phone?, delivery_type?,
    delivery_address, delivery_address2?, delivery_zip, delivery_city,
    delivery_country, // two-letter ISO code
    product_configuration?, status_note?,
    files: [{file_name, storage_path, bucket: "order-files", sha256}]
  }
}
```

Create returns `contract_version:2`, `checkout_attempt_id`, `payment_intent_id`, `client_secret`, `connected:false` and platform/destination mode. Destination charges continue to use the platform client. The frontend must reject old responses before exposing a payment form. An old deployed creator could still create an **unpaid** legacy intent before that response rejection; source compatibility is not deployed compatibility.

Finalize body contains `checkout_attempt_id`, `checkout_access_token` and optional known `payment_intent_id`. `action:"cancel"` requests cancellation. Only finalizer `success:true` plus a returned `order.id`/`order_number` permits an order-received screen. The returned order includes durable `checkout_receipt {productName,quantity,fileName,subtotal,shipping,total}` and `checkout_context {productId,podV2}` for optional existing downstream actions. It does not assert email, POD dispatch or invoice delivery.

The server derives `user_id` from Auth. Guest recovery uses possession of the separate random token; it never claims guest orders by matching email. A signed-in attempt requires its original account plus token. Amount, tenant, request hash, currency, Stripe account destination, test/live mode and PaymentIntent identity are checked server-side.

The same UUID and token must be retried with identical details. Changing an open checkout requires definitive server cancellation before a fresh UUID. A never-started attempt can also be cancelled: a service-only tombstone and shared transaction lock prevent a delayed creator from inserting it afterward. An unbound intent older than 23 hours requires reconciliation, because Stripe may prune idempotency records after 24 hours. Uncertain payment binding/cancellation must retain recovery information.

## Production artifact behavior

Only existing public `order-files` uploads under `order-files/<filename>` and `designer-production/<filename>` are accepted. The server performs an unauthenticated public read of its own Storage origin, follows no redirects, checks the submitted SHA-256, then copies the bytes to `checkout-finalized/<attempt>/<index>-<sha256>.<extension>` with `upsert:false`. Retried uploads accept only the same bytes. A Storage metadata trigger blocks customer inserts into that namespace and blocks updates/deletes even by the normal service-role path. Copies are prepared before the PaymentIntent is issued.

Each artifact is limited to 25 MiB and eight artifacts per checkout. The existing bucket's public visibility is preserved; these checks prove which bytes were approved and retained, not ownership of a pre-existing publicly readable upload. They do not change the broader public-file privacy model. Actual hosted Storage API upload/overwrite/delete and object-cache behavior still require acceptance testing; the SQL fixture proves the database trigger behavior only.

The main repair must hash the approved output, not the untransformed input of a changed proof preview. This payment contract does not itself render PDF placement or verify physical print dimensions. Optional production side files remain attached, with the first row current to preserve the existing order-files representation.

## Verified locally

At completion of this subtask:

- 10 pure/runtime tests at the follow-up checkpoint: address preservation, valid artifact paths/hashes, stable snapshot identity, exact payment amount/currency/tenant/mode/destination, denied/missing finalizer result, duplicate callback identity, approved-byte changes, durable display receipt and scoped confirmation status. Model/publication checks now live in the quote suite.
- 8 tests execute the actual creator/finalizer/webhook handler bodies with synthetic Stripe/Supabase adapters: idempotent reuse, changed request rejection, stale unbound attempt hold, old client/disabled release, wrong recovery token, processing-payment cancellation hold, cancellation racing successful payment, webhook raw-body/signature-gate behavior, database failure returning a retryable response and duplicate/legacy events. Follow-up tests cover first STORFORMAT and generic per-area quote creation. Signature cryptography is stubbed; these tests make no real Stripe requests. The separate pricing report records 11 more quote tests.
- 6 real PostgreSQL 17 offline fixture tests: three simultaneous callbacks yield one order and one file; a file insert failure rolls back order and completion state, then retry works; two synthetic shops/customers persist separately; anonymous/customer direct access denied; forged amount/reference and order identity mutation denied; immutable artifact metadata cannot change; cancelled absent attempt cannot later insert.
- Changed-migration grants check passes. Function exposure check passes. New edge entrypoints pass Node TypeScript syntax parsing. This is not a Deno edge deployment or hosted gateway test.

Reproduce with the bundled Node binary (or a compatible Node supporting type stripping):

```sh
node --experimental-strip-types --test supabase/functions/_shared/storefrontCheckout.test.ts supabase/functions/_shared/storefrontCheckoutHandlers.test.ts
CHECKOUT_TEST_CONTAINER=<disposable-postgres-container> node --test supabase/tests/storefrontCheckoutDb.test.mjs
node scripts/check-supabase-migration-grants.js
node scripts/check-supabase-function-exposure.js
```

The PostgreSQL harness requires an existing disposable local container. It creates/drops only its unique `checkout_repair_<pid>` database; it has no project credentials, external network connection, mounted business data or published ports. Test role schemas are intentionally synthetic and do not reproduce every existing hosted trigger/RLS rule.

Read-only live metadata confirmed the current order/file columns and product pricing types before authoring the migration. No inference is made that production now has these new objects.

## Remaining release work

1. Review the matched frontend, all three edge functions, shared helpers, config and additive migration. Apply first to a designated staging backend and run advisors/grants plus the combined account-file migration acceptance. Existing broad customer `order_files` INSERT policy closure is provided by the separate account repair.
2. Supply test-mode Stripe credentials and register a dedicated webhook endpoint for `payment_intent.succeeded`, with event API version matching the configured Stripe API version. Set `STOREFRONT_CHECKOUT_WEBHOOK_SECRET` to that endpoint's signing secret. Keep `verify_jwt=false` only for the signature-authenticated webhook; creator/finalizer retain the JWT gateway and their own application authorization.
3. Deploy all three functions and frontend, verify actual deployed source/version, then explicitly set `STOREFRONT_CHECKOUT_ENABLED=true` only in the staging proof environment. The kill switch blocks new intents; completion and reconciliation remain available when disabled.
4. Complete two actual test-shop/two-account journeys through Auth, Storage and Stripe test mode. Include server quote parity for supported matrix products, 3DS/return, abandoned browser, delayed and duplicate signed events, DB outage/file-write failure, retry, stale token/wrong account, altered approved file and definitive cancellation. Recheck order/file/customer/operator visibility through real RLS. Test POD job retry and existing notification behavior separately.
5. Stage and verify the follow-up authoritative STORFORMAT quote contract and matching frontend fields described in [the pricing report](connection-repairs-pricing-2026-09-08.md). Its local source and parity tests are complete; affected products must still pass hosted acceptance with their own stored configuration. Do not enable unsupported products by accepting client amounts or routing them through an unrelated price fallback.

The follow-up [email repair](connection-repairs-email-2026-09-08.md) adds an outbox intent inside the completion transaction and a separate dispatcher. Its local tests pass; the sender, scheduler and actual provider/inbox acceptance still require hosted setup. The frontend reports the returned confirmation status and does not directly send customer/admin confirmation email. POD job creation remains an optional browser follow-up using the server's `checkout_context`, and may still be interrupted if a customer leaves. Invoice/POD dispatch and an operator reconciliation surface remain follow-up work. The retained attempts allow service operators to find `state <> 'completed'` and reconcile Stripe's verified status or replay a signed event. There is no automatic historical-payment backfill and no claim that old paid orders are repaired.

## Rollback

Disable new payments first with `STOREFRONT_CHECKOUT_ENABLED=false`. Keep finalizer/webhook and all attempt, cancellation-tombstone, order-reference and production-file data while any issued intent remains unsettled. Reconcile Stripe before disabling completion. Do not revert v2 payments to browser inserts, delete immutable copies, drop the protected columns, or remove cancellation tombstones; those actions would reopen duplicate-charge/duplicate-order or late-creation risks. Retaining the additive schema is the safe rollback. Any eventual cleanup needs a reviewed retention/reconciliation procedure.

## Primary references checked

- [Stripe payment status and server webhook completion](https://docs.stripe.com/payments/payment-intents/verifying-status)
- [Stripe webhook signatures, retries and duplicate delivery](https://docs.stripe.com/webhooks)
- [Stripe idempotency-key lifetime](https://docs.stripe.com/api/idempotent_requests)
- [Supabase Stripe webhook raw-body and signature handling](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- [Supabase RLS and table privileges](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase changelog](https://supabase.com/changelog) (the requested Markdown index returned an error; the HTML index was checked as fallback).
