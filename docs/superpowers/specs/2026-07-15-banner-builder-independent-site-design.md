# Banner Builder Independent Site Design

Date: 2026-07-15
Status: Approved product direction, written specification pending final user review
Owner: Webprinter

## 1. Purpose

Webprinter can currently preview and activate connected facade packages such as
Banner Builder Pro, but those facades are compiled iframe bundles. They can use
runtime product data, yet Site Design V2 cannot edit their layout or content.

This first release turns Banner Builder Pro into an installable, independent,
platform-owned shop. The original bundle remains available as a visual reference,
while the installed live shop uses the native Webprinter storefront and therefore
supports tenant-specific Site Design V2 editing, products, domain settings, SEO,
checkout, orders, and future growth.

The first successful operator journey is:

1. A master administrator opens `Sites` and chooses Banner Builder Pro.
2. The administrator selects `Opret som selvstændigt site`.
3. Webprinter creates a draft platform-owned tenant with its own address.
4. The installer adds Banner Builder templates and copies eligible mapped products.
5. The administrator opens the new tenant in Site Design V2 and edits it.
6. The administrator previews the native storefront.
7. The site becomes publicly available only after an explicit `Gør live` action.

## 2. Approved Decisions

1. The first installed site is Banner Builder Pro.
2. The installed site is a separate `tenants` row and not another active facade
   inside the master tenant.
3. The installed site is platform-owned and centrally managed by master admins.
4. The original Banner Builder bundle remains preview-only and is not presented as
   Site Design V2-editable.
5. The live site uses Webprinter's native storefront, tenant branding, product
   catalog, checkout, designer, and order system.
6. Existing tenants and existing facade packages retain their current rendering
   behavior unless they are explicitly installed through the new workflow.
7. A newly installed site starts in draft mode and requires an explicit Go Live
   action.
8. Installation is retryable and idempotent. A partial failure is shown and repaired;
   it does not trigger an automatic tenant deletion.
9. Only ready, published, non-POD master products mapped to Banner Builder Pro are
   copied automatically.
10. POD products remain in their existing explicit POD distribution flows.
11. Core pricing logic, POD v1, and POD v2 calculations are read-only for this work.

## 3. Product Principles

1. A site package is a reusable starting template, not a permanent runtime iframe.
2. Every installed shop owns its editable configuration after installation.
3. Shared engines stay shared: checkout, orders, authentication, product pricing,
   designer, and supplier operations remain platform capabilities.
4. Tenant-owned state stays isolated: branding, domain, SEO, catalog copies, and
   publication state belong to the installed tenant.
5. Preview and publication are separate. Creating a shop must never silently make it
   live.
6. Existing product-copy functions are reused; no parallel pricing-copy mechanism is
   introduced.
7. Recovery state is understandable to an operator and never hidden only in logs.
8. Danish is the default operator language and uses correct Danish characters.

## 4. Non-Goals

This release does not:

- convert every connected facade package in one operation;
- make compiled iframe internals editable;
- synchronize future changes from the original GitHub repository into installed
  tenant branding;
- introduce a background job system or provisioning queue;
- create a second tenant, product, pricing, checkout, or order data model;
- clone unpublished, not-ready, or POD-linked products automatically;
- modify product prices, markups, formulas, or STORFORMAT calculations;
- change POD v1 or POD v2 schemas, functions, or tenant distribution rules;
- publish a domain automatically;
- create an external customer owner account for a platform-owned niche site;
- delete partially provisioned tenants automatically.

## 5. Approaches Considered

### 5.1 Browser-only creation

The admin browser could insert a tenant and then call the existing template installer.
This has the lowest implementation cost, but it depends on broad table policies and
leaves authorization and partial-state recovery spread across UI code. It is rejected.

### 5.2 Secure creation RPC plus recoverable client provisioning

A master-only database function creates the platform-owned tenant shell. A focused
client service then installs templates, applies starter branding, copies eligible
products through existing functions, and records completion or partial failure. This
is the selected approach because it gives a narrow security boundary, visible recovery,
and no new infrastructure.

### 5.3 Persistent provisioning jobs

A new table and worker could execute installation asynchronously with durable retries.
This is appropriate for large or cross-supplier installations, but it adds a new data
model and operational surface before the first Banner Builder flow proves demand. It is
deferred.

## 6. Architecture

The solution has five bounded units:

1. **Package definition**: extends the existing `SitePackage` metadata with native
   installation defaults without changing its seed-template role.
2. **Secure tenant creation**: a new SQL RPC validates master-admin authority and
   creates one platform-owned draft tenant.
3. **Provisioning service**: orchestrates template installation, starter branding,
   eligible product copying, and state updates through explicit dependencies.
4. **Master admin workflow**: adds the create/retry/result UI to `Sites`.
5. **Native storefront and launch gate**: lets installed tenants render the normal
   editable storefront while a shared route guard keeps every commerce entry point
   closed until Go Live. Legacy active facades continue to render as they do today.

```text
Sites admin
    |
    v
create_platform_site_from_package RPC
    |
    v
draft platform-owned tenant
    |
    +--> installSitePackageTemplates --> designer_templates
    |
    +--> existing send_product_to_tenants --> products and existing price payload
    |
    +--> tenant settings branding + provisioning result
    |
    v
Site Design V2 --> native preview --> explicit Go Live --> public native storefront
```

## 7. Package Definition

`SitePackage` remains the in-repository source of package metadata. Banner Builder Pro
gains native installation defaults:

- `installMode: "native-tenant"`;
- recommended native theme `glassmorphism`;
- Danish starter title and description;
- a default domain slug suggestion such as `banner-builder`;
- native hero copy focused on banners, mesh, signs, foil, and finishing;
- automatic product-copy eligibility enabled for standard products only.

The compiled bundle under `public/site-previews/banner-builder-pro` remains unchanged.
It is opened from the package card as `Originalt design-preview` so its limits are
clear.

Future packages can adopt the same metadata after Banner Builder passes QA. A package
without `installMode: "native-tenant"` does not expose the independent-site action.

## 8. Secure Tenant Creation

An additive migration introduces:

```sql
public.create_platform_site_from_package(
    package_id text,
    site_name text,
    site_domain text,
    contact_email text default null
) returns jsonb
```

The function:

1. requires an authenticated `master_admin` role;
2. trims and validates package ID, site name, domain, and optional email;
3. normalizes the domain to lowercase and removes protocol, path, and trailing dot;
4. rejects the master domain and duplicate tenant domains;
5. creates a tenant with `owner_id = auth.uid()` and
   `is_platform_owned = true`;
6. writes `settings.type = "tenant"`, company name/email, and the initial
   `site_frontends` state;
7. returns tenant ID, name, domain, package ID, and provisioning state.

The initial settings contract is:

```json
{
  "type": "tenant",
  "company": {
    "name": "Banner Builder",
    "email": "kontakt@example.dk"
  },
  "site_frontends": {
    "activeSiteId": "banner-builder-pro",
    "installedSiteIds": [],
    "renderMode": "native",
    "launchStatus": "draft",
    "provisioning": {
      "packageId": "banner-builder-pro",
      "status": "creating",
      "attempt": 1,
      "startedAt": "ISO-8601 timestamp",
      "completedAt": null,
      "lastError": null
    }
  }
}
```

The function grants execution to `authenticated` and `service_role`, revokes execution
from `PUBLIC` and `anon`, and performs its own master-role check. The migration includes
an explicit rollback note and passes the repository's Supabase grant checker.

## 9. Provisioning Service

The client service accepts a package, validated creation input, and a narrow adapter for
database operations. Dependency injection keeps orchestration testable without a live
Supabase project.

Provisioning executes these ordered stages:

1. `create_tenant`
2. `install_templates`
3. `apply_branding`
4. `discover_products`
5. `copy_products`
6. `finalize`

The service returns a structured result:

```ts
type SiteProvisioningResult = {
  tenantId: string;
  tenantName: string;
  domain: string;
  packageId: string;
  status: "ready" | "partial";
  templates: { planned: number; inserted: number; skipped: number };
  products: { eligible: number; copied: number; failed: number };
  failedStage: SiteProvisioningStage | null;
  errors: Array<{ stage: SiteProvisioningStage; message: string }>;
};
```

Template installation reuses `installSitePackageTemplates`. Its existing natural key
of template type, category, and name keeps retries idempotent.

Starter branding is built from Webprinter defaults and stored as both the initial draft
and published baseline. The tenant remains publicly gated by `launchStatus = "draft"`,
so the baseline does not make the shop live. The branding applies the recommended theme,
Banner Builder hero copy, and package identity; all of it is immediately editable in
Site Design V2.

## 10. Product Discovery and Copying

Eligible source products must satisfy every condition:

- belong to the master tenant;
- include `banner-builder-pro` in their existing
  `technical_specs.site_frontends` mapping;
- are published;
- are marked ready;
- are not linked to a POD v2 tenant import or catalog product;
- use an existing standard pricing path supported by
  `clone_product_for_tenant_release`.

Each eligible product is copied with the existing protected
`send_product_to_tenants` RPC using `delivery_mode = "price_list"`. The new installer
does not reproduce product or price cloning in TypeScript or SQL.

A product that fails its existing distribution validation is reported in the result and
does not make the whole tenant unusable. The site remains `partial` until the operator
retries or accepts a site with the remaining eligible products. No POD fallback is
attempted automatically.

Copied `technical_specs.site_frontends` metadata is preserved, so the tenant's native
catalog filter continues to select the Banner Builder products.

## 11. Native Storefront Mode and Draft Gate

Today, `Shop.tsx` renders `SitePackagePreview` when an active site package exists on a
non-root live host. The new `renderMode` setting makes the choice explicit:

- `renderMode = "native"`: render the normal tenant storefront and keep the active-site
  catalog filter;
- missing `renderMode`: preserve current legacy behavior;
- legacy facade/bundle behavior remains available for existing tenants and previews.

The new installed tenant uses `native`. Site Design V2 therefore controls its branding,
header, footer, homepage, product presentation, and editable content.

When `launchStatus = "draft"`, a shared storefront launch guard shows a simple
tenant-branded maintenance state. The guard covers the root shop, catalog, product,
product configuration, checkout, and designer entry routes, so a direct URL cannot
bypass the draft state. Platform marketing routes, admin routes, and authenticated
preview routes remain available. Admin preview routes show the full native storefront.

`Gør live` changes only the launch status after the existing checks confirm:

- package templates installed;
- at least one mapped, published product;
- a live domain/address;
- no unresolved critical provisioning error.

Existing tenants without a launch status keep their current public behavior.

## 12. Master Admin Experience

The Banner Builder card in `/admin/sites` gains a master-only action:

`Opret som selvstændigt site`

The dialog contains:

- shop name, required;
- domain or Webprinter subdomain, required;
- contact email, optional;
- read-only summary of templates in the package;
- current count of eligible mapped master products;
- a clear statement that the site starts as a draft.

The confirmation summary states what will be created and that no prices are changed.

While provisioning, the dialog shows the current stage rather than an indeterminate
spinner alone. On success it shows template and product counts and offers:

- `Åbn Site Design V2`;
- `Preview site`;
- `Gå til produkter`.

On partial failure it shows the failed stage, completed work, and `Prøv igen`. Retry uses
the existing tenant returned by the first attempt; it never creates a duplicate tenant.

The tenant overview gains a context-safe `Administrer` link for platform-owned sites so
the master admin can return to the new tenant through its domain context.

`SitesAdmin` must honor the tenant ID resolved from `force_domain` even when the current
operator is a master admin. Master-admin status controls permission; it must not force
the data target back to the master tenant. Without `force_domain`, the central Sites
route continues to default to the master tenant.

## 13. Idempotency and Recovery

Idempotency rules are explicit:

1. Domain uniqueness prevents duplicate tenant creation.
2. A retry result carries the original tenant ID.
3. Template installation skips existing natural keys.
4. Product copying uses the existing clone behavior for a tenant/product slug and does
   not create parallel prices.
5. Finalization merges the current tenant settings rather than overwriting unrelated
   settings.
6. Every attempt increments `provisioning.attempt` and records timestamps.
7. A ready installation can be reopened but cannot be provisioned as a second tenant
   without a different domain.

Failure behavior:

| Failure | Operator result | Stored state | Recovery |
|---|---|---|---|
| Invalid or duplicate domain | No tenant created | None | Correct input |
| Unauthorized user | No tenant created | None | Sign in as master admin |
| Template insert failure | Tenant retained | `partial` with stage | Retry templates |
| Branding save failure | Tenant retained | `partial` with stage | Retry branding |
| One product copy fails | Other products retained | `partial` with product error | Fix source product and retry |
| Final settings update fails | Created data retained | Previous stage visible | Reload and retry finalization |

The UI does not offer automatic deletion as recovery. Existing safe tenant deletion or
manual administrative cleanup remains a separate, explicitly confirmed operation.

## 14. Security and Tenant Isolation

1. Tenant creation is performed only through the new master-role-checked RPC.
2. The browser never receives a service-role key.
3. Package ID is stored as metadata; it never grants access by itself.
4. Every template and copied product row uses the returned tenant ID.
5. Product discovery is limited to master-tenant rows.
6. Product copy authorization stays inside the existing master-only distribution RPC.
7. Public draft gating is read-only and cannot be bypassed by a storefront query value.
8. Domain normalization prevents protocol/path variants from creating ambiguous
   tenant lookups.
9. Error messages shown to operators exclude credentials and raw supplier payloads.
10. No new public table is created.

## 15. Testing Strategy

Implementation follows test-driven development. Every new production function receives
a failing test before implementation.

### Unit tests

- normalize and validate domain/name/email input;
- build the secure RPC request;
- build initial and finalized `site_frontends` settings without losing unrelated keys;
- build Banner Builder starter branding;
- discover only eligible standard mapped products;
- execute stages in order;
- return `partial` after a recoverable stage failure;
- retry against the original tenant ID;
- preserve legacy storefront behavior when `renderMode` is absent;
- choose native rendering when `renderMode = "native"`;
- block root, catalog, product, configuration, checkout, and designer routes while
  `launchStatus = "draft"`;
- allow admin preview while draft;
- honor a master admin's explicit `force_domain` tenant context in Sites and Site Design;
- promote only through explicit Go Live.

### Migration checks

- migration contains explicit execute grants/revokes;
- `npm run check:supabase-grants` passes;
- `npm run check:supabase-functions` remains unchanged and passing where applicable.

### Browser proof

A read-only Playwright proof verifies:

1. legacy Banner Builder preview still loads the original bundle;
2. an installed native fixture renders the editable native storefront;
3. draft public route shows maintenance state;
4. admin preview shows the full storefront;
5. native product links keep tenant context;
6. existing Webprinter, Salgsmapper, and Onlinetryksager proof routes remain intact.

### Release verification

- focused new Node tests;
- existing site/storefront tests;
- Supabase grant check;
- production Vite build;
- `npm run check:commercial-proof` if the local Supabase/browser environment is
  available;
- manual master-admin smoke of create, partial retry, Site Design V2 edit, preview,
  and Go Live.

## 16. Rollout

1. Ship the secure RPC and native-render contract with legacy behavior as the default.
2. Expose independent installation only for Banner Builder Pro.
3. Create a controlled draft site on a Webprinter subdomain.
4. Verify product prices are copied, not recalculated.
5. Edit and publish branding through Site Design V2.
6. Complete the draft/public/Go Live browser proof.
7. Use the same contract for the next package only after Banner Builder passes the
   acceptance criteria.

## 17. Rollback

- Remove or hide the independent-site action.
- Existing tenants continue using missing-`renderMode` legacy behavior.
- Set the new tenant back to `launchStatus = "draft"` to remove public checkout access.
- Revert the `Shop.tsx` native-mode branch without changing legacy facade rendering.
- Revoke and drop `create_platform_site_from_package` if the workflow is withdrawn.
- Retain the created tenant and its data for manual review; do not hard-delete it as
  part of code rollback.

## 18. Acceptance Criteria

The first release is accepted when:

1. A master admin can create exactly one draft Banner Builder tenant from `Sites`.
2. A non-master cannot execute the creation RPC.
3. The tenant receives Banner Builder templates idempotently.
4. Eligible mapped standard products and their existing prices are copied without
   modifying pricing logic.
5. POD-linked and ineligible products are not copied automatically.
6. The original iframe bundle still works as a preview.
7. The installed tenant renders the native storefront and is editable in Site Design
   V2.
8. Public traffic cannot enter the draft shop or checkout.
9. Admin preview works while the site is draft.
10. Explicit Go Live makes the native storefront public after readiness checks.
11. A failed stage can be retried without a second tenant or duplicate templates.
12. Existing tenant storefront behavior remains unchanged.
13. Focused tests, grant checks, and the production build pass with fresh evidence.
