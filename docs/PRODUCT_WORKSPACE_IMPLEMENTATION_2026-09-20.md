# Product workspace — 20 September 2026

Local implementation of the selected picture 2, “Arrange the Ordering Form”. User explicitly requested implementation after confirming the supplied image. The product locator remains the preceding step. Wide-format and combined machine/learning layouts are the next design-selection step.

## Entry and scope

Existing products with `pricing_structure.mode = matrix_layout_v1` now open `ProductWorkspace` from `ProductPriceManager` when no tab hash is present, or with `#workspace`. “Produkt & priser” opens the existing `#produkt` editor and “Byg bestillingsformen” returns. Original new-product setup, legacy pricing, POD imports, wide-format calculations and machine calculations remain in their existing flows. This is the ordering-form editor, not a replacement supplier importer or pricing engine.

The left panel searches/reorders groups, moves imported choices into new presentation categories, selects buttons/dropdowns/radio/picture/hidden modes, switches format/material between selector and matrix axis, and edits labels, optional selections, imagery, hover images, picture size and motion. Detailed choice/image and effect settings use keyboard-operable disclosures. Product name, description and gallery are editable. Existing source section/value IDs remain the price identity even when a choice appears in another category; choices from one source remain mutually exclusive.

New presentation groups are functional. Entirely new choices are currently explicit unpriced draft placeholders and block Apply. Their priced source options must still be created in the existing Product & prices workflow. Placeholder-to-priced-option linking is not implemented; after updating the source configuration, use the resulting real option in this workspace. Do not claim the full new-product/pricing workflow is complete.

## Shared storefront and Site Design

The preview renders the actual `ProductPrice`, `ProductCalculatorLayout`, `MatrixLayoutV1Renderer`, `PriceMatrix`, `ProductPricePanel` and shared media gallery. Product-card preview uses the actual `ProductGrid` and configured card/button styles. Site Design product previews also use this product-page renderer instead of a separate content copy. The compact editor frame omits storefront header/footer but retains theme, customer controls, media, pricing and layout. Desktop/mobile switches change the preview viewport.

Published design and saved Site Design draft can be compared. Layout names/options come from the shared order-flow registry; there is no separate product-editor design list. The editor refreshes Site Design settings on window focus. Original section titles/modes share their native settings with Site Design, while newly created presentation categories own their labels. New renderer designs still require registration/implementation in the shared registry; no autonomous layout invention is claimed.

Only explicit matching price-row production metadata produces Digitaltryk/Offsettryk labels. Quantity alone never determines printing method. Fixtures use a 1000-copy transition solely as example data. Real imported prices without metadata show no invented method.

Preview messages are restricted to same-origin and the appropriate parent/frame source. Workspace previews ignore the unrelated shared branding BroadcastChannel. In preview, design/upload/checkout/download actions are prevented; customer selection controls remain interactive.

## Persistence and data ownership

`productWorkspace.ts` owns only presentation fields: vertical axis/layout rows, customer selection order, workspace groups and workspace content. `saveProductWorkspace.ts` reads the current product scoped by tenant and product ID, rejects stale structure/content, then conditions the update on `updated_at`. Save draft stores a versioned draft without changing the live form. Apply validates source references, names and pending options, updates canonical name/description/image with the form in one product update, and removes the draft. It does not publish an unpublished product.

Source prices, supplier identity, fulfillment, quantity lists and templates are not owned by this editor. Moving options preserves source references. Concurrent-save conflicts keep the user's unsaved edits visible. Unsaved navigation is guarded. Stale drafts are retained in storage until a subsequent save; current source data opens with an explanatory message.

Image uploads validate JPEG/PNG/WebP and a 5 MB limit, then append a uniquely named object under the existing product-images bucket. Removing a draft image reference does not delete storage objects. Hosted image upload and real storage policies have not been end-to-end verified.

## Visual QA

Final result: passed for the selected local ordering-form workspace scope, with the scope limits above.

Reference: `output/product-workspace-concepts-2026-09-20/2-arrange.png`, 1513 × 1040. Source image and rendered browser capture were emitted together in the task at the same desktop viewport. The same existing admin header, white panels, navy text, restrained blue selection, left inspector, central product image and right customer form are retained. Rendered captures are in the conversation; no standalone screenshot file is claimed.

Intentional differences: the implementation shows the actual product's existing photo and supplier options instead of the generated artwork; current Site Design controls and pricing matrix/order panel determine customer content. An Apply action is separate from Save draft. Source variant-merging controls are not fabricated where existing product data supplies attribute groups. Tenant branding is preserved rather than hard-coded to the mock's button colour. The additional post-import requirements are available through disclosures.

Resolved findings: tiny image-choice dimensions were increased to the configured 80 px default; a hidden upload input inheriting full-width input styles caused horizontal overflow and was corrected; image/gallery balance now uses the shared customer layout; dense always-open image/effect controls became disclosures. Final keyboard disclosure check passed. The original direct-component test entry was replaced with the real ProductPriceManager so route mounting and advanced-editor return were also exercised. A misplaced initial render branch was corrected before final integration verification.

Responsive checks: document width equals viewport at 1440, 1280, 1024, 768, 390 and 320 px. Customer mobile iframe measured 388 px content/viewport with no horizontal overflow. Desktop 1513 × 1040 source comparison and responsive test overrides were reset after verification. This is not a full accessibility audit; named controls, keyboard disclosures/reorder controls, visible focus and reduced-motion treatment are included.

## Verification

- 33 focused tests pass: workspace draft/publish ownership, imported source identity, matrix-axis swaps, missing/duplicate options, pending unpriced choices, explicit method labels, tenant scoping, conditional writes, content conflicts, and existing pricing-preview/Site Design registry/navigation tests.
- Production build passes with the repository's existing bundle-size warning.
- TypeScript snapshot comparison: 403 existing diagnostics before and after, no newly introduced diagnostics. New task files are excluded from baseline root inputs and included in current compilation. The repository is not globally type-clean.
- Browser test: reorder groups; Fold buttons to picture choices; move Rullefals to a new Efterbehandling group; save draft/reload; Apply; switch format/material axis; compare saved versus published Site Design; product card/page; desktop/mobile; disclosure and preview selection; block unpriced Apply; prevent preview checkout.
- Standalone actual customer page reads the applied form: Rullefals at 500 = 760 kr and at 1000 = 1360 kr; selecting 1000 shows Offsettryk. This matches the editor using the same synthetic product/prices.
- Actual ProductPriceManager entry, advanced Product & prices, return, and saved-draft reload all work with the synthetic client. No pricing writes were performed.
- Editor console clean. Initial standalone fixture lacked Language/CookieConsent providers; these were added to match app composition. A relative dynamic client import in the advanced editor exposed a fixture alias gap; all client import forms now resolve to the synthetic client. The isolated server has no hosted backend environment.

Browser verification uses example data and a fully synthetic Supabase client, not hosted authentication, RLS, production data, real storage uploads, checkout/payment or fulfillment. No migrations, hosted writes, production publishing or deployment were performed.

## Review and reproduce

Local review: `http://127.0.0.1:8112/admin/product/foldere?tenantId=11111111-1111-4111-8111-111111111111`.

Start from the repository with `node node_modules/vite/bin/vite.js --config tmp/product-workspace-20260920/vite.config.mjs`. On this machine Node is at `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. The fixture persists example product drafts in browser-local storage; it replaces all Supabase client imports and rejects unexpected non-product mutations. Fixture `entry.tsx`, `fixture.ts` and `vite.config.mjs` are under the ignored local `tmp/product-workspace-20260920` directory. Do not treat normal localhost ports as isolated: they may use the hosted backend.

Test/build/typecheck logs and the baseline comparison script are in the same tmp directory. Run the six test files named in `tests-final.log` with Node's test runner. Source files before this task are saved under `tmp/product-workspace-20260920/before`.

## Selective rollback and next step

No database rollback is needed because no database changes were executed. For source rollback, compare each touched file with its before snapshot and reverse only this task's hunks; remove the new ProductWorkspace/model/save/gallery/image-input/styles/tests only after removing their imports. Preserve all other pre-existing staged/unstaged work. Reverting entire files from Git would destroy unrelated changes. Any later real Apply should be reversed using its recorded prior product structure/content with tenant and freshness checks, not a bulk update.

Next design decision: choose the wide-format interface and the combined machine setup + AI learning workflow. Existing price-curve logic, rounding rules and machine calculation backend were not altered in this task. Authenticated hosted save/readback and image upload remain required before release acceptance.
