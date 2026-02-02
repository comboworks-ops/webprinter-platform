import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!; // Fallback to Anon Key since Service Role is missing in .env
const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = '7cb851f5-c792-40b1-a79a-1f7c7b5f668c'; // Online Tryksager

async function checkPrices() {
    console.log(`Checking prices for Tenant: ${TENANT_ID}`);

    // 1. Get Products
    const { data: products, error: prodError } = await (supabase as any)
        .from('products')
        .select('id, name, pricing_structure')
        .eq('tenant_id', TENANT_ID);

    if (prodError) {
        console.error('Error fetching products:', prodError);
        return;
    }

    console.log(`Found ${products?.length || 0} products.`);

    for (const p of products || []) {
        console.log(`\nProduct: ${p.name} (${p.id})`);
        console.log(`Structure:`, p.pricing_structure);

        // 2. Check Generic Prices
        const { data: prices, error: priceError } = await supabase
            .from('generic_product_prices')
            .select('*')
            .eq('product_id', p.id); // Note: generic_product_prices usually links by product_id NOT tenant_id directly?

        if (priceError) {
            console.error('Error fetching prices:', priceError);
        } else {
            console.log(`- Found ${prices?.length || 0} price rows.`);
            if (prices && prices.length > 0) {
                console.log(`  Sample: ${JSON.stringify(prices[0])}`);
            }
        }
    }
}

checkPrices();
