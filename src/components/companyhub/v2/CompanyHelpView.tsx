import { useState } from "react";
import { Headphones, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyConsultantRequest, CreateCompanyConsultantRequestInput } from "@/lib/company-hub";

interface CompanyHelpViewProps {
  requests: CompanyConsultantRequest[];
  isSaving: boolean;
  onCreate: (input: CreateCompanyConsultantRequestInput) => Promise<unknown>;
}

const requestTypes: Array<{ value: CompanyConsultantRequest["request_type"]; label: string }> = [
  { value: "portal_setup", label: "Opsætning af firmahub" },
  { value: "new_product", label: "Nyt produkt" },
  { value: "template_setup", label: "Kontrolleret skabelon" },
  { value: "file_help", label: "Hjælp til trykfil" },
  { value: "general_advice", label: "Generel rådgivning" },
];

const statusLabels: Record<CompanyConsultantRequest["status"], string> = {
  new: "Modtaget",
  in_progress: "Under behandling",
  waiting_for_customer: "Afventer dig",
  resolved: "Løst",
  closed: "Lukket",
};

export function CompanyHelpView({ requests, isSaving, onCreate }: CompanyHelpViewProps) {
  const [requestType, setRequestType] = useState<CompanyConsultantRequest["request_type"]>("general_advice");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    try {
      await onCreate({ requestType, subject, message });
      setSubject("");
      setMessage("");
      toast.success("Din henvendelse er sendt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Henvendelsen kunne ikke sendes.");
    }
  };

  return (
    <section className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-labelledby="company-help-heading">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Webprinter rådgivning</p>
        <h2 id="company-help-heading" className="text-lg font-semibold">Få hjælp til opsætning og trykfiler</h2>
        <p className="mt-1 text-sm text-muted-foreground">Beskriv opgaven, så kan en konsulent hjælpe med produkter, skabeloner eller færdige filer.</p>

        <div className="mt-6 max-w-2xl space-y-4">
          <div className="space-y-2">
            <Label>Hvad drejer det sig om?</Label>
            <Select value={requestType} onValueChange={(value) => setRequestType(value as CompanyConsultantRequest["request_type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{requestTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-help-subject">Emne</Label>
            <Input id="company-help-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Fx ny visitkortskabelon" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-help-message">Beskrivelse</Label>
            <Textarea id="company-help-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={6} placeholder="Fortæl hvad der skal ændres, og hvem materialet er til." />
          </div>
          <Button className="gap-2" onClick={submit} disabled={isSaving || !subject.trim() || !message.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" /> Send til Webprinter
          </Button>
        </div>
      </div>

      <aside aria-label="Tidligere henvendelser">
        <div className="flex items-center gap-2 border-b pb-3">
          <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Dine henvendelser</h3>
        </div>
        <div className="divide-y">
          {requests.map((request) => (
            <div key={request.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{request.subject}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{statusLabels[request.status]}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.message}</p>
            </div>
          ))}
          {!requests.length && <p className="py-6 text-sm text-muted-foreground">Ingen henvendelser endnu.</p>}
        </div>
      </aside>
    </section>
  );
}
