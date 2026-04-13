
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAviloPrices() {
  console.log('Fetching products in AVILO category...');
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('category', 'AVILO');

  if (pError) {
    console.error('Error fetching products:', pError);
    return;
  }

  console.log('Found ' + products.length + ' products in AVILO category.');

  for (const p of products) {
    console.log('\nProcessing: ' + p.name + ' (' + p.slug + ')');

    const { data: groups, error: gError } = await supabase
      .from('product_attribute_groups')
      .select('id, name, kind, values:product_attribute_values(id, name)')
      .eq('product_id', p.id);

    if (gError) {
      console.error('   Error fetching attributes for ' + p.id + ':', gError);
      continue;
    }

    const materialGroup = groups.find(function(g) { return g.kind === 'material'; });
    if (!materialGroup) {
      console.warn('   No material group found for ' + p.slug + '. Skipping.');
      continue;
    }

    const defaultValue = materialGroup.values.find(function(v) { return v.name === 'Default'; }) || materialGroup.values[0];
    if (!defaultValue) {
      console.warn('   No values found in material group for ' + p.slug + '. Skipping.');
      continue;
    }

    const materialValueId = defaultValue.id;
    const formatId = 'fixed';

    console.log('   Selected Material Value ID: ' + materialValueId + ' (' + defaultValue.name + ')');

    const { data: prices, error: fError } = await supabase
      .from('generic_product_prices')
      .select('id, extra_data')
      .eq('product_id', p.id);

    if (fError) {
      console.error('   Error fetching prices for ' + p.id + ':', fError);
      continue;
    }

    console.log('   Found ' + prices.length + ' price rows.');

    let updatedCount = 0;
    for (const price of prices) {
      const updatedExtraData = Object.assign({}, price.extra_data || {}, {
        formatId: formatId,
        materialId: materialValueId,
        selectionMap: {
          format: formatId,
          material: materialValueId
        }
      });

      const { error: uError } = await supabase
        .from('generic_product_prices')
        .update({ extra_data: updatedExtraData })
        .eq('id', price.id);

      if (uError) {
        console.error('   Error updating price ' + price.id + ':', uError);
      } else {
        updatedCount++;
      }
    }
    console.log('   Updated ' + updatedCount + ' price rows.');
  }

  console.log('\nAll done.');
}

fixAviloPrices();
