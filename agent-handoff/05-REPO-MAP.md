# Repo Map

This is the practical map for finding core logic quickly.

## Main App Entry

- `src/App.tsx`
- `src/pages/Admin.tsx`
- `src/pages/Shop.tsx`

## Core Domains

### Storefront

- `src/pages/Shop.tsx`
- `src/pages/ProductPrice.tsx`
- `src/components/Header.tsx`
- `src/hooks/useShopSettings.ts`

### Products / Pricing

- `src/components/admin/ProductOverview.tsx`
- `src/components/admin/ProductPriceManager.tsx`
- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `docs/PRICING_SYSTEM.md`

### Site Designer / Branding

- `src/components/admin/BrandingEditorV2.tsx`
- `src/components/admin/TenantBrandingSettingsV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/components/admin/BrandingPreviewFrame.tsx`
- `docs/SITE_DESIGN_V2_AUDIT.md`

### Sites / Facade Storefronts

- `src/pages/admin/SitesAdmin.tsx`
- `src/components/sites/SitePackagePreview.tsx`
- `src/lib/sites/sitePackages.ts`
- `src/lib/sites/productSiteFrontends.ts`
- `src/lib/sites/installSitePackage.ts`
- `docs/SITES_PREVIEW_BUNDLES.md`
- `docs/SITES_FOLLOWUPS.md`

### Designer Module

- `src/pages/Designer.tsx`
- `src/components/designer/EditorCanvas.tsx`
- `src/components/designer/DesignLibraryDrawer.tsx`
- `src/utils/preflightChecks.ts`

### Tenant / Domain / Access

- `src/lib/adminTenant.ts`
- `src/hooks/useShopSettings.ts`
- `src/components/admin/DomainSettings.tsx`
- `src/components/admin/AdminSidebar.tsx`

### POD

- `POD2_README.md`
- `src/pages/admin/PodAdmin.tsx`
- `src/pages/admin/Pod2Admin.tsx`
- `docs/POD_SYSTEM.md`
- `docs/POD_V2_SYSTEM.md`

## Main Documentation

- `README.md`
- `SYSTEM_OVERVIEW.md`
- `AI_CONTINUITY.md`
- `.agent/HANDOVER.md`
- `docs/CRITICAL_FLOWS.md`
- `docs/DOMAIN_CONTRACTS.md`
- `docs/API_ROLLOUT_PLAN.md`

## Important Storage / Backend Areas

- `src/integrations/supabase/client.ts`
- `supabase/migrations/`
- `supabase/functions/`

## Import / Supplier Tooling

- `scripts/`
- `.agent/skills/pixart/SKILL.md`
- `.agent/skills/tshirt-fetch/SKILL.md`
- local fetch scripts under `scripts/`
