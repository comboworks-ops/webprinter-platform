# Product page readability — 21 September 2026

Small visual adjustment requested by Thomas: the option buttons and information beside the large product image looked too small relative to the rest of the page.

Changed only the shared CSS in `orderFlowDesigns.css` and `productWorkspaceCustomer.css`:

- Option text and labels: 12 → 14 px; option buttons: 34 → 44 px minimum height with more padding.
- Size inputs/selects: 16 px text and 44 px minimum height. Checkbox/radio controls are excluded from this text-input sizing rule.
- Delivery labels: 14 px; supporting delivery text: 12 px; compact configuration details: 13 px.
- Main order actions have a 46 px minimum and can grow/wrap; existing larger authored button styling still applies.
- Group headings: 15 px; supporting source/production labels: 13 px.

Images, layout choice, tenant colors and pricing/order logic were not changed. The CSS is shared by the customer page and the existing actual-page preview renderer.

Browser checks used the normal backend-connected local application at `http://127.0.0.1:8113/produkt/aluminium?widthCm=100&heightCm=100&qty=1`, plus the separately isolated synthetic Foldere page on port 8112. The connected page rendered its real published product/options without login. Selecting white print changed the product price from 436 to 585 kr.; restoring Ingen restored 436 kr. On the synthetic matrix page A5 changed 240 to 270 kr.; A4 was restored. No order, upload or data save was submitted.

Computed option text is 14 px, option height 44 px and input text 16 px. Connected-page document width equalled the viewport at 1440, 1280, 1024, 768, 390 and 320 px. Desktop and narrow mobile captures were inspected, and both example product types were reviewed. No error-level browser console entries were reported. This scope does not certify unrelated header behavior or a complete accessibility audit.

Scoped whitespace checks passed. A fresh production build could not be verified: both the normal build and a separate-output-directory build stalled before emitting output, and the independent Vite `--version` command also stalled. These task-owned attempts were stopped. Node itself reports v24.19.0 correctly; no dependency installation or unrelated build configuration change was attempted. Browser-served CSS was verified as described above. Build logs are in `tmp/product-page-readability-20260921/`. No implementation-mirroring CSS tests were added. Before-turn copies are under `tmp/product-page-readability-20260921/before/`; rollback only these CSS differences, preserving the repository's other changes. Local source change only; no deployment or hosted write.
