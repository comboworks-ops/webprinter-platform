
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttributes() {
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, name, slug')
    .ilike('slug', 'roll-up%')
    .limit(5);

  if (pError) {
    console.error('Error fetching products:', pError);
    return;
  }

  for (const p of products) {
    console.log(`\nChecking attributes for Product: ${p.name} (${p.slug}) ID: ${p.id}`);
    
    // Using separate queries to avoid issues with nested join in some environments/libs
    const { data: groups, error: gError } = await supabase
      .from('product_attribute_groups')
      .select('*')
      .eq('product_id', p.id);

    if (gError) {
      console.error(`Error fetching groups for ${p.id}:`, gError);
      continue;
    }

    console.log(`Found ${groups.length} attribute groups.`);
    for (const g of groups) {
      console.log(`- Group: ${g.name} (${g.kind}) ID: ${g.id}`);
      
      const { data: values, error: vError } = await supabase
        .from('product_attribute_values')
        .select('*')
        .eq('group_id', g.id);

      if (vError) {
        console.error(`  Error fetching values for ${g.id}:`, vError);
        continue;
      }

      console.log(`  Values: ${values.length}`);
      for (const v of values) {
        console.log(`    * ${v.name} ID: ${v.id}`);
      }
    }
  }
}

checkAttributes();
