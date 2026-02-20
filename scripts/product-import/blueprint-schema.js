import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";

export const DEFAULT_TIERS = [
  { max_dkk_base: 3000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
];

export const DEFAULT_TECHNICAL_SPECS = {
  width_mm: 210,
  height_mm: 297,
  bleed_mm: 3,
  min_dpi: 300,
  is_free_form: false,
  standard_format: "A4",
};

const tierSchema = z
  .object({
    max_dkk_base: z.number().positive().optional(),
    multiplier: z.number().positive(),
  })
  .strict();

const urlString = z.string().url();

const imageUrlSchema = z.union([urlString, z.literal(""), z.null()]).optional();

const formatOrMaterialSchema = z
  .object({
    group_name: z.string().min(1),
    value_name: z.string().min(1),
    width_mm: z.number().positive().optional(),
    height_mm: z.number().positive().optional(),
    image_url: imageUrlSchema,
  })
  .strict();

const blueprintSchema = z
  .object({
    version: z.literal(1),
    tenant_id: z.string().uuid(),
    product: z
      .object({
        name: z.string().min(1),
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        description: z.string().default(""),
        category: z.enum(["tryksager", "storformat"]),
        preset_key: z.string().default("custom"),
        icon_text: z.string().min(1).optional(),
        image_url: imageUrlSchema,
        technical_specs: z
          .object({
            width_mm: z.number().positive(),
            height_mm: z.number().positive(),
            bleed_mm: z.number().nonnegative().default(3),
            min_dpi: z.number().positive().default(300),
            is_free_form: z.boolean().default(false),
            standard_format: z.string().min(1).default("A4"),
          })
          .strict()
          .default(DEFAULT_TECHNICAL_SPECS),
      })
      .strict(),
    matrix: z
      .object({
        vertical_axis: z.enum(["materials", "formats"]).default("materials"),
        format: formatOrMaterialSchema
          .extend({
            group_name: z.string().min(1).default("Format"),
          })
          .strict(),
        material: formatOrMaterialSchema
          .extend({
            group_name: z.string().min(1).default("Materiale"),
            width_mm: z.number().positive().optional(),
            height_mm: z.number().positive().optional(),
          })
          .strict(),
      })
      .strict(),
    pricing_import: z
      .object({
        type: z.literal("ul_prices"),
        url: z.string().url(),
        ul_selector: z.string().min(1),
        eur_to_dkk: z.number().positive().default(7.5),
        rounding_step: z.number().positive().default(1),
        default_quantity_start: z.number().int().positive().default(1),
        default_quantity_step: z.number().int().positive().default(1),
        tiers: z.array(tierSchema).min(1).default(DEFAULT_TIERS),
      })
      .strict(),
  })
  .strict();

function validateTierOrdering(tiers) {
  let lastMax = -Infinity;

  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i];
    if (tier.max_dkk_base == null) {
      if (i !== tiers.length - 1) {
        throw new Error("tiers without max_dkk_base must be the last tier");
      }
      continue;
    }

    if (tier.max_dkk_base < lastMax) {
      throw new Error("tiers.max_dkk_base must be sorted ascending");
    }
    lastMax = tier.max_dkk_base;
  }
}

export function parseBlueprintObject(input) {
  const parsed = blueprintSchema.parse(input);
  validateTierOrdering(parsed.pricing_import.tiers);

  return {
    ...parsed,
    product: {
      ...parsed.product,
      icon_text: parsed.product.icon_text || parsed.product.name,
      image_url: parsed.product.image_url || null,
      technical_specs: {
        ...DEFAULT_TECHNICAL_SPECS,
        ...parsed.product.technical_specs,
      },
    },
    matrix: {
      ...parsed.matrix,
      format: {
        ...parsed.matrix.format,
        image_url: parsed.matrix.format.image_url || null,
      },
      material: {
        ...parsed.matrix.material,
        image_url: parsed.matrix.material.image_url || null,
      },
    },
  };
}

export function loadBlueprintFile(filePath) {
  const resolved = path.resolve(filePath);
  const text = fs.readFileSync(resolved, "utf8");
  const loaded = yaml.load(text);

  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error("Blueprint root must be a YAML object");
  }

  return {
    blueprint: parseBlueprintObject(loaded),
    filePath: resolved,
  };
}
