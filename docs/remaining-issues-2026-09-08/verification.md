# Verification — 8 September 2026

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Source regression suite | **322/322 pass, 59 files** | Node tests, including JavaScript integration tests previously missed by a TypeScript-only file list |
| Styling focused suite | **25/25 pass** | Shared save behavior, actual extracted callbacks/JSX wiring, existing value-setting tests; included in the source total |
| Independent styling review | **No remaining blockers in reviewed scope** | Reviewer separately reran 22 helper/integration tests and executed cancelled load effects; counts overlap the source suite |
| Refreshed isolated runtime candidate build | **PASS, 4 minutes 44 seconds** | Rebuilt from 1,079 captured runtime/config/asset files after concurrent UI changes; existing dependencies, no environment files copied or fresh install tested |
| App TypeScript | **423 diagnostics across 95 files** | Rerun after the Salgsmapper repair and concurrent UI changes; still fails. 492 at the start, 502 in freshly extracted exact HEAD with the same dependencies |
| Node/config TypeScript | **PASS** | `tsc -p tsconfig.node.json --noEmit` |
| Support browser fixture | **PASS for checked scenarios** | Actual component with synthetic auth/database adapters and blocked external connections; no hosted writes |
| Local homepage | **Rendered, no captured console errors** | Exact checkout served on 127.0.0.1:8110; does not prove hosted behavior |
| Proposed Salgsmapper matches | **80 combinations checked** | All 8 old matches preserved, exactly 4 intended 1 mm / 4+0 matches added; source-level proposed-data test |
| Saved Salgsmapper attachment | **PASS, committed 16:49:03 UTC** | One private tenant template plus one link; separate readback verifies all 580 prices and non-template business fields unchanged |
| Salgsmapper browser/export with real reads | **7 checks PASS** | Actual local frontend and saved live product/PDF, no read fixtures; production-upload bytes captured locally, no customer order/payment |
| Actual staged packet | **FAIL / incomplete** | Existing three staged files preserved; two scope-rule failures and one staged/working version mismatch |
| Remote branch | **Matches HEAD** | Read-only `git ls-remote` confirmed `ui-cleanup` at `c0ee02839e4329c6c8543101e4fca4d9d0222cda` |
| Working/staged whitespace | **PASS** | Does not prove release completeness |

## TypeScript review

The net reduction is **69 diagnostics from this task's starting tree**. No compiler checking was disabled, no source files were excluded, and dependency versions/lockfiles were not altered. Fixes cover test fixture shapes/ES2020 compatibility, the styling callback/save contract, a redundant renderer cast, and two live-schema-verified product fields in local generated types.

Exact file/message comparison with HEAD leaves seven added or reworded messages at existing invalid schema call sites: three ProductOverview-related messages, one unsupported Storformat table operation and three platform-SEO operations. Adding `tenant_id` changes generated overload text and advances one error from `tenant_id` to `finish_id`; it does not add those runtime operations. These messages were reviewed rather than silently counted as a clean typecheck. The broader schema/type debt remains.

Largest remaining groups:

| Source | Diagnostics |
| --- | ---: |
| `src/components/admin/ProductAttributeBuilder_BankUI.tsx` | 55 |
| `src/hooks/useStorformatM2Pricing.ts` | 27 |
| `src/lib/platform-seo/hooks.ts` | 26 |
| `src/components/admin/StorformatManager.tsx` | 21 |
| `src/components/admin/SiteDesignEditorV2.tsx` | 20 |

The new Support helper, styling helper and their new save integration have no reported TypeScript errors. The existing broader Site Design component still has the 20 diagnostics shown above; that distinction matters.

## Browser evidence

The Support fixture first showed platform leads, Shop A, Shop B and `Kontakt en shop` in master/platform mode. Switching to master/Shop A or ordinary tenant/Shop A, while retaining an intentionally wrong `tenantId=shop-b` URL parameter, showed only Shop A's support conversation and no platform controls. Unresolved context displayed an explicit error. A draft waiting for delayed authentication was cancelled by switching workspace; the visible in-memory log contained no insert or cancelled draft. Delayed platform reads did not repopulate the tenant view. Final tenant screenshot inspection showed no page-level horizontal overflow.

The fixture's CSS/setup is isolated and is not design acceptance for the complete authenticated admin shell. A separate low-privilege hosted session and an explicitly designated safe tenant/product are still needed for Support authorization and Site Design save/reload acceptance. Those checks performed no real message, receipt, product save, order, payment or supplier action.

The subsequent [Salgsmapper repair](salgsmapper-fix.md) did upload the verified template and save its guarded live attachment. Its browser verification reads the actual product and PDF without mocks. The Designer loads one locked nonprinting guide with the reviewed hash; customer JSON omits it. The actual downloaded and captured-production PDFs each contain one 493.998 × 366 mm page including bleed; trim is 483.998 × 356 mm, inset 5 mm. Their rendered content is identical and contains no template guides. Checkout/back-to-product retains all authoritative selection IDs, 1 mm / 4+0 / A4 / Chromo / 50 copies / 573 kr and the actual new template link. The private-row anonymous lookup returns an expected 406; the public-PDF/copied-dimension fallback succeeds. This is current local frontend plus hosted data proof, not a frontend deployment or completed order.

## Build and release limits

The candidate build retains existing LCMS/WASM/browser warnings and a main JavaScript chunk of approximately **8.886 MB / 2.168 MB gzip**. This is compilation evidence, not loading-performance or print-colour certification. No package installation or clean-machine reproducibility claim is made.

The refreshed 387-file manifest includes earlier work requiring review; it is not an approved commit. Concurrent header/layout work expanded the earlier 370-file candidate after its original build. The actual index has not been replaced by the manifest. Supabase migrations/functions, pricing/POD changes, Site Design persistence, Support authorization and full transaction acceptance remain separate release concerns. The specific Salgsmapper 1 mm template attachment is now complete.

Machine-local logs: `tmp/remaining-issues-review-20260908/source-tests-final.log`, `typecheck-final.log`, `typecheck-head.log`, `typecheck-node.log`, `candidate-build.log`, `staged-packet-final.log`, and `snapshot-hashes.json`. The [styling-only patch](styling-fix.patch) was generated from exact pre-edit snapshots and passed `git apply --reverse --check`; it was not applied or reversed.

The post-Salgsmapper refresh passed the expanded 387-file candidate build (`candidate-build-after-salgsmapper.log`) and reconfirmed 423 application TypeScript diagnostics (`typecheck-after-salgsmapper.log`). The refreshed manifest excludes its own generated inventory files to avoid self-referential hashes. The Git index remains unchanged.
