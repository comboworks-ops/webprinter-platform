import type { ReactNode } from "react";

import { useShopSettings } from "@/hooks/useShopSettings";

import { StorefrontSeo } from "./StorefrontSeo";
import { StorefrontThemeFrame } from "./StorefrontThemeFrame";

interface StorefrontContentPageProps {
  children: ReactNode;
  mainClassName?: string;
  topSlot?: ReactNode | null;
}

export function StorefrontContentPage({
  children,
  mainClassName = "flex-1",
  topSlot,
}: StorefrontContentPageProps) {
  const { data: settings } = useShopSettings();
  const branding = settings?.branding;
  const tenantName = String(
    branding?.shop_name
    || settings?.tenant_name
    || settings?.company?.name
    || "Din Shop",
  ).trim() || "Din Shop";

  return (
    <StorefrontThemeFrame
      branding={branding}
      tenantName={tenantName}
      topSlot={topSlot === undefined ? <StorefrontSeo /> : topSlot}
    >
      <main className={mainClassName}>{children}</main>
    </StorefrontThemeFrame>
  );
}
