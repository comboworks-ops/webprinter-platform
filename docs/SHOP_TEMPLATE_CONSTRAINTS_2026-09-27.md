# Shop template constraints — 27 September 2026

Local CSS corrections requested for Format / Signage, Precise Print Grid and Product First. These are integrated into the existing shared components on the workspace Vite server at port 8159. No tenant settings, chosen design, products, prices, POD logic or saved drafts were changed. No deployment.

## Reproduced causes and changes

- **Precise Print Grid:** at 1280 px the featured canvas is 837 px wide and uses compact mode. A later container rule makes the outer card a two-column grid, but old desktop image addresses (`grid-column:1; grid-row:2/6`) survive. The content then occupies only the left column and pushes the image below it. Compact cards now clear those addresses and let image/content flow into the two available columns. The price row fills its column. With the actual Salgsmapper content the section fell from 954.58 px to 523.79 px high; the content's right edge is 28 px inside the card edge.
- **Product First:** four fixed quantity columns occupied only part of the configuration column. Actual buttons were about 56 px wide; both quantity and price wrapped, sometimes inside a number, producing 90 px-tall buttons. Quantity rows now use wrapping flex items with an intrinsic minimum. When no dimension or option groups exist, the quantity group uses the complete content row. The same actual labels now have approximately 125 px-wide, 54 px-high buttons at 1280 px.
- **Button contract:** connected shared buttons and primary actions preserve authored newline characters but do not insert automatic line breaks. Quantity and price remain separate intentional block labels. Rows reflow complete buttons. Existing colour, font family, selected-state, hover-effect and local-override rules remain.
- **Artwork boundaries:** the print main area is a stacking context below the header. Legacy minimum hero heights no longer apply to nested image frames; each nested media frame clips its own content. Design-picker miniature media also has bounded grid tracks and clipping. Existing images and selected parallax remain intact. The original reported photo/menu collision did not reproduce with the currently saved shop content; these are added containment safeguards, verified with imported artwork and navigation, rather than a claimed exact reproduction of that collision.

## Evidence

Source and screenshots: `output/template-constraints-2026-09-27/`.

- `before-precise.png` / `after-precise.png`
- `before-product-first.png` / `after-product-first.png`
- `before-signage-menu.png`, `before-signage-editor.png`
- `stress-signage-320.png` / `stress-signage-menu-320.png`
- `explicit-button-lines.png`
- `template-constraints.patch` contains only this turn's three CSS changes, relative to saved pre-edit copies.

Live-data local review links (development overrides only; no saved template change):

- [Product First](http://127.0.0.1:8159/shop?design=2&tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba)
- [Precise Print Grid](http://127.0.0.1:8159/shop?design=4&tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba)
- [Format / Signage](http://127.0.0.1:8159/shop?design=7&tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba)

## Verification

- **18 real-shop cases:** all three requested designs at 1440, 1280, 1024, 768, 390 and 320 px, with all five quantities loaded. No document overflow, wrapped quantity/price labels, clipped tested buttons or header occlusion. `real-shop-checks.json`.
- **18 isolated stress cases:** the same three designs at all six widths, long names/headings, 22 px centred menu settings, imported hero image with parallax, 140% featured-image zoom and longer CTA labels. `stress-checks.json`.
- **18 additional regression cases:** Familiar, Nordic, Calm, Everyday Gifts, Merch Studio and Print Partner at 1280, 390 and 320 px with the same stress content. `regression-checks.json`. Printstudio's separate catalogue is outside this sweep.
- Mobile menu opened above the artwork and Escape restored the toggle. Actual shop quantity selection 200 → 500 → 200 updated the visible price 1,184 → 2,601 → 1,184 kr. No checkout or backend writes were triggered.
- Explicit newline fixture: ordinary label height 51.59 px; the same label with an authored second line grows to 73.19 px. Two neighbouring buttons in a narrow row move as whole controls to separate rows.
- Actual Site Design component was inspected in a separate editor tab; a temporary Format / Signage selection was not saved. The original editor was not refreshed, navigated or reset. Its Nordic Print Studio selection and “Live version er opdateret” indicator were unchanged at completion.
- App TypeScript check and production Vite build pass. Existing large-bundle warning remains. CSS was parsed by the production build; no new CSS-literal unit tests were added. `git diff --check` passes; the real-shop review tab has no recorded console errors.
- Temporary responsive viewport overrides were reset. Separate test editor and fixture tabs were closed; the actual-shop comparison tab remains for review.

These are local browser/layout results, including explicitly synthetic stress cases. They do not establish hosted publication, physical-device or commerce acceptance. Roll back only the scoped patch hunks; preserve the existing dirty checkout and prior work.
