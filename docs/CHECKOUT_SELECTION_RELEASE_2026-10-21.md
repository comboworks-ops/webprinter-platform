# PVCbanner and Salgsmapper scoped release — 21 October 2026

Status: **live and verified**, approximately 11:47 CEST. Authorized by the user's explicit request to deploy these two fixes and verify both live journeys without ordering or paying.

## Release scope

- Deployment: `dpl_HWNxjjUjoPZLkisGfrG2wZzYJRMu`.
- Previous deployment for both shops: `dpl_2R9x5SS5g8bUYVVhZFuRR8RCZ3AJ`.
- Updated only `pvcbanner.dk`, `www.pvcbanner.dk`, `salgsmapper.dk`, `www.salgsmapper.dk`.
- All 31 other existing project aliases remain on their prior deployments. Existing redirects are preserved, including Salgsmapper apex → www with HTTP 307.
- The release was reconstructed from all 1,858 verified source files of the actual live deployment. It does not include unrelated dirty-worktree changes.
- Four existing files changed: featured-product link, product-page handoff initialization, matrix selection initialization, and the frontend-imported tax policy's existing approved PVCbanner tenant entry. Four helper/test/check files added. No files removed. The live matrix's newer `withMatrixRowSelection` behavior was preserved.
- Pricing formulas, matrix values, tax rate, price-matrix rendering, dependency manifests, backend API handlers and deployment configuration were preserved. 65 pricing/configuration files were individually verified hash-identical to the prior release.
- No database writes, migrations, Edge Function deployment, payment configuration changes or supplier actions.

## Verification

The isolated release passed all 16 focused tests and the hosted production build. Its TypeScript check has the same five missing-test-helper diagnostics as the exact prior release, with zero new diagnostics. The separate dirty working-tree check reported in the implementation note is not this release candidate's check.

Before activation, source hashes of all 1,862 uploaded files were checked against the intended manifest. The exact served bundle passed the four-shop tax policy check. Both protected staged journeys passed using existing authorized access, without disabling deployment protection.

After activation, fresh Chrome sessions used the public shop domains and confirmed:

| Journey | Live result |
| --- | --- |
| Salgsmapper homepage → Bestil nu → product → reload → checkout | 200 pieces, A6, 350 g matt silk, 739 kr ex. VAT retained; checkout 985 kr including 49 kr delivery and VAT |
| PVCbanner product → checkout | 100 × 100 cm, eyelets, 1 piece, 399 kr ex. VAT + 49 kr delivery + 112 kr VAT = 560 kr; no tax/payment-total warning |

No JavaScript page errors occurred. Verification had a network guard against order/payment/upload/supplier actions, and no blocked commerce requests were attempted. No customer information was entered, artwork uploaded, order placed or payment initiated. Payment processing and production acceptance remain untested.

All four public domains returned the verified entry `/assets/index-CtxBje4M.js`, SHA-256 `4d2178f46cd702c69a506b66305c7fdf9baf7f5f471d9197e89bb81b5859ed7e`. This is the same bundle inspected and tested before activation.

The unrelated Salgsmapper copy mismatch remains: the selected offer is A6 while existing descriptive copy says “100 stk A4 salgsmapper”. No catalogue copy or price data was changed.

## Evidence and recovery

Evidence directory: `output/checkout-selection-release-2026-10-21/`.

Key receipts: `scope-verification.json`, `pricing-and-config-preservation.json`, `staged-verification.json`, `activation-receipt.json`, `live-assets-verification.json`, `browser/live-journeys.json`. Screenshots and rendered text for both live journeys are under `browser/`. `release.patch` records only the four modified files against the verified live baseline; added files are retained in the isolated source candidate.

Retained isolated release source: `/private/tmp/webprinter-checkout-selection-release-20261021`. The working repository's unrelated changes remain untouched. Source hashes and deployment-source manifests allow recovery of the exact uploaded source from Vercel.

Recovery is scoped to these same four aliases, preserving redirect metadata. The prior deployment is recorded above for emergency recovery, but switching PVCbanner back to it would restore the original tax-verification warning. Prefer a corrected forward release retaining PVCbanner's approved tax entry. A selection-only rollback should revert the three selection UI changes while retaining the tax fix. No rollback was performed.
