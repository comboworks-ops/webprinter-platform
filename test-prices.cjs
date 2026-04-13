require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: product } = await supabase.from('products').select('id, name').eq('slug', 'roll-up-standard-120x200-5901030303003').single();
  if (!product) return console.log('Product not found');
  console.log('Product:', product.name, product.id);
  
  const { data: prices, error } = await supabase.from('generic_product_prices').select('*').eq('product_id', product.id);
  if (error) console.error(error);
  console.log('Prices count:', prices ? prices.length : 0);
  if (prices && prices.length > 0) {
    console.log('Sample price:', prices[0]);
  }
}
check();
