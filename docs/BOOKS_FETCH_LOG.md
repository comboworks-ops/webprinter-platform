# Books Fetch Log

Last updated: 2026-03-02

## Scope

This log captures the current import and preview rules for book-like products imported from WIRmachenDRUCK into the existing matrix product system.

Relevant products so far:
- `Bøger` (`boeger`)
- `Bøger med 4 farvet tryk` (`boeger-med-4-farvet-tryk`)
- `softbooks`

This is a fetch/import note only. It does not change pricing core behavior.

## Current Working Pattern

### Shared structure
- Keep the product as a standard matrix product.
- Use:
  - `Format`
  - spine/binding selector if needed
  - `Pages`
  - `Finish`
  - material on the vertical axis
- Dense page counts should be a `dropdown`, not buttons.

### Critical dependency rule
- Page count must be treated as the last dependent selector in preview logic.
- Formats, products/spine, materials, and finishes must resolve first.
- The visible page values in preview must be filtered from real published price rows.

Why:
- Some supplier families do not expose the full page range for every spine/binding.
- If preview shows all whitelisted page counts regardless of the chosen spine, the admin preview looks broken even when the import is correct.

## Bøger-specific Notes

Product:
- Name: `Bøger`
- Slug: `boeger`

Source families:
- `Klassisk ryg`
- `Rund ryg`

### Supplier constraint
- `Klassisk ryg` starts at `48 pages`
- `Rund ryg` starts at `80 pages`

This means:
- `48 / 56 / 64 / 72 pages` are valid for `Klassisk ryg`
- the same page counts are intentionally invalid for `Rund ryg`

### Required preview behavior
- If the user switches from `Klassisk ryg` to `Rund ryg` while `48 pages` is selected:
  - preview must auto-correct to `80 pages`
  - not remain on a dead combination

### Files that now enforce this
- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`

Key behavior now in place:
- stable ordered pagination of published price rows
- filtering preview selector options from actual valid published combinations
- page-like selectors sorted numerically
- invalid lower-level selections auto-corrected to the first valid option

## Softbooks Pattern

For `softbooks`, the same rule applies:
- treat dense page counts as dropdown data
- do not assume every format/orientation/finish branch has the full page ladder
- if a branch starts later or skips counts, let published rows define the valid set

## Bøger med 4 Farvet Tryk Pattern

Product:
- Name: `Bøger med 4 farvet tryk`
- Slug: `boeger-med-4-farvet-tryk`

Source families:
- `Klassisk ryg`
- `Rund ryg`

Formats imported:
- `A4`
- `A4 vandret` (`Klassisk ryg` only)
- `A5`
- `A5 vandret`
- `21 x 21`
- `13.5 x 21.5`
- `17 x 24`

Supplier material rule:
- `Klassisk ryg` exposes:
  - `Inhalt: 115 g/m² Bilderdruck matt`
  - `Inhalt: 90 g/m² Werkdruckpapier 1,3-faches Volumen`
- `Rund ryg` exposes only:
  - `Inhalt: 115 g/m² Bilderdruck matt`

This means:
- material must **not** be modeled as a shared vertical comparison row
- material must be a dependent selector row
- otherwise rounded-spine combinations will generate dead rows or fake prices

Working product shape:
- `Format`
- `Ryg`
- `Pages`
- `Materiale`
- vertical axis reduced to a single price row

Page rule:
- imported `48 -> 400` in steps of `4`
- `Rund ryg` starts at `80`
- `Pages` should stay a `dropdown`

Implementation note:
- the standalone importer is `scripts/fetch-boeger-4farvet-import.js`
- to keep runtime practical, format extraction was parallelized

## Next Similar Product Checklist

For the next similar product:
1. Keep the import standalone or additive to the target product only.
2. Import each spine/binding family as its own selector branch if supplier prices differ.
3. Do not reuse one spine's prices for another unless verified on the supplier.
4. If page counts are dense, default to `dropdown`.
5. Expect branch-specific minimum page counts.
6. Verify both:
   - storefront product page
   - admin `Prisliste forhåndsvisning`
7. If preview looks broken, check selector dependency/filtering before changing import data.

## Validation Snapshot

Validated locally after the latest fix:
- `A5 + Klassisk ryg + 48 pages + Matt foil` shows prices
- `12.5 x 19 + Klassisk ryg + 48 pages + Matt foil` shows prices
- `Rund ryg` is visible in admin preview
- switching to `Rund ryg` auto-selects `80 pages`
