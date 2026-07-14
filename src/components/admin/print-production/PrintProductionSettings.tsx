import { useMemo, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePodConnections, usePodSyncPrintcomStatus } from "@/lib/pod2/hooks";
import type { PodSupplierConnection } from "@/lib/pod2/types";
import {
  loadDistributionShops,
  type DistributionShop,
  type DistributionShopClient,
} from "@/lib/print-production/distribution";
import { getSupplierCapabilities } from "@/lib/print-production/readiness";
import { AdvancedToolsLinks } from "./AdvancedToolsLinks";

interface PrintProductionSettingsProps {
  forceDomain: string | null;
  onRefetch: () => Promise<void>;
}

interface StatusSyncSummary {
  scanned: number;
  updated: number;
  errors: number;
  completedAt: Date;
}

interface StatusSyncResult {
  scanned: number;
  updated: number;
  errors: number;
}

type StatusSyncState =
  | { kind: "success"; summary: StatusSyncSummary }
  | { kind: "refresh-failed" }
  | null;

const dateTimeFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("da-DK");

export function PrintProductionSettings({
  forceDomain,
  onRefetch,
}: PrintProductionSettingsProps) {
  const connectionsQuery = usePodConnections();
  const shopsQuery = useQuery({
    queryKey: ["print-production", "distribution-shops"],
    queryFn: () => loadDistributionShops(
      supabase as unknown as DistributionShopClient,
    ),
  });
  const syncPrintcomStatus = usePodSyncPrintcomStatus();
  const [lastSync, setLastSync] = useState<StatusSyncState>(null);
  const activeConnection = useMemo(
    () => selectActiveConnection(connectionsQuery.data || []),
    [connectionsQuery.data],
  );
  const capabilities = activeConnection
    ? getSupplierCapabilities(activeConnection.provider_key)
    : null;
  const canSyncStatus = Boolean(capabilities?.statusSync);

  const handleSync = async () => {
    if (!canSyncStatus || syncPrintcomStatus.isPending) return;

    setLastSync(null);

    let result: StatusSyncResult;
    try {
      result = await syncPrintcomStatus.mutateAsync();
    } catch {
      // The existing mutation surfaces a safe operator-facing error toast.
      return;
    }

    try {
      await onRefetch();
    } catch {
      setLastSync({ kind: "refresh-failed" });
      return;
    }

    setLastSync({
      kind: "success",
      summary: {
        scanned: safeCount(result.scanned),
        updated: safeCount(result.updated),
        errors: safeCount(result.errors),
        completedAt: new Date(),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-base font-semibold">Indstillinger</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Driftsstatus for leverandør og administrerede butikker.
        </p>
      </div>

      <section aria-labelledby="print-production-supplier" className="border-y py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="print-production-supplier" className="text-sm font-semibold">
              Aktiv leverandørforbindelse
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {getProviderLabel(activeConnection)}
            </p>
          </div>
          <ConnectionState connection={activeConnection} isLoading={connectionsQuery.isLoading} />
        </div>
        {connectionsQuery.isError ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Leverandørstatus kan ikke bekræftes lige nu.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="print-production-capabilities">
        <h3 id="print-production-capabilities" className="text-sm font-semibold">
          Bekræftede muligheder
        </h3>
        {capabilities ? (
          <dl className="mt-2 divide-y border-y">
            <CapabilityRow label="Katalog" available={capabilities.catalog} />
            <CapabilityRow label="Priser" available={capabilities.pricing} />
            <CapabilityRow label="Validering" available={capabilities.validation} />
            <CapabilityRow label="Indsendelse" available={capabilities.liveSubmission} unavailableLabel="Deaktiveret" />
            <CapabilityRow label="Statussynkronisering" available={capabilities.statusSync} />
            <CapabilityRow label="Annullering" available={capabilities.cancellation} unavailableLabel="Ikke tilgængelig" />
          </dl>
        ) : (
          <p className="mt-2 border-y py-3 text-sm text-muted-foreground">
            Vælg en aktiv leverandørforbindelse for at se mulighederne.
          </p>
        )}
      </section>

      <section aria-labelledby="print-production-billing" className="border-y py-4">
        <h3 id="print-production-billing" className="text-sm font-semibold">
          Webprinter-afregning
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Webprinter-afregningsidentiteten håndteres på serveren og kontrolleres af Kontrollér ordre før hver live-indsendelse.
        </p>
      </section>

      <section aria-labelledby="print-production-shops">
        <h3 id="print-production-shops" className="text-sm font-semibold">
          Administrerede butikker
        </h3>
        <ShopReadiness query={shopsQuery} />
      </section>

      <section aria-labelledby="print-production-status-sync" className="border-y py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="print-production-status-sync" className="text-sm font-semibold">
              Leverandørstatus
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {getStatusSyncMessage(lastSync)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={!canSyncStatus || syncPrintcomStatus.isPending}
          >
            {syncPrintcomStatus.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Synkronisér leverandørstatus
          </Button>
        </div>
        {!canSyncStatus && activeConnection ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Statussynkronisering er kun tilgængelig for Print.com.
          </p>
        ) : null}
      </section>

      <AdvancedToolsLinks forceDomain={forceDomain} />
    </div>
  );
}

function selectActiveConnection(
  connections: PodSupplierConnection[],
): PodSupplierConnection | null {
  return connections
    .filter((connection) => connection.is_active)
    .sort((left, right) => (
      toTimestamp(right.updated_at) - toTimestamp(left.updated_at)
      || toTimestamp(right.created_at) - toTimestamp(left.created_at)
      || left.id.localeCompare(right.id)
    ))[0] || null;
}

function ConnectionState({
  connection,
  isLoading,
}: {
  connection: PodSupplierConnection | null;
  isLoading: boolean;
}) {
  if (isLoading) return <Badge variant="secondary">Indlæser</Badge>;
  if (connection) return <Badge>Aktiv</Badge>;
  return <Badge variant="outline">Ingen aktiv forbindelse</Badge>;
}

function CapabilityRow({
  label,
  available,
  unavailableLabel = "Ikke tilgængelig",
}: {
  label: string;
  available: boolean;
  unavailableLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt>{label}</dt>
      <dd className="text-right text-muted-foreground">
        {available ? "Tilgængelig" : unavailableLabel}
      </dd>
    </div>
  );
}

function ShopReadiness({
  query,
}: {
  query: UseQueryResult<DistributionShop[], Error>;
}) {
  if (query.isLoading) {
    return <p className="mt-1 text-sm text-muted-foreground">Indlæser butiksoversigt.</p>;
  }

  if (query.isError || !query.data) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        Butiksparathed kan ikke bekræftes lige nu.
      </p>
    );
  }

  const readyCount = query.data.filter((shop) => shop.eligible).length;
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {numberFormatter.format(readyCount)} af {numberFormatter.format(query.data.length)} butikker er klar til automatisk afregning.
    </p>
  );
}

function getProviderLabel(connection: PodSupplierConnection | null): string {
  if (!connection) return "Ingen aktiv leverandørforbindelse";
  return normalizeProviderKey(connection.provider_key) === "printcom"
    ? "Print.com"
    : "Anden leverandør";
}

function normalizeProviderKey(providerKey: string): string {
  return providerKey.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function getStatusSyncMessage(state: StatusSyncState): string {
  if (state?.kind === "refresh-failed") {
    return "Synkronisering gennemført, men oversigten kunne ikke opdateres. Prøv igen.";
  }

  return state?.kind === "success"
    ? formatSyncSummary(state.summary)
    : "Ingen statussynkronisering i denne session.";
}

function formatSyncSummary(summary: StatusSyncSummary): string {
  return `${dateTimeFormatter.format(summary.completedAt)}: ${numberFormatter.format(summary.scanned)} scannet, ${numberFormatter.format(summary.updated)} opdateret, ${numberFormatter.format(summary.errors)} fejl.`;
}
