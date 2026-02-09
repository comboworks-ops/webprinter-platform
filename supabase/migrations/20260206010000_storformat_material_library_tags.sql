-- Add tags to storformat material library

ALTER TABLE public.storformat_material_library
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_storformat_material_library_tags
  ON public.storformat_material_library USING GIN(tags);
