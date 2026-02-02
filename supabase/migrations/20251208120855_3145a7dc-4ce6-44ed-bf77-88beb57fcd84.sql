-- Create option groups table for reusable product options
CREATE TABLE public.product_option_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    label text NOT NULL,
    display_type text NOT NULL DEFAULT 'buttons' CHECK (display_type IN ('buttons', 'icon_grid')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    UNIQUE(name)
);

-- Create options within groups
CREATE TABLE public.product_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    label text NOT NULL,
    icon_url text,
    extra_price numeric NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    UNIQUE(group_id, name)
);

-- Link products to option groups
CREATE TABLE public.product_option_group_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    option_group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    is_required boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(product_id, option_group_id)
);

-- Enable RLS
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_group_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for option groups
CREATE POLICY "Anyone can view option groups" ON public.product_option_groups FOR SELECT USING (true);
CREATE POLICY "Only admins can manage option groups" ON public.product_option_groups FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role)) 
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for options
CREATE POLICY "Anyone can view options" ON public.product_options FOR SELECT USING (true);
CREATE POLICY "Only admins can manage options" ON public.product_options FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role)) 
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for assignments
CREATE POLICY "Anyone can view assignments" ON public.product_option_group_assignments FOR SELECT USING (true);
CREATE POLICY "Only admins can manage assignments" ON public.product_option_group_assignments FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role)) 
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update triggers
CREATE TRIGGER update_option_groups_timestamp
BEFORE UPDATE ON public.product_option_groups
FOR EACH ROW EXECUTE FUNCTION public.update_product_timestamp();

CREATE TRIGGER update_options_timestamp
BEFORE UPDATE ON public.product_options
FOR EACH ROW EXECUTE FUNCTION public.update_product_timestamp();