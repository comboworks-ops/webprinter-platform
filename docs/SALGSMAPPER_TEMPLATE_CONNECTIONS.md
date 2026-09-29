# Salgsmapper.dk template connections — 29 September 2026

## Scope and state

The published Salgsmapper.dk catalogue has four sales-folder products. Standard folders currently have two legacy template links; lamination, UV varnish and spot UV have none. All four products have stored prices for A4, A5, A6, M65 (previously labelled DIN lang) and 21 × 21 cm.

The standard product's existing 1 mm / 5 mm spine selector, four papers and 4+0 / 4+4 print modes produce 80 exact selections backed by 20 distinct approved PDFs. This plan retains the two historical template records; exact bindings take precedence and unsupported selections fail closed.

Finished products do not specify a spine or flap construction. Both two-flap 1 mm and two-flap 5 mm candidates are prepared, but neither is authorized as their physical specification until Thomas confirms that choice. Each candidate adds 50 lamination, 20 UV varnish and 20 spot-UV links. Soft-touch exists only on silk paper in the existing price data.

Spot UV remains `professional_pdf_upload_only`: its PDF needs a production varnish mask that the online Designer cannot currently create. The correct PDF and 3D model can still be connected. The 3D preview displays shape/artwork, not a physical simulation of the surface finish.

## Handoff repair

A direct selected PDF without a Designer-library ID previously inherited the old option-linked ID. Designer could then load the previous A4 template instead of the selected A5/A6/M65/square spread. `resolveLinkedDesignerTemplateId` now makes the exact PDF launch authoritative and preserves the legacy ID only for products without a configuration-specific launch.

The browser also exposed a stale paper ID after automatic price-row fallback (A6 soft-touch selects silk). Matrix selection callbacks now emit the actual selected row ID, including manual paper-row clicks. This changes only the selection handoff; the existing price matrix and calculations are untouched.

No pricing formulas, price rows, POD logic, tenant ownership, schema, or publishing flags change.

## Reproduce the read-only connection plan

Run `scripts/build-salgsmapper-connections.mjs` with Node 24:

```
node scripts/build-salgsmapper-connections.mjs \
  --snapshots=/absolute/path/to/sales-folder-connections-2026-09-29 \
  --archive=/absolute/path/to/wmd-sales-folders-20260831-full \
  --output=/absolute/path/to/standard-plan.json
```

Only after construction is confirmed, add `--finished-spine=1mm` or `--finished-spine=5mm`. The script never writes to Supabase. It validates exact source matches, PDF hashes, approved models, page counts, dimensions, uniqueness and rejection of every unknown selection axis. Snapshot files are `live-before.json`, `attributes-before.json`, and `price-coverage-before.json`.

Local evidence is under the original checkout's ignored `output/sales-folder-connections-2026-09-29/`. The local review at port 8162 substitutes proposed templates over read-only live catalogue responses and blocks backend writes. It does not prove a persisted upload or live deployment.

## Printed sides versus supplier reference pages

The approved 4+0 folder PDFs contain a second, non-printing inside reference spread. The Designer previously treated both PDF pages as production pages. `printModelArtworkPageIndices` now uses the approved model's printed-side count for export; the reference spread is excluded from the editable page tabs. 4+4 keeps both artwork pages in outside/inside order. Other, unrecognized multipage templates retain their existing page count. The production export, color-management and guide-hiding implementations are unchanged.

## Verification

- 70 focused template/3D tests pass, including exact-PDF/legacy-ID regression.
- TypeScript and production build pass.
- All 120 distinct hosted PDFs across both finish-spine candidates match SHA-256.
- Browser selected all 20 standard format/spine/print combinations: matching download, enabled Designer and rendered 3D canvas for every combination.
- A6 soft-touch selects the existing silk-paper price and matching PDF/3D; switching to gloss and clicking Chromo updates the template. M65 spot UV 4+4 renders with professional-PDF-only guidance.
- Actual Designer PDF blobs checked through a local-only export hook: A4 1 mm 4+0 exports one 493.998 × 366 mm page; 4+4 exports two pages of that size. Only 4+4 offers the inside artwork tab.
- Authenticated private upload/persistence remains an acceptance check; the existing upload control requires sign-in.

## Deployment and rollback

Release the handoff repair before activating the live connections. Apply only a compare-and-swap update of the selected products' `template_files` plus the corresponding DIN lang → M65 attribute display names. Check the original pricing-structure JSON and price-row fingerprint before writing; read them back after writing. Leave finished products unchanged while their spine specification is unresolved.

Rollback the product data using the saved `beforeTemplates` and attribute names, only if current values still equal this plan. Revert the handoff repair commit to roll back application code. No migration is needed.
