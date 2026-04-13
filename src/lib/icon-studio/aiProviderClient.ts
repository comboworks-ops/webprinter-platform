import { supabase } from "@/integrations/supabase/client";

import {
  applyBrandOverlayToRasterBlob,
  removeUniformBackgroundFromRasterBlob,
  type IconStudioGenerateDraftsInput,
  type IconStudioProviderDraft,
  type IconStudioProviderPreference,
  type IconStudioResolvedProviderKey,
} from "./provider";

type IconStudioEdgeDraft = {
  label: string;
  extension: "png";
  contentType: string;
  base64Data: string;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
};

type IconStudioEdgeSuccessResponse = {
  success: true;
  providerKey: IconStudioResolvedProviderKey;
  drafts: IconStudioEdgeDraft[];
};

type IconStudioEdgeErrorResponse = {
  success: false;
  error: string;
};

function base64ToBlob(base64Data: string, contentType: string) {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function mapReferenceAssets(input: IconStudioGenerateDraftsInput["referenceAssets"]) {
  return input.map((asset) => ({
    id: asset.id,
    name: asset.name,
    productKey: asset.product_key,
    styleKey: asset.style_key,
    variantKey: asset.variant_key,
    finishKey: asset.finish_key,
    usageTags: asset.usage_tags.slice(0, 6),
    priority: asset.priority,
  }));
}

function mapReferenceImages(input: IconStudioGenerateDraftsInput["referenceImages"]) {
  return input.map((asset) => ({
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    dataUrl: asset.dataUrl,
  }));
}

export async function generateIconStudioDraftsViaEdge(input: IconStudioGenerateDraftsInput & {
  providerPreference: IconStudioProviderPreference;
}) {
  const { data, error } = await supabase.functions.invoke("icon-studio-generate", {
    body: {
      tenantId: input.payload.tenantId,
      providerPreference: input.providerPreference,
      payload: input.payload,
      brandAsset: input.brandAsset
        ? {
            id: input.brandAsset.id,
            name: input.brandAsset.name,
            assetRole: input.brandAsset.asset_role,
          }
        : null,
      referenceAssets: mapReferenceAssets(input.referenceAssets),
      referenceImages: mapReferenceImages(input.referenceImages),
    },
  });

  if (error) {
    throw new Error(error.message || "Icon Studio provider request failed.");
  }

  const response = data as IconStudioEdgeSuccessResponse | IconStudioEdgeErrorResponse | null;
  if (!response || response.success !== true) {
    throw new Error(response?.error || "Icon Studio provider request failed.");
  }

  const drafts = await Promise.all(
    response.drafts.map(async (draft): Promise<IconStudioProviderDraft> => {
      let blob = base64ToBlob(draft.base64Data, draft.contentType);

      if (response.providerKey === "gemini-image-v1") {
        blob = await removeUniformBackgroundFromRasterBlob({
          blob,
          outputSize: input.payload.output.size,
        });
      }

      if (input.payload.brandOverlay.enabled && input.brandAssetDataUrl) {
        blob = await applyBrandOverlayToRasterBlob({
          blob,
          payload: input.payload,
          brandAssetDataUrl: input.brandAssetDataUrl,
        });
      }

      return {
        label: draft.label,
        extension: "png",
        contentType: "image/png",
        blob,
        width: input.payload.output.size,
        height: input.payload.output.size,
        metadata: {
          ...draft.metadata,
          requestedOutputSize: input.payload.output.size,
          providerKey: response.providerKey,
          transparencyMode: response.providerKey === "gemini-image-v1" ? "cutout" : "native",
          brandOverlayApplied: input.payload.brandOverlay.enabled && Boolean(input.brandAssetDataUrl),
          referenceImageCount: input.referenceImages.length,
        },
      };
    }),
  );

  return {
    providerKey: response.providerKey,
    drafts,
  };
}
