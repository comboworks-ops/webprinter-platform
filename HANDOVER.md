# Webprinter Handover

Last updated: 2026-04-28
Branch: `ui-cleanup`
Latest commit: `7932644 feat: polish tenant site design controls`
Live deploy: `https://www.webprinter.dk`
Vercel production deployment: `https://printmaker-web-craft-main-rl3rei7tx-thomas-projects-d80b9ddd.vercel.app`

This is the first file a new coding instance should read after `AGENTS.md`.
It summarizes the platform, the current repo state, what was changed recently,
and the important rules that keep production safe.

## System Summary

Webprinter is a multi-tenant SaaS print-shop platform. It powers storefronts
such as Webprinter, Onlinetryksager and Salgsmapper through shared React code
and tenant-specific Supabase data.

Core stack:
- React 18, TypeScript, Vite
- Tailwind CSS and shadcn/ui
- Framer Motion for modern motion and theme effects
- Supabase for PostgreSQL, Auth, Storage, RLS and Edge Functions
- Vercel for production hosting
- Fabric.js and PDF tooling for the online print designer

Core product areas:
- Tenant storefronts with configurable branding, SEO, header, hero, product
  grids, price calculator, matrix ordering and product pages.
- Admin panel for tenant/shop management, products, pricing, SEO, branding and
  design controls.
- Site Design Version 2, a visual editor where admins click storefront areas and
  edit the matching settings in a side panel.
- POD v2, a master-tenant Print.com integration that imports curated supplier
  products into the existing product/pricing system without replacing core
  pricing logic.
- Designer, a print-ready editor with size handling, preflight and PDF export.

Important production fact:
- Localhost and production use the same Supabase project in many workflows.
  Admin/product/tenant edits in local development can affect live tenant data.

## Current Repo State

The branch `ui-cleanup` has been committed and pushed to GitHub:
- GitHub branch: `https://github.com/comboworks-ops/webprinter-platform/tree/ui-cleanup`
- Commit: `7932644 feat: polish tenant site design controls`

Vercel production deployment completed successfully and aliased to:
- `https://www.webprinter.dk`

`gh` is not installed locally, so no GitHub PR was created from this machine.

Last validation:
- `npm run build` passed locally.
- Vercel production build passed.
- Existing Vite warnings remain: large chunks, dynamic/static import overlap,
  pdf.js eval warning and lcms browser externalization. These were warnings, not
  blockers.

## What Was Done Recently

### Site Design V2 and Visual Presets

The major recent work focused on making Site Design Version 2 much stronger.
Admins can now apply broader visual presets that change the full tenant shop
look without changing product/pricing logic.

Implemented:
- Ten complete color presets.
- Five font presets.
- Five distinct complete visual themes:
  - `Precision Print`
  - `Glass Studio`
  - `Premium Press`
  - `Bold Maker`
  - `Dark Production`
- Theme presets now affect header, dropdowns, hero, USP strip, products section,
  featured product, price matrix, price panel, option buttons and order buttons.
- Page transitions were added for non-admin storefront routes.
- Reduced-motion handling was respected for motion-heavy effects.

Important files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/App.tsx`

### Button Effects and Contrast Safety

All visual themes now have different button treatments rather than just
different colors:
- Satin/shaded buttons
- Apple-like glass buttons
- Pressed/blocky commerce buttons
- Luminous/glow buttons
- Hover lift, press, scale, sheen and shadow variations

Contrast safeguards were added so buttons do not become white-on-white or
black-on-black:
- Product grid CTA text is auto-corrected against its button background.
- Order button text is auto-corrected against its gradient background.
- Product option selected states use selected colors correctly.
- Hero banner buttons now support both hex and `rgba(...)` colors and correct
  unreadable text on normal and hover states.

Important files:
- `src/components/ProductGrid.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/admin/SiteDesignEditorV2.tsx`

### Hero, Header and Dropdown Work

The hero/banner and header dropdown systems were expanded:
- Hero transition controls for image changes.
- Text animation presets.
- Parallax style/intensity controls.
- Banner overlay and CTA color participation in theme presets.
- Header dropdown layout presets and smoother motion.
- Dropdown product hover was stabilized to avoid side-jiggle.
- Split preview can show the current campaign/framed product or the side panel.
- Product PNG images in dropdowns no longer receive unnecessary frames.

Important files:
- `src/components/HeroSlider.tsx`
- `src/components/Header.tsx`
- `src/components/admin/BannerEditor.tsx`
- `src/components/admin/HeaderSection.tsx`
- `src/hooks/useBrandingDraft.ts`

### Product Page Hotspots and Option Controls

Site Design V2 hotspots were expanded around the product ordering surface:
- Product option/attribute buttons can open the correct side-panel editor.
- Matrix button groups and white-format product option buttons use the same
  styling logic.
- Price matrix areas are more individually selectable.
- A section-box editor was added for the area around option/matrix controls.
- Download Tilbud button is now targetable and styleable.

Important files:
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/admin/ProduktvalgknapperSection.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/lib/pricing/selectorStyling.ts`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/StorformatConfigurator.tsx`

### SEO and Tenant Shell

SEO and tenant-shell related changes were included in the deployed commit:
- Tenant storefront SEO metadata handling was adjusted.
- A public-read migration for page SEO metadata was added.
- Storefront SEO and platform SEO plumbing were updated.

Important files:
- `api/tenant-shell.ts`
- `src/components/SEO.tsx`
- `src/components/storefront/StorefrontSeo.tsx`
- `supabase/migrations/20260427130500_public_read_page_seo_metadata.sql`

### POD v2 Updates

POD v2 remains separate from POD v1 and core pricing logic.
Recent POD v2 changes included:
- Admin catalog/order UI improvements.
- Danish term mapping for Print.com import labels.
- Minor Edge Function adjustment for `pod2-explorer-request`.
- Product links/status/admin handling improvements from the wider branch.

Important files:
- `POD2_README.md`
- `src/pages/admin/Pod2Admin.tsx`
- `src/pages/admin/Pod2Katalog.tsx`
- `src/pages/admin/Pod2Ordrer.tsx`
- `src/lib/pod2/danishTerms.ts`
- `supabase/functions/pod2-explorer-request/index.ts`

## Non-Negotiable Rules

1. Read `POD2_README.md` before touching POD v2.
2. Do not modify POD v1 or core pricing logic unless the user explicitly asks.
3. Keep POD v2 additive and separate.
4. Treat pricing as sensitive. Do not change calculations casually.
5. Tenant-specific visual settings are data-driven. Shared code changes affect
   local tenants only when those tenants use the same deployed code/settings.
6. Local admin may write to live Supabase data. Confirm tenant/context before
   changing data.
7. Preserve user edits in the working tree. Do not reset/revert without a clear
   user request.

## Files a New Agent Should Read First

Read in this order:
1. `AGENTS.md`
2. `HANDOVER.md`
3. `AI_CONTINUITY.md`
4. `POD2_README.md`
5. `SYSTEM_OVERVIEW.md`
6. `.agent/HANDOVER.md`

For current visual/theme work, start with:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/components/HeroSlider.tsx`
- `src/components/Header.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`

## Useful Commands

```bash
npm run dev
npm run build
git status --short --branch
git log --oneline -5
vercel deploy . --prod -y
```

Development server behavior:
- Port `8080` is often already in use.
- Vite may choose `8081` or `8082`.
- In the latest session, the dev server was available at `http://localhost:8082/`.

## Open Follow-Up Ideas

These were discussed but are not completed as productized features:
- Optional AI chat that changes a tenant site inside existing design constraints.
- A POD marketplace/shop where tenants can browse supplier products before
  importing them.
- More supplier adapters beyond Print.com. POD v2 will not automatically work
  for every supplier API without provider-specific adapters.
- Further code-splitting to reduce Vite chunk-size warnings.

