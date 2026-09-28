# Product-side controls — repair and local review

## What changed

- Color swatches now show their names and explain normal, hover and selected states. The panel includes the promised section-box background, border, radius and padding controls.
- Explicit option styling takes precedence over the order-flow and visual-theme CSS rules that previously forced radius, font size and height. Unrelated theme controls keep their presets.
- `Gendan standardudseende` restores the shared defaults and removes conflicting per-option visual overrides while keeping images, names and pricing identities.
- Picture modes use distinct 64 / 112 / 176 / 256 px presets and a section slider up to 480 px, constrained by available width. Names appear outside the picture. Image-only and text-below-image now enter the picture renderer; text-only suppresses thumbnails. Full artwork is contained rather than cropped in workspace picture choices.
- Foldout headings preserve native click/keyboard behavior through both preview click interceptors while still selecting the relevant editor. Preview guidance uses a thinner outline.
- An optional `Væskefyld (knapper)` effect uses local CSS, the configured hover colors, keyboard focus and reduced-motion rules. No external package, component source or service was installed.

## Investigation

The compact shared color picker intentionally renders only a swatch; labels are now supplied by the styling panel. Forced `!important` rules in both `orderFlowDesigns.css` and `storefrontVisualStyles.css` overrode inline geometry. Picture presets inherited small thumbnail settings and some named modes fell through to text buttons. Both PreviewShop and PreviewBrandingContext cancelled the native disclosure click.

The agent-system router found the library-only `ui-resource-scout` catalogue, including Kokonut UI and Magic UI. The public liquid-fill reference was https://www.shadcn.io/button/liquid-button. The new effect is an original adaptation using the existing button component; no vendor code was fetched or executed.

## Verification

- 32 focused tests pass, including distinct image presets, clearing conflicting overrides, preserving image/source/price identity, draft/apply, tenant/timestamp guards and matrix price safeguards.
- TypeScript and production build pass in the recovered verification app. Changed-file lint has no added messages against pre-task snapshots; existing lint debt remains.
- Synthetic browser checks measured 36 px radius / 22 px text / 72 px height; reset restored 8 / 14 / 44. Image presets measured 64, 112 and 176 px; larger sizes correctly constrained to the available column. A 480 px request rendered approximately 405 px in a full-width preview section. Image-only had an image and no visible label; text-below-image had a separate label below the image.
- Foldout click opened and Enter closed the native details element with edit mode active. The guide measured 1 px. Keyboard focus triggered the liquid pseudo-element from below the button to above its top, using the configured hover fill.
- The repaired authenticated local editor loaded through the review entry with the original 8113 sign-in. Its real Foldetype buttons used the repaired renderer (8 px default radius, 14 px type). The expanded controls had no page overflow at 320, 390, 768, 1024, 1280 and 1440 px. The temporary viewport override was reset.
- Saves in tests were confined to local synthetic data. No authenticated product saves, publishing, pricing changes or database changes were performed.

## Original review setup (before normal-editor integration)

The original connected tab on port 8113 contains unsaved product edits. Its running source files were not replaced or restarted. Browser verification confirmed it still showed `Ugemte ændringer` after opening the repaired review.

Review entry: `http://127.0.0.1:8113/src/backup-controls-review/index.html`.

This local-only entry is in the existing server's ignored backup directory. It loads the repaired modules from the separate server on 8143, using the existing 8113 browser sign-in normally. Its product iframe uses the same review entry. It does not copy credentials or alter permissions. The temporary review entry and iframe routing are not application changes and must not be deployed.

Use the review entry link when reopening; refreshing the ordinary `/admin/product/...` URL loads the original server's code. Once the original draft is saved or intentionally discarded, the repaired workspace sources can be overlaid onto the ordinary local server. Do not refresh that original draft as part of QA.

Source snapshots, verification logs and the separate connected app are under `/tmp/product-controls-20260922`. The isolated sample editor remains at port 8142. Current source files are in the workspace; unrelated cloud-offloaded dependencies were supplied by the recovered application for checks. This is local verification, not a clean deployment or hosted acceptance claim.

## Normal-editor integration — 22 September 2026

The approved repairs are now synchronized into the running normal local app on
port 8113 (`/private/tmp/featured-product-review-2026-09-22/app`). All 11 scoped
files were checked against the prior snapshots before replacement and verified
against the current repository source after replacement. The normal editor uses
`/preview-shop` directly, with no review-entry or port-8143 dependency.

The existing review tab had unsaved changes, so its separate 8143 app and server
were left untouched. The original normal-editor tab reported no unsaved changes
and could be refreshed safely. No product save, publication or database write
was performed.

Fresh validation on the integrated local app: 17 presentation, workspace and
guarded-save tests pass; application TypeScript passes. Browser verification after
a normal URL reload confirmed named colors, reset, the liquid-fill option and
the embedded customer form at the ordinary `/preview-shop` route. The review
tab still reported its unsaved changes. Local rollback snapshots
and exact before/after hashes are in
`/private/tmp/product-controls-normal-integration-20260922/manifest.json`.
Restore only those scoped local-runtime files if rollback is needed, first
protecting any new editor drafts. Repository source already contains the repairs;
this integration does not deploy the frontend to production.
