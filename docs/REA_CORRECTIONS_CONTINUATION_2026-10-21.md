# REA correction pass resumed — 21 October 2026

## Current checkpoint

The system assessment is the roadmap. The PVCbanner checkout and Salgsmapper selection fixes were deployed earlier and freshly rechecked during this resumed session: 200 pieces / silk / 739 kr survives the homepage handoff and reload, reaching 985 kr including delivery and VAT; PVCbanner reaches 560 kr including VAT without the warning. No order, payment or upload was initiated. Receipt: `output/rea-corrections-2026-10-21/checkout-recheck.json`.

The current checkout contains extensive unrelated work. In particular, the separate local product-choice guidance described in `PRODUCT_CHOICE_GUIDANCE_2026-10-21.md` is preserved and was not redeployed.

## Corrections prepared locally

Two existing pages received text-only changes:

- White-label buttons now say “Opret din shop”, matching their existing signup destination. The footer explains account creation → plan selection → subscription checkout, and links to the existing pricing page for limits/features. The unsupported “Ingen kreditkort nødvendigt” promise is removed. No new claim about live Stripe card collection or configured trial duration is made.
- Signup now promises a product catalogue according to the selected plan, instead of “alle produkter”. No entitlement, catalogue import or signup behavior changed.

The subscription source inspection supports activation at subscription checkout; its trial duration is configurable. Actual hosted subscription settings and billing acceptance were not exercised. The package table and prices remain unchanged.

These corrections are **not deployed**. Local preview: `http://127.0.0.1:8949/white-label` and `/opret-shop`. The preview serves this working checkout, including its existing unrelated work; it is not a release packet.

## Fresh REA findings and next bounded corrections

| Item | Fresh evidence / decision | Next correction |
| --- | --- | --- |
| White-label/trial copy | Conflicting no-card/instant-trial wording reconfirmed; local wording corrected | Review alongside package entitlements before scoped platform release |
| Demo catalogue | 23 visible products; test/draft names and missing imagery still public | Review individual product names, copy, images and publication; preserve all records |
| White-label pictures | Two literal “Image placeholder” blocks remain | Replace with reviewed real branding-editor and product screenshots, without showing private customer data |
| Salgsmapper offer copy | Previous verified offer is A6/200; stored copy says A4/100 | Prepare a narrowly scoped content correction against current product/branding values |
| Product guidance | Separate completed local work exists | Review that existing implementation rather than build it again |
| Package entitlements | Starter 50 products; higher tiers and white-label labels still need reconciliation | Establish actual supported entitlements; do not redefine plans or prices through copy |
| Artwork continuity | Phase 2 still outstanding | Trace one product through upload/designer, original/revision retention and proof approval before multi-design architecture |

The major multiple-design workspace, CompanyHub acceptance, booklet and cut-letter modes remain later roadmap phases. This session does not claim them implemented or validated.

## Evidence and boundaries

Fresh REA captures: white-label, pricing, signup and demo catalogue, plus narrow-screen local captures of both edited pages. All completed captures report no page errors. REA owned and terminated its browser processes; no existing user session or unsaved browser draft was reused.

Whole-application TypeScript and focused ESLint on both edited files pass. Separate real-browser checks at 1440 and 390 pixels confirm that the price link and shop-creation links reach the correct pages, both revised texts render, there is no horizontal document overflow, and no page errors or write requests occur. Screenshots and `local-browser-checks.json` retain the results. Before-copies and a patch relative to those copies are under `output/rea-corrections-2026-10-21/`. No price calculations, tax policy, matrix behavior, published product records, billing settings, database schema or deployment aliases changed in this pass. No registration, order, payment, email or supplier action was submitted.

Recovery: reverse only `copy-only.patch` after checking for later edits. Never restore the entire dirty source files from Git or deploy the full checkout.
