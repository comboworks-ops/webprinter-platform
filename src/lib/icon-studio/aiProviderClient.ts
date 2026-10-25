import { getStudioCapabilities, invokeStudio } from './connection';
import { finishStudioRaster, finishStudioGraphic, removeStudioChromaBackdrop } from "./raster";
import { needsGraphicFinish } from './graphicRaster';

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
  jobId?: string;
}) {
  if (input.payload.recipe?.libraryReferenceId && (await getStudioCapabilities(input.payload.tenantId)).productLibraryVersion !== 1) throw new Error("Billedmotoren skal opdateres til biblioteksreferencer før generering.");
  const data = await invokeStudio<IconStudioEdgeSuccessResponse>({
      tenantId: input.payload.tenantId,
      jobId: input.jobId,
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
  });

  const response = data as IconStudioEdgeSuccessResponse | IconStudioEdgeErrorResponse | null;
  if (!response || response.success !== true) {
    throw new Error((response && "error" in response ? response.error : null) || "Icon Studio provider request failed.");
  }

  if (!Array.isArray(response.drafts) || response.drafts.length !== (input.payload.sampleCount || 3)
      || !['openai-image-v1','gemini-image-v1'].includes(response.providerKey)
      || response.drafts.some(draft => draft.contentType !== 'image/png' || !draft.base64Data)) {
    throw new Error('Billedmotoren returnerede ikke det forventede antal PNG-billeder. Opdater opgavens status.');
  }

  if (input.payload.recipe && response.drafts.some(d => d.metadata?.promptProfile !== "icon-studio-controlled-v2")) throw new Error("Billedmotoren skal opdateres til de nye stile.");
  const drafts = await Promise.all(
    response.drafts.map(async (draft): Promise<IconStudioProviderDraft> => {
      let blob = base64ToBlob(draft.base64Data, draft.contentType);
      const native = await finishStudioRaster(blob, input.payload.output.size);
      blob = native.blob;

      if (typeof draft.metadata.chromaBackdrop === 'string') {
        blob = await removeStudioChromaBackdrop(blob,input.payload.output.size,draft.metadata.chromaBackdrop);
      } else if (response.providerKey === "gemini-image-v1") {
        blob = await removeUniformBackgroundFromRasterBlob({
          blob,
          outputSize: input.payload.output.size,
        });
      }

      blob = await finishStudioGraphic(blob,input.payload.output.size,input.payload.recipe);
      if (input.payload.brandOverlay.enabled && input.brandAssetDataUrl) {
        blob = await applyBrandOverlayToRasterBlob({
          blob,
          payload: input.payload,
          brandAssetDataUrl: input.brandAssetDataUrl,
        });
      }

      if (input.payload.recipe?.treatmentId === "breakout") blob = (await finishStudioRaster(blob,input.payload.output.size,input.payload.recipe.palette[1])).blob;
      return {
        label: draft.label,
        extension: "png",
        contentType: "image/png",
        blob,
        width: input.payload.output.size,
        height: input.payload.output.size,
        metadata: {
          ...draft.metadata,
          nativeWidth: native.nativeWidth,
          nativeHeight: native.nativeHeight,
          requestedOutputSize: input.payload.output.size,
          providerKey: response.providerKey,
          transparencyMode: draft.metadata.chromaBackdrop ? 'chroma-cutout' : response.providerKey === "gemini-image-v1" ? "cutout" : "native",
          brandOverlayApplied: input.payload.brandOverlay.enabled && Boolean(input.brandAssetDataUrl),
          graphicFinishVersion: needsGraphicFinish(input.payload.recipe) ? 1 : null,
          // The server count includes the approved collection anchor it adds.
          libraryReferenceImageCount: input.referenceImages.length,
        },
      };
    }),
  );

  return {
    providerKey: response.providerKey,
    drafts,
  };
}

export async function resolveStudioProvider(tenantId: string, preference: IconStudioProviderPreference, requireReferencePack = false, requireFolderGuide = false) {
  if (preference === 'mock') return {provider:'mock' as const,connection:undefined};
  const data = await getStudioCapabilities(tenantId);
  if (requireReferencePack && data.referencePackVersion !== 1) throw new Error("Billedmotoren skal opdateres, før referencepakken kan bruges.");
  if (requireFolderGuide && data.folderGuideVersion !== 2) throw new Error('Billedmotoren skal opdateres, før de nye mappevisninger kan bruges.');
  const resolved = preference === 'auto' ? data.providers[0] : preference;
  if (!resolved || !data.providers.includes(resolved)) throw new Error('Den valgte billedmotor er ikke tilsluttet.');
  return {provider:resolved,connection:resolved === 'openai' ? {source:data.connection.connected ? 'tenant' as const : 'platform' as const,version:data.connection.version} : undefined};
}
