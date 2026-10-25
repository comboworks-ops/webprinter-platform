# Separate local brochure approval storage — 23 October 2026

Approval now writes a small revision receipt rather than rewriting the artwork workspace and both PDFs. The customer UI and local checkout use the combined artwork/approval view. Local tests pass in the separate in-app browser session explicitly selected by Thomas. The existing Chrome Yebbo environment still rejects even a 197-byte approval write with `commit/QuotaExceededError`; that browser storage problem remains unresolved.

## Implementation

- The same `webprinter-design-workspaces-v1` IndexedDB database now opens at schema version **2**. Upgrade adds only `approvals`, keyed by `[workspaceId, designId]`, with a `workspaceId` index. Existing `workspaces` records and their PDFs are not migrated, rewritten, deleted or backfilled.
- Each approval receipt contains `version`, `workspaceId`, `designId`, `revision` and `approvedAt`. No PDF, editor snapshot, preview, quantity, customer details or price is written by approval.
- Approval holds one native read/write transaction across both stores. It reads the latest workspace and approvals, runs the existing current-revision/artwork/PDF/preflight approval guard, then writes **only** the receipt. Concurrent artwork saves and approvals serialize on the same store scope. Completion is reported only on commit; aborts preserve previous receipts and artwork. There is no automatic retry or alternate-storage fallback.
- Read, list and artwork-change paths merge separate receipts into the existing `approvedRevision` view. Current legacy inline approvals remain readable when no separate receipt exists. A receipt for a different revision cannot approve newer artwork. An edit invalidates only that design; allocation/name changes retain their existing approval behavior.
- `DesignWorkspace` uses the new approval entry point. Failed saves keep the review open and retain the diagnostic behavior from the earlier investigation.
- Existing designer export, product price matrix, checkout bundle, delivery, VAT and payment/order gates are unchanged. This remains a development/loopback-only workflow; native browser approval is not hosted production authorization.

## Existing Chrome result — failed storage commits, originals preserved

Both original brochures were attempted independently through the new path. Each attempted write was exactly **197 UTF-8 JSON bytes** to `approvals`, with the five allowlisted fields. Neither committed: both returned `commit/QuotaExceededError`. The test actively rejected any attempt to call `put` on `workspaces`; none occurred.

Raw artwork record fingerprint, both exported PDF hashes, revisions, original inline approvals, 60/40 allocation, timestamp and pricing selection are unchanged. Original state remains København v2 / 60 copies and Aarhus v1 / 40 copies, both previously approved, product 944 DKK. The additive schema upgrade succeeded. No existing browser data was cleared and no storage/persistence setting was changed.

This disproves the hypothesis that reducing approval write size alone resolves the observed Chrome rejection. It does not identify the browser's internal resource or quota cause. Further browser investigation is still separate work; no corruption, storage-full condition or successful repair of that environment is claimed.

## Separate local browser result — successful native storage and customer UI

Thomas explicitly chose a separate local browser session after the tiny-write failure. The existing brochures were exported through a local test control and copied into the in-app browser at the same `127.0.0.1:8933` origin. The copy has a new workspace ID and new design IDs; its initial approvals were cleared **only in the exported copy**. Original Chrome data stayed intact. Both real eight-page PDF byte hashes match the originals:

- København: `f4b8b10e261aa49e12ff316e6455fa48864c5e3fa6788656309e261792dee8a4`.
- Aarhus: `50953268c89a6332e675b85aeff924feedaa8801a89dbab0218a5ee07a857a69`.

Completed checks:

1. Approved København v2 and Aarhus v1 separately through the normal customer review interface. Each became ready independently. Reload retained both approvals, 60/40 quantities and 944 DKK.
2. Four additional serial/concurrent native approval transactions wrote only four **189-byte** receipts. A guard rejected any artwork-store write during these checks. The entire raw workspace and both PDF hashes stayed identical.
3. A stale reviewed revision was rejected before writing metadata. Workspace reads and the workspace list both loaded the separate approvals after closing/reopening database connections.
4. In another isolated native database, copied real brochure payloads underwent a controlled snapshot change using `saveWorkspaceRevision`. Only that copy's approval became stale; the other stayed approved. This was a controlled revision test, not a new manual visual artwork edit.
5. A synthetic transaction abort after the metadata request succeeded could not mark the new revision approved or change the stored artwork. Explicit reapproval then succeeded without rewriting the artwork record.
6. The normal local checkout accepted the copied workspace through its existing file/revision checks: København v2, Aarhus v1, 60/40 copies, product 944 DKK, standard delivery 49 DKK, VAT 248.25 DKK, gross 1,241.25 DKK. Address fields remained empty; the full address-review test was not repeated in this slice. Payment remained disabled and no order was submitted. Returned to the copied design workspace for user testing.

## Automated checks and source boundaries

27 focused tests pass: separate metadata writes, edit isolation, stale/missing/invalid designs, legacy compatibility, receipt commit failure, original transaction diagnostics and existing design/checkout authority checks. App TypeScript, scoped ESLint and an isolated production build pass. The build wrote into a new evidence subdirectory and preserved the normal build output.

Ten protected baseline source files remain byte-identical, including the designer, product panel/pricing, checkout bundle and tax/delivery sources. Intentional changes are the local database adapter, local transaction helper, workspace approval UI, new approval model and focused tests. The separate test pages/data are under `output/` and are not imported by the production entry.

## Local route, evidence and rollback

Use the **in-app browser** for the working copied workspace:

`http://127.0.0.1:8933/design-workspace?workspace=local-approval-copy-24824d2c-ac9c-4b23-84cd-d4c27a4a1515&tenantId=00000000-0000-0000-0000-000000000000`

Evidence is in `output/brochure-separate-approval-2026-10-23/`: `chrome-native-both.json`, `fresh-native-checks.json`, `fresh-checkout.txt`, screenshots, protected source hashes, before-copies/diffs and test/type/lint/build logs. Local exported fixture JSON retains recovery data and should not be published. Existing failed runs and browser databases are preserved.

Rollback must **retain schema version 2, the approval store and the merged reader** so saved approvals remain readable. Pause new approval actions if necessary and repair forward; do not downgrade to the old version-1 opener, delete the database or restore whole files over unrelated dirty changes. An old version-1 opener cannot open an already-upgraded database. No Supabase migration, schema or hosted data change exists to roll back.

Pricing/POD behavior, payment, order/address-book submission, hosted upload, freight/supplier submission and deployment remain unchanged/disabled. Existing product/theme reads may still use configured services; this is local-only write proof, not an entirely offline or production-acceptance claim.
