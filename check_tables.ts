
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // We can't list tables directly from client, but we can try to select from them to see if they exist
    const tables = ['folder_prices', 'salesfolder_rates', 'salesfolder_prices'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`Table ${table} error:`, error.message);
        } else {
            console.log(`Table ${table} exists. Row count:`, data); // basic check
        }
    }
}

listTables();
