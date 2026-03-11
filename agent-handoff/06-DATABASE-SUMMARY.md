# Database Summary

This is a practical summary, not a full schema dump.

## Core Tables

### Tenancy / Identity

- `tenants`
- `user_roles`
- `profiles`

Purpose:

- tenant isolation
- role resolution
- domain-based storefront/admin context

### Catalog / Products

- `products`
- `product_categories`
- `product_overviews`
- related product metadata fields inside `products.technical_specs`

Purpose:

- storefront-visible products
- admin product management
- tenant-scoped product data

### Pricing

- `generic_product_prices`
- other pricing-related product structures in `products.pricing_structure`
- MPA-related pricing tables and support data

Purpose:

- published storefront price reads
- matrix rendering
- configuration-specific pricing

### Branding / Site Designer

- tenant branding data is primarily stored in tenant settings / branding structures
- draft vs published branding is managed through branding state logic

Purpose:

- draft / preview / publish for storefront design

### Designer

- `designer_saved_designs`
- `designer_templates`
- design library and related storage-backed resources

Purpose:

- saved customer/admin designs
- reusable design templates
- design assets

### Sites / Facade Storefronts

- no separate site product database yet
- current site state is driven by:
  - tenant `settings.site_frontends`
  - product `technical_specs.site_frontends`

Purpose:

- site package activation
- product-to-site mapping
- future facade scaling

### POD

- POD v1 and POD v2 have separate systems and must remain separated

Purpose:

- external print-on-demand integration
- catalog import and fulfillment flows

## Important Notes

- do not assume every derived field is a real DB column
- example: subdomain is often inferred in runtime, not stored directly as `tenants.subdomain`
- pricing is operationally sensitive and should be treated as protected logic
- `technical_specs` is a major extension surface and is used by multiple domains

## Best Practice For Agents

- inspect actual queries before assuming schema
- prefer additive reads
- do not change pricing schemas or tenant scoping casually
