# Salgsmapper 1 mm template: prepared attachment, production decision open

Historical pre-attachment review. Thomas subsequently asked to proceed; the corrected one-page attachment was saved and verified on 8 September. See [the executed repair](salgsmapper-fix.md). The two-page/dimension proposal below was superseded after actual Designer inspection.

Reviewed 8 September 2026. No database, Storage, product, pricing, publication or default-setting changes were made.

The missing PDF does not need to be sourced from scratch. A complete A4 / two-flap / 1 mm / outside-print-only PDF already exists locally and in public Storage. Its bytes match the supplier-import manifest. The remaining uncertainty is whether that current supplier die is the intended production construction for the older Salgsmapper tenant product. The older and current supplier 5 mm files share page dimensions and fold positions, but their cutting paths are not identical.

## Fresh target evidence

Read from linked project `ziattmsmiirfweiuunfo` using SELECT-only Supabase connector queries at **2026-09-08 14:17:44 UTC**:

| Field | Current value |
| --- | --- |
| Product | Standard Salgsmapper |
| Product ID | `acac7c01-2f7c-41d4-86bd-b461ed31b53e` |
| Tenant | `7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba` |
| Slug | `standard-sales-mapper-kopi-2` |
| Published | true |
| Product last updated | 2026-06-29 23:44:27.276202 UTC |
| Pricing | Matrix Layout V1; 580 existing price rows |
| Price provenance | Current rows say `priceSource: manual`; no supplier source URL is preserved in their `extra_data` |
| Template records | One, named `salgsmappe_A4_skabelon 5mm_ryg.pdf` |
| Existing product-template dimensions | No copied dimensions or linked designer ID in the template record |
| Separate existing 5 mm designer template | `228c6131-7235-401e-b38a-78bffbdd2a14`, same tenant, private, active, 504 × 371 mm |

The active format/spine/print IDs and all groups, values, price rows, product fields and the separate legacy designer row are preserved in [live-snapshot.json](../../tmp/remaining-issues-template-20260908/live-snapshot.json). Duplicate unused spine values exist; only the IDs listed in the current layout were used in compatibility verification. No values were changed or deleted.

## Exact PDF candidate

Canonical local import run: `tmp/supplier-imports/wmd-sales-folders-20260831-full`.

| Field | Candidate |
| --- | --- |
| Source document key | `a4-2-part-2-flaps-4-0-1mm-chromo-mappekarton-none` |
| Product construction | A4, two parts, two flaps, 1 mm spine, outside print 4+0, no finishing |
| Paper coverage | All four current paper types have explicit canonical bindings to the same PDF hash |
| PDF size | 493.99825 × 365.99989 mm, rounded supplier data format 494 × 366 mm |
| Pages | 2: outer-side guide and gray inner-side guide |
| Bleed / safe area | 5 mm / 3 mm |
| Size in bytes | 36,901 |
| SHA-256 | `300a54250aea3b6e554a0e9723f2a2ef1e79e2f4ff3dd8649b9582bd7f45633e` |
| Existing master designer row | `ad674c9b-b9d0-4a55-8030-2193f3db57dc`, master tenant, private and active |
| Existing source product | `42a270bb-d2b1-4e98-9d04-aaa7d3d33401`, unpublished |

The [canonical binding manifest](../../tmp/supplier-imports/wmd-sales-folders-20260831-full/review/import-template-binding-map.jsonl) has this Chromo binding at line 51. A fresh [master readback](../../tmp/remaining-issues-template-20260908/master-template-readback.json) confirms the four paper bindings still point to the same PDF. A [public download receipt](../../tmp/remaining-issues-template-20260908/candidate-download-receipt.json) records HTTP 200 and a matching SHA-256. Existing master product, private template row and Storage object remain untouched.

Both candidate pages were rendered with Poppler and visually inspected. The PDF contains vector geometry, no image objects, no document-information metadata or XMP, nine Danish helper layers with Print and Export disabled, and contained Danish white text in the blue information panel. The technical overlay is visible in the rendered PDF; that alone does not prove Designer export exclusion.

- [Candidate PDF](../../tmp/remaining-issues-template-20260908/candidate-1mm-public.pdf)
- [Candidate outer-side rendering](../../tmp/remaining-issues-template-20260908/candidate-1mm-1.png)
- [Candidate inner-side rendering](../../tmp/remaining-issues-template-20260908/candidate-1mm-2.png)
- [Machine-readable PDF inspection](../../tmp/remaining-issues-template-20260908/pdf-inspection.json)

## Product identity: same family, cutting geometry differs

The legacy importer [fetch-salesmapper-import.js](../../scripts/fetch-salesmapper-import.js) uses the WIRmachenDRUCK A4 two-flap product at lines 48–61. The live target has no preserved supplier identifier, so the importer alone does not prove this copied tenant product's production identity.

For a stronger comparison, the existing 5 mm tenant PDF was downloaded and compared against the canonical WIRmachenDRUCK **5 mm** two-flap / 4+0 / no-finishing PDF, not against the 1 mm candidate:

| Measurement | Result |
| --- | --- |
| Existing PDF SHA-256 | `6bb307f051fb3f39c96e21e959b795cd4b449544244e4c1e2ae75af941a03abe` |
| Current supplier 5 mm sanitized SHA-256 | `313a54c49ebc2803526ec4c647779bdb40989a25d40e0ba5ba14fcce1ec7a02c` |
| First-page MediaBox | Identical: 1428.66 × 1051.65 pt, approximately 504 × 371 mm |
| Six legacy fold lines | All coincide with current supplier vectors within 0.00082 mm |
| Outer cutting contour | Sampled deviation up to 1.278 mm |
| Side-flap slit | Sampled deviation up to 0.992 mm |
| Two bottom-flap cuts | Sampled deviations up to 1.106 mm |
| Page count | Existing 1; current supplier 2 |

The comparison measures proximity of sampled legacy stroked paths to current supplier vector segments. It is useful identity evidence, not a manufacturing tolerance certification. The legacy file carries 2017 Illustrator creation metadata; the canonical supplier PDF was downloaded on 30 August 2026. These records do not establish why the cutting paths differ.

| Existing tenant 5 mm die | Current supplier 5 mm die |
| --- | --- |
| ![Existing tenant 5 mm](../../tmp/remaining-issues-template-20260908/existing-5mm-1.png) | ![Current supplier 5 mm](../../tmp/remaining-issues-template-20260908/source-model-5mm-1.png) |

**Production decision needed:** confirm that the 1 mm choice in this tenant product should use the current WIRmachenDRUCK A4 two-flap construction. If that is not the intended production source/die, provide its exact supplier/product identity or matching 1 mm production template. The available candidate must not be described as an exact counterpart of the old die merely because the family and folds match.

## Prepared append-only attachment

The full [proposed attachment and rollback manifest](../../tmp/remaining-issues-template-20260908/proposed-attachment.json) contains the exact existing record, proposed record, complete after-array, proposed tenant-private designer row, Storage destination, before-state fingerprints and reversal conditions.

After production identity and local Designer QA are resolved, the intended mutation has three steps:

1. Copy the exact reviewed bytes into one new immutable `product-templates` object under this tenant product's path, with no upsert.
2. Insert one tenant-private designer template, proposed ID `f4b0f29e-6a27-4aeb-8b51-a5a316b228ca`, carrying verified PDF dimensions, bleed, safe area and the tenant copy URL.
3. Append one A4 / `1 mm ryg · 4+0` record to `products.template_files`, only if the captured product, groups, values, prices and previous template array still match. The existing 5 mm object stays unchanged.

No application matching code needs to change for this narrow append. No `selectionConstraints` or `selectionConstraintProfile` metadata is introduced: mixing a new structured binding with the old legacy record would disable the legacy 5 mm fallback. The proposed record uses explicit legacy format/configuration matching instead. All four current papers have exact source evidence for the same PDF; the product's vertical paper selection is absent from the label summary, so a paper-specific label constraint would be incorrect here.

The current resolver was executed against all **80** active format × spine × print × paper combinations:

- 8 existing A4 / 5 mm matches were preserved exactly.
- 4 A4 / 1 mm / 4+0 matches were added, one per supported paper.
- No unrelated selection gained a match.
- No structured-template compatibility restrictions were introduced.

See [matching verification](../../tmp/remaining-issues-template-20260908/template-matching-verification.json). This is a local source-level verification of the proposed array, not a live product change or browser proof.

Current state guards include:

| Snapshot | SHA-256 of canonical sorted-key JSON |
| --- | --- |
| Full product | `80a56fd2941bcd94235d18f74ebc65ef0f84b4e755e6f992b9a79631513be326` |
| 580 price rows | `4a82b344849082a8fd3ed68144da96fd0c7dabb6f5653dca4b529ee6b7e2bd18` |
| Existing template array | `42d7e6c545d9cf63e75b78e207f76cd367e15d902f53a81f54d98f23b560b789` |

Rollback must restore only the template array, guarded by exact equality with the expected after-array. It may remove the newly created designer row and Storage object only after confirming no other references. It must preserve the original 5 mm template, all prices/options/defaults/publication state, the master source product, the master template and the master Storage object. The snapshot is evidence, not permission to restore the whole product over later edits.

## Remaining gates and proof boundary

Executable attachment SQL has intentionally not been emitted while production identity remains unconfirmed. The exact proposed records and rollback conditions are reviewable in the manifest. The next implementation step is a guarded transaction built from a freshly reread snapshot after this specific production decision; it must be simulated locally before a live write is requested.

Before any live attachment, locally verify the proposed selected product launch, reviewed PDF SHA-256 in Designer, one locked nonprinting overlay, page handling, actual overlay-free production export and return to the exact order selection. After authorized attachment, repeat public download and tenant storefront/Designer checks against the written records.

No live write was approved or performed by this subtask. No price, product-default, schema, publication, permission or source-product change is part of the proposal.

Reproduce local checks:

```sh
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tmp/remaining-issues-template-20260908/inspect-pdfs.py
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-strip-types tmp/remaining-issues-template-20260908/build-proposal.mjs
```

The `tmp/` evidence directory is ignored and does not travel with an ordinary Git clone. Preserve it with the review packet before transferring this work to another checkout.
