# Selected homepage and product presentations

Thomas selected images **1, 3, 4 and 5** on 21 September 2026. Image 2 is excluded. The implementation is local and has not been published. The local four-layout review is now working and browser-verified; full responsive, build and authenticated acceptance remains incomplete.

## Implemented scope

- **1 — Præcist katalog:** category sidebar and three-column product image catalogue.
- **3 — Produkt i fokus:** selectable product directory and a large product preview with its existing destination.
- **4 — Visuelle kategorier:** dark category shelves, horizontal browsing and a clear hover/keyboard selection treatment. Images enlarge gently and the arrow moves; motion can be disabled and respects reduced-motion preferences.
- **5 — Printstudio:** independently clickable products over an empty tabletop asset, plus a complete product directory.

The actual Site Design V2 product inspector includes the four numbered thumbnails, heading, subtext, visibility and animation controls, plus an original-theme fallback. The original card-layout controls appear only when that renderer is selected. Choosing a presentation moves the product section first while retaining other authored sections. It does not replace the header, logo, menu or selected theme. The setting applies to the homepage and `/produkter`, including category routes.

Each view reads the existing storefront catalogue, excludes category landing pseudo-products, uses current product names/images and links to `/produkt/:slug` with the existing tenant-context helper. Search, root/child categories, legacy categories, unclassified products, empty results and missing images are handled. No sample prices or fabricated product imagery are inserted into real shop data. Products without an image show a labelled fallback.

The tabletop contains no baked-in products or logos: replacing a product image updates its own object. The four supplied proposal images are used only as designer thumbnails. Product photography still determines the visual richness of the resulting shop.

## Persistence and source map

`forside.productsSection` adds optional `presentation`, `presentationMotion`, `presentationTitle` and `presentationSubtitle` properties. Existing branding merge/save/publish paths carry that section. No new persistence or publishing handler was introduced. The publish confirmation names the selected product presentation. `PreviewShop` supplies the complete virtual path, including taxonomy query parameters.

- `src/lib/branding/productPresentations.ts`: selected definitions, safe fallback and draft patch.
- `src/components/admin/ProductPresentationPicker.tsx` and `SiteDesignEditorV2.tsx`: designer controls.
- `src/components/storefront/ProductPresentation.tsx` and `src/styles/productPresentations.css`: four renderers and motion.
- `src/components/storefront/StorefrontHomeContent.tsx`: published/preview renderer selection.
- `src/lib/storefront/productPresentationCatalog.ts`: search and category grouping.

No pricing, POD, checkout, schemas, product records or tenant scope were changed. No hosted branding save or publish was performed.

## Visual comparison and evidence

References and screenshots are retained in `output/design-exploration/product-overview-2026-09-21/`. Each selected reference was inspected alongside its implementation screenshot in a paired image input at 1487 × 1058.

| View | Screenshot | Result and intentional adaptations |
| --- | --- | --- |
| 1 | `implementation-1-initial.png` | Actual public catalogue. Sidebar and equal image grid match the selected composition. Real branding/product inventory replaces illustrative content. Extra inherited section padding and link-colored descriptions were identified and fixed in source; final recapture is pending. |
| 3 | `implementation-3.png` | Example catalogue using the actual renderer. Selecting Plakater changed the stage heading/image and CTA to `/produkt/plakater`; document width stayed 1487px. Added working search/category controls. CTA text inherited an unsuitable link color; corrected to white in source, recapture pending. |
| 4 | `implementation-4-initial.png` | Example catalogue using the actual renderer. Dark grouped shelves retained; current header branding stays separate. Shelf next-button moved the rail to scrollLeft 354 without page overflow. Search/category interaction was verified. Extra filters and real taxonomy add vertical space relative to the concept. |
| 5 | `implementation-5.png` | Example catalogue using the actual renderer. Independent tabletop objects and the full directory are present. Product cutouts replace illustrative full-print photography; the existing horizontal header is preserved instead of imposing the concept's vertical global navigation. |

The example toolbar is intentionally outside the storefront UI and labels all sample data. It includes the real reusable picker and an isolated localStorage draft mechanism. It is not evidence of authenticated or hosted persistence.

## Validation

- **11 tests pass:** selected-option serialization and preservation, category/legacy grouping, Danish multiword search, invalid/conflicting category safety, existing catalogue navigation. See `tmp/product-presentations-tests.txt`.
- **8 changed/new TS/TSX files pass syntax/transpilation checks**, independently with TypeScript 5.9.3 and the installed SWC parser. See `tmp/product-presentations-transpile.json`. This is not semantic project type checking.
- Scoped tracked-file `git diff --check` passes.
- Initial desktop renderer and picker checks completed in the browser. The actual editor route redirected this unauthenticated browser to the storefront; no authentication bypass was attempted.
- Full Vite build initially failed inside installed PostCSS selector-parser (`Object prototype may only be an Object or null: undefined`). ESLint failed inside its installed CLI (`cli.execute is not a function`). Long-running app TypeScript/build retries stalled reading dependency files and were cancelled; no clean build/type/lint claim is made.
- Exact locked TypeScript/Rollup offloaded files and PostCSS selector-parser 6.1.4 were restored from integrity-verified official npm archives. Package versions and lockfile were not changed by this task. Evidence: `tmp/product-presentations-dependency-restore.json` and build/lint logs.
- Browser navigation/focus commands subsequently timed out, including fresh-tab recovery. The new local server bound port 8114, but a component request timed out and the page could not be verified usable. Neither a listener nor an earlier screenshot is presented as current working-preview proof.

## Outstanding acceptance

### Designer navigation follow-up — 21 September 2026

The owner could not find the four layouts. The signed-in Chrome workspace confirmed that `Produktoversigt` was hidden under `Flere sider` and merely navigated the preview, while the picker was separately hidden under `Flere indstillinger → Forside produkter`. That original picker was opened in the owner's actual editor without changing or saving the draft.

The source fix promotes `Produktoversigt` into the primary page list and `Produktvisning` beside `Bestillingsflow`. Opening the overview reveals the picker automatically, including through the preview's own navigation. Selecting a layout keeps the current homepage/catalog route rather than jumping to the homepage, and route classification retains category query parameters. Inspector thumbnails use one readable column; the four page buttons wrap on narrow screens. Seven existing navigation/presentation tests and syntax checks for all three touched TSX components pass.

At this checkpoint the running server still serves its cached version: four offloaded order-flow thumbnails occupy its filesystem workers, preventing HMR. A restart is prepared with 49 matching intact release assets cached locally (about 9 MB) to avoid those blocked reads. The owner's tab reports unsaved changes, so permission to save that current draft without publishing was requested before restarting. No save, publish or restart has yet been performed for this follow-up; verification of the new placement is pending that handoff.

### Full-system localhost — subsequent 21 September 2026 handoff

The user clarified that they need the actual system. It is now running at `http://127.0.0.1:8114/`, with the real admin login at `/admin/login`. Both routes were browser-verified; the homepage loaded current backend branding and the Aluminium Skilte product. The signed-out `/admin/site-design-v2` route redirected to the homepage normally. The real login was left open for the owner. Authentication, hosted saves and publication were not exercised.

Start command: bundled Node running `tmp/start-webprinter-full-system.mjs`, detached screen session `webprinter-full-system`; log `tmp/webprinter-full-system-localhost.log`. This uses the normal application entry, routes, environment and backend. CSS scanning skips offloaded tests, duplicate archives and standalone demonstrations. Eight unavailable runtime source files are served from exact recovered copies under `tmp/full-system-source-recovery`, through local Vite/esbuild load hooks. Seven came from the Git index with matching cached size and nanosecond mtime; the untracked 375-byte pricing guard came from its original 28 August add-file patch. The originals remain untouched: an attempted rename stalled and was interrupted before any source replacement. Recovery details and hashes are recorded in that folder's `manifest.json`. No pricing behavior was rewritten. These temporary startup files are needed until macOS can materialize the original offloaded files. This source-recovery workaround is local tooling, not a production build or deployment.

### Localhost recovery — 21 September 2026

**Superseded for port 8113:** the reduced CSS scan described below broke normal shop routes when the owner returned to `/`. Port 8113 now uses the full-system launcher and complete application styles. See [the repair evidence](LOCAL_UI_STYLES_REPAIR_2026-09-21.md). Do not restart the old three-component CSS configuration.

The review is running at `http://127.0.0.1:8113/output/design-exploration/product-overview-2026-09-21/preview.html?layout=4`. Fresh browser navigation rendered the page, and switching through 1, 3, 5 and back to 4 was verified. Screenshots confirmed product images and styling in the shelf and tabletop layouts. The tab was left open with view 4 selected.

macOS had offloaded installed dependency and generated cache files, causing synchronous reads to stall. Offloaded dependency files were restored from integrity-verified archives at their existing locked versions; package versions and the lockfile were not changed. The focused review starts through `tmp/start-product-presentations-preview.mjs` in detached screen session `webprinter-product-layouts`, writes `tmp/product-presentations-localhost.log`, and uses `/private/tmp/webprinter-product-layouts-focused-cache`. It compiles the review entry and its styles without scanning unrelated offloaded source files. Normal Vite also now supports the optional `WEBPRINTER_VITE_CACHE_DIR` override and ignores archived `output/**` watcher churn.

This is the actual reusable renderer and picker with clearly labelled example products. It does not establish that the full application or authenticated editor is usable on this focused server. No live save or publish was performed; the remaining checks below are still open.

Final QA remains open: repeat the full build and semantic type/lint checks after dependency recovery; recapture the two source corrections; check all four layouts at 390px/320px and tablet sizes, keyboard/reduced-motion behavior and loading/error/empty states; verify a saved example selection after reload; then check the normal signed-in Site Design preview and hosted draft save/readback. No publication is necessary for these local checks.

Working review fixture: `/output/design-exploration/product-overview-2026-09-21/preview.html?layout=4` (1/3/4/5). On a normal full development server, the read-only review routes are `/shop?productPresentation=4` or `/produkter?productPresentation=4`. These query overrides never alter saved branding and are ignored in production.

Rollback: select **Brug temaets oprindelige produktvisning** to restore the previous renderer. Existing section order can be moved back in the normal layout editor; selecting the fallback does not delete content or overwrite the user's current order. Removing the optional presentation fields also restores the standard renderer. No data migration or commercial rollback is required.
