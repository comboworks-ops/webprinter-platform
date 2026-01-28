-- Fix Public Access Security and Enable proper routing
DO $$
BEGIN
    -- 1. TENANTS: Enable Public Read Access (Required for Domain Lookup)
    -- Allow anyone to read tenant info (needed to match domain -> tenant_id)
    DROP POLICY IF EXISTS "Public Select Tenants" ON public.tenants;
    CREATE POLICY "Public Select Tenants" ON public.tenants FOR SELECT USING (true);

    -- 2. PRODUCTS: Enhance Public Security
    -- Previously we allowed "true" which exposed Drafts.
    -- Now we allow:
    --   a) Public: Only if is_published = true
    --   b) Tenant Owner: Everything (via duplicate policy or OR logic, but RLS is additive)
    -- We already have "Tenant Owner Access" (ALL).
    -- We need to replace the "Public Select" policy with a stricter one.
    
    DROP POLICY IF EXISTS "Public Select" ON public.products;
    CREATE POLICY "Public Select Published" ON public.products 
    FOR SELECT USING (is_published = true);

    -- 3. PRICES: Allow Public Access (Prices are harmless if product is hidden)
    -- We keep "Public Select" on prices as created before, or ensure it exists.
    -- (The previous script created "Public Select" on pricing tables. We leave those as is.)

END $$;
