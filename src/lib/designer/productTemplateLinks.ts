export type TemplateGuideFoldLine = {
  axis: "vertical" | "horizontal";
  positionMm: number;
};

export type TemplateGuidePage = {
  page: number;
  label?: string | null;
  widthMm: number;
  heightMm: number;
  foldLines: TemplateGuideFoldLine[];
};

export type TemplateGuideGeometry = {
  pages: TemplateGuidePage[];
};

export type TemplateSelectionConstraints = Record<string, string>;
export type TemplateSelectionConstraintSections = Record<string, string>;
export type TemplateArtworkMode = "online_designer" | "professional_pdf_upload_only";

export type ProductTemplateFile = {
  name: string;
  url: string;
  pdfUrl?: string | null;
  fileUrl?: string | null;
  downloadUrl?: string | null;
  format?: string | null;
  configuration?: string | null;
  variant?: string | null;
  selectionConstraints?: TemplateSelectionConstraints | null;
  selection_constraints?: TemplateSelectionConstraints | null;
  selectionConstraintProfile?: string | null;
  selection_constraint_profile?: string | null;
  selectionConstraintSections?: TemplateSelectionConstraintSections | null;
  selection_constraint_sections?: TemplateSelectionConstraintSections | null;
  designerTemplateId?: string | null;
  designer_template_id?: string | null;
  designerLoadMode?: "locked_non_printing_guide_overlay" | string | null;
  lockedInDesigner?: boolean | null;
  nonPrintingOverlay?: boolean | null;
  excludedFromExport?: boolean | null;
  artworkMode?: TemplateArtworkMode | null;
  artwork_mode?: TemplateArtworkMode | null;
  artworkModeReasonDa?: string | null;
  artwork_mode_reason_da?: string | null;
  templatePdfSha256?: string | null;
  designerUrl?: string | null;
  designerLabel?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  bleedMm?: number | null;
  safeMm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  bleed_mm?: number | null;
  safe_area_mm?: number | null;
  guideGeometry?: TemplateGuideGeometry | null;
  guide_geometry?: TemplateGuideGeometry | null;
  uploadedAt?: string | null;
};

export type DesignerTemplateLaunch = {
  name: string;
  pdfUrl: string;
  templatePdfSha256?: string;
  templateId?: string;
  widthMm?: number;
  heightMm?: number;
  bleedMm?: number;
  safeMm?: number;
  guideGeometry?: TemplateGuideGeometry;
  artworkMode?: TemplateArtworkMode;
  artworkModeReasonDa?: string;
};

const readTemplateArtworkMode = (template: ProductTemplateFile): TemplateArtworkMode | undefined => {
  const value = template.artworkMode ?? template.artwork_mode;
  return value === "professional_pdf_upload_only" || value === "online_designer"
    ? value
    : undefined;
};

const readTemplateArtworkModeReasonDa = (template: ProductTemplateFile) => (
  String(template.artworkModeReasonDa || template.artwork_mode_reason_da || "").trim() || undefined
);

export const isOnlineDesignerAvailableForLaunch = (
  launch: DesignerTemplateLaunch | null | undefined,
) => launch?.artworkMode !== "professional_pdf_upload_only";

const readTemplatePdfSha256 = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : undefined;
};

export const normalizeFormatKey = (value: string | null | undefined) => {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
};

const normalizeConfigurationKey = (value: string | null | undefined) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const configurationTokens = (value: string | null | undefined) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
};

type TemplateSelectionConstraintState = {
  isStructured: boolean;
  constraints: TemplateSelectionConstraints | null;
};

const SALES_FOLDER_SELECTION_AXES = [
  "folder_model",
  "print",
  "spine",
  "paper",
  "finish",
] as const;

const hasExactKeys = (value: Record<string, unknown>, expectedKeys: readonly string[]) => {
  const actualKeys = Object.keys(value).sort();
  const requiredKeys = [...expectedKeys].sort();
  return actualKeys.length === requiredKeys.length
    && actualKeys.every((key, index) => key === requiredKeys[index]);
};

const readTemplateSelectionConstraints = (
  template: ProductTemplateFile,
): TemplateSelectionConstraintState => {
  const raw = template.selectionConstraints ?? template.selection_constraints;
  const rawProfile = template.selectionConstraintProfile ?? template.selection_constraint_profile;
  const profile = String(rawProfile || "").trim();
  const rawSections = template.selectionConstraintSections ?? template.selection_constraint_sections;
  const hasStructuredMetadata = raw != null || Boolean(profile) || rawSections != null;
  if (!hasStructuredMetadata) return { isStructured: false, constraints: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { isStructured: true, constraints: null };
  }

  const entries = Object.entries(raw);
  if (
    entries.length === 0
    || entries.some(([sectionId, valueId]) => !sectionId || typeof valueId !== "string" || !valueId)
  ) {
    return { isStructured: true, constraints: null };
  }

  if (profile) {
    // A sales-folder dieline is selected by five independent axes. Requiring an
    // explicit semantic-axis-to-section map prevents a malformed one-axis
    // binding from matching every paper, finish, print mode, or spine depth.
    if (profile !== "sales_folder_v1") {
      return { isStructured: true, constraints: null };
    }
    if (typeof rawSections !== "object" || rawSections == null || Array.isArray(rawSections)) {
      return { isStructured: true, constraints: null };
    }
    if (!hasExactKeys(rawSections, SALES_FOLDER_SELECTION_AXES)) {
      return { isStructured: true, constraints: null };
    }

    const sectionIds = SALES_FOLDER_SELECTION_AXES.map((axis) => rawSections[axis]);
    if (
      sectionIds.some((sectionId) => typeof sectionId !== "string" || !sectionId.trim())
      || new Set(sectionIds).size !== SALES_FOLDER_SELECTION_AXES.length
      || !hasExactKeys(raw, sectionIds)
    ) {
      return { isStructured: true, constraints: null };
    }
  }

  return { isStructured: true, constraints: Object.fromEntries(entries) };
};

export const collectExactTemplateSelectionConstraints = (
  templates: ProductTemplateFile[],
): TemplateSelectionConstraints[] => {
  const unique = new Map<string, TemplateSelectionConstraints>();

  templates.forEach((template) => {
    const { constraints } = readTemplateSelectionConstraints(template);
    if (!constraints) return;
    const key = Object.entries(constraints)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sectionId, valueId]) => `${sectionId}=${valueId}`)
      .join("|");
    if (key && !unique.has(key)) unique.set(key, constraints);
  });

  return Array.from(unique.values());
};

const templateMatchesSelectedSectionValues = (
  template: ProductTemplateFile,
  selectedSectionValues: Record<string, string | null>,
) => {
  const { constraints } = readTemplateSelectionConstraints(template);
  if (!constraints) return false;

  return Object.entries(constraints).every(([sectionId, valueId]) => (
    selectedSectionValues[sectionId] === valueId
  ));
};

const getTemplateNameText = (template: ProductTemplateFile) => {
  const raw = [template.name, template.format, template.configuration, template.variant]
    .filter(Boolean)
    .join(" ");

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const inferTemplateFormat = (template: ProductTemplateFile): string | null => {
  const explicitFormat = String(template.format || "").trim();
  if (explicitFormat) return explicitFormat;

  const source = getTemplateNameText(template);
  const standardFormat = source.match(/(?:^|[^a-z0-9])(A[0-6]|M65)(?:[^a-z0-9]|$)/i)?.[1];
  if (standardFormat) return standardFormat.toUpperCase();
  if (/DIN[\s_-]*LANG/i.test(source)) return "DIN lang";

  const squareFormat = source.match(/(?:^|[^0-9])(21)\s*[x×]\s*(21)(?:[^0-9]|$)/i);
  if (squareFormat) return "21 x 21";

  return null;
};

export const inferTemplateConfiguration = (template: ProductTemplateFile): string | null => {
  const explicitConfiguration = String(template.configuration || template.variant || "").trim();
  if (explicitConfiguration) return explicitConfiguration;

  const source = getTemplateNameText(template);
  const spine = source.match(/(\d+(?:[.,]\d+)?)\s*mm[\s_-]*(?:ryg|spine|back)/i);
  if (!spine) return null;
  return `${spine[1].replace(",", ".")} mm ryg`;
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

export const templateMatchesSelectedConfiguration = (
  template: ProductTemplateFile,
  selectedFormat?: string | null,
  selectedFormatLabel?: string | null,
  selectedOptionLabels: string[] = [],
) => {
  const inferredFormat = inferTemplateFormat(template);
  const formatCandidates = [selectedFormat, selectedFormatLabel, ...selectedOptionLabels]
    .filter((value): value is string => Boolean(value));

  if (inferredFormat && formatCandidates.length > 0) {
    const templateKey = normalizeFormatKey(inferredFormat);
    const matchesFormat = formatCandidates
      .map(normalizeFormatKey)
      .filter(Boolean)
      .some((key) => key === templateKey || key.includes(templateKey) || templateKey.includes(key));
    if (!matchesFormat) return false;
  }

  const inferredConfiguration = inferTemplateConfiguration(template);
  if (inferredConfiguration) {
    if (selectedOptionLabels.length === 0) return false;
    const templateKey = normalizeConfigurationKey(inferredConfiguration);
    const selectedKeys = selectedOptionLabels
      .map(normalizeConfigurationKey)
      .filter(Boolean);
    const combinedSelectionKey = normalizeConfigurationKey(selectedOptionLabels.join(" "));
    const requiredTokens = configurationTokens(inferredConfiguration);
    const selectedTokens = new Set(selectedOptionLabels.flatMap(configurationTokens));
    const matchesConfiguration = selectedKeys
      .some((key) => key === templateKey || key.includes(templateKey))
      || combinedSelectionKey.includes(templateKey)
      || (requiredTokens.length > 0 && requiredTokens.every((token) => selectedTokens.has(token)));
    if (!matchesConfiguration) return false;
  }

  return true;
};

export const templateHasSelectionConstraints = (template: ProductTemplateFile) => (
  readTemplateSelectionConstraints(template).isStructured
  || Boolean(inferTemplateFormat(template) || inferTemplateConfiguration(template))
);

export const selectionUsesFoldedLayout = (...selectionParts: Array<string | null | undefined>) => {
  const selectionText = selectionParts
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /(folder|foldetype|falset|rullefals|zigzag|salgsmappe|praesentationsmappe|mappe|\bryg\b)/.test(selectionText);
};

const readNumberParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readPositiveTemplateNumber = (...values: Array<number | string | null | undefined>) => {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return undefined;
};

const readNonNegativeTemplateNumber = (...values: Array<number | string | null | undefined>) => {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  return undefined;
};

const readTemplatePdfUrl = (template: ProductTemplateFile) => {
  return String(template.pdfUrl || template.url || template.fileUrl || template.downloadUrl || "").trim();
};

const readTemplateGuideGeometry = (template: ProductTemplateFile): TemplateGuideGeometry | undefined => {
  const raw = template.guideGeometry || template.guide_geometry;
  if (!raw || !Array.isArray(raw.pages) || raw.pages.length === 0) return undefined;

  const pages = raw.pages.flatMap((page, index) => {
    const widthMm = Number(page?.widthMm);
    const heightMm = Number(page?.heightMm);
    if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(heightMm) || heightMm <= 0) {
      return [];
    }

    const foldLines = Array.isArray(page?.foldLines)
      ? page.foldLines.flatMap((line) => {
          const positionMm = Number(line?.positionMm);
          if (
            (line?.axis !== "vertical" && line?.axis !== "horizontal")
            || !Number.isFinite(positionMm)
            || positionMm <= 0
          ) {
            return [];
          }
          const limit = line.axis === "vertical" ? widthMm : heightMm;
          return positionMm < limit ? [{ axis: line.axis, positionMm }] : [];
        })
      : [];

    return [{
      page: Number.isInteger(Number(page?.page)) ? Number(page.page) : index + 1,
      label: String(page?.label || "").trim() || undefined,
      widthMm,
      heightMm,
      foldLines,
    }];
  });

  return pages.length ? { pages } : undefined;
};

const looksLikePdfTemplate = (value: string) => {
  if (!value) return false;

  try {
    const url = new URL(value, "http://local.template");
    const pathname = url.pathname.toLowerCase();
    return pathname.endsWith(".pdf") || url.searchParams.get("templatePdfUrl")?.toLowerCase().includes(".pdf") === true;
  } catch {
    return value.toLowerCase().split("?")[0].endsWith(".pdf");
  }
};

export const templateFileToDesignerLaunch = (template: ProductTemplateFile): DesignerTemplateLaunch | null => {
  const linkedTemplateId = String(template.designerTemplateId || template.designer_template_id || "").trim() || undefined;
  const guideGeometry = readTemplateGuideGeometry(template);
  const artworkMode = readTemplateArtworkMode(template);
  const artworkModeReasonDa = readTemplateArtworkModeReasonDa(template);
  const designerUrl = String(template.designerUrl || "");
  if (designerUrl) {
    try {
      const url = new URL(designerUrl, "http://local.template");
      const pdfUrl = url.searchParams.get("templatePdfUrl") || url.searchParams.get("templatePdf") || template.url;
      return {
        name: url.searchParams.get("templatePdfName") || template.name,
        pdfUrl,
        ...(readTemplatePdfSha256(url.searchParams.get("templatePdfSha256") || template.templatePdfSha256)
          ? { templatePdfSha256: readTemplatePdfSha256(url.searchParams.get("templatePdfSha256") || template.templatePdfSha256) }
          : {}),
        templateId: url.searchParams.get("templateId") || linkedTemplateId,
        widthMm: readNumberParam(url.searchParams, "widthMm"),
        heightMm: readNumberParam(url.searchParams, "heightMm"),
        bleedMm: readNumberParam(url.searchParams, "bleedMm"),
        safeMm: readNumberParam(url.searchParams, "safeMm"),
        ...(guideGeometry ? { guideGeometry } : {}),
        ...(artworkMode ? { artworkMode } : {}),
        ...(artworkModeReasonDa ? { artworkModeReasonDa } : {}),
      };
    } catch {
      return {
        name: template.name,
        pdfUrl: template.url,
        ...(readTemplatePdfSha256(template.templatePdfSha256)
          ? { templatePdfSha256: readTemplatePdfSha256(template.templatePdfSha256) }
          : {}),
        templateId: linkedTemplateId,
        ...(guideGeometry ? { guideGeometry } : {}),
        ...(artworkMode ? { artworkMode } : {}),
        ...(artworkModeReasonDa ? { artworkModeReasonDa } : {}),
      };
    }
  }

  const pdfUrl = readTemplatePdfUrl(template);
  if (!looksLikePdfTemplate(pdfUrl)) return null;

  return {
    name: template.name || pdfUrl.split("/").pop() || "Produktskabelon",
    pdfUrl,
    ...(readTemplatePdfSha256(template.templatePdfSha256)
      ? { templatePdfSha256: readTemplatePdfSha256(template.templatePdfSha256) }
      : {}),
    templateId: linkedTemplateId,
    widthMm: readPositiveTemplateNumber(template.widthMm, template.width_mm),
    heightMm: readPositiveTemplateNumber(template.heightMm, template.height_mm),
    bleedMm: readNonNegativeTemplateNumber(template.bleedMm, template.bleed_mm),
    safeMm: readNonNegativeTemplateNumber(template.safeMm, template.safe_area_mm),
    ...(guideGeometry ? { guideGeometry } : {}),
    ...(artworkMode ? { artworkMode } : {}),
    ...(artworkModeReasonDa ? { artworkModeReasonDa } : {}),
  };
};

export const resolveSelectedDesignerTemplateLaunch = ({
  templates,
  selectedFormat,
  selectedFormatLabel,
  selectedOptionLabels = [],
  selectedSectionValues = {},
}: {
  templates: ProductTemplateFile[];
  selectedFormat?: string | null;
  selectedFormatLabel?: string | null;
  selectedOptionLabels?: string[];
  selectedSectionValues?: Record<string, string | null>;
}) => {
  const structuredTemplates = templates.filter((template) => (
    readTemplateSelectionConstraints(template).isStructured
  ));
  const matchingStructuredTemplates = structuredTemplates.filter((template) => (
    templateMatchesSelectedSectionValues(template, selectedSectionValues)
  ));

  // An exact structured link must be unique. Choosing the first duplicate could
  // send a customer into the wrong dieline, so ambiguity deliberately fails closed.
  if (matchingStructuredTemplates.length > 1) return null;

  if (matchingStructuredTemplates.length === 1) {
    const [template] = matchingStructuredTemplates;
    const constraintProfile = String(
      template.selectionConstraintProfile ?? template.selection_constraint_profile ?? "",
    ).trim();
    if (
      constraintProfile !== "sales_folder_v1"
      && !templateMatchesSelectedConfiguration(
        template,
        selectedFormat,
        selectedFormatLabel,
        selectedOptionLabels,
      )
    ) {
      return null;
    }

    return templateFileToDesignerLaunch(template);
  }

  // Once a product has structured template bindings, an unmatched selection
  // must fail closed. Falling back to a filename-matched legacy PDF here could
  // open the wrong dieline for a partially migrated configurable product.
  if (structuredTemplates.length > 0) return null;

  const matchingLegacyTemplates = templates.filter((template) => (
    !readTemplateSelectionConstraints(template).isStructured
    && templateMatchesSelectedConfiguration(
      template,
      selectedFormat,
      selectedFormatLabel,
      selectedOptionLabels,
    )
  ));

  for (const template of matchingLegacyTemplates) {
    const launch = templateFileToDesignerLaunch(template);
    if (launch) return launch;
  }

  return null;
};
