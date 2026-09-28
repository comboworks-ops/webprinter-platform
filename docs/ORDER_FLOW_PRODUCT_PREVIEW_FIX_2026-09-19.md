# Product/order layout preview repair — 19 September 2026

## Report and cause

In Site Design V2, selecting `Produkt & pris` option 2 or 1 did not change the product preview. The preview used `ProductPriceContent`, which did not consume `useOrderFlowDesign`, and its surrounding `StorefrontThemeFrame` lacked the order-design attribute. The regular `ProductPrice` page applied the distinct calculator layouts to STORFORMAT only; matrix and legacy products still used a fixed grid.

## Local changes

- PreviewShop applies the selected calculator design to the shared storefront frame for product routes only.
- ProductPriceContent reads the draft selection. STORFORMAT uses its existing layout prop and compact order summary.
- Matrix and legacy products use a shared ProductCalculatorLayout in both preview and customer routes. MatrixLayoutV1Renderer exposes an optional presentation layout around its existing selectors and price matrix; other callers retain their existing rendering.
- The shared layout keeps controls mounted while CSS positions them for Standard 2 (large image, options beside it) and Alternative 1 (compact image, options below). This preserves a customer's selection when switching in the editor.
- No calculations, price data, product visibility, tenant scoping, persistence or publishing behavior changed. The existing preview-only pricing override mechanism remains in place.

## Verification

Correct checkout served locally on 127.0.0.1:8111. The localhost backend remains the live Supabase project; only existing data was read. No save/publish action, payment, upload, supplier submission or deployment was performed.

- Authenticated local Site Design editor, separate temporary tab: selected Blokke, changed format to A5, switched Standard 2 -> Alternative 1 -> Standard 2. Iframe attributes and geometry followed the picker immediately. Image height changed 465 -> 160 px; controls moved from the right to the left. Selected A5, 25 pages, no cover, top binding and 10 copies remained; product price 267 kr and total 316 kr were identical before/after.
- Desktop 1280 px, tablet 768 px and mobile 390 px checked with the editor's actual iframe controls; no horizontal document overflow. Desktop alternative and mobile standard visually inspected. Additional browser viewport requests did not resize the viewport (it stayed 1280); 320/700/701/1024/1440 checks are therefore not claimed.
- Standalone local preview: Aluminium Skilte uses Standard 2, 465 px image, live option controls, 436 kr product price and no horizontal overflow.
- Customer product route `/produkt/blokke`: both local design options render and switch. No captured console errors in the checked editor/customer/preview tabs.
- 11 existing focused tests passed: orderFlowDesigns, productPricingPreview, siteDesignPreviewNavigation.
- AST comparison against pre-edit snapshots confirmed every existing pricing, selection, template and order prop/callback binding remained identical across ProductPricePanel, PriceMatrix, MatrixLayoutV1Renderer, StorformatConfigurator, DynamicProductOptions and MachineConfigurator. Only layout/presentation/preview-branding props were excluded from comparison.
- Five changed TSX components add no ESLint diagnostics relative to pre-edit files. Existing diagnostics remain (6 PreviewShop, 46 ProductPrice, 27 ProductPriceContent, 33 MatrixLayoutV1Renderer). New shared layout: zero diagnostics.
- Production frontend build passed in 27.09 seconds, written to `/private/tmp/webprinter-order-layout-build-20260919-final`. Existing dependency/chunk warnings remain. Scoped `git diff --check` passed.

This proves local rendering and draft-to-preview switching. It does not certify hosted saving/publishing or a production order. The repository contains extensive pre-existing changes; preserve them and release this repair separately if requested.
