
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAviloLayouts() {
  console.log('Fetching products in AVILO category...');
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, name, slug, pricing_structure')
    .eq('category', 'AVILO');

  if (pError) {
    console.error('Error fetching products:', pError);
    return;
  }

  console.log('Found ' + products.length + ' products in AVILO category.');

  for (const p of products) {
    console.log('\nMigrating: ' + p.name + ' (' + p.slug + ')');

    // 1. Get current material attribute group
    const { data: groups, error: gError } = await supabase
      .from('product_attribute_groups')
      .select('id, name, kind, values:product_attribute_values(id, name)')
      .eq('product_id', p.id);

    if (gError) {
      console.error('   Error fetching groups for ' + p.id + ':', gError);
      continue;
    }

    const materialGroup = groups.find(function(g) { return g.kind === 'material'; });
    if (!materialGroup) {
      console.warn('   No material group found for ' + p.slug + '. Checking for format group...');
      // Already migrated?
      continue;
    }

    const defaultValue = materialGroup.values.find(function(v) { return v.name === 'Default'; }) || materialGroup.values[0];
    if (!defaultValue) {
        console.warn('   No values found in material group for ' + p.slug + '. Skipping.');
        continue;
    }

    // 2. Transmute: Material Group -> Format Group, "Default" -> Product Name
    const { error: groupUpdateError } = await supabase
      .from('product_attribute_groups')
      .update({ kind: 'format', name: 'Format' })
      .eq('id', materialGroup.id);
    
    if (groupUpdateError) {
        console.error('   Error updating group kind:', groupUpdateError);
        continue;
    }

    const { error: valueUpdateError } = await supabase
        .from('product_attribute_values')
        .update({ name: p.name })
        .eq('id', defaultValue.id);

    if (valueUpdateError) {
        console.error('   Error updating value name:', valueUpdateError);
        continue;
    }

    console.log('   Transmuted attribute group and value.');

    // 3. Update Pricing Structure
    const newStructure = Object.assign({}, p.pricing_structure || {}, {
        vertical_axis: Object.assign({}, p.pricing_structure.vertical_axis || {}, {
            sectionType: 'formats',
            title: 'Format',
            groupId: materialGroup.id,
            valueIds: [defaultValue.id]
        })
    });

    const { error: structureUpdateError } = await supabase
        .from('products')
        .update({ pricing_structure: newStructure })
        .eq('id', p.id);

    if (structureUpdateError) {
        console.error('   Error updating pricing structure:', structureUpdateError);
        continue;
    }

    // 4. Update Prices extra_data
    const { data: prices, error: fError } = await supabase
      .from('generic_product_prices')
      .select('id, extra_data')
      .eq('product_id', p.id);

    if (fError) {
      console.error('   Error fetching prices:', fError);
      continue;
    }

    let updatedCount = 0;
    for (const price of prices) {
      const updatedExtraData = Object.assign({}, price.extra_data || {}, {
        formatId: defaultValue.id,
        materialId: "",
        selectionMap: {
          format: defaultValue.id,
          material: ""
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

migrateAviloLayouts();
