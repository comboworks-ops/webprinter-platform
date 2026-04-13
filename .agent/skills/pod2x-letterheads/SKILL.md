---
name: pod2x-letterheads
description: Vibe coding skill for importing complex Print.com letterhead products into Webprinter. Simplifies delivery options to 3 tiers (cheap/normal/fast), handles custom quantities, multiple designs, and finish add-ons without touching existing POD v2 or pricing systems.
---

# POD2X Letterheads Skill

> **Vibe Coding Skill** - Tell me what you want, I'll build it for you.

## What This Skill Does

This skill creates **POD2X (POD v2 Extended)** products - complex Print.com products that don't fit the standard matrix layout.

Instead of manually clicking through `/admin/pod2`, you:
1. **Give me a Print.com product URL** (or product ID)
2. **Tell me your preferences** (delivery tiers, quantities, finishes)
3. **I create everything automatically** - database tables, edge functions, UI components

## How to Use (Vibe Coding)

### Step 1: Invoke the Skill
```
"Hey, I want to import letterheads from Print.com"
```

### Step 2: Give Me the Product
```
"The product is: https://app.print.com/selector/printed-letterheads"
```

### Step 3: Tell Me Your Preferences
```
"I want:
- 3 delivery options: cheap (slowest), normal (middle), fast (express)
- Custom quantities: let customers type any number
- Multiple designs: up to 10 designs
- Finishes: truck tube, lamination
- Default paper: Offset"
```

### Step 4: I Build It
I will:
- ✅ Create new database tables (pod2x_*)
- ✅ Create edge functions for Print.com API
- ✅ Create simplified product configuration UI
- ✅ Map Print.com delivery options to your 3 tiers
- ✅ Import the product to your catalog
- ❌ **NOT touch** existing POD v2 tables
- ❌ **NOT touch** existing pricing system
- ❌ **NOT touch** any core code

## Architecture (Isolated from POD v2)

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR INSTRUCTIONS (Vibe Coding)                            │
│  "I want letterheads with 3 delivery tiers..."              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  THIS SKILL (pod2x-letterheads)                             │
│  - Analyzes Print.com product                               │
│  - Asks clarifying questions                                │
│  - Builds custom solution                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  NEW: POD2X SYSTEM (Completely Separate)                    │
│  Tables: pod2x_products, pod2x_delivery_tiers, etc.         │
│  Edge: pod2x-printcom-proxy, pod2x-price-calculate          │
│  UI: Pod2XProductConfigurator.tsx                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  EXISTING SYSTEMS (Untouched)                               │
│  - POD v2: pod2_* tables                                    │
│  - Pricing: generic_product_prices, matrix_layout_v1        │
│  - Core: products, orders, checkout                         │
└─────────────────────────────────────────────────────────────┘
```

## What Gets Created

### 1. Database (New Tables)
```sql
pod2x_products              # Extended product definitions
pod2x_delivery_tiers        # Your 3 tiers (cheap/normal/fast)
pod2x_quantity_rules        # Custom quantity logic
pod2x_design_rules          # Multiple designs pricing
pod2x_finish_addons         # Truck tube, lamination, etc.
pod2x_price_cache           # Cached Print.com prices
```

### 2. Edge Functions (New)
```
pod2x-printcom-proxy        # Talk to Print.com API
pod2x-price-calculate       # Calculate price with your rules
pod2x-order-create          # Submit order to Print.com
```

### 3. UI Components (New)
```
Pod2XProductConfigurator    # Custom product config UI
Pod2XDeliverySelector       # 3-tier delivery selector
Pod2XQuantityInput          # Custom quantity input
Pod2XDesignSelector         # Multiple designs selector
```

### 4. Admin Tool (New)
```
/admin/pod2x                # New admin page (separate from /admin/pod2)
```

## Example Session

**You:** "I want to import letterheads"

**Me:** "Got it! Give me the Print.com URL or product ID"

**You:** "https://app.print.com/selector/printed-letterheads"

**Me:** "I can see this product has:
- 12 delivery options (ranging from 2-10 days)
- Custom quantities (50-10000)
- 3 print methods (Offset, Inkjet, HP Indigo)
- 5 finishes (Truck tube, Lamination matte, Lamination gloss, etc.)
- Multiple designs option

How do you want to simplify this?

**You:** "Map delivery to 3 tiers: cheap (slowest), normal (5-6 days), fast (2-3 days). Hide print methods - just use Offset. Show finishes as checkboxes. Allow up to 5 designs."

**Me:** "Building POD2X letterhead product... Done! 

Created:
- Product: 'Brevpapir (Letterheads)' in your catalog
- 3 delivery tiers mapped
- Custom quantity input (50-10000)
- Finish add-ons: Truck tube (+25 DKK), Lamination (+15 DKK)
- Design selector: 1-5 designs

Test it at: /admin/pod2x/letterheads"

## Guardrails

✅ **I WILL:**
- Create completely new tables (pod2x_*)
- Create new edge functions
- Create new UI components
- Map Print.com complexity to your simplicity
- Cache prices for performance

❌ **I WILL NOT:**
- Touch existing pod2_* tables
- Touch existing pricing logic
- Touch matrix_layout_v1
- Touch generic_product_prices
- Modify core checkout flow
- Break existing products

## Current Status

**Ready to build!**

Just say: **"I want to import letterheads from Print.com"** and give me your preferences.

---

*This skill creates an isolated "extended" system that coexists with POD v2 without interference.*
