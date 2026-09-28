# Webprinter selected storefront designs

> Default correction, 8 September 2026: the numbering used in the historical review below was mistaken. Thomas's original picture 1 is **Refined Familiar** (`print-familiar`), with the blue header and brochure-photo banner. It is the corrected system default. All five layouts remain selectable; their stable IDs and archived image filenames are preserved. See `docs/STOREFRONT_DEFAULT_CORRECTION_2026-09-08.md` and the corrected `display-order.json`. Historical screenshots and results below describe the earlier selection.

final result: passed

Date: 8 September 2026. Scope: local implementation of the five selected storefront concepts and their shared design picker. This result does not cover a full site-editor redesign, hosted save/publish, checkout completion, PDF output or production acceptance.

## Selection and implementation

Thomas selected all five displayed concepts and made number 1 the default. The authoritative reference order is `output/design-exploration/webprinter-2026-09-07/display-order.json`.

| Option | Design | Theme ID | Role |
| --- | --- | --- | --- |
| 1 | Precise Print Grid | `print-precise` | New default |
| 2 | Refined Familiar | `print-familiar` | Selectable preset |
| 3 | Nordic Print Studio | `print-nordic` | Selectable preset |
| 4 | Product First | `print-product` | Selectable preset |
| 5 | Calm Blue Commerce | `print-calm` | Selectable preset |

The existing Site Design draft flow now presents the five image cards first. Earlier themes/effects remain in a collapsed group. Presets preserve tenant identity, navigation, product configuration and authored copy; original hero images are retained in the draft settings for recovery. Explicit existing theme choices are preserved. Nothing was saved to hosted branding or published.

## Evidence and visual comparison

Environment: branch `ui-cleanup`, existing dirty checkout at `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main`; Vite on `127.0.0.1:8110`, port owner and working directory verified. Public storefront reads hosted catalogue data. Comparison route: `/shop?tenantId=00000000-0000-0000-0000-000000000000&design=1`, with `design=2` through `5` for the alternatives. The query override and comparison controls are development-only.

Evidence directory: [implementation screenshots](output/design-exploration/webprinter-2026-09-07/implementation/).

- `compare-1.jpg` through `compare-5.jpg` combine each selected reference on the left with its real implementation on the right, at a matched desktop frame of 1488 × 1058. All five combined comparisons were inspected.
- `desktop-1.png` through `desktop-5.png`: final desktop renders after the spacing fix.
- `mobile-1.png` through `mobile-5.png`: final 390 × 844 renders.
- `tablet-1.png` through `tablet-5.png`: final 768 × 1024 renders.
- `responsive-checks.json`: no horizontal document overflow and no failed loaded images for all five final phone and tablet variants. Desktop checks also found no overflow or failed images.
- `picker.png`: shared five-card picker open in the local preview; `mobile-calculator.png`: expanded mobile product controls and calculated price.

## Rubric review

| Surface | Observed result |
| --- | --- |
| Typography | Inter headings/body/prices, distinct display and product hierarchy, readable Danish labels and prices. Headings wrap within the responsive layouts. The existing tenant logo remains intact. |
| Layout and spacing | Each option retains its selected composition: 1 category rail and split calculator; 2 photographic banner and horizontal offer; 3 warm hero and compact configurator; 4 search-first catalogue; 5 pale-blue hero and bordered offer. Desktop alignment and mobile stacking checked. |
| Color and surfaces | White/navy/blue foundation; blue headers in 2 and 5; warm neutral imagery in 3. Borders and radii are restrained. Existing tenant color controls remain available. |
| Imagery | Optimized raster hero/category photographs, with the real catalogue image for the configured product. All selected subject types are represented. No custom SVG or CSS drawings substitute for photographic assets. |
| Icons | Consistent Lucide line icons for navigation, categories, search and actions. Mobile menu and selected preset indicators work. |
| Content | Real product names, categories, quantities and prices; neutral Danish ordering copy. No invented stock, delivery or certification claims were added. Existing tenant content remains below the new storefront section. |
| States | All five switches, picker open/select/close, mobile menu, populated/empty search, quantity and dimension updates exercised in the browser. Loading/error/empty fallbacks remain in source. No backend failure was induced. |
| Accessibility | Native buttons/links/inputs; named search and dimension fields; selected quantity/preset ARIA state; menu expanded state; focus styling and reduced-motion CSS reviewed. Mobile menu button is 44 × 44 px. This is not a full assistive-technology or browser-zoom audit. |
| React integration | Reuses the existing catalogue hook, header and calculator; no duplicated pricing engine. Derived categories/results are memoized and stable keys used. New behavior is scoped to registered print themes. |

## Findings resolved

1. **P1 — Layout:** inherited featured-product overlap/side-panel settings could distort the selected composition. Preset application now supplies appropriate visual settings while retaining product identifiers, quantities and side-panel content.
2. **P2 — Spacing:** the older storefront template's `!important` padding overrode the new layouts. Scoped selectors now establish the correct section spacing; all five desktop references and final responsive widths were rechecked.
3. **P2 — Responsive controls:** the calculator needed explicit regions and stacking rules. Added presentation classes and responsive grid rules; phone controls remain readable and operable without horizontal overflow.
4. **P2 — Runtime warning:** a React 18 unsupported `fetchPriority` prop warning was introduced during implementation. Removed the prop; a fresh-page error-log check was empty.

## Intentional differences / remaining polish

- Live catalogue categories, tenant logo, navigation and locale controls replace sample reference data. There are five real category entries in this shop, including Storformat; a fabricated active category is not shown on the shop landing page.
- The real aluminium product image is retained; its angle/crop differs from the generated concept image. Category artwork is shared across applicable presets.
- Design 3 keeps the existing centimetre fields and four quantity choices instead of turning them into the concept image's sample dropdowns. This preserves the actual product configuration contract.
- Minor crop, line-wrap and vertical-density differences remain where live data differs from the concepts. These are P3 polish differences and do not block reading or ordering controls.
- The floating comparison bar is local review UI, not part of the production storefront. It can overlay the bottom edge of a screenshot.

## Functional and engineering validation

- Live aluminium calculator: 100 × 100 cm, quantity 1 = **436 kr**; quantity 2 = **872 kr**; 120 × 60 cm, quantity 2 = **628 kr**. Reset to the original values afterward. No pricing calculation code was changed.
- Design 4 search: `aluminium` returns the real product; a non-matching query shows the empty state; clearing restores the catalogue and calculator.
- Selecting the default card in the shared picker changes the local preview and selected state. The authenticated editor's save/publish flow was source-inspected, not exercised.
- `Bestil nu` opens the actual Aluminium Skilte product page with tenant context retained. The page rendered the existing pricing matrix and 436 kr product price / 565 kr total with standard delivery. No order was submitted and no checkout upload was performed.
- Three focused preset contract tests pass, covering all five choices, the default, preservation of authored data, and stock-copy/artwork behavior.
- Final production build passes (7.42 s). Existing large-bundle warnings remain.
- Whole-project TypeScript comparison: **493 baseline diagnostics, 493 current, zero added**. The repository is not globally type-clean.
- Scoped diff whitespace check passes. Existing dirty work was preserved; no dependencies, pricing/POD logic, schema or hosted settings were changed by this implementation.

The five selected storefront designs pass this local design and interaction review. The further three variations of each of the 30 older presets remain planned; this report does not mark those 90 concepts complete.

## Landing-page option 1 — 8 September 2026

Final result: **passed** for the local platform landing page selected in the landing-design task. The existing storefront report above remains separate and unchanged. See [landing-page review and evidence](docs/LANDING_PAGE_DESIGN_QA_2026-09-08.md) for reference comparison, responsive checks, walkthrough validation, asset provenance and scope limits.

## Local home-navigation correction — 8 September 2026

The user reported that returning from a redesigned product to the home page restored the old theme. Reproduced at `/?tenantId=00000000-0000-0000-0000-000000000000`: the saved legacy theme won whenever the comparison-only `design` query was absent.

`useShopSettings` now derives the approved design 1 for the local master storefront when it still has a legacy theme. This is a development-only presentation override shared by the home, product and checkout consumers. It leaves cached/hosted settings intact, preserves any saved selection from the five new designs, and does not apply to production hosts/builds, other tenants, admin routes or editor previews. The existing explicit comparison links still select the alternatives.

Browser verification: the plain home URL rendered “Dit print. Helt enkelt.”; home → Aluminium → logo → home and a full reload retained design 1. An explicit design 2 comparison still rendered its matching hero. Home → product → checkout retained Standard 2, Standard 6 and 436 + 129 = 565 kr; the checkout logo returned to design 1. No errors occurred during the final navigation checks after a full reload. The earlier hot-update hook-order warning was confined to the pre-reload session.

Seven focused preset/order-design tests pass. Production build passes; TypeScript remains at the same 493 baseline diagnostics with none added or removed. Logs: `tmp/home-design-build.txt`, `tmp/home-design-type-comparison.json`. This correction does not publish branding or complete an order.
