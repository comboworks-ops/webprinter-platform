import { Building2, MapPin, Pencil, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompanyAddress } from "@/lib/company-hub";

interface AddressSummaryProps {
  address: CompanyAddress;
  inherited?: boolean;
  canManage?: boolean;
  onEdit?: (address: CompanyAddress) => void;
  onArchive?: (address: CompanyAddress) => void;
}

const typeLabels: Record<CompanyAddress["type"], string> = {
  delivery: "Levering",
  billing: "Fakturering",
  both: "Levering og fakturering",
};

export function AddressSummary({
  address,
  inherited,
  canManage,
  onEdit,
  onArchive,
}: AddressSummaryProps) {
  return (
    <article className="flex flex-col gap-4 rounded-md border bg-background p-4 sm:flex-row sm:items-start">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {address.type === "billing" ? (
          <Building2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MapPin className="h-4 w-4" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-medium text-foreground">{address.label}</h3>
          {address.is_default && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Standard</span>
          )}
          {inherited && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Fælles adresse</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{typeLabels[address.type]}</p>
        <address className="mt-3 space-y-0.5 text-sm not-italic text-foreground">
          <p>{address.recipient_name}</p>
          {address.company_name && <p>{address.company_name}</p>}
          <p>{address.street_address}</p>
          {address.street_address_2 && <p>{address.street_address_2}</p>}
          <p>{address.postal_code} {address.city}</p>
          {address.phone && (
            <p className="flex items-center gap-1.5 pt-1 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {address.phone}
            </p>
          )}
        </address>
      </div>

      {canManage && !inherited && (
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit?.(address)} title="Rediger adresse">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Rediger {address.label}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onArchive?.(address)}
          >
            Arkivér
          </Button>
        </div>
      )}
    </article>
  );
}
