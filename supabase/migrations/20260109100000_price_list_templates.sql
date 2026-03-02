-- Price List Templates Table
-- Stores saved price list template configurations per product

CREATE TABLE IF NOT EXISTS public.price_list_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    spec jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_list_templates_tenant ON public.price_list_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_list_templates_product ON public.price_list_templates(product_id);

-- Enable RLS
ALTER TABLE public.price_list_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant Access" ON public.price_list_templates
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_price_list_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_list_templates_updated_at
    BEFORE UPDATE ON public.price_list_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_price_list_templates_updated_at();
