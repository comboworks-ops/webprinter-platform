-- Page SEO metadata is public website metadata and must be readable by
-- unauthenticated storefront visitors, crawlers, and the tenant SEO shell.
-- Edit access remains controlled by the existing tenant/admin policies.

DROP POLICY IF EXISTS "Public read page SEO metadata" ON public.page_seo;
CREATE POLICY "Public read page SEO metadata" ON public.page_seo
    FOR SELECT
    TO anon, authenticated
    USING (true);
