# Layout harmony — 8 September 2026

## Result and scope

Local implementation of the requested stable layout rules across the shared storefront, customer account, ordering, platform and admin surfaces. Existing selected presets and tenant font/color settings are preserved. This is visual and interaction verification of shared components and representative routes, not a claim that every authenticated screen or tenant has been tested.

The reusable project skill is `.agent/skills/ui-layout-consistency/SKILL.md`, linked from `AGENTS.md`. Shared spacing, gutter, text-measure and fluid heading roles live in `src/styles/layoutRhythm.css`. Existing scoped styles consume these roles; there is no global heading reset over the designer or price matrix.

## Implemented behavior

- Storefront, customer, platform feature and platform landing headers measure the natural logo/navigation/action widths. Desktop labels cannot wrap or shrink. A compact menu appears below 1200px, or earlier if the content needs it. Centered navigation reserves both sides; a small release margin avoids oscillation near the threshold. Hidden measuring groups are inert.
- Compact menus retain their destinations and support Escape. Storefront and customer menus include search; customer account and webshop navigation remain separately accessible. Tenant query context is preserved.
- Admin's eight fixed menu groups use a vertical compact menu below 1200px. Desktop labels stay on one line; compact group targets are 48px.
- Shared gutters, regular section gaps, fluid headings and safe dynamic text wrapping improve the account, storefront, product/checkout, platform landing and nine platform feature/contact/legal pages. Dense matrix and designer internals retain their existing presentation.
- Removed header CTA lift, dropdown hover enlargement, storefront category lift, landing button lift and the enlarged highlighted platform pricing card. Color/border feedback remains.

## Browser evidence

Vite port `127.0.0.1:8110`, PID 14798, was checked against this checkout. CUA inspected rendered DOM, geometry, screenshots, menus and console errors. Account, admin and payment/confirmation fixtures use real shared presentation components with clearly labelled example data. Product/catalog/checkout and platform checks use actual local routes and ordinary reads.

| Surface | Widths checked | Result |
| --- | --- | --- |
| Storefront and shared header | 1440, 1280, 1200, 1199, 1024, 768, 390, 320 | One-line desktop labels; compact fallback; no page overflow. Final shared gutters can make the default demo header compact at 1280. |
| Platform landing | 1440, 1280, 1200, 1199, 1024, 768, 640, 390, 320 | One-line header, compact menu, smooth hero scale; no page overflow. |
| Platform feature header via `/priser` | 1440, 1280, 1200, 1199, 1024, 768, 390, 320 | Desktop/compact switch and all feature links retained. |
| Customer overview | 1440, 1280, 1200, 1199, 1024, 768, 390, 320 | Account title scales 32–48px; controls wrap; no page overflow. |
| Long tenant labels, 22px centered menu | 1800, 1440, 1280, 1200, 1024, 768, 390, 320 | Compact navigation prevents collisions even on a wide viewport. Long labels remain readable in expanded menu. |
| Long account/product/email text | 1440, 1280, 1200, 1024, 768, 390, 320 | Stress test found an unbroken product name overflowing the attention row. Scoped wrapping fixed it; final 390/320 checks pass. |
| Aluminium product | 1440, 1280, 1200, 1024, 768, 390, 320 | No page overflow; existing matrix horizontal scrolling remains contained. |
| Checkout configuration | 1440, 1280, 1024, 768, 390, 320 | Heading/field layout fits; mobile inputs are 16px. Payment stays disabled with incomplete details and no file. |
| Payment preview | 1440, 1024, 768, 390, 320 | Fluid 32–52px title; settled phone dialog fits and scrolls vertically. Fields remain disabled example controls. |
| Confirmation preview | 1440, 320 | Fluid title and contained receipt layout. |
| Actual admin navigation in a local fixture | 1200, 1199, 390 | Eight master groups fit at 1200 with approximately 132px spare; compact list/dropdowns work. |

Interaction checks: storefront compact search for `aluminium` reaches `/produkter?q=aluminium&tenantId=00000000-0000-0000-0000-000000000000`; Escape closes public/customer menus and restores toggle focus; the account menu opens Orders and closes; admin Products navigation preserves `force_domain` and closes. Changing fixture content from standard to long at 1440 switches desktop to compact without reloading. No application console errors in these checks.

Final resize review also fixed expandable desktop search changing header width and focus inside a portalled dropdown being lost during collapse. The alternative search fixture (`?view=storefront&labels=standard&search=popover`) confirms the action group stays 332px before/after opening search. Escape returns to Search; resizing to tablet focuses the compact toggle. Resizing the real open Products dropdown from 1440 to 1024 closes it and focuses the toggle. The final default storefront has approximately 27px between each group at 1320px and switches to compact at 1300px when shrinking.

Main evidence: `output/layout-harmony-2026-09-08/`. The standalone stress fixture is `index.html`; admin fixture and screenshots are in `output/design-exploration/layout-harmony-2026-09-08/`. Geometry captured immediately during viewport resizing can reflect an intermediate render; final screenshots and settled measurements determine the result.

## Source verification and boundaries

- Four focused header-fit tests pass: tablet cutoff, content overflow, centered clearance and release margin/invalid measurements.
- New helper/hook/fixture, platform headers and platform page scoped ESLint pass. Final app TypeScript reports 423 existing diagnostics, matching the recorded local baseline; no diagnostics in the new fit helper/hook/fixture, AccountShell, changed platform headers or platform pages. A missing required `phone` field in the new synthetic profile was caught and fixed during final validation. Existing Header taxonomy casts and legacy lint diagnostics remain outside this presentation change.
- Production Vite build passes; existing large-chunk warnings remain.
- Skill frontmatter/name/description constraints pass using the existing `js-yaml` dependency. The supplied Python validator could not run because PyYAML is absent; no dependency or lockfile changes were made for validation.
- No hosted save, deployment, payment, customer message, file upload, pricing change, tenant-scoping change or database migration is part of this layout work. Authenticated platform/account variations, physical iOS behavior and a full accessibility audit remain unverified.

Rollback is limited to this task's shared layout stylesheet/import, fit hook/helper/header changes, scoped CSS changes and platform root classes. Preserve the pre-existing dirty worktree and prior customer-account work; do not use a whole-file Git restore as a rollback.
