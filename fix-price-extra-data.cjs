
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPrices() {
  // Target Product: ROLL-UP LUX (200x200)
  const productId = '1279c085-349c-4f4a-82a0-c5995dc02570';
  const materialValueId = '68bf5582-4ab8-4731-859b-82eda2ffd494';
  const formatId = 'fixed';

  console.log(`Fixing prices for Product ID: ${productId}`);

  const { data: prices, error: fError } = await supabase
    .from('generic_product_prices')
    .select('id, extra_data')
    .eq('product_id', productId);

  if (fError) {
    console.error('Error fetching prices:', fError);
    return;
  }

  console.log(`Found ${prices.length} price rows to update.`);

  for (const price of prices) {
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
      console.error(`Error updating price ${price.id}:`, uError);
    }
  }

  console.log('Update complete.');
}

fixPrices();
