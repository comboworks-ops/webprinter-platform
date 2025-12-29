# Machine Pricing Add-On (MPA) Manual

## Overview

The Machine Pricing Add-On (MPA) is an optional module that enables dynamic, cost-based pricing for print products. It calculates prices based on actual production costs including machine time, ink, materials, and finishing.

---

## Key Concepts

### 1. Machines
Define your printing machines with their capabilities:
- **Mode**: SHEET (fixed sheet sizes) or ROLL (continuous roll)
- **Dimensions**: Sheet/roll width, margins
- **Speed**: m²/hour or sheets/hour
- **Costs**: Machine rate per hour

### 2. Ink Sets
Define ink configurations:
- **Price per ml**: Cost of ink
- **ml per m² at 100%**: Ink consumption rate
- **Coverage %**: Typical coverage percentage
- **Tolerance %**: Adds buffer for waste

### 3. Materials
Define printable substrates:
- **Type**: PAPER, FOIL, VINYL, OTHER
- **Pricing Mode**: PER_SHEET or PER_M2
- **Costs**: Price per sheet or per m²

### 4. Finish Options
Post-processing operations:
- **Types**: Lamination, cutting, folding, etc.
- **Pricing Modes**: PER_SHEET, PER_M2, PER_UNIT, PER_MIN

### 5. Pricing Profiles
Links a machine + ink set with default settings:
- **Machine**: Which machine to use
- **Ink Set**: Which ink configuration
- **Bleed/Gap**: Default bleed and gap in mm

### 6. Margin Profiles
Defines profit margins by quantity tiers:
- **Mode**: TARGET_MARGIN or MARKUP
- **Tiers**: Different margins for different quantities
  - Example: 500% margin for 1-10 units, 200% for 100+ units

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `machines` | Machine definitions |
| `ink_sets` | Ink configurations |
| `materials` | Printable substrates |
| `finish_options` | Post-processing options |
| `pricing_profiles` | Machine + Ink + Defaults |
| `margin_profiles` | Profit margin rules |
| `margin_profile_tiers` | Quantity-based margin tiers |
| `product_pricing_configs` | Links products to MPA settings |

---

## Setting Up a Machine-Priced Product

### Step 1: Create Base Data (Admin → Prismoduler)

1. **Add a Machine**
   - Go to Admin → Prismoduler → Maskiner
   - Click "Tilføj maskine"
   - Enter name, mode (ROLL/SHEET), dimensions, speed, cost

2. **Add an Ink Set**
   - Go to Admin → Prismoduler → Blæksæt
   - Enter name, price per ml, consumption rate

3. **Add Materials**
   - Go to Admin → Prismoduler → Materialer
   - Enter name, type, pricing mode, cost

4. **Create a Pricing Profile**
   - Go to Admin → Prismoduler → Prisprofiler
   - Link a machine + ink set
   - Set default bleed/gap

5. **Create a Margin Profile**
   - Go to Admin → Prismoduler → Marginsprofiler
   - Set margin mode and add tiers

### Step 2: Configure the Product

1. Go to Admin → Produkter
2. Select or create a product
3. In "Priser" tab:
   - Set **Pristype** to "Maskinberegning"
   - Select a Pricing Profile
   - Select a Margin Profile
   - Configure allowed quantities
   - Select allowed materials
   - Set display mode (MATRIX or SELECTION)

---

## How Pricing is Calculated

The edge function `calculate-machine-price` performs these steps:

### Step 1: Compute Item Size with Bleed
```
itemWidth = width + (bleed × 2) + gap
itemHeight = height + (bleed × 2) + gap
```

### Step 2: Compute Imposition (How many items fit per sheet/run)
```
For ROLL machines:
  printWidth = roll_width_mm - margin_left - margin_right
  cols = floor(printWidth / itemWidth)
  rows = calculated based on order quantity

For SHEET machines:
  cols = floor((sheet_width - margins) / itemWidth)
  rows = floor((sheet_height - margins) / itemHeight)
  
ups = cols × rows  (items per sheet)
```

### Step 3: Calculate Sheets Needed
```
netSheets = ceil(quantity / ups)
wasteSheets = setup_waste_sheets + (netSheets × run_waste_pct%)
totalSheets = netSheets + wasteSheets
```

### Step 4: Calculate Costs

#### Material Cost:
```
If PER_M2:  
  sheetArea = (printWidth × printHeight) / 1,000,000  (in m²)
  materialCost = totalSheets × sheetArea × price_per_m2

If PER_SHEET:
  materialCost = totalSheets × price_per_sheet
```

#### Ink Cost:
```
inkArea = quantity × sides × (itemWidth × itemHeight / 1,000,000)
inkCost = inkArea × ml_per_m2_at_100pct × (coverage% / 100) × price_per_ml
```

#### Machine Time Cost:
```
runtimeMinutes = (totalSheets / sheets_per_hour) × 60
totalMinutes = setup_time_min + runtimeMinutes
machineCost = (totalMinutes / 60) × machine_rate_per_hour
```

#### Finishing Costs:
```
For each selected finish:
  finishCost += price_per_unit × quantity
  finishCost += price_per_sheet × totalSheets
  finishCost += price_per_m2 × totalArea
```

### Step 5: Sum Base Cost
```
totalBaseCost = materialCost + inkCost + machineCost + finishCost + numberingCost
```

### Step 6: Apply Margin
```
Find margin tier based on quantity or area:
  tier = find tier where qty_from <= value <= qty_to

If mode = TARGET_MARGIN:
  sellPrice = totalBaseCost / (1 - tier.value%)
  
If mode = MARKUP:
  sellPrice = totalBaseCost × (1 + tier.value%)

Round to nearest rounding_step (e.g., 5 kr)
```

### Example Calculation:
```
Input: 100×100mm, 10 stk, Hvid folie (11 kr/m²)

1. Item size: 106×106mm (with 3mm bleed + 0mm gap)
2. Imposition: 14 cols × 9 rows = 126 ups per run
3. Sheets: ceil(10/126) = 1 sheet + waste = 2 sheets
4. Costs:
   - Material: 2 × (1.54m×0.1m) × 11 = 3.39 kr
   - Ink: 0.01m² × 10 × 1 × 5ml × 0.05kr = 0.025 kr
   - Machine: (5min + 2min) / 60 × 200kr = 23.33 kr
   Total base: ~27 kr
5. Margin: 50% markup → 27 × 1.5 = 40.5 kr
6. Round to 45 kr
```

---

## Storefront Display

For MACHINE_PRICED products, the `MachineConfigurator` component:

1. Fetches the product's pricing config
2. Fetches allowed materials from the database
3. Renders selection UI:
   - Width/Height inputs (if no preset sizes)
   - Material dropdown
   - Quantity selector
   - Sides toggle (4+0 / 4+4) if allowed
4. Calls edge function on selection change
5. Displays calculated price

**Display Modes:**
- **SELECTION**: Dropdowns for each option, shows single price
- **MATRIX**: Grid showing all quantity × material combinations

---

## Troubleshooting

### "Empty Material Dropdown"
**Cause**: Materials table has no data or RLS blocks access
**Fix**:
1. Ensure materials exist in database with `tenant_id = '00000000-0000-0000-0000-000000000000'`
2. Run `fix_mpa_rls.sql` to enable public access

### "Vælg konfiguration for at se opsætning"
**Cause**: No price calculated yet (missing material selection or calculation error)
**Fix**: Check browser console for errors, ensure all required data exists

### "Price shows N/A"
**Cause**: Edge function returned error or missing configuration
**Fix**: Check Supabase edge function logs for errors

---

## Required SQL for RLS Fix

```sql
-- Run this in Supabase SQL Editor if materials/machines aren't showing

CREATE POLICY "Public select materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Public select machines" ON public.machines FOR SELECT USING (true);
CREATE POLICY "Public select pricing_profiles" ON public.pricing_profiles FOR SELECT USING (true);
CREATE POLICY "Public select margin_profiles" ON public.margin_profiles FOR SELECT USING (true);
CREATE POLICY "Public select ink_sets" ON public.ink_sets FOR SELECT USING (true);
CREATE POLICY "Public select finish_options" ON public.finish_options FOR SELECT USING (true);
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/calculate-machine-price/index.ts` | Edge function for pricing |
| `src/components/product-price-page/MachineConfigurator.tsx` | Storefront configurator |
| `src/components/admin/ProductPriceManager.tsx` | Admin pricing config UI |
| `supabase/setup_machine_pricing.sql` | Table schemas |
| `fix_mpa_rls.sql` | RLS policy fixes |

---

## Version History

- **Phase 24**: Added display_mode (MATRIX vs SELECTION)
- **Phase 26**: Fixed RLS policies for public access
- **Current**: Added display_mode column migration
