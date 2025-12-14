# Webprinter Platform

A multi-tenant print shop e-commerce platform built with React, TypeScript, and Supabase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app runs on `http://localhost:8080` by default.

---

## 🏗️ Architecture Overview

This is a **multi-tenant SaaS platform** where:
- **Master Admin** manages the main template, products, and branding
- **Tenants** (shop owners) can customize their own storefronts based on the master template

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Master Tenant** | ID: `00000000-0000-0000-0000-000000000000` - The main template |
| **Master Admin** | User with `master_admin` role - can access everything |
| **Tenant** | Individual shop owner with their own subdomain/domain |
| **Branding** | Colors, fonts, logos, hero images - customizable per tenant |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── admin/           # Admin panel components
│   │   ├── AdminSidebar.tsx      # Navigation sidebar
│   │   ├── ProductOverview.tsx   # Product management
│   │   ├── SeoManager.tsx        # SEO settings
│   │   ├── UnifiedBrandingEditor.tsx  # Branding customization
│   │   └── ...
│   ├── ui/              # Reusable UI components (shadcn/ui)
│   └── ...              # Frontend components
├── hooks/
│   ├── useUserRole.tsx  # Role-based access control
│   ├── useBrandingDraft.ts  # Branding state management
│   └── ...
├── lib/
│   ├── adminTenant.ts   # Tenant resolution logic
│   └── branding/        # Branding system utilities
├── pages/
│   ├── Admin.tsx        # Admin dashboard
│   ├── Index.tsx        # Homepage
│   ├── Shop.tsx         # Product catalog
│   └── ...
└── integrations/
    └── supabase/        # Supabase client configuration
```

---

## 🗄️ Database (Supabase)

### Key Tables

| Table | Purpose |
|-------|---------|
| `products` | Product catalog with pricing |
| `tenants` | Shop/tenant configuration |
| `user_roles` | User permissions (admin, master_admin) |
| `page_seo` | SEO metadata per page |
| `orders` | Customer orders |
| `branding_drafts` | Saved branding customizations |

### Master Tenant ID
```
00000000-0000-0000-0000-000000000000
```

### Current Admin User ID
```
be587c26-8ec6-4637-bf90-c3ba916c050b
```

---

## 🔐 Authentication & Roles

### Roles
- `master_admin` - Full access to all tenants and master template
- `admin` - Tenant-level admin access
- `user` - Regular customer

### Role Check Functions
```typescript
// In components
const { isMasterAdmin, isAdmin } = useUserRole();

// Tenant resolution
const { tenantId, isMasterAdmin } = await resolveAdminTenant();
```

---

## ⚠️ Common Issues & Fixes

### Issue: Products/Pages Not Showing in Admin

**Symptom:** Admin panel shows 0 products, 0 pages, or 400 errors in console.

**Cause:** Row-Level Security (RLS) policies blocking access.

**Fix:** Run this SQL in Supabase SQL Editor:

```sql
-- See: supabase/backups/working_rls_policies_20241214.sql

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE SQL STABLE SECURITY DEFINER 
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'master_admin')) $$;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.is_admin());

INSERT INTO public.user_roles (user_id, role) 
VALUES ('be587c26-8ec6-4637-bf90-c3ba916c050b', 'master_admin')
ON CONFLICT DO NOTHING;

UPDATE public.tenants 
SET owner_id = 'be587c26-8ec6-4637-bf90-c3ba916c050b'
WHERE id = '00000000-0000-0000-0000-000000000000';

DROP POLICY IF EXISTS "Admins can manage their tenant products" ON public.products;
CREATE POLICY "Admins can manage their tenant products" ON public.products
FOR ALL TO authenticated
USING (
    (tenant_id = '00000000-0000-0000-0000-000000000000' AND public.is_admin())
    OR EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND owner_id = auth.uid())
);
```

Then **log out and log back in**.

---

## 🔄 Backup & Restore

### Code Backup (GitHub)
```bash
git add -A
git commit -m "Backup description"
git push origin main
```

### Restore Code
```bash
git checkout <commit-hash>
# or
git pull origin main
```

### Database Backup
1. Supabase Dashboard → Project Settings → Database → Backups
2. Or export tables via SQL Editor

### Restore RLS Policies
Run `supabase/backups/working_rls_policies_20241214.sql` in Supabase SQL Editor.

---

## 🛠️ Development Commands

```bash
npm run dev      # Start dev server (port 8080)
npm run build    # Production build
npm run preview  # Preview production build
```

---

## 📦 Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **State:** React hooks, Context API
- **Routing:** React Router v6

---

## 🔗 Important URLs

| Environment | URL |
|-------------|-----|
| Local Dev | http://localhost:8080 |
| Admin Panel | http://localhost:8080/admin |
| Supabase Dashboard | https://supabase.com/dashboard |

---

## 📝 Key Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (Supabase keys) |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `vite.config.ts` | Vite build configuration |
| `supabase/config.toml` | Supabase local configuration |

---

## 👤 Contact / Owner

- **Admin Email:** (check Supabase Auth → Users)
- **GitHub:** https://github.com/comboworks-ops/webprinter-platform

---

*Last updated: December 14, 2024*
