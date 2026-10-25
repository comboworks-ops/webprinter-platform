import { selectProductLibraryReference } from '../../../supabase/functions/_shared/iconStudioProductLibrary.ts';
import { getStudioCapabilities } from './connection';
import { attachStudioPreviewUrls } from './previewUrls';
import { selectStudioPackReference } from '../../../supabase/functions/_shared/iconStudioOnlinetryksager.ts';
import { sameStudioConnection, type StudioConnectionBinding } from '../../../supabase/functions/_shared/iconStudioConnection.ts';
import type { Json } from "@/integrations/supabase/types";
import { parseStudioPayload } from "../../../supabase/functions/_shared/iconStudioValidation.ts";
import { type StudioRecipe, type StudioCollection } from "../../../supabase/functions/_shared/iconStudioRecipe.ts";
import { supabase } from "@/integrations/supabase/client";

import { generateIconStudioDraftsViaEdge, resolveStudioProvider } from "./aiProviderClient";
import {
  mockIconStudioProvider,
  type IconStudioProviderDraft,
  type IconStudioProviderPreference,
  type IconStudioReferenceImageInput,
} from "./provider";
import { buildIconStudioPayload, type IconStudioBrandAssetRow, type IconStudioGenerationPayload, type IconStudioJobOutputRow, type IconStudioJobRow, type IconStudioJobWithOutputs, type IconStudioProductTarget, type IconStudioReferenceAssetRow } from "./types";
import type {
  IconStudioBrandFinishKey,
  IconStudioProductKey,
  IconStudioStyleKey,
  IconStudioVariantKey,
  IconStudioOutputFormat,
  IconStudioOutputSize,
} from "./catalog";

const ICON_STUDIO_BUCKET = "icon-studio";
const PRODUCT_IMAGE_BUCKET = "product-images";
const ICON_STUDIO_JOB_PAGE_SIZE = 300;

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "asset";
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

function attachPreviewUrls<T extends { storage_path: string }>(rows:T[]) {
  return attachStudioPreviewUrls(rows,async paths=>{
    const result=await supabase.storage.from(ICON_STUDIO_BUCKET).createSignedUrls(paths,3600);
    if(result.error)console.warn('[icon-studio] preview batch unavailable');
    return result;
  });
}

async function attachPreviewUrl<T extends {storage_path:string}>(row:T) { return (await attachPreviewUrls([row]))[0]; }

export async function listIconStudioReferenceAssets(tenantId: string) {
  const { data, error } = await supabase
    .from("icon_studio_reference_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return attachPreviewUrls((data as IconStudioReferenceAssetRow[] | null) || []);
}

export async function listIconStudioBrandAssets(tenantId: string) {
  const { data, error } = await supabase
    .from("icon_studio_brand_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return attachPreviewUrls((data as IconStudioBrandAssetRow[] | null) || []);
}

export async function listIconStudioJobs(tenantId: string): Promise<IconStudioJobWithOutputs[]> {
  const { data: jobsData, error: jobsError } = await supabase
    .from("icon_studio_jobs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(ICON_STUDIO_JOB_PAGE_SIZE);

  if (jobsError) throw jobsError;
  const jobs = (jobsData as unknown as IconStudioJobRow[] | null) || [];
  if (jobs.length === 0) return [];

  const { data: outputsData, error: outputsError } = await supabase
    .from("icon_studio_job_outputs")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("job_id", jobs.map((job) => job.id))
    .order("created_at", { ascending: false });

  if (outputsError) throw outputsError;

  const hydratedOutputs = await attachPreviewUrls((outputsData as IconStudioJobOutputRow[] | null) || []);
  const outputsByJob = new Map<string, IconStudioJobOutputRow[]>();

  hydratedOutputs.forEach((output) => {
    const current = outputsByJob.get(output.job_id) || [];
    current.push(output);
    outputsByJob.set(output.job_id, current);
  });

  return jobs.map((job) => ({
    ...job,
    outputs: outputsByJob.get(job.id) || [],
  }));
}

export async function listIconStudioProductTargets(tenantId: string): Promise<IconStudioProductTarget[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, category, image_url, is_published")
    .eq("tenant_id", tenantId)
    .order("name")
    .limit(250);

  if (error) throw error;

  return ((data as IconStudioProductTarget[] | null) || []).sort((left, right) => {
    const imageDifference = Number(Boolean(left.image_url)) - Number(Boolean(right.image_url));
    return imageDifference || left.name.localeCompare(right.name, "da");
  });
}

function getProductImageExtension(mimeType: string | null) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  return null;
}

export async function downloadIconStudioOutput(output: IconStudioJobOutputRow) {
  const blob = await downloadStorageBlob(output.storage_path);
  if (!blob) throw new Error("Billedfilen kunne ikke hentes.");

  const extension = getProductImageExtension(output.mime_type) || "svg";
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${sanitizeFileName(output.label || "produktbillede")}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function downloadIconStudioCollection(tenantId: string, name: string, jobs: IconStudioJobWithOutputs[]) {
  const outputs = jobs.map(job => job.outputs.find(output => output.id === job.approved_output_id && output.status === 'approved' && output.tenant_id === tenantId));
  if (!outputs.length || outputs.some(output => !output)) throw new Error('Godkend alle billeder, før du downloader samlingen.');
  const { zipSync, strToU8 } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  for (const [index, output] of outputs.entries()) {
    const blob = await downloadStorageBlob(output!.storage_path);
    if (!blob) throw new Error('Et billede kunne ikke hentes. Prøv igen.');
    const job = jobs[index];
    const filename = `${String(index + 1).padStart(2,'0')}-${job.product_key}-${job.payload.recipe?.viewId || job.variant_key}.${getProductImageExtension(output!.mime_type) || 'svg'}`;
    files[filename] = new Uint8Array(await blob.arrayBuffer());
  }
  files['opskrift.json'] = strToU8(JSON.stringify({ name, items:jobs.map(job=>({ product:job.product_key, recipe:job.payload.recipe, provider:job.provider_key, output:job.payload.output })) },null,2));
  const packed = zipSync(files,{level:0});
  const url = URL.createObjectURL(new Blob([packed as BlobPart],{type:'application/zip'}));
  try {
    const link = document.createElement('a');link.href=url;link.download=`${sanitizeFileName(name)}.zip`;document.body.appendChild(link);link.click();link.remove();
  } finally { URL.revokeObjectURL(url); }
}

export async function applyIconStudioOutputToProduct(params: {
  tenantId: string;
  output: IconStudioJobOutputRow;
  productId: string;
}) {
  if (params.output.tenant_id !== params.tenantId) {
    throw new Error("Kun et godkendt billede fra den aktuelle shop kan bruges.");
  }

  const { data: storedOutput, error: outputError } = await supabase
    .from("icon_studio_job_outputs")
    .select("storage_path, mime_type, status")
    .eq("id", params.output.id)
    .eq("job_id", params.output.job_id)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  if (outputError) throw outputError;
  if (!storedOutput || storedOutput.status !== "approved") {
    throw new Error("Billedet skal godkendes, før det kan bruges på et produkt.");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", params.productId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) throw new Error("Produktet findes ikke i den aktuelle shop.");

  const extension = getProductImageExtension(storedOutput.mime_type);
  if (!extension) {
    throw new Error("Produktbilleder skal være PNG, JPG eller WEBP. Generér et PNG-udkast først.");
  }

  const blob = await downloadStorageBlob(storedOutput.storage_path);
  if (!blob) throw new Error("Billedfilen kunne ikke hentes.");
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("Billedet er større end 5 MB og kan ikke bruges som produktbillede.");
  }

  const storagePath = `icon-studio-${params.tenantId}-${params.productId}-${params.output.id}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      contentType: storedOutput.mime_type || blob.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;
  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", params.productId)
    .eq("tenant_id", params.tenantId);

  if (updateError) {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([storagePath]);
    throw updateError;
  }

  return publicUrl;
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
  metadata?: Record<string, unknown>;
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

  const { data, error } = await supabase
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
      metadata: JSON.parse(JSON.stringify(params.metadata || {})) as Json,
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
    const { error: resetError } = await supabase
      .from("icon_studio_brand_assets")
      .update({ is_default: false })
      .eq("tenant_id", params.tenantId);

    if (resetError) throw resetError;
  }

  const { data, error } = await supabase
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

  const { error } = await supabase
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

  const { error } = await supabase
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
  const productAssets = assets.filter((asset) => asset.is_active && asset.product_key === payload.productKey && !asset.metadata?.productImageLibrary && !asset.metadata?.referencePackId);
  const styleBankAssets = productAssets.filter((asset) => asset.style_key === payload.styleKey);

  return styleBankAssets.length > 0 ? styleBankAssets : productAssets;
}

export function resolveBestMatchingReferenceAssets(params: {
  assets: IconStudioReferenceAssetRow[];
  payload: IconStudioGenerationPayload;
}) {
  const library = selectProductLibraryReference(params.assets, params.payload.tenantId, params.payload.productKey, params.payload.recipe);
  if (library) return [library];
  if (params.payload.recipe?.referencePackId) {
    const match = selectStudioPackReference(params.assets,params.payload.productKey,params.payload.recipe.productReferenceId);
    if (!match) throw new Error('Importér en produktreference fra Onlinetryksager-pakken til det valgte produkt først.');
    return [match];
  }
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

export interface CreateIconStudioJobInput {
  expectedConnection?: StudioConnectionBinding;
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
  recipe?: StudioRecipe;
  collection?: StudioCollection;
  sampleCount?: 1 | 3;
}

/** Persist the entire plan before starting any provider work. Existing jobs stay intact. */
export async function prepareIconStudioJobs(inputs: CreateIconStudioJobInput[]): Promise<IconStudioJobRow[]> {
  if (!inputs.length || inputs.length > 30 || inputs.some(p => p.tenantId !== inputs[0].tenantId)) throw new Error("Ugyldig billedsamling.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Log ind igen for at oprette billeder.");
  const {provider,connection} = await resolveStudioProvider(inputs[0].tenantId, inputs[0].providerPreference, inputs.some(p=>Boolean(p.recipe?.referencePackId)), inputs.some(p=>Boolean(p.recipe?.compositionVersion)));
  if (inputs.some(p => p.providerPreference !== inputs[0].providerPreference)) throw new Error("Samlingen skal bruge én billedmotor.");
  if (inputs.some(p => p.expectedConnection && !sameStudioConnection(p.expectedConnection,connection))) throw new Error("OpenAI-forbindelsen er ændret. Godkend en ny stilprøve før samlingen.");
  const rows = inputs.map(params => {
    const payload = buildIconStudioPayload({ ...params, placementPreset: params.placementPreset as never });
    if (connection) payload.connection = connection;
    const refs = resolveBestMatchingReferenceAssets({ assets: params.referenceAssets.filter(a => a.tenant_id === params.tenantId), payload });
    payload.references.referenceAssetIds = refs.map(a => a.id);
    if (payload.brandOverlay.enabled && !params.brandAssets.some(a => a.id === payload.brandOverlay.assetId && a.tenant_id === params.tenantId)) throw new Error("Logoet findes ikke i denne shop.");
    return {
      tenant_id: params.tenantId,
      job_name: params.collection?.name || `${params.productKey}-${params.styleKey}-${params.variantKey}`,
      product_key: params.productKey, style_key: params.styleKey, variant_key: params.variantKey,
      status: "draft", provider_key: provider,
      payload: JSON.parse(JSON.stringify(payload)) as Json, resolved_reference_asset_ids: refs.map(a => a.id),
      selected_brand_asset_id: payload.brandOverlay.assetId, created_by: authData.user.id,
    };
  });
  if (inputs.some(p => p.recipe?.libraryReferenceId) && (await getStudioCapabilities(inputs[0].tenantId)).productLibraryVersion !== 1) throw new Error("Billedmotoren skal opdateres, før biblioteksbilleder kan bruges. Ingen billedopgave er oprettet.");
  const { data, error } = await supabase.from("icon_studio_jobs").insert(rows).select("*");
  if (error || !data || data.length !== rows.length) throw error || new Error("Billedplanen kunne ikke gemmes.");
  return data as unknown as IconStudioJobRow[];
}

/** A queued item is claimed once. Interrupted processing is never blindly resumed. */
export async function runIconStudioJob(jobId: string, tenantId: string, references: IconStudioReferenceAssetRow[], brandAssets: IconStudioBrandAssetRow[]) {
  const { data, error } = await supabase.from("icon_studio_jobs").select("*").eq("tenant_id", tenantId).eq("id", jobId).single();
  if (error || !data) throw error || new Error("Billedopgaven findes ikke.");
  const job = data as unknown as IconStudioJobRow;
  if (job.status !== "draft") throw new Error("Opgaven er allerede startet. Opdater status før et nyt forsøg.");
  const payload = parseStudioPayload(job.payload, tenantId);
  const preference = job.provider_key as IconStudioProviderPreference;
  if (!["auto","mock","openai","gemini"].includes(preference)) throw new Error("Ukendt billedmotor.");
  let claimed = false;
  try {
    const matchingReferences = payload.references.referenceAssetIds.map(id => {
      const asset = references.find(a => a.id === id && a.tenant_id === tenantId);
      if (!asset) throw new Error("En gemt stilreference mangler. Opret en ny opgave med de aktuelle referencer.");
      return asset;
    });
    const brandAsset = brandAssets.find(a => a.id === payload.brandOverlay.assetId && a.tenant_id === tenantId) || null;
    const brandAssetDataUrl = brandAsset ? await getDataUrl(brandAsset.storage_path) : null;
    if (payload.brandOverlay.enabled && !brandAssetDataUrl) throw new Error("Det valgte logo kunne ikke hentes.");
    const referenceImages = await Promise.all(matchingReferences.map(a => getPreparedReferenceImage(a, 512)));
    if (referenceImages.some(image => !image)) throw new Error("En stilreference kunne ikke hentes.");
    const generationInput = { jobId, payload, brandAsset, brandAssetDataUrl, referenceAssets: matchingReferences, referenceImages: referenceImages as IconStudioReferenceImageInput[] };
    let providerKey: string;
    let drafts: IconStudioProviderDraft[];
    if (preference === "mock") {
      const claim = await supabase.from("icon_studio_jobs").update({status:"processing"}).eq("tenant_id",tenantId).eq("id",jobId).eq("status","draft").select("id").single();
      if (claim.error || !claim.data) throw new Error("En anden session har allerede startet opgaven.");
      claimed = true;
      providerKey = mockIconStudioProvider.key;
      drafts = await mockIconStudioProvider.generateDrafts(generationInput);
    } else {
      if (payload.output.format !== "png") throw new Error("Billedmotoren understøtter PNG. Vælg PNG og prøv igen.");
      // The Edge handler claims the persisted job before making a paid request.
      const result = await generateIconStudioDraftsViaEdge({ ...generationInput, providerPreference: preference });
      claimed = true;
      providerKey = result.providerKey;
      drafts = result.drafts;
    }
    // Store items individually: a later storage error must not erase earlier results.
    for (const draft of drafts) {
      const outputId = crypto.randomUUID();
      const storagePath = `tenant/${tenantId}/jobs/${jobId}/${outputId}.${draft.extension}`;
      const upload = await supabase.storage.from(ICON_STUDIO_BUCKET).upload(storagePath, draft.blob, { cacheControl:"3600", upsert:false, contentType:draft.contentType });
      if (upload.error) throw upload.error;
      const insert = await supabase.from("icon_studio_job_outputs").insert({ id:outputId, tenant_id:tenantId, job_id:jobId, label:draft.label, kind:"draft", status:"active", storage_path:storagePath, mime_type:draft.contentType, width_px:draft.width, height_px:draft.height, metadata:JSON.parse(JSON.stringify(draft.metadata)) as Json });
      if (insert.error) throw insert.error;
    }
    const saved = await supabase.from("icon_studio_jobs").update({ status:"ready_for_review", provider_key:providerKey, error_message:null }).eq("tenant_id",tenantId).eq("id",jobId).select("id").single();
    if (saved.error || !saved.data) throw saved.error || new Error("Resultatet kunne ikke afsluttes.");
    return jobId;
  } catch (error) {
    // An unknown Edge outcome stays processing. It may already have incurred cost.
    if (claimed) {
      await supabase.from("icon_studio_jobs").update({ status:"failed", error_message:error instanceof Error ? error.message : "Billedet kunne ikke oprettes." }).eq("tenant_id",tenantId).eq("id",jobId);
    }
    throw error;
  }
}

export async function createIconStudioJob(params: CreateIconStudioJobInput) {
  const [job] = await prepareIconStudioJobs([params]);
  return runIconStudioJob(job.id, params.tenantId, params.referenceAssets, params.brandAssets);
}

export async function retryIconStudioJob(job: IconStudioJobWithOutputs, newDraft = false) {
  const expectedStatus = newDraft ? "ready_for_review" : "failed";
  if (job.status !== expectedStatus || (newDraft ? !job.outputs.length : Boolean(job.outputs.length))) throw new Error(newDraft ? "Kun udkast til gennemsyn kan få et nyt forslag." : "Kun fejlede opgaver uden gemte billeder kan forsøges igen.");
  const original = await supabase.from("icon_studio_jobs").select("*").eq("id",job.id).eq("tenant_id",job.tenant_id).eq("status",expectedStatus).single();
  if (original.error || !original.data) throw new Error("Opdater opgaven før et nyt forsøg.");
  const existing = await supabase.from("icon_studio_job_outputs").select("id").eq("job_id",job.id).eq("tenant_id",job.tenant_id).limit(1);
  if (existing.error || (newDraft ? !existing.data?.length : Boolean(existing.data?.length))) throw new Error("Billedopgavens status er ændret. Opdater før et nyt forsøg.");
  const payload = parseStudioPayload(original.data.payload, job.tenant_id);
  const {data: auth,error: authError} = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Log ind igen for at prøve igen.");
  const previousProvider = original.data.provider_key;
  const provider = previousProvider === 'openai-image-v1' ? 'openai' : previousProvider === 'gemini-image-v1' ? 'gemini' : previousProvider === 'mock-icon-studio-v1' ? 'mock' : previousProvider;
  if (!["openai","gemini","mock"].includes(provider)) throw new Error("Vælg en billedmotor og opret en ny opgave.");
  const result = await supabase.from("icon_studio_jobs").insert({ tenant_id:job.tenant_id, job_name:original.data.job_name, product_key:payload.productKey, style_key:payload.styleKey, variant_key:payload.variantKey, status:"draft", provider_key:provider, payload:JSON.parse(JSON.stringify(payload)) as Json, resolved_reference_asset_ids:payload.references.referenceAssetIds, selected_brand_asset_id:payload.brandOverlay.assetId, created_by:auth.user.id }).select("*").single();
  if (result.error || !result.data) throw result.error || new Error("Nyt forsøg kunne ikke gemmes.");
  return result.data as unknown as IconStudioJobRow;
}

export async function approveIconStudioOutput(params: {
  tenantId: string;
  jobId: string;
  outputId: string;
}) {
  const archiveResult = await supabase
    .from("icon_studio_job_outputs")
    .update({ status: "archived" })
    .eq("tenant_id", params.tenantId)
    .eq("job_id", params.jobId)
    .neq("id", params.outputId);

  if (archiveResult.error) throw archiveResult.error;

  const approveResult = await supabase
    .from("icon_studio_job_outputs")
    .update({
      kind: "final",
      status: "approved",
    })
    .eq("tenant_id", params.tenantId)
    .eq("job_id", params.jobId)
    .eq("id", params.outputId);

  if (approveResult.error) throw approveResult.error;

  const jobResult = await supabase
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
