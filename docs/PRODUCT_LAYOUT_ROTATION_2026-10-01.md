# Gulvfolie alignment, landscape bordservietter and artwork rotation

Implemented locally at Thomas's request on 1 October 2026.

## Changes

- Gulvfolie's existing bottom information card, including its text and reference image, now lives directly beneath the price matrix inside the left calculator column. Both calculator designs retain their controls, summary, branding and content. On mobile the information follows the matrix before the order summary. Other product information sections retain their existing placement. Supplier-provenance matching also covers Gulvfolie copies.
- Bordservietter defaults to landscape artwork dimensions for its existing formats. The shared standard-format parser retains explicit `landscape`, `vandret` and `liggende` labels instead of silently returning portrait A-series dimensions. The product-level default handles metadata dimensions and preserves an explicit portrait choice. Product guides, Designer handoff and checkout session receive the same dimensions. Saved designs and explicit custom Designer dimensions are preserved.
- The Designer has `Drej 90° mod venstre` and `Drej 90° mod højre` buttons for selected artwork. They rotate around the existing centre without rescaling, use the normal edit/history event, and support Undo/Redo. Multiple selected objects rotate together. Locked template overlays, guides and preset cutting lines are protected.
- Canvas serialization now applies the active selection's transform while writing its children, following Fabric's canvas serializer. This fixes the reproduced case where grouped rotation reopened with unrotated objects or incorrect positions. Temporary serialization transforms are restored immediately.

No pricing/POD calculations, stored supplier selections, database data, tenant settings, publishing flags or production deployments changed.

## Verification and boundaries

Evidence: `output/qa/product-layout-rotation-2026-10-01/`.

- 54 focused tests pass, including landscape names, default/explicit orientations, save encoding, production PDF transforms and existing template/cutting safeguards.
- Actual local Gulvfolie components pass alignment, single-render and overflow checks for both calculator designs at 1440, 1280, 1024, 768, 390 and 320 px. Desktop/mobile screenshots were visually inspected. These checks use captured product/configuration data and substituted thumbnail images; every external request is intercepted.
- Actual Designer toolbar checks pass for left/right rotation, centre/size preservation, Undo/Redo, multiple-selection serialization/reopen, PDF artwork production export and locked preset protection. These are isolated browser fixtures, not hosted save/upload acceptance.
- A separate read-only browser exercised the current published Bordservietter product, its existing format selectors and Designer button. Default A4 hands off 297 × 210 mm; A3 hands off 420 × 297 mm. Actual Designer backgrounds are landscape. Requests that could write are blocked; no payment, upload, saved design, product edit or publication occurs.
- Independent PDF inspection confirms the rotated export has a 426 × 303 mm bleed page for the 420 × 297 mm trim, with the original vector PDF embedded as a Form.
- Full application TypeScript, focused helper/parser ESLint and production build pass. Existing bundle/dependency warnings remain.
- The full frontend health gate still reports three pre-existing baseline increases: EditorCanvas explicit-any 83→88, StorformatConfigurator hook warnings 2→3, and wideFormatGeometry.test explicit-any 0→1. Reconstructing the two touched files before this request confirms their ESLint rule counts are unchanged; the geometry test was not modified. See `lint-regressions.json`. The health gate itself does not pass.

Review: `http://127.0.0.1:8160/output/qa/product-layout-rotation-2026-10-01/review.html`.

## Rollback

Remove only the Gulvfolie details slot/wiring/CSS, landscape default/parser additions and Designer rotation/selection-serialization additions. Preserve the existing template implementation, saved artwork, prices and unrelated dirty changes. No database rollback is required.
