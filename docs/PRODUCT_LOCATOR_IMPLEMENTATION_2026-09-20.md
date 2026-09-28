# Product locator → product workspace

20 September 2026. **Final result: passed for the local locator scope.**

The user could open the selected product editor but could not find its preceding product locator. The isolated review entry did not mount `/admin/products`; the application also still presented the earlier management table. The default product overview now uses the selected finder direction, with the previous management controls available under **Administrer produkter**. Both routes use the actual components in the local review.

## Behavior and implementation

- `ProductOverview` supplies its existing tenant-scoped products to `ProductLocator`. The finder reads enabled format/material metadata from the existing attribute tables, scoped to that tenant and those product IDs, with batched/paginated metadata reads.
- Search matches product names, descriptions, categories and option names. Category, format, material and publication filters combine; each facet currently selects one value. Disabled metadata is excluded. Product loading, metadata retry and empty-result states are explicit.
- Image selection updates the larger product preview. The name and **Åbn produkt** open the existing `ProductPriceManager`, which opens the selected ordering-form workspace for compatible matrix products.
- Search, filters, selected product and existing admin tenant/domain context travel in URL parameters. **Find produkter** restores them. The existing create-product entry and its return/cancel actions also preserve that context.
- **Opret selv** retains the existing creator. The existing POD import route is linked only when the current master-shop permissions allow it. No product creation, publishing, import, pricing calculation or schema logic changed in this follow-up.

Core files: `src/components/admin/ProductLocator.tsx`, `src/styles/productLocator.css`, `src/lib/products/productLocator.ts`, `ProductOverview.tsx` and the navigation helper in `ProductCreator.tsx`. The editor work is recorded separately in `PRODUCT_WORKSPACE_IMPLEMENTATION_2026-09-20.md`.

## Visual comparison

Source: `output/product-creation-concepts-2026-09-20/02-pod-search.png` (1487 × 1058). This is the first twelve-image set's option 2, distinct from the subsequently selected editor picture 2.

Source and rendered finder were viewed together in a local comparison page, with equal 1487 × 1058 source/iframe frames and a common reduced display scale. Clean individual viewport captures were also inspected. The browser's stitched full-page output showed scaling artifacts and was not used as pixel-fidelity evidence. The comparison is reproducible at `tmp/product-locator-20260920/comparison.html`; screenshots were emitted in the task, not saved as standalone files. This is a visual/functional review, not a pixel-identical claim.

| Surface | Result |
| --- | --- |
| Typography | Existing Inter administration styling, large navy title, readable compact option metadata. |
| Layout and spacing | Shared admin header, full-width search, removable filter chips, left facets, image rows, selected-product panel and clear open action. No horizontal page overflow at 1440, 1280, 1024, 768, 390 or 320 CSS pixels. |
| Color | Existing white/navy/blue direction with subtle borders and clear selection/focus states. Tenant header and branding remain shared. |
| Images | Real existing product-image URLs; missing-image state is explicit. No generated screenshot is used as interactive UI. |
| Copy | Danish action labels distinguish finding, previewing and opening. Publication state replaces the concept's fictional supplier prices/margins. |
| Responsive behavior | Rows stack on narrow screens; a named disclosure opens filters. Search and actions remain usable at 320px. |

The concept's supplier availability, invented prices and import-margin editor were intentionally omitted from this existing-product locator. Original management and gated importing remain reachable. No unresolved P0/P1/P2 issue was identified in the scoped comparison.

## Verification

Local server: `http://127.0.0.1:8112/admin/products?tenantId=11111111-1111-4111-8111-111111111111`. Its Vite entry aliases the Supabase client to a synthetic local fixture and uses an empty backend environment directory. Four example products have independently scoped attribute/price data. The page labels this local example-data boundary.

Browser-verified:

- Search plus material filtering → open Foldere → actual ordering-form editor → return with search/filter/selected-product context retained.
- Draft filter → Brochurer → correct product editor. Empty-result recovery and clearing filters.
- Existing management-table entry and return to finder.
- Create-product entry and return with tenant and format filter retained; no product was submitted.
- Mobile filter disclosure, selection and clearing, and the responsive widths listed above.
- Final finder reload and navigation produced no new error-level console entries. Earlier fixture-only overview-seeding errors were resolved by providing the existing synthetic default overview; no production write was permitted.

Focused tests: 16 passed (3 locator tests plus 13 existing workspace/save tests). Locator tests cover compound search, enabled metadata, product isolation, combined facets and context-preserving URLs. Vite production build passed. TypeScript remains blocked by 403 pre-existing diagnostics; the before/current comparison reports 403/403 with no new diagnostics. Logs and before-task source snapshots: `tmp/product-locator-20260920/`. Scoped whitespace checks passed.

## Next visual choices

`output/product-creation-concepts-2026-09-20/next-layouts.html` presents the six existing image concepts: wide-format 7–9 and combined machine/learning 10–12. All six images loaded; selection persistence through reload and deselection were browser-checked, then test selections were cleared. Choices are browser-local only and do not change products or the recorded user selections. The original generated images remain the visual truth. No wide-format curve, rounding rule, costing engine or learning service was implemented in this follow-up.

## Boundaries and rollback

No hosted authentication/RLS, real catalog completeness/performance, new-product submission, supplier import, upload, deployment or production acceptance was exercised. The finder inherits the existing product query's catalog limits; metadata pagination does not claim unlimited product retrieval. Pricing and POD v1/v2 logic were preserved.

Rollback only this task's additions and navigation changes, comparing against `tmp/product-locator-20260920/before/`. Do not reset the dirty repository or replace whole files from Git HEAD: unrelated changes predate this task. No migration rollback is required.
