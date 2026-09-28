import { Check, Clock3, RefreshCw, ShoppingCart, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompanyOrderRequestWithProduct, HubItem } from "@/lib/company-hub";

interface CompanyOrderRequestsViewProps {
  mode: "approvals" | "orders";
  requests: CompanyOrderRequestWithProduct[];
  items: HubItem[];
  canApprove: boolean;
  isSaving: boolean;
  showContinueActions?: boolean;
  onDecision: (requestId: string, approve: boolean) => Promise<unknown>;
  onOpenProduct: (item: HubItem, requestId?: string | null) => void;
}

const statusLabels: Record<CompanyOrderRequestWithProduct["status"], string> = {
  draft: "Kladde",
  pending_approval: "Afventer godkendelse",
  approved: "Godkendt",
  rejected: "Afvist",
  checkout_started: "Checkout startet",
  ordered: "Bestilt",
  cancelled: "Annulleret",
  expired: "Udløbet",
};

const statusClasses: Record<CompanyOrderRequestWithProduct["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
  checkout_started: "bg-sky-50 text-sky-800",
  ordered: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

function money(value: number | null): string {
  return value == null
    ? "Pris mangler"
    : `${value.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
}

export function CompanyOrderRequestsView({
  mode,
  requests,
  items,
  canApprove,
  isSaving,
  showContinueActions = true,
  onDecision,
  onOpenProduct,
}: CompanyOrderRequestsViewProps) {
  const visible = mode === "approvals"
    ? requests.filter((request) => ["pending_approval", "approved", "rejected"].includes(request.status))
    : requests;
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <section className="py-6" aria-labelledby={`company-${mode}-heading`}>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{mode === "approvals" ? "Kontrolleret indkøb" : "Bestillingshistorik"}</p>
        <h2 id={`company-${mode}-heading`} className="text-lg font-semibold">
          {mode === "approvals" ? "Godkendelser" : "Ordrer og genbestilling"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "approvals"
            ? "Godkend eller afvis firmaets forespørgsler, før de går til checkout."
            : "Genbestilling åbner altid produktet med en ny livepris."}
        </p>
      </div>

      <div className="mt-5 divide-y border-y bg-background">
        {visible.map((request) => {
          const item = itemById.get(request.item_id);
          const canContinue = showContinueActions && request.status === "approved" && Boolean(item?.product_slug);
          const canReorder = showContinueActions && request.status === "ordered" && Boolean(item?.product_slug);
          return (
            <article key={request.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{request.item_title || request.product_name || "Tryksag"}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[request.status]}`}>
                    {statusLabels[request.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.quantity.toLocaleString("da-DK")} stk. · {money(request.quoted_total)} ekskl. moms · {new Date(request.created_at).toLocaleDateString("da-DK")}
                </p>
                {request.approval_reason && <p className="mt-2 text-xs text-muted-foreground">{request.approval_reason}</p>}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {request.status === "pending_approval" && canApprove && (
                  <>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => onDecision(request.id, false)} disabled={isSaving}>
                      <X className="h-4 w-4" aria-hidden="true" /> Afvis
                    </Button>
                    <Button size="sm" className="gap-2" onClick={() => onDecision(request.id, true)} disabled={isSaving}>
                      <Check className="h-4 w-4" aria-hidden="true" /> Godkend
                    </Button>
                  </>
                )}
                {request.status === "pending_approval" && !canApprove && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" /> Afventer en godkender</span>
                )}
                {canContinue && item && (
                  <Button size="sm" className="gap-2" onClick={() => onOpenProduct(item, request.id)}>
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Fortsæt bestilling
                  </Button>
                )}
                {canReorder && item && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => onOpenProduct(item, null)}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Bestil igen
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!visible.length && (
        <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed text-center">
          {mode === "approvals" ? <Check className="mb-3 h-8 w-8 text-muted-foreground/50" /> : <ShoppingCart className="mb-3 h-8 w-8 text-muted-foreground/50" />}
          <p className="text-sm font-medium">{mode === "approvals" ? "Ingen godkendelser endnu" : "Ingen firmaordrer endnu"}</p>
        </div>
      )}
    </section>
  );
}
