# Designer save/auth repairs — 8 September 2026

Local repairs in `src/pages/Designer.tsx` and `src/lib/designer/saveDesign.ts`. Existing order export and other dirty editor work remain intact. No hosted sign-in, saved-design write, storage upload or deployment was performed.

## Behavior

- Saving resolves the actual shop from the document/URL and a strict tenant read, and checks any attached product belongs to that shop. It no longer substitutes an admin role's tenant or silently falls back to master. Embedded admin saves require their explicitly selected shop.
- Signed-out Save keeps the current Designer and Fabric canvas mounted. A dialog opens account login in a separate tab, then the customer returns to the original tab and retries Save. This preserves current artwork, PDF source buffers and in-memory page/side state through the login step; checkout upload import does not rerun.
- Save-and-leave and Add-to-order wait for a confirmed saved ID. Naming/login dialogs, denied writes and errors keep the artwork open. Edits made during a save remain unsaved and prevent navigation. Standalone saved designs return to the correct shop's account, while embedded admin keeps its existing admin return.
- Single-page PDF source bytes receive a versioned binary encoding inside the existing saved `editor_json`, and are decoded on reopen/library insertion. Their original bytes previously became empty objects through JSON transport.
- Saved-design persistence for documents with multiple linked-template pages or multiple apparel sides now stops with a precise keep-open message. Those workflows hold additional pages/sides outside the saved-design JSON; claiming a complete reusable save would be false. Their existing production export / return-to-order path remains available.
- Every generated PDF/PNG production file gets a SHA-256 digest of its exact `Blob` before upload. The digest travels with `designerExport` and each `productionFiles` entry, including the primary apparel export, so checkout can detect bytes changed after the approved preview.

## Verification

**10 Designer helper tests passed**: strict shop/product resolution, missing/conflicting shops, selected admin shop, checked updates, PDF source byte round trips, grouped/sliced/large binary data, parsing a real restored one-page vector PDF, legacy ordinary snapshots, and rejection of incomplete multi-page/multi-side library saves. Targeted ESLint passed for the helper and its tests.

The actual local Designer and Fabric canvas were also exercised with a fresh synthetic Supabase client and all remote requests intercepted. Browser checks verified pixel-identical artwork before/after signed-out Save and a rejected save, no signed-out write, a successful named save to the intended tenant, Save-and-leave waiting through naming/login, and navigation only after the confirmed save. The login dialog fits 1440, 1280, 1024 and 768 pixel viewports. The existing phone-unsupported Designer behavior was not changed.

Browser harness, report and screenshots are under `tmp/connection-repairs-designer-browser/`. The final report distinguishes the deliberately injected save error from unexpected browser errors. This is actual component/Fabric behavior with synthetic account/database responses; it does not prove cross-tab Supabase Auth propagation, actual hosted RLS/storage or complete multi-page editing persistence.

```sh
node --experimental-strip-types --test src/lib/designer/saveDesign.test.ts src/lib/account/shop.test.ts
node node_modules/eslint/bin/eslint.js src/lib/designer/saveDesign.ts src/lib/designer/saveDesign.test.ts
node tmp/connection-repairs-designer-browser/check.mjs
```

The shared account branding reader was also updated to use the publication-only resolver; its added regression confirms unpublished drafts do not appear on account pages. All nine account shop tests pass.

## Release/rollback

Recheck real login in a second tab, own-shop save/reopen, wrong-account denial, PDF vector export after reopen and generation-time artifact hashes in the designated hosted test shops. Keep the original tab open until save or production export has actually succeeded. Existing saved rows whose PDF source bytes were already discarded cannot be repaired by this codec; the source PDF must be imported again.

Rollback only these repair hunks. Preserve the new codec's decode compatibility for designs saved with encoded PDF bytes, and do not restore whole dirty Designer/account files from HEAD. The repairs add no database schema or data transformation.
