# Homepage layouts and typography — 27 September 2026

Implemented in the local working source. No tenant settings were saved or published, and no product, pricing, POD, database or checkout logic was changed.

## Approved system collection

Thomas approved these as the standard built-in collection on 27 September. Every shop can select the choices through the normal Site Design picker. This approval does not select a new theme for existing tenants. The local `/shop?design=1` comparison entry uses the same ten choices, including Printstudio, and its chooser fits narrow screens.

## Design collection

The original five presets keep their IDs, order, names, reference images and compositions. Shared typography repairs prevent clipping and excessive canvas shrinkage.

Only the four newly added presets were redesigned following the user's clarification:

| Choice | Stable ID | Composition |
| --- | --- | --- |
| 6. Everyday Gifts | `print-atelier` | Inset photo campaign, circular categories, asymmetric gift/photo-product mosaic |
| 7. Format / Signage | `print-signal` | Panoramic large-format campaign, numbered banner/sign/display categories, compact product list |
| 8. Merch Studio | `print-form` | Apparel photography beside editorial copy, category filters/search, fashion-style product grid |
| 9. Print Partner | `print-partner` | Compact business introduction, category sidebar, searchable ordering rows |
| 10. Printstudio | Existing `print-studio` product presentation | Shared tabletop catalogue, now discoverable directly in Shopdesign |

Printstudio was identified by the user from the original `05-print-studio.png` mockup. Selection reuses the existing product-presentation setting and preserves tenant header, logo, colours, fonts, hero and featured-product configuration. It presents the tabletop before the configured featured product. Choosing a full homepage preset clears the alternate presentation through the existing draft-only selection helper.

The four new storefront structures read the tenant-scoped published catalogue, exclude category landing placeholders, reuse existing category resolution and product destinations, and retain the configured featured-product ordering component. Product counts are derived from that catalogue. They do not create demo products in a real shop. A shop needs the appropriate assortment for its chosen visual direction.

Three default campaign photos were copied unchanged from existing repository assets: Snap Cherish mug photography, Banner Builder wide-format photography, and Tee Design Hub apparel photography. Original preset art is unchanged.

## Typography

- Print banners grow with their copy; configured heights are minimums. Text and slider controls have separate space.
- Print featured-product canvases reflow below 1,000 px of available width instead of shrinking all type and controls.
- Dynamic names, descriptions, buttons and options wrap within their columns. Very narrow category layouts use a single column.
- Printstudio rows grow with long labels and preserve the product image's space. Authored product-image zoom is contained within its own image frame, preventing 140% images from expanding a narrow page.
- The shared header fit mechanism remains responsible for compact navigation.

## Verified

- 60 settled browser cases: all ten choices at 1440, 1280, 1024, 768, 390 and 320 px, using long tenant names, 22 px centred navigation settings, long banner text and compound product names. No measured page overflow, target text clipping or hero-copy clipping.
- All four new layouts and Printstudio selected in the actual Site Design editor component, with the expected rendered preview. Printstudio survives an isolated fixture draft save/reload.
- Apparel category filtering and search, no-result feedback, business search and Printstudio search. A roll-up category click shows its filtered catalogue and retains tenant context.
- Mobile slideshow advances with inactive content inert; mobile menu destinations and Escape checked.
- The signed-in working editor at `http://127.0.0.1:8137/admin/site-design-v2` shows all ten choices after application. Its live-state indicator remained unchanged; no tenant draft was edited or saved.
- The standard `/shop?design=10` preview also passes all six widths with the actual shop catalogue and 140% product-image zoom. All ten comparison buttons remain within the viewport; the chooser correctly switches between Everyday Gifts and Printstudio. Evidence: `verification/standard-picker-checks.json` and `verification/standard-library.png`.
- 35 focused tests pass, app TypeScript check and production build pass, scoped changed-component lint passes. Existing large bundle warning and pre-existing FeaturedProductConfigurator lint debt remain.
- Earlier evidence also includes 72 layout/dimension-field cases before the four newer compositions were revised. Those results are historical, not substitutes for the latest 60-case sweep.

Evidence and reversible source snapshots: `output/homepage-designs-2026-09-26/`. The manifest captures 18 exact source/asset changes; apply/rollback refuses any drift. The original browser had left the unsaved editor and was on the homepage before source changes were applied.

The preview on port 8142 uses an isolated snapshot and labelled synthetic assortments. It blocks remote connections and state-changing HTTP methods; draft persistence is local fixture storage. These checks do not prove hosted save/publish, live pricing, payment or order acceptance. The 30 legacy colour/effect styles are not separate homepage layouts and are outside this ten-choice sweep.
