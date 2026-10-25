# Catalogue copy corrections — live, 21 October 2026

**All 12 reviewed proposals published at 12:21:53 CEST, following explicit user approval.** Scope: 11 Webprinter demo products and one Salgsmapper product; 14 text fields only.

## Published changes

The exact names/descriptions in `output/catalogue-copy-review-2026-10-21/proposed-changes.json` were applied. This includes the Danish catalogue labels, removal of test/internal wording, the Visitkort main name and description, the missing Bordservietter description, and this Salgsmapper description:

> Salgsmapper med dit eget tryk. Vælg format, papir og antal, og se prisen med det samme.

Salgsmapper's homepage inherits the product description, so both surfaces are corrected without publishing or replacing branding settings.

## Preservation checks

- All 12 rows matched the approved before-values, tenant IDs, slugs, timestamps and pricing/specification hashes immediately before the update.
- One atomic transaction locked the selected rows, applied only the approved field assignments and compared complete before/after product records, allowing only those edits and the existing audit-trigger fields (`updated_at`, `updated_by`). Unexpected changes would abort the transaction.
- All other product fields are unchanged, including image URLs, matrix configuration, technical specifications, default selections, template files, badges, availability and publication state.
- Seven authoritative pricing tables were fingerprinted before and after: **57,109 rows, identical content hashes and counts**.
- The product-release notification trigger only runs when tenant availability changes. Availability did not change. No notification or production action was triggered by this text update.
- No source deployment, migration, pricing recalculation, image upload, product removal or branding publication was performed. Other local work remains untouched.

## Live verification

Fresh browser sessions inspected the actual public responses without preview substitutions:

- https://www.webprinter.dk/shop — all 23 products remain; all approved demo labels/descriptions appear; test labels and the supplier-bank draft description are absent. Product URLs are unchanged. Visitkort follows the catalogue's existing alphabetical ordering.
- https://www.salgsmapper.dk/ — new description visible; existing 200-piece offer and selection link retained.
- Salgsmapper homepage → product — new description visible, selected matrix cell remains 200 pieces / 739 kr. Matrix cell labels, prices and selected states exactly match the pre-publication capture; product image sources match.
- Salgsmapper at 390 px — new copy renders without horizontal document overflow.
- No JavaScript page errors. All non-read requests were blocked; only Stripe telemetry attempts were blocked. No order, payment or upload was attempted.

The final catalogue capture waited for price loading and recorded 22 priced links. The immediate pre-publication browser snapshot was taken before all asynchronous prices loaded, so browser equality claims apply only to its visible prices. The full stored-price preservation claim is supported separately by the seven-table database fingerprints, not by empty loading-state text.

## Receipts and recovery

Evidence: `output/catalogue-copy-release-2026-10-21/`.

- `before.json`, `after.json`, `database-verification.json`
- `prices-before.json`, `prices-after.json`
- `publish-approved.sql`, `publication-result.json`
- `before-browser-state.json`, `live-browser-state.json`, `live-browser-verification.json`
- Live screenshots and rendered page text

The original review artifact is retained in `output/catalogue-copy-review-2026-10-21/index-reviewed.html`. Its original change manifest remains the approval record; the review homepage now marks the changes published.

For rollback, re-read the same product IDs and tenant IDs, confirm the current text still equals the approved after-values, and restore only the 14 original text fields from the review manifest. Do not overwrite whole records, matrix/price tables, images or branding drafts. No rollback was needed or executed.

The seven missing product images remain separate work; existing images were deliberately preserved.
