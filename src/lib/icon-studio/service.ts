import { supabase } from "@/integrations/supabase/client";

import { generateIconStudioDraftsViaEdge } from "./aiProviderClient";
import {
  mockIconStudioProvider,
  type IconStudioProviderDraft,
  type IconStudioProviderPreference,
  type IconStudioReferenceImageInput,
} from "./provider";
import { buildIconStudioPayload, type IconStudioBrandAssetRow, type IconStudioGenerationPayload, type IconStudioJobOutputRow, type IconStudioJobRow, type IconStudioJobWithOutputs, type IconStudioReferenceAssetRow } from "./types";
import type {
  IconStudioBrandFinishKey,
  IconStudioProductKey,
  IconStudioStyleKey,
  IconStudioVariantKey,
  IconStudioOutputFormat,
  IconStudioOutputSize,
} from "./catalog";

const ICON_STUDIO_BUCKET = "icon-studio";

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "asset";
}

async function getSignedUrl(storagePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.warn("[icon-studio] failed to create signed URL", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function downloadStorageBlob(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .download(storagePath);

  if (error || !data) {
    console.warn("[icon-studio] failed to download object", error);
    return null;
  }

  return data;
}

async function getDataUrl(storagePath: string) {
  const blob = await downloadStorageBlob(storagePath);
  if (!blob) return null;
  return blobToDataUrl(blob);
}

async function loadBlobIntoImage(blob: Blob) {
  if (typeof document === "undefined") {
    return null;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeReferenceBlobToPngDataUrl(blob: Blob, size = 512) {
  const image = await loadBlobIntoImage(blob);
  if (!image || typeof document === "undefined") {
    return blobToDataUrl(blob);
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return blobToDataUrl(blob);
  }

  context.clearRect(0, 0, size, size);
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const drawWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const drawHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const offsetX = Math.round((size - drawWidth) / 2);
  const offsetY = Math.round((size - drawHeight) / 2);

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}

async function getPreparedReferenceImage(asset: IconStudioReferenceAssetRow, size = 512): Promise<IconStudioReferenceImageInput | null> {
  const blob = await downloadStorageBlob(asset.storage_path);
  if (!blob) return null;

  const dataUrl = await normalizeReferenceBlobToPngDataUrl(blob, size);
  if (!dataUrl) return null;

  return {
    id: asset.id,
    name: asset.name,
    mimeType: "image/png",
    dataUrl,
  };
}

async function attachPreviewUrl<T extends { storage_path: string }>(row: T): Promise<T & { preview_url: string | null }> {
  const previewUrl = await getSignedUrl(row.storage_path);
  return {
    ...row,
    preview_url: previewUrl,
  };
}

export async function listIconStudioReferenceAssets(tenantId: string) {
  const { data, error } = await (supabase as any)
    .from("icon_studio_reference_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(((data as IconStudioReferenceAssetRow[] | null) || []).map(attachPreviewUrl));
}

export async function listIconStudioBrandAssets(tenantId: string) {
  const { data, error } = await (supabase as any)
    .from("icon_studio_brand_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(((data as IconStudioBrandAssetRow[] | null) || []).map(attachPreviewUrl));
}

export async function listIconStudioJobs(tenantId: string): Promise<IconStudioJobWithOutputs[]> {
  const [{ data: jobsData, error: jobsError }, { data: outputsData, error: outputsError }] = await Promise.all([
    (supabase as any)
      .from("icon_studio_jobs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("icon_studio_job_outputs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (jobsError) throw jobsError;
  if (outputsError) throw outputsError;

  const hydratedOutputs = await Promise.all(((outputsData as IconStudioJobOutputRow[] | null) || []).map(attachPreviewUrl));
  const outputsByJob = new Map<string, IconStudioJobOutputRow[]>();

  hydratedOutputs.forEach((output) => {
    const current = outputsByJob.get(output.job_id) || [];
    current.push(output);
    outputsByJob.set(output.job_id, current);
  });

  return ((jobsData as IconStudioJobRow[] | null) || []).map((job) => ({
    ...job,
    outputs: outputsByJob.get(job.id) || [],
  }));
}

export async function uploadIconStudioReferenceAsset(params: {
  tenantId: string;
  file: File;
  name: string;
  productKey: IconStudioProductKey;
  styleKey?: IconStudioStyleKey | null;
  variantKey?: IconStudioVariantKey | null;
  finishKey?: IconStudioBrandFinishKey | null;
  usageTags: string[];
  priority: number;
  isActive: boolean;
}) {
  const assetId = crypto.randomUUID();
  const safeName = sanitizeFileName(params.file.name);
  const storagePath = `tenant/${params.tenantId}/references/${params.styleKey ?? "shared"}/${params.productKey}/${assetId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any)
    .from("icon_studio_reference_assets")
    .insert({
      id: assetId,
      tenant_id: params.tenantId,
      name: params.name,
      product_key: params.productKey,
      style_key: params.styleKey ?? null,
      variant_key: params.variantKey ?? null,
      finish_key: params.finishKey ?? null,
      usage_tags: params.usageTags,
      priority: params.priority,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      is_active: params.isActive,
    })
    .select("*")
    .single();

  if (error) throw error;
  return attachPreviewUrl(data as IconStudioReferenceAssetRow);
}

export async function uploadIconStudioBrandAsset(params: {
  tenantId: string;
  file: File;
  name: string;
  assetRole: "logo" | "symbol" | "seal" | "mark";
  isDefault: boolean;
}) {
  const assetId = crypto.randomUUID();
  const safeName = sanitizeFileName(params.file.name);
  const storagePath = `tenant/${params.tenantId}/brand/${assetId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) throw uploadError;

  if (params.isDefault) {
    const { error: resetError } = await (supabase as any)
      .from("icon_studio_brand_assets")
      .update({ is_default: false })
      .eq("tenant_id", params.tenantId);

    if (resetError) throw resetError;
  }

  const { data, error } = await (supabase as any)
    .from("icon_studio_brand_assets")
    .insert({
      id: assetId,
      tenant_id: params.tenantId,
      name: params.name,
      asset_role: params.assetRole,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      is_default: params.isDefault,
    })
    .select("*")
    .single();

  if (error) throw error;
  return attachPreviewUrl(data as IconStudioBrandAssetRow);
}

export async function deleteIconStudioReferenceAsset(asset: Pick<IconStudioReferenceAssetRow, "id" | "storage_path">) {
  const { error: removeError } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .remove([asset.storage_path]);

  if (removeError) throw removeError;

  const { error } = await (supabase as any)
    .from("icon_studio_reference_assets")
    .delete()
    .eq("id", asset.id);

  if (error) throw error;
}

export async function deleteIconStudioBrandAsset(asset: Pick<IconStudioBrandAssetRow, "id" | "storage_path">) {
  const { error: removeError } = await supabase.storage
    .from(ICON_STUDIO_BUCKET)
    .remove([asset.storage_path]);

  if (removeError) throw removeError;

  const { error } = await (supabase as any)
    .from("icon_studio_brand_assets")
    .delete()
    .eq("id", asset.id);

  if (error) throw error;
}

function getReferenceScore(asset: IconStudioReferenceAssetRow, payload: IconStudioGenerationPayload) {
  if (!asset.is_active) return Number.NEGATIVE_INFINITY;
  if (asset.product_key !== payload.productKey) return Number.NEGATIVE_INFINITY;

  let score = asset.priority * 100;

  if (!asset.style_key) score += 10;
  else if (asset.style_key === payload.styleKey) score += 40;
  else score -= 20;

  if (!asset.variant_key) score += 8;
  else if (asset.variant_key === payload.variantKey) score += 24;
  else score -= 12;

  if (!asset.finish_key) score += 4;
  else if (asset.finish_key === payload.brandOverlay.finishKey) score += 12;
  else score -= 6;

  return score;
}

function getReferenceCandidatePool(assets: IconStudioReferenceAssetRow[], payload: IconStudioGenerationPayload) {
  const productAssets = assets.filter((asset) => asset.is_active && asset.product_key === payload.productKey);
  const styleBankAssets = productAssets.filter((asset) => asset.style_key === payload.styleKey);

  return styleBankAssets.length > 0 ? styleBankAssets : productAssets;
}

export function resolveBestMatchingReferenceAssets(params: {
  assets: IconStudioReferenceAssetRow[];
  payload: IconStudioGenerationPayload;
}) {
  return getReferenceCandidatePool(params.assets, params.payload)
    .map((asset) => ({
      asset,
      score: getReferenceScore(asset, params.payload),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score || right.asset.priority - left.asset.priority)
    .map((entry) => entry.asset)
    .slice(0, params.payload.references.maxAssets);
}

export async function createIconStudioJob(params: {
  tenantId: string;
  productKey: IconStudioProductKey;
  styleKey: IconStudioStyleKey;
  variantKey: IconStudioVariantKey;
  providerPreference: IconStudioProviderPreference;
  brandOverlayEnabled: boolean;
  brandAssetId?: string | null;
  placementPreset?: string | null;
  finishKey: IconStudioBrandFinishKey;
  format: IconStudioOutputFormat;
  size: IconStudioOutputSize;
  referenceAssets: IconStudioReferenceAssetRow[];
  brandAssets: IconStudioBrandAssetRow[];
}) {
  const payload = buildIconStudioPayload({
    tenantId: params.tenantId,
    productKey: params.productKey,
    styleKey: params.styleKey,
    variantKey: params.variantKey,
    brandOverlayEnabled: params.brandOverlayEnabled,
    brandAssetId: params.brandAssetId ?? null,
    placementPreset: params.placementPreset as any,
    finishKey: params.finishKey,
    format: params.format,
    size: params.size,
  });

  const matchingReferences = resolveBestMatchingReferenceAssets({
    assets: params.referenceAssets,
    payload,
  });

  const brandAsset = payload.brandOverlay.assetId
    ? params.brandAssets.find((asset) => asset.id === payload.brandOverlay.assetId) || null
    : null;

  const { data: authData } = await supabase.auth.getUser();
  const createdBy = authData.user?.id || null;

  const { data: createdJob, error: createError } = await (supabase as any)
    .from("icon_studio_jobs")
    .insert({
      tenant_id: params.tenantId,
      job_name: `${params.productKey}-${params.styleKey}-${params.variantKey}`,
      product_key: params.productKey,
      style_key: params.styleKey,
      variant_key: params.variantKey,
      status: "processing",
      provider_key: params.providerPreference === "auto"
        ? "auto"
        : params.providerPreference === "mock"
          ? mockIconStudioProvider.key
          : `${params.providerPreference}-requested`,
      payload,
      resolved_reference_asset_ids: matchingReferences.map((asset) => asset.id),
      selected_brand_asset_id: payload.brandOverlay.assetId,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (createError) throw createError;

  const job = createdJob as IconStudioJobRow;

  try {
    const brandAssetDataUrl = brandAsset?.storage_path
      ? await getDataUrl(brandAsset.storage_path)
      : null;
    const referenceImages = (
      await Promise.all(
        matchingReferences.map((asset) =>
          getPreparedReferenceImage(asset, Math.min(payload.output.size, 512)),
        ),
      )
    ).filter((entry): entry is IconStudioReferenceImageInput => Boolean(entry));

    if (params.providerPreference !== "mock" && payload.output.format === "svg") {
      throw new Error("SVG output understøttes kun af Mock provider i V1. Vælg PNG for OpenAI eller Gemini.");
    }

    const generationInput = {
      payload,
      brandAsset,
      brandAssetDataUrl,
      referenceAssets: matchingReferences,
      referenceImages,
    };

    let providerKey = mockIconStudioProvider.key;
    let drafts: IconStudioProviderDraft[];

    if (params.providerPreference === "mock") {
      drafts = await mockIconStudioProvider.generateDrafts(generationInput);
    } else {
      try {
        const edgeResult = await generateIconStudioDraftsViaEdge({
          ...generationInput,
          providerPreference: params.providerPreference,
        });
        providerKey = edgeResult.providerKey;
        drafts = edgeResult.drafts;
      } catch (error: any) {
        if (params.providerPreference !== "auto") {
          throw error;
        }

        providerKey = mockIconStudioProvider.key;
        drafts = await mockIconStudioProvider.generateDrafts(generationInput);
      }
    }

    const outputRows = await Promise.all(
      drafts.map(async (draft) => {
        const outputId = crypto.randomUUID();
        const storagePath = `tenant/${params.tenantId}/jobs/${job.id}/${outputId}.${draft.extension}`;

        const { error: uploadError } = await supabase.storage
          .from(ICON_STUDIO_BUCKET)
          .upload(storagePath, draft.blob, {
            cacheControl: "3600",
            upsert: false,
            contentType: draft.contentType,
          });

        if (uploadError) throw uploadError;

        return {
          id: outputId,
          tenant_id: params.tenantId,
          job_id: job.id,
          label: draft.label,
          kind: "draft",
          status: "active",
          storage_path: storagePath,
          mime_type: draft.contentType,
          width_px: draft.width,
          height_px: draft.height,
          metadata: draft.metadata,
        };
      }),
    );

    const { error: outputInsertError } = await (supabase as any)
      .from("icon_studio_job_outputs")
      .insert(outputRows);

    if (outputInsertError) throw outputInsertError;

    const { error: jobUpdateError } = await (supabase as any)
      .from("icon_studio_jobs")
      .update({
        status: "ready_for_review",
        provider_key: providerKey,
        resolved_reference_asset_ids: matchingReferences.map((asset) => asset.id),
        error_message: null,
      })
      .eq("id", job.id);

    if (jobUpdateError) throw jobUpdateError;

    return job.id;
  } catch (error: any) {
    await (supabase as any)
      .from("icon_studio_jobs")
      .update({
        status: "failed",
        error_message: error?.message || "Mock generation failed.",
      })
      .eq("id", job.id);

    throw error;
  }
}

export async function approveIconStudioOutput(params: {
  tenantId: string;
  jobId: string;
  outputId: string;
}) {
  const archiveResult = await (supabase as any)
    .from("icon_studio_job_outputs")
    .update({ status: "archived" })
    .eq("tenant_id", params.tenantId)
    .eq("job_id", params.jobId)
    .neq("id", params.outputId);

  if (archiveResult.error) throw archiveResult.error;

  const approveResult = await (supabase as any)
    .from("icon_studio_job_outputs")
    .update({
      kind: "final",
      status: "approved",
    })
    .eq("tenant_id", params.tenantId)
    .eq("job_id", params.jobId)
    .eq("id", params.outputId);

  if (approveResult.error) throw approveResult.error;

  const jobResult = await (supabase as any)
    .from("icon_studio_jobs")
    .update({
      status: "approved",
      approved_output_id: params.outputId,
      error_message: null,
    })
    .eq("tenant_id", params.tenantId)
    .eq("id", params.jobId);

  if (jobResult.error) throw jobResult.error;
}
