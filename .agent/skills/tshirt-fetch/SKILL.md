---
name: tshirt-fetch
description: Import t-shirt products from suppliers with matrix pricing plus locked size-distribution fields (Small-5XL) shown on product configuration and carried to order metadata.
---

# T-shirt Fetch Skill

Use this skill when importing **t-shirt products** that must include:
- regular matrix pricing
- print method / print position selectors
- non-pricing size distribution fields (`Small`..`5XL`)

Primary script:
- `scripts/fetch-silketryk-tshirt-import.mjs`
- `scripts/fetch-silketryk-tshirt2-import.mjs` (combined front-only + front/back product)
- `scripts/fetch-color-tshirt-import.mjs` (colored t-shirt with non-pricing color selector)
- `scripts/fetch-color-tshirt-4x4-import.mjs` (colored combined product with `Print position 1` and `4+4` scopes)

Locked config source:
- `scripts/product-import/tshirt-size-distribution-lock.js`

## Guardrails

- Scope is **t-shirt imports only**.
- Do not modify global fetch logic or non-t-shirt import scripts.
- Do not alter existing pricing formulas unless explicitly requested.
- Keep all changes additive and tenant-scoped.

## Workflow

1. Confirm input
- supplier URL
- tenant UUID
- product name + slug
- format label + dimensions (if non-default)

2. Extract and validate source rows
- run import in dry-run first to validate row count and selectors.

3. Import
- live import only after dry-run looks correct.

4. Verify
- product page shows size distribution fields in configuration.
- order summary carries selected size values.
- pricing matrix remains unchanged.

## Commands

- Dry-run:
```bash
node scripts/fetch-silketryk-tshirt-import.mjs import --dry-run --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --url "<supplier-url>"
```

- Live:
```bash
node scripts/fetch-silketryk-tshirt-import.mjs import --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --url "<supplier-url>"
```

- Dry-run (combined front-only + front/back in one product):
```bash
node scripts/fetch-silketryk-tshirt2-import.mjs import --dry-run --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --front-only-url "<url-1>" --front-back-url "<url-2>"
```

- Live (combined):
```bash
node scripts/fetch-silketryk-tshirt2-import.mjs import --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --front-only-url "<url-1>" --front-back-url "<url-2>"
```

- Dry-run (colored t-shirt with color dropdown):
```bash
node scripts/fetch-color-tshirt-import.mjs import --dry-run --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --url "<supplier-url>"
```

- Live (colored):
```bash
node scripts/fetch-color-tshirt-import.mjs import --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --url "<supplier-url>"
```

- Dry-run (colored combined 4+4):
```bash
node scripts/fetch-color-tshirt-4x4-import.mjs import --dry-run --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --front-only-url "<url-1>" --front-back-url "<url-2>"
```

- Live (colored combined 4+4):
```bash
node scripts/fetch-color-tshirt-4x4-import.mjs import --tenant <tenant-uuid> --name "<product-name>" --slug "<product-slug>" --front-only-url "<url-1>" --front-back-url "<url-2>"
```

## Notes

- The size distribution is injected from the lock config helper and is non-pricing metadata.
- If new t-shirt fetch scripts are created, they must reuse `buildTshirtTechnicalSpecs(...)` from the lock helper.
