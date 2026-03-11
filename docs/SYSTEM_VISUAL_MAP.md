# Visual System Map

Status: Working architecture snapshot  
Purpose: Show the current platform shape, major boundaries, and the safest API-hardening path.

For a simpler plain-language guide, see `docs/DOMAIN_STABILITY_MAP.md`.

This map is based on:

- `README.md`
- `PROJECT_STATUS.md`
- `docs/ARCHITECTURE_BOUNDARIES.md`
- `docs/REST_API_READINESS_DRAFT.md`
- `docs/SITE_DESIGN_V2_STATUS.md`
- `docs/PRICING_SYSTEM.md`
- `src/App.tsx`
- `src/pages/Admin.tsx`

---

## 1. Platform Overview

```mermaid
flowchart LR
    U[Customer Users]
    A[Admin Users]
    T[Tenant Shops]

    U --> SF
    A --> AD
    T --> SF
    T --> AD

    subgraph APP[Printmaker Application]
        direction TB

        subgraph SF[Storefront Runtime]
            SHOP[Shop / Front Page]
            PDP[Product Pages]
            MATRIX[Price Matrix / Product Config]
            CHECKOUT[Checkout Flows]
            CONTENT[Content / Company Pages]
        end

        subgraph AD[Admin Runtime]
            PRODUCTS[Product Management]
            PRICING[Pricing Systems]
            BRAND1[Branding / Site Designer V1]
            BRAND2[Branding / Site Designer V2]
            TENANTS[Tenant / Domain / Publish]
            POD1[POD v1]
            POD2[POD v2]
            RES[Resources / Updates / Assets]
        end

        subgraph DESIGN[Designer Module]
            CANVAS[Canvas / Fabric]
            PREFLIGHT[Preflight]
            PDF[PDF Export]
            COLOR[Color Proofing]
        end

        subgraph IMPORTS[Import Layer]
            WMD[Wir-machen-druck Imports]
            PIXART[Pixart Imports]
            OTHER[Other Supplier Scripts]
        end
    end

    subgraph BACKEND[Supabase Backend]
        AUTH[Auth]
        DB[(Database)]
        STORAGE[Storage]
        EDGE[Edge Functions]
    end

    SF --> AUTH
    SF --> DB
    SF --> STORAGE
    AD --> AUTH
    AD --> DB
    AD --> STORAGE
    AD --> EDGE
    DESIGN --> STORAGE
    DESIGN --> DB
    IMPORTS --> DB
    IMPORTS --> STORAGE
```

---

## 2. Domain Boundaries

```mermaid
flowchart TB
    subgraph CORE[Core Business Domains]
        SHOP[Shop]
        ADMIN[Admin]
        BRANDING[Branding]
        PRICING[Pricing]
        DESIGNER[Designer]
        PODV1[POD v1]
        PODV2[POD v2]
    end

    SHOP --> PRICING
    SHOP --> BRANDING
    SHOP --> ADMIN

    ADMIN --> BRANDING
    ADMIN --> PRICING
    ADMIN --> DESIGNER
    ADMIN --> PODV1
    ADMIN --> PODV2

    DESIGNER -. must not own pricing .-> PRICING
    PODV1 -. isolated .- PODV2
    BRANDING -. affects storefront runtime .-> SHOP
```

Notes:

- `Pricing` is one of the strongest structured domains and should be treated as core.
- `Branding / Site Designer V2` exists, but the runtime wiring is not fully complete end-to-end.
- `POD v1` and `POD v2` must remain isolated.

---

## 3. Runtime Data Shape

```mermaid
flowchart LR
    ADMIN_UI[Admin UI]
    DRAFT[Draft State]
    PUBLISH[Publish Action]
    TENANTCFG[Tenant Published Config]
    PREVIEW[Preview Runtime]
    STOREFRONT[Live Storefront]

    ADMIN_UI --> DRAFT
    DRAFT --> PREVIEW
    DRAFT --> PUBLISH
    PUBLISH --> TENANTCFG
    TENANTCFG --> STOREFRONT
    TENANTCFG --> PREVIEW
```

This is especially important for:

- branding / site designer
- product visibility / publish behavior
- tenant-specific copies vs master-controlled flows

---

## 4. Stability Map

```mermaid
flowchart TB
    STABLE[Stable Core]
    CAUTION[Stable With Caution]
    BETA[Beta / Incomplete]
    ISO[Isolated / Special Handling]

    STABLE --> S1[Product Catalog Basics]
    STABLE --> S2[Matrix Pricing / Published Price Reads]
    STABLE --> S3[Tenant Resolution Basics]

    CAUTION --> C1[Storefront Runtime]
    CAUTION --> C2[Product Detail Rendering]
    CAUTION --> C3[Supplier Import Scripts That Already Repeat Reliably]

    BETA --> B1[Branding V2 Runtime Wiring]
    BETA --> B2[Per-page Theme / Page-level Controls]
    BETA --> B3[Advanced Preview / Publish Expectations]

    ISO --> I1[POD v1]
    ISO --> I2[POD v2]
```

---

## 5. Where API Hardening Should Start

```mermaid
flowchart LR
    A[Stabilize Module in UI]
    B[Declare Module Ready]
    C[Define Contract]
    D[Read-only API Wrapper]
    E[Shadow Compare Old vs API]
    F[Feature Flag Rollout]
    G[Write API Later]

    A --> B --> C --> D --> E --> F --> G
```

Recommended order:

1. Site Designer read
2. Catalog read
3. Product detail/options read
4. Pricing read
5. Branding/theme read
6. Admin writes
7. Tenant publish/sync
8. Design module
9. Import/integration jobs

---

## 6. Target Architecture

```mermaid
flowchart TB
    subgraph CONTRACTS[Platform Contracts]
        TC[Tenant Context Contract]
        CC[Catalog Contract]
        PC[Product Configuration Contract]
        PRC[Pricing Read Contract]
        BC[Branding / Theme Contract]
        PUB[Publish / Visibility Contract]
        AC[Asset / Media Contract]
    end

    subgraph DOMAINS[Platform Domains]
        SF[Storefront Runtime]
        PA[Product Admin]
        SD[Site Designer]
        DM[Designer Module]
        TD[Tenant Distribution]
        IM[Import Jobs]
        PV1[POD v1]
        PV2[POD v2]
    end

    CONTRACTS --> DOMAINS
    TC --> SF
    TC --> PA
    CC --> SF
    PC --> SF
    PRC --> SF
    BC --> SF
    PUB --> TD
    AC --> SD
    AC --> DM
```

The practical goal is simple:

- UI changes should not redefine business rules.
- Data contracts should outlive UI experiments.
- Experimental systems should not sit on the same operational level as stable runtime paths.

---

## 7. Immediate Recommendation

Before major API work:

1. Freeze the domain map.
2. Mark each domain as `stable`, `beta`, or `experimental`.
3. Define the first 5 read contracts.
4. Add regression checks for pricing and tenant publish behavior.
5. Keep V1 runtime safe while V2/theme work matures behind a clearer boundary.
