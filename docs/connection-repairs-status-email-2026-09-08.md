# Manual status email boundary — 8 September 2026

The legacy `send-order-email` function could previously accept a public app-key caller, trust caller-provided recipients/order/shop data, and interpolate those fields directly into HTML. Its gateway `verify_jwt=true` was not a substitute for customer/operator authorization. That path is now closed locally. No emails, hosted requests, database writes or deployments were performed for this repair.

## Implemented behavior

- The endpoint accepts only `status_change` and `problem_notification`, identified by `order_id` and `tenant_id`. `order_confirmation` and `admin_new_order` return HTTP 409 / `use_durable_checkout_notifications`; they cannot bypass the [checkout email outbox](connection-repairs-email-2026-09-08.md).
- A real Supabase `auth.getUser(token)` result is required. Public anon keys, invalid user sessions and the email worker's separate cron credential do not establish a user. The actor must own the selected tenant, have `master_admin`, or hold `admin`/`staff` for that exact tenant. An unrelated tenant's admin cannot send the message.
- The service queries the saved order by both order ID and tenant ID, then rechecks the returned identities. Recipient, customer name, product, amount, status, tracking, problem details and shop data come entirely from server rows. Extra legacy payload fields are ignored. A problem notification requires a saved problem flag/status and nonempty saved problem description.
- All dynamic HTML is escaped, saved order numbers used in subjects reject control characters/oversized values, and statuses retain the existing seven allowed values. Account links use only validated server `STOREFRONT_ORDER_EMAIL_SITE_URL`, `/min-konto/ordrer`, and encoded `tenantId`/`order` identifiers. Guest-order messages do not pretend the guest has a customer-account link.
- Shared email configuration is reused: `STOREFRONT_ORDER_EMAIL_MODE=disabled|test|live`, `RESEND_API_KEY`, verified `CONTACT_EMAIL_FROM`, required `STOREFRONT_ORDER_EMAIL_SITE_URL`, and `STOREFRONT_ORDER_EMAIL_RECIPIENT_ALLOWLIST`. Default or invalid mode fails closed. Test mode requires both an allowlisted recipient and an exact linked completed checkout attempt with `livemode=false`. Live mode rejects test attempts; an explicitly authorized operator may notify a legacy order without an attempt only in live mode. A configured live allowlist also applies.
- Requests are rate limited using the existing in-memory helper, body input is bounded, responses use `Cache-Control: no-store`, and provider HTTP uses a fixed URL, timeout and no redirect following. Success requires a successful provider response with a valid provider message ID. Responses/logs do not disclose provider secrets, recipients or message bodies.
- Repeated identical manual sends use the same Resend idempotency key derived from the exact server-built provider payload, order identity and message type. Changed saved content produces a different key. **These manual status/problem messages are direct requests, not durable queued notifications.** There is no delivery guarantee or deduplication promise beyond the provider's idempotency window; a timeout is reported as unconfirmed. Unlike checkout confirmations, they have no automatic retry/outbox.
- `emailService.ts` sends only identity/type and accepts only `success===true && accepted===true`. Its old confirmation helpers return false without calling the endpoint. OrderManager passes saved identity and warns if sending is unconfirmed. A new problem flag also dispatches its problem notification when status is unchanged; history remains conditional on an actual status change. A saved order is not retried because email failed. This final trigger-condition correction is source-reviewed and build-checked, not an authenticated admin-browser test.

## Files

- `supabase/functions/send-order-email/index.ts`: real Auth lookup, exact query adapters, existing rate-limit helper and shared configuration.
- `supabase/functions/_shared/storefrontStatusEmail.ts`: request authorization, saved-content rendering, mode gates and provider request.
- `supabase/functions/_shared/storefrontStatusEmail.test.ts`: synthetic repository/provider tests and actual browser email-helper contract test.
- `src/lib/emailService.ts`: identity-only requests and truthful provider acceptance.
- `src/components/admin/OrderManager.tsx`: only the email call block was edited for identities/notification failure; other existing dirty order-management edits were preserved.

No migration or new public API grant was introduced. The existing `[functions.send-order-email] verify_jwt=true` setting remains unchanged; the handler now supplies the necessary operator authorization.

## Validation

**12 tests pass** in one run:

1. Missing authorization and anon app keys are denied before order/provider access.
2. Customers and other-shop admins/staff are denied before reading order content.
3. Tenant owner, scoped admin/staff and master admin use only trusted saved recipients/content; forged request fields are ignored and saved HTML is escaped.
4. Unexpected order/tenant/attempt identities and incomplete attempt state are rejected.
5. Both legacy confirmation types are blocked without provider calls.
6. Disabled/wrong mode, test-mode legacy orders and live-mode test attempts are blocked; authorized live legacy order behavior is explicit.
7. Recipient allowlist, sender header controls and HTTPS origin validation apply.
8. Problem messages require and escape saved problem content.
9. Unsafe subjects and unknown status values do not reach the provider.
10. Identical payloads share the provider key; changed saved status changes it.
11. Provider failure, missing receipt identity and repository errors never report acceptance.
12. The actual browser helper module strips forged recipient/shop content, refuses legacy confirmations, and checks both success flags.

Commands run with the bundled Node and installed Deno runtimes:

```sh
node --experimental-strip-types --test supabase/functions/_shared/storefrontStatusEmail.test.ts
node node_modules/eslint/bin/eslint.js supabase/functions/_shared/storefrontStatusEmail.ts supabase/functions/_shared/storefrontStatusEmail.test.ts supabase/functions/send-order-email/index.ts src/lib/emailService.ts
deno check --deny-import --no-lock supabase/functions/send-order-email/index.ts
node scripts/check-supabase-function-exposure.js
git diff --check -- supabase/functions/send-order-email/index.ts src/lib/emailService.ts src/components/admin/OrderManager.tsx
```

All listed checks pass. Deno used cached dependencies with imports denied and did not execute the handler; no lockfile was changed. Function exposure checks pass for 59 functions. The tests use synthetic repositories/provider responses and do not establish deployed JWT, actual provider delivery or hosted tenant-role behavior. Whole-application build/typecheck results belong to the consolidated repair report.

## Matched deployment and rollback

The release packet must also redeploy the existing `send-order-email` function with both shared email helpers and its checked JWT config, alongside the matching browser helper/OrderManager block. Deploying only the new outbox worker would leave the old bypass active. The full packet now includes the three payment functions, durable email dispatcher **and this existing status-email endpoint**. New-client/old-endpoint and old-client/new-endpoint combinations fail closed for manual status delivery until the packet matches; confirm that behavior in staging.

Add to [hosted acceptance](connection-repairs-hosted-acceptance-2026-09-08.md): use real customer, owner, same-shop staff and different-shop staff tokens against this endpoint; verify the legacy confirmation calls return 409; verify only the persisted customer receives an allowlisted test-status message from a completed test order; try forged payload content and wrong shop/attempt; repeat identical manual sends and inspect provider acceptance. Keep real recipients outside the test allowlist. Do not use a service-role session as authorization proof.

Rollback should disable manual mail through the mode switch or retain a closed endpoint. Do not redeploy the original unauthenticated, caller-controlled implementation. Retain the confirmation queue and its accepted identities; manual status sends have no outbox to drain. Frontend email failures must remain separate from successfully persisted orders.
