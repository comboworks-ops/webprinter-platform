# REA work: evidence, implementation and release status

Updated 25 October 2026. This is the current index for the Webprinter REA assessment and its follow-up work. The original dated reports remain historical evidence; their initial “not implemented” statements do not override later release receipts.

**LIVE release update:** the approved wording and product guidance are now live across all ten shop aliases. See [the final live receipt](REA_LIVE_RELEASE_2026-10-25.md). Local pilots and the remaining acceptance work below stay separate.

## What is recorded

The [system assessment](WEBPRINTER_SYSTEM_ASSESSMENT_2026-10-21.md) records the inspected public shops, competitor references, findings F01–F07, source observations and six-phase roadmap. Its scope is public browser scenarios plus source/vendor-document review. It is not a full authenticated acceptance test of every module. Public competitor material is not evidence of private implementation, API rights, conversion performance or commercial acceptance.

| Work | Current evidence/status before this release | Record |
| --- | --- | --- |
| F01 PVCbanner authoritative checkout total | Fixed and verified live; payment safeguard retained | [release](CHECKOUT_SELECTION_RELEASE_2026-10-21.md), [fresh recheck](CHECKOUT_SELECTION_RECHECK_2026-10-21.md) |
| F02 folder promotional selection handoff | Fixed and verified live, including 200/500 selections and reload | [fix](CHECKOUT_SELECTION_FIXES_2026-10-21.md), [release](CHECKOUT_SELECTION_RELEASE_2026-10-21.md) |
| F03 unfinished catalogue text | Fourteen approved text fields published; product/price preservation recorded | [review](CATALOGUE_COPY_REVIEW_2026-10-21.md), [release](CATALOGUE_COPY_RELEASE_2026-10-21.md) |
| F03 missing demo images | Seven reviewed images published; original bytes and existing records preserved | [review](CATALOGUE_IMAGE_REVIEW_2026-10-21.md), [release](CATALOGUE_IMAGE_RELEASE_2026-10-21.md) |
| F04/F05 matrix explanations and artwork guidance | Live on all ten shop aliases; exact source and representative browser checks pass | [implementation](PRODUCT_CHOICE_GUIDANCE_2026-10-21.md) |
| F06 white-label/signup claims | Two text-only page corrections released; live Webprinter signup journey verified | [continuation](REA_CORRECTIONS_CONTINUATION_2026-10-21.md) |
| Phase 2 non-A4 image approval | Deployed to all ten shop aliases with four separate source baselines; live upload approvals recorded | [fix](CHECKOUT_IMAGE_APPROVAL_FIX_2026-10-25.md), [release](CHECKOUT_IMAGE_APPROVAL_RELEASE_2026-10-25.md) |
| Phase 2 product-specific DPI/cropping warnings | Deployed: 300 DPI small print, 150 DPI wide format, 100 DPI from 6 m²/item; explicit warning acceptance tied to current artwork | [policy and release](PRINT_WARNING_OVERRIDES_2026-10-25.md) |
| Phase 2 CutContour overlap approval | Live round 30 cm Gulvfolie passed warning acceptance → approval; exported valid spot CutContour retained | [live verification](CUT_CONTOUR_LIVE_APPROVAL_2026-10-25.md) |
| Phase 3 multiple-design concept | Recorded specification and isolated interaction prototype; not a production order contract | [concept](MULTIPLE_DESIGN_WORKSPACE_CONCEPT_2026-10-21.md), [prototype](MULTI_DESIGN_WORKSPACE_REVIEW_2026-10-21.md) |
| Phase 3 integrated local workspace | Existing designer save/reopen, per-design revisions, quantity allocation and approval tested locally; hosted integration held | [local pilot](MULTIPLE_DESIGN_WORKSPACE_LOCAL_2026-10-21.md), [brochure QA](BROCHURE_WORKSPACE_QA_2026-10-21.md) |
| Brochure local checkout, delivery/VAT and contact review | Local two-design journey verified; existing quote authority retained; payment/hosted order gates disabled | [checkout](BROCHURE_LOCAL_CHECKOUT_2026-10-23.md), [delivery/VAT](BROCHURE_LOCAL_DELIVERY_VAT_2026-10-23.md), [address](BROCHURE_LOCAL_ADDRESS_2026-10-23.md), [complete QA](BROCHURE_COMPLETE_CHECKOUT_QA_2026-10-23.md) |
| Brochure approval persistence | Separate metadata receipts verified in copied in-app-browser workspace; original Chrome commit/QuotaExceededError unresolved | [investigation](BROCHURE_APPROVAL_SAVE_INVESTIGATION_2026-10-23.md), [separate approval](BROCHURE_SEPARATE_APPROVAL_2026-10-23.md) |
| Brochure native papers and price display | Local shared matrix, bounded loading and supplier-unavailable handling; 26 combinations checked, 20 available for the tested configuration | [matrix](BROCHURE_SHARED_MATRIX_2026-10-23.md), [supplier evidence](BROCHURE_SUPPLIER_AVAILABILITY_2026-10-23.md), [paper list](BROCHURE_PAPER_LIST_2026-10-23.md) |

## Remaining work and acceptance boundaries

- F03: catalogue cleanup is limited to the individually approved records; it is not an all-products readiness certificate.
- F05: general designer tool relevance still needs a product-by-product review. CutContour technical path requirements remain enforced.
- F06: the two white-label screenshot placeholders and reconciliation of actual plan entitlements/billing behavior remain open. This release changes neither subscription prices nor entitlements nor billing configuration.
- F07: targeted responsive checks exist for individual changes. A complete keyboard, screen-reader, contrast, zoom and physical-device audit is still open.
- Phase 2: actual paid order, immutable server approval/order binding and supplier/physical production acceptance are not established by the browser artwork tests.
- Phase 3: hosted private revision storage, server allocation contract, product-specific permission to split a matrix quantity across designs and fulfillment handoff remain required. Local pilot source is retained for continuation and must not be enabled for customers by this release.
- Phase 4: CompanyHub buyer/approver/admin authorization, exact revision/price approval, deduplication, status and reorder acceptance remain open.
- Phase 5: specialist booklet/bound-book/cut-letter production acceptance remains open; the round CutContour test is not a cut-letter-mode acceptance test.
- Phase 6: supplier-funded shop economics, embed/API/MIS connector acceptance and commercial package decisions remain research/backlog.

## Recording and release method

The reports and reviewed source are published on isolated GitHub branch `codex/rea-records-and-release-2026-10-25`. The record includes 28 linked reports, a source-only archive of 51 local pilot files, and an inventory of 42 retained evidence folders; every inventoried folder exists. Raw evidence is retained locally and is not all uploaded to GitHub. The repository is public: do not publish environment files, tokens, private upload links, customer/browser workspace exports or raw authenticated traces. Local raw evidence stays under `output/`; a file/hash inventory records its existence without presenting it as publicly backed up. Source-only recovery material is separate from customer data.

The release candidate starts from the exact verified current live Webprinter source (`dpl_4mwJcwxLzGhnr7BwJK2h9wAS7tCf`, 1,869 files). Only the two copy corrections and the existing matrix/artwork guidance are applied. Pricing, POD, backend/schema, tenant settings and the local multiple-design/brochure branches remain outside this release. Live warning/approval fixes are preserved.

All shops currently share one Vercel project but have four distinct source baselines. A GitHub main merge or global Vercel promotion could replace the wrong shops. Stage with `--prod --skip-domain`, verify the candidate, then assign only the approved aliases after a fresh concurrency check. Preserve every redirect and unrelated alias. Rollback is scoped to those aliases and their immediately preceding deployments; retain all files and recorded approvals.

Current audit/release evidence: `output/rea-records-release-2026-10-25/`. GitHub and Vercel publication details are in [the release report](REA_RECORDS_RELEASE_2026-10-25.md).
