import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  RotateCcw,
  Send,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  distributeProduct,
  loadDistributionShops,
  loadPendingDistributions,
  PENDING_DISTRIBUTIONS_QUERY_KEY,
  selectAllShops,
  validateDistributionSelection,
  type PendingDistribution,
  type PendingNotificationClient,
  type DistributionResult,
  type DistributionRpcClient,
  type DistributionShop,
  type DistributionShopClient,
} from "@/lib/print-production/distribution";
import type {
  PrintProductionProduct,
  PrintProductionSnapshot,
} from "@/lib/print-production/types";
import { cn } from "@/lib/utils";

interface PrintProductionDistributionProps {
  snapshot: PrintProductionSnapshot;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null) => void;
  onRefetch: () => Promise<void>;
}

interface ProductDistributionFlowProps {
  productId: string;
  productName: string;
  onDistributed: () => Promise<void>;
}

type FlowStage = "select" | "confirm";
type Feedback = { tone: "success" | "partial" | "error"; message: string };

const numberFormatter = new Intl.NumberFormat("da-DK");

function useDistributionShops() {
  return useQuery({
    queryKey: ["print-production", "distribution-shops"],
    queryFn: () => loadDistributionShops(
      supabase as unknown as DistributionShopClient,
    ),
  });
}

function usePendingDistributions(productIds: string[]) {
  const normalizedProductIds = [...new Set(productIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: [...PENDING_DISTRIBUTIONS_QUERY_KEY, normalizedProductIds],
    queryFn: () => loadPendingDistributions(
      supabase as unknown as PendingNotificationClient,
      normalizedProductIds,
    ),
    enabled: normalizedProductIds.length > 0,
  });
}

export function ProductDistributionFlow({
  productId,
  productName,
  onDistributed,
}: ProductDistributionFlowProps) {
  const queryClient = useQueryClient();
  const shopsQuery = useDistributionShops();
  const pendingQuery = usePendingDistributions([productId]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [stage, setStage] = useState<FlowStage>("select");
  const [isSending, setIsSending] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [result, setResult] = useState<DistributionResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const shops = shopsQuery.data || [];
  const pendingTenantIds = new Set(
    (pendingQuery.data || []).map((pending) => pending.tenantId),
  );
  const selectedShops = selectedTenantIds.flatMap((tenantId) => {
    const shop = shops.find((candidate) => candidate.id === tenantId);
    return shop ? [shop] : [];
  });

  const updateSelection = (shop: DistributionShop, checked: boolean) => {
    if (!shop.eligible || pendingTenantIds.has(shop.id)) return;
    setSelectedTenantIds((current) => checked
      ? [...new Set([...current, shop.id])]
      : current.filter((tenantId) => tenantId !== shop.id));
    setResult(null);
    setFeedback(null);
    setRefreshWarning(null);
    setStage("select");
  };

  const resetSelection = () => {
    setSelectedTenantIds([]);
    setResult(null);
    setFeedback(null);
    setRefreshWarning(null);
    setStage("select");
  };

  const selectEligibleShops = () => {
    setSelectedTenantIds(selectAllShops(shops.map((shop) => ({
      ...shop,
      eligible: shop.eligible && !pendingTenantIds.has(shop.id),
    }))));
    setResult(null);
    setFeedback(null);
    setRefreshWarning(null);
    setStage("select");
  };

  const revalidateSelection = async (): Promise<DistributionShop[]> => {
    const [latestShopsResult, latestPendingResult] = await Promise.all([
      shopsQuery.refetch(),
      pendingQuery.refetch(),
    ]);
    const latestShops = latestShopsResult.data || [];
    const latestPending = latestPendingResult.data || [];
    const latestPendingTenantIds = new Set(latestPending.map((pending) => pending.tenantId));

    try {
      if (latestShopsResult.error) throw latestShopsResult.error;
      if (latestPendingResult.error) throw latestPendingResult.error;
      const validatedShops = validateDistributionSelection(selectedTenantIds, latestShops);
      if (validatedShops.some((shop) => latestPendingTenantIds.has(shop.id))) {
        throw new Error("Produktet afventer allerede modtagelse i en eller flere valgte butikker.");
      }
      return validatedShops;
    } catch (error) {
      const selectableIds = new Set(selectAllShops(latestShops).filter(
        (tenantId) => !latestPendingTenantIds.has(tenantId),
      ));
      setSelectedTenantIds((current) => current.filter((tenantId) => selectableIds.has(tenantId)));
      setStage("select");
      setFeedback({
        tone: "error",
        message: error instanceof Error
          ? error.message
          : "Butiksvalget er ændret. Gennemgå valget igen.",
      });
      throw error;
    }
  };

  const reviewSelection = async () => {
    if (!selectedTenantIds.length || isRevalidating) return;
    setIsRevalidating(true);
    setFeedback(null);
    setRefreshWarning(null);
    try {
      const validatedShops = await revalidateSelection();
      setSelectedTenantIds(validatedShops.map((shop) => shop.id));
      setStage("confirm");
    } catch {
      // revalidateSelection has already returned the operator to a safe state.
    } finally {
      setIsRevalidating(false);
    }
  };

  const sendProduct = async () => {
    if (!selectedTenantIds.length || isSending) return;
    setIsSending(true);
    setFeedback(null);
    setRefreshWarning(null);

    let selectionValidated = false;
    try {
      await revalidateSelection();
      selectionValidated = true;
      const distributionResult = await distributeProduct(
        supabase as unknown as DistributionRpcClient,
        { productId, selectedTenantIds },
      );
      const deliveredCount = distributionResult.copied + distributionResult.notified;
      const isPartial = distributionResult.skipped_existing > 0
        || deliveredCount < selectedTenantIds.length;

      setResult(distributionResult);
      setFeedback(isPartial
        ? {
          tone: "partial",
          message: "Delvist gennemført. Valget er bevaret til et bevidst nyt forsøg.",
        }
        : {
          tone: "success",
          message: `Produktet er sendt til ${numberFormatter.format(deliveredCount)} butikker.`,
        });

      const refreshResults = await Promise.allSettled([
        onDistributed(),
        queryClient.refetchQueries({ queryKey: PENDING_DISTRIBUTIONS_QUERY_KEY }),
      ]);
      const rejectedRefresh = refreshResults.find((refresh) => refresh.status === "rejected");
      if (rejectedRefresh?.status === "rejected") {
        setRefreshWarning(rejectedRefresh.reason instanceof Error
          ? `Status kunne ikke genindlæses: ${rejectedRefresh.reason.message}`
          : "Status kunne ikke genindlæses.");
      }

      if (!isPartial) {
        setSelectedTenantIds([]);
        setStage("select");
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error
          ? error.message
          : "Produktet kunne ikke sendes til butikkerne.",
      });
      setStage(selectionValidated ? "confirm" : "select");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {result && (
        <dl className="grid grid-cols-3 divide-x border-y bg-muted/20" aria-label="Distributionsresultat">
          <ResultCount label="Kopieret" value={result.copied} />
          <ResultCount label="Varslet" value={result.notified} />
          <ResultCount label="Sprunget over" value={result.skipped_existing} />
        </dl>
      )}

      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2 border px-3 py-2.5 text-sm",
            feedback.tone === "success" && "border-emerald-600/30 bg-emerald-600/5 text-emerald-800 dark:text-emerald-300",
            feedback.tone === "partial" && "border-amber-600/30 bg-amber-600/5 text-amber-900 dark:text-amber-300",
            feedback.tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {refreshWarning && (
        <p className="text-sm text-amber-800 dark:text-amber-300" role="alert">
          {refreshWarning} Genindlæs siden, før du forsøger igen.
        </p>
      )}

      {shopsQuery.isLoading || pendingQuery.isLoading ? (
        <div className="flex min-h-32 items-center justify-center" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Indlæser butikker og distributionsstatus</span>
        </div>
      ) : shopsQuery.error || pendingQuery.error ? (
        <div className="flex items-start gap-2 border-y py-4 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Butikker eller afventende distributioner kunne ikke indlæses. Prøv igen senere.
        </div>
      ) : stage === "select" ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Vælg butikker</h3>
              <p className="text-sm text-muted-foreground">
                Ingen butikker er valgt på forhånd.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetSelection}
                disabled={!selectedTenantIds.length}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Nulstil
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectEligibleShops}
                disabled={!shops.some((shop) => shop.eligible && !pendingTenantIds.has(shop.id))}
              >
                Vælg alle
              </Button>
            </div>
          </div>

          <div className="divide-y border-y">
            {shops.map((shop) => {
              const checked = selectedTenantIds.includes(shop.id);
              const isPending = pendingTenantIds.has(shop.id);
              const selectable = shop.eligible && !isPending;
              return (
                <label
                  key={shop.id}
                  htmlFor={`distribution-shop-${productId}-${shop.id}`}
                  className={cn(
                    "flex min-h-12 items-center gap-3 px-2 py-2.5 text-sm",
                    selectable ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed bg-muted/20",
                  )}
                >
                  <Checkbox
                    id={`distribution-shop-${productId}-${shop.id}`}
                    checked={checked}
                    disabled={!selectable}
                    onCheckedChange={(value) => updateSelection(shop, value === true)}
                    aria-describedby={!selectable ? `distribution-shop-reason-${shop.id}` : undefined}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{shop.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shop.domain || "Domæne ikke angivet"}
                    </span>
                  </span>
                  {!selectable && (
                    <span
                      id={`distribution-shop-reason-${shop.id}`}
                      className="max-w-56 text-right text-xs font-medium text-muted-foreground"
                    >
                      {isPending ? "Afventer modtagelse" : "Ikke klar til automatisk afregning"}
                    </span>
                  )}
                </label>
              );
            })}
            {!shops.length && (
              <p className="px-2 py-5 text-sm text-muted-foreground">
                Ingen butikker er tilgængelige.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {numberFormatter.format(selectedTenantIds.length)} valgt
            </p>
            <Button
              type="button"
              onClick={reviewSelection}
              disabled={!selectedTenantIds.length || isRevalidating}
            >
              {isRevalidating && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Gennemgå valg
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold">Kontrollér modtagere</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {productName} sendes til alle butikker på listen, når du bekræfter.
            </p>
          </div>
          <ul className="divide-y border-y" aria-label="Valgte butikker">
            {selectedShops.map((shop) => (
              <li key={shop.id} className="flex min-h-11 items-center gap-3 px-2 py-2 text-sm">
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-medium">{shop.name}</span>
                <span className="text-xs text-muted-foreground">{shop.domain}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage("select")}
              disabled={isSending}
            >
              Rediger valg
            </Button>
            <Button type="button" onClick={sendProduct} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {result ? "Send igen" : "Send til butikker"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function PrintProductionDistribution({
  snapshot,
  selectedProductId,
  onSelectProduct,
  onRefetch,
}: PrintProductionDistributionProps) {
  const shopsQuery = useDistributionShops();
  const masterProductIds = useMemo(() => snapshot.products.flatMap((product) => (
    product.masterProduct ? [product.masterProduct.id] : []
  )), [snapshot.products]);
  const pendingQuery = usePendingDistributions(masterProductIds);
  const pendingDistributions = pendingQuery.data || [];
  const shops = shopsQuery.data || snapshot.tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    domain: tenant.domain,
    eligible: tenant.pod2_auto_forward,
  }));
  const selectedProduct = snapshot.products.find(
    (product) => product.catalog.id === selectedProductId,
  ) || null;
  const distributableProduct = selectedProduct && canDistribute(selectedProduct)
    ? selectedProduct
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Distribution</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {numberFormatter.format(snapshot.products.length)} produkter · {numberFormatter.format(shops.length)} butikker
        </p>
      </div>

      {pendingQuery.error && (
        <p className="border-y py-3 text-sm text-destructive" role="alert">
          Afventende distributioner kunne ikke indlæses. Distribution er midlertidigt deaktiveret.
        </p>
      )}

      <Tabs defaultValue="products" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="products">Pr. produkt</TabsTrigger>
          <TabsTrigger value="shops">Pr. butik</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="overflow-x-auto border-y">
            <Table className="min-w-[760px] table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-[260px] px-3">Produkt</TableHead>
                  <TableHead className="h-10 w-[130px] px-3">Status</TableHead>
                  <TableHead className="h-10 px-3">Butikker</TableHead>
                  <TableHead className="h-10 w-[170px] px-3 text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.products.map((product) => {
                  const pendingShops = getPendingShops(product, shops, pendingDistributions);
                  const pendingShopIds = new Set(pendingShops.map((shop) => shop.id));
                  const distributedShops = shops.filter((shop) =>
                    product.distributedTenantIds.includes(shop.id)
                    && !pendingShopIds.has(shop.id));
                  const hasPending = pendingShops.length > 0;
                  const hasActive = product.distributedTenantIds.length > 0;
                  return (
                    <TableRow key={product.catalog.id}>
                      <TableCell className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductImage product={product} />
                          <span className="truncate font-medium">{getProductName(product)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <DistributionStatus
                          active={hasActive}
                          pending={hasPending}
                          loading={pendingQuery.isLoading}
                          error={Boolean(pendingQuery.error)}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                        {pendingShops.length || distributedShops.length
                          ? [
                            ...pendingShops.map((shop) => `${shop.name} (afventer)`),
                            ...distributedShops.map((shop) => shop.name),
                          ].join(", ")
                          : "Ingen butikker"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectProduct(product.catalog.id)}
                          disabled={!canDistribute(product) || pendingQuery.isLoading || Boolean(pendingQuery.error)}
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          Send til butikker
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!snapshot.products.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Ingen produkter at distribuere.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="shops">
          <div className="overflow-x-auto border-y">
            <Table className="min-w-[680px] table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-[240px] px-3">Butik</TableHead>
                  <TableHead className="h-10 w-[220px] px-3">Klarhed</TableHead>
                  <TableHead className="h-10 px-3">Produkter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => {
                  const pendingProducts = snapshot.products.filter((product) => (
                    isPendingForShop(product, shop.id, pendingDistributions)
                  ));
                  const pendingProductIds = new Set(pendingProducts.map((product) => product.catalog.id));
                  const products = snapshot.products.filter((product) => (
                    product.distributedTenantIds.includes(shop.id)
                    && !pendingProductIds.has(product.catalog.id)
                  ));
                  return (
                    <TableRow key={shop.id}>
                      <TableCell className="px-3 py-2.5">
                        <p className="font-medium">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">{shop.domain || "Domæne ikke angivet"}</p>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-sm">
                        {shop.eligible ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            Klar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            Ikke klar til automatisk afregning
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                        {pendingProducts.length || products.length
                          ? [
                            ...pendingProducts.map((product) => `${getProductName(product)} (afventer)`),
                            ...products.map(getProductName),
                          ].join(", ")
                          : "Ingen aktive produkter"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!shopsQuery.isLoading && !shops.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Ingen butikker fundet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(distributableProduct)}
        onOpenChange={(open) => !open && onSelectProduct(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          {distributableProduct?.masterProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Send til butikker</DialogTitle>
                <DialogDescription>{getProductName(distributableProduct)}</DialogDescription>
              </DialogHeader>
              <ProductDistributionFlow
                key={distributableProduct.catalog.id}
                productId={distributableProduct.masterProduct.id}
                productName={getProductName(distributableProduct)}
                onDistributed={onRefetch}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResultCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{numberFormatter.format(value)}</dd>
    </div>
  );
}

function DistributionStatus({
  active,
  pending,
  loading,
  error,
}: {
  active: boolean;
  pending: boolean;
  loading: boolean;
  error: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {loading && (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          Indlæser status
        </Badge>
      )}
      {error && (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap border-amber-600/40 text-amber-900 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Status ukendt
        </Badge>
      )}
      {pending && (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap border-amber-600/40 text-amber-900 dark:text-amber-300">
          <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
          Afventer modtagelse
        </Badge>
      )}
      {active && (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          Aktiv i butik
        </Badge>
      )}
      {!pending && !active && !loading && !error && (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
          <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Ikke sendt
        </Badge>
      )}
    </span>
  );
}

function isPendingForShop(
  product: PrintProductionProduct,
  tenantId: string,
  pendingDistributions: PendingDistribution[],
): boolean {
  if (!product.masterProduct) return false;
  return pendingDistributions.some((pending) => (
    pending.productId === product.masterProduct?.id && pending.tenantId === tenantId
  ));
}

function getPendingShops(
  product: PrintProductionProduct,
  shops: DistributionShop[],
  pendingDistributions: PendingDistribution[],
): DistributionShop[] {
  return shops.filter((shop) => isPendingForShop(product, shop.id, pendingDistributions));
}

function ProductImage({ product }: { product: PrintProductionProduct }) {
  const imageUrl = product.catalog.public_images?.[0] || product.masterProduct?.image_url;
  const productName = getProductName(product);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" aria-label={`${productName} har intet billede`} />
      )}
    </span>
  );
}

function canDistribute(product: PrintProductionProduct): boolean {
  return Boolean(product.masterProduct)
    && (product.readiness.status === "ready" || product.readiness.status === "distributed");
}

function getProductName(product: PrintProductionProduct): string {
  return product.catalog.public_title.da
    || product.catalog.public_title.en
    || product.masterProduct?.name
    || "Produkt uden navn";
}
