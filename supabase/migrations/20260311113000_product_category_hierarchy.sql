-- Add optional hierarchy + navigation mode to product categories.
--
-- Purpose:
-- - Keep the existing overview/category model
-- - Allow categories to have child categories (subcategories)
-- - Allow a category landing to either show everything on one page
--   or force navigation through child menus first
--
-- Rollback note:
-- - Drop the trigger/indexes if added later
-- - Drop columns `parent_category_id` and `navigation_mode`
-- - Existing category rows can remain; this migration is additive

ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS parent_category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS navigation_mode text NOT NULL DEFAULT 'all_in_one';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'product_categories_navigation_mode_check'
    ) THEN
        ALTER TABLE public.product_categories
        ADD CONSTRAINT product_categories_navigation_mode_check
        CHECK (navigation_mode IN ('all_in_one', 'submenu'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_product_categories_parent_category_id
ON public.product_categories(parent_category_id);

UPDATE public.product_categories
SET navigation_mode = 'all_in_one'
WHERE navigation_mode IS NULL;
