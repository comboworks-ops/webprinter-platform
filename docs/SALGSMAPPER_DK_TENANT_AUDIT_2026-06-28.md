# salgsmapper.dk Tenant Audit - 2026-06-28

Scope: tenant/storefront check for `salgsmapper.dk` on local dev, followed by
a narrow no-pricing/no-POD hardening and design polish pass.

Local preview:
- `http://127.0.0.1:8082/local-tenant?force_domain=www.salgsmapper.dk`
- Main tested product:
  `http://127.0.0.1:8082/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk`

## Tenant Resolution

- Tenant resolves by domain:
  - tenant id: `7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba`
  - name: `salgsmapper.dk`
  - domain stored as `salgsmapper.dk`
  - platform-owned tenant: yes
- Settings include `branding`, `company`, `notifications`, and `regional`.
- Branding has `draft`, `published`, `history`, and `savedDesigns`.
- No `ai_seo` setting found in tenant settings during this pass.

## Product Inventory

Tenant-owned product count:
- 7 total
- 4 published

Published tenant products:
- `standard-sales-mapper-kopi-2`
  - name: `Standard Salgsmapper`
  - pricing: `matrix_layout_v1`
  - generic price rows: 580
- `salgsmapper-med-kachering`
  - name: `Salgsmapper med laminering`
  - pricing: `matrix_layout_v1`
  - generic price rows: 670
- `salgsmapper-med-uv-lak`
  - name: `Salgsmapper med UV-Lak`
  - pricing: `matrix_layout_v1`
  - generic price rows: 268
- `salgsmapper-med-uv-spotlak`
  - name: `Salgsmapper med UV spotlak`
  - pricing: `matrix_layout_v1`
  - generic price rows: 268

Unpublished tenant products:
- `blokke`
- `blokke-2`
- `visit-card`

Source ownership:
- The checked salgsmapper.dk products are normal Matrix Layout V1 products.
- No POD v2 catalog id was found on this tenant slice.
- No Pixart/storformat source flag was found on this tenant slice.

## Storefront Check

Homepage route:
- Resolves as salgsmapper.dk, not fallback.
- Product link on homepage points to
  `/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk`.
- Visible hero/copy is sales-folder oriented, but some generic Webprinter copy
  still appears, including broad tryksager/storformat section headings.

Product page:
- `Standard Salgsmapper` loads with Matrix Layout V1 controls.
- Visible controls include format, ryg, print side, price matrix, `Download tilbud`,
  `Design online`, and `Bestil nu!`.
- GStack/SuperPowers visual pass was run locally on the product page after the
  hardening changes.
- Verified locally with Chromium at `762x837`:
  - page title: `Standard salgsmapper med tryk | Billige mapper`
  - h1: `Standard Salgsmapper`
  - no browser console errors
  - header logo and mobile menu measure `44px` high
  - product template download button measures `44px` high
  - footer internal links preserve `force_domain=www.salgsmapper.dk`
- Screenshot artifacts:
  - `~/.gstack/projects/printmaker-web-craft-main/designs/design-audit-20260628/screenshots/salgsmapper-product-current.png`
  - `~/.gstack/projects/printmaker-web-craft-main/designs/design-audit-20260628/screenshots/salgsmapper-product-after-gstack-polish.png`
  - `tmp/salgsmapper-audit-20260630/home-category-seo-content.png`
  - `tmp/salgsmapper-audit-20260630/home-mobile-category-seo-content.png`

## 2026-06-30 Category-Led Content Pass

Applied the same content/SEO direction used for onlinetryksager.dk, scoped to salgsmapper.dk:

- Homepage SEO title updated to `Salgsmapper med tryk | Standard, laminering og UV-lak`.
- Homepage meta description now focuses on salgsmapper, standardmapper, laminering, UV-lak and UV spotlak.
- Hero overlay title changed from generic `Billige tryksager online` to `Salgsmapper med tryk`.
- Hero overlay subtitle changed to `Mapper til tilbud, præsentationer og salgsmateriale`.
- Homepage SEO content now has four focused sections:
  - Standard salgsmapper
  - Salgsmapper med laminering
  - Salgsmapper med UV-lak
  - Salgsmapper med UV spotlak
- Product card label `Salgsmapper med Kachering` changed to `Salgsmapper med laminering`.
- Product SEO rows added/updated for:
  - `/produkt/salgsmapper-med-kachering`
  - `/produkt/salgsmapper-med-uv-lak`
  - `/produkt/salgsmapper-med-uv-spotlak`
  - `/produkt/standard-sales-mapper-kopi-2`

Chromium validation on `http://127.0.0.1:8083/?force_domain=www.salgsmapper.dk`:

- Desktop confirms category-led homepage sections render.
- Mobile confirms category-led homepage sections render.
- Mobile width at 390px has no horizontal overflow.
- No relevant sub-44px touch targets found on mobile.
- Product page `/produkt/salgsmapper-med-kachering?force_domain=www.salgsmapper.dk` renders title/meta for laminering.

## Issues Found

1. Generic SEO title on tenant pages
   - Local salgsmapper.dk homepage and product page both reported:
     `Webprinter.dk - Danmarks billigste tryksager ...`
   - Status: product page fixed locally for rendered product SEO by forcing the
     product page SEO component to render even under tenant-scoped SEO.
   - Status 2026-06-30: homepage and sampled product metadata now render
     tenant-specific salgsmapper copy.

2. Legacy `/produkt/salgsmapper` exposes the unpublished master product
   - Tenant catalog does not contain slug `salgsmapper`.
   - The master product with slug `salgsmapper` exists but is unpublished and has
     zero generic price rows.
   - Direct URL still loads:
     `/produkt/salgsmapper?force_domain=www.salgsmapper.dk`
   - Recommendation: harden product-detail fallback so unpublished master
     products are not served to tenant storefronts, or add an explicit redirect
     from `/produkt/salgsmapper` to the canonical tenant product.

3. Canonical product slug is unclear
   - The tenant's main product slug is `standard-sales-mapper-kopi-2`.
   - For customers and SEO, a cleaner canonical slug such as
     `salgsmapper` or `standard-salgsmapper` would be better.
   - Recommendation: choose one canonical slug strategy before adding more SEO
     and content work.

4. Homepage content is not fully tenant-specific
   - The page contains sales-folder content, but also generic print-shop sections.
   - Status 2026-06-30: homepage SEO content was replaced with focused
     salgsmapper copy for standardmapper, laminering, UV-lak and UV spotlak.

5. Footer/context links should be checked
   - Header links preserved `force_domain`.
   - Some footer links appeared without tenant query context on localhost.
   - Status: fixed locally. Footer internal links now use the storefront tenant
     context helper, and footer/social links meet `44px` touch target sizing.

6. Cookie banner touch targets are still smaller than 44px
   - Headless check found `Accepter alle`, `Kun nødvendige`, and `Tilpas` at
     `36px` high.
   - Status 2026-06-30: fixed in shared consent UI as part of the
     salgsmapper/onlinetryksager touch-target pass.

## Recommended Next Step

Do a small salgsmapper.dk hardening pass:

1. Prevent unpublished master fallback products from rendering on tenant product
   routes. Implemented locally in code on 2026-06-28:
   - `src/pages/ProductPrice.tsx` now rejects unpublished/cross-tenant product
     detail results and does not revive stale master cache after an
     authoritative not-found result.
   - `supabase/functions/product-detail-read/index.ts` now requires published
     tenant/master products in the source file. Deploy the edge function before
     relying on this server-side behavior in production.
2. Pick and wire the canonical salgsmapper product route.
3. Run the golden path:
   homepage -> product -> price selection -> designer/upload -> checkout.
4. Document the verified route and any remaining tenant content work.

This keeps pricing untouched and focuses only on tenant routing, content, and
storefront correctness.
