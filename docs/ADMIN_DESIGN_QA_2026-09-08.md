# Admin design QA — 8 September 2026

Status: local implementation and synthetic browser verification completed for the checks below. Authenticated acceptance remains pending. See the [57-selection implementation ledger](ADMIN_OVERHAUL_IMPLEMENTATION_2026-09-08.md) for complete source coverage and remaining limitations.

Follow-up: [read-only live database verification](ADMIN_LIVE_VERIFICATION_2026-09-08.md) establishes current POD usage and clarifies the legacy billing finding. It does not replace signed-in browser acceptance.

## Method and evidence boundary

The actual current checkout runs at `127.0.0.1:8110`. Its admin route redirected without an authenticated admin session, so a sign-in request was presented to the owner. No credentials or local authorization bypass were added to the application.

An isolated Vite fixture at `127.0.0.1:8138` renders the real admin components with synthetic products, orders, messages and saved designs. Its entry/client aliases are confined to ignored `tmp/admin-overhaul-20260908/fixture*` files. It has no real Supabase client credentials, rejects all writes and blocks external service connections with CSP. The fixture's yellow banner is visible in every screenshot. Synthetic queries and roles do not verify server RLS, real authentication, persistence, storage, payments or supplier operations.

Reference images are the exact selected PNGs from `docs/ADMIN_DESIGN_SELECTIONS_2026-09-08.json`. The implementation viewport was 1488 × 1058 for desktop comparison. Tablet checks used 768 × 1024; phone checks used 390 × 844. The synthetic banner adds vertical space that is absent from the references. The requested Inter/white/navy/blue workspace foundation is implemented using scoped admin styles.

## Checked interactions and results

| Check | Observed result |
| --- | --- |
| Header menus and active section | Product menu opened and selected route retained `force_domain`. Narrow navigation expanded to all allowed groups. Master/tenant menu filtering has four passing local tests; live authorization is unverified. |
| Product register | Revised register starts immediately below the compact filters. Searching Visitkort showed `1 af 5 produkter`; clearing restored the register. Category dialog rendered as a stacked, scrollable editor at 390 px. |
| Product creation | Parallel form and compact nine-preset selector rendered. Entering a product name enabled creation; cancel returned with shop context. Creation was not submitted. |
| Product configuration | Six configuration tabs were clicked and retained shop context plus their respective hashes. Existing price/configuration controls rendered; no live price or product saves were attempted. |
| Order selection and detail | Selecting order 1047 updated the preview. Opening it used `/admin/kunder?orderId=fixture-order-1&force_domain=webprinter.dk`. Detail had the corresponding customer and file-empty state. |
| Order failure and filtering | A write rejected by the fixture left the detail editor open. Cancel returned to the register. No-match search showed its explicit empty state; reset restored the register. |
| Messages | An order link selected the matching conversation and order context. A rejected synthetic send displayed “Kunne ikke sende besked” and preserved the typed draft. No external message was sent. |
| Collection selection | Selecting Site Design changed the module inspector; its existing Open action retained shop context. Selecting the second saved design changed the library detail and retained the original actions. |
| Cost test and job pool | Both real tabs opened, retained their inputs and showed explicit missing-machine/material conditions instead of fabricated calculations. No machine or pricing settings were saved. |
| Dark appearance | Account menu switched to dark mode. Dashboard and product evidence was captured, then light mode was restored. Dashboard text, controls and selected states remained readable. This is not an exhaustive contrast audit of every legacy child control. |
| Supporting routes | 34 initial route smoke checks plus 11 targeted revised-route checks were recorded. Empty/loading states are distinguished from populated workflow proof. Final desktop target checks had no page overflow or caught render error. |

## Designer integration

The selected `designer_1` composition uses the existing editor inside the admin shell. The standalone customer editor keeps its own layout. No canvas coordinate, colour-proofing worker, print dimension, export transformation or pricing calculation was changed for the admin layout.

The local fixture loaded an A4 canvas with two canvas elements. Adding text created a visible selection and opened its existing properties inspector. The original Back action displayed the unsaved-change dialog; choosing discard returned to the admin dashboard with `force_domain` intact. The existing phone unsupported view was retained and rendered without horizontal overflow.

A synthetic saved design assigned to a different shop was blocked before mounting an editable canvas. Its explicit recovery button returned to a new A4 design bound to the selected shop. The wrapper checks the saved row and tenant; embedded updates also require a matching tenant and acknowledged row. Actual authenticated save/reload remains unverified.

The new shell-link, logout and notification actions share an unsaved-exit decision. Their event wiring was source-reviewed. Native confirmation acceptance/cancellation for those header actions was not browser-automated. Browser history Back/Forward remains the existing SPA limitation and is a remaining acceptance issue, not a passed check.

## Responsive findings and corrections

Tablet checks covered eight core route families. Phone checks covered 21 route families, including the existing designer phone guard. Three actual overflow defects were found and corrected:

- The order table's offscreen accessible heading leaked outside its scroll container. Positioning the scroll container bounded it; the recheck measured page width 390 px at a 390 px viewport.
- Machine statistics were squeezed beside the heading. They now occupy a separate row, wrap naturally and measured 390 px after correction.
- Tenant heading/actions did not wrap. The heading and actions now wrap, with a semantic page heading; the recheck measured 390 px.

Wide product/order tables intentionally scroll inside their own region on a phone. All actions remain available without widening the document. Category editing stacks inside its scrollable dialog. Raw initial checks retain the original failures for traceability; the corrected measurements are recorded here rather than erasing those observations.

## Visual comparison

The selected product-register and creator compositions were refined after desktop screenshots showed excess legacy panels and oversized preset cards. Both now expose the work area earlier. Order-register proportions and dashboard text sizes were also adjusted following reference comparison. Selected references and implementation screenshots for orders, products, creation, designer and icon generation were inspected; icon generation now has three real working columns.

The selected images contain illustrative records and sometimes unsupported controls. Production data, payment states, generated artwork, SEO integration status and supplier results were not fabricated to match them. The supporting ledger explicitly identifies 24 adaptations of existing workflows and 18 implemented supporting layouts. These labels describe source layout coverage, not 42 individual pixel-fidelity passes.

Branding/site editor controls render, but the fixture cannot provide their complete storefront iframe handshake. Their preview content is therefore unverified. POD2's selected wizard artwork does not describe its real pricing-matrix job, so the genuine matrix controls and approval gates take precedence. A full visual/persistence acceptance pass needs a signed-in session with representative saved data.

## Build and source checks

- Production Vite build passed. Output was written outside the checkout's existing `dist`. Existing large-bundle and LCMS warnings remain.
- 35 focused navigation/product/pricing-preservation tests passed; 14 production-submission tests passed: 49 tests total.
- Syntax validation passed for 62 TS/TSX files and four CSS files. Scoped diff checks also passed after a whitespace correction. These are syntax checks, not a substitute for semantic application typing.
- Full `tsc --noEmit --project tsconfig.app.json` remains unsuccessful: 490 diagnostics in 107 files. A normalized comparison against the saved earlier check found zero new diagnostics and seven removed; existing backup import and generated-schema/editor typing errors remain. Do not report the project as type-clean.
- No dependency installation, lockfile rewrite, schema migration, deployment, production write, external message or payment was performed.

## Evidence files

Local evidence lives in ignored `tmp/admin-overhaul-20260908/`:

- `dashboard-desktop.png`, `dashboard-dark.png`, `products-desktop.png`, `products-mobile.png`, `products-dark.png`, `create-desktop.png`, `categories-mobile.png`.
- `orders-desktop.png`, `orders-mobile.png`, `order-detail-desktop.png`, `messages-desktop.png`, `designer-desktop.png`, `designer-phone.png`.
- `modules-desktop.png`, `library-desktop.png`, `costtest-desktop.png`, `jobpool-desktop.png` and targeted `*-final.png` captures.
- `route-smoke-fixture.json`, `routes-final-fixture.json`, `responsive-fixture.json`, `product-tabs-fixture.json`, `focused-tests.log`, `production-tests.log`, `build-final.log`, `typescript-final.log`.

The reports are durable project documentation; the fixture and screenshots are local verification artifacts. No claim of deployment, commercial readiness or completed backend integration follows from them.
