# Storefront header fit and search — 2026-09-29

When the logo, navigation, and actions no longer fit on one row, the storefront now switches directly to the compact menu. The previous deliberate second navigation row is disabled. Existing `useHeaderFit` measurements, font-load observation, centered-navigation clearance, and 16px release margin remain in use.

Search starts as a magnifying glass on every screen and theme. A single shared field slides into the existing header row; opening search does not change measured navigation widths or header height. Only its results extend below the header. It searches the tenant catalog and preserves tenant context on product links. Escape restores the appropriate visible search trigger; ArrowDown/Enter moves into the results; outside click and navigation close the field. Reduced-motion preference disables the slide transition.

The compact dropdown is anchored below the corner button and bounded to the viewport. It retains destinations, expandable product categories, language, and account actions, with configured dropdown background/radius/type styling. The Search & Discover preset uses the same compact category treatment as the other presets, keeping mobile search in the header. Its full desktop preset remains unchanged. Compact language controls now inherit dropdown text color instead of header text color.

## Verification

Real tenant reads, local source: `/produkt/standard-sales-mapper-kopi-2?force_domain=salgsmapper.dk` at port 8161 in the isolated release worktree.

- 1440, 1280, 1024, 768, 390, and 320px: 72px one-row header, no page overflow or group overlap; no exposed search field before activation.
- Search opened/closed at all six widths: field bounds remain entirely inside the header; input receives focus; mode stays stable.
- Current centered Salgsmapper labels: desktop at 1018px, compact at 1016px; remains compact at 1034px and returns to desktop at 1036px. This is measured behavior for this branding, not a new fixed breakpoint.
- Real catalog search, ArrowDown to product result, Escape focus restoration, navigation to UV spotlak and back to Standard Salgsmapper, retained `force_domain`.
- Nine approved menu presets checked in read-only local fixtures at phone width; menu links remain accessible and there is no duplicate search field in the compact dropdown. No settings are saved by these fixtures.
- Precise and Glassmorphism theme fixtures; long logo and navigation labels, centered navigation, 22px menu font: compact mode at 1440px; readable wrapping within the expanded 320px menu and no overflow.
- Final local browser error log empty.
- 92 layout/branding tests pass. TypeScript has 0 errors. Frontend health gate passes with 0 lint regressions against the existing 1970 errors/156 warnings baseline.
- Production build passes (existing large-chunk and mixed-import warnings).

Local screenshots and structured measurements are in the original checkout's ignored `output/header-fit-search-2026-09-29/`. Fixtures live only in the release worktree's ignored `tmp/header-review/`.

No database, pricing, template, upload, or tenant-branding writes are part of this change. Authenticated account flows were preserved but not exercised. Rollback: revert this header commit/redeploy the previous frontend; no data rollback is required.
