#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_RUN = path.resolve(
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z"
);

const SOURCE_CATEGORY_URL =
  "https://www.wir-machen-druck.de/adventskalender-guenstig-drucken,category,24057.html";

const VARIANTS = {
  "wall-landscape": {
    format: "Vægkalender, liggende – 404 × 527 mm",
    orientation: "Liggende",
    widthMm: 404,
    heightMm: 527,
  },
  "wall-portrait": {
    format: "Vægkalender, stående – 527 × 404 mm",
    orientation: "Stående",
    widthMm: 527,
    heightMm: 404,
  },
  "table-landscape": {
    format: "Bordkalender, liggende – 270 × 345 mm",
    orientation: "Liggende",
    widthMm: 270,
    heightMm: 345,
  },
  "table-portrait": {
    format: "Bordkalender, stående – 345 × 270 mm",
    orientation: "Stående",
    widthMm: 345,
    heightMm: 270,
  },
  celebrations: { filling: "Celebrations", widthMm: 412, heightMm: 307 },
  "kinder-mini-mix": { filling: "Kinder Mini Mix", widthMm: 412, heightMm: 307 },
  "milka-favourites": { filling: "Milka Favourites", widthMm: 412, heightMm: 307 },
  "merci-petits": { filling: "Merci Petits", widthMm: 412, heightMm: 307 },
  "toblerone-mix": { filling: "Toblerone Mix", widthMm: 412, heightMm: 307 },
  "lindt-hello-mini-sticks": { filling: "Lindt HELLO Mini Sticks", widthMm: 412, heightMm: 307 },
  "lindt-lindor-balls": { filling: "Lindt Lindor-kugler", widthMm: 412, heightMm: 307 },
  "ritter-sport-cubes": { filling: "Ritter Sport-chokoladeterninger", widthMm: 412, heightMm: 307 },
  "standard-portrait": {
    format: "Stående – 715 × 502 mm",
    orientation: "Stående",
    widthMm: 715,
    heightMm: 502,
  },
  "standard-landscape": {
    format: "Liggende – 502 × 715 mm",
    orientation: "Liggende",
    widthMm: 502,
    heightMm: 715,
  },
  "sustainable-portrait": {
    format: "Stående – 700 × 501 mm",
    orientation: "Stående",
    widthMm: 700,
    heightMm: 501,
  },
  "sustainable-landscape": {
    format: "Liggende – 501 × 700 mm",
    orientation: "Liggende",
    widthMm: 501,
    heightMm: 700,
  },
  "folding-boxes": { format: "720 × 356 mm", widthMm: 720, heightMm: 356 },
  klettinis: { filling: "Klettinis Naps", widthMm: 371, heightMm: 280 },
  sarotti: { filling: "Sarotti Naps", widthMm: 371, heightMm: 280 },
  "lindor-table": { filling: "Lindt Lindor Liliput", widthMm: 434, heightMm: 362 },
  "lindor-mix-table": { filling: "Lindt Lindor chokolademix", widthMm: 434, heightMm: 362 },
  "lindor-wall": { format: "228 × 167 mm", widthMm: 228, heightMm: 167 },
  "xmas-box": { format: "203 × 203 mm", widthMm: 203, heightMm: 203 },
  book: { format: "609 × 261 mm", widthMm: 609, heightMm: 261 },
  "beer-crate": { format: "591 × 494 mm", widthMm: 591, heightMm: 494 },
  "a4-landscape-2-page": {
    format: "A4 liggende, 2 sider",
    widthMm: 303,
    heightMm: 426,
  },
  "a5-landscape-4-page": {
    format: "A5 liggende, 4 sider",
    widthMm: 216,
    heightMm: 449,
  },
  classic: { format: "565 × 502 mm", widthMm: 565, heightMm: 502 },
};

const PRODUCTS = [
  {
    slug: "premium-vaegjulekalender",
    nameDa: "Premium vægjulekalender med chokolade",
    variants: ["wall-landscape", "wall-portrait"],
    descriptionDa:
      "Individuelt trykt vægjulekalender med 24 låger og mælkechokolade. Vælg liggende eller stående format og om hver kalender skal leveres i en separat forsendelseskarton.",
    groups: [
      group("format", "Format", "Format", "icon_grid", ["wall-landscape", "wall-portrait"]),
      fixedGroup("material", "Material", "Materiale", "260 g/m² CS1-karton"),
      {
        key: "packaging",
        labelOriginal: "Versandkarton",
        labelDa: "Forsendelseskarton",
        displayType: "buttons",
        values: [
          value("without-carton", "ohne Versandkarton", "Uden forsendelseskarton"),
          value("with-carton", "im Versandkarton", "Med forsendelseskarton"),
        ],
      },
    ],
    selections(row) {
      return {
        format: VARIANTS[row.variant].format,
        material: "260 g/m² CS1-karton",
        packaging: /im Versandkarton/i.test(row.material)
          ? "Med forsendelseskarton"
          : "Uden forsendelseskarton",
      };
    },
  },
  {
    slug: "premium-bordjulekalender",
    nameDa: "Premium bordjulekalender med chokolade",
    variants: ["table-landscape", "table-portrait"],
    descriptionDa:
      "Kompakt bordjulekalender med individuelt 4/0-farvet tryk, 24 låger og mælkechokolade. Vælg liggende eller stående udgave.",
    groups: [
      group("format", "Format", "Format", "icon_grid", ["table-landscape", "table-portrait"]),
      fixedGroup("material", "Material", "Materiale", "260 g/m² CS1-karton"),
    ],
    selections(row) {
      return { format: VARIANTS[row.variant].format, material: "260 g/m² CS1-karton" };
    },
  },
  {
    slug: "julekalender-multi",
    nameDa: "Julekalender Multi med mærkechokolade",
    variants: [
      "celebrations",
      "kinder-mini-mix",
      "milka-favourites",
      "merci-petits",
      "toblerone-mix",
      "lindt-hello-mini-sticks",
      "lindt-lindor-balls",
      "ritter-sport-cubes",
    ],
    descriptionDa:
      "Samme individuelt trykte kalenderkonstruktion i liggende format med 24 låger og et stabilt indlæg af presset genbrugspap. Vælg den ønskede mærkechokolade direkte i produktet; pris og korrekt trykskabelon følger valget.",
    groups: [
      fixedGroup("format", "Format", "Format", "412 × 307 mm"),
      fixedGroup("material", "Material", "Materiale", "300 g/m² GC1-karton"),
      group("filling", "Füllung", "Chokolade", "icon_grid", [
        "celebrations",
        "kinder-mini-mix",
        "milka-favourites",
        "merci-petits",
        "toblerone-mix",
        "lindt-hello-mini-sticks",
        "lindt-lindor-balls",
        "ritter-sport-cubes",
      ]),
    ],
    selections(row) {
      return {
        format: "412 × 307 mm",
        material: "300 g/m² GC1-karton",
        filling: VARIANTS[row.variant].filling,
      };
    },
  },
  {
    slug: "selvfyld-julekalender",
    nameDa: "Selvfyld-julekalender",
    variants: ["standard-portrait", "standard-landscape"],
    descriptionDa:
      "Individuelt trykt julekalender, som kunden selv fylder. Kalenderen har 24 rum i et formstøbt plastindlæg og fås i stående eller liggende format.",
    groups: [
      group("format", "Format", "Format", "icon_grid", ["standard-portrait", "standard-landscape"]),
      fixedGroup("material", "Material", "Materiale", "Cellulosekarton med plastindlæg"),
    ],
    selections(row) {
      return { format: VARIANTS[row.variant].format, material: "Cellulosekarton med plastindlæg" };
    },
  },
  {
    slug: "selvfyld-julekalender-papirbaseret",
    nameDa: "Papirbaseret selvfyld-julekalender",
    variants: ["sustainable-portrait", "sustainable-landscape"],
    descriptionDa:
      "Papirbaseret, individuelt trykt julekalender til egen fyldning med fiberstøbt indlæg. Vælg stående eller liggende format.",
    groups: [
      group("format", "Format", "Format", "icon_grid", ["sustainable-portrait", "sustainable-landscape"]),
      fixedGroup("material", "Material", "Materiale", "Cellulosekarton med fiberstøbt indlæg"),
    ],
    selections(row) {
      return { format: VARIANTS[row.variant].format, material: "Cellulosekarton med fiberstøbt indlæg" };
    },
  },
  singleProduct({
    slug: "julekalender-med-foldeaesker",
    nameDa: "Julekalender med 24 foldeæsker",
    variant: "folding-boxes",
    descriptionDa:
      "Individuelt trykt julekalender med 24 foruddefinerede foldeæsker, ophængshuller og støttefødder til bordplacering.",
    format: "720 × 356 mm",
    material: "300 g/m² GC1-karton",
  }),
  {
    slug: "bordjulekalender-med-naps",
    nameDa: "Bordjulekalender med chokoladenaps",
    variants: ["klettinis", "sarotti"],
    descriptionDa:
      "Individuelt trykt bordjulekalender med fiberstøbt indlæg, bordstøtte og ophængsmulighed. Vælg mellem to chokoladefyld.",
    groups: [
      fixedGroup("format", "Format", "Format", "371 × 280 mm"),
      fixedGroup("material", "Material", "Materiale", "280 g/m² Incada Silk FSC-karton"),
      group("filling", "Füllung", "Chokolade", "icon_grid", ["klettinis", "sarotti"]),
    ],
    selections(row) {
      return {
        format: "371 × 280 mm",
        material: "280 g/m² Incada Silk FSC-karton",
        filling: VARIANTS[row.variant].filling,
      };
    },
  },
  {
    slug: "lindt-lindor-bordjulekalender",
    nameDa: "Lindt Lindor bordjulekalender",
    variants: ["lindor-table", "lindor-mix-table"],
    descriptionDa:
      "Individuelt trykt bordjulekalender med 24 låger, kartonindlæg og Lindt Lindor. Vælg den ønskede Lindor-blanding direkte i produktet.",
    groups: [
      fixedGroup("format", "Format", "Format", "434 × 362 mm"),
      fixedGroup("material", "Material", "Materiale", "300 g/m² GC1-karton"),
      group("filling", "Füllung", "Chokolade", "icon_grid", ["lindor-table", "lindor-mix-table"]),
    ],
    selections(row) {
      return {
        format: "434 × 362 mm",
        material: "300 g/m² GC1-karton",
        filling: VARIANTS[row.variant].filling,
      };
    },
  },
  singleProduct({
    slug: "lindt-lindor-vaegjulekalender",
    nameDa: "Lindt Lindor vægjulekalender",
    variant: "lindor-wall",
    descriptionDa:
      "Kompakt, individuelt trykt vægjulekalender med 24 Lindt Lindor Liliput-praliner i blandede varianter.",
    format: "228 × 167 mm",
    material: "300 g/m² GC1-karton",
  }),
  singleProduct({
    slug: "lindt-xmas-box",
    nameDa: "Lindt X-Mas Box",
    variant: "xmas-box",
    descriptionDa:
      "Julekalender i en hængslet hvidblikdåse med individuelt 4/0-farvet tryk på låget og 24 Lindt Lindor-kugler.",
    format: "203 × 203 mm",
    material: "Hvidblikdåse med trykt låg",
  }),
  singleProduct({
    slug: "lindt-julekalenderbog",
    nameDa: "Lindt julekalenderbog",
    variant: "book",
    descriptionDa:
      "Individuelt trykt julekalender udformet som en bog, der åbnes, med 24 Lindor Mini-kugler og kartonindlæg.",
    format: "609 × 261 mm",
    material: "350 g/m² GC1-karton",
  }),
  singleProduct({
    slug: "oelkasse-julekalender",
    nameDa: "Ølkasse-julekalender",
    variant: "beer-crate",
    descriptionDa:
      "Individuelt trykt julekalender til en ølkasse. Leveres i ét stykke, stanset, falset og limet; øl medfølger ikke.",
    format: "591 × 494 mm",
    material: "300 g/m² GC1-karton",
  }),
  {
    slug: "kuponjulekalender",
    nameDa: "Kuponjulekalender",
    variants: ["a4-landscape-2-page", "a5-landscape-4-page"],
    descriptionDa:
      "Trykt kuponjulekalender med 24 perforerede låger. Vælg A4 liggende med 2 sider eller A5 liggende med 4 sider.",
    groups: [
      group("format", "Format und Seiten", "Format og sider", "icon_grid", [
        "a4-landscape-2-page",
        "a5-landscape-4-page",
      ]),
      fixedGroup("material", "Material", "Materiale", "300 g/m² mat kvalitetstryk"),
    ],
    selections(row) {
      return { format: VARIANTS[row.variant].format, material: "300 g/m² mat kvalitetstryk" };
    },
  },
  singleProduct({
    slug: "ritter-sport-julekalender-klassisk",
    nameDa: "Ritter Sport julekalender – klassisk",
    variant: "classic",
    descriptionDa:
      "Stor, individuelt trykt julekalender med 24 Ritter Sport-chokoladeterninger og en separat klassisk konstruktion.",
    format: "565 × 502 mm",
    material: "350 g/m² GC1-karton",
  }),
];

function parseArgs(argv) {
  const args = { run: DEFAULT_RUN };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--run") args.run = path.resolve(argv[++index]);
    else if (argv[index] === "--help") {
      console.log("Usage: node build-wmd-advent-calendar-packages.js [--run DIR]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function value(key, labelOriginal, labelDa) {
  return { key, labelOriginal, labelDa };
}

function variantLabel(variant) {
  return VARIANTS[variant].format || VARIANTS[variant].filling || variant;
}

function group(key, labelOriginal, labelDa, displayType, variants) {
  return {
    key,
    labelOriginal,
    labelDa,
    displayType,
    values: variants.map((variant) => value(variant, variantLabel(variant), variantLabel(variant))),
  };
}

function fixedGroup(key, labelOriginal, labelDa, label) {
  return {
    key,
    labelOriginal,
    labelDa,
    displayType: "buttons",
    values: [value(label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label, label)],
  };
}

function singleProduct({ slug, nameDa, variant, descriptionDa, format, material }) {
  return {
    slug,
    nameDa,
    variants: [variant],
    descriptionDa,
    groups: [
      fixedGroup("format", "Format", "Format", format),
      fixedGroup("material", "Material", "Materiale", material),
    ],
    selections() {
      return { format, material };
    },
  };
}

function cleanFilePart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseJsonl(content) {
  return content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function findDocument(meta, labelPattern) {
  return meta.documents.find(
    (document) => labelPattern.test(document.label) && /\.pdf(?:$|\?)/i.test(document.url)
  );
}

function addSourceOrder(groups, catalogByVariant, slug) {
  return groups.map((groupSpec, groupIndex) => ({
    ...groupSpec,
    sourceOrder: groupIndex,
    values: groupSpec.values.map((item, valueIndex) => {
      const sourceVariant = item.key in VARIANTS ? item.key : null;
      const referenceUrl = sourceVariant
        ? catalogByVariant.get(sourceVariant)?.images?.[0]?.url
        : catalogByVariant.values().next().value?.images?.[0]?.url;
      const base = { ...item, sourceOrder: valueIndex };
      if (groupSpec.displayType !== "icon_grid") return base;
      if (!referenceUrl) throw new Error(`Missing reference image for ${slug}/${groupSpec.key}/${item.key}`);
      const usesTransparentCalendarCutout = slug === "julekalender-multi" && groupSpec.key === "filling";
      return {
        ...base,
        icon: {
          referenceUrl,
          generatedAssetPath: `visual/${cleanFilePart(groupSpec.key)}-${cleanFilePart(item.key)}${usesTransparentCalendarCutout ? "-transparent" : ""}.png`,
          styleKey: "soft_3d",
          transparent: true,
          supplierBrandingRemoved: true,
        },
      };
    }),
  }));
}

function documentPair(meta, productSlug) {
  const guide = findDocument(meta, /^Datenblatt \(zur freien Verwendung\)$/i);
  const template = findDocument(meta, /^Druckvorlage \(zur freien Verwendung\)$/i);
  if (!guide || !template) throw new Error(`Missing exact PDF pair for ${meta.variant}`);
  const dimensions = VARIANTS[meta.variant];
  const match = { configuration: meta.variant };
  if (dimensions.format) match.format = dimensions.format;
  if (dimensions.orientation) match.orientation = dimensions.orientation;
  if (dimensions.filling) match.filling = dimensions.filling;
  return {
    key: meta.variant,
    match,
    guide: {
      sourceUrl: guide.url,
      nativeGuideKey: `${meta.variant}-data-sheet`,
      factsReviewed: false,
    },
    template: {
      sourceUrl: template.url,
      sanitizedPdfPath: `documents/${productSlug}-${meta.variant}-tryk-skabelon.pdf`,
      designerTemplateId: null,
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
      bleedMm: 0,
      safeMm: 2,
      metadataRemoved: false,
      supplierBrandingRemoved: false,
      nonPrintingOverlay: false,
      excludedFromExport: false,
    },
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(await fs.readFile(path.join(args.run, "raw/catalog.json"), "utf8"));
  const normalizedRows = parseJsonl(
    await fs.readFile(path.join(args.run, "normalized/pricing-preview.jsonl"), "utf8")
  );
  const discovery = JSON.parse(await fs.readFile(path.join(args.run, "discovery.json"), "utf8"));
  const catalogByVariant = new Map(catalog.map((item) => [item.variant, item]));
  const familyRoot = path.join(args.run, "families");
  const indexRows = [];

  for (const product of PRODUCTS) {
    const productDir = path.join(familyRoot, product.slug);
    await Promise.all([
      fs.mkdir(path.join(productDir, "raw"), { recursive: true }),
      fs.mkdir(path.join(productDir, "normalized"), { recursive: true }),
      fs.mkdir(path.join(productDir, "visual"), { recursive: true }),
      fs.mkdir(path.join(productDir, "documents"), { recursive: true }),
      fs.mkdir(path.join(productDir, "review"), { recursive: true }),
    ]);
    const sourceProducts = product.variants.map((variant) => catalogByVariant.get(variant));
    if (sourceProducts.some((item) => !item)) throw new Error(`Missing catalog variant in ${product.slug}`);
    const variantSet = new Set(product.variants);
    const prices = normalizedRows.filter((row) => variantSet.has(row.variant));
    const pricingRecords = prices.map((row, sourceOrder) => ({
      sourceOrder,
      quantity: row.quantity,
      supplierPrice: row.supplierNetPriceEur,
      convertedPriceDkk: row.convertedPriceDkk,
      finalPriceDkk: row.finalPriceDkk,
      sourceUrl: row.sourceUrl,
      selections: product.selections(row),
      evidence: {
        sourceProductId: row.sourceProductId,
        sourceSku: row.sourceSku,
        sourceMaterialId: row.materialId,
        sourceQuantityOptionId: row.quantityOptionId,
        supplierListPriceEur: row.supplierListPriceEur,
        supplierDiscountEur: row.supplierDiscountEur,
        promotion: row.promotion,
        capturedAt: row.capturedAt,
      },
    }));
    const documents = sourceProducts.map((meta) => documentPair(meta, product.slug));
    const manifest = {
      schemaVersion: 1,
      runId: `${path.basename(args.run)}-${product.slug}`,
      source: {
        supplierSlug: "wir-machen-druck",
        entryUrl: SOURCE_CATEGORY_URL,
        scopeMode: "single_product_family",
        allowedHosts: ["www.wir-machen-druck.de"],
        extractor: "playwright_adapter",
        capturedAt: discovery.capturedAt,
      },
      product: {
        sourceKey: `wmd-advent-${product.slug}`,
        family: "packaging",
        slugDa: product.slug,
        nameOriginal: sourceProducts.map((item) => item.name).join(" / "),
        nameDa: product.nameDa,
        descriptionOriginal: sourceProducts.map((item) => item.sourceDescription).filter(Boolean).join("\n\n"),
        descriptionDa: product.descriptionDa,
        sourceLanguage: "de",
        targetLanguage: "da",
      },
      optionGroups: addSourceOrder(product.groups, catalogByVariant, product.slug),
      pricing: {
        supplierCurrency: "EUR",
        vatState: "excluded",
        conversionRuleKey: "wmd_tiered_fx_7_6",
        records: pricingRecords,
      },
      documents,
      storefront: {
        category: "tryksager",
        pricingType: "matrix",
        isPublished: false,
        isAvailableToTenants: true,
      },
      target: {
        mode: "supplier_bank",
        state: "extracted",
        publishProduct: false,
        writeLivePricing: false,
      },
      artifacts: {
        rawSnapshot: "raw/source.json",
        normalizedPricing: "normalized/pricing.jsonl",
        reviewReport: "review/report.md",
      },
    };

    await Promise.all([
      writeJson(path.join(productDir, "import-manifest.json"), manifest),
      writeJson(path.join(productDir, "raw/source.json"), sourceProducts),
      fs.writeFile(
        path.join(productDir, "normalized/pricing.jsonl"),
        `${pricingRecords.map((row) => JSON.stringify(row)).join("\n")}\n`,
        "utf8"
      ),
      fs.writeFile(
        path.join(productDir, "review/report.md"),
        [
          `# ${product.nameDa}`,
          "",
          "- Tilstand: `extracted`.",
          `- Kildekonfigurationer: ${product.variants.length}.`,
          `- Prisrækker: ${pricingRecords.length}.`,
          `- Eksakte dokumentpar: ${documents.length}.`,
          "- Produktet skal oprettes som upubliceret Webprinter-kladde.",
          "- PDF- og billedflag er med vilje ikke godkendt før den visuelle inspektion.",
          "",
        ].join("\n"),
        "utf8"
      ),
    ]);
    indexRows.push({
      slug: product.slug,
      nameDa: product.nameDa,
      variants: product.variants,
      priceRows: pricingRecords.length,
      documents: documents.length,
      state: "extracted",
    });
  }

  await writeJson(path.join(familyRoot, "index.json"), {
    schemaVersion: 1,
    sourceCategoryUrl: SOURCE_CATEGORY_URL,
    capturedAt: discovery.capturedAt,
    productCount: indexRows.length,
    sourceConfiguratorCount: indexRows.reduce((sum, item) => sum + item.variants.length, 0),
    priceRowCount: indexRows.reduce((sum, item) => sum + item.priceRows, 0),
    products: indexRows,
  });

  console.log(`Product packages: ${indexRows.length}`);
  console.log(`Source configurators: ${indexRows.reduce((sum, item) => sum + item.variants.length, 0)}`);
  console.log(`Price rows: ${indexRows.reduce((sum, item) => sum + item.priceRows, 0)}`);
  console.log(`Package root: ${familyRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
