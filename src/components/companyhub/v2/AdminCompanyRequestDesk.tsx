import type { CompanyConsultantRequest, CompanyOrderRequestWithProduct, HubItem } from "@/lib/company-hub";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyOrderRequestsView } from "./CompanyOrderRequestsView";

interface AdminCompanyRequestDeskProps {
  requests: CompanyOrderRequestWithProduct[];
  consultantRequests: CompanyConsultantRequest[];
  items: HubItem[];
  isSaving: boolean;
  onDecision: (requestId: string, approve: boolean) => Promise<unknown>;
  onConsultantStatus: (requestId: string, status: CompanyConsultantRequest["status"]) => Promise<unknown>;
}

const consultantStatuses: Array<{ value: CompanyConsultantRequest["status"]; label: string }> = [
  { value: "new", label: "Modtaget" },
  { value: "in_progress", label: "Under behandling" },
  { value: "waiting_for_customer", label: "Afventer kunde" },
  { value: "resolved", label: "Løst" },
  { value: "closed", label: "Lukket" },
];

export function AdminCompanyRequestDesk({
  requests,
  consultantRequests,
  items,
  isSaving,
  onDecision,
  onConsultantStatus,
}: AdminCompanyRequestDeskProps) {
  return (
    <div>
      <CompanyOrderRequestsView
        mode="approvals"
        requests={requests}
        items={items}
        canApprove
        isSaving={isSaving}
        showContinueActions={false}
        onDecision={onDecision}
        onOpenProduct={() => undefined}
      />

      <section className="border-t py-6" aria-labelledby="admin-company-consultant-heading">
        <p className="text-xs font-medium text-muted-foreground">Kundeservice</p>
        <h2 id="admin-company-consultant-heading" className="text-lg font-semibold">Konsulenthjælp</h2>
        <p className="mt-1 text-sm text-muted-foreground">Henvendelser om opsætning, produkter, skabeloner og trykfiler.</p>

        <div className="mt-5 divide-y border-y bg-background">
          {consultantRequests.map((request) => (
            <article key={request.id} className="flex flex-col gap-4 py-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{request.subject}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString("da-DK")}</p>
              </div>
              <Select
                value={request.status}
                onValueChange={(value) => onConsultantStatus(request.id, value as CompanyConsultantRequest["status"])}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{consultantStatuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
              </Select>
            </article>
          ))}
        </div>
        {!consultantRequests.length && <p className="border-b py-8 text-center text-sm text-muted-foreground">Ingen konsulenthenvendelser endnu.</p>}
      </section>
    </div>
  );
}
