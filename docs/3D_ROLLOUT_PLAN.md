# WebPrinter 3D rollout plan

**Canonical status:** `docs/3d-review/plan.json`. This file and the browser board are generated views.

Last reviewed: 2026-09-28 · Status: active

Build accurate product previews from exact templates. The complete sales-folder batch is authorized for automatic local implementation; other product families retain individual review.

## Decisions

- 2026-09-28: Start with products that already have linked templates; park unlinked products until exact templates are available.
- 2026-09-28: Build one review candidate at a time. Thomas approves or requests corrections before the next candidate is treated as approved.
- 2026-09-28: Review each fold, format, direction, spine width and print-side mapping explicitly. Geometry can be reused only after template equivalence is demonstrated.
- 2026-09-28: Approval covers the named model revision and exact PDF fingerprints. It does not approve other variants, publishing or live product writes.
- 2026-09-28: Proposed starting order is A7 flyer, DIN Lang half fold, DIN Lang roll fold, DIN Lang zigzag, then A4 two-flap 3/5/10 mm spine variants.
- 2026-09-28: Thomas approved A7 candidate 001 revision a7-flat-4plus0-r1 and requested the next candidate. DIN Lang half fold 002 built for review; approval is still pending.
- 2026-09-28: Thomas approved DIN Lang half-fold geometry and requested continuation. Review colours are provisional; preserve tenant/WebPrinter branding during integration. Candidate 003 roll fold is built and awaiting review.
- 2026-09-28: Thomas approved roll-fold r1 and explicitly requested implementation on individual products with WebPrinter colours. Approved 001–003 are connected locally to product media, upload/checkout and Designer; zigzag 004 remains awaiting visual approval.
- 2026-09-28: Thomas requested one illustration standard for every model: large white reader-page numbers on the active shop blue/brand colour, page 1 labelled Forside and the final page Bagside. Applied to A7, half fold, roll fold and zigzag review; carry this standard into each remaining construction. Customer artwork keeps its own colours. Unprinted 4+0 reverse faces remain white.
- 2026-09-28: Thomas approved zigzag candidate 004 and requested the next step. Enable its exact template fingerprint locally; next visual review is A4 two-flap 3 mm spine, 4+0.
- 2026-09-28: Thomas explicitly approved the 10 mm model and requested automatic implementation of all sales folders in one batch, superseding individual review pauses for this family. Use M65 as the display name. Verify each exact template and retain hosted release boundaries.

## Inventory

Read-only inventory of public.products across the WebPrinter master and its current shops. Supplier banks, unlinked design-library assets and POD v1/v2-only catalogues are not audited by this snapshot.

21 product records with templates; 182 without product-level template links. 3904 bindings resolve to 1528 distinct URL strings. This is not a geometry or download verification.

249 candidate review tickets plus the existing A4 / 1 mm / 4+0 reference. Sales-folder tickets group material/finish PDF variants only for triage; approvals require explicit verified hashes.

## Review process

1. Download the exact PDF; record SHA-256, page count, sheet/trim/bleed dimensions and supplier source.
2. Verify panel outlines, crease axes, offsets, real spine width, pockets, tabs and cutouts.
3. Label front, back, inside and every panel; prove the PDF-side mapping and reading direction.
4. Show fully open, intermediate fold steps and closed state with labelled test artwork and a customer-file preview.
5. Thomas reviews the exact revision: approve or request corrections; store the decision, scope and evidence.
6. Connect approved fingerprints to product media, upload/checkout and Designer where supported; preserve tenant/master option identity.
7. Check variant changes, bad/missing files, unsupported models, proof/export invariants and desktop/mobile behavior.
8. Record local integration evidence, hosted acceptance and release status separately.

## First candidates

| No. | ID | Variant | State |
| --- | --- | --- | --- |
| 001 | FP-27fd1f62f1 | Flyers · A7 - 74 x 105 mm · 4+0 tryk på én side | waiting |
| 002 | FL-a1a5f7aa3f | DIN Lang · Folder midterfalset | waiting |
| 003 | FL-ae97fbc2e8 | DIN Lang · Rullefalset 6 sider Lodret | waiting |
| 004 | FL-3d66845b87 | DIN Lang · zigzag falset 6 sider Lodret | waiting |
| 005 | SF-94fc8fd571 | A4 · 2-delt med 2 flapper · 3 mm ryg · 4+0 | done |
| 006 | SF-af7528dda2 | A4 · 2-delt med 2 flapper · 5 mm ryg · 4+0 | done |
| 007 | SF-4d2e87a40a | A4 · 2-delt med 2 flapper · 10 mm ryg · 4+0 | done |
| 008 | SF-6622c18534 | A4 · 2-delt med 2 flapper · 1 mm ryg · 4+0 | done |
| 009 | SF-5f824dd572 | Standard Salgsmapper · legacy A4 / 5 mm filename | waiting |
| 010 | SF-b47f1187cd | A4 · 2-delt med 2 flapper · 1 mm ryg · 4+4 | done |

## Constraints

- Preserve current pricing, POD behavior, tenant branding, existing order workflows and unsaved editor tabs.
- Missing/unknown templates retain existing flat preview behavior; never assign a similar-looking 3D model.
- Do not treat a template URL, stored fold coordinates or a completed model as user approval.
- Do not mirror the outside artwork onto the inside. Keep technical guides out of customer artwork.
- Professional-PDF-only variants remain so; a 3D model does not enable online Designer support.
- Publication and hosted authenticated upload acceptance are separate from local review.

## Open questions

- Legacy A4 5 mm PDF is measured and modelled, but its product link has no format/print/spine metadata. Keep automatic assignment disabled until this binding is resolved.
- Does each calendar template provide enough evidence for finished thickness, assembly and door positions?
- Products without product-level links may have unlinked PDFs elsewhere; that storage/library audit is deferred.
- The proposed sequence may be reordered by Thomas; no design approvals have been inferred.

## How to continue

Open `http://127.0.0.1:8160/output/3d-review-queue/index.html` while the current local Vite server is running. The board filters all candidate variants and every no-template product. Give a ticket number or stable ID in chat to start it, approve its presented model revision, or request corrections. A local approval is not a publication command. The board itself never writes to the live catalogue.

Update the ticket in `docs/3d-review/plan.json`, preserving stable IDs. A userApproval record must name the model revision, exact template fingerprints, decision date and evidence; never set it from an agent test result. If a template changes, invalidate the affected approval and re-review. Regenerate with `python3 output/3d-review-queue/render.py`. Existing plan state is never reseeded automatically.

Existing implementation and limitations: [FOLDER_3D_PREVIEW.md](FOLDER_3D_PREVIEW.md).

## Fold references

- [WIRmachenDRUCK: zigzag folds alternate direction](https://www.wir-machen-druck.de/falzflyer-zickzackfalz,category,22429.html)
- [WIRmachenDRUCK: roll folds wrap inward](https://www.wir-machen-druck.de/falzflyer-wickelfalz-auf-din-a4-bedrucken-lassen-online,category,22299.html)
- [Onlineprinters: half-fold page order and reading direction](https://www.onlineprinters.ie/c/data/leserichtung)

## Change log

- 2026-09-28: Created queue from live read-only catalogue inventory and current local 3D source. Existing reference preserved. No new geometry, product assignment, hosted write or deployment.
- 2026-09-28: Thomas authorized beginning the queue and following progress. Candidate 001 is active; model approval remains pending.
- 2026-09-28: Candidate 001 r1 built and locally verified, awaiting Thomas review. Progress board automatically reads local plan updates. New previews are not assigned to live products.
- 2026-09-28: Roll fold approved; zigzag 004 built and browser checked. Approved 001–003 integrated locally with shop colours and exact template matching. Corrected bleed duplication at approved leaflet handoff. Recorded older duplicate product calculator blocker. No pricing, catalogue, tenant or publishing writes.
- 2026-09-28: Thomas approved 004. Added exact zigzag fingerprint to shared product/checkout/Designer preview registry. Built candidate 005 against the exact 255g Chromo/no-finish 3 mm PDF; no approval or product eligibility granted to 005 or other finish variants.
- 2026-09-28: Thomas approved 005. Enabled its exact no-finish 3 mm fingerprint and prepared independently traced candidate 006, 5 mm. Catalogue publishing remains unchanged.
- 2026-09-28: Thomas approved 006. Enabled its exact 5 mm no-finish fingerprint and independently traced candidate 007, nominal 10 mm. Preserved approved 3/5 mm poses and catalogue publishing.
- 2026-09-28: 143 sales-folder review variants built from 1,421 exact PDFs (79 distinct geometries). All 142 configured catalogue variants enabled locally; legacy 5 mm stays review-only until configuration is mapped. 10 mm explicitly approved. A4/A5/A6/M65/21 x 21 cm, all listed capacities/constructions/print sides complete for the linked-template batch. Not deployed.
