# Demo catalogue images — published 21 October 2026

The seven reviewed image drafts were published following the user's explicit approval. Product assignment committed at **13:21:40 CEST** (11:21:40 UTC).

Live catalogue: https://www.webprinter.dk/shop

## Published scope

Exactly seven previously empty `products.image_url` fields in the master demo tenant were filled: Brevpapir, Farvede T-shirts med tryk, Flyers med finish, Foldere, Selvklæbende print, T-shirts med silketryk and Visitkort.

The approved 1254 × 1254 PNG originals were uploaded without modification to new, content-specific paths under `product-images/demo-catalogue-2026-10-21/`. No upsert, overwrite or deletion was used. Public original downloads match the approved SHA-256 digests byte for byte. The storefront uses its existing image resizing service for catalogue thumbnails.

## Preservation and live checks

- Atomic assignment locked the seven target products and required exact before-record hashes, demo tenant, published state and null image URLs. Whole-record comparison permitted only `image_url` and the existing audit fields to change.
- Before/after comparison of all **215 product records** confirms exactly seven changed. Protected fields match for every product; all other 208 products are entirely unchanged.
- **86,632 price rows across seven pricing tables** for the public demo catalogue retain identical counts and content hashes. Product matrix settings and technical specifications are included in the protected-field comparison.
- All **353 pre-existing storage objects** in the product-images bucket retain the same metadata fingerprint, excluding access timestamps. All 16 existing catalogue-card image sources are unchanged.
- Fresh public browser checks at **1440px and 390px** confirm all seven images decode and appear in their correct cards; all 23 products remain. Product links, copy and displayed prices match the baseline, after accounting for removal of the seven missing-image placeholders.
- Catalogue comparisons use product URLs. Two existing folder cards appeared in a different relative order across fresh reads; no ordering fields, product data or sorting code were changed. Raw captures preserve that observation.
- No horizontal document overflow or JavaScript page errors. One Stripe telemetry POST was blocked by the read-only browser verification. No order or payment was attempted.
- No frontend deployment, schema change, price recalculation, image regeneration or unrelated working-tree edit.

## Evidence and recovery

Evidence directory: `output/catalogue-image-release-2026-10-21/`.

`approved-mapping.json` maps exact approved files and hashes to product IDs and public paths. `upload-receipt.json` records upload/public-download verification. `publish-approved.sql` and `publication-result.json` record the bounded transaction. `before-*`, `after-*`, `database-verification.json` and `live-browser-verification.json` hold preservation checks. Desktop/mobile screenshots and before/live card snapshots record the actual public catalogue.

Original review files and prompts remain in `output/catalogue-image-review-2026-10-21/`. Its original review page is preserved as `index-reviewed.html`; `index.html` now shows publication status.

If rollback is requested, re-read the seven mapped products and confirm their current image URLs still equal this release's exact URLs, then clear only those seven references back to null. Preserve uploaded files and all other product fields. Do not restore entire records or change pricing. No rollback was required or executed.
