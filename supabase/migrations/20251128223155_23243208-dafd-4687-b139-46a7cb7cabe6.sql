-- Convert sticker_rates from m² pricing to quantity-based pricing
ALTER TABLE public.sticker_rates 
  DROP COLUMN IF EXISTS price_per_sqm,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS price_dkk numeric NOT NULL DEFAULT 0;