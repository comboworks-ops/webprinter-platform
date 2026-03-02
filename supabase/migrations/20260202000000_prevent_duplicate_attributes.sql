-- Migration: Prevent duplicate product attribute values
-- This prevents the "ON CONFLICT DO UPDATE command cannot affect row a second time" error
-- by ensuring unique combinations of (product_id, group_id, name, width_mm, height_mm)

-- Add unique constraint to prevent duplicate attribute values
-- Two values are considered duplicates if they have the same:
-- - product_id
-- - group_id
-- - name
-- - width_mm (or both null)
-- - height_mm (or both null)

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_attribute_values_unique
ON public.product_attribute_values (
    product_id,
    group_id,
    name,
    COALESCE(width_mm::text, ''),
    COALESCE(height_mm::text, '')
);

-- Add a helpful comment
COMMENT ON INDEX idx_product_attribute_values_unique IS
'Prevents duplicate attribute values within the same product group. ' ||
'Two values are duplicates if they share product_id, group_id, name, and dimensions.';
