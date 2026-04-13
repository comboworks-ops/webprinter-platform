-- Seed default Icon Studio premium access for the current master setup.
-- Rollback:
-- delete from public.tenant_module_access
-- where module_id = 'icon-studio'
--   and tenant_id in (
--     '00000000-0000-0000-0000-000000000000',
--     '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba',
--     '7cb851f5-c792-40b1-a79a-1f7c7b5f668c'
--   );

insert into public.tenant_module_access (
    tenant_id,
    module_id,
    has_access,
    is_enabled,
    access_source,
    notes
)
values
    (
        '00000000-0000-0000-0000-000000000000',
        'icon-studio',
        true,
        true,
        'included',
        'Included by default for the master tenant Icon Studio rollout.'
    ),
    (
        '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba',
        'icon-studio',
        true,
        true,
        'included',
        'Included by default for the salgsmapper.dk tenant Icon Studio rollout.'
    ),
    (
        '7cb851f5-c792-40b1-a79a-1f7c7b5f668c',
        'icon-studio',
        true,
        true,
        'included',
        'Included by default for the onlinetryksager.dk tenant Icon Studio rollout.'
    )
on conflict (tenant_id, module_id)
do update set
    has_access = excluded.has_access,
    is_enabled = excluded.is_enabled,
    access_source = excluded.access_source,
    notes = excluded.notes,
    updated_at = now();
