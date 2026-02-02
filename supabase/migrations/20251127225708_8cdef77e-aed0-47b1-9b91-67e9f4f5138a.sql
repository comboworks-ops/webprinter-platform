-- Add About section fields and pricing configuration to products table
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
COMMENT ON COLUMN public.products.banner_config IS 'Configuration for banner pricing including dimension ranges, base prices, calc mode, and adjustments';