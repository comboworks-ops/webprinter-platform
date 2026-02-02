// Inspect all attribute values for a product, including disabled ones
// Run with: bun run scripts/inspect_attribute_values.ts <product-slug> [attribute-name]

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAttributeValues(productSlug: string, attributeName?: string) {
  console.log(`\n🔍 Inspecting product: ${productSlug}\n`);

  // 1. Get product ID
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', productSlug)
    .single();

  if (prodError || !product) {
    console.error('❌ Product not found:', prodError?.message);
    return;
  }

  console.log(`✅ Found product: ${product.name} (${product.id})\n`);

  // 2. Get all attribute groups and values (including disabled)
  const { data: groups, error: groupsError } = await supabase
    .from('product_attribute_groups')
    .select('id, name, enabled, values:product_attribute_values(*)')
    .eq('product_id', product.id)
    .order('sort_order');

  if (groupsError) {
    console.error('❌ Error fetching groups:', groupsError.message);
    return;
  }

  if (!groups || groups.length === 0) {
    console.log('ℹ️  No attribute groups found');
    return;
  }

  // 3. Display all values, highlighting duplicates and disabled values
  for (const group of groups as any[]) {
    const values = group.values || [];

    console.log(`\n📦 Group: ${group.name} ${!group.enabled ? '(DISABLED)' : ''}`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Total values: ${values.length}\n`);

    // If attributeName is specified, filter to only that name
    const filteredValues = attributeName
      ? values.filter((v: any) => v.name.toLowerCase() === attributeName.toLowerCase())
      : values;

    if (filteredValues.length === 0 && attributeName) {
      console.log(`   ℹ️  No values found with name "${attributeName}"`);
      continue;
    }

    // Group by name to find duplicates
    const byName = new Map<string, any[]>();
    for (const value of filteredValues) {
      const key = `${value.name}|${value.width_mm || ''}|${value.height_mm || ''}`;
      if (!byName.has(key)) {
        byName.set(key, []);
      }
      byName.get(key)!.push(value);
    }

    // Display values
    for (const [key, valueGroup] of byName) {
      const value = valueGroup[0];
      const isDuplicate = valueGroup.length > 1;

      const statusFlags = [];
      if (!value.enabled) statusFlags.push('DISABLED');
      if (isDuplicate) statusFlags.push(`DUPLICATE x${valueGroup.length}`);

      const statusStr = statusFlags.length > 0 ? ` [${statusFlags.join(', ')}]` : '';

      console.log(`   ${isDuplicate ? '⚠️ ' : '  '}${value.name}${statusStr}`);

      for (const v of valueGroup) {
        console.log(`      ID: ${v.id}`);
        console.log(`      Dimensions: ${v.width_mm || 'null'}mm × ${v.height_mm || 'null'}mm`);
        console.log(`      Enabled: ${v.enabled}`);
        console.log(`      Sort order: ${v.sort_order}`);
        console.log(`      Created: ${new Date(v.created_at).toLocaleString()}`);
        if (valueGroup.length > 1) console.log('      ---');
      }
      console.log('');
    }
  }

  // 4. Summary
  const totalValues = groups.reduce((sum, g) => sum + (g.values?.length || 0), 0);
  const duplicateCount = groups.reduce((sum, g) => {
    const values = g.values || [];
    const seen = new Set<string>();
    let dups = 0;
    for (const v of values) {
      const key = `${v.name}|${v.width_mm || ''}|${v.height_mm || ''}`;
      if (seen.has(key)) dups++;
      else seen.add(key);
    }
    return sum + dups;
  }, 0);

  console.log('\n📊 Summary:');
  console.log(`   Total groups: ${groups.length}`);
  console.log(`   Total values: ${totalValues}`);
  console.log(`   Duplicates found: ${duplicateCount}`);

  if (duplicateCount > 0) {
    console.log('\n💡 Tip: Run fix_duplicate_attributes.ts to remove duplicates\n');
  } else {
    console.log('\n✅ No duplicates found!\n');
  }
}

// Run
const productSlug = process.argv[2] || 'fkyer';
const attributeName = process.argv[3];

if (attributeName) {
  console.log(`Filtering for attribute name: "${attributeName}"`);
}

inspectAttributeValues(productSlug, attributeName).catch(console.error);
