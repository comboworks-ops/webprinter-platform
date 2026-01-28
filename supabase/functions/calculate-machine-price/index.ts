
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// --- ENGINE LOGIC ---

function computeImposition(machines: any[], itemW: number, itemH: number) {
    let best = null;

    for (const machine of machines) {
        const isRoll = machine.mode === 'ROLL';
        const printWidth = (isRoll ? machine.roll_width_mm : machine.sheet_width_mm)
            - machine.margin_left_mm - machine.margin_right_mm;

        if (isRoll) {
            // For ROLL machines: items are printed sequentially along the roll
            // We can rotate the item to fit width-wise if needed

            // Try natural orientation: item width along roll width
            let itemFitsWidth = itemW <= printWidth;
            let itemFitsRotated = itemH <= printWidth;

            if (!itemFitsWidth && !itemFitsRotated) {
                // Item too wide for this machine in any orientation
                continue;
            }

            // Choose best orientation (prefer fitting without rotation)
            const useRotation = !itemFitsWidth && itemFitsRotated;
            const fitWidth = useRotation ? itemH : itemW;
            const fitHeight = useRotation ? itemW : itemH;

            // How many items fit across the roll width?
            const cols = Math.max(1, Math.floor(printWidth / fitWidth));

            // For rolls, items are printed in strips - each strip has 'cols' items
            // The length (height) of each strip = fitHeight
            const ups = cols; // Items per "row" on the roll

            // For area calculations: treat each item's portion of the roll as a sheet
            const sheetWidth = machine.roll_width_mm;
            const sheetHeight = fitHeight + machine.margin_top_mm + machine.margin_bottom_mm;

            const res = {
                ups,
                rotation: useRotation ? 90 : 0,
                cols,
                rows: 1, // For rolls, we process one row at a time
                pWidth: printWidth,
                pHeight: fitHeight,
                itemWidth: fitWidth,
                itemHeight: fitHeight,
                sheetWidth,
                sheetHeight,
                machineId: machine.id,
                mode: 'ROLL'
            };

            if (!best || res.ups > best.ups) {
                best = res;
            }
        } else {
            // SHEET mode - original grid logic
            const printHeight = machine.sheet_height_mm - machine.margin_top_mm - machine.margin_bottom_mm;

            const cols1 = Math.floor(printWidth / itemW);
            const rows1 = Math.floor(printHeight / itemH);
            const ups1 = Math.max(0, cols1 * rows1);

            const cols2 = Math.floor(printWidth / itemH);
            const rows2 = Math.floor(printHeight / itemW);
            const ups2 = Math.max(0, cols2 * rows2);

            const visualWidth = machine.sheet_width_mm;
            const visualHeight = machine.sheet_height_mm;

            const res = ups1 >= ups2
                ? { ups: ups1, rotation: 0, cols: cols1, rows: rows1, pWidth: printWidth, pHeight: printHeight, itemWidth: itemW, itemHeight: itemH, sheetWidth: visualWidth, sheetHeight: visualHeight, machineId: machine.id, mode: 'SHEET' }
                : { ups: ups2, rotation: 90, cols: cols2, rows: rows2, pWidth: printWidth, pHeight: printHeight, itemWidth: itemH, itemHeight: itemW, sheetWidth: visualWidth, sheetHeight: visualHeight, machineId: machine.id, mode: 'SHEET' };

            if (!best || res.ups > best.ups) {
                best = res;
            }
        }
    }

    return best;
}

function calculateCost(qty: number, sides: number, imposition: any, machines: any[], material: any, inkSet: any, coverage: number) {
    if (!imposition || imposition.ups === 0) return null;

    const machine = machines.find(m => m.id === imposition.machineId);
    if (!machine) return null;

    const isRoll = imposition.mode === 'ROLL';

    // For ROLL machines: each "sheet" is a strip containing 'ups' items
    // For SHEET machines: each sheet contains 'ups' items
    const netSheets = Math.ceil(qty / imposition.ups);
    const wasteSheets = (machine.setup_waste_sheets || 0) + Math.ceil(netSheets * ((machine.run_waste_pct || 0) / 100));
    const totalSheets = netSheets + wasteSheets;

    // Calculate material area
    let materialCost = 0;
    let totalArea = 0;

    if (material.pricing_mode === 'PER_SHEET') {
        materialCost = totalSheets * (material.price_per_sheet || 0);
    } else {
        // For rolls: use actual roll width and item height as the "sheet" size
        const sheetArea = (imposition.sheetWidth * imposition.sheetHeight) / 1000000; // in m²
        totalArea = totalSheets * sheetArea;
        materialCost = totalArea * (material.price_per_m2 || 0);
    }

    // Ink cost based on actual printed area
    const printedArea = qty * sides * (imposition.itemWidth * imposition.itemHeight / 1000000);
    const inkCost = printedArea * (inkSet?.ml_per_m2_at_100pct || 0) * (coverage / 100) * (inkSet?.price_per_ml || 0);

    // Machine time - use m2_per_hour for roll machines
    let runtimeMin = 0;
    if (isRoll && machine.m2_per_hour) {
        runtimeMin = (totalArea / machine.m2_per_hour) * 60;
    } else if (machine.sheets_per_hour) {
        runtimeMin = (totalSheets / machine.sheets_per_hour) * 60;
    }
    const machineCost = (((machine.setup_time_min || 0) + runtimeMin) / 60) * (machine.machine_rate_per_hour || 0);

    console.log(`[calculateCost] qty=${qty}, ups=${imposition.ups}, netSheets=${netSheets}, totalSheets=${totalSheets}`);
    console.log(`[calculateCost] sheetSize=${imposition.sheetWidth}x${imposition.sheetHeight}mm, totalArea=${totalArea.toFixed(2)}m²`);
    console.log(`[calculateCost] itemSize=${imposition.itemWidth}x${imposition.itemHeight}mm, printedArea=${printedArea.toFixed(2)}m²`);
    console.log(`[calculateCost] materialCost=${materialCost.toFixed(2)}, inkCost=${inkCost.toFixed(2)}, machineCost=${machineCost.toFixed(2)}`);
    console.log(`[calculateCost] price_per_m2=${material.price_per_m2}, mode=${isRoll ? 'ROLL' : 'SHEET'}`);

    const totalBaseCost = materialCost + inkCost + machineCost;
    console.log(`[calculateCost] totalBaseCost=${totalBaseCost.toFixed(2)}`);

    return { materialCost, inkCost, machineCost, totalBaseCost, totalSheets, totalArea };
}

// --- MAIN FUNCTION ---

// --- MAIN FUNCTION ---

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

    try {
        const body = await req.json()
        const { productId, quantity, quantities, width, height, sides: sidesStr, material_id, material_ids, finish_ids, coverage } = body

        const qties = quantities || [quantity || body.qty];
        const sides = sidesStr === '4+4' ? 2 : 1;
        const matIds = material_ids || [material_id || body.materialId];

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch Config
        const { data: config, error: configErr } = await supabase
            .from('product_pricing_configs')
            .select('*, pricing_profiles(*, machines(*), ink_sets(*)), margin_profiles(*, margin_profile_tiers(*))')
            .eq('product_id', productId)
            .single()

        if (configErr || !config) throw new Error("Pricing configuration not found")

        // 2. Fetch Materials & Finishes (Batch)
        const { data: allMaterials } = await supabase.from('materials').select('*').in('id', matIds)
        if (!allMaterials || allMaterials.length === 0) throw new Error("Materials not found")

        const { data: allFinishes } = (finish_ids?.length > 0)
            ? await supabase.from('finish_options').select('*').in('id', finish_ids)
            : { data: [] };

        const results = [];

        // 3. Calculation Loop
        console.log(`Calculating for ${matIds.length} materials and ${qties.length} quantities`);

        const rawMachines = config.pricing_profiles?.machines;
        const machines = Array.isArray(rawMachines) ? rawMachines : (rawMachines ? [rawMachines] : []);
        console.log(`Available machines: ${machines.length}`);

        if (machines.length === 0) throw new Error("No machines found in configuration");

        for (const matId of matIds) {
            const material = allMaterials.find(m => m.id === matId);
            if (!material) {
                console.log(`Material ${matId} not found in fetch`);
                continue;
            }

            for (const qty of qties) {
                let finishCost = 0;
                allFinishes?.forEach(f => {
                    finishCost += (f.price_per_unit || 0) * qty + (f.price_per_sheet || 0) * (qty / 2) + (f.price_per_m2 || 0) * (qty * width * height / 1000000);
                });

                const bleed = body.bleed_mm ?? config.bleed_mm ?? config.pricing_profiles.default_bleed_mm ?? 3;
                const gap = body.gap_mm ?? config.gap_mm ?? config.pricing_profiles.default_gap_mm ?? 2;
                const itemW = (width || body.size?.width || 210) + (bleed * 2) + gap;
                const itemH = (height || body.size?.height || 297) + (bleed * 2) + gap;

                console.log(`Item size with bleed: ${itemW}x${itemH}`);

                const imposition = computeImposition(machines, itemW, itemH);
                if (!imposition) {
                    console.log(`No imposition found for ${itemW}x${itemH}`);
                    continue;
                }

                const costs = calculateCost(qty, sides, imposition, machines, material, config.pricing_profiles.ink_sets, coverage || 10);
                if (!costs) {
                    console.log(`Cost calculation failed for qty ${qty}`);
                    continue;
                }

                let numberingCost = 0;
                if (config.numbering_enabled) {
                    numberingCost = (config.numbering_setup_fee || 0) + (qty * (config.numbering_price_per_unit || 0) * (config.numbering_positions || 1));
                }

                const totalCost = costs.totalBaseCost + finishCost + numberingCost;
                console.log(`Total base cost: ${totalCost}`);

                // 4. Margin
                const profile = config.margin_profiles;
                if (!profile) {
                    console.log("No margin profile found - using default 0% margin");
                }
                const tiers = profile?.margin_profile_tiers || [];
                const totalArea = (qty * width * height) / 1000000;
                const basisValue = profile?.tier_basis === 'AREA' ? totalArea : qty;

                const tier = tiers.find((t: any) =>
                    basisValue >= t.qty_from && (!t.qty_to || basisValue <= t.qty_to)
                ) || { value: 50 }; // Default 50% margin if no tier found

                console.log(`Margin tier found: ${tier.value}%`);

                let sellPrice = profile?.mode === 'TARGET_MARGIN'
                    ? totalCost / (1 - (tier.value / 100))
                    : totalCost * (1 + (tier.value / 100));

                if (profile?.rounding_step) sellPrice = Math.ceil(sellPrice / profile.rounding_step) * profile.rounding_step;

                results.push({
                    materialId: matId,
                    materialName: material.name,
                    quantity: qty,
                    totalPrice: sellPrice,
                    unitPrice: sellPrice / qty,
                    breakdown: { ...costs, finishCost, numberingCost, margin: tier.value },
                    imposition: { ...imposition, totalSheets: costs.totalSheets }
                });
            }
        }

        // Return single result if not requested as batch, or full list
        const isBatch = !!(quantities || material_ids);

        console.log(`Calculation complete. Results count: ${results.length}`);

        if (results.length === 0) {
            return new Response(JSON.stringify({ error: "No price could be calculated. Check machine, material, and margin configuration." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const responseData = isBatch ? { results } : results[0];

        return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

    } catch (error) {
        console.error("Edge function error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
})
