import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { MASTER_TENANT_ID, resolveAdminTenant } from "@/lib/adminTenant";
import {
  getPrintProductionAccessDecision,
  type PrintProductionAccessResolution,
} from "@/lib/print-production/navigation";

export function MasterPodRouteGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const forceDomain = new URLSearchParams(location.search).get("force_domain") || "";
  const [resolution, setResolution] = useState<PrintProductionAccessResolution | null>(null);

  useEffect(() => {
    let isCurrent = true;

    resolveAdminTenant()
      .then(({ tenantId, isMasterAdmin }) => {
        if (isCurrent) setResolution({ forceDomain, tenantId, isMasterAdmin });
      })
      .catch(() => {
        if (isCurrent) setResolution({ forceDomain, tenantId: null, isMasterAdmin: false });
      });

    return () => {
      isCurrent = false;
    };
  }, [forceDomain]);

  const decision = getPrintProductionAccessDecision({
    requestedForceDomain: forceDomain,
    resolution,
    masterTenantId: MASTER_TENANT_ID,
  });

  if (decision === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Kontrollerer adgang</span>
      </div>
    );
  }

  if (decision === "redirect") {
    const search = forceDomain ? `?force_domain=${encodeURIComponent(forceDomain)}` : "";
    return <Navigate to={`/admin/products${search}`} replace />;
  }

  return children;
}
