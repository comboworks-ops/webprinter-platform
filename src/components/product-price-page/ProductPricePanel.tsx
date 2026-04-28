import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { deliveryFee } from "@/utils/productPricing";
import { Download, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { DEFAULT_BRANDING, mergeBrandingWithDefaults, type BrandingData } from "@/lib/branding";
import { stageSiteCheckoutTransfer, writeSiteCheckoutSession, type SiteCheckoutState } from "@/lib/checkout/siteCheckoutSession";

type ProductPricePanelProps = {
  productId: string;
  quantity: number;
  productPrice: number;
  extraPrice?: number;
  deliveryBusinessDayOffset?: number;
  orderValidationError?: string | null;
  onShippingChange?: (type: string | null, cost: number) => void;
  summary?: string;
  optionSelections?: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>;
  selectedVariant?: string;
  productName?: string;
  productSlug: string;
  selectedFormat?: string;
  linkedTemplateId?: string | null;
  branding?: Partial<BrandingData> | null;
  orderDeliveryConfig?: any;
  designWidthMm?: number;
  designHeightMm?: number;
  designBleedMm?: number;
  designSafeAreaMm?: number;
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
  canvaOffer?: {
    enabled: boolean;
    launchUrl: string | null;
    buttonLabel?: string | null;
    helperText?: string | null;
  } | null;
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

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = [
  {
    id: "standard",
    name: "Standard",
    description: "",
    lead_time_days: 4,
    production_days: 2,
    shipping_days: 2,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 0,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: ""
  },
  {
    id: "express",
    name: "Express",
    description: "",
    lead_time_days: 2,
    production_days: 1,
    shipping_days: 1,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 0,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: ""
  }
];

const MotionButton = motion(Button);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hexToRgba = (color: string, alpha: number): string => {
  const normalized = String(color || "").trim();
  const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);

  const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("").map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (longMatch) {
    const hex = longMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return normalized || `rgba(0, 0, 0, ${a})`;
};

const getHexLuminance = (color?: string | null): number | null => {
  const normalized = String(color || "").trim();
  const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  const hex = shortMatch
    ? shortMatch[1].split("").map((part) => `${part}${part}`).join("")
    : longMatch?.[1];

  if (!hex) return null;

  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastRatio = (a?: string | null, b?: string | null): number | null => {
  const lumA = getHexLuminance(a);
  const lumB = getHexLuminance(b);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

const ensureReadableTextColor = (background: string, preferred: string, dark = "#0F172A", light = "#FFFFFF") => {
  const contrast = getContrastRatio(background, preferred);
  if (contrast === null || contrast >= 4.5) return preferred;
  const darkContrast = getContrastRatio(background, dark) || 0;
  const lightContrast = getContrastRatio(background, light) || 0;
  return darkContrast >= lightContrast ? dark : light;
};

export function ProductPricePanel({
  productId,
  quantity,
  productPrice,
  extraPrice = 0,
  deliveryBusinessDayOffset = 0,
  orderValidationError,
  onShippingChange,
  summary,
  optionSelections,
  selectedVariant,
  productName,
  productSlug,
  selectedFormat,
  linkedTemplateId,
  branding,
  orderDeliveryConfig,
  designWidthMm,
  designHeightMm,
  designBleedMm,
  designSafeAreaMm,
  externalDeliveryEnabled,
  externalDeliveryMethods,
  externalDeliveryLoading,
  externalDeliveryError,
  externalDeliveryConfig,
  canvaOffer
}: ProductPricePanelProps) {
  const navigate = useNavigate();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const shouldReduceMotion = useReducedMotion();
  const [shippingSelected, setShippingSelected] = useState<string>("standard");
  const [designReady, setDesignReady] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const activeBranding = useMemo(() => {
    if (isPreviewMode && previewBranding) {
      return mergeBrandingWithDefaults(previewBranding);
    }
    return mergeBrandingWithDefaults(branding || {});
  }, [branding, isPreviewMode, previewBranding]);

  const orderButtonDefaults = useMemo(() => {
    const primaryColor = activeBranding.colors.primary || "#0EA5E9";
    const hoverColor = primaryColor;
    const borderColor = activeBranding.colors.secondary || "#E2E8F0";

    return {
      primary: {
        bgColor: primaryColor,
        hoverBgColor: hoverColor,
        textColor: "#FFFFFF",
        hoverTextColor: "#FFFFFF",
        borderColor: primaryColor,
        hoverBorderColor: hoverColor,
      },
      secondary: {
        bgColor: activeBranding.colors.card || "#FFFFFF",
        hoverBgColor: activeBranding.colors.secondary || "#F1F5F9",
        textColor: activeBranding.colors.bodyText || "#4B5563",
        hoverTextColor: activeBranding.colors.headingText || "#1F2937",
        borderColor,
        hoverBorderColor: hoverColor,
      },
      selected: {
        bgColor: "#16A34A",
        hoverBgColor: "#15803D",
        textColor: "#FFFFFF",
        hoverTextColor: "#FFFFFF",
        borderColor: "#16A34A",
        hoverBorderColor: "#15803D",
      },
    };
  }, [activeBranding]);

  const orderButtonStyles = useMemo(() => {
    const configured = (activeBranding.productPage?.orderButtons || DEFAULT_BRANDING.productPage.orderButtons) as any;
    const resolveButton = (button: any, fallback: typeof orderButtonDefaults.primary) => {
      const bgColor = button?.bgColor || fallback.bgColor;
      const hoverBgColor = button?.hoverBgColor || fallback.hoverBgColor;
      const gradientStart = button?.gradientStart || configured.gradientStart || bgColor;
      const hoverGradientStart = button?.hoverGradientStart || configured.hoverGradientStart || hoverBgColor;
      const textColor = button?.textColor || fallback.textColor;
      const hoverTextColor = button?.hoverTextColor || fallback.hoverTextColor;

      return {
        bgColor,
        hoverBgColor,
        gradientStart,
        gradientEnd: button?.gradientEnd || configured.gradientEnd || bgColor,
        hoverGradientStart,
        hoverGradientEnd: button?.hoverGradientEnd || configured.hoverGradientEnd || hoverBgColor,
        textColor: ensureReadableTextColor(gradientStart, textColor),
        hoverTextColor: ensureReadableTextColor(hoverGradientStart, hoverTextColor),
        borderColor: button?.borderColor || fallback.borderColor,
        hoverBorderColor: button?.hoverBorderColor || fallback.hoverBorderColor,
      };
    };

    return {
      primary: resolveButton(configured.primary, orderButtonDefaults.primary),
      secondary: resolveButton(configured.secondary, orderButtonDefaults.secondary),
      selected: resolveButton(configured.selected, orderButtonDefaults.selected),
    };
  }, [activeBranding.productPage?.orderButtons, orderButtonDefaults]);

  const orderButtonMotion = useMemo(() => {
    const configured = (activeBranding.productPage?.orderButtons || DEFAULT_BRANDING.productPage.orderButtons) as any;
    const enhanced = Boolean(
      configured.surfaceStyle ||
      configured.gradientStart ||
      configured.gradientEnd ||
      configured.hoverGradientStart ||
      configured.hoverGradientEnd ||
      configured.innerShadow ||
      configured.sheenColor ||
      configured.shadow ||
      configured.hoverShadow ||
      configured.hoverScale ||
      configured.hoverY ||
      configured.tapScale ||
      configured.transitionMs ||
      configured.motionStyle
    );
    const transitionMs = clamp(Number(configured.transitionMs) || 170, 80, 420);
    return {
      enhanced,
      radiusPx: clamp(Number(configured.radiusPx) || 10, 0, 999),
      shadow: enhanced ? configured.shadow || "0 8px 18px rgba(15, 23, 42, 0.10)" : undefined,
      hoverShadow: enhanced ? configured.hoverShadow || "0 14px 28px rgba(15, 23, 42, 0.16)" : undefined,
      hoverScale: enhanced ? clamp(Number(configured.hoverScale) || 1.015, 1, 1.08) : 1,
      hoverY: enhanced ? clamp(Number(configured.hoverY) || -1, -10, 0) : 0,
      tapScale: enhanced ? clamp(Number(configured.tapScale) || 0.98, 0.92, 1) : 1,
      transitionMs,
      motionStyle: String(configured.motionStyle || "smooth"),
      surfaceStyle: enhanced ? String(configured.surfaceStyle || "matte") : "plain",
      innerShadow: enhanced ? configured.innerShadow || "inset 0 1px 0 rgba(255, 255, 255, 0.18)" : undefined,
      sheenColor: enhanced ? configured.sheenColor || "rgba(255, 255, 255, 0.28)" : "transparent",
    };
  }, [activeBranding.productPage?.orderButtons]);

  const pricePanelStyles = useMemo(() => {
    const primaryColor = activeBranding.colors.primary || "#0EA5E9";
    const headingColor = activeBranding.colors.headingText || "#1F2937";
    const bodyColor = activeBranding.colors.bodyText || "#475569";
    const cardColor = activeBranding.colors.card || "#FFFFFF";
    const secondaryColor = activeBranding.colors.secondary || "#E2E8F0";
    const configured = activeBranding.productPage?.pricePanel || DEFAULT_BRANDING.productPage.pricePanel;

    const resolved = {
      backgroundType: configured.backgroundType || "solid",
      backgroundColor: configured.backgroundColor || hexToRgba(primaryColor, 0.05),
      gradientStart: configured.gradientStart || hexToRgba(primaryColor, 0.1),
      gradientEnd: configured.gradientEnd || cardColor,
      gradientAngle: clamp(Number(configured.gradientAngle) || 135, 0, 360),
      titleColor: configured.titleColor || headingColor,
      textColor: configured.textColor || headingColor,
      mutedTextColor: configured.mutedTextColor || bodyColor,
      priceColor: configured.priceColor || primaryColor,
      borderColor: configured.borderColor || hexToRgba(primaryColor, 0.18),
      borderWidth: clamp(Number(configured.borderWidth) || 2, 0, 8),
      radiusPx: clamp(Number(configured.radiusPx) || 12, 0, 40),
      dividerColor: configured.dividerColor || hexToRgba(primaryColor, 0.12),
      optionBg: configured.optionBg || cardColor,
      optionHoverBg: configured.optionHoverBg || hexToRgba(primaryColor, 0.04),
      optionSelectedBg: configured.optionSelectedBg || hexToRgba(primaryColor, 0.08),
      optionBorderColor: configured.optionBorderColor || secondaryColor,
      optionHoverBorderColor: configured.optionHoverBorderColor || hexToRgba(primaryColor, 0.3),
      optionSelectedBorderColor: configured.optionSelectedBorderColor || primaryColor,
      badgeBg: configured.badgeBg || hexToRgba(primaryColor, 0.1),
      badgeText: configured.badgeText || primaryColor,
      badgeBorderColor: configured.badgeBorderColor || primaryColor,
      downloadButtonBg: configured.downloadButtonBg || cardColor,
      downloadButtonHoverBg: configured.downloadButtonHoverBg || hexToRgba(primaryColor, 0.04),
      downloadButtonText: configured.downloadButtonText || headingColor,
      downloadButtonHoverText: configured.downloadButtonHoverText || headingColor,
      downloadButtonBorder: configured.downloadButtonBorder || secondaryColor,
      downloadButtonHoverBorder: configured.downloadButtonHoverBorder || hexToRgba(primaryColor, 0.3),
      downloadButtonSurfaceStyle: (configured as any).downloadButtonSurfaceStyle || "matte",
      downloadButtonGradientStart: (configured as any).downloadButtonGradientStart || configured.downloadButtonBg || cardColor,
      downloadButtonGradientEnd: (configured as any).downloadButtonGradientEnd || configured.downloadButtonBg || cardColor,
      downloadButtonHoverGradientStart: (configured as any).downloadButtonHoverGradientStart || configured.downloadButtonHoverBg || hexToRgba(primaryColor, 0.04),
      downloadButtonHoverGradientEnd: (configured as any).downloadButtonHoverGradientEnd || configured.downloadButtonHoverBg || hexToRgba(primaryColor, 0.04),
      downloadButtonShadow: (configured as any).downloadButtonShadow || "0 4px 12px rgba(15, 23, 42, 0.08)",
      downloadButtonHoverShadow: (configured as any).downloadButtonHoverShadow || "0 8px 20px rgba(15, 23, 42, 0.12)",
    };

    const background = resolved.backgroundType === "gradient"
      ? `linear-gradient(${resolved.gradientAngle}deg, ${resolved.gradientStart}, ${resolved.gradientEnd})`
      : resolved.backgroundColor;

    const containerStyle = {
      background,
      borderColor: resolved.borderColor,
      borderWidth: `${resolved.borderWidth}px`,
      borderRadius: `${resolved.radiusPx}px`,
      color: resolved.textColor,
      ["--price-panel-title" as any]: resolved.titleColor,
      ["--price-panel-text" as any]: resolved.textColor,
      ["--price-panel-muted" as any]: resolved.mutedTextColor,
      ["--price-panel-price" as any]: resolved.priceColor,
      ["--price-panel-divider" as any]: resolved.dividerColor,
      ["--price-panel-option-bg" as any]: resolved.optionBg,
      ["--price-panel-option-hover-bg" as any]: resolved.optionHoverBg,
      ["--price-panel-option-selected-bg" as any]: resolved.optionSelectedBg,
      ["--price-panel-option-border" as any]: resolved.optionBorderColor,
      ["--price-panel-option-hover-border" as any]: resolved.optionHoverBorderColor,
      ["--price-panel-option-selected-border" as any]: resolved.optionSelectedBorderColor,
      ["--price-panel-badge-bg" as any]: resolved.badgeBg,
      ["--price-panel-badge-text" as any]: resolved.badgeText,
      ["--price-panel-badge-border" as any]: resolved.badgeBorderColor,
      ["--price-panel-download-bg" as any]: resolved.downloadButtonBg,
      ["--price-panel-download-hover-bg" as any]: resolved.downloadButtonHoverBg,
      ["--price-panel-download-text" as any]: resolved.downloadButtonText,
      ["--price-panel-download-hover-text" as any]: resolved.downloadButtonHoverText,
      ["--price-panel-download-border" as any]: resolved.downloadButtonBorder,
      ["--price-panel-download-hover-border" as any]: resolved.downloadButtonHoverBorder,
      ["--price-panel-download-surface" as any]: `linear-gradient(180deg, ${resolved.downloadButtonGradientStart}, ${resolved.downloadButtonGradientEnd})`,
      ["--price-panel-download-hover-surface" as any]: `linear-gradient(180deg, ${resolved.downloadButtonHoverGradientStart}, ${resolved.downloadButtonHoverGradientEnd})`,
      ["--price-panel-download-shadow" as any]: resolved.downloadButtonShadow,
      ["--price-panel-download-hover-shadow" as any]: resolved.downloadButtonHoverShadow,
    } as CSSProperties;

    return {
      config: resolved,
      containerStyle,
    };
  }, [activeBranding]);

  const normalizedProductPrice = Number.isFinite(Number(productPrice)) ? Math.round(Number(productPrice)) : 0;
  const normalizedExtraPrice = Number.isFinite(Number(extraPrice)) ? Math.round(Number(extraPrice)) : 0;
  const baseTotal = Math.round(normalizedProductPrice + normalizedExtraPrice);
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
    if (!method || baseTotal <= 0) return 0;
    if ((method.price ?? 0) > 0) {
      return Math.round(method.price ?? 0);
    }
    if (method.id === "standard" || method.id === "express") {
      return deliveryFee(baseTotal, method.id);
    }
    return 0;
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
  const hasStableSelection = quantity > 0 || !!selectedVariant || !!summary;
  const canDownloadOffer = baseTotal > 0;
  const canOrder = baseTotal > 0 && !orderValidationError;
  const primaryButtonCssVars = {
    ["--order-primary-bg" as any]: orderButtonStyles.primary.bgColor,
    ["--order-primary-hover-bg" as any]: orderButtonStyles.primary.hoverBgColor,
    ["--order-primary-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.primary.gradientStart}, ${orderButtonStyles.primary.gradientEnd})`,
    ["--order-primary-hover-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.primary.hoverGradientStart}, ${orderButtonStyles.primary.hoverGradientEnd})`,
    ["--order-primary-text" as any]: orderButtonStyles.primary.textColor,
    ["--order-primary-hover-text" as any]: orderButtonStyles.primary.hoverTextColor,
    ["--order-primary-border" as any]: orderButtonStyles.primary.borderColor,
    ["--order-primary-hover-border" as any]: orderButtonStyles.primary.hoverBorderColor,
    ["--order-inner-shadow" as any]: orderButtonMotion.innerShadow || "none",
    ["--order-sheen-color" as any]: orderButtonMotion.sheenColor,
    ["--order-button-shadow" as any]: orderButtonMotion.shadow || "none",
    borderRadius: `${orderButtonMotion.radiusPx}px`,
    boxShadow: orderButtonMotion.shadow,
  } as any;
  const secondaryButtonCssVars = {
    ["--order-secondary-bg" as any]: orderButtonStyles.secondary.bgColor,
    ["--order-secondary-hover-bg" as any]: orderButtonStyles.secondary.hoverBgColor,
    ["--order-secondary-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.secondary.gradientStart}, ${orderButtonStyles.secondary.gradientEnd})`,
    ["--order-secondary-hover-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.secondary.hoverGradientStart}, ${orderButtonStyles.secondary.hoverGradientEnd})`,
    ["--order-secondary-text" as any]: orderButtonStyles.secondary.textColor,
    ["--order-secondary-hover-text" as any]: orderButtonStyles.secondary.hoverTextColor,
    ["--order-secondary-border" as any]: orderButtonStyles.secondary.borderColor,
    ["--order-secondary-hover-border" as any]: orderButtonStyles.secondary.hoverBorderColor,
    ["--order-inner-shadow" as any]: orderButtonMotion.innerShadow || "none",
    ["--order-sheen-color" as any]: orderButtonMotion.sheenColor,
    ["--order-button-shadow" as any]: orderButtonMotion.shadow || "none",
    borderRadius: `${orderButtonMotion.radiusPx}px`,
    boxShadow: orderButtonMotion.shadow,
  } as any;
  const selectedButtonCssVars = {
    ["--order-selected-bg" as any]: orderButtonStyles.selected.bgColor,
    ["--order-selected-hover-bg" as any]: orderButtonStyles.selected.hoverBgColor,
    ["--order-selected-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.selected.gradientStart}, ${orderButtonStyles.selected.gradientEnd})`,
    ["--order-selected-hover-surface" as any]: `linear-gradient(180deg, ${orderButtonStyles.selected.hoverGradientStart}, ${orderButtonStyles.selected.hoverGradientEnd})`,
    ["--order-selected-text" as any]: orderButtonStyles.selected.textColor,
    ["--order-selected-hover-text" as any]: orderButtonStyles.selected.hoverTextColor,
    ["--order-selected-border" as any]: orderButtonStyles.selected.borderColor,
    ["--order-selected-hover-border" as any]: orderButtonStyles.selected.hoverBorderColor,
    ["--order-inner-shadow" as any]: orderButtonMotion.innerShadow || "none",
    ["--order-sheen-color" as any]: orderButtonMotion.sheenColor,
    ["--order-button-shadow" as any]: orderButtonMotion.shadow || "none",
    borderRadius: `${orderButtonMotion.radiusPx}px`,
    boxShadow: orderButtonMotion.shadow,
  } as any;

  const orderButtonMotionProps = shouldReduceMotion || !orderButtonMotion.enhanced ? {} : {
    whileHover: {
      scale: orderButtonMotion.hoverScale,
      y: orderButtonMotion.hoverY,
      boxShadow: orderButtonMotion.hoverShadow,
    },
    whileTap: {
      scale: orderButtonMotion.tapScale,
      y: 0,
      boxShadow: orderButtonMotion.shadow,
    },
    transition: orderButtonMotion.motionStyle === "elastic"
      ? { type: "spring" as const, stiffness: 360, damping: 22 }
      : { type: "tween" as const, duration: orderButtonMotion.transitionMs / 1000, ease: "easeOut" as const },
  };

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
    doc.roundedRect(15, yPos - 3, 180, 40 + (normalizedExtraPrice > 0 ? 5 : 0), 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('Priser (ex. moms)', 20, yPos + 5);
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text('Produktpris:', 20, yPos);
    doc.text(`${normalizedProductPrice} kr`, 180, yPos, { align: 'right' });
    yPos += 6;

    if (normalizedExtraPrice > 0) {
      doc.text('Tilvalg i alt:', 20, yPos);
      doc.text(`${normalizedExtraPrice} kr`, 180, yPos, { align: 'right' });
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

  const buildCheckoutState = (): SiteCheckoutState => ({
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
      linkedTemplateId: linkedTemplateId ?? null,
      designWidthMm: designWidthMm ?? null,
      designHeightMm: designHeightMm ?? null,
      designBleedMm: designBleedMm ?? null,
      designSafeAreaMm: designSafeAreaMm ?? null,
      shippingSelected: activeDeliveryMethod?.id || null,
      shippingCost: activeShippingCost,
      createdAt: new Date().toISOString(),
  });

  const handleOrderClick = () => {
    if (orderValidationError) return;
    const tenantQuery = typeof window !== 'undefined' ? window.location.search : '';
    const checkoutState = buildCheckoutState();
    writeSiteCheckoutSession(checkoutState);
    navigate(`/checkout/konfigurer${tenantQuery}`, {
      state: checkoutState,
    });
  };

  const persistCheckoutState = (options?: { crossTab?: boolean }) => {
    const checkoutState = buildCheckoutState();
    writeSiteCheckoutSession(checkoutState);
    if (options?.crossTab) {
      stageSiteCheckoutTransfer(checkoutState);
    }
    return checkoutState;
  };

  return (
    <div
      data-branding-id="productPage.pricePanel.box"
      className="sticky top-24 space-y-4 overflow-hidden border p-6"
      style={pricePanelStyles.containerStyle}
    >
      <style>{`
        .price-panel-title {
          color: var(--price-panel-title) !important;
        }
        .price-panel-text {
          color: var(--price-panel-text) !important;
        }
        .price-panel-muted {
          color: var(--price-panel-muted) !important;
        }
        .price-panel-price {
          color: var(--price-panel-price) !important;
        }
        .price-panel-divider {
          border-color: var(--price-panel-divider) !important;
        }
        .price-panel-download-button {
          background: var(--price-panel-download-surface) !important;
          color: var(--price-panel-download-text) !important;
          border-color: var(--price-panel-download-border) !important;
          box-shadow: var(--price-panel-download-shadow) !important;
          transition: background 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease;
        }
        .price-panel-download-button:hover:not(:disabled) {
          background: var(--price-panel-download-hover-surface) !important;
          color: var(--price-panel-download-hover-text) !important;
          border-color: var(--price-panel-download-hover-border) !important;
          box-shadow: var(--price-panel-download-hover-shadow) !important;
          transform: translateY(-1px);
        }
        .price-panel-download-button[data-surface="pressed"]:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .price-panel-download-button[data-surface="apple-glass"] {
          backdrop-filter: blur(14px) saturate(1.25);
        }
        .price-panel-download-button[data-surface="luminous"]:hover:not(:disabled) {
          filter: saturate(1.08) brightness(1.03);
        }
        .price-panel-option {
          background-color: var(--price-panel-option-bg) !important;
          border-color: var(--price-panel-option-border) !important;
        }
        .price-panel-option:hover {
          background-color: var(--price-panel-option-hover-bg) !important;
          border-color: var(--price-panel-option-hover-border) !important;
        }
        .price-panel-option--selected,
        .price-panel-option--selected:hover {
          background-color: var(--price-panel-option-selected-bg) !important;
          border-color: var(--price-panel-option-selected-border) !important;
        }
        .price-panel-badge {
          background-color: var(--price-panel-badge-bg) !important;
          color: var(--price-panel-badge-text) !important;
          border-color: var(--price-panel-badge-border) !important;
        }
        .order-primary-button {
          position: relative;
          overflow: hidden;
          background: var(--order-primary-surface) !important;
          color: var(--order-primary-text) !important;
          border-color: var(--order-primary-border) !important;
          box-shadow: var(--order-inner-shadow), var(--order-button-shadow, none) !important;
        }
        .order-primary-button:hover:not(:disabled) {
          background: var(--order-primary-hover-surface) !important;
          color: var(--order-primary-hover-text) !important;
          border-color: var(--order-primary-hover-border) !important;
        }
        .order-secondary-button {
          position: relative;
          overflow: hidden;
          background: var(--order-secondary-surface) !important;
          color: var(--order-secondary-text) !important;
          border-color: var(--order-secondary-border) !important;
          box-shadow: var(--order-inner-shadow), var(--order-button-shadow, none) !important;
        }
        .order-secondary-button:hover:not(:disabled) {
          background: var(--order-secondary-hover-surface) !important;
          color: var(--order-secondary-hover-text) !important;
          border-color: var(--order-secondary-hover-border) !important;
        }
        .order-selected-button {
          position: relative;
          overflow: hidden;
          background: var(--order-selected-surface) !important;
          color: var(--order-selected-text) !important;
          border-color: var(--order-selected-border) !important;
          box-shadow: var(--order-inner-shadow), var(--order-button-shadow, none) !important;
        }
        .order-selected-button:hover:not(:disabled) {
          background: var(--order-selected-hover-surface) !important;
          color: var(--order-selected-hover-text) !important;
          border-color: var(--order-selected-hover-border) !important;
        }
        .order-primary-button::before,
        .order-secondary-button::before,
        .order-selected-button::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, var(--order-sheen-color), transparent 42%),
            linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.34) 44%, transparent 60%);
          opacity: 0.38;
          transform: translateX(-36%);
          transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease;
        }
        .order-primary-button:hover::before,
        .order-secondary-button:hover::before,
        .order-selected-button:hover::before {
          opacity: 0.65;
          transform: translateX(28%);
        }
        .order-primary-button[data-surface="apple-glass"],
        .order-secondary-button[data-surface="apple-glass"],
        .order-selected-button[data-surface="apple-glass"] {
          backdrop-filter: blur(18px) saturate(1.3);
        }
        .order-primary-button[data-surface="apple-glass"]::before,
        .order-secondary-button[data-surface="apple-glass"]::before,
        .order-selected-button[data-surface="apple-glass"]::before {
          background:
            radial-gradient(circle at 30% 0%, rgba(255,255,255,0.88), transparent 36%),
            linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.5) 42%, transparent 58%);
          opacity: 0.45;
        }
        .order-primary-button[data-surface="pressed"]::before,
        .order-secondary-button[data-surface="pressed"]::before,
        .order-selected-button[data-surface="pressed"]::before {
          opacity: 0.12;
          transform: none;
        }
        .order-primary-button[data-surface="pressed"]:hover::before,
        .order-secondary-button[data-surface="pressed"]:hover::before,
        .order-selected-button[data-surface="pressed"]:hover::before {
          opacity: 0.2;
          transform: none;
        }
        .order-primary-button[data-surface="luminous"]::before,
        .order-secondary-button[data-surface="luminous"]::before,
        .order-selected-button[data-surface="luminous"]::before {
          background:
            radial-gradient(circle at 50% -20%, rgba(255,255,255,0.7), transparent 35%),
            linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.38) 45%, transparent 62%);
          opacity: 0.5;
        }
        .order-primary-button[data-surface="plain"]::before,
        .order-secondary-button[data-surface="plain"]::before,
        .order-selected-button[data-surface="plain"]::before {
          display: none;
        }
      `}</style>
      <div className="flex items-center justify-between">
        <h3
          data-branding-id="productPage.pricePanel.titleColor"
          className="price-panel-title text-2xl font-heading font-bold"
        >
          Prisberegning
        </h3>
        {hasStableSelection && (
          <span
            data-site-design-target="productPage.pricePanel.downloadButton"
            className="inline-flex"
          >
            <Button
              data-branding-id="productPage.pricePanel.downloadButton"
              data-surface={pricePanelStyles.config.downloadButtonSurfaceStyle}
              variant="outline"
              size="sm"
              onClick={generatePDF}
              className="price-panel-download-button gap-2"
              disabled={!canDownloadOffer}
            >
              <Download className="h-4 w-4" />
              Download tilbud
            </Button>
          </span>
        )}
      </div>

      {/* Summary Section */}
      {(summary || (optionSelections && Object.keys(optionSelections).length > 0)) && (
        <div className="price-panel-divider mb-4 border-b pb-4">
          <p data-branding-id="productPage.pricePanel.text" className="price-panel-text mb-2 text-sm font-medium">Valgt konfiguration:</p>
          {summary && (
            <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-sm">{summary}</p>
          )}
          {baseTotal > 0 && (
            <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted mt-1 text-sm">
              Levering: {deliveryLabel}
            </p>
          )}
          {optionSelections && Object.keys(optionSelections).length > 0 && (
            <div data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted mt-1 space-y-0.5 text-sm">
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
            <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-sm">Pris ex. moms</p>
            <p
              data-branding-id="productPage.pricePanel.price"
              className="price-panel-price min-w-[170px] text-4xl font-heading font-bold tabular-nums"
            >
              {baseTotal > 0 ? `${baseTotal} kr` : "-"}
            </p>
          </div>
          {hasStableSelection && (
            <div className="flex flex-col items-stretch gap-2">
              <MotionButton
                {...orderButtonMotionProps}
                data-surface={orderButtonMotion.surfaceStyle}
                data-branding-id={designReady ? "productPage.orderButtons.selected" : "productPage.orderButtons.secondary"}
                variant="outline"
                size="lg"
                className={cn(
                  "gap-2 py-5 border-2",
                  designReady
                    ? "order-selected-button"
                    : "order-secondary-button border-dashed border-2"
                )}
                style={designReady ? selectedButtonCssVars : secondaryButtonCssVars}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('productId', productId);
                  if (selectedFormat) params.set('format', selectedFormat);
                  if (linkedTemplateId) params.set('templateId', linkedTemplateId);
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
              </MotionButton>
              {canvaOffer?.enabled && canvaOffer.launchUrl ? (
                <>
                  <MotionButton
                    {...orderButtonMotionProps}
                    data-surface={orderButtonMotion.surfaceStyle}
                    variant="outline"
                    size="lg"
                    className="gap-2 border-dashed py-5"
                    style={secondaryButtonCssVars}
                    onClick={() => {
                      persistCheckoutState({ crossTab: true });
                      window.open(canvaOffer.launchUrl as string, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Sparkles className="h-5 w-5" />
                    {canvaOffer.buttonLabel || "Design i Canva"}
                    <ExternalLink className="h-4 w-4" />
                  </MotionButton>
                  {canvaOffer.helperText ? (
                    <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted max-w-[260px] text-xs">
                      {canvaOffer.helperText}
                    </p>
                  ) : null}
                </>
              ) : null}
              <MotionButton
                {...orderButtonMotionProps}
                data-surface={orderButtonMotion.surfaceStyle}
                data-branding-id="productPage.orderButtons.primary"
                size="lg"
                className="order-primary-button px-6 py-6 text-lg font-semibold"
                style={primaryButtonCssVars}
                onClick={handleOrderClick}
                disabled={!canOrder}
              >
                Bestil nu!
              </MotionButton>
              {!canOrder && orderValidationError && (
                <p className="text-xs text-destructive max-w-[260px]">
                  {orderValidationError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delivery options - Always Visible */}
      {hasStableSelection && (
        <div className="space-y-3 pt-4">
          <Label data-branding-id="productPage.pricePanel.text" className="price-panel-title text-base font-semibold">Levering</Label>
          {externalMode && externalDeliveryLoading && (
            <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-xs">Henter leveringsmuligheder...</p>
          )}
          {externalMode && externalDeliveryError && (
            <p className="text-xs text-destructive">{externalDeliveryError}</p>
          )}
          {activeDeliveryMethods.length === 0 && (
            <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-xs">Ingen leveringsmuligheder endnu.</p>
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
              // Fast production can pull the estimate forward, but never below the shipping leg itself.
              const adjustedMinDays = Math.max(Math.max(0, shippingDays), minDays - Math.max(0, deliveryBusinessDayOffset));
              const adjustedMaxDays = Math.max(adjustedMinDays, maxDays - Math.max(0, deliveryBusinessDayOffset));
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
                : (adjustedMinDays > 0 ? addBusinessDays(orderDate, adjustedMinDays) : orderDate);
              const latestDelivery = fixedDeliveryDate
                ? fixedDeliveryDate
                : (adjustedMaxDays > 0 ? addBusinessDays(orderDate, adjustedMaxDays) : orderDate);
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
                  data-branding-id="productPage.pricePanel.optionCard"
                  className={cn(
                    "price-panel-option flex items-start space-x-2 rounded-md border p-3 transition-colors",
                    isSelected && "price-panel-option--selected"
                  )}
                >
                  <RadioGroupItem
                    value={method.id}
                    id={`delivery-${method.id}`}
                    style={{
                      color: pricePanelStyles.config.priceColor,
                      borderColor: isSelected
                        ? pricePanelStyles.config.optionSelectedBorderColor
                        : pricePanelStyles.config.optionBorderColor,
                    }}
                  />
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
                          <span data-branding-id="productPage.pricePanel.text" className="price-panel-text text-sm font-medium">
                            {nameLabel}
                          </span>
                          {descriptionShort && (
                            <span data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-[11px]">
                              {descriptionShort}
                            </span>
                          )}
                        </div>
                        {(effectiveCountdown || cutoffTimeLabel) && (
                          <div data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted mt-1 flex items-center gap-2 text-xs">
                            {effectiveCountdown && (
                              <span data-branding-id="productPage.pricePanel.badge" className="price-panel-badge inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                                {effectiveCountdown}
                              </span>
                            )}
                            {showDeadline && cutoffTimeLabel && <span>{cutoffTimeLabel}</span>}
                          </div>
                        )}
                        {showDeadline && submissionLabel && (
                          <div data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted mt-1 text-xs">Bestil senest: {submissionLabel}</div>
                        )}
                        {deliveryDateLabel && (
                          <div data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted mt-1 text-xs">{deliveryDateLabel}</div>
                        )}
                      </div>
                      <span data-branding-id="productPage.pricePanel.price" className="price-panel-price min-w-[88px] text-right text-sm font-semibold tabular-nums">{cost} kr</span>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="price-panel-divider flex items-end justify-between border-t pt-4">
            <span data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted text-sm">Samlet pris ex. moms:</span>
            <span
              data-branding-id="productPage.pricePanel.price"
              className="price-panel-price min-w-[170px] text-right text-4xl font-heading font-bold tabular-nums"
            >
              {totalPrice} kr
            </span>
          </div>
        </div>
      )}

      {baseTotal === 0 && (
        <p data-branding-id="productPage.pricePanel.mutedText" className="price-panel-muted py-4 text-center text-sm">
          Vælg en pris i matrixen for at se beregning
        </p>
      )}
    </div>
  );
}
