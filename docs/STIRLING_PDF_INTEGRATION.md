# Stirling-PDF Integration

Last updated: 2026-07-11

## Status

Webprinter now has an additive Stirling-PDF integration through the existing
`designer-pdf-service` boundary. The integration is disabled by default. It
does not replace Fabric, the vector PDF background exporter, CutContour logic,
or Webprinter preflight.

Implemented operations:

- inspect and metadata preflight in Webprinter
- form-only flattening
- PDF repair
- conservative colour-preserving compression
- Danish/English OCR
- PDF/A-2b conversion
- permanent text redaction with an explicit rasterization warning
- gated PDF-to-text-editor JSON and JSON-to-PDF contracts

Every processor result is written as a new immutable object. The original PDF
is never overwritten automatically.

## Customer Designer Scope

The customer-facing designer intentionally exposes only the print workflow:

- import a PDF and choose a page
- preserve the imported PDF as the vector base
- center, scale, rotate, or crop the selected PDF page
- add text, images, and shapes as editable designer overlays
- run Webprinter preflight and export a new PDF

Repair, compression, OCR, PDF/A, redaction, form flattening, and service scans
are not shown in the customer designer. They remain dormant behind the
`designer-pdf-service` boundary for a possible future admin-only utility.

CutContour is also hidden by default. It is shown only when the product has
`technical_specs.requires_cut_contour = true`. Webprinter's vector exporter
then writes the contour as the named `CutContour` spot separation using
100 percent magenta with overprint. A visually magenta canvas line alone is
not treated as a production-ready contour.

## Runtime Architecture

```text
Designer
  -> temporary authenticated upload in order-files
  -> designer-pdf-service (JWT, RLS read, limits, allowlist)
  -> private Stirling-PDF service (X-API-Key)
  -> immutable user-scoped output in order-files
  -> one-hour signed URL
  -> user chooses Download or Use in design
```

The temporary input path is
`designer-pdf-service-input/<auth-user-id>/...`. The output path is
`designer-pdf-service-output/<auth-user-id>/<date>/...`. Temporary inputs are
removed by both the edge function and the browser cleanup path.

## Required Secrets

Configure these only in the Supabase Edge Function environment:

```bash
supabase secrets set STIRLING_PDF_ENABLED=true
supabase secrets set STIRLING_PDF_BASE_URL=http://stirling-pdf:8080
supabase secrets set STIRLING_PDF_API_KEY=<private-api-key>
supabase secrets set STIRLING_PDF_LICENSE_ACKNOWLEDGED=true
supabase secrets set STIRLING_PDF_TIMEOUT_MS=90000
```

Advanced text editing remains off unless its separate gate is enabled:

```bash
supabase secrets set STIRLING_TEXT_EDITOR_ENABLED=true
```

Do not expose the Stirling URL or API key as a Vite variable. The processor
must be private and reachable from the edge runtime. Deploying Stirling itself
to Vercel or into a browser bundle is unsupported.

## License Gate

The provider refuses processing unless
`STIRLING_PDF_LICENSE_ACKNOWLEDGED=true`. This is an operational safeguard, not
legal advice. Confirm the current Stirling licensing terms for client-facing
commercial use before enabling production processing. Do not copy code from
Stirling's `engine/` or proprietary editor directories into Webprinter.

## Print Safeguards

- Form flattening uses `flattenOnlyForms=true` and does not rasterize pages.
- Compression defaults to level 2, keeps colour, and enables normalization and
  linearization. The result must still be visually checked.
- OCR defaults to `dan` and `eng`, skips pages that already contain text, and
  uses a searchable sandwich layer.
- Redaction always finalizes to images so removed text cannot be extracted. It
  is marked as non-vector output in the UI.
- PDF/A is for archiving. It is not PDF/X and does not replace print preflight.
- Existing vector export remains the production path for a PDF background with
  designer overlays.

## Validation

Run:

```bash
deno test supabase/functions/designer-pdf-service/stirlingProvider_test.ts
deno check supabase/functions/designer-pdf-service/index.ts
npm run build
```

The provider tests use a mocked HTTP response and do not require Docker. A live
smoke test requires a private configured Stirling instance and an authenticated
Supabase session.

## Deployment And Rollback

Deploy the edge facade after the secrets and private processor are ready:

```bash
supabase functions deploy designer-pdf-service
```

Rollback is configuration-only:

```bash
supabase secrets set STIRLING_PDF_ENABLED=false
supabase secrets set STIRLING_TEXT_EDITOR_ENABLED=false
```

With the provider disabled, browser inspection and all existing designer/export
features continue to work. Existing immutable outputs remain available under
the normal storage retention policy.
