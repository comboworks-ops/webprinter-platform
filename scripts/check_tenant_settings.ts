
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenant() {
    console.log("Listing visible tenants (limit 10)...");
    const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, owner_id')
        .limit(10);

    if (error) {
        console.error("Error fetching tenants:", error);
        return;
    }

    console.log(`Found ${tenants.length} tenants.`);
    tenants.forEach(t => console.log(` - ${t.name} (${t.id})`));
}

checkTenant();
