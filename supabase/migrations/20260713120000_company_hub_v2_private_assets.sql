-- Company Hub V2 private asset storage and approved-source access.
-- Additive only: no pricing, order, POD, or supplier tables are changed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-hub-assets',
    'company-hub-assets',
    false,
    26214400,
    ARRAY[
        'application/pdf',
        'application/postscript',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company Hub members read private assets" ON storage.objects;
CREATE POLICY "Company Hub members read private assets"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'company-hub-assets'
        AND EXISTS (
            SELECT 1
            FROM public.company_accounts company
            WHERE company.tenant_id::text = (storage.foldername(name))[1]
              AND company.id::text = (storage.foldername(name))[2]
              AND public.company_hub_is_member(company.id)
        )
    );

DROP POLICY IF EXISTS "Company Hub contributors upload private assets" ON storage.objects;
CREATE POLICY "Company Hub contributors upload private assets"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'company-hub-assets'
        AND EXISTS (
            SELECT 1
            FROM public.company_accounts company
            WHERE company.tenant_id::text = (storage.foldername(name))[1]
              AND company.id::text = (storage.foldername(name))[2]
              AND (
                  public.company_hub_can_manage(company.tenant_id, company.id)
                  OR public.company_hub_has_role(
                      company.id,
                      ARRAY['company_owner', 'company_admin', 'company_approver', 'company_buyer']::text[]
                  )
              )
        )
    );

DROP POLICY IF EXISTS company_assets_member_insert ON public.company_assets;
CREATE POLICY company_assets_member_insert ON public.company_assets
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND public.company_hub_has_role(
            company_id,
            ARRAY['company_owner', 'company_admin', 'company_approver', 'company_buyer']::text[]
        )
        AND (
            office_id IS NULL
            OR public.company_hub_can_access_office(company_id, office_id)
        )
    );

DROP POLICY IF EXISTS "Company Hub managers update private assets" ON storage.objects;
CREATE POLICY "Company Hub managers update private assets"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'company-hub-assets'
        AND EXISTS (
            SELECT 1
            FROM public.company_accounts company
            WHERE company.tenant_id::text = (storage.foldername(name))[1]
              AND company.id::text = (storage.foldername(name))[2]
              AND public.company_hub_can_manage(company.tenant_id, company.id)
        )
    )
    WITH CHECK (
        bucket_id = 'company-hub-assets'
        AND EXISTS (
            SELECT 1
            FROM public.company_accounts company
            WHERE company.tenant_id::text = (storage.foldername(name))[1]
              AND company.id::text = (storage.foldername(name))[2]
              AND public.company_hub_can_manage(company.tenant_id, company.id)
        )
    );

DROP POLICY IF EXISTS "Company Hub managers delete private assets" ON storage.objects;
CREATE POLICY "Company Hub managers delete private assets"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'company-hub-assets'
        AND EXISTS (
            SELECT 1
            FROM public.company_accounts company
            WHERE company.tenant_id::text = (storage.foldername(name))[1]
              AND company.id::text = (storage.foldername(name))[2]
              AND public.company_hub_can_manage(company.tenant_id, company.id)
        )
    );

DROP POLICY IF EXISTS "Company Hub members read approved source designs" ON public.designer_saved_designs;
CREATE POLICY "Company Hub members read approved source designs"
    ON public.designer_saved_designs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_template_bindings binding
            WHERE binding.design_id = designer_saved_designs.id
              AND binding.status = 'active'
              AND public.company_hub_is_member(binding.company_id)
        )
    );

-- Rollback note:
-- Disable the V2 UI first. Preserve company_assets metadata and bound designs.
-- A reviewed rollback may drop only the policies above and make the bucket
-- unavailable; do not delete stored objects or approved source designs.
