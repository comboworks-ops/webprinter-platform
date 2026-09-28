# Direct product editing — 24 September 2026

The product workspace keeps its left settings panel and actual customer preview. This follow-up reduces each section toolbar from the observed 44 px button height to 26 px on desktop (40 px touch targets at narrow widths), with a draggable title and a small plus button. The global bank button and section placement menu/arrows are removed. Dragging a section title swaps its position; Alt + Up/Down remains available from the focused title. Option buttons and matrix material names use pointer dragging within their own section.

Clicking an actual format, finish or matrix material name selects that exact source value and opens its customer-facing name, dimensions where available, and a searchable contextual bank at the top of the left inspector. Hidden format values are visible only in edit mode. Plus selects add mode; an empty presentation box offers a large plus and a bank type chooser. Existing values can be replaced or added. The selected item's name remains a presentation override, not a rename of shared source/library data.

The compact bank reads the existing active designer_templates catalogue, using the existing product-attribute createGroup/addValue operations when a user explicitly chooses a bank item. Source records are copied additively; existing source IDs, supplier metadata and prices are never rewritten or deleted. The layout references remain in the open draft and use the existing guarded save/apply path. Newly chosen values need their own matching prices. A pure helper validates section/type/source identity, duplicate/stale replacement references, source whitelists and presentation membership. Existing values still used by another presentation remain whitelisted.

The authenticated preview now receives current product attributes through the same origin/source-checked workspace message channel. A separate preview-source context stays available when switching between edit and customer-preview modes, preventing stale cached attributes from hiding newly added bank values. Ordinary customer pages retain their normal data-fetching path.

Optional finishing buttons are immediately usable without the extra Tilvælg checkbox. Clicking a selected optional choice again uses the existing deselection logic. Dropdown Ingen now clears an optional selection. Required choice rules, finish exclusivity, availability and price calculations remain unchanged. In this product's saved configuration UV-lak is required; optional behavior was verified using an unsaved QA draft with Kunden vælger set to Valgfrit tilvalg. This did not change the saved product setup.

## Verification

- 35 focused tests pass, including five new bank-reference tests and existing placement, save/tenant/concurrency, presentation and gallery tests.
- Full application TypeScript and Vite production build pass on the hydrated verification copy. Existing large-bundle warning remains.
- Six new/modified small TS/TSX files lint clean. Existing larger files have unchanged counts: ProductWorkspace 3/0, MatrixLayoutV1Renderer 30/2, PriceMatrix 0/1 (errors/warnings).
- Actual authenticated localhost product: clicking 135g kvalitetstryk in the price matrix opened the correct name and Materialebank (19 entries); clicking hidden 100x100mm opened Formatbank; plus switched to add mode; no global bank button, placement menu or Tilvælg checkbox remained.
- Actual section pointer drag swapped UV-lak above Papirfinish. Option pointer drag changed UV-lak front / front og bag order. Price remained 464 kr for the supported selected configuration.
- In the unsaved QA draft, making UV-lak optional allowed the selected option to turn off and back on directly. Unavailable laminate choices still showed their existing availability hints.
- Creating an unsaved empty presentation box exposed its plus; clicking it opened the bank type selector; Materialebank search for 350g found 350g matsilk. No bank result was clicked to create/copy a record.
- No error-level console entries before cleanup. The original product tab had no unsaved changes and no horizontal overflow at its normal 933 px width. Full six-width responsive recheck of this follow-up remains incomplete due to the native reset dialog described below. Prior left-panel layout checks at 320–1440 px remain historical evidence only; no physical touch-device test was performed.

## Runtime, evidence and remaining browser cleanup

All 13 scoped source files match the repository, active 8113 source at /private/tmp/featured-product-review-2026-09-22/app and verification source at /private/tmp/product-canvas-2026-09-23/app. Evidence and pre-edit backups are in output/product-canvas-2026-09-24/, including source-hashes.json, scoped.patch and verification logs. No deployment, product save/apply, library mutation, upload, payment or schema change was performed. Live bank-copy/save/readback remains untested; tests cover reference transitions and existing fake-client persistence.

The separate in-app QA tab (browser 2 / tab 2) contains only agent-created unsaved changes. Its Nulstil til aktuel form confirmation blocked browser actions. getJsDialog did not expose the native prompt; direct control of the native Codex app was denied by the computer-use tool. A scoped attempt to close only the QA tab also timed out. The user has been asked to confirm the reset dialog. Do not reset the original user tab (browser 2 / tab 1) or restart the application. A final viewport-set attempt did not return, so viewport restoration must also be checked once the dialog is closed. This is a browser-cleanup limitation, not proof of a product crash.

Rollback: reverse only the scoped source changes after comparing for subsequent edits. Preserve other workspace changes and all source/price records. No database rollback is needed.
