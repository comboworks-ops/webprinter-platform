# Connected storefront styles — 27 September 2026

Thomas clarified that the four added homepage designs must continue through the customer catalogue, product ordering page and checkout. Implemented in the local working source for Everyday Gifts (`print-atelier`), Format / Signage (`print-signal`), Merch Studio (`print-form`) and Print Partner (`print-partner`). The original five themes and the restored Printstudio presentation retain their existing styles.

## Changes

- The shared storefront frame derives presentation tokens from the selected theme and the tenant's current colours and heading/body/pricing fonts. Existing order-flow layout choices stay independent.
- Catalogue cards and category navigation carry each theme's shapes and hierarchy: rounded Gifts, numbered Signage, editorial Merch, and the compact Partner directory. The same published catalogue, search, category resolution, prices and product destinations remain in use.
- Ordering and checkout keep their existing components and handlers. Theme surfaces, spacing, headings and summary panels continue from the homepage. Existing shared-button styling and explicit option styles remain in control.
- Payment and proof dialogs receive the same branding through React context, including when portalled outside the storefront DOM. Full-screen dialogs cover the sticky header and do not animate their viewport width. Escape/focus handling remains Radix's existing implementation.
- Site Design's payment, proof and confirmation previews receive the same frame for these four themes. No theme is selected or saved for any tenant by these source changes.

## Verification

Follow-up correction: the checks below missed internal width/height field collisions in the banner size card because they measured page and heading overflow. The user found the defect in the ordering screenshot. It is fixed and covered by field-bound/intersection checks in `docs/BANNER_DIMENSIONS_LAYOUT_FIX_2026-09-27.md`; the comparison uses refreshed screenshots.

- 72 settled browser cases: four themes × catalogue, actual product ordering, actual checkout × 1440, 1280, 1024, 768, 390 and 320 px. No measured page overflow or target heading/step clipping. Desktop and mobile screenshots saved for every route.
- 24 further cases use long, unbroken product names at 320/768 px across all three pages and four themes. No measured page overflow or target heading/step clipping.
- Real local component navigation from a product card to its ordering controls and then checkout retains the selected theme. Partner search returns its empty state; selecting Tryksager shows its two fixture products and preserves tenant context.
- 16 additional cases cover the alternative checkout layout at 1280/320 and payment/proof portals at 320 for all four themes.
- A custom-brand fixture confirms Lora headings, Manrope body text, a purple primary and dark branded dialog header. Payment portal width equals viewport width at 1280, 390 and 320; it stacks above the shop header and closes with Escape.
- 19 focused tests pass for theme opt-in, immutable branding attributes, existing order layout choices, catalogue routes and shared-button behaviour. Full app TypeScript and focused changed-component lint pass. Production build passes with the existing large-bundle warning.

## Evidence and boundaries

Evidence, exact before/candidate snapshots, source hashes and the scoped patch are in `output/print-journey-2026-09-27/`. The isolated preview runs at `http://127.0.0.1:8143/journey-review/index.html`, from `/private/tmp/print-journey-review-20260927/app`. It uses the real application components with synthetic products/prices and blocks external connections and state-changing requests. It contains no real payment credentials. The checkout screenshots show the real checkout component; the review link's checkout is the existing inert Site Design preview.

No hosted branding save, publishing, deployment, product/pricing update, file upload, payment or production submission was performed. These checks establish presentation and local navigation, not hosted order/payment acceptance. Existing user tabs/drafts were not reloaded.

Rollback is limited to the ten files in the manifest: restore a before snapshot only if its current hash still equals the recorded candidate; remove a newly added file only under the same check. Preserve every unrelated working-tree change. No database rollback is needed.
