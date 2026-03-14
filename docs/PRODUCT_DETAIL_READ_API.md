# Product Detail / Options Read API

Status: Implemented  
Function: `product-detail-read`

This is the third read-only API candidate in the rollout plan.

## Purpose

Return the tenant-scoped product detail payload for a single product, including:
- product base fields
- technical specs
- product page info blocks
- option group metadata
- custom fields

Pricing is intentionally not part of this API.

## Invoke

Frontend helper:
- `src/lib/api/productDetailRead.ts`

Supabase function:
- `product-detail-read`

## Request Body

```json
{
  "hostname": "www.onlinetryksager.dk",
  "pathname": "/produkt/flyers",
  "tenantId": null,
  "force_domain": null,
  "slug": "flyers",
  "productId": null
}
```

Fields:
- `hostname`: current storefront hostname
- `pathname`: current route path
- `tenantId`: optional explicit tenant override
- `force_domain`: optional explicit domain override
- `slug`: product slug
- `productId`: optional explicit product id

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
    "technical_specs": {},
    "product_info_v2": {
      "useSections": false,
      "imagePosition": "above",
      "blocks": []
    }
  },
  "optionGroups": [],
  "customFields": []
}
```

## Notes

- Resolution order matches the current storefront fallback pattern:
  - tenant-scoped
  - master fallback
  - published fallback
- `product_info_v2` is derived from `technical_specs.product_page_info_v2`
- `optionGroups` includes normalized option labels and display metadata
- this endpoint is read-only and does not mutate product, pricing, or publish state

## Rollback

- Remove `supabase/functions/product-detail-read/`
- Remove `src/lib/api/productDetailRead.ts`
- Undeploy function `product-detail-read`
