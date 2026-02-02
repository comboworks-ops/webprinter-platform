
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCT_ID = 'cf113c47-7c9d-4844-ad82-dc621b660d70'; // "fkyer" from logs

async function debugProduct() {
    console.log(`Debugging Product: ${PRODUCT_ID}`);

    // 1. Fetch Product
    const { data: product, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', PRODUCT_ID)
        .single();

    if (pErr) {
        console.error("Error fetching product:", pErr);
        return;
    }
    console.log("Structure:", JSON.stringify(product.pricing_structure, null, 2));
}

debugProduct();
