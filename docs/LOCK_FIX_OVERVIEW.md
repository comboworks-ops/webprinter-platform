# Lock-Fix Overview

Last updated: 2026-02-23

Purpose:
- Keep a stable, reviewable list of critical isolation/sync safeguards.
- Make it easy to audit before publish/deploy.
- Prevent regressions where tenant data leaks across shops.

---

## Lock IDs

| Lock ID | Scope | Rule | Enforced In |
|---|---|---|---|
| `LF-001` | Branding isolation | Tenant branding publish only affects that tenant's `settings.branding` | `src/lib/branding/tenant-adapter.ts` |
| `LF-002` | Draft vs live | Draft is not live until explicit publish | `src/lib/branding/use-branding-editor.ts` |
| `LF-003` | Live refresh | Publish triggers storefront settings refetch to avoid stale live page | `src/lib/branding/use-branding-editor.ts`, `src/hooks/useShopSettings.ts` |
| `LF-004` | Product mutation isolation | Product/category update/delete/duplicate are scoped by `tenant_id` | `src/components/admin/ProductOverview.tsx` |
| `LF-005` | Distribution scope | "Send to tenants" / "Copy to tenant" only in Master-tenant context | `src/components/admin/ProductOverview.tsx` |
| `LF-006` | DB clone isolation | `clone_product` only allows `Master -> non-master tenant` | `supabase/migrations/20260223000200_harden_clone_product_master_only.sql` |
| `LF-007` | Sync source isolation | `sync_specific_product` copies only from Master product by slug | `supabase/migrations/20260223000100_fix_tenant_product_clone_and_sync.sql` |
| `LF-008` | Supabase data freshness | Browser auto-syncs active queries on realtime/focus/online/tab changes | `src/components/system/SupabaseDataSyncBridge.tsx` |

---

## Quick Audit Checklist

Run this before release:

1. Branding publish isolation
- Publish a banner/text change in tenant A.
- Confirm tenant B and Master storefront branding did not change.

2. Draft/live separation
- Save draft only and check live shop: unchanged.
- Publish and check live shop: updated.

3. Product mutation isolation
- In tenant A, rename category / delete product.
- Confirm same product in Master or tenant B is unchanged.

4. Distribution safety
- In non-Master tenant admin, confirm "Send til lejere" and "Kopier til Lejer" are not available.
- In Master context, confirm they are available.

5. DB clone guard
- `clone_product` must reject non-Master source products.

6. Browser data freshness
- Change product/price in one tab or Supabase.
- Confirm other open admin/shop tab updates after focus (or quickly via realtime).

---

## SQL Smoke Checks

```sql
-- Verify clone guard function is present
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'clone_product'
  and pg_get_function_identity_arguments(p.oid) = 'source_product_id uuid, target_tenant_id uuid';
```

```sql
-- Check for accidental tenantless products (should be 0)
select count(*) as products_without_tenant
from products
where tenant_id is null;
```

---

## Change Control Notes

- Do not remove `tenant_id` filters from admin mutations.
- Do not allow `clone_product` to clone tenant-to-tenant or tenant-to-master.
- Keep publish cache refresh logic in place unless replaced by a stronger equivalent.
- Keep `SupabaseDataSyncBridge` mounted in `App.tsx`.
