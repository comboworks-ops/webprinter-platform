import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';

/** Styling-only edits, addressed by section ID so layout reorderings stay intact. */
export interface ProductStylingPatch {
    sectionId?: string;
    path: string[];
    value: unknown;
}

export interface ProductStylingChange {
    productId: string;
    pricingStructure: Record<string, unknown>;
    patches: ProductStylingPatch[];
    isDirty: boolean;
}

export interface ProductStylingPreview extends ProductStylingChange {}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const patchKey = (patch: ProductStylingPatch) => JSON.stringify([patch.sectionId ?? null, ...patch.path]);

function sections(structure: JsonObject): JsonObject[] {
    const rows = Array.isArray(structure.layout_rows) ? structure.layout_rows : [];
    const columns = rows.flatMap(row => Array.isArray(object(row).columns) ? object(row).columns as unknown[] : []);
    return [structure.vertical_axis, ...columns].filter(value => value && typeof value === 'object').map(object);
}

function diff(before: unknown, after: unknown, path: string[], sectionId?: string): ProductStylingPatch[] {
    if (equal(before, after)) return [];
    if (after && typeof after === 'object' && !Array.isArray(after)) {
        const previous = object(before);
        const next = object(after);
        return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
            .flatMap(key => diff(previous[key], next[key], [...path, key], sectionId));
    }
    return [{ sectionId, path, value: after }];
}

/** Only fields owned by the existing Site Design product-options editor are diffed. */
export function collectProductStylingPatches(before: unknown, after: unknown): ProductStylingPatch[] {
    const previous = object(before);
    const next = object(after);
    const patches = ['buttonStyling', 'matrixBox'].flatMap(key => diff(previous[key], next[key], [key]));
    const oldSections = sections(previous);
    for (const section of sections(next)) {
        const sectionId = section.sectionId || section.id;
        const old = oldSections.find(candidate => (candidate.sectionId || candidate.id) === sectionId);
        if (typeof sectionId !== 'string' || !old) continue;
        for (const key of ['title', 'ui_mode', 'selection_mode', 'valueIds', 'valueSettings', 'selectorStyling', 'thumbnail_size', 'thumbnail_custom_px']) {
            patches.push(...diff(old[key], section[key], [key], sectionId));
        }
    }
    return patches;
}

export function valueStylingPatches(sectionId: string, valueId: string, settings: Record<string, unknown>): ProductStylingPatch[] {
    return Object.entries(settings).map(([key, value]) => ({ sectionId, path: ['valueSettings', valueId, key], value }));
}

export function selectorBoxStylingPatches(sectionId: string, settings: Record<string, unknown>): ProductStylingPatch[] {
    return Object.entries(settings).map(([key, value]) => ({ sectionId, path: ['selectorStyling', 'selectorBox', key], value }));
}

export function removeSavedStylingPatches(pending: ProductStylingPatch[], saved: ProductStylingPatch[]): ProductStylingPatch[] {
    const acknowledged = new Map(saved.map(patch => [patchKey(patch), patch]));
    return pending.filter(patch => !acknowledged.has(patchKey(patch)) || !equal(acknowledged.get(patchKey(patch))?.value, patch.value));
}

export function applyProductStylingPatches(structure: unknown, patches: ProductStylingPatch[]): Record<string, unknown> {
    const result = structuredClone(object(structure));
    for (const patch of patches) {
        let target = patch.sectionId
            ? sections(result).find(section => (section.sectionId || section.id) === patch.sectionId)
            : result;
        if (!target) throw new Error('Valgsektionen findes ikke længere i produktets layout');
        if (patch.path[0] === 'valueSettings' && (!Array.isArray(target.valueIds) || !target.valueIds.includes(patch.path[1]))) {
            throw new Error('Valget findes ikke længere i produktets layout');
        }
        for (const key of patch.path.slice(0, -1)) {
            target[key] = object(target[key]);
            target = object(target[key]);
        }
        const key = patch.path[patch.path.length - 1];
        if (patch.value === undefined) delete target[key];
        else target[key] = structuredClone(patch.value);
    }
    return result;
}

export function mergeProductStylingChange(current: ProductStylingPreview | null, change: ProductStylingChange): ProductStylingPreview {
    const pending = current?.productId === change.productId ? current.patches : [];
    const patches = change.isDirty
        ? [...new Map([...pending, ...change.patches].map(patch => [patchKey(patch), patch])).values()]
        : removeSavedStylingPatches(pending, change.patches);
    const base = change.isDirty && current?.productId === change.productId ? current.pricingStructure : change.pricingStructure;
    return { productId: change.productId, pricingStructure: applyProductStylingPatches(base, patches), patches, isDirty: patches.length > 0 };
}

// Serialize saves from the main editor and both contextual editors for this product.
// The existing products BEFORE UPDATE timestamp trigger supplies the version token.
// Its conditional UPDATE additionally detects a writer in another browser/session.
const saves = new Map<string, Promise<unknown>>();
export async function persistProductStylingPatches(
    client: Pick<SupabaseClient<Database>, 'from'>,
    tenantId: string,
    productId: string,
    patches: ProductStylingPatch[],
): Promise<Record<string, unknown>> {
    const key = `${tenantId}:${productId}`;
    const previous = saves.get(key);
    const work = (async () => {
        if (previous) await previous.catch(() => undefined);
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const { data: product, error: loadError } = await client.from('products')
                .select('id, pricing_structure, updated_at').eq('id', productId).eq('tenant_id', tenantId).single();
            if (loadError || !product || product.id !== productId) throw loadError || new Error('Produktet blev ikke fundet i denne shop');
            const updated = applyProductStylingPatches(product.pricing_structure, patches);
            const query = client.from('products').update({ pricing_structure: JSON.parse(JSON.stringify(updated)) as Json })
                .eq('id', productId).eq('tenant_id', tenantId)
                .eq('updated_at', product.updated_at);
            const { data: saved, error } = await query.select('id, pricing_structure').maybeSingle();
            if (error) throw error;
            if (saved?.id === productId) return object(saved.pricing_structure);
        }
        throw new Error('Produktet blev ikke opdateret. Genindlæs produktet og prøv igen.');
    })();
    saves.set(key, work);
    try { return await work; }
    finally { if (saves.get(key) === work) saves.delete(key); }
}
