import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Eye,
  ExternalLink,
  Package,
  RotateCcw,
  Search,
  Send,
  Settings2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  loadDistributionShops,
  loadPendingDistributions,
  PENDING_DISTRIBUTIONS_QUERY_KEY,
  type DistributionShop,
  type DistributionShopClient,
  type PendingDistribution,
  type PendingNotificationClient,
} from "@/lib/print-production/distribution";
import type {
  PrintProductionProduct,
  PrintProductionSnapshot,
} from "@/lib/print-production/types";

interface PrintProductionProductsProps {
  snapshot: PrintProductionSnapshot;
  selectedProductId: string | null;
  onReviewProduct: (productId: string | null) => void;
  onPrepareProduct: (product: PrintProductionProduct) => void;
  onDistributeProduct: (product: PrintProductionProduct) => void;
  onOpenImportedProduct: (product: PrintProductionProduct) => void;
}

type ProductListStatus = "draft" | "setup" | "ready" | "pending" | "distributed" | "blocked";

const currencyFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("da-DK");

const STATUS_LABELS: Record<ProductListStatus, string> = {
  draft: "Kladde",
  setup: "Kræver opsætning",
  ready: "Klar",
  pending: "Afventer modtagelse",
  distributed: "Distribueret",
  blocked: "Blokeret",
};

export function PrintProductionProducts({
  snapshot,
  selectedProductId,
  onReviewProduct,
  onPrepareProduct,
  onDistributeProduct,
  onOpenImportedProduct,
}: PrintProductionProductsProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [category, setCategory] = useState("all");
  const [shop, setShop] = useState("all");
  const [priceReadiness, setPriceReadiness] = useState("all");
  const shopsQuery = useQuery({
    queryKey: ["print-production", "distribution-shops"],
    queryFn: () => loadDistributionShops(
      supabase as unknown as DistributionShopClient,
    ),
  });
  const masterProductIds = useMemo(() => snapshot.products.flatMap((product) => (
    product.masterProduct ? [product.masterProduct.id] : []
  )), [snapshot.products]);
  const normalizedMasterProductIds = useMemo(
    () => [...new Set(masterProductIds)].sort(),
    [masterProductIds],
  );
  const pendingQuery = useQuery({
    queryKey: [...PENDING_DISTRIBUTIONS_QUERY_KEY, normalizedMasterProductIds],
    queryFn: () => loadPendingDistributions(
      supabase as unknown as PendingNotificationClient,
      normalizedMasterProductIds,
    ),
    enabled: normalizedMasterProductIds.length > 0,
  });
  const pendingDistributions = useMemo(
    () => pendingQuery.data || [],
    [pendingQuery.data],
  );
  const distributionShops = useMemo(
    () => shopsQuery.data || [],
    [shopsQuery.data],
  );
  const availabilityError = shopsQuery.error || pendingQuery.error;
  const availabilityUnavailable = shopsQuery.isLoading
    || pendingQuery.isLoading
    || Boolean(availabilityError);

  const categories = useMemo(() => [...new Set(
    snapshot.products.map(getCategory),
  )].sort((left, right) => left.localeCompare(right, "da")), [snapshot.products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("da-DK");
    return snapshot.products.filter((product) => {
      const pendingTenantIds = getPendingTenantIds(product, pendingDistributions);
      const productStatus = getListStatus(product, pendingTenantIds.length > 0);
      const supplierKey = getSupplierKey(product);
      const categoryName = getCategory(product);
      const hasReadyPrices = isPriceReady(product);
      const matchesSearch = !normalizedSearch || [
        getProductName(product),
        categoryName,
        product.masterProduct?.name || "",
      ].some((value) => value.toLocaleLowerCase("da-DK").includes(normalizedSearch));

      return matchesSearch
        && (status === "all" || productStatus === status)
        && (supplier === "all" || supplierKey === supplier)
        && (category === "all" || categoryName === category)
        && (shop === "all"
          || product.distributedTenantIds.includes(shop)
          || pendingTenantIds.includes(shop))
        && (priceReadiness === "all"
          || (priceReadiness === "ready" ? hasReadyPrices : !hasReadyPrices));
    });
  }, [category, pendingDistributions, priceReadiness, search, shop, snapshot.products, status, supplier]);

  const selectedProduct = snapshot.products.find(
    (product) => product.catalog.id === selectedProductId,
  ) || null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Produkter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {numberFormatter.format(snapshot.products.length)} produkter i den aktuelle visning.
        </p>
      </div>

      <section aria-label="Produktfiltre" className="grid gap-3 border-y py-3 md:grid-cols-2 xl:grid-cols-7">
        <label className="space-y-1 xl:col-span-2">
          <span className="text-xs font-medium">Søg</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søg efter produkt"
              className="pl-9"
            />
          </span>
        </label>
        <FilterSelect label="Status" value={status} onChange={setStatus}>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="draft">Kladde</SelectItem>
          <SelectItem value="setup">Kræver opsætning</SelectItem>
          <SelectItem value="ready">Klar</SelectItem>
          <SelectItem value="pending">Afventer modtagelse</SelectItem>
          <SelectItem value="distributed">Distribueret</SelectItem>
          <SelectItem value="blocked">Blokeret</SelectItem>
        </FilterSelect>
        <FilterSelect label="Leverandør" value={supplier} onChange={setSupplier}>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="print.com">Print.com</SelectItem>
          <SelectItem value="missing">Ikke tilknyttet</SelectItem>
        </FilterSelect>
        <FilterSelect label="Kategori" value={category} onChange={setCategory}>
          <SelectItem value="all">Alle</SelectItem>
          {categories.map((categoryName) => (
            <SelectItem key={categoryName} value={categoryName}>{categoryName}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Butik" value={shop} onChange={setShop}>
          <SelectItem value="all">Alle</SelectItem>
          {distributionShops.map((distributionShop) => (
            <SelectItem key={distributionShop.id} value={distributionShop.id}>
              {distributionShop.name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Priser" value={priceReadiness} onChange={setPriceReadiness}>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="ready">Priser klar</SelectItem>
          <SelectItem value="missing">Priser mangler</SelectItem>
        </FilterSelect>
      </section>

      {availabilityError && (
        <div className="flex flex-col gap-3 border-y py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {getAvailabilityErrorMessage(shopsQuery.error, pendingQuery.error)} Distribution er deaktiveret, indtil status er genindlæst.
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => void Promise.all([shopsQuery.refetch(), pendingQuery.refetch()])}
            disabled={shopsQuery.isFetching || pendingQuery.isFetching}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Genindlæs status
          </Button>
        </div>
      )}

      {selectedProduct && (
        <ProductReview
          product={selectedProduct}
          pendingTenantIds={getPendingTenantIds(selectedProduct, pendingDistributions)}
          canOpenDistribution={canOpenDistribution(
            selectedProduct,
            distributionShops,
            getPendingTenantIds(selectedProduct, pendingDistributions),
            availabilityUnavailable,
          )}
          onClose={() => onReviewProduct(null)}
          onPrepare={() => onPrepareProduct(selectedProduct)}
          onDistribute={() => onDistributeProduct(selectedProduct)}
        />
      )}

      <div className="overflow-x-auto border-y">
        <Table className="min-w-[1260px] table-fixed">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-[260px] px-3">Produkt</TableHead>
              <TableHead className="h-10 w-[120px] px-3">Leverandør</TableHead>
              <TableHead className="h-10 w-[135px] px-3">Kategori</TableHead>
              <TableHead className="h-10 w-[145px] px-3">Status</TableHead>
              <TableHead className="h-10 w-[125px] px-3 text-right">Salgspris fra</TableHead>
              <TableHead className="h-10 w-[180px] px-3 text-right">Butikker</TableHead>
              <TableHead className="h-10 w-[300px] px-3 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const pendingTenantIds = getPendingTenantIds(product, pendingDistributions);
              const productStatus = getListStatus(product, pendingTenantIds.length > 0);
              const canSend = canOpenDistribution(
                product,
                distributionShops,
                pendingTenantIds,
                availabilityUnavailable,
              );
              return (
                <TableRow key={product.catalog.id}>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImage product={product} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{getProductName(product)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {product.masterProduct ? "Webprinter-produkt oprettet" : "Afventer oprettelse"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm">
                    {getSupplierKey(product) === "print.com" ? "Print.com" : "Ikke tilknyttet"}
                  </TableCell>
                  <TableCell className="truncate px-3 py-2.5 text-sm">{getCategory(product)}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <StatusBadge status={productStatus} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right text-sm tabular-nums">
                    {product.readiness.minRetail === null
                      ? "Mangler"
                      : currencyFormatter.format(product.readiness.minRetail)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right text-sm tabular-nums">
                    {pendingTenantIds.length
                      ? `${numberFormatter.format(product.distributedTenantIds.length)} aktiv · ${numberFormatter.format(pendingTenantIds.length)} afventer`
                      : numberFormatter.format(product.distributedTenantIds.length)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onReviewProduct(product.catalog.id)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Gennemse
                      </Button>
                      {!canDistribute(product) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onPrepareProduct(product)}
                        >
                          <Settings2 className="h-4 w-4" aria-hidden="true" />
                          Klargør
                        </Button>
                      )}
                      {canSend && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onDistributeProduct(product)}
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          Send til butikker
                        </Button>
                      )}
                      {product.masterProduct && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => onOpenImportedProduct(product)}
                          aria-label={`Åbn ${getProductName(product)}`}
                          title="Åbn produkt"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filteredProducts.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Ingen produkter matcher filtrene.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

function ProductReview({
  product,
  pendingTenantIds,
  canOpenDistribution,
  onClose,
  onPrepare,
  onDistribute,
}: {
  product: PrintProductionProduct;
  pendingTenantIds: string[];
  canOpenDistribution: boolean;
  onClose: () => void;
  onPrepare: () => void;
  onDistribute: () => void;
}) {
  const productStatus = getListStatus(product, pendingTenantIds.length > 0);
  return (
    <section aria-labelledby="product-review-title" className="border-y bg-muted/20 px-3 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="product-review-title" className="font-semibold">{getProductName(product)}</h3>
            <StatusBadge status={productStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {getCategory(product)} · {numberFormatter.format(product.distributedTenantIds.length)} aktive · {numberFormatter.format(pendingTenantIds.length)} afventer
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Luk produktgennemgang">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Næste handling</p>
          <p className="mt-1 text-sm">
            {product.readiness.blockers.length
              ? product.readiness.blockers.map((blocker) => blocker.label).join(" · ")
              : "Produktet er klar til distribution."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {canOpenDistribution && (
            <Button type="button" size="sm" onClick={onDistribute}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send til butikker
            </Button>
          )}
          {!canDistribute(product) && (
            <Button type="button" size="sm" onClick={onPrepare}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Klargør
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ProductImage({ product }: { product: PrintProductionProduct }) {
  const imageUrl = product.catalog.public_images?.[0] || product.masterProduct?.image_url;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

function StatusBadge({ status }: { status: ProductListStatus }) {
  return (
    <Badge
      variant="outline"
      className={status === "pending"
        ? "whitespace-nowrap border-amber-600/40 text-amber-900 dark:text-amber-300"
        : "whitespace-nowrap"}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function getProductName(product: PrintProductionProduct): string {
  return product.catalog.public_title.da
    || product.catalog.public_title.en
    || product.masterProduct?.name
    || "Produkt uden navn";
}

function getCategory(product: PrintProductionProduct): string {
  return product.masterProduct?.category || "Ukategoriseret";
}

function getSupplierKey(product: PrintProductionProduct): "print.com" | "missing" {
  return product.readiness.blockers.some((blocker) => blocker.code === "supplier_reference_missing")
    ? "missing"
    : "print.com";
}

function isPriceReady(product: PrintProductionProduct): boolean {
  return product.readiness.minCost !== null
    && product.readiness.minRetail !== null
    && !product.readiness.blockers.some((blocker) =>
      blocker.code === "missing_prices" || blocker.code === "quote_only");
}

function getListStatus(product: PrintProductionProduct, hasPending = false): ProductListStatus {
  if (product.catalog.status !== "published") return "draft";
  if (hasPending) return "pending";
  if (product.readiness.status === "distributed") return "distributed";
  if (product.readiness.status === "ready") return "ready";
  if (product.readiness.blockers.some((blocker) => [
    "connection_missing",
    "supplier_reference_missing",
    "missing_prices",
    "quote_only",
  ].includes(blocker.code))) return "blocked";
  return "setup";
}

function canDistribute(product: PrintProductionProduct): boolean {
  return Boolean(product.masterProduct)
    && (product.readiness.status === "ready" || product.readiness.status === "distributed");
}

function getPendingTenantIds(
  product: PrintProductionProduct,
  pendingDistributions: PendingDistribution[],
): string[] {
  if (!product.masterProduct) return [];
  return pendingDistributions.flatMap((pending) => (
    pending.productId === product.masterProduct?.id ? [pending.tenantId] : []
  ));
}

function canOpenDistribution(
  product: PrintProductionProduct,
  shops: DistributionShop[],
  pendingTenantIds: string[],
  pendingStatusUnavailable: boolean,
): boolean {
  if (!canDistribute(product) || pendingStatusUnavailable) return false;
  const unavailableTenantIds = new Set([
    ...product.distributedTenantIds,
    ...pendingTenantIds,
  ]);
  return shops.some((shop) => (
    shop.eligible && !unavailableTenantIds.has(shop.id)
  ));
}

function getAvailabilityErrorMessage(...errors: unknown[]): string {
  const error = errors.find((candidate): candidate is Error => candidate instanceof Error);
  return error?.message || "Butikker eller afventende distributioner kunne ikke indlæses.";
}
