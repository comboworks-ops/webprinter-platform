# Admin dashboard, orders and messages — implementation scope

Date: 8 September 2026. Local source implementation; authenticated production behavior is not certified by this document.

## Selected references

The implementation follows `docs/ADMIN_DESIGN_SELECTIONS_2026-09-08.json`:

- Original dashboard option 3, Open Workspace.
- Orders: `orders_1`, displayed option 2.
- Order detail: `orderdetail_1`, displayed option 2.
- Messages: `messages_1`, displayed option 2.

The three screen images are in `tmp/admin-design-review-20260908/images/`. The original dashboard reference is recorded in `docs/ADMIN_DESIGN_EXPLORATION_2026-09-08.md`.

## Files

- `src/components/admin/Dashboard.tsx`
- `src/components/admin/OrderManager.tsx`
- `src/components/admin/AdminMessages.tsx`
- `src/components/admin/workspace/orderPresentation.tsx`
- `src/components/admin/workspace/orderWorkspace.css`

The shared admin shell, menu, navigation helper and other screen implementations are managed separately. `orderPresentation.tsx` delegates tenant-preserving links to `withAdminWorkspaceContext` in `src/lib/admin/workspaceNavigation.ts`.

## Implemented behavior

Dashboard uses a daily task banner derived from actual pending/problem orders, the five most recent orders, and existing shop/editor actions. Previous analytics remain available in an expandable section. The chart mounts only while expanded. The previous total of all order amounts is labeled **Samlet ordreværdi**, with an explanation that it includes cancelled orders; it is not represented as verified paid revenue. No reference-image figures, customer names or sample product photographs are embedded as operational data.

The order register retains search, order status, production-flow and file-readiness filters. Selecting an order shows its read-only summary beside the register. Opening it uses the existing route with `orderId`, for example `/admin/kunder?orderId=…&force_domain=…`, and shows a full workspace for order information, files and customer/delivery details. Existing status editing, problem/reupload controls, delivery fields, invoice generation and message navigation remain available. Existing status transition timestamps, tagged delivery-note synchronization and notification rules are retained.

The inbox provides customer/support selection, search across customer/order data and message text, unread filtering, an explicit send button, message history and an order context panel. An order with no previous messages can be opened from its order-detail link to start its existing order conversation. Enter inserts a newline; Ctrl/Cmd+Enter sends. Platform contact leads remain a read-only intake log with their existing email reply link.

## Data and state safeguards

- Order reads use the resolved active tenant. Existing order updates include both order ID and tenant ID.
- Dashboard/orders/file histories and message histories read all pages rather than silently stopping at the API row limit. Related-file/message requests use bounded groups of known order IDs.
- Messages use customer snapshot fields from the order. The unused browser call to `auth.admin.listUsers` has been removed.
- Request errors are distinct from empty results and expose retry actions.
- Opening another order invalidates any older file request. A loaded detail refreshes its file summary.
- Order-save completion tracks the opened detail session and cannot close another order opened while the request was pending. Refresh is quiet in that case.
- Message-send completion clears only the same unchanged composer; it does not erase a newer draft in another conversation.
- Support reads/mark-read operations wait for resolved role/tenant context. Mark-read remains scoped to the selected support conversation; platform leads are excluded.
- Existing light/dark appearance selection is supported, with responsive layouts for narrow screens.
- An order update must return the requested order ID before history/email/success handling runs. A failed history write is reported separately as an already saved order with missing history; it does not retry the order update or imply rollback.

No pricing calculations, POD v1/v2 tables, fulfillment/payment rules, database schema, grants or edge functions were changed by this implementation.

## Verification recorded by the implementing agent

- TypeScript transpilation of all three modified TSX files: no syntax diagnostics.
- Full project TypeScript invocation: no diagnostics in the owned components/helper after the initial type-cast corrections. The project check still fails on errors elsewhere in the repository; this is not a passing global typecheck.
- `git diff --check` for the modified tracked components: passed.
- Shared navigation/header and collection behavior reviewed from source. Findings were handed to the coordinating agent for correction.

Browser evidence belongs in the coordinating agent's verification record. Its isolated fixture harness renders the actual UI against synthetic local data with no production backend. Fixture results must remain distinguished from authenticated behavior.

## Remaining proof boundaries

No real order was saved, message sent, invoice issued, payment taken, production job forwarded, product published or deployment performed during this component implementation. Real authentication/RLS behavior, delivery of customer emails, concurrent database updates and end-to-end customer operation require separate authenticated verification. The selected illustration's attachment controls and product imagery were not invented where the existing components do not provide them.

## Bounded header reliability follow-up

The coordinating agent assigned two additional changes in `src/components/admin/AdminHeader.tsx`. They preserve its shared navigation, tenant scoping and shop-link changes:

- Logout now checks the returned Supabase error. It displays success and navigates only after success; failure stays in the workspace and offers a retry message. The original sign-out scope is unchanged. The action is disabled while pending.
- The first successful unread-count observation initializes the baseline without a new-message toast. Later increases still notify. Failed/unavailable counts do not replace the baseline, and overlapping polls are skipped. Tenant-context remounts begin with a fresh baseline.

This follow-up was reviewed and transpiled from source; the final full TypeScript run has no diagnostics in AdminHeader or the owned order/message components, while unrelated project errors remain. Diff validation passed. No actual sign-out, authentication mutation, message write or notification delivery was executed.
