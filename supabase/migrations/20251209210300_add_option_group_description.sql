-- Add description field to product_option_groups table
ALTER TABLE public.product_option_groups 
ADD COLUMN IF NOT EXISTS description text;

-- Add comment
COMMENT ON COLUMN public.product_option_groups.description IS 'Optional description text shown below the option group on the product page';
