# WebPrinter 3D product previews

Checkpoint: 30 September 2026. Read this to continue in a fresh chat.

**Live Salgsmapper update:** standard folders and the three finished-folder products now resolve exact templates and 3D previews. Thomas selected both 1 mm and 5 mm for laminated, UV-varnish and Spot-UV folders. The finished products add 180 links for A4/A5/A6/M65/21 × 21 cm, with current price rows preserved. Spot-UV requires a professional PDF mask; other finished folders support online Designer. See [FINISHED_FOLDER_CONNECTIONS_2026-09-30.md](../FINISHED_FOLDER_CONNECTIONS_2026-09-30.md) for live evidence, rollout status and rollback. This supersedes the earlier missing-template construction choice for those three products.

## Current result and authorization

Thomas approved the 10 mm A4 folder and requested **all sales folders automatically in one batch**, including A6, A5 and **M65**. That request supersedes the older one-model-at-a-time pause for sales folders. Individual visual approvals 001–007 are preserved; batch authorization is recorded separately from individual approvals.

**143 sales-folder review variants are built from 1,421 verified PDFs / 79 measured geometries.** A4, A5, A6, M65 and 21 × 21 cm cover all linked capacities, flap/window/closure constructions and 4+0/4+4 print sides.

**142 configured catalogue variants are integrated locally** across product media, Designer and checkout. The older A4 5 mm PDF is modelled but review-only because its product link lacks configuration conditions. The batch was subsequently released through the shared system. See the live Salgsmapper checkpoint above for tenant-specific links and the remaining acceptance boundaries.

Open [all sales folders](http://127.0.0.1:8160/sales-folders-review.html). Details and evidence: [SALES_FOLDER_BATCH.md](SALES_FOLDER_BATCH.md).

## Preserve these rules

1. Read `POD2_README.md`, `AI_CONTINUITY.md`, `SYSTEM_OVERVIEW.md`, `.agent/HANDOVER.md` in order. Preserve unrelated dirty work, pricing, tenant branding and open drafts.
2. `plan.json` is the canonical queue. Use `userApproval`, `batchAuthorization`, `batchVerification`, `modelStatus` and `integrationStatus`. Do not reseed it.
3. Match exact SHA-256 and sheet dimensions. Keep unknown or mismatched selections on their existing fallback. Product-owned presentation rules and remapped tenant option IDs still apply.
4. 4+0 folder template PDFs generally have two pages but only one printed artwork spread; the grey inner reference is not artwork. 4+4 requires separate outside and inside artwork. Never mirror the outside onto the inside.
5. Preserve professional-PDF-only variants and all existing creation, Designer, proof, pricing and publication gates.
6. Default illustration: active shop colour, large white reader numbers, page 1 Forside and final page Bagside. Uploaded artwork retains its colours.
7. Existing individually approved 3/5/10 mm A4 definitions and renderer remain in use for their three exact hashes. The batch extends the system additively.

## File map

| Responsibility | Files |
| --- | --- |
| Exact identity registry and bleed handoff | `src/lib/mockup/approvedPrintModels.ts` |
| Batch geometry/identities | `src/lib/mockup/salesFolderModels.generated.ts` |
| Batch fold/data contract and numbering | `src/lib/mockup/salesFolderDefinition.ts`, `salesFolderArtwork.ts` |
| Shared rendering | `src/components/mockup/PrintPreviewSurface.tsx`, `SalesFolderViewer.tsx` |
| Product selection | `ProductPrice.tsx`, `ProductPrintMedia.tsx`, `useApprovedPrintModel.ts` |
| Artwork handoff | `Designer.tsx`, `FileUploadConfiguration.tsx`, `src/lib/mockup/printModelArtwork.ts` |
| Existing A4 approved geometry | `spineFolderDefinition.ts`, `fiveMmFolderDefinition.ts`, `tenMmFolderDefinition.ts` |
| Batch review | `sales-folders-review.html`, `src/dev/SalesFoldersReview.tsx` |
| Reproduction scripts | `scripts/3d-review/` |
| Batch evidence | `output/3d-review-queue/sales-folder-batch/` |

`MODEL_REVIEW_TEMPLATE.md` is reusable. `NEXT_REVIEW.md` remains intentionally empty. Existing review links remain available. Regenerate the queue board using `python3 output/3d-review-queue/render.py`.

## Verification and boundaries

46 focused mockup tests, whole-app TypeScript, scoped lint and application production build pass. All 143 review variants rendered/unfolded in the browser. A6 separate inside/outside PDF artwork, wrong-size/count rejection, artwork preservation/reset, and six responsive widths passed. See the batch report for exact coverage and model limitations. Local evidence does not prove hosted authenticated uploads, publication, order acceptance or a physical folding sample.

The catalogue product `42a270bb-d2b1-4e98-9d04-aaa7d3d33401` (`salgsmapper-med-eget-design`) was unpublished at the inventory checkpoint. Product publication remains separate. Other products without template links remain parked.

Workspace: `/Users/thomasprintmaker/Projects/printmaker-web-craft-main`. Port 8160 was verified serving this checkout. Check its current owner before reuse; preserve users' unsaved tabs. The canonical leaflet product is `/produkt/wmd-folder-bank-891a5cf1`; the older duplicate has an unrelated calculator problem, outside this work.

## Continue

> Read docs/3d-review/PROJECT.md and continue from this checkpoint. The complete linked-template sales-folder batch is built locally, including M65, A5 and A6. 10 mm is approved. Preserve the batch and existing individual approvals. Continue requested corrections or the remaining non-folder queue; do not ask for the superseded one-at-a-time sales-folder approvals. Deployment, missing-template links and the ambiguous legacy 5 mm product mapping remain separate.
