type JsonObject = Record<string, unknown>;

export type ProductDesignerMode =
  | "flat_print"
  | "pdf_template"
  | "storformat"
  | "signage"
  | "apparel"
  | "photo_product"
  | "upload_only";

export type ProductPricingModel =
  | "matrix"
  | "template_product"
  | "storformat_area"
  | "machine_priced"
  | "apparel_matrix"
  | "photo_package"
  | "manual_quote";

export interface ProductSiteModes {
  designerMode: ProductDesignerMode | null;
  pricingModel: ProductPricingModel | null;
}

export interface ResolvedProductSiteModes extends ProductSiteModes {
  source: "explicit" | "inferred" | "missing";
}

export interface ProductSiteModeInput {
  name?: string | null;
  category?: string | null;
  pricing_type?: string | null;
  technical_specs?: unknown;
}

export const PRODUCT_DESIGNER_MODE_OPTIONS: Array<{
  value: ProductDesignerMode;
  label: string;
  description: string;
}> = [
  {
    value: "flat_print",
    label: "Standard trykflade",
    description: "Flyers, visitkort, brevpapir og almindelige tryksager.",
  },
  {
    value: "pdf_template",
    label: "PDF-template",
    description: "Produkter med foldelinjer, stans, ryg eller faste skabeloner.",
  },
  {
    value: "storformat",
    label: "Storformat",
    description: "Bannere, plakater, rollups og produkter med fri størrelse.",
  },
  {
    value: "signage",
    label: "Skilte/facade",
    description: "Skilte, folie, facade og montage-orienterede produkter.",
  },
  {
    value: "apparel",
    label: "Tekstil",
    description: "T-shirts, hoodies og beklædning med printfelter.",
  },
  {
    value: "photo_product",
    label: "Fotoprodukt",
    description: "Fotobøger, plakater, canvas, krus og gaveprodukter.",
  },
  {
    value: "upload_only",
    label: "Kun upload",
    description: "Kunden uploader trykklar fil uden designer-flow.",
  },
];

export const PRODUCT_PRICING_MODEL_OPTIONS: Array<{
  value: ProductPricingModel;
  label: string;
  description: string;
}> = [
  {
    value: "matrix",
    label: "Matrix",
    description: "Eksisterende matrixpriser i produktets pris-preview.",
  },
  {
    value: "template_product",
    label: "Template-produkt",
    description: "Fast produkttype med skabelon, format og evt. PDF-overlay.",
  },
  {
    value: "storformat_area",
    label: "Areal/meter",
    description: "Storformat, bredde/højde, m2 eller løbende meter.",
  },
  {
    value: "machine_priced",
    label: "Maskinpris",
    description: "Eksisterende MACHINE_PRICED/MPA-flow.",
  },
  {
    value: "apparel_matrix",
    label: "Tekstil matrix",
    description: "Størrelser, farver, trykmetode og oplag.",
  },
  {
    value: "photo_package",
    label: "Fotopakke",
    description: "Fotoprodukter med format, sideantal eller materialepakke.",
  },
  {
    value: "manual_quote",
    label: "Tilbud",
    description: "Bruges når produktet kræver manuel beregning.",
  },
];

const DESIGNER_MODE_VALUES = new Set<ProductDesignerMode>(
  PRODUCT_DESIGNER_MODE_OPTIONS.map((option) => option.value),
);

const PRICING_MODEL_VALUES = new Set<ProductPricingModel>(
  PRODUCT_PRICING_MODEL_OPTIONS.map((option) => option.value),
);

function asObject(value: unknown): JsonObject | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function readDesignerMode(value: unknown): ProductDesignerMode | null {
  return typeof value === "string" && DESIGNER_MODE_VALUES.has(value as ProductDesignerMode)
    ? (value as ProductDesignerMode)
    : null;
}

function readPricingModel(value: unknown): ProductPricingModel | null {
  return typeof value === "string" && PRICING_MODEL_VALUES.has(value as ProductPricingModel)
    ? (value as ProductPricingModel)
    : null;
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function readProductSiteModes(technicalSpecs: unknown): ProductSiteModes {
  const specs = asObject(technicalSpecs);
  const siteModes = asObject(specs?.site_modes) || asObject(specs?.siteModes) || {};

  return {
    designerMode: readDesignerMode(
      siteModes.designer_mode ?? siteModes.designerMode ?? specs?.designer_mode ?? specs?.designerMode,
    ),
    pricingModel: readPricingModel(
      siteModes.pricing_model ?? siteModes.pricingModel ?? specs?.pricing_model ?? specs?.pricingModel,
    ),
  };
}

export function inferProductSiteModes(product: ProductSiteModeInput): ProductSiteModes {
  const specs = asObject(product.technical_specs) || {};
  const text = [
    product.name,
    product.category,
    product.pricing_type,
    specs.product_type,
    specs.productType,
    specs.template_type,
    specs.templateType,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("da-DK");

  if (product.pricing_type === "STORFORMAT") {
    return { designerMode: "storformat", pricingModel: "storformat_area" };
  }

  if (product.pricing_type === "MACHINE_PRICED") {
    return { designerMode: "signage", pricingModel: "machine_priced" };
  }

  if (
    Boolean(specs.pdf_template_id || specs.pdfTemplateId || specs.template_pdf_url || specs.templatePdfUrl)
    || includesAny(text, ["salgsmappe", "salgsmapper", "mappe", "foldelinje", "stans", "ryg"])
  ) {
    return { designerMode: "pdf_template", pricingModel: "template_product" };
  }

  if (includesAny(text, ["t-shirt", "tshirt", "shirt", "hoodie", "tekstil", "beklædning", "apparel"])) {
    return { designerMode: "apparel", pricingModel: "apparel_matrix" };
  }

  if (includesAny(text, ["skilt", "facade", "folie", "akryl", "aluminium", "alu", "udskaaret", "udskåret"])) {
    return { designerMode: "signage", pricingModel: "storformat_area" };
  }

  if (includesAny(text, ["banner", "rollup", "mesh", "storformat"])) {
    return { designerMode: "storformat", pricingModel: "storformat_area" };
  }

  if (includesAny(text, ["fotobog", "foto", "canvas", "krus", "mug"])) {
    return { designerMode: "photo_product", pricingModel: "photo_package" };
  }

  return { designerMode: "flat_print", pricingModel: "matrix" };
}

export function resolveProductSiteModes(product: ProductSiteModeInput): ResolvedProductSiteModes {
  const explicit = readProductSiteModes(product.technical_specs);
  if (explicit.designerMode && explicit.pricingModel) {
    return { ...explicit, source: "explicit" };
  }

  const inferred = inferProductSiteModes(product);
  if (inferred.designerMode && inferred.pricingModel) {
    return {
      designerMode: explicit.designerMode || inferred.designerMode,
      pricingModel: explicit.pricingModel || inferred.pricingModel,
      source: "inferred",
    };
  }

  return {
    designerMode: explicit.designerMode,
    pricingModel: explicit.pricingModel,
    source: "missing",
  };
}

export function writeProductSiteModes(
  technicalSpecs: unknown,
  modes: Partial<ProductSiteModes>,
): JsonObject {
  const specs = asObject(technicalSpecs) || {};
  const currentSiteModes = asObject(specs.site_modes) || asObject(specs.siteModes) || {};
  const nextSiteModes: JsonObject = { ...currentSiteModes };

  if (modes.designerMode !== undefined) {
    if (modes.designerMode) {
      nextSiteModes.designer_mode = modes.designerMode;
    } else {
      delete nextSiteModes.designer_mode;
      delete nextSiteModes.designerMode;
    }
  }

  if (modes.pricingModel !== undefined) {
    if (modes.pricingModel) {
      nextSiteModes.pricing_model = modes.pricingModel;
    } else {
      delete nextSiteModes.pricing_model;
      delete nextSiteModes.pricingModel;
    }
  }

  return {
    ...specs,
    site_modes: {
      ...nextSiteModes,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getProductDesignerModeLabel(mode: ProductDesignerMode | null): string {
  return PRODUCT_DESIGNER_MODE_OPTIONS.find((option) => option.value === mode)?.label || "Ikke valgt";
}

export function getProductPricingModelLabel(model: ProductPricingModel | null): string {
  return PRODUCT_PRICING_MODEL_OPTIONS.find((option) => option.value === model)?.label || "Ikke valgt";
}
