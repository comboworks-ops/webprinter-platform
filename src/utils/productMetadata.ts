// Product metadata and configuration
import { getProductImage } from "./productImages";

export type ProductId = 
  | "flyers" 
  | "foldere" 
  | "plakater" 
  | "klistermærker" 
  | "hæfter" 
  | "salgsmapper" 
  | "visitkort" 
  | "bannere" 
  | "beachflag" 
  | "skilte" 
  | "folie" 
  | "messeudstyr" 
  | "displayplakater";

export type PricingType = 'matrix' | 'rate' | 'formula' | 'fixed' | 'custom-dimensions';

export type ProductMetadata = {
  id: ProductId;
  name: string;
  slug: string;
  description: string;
  hasMatrixPricing: boolean;
  pricingType: PricingType;
  category: "tryksager" | "storformat";
  get image(): string;
};

export const productMetadata: Record<ProductId, ProductMetadata> = {
  flyers: {
    id: "flyers",
    name: "Flyers",
    slug: "flyers",
    description: "Professionelle flyers i høj kvalitet til markedsføring og information.",
    hasMatrixPricing: true,
    pricingType: "matrix",
    category: "tryksager",
    get image() { return getProductImage("flyers"); }
  },
  foldere: {
    id: "foldere",
    name: "Foldere",
    slug: "foldere",
    description: "Foldere med forskellige falsetyper og formater.",
    hasMatrixPricing: true,
    pricingType: "matrix",
    category: "tryksager",
    get image() { return getProductImage("foldere"); }
  },
  plakater: {
    id: "plakater",
    name: "Plakater",
    slug: "plakater",
    description: "Plakater i forskellige størrelser og papirkvaliteter.",
    hasMatrixPricing: false,
    pricingType: "rate",
    category: "tryksager",
    get image() { return getProductImage("plakater"); }
  },
  klistermærker: {
    id: "klistermærker",
    name: "Klistermærker",
    slug: "klistermærker",
    description: "Klistermærker i vinyl, plast eller papir.",
    hasMatrixPricing: false,
    pricingType: "rate",
    category: "tryksager",
    get image() { return getProductImage("klistermærker"); }
  },
  hæfter: {
    id: "hæfter",
    name: "Hæfter",
    slug: "haefter",
    description: "Hæfter med varierende sidetal og formater.",
    hasMatrixPricing: false,
    pricingType: "formula",
    category: "tryksager",
    get image() { return getProductImage("haefter"); }
  },
  salgsmapper: {
    id: "salgsmapper",
    name: "Salgsmapper",
    slug: "salgsmapper",
    description: "Professionelle salgsmapper til præsentationer.",
    hasMatrixPricing: false,
    pricingType: "formula",
    category: "tryksager",
    get image() { return getProductImage("salgsmapper"); }
  },
  visitkort: {
    id: "visitkort",
    name: "Visitkort",
    slug: "visitkort",
    description: "Visitkort i standard størrelse med forskellige papirkvaliteter.",
    hasMatrixPricing: true,
    pricingType: "matrix",
    category: "tryksager",
    get image() { return getProductImage("visitkort"); }
  },
  bannere: {
    id: "bannere",
    name: "Bannere",
    slug: "bannere",
    description: "Bannere i PVC, mesh eller tekstil til indendørs og udendørs brug.",
    hasMatrixPricing: false,
    pricingType: "custom-dimensions",
    category: "storformat",
    get image() { return getProductImage("bannere"); }
  },
  beachflag: {
    id: "beachflag",
    name: "Beachflag",
    slug: "beachflag",
    description: "Beachflag i forskellige størrelser med komplet system.",
    hasMatrixPricing: false,
    pricingType: "fixed",
    category: "storformat",
    get image() { return getProductImage("beachflag"); }
  },
  skilte: {
    id: "skilte",
    name: "Skilte",
    slug: "skilte",
    description: "Skilte i forskellige materialer og størrelser.",
    hasMatrixPricing: false,
    pricingType: "rate",
    category: "storformat",
    get image() { return getProductImage("skilte"); }
  },
  folie: {
    id: "folie",
    name: "Folie",
    slug: "folie",
    description: "Folie til vinduer og vægge i mat eller glans.",
    hasMatrixPricing: false,
    pricingType: "fixed",
    category: "storformat",
    get image() { return getProductImage("folie"); }
  },
  messeudstyr: {
    id: "messeudstyr",
    name: "Messeudstyr",
    slug: "messeudstyr",
    description: "Roll-ups, diske og messevægge til events.",
    hasMatrixPricing: false,
    pricingType: "fixed",
    category: "storformat",
    get image() { return getProductImage("messeudstyr"); }
  },
  displayplakater: {
    id: "displayplakater",
    name: "Displayplakater",
    slug: "displayplakater",
    description: "Store displayplakater til messestande og udstillinger.",
    hasMatrixPricing: false,
    pricingType: "fixed",
    category: "storformat",
    get image() { return getProductImage("displayplakater"); }
  }
};

export function getProductBySlug(slug: string): ProductMetadata | undefined {
  return Object.values(productMetadata).find(p => p.slug === slug);
}

export function getAllProducts(): ProductMetadata[] {
  return Object.values(productMetadata);
}

export function getProductsWithMatrixPricing(): ProductMetadata[] {
  return Object.values(productMetadata).filter(p => p.hasMatrixPricing);
}
