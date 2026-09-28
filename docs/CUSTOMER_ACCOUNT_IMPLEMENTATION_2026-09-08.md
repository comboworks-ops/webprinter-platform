# Customer account implementation handoff

Date: 2026-09-08. Checkout: `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main`.

The user selected **option 2, the companion account**. The customer account now uses its white workspace, blue shop identity, persistent navigation, order rows and focused order detail. This covers customers of tenant shops and the main Webprinter shop. The local source/UI work is complete for the implemented scope; authenticated persistence and upload-backend deployment remain open.

Reference: `output/design-exploration/customer-account-2026-09-08/option-2-companion.png`. [Original audit and progress](CUSTOMER_ACCOUNT_FLOW_PLAN_2026-09-08.md) · [Browser QA and evidence](CUSTOMER_ACCOUNT_QA_2026-09-08.md).

## Implemented locally

| Area | Behavior and source entry points |
| --- | --- |
| Shared account and shop identity | `src/components/account/AccountShell.tsx`, `CustomerAccountContext.tsx`, and `src/lib/account/shop.ts`: shared storefront/account shell, responsive navigation, logout/error handling and strict account shop resolution. Explicit tenant ID/domain/subdomain or actual host determines the shop. Main hosts load the real master row; unresolved custom/explicit context fails. No owned-tenant, local-pin or fabricated-master fallback is used for account lists. |
| Customer auth | `src/pages/Auth.tsx`, `src/lib/account/navigation.ts`: customer-facing login/signup/confirmation/recovery states, field errors and shop-aware safe return links. Exact account/order targets and tenant query context survive redirects. |
| Overview and saved designs | `src/pages/MyAccount.tsx`, `MyDesigns.tsx`, and their pure account views: active/recent order rows, file/message prompts, exact-order links, contact/default-address summary, saved-design search, real thumbnails and reopening the existing designer with design/product/shop context. Explicit loading/error/empty states and identity/shop guards prevent stale presentation. |
| Order detail | `src/pages/MyOrders.tsx`, `CustomerOrdersView.tsx`, `src/lib/account/orders.ts`: search, persistent `?order=` selection, file/version list, messages, tracking/history and invoice availability. Queries constrain current customer/shop; writes require returned persisted rows. Internal notes/raw carrier data are excluded from customer detail projections. |
| Profile, addresses and checkout | `src/pages/MySettings.tsx`, `MyAddresses.tsx`, `FileUploadConfiguration.tsx`, `src/lib/account/profile.ts`: validated forms, checked save/delete/default results, recoverable errors and shop-aware recovery. Saved profile fields are authoritative for checkout, including deliberately cleared values; late reads do not overwrite contact text already entered. Existing personal address ownership is preserved. |
| Optional company access | Overview exposes eligible membership in the current shop. A guarded fallback handles existing legacy membership schemas without inventing access; unresolved membership state is explicit. Existing Company Hub remains the destination. |
| Reorder | An available current product can be reopened through existing product/price/checkout behavior. Historical options and quantities are not reconstructed. Historical order amounts are never used as a fresh quote. |

No pricing calculations, historical amounts, POD v1/v2 logic, tenant-scoping policies or dependencies were changed. No production deployment or hosted writes were performed.

## Replacement upload: prepared, not deployed

`src/lib/account/replacementFile.ts` now validates the request and calls `customer_finalize_order_file` in validation-only mode **before any storage upload**. Only successful preflight permits a new immutable storage path with `upsert: false`; a second RPC finalizes the current-file transition. An uncertain finalization keeps the object and asks the customer to reload/reconcile; it does not automatically retry or delete a potentially current file.

Migration: `supabase/migrations/20260908140250_customer_order_file_finalization.sql`. It prepares a narrow private finalizer plus a public invoker wrapper, explicit grants/revokes, ownership/current-version checks and an atomic transition. It adds no customer UPDATE grants and changes no existing RLS/storage policies. **It has not been deployed or executed against PostgreSQL; no PostgreSQL runtime was found locally.** Without the RPC, the UI stops at preflight before uploading.

Before enabling this path in a hosted environment:

1. Execute and verify the migration in an isolated PostgreSQL/Supabase test environment, including Data API exposure/grants and authenticated rejection cases. Static tests are not transaction/RLS proof.
2. Audit `order-files` upload/read/update/delete policies with two customers and two shops. Confirm current/finalized objects cannot be replaced or removed outside the allowed workflow; validate the actual read path and bucket publicness.
3. Audit existing direct `order_files` INSERT permissions so customers cannot bypass the finalizer's current-version transition. The prepared migration does not close or alter those existing paths.
4. Verify valid replacement, closed request, wrong customer/shop, stale expected-current IDs, storage failure, concurrent attempts, uncertain response and same-upload reconciliation. Reload both customer and operator views to confirm one durable current version and preserved history.

## Verification boundary

- **31 targeted tests pass**, covering account navigation, scoping/document helpers, profile hydration, replacement request/finalization sequencing and strict shop resolution.
- Lint reports **no new errors**; scoped TypeScript checking reports **no errors**. The full repository typecheck still fails on unrelated existing diagnostics; this is not a clean whole-repository build claim.
- Root browser QA exercised the actual local view components at **1487 px desktop, 768 px tablet and 390 px mobile**, using explicit fixtures. It covered search, selected-order URLs/detail, mobile navigation, overview, loading/error/empty states and fixture message interactions.
- A **real signed-out** main-shop account visit was tested locally: the auth redirect now retains the tenant query and customer return context.
- Fixture interactions do not prove authenticated writes. Login/signup email delivery, hosted/native-domain auth, message/read-receipt persistence, address/profile persistence, saved-design save/reload, replacement upload and hosted isolation remain unverified.

## Remaining functional follow-ups

1. Run the complete account journey with two real test customers and two shops, including identity/shop changes while requests are pending, denied results and nonempty data. Confirm counts/rows, files, messages and company access belong to the intended context.
2. Prove profile/address → checkout and designer save → account → reopen → reload persistence with authenticated test data.
3. Define the actual post-order proof-approval workflow and persisted approval/version contract; the existing checkout proof flow does not establish that feature.
4. Trace the invoice producer and real generated PDF lifecycle. The account can display available invoice data; creation and delivery are not proven.
5. Treat historical-selection reorder restoration as a separate feature. The implemented action reopens the current product for a fresh normal configuration and price.

## Rollback and next operator

Preserve the dirty checkout and isolate account presentation/navigation changes when reverting; do not reset unrelated work. The migration is currently undeployed, so no database rollback is needed for this local handoff.

If the migration is later deployed, disable replacement upload in the customer UI before dropping the public wrapper/private finalizer using the signatures in the migration's rollback note. Preserve all `order_files` rows and storage objects as version history. Do not restore the previous unchecked multi-write browser upload handler. Review the storage/INSERT audit and complete authenticated tests before publishing the change.
