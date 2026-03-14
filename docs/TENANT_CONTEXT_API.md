# Tenant Context Read API

Status: Implemented  
Function: `tenant-context-read`

This is the first read-only API candidate from the rollout plan.

## Purpose

Return the resolved tenant context for either:
- storefront requests
- admin requests

It is read-only and does not mutate tenant, publish, or pricing state.

## Invoke

Frontend helper:
- `src/lib/api/tenantContext.ts`

Supabase function:
- `tenant-context-read`

## Request Body

```json
{
  "mode": "storefront",
  "hostname": "www.onlinetryksager.dk",
  "pathname": "/produkt/flyers",
  "tenantId": null,
  "force_domain": null
}
```

Fields:
- `mode`: `storefront` or `admin`
- `hostname`: current shop/admin hostname
- `pathname`: current route path
- `tenantId`: optional explicit tenant id override
- `force_domain`: optional explicit domain override

## Response Shape

```json
{
  "success": true,
  "mode": "storefront",
  "source": "hostname",
  "request": {
    "hostname": "www.onlinetryksager.dk",
    "pathname": "/produkt/flyers",
    "tenantId": null,
    "forceDomain": null,
    "rootDomain": "webprinter.dk",
    "isLocalhost": false,
    "isPlatformRoot": false
  },
  "tenant": {
    "id": "...",
    "name": "Online Tryksager",
    "domain": "www.onlinetryksager.dk",
    "isMasterTenant": false,
    "activeSiteId": null
  },
  "auth": {
    "isAuthenticated": true,
    "userId": "...",
    "email": "...",
    "role": "admin",
    "isMasterAdmin": false,
    "hasTenantAccess": true
  }
}
```

## Notes

- Public storefront resolution works without auth.
- If a valid auth token is present, the response also includes role/access context.
- `mode=admin` is intended for central/tenant admin resolution tests.
- On localhost, pass `tenantId` or `force_domain` explicitly for deterministic resolution.

## Rollback

- Remove `supabase/functions/tenant-context-read/`
- Remove `src/lib/api/tenantContext.ts`
- Undeploy function `tenant-context-read`
