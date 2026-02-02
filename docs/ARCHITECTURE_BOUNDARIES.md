# Architecture Boundaries

This document defines the domain boundaries for the codebase. AI agents and developers should consult this before making changes to ensure they don't accidentally modify code outside their intended domain.

---

## Domain Overview

| Domain | Description | Primary Files |
|--------|-------------|---------------|
| **Designer** | Print canvas, preflight, PDF export, color proofing | `components/designer/*`, `lib/designer/*` |
| **Pricing** | Price matrices, machine pricing, cost calculations | `lib/pricing/*`, `utils/productPricing.ts` |
| **Branding** | Tenant appearance: colors, fonts, hero, footer | `lib/branding/*`, `contexts/Preview*` |
| **POD v1** | Legacy print-on-demand (ISOLATED) | `lib/pod/` |
| **POD v2** | New print-on-demand (ISOLATED) | `lib/pod2/` |
| **Admin** | Management UI for all domains | `components/admin/*` |
| **Shop** | Customer-facing storefront | `pages/Shop.tsx`, `components/Product*` |

---

## Boundary Rules

### Designer Domain

**Owns:**
- Canvas rendering (Fabric.js wrapper)
- Preflight checks (validation before export)
- PDF export (vector preservation, crop calculations)
- Color proofing (ICC profile soft proofing)
- Physical scaling (DPI-based image sizing)

**Key Files:**
- `src/pages/Designer.tsx` - Main designer page
- `src/components/designer/*` - EditorCanvas, LayerPanel, PropertiesPanel, etc.
- `src/lib/designer/export/*` - Export actions, PDF background, crop rect
- `src/utils/preflightChecks.ts` - Print validation rules
- `src/utils/imageMetadata.ts` - DPI extraction
- `src/hooks/useColorProofing.ts` - ICC soft proofing
- `src/workers/colorProofing.worker.ts` - lcms-wasm processing

**Can Import From:**
- `products` table (read-only for dimensions/templates)
- `utils/imageMetadata.ts`, `utils/unitConversions.ts`
- Product color profiles

**MUST NOT:**
- Calculate prices or modify `pricing_structure`
- Change branding state
- Import from `lib/pricing/*` or `utils/productPricing.ts`

**Protected Files (see `.agent/workflows/`):**
- `preflightChecks.ts` - Validation constants
- `colorProofing.worker.ts` - lcms-wasm API (3-param)
- `exportVectorPdfBackground.ts` - Vector preservation
- `computeExportCropRect.ts` - Crop calculations
- `DISPLAY_DPI`, `PASTEBOARD_PADDING` constants

---

### Pricing Domain

**Owns:**
- Static price matrices (flyers, folders, hæfter, etc.)
- Machine pricing engine (MPA calculations)
- Storformat pricing (large format)
- Price display components

**Key Files:**
- `src/lib/pricing/machinePricingEngine.ts` - MPA pure functions
- `src/utils/productPricing.ts` - Static price matrices
- `src/utils/storformatPricing.ts` - Large format pricing
- `src/utils/pricingDatabase.ts` - Supabase query utilities
- `src/components/product-price-page/*` - Price matrix rendering

**Can Import From:**
- `products`, `product_options`, `machines`, `materials` tables
- Product variants and configurations

**MUST NOT:**
- Touch designer canvas or export logic
- Modify preflight validation rules
- Change branding appearance
- Import from `components/designer/*` or `lib/designer/*`

---

### Branding Domain

**Owns:**
- Tenant appearance (colors, fonts, hero, footer)
- Draft/publish workflow
- Preview synchronization (postMessage, BroadcastChannel)
- Content blocks on storefront

**Key Files:**
- `src/lib/branding/*` - Types, adapters, editor hook
- `src/hooks/useBrandingDraft.ts` - Draft/publish state management
- `src/contexts/PreviewBrandingContext.tsx` - Context provider
- `src/components/admin/Branding*.tsx` - Admin UI (6+ components)
- `src/components/admin/BannerEditor.tsx` - Hero banner editing

**Data Flow:**
```
Admin Panel → useBrandingDraft → Supabase (branding_drafts)
                    ↓ publish
           Supabase (tenants.settings.branding.published)
                    ↓
           useShopSettings → PreviewBrandingProvider → Shop Components
```

**Can Import From:**
- `tenants` table (settings, branding)
- Product display settings

**MUST NOT:**
- Modify pricing calculations
- Touch designer export or canvas
- Change POD systems

---

### POD v1 & POD v2 (COMPLETELY ISOLATED)

**CRITICAL: These systems must NEVER share code or data.**

**POD v1 (Legacy):**
- Files: `src/lib/pod/*`
- Tables: `pod_*` (pod_orders, pod_products, etc.)
- Pages: `src/pages/admin/PodAdmin.tsx`, `PodKatalog.tsx`

**POD v2 (Current):**
- Files: `src/lib/pod2/*`
- Tables: `pod2_*` (pod2_orders, pod2_products, etc.)
- Pages: `src/pages/admin/Pod2Admin.tsx`, `Pod2Katalog.tsx`
- Edge Functions: `supabase/functions/pod2-*`

**Rules:**
- POD v2 code NEVER imports from `lib/pod/`
- POD v1 code NEVER imports from `lib/pod2/`
- Database queries use correct prefix (`pod_` vs `pod2_`)
- No shared utility functions between versions

---

### Admin Domain

**Description:** Management UI that spans multiple domains.

**Key Directories:**
- `src/components/admin/` - 60+ admin components
- `src/pages/Admin.tsx` - Admin router
- `src/pages/admin/*` - Admin sub-pages

**Subdomain Organization:**
- Product config: `ProductPriceManager`, `ProductAttributeBuilder`, `ProductCreator`
- Branding: `BrandingEditorV2`, `BrandingPreview`, `BrandingSettings`
- Pricing: `MachinePricingManager`, `PriceListTemplateBuilder`, `SmartPriceGenerator`
- POD: `Pod2Admin`, `Pod2Katalog`
- Shared: `AdminHeader`, `AdminSidebar`, `Dashboard`

**When Modifying Admin Components:**
- Check which domain the component belongs to
- Follow that domain's boundary rules
- Admin UI changes should not affect domain logic

---

## Cross-Domain Communication

Domains communicate through **shared data models**, not direct imports:

| Shared Resource | Used By | Owned By |
|-----------------|---------|----------|
| `products` table | All | Product Config (Admin) |
| `pricing_structure` column | Pricing, Designer (read-only) | Pricing |
| `tenants.settings.branding` | Branding, Shop | Branding |
| Product dimensions | Designer, Pricing | Product Config |

**Pattern:** Each domain queries shared tables but owns its own logic files.

---

## Making Cross-Domain Changes

If you need to make changes that span multiple domains:

1. **Identify all affected domains** using this document
2. **Discuss with user** before proceeding
3. **Make changes in isolation** - complete one domain before moving to the next
4. **Test each domain independently** before integration testing

---

## Quick Reference: File → Domain Mapping

| File Pattern | Domain |
|--------------|--------|
| `components/designer/*` | Designer |
| `lib/designer/*` | Designer |
| `utils/preflightChecks.ts` | Designer |
| `lib/pricing/*` | Pricing |
| `utils/productPricing.ts` | Pricing |
| `components/product-price-page/*` | Pricing |
| `lib/branding/*` | Branding |
| `hooks/useBrandingDraft.ts` | Branding |
| `contexts/PreviewBrandingContext.tsx` | Branding |
| `lib/pod/*` | POD v1 (ISOLATED) |
| `lib/pod2/*` | POD v2 (ISOLATED) |
| `components/admin/*` | Admin (check subdomain) |
