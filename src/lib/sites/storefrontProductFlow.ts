import {
  getProductDesignerModeLabel,
  getProductPricingModelLabel,
  resolveProductSiteModes,
  type ProductDesignerMode,
  type ProductPricingModel,
  type ProductSiteModeInput,
} from "@/lib/sites/productSiteModes";

export interface StorefrontProductFlow {
  designerMode: ProductDesignerMode | null;
  pricingModel: ProductPricingModel | null;
  source: "explicit" | "inferred" | "missing";
  designerModeLabel: string;
  pricingModelLabel: string;
  badgeLabel: string;
  customerHelpText: string;
  designerCtaLabel: string;
  orderCtaLabel: string;
  checkoutTitle: string;
  checkoutUploadTitle: string;
  checkoutUploadHelpText: string;
  showDesignerButton: boolean;
  showTemplateDownload: boolean;
  prefersTemplateOverlay: boolean;
}

const FLOW_COPY: Record<ProductDesignerMode, {
  badgeLabel: string;
  customerHelpText: string;
  designerCtaLabel: string;
  orderCtaLabel: string;
  checkoutTitle: string;
  checkoutUploadTitle: string;
  checkoutUploadHelpText: string;
  showDesignerButton: boolean;
  showTemplateDownload: boolean;
  prefersTemplateOverlay: boolean;
}> = {
  flat_print: {
    badgeLabel: "Standard tryk",
    customerHelpText: "Design online eller upload en trykklar fil i næste trin.",
    designerCtaLabel: "Design online",
    orderCtaLabel: "Upload fil og bestil",
    checkoutTitle: "Konfigurer dit design",
    checkoutUploadTitle: "Upload trykfil",
    checkoutUploadHelpText: "Upload en trykklar PDF eller brug fuld designer til at placere filen på formatet.",
    showDesignerButton: true,
    showTemplateDownload: true,
    prefersTemplateOverlay: false,
  },
  pdf_template: {
    badgeLabel: "PDF-skabelon",
    customerHelpText: "Brug designeren med skabelonlinjer eller download skabelonen til eget program.",
    designerCtaLabel: "Design i skabelon",
    orderCtaLabel: "Upload eller bestil",
    checkoutTitle: "Skabelon og fil-tjek",
    checkoutUploadTitle: "Upload fil til skabelon",
    checkoutUploadHelpText: "Upload en trykklar PDF. Skabelonen bruges som kontrol for fold, ryg, beskæring og sikkerhedszone.",
    showDesignerButton: true,
    showTemplateDownload: true,
    prefersTemplateOverlay: true,
  },
  storformat: {
    badgeLabel: "Storformat",
    customerHelpText: "Design efter valgt bredde og højde, eller upload en færdig storformatfil.",
    designerCtaLabel: "Design",
    orderCtaLabel: "Upload fil og bestil",
    checkoutTitle: "Storformat fil-tjek",
    checkoutUploadTitle: "Upload storformatfil",
    checkoutUploadHelpText: "Upload PDF eller billede. Du kan finjustere placering og mål i fuld designer.",
    showDesignerButton: true,
    showTemplateDownload: false,
    prefersTemplateOverlay: false,
  },
  signage: {
    badgeLabel: "Skilt/facade",
    customerHelpText: "Design efter mål og materiale, eller upload produktionsklar skiltefil.",
    designerCtaLabel: "Design",
    orderCtaLabel: "Upload fil og bestil",
    checkoutTitle: "Skiltefil og korrektur",
    checkoutUploadTitle: "Upload skiltefil",
    checkoutUploadHelpText: "Upload PDF eller billede. Brug fuld designer hvis motivet skal kontrolleres mod størrelse, bleed eller CutContour.",
    showDesignerButton: true,
    showTemplateDownload: false,
    prefersTemplateOverlay: false,
  },
  apparel: {
    badgeLabel: "Tekstiltryk",
    customerHelpText: "Design printfeltet eller upload motiv til tekstilproduktion.",
    designerCtaLabel: "Design trykfelt",
    orderCtaLabel: "Upload motiv og bestil",
    checkoutTitle: "Motiv og størrelser",
    checkoutUploadTitle: "Upload motiv",
    checkoutUploadHelpText: "Upload motivfil til tryk. Størrelsesfordeling håndteres i ordreflowet, hvis produktet kræver det.",
    showDesignerButton: true,
    showTemplateDownload: false,
    prefersTemplateOverlay: false,
  },
  photo_product: {
    badgeLabel: "Fotoprodukt",
    customerHelpText: "Upload foto eller brug designer til placering på formatet.",
    designerCtaLabel: "Design fotoprodukt",
    orderCtaLabel: "Upload foto og bestil",
    checkoutTitle: "Foto og fil-tjek",
    checkoutUploadTitle: "Upload foto",
    checkoutUploadHelpText: "Upload billede eller PDF. Brug høj opløsning for bedste trykresultat.",
    showDesignerButton: true,
    showTemplateDownload: false,
    prefersTemplateOverlay: false,
  },
  upload_only: {
    badgeLabel: "Kun upload",
    customerHelpText: "Dette produkt går direkte til upload og fil-tjek.",
    designerCtaLabel: "Åbn fil-tjek",
    orderCtaLabel: "Upload fil og bestil",
    checkoutTitle: "Upload og fil-tjek",
    checkoutUploadTitle: "Upload trykklar fil",
    checkoutUploadHelpText: "Upload en færdig trykfil. Fuld designer er stadig tilgængelig som manuel kontrol, hvis du får brug for den.",
    showDesignerButton: false,
    showTemplateDownload: true,
    prefersTemplateOverlay: false,
  },
};

export function resolveStorefrontProductFlow(input: ProductSiteModeInput): StorefrontProductFlow {
  const resolved = resolveProductSiteModes(input);
  const designerMode = resolved.designerMode || "flat_print";
  const copy = FLOW_COPY[designerMode];

  return {
    designerMode,
    pricingModel: resolved.pricingModel,
    source: resolved.source,
    designerModeLabel: getProductDesignerModeLabel(designerMode),
    pricingModelLabel: getProductPricingModelLabel(resolved.pricingModel),
    ...copy,
  };
}
