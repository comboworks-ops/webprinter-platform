# Automatic sales-folder batch — 28 September 2026

The 10 mm model is approved. The complete linked-template sales-folder batch is integrated locally; see [SALES_FOLDER_BATCH.md](SALES_FOLDER_BATCH.md) for 142 configured variants, the unbound legacy model, exact verification and release boundaries. The earlier checkpoint below is historical.

# Approved 3D models — local integration, 28 September 2026

Thomas requested the approved constructions on individual products, using WebPrinter colours. The local app now integrates A7 4+0, DIN Lang half fold, six-page roll fold and six-page zigzag. Thomas approved zigzag revision r1 in chat on 28 September. Candidate 005 is the A4 two-flap 3 mm spine folder; it remains review-only.

## Product coverage

| Product route | Eligible selection | Local result |
| --- | --- | --- |
| `/produkt/flyer-demand` | A7 74 × 105 mm, 4+0 | Actual product page verified; 4+4 disables the model |
| `/produkt/wmd-folder-bank-891a5cf1` | DIN Lang, midterfalset, 4 sider, Lodret | Actual product page verified |
| Same folder product | DIN Lang, Rullefalset, 6 sider, Lodret | Actual product page verified |
| Same folder product | DIN Lang, zigzag falset, 6 sider, Lodret | Actual product page verified; 8 sider removes the model |
| `/produkt/wmd-wickelfalz-category-22428-fixed-d4423adf` | Older duplicate, same linked PDFs | Blocked by existing product configuration: opens a large-format calculator with no materials or fold selector. No pricing/configuration changes made |

`approvedPrintModels.ts` grants eligibility only to the four approved PDF fingerprints. Known legacy catalogue entries lack hashes, so `useApprovedPrintModel` fetches their exact public URL and verifies SHA-256 before enabling the model. Unknown URLs, changed bytes, failed requests, conflicting hashes and disabled/ambiguous `workspaceContent.preview3d` rules fail closed. Template selection remains owned by the existing selector. Tenant copies of the same template can reuse the construction while retaining their branding and option IDs.

## Shared flow

- Product media uses existing photo/3D tabs. Plain illustrated panels, sliders, focus states and controls use the active shop colour/tokens. Customer artwork is never recoloured. The older sales-folder implementation remains intact.
- Product PDF uploads reuse the existing authentication, private checkout upload service, byte hash and order handoff. Both spreads must be valid before replacing artwork. Context/account changes invalidate in-flight results and clear the draft. The original PDF is stored; the first-page thumbnail is only a thumbnail. 3D PDF rendering has a 50 MB limit.
- Checkout reads and hashes the actual private uploaded file before preparing 3D. Both PDF spreads use the current proof placement. A7 image previews use the existing physical-size/offset composition. 3D does not grant proof approval, modify production bytes or bypass the order's proof/export gates.
- Designer captures both page snapshots into disposable offscreen canvases, including the printable paper fill and excluding technical overlays. It does not switch the live canvas, change selection or reset undo history. Unvisited pages remain blank instead of mirroring the front.
- The approved folded catalogue entries contain full sheet dimensions (204 × 216 / 303 × 216), while the existing Designer/order handoff expects trim plus bleed. The narrow approved-template adapter passes 198 × 210 / 297 × 210 plus 3 mm bleed and the verified fingerprint. A7 already stores trim dimensions. This preserves the exact reviewed sheet size without changing catalogue data, existing drafts, price calculations or the input schema.

## Verification

### Shared page-number illustration (28 September 2026)

`numberedPrintArtwork.ts` defines the standard for the rollout: a solid active shop colour, large centred white reader-page numbers, `Forside` under 1 and `Bagside` under the final page. Dimensions come from the model definition. The half-fold spreads remain 4–1 / 2–3, roll fold 5–6–1 / 2–3–4, and zigzag 4–5–1 / 2–3–6. These are reader numbers, not PDF spread numbers. A7 4+0 has 1/Forside with its reverse left unprinted white.

The current approved product illustrations and all four review defaults share this renderer. Customer PDFs, Designer captures and the optional example artwork bypass it. This standard must also be applied when the remaining sales-folder constructions are reviewed; the earlier sales-folder reference is not changed by this styling update. Geometry approvals and storefront eligibility are unchanged.

Whole-app TypeScript and scoped lint pass. Browser checked front/back numbering on the actual half-fold and roll-fold product, inside pages 2–3–4, the zigzag's 2–3–6 spread and the A7 default/artwork toggle. At 320 px the roll-fold canvas fits and page width remains 320 px. New screenshots: `din-lang-half/numbered-product.png`, `din-lang-roll/numbered-product.png`, `din-lang-roll/numbered-mobile.png`, `din-lang-zigzag/numbered-review.png`, and `a7/numbered-review.png` under `output/3d-review-queue/`. This is local verification, not a deployment.

### Earlier integration verification

- 31 geometry, eligibility, configuration and handoff tests pass, including existing sales-folder guards. Invalid/ambiguous rules, changed template bytes, disabled models, zigzag versus roll fold and double-bleed dimensions are covered.
- Scoped lint passes. Full application build passes with existing large-chunk/Browserslist/PDF-library warnings. Whole-app TypeScript passes.
- Browser verified actual catalogue-backed Flyers and Foldere standard pages, their active WebPrinter colours, correct model selection and removal for unapproved selections.
- Actual A7 Designer launched from the product, captured local text and retained undo capability. Printable white paper is preserved rather than the editor pasteboard.
- Actual roll-fold Designer launched from the product at 297 × 210 + 3 mm bleed. A blue rectangle on the outside and a green circle on the inside appear independently in 3D. Returning from the dialog retains the inside page and object selection.
- The roll-fold review now uses the same PDF preparation function as product/checkout. Browser file chooser accepted the labelled two-spread PDF; an invalid second spread was rejected with the previous artwork retained.
- Integrated half-fold product tested at 1440, 1280, 1024, 768, 390 and 320 px: no horizontal page overflow, canvas fits its slot, controls wrap. Evidence under `output/3d-review-queue/a7/`, `din-lang-half/` and `din-lang-roll/`: `product-integrated.png`, `product-mobile.png`, `designer-integrated.png`, `designer-inside.png`, `designer-outside.png` as applicable.

## Candidate 005 and zigzag activation

The exact zigzag fingerprint now routes to `ZigzagFoldViewer` through the shared `PrintPreviewSurface`. `prepareZigzagFoldArtwork` reuses the storefront/checkout two-spread PDF path. The existing Designer/checkout fingerprint and sheet-size gates automatically recognize it. Product selection was checked on the canonical Foldere standard route: 6-page upright DIN Lang zigzag renders and an 8-page selection removes the 3D tab. Designer/private-upload acceptance for this newly enabled selection was not repeated in an authenticated hosted environment.

Candidate 005 uses separate `spineFolderDefinition`, `spineFolderArtwork` and `SpineFolderViewer` files. The existing 1 mm sales-folder model is unchanged. The new definition traces only the verified no-finish 255g Chromo PDF; the ticket's nine other finish/material PDFs have not been compared. It has paired connected hinges for the cover spine and both pocket gussets. The PDF's nominal 3 mm spine has 3.51 mm between cover creases; pocket creases are 2.99 mm apart. These measured dimensions are preserved. Stock thickness 0.30 mm and bend allowances are illustrative; pocket interlocking/material flex are not physically simulated. Details: `output/3d-review-queue/a4-two-flap-3mm/verification.md`.

Latest verification: 35 mockup tests pass, whole-app TypeScript and scoped ESLint pass, full application production build passes, and the standalone optimized candidate build passes. Existing chunk-size warnings remain. The new candidate was checked at 1440/1280/1024/768/390/320 px, with canvas dimensions read after ResizeObserver settled. A synthetic one-page PDF retained separate front/back colours and correct text orientation; the two-page template was rejected while preserving the prior artwork. The template's second page is a non-printing reference, not another customer-artwork surface.

## Remaining acceptance and rollback

This is local source/browser integration against the existing catalogue, not a deployment. No catalogue, pricing, tenant setting, publishing, account or production-file write was performed during QA. Authenticated product upload/storage/readback and the resulting checkout proof must still be accepted on the intended hosted environment. Test PDFs and Designer artwork were synthetic and local. Real customer files, physical prints and native touch hardware are not certified.

Rollback removes the additive approved-print registry/components and their imports/JSX in ProductPrice, Designer and FileUploadConfiguration. Restore the prior template handoff there and the review-only artwork readers if reverting the whole change. The existing sales-folder path, catalogue records and pricing require no rollback. Preserve unrelated workspace edits.

Rollback for this increment: remove only the zigzag registry entry/lazy renderer branch to disable its product eligibility; remove the standalone candidate-005 entry and new spine-folder modules to remove that review. No database rollback is needed. Preserve the user approval record and unrelated workspace changes.

## Candidate 005 approved; candidate 006 ready

Thomas approved the exact 3 mm construction on 2026-09-28. `APPROVED_PRINT_MODELS` now includes its no-finish 255g Chromo fingerprint and `PrintPreviewSurface` dispatches to the spine viewer. ProductPrice and checkout use their existing selected-template gates. The approved-template handoff adds the 5 mm bleed once. The Designer validates two template pages, captures only the printed outside, and leaves the grey reference out of this 4+0 preview. Its live canvas, original files, pricing and production export behaviour are unchanged. The approved review now exercises the shared renderer and PDF preparation; local synthetic front artwork rendered correctly.

The actual catalogue product `salgsmapper-med-eget-design` is unpublished. Public-route QA returned “Produkt ikke fundet”; that is an outstanding storefront acceptance boundary, not a reason to publish it automatically. The code is wired for the exact selected hash across four snapshot template bindings. Other finishes remain unapproved. Hosted customer-file acceptance is still outstanding.

Candidate 006 follows its separate 504 × 371 mm template: 5.50 mm cover gusset and 5.00 mm pocket gussets. It is available at `/spine-folder-5mm-review.html` and is excluded from the product registry until Thomas approves it. The reusable viewer has dynamic capacity labels and derives the spine-closeup location from its definition. The approved 3 mm coordinates and fold behaviour are preserved. See `a4-two-flap-5mm/verification.md` in the output queue for evidence and limits. Current verification: 38 mockup tests, whole-app TypeScript, scoped lint, production build and optimized review builds pass.

Incremental rollback: remove the 3 mm registry/renderer branch and Designer reference-page adapter to disable this activation; remove the 5 mm definition and review entry to remove candidate 006. Retain approval records and unrelated workspace changes. No database rollback is needed.

## Candidate 006 approved; candidate 007 prepared

Thomas approved the exact 5 mm model on 2026-09-28 (“Perfect. Let's move on.”). Its no-finish fingerprint is now in the approved registry, reusing the product/Designer/checkout spine path introduced for 3 mm. Existing catalogue records, product publication and pricing are unchanged. The product remains unpublished; hosted customer-file acceptance is still separate. Four snapshot template bindings use this fingerprint.

Candidate 007 at `/spine-folder-10mm-review.html` follows its independent 514 × 376 mm PDF. The 10.481 mm main spine and ~10.039 mm pocket gussets require a slightly asymmetric illustrative bend allowance to avoid overlapping paper faces. Tests protect the unchanged approved 3/5 mm geometry and offsets. The review derives its queue number and gusset measurements from the model rather than approval status, so the newly approved 5 mm review keeps the correct identity and points to 10 mm next.

41 mockup tests, TypeScript, scoped lint, full app build and optimized review build pass. See `output/3d-review-queue/a4-two-flap-10mm/verification.md`. Rollback for this increment: remove the 5 mm registry entry to disable its shared eligibility; remove the 10 mm definition/review entry and restore the former fixed bend allowances to withdraw candidate 007. Preserve approval history. No database rollback is needed.
