-- Speed up large generic price-list reads used by storefront pricing and admin price editing.
-- Example: POD/imported products such as "boeger" can have 10k+ generic price rows.
-- Data API: no GRANT/REVOKE needed because this migration creates only an index and comment.
-- Rollback: DROP INDEX IF EXISTS public.idx_generic_product_prices_product_quantity_id;

CREATE INDEX IF NOT EXISTS idx_generic_product_prices_product_quantity_id
ON public.generic_product_prices (product_id, quantity, id);

COMMENT ON INDEX public.idx_generic_product_prices_product_quantity_id IS
'Supports generic price lookups by product_id ordered by quantity/id for large imported price tables.';
