import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { PrintProductionShell } from "@/components/admin/print-production/PrintProductionShell";
import { MASTER_TENANT_ID, resolveAdminTenant } from "@/lib/adminTenant";
import {
  getPrintProductionAccessDecision,
  type PrintProductionAccessResolution,
} from "@/lib/print-production/navigation";
import { usePrintProductionData } from "@/lib/print-production/usePrintProductionData";

export default function PrintProduction() {
  const location = useLocation();
  const forceDomain = new URLSearchParams(location.search).get("force_domain") || "";

  return <PrintProductionGate key={forceDomain} forceDomain={forceDomain} />;
}

function PrintProductionGate({ forceDomain }: { forceDomain: string }) {
  const [resolution, setResolution] = useState<PrintProductionAccessResolution | null>(null);

  useEffect(() => {
    let isCurrent = true;

    resolveAdminTenant()
      .then(({ tenantId, isMasterAdmin }) => {
        if (isCurrent) setResolution({ forceDomain, tenantId, isMasterAdmin });
      })
      .catch(() => {
        if (isCurrent) {
          setResolution({ forceDomain, tenantId: null, isMasterAdmin: false });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [forceDomain]);

  const accessDecision = getPrintProductionAccessDecision({
    requestedForceDomain: forceDomain,
    resolution,
    masterTenantId: MASTER_TENANT_ID,
  });

  if (accessDecision === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Indlæser Printproduktion</span>
      </div>
    );
  }

  if (accessDecision === "redirect") {
    const redirectParams = new URLSearchParams();
    if (forceDomain) redirectParams.set("force_domain", forceDomain);
    const redirectSearch = redirectParams.toString();

    return (
      <Navigate
        to={`/admin/products${redirectSearch ? `?${redirectSearch}` : ""}`}
        replace
      />
    );
  }

  return <AuthorizedPrintProduction />;
}

function AuthorizedPrintProduction() {
  const productionData = usePrintProductionData({ page: 0 });

  return <PrintProductionShell {...productionData} />;
}
