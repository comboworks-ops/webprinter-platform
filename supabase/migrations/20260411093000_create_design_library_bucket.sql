-- Create the missing design-library storage bucket used by the active
-- designer template and design resource flows.
--
-- Rollback note:
-- Drop the policies below and remove the `design-library` bucket if this
-- feature is later consolidated onto another storage bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'design-library',
    'design-library',
    true,
    52428800,
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/svg+xml',
        'application/json'
    ]
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.design_library_storage_tenant(_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    folders text[] := storage.foldername(_name);
BEGIN
    IF folders IS NULL OR array_length(folders, 1) IS NULL THEN
        RETURN NULL;
    END IF;

    -- Template PDFs use template-pdfs/<tenant-id>/...
    IF folders[1] = 'template-pdfs' THEN
        IF array_length(folders, 1) < 2 THEN
            RETURN NULL;
        END IF;

        BEGIN
            RETURN folders[2]::uuid;
        EXCEPTION
            WHEN others THEN
                RETURN NULL;
        END;
    END IF;

    -- Generic design library resources use <tenant-id>/<item-id>/...
    BEGIN
        RETURN folders[1]::uuid;
    EXCEPTION
        WHEN others THEN
            RETURN NULL;
    END;
END;
$$;

DROP POLICY IF EXISTS "Public can view design library assets" ON storage.objects;
CREATE POLICY "Public can view design library assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'design-library');

DROP POLICY IF EXISTS "Admins can upload design library assets" ON storage.objects;
CREATE POLICY "Admins can upload design library assets"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'design-library'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.can_access_tenant(public.design_library_storage_tenant(name))
);

DROP POLICY IF EXISTS "Admins can update design library assets" ON storage.objects;
CREATE POLICY "Admins can update design library assets"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'design-library'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.can_access_tenant(public.design_library_storage_tenant(name))
)
WITH CHECK (
    bucket_id = 'design-library'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.can_access_tenant(public.design_library_storage_tenant(name))
);

DROP POLICY IF EXISTS "Admins can delete design library assets" ON storage.objects;
CREATE POLICY "Admins can delete design library assets"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'design-library'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.can_access_tenant(public.design_library_storage_tenant(name))
);
