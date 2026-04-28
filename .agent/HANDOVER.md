# Agent Handover

Last updated: 2026-04-28

Read these first:
1. `AGENTS.md`
2. `HANDOVER.md`
3. `AI_CONTINUITY.md`
4. `POD2_README.md`
5. `SYSTEM_OVERVIEW.md`

The root `HANDOVER.md` is now the current human-readable handover. The root
`AI_CONTINUITY.md` is the condensed AI startup file.

## Current Snapshot

Branch: `ui-cleanup`
Latest commit: `7932644 feat: polish tenant site design controls`
GitHub branch: `https://github.com/comboworks-ops/webprinter-platform/tree/ui-cleanup`
Live Vercel alias: `https://www.webprinter.dk`

The latest session was deployed to Vercel production successfully.

## What Changed Recently

Major Site Design V2 and tenant storefront work:
- Complete visual theme presets.
- Ten color presets and five font presets.
- Advanced per-theme button effects.
- Contrast safeguards for generated buttons.
- Hero/banner transitions, text effects and parallax controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots that open the right side-panel editors.
- Download Tilbud button styling target.
- SEO/tenant-shell fixes.
- POD v2 admin updates and Danish Print.com term mapping.

Important files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/ProductGrid.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/pages/admin/Pod2Admin.tsx`
- `src/lib/pod2/danishTerms.ts`

## Safety Notes

- Local admin may write to production Supabase data.
- Do not change POD v1 or core pricing unless explicitly asked.
- Read `POD2_README.md` before touching POD v2.
- Preserve tenant-specific settings. Code is shared, settings are per tenant.
- Run `npm run build` before any deploy.

