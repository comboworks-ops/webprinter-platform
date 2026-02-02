-- Add tag/group support for storformat materials and finishes

ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS group_label text;

ALTER TABLE public.storformat_finishes
  ADD COLUMN IF NOT EXISTS group_label text;
