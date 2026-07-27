# T-shirt Designer Tool Assessment - 2026-07-10

## Recommendation

Use Webprinter's existing Fabric.js designer as the production designer, and add an apparel-specific adapter around it.

The best external pattern to borrow is a hybrid model:

1. Fabric.js remains the source of truth for editable artwork, print area, saved JSON, and production export.
2. A T-shirt/apparel preview layer shows garment color, front/back placement, and optional realistic mockup.
3. Three.js/react-three-fiber can be added later for a richer 3D preview, but only as preview output, not as the print file generator.

Do not replace the current designer with Polotno, tldraw, Excalidraw, Konva, or a small GitHub T-shirt demo.

## Why This Fits Webprinter

The current codebase already has the expensive print-specific parts:

- `src/pages/Designer.tsx` uses Fabric.js and has PDF import, export, preflight, color proofing, checkout handoff, and product-mode messaging.
- `src/components/designer/EditorCanvas.tsx` exposes the production editing API: JSON save/load, SVG import, image/text/shapes, guide overlays, cut contour handling, layer control, and high-resolution PNG export.
- `src/lib/sites/productSiteModes.ts` already defines `designerMode: "apparel"` and `pricingModel: "apparel_matrix"`.
- The Tee Design Hub preview bundle already has the shop-side apparel experience: product cards, upload, garment colors, print methods, sizes, and quantity controls.

That means the missing piece is not a new designer. The missing piece is a bridge:

- product/apparel selection -> Webprinter designer
- product print zone -> Fabric canvas constraints
- garment mockup -> non-printing preview layer
- saved design -> order/session
- production file -> artwork only, not garment preview

## Candidate Review

| Option | Fit | Notes |
| --- | --- | --- |
| Existing Webprinter Fabric.js designer | Best | Already integrated with PDF/preflight/export/order flow. Lowest risk. |
| `vihanrs/t-shirt-designer-webapp` | Good reference pattern | React + Fabric.js + Three.js. Useful architecture idea for 2D+3D sync, but small repo and no clear license in GitHub metadata. |
| `lmanukyan/print-designer` | Useful reference only | MIT, Fabric.js, T-shirt-focused, but Vue + Payload + MongoDB. Better to mine ideas than adopt. |
| `luciferreeves/TShirtDesigner` | Reference only | MIT and Fabric-based, but README says under rewrite and last push is old. |
| `tolgaerdonmez/tshirt-designer` | Reference only | MIT React/Fabric demo, but older React/Fabric versions. |
| Three.js/react-three-fiber | Excellent preview layer | Strong ecosystem. Should display garment mockups, not control print production. |
| Polotno | Not recommended now | Strong editor SDK, but commercial/closed SDK layer and Konva-based. Adds licensing cost and second schema. |
| Konva/react-konva | Not recommended as core | Strong canvas library, but would duplicate/replace Fabric editor logic. |
| tldraw/Excalidraw | Not recommended | Great whiteboard tools, not print-production or apparel-output tools. |

## Proposed Implementation Path

### Phase 1 - Apparel Adapter

Create an apparel design mode inside the existing designer:

- define front/back print areas per apparel product
- show garment color and product silhouette behind the Fabric print area
- keep garment/mockup layers non-exporting
- constrain customer artwork to the printable zone
- support front/back design tabs
- save Fabric JSON per side

### Phase 2 - Tee Bundle Handoff

Connect Tee Design Hub product selections to Webprinter:

- selected product
- color
- print method
- size distribution
- quantity
- selected side/front-back
- uploaded image

This should open `/designer/...` with `designerMode=apparel` and a return path back to the preview/shop order flow.

### Phase 3 - Production Output

Production output should be:

- transparent artwork for the print zone
- correct physical dimensions and DPI
- optional supplier-specific technical notes
- order preview PNG showing shirt + artwork
- never include shirt mockup in production artwork

### Phase 4 - Optional 3D Preview

Add Three.js/react-three-fiber only after the 2D production flow works:

- generate texture from Fabric canvas
- map texture to a shirt model
- let customer rotate preview
- keep Fabric JSON/PDF/PNG as production truth

## Decision

The best option is:

**Build on the existing Webprinter Fabric.js designer, borrow the Fabric+Three hybrid idea from current GitHub examples, and add a Webprinter-owned apparel adapter.**

This gives the customer a modern T-shirt design experience without sacrificing print correctness, order integration, or the existing PDF/designer investment.

## Sources Checked

- https://github.com/fabricjs/fabric.js
- https://github.com/pmndrs/react-three-fiber
- https://github.com/mrdoob/three.js
- https://github.com/Hopding/pdf-lib
- https://github.com/vihanrs/t-shirt-designer-webapp
- https://github.com/lmanukyan/print-designer
- https://github.com/luciferreeves/TShirtDesigner
- https://github.com/tolgaerdonmez/tshirt-designer
- https://github.com/ChanceSQ/tshirt-designer
- https://polotno.com/ai-info-page
- https://polotno.com/sdk/product/compare/polotno-sdk-vs-konvajs
