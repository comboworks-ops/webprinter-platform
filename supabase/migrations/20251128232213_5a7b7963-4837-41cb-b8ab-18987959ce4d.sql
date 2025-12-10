-- Create storage bucket for product templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-templates', 'product-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product templates
CREATE POLICY "Anyone can view product templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-templates');

CREATE POLICY "Only admins can upload product templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Only admins can update product templates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Only admins can delete product templates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-templates' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Add template files column to products table
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS template_files jsonb DEFAULT '[]'::jsonb;