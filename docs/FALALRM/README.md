# Flyer Alarm (FLYERALARM PRO) Integration - POD v3

> Status: Pending Demo Token  
> Last Updated: March 18, 2026  
> Location: `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/docs/FALALRM/`

---

## 📋 Quick Summary

This folder contains documentation and planning for integrating **Flyer Alarm** as a new POD (Print-on-Demand) supplier - designated as **POD v3**.

**Key Decision**: Use **Client API** (REST) NOT StartNOW V3 (UI)
- Client API = Full programmatic control, white-label, curated products
- StartNOW V3 = Pre-built UI, limited customization

---

## 📁 Files in This Folder

| File | Purpose |
|------|---------|
| `README.md` | This file - main overview and next steps |
| `Client API Guidelines.pdf` | Complete API documentation (endpoints, auth, products) |
| `Client API & Webhooks.pdf` | Webhook events and signature validation |
| `Client API FAQ Document.pdf` | Common questions and answers |
| `Client API Onboarding Checklist.pdf` | Step-by-step onboarding process |
| `StartNOW V3 FAQ Document.pdf` | Alternative UI solution (not recommended) |

---

## 🎯 Current Status: AWAITING DEMO TOKEN

### What We Need
A **demo token** from Flyer Alarm to access their REST API for testing.

### How to Get It
1. Email: `service@flyeralarm.pro`
2. Provide:
   - Your webshop account email (already registered)
   - Country: Denmark (DK)
   - Company name
   - Technical contact details
3. Wait: 1-3 working days

### Email Template
```
To: service@flyeralarm.pro
Subject: Request for Client API Demo Token - [Your Company]

Hi Flyer Alarm PRO Team,

Thank you for the invitation to the FLYERALARM PRO reseller program. 
I have reviewed the documentation and would like to request a DEMO token 
for the Client API.

ACCOUNT DETAILS:
- Webshop account email: [YOUR_EMAIL]
- Country: Denmark (DK)
- Company: [YOUR_COMPANY]

Please grant me access to:
- Product catalog endpoints for DK
- Order placement API
- Webhook notifications

Best regards,
[YOUR_NAME]
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  MASTER TENANT (Webprinter Admin)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ API Explorer│  │ Vælg produkt│  │ Konfigurer (Curate) │ │
│  │  (test FA)  │  │(pick for   │  │ (select attributes, │ │
│  │             │  │  catalog)   │  │  set markup)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  POD3_CATALOG_PRODUCTS (curated - master only)              │
│  Only selected FA products, not entire catalog              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TENANT SHOPS                                               │
│  Import from curated catalog → Local products with markup   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FLYER ALARM CLIENT API                                     │
│  - Real-time pricing                                        │
│  - Order submission                                         │
│  - Webhook status updates                                   │
│  - Print file upload                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Key API Details (from PDFs)

### Base URL
```
https://rest.flyeralarm-esolutions.com/{country}/v2/
```

### Authentication
- **Type**: JWT Token (12-month validity)
- **Demo token**: Prepayment method (test only)
- **Live token**: Invoice payment (real orders)

### Available Countries
DE, AT, BE, CH, DK, ES, FR, IT, NL, SE, UK, PT, HR, RO, LU, IE, HU, CZ, PL, SK

**Recommended start**: Denmark (DK)

### Main Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /{country}/v2/catalog/groups` | List product groups |
| `GET /{country}/v2/catalog/groups/{id}/variants` | Get variants with quantities |
| `POST /{country}/v2/catalog/groups/{id}/configurator` | Configure product attributes |
| `POST /{country}/v2/orders` | Create order |
| `POST /{country}/v2/orders/{id}/print_data` | Upload print files |
| `GET /{country}/v2/orders/{id}/status_info` | Check order status |

### Webhook Events
- `OrderStatusV1` - Order status changes
- `PrintDataStatusV1` - Print file processed
- `CheckPrintDataStatusV1` - Pre-validation complete
- `TrackingLinksV1` - Shipping tracking available

---

## 💰 Pricing Strategy (Proposed)

### Currency
- FA prices in **EUR**
- Convert to **DKK** (suggested rate: 7.46)

### Markup Tiers (Example)
```
Base EUR ≤ 100:    +50%
Base EUR ≤ 500:    +40%
Base EUR ≤ 2000:   +35%
Base EUR > 2000:   +30%
```

### Shipping Options
- **Standard**: Cheaper, longer delivery
- **Express**: Premium, faster delivery
- Customer chooses at checkout

---

## 🗄️ Proposed Database Tables

```sql
-- Master catalog (curated products only)
pod3_catalog_products
pod3_catalog_attributes
pod3_catalog_attribute_values
pod3_catalog_price_matrix

-- Tenant imports
pod3_tenant_imports

-- Fulfillment
pod3_fulfillment_jobs
pod3_webhook_events
```

See full schema proposal in future `POD3_SCHEMA.md` file.

---

## 🚀 Development Phases (Pending Token)

### Phase 1: Foundation (Can start NOW)
- [ ] Database migrations
- [ ] Edge function skeletons
- [ ] Admin UI components
- [ ] Type definitions

### Phase 2: API Integration (NEEDS TOKEN)
- [ ] Test API explorer
- [ ] Product catalog sync
- [ ] Curation workflow

### Phase 3: Order Flow (NEEDS TOKEN)
- [ ] Create orders
- [ ] Upload print data
- [ ] Webhook handling

### Phase 4: Production
- [ ] Live token
- [ ] Real orders
- [ ] Monitoring

---

## ❓ Open Questions

1. **Which FA country to start with?** → Suggest Denmark (DK)
2. **Markup strategy** - Confirm tiers with business
3. **Custom sizes** - Enable for banners/posters?
4. **Webhook URL** - What endpoint for FA to call?

---

## 📞 Contact

**Flyer Alarm PRO Support**: `service@flyeralarm.pro`

---

## 🔗 Related Documents

- Main project: `POD2_README.md` (Print.com integration - similar pattern)
- System overview: `SYSTEM_OVERVIEW.md`
- Agent handover: `.agent/HANDOVER.md`

---

*Next Action: Send email to service@flyeralarm.pro requesting demo token*
