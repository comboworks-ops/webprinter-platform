
-- Create Notification Table
CREATE TABLE public.tenant_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id),
    type TEXT CHECK (type IN ('message', 'product_update', 'system_alert')),
    title TEXT NOT NULL,
    content TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can view own notifications" 
ON public.tenant_notifications FOR SELECT 
USING (public.check_tenant_access(tenant_id));

CREATE POLICY "Tenants can update own notifications" 
ON public.tenant_notifications FOR UPDATE
USING (public.check_tenant_access(tenant_id));

-- Trigger Function
CREATE OR REPLACE FUNCTION public.notify_tenants_of_product_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t record;
BEGIN
    IF (OLD.is_available_to_tenants = false AND NEW.is_available_to_tenants = true) THEN
        FOR t IN SELECT id FROM public.tenants WHERE id != NEW.tenant_id LOOP
             INSERT INTO public.tenant_notifications (tenant_id, type, title, content, data)
             VALUES (
                t.id, 
                'product_update', 
                'Nyt Produkt Tilgængeligt', 
                format('Produktet "%s" er nu frigivet. Gennemse og importer det til din shop.', NEW.name),
                jsonb_build_object('product_id', NEW.id, 'slug', NEW.slug, 'product_name', NEW.name)
             );
        END LOOP;
    END IF;
    RETURN NEW;
$$;

CREATE TRIGGER on_product_release
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_tenants_of_product_release();

-- Update Sync Function to accept a specific product slug (Optional, for granular accept)
-- Or we just keep the bulk sync for now.


CREATE OR REPLACE FUNCTION public.sync_specific_product(target_tenant_id uuid, product_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO public.products (
        tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at
    )
    SELECT 
        target_tenant_id, m.name, m.slug, m.description, m.category, m.pricing_type, m.image_url, false, now(), now()
    FROM public.products m
    WHERE m.tenant_id = master_id
      AND m.slug = product_slug
      AND NOT EXISTS (SELECT 1 FROM public.products t WHERE t.tenant_id = target_tenant_id AND t.slug = m.slug);
END;
$$;

