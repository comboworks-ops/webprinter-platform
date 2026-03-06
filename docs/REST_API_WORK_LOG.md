# REST API Work Log

Purpose: Track concrete frontend/backend work that should be formalized behind REST APIs soon, without changing pricing logic.

## Entry 2026-03-06

### Module
- Site Designer / Featured Product / Side Panel Banner

### Logged Work
- Stabilize side-panel banner transitions so fade behavior is deterministic in preview/storefront.
- Keep banner text, subtitle, and CTA visible during transitions (avoid hidden content states).
- Ensure fade works when:
  - switching between multiple banner items,
  - switching in product-mode side panel,
  - image URL is unchanged between items.

### Why This Should Become API-backed
- Current behavior depends on client-side transition state and per-tenant draft config.
- A REST layer should expose a stable, versioned config contract for:
  - `fadeTransition`,
  - `transitionDurationMs`,
  - `slideshowIntervalMs`,
  - per-item content (title/subtitle/cta/image/mode/productId).
- API contract reduces regressions when UI components change and keeps tenant behavior consistent.

### Proposed API Scope (Draft)
- `GET /api/v1/site-designer/featured-config?tenantId=...`
- `PUT /api/v1/site-designer/featured-config`
- `GET /api/v1/site-designer/featured-config/history?tenantId=...`

### Constraints
- Do not alter pricing logic or product matrix calculations.
- Keep tenant isolation strict (tenant-scoped read/write).
- Roll out behind feature flag first (`USE_API_SITE_DESIGNER`).

### Status
- Logged for REST hardening queue.
- Not migrated to REST yet.
