# Webprinter Platform Design Audit

Date: 2026-07-01
URL: http://127.0.0.1:8083/?force_domain=webprinter.dk
Scope: Webprinter main platform homepage

## Summary

The platform homepage is functional and stable, but before this pass it read too much like a generic SaaS landing page. The main issues were weak print-specific positioning, decorative background blobs that did not add meaning, a large product strip that dominated mobile, and an unfinished trust section made from grey placeholder blocks.

## Fixes Applied

- Tightened hero copy so the first viewport says what Webprinter does: white-label printshop, product catalog, online designer, price calculation, and customer portal.
- Removed decorative blurred background blobs from the hero.
- Reduced product-strip sizing and vertical spacing so it supports the hero instead of overpowering it.
- Replaced the placeholder trust-logo skeletons with concrete proof points:
  - 15+ years online print/product-flow experience
  - One shop for catalog, pricing, design, and order status
  - B2B-ready customer portal and tenant management
- Replaced the generic feature-card grid with a print-specific workflow map:
  - white-label webshop
  - product selection and pricing
  - designer and templates
  - file/preflight handling
  - order and production flow
  - B2B customer portal
- Added a compact capability row for admin control, tenant structure, and print-focused design logic.

## Verification

- Desktop screenshot checked at 1440px.
- Mobile screenshot checked at 390px.
- No horizontal overflow on desktop or mobile.
- Browser console errors: none.
- Production build passed after the first cleanup pass.
- Workflow update passed desktop/mobile Playwright smoke testing with no console errors and no horizontal overflow.
- Production build passed after the workflow update.

## Remaining Recommendations

- Add real customer logos or remove the proof section entirely until credible logos/testimonials exist.
- Consider a future hero with a real product/admin/designer composite image instead of relying only on the product carousel.
- Add a small platform-specific mobile menu label beside the hamburger if user testing shows the icon is too quiet.
