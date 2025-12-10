import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Flyer Data (Hardcoded subset for seeding)
    // Structure: Format -> Weight -> Quantity -> Price
    const flyerPrices = {
      "A6": {
        "135g": { 50: 150, 100: 160, 250: 189, 500: 234, 1000: 317, 1500: 364, 2000: 439, 2500: 404, 3000: 463, 4000: 688, 5000: 786, 10000: 986 },
        "170g": { 50: 151, 100: 161, 250: 193, 500: 238, 1000: 323, 1500: 372, 2000: 451, 2500: 415, 3000: 476, 4000: 709, 5000: 812, 10000: 1561 },
        "250g": { 50: 153, 100: 164, 250: 198, 500: 245, 1000: 338, 1500: 391, 2000: 474, 2500: 437, 3000: 627, 4000: 750, 5000: 862, 10000: 1726 }
      },
      "A5": {
        "135g": { 50: 175, 100: 198, 250: 267, 500: 376, 1000: 590, 2500: 998, 5000: 1876 },
        "170g": { 50: 190, 100: 215, 250: 290, 500: 420, 1000: 650, 2500: 1100, 5000: 2000 }
      },
      "M65": {
        "135g": { 50: 160, 100: 180, 250: 220, 500: 300, 1000: 450, 2500: 800, 5000: 1500 }
      }
    };

    const flyerRows: any[] = [];
    Object.entries(flyerPrices).forEach(([format, papers]) => {
      Object.entries(papers).forEach(([weight, quantities]) => {
        const paper = `${weight} Silk`;
        Object.entries(quantities).forEach(([qty, price]) => {
          flyerRows.push({
            format,
            paper,
            quantity: Number(qty),
            price_dkk: price
          });
        });
      });
    });

    // ... Original Data ...
    const visitkortData = [
      { paper: "350g", quantity: 50, price_dkk: 125 },
      { paper: "350g", quantity: 100, price_dkk: 165 },
      { paper: "350g", quantity: 250, price_dkk: 265 },
      { paper: "350g", quantity: 500, price_dkk: 415 },
      { paper: "350g", quantity: 1000, price_dkk: 705 },
      { paper: "400g", quantity: 50, price_dkk: 135 },
      { paper: "400g", quantity: 100, price_dkk: 175 },
      { paper: "400g", quantity: 250, price_dkk: 285 },
      { paper: "400g", quantity: 500, price_dkk: 445 },
      { paper: "400g", quantity: 1000, price_dkk: 755 }
    ];

    const posterRateData = [
      { paper: "115g", price_per_sqm: 75 },
      { paper: "150g", price_per_sqm: 85 },
      { paper: "200g", price_per_sqm: 95 }
    ];

    const stickerRateData = [
      { format: "10x10 cm", material: "Vinyl", quantity: 100, price_dkk: 295 },
      { format: "10x10 cm", material: "Papir", quantity: 100, price_dkk: 225 },
      { format: "5x5 cm", material: "Transparent", quantity: 100, price_dkk: 195 }
    ];

    const signRateData = [
      { material: "Kapa", price_per_sqm: 150 },
      { material: "Forex", price_per_sqm: 180 },
      { material: "Akryl", price_per_sqm: 250 }
    ];

    const bannerRateData = [
      { material: "Vinyl banner", price_per_sqm: 95 },
      { material: "Mesh banner", price_per_sqm: 105 },
      { material: "Fabric banner", price_per_sqm: 135 }
    ];

    const beachflagData = [
      { size: "S (60x180cm)", system: "Spike", base_price: 349 },
      { size: "S (60x180cm)", system: "Cross", base_price: 399 },
      { size: "M (75x250cm)", system: "Spike", base_price: 449 },
      { size: "M (75x250cm)", system: "Cross", base_price: 499 },
      { size: "L (85x300cm)", system: "Spike", base_price: 549 },
      { size: "L (85x300cm)", system: "Cross", base_price: 599 }
    ];

    // Clean up old stickers to avoid constraint issues during development
    await supabase.from('sticker_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Perform Upserts
    const results = await Promise.all([
      // New: Seed Flyers
      supabase.from('print_flyers').upsert(flyerRows, { onConflict: 'format,paper,quantity' }),

      // Existing
      supabase.from('visitkort_prices').upsert(visitkortData, { onConflict: 'paper,quantity' }),
      supabase.from('poster_rates').upsert(posterRateData, { onConflict: 'paper' }),
      supabase.from('sticker_rates').upsert(stickerRateData, { onConflict: 'material' }), // Constraint issue fix: ensure unique materials or clear table
      supabase.from('sign_rates').upsert(signRateData, { onConflict: 'material' }),
      supabase.from('banner_rates').upsert(bannerRateData, { onConflict: 'material' }),
      supabase.from('beachflag_prices').upsert(beachflagData, { onConflict: 'size,system' })
    ]);

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error("Seeding errors:", errors);
      return new Response(JSON.stringify({ error: 'Some seeds failed', details: errors }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Product prices seeded successfully',
      counts: {
        flyers: flyerRows.length,
        visitkort: visitkortData.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
