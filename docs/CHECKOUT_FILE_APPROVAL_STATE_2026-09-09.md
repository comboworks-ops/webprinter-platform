# Checkout file approval state — 9 September 2026

The user reported that `/checkout/konfigurer` showed “Filen ser klar ud” and
“Godkend fil” while the upload area was empty. Reproduced on the existing
Aluminium Skilte checkout, 100 × 100 cm / 4 pieces, on localhost 8110.

The quick-approval condition only checked pending approval and absence of
reported issues. With no upload, both conditions were true. The approval
handler/payment gates already rejected the absent production artifact, but the
summary falsely advertised a ready file.

`src/lib/checkout/proofAvailability.ts` now derives review/approval availability
from the current file, preview and processing state. Quick approval also
requires a local check (or an existing Designer production export), no issues,
and no required production-file export. The page uses it for both quick-approval
buttons, the summary review notice, proof-dialog approval, and the handler.
Restored uploads without a check result retain manual review and display a
neutral “not checked in this session” message. Valid Designer approval and the
existing silent POD server-check policy are preserved.

Validation: five availability regressions plus five production-artifact tests
pass; new helper/test lint passes. Browser verification of the actual checkout
shows the empty upload area with no ready card, no approval/review controls,
and disabled payment. Existing product, quantity, price and delivery remain
2643 + 129 = 2772 kr. An intermediate hot-reload error while the new import was
being applied was resolved; final verification uses a fresh page load.
The final production build passed in 10.07 seconds with existing dependency
and bundle warnings; no new browser errors occurred after the final reload.

No files were uploaded, approved, purchased or sent to a supplier. No backend
data, pricing, payment implementation, protected preflight rules or deployment
was changed. Existing dirty worktree and pending release conditions remain.
