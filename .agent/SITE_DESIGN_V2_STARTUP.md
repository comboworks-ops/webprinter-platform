# Site Design V2 Startup

Last updated: 2026-03-17

## Purpose

This file is the restart context for the `Site Design V2` work at `/admin/site-design-v2`.

The goal is a preview-driven site editor where clicking a live element opens the exact matching control, without relying on broad side-panel hunting or hidden overlapping color ownership.

## Current Status

- `Site Design V2` is a safe fork from the old branding editor.
- Existing editor remains on `/admin/branding-v2`.
- New work area is `/admin/site-design-v2`.
- The preview is already the primary selector surface in edit mode.

## What Is Working

- Preview click targeting exists for:
  - logo
  - header/menu
  - banner
  - content blocks
  - front-page product areas
  - product-page pricing and order buttons
  - footer
  - shared typography targets
  - shared color targets
- Header/menu editor is split into smaller cards.
- Dropdown settings already include:
  - large image size
  - compact image size
  - image radius
  - panel corner radius
  - meta text size/color
  - panel transparency slider
- Footer now supports focused sub-targets:
  - layout
  - content
  - links
  - social
- Content pages now emit clickable targets for shared typography/color editing:
  - `Grafisk vejledning`
  - `Kontakt`
  - `Om os`
  - `Vilkår`
  - privacy/cookie preview pages
  - template download section
- Product cards and product page now expose more clickable targets for:
  - product images
  - title/body text
  - price text

## Key Files

- Editor shell:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/admin/SiteDesignEditorV2.tsx`
- Preview routing and live click surface:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/pages/PreviewShop.tsx`
- Target mapping:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/lib/siteDesignTargets.ts`
- Header/menu editor:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/admin/HeaderSection.tsx`
- Footer editor:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/admin/FooterSection.tsx`
- Storefront tagged surfaces:
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/Header.tsx`
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/Footer.tsx`
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/HeroSlider.tsx`
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/ProductGrid.tsx`
  - `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/src/components/content/ProductPriceContent.tsx`

## Important UX Rule

The correct direction is:

1. One visible element should map to one primary owner.
2. Section defaults should only be fallbacks.
3. Global colors should not silently override section-specific styling.

This ownership model is only partially implemented. The current work improves click coverage and editor focus, but not every element is fully isolated yet.

## Verified In This Session

- `npm run build` passes.
- Browser checks confirmed live targets on:
  - footer text/links/social
  - `Grafisk vejledning`
  - `Kontakt`
  - product page heading/body/image/pricing/button
- Fresh reloads are sometimes necessary because old Vite/HMR tabs can show stale runtime state.

## Known Gaps

- Not every side-panel tool is connected yet.
- Some areas still route to shared typography/colors instead of an element-specific field.
- Product assets/icons section is only partially integrated into clickable preview targeting.
- Banner/products/product-page still need deeper sub-target coverage if the goal is truly full element-level editing.
- The broader ownership-map cleanup is not complete yet.

## Recommended Next Steps

1. Continue wiring every remaining visible control from the side panel to a preview target.
2. Split remaining large sections into smaller focused cards where needed.
3. Add more element-specific ownership for text, images, buttons, and page-level content sections.
4. Only after ownership is stable, consider reducing the side panel further or moving to a floating inspector.

## Do Not Regress

- Do not touch pricing logic.
- Do not touch POD v1 or POD v2 logic unless explicitly asked.
- Keep changes additive.
- Keep `Site Design V2` isolated from `/admin/branding-v2` unless intentionally promoting shared improvements.
