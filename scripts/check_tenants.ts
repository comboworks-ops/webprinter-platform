
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY/ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
    console.log('--- Checking Tenants ---');
    const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, domain, owner_id, settings');

    if (error) {
        console.error('Error fetching tenants:', error);
        return;
    }

    console.table(tenants.map(t => ({
        id: t.id,
        name: t.name,
        domain: t.domain,
        is_platform_owned: t.is_platform_owned,
        owner_id: t.owner_id || 'NULL (Orphaned)',
        // Truncate settings for readability
        settings_preview: t.settings ? JSON.stringify(t.settings).substring(0, 50) + '...' : 'NULL'
    })));

    console.log('\n--- Checking User Roles ---');
    const { data: roles } = await supabase
        .from('user_roles' as any)
        .select('*');

    if (roles) {
        console.table(roles);
    }
}

checkTenants();
