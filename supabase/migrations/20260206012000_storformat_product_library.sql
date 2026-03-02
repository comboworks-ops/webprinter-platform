-- Storformat Product Library (shared across products)

CREATE TABLE IF NOT EXISTS public.storformat_product_library (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    tags text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storformat_product_library_tenant ON public.storformat_product_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_product_library_name ON public.storformat_product_library(name);
CREATE INDEX IF NOT EXISTS idx_storformat_product_library_tags ON public.storformat_product_library USING GIN(tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_storformat_product_library_unique
  ON public.storformat_product_library(tenant_id, name);

ALTER TABLE public.storformat_product_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Access" ON public.storformat_product_library
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

DROP TRIGGER IF EXISTS storformat_product_library_updated_at ON public.storformat_product_library;
CREATE TRIGGER storformat_product_library_updated_at
    BEFORE UPDATE ON public.storformat_product_library
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();
