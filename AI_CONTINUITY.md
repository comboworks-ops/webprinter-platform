# Webprinter AI Continuity

Last updated: 2026-04-28
Purpose: give future AI/Codex instances immediate context before they edit code.

Start here, then read `HANDOVER.md`, `POD2_README.md` and
`SYSTEM_OVERVIEW.md`.

## One-Minute Summary

Webprinter is a multi-tenant SaaS platform for print shops. It has tenant
storefronts, an admin panel, a Site Design V2 visual editor, a product price
calculator/matrix system, a print designer, SEO tooling and a POD v2 Print.com
integration.

The newest work was a large Site Design V2 and storefront polish pass:
- Complete visual theme presets.
- Stronger color and font presets.
- Different advanced button effects per theme.
- Contrast safeguards for buttons and hero CTAs.
- Hero/banner animation controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots for side-panel editing.
- SEO/tenant-shell updates.
- POD v2 admin improvements and Danish Print.com label mapping.

The current branch `ui-cleanup` was committed, pushed and deployed to Vercel
production:
- Commit: `7932644 feat: polish tenant site design controls`
- Live: `https://www.webprinter.dk`

## Architecture Snapshot

Frontend:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Framer Motion
- TanStack Query
- React Router

Backend:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- RLS policies

Deployment:
- Vercel production alias: `https://www.webprinter.dk`

Important multi-tenant behavior:
- Storefront code is shared.
- Tenant-specific branding/SEO/product data is stored in Supabase.
- Code changes deploy globally, but saved tenant settings remain per tenant.
- Localhost often points at the same Supabase data as production.

## Current Priority Areas

### Site Design V2

Main goal: admins should click storefront areas in preview and edit those areas
in the side panel.

Recent work:
- Added/expanded visual presets in `SiteDesignEditorV2.tsx`.
- Added theme-wide button surface controls and motion parameters.
- Added option/matrix box controls and hotspots.
- Connected price panel Download Tilbud styling target.
- Added page transitions and dropdown motion presets.

Key files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/hooks/useBrandingDraft.ts`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/admin/ProduktvalgknapperSection.tsx`

### Storefront Header, Dropdowns and Hero

Recent work:
- Header dropdown presets and motion.
- Split-preview dropdown can use current campaign/framed product.
- Removed unnecessary image frames around PNG product images.
- Stabilized dropdown product hover so it zooms smoothly without lateral shift.
- Hero banner gained text animations, slide transitions and parallax controls.
- Hero buttons now protect against unreadable text and support `rgba(...)`.

Key files:
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/admin/HeaderSection.tsx`
- `src/components/admin/BannerEditor.tsx`

### Product Price Page

Recent work:
- Dynamic option buttons now have richer hover/selected styling.
- Matrix option buttons and white-format option buttons share more styling
  logic.
- Product grid CTAs and order buttons use theme-specific surfaces.
- Download Tilbud is style-targetable.
- Contrast helpers prevent unreadable text on theme-generated buttons.

Key files:
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/product-price-page/StorformatConfigurator.tsx`
- `src/components/ProductGrid.tsx`
- `src/lib/pricing/selectorStyling.ts`

### SEO and Tenant Shell

Recent work:
- Storefront SEO metadata path was adjusted for tenant shops.
- Migration added for public page SEO metadata reads.
- Tenant shell was adjusted as part of making SEO visible on tenant storefronts.

Key files:
- `api/tenant-shell.ts`
- `src/components/SEO.tsx`
- `src/components/storefront/StorefrontSeo.tsx`
- `supabase/migrations/20260427130500_public_read_page_seo_metadata.sql`

### POD v2

POD v2 is a Print.com integration for master-admin curation and tenant imports.
It feeds data into the existing product system. It must not replace or alter
core pricing logic unless explicitly approved.

Recent work:
- Danish term mapping for Print.com import wizard labels.
- Admin UI/catalog/order improvements.
- Minor request function adjustment.

Key files:
- `POD2_README.md`
- `src/pages/admin/Pod2Admin.tsx`
- `src/pages/admin/Pod2Katalog.tsx`
- `src/pages/admin/Pod2Ordrer.tsx`
- `src/lib/pod2/danishTerms.ts`
- `supabase/functions/pod2-explorer-request/index.ts`

## Safety Rules for Future AI Agents

Do:
- Prefer additive changes.
- Preserve tenant data and tenant-specific settings.
- Run `npm run build` after frontend changes.
- Use existing branding and pricing types instead of inventing parallel config.
- Keep theme changes in the branding model and storefront renderers.
- Respect reduced-motion settings for Framer Motion work.

Do not:
- Reset the branch or revert user changes without explicit instruction.
- Change core pricing calculations casually.
- Merge POD v2 into POD v1.
- Hard-delete POD v2 catalog/import data manually.
- Assume localhost is safe test data.

## Last Known Validation

Local:
- `npm run build` passed.

Vercel:
- Production build passed.
- Deployment completed.
- Alias applied to `https://www.webprinter.dk`.

Known warnings:
- Large Vite chunks.
- Supabase client mixed dynamic/static imports.
- `pdfjs-dist` eval warning.
- `lcms-wasm` browser externalization warning.

These warnings existed during successful deployment.

## If Continuing Visual Theme Work

Check these first:
- Are the generated colors readable in normal, hover and selected states?
- Does the theme affect header, hero, USP, products, matrix, price panel and
  option buttons consistently?
- Does a tenant's saved branding override still work?
- Does preview click-to-edit open the correct side panel section?
- Does mobile still fit without overlap?

Run:

```bash
npm run build
```

If deploying:

```bash
git status --short --branch
git add -A
git commit -m "..."
git push -u origin ui-cleanup
vercel deploy . --prod -y
```

