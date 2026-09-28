# Saved design propagation — 27 September 2026

Follow-up after implementing the four connected shopping journeys. The user asked to take the next step; this check covers selecting a standard design in the real Site Designer, saving and reloading its draft, then publishing it to an isolated store and following the normal customer routes.

## Result

- All four designs were selected using the actual `PrintDesignPicker` inside `SiteDesignEditorV2`.
- Each draft was saved through `createTenantAdapter` and its existing compare-and-swap persistence path. Reloading the editor retained the selected design.
- With Everyday Gifts saved as an unpublished draft, the customer catalogue still rendered `print-familiar`. Draft saving did not publish the design.
- The actual publication dialog and adapter published each design to browser-local fixture storage. No query parameter or fixture theme override supplied the customer design.
- Sixteen route checks passed: four designs × homepage, catalogue, ordering and checkout. Product-card clicks opened the real product page; its primary action opened the real checkout with the matching journey attribute.
- The final browser error-log checks returned no application errors. The 19 recorded production source files match the tested snapshot. No production source edits were necessary during this follow-up.

## Environment and evidence

The temporary server is `http://127.0.0.1:8144`, served from `/private/tmp/print-journey-acceptance-20260927/app`. The actual editor component is mounted at `/__journey-editor`; customer pages use the normal application routes. The backend client is replaced by a local fixture: product data is synthetic, allowed branding writes go only to browser local storage, and all other writes throw. The server rejects mutation HTTP requests and `/api/` calls. The final CSP restricts external scripts, frames and connections; no credentials are copied into this fixture.

Evidence: `output/print-journey-acceptance-2026-09-27/` contains the fixture, source hashes, route results, screenshots and editor capture. The existing 8143 comparison and original user tabs/drafts were left unchanged. Browser tests used separate temporary tabs.

This confirms the frontend editor-to-storefront path against an isolated backend contract. Hosted compare-and-swap permissions, live tenant publication, real uploads, payment and production fulfillment were not exercised. There was no deployment or hosted data change. Existing visual/build evidence remains in `docs/PRINT_JOURNEY_QA_2026-09-27.md`.
