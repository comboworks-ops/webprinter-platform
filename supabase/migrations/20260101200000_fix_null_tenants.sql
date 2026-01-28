-- Backfill existing products to belong to Master Tenant
UPDATE public.products
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;
