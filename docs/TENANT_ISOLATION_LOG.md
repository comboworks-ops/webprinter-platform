# Tenant Isolation Log

Last updated: 2026-03-11

## Purpose

This file records tenant/master separation issues so they do not get lost in chat history.

## Current Findings

### 1. Localhost master demo must preserve explicit tenant context

Problem:
- On localhost, the WebPrinter master demo is intentionally opened with:
  - `/shop?tenantId=00000000-0000-0000-0000-000000000000`
- If internal storefront links drop that query parameter, `useShopSettings()` can fall back to the pinned local tenant and show the wrong storefront branding/products.

Confirmed fix:
- Added shared helper:
  - `src/lib/storefrontTenantContext.ts`
- Applied to main internal storefront link generators:
  - `src/lib/catalog/categoryLanding.ts`
  - `src/components/HeroSlider.tsx`
  - `src/components/Header.tsx`

Important rule:
- On localhost, master demo storefront links must preserve:
  - `tenantId`
  - `tenant_id`
  - `force_domain`
  - `tenant_subdomain`

### 2. Desktop header navigation previously bypassed tenant-aware hrefs

Problem:
- Desktop menu items in `Header` visually used tenant-aware links, but the click handler still navigated to the raw href.

Confirmed fix:
- `src/components/Header.tsx`
- `handleNavClick(...)` now resolves the tenant-aware href before navigating.

### 3. Preview/header labels must be separated from tenant-leak assumptions

Verified data:
- Master tenant (`00000000-0000-0000-0000-000000000000`) currently stores these header nav labels in branding:
  - `Hjem`
  - `Produkter`
  - `Grafisk vejledning`
  - `Kontakt`
  - `Om os`

Meaning:
- If the WebPrinter preview/header shows `Hjem`, that is currently consistent with the saved master branding data.
- This is not, by itself, evidence of cross-tenant leakage.

If the desired label is `Forsider`, that is a branding/content change for the master tenant header config.

## Open Risks To Recheck

1. Test all WebPrinter demo entry paths on localhost:
   - product cards
   - hero CTA buttons
   - desktop header nav
   - header product dropdown
   - header search results

2. Verify the product page URL keeps the master tenant query:
   - `/produkt/<slug>?tenantId=00000000-0000-0000-0000-000000000000`

3. Verify preview/admin contexts never honor the local storefront pin:
   - `wp_local_storefront_tenant`

## Debug Rule

When a page appears to show the wrong tenant, separate these questions:

1. Is this a routing/context leak?
- Wrong tenant id/domain/query context

2. Is this saved branding data?
- The tenant really does have that label/logo/header config stored

Do not treat branding differences as isolation failures until tenant context is verified first.

## Residual UI Follow-up

### 4. Minor desktop auth-chip flicker during products dropdown hover

Current state:
- The main tenant-isolation issue is fixed.
- The desktop header dropdown no longer switches tenant context.
- Console noise from the related storefront errors is cleaned up.

Remaining issue:
- On the WebPrinter storefront, the desktop auth/email chip in the top-right corner can still flicker slightly while hovering the `Produkter` dropdown.
- The logo, main header bar, and tenant context stay correct.
- This is a visual compositing/painter issue, not a routing or data leak.

What has already been done:
- Moved product dropdown hover state into a local child component
- Memoized the desktop action cluster
- Raised the desktop action cluster above the dropdown panel z-layer
- Isolated the auth chip on its own paint layer

Conclusion:
- Treat this as low-priority UI polish.
- Do not block tenant-context/API work on this issue unless the flicker gets worse or starts affecting interaction.
