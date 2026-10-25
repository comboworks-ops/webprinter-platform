# Multiple-design workspace — local pilot, 21 October 2026

Brochure follow-up: the two-document eight-page save/edit/reopen flow is now locally verified. See [Brochure QA](BROCHURE_WORKSPACE_QA_2026-10-21.md). The earlier brochure limitation below describes the original pilot before this follow-up.

## Open and test

- Product entry: http://127.0.0.1:8933/produkt/salgsmapper-med-kachering?tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba
- Saved workspaces: http://127.0.0.1:8933/design-workspace?tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba
- Select an existing matrix price, then **Flere designs · lokal test**. Each card opens the existing Designer with the exact product/template context. Save and return, inspect the real PDF, then approve that version.
- Add/rename designs, set quantities, or split the selected quantity equally. A mismatch is shown without recalculating any price. Return to the existing matrix to select another quantity/price.

## Implementation and boundaries

New local workspace model, IndexedDB adapter, context validator, page and scoped styles live in src/lib/designer/{designWorkspaceModel,localDesignWorkspace,workspaceContext}.ts, src/pages/DesignWorkspace.tsx and src/styles/designWorkspace.css.

Additive integration points: App route, ProductPrice selection return, ProductPricePanel launch, Designer and BrochureDesigner local save/restore branches. Existing normal designer launch was deduplicated; its behavior is retained. Product owner tenant is passed explicitly from ProductPrice. Existing price calculations, matrix, POD flows, export/color/preflight rules, backend schemas and publishing behavior are unchanged.

Enabled only for a development build on loopback. Drafts, thumbnails and generated PDFs are stored in this browser's IndexedDB for this exact origin (port 8933). Different browsers/ports do not share these drafts. No hosted artwork save, payment, order creation, production submission or deployment was performed. Public existing product/template reads still use the configured backend; localhost is not an isolated backend.

Readiness requires artwork, a generated PDF, no blocking designer errors and customer approval of the current revision. Warnings remain visible in proof review. Changing artwork clears only that design's approval; unchanged saves retain approval. Atomic updates plus revision checks reject stale saves/approvals. Product/template changes open a separate workspace; matrix quantity changes retain designs. Company-controlled templates and apparel are excluded from this first pilot.

Live integration still needs product-specific permission to split one matrix quantity across several motifs, hosted storage/access rules and order/fulfillment connections. The pilot makes no commercial promise that every product supports that split.

## Verification

- 15 focused model/checkout tests pass, covering allocation, unchanged matrix prices, revision isolation, stale edits/approvals, missing PDFs/errors, selection identity and tenant/template context.
- Whole-app TypeScript passes. New modules lint clean. Existing integration lint counts match the before copies exactly (App 1 error; ProductPricePanel 72 errors/2 warnings; Designer 96 errors/5 warnings; ProductPrice 41 errors/5 warnings; BrochureDesigner clean).
- Final production build passes (verified-build.txt; existing chunk/dependency warnings). No deploy.
- Real Salgsmapper product: two independent designs created and reopened in the existing designer with exact template pages. Actual PDFs/previews created, reviewed and approved. Unchanged save retained approval; editing Design 1 produced revision 2 and left Design 2 approved at revision 1. Refresh retained both.
- Selected matrix price 50 = 1645 DKK; quantity mismatch did not change it. Returning to matrix and selecting 75 = 1728 DKK retained artwork and approval states; return retained the selected 75 cell. Final split 38/37.
- Responsive checks at 320, 390, 768, 1024, 1280 and 1440 px. Scoped button foreground override fixes tenant link color collision. Final 320 px viewport and document width both 320.
- Brochure adapter is implemented and type/build checked; its full browser round-trip remains unverified because the available brochure product is unpublished and ordering disabled. No ordering gate was bypassed. Apparel/company templates, cut-contour-specific cases and all product configurations are not claimed as verified.

Evidence and before copies: output/multiple-design-workspace-2026-10-21/. integration-changes.patch excludes unrelated existing edits. Screenshots workspace-final.png and workspace-final-320.png show the result. Test artwork consists of simple text/shapes, not production artwork.

## Local runtime and rollback

Node: /Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node

Run the existing Vite CLI with --mode workspace --host 127.0.0.1 --port 8933 --strictPort and WEBPRINTER_VITE_CACHE_DIR=output/multiple-design-workspace-2026-10-21/vite-cache. Mode workspace avoids development-only component tagging while keeping import.meta.env.DEV true. Use the same origin to retain local drafts.

No database rollback is required. Disable/remove only the local route/launch/save branches and new workspace modules if reverting. Use the scoped patch and before copies for review; do not overwrite whole files or reset this dirty shared checkout. Keep local IndexedDB drafts and evidence unless the user explicitly asks to delete them.
