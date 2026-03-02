export type ProductCategoryRecord = {
  name: string;
  slug: string;
  sort_order?: number | null;
};

export type ResolvedProductCategory = {
  key: string;
  label: string;
  sortOrder: number | null;
};

const transliterate = (value: string) =>
  value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");

const toLooseKey = (value: string) => transliterate(value).replace(/[^a-z0-9]+/g, "");

export const normalizeProductCategoryKey = (value?: string | null) =>
  transliterate(value || "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toDisplayLabel = (value?: string | null) => {
  const source = (value || "").trim();
  if (!source) return "Ukategoriseret";
  if (source.includes(" ") || /[A-ZÆØÅ]/.test(source) || source === source.toUpperCase()) {
    return source;
  }
  return source
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildLookup = (categories: ProductCategoryRecord[]) => {
  const byKey = new Map<string, ProductCategoryRecord>();

  categories.forEach((category) => {
    const keys = [
      normalizeProductCategoryKey(category.slug),
      normalizeProductCategoryKey(category.name),
      toLooseKey(category.slug),
      toLooseKey(category.name),
    ].filter(Boolean);

    keys.forEach((key) => {
      if (!byKey.has(key)) {
        byKey.set(key, category);
      }
    });
  });

  return byKey;
};

export const resolveProductCategory = (
  value?: string | null,
  categories: ProductCategoryRecord[] = [],
): ResolvedProductCategory => {
  const rawValue = (value || "").trim();
  if (!rawValue) {
    return {
      key: "uncategorized",
      label: "Ukategoriseret",
      sortOrder: null,
    };
  }

  const lookup = buildLookup(categories);
  const normalizedKey = normalizeProductCategoryKey(rawValue);
  const looseKey = toLooseKey(rawValue);
  const matched = lookup.get(normalizedKey) || lookup.get(looseKey);

  if (matched) {
    return {
      key: normalizeProductCategoryKey(matched.slug || matched.name),
      label: matched.name || toDisplayLabel(rawValue),
      sortOrder: matched.sort_order ?? null,
    };
  }

  return {
    key: normalizedKey || looseKey || "uncategorized",
    label: toDisplayLabel(rawValue),
    sortOrder: null,
  };
};

export const buildVisibleProductCategories = (
  rawCategories: Array<string | null | undefined>,
  categories: ProductCategoryRecord[] = [],
): ResolvedProductCategory[] => {
  const byKey = new Map<string, ResolvedProductCategory>();

  rawCategories.forEach((rawValue) => {
    const resolved = resolveProductCategory(rawValue, categories);
    if (!byKey.has(resolved.key)) {
      byKey.set(resolved.key, resolved);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.label.localeCompare(b.label, "da");
  });
};
