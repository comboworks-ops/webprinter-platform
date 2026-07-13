# Company Hub V2 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the additive, tenant-safe Company Hub V2 data and TypeScript foundation without changing existing pricing, checkout verification, orders, POD v1, or POD v2 behavior.

**Architecture:** Extend the existing Company Hub tables for compatibility and add focused V2 tables for offices, addresses, catalogue structure, template bindings, assets, requests, and audit events. Keep database access behind small Company Hub modules and add a checkout adapter that refuses missing or zero pricing before the existing checkout handoff.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Supabase JS, TypeScript, React Query compatibility, Node 24 native TypeScript tests, Vite.

## Global Constraints

- Existing product and pricing models remain authoritative.
- Company Hub catalogue rows reference products and never copy price rows.
- Existing Company Hub rows and roles remain readable.
- Every new company-owned record carries both `tenant_id` and `company_id`.
- Every new `public` table/function has explicit Data API grants or revokes.
- No destructive rollback, POD change, supplier submission, or live price mutation.
- Customer-facing copy uses correct Danish letters.
- The existing `company-hub` module flag remains the rollout boundary.

---

## File Map

- Create `supabase/migrations/20260713090000_company_hub_v2_foundation.sql`: additive schema, role helpers, grants, RLS, indexes, and rollback note.
- Create `src/lib/company-hub/types.ts`: shared domain types and legacy-role normalization contract.
- Create `src/lib/company-hub/access.ts`: pure role-capability helpers.
- Create `src/lib/company-hub/checkout.ts`: verified Company Hub context adapter for `SiteCheckoutState`.
- Create `src/lib/company-hub/repository.ts`: focused Supabase reads for memberships, offices, categories, catalogue, and addresses.
- Create `src/lib/company-hub/index.ts`: public module exports.
- Create `src/lib/company-hub/access.test.ts`: role and capability tests.
- Create `src/lib/company-hub/checkout.test.ts`: verified-price and Company Hub context tests.
- Create `scripts/check-company-hub-v2-foundation.mjs`: migration and module contract checker.
- Modify `src/lib/checkout/siteCheckoutSession.ts`: optional Company Hub context fields only.
- Modify `src/components/companyhub/types.ts`: compatibility re-exports from the focused domain module.
- Modify `package.json`: focused Company Hub foundation check command.

### Task 1: Migration Contract And Additive Schema

**Files:**
- Create: `scripts/check-company-hub-v2-foundation.mjs`
- Create: `supabase/migrations/20260713090000_company_hub_v2_foundation.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `company_accounts`, `company_members`, `company_hub_items`, `products`, `designer_saved_designs`, `designer_templates`, and `orders` tables.
- Produces: Company Hub V2 tables plus `company_hub_has_role(uuid,text[])`, `company_hub_is_member(uuid)`, and `company_hub_can_access_office(uuid,uuid)` RLS helpers.

- [ ] **Step 1: Write the failing structural check**

Create a checker that reads the migration and asserts all required tables,
helper functions, RLS enablement, authenticated/service-role grants, anon
revokes, and the rollback note:

```js
const requiredTables = [
  "company_offices",
  "company_addresses",
  "company_member_offices",
  "company_catalog_categories",
  "company_catalog_item_offices",
  "company_template_bindings",
  "company_template_fields",
  "company_assets",
  "company_order_requests",
  "company_consultant_requests",
  "company_activity_events",
];
```

- [ ] **Step 2: Run the check and confirm it fails**

Run: `node scripts/check-company-hub-v2-foundation.mjs`

Expected: failure because the migration does not exist.

- [ ] **Step 3: Write the additive migration**

The migration must:

- extend existing Company Hub tables with compatible defaults
- create all required tables with composite company/tenant relationships
- create security-definer membership helpers with fixed search paths
- revoke helper execution from `public` and `anon`
- grant helper execution to `authenticated` and `service_role`
- revoke table access from `anon`
- grant only required table privileges to `authenticated`
- grant full table access to `service_role`
- enable RLS on every new table
- create tenant-admin and company-member policies without recursive membership
  policies
- leave order/pricing/POD tables untouched

- [ ] **Step 4: Run migration checks**

Run:

```bash
npm run check:company-hub-foundation
npm run check:supabase-grants
npm run check:supabase-functions
```

Expected: all three commands pass.

- [ ] **Step 5: Commit migration foundation**

```bash
git add package.json scripts/check-company-hub-v2-foundation.mjs supabase/migrations/20260713090000_company_hub_v2_foundation.sql
git commit -m "feat: add company hub v2 data foundation"
```

### Task 2: Domain Types And Role Capabilities

**Files:**
- Create: `src/lib/company-hub/types.ts`
- Create: `src/lib/company-hub/access.ts`
- Create: `src/lib/company-hub/access.test.ts`
- Create: `src/lib/company-hub/index.ts`
- Modify: `src/components/companyhub/types.ts`

**Interfaces:**
- Consumes: database role values `company_admin`, `company_user`, `company_owner`, `company_approver`, `company_buyer`, and `company_viewer`.
- Produces: `CompanyRole`, `normalizeCompanyRole`, `canManageCompany`, `canApproveCompanyOrder`, `canPlaceCompanyOrder`, and typed Company Hub entities.

- [ ] **Step 1: Write failing role tests**

```ts
assert.equal(normalizeCompanyRole("company_user"), "company_buyer");
assert.equal(normalizeCompanyRole("company_admin"), "company_admin");
assert.equal(canManageCompany("company_owner"), true);
assert.equal(canManageCompany("company_buyer"), false);
assert.equal(canApproveCompanyOrder("company_approver"), true);
assert.equal(canPlaceCompanyOrder("company_viewer"), false);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test src/lib/company-hub/access.test.ts`

Expected: failure because the access module does not exist.

- [ ] **Step 3: Implement focused types and pure access helpers**

Use discriminated string unions for roles/status values. Keep JSON-shaped data
as `Record<string, unknown>` instead of `any`. Preserve the old component import
path through re-exports.

- [ ] **Step 4: Run tests and focused TypeScript check**

Run:

```bash
node --test src/lib/company-hub/access.test.ts
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 src/lib/company-hub/types.ts src/lib/company-hub/access.ts
```

Expected: tests and TypeScript check pass.

- [ ] **Step 5: Commit domain contracts**

```bash
git add src/lib/company-hub src/components/companyhub/types.ts
git commit -m "feat: add typed company hub domain contracts"
```

### Task 3: Verified Checkout Adapter

**Files:**
- Create: `src/lib/company-hub/checkout.ts`
- Create: `src/lib/company-hub/checkout.test.ts`
- Modify: `src/lib/checkout/siteCheckoutSession.ts`

**Interfaces:**
- Consumes: a complete `SiteCheckoutState`, `CompanyHubCheckoutContext`, and existing `pricingQuote`.
- Produces: `buildCompanyHubCheckoutState(base, context): SiteCheckoutState`, which throws `CompanyHubCheckoutError` when product ID, quantity, quote, or positive total is missing.

- [ ] **Step 1: Write failing checkout tests**

```ts
assert.throws(
  () => buildCompanyHubCheckoutState({ productId: "p", quantity: 100, totalPrice: 0 }, context),
  /gyldig pris/i,
);
assert.equal(
  buildCompanyHubCheckoutState(validState, context).companyOrderRequestId,
  context.companyOrderRequestId,
);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test src/lib/company-hub/checkout.test.ts`

Expected: failure because the checkout adapter does not exist.

- [ ] **Step 3: Implement the adapter**

The adapter checks:

- `productId` is present
- `quantity` is a positive integer
- `productPrice` and `totalPrice` are finite and greater than zero
- `pricingQuote` exists and matches product and quantity
- company, catalogue item, and request identifiers are present

It then adds only optional Company Hub context to the current checkout state.

- [ ] **Step 4: Run checkout tests and type check**

Run:

```bash
node --test src/lib/company-hub/checkout.test.ts
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --jsx react-jsx src/lib/company-hub/checkout.ts src/lib/checkout/siteCheckoutSession.ts
```

Expected: tests and TypeScript check pass.

- [ ] **Step 5: Commit the checkout safety boundary**

```bash
git add src/lib/company-hub/checkout.ts src/lib/company-hub/checkout.test.ts src/lib/checkout/siteCheckoutSession.ts
git commit -m "feat: guard company hub checkout handoff"
```

### Task 4: Focused Read Repository

**Files:**
- Create: `src/lib/company-hub/repository.ts`
- Modify: `src/lib/company-hub/index.ts`

**Interfaces:**
- Consumes: configured Supabase client and authenticated RLS context.
- Produces: `listMyCompanyMemberships`, `listCompanyOffices`, `listCompanyAddresses`, `listCompanyCategories`, and `listCompanyCatalogItems`.

- [ ] **Step 1: Define exact repository return types**

Every function returns domain rows, throws a `CompanyHubRepositoryError` with a
Danish-safe public message, and preserves the original database error as
`cause`. Functions do not show toasts or navigate.

- [ ] **Step 2: Implement membership and workspace reads**

Queries must select explicit columns, scope child reads by `company_id`, and let
RLS enforce access. Catalogue rows join only display product fields and do not
read or calculate prices.

- [ ] **Step 3: Run focused TypeScript check**

Run:

```bash
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 src/lib/company-hub/repository.ts src/lib/company-hub/types.ts
```

Expected: the repository modules type-check.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 5: Commit the repository boundary**

```bash
git add src/lib/company-hub/repository.ts src/lib/company-hub/index.ts
git commit -m "feat: add company hub repository boundary"
```

### Task 5: Foundation Completion Audit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-company-hub-v2-foundation.md`
- Modify: `SYSTEM_OVERVIEW.md`

**Interfaces:**
- Consumes: the complete Slice 1 implementation.
- Produces: verified foundation evidence and a documented next-slice boundary.

- [ ] **Step 1: Run the full foundation gate**

```bash
npm run check:company-hub-foundation
npm run check:supabase-grants
npm run check:supabase-functions
node --test src/lib/company-hub/access.test.ts src/lib/company-hub/checkout.test.ts
npm run build
```

Expected: all focused checks and the production build pass.

- [ ] **Step 2: Inspect the diff for protected-system changes**

Run:

```bash
git diff --name-only HEAD~4..HEAD
git diff --check HEAD~4..HEAD
```

Expected: no pricing table, POD v1, POD v2, supplier submission, or order
creation logic appears in the changed paths.

- [ ] **Step 3: Document the foundation**

Add the V2 table families, service boundaries, legacy compatibility, module
flag, and zero-price guard to `SYSTEM_OVERVIEW.md`.

- [ ] **Step 4: Mark completed plan checkboxes and commit**

```bash
git add docs/superpowers/plans/2026-07-13-company-hub-v2-foundation.md SYSTEM_OVERVIEW.md
git commit -m "docs: record company hub v2 foundation"
```

- [ ] **Step 5: Begin Slice 2 plan**

Create `docs/superpowers/plans/2026-07-13-company-hub-v2-workspace.md` for
offices, addresses, roles, and the customer company/office switcher. Do not
replace the V1 route until its data and browser acceptance checks pass.
