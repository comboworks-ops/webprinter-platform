# Critical Flows

Status: Operational protection guide  
Purpose: Define the flows that must never break while the platform is being cleaned up, hardened, or prepared for APIs.

This document is not about every feature.  
It is about the business-critical paths where one mistake can affect tenants, storefront behavior, or pricing correctness.

Use this together with:

- `docs/DOMAIN_STABILITY_MAP.md`
- `docs/SYSTEM_VISUAL_MAP.md`
- `docs/ARCHITECTURE_BOUNDARIES.md`
- `docs/LOCK_FIX_OVERVIEW.md`
- `docs/REST_API_READINESS_DRAFT.md`

---

## 1. The Core Rule

If a change touches one of the flows below, it is **high-risk by default**.

That means:

- do not change it casually
- do not combine it with unrelated refactors
- do not change UI and backend behavior in the same blind step
- document what was changed
- verify the full flow, not just one screen

---

## 2. Critical Flow List

These are the flows that matter most:

1. Tenant resolution
2. Product visibility in the correct shop
3. Product page loads the correct data
4. Pricing matrix reads and shows correct prices
5. Draft / preview / publish behavior
6. Tenant isolation on edit / delete / duplicate / copy
7. Product distribution from master to tenant
8. Supplier import into real product structure
9. POD v1 / POD v2 isolation

---

## 3. Flow Table

| Flow | Why It Is Critical | Main Paths / Areas | Risk Level |
|---|---|---|---|
| Tenant resolution | If tenant context is wrong, the whole shop/admin can point at the wrong data | `src/lib/adminTenant.ts`, routing, shop/admin bootstrapping | `Highest` |
| Product visibility | A product can show in the wrong shop, disappear, or publish incorrectly | product overview/admin visibility logic, shop product queries | `Highest` |
| Product page load | Wrong slug or wrong product data means broken storefront and wrong buying flow | `src/pages/ProductPrice.tsx`, storefront product lookup paths | `Highest` |
| Pricing read | Wrong prices are one of the most expensive failures in the system | `src/components/product-price-page/*`, `src/lib/pricing/*`, `src/utils/productPricing.ts` | `Highest` |
| Draft / preview / publish | If preview and live state drift, the site designer becomes unreliable | branding/site designer runtime, preview contexts, publish adapters | `High` |
| Tenant mutation isolation | If edit/delete/copy is not scoped right, tenants affect each other | admin mutations, DB functions, tenant-scoped product operations | `Highest` |
| Master-to-tenant distribution | Shared/copied products must behave predictably and stay isolated correctly | product distribution logic, clone/sync flows, admin controls | `High` |
| Supplier import pipeline | Imports must create correct products without corrupting pricing structure | `scripts/*`, import docs, product creation/import flows | `High` |
| POD isolation | POD changes must not leak into core pricing/product architecture | `src/lib/pod/*`, `src/lib/pod2/*`, `supabase/functions/pod2-*` | `Highest` |

---

## 4. Flow Details

### 4.1 Tenant Resolution

**What this flow does**

- decides which tenant the user/shop/admin is operating inside
- decides whether the user is master admin, tenant admin, or something else
- sets the context for all later reads and writes

**Why it matters**

If this is wrong:

- the wrong shop can render
- the wrong branding can load
- the wrong products can appear
- the wrong tenant can be edited

**Main areas**

- `src/lib/adminTenant.ts`
- app bootstrapping in `src/App.tsx`
- admin route resolution
- shop runtime tenant resolution

**Must not break**

- hostname-based tenant resolution
- master tenant detection
- tenant-scoped admin behavior
- preview/shop using the intended tenant

**Minimum check before and after changes**

1. master admin opens master tenant
2. tenant admin opens own tenant
3. shop renders correct tenant branding/products
4. preview renders correct tenant draft/published state

---

### 4.2 Product Visibility In The Correct Shop

**What this flow does**

- controls whether a product is visible
- controls where it is visible
- controls whether it belongs to the correct tenant/shop

**Why it matters**

This is one of the most visible business failures:

- products disappear
- products appear in the wrong tenant
- frontend and admin disagree about what is published

**Main areas**

- product overview/admin visibility controls
- tenant/product queries
- storefront product list queries

**Must not break**

- master product should not silently leak into a tenant
- tenant-only product should not appear elsewhere
- “visible in shop” should match actual storefront behavior

**Minimum check**

1. product visible in admin
2. product visible in intended tenant shop
3. product not visible in unintended tenant
4. refresh does not undo the result

---

### 4.3 Product Page Loads Correct Data

**What this flow does**

- resolves a product by slug
- loads the correct configuration data
- loads the correct matrix/options/materials

**Why it matters**

If this breaks, the storefront may still render, but the wrong product can be sold.

**Main areas**

- `src/pages/ProductPrice.tsx`
- product detail data fetching
- slug resolution
- product option rendering

**Must not break**

- slug lookup
- correct product id resolution
- correct attribute/config loading
- correct product info below the matrix

**Minimum check**

1. open product by slug
2. verify title, description, and imagery match
3. verify matrix/options belong to that product
4. verify selected state changes the displayed result correctly

---

### 4.4 Pricing Matrix Reads And Shows Correct Prices

**What this flow does**

- reads published price rows
- filters valid combinations
- shows quantity/material/format dependent pricing

**Why it matters**

This is direct revenue logic.

A pricing bug is worse than a styling bug.

**Main areas**

- `src/components/product-price-page/*`
- `src/lib/pricing/*`
- `src/utils/productPricing.ts`
- published price read path
- `generic_product_prices` and related read flows

**Must not break**

- matrix load
- correct filtering of valid combinations
- correct displayed price
- selector dependency order
- no hidden fallback that changes price incorrectly

**Minimum check**

1. open product page
2. verify initial price
3. change options and verify price updates
4. verify unavailable combinations are handled correctly
5. compare against real published rows if the product is sensitive

---

### 4.5 Draft / Preview / Publish Behavior

**What this flow does**

- lets admin change design/branding state safely
- shows draft in preview
- promotes approved state to live

**Why it matters**

If preview and live diverge, the site designer becomes untrustworthy.

**Main areas**

- branding/site designer admin UI
- `src/hooks/useBrandingDraft.ts`
- `src/contexts/PreviewBrandingContext.tsx`
- branding adapters and tenant settings publishing

**Must not break**

- draft should stay draft until explicit publish
- preview should show the correct draft/published mix
- publish should only affect the intended tenant
- published state should survive reload

**Minimum check**

1. make branding change in draft
2. confirm preview changes
3. confirm live storefront does not change before publish
4. publish
5. confirm live storefront changes only for intended tenant

---

### 4.6 Tenant Isolation On Edit / Delete / Duplicate / Copy

**What this flow does**

- ensures product/category mutations stay within the correct tenant boundary
- ensures destructive actions do not affect shared or wrong-tenant data

**Why it matters**

This is one of the highest-risk data integrity areas.

**Main areas**

- admin product mutation flows
- clone/sync DB functions
- tenant-scoped delete/update flows
- `docs/LOCK_FIX_OVERVIEW.md`

**Must not break**

- tenant A must not modify tenant B
- tenant must not mutate master incorrectly
- duplicate must keep correct tenant ownership
- delete should stay scoped

**Minimum check**

1. rename product in one tenant
2. confirm same product in other tenant is unchanged
3. duplicate product and verify tenant ownership
4. delete in one tenant and verify no cross-tenant effect

---

### 4.7 Product Distribution From Master To Tenant

**What this flow does**

- copies or distributes product structures from master into a tenant
- defines whether the result is independent or master-controlled

**Why it matters**

This affects catalog correctness across shops.

**Main areas**

- admin distribution flows
- clone/sync behavior
- product copy semantics

**Must not break**

- “copy” must copy the whole usable product structure
- target tenant must actually receive the product
- product should appear where the UI says it will appear
- copied products must not silently lose pricing/material rows

**Minimum check**

1. send/copy from master to tenant
2. confirm product appears in target tenant admin
3. confirm product appears in correct shop context if published/visible
4. confirm price matrix and product structure are intact

---

### 4.8 Supplier Import Into Real Product Structure

**What this flow does**

- fetches supplier data
- reshapes it to product rows/matrix data
- inserts it into the existing product system

**Why it matters**

Imports create a large amount of real business data quickly.

If the import shape is wrong, the storefront may be wrong even if import technically “worked”.

**Main areas**

- `scripts/*`
- supplier import runbooks in `docs/*`
- fetch/import skill flows

**Must not break**

- correct quantities
- correct materials/formats/options
- correct product layout structure
- correct price rows
- no silent corruption of existing product behavior

**Minimum check**

1. import into test/master target
2. open product in admin
3. verify rows/options against source
4. open preview/storefront
5. verify matrix behaves correctly

---

### 4.9 POD v1 / POD v2 Isolation

**What this flow does**

- keeps legacy POD and POD v2 additive Print.com integration separate
- protects core pricing and product logic from POD-specific behavior

**Why it matters**

This repo explicitly requires isolation here.

**Main areas**

- `src/lib/pod/*`
- `src/lib/pod2/*`
- `src/pages/admin/Pod2*`
- `supabase/functions/pod2-*`
- `POD2_README.md`

**Must not break**

- no POD v2 logic inside core pricing engine
- no POD v1 regression while touching POD v2
- no shared destructive changes across POD systems

**Minimum check**

1. confirm POD v1 still works as before
2. confirm POD v2 import/catalog flows still work
3. confirm pricing engine was not modified indirectly

---

## 5. Practical Change Rules

If you touch a critical flow:

1. change only one critical flow at a time
2. avoid bundling UI cleanup with data behavior changes
3. verify tenant scope explicitly
4. verify preview and live separately if branding/publish is involved
5. document the result if the change is structural

---

## 6. Safe Cleanup Order

If the goal is structured cleanup with low break risk, use this order:

1. Tenant resolution
2. Tenant mutation isolation
3. Product visibility
4. Product page data loading
5. Pricing read path
6. Draft / preview / publish behavior
7. Master-to-tenant product distribution
8. Supplier import standardization
9. API extraction around stabilized read flows

This order protects the business-critical paths first.

---

## 7. API Readiness Rule

A critical flow should not become an API first unless:

- the UI/runtime behavior is already stable
- tenant scoping is verified
- no known blocking 500s remain
- repeated real tests pass
- rollback is possible

If those are not true, keep hardening first.

---

## 8. What To Write Next

After this file, the next useful artifact is:

- `docs/DOMAIN_CONTRACTS.md`

That document should define, per domain:

- what it reads
- what it writes
- what it returns
- what it must not own
- when it is ready for read-only API extraction

