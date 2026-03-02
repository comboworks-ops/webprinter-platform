/**
 * T-shirt size distribution lock config.
 * Scope is intentionally limited to t-shirt import flows.
 */

export const TSHIRT_SIZE_DISTRIBUTION_LOCK = Object.freeze({
  enabled: true,
  title: "Størrelsesfordeling",
  enforce_quantity_match: true,
  fields: Object.freeze([
    Object.freeze({ key: "small", label: "Small" }),
    Object.freeze({ key: "medium", label: "Medium" }),
    Object.freeze({ key: "large", label: "Large" }),
    Object.freeze({ key: "xl", label: "XL" }),
    Object.freeze({ key: "2xl", label: "2XL" }),
    Object.freeze({ key: "3xl", label: "3XL" }),
    Object.freeze({ key: "4xl", label: "4XL" }),
    Object.freeze({ key: "5xl", label: "5XL" }),
  ]),
});

export function buildTshirtTechnicalSpecs({ widthMm, heightMm, formatLabel }) {
  return {
    width_mm: widthMm,
    height_mm: heightMm,
    bleed_mm: 0,
    min_dpi: 300,
    is_free_form: false,
    standard_format: formatLabel,
    size_distribution: {
      enabled: TSHIRT_SIZE_DISTRIBUTION_LOCK.enabled,
      title: TSHIRT_SIZE_DISTRIBUTION_LOCK.title,
      enforce_quantity_match: TSHIRT_SIZE_DISTRIBUTION_LOCK.enforce_quantity_match,
      fields: TSHIRT_SIZE_DISTRIBUTION_LOCK.fields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
    },
  };
}

