# PVCbanner checkout and Salgsmapper selection — 21 October 2026

Status: **deployed to PVCbanner and Salgsmapper and verified live on 21 October 2026**. See [scoped release and live verification](CHECKOUT_SELECTION_RELEASE_2026-10-21.md). The sections below retain the earlier local investigation and checks. No pricing formulas, matrix price data, tax rates, payment configuration, database schema or supplier behavior changed. Existing worktree changes and original files were preserved.

## PVCbanner: confirmed deployment mismatch

The public site served `/assets/index-BXQtAelX.js` during this investigation. Its compiled `DANISH_LAUNCH_SHOPS` list contained the original three shops and omitted PVCbanner (`cd3c7d7b-2220-46b8-93cf-096de23e93d8`). The frontend therefore raised `checkout_tax_policy_unavailable` before payment. This was not an arithmetic or price-matrix error.

The working source already included PVCbanner before this task. Read-only inspection of the active `stripe-create-payment-intent` version 25 confirms that the deployed payment handler also includes it. No backend or tax-source modification was needed. A frontend release incorporating the existing correct policy is required to repair the live warning.

Added a regression test for the assessed basket: product 399 DKK + delivery 49 DKK = net 448 DKK; VAT 112 DKK; payable total 560 DKK. Unknown shops, unsupported countries and invalid totals still fail closed. The built local checkout visibly displays 560.00 DKK and 112.00 DKK VAT, without the warning. Customer details and approved artwork remain required; no payment was started.

Added `scripts/check-storefront-tax-bundle.mjs`. It checks the compiled tax chunk or assets directory, not just the source. The current public bundle fails; the new local assets pass. Run this against each scoped release candidate and the actually served tax chunk after activation. A passing static check is not payment acceptance.

## Salgsmapper: preserve the actual advertised configuration

Fresh public browser reproduction confirmed the homepage CTA was only `/produkt/standard-sales-mapper-kopi-2`. It carried no selection and opened the default 50-piece Chromo configuration at 573 DKK.

The homepage now carries its actual variant IDs, material ID and quantity in the link. The product page validates those IDs against the current product layout and initializes the existing matrix. Explicit homepage choices take precedence over an older saved checkout selection. The handoff carries no price; the existing destination matrix calculates the total. The matrix initialization resolves material IDs to display labels without resetting the requested quantity. Normal manual matrix selection remains available. Unknown IDs or quantities show a visible request to review the current choices.

Local browser verification with public catalogue reads:

- Homepage 200-piece offer → A6, 350 g matt silk, front print, 739 DKK; survives reload.
- Homepage 500-piece offer → same material/format at 1,346 DKK; manual change to 250 works; unavailable quantity shows a notice; 390-pixel mobile viewport retains and reveals the selected 500-piece matrix cell.
- No browser JavaScript errors in the completed regression checks.
- PVCbanner product → checkout preserves 100 × 100 cm, eyelets, one piece and 560 DKK including VAT.

**Related copy issue remains:** the actual 739 DKK offer uses A6. The stored description says “100 stk A4 salgsmapper”. Neither that published copy nor any offer/pricing data was changed. Preserving the actual selected configuration resolves the handoff, but does not reconcile this independent merchandising mismatch.

## Verification and evidence

- 13 focused tests pass, including handoff validation, existing wide-format navigation, advertised-offer price guards and checkout tax rejection cases.
- Whole-application TypeScript check passes.
- Production build passes; existing bundle-size/Browserslist warnings remain.
- Compiled tax-policy check fails on the captured live bundle and passes on the local build.
- Browser checks are local frontend + public production catalogue reads. No customer details, file uploads, order creation, payment initiation, emails or supplier requests were performed.
- Screenshots, browser text, public-read receipts, build/test logs, before-task copies and a scoped patch are in `output/checkout-selection-fixes-2026-10-21/`.

The source patch is relative to the preserved **pre-task working files**, not Git HEAD; the repository already contained extensive unrelated changes. Do not deploy the full working-tree build wholesale. The local preview build is a verification artifact, not a scoped production release packet.

## Original release plan and rollback

This plan was completed with explicit user authorization; the linked release receipt above records the exact live scope and results.

Prepare the frontend candidate from the verified current production source for each affected deployment. Apply only the selection handoff changes and ensure PVCbanner's already-approved tax-policy entry is present in the compiled frontend. Keep existing shop-specific designs and alias separation. Run the focused tests, TypeScript/build, compiled tax check and product-to-checkout browser checks before requesting release approval.

No schema, Edge Function, pricing-data or payment-policy deployment is required for the confirmed PVCbanner mismatch. Activation of production aliases requires approval. After activation, re-read the served JavaScript and repeat the public journeys; authenticated payment completion and production acceptance remain separate.

Rollback the selection changes using the scoped patch against its matching baseline, preserving customer drafts and current files. Retain the correct PVCbanner tax-policy entry and payment validation. Do not restore the broken three-shop frontend allowlist, change prices or bypass checkout verification.
