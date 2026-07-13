import type { SupabaseClient } from "@supabase/supabase-js";

import type { CompanyAsset } from "./types";
import type { CompanyWorkspaceScope } from "./workspaceRepository";

export const COMPANY_HUB_ASSET_BUCKET = "company-hub-assets";
export const COMPANY_HUB_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/postscript",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "ai", "eps", "ps", "jpg", "jpeg", "png", "webp", "svg"]);

export interface CompanyAssetUploadInput {
  file: File;
  name?: string | null;
  officeId?: string | null;
  assetType?: CompanyAsset["asset_type"];
}

function database(client: Pick<SupabaseClient, "from">) {
  return client as any;
}

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} skal udfyldes.`);
  return normalized;
}

export function sanitizeCompanyAssetFileName(fileName: string): string {
  const normalized = required(fileName, "Filnavn")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "fil";
}

export function validateCompanyAssetFile(file: Pick<File, "name" | "type" | "size">): void {
  if (!file.name) throw new Error("Vælg en fil.");
  if (file.size <= 0) throw new Error("Filen er tom.");
  if (file.size > COMPANY_HUB_ASSET_MAX_BYTES) throw new Error("Filen må højst fylde 25 MB.");
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("da-DK") || "";
  if (!ALLOWED_MIME_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Brug PDF, AI, EPS, SVG, JPG, PNG eller WebP.");
  }
}

export async function listCompanyAssets(
  client: Pick<SupabaseClient, "from">,
  companyId: string,
  options: { officeId?: string | null; includeArchived?: boolean } = {},
): Promise<CompanyAsset[]> {
  let query = database(client)
    .from("company_assets")
    .select("*")
    .eq("company_id", required(companyId, "Firma"))
    .order("created_at", { ascending: false });
  if (!options.includeArchived) query = query.eq("status", "active");
  if (options.officeId) query = query.or(`office_id.is.null,office_id.eq.${options.officeId}`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function uploadCompanyAsset(
  client: SupabaseClient,
  scope: CompanyWorkspaceScope,
  input: CompanyAssetUploadInput,
): Promise<CompanyAsset> {
  required(scope.tenantId, "Tenant");
  required(scope.companyId, "Firma");
  validateCompanyAssetFile(input.file);

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Du skal være logget ind for at uploade.");

  const safeName = sanitizeCompanyAssetFileName(input.file.name);
  const officeSegment = input.officeId || "shared";
  const storagePath = `${scope.tenantId}/${scope.companyId}/${officeSegment}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage
    .from(COMPANY_HUB_ASSET_BUCKET)
    .upload(storagePath, input.file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await database(client)
    .from("company_assets")
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      office_id: input.officeId || null,
      asset_type: input.assetType || (input.file.type === "application/pdf" ? "source_pdf" : "image"),
      name: String(input.name || input.file.name).trim(),
      storage_path: storagePath,
      mime_type: input.file.type || "application/octet-stream",
      file_size_bytes: input.file.size,
      metadata: { original_file_name: input.file.name },
      status: "active",
      uploaded_by: authData.user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    await client.storage.from(COMPANY_HUB_ASSET_BUCKET).remove([storagePath]);
    throw error || new Error("Filen blev uploadet, men kunne ikke registreres.");
  }
  return data;
}

export async function createCompanyAssetSignedUrl(client: SupabaseClient, storagePath: string): Promise<string> {
  const { data, error } = await client.storage
    .from(COMPANY_HUB_ASSET_BUCKET)
    .createSignedUrl(required(storagePath, "Fil"), 15 * 60);
  if (error || !data?.signedUrl) throw error || new Error("Filen kunne ikke åbnes.");
  return data.signedUrl;
}

export async function archiveCompanyAsset(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  assetId: string,
): Promise<CompanyAsset> {
  const { data, error } = await database(client)
    .from("company_assets")
    .update({ status: "archived" })
    .eq("id", required(assetId, "Fil"))
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Filen kunne ikke arkiveres.");
  return data;
}
