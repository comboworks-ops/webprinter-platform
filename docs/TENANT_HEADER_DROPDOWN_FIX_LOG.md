# Tenant Header Dropdown Fix Log

Date: 2026-03-06

## Issue
- Tenant storefront header dropdown did not show products.
- Behavior was inconsistent across shops depending on category names.

## Root Cause
- Header menu grouping in `src/components/Header.tsx` was hardcoded to only 3 category keys:
  - `tryksager`
  - `storformat`
  - `tekstiltryk`
- Tenant shops using custom/renamed categories therefore rendered empty product sections.

## Fix Implemented
- Replaced hardcoded category sections with dynamic category grouping based on:
  - published tenant products (`products`)
  - tenant category definitions (`product_categories`)
- Reused shared category normalization/resolution utilities from `src/utils/productCategories.ts`.

## Files Updated
- `src/components/Header.tsx`
  - Added `useMemo` grouping for dynamic sections.
  - Added `product_categories` fetch alongside `products`.
  - Mapped products to resolved category keys/labels.
  - Replaced static dropdown blocks with dynamic render loop.

## Safety Notes
- No pricing logic changed.
- No POD logic changed.
- No schema/database migrations introduced.

## Verification
1. Open tenant storefront.
2. Hard refresh (`Cmd+Shift+R`).
3. Open header product dropdown.
4. Confirm published products appear under tenant category labels.

## Status
- Implemented locally and build-verified.
