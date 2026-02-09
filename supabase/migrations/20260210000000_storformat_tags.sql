-- Storformat Tags & Design Library Sync
--
-- This migration adds:
-- 1. Tags array to materials and finishes for better categorization
-- 2. Design library link for materials
-- 3. Auto-sync trigger to make materials available in design library

-- Add tags array to materials
ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add tags array to finishes
ALTER TABLE public.storformat_finishes
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add design_library_item_id for linking materials to existing library items
ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS design_library_item_id UUID REFERENCES public.design_library_items(id) ON DELETE SET NULL;

-- Create GIN indexes for efficient tag searches
CREATE INDEX IF NOT EXISTS idx_storformat_materials_tags ON public.storformat_materials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_storformat_finishes_tags ON public.storformat_finishes USING GIN(tags);

-- Index for design library lookups
CREATE INDEX IF NOT EXISTS idx_storformat_materials_library_link ON public.storformat_materials(design_library_item_id);

-- Function to sync storformat materials to design library
-- When a material is created/updated, it becomes available in the design library
CREATE OR REPLACE FUNCTION sync_storformat_material_to_library()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if material has a name and thumbnail
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    INSERT INTO public.design_library_items (
      id,
      tenant_id,
      name,
      description,
      kind,
      visibility,
      tags,
      storage_path,
      preview_path,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      NEW.name,
      'Storformat materiale',
      'image',
      'tenant',
      COALESCE(NEW.tags, '{}'),
      NEW.thumbnail_url,
      NEW.thumbnail_url,
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      tags = EXCLUDED.tags,
      storage_path = EXCLUDED.storage_path,
      preview_path = EXCLUDED.preview_path,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to remove from design library when material is deleted
CREATE OR REPLACE FUNCTION remove_storformat_material_from_library()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.design_library_items WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_material_to_library ON public.storformat_materials;
DROP TRIGGER IF EXISTS remove_material_from_library ON public.storformat_materials;

-- Create triggers
CREATE TRIGGER sync_material_to_library
  AFTER INSERT OR UPDATE ON public.storformat_materials
  FOR EACH ROW EXECUTE FUNCTION sync_storformat_material_to_library();

CREATE TRIGGER remove_material_from_library
  AFTER DELETE ON public.storformat_materials
  FOR EACH ROW EXECUTE FUNCTION remove_storformat_material_from_library();

-- Migrate existing group_label to tags (if group_label has a value, add it as first tag)
UPDATE public.storformat_materials
SET tags = ARRAY[group_label]
WHERE group_label IS NOT NULL
  AND group_label != ''
  AND (tags IS NULL OR tags = '{}');

UPDATE public.storformat_finishes
SET tags = ARRAY[group_label]
WHERE group_label IS NOT NULL
  AND group_label != ''
  AND (tags IS NULL OR tags = '{}');
