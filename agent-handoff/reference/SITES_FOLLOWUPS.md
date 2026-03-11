# Sites Follow-ups

This file tracks future `Sites` architecture work that should not be lost in chat history.

## 1. Shared WebPrinter Backend For Sites

### Domain

- Sites
- Product catalog / pricing integration
- Future scale architecture

### Status

- Logged for later
- Do not implement yet

### Request

Make `Sites` work as lightweight storefronts/facades on top of the existing WebPrinter backend, so products, pricing, calculation logic, and product families can be attached to each site in a controlled way.

The intent is that a site package should eventually be able to use the existing backend system for:

- products
- pricing
- calculation logic
- product families such as:
  - photo
  - posters
  - other standard WebPrinter product groups

### Intended Model

- WebPrinter remains the core backend and source of truth
- each `Site` becomes a frontend layer/facade connected to that backend
- products can later be attached to a site package or shop in a controlled mapping flow
- pricing and calculation should come from the existing product/pricing backend rather than being duplicated per site
- launching a new site should become operationally simple once mappings are in place

### Why This Matters

The long-term goal is not just previewing isolated site packages.

The goal is:

- one backend
- many sites/facades
- controlled product assignment
- shared pricing engine
- scalable site rollout without duplicating product logic

### Not In Scope Yet

- full site-to-product family assignment UI
- full category/family rollout flow
- mass product package templates by site
- automated DNS/domain provisioning
- a separate site-specific pricing engine

### Future Requirements

- a site should be able to attach backend-driven product families in stages
- sites should be able to use existing WebPrinter product calculations directly
- site/frontend selection should stay separate from pricing ownership
- site rollout should scale without copying all pricing logic into each site
- a product should be mappable to:
  - normal storefront
  - one or more sites
  - future product-family bundles for sites

### Acceptance Criteria For Later

- a site can expose selected backend product families without re-creating their pricing logic
- site packages can consume the same pricing/calculation backend as WebPrinter
- product assignment to a site is explicit and manageable from admin
- launching a new site does not require duplicating backend pricing data
- the system supports scaling multiple sites from the same backend foundation

### Notes

- current related admin surface: `src/pages/admin/SitesAdmin.tsx`
- current product-to-site mapping helpers: `src/lib/sites/productSiteFrontends.ts`
- current live site handoff: `src/pages/Shop.tsx`
- current site runtime: `src/components/sites/SitePackagePreview.tsx`
