# Multi-Tenant Isolation Rules & Architecture
*Last Updated: 2026-01-31*

## 🎯 The Core Philosophy
This platform follows a strict **"One Master, Many Shops"** architecture.

1.  **Master Tenant (WebPrinter)**: The "God Mode" environment. Only here can you create tenants, manage global platform designs (POD), and update system-wide settings.
2.  **Standard Tenants (e.g., Online Tryksager, Salgsmapper)**: Independent shops. They have **zero** visibility into each other or the Master Tenant's data.

---

## 🛑 The "Iron Rules" of Isolation

### 1. Identity Separation (User A vs. User B)
To prevent confusion, we enforce strict ownership separation:
*   **User A (Admin)**: Owns **Salgsmapper** (and technically the Master Tenant).
*   **User B (Admin)**: Owns **Online Tryksager**.
*   **User C (Customer)**: Belongs to a specific shop.

**Rule**: A user logged into Shop X *cannot* accidentally affect Shop Y. The system now strictly checks `owner_id` and refuses fallback to Master.

### 2. The "Role Masking" Protocol
*Problem*: A **Master Admin** (like User A) has permission to do everything. If they log into a regular shop (Salgsmapper), the UI used to show "Platform Tools" (POD v2, Global Designs).
*Fix*: We implemented **Context-Aware Role Masking**.

*   **Logic**: If `User == Master Admin` **BUT** `Tenant != Master Tenant`:
    *   System **downgrades** role to `admin` (Regular Admin).
    *   Result: The UI looks essentially identical to a standard tenant.
    *   Benefit: You can manage Salgsmapper without being distracted by Platform Tools.

### 3. Localhost Resolution Priority
When you visit `localhost:8080`, the system must guess which shop you want to see.
**Old Logic (Broken)**: "Are you Master Admin? Yes? -> Show Master Tenant."
**New Logic (Fixed)**:
1.  **Check for "Real" Shops First**: Does this user own a standard shop (e.g., Salgsmapper, Online Tryksager)?
2.  **Platform Shops Allowed**: We allow shops like "Salgsmapper" (`is_platform_owned=true`) to be selected, *provided* they are not the Master ID.
3.  **Master Tenant = Last Resort**: We ONLY show the Master Tenant if you own *nothing else*.

---

## 🛠️ Summary of Fixes (January 2026)

We resolved a critical issue where "Salgsmapper" and "Online Tryksager" felt "connected" to the Master Tenant.

### 1. Database & Permissions
*   **Fixed Ownership**: Transferred "Online Tryksager" to a dedicated user (`c85c...`) to prevent identity merging.
*   **Storefront Access**: Added `enable_public_storefront_access.sql` to allow anonymous visitors (customers) to seeing products and prices (RLS Policies).
*   **Settings Persistence**: Added Missing RLS policies to the `tenants` table so owners can save changes like "Company Name".

### 2. Frontend Logic (`src/hooks/useShopSettings.ts`)
*   **Removed Master Priority**: Deleted logic that forced Master Admins into the Master Tenant.
*   **Relaxed Filters**: Updated the tenant filter to allows Platform-owned shops (like Salgsmapper) to be the default view, as long as they aren't the Master Tenant ID.

### 3. Backend Logic (`src/lib/adminTenant.ts`)
*   **Mirror Logic**: Ensured the backend (Supabase calls) follows the same priority: `Real Shop > Master Tenant`.
*   **Prevented Overwrites**: Stopped the system from overriding a valid Tenant ID with the Master ID just because the user keyholder is a Master Admin.

### 4. Codebase Masks (`src/hooks/useUserRole.tsx`)
*   **Context Awareness**: Added logic to `useUserRole` that checks `resolveAdminTenant()`.
*   **Downgrade Trigger**: If `tenant != MASTER_ID`, return `isMasterAdmin: false`. This cleans up the Sidebar and Dashboard.

---

## 🚀 How to Maintain This
1.  **Don't Revert Priorities**: In `useShopSettings.ts`, always ensure `realShops` are checked *before* falling back to Master.
2.  **Keep Users Separate**: Ideally, keep "Online Tryksager" and "Salgsmapper" owned by different `owner_id`s in the database for maximum safety.
3.  **RLS is King**: Never disable Row Level Security. If things "disappear", check policies, don't just open the gates.
