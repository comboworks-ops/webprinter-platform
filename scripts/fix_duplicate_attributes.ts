// Fix duplicate product attribute values
// Run with: bun run scripts/fix_duplicate_attributes.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDuplicateAttributes(productSlug: string) {
  console.log(`\n🔍 Checking product: ${productSlug}\n`);

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

  // 2. Get all attribute groups and values
  const { data: groups, error: groupsError } = await supabase
    .from('product_attribute_groups')
    .select('id, name, values:product_attribute_values(*)')
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

  // 3. Find duplicates in each group
  let totalDuplicates = 0;
  const duplicatesToDelete: string[] = [];

  for (const group of groups as any[]) {
    const values = group.values || [];
    const seenNames = new Map<string, any>();
    const duplicates: any[] = [];

    console.log(`\n📦 Group: ${group.name} (${values.length} values)`);

    for (const value of values) {
      const key = `${value.name}|${value.width_mm || ''}|${value.height_mm || ''}`;

      if (seenNames.has(key)) {
        // This is a duplicate
        duplicates.push(value);
        duplicatesToDelete.push(value.id);
        totalDuplicates++;
        console.log(`   ⚠️  DUPLICATE: "${value.name}" (${value.id})`);
      } else {
        seenNames.set(key, value);
      }
    }

    if (duplicates.length > 0) {
      console.log(`   🔴 Found ${duplicates.length} duplicate(s) in this group`);
    } else {
      console.log(`   ✅ No duplicates`);
    }
  }

  // 4. Delete duplicates if found
  if (totalDuplicates > 0) {
    console.log(`\n🗑️  Deleting ${totalDuplicates} duplicate value(s)...\n`);

    const { error: deleteError } = await supabase
      .from('product_attribute_values')
      .delete()
      .in('id', duplicatesToDelete);

    if (deleteError) {
      console.error('❌ Error deleting duplicates:', deleteError.message);
    } else {
      console.log(`✅ Successfully deleted ${totalDuplicates} duplicate(s)!`);
      console.log('\n✨ You can now save the product without errors.\n');
    }
  } else {
    console.log('\n✅ No duplicates found! The issue may be elsewhere.\n');
  }
}

// Run for the 'fkyer' product
const productSlug = process.argv[2] || 'fkyer';
fixDuplicateAttributes(productSlug).catch(console.error);
