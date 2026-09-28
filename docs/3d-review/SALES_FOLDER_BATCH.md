# Sales-folder batch — 28 September 2026

Thomas explicitly approved candidate 007 (“The 10 millimeter is approved”) and requested all sales folders in one automatic pass. This supersedes the one-at-a-time review pause for this family. It does not invent individual visual approvals for the generated models or authorize publication.

## Delivered scope

- 143 review variants, covering A4, A5, A6, **M65**, and 21 × 21 cm; the listed 1/3/5/10 mm capacities, two/three flaps, windows, plain folders, closures and three-panel constructions; 4+0 and 4+4.
- 1,420 catalogue PDFs checked against their stored SHA-256, both page dimensions and page count. There are 78 distinct outside vector geometries, including seven tickets with finish-specific contour differences. Geometry is shared only when the measured vector signature matches.
- One additional legacy A4 5 mm PDF independently inspected: SHA-256 `6bb307f051fb3f39c96e21e959b795cd4b449544244e4c1e2ae75af941a03abe`, one page, approximately 504 × 371 mm; 5.500 mm cover crease pair and 5.000 mm pocket gussets. Its model is available for review, giving **79 geometries / 1,421 PDFs** in total.
- All 142 catalogue tickets (1,420 hashes) enter the shared local product/Designer/checkout renderer. The three individually approved A4 3/5/10 mm hashes retain their existing renderer and measured coordinates.
- The legacy PDF remains **review-only**: its product-level link has no format/print/spine conditions. Assigning it automatically could show a 5 mm folder for another selection. Products already parked without linked templates remain parked; this batch does not assign models by product name.

Review: [All sales folders](http://127.0.0.1:8160/sales-folders-review.html). Format, construction/print and material/finish selectors address the exact template. Local PDF selection is browser-only.

## Geometry and artwork

The build scripts extract magenta cut strokes and cyan creases from the actual PDFs. Cubic curves are sampled at 12 segments. Explicit small scissor gaps are joined (bounded at 4.2 mm); slit paths remain distinct. The outer cut is partitioned by measured creases, with submillimetre source endpoint gaps joined at the boundary. Partition area and connected tree topology are checked. Window contours become actual mesh holes and retain cut edges.

Each panel uses its own measured hinge and parent. Paired gussets share timing, the cover opens first, then interior panels and pockets. The default illustration uses white reader numbers on the active shop colour. Closure covers rotate the outside illustration 180 degrees so the folded front reads upright. Three-panel folders use reader pages 1–6.

4+0 uses one artwork spread and white inside faces, even when its source template has a grey reference page. 4+4 requires two whole spreads, outside then inside. The inside texture has its own UVs and reverses sheet X coordinates; the outside image is never reused as inside artwork. Comparison against inside cut silhouettes found source asymmetries up to 1.298 mm around local cut features; no PDF coordinates or uploaded graphics are rewritten to hide them. This is a visual preview, not a registration proof. Carton caliper (0.30 mm), bend clearance and edge shading are illustrative. Diagonal tongue creases are retained in geometry, but insertion, paper flexibility and locking are not physically simulated. Surface finishes are not photometrically simulated.

Professional-PDF-only template metadata is preserved. The new preview registry does not grant Designer access or change template, pricing, input, proof/payment or publishing contracts.

## Verification

Evidence directory: `output/3d-review-queue/sales-folder-batch/`.

- **46 focused tests pass**, including original flat/folded/spine models, all exact registry identities, changed/unknown hash rejection, dimensional/bleed guards, tenant-remapped rules, connected finite panel trees, closed broad-panel normals, window holes and reader page numbering.
- Whole-app TypeScript and scoped ESLint pass. Scoped whitespace check passes; the broader dirty checkout retains unrelated pre-existing trailing whitespace. Full production application build passes; existing large-chunk warnings remain.
- **All 143 review variants** were selected, rendered and unfolded in the browser without alerts. This confirms runtime coverage, not an individual human approval of every shape.
- A6 / two flaps / 10 mm / 4+4 accepted a synthetic orange-outside/green-inside PDF. The open model shows green interior faces with orange folded pockets. Wrong page count and wrong dimensions were rejected, preserving the previous artwork. Changing the model cleared that artwork.
- Screenshots inspected for A6 two-sided, M65 closure front, A4 three-flap window and A5 three-panel models. Mobile and desktop widths 1440, 1280, 1024, 768, 390 and 320 have no horizontal document overflow; the canvas matches its container. Browser viewport override restored. No browser error logs.
- `browser-checks.json`, `tests.log`, `typecheck.log`, `lint.log`, `build.log`, `template-audit.json` and the screenshots record results. Original user editor tabs were not reloaded.

No hosted data writes, pricing changes, publication, deployment or authenticated storage/order tests were performed. The canonical sales-folder catalogue product was unpublished at the checkpoint; this batch does not publish it. Physical sample/production acceptance remains separate from these local checks.

## Files and reproduction

- `salesFolderDefinition.ts`, `salesFolderArtwork.ts`, `salesFolderModels.generated.ts` and their focused test, under `src/lib/mockup/`.
- `SalesFolderViewer.tsx` plus the existing shared registry/artwork/PrintPreviewSurface integration.
- `src/dev/SalesFoldersReview.tsx`, its entry/style, and `sales-folders-review.html`.
- `scripts/3d-review/` contains the read-only vector audit, geometry extraction, legacy inspection and source generator. Python dependencies: PyMuPDF 1.28.2 and Shapely 2.1.2. The local template index points into the existing sanitized PDF archive; source PDFs are untouched.

Run the audit and legacy inspection before the source generator. Run the nine mockup test files with Node `--experimental-strip-types --test`, then application TypeScript, scoped lint and Vite build. `python3 output/3d-review-queue/render.py` regenerates the board from the canonical plan without reseeding it.

Rollback: remove only this batch's registry spread, viewer dispatch and generated/new modules, retaining the previously approved models and the now-approved 10 mm entry. Preserve unrelated dirty work. No database rollback is required.
