import type { SiteCheckoutState } from "../checkout/siteCheckoutSession";

export interface CompanyHubCheckoutContext {
  companyId: string;
  companyOfficeId?: string | null;
  companyAddressId?: string | null;
  companyCatalogItemId: string;
  companyOrderRequestId: string;
}

export type CompanyHubCheckoutErrorCode =
  | "missing_context"
  | "missing_product"
  | "invalid_quantity"
  | "invalid_price"
  | "missing_quote"
  | "quote_mismatch";

export class CompanyHubCheckoutError extends Error {
  readonly code: CompanyHubCheckoutErrorCode;

  constructor(code: CompanyHubCheckoutErrorCode, message: string) {
    super(message);
    this.name = "CompanyHubCheckoutError";
    this.code = code;
  }
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildCompanyHubCheckoutState(
  base: SiteCheckoutState,
  context: CompanyHubCheckoutContext,
): SiteCheckoutState {
  if (!context.companyId || !context.companyCatalogItemId || !context.companyOrderRequestId) {
    throw new CompanyHubCheckoutError(
      "missing_context",
      "Firmaordren mangler nødvendig kontekst. Åbn produktet fra firmaets produktoversigt igen.",
    );
  }

  if (!base.productId) {
    throw new CompanyHubCheckoutError(
      "missing_product",
      "Produktet kunne ikke findes. Åbn produktet fra firmaets produktoversigt igen.",
    );
  }

  if (!Number.isInteger(base.quantity) || Number(base.quantity) <= 0) {
    throw new CompanyHubCheckoutError(
      "invalid_quantity",
      "Vælg et gyldigt antal, før du fortsætter til bestilling.",
    );
  }

  if (!isPositiveFinite(base.productPrice) || !isPositiveFinite(base.totalPrice)) {
    throw new CompanyHubCheckoutError(
      "invalid_price",
      "Der kunne ikke beregnes en gyldig pris. Gå tilbage til produktet og vælg prisindstillingerne igen.",
    );
  }

  if (!base.pricingQuote) {
    throw new CompanyHubCheckoutError(
      "missing_quote",
      "Prisgrundlaget kunne ikke verificeres. Gå tilbage til produktet og vælg prisen igen.",
    );
  }

  const quoteProductId = base.pricingQuote.productId || null;
  const quoteQuantity = Number(base.pricingQuote.quantity || 0);
  if (quoteProductId !== base.productId || quoteQuantity !== base.quantity) {
    throw new CompanyHubCheckoutError(
      "quote_mismatch",
      "Produkt eller antal er ændret efter prisberegningen. Beregn prisen igen, før du fortsætter.",
    );
  }

  return {
    ...base,
    companyId: context.companyId,
    companyOfficeId: context.companyOfficeId || null,
    companyAddressId: context.companyAddressId || null,
    companyCatalogItemId: context.companyCatalogItemId,
    companyOrderRequestId: context.companyOrderRequestId,
  };
}
