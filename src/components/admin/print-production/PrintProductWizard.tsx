import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  Loader2,
  Package,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pod2SupplierImporter } from "@/pages/admin/Pod2Admin";
import { usePodCatalogProducts, usePodImportProduct } from "@/lib/pod2/hooks";
import type { PodCatalogProduct } from "@/lib/pod2/types";
import { isSupplierPricingComplete } from "@/lib/print-production/supplierPresentation";
import { cn } from "@/lib/utils";
import { ProductDistributionFlow } from "./PrintProductionDistribution";

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface CreatedProduct {
  productId: string;
  slug: string;
}

interface PrintProductWizardProps {
  initialCatalogProductId?: string | null;
  onDistributed: () => Promise<void>;
}

const WIZARD_STEPS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "Vælg produkt" },
  { step: 2, label: "Vælg sortiment" },
  { step: 3, label: "Pris og avance" },
  { step: 4, label: "Kontrollér produkt" },
  { step: 5, label: "Send til butikker" },
];

const finiteNumbers = (values: unknown[]): number[] => (
  values.filter((value): value is number => (
    typeof value === "number" && Number.isFinite(value)
  ))
);

const formatCurrency = (value: number | null, currency = "DKK") => {
  if (value === null) return "Mangler";
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
  }).format(value);
};

export function PrintProductWizard({
  initialCatalogProductId,
  onDistributed,
}: PrintProductWizardProps) {
  const { data: catalogProducts, isLoading, error } = usePodCatalogProducts();
  const importProduct = usePodImportProduct();
  const initialProductHandled = useRef(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<string | null>(null);
  const [showSupplierImporter, setShowSupplierImporter] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const publishedCatalog = (catalogProducts || []).filter((product) => product.status === "published");
  const selectedProduct = publishedCatalog.find((product) => product.id === selectedCatalogProductId) || null;
  const attributes = selectedProduct?.pod2_catalog_attributes || [];
  const matrices = selectedProduct?.pod2_catalog_price_matrix || [];
  const quantities = Array.from(new Set(
    matrices.flatMap((matrix) => finiteNumbers(matrix.quantities || [])),
  )).sort((a, b) => a - b);
  const variantCount = attributes.reduce((count, attribute) => (
    count * Math.max(1, attribute.pod2_catalog_attribute_values?.length || 0)
  ), 1);
  const baseCosts = finiteNumbers(matrices.flatMap((matrix) => matrix.base_costs || []));
  const retailPrices = finiteNumbers(matrices.flatMap((matrix) => matrix.recommended_retail || []));
  const minCost = baseCosts.length ? Math.min(...baseCosts) : null;
  const minRetail = retailPrices.length ? Math.min(...retailPrices) : null;
  const currency = matrices.find((matrix) => matrix.currency)?.currency || "DKK";
  const pricingComplete = isSupplierPricingComplete(matrices);
  const displayedMinCost = pricingComplete ? minCost : null;
  const displayedMinRetail = pricingComplete ? minRetail : null;
  const marginPercent = pricingComplete && minCost !== null && minRetail !== null && minRetail > 0
    ? Math.round(((minRetail - minCost) / minRetail) * 1000) / 10
    : null;
  const title = selectedProduct?.public_title?.da || selectedProduct?.public_title?.en || "";
  const description = selectedProduct?.public_description?.da
    || selectedProduct?.public_description?.en
    || "";
  const imageUrl = selectedProduct?.public_images?.[0] || null;
  const canCreateMasterProduct = Boolean(selectedProduct && title.trim() && pricingComplete);

  useEffect(() => {
    if (initialProductHandled.current || !initialCatalogProductId || !catalogProducts) return;
    initialProductHandled.current = true;
    const initialProduct = catalogProducts.find((product) => (
      product.id === initialCatalogProductId && product.status === "published"
    ));
    if (!initialProduct) return;

    setSelectedCatalogProductId(initialProduct.id);
    setCreatedProduct(null);
    setImportError(null);
    setShowSupplierImporter(false);
    setStep(2);
  }, [catalogProducts, initialCatalogProductId]);

  const chooseCatalogProduct = (product: PodCatalogProduct) => {
    setSelectedCatalogProductId(product.id);
    setCreatedProduct(null);
    setImportError(null);
    setShowSupplierImporter(false);
    setStep(2);
  };

  const openSupplierImporter = () => {
    setSelectedCatalogProductId(null);
    setCreatedProduct(null);
    setImportError(null);
    setShowSupplierImporter(true);
  };

  const createMasterProduct = async () => {
    if (!selectedProduct || !canCreateMasterProduct) return;
    setImportError(null);
    try {
      const result = await importProduct.mutateAsync({
        catalogProductId: selectedProduct.id,
        customName: title,
        customCategory: "tryksager",
      });
      if (!result?.productId || !result?.slug) {
        throw new Error("Webprinter-produktet blev oprettet uden id eller slug.");
      }
      setCreatedProduct({ productId: result.productId, slug: result.slug });
      setStep(5);
    } catch (caughtError) {
      setImportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Produktet kunne ikke oprettes.",
      );
    }
  };

  const goBack = (target: WizardStep) => {
    setImportError(null);
    setStep(target);
  };

  return (
    <section className="w-full space-y-5" aria-labelledby="print-product-wizard-title">
      <div className="flex items-center gap-3 border-b pb-4">
        <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="print-product-wizard-title" className="text-lg font-semibold">
            Tilføj produkt
          </h2>
          <p className="text-sm text-muted-foreground">
            Klargør et produkt til Webprinter-kataloget.
          </p>
        </div>
      </div>

      <nav aria-label="Trin i produktoprettelse" className="overflow-x-auto border-b">
        <ol className="flex min-w-max gap-1">
          {WIZARD_STEPS.map(({ step: itemStep, label }) => {
            const isCurrent = step === itemStep;
            const isComplete = step > itemStep;
            const canReturnToDistribution = itemStep === 5 && Boolean(createdProduct);
            const canNavigate = isComplete || canReturnToDistribution;
            return (
              <li key={itemStep}>
                <button
                  type="button"
                  onClick={() => canNavigate && setStep(itemStep)}
                  disabled={!canNavigate && !isCurrent}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    isCurrent
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span className="tabular-nums" aria-hidden="true">{itemStep}</span>
                  )}
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Vælg produkt</h3>
              <p className="text-sm text-muted-foreground">Publicerede produkter i Webprinter-kataloget.</p>
            </div>
            <Button type="button" variant="outline" onClick={openSupplierImporter}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Hent nyt fra Print.com
            </Button>
          </div>

          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Indlæser produkter</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Kataloget kunne ikke indlæses.
            </div>
          ) : publishedCatalog.length === 0 ? (
            <div className="border-y py-8 text-center text-sm text-muted-foreground">
              Ingen publicerede produkter endnu.
            </div>
          ) : (
            <div className="divide-y border-y">
              {publishedCatalog.map((product) => {
                const productTitle = product.public_title?.da || product.public_title?.en || "Produkt uden navn";
                const productAttributes = product.pod2_catalog_attributes || [];
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => chooseCatalogProduct(product)}
                    className="flex min-h-16 w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {product.public_images?.[0] ? (
                        <img
                          src={product.public_images[0]}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{productTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {productAttributes.length} valggrupper
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          {showSupplierImporter && (
            <div className="border-t pt-4">
              <Pod2SupplierImporter
                mode="guided"
                onCatalogProductCreated={({ catalogProductId }) => {
                  setSelectedCatalogProductId(catalogProductId);
                  setShowSupplierImporter(false);
                  setCreatedProduct(null);
                  setStep(2);
                }}
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedProduct && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold">Vælg sortiment</h3>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="grid gap-4 border-y py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Varianter</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{variantCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Mængder</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quantities.length ? quantities.map((quantity) => (
                  <Badge key={quantity} variant="secondary" className="tabular-nums">
                    {quantity}
                  </Badge>
                )) : <span className="text-sm text-destructive">Mangler mængder</span>}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {attributes.map((attribute) => (
              <div key={attribute.id} className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start">
                <p className="w-48 shrink-0 text-sm font-medium">
                  {attribute.group_label?.da || attribute.group_label?.en || attribute.group_key}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(attribute.pod2_catalog_attribute_values || []).map((value) => (
                    <Badge key={value.id} variant="outline">
                      {value.value_label?.da || value.value_label?.en || value.value_key}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <Button type="button" variant="outline" onClick={() => goBack(1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Tilbage
            </Button>
            <Button type="button" onClick={() => setStep(3)} disabled={!quantities.length || !attributes.length}>
              Fortsæt
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && selectedProduct && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold">Pris og avance</h3>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
            <div className="bg-background p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">Leverandørpris fra</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(displayedMinCost, currency)}</dd>
            </div>
            <div className="bg-background p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">Webprinter-pris fra</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(displayedMinRetail, currency)}</dd>
            </div>
            <div className="bg-background p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">Avance</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {marginPercent === null ? "Mangler" : `${marginPercent.toLocaleString("da-DK")} %`}
              </dd>
            </div>
          </dl>
          <div className="flex items-center justify-between border-t pt-4">
            <Button type="button" variant="outline" onClick={() => goBack(2)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Tilbage
            </Button>
            <Button type="button" onClick={() => setStep(4)} disabled={!pricingComplete}>
              Fortsæt
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && selectedProduct && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold">Kontrollér produkt</h3>
            <p className="text-sm text-muted-foreground">Kundevendt visning og klargøring.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex gap-4 border-y py-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{title || "Produktnavn mangler"}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {description || "Beskrivelse mangler"}
                </p>
                <p className="mt-3 text-sm font-medium tabular-nums">Fra {formatCurrency(displayedMinRetail, currency)}</p>
              </div>
            </div>
            <ul className="divide-y border-y" aria-label="Klargøringskontrol">
              {[
                { label: "Publiceret katalogprodukt", ready: selectedProduct.status === "published" },
                { label: "Varianter og mængder", ready: attributes.length > 0 && quantities.length > 0 },
                { label: "Webprinter-priser", ready: pricingComplete },
                { label: "Produktnavn", ready: Boolean(title.trim()) },
                { label: "Produktbillede", ready: Boolean(imageUrl) },
              ].map((item) => (
                <li key={item.label} className="flex min-h-10 items-center gap-2 py-2 text-sm">
                  {item.ready ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          {importError && (
            <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {importError}
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-4">
            <Button type="button" variant="outline" onClick={() => goBack(3)} disabled={importProduct.isPending}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Tilbage
            </Button>
            <Button
              type="button"
              onClick={createMasterProduct}
              disabled={!canCreateMasterProduct || importProduct.isPending || Boolean(createdProduct)}
            >
              {importProduct.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Opret Webprinter-produkt
            </Button>
          </div>
        </div>
      )}

      {step === 5 && selectedProduct && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold">Send til butikker</h3>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="border-y py-4">
            <p className="font-medium">Webprinter-produkt oprettet</p>
            {createdProduct && (
              <p className="mt-1 text-sm text-muted-foreground">
                {createdProduct.slug}
              </p>
            )}
          </div>
          {createdProduct ? (
            <ProductDistributionFlow
              key={createdProduct.productId}
              productId={createdProduct.productId}
              productName={title}
              onDistributed={onDistributed}
            />
          ) : (
            <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Opret Webprinter-produktet, før du vælger butikker.
            </div>
          )}
          <div className="flex items-center border-t pt-4">
            <Button type="button" variant="outline" onClick={() => goBack(4)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Tilbage
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
