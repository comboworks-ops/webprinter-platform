import { Check, Circle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { CompanyAccount } from "@/lib/company-hub";

interface AdminCompanySetupProgressProps {
  company: CompanyAccount;
  officeCount: number;
  addressCount: number;
  memberCount: number;
  catalogCount: number;
  templateCount: number;
  orderRequestCount: number;
}

export function AdminCompanySetupProgress({
  company,
  officeCount,
  addressCount,
  memberCount,
  catalogCount,
  templateCount,
  orderRequestCount,
}: AdminCompanySetupProgressProps) {
  const steps = [
    { label: "Firmaoplysninger", detail: "Navn og kontakt", complete: Boolean(company.name && company.contact_email) },
    { label: "Kontor", detail: "Mindst én lokation", complete: officeCount > 0 },
    { label: "Adresse", detail: "Levering eller fakturering", complete: addressCount > 0 },
    { label: "Medlem", detail: "Adgang og rolle", complete: memberCount > 0 },
    { label: "Produktkatalog", detail: "Mindst ét firmaprodukt", complete: catalogCount > 0 },
    { label: "Skabelon", detail: "Godkendt designgrundlag", complete: templateCount > 0 },
    { label: "Testordre", detail: "Flowet er afprøvet", complete: orderRequestCount > 0 },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <section aria-labelledby="company-setup-heading" className="border-y bg-background py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Opsætning</p>
          <h2 id="company-setup-heading" className="text-lg font-semibold">{completed} af {steps.length} trin klar</h2>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="mt-3 h-1.5" aria-label={`${percent} procent af firmaopsætningen er færdig`} />
      <ol className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              step.complete ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
            }`}>
              {step.complete ? <Check className="h-3 w-3" aria-hidden="true" /> : <Circle className="h-2.5 w-2.5" aria-hidden="true" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{step.label}</span>
              <span className="block text-xs text-muted-foreground">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
