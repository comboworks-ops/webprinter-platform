
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase or Service Role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductStructure() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, pricing_structure')
    .ilike('slug', 'roll-up%')
    .limit(5);

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  console.log('Product Pricing Structures:');
  data.forEach(p => {
    console.log(`\nProduct: ${p.name} (${p.slug})`);
    console.log('Pricing Structure:', JSON.stringify(p.pricing_structure, null, 2));
  });
}

checkProductStructure();
