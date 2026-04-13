
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllPrices() {
  console.log('Finding products in Print House category (or similar)...');

  // We'll look for products with slug starting with 'roll-up' or 'flagene' for now,
  // or we can look for the main category if we have its ID.
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, name, slug')
    .or('slug.ilike.roll-up%,slug.ilike.flagene%');

  if (pError) {
    console.error('Error fetching products:', pError);
    return;
  }

  console.log(`Found ${products.length} products to check.`);

  for (const p of products) {
    console.log(`\nProcessing: ${p.name} (${p.slug})`);

    // 1. Get the "Default" material value ID for this product
    const { data: groups, error: gError } = await supabase
      .from('product_attribute_groups')
      .select('id, name, values:product_attribute_values(id, name)')
      .eq('product_id', p.id)
      .eq('kind', 'material');

    if (gError || !groups || groups.length === 0) {
      console.warn(`   No material groups found for ${p.slug}. Skipping.`);
      continue;
    }

    const defaultValue = groups[0].values.find(v => v.name === 'Default');
    if (!defaultValue) {
      console.warn(`   No 'Default' value found in material group for ${p.slug}. Skipping.`);
      continue;
    }

    const materialValueId = defaultValue.id;
    const formatId = 'fixed';

    console.log(`   Default Material Value ID: ${materialValueId}`);

    // 2. Update prices for this product
    const { data: prices, error: fError } = await supabase
      .from('generic_product_prices')
      .select('id, extra_data')
      .eq('product_id', p.id);

    if (fError) {
      console.error(`   Error fetching prices for ${p.id}:`, fError);
      continue;
    }

    console.log(`   Found ${prices.length} price rows.`);

    let updatedCount = 0;
    for (const price of prices) {
      // Check if already fixed
      if (price.extra_data?.materialId === materialValueId && price.extra_data?.formatId === formatId) {
        continue;
      }

      const updatedExtraData = {
        ...(price.extra_data || {}),
        formatId: formatId,
        materialId: materialValueId,
        selectionMap: {
          format: formatId,
          material: materialValueId
        }
      };

      const { error: uError } = await supabase
        .from('generic_product_prices')
        .update({ extra_data: updatedExtraData })
        .eq('id', price.id);

      if (uError) {
        console.error(`   Error updating price ${price.id}:`, uError);
      } else {
        updatedCount++;
      }
    }
    console.log(`   Updated ${updatedCount} price rows.`);
  }

  console.log('\nAll done.');
}

fixAllPrices();
