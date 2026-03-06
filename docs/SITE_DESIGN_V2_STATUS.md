# Site Design V2 - Status Log

Last updated: 2026-03-05

This file documents the current, actual state of Site Design V2 in this repo.
It exists to avoid confusion between:
- features that are implemented in code,
- features that are visible in UI but not fully wired,
- features that were discussed but are not implemented.

---

## 1) Routes and editors

Current admin routes:
- `/admin/branding` -> `TenantBrandingSettings` -> `UnifiedBrandingEditor` (classic editor, V1)
- `/admin/branding-v2` -> `TenantBrandingSettingsV2` -> `BrandingEditorV2` (visual editor, V2)
- `/admin/branding-template` -> `MasterBrandingTemplate` -> `BrandingEditorV2` (master template editor, V2)

Primary files:
- `src/components/admin/UnifiedBrandingEditor.tsx`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/components/admin/TenantBrandingSettings.tsx`
- `src/components/admin/TenantBrandingSettingsV2.tsx`
- `src/components/admin/MasterBrandingTemplate.tsx`
- `src/pages/Admin.tsx`
- `src/components/admin/AdminSidebar.tsx`

---

## 2) What V2 currently supports

`BrandingEditorV2` currently includes:
- click-to-edit preview messaging (`EDIT_SECTION` handling),
- logo + favicon editing,
- header settings,
- banner (hero) editing,
- content block editing,
- footer editing,
- typography controls,
- global color controls,
- product image/icon pack section,
- advanced "Forside produkter" controls:
  - featured product card,
  - product placement and side panel options,
  - CTA styling,
  - quantity preset controls,
  - side panel banner/product rotator controls.

V2 also includes saved design and publish dialogs plus history display.

---

## 3) Theme system: current truth

Theme infrastructure exists:
- `src/lib/themes/*`
- `src/themes/classic/*`
- `src/themes/glassmorphism/*`
- `src/components/admin/ThemeSelector.tsx`

Important: as of this date, theme switching is not fully wired end-to-end in the active storefront pipeline.

Specifically:
- `Shop.tsx` and `PreviewShop.tsx` render classic components directly (`Header`, `HeroSlider`, `Footer`, etc.).
- They are not currently wrapped in a theme runtime that swaps component sets per selected `themeId`.
- Therefore, selecting a theme in admin (if exposed) will not automatically change storefront visuals everywhere.

This is the key reason "Glassmorphism" can appear as a concept but not fully affect homepage rendering.

---

## 4) Page-level styling controls: current truth

User expectation discussed:
- switch between pages (for example home/product/contact) and style each page separately,
- including product-page matrix color controls per page.

Current code state:
- global branding controls exist,
- section-level controls exist,
- explicit per-route page style override model is not fully implemented in current active V2 flow.

In other words, there is no complete, shipped per-page visual override system in the current V2 runtime.

---

## 5) Stability note

For production safety:
- treat `/admin/branding` (classic V1) as the stable path,
- treat `/admin/branding-v2` as advanced/beta until full theme and per-page wiring is complete.

Do not change pricing logic while working on Site Design V2.

---

## 6) Change log

2026-03-05:
- Created this status file to document V2 reality vs intended behavior.
- Clarified that theme infrastructure exists but storefront theme runtime is not fully wired.
- Clarified that full per-page styling controls are not currently shipped in active V2 flow.

