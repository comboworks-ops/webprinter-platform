# REA records and scoped Vercel release — 25 October 2026

The REA assessment and subsequent work are reconciled in [the status index](REA_WORK_STATUS_2026-10-25.md). The original assessment overstated the current backlog by retaining its initial “not implemented” wording; the index now links each completed fix to its dated receipt and separates local pilots from live acceptance.

**Follow-up:** Thomas approved the live rollout. All ten shop aliases are now live; see [the final release record](REA_LIVE_RELEASE_2026-10-25.md). The staging history below remains retained.

## GitHub recording

Published to GitHub branch `codex/rea-records-and-release-2026-10-25`, based on main `92f060b53cdfef0f98a9be7c7925f309eb3f105b`. Review: [draft PR #19](https://github.com/comboworks-ops/webprinter-platform/pull/19). Source/record checkpoint: `9669e23c1fbf371bba8310a97c4aa4420ab9ed86`; a subsequent documentation-only receipt commit records these publication links.

- Separate first commit `f7208c5` records the current live Webprinter application baseline, which had moved beyond GitHub main. This is source recording of already-deployed behavior, not 217 newly released changes.
- Twenty-eight related reports are indexed. This release report is an additional receipt.
- `docs/rea/2026-10-25/local-only-pilot-source.zip` records 51 source files for local multiple-design/brochure continuation, including shared integration snapshots. The matching manifest records each file hash. This archive does not enable the pilot for customers and must not be restored wholesale over the current checkout.
- Forty-two retained local evidence folders exist and have a path/size/hash inventory. Raw screenshots, private upload links, browser workspace exports, authenticated traces and original PDFs are not all backed up to GitHub. They remain locally preserved under `output/`.
- No environment files, tokens, personal artwork or browser databases are included. Explicit source/report selection and a secret-pattern check were used; this is not a security certification.

The shared checkout, its current branch and pre-existing staged/unstaged work remain intact. The GitHub recording uses a separate clone; no shared index reset, cleanup or force-push is used.

## Actual new runtime delta

The deployment candidate is reconstructed from all 1,869 verified source files of the current live Webprinter deployment `dpl_4mwJcwxLzGhnr7BwJK2h9wAS7tCf`.

Only four existing runtime files change, with four helper/component/test additions:

- White-label calls to action say “Opret din shop”; text explains account creation and subscription checkout without the unsupported no-card promise.
- Signup describes a product catalogue according to the selected plan instead of promising all products.
- Matrix choices explain 4+0, 4+4 and lamination. Existing automatic material/quantity changes receive an observational before → after notice; the helper does not select values or calculate prices.
- Both existing artwork panels explain upload, designer/template and template download. Existing handlers, professional-PDF restrictions, stable layout and selected tenant branding remain.

All other 1,865 baseline files match. Current non-A4 approval and DPI/CutContour warning overrides are retained byte-for-byte. No pricing/POD calculation, API handler, dependency/configuration, schema, Edge deployment, tenant setting, payment or publishing-flow change is included in the new runtime delta. Local multiple-design and brochure checkout integrations are excluded.

## Verification

- Thirty-five focused tests pass, including selection notices, retained checkout files/selection, material presentation, image proof generation and product-specific warning policy.
- TypeScript reports only the five existing missing roll-label test-helper module diagnostics already present in this live baseline. It is not a clean typecheck claim.
- New modules are lint-clean; normalized before/after comparison retains exactly 106 existing findings, with no added messages.
- The exact local candidate passes the revised white-label link → signup journey. The real laminated-folder matrix preserves its 1,645 DKK selection when opening explanations; softfeel shows the existing material change and 530 DKK price; manual 75-copy selection clears the automatic notice; switching to A5 reports 75 → 100 with the existing 1,714 DKK selection. No signup, upload, order or payment was submitted.
- Desktop browser width and document width both measure 1,202 px, no application console errors, and no local-only multi-design launch is exposed. Earlier six-width checks remain in the implementation report; a fresh six-width hosted test is not claimed here.

## Vercel staging and recovery

The clean production-target candidate is staged without assigning any live domain:

- Deployment: `dpl_Edtv5bbmTabSpaJ6DYBjyz9n9oB5`.
- Review URL: https://printmaker-web-craft-main-a4trlhawk-thomas-projects-d80b9ddd.vercel.app
- Team/project: `team_nmuMQas8BCWeDkJKfxxMv3Ab` / `prj_TtU0kZ4gkQ505dpNiNuOdnBBzmCx`.

The clean cloud build is READY. All 1,873 uploaded source hashes match the candidate manifest; all 36 existing aliases and redirect values remain unchanged. Companion machine receipts record the final hosted asset checks. Existing Vercel authentication is used for protected HTTP verification; deployment protection remains enabled. Browser interaction evidence comes from the exact local candidate and is distinct from hosted HTTP/source verification.

The first staged build, `dpl_3Tgps5XTNFfqxkJrbZx29NZeiuNM`, included 198 generated `.vite` cache files after local QA. Every expected application source matched, but the strict source check correctly rejected the extra packaging. The owned QA listener was stopped and the cache moved to retained evidence outside the candidate; the identical application source was restaged. The first attempt remains preserved and was never assigned to a shop.

Live target selection was subsequently approved: Webprinter and all existing live shops. The four shop source baselines and existing 36 aliases/redirects must remain distinct. Do not globally promote or merge to the auto-deploying main branch. An all-shop release requires applying the same small delta to each exact current live source and verifying each candidate; this Webprinter candidate must not replace the other cohorts.

No live rollback is needed for a staged-only release. If later activated, first capture the immediately preceding mappings and restore only the approved aliases after checking for concurrent releases. Preserve all uploads, original artwork, customer acknowledgements, local drafts and retained evidence. No database rollback or deletion is required.

Local release evidence: `output/rea-records-release-2026-10-25/`. Compact source manifests, recording inventory and validation receipts are retained under `docs/rea/2026-10-25/` in the GitHub review branch.
