import { supabase } from "@/integrations/supabase/client";
import type { MatrixData } from "./productPricing";
import { getFlyerMatrixData, getFolderMatrixData, getVisitkortMatrixData, getPriceForSelection } from "./productPricing";

// Fetch flyer prices from database and convert to matrix format
// Falls back to hardcoded data if database is empty
export async function getFlyerMatrixDataFromDB(format: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('print_flyers')
    .select('*')
    .eq('format', format)
    .order('paper')
    .order('quantity');

  if (error) {
    console.error('Error fetching flyer prices, using fallback:', error);
    return getFlyerMatrixData(format);
  }

  if (!data || data.length === 0) {
    console.log(`No flyer data in DB for format ${format}, using fallback`);
    return getFlyerMatrixData(format);
  }

  // Extract unique paper types and quantities
  const paperTypes = [...new Set(data.map(item => item.paper))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  // Build cells object
  const cells: Record<string, Record<number, number>> = {};
  paperTypes.forEach(paper => {
    cells[paper] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.paper === paper && d.quantity === qty);
      if (priceEntry) {
        cells[paper][qty] = priceEntry.price_dkk;
      }
    });
  });

  return {
    rows: paperTypes,
    columns: quantities,
    cells
  };
}

// Fetch folder prices from database and convert to matrix format
export async function getFolderMatrixDataFromDB(format: string, foldType: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('folder_prices')
    .select('*')
    .eq('format', format)
    .eq('fold_type', foldType)
    .order('paper')
    .order('quantity');

  if (error) {
    console.error('Error fetching folder prices, using fallback:', error);
    return getFolderMatrixData(format, foldType);
  }

  if (!data || data.length === 0) {
    console.log(`No folder data in DB for format ${format}, using fallback`);
    return getFolderMatrixData(format, foldType);
  }

  // Extract unique paper types and quantities
  const paperTypes = [...new Set(data.map(item => item.paper))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  // Build cells object
  const cells: Record<string, Record<number, number>> = {};
  paperTypes.forEach(paper => {
    cells[paper] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.paper === paper && d.quantity === qty);
      if (priceEntry) {
        cells[paper][qty] = priceEntry.price_dkk;
      }
    });
  });

  return {
    rows: paperTypes,
    columns: quantities,
    cells
  };
}

// Fetch visitkort prices from database and convert to matrix format
// Falls back to hardcoded data if database is empty
export async function getVisitkortMatrixDataFromDB(): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('visitkort_prices')
    .select('*')
    .order('paper')
    .order('quantity');

  if (error) {
    console.error('Error fetching visitkort prices, using fallback:', error);
    return getVisitkortMatrixData();
  }

  if (!data || data.length === 0) {
    console.log("No visitkort data in DB, using fallback");
    return getVisitkortMatrixData();
  }

  // Extract unique paper types and quantities
  const paperTypes = [...new Set(data.map(item => item.paper))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  // Build cells object
  const cells: Record<string, Record<number, number>> = {};
  paperTypes.forEach(paper => {
    cells[paper] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.paper === paper && d.quantity === qty);
      if (priceEntry) {
        cells[paper][qty] = priceEntry.price_dkk;
      }
    });
  });

  return {
    rows: paperTypes,
    columns: quantities,
    cells
  };
}


// ... existing code ...

// Get single price for calculator
export async function getFlyerPriceFromDB(format: string, paper: string, quantity: number): Promise<number> {
  const { data, error } = await supabase
    .from('print_flyers')
    .select('price_dkk')
    .eq('format', format)
    .eq('paper', paper)
    .eq('quantity', quantity)
    .maybeSingle();

  if (error) {
    console.error('Error fetching flyer price, using fallback:', error);
    return getPriceForSelection("flyers", format, paper, quantity);
  }

  if (!data) {
    return getPriceForSelection("flyers", format, paper, quantity);
  }

  return data.price_dkk;
}

export async function getFolderPriceFromDB(format: string, paper: string, foldType: string, quantity: number): Promise<number> {
  const { data, error } = await supabase
    .from('folder_prices')
    .select('price_dkk')
    .eq('format', format)
    .eq('paper', paper)
    .eq('fold_type', foldType)
    .eq('quantity', quantity)
    .maybeSingle();

  if (error) {
    console.error('Error fetching folder price, using fallback:', error);
    return getPriceForSelection("foldere", format, paper, quantity, foldType);
  }

  if (!data) {
    return getPriceForSelection("foldere", format, paper, quantity, foldType);
  }

  return data.price_dkk;
}

export async function getVisitkortPriceFromDB(paper: string, quantity: number): Promise<number> {
  const { data, error } = await supabase
    .from('visitkort_prices')
    .select('price_dkk')
    .eq('paper', paper)
    .eq('quantity', quantity)
    .maybeSingle();

  if (error) {
    console.error('Error fetching visitkort price, using fallback:', error);
    return getPriceForSelection("visitkort", "", paper, quantity);
  }

  if (!data) {
    return getPriceForSelection("visitkort", "", paper, quantity);
  }

  return data.price_dkk;
}

// Fetch poster prices from database and convert to matrix format
export async function getPosterMatrixDataFromDB(format: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('poster_prices')
    .select('*')
    .eq('format', format)
    .order('paper')
    .order('quantity');

  if (error) {
    console.error('Error fetching poster prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const papers = [...new Set(data.map(item => item.paper))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  const cells: Record<string, Record<number, number>> = {};
  papers.forEach(paper => {
    cells[paper] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.paper === paper && d.quantity === qty);
      if (priceEntry) {
        cells[paper][qty] = priceEntry.price_dkk;
      }
    });
  });

  return { rows: papers, columns: quantities, cells };
}

// Fetch sticker prices from database and convert to matrix format
export async function getStickerMatrixDataFromDB(format: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('sticker_rates')
    .select('*')
    .eq('format', format)
    .order('material')
    .order('quantity');

  if (error) {
    console.error('Error fetching sticker prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const materials = [...new Set(data.map(item => item.material))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  const cells: Record<string, Record<number, number>> = {};
  materials.forEach(material => {
    cells[material] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.material === material && d.quantity === qty);
      if (priceEntry) {
        cells[material][qty] = priceEntry.price_dkk;
      }
    });
  });

  return { rows: materials, columns: quantities, cells };
}

// Fetch booklet prices from database and convert to matrix format
export async function getBookletMatrixDataFromDB(format: string, pages: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('booklet_rates')
    .select('*')
    .eq('format', format)
    .eq('pages', pages)
    .order('paper');

  if (error) {
    console.error('Error fetching booklet prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const papers = [...new Set(data.map(item => item.paper))];
  // For booklets, we'll create quantity tiers: 100, 250, 500, 1000, 2500, 5000, 10000
  const quantities = [100, 250, 500, 1000, 2500, 5000, 10000];

  const cells: Record<string, Record<number, number>> = {};
  papers.forEach(paper => {
    cells[paper] = {};
    const rateData = data.find(d => d.paper === paper);
    if (rateData) {
      quantities.forEach(qty => {
        // Calculate price: base_price + (price_per_unit * qty)
        cells[paper][qty] = Math.round(rateData.base_price + (rateData.price_per_unit * qty));
      });
    }
  });

  return { rows: papers, columns: quantities, cells };
}

// Fetch salesfolder prices from database and convert to matrix format
export async function getSalesfolderMatrixDataFromDB(format: string, sideType: string): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('salesfolder_rates')
    .select('*')
    .eq('format', format)
    .eq('side_type', sideType)
    .order('paper');

  if (error) {
    console.error('Error fetching salesfolder prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const papers = [...new Set(data.map(item => item.paper))];
  const quantities = [50, 100, 250, 500, 1000];

  const cells: Record<string, Record<number, number>> = {};
  papers.forEach(paper => {
    cells[paper] = {};
    const rateData = data.find(d => d.paper === paper);
    if (rateData) {
      quantities.forEach(qty => {
        cells[paper][qty] = Math.round(rateData.base_price + (rateData.price_per_unit * qty));
      });
    }
  });

  return { rows: papers, columns: quantities, cells };
}

// Fetch beachflag prices from database and convert to matrix format
export async function getBeachflagMatrixDataFromDB(): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('beachflag_prices')
    .select('*')
    .order('size')
    .order('system')
    .order('quantity');

  if (error) {
    console.error('Error fetching beachflag prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  // Create rows as "Size - System" combinations
  const uniqueRows = [...new Set(data.map(item => `${item.size} - ${item.system}`))];
  // Get all unique quantities from database
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  const cells: Record<string, Record<number, number>> = {};
  uniqueRows.forEach(rowKey => {
    cells[rowKey] = {};
    quantities.forEach(qty => {
      // Find the exact price entry for this combination
      const priceEntry = data.find(d =>
        `${d.size} - ${d.system}` === rowKey && d.quantity === qty
      );
      if (priceEntry) {
        cells[rowKey][qty] = Math.round(priceEntry.base_price);
      }
    });
  });

  return { rows: uniqueRows, columns: quantities, cells };
}

// Fetch banner prices for quantity-based matrix (price per piece for 1 m²)
export async function getBannerMatrixDataFromDB(): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('banner_rates')
    .select('*')
    .order('material');

  if (error) {
    console.error('Error fetching banner rates:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const materials = data.map(item => item.material);
  // Quantities (antal) - number of pieces
  const quantities = [1, 2, 5, 10, 20, 50];

  const cells: Record<string, Record<number, number>> = {};
  materials.forEach(material => {
    const rateData = data.find(d => d.material === material);
    if (rateData) {
      cells[material] = {};
      quantities.forEach(qty => {
        // Price per piece (assuming 1m² per piece as base)
        cells[material][qty] = Math.round(rateData.price_per_sqm * qty);
      });
    }
  });

  return { rows: materials, columns: quantities, cells };
}

// Calculate banner price based on area and quantity
export function calculateBannerPrice(pricePerSqm: number, areaM2: number, quantity: number): number {
  return Math.round(pricePerSqm * areaM2 * quantity);
}

// Fetch sign prices for quantity-based matrix
export async function getSignMatrixDataFromDB(): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('sign_rates')
    .select('*')
    .order('material');

  if (error) {
    console.error('Error fetching sign rates:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const materials = data.map(item => item.material);
  // Quantities (antal) - number of pieces
  const quantities = [1, 2, 5, 10, 20, 50];

  const cells: Record<string, Record<number, number>> = {};
  materials.forEach(material => {
    const rateData = data.find(d => d.material === material);
    if (rateData) {
      cells[material] = {};
      quantities.forEach(qty => {
        // Price per piece (assuming 1m² per piece as base)
        cells[material][qty] = Math.round(rateData.price_per_sqm * qty);
      });
    }
  });

  return { rows: materials, columns: quantities, cells };
}

// Calculate sign price based on area and quantity
export function calculateSignPrice(pricePerSqm: number, areaM2: number, quantity: number): number {
  return Math.round(pricePerSqm * areaM2 * quantity);
}

// Fetch foil prices for quantity-based matrix
export async function getFoilMatrixDataFromDB(): Promise<MatrixData> {
  const { data, error } = await supabase
    .from('foil_prices')
    .select('*')
    .order('material')
    .order('from_sqm');

  if (error) {
    console.error('Error fetching foil prices:', error);
    return { rows: [], columns: [], cells: {} };
  }

  if (!data || data.length === 0) {
    return { rows: [], columns: [], cells: {} };
  }

  const materials = [...new Set(data.map(item => item.material))];
  // Quantities (antal) - number of pieces (assumed 1 m² each for matrix view)
  const quantities = [1, 2, 5, 10, 20, 50];

  const cells: Record<string, Record<number, number>> = {};
  materials.forEach(material => {
    cells[material] = {};
    const tiers = data.filter(d => d.material === material).sort((a, b) => a.from_sqm - b.from_sqm);

    quantities.forEach(qty => {
      // Total area = quantity * 1 m² (matrix assumes 1 m² per banner/foil piece)
      const totalArea = qty;
      const tier =
        tiers.find(t => totalArea >= t.from_sqm && totalArea <= t.to_sqm) ||
        tiers[tiers.length - 1];

      if (tier) {
        const discount = 1 - (tier.discount_percent / 100);
        const totalPrice = tier.price_per_sqm * totalArea * discount;
        cells[material][qty] = Math.round(totalPrice);
      }
    });
  });

  return { rows: materials, columns: quantities, cells };
}

// Calculate foil price based on area, quantity, and tiered pricing
export async function calculateFoilPrice(material: string, areaM2: number, quantity: number): Promise<number> {
  const { data, error } = await supabase
    .from('foil_prices')
    .select('*')
    .eq('material', material)
    .order('from_sqm');

  if (error || !data || data.length === 0) {
    return 0;
  }

  // Find appropriate tier based on total area
  const totalArea = areaM2 * quantity;
  const tier = data.find(d => totalArea >= d.from_sqm && totalArea <= d.to_sqm) || data[0];

  const discount = 1 - (tier.discount_percent / 100);
  return Math.round(tier.price_per_sqm * totalArea * discount);
}

// Fetch generic product prices from database and convert to matrix format
// Groups by variant_name, with variant_value as rows and quantities as columns
export async function getGenericMatrixDataFromDB(productId: string, variantName?: string): Promise<{ matrixData: MatrixData; variantNames: string[] }> {
  // First get all unique variant names for this product
  const { data: variantData } = await supabase
    .from('generic_product_prices')
    .select('variant_name')
    .eq('product_id', productId);

  const variantNames = [...new Set(variantData?.map(d => d.variant_name) || [])];

  if (variantNames.length === 0) {
    return { matrixData: { rows: [], columns: [], cells: {} }, variantNames: [] };
  }

  // Use first variant name if none specified
  const selectedVariant = variantName || variantNames[0];

  const { data, error } = await supabase
    .from('generic_product_prices')
    .select('*')
    .eq('product_id', productId)
    .eq('variant_name', selectedVariant)
    .order('variant_value')
    .order('quantity');

  if (error) {
    console.error('Error fetching generic prices:', error);
    return { matrixData: { rows: [], columns: [], cells: {} }, variantNames };
  }

  if (!data || data.length === 0) {
    return { matrixData: { rows: [], columns: [], cells: {} }, variantNames };
  }

  // Extract unique variant values and quantities
  const variantValues = [...new Set(data.map(item => item.variant_value))];
  const quantities = [...new Set(data.map(item => item.quantity))].sort((a, b) => a - b);

  // Build cells object
  const cells: Record<string, Record<number, number>> = {};
  variantValues.forEach(value => {
    cells[value] = {};
    quantities.forEach(qty => {
      const priceEntry = data.find(d => d.variant_value === value && d.quantity === qty);
      if (priceEntry) {
        cells[value][qty] = priceEntry.price_dkk;
      }
    });
  });

  return {
    matrixData: {
      rows: variantValues,
      columns: quantities,
      cells
    },
    variantNames
  };
}
