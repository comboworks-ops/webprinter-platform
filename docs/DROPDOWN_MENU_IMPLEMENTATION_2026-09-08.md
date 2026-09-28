# Product dropdown menus — 8 September 2026

Final result: passed for the local implementation and review scope.

## Approved selection

The explicit numbered gallery selection supersedes the earlier ambiguous two-image preference. Keep 1 Tabbed Explorer, 2 Visual Showroom, 3 Kinetic Type, 4 Quick List, **5 Search & Discover (default)**, 7 Paper Fold, 8 Open Directory, 9 Product Filmstrip, and 10 Focus Curtain. Exclude 6 Editorial Feature. These are independent of the overall print theme; Refined Familiar remains the storefront theme default.

Canonical manifest: `output/design-exploration/dropdown-menus-2026-09-08/display-order.json`.

## Implementation

- Shared approved-preset registry feeds both existing designer selectors. Defaults and both branding merge paths resolve missing, invalid and old classic values to Search & Discover. Explicit nonclassic legacy menus remain compatible. Applying another shop/print theme preserves the independent menu selection.
- Header delegates approved desktop menus to `StorefrontProductMenu`; compact navigation uses the same catalog and menu content. Complete catalog search is separate from legacy eight-item previews. Links use the existing tenant-context helper.
- Existing Framer Motion plus scoped CSS supplies short reveals, tab/content transitions, paper unfolding and the curtain. Filmstrip movement is manual. CSS and Framer reduced-motion branches are source-inspected; OS-level reduced-motion emulation was not performed.
- Tenant background, font sizes, colors, radii and image overrides remain available. The existing `no-link-color` opt-out prevents global anchor colors from overriding menu typography. Legacy controls without an effect on these layouts are hidden.
- Category imagery uses existing uploaded/catalog images and the shared print-category artwork. A product without a real image has an icon. No product data, price calculations, POD behavior or backend settings were written.

## Visual evidence and corrections

Exact selected reference: `output/design-exploration/dropdown-menus-2026-09-08/05-search-and-discover.png` (1536 × 1024). Final actual-storefront capture: `output/design-exploration/dropdown-menus-2026-09-08/qa/05-search-and-discover-desktop.png` at the same CSS viewport and screenshot size. Both were inspected together during comparison, followed by the final color correction.

The live default panel measured x418, y66, width700, height663.4 at 1536 × 1024. Opening duration is220ms. There was no horizontal page overflow. It retains the centered white panel, headline, search field, category shortcuts, four suggestion rows, separators and all-products link. Real catalog content replaces the illustrative product names/images; surrounding shop layout, logo and tenant colors remain the real system's values. This is an intentional adaptation of the selected menu, not an attempt to replace the underlying storefront with a generated screenshot.

All nine desktop compositions were visually inspected. Additional captures in the `qa` folder show the chooser and compact menu. Some early desktop captures precede the final centering, category-image fallback and global-link color correction; use the default capture and final Visual Showroom capture as final image evidence. The other four delegated desktop/mobile checks were inspected inline in Chrome and were not saved as PNGs.

Corrections from QA:

1. Radix PopoverPortal requires a single child. Separating backdrop and content portals eliminated the opening exception.
2. Wide menus originally centered on the trigger. A measured Radix alignment offset now centers them in the viewport; Quick List remains under its trigger.
3. Category photo fallbacks now reuse the existing storefront artwork instead of large blank icon panels for known categories.
4. A native ResizeObserver deferred-delivery notification previously triggered AppRuntimeGuard's fatal screen on desktop-to-phone resizing. The exact native-shaped notification is now nonfatal and retains a warning. Real thrown errors remain fatal, with regression coverage.
5. The global anchor selector overrode product text colors. The scoped Link wrapper now uses the existing global opt-out; actual product text computes to rgb(31,41,55), matching the supplied #1F2937 setting.

## Browser verification

Review URL: `http://127.0.0.1:8110/output/design-exploration/dropdown-menus-2026-09-08/implemented.html`.

Direct storefront: `http://127.0.0.1:8110/?tenantId=00000000-0000-0000-0000-000000000000`.

| Check | Result |
| --- | --- |
| Nine selectors; excluded editorial absent; #5 default badge | Passed |
| All nine desktop layouts using real catalog reads | Passed |
| Search: product text, Danish ae/æ matching, clear, no results | Passed |
| ArrowDown search navigation, Escape close, trigger focus return | Passed |
| Tabbed Explorer mouse and RightArrow category switching | Passed |
| Filmstrip next/previous and disabled end states | Passed |
| Outside click closes default on actual storefront | Passed |
| Actual search result opens `/produkt/aluminium?tenantId=...` and closes menu | Passed |
| #5 at320,390,768,1024,1280,1440; live1536 | Passed |
| Other eight compact menus at320 and/or390 | Passed |
| Compact category disclosure exposes complete links (15 in Tryksager) | Passed |
| Local save and reload preserve selected menu; restore #5 | Passed |
| Fresh storefront and post-fix Chrome console | No errors |

The review fixture intentionally reopens the menu when the preview route/branding changes. Closing after product navigation was therefore checked separately on the actual storefront. The fixture saves only browser-local review state. The production editor's existing save path is wired/source-inspected; authenticated hosted save/readback is not claimed.

## Validation and limits

23/23 targeted tests pass: approved presets, default resolution, both branding merge paths, theme application preserving menu selection, and runtime error policy. Scoped ESLint passes with one existing HeaderSection hook-dependency warning. Header's preexisting8 lint errors and3 warnings are identical to the preimplementation snapshot; zero new Header findings.

Final production build passed after the link-color correction (21.42s), output `/private/tmp/webprinter-dropdown-build-final`. Logs: `/private/tmp/webprinter-dropdown-final-{build,tests,lint}.log`. Existing bundle/import warnings remain; a clean whole-repository lint/typecheck is not claimed.

No deployment, hosted publishing, database writes, private-account save verification, physical-device performance measurement or video export was performed. The earlier repository release/acceptance requirements remain separate. Rollback is limited to these menu UI/default changes and the narrow runtime-notification policy; no schema rollback is required.
