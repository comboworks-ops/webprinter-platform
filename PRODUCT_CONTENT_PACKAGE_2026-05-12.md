# Product Content Package - 2026-05-12

## Purpose

First-pass Danish product copy was added for imported products that still had placeholder text or missing product information. The copy is based on the fetched supplier context from the import scripts, rewritten in Danish in a modern webshop tone: informal enough to be readable, but still professional.

The copy is original and should be treated as a starter package for manual review, refinement and SEO tuning.

## Fields Updated

For each product below, these fields were updated:

- `products.description`
- `products.about_title`
- `products.about_description`
- `products.technical_specs.product_details_da`
- `products.technical_specs.product_details_source`
- `products.technical_specs.product_details_updated_at`

Pricing fields, POD logic and product option configuration were not changed.

## Label Translation Pass

A second pass translated imported product and option labels that were still in German or supplier-English. This covered visible labels only:

- Product display names such as `Visit card` -> `Visitkort`.
- Customer-facing copy references such as `kachering` -> `laminering`.
- Option group names such as `Motive` -> `Antal motiver`, `Pages` -> `Antal sider`, `Cover` -> `Dækblad`, `Sheet size` -> `Arkstørrelse`.
- Material names such as `Bilderdruckpapier`, `Naturpapier weiß`, `Recyclingpapier weiß`, `Kraftkarton braun`, `Mattfolie`, `Glanzfolie` and `Folienkaschiert`.
- POD/import labels such as `No`, `None`, `Do not seal`, `No perforation`, `Rounded corners`, `Pallet delivery`, `Printing method` and similar.
- Master catalog material labels for folders, roll-ups, letterhead, books and election posters, including German terms like `Qualitätsdruck`, `Bilderdruckkarton`, `Hohlkammerplatte`, `Mappen-Füllhöhe`, `Leinenstoff` and `Gewebe`.

The translation pass updates only `products.name`, selected product text fields, `product_attribute_groups.name`, and `product_attribute_values.name`. Attribute IDs, pricing rows and supplier reference metadata remain unchanged.

Final audit after the pass scanned the master catalog plus `salgsmapper.dk` and `onlinetryksager.dk`: 170 products, 484 option groups and 1515 option values. The checked customer-facing fields returned zero remaining hits for the German/supplier terms covered by the script. Accepted technical/product terms such as `DIN lang` and `Softfeel-folie` were left as-is.

## Products Updated

### salgsmapper.dk

- `salgsmapper-med-kachering`
  - Product copy for laminated presentation folders.
  - Covers matte, glossy and softfeel lamination use cases.
- `salgsmapper-med-uv-lak`
  - Product copy for presentation folders with high-gloss UV varnish.
  - Focuses on stronger color expression, presentation use and durability.
- `salgsmapper-med-uv-spotlak`
  - Product copy for spot UV folders.
  - Explains selective highlight effects for logo, patterns and visual details.
- `visit-card`
  - Product copy for 85 x 55 mm visit cards.
  - Covers matte card, premium natural card, recycled card and kraft card.
- `blokke`
  - Product copy for writing pads without cover.
  - Focuses on meetings, office use and practical everyday branding.
- `blokke-2`
  - Product copy for printed writing pads.
  - More general content for office, events, workshops and sales material.

### onlinetryksager.dk

- `blokke`
  - Product copy for printed writing pads.
- `flyer-demand`
  - Product copy for flyers used in campaigns, events and local marketing.
- `standard-plakater`
  - Product copy for posters used in campaigns, retail, events and signage.
- `standard-postcards`
  - Product copy for postcards used for campaigns, invitations, direct mail and gift cards.

## Applied By

Reusable script:

```bash
node scripts/apply-product-content-package.js
```

Label translation script:

```bash
node scripts/apply-product-label-translations.js
```

The script preserves existing `technical_specs` and only merges in the Danish product-details metadata.

## Remaining Work

- Review the text in the admin/product pages and adjust tone per tenant.
- Add product-specific FAQs where the design supports it.
- Expand the same process to any unpublished master catalog imports if they are meant to become public.
- If exact supplier detail scraping is needed later, use `.agent/skills/fetch/SKILL.md` and store the supplier source URL next to each generated content block.
