# Publishable order-flow designs — 20 September 2026

## Scope

All six approved order-flow design pairs are now accessible in Site Design V2. The user can select each layout, preview that step, save the choices as part of the shop design, review all six choices in the Publish dialog, and publish them together through the existing branding adapter.

| Step | Standard | Alternative |
| --- | --- | --- |
| Product and price | 2 | 1 |
| Checkout | 6 | 4 |
| File proof | 7 | 9 |
| Designer | 12 | 11 |
| Payment | 13 | 15 |
| Confirmation | 16 | 18 |

The original product-only fix is documented in `ORDER_FLOW_PRODUCT_PREVIEW_FIX_2026-09-19.md`.

## Implementation

- OrderFlowDesignInspector and SiteDesignEditorV2 synchronize the selected step with the preview and remember the selected product when moving between steps.
- SiteDesignWorkspace and SiteDesignPreviewFrame expose the order steps in navigation, with the correct current-page selection.
- Preview startup retries and detached-window branding requests read the latest committed selection. A deterministic browser regression reproduced a delayed callback reverting Standard 2 to Alternative 1 before this correction; its failure report is `tmp/order-flow-publish-20260920/browser-stale-retry-before.json`.
- PreviewShop replaces its fixed checkout placeholder with the shared checkout, proof, payment and confirmation layout components. The designer preview uses the actual designer layout classes around an explicitly labelled example canvas. Proof, designer, payment and confirmation match the fullscreen customer presentation.
- SiteDesignOrderFlowPreview uses example content and virtual preview navigation. It mounts no checkout mutation, upload, design persistence or payment form SDK. Its card-payment inputs and actual designer tool actions are disabled. It is a layout preview, not an operational order-flow test.
- All selections remain under `themeSettings.orderFlowDesigns`. Existing tenant/master adapters already retain that complete object in draft, saved designs, published branding and history. No adapter implementation, database schema, pricing formula or POD behavior changed.
- Current customer source consumes the published selections in ProductPrice, FileUploadConfiguration (checkout, proof, payment, confirmation) and Designer. No comparison URL is required for published selections.
- The existing publish confirmation includes a six-step summary. Its invalid paragraph nesting was corrected.

## Verification and boundaries

The exact repository is served by the existing Vite process on `http://127.0.0.1:8111`. Its normal configuration connects to hosted services; no real save/publish, payment, upload, email, supplier order or deployment was performed for this change.

The regression browser uses a fresh context, synthetic tenant/product data and intercepted service calls. Settings are persisted only in that context's localStorage. The real editor, iframe, adapters and customer route components execute. The normal authenticated admin route redirected to login; hosted authenticated publishing is therefore **not verified** by this work.

- 26 focused Node tests pass across order-flow definitions, virtual preview paths, branding adapters, preview navigation and product-pricing preview messages. Tenant and master tests cover all six selections through draft reload, saved-design reload, publish and history restore while preserving unrelated settings.
- The browser regression switches all twelve choices in the editor, checks synchronized step navigation, preserves designer example text during switching, saves/reloads the draft, checks the six-row publish summary, and publishes all six choices to the synthetic backend.
- Actual customer product, checkout and designer routes read the synthetic published selections without layout URL overrides. No payment was initiated and no customer order was completed.
- Both layouts of the five new step previews pass 80 no-horizontal-overflow checks: 1440, 1280, 1024, 768, 701, 700, 390 and 320 px. Desktop/mobile screenshots were inspected, including the proof contrast/fullscreen-header corrections.
- Production frontend build passes. Existing large-chunk/dependency warnings remain.
- Full TypeScript checking still has 403 existing diagnostics; it is not a clean repository-wide typecheck. New preview files introduce no reported TypeScript errors. Scoped ESLint checks and before/after comparisons distinguish existing diagnostics from new work.
- Browser reports contain no uncaught page exceptions. They retain local Chromium/Vite HMR WebSocket blocking messages and an existing PriceMatrix missing-key warning on the synthetic product route; no claim of an entirely clean console is made.

Evidence: `tmp/order-flow-publish-20260920/browser-report.json`, `tests.log`, `build.log`, `typecheck.log` and screenshots in that directory. Build output is `/private/tmp/webprinter-order-flow-publish-20260920`. Browser regression source is `src/lib/branding/orderFlowPublishing.browser.test.mjs` (requires a running local Vite server; defaults to port 8111).

## Release and rollback

This is a local implementation. Deploy the frontend through the project's normal release process before expecting live shops to have the updated editor. Authenticated hosted draft/save/publish acceptance remains separate from the synthetic checks above.

The worktree contains extensive unrelated edits. Revert only the additions documented here and corresponding new preview/test files if rollback is required. Before-edit snapshots for touched existing implementation files are under `tmp/order-flow-publish-20260920/before/`; do not reset entire files against Git HEAD. There are no data migrations or hosted writes to reverse.
