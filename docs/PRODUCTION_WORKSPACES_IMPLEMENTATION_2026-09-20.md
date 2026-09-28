# Connected wide-format and machine workspaces

20 September 2026. **Final result: passed for the scoped local implementation; authenticated production acceptance remains open.**

The user selected wide-format **8 – Priser i intervaller** and machine **11 – Kosttest og hjælp**, then explicitly requested that these screens control the actual system while preserving its connections and tools. The gallery's visible selections were read before implementation. These are now application components, mounted through the existing product and machine routes.

## Connections and behavior

- `/admin/products` remains the actual product locator implemented earlier. Opening an existing `STORFORMAT` product through `ProductPriceManager` now opens `StorformatPriceWorkspace`. The normal matrix ordering-form workspace is unchanged. Finder search/filter/tenant context is retained by the back link. The locator also reads the existing tenant/product-scoped wide-format materials in paginated batches, making material names searchable and showing Eget format for wide-format products.
- The wide-format view receives the existing `StorformatManager` state and save handler. It edits material price intervals, anchor flags, interpolation, dimensions, rounding and global markup. Material-specific tier markups and remaining fields are preserved. **Alle værktøjer** opens the full existing manager with the same draft state: materials, finishes, auxiliary products, quantity/matrix layout, price generators, templates and source-quote coverage.
- Both the chart and test price call the existing `tryCalculateStorformatPrice`. Selected finishing/auxiliary choices and quantity feed that calculation. Supplier-quote products retain their quote model and open the existing quote/coverage tools; synthetic tier controls are not shown for those products. Existing interval boundaries and per-item versus total-area behavior are not rewritten.
- The new machine landing uses the existing `MachineCostWorkbench` state and `simulateMachineCost`. It displays saved machines, costs, job dimensions, material, sides and actual sheet imposition. All seven original tool tabs remain reachable. **Indstillinger**, **Maskinbibliotek** and **Opret prisprofil** open the existing forms/library with the selected data. A collapsed full calculation retains unit price, actual margin, profit, media/ink use and production-unit details.
- The existing machine and pricing-profile dialogs save through their existing handlers and reload data without losing the current test job. The profile preview now uses the existing best-fit estimator, fixing an observed A5 2-up/4-up disagreement with the cost simulator. No pricing formula changed.
- Missing or failed core data reads show explicit retry states. The wide-format table reads retain product scoping and add the existing tenant column to their filters. No table, migration, RPC, Edge Function, import route or publishing behavior was created or changed.

## Honest differences from the concepts

The visuals proposed smooth curves, downward rounding, fictional machine imagery and learning from past jobs. Those features are not present in the existing backend. This implementation preserves actual supported behavior:

- Wide-format offers fixed intervals or straight-line interpolation and the existing nearest-step rounding. The graph reflects that exact calculation. A smooth draggable curve and a new rounding policy would require a separately defined pricing change.
- The machine simulator uses target gross margin and rounds up. Labels reflect those meanings. A saved profile contains only the existing machine, ink, bleed and gap fields; quantity, material, margin and test price are explicitly described as test-job data. Unsupported click/offset models can be tested but cannot be saved as an ink-based profile.
- Assistance compares configured machines for the same test job, excluding incomplete/unfitting results. It changes only the selected test machine. Existing library/PDF brochure help remains available. Historical-production learning and Jev integration are **not connected** and the interface says so; no fabricated job history or AI training is presented.
- Real existing product images and neutral machine icons replace concept photography. No machine-photo field currently exists. The shared tenant header, theme and navigation are preserved.

## Visual review

Reference images: `output/product-creation-concepts-2026-09-20/08-wide-bands.png` and `11-machine-bench.png`, each 1487 × 1058. Both references were inspected and compared side by side with real rendered components in equal 1487 × 1058 iframe frames at a common half-size scale. Reproducible comparison: `tmp/production-workspaces-20260920/comparison.html`. Captures were emitted in the task, not saved as standalone PNGs.

The two-column editor/calculation structure, Inter typography, navy headings, restrained blue actions, small corners and lightweight separators follow the selections. Necessary interval bounds, real job controls and original tool navigation add content relative to the illustrations. The machine assistance follows the calculation in the natural page scroll. There is no pixel-identical claim.

Resolved findings: the admin shell initially arranged the page heading horizontally; scoped styles restore its stacked hierarchy. The wide-format price/save action initially fell below the reference frame; tighter chart/image spacing puts it inside that desktop composition. Machine names and settings initially competed for width at 320px; settings now wrap onto their own line. The sheet/profile preview disagreement described above was fixed.

Desktop screenshots at 1487 × 1058 and mobile screenshots were inspected. Document width equals viewport width at 1440, 1280, 1024, 768, 390 and 320 CSS pixels for both views. Controls stack on narrow screens; disclosure panels expose extended settings. No unresolved P0/P1/P2 issue was identified within this scoped UI review. This is not a complete accessibility or all-catalog audit.

## Verification and environment boundaries

**Connected app:** `http://127.0.0.1:8113/` runs the normal Vite entry and normal configured backend, `ziattmsmiirfweiuunfo.supabase.co`. Its actual public catalogue loaded in the browser without error-level console entries. Admin access redirected while signed out; the normal `/auth` page is open for the user's login. Read-only schema/count checks confirmed existing machines (2), profiles (2) and wide-format configs (9). This does not prove authenticated admin RLS, live saving, or production release. No credentials were read or injected.

**Isolated behavioral verification:** `http://127.0.0.1:8112/` uses a separate Vite config and synthetic Supabase-shaped fixture, explicitly labelled as example data with no production connection. The real application components run in both environments; only the isolated harness replaces backend access. Browser writes below were entirely fixture-local.

Verified in the browser:

- Finder search for `510 g`, material filter `510 g PVC` → PVC banner → new wide-format editor → return with search retained. Wide-format fixture metadata is independent from the print-product papers/formats.

- Wide-format test at 100 × 200 cm: 248.50 kr./m² produces 500 kr. after existing 10 kr. nearest-step rounding. Editing the interval to 260, saving via the existing manager and reloading produces 520; restoring and saving restores 500.
- Selecting eyelets and quantity 2 produces 690 kr. for 4 m² with the existing finish calculation.
- Opening the full wide-format tools and returning preserves edited product state.
- A 500-copy A5 test fits 4 per sheet, costs 389.03 kr. and suggests 649 kr. under the saved synthetic machine settings. The profile dialog uses the same 4-up fit.
- Creating a synthetic price profile through the actual form persists through profile-tab reload; the open test job is retained after the dialog closes.
- Trying the cheaper machine changes the suggested price to 605 kr.; its comparison basis explains the calculation and absent historical learning.
- Existing machine settings and the 20-entry machine library open. Unsupported offset profile saving is disabled with an explanation; switching back restores the supported path.
- Both workspace console checks report no error-level entries.

26 existing focused tests passed: product locator matching/context, draft machine estimation, machine reconciliation, wide-format source-quote UI/model and customer display-price behavior. Production Vite build passed. New workspace components and the updated locator pass ESLint. Before/current TypeScript diagnostics remain **403/403 with no added diagnostics**; repository-wide type checking is not clean. Logs and before-task snapshots: `tmp/production-workspaces-20260920/`.

No hosted save, supplier import, file upload, external AI request, deployment or database mutation was performed. Source-quote pricing has existing regression coverage; its new UI and roll-machine fixtures were source-reviewed but not separately browser exercised. Real authenticated data, save/reload and a live customer ordering-page comparison remain acceptance steps after sign-in.

## Rollback

Revert only this task's integration hunks and the new `StorformatPriceWorkspace.tsx`, `MachineTestWorkspace.tsx` and `productionWorkspaces.css`, using `tmp/production-workspaces-20260920/before/` as the before-turn reference. Do not restore whole files from Git HEAD: the repository contains extensive unrelated work. No schema rollback is needed. Earlier locator/ordering-form implementations and pricing/POD engines are preserved.
