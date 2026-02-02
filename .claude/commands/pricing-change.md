---
description: Guide through safe pricing system changes
---

# Pricing Change Workflow

You've been asked to modify the pricing system. Follow this checklist to ensure you don't accidentally affect other domains.

---

## 1. Identify Scope

Before making changes, determine:

- [ ] Which pricing files need changes?
- [ ] Is this affecting static matrices (`productPricing.ts`) or dynamic engine (`machinePricingEngine.ts`)?
- [ ] Are price display components involved (`components/product-price-page/*`)?
- [ ] Does this affect storformat pricing (`storformatPricing.ts`)?

---

## 2. Pricing Domain Files

**Files you CAN modify:**

| File | Purpose |
|------|---------|
| `src/lib/pricing/machinePricingEngine.ts` | MPA calculation engine (pure functions) |
| `src/utils/productPricing.ts` | Static price matrices (flyers, folders, etc.) |
| `src/utils/storformatPricing.ts` | Large format pricing logic |
| `src/utils/pricingDatabase.ts` | Supabase query utilities |
| `src/components/product-price-page/*.tsx` | Price matrix rendering components |
| `src/components/admin/MachinePricingManager.tsx` | Admin UI for machine pricing |
| `src/components/admin/PriceListTemplateBuilder.tsx` | Price list templates |
| `src/components/admin/SmartPriceGenerator.tsx` | Price generation tool |

---

## 3. Boundary Check - Files You MUST NOT Touch

When modifying pricing, **NEVER** touch these files:

| File | Domain | Why Protected |
|------|--------|---------------|
| `src/components/designer/*` | Designer | Canvas rendering |
| `src/utils/preflightChecks.ts` | Designer | Print validation |
| `src/lib/designer/*` | Designer | Export logic |
| `src/lib/branding/*` | Branding | Tenant appearance |
| `src/hooks/useBrandingDraft.ts` | Branding | Draft/publish state |
| `src/lib/pod/*` | POD v1 | Legacy POD |
| `src/lib/pod2/*` | POD v2 | Current POD |

If your change requires modifying any of these files, **STOP** and discuss with the user first.

---

## 4. Database Tables

Pricing system uses these tables:

- `products` - Product definitions
- `product_options` - Option groups and values
- `machines` - Printing machines
- `materials` - Paper and materials
- `ink_sets` - Ink configurations
- `margin_profiles` - Profit margin rules

---

## 5. Testing Checklist

After making pricing changes, verify:

- [ ] Price matrices render correctly on product pages (visit `/produkt/[slug]`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Admin pricing UI still works (`/admin` → pricing section)
- [ ] Designer export still works (open `/designer` and export a test design)
- [ ] Storformat pricing works if changed (`/produkt/bannere` or similar)

---

## 6. Common Pricing Tasks

### Adding a new price matrix
1. Update `src/utils/productPricing.ts` with the new matrix
2. Ensure product in database references the matrix key
3. Test on product page

### Modifying machine pricing engine
1. Edit `src/lib/pricing/machinePricingEngine.ts`
2. Check that pure functions remain pure (no side effects)
3. Test with various input combinations

### Changing price display
1. Modify components in `src/components/product-price-page/`
2. Test responsive layouts (desktop + mobile)
3. Verify price formatting

---

## 7. Reference

Full domain documentation: `docs/ARCHITECTURE_BOUNDARIES.md`
