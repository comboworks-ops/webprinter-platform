
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

async function inspectTenants() {
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching tenants:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Tenant Columns:', Object.keys(data[0]));
        console.log('Sample Data:', data[0]);
    } else {
        console.log('No tenants found or empty table.');
    }
}

inspectTenants();
