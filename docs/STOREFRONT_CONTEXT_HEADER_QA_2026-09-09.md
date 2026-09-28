# Storefront selection and header — 9 September 2026

The local root preview had selected Salgsmapper while displaying its saved
`webprinter demo` logo text. A read-only database check confirmed two distinct
catalogs: Salgsmapper (`7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba`) has 7 published
products; the master demo (`00000000-0000-0000-0000-000000000000`, domain
`demo.webprinter.dk`) has 20. Both tenants currently save `webprinter demo` in
their published and draft header logo text. This task changes local source;
it does not edit either tenant's saved branding or catalog.

## Implementation

- An explicit localhost demo selection can now replace the previously pinned
  tenant. Bare-root navigation retains the selected shop.
- Cancelled queries and late responses from a previous selection cannot replace
  the current pin, even when the previous query still has an observer.
- Legacy `tenant_subdomain` links reuse the account flow's validated domain
  mapping and the existing domain lookup; invalid or unavailable shops fail.
- Settings queries distinguish storefront/admin/preview behavior and local
  tenant pins. Missing explicit shops fail without selecting a different shop;
  transport fallback can reuse only a matching cached tenant.
- Catalog visibility requires resolved settings and a matching tenant/site
  context, preventing the previous shop's cards from remaining visible while
  a different context loads.
- The storefront header retains its complete navigation down to 640px when
  measured content fits. Below the single-row fit threshold, the navigation
  occupies a second unwrapped row. Below 640px, or for content that cannot fit
  either row, the compact menu remains available.
- Auth uses its actual width instead of a 220px reservation. The persistent
  search field opens as the existing popup below 1440px. Other header consumers
  retain their existing compact policy; tenant colors, fonts, menu alignment
  and selected Search & Discover preset remain intact.

## Browser evidence

Tested the real local app with backend reads at `http://127.0.0.1:8110/`.
The listener was verified against this checkout. No synthetic data was used
for these browser checks.

| Viewport width | Current demo header | Height |
| --- | --- | --- |
| 1440, 1439, 1280, 1235, 1024 | Full navigation in one row | 72px |
| 980, 960, 950, 768, 640 | Full navigation in two rows | 124px |
| 639, 390, 320 | Compact phone menu | 72px |

Resizing back upward retained the expected modes. No horizontal page overflow
or visible group collisions occurred. All five navigation labels remained
on single lines. These widths describe the current tenant settings; other
fonts, logo sizes or longer labels are still measured rather than forced to fit.

- Tablet search returned the two demo flyer products without changing header
  mode; Escape closed search.
- Search & Discover opened with demo categories and products. Escape closed
  the dropdown and returned focus to its Products button.
- The phone menu contained all primary destinations, product discovery,
  language options and login. Escape closed it and returned focus to the toggle.
- Explicit demo selection, Home navigation, and fresh bare-root load retained
  demo categories. The product overview rendered 20 unique demo product URLs.
- Explicit Salgsmapper selection and fresh bare-root load retained its
  Salgsmapper/Tryksager categories and Salgsmapper page title.
- Restored the real demo at the bare root URL and reset the viewport override.
  Final natural viewport: 1235 × 829, desktop header, no horizontal overflow,
  no browser console errors on the fresh final load.

Evidence is in `output/qa/storefront-header-2026-09-09/`: desktop/tablet/phone
screenshots, width measurements, tenant verification and final browser state.
The screenshots contain public storefront content only.

## Verification and limits

All 34 focused header/context/site-scoping/account tests and the production
Vite build pass. The asynchronous response-race and invalid-subdomain checks
execute the actual settings query against simulated browser storage and backend
responses; they are distinct from the real-backend browser checks above.
The full repository TypeScript check still has existing diagnostics; this is
not a claim of whole-repository type cleanliness. Header lint matches its
pre-edit baseline; the fit helper/hook/tests have no lint errors.

React hot reload briefly retained incompatible hook state while hooks were
edited. Fresh navigation resolved this; final fresh browser loads are clean.
No deployment, authenticated customer journey, live branding save, product
write, pricing change, POD change or physical-device check was performed.

To review the two shops explicitly on localhost, use `/shop?tenantId=` followed
by the corresponding ID above. Salgsmapper's saved logo text remains a separate
published-site correction awaiting the user's decision.
