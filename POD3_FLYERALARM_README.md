# POD v3 - Flyer Alarm Integration

## Overview
Flyer Alarm PRO integration for extended product catalog. Displays Flyer Alarm products with configuration options and "contact for quote" workflow.

## Architecture
- **Edge Function**: `pod3-flyeralarm-request` - Proxies API calls to Flyer Alarm
- **API Token**: Stored in Supabase secrets (`FLYERALARM_DEMO_TOKEN`)
- **Frontend Components**:
  - `FlyerAlarmShowcase` - Homepage product grid
  - `FlyerAlarmProductCard` - Individual product cards
  - `FlyerAlarmProductDetail` - Product detail page with configurator
  - `useFlyerAlarmProducts` - Hook for fetching products
- **Admin**: `/admin/pod3` - API explorer and catalog browser

## Feature Toggle
Controlled via Settings → Features → "Flyer Alarm integration" (`settings.pod3.showOnHomepage`)

## Data Flow
1. Product groups fetched from `/catalog/groups`
2. Configurator data from `/catalog/groups/{id}/configurator`
3. Only products with working configurators are displayed (filterWorking: true)
4. User selects options → API filters available variants
5. No pricing in API → "Kontakt for tilbud" CTA

## API Limitations
- Configurator returns `attributes` with available options
- No pricing endpoint exposed
- No variant detail endpoints available
- All configuration is read-only

## URLs
- Homepage showcase: `/` (Shop.tsx)
- Product detail: `/flyeralarm-produkt/:productId`
- Admin: `/admin/pod3`

## Safety
- Completely isolated from existing product/pricing systems
- No checkout integration
- No database writes
- Easy removal: delete component from Shop.tsx

## Status
Working but limited by Flyer Alarm API - shows configuration options but no pricing. Requires manual quote workflow.
