# Open Design + PDF Designer Integration Plan

Last updated: 2026-07-10

## Purpose

This note captures how the installed Open Design skills can support the existing
Webprinter design system and how Stirling-PDF-style capabilities could be
intertwined into a complete online print design product.

The plan is additive. It does not replace the current Fabric designer, pricing
logic, POD v1, POD v2, or protected vector PDF export path.

## Installed Open Design Skills

Installed from `nexu-io/open-design` into `~/.codex/skills`:

- `canvas-design`
- `frontend-dev`
- `shadcn-ui`
- `brandkit`
- `brand-guidelines`
- `brand-extract`
- `color-expert`
- `theme-factory`
- `design-review`
- `design-consultation`
- `impeccable-design-polish`
- `web-design-guidelines`
- `ui-skills`
- `reference-design-contract`
- `library-curator`
- `screenshot`

Already present before this pass:

- `pdf`
- `frontend-design`
- `hyperframes`

Several Open Design entries are catalog wrappers that point to upstream skill
bundles. They are useful for discovery and planning now, but their full
upstream workflows can be installed later if a specific workflow needs them.

## Best Fit For Webprinter

### 1. Design System Contract

Use `reference-design-contract` to turn Webprinter's current product direction,
tenant storefronts, print-designer UI, PDF tool needs, and visual references
into a reusable design contract:

- `DESIGN.md`
- `design-contract.md`
- `implementation-handoff.md`

This fits Webprinter because the platform already has:

- tenant branding data
- master branding template data
- Site Design V2 controls
- shadcn/Tailwind UI primitives
- storefront theme presets
- a print-focused Fabric designer

The contract should become the bridge between creative direction and code,
instead of creating one-off visual tweaks in unrelated components.

### 2. Token And Theme Expansion

Use `theme-factory`, `color-expert`, `frontend-design`, and `web-design-guidelines`
to create a small number of durable theme/token packages:

- storefront theme tokens
- admin/design-tool theme tokens
- PDF editor tool-surface tokens
- print preflight/status colors
- accessible dark/light variants

These should map into the existing branding model and theme variable system,
not a parallel styling system.

### 3. Designer UI Polish

Use `shadcn-ui`, `ui-skills`, `impeccable-design-polish`, and `design-review`
for the PDF designer surface:

- toolbar grouping
- layer panel clarity
- import/edit/export dialogs
- preflight status density
- icon-first tool controls
- keyboard focus and reduced-motion checks
- before/after screenshot review

This should preserve the current designer architecture and avoid replacing
Fabric.js or the protected export pipeline.

### 4. Brand Asset And Template Library

Use `brandkit`, `brand-extract`, `library-curator`, and `canvas-design` to
improve the design library:

- tenant-specific brand kits
- master brand starter packs
- print template inspiration
- reusable poster/flyer/layout primitives
- generated visual directions that are stored as design resources

This maps naturally onto existing design library concepts: saved designs,
templates, and resource items.

## Stirling-PDF Lessons

Stirling-PDF is a full PDF platform, not a small component library. It includes
server-side tools, a React editor, PDFium/WASM usage, and plugin-based browser
PDF editing concepts. Some subtrees use restricted licenses, so Webprinter
should not copy Stirling internals into production without legal review.

The useful direction is architectural:

- keep Webprinter's current print designer
- add focused PDF tools around the existing PDF import/export flow
- preserve original PDF bytes for vector export
- send heavy PDF transformations to a separate service later

## Stirling-PDF Upstream Audit (2026-07-10)

Reviewed upstream commit `863cad22bdf93686957f26512e647ebc9911cea7`.

### What Is Already Implemented In Webprinter

Webprinter does not embed or run Stirling-PDF. It already implements the most
useful customer-facing PDF editing subset natively:

- page selection and multipage navigation
- rotate selected page
- crop selected page to the product format
- add stamp and signature text with selectable contrast color
- reopen and replace an imported PDF without stacking duplicates
- center and fit an imported PDF to the document
- preserve original PDF bytes for vector-background export
- composite Fabric artwork over the preserved vector PDF
- preserve CutContour as a vector spot-color path
- browser metadata inspection and an authenticated edge-service foundation

The following Stirling-style operations are declared as future capabilities but
are not currently backed by a processor:

- OCR
- compression
- repair
- PDF/A conversion
- true redaction
- form flattening
- editing existing PDF text objects

### Upstream Architecture Finding

Stirling's text editor is not a standalone React component. Its frontend sends
the PDF to `/api/v1/convert/pdf/text-editor`, receives an editable JSON model,
and sends that model to `/api/v1/convert/text-editor/pdf` to rebuild the PDF.
The frontend therefore depends on the Stirling server/engine for true existing
text editing.

The repository root is MIT except for explicitly listed directories. The
`engine/` directory and several editor directories use the Stirling PDF User
License, which restricts client-facing or production use without an active
license. Do not copy or deploy those parts until commercial/legal review has
approved the exact version and usage.

### Recommended Integration Seam

Keep `designer-pdf-service` as Webprinter's only server-facing PDF interface.
Add a Stirling adapter behind that interface after licensing and deployment are
approved:

```text
Designer/PDF tools
  -> designer-pdf-service (auth, tenant ownership, operation allowlist)
  -> private Stirling container (X-API-KEY, no public browser access)
  -> immutable output file in tenant-owned Supabase storage
  -> report + output storage path returned to the designer
```

The browser must never receive the Stirling API key or call Stirling directly.
The adapter should prefer tenant-owned Supabase storage paths, create a new
output object for every transformation, and never overwrite the source PDF
automatically.

### Recommended Operation Order

1. **Flatten forms** - prevents missing or interactive form content in print.
2. **Repair** - recovers malformed customer PDFs before import/preflight.
3. **Compression** - useful for upload and storage, with explicit quality modes.
4. **OCR** - useful for scanned documents, but secondary for artwork production.
5. **True redaction** - useful for document workflows, not a core print-order task.
6. **PDF/A** - archival capability; not a substitute for PDF/X prepress output.
7. **Existing text-object editing** - advanced/admin-only until font, glyph,
   layout, licensing, and round-trip fidelity are proven with production files.

### Product Judgment

Stirling-PDF is a broad document-processing platform, not a print-production
preflight engine. It can strengthen PDF intake and repair, but it does not
replace Webprinter's required checks for PDF/X, output intent, embedded fonts,
bleed/trim boxes, image resolution, spot colors, transparency, and overprint.

The best customer experience remains:

- use Fabric for adding and positioning new text/images/design objects
- use `pdf-lib` for safe page-level edits that preserve the source PDF
- use a licensed private Stirling service for heavy document transformations
- keep true existing-object PDF editing as a separate advanced workflow

### Deployment And Security Requirements

- Run Stirling as a separate private Docker/Java service, not inside Vercel or a
  Supabase Edge Function.
- Keep its API private and authenticate from the edge adapter with `X-API-KEY`.
- Verify tenant ownership before reading any storage object.
- Allowlist operations and reject arbitrary upstream URLs.
- Keep file-size, timeout, concurrency, and persistent rate limits.
- Store outputs at new paths and retain an audit record of source, operation,
  output, user, tenant, and processor version.
- Delete temporary processor files after each job and define a retention policy.
- Show whether an operation preserves vectors, changes page boxes, or rasterizes
  content before the user confirms it.

## Current Webprinter PDF Foundation

Relevant current files:

- `src/components/designer/PDFImportModal.tsx`
- `src/lib/designer/export/exportVectorPdfBackground.ts`
- `src/pages/Designer.tsx`
- `src/components/designer/PreflightPanel.tsx`
- `src/utils/preflightChecks.ts`

The current flow already:

- imports a PDF page with PDF.js
- renders a high-resolution preview for Fabric
- stores original PDF bytes
- exports by copying the original PDF page with `pdf-lib`
- composites user-added overlays
- preserves vector PDF background content
- writes CutContour paths as vector strokes

This is the core capability to build on.

## Recommended Product Shape

### Phase 1: PDF Edit Modal

Add a `PdfEditModal` that opens before or after PDF import.

Initial tools:

- select page
- rotate page
- crop/fit to product trim or bleed
- add signature overlay
- add text/stamp overlay
- flatten edits into a new PDF byte buffer
- pass edited bytes into the existing `PDFImportModal` import path

Use existing browser-side dependencies first:

- `pdfjs-dist`
- `pdf-lib`
- Fabric overlay rendering

### Phase 2: PDF Tool Panel In Designer

When a PDF background is selected, expose a compact "PDF tools" panel:

- replace source PDF
- change selected page
- fit to document
- re-open PDF edit modal
- inspect original dimensions
- show vector-preservation status
- warn when an operation rasterizes content

### Phase 3: Server-Side PDF Service

For heavy operations, create a separate service or Supabase Edge Function path.

Candidates:

- OCR
- compression
- true redaction
- form flattening
- PDF repair
- PDF/A conversion
- preflight checks beyond the browser

Stirling-PDF can be evaluated as a self-hosted inspiration or external service,
but production use must account for license, deployment cost, tenant isolation,
and file privacy.

### Phase 4: Complete Design Product

Combine Open Design and PDF tools into one product loop:

1. User or admin uploads PDF/design reference.
2. `brand-extract` or `reference-design-contract` creates a design direction.
3. Site Design V2 maps direction into tenant branding tokens.
4. Designer imports PDF as vector-preserved background.
5. PDF tools modify page-level structure without breaking print constraints.
6. Fabric tools add print-safe overlays, dielines, text, images, and brand assets.
7. Preflight validates resolution, bleed, safe area, and PDF-specific risks.
8. Export preserves vector PDF where possible and records warnings.

## What Not To Do

- Do not replace the existing designer with Stirling-PDF.
- Do not copy restricted Stirling code into Webprinter.
- Do not modify core pricing or POD logic for this work.
- Do not create a parallel design-system storage model.
- Do not make Hyperframes or Remotion part of the core designer unless video
  output becomes a real product requirement.
- Do not promise true PDF text-object editing inside Fabric; use a dedicated
  PDF edit path or server service for that.

## Best Next Implementation Slice

Build a small proof of concept:

- `PdfEditModal`
- rotate page
- fit/crop page to current document
- add signature/text stamp overlay
- return edited PDF bytes
- import edited bytes through the existing vector-preserving path

Acceptance checks:

- A4 PDF import still exports vector background.
- Overlay objects still export.
- CutContour export still works.
- Multipage source PDFs still allow page selection.
- Existing designer save/load is not broken.
- `npm run build` passes.

## Local Validation Fixtures

Created for the first PDF edit/import validation pass:

- `output/pdf/webprinter-a4-vector-test.pdf`
  - A4, 2 pages, vector text, vector shapes, CMYK rectangle, page navigation test.
- `output/pdf/webprinter-business-card-vector-test.pdf`
  - 85 x 55 mm, dark artwork, vector text and border.
- `output/pdf/webprinter-a4-edited-page2-rotate-stamp.pdf`
  - Edited output example with page 2, rotation, stamp text, and signature.
- `output/pdf/webprinter-card-edited-light-text.pdf`
  - Edited output example showing light stamp/signature text on dark artwork.

Rendered previews live under `tmp/pdfs/` and were checked with Poppler. The
first validation exposed that fixed dark stamp text is unreadable on dark PDFs,
so the import modal now includes a text color selector: dark, light, or blue.

## Implemented Designer Slice

Added after the first validation pass:

- PDF tool panel for selected PDF backgrounds.
- Re-open/edit selected PDF using its preserved source bytes.
- Replace selected PDF instead of stacking a duplicate.
- Previous/next page switching for multipage PDFs.
- Direct global drag-drop into the import modal.
- Position, scale, rotation, checkout-import marker, and vector source metadata
  are preserved when replacing a PDF object.

Validation:

- `vite build` passes.
- Local designer route responds at `http://127.0.0.1:8082/designer?format=A4`.
- Playwright Chromium smoke test passes for import, selected page switch,
  reopen/edit, replace selected PDF, and opening vector export.
- PDF preview rendering now uses a fresh offscreen canvas per render to avoid
  PDF.js render-task races when edit controls update quickly.

## Implemented Phase 3 Foundation

Added a generic designer PDF service path that is separate from POD v2:

- `supabase/functions/designer-pdf-service/index.ts`
  - accepts `pdfUrl` or `pdfBase64`
  - supports an `inspect` operation now
  - returns page count, file size, first-page dimensions, warnings, errors, and
    capability status for future heavy operations
  - marks OCR, compression, repair, PDF/A, true redaction, and form flattening
    as external-provider-required until a processor is configured
- `src/lib/designer/pdfService.ts`
  - shared frontend report types
  - browser inspection fallback using `pdf-lib`
  - edge invocation path for the new function

Deployment note:

```bash
supabase functions deploy designer-pdf-service
```

## Implemented Phase 4 Product Loop Slice

Added the first complete design-product loop inside the selected-PDF panel:

- PDF source status
- PDF-service scan status
- preflight handoff
- vector-export handoff

The current product loop is intentionally compact and additive. It does not
replace the existing designer, Site Design V2, design library, pricing, POD v1,
POD v2, or protected vector export pipeline.

Validation:

- `vite build` passes.
- Focused lint passes for `PdfToolsPanel.tsx` and `pdfService.ts`.
- Playwright Chromium smoke test passes for importing a PDF, running the
  service scan, and showing the design-product flow with no console errors.

## Implemented Stirling Provider Slice (2026-07-10)

The former capability placeholders are now backed by a disabled-by-default,
server-only Stirling adapter:

- exact current upstream endpoints for flatten, repair, compression, OCR,
  PDF/A, automatic redaction, and text-editor conversion
- API key remains in the edge environment
- explicit enablement and license acknowledgement gates
- authenticated RLS download of inputs instead of unrestricted service-role
  reads
- user-scoped temporary uploads and immutable processed outputs
- one-hour signed result URLs
- compact designer controls with apply/download review step
- permanent redaction is visibly marked as rasterizing
- advanced text conversion remains behind a separate alpha gate

Full configuration, safeguards, validation, and rollback instructions are in
`docs/STIRLING_PDF_INTEGRATION.md`.
