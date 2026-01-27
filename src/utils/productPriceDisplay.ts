import { supabase } from "@/integrations/supabase/client";
import { getPriceForSelection } from "./productPricing";
import { calculateStorformatPrice } from "./storformatPricing";

interface Product {
  id: string;
  slug: string;
  pricing_type: string;
  default_variant: string | null;
  default_quantity: number | null;
  banner_config: any;
}

export async function getProductDisplayPrice(product: Product): Promise<string> {
  try {
    // Check for manual override in banner_config
    if (product.banner_config && (product.banner_config as any).price_from) {
      return `${(product.banner_config as any).price_from} kr`;
    }

    // Flyers - Default: A6 format, 135g material, 50 quantity
    if (product.slug === "flyers") {
      const { data } = await supabase
        .from('print_flyers')
        .select('price_dkk')
        .eq('format', 'A6')
        .eq('paper', '135g Silk')
        .eq('quantity', 50)
        .maybeSingle();

      if (data) return `${Math.round(data.price_dkk)} kr`;

      // Fallback
      const price = getPriceForSelection("flyers", "A6", "135g", 50);
      if (price > 0) return `${price} kr`;
    }

    // Foldere - Default: A5 format, 135g material, Midterfalset, 50 quantity
    if (product.slug === "foldere") {
      const { data } = await supabase
        .from('folder_prices')
        .select('price_dkk')
        .eq('format', 'A5')
        .eq('paper', '135g Silk')
        .eq('fold_type', 'Midterfalset')
        .eq('quantity', 50)
        .maybeSingle();

      if (data) return `${Math.round(data.price_dkk)} kr`;

      // Fallback
      const price = getPriceForSelection("foldere", "A5", "135g", 50, "Midterfalset");
      if (price > 0) return `${price} kr`;
    }

    // Visitkort - Default: 350g material, 100 quantity
    if (product.slug === "visitkort") {
      const { data } = await supabase
        .from('visitkort_prices')
        .select('price_dkk')
        .eq('paper', '350g')
        .eq('quantity', 100)
        .maybeSingle();

      if (data) return `${Math.round(data.price_dkk)} kr`;

      // Fallback
      const price = getPriceForSelection("visitkort", "", "350g", 100);
      if (price > 0) return `${price} kr`;
    }

    // Plakater - Default: A3 format, 135g material, 1 quantity
    if (product.slug === "plakater") {
      const { data } = await supabase
        .from('poster_prices')
        .select('price_dkk')
        .eq('format', 'A3')
        .eq('paper', '135g Silk')
        .eq('quantity', 1)
        .maybeSingle();

      if (data) return `${Math.round(data.price_dkk)} kr`;
    }

    // Klistermærker - Default: 5x5 format, Vinyl material, 100 quantity
    if (product.slug === "klistermærker") {
      const { data } = await supabase
        .from('sticker_rates')
        .select('price_dkk')
        .eq('format', '5x5')
        .eq('material', 'Vinyl')
        .eq('quantity', 100)
        .maybeSingle();

      if (data) return `${Math.round(data.price_dkk)} kr`;
    }

    // Hæfter - Default: A6 format, 135g material, 8 sider, 100 quantity
    if (product.slug === "hæfter") {
      const { data } = await supabase
        .from('booklet_rates')
        .select('base_price, price_per_unit')
        .eq('format', 'A6')
        .eq('paper', '135g Silk')
        .eq('pages', '8')
        .maybeSingle();

      if (data) {
        const price = data.base_price + (data.price_per_unit * 100);
        return `${Math.round(price)} kr`;
      }
    }

    // Salgsmapper - Default: M65 format, 250g material, Kun front, 50 quantity
    if (product.slug === "salgsmapper") {
      const { data } = await supabase
        .from('salesfolder_rates')
        .select('base_price, price_per_unit')
        .eq('format', 'M65')
        .eq('paper', '250g Silk')
        .eq('side_type', 'Kun front')
        .maybeSingle();

      if (data) {
        const price = data.base_price + (data.price_per_unit * 50);
        return `${Math.round(price)} kr`;
      }
    }

    // Beachflag - Default: S size, Spike system, 1 quantity
    if (product.slug === "beachflag") {
      const { data } = await supabase
        .from('beachflag_prices')
        .select('base_price')
        .eq('quantity', 1)
        .order('base_price', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) return `${Math.round(data.base_price)} kr`;
    }

    // Bannere - Default: 200cm x 100cm (2 m²), PVC material
    if (product.slug === "bannere") {
      const { data } = await supabase
        .from('banner_rates')
        .select('price_per_sqm')
        .eq('material', 'PVC')
        .maybeSingle();

      if (data) {
        // Default banner size 200x100cm = 2 m²
        const m2 = 2;
        const price = data.price_per_sqm * m2;
        return `${Math.round(price)} kr`;
      }
    }

    // Skilte - Default: A3 format, PVC3 material, 1 quantity
    if (product.slug === "skilte") {
      const { data } = await supabase
        .from('sign_rates')
        .select('price_per_sqm')
        .eq('material', 'PVC 3mm')
        .maybeSingle();

      if (data) {
        // A3 = 0.125 m²
        const m2 = 0.125;
        const price = data.price_per_sqm * m2;
        return `${Math.round(price)} kr`;
      }
    }

    // Folie - Default: 100x100cm (1 m²), Mat material
    if (product.slug === "folie") {
      const { data } = await supabase
        .from('foil_prices')
        .select('price_per_sqm, discount_percent, from_sqm, to_sqm')
        .eq('material', 'Mat')
        .lte('from_sqm', 1)
        .gte('to_sqm', 1)
        .maybeSingle();

      if (data) {
        const m2 = 1;
        const discount = 1 - (data.discount_percent / 100);
        const price = data.price_per_sqm * m2 * discount;
        return `${Math.round(price)} kr`;
      }
    }

    // Generic/Machine Pricing Add-On (MPA) support
    if (product.pricing_type === 'STORFORMAT') {
      const { data: cfg } = await supabase
        .from('storformat_configs' as any)
        .select('*')
        .eq('product_id', product.id)
        .maybeSingle();

      const { data: materialRows } = await supabase
        .from('storformat_materials' as any)
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order');

      const { data: materialTiers } = await supabase
        .from('storformat_material_price_tiers' as any)
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order');

      const materialsWithTiers = (materialRows || []).map((m: any) => ({
        ...m,
        tiers: (materialTiers || []).filter((t: any) => t.material_id === m.id)
      }));

      const { data: productRows } = await supabase
        .from('storformat_products' as any)
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order');

      const { data: productTiers } = await supabase
        .from('storformat_product_price_tiers' as any)
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order');

      const { data: productFixedPrices } = await supabase
        .from('storformat_product_fixed_prices' as any)
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order');

      const productsWithPricing = (productRows || []).map((p: any) => ({
        ...p,
        tiers: (productTiers || []).filter((t: any) => t.product_item_id === p.id),
        fixed_prices: (productFixedPrices || []).filter((fp: any) => fp.product_item_id === p.id)
      }));

      if (materialsWithTiers.length > 0) {
        const config = {
          rounding_step: cfg?.rounding_step || 1,
          global_markup_pct: cfg?.global_markup_pct || 0,
          quantities: cfg?.quantities?.length ? cfg.quantities : [1]
        };
        const quantity = config.quantities[0] || 1;
        const material = materialsWithTiers[0];
        const productSelection = productsWithPricing[0] || null;
        const result = calculateStorformatPrice({
          widthMm: 1000,
          heightMm: 1000,
          quantity,
          material,
          product: productSelection,
          config
        });
        return `Fra ${Math.round(result.totalPrice)} kr`;
      }
    }

    if (product.pricing_type === 'MACHINE_PRICED') {
      const { data: mpaCfg } = await supabase
        .from('product_pricing_configs' as any)
        .select('*')
        .eq('product_id', product.id)
        .maybeSingle();

      if (mpaCfg) {
        const config = mpaCfg as any;
        // Try to get a price for default settings
        const qty = product.default_quantity || config.quantities?.[0] || 100;
        const matId = config.material_ids?.[0] || "";
        const width = 210; // Default A4-ish
        const height = 297;

        if (matId) {
          const { data: priceData, error: priceErr } = await supabase.functions.invoke('calculate-machine-price', {
            body: {
              productId: product.id,
              quantity: qty,
              width,
              height,
              material_id: matId,
              sides: '4+0'
            }
          });

          if (priceData?.totalPrice) {
            return `Fra ${Math.round(priceData.totalPrice)} kr`;
          }
        }
      }
    }

    // Generic matrix-based products (incl. matrix_layout_v1)
    if (product.pricing_type === 'matrix' || product.pricing_type === 'MATRIX' || product.pricing_type === 'matrix_layout_v1') {
      const { data } = await supabase
        .from('generic_product_prices' as any)
        .select('price_dkk')
        .eq('product_id', product.id)
        .order('price_dkk', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data?.price_dkk != null) {
        return `Fra ${Math.round(data.price_dkk)} kr`;
      }
    }

    // Messeudstyr - Default: Rollup, 1 quantity
    if (product.slug === "messeudstyr") {
      return "595 kr";
    }

    // Displayplakater - Default: 100x100cm, Papir material, 1 quantity
    if (product.slug === "displayplakater") {
      return "140 kr";
    }

  } catch (error) {
    console.error('Error fetching product price:', error);
  }

  return "Se priser";
}
