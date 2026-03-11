# Domain Stability Map

Status: Plain-language architecture guide  
Purpose: Explain the platform in a traditional, easy-to-navigate way before deeper cleanup or API work.

Use this document if you want to answer:

- What are the main parts of the system?
- Where do they live in the code?
- What does each part own?
- How stable is each part right now?
- What should be cleaned up first?

For the visual version, see `docs/SYSTEM_VISUAL_MAP.md`.

---

## 1. The Simple Way To Think About The System

This platform can be understood as 6 main areas:

1. **Shop Frontend**
2. **Product + Pricing Admin**
3. **Site Designer / Branding**
4. **Print Designer**
5. **Tenant / Publish / Distribution**
6. **Supplier Imports**

That is the practical structure.

Not everything in the app is equally stable, so the first cleanup goal is to treat these as separate domains instead of one giant admin system.

---

## 2. Traditional System Map

```text
Printmaker Platform
│
├── 1. Shop Frontend
│   ├── Home/shop pages
│   ├── Product pages
│   ├── Price matrix / selections
│   └── Checkout-related flows
│
├── 2. Product + Pricing Admin
│   ├── Product setup
│   ├── Attributes / layouts
│   ├── Price matrices
│   ├── Machine pricing
│   └── Large-format / special pricing
│
├── 3. Site Designer / Branding
│   ├── Header / footer / hero
│   ├── Colors / fonts
│   ├── Draft / preview / publish
│   └── V1 + V2 designer paths
│
├── 4. Print Designer
│   ├── Canvas editor
│   ├── Preflight
│   ├── PDF export
│   └── Color proofing
│
├── 5. Tenant / Publish / Distribution
│   ├── Tenant resolution
│   ├── Visibility in shop
│   ├── Copy/share between tenants
│   ├── Domains
│   └── Publish state
│
└── 6. Supplier Imports
    ├── Wir-machen-druck scripts
    ├── Pixart scripts
    └── Other import jobs
```

---

## 3. Domain Table

| Domain | What It Owns | Main Paths | Stability | Notes |
|---|---|---|---|---|
| **Shop Frontend** | Customer-facing pages, product rendering, pricing display, runtime content | `src/pages/Shop.tsx`, `src/pages/ProductPrice.tsx`, `src/components/product-price-page/*`, `src/components/Product*` | `Stable with caution` | Important runtime path. Should stay boring and predictable. |
| **Product + Pricing Admin** | Product setup, product attributes, matrix pricing, pricing generation, machine pricing | `src/components/admin/*`, `src/utils/productPricing.ts`, `src/lib/pricing/*` | `Stable core` | One of the strongest system areas. Good first API candidate on read side. |
| **Site Designer / Branding** | Header, footer, hero, colors, fonts, preview, publish, branding drafts | `src/components/admin/Branding*`, `src/components/admin/TenantBrandingSettingsV2.tsx`, `src/lib/branding/*`, `src/contexts/Preview*`, `src/hooks/useBrandingDraft.ts` | `Beta / mixed maturity` | Strong editing surface, but runtime wiring and expectations are not fully uniform yet. |
| **Print Designer** | Canvas editing, preflight, exports, ICC/CMYK proofing | `src/pages/Designer.tsx`, `src/components/designer/*`, `src/lib/designer/*`, `src/utils/preflightChecks.ts` | `Stable with caution` | Powerful and specialized. Must stay isolated from pricing changes. |
| **Tenant / Publish / Distribution** | Tenant scoping, publish state, master/tenant relationships, visibility rules | `src/lib/adminTenant.ts`, `src/pages/Admin.tsx`, tenant-related admin flows and edge functions | `Caution / high-risk` | Critical for correctness. Behavior must be very explicit before API work. |
| **Supplier Imports** | Supplier scraping/import scripts, data shaping, product creation/import support | `scripts/*`, skill-driven fetch flows, pricing snapshots under repo folders | `Operational but fragmented` | Works, but still script-led rather than domain-led. Needs standardization. |
| **POD v1** | Legacy POD flows | `src/lib/pod/*` and related UI | `Isolated` | Must not be mixed with POD v2 or core pricing refactors. |
| **POD v2** | Print.com integration and POD v2 import/catalog pipeline | `src/lib/pod2/*`, `src/pages/admin/Pod2*`, `supabase/functions/pod2-*` | `Isolated / additive` | Explicitly protected by repo rules. Must stay additive and separate. |

---

## 4. Where To Go In The Code

If you want to work on a specific system area, start here:

### Shop Frontend
- `src/App.tsx`
- `src/pages/Shop.tsx`
- `src/pages/ProductPrice.tsx`
- `src/components/product-price-page/*`

### Product + Pricing Admin
- `src/pages/Admin.tsx`
- `src/components/admin/Product*`
- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/lib/pricing/*`
- `src/utils/productPricing.ts`

### Site Designer / Branding
- `src/components/admin/TenantBrandingSettingsV2.tsx`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/lib/branding/*`
- `src/hooks/useBrandingDraft.ts`
- `src/contexts/PreviewBrandingContext.tsx`

### Print Designer
- `src/pages/Designer.tsx`
- `src/components/designer/*`
- `src/lib/designer/*`
- `src/hooks/useColorProofing.ts`

### Tenant / Publish / Distribution
- `src/lib/adminTenant.ts`
- tenant-related sections in `src/pages/Admin.tsx`
- publish/share logic in admin flows and related backend actions

### Supplier Imports
- `scripts/*`
- import runbooks in `docs/*`
- skill-linked import scripts for specific suppliers

---

## 5. What Each Domain Must Not Own

This is important. The cleanup should reinforce these boundaries.

### Shop Frontend must not own
- pricing generation logic
- tenant publishing rules
- branding editor state logic

### Product + Pricing Admin must not own
- canvas export logic
- storefront branding runtime
- POD v2 internals

### Site Designer / Branding must not own
- core pricing calculation
- print designer export logic
- supplier import behavior

### Print Designer must not own
- price matrix logic
- tenant publish logic
- storefront theme logic

### Tenant / Publish / Distribution must not own
- pricing rules
- design editor logic
- supplier-specific parsing logic

### Supplier Imports must not own
- storefront runtime behavior
- pricing engine internals
- tenant resolution behavior

---

## 6. Why Stability Is Uneven

The system issue is not that these domains are missing.

The issue is that:

- some domains are well-structured already
- some domains are still evolving
- they all live close together in the same app and admin shell

That creates three problems:

1. **Expectation mismatch**
   - The UI suggests a feature is fully connected.
   - The runtime underneath may still be partial.

2. **Boundary leakage**
   - A change in one area can affect another because ownership is not strict enough.

3. **API risk**
   - If a domain is not stable, exposing it as an API just spreads uncertainty into more places.

---

## 7. Cleanup Priority

Do not clean up everything at once.

Start in this order:

1. **Tenant / publish rules**
   - because wrong behavior here creates the most confusion
2. **Product catalog + pricing read path**
   - because this is core commerce behavior
3. **Shop frontend runtime**
   - because it consumes the previous two
4. **Site Designer / Branding**
   - after publish/runtime behavior is clearer
5. **Supplier imports**
   - standardize after core product behavior is stable
6. **Designer module**
   - only where domain boundaries need reinforcement, not as a general refactor

---

## 8. Recommended Next Documentation

The next useful documents after this one are:

1. `docs/CRITICAL_FLOWS.md`
   - the flows that must never break
2. `docs/DOMAIN_CONTRACTS.md`
   - what each domain reads, writes, and returns
3. `docs/API_ROLLOUT_PLAN.md`
   - exact read-first API rollout order

---

## 9. Bottom Line

The safest way to make this platform more structured is:

1. define the domains clearly
2. mark their stability honestly
3. protect the core flows
4. expose APIs only around stable read behavior first

This is how the system becomes tighter without introducing reckless refactors.
