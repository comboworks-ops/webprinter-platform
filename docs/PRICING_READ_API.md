# Pricing Read API

Status: Implemented  
Function: `pricing-read`

This is the fourth read-only API candidate in the rollout plan.

## Purpose

Return generic price rows for a resolved product and optionally filter them by:
- format id
- material id
- variant value ids
- quantity

This API is read-only. It does not write prices or alter selector logic.

## Invoke

Frontend helper:
- `src/lib/api/pricingRead.ts`

Supabase function:
- `pricing-read`

## Request Body

```json
{
  "hostname": "www.onlinetryksager.dk",
  "pathname": "/produkt/flyers",
  "tenantId": null,
  "force_domain": null,
  "slug": "flyers",
  "formatId": "uuid-format",
  "materialId": "uuid-material",
  "quantity": 250,
  "variantValueIds": ["uuid-1", "uuid-2"]
}
```

At least one of `slug` or `productId` is required.

## Response Shape

```json
{
  "success": true,
  "source": "tenant_scoped",
  "tenant": {
    "id": "...",
    "name": "Online Tryksager",
    "domain": "www.onlinetryksager.dk",
    "isMasterTenant": false
  },
  "product": {
    "id": "...",
    "slug": "flyers",
    "name": "Flyers",
    "pricing_type": "generic_matrix"
  },
  "summary": {
    "totalRows": 840,
    "matchedRows": 7,
    "availableQuantities": [100, 250, 500]
  },
  "bestMatch": {},
  "matchedRows": []
}
```

## Notes

- Resolution order matches the current storefront fallback pattern:
  - tenant-scoped
  - master fallback
  - published fallback
- The endpoint reads `generic_product_prices` only.
- It normalizes `selectionMap` and common legacy ids from `extra_data`.
- This is a validation/debug-friendly read API, not a replacement for all frontend pricing behavior yet.

## Rollback

- Remove `supabase/functions/pricing-read/`
- Remove `src/lib/api/pricingRead.ts`
- Undeploy function `pricing-read`
