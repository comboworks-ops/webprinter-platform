# Webprinter.dk - Next-Gen Web-to-Print Platform

A comprehensive, multi-tenant SaaS e-commerce platform for print shops. Built with **React 18**, **TypeScript**, **Fabric.js**, and **Supabase**.

---

## 🚀 Key Modules & Features

### 1. Multi-Tenant SaaS Architecture
*   **Isolation**: Every tenant operates in a separate environment (subdomain or custom domain).
*   **Data Integrity**: strict Row-Level Security (RLS) on all PostgreSQL tables.
*   **Master Admin**: Global platform management with internal billing and tenant oversight.

### 2. Industry-Grade Print Designer
A browser-based editor that rivals professional design tools:
*   **Canvas Editor**: Powered by Fabric.js with support for bleed, trim, and safe areas.
*   **Advanced Type**: Professional font management and text styling.
*   **PDF Import**: Upload and extract pages from PDFs for high-fidelity editing.
*   **Preflight System**: Real-time validation for DPI, safe-margins, and color checks.
*   **History & Export**: Undo/redo (50 states) and high-resolution production-ready exports.

### 3. Dynamic Pricing Engine (MPA)
The **Machine Pricing Add-on** enables precise, real-time cost calculation:
*   **Material Library**: Manage paper, vinyl, and substrates by weight/m2.
*   **Machine Efficiency**: Define machines by speed, ink consumption, and hourly rates.
*   **Margin Profiles**: Tiered markup structures based on order volume.
*   **Edge Calculations**: High-performance price computation via Supabase Edge Functions.

### 4. Advanced Color Management
*   **ICC Soft Proofing**: Simulate CMYK color shifts directly in the browser.
*   **Profile Management**: Assign specific ICC profiles (FOGRA39, sRGB, etc.) per product.
*   **Gamut Warnings**: Visual indicators for non-printable colors.

### 5. Unified Branding System
*   **Visual Editor**: Real-time "Click-to-Edit" interface for tenant storefronts.
*   **Full Customization**: Typography, color palettes, hero sections, and advanced header/footer controls.
*   **Draft & Publish**: Robust workflow for testing branding changes before going live.

### 6. B2B Company Hub (Reorder Portal)
*   **Whitelabel Client Portals**: Create dedicated spaces for business clients.
*   **Whitelisted Users**: Manage access by email/name within the tenant.
*   **Pinned Products**: Quick access to custom-designed products for reordering.
*   **Logo Management**: Customize the portal with the client's own logo.

---

## 🏗️ Project Structure

```bash
src/
├── components/
│   ├── admin/           # Admin dashboards & management tools
│   ├── designer/        # Fabric.js editor components & logic
│   ├── product-price/   # Pricing configurators & matrices
│   └── ui/              # shadcn/ui shared design system
├── hooks/               # Core business logic hooks (branding, design, roles)
├── lib/                 # Core engine logic (pricing, color, branding)
├── pages/               # Route components
└── utils/               # Print-specific helpers (preflight, units, conversions)

supabase/
├── migrations/          # 50+ migrations for print-specific data models
└── functions/           # Edge functions for pricing & backend logic
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vite + React 18 + TS |
| **Logic** | TanStack Query + Fabric.js v5 |
| **Backend** | Supabase (Auth, DB, Storage) |
| **Color** | ICC Profile Handling (custom engine) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Deployment** | Vercel |

---

## 🚦 Getting Started

### Prerequisites
*   Node.js (LTS)
*   Supabase Account

### Installation
```bash
# Clone the repository
git clone https://github.com/comboworks-ops/webprinter-platform.git

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env # Add your Supabase keys

# Run the project
npm run dev
```

The application will be available at `http://localhost:8080`.

---

## 🗄️ Database Setup (Supabase)

1.  **Migrations**: Run the migrations in order from `supabase/migrations/`.
2.  **Storage**: Create the following public buckets:
    *   `product-images`
    *   `design-library`
    *   `design-saves`
3.  **Edge Functions**:
    ```bash
    supabase functions deploy calculate-machine-price
    ```

---

## 🏁 work Done (Latest Update: 2026-01-29)
*   Implemented **Design Library** for templates, icons, and personal designs.
*   Integrated **Color Profile Soft-Proofing** in the Designer.
*   Launched **Machine Pricing (MPA)** for dynamic large-format and offset pricing.
*   Upgraded **Unified Branding V2** with real-time preview and click-to-edit.
*   Launched **Company Hub (B2B Portal)** for client-specific product reordering.
*   Standardized **Multi-tenant RLS** across the entire database.

---

## 👤 Maintainers
Developed with ❤️ for the next generation of print entrepreneurs.

*   **GitHub**: https://github.com/comboworks-ops/webprinter-platform
*   **Project Overview**: See `docs/PROJECT_OVERVIEW.md` for deep technical details.

---
*Last Edited: January 6, 2026 (Live Development)*
