# Shop Modules Access Control

Last updated: 2026-02-10

This system adds per-tenant module access and on/off visibility without changing pricing logic.

## Data Model

- Table: `public.tenant_module_access`
- Primary key: `(tenant_id, module_id)`
- Core fields:
- `has_access` (tenant has rights to use module)
- `is_enabled` (module is switched on for tenant frontend/admin)
- `access_source` (`included` | `gifted` | `purchased` | `manual`)

Defaults:

- Free modules default to access + enabled if no row exists.
- Premium modules default to no access if no row exists.

## Module IDs

- `print-designer`
- `site-design`
- `machine-pricing`
- `print-on-demand`
- `company-hub`
- `social-hub`

## Admin Behavior

- `Admin > Moduler` now persists module state per tenant.
- In master context:
- Select target tenant
- Gift premium modules
- Mark premium modules as purchased
- Enable/disable each module
- In tenant context:
- Toggle enabled/disabled for modules the tenant has access to.

## Enforcement Points

- Admin sidebar hides disabled modules.
- Admin route guard blocks direct URL access for controlled modules.
- CompanyHub frontend route shows module-disabled message when off.
- "Design online" button on product page is hidden when `print-designer` is off.

## Rollout

1. Run migration for `tenant_module_access`.
2. Open `Admin > Moduler`.
3. For each tenant:
- grant premium access as `gifted`/`purchased` where needed
- switch modules on/off.
