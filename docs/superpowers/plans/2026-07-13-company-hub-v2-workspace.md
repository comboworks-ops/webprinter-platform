# Company Hub V2 Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first usable Company Hub V2 workspace with company and office switching, shared delivery addresses, scoped member roles, and tenant-admin setup while preserving the V1 portal until the migration is active.

**Architecture:** Add a capability probe and focused write repository above the Slice 1 schema. Render V2 through small customer and admin components only when the database capability is present; otherwise retain the current V1 experience without a reload loop or runtime error.

**Tech Stack:** React 18, React Router, React Query, Supabase JS/RLS, shadcn UI, Lucide icons, React Helmet, Playwright, Node 24 TypeScript tests.

## Global Constraints

- Existing pricing, checkout verification, orders, POD v1, and POD v2 remain unchanged.
- Company and office records are always scoped by both `tenant_id` and `company_id`.
- Customer admins cannot mutate membership identity or tenant scope through broad table updates.
- V2 capability failure falls back to V1; it never produces a blank page.
- `/company` is `noindex,nofollow`.
- Danish interface text uses correct Danish letters.
- UI is operational, compact, accessible, responsive, and uses actual company/product visuals.

---

### Task 1: Capability Probe And Workspace Mutations

**Files:**
- Create: `src/lib/company-hub/capabilities.ts`
- Create: `src/lib/company-hub/capabilities.test.ts`
- Create: `src/lib/company-hub/workspaceRepository.ts`
- Modify: `src/lib/company-hub/index.ts`

**Interfaces:**
- Produces: `detectCompanyHubV2(client): Promise<CompanyHubCapability>` where status is `available`, `unavailable`, or `error`.
- Produces: office/address CRUD functions that require explicit tenant and company IDs and return typed rows.

- [x] Write failing tests for PostgreSQL missing-table/missing-column fallback codes.
- [x] Implement capability classification for `42P01`, `42703`, success, and transport errors.
- [x] Implement office and address create/update/archive functions using explicit payload allowlists.
- [x] Add repository tests proving tenant/company IDs cannot be omitted or overwritten.
- [x] Run Node TypeScript tests and focused `tsc`; commit.

### Task 2: React Query Workspace Hook

**Files:**
- Create: `src/hooks/useCompanyWorkspace.ts`

**Interfaces:**
- Consumes: Slice 1 read repository and Task 1 mutation repository.
- Produces: capability, memberships, selected-company offices/addresses, loading/error states, and invalidating mutations.

- [x] Implement stable query keys containing tenant/company/office IDs.
- [x] Disable child queries until capability and company selection are valid.
- [x] Map repository errors to component state; do not show toasts in the data layer.
- [x] Invalidate only affected company queries after mutations.
- [x] Run focused TypeScript and production build; commit.

### Task 3: Customer Workspace Shell

**Files:**
- Create: `src/components/companyhub/v2/CompanyWorkspaceShell.tsx`
- Create: `src/components/companyhub/v2/CompanyWorkspaceHeader.tsx`
- Create: `src/components/companyhub/v2/CompanyWorkspaceNav.tsx`
- Create: `src/components/companyhub/v2/CompanyOverview.tsx`
- Modify: `src/pages/CompanyHub.tsx`

**Interfaces:**
- Consumes: `useCompanyWorkspace`, current `Header`/`Footer`, tenant design tokens.
- Produces: authenticated company/office switching and overview navigation.

- [x] Add `Helmet` metadata with `noindex,nofollow`.
- [x] Build compact company and office selectors with keyboard support.
- [x] Build the first overview and visual product sections with concise empty states.
- [x] Gate V2 rendering on capability `available`; use the current V1 page for `unavailable` and a recoverable Danish warning for transport failure.
- [x] Verify compilation and production build; commit. Browser viewport verification remains in Task 6 after database activation.

### Task 4: Offices And Addresses Customer View

**Files:**
- Create: `src/components/companyhub/v2/CompanyLocationsView.tsx`
- Create: `src/components/companyhub/v2/AddressSummary.tsx`

**Interfaces:**
- Consumes: selected office, company-wide addresses, and office-specific addresses.
- Produces: scannable read view and role-gated edit dialogs for company owner/admin.

- [x] Render office contact/profile details without nested cards.
- [x] Separate delivery and billing defaults and show inheritance from company to office.
- [x] Add create/edit/archive dialogs with Danish postal validation.
- [x] Hide write actions from approver, buyer, and viewer roles.
- [x] Add keyboard-ready controls and responsive layout; full browser viewport evidence remains in Task 6.

### Task 5: Tenant Admin Onboarding Surface

**Files:**
- Create: `src/components/companyhub/v2/AdminCompanyWorkspace.tsx`
- Create: `src/components/companyhub/v2/AdminCompanySetupProgress.tsx`
- Create: `src/components/companyhub/v2/AdminCompanyOffices.tsx`
- Create: `src/components/companyhub/v2/AdminCompanyMembers.tsx`
- Modify: `src/pages/admin/AdminCompanyHub.tsx`

**Interfaces:**
- Consumes: current tenant context, capability probe, workspace repository, existing company/member data.
- Produces: visual setup flow for identity, offices, addresses, and roles.

- [ ] Replace raw-ID-first layout only when V2 capability is available.
- [ ] Add setup progress for identity, office, address, member, catalogue, template, and test order.
- [ ] Add office/address manager with explicit save/archive actions.
- [ ] Add role labels and office scope without exposing database role strings.
- [ ] Keep current V1 admin manager as fallback; commit.

### Task 6: Workspace Verification

**Files:**
- Create: `scripts/check-company-hub-workspace.mjs`
- Create: `tests/company-hub-workspace.spec.ts`
- Modify: `package.json`
- Modify: `SYSTEM_OVERVIEW.md`

**Interfaces:**
- Produces: static contract check and Playwright evidence for V1 fallback plus V2 workspace behavior.

- [ ] Verify noindex metadata and capability fallback bindings statically.
- [ ] Run V1 fallback against the current linked database and prove `/company` is not blank.
- [ ] Apply the reviewed V2 migration only after migration-history reconciliation is explicitly safe.
- [ ] Verify company/office switcher, address inheritance, role-gated actions, mobile layout, and zero console errors.
- [ ] Run focused tests, grants/functions checks, production build, and document evidence; commit.
