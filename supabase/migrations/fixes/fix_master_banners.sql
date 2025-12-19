-- 1. Ensure the 'forside-bannere' category exists
DO $$
DECLARE
    category_id UUID;
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Get or create category
    SELECT id INTO category_id FROM resource_categories WHERE slug = 'forside-bannere';
    
    IF category_id IS NULL THEN
        INSERT INTO resource_categories (slug, name, type)
        VALUES ('forside-bannere', 'Forside Bannere', 'image')
        RETURNING id INTO category_id;
    END IF;

    -- 2. Insert the 3 Standard Master Assets (if they don't exist)
    -- Image 1: Professionelt tryk
    INSERT INTO master_assets (id, category_id, name, url, thumbnail_url, sort_order, is_published)
    VALUES (
        gen_random_uuid(),
        category_id,
        'Professionelt tryk',
        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1920&h=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=400&auto=format&fit=crop',
        0,
        true
    )
    ON CONFLICT DO NOTHING; -- Assuming unique constraint on URL or name if exists, otherwise duplicates might happen but OK for now

    -- Image 2: Storformat print
    INSERT INTO master_assets (id, category_id, name, url, thumbnail_url, sort_order, is_published)
    VALUES (
        gen_random_uuid(),
        category_id,
        'Storformat print',
        'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?q=80&w=1920&h=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?q=80&w=400&auto=format&fit=crop',
        1,
        true
    );

    -- Image 3: Billige tryksager
    INSERT INTO master_assets (id, category_id, name, url, thumbnail_url, sort_order, is_published)
    VALUES (
        gen_random_uuid(),
        category_id,
        'Billige tryksager',
        'https://images.unsplash.com/photo-1568667256549-094345857637?q=80&w=1920&h=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1568667256549-094345857637?q=80&w=400&auto=format&fit=crop',
        2,
        true
    );

    -- 3. Update Master Tenant Settings to match these defaults
    UPDATE public.tenants
    SET settings = jsonb_set(
        settings,
        '{branding,hero,images}',
        '[
            {"id":"default-1","url":"https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1920&h=600&auto=format&fit=crop","alt":"Professionelt tryk","sortOrder":0,"headline":"Professionelt tryk – hurtig levering i hele Danmark","subline":"Flyers, foldere, plakater, bannere m.m. — beregn prisen direkte.","buttons":[{"id":"btn-1","label":"Se tryksager","variant":"primary","linkType":"ALL_PRODUCTS","textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"},
            {"id":"default-2","url":"https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?q=80&w=1920&h=600&auto=format&fit=crop","alt":"Storformat print","sortOrder":1,"headline":"Storformat print i topkvalitet","subline":"Bannere, beachflag, skilte og messeudstyr – til konkurrencedygtige priser.","buttons":[{"id":"btn-2","label":"Se storformat","variant":"primary","linkType":"INTERNAL_PAGE","target":{"path":"#storformat"},"textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"},
            {"id":"default-3","url":"https://images.unsplash.com/photo-1568667256549-094345857637?q=80&w=1920&h=600&auto=format&fit=crop","alt":"Billige tryksager","sortOrder":2,"headline":"Billige tryksager online","subline":"Bestil nemt og hurtigt – personlig service og dansk produktion.","buttons":[{"id":"btn-3","label":"Beregn pris","variant":"primary","linkType":"INTERNAL_PAGE","target":{"path":"/prisberegner"},"textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"}
        ]'::jsonb
    )
    WHERE id = master_tenant_id;

END $$;
