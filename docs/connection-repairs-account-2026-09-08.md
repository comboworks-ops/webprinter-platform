# Customer account connection repairs — 8 September 2026

Status: implemented and verified locally with synthetic PostgreSQL fixtures. No hosted schema, customer records, storage objects or deployment changed. This is not authenticated browser or hosted Storage API acceptance.

## Changes

- `MyOrders.tsx` acknowledges operator messages through `customer_mark_order_messages_read`, instead of the forbidden customer UPDATE of an operator-authored message. The helper requires the exact returned message IDs before updating the visible read state. Network errors, missing RPCs, partial acknowledgements and denied writes remain visible failures.
- `20260908171700_customer_order_message_read_receipts.sql` adds a public SECURITY INVOKER wrapper around an explicitly granted private operation. It requires the authenticated order owner and matching shop, locks the order/message rows, rejects foreign or customer-authored message IDs, changes only `is_read`, and supports repeated acknowledgement after a lost response. Restrictive write policies close the observed legacy sender loophole: customers can INSERT only their own customer-authored message onto their own order, and cannot directly UPDATE/DELETE messages. Existing operator privileges remain.
- The existing undeployed `20260908140250_customer_order_file_finalization.sql` now removes the known direct customer `order_files` INSERT policy. Initial checkout attachment must use the service-only checkout finalizer; deploy these changes together. The existing operator policy is retained. Replacement ownership, shop, request-open, current-file comparison and storage owner/size checks are atomic. Replay verifies the same filename, size and still-current file rather than reporting a historical file as newly saved.
- Restrictive storage policies protect the replacement `order UUID/user UUID/object UUID.ext` namespace against customer/anonymous overwrite and deletion, even if a permissive policy exists elsewhere. Uploads into that namespace require the order owner and an open replacement request. Anonymous restrictions do not reference private tables or affect unrelated buckets. Storage bucket read/publicness is unchanged.
- `20260908172325_checkout_customer_profile_address_details.sql` adds nullable `delivery_address_2`, `delivery_country`, `billing_address_2`, and `billing_country` to the existing checkout profile table. It retains existing grants/RLS and all existing values. The frontend mapping is maintained in the parent repair work.

## Evidence and verification

Live metadata was read only. The linked database currently lacks the replacement RPC and four profile columns. Its `order_files` customer INSERT policy allowed any file row on the caller's own order. Its order-file bucket-specific policies allow public INSERT and SELECT, without a bucket-specific UPDATE/DELETE permission. These facts guided the local repair; no live SQL mutation was run.

Passed locally:

- 34 account source tests, including three new read receipt contract tests.
- ESLint for MyOrders, read receipt helper/tests and the SQL fixture runner.
- Repository Supabase Data API grant checker for the changed migration set.
- `scripts/tests/customer-account-database.test.mjs`: the actual three migration files run against disposable PostgreSQL 17 with two synthetic customers and two synthetic shops. Assertions exercise anonymous/foreign-owner/wrong-shop denials, mixed foreign message IDs, idempotent read receipts, unchanged operator text, forged sender identity/type and foreign-order INSERT denial, denied direct customer UPDATE/DELETE, valid customer messages in each shop, preserved operator message INSERT/read UPDATE, blocked direct file INSERT, preflight-before-upload, missing/wrong-size objects, wrong-owner uploads, immutable objects, replay mismatch, independent shop preservation, saved address persistence, foreign profile UPDATE denial, and preserved operator file insertion.
- The SQL fixture deliberately provides broad storage UPDATE/DELETE permissions so that the new restrictive policies must prove they prevail.
- Two concurrent customer replacement transactions use the same expected prior file. One commits; the other rejects the closed request. Exactly one new current customer replacement remains and the previous file survives in history.

Reproduce the database fixture in an isolated environment only:

```sh
docker run --detach --rm --network none --name webprinter-account-repairs-20260908 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
ACCOUNT_REPAIR_TEST_CONTAINER=webprinter-account-repairs-20260908 node --test scripts/tests/customer-account-database.test.mjs
```

The runner accepts only that disposable container name, creates a unique fixture database and drops that database after testing. It has no hosted URL/key support. Stop the container once all cooperating local fixture tests finish.

## Rollout and rollback

Deploy the replacement migration together with the service-only checkout flow. Deploy the read receipt/profile migrations before the matching frontend. Before rollout, verify the complete journeys through actual hosted authentication and Storage API with two low-privilege accounts and two shops, including network loss and cross-account attacks. The offline fixture uses PostgreSQL roles and representative policies; it does not validate Supabase Auth JWT issuance, deployed PostgREST schema refresh, binary file upload/download, the exact hosted policy inventory, or browser event wiring.

Rollback the frontend call sites first. Drop the public read receipt wrapper and private read receipt function using the signatures in the migration if needed. The replacement migration includes matching function rollback signatures. Preserve all order file rows and objects, the restrictive storage and message protections, and the removed unchecked customer INSERT policy. Keep the four nullable address columns to avoid deleting newly saved address information. Rolling back to the old browser checkout writer requires a separate reviewed compatibility decision.

## Remaining operator scope boundary

The existing administrator policies use the established global `is_admin()` permission. This repair preserves that privilege; it does not redesign operator tenant scoping. The two-shop database assertions establish low-privilege customer separation, not isolation between global administrators.

Reference: Supabase's current [database function security guidance](https://supabase.com/docs/guides/database/functions) and [Storage access-control guidance](https://supabase.com/docs/guides/storage/security/access-control) were checked during implementation.
