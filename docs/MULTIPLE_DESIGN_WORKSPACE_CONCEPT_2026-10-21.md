# Multiple-design workspace concept — 2026-10-21

Interactive review concept requested by Thomas. No application source, live pricing, product data, checkout, database or deployment changed in this work.

## Proposed customer flow

1. Keep the product's price matrix available above the workspace.
2. Show one card per design: artwork preview, name, revision, allocated quantity and status.
3. Open an individual design in an editor, then review and approve that exact revision.
4. Show allocation mismatches immediately. Proceed only when quantities match the selected total and every design has content, passes checks and is approved.
5. Review the complete set before delivery and payment.

The example begins with three designs: approved, awaiting approval, and needing correction. It includes adding a design, editing template text and colour, correcting a sample safety-zone issue, equal quantity allocation, individual proof approval and a final order summary.

## Boundaries for implementation

- The example prices and file checks are simulated. The mockup is not a production preflight engine or the existing full designer.
- Shared quantities are appropriate only for products whose existing pricing and supplier rules already allow multiple designs in one quantity tier. This concept does not authorize pooling quantities where each design must be priced separately, or ignoring per-design charges/minimums.
- All designs in the demonstrated group share product, dimensions, stock, print sides and finishing. A different specification requires a separately priced group using existing rules.
- A saved artwork change creates a revision and invalidates only that design's approval. Quantity redistribution retains artwork approvals. A shared specification change requires new approvals.
- Production approval must bind to the actual artwork revision, specification and preflight result. The real product needs actual PDF/template validation, persistent customer/tenant ownership and checkout integration.
- A printable design is not evidence of payment or production acceptance.
- Books and contour-cut products should use their appropriate editors and validation, while sharing this overview and approval pattern.

## Local browser verification

Verified in the standalone sandboxed preview:

- Editing quantity immediately displayed an over-allocation warning while the example total price stayed 1,290 kr.
- Equal allocation produced 334 / 333 / 333 for 1,000 units and retained approvals.
- Individual approval changed the ready count; correcting the unsafe design created version 2 and required approval.
- All three approved designs with matching quantities enabled the order summary with the same example price.
- Editing the approved first design created version 3 and left the other two approved (2 of 3 ready).
- Selecting 2,000 units retained allocations and approvals, showing the missing allocation; equal distribution resolved it.
- Changing paper reset all artwork approvals.
- Adding a design displayed missing content and zero quantity, blocking continuation.
- Mobile overview and editor were inspected at a 320 px browser width; no document-wide horizontal overflow. The matrix retains its own horizontal scroll. Temporary viewport override was reset.
- No browser console errors were reported during the checks.

Preview: `output/system-assessment-2026-10-21/design-workspace-preview.html` (generated from the conversation's inline source). The preview uses local example state only. The inline source is in the thread's authorized visualization directory as `design-workspace.html`.
