
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// WE MUST USE SERVICE ROLE KEY TO BYPASS RLS FOR DEBUGGING?
// NO, we want to test IF the user can do it. But we only have anon key in env usually?
// actually previous scripts used VITE_SUPABASE_PUBLISHABLE_KEY.
// If I use publishable key, I am "anonymous". 
// Anonymous users CANNOT update tenants.
// I need to sign in as the user.
// But I don't have the user's password.
//
// So I can only verify if the DATABASE allows updates if I assume the user is logged in.
// I will use SERVICE ROLE key to inspect the CURRENT settings, 
// and inspection of RLS policies via SQL is better.

// However, I can check if 'Online Tryksager' has the correct owner_id.
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = 'cf113c47-7c9d-4844-ad82-dc621b660d70'; // Wait, that was PRODUCT ID.
// generic_product_prices product_id was cf113c47...
// I need the TENANT ID.
// "Online Tryksager"

async function checkTenant() {
    console.log("Searching for Online Tryksager...");
    const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, owner_id, settings')
        .ilike('name', '%Online Tryksager%');

    if (error) {
        console.error("Error fetching tenants:", error);
        return;
    }

    if (tenants.length === 0) {
        console.log("No tenant found.");
        return;
    }

    const t = tenants[0];
    console.log("Found Tenant:", t.name);
    console.log("ID:", t.id);
    console.log("Owner:", t.owner_id);
    console.log("Settings:", JSON.stringify(t.settings, null, 2));
}

checkTenant();
