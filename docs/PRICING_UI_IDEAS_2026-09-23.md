# Priser UI concepts — 23 September 2026

Status: three image concepts shown; no layout selected or implemented. The user's
separate request to remove the three decorative pricing-method images is complete
locally. Pricing formulas, save handlers, supplier integrations and tenant scope
are unchanged. No deployment or database mutation.

## Display order and selection mapping

1. `output/pricing-ui-ideas-2026-09-23/01-prisbord.png` — table-first with inspector.
2. `output/pricing-ui-ideas-2026-09-23/02-priskurve.png` — quantity curve and anchors.
3. `output/pricing-ui-ideas-2026-09-23/03-kombinationsvaerksted.png` — combination rail.

These numbers match actual image-result display order in the conversation. All
three used the real connected Priser screenshot as visual reference. Values and
material lists in images are illustrative, not product data or saved changes.

## Required behavior for the selected design

- Existing prices take priority when present; generator is opened on demand.
- Empty product starts with compact method selection and create/import choices.
- Preserve format, wide-format and machine engines, quantity sets, combination
  matching, interpolation, anchor and row adjustments, markup and rounding.
- Keep manual editing and generator connected to existing state and calculations.
- Consolidate CSV import/export and saved price lists into compact tools.
- Make saving prices explicit and explain that product visibility is controlled
  separately. Do not invent autosave or a new publish stage.
- Plot quantities against a clearly labelled total or unit price, with correct
  numerical axis spacing. A quantity curve is not historical price data.
- Preserve master-only supplier costs. Tenant cost means the tenant's purchase
  price from WebPrinter, not the upstream supplier's price.
- A verified cost needs exact product/variant/quantity/currency/source/date
  matching and explicit freight/tax scope. Missing cost stays unknown, never zero.
- Show a source and timestamp when cost is known. A scraped/imported selling
  price is not automatically a cost. Machine draft estimates may exclude inputs.
- True change history requires immutable before/after evidence and actors. Saved
  price-list versions and supplier snapshots are useful but not a complete audit.

## Visual-generation caveats to correct during implementation

The images communicate layout, not an implementation specification. Image 1
incorrectly includes the tenant WebPrinter-cost heading in a master view and
invented example cost figures: replace with master supplier-cost terminology and
verified values only. Image 2 omits the required save control; retain an explicit
Gem prisændringer action in the implementation. Image 3 broadens the material
list illustratively; use the product's actual combinations. All variants must
retain product navigation, existing markup controls and exact engine behavior.

## Evidence and icon removal

Browser source identified the three images as local public files:
`Webprinter_Offset.png`, `Web Printer_storformat.png`, and
`Web Printer_maskineberegner.png`. A read-only live products query returned zero
rows with `banner_config.config_section_thumbs`. There were no saved thumbnail
references to delete from the database. No storage purge or SQL write was needed.

Removed the three local public assets and their hardcoded fallback references;
the method choices now use small existing Lucide icons. Custom-thumbnail support
is preserved without adding or changing any configuration. Before copies and a
scoped patch are in the output directory. The same change is synchronized into
the actual port 8113 app under `/private/tmp/featured-product-review-2026-09-22/app`.
The connected Priser page still shows 385 rows and no application console errors.
Browser inspection confirms zero method images and 70 px-high method choices.
Production-mode Vite frontend build passed in the running source copy; existing
bundle-size warnings remain. Build log is included in the output directory.

Read-only schema inspection found POD v1/v2 `base_costs`, fulfillment `tenant_cost`,
`supplier_bank_price_snapshots` with raw/normalized rows, and `price_list_templates`
/ `storformat_price_list_templates`. This proves those sources exist, not complete
per-product cost lineage or a current tenant cost API. No cost/history connection
was implemented. Scope that work separately after visual selection.

Rollback: restore only the three backed-up image files and this task's small
ProductPriceManager diff. Preserve prior preview-toggle/image-picker fixes and
all unrelated worktree changes.
