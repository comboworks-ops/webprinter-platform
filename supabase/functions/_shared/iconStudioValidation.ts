import { parseStudioConnection, type StudioConnectionBinding } from './iconStudioConnection.ts';
import { ICON_STUDIO_BRAND_FINISH_KEYS, ICON_STUDIO_OUTPUT_FORMATS, ICON_STUDIO_OUTPUT_SIZES, ICON_STUDIO_PLACEMENT_PRESET_KEYS, ICON_STUDIO_PRODUCT_KEYS, ICON_STUDIO_STYLE_KEYS, ICON_STUDIO_VARIANT_KEYS, getIconStudioPlacementPresets, type IconStudioProductKey, type IconStudioStyleKey, type IconStudioVariantKey, type IconStudioBrandFinishKey, type IconStudioPlacementPresetKey, type IconStudioOutputFormat, type IconStudioOutputSize } from './iconStudioCatalog.ts';
import { parseStudioRecipe, studioStyle, studioVariant, STUDIO_MAX_COLLECTION, STUDIO_UUID, type StudioRecipe, type StudioCollection } from './iconStudioRecipe.ts';

export interface StudioPayload {
  tenantId: string; productKey: IconStudioProductKey; styleKey: IconStudioStyleKey; variantKey: IconStudioVariantKey;
  brandOverlay: { enabled: boolean; assetId: string | null; placementPreset: IconStudioPlacementPresetKey | null; finishKey: IconStudioBrandFinishKey };
  references: { referenceAssetIds: string[]; maxAssets: number };
  output: { background: 'transparent'; format: IconStudioOutputFormat; size: IconStudioOutputSize };
  connection?: StudioConnectionBinding; recipe?: StudioRecipe; collection?: StudioCollection; sampleCount?: 1 | 3;
}
function member(value: unknown, choices: readonly unknown[]) { return choices.includes(value); }
export function parseStudioPayload(value: unknown, tenantId: string): StudioPayload {
  if (!value || typeof value !== 'object') throw new Error('Ugyldig billedopgave.');
  const p = value as StudioPayload;
  if (!STUDIO_UUID.test(tenantId) || p.tenantId !== tenantId
    || !member(p.productKey, ICON_STUDIO_PRODUCT_KEYS) || !member(p.styleKey, ICON_STUDIO_STYLE_KEYS) || !member(p.variantKey, ICON_STUDIO_VARIANT_KEYS)
    || !p.output || p.output.background !== 'transparent' || !member(p.output.format, ICON_STUDIO_OUTPUT_FORMATS) || !member(p.output.size, ICON_STUDIO_OUTPUT_SIZES)
    || !p.references || !Number.isInteger(p.references.maxAssets) || p.references.maxAssets < 1 || p.references.maxAssets > 5
    || !Array.isArray(p.references.referenceAssetIds) || p.references.referenceAssetIds.length > 5 || !p.references.referenceAssetIds.every(id => typeof id === 'string' && STUDIO_UUID.test(id))
    || !p.brandOverlay || typeof p.brandOverlay.enabled !== 'boolean' || !member(p.brandOverlay.finishKey, ICON_STUDIO_BRAND_FINISH_KEYS)
    || (p.brandOverlay.assetId !== null && (typeof p.brandOverlay.assetId !== 'string' || !STUDIO_UUID.test(p.brandOverlay.assetId)))
    || (p.brandOverlay.placementPreset !== null && !member(p.brandOverlay.placementPreset, ICON_STUDIO_PLACEMENT_PRESET_KEYS))
    || (p.sampleCount !== undefined && p.sampleCount !== 1 && p.sampleCount !== 3)) throw new Error('Ugyldige billedindstillinger eller forkert shop.');
  if (p.brandOverlay.enabled && (!p.brandOverlay.assetId || !getIconStudioPlacementPresets(p.productKey, p.variantKey).some(v => v.key === p.brandOverlay.placementPreset))) throw new Error('Vælg et gyldigt logo og en placering.');
  const recipe = p.recipe === undefined ? undefined : parseStudioRecipe(p.recipe, p.productKey);
  if (recipe && (studioStyle(recipe.styleId).legacyStyle !== p.styleKey || studioVariant(recipe.viewId) !== p.variantKey)) throw new Error('Stilopskriften matcher ikke opgaven.');
  if (p.collection) {
    const c = p.collection;
    if (!recipe || !recipe.anchorOutputId || typeof c.id !== 'string' || !STUDIO_UUID.test(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80
      || !Number.isInteger(c.index) || !Number.isInteger(c.total) || c.total < 1 || c.total > STUDIO_MAX_COLLECTION || c.index < 0 || c.index >= c.total || p.sampleCount !== 1) throw new Error('Ugyldig samling.');
  }
  return { ...(p.connection === undefined ? {} : {connection:parseStudioConnection(p.connection)}), tenantId, productKey:p.productKey, styleKey:p.styleKey, variantKey:p.variantKey, brandOverlay: { ...p.brandOverlay }, references: { referenceAssetIds:[...p.references.referenceAssetIds], maxAssets:p.references.maxAssets }, output:{ ...p.output }, ...(recipe ? {recipe} : {}), ...(p.collection ? {collection:{id:p.collection.id,name:p.collection.name,index:p.collection.index,total:p.collection.total}} : {}), ...(p.sampleCount ? {sampleCount:p.sampleCount} : {}) };
}
