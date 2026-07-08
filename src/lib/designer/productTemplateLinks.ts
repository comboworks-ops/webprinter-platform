export type ProductTemplateFile = {
  name: string;
  url: string;
  format?: string | null;
  designerUrl?: string | null;
  designerLabel?: string | null;
  uploadedAt?: string | null;
};

export type DesignerTemplateLaunch = {
  name: string;
  pdfUrl: string;
  widthMm?: number;
  heightMm?: number;
  bleedMm?: number;
  safeMm?: number;
};

export const SALGSMAPPER_TEMPLATE_PDF_URL = "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf";

export const normalizeFormatKey = (value: string | null | undefined) => {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
};

export const templateMatchesSelectedFormat = (
  templateFormat: string | null | undefined,
  selectedFormat?: string | null,
  selectedFormatLabel?: string | null,
) => {
  if (!templateFormat) return true;
  const templateKey = normalizeFormatKey(templateFormat);
  if (!templateKey) return true;

  const selectedKeys = [selectedFormat, selectedFormatLabel]
    .map(normalizeFormatKey)
    .filter(Boolean);

  if (selectedKeys.length === 0) return true;
  return selectedKeys.some((key) => key === templateKey || key.includes(templateKey) || templateKey.includes(key));
};

export const getSalgsmapperFallbackTemplates = ({
  productId,
  productName,
  productSlug,
}: {
  productId?: string | null;
  productName?: string | null;
  productSlug?: string | null;
}): ProductTemplateFile[] => {
  const productKey = `${productSlug || ""} ${productName || ""} ${productId || ""}`.toLowerCase();
  if (!productKey.includes("salgsmap")) return [];

  return [{
    name: "Salgsmappe A5 5 mm ryg",
    url: SALGSMAPPER_TEMPLATE_PDF_URL,
    format: "A5",
    uploadedAt: "2026-06-30T00:00:00.000Z",
  }];
};

export const mergeProductTemplates = (
  templates: ProductTemplateFile[] | null | undefined,
  fallbackTemplates: ProductTemplateFile[],
) => {
  const existing = templates || [];
  const existingUrls = new Set(existing.map((template) => template.url));
  return [
    ...existing,
    ...fallbackTemplates.filter((template) => !existingUrls.has(template.url)),
  ];
};

const readNumberParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const templateFileToDesignerLaunch = (template: ProductTemplateFile): DesignerTemplateLaunch | null => {
  const designerUrl = String(template.designerUrl || "");
  if (designerUrl) {
    try {
      const url = new URL(designerUrl, "http://local.template");
      const pdfUrl = url.searchParams.get("templatePdfUrl") || url.searchParams.get("templatePdf") || template.url;
      return {
        name: url.searchParams.get("templatePdfName") || template.name,
        pdfUrl,
        widthMm: readNumberParam(url.searchParams, "widthMm"),
        heightMm: readNumberParam(url.searchParams, "heightMm"),
        bleedMm: readNumberParam(url.searchParams, "bleedMm"),
        safeMm: readNumberParam(url.searchParams, "safeMm"),
      };
    } catch {
      return {
        name: template.name,
        pdfUrl: template.url,
      };
    }
  }

  if (template.url === SALGSMAPPER_TEMPLATE_PDF_URL) {
    return {
      name: template.name,
      pdfUrl: template.url,
      widthMm: 504,
      heightMm: 371,
      bleedMm: 0,
      safeMm: 5,
    };
  }

  return null;
};

export const resolveSelectedDesignerTemplateLaunch = ({
  templates,
  selectedFormat,
  selectedFormatLabel,
}: {
  templates: ProductTemplateFile[];
  selectedFormat?: string | null;
  selectedFormatLabel?: string | null;
}) => {
  const matchingTemplates = templates.filter((template) => (
    templateMatchesSelectedFormat(template.format, selectedFormat, selectedFormatLabel)
  ));

  for (const template of matchingTemplates) {
    const launch = templateFileToDesignerLaunch(template);
    if (launch) return launch;
  }

  for (const template of templates) {
    const launch = templateFileToDesignerLaunch(template);
    if (launch) return launch;
  }

  return null;
};
