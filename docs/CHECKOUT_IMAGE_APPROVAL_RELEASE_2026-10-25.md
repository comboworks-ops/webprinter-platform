# Checkout image approval release — 25 October 2026

User authorized deployment to Webprinter and all live shops, and live upload
approval verification. No payment or order submission is needed for this test.

## Release and rollback plan (before deployment)

The release uses each current live deployment's exact source, verified against
Vercel SHA-1 source manifests. Only the image-PDF geometry validator and its
regression tests change. The dirty repository is not deployed. Four independent
builds preserve the distinct existing versions:

| Group | Previous live deployment | Domain assignments |
| --- | --- | --- |
| Webprinter | `dpl_Fy5A8T6Vj8dRBE1vVa26iBfWFJyy` | webprinter.dk, www.webprinter.dk |
| Online | `dpl_2R9x5SS5g8bUYVVhZFuRR8RCZ3AJ` | onlinetryksager.dk, www.onlinetryksager.dk, printmaker-web-craft-main.vercel.app |
| PVC / Salgsmapper | `dpl_HWNxjjUjoPZLkisGfrG2wZzYJRMu` | pvcbanner.dk, www.pvcbanner.dk, salgsmapper.dk, www.salgsmapper.dk |
| General shop address | `dpl_7zsMZnUB1P1iX9j8jah2c6KuJAKz` | printmaker-web-craft-main-thomas-projects-d80b9ddd.vercel.app |

All builds are staged with production settings and `--skip-domain`. Never use
global promotion on this project with separate live source versions. Activation
must check the current alias mappings against the captured baseline, assign
only these ten aliases, preserve redirect metadata, then verify every mapping.
The remaining Git branch preview aliases are not shop releases.

Rollback: check for newer releases first, then restore only each group's listed
aliases to its previous deployment above, preserving redirects. No database,
Edge Function, pricing, tenant branding or settings change is part of this
release. Keep synthetic QA uploads for evidence; no file deletion is required.

Evidence: `output/checkout-image-approval-release-2026-10-25/` contains exact
source manifests, candidate scopes, deployment/alias receipts and live checks.
Local root cause and regression details:
`docs/CHECKOUT_IMAGE_APPROVAL_FIX_2026-10-25.md`.

## Released and verified live

All four production builds are READY and active on their intended aliases:

| Group | New live deployment | Verified source files | Served entry |
| --- | --- | ---: | --- |
| Webprinter | `dpl_FyGCWspQHBCoN1VGK3sBqXab3hEe` | 1,865 | `/assets/index-DEJC8BMk.js` |
| Online | `dpl_5ri29SvhCBS2aSNT1huwG3FJakpj` | 1,858 | `/assets/index-D4J2CWP1.js` |
| PVC / Salgsmapper | `dpl_EMnZ1n2KKNyVCKtHyWZ3AfoJTFWU` | 1,862 | `/assets/index-SMwDDEJo.js` |
| General shop address | `dpl_BTWMmBA8qjaHevYcaZe49a5udGGM` | 2,720 | `/assets/index-CQgUZHaJ.js` |

All 8,305 uploaded source hashes match their reviewed candidates. In each
candidate, only `src/lib/checkout/imageProofPdf.ts` and its regression test
differ from that group's exact prior live source. The actually served lazy
PDF module was inspected for the eight-field numeric allowlist before
activation. The 16 candidate regression tests pass; the prior local focused
15-test suite, application TypeScript, lint and production build also pass.

Final live verification checks all 36 existing alias mappings: ten intended
shop aliases updated, 26 other aliases unchanged, and every redirect and
redirect status preserved. All ten shop addresses return HTTP 200 (following
their existing redirects) and serve the expected entry and exact compiled
approval-helper hash. The protected general address was checked through the
existing Vercel CLI authorization; deployment protection was not disabled.

## Actual customer upload approval

A synthetic PNG of 1200 × 1800 pixels was uploaded through the normal public
checkout UI. The source is non-A4 and smaller than the selected print surface.
No mocked API, injected checkout state or test-mode checkout was used.

Before activation, Webprinter reproduced the exact reported error after a
successful upload/resolution check. After activation and normal reload, the
**same uploaded file** successfully became `webprinter-qa-non-a4-1200x1800-tryk.pdf`
and displayed `Din trykfil er godkendt`.

| Live shop | Actual product | Approval result |
| --- | --- | --- |
| Webprinter | A5 Flyers | Approved; generated PDF; payment button enabled |
| Online Tryksager | A5 Flyers | Approved; generated PDF; payment button enabled |
| Salgsmapper | Standard Salgsmapper, selected A6 template | Approved; generated PDF; payment button enabled |
| PVCbanner | 100 × 100 cm PVC Banner | Approved; generated PDF; payment button enabled |

No contact details were entered, and no payment button was clicked or order
submitted. The QA source images and generated private PDFs are retained.
Screenshots, rendered UI text and structured results are under the evidence
directory (`browser-verification.json`, `*-after.jpg`, `*-after.txt`). The two
general addresses have source/compiled-code/route acceptance; their own separate
browser checkout was not repeated. Trykker had no purchasable product/custom
domain in the earlier inventory; no new Trykker checkout acceptance is claimed.

## Operational notes

Vercel's connector lacked team access. The existing authorized CLI connection
verified the exact team/project and performed the bounded releases. Builds ran
in the existing queue, without changing concurrency or project settings. A CLI
curl `--scope` placement was corrected after its wrapper passed the option to
native curl; no application code or protection setting was changed for this.
One browser file-picker timeout recovered using the same visible native
upload button; normal live upload and approval then passed.

No dependencies or lockfiles changed. A fresh documented npm Bulk Advisory
lookup against the unchanged production locks returned the same existing
19 packages with advisories (2 critical, 32 high, 17 moderate, 5 low advisory
entries). This is not a clean audit or a full npm meta-vulnerability graph;
no dependency update was included in this bug-fix release.

The bounded post-release runtime error scan returned zero error entries for
all four new deployments (last hour, maximum 20 entries each), with all four
commands successful. See `runtime-error-scan.json`. This covers Vercel runtime
logs; no Supabase log audit is claimed. Continuous monitoring/drain configuration
was not changed or separately audited.
