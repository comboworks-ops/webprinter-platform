import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded folder prices from productPricing.ts (with recent adjustments)
const folderPrices = {
  A5: {
    "135g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "170g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "250g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
  },
  M65: {
    "135g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "170g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "250g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
  },
  A4: {
    "135g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "170g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
    "250g": {
      Midterfalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Rullefalset: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
      Zigzag: { 50: 216, 100: 304, 250: 570, 500: 745, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 5000: 2800, 10000: 4800 },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const priceRecords = [];
    
    for (const [format, papers] of Object.entries(folderPrices)) {
      for (const [paper, foldTypes] of Object.entries(papers)) {
        for (const [foldType, quantities] of Object.entries(foldTypes)) {
          for (const [quantity, price] of Object.entries(quantities)) {
            priceRecords.push({
              format,
              paper,
              fold_type: foldType,
              quantity: parseInt(quantity),
              price_dkk: price,
            });
          }
        }
      }
    }

    const { data, error } = await supabaseClient
      .from('folder_prices')
      .upsert(priceRecords, { 
        onConflict: 'format,paper,fold_type,quantity',
        ignoreDuplicates: false 
      });

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Seeded ${priceRecords.length} folder prices`,
        count: priceRecords.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error seeding folder prices:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
