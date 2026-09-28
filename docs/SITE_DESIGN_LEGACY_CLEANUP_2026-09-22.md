# Site Design legacy cleanup and scoped release — 22 September 2026

The local application now has **zero TypeScript errors**. Forty-two unused backup,
duplicate and retired source files are preserved byte-for-byte outside `src`.
The current editor, selected designs, pricing formulas and production submission
rules are preserved. No deployment or live write was performed.

## Verified result

| Check | Result |
| --- | --- |
| Application TypeScript | Previous report 171 → 0; same complete-input baseline 170 → 0 |
| ESLint across all active `src` | 2,354 → 1,980 errors; 173 → 156 warnings |
| Remaining lint error rules | Only `@typescript-eslint/no-explicit-any`; zero hook-rule or other lint errors |
| Full application tests | 536 passed, zero failed |
| Scoped candidate's affected tests | 51 passed, zero failed |
| Synthetic browser acceptance | 31 checks passed on each candidate, at 1280 / 768 / 390 pixels |
| Full current-source production build | Passed, frontend and all six server routes |
| Scoped Site Design production build | Passed, frontend and all six server routes |
| Regression gate | Clean types and no per-file/rule lint increase; deliberate type + lint regression correctly rejected |
| Recorded production baseline | All 1,184 source-manifest files matched SHA-256 |
| Final full build inputs | 1,274 source/asset/shared/config files match the working repository |
| Packaged archives | All source/build entries match their manifests after decompression |

The earlier 171 count included one missing shared-module diagnostic in the old
temporary test copy. Copying the existing shared source gives the comparable 170:
75 diagnostics were in retired source and 95 were fixed in active source. This
is not a tsconfig exclusion or rule relaxation. ESLint's ordinary command still
reports the 1,980 remaining errors; the repository is **not lint-clean**.

## Cleanup and behavior

The archive contains 24 January product-configuration backup files, 12 duplicate
copies and six retired editor/preview fragments. A scan of 976 source files and
3,260 imports found no incoming import from retained source and no nonliteral
loaders. The archive manifest records original paths and hashes. Canonical Site
Design redirects remain. This is a reviewed archive, not an exhaustive claim
that all unused code throughout the repository has been identified.

Active repairs correct existing data/type contracts: missing columns are copied
from the already captured read-only schema types; SELECT table-name casts are
removed; duplicate layout declarations use their actual shared shapes; existing
JSON and option contracts are expressed explicitly. No schema migration runs.
Fabric/worker declarations, PDF buffer ownership and validation narrowing now
match the existing APIs. Proofing algorithms, ICC assets and worker message
payloads are unchanged. Protected worker edits were reviewed and a local backup
branch was created; the patch also preserves the actual dirty before-state.

Small runtime repairs are included: the legacy supplier response no longer calls
a nonexistent price setter (the price remains in the existing configuration);
CSV attribute-group discovery accepts format/material/finish columns, while
quantity processing stays in its existing path. The existing database CHECK
already rejects quantity/price as attribute-group kinds. Pricing formulas, CSV
price parsing, product creation architecture and publishing behavior are unchanged.
Other runtime diffs are equivalent empty-catch comments, switch scopes, supported
string replacement, buffer copying, or removal of absent/ignored properties.

Two commands were added: `npm run typecheck` and `npm run check:frontend-health`.
The latter runs the original complete application TypeScript configuration and
all `src` lint rules. It fails new diagnostics or increased per-file/rule/severity
counts. Its visible baseline is existing debt, not a waiver or claim of no lint
errors. Reduce the baseline as reviewed debt is removed; do not raise it to make
a regression pass. The check is available locally; CI enforcement was not added.

## Scoped frontend candidate

The candidate starts from the recorded 16 September production source snapshot
(`dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX`), after all 1,184 original files were hydrated
and matched against its saved manifest. A fresh public read confirms all three shops return HTTP 200 with the recorded
`/assets/index-6V9acsMZ.js` entry bundle. Authenticated deployment metadata could
not be refreshed: the connected Vercel tool returned 403 for this project team.
This supports the recorded frontend baseline but does not establish every current
deployment setting. Recheck the exact deployment before rollout.

The reviewed patch has **66 changed/new source files**, the five product
presentation assets, the current lint configuration, and lockfile housekeeping.
The latter uses the verified npm lock and removes the baseline's two pnpm files;
dependency and development-dependency ranges are unchanged, as is package.json.
The candidate includes previously approved Site Design, shared buttons, product
presentations and order-flow dependencies, plus free/master-assigned access,
preview isolation and the existing disabled purchase guard. All `api/` and shared
backend source files are byte-identical to the recorded baseline.

The repository cleanup has its own patch. Its retired-source moves and unrelated
subsystem fixes are not silently added to the scoped release. Therefore the
zero-TypeScript result belongs to the full cleaned application, not an assertion
that the historical scoped baseline is free of all unrelated legacy diagnostics.

Both production builds used separate temporary dependency installations and
cached project configuration. No deployment command ran. Server packaging used
disabled package lifecycle scripts to avoid an unnecessary Supabase CLI download;
frontend compilation and all six server bundles still completed. Existing bundle
size/Browserslist warnings remain. The npm lock matches the working repository in
both build trees. The original workspace dependency installation was not replaced.

## Evidence and rollback

Evidence lives in
`output/site-design-audit-2026-09-21/legacy-cleanup-2026-09-22/`:

- `cleanup.diff`, `cleanup-changes.json`: exact cleanup before/after, including
  archival moves. Apply/reconstruction checks verify every resulting file hash.
- `scoped-site-design.diff`, `scoped-changes.json`, `scoped-source.tar.gz` and
  `scoped-source-manifest.json`: complete reviewable source candidate against the
  recorded production baseline, with a checked reconstructable patch.
- `app-production-build.tar.gz` and `scoped-production-build.tar.gz`, with separate
  manifests and build logs. The full-worktree build includes unrelated existing
  work and must not be deployed as the scoped candidate.
- Test logs/file lists, all four browser results, mobile captures, full lint/type
  reports, regression-gate proof and schema/archival evidence.
- `verification-summary.json`, `public-baseline-check.json` and `secret-scan.json`: correspondence and boundary
  checks. Cached environment files and dependency installations are excluded;
  source/build scans found no private-key/service-secret matches.

For rollback, first compare the recorded before/after hashes against any later
work. Reverse only the intended patch hunks or recover an archived file from its
`.source` copy. Do not reset the whole worktree or restore old editors into routes.
No data rollback is needed. Keep the previously deployed permission restrictions
and disabled purchase handler.

## Remaining work

1. The 1,980 explicit `any` errors and 156 warnings remain visible technical debt.
   Prioritize contract work in ProductAttributeBuilder (174), Designer (95),
   CommercialReadiness (85), EditorCanvas (83), ProductPricePanel / Pod2Admin
   (72 each), and the other admin adapters. Replacing `any` blindly with `unknown`
   or disabling the rule would conceal that work. These are separate active
   subsystem contracts, not additional retired-file deletions.
2. Before a scoped rollout, compare the candidate with the then-current deployed
   source and review any intervening changes. The candidate is prepared; release
   authorization and live/device acceptance remain open.
3. Target shop/product and available physical devices are still pending user
   input. Validate ordinary authentication/recovery, product options and totals,
   artwork upload, proof and return navigation. Any concrete payment, message,
   publication or supplier submission stays within the existing live-action
   boundary. No such action was attempted here.

The 31 browser assertions per candidate use synthetic data and block external
requests and unexpected writes. They are the same coverage run on two distinct
source candidates, not 62 unique scenarios. They do not certify authenticated
production actions or real phones/tablets. The user's connected editor was not
manually reloaded, restarted, saved or published.
