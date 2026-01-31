
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findTenants() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, company, first_name, last_name')
        .or('company.ilike.%salgsmapper%,company.ilike.%onlinetryksager%');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log('Found profiles:', profiles);
}

findTenants();
