# UI, settings and backend connection audit

8 September 2026. Read-only audit of the current working tree and its linked Supabase backend. No application changes, hosted writes, customer messages, uploads, orders, payments or deployments were performed.

## Verdict

The new UI has real connections to the existing application and data tables. It is **not yet a fully verified, reliable end-to-end ordering system**. The review found concrete missing dependencies, save-state defects and gaps between local and deployed code. A successful visual preview or production frontend build does not establish these contracts.

The currently shown `output/design-exploration/customer-account-2026-09-08/implemented.html` imports `src/dev/CustomerAccountPreview.tsx`. It uses explicit example orders and local message/file callbacks. The actual `/min-konto` routes use real authentication and database calls.

## What is connected

| Area | Actual connection | Evidence boundary |
| --- | --- | --- |
| Site Design | `TenantSiteDesignV2` → `SiteDesignEditorV2` → `useBrandingEditor` → tenant adapter → `tenants.settings.branding.draft/published` | Source traced; adapter defects below. Main editor does not use the older `useBrandingDraft` hook. |
| Published appearance | `useShopSettings` reads branding; publish invalidates the query and broadcasts refresh | Source traced; no authorized hosted save/reload performed. |
| Ordering page choices | `themeSettings.orderFlowDesigns` is consumed by calculator, checkout, proof, payment, confirmation and designer | Existing choice/preview/helper tests pass. |
| Customer identity | Supabase Auth → safe tenant-aware redirect → account provider and strict shop lookup | Source traced and focused account tests pass. |
| Orders and messages | Customer and operator pages use the same `orders` / `order_messages`; customer lists constrain user and tenant | Live table/policy metadata checked; no two-account runtime acceptance. |
| Profile and addresses | Account writes `profiles` / `customer_addresses`; checkout reads them | Source traced; address losses/race below. |
| Saved designs | Account reads saved designs and reopens Designer with design/product/shop context | Source traced; older Designer save path still has gaps. |
| Product → checkout | Product configuration carries price quote, quantity, delivery, template, size and tenant | Source traced; payment verification is not equivalent to the visual calculator. |
| Payment and order callbacks | Actual payment layout mounts Stripe form; success callback inserts order/files and calls email/POD functions | Real calls exist; completion is neither atomic nor durably server-finalized. |

Useful source entries: `src/components/admin/TenantSiteDesignV2.tsx:59`, `src/components/admin/SiteDesignEditorV2.tsx:2950`, `src/lib/branding/tenant-adapter.ts:91`, `src/lib/branding/use-branding-editor.ts:247`, `src/hooks/useOrderFlowDesign.ts:5`, `src/App.tsx:166`, `src/pages/MyOrders.tsx:45`, `src/pages/FileUploadConfiguration.tsx:1365`.

## Live backend evidence

The local `.env` and `.env.local` Supabase host and CLI project reference agree: `ziattmsmiirfweiuunfo`, project **printmaker-dev**, reported `ACTIVE_HEALTHY`. This is the backend connected to this checkout; this audit does not infer that every hosted frontend uses the same configuration.

- Migration inventory contains 145 entries; the newest recorded migration is `20260716102031_menu_cloud_storage`. The September customer file finalization migration is absent.
- A direct `pg_proc` metadata query finds **no `customer_finalize_order_file` RPC**. The local replacement uploader needs it before upload.
- Deployed `stripe-create-payment-intent`, version 13, is a 4,043-character source file. It reads `amount_ore` from the request, checks it is positive, and creates the PaymentIntent from it. It does not consume `checkout_quote` or perform the local server price verification. This was source inspection of the deployed function, not a payment attempt.
- Deployed `pricing-read`, version 20, reads `generic_product_prices`. The current aluminium product `6c546267-6585-4465-a4fe-857e3d343612` has **zero generic price rows**. Its frontend uses the separate storformat pricing path.
- The linked project's edge inventory has the subscription webhook, but no storefront payment-completion webhook/finalizer was found. Live `orders` column metadata has no payment/Stripe reference column.
- Core account tables and relevant order child tables exist; checked core tables have RLS enabled. This alone is not authorization proof. The actual live order-message policies do not allow an ordinary customer to update an operator's message as read: the applicable UPDATE/ALL paths require admin access or the current user as the message sender.
- Aggregate branding formats: four tenants, three with nested draft and published values, one with no branding; no current draft-only, flat legacy, or root legacy branding entries. Legacy-format defects below were reproduced with synthetic data and are not claimed as active corruption of these rows. A first draft for a tenant without published branding still needs a defined unpublished-state contract.

## Confirmed gaps, prioritized

### 1. Payment backend and local code are out of sync

The frontend sends both `amount_ore` and `checkout_quote` (`FileUploadConfiguration.tsx:1365`). The deployed payment function ignores the quote and trusts the positive client amount. The local replacement function contains server verification, but that verification delegates to generic prices only and does not forward area/dimensions. Deploying that local function alone would not complete storformat checkout: the aluminium product has no matching generic price rows.

Local references: `supabase/functions/stripe-create-payment-intent/index.ts:83–118`, `supabase/functions/pricing-read/index.ts:596`, `src/pages/ProductPrice.tsx:916`. Deployed evidence was fetched directly with Supabase `get_edge_function` for the versions above.

Required: one authoritative server quote contract for each supported pricing model, then consistent frontend/function deployment. Do not describe a working visual price calculation as server-verified payment pricing.

### 2. Payment success does not guarantee a durable order and file

`handlePaymentSuccess` creates an order in the browser after payment, then separately creates file rows, POD jobs and email. File/POD failures can only be logged. The Stripe return effect trusts `redirect_status=succeeded` and uses an in-memory duplicate guard; the order payload has no PaymentIntent identity. An order-save failure sets a warning but still displays the order-received success toast.

References: `src/pages/FileUploadConfiguration.tsx:1413`, `:1515`, `:1673`, `:1820`, `:1836`.

Required: server-verified completion with durable payment/order identity, idempotency and reconciliation. Only report an order received when it exists. Verify interrupted browser, duplicate callback, delayed webhook, failed order/file writes and retries in test mode. No claim is made here that a real customer's payment has already been lost.

### 3. Proof adjustments do not reach the direct-pay production file

The real proof dialog allows dragging/resizing artwork. Approve sets local flags; the transform is saved in the browser and consumed if the user opens Designer. Direct payment persists the original upload URL without the proof transform. The approved preview can therefore differ from the file delivered to production.

References: `src/pages/FileUploadConfiguration.tsx:4211`, `:2983`, `:2222`, `:1597`; `src/pages/Designer.tsx:2967`.

Required: generate and persist the approved artifact or a production-consumable placement contract, with the exact approved version attached to the order. Verify exported bytes and dimensions against the preview.

### 4. Customer replacement uploads are deliberately blocked by a missing RPC

`src/lib/account/replacementFile.ts:28` calls `customer_finalize_order_file` before storage upload. The linked backend lacks that function. The prepared migration is `supabase/migrations/20260908140250_customer_order_file_finalization.sql`. The failure currently stops safely before uploading, but the user-facing feature is not operational on this backend.

Required: validate the migration in an isolated database, audit grants/RLS/storage/direct file-insert paths, and test two customers/two shops, closed requests, stale/current file versions, concurrency and uncertain responses before deploying the complete path.

### 5. Settings can report success without persistence

Current tenant adapter Save/Publish checks only `error`, so `error:null` with zero updated rows resolves as success. The UI then reports saved/live. A synthetic adapter reproduction confirmed both paths with unchanged stored values. The adapter also reads/replaces the full settings JSON without the product-styling layer's revision protection.

References: `src/lib/branding/tenant-adapter.ts:112`, `:152`; `src/lib/branding/use-branding-editor.ts:213`, `:247`.

Additional reproduced compatibility defects:

- Saving a draft over legacy flat branding produces draft-only nested branding, and `useShopSettings` uses `published || draft`, making unpublished values visible. `tenant-adapter.ts:104`; `useShopSettings.ts:30`.
- Existing root `branding_draft` / `branding_published` values outrank newly saved nested values when the editor reloads. `tenant-adapter.ts:44`, `:78`.
- The separate master-template editor reloads published fields over newer draft fields. `src/lib/branding/master-adapter.ts:43`.

Required: checked returned rows and revision-aware writes; explicit draft/published behavior for new and legacy tenants; normalize precedence; correct master merge order; test actual save/reload in a designated safe tenant with a low-privilege account. Product styling's recently fixed patch layer does not cover these broader branding adapter cases.

### 6. Account/checkout details and downstream features need completion

- Saved address line 2 and country are omitted when applying an address; save-back writes null line 2 and Denmark. Late address hydration can overwrite user input because it captures initial values and has no cancellation/auth-change guard. `FileUploadConfiguration.tsx:1005`, `:1799`, `:2393–2446`.
- Customer read receipts attempt an UPDATE not permitted by the live policy for operator messages; unread indicators can persist. `MyOrders.tsx:150`.
- Invoice reading exists, but no invoice-row/PDF producer was found in `src` or edge functions. `MyOrders.tsx:84`. This does not establish automatic invoice generation/delivery.
- Signed-out Designer save redirects to `/auth?redirect=/designer`, losing shop/product/design context. An existing-design save can also report success after a zero-row update. `Designer.tsx:3108`, `:3201`.
- Messages are connected as inbox records. Send handlers do not dispatch email notifications, and customer pages have no realtime subscription; new replies require reload/navigation.
- Guest orders are not automatically attached to an account created later. Reorder opens the current product for fresh configuration; historical options are not restored.

## Tests and remaining proof

Fresh focused runs passed: **31 account tests**, **46 settings/preview tests**, and **36 order-flow/PDF/submission-helper tests**. The groups overlap and must not be summed as unique coverage. The four settings adapter defects above were reproduced by executing current functions against isolated synthetic database adapters; the existing tests do not cover them. No hosted business data was modified. The frontend build from the layout pass passes; the application still has its recorded 423-diagnostic TypeScript baseline.

Remaining acceptance must cover a complete journey in a designated test environment: signup/login → save profile/address → save/reopen design → configure a generic and a storformat product → approve the exact artifact → test payment → one durable order/file visible to both customer and correct operator → reply/read receipt → replacement file → invoice/tracking where supported. Repeat with a second low-privilege customer and second shop, including reload, network interruption and denied writes.

## Recommended next implementation sequence

1. Repair the payment quote and durable completion contracts; include storformat and exact deployed-version checks.
2. Bind proof approval to the real production artifact and complete replacement-file backend/version handling.
3. Correct branding Save/Publish persistence, revision checks and legacy/new-tenant semantics.
4. Fix checkout address preservation and late loading, customer read receipts and Designer return/save behavior. Define invoice production and notification behavior explicitly.
5. Run the two-shop/two-customer acceptance journey and controlled failure cases. Review and deploy the frontend, edge functions and migrations as a matched release, then repeat hosted checks.

This is an audit and work sequence, not a deployment approval. Preserve the existing dirty worktree and prior changes. No repair, migration or payment was attempted during this audit.

## Local repair follow-up

The subsequent authorized repair is documented in [SYSTEM_CONNECTION_REPAIRS_2026-09-08.md](SYSTEM_CONNECTION_REPAIRS_2026-09-08.md). It adds local source, migration and synthetic runtime fixes for the findings above. This original audit remains the pre-repair evidence record. No repair has been deployed, and the hosted rollout hold remains.
