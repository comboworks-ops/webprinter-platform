
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'products',
        'folder_prices', 
        'visitkort_prices', 
        'poster_rates', 
        'poster_prices',
        'sticker_rates', 
        'sign_rates',
        'sign_prices',
        'banner_rates',
        'banner_prices',
        'beachflag_prices', 
        'booklet_rates', 
        'salesfolder_rates', 
        'foil_prices',
        'generic_product_prices',
        'product_option_groups',
        'product_options',
        'product_option_group_assignments',
        'custom_fields',
        'custom_field_values',
        'print_flyers' 
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Select" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Public Select" ON public.%I FOR SELECT USING (true)', t);
    END LOOP;
END $$;

