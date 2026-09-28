# Durable checkout confirmation email repair

Current deployment checkpoint: [16 September release packet](PRODUCTION_RELEASE_2026-09-16.md).
The isolated backend now has the reviewed renderer, restricted sending key and
Vault-backed schedule. Seven test emails were provider-confirmed Delivered;
duplicate protection and one automatic HTTP 200 scheduler run passed. Test
checkout/email/scheduler are paused. Actual inbox appearance and live rollout
remain pending. The implementation and original local-only evidence below date
from 8 September; they do not describe the current deployment state.

## Result and transaction boundary

`20260908184205_storefront_order_email_outbox.sql` adds a private `storefront_order_email_outbox` and an AFTER completion trigger on `storefront_checkout_attempts`. The existing service-only paid-order finalizer inserts the order and production files, then completes the attempt. The trigger queues email intent in that same database transaction. If queuing an enabled customer confirmation fails, the order, files and attempt completion roll back. Retrying the verified payment can finish the transaction later.

One row exists per `(order_id, notification_type)`. Duplicate or concurrent finalizer callbacks do not create duplicate email intent. The migration does not backfill historical completed attempts or legacy orders; replaying their completion callback also does not enqueue them. A deliberately approved reconciliation would be separate work.

The two notification types are:

- `customer_confirmation`: the durable order's customer email; disabled only when `tenants.settings.notifications.order_confirmations` is explicitly false.
- `operator_new_order`: a valid configured `tenants.settings.company.email`; disabled when `notifications.new_orders` is explicitly false. No configured inbox means no operator notification. There is no fallback to a platform/master inbox.

Shop name/support contact and the durable order number, product, quantity, total, customer and delivery details are captured when the paid order completes. Later tenant/profile changes do not change this snapshot. HTML text is escaped. Reply-To is used only for the configured shop contact. Authenticated customer links use the server-configured site origin and preserve `tenantId` and `order`; guest/operator messages do not promise access through a customer account link.

## Worker, retry and acceptance semantics

The new Edge Function `storefront-order-email-dispatch` uses a dedicated scheduler bearer secret and service-role database access. It accepts POST only and does not accept a recipient, tenant, order or HTML body from its caller. `verify_jwt = false` is intentional: it verifies the dedicated bearer secret internally; a browser JWT or public anon key cannot drain the outbox.

Claims use row locks and `SKIP LOCKED`, five rows per request and a five-minute lease. Test/live mode and optional recipient allowlist apply to both claims and expired-row review. Workers cannot steal active leases. A reclaimed row gets a new claim token, so the previous worker cannot prepare or acknowledge it.

The exact provider payload is saved before the first provider request and is immutable thereafter. Retries reuse `Idempotency-Key: storefront-order-email/v1/<outbox UUID>` and the exact saved payload, including From and the site link. A later sender, template or site configuration change cannot alter a retried request. Resend documents a 24-hour idempotency-key retention period; this worker conservatively stops automatic attempts after 23 hours from the first claim or eight attempts, whichever comes first. [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [Send Email API](https://resend.com/docs/api-reference/emails/send-email).

A timeout, network failure, retryable provider response or malformed success stays pending with bounded backoff. A conflicting idempotency response requires review. A definite first rejection is failed; a later rejection after prior attempts requires review because earlier acceptance may be uncertain. If acknowledgement fails after provider acceptance, the lease eventually expires and the same body/key is retried within the bounded window. Rows beyond that window are held for review, never automatically resent using a new key.

`sent` means the provider accepted a send and returned an ID. It does not prove inbox delivery. The queue fields used by the finalizer's optional service-only status lookup are:

| Field | Meaning |
| --- | --- |
| `attempt_id`, `order_id`, `tenant_id` | Scope the status lookup to the finalized order. |
| `notification_type` | Use `customer_confirmation` for the customer receipt. |
| `status` | `pending`, `processing`, `sent`, `needs_review` or `failed`. |
| `accepted_at`, `provider_message_id` | Both required before presenting provider acceptance. |
| `last_error_code` | Sanitized operational code, no provider response body or credential. |

Root runtime integration maps `sent` plus both acceptance fields to public `accepted`. Other public statuses are `pending`, `processing`, `needs_review`, `failed`, `unavailable`. Its lookup is nonfatal and time bounded; an unavailable email status cannot undo a durably saved order. Missing rows, including disabled confirmations and historical orders, must not be described as sent.

## Deployment and schedule requirements

The worker defaults to disabled. Apply the original paid-order finalization migration before the new outbox migration, then deploy the worker. No automatic schedule is created by the migration. Use an authorized scheduler to POST to `<SUPABASE_URL>/functions/v1/storefront-order-email-dispatch` once per minute with `Authorization: Bearer <dedicated secret>`. Keep the secret in the scheduler's protected secret storage; do not put it in frontend configuration, URLs, reports or a public SQL literal. Request body is unnecessary. Monitor response counts and private outbox states.

| Server secret/config | Required behavior |
| --- | --- |
| `STOREFRONT_ORDER_EMAIL_MODE` | `disabled` by default. `test` claims only Stripe `livemode=false`; `live` claims only `livemode=true`. |
| `STOREFRONT_ORDER_EMAIL_RECIPIENT_ALLOWLIST` | Comma-separated exact email addresses. Required and nonempty in test mode; optional live canary restriction. Matching does not redirect mail. Include authorized customer and shop operator fixture inboxes. |
| `STOREFRONT_ORDER_EMAIL_CRON_SECRET` | Dedicated random 32–256-character scheduler bearer secret. |
| `STOREFRONT_ORDER_EMAIL_SITE_URL` | Required HTTPS origin, e.g. `https://staging.example.test`; no credentials, path, query or fragment. Use the staging origin for staging; the message freezes this origin at first dispatch. |
| `CONTACT_EMAIL_FROM` | Required verified provider sender, optionally `Shop <sender@example.test>`. No guessed sender fallback. |
| `STOREFRONT_ORDER_EMAIL_RESEND_API_KEY` | Dedicated server-side order-email provider credential. Required in test mode. Configure a sending-only key restricted to the verified sender domain. This avoids enabling unrelated legacy email handlers on the shared branch. |
| `RESEND_API_KEY` | Existing live-mode compatibility fallback only. Do not install a global provider key on the isolated test branch; its older contact/quote handlers use this name without the order-email mode/recipient guards. |
| `SUPABASE_URL` plus service key | Standard Edge runtime environment. Supports `SUPABASE_SECRET_KEYS.default`, with existing `SUPABASE_SERVICE_ROLE_KEY` fallback. |

Test mode prevents live-payment queue draining; it can still send real email to the explicitly allowlisted addresses. Enabling a sender or schedule therefore requires the approved hosted test environment and recipient list. The 16 September test used support@onlinetryksager.dk exclusively. Use [the inactive-by-default scheduler SQL](storefront-email-scheduler.sql) with Vault entries configured through protected tooling. Provider acceptance, provider-reported delivery and recipient inbox/client review remain separate checks.

## Permissions and rollback

RLS is enabled with no browser policies. `public`, `anon` and `authenticated` have no table or RPC privileges. `service_role` receives only table SELECT/INSERT/UPDATE, plus explicit EXECUTE on the claim, prepare and finish RPCs. It receives no DELETE privilege. Trigger-only functions are explicitly private. Every function uses SECURITY INVOKER and an empty search path. Snapshot/recipient/tenant/payment-mode identity and frozen provider payload are protected by an immutable-field trigger; accepted rows cannot be reopened or assigned another provider ID.

To pause or roll back: set email mode to `disabled` and stop the schedule first. Preserve queue rows, frozen payloads, provider IDs and timestamps. If the queue trigger itself blocks payment finalization, remove only `queue_storefront_order_emails` from `public.storefront_checkout_attempts` through a reviewed additive rollback migration; the original finalizer remains usable. Confirmations for completions during that pause will be unavailable. Do not delete and recreate queue rows or reset first-attempt timestamps to get around the deduplication window. Reconcile `needs_review` against provider records before any explicitly approved manual resend. Legacy order/status-email hardening is a separate coordinated change in this repair packet.

## Verification completed

- 10 Node tests in `supabase/functions/_shared/storefrontOrderEmail.test.ts`: scheduler authorization, fail-closed configuration/site origin, HTML escaping, tenant links and guest behavior, invalid snapshot rejection, provider acceptance, frozen-body timeout recovery, allowlist/mode defense, rejection/conflict/malformed-success handling, checkpoint failure.
- 11 PostgreSQL integration tests in `supabase/tests/storefrontOrderEmailDb.test.mjs`: original finalizer plus outbox migration on Postgres 17; two shops and customer identities; concurrent duplicate finalizers; queue-failure transaction rollback; preferences and no fallback inbox; historical no-backfill; private grants/RLS; mode/allowlist claims; simultaneous workers; payload immutability; retries/backoff; stale leases; accepted-row protection; 23-hour/eight-attempt stop; canary sweep scope; no service DELETE.
- Deno typecheck of the actual Edge Function and its pinned Supabase import passed.
- Supabase Data API grant check and function exposure check passed. `git diff --check` passed.

Commands (from repo root, using an existing disposable local PostgreSQL container):

```sh
node --experimental-strip-types --test supabase/functions/_shared/storefrontOrderEmail.test.ts
CHECKOUT_TEST_CONTAINER=webprinter-account-repairs-20260908 node --test supabase/tests/storefrontOrderEmailDb.test.mjs
deno check --no-lock supabase/functions/storefront-order-email-dispatch/index.ts
node scripts/check-supabase-migration-grants.js
node scripts/check-supabase-function-exposure.js
```

The SQL fixture creates and drops only its own uniquely named synthetic database. The container has no network, ports or host mounts. Provider tests use a mocked fetch; there were no provider sends. These checks prove local code/transaction behavior, not deployed migrations, hosted authentication/RLS, configured scheduler availability or email delivery.
