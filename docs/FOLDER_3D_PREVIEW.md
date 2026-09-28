# Interactive customer-artwork folder preview

Rollout planning (28 September 2026): [the saved 3D review queue](3D_ROLLOUT_PLAN.md) now inventories linked product templates and keeps each new construction/variant pending its own model review. Canonical progress is in `docs/3d-review/plan.json`; the local browser view is `/output/3d-review-queue/index.html`. This planning addition does not enable new models or change product assignments.

Implemented locally on 27 September 2026. No deployment, database changes, product writes, order creation, pricing changes or production file uploads were performed.

## WebPrinter shared system — 28 September 2026

The 3D system belongs to WebPrinter. Salgsmapper was the first test product, not a separate implementation. Geometry, folds, lighting, customer artwork, product media, checkout and Designer components are shared. Shops supply their own branding and tenant-scoped file context. Different constructions need independently reviewed models and print surfaces; a generic A4 label never grants a model.

Removed the single Salgsmapper product-ID check from the resolver and product page. Known template fingerprints work across products. The original supplier template/option schema retains its reviewed compatibility recipe; it no longer requires a particular product ID or domain. New master product assignments use **`pricing_structure.workspaceContent.preview3d`** (presentation metadata only):

```json
{
  "version": 1,
  "variants": [{
    "templateHash": "3b275741a4a7936f5b57924f22e0e03acebf5cfba9b6e6e850ede758597ac5a5",
    "conditions": [
      { "sectionId": "format-section", "valueId": "the-products-reviewed-a4-option-id" },
      { "sectionId": "spine-section", "valueId": "the-products-reviewed-1mm-option-id" },
      { "sectionId": "print-section", "valueId": "the-products-outside-print-option-id" }
    ]
  }]
}
```

Use actual option IDs, not the placeholders above. Each variant references a reviewed fingerprint in the shared registry. Empty conditions are only appropriate for a fixed-construction product. Invalid/disabled configuration, unknown fingerprints, unmatched conditions and ambiguous variants fail closed. `preview3d: false` or an empty variants array disables the product illustration. Illustration assignments do not grant customer-artwork support: the separate exact fingerprint/full-sheet checks remain in place, and 4+4 customer artwork is still unsupported.

The existing `copy_product_payload_deep` SQL remaps attribute IDs recursively within `pricing_structure`, including `workspaceContent`. Conditions therefore store section/value IDs as JSON **values**, not object keys. This follows the existing gallery-condition convention and avoids stale master option IDs in shop copies. No SQL or price calculations were changed. The config reader/schema is implemented locally; an admin assignment editor and actual persisted master assignments have not been added in this step. New or copied products need the assignment stored through the existing product draft/save flow before relying on its unlinked print variants. A future assignment editor must preserve that flow and its tenant checks.

Browser review of WebPrinter's master catalogue (`tenantId=00000000-0000-0000-0000-000000000000`) found the published **Salgsmapper uden vinger** product. It is a different construction and correctly has no two-flap 3D preview. It needs its own verified template/model; no master product was overwritten or created to make this demonstration appear there.

Validation: 25 focused tests, full TypeScript, scoped resolver lint and production build pass. Tests cover remapped option identities for master and two shop fixtures, explicit disabling, malformed/ambiguous assignments and unknown models. The real Salgsmapper local page retains both illustration modes, inline login/upload, file handoff, sign-out reset, six widths and consistent headers. Browser auth/storage were intercepted; import inheritance was checked against the existing SQL plus remapped fixtures, not by writing live products. Evidence: `output/qa/webprinter-3d-core/` and the reproducible `output/qa/folder-inline-upload/verify.mjs`.

## Try it

Run Vite from this checkout and open `/folder-mockup.html` (current separate preview: `http://127.0.0.1:8160/folder-mockup.html`). This development-only page imports the same viewer as the product page and checkout/designer. The initial tab shows plain product previews for 4+0/4+4; **Med din egen fil** accepts a local PDF or image and includes clearly labeled sample artwork. Its file reader has no storage client and sends no artwork to a server.

## Product media area — 28 September 2026

Compact follow-up: the inline viewer now has one small specification line, 28 px camera buttons in the lower corners and 26 px fold controls immediately below the picture. The previous instruction paragraph and explanatory footer are removed from the product preview; customer-artwork dialogs retain their existing layout. Touch devices retain 44 px targets. Both existing calculator layouts keep their own arrangement and branding.

For an eligible 4+0 artwork template, **Upload fil** now uploads directly on the product page and maps the actual file onto the inline model. This replaces the initial shortcut that navigated to checkout. The user explicitly requires login before product-page upload: an inline sign-in dialog preserves the product route and choices; authenticated customers can open the file chooser. The handler verifies the current non-anonymous user before reading or uploading the file. Account creation and password recovery use the existing auth page in a separate tab. Editor previews and unsupported artwork mappings do not offer upload.

`prepareFolderUpload.ts` rasterizes a single-page full-sheet PDF (494 × 366 mm, within 0.2 mm) or PNG/JPEG locally. The unchanged `uploadCheckoutFile` service stores the original using the existing private upload contract and SHA-256. Failed replacement keeps the previous artwork. Changing the template/product/tenant or signing out clears the draft; stale asynchronous results cannot replace the current model. Quantity changes retain it. The product draft is in memory until deliberate checkout navigation; this does not add an account design library or restore the preview after a product-page reload.

The normal **Upload eller bestil** action still owns checkout navigation and authoritative quote/template validation. It carries the uploaded original, preview and placement metadata forward, clears an older designer export and requires proof approval. Existing placement tools and production-file approval remain in checkout. Existing guest checkout upload policy is unchanged; the new login gate applies to this product-page entry.

Header correction: removed order-layout CSS that overrode shop header colours, logo colours, background and effects. The saved tenant header now applies consistently on product and checkout routes; content layout presets and their button styles remain unchanged.

Current validation: 22 focused tests, whole-app TypeScript, scoped mockup ESLint and production build passed. Browser checks cover login gating, rejected credentials, wrong-size PDF rejection before upload, actual inline PDF artwork, failed replacement, variant changes, sign-out, deliberate checkout handoff with matching file hash and mandatory proof, all six widths, and equal header colours across product layouts 1/2 and checkout layouts 4/6. Authentication/storage were simulated locally; hosted authenticated persistence remains unverified. Evidence: `output/qa/folder-inline-upload/report.json`, `verify.mjs` and screenshots. The original checkout and Designer tabs were preserved; a separate product review tab was opened. No deployment or hosted writes.

Compact validation: both layouts passed at 1440/1280/1024/768/390/320 px; a separate 320 px touch-browser case passed with 44 px targets and no overflow. Keyboard upload navigation retained the chosen 75-unit quantity, selected options, physical dimensions and template fingerprint. Selecting a synthetic PDF in the real checkout then opened its artwork on the 3D model. Storage requests were fulfilled locally; there were no hosted writes. Eleven focused tests, whole-app TypeScript, scoped mockup lint and final production build passed. Evidence: `output/qa/folder-compact/report.json`, reproducible `verify.mjs` and screenshots. No saved design selection or deployment changed.

The real product page now has a **Produktbillede / Se mappen i 3D** switch in its media area. The reviewed sales-folder family gets this media area even when its gallery metadata is absent. The previous actions inside `ProductPricePanel` were removed. `ProductFolderMedia` and the customer dialogs share `FolderPreviewSurface`, including lazy loading and error fallback.

Review the actual product with the existing Nordic Product Studio layout at `http://127.0.0.1:8160/produkt/standard-sales-mapper-kopi-2?force_domain=salgsmapper.dk&orderDesign=2`: photo/3D on the left, selections on the right, and the matrix below the media. Salgsmapper's published branding currently selects layout 1 (Precise Matrix); this local link uses the supported layout-2 preview override. No saved shop layout was changed.

Shading follow-up: the plain product model now uses four distinct shades of the shop hue (medium cover, light back, darker side flap, darkest bottom flap), fine contours on both faces, directional lighting and soft cast shadows. Unprinted inside panels remain neutral paper shades. A tighter camera near plane improves depth precision for the thin paper layers; shadow bias avoids surface self-shadow patterns. Customer artwork retains its own colours and the existing lighting. Final six-width browser/fold/focus/artwork checks, TypeScript, scoped ESLint and build passed; screenshots and console results are in `output/qa/folder-shading/`. This is a local rendering change only.

Before a customer uploads artwork, the inline product folder has no graphics, text or badge. Its solid colour comes from the active shop branding (including preview branding), with a blue fallback. 4+0 leaves the inside white; 4+4 colours both sides. Fold buttons, orbit/zoom and lighting are shared with the customer-artwork viewer. The stage is capped at 350 px on desktop; customer dialogs are capped at 780 px wide. Unsupported product selections return to the photo and disable the 3D tab.

`productFolderPreview.ts` keeps this illustration separate from customer-file eligibility. It supports the reviewed 4+0 fingerprints plus the 4+4 A4/1 mm supplier PDF fingerprint `323b466a1f2eb269d3804dc1ae8a074d992be5d2ce463299e2087984a168bb17`. Its first-page cut and fold paths were compared with the 4+0 source and are identical.

The current `standard-sales-mapper-kopi-2` product has no linked 4+4 designer template. A reviewed template / format-section / spine-section / print-section recipe enables the illustration for its verified A4 / 1 mm selections. Other formats, spines and incomplete selections are rejected, even if a stale template fingerprint is present. Selection IDs come from the existing quote; the preview does not modify it. The former product-ID dependency was removed in the shared-system follow-up above. Product data, template selection, pricing and publishing are unchanged.

Customer-upload and designer artwork remain 4+0 only. This addition does not map uploaded inside artwork or install a 4+4 designer template.

Validation: eleven focused tests, full-app TypeScript, scoped ESLint and production build passed. Browser checks covered 1440/1280/1024/768/390/320 px, dialog overflow/touch targets/focus, both print modes and existing artwork rendering. The actual local product page was checked for 4+0 and 4+4, unchanged quote/session state after preview, and hidden preview for 5 mm/A5. External writes were blocked during automated QA; normal product/tenant reads were allowed. Evidence: `output/qa/folder-product/`, including `report.json`, `selection.json`, `dieline-comparison.txt` and screenshots. No deployment or hosted writes.

Placement follow-up validation: eleven tests, full-app TypeScript, scoped ESLint and production build passed again. Actual product-page checks cover inline keyboard switching, both print modes, unsupported selections, unchanged quote/session state and all six widths. Upload/designer integration, a freshly selected PDF and proof-placement adjustment all passed: dragging the uploaded artwork changes the next 3D texture while retaining the same source file. Changing the designer canvas changes its next 3D preview and preserves editor state. Reports and screenshots are in `output/qa/folder-placement/` (`product-page.json`, `integration.json`, `fresh-upload.json`, `upload-placement.json`). Storage writes were fulfilled locally in test browsers; hosted persistence was not tested. The user's original designer tab was preserved.

The actual upload and designer pages now show **Se dit design i 3D** for a supported template. A customer can rotate/zoom the folder, click the cover or either flap, operate equivalent keyboard-accessible buttons, unfold everything, close it, reset the view or look at the back. The camera accommodates an open folder on narrow screens. Unsupported WebGL and viewer-load failures retain a flat artwork preview.

## First supported construction

- A4 sales folder, two flaps, 1 mm spine, outside print (4+0).
- Exact full print sheet: 494 × 366 mm. Trim document: approximately 484 × 356 mm, with 5 mm bleed.
- Geometry/UV coordinates are taken from the existing supplier PDF, not from the promotional product image. No Top Seller badge or built-in customer logo is used.
- Outside-only template SHA-256: `3b275741a4a7936f5b57924f22e0e03acebf5cfba9b6e6e850ede758597ac5a5`.
- Equivalent original 4+0 template SHA-256: `300a54250aea3b6e554a0e9723f2a2ef1e79e2f4ff3dd8649b9582bd7f45633e`. Its second grey reference page is not printed; only artwork on page 1 enters this model.
- Unknown fingerprints and incompatible sheet dimensions do not enable the customer-artwork viewer. Other spines, constructions and 4+4 customer artwork are not silently assigned this model. The separate plain product illustration is described above.

## Artwork mapping and state

`src/lib/mockup/folderDefinition.ts` contains the panel outlines, hinge locations/angles, sheet origin, print mode, reviewed fingerprint bindings and placement math. Cut curves are sampled and tiny locking cuts are represented visually; this is a product preview, not a manufacturing simulation or colour contract proof.

`src/lib/mockup/artwork.ts` reproduces the upload proof's physical size, object-contain fit, scale and percentage offsets on a white sheet. It includes the uploaded artwork only, never the technical overlay. The first PDF page uses the existing upload rasterization pipeline.

The designer snapshots the current outside page using its existing canonical export viewport and guide-hiding helpers, capped at 2048 pixels. Each opening captures the latest design. Canvas data, selection, zoom/pan, guides and export flags are restored. Dialog keystrokes cannot invoke the editor's destructive/creation shortcuts. Transparent areas appear as unprinted white paper.

`FolderMockupButton` owns asynchronous capture, cancellation and modal focus. `FolderPreviewSurface` owns the shared lazy viewer and load-error boundary. `FolderViewer` maps one continuous texture over all outside panels, leaves the inside unprinted, orders cover/pocket movements, and disposes the renderer, textures, geometries, listeners, observer and animation frame on unmount. Existing proof approval and production export remain independent.

## Adding another construction

1. Obtain and verify its exact supplier dieline and print-side orientation.
2. Define sheet size, origin, panel outlines, hinge axes, fold angles and layer spacing. Extend fold state/sequence handling when the topology differs from these three movable panels.
3. Add an explicit reviewed template fingerprint binding. Do not identify a model by a product title, generic A4 format, or approximate matching dimensions alone.
4. For 4+4, first implement second-page capture/rasterization and the correct reverse-side UV mapping in both entry points. Never mirror the outside artwork onto the inside automatically.
5. Verify labelled artwork across all hinges, inside/outside, bleed placement and fold sequence before exposing the new binding.

## Local validation

- Eight focused tests passed: fingerprint/size eligibility, bleed/scale/offset math, continuous sheet UVs, fold-state safety and guide/export-state restoration.
- Whole-app TypeScript and production build passed. The viewer is a separate lazy chunk; the existing large-main-chunk build warning remains.
- New modules passed ESLint with no warnings.
- Browser checks passed at 1440, 768, 390 and 320 pixels: actual PDF/image selection, incorrect PDF size rejection in the lab, clicking the 3D cover, fold controls, framing, Escape/focus restoration and WebGL fallback.
- Actual Designer page: a full-sheet image appears on the model; changing artwork changes the next preview; opening/closing plus keyboard operations preserve canvas JSON, viewport and guide visibility.
- Actual checkout page: restored artwork and a freshly chosen PDF both reach the 3D viewer. For the fresh-upload test, allocation/read responses and the storage PUT were fulfilled in the test browser. This proves local UI integration, not hosted storage persistence.
- Integration tests allowed normal read-only tenant/product requests, blocked unrelated external mutations and made no production writes. Existing previews and unsaved user tabs were not refreshed or replaced.

Evidence and reproducible local test scripts are under `output/qa/folder-mockup/`, including `integration.json`, `files-and-fallback.json`, `fresh-upload.json` and screenshots. The PDF/image artwork fixtures are synthetic test graphics, not customer data.

Rollback: remove the two `FolderMockupButton` call sites in upload/designer and the `ProductFolderMedia` wrapping in `ProductPrice`, restoring its original gallery condition, to disable the feature. No schema or persisted-data rollback is needed. The viewer, model modules and Three.js dependencies can then be removed independently.
