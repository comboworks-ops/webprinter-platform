-- Add safe_area_mm column to designer_saved_designs
-- This column was missing from the original migration

ALTER TABLE public.designer_saved_designs 
ADD COLUMN IF NOT EXISTS safe_area_mm NUMERIC DEFAULT 3;

COMMENT ON COLUMN public.designer_saved_designs.safe_area_mm IS 'Safe area margin in mm from trim edge';
