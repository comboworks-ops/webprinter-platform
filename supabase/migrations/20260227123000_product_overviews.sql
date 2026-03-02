-- Product Overviews: top-level containers for organizing product categories in admin
-- Additive only. Does not touch product pricing logic.

-- 1) Top-level overviews per tenant
CREATE TABLE IF NOT EXISTS public.product_overviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, slug)
);

ALTER TABLE public.product_overviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Access" ON public.product_overviews;
CREATE POLICY "Tenant Access" ON public.product_overviews
FOR ALL
USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Public Select" ON public.product_overviews;
CREATE POLICY "Public Select" ON public.product_overviews
FOR SELECT TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_product_overviews_tenant
ON public.product_overviews(tenant_id);

-- 2) Link categories to overviews
ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS overview_id uuid REFERENCES public.product_overviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_overview_id
ON public.product_categories(overview_id);

-- 3) Seed one default overview per tenant already using categories
INSERT INTO public.product_overviews (tenant_id, name, slug, sort_order)
SELECT DISTINCT pc.tenant_id, 'Produkter', 'produkter', 0
FROM public.product_categories pc
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 4) Backfill existing categories into default overview
UPDATE public.product_categories pc
SET overview_id = po.id
FROM public.product_overviews po
WHERE pc.overview_id IS NULL
  AND po.tenant_id = pc.tenant_id
  AND po.slug = 'produkter';

-- 5) Ensure new categories get a default overview automatically if not specified
CREATE OR REPLACE FUNCTION public.product_categories_set_default_overview()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.overview_id IS NULL THEN
    SELECT po.id
      INTO NEW.overview_id
    FROM public.product_overviews po
    WHERE po.tenant_id = NEW.tenant_id
    ORDER BY po.sort_order ASC NULLS LAST, po.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_categories_set_default_overview ON public.product_categories;
CREATE TRIGGER trg_product_categories_set_default_overview
BEFORE INSERT ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.product_categories_set_default_overview();
