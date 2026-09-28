# Remaining issues: implementation and release review

8 September 2026. This follow-up preserves the existing dirty checkout and Git index. It supersedes the open-issue status in `docs/SYSTEM_DEBUG_REVIEW_2026-09-08.md` only where evidence below explicitly says so. **Production release remains on hold.**

## Local fixes

**Site Design:** product styling saves now apply the fields actually edited against the latest tenant-owned product. The existing `updated_at` revision guards concurrent updates, and a failed or zero-row write cannot be reported as saved. Button, box, broad product-options and main draft saves reconcile their pending changes. Late loads and acknowledgements are tied to the selected product/option. Prices, quantities, option identities, templates and unrelated structure fields are preserved. Regression tests execute both the shared save logic and callbacks extracted from the actual components; this is local simulation, not hosted save/reload proof.

**Support:** platform mode now requires a master account in the active master workspace. Tenant-context reads, sender roles, receipts and controls follow that tenant. A mismatched conversation URL cannot select a different tenant in tenant mode. Workspace switches clear the old view, discard delayed reads and cancel queued sends that are still waiting for authentication. Existing receipt filtering and the platform-lead exemption remain. No RLS or authentication policy was changed.

The actual Support component was browser-tested with isolated adapters at port 8121: master/platform, master/tenant, ordinary tenant, deliberately wrong conversation ID, unresolved workspace, delayed reads and a cancelled pending send. The tenant view displayed only its own conversation and had no platform controls or horizontal overflow. The fixture has `connect-src 'none'`; all receipt/send operations are in memory. This does not establish hosted tenant-account isolation. The public local homepage at port 8110 rendered normally with no captured console errors.

**TypeScript:** fixed the new test-fixture typing errors, the unsupported Site Design callback contract, and an unnecessary Matrix Layout cast. Updated only the existing `products.tenant_id` and `products.pricing_structure` fields in local database types. Their UUID/non-null and JSONB/nullable definitions were verified through live `information_schema` reads; no database schema was changed. The live product timestamp trigger was also confirmed by a read-only metadata query. Installed dependency versions and lockfiles were not changed by this work.

## Salgsmapper: 1 mm attachment saved and verified

Thomas subsequently asked to proceed with the reviewed current supplier construction. The 1 mm / 4+0 template is now attached to the live product; the original 5 mm binding and all 580 prices/options are unchanged. Designer QA caught and corrected two issues in the earlier proposal: bleed was counted twice, and the unprinted inside reference would become a second export page. The corrected outside-only derivative produces one approximately 494 × 366 mm page including 5 mm bleed.

Read [the executed repair and verification](salgsmapper-fix.md). Actual Designer/export and configuration-return checks pass with real backend reads and no product/template/PDF read fixtures. This proves the saved attachment through the current local frontend, not a frontend deployment. The [earlier construction comparison](salgsmapper-template-review.md) remains historical evidence. No price, default, option or publication state was changed.

## Exact release review

- [Runtime candidate manifest](runtime-candidate.tsv): individual current source/asset paths, SHA-256 hashes, sizes and review buckets. This includes existing changes from earlier tasks, not only this follow-up.
- [Changes held separately](held-changes.tsv): documentation, tooling and Supabase changes outside that runtime candidate.
- Required `gsap.min.js` and `preview-bridge.js` files under `public/platform/landing/motion/` were previously hidden by the global JavaScript ignore rule. Explicit exceptions now make both eligible for the release. Source `.test.mjs` files are also eligible so existing regression coverage is not silently omitted.
- An isolated runtime snapshot is assembled under `tmp/remaining-issues-review-20260908/runtime-candidate`, using the manifest's tracked and new source/assets and the existing installed dependencies. No environment files or temporary fixtures are copied. Snapshot hashes and the tracked runtime patch are retained beside it.
- GitHub's current `ui-cleanup` tip was rechecked and matches local HEAD `c0ee02839e4329c6c8543101e4fca4d9d0222cda`. No fetch/merge/rebase or branch change was needed.
- The actual index is deliberately unchanged: `.agent/workflows/soft-proof-protected.md`, `SYSTEM_OVERVIEW.md`, and `src/hooks/useColorProofing.ts`. The first two are outside the existing packet checker's allowed categories; `useColorProofing.ts` still has additional unstaged edits. Its working version depends on new export-scale code and updated callers, so releasing only its staged version would omit part of the current implementation.

The manifest is a review candidate, not permission to stage all 387 files. Concurrent header/layout work expanded the original 370-file candidate; the refreshed snapshot captures 1,079 runtime/config/asset files. It includes prior pricing/POD changes requiring their own scope review, while 13 Supabase entries remain a separate deployment decision. Duplicate dependencies, Python caches, local Supabase metadata and fixture servers are excluded. No commit, push, deployment or migration was performed. The subsequent Salgsmapper repair made only the explicitly described PDF upload and template attachment.

## Validation and remaining limits

Final evidence counts and the isolated candidate build result are recorded in [verification](verification.md). A production Vite build passes; the application still has a substantial TypeScript baseline and is not type-clean. The earlier July commercial packet reports must not be treated as current proof.

Before release: verify Site Design save/reload in a designated safe tenant/product; verify Support with a separate low-privilege account; review the remaining TypeScript debt, manifest's prior pricing/POD and any backend scope; then stage the exact approved files, validate the index and rerun the release gates. Full payment/order/fulfilment acceptance remains outside this follow-up.

Rollback must reverse only these new changes, preserving earlier dirty edits. Exact pre-edit snapshots of the four styling components are in `tmp/styling-fix-20260908/`. Support changes should be reversed by their workspace-scoping hunks, not by restoring all of `AdminMessages.tsx` from HEAD. The local type changes and ignore-rule additions are isolated hunks. Salgsmapper has its own guarded database rollback linked from the executed repair report.

The ignored `tmp/` evidence is machine-local. The TSV manifests and this report can travel with the review; retain the source/PDF evidence separately if transferring the task to another checkout.
