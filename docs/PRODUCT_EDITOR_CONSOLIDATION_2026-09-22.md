# Product editor consolidation — local implementation

## Result

- **Produktside** owns customer presentation: section placement, selection style, button/image/box styling, descriptions, section setup and customer preview.
- Standard products offer **Udseende og placering** and **Formater, materialer og sektioner**. Expand a section and choose **Placering på siden → Ved siden af Format** to put it alongside Format. Up to three sections share a row; narrow screens stack them.
- **Priser** replaces **Produkt & Priser**. The current pricing source selects the standard generator, wide-format generator or existing machine configuration. The source switcher remains available in a collapsed disclosure.
- Quantities, combination selection, anchor prices, product/master markups, manual price editing and import/bank tools remain available. The old editable price preview is now collapsed under **Manuel prisredigering** so existing cell editing is retained.
- Machine presentation selection lives under Produktside; its existing price/profile/material configuration remains under Priser. Initial selection waits for machine configuration to load rather than locking into the standard matrix early. It follows the active price source rather than the legacy last-visited-panel setting.

## Data boundaries

Standard source-layout saves merge only presentation/source-layout fields into a fresh tenant-scoped product record, preserve pricing metadata and existing source/value identities, and compare the product timestamp before writing. Stale editors and unapplied presentation drafts block this save. Presentation grouping never rewrites price rows.

No pricing formulas, database schemas, POD logic, imports or machine calculation engines were changed. Wide-format and machine saves use their existing save paths. No authenticated product saves, publishing, uploads, payments or deployment were performed during verification.

## New-product recommendation

Choose **fixed formats** or **custom dimensions** first, then choose the **price source**: manual/imported prices or machine calculation. Machine calculation is a source usable with either dimensional model, not a fourth competing product type. This recommendation does not change the creation flow in this patch. Generating stored standard/wide-format price tables from the machine engine remains a separate pricing feature, not implemented here.

## Verification

- 28 focused tests pass: presentation draft/apply, source identity preservation, tenant/timestamp guards, matrix price safeguards and section placement.
- TypeScript check passes in an isolated recovered application copy; production Vite build passes. Existing chunk-size warnings remain.
- Changed-file lint: 350 existing messages versus 351 in pre-task snapshots, with no added messages. Existing repository lint debt is not part of this change.
- Synthetic browser data verified joining Format/Papirfinish, draft/apply, source rename/save without losing placement, the standard/wide-format surfaces and contextual machine settings. Synthetic backend writes were isolated in browser local storage with no production connection.
- Standard editor responsive checks covered desktop and narrow widths. The final wide-format responsive pass could not change the viewport after the computer locked; desktop DOM checks passed.
- The running connected preview at `http://127.0.0.1:8113/admin/product/new-folders#workspace` was updated through a task-only source overlay without restarting the server. Read-only verification confirmed Priser, the new placement control and the real customer preview with existing prices. Priser showed the standard generator, both markups, manual editing and the existing 20,640-row summary, with no section-layout editor.

The workspace has cloud-offloaded files and substantial pre-existing changes. Build/type verification used `/tmp/product-consolidation-20260922/app`, overlaying available current workspace files on the recovered application. Missing unrelated cloud files used recovered copies. This is local evidence, not a deploy-ready clean-checkout claim.

## Review and rollback

Only review this task's deltas in ProductWorkspace, ProductAttributeBuilder, ProductPriceManager, StorformatManager, MatrixLayoutV1Renderer and productWorkspace, plus the new productLayoutSave, sectionPlacement, useProductSetupGuard and scoped CSS files. Do not revert these entire existing files: they contain earlier work.

Pre-task file snapshots and local verification logs are in `/tmp/product-consolidation-20260922`; running-preview backups are in its `live-before` directory. Roll back only task deltas. No database rollback is needed.
