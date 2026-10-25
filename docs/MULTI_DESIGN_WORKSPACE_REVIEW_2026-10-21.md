# Multiple designs per order — local review, 21 October 2026

The user accepted the proposed next step: inspect the current upload/designer/CompanyHub foundations and prepare a local prototype before publishing.

Review: **http://127.0.0.1:8953/**

Status: local interaction prototype only. No production source route, pricing engine, matrix, hosted product, uploaded file, database schema, payment or supplier operation was changed. The repository's existing dirty work and the user's other local servers were preserved.

## What can be reviewed

The bounded example is one two-sided A5 flyer specification, 135 g paper, 1,000 total copies, initially allocated 600/400 between two designs. These are illustrative choices, not a live product selection or commercial quote. No price is invented or recalculated.

- Actual locally generated two-page example PDFs, rendered as front/back previews.
- Add and name designs; allocate positive integer quantities; prevent completion until the quantities add to 1,000 exactly.
- Select a real local PDF, calculate its SHA-256 with the existing checkout artifact helper, and check page count and visible page dimensions.
- Preview and approve each current design separately. Approval is bound to specification, quantity, file hash, revision identity and front/back ordering.
- Replacement retains the previous file, appends a revision and invalidates only the affected approval. Quantity changes also invalidate the affected approval.
- Swap front/back as a new revision. Earlier PDF bytes are retained; page mapping is explicit in the review export.
- Download earlier original PDFs; restore an earlier version as a new revision requiring a new review.
- Remove a design from allocation without deleting it; restore it through the archive section.
- Save drafts, actual file blobs, previews, revisions and local visual approvals in IndexedDB. Reload restoration is exercised.
- Review the combined allocation and download a local JSON review summary. It explicitly records `productionAuthorized: false`, `quoteValidated: false` and `companyApprovalVerified: false`.

Files remain on this browser origin. Browser data is not a cloud backup. There is no order/payment action in the prototype, and no existing live checkout session is read or overwritten.

## Existing foundations inspected

| Existing source | What it already provides | Connection still needed |
| --- | --- | --- |
| `src/lib/checkout/siteCheckoutSession.ts` | Product/tenant identity, quantity, options, quote, template geometry, uploaded artifact and designer export | Add design allocation/revision identities without replacing or modifying the existing quote authority. Alternate export formats are not separate designs. |
| `src/lib/checkout/checkoutArtifact.ts` | Chunked SHA-256 of exact file bytes | Reused directly by the local prototype. Preserve one hash per immutable revision in hosted integration. |
| `src/lib/pdfDocumentOptions.ts` | PDF.js options with evaluation disabled | Reused directly. Worker is served locally for this prototype. |
| `src/lib/checkout/proofArtifact.ts` and `src/pages/FileUploadConfiguration.tsx` | Placement/geometry fingerprint, required export, current-proof approval and preflight readiness | Extend current-artifact checks per design; never treat local visual approval as final production acceptance. |
| `src/lib/checkout/privateUploads.ts` | Existing private upload/access-capability path | Reuse for eventual authenticated storage; prototype deliberately performs no remote uploads. |
| `src/lib/company-hub/checkout.ts` and `requestService.ts` | Company-scoped request context, validated quote/quantity, approval request and checkout linkage | Keep company purchase authorization separate from artwork visual approval. Bind the approved design manifest to the existing request snapshot. |
| `src/components/companyhub/v2/CompanyDesignsView.tsx` | Approved templates, personalisation, working-design creation and continuation | Resume the chosen design revision through the existing designer instead of creating a parallel designer. |
| `supabase/functions/_shared/storefrontCheckout.ts` | Validated private file references/hashes and an existing limit of 1–8 production files | An array of files is not yet an allocation contract. Server must validate design identities, page pairing, quantities, product eligibility and immutable approved revisions. Preserve existing payment/finalizer checks. |

## Important boundaries before connecting checkout

1. Confirm an eligible flyer product and its production/price rules. Do not assume that several originals qualify for the same total-quantity matrix price. If the existing commercial rules do not support that split, keep it unavailable until explicitly agreed; do not silently change pricing.
2. Preserve the existing selected product, options and verified quote. A material, size, finish or total-quantity change must return to the existing configurator and invalidate/recheck affected artwork. Different specifications become separate product lines.
3. Use private, tenant/customer-authorized hosted revisions and validate the current artifact hash and front/back mapping on the server. The browser's JSON export is untrusted review material, not an order payload accepted by production.
4. Retain originals, previous approvals and file-check evidence. Server acceptance must reject stale revisions and mismatched or missing files. Reordering pages requires a correctly materialized production PDF or a producer-supported, validated mapping.
5. Keep full technical preflight, company purchase approval, payment acceptance and production acceptance separate. Test them in an isolated environment before release.

## Verification

- Eleven pure behavior checks pass: exact/integer allocation, missing files, failed checks, independent replacement, quantity invalidation, unchanged quantity, specification/page-order binding, incomplete approvals, safe summary flags, reversible archive and unique revisions.
- Browser verification passed at **1440, 1280, 1024, 768, 390 and 320 px**. No document overflow; all four initial PDF previews load. The 320px progress navigation initially overflowed; measured cause was the final progress label. A narrow layout with labels below their numbered steps resolves it without hiding content.
- Browser interactions exercised independent approvals, mismatch gating, real PDF replacement, old-file retention, reload persistence, front/back swap, invalid one-page PDF, restore to revision five, missing-file design, archive, JSON download and a long design name in a 320px modal.
- No page errors and **zero external requests** in the isolated browser run. External traffic was blocked during verification.
- Scoped ESLint passes. Isolated Vite build passes. Existing PDF.js dependency produces its known eval warning (the shared helper enforces `isEvalSupported: false`), and the bundled PDF libraries produce a large-chunk warning. This prototype build is not a production release artifact.
- Listener verified as Node PID 3602, loopback 127.0.0.1:8953. HTTP response and actual browser rendering verified.

Evidence: `output/multi-design-workspace-2026-10-21/` — six initial screenshots, mobile review, desktop summary, `browser-verification.json`, a local review export and synthetic replacement/wrong-page PDF fixtures. QA ran in an isolated browser context; its altered design names and revisions do not replace the user's fresh review state.

## Files and continuation

Source: `prototypes/multi-design-workspace/` (`main.js`, `files.js`, `model.mjs`, tests, scoped stylesheet and isolated Vite config). Existing layout tokens and the two checkout/PDF helpers are imported without edits. No packages were added.

To start again, run the project's Node runtime with `node_modules/vite/bin/vite.js --config prototypes/multi-design-workspace/vite.config.mjs`. The dedicated config has environment-file loading disabled and does not load the live application entry point.

Next gate: user review of this interaction flow. Then implement an additive connection to the existing selected-product/designer/checkout contracts and validate the authenticated approval/production handoff separately. Nothing in this prototype has been published.
