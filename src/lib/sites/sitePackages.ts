export type SiteTemplateType = 'format' | 'material' | 'finish' | 'product';

export interface SiteSeedFormat {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  bleedMm?: number;
  safeAreaMm?: number;
  description?: string;
}

export interface SiteSeedLibraryItem {
  id: string;
  name: string;
  templateType: SiteTemplateType;
  description?: string;
  category?: string;
  weightGsm?: number;
}

export interface SitePackage {
  id: string;
  name: string;
  repoUrl: string;
  description: string;
  recommendedThemeId?: string;
  tags: string[];
  seedFormats: SiteSeedFormat[];
  seedLibraryItems: SiteSeedLibraryItem[];
}

const SHARED_TAGS = ['shared-backend', 'webprinter-checkout'];

export const SITE_PACKAGES: SitePackage[] = [
  {
    id: 'print-pop',
    name: 'Print Pop',
    repoUrl: 'https://github.com/comboworks-ops/print-pop',
    description: 'Starter facade scaffold from Lovable. Ready to map into WebPrinter when product data is added.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'starter'],
    seedFormats: [],
    seedLibraryItems: [],
  },
  {
    id: 'banner-builder-pro',
    name: 'Banner Builder Pro',
    repoUrl: 'https://github.com/comboworks-ops/banner-builder-pro',
    description: 'Storformat banner configurator with per-meter and per-area finishing logic.',
    recommendedThemeId: 'glassmorphism',
    tags: [...SHARED_TAGS, 'storformat', 'banners'],
    seedFormats: [
      { id: 'pvc-banner-200x100', name: 'PVC Banner 200x100 cm', widthMm: 2000, heightMm: 1000 },
      { id: 'mesh-banner-200x100', name: 'Mesh Banner 200x100 cm', widthMm: 2000, heightMm: 1000 },
      { id: 'textile-banner-200x100', name: 'Tekstil Banner 200x100 cm', widthMm: 2000, heightMm: 1000 },
      { id: 'window-foil-100x70', name: 'Vinduesfolie 100x70 cm', widthMm: 1000, heightMm: 700 },
      { id: 'poster-large-70x100', name: 'Storformat Plakat 70x100 cm', widthMm: 700, heightMm: 1000 },
    ],
    seedLibraryItems: [
      { id: 'grommets', name: 'Oejer / Ringe', templateType: 'finish', description: 'Metaloejer hver 50 cm' },
      { id: 'hemming', name: 'Kantforsegling / Soem', templateType: 'finish', description: 'Svejst kant hele vejen rundt' },
      { id: 'pockets', name: 'Lommer', templateType: 'finish', description: 'Tunnellomme top/bund til keder' },
      { id: 'keder', name: 'Keder', templateType: 'finish', description: 'Keder til spaendrammer' },
      { id: 'double-sided', name: 'Dobbeltsidet tryk', templateType: 'finish' },
      { id: 'uv-laminate', name: 'UV-laminering', templateType: 'finish' },
      { id: 'pvc-banner', name: 'PVC Banner', templateType: 'product' },
      { id: 'mesh-banner', name: 'Mesh Banner', templateType: 'product' },
      { id: 'textile-banner', name: 'Tekstil Banner', templateType: 'product' },
      { id: 'window-foil', name: 'Vinduesfolie', templateType: 'product' },
      { id: 'cutout-letters', name: 'Udskaarne Bogstaver', templateType: 'product' },
      { id: 'poster-large', name: 'Storformat Plakat', templateType: 'product' },
      { id: 'mat-pvc-510', name: 'PVC 510 g/m2', templateType: 'material', weightGsm: 510 },
      { id: 'mesh-330', name: 'Mesh 330 g/m2', templateType: 'material', weightGsm: 330 },
      { id: 'textile-220', name: 'Tekstil 220 g/m2', templateType: 'material', weightGsm: 220 },
    ],
  },
  {
    id: 'vibe-tees',
    name: 'Vibe Tees',
    repoUrl: 'https://github.com/comboworks-ops/vibe-tees',
    description: 'Starter facade scaffold for apparel flows. Product mappings can be installed as they are added.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'starter', 'apparel'],
    seedFormats: [],
    seedLibraryItems: [],
  },
  {
    id: 'tee-design-hub',
    name: 'Tee Design Hub',
    repoUrl: 'https://github.com/comboworks-ops/tee-design-hub',
    description: 'Apparel storefront and t-shirt designer with print-method pricing add-ons.',
    recommendedThemeId: 'glassmorphism',
    tags: [...SHARED_TAGS, 'apparel', 'designer'],
    seedFormats: [
      { id: 'tee-front-30x40', name: 'T-shirt fronttryk 30x40 cm', widthMm: 300, heightMm: 400 },
      { id: 'tee-back-30x40', name: 'T-shirt rygtryk 30x40 cm', widthMm: 300, heightMm: 400 },
      { id: 'tee-sleeve-10x30', name: 'Aermetryk 10x30 cm', widthMm: 100, heightMm: 300 },
      { id: 'hoodie-front-35x45', name: 'Hoodie fronttryk 35x45 cm', widthMm: 350, heightMm: 450 },
    ],
    seedLibraryItems: [
      { id: 'silketryk', name: 'Silketryk', templateType: 'finish' },
      { id: 'dtg', name: 'DTG print', templateType: 'finish' },
      { id: 'sublimation', name: 'Sublimation', templateType: 'finish' },
      { id: 'broderi', name: 'Broderi', templateType: 'finish' },
      { id: 'classic-crew', name: 'Classic Crew T-shirt', templateType: 'product' },
      { id: 'vneck-premium', name: 'Premium V-neck', templateType: 'product' },
      { id: 'organic-tee', name: 'Organic Cotton Tee', templateType: 'product' },
      { id: 'performance-sport', name: 'Performance Sport', templateType: 'product' },
      { id: 'oversize-street', name: 'Oversize Street', templateType: 'product' },
      { id: 'polo-business', name: 'Polo Business', templateType: 'product' },
      { id: 'hoodie-classic', name: 'Hoodie Classic', templateType: 'product' },
      { id: 'sweatshirt-crew', name: 'Sweatshirt Crew', templateType: 'product' },
      { id: 'cotton-180', name: 'Bomuld 180 g/m2', templateType: 'material', weightGsm: 180 },
      { id: 'cotton-240', name: 'Heavyweight bomuld 240 g/m2', templateType: 'material', weightGsm: 240 },
      { id: 'poly-135', name: 'Polyester 135 g/m2', templateType: 'material', weightGsm: 135 },
    ],
  },
  {
    id: 'print-playground',
    name: 'Print Playground',
    repoUrl: 'https://github.com/comboworks-ops/print-playground',
    description: 'General print storefront with configurable options per product type.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'mixed-catalog'],
    seedFormats: [
      { id: 'a6', name: 'A6', widthMm: 105, heightMm: 148 },
      { id: 'a5', name: 'A5', widthMm: 148, heightMm: 210 },
      { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 },
      { id: 'a3', name: 'A3', widthMm: 297, heightMm: 420 },
      { id: 'a2', name: 'A2', widthMm: 420, heightMm: 594 },
      { id: 'a1', name: 'A1', widthMm: 594, heightMm: 841 },
      { id: 'dl', name: 'DL', widthMm: 99, heightMm: 210 },
      { id: 'b2', name: 'B2', widthMm: 500, heightMm: 707 },
      { id: 'banner-200x100', name: 'Banner 200x100 cm', widthMm: 2000, heightMm: 1000 },
    ],
    seedLibraryItems: [
      { id: 'flyers', name: 'Flyers', templateType: 'product' },
      { id: 'foldere', name: 'Foldere', templateType: 'product' },
      { id: 'plakater', name: 'Plakater', templateType: 'product' },
      { id: 'bannere', name: 'Bannere', templateType: 'product' },
      { id: 'visitkort', name: 'Visitkort', templateType: 'product' },
      { id: 'tekstiltryk', name: 'Tekstiltryk', templateType: 'product' },
      { id: 'fals-2', name: '2-fals', templateType: 'finish' },
      { id: 'fals-3', name: '3-fals', templateType: 'finish' },
      { id: 'fals-zigzag', name: 'Zigzag fals', templateType: 'finish' },
      { id: 'tryk-enkel', name: 'Enkeltsidet tryk', templateType: 'finish' },
      { id: 'tryk-dobbelt', name: 'Dobbeltsidet tryk', templateType: 'finish' },
      { id: 'finish-oeskner', name: 'Oeskner', templateType: 'finish' },
      { id: 'finish-tunnel', name: 'Tunnelsoem', templateType: 'finish' },
      { id: 'paper-170-mat', name: '170g mat', templateType: 'material', weightGsm: 170 },
      { id: 'paper-250-mat', name: '250g mat', templateType: 'material', weightGsm: 250 },
      { id: 'paper-350-mat', name: '350g mat', templateType: 'material', weightGsm: 350 },
      { id: 'paper-350-blank', name: '350g blank laminering', templateType: 'material', weightGsm: 350 },
      { id: 'paper-400-premium', name: '400g premium', templateType: 'material', weightGsm: 400 },
    ],
  },
  {
    id: 'art-canvas-studio',
    name: 'Art Canvas Studio',
    repoUrl: 'https://github.com/comboworks-ops/art-canvas-studio',
    description: 'Poster shop with fixed art formats and framing finish options.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'posters', 'frames'],
    seedFormats: [
      { id: '21x30', name: '21x30 cm', widthMm: 210, heightMm: 300 },
      { id: '30x40', name: '30x40 cm', widthMm: 300, heightMm: 400 },
      { id: '50x70', name: '50x70 cm', widthMm: 500, heightMm: 700 },
      { id: '70x100', name: '70x100 cm', widthMm: 700, heightMm: 1000 },
      { id: '100x150', name: '100x150 cm', widthMm: 1000, heightMm: 1500 },
    ],
    seedLibraryItems: [
      { id: 'frame-none', name: 'No Frame', templateType: 'finish' },
      { id: 'frame-black', name: 'Black Wood Frame', templateType: 'finish' },
      { id: 'frame-white', name: 'White Wood Frame', templateType: 'finish' },
      { id: 'frame-oak', name: 'Natural Oak Frame', templateType: 'finish' },
      { id: 'poster-abstract', name: 'Poster Abstract', templateType: 'product' },
      { id: 'poster-botanical', name: 'Poster Botanical', templateType: 'product' },
      { id: 'poster-typography', name: 'Poster Typography', templateType: 'product' },
      { id: 'poster-landscape', name: 'Poster Landscape', templateType: 'product' },
      { id: 'poster-minimal', name: 'Poster Minimal', templateType: 'product' },
      { id: 'paper-fineart-200', name: 'Fine Art papir 200 g/m2', templateType: 'material', weightGsm: 200 },
    ],
  },
  {
    id: 'shopfront-designer',
    name: 'Shopfront Designer',
    repoUrl: 'https://github.com/comboworks-ops/shopfront-designer',
    description: 'Facade design planner for signs, foils and banner products priced by area.',
    recommendedThemeId: 'glassmorphism',
    tags: [...SHARED_TAGS, 'facade', 'signage'],
    seedFormats: [
      { id: 'sign-alu-200x60', name: 'Aluskilt 200x60 cm', widthMm: 2000, heightMm: 600 },
      { id: 'sign-acrylic-180x50', name: 'Akrylskilt 180x50 cm', widthMm: 1800, heightMm: 500 },
      { id: 'window-foil-150x120', name: 'Vinduesfolie 150x120 cm', widthMm: 1500, heightMm: 1200 },
      { id: 'frost-foil-150x80', name: 'Frostfolie 150x80 cm', widthMm: 1500, heightMm: 800 },
      { id: 'cut-foil-120x30', name: 'Udskaaret folie 120x30 cm', widthMm: 1200, heightMm: 300 },
      { id: 'road-sign-60x100', name: 'A-skilt 60x100 cm', widthMm: 600, heightMm: 1000 },
      { id: 'banner-200x80', name: 'Banner 200x80 cm', widthMm: 2000, heightMm: 800 },
    ],
    seedLibraryItems: [
      { id: 'sign-alu', name: 'Aluskilt', templateType: 'product' },
      { id: 'sign-acrylic', name: 'Akrylskilt', templateType: 'product' },
      { id: 'window-foil-full', name: 'Vinduesfolie (hel)', templateType: 'product' },
      { id: 'window-foil-frosted', name: 'Frostfolie', templateType: 'product' },
      { id: 'cut-foil', name: 'Udskaaret folie', templateType: 'product' },
      { id: 'road-sign', name: 'Gadeskilt / A-skilt', templateType: 'product' },
      { id: 'banner', name: 'Banner', templateType: 'product' },
      { id: 'finish-uv', name: 'UV-print', templateType: 'finish' },
      { id: 'finish-led', name: 'LED gennemlysning', templateType: 'finish' },
      { id: 'finish-oeskner', name: 'Oeskner', templateType: 'finish' },
    ],
  },
  {
    id: 'vibe-prints-co',
    name: 'Vibe Prints Co',
    repoUrl: 'https://github.com/comboworks-ops/vibe-prints-co.',
    description: 'Street-style print shop with posters, stickers and apparel products.',
    recommendedThemeId: 'glassmorphism',
    tags: [...SHARED_TAGS, 'streetwear', 'mixed-catalog'],
    seedFormats: [
      { id: 'poster-a1', name: 'Poster A1', widthMm: 594, heightMm: 841 },
      { id: 'poster-a2', name: 'Poster A2', widthMm: 420, heightMm: 594 },
      { id: 'poster-a3', name: 'Poster A3', widthMm: 297, heightMm: 420 },
      { id: 'sticker-10x10', name: 'Sticker 10x10 cm', widthMm: 100, heightMm: 100 },
      { id: 'tee-front-30x40', name: 'T-shirt fronttryk 30x40 cm', widthMm: 300, heightMm: 400 },
      { id: 'hoodie-front-35x45', name: 'Hoodie fronttryk 35x45 cm', widthMm: 350, heightMm: 450 },
    ],
    seedLibraryItems: [
      { id: 'poster', name: 'Posters', templateType: 'product' },
      { id: 'stickers', name: 'Stickers', templateType: 'product' },
      { id: 'tshirts', name: 'T-shirts', templateType: 'product' },
      { id: 'merch', name: 'Merch', templateType: 'product' },
      { id: 'finish-diecut', name: 'Vinyl die-cut', templateType: 'finish' },
      { id: 'finish-embossed', name: 'Embossed detail', templateType: 'finish' },
      { id: 'material-vinyl', name: 'Vinyl sticker materiale', templateType: 'material' },
      { id: 'material-cotton', name: 'Bomuld tekstil', templateType: 'material', weightGsm: 180 },
    ],
  },
  {
    id: 'learning-landscapes-shop',
    name: 'Learning Landscapes Shop',
    repoUrl: 'https://github.com/comboworks-ops/learning-landscapes-shop',
    description: 'Educational print products with large-floor graphics, boards and classroom kits.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'education', 'large-format'],
    seedFormats: [
      { id: 'floor-map-200x150', name: 'Gulvkort 200x150 cm', widthMm: 2000, heightMm: 1500 },
      { id: 'floor-map-300x200', name: 'Gulvkort 300x200 cm', widthMm: 3000, heightMm: 2000 },
      { id: 'floor-map-400x300', name: 'Gulvkort 400x300 cm', widthMm: 4000, heightMm: 3000 },
      { id: 'a2-board', name: 'Laeringstavle A2', widthMm: 420, heightMm: 594 },
      { id: 'a1-board', name: 'Laeringstavle A1', widthMm: 594, heightMm: 841 },
      { id: 'a0-board', name: 'Laeringstavle A0', widthMm: 841, heightMm: 1189 },
      { id: 'board-60x80', name: 'Taltavle 60x80 cm', widthMm: 600, heightMm: 800 },
      { id: 'board-80x100', name: 'Taltavle 80x100 cm', widthMm: 800, heightMm: 1000 },
    ],
    seedLibraryItems: [
      { id: 'gulvkort', name: 'Gulvkort', templateType: 'product' },
      { id: 'laeringstavler', name: 'Laeringstavler', templateType: 'product' },
      { id: 'edutainment', name: 'Edutainment Spil', templateType: 'product' },
      { id: 'vaeggrafikker', name: 'Vaeggrafikker', templateType: 'product' },
      { id: 'finish-skridsikker', name: 'Skridsikker overflade', templateType: 'finish' },
      { id: 'finish-mat', name: 'Mat finish', templateType: 'finish' },
      { id: 'finish-repositionerbar', name: 'Repositionerbar montage', templateType: 'finish' },
      { id: 'material-vinyl-lam', name: 'Premium vinyl med laminat', templateType: 'material' },
      { id: 'material-karton-350', name: '350g karton', templateType: 'material', weightGsm: 350 },
      { id: 'material-magnet', name: 'Magnetisk staalplade', templateType: 'material' },
    ],
  },
  {
    id: 'snap-cherish',
    name: 'Snap Cherish',
    repoUrl: 'https://github.com/comboworks-ops/snap-cherish',
    description: 'Photo-product storefront with photobooks, posters, stickers and mugs.',
    recommendedThemeId: 'classic',
    tags: [...SHARED_TAGS, 'photo-products'],
    seedFormats: [
      { id: 'photobook-a4', name: 'Fotobog A4', widthMm: 210, heightMm: 297 },
      { id: 'poster-a2', name: 'Plakat A2', widthMm: 420, heightMm: 594 },
      { id: 'sticker-30x30', name: 'Gulv-sticker 30x30 cm', widthMm: 300, heightMm: 300 },
      { id: 'wall-sticker-40x40', name: 'Wall sticker 40x40 cm', widthMm: 400, heightMm: 400 },
      { id: 'mug-wrap', name: 'Fotokop ombrydningsfelt 21x9 cm', widthMm: 210, heightMm: 90 },
    ],
    seedLibraryItems: [
      { id: 'photobook', name: 'Fotoboeger', templateType: 'product' },
      { id: 'poster', name: 'Plakater', templateType: 'product' },
      { id: 'floor-sticker', name: 'Gulv-klistermaerker', templateType: 'product' },
      { id: 'wall-sticker', name: 'Inspirations-stickers', templateType: 'product' },
      { id: 'photo-mug', name: 'Fotokopper', templateType: 'product' },
      { id: 'finish-mat-lam', name: 'Mat laminering', templateType: 'finish' },
      { id: 'finish-waterproof', name: 'Vandtaet coating', templateType: 'finish' },
      { id: 'finish-ceramic', name: 'Keramisk transfer print', templateType: 'finish' },
      { id: 'material-photo-200', name: 'Fotopapir 200 g/m2', templateType: 'material', weightGsm: 200 },
      { id: 'material-vinyl', name: 'Vinyl sticker materiale', templateType: 'material' },
      { id: 'material-ceramic', name: 'Keramisk krus basis', templateType: 'material' },
    ],
  },
];

export const SITE_PACKAGE_MAP = SITE_PACKAGES.reduce<Record<string, SitePackage>>((acc, sitePackage) => {
  acc[sitePackage.id] = sitePackage;
  return acc;
}, {});
