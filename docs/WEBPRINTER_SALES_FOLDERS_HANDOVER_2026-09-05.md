# Webprinter sales folders handover

Last consolidated: 5 September 2026
Primary owner: Thomas
Working language: Danish customer-facing copy; English technical notes are acceptable
Primary product: Salgsmapper med eget design
Scope: supplier extraction, exact prices, product configuration, PDFs, Designer coupling, product imagery, backend controls, review state, and recovered Christmas-calendar context

This is the durable handover for the current sales-folder work. It is intentionally not a transcript dump. It records the product decisions, what the receipts prove, what exists only in the current dirty checkout, what remains review-only, and the safest next actions.

## 1. Start here

### Copy this prompt to another agent

> Continue the Webprinter sales-folder task from <code>docs/WEBPRINTER_SALES_FOLDERS_HANDOVER_2026-09-05.md</code>. Work only in the canonical repository and preserve all existing product, pricing, PDF, and tenant data. First verify the checkout identity, inspect the dirty worktree, read the current receipts, and perform a read-only live product readback. Do not publish, make the product tenant-available, replace the 20 current images, synthesize missing prices/templates, or write to Supabase without a separate explicit approval. Keep model, print, spine, paper, finish, price, and exact PDF template coupled.

### Mandatory repository reading order

Before changing code or data, read:

1. [POD2_README.md](../POD2_README.md)
2. [AI_CONTINUITY.md](../AI_CONTINUITY.md)
3. [SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md)
4. [.agent/HANDOVER.md](../.agent/HANDOVER.md)
5. [Agent product handoff specification](AGENT_PRODUCT_HANDOFF_SPEC.md)
6. [Product blueprint specification](PRODUCT_BLUEPRINT_SPEC.md)
7. The current local supplier-import instructions:
   - [.agent import skill](../.agent/skills/import-supplier-product/SKILL.md)
   - [Visual and document contract](../.agent/skills/import-supplier-product/references/visual-and-document-contract.md)
   - [Webprinter integration contract](../.agent/skills/import-supplier-product/references/webprinter-integration.md)

### Non-negotiable guardrails

- Keep the product unpublished until Thomas separately approves publication.
- Keep it unavailable to tenants and not ready until the end-to-end QA gate passes.
- Never create a selectable or purchasable combination without both an exact price and its exact PDF/template behavior.
- Never interpolate a price or guess a dieline.
- Preserve existing products, POD v1, pricing logic, tenant scope, and unrelated dirty work.
- Treat supplier pages and source documents as private read-only evidence. Do not expose supplier branding or provenance to customers.
- Product research and preparation may be delegated; database writes, storage uploads, product changes, and publication remain separate approval gates.

## 2. How to read status statements

This handover uses these evidence labels:

| Label | Meaning |
| --- | --- |
| Receipt-confirmed | A saved write/readback receipt records the result at a named time. |
| Local checkout | Code or assets are present in this working tree, but may be uncommitted. |
| Review-only | An artifact exists for human review and is not connected to the product. |
| Live-current unverified | A prior receipt exists, but the database was not freshly re-read on 5 September. |
| User decision | Thomas explicitly requested the behavior; implementation may still be incomplete. |

The live Supabase state could not be re-read on 5 September because the checkout only exposed the publishable client credential and not the service-role credential required by the existing verification script. No database or storage mutation was attempted in this handover turn. Therefore all product/database counts below are receipt-confirmed snapshots, not a claim about current live state.

## 3. Executive status

The intended customer experience is one consolidated product, not dozens of separate folder products.

Receipt-confirmed product snapshot:

| Field | Value |
| --- | --- |
| Name | Salgsmapper med eget design |
| Product ID | <code>42a270bb-d2b1-4e98-9d04-aaa7d3d33401</code> |
| Slug | <code>salgsmapper-med-eget-design</code> |
| Tenant | master tenant, <code>00000000-0000-0000-0000-000000000000</code> |
| Pricing mode | <code>matrix_layout_v1</code> |
| Attribute groups / values | 5 / 40 |
| Folder models | 20 included models |
| Exact price rows | 108,348 |
| Exact configuration/template bindings | 3,692 |
| Template file records | 3,692 |
| Online Designer bindings | 1,562 |
| Professional-PDF-only bindings | 2,130 |
| Designer template records | 710 |
| Storage objects written by initial draft import | 1,441 |
| Technical requirement | CMYK, minimum 300 dpi |
| Draft state at receipt | unpublished, unavailable to tenants, not ready |
| Draft receipt completed | 31 August 2026 at 22:57:07 UTC |

The sales-folder draft was written only after the Supplier Bank and unpublished-product gates were approved. Publication was explicitly not approved.

Current visual state:

- The original flat Webprinter model illustrations are the assets connected to the product.
- Twenty new 3D folder illustrations exist in the repository and are visible in the current review page.
- The 3D set is review-only and has not replaced the product images.
- The 3D PNGs have a baked pure-white background, not transparency.
- Backend image size/order/upload controls are partly implemented, but some broader layout controls are still absent.

Current PDF state:

- Sanitized Danish Webprinter PDFs were generated and imported according to the receipts.
- Exact configuration-to-template coupling was created for all retained priced configurations.
- The Designer background overlay behavior exists locally and is intended to be locked, non-selectable, and excluded from exported artwork.
- A complete live browser proof for every template and every export has not been performed.

## 4. Repository and import identity

| Item | Value |
| --- | --- |
| Canonical checkout | <code>/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main</code> |
| Git remote | <code>https://github.com/comboworks-ops/webprinter-platform.git</code> |
| Branch observed on 5 September | <code>ui-cleanup</code> |
| HEAD observed on 5 September | <code>c0ee02839e4329c6c8543101e4fca4d9d0222cda</code> |
| HEAD subject | <code>fix: serve branded favicons per domain</code> |
| Canonical supplier run | <code>tmp/supplier-imports/wmd-sales-folders-20260831-full</code> |
| Supplier category | [WIRmachenDRUCK presentations folders](https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html) |
| Import run ID | <code>wmd-sales-folders-20260831-full</code> |

The working tree is substantially dirty. The sales-folder scripts, tests, generated product assets, and this handover are largely uncommitted or untracked. Do not clean, reset, or bulk-stage the worktree.

The <code>tmp/</code> directory is ignored. The receipts and review pages are available to agents sharing this checkout, but will not travel in an ordinary Git clone. See the portability warning in section 15.

## 5. Customer-facing product intent

The configuration should behave like one coherent folder product:

1. Start with folder size/model.
2. Let the customer choose printing on the outside only or outside and inside.
3. Let the customer choose the spine/back thickness where an exact template exists.
4. Let the customer choose paper.
5. Let the customer choose finishing.
6. Show only a valid exact price and the exact corresponding template.
7. If a selected finish is unavailable with the current paper but a documented compatible paper exists, automatically move to that compatible paper and show its price.
8. If no exact compatible combination exists, do not invent a price or template.

Customer-visible option order:

<code>folder model → print → spine → paper → finish → quantity/price</code>

The model choices should be grouped visually under A4, A5, A6, M65, and 21 × 21 cm. DIN Lang is displayed to Danish customers as M65, while the internal key remains <code>din-lang</code>.

## 6. Included folder models

Twenty models are included. The CD folder and CD pocket are excluded.

| Customer group | Internal model key | Danish meaning |
| --- | --- | --- |
| A4 | <code>a4--2-part-standard</code> | A4, 2-delt standardmappe uden flapper |
| A4 | <code>a4--2-part-2-flaps</code> | A4, 2-delt med 2 flapper |
| A4 | <code>a4--2-part-3-flaps</code> | A4, 2-delt med 3 flapper |
| A4 | <code>a4--3-part-1-flap</code> | A4, 3-delt med 1 flap |
| A4 | <code>a4--2-part-standard-window</code> | A4, 2-delt standardmappe med vindue |
| A4 | <code>a4--2-part-2-flaps-window</code> | A4, 2-delt med 2 flapper og vindue |
| A4 | <code>a4--2-part-3-flaps-window</code> | A4, 2-delt med 3 flapper og vindue |
| A5 | <code>a5--2-part-standard</code> | A5, 2-delt standardmappe |
| A5 | <code>a5--2-part-2-flaps</code> | A5, 2-delt med 2 flapper |
| A5 | <code>a5--2-part-3-flaps</code> | A5, 2-delt med 3 flapper |
| A5 | <code>a5--3-part-1-flap</code> | A5, 3-delt med 1 flap |
| A6 | <code>a6--2-part-2-flaps</code> | A6, 2-delt med 2 flapper |
| A6 | <code>a6--2-part-3-flaps</code> | A6, 2-delt med 3 flapper |
| A6 | <code>a6--2-part-closure</code> | A6, 2-delt med lukning |
| A6 | <code>a6--3-part-1-flap</code> | A6, 3-delt med 1 flap |
| M65 | <code>din-lang--2-part-2-flaps</code> | M65, 2-delt med 2 flapper |
| M65 | <code>din-lang--2-part-3-flaps</code> | M65, 2-delt med 3 flapper |
| M65 | <code>din-lang--2-part-closure</code> | M65, 2-delt med lukning |
| 21 × 21 cm | <code>square-21x21--2-part-2-flaps</code> | 21 × 21 cm, 2-delt med 2 flapper |
| 21 × 21 cm | <code>square-21x21--2-part-3-flaps</code> | 21 × 21 cm, 2-delt med 3 flapper |

Grouping receipt:

- A4: 7 models
- A5: 4 models
- A6: 4 models
- M65: 3 models
- 21 × 21 cm: 2 models

The grouping write changed presentation metadata only. It preserved prices, templates, technical settings, publication state, and the 20 custom images.

### Confirmed A4 supplier-page mapping

The raw supplier catalog confirms these user-supplied pages as the requested A4 construction families. The inspected examples below are the 4+0 variants; the consolidated product contains both print modes where exact evidence exists.

| Supplier page | Confirmed construction |
| --- | --- |
| [Category 18783](https://www.wir-machen-druck.de/mappe-fuer-a4-extrem-guenstig-online-bestellen,category,18783.html) | 2-delt standardmappe, no flaps |
| [Category 18784](https://www.wir-machen-druck.de/mappe-fuer-a4-extrem-guenstig-online-bestellen,category,18784.html) | 2-delt with bottom and side flap, represented as 2 flaps |
| [Category 18785](https://www.wir-machen-druck.de/mappe-fuer-a4-extrem-guenstig-online-bestellen,category,18785.html) | 2-delt with 3 flaps |
| [Category 18792](https://www.wir-machen-druck.de/mappe-fuer-a4-extrem-guenstig-online-bestellen,category,18792.html) | 3-delt with 1 flap |

Exact PDF geometry, not the illustration or translated label, remains authoritative for production.

### Explicit exclusions

- Excluded product model: <code>cd-135x135--2-part-closure</code>.
- Excluded supplier add-on: CD-Tasche / CD pocket.
- Raw evidence is preserved, but these items are not projected into the product.
- Exclusion removed 20 supplier pages, 1 model, 1,420 price rows, and 52 exact configuration/document bindings from the proposed product.

## 7. Configuration axes

### Print

- <code>4+0</code>: full-colour print on the outside/front side only.
- <code>4+4</code>: full-colour print on both outside and inside.

### Spine/back thickness

- 1 mm
- 3 mm
- 5 mm
- 10 mm

Spine thickness is primarily a construction/template choice, but it still participates in the exact configuration signature because the dieline changes.

### Papers

- 255 g Chromo folder board
- 350 g matte coated board
- 300 g high-white natural board
- 300 g white recycled board

The saved internal paper keys are the source of truth. Danish display labels can be refined in the backend without changing those keys.

### Finishes

- No finishing
- High-gloss UV varnish
- Partial UV varnish
- Matte lamination
- Gloss lamination
- Soft-touch lamination
- Soft-touch lamination plus partial UV varnish
- Gold foil
- Silver foil
- Blind embossing

Not every finish is available for every paper/model/print/spine combination. The matrix is intentionally sparse.

### Quantities

The catalog includes these quantity points where the exact supplier configuration provides them:

<code>50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500, 750, 1,000, 1,250, 1,500, 1,750, 2,000, 2,250, 2,500, 3,000, 3,500, 4,000, 4,500, 5,000, 6,000, 7,000, 8,000, 9,000, 10,000, 12,500, 15,000, 17,500, 20,000, 22,500, 25,000, 27,500, 30,000, 32,500, 35,000, 37,500, 40,000, 42,500, 45,000, 47,500, 50,000</code>

Do not display a quantity simply because it appears in this master list; an exact price row must exist for the selected five-axis configuration.

## 8. Pricing behavior

### Imported matrix

- 108,348 exact price rows remain after the CD-folder exclusion.
- 3,692 exact five-axis priced configurations are represented.
- There is no interpolation.
- The recorded pricing conversion rule is <code>wmd_tiered_fx_7_5</code>.
- Supplier evidence and checksums are retained in the run.
- Raw extraction captured 420 of 420 supplier product pages with zero retry failures.
- The normalized evidence was fully classified for the retained scope.

Canonical local artifacts:

- [Proposed pricing structure](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/proposed-pricing-structure.json)
- [Exact proposed price rows](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/proposed-price-rows.jsonl)
- [Compatibility map](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/proposed-compatibility.json)
- [Product draft write receipt](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/product-draft-write-receipt.json)

### Compatible-option resolver

User decision: when a customer selects a finish such as soft touch or soft touch plus partial UV and the current paper is incompatible, the UI should try to switch to a documented compatible paper/configuration and show a real price.

Required rule:

1. Prefer the smallest deterministic change needed to reach an exact row.
2. Preserve the customer’s selected model, print, and spine whenever possible.
3. Change paper only when a compatible exact row and exact template binding exist.
4. Tell the customer what changed.
5. If no exact compatible combination exists, keep the choice unavailable rather than fabricating a price.

### Spine-price parity correction

Thomas decided that 1, 3, 5, and 10 mm should carry the same selling price within an otherwise identical configuration, while retaining the correct spine-specific PDF.

What the receipt proves:

- Existing rows were normalized by taking the highest existing Webprinter selling price within the same model, print, paper, finish, and quantity group.
- 274 existing prices were updated.
- No rows were inserted or deleted.
- The final row count stayed 108,348.
- The check recorded no updated row below its exact supplier cost.
- All 3,692 template file records were unchanged.
- Publication, tenant availability, and readiness remained false.

Important unresolved edge:

- <code>a4--2-part-standard</code>, <code>a4--2-part-standard-window</code>, and <code>a5--2-part-standard</code> only had exact 1 mm evidence in the plan.
- Missing 3, 5, and 10 mm rows for those three models were not synthesized.
- This means the broad user wish for all four spine choices on all models is not completely fulfilled.
- Add those choices only if exact corresponding PDF geometry and a defensible price basis are obtained. Until then, hide them for those models.

Receipts:

- [Spine parity plan](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/spine-price-parity-plan.json)
- [Spine parity write receipt](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/spine-price-parity-write-receipt.json)
- [Spine rollback snapshot](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/rollback/spine-price-parity-before-2026-09-01T08-09-10-936Z.json)

## 9. PDF and Designer pipeline

### Counts and modes

| Item | Count |
| --- | ---: |
| Supplier document references collected | 2,206 |
| Supplier guides | 1,103 |
| Supplier print templates | 1,103 |
| Sanitized Webprinter PDFs | 1,420 |
| Exact configuration-to-document bindings | 3,692 |
| Unique online Designer PDFs/templates | 710 |
| Online Designer configuration bindings | 1,562 |
| Professional-PDF-only configuration bindings | 2,130 |

One PDF may serve more than one exact priced configuration where the source geometry is identical and the binding evidence explicitly permits it.

### Required sanitization contract

Customer-facing PDFs must:

- contain no visible WIRmachenDRUCK or other supplier branding;
- contain no supplier-identifying PDF metadata;
- use Danish text;
- keep text inside its intended boxes;
- preserve exact page boxes, dimensions, cut geometry, folds, and other production-critical geometry;
- use Webprinter blue rather than supplier green;
- show non-print/no-visible areas in grey rather than red;
- make cut, safety, fold, and no-print information visually distinguishable;
- remain downloadable for professional workflows;
- stay connected to the exact product configuration.

Current guide convention:

| Meaning | Visual convention |
| --- | --- |
| Beskæring / cut | Dashed magenta line |
| Sikkerhedsafstand / safety | Solid Webprinter-blue line |
| Fold / bend | Cyan line |
| Ingen tryk / not visible | Grey area |

Red is not the no-print colour in the current contract. Supplier green is not permitted in the guide treatment.

### Exact template signature

Every template lookup must match:

<code>folder_model + print + spine + paper + finish</code>

The runtime must fail closed when there is no unique exact match. Price and template must be recomputed together after every option change.

### Designer behavior

The local Designer integration is intended to:

- open the exact PDF-derived template for the selected configuration;
- pass template URL, name, SHA-256, dimensions, bleed, and safe-area values;
- render the template as a locked, non-selectable background guide;
- prevent the guide overlay from being saved as customer artwork;
- hide the guide during print export and restore it afterwards;
- exclude the guide from the final print output.

Important limitation: the current Designer guide is a rasterized overlay. It does not expose the original PDF’s vector objects or PDF layers as editable Designer objects. The downloadable professional PDF is the artifact to inspect in InDesign or similar software.

### Finished size versus template size

The finished product format and the flat PDF template are not expected to have the same dimensions. The PDF can be larger because it includes the unfolded panels, flaps, folds, and bleed. Do not “correct” a template to the closed finished size.

### What has been verified

- The sanitization batch contains 1,420 output PDFs and inspection contracts.
- Automated rendering recorded 1,420 successful jobs, zero failed jobs, and 1,597 unique rendered pages.
- The review set contains 119 contact sheets.
- Sample geometry comparisons preserve page boxes and geometry fingerprints.
- The import receipt records 3,692 template file records and safe binding modes.
- The guide implementation and focused tests use the current Danish blue/magenta/cyan/grey convention.

### What has not been proven

- Nobody claimed to have manually inspected every one of the 119 contact sheets.
- A full live Designer open/edit/save/export test has not been completed for every one of the 710 Designer templates.
- Export exclusion was not proven for every exact binding in the original bounded approval.
- Automated structural results do not guarantee that every line is visually ideal in every PDF.
- The generated app guide tests do not prove the native layer behavior of every downloadable PDF in every desktop application.

Therefore the PDFs are substantially prepared and structurally checked, but “totally correct in every program for every configuration” remains too strong a claim until the representative and high-risk QA matrix is completed.

Key evidence:

- [Document preparation report](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/document-preparation-report.md)
- [Template geometry audit](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/template-geometry-audit.md)
- [Sanitized render decision](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/sanitized-pdf-render-approval-decision.json)
- [Render review index](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/sanitized-pdf-render-review/index.html)
- [Template binding map](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/import-template-binding-map.jsonl)
- [Final preflight/blocker report](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/import-manifest-blockers.json)

## 10. Product images and 3D illustrations

### Supplier images

The raw catalog retained 420 listing-image references and 420 detail-image references. The supplier pixels were not downloaded and converted into Webprinter product art. This avoids accidentally redistributing supplier artwork and branding.

### Version 1: connected flat illustrations

Location:

- <code>src/assets/product-options/sales-folders/models/v1/</code>
- UI PNGs: <code>src/assets/product-options/sales-folders/models/v1/png/ui/</code>
- Master PNGs: <code>src/assets/product-options/sales-folders/models/v1/png/master/</code>
- Hero: <code>src/assets/product-options/sales-folders/webprinter-sales-folder-hero-v1.png</code>

Inventory:

- 21 source SVG diagrams: 20 included models plus the excluded CD model.
- 20 approved transparent master PNGs at 1024 × 1024.
- 20 approved transparent UI PNGs at 512 × 512.
- The importer currently prefers these custom images.
- The 20 option values preserve custom-image references.
- Thumbnails were intentionally hidden by the size-grouping presentation change, but the custom images remain stored.

### Version 2: new 3D review illustrations

Location:

- [3D asset folder](../src/assets/product-options/sales-folders/models/v2-3d/)
- [3D asset README](../src/assets/product-options/sales-folders/models/v2-3d/README.md)
- [3D comparison review page](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/3d-model-review/index.html)

State:

- Exactly 20 RGB PNG files.
- Filenames map one-to-one to the 20 included model keys.
- Each was generated from its corresponding approved flat structural diagram.
- Shared visual treatment: white coated board, restrained Webprinter-blue construction accents, no logos, no text, and no props.
- Each image has a pure-white studio background baked into the pixels.
- The files do not have transparency.
- These images are review-only and are not wired into the product or uploaded as replacement option assets.

Do not replace version 1 with version 2 without explicit approval. Before wiring them, Thomas should decide whether baked white is acceptable or whether the 3D set must be remade with true alpha transparency.

### Preview-image intent

Thomas wants the folder construction to be visually understandable in 3D. The small option image should accurately distinguish panel count, flap count, window, closure, and orientation. A generic product photograph is not enough.

The desired long-term preview is a dependable representation of the exact selected model. It is not yet proven that the current small preview is generated from the Designer itself; the current v1/v2 assets are model illustrations.

## 11. Backend control: current capability and gaps

### Implemented locally

- Choose the section display type.
- Control a section thumbnail/image size.
- Reorder values within an option section.
- Show or hide an individual value image.
- Upload or remove an individual value image.
- Set an individual option image size between 16 and 160 px.
- Let a section-wide size update clear conflicting per-value size overrides.
- Preserve prices and value order during visual-only updates.

### Not implemented

- Editing the A4/A5/A6/M65/21 × 21 group headings and membership in Site Design V2.
- Reordering whole configuration sections/rows from the visual editor.
- Changing the section orientation/layout direction with the same freedom as older products.
- Arbitrarily moving boxes around the storefront layout.
- Treating the PDF’s native vector/layer objects as editable Designer layers.

### Relevant local code

- <code>src/components/admin/SiteDesignPreviewFrame.tsx</code>
- <code>src/contexts/PreviewBrandingContext.tsx</code>
- <code>src/components/content/ProductPriceContent.tsx</code>
- <code>src/components/product-price-page/MatrixLayoutV1Renderer.tsx</code>
- <code>src/lib/preview/productPricingPreview.ts</code>
- <code>src/lib/pricing/matrixLoadingPresentation.ts</code>

These edits are in the dirty checkout. Their presence is not proof of a commit, deployment, or production behavior.

## 12. UI issues and local fixes

### Option selection caused page blinking

Observed problem: clicking options could make the configurator flash or briefly show a different image while price rows were loading.

Local mitigation:

- Keep the existing matrix presentation visible during asynchronous selection changes.
- Avoid replacing the full product surface with a loading state.
- Reduce stale clean-preview overrides that caused the frontend to render a temporary alternate state.

Status: locally implemented and covered by focused tests, but still requires exact browser QA on the sales-folder route under rapid model, spine, paper, and finish changes.

### Backend image-size control appeared unresponsive

Local fixes cover saved section sizing, per-value overrides, preview propagation, and the stale clean-preview path. The helper tests pass. This still needs a real click/save/reload check in the authenticated admin flow because a unit test cannot prove the complete backend interaction.

### Grouping

The product’s pricing structure now contains the five size groups and M65 display names. Prices and templates were protected during the grouping write.

Receipt:

- [Size grouping write receipt](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/model-size-grouping-write-receipt.json)
- [Grouping rollback snapshot](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/rollback/model-size-grouping-before-2026-09-01T10-36-56-593Z.json)

## 13. Verification snapshot

Recorded on 5 September in the current checkout:

- 49 focused UI/PDF checks passed.
- 6 current image-setting/thumbnail helper checks passed.
- A wider sales-folder-focused run recorded 62 of 66 checks passing.
- The four remaining test files failed before assertions because required packages such as <code>dotenv</code> and <code>playwright</code> could not be resolved.
- The repository’s <code>node_modules</code> is a broken symbolic link to a missing Localhost Launcher dependency directory.

Do not interpret the dependency failures as four confirmed product regressions, but do not call the suite green either. Restore a valid dependency runtime, then rerun the exact focused commands and browser QA.

Additional risks:

- <code>PreflightGuide.tsx</code> contains dormant older English/red guide language, but no active reference was found. If it is reactivated later, bring it into the Danish Webprinter guide contract first.
- General Designer UI contains green/emerald status styling unrelated to print guides. The “no green” decision currently applies to supplier-derived template/guide artwork, not every status indicator in the application.

## 14. Review pages and routes

Canonical artifact paths are more durable than port numbers.

| Purpose | Local artifact |
| --- | --- |
| Combined storefront proposal | [storefront-proposal.html](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/storefront-proposal.html) |
| 20-model 3D comparison | [3d-model-review/index.html](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/3d-model-review/index.html) |
| Sanitized PDF render review | [sanitized-pdf-render-review/index.html](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/sanitized-pdf-render-review/index.html) |
| Template geometry review | [template-geometry-render-review/index.html](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/template-geometry-render-review/index.html) |
| Three-panel folder review | [three-panel-folder-review/index.html](../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/three-panel-folder-review/index.html) |

Ephemeral localhost observations:

- The current in-app browser displays the 3D comparison at [127.0.0.1:8103](http://127.0.0.1:8103/tmp/supplier-imports/wmd-sales-folders-20260831-full/review/3d-model-review/index.html).
- A storefront preview was previously used at [127.0.0.1:8104](http://127.0.0.1:8104/preview-shop?preview_mode=1&page=%2Fprodukt%2Fsalgsmapper-med-eget-design).
- Ports 8102, 8103, and 8104 had listeners associated with this checkout when inspected.

These ports are session state, not durable proof. Before giving Thomas a localhost link, verify the process owner, checkout, exact route, and rendered page.

## 15. Approval and mutation history

### Approved and performed

- Read-only supplier extraction.
- Local normalization and review artifacts.
- Supplier Bank write.
- Creation of one consolidated unpublished product draft.
- Exact price-row write for the retained scope.
- Sanitized PDF/storage and template record write recorded by the product receipt.
- Spine-price parity correction on existing rows.
- Presentation grouping by size.
- Local code fixes and visual asset generation in the dirty checkout.

### Not approved or not performed

- Publication.
- Tenant availability.
- Marking the product ready.
- Retiring unrelated/existing folder products.
- Replacing v1 imagery with the new 3D set.
- Synthesizing missing spine prices or templates.
- A production deployment.
- A commit of the current sales-folder changes.

### Rollback evidence

- Product draft receipt contains created-record inventories and readback.
- Spine rollback snapshot records the 274 pre-change prices and protected product fields.
- Grouping rollback snapshot records the pre-grouping pricing structure.

Never run a rollback automatically. Re-read the current product first, compare timestamps and row IDs, request explicit approval, and restore only the intended fields.

## 16. Portability and repository risk

This is the most important handoff risk.

- The current sales-folder work is mostly uncommitted.
- <code>tmp/</code> is ignored, so all extraction evidence, PDFs, receipts, and review pages are local-only.
- <code>.agents/</code> is ignored.
- The newer <code>.agent/</code> skill tree appears untracked in the current checkout.
- The local contracts say <code>.agent</code> is canonical, but another agent on a clean clone may not have it.
- The current <code>node_modules</code> symlink is broken.

Agents sharing this exact desktop checkout can continue from the evidence. Agents in a new clone cannot safely reproduce the state from Git alone.

Before a cross-machine or clean-clone handoff, Thomas should explicitly approve one of these:

1. Create a narrowly reviewed commit containing the intended code, tests, skills, durable manifests, and approved assets.
2. Create a deliberate handoff package for the ignored import evidence, with checksums.
3. Move only the essential receipts/manifests into an approved tracked evidence location.

Do not bulk-add the dirty tree. It contains unrelated user work.

## 17. Task board

| ID | State | Task | Evidence / next action |
| --- | --- | --- | --- |
| SF-001 | completed | Extract full supplier folder catalog | 420/420 pages; raw evidence retained |
| SF-002 | completed | Consolidate to one 20-model product | CD model/pocket excluded |
| SF-003 | receipt-confirmed | Create unpublished Webprinter draft | Product receipt, 31 August |
| SF-004 | receipt-confirmed | Import exact sparse prices | 108,348 rows |
| SF-005 | receipt-confirmed | Import exact PDF/template bindings | 3,692 bindings |
| SF-006 | receipt-confirmed | Normalize existing spine prices | 274 updates; no inserts/deletes |
| SF-007 | queued | Cover 3/5/10 mm on the three standard no-flap models | Requires exact PDFs and defensible price basis |
| SF-008 | receipt-confirmed | Group models by A4/A5/A6/M65/21 × 21 | Pricing structure only |
| SF-009 | local checkout | Fix stale preview/image-size propagation | Needs authenticated browser save/reload proof |
| SF-010 | local checkout | Reduce option-change blinking | Needs rapid-interaction browser QA |
| SF-011 | completed | Generate 20 new 3D review renders | Review-only assets |
| SF-012 | waiting for approval | Replace v1 product images with v2 3D images | Decide white background versus alpha first |
| SF-013 | queued | Add backend editing for group headings/membership | Not currently supported |
| SF-014 | queued | Add broader section order/orientation controls | Requires explicit UI scope |
| SF-015 | queued | Run representative Designer/export QA matrix | Include online and professional-PDF-only modes |
| SF-016 | blocked | Fresh live database readback | Service verification credential unavailable locally |
| SF-017 | blocked by approval | Publish / make tenant-available / mark ready | Only after QA and explicit approval |
| SF-018 | queued | Make work portable | Narrow commit or reviewed evidence package |

## 18. Recommended next execution order

1. Restore a valid dependency runtime without deleting or overwriting user work.
2. Perform a read-only live product readback and compare it with the 31 August and 1 September receipts.
3. Rerun the focused sales-folder tests.
4. Verify the exact storefront route while changing model, print, spine, paper, and finish rapidly; confirm no whole-page blink and no transient wrong image.
5. Verify the compatible-paper auto-switch for soft touch, soft touch plus partial UV, foils, varnishes, and incompatible papers.
6. Open a representative risk-based PDF sample across every model family, print mode, spine, and binding mode.
7. In Designer, prove that the guide is locked, non-selectable, not saved as customer artwork, and absent from export.
8. In a desktop PDF application, inspect metadata, page boxes, Danish guide text, line colours, and layer/nonprint behavior for representative high-risk files.
9. Ask Thomas whether the new 3D set should keep baked white backgrounds or be regenerated with transparency.
10. If approved, wire the 20 v2 images through the same backend-editable image fields; do not hardcode them only in the frontend.
11. Resolve the three one-millimetre-only models only when exact spine-specific templates exist.
12. Re-read counts and sentinels after any write.
13. Obtain a separate publication approval only when all acceptance checks pass.

## 19. Acceptance checklist before publication

- [ ] Product is still the intended consolidated product ID and slug.
- [ ] Exactly 20 included models; no CD folder or CD pocket.
- [ ] A4/A5/A6/M65/21 × 21 grouping is correct.
- [ ] 4+0 and 4+4 labels are understandable in Danish.
- [ ] Every visible spine has an exact spine-specific template.
- [ ] Every visible price is backed by an exact price row.
- [ ] Soft-touch and other finishes resolve to a compatible exact paper or remain unavailable.
- [ ] No option click causes the page or product image to flash incorrectly.
- [ ] Backend image size, order, upload, hide/show, save, and reload work.
- [ ] The selected model image matches the selected construction.
- [ ] The final approved image version is connected through editable backend data.
- [ ] PDFs contain no supplier logo, supplier metadata, or German customer-facing text.
- [ ] PDF guide text stays inside its boxes.
- [ ] Cut, safety, fold, and no-print areas use the approved visual language.
- [ ] Designer guide cannot be selected and is excluded from final print.
- [ ] Downloaded professional PDF preserves exact geometry and useful layer behavior.
- [ ] Price/template coupling fails closed on incomplete combinations.
- [ ] Focused tests and the exact browser journey pass with a healthy dependency runtime.
- [ ] Product is live-read before any publication mutation.
- [ ] Thomas explicitly approves publication and tenant availability.

## 20. Archived Christmas-calendar task and later consolidated direction

Thomas asked that the older chat be recovered rather than requiring him to repeat it.

### Archived task identity

| Field | Value |
| --- | --- |
| Archived task title | Reimport skills and review MD |
| Archived task ID | <code>019e8f31-9814-7f51-a7d0-b523bdb792d8</code> |
| Repository | This same Webprinter checkout |
| How to find it | Open Archived tasks and search the exact title |

The archive is provenance. Its first calendar product is not automatically the current product to modify.

### First recovered Christmas-calendar product

Archived receipt snapshot:

| Field | Value |
| --- | --- |
| Product | Julekalender Mini Mix med chokolade |
| Product ID | <code>a447c6d6-2476-4b9c-9b9a-ba6f0115806e</code> |
| Slug | <code>julekalender-mini-mix</code> |
| State in archived receipt | unpublished |
| Configuration basis | 412 × 307 mm, 4+0, 300 g/m² GC1, 24 Kinder Mini Mix chocolates |
| Price tiers | 20, from quantity 1 through 2,500 |
| Template | linked 412 × 307 mm Designer template |
| Pricing artifact | <code>tmp/supplier-imports/wmd-julekalender-minimix-20260825T232706Z/normalized/pricing.jsonl</code> |

Recovered proposed Webprinter prices:

| Quantity | Price DKK | Quantity | Price DKK |
| ---: | ---: | ---: | ---: |
| 1 | 255 | 5 | 1,275 |
| 10 | 2,295 | 25 | 5,378 |
| 50 | 9,152 | 75 | 12,466 |
| 100 | 13,671 | 150 | 17,378 |
| 200 | 20,750 | 250 | 23,318 |
| 300 | 27,981 | 350 | 32,645 |
| 400 | 37,308 | 450 | 41,972 |
| 500 | 45,206 | 750 | 67,809 |
| 1,000 | 88,507 | 1,500 | 132,761 |
| 2,000 | 169,393 | 2,500 | 211,744 |

Those prices captured a reported 10% early-order discount expiring 15 September 2026. Recheck them after that date before relying on them commercially.

### Later consolidated calendar draft

The later direction is one combined calendar product rather than one backend product per chocolate brand.

Receipt-derived target:

| Field | Value |
| --- | --- |
| Product | Julekalendere med eget design |
| Product ID | <code>403c6103-d905-437e-a136-222d6d7e64ac</code> |
| Slug | <code>julekalendere-med-eget-design</code> |
| Category | Julekalendere |
| Models | 14 |
| Variants | 30 |
| Exact prices | 514 |
| Reused templates | 28 |
| Initial reused model images | 14 |
| Later showcase assets | 58 |
| State in latest 28 August receipt | unpublished and not ready |

Canonical local run:

- <code>tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z</code>
- [Combined calendar report](../tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z/combined/julekalendere-med-eget-design/review/report.md)
- [Latest unpublished-draft write receipt](../tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z/combined/julekalendere-med-eget-design/review/unpublished-draft-write-2026-08-28T07-15-01-875Z.json)
- [Showcase write receipt](../tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z/combined/julekalendere-med-eget-design/review/showcase-write-2026-08-28T09-28-42-200Z.json)

Do not confuse this consolidated product with:

- the older Mini Mix product;
- the intermediate <code>julekalender-multi</code> family;
- the original 14 separate imported draft products.

Live calendar state was not re-read on 5 September.

### Durable calendar UX decisions from the chats

- Gather the calendars into one product.
- Present all calendar models first.
- Group chocolate/candy brands beneath the same physical calendar model instead of creating separate backend products.
- A model click should open a detailed configuration area below the model grid and scroll the customer to it.
- Keep all model thumbnails visible above the detail box so the customer can switch models.
- Put size, orientation, material, printing facts, candy/chocolate choice, and other configuration inside the selected-model detail box.
- Show chocolate brands as small recognizable choice buttons/logos when legally and visually appropriate.
- Use white or transparent product-image backgrounds; do not show checkerboard/grey sticker backdrops.
- Product configuration imagery must live in backend-editable data so Thomas can change image, order, visibility, and size.
- The selected template must appear as a locked, nonprinting Designer background and remain downloadable separately.
- The detailed example images below the price matrix must match the selected physical calendar model.
- Chosen description examples: cat, football, and dentist.
- Chosen top presentation direction: presentation B, a combined view of several calendar types.
- The examples should feel believable and somewhat amateur/personal rather than over-polished advertising art.
- The calendar category should be called Julekalendere.

These decisions are a handover brief, not proof that every item is implemented in the current calendar page.

## 21. Import-skill rules established during this work

The current local import contract was expanded around the recurring problems discovered during the calendar and folder imports. Any agent doing the next supplier product should preserve these principles:

### Price and configuration

- Keep extraction, Supplier Bank, product write, pricing write, asset upload, and publication as separate gates.
- Import small quantities when the supplier truly offers them.
- Consolidate physical families into a manageable product where the same model only differs by fill/brand.
- Never show an option without an exact supported price.
- Automatically resolve to a compatible paper/finish only when an exact row exists.

### PDFs

- Import the exact PDF for the exact configuration.
- Sanitize supplier branding and metadata.
- Translate customer-facing instructions to Danish.
- Preserve geometry, bleed, cut, folds, and page boxes.
- Use Webprinter blue, not supplier green.
- Use grey for no-print/not-visible areas.
- Keep text within its intended boxes.
- Make cut, safety, fold, and no-print conventions visually explicit.
- Embed a locked, nonprinting guide in Designer.
- Keep a downloadable professional PDF.
- Verify that the guide does not enter customer artwork or final print export.

### Product imagery

- Produce clean, supplier-neutral visuals.
- Prefer transparency or a deliberate pure-white storefront background.
- Do not leave checkerboard/grey sticker backgrounds.
- Store option images in backend-editable configuration data.
- Support image replacement, order, visibility, and size.
- Preserve exact structural differences between models.

### Skill portability warning

The local skill material currently exists under both <code>.agents</code> and <code>.agent</code>-related conventions, but tracking is inconsistent in this dirty checkout. Treat the fully read current <code>.agent/skills/import-supplier-product</code> contract as the operative local guidance for this task, then reconcile and commit the canonical skill location separately before depending on it in a clean clone.

## 22. Checkpoint

### Current goal

Finish one trustworthy, backend-editable, visually clear Webprinter sales-folder product with exact prices and exact PDFs, while keeping it unpublished until verified.

### Completed checkpoint

- Full catalog extracted.
- CD folder/pocket excluded.
- One consolidated unpublished product written.
- Exact sparse prices and templates written according to receipts.
- Existing spine-price parity applied safely.
- Size grouping applied.
- Danish/clean PDF pipeline built.
- Backend image controls and anti-blink work implemented locally.
- Twenty new 3D review images generated.
- Archived calendar task recovered and reconciled with the later consolidated calendar direction.

### Next decision needed from Thomas

Approve or reject the 20 version-2 3D folder illustrations, and decide whether their final files should use baked white backgrounds or true transparency.

### Last evidence boundary

Database receipts run through 1 September 2026. Local code/assets were inspected on 5 September 2026. No fresh live Supabase readback, commit, deployment, or publication was performed while creating this handover.
