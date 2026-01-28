-- Add thumbnail support for storformat catalog items

ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.storformat_finishes
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.storformat_products
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
