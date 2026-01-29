# POD v2 System (Print.com Integration) — High Priority

Last updated: 2026-01-29

This document is the authoritative guide for POD v2 in this repo.  
Read this first before changing anything in POD v2, pricing, or catalog flows.

---

## 1) Purpose
POD v2 is a **master‑tenant only** Print.com integration that lets us:
- Pull Print.com products into a curated POD catalog.
- Configure matrix layout + quantities.
- Import into the existing product configuration/pricing system **without touching core pricing logic**.
- Merge large imports safely when product combinations are huge.

It is **not** a replacement for the pricing engine or product configuration logic; it only feeds into them.

---

## 2) Hard Rules (Do Not Break These)
1) **Do not modify the core pricing system** (pricing engine, product configuration, MPA).  
2) **Keep POD v1 intact**. POD v2 is separate.
3) **Master tenant only** for creation and catalog management:
   - `tenant_id = 00000000-0000-0000-0000-000000000000`
4) **Never delete catalog products directly** unless you also remove dependent imports/jobs.
5) **Split + merge** large price matrices (do not import giant matrices in one go).

---

## 3) Current UI Flow (Admin)
Route: `/admin/pod2`

Tabs:
- **API Explorer** — low‑level API runner (Print.com API)
- **Vælg produkt** — fetch products from provider, start configuration wizard
- **Konfigurer** — curate products (rename + publish toggle) and delete safely
- **Katalog** — tenant catalog view + import flow

Inline wizard in **Vælg produkt**:
- **Step 1: Vælg** (variants, quantities, markup, etc.)
- **Step 2: Layout** (drag‑and‑drop matrix layout)

---

## 4) Data Model (POD v2)
Main tables:
- `pod2_catalog_products` (master only)
- `pod2_catalog_attributes`
- `pod2_catalog_attribute_values`
- `pod2_catalog_price_matrix`
- `pod2_tenant_imports` (tenant)
- `pod2_fulfillment_jobs` (tenant, future)

Important fields:
- `pod2_catalog_products.supplier_product_data.matrix_mapping`
- `pod2_catalog_products.supplier_product_data.matrix_quantities`

These are **saved from the Step‑2 matrix wizard** and used for **all future imports**.

---

## 5) Edge Functions (POD v2)
Located in `supabase/functions/`:
- `pod2-explorer-request` — proxy to Print.com API
- `pod2-tenant-import` — import a catalog product into product configuration
- `pod2-tenant-merge` — merge multiple POD imports into one matrix product
- `pod2-tenant-remove` — remove tenant import
- `pod2-pdf-preflight` — exists but **not deployed** (optional future feature)

Deployment reminder:
```
supabase functions deploy pod2-tenant-import
supabase functions deploy pod2-tenant-merge
supabase functions deploy pod2-tenant-remove
```

---

## 6) Known Limits / Safeguards
- **Price inserts are chunked** (500 rows per batch).
- **Matrix preview** is capped at **500 combinations** (UI safeguard).
- Large combinations should be imported in **chunks** and merged.

Recommended:
- Import **base product** (formats + materials)
- Import add‑ons (lamination, foil, cutting) separately
- Use **Sammenflet** to combine

---

## 7) Delete / Reset Rules
If you delete a catalog product:
1) Delete related jobs (`pod2_fulfillment_jobs`)
2) Delete imports (`pod2_tenant_imports`)
3) Delete catalog product (`pod2_catalog_products`)

The Curate delete action now follows this order automatically.

---

## 8) What NOT to do
- Do not modify `product_price` components or pricing engine logic for POD v2.
- Do not store POD v2 data in existing pricing tables (except via `pod2-tenant-import`).
- Do not remove POD v2 RLS policies.

---

## 9) File/Component Map
UI:
- `src/pages/admin/Pod2Admin.tsx` — main POD v2 admin
- `src/pages/admin/Pod2Katalog.tsx` — catalog + import wizard (compact)

Hooks:
- `src/lib/pod2/hooks.ts`

DB:
- `supabase/migrations/20260128_pod2_system.sql`

---

## 10) Notes / Constraints
Print.com API endpoints used in this repo **do not provide categories or thumbnails**.  
If categories are needed, add a manual SKU → category mapping layer later.

---

## 11) Safe “Next Work” Ideas
- Optional add‑on pricing (requires new pricing logic — do not start without approval).
- Optional category/tag mapping for POD catalog UI.
- Deploy `pod2-pdf-preflight` when ready.

---

## 12) TL;DR
POD v2 feeds into the existing product system without touching pricing logic.  
Keep POD v1 intact.  
