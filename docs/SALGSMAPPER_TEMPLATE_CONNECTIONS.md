# Salgsmapper.dk template connections — 29 September 2026

## Scope and state

The published Salgsmapper.dk catalogue has four sales-folder products. Standard folders currently have two legacy template links; lamination, UV varnish and spot UV have none. All four products have stored prices for A4, A5, A6, M65 (previously labelled DIN lang) and 21 × 21 cm.

The standard product's existing 1 mm / 5 mm spine selector, four papers and 4+0 / 4+4 print modes produce 80 exact selections backed by 20 distinct approved PDFs. This plan retains the two historical template records; exact bindings take precedence and unsupported selections fail closed.

Finished products do not specify a spine or flap construction. Both two-flap 1 mm and two-flap 5 mm candidates are prepared, but neither is authorized as their physical specification until Thomas confirms that choice. Each candidate adds 50 lamination, 20 UV varnish and 20 spot-UV links. Soft-touch exists only on silk paper in the existing price data.

Spot UV remains `professional_pdf_upload_only`: its PDF needs a production varnish mask that the online Designer cannot currently create. The correct PDF and 3D model can still be connected. The 3D preview displays shape/artwork, not a physical simulation of the surface finish.

## Handoff repair

A direct selected PDF without a Designer-library ID previously inherited the old option-linked ID. Designer could then load the previous A4 template instead of the selected A5/A6/M65/square spread. `resolveLinkedDesignerTemplateId` now makes the exact PDF launch authoritative and preserves the legacy ID only for products without a configuration-specific launch.

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

## Verification

- 66 focused template/3D tests pass, including exact-PDF/legacy-ID regression.
- TypeScript and production build pass.
- All 120 distinct hosted PDFs across both finish-spine candidates match SHA-256.
- Browser selected all 20 standard format/spine/print combinations: matching download, enabled Designer and rendered 3D canvas for every combination.
- Authenticated private upload/persistence remains an acceptance check; the existing upload control requires sign-in.

## Deployment and rollback

Release the handoff repair before activating the live connections. Apply only a compare-and-swap update of the selected products' `template_files` plus the corresponding DIN lang → M65 attribute display names. Check the original pricing-structure JSON and price-row fingerprint before writing; read them back after writing. Leave finished products unchanged while their spine specification is unresolved.

Rollback the product data using the saved `beforeTemplates` and attribute names, only if current values still equal this plan. Revert the handoff repair commit to roll back application code. No migration is needed.
