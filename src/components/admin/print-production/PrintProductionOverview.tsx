import type { ComponentType } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  ImageIcon,
  PackageCheck,
  Send,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PodFulfillmentJob } from "@/lib/pod2/types";
import { classifyOrder } from "@/lib/print-production/readiness";
import { hasActiveOrderFlow, selectOverviewRows } from "@/lib/print-production/snapshot";
import type {
  PrintProductionActivity,
  PrintProductionProduct,
  PrintProductionSnapshot,
} from "@/lib/print-production/types";
import { cn } from "@/lib/utils";

interface PrintProductionOverviewProps {
  snapshot: PrintProductionSnapshot;
  onOpenProduct: (
    product?: PrintProductionProduct,
    action?: "review" | "distribute" | "new",
  ) => void;
  onOpenOrder: (job?: PodFulfillmentJob) => void;
}

const currencyFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("da-DK");

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function PrintProductionOverview({
  snapshot,
  onOpenProduct,
  onOpenOrder,
}: PrintProductionOverviewProps) {
  const { products, actionJobs } = selectOverviewRows(snapshot);
  const preparedProductCount = snapshot.products.filter((product) =>
    product.readiness.status === "ready" || product.readiness.status === "distributed"
  ).length;
  const orderFlowActive = hasActiveOrderFlow(snapshot.jobs);
  const isOperationallyEmpty = snapshot.products.length === 0
    && snapshot.jobs.length === 0
    && snapshot.activity.length === 0;

  const readinessItems = [
    {
      label: "Leverandør forbundet",
      ready: snapshot.connectionReady,
      detail: snapshot.connectionReady ? "Klar" : "Mangler forbindelse",
    },
    {
      label: "Produkter klargjort",
      ready: preparedProductCount > 0,
      detail: preparedProductCount > 0
        ? `${numberFormatter.format(preparedProductCount)} klar`
        : "Ingen produkter klar",
    },
    {
      label: "Ordreflow aktivt",
      ready: orderFlowActive,
      detail: orderFlowActive ? "Aktuelle ordrer i flow" : "Ingen aktuelle ordrer i flow",
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Produktionsklarhed" className="overflow-hidden rounded-md border">
        <div className="grid sm:grid-cols-3">
          {readinessItems.map((item, index) => {
            const Icon = item.ready ? CheckCircle2 : AlertCircle;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex min-h-16 items-center gap-3 px-4 py-3",
                  index > 0 && "border-t sm:border-l sm:border-t-0",
                  item.ready ? "bg-primary/5" : "bg-muted/30",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    item.ready ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {isOperationallyEmpty ? (
        <EmptyWorkspace onOpenProducts={() => onOpenProduct(undefined, "new")} />
      ) : (
        <>
          <section aria-label="Driftsmålinger" className="border-y">
            <dl className="grid grid-cols-3 divide-x">
              <Metric
                icon={PackageCheck}
                label="Aktive produkter"
                value={snapshot.activeProductCount}
              />
              <Metric
                icon={Store}
                label="Butikker"
                value={snapshot.distributedShopCount}
              />
              <Metric
                icon={AlertCircle}
                label="Kræver handling"
                value={snapshot.attentionCount}
              />
            </dl>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <ProductWorkspace products={products} onOpenProduct={onOpenProduct} />
            <ActionQueue
              jobs={actionJobs}
              tenants={snapshot.tenants}
              onOpenOrder={onOpenOrder}
            />
          </div>

          <RecentActivity activity={snapshot.activity} onOpenProducts={() => onOpenProduct()} />
        </>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-5">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
        <span className="min-w-0 leading-tight">{label}</span>
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
        {numberFormatter.format(value)}
      </dd>
    </div>
  );
}

function ProductWorkspace({
  products,
  onOpenProduct,
}: {
  products: PrintProductionProduct[];
  onOpenProduct: PrintProductionOverviewProps["onOpenProduct"];
}) {
  return (
    <section aria-labelledby="ready-products-title" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="ready-products-title" className="text-base font-semibold">
          Produkter klar til distribution
        </h2>
        {products.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onOpenProduct()}>
            Se alle
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>

      {products.length === 0 ? (
        <InlineEmptyState
          title="Ingen produkter er klar endnu"
          description="Gennemgå produktopsætningen for at se næste blocker."
          actionLabel="Gå til produkter"
          onAction={() => onOpenProduct()}
        />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-[250px] px-3">Produkt</TableHead>
                <TableHead className="h-10 w-[112px] px-3 text-right">Leverandørpris</TableHead>
                <TableHead className="h-10 w-[112px] px-3 text-right">Webprinter-pris</TableHead>
                <TableHead className="h-10 w-[72px] px-3 text-right">Avance</TableHead>
                <TableHead className="h-10 w-[118px] px-3">Klarhed</TableHead>
                <TableHead className="h-10 w-[64px] px-3 text-right">Butikker</TableHead>
                <TableHead className="h-10 w-[260px] px-3 text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const productName = getProductName(product);
                const productImage = product.catalog.public_images?.[0]
                  || product.masterProduct?.image_url;
                return (
                  <TableRow key={product.catalog.id}>
                    <TableCell className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={productName}
                              width={48}
                              height={48}
                              loading="lazy"
                              className="h-12 w-12 object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={productName}>{productName}</p>
                          <p className="truncate text-xs text-muted-foreground" title={getProductDescriptor(product)}>
                            {getProductDescriptor(product)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(product.readiness.minCost)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(product.readiness.minRetail)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right tabular-nums">
                      {formatMargin(product.readiness.marginPercent)}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <ReadinessBadge status={product.readiness.status} />
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right tabular-nums">
                      {numberFormatter.format(product.distributedTenantIds.length)}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenProduct(product, "review")}
                          aria-label={`Gennemse ${productName}`}
                        >
                          <Eye aria-hidden="true" />
                          Gennemse
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onOpenProduct(product, "distribute")}
                          aria-label={`Send ${productName} til butikker`}
                        >
                          <Send aria-hidden="true" />
                          Send til butikker
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function ActionQueue({
  jobs,
  tenants,
  onOpenOrder,
}: {
  jobs: PodFulfillmentJob[];
  tenants: PrintProductionSnapshot["tenants"];
  onOpenOrder: PrintProductionOverviewProps["onOpenOrder"];
}) {
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return (
    <aside aria-labelledby="action-queue-title" className="min-w-0 xl:border-l xl:pl-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="action-queue-title" className="text-base font-semibold">Kræver handling</h2>
        {jobs.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {numberFormatter.format(jobs.length)} vist
          </span>
        )}
      </div>

      {jobs.length === 0 ? (
        <InlineEmptyState
          title="Ingen ordrer kræver handling"
          description="Se ordrevisningen for hele produktionsflowet."
          actionLabel="Se ordrer"
          onAction={() => onOpenOrder()}
        />
      ) : (
        <div className="border-y">
          {jobs.map((job) => {
            const presentation = classifyOrder(job);
            const tenant = tenantById.get(job.tenant_id);
            const isFailure = presentation.group === "attention";
            return (
              <article key={job.id} className="border-b py-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isFailure ? "text-destructive" : "text-primary",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{job.product_name || "Printordre"}</p>
                      <Badge variant={isFailure ? "destructive" : "outline"}>
                        {presentation.label}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.recipient_name || job.customer_email || "Kunde ikke angivet"}
                      {tenant ? ` · ${tenant.name}` : ""}
                    </p>
                    <dl className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <dt className="sr-only">Oprettet</dt>
                        <dd>Oprettet {formatDate(job.created_at)}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <dt className="sr-only">Mængde</dt>
                        <dd>{numberFormatter.format(job.qty)} stk.</dd>
                      </div>
                    </dl>
                    <Button
                      className="mt-3 w-full"
                      variant={isFailure ? "outline" : "default"}
                      size="sm"
                      onClick={() => onOpenOrder(job)}
                      aria-label={`Åbn ordre for ${job.product_name || "printprodukt"}`}
                    >
                      Åbn ordre
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function RecentActivity({
  activity,
  onOpenProducts,
}: {
  activity: PrintProductionActivity[];
  onOpenProducts: () => void;
}) {
  return (
    <section aria-labelledby="recent-activity-title">
      <h2 id="recent-activity-title" className="text-base font-semibold">Seneste aktivitet</h2>
      {activity.length === 0 ? (
        <div className="mt-3">
          <InlineEmptyState
            title="Ingen aktivitet endnu"
            description="Aktivitet vises, når produkter og ordrer bevæger sig gennem flowet."
            actionLabel="Gå til produkter"
            onAction={onOpenProducts}
          />
        </div>
      ) : (
        <ol className="mt-3 divide-y border-y">
          {activity.slice(0, 5).map((item) => {
            const Icon = getActivityIcon(item.kind);
            return (
              <li key={item.id} className="flex min-h-12 items-center gap-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="min-w-0 flex-1 break-words text-sm">{item.label}</p>
                <time
                  dateTime={item.occurredAt}
                  className="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {formatDate(item.occurredAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function InlineEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="border-y bg-muted/20 px-4 py-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button className="mt-3" variant="outline" size="sm" onClick={onAction}>
        {actionLabel}
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function EmptyWorkspace({ onOpenProducts }: { onOpenProducts: () => void }) {
  return (
    <section className="border-y py-10 text-center" aria-labelledby="empty-workspace-title">
      <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h2 id="empty-workspace-title" className="mt-3 text-base font-semibold">
        Produktionsområdet er tomt
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Tilføj det første produkt for at klargøre priser, distribution og ordreflow.
      </p>
      <Button className="mt-4" onClick={onOpenProducts}>
        Tilføj produkt
        <ChevronRight aria-hidden="true" />
      </Button>
    </section>
  );
}

function ReadinessBadge({ status }: { status: PrintProductionProduct["readiness"]["status"] }) {
  const isDistributed = status === "distributed";
  return (
    <Badge variant="outline" className="gap-1.5 whitespace-nowrap font-medium">
      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      {isDistributed ? "Distribueret" : "Klar"}
    </Badge>
  );
}

function getProductName(product: PrintProductionProduct): string {
  return product.catalog.public_title.da
    || product.catalog.public_title.en
    || product.masterProduct?.name
    || "Produkt uden navn";
}

function getProductDescriptor(product: PrintProductionProduct): string {
  const attributes = product.catalog.pod2_catalog_attributes || [];
  const labels = ["format", "size", "materiale", "material"].flatMap((key) => {
    const attribute = attributes.find((item) =>
      item.group_key.toLowerCase().includes(key)
      || item.group_label.da.toLowerCase().includes(key)
      || item.group_label.en.toLowerCase().includes(key)
    );
    if (!attribute) return [];
    const value = attribute.pod2_catalog_attribute_values?.find((item) => item.is_default)
      || attribute.pod2_catalog_attribute_values?.[0];
    return value ? [value.value_label.da || value.value_label.en] : [];
  });
  const uniqueLabels = [...new Set(labels.filter(Boolean))];
  if (uniqueLabels.length) return uniqueLabels.join(" · ");

  const variantCount = product.catalog.pod2_catalog_price_matrix?.length || 0;
  const category = product.masterProduct?.category || "Ukategoriseret";
  return variantCount > 0
    ? `${category} · ${numberFormatter.format(variantCount)} priskombinationer`
    : category;
}

function formatCurrency(value: number | null): string {
  return value === null ? "Ikke angivet" : currencyFormatter.format(value);
}

function formatMargin(value: number | null): string {
  return value === null ? "Ikke angivet" : `${numberFormatter.format(value)} %`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Ukendt tidspunkt" : dateFormatter.format(date);
}

function getActivityIcon(kind: PrintProductionActivity["kind"]) {
  if (kind === "distribution") return Send;
  if (kind === "order") return CircleDollarSign;
  return PackageCheck;
}
