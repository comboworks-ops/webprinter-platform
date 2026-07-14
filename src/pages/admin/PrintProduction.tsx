import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { PrintProductionShell } from "@/components/admin/print-production/PrintProductionShell";
import { MASTER_TENANT_ID, resolveAdminTenant } from "@/lib/adminTenant";
import { usePrintProductionData } from "@/lib/print-production/usePrintProductionData";

interface AdminTenantResolution {
  tenantId: string | null;
  isMasterAdmin: boolean;
}

export default function PrintProduction() {
  const location = useLocation();
  const forceDomain = new URLSearchParams(location.search).get("force_domain") || "";
  const [resolution, setResolution] = useState<AdminTenantResolution | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setResolution(null);

    resolveAdminTenant()
      .then(({ tenantId, isMasterAdmin }) => {
        if (isCurrent) setResolution({ tenantId, isMasterAdmin });
      })
      .catch(() => {
        if (isCurrent) setResolution({ tenantId: null, isMasterAdmin: false });
      });

    return () => {
      isCurrent = false;
    };
  }, [forceDomain]);

  if (!resolution) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Indlæser Printproduktion</span>
      </div>
    );
  }

  if (!resolution.isMasterAdmin || resolution.tenantId !== MASTER_TENANT_ID) {
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
