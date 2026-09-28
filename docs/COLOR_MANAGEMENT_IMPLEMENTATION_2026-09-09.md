# Color management implementation — 9 September 2026

Status: implemented in the local working tree. No deployment, tenant profile upload, product write, or live order submission was performed during this implementation.

## What changed

1. **Sharp proof preview.** The visible document is rendered at device pixel density. Zoom and edits invalidate pending frames; no logical-size intermediate resampling. The preview is cleared during editing/loading and the UI states when original colors are being shown. The existing LittleCMS transform and document/pasteboard/guide geometry are retained.
2. **Exact profile selection.** ICC header, role, channel count, tag bounds, size and SHA-256 are validated. Lookup is tenant-scoped. Missing files and changed saved hashes cause an explicit error; they never silently select FOGRA39. Saved designs carry a versioned profile identity/checksum and production color mode in their JSON.
3. **Standard profiles and method advice.** The catalog distinguishes sRGB input from three CMYK output recipes: ISO Coated v2 300% / FOGRA39, PSO Coated v3 / FOGRA51, and PSO Uncoated v3 / FOGRA52. Product settings and the designer explain offset coated/uncoated, digital paper, wide format, DTG/DTF, sublimation and screen printing. Machine/media-specific workflows do not receive invented universal profiles.
4. **Production export.** Print and vector download routes, apparel PDF, single-page order artwork, and template-page assembly use the same new production builder. Supported new text/shapes are vector paths. Images contain real CMYK samples in CMYK mode; the selected ICC is embedded as an OutputIntent. Unsupported object effects/fonts fall back per object with a visible warning. Source PDF colors remain preserved, with a warning stating that they have not been converted.
5. **Supplier color requirements.** Production export offers CMYK or tagged sRGB. Product settings can specify the supplier's required mode; apparel defaults to sRGB. The selected mode is saved with the design. Garment PNG uses original RGB artwork and alpha, never the simulated proof image. Explicit proof PDF remains a separate RGB simulation.
6. **Product administration.** The existing profile selector is now connected in the product's About section. The color-only save reads current specifications, protects tenant ownership, rejects conflicting color edits, and checks `updated_at` before merging only color fields. Supplier/pricing/template metadata remains untouched by that save.

## Free components reused

| Component | Role | License / packaging |
|---|---|---|
| Existing LittleCMS WASM | ICC preview and new-artwork color conversion | LittleCMS MIT; existing pinned wrapper retained |
| Existing pdf-lib and jsPDF | PDF objects, composition, page boxes and vector paints | MIT |
| [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) 2.8.1 | Convert curated Fabric-generated SVG to PDF vectors | MIT; only generated/screened SVG reaches it |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) 1.1.1 | Outline the actual declared font | MIT |
| [Fontsource Inter](https://github.com/fontsource/fontsource) 5.3.0 | Locally available Latin font bytes for reliable vector text | OFL-1.1; license and checksums under `public/fonts/inter/` |

Only the two exact dependency additions and their new transitive entries were added to the existing pnpm lockfile. No paid PDF adapter is required; the optional Stirling integration is unchanged. This work does not add a PDF/X certification engine.

## Installing the new standard profiles

The official ECI profiles are free to obtain/use/embed, but their embedded copyright terms restrict standalone redistribution. Their binaries therefore **are not added to the production public assets**.

- [PSO Coated v3 official profile](https://registry.color.org/profile-registry/PSOcoated_v3)
- [PSO Uncoated v3 official profile](https://registry.color.org/profile-registry/PSOuncoated_v3_FOGRA52)

In the shop's **Farveprofiler** administration, use the official download link, then upload the ICC file as a CMYK output profile. The upload parser shows its description, version, channels and checksum. A recognized checksum makes the corresponding standard recipe available for that shop. Custom printer/media output profiles use the same upload flow.

For local development only:

```sh
python3 scripts/prepare-local-color-profiles.py
```

This downloads official ECI archives, extracts only the named ICC member, checks its expected hash and writes ignored `tmp/local-color-profiles`. A Vite `serve` plugin exposes only the two allowed filenames. Local copies are prepared in this checkout and both initialize successfully. A production build was inspected: `/icc/` still contains only the two pre-existing files (sRGB and FOGRA39).

| Recipe | SHA-256 |
|---|---|
| FOGRA39 | `c6b4b62f0726243742eced8b9669476a6be89e581f50a7600ed8b6fcbb9cdab8` |
| FOGRA51 | `c30ad2c01e8f93135ec7682c535e0a81bc2d177c301e196376c5f5838b5c8e86` |
| FOGRA52 | `7c39f74fbede1e8c85f8fbb9df7d359aea638b9b68dd0854fdd3ba386e3a02c0` |

## Verification

The actual designer was checked at localhost:8110 in this checkout, with browser DPR 2:

| Zoom | Proof CSS area | Proof backing bitmap | Result |
|---|---|---|---|
| 100% | 277.10 × 388.71 | 554 × 777 | Display-density proof; sharp text |
| 200% | 494.17 × 461 visible intersection | 988 × 922 | Sharp text; crop remains on visible document |

Proof on/off, editing text under proof, blue artwork, and FOGRA51/52 initialization were checked. Screenshots and dimensions are preserved under `output/research/color-management-2026-09-09/after/`. Browser dimensions depend on the available viewport; they demonstrate density, not a fixed document-size requirement. HMR interrupted some intermediate attempts; successful checks were repeated after clean loads.

Focused automated checks cover ICC malformed input, roles, size/tag bounds, checksum tampering, tenant boundaries, missing-profile errors, recipe/FK separation, product metadata preservation, saved identity round trips, preview geometry/stale requests, PDF ICC/image objects, physical raster budgets, and page boxes. Final results: **41 focused tests pass**, and the Vite production build passes (existing bundle-size warnings). The full repository typecheck still reports unrelated generated-schema/Fabric/pricing errors; the final diagnostic scan has no errors in the color core, profile hook, new exporter modules/tests, profile administration or proof/export panels. Existing diagnostics in Designer/ProductPriceManager remain outside the changed logic.

A separate mocked-browser fixture exercised the real profile selector and ProductPriceManager save handlers: **7 assertions pass** with zero page errors. It checked the Back-button unsaved-change guard, a technical-spec save retaining a pending color edit, color-only save/reload preserving other specifications, the profile library/install links, and deletion blocked by a saved-design reference. All remote calls were intercepted, so this is not a live database write/readback claim. Browser history/programmatic navigation remains outside the new color-draft guard.

The actual Designer ExportDialog completed CMYK production and sRGB-with-proof-off exports. Browser download bytes were not inspected; separate generated PDF fixtures establish the PDF structure. Those fixtures contain **4 vector objects / 19 outlined text runs / 2 raster objects / 1 original PDF page**; CMYK ICC/image structure and named CutContour separation were checked. Raster fallback is limited to the image/shadow objects in that example. Rotated and cropped source PDF comparison covers 0/90/180/270 degrees; transparent garment output has alpha 0 in empty pixels, and no-bleed boxes match the trim size. Rendered Danish glyphs and the source/output rotation comparison were inspected visually.

The preview was restored on PID 3823, port 8110, with its working directory verified as this checkout. A fresh A4 Designer rendered, initialized proofing and reported no console errors. Screenshots, source/output PDFs, structure JSON, build/test logs and fixture evidence live under `output/research/color-management-2026-09-09/`.

## Practical limits

- A screen simulation depends on monitor/browser/display calibration and does not certify a physical print match. Paper-white simulation and measured gamut testing are not implemented.
- Browser-created artwork is interpreted as sRGB. This does not recover an uploaded image's original wide-gamut data after browser rasterization.
- Imported PDF colors are preserved, not universally recolored into the new destination. Rectangular page crop and 0/90/180/270-degree source rotation are supported. Files with annotations/form fields or object-level clipping of an imported page must be prepared first; errors retain the source design.
- Text exported as vector outlines is sharp but not searchable/selectable PDF text. Missing exact font data or unsupported effects cause an explicit per-object raster warning.
- White underbase generation, ink limiting for a particular machine, RIP calibration, garment separations, DeviceLink workflows and measurement-based printer profiling remain production/RIP tasks.
- Profile deletion prechecks product and saved-design references visible through tenant RLS. This is not an atomic server constraint against concurrent references or rows the caller cannot read.
- Live authenticated tenant installation, product save/readback, saved design round-trip and order-storage submission were not performed. Local tests and synthetic fixtures do not establish hosted acceptance.

## Rollback

No schema migration is required. Preserve the dirty working tree. The pre-change backup branch ref is `codex/backup-color-management-2026-09-09`; snapshots of relevant dirty files are under `/private/tmp/webprinter-color-before-2026-09-09`. Revert only this implementation's hunks or restore individually reviewed files from those snapshots. Do not reset the whole checkout or restore a clean historical file over unrelated changes. New product color metadata is additive and can remain stored while a code rollback is assessed. Shop-uploaded ICC files must not be deleted while saved designs/products reference them.
