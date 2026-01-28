-- Create a generic product prices table for products without specific price tables
CREATE TABLE public.generic_product_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_name text NOT NULL,
    variant_value text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    price_dkk numeric NOT NULL,
    extra_data jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    UNIQUE(product_id, variant_name, variant_value, quantity)
);

-- Enable RLS
ALTER TABLE public.generic_product_prices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view generic product prices" ON public.generic_product_prices FOR SELECT USING (true);
CREATE POLICY "Only admins can manage generic product prices" ON public.generic_product_prices FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role)) 
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger
CREATE TRIGGER update_generic_product_prices_timestamp
BEFORE UPDATE ON public.generic_product_prices
FOR EACH ROW EXECUTE FUNCTION public.update_product_timestamp();