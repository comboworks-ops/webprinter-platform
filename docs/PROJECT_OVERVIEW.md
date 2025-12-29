# Webprinter.dk - Complete Web-to-Print Platform Overview

## Executive Summary

**Webprinter.dk** is a comprehensive web-to-print e-commerce platform built as a multi-tenant SaaS solution. It enables print shops to sell print products online with dynamic pricing, customer accounts, order management, and a built-in browser-based design editor.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vite + React 18 + TypeScript |
| **Routing** | React Router v6 |
| **State Management** | React hooks + TanStack Query |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **File Storage** | Supabase Storage |
| **Edge Functions** | Supabase Edge Functions (Deno) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Canvas Editor** | Fabric.js v5.3.0 |
| **PDF Rendering** | PDF.js v3.11.174 |
| **Multi-tenant** | Yes (tenant_id on all tables) |
| **Deployment** | Vercel |

---

## Core Modules

### 1. Multi-Tenant Architecture

The platform supports multiple independent print shops (tenants):

- **Master Tenant** (`00000000-0000-0000-0000-000000000000`): The platform owner with full admin access
- **Sub-Tenants**: Individual print shops with their own branding, products, and customers
- **Subdomain Routing**: Each tenant gets `shopname.webprinter.dk` or custom domains
- **Data Isolation**: All tables have `tenant_id` with Row Level Security (RLS)

**Key Tables:**
```sql
tenants (id, name, subdomain, custom_domain, settings, subscription_tier)
user_roles (user_id, tenant_id, role)  -- 'admin', 'staff', 'customer'
```

---

### 2. Unified Branding System

Allows both master template and individual tenant customization:

**Features:**
- Typography (fonts, sizes, weights)
- Color palette (primary, secondary, accent, backgrounds)
- Logo (image or text)
- Hero section (banners, videos, slideshows)
- Header customization (sticky, transparent, colors, navigation)
- Footer customization (layout, links, social icons)
- Icon packs

**Architecture:**
```
UnifiedBrandingEditor (shared component)
        ↓
  useBrandingEditor (shared hook)
        ↓
  ┌─────────────────┬─────────────────┐
  │ MasterAdapter   │  TenantAdapter  │
  └─────────────────┴─────────────────┘
```

**Key Files:**
- `src/lib/branding/` - Types, adapters, hooks
- `src/components/admin/UnifiedBrandingEditor.tsx`
- `src/hooks/useBrandingDraft.ts`

**Routes:**
- `/admin/branding` - Tenant branding (all tenants)
- `/admin/branding-template` - Master template (master only)

**Header Settings:**
```typescript
interface HeaderSettings {
  logoType: 'image' | 'text';
  logoText: string;
  logoImageUrl: string | null;
  navItems: HeaderNavItem[];
  dropdownMode: 'text' | 'pictures';
  fontId: string;
  bgColor: string;
  bgOpacity: number;
  transparentOverHero: boolean;
  style: 'auto' | 'solid' | 'glass';
  scroll: {
    sticky: boolean;
    hideOnScroll: boolean;
    fadeOnScroll: boolean;
    shrinkOnScroll: boolean;
  };
  cta: { enabled: boolean; label: string; href: string; variant: 'filled' | 'outline' };
}
```

**Footer Settings:**
```typescript
interface FooterSettings {
  style: 'minimal' | 'columns' | 'centered';
  background: 'themeDark' | 'themeLight' | 'solid';
  bgColor: string;
  copyrightText: string;
  links: FooterLinkItem[];
  social: { facebook, instagram, linkedin, twitter, youtube };
}
```

---

### 3. Product Catalog & Pricing

Three pricing modes supported:

#### A. Matrix Pricing (Static)
- Fixed prices defined in a quantity × format matrix
- Example: A4 × 100 stk = 299 kr

#### B. Formula Pricing
- Price calculated from base + per-unit formula
- Example: base 50 kr + 2 kr × quantity

#### C. Machine Pricing (MPA - Machine Pricing Add-on)
Dynamic cost-based pricing calculating:
- Material costs (paper, vinyl, foil)
- Ink consumption
- Machine time
- Finishing operations (lamination, cutting)
- Margin tiers by quantity

**MPA Database Tables:**
```sql
machines (id, name, mode, dimensions, speed, hourly_rate)
ink_sets (id, name, price_per_ml, ml_per_m2)
materials (id, name, type, price_per_m2/sheet)
finish_options (id, name, price_per_unit/m2/sheet)
pricing_profiles (machine_id, ink_set_id, defaults)
margin_profiles (id, mode, rounding)
margin_profile_tiers (margin_profile_id, qty_from, qty_to, value)
product_pricing_configs (product_id, pricing_profile_id, margin_profile_id)
```

**Calculation Steps:**
1. Compute item size with bleed
2. Calculate imposition (items per sheet/roll)
3. Calculate sheets needed + waste
4. Sum costs: material + ink + machine time + finishing
5. Apply margin tier based on quantity
6. Round to pricing step

**Edge Function:** `supabase/functions/calculate-machine-price/`

**Key Files:**
- `src/components/product-price-page/MachineConfigurator.tsx`
- `src/components/admin/ProductPriceManager.tsx`

---

### 4. Product Pages

**Route:** `/produkt/:slug`

**Features:**
- Product images and description
- Format/size selection
- Quantity selection
- Price matrix display
- Options (lamination, finishing, etc.)
- Real-time price calculation
- "Bestil nu!" (Order now) button
- "Design online" button → Opens Designer

**Key Files:**
- `src/pages/ProductPrice.tsx` - Main product page
- `src/components/product-price-page/ProductPricePanel.tsx` - Price summary
- `src/components/product-price-page/PriceMatrix.tsx` - Price grid

---

### 5. Checkout & File Upload

**Route:** `/checkout/konfigurer`

**Features:**
- File upload for print files
- Preflight checks (resolution, color mode)
- Multiple file support
- Upsell calculations
- Order item configuration

**Key File:** `src/pages/FileUploadConfiguration.tsx`

---

### 6. Order Management

**Customer Routes:**
- `/mine-ordrer` - Order history
- `/min-konto` - Account dashboard

**Features:**
- Order tracking
- Delivery status
- Invoice downloading
- Customer-service messaging
- Order notes

**Database Tables:**
```sql
orders (id, tenant_id, user_id, status, shipping, total)
order_items (order_id, product_id, quantity, price, config)
order_notes (order_id, content, created_by)
order_messages (order_id, content, sender_type)
order_invoices (order_id, pdf_url, invoice_number)
delivery_tracking (order_id, carrier, tracking_number, events)
```

**Key Files:**
- `src/pages/MyOrders.tsx`
- `src/pages/MyAccount.tsx`

---

### 7. Print Product Designer

**Route:** `/designer`, `/designer/:variantId`, `/designer?productId=xxx&format=A4`

Browser-based design editor allowing customers to create print-ready artwork.

**Features:**

| Category | Features |
|----------|----------|
| **Canvas** | Fabric.js editor, bleed/trim/safe area guides |
| **Objects** | Text, images, rectangles, circles, lines |
| **Text** | 14 fonts, size, bold/italic/underline, alignment |
| **Images** | Upload, scale, rotate |
| **PDF Import** | Upload PDF, preview pages, import as image |
| **Editing** | Layers panel, properties panel, z-order |
| **History** | Undo/Redo (50 states) |
| **Preflight** | Resolution check, safe area check, warnings |
| **Export** | PNG at document DPI |
| **Save** | To Supabase database |
| **Order** | Direct link to checkout with design |

**Keyboard Shortcuts:**
- `V` - Select tool
- `T` - Add text
- `I` - Add image
- `R` - Rectangle
- `C` - Circle
- `L` - Line
- `Delete` - Delete selected
- `Ctrl+S` - Save
- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` - Redo

**Standard Formats (built-in):**
```typescript
const STANDARD_FORMATS = {
  "A0": { width: 841, height: 1189 },
  "A3": { width: 297, height: 420 },
  "A4": { width: 210, height: 297 },
  "A5": { width: 148, height: 210 },
  "A6": { width: 105, height: 148 },
  "M65": { width: 99, height: 210 },  // Danish DL-like
  "85x55": { width: 85, height: 55 }, // Business card
};
```

**Available Fonts:**
Inter, Roboto, Open Sans, Montserrat, Playfair Display, Lora, Oswald, Raleway, Poppins, Bebas Neue, Arial, Times New Roman, Georgia, Courier New

**Preflight Checks:**
- Low resolution image detection (<150 DPI = error, <300 DPI = warning)
- Text outside safe area warning
- Thin stroke warning (<0.5pt)
- Small text warning (<6pt)
- Empty canvas check
- Objects outside canvas warning

**Database Tables:**
```sql
designer_templates (id, name, type, width_mm, height_mm, bleed_mm, dpi)
designer_saved_designs (id, user_id, product_id, editor_json, preflight_warnings)
designer_exports (design_id, pdf_url, dpi, color_profile)
```

**Key Files:**
- `src/pages/Designer.tsx` - Main page
- `src/components/designer/EditorCanvas.tsx` - Fabric.js wrapper
- `src/components/designer/LayerPanel.tsx` - Layer management
- `src/components/designer/PropertiesPanel.tsx` - Object properties
- `src/components/designer/PDFImportModal.tsx` - PDF import
- `src/components/designer/PreflightPanel.tsx` - Warnings display
- `src/utils/preflightChecks.ts` - Validation logic

---

### 8. Admin Panel

**Route:** `/admin/*`

**Sections:**
- Dashboard (overview, stats)
- Products (CRUD, pricing config)
- Orders (management, status updates)
- Customers (customer data, roles)
- Branding (tenant customization)
- Branding Template (master only)
- Designer Templates (print templates)
- Price Modules (MPA configuration)
  - Machines
  - Ink Sets
  - Materials
  - Finish Options
  - Pricing Profiles
  - Margin Profiles
- Settings

**Key Files:**
- `src/pages/Admin.tsx` - Admin router
- `src/components/admin/AdminSidebar.tsx` - Navigation
- `src/components/admin/DesignerTemplateManager.tsx` - Template CRUD

---

### 9. Public Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home/Shop | Dynamic based on domain |
| `/shop` | Shop | Product catalog |
| `/produkter` | Products | Category listing |
| `/om-os` | About | Company info |
| `/kontakt` | Contact | Contact form |
| `/betingelser` | Terms | Terms & conditions |
| `/grafisk-vejledning` | Graphic Guidelines | Print specs help |
| `/auth` | Auth | Login/register |
| `/opret-shop` | Tenant Signup | Create new shop |

---

## Database Schema Overview

### Core Tables
```
tenants
products
product_pricing_configs
orders
order_items
customers/users
user_roles
```

### Branding Tables
```
tenant_settings (via tenants.settings JSONB)
```

### MPA Tables
```
machines
ink_sets
materials
finish_options
pricing_profiles
margin_profiles
margin_profile_tiers
```

### Designer Tables
```
designer_templates
designer_saved_designs
designer_exports
```

### Order Management Tables
```
order_notes
order_messages
order_invoices
delivery_tracking
```

---

## Project Structure

```
printmaker-web-craft-main/
├── src/
│   ├── pages/               # Route pages (23 files)
│   │   ├── Index.tsx        # Landing page
│   │   ├── Shop.tsx         # Product catalog
│   │   ├── ProductPrice.tsx # Product detail
│   │   ├── Designer.tsx     # Print designer
│   │   ├── Admin.tsx        # Admin panel
│   │   ├── MyAccount.tsx    # Customer account
│   │   ├── MyOrders.tsx     # Order history
│   │   └── ...
│   │
│   ├── components/          # 149+ components
│   │   ├── admin/           # Admin components
│   │   ├── designer/        # Designer components
│   │   ├── product-price-page/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── ...
│   │
│   ├── hooks/               # Custom hooks
│   │   ├── useBrandingDraft.ts
│   │   └── ...
│   │
│   ├── lib/                 # Utilities
│   │   ├── branding/        # Branding system
│   │   └── ...
│   │
│   ├── utils/               # Helpers
│   │   ├── preflightChecks.ts
│   │   └── ...
│   │
│   └── integrations/        # Supabase client
│
├── supabase/
│   ├── functions/           # Edge functions
│   │   ├── calculate-machine-price/
│   │   └── ...
│   │
│   └── migrations/          # 49 migration files
│
├── docs/
│   ├── DESIGNER_BUILD_MEMORY.md
│   ├── MPA_MANUAL.md
│   ├── unified-branding-system.md
│   └── PROJECT_OVERVIEW.md (this file)
│
└── package.json
```

---

## Key Workflows

### 1. Customer Orders a Product
```
1. Browse /shop
2. Select product → /produkt/:slug
3. Configure (format, quantity, options)
4. Click "Design online" OR "Bestil nu!"
5. If Designer: Create design → Save → "Bestil"
6. /checkout/konfigurer → Upload files
7. Complete order
```

### 2. Admin Creates Machine-Priced Product
```
1. Create Machine in /admin/prismoduler/maskiner
2. Create Ink Set in /admin/prismoduler/blaeksæt
3. Create Materials in /admin/prismoduler/materialer
4. Create Pricing Profile (machine + ink)
5. Create Margin Profile with tiers
6. Create Product, set pricing_type = "machine"
7. Configure product_pricing_config
```

### 3. Tenant Customizes Branding
```
1. Login as tenant admin
2. Go to /admin/branding
3. Edit colors, fonts, logo, header, footer
4. Save draft
5. Preview changes
6. Publish
```

---

## Environment & Running

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# → http://localhost:8080

# Key routes
/                    # Homepage/Shop
/shop                # Product catalog
/produkt/:slug       # Product page
/designer            # Print designer
/admin               # Admin panel
/min-konto           # Customer account
```

**Environment Variables (via Supabase):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## What's Implemented vs. Planned

### ✅ Implemented
- Multi-tenant SaaS architecture
- Unified branding system (master + tenant)
- Product catalog with multiple pricing modes
- Machine Pricing Add-on (MPA)
- Customer accounts and order history
- Print Product Designer with full editing
- PDF import
- Preflight validation
- Admin panel

### 🔮 Future/Optional
- PDF/X export with CMYK conversion (server-side)
- Templates gallery (premade designs)
- Image filters (brightness, contrast)
- Crop tool
- Align/distribute tools
- Snap to grid
- Group/ungroup objects
- Multi-page documents
- Variable data printing

---

## Notes

- TypeScript lint errors for `designer_saved_designs` table are expected until Supabase types are regenerated
- PDF import converts pages to high-res PNG (not vector)
- All data is tenant-aware for multi-tenant isolation
- RLS policies required for public access to pricing tables

---

*Last Updated: 2025-12-28*
