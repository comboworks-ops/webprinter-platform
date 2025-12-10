import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 1. Init Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Find 'tekstiltryk' product
        const { data: product, error: productError } = await supabaseClient
            .from('products')
            .select('id')
            .eq('slug', 'tekstiltryk')
            .maybeSingle();

        if (productError) throw productError;
        if (!product) {
            return new Response(
                JSON.stringify({ error: "Product 'tekstiltryk' not found" }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
        }

        const productId = product.id;

        // 3. Define dummy prices
        const variants = ["T-Shirt Basic", "T-Shirt Premium", "Polo Shirt", "Hættetrøje"];
        const quantities = [10, 25, 50, 100, 200];
        const basePrices = { "T-Shirt Basic": 45, "T-Shirt Premium": 65, "Polo Shirt": 85, "Hættetrøje": 125 };

        const priceRecords = [];

        variants.forEach(variant => {
            quantities.forEach(qty => {
                // Discounts for volume
                const discount = qty >= 100 ? 0.8 : qty >= 50 ? 0.9 : 1.0;
                const pricePerUnit = Math.round(basePrices[variant as keyof typeof basePrices] * discount);

                priceRecords.push({
                    product_id: productId,
                    variant_name: "Model",
                    variant_value: variant,
                    quantity: qty,
                    price_dkk: pricePerUnit * qty // Total price
                });
            });
        });

        // 4. Insert
        const { error: insertError } = await supabaseClient
            .from('generic_product_prices')
            .upsert(priceRecords, { onConflict: 'product_id,variant_name,variant_value,quantity' });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({
                success: true,
                message: `Seeded ${priceRecords.length} prices for tekstiltryk`,
                count: priceRecords.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
