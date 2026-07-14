import type { ReactNode } from "react";
import {
  AlertCircle,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Package,
  Plus,
  Send,
  Settings,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PrintProductWizard } from "./PrintProductWizard";
import { PrintProductionDistribution } from "./PrintProductionDistribution";
import { PrintProductionOverview } from "./PrintProductionOverview";
import { PrintProductionOrders } from "./PrintProductionOrders";
import { PrintProductionProducts } from "./PrintProductionProducts";
import { PrintProductionSettings } from "./PrintProductionSettings";
import {
  getPrintProductionView,
  withPrintProductionView,
  type PrintProductionView,
} from "@/lib/print-production/navigation";
import type { UsePrintProductionDataResult } from "@/lib/print-production/usePrintProductionData";

type PrintProductionShellProps = UsePrintProductionDataResult;

const VIEW_TABS: Array<{
  view: PrintProductionView;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { view: "overview", label: "Overblik", icon: LayoutDashboard },
  { view: "products", label: "Produkter", icon: Package },
  { view: "distribution", label: "Distribution", icon: Send },
  { view: "orders", label: "Ordrer", icon: ClipboardList },
  { view: "settings", label: "Indstillinger", icon: Settings },
];

export function PrintProductionShell({
  snapshot,
  isLoading,
  error,
  refetch,
}: PrintProductionShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const activeView = getPrintProductionView(location.search);
  const activeTab = VIEW_TABS.find(({ view }) => view === activeView) ?? VIEW_TABS[0];
  const isNewProductRoute = activeView === "products" && searchParams.get("action") === "new";
  const selectedProductId = searchParams.get("product");
  const addProductHref = `${withPrintProductionView(location.search, "products")}&action=new`;
  const forceDomain = searchParams.get("force_domain");

  let activeContent: ReactNode;
  if (isLoading) {
    activeContent = (
      <div className="flex min-h-64 items-center justify-center" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Indlæser produktionsdata</span>
      </div>
    );
  } else if (error) {
    activeContent = (
      <Alert variant="destructive" className="max-w-2xl rounded-md">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Produktionsdata kunne ikke indlæses</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  } else if (isNewProductRoute && snapshot) {
    activeContent = (
      <PrintProductWizard
        key={`${location.key}:${searchParams.get("action") || "none"}:${selectedProductId || "none"}`}
        initialCatalogProductId={selectedProductId}
        onDistributed={refetch}
      />
    );
  } else if (activeView === "overview" && snapshot) {
    activeContent = (
      <PrintProductionOverview
        snapshot={snapshot}
        onOpenProduct={(product, action) => {
          const view = action === "distribute" ? "distribution" : "products";
          const href = withPrintProductionView(location.search, view);
          const productParam = product ? `&product=${encodeURIComponent(product.catalog.id)}` : "";
          const actionParam = action === "new" ? "&action=new" : "";
          navigate(`${href}${productParam}${actionParam}`);
        }}
        onOpenOrder={(job) => {
          const href = withPrintProductionView(location.search, "orders");
          const jobParam = job ? `&job=${encodeURIComponent(job.id)}` : "";
          navigate(`${href}${jobParam}`);
        }}
      />
    );
  } else if (activeView === "products" && snapshot) {
    activeContent = (
      <PrintProductionProducts
        snapshot={snapshot}
        selectedProductId={selectedProductId}
        onReviewProduct={(productId) => {
          const href = withPrintProductionView(location.search, "products");
          navigate(productId ? `${href}&product=${encodeURIComponent(productId)}` : href);
        }}
        onPrepareProduct={(product) => {
          if (product.catalog.status !== "published") {
            const catalogParams = new URLSearchParams();
            if (forceDomain) catalogParams.set("force_domain", forceDomain);
            const catalogSearch = catalogParams.toString();
            navigate(`/admin/pod2${catalogSearch ? `?${catalogSearch}` : ""}`);
            return;
          }
          const href = withPrintProductionView(location.search, "products");
          navigate(`${href}&action=new&product=${encodeURIComponent(product.catalog.id)}`);
        }}
        onDistributeProduct={(product) => {
          const href = withPrintProductionView(location.search, "distribution");
          navigate(`${href}&product=${encodeURIComponent(product.catalog.id)}`);
        }}
        onOpenImportedProduct={(product) => {
          if (!product.masterProduct) return;
          const productParams = new URLSearchParams();
          if (forceDomain) productParams.set("force_domain", forceDomain);
          const productSearch = productParams.toString();
          navigate(`/admin/product/${encodeURIComponent(product.masterProduct.slug)}${productSearch ? `?${productSearch}` : ""}`);
        }}
      />
    );
  } else if (activeView === "distribution" && snapshot) {
    activeContent = (
      <PrintProductionDistribution
        snapshot={snapshot}
        selectedProductId={selectedProductId}
        onSelectProduct={(productId) => {
          const href = withPrintProductionView(location.search, "distribution");
          navigate(productId ? `${href}&product=${encodeURIComponent(productId)}` : href);
        }}
        onRefetch={refetch}
      />
    );
  } else if (activeView === "orders" && snapshot) {
    activeContent = (
      <PrintProductionOrders
        snapshot={snapshot}
        onRefetch={refetch}
        forceDomain={forceDomain}
        selectedJobId={searchParams.get("job")}
      />
    );
  } else if (activeView === "settings") {
    activeContent = (
      <PrintProductionSettings
        forceDomain={forceDomain}
        onRefetch={refetch}
      />
    );
  } else {
    activeContent = (
      <div className="min-h-64 border-t py-6">
        <h2 id="print-production-view-title" className="text-base font-semibold">
          {activeTab.label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visningen er klar til næste implementeringstrin.
        </p>
        <span className="sr-only">
          {snapshot ? "Produktionsdata er indlæst." : "Der er ingen produktionsdata."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Printproduktion</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Vælg produkter, send dem til dine butikker og følg produktionen.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to={addProductHref}>
            <Plus aria-hidden="true" />
            Tilføj produkt
          </Link>
        </Button>
      </header>

      <nav
        aria-label="Printproduktionsvisninger"
        className="overflow-x-auto border-b"
      >
        <div className="flex min-w-max gap-1" role="tablist">
          {VIEW_TABS.map(({ view, label, icon: Icon }) => {
            const isActive = activeView === view;
            return (
              <Link
                key={view}
                id={`print-production-tab-${view}`}
                to={withPrintProductionView(location.search, view)}
                role="tab"
                aria-selected={isActive}
                aria-controls="print-production-view"
                className={cn(
                  "inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <section
        id="print-production-view"
        role="tabpanel"
        aria-labelledby={`print-production-tab-${activeView}`}
      >
        {activeContent}
      </section>
    </div>
  );
}
