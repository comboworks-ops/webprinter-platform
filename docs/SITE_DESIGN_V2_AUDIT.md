# Site Design V2 Audit

## Purpose

This audit answers one specific question:

- What did Site Design V2 actually have?
- Which parts are still present in the codebase?
- Which parts are already active in the storefront runtime?
- Which parts exist only partially and would need recovery work before reuse?

This document is an audit only. It does not recommend replacing the current site designer. The safe use of this audit is to recover V2 behavior additively into the existing site-designer flow.

## Scope

Reviewed sources:

- `docs/SITE_DESIGN_V2_STATUS.md`
- `AI_CONTINUITY.md`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/components/admin/TenantBrandingSettingsV2.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/admin/BrandingPreviewFrame.tsx`
- `src/components/admin/ThemeSelector.tsx`
- `src/lib/themes/theme-context.tsx`
- `src/themes/classic/index.ts`
- `src/themes/glassmorphism/index.ts`
- `src/pages/Shop.tsx`
- `src/pages/PreviewShop.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/lib/branding/types.ts`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/StorformatConfigurator.tsx`
- `src/components/Header.tsx`
- `src/components/ProductGrid.tsx`
- `src/lib/sites/activeSiteBranding.ts`

## Executive Finding

Site Design V2 was real. It was not just a mockup or a memory artifact.

The codebase still contains a real V2 editor route, a real preview frame, a real page selector, a real theme selector, a real theme registry, and several advanced runtime-facing controls for:

- homepage content blocks
- featured products
- side panel banners/products
- icon packs
- product-page matrix and picture-button behavior

The main gap is not the editor UI. The main gap is runtime wiring:

- the normal storefront still renders classic components directly
- preview mirrors the classic storefront directly
- theme runtime exists, but is not the active rendering path for normal storefront and preview
- per-page page-switching exists in the editor and preview navigation, but not as a fully separate stored per-route style override model

## Audit Result Summary

### 1. Confirmed Real And Still Present

These V2 capabilities are clearly present in the current codebase.

| Capability | Evidence | Current State |
| --- | --- | --- |
| Dedicated V2 tenant editor route | `docs/SITE_DESIGN_V2_STATUS.md`, `src/components/admin/TenantBrandingSettingsV2.tsx`, `src/components/admin/AdminSidebar.tsx` | Present |
| Dedicated master design route | `docs/SITE_DESIGN_V2_STATUS.md`, `src/components/admin/AdminSidebar.tsx` | Present |
| Visual editor shell | `src/components/admin/BrandingEditorV2.tsx` | Present |
| Preview iframe with live sync | `src/components/admin/BrandingPreviewFrame.tsx` | Present |
| Preview navigation and page switching | `src/components/admin/BrandingEditorV2.tsx`, `src/components/admin/BrandingPreviewFrame.tsx`, `src/pages/PreviewShop.tsx` | Present |
| Theme selector UI | `src/components/admin/BrandingEditorV2.tsx`, `src/components/admin/ThemeSelector.tsx` | Present |
| Theme registry and runtime context | `src/lib/themes/theme-context.tsx`, `src/themes/classic/index.ts`, `src/themes/glassmorphism/index.ts` | Present |
| Saved design / publish / history dialogs | `docs/SITE_DESIGN_V2_STATUS.md`, `src/components/admin/BrandingEditorV2.tsx` | Present |

### 2. Confirmed Real And Persisted In Branding Data

These V2 controls are not only shown in the editor. They are persisted in the branding draft model and normalized into branding data.

| Capability | Evidence | Current State |
| --- | --- | --- |
| `themeId` and `themeSettings` | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Homepage content blocks | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Homepage products section config | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Featured product config | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Side panel config and items | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Product-page matrix config | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Picture-button hover/selected/outline/zoom config | `src/hooks/useBrandingDraft.ts`, `src/lib/branding/types.ts` | Persisted |
| Selected icon pack | `src/hooks/useBrandingDraft.ts` | Persisted |

### 3. Confirmed Real And Already Consumed By Runtime

These V2-era data structures are already used by active storefront or preview rendering.

| Capability | Evidence | Current State |
| --- | --- | --- |
| Homepage featured product section | `src/pages/Shop.tsx`, `src/pages/PreviewShop.tsx` | Active |
| Homepage product section layout and button config | `src/pages/Shop.tsx`, `src/pages/PreviewShop.tsx` | Active |
| Homepage content blocks | `src/pages/Shop.tsx`, `src/pages/PreviewShop.tsx` | Active |
| Product-page matrix picture-button behavior | `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`, `src/components/product-price-page/StorformatConfigurator.tsx` | Active |
| Icon pack usage in storefront navigation and grid | `src/components/Header.tsx`, `src/components/ProductGrid.tsx` | Active |

This is the most important recovery point: several V2 concepts are already in production-facing runtime. They are not lost. They are active now.

## Detailed Feature Findings

### A. Page Selector And Multi-Page Preview

This existed.

Evidence:

- `src/components/admin/BrandingEditorV2.tsx` defines `PREVIEW_PAGE_LINKS`
- V2 keeps `currentPreviewPage`
- V2 limits available edit sections depending on the current preview page
- `src/pages/PreviewShop.tsx` supports virtual navigation for:
  - homepage
  - products
  - product detail
  - contact
  - about
  - graphic guide
  - terms/privacy/cookies pages
- `src/components/admin/BrandingPreviewFrame.tsx` handles `PREVIEW_NAVIGATION`, `NAVIGATE_TO`, and `NAVIGATE_TO_FIRST_PRODUCT`

What this means:

- V2 did have real page navigation in the editor
- it was not only a single homepage editor
- the page selector concept is real and still in code

### B. Theme System

This existed, but is only partially wired into the real storefront.

Evidence:

- `src/components/admin/ThemeSelector.tsx` is real
- `src/lib/themes/theme-context.tsx` provides `ThemeProvider` and `useTheme`
- `src/themes/classic/index.ts` and `src/themes/glassmorphism/index.ts` register full theme component sets
- branding draft stores `themeId` and `themeSettings`

Current limitation:

- `src/pages/Shop.tsx` imports classic components directly
- `src/pages/PreviewShop.tsx` imports classic components directly
- neither is routed through theme-driven component selection in the normal path

What this means:

- theme selection was a real V2 capability
- the theme architecture exists
- the missing piece is end-to-end storefront rendering through the theme runtime

### C. Per-Page Editing

This existed partially.

What is confirmed:

- the editor changes which sections are available depending on the selected preview page
- product-page matrix controls only appear on product preview pages
- homepage sections only appear on homepage-like preview pages

What is not confirmed:

- a full persisted page-by-page override model where each route has its own isolated style payload

What this means:

- V2 definitely had page-aware editing behavior
- V2 does not appear to have a complete per-route override storage model in the active path

### D. Product-Page Matrix Styling

This is real and active.

Evidence:

- `src/components/admin/BrandingEditorV2.tsx` exposes a `product-page-matrix` section
- `src/hooks/useBrandingDraft.ts` and `src/lib/branding/types.ts` persist the matrix picture-button settings
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx` reads `activeBranding?.productPage?.matrix?.pictureButtons`
- `src/components/product-price-page/StorformatConfigurator.tsx` reads the same config

Confirmed runtime behaviors from branding:

- hover color
- hover opacity
- selected color
- selected opacity
- outline enablement
- outline opacity
- hover zoom enablement
- hover zoom scale
- hover zoom duration

This area is already a successful example of V2-style controls being fully editor-to-runtime connected.

### E. Featured Product / Forside Produkter / Side Panel

This is real and active.

Evidence:

- `docs/SITE_DESIGN_V2_STATUS.md`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/lib/branding/types.ts`
- `src/pages/Shop.tsx`
- `src/pages/PreviewShop.tsx`

Confirmed active behaviors:

- featured product enablement
- position above or below categories
- optional hide-from-product-list behavior
- side panel configuration
- product section button/background/layout configuration

This area was not lost. It is already wired into active storefront and preview rendering.

### F. Icon Packs

This is real and active.

Evidence:

- `src/hooks/useBrandingDraft.ts` stores `selectedIconPackId`
- `src/components/Header.tsx` consumes the selected icon pack
- `src/components/ProductGrid.tsx` consumes the selected icon pack

This is another example of a V2-era control that is already runtime-active.

## What Was Only Partially Implemented

These capabilities were started or structurally present, but are not complete in the current active runtime path.

| Capability | Status | Why It Is Partial |
| --- | --- | --- |
| Theme switching on normal storefront | Partial | Theme infrastructure exists, but `Shop.tsx` still renders classic components directly |
| Theme switching on preview storefront | Partial | `PreviewShop.tsx` still mirrors classic storefront directly |
| Theme-specific extra editor sections | Partial | `ThemeSelector` supports them, but current theme definitions use `editorSections: []` |
| Full route-specific page style overrides | Partial / unverified | Page-aware editing exists, but a full per-route override persistence model is not present in the active path |
| Site-preview theme forcing in normal storefront | Partial | `src/lib/sites/activeSiteBranding.ts` shows specialized theme forcing logic, but this is not the normal tenant storefront rendering path |

## What Was Not Verified

These are the claims I could not confirm as currently implemented in the active code path.

| Capability | Audit Result |
| --- | --- |
| Fully isolated style payload per preview page | Not verified |
| Full live storefront rendering through theme runtime for all sections | Not verified |
| Rich theme-specific configuration panels for glassmorphism or other themes | Not verified |

This does not mean they never existed in some intermediate state. It means they are not clearly present and fully wired in the audited codebase now.

## Safe Recovery Classification

If V2 behavior is to be revived into the current site designer, it should be done by category.

### Safe To Reuse Now

These are already active or strongly grounded:

- preview page selector
- preview navigation messaging
- homepage content blocks
- featured product controls
- side panel controls
- product-page matrix picture-button styling
- icon-pack selection

These are the lowest-risk V2 recovery candidates because they already have working runtime consumers.

### Safe Only After Runtime Wiring

These should not be exposed more heavily until the rendering path is completed:

- theme switching for normal storefront
- theme switching for preview storefront
- theme-specific editor panels

These are not editor problems. They are runtime integration problems.

### Should Not Be Assumed Until Rebuilt Or Verified

- full per-route style override storage
- isolated page-level design payloads for every page in preview and live runtime

If these are needed, they should be treated as fresh architecture work, not as a simple “bring back old toggle” task.

## Practical Conclusion

The correct interpretation is:

1. Site Design V2 was real
2. Several advanced V2 features still exist and some are already live in runtime
3. The biggest missing piece is theme runtime wiring, not editor UI
4. The safest path is additive recovery into the current site designer
5. The unsafe path would be trying to switch the whole storefront over to “V2 mode” without first finishing the runtime contract

## Recommended Next Step

Before any implementation work, the next safe document should be a recovery inventory:

- feature
- current code evidence
- active runtime consumer
- recovery difficulty
- safe to merge now or not

That recovery inventory should then drive a staged merge plan for:

1. already-runtime-backed V2 features
2. preview-only V2 features
3. theme-runtime completion work
