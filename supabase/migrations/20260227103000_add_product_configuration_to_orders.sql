-- Add optional per-order product configuration text (non-pricing metadata).
-- This is additive and safe for existing orders.
--
-- Rollback:
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS product_configuration;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS product_configuration text;

COMMENT ON COLUMN public.orders.product_configuration IS
'Optional product configuration text for order slips/confirmation (e.g., T-shirt size distribution).';

