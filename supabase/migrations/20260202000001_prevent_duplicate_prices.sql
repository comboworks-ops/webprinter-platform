-- Migration: Prevent duplicate generic product prices
-- This prevents the "ON CONFLICT DO UPDATE command cannot affect row a second time" error
-- for price inserts by ensuring unique combinations

-- Add unique constraint to prevent duplicate prices
-- Two price entries are considered duplicates if they have the same:
-- - product_id
-- - variant_name
-- - variant_value
-- - quantity

CREATE UNIQUE INDEX IF NOT EXISTS idx_generic_product_prices_unique
ON public.generic_product_prices (
    product_id,
    variant_name,
    variant_value,
    quantity
);

-- Add a helpful comment
COMMENT ON INDEX idx_generic_product_prices_unique IS
'Prevents duplicate price entries for the same product variant and quantity combination. ' ||
'Ensures upsert operations do not fail with "cannot affect row a second time" error.';
