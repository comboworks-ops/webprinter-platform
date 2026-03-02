-- Storformat product tags support

ALTER TABLE public.storformat_products
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_storformat_products_tags
  ON public.storformat_products USING GIN(tags);
