# Local brochure delivery address — 23 October 2026

Added contact and delivery address fields to the existing local brochure checkout, with field-level errors and review gating. Existing design PDFs/approvals, matrix selection, delivery costs and VAT logic are unchanged.

## Local acceptance

Chrome Yebbo profile, existing server `http://127.0.0.1:8933`, route:
`/checkout/konfigurer?tenantId=00000000-0000-0000-0000-000000000000&workspaceCheckout=6ad39630-d159-488f-9c9f-4b2831f105e4`

The final tab contains a synthetic Nord Atelier test contact/address and a successful local review. It is not a real order. Name, email, recipient, company, street, address line 2, postcode and city stay in React memory only. Reload clears these fields and the final confirmation. Existing coarse country and delivery-method preferences still persist locally, as before. Contact/address data is never written to the workspace/checkout IndexedDB, browser preference store, URL, customer profile, API or hosted database by this adapter.

## Validation and behavior

- Shared the existing frontend required-field check through `missingCheckoutContactFields` in addressIntegrity.ts. Normal checkout calls the same check; required fields and normal checkout behavior are unchanged.
- Required: customer name, email, recipient name, street, postcode, city and country. Optional: company and address line 2.
- Field feedback mirrors the existing server email expression, relevant text length/control-character limits, plus existing country normalization. Recipient/company fields use a 250-character client bound. The existing VAT policy separately rejects unsupported destinations and unconfirmed shop context.
- Errors appear on blur, or for all invalid fields after **Gå til kontakt og adresse**. That action opens the contact section and focuses its first invalid input. Inputs expose required/invalid/error-description attributes.
- A valid address appears in the review summary with optional company/line 2. Address edits clear previous confirmation and completion. Inputs are disabled during PDF hash/revision checks. Final review remains blocked for invalid/missing details, unsupported destination, stale designs or incomplete file approval.
- This preserves existing structural validation: no new postcode/city database, street lookup, deliverability service or carrier validation is claimed. A nonempty postcode is checked against the existing checkout text contract; no new postal-format policy was introduced.

## Verified

49 focused tests pass: shared address integrity, new local fields/whitespace/email/country/bounds/control characters, compatibility with the existing pure server order validator, plus existing checkout/file/workspace/delivery/VAT tests. Final targeted address tests also pass after the lint annotation for the intentional control-character expression. App typecheck and scoped final lint pass. Production build passes; compiled assets exclude the local address UI and retain the workspaceCheckout blocking guard outside development.

Browser flow verifies missing fields, first-error focus, invalid email rejection, valid complete address including company/line 2, review completion, address-edit confirmation reset, DE rejection, DK restoration and personal-data clearing on full reload. Both eight-page design PDFs retain their approval/version 1 and 60/40 allocation. Product remains 944 DKK; standard delivery 49 DKK, VAT 248.25 DKK, total 1,241.25 DKK. No new pricing or VAT calculation was added. Final console has no errors.

Address form/document have no horizontal overflow at widths 320, 390, 768, 1024, 1280 and 1440. Temporary viewport was reset. Existing branding/layout preset/header are retained; physical devices were not tested.

Evidence: `output/brochure-address-local-2026-10-23/` includes before-copies, scoped integration diff, unit/build/type/lint logs, layout metrics, browser states and screenshots with fictional test data. Existing dirty repository work, original test PDFs/workspaces and previous acceptance artifacts are preserved.

## Boundaries and rollback

Payment, order insertion, hosted file upload, address-book writes, freight booking, supplier production and deployment remain disabled/unperformed. No migrations, credentials, tax policy, pricing formulas, matrix or POD changes. Only existing read-only product/shop reads continue. No real customer address or identity was used for verification.

Rollback is source-only: restore the local adapter and normal checkout callsite from the pre-task copies; remove the appended addressIntegrity helper and new localCheckoutAddress modules once imports are removed. Keep all original data and browser drafts. No backend or schema rollback is required.
