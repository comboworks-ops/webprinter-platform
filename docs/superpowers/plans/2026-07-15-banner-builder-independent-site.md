<!-- /autoplan restore point: /Users/thomasprintmaker/.gstack/projects/comboworks-ops-webprinter-platform/ui-cleanup-autoplan-restore-20260715-160431.md -->
# Banner Builder Independent Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independent, platform-owned Banner Builder Pro shop: retain the original bundle as preview-only, create one draft native tenant, install editable Site Design V2 branding and Banner Builder templates, copy only price-safe eligible products, require an explicit verified Go Live action, and prove one real price-safe product through configuration, checkout, order creation, and production handoff before release.

**Architecture:** Keep the existing `tenants`, storefront, Site Design V2, checkout, product, and pricing models. Add two master-authorized RPCs for tenant creation and atomic one-product provisioning, a dependency-injected browser orchestration service with durable checkpoints, shared pure site-state/runtime rules, a focused master-admin dialog, and a fail-closed storefront launch guard. Missing native metadata remains the legacy facade behavior.

**Tech Stack:** React 18, TypeScript, Vite, React Router 6, TanStack Query 5, Supabase/PostgreSQL, shadcn/Radix UI, Tailwind CSS, Node test runner with type stripping, repository browser-proof scripts.

## Global Constraints

- Read `POD2_README.md`, `AI_CONTINUITY.md`, `SYSTEM_OVERVIEW.md`, `.agent/HANDOVER.md`, and `docs/SUPABASE_DATA_API_GRANTS.md` before implementation.
- Preserve POD v1, POD v2, checkout, orders, product publishing, and existing tenant behavior.
- Do not alter pricing formulas, prices, markups, STORFORMAT tables, or the existing clone helper.
- Auto-copy only products using the proven `pricing_structure.mode = "matrix_layout_v1"` plus `generic_product_prices` path copied by `copy_product_payload_deep`.
- Treat `STORFORMAT`, legacy table-specific pricing, POD v1, and POD v2 products as ineligible and show the reason; never create a copy missing its price payload.
- Keep `public/site-previews/banner-builder-pro` unchanged and label it as the original visual preview.
- New shops remain `launchStatus = "draft"` until a master admin explicitly makes them live.
- Query parameters never bypass draft gating or preview authentication.
- Draft isolation is enforced at both the React router and edge discovery surfaces: HTML metadata, sitemap, robots, and llms endpoints must not expose draft tenant identity or commerce URLs.
- Native admin preview runs with an explicit deny-by-default capability object. Payment, cart persistence, order creation, file upload/submission, designer save, and external commerce launch stay disabled below the UI layer.
- Every whole-tenant-settings write in the active Sites/branding/settings paths uses optimistic compare-and-swap against a monotonic `settings_version`; no read/merge/write path may silently overwrite a concurrent save.
- Use additive database changes only, explicit grants/revokes, `SECURITY DEFINER`, and `search_path = public, pg_temp`.
- Do not tighten unrelated tenant RLS policies in this change; the new RPCs perform their own master-role checks.
- Retry must retain the tenant and successful work. Never auto-delete a partial tenant.
- Preserve all unrelated settings and user changes in the dirty worktree. Stage and commit only files named by the current task.
- Every production behavior starts with a failing test. Use fresh verification output before any completion claim.

---

## File Structure

### New domain and data files

- Create `src/lib/sites/siteFrontendState.ts`: shared parsing, merging, runtime, launch-readiness, and provisioning checkpoint contracts.
- Create `src/lib/sites/siteFrontendState.test.ts`: legacy/native compatibility and launch-state tests.
- Create `src/lib/tenants/tenantSettingsCas.ts`: bounded optimistic tenant-settings patch helper using `settings_version`.
- Create `src/lib/tenants/tenantSettingsCas.test.ts`: stale-write retry, merge preservation, and exhaustion tests.
- Create `src/lib/sites/bannerBuilderSiteDefaults.ts`: deterministic non-mutating starter-branding builder.
- Create `src/lib/sites/bannerBuilderSiteDefaults.test.ts`: branding/package-default tests.
- Create `src/lib/sites/platformSiteRpc.ts`: input normalization, narrow RPC result types, and Supabase RPC adapters.
- Create `src/lib/sites/platformSiteRpc.test.ts`: validation and RPC request-contract tests.
- Create `src/lib/sites/platformSiteMigration.test.ts`: static security/idempotency contract for the additive migration.
- Create `src/lib/sites/platformSiteProducts.ts`: product eligibility classification and Supabase discovery adapter.
- Create `src/lib/sites/platformSiteProducts.test.ts`: every inclusion/exclusion branch.
- Create `src/lib/sites/platformSiteProvisioning.ts`: dependency-injected staged orchestrator and partial-acceptance rules.
- Create `src/lib/sites/platformSiteProvisioning.test.ts`: order, checkpoint, retry, partial, and acceptance tests.
- Create `src/lib/sites/platformSiteProvisioningSupabase.ts`: concrete tenant settings, template, branding, product, and finalization dependencies.
- Create `src/lib/sites/siteAdminLinks.ts`: force-domain-safe admin and native-preview URLs.
- Create `src/lib/sites/siteAdminLinks.test.ts`: context-preservation and preview-mode tests.
- Create `src/lib/sites/storefrontLaunch.ts`: pure tenant-resolution, render-mode, and launch-guard decisions.
- Create `src/lib/sites/storefrontLaunch.test.ts`: fail-closed and legacy/native behavior tests.
- Create `src/lib/sites/storefrontRuntimeCapabilities.ts`: deny-by-default native-preview mutation capabilities.
- Create `src/lib/sites/storefrontRuntimeCapabilities.test.ts`: preview capability and mutation-adapter contract tests.
- Create `src/components/admin/sites/CreateIndependentSiteDialog.tsx`: creation/progress/retry/result UI.
- Create `src/components/storefront/StorefrontLaunchGuard.tsx`: shared commerce-route guard.
- Create `src/components/storefront/StorefrontDraftPage.tsx`: standalone branded draft/error state without storefront navigation.
- Create `supabase/migrations/20260715210000_independent_site_provisioning.sql`: the two secure additive RPCs.
- Create `scripts/check-independent-site-provisioning-db.mjs`: release-blocking two-session SQL integration runner against an isolated test database.
- Create `scripts/sql/independent-site-provisioning-integration.sql`: authorization, retry, lock, provenance, price-payload, and settings-version assertions.
- Create `scripts/independent-site-doctor.mjs`: safe prerequisite/readiness diagnosis with exact next action and strict release mode.
- Create `scripts/independent-site-doctor.test.mjs`: deterministic doctor output/exit-code tests.
- Create `docs/INDEPENDENT_SITE_INSTALLER.md`: three-action maintainer quick start, architecture/error reference, release and rollback runbook.

### Existing integration files

- Modify `src/lib/sites/sitePackages.ts`: optional native-install metadata for Banner Builder only.
- Modify `src/lib/sites/installSitePackage.ts`: export pure row/natural-key helpers without changing current install behavior.
- Modify `src/pages/admin/SitesAdmin.tsx`: forced tenant targeting, independent-site action, published-product readiness, native Go Live, and context-safe links.
- Modify `src/components/admin/SiteDesignEditorV2.tsx`: consume shared site-state helpers and preserve new native fields.
- Modify `src/hooks/useBrandingDraft.ts`, `src/hooks/useBrandingHistory.ts`, `src/components/admin/AiSeoManager.tsx`, `src/components/admin/ShopSettings.tsx`, `src/lib/branding/master-adapter.ts`, and `src/lib/branding/tenant-adapter.ts`: replace stale whole-JSON writes with the shared CAS patch helper.
- Modify `src/components/admin/TenantOverview.tsx`: platform-owned draft/live status and manage link.
- Modify `src/hooks/useShopSettings.ts`: explicit resolved/fallback provenance for fail-closed storefront routing.
- Modify `src/pages/Shop.tsx`: native mode renders the normal editable storefront; missing mode retains legacy bundle rendering.
- Modify `src/pages/PreviewShop.tsx`: require admin authorization for every preview query mode.
- Modify `src/App.tsx`: classify every public tenant route and wrap the complete tenant surface with the launch guard while leaving platform/admin/authenticated-preview routes open.
- Modify `api/tenant-shell.ts`: suppress tenant metadata and emit a generic `noindex` shell while a verified native tenant is draft.
- Modify `api/sitemap.ts`: use the actual request host only and emit no tenant URLs while draft.
- Modify `api/robots.ts`: use the actual request host only and disallow all crawling while a verified native tenant is draft.
- Modify `api/llms.ts`: use the actual request host only and return no tenant content while draft.
- Modify `src/lib/storefront/seo.ts`: share the pure public-exposure decision used by browser and edge paths.
- Modify `package.json`: add the isolated database integration check command.
- Modify `scripts/check-tenant-proof-routes.mjs`: conditional independent-site proof plus legacy-preview/auth checks.
- Modify `SYSTEM_OVERVIEW.md`: independent-site architecture, security boundary, and rollback.
- Modify `AI_CONTINUITY.md`: shipped state, constraints, and verification evidence.

---

## Task 1: Shared Site State, Runtime, and Launch Contracts

**Files:**
- Create: `src/lib/sites/siteFrontendState.ts`
- Create: `src/lib/sites/siteFrontendState.test.ts`
- Create: `src/lib/tenants/tenantSettingsCas.ts`
- Create: `src/lib/tenants/tenantSettingsCas.test.ts`
- Modify: `src/pages/admin/SitesAdmin.tsx`
- Modify: `src/components/admin/SiteDesignEditorV2.tsx`

**Interfaces:**
- Produces `SiteFrontendState`, `SiteProvisioningState`, `SiteProvisioningStage`, `parseSiteFrontendState()`, `mergeSiteFrontendState()`, `markProvisioningStageComplete()`, and `evaluateSiteLaunchReadiness()`.
- Replaces duplicated local parsing/merge code in Sites and Site Design V2.
- Missing `renderMode` and `launchStatus` remain `null`, not silently native/draft.
- Produces `patchTenantSettingsCas()` with a narrow Supabase-like adapter, pure patch callback, maximum four attempts, and a typed conflict error after exhaustion.
- Every retry re-reads `{ settings, settings_version }`, recomputes the narrow patch from that fresh snapshot, and updates only when the observed version still matches.

- [ ] **Step 1: Write failing compatibility and readiness tests**

Create tests covering legacy preservation, native parsing, unrelated-key preservation, deterministic timestamps, durable completed stages, and published-product readiness:

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSiteLaunchReadiness,
  markProvisioningStageComplete,
  mergeSiteFrontendState,
  parseSiteFrontendState,
} from "./siteFrontendState.ts";

test("missing native fields preserve legacy semantics", () => {
  const state = parseSiteFrontendState({
    untouched: true,
    site_frontends: { activeSiteId: "banner-builder-pro", legacyFlag: "keep" },
  });
  assert.equal(state.renderMode, null);
  assert.equal(state.launchStatus, null);
});

test("merge preserves unrelated settings and raw site fields", () => {
  const merged = mergeSiteFrontendState(
    { untouched: { keep: true }, site_frontends: { legacyFlag: "keep" } },
    { renderMode: "native", launchStatus: "draft" },
    "2026-07-15T12:00:00.000Z",
  );
  assert.deepEqual(merged.untouched, { keep: true });
  assert.equal(merged.site_frontends.legacyFlag, "keep");
  assert.equal(merged.site_frontends.updatedAt, "2026-07-15T12:00:00.000Z");
});

test("native launch needs ready provisioning and a published mapped product", () => {
  const result = evaluateSiteLaunchReadiness({
    state: parseSiteFrontendState({
      site_frontends: {
        activeSiteId: "banner-builder-pro",
        installedSiteIds: ["banner-builder-pro"],
        renderMode: "native",
        launchStatus: "draft",
        provisioning: { packageId: "banner-builder-pro", status: "ready" },
      },
    }),
    packageId: "banner-builder-pro",
    publishedMappedProducts: 0,
    hasLiveAddress: true,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((item) => item.code === "published_product_missing"));
});

test("completed stages remain unique and retain product outcomes", () => {
  const next = markProvisioningStageComplete({
    packageId: "banner-builder-pro",
    status: "creating",
    attempt: 2,
    completedStages: ["install_templates"],
    productResults: { source1: { status: "copied", targetProductId: "target1" } },
    startedAt: "2026-07-15T12:00:00.000Z",
    completedAt: null,
    failedStage: null,
    lastError: null,
  }, "install_templates");
  assert.deepEqual(next.completedStages, ["install_templates"]);
  assert.equal(next.productResults.source1.targetProductId, "target1");
});
~~~

Add CAS tests that force a stale first update, insert a concurrent unrelated branding/settings key, and prove the second attempt retains both the concurrent value and requested patch. Also prove no-op patches do not write, successful writes return the server version, malformed rows fail safely, and four conflicts produce a stable `tenant_settings_conflict` error instead of a last-write-wins update.

- [ ] **Step 2: Run the focused test and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/tenants/tenantSettingsCas.test.ts
~~~

Expected: FAIL because both production modules do not exist.

- [ ] **Step 3: Implement defensive shared contracts**

Use these stable unions:

~~~ts
export type SiteRenderMode = "native";
export type SiteLaunchStatus = "draft" | "live";
export type SiteProvisioningStatus = "creating" | "partial" | "ready";
export type SiteProvisioningStage =
  | "create_tenant"
  | "install_templates"
  | "apply_branding"
  | "discover_products"
  | "copy_products"
  | "finalize";

export interface SiteProductProvisioningResult {
  status: "copied" | "existing" | "failed" | "ineligible" | "ineligible_at_copy";
  targetProductId?: string;
  errorCode?: string;
  message?: string;
}
~~~

`SiteProvisioningState` includes package ID, operation/attempt IDs, status, attempt, completed stages, product results, timestamps, structured diagnostics, failed stage, and optional accepted-product-failures timestamp. `evaluateSiteLaunchReadiness()` applies native checks only for native mode; legacy callers retain current checks.

Implement the CAS helper without importing the global Supabase singleton. The update adapter must request `settings, settings_version`, filter by both tenant ID and the observed version, and distinguish zero updated rows from transport errors. The SQL trigger added in Task 3 owns the monotonic increment; the client never invents a version. Patch callbacks receive a defensive clone and must return a complete settings object or the original object for no-op.

- [ ] **Step 4: Replace both local parser/merger copies**

Import the shared functions in Sites and Site Design V2 without changing UI behavior. Unknown `site_frontends` fields must survive both save paths.

- [ ] **Step 5: Run tests, build, and commit only this task**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/tenants/tenantSettingsCas.test.ts
npm run build
git add src/lib/sites/siteFrontendState.ts src/lib/sites/siteFrontendState.test.ts src/lib/tenants/tenantSettingsCas.ts src/lib/tenants/tenantSettingsCas.test.ts src/pages/admin/SitesAdmin.tsx src/components/admin/SiteDesignEditorV2.tsx
git commit -m "refactor: centralize site frontend state"
~~~

---

## Task 2: Native Package Metadata and Starter Branding

**Files:**
- Modify: `src/lib/sites/sitePackages.ts`
- Create: `src/lib/sites/bannerBuilderSiteDefaults.ts`
- Create: `src/lib/sites/bannerBuilderSiteDefaults.test.ts`

**Interfaces:**
- Adds optional `installMode: "native-tenant"` and typed `nativeInstall` metadata to `SitePackage`.
- Produces `buildBannerBuilderStarterBranding(baseBranding, nativeInstall)` without importing React hooks or mutating defaults.
- Only `banner-builder-pro` receives native metadata.

- [ ] **Step 1: Write failing metadata and non-mutation tests**

~~~ts
test("only Banner Builder exposes independent installation", () => {
  assert.equal(SITE_PACKAGE_MAP["banner-builder-pro"].installMode, "native-tenant");
  assert.equal(SITE_PACKAGE_MAP["print-pop"].installMode, undefined);
});

test("starter branding is deterministic and non-mutating", () => {
  const base = {
    themeId: "classic",
    hero: { overlay: { title: "Old", subtitle: "Old", buttons: [] }, images: [] },
  };
  const before = structuredClone(base);
  const config = SITE_PACKAGE_MAP["banner-builder-pro"].nativeInstall!;
  const first = buildBannerBuilderStarterBranding(base, config);
  assert.deepEqual(base, before);
  assert.deepEqual(first, buildBannerBuilderStarterBranding(base, config));
  assert.equal(first.themeId, "glassmorphism");
  assert.match(first.hero.overlay.title, /banner/i);
  assert.equal(first.themeId, SITE_PACKAGE_MAP["banner-builder-pro"].recommendedThemeId);
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/bannerBuilderSiteDefaults.test.ts
~~~

- [ ] **Step 3: Add the explicit package contract**

~~~ts
export interface NativeSiteInstallConfig {
  defaultSiteName: string;
  defaultDomainSlug: string;
  themeId: string;
  heroTitle: string;
  heroSubtitle: string;
  copyPolicy: "matrix-layout-v1-standard-only";
}
~~~

Set Danish Banner Builder defaults, reuse the package's existing `recommendedThemeId` (`glassmorphism`) as an explicit art-direction decision, use `banner-builder`, and keep the strict Matrix Layout policy. Record the starter mapping for palette, typography, spacing, button hierarchy, imagery, and contrast; it should reference the original bundle's art direction without promising pixel parity. Other packages stay unchanged.

- [ ] **Step 4: Implement the branding clone**

Use `structuredClone`, patch theme ID, hero overlay, and first slide when present, and retain the input structural type. The concrete adapter later passes `DEFAULT_BRANDING`; this pure module stays Node-testable.

- [ ] **Step 5: Run and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/bannerBuilderSiteDefaults.test.ts
git add src/lib/sites/sitePackages.ts src/lib/sites/bannerBuilderSiteDefaults.ts src/lib/sites/bannerBuilderSiteDefaults.test.ts
git commit -m "feat: define Banner Builder native site defaults"
~~~

---

## Task 3: Secure Tenant and Idempotent Product RPCs

**Files:**
- Create: `src/lib/sites/platformSiteRpc.ts`
- Create: `src/lib/sites/platformSiteRpc.test.ts`
- Create: `src/lib/sites/platformSiteMigration.test.ts`
- Create: `supabase/migrations/20260715210000_independent_site_provisioning.sql`
- Create: `scripts/check-independent-site-provisioning-db.mjs`
- Create: `scripts/sql/independent-site-provisioning-integration.sql`
- Modify: `package.json`

**Interfaces:**
- Adds `normalizePlatformSiteInput()`, `createPlatformSiteFromPackage()`, and `provisionSiteStandardProduct()`.
- Adds SQL RPCs `public.create_platform_site_from_package(text,text,text,text)` and `public.provision_site_standard_product(uuid,uuid,text)`.
- Uses narrow local JSON result validators; generated Supabase types remain untouched.
- Adds `public.tenants.settings_version bigint NOT NULL DEFAULT 0` plus a private trigger that increments it for every changed settings value; this is concurrency infrastructure, not a third callable feature RPC.

- [ ] **Step 1: Write failing client and static migration tests**

Cover protocol/path/trailing-dot normalization, invalid names/domains/emails, root/master-domain rejection, exact RPC argument names, resumed tenant results, malformed response rejection, and product result validation. The static migration test must assert both signatures, master authorization, package allowlist, ordered domain/tenant/source/package locks, a target slug-namespace lock or bounded `unique_violation` retry, versioned provenance normalization, Matrix Layout/generic-price checks, POD v1/v2 exclusion, existing clone call, technical-spec merge rather than replacement, the private settings-version trigger, explicit grants/revokes, and rollback.

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteRpc.test.ts src/lib/sites/platformSiteMigration.test.ts
~~~

- [ ] **Step 3: Implement secure tenant creation**

The SQL function must require `auth.uid()` plus exact `master_admin`, allow only Banner Builder, normalize/validate inputs, lock by normalized domain, reject platform/master domains, and return an existing tenant only when it is platform-owned with matching package provenance. Otherwise insert one tenant with `owner_id = auth.uid()`, `is_platform_owned = true`, and initial native/draft/creating settings. Partial retry increments attempt while preserving completed stages and product results. Return a stable tenant ID plus `created`. The migration also adds the monotonic `settings_version` column and a private `BEFORE UPDATE OF settings` trigger; the trigger function has no Data API exposure and has execute revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.

- [ ] **Step 4: Implement atomic product provisioning**

Server-side invariants:

~~~sql
source.tenant_id = '00000000-0000-0000-0000-000000000000'
source.is_published IS TRUE
source.is_ready IS TRUE
source.pricing_structure ->> 'mode' = 'matrix_layout_v1'
EXISTS (SELECT 1 FROM public.generic_product_prices gp WHERE gp.product_id = source.id)
NOT EXISTS (SELECT 1 FROM public.pod_tenant_imports pi WHERE pi.product_id = source.id)
NOT EXISTS (SELECT 1 FROM public.pod2_tenant_imports pi WHERE pi.product_id = source.id)
~~~

Also validate package mapping and matching platform-owned target provenance. Acquire advisory locks in one documented global order and serialize the target tenant slug namespace before invoking the existing clone helper, so two different sources with colliding slugs cannot race through its check-then-insert loop. Return the existing provenance-stamped target or call `clone_product_for_tenant_release()` once and merge the provenance stamp into the new copy's existing `technical_specs`, preserving source site mappings and all unrelated keys. Return `{ targetProductId, created }`; leave the copy unpublished.

The provenance envelope is exactly version 1:

~~~json
{
  "site_provisioning": {
    "schema_version": 1,
    "package_id": "banner-builder-pro",
    "source_product_id": "uuid",
    "provisioned_at": "ISO-8601 timestamp"
  }
}
~~~

Normalize `technical_specs` only when it is a JSON object or a string parsing to a JSON object. Reject malformed JSON, arrays, and scalars. If matching provenance already points at a different source/package/schema, return a stable conflict code rather than overwriting it.

- [ ] **Step 5: Add exact exposure decisions**

For each signature revoke `PUBLIC` and `anon`, grant `authenticated` and `service_role`, and include the Data API decision comment. Both functions still perform their own master identity check. Feature rollback drops only these two callable functions and never deletes data. Keep the generic `settings_version` trigger/column during feature withdrawal because converted settings writers depend on it; remove that infrastructure only in a separately verified rollback that first removes every CAS client.

- [ ] **Step 6: Implement injected TypeScript RPC adapters**

Accept an `RpcCaller`, normalize before the call, validate returned JSON, and convert raw database failures to short operator-safe errors.

- [ ] **Step 7: Add release-blocking SQL integration proof**

The Node runner accepts only an isolated `INDEPENDENT_SITE_TEST_DATABASE_URL` (or a detected local Supabase test database), rejects linked/production-looking URLs, applies the migration in a transactionally reset fixture schema, and runs the SQL assertions. The SQL harness uses two independent database sessions to prove:

- unauthenticated and non-master callers are rejected;
- identical tenant requests converge on one tenant ID;
- identical product requests converge on one target product ID and one provenance envelope;
- two different mapped sources whose slugs collide both complete without uncaught uniqueness errors;
- source and copied generic price rows are byte-for-byte equal and the copy remains unpublished;
- a concurrent branding/settings patch plus provisioning checkpoint retains both changes and increments `settings_version` monotonically;
- malformed/conflicting provenance fails with stable codes;
- transaction-time eligibility changes return `ineligible_at_copy` without a partial target product.

This check is mandatory in the controlled CI/release environment. An absent safe test database is a release blocker, not a passing skip.

- [ ] **Step 8: Verify and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteRpc.test.ts src/lib/sites/platformSiteMigration.test.ts
npm run check:supabase-grants
npm run check:supabase-functions
npm run check:independent-site-db
git add package.json scripts/check-independent-site-provisioning-db.mjs scripts/sql/independent-site-provisioning-integration.sql src/lib/sites/platformSiteRpc.ts src/lib/sites/platformSiteRpc.test.ts src/lib/sites/platformSiteMigration.test.ts supabase/migrations/20260715210000_independent_site_provisioning.sql
git commit -m "feat: add secure independent site provisioning RPCs"
~~~

---

## Task 4: Price-Safe Product Discovery

**Files:**
- Create: `src/lib/sites/platformSiteProducts.ts`
- Create: `src/lib/sites/platformSiteProducts.test.ts`

**Interfaces:**
- Produces `classifyPlatformSiteProduct()`, `classifyPlatformSiteProducts()`, and `discoverPlatformSiteProducts()`.
- Reuses `readProductSiteIds()` and returns both eligible products and excluded products with stable reasons.
- Reads price-row existence only; it never reads, changes, or recalculates price values.
- Every discovery returns an immutable preflight manifest with `policyVersion: 1`, `observedAt`, sorted eligible source IDs, reason counts, and a deterministic fingerprint. The manifest is advisory; the SQL wrapper rechecks all eligibility inside its transaction.

- [ ] **Step 1: Write one failing test per eligibility branch**

Cover wrong tenant, missing mapping, unpublished, not ready, POD v1 import, POD v2 import, non-Matrix Layout, STORFORMAT, missing generic price rows, and one eligible Matrix Layout product. Also prove `technical_specs` object and parseable-object-string forms work, malformed/array/scalar forms fail closed, sorted inputs produce the same fingerprint, changed eligibility changes the fingerprint, and the injected clock owns `observedAt`.

~~~ts
test("ready mapped non-POD Matrix Layout product is eligible", () => {
  const result = classifyPlatformSiteProduct({
    product: {
      id: "source-1",
      tenant_id: MASTER_TENANT_ID,
      name: "Banner",
      slug: "banner",
      is_published: true,
      is_ready: true,
      pricing_type: "matrix",
      pricing_structure: { mode: "matrix_layout_v1" },
      technical_specs: { site_frontends: { siteIds: ["banner-builder-pro"] } },
    },
    podV1ProductIds: new Set(),
    podV2ProductIds: new Set(),
    genericPriceProductIds: new Set(["source-1"]),
    packageId: "banner-builder-pro",
  });
  assert.deepEqual(result, { eligible: true, reason: null });
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteProducts.test.ts
~~~

- [ ] **Step 3: Implement pure classification**

Use stable exclusion reasons:

~~~ts
export type ProductExclusionReason =
  | "not_master_product"
  | "package_not_mapped"
  | "not_published"
  | "not_ready"
  | "pod_v1"
  | "pod_v2"
  | "unsupported_pricing"
  | "generic_prices_missing";
~~~

Check POD before pricing so POD products never appear as ordinary pricing warnings. Treat STORFORMAT as `unsupported_pricing`.

- [ ] **Step 4: Implement bounded Supabase discovery**

Read exact master-product columns, collect candidate IDs, then query `pod_tenant_imports`, `pod2_tenant_imports`, and `generic_product_prices` only for those IDs. Deduplicate IDs and feed the pure classifier. Return eligible rows, excluded rows, reason counts, and the preflight manifest. Treat the UI snapshot as stale after a documented five-minute TTL or any input change; never use the fingerprint as authorization.

- [ ] **Step 5: Run and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteProducts.test.ts
git add src/lib/sites/platformSiteProducts.ts src/lib/sites/platformSiteProducts.test.ts
git commit -m "feat: classify price-safe site products"
~~~

---

## Task 5: Durable Provisioning Orchestrator

**Files:**
- Create: `src/lib/sites/platformSiteProvisioning.ts`
- Create: `src/lib/sites/platformSiteProvisioning.test.ts`
- Modify: `src/lib/sites/installSitePackage.ts`

**Interfaces:**
- Produces `provisionIndependentSite()`, `acceptCopiedProductSubset()`, `SiteProvisioningDependencies`, `SiteProvisioningResult`, and progress callbacks.
- Fixed stages: `create_tenant → install_templates → apply_branding → discover_products → copy_products → finalize`.
- The pure orchestrator never imports the live Supabase client.
- Every run has a stable `operationId` and a fresh `attemptId`. Persisted diagnostics contain only stable error codes, failed stage/source ID, first/last timestamps, an operator-safe message, and optional correlation ID; raw database/supplier payloads never enter tenant settings.

- [ ] **Step 1: Write failing orchestration tests**

Fakes must record calls and settings snapshots. Required cases:

- exact success order and ready result;
- same-domain retry returns the original tenant ID;
- completed branding is skipped on retry and cannot overwrite later edits;
- template retry reports skips, not duplicates;
- every non-product failure stores `partial`, failed stage, and safe error;
- one product failure does not stop remaining eligible copies;
- repeated success returns the same target ID;
- exclusions are warnings, not copy failures;
- zero eligible/copied products leaves the tenant `partial` with an `eligible_products_missing` blocker instead of reporting a misleading ready result;
- explicit partial acceptance is allowed only with at least one copied/existing product;
- unrelated settings survive every checkpoint;
- attempt number comes from the creation RPC.
- stale preflight manifests never control copying; transaction-time `ineligible_at_copy` results are recorded as policy exclusions, not generic system failures;
- retries keep the original `operationId`, allocate a new `attemptId`, preserve `firstFailedAt`, advance `lastFailedAt`, and clear only diagnostics for work that later succeeds;
- readiness counts only committed copied/existing results and never trusts preflight eligible counts.

~~~ts
assert.deepEqual(progress, [
  "create_tenant",
  "install_templates",
  "apply_branding",
  "discover_products",
  "copy_products",
  "finalize",
]);
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteProvisioning.test.ts
~~~

- [ ] **Step 3: Export pure template helpers**

Export the existing desired-row builder and natural-key builder from `installSitePackage.ts`. Preserve `installSitePackageTemplates()` behavior and existing callers. Do not add a database uniqueness constraint in this slice; sequential retries remain the supported contract.

- [ ] **Step 4: Implement the injected dependency contract**

~~~ts
export interface SiteProvisioningDependencies {
  createTenant(input: PlatformSiteInput): Promise<PlatformSiteTenantResult>;
  readTenantSettings(tenantId: string): Promise<Record<string, unknown>>;
  writeTenantSettings(tenantId: string, settings: Record<string, unknown>): Promise<void>;
  installTemplates(sitePackage: SitePackage, tenantId: string): Promise<SiteInstallSummary>;
  buildStarterBranding(sitePackage: SitePackage): unknown;
  discoverProducts(packageId: string): Promise<PlatformSiteProductDiscovery>;
  provisionProduct(sourceProductId: string, tenantId: string, packageId: string): Promise<PlatformProductRpcResult>;
  now(): string;
  createId(kind: "operation" | "attempt"): string;
}
~~~

Branding and the `apply_branding` completion marker are one tenant-settings update. Template writes may precede their marker because natural-key retry is safe.

- [ ] **Step 5: Implement recoverable copy behavior**

Continue through every eligible product after individual failures and checkpoint `productResults`. Normalize wrapper results into `copied`, `existing`, `ineligible_at_copy`, or `failed`; only the last category is an unexpected copy failure. Return `partial` if any unexpected copy fails or if discovery produces no committed copied/existing product. Use the stable `eligible_products_missing` blocker for the zero-product case. `acceptCopiedProductSubset()` may set ready only when failed stage is `copy_products`, at least one result is copied/existing, all earlier stages completed, and the operator explicitly invokes it. Record `acceptedProductFailuresAt` and retain warnings. Persist structured diagnostics rather than concatenated exception strings.

- [ ] **Step 6: Implement finalization**

Merge rather than replace settings: set active package, add installed package ID, set native render mode, retain draft launch, store ready/completion timestamps, and store the template summary. Never publish branding/products as a side effect.

- [ ] **Step 7: Run all domain tests and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/sites/bannerBuilderSiteDefaults.test.ts src/lib/sites/platformSiteRpc.test.ts src/lib/sites/platformSiteProducts.test.ts src/lib/sites/platformSiteProvisioning.test.ts
git add src/lib/sites/platformSiteProvisioning.ts src/lib/sites/platformSiteProvisioning.test.ts src/lib/sites/installSitePackage.ts
git commit -m "feat: orchestrate recoverable site provisioning"
~~~

---

## Task 6: Concrete Supabase Provisioning Dependencies

**Files:**
- Create: `src/lib/sites/platformSiteProvisioningSupabase.ts`
- Modify: `src/lib/sites/platformSiteProvisioning.test.ts`
- Modify: `src/pages/admin/SitesAdmin.tsx`
- Modify: `src/components/admin/SiteDesignEditorV2.tsx`
- Modify: `src/hooks/useBrandingDraft.ts`
- Modify: `src/hooks/useBrandingHistory.ts`
- Modify: `src/components/admin/AiSeoManager.tsx`
- Modify: `src/components/admin/ShopSettings.tsx`
- Modify: `src/lib/branding/master-adapter.ts`
- Modify: `src/lib/branding/tenant-adapter.ts`

**Interfaces:**
- Produces `createSupabasePlatformSiteProvisioningDependencies()` and `provisionBannerBuilderSite()`.
- Wires the tested RPC adapter, product discovery, template installer, `DEFAULT_BRANDING`, and settings updates.
- Keeps database calls out of `SitesAdmin.tsx`.
- Converts every active whole-JSON tenant settings writer found by the repository audit to the shared CAS patch contract so provisioning cannot lose a simultaneous branding, SEO, shop-settings, or Site Design save.

- [ ] **Step 1: Add a failing concrete-wiring contract test**

Inject a Supabase-like client and assert exact calls for versioned settings read/CAS write, both RPC names, template tenant ID, and branding baseline. Prove every write targets the tenant returned by creation, never the master tenant. Add a shared writer-contract test/fake that forces one concurrent save through each converted writer family and proves both narrow patches survive.

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteProvisioning.test.ts
~~~

- [ ] **Step 3: Implement the concrete factory**

Use `(supabase as any)` only at the new-RPC boundary. Call the existing template installer, pass `DEFAULT_BRANDING` to the pure starter builder, and store the result as both `settings.branding.draft` and `settings.branding.published` while preserving history/saved designs. Use `patchTenantSettingsCas()` for each narrow checkpoint; do not keep a stale whole settings snapshot across awaits. Sanitize database errors.

- [ ] **Step 4: Convert all audited settings writers**

Replace direct `.update({ settings: ... })` calls in Sites, Site Design V2, branding draft/history, AI SEO, Shop Settings, and both branding adapters with fresh-snapshot CAS patches. Preserve each writer's current UI behavior and mutation scope. Add a static test or release audit command requiring zero direct whole-settings updates outside the CAS helper and explicitly documented migrations/tests.

- [ ] **Step 5: Verify and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/platformSiteProvisioning.test.ts src/lib/tenants/tenantSettingsCas.test.ts
npx eslint src/lib/sites/platformSiteProvisioningSupabase.ts src/lib/tenants/tenantSettingsCas.ts src/pages/admin/SitesAdmin.tsx src/components/admin/SiteDesignEditorV2.tsx src/hooks/useBrandingDraft.ts src/hooks/useBrandingHistory.ts src/components/admin/AiSeoManager.tsx src/components/admin/ShopSettings.tsx src/lib/branding/master-adapter.ts src/lib/branding/tenant-adapter.ts
! rg -n -U '\.update\(\s*\{\s*settings\s*:' src --glob '!src/lib/tenants/tenantSettingsCas.ts'
git add src/lib/sites/platformSiteProvisioningSupabase.ts src/lib/sites/platformSiteProvisioning.test.ts src/pages/admin/SitesAdmin.tsx src/components/admin/SiteDesignEditorV2.tsx src/hooks/useBrandingDraft.ts src/hooks/useBrandingHistory.ts src/components/admin/AiSeoManager.tsx src/components/admin/ShopSettings.tsx src/lib/branding/master-adapter.ts src/lib/branding/tenant-adapter.ts
git commit -m "feat: wire Supabase site provisioning"
~~~

---

## Task 7: Master Admin Preflight, Creation, Progress, Resume, and Result UI

**Files:**
- Create: `src/lib/sites/siteAdminLinks.ts`
- Create: `src/lib/sites/siteAdminLinks.test.ts`
- Create: `src/components/admin/sites/CreateIndependentSiteDialog.tsx`
- Modify: `src/pages/admin/SitesAdmin.tsx`

**Interfaces:**
- Produces force-domain-safe admin and native/original preview URLs.
- Exposes `Opret som selvstændigt site` only on the central master tenant for native packages.
- UI delegates to the provisioning service and never issues table/RPC calls directly.
- Treats the domain field as a WebPrinter subdomain slug, always showing the normalized final hostname; optional email is labelled as the public shop contact and never implies ownership transfer or an invitation.

- [ ] **Step 1: Write failing link and preview tests**

~~~ts
test("native result links preserve the created tenant domain", () => {
  assert.equal(
    buildTenantAdminUrl("/admin/site-design-v2", "banner.webprinter.dk"),
    "/admin/site-design-v2?force_domain=banner.webprinter.dk",
  );
  assert.match(buildNativeSitePreviewUrl("tenant-1"), /preview_mode=1/);
  assert.match(buildNativeSitePreviewUrl("tenant-1"), /draft=1/);
  assert.doesNotMatch(buildNativeSitePreviewUrl("tenant-1"), /sitePreview=1/);
});

test("original package preview requests bundle mode", () => {
  assert.match(buildOriginalPackagePreviewUrl("master", "banner-builder-pro"), /sitePreview=1/);
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteAdminLinks.test.ts
~~~

- [ ] **Step 3: Implement context-safe URLs**

Use `URLSearchParams`, preserve existing query values, and encode domains. Native preview is `/preview-shop?preview_mode=1&draft=1&tenantId=<id>&page=%2F` without `sitePreview`, so authorized operators see the current editable draft branding; original preview includes site ID plus `sitePreview=1`.

- [ ] **Step 4: Build a read-only preflight before creation**

Fields: required shop name and subdomain slug plus optional public shop-contact email. Normalize and show the exact final hostname. Before enabling creation, run a master-only read-only preflight that shows domain validity/availability, template count, `X produkter kan kopieres`, excluded counts grouped by stable reason, `observedAt`, and the manifest fingerprint. The create RPC remains the authoritative conflict check, so mark counts as advisory and recalculate them during provisioning. Define loading, five-minute stale, input-changed, error, retry, and zero-eligible states. A stale/error preflight must be refreshed before creation. Zero eligible products blocks the normal action. Put `Sitet oprettes som kladde` and `Priser ændres ikke` next to the primary action, labelled `Opret kladdesite og kopiér X produkter`.

- [ ] **Step 5: Build persistent progress, recovery, and result hierarchy**

Render all six stages with textual `venter / arbejder / færdig / advarsel / fejl` status, committed counts, the current operation, and the exact retry point in an `aria-live="polite"` region. If transaction-time eligibility differs from preflight, show the product under policy exclusions as `Ikke længere kvalificeret ved kopiering` and use committed outcomes for readiness. A failed post-tenant run retains the tenant and explains what retry preserves, for example `Fortsætter fra Produktkopiering. Site, design og 3 kopierede produkter bevares.` Show only operator-safe error copy plus an optional correlation ID, while retaining operation/attempt/error-code diagnostics for support. Keep partial work visible after dialog dismissal/reload through the created tenant's Sites card and `Fortsæt opsætning`; opening the forced tenant context resumes the same tenant instead of restarting.

The terminal success heading is `Kladdesite oprettet`, never a generic celebration. Present one ordered handoff: 1) tilpas design, 2) gennemgå og publicer produkter, 3) forhåndsvis kladdesitet, 4) gør websitet offentligt. Use one contextual primary action and secondary links. For partial results, separate copied, policy-excluded, and unexpectedly failed products. Replace `Fortsæt med kopierede produkter` with `Accepter X kopierede produkter og fortsæt`; show the omitted count, state that the site remains private, require confirmation, and never enable acceptance with zero copied/existing products.

- [ ] **Step 6: Wire the master card without disturbing legacy controls**

Fix `SitesAdmin.refreshTenant()` to use the tenant ID returned by `resolveAdminTenant()` even for a master admin. Show create only for master tenant plus native package. Demote the compiled bundle under `Original designreference` with the explanation `Visuel reference — ikke din webshop, kan ikke redigeres og afspejler ikke dine ændringer.` Make `Forhåndsvis kladdesite` the dominant preview after tenant creation. Retain legacy activate/install behavior, use context-safe URLs for forced tenants, surface `Fortsæt opsætning` for persisted `creating/partial` state, and refresh after success/acceptance.

- [ ] **Step 7: Meet interaction, responsive, and accessibility acceptance criteria**

Reuse the existing Radix/shadcn dialog, alert-dialog, form, button, badge, toast, focus, spacing, and validation patterns; introduce no installer-only modal primitive or status palette. At widths below 640 px use a full-height sheet/dialog with one bounded scrolling body and sticky action footer; verify 390, 768, and 1440 px plus 200% zoom with no horizontal scroll. Define initial focus, focus trap, Escape/dismiss behavior, return focus, focus on the first invalid field and terminal heading, `role="alert"` for failures, text/icon status independent of color, reduced-motion behavior, 44×44 px targets, contrast, long-domain/product wrapping, and keyboard-only completion.

- [ ] **Step 8: Verify and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteAdminLinks.test.ts
npx eslint src/lib/sites/siteAdminLinks.ts src/components/admin/sites/CreateIndependentSiteDialog.tsx src/pages/admin/SitesAdmin.tsx
npm run build
git add src/lib/sites/siteAdminLinks.ts src/lib/sites/siteAdminLinks.test.ts src/components/admin/sites/CreateIndependentSiteDialog.tsx src/pages/admin/SitesAdmin.tsx
git commit -m "feat: add independent site creation workflow"
~~~

---

## Task 8: Native Rendering and Fail-Closed Draft Guard

**Files:**
- Create: `src/lib/sites/storefrontLaunch.ts`
- Create: `src/lib/sites/storefrontLaunch.test.ts`
- Create: `src/lib/sites/storefrontRuntimeCapabilities.ts`
- Create: `src/lib/sites/storefrontRuntimeCapabilities.test.ts`
- Create: `src/components/storefront/StorefrontLaunchGuard.tsx`
- Create: `src/components/storefront/StorefrontDraftPage.tsx`
- Modify: `src/lib/storefront/seo.ts`
- Modify: `src/hooks/useShopSettings.ts`
- Modify: `src/pages/Shop.tsx`
- Modify: `src/pages/PreviewShop.tsx`
- Modify: `src/App.tsx`
- Modify: `api/tenant-shell.ts`
- Modify: `api/sitemap.ts`
- Modify: `api/robots.ts`
- Modify: `api/llms.ts`

**Interfaces:**
- Produces `resolveStorefrontPackageRuntime()`, `decideStorefrontLaunch()`, and tenant-resolution provenance.
- Missing render mode preserves the current package-bundle branch; native mode uses the normal tenant storefront.
- Draft/fallback decisions never trust query parameters.
- Produces one host/state-based `resolveStorefrontPublicExposure()` decision consumed by React and all four edge endpoints.
- Produces immutable `StorefrontRuntimeCapabilities`; native preview sets `preview: true` and every mutation capability to `false`.

- [ ] **Step 1: Write failing runtime and security tests**

Cover active package plus missing mode => legacy package; native mode => native storefront; no active package => normal storefront; platform context => allow; resolved draft => block; resolved live or missing launch status => allow; unresolved/fallback non-platform host => fail closed; query values do not change the decision.

Export and test a complete route classifier against every route declared in `App.tsx`. On a tenant host, public root/catalog/product/configuration/designer/contact/about/terms/privacy/guidance plus sitemap/robots/llms discovery are draft-blocked; authenticated customer account/order/profile routes are classified explicitly and cannot fall through accidentally. Platform marketing/legal/signup, auth, admin, and authorized preview are explicit non-public-tenant classes. A test fails whenever an `App.tsx` route is absent from the classification fixture.

Capability tests require this exact preview contract:

~~~ts
{
  preview: true,
  allowPayment: false,
  allowOrderCreation: false,
  allowFileUpload: false,
  allowDesignerSave: false,
  allowCartPersistence: false,
  allowExternalLaunch: false,
}
~~~

Test each mutation adapter/handler with spies and prove it rejects before any network/storage call when the capability is false.

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/storefrontLaunch.test.ts src/lib/sites/storefrontRuntimeCapabilities.test.ts
~~~

- [ ] **Step 3: Add resolution provenance to shop settings**

Add internal normalized metadata:

~~~ts
_tenantResolution: {
  status: "resolved" | "fallback" | "not_found";
  requestedHost: string;
}
~~~

Successful ID/domain/subdomain/master lookups are resolved. Cold transport fallback is fallback. A non-platform custom host reaching master fallback is not-found. Reuse cache only when it matches the requested domain/tenant. Do not change public tenant data.

- [ ] **Step 4: Implement pure decisions and distinct standalone state variants**

The guard checks platform context, route class, resolution, loading/error, then draft. It never reads search parameters. Before tenant resolution, render one stable neutral full-page loading surface with no storefront or master-branding flash. A verified draft may render tenant name, logo, primary color, and calm `Vi gør siden klar` copy, but must not render `StorefrontThemeFrame`, navigation, products, checkout controls, or deep links. A transport/fallback error uses neutral platform treatment plus retry and reveals no tenant data unless resolution was verified. An unknown domain uses an unbranded generic unavailable/not-found state. Back/forward navigation retains the resolved decision.

- [ ] **Step 5: Guard every tenant route and edge discovery surface**

Apply the classifier to `/`, `/local-tenant`, `/produkter`, `/shop`, `/prisberegner`, `/produkt/:slug`, `/checkout/konfigurer`, `/canva-return`, `/designer`, `/designer/:variantId`, `/kontakt`, `/om-os`, `/betingelser`, `/vilkaar`, `/privatliv`, and `/grafisk-vejledning` so a verified draft tenant gets the same preparation page everywhere. Keep `/platform`, platform marketing/legal, signup, auth, `/admin/*`, and authorized preview outside the public tenant gate. Classify account/profile/order routes explicitly and preserve their authenticated behavior only after proving they cannot render public draft commerce or tenant SEO.

In `tenant-shell`, verified native draft returns the generic SPA shell with `noindex,nofollow` and no tenant title, description, canonical, OpenGraph, favicon, structured data, or page override. Draft `sitemap.xml` returns an empty tenant urlset, draft `robots.txt` returns `Disallow: /` without a sitemap, and draft `llms.txt` returns 404 with generic copy. `force_domain` and all other query parameters are ignored by public edge tenant selection; only the actual forwarded/host header is authoritative. Platform-root and legacy/live behavior remain unchanged. Use the same pure public-exposure decision in all paths.

- [ ] **Step 6: Switch Shop runtime selection**

Replace the implicit live-host package check with the tested resolver. Render `SitePackagePreview` only for legacy package mode. Native mode falls through to existing storefront components and retains active-site product filtering.

The authenticated native preview is the real editable tenant surface but remains non-transactional. Construct the immutable preview capability object before rendering and require every payment, order, upload/submission, designer-save, cart-persistence, and external-launch adapter/handler to assert its capability before side effects. Virtual product/configuration and checkout representations may render. Disabled-looking controls are supplementary, never the security boundary. The original bundle remains a static non-commerce design reference.

- [ ] **Step 7: Verify and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/storefrontLaunch.test.ts src/lib/sites/storefrontRuntimeCapabilities.test.ts
npx eslint src/lib/sites/storefrontLaunch.ts src/lib/sites/storefrontRuntimeCapabilities.ts src/components/storefront/StorefrontLaunchGuard.tsx src/components/storefront/StorefrontDraftPage.tsx src/lib/storefront/seo.ts src/hooks/useShopSettings.ts src/pages/Shop.tsx src/pages/PreviewShop.tsx src/App.tsx api/tenant-shell.ts api/sitemap.ts api/robots.ts api/llms.ts
npm run build
git add src/lib/sites/storefrontLaunch.ts src/lib/sites/storefrontLaunch.test.ts src/lib/sites/storefrontRuntimeCapabilities.ts src/lib/sites/storefrontRuntimeCapabilities.test.ts src/components/storefront/StorefrontLaunchGuard.tsx src/components/storefront/StorefrontDraftPage.tsx src/lib/storefront/seo.ts src/hooks/useShopSettings.ts src/pages/Shop.tsx src/pages/PreviewShop.tsx src/App.tsx api/tenant-shell.ts api/sitemap.ts api/robots.ts api/llms.ts
git commit -m "feat: gate draft native storefronts"
~~~

---

## Task 9: Preview Authorization, Go Live, and Tenant Management

**Files:**
- Modify: `src/pages/PreviewShop.tsx`
- Modify: `src/pages/admin/SitesAdmin.tsx`
- Modify: `src/components/admin/TenantOverview.tsx`
- Modify: `src/lib/sites/siteFrontendState.test.ts`
- Modify: `src/lib/sites/siteAdminLinks.test.ts`

**Interfaces:**
- Every preview mode requires an authenticated admin who is authorized for the requested tenant; only a true master admin may preview an arbitrary tenant.
- Native Go Live changes only launch status after readiness checks.
- Tenant overview labels platform-owned shops draft/live and preserves forced context.

- [ ] **Step 1: Extend failing tests**

Prove unpublished copies block Go Live; partial provisioning blocks unless product failures were explicitly accepted; templates, live address, and one published mapped product are required; the live patch retains package/provisioning data; a regular admin cannot preview an arbitrary `tenantId`; a master admin can preview the created tenant; platform-owned manage URLs target `/admin/sites?force_domain=...`; legacy status stays active.

- [ ] **Step 2: Run and verify RED**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/sites/siteAdminLinks.test.ts
~~~

- [ ] **Step 3: Close preview query authorization bypass**

Remove `isPreviewContext` from the authorization exception in `PreviewShop.tsx`. After role loading, every non-admin request redirects to `/auth`, including `preview_mode=1`, `draft=1`, `sitePreview=1`, and iframe loads. Resolve the requested tenant before loading branding/products: allow it when the server-verified role is `master_admin`, or when it equals the regular admin's resolved/owned tenant; otherwise redirect to the authorized admin context and render no requested-tenant data. Keep the internal customer-route allowlist after tenant authorization.

- [ ] **Step 4: Make native Go Live explicit and consequence-clear**

Count published mapped products separately. For native sites call tested readiness and show a confirmation with the exact public domain, passed readiness checklist, published-product count, published design version/timestamp, an explicit warning when draft branding differs from published branding, and the statement `Dette gør webshoppen offentligt tilgængelig. Det publicerer ikke design eller produkter og markerer ikke kommerciel lancering som gennemført.` Require acknowledgement and an explicit `Gå live på <domain>` action. Persist only `{ activeSiteId, launchStatus: "live" }`. For legacy packages preserve existing behavior. Never publish a product or branding during Go Live. After success show `Besøg live site`, `Administrer`, and a separate commercial-release checklist/status.

- [ ] **Step 5: Add platform-owned status and manage link**

Select settings and `is_platform_owned` in Tenant Overview. Display `Kladde` for native draft, `Live` for native live, and current status for legacy. Add context-safe `Administrer`; keep `Besøg` separate.

- [ ] **Step 6: Verify and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/sites/siteAdminLinks.test.ts
npx eslint src/pages/PreviewShop.tsx src/pages/admin/SitesAdmin.tsx src/components/admin/TenantOverview.tsx
npm run build
git add src/pages/PreviewShop.tsx src/pages/admin/SitesAdmin.tsx src/components/admin/TenantOverview.tsx src/lib/sites/siteFrontendState.test.ts src/lib/sites/siteAdminLinks.test.ts
git commit -m "feat: secure preview and native site launch"
~~~

---

## Task 10: Browser Proof and Regression Coverage

**Files:**
- Modify: `scripts/check-tenant-proof-routes.mjs`
- Modify: `src/lib/sites/storefrontLaunch.test.ts`
- Modify: `src/lib/sites/storefrontRuntimeCapabilities.test.ts`
- Modify: `src/lib/sites/platformSiteProvisioning.test.ts`

**Interfaces:**
- Keeps current commercial/tenant proof routes intact.
- Adds conditional read-only proof using configured independent-site fixtures.
- Never creates, publishes, or mutates production data from proof scripts.

- [ ] **Step 1: Add failing proof bindings**

Require the script to identify `Original designreference`, native creation action, native preview without `sitePreview=1`, draft guard text when a fixture is configured, and unauthenticated preview redirect/login behavior. Bind every declared App route to the route-classification fixture and bind tenant shell, sitemap, robots, and llms handlers to the shared public-exposure decision.

- [ ] **Step 2: Add conditional fixture proof**

Use `BANNER_NATIVE_DRAFT_URL` and `BANNER_NATIVE_LIVE_URL`. When absent, print `SKIP: independent site fixture not configured` while still running all legacy proofs. When present verify:

1. original bundle loads;
2. draft root and every classified tenant route (including contact, about, legal, privacy, and guidance) are gated;
3. public `preview_mode=1` cannot bypass;
4. unauthenticated preview does not render tenant content;
5. authenticated native preview renders native branding with no package iframe; a browser request/storage spy records zero POST/PUT/PATCH/DELETE requests and zero cart persistence while payment, order, file upload/submission, designer save, and external launch actions are exercised;
6. draft HTML contains generic `noindex,nofollow` metadata and no tenant identity, draft sitemap contains no tenant URLs, robots disallows all, and llms returns no tenant content;
7. adding `force_domain` or preview/draft query values to sitemap, robots, llms, shell, or tenant routes does not change the actual-host decision;
8. live fixture renders native storefront, tenant metadata/discovery, and tenant-context product links;
9. Webprinter, Salgsmapper, and Onlinetryksager proofs remain intact.

- [ ] **Step 3: Run tests/proofs and commit**

~~~bash
node --test --experimental-strip-types src/lib/sites/*.test.ts src/lib/tenants/tenantSettingsCas.test.ts
npm run check:tenant-proof
npm run check:commercial-proof
git add scripts/check-tenant-proof-routes.mjs src/lib/sites/storefrontLaunch.test.ts src/lib/sites/platformSiteProvisioning.test.ts
git commit -m "test: prove independent Banner Builder routing"
~~~

If credentials/fixtures are unavailable, record the explicit skip and close it with the controlled smoke in Task 12 before release.

---

## Task 11: System Documentation, Maintainer Quick Start, and Rollback

**Files:**
- Modify: `SYSTEM_OVERVIEW.md`
- Modify: `AI_CONTINUITY.md`
- Modify: `docs/superpowers/specs/2026-07-15-banner-builder-independent-site-design.md`
- Create: `docs/INDEPENDENT_SITE_INSTALLER.md`
- Create: `scripts/independent-site-doctor.mjs`
- Create: `scripts/independent-site-doctor.test.mjs`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Documents settings, security, eligibility, recovery, preview/live distinction, and rollback.
- Does not claim STORFORMAT or POD support.
- Gives a new maintainer one discoverable entrypoint, expected output, stable error-code fixes, and a three-action path to the first safe green check.

- [ ] **Step 1: Update system overview**

Document original-preview/native-runtime separation, both RPCs, master checks/grants, versioned provenance, staged checkpoints/diagnostics, settings CAS, explicit partial acceptance, Matrix Layout-only copy, STORFORMAT exclusion, React plus edge draft isolation, preview capability boundary/auth, legacy compatibility, and containment-first rollback.

- [ ] **Step 2: Update continuity**

Record implemented files, migration, test evidence, conditional proof skips, and the next safe extension. State STORFORMAT copy needs a separately approved protected pricing-copy project.

- [ ] **Step 3: Write the maintainer quick start and failing doctor tests**

Add one short `README.md` link to `docs/INDEPENDENT_SITE_INSTALLER.md`. The runbook starts with this exact time-budgeted path:

~~~bash
npm install                              # only when dependencies are absent
npm run independent-site:doctor         # prerequisite map + exact NEXT command
npm run check:independent-site:fast      # first safe green result, target <5 min
~~~

Define expected output, required/optional environment variables, how to obtain a local isolated Supabase URL, how the safe-database detector rejects linked/production-looking hosts, and the difference between fast, full, and release gates. Include architecture/data diagrams, stable error-code table (`code`, cause, retained work, exact fix), operation/attempt correlation, package-extension checklist, migration/compatibility notes, commercial-release distinction, and containment-first rollback.

Write doctor tests before the script. Inject environment and command probes; never inspect real secrets in tests. Required output lines are `PASS`, `BLOCKED`, and exactly one `NEXT <command>`. Normal mode exits nonzero only when the first fast check cannot run; missing DB/browser release prerequisites are clearly `BLOCKED` but point to setup. `--strict` exits nonzero for any missing release prerequisite. `--json` emits the same result schema for CI without including credentials.

- [ ] **Step 4: Add one command hierarchy**

Add package scripts:

~~~text
independent-site:doctor          prerequisite diagnosis
independent-site:doctor:strict   release prerequisite gate
check:independent-site:fast      focused unit/static/grant checks (<5 min target)
check:independent-site           fast + isolated DB + production build
check:independent-site:release   full + browser proofs; controlled smoke remains manual
~~~

Every command prints elapsed time, pass/block/fail summary, and one next action. The aggregate commands are non-interactive and CI-safe. They never connect to a linked project implicitly and never create/publish a tenant.

- [ ] **Step 5: Reconcile approved spec and commit**

Keep approved status and ensure it includes completed stages/results, preview auth/capabilities, fail-closed React and edge resolution, versioned provenance, transaction-time recheck, settings CAS, mandatory two-session SQL proof, and Matrix Layout-only copy. Rollback order is: first set every affected tenant to draft and verify edge/browser containment; then hide create/Go Live actions; then withdraw UI/runtime code; only then revoke/drop the two feature RPCs. Never remove the draft guard while a native draft tenant depends on it. Retain generic settings-version infrastructure unless all CAS clients are separately rolled back and verified.

~~~bash
rg -n "STORFORMAT|matrix_layout_v1|launchStatus|provision_site_standard_product|Rollback" SYSTEM_OVERVIEW.md AI_CONTINUITY.md docs/superpowers/specs/2026-07-15-banner-builder-independent-site-design.md
node --test scripts/independent-site-doctor.test.mjs
npm run independent-site:doctor
git diff --check -- README.md docs/INDEPENDENT_SITE_INSTALLER.md SYSTEM_OVERVIEW.md AI_CONTINUITY.md docs/superpowers/specs/2026-07-15-banner-builder-independent-site-design.md scripts/independent-site-doctor.mjs scripts/independent-site-doctor.test.mjs package.json
git add README.md docs/INDEPENDENT_SITE_INSTALLER.md SYSTEM_OVERVIEW.md AI_CONTINUITY.md docs/superpowers/specs/2026-07-15-banner-builder-independent-site-design.md scripts/independent-site-doctor.mjs scripts/independent-site-doctor.test.mjs package.json
git commit -m "docs: document independent Banner Builder sites"
~~~

---

## Task 12: Final Verification and Controlled Smoke

**Files:**
- Verify every file above; modify no unrelated dirty-worktree file.

**Interfaces:**
- Produces fresh evidence for unit behavior, grants, build, legacy regression, retry, preview, and Go Live.
- Completion requires an acceptance-criterion audit, not merely a green build.
- Records time-to-first-green and each gate duration so the post-ship DX review can compare reality with the under-five-minute target.

- [ ] **Step 0: Run the maintainer doctor**

~~~bash
node --test scripts/independent-site-doctor.test.mjs
npm run independent-site:doctor
~~~

Confirm the output contains no connection string/key, reports each missing release prerequisite as `BLOCKED`, and gives exactly one valid `NEXT` command.

- [ ] **Step 1: Run all focused tests together**

~~~bash
node --test --experimental-strip-types src/lib/sites/siteFrontendState.test.ts src/lib/tenants/tenantSettingsCas.test.ts src/lib/sites/bannerBuilderSiteDefaults.test.ts src/lib/sites/platformSiteRpc.test.ts src/lib/sites/platformSiteMigration.test.ts src/lib/sites/platformSiteProducts.test.ts src/lib/sites/platformSiteProvisioning.test.ts src/lib/sites/siteAdminLinks.test.ts src/lib/sites/storefrontLaunch.test.ts src/lib/sites/storefrontRuntimeCapabilities.test.ts
~~~

Expected: all PASS with zero skipped unit tests.

Also run the aggregated fast path and record elapsed time:

~~~bash
npm run check:independent-site:fast
~~~

Target: under five minutes on the supported maintainer environment.

- [ ] **Step 2: Run exposure checks**

~~~bash
npm run check:supabase-grants
npm run check:supabase-functions
npm run check:independent-site-db
~~~

The database command must run against the isolated controlled test database and pass its two-session concurrency cases. Missing safe database configuration blocks release; do not record it as a passing skip.

- [ ] **Step 3: Run focused lint, build, and whitespace checks**

~~~bash
npx eslint src/lib/sites/siteFrontendState.ts src/lib/tenants/tenantSettingsCas.ts src/lib/sites/bannerBuilderSiteDefaults.ts src/lib/sites/platformSiteRpc.ts src/lib/sites/platformSiteProducts.ts src/lib/sites/platformSiteProvisioning.ts src/lib/sites/platformSiteProvisioningSupabase.ts src/lib/sites/siteAdminLinks.ts src/lib/sites/storefrontLaunch.ts src/lib/sites/storefrontRuntimeCapabilities.ts src/components/admin/sites/CreateIndependentSiteDialog.tsx src/components/storefront/StorefrontLaunchGuard.tsx src/components/storefront/StorefrontDraftPage.tsx src/lib/storefront/seo.ts src/pages/admin/SitesAdmin.tsx src/components/admin/TenantOverview.tsx src/pages/Shop.tsx src/pages/PreviewShop.tsx src/hooks/useShopSettings.ts src/hooks/useBrandingDraft.ts src/hooks/useBrandingHistory.ts src/components/admin/AiSeoManager.tsx src/components/admin/ShopSettings.tsx src/lib/branding/master-adapter.ts src/lib/branding/tenant-adapter.ts src/App.tsx api/tenant-shell.ts api/sitemap.ts api/robots.ts api/llms.ts
! rg -n -U '\.update\(\s*\{\s*settings\s*:' src --glob '!src/lib/tenants/tenantSettingsCas.ts'
npm run build
git diff --check
~~~

Separate pre-existing unrelated failures with exact evidence; do not claim success while a new-file failure remains.

- [ ] **Step 4: Run browser regressions**

~~~bash
npm run check:tenant-proof
npm run check:commercial-proof
~~~

Existing proofs must pass. An independent-fixture skip must be closed by Step 5 before release.

Also run the aggregate release gate after fixture configuration:

~~~bash
npm run independent-site:doctor:strict
npm run check:independent-site:release
~~~

- [ ] **Step 5: Perform controlled master-admin smoke**

On a non-production or explicitly approved Webprinter subdomain:

1. open central Sites as master admin and confirm only Banner Builder offers independent creation;
2. create draft and record tenant ID;
3. retry and prove same ID, no duplicate templates, and no duplicate source provenance;
4. confirm STORFORMAT/POD exclusions and unchanged source/copied generic price values;
5. open Site Design V2 through forced domain, edit hero copy, save, retry, and prove edit persists;
6. confirm public root, all deep commerce routes, contact/about/legal/privacy/guidance routes, HTML metadata, sitemap, robots, and llms remain gated; query `force_domain`, preview, and draft values do not bypass actual-host resolution;
7. confirm preview query requires auth and authenticated native preview works;
8. manually publish one copied mapped product;
9. prove Go Live blocked before publication and allowed after all checks;
10. publish or explicitly retain the intended Site Design V2 branding and confirm the operator is warned when draft branding differs from published branding;
11. explicitly Go Live and complete one real price-safe product through configuration/designer, checkout, order creation, notification/production-file visibility, and production handoff with price parity recorded;
12. verify payment choice, delivery behavior, company/legal identity, support contact, and analytics/consent before treating technical Go Live as commercially released;
13. verify the installer and Go Live dialogs at 390/768/1440 px, 200% zoom, keyboard-only, reduced motion, and screen-reader announcements; verify loading/draft/error variants never flash another tenant's branding;
14. exercise every native-preview commerce control while recording browser network and storage writes; confirm all mutation-capability checks reject and zero payment/order/upload/designer-save/cart/external-launch side effects occur;
15. return the QA fixture to draft if it should not remain public.

- [ ] **Step 6: Audit all acceptance criteria**

Map each approved acceptance criterion to a test, command, SQL assertion, or smoke observation. Explicitly prove no core pricing/POD or compiled bundle file changed, legacy missing-mode behavior remains, only safe Matrix Layout products copy, copies stay unpublished, transaction-time eligibility drift is contained, two-session retry/slug concurrency is stable, concurrent settings edits survive, every public/discovery/query bypass fails, preview needs both admin authentication and tenant authorization plus deny-by-default mutation capabilities, zero eligible products cannot report ready, and Go Live is explicit. Distinguish technical Go Live from the controlled commercial-release proof above.

- [ ] **Step 7: Inspect scoped git state**

~~~bash
git status --short
git diff --name-only HEAD
git log --oneline -12
~~~

Do not stage unrelated user files. Commit only final proof documentation if it changed.

- [ ] **Step 8: Finish with required skills**

Re-run `npm run check:independent-site` and the decisive controlled smoke after the final edit. Use `superpowers:verification-before-completion` for every claim and `superpowers:finishing-a-development-branch` for safe integration options. Mark the user goal complete only when no required work remains.

---

## Phase 1 — GSTACK CEO Review

Review mode: **SELECTIVE EXPANSION**. Premise gate: **passed**. The user approved the native-tenant design and implementation direction on 2026-07-15; this review does not reopen that settled product choice without a final-gate user override.

### Step 0A — Premise Challenge

| Premise | Evidence examined | Verdict |
|---|---|---|
| A native tenant can provide the editable independent site | Existing shared tenant storefront, Site Design V2, commerce routes, and tenant settings already provide the runtime | Supported |
| The original Banner Builder bundle should remain reference-only | The compiled bundle is a facade preview and is not the editable tenant source of truth | Supported |
| Existing product cloning is safe for every Banner product | `copy_product_payload_deep` covers Matrix Layout/generic-price payloads but not `storformat_*` tables | Supported only for the explicit Matrix/generic subset |
| Browser orchestration can safely recover normal retries | Tenant/product identity is server-locked; settings checkpoints and template natural keys recover sequential retries | Supported for single-flight/sequential attempts, not cross-device concurrency |
| “Ready” means the draft has something commercially usable | A zero-product draft or a technically live shop with no proven order path would violate the intent | Corrected: zero eligible products remain partial, and release requires a real order proof |
| Admin authentication alone protects preview data | `PreviewShop.tsx` accepts a requested `tenantId` after only a broad admin check | Rejected and corrected: requested-tenant authorization is required |

The technical premises are strong enough for the approved capability. The commercial premise is narrower: this creates the first platform-owned vertical-site proof, not a complete paying-customer onboarding system or proof of demand.

### Step 0B — Existing Code Leverage

| Sub-problem | Existing code | Decision |
|---|---|---|
| Tenant identity and forced admin context | `resolveAdminTenant()`, `force_domain`, tenant rows | Reuse; fix the master-admin target discard |
| Editable storefront | Native tenant storefront and Site Design V2 | Reuse; do not fork a new storefront |
| Package metadata/templates | `sitePackages.ts`, `installSitePackageTemplates()` | Extend additively |
| Product mapping | `readProductSiteIds()` and copied `technical_specs.site_frontends` | Reuse and preserve during provenance stamping |
| Price payload cloning | `clone_product_for_tenant_release()` → `copy_product_payload_deep()` | Delegate exactly once through a locked wrapper |
| Preview runtime | `PreviewShop.tsx`, `SitePackagePreview` | Keep original bundle mode and add tenant-scoped native preview |
| Launch checks | Existing site readiness counts and route structure | Centralize native launch rules without changing legacy rules |
| Browser proof | Tenant/commercial proof scripts | Extend conditionally; never create production data |

No parallel commerce stack, product copier, pricing calculator, or design editor is introduced.

### Step 0C — Dream State Mapping

```text
CURRENT
  package facade previews + manual tenant assembly
      |
      v
THIS PLAN
  one safe native Banner tenant installer
  + draft gate + retry checkpoints + price-safe product provenance
      |
      v
12-MONTH IDEAL
  reusable vertical-site factory
  + durable server job ledger
  + catalog update/recall policy
  + customer ownership/billing/domain onboarding
  + commercial launch scorecard and measured time-to-first-order
```

This plan intentionally lands at the middle step. It proves the shared native runtime and a controlled launch path before generalizing package allowlists or customer onboarding.

### Step 0C-bis — Implementation Alternatives

| Approach | CC effort | Strength | Main risk | Decision |
|---|---:|---|---|---|
| Native tenant installer using existing models | ~1–2 days | Meets the user's individual-edit/build goal and preserves tenant isolation | More integration surface | **Chosen** |
| Manually assemble one tenant | ~1–2 hours | Fastest commercial experiment | Does not deliver repeatable individual site creation | Rejected for this goal; retained as rollback/manual fallback |
| Shared read-only master catalog with tenant presentation | Multi-day | Avoids cloned-product drift | Changes core catalog/pricing ownership and tenant isolation | Deferred |
| New server worker and provisioning-job ledger | Multi-day | Best concurrent/multi-site operations | New infrastructure before the first controlled installer exists | Deferred until concurrency/volume justifies it |
| Clone or deploy each bundle as its own application | Multi-day per site | Maximum visual independence | Permanent code, checkout, auth, and pricing drift | Rejected |

### Step 0D — Scope Decisions

Accepted inside the blast radius:

1. Require requested-tenant authorization in every preview mode.
2. Treat zero eligible/copied products as `partial`, never `ready`.
3. Preserve site mapping and unrelated `technical_specs` keys when stamping provenance.
4. Add a branding draft/published warning before technical Go Live.
5. Require one real price-safe product through checkout, order creation, and production handoff before commercial release.

Deferred because they change protected or product-level architecture:

- STORFORMAT price-copy support.
- Cross-device concurrent template installation guarantees.
- Continuous source-to-clone catalog synchronization and product recall.
- Paying-customer ownership, subscription, billing, and handover automation.
- Generalizing the SQL package allowlist beyond Banner Builder Pro.

### Step 0E — Temporal Interrogation

```text
HOUR 1        migration + pure contracts + legacy compatibility
HOUR 2        tenant/product RPC safety and price eligibility
HOUR 3        staged installer + durable sequential retry
HOUR 4        master-admin UI + tenant-scoped preview
HOUR 5        native draft guard + Go Live readiness
HOUR 6+       browser proof + one real order/production handoff + rollback drill
```

The earliest meaningful proof is not “tenant row created”; it is “same tenant ID survives retry, one supported product preserves its price payload, and draft deep routes remain closed.” Commercial release waits for the full order proof.

### Step 0F — Mode Confirmation

SELECTIVE EXPANSION remains correct: harden everything directly touched by the installer, preview boundary, and launch path; defer new pricing, job infrastructure, customer onboarding, and catalog lifecycle systems.

### CEO Dual Voices

**CLAUDE SUBAGENT (CEO — strategic independence):** challenged technical success without a one-product commercial proof, browser/settings orchestration under future concurrency, missing catalog alternatives, and absence of operational launch ownership.

**CODEX SAYS (CEO — strategy challenge):** challenged automating provisioning before a manual commercial pilot, the STORFORMAT/catalog mismatch, technical Go Live without order/payment/fulfillment proof, copied-product lifecycle drift, platform-wide route-guard blast radius, and lack of explicit experiment economics.

```text
CEO DUAL VOICES — CONSENSUS TABLE
════════════════════════════════════════════════════════════════════
Dimension                              Claude          Codex          Consensus
─────────────────────────────────────  ──────────────  ─────────────  ─────────
1. Premises valid?                     Partial         Partial        CONFIRMED
2. Right problem to solve?             Reframe to      Reframe to     CONFIRMED
                                       repeatable      time-to-order
                                       vertical proof
3. Scope calibration correct?          Too much        Too much       CONFIRMED
                                       browser infra   automation
4. Alternatives sufficiently explored? Job ledger      Manual/shared  CONFIRMED
                                       missing         catalog missing
5. Competitive/market risks covered?   No              No             CONFIRMED
6. Six-month trajectory sound?         Concurrency     Catalog drift  CONFIRMED
                                       debt risk       risk
════════════════════════════════════════════════════════════════════
```

The shared challenge is recorded for the final approval gate. Primary recommendation: keep the user's approved native-installer scope because individual editable sites are the stated capability goal, but adopt the one-product order proof, explicit first-release limits, and commercial-vs-technical launch distinction. A manual-only pilot remains the user's default fallback if they reject the automation after review.

### Section 1 — Architecture Review

The component boundaries reuse stable platform primitives: SQL owns identity and product idempotency, pure TypeScript owns decisions, injected dependencies own I/O, and React owns progress/UI. This is explicit and testable, and the missing-`renderMode` compatibility branch limits legacy blast radius.

Two risks were examined. First, template installation is sequentially idempotent but not protected against simultaneous cross-device attempts; the approved first release therefore exposes single-flight UI and supports sequential retry only. Second, the launch guard touches shared routes, so every legacy/native/fallback branch must be pure-tested and existing tenant browser proofs must pass before release.

No server worker is added. If real usage produces concurrent operators, long-running installs, or support incidents that cannot be reconstructed from settings, the browser orchestrator becomes the migration seam to a provisioning-job ledger.

### Section 2 — Error & Rescue Map

Every expected failure becomes operator-visible and recoverable without deleting the tenant. Input/auth/domain conflicts stop before creation; later failures retain the tenant, successful stage markers, product outcomes, and a safe error message. Lost product responses recover through the locked provenance wrapper.

The plan now treats “no eligible product” as a first-class partial outcome instead of a false success. Preview authorization failure renders no requested-tenant content. Unexpected transport/fallback state on a custom host fails closed to the standalone maintenance/error page.

No planned expected error is silent. Raw database details are sanitized for the UI while development logs and stored stage/error state preserve enough context to diagnose the failing boundary.

### Section 3 — Security & Threat Model

The two new `SECURITY DEFINER` functions require `auth.uid()` and an exact `master_admin` row, pin `search_path`, validate package/tenant/source invariants, and make explicit Data API grant decisions. Product copying remains inside the existing master-only clone boundary and the wrapper merges provenance without replacing source mappings.

The existing preview bypass has two dimensions: query state bypassing authentication and arbitrary `tenantId` selection after a broad admin check. Task 9 now closes both, allowing cross-tenant preview only to a true server-verified master admin and constraining a regular admin to their resolved/owned tenant.

Draft gating never trusts query parameters. On non-platform hosts, unresolved or cached-master fallback cannot expose commerce; the resolution provenance must be resolved for that requested host before launch status is evaluated.

### Section 4 — Data Flow & Interaction Edge Cases

The reviewed flow covers invalid input, existing related/unrelated domains, lost responses, partial template/branding/product work, empty discovery, one/many product failures, user acceptance of a valid copied subset, reload, sequential retry, user edits after branding completion, draft deep links, and legacy tenants with missing native fields.

The key data invariant is monotonic progress: successful stage names and per-source results survive retry; branding is written with its marker; the locked product wrapper returns the same target UUID; finalization merges current settings and never publishes. A zero-product result cannot be accepted.

Simultaneous cross-device template starts remain a stated limitation. The UI prevents rapid/double submission in one session, and release proof exercises same-domain sequential retry; database-enforced template uniqueness is deferred rather than falsely claimed.

### Section 5 — Code Quality Review

The new pure modules remove duplicated site-state parsing and keep SQL/Supabase details out of `SitesAdmin.tsx`. Narrow result validators and injected dependencies favor explicit contracts over hidden global behavior. Existing clone, package install, mapping, branding, and tenant-resolution paths remain the source of truth.

The file count is high because the change crosses security, data, admin, and storefront boundaries, not because it introduces a parallel framework. Tests sit beside each domain module, and UI components remain focused. No pricing or POD module is refactored as part of this change.

The provenance stamp must spread the existing JSON object, never replace it. Stable exclusion/blocker codes are required so the UI and tests do not parse localized prose.

### Section 6 — Test Review

The TDD plan covers pure state/runtime, package defaults, RPC contracts, migration security, every product eligibility branch, staged orchestration, retry, links, native/legacy routing, and browser regressions. Static SQL checks are paired with an optional local Supabase execution proof because text matching alone cannot prove transactional behavior.

Review-added critical tests cover regular-admin cross-tenant preview denial, true-master preview allowance, zero eligible products staying partial, and technical-spec mapping preservation during provenance stamping. The controlled smoke closes the gap between component coverage and a real configured product/order path.

The test plan remains layered: Node tests for decisions, migration contract/exposure checks for SQL, build/lint for integration, browser proof for route/auth behavior, and controlled master-admin smoke for database and commercial flow.

### Section 7 — Performance Review

Product discovery queries only master candidates and then constrains POD/price lookups to candidate IDs. Product provisioning is deliberately sequential to avoid bursts against cloning and price payload tables, while progress remains visible. The first Banner package is expected to have a small mapped set.

No new polling loop, queue, cache, or unbounded in-memory payload is introduced. Tenant settings JSON grows by one stage list and one compact outcome per candidate; this is acceptable for the first bounded package but must be revisited before hundreds of products are provisioned.

A future job ledger would be justified by measured volume, cross-device concurrency, or settings size, not assumed scale.

### Section 8 — Observability & Debuggability Review

The durable operator record includes tenant ID, attempt, status, completed stages, failed stage, last safe error, timestamps, product results, exclusions, and accepted-failure timestamp. The dialog exposes the current stage and recovery action instead of a spinner with no diagnosis.

The database functions fail with bounded invariant errors, and browser/Supabase adapters sanitize them for display. Conditional browser proofs print explicit fixture skips so missing credentials are not mistaken for passing coverage.

The first release has no append-only provisioning audit or centralized alerting. That limitation is acceptable for one controlled installer and is recorded as the trigger for a future job/event ledger.

### Section 9 — Deployment & Rollout Review

Deployment order is migration first, then application code. Existing tenants have no `renderMode`, so they retain legacy behavior; the new action is exposed only for Banner Builder on the central master tenant; all created sites start draft.

The release sequence requires focused tests, grant/function checks, build/lint, existing tenant/commercial proofs, a controlled draft tenant, retry proof, native preview auth, one real order/production handoff, and a return-to-draft step for QA. No unattended production provisioning or publication occurs.

Rollback hides the creation action, returns the tenant to draft, reverts native runtime selection, and drops only the two new RPCs after revoking execution. Created tenant data is retained for manual review rather than destructively deleted.

### Section 10 — Long-Term Trajectory Review

The plan is reversible and provides a clean extension point: package metadata can later allow another native site, while SQL keeps the first server allowlist narrow. Reversibility score: **4/5**; the retained tenant/data is intentional and manual cleanup remains separate.

The largest future debts are copied-product lifecycle, concurrent provisioning, and true customer onboarding. They are not hidden in the first release and must not be inferred from a technically successful Banner pilot.

The original bundle and native site have explicit roles: the bundle is a visual reference; the native tenant is the editable, commerce-capable product. Visual parity is not promised, which prevents two implementations from becoming co-equal sources of truth.

### Section 11 — Design & UX Review

The plan defines the primary operator actions and draft customer state, but detailed hierarchy, loading/empty/error/partial presentation, responsive behavior, keyboard focus, and accessible announcements require the Design phase. The dialog must keep partial work visible and recovery obvious.

The standalone draft page correctly avoids storefront navigation and commerce controls. The original preview and native preview need distinct labels so an operator cannot confuse a visual reference with the editable tenant.

Go Live remains explicit and must warn when Site Design V2 has unpublished draft changes. This warning is informational rather than a hidden auto-publish or silent blocker.

### NOT in Scope

- STORFORMAT/POD price copying: protected pricing work needs separate approval and regression evidence.
- Cross-device concurrent template installs: sequential single-flight retry is the first-release contract.
- Continuous source catalog synchronization/recall: copied products are independent snapshots in this release.
- Customer ownership, subscription, billing, domain verification, and handover automation: this is a platform-owned proof tenant.
- Demand generation, competitive positioning, and acquisition economics: valuable commercial work, but not required to build the approved site capability.
- General native installation for every package: Banner Builder is the canary.

### What Already Exists

The plan reuses tenant isolation, domain resolution, Site Design V2, native storefront components, catalog filtering, product cloning, deep price payload copying, package templates, preview runtime, commerce routes, Supabase auth/RLS, grant checkers, and browser proof infrastructure. It replaces no established subsystem.

### Dream State Delta

After this plan, Webprinter can create and safely prove one independent editable vertical tenant with a controlled draft/live lifecycle. It will not yet have a reusable customer onboarding factory, concurrent server jobs, catalog synchronization, STORFORMAT-safe cloning, or commercial funnel measurement.

### Error & Rescue Registry

| Method/boundary | Failure | Rescued state/action | User impact |
|---|---|---|---|
| `normalizePlatformSiteInput` | Invalid name/domain/email | Reject before RPC | Correct field |
| `create_platform_site_from_package` | Unauthorized/package/domain conflict | No unrelated tenant write; related retry resumes | Sign in/correct input/retry |
| `installSitePackageTemplates` | Read/insert failure | Tenant retained; partial at templates | Retry |
| Branding/settings checkpoint | Read/write failure | Tenant retained; partial; completed branding never reapplied | Retry |
| Product discovery | Query failure | Partial at discovery | Retry |
| `provision_site_standard_product` | Ineligible/clone failure | Ineligible reported or failed source checkpointed; transaction rolls back | Fix/accept valid subset/retry |
| Zero-product discovery | Nothing safe to copy | Partial with `eligible_products_missing` | Add/map supported product |
| Finalization | Settings failure | Partial; prior data retained | Retry |
| Native preview auth | Unauthenticated/unauthorized tenant | Redirect; render no requested-tenant data | Sign in/use authorized context |
| Tenant resolution | Cold/fallback/not-found custom host | Fail-closed state | Retry connection/admin |
| Go Live | Readiness blocker | Remain draft, list blockers | Resolve blockers |
| Browser proof | Fixture missing | Explicit skip; release smoke remains required | Configure fixture/run smoke |

### Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged/stored? |
|---|---|---:|---:|---|---:|
| Tenant create | Same related domain retried | Yes | Yes | Resumed draft | Yes |
| Tenant create | Unrelated duplicate domain | Yes | Yes | Correct-domain error | No row |
| Templates | Sequential retry after lost response | Yes | Yes | Skipped/existing counts | Summary |
| Templates | Simultaneous cross-device starts | Limited | No | Possible duplicate templates | No |
| Branding | Retry after operator edit | Yes | Yes | Edit retained | Stage state |
| Discovery | No eligible products | Yes | Yes | Partial blocker | Yes |
| Product copy | Lost response after commit | Yes | Yes | Existing copy result | Provenance |
| Product copy | Clone/stamp fails | Yes | Yes | Per-product failure | Yes |
| Preview | Query bypass without login | Yes | Yes | Login | Auth logs |
| Preview | Regular admin requests foreign tenant | Yes | Yes | Authorized context only | Auth logs |
| Storefront | Non-platform host resolves fallback master | Yes | Yes | Maintenance/error | Client log |
| Go Live | Product remains unpublished | Yes | Yes | Blocker | No mutation |
| Rollback | Application reverted after tenant created | Yes | Smoke | Draft tenant retained | Tenant state |

No row is simultaneously unrescued, untested, silent, and inside the supported release contract. The concurrent-template row is explicitly outside that contract and is not used to claim concurrent idempotency.

### Required Diagrams

**System architecture**

```text
Master Sites UI
    -> pure provisioner
       -> create-tenant RPC -> tenants.settings
       -> template installer -> designer_templates
       -> product discovery -> master read-only rows
       -> product wrapper RPC -> existing clone helper -> tenant product/prices
    -> Site Design V2 / Products
    -> explicit Go Live
Tenant host -> resolution provenance -> launch guard -> native storefront
Admin preview -> auth + tenant authorization -> native storefront preview
```

**Data flow including shadow paths**

```text
input -> normalize -> master RPC -> tenant_id
                               |-> related domain: resume same tenant
tenant_id -> templates -> branding -> discovery -> per-product wrapper -> finalize
                 |           |           |                |
                 + failure -> partial <- failure ----------+
custom host -> resolved settings -> draft/live decision
            -> fallback/not_found -> fail-closed page
```

**Provisioning state machine**

```text
CREATING
  -> install_templates
  -> apply_branding
  -> discover_products
  -> copy_products
  -> READY -> draft -> LIVE (explicit)
       |          ^
       v          |
     PARTIAL -- retry / valid subset acceptance
       |
       +-- zero products: cannot accept
```

**Error flow**

```text
error
  |- before tenant creation -> no write + field/auth/domain message
  |- after tenant creation  -> save partial checkpoint + keep tenant
  |- per-product            -> record source failure + continue
  |- unknown host/fallback  -> render no commerce
  '- preview auth           -> render no requested tenant + redirect
```

**Deployment sequence**

```text
RED tests -> migration -> grant/function checks -> domain code -> UI integration
-> build/lint -> legacy browser proofs -> controlled draft smoke
-> one product/order/production proof -> explicit live -> optional return to draft
```

**Rollback flow**

```text
incident?
  |- public exposure risk -> set launchStatus=draft
  |- installer risk       -> hide native action
  |- runtime regression   -> revert native branch, legacy remains
  '- withdraw feature     -> revoke/drop two RPCs; retain tenant data
```

### Stale Diagram Audit

No touched implementation file contains a load-bearing ASCII architecture diagram that this change invalidates. Task 11 must update the new independent-site diagrams in `SYSTEM_OVERVIEW.md`; nearby POD and pricing diagrams remain unchanged because those systems are not modified.

### CEO Implementation Tasks

- [ ] **CEO-T1 (P1, human: ~2h / CC: ~15min) — preview security — authorize the requested tenant**
  - Surfaced by: Security — broad admin authentication does not constrain `tenantId`.
  - Files: `src/pages/PreviewShop.tsx`, `src/lib/sites/siteAdminLinks.test.ts`
  - Verify: regular-admin denial and true-master allowance tests plus browser auth proof.
- [ ] **CEO-T2 (P1, human: ~1h / CC: ~10min) — provisioning state — reject false ready with zero products**
  - Surfaced by: Data/UX — a Banner draft can otherwise report ready with no usable product.
  - Files: `src/lib/sites/platformSiteProvisioning.ts`, `src/lib/sites/platformSiteProvisioning.test.ts`
  - Verify: zero eligible products yields `partial/eligible_products_missing`.
- [ ] **CEO-T3 (P1, human: ~1h / CC: ~10min) — product provenance — preserve source mappings**
  - Surfaced by: Code Quality — provenance replacement would break active-site filtering.
  - Files: migration and migration contract test.
  - Verify: existing `technical_specs.site_frontends` survives the stamp.
- [ ] **CEO-T4 (P1, human: ~4h / CC: ~45min) — release proof — complete one real order path**
  - Surfaced by: Premise challenge — technical Go Live is insufficient evidence.
  - Files: browser proof/runbook and continuity evidence.
  - Verify: recorded price parity, checkout, order, notification/file, and production handoff.
- [ ] **CEO-T5 (P3, human: L / CC: M) — product lifecycle — define clone update/recall policy**
  - Surfaced by: Long-term trajectory — copied products can drift after launch.
  - Files: future ADR/TODO; no current pricing change.
  - Verify: separately approved lifecycle design and regression plan.

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Keep native tenant architecture | Mechanical | DRY | Existing tenants/storefront/design/checkout already solve the runtime | Per-site application clone |
| 2 | CEO | Keep original bundle preview-only | Mechanical | Explicit | Prevent two editable sources of truth | Editing compiled bundle |
| 3 | CEO | Restrict automatic products to Matrix/generic pricing | Mechanical | Completeness | A safe subset is better than incomplete protected price payloads | STORFORMAT/POD copy |
| 4 | CEO | Keep sequential browser orchestration for the first canary | Taste | Pragmatic | No new worker/ledger before measured concurrency need | Server job ledger now |
| 5 | CEO | Add requested-tenant preview authorization | Mechanical | Completeness | Authentication without tenant scope permits cross-tenant selection | Broad admin-only check |
| 6 | CEO | Keep zero-product drafts partial | Mechanical | Explicit | “Ready” must mean at least one copied/existing product | Warning-only ready |
| 7 | CEO | Merge provenance into existing technical specs | Mechanical | DRY | Preserve source mapping used by native catalog filter | Replace JSON object |
| 8 | CEO | Distinguish technical Go Live from commercial release | Mechanical | Completeness | Real order/production proof is required before release | Route-only proof |
| 9 | CEO | Defer catalog synchronization and customer onboarding | Mechanical | Boil lakes | Both are outside this installer's direct blast radius | Expand current project |
| 10 | CEO | Replace automation with a manual pilot first | User Challenge (pending final gate) | User decides | Both outside voices recommend it; it conflicts with the approved capability goal | No silent override |

### CEO Completion Summary

```text
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION                         |
| System Audit         | Native reuse sound; commercial proof added  |
| Step 0               | Approved premises held; 5 hardenings added  |
| Section 1  (Arch)    | 2 risks, supported limits explicit          |
| Section 2  (Errors)  | 12 paths mapped, 0 in-scope critical gaps   |
| Section 3  (Security)| 1 high issue found and folded into plan      |
| Section 4  (Data/UX) | 8 edge groups mapped, 0 silently unhandled  |
| Section 5  (Quality) | 1 JSON-merge invariant added                |
| Section 6  (Tests)   | Layered plan, 4 review gaps added           |
| Section 7  (Perf)    | Bounded first package, no blocking issue    |
| Section 8  (Observ)  | 1 future ledger gap documented              |
| Section 9  (Deploy)  | 2 risks controlled by draft/canary/rollback |
| Section 10 (Future)  | Reversibility 4/5, 3 debt items             |
| Section 11 (Design)  | 3 issues passed to Design phase             |
+--------------------------------------------------------------------+
| NOT in scope         | written (6 items)                           |
| What already exists  | written                                    |
| Dream state delta    | written                                    |
| Error/rescue registry| 12 methods, 0 in-scope critical gaps       |
| Failure modes        | 13 total, 0 in-scope critical gaps         |
| TODOS.md updates     | 3 candidates collected                     |
| Scope proposals      | 5 proposed, 5 accepted                     |
| CEO plan             | written                                    |
| Outside voice        | Codex + Claude subagent                    |
| Lake Score           | 8/9 chose complete in-scope option         |
| Diagrams produced    | 6                                          |
| Stale diagrams found | 0                                          |
| Unresolved decisions | 1 user challenge for final gate            |
+====================================================================+
```

**Phase 1 status:** complete. Both voices produced six aligned strategic challenges; all in-blast-radius safety/proof corrections are folded into the plan. The manual-pilot-first reframe remains a user challenge for the final approval gate.

---

## Phase 2 — GSTACK Design Review

Review result: **DONE_WITH_CONCERNS → READY AFTER PLAN AMENDMENTS**. The approved architecture remains intact. The design work in this phase specifies what operators and visitors see at every state; it does not introduce a second storefront or redesign Site Design V2.

### Pre-Review System Audit

| Audit item | Evidence | Result |
|---|---|---|
| UI scope | `SitesAdmin`, creation dialog, tenant overview, native preview, draft guard, Go Live confirmation | Design review applies |
| Existing design system | Tailwind tokens in `src/index.css`, shadcn/Radix primitives in `src/components/ui`, existing admin cards/dialogs/toasts | Reuse; no new component system |
| Storefront design source | Site Design V2 draft/published branding, native storefront theme frame, package `recommendedThemeId` | Reuse; one editable source of truth |
| DESIGN.md | No repository `DESIGN.md` found | Gap recorded; calibrate against existing code and universal interaction principles |
| TODOS.md | No root `TODOS.md` found | Follow-ups stay in this plan/continuity rather than creating an unrelated backlog file |
| Prior gstack design review | No relevant design-review artifact found | No inherited visual decision conflicts |
| Visual designer | `DESIGN_NOT_AVAILABLE`; gstack browse binary is available | Use explicit ASCII wireframes/state specifications; no generated mockup falsely claimed |
| Dirty-worktree risk | Large unrelated UI diff exists | Touch only named files; preserve current visual patterns |

The original Banner bundle remains the art-direction reference. The implementation is not expected to recreate it pixel-for-pixel; the native tenant must use existing Site Design V2 controls and the package's already-declared `glassmorphism` recommendation.

### Step 0 — Design Scope Assessment

**Initial design completeness: 5.5/10.** The plan had the right actions and security states but underspecified preflight timing, resume behavior, result hierarchy, draft/live visibility, mobile layout, focus, announcements, and operator copy.

**A 10/10 for this slice means:** a master admin can predict the exact hostname and eligible product set before committing; can understand and safely resume every stage; cannot mistake a reference bundle, editable draft preview, public draft guard, technical Go Live, or commercial release for another; and can finish the flow on mobile, keyboard, zoom, reduced motion, and a screen reader without lost context.

All seven design passes are in scope. Autoplan selected the complete pass rather than narrowing to one screen because one state transition affects at least five surfaces.

### Design Classifier

This is a **hybrid internal workflow + public state surface**:

- Internal workflow: high-information, low-ornament master-admin setup and recovery.
- Public state: one calm branded draft page plus neutral fail-closed error/loading variants.
- Existing storefront: no visual redesign; Site Design V2 and published branding remain authoritative.
- Original bundle: visual reference only, intentionally subordinate after a native tenant exists.

### Independent Design Voices

The independent Claude design voice and the Codex design voice reviewed the same plan without sharing conclusions. Their aligned findings were folded into Tasks 7–10.

| Aligned concern | Claude | Codex | Resolution |
|---|---:|---:|---|
| Real preflight before creation | High | High | Added advisory domain/product preflight and authoritative RPC recheck |
| Progress must explain retry/resume | High | High | Added persistent six-stage status and forced-context resume |
| Partial acceptance copy is unsafe | High | High | Added three product groups, counts, confirmation, and private-state disclosure |
| Go Live confirmation lacks consequences | Critical | High | Added exact domain, design/product state, acknowledgement, and commercial distinction |
| Original vs native preview is confusing | Critical | Medium | Added canonical names, hierarchy, and visibility matrix |
| Draft/error/loading need distinct surfaces | High | Medium | Added verified branded draft and neutral unresolved variants |
| Responsive/accessibility acceptance missing | High | Medium | Added concrete sizes, focus, live regions, contrast, zoom, motion, and viewport proof |
| Generic/generated visual and copy risk | High | Low | Added hard rules, approved terminology, and reuse constraints |

One voice proposed allowing an exceptional empty draft. The complete, safer option was chosen automatically: zero eligible products blocks the normal create flow and cannot become ready. One voice recommended a non-transactional native preview; this matches the existing preview's role and is now explicit.

### Pass 1 — Information Architecture

The admin hierarchy is outcome-first and progressive. Product details and recovery diagnostics are expandable; the permanent public/private consequence is always adjacent to the action.

```text
Banner Builder Pro card
  |- Design reference (secondary)
  |    '- Original designreference — immutable, not the webshop
  '- Independent webshop (primary)
       |- 1. Name + subdomain + optional public contact
       |- 2. Preflight
       |    |- final hostname
       |    |- templates
       |    |- eligible products
       |    '- exclusions by reason
       |- 3. Create private draft
       |- 4. Six-stage progress / resume
       |- 5. Draft created or partial recovery
       |    |- customize design
       |    |- review and publish products
       |    |- preview editable draft
       |    '- make public
       '- 6. Go Live confirmation
            |- exact domain + readiness
            |- published design/product state
            '- visibility only; commercial release remains separate
```

#### Canonical Surface and Visibility Matrix

| Surface | Audience/auth | Branding source | Products | Transactions | Public meaning |
|---|---|---|---|---|---|
| `Original designreference` | Authorized admin preview | Compiled bundle | Bundle fixtures only | Never | Art-direction reference; not editable or authoritative |
| Site Design V2 editor | Authorized tenant/master admin | `branding.draft` | Admin/editor context | Never | Editing workspace |
| `Forhåndsvis kladdesite` | Authenticated admin authorized for tenant | `branding.draft` | Actual tenant catalog as preview supports | Never: no payment/order/file mutation | Actual editable tenant, visibly `Ikke offentlig` |
| Public host while `draft` | Any visitor after verified tenant resolution | Minimal verified tenant identity | None | Never | Calm preparation page; shop is private |
| Unknown/fallback/error host | Any visitor | Neutral platform/unbranded | None | Never | Unavailable/not found; reveal no tenant data |
| Public host while `live` | Any visitor | `branding.published` | Published, mapped tenant products | Existing commerce behavior | Technically public storefront |
| Commercial release proof | Controlled operator checklist | Same live storefront | At least one proven product | Real controlled transaction | Operational evidence; separate from launch-status bit |

No query parameter changes the public-host row. Go Live changes only visibility; it never moves draft branding to published or unpublished products to published.

#### Focused Dialog Wireframe

```text
+--------------------------------------------------------------+
| Opret selvstændigt Banner Builder-site                   [x] |
| Privat kladde; det originale design forbliver en reference. |
|--------------------------------------------------------------|
| Shopnavn [_______________________________________________]    |
| Subdomæne [banner-navn________] .webprinter.dk                |
| Offentlig kontaktmail (valgfri) [________________________]    |
|--------------------------------------------------------------|
| FORHÅNDSTJEK                                                 |
| Adresse          banner-navn.webprinter.dk       Tilgængelig |
| Bibliotek        20 elementer                                 |
| Produkter        3 kan kopieres / 4 udelades      [Detaljer] |
|                                                              |
| Sitet oprettes som kladde. Priser ændres ikke.                |
|--------------------------------------------------------------|
| [Annuller]                    [Opret kladdesite og kopiér 3]  |
+--------------------------------------------------------------+

Progress replaces preflight without closing:

  ✓ Site oprettet
  ✓ Bibliotek installeret
  ✓ Startdesign anvendt
  ✓ Produkter fundet
  • Kopierer produkt 2 af 3          (aria-live polite)
  ○ Færdiggør kladdesite
```

On narrow screens the same hierarchy becomes one full-height surface with a bounded scrolling body and sticky action footer; it does not become a multi-screen wizard that loses progress context.

### Pass 2 — Interaction State Coverage

| Boundary | Loading | Empty/blocked | Error | Success | Partial/recovery |
|---|---|---|---|---|---|
| Input | Preserve values; validate on blur/submit | Required field text | Focus first invalid field; inline cause | Show normalized host | N/A |
| Preflight | Skeleton/text `Kontrollerer…`; disable create | Zero eligible = blocker | Short safe message + retry; no tenant created | Counts + reason groups + freshness | Mark stale after relevant input change and rerun |
| Tenant creation | Active stage, single-flight | N/A | Domain/auth conflict before write | Persist tenant ID immediately | Lost response resumes related tenant by domain |
| Templates/branding | Stage list, completed work remains visible | N/A | Store failed stage; never erase tenant | Check stage | Retry resumes next incomplete stage |
| Product copy | `Produkt X af Y` | Zero copied/eligible cannot accept | Continue other products; show failed group | Copied/existing group | Retry failures or confirm valid subset with omitted count |
| Final result | Focus result heading | N/A | `Opsætning kræver handling` | `Kladdesite oprettet` + ordered handoff | Keep dialog/card visible; `Fortsæt opsætning` |
| Native preview | Stable authorized loading, no foreign flash | No published product = explain in admin chrome | Redirect/deny before tenant data | Draft banner + actual editable branding | N/A |
| Public draft | Neutral loading until resolution | Branded `Vi gør siden klar` after verified draft | Separate neutral temporary/unavailable page | N/A | Retry only for verified transient error |
| Go Live | Recheck readiness | List blockers | Preserve draft; focus blocker summary | Exact-domain confirmation then live result | Branding mismatch warns and requires acknowledgement; never auto-publishes |

Dismissal during active work does not cancel server writes. The operator sees a confirmation that work may continue, and the target tenant's persisted card exposes `Fortsæt opsætning`. Browser refresh and navigation are recovery paths, not data-loss paths.

### Pass 3 — User Journey and Emotional Arc

| Moment | Likely operator feeling | Design response |
|---|---|---|
| Sees a promising bundle | Curious but unsure whether it is editable | Explicit `Designreference` label and dominant independent-site action |
| Enters identity | Concerned about wrong domain | Show exact normalized hostname before creation |
| Sees product eligibility | Concerned about pricing/data changes | Concrete counts, reason groups, `Priser ændres ikke` adjacent to action |
| Provisioning runs | Vulnerable to an opaque spinner | Six named stages, counts, current operation, preserved completed work |
| A stage fails | Worried retry will duplicate/erase | Explain retained tenant/design/products and exact resume point |
| Draft is created | Tempted to assume it is public/finished | `Kladdesite oprettet` plus ordered handoff, no launch celebration |
| Reviews the real site | Needs confidence changes are real | Native preview dominates and visibly says `Ikke offentlig`; reference is demoted |
| Makes public | Needs consequence clarity | Exact domain, published design/product facts, acknowledgement, reversible draft status |
| Commercial proof | Needs operational confidence | Separate real-order/production checklist before claiming release |

The goodwill goal is calm precision. Counts, saved work, exact domains, and explicit next actions do more work than decorative reassurance.

### Pass 4 — AI Slop Risk and Hard Rules

1. No invented gradients, floating glass cards, oversized hero treatment, or decorative animation in the admin installer.
2. `glassmorphism` is allowed only as the package's existing native storefront recommendation, mapped through Site Design V2; it is not an installer-dialog aesthetic.
3. No badge soup. Use badges only for compact status; use sentences for consequences and recovery.
4. No generic celebration before commercial proof. Use `Kladdesite oprettet`, not confetti, `Alt er klar`, or `Succes!`.
5. No invented product, delivery, quality, sustainability, or support claims.
6. No raw internal terms in primary copy: avoid `native`, `partial`, RPC names, tenant IDs, or implementation stage keys.
7. No color-only state, mystery icons, disabled actions without explanation, or indefinite spinner without a named operation.
8. No attempt at pixel parity with the compiled bundle; use it for palette/type/imagery direction only.
9. No alternate modal, status color, button hierarchy, or spacing scale when an existing admin primitive covers the need.
10. No storefront content flash before verified tenant resolution.

**Litmus test:** if a screen could be dropped into any AI SaaS onboarding flow by changing the title, it is too generic. It must name the exact domain, product counts, Banner Builder source, retained work, and next safe action.

### Pass 5 — Design-System Alignment

| Need | Existing pattern to reuse | Constraint |
|---|---|---|
| Modal and focus management | Radix/shadcn `Dialog` or existing responsive dialog pattern | No custom portal/focus trap |
| Consequence confirmation | Existing `AlertDialog` | Descriptive title includes domain/product count |
| Inputs/errors | Existing admin form spacing, labels, input, helper/error text | Visible label; error tied with `aria-describedby` |
| Primary/secondary actions | Existing `Button` variants | One primary per state; sticky footer on narrow screens |
| Status | Existing `Badge`, icon, plain text, muted token | Text conveys state independent of color |
| Feedback | Existing Sonner toasts | Toast is supplemental; durable result stays in dialog/card |
| Layout | Existing `Card`, `Separator`, tokenized spacing | Progressive disclosure, no new dashboard shell |
| Storefront identity | Site Design V2 + theme frame | Draft page uses minimal verified identity; live uses published branding |
| Original reference | Existing `SitePackagePreview` | Secondary labelled reference, immutable and non-commerce |

No `DESIGN.md` is created in this slice because that would imply repo-wide design-system authorship. The implementation should leave a short follow-up in continuity if repeated installer patterns later justify one.

### Pass 6 — Responsive and Accessibility Acceptance

| Area | Requirement | Proof |
|---|---|---|
| Viewports | 390, 768, and 1440 px; 200% zoom | No clipped footer, hidden result, or horizontal scroll |
| Dialog | Full-height below 640 px, bounded body scroll, sticky action footer | Keyboard and touch smoke |
| Focus | Initial focus on heading/first field; trap; Escape policy; return to trigger | Automated component assertion + keyboard smoke |
| Validation | Summary links/focus to first invalid field; inline described errors | Screen-reader/keyboard smoke |
| Progress | Stage changes and terminal result in `aria-live="polite"` | Announcement observation without repeated noise |
| Failure | `role="alert"`, short safe cause, retry/resume action | Focus lands on error heading/summary |
| Status | Text and icon in addition to color | Visual/manual audit |
| Targets | Minimum 44×44 px for touch controls | Inspector/manual check |
| Contrast | WCAG AA for text/actions/status in admin and draft page | Token/contrast check |
| Motion | Respect `prefers-reduced-motion`; no required animation | Reduced-motion smoke |
| Long data | Domains, product names, reasons, and errors wrap | Fixture with long strings |
| Route guard | One stable full-page loading state; no layout/branding flash | Browser proof root + deep routes + history navigation |

### Pass 7 — Design Decisions

All in-scope design decisions were mechanically resolved by explicitness, security, and completeness. No new user choice is required in this phase.

| Decision | Chosen | Why | Rejected |
|---|---|---|---|
| Zero-product preflight | Block normal creation | A ready Banner site must contain a supported product | Exceptional empty-draft shortcut |
| Native preview commerce | Non-transactional | Preview proves design/catalog without creating orders/payments/files | Transaction-capable admin preview |
| Native preview branding | Current draft branding | It must reflect the editable source operators are evaluating | Published-only preview |
| Domain input | Subdomain slug + exact normalized host | Matches platform-owned first release and removes ambiguity | Free-form arbitrary domain |
| Optional email | Retain as public shop contact | Useful within approved input but explicitly not ownership/invite | Ambiguous `email` label |
| Branding mismatch at Go Live | Warn + acknowledgement, do not auto-publish | Visibility and publishing stay independent and explicit | Auto-publish or silent launch |
| Partial acceptance | Counted confirmation with omitted products | Consequence is clear and recoverable | Ambiguous `Fortsæt` action |
| Mobile model | Same focused dialog as full-height surface | Keeps stage context and reuses primitives | New multi-page wizard |

The earlier CEO proposal to replace automation with a manual pilot remains a separate product-direction challenge for the final autoplan gate. It is not a design ambiguity and does not change the default approved installer direction.

### Approved Operator Copy Contract

| Context | Required Danish copy or pattern |
|---|---|
| Original bundle | `Original designreference` / `Visuel reference — ikke din webshop og afspejler ikke dine ændringer.` |
| Native preview | `Forhåndsvis kladdesite` / persistent `Ikke offentlig` |
| Create disclosure | `Sitet oprettes som kladde. Priser ændres ikke.` |
| Create action | `Opret kladdesite og kopiér {count} produkter` |
| Progress | `Opretter site`, `Installerer bibliotek`, `Anvender startdesign`, `Finder produkter`, `Kopierer produkt {current} af {total}`, `Færdiggør kladdesite` |
| Retry | `Fortsætter fra {stage}. {retainedWork} bevares.` |
| Partial accept | `Accepter {copiedCount} kopierede produkter og fortsæt` plus `{omittedCount} produkter kommer ikke med` |
| Success | `Kladdesite oprettet` |
| Public draft | `Vi gør siden klar` |
| Go Live | `Gå live på {domain}` plus visibility/publishing distinction |

Copy may be refined for natural Danish, but the nouns, counts, privacy consequence, and retained-work facts must remain.

### NOT in Scope — Design

- Redesigning Site Design V2, the native storefront, checkout, product editor, or tenant overview shell.
- Pixel-perfect recreation or editing of the compiled Banner Builder bundle.
- A new design system, modal framework, installer-specific animation language, or storefront theme.
- Customer onboarding, invitations, ownership transfer, subscription, billing, or custom-domain verification UI.
- Commercial marketing pages, acquisition funnel design, or a generalized installer for every package.
- STORFORMAT/POD product configuration UI or pricing changes.

### What Already Exists — Design

The plan reuses the admin card hierarchy, Radix/shadcn dialogs and confirmations, Tailwind tokens, Sonner feedback, Site Design V2 draft/published model, existing theme frame, package preview, tenant management rows, forced-domain context, and preview virtual navigation. The new work is state specificity and hierarchy, not a new visual language.

### Design Implementation Tasks

- [ ] **DESIGN-T1 (P1, human: ~3h / CC: ~25min) — preflight — make creation predictable**
  - Surfaced by: Passes 1–2 — product/domain facts must exist before the write action.
  - Files: `src/components/admin/sites/CreateIndependentSiteDialog.tsx`, `src/lib/sites/platformSiteProducts.ts`, associated tests.
  - Verify: loading/stale/error/zero/success preflight states and exact-host assertion.
- [ ] **DESIGN-T2 (P1, human: ~3h / CC: ~25min) — recovery — persist stage and resume context**
  - Surfaced by: Passes 2–3 — a refresh must not turn durable backend work into an invisible dead end.
  - Files: creation dialog, `SitesAdmin.tsx`, `TenantOverview.tsx`, provisioning tests.
  - Verify: reload/forced-context resume retains tenant ID, completed stages, design, and product outcomes.
- [ ] **DESIGN-T3 (P1, human: ~2h / CC: ~15min) — visibility — encode the canonical surface matrix**
  - Surfaced by: Pass 1 — five overlapping draft/published/reference/live states were ambiguous.
  - Files: `siteAdminLinks.ts`, `PreviewShop.tsx`, storefront guard/draft page, tests.
  - Verify: draft preview uses draft branding, is tenant-authorized and non-transactional; public draft/live sources match matrix.
- [ ] **DESIGN-T4 (P1, human: ~2h / CC: ~15min) — launch — make Go Live consequence-clear**
  - Surfaced by: Passes 2–3 — public visibility must not imply design/product publication or commercial release.
  - Files: `SitesAdmin.tsx`, `siteFrontendState.test.ts`.
  - Verify: exact-domain dialog, counts, branding mismatch acknowledgement, visibility-only patch.
- [ ] **DESIGN-T5 (P2, human: ~3h / CC: ~25min) — accessibility — meet dialog and state-surface criteria**
  - Surfaced by: Pass 6 — responsive/focus/announcement behavior was absent.
  - Files: creation dialog, storefront launch guard/draft page, browser proof.
  - Verify: 390/768/1440, 200% zoom, keyboard, screen-reader announcements, reduced motion, contrast, long strings.
- [ ] **DESIGN-T6 (P2, human: ~1h / CC: ~10min) — visual consistency — enforce approved primitives and copy**
  - Surfaced by: Passes 4–5 — generic generated styling/copy would erode operator trust.
  - Files: creation dialog, `SitesAdmin.tsx`, draft page.
  - Verify: no custom modal/status palette, no badge-only consequence, copy contract present.

### Decision Audit Trail Additions

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 11 | Design | Add advisory preflight before tenant creation | Mechanical | Explicit | Operator sees exact host and safe product set before committing | Discover only after write |
| 12 | Design | Persist and surface resume state | Mechanical | Completeness | Durable backend state needs a durable UI recovery path | Session-only dialog |
| 13 | Design | Make native preview draft-based and non-transactional | Mechanical | Security | Proves editable source without side effects | Published-only or transactional preview |
| 14 | Design | Use distinct draft/error/unknown surfaces | Mechanical | Security | Verified tenants may brand draft; unresolved hosts reveal nothing | One overloaded state page |
| 15 | Design | Keep Go Live visibility-only with acknowledgement | Mechanical | Explicit | Prevent hidden design/product publication | Auto-publish |
| 16 | Design | Block zero-product creation path | Mechanical | Completeness | Prevent knowingly unusable draft from appearing valid | Exceptional empty draft |
| 17 | Design | Reuse existing UI primitives | Mechanical | DRY | Consistency and accessibility already exist in repo | Installer design system |
| 18 | Design | Use full-height mobile dialog, not new wizard | Taste | Pragmatic | Keeps stage context and reduces new navigation state | Multi-page onboarding |

### Design Completion Summary

```text
+====================================================================+
|               DESIGN PLAN REVIEW — COMPLETION SUMMARY              |
+====================================================================+
| Initial completeness | 5.5/10                                     |
| Final completeness   | 9.2/10                                     |
| UI classifier        | Internal workflow + public state surface   |
| System leverage      | Existing primitives and Site Design V2     |
| Visual mockups       | Designer unavailable; ASCII spec produced  |
| IA                   | Primary hierarchy + canonical matrix       |
| Interaction states   | 10 boundaries; loading/empty/error/partial |
| Emotional arc        | 9 moments mapped                           |
| AI-slop rules        | 10 hard constraints + litmus test          |
| Design-system map    | 9 existing patterns                        |
| Responsive/a11y      | 12 acceptance areas                        |
| Design tasks         | 6 actionable                               |
| New user decisions   | 0                                          |
+====================================================================+
```

**Phase 2 status:** complete. Both design voices agreed on the preflight, resume, partial, preview, draft/error, Go Live, and accessibility gaps. Those requirements are now part of the core TDD tasks. No new design-direction approval is required.

## Phase 3 — GSTACK Engineering Review

### Pre-Review Architecture and Source Audit

The approved design document was re-read before this review. Engineering scope is the
installer, its two callable RPCs, generic tenant-settings concurrency hardening, native
draft/public runtime selection, preview safety, and the proof harness. Pricing formulas,
the existing clone helper, POD v1/v2 workflows, STORFORMAT support, and a background job
system remain outside scope.

Source-verified facts that constrain the design:

| Fact | Evidence | Consequence |
|---|---|---|
| `tenants.settings` is one JSONB value with no version column | `supabase/migrations/20260101100000_enable_multitenancy.sql:2` | Read/merge/write clients can lose concurrent keys |
| Sites and Site Design write the whole JSON object | `src/pages/admin/SitesAdmin.tsx:133`, `src/components/admin/SiteDesignEditorV2.tsx:3134` | Provisioning cannot rely on a fresh read alone |
| Branding, SEO, history, and shop-settings paths do the same | `src/hooks/useBrandingDraft.ts:2364`, `src/hooks/useBrandingHistory.ts:108`, `src/components/admin/AiSeoManager.tsx:541`, `src/components/admin/ShopSettings.tsx:125`, both branding adapters | The concurrency fix must cover every active writer family |
| Existing clone uses a check-then-insert slug loop | `supabase/migrations/20260303154500_backfill_tenant_product_categories.sql:102` | Same-target concurrent clones need slug-namespace serialization |
| Product slug uniqueness is tenant-scoped | `supabase/migrations/20260101160000_fix_import_rpc_and_constraints.sql` | Source/package locking alone does not close different-source slug collisions |
| Preview currently treats query/iframe state as an auth exception | `src/pages/PreviewShop.tsx:402`, authorization block near `:718` | Preview queries need authentication plus requested-tenant authorization |
| App exposes tenant contact/about/legal/privacy/guidance routes | `src/App.tsx:145-178` | A commerce-only route list is not a complete draft boundary |
| Edge shell/sitemap/robots/llms resolve tenants independently | `api/tenant-shell.ts`, `api/sitemap.ts`, `api/robots.ts`, `api/llms.ts` | React gating alone can still leak draft SEO and discovery data |
| Sitemap, robots, and llms accept `force_domain` today | their `getRequestedHost()` implementations | Public tenant selection must ignore query overrides |

### Independent Engineering Voices

- **Independent Codex engineering voice:** completed a source-verified review and
  identified four High gaps: settings lost updates, missing preview capability boundary,
  incomplete route/edge draft coverage, and optional rather than release-blocking SQL
  concurrency proof. It also identified versioned provenance, stale preflight handling,
  structured diagnostics, and containment-first rollback as Medium gaps.
- **Primary engineering voice:** independently traced each finding into current files,
  expanded the settings-writer audit, and found the edge `force_domain` bypass surface.
- **Independent Claude engineering voice:** unavailable after three bounded attempts;
  those attempts were interrupted instead of inventing findings. The final review uses
  the completed independent Codex review plus direct source evidence.

The two completed voices agree. Confidence is high because every High finding maps to
an existing line-level behavior and now has a named test/acceptance gate.

### Section 1 — Architecture Review

```text
Master Sites UI
    |
    +--> read-only preflight
    |       `-- manifest v1 { observedAt, fingerprint, eligible IDs, reasons }
    |
    `--> create_platform_site_from_package (master-only, domain lock)
            |
            `--> native draft tenant + settings_version
                    |
                    +--> install templates
                    +--> CAS starter branding/checkpoint
                    +--> fresh product discovery
                    +--> provision_site_standard_product per source
                    |       |-- ordered advisory locks
                    |       |-- transaction-time eligibility recheck
                    |       |-- existing protected clone helper once
                    |       `-- provenance v1 merge, unpublished copy
                    `--> CAS finalization/readiness from committed outcomes

All active settings writers ----> patchTenantSettingsCas
                                   read(settings, version)
                                   patch fresh snapshot
                                   update WHERE version = observed
                                   bounded retry (max 4)

Actual tenant host ----> shared public-exposure decision
                          |-- React route guard
                          |-- HTML tenant shell
                          |-- sitemap
                          |-- robots
                          `-- llms
```

The two callable feature RPCs remain the only feature Data API functions. The settings
version trigger is private database infrastructure. No new public table or job system is
introduced.

### Section 2 — Request, State, and Data Flow

```text
preflight(observedAt=fingerprint A)
        |
        | user confirms while fresh
        v
create/resume tenant ---- operationId stable, attemptId new
        |
        v
stage checkpoint ---- CAS ---- conflict? ---- re-read + recompute (<=4)
        |
        v
copy product ---- SQL recheck
        |             |-- still eligible -> copied/existing
        |             `-- changed -> ineligible_at_copy
        v
ready only if committed copied/existing >= 1
        |
        v
explicit Go Live ---- visibility only ---- commercial proof remains separate
```

Provisioning state is monotonic: completed stages and successful per-source outcomes are
never removed by retry. Unexpected failures retain first/last timestamps and safe codes;
later success clears only the resolved diagnostic. An advisory preflight never grants
authorization or readiness.

### Section 3 — Error and Rescue Map

| Boundary | Stable result | Persisted rescue state | Operator recovery |
|---|---|---|---|
| Invalid/unavailable domain | `domain_invalid` / `domain_conflict` | none | correct slug/domain |
| Unauthorized RPC | `master_admin_required` | none | use verified master session |
| CAS conflict | automatic retry, then `tenant_settings_conflict` | prior committed stages untouched | reload/retry after competing save |
| Template failure | `template_install_failed` | tenant + prior stages | resume templates |
| Branding failure | `branding_patch_failed` | tenant + templates | resume branding |
| Product changed after preflight | `ineligible_at_copy` | policy exclusion, no target copy | refresh/fix source mapping |
| Product clone failure | safe copy error code | other product results retained | fix source and resume |
| Lost response | same tenant/product identity on retry | provenance/checkpoints authoritative | retry safely |
| Draft host unresolved/transport fallback | neutral unavailable state | no tenant data exposed | retry resolution |
| Preview mutation attempt | capability rejection | no network/storage write | use live storefront after release |

### Section 4 — Security and Threat Model

1. Both feature RPCs require `auth.uid()` and the exact server-verified master role.
2. The product wrapper revalidates target provenance and source eligibility inside its
   transaction; UI eligibility is informational only.
3. Locks use a single order, including target slug namespace, preventing deadlock-prone
   mixed ordering and clone slug races.
4. Provenance schema v1 accepts object/object-string JSON only and rejects conflict or
   malformed shapes.
5. Public host selection ignores query parameters. Only actual forwarded/host headers
   select the tenant on edge endpoints.
6. Preview authentication and requested-tenant authorization happen before requested
   tenant branding/products load.
7. Preview capabilities reject mutation before adapters, not merely by hiding controls.
8. Draft identity, SEO, structured data, URLs, and AI-readable content are suppressed at
   the edge as well as in React.

### Section 5 — Data Integrity and Concurrency

The previous plan's “read latest then write whole JSON” approach was insufficient:
another writer could read first, provisioning could commit, and the other writer could
then overwrite the provisioning keys. `settings_version` plus CAS closes this only when
all active whole-settings writers participate, so Task 6 converts the complete audited
set and the final verification requires zero direct whole-settings updates.

The product wrapper has two separate idempotency domains:

- target/source/package provenance prevents duplicate copies of the same source;
- target tenant slug serialization prevents different sources with colliding slugs from
  racing inside the protected clone helper.

Both are covered by real two-session SQL tests, not static string assertions alone.

### Section 6 — Test Strategy and Full Path Coverage

Detected test stack: Node's built-in test runner with TypeScript stripping, repository
static migration checks, Vite production build, ESLint, Supabase grant/function checks,
and Playwright-style browser proof scripts. No LLM evaluation framework exists or is
needed for this deterministic feature.

```text
Pure unit tests
  |-- state parsing/monotonic merge/readiness
  |-- CAS stale retry/no-op/exhaustion
  |-- package branding defaults
  |-- input/result validators
  |-- product classification/manifest fingerprint
  |-- orchestrator stages/retry/diagnostics
  |-- route classification/public exposure
  `-- preview capabilities

Static migration tests
  `-- signatures/auth/locks/provenance/rechecks/grants/rollback

Two-session isolated PostgreSQL integration (release-blocking)
  |-- role rejection + same-domain convergence
  |-- same-source and colliding-slug concurrency
  |-- exact generic-price parity/unpublished copy
  |-- CAS concurrent setting retention
  `-- malformed provenance + eligibility drift

Browser proof
  |-- legacy bundle unchanged
  |-- all draft routes + edge endpoints contained
  |-- query overrides ineffective
  |-- preview auth/tenant authorization
  |-- zero preview mutation writes
  `-- live native storefront + legacy tenant regressions

Controlled smoke
  `-- one real price-safe product through order and production handoff
```

### Section 7 — Performance Review

- Preflight queries are bounded to mapped master candidates and fetch price-row
  existence, not price payload values.
- Product copies remain sequential in the first release, limiting lock pressure and
  simplifying durable per-product progress. Parallel copy is intentionally deferred.
- CAS retries are capped at four and patch only one tenant row.
- Edge draft decisions reuse the tenant lookup already required for tenant SEO; draft
  paths skip page/product SEO queries and can be cheaper than live paths.
- Sitemap product/page queries run only after live/legacy exposure is allowed.

### Section 8 — Observability and Debuggability

Support can correlate UI and stored state through `operationId`, `attemptId`, stage,
source product ID, error code, first/last timestamps, and optional correlation ID. The UI
shows safe copy plus retained-work facts. Browser proof reports route and endpoint name;
the SQL runner reports isolated fixture/session/case names without credentials. No raw
Supabase error object, service key, supplier response, or customer file is persisted.

### Section 9 — Deployment and Rollback Review

Deployment is additive and ordered:

1. migrate settings version/trigger and two RPCs;
2. ship CAS-converted writers and native runtime with installer hidden until checks pass;
3. run grants, static tests, isolated two-session SQL proof, build, and browser proof;
4. expose Banner Builder creation to master admin only;
5. create one controlled draft and complete technical plus commercial proof.

Rollback is containment-first: set affected tenants draft and verify React/edge
containment, hide creation/Go Live, withdraw UI/runtime, then revoke/drop only the two
feature RPCs. Generic settings-version infrastructure remains while any CAS client uses
it. Created tenant data is retained for manual review.

### Section 10 — Long-Term Trajectory

The first implementation deliberately uses durable tenant JSON checkpoints instead of
a job table. If multiple packages, bulk catalogs, or asynchronous supplier steps are
approved later, the stable operation/attempt/stage/error contracts form a migration path
to a provisioning-job ledger without changing storefront state or product provenance.
That future system is not pulled into the first release.

### NOT in Scope — Engineering

- Modifying pricing formulas, copied price values, STORFORMAT tables, or the existing
  product clone helper.
- Replacing manual product publication, Site Design publication, checkout, order, or
  production workflows.
- A generalized multi-package installer, background queue, customer ownership transfer,
  billing, DNS automation, or automatic commercial launch.
- Changing unrelated tenant RLS policies or introducing a new public table.

### What Already Exists — Engineering

The plan reuses `tenants`, Site Design V2 draft/published branding, designer templates,
product site mappings, `generic_product_prices`, `copy_product_payload_deep`, the
protected clone function, native storefront/checkout/order/production routes, forced
admin tenant context, and current proof scripts. New code adds orchestration and safety
boundaries around those capabilities.

### Engineering Implementation Tasks

- [ ] **ENG-T1 (P0) — settings CAS foundation**
  - Add `settings_version`, private trigger, pure bounded CAS helper, and stale-write
    tests; convert every audited writer and require zero direct whole-settings updates.
- [ ] **ENG-T2 (P0) — secure RPC and concurrency contract**
  - Implement master auth, ordered locks, target slug serialization, provenance v1,
    transaction-time eligibility recheck, and unpublished clone result.
- [ ] **ENG-T3 (P0) — release-blocking SQL integration**
  - Build the isolated safe-database runner and two-session authorization/idempotency/
    collision/settings/price/provenance/drift assertions; absence is a release blocker.
- [ ] **ENG-T4 (P1) — manifest and durable orchestration**
  - Add observed/fingerprinted preflight, operation/attempt IDs, structured diagnostics,
    committed-outcome readiness, partial acceptance, and recovery tests.
- [ ] **ENG-T5 (P0) — complete draft public boundary**
  - Add exhaustive App route classification and shared React/edge exposure decisions;
    remove public query-host overrides.
- [ ] **ENG-T6 (P0) — preview authorization and capability boundary**
  - Authorize tenant before reads and require false mutation capabilities before every
    preview side effect; prove zero network/storage writes.
- [ ] **ENG-T7 (P1) — admin workflow and launch**
  - Wire preflight, persistent resume/progress/result, context-safe links, readiness, and
    explicit visibility-only Go Live.
- [ ] **ENG-T8 (P1) — whole-path proof and docs**
  - Run unit/static/SQL/build/browser/accessibility/controlled smoke, map acceptance
    criteria, and document containment-first rollback.

### Failure Modes Registry — Engineering Additions

| # | Failure mode | Prevent/detect | Required proof |
|---|---|---|---|
| E1 | Concurrent branding save erases provisioning state | versioned CAS across all writers | forced stale retry + two-session DB test |
| E2 | Same-source retry creates two copies | provenance lock/check | two simultaneous identical calls |
| E3 | Different sources collide on slug | target slug-namespace serialization | two-session colliding-slug test |
| E4 | Malformed technical specs corrupt provenance | object-only normalizer | malformed/array/scalar cases |
| E5 | Product becomes ineligible after preflight | in-transaction recheck | eligibility drift SQL case |
| E6 | Draft leaks through contact/legal/deep route | exhaustive route classifier | all App routes fixture |
| E7 | Draft leaks SEO/AI discovery | shared edge exposure decision | HTML/sitemap/robots/llms proof |
| E8 | Query selects another tenant publicly | actual-host-only edge selection | `force_domain` bypass tests |
| E9 | Preview creates commerce side effect | deny-by-default capabilities | request/storage spy |
| E10 | Rollback makes draft tenant public | containment-first ordering | rollback checklist/proof |

### Decision Audit Trail Additions

| # | Phase | Decision | Classification | Rationale | Rejected |
|---|---|---|---|---|---|
| 19 | Eng | Add monotonic settings version and convert all active writers | Necessary safety | Fresh-read whole writes still lose concurrent updates | Installer-only merge |
| 20 | Eng | Serialize target tenant slug namespace | Necessary safety | Protected clone has check-then-insert slug race | Source-only lock |
| 21 | Eng | Version and strictly normalize provenance | Explicit contract | Retry/conflict behavior must be deterministic | Shape-less metadata |
| 22 | Eng | Recheck eligibility inside copy transaction | Necessary safety | Preflight can go stale | Trust UI manifest |
| 23 | Eng | Make SQL concurrency proof release-blocking | Verification | Static tests cannot prove two-session behavior | Optional local smoke |
| 24 | Eng | Share React/edge draft exposure decision | DRY/security | Four edge paths otherwise drift | React-only guard |
| 25 | Eng | Use deny-by-default preview capabilities | Security | Disabled UI is not a mutation boundary | Visual disabling alone |
| 26 | Eng | Keep commercial proof separate from technical Go Live | Approved direction | Visibility does not prove operational readiness | Silent commercial launch |

### Engineering Completion Summary

```text
+====================================================================+
|             ENGINEERING PLAN REVIEW — COMPLETION SUMMARY           |
+====================================================================+
| High gaps found/closed | 4 / 4                                    |
| Medium gaps closed     | 4                                        |
| Source-verified paths  | settings, clone, routes, four edge APIs  |
| Callable feature RPCs  | 2 (unchanged)                            |
| New generic DB safety  | settings_version + private trigger       |
| Test layers            | unit, static, 2-session SQL, browser     |
| Release-blocking races | tenant, product, slug, settings          |
| Preview mutations      | deny-by-default + zero-write proof       |
| New user decisions     | 0                                        |
+====================================================================+
```

**Phase 3 status:** complete. The user approved keeping the native automated installer
as the implementation direction; a controlled commercial pilot remains a release gate,
not a replacement for the installer. No unresolved engineering choice remains.

## Phase 3.5 — GSTACK Developer Experience Review

### Pre-Review System Audit and Applicability

Primary product type: **internal platform/admin installer**, with a secondary
**database API and maintainer toolchain** surface. The end-user dialog was reviewed in
Phase 2; this phase covers the Webprinter maintainer/master-admin experience from first
checkout through safe database proof, operation, debugging, extension, and rollback.

The current root `README.md` has a general `npm install → .env → npm run dev` path but no
Banner installer entrypoint, no safe local database test path, and no map from a failure
code to retained work/next action. `package.json` has individual build, grants,
functions, and proof commands, but a newcomer must discover and sequence them manually.
The approved plan has strong test detail but is over 2,000 lines, so it cannot itself be
the first-use runbook.

The installed gstack package did not include its separately referenced
`dx-hall-of-fame.md` or `sections/review-sections.md` resources. The full embedded skill
rubric, official primary-source benchmarks, and direct repository evidence were used
instead; no missing reference was fabricated. A bounded independent maintainer voice
did not return after a stop request and was interrupted, so this phase does not claim
cross-model DX consensus.

### Developer Persona Card

```text
TARGET DEVELOPER PERSONA
========================
Who:       Webprinter maintainer who owns React/Supabase changes and may also operate
           the master-admin Sites workflow
Context:   Adding or repairing a native site package without risking tenant settings,
           pricing, POD, or a production database
Tolerance: 5 minutes and at most 3 actions before the first trustworthy green result
Expects:   One discoverable runbook, safe defaults, exact commands/output, deterministic
           errors, an isolated test database, and a rollback path before feature enablement
```

Secondary persona: the master admin operating the dialog. Their needs—exact domain,
preflight facts, durable progress, rescue actions, and explicit Go Live—are already in
the Phase 2 design contract.

### Developer Perspective

> I clone the repository and open `README.md`. It tells me this is a multi-tenant print
> platform and gives me the general Vite setup, but the only highlighted specialist doc
> is POD v2. I know the task is “independent Banner Builder site,” so I search `docs/`
> and find a long implementation plan, several Site Design notes, tenant context docs,
> and commercial proof packets. I still do not know which one is authoritative or which
> command is safe to run first. `package.json` has `check:supabase-grants`,
> `check:supabase-functions`, `check:tenant-proof`, and many commercial commands. I worry
> that one may touch the linked database, so I avoid guessing. If I jump straight into
> the plan, I learn the right architecture, but not whether Docker/Supabase is ready,
> which environment variable must point to an isolated database, or what successful
> output looks like. When a staged operation later fails, an error code and attempt ID
> help support, but only if I can find their meanings. The improved path puts one link in
> the README. I run the doctor, it tells me exactly what is ready or blocked without
> printing secrets, and it gives one next command. The fast check turns green in under
> five minutes. Only then do I opt into the isolated database and browser release gates.
> I understand the blast radius before I create anything, and I know how to contain it.

### Competitive DX Benchmark

Times are estimated for an already-cloned project after tool prerequisites; the cited
pages establish the onboarding shape, not a vendor-measured stopwatch result.

| Tool/pattern | Estimated TTHW | Notable DX choice | Source |
|---|---:|---|---|
| Supabase local database tests | 2–5 min | Local stack plus one `supabase test db` entrypoint; pgTAP runs in CI | [Official testing guide](https://supabase.com/docs/guides/local-development/cli/testing-and-linting) |
| Vercel Platforms starter | 5–10 min | One concrete multi-tenant example with local subdomains, admin, and exact URLs | [Official Platforms Starter Kit](https://vercel.com/templates/multi-tenant-apps/platforms-starter-kit) |
| Shopify theme development | 2–5 min | One dev command creates a hidden preview; unpublished and live states are explicit | [Official theme CLI guide](https://shopify.dev/docs/storefronts/themes/tools/cli) |
| This plan before DX pass | 10–20 min | Correct but scattered commands and no safe first entrypoint | repository audit |
| This plan after DX pass | 2–5 min | doctor + one fast aggregate command, with opt-in release gates | Tasks 11–12 |

Two additional benchmark principles are carried into the plan: Supabase explicitly
requires search-path discipline and function privilege decisions for protected database
functions ([official function guide](https://supabase.com/docs/guides/database/functions)),
and Shopify creates new themes unpublished by default so preview and publication stay
separate ([official theme object reference](https://shopify.dev/docs/api/admin-graphql/latest/objects/OnlineStoreTheme)).

**Chosen target:** Competitive tier, 2–5 minutes and no more than three actions. Champion
sub-two-minute setup is not honest while Node dependencies and a containerized local
database are legitimate prerequisites.

### Magical Moment

The maintainer's first magical moment is not tenant creation; it is seeing one command
prove “this checkout can safely work on the installer” without contacting production:

```text
$ npm run check:independent-site:fast
PASS  state + CAS + RPC + product + route + capability tests
PASS  Supabase grants/function exposure
PASS  no direct whole-settings writers
READY isolated database proof
Elapsed 00:47
NEXT npm run check:independent-site
```

The operator's later magical moment is `Kladdesite oprettet`: the exact draft domain,
editable native design, templates, and committed product count appear together, while
the public site remains contained. The first moment earns developer trust; the second
proves product value.

### TTHW Assessment

| Action | Budget | Success signal |
|---|---:|---|
| `npm install` (only if needed) | environment-dependent | dependencies present |
| `npm run independent-site:doctor` | <30 sec | prerequisite map + one `NEXT` command |
| `npm run check:independent-site:fast` | <5 min total | deterministic green summary |

Current path: approximately 10–20 minutes and 6–10 discoveries/actions. Planned path:
2–5 minutes and 2 actions for an existing checkout, 3 when dependency installation is
needed. Full DB/browser proof intentionally takes longer and is a release gate, not the
hello-world gate.

### Developer Journey Map

| Stage | Developer does | Prior friction | Plan resolution | Status |
|---|---|---|---|---|
| Discover | Opens root README | No installer link; many adjacent docs | One authoritative runbook link | fixed in Task 11 |
| Install | Installs dependencies/configures env | Supabase/container/safe-DB contract implicit | Doctor probes and explains without secrets | fixed in Task 11 |
| Hello world | Wants first trustworthy signal | Must compose many commands | `check:independent-site:fast` | fixed in Tasks 11–12 |
| Real usage | Builds, proves DB, opens Sites | Fast/full/release/manual gates blurred | Named command hierarchy and release checklist | fixed in Tasks 11–12 |
| Debug | Gets stage/RPC/test failure | Console/raw errors and plan search | Stable code catalog, correlation, retained-work + next fix | fixed in Tasks 5/11 |
| Upgrade | Extends package or rolls back | Compatibility and ownership distributed | Extension checklist, compatibility table, containment-first runbook | fixed in Task 11 |

### First-Time Maintainer Confusion Report

```text
T+0:00  Opens README; understands product, cannot find Banner installer entrypoint.
T+0:45  Searches docs; sees several Site/Tenant files and a very long plan.
T+2:00  Finds individual package scripts; pauses because linked-vs-local DB safety is unclear.
T+5:00  Reads migration/testing sections to infer command order and expected output.
T+10:00 Either asks for help or runs only unit tests, missing the race/edge gates.

After planned DX changes:
T+0:00  Opens README and follows the Independent Site Installer link.
T+0:30  Runs doctor; sees PASS/BLOCKED and one exact NEXT action.
T+1:00  Runs fast check.
T+2–5  Gets green signal plus the next opt-in isolated DB step.
```

Autoplan resolves all five confusion points in DX POLISH mode; none requires expanding
the feature's product scope.

### Pass 1 — Getting Started Experience

**Initial: 4/10.** The general README is runnable, but the primary persona must search
the repository and compose safety checks. A 10 would be one discoverable, production-
representative, safe path with expected output and an honest prerequisite boundary.

**Plan fixes:** add the README link, dedicated runbook, doctor, three-action sequence,
expected output, and under-five-minute fast gate. The isolated DB and browser fixtures
remain progressive disclosure, not hidden prerequisites.

**Final: 9/10.** It is not a 10 because initial dependency/container installation is
outside the repository's control; the doctor makes that limitation explicit.

### Pass 2 — API, Command, and Contract Design

**Initial: 7/10.** Function names and staged interfaces are explicit, but commands are
scattered and errors/results lack one discoverable reference. A 10 would let a
maintainer correctly guess the fast/full/release progression after seeing one example.

**Plan fixes:** standardize `independent-site:doctor`,
`check:independent-site:fast`, `check:independent-site`, and
`check:independent-site:release`; keep the two feature RPC names verb-led and stable;
document exact input/output/provenance/error schemas and the future package extension
checklist.

**Final: 9/10.** The narrow internal API is complete for Banner Builder and deliberately
does not pretend to be a public generalized SDK.

### Pass 3 — Error Messages and Debugging

**Initial: 6/10.** The engineering pass added safe structured diagnostics, but three
paths still need developer-facing fixes in one place:

| Path | Weak experience | Required experience |
|---|---|---|
| Unsafe/missing DB | low-level connection or missing env failure | `BLOCKED database_is_not_isolated` + cause + exact setup/next command |
| CAS exhaustion | generic save failure | `tenant_settings_conflict` + tenant/operation correlation + retained work + retry action |
| Eligibility drift | generic product copy failure | `ineligible_at_copy` + source ID + changed policy fact + refresh/fix action |

**Plan fixes:** stable code catalog, safe operator/developer messages, optional
correlation ID, first/last timestamps, retained-work facts, JSON doctor mode, and exactly
one `NEXT` command. Raw payloads/secrets stay out of storage and output.

**Final: 9/10.** Every planned error now answers problem, cause, retained state, and fix;
live code review will verify wording and adapter boundaries.

### Pass 4 — Documentation and Learning

**Initial: 4/10.** Architecture knowledge exists but is fragmented across continuity,
system, tenant, Site Design, and plan documents. A 10 would provide one task-oriented
front door with progressive links to reference material.

**Plan fixes:** `docs/INDEPENDENT_SITE_INSTALLER.md` begins with quick start, then mental
model/diagram, commands, environment contract, common errors, operation debugging,
package extension, release, and rollback. README links once; System Overview and
Continuity remain authoritative architecture/history references rather than duplicate
quick starts.

**Final: 9/10.** Copy-paste commands and expected output are test-bound; no new docs
site is necessary for an internal repository surface.

### Pass 5 — Upgrade and Migration Path

**Initial: 7/10.** Additive migration, legacy missing-mode behavior, versioned
provenance, and containment-first rollback are strong. The gap is maintainer-facing
sequencing and compatibility ownership.

**Plan fixes:** add a compatibility table (legacy facade, native draft/live, pre-/post-
`settings_version` writers), migration preflight, feature-enable order, future package
contract, and a rollback checklist that retains generic CAS infrastructure while clients
depend on it.

**Final: 9/10.** Breaking changes are avoided; a future generalized installer or
provenance v2 must ship with its own migration note.

### Pass 6 — Developer Environment and Tooling

**Initial: 5/10.** Existing scripts are CI-friendly individually, but no tool verifies
Node, dependencies, container/Supabase availability, safe database targeting, or browser
fixtures as one environment. A 10 would make the supported path reproducible and reject
dangerous defaults.

**Plan fixes:** injected/tested doctor probes, normal and strict modes, JSON output,
non-interactive aggregate commands, safe URL classifier, elapsed timings, exact fixture
contract, and no implicit linked-project connection. The SQL runner can use Supabase's
local test workflow while preserving the additional two-session cases that pgTAP alone
does not model conveniently.

**Final: 9/10.** macOS/Linux container runtimes are supported through the repository
Supabase wrapper; Windows is not claimed without CI evidence.

### Pass 7 — Community and Ecosystem

**Initial: 6/10.** This is an internal platform, so public community/pricing/channel
criteria are not the adoption constraint. The relevant ecosystem question is whether a
future maintainer can add a second package without copying security logic.

**Plan fixes:** document owners/authoritative files, package metadata extension steps,
required eligibility policy, test matrix, deprecation rule, and the explicit boundary
that STORFORMAT/POD support needs separate approval. Reuse shared contracts instead of a
parallel installer.

**Final: 8/10.** A public SDK/community is intentionally out of scope; internal
extension governance is sufficient for this release.

### Pass 8 — DX Measurement and Feedback Loops

**Initial: 3/10.** The plan names many gates but does not measure the promised first-use
time or preserve evidence for a post-ship DX review. A 10 would compare planned and real
TTHW, command failures, and recovery friction without collecting sensitive data.

**Plan fixes:** every aggregate command prints elapsed time; Task 12 records
time-to-first-green, blocked prerequisite categories, and release gate durations; the
controlled smoke records resume/error-code clarity; after shipping, run the gstack
devex boomerang against the implemented runbook and command outputs. No product telemetry
is added in this slice.

**Final: 9/10.** Local/release evidence provides a feedback loop without expanding into
analytics infrastructure.

### DX Scorecard

| Characteristic | Initial | Final | Evidence after plan fixes |
|---|---:|---:|---|
| Usable | 5 | 9 | one doctor, one fast check, one runbook |
| Credible | 7 | 9 | safe DB rejection, CAS/race tests, containment rollback |
| Findable | 4 | 9 | README front door + error/command reference |
| Useful | 8 | 9 | directly proves the highest-risk installer path |
| Valuable | 6 | 9 | reduces first safe validation from 10–20 to 2–5 min |
| Accessible | 5 | 8 | human + JSON output; explicit supported environments |
| Desirable | 5 | 9 | clear green magical moment and trustworthy recovery |
| **Overall** | **5.7** | **8.9** | DX POLISH target achieved; no scope expansion |

### DX Implementation Tasks

- [ ] **DX-T1 (P1, human: ~3h / CC: ~25min) — three-action quick start**
  - Create the authoritative runbook and root README link with exact output/time budget.
- [ ] **DX-T2 (P1, human: ~4h / CC: ~35min) — doctor and command hierarchy**
  - Add tested human/JSON doctor plus fast/full/release aggregate commands and safe URL
    rejection.
- [ ] **DX-T3 (P1, human: ~2h / CC: ~15min) — error and recovery reference**
  - Document every stable code with cause, retained work, fix, and correlation fields.
- [ ] **DX-T4 (P2, human: ~1h / CC: ~10min) — measure real DX**
  - Record TTHW/gate timing in Task 12 and run a post-ship devex review.

### DX Decision Audit Additions

| # | Decision | Principle | Rationale | Rejected |
|---|---|---|---|---|
| 27 | Target 2–5 minute first safe green | Zero friction at T0 | Honest with existing repo prerequisites | Sub-two-minute claim |
| 28 | Use doctor + aggregate commands | Fight uncertainty | One result and one next action | Command scavenger hunt |
| 29 | Keep DB/browser proof progressive but release-blocking | Incremental steps | Fast feedback without weakening release | Put all gates in hello world |
| 30 | Add one authoritative maintainer runbook | Findability | The implementation plan is not onboarding docs | More fragmented notes |
| 31 | Measure local TTHW without product telemetry | Feedback loop | Enough evidence for internal DX boomerang | Analytics scope expansion |

### DX Completion Summary

```text
+====================================================================+
|                 DX PLAN REVIEW — COMPLETION SUMMARY                |
+====================================================================+
| Product type       | Internal platform/admin installer + DB API   |
| Persona            | Webprinter maintainer / master admin         |
| Mode               | DX POLISH                                    |
| TTHW               | 10–20 min -> target 2–5 min / <=3 actions   |
| Magical moment     | Safe fast green, then contained draft site   |
| Passes completed   | 8 / 8                                        |
| Initial score      | 5.7 / 10                                     |
| Final plan score   | 8.9 / 10                                     |
| DX tasks           | 4                                            |
| New user decisions | 0                                            |
+====================================================================+
```

**Phase 3.5 status:** complete. The user previously chose the recommended direction and
approved execution, so the inferred internal maintainer persona, Competitive TTHW tier,
safe-command magical moment, and DX POLISH mode are resolved. No DX decision remains.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (via `/autoplan`) | 5 proposals: 4 accepted, 1 deferred; automated installer retained and commercial proof separated |
| Codex Review | `/codex review` | Independent second opinion | 1 | CLEAR (via `/autoplan`) | 8 findings, 8/8 closed in the plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN via `/autoplan`) | 8 issues, including 4 High gaps, all closed with named release gates |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL via `/autoplan`) | score 5.5/10 → 9.2/10, 8 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR (via `/autoplan`) | score 5.7/10 → 8.9/10, TTHW 10–20 min → 2–5 min |

**CODEX:** Closed settings lost-update risk, preview mutation/auth boundaries, exhaustive React/edge draft isolation, mandatory SQL race proof, strict provenance, preflight drift, diagnostics, and rollback ordering.

**CROSS-MODEL:** Completed CEO/design voices and the independent Codex engineering review agree on one native draft installer, explicit tenant authorization, durable recovery, visibility-only Go Live, and separate controlled commercial proof. Unavailable engineering/DX subagent attempts are recorded as partial and are not represented as consensus.

**VERDICT:** CEO + CODEX + ENG + DESIGN + DX CLEARED — approved and ready for test-first implementation.

NO UNRESOLVED DECISIONS
