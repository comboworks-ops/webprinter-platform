-- Add format column to sticker_rates
ALTER TABLE public.sticker_rates 
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'Standard';