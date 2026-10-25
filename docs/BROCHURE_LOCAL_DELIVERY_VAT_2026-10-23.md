# Brochure local delivery and VAT — 23 October 2026

The existing local brochure checkout now offers the product's checkout delivery methods and shows product, delivery, net total, VAT and total including VAT. The price matrix and catalogue/POD pricing remain unchanged. This continues the local-only adapter documented in BROCHURE_LOCAL_CHECKOUT_2026-10-23.md.

## Try it

Use the existing Chrome Yebbo profile and workspace Vite server at `http://127.0.0.1:8933`.

Final route: `/checkout/konfigurer?tenantId=00000000-0000-0000-0000-000000000000&workspaceCheckout=6ad39630-d159-488f-9c9f-4b2831f105e4`

Expand **Leveringsmetode** to switch standard/express or check the delivery country. The finished tab shows standard delivery and a successful local review. Payment stays disabled. The two approved eight-page designs retain their 60/40 quantities and version 1 PDFs.

## Existing checkout logic reused

- Extracted `normalizeCheckoutDeliveryMethods` and its type from FileUploadConfiguration into `src/lib/delivery/checkoutDelivery.ts`; normal checkout and the local adapter now import the same function. A source comparison confirms the function is identical except for its export and a TypeScript unknown annotation.
- Read delivery methods from the same `product.banner_config.order_delivery.delivery.methods` path, with the same standard defaults when absent.
- Reuse unchanged `resolveDeliveryMethodCost`, `checkoutCountryCode` and `checkoutTaxPreview` / shared `calculateCheckoutTax` policy. The product and extras form the net order subtotal; delivery is added once and integer-øre VAT is added once. The workspace's pre-existing totalPrice is not reused as a product price because it can already contain product-page shipping.
- Preserve the immutable product selection, approvals and PDFs. Only method ID and country are saved under a workspace-specific local preference key; delivery changes do not write back into the price matrix or the approval/file snapshot.
- Review confirmation resets on delivery/country changes, refreshed totals and reload. Missing/mismatched shop or unsupported destination produces no approved tax/gross total and blocks local review.
- Local preferences survive reload and returning through the design workspace to a newly generated checkout handoff. Contact name/e-mail remain memory-only.

## Verified amounts

The actual selected matrix cell remains 100 copies, 148 × 210 mm, eight pages, 90g matte content/cover, product **944.00 DKK excluding VAT** and no paid extras.

| Delivery | Delivery excluding VAT | Net total | VAT | Total including VAT |
| --- | ---: | ---: | ---: | ---: |
| Standard | 49.00 | 993.00 | 248.25 | 1,241.25 |
| Express | 199.00 | 1,143.00 | 285.75 | 1,428.75 |

Browser verification covers both methods, final review, confirmation reset, reload, workspace return with express retained, and DE delivery rejection followed by DK restoration. Both design files, versions and 60/40 allocation remain present. No browser console errors in the final view.

31 focused tests pass, including existing workspace/product/tax checks and new coverage for extras, custom configured delivery, rounding, stale method fallback and unconfirmed/foreign shop/destination rejection. App typecheck and scoped lint pass. The final production build passes; compiled assets exclude the local checkout UI/preference key and retain a blocking branch for copied workspaceCheckout URLs. Existing large-chunk/Browserslist/lcms warnings remain build warnings.

Layout verified at widths 320, 390, 768, 1024, 1280 and 1440: no document or delivery-panel horizontal overflow. Fixed the newly introduced narrow-card clipping by giving fieldsets zero minimum width and putting price below the name on narrow screens. Existing storefront branding, header and checkout preset are unchanged. Temporary viewport override was reset; physical devices were not tested.

Evidence and before-copies: `output/brochure-delivery-vat-local-2026-10-23/`. `integration.patch` isolates changes to existing TSX files from the pre-existing dirty worktree. `verified-production-build` is the final build after the persistence and wrapping fixes; earlier build folders are retained as intermediate evidence.

## Boundaries and rollback

Payment, hosted file upload, order insertion, freight booking, supplier submission and deployment remain disabled/unperformed. Only the existing read-only saved-product endpoint is used. No migrations, hosted configuration changes, pricing edits or POD changes were made. This is local calculation/review acceptance, not carrier, payment or production order acceptance. Delivery dates, address capture/validation and any real shipment remain separate from these locally calculated delivery fees and country policy.

Rollback: restore the pre-task local adapter from before/, and restore the inline delivery function/type in FileUploadConfiguration together with its previous import. Remove the new preview/normalizer modules only after their imports are removed. Keep existing IndexedDB workspaces, files, approval bundles and recovery drafts. No backend rollback is needed.
