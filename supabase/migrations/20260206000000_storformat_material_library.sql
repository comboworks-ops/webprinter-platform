-- Storformat Material Library (shared across products)

CREATE TABLE IF NOT EXISTS public.storformat_material_library (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    max_width_mm numeric,
    max_height_mm numeric,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storformat_material_library_tenant ON public.storformat_material_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_material_library_name ON public.storformat_material_library(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_storformat_material_library_unique
  ON public.storformat_material_library(tenant_id, name, max_width_mm, max_height_mm);

ALTER TABLE public.storformat_material_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Access" ON public.storformat_material_library
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

DROP TRIGGER IF EXISTS storformat_material_library_updated_at ON public.storformat_material_library;
CREATE TRIGGER storformat_material_library_updated_at
    BEFORE UPDATE ON public.storformat_material_library
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();
