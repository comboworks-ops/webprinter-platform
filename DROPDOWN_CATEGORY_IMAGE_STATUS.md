# Dropdown Category Image Feature - Status Log

## Goal
Allow users to replace category text ("Tryk sager", "Stor format", "Plakater", etc.) in the dropdown menu with images.

## What Was Implemented

### 1. Type Definitions (`src/hooks/useBrandingDraft.ts`)
Added to `HeaderSettings` interface:
```typescript
dropdownCategoryImages?: Record<string, string | null>; // Category key -> image URL mapping
dropdownCategoryDisplayMode?: 'text' | 'image' | 'both'; // Show text, image, or both for categories
```

### 2. UI in HeaderSection (`src/components/admin/HeaderSection.tsx`)
- Added "Kategori billeder" section in "Dropdown kategorier" panel
- Display mode toggle: "Kun tekst" / "Kun billede" / "Begge"
- File upload inputs for 6 predefined categories:
  - Tryk sager
  - Stor format
  - Plakater
  - Tekstil tryk
  - Skilte
  - Folie

### 3. Storage Upload (`src/components/admin/HeaderSection.tsx`)
- Uses `product-images` bucket
- File path: `header-dropdown-${timestamp}.${ext}`

### 4. Header Rendering (`src/components/Header.tsx`)
- Updated both dropdown views (rich menu and tile view)
- Checks for `dropdownCategoryImages` and `dropdownCategoryDisplayMode`
- Shows image when display mode is 'image' or 'both' AND image URL exists

## Current Issues

### 1. Image Not Showing
The category images are not appearing in the dropdown. Possible causes:
- `section.key` matching issue - the category keys from data may not match the predefined keys
- The rich dropdown (`usesRichDropdownMenu`) may be using different section keys than expected
- The mapping logic may need to be more flexible with key matching

### 2. Key Mapping
The predefined keys in HeaderSection.tsx are:
```javascript
{ key: 'tryksager', label: 'Tryk sager' },
{ key: 'storformat', label: 'Stor format' },
{ key: 'plakater', label: 'Plakater' },
{ key: 'tekstil', label: 'Tekstil tryk' },
{ key: 'skilte', label: 'Skilte' },
{ key: 'folie', label: 'Folie' },
```

But the actual `section.key` values from `desktopProductSections` or `groupedProductSections` may be different (e.g., uppercase, different format, or using category slugs).

### 3. Display Logic
Current logic in Header.tsx:
```typescript
const sectionKey = section.key.toLowerCase();
const categoryImageUrl = categoryImages[sectionKey] || categoryImages[sectionKey.replace(/[^a-z]/g, '')];
```

This may not match the stored keys correctly.

## What Needs To Be Done

### Option A: Fix Key Matching
1. Log the actual `section.key` values being used
2. Update the key matching logic to use the correct keys
3. May need to use category slugs or IDs instead of hardcoded keys

### Option B: Dynamic Category List
Instead of hardcoded categories, generate the list dynamically from actual product sections:
1. Get unique categories from products
2. Create upload inputs for each unique category
3. Store using the actual section keys

### Option C: Simplify Storage
Instead of `dropdownCategoryImages` record, store images directly on the category/group data structure.

## Files Modified
1. `src/hooks/useBrandingDraft.ts` - Added type definitions
2. `src/components/admin/HeaderSection.tsx` - Added UI for upload
3. `src/components/Header.tsx` - Added rendering logic
4. `src/lib/siteDesignTargets.ts` - Updated click target mapping

## Next Steps
To complete this feature:
1. Debug the actual section.key values
2. Fix the key matching between storage and rendering
3. Test with actual uploaded images
4. Verify both dropdown views work correctly
