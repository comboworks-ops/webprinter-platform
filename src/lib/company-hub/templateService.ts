import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyJson,
  CompanyTemplateBinding,
  CompanyTemplateField,
} from "./types";
import type { CompanyWorkspaceScope } from "./workspaceRepository";

export type CompanyTemplateSourceKind = "design" | "template";

export interface CompanyTemplateCandidate {
  id: string;
  kind: CompanyTemplateSourceKind;
  name: string;
  description: string | null;
  previewUrl: string | null;
  editorJson: CompanyJson | null;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeAreaMm: number;
  dpi: number;
  colorProfile: string;
  productId: string | null;
  templateId: string | null;
}

export interface ControlledFieldCandidate {
  fabricObjectId: string;
  objectType: string;
  currentValue: string;
  suggestedLabel: string;
}

export interface CreateControlledFieldInput {
  fabricObjectId: string;
  fieldKey: string;
  label: string;
  fieldType: CompanyTemplateField["field_type"];
  isRequired?: boolean;
  defaultSource?: string | null;
  defaultValue?: unknown;
  maxLength?: number | null;
  allowedValues?: unknown[];
}

export interface CreateCompanyTemplateBindingInput {
  itemId: string;
  sourceKind: CompanyTemplateSourceKind;
  sourceId: string;
  name: string;
  previewUrl?: string | null;
  outputMode?: CompanyTemplateBinding["output_mode"];
  status?: CompanyTemplateBinding["status"];
  approvedBy?: string | null;
  fields: CreateControlledFieldInput[];
}

export interface CompanyTemplateBindingWithFields extends CompanyTemplateBinding {
  fields: CompanyTemplateField[];
  item_title?: string;
  product_id?: string | null;
}

interface FabricObjectLike extends Record<string, unknown> {
  type?: string;
  text?: string;
  __layerId?: string;
  objects?: FabricObjectLike[];
}

function database(client: Pick<SupabaseClient, "from">) {
  return client as any;
}

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} skal udfyldes.`);
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function editorObjects(editorJson: CompanyJson | null | undefined): FabricObjectLike[] {
  const objects = editorJson?.objects;
  return Array.isArray(objects) ? objects as FabricObjectLike[] : [];
}

function walkObjects(objects: FabricObjectLike[], visitor: (object: FabricObjectLike) => void): void {
  for (const object of objects) {
    visitor(object);
    if (Array.isArray(object.objects)) walkObjects(object.objects, visitor);
  }
}

function slugify(value: string): string {
  return required(value, "Feltnavn")
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function extractControlledFieldCandidates(
  editorJson: CompanyJson | null | undefined,
): ControlledFieldCandidate[] {
  const candidates: ControlledFieldCandidate[] = [];
  walkObjects(editorObjects(editorJson), (object) => {
    const type = String(object.type || "");
    const isText = type === "text" || type === "i-text" || type === "textbox";
    if (!isText || !object.__layerId) return;
    const value = String(object.text || "").trim();
    candidates.push({
      fabricObjectId: object.__layerId,
      objectType: type,
      currentValue: value,
      suggestedLabel: value.slice(0, 50) || "Tekstfelt",
    });
  });
  return candidates;
}

function validateFieldValue(field: CompanyTemplateField, rawValue: unknown): string {
  const value = String(rawValue ?? "").trim();
  if (field.is_required && !value) throw new Error(`${field.label} skal udfyldes.`);
  if (field.max_length && value.length > field.max_length) {
    throw new Error(`${field.label} må højst indeholde ${field.max_length} tegn.`);
  }
  if (value && field.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${field.label} skal være en gyldig e-mailadresse.`);
  }
  if (value && field.field_type === "url") {
    try {
      new URL(value);
    } catch {
      throw new Error(`${field.label} skal være en gyldig webadresse.`);
    }
  }
  if (field.allowed_values.length && !field.allowed_values.map(String).includes(value)) {
    throw new Error(`${field.label} indeholder en værdi, der ikke er godkendt.`);
  }
  return value;
}

export function applyControlledTemplateValues(
  editorJson: CompanyJson,
  fields: CompanyTemplateField[],
  values: CompanyJson,
): CompanyJson {
  const cloned = JSON.parse(JSON.stringify(editorJson)) as CompanyJson;
  const byObjectId = new Map(fields.map((field) => [field.fabric_object_id, field]));
  const found = new Set<string>();

  walkObjects(editorObjects(cloned), (object) => {
    object.selectable = false;
    object.evented = false;
    object.lockMovementX = true;
    object.lockMovementY = true;
    object.lockScalingX = true;
    object.lockScalingY = true;
    object.lockRotation = true;
    object.hasControls = false;

    const objectId = String(object.__layerId || "");
    const field = byObjectId.get(objectId);
    if (!field) return;
    found.add(objectId);
    const rawValue = values[field.field_key] ?? field.default_value ?? "";
    const value = validateFieldValue(field, rawValue);
    if (["text", "textarea", "email", "phone", "url", "select"].includes(field.field_type)) {
      object.text = value;
    }
  });

  for (const field of fields) {
    if (!found.has(field.fabric_object_id)) {
      throw new Error(`Feltet ${field.label} findes ikke længere i den godkendte skabelon.`);
    }
  }
  return cloned;
}

export async function listCompanyTemplateCandidates(
  client: Pick<SupabaseClient, "from">,
  tenantId: string,
): Promise<CompanyTemplateCandidate[]> {
  const normalizedTenantId = required(tenantId, "Tenant");
  const [{ data: designs, error: designsError }, { data: templates, error: templatesError }] = await Promise.all([
    database(client)
      .from("designer_saved_designs")
      .select("id, name, description, preview_thumbnail_url, editor_json, width_mm, height_mm, bleed_mm, safe_area_mm, dpi, color_profile, product_id, template_id")
      .eq("tenant_id", normalizedTenantId)
      .order("updated_at", { ascending: false }),
    database(client)
      .from("designer_templates")
      .select("id, name, description, preview_image_url, editor_json, width_mm, height_mm, bleed_mm, safe_area_mm, dpi_default, color_profile, tenant_id, is_public")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);
  if (designsError) throw designsError;
  if (templatesError) throw templatesError;

  const designRows: CompanyTemplateCandidate[] = (designs || []).map((row: any) => ({
    id: row.id,
    kind: "design",
    name: row.name,
    description: row.description || null,
    previewUrl: row.preview_thumbnail_url || null,
    editorJson: row.editor_json || null,
    widthMm: Number(row.width_mm),
    heightMm: Number(row.height_mm),
    bleedMm: Number(row.bleed_mm || 0),
    safeAreaMm: Number(row.safe_area_mm || 3),
    dpi: Number(row.dpi || 300),
    colorProfile: row.color_profile || "FOGRA39",
    productId: row.product_id || null,
    templateId: row.template_id || null,
  }));
  const templateRows: CompanyTemplateCandidate[] = (templates || [])
    .filter((row: any) => row.tenant_id === normalizedTenantId || row.is_public === true)
    .map((row: any) => ({
      id: row.id,
      kind: "template",
      name: row.name,
      description: row.description || null,
      previewUrl: row.preview_image_url || null,
      editorJson: row.editor_json || null,
      widthMm: Number(row.width_mm),
      heightMm: Number(row.height_mm),
      bleedMm: Number(row.bleed_mm || 0),
      safeAreaMm: Number(row.safe_area_mm || 3),
      dpi: Number(row.dpi_default || 300),
      colorProfile: row.color_profile || "FOGRA39",
      productId: null,
      templateId: row.id,
    }));
  return [...designRows, ...templateRows];
}

export async function listCompanyTemplateBindings(
  client: Pick<SupabaseClient, "from">,
  companyId: string,
  options: { activeOnly?: boolean } = {},
): Promise<CompanyTemplateBindingWithFields[]> {
  let query = database(client)
    .from("company_template_bindings")
    .select(`
      *,
      fields:company_template_fields(*),
      item:company_hub_items(title, product_id)
    `)
    .eq("company_id", required(companyId, "Firma"))
    .order("created_at", { ascending: false });
  if (options.activeOnly) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => {
    const item = Array.isArray(row.item) ? row.item[0] : row.item;
    return {
      ...row,
      fields: (row.fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      item_title: item?.title,
      product_id: item?.product_id || null,
    };
  });
}

export async function createCompanyTemplateBinding(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyTemplateBindingInput,
): Promise<CompanyTemplateBindingWithFields> {
  required(scope.tenantId, "Tenant");
  required(scope.companyId, "Firma");
  const itemId = required(input.itemId, "Firmaprodukt");
  const sourceId = required(input.sourceId, "Designkilde");
  if (!input.fields.length) throw new Error("Vælg mindst ét redigerbart felt.");

  const { data: latest } = await database(client)
    .from("company_template_bindings")
    .select("version")
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(latest?.version || 0) + 1;
  const status = input.status || "active";

  if (status === "active") {
    const { error: retireError } = await database(client)
      .from("company_template_bindings")
      .update({ status: "retired" })
      .eq("tenant_id", scope.tenantId)
      .eq("company_id", scope.companyId)
      .eq("item_id", itemId)
      .eq("status", "active");
    if (retireError) throw retireError;
  }

  const { data: binding, error: bindingError } = await database(client)
    .from("company_template_bindings")
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      item_id: itemId,
      design_id: input.sourceKind === "design" ? sourceId : null,
      template_id: input.sourceKind === "template" ? sourceId : null,
      version,
      status,
      name: required(input.name, "Skabelonnavn"),
      preview_url: optional(input.previewUrl),
      output_mode: input.outputMode || "designer_pdf",
      source_fingerprint: `${input.sourceKind}:${sourceId}:v${version}`,
      approved_by: status === "active" ? optional(input.approvedBy) : null,
      approved_at: status === "active" ? new Date().toISOString() : null,
      created_by: optional(input.approvedBy),
    })
    .select("*")
    .single();
  if (bindingError || !binding) throw bindingError || new Error("Skabelonen kunne ikke oprettes.");

  const fieldRows = input.fields.map((field, index) => ({
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    binding_id: binding.id,
    field_key: slugify(field.fieldKey || field.label),
    label: required(field.label, "Feltnavn"),
    field_type: field.fieldType,
    fabric_object_id: required(field.fabricObjectId, "Designfelt"),
    is_required: field.isRequired === true,
    default_source: optional(field.defaultSource),
    default_value: field.defaultValue ?? null,
    validation_rules: {},
    allowed_values: field.allowedValues || [],
    max_length: field.maxLength || null,
    allow_position: false,
    allow_size: false,
    allow_style: false,
    sort_order: index,
  }));
  const { data: fields, error: fieldsError } = await database(client)
    .from("company_template_fields")
    .insert(fieldRows)
    .select("*");
  if (fieldsError) throw fieldsError;

  if (status === "active") {
    const { error: itemError } = await database(client)
      .from("company_hub_items")
      .update({ template_binding_id: binding.id })
      .eq("id", itemId)
      .eq("tenant_id", scope.tenantId)
      .eq("company_id", scope.companyId);
    if (itemError) throw itemError;
  }

  return { ...binding, fields: fields || [] };
}

export async function createCompanyWorkingDesign(
  client: Pick<SupabaseClient, "from" | "auth">,
  scope: CompanyWorkspaceScope,
  bindingId: string,
  values: CompanyJson,
): Promise<{ designId: string; productId: string; editorJson: CompanyJson }> {
  const { data: binding, error: bindingError } = await database(client)
    .from("company_template_bindings")
    .select(`
      *,
      fields:company_template_fields(*),
      item:company_hub_items(title, product_id)
    `)
    .eq("id", required(bindingId, "Skabelon"))
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .eq("status", "active")
    .single();
  if (bindingError || !binding) throw bindingError || new Error("Den godkendte skabelon kunne ikke indlæses.");
  const fields = (binding.fields || []) as CompanyTemplateField[];
  const item = Array.isArray(binding.item) ? binding.item[0] : binding.item;
  const productId = required(item?.product_id, "Produkt");

  const sourceTable = binding.design_id ? "designer_saved_designs" : "designer_templates";
  const sourceId = binding.design_id || binding.template_id;
  const { data: source, error: sourceError } = await database(client)
    .from(sourceTable)
    .select("*")
    .eq("id", sourceId)
    .single();
  if (sourceError || !source?.editor_json) {
    throw sourceError || new Error("Skabelonen indeholder ikke et redigerbart design.");
  }

  const editorJson = applyControlledTemplateValues(source.editor_json, fields, values);
  const { data: authData, error: authError } = await (client as any).auth.getUser();
  const userId = authData?.user?.id;
  if (authError || !userId) throw authError || new Error("Du skal være logget ind for at tilpasse designet.");

  const { data: workingDesign, error: designError } = await database(client)
    .from("designer_saved_designs")
    .insert({
      tenant_id: scope.tenantId,
      user_id: userId,
      product_id: productId,
      template_id: binding.template_id || source.template_id || null,
      name: `${item?.title || binding.name} - personlig version`,
      description: `Oprettet fra ${binding.name}, version ${binding.version}`,
      width_mm: source.width_mm,
      height_mm: source.height_mm,
      bleed_mm: source.bleed_mm || 0,
      safe_area_mm: source.safe_area_mm || 3,
      dpi: source.dpi || source.dpi_default || 300,
      color_profile: source.color_profile || "FOGRA39",
      editor_json: editorJson,
      preview_thumbnail_url: binding.preview_url || source.preview_thumbnail_url || source.preview_image_url || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (designError || !workingDesign) throw designError || new Error("Den personlige version kunne ikke oprettes.");
  return { designId: workingDesign.id, productId, editorJson };
}
