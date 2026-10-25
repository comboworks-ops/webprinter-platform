# Print quality warning overrides — 25 October 2026

The user requested overridable cropping/low-resolution warnings with a clear
responsibility acknowledgement and product-specific DPI recommendations.
Status: LIVE on Webprinter, Online Tryksager, Salgsmapper, PVCbanner and both
general shop addresses. Local and live warning-override QA pass; release
receipts and precise verification scope are recorded below.

## Policy and behavior

- Small print, including flyers and business cards: 300 DPI.
- Wide format below 6 m² per item: 150 DPI.
- Wide format from 6 m² per item: 100 DPI. Six m² is the conservative threshold
  selected from the user's “five, six square metres” direction. Quantity never
  lowers the recommendation. Category/pricing type/designer mode identify wide
  format; physical size alone never reclassifies a flyer.
- Even very low DPI is an overridable warning rather than a designer export
  error. Required CutContour validity checks and production geometry/hash
  checks remain. No automatic contour creation, vector flattening or waived
  production requirements were added.
- Effective raster resolution uses actual pixels and placed physical size.
  PDF-page render pixels are not represented as source-image DPI.
- Both checkout approval locations share the same responsibility checkbox and
  action guard. File, placement, warning or recommendation changes clear its
  acceptance. Accepted notes follow the generated PDF's hash and remain visible
  after PDF conversion/reload; the existing order status note carries them.
  This is customer acknowledgement metadata, not a server preflight certificate.
- The full designer carries its freshly checked quality warnings into checkout,
  including inactive linked-page drafts. A standalone PDF download requests
  explicit confirmation of warnings. Existing required contour validation is
  unchanged. The separate local brochure workspace also benefits from advisory
  DPI checks; its local-only integration is excluded from production patches.

## Verification

25 focused tests pass: policy boundaries, true placed DPI, very low DPI,
cropping/CutContour artwork handling, acceptance invalidation, exact output-hash
order notes, original image-to-PDF approval and tenant/product isolation.
Root application TypeScript and production build pass; new files are lint-clean.
Modified files retain only their pre-existing lint findings, with zero added
messages in normalized before/after comparison.

Normal local frontend → live private file service testing used only a synthetic
1200 × 1800 PNG. An A5 flyer was enlarged to approximately 162 DPI and crossed
the page edge. Approval remained disabled until responsibility acceptance;
a subsequent real artwork move cleared acceptance and disabled approval again.
Reacceptance created an approved print PDF and retained the original quality
notes. No contact data, payment or order submission was entered. One browser
file chooser stalled for a long period before completing; no duplicate upload
was started. Screenshots and rendered text are retained in the evidence folder.

Evidence: `output/print-warning-overrides-2026-10-25/`. The six changed runtime
files and four new policy/component/test files are inventoried in `scope.json`.
No pricing calculation, database schema, Edge Function, tenant setting,
authorization or publishing-flow change is included.

## Production release and rollback plan (before staging)

Each candidate is reconstructed from the exact just-released live source:

| Group | Previous live deployment for rollback |
| --- | --- |
| Webprinter | `dpl_FyGCWspQHBCoN1VGK3sBqXab3hEe` |
| Online | `dpl_5ri29SvhCBS2aSNT1huwG3FJakpj` |
| PVC / Salgsmapper | `dpl_EMnZ1n2KKNyVCKtHyWZ3AfoJTFWU` |
| General shop address | `dpl_BTWMmBA8qjaHevYcaZe49a5udGGM` |

Use production builds with `--skip-domain`, then verify uploaded source hashes
and compiled acknowledgement code. Assign only the same ten shop aliases in
the cohort inventory after checking for concurrent releases. Preserve all
redirects and the other 26 aliases; never globally promote this split project.

Rollback after checking for subsequent releases: restore only each cohort's
listed shop aliases to the prior deployment above, retaining redirects and QA
uploads. Keep recorded customer acknowledgements in orders; no database rollback
or file deletion is required. The prior image-approval validator fix remains in
every rollback baseline. Do not reset the dirty repository.

## Final release receipt

| Group | New live deployment | Verified source files | Served entry |
| --- | --- | ---: | --- |
| Webprinter | `dpl_4mwJcwxLzGhnr7BwJK2h9wAS7tCf` | 1,869 | `/assets/index-DptrWqKY.js` |
| Online | `dpl_GR1aWoZzcUkNa9cNfRxYxE1v9CwY` | 1,862 | `/assets/index-CCBx-CiP.js` |
| PVC / Salgsmapper | `dpl_F8vPETPN98RU2tiz3ZMBMFUtCyXJ` | 1,866 | `/assets/index-CbbuGHNs.js` |
| General shop address | `dpl_EpMu6gNQNwjYiQ8ZERcjuEydNa71` | 2,724 | `/assets/index-CfHWoW4O.js` |

All 8,321 uploaded source hashes match the isolated candidate manifests. Each
contains only the six scoped modifications and four additions; all other
source, pricing, API, dependency/configuration and branding files retain their
exact live baseline hashes. All four cloud production builds pass. The 25
focused tests pass in each of the four candidates (100 candidate tests total).
The root and general candidate pass TypeScript. The other three candidates
retain the same five previously recorded missing roll-label test-helper module
diagnostics; no new diagnostics. No root dirty-worktree release was made.

All ten intended shop aliases now serve the verified entry and exact compiled
policy/helper hashes. All 36 alias mappings were checked: 26 other aliases and
every redirect/status remain unchanged. The bounded last-hour Vercel runtime
error query returned zero entries for each new deployment, with all commands
successful. Continuous monitoring/drains and Supabase runtime logs were not
separately audited.

Normal LIVE Online Tryksager checkout additionally passes the exact warning
scenario: an A5 flyer image enlarged to 151 DPI, extending beyond the page.
The approval button was disabled before acknowledgement, then explicit
responsibility acceptance generated an approved print PDF. The full resolution
and cropping warning text remained available. Evidence:
`live-browser-verification.json`, `live-warning-accepted.jpg`, `live-approved.jpg`
and `live-approved.txt`. Other shops have source/compiled-code/route acceptance
for this refinement; their original non-A4 upload approvals were exercised in
the preceding release, not repeated as this update's live interaction tests.
No actual order, payment, supplier submission or order-record write was tested.
The future order status note binding is covered by the unit tests and existing
server contract, not a paid-order acceptance claim. PDF-internal raster DPI is
not automatically measured by this change.

Stable responsive measurements confirm 1440, 390 and 320 px; responsibility text
fits the two narrow widths (342 and 272 px respectively). Intermediate widths
were captured during an existing CSS resize transition and are retained only
as transient evidence, not stable-width acceptance. Viewport overrides were
reset. No new browser errors occurred in the inspected local preview.

No dependency/lockfile change. Fresh read-only npm Bulk Advisory lookup returns
the same existing baseline: 19 packages with advisories (2 critical, 32 high,
17 moderate, 5 low advisory entries), not a clean audit or npm remediation graph.
No dependency upgrade was included in this release.
