-- Add display_mode column to product_pricing_configs
-- This controls how the storefront renders the price selection UI (MATRIX vs SELECTION)

ALTER TABLE public.product_pricing_configs 
ADD COLUMN IF NOT EXISTS display_mode TEXT 
CHECK (display_mode IN ('MATRIX', 'SELECTION')) 
DEFAULT 'SELECTION';

-- Update existing MACHINE_PRICED products to use SELECTION mode by default
UPDATE public.product_pricing_configs 
SET display_mode = 'SELECTION' 
WHERE display_mode IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
