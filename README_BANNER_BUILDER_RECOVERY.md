# Banner Builder Pro Recovery README

Last updated: 2026-02-18

## Purpose

This runbook restores the original Webprinter demo storformat products on master and keeps Banner Builder Pro products isolated to the Banner Builder Pro site context.

## What changed in code

The following fixes are already implemented:

1. Full site detach now removes all site mapping markers, not only `siteIds`.
2. Banner sync only manages strict Banner products (`banner-builder-` slug + Banner sync source + site-exclusive).
3. Legacy contaminated products with Banner sync marker but non-Banner slug are detached from Banner context during sync.
4. Storformat default Banner finish seeding is now limited to strict Banner-managed products only.

## Cleanup procedure (recommended first)

1. Open Admin on master tenant.
2. Go to Product Overview.
3. Set site context to `Banner Builder Pro`.
4. Run Banner Builder Pro default sync once.

Expected result:
- Banner products stay in Banner Builder Pro context.
- Legacy/master products are detached from Banner context if they were incorrectly tagged.

## Restore original master storformat products (if missing)

Run this in Supabase SQL editor (idempotent: safe to run multiple times):

```sql
with legacy(name, slug, description, category, pricing_type, image_url) as (
  values
    ('Bannere', 'bannere', 'Bannere i PVC, mesh eller tekstil til indendors og udendors brug.', 'storformat', 'custom-dimensions', '/src/assets/products/bannere.png'),
    ('Beachflag', 'beachflag', 'Beachflag i forskellige storrelser med komplet system.', 'storformat', 'fixed', '/src/assets/products/beachflag.png'),
    ('Skilte', 'skilte', 'Skilte i forskellige materialer og storrelser.', 'storformat', 'rate', '/src/assets/products/skilte.png'),
    ('Folie', 'folie', 'Folie til vinduer og vaegge i mat eller glans.', 'storformat', 'fixed', '/src/assets/products/folie.png'),
    ('Messeudstyr', 'messeudstyr', 'Roll-ups, diske og messevaegge til events.', 'storformat', 'fixed', '/src/assets/products/messeudstyr.png'),
    ('Displayplakater', 'displayplakater', 'Store displayplakater til messestande og udstillinger.', 'storformat', 'fixed', '/src/assets/products/displayplakater.png')
)
insert into public.products (
  tenant_id, name, slug, description, category, pricing_type, image_url, icon_text, is_published
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, name, slug, description, category, pricing_type, image_url, name, true
from legacy
on conflict (tenant_id, slug) do nothing;
```

## Publish sequence

1. Publish master homepage.
2. Hard refresh browser (or open in private window).
3. Verify storefront now shows master demo products instead of Banner demo products.

## Verification checklist

- Master homepage shows legacy Webprinter demo storformat products.
- Banner Builder Pro products only show in Banner Builder Pro site context.
- Backend `all` view does not mix site-managed products into normal catalog (unless explicitly toggled on).
- Editing storformat for non-Banner products does not auto-seed Banner defaults.

## Quick diagnostics (optional)

Find products still carrying Banner sync marker but non-Banner slug:

```sql
select id, name, slug, technical_specs
from public.products
where tenant_id = '00000000-0000-0000-0000-000000000000'
  and technical_specs::text ilike '%banner-builder-pro-defaults-v1%'
  and slug not like 'banner-builder-%';
```
