
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Use non-admin key first, or admin if needed/available

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    // Fetch all products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, pricing_type');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    // Check for duplicates
    const slugCounts: Record<string, typeof products> = {};
    products.forEach(p => {
        if (!slugCounts[p.slug]) slugCounts[p.slug] = [];
        slugCounts[p.slug].push(p);
    });

    const duplicates = Object.entries(slugCounts).filter(([slug, list]) => list.length > 1);

    if (duplicates.length > 0) {
        console.log('Found duplicate slugs:');
        duplicates.forEach(([slug, list]) => {
            console.log(`Slug: ${slug}`);
            console.table(list);
        });
    } else {
        console.log('No duplicate slugs found with current visibility.');
    }

    console.log(`Total visible products: ${products.length}`);
    console.table(products.map(p => ({ id: p.id, name: p.name, slug: p.slug, type: p.pricing_type })));
}

checkDuplicates();
