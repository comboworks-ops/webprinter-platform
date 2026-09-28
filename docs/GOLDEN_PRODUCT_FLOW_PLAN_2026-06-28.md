# Golden Product Flow Plan - 2026-06-28

Purpose: make one storefront product path production-ready before expanding
the rest of the catalog.

Related source inventory:

- `docs/PRODUCT_SOURCE_INVENTORY_2026-06-28.md`

Recommended first product:

- `/produkt/aluminium`

## Current Direction

The platform already has the right core pieces:

- storefront product detail pages
- Matrix Layout V1 pricing
- delivery selection
- checkout session handoff
- upload/proofing step
- full designer with vector PDF handling
- Stripe PaymentIntent hardening
- admin/operator role fallback

Product ownership is mixed. Before changing a product, identify whether it is
manual Matrix V1, Pixart/fetched storformat, WMD/fetched, POD v2/Print.com, or
legacy/static. Do not force all products into the same pricing path.

The next phase should connect and verify these pieces around one complete
customer path instead of adding broad new surfaces.

## Step 1 - Pricing Foundation

- Enter real Matrix Layout V1 prices for the selected product.
- Keep pricing data-driven through the existing admin pricing system.
- Export a CSV backup before major price changes.
- Publish through the existing Matrix V1 flow.
- Verify the frontend price against known rows.

Do not change core pricing calculations unless explicitly approved.

## Step 2 - Product-To-Designer Handoff

Implemented in this slice:

- The product page now saves the current checkout state before opening
  the full designer.
- The "Design klar" state is tied to a checkout-selection signature instead
  of only the product id.
- Changing quantity, format, options, or pricing quote now invalidates stale
  design-ready state.
- Checkout upload/proofing only auto-approves designer work when the current
  checkout signature matches.

## Step 3 - Checkout QA

Run the customer path:

1. Open `/produkt/aluminium`.
2. Select a real format/material/quantity.
3. Confirm the price and delivery summary.
4. Open "Design online", return to product, and confirm "Design klar".
5. Change one price-driving option and confirm "Design klar" resets.
6. Click "Bestil nu".
7. Upload or use designer production file.
8. Confirm payment intent creation only succeeds with a valid quote.

## Step 4 - Admin QA

Run the operator path:

1. Login with `admin@webprinter.dk`.
2. Open admin product/pricing areas.
3. Confirm aluminium pricing can be edited/published.
4. Confirm designer/admin access still works.
5. Confirm no tenant context warning appears.

## Step 5 - Expansion Pattern

After aluminium is clean, repeat the same flow for priority products:

- skilte
- visitkort
- flyers
- salgsmapper
- labels/stickers
- wide format products

Each product should reuse the same product -> designer -> upload -> checkout
contract rather than adding product-specific shortcuts.

## Guardrails

- Preserve POD v1.
- Keep POD v2 additive and separate.
- Keep price edits in the existing pricing system.
- Deploy updated Edge Functions before relying on production behavior.
- Add regression tests around checkout quote tampering and PDF storage access.
