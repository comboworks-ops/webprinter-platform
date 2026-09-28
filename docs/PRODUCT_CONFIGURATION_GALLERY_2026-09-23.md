# Configuration gallery — 23 September 2026

Implemented in ProductWorkspace → Produktside → Billeder og produkttekst. General gallery entries have upload/link, caption, reorder and reference removal. Configuration entries use existing section/value IDs with one or more AND conditions. Most conditions wins; editor order breaks ties. General images remain below the main image, left-aligned. A clicked thumbnail persists through quantity/price changes and resets when a configuration choice changes. Unmatched choices use the existing main product image; failed image URLs fall back to another available image.

Stored additively in pricing_structure.workspaceContent.gallery using the existing draft/apply preview and tenant/timestamp guarded save. Legacy workspaceContent.images remains readable until gallery is edited. No migration, pricing calculation, POD behavior, publication control or tenant-distribution handler changes. Existing image storage and append-only standard upload helper reused, with real upload progress and bounded transfer errors. Late uploads cannot restore removed entries or overwrite newer caption/rule edits.

The matrix reports row clicks separately from option selectors. A presentation-only helper resolves the selected row to the existing vertical value ID; it does not alter checkout/pricing selection handlers. General gallery media also renders in generic and large-format page layouts. Configuration rule setup uses the matrix option sections available in the product editor.

## Verification

- Real authenticated localhost editor for Salgsmapper uden vinger, with temporary unsaved local SVG fixtures. A4 format image, A4 + Chromo-karton priority, manual material thumbnail, persistence across quantity change, reset on material change, default image for unmatched A5 and specific image on returning to A4 all verified. Keyboard Enter selects a thumbnail.
- Actual page widths 1440, 1280, 1024, 768, 390, 320: no document horizontal overflow; thumbnails 64 × 60 px and left aligned, wrapping. Desktop/mobile screenshots inspected. Viewport restored after browser reconnection.
- 23 focused tests pass: match specificity, exact section/value conditions, incomplete rules, legacy compatibility, matrix row mapping, draft/apply roundtrip, pricing preservation, tenant/concurrency safeguards, standard upload error/progress behavior.
- Production build passes (existing bundle-size warning). New gallery helper/editor/component and modified image input lint clean. Existing ProductWorkspace and StorformatConfigurator lint counts unchanged; ProductPrice loses one explicit-any error. Hook warning text line numbers shifted only.
- Final whole-app typecheck reports one unrelated concurrently introduced FileUploadConfiguration.tsx:2087 Json.mode diagnostic; gallery files have no diagnostics. Earlier typecheck before concurrent checkout changes passed. No source changes made to that checkout file in this task.
- Browser QA encountered a temporary missing-import overlay from concurrently changing checkout files, then recovered when their dependencies appeared. The final feature checks above ran after recovery. A browser reconnection closed the separate unsaved QA tab before the optional removal/reorder browser checks; no save/apply was clicked. The ordinary user editor remains open with an empty gallery, ready for actual images. Temporary runtime QA assets were moved to this evidence folder.
- No hosted upload, product save, publication, tenant send, payment or deployment performed by this task. Authenticated gallery upload/save/reload with actual user images remains a separate acceptance check.

## Source and rollback

Port 8113 is still served from /private/tmp/featured-product-review-2026-09-22/app. All ten changed/new gallery source/test files match the workspace byte for byte; see output/product-gallery-2026-09-23/runtime-sync.json. Before copies, repair.patch and test/build/lint logs are in that evidence folder. Revert only this patch in both copies to roll back; preserve gallery JSON and stored images. Do not roll back concurrent checkout work or previous upload/publication repairs. No backend rollback required.
