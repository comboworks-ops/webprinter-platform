# Local system debug review — 8 September 2026

Follow-up: the styling-save and Support-context defects below have now been fixed locally. See [implementation and release review](remaining-issues-2026-09-08/README.md) for 322 passing source tests, the 423-diagnostic TypeScript result, the exact runtime candidate and the still-open Salgsmapper production-model decision. The original observations below remain historical evidence; production release is still held.

Decision: **hold the production push/release**. The overhaul builds, most checked journeys work, and real master/tenant admin reads work. Two concrete configuration defects and an incomplete release packet remain. This is a bounded integration review, not certification of every admin module or production operation.

## Environment and scope

- Checkout: `printmaker-web-craft-main`, branch `ui-cleanup`, HEAD `c0ee02839e4329c6c8543101e4fca4d9d0222cda`, plus the pre-existing staged, unstaged and untracked work.
- Confirmed the Node listener on `127.0.0.1:8110` has this exact checkout as its working directory.
- `.env` and `.env.local` both point at Supabase project `ziattmsmiirfweiuunfo`; localhost is not an isolated disposable database.
- Chrome initially redirected unauthenticated admin access to the storefront. A real administrator session later became available and was used for the reads below. No authentication bypass was added.
- No commit, push, deploy, migration, product/template/pricing write, order save, customer message, payment, supplier submission or storage upload was performed. Test fixtures and local checkout selections are not business transactions.

## Confirmed issues

### 1. Site Design can overwrite a successfully saved box style — P2, open

Reproduction: change a product option button without saving; click its selector box directly in the preview; change the box background and press **Gem valgboks**; press the main **Gem kladde**. The final save restores the old box background.

The new button editor puts a dirty `pricing_structure` snapshot in the parent. The section-box editor ignores the new `onPricingStructureChange` prop and saves directly, so the parent retains an older snapshot. Main save then replaces the complete structure with that snapshot. The direct box save itself still works.

Source: `ProductOptionButtonEditor.tsx` preview emission; `SiteDesignEditorV2.tsx` target selection, `persistCurrentProductPricingPreview` and the section-box callback prop; `ProductOptionSectionBoxEditor.tsx` props and direct save.

**Proof:** unchanged current handlers were extracted via the TypeScript AST and executed with an in-memory database double. Writes were red then white, the independent button edit survived, quantities remained unchanged, and live requests were zero. This is a reproducible local simulation, not an attempted hosted save. Preserve this distinction.

- [Reproduction](../tmp/system-debug-20260908/section-box-save-repro.mjs)
- [Result](../tmp/system-debug-20260908/section-box-save-repro.log)

Fix and regression-test the combined parent/child save contract before release. This audit did not change the product pricing/configuration save path.

### 2. Default Salgsmapper configuration lacks its matching template — P2, open

Exact route: `/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk`.

Default selection: A4, **1 mm spine**, front-only 4+0, Chromo-karton, 50 copies. The design and template download controls are absent. Expanding the configuration explains that the correct PDF must be attached before the designer can open.

A read-only database query confirmed the tenant product (`acac7c01-2f7c-41d4-86bd-b461ed31b53e`) has one template, named `salgsmappe_A4_skabelon 5mm_ryg.pdf`. Selecting **5 mm** in the browser immediately exposes **Design i skabelon** and **Download skabelon**.

The compatibility guard is working correctly; the default product/template coverage is incomplete. Provide and validate the correct 1 mm template, or explicitly decide the supported/default product configuration. Do not reuse the 5 mm template for a 1 mm order. The smoke test intentionally retains this failure.

### 3. Support remains in platform mode inside a tenant workspace — P2, open

With a master administrator at `/admin/beskeder?force_domain=salgsmapper.dk`, the header identifies Salgsmapper and platform navigation is hidden, but **Support** offers **Kontakt en shop** and all four shops. Confirmed in the actual browser without choosing a conversation or sending a message.

`AdminMessages.tsx` uses the global master role for support reads/sends; the header uses the active tenant context. This is inconsistent operator context, not evidence that an ordinary tenant can access another tenant's messages. Related behavior existed before the overhaul; current role resolution broadens it to all master administrators.

### 4. Optional ERP shadow integration has three defects — P2, before activation

- `erp-shadow-dispatch/index.ts`: final outbox persistence errors are ignored, allowing a 202 accepted response while the row remains `dispatching`.
- Synthetic mode checks only the master tenant ID, so an ordinary master business event can pass the synthetic boundary.
- `_shared/erpShadow.ts`: backend validation accepts invalid material quantities/units, negative machine minutes and unknown fields that the strict frontend schema rejects.

Each was reproduced with unchanged code and local doubles. No gateway or real ERP posting was performed. The integration defaults to disabled and has no real-order/browser hook in the reviewed source. A live read confirmed the connected project has neither `erp_shadow_outbox` nor its migration record. These are activation blockers for the optional ERP pilot, not evidence of a broken ordinary checkout.

## Corrections made in this review

1. **Tenant support read receipts:** ordinary tenants automatically open their support conversation without `selectedTenantId`, but the previous new guard required that selection. Added `workspace/supportReadReceipts.ts` and delegated the existing update from `AdminMessages.tsx`. Tenant identity, opposite-sender and unread filters, unresolved-context rejection and master-lead exemption remain explicit. Six behavioral regression tests cover mixed shops and errors; the tenant-without-selection case failed before the correction and passes afterward. No live receipt or message was written for the regression test.
2. **Stale browser assertions:** updated `scripts/check-tenant-proof-routes.mjs` for the redesigned checkout and category pages. Checks now verify current step, visible configuration summary, usable PDF picker, selected category, rendered product count and actual product links. Tenant/session/dimensions/quantity/price assertions remain; folder template/designer requirements remain unchanged.

Rollback only these corrections by reversing the helper import/delegation and removing the two support helper/test files, and reversing this review's proof-script diff. Do not restore the entire previously dirty `AdminMessages.tsx` from HEAD.

## Current verification

| Check | Result | Boundary |
| --- | --- | --- |
| Production Vite build after support fix | PASS, 13.94 seconds | Local build; no deploy |
| Source tests | **260/260 pass**, 52 files | Six added support regressions; no hosted writes |
| Backend focused tests | **20 pass** | Includes eight ERP source tests already covered by source suite; do not add the counts together |
| Supabase migration grants / function exposure | PASS | One new migration / 56 functions; source validation |
| Commercial binding / proof-script syntax | PASS | Current script wiring |
| Owned-tenant browser smoke | **11/12 pass** | Remaining failure is default Salgsmapper template flow |
| App TypeScript | **492 diagnostics** | Not a clean typecheck; see baseline below |
| Working/staged whitespace | PASS | Does not establish release completeness |
| Staged release packet | FAIL / incomplete | Only three pre-existing staged files; staging drift |

TypeScript was compared with exact HEAD source extracted to `/tmp`, using the same installed dependencies. HEAD has 502 diagnostics; the current tree removes 33 and adds/changes 23 when comparing file and diagnostic message rather than line numbers. The additions comprise 14 test/config typing issues, seven generated Supabase product-schema mismatches, one MatrixLayout cast and the unsupported Site Design callback prop associated with issue 1. The support correction adds no diagnostics. A successful Vite build does not typecheck the whole application.

The four existing POD pricing cases ran against unchanged source through a Node/assert wrapper because their remote Deno assertion import was not cached. The three new pure backend helpers also passed Deno type checking. This is local contract evidence, not a deployed Edge runtime test.

Existing build warnings remain: approximately 8.845 MB main JavaScript / 2.151 MB gzip, plus LCMS/WASM browser compatibility warnings. No loading-performance or print-color certification was performed.

### Actual browser checks

- Master homepage → Aluminium at **120 × 60 cm** → checkout → designer at **1200 × 600 mm**, 3 mm bleed → back to checkout. Selection and summary survived. Product 307 kr + standard delivery 129 kr = 436 kr; switching delivery to express 199 kr changed the displayed total to 506 kr. These are UI observations, not authoritative server quote/payment verification.
- Designer canvas visibly rendered at the non-square size. No artwork, PDF export, account save or production-file return was performed.
- Master dashboard, 186-product headline/register, and four-shop tenant-management list loaded. Master dashboard's zero orders matched a privileged aggregate database read.
- Salgsmapper dashboard and nine-product register loaded with Salgsmapper context preserved; seven products were published and two drafts. Master-only platform navigation was absent.
- Onlinetryksager order list loaded **three** existing orders, matching the aggregate database count. **Åbn ordre** opened the order detail/editor with file section and save controls. No save or invoice action was invoked.
- Tenant-context `/admin/printproduktion` redirected to that tenant's products. The master route loaded the production overview with historical activity, four active products and no products ready for distribution. No submission or validation action was invoked.
- Tenant message workspace loaded; its master-context inconsistency is described above.
- Salgsmapper Site Design opened with its actual tenant preview iframe and selected Refined Familiar standard. The design library loaded three saved designs for the signed-in user. No editor save, publication or design opening was attempted.
- No application console errors were captured on the checked Chrome routes. Extension-origin warnings were excluded; a Framer Motion deprecation warning remains.

The observed admin layouts had no page-level horizontal overflow at desktop widths. A requested 390 px Chrome viewport override did not take effect (measured widths remained 1207/1318 px); it was reset. This run therefore provides no new mobile/tablet acceptance evidence.

These tenant checks used one **master administrator operating in tenant contexts**. They do not establish isolation for a separate low-privilege tenant account. Existing table policies and privileged SQL reads are not substitutes for that test.

An aggregate read also found one historical order with `tenant_id = NULL`. Its ownership remains unresolved; it was not reassigned or included in the scoped tenant lists.

## Release preparation and remaining acceptance

Initial status contained 337 collapsed entries and three staged files. `useColorProofing.ts` had staged and unstaged versions. Expanded untracked inventory contained 4,870 files, including 4,494 under `node_modules 2`, 14 Python cache files and 194 source files. The source additions must be reviewed and included with their imports; duplicate dependencies/caches must not enter the release. Nothing was deleted or bulk-staged.

Cached `origin/ui-cleanup` matches HEAD, but the last fetch record is from 28 July. This does not prove current upstream freshness. No fetch, merge, rebase or branch switch was performed.

Before a production release:

1. Fix and prove the Site Design save ordering; resolve the default folder/template contract; make support context consistent.
2. Verify actual save → reload for representative tenant branding, product configuration, order state and storage, using an explicitly designated safe test setup. Verify separate tenant-account denial behavior.
3. Complete the intended pilot's file/PDF → authoritative quote → payment → order → fulfillment loop. This review did not exercise those external writes.
4. Prepare the exact commit packet, review new TypeScript diagnostics, verify upstream freshness and explicitly choose any migration/function deployment scope. Leave ERP disabled until its own defects and activation acceptance are resolved.

Evidence logs are under `tmp/system-debug-20260908`: `build-final.log`, `tests-final.log`, `typecheck-final.log`, `commercial-proof.log` (original 7/12), and `commercial-proof-current-assertions.log` (11/12). These are ignored local evidence, not hosted verification.
