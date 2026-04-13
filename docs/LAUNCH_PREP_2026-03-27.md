# Launch Prep - 2026-03-27

This document resets the project back to launch preparation after the admin redesign detour.

## Scope

Focus on launching the existing system safely.

Do not:
- change core pricing logic
- change POD v1 logic
- change POD v2 pricing/import rules outside the documented safeguards
- change protected designer scaling/proofing code without explicit review

## Governing Docs Reviewed

1. `POD2_README.md`
2. `AI_CONTINUITY.md`
3. `SYSTEM_OVERVIEW.md`
4. `.agent/HANDOVER.md`
5. `README.md`
6. `docs/SITES_FOLLOWUPS.md`

## Confirmed Technical Baseline

- Frontend build passes with `npm run build`
- Supabase project: `printmaker-dev` (`ziattmsmiirfweiuunfo`)
- No Supabase branches currently exist
- Site package launch flow exists in `src/pages/admin/SitesAdmin.tsx`
- Storefront catalog and product detail APIs only expose `is_published = true` products

## Two Different Launch Tracks

This repo currently supports two different launch questions:

### 1. Core WebPrinter storefront launch

This means launching the main WebPrinter shop experience itself:
- branding
- published products
- checkout
- order flow
- email flow
- admin operations

### 2. `Sites` package launch

This means launching one of the facade site packages on top of the shared backend:
- `banner-builder-pro`
- `print-pop`
- `tee-design-hub`
- `print-playground`
- other entries in `src/lib/sites/sitePackages.ts`

The earlier assessment mixed these two tracks together. They need to be treated separately.

## Current Launch State

### Master tenant

- Tenant: `00000000-0000-0000-0000-000000000000`
- Name: `weprinter`
- Domain: `demo.webprinter.dk`

### Site frontend state

Current installed/active site frontend in tenant settings:
- `activeSiteId = banner-builder-pro`
- `installedSiteIds = [banner-builder-pro]`

This means only one `Sites` package is currently active/installed on the master tenant.
The other site packages defined in `src/lib/sites/sitePackages.ts` are not yet installed or mapped into the current tenant setup.

### Product state

For master tenant:
- total products: `158`
- published products: `8`
- site-mapped products: `6`
- published site-mapped products: `0`
- unpublished site-mapped products: `6`
- published non-site core products: `8`

Interpretation:
- the core WebPrinter storefront does have published products
- the active `Sites` package does not yet have any published mapped products

### Template state

- master tenant designer templates: `118`

### Orders state

- orders exist, but current sample count is not useful for launch readiness by itself

## Hard Launch Blockers

### A. Blockers for `Sites` package launch

#### 1. Active site package has zero published mapped products

The active site frontend (`banner-builder-pro`) has 6 mapped products, but all 6 are unpublished.

Because `catalog-read` filters on `is_published = true`, the site package cannot surface these products live until they are published.

Affected mapped products currently include:
- `pvc-banner`
- `mesh-banner`
- `textile-banner`
- `window-foil`
- `cutout-letters`
- `poster-large`

### B. Blockers for core WebPrinter launch

#### 2. Published contact settings are incomplete

In the published branding/contact settings for the master tenant:
- `formRecipientEmail = ''`
- `contactInfo.email = ''`
- `contactInfo.phone = ''`

This means the contact page and lead-routing setup are not launch-ready.

#### 3. Order emails still use Resend development sender

`supabase/functions/send-order-email/index.ts` currently sends from:
- `onboarding@resend.dev`

The code comment explicitly says this is a development sender until a verified production domain is configured.

This should be treated as a production-readiness blocker for customer email trust and deliverability.

## Important Warnings Before Launch

### Security advisors

Supabase security advisors currently report:
- 2 `ERROR`s for security-definer views:
  - `public.pod_catalog_public`
  - `public.pod2_catalog_public`
- multiple `WARN`s for mutable `search_path`
- leaked password protection disabled in Supabase Auth

Not every warning needs to block launch, but the errors should be reviewed before go-live.

### Lint baseline

A targeted lint run on the site launch surface fails in:
- `src/pages/admin/SitesAdmin.tsx`

Current failures are `@typescript-eslint/no-explicit-any` errors.

Build passes, but lint is not clean.

### SEO baseline is minimal

- `platform_seo_settings` exists and is configured for `webprinter.dk`
- `platform_seo_pages` count is currently `0`

This is not a launch blocker if the goal is functional go-live first, but it means structured page-level SEO work is still largely unset.

### Branding publish flow needs verification

`AI_CONTINUITY.md` explicitly notes that the draft -> published workflow exists but needs verification.

Do not assume the branding draft is what live visitors will see without testing published mode.

## Payments Status

- `VITE_STRIPE_PUBLISHABLE_KEY` is present locally
- `stripe-create-payment-intent` supports platform mode if no tenant Stripe Connect row exists
- master tenant currently has no `tenant_payment_settings` row

This is not automatically a blocker for the master storefront, but checkout must be verified end-to-end using the platform Stripe path.

## Recommended Launch Sequence

### Phase 1 - Decide the target

1. Decide whether the immediate goal is:
   - core WebPrinter launch
   - `banner-builder-pro` launch
   - both

### Phase 2 - Core WebPrinter storefront readiness

1. Fill published contact settings:
   - recipient email
   - customer-facing email
   - phone
   - address/CVR if required
2. Verify navigation links, footer links, and contact form behavior on the published storefront
3. Verify the 8 published core products render correctly

### Phase 3 - `Sites` package readiness

1. Publish the 6 site-mapped `banner-builder-pro` products
2. Verify each mapped product renders correctly on the site package storefront
3. Install/map any additional site package only when its product set exists

### Phase 4 - Operational readiness

1. Verify checkout end-to-end on the live tenant/domain path
2. Verify Stripe payment intent creation in platform mode
3. Verify order creation stores correct tenant context
4. Verify order confirmation email sends successfully
5. Replace Resend development sender with a verified production sender/domain

### Phase 5 - Admin and platform checks

1. Review Supabase security advisor errors and decide which must be fixed before launch
2. Clean obvious lint issues in launch/admin surfaces
3. Verify branding draft/published behavior in preview and live storefront
4. Verify file upload / preflight / designer export flow for at least one standard product and one site-package product

### Phase 6 - Optional but recommended

1. Add page-level SEO entries
2. Review site package copy and hero content
3. Verify analytics / search-console integrations if intended for launch
4. Re-check Canva and template library only after storefront launch path is stable

## Recommended Immediate Next Task

The immediate clarification is:

- the earlier blocker about unpublished mapped products applies to the active `Sites` package (`banner-builder-pro`)
- it does not by itself mean the core WebPrinter storefront is unlaunchable

If the target is the core WebPrinter storefront first, the next task should be:

1. populate published contact settings
2. verify the published core product list and product pages
3. run one full checkout and order email test on `demo.webprinter.dk`

If the target is `banner-builder-pro`, then the next task should be:

1. publish the 6 mapped `banner-builder-pro` products
2. verify the site package storefront
3. then run checkout through the shared WebPrinter flow
