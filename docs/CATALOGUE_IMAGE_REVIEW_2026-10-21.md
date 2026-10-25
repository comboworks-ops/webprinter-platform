# Demo catalogue image drafts — 21 October 2026

Status: seven drafts prepared for user review. No publication, storage upload, database mutation, application change or deployment performed.

## Review

- Gallery: `output/catalogue-image-review-2026-10-21/index.html`
- Running local preview: http://127.0.0.1:8952/ (loopback Python listener PID 93262 at verification).
- Seven original PNG copies: `output/catalogue-image-review-2026-10-21/images/`.
- Products: Brevpapir; Farvede T-shirts med tryk; Flyers med finish; Foldere; Selvklæbende print; T-shirts med silketryk; Visitkort.

Each image is 1254 × 1254 pixels. The requested generation size was 1024 square; the actual returned size is recorded in the manifest. Files are unmodified copies of the generation outputs. Original generated files remain in place.

## Basis and provenance

Created with built-in image_gen, seven generation calls, one draft per product. No external photos or logos used. Consistent pale background and original navy/teal/coral sample graphics. These are AI product illustrations, not supplier photographs or proof of exact production output. Geometry, material type, garment colours and print positions were informed by current read-only product options. The white shirt and navy shirt are intentionally distinct. Business cards use square corners and a blank reverse; no unsupported foil or embossing is shown.

Exact prompts, source product IDs/slugs, source paths, file sizes and SHA-256 digests are preserved in `draft-manifest.json`; read-only product/attribute evidence is in `source-and-prompts.json`.

## Verification

- Visually reviewed all seven generated images and the complete rendered desktop gallery.
- Browser check passed at 1440px and 390px: all seven images decode at full resolution, no horizontal overflow, all seven full-size links return PNG successfully, no page script errors.
- Evidence: `browser-verification.json`, `gallery-1440.png`, `gallery-390.png`.
- Read-back confirmed all seven live image URLs remain null and all seven pricing-structure and technical-specification hashes match the starting snapshot. Evidence: `live-preservation-check.json`.
- Existing pricing calculations, matrices, price records, existing images and unrelated working-tree changes were not edited.

## Next gate

Await the user's review of the image drafts before any public upload or product-image assignment. This task does not authorize publishing. If approved later, scope publication to the seven mapped product image fields and preserve all pricing, matrix, text and existing image fields outside that scope.
