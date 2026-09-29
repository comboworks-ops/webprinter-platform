# Site color controls — release review, 29 September 2026

Branch: `codex/site-color-controls`, rebased onto released `main` 849ed438 (including sales-folder PRs #4–#6).
Review: http://127.0.0.1:8161/site-colors-review.html
Normal connected editor with this code: http://127.0.0.1:8161/admin/site-design-v2

## Problem and fix

The Farver panel and homepage reset changed legacy colors while enabled shared CTA/selection masters retained older colors. Stored gradient endpoints could also override newly chosen fills. Single color fields generally changed only the global token while explicit component fields remained unchanged.

`src/lib/branding/siteColors.ts` now owns the existing palette mapping. Both individual roles and complete palettes update the matching component fields and enabled shared button masters. Single-role edits preserve unrelated styling; CTA colors also reach every featured-product slide. Explicit local button locks and saved banks survive ordinary color edits.

Farver exposes all ten roles, including background, dropdown and hover. Its preset collection is collapsible, controls have accessible names, and single-column cards fit the narrow inspector. The color-only reset explains its scope and optionally releases local locks. The full standard-design reset clears colors and local locks, retaining saved banks. Both remain undoable draft operations using the existing persistence and publication paths.

## Verified

- Regression tests reproduced stale master/reset behavior before the fix.
- 81 branding tests pass, including color role propagation, gradients, masters, local locks, later featured slides, content/layout preservation and undo.
- TypeScript: zero errors. Frontend health gate: zero lint regressions against existing debt (1970 errors / 156 warnings).
- Production build passes; existing chunk-size/mixed-import warnings remain.
- Browser: real SiteDesignEditorV2 with local-only adapter; individual green primary color reaches storefront CTA, survives Save draft/reload; palette changes both normal/hover; reset, optional unlock, undo/redo and full standard reset verified.
- 390px storefront preview: body/client width both 390px, no horizontal overflow. No browser console errors observed.

## Storefront color precedence

Order layouts now leave matrix selected colors and primary/secondary button colors to their existing configurable component styles. The forced matrix blue and fixed button colors were removed. Compact order buttons use their configured normal/hover variables because that renderer returns before the legacy inline stylesheet. Order accent colors use the exact tenant primary token, declared on the same storefront frame as the order rules; matrix borders use the configured border color. Layout dimensions and pricing are unchanged.

A read-only real-product review verified the proposed Salgsmapper palette (#087FC5, pale-blue #EFF6FC) plus an alternate purple palette (#6B21A8, #F3E8FF). Matrix selection/header, option buttons, header sign-in and the exact order-button surface all follow the selected palette. The proposed live settings repair changes only color leaves in the product matrix, option selectors, order buttons, price panel, header CTA and global hover. It preserves layout, content, media, history and saved designs, and uses a fingerprint guard before applying. Evidence/backup/rollback: original checkout `output/site-color-release-2026-09-29/`.

## Boundaries

The review adapter saves only under browser key `webprinter:site-colors-review:v1`; publishing and asset operations are disabled. The local adapter never changes live branding. Production activation is separately recorded in the release receipt. Products, prices, Supabase schemas and tenant scope are outside this change.

The original checkout contains additional edits to SiteDesignEditorV2.tsx; this branch has not been copied over that file. Reconcile those edits before integrating this branch. Do not replace user drafts or reload their original editor tabs.

The root HTML review entry and src/dev entry are development-only; the production build still uses index.html. Rollback consists of reverting the color-control changes; no migration or database rollback is needed.
