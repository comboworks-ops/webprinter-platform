
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMasterName() {
    console.log('Renaming Master Tenant (0000...) to "Webprinter Demo Shop"...');

    const { data, error } = await supabase
        .from('tenants')
        .update({ name: 'Webprinter Demo Shop' })
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .select();

    if (error) {
        console.error('Error updating master tenant:', error);
    } else {
        console.log('Success! Master Tenant renamed:', data);
    }
}

fixMasterName();
