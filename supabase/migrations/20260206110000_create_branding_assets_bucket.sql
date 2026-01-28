-- Create storage bucket for branding assets (favicons, logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-assets',
  'branding-assets',
  true,
  524288, -- 512KB limit
  ARRAY['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for branding assets bucket
CREATE POLICY "Anyone can view branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding-assets');

CREATE POLICY "Admins can upload branding assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update branding assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branding-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete branding assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'branding-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);
