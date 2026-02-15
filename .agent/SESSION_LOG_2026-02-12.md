# Session Log — 2026-02-12

## Scope
- Build a safe `Sites` integration flow without touching core Webprinter logic.
- Add preview architecture for external UI shop frontends.
- Integrate provided ZIP exports as real visual bundles for per-site preview.

## Safety Boundary (Important)
- All work is isolated to preview/admin paths and static preview assets.
- No direct changes to pricing engine, checkout logic, POD logic, or protected designer core.
- Site bundles are mounted under `public/site-previews/<site-id>/` and loaded only in preview mode.

## What Was Implemented

### 1) `Sites` preview infrastructure
- Added preview session helpers:
  - `src/lib/preview/previewSession.ts`
  - Supports `tenantId`, `siteId`, `sitePreviewMode`, URL builder for `/preview-shop`.
- Added route guard to keep preview tabs inside `/preview-shop`:
  - `src/components/preview/PreviewRouteRedirect.tsx`
- Wired guard in app routes:
  - `src/App.tsx`
- Added site-preview mode in preview page:
  - `src/pages/PreviewShop.tsx`
  - Supports `sitePreview=1`, session fallback, and dedicated site preview rendering.

### 2) `Sites` admin integration
- Added/used `Sites` admin page:
  - `src/pages/admin/SitesAdmin.tsx`
- Preview link now routes through `buildPreviewShopUrl(...)` with `sitePreviewMode: true`.
- Added note in admin about preview bundles path.

### 3) Site preview renderer
- Added `SitePackagePreview`:
  - `src/components/sites/SitePackagePreview.tsx`
- Supports:
  - `mode: "iframe"` from manifest (preferred, real repo bundle look)
  - fallback visual mock when no manifest exists
- Looks for:
  - `public/site-previews/<site-id>/manifest.json`

### 4) Preview bundle docs
- Added runbook:
  - `docs/SITES_PREVIEW_BUNDLES.md`

## External Site Bundles Integrated

All below are mounted in `public/site-previews/<site-id>/` with:
- `index.html`
- `assets/*`
- `manifest.json` (iframe mode, hash entry)

Integrated site IDs:
1. `vibe-prints-co`
2. `learning-landscapes-shop`
3. `art-canvas-studio`
4. `banner-builder-pro`
5. `print-pop`
6. `tee-design-hub`
7. `vibe-tees` (updated again from `vibe-tees-main (1).zip`)
8. `shopfront-designer`
9. `print-playground`
10. `snap-cherish`

Status notes:
- `snap-cherish` preview is now live from ZIP bundle.
- `print-pop` ZIP contains the default Lovable placeholder app (`Welcome to Your Blank App`), so preview is working but content is intentionally minimal until that repo gets real storefront pages.

## Compatibility Patches Applied During ZIP Build (in `/tmp/site-imports/*`, not core repo)

For ZIP projects that required it:
- `BrowserRouter` -> `HashRouter` so they render correctly under subpath previews.
- `framer-motion` aliased to a local shim for offline build compatibility.
- `zustand` aliased to a local shim for offline build compatibility (`snap-cherish`).
- Where needed, `fetch('/branding.json')` changed to base-aware path using `import.meta.env.BASE_URL`.

Note:
- These compatibility edits were applied to temporary extracted projects in `/tmp/site-imports/...`.
- The persisted output is the static build files copied into `public/site-previews/...`.

## Key Runtime Behavior

- `/admin/sites` -> `Preview` opens `/preview-shop?...&sitePreview=1`.
- `PreviewShop` routes to `SitePackagePreview` for site-specific preview mode.
- `SitePackagePreview` tries manifest first:
  - If manifest exists and `mode: "iframe"`, it loads the real site bundle via `<iframe>`.
  - Otherwise, it shows fallback mock preview.

## Known Console Noise / Non-blockers
- React DevTools suggestion message: informational.
- `platform_seo_*` 406 responses: unrelated to site bundle rendering.
- Vite warnings about chunk size and dynamic imports: pre-existing/non-blocking.

## Build / Validation
- Main app build (`npm run build`) passed repeatedly after these changes.
- Individual ZIP bundles built successfully and were copied to `public/site-previews/...`.

## Resume Checklist (Next Session)
1. Open `/admin/sites`.
2. Click `Preview` for each site.
3. If stale content appears:
   - close old preview tab
   - open new preview tab from admin
   - hard refresh (`Cmd+Shift+R`)
4. To add another site ZIP:
   - extract to `/tmp/site-imports/<folder>`
   - apply same compatibility patch pattern if needed
   - build with `--base=/site-previews/<site-id>/`
   - copy `dist/` to `public/site-previews/<site-id>/`
   - restore/create `manifest.json` (important after `rsync --delete`)

## Files Most Relevant for Continuation
- `src/components/sites/SitePackagePreview.tsx`
- `src/pages/PreviewShop.tsx`
- `src/components/preview/PreviewRouteRedirect.tsx`
- `src/lib/preview/previewSession.ts`
- `src/pages/admin/SitesAdmin.tsx`
- `docs/SITES_PREVIEW_BUNDLES.md`
- `public/site-previews/*/manifest.json`
