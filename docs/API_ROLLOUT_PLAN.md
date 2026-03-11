# API Rollout Plan

Status: Draft v1  
Purpose: Translate the domain map, critical flows, and domain contracts into a practical sequence for safe API extraction.

Use this together with:

- `docs/DOMAIN_STABILITY_MAP.md`
- `docs/CRITICAL_FLOWS.md`
- `docs/DOMAIN_CONTRACTS.md`
- `docs/REST_API_READINESS_DRAFT.md`
- `docs/LOCK_FIX_OVERVIEW.md`

---

## 1. Core Rule

We are **not** starting by rewriting the platform into APIs.

We are doing this in order:

1. stabilize behavior
2. define contract
3. expose read-only API
4. compare old path vs API path
5. switch by feature flag
6. add writes later

This is the only safe way to avoid exporting instability into more places.

---

## 2. What This Plan Is Trying To Protect

These must stay safe while API work begins:

- tenant resolution
- tenant isolation
- product visibility
- product page correctness
- pricing correctness
- preview vs publish behavior
- master-to-tenant distribution behavior
- POD v1 / POD v2 isolation

If an API plan threatens one of those, the plan is wrong.

---

## 3. Rollout Principles

### Read first
The first APIs should be read-only.

### Stable domains first
Do not start with the most experimental parts of the system.

### No pricing rewrites
Pricing behavior must be wrapped, not reinvented.

### Feature flags required
Every new API path must be reversible.

### Shadow mode before cutover
The API path and existing path should be compared before switching.

### POD stays separate
POD v1 and POD v2 are protected domains and are not part of early API extraction.

---

## 4. Rollout Order

This is the recommended order:

1. Tenant Context Read
2. Catalog Read
3. Product Detail / Options Read
4. Pricing Read
5. Branding / Site Designer Read
6. Product Admin Write
7. Pricing Admin Write
8. Tenant Publish / Distribution APIs
9. Design Module APIs
10. Import / Integration Job APIs

---

## 5. Phase-by-Phase Plan

### Phase 0: Groundwork

**Goal**

- establish flags, fallback rules, and comparison method before any live API cutover

**Required outputs**

- feature flag naming convention
- fallback strategy per module
- request logging format
- module readiness checklist

**Suggested feature flags**

- `USE_API_TENANT_CONTEXT`
- `USE_API_CATALOG`
- `USE_API_PRODUCT_DETAIL`
- `USE_API_PRICING_READ`
- `USE_API_BRANDING_READ`

**Done when**

- every future API path can be switched off cleanly
- rollback path is clear before first endpoint is used

---

### Phase 1: Tenant Context Read API

**Why first**

- almost everything depends on correct tenant context
- wrong tenant context invalidates every later API result

**What to expose**

- tenant resolution result
- current tenant metadata
- current user role in tenant context

**Example endpoints**

- `GET /api/v1/tenant/context`
- `GET /api/v1/tenant/by-hostname`

**Reads from**

- tenant records
- hostname/domain mapping
- user role mapping

**Must not do yet**

- no tenant writes
- no publish actions
- no tenant mutation actions

**Flag**

- `USE_API_TENANT_CONTEXT`

**Ready when**

- hostname resolution matches existing runtime
- master vs tenant role handling matches existing runtime
- no cross-tenant mismatch in comparison runs

---

### Phase 2: Catalog Read API

**Why second**

- storefront and admin both depend on clean product lists
- low-risk compared to writes

**What to expose**

- visible catalog products
- category/grouped product overview
- storefront product list results

**Example endpoints**

- `GET /api/v1/catalog/products`
- `GET /api/v1/catalog/categories`
- `GET /api/v1/catalog/products/:slug/summary`

**Reads from**

- product records
- visibility state
- tenant-scoped catalog state

**Must not do yet**

- no product mutation
- no distribution
- no publish actions

**Flag**

- `USE_API_CATALOG`

**Ready when**

- storefront list matches current runtime
- hidden products stay hidden
- tenant-scoped visibility stays correct

---

### Phase 3: Product Detail / Options Read API

**Why third**

- product detail is the next layer after catalog
- product page correctness is easier to verify before pricing writes enter the picture

**What to expose**

- product detail by slug/id
- attribute and option structures
- matrix configuration metadata

**Example endpoints**

- `GET /api/v1/products/:slug`
- `GET /api/v1/products/:slug/options`
- `GET /api/v1/products/:slug/layout`

**Reads from**

- product metadata
- option/attribute structures
- matrix configuration data

**Must not do yet**

- no price writing
- no product editing
- no import behavior

**Flag**

- `USE_API_PRODUCT_DETAIL`

**Ready when**

- product title, description, media, and selectors match current runtime
- correct product loads for each slug
- special selector logic still behaves correctly

---

### Phase 4: Pricing Read API

**Why fourth**

- pricing is core revenue logic
- it should only move once tenant context, catalog, and product detail are already stable

**What to expose**

- published price reads
- valid option/quantity combinations
- quote/read-only price response

**Example endpoints**

- `GET /api/v1/pricing/products/:productId`
- `POST /api/v1/pricing/quote`
- `GET /api/v1/pricing/products/:productId/availability`

**Reads from**

- published pricing rows
- matrix configuration
- option selection context

**Must not do yet**

- no pricing calculation rewrite
- no pricing admin writes
- no bulk pricing mutation

**Flag**

- `USE_API_PRICING_READ`

**Ready when**

- quoted price matches current runtime
- valid combinations match current runtime
- no selector dependency regressions
- no hidden fallback changes pricing behavior

---

### Phase 5: Branding / Site Designer Read API

**Why after pricing**

- branding matters, but it is less financially critical than pricing
- V2/runtime expectations are still mixed, so reads should come before writes

**What to expose**

- published branding payload
- draft branding payload where appropriate for preview
- page/theme metadata

**Example endpoints**

- `GET /api/v1/branding/current`
- `GET /api/v1/branding/published`
- `GET /api/v1/site-designer/pages`
- `GET /api/v1/site-designer/themes`

**Reads from**

- tenant branding state
- preview/draft state
- page/theme config

**Must not do yet**

- no publish writes
- no save/update APIs yet

**Flag**

- `USE_API_BRANDING_READ`

**Ready when**

- preview reads consistent draft state
- live storefront reads correct published state
- tenant isolation remains intact

---

### Phase 6: Product Admin Write APIs

**Why here**

- only after product reads are stable

**What to expose**

- controlled product create/update actions
- safe visibility changes
- safe duplicate operations

**Example endpoints**

- `POST /api/v1/admin/products`
- `PATCH /api/v1/admin/products/:id`
- `POST /api/v1/admin/products/:id/duplicate`

**High risk**

- tenant scoping
- duplicate/copy semantics
- accidental mutation leakage

**Flag**

- `USE_API_PRODUCT_ADMIN_WRITE`

**Ready when**

- all critical product mutation checks pass
- rollback is proven

---

### Phase 7: Pricing Admin Write APIs

**Why later**

- pricing writes are higher-risk than pricing reads

**What to expose**

- controlled pricing updates
- matrix publishing actions
- pricing generation/admin save flows

**Example endpoints**

- `POST /api/v1/admin/pricing/generate`
- `PATCH /api/v1/admin/pricing/products/:id`
- `POST /api/v1/admin/pricing/products/:id/publish`

**High risk**

- direct pricing corruption
- mismatch between admin and storefront rows

**Flag**

- `USE_API_PRICING_ADMIN_WRITE`

**Ready when**

- pricing read path is already stable on API
- pricing regression checklist passes

---

### Phase 8: Tenant Publish / Distribution APIs

**Why late**

- these flows are sensitive and easy to misunderstand
- they affect multiple shops and ownership models

**What to expose**

- publish/unpublish actions
- controlled master-to-tenant distribution
- distribution status/results

**Example endpoints**

- `POST /api/v1/admin/publish/products/:id`
- `POST /api/v1/admin/distribution/products/:id/copy`
- `GET /api/v1/admin/distribution/products/:id/status`

**High risk**

- tenant leakage
- incorrect ownership
- copy vs sync semantics confusion

**Flag**

- `USE_API_TENANT_DISTRIBUTION`

**Ready when**

- copy/distribution contract is explicit
- master vs tenant semantics are verified

---

### Phase 9: Design Module APIs

**Why late**

- the design module is specialized and should not be forced into the first wave

**What to expose**

- template list
- saved design list/load
- export job status

**Example endpoints**

- `GET /api/v1/design/templates`
- `GET /api/v1/design/saved`
- `POST /api/v1/design/export`

**Current recommendation**

- keep local/runtime-first until the commerce core is hardened

---

### Phase 10: Import / Integration Job APIs

**Why last**

- imports are still operational but fragmented
- they need standardization before a clean API layer makes sense

**What to expose eventually**

- import job start
- import job status
- import logs
- supplier profile metadata

**Example endpoints**

- `POST /api/v1/import-jobs`
- `GET /api/v1/import-jobs/:id`
- `GET /api/v1/import-jobs/:id/logs`

**Current recommendation**

- keep script-led until import profiles are standardized

---

## 6. What Must Wait

These should **not** be early API targets:

- pricing admin writes
- tenant distribution writes
- draft/publish writes in site designer
- import job orchestration
- POD v1 and POD v2 extraction into shared API flow

Reason:

- too much risk for too little early benefit

---

## 7. Phase Gates

Each phase should only begin when the previous one is true in practice.

### Required gate for moving forward

1. domain contract is clear
2. critical flow checks pass
3. tenant scoping verified
4. no blocking 500s in normal path
5. feature flag exists
6. rollback path exists
7. old path vs API path can be compared

---

## 8. How You Should Trigger This In Practice

This does **not** auto-activate on its own.

The working process is still manual.

When you think an area is ready, tell me:

```txt
Module ready for API hardening:
- Module: <name>
- Environment: <localhost / production tenant>
- Main flows tested: <list>
- Known remaining issues: <list or none>
- Tenant(s) tested: <list>
- Priority: <high/medium/low>
```

Then I will check it against:

- `docs/DOMAIN_CONTRACTS.md`
- `docs/CRITICAL_FLOWS.md`
- this rollout plan

and I will tell you whether it is:

- not ready
- ready for read-only API
- ready later for writes

---

## 9. Recommended First Real API Work

If we start carefully, the first practical extraction should be:

1. tenant context read
2. catalog read
3. product detail/options read
4. pricing read

That gives you a meaningful API surface without touching the most dangerous write paths yet.

---

## 10. Short Version

If you want the simplest possible rule:

- **First APIs**: tenant, catalog, product detail, pricing read
- **Later APIs**: branding read
- **Much later**: admin writes, distribution, imports
- **Protected**: POD v1 and POD v2

