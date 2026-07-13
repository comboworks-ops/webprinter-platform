import { Building2, MapPin } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyMembership, CompanyOffice } from "@/lib/company-hub";

interface CompanyWorkspaceHeaderProps {
  company: CompanyMembership;
  companies: CompanyMembership[];
  offices: CompanyOffice[];
  selectedOfficeId: string | null;
  onCompanyChange: (companyId: string) => void;
  onOfficeChange: (officeId: string) => void;
}

export function CompanyWorkspaceHeader({
  company,
  companies,
  offices,
  selectedOfficeId,
  onCompanyChange,
  onOfficeChange,
}: CompanyWorkspaceHeaderProps) {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Firmahub</p>
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{company.name}</h1>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[34rem]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="company-workspace-company">
              Firma
            </label>
            <Select value={company.id} onValueChange={onCompanyChange}>
              <SelectTrigger id="company-workspace-company" className="h-10 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="company-workspace-office">
              Kontor
            </label>
            <Select
              value={selectedOfficeId || undefined}
              onValueChange={onOfficeChange}
              disabled={offices.length === 0}
            >
              <SelectTrigger id="company-workspace-office" className="h-10 bg-background">
                <span className="mr-2 inline-flex text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </span>
                <SelectValue placeholder={offices.length ? "Vælg kontor" : "Intet kontor oprettet"} />
              </SelectTrigger>
              <SelectContent>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}{office.is_default ? " · Standard" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
