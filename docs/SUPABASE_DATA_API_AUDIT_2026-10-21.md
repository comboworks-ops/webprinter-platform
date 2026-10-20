# Data API rollout audit — 21 October 2026

Status: **partial remediation; not safe to declare full reset/preview readiness**.
Reviewed main commit `92f060b53cdfef0f98a9be7c7925f309eb3f105b` (193 SQL files).
No production schema, ACL, policy, row, deployment or migration-ledger write was made.

## Impact

Supabase's 20 October notice says existing projects stop automatically granting
Data API access to newly created public tables on 30 October. Existing table
ACLs remain. This affects fresh/reset/preview databases as well as future tables
on the existing project. RLS alone does not supply SQL privileges.

Sources: https://supabase.com/docs/guides/api/securing-your-api and
https://github.com/orgs/supabase/discussions/45329 . The dated email was read
through the connected mailbox. The changelog index was also retrieved.

| Workflow | Finding |
| --- | --- |
| Existing tables in the current live database | Defaults change alone does not remove their ACLs. Read-only metadata confirms existing grants. |
| Frontend-only deployment | No direct ACL effect if it keeps using existing tables. |
| Future migration creating a public table | Must explicitly grant each required operation to each actual caller role. |
| Reset, fresh project, schema-replayed preview | Historical grants are missing and the migration sequence has independent hard failures. |
| Restore from a schema dump | Depends on whether that dump preserves ACLs, owners and roles; not validated here. |

## Full static inventory

The baseline contains 140 distinct public CREATE TABLE names. **101 have no named
table GRANT anywhere in the scanned history.** This is a lexical triage count,
not 101 proven currently broken tables: objects can be obsolete, private, dynamic,
dropped/recreated or serviced by definer functions. The checked-in inventory
lists every origin file and named grant/revoke, including later grants.

Regenerate with `python scripts/audit-supabase-table-grants.py`.
After this PR's two table fixes the count is 99. Do not generate ACLs automatically
from this inventory or from broad existing live grants.

Representative remaining groups: products/generic prices, user_roles/profiles,
tenants, designer saved designs/exports, legacy pricing, company hub, POD v1/v2
source tables, storformat, and tenant_pod_shipping_profile. The existing
20260921160543_site_design_library_access.sql correctly supplies later grants
for premade_designs, tenant_premade_designs and tenant_purchases; those are not
classified as having no grants anywhere.

## Proven independent reset blockers

- Both 20231210100000_customer_addresses.sql and 20231210_customer_addresses.sql
  create the same policies without dropping them. Isolated PostgreSQL execution
  of the first followed by the second fails with SQLSTATE 42710 (policy exists).
- 20241214100000_fix_master_admin_access.sql uses app_role/user_roles/tenants
  before their later creation migrations. An isolated replay reports SQLSTATE
  42704: type app_role does not exist. Removing only the duplicate does not fix this.
- There are additional duplicate/legacy migration versions and nonstandard
  timestamps. Do not rename, delete, squash, replay or mark them applied against
  the production ledger as part of a GRANT repair.

A full `supabase db reset` was not run: this environment has no Docker/native
PostgreSQL. PGlite executed the actual SQL fragments/migrations in an isolated
PostgreSQL engine with a minimal auth stub; this is not a Supabase platform test.

## Observed live/schema drift

Read-only metadata on the configured project confirms the three sampled tables
have RLS enabled and existing CRUD ACLs for anon/authenticated/service_role.
The postgres and supabase_admin default ACLs still include automatic grants.
No customer rows were queried.

The live tenant_pod_shipping_profile policy uses can_access_tenant(tenant_id),
whereas its checked-in creation migration uses user_roles membership and a
separate master policy. A replay therefore cannot be assumed to reproduce live
tenant authorization. The two customer tables' live ownership policies agree
with their creation files. They are account/user scoped, not tenant-scoped;
this PR preserves that existing model.

## Narrow changes in this PR

- Add only SELECT/INSERT/UPDATE/DELETE for authenticated on customer_addresses
  and checkout_customer_profiles in their creation files (including the legacy
  duplicate so either historical source carries the same access decision).
- Add a forward migration with the same two GRANTs, failing if RLS is disabled.
  This is idempotent and preserves all existing ACLs. It does not revoke historical
  anon/service_role grants on existing databases. On a fresh opt-in database it
  does not grant those roles access.
- Actual callers: src/pages/MyAddresses.tsx, src/pages/FileUploadConfiguration.tsx,
  src/pages/MyAccount.tsx and src/lib/checkout/customerProfiles.ts. These use
  authenticated own-row CRUD/upsert. No server caller to these tables was found
  under supabase/functions. UUID defaults need no sequence grants.
- Preserve every existing RLS predicate, trigger and tenant/ownership rule.
  No broad schema/default grants; no new SECURITY DEFINER functions; no pricing,
  POD, orders, billing or data changes.
- Bound grant-checker matching at statement terminators. Previously an unrelated
  GRANT followed by CREATE POLICY ... ON target could falsely approve target.
- Add isolated ownership tests and regression cases to the existing CI workflow.

Trigger-only private markers in the historical files are documentation for the
existing gate; they do not change function EXECUTE privileges. Comprehensive RPC
hardening is separate from this table compatibility patch.

## Validation

- 25 PostgreSQL assertions pass with automatic table grants absent: own-row CRUD,
  forged-owner INSERT denial, ownership-transfer UPDATE denial, cross-user reads/
  writes/deletes blocked, anonymous access denied, no new service_role/TRUNCATE
  access, unchanged policy definitions, and idempotent forward migration.
- 4 checker regression cases pass, including the cross-statement false positive.
- Changed-file grant gate passes for all 4 changed/new migration files.
- Full-history gate remains failing; this is intentionally NOT represented as
  fixed by this PR. It includes functions and same-file decisions, not only
  the table-level missing-grant inventory.
- No full API/GraphQL/preview replay or complete tenant suite passed here.

Reproduce isolated tests without changing application dependencies:

```sh
npm install --prefix /tmp/wp-grants-test --no-save --package-lock=false @electric-sql/pglite@0.3.14
PGLITE_MODULE=/tmp/wp-grants-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/tests/customer-data-api-grants.mjs
node scripts/tests/supabase-grant-checker.mjs
npm run check:supabase-grants
npm run check:supabase-grants -- --all
```

## Remaining release gate

Choose an authoritative reproducible schema/history strategy before claiming
full readiness: either reconcile the historical dependency/duplicate chain, or
establish a reviewed schema-only baseline for NEW isolated environments while
preserving the existing production migration ledger. Current live policy drift
must be reviewed in either approach. Do not copy live broad grants as the desired
access contract.

For each remaining API relation, trace actual anon/authenticated/service-role
operations, policy dependencies, invoker views, sequences and security-invoker
RPCs. Add exact grants at creation plus a narrowly reviewed forward repair where
needed. Keep private supplier/credentials/outbox tables out of guest access.
Then replay with automatic grants disabled and test two tenants, two users,
guest reads and server operations through actual APIs. Do not expose a partially
replayed schema before later restrictive policies have applied.

## Rollback

Revert source/CI changes selectively. Existing hosted data and policies are
untouched. If the forward migration is applied later, retain pre-apply ACL
metadata and undo only its actual additions; unconditional REVOKE would remove
pre-existing customer access. Never reset production or disable RLS to roll back.
