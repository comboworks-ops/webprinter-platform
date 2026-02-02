# POD v2 System (Print.com Buyer + Platform + ERP Support)

This document describes the **POD v2** module implemented alongside the existing POD v1 system.  
**POD v1 is untouched**. POD v2 is fully isolated (new tables, new functions, new UI).

---

## Goals

- Keep **POD v1** intact.
- Build a **master‑only POD v2 catalog** based on Print.com buyer/platform APIs.
- Import v2 products into the **existing WebPrinter product configuration & pricing system** without changing pricing logic.
- Distribute products to tenants via the existing **system update / sync** mechanism.

---

## High‑Level Flow

1) **Master admin** curates products in POD v2 (`/admin/pod2`).  
2) Master **imports** a curated product into WebPrinter’s pricing system (creates a normal `products` row + option groups + price matrix).  
3) Master sends product updates to tenants (via existing `tenant_notifications` + `sync_specific_product` flow).  
4) Tenants import the product into their shop.  
5) Order/payment routing is planned for Phase 2 (see “Next steps”).

---

## Auth + Environments

### Buyer API (api.print.com)
- Uses **PrintApiKey** header:  
  `Authorization: PrintApiKey <your-key>`
- **Live**: `https://api.print.com`  
  **Test**: `https://api.stg.print.com`

### Platform API (platform.print.com)
- Uses **Bearer JWT** (see Print.com docs).  
- Base: `https://platform.print.com`

### ERP Support (Print.com web app)
Embedded web app integration with callback:
`https://app.print.com/?YourApp=value&cb=<yourCallbackUrl>`

---

## What Was Added (POD v2)

### 1) New DB schema (isolated)
Migration: `supabase/migrations/20260128_pod2_system.sql`

Tables:
- `pod2_supplier_connections` (master only)
- `pod2_api_presets` (master only)
- `pod2_catalog_products` (master only)
- `pod2_catalog_attributes` (master only)
- `pod2_catalog_attribute_values` (master only)
- `pod2_catalog_price_matrix` (master only)
- `pod2_tenant_imports` (tenant rows)
- `pod2_tenant_billing` (future use)
- `pod2_fulfillment_jobs` (future use)

View:
- `pod2_catalog_public` (published catalog, authenticated SELECT)

RLS:
- `is_pod2_master_admin()` guards master tables.
- Tenant rows use `public.can_access_tenant(...)`.

### 2) New edge functions

**POD v2 API Explorer**
- `supabase/functions/pod2-explorer-request`
- Proxies requests to Print.com.
- **Fallback**: if no v2 connection exists, uses v1 active connection (read‑only).

**POD v2 Import**
- `supabase/functions/pod2-tenant-import`
- Creates a normal `products` entry with:
  - attribute groups/values
  - pricing structure (matrix layout)
  - `generic_product_prices` rows
  - `technical_specs.is_pod_v2` + `technical_specs.pod2_catalog_id`
- Uses **chunked upserts** for price rows (stability for large matrices).

**Merge/Remove (optional)**
- `pod2-tenant-merge` (merge products/prices)
- `pod2-tenant-remove` (remove import + related option groups)

### 3) New client layer
Files:
- `src/lib/pod2/types.ts`
- `src/lib/pod2/hooks.ts`

Hooks mirror v1 but target `pod2_*` tables and `pod2-*` functions.

### 4) New admin UI
Routes:
- `/admin/pod2` → `Pod2Admin` (master)
- `/admin/pod2-katalog` → `Pod2Katalog` (master/tenant import)

Sidebar (master section):
- **Print on Demand v2**

---

## Import → Pricing System (Key Integration Point)

POD v2 imports are modeled after POD v1:

- **Attribute groups** → `product_attribute_groups`
- **Attribute values** → `product_attribute_values`
- **Option groups + options** → `product_option_groups` + `product_options`
- **Price matrix** → `generic_product_prices`
- **Matrix layout** → `products.pricing_structure` (matrix layout v1)

This means:
- **No pricing logic changes** are required.
- Product opens normally in the existing **Product Configuration UI**.

---

## Stability for Large Price Matrices

POD v2 import uses chunked inserts (`PRICE_CHUNK_SIZE = 500`) for `generic_product_prices`.  
This avoids crashes when a product has very large combinations (e.g. 20,000+ price points).

Recommended usage:
- Keep `wizardMaxVariants` and `wizardMaxRequests` within safe bounds.
- Prefer **batch price requests** (if/when Platform API auth is configured).

---

## Tenant Distribution (Existing System)

The existing **tenant update flow** remains unchanged:
- Master creates product in master tenant
- Master sends update → tenant sees notification in `/admin/tenant-updates`
- Tenant clicks **Import Product** → `sync_specific_product(...)` clones product + prices

No changes were made to that system.

To give the master admin more control, the product overview UI now calls a new RPC (`send_product_to_tenants(master_product_id, tenant_ids, delivery_mode)`) that inserts `tenant_notifications` for a selectable tenant list instead of broadcasting to every tenant. The dialog lets the master tag each distributor as either a normal price list or a locked POD price list, and that mode flows through inside `tenant_notifications.data.delivery_mode`. Existing triggers still fire for a global release / `is_available_to_tenants` toggle.

---

## ERP Support (Optional Module)

ERP Support can be enabled later to allow catalog selection inside Print.com UI:

1) Whitelist your app  
2) Launch:
   `https://app.print.com/?YourApp=value&cb=<yourCallbackUrl>`
3) Receive `productInfo` via callback  
4) Persist into `pod2_catalog_products` (future work)

---

## Next Steps (Phase 2)

- Add **order queue** + de‑duplication for Print.com orders.
- Implement **order submission** to Print.com (buyer API `/orders`).
- Handle **webhooks** for order status updates.
- Integrate **shipping possibilities** endpoints.
- Connect **Stripe Connect** so tenants appear as the merchant on invoices.

---

## Notes / Safety

- POD v1 tables, functions, and UI were **not modified**.
- POD v2 uses separate `pod2_*` tables and `pod2-*` functions.
- Shared systems (pricing, product configuration, tenant sync) are **read‑only integrations**.
