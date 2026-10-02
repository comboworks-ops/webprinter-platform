# Wide-format template implementation — 1 October 2026

Thomas authorized the generated-template, proportional-shape and free-form cutting implementation, including verification of the actual application flow. This supersedes the implementation-pending section of `GULVFOLIE_TEMPLATE_REVIEW_2026-10-01.md`.

## Behavior

- The entered finished size generates a stateless vector PDF at `/api/wide-format-template?v=1&shape=...&widthMm=...&heightMm=...`. No PDF catalogue or database import is needed per size. Download and Designer resolve the same geometry. Vite serves the actual edge handler locally; production uses the existing filesystem routing for API functions.
- Rectangles retain independent dimensions. Circles use a diameter and remain square. The 32 Gulvfolie presets uniformly scale their actual supplier cutting outlines; changing either dimension updates the other before the unchanged quote calculation. Source hashes/URLs and source-owned IDs are retained in `gulvfolieShapes.ts`. Remapped tenant IDs require explicit matching supplier provenance/source bindings; labels alone cannot select a die.
- Every generated template has a physical 3 mm bleed. Its page/bleed/crop box is finished size + 6 mm; trim/art box is inset 3 mm. Round-join distance bands follow the actual contour rather than scaling the silhouette. Narrow details can have no safe core. Rectangle safety inset is 3 mm. Guides live in an optional-content group with Print/Export OFF and are excluded by the locked Designer template overlay.
- Preset production cutting lines are independent vectors, locked to the selected geometry and exported using the existing CutContour separation/overprint logic. Their exact transforms and integrity signature survive saved designs and undo history.
- Free form provides no predefined template or download. The existing PDF artwork/SVG cutting tools require exactly one continuous closed cutting path. Missing, open, disconnected, grouped multiple or duplicate cutting geometry is rejected. Compressed PDF resources/graphics streams and nested forms are inspected; a colour-name dictionary alone does not count. Unsupported PDF inspection fails closed. EPS requires conversion to PDF/SVG; Photopea's raster EPS output is not presented as a cutting-vector conversion service.
- Production save, Print/Vector export and checkout return validate cutting geometry. An empty free-form canvas cannot bypass checkout validation. A valid contour-only design still exports its production line. Save metadata in existing `editor_json` preserves cutting requirements and generated template URL; reopening does not depend on a checkout session or template query parameter. Saved artwork loads while retaining the document's static guides/background.
- Existing production export limits PDF pages to 5080 mm; with 3 mm bleed the maximum generated finished dimension is 5074 mm. Larger jobs require the existing agreed production-scaling workflow and cannot silently open a mismatched template. This limit is unrelated to price calculations.

## Verification

Evidence is retained in `output/qa/wide-format-templates-2026-10-01/`.

- 30 focused checks cover all preset proportions, arbitrary decimal dimensions, extreme aspect ratios, source/tenant bindings, API validation/determinism, physical offsets/page boxes, optional-content layers, one-path validation and compressed embedded-PDF contours.
- Actual React ProductPrice, StorformatConfigurator, EditorCanvas, Designer and checkout components were exercised in isolated Chrome at port 8160. The captured product/configuration and private save/upload/readback storage are local fixtures; every remote request is intercepted. Actual local generator/export/save/checkout code executes. Supplier thumbnails are substituted fixture images, so screenshots are not evidence of the hosted visual assets.
- Browser checks cover product selection/download, Designer launch, dimension/quantity/shape restoration, circular dimensions, locked preset cutting geometry, actual Print PDF dialog, save/load persistence, session-independent saved-design reopening, missing/open/disconnected/duplicate rejection, production upload/hash and checkout file readback. The fixture checkout returns to `/checkout/konfigurer`, the real route.
- Product layouts have no horizontal overflow at 1440, 1280, 1024, 768, 390 and 320 px. The original user's browser tabs and drafts were not reset.
- Independent pypdf inspection confirms a 370 × 610 mm rectangle has a 376 × 616 mm bleed page, while 300 mm circle/free-form exports have 306 × 306 mm pages. Print files omit helper optional-content layers and preserve CutContour. The checkout file bytes match the session SHA-256.
- Full application TypeScript, focused new-helper ESLint, the frontend production build and minified API bundle pass. The build retains existing bundle-size/dependency warnings.

These results prove local application flow with isolated persistence. They do not assert a deployment, authenticated hosted persistence/RLS acceptance, publication, payment, supplier pricing approval or supplier production acceptance. No hosted products, prices, storage or publishing flags were modified, and no migration was created. Prior supplier pricing review boundaries remain in force.

## Files and rollback

New geometry/validation modules are under `src/lib/designer/`; the source extraction script is `scripts/product-templates/extract-gulvfolie-contours.py`. The additive endpoint is `api/wide-format-template.ts`, with local middleware in `scripts/local-wide-format-template-plugin.ts`.

For rollback, remove only this endpoint/middleware and the generated geometry/cutting-validation wiring from ProductPrice, StorformatConfigurator, Designer, EditorCanvas and the production exporters. Preserve the existing source/pricing/import work and dirty worktree. No database rollback is necessary. Saved `editor_json.wideFormatRules` is additive; older readers ignore it, but would lose these new safeguards.

Local review: `http://127.0.0.1:8160/output/qa/wide-format-templates-2026-10-01/review.html`.

## Local continuation — required cutting preflight

The Designer's automatic preflight previously treated any PDF background as a possible cutting line and deferred its verification to production export. It now awaits the same decoded-PDF and preset-integrity validator used by production export. A missing, open or duplicate embedded contour is a non-ignorable preflight error, and restoring the original contour clears it. Export awaits that result. Canvas changes invalidate pending checks immediately so an older PDF check cannot overwrite newer sidebar results. Existing resolution/boundary rules, pricing, POD and saved artwork behavior are preserved.

Canvas validation also rejects non-finite polygon coordinates, collapsed outlines, infinite dimensions and malformed saved path commands. SVG paths use Fabric's existing normalized M/L/C/Q/Z representation; no additional import format is introduced. EPS conversion remains required.

Continuation evidence: `output/qa/wide-format-continuation-2026-10-01/`.

- 35 focused tests pass, including the reproduced invalid-polygon regression and required PDF/preset validation cases.
- 18 actual-browser checks pass with no console errors, covering visible automatic preflight, correction and duplicate-path rejection alongside the original product/save/reopen/export/checkout journey and six viewport widths. All external requests are intercepted; persistence and uploads are synthetic.
- Six independent PDF inspections pass, including the checkout file's SHA-256, finished dimensions plus 3 mm bleed, guide-layer exclusion and production CutContour preservation.
- All 32 preset SVGs pass the stricter contour validator after parsing with the actual browser Fabric library. The updated review route, its images and the dynamic PDF endpoint are browser-verified.
- Full application TypeScript, focused helper/test ESLint and the final production build pass. Existing dependency/bundle warnings remain.

Updated review: `http://127.0.0.1:8160/output/qa/wide-format-continuation-2026-10-01/review.html`.

No hosted writes, publication, deployment, migration or pricing changes were performed. Rollback this continuation by restoring only the prior required-cutting preflight call and canvas-validation changes; retain the generated-template implementation and other dirty work.
