export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export const DESIGNER_TEMPLATE_CATEGORY_OPTIONS = [
  { value: "menu_cards", label: "Menukort" },
  { value: "flyers", label: "Flyers" },
  { value: "folders", label: "Mapper & foldere" },
  { value: "documents", label: "Dokumenter" },
  { value: "posters", label: "Plakater" },
  { value: "banners", label: "Bannere" },
  { value: "business_cards", label: "Visitkort" },
  { value: "stickers", label: "Klistermærker" },
  { value: "other", label: "Andet" },
] as const;

export const TEMPLATE_LIBRARY_KIND_OPTIONS = [
  { value: "blank", label: "Blanko" },
  { value: "starter", label: "Startdesign" },
  { value: "canva", label: "Canva" },
] as const;

export const TEMPLATE_SOURCE_KIND_OPTIONS = [
  { value: "native", label: "Webprinter" },
  { value: "canva", label: "Canva" },
] as const;

export type TemplateLibraryKind = (typeof TEMPLATE_LIBRARY_KIND_OPTIONS)[number]["value"];
export type TemplateSourceKind = (typeof TEMPLATE_SOURCE_KIND_OPTIONS)[number]["value"];

export function getTemplateLibraryKindLabel(value: string | null | undefined): string {
  return TEMPLATE_LIBRARY_KIND_OPTIONS.find((option) => option.value === value)?.label || "Skabelon";
}

export function getTemplateSourceKindLabel(value: string | null | undefined): string {
  return TEMPLATE_SOURCE_KIND_OPTIONS.find((option) => option.value === value)?.label || "Webprinter";
}

export function getTemplateCategoryLabel(value: string | null | undefined): string {
  return DESIGNER_TEMPLATE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || value || "Andet";
}

export function isAttributeTemplateType(templateType: string | null | undefined): boolean {
  return ["material", "finish", "product"].includes((templateType || "").toLowerCase());
}

export function normalizeTemplateTags(input: string | string[] | null | undefined): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(input || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
