# Brochure: automatic shared matrix — local QA, 23 October 2026

The real unpublished brochure preview now renders the same `PriceMatrix` as other products. Visible paper rows request prices automatically; customers no longer press “Hent priser” for each paper. Existing quantity navigation, keyboard selection, brand styling and matrix customization are reused. Search and “Vis flere papirtyper” remain available; newly shown rows load automatically.

Local route: `http://127.0.0.1:8933/brochure-shop-preview?tenantId=00000000-0000-0000-0000-000000000000`.

## Scope and pricing authority

- `BrochureFreeSizeMatrix.tsx` now presents exact quotes through the shared matrix; its bespoke table was removed.
- `brochureQuoteLoader.ts` delivers existing quotes with a maximum of two active requests, exact identity cache keys, pending-request deduplication, cancellation of queued subscriptions and a five-minute successful-result cache. Started work completes before its slot is released because aborting a browser fetch would not cancel supplier work on the server. Errors are retryable; no automatic retry loop.
- `PriceMatrix.tsx` only gained an optional accessible row label callback. Its price computation body, rounding, extras and navigation logic are byte-identical to the saved before-copy. The parent passes through the existing matrix styling configuration.
- No endpoint, supplier adapter, conversion rule, exact-quote guard, quantity interpolation, source registry, stored price, checkout or designer changes. Missing source tiers remain disabled. Changing dimensions/page count clears the previous quote and selection immediately.
- No payment, order submission, hosted writes or deployment. The existing quote endpoint still performs its existing read-only supplier requests; “local” describes the preview and implementation, not an offline pricing database.

## Verification

- Existing listener PID 18597 owns loopback port 8933 from this checkout. The preview rendered successfully in the user's separate in-app browser session.
- Five focused tests pass: exact sparse native tiers/guard, malformed price rejection, two-request concurrency/deduplication/cache identity, cancelled queued work retaining active server slots, immediate error retry and cache expiry.
- TypeScript passes. New component/loader/test lint passes. Comparing touched shared files against the before-copies finds no added lint errors: the large parent already has 30 `no-explicit-any` errors; PriceMatrix has zero errors and its pre-existing hooks warning. Whole-repository lint is not claimed clean.
- Production build passes into a new evidence directory, preserving existing `dist`; existing large-chunk warnings remain.
- Browser: automatic row prices without normal “Hent priser” buttons; quantity navigation; mouse selection; ArrowLeft/ArrowRight; 100 copies of 90g matte content/cover at 148 × 210 mm, eight pages remains **944 DKK net**; standard delivery summary **993 DKK net**. Local multiple-design button becomes enabled, normal order submission remains disabled.
- Invalid width 97 mm clears prices/selection and shows validation. Restoring 148 mm reloads exact quotes. Switching page count clears prior prices before another quote; this is invalidation proof, not acceptance of every supported page count.
- Widths 1440, 1280, 1024, 768, 390 and 320 checked with screenshots and DOM measurements. Page scroll width equals viewport width at each. Narrow matrices retain their existing internal horizontal scrolling. Temporary viewport override reset; header/preset/branding unchanged. No browser console errors captured.
- Eleven protected pricing, designer, approval, tax and checkout file hashes match the before-copies. Existing brochures and browser storage were not edited or cleared during this task.

## Supplier limitation observed

Four of the first twelve eight-page paper combinations returned “Leverandørens prisservice kunne ikke svare. Prøv igen.” (90g/115g content, matte/gloss, plain 250g cover). Retrying 90g matte / 250g matte alone returned the same error. They remain disabled with an explicit retry control. This does not establish the underlying supplier failure cause or prove it pre-existed this UI change. UV cover rows also have no source tiers at small quantities; those are unavailable cells rather than failed quotes. No prices were substituted or invented. All paper/page/dimension combinations have not been certified.

## Evidence and rollback

`output/brochure-shared-matrix-2026-10-23/` contains before-copies, protected hashes, focused tests/lint/typecheck/build logs, lint baseline comparison, browser DOM, selection proof, responsive measurements and screenshots. The separate copied brochure workspace remains open and unchanged.

Rollback only this slice using its before-copies for the three matrix components and scoped brochure CSS; remove the new loader/test if unused. Preserve all unrelated dirty worktree changes and the IndexedDB v2 approval implementation. No database or deployment rollback is required.
