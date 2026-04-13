import { z } from "zod";

import {
  ICON_STUDIO_BRAND_FINISH_KEYS,
  ICON_STUDIO_OUTPUT_FORMATS,
  ICON_STUDIO_OUTPUT_SIZES,
  ICON_STUDIO_PLACEMENT_PRESET_KEYS,
  ICON_STUDIO_PRODUCT_KEYS,
  ICON_STUDIO_STYLE_KEYS,
  ICON_STUDIO_VARIANT_KEYS,
  type IconStudioBrandFinishKey,
  type IconStudioOutputFormat,
  type IconStudioOutputSize,
  type IconStudioPlacementPresetKey,
  type IconStudioProductKey,
  type IconStudioStyleKey,
  type IconStudioVariantKey,
  getIconStudioPlacementPresets,
} from "./catalog";

export type IconStudioAssetRole = "logo" | "symbol" | "seal" | "mark";
export type IconStudioJobStatus = "draft" | "processing" | "ready_for_review" | "approved" | "failed";
export type IconStudioOutputKind = "draft" | "final";
export type IconStudioOutputStatus = "active" | "approved" | "archived";

export interface IconStudioReferenceAssetRow {
  id: string;
  tenant_id: string;
  name: string;
  product_key: IconStudioProductKey;
  style_key: IconStudioStyleKey | null;
  variant_key: IconStudioVariantKey | null;
  finish_key: IconStudioBrandFinishKey | null;
  usage_tags: string[];
  priority: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  preview_url?: string | null;
}

export interface IconStudioBrandAssetRow {
  id: string;
  tenant_id: string;
  name: string;
  asset_role: IconStudioAssetRole;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  preview_url?: string | null;
}

export interface IconStudioJobRow {
  id: string;
  tenant_id: string;
  job_name: string | null;
  product_key: IconStudioProductKey;
  style_key: IconStudioStyleKey;
  variant_key: IconStudioVariantKey;
  status: IconStudioJobStatus;
  provider_key: string;
  payload: IconStudioGenerationPayload;
  resolved_reference_asset_ids: string[];
  selected_brand_asset_id: string | null;
  approved_output_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IconStudioJobOutputRow {
  id: string;
  tenant_id: string;
  job_id: string;
  label: string;
  kind: IconStudioOutputKind;
  status: IconStudioOutputStatus;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  preview_url?: string | null;
}

export interface IconStudioJobWithOutputs extends IconStudioJobRow {
  outputs: IconStudioJobOutputRow[];
}

export interface IconStudioPayloadBuilderInput {
  tenantId: string;
  productKey: IconStudioProductKey;
  styleKey: IconStudioStyleKey;
  variantKey: IconStudioVariantKey;
  brandOverlayEnabled: boolean;
  brandAssetId?: string | null;
  placementPreset?: IconStudioPlacementPresetKey | null;
  finishKey: IconStudioBrandFinishKey;
  referenceAssetIds?: string[];
  maxReferenceAssets?: number;
  format: IconStudioOutputFormat;
  size: IconStudioOutputSize;
}

export interface IconStudioGenerationPayload {
  productKey: IconStudioProductKey;
  styleKey: IconStudioStyleKey;
  variantKey: IconStudioVariantKey;
  tenantId: string;
  brandOverlay: {
    enabled: boolean;
    assetId: string | null;
    placementPreset: IconStudioPlacementPresetKey | null;
    finishKey: IconStudioBrandFinishKey;
  };
  references: {
    referenceAssetIds: string[];
    maxAssets: number;
  };
  output: {
    background: "transparent";
    format: IconStudioOutputFormat;
    size: IconStudioOutputSize;
  };
}

const outputSizeValues = new Set<number>(ICON_STUDIO_OUTPUT_SIZES);

export const IconStudioGenerationPayloadSchema = z.object({
  productKey: z.enum(ICON_STUDIO_PRODUCT_KEYS),
  styleKey: z.enum(ICON_STUDIO_STYLE_KEYS),
  variantKey: z.enum(ICON_STUDIO_VARIANT_KEYS),
  tenantId: z.string().uuid(),
  brandOverlay: z.object({
    enabled: z.boolean(),
    assetId: z.string().uuid().nullable(),
    placementPreset: z.enum(ICON_STUDIO_PLACEMENT_PRESET_KEYS).nullable(),
    finishKey: z.enum(ICON_STUDIO_BRAND_FINISH_KEYS),
  }),
  references: z.object({
    referenceAssetIds: z.array(z.string().uuid()).default([]),
    maxAssets: z.number().int().min(1).max(5),
  }),
  output: z.object({
    background: z.literal("transparent"),
    format: z.enum(ICON_STUDIO_OUTPUT_FORMATS),
    size: z.number().int().refine((value) => outputSizeValues.has(value), "Invalid Icon Studio output size"),
  }),
});

export function buildIconStudioPayload(input: IconStudioPayloadBuilderInput): IconStudioGenerationPayload {
  const availablePlacements = getIconStudioPlacementPresets(input.productKey, input.variantKey);
  const defaultPlacement = availablePlacements[0]?.key ?? null;
  const resolvedPlacement = input.brandOverlayEnabled
    ? input.placementPreset ?? defaultPlacement
    : null;

  if (input.brandOverlayEnabled && !input.brandAssetId) {
    throw new Error("Et brand-asset skal vælges, når brand overlay er aktiveret.");
  }

  if (resolvedPlacement) {
    const placementIsAllowed = availablePlacements.some((placement) => placement.key === resolvedPlacement);
    if (!placementIsAllowed) {
      throw new Error("Det valgte anker passer ikke til produkt og visning.");
    }
  }

  return IconStudioGenerationPayloadSchema.parse({
    productKey: input.productKey,
    styleKey: input.styleKey,
    variantKey: input.variantKey,
    tenantId: input.tenantId,
    brandOverlay: {
      enabled: input.brandOverlayEnabled,
      assetId: input.brandOverlayEnabled ? input.brandAssetId ?? null : null,
      placementPreset: resolvedPlacement,
      finishKey: input.finishKey,
    },
    references: {
      referenceAssetIds: input.referenceAssetIds ?? [],
      maxAssets: input.maxReferenceAssets ?? 5,
    },
    output: {
      background: "transparent",
      format: input.format,
      size: input.size,
    },
  });
}
