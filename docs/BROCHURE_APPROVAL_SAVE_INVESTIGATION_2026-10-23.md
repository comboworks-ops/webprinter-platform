# Local brochure approval save investigation — 23 October 2026

The local storage failure is reproduced and classified as an IndexedDB **commit/QuotaExceededError**. The underlying Chrome resource/quota condition remains unresolved. This investigation improves diagnostics and approval recovery; it does not claim to eliminate native storage failures.

## Confirmed observations

- The original approval error discarded the native exception and showed the same storage-space suggestion for every transaction error. The approval click also returned to the design list even after a failed save.
- Source code rewrites the complete workspace on approval, including both editor snapshots and exported PDFs. The source PDFs are 10,966,713 and 10,963,291 bytes. Snapshot JSON lengths are 13,187,681 and 13,173,629 characters; previews are approximately 11 KB each. Approval changes only a small revision field but currently serializes all this data again.
- Two attempts to seed a complete separate database copy failed naturally. No error injection was active. Earlier instrumentation identified `fixture-seed`; later request/commit probes established that requests could succeed before the transaction aborted.
- In one payload probe, metadata, PDFs alone and snapshots alone committed; the full record did not. In a second probe, metadata, PDFs alone, previews alone and one complete design committed. Both snapshots, the full two-design record and the same record with newly created PDF blobs failed. A later reduced-record seed also failed. This rules out a claim that there is a proven fixed per-record size threshold or that simply recreating blobs fixes the problem.
- The updated **actual application transaction helper** attempted the complete source record against two retained isolated databases. Both native transactions aborted with `commit/QuotaExceededError`. Both previous fixture records were preserved, including their PDF/snapshot/quantity/approval fingerprints. Original workspace readback was unchanged.
- Initial browser estimate: 295,161,887 bytes used / 11,032,580,127 bytes quota. Later estimate after retained test writes: 345,836,346 / 11,083,254,586. Persistence was false; no persistence permission was requested. Filesystem reported 68 GiB available. Reported headroom therefore does not establish which internal browser limit failed. [Storage estimates are approximate](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#how_to_check_the_available_space).
- The failed transaction behavior is consistent with the [IndexedDB commit contract](https://www.w3.org/TR/IndexedDB/#commit-transaction): outstanding requests and final commit are separate stages, and a commit error aborts the transaction.

The historic one-off approval did not preserve its native error, so its exact cause cannot be proven retrospectively. The current native reproductions establish the same relevant write-path failure mechanism, not a retrospective browser error log.

## Local changes made

- Extracted the existing atomic read/modify/write operation into `localWorkspaceTransaction.ts`. Success still requires `transaction.oncomplete`; rejection waits for abort rather than reporting a request as a committed save. No retries, alternate database, format conversion, approval bypass or schema change was introduced.
- Preserved the failing stage and allowlisted native error name. Read, write, transaction setup and commit failures are distinguishable. Original validation errors (including stale approvals) remain unchanged. Console diagnostics contain only stage and code; no source artwork, PDF, names, addresses or raw exception text.
- Replaced the unsupported blanket storage-full suggestion with a neutral local-save failure and a diagnostic code.
- A failed approval keeps the same review, version and checkbox on screen. Only a successful commit returns to the design list. A person can explicitly retry or navigate back; no automatic approval attempt occurs.

## Validation

- 22 focused Node tests pass: six transaction/error/rollback tests plus existing design and checkout authority checks. Commit failure after a successful request cannot report success; stale validation and the other design/matrix selection are preserved.
- App TypeScript and scoped ESLint pass.
- A standalone, explicitly labelled synthetic UI fixture renders the real application with an in-memory workspace adapter. Injected commit failure preserves the open København v2 review, confirmation checkbox and visible `commit/QuotaExceededError`. Explicitly allowing a manual retry and clicking again succeeds and returns to 2-of-2 approved designs. This is **synthetic UI recovery proof**, not a real storage-quota recovery claim.
- Real original workspace is still København v2 / 60 copies and Aarhus v1 / 40 copies, both approved, matrix price 944 DKK. Browser readbacks compare original PDF and snapshot hashes, revisions, approvals, allocation and checkout selection. No original workspace write was made during the investigation.
- Twelve baseline source files were compared: only the two intended workspace save/UI files changed. Existing designer, product panel, product pricing, checkout bundle, delivery and VAT sources remain byte-identical. New helper and its test are additional files.
- The broader isolated 12-approval/five-fault browser harness did **not** reach those checks: fixture setup itself hit native quota failures, even with smaller test data. Do not count its planned scenarios as passing tests. The completed native probes, six unit tests and separate synthetic UI check provide the evidence above.

The isolated production build passed in a new output directory; the normal build output was preserved. Log: `output/brochure-approval-investigation-2026-10-23/build.log`. No deployment occurred.

## Boundaries, follow-up and rollback

All new writes were confined to separately named local investigation databases or an in-memory fixture. Existing browser records, failed test databases, dirty files and prior artifacts are retained. The standalone fixtures under `output/` are not imported by the production entry. Product/header initialization may still read configured services; no claim of entirely offline application operation is made.

Chrome's internal quota diagnostics page was blocked by browser URL policy. No workaround, raw CDP access, profile storage inspection, browser reset or data clearing was attempted. No permission or persistence setting was changed. Browser-global quota/disk-reservation state has not been established.

Payment, checkout order submission, hosted upload, address-book writes, supplier/freight submission and deployment remain disabled/unperformed. Pricing logic and the price matrix are unchanged. No Supabase schema, migration or hosted data change occurred.

Next reliability work should examine saving approval metadata without serializing the entire artwork record, with atomic current-revision validation and preservation of existing records. That storage change was not implemented during this investigation. Do not call the native failure fixed, recommend deleting browser data, or add blind retries based on the current evidence.

Rollback is limited to the two exact diffs in the evidence directory plus removal of imports of the new helper. Keep all browser data and test receipts; do not reset the dirty worktree or restore whole files over unrelated subsequent changes.

Evidence directory: `output/brochure-approval-investigation-2026-10-23/`. Key files: `application-native-commit.json`, `payload-probe-1.json`, `payload-probe-2.json`, `initial-natural-failure.json`, `natural-failure-stage.json`, `storage-status.json`, `storage-after.json`, `review-failure.png`, `review-failure.txt`, `review-retry.txt`, `original-workspace.txt`, hashes, diffs and check logs.
