# Landing page option 1 — local design review

Final result: **passed** for this local landing-page implementation, 8 September 2026.

## Scope and reference

Thomas selected option 1 from the revised landing-page concepts. It follows the system's selected standard, **Precise Print Grid** (`print-precise`): Inter, white surfaces, navy text and blue actions. The selected raster is `/Users/thomasprintmaker/.codex/generated_images/01a07dd4-b0f1-7460-8e0b-aa2ef0e5f2f4/exec-8b9b4988-2bc6-4bad-a213-db08deb9aae7.png` (864 × 1821).

Preview: `http://127.0.0.1:8110/?force_domain=webprinter.dk`. Existing Vite server and checkout ownership were verified. Only the platform home page, its new landing components and assets were changed. Other ongoing storefront/designer work in the dirty checkout was preserved. No publishing, dependency-manifest changes, pricing changes, database changes or order submissions were made by this implementation.

## Delivered

- Split hero with actual default storefront capture and the existing WP brochure photograph.
- Three-chapter illustrative walkthrough: product selection, designer and received order. A deterministic 18-second Hyperframes/GSAP composition is controlled by accessible React play/pause, chapter and range controls. Playback is user initiated, pauses when the document is hidden, and ends at 18 seconds. Reduced-motion users receive fixed chapter frames.
- Designer feature, closing demo action, responsive navigation and existing platform/contact/privacy links.
- Local demo actions open `/shop?tenantId=00000000-0000-0000-0000-000000000000&design=1`.

## Asset provenance

`storefront.webp` is an optimized capture of the actual selected local storefront. The captured product image/title/price reflect that preview at capture time; they are not a newly authored product offer. `precise-hero.webp` is the existing approved standard-design photograph.

`designer.webp` is an illustrative image generated from the actual designer screenshot (`tmp/pdfs/designer-smoke-start.png`), retaining the tool rail, canvas and layer panel with a WP brochure example. The image and order chapter are labelled illustrative in the page. They do not prove authenticated order processing or PDF output. GSAP 3.14.2 is self-hosted with its original license header. Motion-local image copies keep the composition independently verifiable. Unoptimized source captures are retained in the QA directory rather than shipped in public assets.

## Visual review

Evidence: `tmp/landing-qa-20260908/`.

`comparison-final.jpg` places the reference beside the assembled actual desktop screenshot at a common width. `desktop-final.png`, `hero-final.png`, `flow-final.png`, `mobile.png`, `mobile-flow.png`, and `tablet.png` record the resulting page. The desktop full-page evidence was assembled from overlapping normal screenshots because the browser's stitched full-page capture produced artifacts.

| Area | Result |
| --- | --- |
| Composition | Selected hero, two-column workflow, pale designer section and closing CTA retained. |
| Typography | Inter hierarchy, readable Danish copy and responsive heading wrapping checked. |
| Color and surfaces | White/navy/blue palette, light borders, restrained rounding; inherited global anchor-color conflict fixed with landing-scoped rules. |
| Imagery | Actual shop capture, existing physical brochure photo and clearly labelled designer illustration load correctly when in view. |
| Responsive | Desktop 1440 × 1000, tablet 834 × 1024 and phone 390 × 844 inspected; no horizontal document overflow. Phone menu opens, closes on navigation, and Escape restores toggle focus. |
| Interaction | Demo CTA opens the selected actual storefront; chapter selection, playback completion and keyboard End on the timeline work. Only the active scene appears in the iframe accessibility tree. |
| Accessibility | Native controls, descriptive image text, focus indicators, skip link, menu expanded state and reduced-motion handling. No complete assistive-technology audit claimed. |

Resolved P2 issues: inherited link colors affected CTA contrast; React 18 rejected `fetchPriority`; animation preview adapter needed DOM-ready initialization for the Hyperframes compiler; the order-status badge needed stronger contrast. All are fixed.

Remaining P3 differences: the live implementation has slightly different image proportions, text wrapping and vertical density from the generated reference. It adds useful image captions, native playback controls and a complete footer. On phone the designer explanation precedes its image. These preserve the selected composition and improve use at smaller widths. No open P0/P1/P2 design findings remain within this scope.

## Engineering verification

- Scoped ESLint: passed with no warnings.
- Production Vite build: passed in 11.00 seconds, output `/private/tmp/webprinter-landing-final-build-20260908`; existing large-bundle warnings remain.
- Hyperframes 0.8.30 `check`: passed lint, runtime, sampled layout and all 22 contrast checks. Motion analysis was not enabled; no encoded video was produced. Evidence: `hyperframes-check.json`.
- Scoped whitespace/diff check: passed.
- Browser verification covers the local landing and demo destination. It does not cover hosted deployment, authenticated editor save, checkout completion or PDF correctness.

## Files and rollback

Implementation: `src/pages/Index.tsx`, `src/components/platform/landing/`, and `public/platform/landing/`. To remove this proposal, restore the prior platform Index implementation and remove only these new landing-specific imports/components/assets. There is no schema or data rollback. Preserve all unrelated concurrent edits.
