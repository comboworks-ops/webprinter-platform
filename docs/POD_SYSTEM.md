# Print on Demand (POD) System

## Overview

The POD system enables Webprinter to connect to external print suppliers (starting with Print.com) and offer Print on Demand products to tenants. This is a master-curated system where the master admin controls which products and options are available to tenants.

## How to Use - Setup Checklist

### Phase 0: Master Admin Setup

1. **Add Supplier API Connection**
   - Navigate to `/admin/pod` → "API Explorer" tab
   - Click "Tilføj forbindelse" (Add connection)
   - Enter:
     - Provider key: `printcom` (or custom name)
     - Base URL: `https://api.print.com` (or supplier's API URL)
     - Auth Mode: Select appropriate auth method
     - API Key: Enter your supplier API key
   - Click "Gem" (Save)
   - Print.com API-nøgler bruges til både autentificering og identifikation og kan sættes som header:
     - `authorization: PrintApiKey <din-nøgle>`

2. **Test API Connection**
   - In the Explorer tab, set Method to `GET` and Path to `/products`
   - Click "Kør" (Run)
   - Verify you receive a JSON response with products

3. **Save Useful Presets**
   - Configure common API calls and click "Gem som preset" (Save as preset)
   - Useful presets:
     - List Products: `GET /products`
     - Get Price: `POST /products/{sku}/price`
     - Product Details: `GET /products/{sku}`

### Phase 1: Curate Products

4. **Browse Supplier Products**
   - Go to "Gennemse" (Browse) tab
   - Click "Hent produkter" (Fetch products)
   - Review available products from the supplier

5. **Create Curated Products**
   - Go to "Kuratér" (Curate) tab
   - Create a new catalog product with:
     - Public title (da/en)
     - Public description
     - Product images
     - Attribute groups (e.g., Paper, Finish)
     - Attribute values with alias labels

6. **Build Pricing Matrix**
   - Go to "Priser" (Pricing) tab
   - For each product and variant combination:
     - Define quantity tiers: `[10, 25, 50, 100, 250, 500, 1000]`
     - Set base costs (your cost from supplier + fee)
     - Set recommended retail prices
   - Mark prices that need quotes from supplier

7. **Publish to Tenants**
   - Go to "Publicér" (Publish) tab
   - Toggle product status to "Publiceret" (Published)
   - Product is now visible in tenant POD catalogs

### Phase 1B: Tenant Import

8. **Tenant Views POD Catalog**
   - Tenant admin navigates to `/admin/pod-katalog`
   - Sees all published POD products

9. **Tenant Imports Product**
   - Clicks "Importér til butik" (Import to shop)
   - Optionally customizes product name and category
   - Product is created as a normal product in their shop
   - Pricing matrix is copied

10. **Tenant Publishes Product**
    - Product appears in `/admin/products`
    - Tenant can publish it like any other product

### Phase 1C: Orders & Fulfillment

11. **Setup Billing (Tenant)**
    - Navigate to `/admin/pod-betaling`
    - Click "Tilføj kort" (Add card)
    - Complete Stripe payment method setup
    - Card is saved for off-session charging

12. **Customer Places Order**
    - Customer orders a POD product via tenant shop
    - Order is created normally

13. **Create POD Jobs**
    - Tenant admin goes to `/admin/pod-ordrer`
    - Clicks "Opret POD Job fra Ordre" (Create POD job from order)
    - Enters order ID
    - POD fulfillment jobs are created for POD items

14. **Approve & Pay**
    - Tenant sees jobs in "Afventer godkendelse" (Awaiting approval)
    - Reviews tenant cost (their price to Webprinter)
    - Clicks "Godkend & Betal" (Approve & Pay)
    - Payment is charged off-session
    - Job status changes to "Sendt til leverandør" (Submitted)

## Database Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `pod_supplier_connections` | MASTER | Encrypted API credentials |
| `pod_api_presets` | MASTER | Saved API request templates |
| `pod_catalog_products` | MASTER | Curated product catalog |
| `pod_catalog_attributes` | MASTER | Attribute groups |
| `pod_catalog_attribute_values` | MASTER | Attribute values with supplier refs |
| `pod_catalog_price_matrix` | MASTER | Pricing by variant/quantity |
| `pod_tenant_imports` | TENANT | Links tenant products to catalog |
| `pod_tenant_billing` | TENANT | Stripe billing setup |
| `pod_fulfillment_jobs` | TENANT | Order fulfillment tracking |

## Edge Functions

| Function | Scope | Purpose |
|----------|-------|---------|
| `pod-explorer-request` | MASTER | Proxy API requests to supplier |
| `pod-tenant-billing-setup` | TENANT | Create Stripe SetupIntent |
| `pod-tenant-approve-charge` | TENANT | Charge tenant for job |
| `pod-tenant-import` | TENANT | Import catalog product |
| `pod-create-jobs` | TENANT | Create jobs from order |

## Security

- **Supplier credentials are NEVER exposed to browser**
  - API key stored server-side only
  - All supplier calls go through edge functions
  
- **Tenants cannot see supplier identity**
  - No access to `supplier_product_ref`
  - No access to `supplier_value_ref`
  - No access to `base_costs` (only `recommended_retail`)

- **RLS enforced**
  - Master tables: only `master_admin` can access
  - Tenant tables: tenant admins can access their own data

## Admin Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/admin/pod` | Master only | Supplier management, catalog curation |
| `/admin/pod-katalog` | All admins | Browse and import POD products |
| `/admin/pod-ordrer` | All admins | Manage POD fulfillment jobs |
| `/admin/pod-betaling` | All admins | Configure billing for POD |

## Job Status Flow

```
awaiting_approval → payment_pending → paid → submitted → completed
                 ↘      (on charge failure)     ↗
                    failed
```

## Next Steps (Phase 2)

- Implement actual supplier order submission
- Add delivery tracking from supplier
- Implement automatic notifications
- Add job retry for failed payments
