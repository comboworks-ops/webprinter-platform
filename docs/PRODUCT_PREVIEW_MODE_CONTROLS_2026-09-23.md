# Product preview mode controls — 23 September 2026

Moved the product workspace's edit/preview control from the footer to a visible
bar above the preview. Separate Rediger and Forhåndsvisning buttons show the active
mode with a filled highlight and aria-pressed. The existing editPreview state,
preview messages and selection behavior remain connected to both buttons.

Synced ProductWorkspace.tsx and productWorkspace.css to the actual port 8113
source copy, using hot updates rather than a page reload. No save, publish,
upload or backend mutation was performed.

Verification on the connected Standard Plakater editor:
- Both modes switch correctly, including the preview iframe's edit-mode notice.
- Controls sit above the iframe at widths 1440, 1280, 1024, 768, 390 and 320.
- No horizontal page overflow or clipped button labels at those widths.
- Mobile controls are at least 44 px high. Viewport overrides reset afterward.
- No application console errors. Full app TypeScript and Vite frontend build pass
  in the actual running source copy. Existing bundle-size warnings remain.
- Focused lint has the same three pre-existing explicit-any errors as the before
  snapshot, with no added diagnostics.

Before snapshots and logs: output/product-preview-toggle-2026-09-23/.
Rollback only this task's component/style diff; preserve the preceding image
picker positioning fix and unrelated worktree edits. No production deployment.
