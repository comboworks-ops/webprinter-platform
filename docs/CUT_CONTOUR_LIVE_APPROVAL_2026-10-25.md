# Live CutContour approval verification — 25 October 2026

Result: PASS on live Webprinter, using the normal product → designer → checkout flow. Synthetic artwork extending beyond the circular cut line can be approved after accepting the placement responsibility warning.

## Scenario and observed behavior

- Product: https://www.webprinter.dk/produkt/gulvfolie, Runde og særlige former → Rund, diameter 30 cm, Indoor · 120 µ.
- The normal Design action opened the order designer with `requiresCutContour=1`, a fixed circular CutContour and the product PDF template. Finished size 300 × 300 mm, bleed 3 mm.
- Added a blue rectangle and extended it across the circular CutContour and left bleed boundary; the fixed cut line remained unchanged.
- Designer preflight showed `Objekt tæt på kanten` and `Objekt rækker uden for bleed`. The latter explicitly permits intentional edge/CutContour placement after approval. No technical contour error blocked export.
- Returned through `Fortsæt til checkout`; the generated Designer-PDF reached https://www.webprinter.dk/checkout/konfigurer with both original warnings and `Afventer godkendelse`.
- Before acknowledging responsibility, `Godkend fil og fortsæt` was disabled. Checking the displayed responsibility checkbox enabled it.
- Clicking it succeeded: `Fil godkendt. Du kan nu færdiggøre din bestilling.`, `Din trykfil er godkendt`, and the preview marked `GODKENDT`. The blue rectangle still visibly crossed the magenta circular cut line.

No contact information was entered, no payment was attempted, and no order/supplier/production submission was made. This is live browser approval evidence for one round CutContour product, not physical production acceptance or a separate test of every tenant/product.

## Export inspection

A separate Print PDF export from the same live canvas was downloaded and retained as `output/cut-contour-live-approval-2026-10-25/live-cut-contour-export.pdf`. It is not claimed to be byte-identical to the checkout artifact.

- SHA-256: `6dc773c7e989601880519df5185e2402aa66976ada780465c6133b82230054b6`.
- One page, 306 × 306 mm media box, 300 × 300 mm trim box.
- Existing `inspectPdfCutContours` returned `{ "paths": 1, "valid": true }`.
- `/Separation /CutContour` spot color and stroke overprint present; nonprinting template optional-content layers omitted.
- Render inspected: blue artwork crosses the magenta circular path.

The extra export initially stalled behind a native confirmation dialog. The dialog was recovered and the download verified before continuing; the stalled attempt alone was not counted as a pass. No application changes or new deployment were required for this test.

## Retained evidence

`output/cut-contour-live-approval-2026-10-25/` contains designer warnings (text/screenshot), checkout before acknowledgement, checkbox accepted/enabled state, approved checkout text/full-page screenshot, compact `approved-artwork.jpg`, the downloaded PDF/render, and JSON inspection results. The live approved checkout tab is retained for review.
