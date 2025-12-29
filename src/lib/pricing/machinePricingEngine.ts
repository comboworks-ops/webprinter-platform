
/**
 * Machine Pricing Engine (MPA)
 * Pure functions for calculating print costs and imposition.
 */

export interface Machine {
    mode: 'SHEET' | 'ROLL';
    sheet_width_mm?: number;
    sheet_height_mm?: number;
    roll_width_mm?: number;
    margin_left_mm: number;
    margin_right_mm: number;
    margin_top_mm: number;
    margin_bottom_mm: number;
    duplex_supported: boolean;
    setup_waste_sheets: number;
    run_waste_pct: number;
    setup_time_min: number;
    sheets_per_hour?: number;
    m2_per_hour?: number;
    machine_rate_per_hour: number;
}

export interface InkSet {
    price_per_ml: number;
    ml_per_m2_at_100pct: number;
    default_coverage_pct: number;
    tolerance_pct: number;
}

export interface Material {
    pricing_mode: 'PER_SHEET' | 'PER_M2';
    price_per_sheet?: number;
    sheet_width_mm?: number;
    sheet_height_mm?: number;
    price_per_m2?: number;
}

export interface ImpositionResult {
    ups: number;
    rotation: 0 | 90;
    printableWidth: number;
    printableHeight: number;
    itemWidthWithBleedGap: number;
    itemHeightWithBleedGap: number;
    cols: number;
    rows: number;
}

/**
 * Calculates how many items fit on a sheet/roll segment.
 */
export function computeImposition(
    machine: Machine,
    itemWidth: number,
    itemHeight: number,
    bleed: number,
    gap: number
): ImpositionResult {
    const itemW = itemWidth + (bleed * 2) + gap;
    const itemH = itemHeight + (bleed * 2) + gap;

    // Printable area after machine margins
    const pWidth = (machine.mode === 'SHEET' ? (machine.sheet_width_mm || 0) : (machine.roll_width_mm || 0))
        - machine.margin_left_mm - machine.margin_right_mm;
    const pHeight = machine.mode === 'SHEET' ? ((machine.sheet_height_mm || 0) - machine.margin_top_mm - machine.margin_bottom_mm) : 1000; // 1m segment for roll

    // Option 1: No rotation
    const cols1 = Math.floor(pWidth / itemW);
    const rows1 = Math.floor(pHeight / itemH);
    const ups1 = Math.max(0, cols1 * rows1);

    // Option 2: 90 deg rotation
    const cols2 = Math.floor(pWidth / itemH);
    const rows2 = Math.floor(pHeight / itemW);
    const ups2 = Math.max(0, cols2 * rows2);

    if (ups1 >= ups2) {
        return {
            ups: ups1,
            rotation: 0,
            printableWidth: pWidth,
            printableHeight: pHeight,
            itemWidthWithBleedGap: itemW,
            itemHeightWithBleedGap: itemH,
            cols: cols1,
            rows: rows1
        };
    } else {
        return {
            ups: ups2,
            rotation: 90,
            printableWidth: pWidth,
            printableHeight: pHeight,
            itemWidthWithBleedGap: itemH,
            itemHeightWithBleedGap: itemW,
            cols: cols2,
            rows: rows2
        };
    }
}

/**
 * Computes base costs for a specific quantity.
 */
export function computeBaseCosts(
    qty: number,
    sides: 1 | 2,
    imposition: ImpositionResult,
    machine: Machine,
    material: Material,
    inkSet: InkSet,
    coveragePct?: number
) {
    if (imposition.ups === 0) return null;

    const netSheets = Math.ceil(qty / imposition.ups);
    const wasteSheets = machine.setup_waste_sheets + Math.ceil(netSheets * (machine.run_waste_pct / 100));
    const totalSheets = netSheets + wasteSheets;

    // 1. Material Cost
    let materialCost = 0;
    if (material.pricing_mode === 'PER_SHEET') {
        materialCost = totalSheets * (material.price_per_sheet || 0);
    } else {
        const sheetAreaM2 = (imposition.printableWidth * imposition.printableHeight) / 1000000;
        materialCost = totalSheets * sheetAreaM2 * (material.price_per_m2 || 0);
    }

    // 2. Ink Cost
    // Area of the item including bleed (ink is used in bleed areas)
    const itemAreaM2 = ((imposition.itemWidthWithBleedGap - imposition.cols) * (imposition.itemHeightWithBleedGap - imposition.rows)) / 1000000;
    // Simplified area: item + bleed
    const inkAreaM2 = qty * sides * itemAreaM2;
    const coverage = coveragePct ?? inkSet.default_coverage_pct;
    const inkMl = inkAreaM2 * inkSet.ml_per_m2_at_100pct * (coverage / 100);
    const inkCost = inkMl * inkSet.price_per_ml;

    // 3. Machine Cost (Time based)
    let runtimeMin = 0;
    if (machine.sheets_per_hour) {
        runtimeMin = (totalSheets / machine.sheets_per_hour) * 60;
    } else if (machine.m2_per_hour) {
        const totalM2 = totalSheets * ((imposition.printableWidth * imposition.printableHeight) / 1000000);
        runtimeMin = (totalM2 / machine.m2_per_hour) * 60;
    }
    const totalTimeMin = machine.setup_time_min + runtimeMin;
    const machineCost = (totalTimeMin / 60) * machine.machine_rate_per_hour;

    return {
        materialCost,
        inkCost,
        machineCost,
        totalBaseCost: materialCost + inkCost + machineCost,
        totalSheets,
        totalTimeMin
    };
}

/**
 * Applies margin profiles to the base cost.
 */
export function applyMargin(
    baseCost: number,
    qty: number,
    profile: { mode: 'TARGET_MARGIN' | 'MARKUP', rounding_step?: number },
    tiers: { qty_from: number, qty_to?: number, value: number }[]
) {
    const tier = tiers.find(t => qty >= t.qty_from && (!t.qty_to || qty <= t.qty_to));
    const rate = tier ? tier.value : 0; // percentage

    let sellPrice = 0;
    if (profile.mode === 'TARGET_MARGIN') {
        // baseCost / (1 - margin) = sellPrice
        const margin = rate / 100;
        sellPrice = margin === 1 ? baseCost : baseCost / (1 - margin);
    } else {
        // baseCost * (1 + markup) = sellPrice
        sellPrice = baseCost * (1 + (rate / 100));
    }

    // Rounding
    if (profile.rounding_step) {
        sellPrice = Math.ceil(sellPrice / profile.rounding_step) * profile.rounding_step;
    }

    return {
        sellPrice,
        unitPrice: sellPrice / qty,
        profit: sellPrice - baseCost,
        profitPct: sellPrice === 0 ? 0 : ((sellPrice - baseCost) / sellPrice) * 100
    };
}
