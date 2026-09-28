# Section settings and exact bank selection — 24 September 2026

Section titles now open the original section settings: name, description,
visibility, selection rules, appearance and effects. Clicking an actual option
opens the appropriate bank with that exact product value first and marked
“Valgt på produktet”. The current format/material remains visible even when it
was imported without a matching library entry. Existing library identity takes
precedence over names; fallback matching checks source name and dimensions.
The bank search resets when selecting another option. Option name/image controls
remain under their own disclosure. No shared library data is renamed.

Hidden sections show greyed contents, a striped background and an eye-off label
in edit mode, retaining their edit controls. Customer preview removes them.
Section dragging shows a copy of the whole box; option dragging shows the actual
button appearance. Original slots stay visible and drop targets are marked.
Copies clear on release, cancellation, Escape or window blur, independently of
React reordering/unmounting the source. The initial animation-completion cleanup
left a floating copy in browser QA; cleanup now runs directly with pointer release.

The preview frame grows to fit the product page through a source/origin/product
checked height message and content ResizeObserver. It includes the complete
order box without the former fixed-height inner viewport. Natural preview
content height avoids a viewport-height feedback loop. The desktop inspector
stays beside the page; narrow layouts keep the existing stacked arrangement.

## Verification

- 43 focused tests pass, including five bank-selection and three drag-lifetime
  regression tests, and existing placement, save/tenant, gallery and option tests.
- Full application TypeScript and Vite production build pass in the hydrated
  verification copy. Existing large-bundle warning remains.
- All new/small edited TS/TSX files lint clean. ProductWorkspace retains its
  existing three explicit-any errors; no new lint errors or warnings.
- Actual signed-in local product: title clicks showed section settings; clicking
  100x100mm, 135g kvalitetstryk and UV-lak front opened the correct bank with that
  exact choice first. No alternative bank entry was applied during QA.
- In the separate QA draft, hiding Papirfinish produced opacity 0.46, grayscale
  and the visible hidden label; customer preview removed Papirfinish and the
  hidden Format. Restoring edit mode restored their controls.
- Actual pointer drags reordered UV buttons and whole sections. Final section
  and button drops left zero floating copies. Price remained 464 kr.
- Desktop/tablet/mobile at 1440, 1280, 1024, 768, 390 and 320 CSS pixels passed
  without horizontal page or preview overflow. The frame fitted the measured
  full product content at each width. Narrow bank screenshot inspected.
- No error-level browser logs. Temporary viewport override reset and the separate
  QA tab closed successfully. Original user tab still has its unsaved draft,
  Papirfinish before Format, and selected Blank laminering på forsiden.

## Runtime and boundary

Actual route:
http://127.0.0.1:8113/admin/product/100x100mm-folder-midterfalset?findSelected=0afbb607-ebdc-4a4f-b08d-8ec863526426#workspace

Port 8113 still serves /private/tmp/featured-product-review-2026-09-22/app.
All 11 scoped files match that runtime, the repository and verification copy at
/private/tmp/product-canvas-2026-09-23/app. React hook signatures were preserved
in the open workspace to retain its unsaved draft during hot updates.

Evidence: output/product-canvas-selection-2026-09-24/ contains pre-edit backups,
source hashes, a selective patch, test/type/build/lint logs and responsive data.
No hosted product save/apply, library mutation, upload, payment, pricing change,
schema change or deployment occurred. Hosted persistence and physical touch
testing were not exercised. Rollback only this selective patch after comparing
for later edits; preserve the existing unrelated worktree and source records.
