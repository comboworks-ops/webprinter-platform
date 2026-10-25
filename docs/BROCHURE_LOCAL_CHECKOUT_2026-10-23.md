# Brochure workspace to local checkout — 23 October 2026

The real saved, unpublished brochure product now opens the existing multiple-design workspace from its native price selection and hands approved PDFs into a guarded branch of the actual `/checkout/konfigurer` route. It reuses the existing storefront theme and checkout layout. This is a local acceptance adapter; the hosted upload/payment/order content never mounts for this handoff.

## Try locally

Keep the existing Vite workspace server on `http://127.0.0.1:8933` and use the Chrome Yebbo profile, where the local files are saved.

- Product: `/brochure-shop-preview?tenantId=00000000-0000-0000-0000-000000000000`
- Workspace: `/design-workspace?workspace=18a5f7e315f4b3ab78b696605c597ed7cbbc32fd0fa623ce8e46bc64b3a3a60e&tenantId=00000000-0000-0000-0000-000000000000`
- Completed checkout: `/checkout/konfigurer?tenantId=00000000-0000-0000-0000-000000000000&workspaceCheckout=78d409fe-89b5-4ba7-9a6a-32fcfda522dd`

Product `1f494aac-e4f2-47a2-96ab-b4b6955382ef`, slug `brochurer-med-traadhaeftning`, remains unpublished. Its real existing product/pricing services are read only. Local PDF files, design approvals, checkout bundles and implementation changes stay local. No hosted data writes, upload, payment, order, supplier submission or deployment was performed.

## Verified customer flow

| Check | Result |
| --- | --- |
| Native selection | 148 × 210 mm, 8 pages, 90g matte content/cover, 100 copies, existing product price **944 DKK excl. VAT** |
| Multiple designs | København / Aarhus synthetic Nord Atelier PDFs, 60 / 40 copies, independently saved and approved version 1 |
| Readiness | Unfinished/unapproved design and 101/100 allocation disable checkout |
| Handoff | Both exact PDFs, names, quantities, revisions and warnings retained; SHA-256 checked against current workspace |
| Reload | Files, product choice and quantities persist; local contact fields and final confirmation intentionally reset |
| Stale checkout | Changing København to 61 blocks the old checkout; restoring 60 permits a valid handoff |
| Product return | Bestilling returns to the same 944 DKK matrix cell; reopening workspace retains both approved designs |
| Export | Both downloaded checkout PDFs have all eight pages in reading order, 154 × 216 mm MediaBox including 3 mm bleed |
| Browser console | No errors in final checkout tab |
| Scope | Payment permanently disabled; local review completion creates no order |

The selected 944 DKK is the existing native free-size quote for this configuration, not the previous simple fixture catalogue's 657 DKK test selection. No price, margin, tax, matrix, delivery or POD calculation was changed. The adapter displays the selected product and extra prices; delivery and VAT are explicitly not calculated in this local rehearsal.

## Implementation and validation

- `workspaceCheckoutModel.ts`: allowlisted exact checkout selection, ready/current revision and allocation validation, product/tenant/template context checks and PDF byte hashes.
- `localWorkspaceCheckout.ts`: separate local IndexedDB bundles; maximum 8 PDFs, 50 MiB each, 200 MiB total; PDF signature, page count and dimensions checked before handoff. No customer details or legacy checkout session is overwritten.
- `LocalWorkspaceCheckout.tsx`: shared checkout layout with per-design PDFs, quantities and warnings, edit return, focus/reload validation and local-only review.
- ProductPrice passes a guarded local preview flag to ProductPricePanel. Normal unpublished ordering remains blocked. Existing valid shop workspaces keep their previous behavior.
- FileUploadConfiguration intercepts `workspaceCheckout` before normal content mounts. Non-development builds, non-loopback hosts and missing references cannot fall through into hosted checkout.

Validation: **23/23** focused workspace/checkout-product tests pass; app TypeScript check and scoped ESLint pass; production build passes. Compiled production assets exclude the local checkout UI and retain a blocking alert for copied local handoff URLs. React component changes were reviewed against the React best-practices skill. Build warnings concern existing chunk size, Browserslist age and lcms module externalization. No production browser or physical-device acceptance is claimed.

Evidence: `output/brochure-checkout-local-2026-10-23/` contains screenshots, final DOM, tests, lint/typecheck/build logs, production guard inspection, downloaded PDFs and their hashes/page checks. `before/` preserves the edited pre-task files; `integration.patch` isolates changes to existing components from the already dirty repository.

## Remaining production gate and rollback

Do not enable live ordering from browser-stored approvals or the local aggregate-quantity split. A future authorized integration needs server-owned immutable design revisions/files, tenant/customer authorization, server-verified price authority, explicit product/supplier permission and pricing for multiple motifs, shipping/VAT, order metadata and payment/submission acceptance. Source PDFs without output intent still require printer colour review; the warning remains visible.

Rollback is source-only: remove the guarded local checkout branch and preview flag changes, remove the new adapter modules and workspace checkout action, or apply the scoped inverse patch after reviewing subsequent edits. Preserve all old workspaces and local IndexedDB stores. There are no schema, edge function, pricing or hosted data changes to reverse.
