# Checkout image approval geometry fix — 25 October 2026

Status: deployed to Webprinter, Online Tryksager, Salgsmapper, PVCbanner and the
two general shop addresses. Actual non-A4 upload approval passes on all four
custom-domain shops. See `docs/CHECKOUT_IMAGE_APPROVAL_RELEASE_2026-10-25.md`
for exact release/rollback receipts and verification boundaries.

The reported `Trykfilens mål eller placering er ugyldig.` error comes from
`src/lib/checkout/imageProofPdf.ts`. The existing approval handler in
`src/pages/FileUploadConfiguration.tsx` passes `{ ...currentProofArtifact,
bleedMm: specs.bleed_mm }`. That object includes file URL/path/hash strings,
file type and a boolean alongside the numeric placement fields.

The PDF builder used `Object.values(placement).every(Number.isFinite)`, so
valid checkout metadata always failed its geometry check. It now checks all
eight required numeric geometry fields explicitly. Existing positive-size,
scale, bleed and PNG/JPEG signature checks remain. PDF page geometry, image
placement, source hash verification and approval identity behavior are unchanged.

Regression coverage uses the same metadata-bearing spread as checkout and a
100 × 150 mm source image on an A5 product (154 × 216 mm including 3 mm bleed).
It checks the generated page/trim sizes and direct approval eligibility after
the placement has been baked into the PDF. It failed with the exact reported
message before the fix and passed afterward. Invalid/missing numeric fields
remain rejected; existing tests verify exact image position and scaling.

Validation:

- 15 focused tests pass across imageProofPdf, proofArtifact, proofAvailability
  and checkoutArtifact.
- ESLint passes for the two changed source/test files.
- Full application TypeScript check (`tsconfig.app.json`): passes.
- Production build: passes, with output isolated in
  `/private/tmp/webprinter-checkout-proof-fix-20261025-dist`.
  Build log: `/private/tmp/webprinter-checkout-proof-fix-20261025-build.log`.
  Vite reports its existing Browserslist, lcms-wasm externalization, runtime URL
  and chunk-size/dynamic-import warnings; no build error.

Only the image-PDF geometry validator and its tests change application behavior.
Existing pricing, POD flows, upload handlers, database and publishing behavior
are untouched. No payment, order submission or hosted storage write was made.

Selective rollback: restore the single `values` declaration in
`imageProofPdf.ts` to its previous `Object.values(placement)` implementation
and remove the two added regression tests/import. That restores the reported
bug; prefer repairing forward. Do not reset these previously untracked files or
the dirty checkout wholesale.
