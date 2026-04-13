import { useEffect, useState } from "react";

import { SitePackagePreview } from "@/components/sites/SitePackagePreview";
import { StorefrontHomeContent } from "@/components/storefront/StorefrontHomeContent";
import { StorefrontSeo } from "@/components/storefront/StorefrontSeo";
import { StorefrontThemeFrame } from "@/components/storefront/StorefrontThemeFrame";
import { useShopSettings } from "@/hooks/useShopSettings";

const FEATURED_SIDE_PANEL_BOX_ID = "forside.products.featured.side-panel.box";

function resolveEditSelectionElement(target: HTMLElement | null): HTMLElement | null {
  const brandingElement = target?.closest?.("[data-branding-id], [data-click-to-edit]") as HTMLElement | null;
  if (!brandingElement) return null;

  const rawId = brandingElement.getAttribute("data-branding-id")
    || brandingElement.getAttribute("data-click-to-edit")
    || "";

  if (rawId.startsWith("forside.products.featured.side-panel.") && rawId !== FEATURED_SIDE_PANEL_BOX_ID) {
    return (
      brandingElement.closest(
        `[data-branding-id="${FEATURED_SIDE_PANEL_BOX_ID}"], [data-click-to-edit="${FEATURED_SIDE_PANEL_BOX_ID}"]`,
      ) as HTMLElement | null
    ) || brandingElement;
  }

  return brandingElement;
}

const Shop = () => {
  const { data: settings } = useShopSettings();
  const branding = settings?.branding;
  const tenantName = String(
    branding?.shop_name
    || settings?.tenant_name
    || settings?.company?.name
    || "Din Shop",
  ).trim() || "Din Shop";

  const activeSiteId = settings?.site_frontends?.activeSiteId;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const rootDomain = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isPlatformRoot = hostname === rootDomain || hostname === `www.${rootDomain}`;
  const shouldRenderActiveSite = Boolean(activeSiteId && settings?.id && !isLocalhost && !isPlatformRoot);

  const [editMode, setEditMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SET_EDIT_MODE") {
        setEditMode(event.data.enabled === true);
      }
    };

    window.addEventListener("message", handleMessage);

    if (window.parent !== window) {
      window.parent.postMessage({ type: "PREVIEW_READY" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!editMode) return;

    document.querySelectorAll('[data-selected="true"]').forEach((element) => {
      element.removeAttribute("data-selected");
    });

    if (!selectedElementId) return;

    const selectedElement = document.querySelector(
      `[data-branding-id="${selectedElementId}"], [data-click-to-edit="${selectedElementId}"]`,
    );

    if (selectedElement) {
      selectedElement.setAttribute("data-selected", "true");
    }
  }, [editMode, selectedElementId]);

  useEffect(() => {
    if (!editMode) {
      setSelectedElementId(null);
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const brandingElement = resolveEditSelectionElement(target);

      if (!brandingElement) return;

      event.preventDefault();
      event.stopPropagation();

      const id = brandingElement.getAttribute("data-branding-id")
        || brandingElement.getAttribute("data-click-to-edit");

      document.querySelectorAll('[data-selected="true"]').forEach((element) => {
        element.removeAttribute("data-selected");
      });

      if (id) {
        setSelectedElementId(id);
        brandingElement.setAttribute("data-selected", "true");
        if (window.parent !== window) {
          window.parent.postMessage({
            type: "EDIT_SECTION",
            sectionId: id,
          }, "*");
        }
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "CLEAR_SELECTION") {
        setSelectedElementId(null);
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("message", handleMessage);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("message", handleMessage);
    };
  }, [editMode]);

  if (shouldRenderActiveSite && activeSiteId) {
    return (
      <SitePackagePreview
        siteId={activeSiteId}
        tenantId={settings?.id || null}
        mode="live"
      />
    );
  }

  return (
    <div className={editMode ? "preview-edit-mode" : ""}>
      <style>{`
        .preview-edit-mode [data-branding-id] {
          cursor: pointer;
          position: relative;
        }
        .preview-edit-mode [data-branding-id]:hover {
          outline: 2px dashed #0EA5E9;
          outline-offset: 4px;
        }
        .preview-edit-mode [data-branding-id]:hover::after {
          content: 'Klik for at redigere';
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          background: #0EA5E9;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          z-index: 100;
          pointer-events: none;
        }
        .preview-edit-mode [data-branding-id][data-selected="true"],
        .preview-edit-mode [data-click-to-edit][data-selected="true"] {
          outline: 3px solid #F97316;
          outline-offset: 4px;
        }
        .preview-edit-mode [data-branding-id][data-selected="true"]::before,
        .preview-edit-mode [data-click-to-edit][data-selected="true"]::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(249, 115, 22, 0.1);
          pointer-events: none;
          z-index: 50;
          border-radius: inherit;
        }
        .preview-edit-mode [data-branding-id][data-selected="true"]::after,
        .preview-edit-mode [data-click-to-edit][data-selected="true"]::after {
          content: 'Redigerer...';
          position: absolute;
          top: -28px;
          left: 50%;
          transform: translateX(-50%);
          background: #F97316;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          z-index: 100;
          pointer-events: none;
        }
      `}</style>

      <StorefrontThemeFrame
        branding={branding}
        tenantName={tenantName}
        topSlot={<StorefrontSeo />}
      >
        <StorefrontHomeContent
          branding={branding}
          tenantName={tenantName}
        />
      </StorefrontThemeFrame>
    </div>
  );
};

export default Shop;
