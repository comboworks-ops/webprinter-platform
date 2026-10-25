# Brochure papers presented directly — local QA

23 October 2026. The brochure no longer asks customers to search for paper. It presents the paper/cover combinations directly in the existing shared price matrix. The initial twelve-row limit and “Vis flere papirtyper” control are removed; every configured paper is checked automatically for the selected size/page count through the unchanged two-request quote queue.

Only the native protocol's confirmed missing-price-table response omits a row. Pending rows remain labelled while loading; transient or unknown failures remain disabled and retryable, rather than being mistaken for unavailable paper. Sparse quantity tiers stay blank. A selection/dimension change still clears old prices and starts checks for the new configuration. No catalogue values were removed.

## Actual coverage

- Current eight-page brochure at 148 × 210 mm: all **26** configured paper combinations checked, **20** presented with exact source quotes, no pending rows or retry errors remaining.
- Six plain 250g cover combinations are omitted: native IDs 282596, 282600, 282602, 282606, 282608 and 282612 (90g/115g/135g content, glossy and matte). The last two were outside the previous initial twelve rows. They produce the same confirmed unavailable response; no substitute price was used.
- Every presented row has a selectable native price in the 250/300/500/750 quantity window. There are 70 valid cells and 10 unavailable source tiers; no interpolation or new quantities.
- Existing 90g matte content/cover, 100 copies remains **944 DKK net**, **993 DKK net** with standard delivery. Local multi-design navigation remains enabled after selection; order submission remains disabled.
- No paper search or show-more control. Global product search is unchanged.
- Desktop/tablet/mobile screenshots and no-page-overflow measurements at 1440, 1280, 1024, 768, 390 and 320 pixels. Shared internal matrix scrolling retained; viewport override reset. No browser console errors captured.
- Twenty existing focused quote/conversion/checkout/queue tests, scoped lint and TypeScript pass. No tests added to mirror this reversible presentation change.
- Production build passes into a separate evidence directory, preserving existing `dist`. It took 14m 24s on this run; the existing bundle-size, Browserslist and lcms-wasm browser-compatibility warnings remain. No pricing or presentation repair was needed during compilation.
- Ten protected shared matrix, parent, pricing, supplier/API, loader, style and checkout/designer files are byte-identical to before this slice. Only the brochure presentation component changed.

This is not an exhaustive product scan across every size and page count. Those are checked on selection. No payment, order submission, hosted data writes or deployment. Existing browser brochure workspaces and approvals were not edited or cleared.

Evidence and the before-copy are in `output/brochure-paper-list-2026-10-23/`. Rollback this component only using its before-copy; preserve all unrelated dirty worktree changes, pricing and browser data.
