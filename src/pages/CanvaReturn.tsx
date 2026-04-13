import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { consumeSiteCheckoutTransfer, readSiteCheckoutSession, writeSiteCheckoutSession, type SiteCheckoutState } from "@/lib/checkout/siteCheckoutSession";
import { useShopSettings } from "@/hooks/useShopSettings";
import { StorefrontThemeFrame } from "@/components/storefront/StorefrontThemeFrame";

const parsePositiveNumber = (value: string | null): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const withLeadingQuestionMark = (value: string | null): string => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
};

const buildFallbackCheckoutState = (params: URLSearchParams): SiteCheckoutState | null => {
  const productId = params.get("productId");
  const productSlug = params.get("productSlug");
  const productName = params.get("productName");

  if (!productId && !productSlug && !productName) return null;

  return {
    productId,
    productSlug,
    productName,
    selectedVariant: params.get("selectedVariant"),
    quantity: parsePositiveNumber(params.get("quantity")),
    productPrice: parsePositiveNumber(params.get("productPrice")),
    extraPrice: parsePositiveNumber(params.get("extraPrice")),
    totalPrice: parsePositiveNumber(params.get("totalPrice")),
    shippingCost: parsePositiveNumber(params.get("shippingCost")),
    selectedFormat: params.get("selectedFormat"),
    designWidthMm: parsePositiveNumber(params.get("widthMm")),
    designHeightMm: parsePositiveNumber(params.get("heightMm")),
    designBleedMm: parsePositiveNumber(params.get("bleedMm")),
    designSafeAreaMm: parsePositiveNumber(params.get("safeMm")),
    createdAt: new Date().toISOString(),
  };
};

const CanvaReturn = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const shopSettings = useShopSettings();
  const branding = shopSettings.data?.branding;
  const tenantName = String(
    branding?.shop_name
    || shopSettings.data?.tenant_name
    || shopSettings.data?.company?.name
    || "Din Shop",
  ).trim() || "Din Shop";
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tenantQuery = useMemo(() => withLeadingQuestionMark(searchParams.get("tenantQuery")), [searchParams]);
  const backTo = searchParams.get("backTo");
  const [checkoutState] = useState<SiteCheckoutState | null>(() => {
    const fallbackState = buildFallbackCheckoutState(new URLSearchParams(location.search));
    const sessionState = readSiteCheckoutSession();
    const transferredState = consumeSiteCheckoutTransfer();
    const mergedState = {
      ...(fallbackState || {}),
      ...(sessionState || {}),
      ...(transferredState || {}),
    };

    return Object.keys(mergedState).length > 0 ? mergedState : null;
  });

  useEffect(() => {
    if (!checkoutState) return;
    writeSiteCheckoutSession({
      ...checkoutState,
      createdAt: checkoutState.createdAt || new Date().toISOString(),
    });
  }, [checkoutState]);

  const hasCheckoutContext = Boolean(checkoutState?.productId || checkoutState?.productSlug || checkoutState?.productName);
  const resolvedBackTarget = useMemo(() => {
    if (backTo) return backTo;
    if (checkoutState?.productSlug) return `/produkt/${checkoutState.productSlug}${tenantQuery}`;
    return tenantQuery ? `/${tenantQuery}` : "/";
  }, [backTo, checkoutState?.productSlug, tenantQuery]);

  const handleContinueToUpload = () => {
    if (!checkoutState) return;
    writeSiteCheckoutSession({
      ...checkoutState,
      createdAt: checkoutState.createdAt || new Date().toISOString(),
    });
    navigate(`/checkout/konfigurer${tenantQuery}`, { state: checkoutState });
  };

  return (
    <StorefrontThemeFrame
      branding={branding}
      tenantName={tenantName}
    >
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto max-w-4xl px-4 py-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Canva return
            </Badge>
            {checkoutState?.productName ? (
              <span className="text-sm text-muted-foreground">{checkoutState.productName}</span>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Fortsæt fra Canva</CardTitle>
                <CardDescription>
                  Canva Pro-flows i Webprinter er halvautomatiske. Designet laves i Canva, og filen uploades herefter til checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background p-4">
                  <p className="font-medium">Næste trin</p>
                  <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>1. Eksportér dit design som tryk-PDF eller højopløselig PDF i Canva.</li>
                    <li>2. Download filen til din computer.</li>
                    <li>3. Gå videre til upload i Webprinter og vedhæft den eksporterede fil.</li>
                  </ol>
                </div>

                {!hasCheckoutContext ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    Vi kunne ikke genskabe hele produktkonfigurationen fra returen. Gå tilbage til produktsiden og start Canva-flowet igen, hvis pris eller antal mangler.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleContinueToUpload} disabled={!hasCheckoutContext} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Gå til upload
                  </Button>
                  <Button variant="outline" onClick={() => navigate(resolvedBackTarget)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Tilbage til produkt
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Konfiguration</CardTitle>
                <CardDescription>
                  Den seneste produktopsætning, som vi kunne genskabe til checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Produkt</span>
                  <span className="text-right font-medium">{checkoutState?.productName || checkoutState?.productSlug || "Ikke fundet"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Antal</span>
                  <span className="font-medium">{checkoutState?.quantity || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">{checkoutState?.selectedFormat || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Størrelse</span>
                  <span className="text-right font-medium">
                    {checkoutState?.designWidthMm && checkoutState?.designHeightMm
                      ? `${checkoutState.designWidthMm} x ${checkoutState.designHeightMm} mm`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Pris ex. moms</span>
                  <span className="font-medium">
                    {typeof checkoutState?.totalPrice === "number" && checkoutState.totalPrice > 0
                      ? `${Math.round(checkoutState.totalPrice)} kr`
                      : "-"}
                  </span>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Hvis du stadig står i Canva, kan du eksportere derfra og vende tilbage til denne fane bagefter.
                </div>

                {resolvedBackTarget ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 px-0 text-sm"
                    onClick={() => navigate(resolvedBackTarget)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Åbn produktsiden igen
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </StorefrontThemeFrame>
  );
};

export default CanvaReturn;
