export function haveTemplateFilesChanged(
  currentTemplateFiles: readonly unknown[],
  originalTemplateFiles: readonly unknown[] | null | undefined,
): boolean {
  return !areProductAboutValuesEqual(currentTemplateFiles, originalTemplateFiles || []);
}

type ProductAboutEditableSnapshot = {
  about_title: string | null;
  about_description: string | null;
  about_image_url: string | null;
  technical_specs: unknown;
  template_files: readonly unknown[] | null | undefined;
};

export type ProductAboutServerSnapshot = ProductAboutEditableSnapshot & {
  updated_at: string | null;
};

export type ProductAboutOptimisticResult =
  | {
    status: "ready";
    expectedUpdatedAt: string | null;
    payload: Record<string, unknown>;
  }
  | {
    status: "conflict";
    field: "about_title" | "about_description" | "about_image_url" | "product_page_info_v2" | "template_files";
  };

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const stableJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isObjectRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])]),
  );
};

export function areProductAboutValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableJsonValue(left)) === JSON.stringify(stableJsonValue(right));
}

const getProductPageInfoV2 = (technicalSpecs: unknown): unknown => (
  isObjectRecord(technicalSpecs) ? technicalSpecs.product_page_info_v2 : undefined
);

const mergeProductPageInfoV2 = (technicalSpecs: unknown, productPageInfoV2: unknown): Record<string, unknown> => {
  const next = isObjectRecord(technicalSpecs) ? { ...technicalSpecs } : {};
  if (productPageInfoV2 === undefined) {
    delete next.product_page_info_v2;
  } else {
    next.product_page_info_v2 = productPageInfoV2;
  }
  return next;
};

/**
 * Builds the smallest safe product-about update from a fresh server snapshot.
 *
 * Unedited fields are omitted, unrelated technical metadata is merged from the
 * fresh row, and concurrent edits to the same field are returned as an
 * explicit conflict instead of being overwritten.
 */
export function buildOptimisticProductAboutUpdate(input: {
  current: ProductAboutServerSnapshot;
  original: ProductAboutEditableSnapshot;
  edited: ProductAboutEditableSnapshot;
}): ProductAboutOptimisticResult {
  const { current, original, edited } = input;
  const payload: Record<string, unknown> = {};
  const scalarFields = [
    "about_title",
    "about_description",
    "about_image_url",
  ] as const;

  for (const field of scalarFields) {
    const localChanged = !areProductAboutValuesEqual(edited[field], original[field]);
    if (!localChanged) continue;

    const serverChanged = !areProductAboutValuesEqual(current[field], original[field]);
    if (serverChanged && !areProductAboutValuesEqual(current[field], edited[field])) {
      return { status: "conflict", field };
    }
    if (!areProductAboutValuesEqual(current[field], edited[field])) {
      payload[field] = edited[field];
    }
  }

  const originalProductInfo = getProductPageInfoV2(original.technical_specs);
  const editedProductInfo = getProductPageInfoV2(edited.technical_specs);
  const currentProductInfo = getProductPageInfoV2(current.technical_specs);
  const localProductInfoChanged = !areProductAboutValuesEqual(editedProductInfo, originalProductInfo);

  if (localProductInfoChanged) {
    const serverProductInfoChanged = !areProductAboutValuesEqual(currentProductInfo, originalProductInfo);
    if (serverProductInfoChanged && !areProductAboutValuesEqual(currentProductInfo, editedProductInfo)) {
      return { status: "conflict", field: "product_page_info_v2" };
    }
    if (!areProductAboutValuesEqual(currentProductInfo, editedProductInfo)) {
      payload.technical_specs = mergeProductPageInfoV2(current.technical_specs, editedProductInfo);
    }
  }

  const localTemplatesChanged = haveTemplateFilesChanged(
    [...(edited.template_files || [])],
    original.template_files,
  );
  if (localTemplatesChanged) {
    const serverTemplatesChanged = haveTemplateFilesChanged(
      [...(current.template_files || [])],
      original.template_files,
    );
    if (
      serverTemplatesChanged
      && !areProductAboutValuesEqual(current.template_files || [], edited.template_files || [])
    ) {
      return { status: "conflict", field: "template_files" };
    }
    if (!areProductAboutValuesEqual(current.template_files || [], edited.template_files || [])) {
      payload.template_files = [...(edited.template_files || [])];
    }
  }

  return {
    status: "ready",
    expectedUpdatedAt: current.updated_at,
    payload,
  };
}

export function includeTemplateFilesWhenChanged<T extends Record<string, unknown>>(
  updatePayload: T,
  currentTemplateFiles: unknown[],
  originalTemplateFiles: readonly unknown[] | null | undefined,
): T | (T & { template_files: unknown[] }) {
  if (!haveTemplateFilesChanged(currentTemplateFiles, originalTemplateFiles)) {
    return updatePayload;
  }

  return {
    ...updatePayload,
    template_files: currentTemplateFiles,
  };
}
