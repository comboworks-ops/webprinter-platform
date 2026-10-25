# Demo catalogue and Salgsmapper copy — review draft, 21 October 2026

**All 12 proposals were approved and published on 21 October 2026.** See [live release and preservation evidence](CATALOGUE_COPY_RELEASE_2026-10-21.md). The sections below retain the original review-stage record.

Review: `output/catalogue-copy-review-2026-10-21/index.html`, served locally at http://127.0.0.1:8951/.

## Exact proposed scope

12 product records / 14 text fields: 11 published master/demo products and one Salgsmapper-owned product. Only `name`, `icon_text` and `description` are proposed. Original and proposed values, product IDs, tenant IDs, timestamps and pricing/specification hashes are recorded in `proposed-changes.json`.

| Current catalogue name | Proposed catalogue name / correction |
| --- | --- |
| Letterhead | Brevpapir |
| businesscards | Visitkort; also replace the main name and supplier-bank draft description |
| Flyers podtest | Flyers |
| New Flyer Test | Flyers med finish |
| new folders | Foldere |
| T-shirt (color-t-shirt-4-plus-4) | Farvede T-shirts med tryk |
| T-shirt (silketryk-t-shirt) | T-shirts med silketryk |
| Pixart Flat Surface Adhesive | Selvklæbende print |
| Foto plakater | Fotoplakater |
| Standard  Foldere | Standardfoldere |
| Bordservietter | Keep name; fill the empty description |
| Standard salgsmapper | Keep name; replace fixed A4/100-piece description |

New descriptions:

- **Visitkort:** “Visitkort med dit eget design. Se de tilgængelige valg og priser i prisberegneren.”
- **Bordservietter:** “Bordservietter med dit eget design. Se de tilgængelige formater og antal i prisberegneren.”
- **Salgsmapper:** “Salgsmapper med dit eget tryk. Vælg format, papir og antal, og se prisen med det samme.”

## Confirmed causes

Catalogue tiles prefer `icon_text` over the main product name. Several main names were already clean, but their separate display labels still contained the test names. Correct the stored labels instead of adding frontend text-replacement logic or changing the shared title precedence.

Salgsmapper’s published featured configuration and saved draft both have an empty `customDescription`, falling back to this product's description. Updating only `products.description` can therefore correct homepage and product page together. Do not publish the whole branding draft. The generic description remains true across available quantities/formats, unlike replacing the existing text with a new fixed “200 stk A6” claim.

## Preserved and deferred

All 23 demo products remain visible. Product IDs, slugs/URLs, images, badges, offer prices, price rows, matrix, default selection, technical specifications, templates, production and publication state remain unchanged. No delete, hiding, importing or pricing operation is proposed.

Seven demo products have no saved `image_url`: Brevpapir, Visitkort, Farvede T-shirts med tryk, Flyers med finish, Foldere (new-folders), Selvklæbende print, T-shirts med silketryk. They are separate image-review tasks. No stock image, AI image or unrelated product photo has been substituted. Existing images are preserved; this pass does not certify their suitability.

Other offer-specific copy, badge claims and product readiness are outside this correction set. In particular, cleaning the visitkort draft text does not establish readiness for production. No product was merged with a similarly named product.

## Verification

- Read-only database snapshot: all 23 published master/demo products plus the one Salgsmapper product.
- Isolated Chrome sessions loaded actual public pages. Proposed mode replaced only the 14 approved-for-review text fields in browser-local JSON responses; it did not send changes to the server.
- All proposed fields were delivered to the preview. Test/internal labels no longer appear in the proposed catalogue.
- Before/after comparison: identical prices and destinations for 24 product links (23 catalogue products plus the featured link); identical Salgsmapper matrix cell labels, prices and selection; identical homepage selection URL.
- Salgsmapper remains 200 pieces at 739 kr, with A6 selected. The new description is visible on homepage and product page. Mobile product rendering checked at 390 px without document overflow.
- Review page: HTTP 200, 12 before/after cards, working shop filters, no horizontal overflow at 1440/390 px and no JavaScript page errors.
- All non-read requests were blocked. Stripe telemetry `/6` was blocked in each public-page session. No order, payment, upload, registration or supplier action was attempted.
- Fresh post-preview database read: all 24 records and inspected fields exactly match the initial snapshot, including timestamps and pricing/specification hashes.

Evidence: `browser-verification.json`, `readback-verification.json`, `review-verification.json`, before/after screenshots and rendered text in the review folder. Production calculations were not modified or replaced. No paid-order or production acceptance is implied.

## After review

No write script has been executed or publication scheduled. Once the user approves an exact subset, re-read those rows and verify the before-values, tenant identity and protected fields. Apply only the approved text keys. Do not use a bulk branding save, migration, source deployment, price recalculation or full-record replacement. Preserve the before-values for a text-only rollback and verify the actual public catalogue/product after the approved update.
