# Unified product canvas editor — 23 September 2026

## Result

Matrix products now open one product-page workspace: the actual customer preview, a contextual section inspector, and the existing format/material/finishing bank. Click a section or value to edit its content and presentation together. Section toolbars support pointer dragging, up/down, swapping places, side-by-side rows and detaching from a row; option buttons support dragging within their section and accessible reorder buttons. Placement undo preserves later text/style edits. Hidden and empty sections have editor-only placeholders. Customer-preview mode removes all editor controls.

The bank edits a snapshot of the open workspace and returns its changes to that draft with “Brug på produktsiden”. It preselects the relevant section/category, includes search, and keeps the legacy advanced structure behind a disclosure. Existing save-draft/apply, source identities, price matrix and tenant guards remain the persistence path. New price combinations still require prices under Priser; changing presentation does not create prices. Matrix row editing remains fixed to the price table; nonmatrix product fallback remains unchanged.

## Verification

- 30/30 focused tests pass: placement/row membership, option order, undo preservation, workspace merge, tenant/concurrency save guards, option presentation and gallery.
- Full application TypeScript check and Vite production build pass on the hydrated verification copy. Build retains the existing large-chunk warning.
- Five new files pass ESLint with zero errors/warnings. Existing edited files have no increase over the pre-edit lint baseline.
- Actual signed-in localhost product page: UV-lak moved above Papirfinish with the on-canvas up button and by pointer dragging; swap works; option arrow and pointer dragging change the visible order. The selected product price remained 464 kr.
- Clicked hidden Format and opened its inspector; button/dropdown changes appeared in the actual preview. Customer-preview mode hides inspector, section tools and edit placeholders.
- Format bank loaded the existing library, automatically targeted Format when selecting Formater, filtered with A4, and closed with Escape. No bank entries were created/edited/deleted in QA.
- Responsive browser checks at 1440, 1280, 1024, 768, 390 and 320 CSS pixels: no horizontal page overflow; 320-pixel iframe content and bank fit. No physical touchscreen test was performed.
- Fresh review tab showed no error-level console entries before final cleanup.

## Runtime and safety boundary

The authenticated check used http://127.0.0.1:8113/admin/product/100x100mm-folder-midterfalset?findSelected=0afbb607-ebdc-4a4f-b08d-8ec863526426#workspace . Port 8113 serves /private/tmp/featured-product-review-2026-09-22/app, so the scoped source was synchronized there. All 14 scoped files match the working repository and /private/tmp/product-canvas-2026-09-23/app by SHA-256. Existing user product tabs had no visible unsaved-changes indicator before synchronization. QA edits were made in separate review tabs.

No hosted save, apply-to-shop, upload, payment, library mutation, deployment or database/schema change was performed. Persistence is covered by the existing pure/fake-client tests, not a new live save/readback. Final cleanup: the browser connection timed out after accepting the QA tab’s local reset confirmation. Native inspection then reported the Mac was locked. The reset result, normal viewport restoration (last test override 1280 × 1000), and deliverable-tab marking could not be confirmed. No further UI action was attempted after the lock was reported. Unlock the Mac before completing browser cleanup; do not discard any user-owned draft. The separate temporary verification server on 8136 was stopped; the user’s 8113 server was left running.

## Evidence and rollback

output/product-canvas-2026-09-23/ contains scoped-files.json, source-hashes.json, scoped.patch, original touched-file backups in before/, and test/build/typecheck/lint logs. Revert only the changes in scoped.patch after comparing for subsequent work; remove newly added modules only if no later changes depend on them. No data rollback is needed. Do not reset the full dirty worktree or replace unrelated source. The build is local evidence, not a production deployment candidate for all unrelated worktree changes.

## Follow-up: inspector on the left

At the user's request, swapped the desktop/tablet grid so the settings inspector is on the left and the actual customer preview is on the right. Preview-only mode still fills the full workspace width; the narrow mobile stack is preserved. CSS-only change in src/styles/productWorkspace.css, synchronized to active 8113 and the verification copy. Actual in-app browser measurements passed at 1440, 1280, 1024, 768, 390 and 320 pixels without horizontal overflow; preview-only width matched the container and returning to edit mode restored the left inspector. Screenshot inspected at the normal 933-pixel browser width. Temporary in-app viewport override reset successfully. Production build passed; no behavior tests added for this CSS-only change. No product save or publication performed. The earlier Chrome QA-tab cleanup remains separate.
