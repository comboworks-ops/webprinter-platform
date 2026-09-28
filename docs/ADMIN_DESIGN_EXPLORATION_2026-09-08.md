# Admin design exploration — 8 September 2026

Status: Thomas selected initial option 3 (Open Workspace). The follow-up review contains **171 proposals for 57 screens and substantial editor views, three per screen**. Visual exploration only; no application implementation or data changes.

All **57 screen choices are now selected and verified**, following Thomas's confirmation that the final choices were made. The complete export is preserved unchanged in `docs/ADMIN_DESIGN_SELECTIONS_2026-09-08.json`, copied from `~/Downloads/webprinter-admin-designvalg (8).json`. Every chosen image ID, displayed option number and image path matches the review gallery; no screens are missing. Image paths in the export resolve relative to `tmp/admin-design-review-20260908/`. Treat this file as the selected visual direction for subsequent implementation, while retaining the source reconciliation and workflow safeguards below. Selection capture itself makes no application changes.

## Confirmed visual foundation

The current standard is **Precise Print Grid** (`print-precise`). Verified in `src/lib/branding/printDesignPresets.ts` and `docs/LANDING_PAGE_DESIGN_QA_2026-09-08.md`: Inter, white surfaces, navy `#0B1933`, blue `#087FC5`, fine separators and restrained rounding. The storefront reference inspected for the initial trio was `tmp/landing-qa-20260908/storefront-capture.png`. The selected Open Workspace image below was attached as the common reference for the follow-up screen proposals.

The existing ordering choices are recorded in `src/lib/branding/orderFlowDesigns.ts`. This exploration follows that visual-selection process for admin.

## Area map from existing routes and navigation

| Area | Existing surfaces mapped for visual review |
| --- | --- |
| Overview | Dashboard; Driftsklarhed |
| Product management | All products; existing manual product creation; individual product settings, options, images and prices |
| Calculations | Pricing modules; machine calculations; existing Matrix and wide-format configuration surfaces |
| Orders and customers | Order list and detail; customer files and review; messages; Company Hub |
| Shop presentation | Shop modules; branding; Site Design V2; Sites; product images/Icon Studio |
| Designer and resources | Print Designer entry; design library; tenant and master templates; designer format templates; colour profiles; assets |
| Marketing | SEO Manager; AI SEO; platform SEO and existing Search Console connection surfaces |
| Account | Domain; subscription; shop settings; payment settings; tenant updates |
| Platform administration | Tenant overview; master resources; master design; master templates; system updates |
| Suppliers and production | Supplier Bank; Printproduktion; existing POD v1 and v2 catalog, configuration, orders and billing; POD3 route |

This is a coverage inventory, not an instruction to expose every route to every user. Existing role, tenant and module visibility must be preserved.

## Three initial concepts

- **Precise Operations**: labelled sidebar, compact summaries and a broad order worklist.
- **Focused Order Desk**: labelled sidebar and a selected-order detail pane beside the attention queue.
- **Open Workspace**: horizontal navigation, one prominent daily task and an airy order overview.

All three are independent desktop visual proposals within the same standard. Mock figures, customer names and statuses are illustrative. They do not establish live operational readiness or introduce approved workflow changes.

Confirmed displayed order and original image files:

1. Precise Operations: `/Users/thomasprintmaker/.codex/generated_images/01a07f7a-b5b2-7283-8d70-a1b1578d4b0c/exec-d70b221f-953d-4a9c-b57c-04157fb0d5fd.png`
2. Focused Order Desk: `/Users/thomasprintmaker/.codex/generated_images/01a07f7a-b5b2-7283-8d70-a1b1578d4b0c/exec-b36de706-c3e6-4344-b1ed-641402c80e55.png`
3. Open Workspace: `/Users/thomasprintmaker/.codex/generated_images/01a07f7a-b5b2-7283-8d70-a1b1578d4b0c/exec-4aecf84c-823f-4bb7-8690-1ad59d7f3644.png`

Displayed image order in the conversation determines option numbering. Thomas selected option 3, Open Workspace, and requested three designs for every underlying area. Preserve its top navigation and simple appearance across all subsequent screen proposals. Images remain brainstorming references rather than shipped application assets.

## Completed review and continuation

The review gallery is `tmp/admin-design-review-20260908/index.html`, served locally at `http://127.0.0.1:8136`. `gallery-data.json` records all 57 sets and stable IDs for their 171 images. The gallery supports per-screen favourites, full-size viewing and JSON download of choices. All sets and assets passed the completeness check. Screen navigation, image viewing and favourite persistence were verified in the in-app browser.

The 57 sets cover the existing route inventory plus major product, order, calculation and POD editor views. Redirects and connection callbacks are excluded; this is not coverage of every modal, nested tab state or responsive breakpoint. The initial dashboard options above remain separate, with number 3 selected.

Generated images determine visual direction. Exact controls, product art, supplier names, status labels, example financial values and explanatory copy need reconciliation with source before implementation. Some proposals include invented details; selecting a layout does not authorize new integrations, payment handling or business rules.

Keep the selected common admin direction and work through individual screen choices, starting with products and order detail. Implementation must preserve manual creation, pricing calculations, existing publishing actions, tenant scoping and POD safeguards. Navigation restructuring and new order actions shown by a concept remain proposals until explicitly selected and scoped. No production, database or supplier actions are part of this design exploration.
