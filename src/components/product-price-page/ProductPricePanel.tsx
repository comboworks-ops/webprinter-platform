import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";
import { DEFAULT_BRANDING, type BrandingData } from "@/hooks/useBrandingDraft";
import {
  cloneStandardDeliveryMethods,
  resolveDeliveryMethodCost,
} from "@/lib/delivery/defaults";

type ProductPricePanelProps = {
  productId: string;
  quantity: number;
  productPrice: number;
  extraPrice?: number;
  onShippingChange?: (type: string | null, cost: number) => void;
  summary?: string;
  optionSelections?: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>;
  selectedVariant?: string;
  productName?: string;
  productSlug: string;
  selectedFormat?: string;
  orderDeliveryConfig?: any;
  branding?: BrandingData | null;
  designWidthMm?: number;
  designHeightMm?: number;
  designBleedMm?: number;
  designSafeAreaMm?: number;
  designModuleEnabled?: boolean;
  externalDeliveryEnabled?: boolean;
  externalDeliveryMethods?: DeliveryMethod[];
  externalDeliveryLoading?: boolean;
  externalDeliveryError?: string | null;
  externalDeliveryConfig?: {
    enabled?: boolean;
    max_options?: number;
    labels?: {
      best?: string;
      cheapest?: string;
      fastest?: string;
    };
    show_carrier?: boolean;
    show_deadline?: boolean;
    carrier_logos?: Array<{
      carrier: string;
      logo_url: string;
    }>;
  };
};

export type DeliveryMethod = {
  id: string;
  name: string;
  description?: string;
  lead_time_days?: number;
  production_days?: number;
  shipping_days?: number;
  delivery_window_days?: number;
  auto_mark_delivered?: boolean;
  auto_mark_days?: number;
  price?: number;
  cutoff_time?: string;
  cutoff_label?: "deadline" | "latest";
  cutoff_text?: string;
  delivery_date?: string;
  submission?: string;
  pickup_date?: string;
  carrier?: string;
  method?: string;
  urgency?: string;
  reliability?: number;
  transit_duration?: number;
};

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = cloneStandardDeliveryMethods().map(
  (method) => ({ ...method }),
);

export function ProductPricePanel({
  productId,
  quantity,
  productPrice,
  extraPrice = 0,
  onShippingChange,
  summary,
  optionSelections,
  selectedVariant,
  productName,
  productSlug,
  selectedFormat,
  orderDeliveryConfig,
  branding,
  designWidthMm,
  designHeightMm,
  designBleedMm,
  designSafeAreaMm,
  designModuleEnabled = true,
  externalDeliveryEnabled,
  externalDeliveryMethods,
  externalDeliveryLoading,
  externalDeliveryError,
  externalDeliveryConfig
}: ProductPricePanelProps) {
  const navigate = useNavigate();
  const [shippingSelected, setShippingSelected] = useState<string>("standard");
  const [designReady, setDesignReady] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  const orderButtons = branding?.productPage?.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;
  const orderButtonFont = orderButtons.font || branding?.fonts?.button || DEFAULT_BRANDING.fonts.button;
  const orderButtonAnimationClass = orderButtons.animation === "lift"
    ? "hover:-translate-y-0.5 hover:shadow-md"
    : orderButtons.animation === "glow"
      ? "hover:shadow-lg"
      : orderButtons.animation === "pulse"
        ? "hover:scale-[1.02]"
        : "";
  const orderButtonBaseClass = cn(
    "border-2 transition-all",
    orderButtonAnimationClass,
    "bg-[var(--order-btn-bg)] text-[var(--order-btn-text)] border-[var(--order-btn-border)] hover:bg-[var(--order-btn-hover-bg)] hover:text-[var(--order-btn-hover-text)] hover:border-[var(--order-btn-hover-border)]"
  );
  const buildOrderButtonStyle = (style: typeof orderButtons.primary): CSSProperties => ({
    "--order-btn-bg": style.bgColor,
    "--order-btn-hover-bg": style.hoverBgColor,
    "--order-btn-text": style.textColor,
    "--order-btn-hover-text": style.hoverTextColor,
    "--order-btn-border": style.borderColor ?? style.bgColor,
    "--order-btn-hover-border": style.hoverBorderColor ?? style.hoverBgColor ?? style.bgColor,
    fontFamily: `'${orderButtonFont}', sans-serif`,
  } as CSSProperties);

  const baseTotal = Math.round(productPrice + extraPrice);
  const manualDeliveryMethods: DeliveryMethod[] = (orderDeliveryConfig?.delivery?.methods || []).length > 0
    ? orderDeliveryConfig.delivery.methods
    : DEFAULT_DELIVERY_METHODS;
  const externalMethods: DeliveryMethod[] = externalDeliveryMethods || [];
  const normalizedMethods = manualDeliveryMethods.map((method) => {
    const productionDays = typeof method.production_days === "number" ? method.production_days : 0;
    const shippingDays = typeof method.shipping_days === "number" ? method.shipping_days : 0;
    const leadTime = typeof method.lead_time_days === "number" ? method.lead_time_days : productionDays + shippingDays;
    return { ...method, lead_time_days: leadTime };
  });
  const externalMode = !!externalDeliveryEnabled && (externalDeliveryConfig?.enabled ?? true);
  const normalizeCarrierKey = (value?: string) => (value || "").trim().toLowerCase();
  const carrierLogoMap = useMemo(() => {
    const entries = externalDeliveryConfig?.carrier_logos || [];
    const map = new Map<string, string>();
    entries.forEach((entry) => {
      const key = normalizeCarrierKey(entry?.carrier);
      if (!key) return;
      if (!entry?.logo_url) return;
      map.set(key, entry.logo_url);
    });
    return map;
  }, [externalDeliveryConfig?.carrier_logos]);
  const getCarrierLogo = (carrier?: string, methodName?: string) => {
    const carrierKey = normalizeCarrierKey(carrier);
    if (carrierKey && carrierLogoMap.has(carrierKey)) {
      return carrierLogoMap.get(carrierKey) || null;
    }
    const methodKey = normalizeCarrierKey(methodName);
    if (methodKey && carrierLogoMap.has(methodKey)) {
      return carrierLogoMap.get(methodKey) || null;
    }
    return null;
  };
  const parseDeliveryDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const formatDeadlineDate = (value?: string) => {
    if (!value) return null;
    const parsed = parseDeliveryDate(value);
    if (!parsed) return value;
    return new Intl.DateTimeFormat("da-DK", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(parsed);
  };
  const daysBetween = (a: Date, b: Date) => {
    const diff = Math.abs(a.getTime() - b.getTime());
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };
  const getCuratedExternalMethods = (methods: DeliveryMethod[]) => {
    const maxOptions = Math.max(1, Math.min(4, externalDeliveryConfig?.max_options ?? 3));
    if (methods.length <= maxOptions) return methods;
    const withPrice = methods.filter((method) => Number.isFinite(method.price));
    const candidates = withPrice.length > 0 ? withPrice : methods;
    const cheapest = candidates.reduce((best, current) => {
      if (!best) return current;
      const bestPrice = Number(best.price ?? 0);
      const currentPrice = Number(current.price ?? 0);
      return currentPrice < bestPrice ? current : best;
    }, null as DeliveryMethod | null);
    const fastest = candidates.reduce((best, current) => {
      const currentDate = parseDeliveryDate(current.delivery_date);
      if (!best) return current;
      const bestDate = parseDeliveryDate(best.delivery_date);
      if (!bestDate && currentDate) return current;
      if (bestDate && currentDate && currentDate < bestDate) return current;
      return best;
    }, null as DeliveryMethod | null);

    let bestValue: DeliveryMethod | null = null;
    const fastestDate = fastest ? parseDeliveryDate(fastest.delivery_date) : null;
    if (fastestDate) {
      const nearFastest = candidates.filter((method) => {
        const date = parseDeliveryDate(method.delivery_date);
        return date ? daysBetween(date, fastestDate) <= 2 : false;
      });
      bestValue = nearFastest.reduce((best, current) => {
        if (!best) return current;
        const bestPrice = Number(best.price ?? 0);
        const currentPrice = Number(current.price ?? 0);
        return currentPrice < bestPrice ? current : best;
      }, null as DeliveryMethod | null);
    }
    if (!bestValue) {
      bestValue = cheapest;
    }

    const labels = externalDeliveryConfig?.labels || {};
    const bestLabel = labels.best || "Bedste balance";
    const cheapestLabel = labels.cheapest || "Bedste pris";
    const fastestLabel = labels.fastest || "Hurtigst";
    const picked: DeliveryMethod[] = [];
    const addUnique = (method: DeliveryMethod | null, label: string) => {
      if (!method) return;
      if (picked.find((item) => item.id === method.id)) return;
      picked.push({
        ...method,
        name: label,
      });
    };

    addUnique(bestValue, bestLabel);
    addUnique(cheapest, cheapestLabel);
    addUnique(fastest, fastestLabel);

    if (picked.length < maxOptions) {
      for (const method of candidates) {
        if (picked.length >= maxOptions) break;
        if (!picked.find((item) => item.id === method.id)) {
          picked.push({ ...method, name: "Alternativ" });
        }
      }
    }

    return picked.slice(0, maxOptions);
  };

  const activeDeliveryMethods = externalMode
    ? getCuratedExternalMethods(externalMethods)
    : (normalizedMethods.length > 0 ? normalizedMethods : DEFAULT_DELIVERY_METHODS);
  const activeDeliveryMethod = activeDeliveryMethods.find(method => method.id === shippingSelected) || activeDeliveryMethods[0];

  const computeShippingCost = (method: DeliveryMethod | undefined) => {
    return resolveDeliveryMethodCost(baseTotal, method);
  };

  const parseCutoffTime = (time?: string) => {
    if (!time) return null;
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return { hours, minutes };
  };

  const getNextCutoffDate = (method: DeliveryMethod) => {
    const parsed = parseCutoffTime(method.cutoff_time);
    if (!parsed) return null;
    const cutoff = new Date(now);
    cutoff.setHours(parsed.hours, parsed.minutes, 0, 0);
    if (cutoff.getTime() <= now.getTime()) {
      cutoff.setDate(cutoff.getDate() + 1);
    }
    return cutoff;
  };

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return "0m";
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}t`;
    if (hours > 0) return `${hours}t ${minutes}m`;
    return `${minutes}m`;
  };

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const addBusinessDays = (date: Date, days: number) => {
    const next = new Date(date);
    let remaining = Math.max(0, days);
    while (remaining > 0) {
      next.setDate(next.getDate() + 1);
      const day = next.getDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return next;
  };

  const formatDeliveryDate = (date: Date) => {
    return new Intl.DateTimeFormat("da-DK", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(date);
  };

  const formatDeliveryDateShort = (date: Date) => {
    const weekday = new Intl.DateTimeFormat("da-DK", { weekday: "long" }).format(date);
    const day = new Intl.DateTimeFormat("da-DK", { day: "numeric" }).format(date);
    let month = new Intl.DateTimeFormat("da-DK", { month: "short" }).format(date).toLowerCase();
    if (!month.endsWith(".")) {
      month = `${month}.`;
    }
    return `${weekday} ${day} ${month}`;
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isTomorrow = (date: Date, reference: Date) => {
    const next = new Date(reference);
    next.setDate(next.getDate() + 1);
    return isSameDay(date, next);
  };

  const truncateText = (value: string, maxLength = 25) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
  };

  // Notify parent of shipping cost whenever it changes
  useEffect(() => {
    if (baseTotal > 0) {
      const cost = computeShippingCost(activeDeliveryMethod);
      onShippingChange?.(activeDeliveryMethod?.id || null, cost);
    }
  }, [baseTotal, shippingSelected, activeDeliveryMethod, onShippingChange]);

  useEffect(() => {
    if (!productId) return;
    const key = `order-design:${productId}`;
    setDesignReady(sessionStorage.getItem(key) === "1");
  }, [productId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeDeliveryMethods.length === 0) return;
    if (!activeDeliveryMethods.find(method => method.id === shippingSelected)) {
      setShippingSelected(activeDeliveryMethods[0].id);
    }
  }, [activeDeliveryMethods, shippingSelected]);

  const activeShippingCost = computeShippingCost(activeDeliveryMethod);
  const totalPrice = baseTotal + (baseTotal > 0 ? activeShippingCost : 0);
  const deliveryLabel = activeDeliveryMethod?.name || (externalMode ? "Levering beregnes" : "Levering");

  const generatePDF = () => {
    const doc = new jsPDF();

    // Colors (converted from HSL 199 79% 46%)
    const primaryBlue = [24, 144, 184]; // RGB
    const lightBlue = [210, 236, 245]; // Light blue background
    const darkGray = [34, 43, 54]; // Dark text

    // Header with blue background
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Logo/Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Webprinter.dk', 20, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Professionel print til konkurrencedygtige priser', 20, 28);

    // Date in header
    doc.setFontSize(9);
    doc.text(`Dato: ${new Date().toLocaleDateString('da-DK')}`, 150, 35);

    // Reset text color
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    let yPos = 55;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('TILBUD', 20, yPos);
    yPos += 15;

    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    // Product info box
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(15, yPos - 5, 180, productName ? 15 : 10, 2, 2, 'F');

    if (productName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Produkt: ${productName}`, 20, yPos + 5);
      yPos += 20;
    } else {
      yPos += 15;
    }

    // Configuration section
    if (summary) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('Konfiguration', 20, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const summaryLines = doc.splitTextToSize(summary, 170);
      summaryLines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Variant
    if (selectedVariant) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Materiale/Variant: `, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedVariant, 60, yPos);
      yPos += 8;
    }

    // Options section
    if (optionSelections && Object.keys(optionSelections).length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('Tilvalg', 20, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      Object.values(optionSelections).forEach((option) => {
        doc.text(`✓ ${option.name}`, 25, yPos);
        doc.text(`${option.extraPrice} kr`, 180, yPos, { align: 'right' });
        yPos += 5;
      });
      yPos += 8;
    }

    // Price breakdown box
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(15, yPos - 3, 180, 40 + (extraPrice > 0 ? 5 : 0), 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('Priser (ex. moms)', 20, yPos + 5);
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text('Produktpris:', 20, yPos);
    doc.text(`${productPrice} kr`, 180, yPos, { align: 'right' });
    yPos += 6;

    if (extraPrice > 0) {
      doc.text('Tilvalg i alt:', 20, yPos);
      doc.text(`${extraPrice} kr`, 180, yPos, { align: 'right' });
      yPos += 6;
    }

    doc.text(`Levering (${deliveryLabel}):`, 20, yPos);
    doc.text(`${activeShippingCost} kr`, 180, yPos, { align: 'right' });
    yPos += 12;

    // Total in box
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.roundedRect(15, yPos - 3, 180, 12, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL PRIS EX. MOMS:', 20, yPos + 6);
    doc.text(`${totalPrice} kr`, 180, yPos + 6, { align: 'right' });

    yPos += 20;

    // VAT info
    doc.setFontSize(9);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFont('helvetica', 'italic');
    doc.text(`Pris inkl. 25% moms: ${Math.round(totalPrice * 1.25)} kr`, 20, yPos);

    // Footer
    doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setLineWidth(0.5);
    doc.line(20, 270, 190, 270);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Dette tilbud er gyldigt i 30 dage. Alle priser er ex. moms.', 105, 278, { align: 'center' });
    doc.text('Webprinter.dk | info@webprinter.dk', 105, 283, { align: 'center' });

    // Download
    doc.save(`tilbud-${productName || 'webprinter'}-${new Date().getTime()}.pdf`);
  };

  const handleOrderClick = () => {
    navigate('/checkout/konfigurer', {
      state: {
        productId,
        quantity,
        productPrice,
        extraPrice,
        totalPrice,
        summary,
        optionSelections,
        selectedVariant,
        productName,
        productSlug,
        selectedFormat,
        designWidthMm,
        designHeightMm,
        designBleedMm,
        designSafeAreaMm,
        shippingSelected: activeDeliveryMethod?.id || null,
        shippingCost: activeShippingCost
      }
    });
  };

  return (
    <div className="sticky top-24 bg-primary/5 border-2 border-primary/20 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-heading font-bold">Prisberegning</h3>
        {baseTotal > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={generatePDF}
            className={cn(orderButtonBaseClass, "gap-2")}
            style={buildOrderButtonStyle(orderButtons.secondary)}
          >
            <Download className="h-4 w-4" />
            Download tilbud
          </Button>
        )}
      </div>

      {/* Summary Section */}
      {(summary || (optionSelections && Object.keys(optionSelections).length > 0)) && (
        <div className="pb-4 mb-4 border-b border-primary/10">
          <p className="text-sm font-medium text-foreground mb-2">Valgt konfiguration:</p>
          {summary && (
            <p className="text-sm text-muted-foreground">{summary}</p>
          )}
          {baseTotal > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Levering: {deliveryLabel}
            </p>
          )}
          {optionSelections && Object.keys(optionSelections).length > 0 && (
            <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
              {Object.values(optionSelections).map((option, idx) => (
                <p key={idx}>+ {option.name}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product price */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pris ex. moms</p>
            <p className="text-4xl font-heading font-bold text-primary">
              {baseTotal > 0 ? `${baseTotal} kr` : "-"}
            </p>
          </div>
          {baseTotal > 0 && (
            <div className="flex flex-col items-stretch gap-2">
              {designModuleEnabled && (
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    orderButtonBaseClass,
                    "gap-2 py-5",
                    !designReady && "border-dashed"
                  )}
                  style={buildOrderButtonStyle(designReady ? orderButtons.selected : orderButtons.secondary)}
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('productId', productId);
                    if (selectedFormat) params.set('format', selectedFormat);
                    if (selectedVariant) params.set('variant', selectedVariant);
                    if (typeof designWidthMm === "number" && designWidthMm > 0 && typeof designHeightMm === "number" && designHeightMm > 0) {
                      params.set('widthMm', String(designWidthMm));
                      params.set('heightMm', String(designHeightMm));
                    }
                    if (typeof designBleedMm === "number" && designBleedMm >= 0) {
                      params.set('bleedMm', String(designBleedMm));
                    }
                    if (typeof designSafeAreaMm === "number" && designSafeAreaMm >= 0) {
                      params.set('safeMm', String(designSafeAreaMm));
                    }
                    params.set('order', '1');
                    params.set('returnTo', `/produkt/${productSlug}`);
                    navigate(`/designer?${params.toString()}`);
                  }}
                >
                  {designReady ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  )}
                  {designReady ? "Design klar" : "Design online"}
                </Button>
              )}
              <Button
                size="lg"
                className={cn(orderButtonBaseClass, "px-6 py-6 text-lg font-semibold")}
                style={buildOrderButtonStyle(orderButtons.primary)}
                onClick={handleOrderClick}
              >
                Bestil nu!
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delivery options - Always Visible */}
      {baseTotal > 0 && (
        <div className="space-y-3 pt-4">
          <Label className="text-base font-semibold">Levering</Label>
          {externalMode && externalDeliveryLoading && (
            <p className="text-xs text-muted-foreground">Henter leveringsmuligheder...</p>
          )}
          {externalMode && externalDeliveryError && (
            <p className="text-xs text-destructive">{externalDeliveryError}</p>
          )}
          {activeDeliveryMethods.length === 0 && (
            <p className="text-xs text-muted-foreground">Ingen leveringsmuligheder endnu.</p>
          )}
          <RadioGroup value={shippingSelected} onValueChange={setShippingSelected} className="space-y-2">
            {activeDeliveryMethods.map((method) => {
              const isSelected = shippingSelected === method.id;
              const productionDays = method.production_days ?? 0;
              const shippingDays = method.shipping_days ?? 0;
              const baseDays = productionDays + shippingDays;
              const minDays = baseDays > 0 ? baseDays : (typeof method.lead_time_days === "number" ? method.lead_time_days : 0);
              const windowDays = method.delivery_window_days ?? 0;
              const maxDays = minDays + Math.max(0, windowDays);
              const hasFixedDeliveryDate = !!method.delivery_date;
              const cutoffDate = hasFixedDeliveryDate ? null : getNextCutoffDate(method);
              const countdownLabel = cutoffDate ? formatCountdown(cutoffDate.getTime() - now.getTime()) : null;
              const cutoffLabelText = method.cutoff_label === "latest" ? "Senest bestilling" : "Deadline";
              const descriptionLine = method.description?.trim();
              const descriptionShort = descriptionLine ? truncateText(descriptionLine, 25) : "";
              const cutoffTimeLabel = !hasFixedDeliveryDate && method.cutoff_time
                ? (cutoffDate && isSameDay(cutoffDate, now)
                  ? `${cutoffLabelText} i dag kl. ${method.cutoff_time}`
                  : cutoffDate && isTomorrow(cutoffDate, now)
                    ? `${cutoffLabelText} i morgen kl. ${method.cutoff_time}`
                    : `${cutoffLabelText} kl. ${method.cutoff_time}`)
                : null;
              const showDeadline = externalMode ? (externalDeliveryConfig?.show_deadline ?? false) : true;
              const submissionLabel = showDeadline ? formatDeadlineDate(method.submission) : null;
              const effectiveCountdown = showDeadline ? countdownLabel : null;
              const orderDate = cutoffDate ? new Date(cutoffDate) : new Date(now);
              const fixedDeliveryDate = method.delivery_date ? new Date(method.delivery_date) : null;
              const earliestDelivery = fixedDeliveryDate
                ? fixedDeliveryDate
                : (minDays > 0 ? addBusinessDays(orderDate, minDays) : null);
              const latestDelivery = fixedDeliveryDate
                ? fixedDeliveryDate
                : (maxDays > 0 ? addBusinessDays(orderDate, maxDays) : null);
              const deliveryDateLabel = earliestDelivery && latestDelivery
                ? earliestDelivery.toDateString() === latestDelivery.toDateString()
                  ? `Levering: ${formatDeliveryDateShort(earliestDelivery)}`
                  : `Levering: ${formatDeliveryDateShort(earliestDelivery)} - ${formatDeliveryDateShort(latestDelivery)}`
                : null;
              const cost = computeShippingCost(method);
              const showCarrierLogo = externalMode && (externalDeliveryConfig?.show_carrier ?? false);
              const carrierLogo = showCarrierLogo ? getCarrierLogo(method.carrier, method.method) : null;
              const nameLabel = externalMode
                ? method.name
                : `${method.name}${!/levering/i.test(method.name) ? " levering" : ""}`;

              return (
                <div
                  key={method.id}
                  className={cn(
                    "flex items-start space-x-2 p-3 border rounded-md transition-colors",
                    isSelected ? "bg-primary/5 border-primary" : "bg-background"
                  )}
                >
                  <RadioGroupItem value={method.id} id={`delivery-${method.id}`} />
                  <Label htmlFor={`delivery-${method.id}`} className="cursor-pointer flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          {carrierLogo && (
                            <span className="inline-flex items-center justify-center rounded border bg-background px-1.5 py-1">
                              <img
                                src={carrierLogo}
                                alt={method.carrier || method.method || "Carrier"}
                                className="h-4 w-auto object-contain"
                                loading="lazy"
                              />
                            </span>
                          )}
                          <span className="text-sm font-medium">
                            {nameLabel}
                          </span>
                          {descriptionShort && (
                            <span className="text-[11px] text-muted-foreground">
                              {descriptionShort}
                            </span>
                          )}
                        </div>
                        {(effectiveCountdown || cutoffTimeLabel) && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {effectiveCountdown && (
                              <span className="inline-flex items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                {effectiveCountdown}
                              </span>
                            )}
                            {showDeadline && cutoffTimeLabel && <span>{cutoffTimeLabel}</span>}
                          </div>
                        )}
                        {showDeadline && submissionLabel && (
                          <div className="mt-1 text-xs text-muted-foreground">Bestil senest: {submissionLabel}</div>
                        )}
                        {deliveryDateLabel && (
                          <div className="mt-1 text-xs text-muted-foreground">{deliveryDateLabel}</div>
                        )}
                      </div>
                      <span className="font-semibold text-primary text-sm">{cost} kr</span>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="flex justify-between items-end pt-4 border-t border-primary/20">
            <span className="text-sm text-muted-foreground">Samlet pris ex. moms:</span>
            <span className="text-4xl font-heading font-bold text-primary">{totalPrice} kr</span>
          </div>
        </div>
      )}

      {baseTotal === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Vælg en pris i matrixen for at se beregning
        </p>
      )}
    </div>
  );
}
