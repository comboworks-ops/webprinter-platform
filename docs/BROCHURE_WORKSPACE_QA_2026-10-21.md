# Brochure workspace local QA — 21 October 2026

## Test entry

http://127.0.0.1:8933/design-workspace?workspace=d63b530a6dc8304f5cbbafea882a8a837fe2ca832256de2810fedd90c59f45f2&tenantId=00000000-0000-0000-0000-000000000000

The in-app browser contains Brochure A and Brochure B, each with eight editable numbered pages. Both are revision 2, with 25 copies each. Workspace storage is specific to this browser and origin.

Start another local example from http://127.0.0.1:8933/brochure-preview : select an existing matrix price, then Flere brochurer · lokal test. This development-only catalogue preview reads the existing local saved catalogue and uses the existing brochure designer. It cannot place an order. The saved unpublished shop preview had no selectable prices for the tested configuration; its live-order gates remain unchanged.

## Changes

- Added a loopback/development-only multi-design launch to BrochureProductPreview, carrying the selected existing price, quantity, format, template and page count into the local workspace. Uses the explicit local-brochure-preview identity, never a hosted product/order write. Existing matrix rendering and price logic are unchanged.
- Disabled text-size and colour controls during load/save/export or failed loading, matching the other brochure controls. They previously remained enabled while saving and could change the canvas after document capture.
- Added three regression tests in brochureWorkspace.test.ts: complete reader-order document/spread/thumbnail/profile round-trip; independent brochure revisions and approval; original PDF binary asset references across encoded workspace storage and spreads.

No DB, schema, supplier, payment, hosted artwork, pricing or deployment changes. Temporary experimental edits to ProductPrice and ProductPricePanel were removed exactly; the before/after patch confirms only BrochureProductPreview and BrochureDesigner changed in this follow-up, plus the new test and these notes.

## Browser evidence

1. Created Brochure A with editable labels BROCHURE A - PAGE 1 through PAGE 8. Joined 2–3, saved and returned; real eight-page PDF generated.
2. Approved A's first revision, then created separate Brochure B. It started with eight empty pages, not A's artwork. Added B-specific labels to all eight pages and saved.
3. Reopened A after working on B. Exported PDF has eight pages with correct A labels and order. Reopened spread 2–3 still linked, with both correct page labels.
4. Edited A page 2, used Gem design, reloaded the whole editor and reopened spread 2–3. Edit and linkage retained. Exported revised PDF still has all eight pages. Render comparison at 55 DPI: only page 2 changed; pages 1 and 3–8 are pixel-identical to the earlier PDF. Approval reset and revision became 2.
5. Reopened B after A's changes. Eight correct B thumbnails and back-cover artwork retained. Edited B page 8, saved and reloaded. All eight thumbnails remained; only thumbnail 8 changed. B page 8's edited text visibly reopened. Returning after an unchanged save retained revision 2.
6. Save-state check confirmed font-size and colour inputs disabled during saving.
7. Both designs retained separate artwork and revisions, with 25/25 copies. Existing matrix selection remained 50 copies at 669 DKK ex VAT. Return to the local matrix retained aria-pressed=true on the same price cell; reopening the workspace retained both designs.

## Automated checks and limits

31 focused tests pass across brochure document, geometry, PDF, product, workspace and design revision models. Whole-app TypeScript passes. Scoped lint has zero errors; BrochureProductPreview retains its existing source dependency warning. Final production build passed (3m 43s, existing chunk warnings). Build logs and browser screenshots are recorded under output/brochure-workspace-2026-10-21/.

The first PDF file-chooser attempt stalled and failed before import; test artwork was then created directly in the editor. Actual multipage PDF upload was not verified in this session. Binary preservation has a focused automated test, but that is not a browser upload test. Download tooling was extremely slow; do not use the wait duration as evidence of production export speed. A's downloaded PDFs were rendered and visually checked; B's acceptance uses saved/reopened editable pages and thumbnails, not a separately downloaded PDF. This covers two eight-page documents with simple text and one linked spread, not every page count, asset type or physical print result.

## Evidence and rollback

Evidence: output/brochure-workspace-2026-10-21/. Includes before copies, scoped changes.patch, tests.txt, build logs, a-v1-contact.png, a-v2-contact.png, a-render-comparison.txt, b-reopened-contact.png, A PDFs, and browser screenshots. Unused synthetic source PDFs are preserved as test inputs; they were not imported successfully.

Rollback only this follow-up's preview launch and two control disabled attributes using the scoped patch, and optionally remove the new test. Preserve other dirty work, existing workspace integration and browser-local documents. No database rollback or server restart is needed.


## Follow-up: complete PDF imports verified locally

Tested two independent complete eight-page PDF uploads through Chrome's file chooser against the same local app on port 8933. Chrome has separate browser-local storage from the earlier in-app examples; those earlier documents were preserved.

- PDF brochure A: design `0bef7b6f-3565-4ee6-9186-3d98ce4b3a99`; uploaded `brochure-A-8-pages.pdf`, added `A EDIT - PAGE 2` on page 2, saved and returned.
- PDF brochure B: design `b097cff6-aa5a-4acb-b23f-2eda520d3d1a`; uploaded `brochure-B-8-pages.pdf`, added `B EDIT - PAGE 8` on the back cover, saved and returned.
- Reopened each after working on the other and fully reloaded the editor. Both retained eight thumbnails. Comparing the actual DOM thumbnail images before/after: only A page 2 and B page 8 changed. All other thumbnail data was identical and in the original order.
- Both print PDFs downloaded successfully. Extracted PDF text proves every output page has the correct brochure identity and numbered label 1–8, front cover first and back cover last. Rendered and visually inspected all 16 output pages: original artwork and the two editor overlays are present on their correct pages. Original PDF labels remain text in the exported PDFs; editor-added text is outlined.
- Returning to the matrix retained the selected 50-copy / 669 DKK cell (`aria-pressed=true`). Returning to the workspace retained both documents, revision 1, and the 25/25 quantity split. Both await customer proof approval, which was deliberately not supplied by this test.

Evidence: `output/brochure-pdf-upload-2026-10-21/` contains the two downloaded PDFs, `export-page-order.json`, all rendered pages, contact sheets, before/after thumbnails, `browser-checks.json`, and screenshots. The Chrome tab is left on the workspace at the Test entry URL above. Use that Chrome profile to access these PDF examples; the in-app browser still contains the earlier editable-text examples.

This closes the actual complete-PDF import gap for these two eight-page synthetic A4 PDFs. Imported pages remain PDF backgrounds with editable overlays; this does not demonstrate native editing of existing PDF text, every supported page count, complex PDFs, hosted storage or physical print acceptance. The previous session's import/download limitations above remain historical evidence, not the final status of this follow-up. Chrome's download-event automation stalled despite a successfully saved local file; file existence and PDF inspection, not tool wait time, establish export success. Subsequent download was triggered by its normal button and inspected from disk.

No application source, pricing, matrix, database or deployment changes were needed. This follow-up changed only test evidence and continuity documentation. The previous 31-test/TypeScript/build results above belong to the earlier implementation turn; no redundant build was run for this browser-only acceptance check.


## Follow-up: uploaded PDF pages 2-3 as a spread

Connected pages 2-3 in Chrome's existing PDF brochure A (`0bef7b6f-3565-4ee6-9186-3d98ce4b3a99`). Both imported PDF page backgrounds stayed on the correct sides, and the existing A EDIT - PAGE 2 overlay stayed on page 2. Added SPREAD 2 - 3 across the gutter, moved it lower on the spread, saved and returned to the workspace. Reopened A, fully reloaded the editor, and selected page 3: both pages reopened as the linked 2-3 spread with all artwork retained.

Acceptance evidence:
- Eight page thumbnails retained. Comparing DOM thumbnail data before and after the spread edit, only pages 2 and 3 changed.
- The spread canvas crop is pixel-identical before saving and after reopening, including original PDF backgrounds, prior page-2 text, and cross-gutter text.
- Downloaded the reopened print PDF via the normal button. PDF text extraction confirms all eight original page labels in reader order, including the correct front/back covers. Rendered and visually checked all eight pages and assembled trimmed print pages 2 and 3 side by side: the split cross-gutter text aligns as SPREAD 2 - 3.
- At 60 DPI, only print pages 2 and 3 differ from the prior exported PDF. The original top artwork panel on every page is pixel-identical; pages 1 and 4-8 are entirely pixel-identical. Comparison bounds for changed pages contain only the new spread text.
- Workspace retains the original 50 copies / 669 DKK matrix selection and 25/25 split. A is revision 2; untouched B remains revision 1. Both await customer proof approval. The Chrome tab is left on the reopened spread for local review.

Evidence: `output/brochure-pdf-spread-2026-10-21/` includes before/after editor screenshots and thumbnails, `canvas-comparison.txt`, `render-comparison.json`, `export-page-order.json`, the downloaded print PDF, all rendered pages, a contact sheet and `print-spread-2-3.png`.

This is local browser and synthetic eight-page A4 acceptance; physical print and other imported PDF complexity remain outside this check. No application source, pricing, matrix calculation, backend, database or deployment changes were needed. Only evidence and continuity documentation were added, so no implementation build was repeated.


## Follow-up: separate the uploaded pages 2-3 again

Used Adskil 2-3 in Chrome's existing PDF brochure A (`0bef7b6f-3565-4ee6-9186-3d98ce4b3a99`). Pages 2 and 3 became separate single-page editing surfaces. The uploaded page-2/page-3 artwork, earlier A EDIT - PAGE 2 text and the respective portions of SPREAD 2 - 3 remained in place. Saved and returned to the workspace, reopened A, fully reloaded the editor, then opened each page separately. Both remained unlinked with Forbind 2-3 available.

Acceptance evidence:
- All eight DOM thumbnails are identical before separation and after saving/reopening. No page artwork or order changed.
- Actual single-page canvas crops for pages 2 and 3 are pixel-identical before saving and after reopening.
- Downloaded the reopened print PDF through the normal button. Source-label text checks confirm eight pages, correct A identity and reader order 1-8. Rendered and visually inspected all pages and the trimmed 2-3 pair. All eight output pages are pixel-identical at 60 DPI to the previously exported linked-spread PDF.
- Cross-gutter artwork remains positioned across the two page boundaries. In single-page editing, the object may extend visibly into the dark pasteboard; the print output clips it to the correct page and bleed. The two trimmed output pages still align precisely.
- Workspace retains 50 copies / 669 DKK and the 25/25 split. A is revision 3 for its changed editable structure; untouched B remains revision 1. Both await customer proof approval. Chrome is left on page 2 in single-page mode.

Evidence: `output/brochure-pdf-unlink-2026-10-21/` contains before/after editor screenshots, thumbnails, `render-comparison.json`, `export-page-order.json`, downloaded print PDF, all rendered pages, contact sheet and `separated-print-pages-2-3.png`.

This completes the local link/edit/save/reopen/unlink/save/reopen round trip for this synthetic eight-page A4 PDF. No application source, pricing, matrix calculation, backend, database or deployment changes were needed. Only evidence and continuity documentation were added; prior implementation test/build results were not rerun for this browser-only check.


## Follow-up: edit separated page 2 independently

In Chrome's existing PDF brochure A (`0bef7b6f-3565-4ee6-9186-3d98ce4b3a99`), edited the formerly shared cross-gutter text on page 2 to PAGE 2 ONLY and moved it fully inside page 2. This tests independent editing of an object that had previously belonged to a spread, rather than only adding a new object. Page 3's corresponding original text portion was left untouched. Saved, returned to the workspace, reopened A and fully reloaded the editor.

Acceptance evidence:
- Eight page thumbnails retained; only page 2's DOM thumbnail changed.
- Page 2 reopens with PAGE 2 ONLY at the edited position and the original uploaded PDF artwork and earlier A EDIT - PAGE 2 text retained. Its canvas crop is pixel-identical to the edited canvas before saving.
- Page 3 remains a separate editing surface with the original PDF artwork and original cross-gutter text portion. Its canvas crop is pixel-identical before the page-2 edit and after saving/reopening.
- Downloaded and rendered the new print PDF. Only page 2 differs from the preceding separated-page export at 60 DPI. Page 3 and pages 1,4-8 are pixel-identical. All eight original source labels remain in reading order. All eight rendered pages visually inspected.
- Matrix remains 50 copies / 669 DKK; design quantities remain 25/25. A is revision 4; B remains revision 1. Chrome is left on page 2 for local review; proof approval remains pending.

Evidence: `output/brochure-independent-page2-2026-10-21/` includes before/after editor screenshots, `browser-checks.json`, `render-comparison.json`, `export-page-order.json`, the print PDF, rendered pages and `export-contact.png`.

This is local browser acceptance of the existing synthetic eight-page A4 document. No application source, pricing, backend, database or deployment changes were needed. Only test evidence and continuity notes changed; no redundant implementation build was run.


## Follow-up: reconnect after independent page-2 editing (bug fixed locally)

The first reconnect reproduced a real problem: full off-page copies retained by older separated spread documents reappeared over the opposite page. PAGE 2 ONLY itself stayed in position, but the old crossing text from page 3 and a duplicate older page-2 text became visible on the left. Preserved the failing screenshot and returned to the original saved revision 4 without saving the faulty test state.

Root cause and bounded fix:
- `brochureDocument.ts` previously tracked page ownership only for imported PDF backgrounds. It now records page ownership for all existing single-page artwork when connecting pages. Each page export receives its own artwork; newly authored spread objects without a page owner still cross the gutter.
- Spread previews apply temporary page masks to page-owned artwork so hidden off-page remnants cannot paint on a neighbouring page. These masks are stripped before persistence/export; original PDF bytes remain in the existing shared asset pool. Existing custom mask JSON is preserved and intersected in Fabric during preview instead of being discarded.
- `BrochureDesigner.tsx` adds only that preview-mask composition after artwork loading. No matrix, pricing, tenant, order, backend, database or deployment changes.
- Added two regression tests: legacy off-page copies plus independent edits remain isolated across reconnect/encoded save/reopen/unlink; original clip JSON survives temporary preview masks. Updated one older assertion to expect unrelated page-owned artwork to be excluded from the opposite page.

Verified on the existing Chrome brochure A, starting from the saved independent-page version:
1. Reconnected 2-3; PAGE 2 ONLY and A EDIT - PAGE 2 remain on the left, and page 3 retains its original uploaded artwork and original text portion. No stale overlap appears.
2. Saved, returned, reopened and fully reloaded. Selecting either page opens the linked spread. All eight DOM thumbnails are identical to the independent-page baseline; spread artwork visually correct. Viewport screenshot raster differs slightly after reopening, so no whole-canvas pixel-identity claim is made.
3. Downloaded the reopened print PDF. Text checks confirm eight original reader-order page labels. Rendered and visually inspected all eight pages: every page is pixel-identical at 60 DPI to the prior independent-page PDF, including pages 2 and 3.
4. Original matrix remains 50 copies / 669 DKK with 25/25 split. A is revision 5; B remains revision 1. Both await customer proof approval. Chrome is left on the corrected linked spread.

Checks: 33 focused tests pass, whole-app TypeScript passes, scoped ESLint passes, production build passes (2m 8s, existing bundle/dependency warnings). This is local acceptance with the synthetic eight-page A4 PDFs, not hosted or physical-print acceptance. No new release was made.

Evidence and scoped recovery: `output/brochure-pdf-reconnect-2026-10-21/` contains failing/fixed screenshots, before-source copies, `changes.patch`, source hashes, red/green test receipts, TypeScript/lint/build logs, browser check/price records, original ordered-page text records, downloaded PDF, rendered pages, contact sheet and pixel comparisons. Any source rollback must reverse only this scoped patch and retain all browser documents/PDF originals and unrelated dirty work. The earlier saved independent pages are also retained inside the brochure document; do not clear browser storage or restore the entire checkout. Reverting the fix reintroduces the reconnect bug, so retain the fix while testing these drafts.


## 22 October follow-up: new artwork across the reconnected spread

The previously used Chrome tab was no longer available and its workspace was absent in the currently connected Chrome profile (Yebbo). No old browser data was cleared or replaced. Thomas explicitly chose Continue with a fresh local example. Created design `10e0e62c-70d0-41d9-b016-ec37269f6b82`, named Spread artwork QA 22 Oct, under the same specification-derived workspace ID in this separate profile. The earlier evidence/PDF files remain intact. This run is a recreation of the scenario, not proof of access to yesterday's original editable workspace.

Recreated the relevant state through the actual UI: imported the same complete eight-page A source PDF, connected 2-3, added ORIGINAL SHARED across the gutter, separated, independently changed/moved page 2's portion to PAGE 2 ONLY, then reconnected. Saved and exported this baseline before adding anything new.

Added a new blue rectangle using Felt, widened it across both sides of the gutter, and added NEW SHARED ARTWORK as editable text centred on it. Saved and returned to the workspace, reopened, fully reloaded and selected page 3. The linked spread, rectangle, label and independent page-2 edit all reopened in the correct positions.

Verified:
- Eight page thumbnails retained; only pages 2 and 3 changed from the freshly saved baseline.
- Reopened print PDF retains all eight original PDF page labels in reader order.
- Rendered and visually checked every output page and the trimmed facing pair. The blue graphic's vertical bounds at both inner page edges are exactly y=322..392 at 60 DPI, so the two halves align. The label also aligns across the gutter.
- Only the new graphic/label region differs on print pages 2 and 3. Original uploaded upper artwork and the lower PAGE 2 ONLY / page-3 text areas are pixel-identical to baseline. Pages 1 and 4-8 are entirely pixel-identical.
- Existing matrix remains 50 copies / 669 DKK, with all 50 copies on this single fresh test design. Revision 2, awaiting customer proof approval. Earlier 25/25 A/B examples belong to the previously used profile and are not this fresh example.

Evidence: `output/brochure-new-spread-artwork-2026-10-22/` contains baseline/final print PDFs, original-order text checks, before/after thumbnails, browser screenshots/checks, all rendered pages, export contact sheet, `print-spread-2-3.png`, `render-comparison.json` and workspace values. Chrome is left on the reopened spread.

No application source, pricing, backend, database or deployment changes were needed. Only local QA artwork/evidence and continuity notes changed. No implementation tests/build were repeated; the preceding 33-test/TypeScript/lint/build results refer to the reconnect fix above. Physical print and complex PDF/image cases remain outside this local synthetic example.


## 22 October follow-up: separate the new shared artwork

Continued in Chrome Yebbo's fresh Spread artwork QA 22 Oct design (`10e0e62c-70d0-41d9-b016-ec37269f6b82`) from the preceding section. Used Adskil 2-3 on the reconnected spread containing the new blue graphic and NEW SHARED ARTWORK label. Opened each single page, saved and returned, reopened the design and fully reloaded. Pages 2 and 3 remained separate, with Forbind 2-3 available. Each page retains the correct portion of the graphic/label; PAGE 2 ONLY remains on page 2 and page 3's original content stays in place.

Acceptance evidence:
- All eight DOM page thumbnails are identical before separation and after saving/reopening.
- Single-page canvas crops for both pages are pixel-identical before saving and after reopening.
- Downloaded the reopened print PDF and checked all eight original PDF labels in reader order. Rendered and visually inspected all pages and the trimmed 2-3 pair. Every exported page is pixel-identical at 60 DPI to the linked shared-artwork PDF from the preceding test, including both halves of the new artwork and PAGE 2 ONLY.
- Existing 50-copy / 669 DKK matrix price and the single design's 50 copies remain unchanged. Revision 3, awaiting customer proof approval. Chrome is left on separated page 2.

Evidence: `output/brochure-shared-artwork-separated-2026-10-22/` contains linked/before-save/reopened screenshots, before/after thumbnails, `browser-checks.json`, downloaded PDF, original-order text checks, all rendered pages, contact sheet, facing-pair render, exact pixel comparisons and final workspace values.

No application source, pricing, backend, database or deployment changes were needed. Only local test artwork structure, evidence and continuity notes changed. No implementation test/build rerun was needed for this browser-only acceptance check. The previous section's fresh-profile scope still applies; this does not recover the prior profile's original documents or establish physical-print acceptance.


## 22 October follow-up: edit page 3's shared-artwork portion independently

Continued in the fresh Chrome Yebbo example Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). With pages 2 and 3 separate, changed page 3's copy of NEW SHARED ARTWORK to PAGE 3 ONLY, then moved that label and its blue rectangle fully onto page 3. This tests both text and position edits on formerly shared artwork. Left page 2 and all its artwork untouched. Saved, returned to the workspace, reopened and fully reloaded.

Verified:
- Only page 3's thumbnail changed; all eight page thumbnails retained in order.
- Page 3's edited canvas is pixel-identical before saving and after reopening.
- Page 2's entire page canvas is pixel-identical before the edit and after reopening, including its original blue graphic/label portion and PAGE 2 ONLY.
- Downloaded and inspected all eight print pages. Only page 3 differs from the prior separated-artwork PDF at 60 DPI. Page 2 and pages 1,4-8 are pixel-identical. All eight source PDF labels remain in original reading order.
- Matrix price remains 50 copies / 669 DKK; the one design still has 50 copies. Revision 4, awaiting customer proof approval. Chrome is left on the edited, separate page 3.

Evidence: `output/brochure-independent-shared-page3-2026-10-22/` contains before/edited/reopened screenshots, browser checks, final workspace values, downloaded print PDF, original page-label checks, all rendered pages/contact sheet and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes were needed. Only local test artwork, evidence and continuity notes changed; no implementation test/build rerun was needed. The fresh-profile and synthetic A4 scope above still applies.


## 22 October follow-up: reconnect both independent edits

Continued in the fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Reconnected pages 2-3 after page 3's shared graphic/label had been independently moved and changed to PAGE 3 ONLY, while PAGE 2 ONLY and page 2's graphic portion remained unchanged. Saved and returned to the workspace, reopened and fully reloaded. Selecting page 3 opened the linked spread.

Verified:
- PAGE 2 ONLY remains on the left. PAGE 3 ONLY and its independently positioned blue graphic remain on the right. Original uploaded page artwork and earlier cropped label portions stay correct; no off-page remnants paint over the other page.
- All eight DOM thumbnails are identical to the separate-page baseline.
- The spread canvas crop is pixel-identical before saving and after reopening.
- Downloaded and checked all eight output PDF pages in reader order. All rendered pages are pixel-identical at 60 DPI to the preceding separate-page export, including both independent edits. Visually checked the full contact sheet and trimmed facing pair.
- Existing matrix remains 50 copies / 669 DKK with the single design's 50 copies unchanged. Revision 5, awaiting customer proof approval. Chrome is left on the reconnected spread.

Evidence: `output/brochure-both-edits-reconnected-2026-10-22/` contains before/reopened spread screenshots, browser checks, final workspace values, downloaded print PDF, original page-order checks, rendered pages, contact sheet, facing pair and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes were needed. Only local test document structure, evidence and continuity notes changed. No implementation test/build rerun was needed for this browser-only check. The prior fresh-profile and synthetic A4 scope still applies.


## 22 October follow-up: new shared artwork with both independent edits retained

Continued in the linked Spread artwork QA 22 Oct example (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Added a second new blue rectangle across the gutter below existing content, with NEW CROSS-PAGE ART as editable text. Preserved PAGE 2 ONLY on the left and PAGE 3 ONLY plus its independently moved blue graphic on the right. Saved and returned, reopened, fully reloaded and selected page 3.

Verified:
- Linked spread, new graphic/label and both independent edits reopen in their correct positions. The spread canvas crop is pixel-identical before saving and after reopening.
- Eight thumbnails retained; only pages 2 and 3 change.
- Print PDF retains all eight source labels in reader order. Rendered and visually inspected all eight pages and trimmed facing pair. Only the new bottom artwork region differs on pages 2 and 3; every pre-existing artwork/edit area is pixel-identical to the previous export. Pages 1 and 4-8 are entirely pixel-identical.
- The new blue artwork's top/bottom at both inner page edges match exactly at y=608..678 at 60 DPI. Its label also aligns across the gutter.
- Existing price remains 50 copies / 669 DKK with 50 copies on the one test design. Revision 6, awaiting customer proof approval. Chrome is left on the reopened linked spread.

Evidence: `output/brochure-new-artwork-both-edits-2026-10-22/` contains baseline/before-save/reopened screenshots, browser checks, final workspace values, print PDF, ordered-label checks, rendered pages, contact sheet, facing pair and exact pixel/alignment comparisons.

No application source, pricing, backend, database or deployment changes were needed. Only local test artwork, evidence and continuity notes changed. No implementation test/build rerun was needed; the existing fresh-profile, synthetic A4 and local-only scope applies.


## 22 October follow-up: separate the second shared artwork with both edits retained

Continued in the same fresh Chrome Yebbo example Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Separated pages 2-3 again after adding NEW CROSS-PAGE ART across the reconnected spread. Saved, returned to the workspace, reopened, fully reloaded and inspected both separate pages.

Verified:
- Each page retains the correct portion of the new blue graphic and label. PAGE 2 ONLY stays on page 2; PAGE 3 ONLY and its independently moved graphic stay on page 3. All original uploaded artwork and earlier shared portions remain correct.
- All eight DOM thumbnail sources are unchanged from the linked baseline.
- Both separate-page canvas crops are pixel-identical before saving and after reopening.
- Downloaded the eight-page print PDF, checked original source labels in reader order, and rendered all pages at 60 DPI. All eight renders are pixel-identical to the preceding linked-spread export. Visually checked the contact sheet and trimmed facing pair; the shared artwork aligns at the page boundary.
- Existing matrix remains 50 copies / 669 DKK excluding VAT, with 50 copies on the one test design. Saved revision 7, awaiting customer proof approval. Chrome is left on reopened, separate page 2 with Forbind 2-3 available.

Evidence: `output/brochure-new-artwork-both-edits-separated-2026-10-22/` contains linked baseline and both pages before saving/after reopening, browser checks, final workspace values, `separated-artwork-both-edits.pdf`, original page-label checks, all eight rendered pages, contact sheet, facing pair and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes were needed. Only the local test document structure, evidence and continuity notes changed. No implementation test/build rerun was needed for this browser-only QA. The prior fresh-profile, synthetic A4 and local-only scope applies.


## 22 October follow-up: independently edit page 3 newest shared graphic

Continued in the same fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`), with pages 2-3 separate. Moved page 3's newest blue graphic 40 screen pixels right and 20 up. Its text, the older shared artwork, PAGE 2 ONLY and PAGE 3 ONLY were left in place. Saved, returned to the workspace, reopened and fully reloaded.

Verified:
- Page 2's full canvas is pixel-identical before editing and after reopening, including its shared portions and PAGE 2 ONLY.
- Page 3's edited canvas is pixel-identical before saving and after reopening. PAGE 3 ONLY and its older blue graphic remain correct.
- All eight original PDF page labels remain in reader order. Rendered all pages at 60 DPI; only page 3 changes. Its difference bounds are x=0..267, y=570..679, confined to the newest lower graphic. Everything above y=570, including PAGE 3 ONLY, is pixel-identical. Page 2 and pages 1,4-8 are entirely pixel-identical to the prior separated export.
- Visually checked the full contact sheet and facing pair. The offset blue area on page 3 is the intentional independent edit; its text remains in the previous position.
- Matrix remains 50 copies / 669 DKK excluding VAT with 50 copies on the one design. Revision 8, awaiting customer proof approval. Chrome is left on reopened separate page 3.

Evidence: `output/brochure-new-artwork-page3-edit-2026-10-22/` contains baseline and reopened screenshots, position edit before saving, final workspace values, browser checks, `page3-artwork-edit.pdf`, page-order checks, all eight renders, facing pair, contact sheet and `render-comparison.json`. The earlier colour-control attempt did not alter the rectangle; the verified edit is its position change.

No application source, pricing, backend, database or deployment changes. Only local test artwork, evidence and continuity notes changed. No implementation test/build rerun was needed for browser-only QA. The existing fresh-profile, synthetic A4 and local-only scope still applies.


## 22 October follow-up: reconnect the independently moved newest artwork

Continued in the same fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Reconnected pages 2-3 after moving page 3's newest blue graphic right and up independently. Saved, returned to the workspace, reopened and fully reloaded; selecting page 3 opens the linked spread.

Verified:
- Page 3 retains the intentional graphic offset; its text stays in place. PAGE 2 ONLY remains on the left, and PAGE 3 ONLY and its older blue graphic remain on the right. Uploaded backgrounds and earlier shared portions remain correct.
- Spread canvas is pixel-identical before saving and after reopening/full reload.
- Exported eight-page PDF renders are all pixel-identical at 60 DPI to the preceding separate-page export, preserving both independent labels, moved artwork and original reader page order. Visually inspected the facing pair.
- Matrix remains 50 copies / 669 DKK excluding VAT; one design has 50 copies. Revision 9, awaiting customer proof approval. Chrome is left on the reopened linked spread with Adskil 2-3 available.

Evidence: `output/brochure-moved-artwork-reconnected-2026-10-22/` contains separate-page baseline, spread before/after screenshots, final workspace values, `reconnected-moved-artwork.pdf`, all eight rendered pages, facing pair, contact sheet and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes. Only local test document structure, evidence and continuity notes changed. No implementation test/build rerun was needed for browser-only QA. Existing fresh-profile, synthetic A4 and local-only scope applies.


## 22 October follow-up: new artwork after independent page 3 movement

Continued in the same fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Added an editable blue rectangle across the gutter in the previously blank middle band, below the older top artwork and above the independent labels. Preserved page 3's intentionally moved lower graphic, both independent labels and all existing artwork. Saved, returned to the workspace, reopened, fully reloaded and opened the linked spread.

Verified:
- Reopened spread canvas is pixel-identical to the version captured before saving.
- Eight output PDF pages retain original source labels in reader order. Only the new graphic band changes on pages 2-3: difference bounds at 60 DPI are page 2 x=318..511/y=409..480 and page 3 x=0..192/y=409..480. New graphic aligns vertically at both inner edges.
- All existing artwork outside the new band is pixel-identical, including PAGE 2 ONLY, PAGE 3 ONLY and page 3's moved lower blue graphic. Pages 1 and 4-8 are entirely pixel-identical.
- Visually inspected the exported facing pair. Matrix remains 50 copies / 669 DKK excluding VAT; one design has 50 copies. Revision 10, awaiting customer proof approval. Chrome is left on the reopened linked spread.

Evidence: `output/brochure-new-artwork-after-moved-edit-2026-10-22/` contains baseline/before-save/reopened screenshots, final workspace values, browser checks, `new-spread-artwork.pdf`, page-order checks, all eight renders, facing pair, contact sheet and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes. Only local test artwork, evidence and continuity notes changed. No implementation test/build rerun was needed for browser-only QA. Existing fresh-profile, synthetic A4 and local-only scope applies.


## 22 October follow-up: separate latest artwork while retaining moved page 3 graphic

Continued in the same fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). Separated pages 2-3 after the latest middle blue graphic was added across the reconnected gutter. Saved, returned to workspace, reopened, fully reloaded and inspected both separate pages.

Verified:
- Both page canvas crops are pixel-identical before saving and after reopening. Each page retains its correct portion of the newest graphic; PAGE 2 ONLY and PAGE 3 ONLY remain correct, with page 3's independently moved lower graphic still offset.
- All eight output PDF pages are pixel-identical at 60 DPI to the preceding linked export, retaining the already verified original reader order and all artwork. Visually inspected the facing pair.
- Matrix remains 50 copies / 669 DKK excluding VAT; one design has 50 copies. Revision 11, awaiting customer proof approval. Chrome is left on reopened separate page 3 with Forbind 2-3 available.

Evidence: `output/brochure-latest-artwork-separated-2026-10-22/` contains linked baseline, both pages before saving/after reopening, workspace values, browser checks, `separated-latest-artwork.pdf`, all eight renders, facing pair, contact sheet and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes. Only local test document structure, evidence and continuity notes changed. No implementation test/build rerun was needed for browser-only QA. Existing fresh-profile, synthetic A4 and local-only scope applies.


## 22 October follow-up: independently edit page 2 newest artwork

Continued in the same fresh Chrome Yebbo design Spread artwork QA 22 Oct (`10e0e62c-70d0-41d9-b016-ec37269f6b82`). With pages 2-3 separate, moved page 2's newest middle blue graphic 45 screen pixels left and 5 down. Preserved all text and page 3's independent lower graphic movement. Saved, returned to workspace, reopened, fully reloaded and inspected both pages.

Verified:
- Edited page 2 canvas is pixel-identical before saving and after reopening. Entire page 3 canvas is pixel-identical to the pre-edit baseline.
- Eight output PDF source labels remain in reader order. Only page 2 changes at 60 DPI, within x=233..511/y=409..490, corresponding to the newest middle graphic. Everything outside this band is pixel-identical, including PAGE 2 ONLY. Entire page 3, including its moved graphic and PAGE 3 ONLY, is pixel-identical; pages 1,4-8 are unchanged.
- Visually inspected the output facing pair. Matrix remains 50 copies / 669 DKK excluding VAT; one design has 50 copies. Revision 12, awaiting customer proof approval. Chrome is left on reopened separate page 2.

Evidence: `output/brochure-newest-artwork-page2-edit-2026-10-22/` contains both page baselines, edited page 2 before saving, both reopened screenshots, final workspace values, browser checks, `page2-artwork-edit.pdf`, original page-order checks, all eight renders, facing pair, contact sheet and `render-comparison.json`.

No application source, pricing, backend, database or deployment changes. Only local test artwork, evidence and continuity notes changed. No implementation test/build rerun was needed for browser-only QA. Existing fresh-profile, synthetic A4 and local-only scope applies.


## 22 October: complete customer journey acceptance

The complete local product-selection -> two realistic PDF editions -> independent editing -> quantities -> proof review -> approval/reapproval -> matrix return/reload journey passes. See `docs/BROCHURE_CUSTOMER_JOURNEY_QA_2026-10-22.md` for the bounded result, evidence and remaining customer/production limits. This supersedes further manual connect/separate variations as the next useful acceptance milestone. Existing A4 drafts are preserved; new A5 workspace has 60/40 copies at the existing 100-copy matrix price of 657 DKK excluding VAT. No application source, pricing, backend or deployment changes.
