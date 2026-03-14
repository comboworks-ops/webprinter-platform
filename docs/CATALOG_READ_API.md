# Catalog Read API

Status: Implemented  
Function: `catalog-read`

This is the second read-only API candidate in the rollout plan.

## Purpose

Return a tenant-scoped published catalog with:
- overviews
- category hierarchy
- published product summaries
- optional filtered product lists by overview/category/subcategory

Pricing is intentionally not part of this API.

## Invoke

Frontend helper:
- `src/lib/api/catalogRead.ts`

Supabase function:
- `catalog-read`

## Request Body

```json
{
  "hostname": "www.onlinetryksager.dk",
  "pathname": "/produkter",
  "tenantId": null,
  "force_domain": null,
  "overview": "produkter",
  "category": "tryksager",
  "subcategory": "flyers"
}
```

Fields:
- `hostname`: current storefront hostname
- `pathname`: current route path
- `tenantId`: optional explicit tenant override
- `force_domain`: optional explicit domain override
- `overview`: optional overview slug filter
- `category`: optional root category slug filter
- `subcategory`: optional subcategory slug filter

## Response Shape

```json
{
  "success": true,
  "source": "hostname",
  "tenant": {
    "id": "...",
    "name": "Online Tryksager",
    "domain": "www.onlinetryksager.dk",
    "isMasterTenant": false
  },
  "overviews": [],
  "categories": [],
  "filters": {
    "matchedOverview": null,
    "matchedCategory": null,
    "matchedSubcategory": null
  },
  "products": [],
  "filteredProducts": [],
  "listingProducts": []
}
```

## Notes

- `products` contains all published tenant-scoped product summaries returned by the catalog query.
- `filteredProducts` applies the optional overview/category/subcategory filters.
- `listingProducts` excludes category-landing products and is intended for category-page listings.
- The endpoint is read-only and does not mutate product, category, or pricing state.

## Rollback

- Remove `supabase/functions/catalog-read/`
- Remove `src/lib/api/catalogRead.ts`
- Undeploy function `catalog-read`
