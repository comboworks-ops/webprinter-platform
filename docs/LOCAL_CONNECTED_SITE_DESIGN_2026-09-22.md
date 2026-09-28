# Connected local Site Design

The owner requested the reviewed Site Design and featured-product work in the
normal local Webprinter system with existing products. The signed-in Chrome
editor is available at http://127.0.0.1:8113/admin/site-design-v2, with
**Fremhævede produkter** selected and the existing **Aluminium Skilte** banner.

## Integration

The previous feature changes were already in workspace source. Real shop
verification found that an alternate product presentation replaced the entire
theme product section and omitted its featured banner. StorefrontHomeContent
now mounts the existing featured configurator before alternate homepage product
presentations. Catalogue routes still show only the catalogue; standard theme
renderers retain their existing featured integration. Product data, pricing,
branding selection and section order are unchanged.

## Local runtime

The previous 8113 process failed with ETIMEDOUT reading cloud-offloaded files.
The replacement uses tmp/start-webprinter-connected-recovered.mjs and the
existing recovered application at
/private/tmp/featured-product-review-2026-09-22/app. It runs the actual SPA entry,
full Tailwind configuration and workspace environment; no synthetic QA client,
fixtures or isolated routes are loaded. This connects to existing hosted shop
data: Save and Publish retain their normal hosted effects.

Before startup, all 701 readable source files matched that recovered copy;
243 cloud-offloaded files had matching sizes (not a fresh content-hash proof).
The new StorefrontHomeContent edit was copied to both locations. Keep future
workspace edits synchronized to the recovered copy while using this launcher.
Do not overwrite cloud originals with recovered bytes. Detached screen session:
webprinter-connected-8113; log: /private/tmp/webprinter-connected-8113.log.

## Verification

- Signed-in real shop editor loads, preview ready, real product choices present.
- Existing Aluminium banner renders its image, dimensions, quantities and 436 kr
  price for the loaded 100 × 100 cm / 1 item selection.
- Placement shortcut updates rendered margin to 24px; Undo restores the original
  state and the editor reports no unsaved changes. No save/publication performed.
- Preview document client/scroll widths match at 1280, 768 and 390 pixels.
  Desktop restored. No error-level console entries captured on the editor.
- Ten existing banner/layout tests pass. TypeScript and changed-file ESLint pass.
- Production Vite build passes in the recovered copy (8.16s); existing large
  bundle warning remains. This build is compilation evidence, not deployment.

No hosted writes, uploads, payments, migrations or deployment were performed.
New-account master-default inheritance remains outside this integration and is
not newly verified. Physical devices and complete purchase flows remain separate.

Rollback only the added imports and alternate-presentation banner block in
StorefrontHomeContent.tsx. Preserve all prior work in this extensively changed
workspace. Runtime rollback is independent; the original source-based launcher
still requires its cloud-file reads to be repaired.
