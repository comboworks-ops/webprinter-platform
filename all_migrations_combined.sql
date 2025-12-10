-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create table for folder prices
CREATE TABLE public.folder_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format TEXT NOT NULL,
    paper TEXT NOT NULL,
    fold_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_dkk NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE (format, paper, fold_type, quantity)
);

-- Enable RLS on folder_prices
ALTER TABLE public.folder_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for folder_prices
CREATE POLICY "Anyone can view folder prices"
ON public.folder_prices
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Only admins can update folder prices"
ON public.folder_prices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to update price timestamp
CREATE OR REPLACE FUNCTION public.update_folder_price_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_folder_prices_timestamp
BEFORE UPDATE ON public.folder_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_folder_price_timestamp();-- Allow first user to grant themselves admin role
-- This policy allows insert into user_roles when there are no existing admins
CREATE POLICY "Allow first admin signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
);-- Create profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  company text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to update timestamp on profile update
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_timestamp();-- Add DELETE policy for profiles table
-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);-- Create table for business card (visitkort) prices
CREATE TABLE IF NOT EXISTS public.visitkort_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_dkk NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(paper, quantity)
);

-- Create table for poster (plakater) rates
CREATE TABLE IF NOT EXISTS public.poster_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for sticker (klistermærker) rates
CREATE TABLE IF NOT EXISTS public.sticker_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for sign (skilte) rates
CREATE TABLE IF NOT EXISTS public.sign_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for banner rates
CREATE TABLE IF NOT EXISTS public.banner_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for beach flag prices
CREATE TABLE IF NOT EXISTS public.beachflag_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size TEXT NOT NULL,
  system TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(size, system)
);

-- Create table for booklet (hæfter) configuration
CREATE TABLE IF NOT EXISTS public.booklet_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  paper TEXT NOT NULL,
  pages TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(format, paper, pages)
);

-- Create table for sales folder (salgsmapper) configuration
CREATE TABLE IF NOT EXISTS public.salesfolder_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  paper TEXT NOT NULL,
  side_type TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(format, paper, side_type)
);

-- Enable RLS on all tables
ALTER TABLE public.visitkort_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beachflag_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booklet_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesfolder_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Anyone can view visitkort prices" ON public.visitkort_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can view poster rates" ON public.poster_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view sticker rates" ON public.sticker_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view sign rates" ON public.sign_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view banner rates" ON public.banner_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view beachflag prices" ON public.beachflag_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can view booklet rates" ON public.booklet_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view salesfolder rates" ON public.salesfolder_rates FOR SELECT USING (true);

-- Create RLS policies for admin management
CREATE POLICY "Only admins can manage visitkort prices" ON public.visitkort_prices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage poster rates" ON public.poster_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage sticker rates" ON public.sticker_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage sign rates" ON public.sign_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage banner rates" ON public.banner_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage beachflag prices" ON public.beachflag_prices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage booklet rates" ON public.booklet_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage salesfolder rates" ON public.salesfolder_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for timestamp updates
CREATE TRIGGER update_visitkort_prices_timestamp BEFORE UPDATE ON public.visitkort_prices FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_poster_rates_timestamp BEFORE UPDATE ON public.poster_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_sticker_rates_timestamp BEFORE UPDATE ON public.sticker_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_sign_rates_timestamp BEFORE UPDATE ON public.sign_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_banner_rates_timestamp BEFORE UPDATE ON public.banner_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_beachflag_prices_timestamp BEFORE UPDATE ON public.beachflag_prices FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_booklet_rates_timestamp BEFORE UPDATE ON public.booklet_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_salesfolder_rates_timestamp BEFORE UPDATE ON public.salesfolder_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tryksager', 'storformat')),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('matrix', 'rate', 'formula', 'fixed', 'custom-dimensions')),
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view published products
CREATE POLICY "Anyone can view published products"
ON public.products
FOR SELECT
USING (is_published = true);

-- Admins can view all products
CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage products
CREATE POLICY "Only admins can manage products"
ON public.products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_product_timestamp();

-- Seed existing products from productMetadata
INSERT INTO public.products (name, slug, description, category, pricing_type, image_url, is_published) VALUES
('Flyers', 'flyers', 'Professionelle flyers i høj kvalitet til markedsføring og information.', 'tryksager', 'matrix', '/src/assets/products/flyers.png', true),
('Foldere', 'foldere', 'Foldere med forskellige falsetyper og formater.', 'tryksager', 'matrix', '/src/assets/products/foldere.png', true),
('Plakater', 'plakater', 'Plakater i forskellige størrelser og papirkvaliteter.', 'tryksager', 'rate', '/src/assets/products/plakater.png', true),
('Klistermærker', 'klistermærker', 'Klistermærker i vinyl, plast eller papir.', 'tryksager', 'rate', '/src/assets/products/klistermaerker.png', true),
('Hæfter', 'haefter', 'Hæfter med varierende sidetal og formater.', 'tryksager', 'formula', '/src/assets/products/haefter.png', true),
('Salgsmapper', 'salgsmapper', 'Professionelle salgsmapper til præsentationer.', 'tryksager', 'formula', '/src/assets/products/salgsmapper.png', true),
('Visitkort', 'visitkort', 'Visitkort i standard størrelse med forskellige papirkvaliteter.', 'tryksager', 'matrix', '/src/assets/products/visitkort.png', true),
('Bannere', 'bannere', 'Bannere i PVC, mesh eller tekstil til indendørs og udendørs brug.', 'storformat', 'custom-dimensions', '/src/assets/products/bannere.png', true),
('Beachflag', 'beachflag', 'Beachflag i forskellige størrelser med komplet system.', 'storformat', 'fixed', '/src/assets/products/beachflag.png', true),
('Skilte', 'skilte', 'Skilte i forskellige materialer og størrelser.', 'storformat', 'rate', '/src/assets/products/skilte.png', true),
('Folie', 'folie', 'Folie til vinduer og vægge i mat eller glans.', 'storformat', 'fixed', '/src/assets/products/folie.png', true),
('Messeudstyr', 'messeudstyr', 'Roll-ups, diske og messevægge til events.', 'storformat', 'fixed', '/src/assets/products/messeudstyr.png', true),
('Displayplakater', 'displayplakater', 'Store displayplakater til messestande og udstillinger.', 'storformat', 'fixed', '/src/assets/products/displayplakater.png', true);-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
);

-- RLS policies for product images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);-- Add About section fields and pricing configuration to products table
ALTER TABLE public.products 
ADD COLUMN about_title TEXT,
ADD COLUMN about_description TEXT,
ADD COLUMN about_image_url TEXT,
ADD COLUMN default_variant TEXT,
ADD COLUMN default_quantity INTEGER,
ADD COLUMN banner_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.about_title IS 'Title for the About section displayed on product pages';
COMMENT ON COLUMN public.products.about_description IS 'Rich text description for the About section';
COMMENT ON COLUMN public.products.about_image_url IS 'Image URL for the About section';
COMMENT ON COLUMN public.products.default_variant IS 'Default variant (e.g., paper type) for matrix pricing products to show on homepage';
COMMENT ON COLUMN public.products.default_quantity IS 'Default quantity for matrix pricing products to show on homepage';
COMMENT ON COLUMN public.products.banner_config IS 'Configuration for banner pricing including dimension ranges, base prices, calc mode, and adjustments';-- Convert sticker_rates from m² pricing to quantity-based pricing
ALTER TABLE public.sticker_rates 
  DROP COLUMN IF EXISTS price_per_sqm,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS price_dkk numeric NOT NULL DEFAULT 0;-- Add format column to sticker_rates
ALTER TABLE public.sticker_rates 
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'Standard';-- Create tiered pricing table for banners with discount support
CREATE TABLE IF NOT EXISTS public.banner_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT banner_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT banner_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Create tiered pricing table for signs with discount support
CREATE TABLE IF NOT EXISTS public.sign_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT sign_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT sign_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Create tiered pricing table for foil with discount support
CREATE TABLE IF NOT EXISTS public.foil_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT foil_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT foil_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Enable Row Level Security
ALTER TABLE public.banner_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foil_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for banner_prices
CREATE POLICY "Anyone can view banner prices"
  ON public.banner_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage banner prices"
  ON public.banner_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for sign_prices
CREATE POLICY "Anyone can view sign prices"
  ON public.sign_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage sign prices"
  ON public.sign_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for foil_prices
CREATE POLICY "Anyone can view foil prices"
  ON public.foil_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage foil prices"
  ON public.foil_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));-- Create enum for custom field types
CREATE TYPE public.custom_field_type AS ENUM ('number', 'boolean');

-- Create table for custom field definitions
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type custom_field_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  default_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT custom_fields_unique_per_product UNIQUE (product_id, field_name)
);

-- Create table for custom field values (polymorphic association)
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT custom_field_values_unique_per_record UNIQUE (custom_field_id, table_name, record_id)
);

-- Enable Row Level Security
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- Policies for custom_fields
CREATE POLICY "Anyone can view custom fields"
  ON public.custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage custom fields"
  ON public.custom_fields FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for custom_field_values
CREATE POLICY "Anyone can view custom field values"
  ON public.custom_field_values FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage custom field values"
  ON public.custom_field_values FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_custom_fields_product_id ON public.custom_fields(product_id);
CREATE INDEX idx_custom_field_values_custom_field_id ON public.custom_field_values(custom_field_id);
CREATE INDEX idx_custom_field_values_record ON public.custom_field_values(table_name, record_id);-- Create table for poster formats with unit pricing
CREATE TABLE IF NOT EXISTS public.poster_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  format text NOT NULL,
  paper text NOT NULL,
  quantity integer NOT NULL,
  price_dkk numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT poster_prices_unique_combination UNIQUE (format, paper, quantity)
);

-- Enable Row Level Security
ALTER TABLE public.poster_prices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view poster prices"
  ON public.poster_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage poster prices"
  ON public.poster_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better performance
CREATE INDEX idx_poster_prices_format_paper ON public.poster_prices(format, paper);-- Create storage bucket for product templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-templates', 'product-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product templates
CREATE POLICY "Anyone can view product templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-templates');

CREATE POLICY "Only admins can upload product templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Only admins can update product templates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Only admins can delete product templates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Add template files column to products table
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS template_files jsonb DEFAULT '[]'::jsonb;-- Add tooltip columns to products table
ALTER TABLE public.products 
ADD COLUMN tooltip_product text,
ADD COLUMN tooltip_price text,
ADD COLUMN tooltip_quick_tilbud text;-- Add quantity column to beachflag_prices for quantity-based pricing
ALTER TABLE public.beachflag_prices 
ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Update existing records to have quantity = 1 (base price is for 1 unit)
UPDATE public.beachflag_prices SET quantity = 1 WHERE quantity IS NULL;

-- Create index for efficient queries
CREATE INDEX idx_beachflag_prices_size_system_quantity ON public.beachflag_prices(size, system, quantity);-- Create option groups table for reusable product options
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
FOR EACH ROW EXECUTE FUNCTION public.update_product_timestamp();-- Create a generic product prices table for products without specific price tables
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