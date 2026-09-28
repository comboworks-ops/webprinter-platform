# Branding connection repairs — 8 September 2026

Implemented locally. No linked-backend settings, production data, prices, tenant ownership or selected storefront presets were changed. The frontend and the new RPC migration must be released together.

## Result

- Tenant and master Save, Publish, saved-design save/delete, restore/discard and reset paths now require a returned tenant ID. A denied write, zero affected rows or database error rejects the operation before the editor acknowledges success. The master adapter no longer treats a transient local-storage fallback as a successful backend save.
- All adapter settings writes use `tenant_branding_settings_compare_and_swap`. It compares the settings snapshot atomically in PostgreSQL and accepts only branding-related patch keys. A conflicting settings change fails without overwriting it. The RPC uses `SECURITY INVOKER` and existing tenant UPDATE/SELECT grants and RLS; only authenticated callers receive execute permission. Settings snapshots travel in a POST body, avoiding an oversized URL when archives contain many designs.
- Draft/published resolution is shared between the tenant adapter and storefront. A first draft has an explicit `published: null` and stays unpublished. Saving a legacy flat/root draft preserves the previous publication. Canonical nested fields take precedence over stale root fields. Existing archive metadata remains intact.
- The master-template editor overlays draft fields after published fields when reopening. The editor displays the checked-write conflict/access message and retains unsaved state after failure.

## Files

- `src/lib/branding/settings-persistence.ts` — shared compatibility resolution and checked RPC call.
- `src/lib/branding/tenant-adapter.ts`, `master-adapter.ts` — checked writes and corrected reload behavior.
- `src/lib/branding/use-branding-editor.ts` — useful conflict/denial feedback.
- `src/hooks/useShopSettings.ts` — shared publication-only reader; prior unrelated edits preserved.
- `src/lib/account/shop.ts` and its tests — the account's strict shop reader also uses the same publication-only resolver; nine account shop tests pass, including the added draft/legacy regression.
- `supabase/migrations/20260908172146_tenant_branding_settings_compare_and_swap.sql` — narrow invoker RPC, explicit grants and rollback note.
- `src/lib/branding/adapters.test.ts`, `supabase/tests/branding_settings_compare_and_swap.psql` — executable regression and synthetic PostgreSQL checks.

## Validation

Five focused adapter regression cases were executed before implementation and all failed as the audit described. They passed after repairs. Final Node validation passed **34 tests**, including **12 new adapter tests**, the existing storefront preset/order-flow tests, and product-styling persistence tests:

```sh
node --experimental-strip-types --test src/lib/branding/adapters.test.ts src/lib/branding/orderFlowDesigns.test.ts src/lib/branding/printDesignPresets.test.ts src/lib/preview/productStylingSave.test.ts
```

The actual migration and SQL harness passed in a separate disposable database in the existing offline PostgreSQL 17 container. Tests checked two shop owners and both cross-shop write denials, own-shop writes, stale snapshots, first drafts over null settings, 300 KB settings, preservation of unrelated data, forbidden non-branding patch keys, missing identity, anonymous execute denial and `SECURITY INVOKER`. The test transaction was rolled back and the disposable database removed. This is SQL/RLS verification using minimal synthetic policies, not verification of the linked project's actual policies or browser sessions.

`node scripts/check-supabase-migration-grants.js` passed for all six then-pending migrations. App TypeScript still reports unrelated repository errors; the final run reports no diagnostics in the six edited/new branding source and test files. `git diff --check` passed for the edited tracked files.

## Remaining release proof and rollback

Apply only the reviewed migration in the designated test backend and deploy the matching frontend. Before that migration is installed, the new adapters fail saves safely because the RPC is unavailable. Run authenticated browser Save/Publish/reload with two shop owners and verify storefront visibility, denial states and a conflicting second-window save against the actual policies. Browser refresh/cache behavior and the deployed backend have not been exercised here.

The atomic predicate detects settings changes between each operation's read and write. It does not reconcile two independently edited draft documents or make other legacy settings writers use this RPC. Large documents now avoid URL limits, but still require normal request-body capacity.

Rollback the matching frontend changes first, preserving prior unrelated dirty hunks in `useShopSettings.ts`, then drop only `public.tenant_branding_settings_compare_and_swap(uuid, jsonb, jsonb)` if desired. This migration performs no stored-data transformation and needs no data rollback. Do not restore entire dirty files from HEAD or bulk-revert other settings/design work.
