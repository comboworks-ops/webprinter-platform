# API Readiness Test Sheet

Status: Working manual test sheet  
Purpose: Give a fixed, repeatable test order before exposing any domain as an API.

Use this together with:

- `docs/DOMAIN_STABILITY_MAP.md`
- `docs/DOMAIN_CONTRACTS.md`
- `docs/CRITICAL_FLOWS.md`
- `docs/API_ROLLOUT_PLAN.md`

---

## 1. Core Rule

Do not call a domain "API-ready" because one screen looks correct.

A domain is only ready when:

1. the main user flow works
2. the tenant context is correct
3. refresh/reload does not break it
4. the same result is repeatable on more than one product/shop

If a domain fails even one critical test below, it stays in hardening mode.

---

## 2. Test Order

Test in this order only:

1. Tenant Context
2. Catalog / Categories
3. Product Detail / Options
4. Pricing Read

Do not test Checkout, Publish, or POD for API readiness yet.

---

## 3. Test Environments

### Local Master Demo

- `http://localhost:8080/shop?tenantId=00000000-0000-0000-0000-000000000000`

### Local Tenant Shops

- `Online Tryksager`
  - `http://localhost:8080/local-tenant?tenantId=7cb851f5-c792-40b1-a79a-1f7c7b5f668c`
- `Salgsmapper`
  - `http://localhost:8080/local-tenant?force_domain=www.salgsmapper.dk`

### Live Shops

- `https://www.onlinetryksager.dk`
- `https://www.salgsmapper.dk`

---

## 4. Suggested Test Products

Use one product from each class below.

### Stable Matrix Product

Suggested:

- `standard-postcards`

### Flyers / Normal Print Product

Suggested:

- a standard flyer product with A4/A5/A6 format choices

### Folder / Sales Folder Product

Suggested:

- a `salgsmapper` product

### Storformat Product

Suggested:

- one banner / poster / roll-up product

### Special Selector Product

Suggested:

- one product with image buttons, custom selectors, or non-standard option flow

---

## 5. Domain 1: Tenant Context Read

### Goal

Verify that the correct tenant/shop context is held consistently.

### Must Pass

#### 5.1 Master Demo Stays Master

Steps:

1. Open the local master demo URL.
2. Click:
   - header logo
   - one header menu item
   - one category card
   - one product card
3. Refresh on the product page.

Pass if:

- branding stays `WebPrinter`
- products stay master products
- it does not jump to `onlinetryksager` or `salgsmapper`

#### 5.2 Online Tryksager Stays Tenant

Steps:

1. Open local `Online Tryksager`.
2. Click:
   - header logo
   - one header menu item
   - one category card
   - one product card
3. Refresh on the product page.

Pass if:

- branding stays `Online Tryksager`
- it does not switch to `WebPrinter`
- product list remains tenant-specific

#### 5.3 Salgsmapper Stays Tenant

Steps:

1. Open local `Salgsmapper`.
2. Repeat the same navigation.

Pass if:

- branding stays `Salgsmapper`
- it does not switch to another tenant

#### 5.4 Admin Context Separation

Steps:

1. Log in as master on `/admin/login`
2. Confirm master admin opens master context
3. Log in as tenant admin on tenant `/admin/login`
4. Confirm tenant admin opens tenant context

Pass if:

- customer auth and admin auth remain separate
- master admin does not silently drift into tenant admin
- tenant admin does not see master products by mistake

### Ready for API if

All 4 sections pass on:

- localhost
- at least one live tenant domain

---

## 6. Domain 2: Catalog / Category Read

### Goal

Verify category hierarchy and product visibility are stable enough for read APIs.

### Must Pass

#### 6.1 Main Group Navigation

Steps:

1. Open storefront
2. Click one top-level group such as:
   - `Tryksager`
   - `Storformat`

Pass if:

- correct group page opens
- products shown belong to that group only

#### 6.2 Category Front Card

Steps:

1. Assign a category `frontkort` in admin
2. Open storefront
3. Click the front-card

Pass if:

- the card looks like the chosen product card
- it opens the category page, not the product price page

#### 6.3 Product Still Exists Inside Category

Steps:

1. Use a real product as the category front-card
2. Open the category page

Pass if:

- the chosen product can still appear inside the category product list
- the front-card did not destroy or replace the actual product

#### 6.4 Hidden/Wrong-Tenant Product Isolation

Steps:

1. Verify one product should only exist in one tenant
2. Open another tenant storefront

Pass if:

- it does not leak into the wrong shop

### Ready for API if

- category structure is correct
- front-card routing is correct
- tenant isolation holds

---

## 7. Domain 3: Product Detail / Options Read

### Goal

Verify that product detail and selector data are stable enough for a read API.

### Must Pass

Run the checks below on at least 5 products:

- one stable matrix product
- one flyer product
- one folder product
- one storformat product
- one special-selector product

#### 7.1 Product Identity

Pass if:

- title is correct
- image is correct
- description is correct
- URL slug resolves the correct product

#### 7.2 Format / Option Data

Pass if:

- correct format list appears
- correct material/options appear
- changing selectors updates the view correctly

#### 7.3 Technical Specs

Pass if:

- product page technical specs match the chosen format
- designer format matches the chosen format
- checkout upload/proofing format matches the chosen format

#### 7.4 Content Below Matrix

Pass if:

- product-side information belongs to the correct product
- no wrong reused content appears from another product

### Ready for API if

All 5 representative products pass all 4 checks.

---

## 8. Domain 4: Pricing Read

### Goal

Verify read-only pricing is stable enough for an API without touching pricing generation.

### Must Pass

Use the same 5 representative products from Domain 3.

#### 8.1 Initial Price

Pass if:

- initial visible price is correct
- no missing rows for valid default selections

#### 8.2 Option Change Price Update

Steps:

1. Change format
2. Change material
3. Change quantity
4. Change one special selector if the product has one

Pass if:

- price updates correctly
- no stale price remains visible
- invalid combinations are handled correctly

#### 8.3 Compare Against Matrix Data

Pass if:

- the visible UI price matches the stored published price row for the selected combination

#### 8.4 Tenant Isolation

Pass if:

- one tenant’s product pricing does not show another tenant’s data

### Ready for API if

All 5 products pass all 4 pricing checks.

---

## 9. Not Ready Yet

Do not call these API-ready from this sheet:

- Checkout / Orders
- Tenant publish / distribution
- Site Designer write flows
- Supplier imports as public APIs
- POD v1
- POD v2 external supplier submission

These domains need separate hardening first.

---

## 10. Test Log

Use this table while testing.

| Domain | Test | Environment | Result | Notes |
|---|---|---|---|---|
| Tenant Context | Master demo stays master | Local |  |  |
| Tenant Context | Online Tryksager stays tenant | Local |  |  |
| Tenant Context | Salgsmapper stays tenant | Local |  |  |
| Tenant Context | Admin context separation | Local / Live |  |  |
| Catalog | Main group navigation | Local / Live |  |  |
| Catalog | Category front-card routing | Local / Live |  |  |
| Catalog | Product still exists inside category | Local / Live |  |  |
| Catalog | Hidden/wrong-tenant isolation | Local / Live |  |  |
| Product Detail | Stable matrix product | Local / Live |  |  |
| Product Detail | Flyer product | Local / Live |  |  |
| Product Detail | Folder product | Local / Live |  |  |
| Product Detail | Storformat product | Local / Live |  |  |
| Product Detail | Special selector product | Local / Live |  |  |
| Pricing Read | Stable matrix product | Local / Live |  |  |
| Pricing Read | Flyer product | Local / Live |  |  |
| Pricing Read | Folder product | Local / Live |  |  |
| Pricing Read | Storformat product | Local / Live |  |  |
| Pricing Read | Special selector product | Local / Live |  |  |

---

## 11. Decision Rule

After testing:

- if `Tenant Context` fails: stop, do not build any API yet
- if `Catalog` fails: stop before product/category APIs
- if `Product Detail` fails: stop before detail APIs
- if `Pricing Read` fails: do not expose pricing APIs

Only move to real API extraction after all earlier domains pass.
