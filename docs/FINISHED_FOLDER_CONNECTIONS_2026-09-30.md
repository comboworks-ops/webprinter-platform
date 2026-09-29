# Salgsmapper finished-folder connections — 30 September 2026

Thomas explicitly selected **both 1 mm and 5 mm**, like the standard folder, for the remaining laminated, UV-varnish and Spot-UV products. The connections are saved in the Salgsmapper tenant backend and verified on the live product pages. The shared Webprinter application supplies the template, Designer, 3D and checkout behavior.

| Product | Exact configuration links | Unique PDFs | Online Designer |
| --- | ---: | ---: | --- |
| Salgsmapper med laminering | 100 | 60 | Available |
| Salgsmapper med UV-Lak | 40 | 20 | Available |
| Salgsmapper med UV spotlak | 40 | 20 | Professional PDF required |

A4, A5, A6, **M65** and 21 × 21 cm each offer both spines and 4+0/4+4 where their existing price rows permit. Existing paper and finish restrictions remain; Softfeel has prices for silk paper only. M65 replaces the old DIN lang labels without replacing attribute IDs.

## Data change and safeguards

Only tenant `7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba` and these three products are changed:

- Laminated: `62b759c7-7083-45bb-bd11-e0fb3fd493eb`
- Spot-UV: `8e89d418-74f3-4bfb-9f17-13da2ed74946`
- UV varnish: `27bbf599-2e21-43cc-9808-995b90c6a205`

The existing free-selection contract supplies a Mapperyg group with two values per product. Spine is excluded from the pricing variant key, as on the standard folder, and is retained in template constraints and the checkout selection. No price rows, formulas, material IDs, finish IDs, technical specs or branding are changed. The standard product is unchanged. The before/after readback confirms all **1,786 price rows are byte-for-byte identical**.

The guarded transaction checks each complete product, all current attributes and each price fingerprint before updating. It adds three groups, six values, 180 exact template links and three M65 label renames. An initial variable-name conflict rolled back; the corrected transaction succeeded. No schema, auth, RLS or edge change was needed.

Spot-UV remains `professional_pdf_upload_only`: its production varnish mask must be supplied separately in a professionally prepared PDF. The 3D preview shows placement and construction; it does not simulate varnish or foil reflectivity.

## Shared checkout correction

The integration check exposed an existing format-label bug: UUID `dc2464ba-3614-4a13-91f7-dd8c5fc9fbd4` was normalized as A1. `normalizeCheckoutFormatKey` rejects IDs as labels, and `checkoutTemplateFormatLabel` resolves the real format from both the selected value and exact PDF fingerprint. Conflicting metadata fails closed. Existing checkout drafts can recover the format from `pricingQuote.formatId`. Dimensions, pricing, uploads and payment behavior are preserved.

## Verification

- 180 exact selection-resolution checks and 1,000 missing/unknown-selection rejection checks passed.
- All 100 hosted PDFs downloaded successfully and matched their SHA-256 identities.
- Local storefront: 30 laminated-folder states; all five formats, both spines and both print modes covered. Ten 3D canvas states and finish/paper fallback checks passed.
- Live storefront: 30 states across all three products; all formats and both spines resolve the expected PDF and render the matching 3D model. Spot-UV gating remains intact.
- Designer received the 21 × 21 cm, 5 mm, 4+4 Softfeel configuration, rendered new text in the matching 3D preview, and exported a real two-page production PDF at 504 × 284 mm including bleed.
- Designer return, checkout entry and editing back to the product preserved the 5 mm/4+4/Softfeel/silk selection and price. The corrected checkout format label was verified locally.
- 38 template/model/checkout regression tests passed. TypeScript: zero errors. Frontend health: zero new lint regressions against the existing baseline. Production build passed.

Private file upload still uses the shared inline login and private-file service. The live upload button opened the expected login dialog. Authenticated storage persistence and a paid order were not exercised in this run; no customer identity, payment or order was submitted.

## Reproduction and rollback

`scripts/build-finished-folder-connections.mjs` is a read-only plan builder. It accepts a before snapshot, the previously verified 1 mm/5 mm candidate plans and an output directory. It generates a plan plus guarded apply/rollback SQL; it never connects to Supabase itself.

Evidence and backups are local under `output/finished-folder-connections-2026-09-30/`: `live-before.json`, `live-after.json`, `plan.json`, `apply.sql`, `rollback.sql`, `hosted-pdfs.json`, `candidate-browser.json`, `live-browser.json`, Designer export and screenshots. They are excluded from deployment.

The rollback restores only the three products' prior pricing structures/templates and format labels, and disables the six new values and three groups. It aborts if newer product edits exist. Prices are never written. Revert the checkout-label commit separately if needed. Preserve the original dirty checkout and open user drafts.

## Release status

Backend connections are live. The shared checkout-label fix is ready for the GitHub/Vercel release; production readiness must be checked before claiming that correction is live.
