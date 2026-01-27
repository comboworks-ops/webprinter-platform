# Phase 2 Color Management: ICC Color Profiles

## Overview

This feature implements per-tenant ICC CMYK output profiles and allows each product to select a default output profile used by the Designer's "Soft proof (CMYK preview)" mode.

## Files Created/Modified

### Database Migration
- `supabase/migrations/20260128100000_color_profiles.sql`
  - Creates `color_profiles` table with tenant_id, name, kind, storage_path
  - Adds `output_color_profile_id` column to `products` table
  - Implements RLS policies for tenant isolation

### Admin Components
- `src/components/admin/ColorProfilesManager.tsx` - **NEW**
  - Full CRUD for ICC profiles (upload, list, delete)
  - Tenant-scoped profile management
  
- `src/components/admin/ProductColorProfileSelector.tsx` - **NEW**
  - Dropdown selector for assigning profiles to products

### Hooks
- `src/hooks/useProductColorProfile.ts` - **NEW**
  - Fetches product's assigned profile and loads ICC data from storage

- `src/hooks/useColorProofing.ts` - **MODIFIED**
  - Extended to accept custom profile data (per-product)
  - Added `setCustomProfile` and `hasCustomProfile` to return interface

### Designer Integration
- `src/pages/Designer.tsx` - **MODIFIED**
  - Imports and uses `useProductColorProfile` hook
  - Passes custom profile data to `useColorProofing`
  - Shows custom profile indicator in ColorProofingPanel

- `src/components/designer/ColorProofingPanel.tsx` - **MODIFIED**
  - Added `hasCustomProfile` prop
  - Shows purple badge and info box when using product-specific profile
  - Hides default profile selector when custom profile is active

### Types/Config
- `src/lib/color/iccProofing.ts` - **MODIFIED**
  - Extended `ProofingSettings` interface with custom profile fields

### Routes
- `src/pages/Admin.tsx` - **MODIFIED**
  - Added route: `/admin/farveprofiler`

- `src/components/admin/AdminSidebar.tsx` - **MODIFIED**
  - Added sidebar link for "Farveprofiler" under Products section

---

## Storage Bucket Setup

### Create Bucket
In Supabase Dashboard > Storage, create a new bucket:
- **Name:** `color-profiles`
- **Public:** No (private bucket)

### Storage Policies
Add these policies in Supabase Dashboard > Storage > color-profiles > Policies:

#### SELECT (Read) Policy
**Name:** Allow authenticated users to read tenant profiles
```sql
bucket_id = 'color-profiles'
AND auth.uid() IS NOT NULL
AND (
  -- User belongs to the profile's tenant
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
  -- Or profile belongs to master tenant (shared defaults)
  OR (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000000'
)
```

#### INSERT/UPDATE Policy
**Name:** Allow tenant admins to upload profiles
```sql
bucket_id = 'color-profiles'
AND auth.uid() IS NOT NULL
AND EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND tenant_id::text = (storage.foldername(name))[1]
  AND role = 'admin'
)
```

#### DELETE Policy
**Name:** Allow tenant admins to delete profiles
```sql
bucket_id = 'color-profiles'
AND auth.uid() IS NOT NULL
AND EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND tenant_id::text = (storage.foldername(name))[1]
  AND role = 'admin'
)
```

---

## Manual Test Checklist

### Prerequisites
1. Run the migration: `supabase db push` or apply SQL manually
2. Create storage bucket and policies (see above)
3. Have two test tenants + master tenant ready
4. Get a sample ICC profile (e.g., FOGRA39 from ECI)

### Test 1: Admin - Upload Color Profile
- [ ] Log in as Tenant A admin
- [ ] Navigate to `/admin/farveprofiler`
- [ ] Click "Upload profil"
- [ ] Fill in name: "Test Profile A"
- [ ] Select a .icc file
- [ ] Click "Upload"
- [ ] Verify profile appears in list
- [ ] Verify file size and creation date are correct

### Test 2: Admin - View and Delete Profile
- [ ] Profile shows in table with correct name, type, size
- [ ] Click delete button
- [ ] Confirm deletion
- [ ] Verify profile is removed from list
- [ ] Verify storage file is deleted (check Supabase Storage)

### Test 3: Tenant Isolation
- [ ] Log in as Tenant B admin
- [ ] Navigate to `/admin/farveprofiler`
- [ ] Verify NO profiles from Tenant A are visible
- [ ] Upload a new profile as Tenant B
- [ ] Log back in as Tenant A
- [ ] Verify Tenant B's profile is NOT visible

### Test 4: Product Assignment (requires ProductColorProfileSelector integration)
- [ ] Navigate to product admin (e.g., `/admin/product/flyers`)
- [ ] Find "CMYK Output Profil" selector
- [ ] Select the uploaded profile
- [ ] Save product
- [ ] Refresh and verify selection persisted

### Test 5: Designer Auto-Load
- [ ] Navigate to Designer with product ID: `/designer?productId=xxx`
- [ ] Open "Farver" tab in right panel
- [ ] Verify "Produkt" badge appears next to "Soft Proof"
- [ ] Verify purple info box shows: "Produktets farveprofil: [name]"
- [ ] Enable soft proof toggle
- [ ] Verify CMYK preview activates

### Test 6: Fallback (No Profile)
- [ ] Navigate to Designer without productId: `/designer`
- [ ] Open "Farver" tab
- [ ] Verify NO "Produkt" badge appears
- [ ] Verify standard profile selector is visible (FOGRA39, etc.)
- [ ] Enable soft proof - should work with default profile

### Test 7: Profile Error Handling
- [ ] Delete a profile that is assigned to a product (via SQL or Supabase)
- [ ] Navigate to Designer with that product
- [ ] Verify toast shows "Farveprofil kunne ikke indlæses - bruger standard profil"
- [ ] Verify soft proof still works with fallback

---

## TypeScript Note

The lint errors about `SelectQueryError` are expected and will resolve after:
1. Running the migration on Supabase
2. Regenerating Supabase types: `supabase gen types typescript --local`

The `as any` casts in the code are the standard pattern used throughout this codebase for tables not yet in generated types.

---

## Future Enhancements

1. **lcms-wasm Integration:** Replace the simplified simulation with actual ICC transforms using the loaded profile bytes
2. **RGB Working Space Profiles:** Support for sRGB, Adobe RGB selection
3. **Profile Validation:** Parse ICC headers to validate profile type on upload
4. **Bulk Assignment:** Assign same profile to multiple products at once
5. **Master Default Profiles:** Allow master admin to provide shared/default profiles for all tenants
