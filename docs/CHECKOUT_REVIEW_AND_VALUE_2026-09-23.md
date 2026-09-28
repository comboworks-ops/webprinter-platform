# Checkout proof approval and selected-product value — 23 September 2026

Local implementation; no deployment, payment, supplier submission or live data write.
Port 8113 serves `/private/tmp/featured-product-review-2026-09-22/app`. The scoped changes are applied there as well as in this workspace. Existing concurrent gallery work is preserved.

## Behavior

- Ordinary JPG/PNG files can be approved beside the checkout preview. Visible warnings require an explicit checkbox. Upload completion keeps the customer on that page; Corrector and Designer remain optional actions.
- Image approval reads and hashes original bytes, embeds them in a PDF at the exact displayed size, offset and scale, adds trim/bleed boxes, then uses the existing private upload transport. Only successful upload/read verification allows approval of the new artifact. Placement/file changes during preparation reject the stale result. Original files are retained; templates and guides are never printed.
- Special professional-PDF, cut-contour and apparel requirements remain. TIFF requires JPG/PNG conversion or the existing specialist workflow. Incorrect-size/edited PDFs still need a production artifact; this change does not claim PDF/X or CMYK conversion.
- Removed the rounded border around the approval status/actions.
- “Dit produkt” shows the actual product thumbnail, selected options, quantity, total and unit price. “Skift papir og tilvalg” opens the existing product configurator with its selections restored; returning retains artwork and customer draft and requires fresh approval. Compatible multi-file Designer exports are retained; changed print areas are not automatically accepted.
- Quantity comparisons come from the existing selected matrix row, including the existing option-extra calculations. No supplier prices, pricing tables or formulas changed. Old sessions without exact tier data do not show guessed matrix-layout prices. Client display tiers are omitted from payment requests; server quote verification remains authoritative.
- Savings explicitly mean price per item, with the change in total shown separately. Selecting the highest tier clears larger-quantity offers.

## Evidence

- 18 focused tests pass: PDF geometry/placement/rejection, artifact identity, original eligibility rules, quantity comparisons, and retained product-edit drafts.
- Final active-copy application TypeScript check: 0 diagnostics. Final production frontend build: pass (9.80s; existing bundle warnings).
- New helpers/components pass ESLint. Existing touched-file error counts: Checkout 29→26, ProductPrice 41→41, Matrix renderer 30→30, ProductPricePanel 72→72. Warning counts unchanged. Repository-wide lint is not claimed green.
- Actual connected browser: 75 × 350gr matsilk at 504 kr survived product-edit/return, as did the uploaded artwork. Actual product matrix shows 100 for 579 kr and 150 for 734 kr. Checkout now matches these, with 75 kr / 230 kr extra total and 14% / 27% lower unit prices. The previous panel incorrectly offered 454 kr / 545 kr.
- Isolated local UI fixture using real components: warning approval disabled until checked, outside approval succeeds, busy state disables actions, unsupported approval hidden, quantity selection updates the current price and savings. Widths 1440/1280/1024/768/390/320 have no horizontal overflow; approval border computes to 0px. This fixture does not upload files.
- Actual new image→private-PDF upload round-trip has not been executed against hosted storage in this task. PDF creation/placement is tested locally; the existing transport is reused.

## Rollback

Reverse only this task's selective changes; preserve unrelated gallery/product work. Before snapshots and a scoped patch are under `output/checkout-review-2026-09-23/`. No schema, grants, edge functions or data require rollback. Existing uploaded artwork must not be deleted.
