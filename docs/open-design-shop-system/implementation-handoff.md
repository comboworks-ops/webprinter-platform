# Open Design Shop Implementation Handoff

## Central Contract

`src/lib/storefront/shopTemplates.ts` owns all ten templates and their complete
component recipes. Add future recipes there and extend its tests; do not create
a second registry.

The persisted contract remains `branding.forside.layout` version 1. Recipe
details are derived from `templateId`, keeping persisted tenant data small and
allowing recipe improvements without data migration.

## Editor

`ShopTemplatePicker.tsx` provides ten compact previews and the independent
product-menu selector. `SiteDesignEditorV2.tsx` applies presentation defaults
to the branding draft only. It preserves products, product IDs, pricing,
content, images and colours. The preview toolbar can navigate directly to
homepage, product overview, checkout or a concrete product, and it can
open/close the storefront's real product submenu. Desktop preview uses a fixed
1280 x 800 iframe that scales to fit the available editor area.

## Storefront

- `StorefrontThemeFrame.tsx` resolves the recipe and scopes data attributes.
- `Header.tsx` applies the selected dropdown mode and header recipe.
- `StorefrontProductTabs.tsx` exposes category-navigation hooks.
- `ProductGrid.tsx` exposes collection and card anatomy hooks.
- Product/order pages consume the scoped product-page recipe.
- `FileUploadConfiguration.tsx` and `PreviewShop.tsx` expose checkout regions.
- `storefrontShopTemplates.css` contains responsive component recipes.

## Responsive Rules

Wide product rows and all checkout compositions collapse to one column on
small screens. Sticky summaries become static. Large product imagery receives
fixed responsive heights. Reduced-motion preferences disable recipe movement.

## Data Safety

This layer must remain presentation-only. It must not change pricing
calculations, POD v1/v2, supplier imports, order submission, tenant scoping or
published branding outside the existing draft/publish workflow.

## Acceptance

Run:

```bash
node --test src/lib/storefront/shopTemplates.test.ts
pnpm run build
```

Then preview at least homepage, Bestilling and Checkout in Site Design V2 on a
desktop and narrow viewport. Verify the chosen recipe attributes on
`.storefront-shop-template-scope`, no horizontal overflow, and that selecting
a recipe does not publish it. Also open a concrete product through the preview
selector, confirm its price interface renders, and toggle the real product
submenu from the preview toolbar.
