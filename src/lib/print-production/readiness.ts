import type {
  PodCatalogPriceMatrix,
  PodCatalogProduct,
  PodFulfillmentJob,
} from "../pod2/types.ts";
import type {
  MasterProductRow,
  OrderPresentation,
  ProductBlocker,
  ProductReadiness,
  SupplierCapabilities,
} from "./types.ts";

const firstFinite = (values: unknown[]): number | null => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? Math.min(...numbers) : null;
};

export function evaluateProductReadiness(input: {
  connectionActive: boolean;
  catalog: PodCatalogProduct;
  masterProduct: MasterProductRow | null;
  distributedTenantCount?: number;
}): ProductReadiness {
  const blockers: ProductBlocker[] = [];
  const matrices = input.catalog.pod2_catalog_price_matrix || [];
  const completeFixedMatrices = matrices.filter(isCompleteFixedPriceMatrix);
  const allMatricesComplete = matrices.length > 0
    && completeFixedMatrices.length === matrices.length;
  const minCost = firstFinite(completeFixedMatrices.flatMap((row) => row.base_costs || []));
  const minRetail = firstFinite(completeFixedMatrices.flatMap((row) => row.recommended_retail || []));
  const quoteOnly = matrices.length > 0 && matrices.every((row) => row.needs_quote);

  if (!input.connectionActive) blockers.push({ code: "connection_missing", label: "Leverandørforbindelsen mangler", actionLabel: "Åbn indstillinger" });
  if (input.catalog.status !== "published") blockers.push({ code: "catalog_draft", label: "Produktet er stadig en kladde", actionLabel: "Klargør produkt" });
  if (!input.catalog.supplier_product_ref && !input.catalog.supplier_product_data?.printcom_sku) blockers.push({ code: "supplier_reference_missing", label: "Leverandørproduktet mangler", actionLabel: "Vælg leverandørprodukt" });
  if (!quoteOnly && (!allMatricesComplete || minCost === null || minRetail === null)) blockers.push({ code: "missing_prices", label: "Produktet mangler en komplet fast prismatrice", actionLabel: "Kontrollér priser" });
  if (quoteOnly) blockers.push({ code: "quote_only", label: "Alle kombinationer kræver tilbud", actionLabel: "Vælg faste kombinationer" });
  if (!String(input.catalog.public_title?.da || input.catalog.public_title?.en || "").trim()) blockers.push({ code: "missing_title", label: "Produktnavnet mangler", actionLabel: "Tilføj navn" });
  if (!(input.catalog.public_images || []).length && !input.masterProduct?.image_url) blockers.push({ code: "missing_image", label: "Produktbilledet mangler", actionLabel: "Tilføj billede" });
  if (!input.masterProduct) blockers.push({ code: "master_import_missing", label: "Produktet er ikke oprettet hos Webprinter", actionLabel: "Opret produkt" });
  if (input.masterProduct && (!input.masterProduct.is_ready || !input.masterProduct.is_published)) blockers.push({ code: "master_product_not_ready", label: "Webprinter-produktet er ikke klar og udgivet", actionLabel: "Klargør produkt" });

  const marginPercent = minCost !== null && minRetail !== null && minRetail > 0
    ? Math.round(((minRetail - minCost) / minRetail) * 1000) / 10
    : null;

  return {
    status: blockers.length ? "blocked" : input.distributedTenantCount ? "distributed" : "ready",
    blockers,
    minCost,
    minRetail,
    marginPercent,
  };
}

export function classifyOrder(job: PodFulfillmentJob): OrderPresentation {
  if (job.status === "completed") return { group: "completed", label: "Afsluttet", canValidate: false, canSubmit: false };
  if (job.status === "processing" || (job.status === "submitted" && job.printcom_order_id)) return { group: "supplier", label: "Hos leverandøren", canValidate: false, canSubmit: false };
  if (job.status === "paid") return { group: "ready", label: "Klar til produktion", canValidate: true, canSubmit: false };
  if (job.status === "failed" || (job.status === "submitted" && !job.printcom_order_id)) return { group: "attention", label: "Kræver handling", canValidate: false, canSubmit: false };
  return { group: "waiting", label: "Afventer", canValidate: false, canSubmit: false };
}

function isCompleteFixedPriceMatrix(matrix: PodCatalogPriceMatrix): boolean {
  if (matrix.needs_quote || !String(matrix.currency || "").trim()) return false;
  const quantities = matrix.quantities || [];
  const costs = matrix.base_costs || [];
  const retail = matrix.recommended_retail || [];
  if (!quantities.length || quantities.length !== costs.length || quantities.length !== retail.length) return false;

  return quantities.every((quantity, index) => {
    const normalizedQuantity = Number(quantity);
    const cost = Number(costs[index]);
    const salePrice = Number(retail[index]);
    return Number.isInteger(normalizedQuantity)
      && normalizedQuantity > 0
      && Number.isFinite(cost)
      && cost > 0
      && Number.isFinite(salePrice)
      && salePrice >= cost;
  });
}

export function getSupplierCapabilities(providerKey: string): SupplierCapabilities {
  const normalized = providerKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isPrintCom = normalized === "printcom";
  return {
    catalog: true,
    pricing: isPrintCom,
    validation: isPrintCom,
    liveSubmission: isPrintCom,
    statusSync: isPrintCom,
    cancellation: false,
  };
}
