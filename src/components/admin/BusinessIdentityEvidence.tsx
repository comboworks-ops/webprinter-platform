import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  normalizeBusinessEvidenceState,
  type BusinessEvidenceStatus,
} from "@/lib/onboarding/danishBusinessIdentity";

export type TenantBusinessEvidenceDisplay = Readonly<{
  status: BusinessEvidenceStatus;
  provider?: string | null;
  checkedAt?: string | null;
}>;

type Props = Readonly<{
  evidence: TenantBusinessEvidenceDisplay | null;
  canVerify: boolean;
  hasUnsavedChanges: boolean;
  verifying: boolean;
  onVerify: () => void;
}>;

export function BusinessIdentityEvidence({
  evidence,
  canVerify,
  hasUnsavedChanges,
  verifying,
  onVerify,
}: Props) {
  const display = normalizeBusinessEvidenceState(evidence?.status);
  const checkedAt = formatCheckedAt(evidence?.checkedAt);
  const disabled = verifying || hasUnsavedChanges || !canVerify;

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <p className="font-medium">Frivillig virksomhedskontrol</p>
            <Badge variant={badgeVariant(display.status)}>{display.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Kontrollen er kun dokumentation. Den ændrer ikke moms, priser,
            checkout, login eller adgang til webshoppen.
          </p>
          {evidence?.provider ? (
            <p className="text-xs text-muted-foreground">
              Kilde: {evidence.provider}
              {checkedAt ? ` · Kontrolleret ${checkedAt}` : ""}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={onVerify}>
          {verifying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Kontrollér virksomhedsoplysninger
        </Button>
      </div>
      {hasUnsavedChanges ? (
        <p className="text-xs text-muted-foreground">
          Gem virksomhedsoplysningerne, før du starter en ny kontrol.
        </p>
      ) : !canVerify ? (
        <p className="text-xs text-muted-foreground">
          Indtast et gyldigt dansk CVR-nummer på otte cifre for at starte kontrollen.
        </p>
      ) : display.status === "invalid" || display.status === "unavailable" ? (
        <p className="text-xs text-muted-foreground">
          Oplysningerne er stadig gemt. Du kan rette dem eller prøve kontrollen igen senere.
        </p>
      ) : null}
    </div>
  );
}

function badgeVariant(status: BusinessEvidenceStatus) {
  if (status === "valid") return "default" as const;
  if (status === "invalid") return "destructive" as const;
  return "secondary" as const;
}

function formatCheckedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  }).format(date);
}
