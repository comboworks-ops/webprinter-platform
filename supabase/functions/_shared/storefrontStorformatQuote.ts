import { CheckoutError, UUID, canonicalJson } from "./storefrontCheckout.ts";
import { calculateStorformatPrice, StorformatQuoteUnavailableError } from "./storefrontStorformatFormula.ts";

export type StorformatQuoteSelection = {
  widthMm: number; heightMm: number; materialId: string; finishIds: string[]; productIds: string[];
  selectedSectionValues: Record<string, string | null>;
};
export type StorformatQuoteRows = {
  config: any; materials: any[]; materialTiers: any[]; legacyMaterialPrices: any[];
  finishes: any[]; finishTiers: any[]; legacyFinishPrices: any[];
  products: any[]; productTiers: any[]; productFixedPrices: any[]; legacyProductM2Prices: any[];
};
const typeName = (value: unknown) => ["materials","finishes","products"].includes(String(value)) ? String(value) : "products";
const invalid = (code = "checkout_storformat_selection_invalid"): never => {throw new CheckoutError(code,409);};
const number = (value: unknown, fallback?: number): number => {
  if (value == null && fallback !== undefined) return fallback;
  const parsed = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) invalid("checkout_storformat_price_invalid");
  return parsed;
};
function idList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => !UUID.test(String(id))) || new Set(value).size !== value.length) invalid();
  return value as string[];
}
function checkedTiers(rows: any[]): any[] {
  return rows.map(row => {
    const from = number(row.from_m2),to = row.to_m2 == null ? null : number(row.to_m2);
    const price = number(row.price_per_m2),markup = number(row.markup_pct,0);
    if (from < 0 || to !== null && to < from || price < 0 || markup <= -100) invalid("checkout_storformat_price_invalid");
    return {...row,from_m2: from,to_m2: to,price_per_m2: price,markup_pct: markup};
  });
}
function marked(row: any) {
  const markup = number(row.markup_pct,0);
  if (markup <= -100) invalid("checkout_storformat_price_invalid");
  return {...row,markup_pct: markup};
}

/** Matches StorformatConfigurator's primary/fallback row assembly, without silently ignoring read errors. */
export function assembleStorformatRows(rows: StorformatQuoteRows) {
  const materials = rows.materials.map(row => {
    const primary = rows.materialTiers.filter(t => t.material_id === row.id);
    const fallback = rows.legacyMaterialPrices.filter(t => t.material_id === row.id).map(t => ({...t,is_anchor: t.is_anchor ?? true,markup_pct: 0}));
    return {...marked(row),max_width_mm: number(row.max_width_mm,0),max_height_mm: number(row.max_height_mm,0),tiers: checkedTiers(primary.length ? primary : fallback)};
  });
  const finishes = rows.finishes.map(row => {
    const primary = rows.finishTiers.filter(t => t.finish_id === row.id);
    const legacy = rows.legacyFinishPrices.find(t => t.finish_id === row.id);
    const fallback = legacy && number(legacy.price_per_m2,0) > 0
      ? [{id: legacy.id,from_m2: 0,to_m2: null,price_per_m2: legacy.price_per_m2,is_anchor: true,markup_pct: 0}] : [];
    const fixed = number(row.fixed_price_per_unit ?? legacy?.fixed_price,0);
    if (fixed < 0 || !["fixed","per_m2"].includes(row.pricing_mode)) invalid("checkout_storformat_price_invalid");
    return {...marked(row),fixed_price_per_unit: fixed,tiers: checkedTiers(primary.length ? primary : fallback)};
  });
  const products = rows.products.map(row => {
    const primary = rows.productTiers.filter(t => t.product_item_id === row.id);
    const fallback = rows.legacyProductM2Prices.filter(t => t.product_item_id === row.id || t.storformat_product_id === row.id)
      .map(t => ({...t,is_anchor: t.is_anchor ?? true,markup_pct: 0}));
    const initial = number(row.initial_price,0);
    if (initial < 0 || !["fixed","per_m2"].includes(row.pricing_mode)) invalid("checkout_storformat_price_invalid");
    return {...marked(row),initial_price: initial,tiers: checkedTiers(primary.length ? primary : fallback),
      fixed_prices: rows.productFixedPrices.filter(t => t.product_item_id === row.id).map(t => ({...t,quantity: number(t.quantity),price: number(t.price)}))};
  });
  return {materials,finishes,products};
}

/** Resolve the submitted selections against the stored layout, including free and required sections. */
function resolveLayout(config: any, entities: ReturnType<typeof assembleStorformatRows>, selection: StorformatQuoteSelection) {
  const idsByType: Record<string,string[]> = Object.fromEntries(Object.entries(entities).map(([key,values]) => [key,values.map(row => row.id)]));
  const normalizeIds = (value: unknown,type: string) => {
    const available = idsByType[type];
    const incoming = Array.isArray(value) ? value.filter(id => available.includes(id)) : [];
    return incoming.length ? incoming : [...available];
  };
  let sections: any[] = (Array.isArray(config.layout_rows) ? config.layout_rows : []).flatMap((row: any,r: number) =>
    (Array.isArray(row?.sections) ? row.sections : []).map((section: any,s: number) => {
      const type = typeName(section?.sectionType);
      return {id: section?.id || `section-${r + 1}-${s + 1}`,type,mode: section?.selection_mode || (type === "finishes" ? "optional" : "required"),ids: normalizeIds(section?.valueIds,type)};
    }).filter((section: any) => section.ids.length));
  if (!sections.length) {
    sections = [
      ...(idsByType.products.length ? [{id: "section-products",type: "products",mode: "required",ids: idsByType.products}] : []),
      ...(idsByType.finishes.length ? [{id: "section-finishes",type: "finishes",mode: "optional",ids: idsByType.finishes}] : []),
    ];
  }
  const rawAxis = config.vertical_axis;
  const axisType = ["materials","finishes","products"].includes(rawAxis?.sectionType) ? rawAxis.sectionType : "materials";
  const axis = {id: rawAxis?.id || "vertical-axis",type: axisType,mode: "required",ids: normalizeIds(rawAxis?.valueIds,axisType)};
  const active = [axis,...sections.filter(section => section.type !== axis.type)].filter(section => section.ids.length);
  const selected = selection.selectedSectionValues;
  if (!selected || typeof selected !== "object" || Array.isArray(selected)
    || Object.keys(selected).some(key => !active.some(section => section.id === key))) invalid();
  if (new Set(active.map(section => section.id)).size !== active.length) invalid("checkout_storformat_layout_ambiguous");
  const result: Record<string,string[]> = {materials: [],finishes: [],products: []};
  for (const section of active) {
    if (!["required","optional","free"].includes(section.mode)) invalid("checkout_storformat_layout_ambiguous");
    const value = selected[section.id];
    const free = section.mode === "free" && section.type !== "materials" && section.type !== axis.type;
    if (value != null && !section.ids.includes(value)) invalid();
    if (free) continue;
    if (!value && section.mode !== "optional") invalid("checkout_storformat_required_selection_missing");
    if (value && !result[section.type].includes(value)) result[section.type].push(value);
  }
  if (result.materials[0] !== selection.materialId
    || canonicalJson([...result.finishes].sort()) !== canonicalJson([...selection.finishIds].sort())
    || canonicalJson([...result.products].sort()) !== canonicalJson([...selection.productIds].sort())) invalid();
  return result;
}

export function calculateVerifiedStorformatQuote(rows: StorformatQuoteRows, selection: StorformatQuoteSelection, quantity: number, areaHint?: unknown) {
  if (!selection || !UUID.test(String(selection.materialId)) || !Number.isSafeInteger(quantity) || quantity <= 0) invalid();
  idList(selection.finishIds); idList(selection.productIds);
  const widthMm = number(selection.widthMm),heightMm = number(selection.heightMm);
  if (widthMm <= 0 || heightMm <= 0 || widthMm > 50_000 || heightMm > 50_000) invalid("checkout_dimensions_invalid");
  const config = rows.config;
  if (!config || config.is_published === false) invalid("checkout_storformat_unavailable");
  const usesSourceQuotes = config.area_pricing_basis === "per_piece_quotes";
  const quantities = Array.isArray(config.quantities) && config.quantities.length ? config.quantities.map(Number) : [1];
  if (!quantities.includes(quantity)) invalid("checkout_quantity_unavailable");
  const entities = assembleStorformatRows(rows);
  const resolved = resolveLayout(config,entities,selection);
  const material = entities.materials.find(row => row.id === selection.materialId);
  const finishes = resolved.finishes.map(id => entities.finishes.find(row => row.id === id)!);
  const products = resolved.products.map(id => entities.products.find(row => row.id === id)!);
  if (!material || !usesSourceQuotes && !material.tiers.length) invalid("checkout_storformat_price_missing");
  const exceeds = material.max_width_mm > 0 && widthMm > material.max_width_mm
    || material.max_height_mm > 0 && heightMm > material.max_height_mm;
  if (exceeds && material.allow_split !== true) invalid("checkout_dimensions_exceed_material");
  if (!usesSourceQuotes && (finishes.some(row => row.pricing_mode === "per_m2" && !row.tiers.length)
    || products.some(row => row.pricing_mode === "per_m2" && !row.tiers.length))) invalid("checkout_storformat_price_missing");
  // Existing fixed-product formula permits initial_price-only items. A partial
  // quantity table must not silently fall through to zero for an absent quantity.
  if (!usesSourceQuotes && products.some(row => row.pricing_mode === "fixed" && row.fixed_prices.length
    && !row.fixed_prices.some((price: any) => price.quantity === quantity))) invalid("checkout_storformat_quantity_price_missing");
  if (products.some(row => row.fixed_prices.some((price: any) => price.price < 0))) invalid("checkout_storformat_price_invalid");
  const markup = number(config.global_markup_pct,0),configuredRounding = number(config.rounding_step,1);
  const rounding = usesSourceQuotes ? configuredRounding : configuredRounding || 1;
  if (markup <= -100 || rounding <= 0) invalid("checkout_storformat_price_invalid");
  let result: ReturnType<typeof calculateStorformatPrice>;
  try {
    result = calculateStorformatPrice({widthMm,heightMm,quantity,material,finishes,products,
      config: {rounding_step: rounding,global_markup_pct: markup,quantities,
        area_pricing_basis: config.area_pricing_basis,source_quote_model: config.source_quote_model}});
  } catch (error) {
    if (error instanceof StorformatQuoteUnavailableError) invalid("checkout_storformat_price_missing");
    throw error;
  }
  if (areaHint != null && Math.abs(number(areaHint) - result.areaM2) > 0.000001) invalid("checkout_area_mismatch");
  if (!Number.isFinite(result.totalPrice) || result.totalPrice <= 0) invalid("checkout_storformat_price_missing");
  return {...result,selection: {...selection,widthMm,heightMm},source: usesSourceQuotes ? "storformat_source_quotes_v1" : "storformat_existing_formula_v1"};
}

/** All reads are scoped to the exact product and tenant; pagination cannot silently truncate tiers. */
export async function loadStorformatQuoteRows(client: any, productId: string, tenantId: string): Promise<StorformatQuoteRows> {
  const read = async (table: string,order = "sort_order",optionalAbsent = false) => {
    const result: any[] = [];
    for (let offset = 0; offset < 50_000; offset += 1000) {
      const {data,error} = await client.from(table).select("*").eq("product_id",productId).eq("tenant_id",tenantId)
        .order(order).order("id").range(offset,offset + 999);
      if (error && optionalAbsent && ["42P01","PGRST205"].includes(error.code)) return [];
      if (error) throw new CheckoutError("checkout_storformat_backend_unavailable",503);
      result.push(...(data || []));
      if ((data || []).length < 1000) return result;
    }
    throw new CheckoutError("checkout_storformat_catalog_too_large",503);
  };
  const {data: config,error} = await client.from("storformat_configs").select("*").eq("product_id",productId).eq("tenant_id",tenantId).maybeSingle();
  if (error || !config) throw new CheckoutError("checkout_storformat_unavailable",409);
  const [materials,materialTiers,legacyMaterialPrices,finishes,finishTiers,legacyFinishPrices,products,productTiers,productFixedPrices] = await Promise.all([
    read("storformat_materials"),read("storformat_material_price_tiers"),read("storformat_m2_prices","from_m2"),
    read("storformat_finishes"),read("storformat_finish_price_tiers"),read("storformat_finish_prices","id"),
    read("storformat_products"),read("storformat_product_price_tiers"),read("storformat_product_fixed_prices"),
  ]);
  const needsLegacyProduct = products.some(row => row.pricing_mode === "per_m2" && !productTiers.some(tier => tier.product_item_id === row.id));
  const legacyProductM2Prices = needsLegacyProduct ? await read("storformat_product_m2_prices","from_m2",true) : [];
  return {config,materials,materialTiers,legacyMaterialPrices,finishes,finishTiers,legacyFinishPrices,products,productTiers,productFixedPrices,legacyProductM2Prices};
}
