# Webprinter homepage and catalog repair — 8 September 2026

Final result: **passed for the local homepage/navigation scope**. This is not certification of every product's imported prices, the full checkout/payment journey, or the authenticated Site Design editor.

## Working entry point and selected design

`http://127.0.0.1:8110/?tenantId=00000000-0000-0000-0000-000000000000`

The ordinary local master storefront uses design 1, Precise Print Grid, including the left category menu on desktop. It does not require `design=1`. This follows the recorded selection in `output/design-exploration/webprinter-2026-09-07/display-order.json`. The user was asked to clarify the latest side-menu wording; no replacement selection was received, so the recorded default was retained.

Source reference `option-1.png` and the real local screenshot are paired at the same 1487 × 1058 viewport in `output/design-exploration/homepage-repair-2026-09-08/home-reference-comparison.png`. The live site retains its saved logo, product names, quantity prices and tenant content. The reference's illustrative category selection is replaced by the actual five published categories. This is a working implementation of the selected composition, not a pixel-identical screenshot clone.

## Reproduced faults and changes

1. Clicking Storformat changed the URL but left the home hero and featured aluminium calculator on screen. The shared print theme ignored category parameters. Category routes now resolve overview/category/subcategory from the URL and render the existing tenant-scoped ProductGrid. Home-only sections stay on the homepage.
2. Category navigation now includes products in descendant categories and carries the correct overview and tenant context. Invalid category combinations produce an explicit empty state instead of unrelated products. The legacy storefront and category-landing product contracts remain intact.
3. The homepage calculator discarded its selection when continuing. A small URL handoff now carries positive dimensions and an allowed quantity to the existing Storformat calculator. The destination calculates its own price; no price is passed in the URL.
4. Normal product pages showed design comparison controls. Those controls now require an explicit `orderDesign` review parameter; the approved per-page defaults remain unchanged.
5. Mobile navigation used an old hard-coded Shop Demo menu. It now reads the same configured visible links as desktop. Mobile hero spacing no longer has a 90px empty gap, and the price matrix no longer expands the document beyond the screen.
6. Category navigation retained the homepage scroll position, sometimes hiding the new title. Category changes and returning home now start at the top; typing in search does not reset scroll.
7. Product totals now show a loading message while Storformat data loads, rather than a temporary zero-price summary.

## Approved connected-database repair

The published Selvklæbende Print product (`ede9872f-a8f8-4475-94bc-d7cb257d224e`) had 7 materials, 4 finishes and 2 delivery choices marked `tenant`. Existing public-read policies therefore hid the options from customers, although 56 material price tiers existed.

After explicit user approval, a guarded transaction changed only those 13 exact rows to `public`. Post-query counts: materials 7/7 public, finishes 4/4 public, delivery choices 2/2 public. Prices, calculations, tenant IDs, policies, product publication flags and the separate unpublished adhesive draft were untouched. The apply and rollback SQL, plus the review note, are saved in the evidence directory. The rollback was not executed. No order, upload, payment or email was submitted.

## Browser verification

All checks used the actual local storefront in the in-app browser, with public product reads. No mock catalog or intercepted response was used.

| Check | Observed result |
| --- | --- |
| Normal homepage reload and return via logo/Home/Forside | Design 1, one home heading, no comparison controls, scroll starts at zero |
| Five category links | Tryksager 15, Storformat 1, Klistermærker 1, Plakater 1, Tekstiltryk 2 |
| All products | 20 published product cards |
| Product destinations | All 20 observed card URLs render their product heading; this is route coverage, not full pricing/order certification |
| Information links | Artwork guide, contact, about, privacy and terms render their respective headings |
| Desktop header product menu | Storformat opens its category and then Aluminium Skilte |
| Header search | Aluminium returns the correct product link |
| Catalog search | Aluminium returns one product and survives reload; unmatched search shows zero and a recovery link restores all 20 |
| Aluminium handoff | 80 × 100 cm, 2 items: 698 kr product price on home and product page; selection survives product-page reload; 827 kr including the existing 129 kr delivery |
| Adhesive calculator after repair | Seven material rows; default 100 × 100 cm, 1 item = 179 kr before delivery; selecting 2 items = 357 kr; optional finish controls can be enabled and selected |
| Desktop/tablet/mobile | 1487 × 1058, 768 × 1024, 390 × 844; homepage and catalog fit the viewport |
| Mobile product matrix | Document width reduced from 434px to 390px; internal matrix scrolling and selection still work; selecting two default-size aluminium items gives 872 kr before delivery |
| Final browser log | No error-level messages returned after the final load |

The browser's full-page screenshot stitching produced a scaled duplicate capture. `home-fullpage-capture-artifact.png` is retained only as a capture diagnostic. Visual judgments use normal viewport screenshots, not that file.

## Visual and accessibility review

- Selected white/navy/blue composition, photographic hero, category rail, typography hierarchy and three-part product layout were compared with the approved reference together.
- Category pages reuse the product's existing cards and images with consistent spacing, responsive columns, labelled search, breadcrumbs, active category contrast and visible focus outlines.
- Selected filter text initially inherited blue-on-blue from the legacy global link rule; the scoped rule now produces white text on the blue selected background.
- Mobile menu uses the configured information links and real categories. Motion remains subject to the existing reduced-motion rules. This is not a full WCAG audit.

## Source and build checks

- 15 focused tests pass: selected print defaults, approved order defaults, category resolution, invalid branches, handoff/context preservation and invalid/unsupported input fallback.
- New catalog/navigation files pass targeted ESLint.
- Production build passes; existing large-bundle warnings remain.
- In-memory TypeScript comparison against before-task snapshots: 490 pre-existing diagnostics, 490 after, none added. The repository is not type-clean.
- Existing dirty worktree and concurrent admin work were preserved. No install, lockfile rewrite, reset, commit or deployment was performed.

## Remaining release work

The homepage and catalog links tested here now work. Before treating the entire shop as launch-ready, review published catalog copy/branding (some cards still use test/internal names), independently validate imported price tiers, and complete an owned product-to-order/payment/fulfillment test. Authenticated editor saving and publishing remain separate from this public-storefront verification.

Evidence directory: `output/design-exploration/homepage-repair-2026-09-08/`. It contains screenshots, the combined reference, route-check JSON, handoff evidence, final console errors, the exact local implementation patch and the approved database repair/rollback.
