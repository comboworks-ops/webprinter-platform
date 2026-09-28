# Product editor image picker scroll repair — 23 September 2026

Local CSS-only fix in `src/styles/productWorkspace.css`, synchronized into the
actual port 8113 app at `/private/tmp/featured-product-review-2026-09-22/app`.

## Reproduction and cause

Opened a separate signed-in Standard Plakater editor, expanded Format → Valg og
billeder → A3, and activated its file input. The browser scrolled to an almost
entirely white area below the editor. No application console error occurred;
the editor remained mounted. The absolutely positioned `sr-only` file input had
no local containing block and extended outside the scrolling inspector.

Before correction at 1364 × 762: document height 1917, scrollY 1155, inspector
bottom -163, file inputs at document y 1801/1917. This explains why reloading
seemed necessary and then discarded unsaved changes.

Added `position:relative` to `.pw-image-drop` to contain its native file input.
The existing controls, upload transport, draft/save/publish logic and appearance
are unchanged. CSS hot update preserved the user's original unsaved editor.

## Verification

- Actual connected editor: A3 image, hover image and configuration-image picker
  activation now keep the editor visible. At the original viewport, document
  height dropped to 1285 and picker activation stayed at scrollY 372.
- Separate unsaved test draft `A3 test` and Format → A3 test gallery condition
  survived repeated picker activations. No save/publish action was used.
- Gallery picker tested at widths 1440, 1280, 1024, 768, 390 and 320 with height
  900. All six had no horizontal overflow, retained draft/condition values and
  placed the selected input near viewport y 449. Viewport override reset.
- Zero application console errors in the test tab.
- Original user tab remains unsaved, on A2 with two gallery entries and a loaded
  existing gallery image; the new CSS is active without a reload.
- Production-mode Vite frontend build passed in the actual running source copy
  in 8.51 seconds. Existing bundle-size warnings remain.

Scope: this proves the picker scroll repair, not a new file transfer or persisted
image assignment. No file uploads, database writes, publication or deployment
were performed. No CSS-declaration-only unit test was added.

Evidence: `output/image-picker-scroll-2026-09-23/`. Rollback: remove only the
three added CSS lines (comment plus rule), preserving all prior worktree edits.
