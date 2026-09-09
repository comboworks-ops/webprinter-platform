export const PRODUCT_PRICING_PREVIEW_UPDATE = "PRODUCT_PRICING_PREVIEW_UPDATE";
export const PRODUCT_PRICING_PREVIEW_CLEAR = "PRODUCT_PRICING_PREVIEW_CLEAR";

export type ProductPricingPreviewState = {
  productId: string;
  pricingStructure: unknown;
  isDirty: boolean;
};

export type ProductPricingPreviewMessage =
  | {
      type: typeof PRODUCT_PRICING_PREVIEW_UPDATE;
      productId: string;
      pricingStructure: unknown;
      isDirty: true;
    }
  | {
      type: typeof PRODUCT_PRICING_PREVIEW_CLEAR;
      productId: string;
    };

export type ProductPricingPreviewReduction = {
  overrides: Record<string, unknown>;
  shouldRefreshProduct: boolean;
};

const cleanProductId = (value: unknown): string => (
  typeof value === "string" ? value.trim() : ""
);

export function buildProductPricingPreviewMessages({
  previousProductId,
  preview,
}: {
  previousProductId?: string | null;
  preview?: ProductPricingPreviewState | null;
}): ProductPricingPreviewMessage[] {
  const previousId = cleanProductId(previousProductId);
  const currentId = cleanProductId(preview?.productId);
  const messages: ProductPricingPreviewMessage[] = [];

  if (previousId && previousId !== currentId) {
    messages.push({
      type: PRODUCT_PRICING_PREVIEW_CLEAR,
      productId: previousId,
    });
  }

  if (!currentId) return messages;

  if (preview?.isDirty === true) {
    messages.push({
      type: PRODUCT_PRICING_PREVIEW_UPDATE,
      productId: currentId,
      pricingStructure: preview.pricingStructure,
      isDirty: true,
    });
  } else {
    messages.push({
      type: PRODUCT_PRICING_PREVIEW_CLEAR,
      productId: currentId,
    });
  }

  return messages;
}

export function reduceProductPricingPreviewMessage(
  previous: Record<string, unknown>,
  rawMessage: unknown,
): ProductPricingPreviewReduction {
  const message = (rawMessage && typeof rawMessage === "object")
    ? rawMessage as Record<string, unknown>
    : {};
  const productId = cleanProductId(message.productId);

  if (!productId) {
    return { overrides: previous, shouldRefreshProduct: false };
  }

  const isDirtyUpdate = message.type === PRODUCT_PRICING_PREVIEW_UPDATE
    && message.isDirty === true
    && message.pricingStructure != null
    && typeof message.pricingStructure === "object";

  if (isDirtyUpdate) {
    if (previous[productId] === message.pricingStructure) {
      return { overrides: previous, shouldRefreshProduct: false };
    }
    return {
      overrides: {
        ...previous,
        [productId]: message.pricingStructure,
      },
      shouldRefreshProduct: false,
    };
  }

  const isClear = message.type === PRODUCT_PRICING_PREVIEW_CLEAR
    || message.type === PRODUCT_PRICING_PREVIEW_UPDATE;
  if (!isClear) {
    return { overrides: previous, shouldRefreshProduct: false };
  }

  if (!Object.prototype.hasOwnProperty.call(previous, productId)) {
    return { overrides: previous, shouldRefreshProduct: true };
  }

  const next = { ...previous };
  delete next[productId];
  return { overrides: next, shouldRefreshProduct: true };
}
