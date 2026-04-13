---
name: pod2-vibe-import
description: Vibe coding skill for importing Print.com products into POD v2 without manual UI navigation. Just tell the agent what product you want and it handles everything - finding, configuring, and placing in catalog.
---

# POD2 Vibe Import Skill

> **Experimental POD** - Just say what you want, agent handles everything.

## The Problem

Current POD v2 workflow:
1. Go to `/admin/pod2`
2. Click "Vælg produkt"
3. Search through Print.com catalog
4. Click, configure, import
5. Repeat for each product

**Too much clicking!**

## The Solution

**Vibe coding approach:**
```
You: "Import letterheads from Print.com"
Agent: "Found it. Configuring with 3 delivery tiers... Done!"
```

## How It Works

### Step 1: You Give a Command
```
"Import letterheads"
"Get flyers from Print.com"
"Add business cards to catalog"
```

### Step 2: Agent Does Everything
1. 🔍 Searches Print.com API for matching products
2. 📋 Shows you options to confirm
3. ⚙️ Configures:
   - 3 delivery tiers (cheap/normal/fast)
   - Quantities
   - Attributes (format, material, etc.)
4. 📦 Creates in `pod2_catalog_products`
5. ✅ Ready in `/admin/pod2` → "Konfigurer"

### Step 3: Product is Ready
- Appears in POD v2 admin
- Tenants can import it
- No manual UI work needed

## Usage Examples

### Example 1: Letterheads
```
You: Import letterheads from Print.com

Agent: Found 2 matches:
  1. "Letterheads" (SKU: letterheads)
  2. "Letterheads Premium" (SKU: letterheads-premium)

Which one? (1 or 2)

You: 1

Agent: Analyzing "Letterheads"...
  Found:
    - 5 delivery options
    - 3 formats (A4, A5, Letter)
    - 2 paper types (Offset, Recycled)
  
  Mapping to 3 tiers:
    🐢 Cheap: Economy (7 days)
    ⚖️ Normal: Standard (4-5 days)
    🚀 Fast: Express (1-2 days)
  
  Create product with these settings? (yes/no)

You: yes

Agent: ✅ Created "Brevpapir" in POD v2 catalog!
  ID: xxx-xxx-xxx
  View at: /admin/pod2 → Konfigurer
```

### Example 2: Flyers with Custom Config
```
You: Import flyers, but only A4 and A5, and map delivery to cheap/normal/fast

Agent: Found "Flyers" (SKU: flyers)
  Available formats: A6, A5, A4, A3, DL
  
  Filtering to: A4, A5
  
  Delivery mapping:
    🐢 Cheap: Eco Delivery (6-7 days)
    ⚖️ Normal: Standard (3-4 days)
    🚀 Fast: Priority (1-2 days)
  
  Create? (yes/no)

You: yes

Agent: ✅ Created "Flyers A4/A5" in POD v2 catalog!
```

## Commands

### Search and Import
```bash
node scripts/pod2-vibe-import.mjs import <search-term>
```

Examples:
```bash
node scripts/pod2-vibe-import.mjs import letterheads
node scripts/pod2-vibe-import.mjs import "business cards"
node scripts/pod2-vibe-import.mjs import flyers
```

### List Imported Products
```bash
node scripts/pod2-vibe-import.mjs list
```

### Configure Delivery Tiers
```bash
node scripts/pod2-vibe-import.mjs configure-tiers <product-id>
```

## Safety

✅ **This skill ONLY:**
- Reads from Print.com API
- Creates in `pod2_catalog_products`
- Uses existing POD v2 edge functions
- Follows POD2_README.md rules

❌ **This skill does NOT:**
- Modify existing products
- Touch pricing logic
- Change matrix system
- Break anything in POD v2

## Requirements

1. Print.com API connection configured in `/admin/pod2`
2. Master admin access
3. Product must exist in Print.com catalog

## Files

| File | Purpose |
|------|---------|
| `scripts/pod2-vibe-import.mjs` | Main CLI tool |
| `.agent/skills/pod2-vibe-import/SKILL.md` | This documentation |

## Future Ideas

- Bulk import: "Import all poster products"
- Smart mapping: "Find products with fast delivery"
- Auto-configure: "Import with default 3-tier setup"
- YAML import: Define products in config file

---

**Ready to use?** Just say: *"Import letterheads from Print.com"*
