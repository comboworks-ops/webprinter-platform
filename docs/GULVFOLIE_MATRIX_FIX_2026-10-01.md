# Gulvfolie matrix and shape review — 1 October 2026

The user requested quantities 1, 2, 3, 5, 10, 20, 25, 30, 50, 100, 500 and 1,000; calculated prices for free dimensions; clearer selected blue buttons; and larger special shapes with complete labels outside the image.

## Applied scope

- Existing product `5fb73e74-2df2-4e59-a460-c3d95786059d`, config `9f8dab80-f24d-4c91-ad8e-7a0908e46310` only. Existing 10,000 quantity retained.
- Expanded the existing version-1 retail quote surface from sparse reference samples to 41,939 points across the same 204 exact material/shape combinations. The existing calculator interpolates order totals within the selected quantity. Knots encode evidenced area bands, minimum charge, setup and the existing `wmd_tiered_fx_7_5` conversion; this is calculated retail pricing, not an exact supplier quote for every possible dimension.
- Kept TexWalk rectangle and contour profiles separate. The final Indoor 120 volume transition was checked at 30.99 and 30.995 m²; invalid or dimension-adjusted supplier responses remain quarantined.
- Shape images use 112 px cards and 14 px detached labels. Main free-size/free-form buttons retain blue selection, with dark semibold labels and a white backing behind the icon. Pressed state and accessible labels are explicit.
- Prepared immutable validated quote snapshots once per config load to keep a larger matrix responsive. The cache accepts only snapshots created and deeply frozen by the preparation helper; mutable input is always validated again.
- Updated the product review note, price tooltip and about copy to describe current evidence while retaining commercial, shipping and exact-template review warnings.

## Verification

- 1,947 comparisons against captured source quotes, including 18 independent size holdouts: largest observed retail difference 1 DKK. This measured tolerance does not guarantee all possible dimensions.
- 18,564 positive quotes checked across 34 shapes, six materials, 13 quantities and seven sizes. Frontend and local checkout formula agree. Unknown selections, unsupported quantities and out-of-coverage areas stay unavailable.
- 30 focused quote/UI/server tests and six guarded extraction tests pass. Typecheck and production build pass. Focused lint still reports 19 existing `any` declarations and one existing memo-dependency warning in StorformatConfigurator; the quote-model file has no lint findings.
- Actual Chrome route `http://127.0.0.1:8160/produkt/gulvfolie`: 37 × 61 and 80 × 60 prices verified; pagination shows all requested quantities. Selecting TexWalk / 100 / 37 × 61 changes 7,101 DKK rectangle to 7,881 DKK contour, preserving dimensions and quantity.
- Layout checked at 1440, 1280, 1024, 768, 390 and 320 px: no page overflow or clipped shape labels. No browser console errors captured. Original user tabs and drafts were preserved.
- DB readback: 204 products and 357,913 generic price rows unchanged. All other storformat configs retain fingerprint `5512c80b0ae0ee1885a39b247fad5e30`.

## Release and recovery boundary

The product's existing `is_published=true` flag was preserved. Its pricing config remains `is_published=false`; product readiness and tenant availability remain false. No checkout activation, deployment, payment, storage upload, POD changes or schema changes were performed. Commercial pricing, Danish fulfillment and exact designer templates still require review.

Evidence and before/proposed snapshots are in `output/gulvfolie-2026-09-30/fixes/`. `applied-write.sql` records the actual guarded writes. The generator is a no-write continuation, not a replacement import flow.

To roll back, first check that no later admin edits have occurred. Restore only config quantities, layout_rows and source_quote_model from `config-before.json`, and the product review message/maximum measured deviation, about_description and tooltip_price from `product-before.json`. Preserve all current publication, tenant and readiness fields. Do not rerun the original creation importer.
