# Banner size controls — 27 September 2026

The user identified overlapping width, height and area controls in the Format / Signage ordering screenshot. This was a real shared-component layout defect, not an image-generation problem.

## Cause and fix

The selector `.order-calculator-controls > div:first-child > div` applied a `max-width:90px` intended for the wide-format header's small metadata group to the entire `CustomDimensionsCalculator` card. At 1280 px the card was 90 px wide, its grid columns had zero content width, and the inputs were only 26 px wide. The page itself did not overflow, so the earlier page/heading checks missed the internal collision.

The header and metadata now have explicit classes, keeping their rules away from dimension cards. Dimension fields respond to their container width: stacked in narrow panels, width/height together with area below in a sidebar, and three columns when there is enough room. Controls explicitly fill the available width when mobile columns use `display:contents`. The product/image section also fills its mobile row; the alternative layout wraps the image below the text before the heading becomes squeezed.

Only CSS and class names changed in the three production files. Dimension conversion, pricing, selection handlers and POD behavior were not edited.

## Verification

- Reproduced the original 90 px card and overlapping controls on the actual banner product route in the isolated 8143 review.
- 80 final browser cases passed: four new themes plus Refined Familiar × calculator designs 1 and 2 × widths 1440, 1280, 1024, 768, 701, 700, 390 and 320. Checks confirm the actual theme/layout, document width, field bounds, label/input intersections and title width.
- Entering 120 cm × 80 cm displayed 0.96 m². Tab from width focused height.
- App TypeScript and the final production build pass. The custom dimension component passes lint; the existing StorformatConfigurator baseline remains identical at 19 errors and 2 warnings. Build retains the existing large-chunk warning.
- Updated the comparison screenshots and corrected its ordering links to their corresponding example product slugs. The original faulty captures remain in the older evidence packet; the comparison now uses `print-signal-ordering-fixed-1280.png`.

Evidence and a precise three-file patch are in `output/banner-dimensions-fix-2026-09-27/`. Working source and the 8143 review copy match the recorded hashes; the isolated 8144 acceptance copy was also updated after matching its prior hashes. The normal workspace server reads the main source. The separate older 8113 draft environment was not reloaded or synchronized.

The corrected interactive review is `http://127.0.0.1:8143/produkt/bannere?tenantId=11111111-1111-4111-8111-111111111111&design=print-signal`. It still uses synthetic product and price data. No deployment, hosted save, upload or payment was performed.

Rollback: restore only the three recorded before files if their current hashes still equal this packet's candidate hashes. Preserve unrelated edits; no database rollback is needed.
