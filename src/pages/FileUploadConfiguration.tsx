import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopSettings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Upload, AlertCircle, CheckCircle2, FileText, ArrowRight, Download, Info, Sparkles, Package, X, Clock3, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { StripePaymentForm } from "@/components/checkout/StripePaymentForm";
import { cloneStandardDeliveryMethods, resolveDeliveryMethodCost } from "@/lib/delivery/defaults";
import { readSiteCheckoutSession, writeSiteCheckoutSession } from "@/lib/checkout/siteCheckoutSession";
import { deleteCheckoutCustomerProfile, readCheckoutCustomerProfiles, upsertCheckoutCustomerProfile, type CheckoutCustomerProfile } from "@/lib/checkout/customerProfiles";
import { ptToMm } from "@/utils/unitConversions";
import {
    getFlyerMatrixDataFromDB,
    getFolderMatrixDataFromDB,
    getVisitkortMatrixDataFromDB,
    getPosterMatrixDataFromDB,
    getStickerMatrixDataFromDB,
    getBookletMatrixDataFromDB,
    getSalesfolderMatrixDataFromDB,
    getBeachflagMatrixDataFromDB,
    getBannerMatrixDataFromDB,
    getSignMatrixDataFromDB,
    getFoilMatrixDataFromDB,
    getGenericMatrixDataFromDB
} from "@/utils/pricingDatabase";

interface TechnicalSpecs {
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    min_dpi: number;
    safe_area_mm?: number;
}

interface TemplateFile {
    name: string;
    url: string;
    path: string;
    format?: string;
    uploadedAt: string;
}

type OptionPriceMode = "fixed" | "per_quantity" | "per_area";

interface CheckoutOptionSelection {
    optionId: string;
    name: string;
    extraPrice: number;
    priceMode: OptionPriceMode;
}

interface SizeDistributionField {
    key: string;
    label: string;
}

interface CheckoutDeliveryMethod {
    id: string;
    name: string;
    description?: string;
    lead_time_days?: number;
    production_days?: number;
    shipping_days?: number;
    delivery_window_days?: number;
    price?: number;
    cutoff_time?: string;
    cutoff_label?: "deadline" | "latest";
    cutoff_text?: string;
    delivery_date?: string;
}

interface ProofingPreviewData {
    fileType: "image" | "pdf";
    previewUrl: string;
    physicalWidthMm: number;
    physicalHeightMm: number;
    sourceWidthPx: number;
    sourceHeightPx: number;
    pageCount?: number;
}

interface CheckoutSavedAddress {
    id: string;
    label: string | null;
    company_name: string | null;
    first_name: string;
    last_name: string;
    street_address: string;
    street_address_2: string | null;
    postal_code: string;
    city: string;
    country: string;
    phone: string | null;
    is_default: boolean;
}

type CheckoutSenderMode = "standard" | "blind" | "custom";

const STANDARD_SPECS: Record<string, { width_mm: number; height_mm: number; min_dpi: number }> = {
    "A6": { width_mm: 105, height_mm: 148, min_dpi: 300 },
    "M65": { width_mm: 99, height_mm: 210, min_dpi: 300 },
    "A5": { width_mm: 148, height_mm: 210, min_dpi: 300 },
    "A4": { width_mm: 210, height_mm: 297, min_dpi: 300 },
    "A3": { width_mm: 297, height_mm: 420, min_dpi: 300 },
    "A2": { width_mm: 420, height_mm: 594, min_dpi: 300 },
    "A1": { width_mm: 594, height_mm: 841, min_dpi: 300 },
    "A0": { width_mm: 841, height_mm: 1189, min_dpi: 300 },
    "standard": { width_mm: 85, height_mm: 55, min_dpi: 300 }, // Visitkort
    "85x55": { width_mm: 85, height_mm: 55, min_dpi: 300 },
};

const SIZE_OPTION_PREFIX = "size-dist-";
const DEFAULT_CHECKOUT_DELIVERY_METHODS = cloneStandardDeliveryMethods();
const deliveryDateFormatter = new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
});
const deliveryDateTimeFormatter = new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

const toSafeKey = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const parseSizeValueFromName = (name: string): number => {
    const match = String(name || "").match(/:\s*([0-9]+)/);
    if (!match) return 0;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
};

const normalizeOptionSelections = (raw: unknown): Record<string, CheckoutOptionSelection> => {
    if (!raw || typeof raw !== "object") return {};

    const entries = Object.entries(raw as Record<string, any>);
    const normalized: Record<string, CheckoutOptionSelection> = {};

    entries.forEach(([entryKey, value], idx) => {
        if (!value || typeof value !== "object") return;
        const optionId = String(value.optionId || entryKey || `opt-${idx}`);
        const name = String(value.name || "").trim();
        if (!name) return;

        const extraPriceRaw = Number(value.extraPrice || 0);
        const extraPrice = Number.isFinite(extraPriceRaw) ? extraPriceRaw : 0;

        const priceModeRaw = String(value.priceMode || "fixed");
        const priceMode: OptionPriceMode =
            priceModeRaw === "per_quantity" || priceModeRaw === "per_area"
                ? priceModeRaw
                : "fixed";

        normalized[optionId] = {
            optionId,
            name,
            extraPrice,
            priceMode,
        };
    });

    return normalized;
};

const normalizeCheckoutDeliveryMethods = (raw: unknown): CheckoutDeliveryMethod[] => {
    const rawMethods = Array.isArray(raw) && raw.length > 0
        ? raw as Array<Record<string, any>>
        : DEFAULT_CHECKOUT_DELIVERY_METHODS;
    const fallbackById = new Map(DEFAULT_CHECKOUT_DELIVERY_METHODS.map((method) => [method.id, method]));

    return rawMethods
        .map((method, index) => {
            const fallback = fallbackById.get(String(method?.id || "")) || DEFAULT_CHECKOUT_DELIVERY_METHODS[index] || DEFAULT_CHECKOUT_DELIVERY_METHODS[0];
            const id = String(method?.id || fallback?.id || `delivery-${index + 1}`);
            const productionDays = typeof method?.production_days === "number"
                ? method.production_days
                : (fallback?.production_days || 0);
            const shippingDays = typeof method?.shipping_days === "number"
                ? method.shipping_days
                : (fallback?.shipping_days || 0);
            const leadTime = typeof method?.lead_time_days === "number"
                ? method.lead_time_days
                : ((fallback?.lead_time_days ?? productionDays + shippingDays) || 0);
            const explicitPrice = Number(method?.price);

            return {
                id,
                name: String(method?.name || fallback?.name || "Levering"),
                description: String(method?.description || fallback?.description || ""),
                lead_time_days: leadTime,
                production_days: productionDays,
                shipping_days: shippingDays,
                delivery_window_days: typeof method?.delivery_window_days === "number"
                    ? method.delivery_window_days
                    : (fallback?.delivery_window_days || 0),
                price: Number.isFinite(explicitPrice)
                    ? explicitPrice
                    : Number(fallback?.price || 0),
                cutoff_time: String(method?.cutoff_time || fallback?.cutoff_time || ""),
                cutoff_label: method?.cutoff_label === "latest" ? "latest" : "deadline",
                cutoff_text: String(method?.cutoff_text || fallback?.cutoff_text || ""),
                delivery_date: String(method?.delivery_date || ""),
            } satisfies CheckoutDeliveryMethod;
        })
        .filter((method) => method.id && method.name);
};

const parseCutoffTime = (time?: string) => {
    if (!time) return null;
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return { hours, minutes };
};

const getNextCutoffDate = (method: CheckoutDeliveryMethod, now: Date) => {
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
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}t`;
    if (hours > 0) return `${hours}t ${minutes}m`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parsePositiveNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const normalizeFormatKey = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const compact = trimmed.toUpperCase().replace(/\s+/g, "");

    if (compact.includes("DINLANG") || compact.includes("M65")) return "M65";
    if (compact.includes("85X55")) return "85x55";

    const aFormatMatch = compact.match(/(?:DIN)?A([0-6])/);
    if (aFormatMatch) return `A${aFormatMatch[1]}`;

    return trimmed;
};

const getReadableFormatLabel = (
    rawFormat: unknown,
    specs: TechnicalSpecs | null
) => {
    if (typeof rawFormat === "string" && rawFormat.trim()) {
        const trimmed = rawFormat.trim();
        const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
        const normalized = normalizeFormatKey(rawFormat);
        if (normalized && normalized !== trimmed) return normalized;
        if (!looksLikeUuid) return trimmed;
    }

    if (specs?.width_mm && specs?.height_mm) {
        return `${Math.round(specs.width_mm)} x ${Math.round(specs.height_mm)} mm`;
    }

    return "Standard";
};

const splitFullName = (value: string) => {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return { firstName: "", lastName: "" };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts.slice(-1).join(" "),
    };
};

const formatSavedAddressLabel = (address: CheckoutSavedAddress) => {
    const name = [address.first_name, address.last_name].filter(Boolean).join(" ").trim();
    const company = String(address.company_name || "").trim();
    const primary = [name, company].filter(Boolean).join(" · ");
    const secondary = [address.street_address, `${address.postal_code} ${address.city}`.trim()]
        .filter(Boolean)
        .join(", ");
    return [primary || address.label || "Adresse", secondary].filter(Boolean).join(" — ");
};

const addBusinessDays = (date: Date, days: number) => {
    const next = new Date(date);
    let remaining = Math.max(0, days);

    while (remaining > 0) {
        next.setDate(next.getDate() + 1);
        const weekday = next.getDay();
        if (weekday !== 0 && weekday !== 6) {
            remaining -= 1;
        }
    }

    return next;
};

const parseDeliveryDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getEstimatedDeliveryDate = (method: CheckoutDeliveryMethod, now: Date) => {
    const explicitDate = parseDeliveryDate(method.delivery_date);
    if (explicitDate) return explicitDate;

    const cutoff = getNextCutoffDate(method, now);
    const base = cutoff && cutoff.getTime() > now.getTime() ? cutoff : now;
    const leadTime = Math.max(
        1,
        Number.isFinite(Number(method.lead_time_days))
            ? Number(method.lead_time_days)
            : Number(method.production_days || 0) + Number(method.shipping_days || 0),
    );

    return addBusinessDays(base, leadTime);
};

const FileUploadConfiguration = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const locationSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const persistedCheckoutState = useMemo(() => readSiteCheckoutSession(), []);
    const state = (location.state as any) || persistedCheckoutState;
    const shopSettings = useShopSettings();
    const initialShippingCost = Number.isFinite(Number(state?.shippingCost)) ? Math.round(Number(state.shippingCost)) : 0;
    const initialTotalPrice = Number.isFinite(Number(state?.totalPrice)) ? Math.round(Number(state.totalPrice)) : 0;
    const initialBasePrice = Math.round(Number(state?.productPrice || 0) + Number(state?.extraPrice || 0));
    const initialOrderSubtotal = Math.max(0, initialTotalPrice - initialShippingCost) || initialBasePrice || initialTotalPrice;

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<any>(null);
    const [orderDeliveryConfig, setOrderDeliveryConfig] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadDropActive, setUploadDropActive] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; path: string } | null>(null);
    const [checkoutUserId, setCheckoutUserId] = useState<string | null>(null);
    const [savedCustomerProfiles, setSavedCustomerProfiles] = useState<CheckoutCustomerProfile[]>([]);
    const [selectedCustomerProfileId, setSelectedCustomerProfileId] = useState(String(state?.checkoutCustomer?.selectedCustomerProfileId || "new"));
    const [customerProfileLabel, setCustomerProfileLabel] = useState("");
    const [customerEmail, setCustomerEmail] = useState(String(state?.checkoutCustomer?.customerEmail || ""));
    const [customerName, setCustomerName] = useState(String(state?.checkoutCustomer?.customerName || ""));
    const [customerPhone, setCustomerPhone] = useState(String(state?.checkoutCustomer?.customerPhone || ""));
    const [customerCompany, setCustomerCompany] = useState(String(state?.checkoutCustomer?.customerCompany || ""));
    const [savedAddresses, setSavedAddresses] = useState<CheckoutSavedAddress[]>([]);
    const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
    const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(String(state?.checkoutCustomer?.selectedSavedAddressId || "new"));
    const [deliveryRecipientName, setDeliveryRecipientName] = useState(String(state?.checkoutCustomer?.deliveryRecipientName || ""));
    const [deliveryCompany, setDeliveryCompany] = useState(String(state?.checkoutCustomer?.deliveryCompany || ""));
    const [deliveryAddress, setDeliveryAddress] = useState(String(state?.checkoutCustomer?.deliveryAddress || ""));
    const [deliveryZip, setDeliveryZip] = useState(String(state?.checkoutCustomer?.deliveryZip || ""));
    const [deliveryCity, setDeliveryCity] = useState(String(state?.checkoutCustomer?.deliveryCity || ""));
    const [saveAddressForLater, setSaveAddressForLater] = useState(Boolean(state?.checkoutCustomer?.saveAddressForLater));
    const [addressLabel, setAddressLabel] = useState(String(state?.checkoutCustomer?.addressLabel || ""));
    const [senderMode, setSenderMode] = useState<CheckoutSenderMode>(
        state?.checkoutCustomer?.senderMode === "blind" || state?.checkoutCustomer?.senderMode === "custom"
            ? state.checkoutCustomer.senderMode
            : "standard"
    );
    const [senderName, setSenderName] = useState(String(state?.checkoutCustomer?.senderName || ""));
    const [useSeparateBillingAddress, setUseSeparateBillingAddress] = useState(Boolean(state?.checkoutCustomer?.useSeparateBillingAddress));
    const [billingName, setBillingName] = useState(String(state?.checkoutCustomer?.billingName || ""));
    const [billingCompany, setBillingCompany] = useState(String(state?.checkoutCustomer?.billingCompany || ""));
    const [billingAddress, setBillingAddress] = useState(String(state?.checkoutCustomer?.billingAddress || ""));
    const [billingZip, setBillingZip] = useState(String(state?.checkoutCustomer?.billingZip || ""));
    const [billingCity, setBillingCity] = useState(String(state?.checkoutCustomer?.billingCity || ""));
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [tenantPaymentStatus, setTenantPaymentStatus] = useState<{
        status: string;
        charges_enabled: boolean;
        stripe_account_id: string | null;
    } | null>(null);
    const [paymentStatusLoaded, setPaymentStatusLoaded] = useState(false);
    const [preflightResults, setPreflightResults] = useState<{
        dpi?: number;
        width_px?: number;
        height_px?: number;
        aspectRatioMatch: boolean;
        dpiOk: boolean;
        issues: string[];
    } | null>(null);
    const [platformPreflight, setPlatformPreflight] = useState<{
        status: "PROCESSING" | "PROCESSED" | "FAILED";
        errors: string[];
        warnings: string[];
        fixes: string[];
        jobId?: string;
        updatedFileUrl?: string;
        message?: string;
    } | null>(null);
    const [platformPreflightLoading, setPlatformPreflightLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [proofingPreview, setProofingPreview] = useState<ProofingPreviewData | null>(null);
    const [proofingOpen, setProofingOpen] = useState(false);
    const [proofingApproved, setProofingApproved] = useState(false);
    const [proofingScale, setProofingScale] = useState(100);
    const [proofingOffset, setProofingOffset] = useState({ x: 0, y: 0 });
    const [proofingDragging, setProofingDragging] = useState(false);
    const [proofingResizing, setProofingResizing] = useState(false);

    // Local Order Configuration (to allow for Best Deal upgrades)
    const [orderQuantity, setOrderQuantity] = useState<number>(state?.quantity || 0);
    const [orderPrice, setOrderPrice] = useState<number>(initialOrderSubtotal);
    const [matrix, setMatrix] = useState<{ rows: string[], columns: number[], cells: any } | null>(null);
    const [upsellOptions, setUpsellOptions] = useState<{ quantity: number, price: number, savingPercent: number }[]>([]);
    const [sizeDistributionValues, setSizeDistributionValues] = useState<Record<string, number>>({});
    const [shippingSelected, setShippingSelected] = useState<string>(String(state?.shippingSelected || ""));
    const [deliveryNow, setDeliveryNow] = useState<Date>(() => new Date());

    // Stripe payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
    const [paymentConnectedAccountId, setPaymentConnectedAccountId] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
    const [orderPersistWarning, setOrderPersistWarning] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const proofingDragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
    const proofingResizeStartRef = useRef<{ centerX: number; centerY: number; startDistance: number; startScale: number } | null>(null);
    const proofingArtworkRef = useRef<HTMLDivElement>(null);
    const proofingArtboardRef = useRef<HTMLDivElement>(null);

    const applySavedAddress = (address: CheckoutSavedAddress) => {
        setDeliveryRecipientName([address.first_name, address.last_name].filter(Boolean).join(" ").trim());
        setDeliveryCompany(String(address.company_name || ""));
        setDeliveryAddress(String(address.street_address || ""));
        setDeliveryZip(String(address.postal_code || ""));
        setDeliveryCity(String(address.city || ""));
        setCustomerPhone((prev) => prev || String(address.phone || ""));
        setAddressLabel(String(address.label || ""));
    };

    const applyCustomerProfile = (profile: CheckoutCustomerProfile) => {
        setCustomerEmail(String(profile.customerEmail || ""));
        setCustomerName(String(profile.customerName || ""));
        setCustomerPhone(String(profile.customerPhone || ""));
        setCustomerCompany(String(profile.customerCompany || ""));
        setDeliveryRecipientName(String(profile.deliveryRecipientName || ""));
        setDeliveryCompany(String(profile.deliveryCompany || ""));
        setDeliveryAddress(String(profile.deliveryAddress || ""));
        setDeliveryZip(String(profile.deliveryZip || ""));
        setDeliveryCity(String(profile.deliveryCity || ""));
        setUseSeparateBillingAddress(Boolean(profile.useSeparateBillingAddress));
        setBillingName(String(profile.billingName || ""));
        setBillingCompany(String(profile.billingCompany || ""));
        setBillingAddress(String(profile.billingAddress || ""));
        setBillingZip(String(profile.billingZip || ""));
        setBillingCity(String(profile.billingCity || ""));
        setSenderMode(
            profile.senderMode === "blind" || profile.senderMode === "custom"
                ? profile.senderMode
                : "standard"
        );
        setSenderName(String(profile.senderName || ""));
        setCustomerProfileLabel(profile.label || "");
    };

    const activeDeliveryMethods = useMemo(
        () => normalizeCheckoutDeliveryMethods(orderDeliveryConfig?.delivery?.methods),
        [orderDeliveryConfig]
    );

    useEffect(() => {
        if (activeDeliveryMethods.length === 0) return;
        if (!shippingSelected || !activeDeliveryMethods.some((method) => method.id === shippingSelected)) {
            setShippingSelected(activeDeliveryMethods[0].id);
        }
    }, [activeDeliveryMethods, shippingSelected]);

    useEffect(() => {
        const timer = window.setInterval(() => setDeliveryNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!proofingDragging && !proofingResizing) return;

        const handlePointerMove = (event: MouseEvent) => {
            if (proofingDragging) {
                const start = proofingDragStartRef.current;
                if (!start) return;
                const artboardRect = proofingArtboardRef.current?.getBoundingClientRect();
                if (!artboardRect) return;
                setProofingOffset({
                    x: start.startX + (((event.clientX - start.x) / artboardRect.width) * 100),
                    y: start.startY + (((event.clientY - start.y) / artboardRect.height) * 100),
                });
                return;
            }

            if (proofingResizing) {
                const start = proofingResizeStartRef.current;
                if (!start) return;
                const currentDistance = Math.max(
                    1,
                    Math.hypot(event.clientX - start.centerX, event.clientY - start.centerY)
                );
                setProofingScale(clamp(start.startScale * (currentDistance / start.startDistance), 40, 220));
            }
        };

        const handlePointerUp = () => {
            setProofingDragging(false);
            setProofingResizing(false);
            proofingDragStartRef.current = null;
            proofingResizeStartRef.current = null;
        };

        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", handlePointerUp);
        return () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", handlePointerUp);
        };
    }, [proofingDragging, proofingResizing]);

    useEffect(() => {
        return () => {
            if (previewUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const activeDeliveryMethod = useMemo(
        () => activeDeliveryMethods.find((method) => method.id === shippingSelected) || activeDeliveryMethods[0] || null,
        [activeDeliveryMethods, shippingSelected]
    );

    const shippingCost = useMemo(
        () => resolveDeliveryMethodCost(orderPrice, activeDeliveryMethod),
        [orderPrice, activeDeliveryMethod]
    );

    const checkoutTotal = useMemo(
        () => Math.max(0, orderPrice + shippingCost),
        [orderPrice, shippingCost]
    );

    const selectedDeliveryLabel = activeDeliveryMethod?.name || shippingSelected || "";

    const baseOptionSelections = useMemo(
        () => normalizeOptionSelections(state?.optionSelections),
        [state?.optionSelections]
    );

    const sizeDistributionConfig = useMemo(() => {
        const raw = product?.technical_specs?.size_distribution;
        if (!raw?.enabled) return null;

        const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
        const fields: SizeDistributionField[] = rawFields
            .map((field: any, index: number) => {
                if (typeof field === "string") {
                    const label = field.trim();
                    if (!label) return null;
                    return {
                        key: toSafeKey(label) || `field-${index + 1}`,
                        label,
                    };
                }

                if (field && typeof field === "object") {
                    const label = String(field.label || field.name || field.key || "").trim();
                    if (!label) return null;
                    const key = toSafeKey(String(field.key || "")) || toSafeKey(label) || `field-${index + 1}`;
                    return { key, label };
                }

                return null;
            })
            .filter(Boolean) as SizeDistributionField[];

        if (fields.length === 0) return null;

        return {
            title: String(raw.title || "Størrelsesfordeling"),
            enforceQuantityMatch: raw.enforce_quantity_match !== false,
            fields,
        };
    }, [product?.technical_specs?.size_distribution]);

    const sizeDistributionFields = sizeDistributionConfig?.fields || [];

    const nonSizeOptionSelections = useMemo(() => {
        return Object.fromEntries(
            Object.entries(baseOptionSelections).filter(([entryKey, option]) => {
                const candidateId = String(option.optionId || entryKey);
                return !candidateId.startsWith(SIZE_OPTION_PREFIX);
            })
        );
    }, [baseOptionSelections]);

    useEffect(() => {
        if (!sizeDistributionConfig) {
            setSizeDistributionValues((prev) => (Object.keys(prev).length > 0 ? {} : prev));
            return;
        }

        const allowedKeys = new Set(sizeDistributionFields.map((field) => field.key));
        setSizeDistributionValues((prev) => {
            const next: Record<string, number> = {};
            let changed = false;

            sizeDistributionFields.forEach((field) => {
                const current = Number(prev[field.key] || 0);
                next[field.key] = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
            });

            const hasExistingValues = sizeDistributionFields.some((field) => (next[field.key] || 0) > 0);
            if (!hasExistingValues) {
                Object.entries(baseOptionSelections).forEach(([entryKey, option]) => {
                    const candidateId = String(option.optionId || entryKey);
                    if (!candidateId.startsWith(SIZE_OPTION_PREFIX)) return;
                    const fieldKey = candidateId.slice(SIZE_OPTION_PREFIX.length);
                    if (!allowedKeys.has(fieldKey)) return;
                    const parsedValue = parseSizeValueFromName(option.name);
                    if (parsedValue > 0) {
                        next[fieldKey] = parsedValue;
                    }
                });
            }

            Object.keys(prev).forEach((key) => {
                if (!allowedKeys.has(key)) changed = true;
            });

            if (!changed) {
                changed = Object.keys(next).some((key) => (prev[key] || 0) !== next[key]);
            }

            return changed ? next : prev;
        });
    }, [sizeDistributionConfig, sizeDistributionFields, baseOptionSelections]);

    const sizeDistributionEntries = useMemo(() => {
        if (!sizeDistributionConfig) return [] as Array<{ key: string; label: string; value: number }>;
        return sizeDistributionFields
            .map((field) => ({
                key: field.key,
                label: field.label,
                value: Number(sizeDistributionValues[field.key] || 0) || 0,
            }))
            .filter((entry) => entry.value > 0);
    }, [sizeDistributionConfig, sizeDistributionFields, sizeDistributionValues]);

    const sizeDistributionTotal = useMemo(
        () => sizeDistributionEntries.reduce((sum, entry) => sum + entry.value, 0),
        [sizeDistributionEntries]
    );

    const sizeDistributionMismatch = useMemo(() => {
        if (!sizeDistributionConfig?.enforceQuantityMatch) return false;
        if (!orderQuantity || orderQuantity <= 0) return false;
        return sizeDistributionTotal !== orderQuantity;
    }, [sizeDistributionConfig?.enforceQuantityMatch, orderQuantity, sizeDistributionTotal]);

    const sizeDistributionSummary = useMemo(() => {
        if (!sizeDistributionConfig || sizeDistributionEntries.length === 0) return "";
        return sizeDistributionEntries.map((entry) => `${entry.label}: ${entry.value}`).join(", ");
    }, [sizeDistributionConfig, sizeDistributionEntries]);

    const sizeDistributionOptionSelections = useMemo(() => {
        const selections: Record<string, CheckoutOptionSelection> = {};
        sizeDistributionEntries.forEach((entry) => {
            const optionId = `${SIZE_OPTION_PREFIX}${entry.key}`;
            selections[optionId] = {
                optionId,
                name: `${entry.label}: ${entry.value}`,
                extraPrice: 0,
                priceMode: "fixed",
            };
        });
        return selections;
    }, [sizeDistributionEntries]);

    const effectiveOptionSelections = useMemo(
        () => ({ ...nonSizeOptionSelections, ...sizeDistributionOptionSelections }),
        [nonSizeOptionSelections, sizeDistributionOptionSelections]
    );

    const handleSizeDistributionChange = (fieldKey: string, rawValue: string) => {
        const parsed = Number(rawValue);
        const nextValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
        setSizeDistributionValues((prev) => ({
            ...prev,
            [fieldKey]: nextValue,
        }));
    };

    const generateOrderNumber = () => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const randomPart = Math.floor(100000 + Math.random() * 900000);
        return `WP${yy}${mm}${dd}-${randomPart}`;
    };

    const isMissingOrderConfigurationColumn = (error: any) => {
        const message = String(error?.message || "").toLowerCase();
        return error?.code === "PGRST204" && message.includes("product_configuration");
    };

    const isOrderNumberCollision = (error: any) => {
        return error?.code === "23505" || String(error?.message || "").includes("orders_order_number_key");
    };

    const handleBackToConfiguration = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        if (state?.productSlug) {
            navigate(`/produkt/${state.productSlug}`);
            return;
        }
        navigate("/");
    };

    const handleProceedToPayment = async () => {
        if (sizeDistributionMismatch) {
            toast.error(`Størrelsesfordeling skal summere til ${orderQuantity} stk.`);
            return;
        }

        if (!customerEmail.trim() || !customerName.trim() || !deliveryRecipientName.trim() || !deliveryAddress.trim() || !deliveryZip.trim() || !deliveryCity.trim()) {
            toast.error("Udfyld kunde- og leveringsoplysninger før betaling.");
            return;
        }
        if (useSeparateBillingAddress && (!billingName.trim() || !billingAddress.trim() || !billingZip.trim() || !billingCity.trim())) {
            toast.error("Udfyld faktureringsadresse før betaling.");
            return;
        }

        const tenantId = shopSettings.data?.id;
        if (!tenantId) {
            toast.error("Kunne ikke finde shop-id til betaling.");
            return;
        }

        setPaymentLoading(true);
        try {
            const totalPrice = checkoutTotal;
            const amountOre = Math.round(totalPrice * 100);
            const optionSummary = Object.values(effectiveOptionSelections)
                .map((option) => option.name)
                .filter(Boolean)
                .join(" | ");
            const sizeSummaryWithTotal = sizeDistributionSummary
                ? `${sizeDistributionSummary} (sum ${sizeDistributionTotal}/${orderQuantity})`
                : "";

            const { data, error } = await supabase.functions.invoke("stripe-create-payment-intent", {
                body: {
                    tenant_id: tenantId,
                    amount_ore: amountOre,
                    currency: "dkk",
                    metadata: {
                        product_id: state?.productId || "",
                        product_slug: state?.productSlug || "",
                        uploaded_file: uploadedFile?.path || "",
                        quantity: String(orderQuantity || 0),
                        option_summary: optionSummary.slice(0, 450),
                        size_distribution: sizeSummaryWithTotal.slice(0, 450),
                        customer_email: customerEmail.trim().slice(0, 250),
                        customer_name: customerName.trim().slice(0, 250),
                        recipient_name: deliveryRecipientName.trim().slice(0, 250),
                        delivery_city: deliveryCity.trim().slice(0, 120),
                        delivery_type: selectedDeliveryLabel.slice(0, 120),
                        blind_shipping: senderMode === "blind" ? "true" : "false",
                        sender_name: (senderMode === "custom" ? senderName.trim() : "").slice(0, 250),
                    },
                },
            });

            if (error) throw error;

            if (data?.client_secret) {
                setPaymentClientSecret(data.client_secret);
                // Synchronize frontend "Connect" mode with Backend "Connect" mode
                // If backend used "connected": true, we MUST use stripe_account_id options.
                // If backend used "connected": false, we MUST NOT use stripe_account_id options.
                if (data.connected && tenantPaymentStatus?.stripe_account_id) {
                    setPaymentConnectedAccountId(tenantPaymentStatus.stripe_account_id);
                } else {
                    setPaymentConnectedAccountId(null);
                }
                setShowPaymentModal(true);
            } else {
                toast.error("Kunne ikke oprette betaling.");
            }
        } catch (err: any) {
            console.error("Payment intent error:", err);
            toast.error(err?.message || "Kunne ikke oprette betaling.");
        } finally {
            setPaymentLoading(false);
        }
    };

    const handlePaymentSuccess = async (paymentIntentId: string) => {
        setShowPaymentModal(false);
        setPaymentClientSecret(null);
        setOrderPersistWarning(null);
        setCreatedOrderNumber(null);

        const productConfigurationText = sizeDistributionConfig && sizeDistributionEntries.length > 0
            ? `${sizeDistributionConfig.title}: ${sizeDistributionSummary}`
            : null;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const tenantId = shopSettings.data?.id || null;
            const totalPrice = checkoutTotal;
            const resolvedCustomerEmail = customerEmail.trim()
                || user?.email
                || `guest-${Date.now()}@webprinter.local`;
            const resolvedCustomerName = customerName.trim()
                || String(user?.user_metadata?.full_name || "").trim()
                || String(user?.user_metadata?.name || "").trim()
                || resolvedCustomerEmail.split("@")[0]
                || "Kunde";
            const resolvedRecipientName = deliveryRecipientName.trim() || resolvedCustomerName;
            const deliverySummary = [
                resolvedRecipientName,
                deliveryCompany.trim() || null,
                deliveryAddress.trim(),
                `${deliveryZip.trim()} ${deliveryCity.trim()}`.trim(),
            ]
                .filter(Boolean)
                .join(", ");
            const resolvedBillingName = useSeparateBillingAddress
                ? (billingName.trim() || resolvedCustomerName)
                : resolvedCustomerName;
            const resolvedBillingCompany = useSeparateBillingAddress
                ? billingCompany.trim()
                : customerCompany.trim();
            const resolvedBillingAddress = useSeparateBillingAddress
                ? billingAddress.trim()
                : deliveryAddress.trim();
            const resolvedBillingZip = useSeparateBillingAddress
                ? billingZip.trim()
                : deliveryZip.trim();
            const resolvedBillingCity = useSeparateBillingAddress
                ? billingCity.trim()
                : deliveryCity.trim();
            const billingSummary = [
                resolvedBillingName,
                resolvedBillingCompany || null,
                resolvedBillingAddress || null,
                `${resolvedBillingZip} ${resolvedBillingCity}`.trim() || null,
                customerEmail.trim() || null,
            ].filter(Boolean).join(", ");
            const senderSummary = senderMode === "blind"
                ? "Blind forsendelse"
                : senderMode === "custom"
                    ? (senderName.trim() || customerCompany.trim() || resolvedCustomerName)
                    : "Standard WebPrinter-afsender";
            const supplementalOrderNotes = [
                customerPhone.trim() ? `[TELEFON] ${customerPhone.trim()}` : null,
                customerCompany.trim() ? `[FIRMA] ${customerCompany.trim()}` : null,
                resolvedRecipientName ? `[MODTAGER] ${resolvedRecipientName}` : null,
                deliveryCompany.trim() ? `[MODTAGER-FIRMA] ${deliveryCompany.trim()}` : null,
                deliverySummary ? `[LEVERING] ${deliverySummary}` : null,
                billingSummary ? `[FAKTURERING] ${billingSummary}` : null,
                selectedDeliveryLabel ? `[LEVERINGSMETODE] ${selectedDeliveryLabel}` : null,
                senderMode === "blind" ? "[BLIND_SHIPPING] Ja" : null,
                senderSummary ? `[AFSENDER] ${senderSummary}` : null,
            ].filter(Boolean).join("\n");

            let includeProductConfigurationColumn = !!productConfigurationText;
            let insertedOrder: any = null;

            for (let attempt = 0; attempt < 5; attempt += 1) {
                const basePayload: Record<string, any> = {
                    order_number: generateOrderNumber(),
                    user_id: user?.id || null,
                    customer_email: resolvedCustomerEmail,
                    customer_name: resolvedCustomerName,
                    product_name: state?.productName || product?.name || "Produkt",
                    product_slug: state?.productSlug || product?.slug || null,
                    quantity: orderQuantity || 1,
                    total_price: totalPrice,
                    currency: "DKK",
                    status: "pending",
                    delivery_type: selectedDeliveryLabel || null,
                    tenant_id: tenantId,
                };

                if (includeProductConfigurationColumn && productConfigurationText) {
                    basePayload.product_configuration = productConfigurationText;
                    if (supplementalOrderNotes) {
                        basePayload.status_note = supplementalOrderNotes;
                    }
                } else if (productConfigurationText) {
                    // Fallback for environments where product_configuration column is not migrated yet.
                    basePayload.status_note = [`[SIZE-DISTRIBUTION] ${productConfigurationText}`, supplementalOrderNotes]
                        .filter(Boolean)
                        .join("\n");
                } else if (supplementalOrderNotes) {
                    basePayload.status_note = supplementalOrderNotes;
                }

                const { data: createdOrder, error: createOrderError } = await (supabase
                    .from("orders" as any)
                    .insert(basePayload)
                    .select("id, order_number, customer_email, customer_name, product_name, quantity, total_price")
                    .single() as any);

                if (!createOrderError) {
                    insertedOrder = createdOrder;
                    break;
                }

                if (includeProductConfigurationColumn && isMissingOrderConfigurationColumn(createOrderError)) {
                    includeProductConfigurationColumn = false;
                    continue;
                }

                if (isOrderNumberCollision(createOrderError)) {
                    continue;
                }

                throw createOrderError;
            }

            if (!insertedOrder) {
                throw new Error("Ordren kunne ikke oprettes i databasen.");
            }

            setCreatedOrderNumber(insertedOrder.order_number);

            if (uploadedFile?.url) {
                const fileType = uploadedFile.name.includes(".")
                    ? uploadedFile.name.split(".").pop()?.toLowerCase() || null
                    : null;

                const { error: orderFileError } = await supabase
                    .from("order_files" as any)
                    .insert({
                        order_id: insertedOrder.id,
                        file_name: uploadedFile.name,
                        file_url: uploadedFile.url,
                        file_type: fileType,
                        is_current: true,
                        uploaded_by: user?.id || null,
                        notes: productConfigurationText ? `Konfiguration: ${productConfigurationText}` : null,
                    });

                if (orderFileError) {
                    console.error("Order file save error:", orderFileError);
                }
            }

            try {
                const { sendOrderConfirmation } = await import("@/lib/emailService");
                await sendOrderConfirmation({
                    order_number: insertedOrder.order_number,
                    product_name: insertedOrder.product_name,
                    quantity: insertedOrder.quantity,
                    total_price: insertedOrder.total_price,
                    customer_email: insertedOrder.customer_email,
                    customer_name: insertedOrder.customer_name || "Kunde",
                    customer_phone: customerPhone.trim() || undefined,
                    delivery_type: selectedDeliveryLabel || undefined,
                    delivery_summary: deliverySummary || undefined,
                    billing_summary: billingSummary || undefined,
                    blind_shipping: senderMode === "blind",
                    sender_summary: senderSummary || undefined,
                });
            } catch (emailError) {
                console.error("Order confirmation email error:", emailError);
            }

            if (user?.id && saveAddressForLater && deliveryAddress.trim() && deliveryZip.trim() && deliveryCity.trim()) {
                const recipientParts = splitFullName(resolvedRecipientName);
                const addressPayload = {
                    user_id: user.id,
                    label: addressLabel.trim() || null,
                    company_name: deliveryCompany.trim() || null,
                    first_name: recipientParts.firstName || resolvedRecipientName,
                    last_name: recipientParts.lastName || "",
                    street_address: deliveryAddress.trim(),
                    street_address_2: null,
                    postal_code: deliveryZip.trim(),
                    city: deliveryCity.trim(),
                    country: "Danmark",
                    phone: customerPhone.trim() || null,
                    is_default: savedAddresses.length === 0,
                };

                const targetAddressId = selectedSavedAddressId && selectedSavedAddressId !== "new"
                    ? selectedSavedAddressId
                    : null;

                const saveQuery = targetAddressId
                    ? supabase.from("customer_addresses" as any).update(addressPayload).eq("id", targetAddressId)
                    : supabase.from("customer_addresses" as any).insert(addressPayload);

                const { error: addressSaveError } = await saveQuery;
                if (addressSaveError) {
                    console.error("Customer address save error:", addressSaveError);
                }
            }
        } catch (error: any) {
            console.error("Order persist error after payment:", error);
            setOrderPersistWarning(`Betaling gennemført, men ordren kunne ikke gemmes automatisk. Gem reference: ${paymentIntentId}`);
        }

        setPaymentSuccess(true);
        toast.success("Din ordre er modtaget! Vi sender en bekræftelse på email.");
        console.log("Payment successful:", paymentIntentId);
    };

    const handlePaymentCancel = () => {
        setShowPaymentModal(false);
        setPaymentClientSecret(null);
    };

    // Resolve specs: prefer explicit width/height from state or query, then standard formats, then product metadata
    const getResolvedSpecs = (): TechnicalSpecs | null => {
        const bleedDefault = 3;
        const explicitWidthMm = parsePositiveNumber(state?.designWidthMm) ?? parsePositiveNumber(locationSearchParams.get("widthMm"));
        const explicitHeightMm = parsePositiveNumber(state?.designHeightMm) ?? parsePositiveNumber(locationSearchParams.get("heightMm"));
        const explicitBleedMm = parsePositiveNumber(state?.designBleedMm) ?? parsePositiveNumber(locationSearchParams.get("bleedMm")) ?? bleedDefault;
        const explicitSafeAreaMm = parsePositiveNumber(state?.designSafeAreaMm) ?? parsePositiveNumber(locationSearchParams.get("safeMm")) ?? 2;

        if (explicitWidthMm && explicitHeightMm) {
            return {
                width_mm: explicitWidthMm,
                height_mm: explicitHeightMm,
                bleed_mm: explicitBleedMm,
                min_dpi: 300,
                safe_area_mm: explicitSafeAreaMm,
            };
        }

        const normalizedFormat = normalizeFormatKey(state?.selectedFormat || locationSearchParams.get("format"));
        if (normalizedFormat && STANDARD_SPECS[normalizedFormat]) {
            const std = STANDARD_SPECS[normalizedFormat];
            return { ...std, bleed_mm: bleedDefault };
        }
        if (product?.technical_specs?.width_mm && product?.technical_specs?.height_mm) {
            return {
                ...(product.technical_specs as TechnicalSpecs),
                bleed_mm: parsePositiveNumber((product.technical_specs as any).bleed_mm) ?? bleedDefault,
                safe_area_mm: parsePositiveNumber((product.technical_specs as any).safe_area_mm) ?? 2,
                min_dpi: parsePositiveNumber((product.technical_specs as any).min_dpi) ?? 300,
            };
        }
        // Very fallback for common products if nothing found
        return null;
    };

    const isPodProduct = Boolean(product?.technical_specs?.is_pod || product?.technical_specs?.is_pod_v2);
    const podPreflightEnabled = Boolean(product?.technical_specs?.pod_preflight_enabled);
    const podPreflightAutoFix = (product?.technical_specs as any)?.pod_preflight_auto_fix ?? true;
    const platformPreflightBlocking = isPodProduct
        && podPreflightEnabled
        && (platformPreflightLoading
            || platformPreflight?.status === "PROCESSING"
            || platformPreflight?.status === "FAILED"
            || (platformPreflight?.errors?.length ?? 0) > 0);

    const specs = getResolvedSpecs();
    const resolvedFormatLabel = useMemo(
        () => getReadableFormatLabel(state?.selectedFormat || locationSearchParams.get("format"), specs),
        [state?.selectedFormat, locationSearchParams, specs]
    );
    const targetWidth = specs ? specs.width_mm + (specs.bleed_mm * 2) : 0;
    const targetHeight = specs ? specs.height_mm + (specs.bleed_mm * 2) : 0;
    const safeAreaMm = specs?.safe_area_mm ?? 2;

    const bleedXPercent = specs ? (specs.bleed_mm / targetWidth) * 100 : 0;
    const bleedYPercent = specs ? (specs.bleed_mm / targetHeight) * 100 : 0;
    const safeXPercent = specs ? ((specs.bleed_mm + safeAreaMm) / targetWidth) * 100 : 0;
    const safeYPercent = specs ? ((specs.bleed_mm + safeAreaMm) / targetHeight) * 100 : 0;
    const proofingScaleFactor = proofingScale / 100;
    const proofingBaseWidthPercent = proofingPreview && targetWidth > 0
        ? (proofingPreview.physicalWidthMm / targetWidth) * 100
        : 100;
    const proofingBaseHeightPercent = proofingPreview && targetHeight > 0
        ? (proofingPreview.physicalHeightMm / targetHeight) * 100
        : 100;
    const proofingApprovalPending = Boolean(uploadedFile) && !proofingApproved;
    const proofingDpiWarning = Boolean(preflightResults?.dpi && specs?.min_dpi && preflightResults.dpi < specs.min_dpi);
    const proofingPhysicalMismatch = Boolean(
        proofingPreview &&
        (proofingPreview.physicalWidthMm < targetWidth || proofingPreview.physicalHeightMm < targetHeight)
    );

    useEffect(() => {
        if (!state) return;
        writeSiteCheckoutSession({
            ...state,
            quantity: orderQuantity,
            productPrice: orderPrice,
            totalPrice: checkoutTotal,
            shippingCost,
            shippingSelected,
            selectedFormat: resolvedFormatLabel,
            designWidthMm: specs?.width_mm || null,
            designHeightMm: specs?.height_mm || null,
            designBleedMm: specs?.bleed_mm || null,
            designSafeAreaMm: safeAreaMm || null,
            siteUpload: uploadedFile ? {
                name: uploadedFile.name,
                mimeType: uploadedFile.name.includes(".")
                    ? uploadedFile.name.split(".").pop()?.toLowerCase() === "pdf"
                        ? "application/pdf"
                        : uploadedFile.name.toLowerCase().endsWith(".png")
                            ? "image/png"
                            : uploadedFile.name.toLowerCase().endsWith(".jpg") || uploadedFile.name.toLowerCase().endsWith(".jpeg")
                                ? "image/jpeg"
                                : null
                    : null,
                fileUrl: uploadedFile.url,
                filePath: uploadedFile.path,
                widthPx: proofingPreview?.sourceWidthPx || preflightResults?.width_px || null,
                heightPx: proofingPreview?.sourceHeightPx || preflightResults?.height_px || null,
                estimatedDpi: preflightResults?.dpi || null,
                sourceDpi: preflightResults?.dpi || null,
                previewDataUrl: proofingPreview?.previewUrl || previewUrl || null,
            } : null,
            checkoutCustomer: {
                selectedCustomerProfileId,
                customerEmail,
                customerName,
                customerPhone,
                customerCompany,
                deliveryRecipientName,
                deliveryCompany,
                deliveryAddress,
                deliveryZip,
                deliveryCity,
                selectedSavedAddressId,
                saveAddressForLater,
                addressLabel,
                senderMode,
                senderName,
                useSeparateBillingAddress,
                billingName,
                billingCompany,
                billingAddress,
                billingZip,
                billingCity,
            },
            createdAt: new Date().toISOString(),
        });
    }, [
        state,
        orderQuantity,
        orderPrice,
        checkoutTotal,
        shippingCost,
        shippingSelected,
        uploadedFile,
        proofingPreview,
        preflightResults,
        previewUrl,
        specs?.width_mm,
        specs?.height_mm,
        specs?.bleed_mm,
        customerEmail,
        customerName,
        customerPhone,
        customerCompany,
        selectedCustomerProfileId,
        deliveryRecipientName,
        deliveryCompany,
        deliveryAddress,
        deliveryZip,
        deliveryCity,
        selectedSavedAddressId,
        saveAddressForLater,
        addressLabel,
        senderMode,
        senderName,
        useSeparateBillingAddress,
        billingName,
        billingCompany,
        billingAddress,
        billingZip,
        billingCity,
    ]);

    // If no state, redirect back to home or a generic products page
    useEffect(() => {
        if (!state) {
            console.warn("No state found in FileUploadConfiguration, redirecting...");
            navigate("/");
            return;
        }

        const fetchProductData = async () => {
            console.log("Fetching product data for:", {
                productId: state.productId,
                productSlug: state.productSlug
            });

            try {
                // Use specific columns to avoid any issues with missing columns in schema
                let query = supabase.from("products")
                    .select("id, slug, name, description, image_url, technical_specs, banner_config");

                if (state.productId) {
                    query = query.eq("id", state.productId);
                } else if (state.productSlug) {
                    query = query.eq("slug", state.productSlug);
                } else {
                    console.error("Missing both productId and productSlug in state");
                    setLoading(false);
                    return;
                }

                const { data, error } = await query.limit(1);

                if (error) {
                    console.error("Supabase error fetching product:", error);
                    throw error;
                }

                const productData = data?.[0];

                if (productData) {
                    console.log("Product data fetched successfully:", productData.name);
                    setProduct(productData);
                    setOrderDeliveryConfig((productData as any).banner_config?.order_delivery || null);

                    // Fetch Matrix for Upsell logic (wrapped in try/catch to not block the main product load)
                    try {
                        let matrixData: any = null;
                        const slug = (state.productSlug || productData.slug)?.toLowerCase();
                        const format = normalizeFormatKey(state.selectedFormat || locationSearchParams.get("format")) || "A4";

                        console.log("Fetching matrix for upsells. Slug:", slug, "Format:", format);

                        if (slug === 'flyers') matrixData = await getFlyerMatrixDataFromDB(format);
                        else if (slug === 'foldere') matrixData = await getFolderMatrixDataFromDB(format, state.optionSelections?.foldType?.name || "");
                        else if (slug === 'visitkort') matrixData = await getVisitkortMatrixDataFromDB();
                        else if (slug === 'plakater') matrixData = await getPosterMatrixDataFromDB(format);
                        else if (slug === 'klistermærker') matrixData = await getStickerMatrixDataFromDB(format);
                        else if (slug === 'hæfter') matrixData = await getBookletMatrixDataFromDB(format, state.optionSelections?.pages?.name || "");
                        else if (slug === 'salgsmapper') matrixData = await getSalesfolderMatrixDataFromDB(format, state.optionSelections?.sides?.name || "");
                        else if (slug === 'beachflag') matrixData = await getBeachflagMatrixDataFromDB();
                        else if (slug === 'bannere') matrixData = await getBannerMatrixDataFromDB();
                        else if (slug === 'skilte') matrixData = await getSignMatrixDataFromDB();
                        else if (slug === 'folie') matrixData = await getFoilMatrixDataFromDB();
                        else if (productData.id) {
                            const generic = await getGenericMatrixDataFromDB(productData.id, state.variant);
                            matrixData = generic.matrixData;
                        }

                        if (matrixData && matrixData.columns && matrixData.columns.length > 0 && matrixData.rows) {
                            console.log("Matrix data loaded. Columns:", matrixData.columns.length, "Rows:", matrixData.rows);
                            setMatrix(matrixData);

                            // Find the closest row match
                            const variantValue = state.variant || state.selectedVariant;
                            console.log("Looking for row match for variant value:", variantValue);

                            const rowName = matrixData.rows.find((r: string) =>
                                variantValue && r.toLowerCase().trim() === variantValue.toLowerCase().trim()
                            ) || matrixData.rows.find((r: string) =>
                                variantValue && r.toLowerCase().includes(variantValue.toLowerCase())
                            ) || matrixData.rows[0];

                            console.log("Matched row name:", rowName);

                            calculateUpsells(matrixData, state.quantity, rowName);
                        } else {
                            console.log("No valid matrix data found for this product/slug or data is malformed.");
                        }
                    } catch (matrixErr) {
                        console.error("Error fetching matrix for upsells (non-blocking):", matrixErr);
                    }
                } else {
                    console.warn("Product not found by ID or slug in Supabase");
                    toast.error("Produktet kunne ikke findes i databasen.");
                }
            } catch (err: any) {
                console.error("Critical error in fetchProductData:", err);
                toast.error(`Kunne ikke hente produktdata: ${err.message || "Ukendt fejl"}`);
            } finally {
                setLoading(false);
            }
        };

        fetchProductData();
    }, [state, navigate]);

    useEffect(() => {
        const hydrateCustomer = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCheckoutUserId(user.id);
            setSavedCustomerProfiles(await readCheckoutCustomerProfiles(user.id));
            setSavedAddressesLoading(true);
            setCustomerEmail((prev) => prev || String(user.email || ""));
            setCustomerName((prev) =>
                prev
                || String(user.user_metadata?.full_name || "").trim()
                || String(user.user_metadata?.name || "").trim()
            );
            setCustomerPhone((prev) => prev || String(user.user_metadata?.phone || "").trim());
            setCustomerCompany((prev) => prev || String(user.user_metadata?.company || "").trim());

            try {
                const { data, error } = await supabase
                    .from("customer_addresses" as any)
                    .select("*")
                    .eq("user_id", user.id)
                    .order("is_default", { ascending: false })
                    .order("created_at", { ascending: false });

                if (error) throw error;

                const nextAddresses = ((data as CheckoutSavedAddress[] | null) || []).filter((entry) => entry?.id);
                setSavedAddresses(nextAddresses);

                if (!deliveryAddress.trim() && !deliveryCity.trim() && !deliveryZip.trim() && !deliveryRecipientName.trim()) {
                    const defaultAddress = nextAddresses.find((entry) => entry.is_default) || nextAddresses[0];
                    if (defaultAddress) {
                        applySavedAddress(defaultAddress);
                        setSelectedSavedAddressId(defaultAddress.id);
                    }
                }
            } catch (addressError) {
                console.error("Customer address fetch error:", addressError);
            } finally {
                setSavedAddressesLoading(false);
            }
        };

        hydrateCustomer();
    }, []);

    useEffect(() => {
        if (useSeparateBillingAddress) return;
        setBillingName((prev) => prev || customerName);
        setBillingCompany((prev) => prev || customerCompany);
        setBillingAddress((prev) => prev || deliveryAddress);
        setBillingZip((prev) => prev || deliveryZip);
        setBillingCity((prev) => prev || deliveryCity);
    }, [
        useSeparateBillingAddress,
        customerName,
        customerCompany,
        deliveryAddress,
        deliveryZip,
        deliveryCity,
    ]);

    useEffect(() => {
        if (senderMode !== "custom") return;
        if (senderName.trim()) return;
        const defaultSender = customerCompany.trim() || customerName.trim();
        if (defaultSender) {
            setSenderName(defaultSender);
        }
    }, [senderMode, senderName, customerCompany, customerName]);

    useEffect(() => {
        const productKey = state?.productId;
        if (!productKey) return;
        const readyFlag = sessionStorage.getItem(`order-design:${productKey}`);
        if (!readyFlag) return;
        setProofingApproved(true);
        setProofingOpen(false);
    }, [state?.productId]);

    useEffect(() => {
        const tenantId = shopSettings.data?.id;
        if (!tenantId) return;

        const fetchPaymentStatus = async () => {
            setPaymentStatusLoaded(false);
            const { data } = await (supabase as any)
                .from("tenant_payment_settings")
                .select("status, charges_enabled, stripe_account_id")
                .eq("tenant_id", tenantId)
                .maybeSingle();

            if (data) {
                setTenantPaymentStatus(data);
            } else {
                setTenantPaymentStatus(null);
            }
            setPaymentStatusLoaded(true);
        };

        fetchPaymentStatus();
    }, [shopSettings.data?.id]);

    const calculateUpsells = (m: any, currentQty: number, row: string) => {
        console.log(`Calculating upsells for Row: ${row}, Current Qty: ${currentQty}`);
        if (!m || !m.columns || !row) {
            console.warn("Aborting upsell calculation: missing matrix, columns, or row");
            return;
        }

        const q = Number(currentQty);
        // Find the index of the current (or next) quantity tier
        const currentIndex = m.columns.findIndex((c: number) => Number(c) >= q);
        console.log("Current quantity index in matrix:", currentIndex);

        if (currentIndex === -1) {
            console.log("Current quantity is beyond the highest matrix tier.");
            return;
        }

        const tiers = m.columns.slice(currentIndex + 1, currentIndex + 3);
        console.log("Potential upsell tiers:", tiers);

        const options = tiers.map((qty: number) => {
            const price = m.cells[row]?.[qty] || 0;

            // For unit price comparison, use the price of the current tier in the matrix or state price
            const currentTierQty = m.columns[currentIndex];
            const currentTierPrice = m.cells[row]?.[currentTierQty] || state?.productPrice || orderPrice || 1;

            const currentUnitPrice = currentTierPrice / currentTierQty;
            const newUnitPrice = price / qty;
            const savingPercent = Math.round((1 - (newUnitPrice / currentUnitPrice)) * 100);

            console.log(`Tier ${qty}: Price=${price}, UnitPrice=${newUnitPrice.toFixed(2)}, Saving=${savingPercent}%`);

            return {
                quantity: qty,
                price: price,
                savingPercent: Math.max(0, savingPercent)
            };
        }).filter((opt: any) => opt.price > 0);

        console.log("Final upsell options:", options);
        setUpsellOptions(options);
    };

    const handleUpgrade = (qty: number, price: number) => {
        setOrderQuantity(qty);
        setOrderPrice(price);
        toast.success(`Ordre opgraderet til ${qty.toLocaleString()} stk!`);
        // Recalculate upsells for the new quantity
        if (matrix) {
            const variantValue = state.variant || state.selectedVariant;
            const rowName = matrix.rows.find((r: string) =>
                variantValue && r.toLowerCase().trim() === variantValue.toLowerCase().trim()
            ) || matrix.rows.find((r: string) =>
                variantValue && r.toLowerCase().includes(variantValue.toLowerCase())
            ) || matrix.rows[0];
            calculateUpsells(matrix, qty, rowName);
        }
    };

    const resetProofingAdjustments = () => {
        setProofingScale(100);
        setProofingOffset({ x: 0, y: 0 });
    };

    const prepareImageProofingPreview = async (file: File, specs: TechnicalSpecs): Promise<ProofingPreviewData> => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = objectUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        return {
            fileType: "image",
            previewUrl: objectUrl,
            physicalWidthMm: (img.width / specs.min_dpi) * 25.4,
            physicalHeightMm: (img.height / specs.min_dpi) * 25.4,
            sourceWidthPx: img.width,
            sourceHeightPx: img.height,
        };
    };

    const preparePdfProofingPreview = async (file: File): Promise<ProofingPreviewData> => {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const widthMm = ptToMm(baseViewport.width);
        const heightMm = ptToMm(baseViewport.height);

        const previewMaxSize = 1400;
        const renderScale = Math.min(previewMaxSize / baseViewport.width, previewMaxSize / baseViewport.height, 2.5);
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Kunne ikke oprette PDF-preview");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
            canvasContext: context,
            viewport,
        }).promise;

        return {
            fileType: "pdf",
            previewUrl: canvas.toDataURL("image/png"),
            physicalWidthMm: widthMm,
            physicalHeightMm: heightMm,
            sourceWidthPx: canvas.width,
            sourceHeightPx: canvas.height,
            pageCount: pdf.numPages,
        };
    };

    const prepareProofingPreview = async (file: File, specs: TechnicalSpecs) => {
        if (file.type.startsWith("image/")) {
            return prepareImageProofingPreview(file, specs);
        }
        return preparePdfProofingPreview(file);
    };

    const processUploadFile = async (file: File | null | undefined) => {
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Venligst upload en PDF eller et billede (JPG, PNG, TIFF)");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setPreflightResults(null);
        setPlatformPreflight(null);
        setProofingApproved(false);
        setProofingOpen(false);
        setProofingPreview(null);
        resetProofingAdjustments();

        try {
            const specs = getResolvedSpecs();
            if (!specs) {
                toast.error("Kunne ikke finde tekniske specifikationer for produktet.");
                return;
            }

            const fileExt = file.name.split('.').pop();
            const productRef = state.productId || state.productSlug || 'unknown';
            const fileName = `${productRef}-order-${Date.now()}.${fileExt}`;
            const filePath = `order-files/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('order-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('order-files')
                .getPublicUrl(filePath);

            const preparedPreview = await prepareProofingPreview(file, specs);
            setUploadedFile({ name: file.name, url: publicUrl, path: filePath });
            setPreviewUrl(preparedPreview.previewUrl);
            setProofingPreview(preparedPreview);

            await runPreflight(file, { filePath, publicUrl });
            setProofingOpen(true);

            toast.success("Fil uploadet og tjekket");
        } catch (err) {
            console.error("Error uploading file:", err);
            toast.error("Kunne ikke uploade fil");
        } finally {
            setUploading(false);
            setUploadDropActive(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        await processUploadFile(event.target.files?.[0]);
        event.target.value = "";
    };

    const handleUploadDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!uploadDropActive) setUploadDropActive(true);
    };

    const handleUploadDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        setUploadDropActive(false);
    };

    const handleUploadDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setUploadDropActive(false);
        await processUploadFile(event.dataTransfer?.files?.[0]);
    };

    const runPreflight = async (file: File, uploadInfo?: { filePath: string; publicUrl: string }) => {
        const specs = getResolvedSpecs();
        if (!specs) return;

        const issues: string[] = [];
        let dpi = 0;
        let width_px = 0;
        let height_px = 0;
        let aspectRatioMatch = true;
        let dpiOk = true;

        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((resolve) => (img.onload = resolve));

            width_px = img.width;
            height_px = img.height;

            const targetWidthMm = specs.width_mm + (specs.bleed_mm * 2);
            const targetHeightMm = specs.height_mm + (specs.bleed_mm * 2);

            const dpiW = width_px / (targetWidthMm / 25.4);
            const dpiH = height_px / (targetHeightMm / 25.4);
            dpi = Math.min(dpiW, dpiH);

            if (dpi < specs.min_dpi) {
                dpiOk = false;
                issues.push(`Opløsningen er for lav: ${Math.round(dpi)} DPI (Minimum ${specs.min_dpi} DPI påkrævet inkl. beskæring)`);
            }

            const fileRatio = width_px / height_px;
            const targetRatio = targetWidthMm / targetHeightMm;
            if (Math.abs(fileRatio - targetRatio) > 0.05) {
                aspectRatioMatch = false;
                issues.push("Størrelsesforholdet matcher ikke produktet. Filen kan blive beskåret uhensigtsmæssigt.");
            }
        } else if (file.type === 'application/pdf') {
            try {
                const pdfjsLib = await import("pdfjs-dist");
                pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1 });

                const pdfWidthMm = ptToMm(viewport.width);
                const pdfHeightMm = ptToMm(viewport.height);
                const targetWidthMm = specs.width_mm + (specs.bleed_mm * 2);
                const targetHeightMm = specs.height_mm + (specs.bleed_mm * 2);
                const widthDelta = Math.abs(pdfWidthMm - targetWidthMm);
                const heightDelta = Math.abs(pdfHeightMm - targetHeightMm);

                if (widthDelta > 1 || heightDelta > 1) {
                    aspectRatioMatch = false;
                    issues.push(`PDF-formatet er ${Math.round(pdfWidthMm)} × ${Math.round(pdfHeightMm)} mm og matcher ikke målformatet ${Math.round(targetWidthMm)} × ${Math.round(targetHeightMm)} mm.`);
                }
            } catch (pdfError) {
                console.error("PDF dimension check failed:", pdfError);
                issues.push("Kunne ikke læse PDF-dimensioner automatisk. Kontroller filformatet manuelt.");
            }

            if (isPodProduct && podPreflightEnabled && uploadInfo?.publicUrl && product?.id) {
                await runPlatformPreflight({
                    productId: product.id,
                    pdfUrl: uploadInfo.publicUrl,
                    filePath: uploadInfo.filePath,
                    specs,
                    autoFix: podPreflightAutoFix,
                });
            } else {
                issues.push("PDF preflight er begrænset i browseren. Vi tjekker formatet manuelt ved modtagelse.");
            }
        }

        setPreflightResults({
            dpi: Math.round(dpi),
            width_px,
            height_px,
            aspectRatioMatch,
            dpiOk,
            issues
        });
    };

    const runPlatformPreflight = async (params: {
        productId: string;
        pdfUrl: string;
        filePath: string;
        specs: TechnicalSpecs;
        autoFix: boolean;
    }) => {
        setPlatformPreflightLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("pod2-pdf-preflight", {
                body: {
                    productId: params.productId,
                    pdfUrl: params.pdfUrl,
                    filePath: params.filePath,
                    specs: params.specs,
                    autoFix: params.autoFix,
                },
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            const result = {
                status: data.status as "PROCESSING" | "PROCESSED" | "FAILED",
                errors: data.errors || [],
                warnings: data.warnings || [],
                fixes: data.fixes || [],
                jobId: data.jobId,
                updatedFileUrl: data.updatedFileUrl,
                message: data.message,
            };

            setPlatformPreflight(result);

            if (data.updatedFileUrl) {
                setUploadedFile((prev) => prev ? { ...prev, url: data.updatedFileUrl } : prev);
            }
        } catch (err: any) {
            console.error("Platform preflight error:", err);
            setPlatformPreflight({
                status: "FAILED",
                errors: [err?.message || "Platform preflight fejlede"],
                warnings: [],
                fixes: [],
            });
        } finally {
            setPlatformPreflightLoading(false);
        }
    };

    if (loading || !state) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const proofingPrimaryIssue = preflightResults?.issues?.[0] || platformPreflight?.errors?.[0] || null;

    const handleProofingPointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        proofingDragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            startX: proofingOffset.x,
            startY: proofingOffset.y,
        };
        setProofingDragging(true);
    };

    const handleProofingResizeStart = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = proofingArtworkRef.current?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startDistance = Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY));
        proofingResizeStartRef.current = {
            centerX,
            centerY,
            startDistance,
            startScale: proofingScale,
        };
        setProofingResizing(true);
    };

    const handleApproveProofing = () => {
        setProofingApproved(true);
        setProofingOpen(false);
        toast.success("Fil godkendt til ordre.");
    };

    const handleOpenFullDesigner = () => {
        const params = new URLSearchParams(location.search);
        if (state?.productId) params.set("productId", String(state.productId));
        if (resolvedFormatLabel && resolvedFormatLabel !== "Standard") {
            params.set("format", String(resolvedFormatLabel));
        } else if (specs) {
            params.set("widthMm", String(specs.width_mm));
            params.set("heightMm", String(specs.height_mm));
            params.set("bleedMm", String(specs.bleed_mm));
            params.set("safeMm", String(safeAreaMm));
        }
        params.set("order", "1");
        params.set("returnTo", `${location.pathname}${location.search}`);
        navigate(`/designer?${params.toString()}`);
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-12">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <h1 className="text-2xl font-heading font-semibold tracking-tight text-slate-900 md:text-[28px]">
                            Konfigurer dit design
                        </h1>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleBackToConfiguration}
                                className="h-auto rounded-md bg-white px-3 py-1 text-xs font-semibold"
                            >
                                1. Bestilling
                            </Button>
                            <Badge className="rounded-md px-3 py-1">2. Fil-tjek</Badge>
                            <Badge variant="outline" className="rounded-md bg-white px-3 py-1 opacity-50">3. Betaling</Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Valgt konfiguration</CardTitle>
                                        <Package className="h-5 w-5 text-slate-400" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="pb-4 border-b border-black/5">
                                        <h4 className="font-bold text-lg">{state.productName}</h4>
                                        <p className="text-sm text-muted-foreground">{state.summary}</p>
                                        <div className="mt-2 space-y-1">
                                            {Object.values(nonSizeOptionSelections).map((opt: CheckoutOptionSelection, idx: number) => (
                                                <p key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                                                    {opt.name}
                                                </p>
                                            ))}
                                        </div>

                                        {sizeDistributionConfig && (
                                            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm space-y-2">
                                                <div>
                                                    <p className="text-xs font-semibold text-primary">{sizeDistributionConfig.title}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Fordel størrelserne. Dette påvirker ikke prisen.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {sizeDistributionFields.map((field) => (
                                                        <label key={field.key} className="space-y-1">
                                                            <span className="text-[11px] text-muted-foreground">{field.label}</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                value={sizeDistributionValues[field.key] ?? 0}
                                                                onChange={(event) => handleSizeDistributionChange(field.key, event.target.value)}
                                                                className="h-8 bg-white"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                                <p className={`text-[11px] ${sizeDistributionMismatch ? "text-destructive" : "text-muted-foreground"}`}>
                                                    Sum: {sizeDistributionTotal} / {orderQuantity} stk
                                                    {sizeDistributionMismatch ? " (matcher ikke antal)" : ""}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Antal:</span>
                                            <span className="font-medium">{orderQuantity} stk</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Pris ex. moms:</span>
                                            <span className="font-medium">{orderPrice} kr</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                Levering{selectedDeliveryLabel ? ` (${selectedDeliveryLabel})` : ""}:
                                            </span>
                                            <span className="font-medium">{shippingCost} kr</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-primary/10 flex justify-between items-end">
                                        <span className="font-bold">Total (ex. moms):</span>
                                        <span className="text-2xl font-bold text-primary">{checkoutTotal} kr</span>
                                    </div>

                                    {paymentStatusLoaded &&
                                        !shopSettings.data?.is_platform_owned &&
                                        (!tenantPaymentStatus ||
                                            !tenantPaymentStatus.stripe_account_id ||
                                            !tenantPaymentStatus.charges_enabled ||
                                            tenantPaymentStatus.status === "disabled") && (
                                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2 shadow-sm">
                                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                                <div>
                                                    <p className="font-medium">Betaling går til platformen</p>
                                                    <p className="text-xs text-amber-700">
                                                        Denne shop er ikke forbundet til Stripe endnu. For at modtage betalinger direkte, skal shop-ejeren forbinde Stripe i admin.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                    {platformPreflightBlocking && (
                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2 shadow-sm">
                                            <AlertCircle className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <p className="font-medium">Print.com preflight mangler</p>
                                                <p className="text-xs text-red-700">
                                                    Filen skal godkendes eller fixes før betaling kan fortsætte.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {sizeDistributionMismatch && (
                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2 shadow-sm">
                                            <AlertCircle className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <p className="font-medium">Størrelsesfordeling mangler</p>
                                                <p className="text-xs text-red-700">
                                                    Summen af størrelser skal være {orderQuantity} stk før betaling.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {proofingApprovalPending && (
                                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2 shadow-sm">
                                            <AlertCircle className="h-4 w-4 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="font-medium">Filkorrektur mangler godkendelse</p>
                                                <p className="text-xs text-amber-700">
                                                    Åbn korrekturvinduet, juster filen og godkend den før betaling.
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 bg-white"
                                                    onClick={() => setProofingOpen(true)}
                                                >
                                                    Åbn korrektur
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full h-12 text-lg font-bold mt-4 group shadow-md"
                                        onClick={handleProceedToPayment}
                                        disabled={!uploadedFile || paymentLoading || platformPreflightBlocking || sizeDistributionMismatch || proofingApprovalPending}
                                    >
                                        {paymentLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Forbereder betaling...
                                            </>
                                        ) : (
                                            <>
                                                Gå til betaling
                                                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden shadow-sm">
                                <CardHeader className="bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Kunde & levering</CardTitle>
                                            <CardDescription>Udfyld kundeoplysninger, leveringsadresse og vælg leveringsmetode før betaling.</CardDescription>
                                        </div>
                                        <Info className="h-8 w-8 text-primary opacity-20" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="customer-name">Bestiller</Label>
                                            <Input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customer-email">E-mail</Label>
                                            <Input id="customer-email" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customer-phone">Telefon</Label>
                                            <Input id="customer-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customer-company">Firma</Label>
                                            <Input id="customer-company" value={customerCompany} onChange={(event) => setCustomerCompany(event.target.value)} />
                                        </div>
                                    </div>

                                    {checkoutUserId && (
                                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                                            <div>
                                                <h3 className="text-sm font-semibold">Kundebank</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Gem komplette kundeopsætninger til bureau- og genbestillingsflow.
                                                </p>
                                            </div>
                                            <select
                                                value={selectedCustomerProfileId}
                                                onChange={async (event) => {
                                                    const nextValue = event.target.value;
                                                    setSelectedCustomerProfileId(nextValue);
                                                    if (nextValue === "new") {
                                                        setCustomerProfileLabel("");
                                                        return;
                                                    }
                                                    const profile = savedCustomerProfiles.find((entry) => entry.id === nextValue);
                                                    if (profile) {
                                                        applyCustomerProfile(profile);
                                                    }
                                                }}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                            >
                                                <option value="new">Ny kundeopsætning</option>
                                                {savedCustomerProfiles.map((profile) => (
                                                    <option key={profile.id} value={profile.id}>
                                                        {profile.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                                                <Input
                                                    value={customerProfileLabel}
                                                    onChange={(event) => setCustomerProfileLabel(event.target.value)}
                                                    placeholder="Fx Kunde Nordhavn eller Designkunde 12"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        if (!checkoutUserId) return;
                                                        const label = customerProfileLabel.trim()
                                                            || deliveryCompany.trim()
                                                            || deliveryRecipientName.trim()
                                                            || customerCompany.trim()
                                                            || customerName.trim();
                                                        if (!label) {
                                                            toast.error("Giv kundeprofilen et navn før du gemmer den.");
                                                            return;
                                                        }
                                                        const profile = await upsertCheckoutCustomerProfile(checkoutUserId, {
                                                            id: selectedCustomerProfileId !== "new" ? selectedCustomerProfileId : null,
                                                            label,
                                                            customerEmail,
                                                            customerName,
                                                            customerPhone,
                                                            customerCompany,
                                                            deliveryRecipientName,
                                                            deliveryCompany,
                                                            deliveryAddress,
                                                            deliveryZip,
                                                            deliveryCity,
                                                            useSeparateBillingAddress,
                                                            billingName,
                                                            billingCompany,
                                                            billingAddress,
                                                            billingZip,
                                                            billingCity,
                                                            senderMode,
                                                            senderName,
                                                        });
                                                        if (!profile) {
                                                            toast.error("Kundeprofilen kunne ikke gemmes.");
                                                            return;
                                                        }
                                                        const nextProfiles = await readCheckoutCustomerProfiles(checkoutUserId);
                                                        setSavedCustomerProfiles(nextProfiles);
                                                        setSelectedCustomerProfileId(profile.id);
                                                        setCustomerProfileLabel(profile.label);
                                                        toast.success("Kundeprofil gemt.");
                                                    }}
                                                >
                                                    Gem kunde
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={selectedCustomerProfileId === "new"}
                                                    onClick={async () => {
                                                        if (!checkoutUserId || selectedCustomerProfileId === "new") return;
                                                        const ok = await deleteCheckoutCustomerProfile(checkoutUserId, selectedCustomerProfileId);
                                                        if (!ok) {
                                                            toast.error("Kundeprofilen kunne ikke slettes.");
                                                            return;
                                                        }
                                                        setSavedCustomerProfiles(await readCheckoutCustomerProfiles(checkoutUserId));
                                                        setSelectedCustomerProfileId("new");
                                                        setCustomerProfileLabel("");
                                                        toast.success("Kundeprofil slettet.");
                                                    }}
                                                >
                                                    Slet
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {checkoutUserId && (
                                        <div className="space-y-2">
                                            <div>
                                                <h3 className="text-sm font-semibold">Adressebank</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Vælg en tidligere modtager, hvis du ofte sender til forskellige kunder.
                                                </p>
                                            </div>
                                            <select
                                                value={selectedSavedAddressId}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    setSelectedSavedAddressId(nextValue);
                                                    if (nextValue === "new") {
                                                        setDeliveryRecipientName("");
                                                        setDeliveryCompany("");
                                                        setDeliveryAddress("");
                                                        setDeliveryZip("");
                                                        setDeliveryCity("");
                                                        setAddressLabel("");
                                                        return;
                                                    }
                                                    const selectedAddress = savedAddresses.find((entry) => entry.id === nextValue);
                                                    if (selectedAddress) {
                                                        applySavedAddress(selectedAddress);
                                                    }
                                                }}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                                disabled={savedAddressesLoading}
                                            >
                                                <option value="new">Ny leveringsadresse</option>
                                                {savedAddresses.map((address) => (
                                                    <option key={address.id} value={address.id}>
                                                        {formatSavedAddressLabel(address)}
                                                    </option>
                                                ))}
                                            </select>
                                            {savedAddressesLoading && (
                                                <p className="text-xs text-muted-foreground">Henter gemte adresser...</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="delivery-recipient-name">Modtager navn</Label>
                                            <Input
                                                id="delivery-recipient-name"
                                                value={deliveryRecipientName}
                                                onChange={(event) => setDeliveryRecipientName(event.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="delivery-company">Modtager firma</Label>
                                            <Input
                                                id="delivery-company"
                                                value={deliveryCompany}
                                                onChange={(event) => setDeliveryCompany(event.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="delivery-address">Leveringsadresse</Label>
                                        <Input id="delivery-address" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="delivery-zip">Postnr.</Label>
                                            <Input id="delivery-zip" value={deliveryZip} onChange={(event) => setDeliveryZip(event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="delivery-city">By</Label>
                                            <Input id="delivery-city" value={deliveryCity} onChange={(event) => setDeliveryCity(event.target.value)} />
                                        </div>
                                    </div>

                                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                                        <div>
                                            <h3 className="text-sm font-semibold">Afsender på pakken</h3>
                                            <p className="text-xs text-muted-foreground">
                                                Vælg om pakken skal sendes med standardafsender, blind forsendelse eller dit eget navn.
                                            </p>
                                        </div>
                                        <RadioGroup
                                            value={senderMode}
                                            onValueChange={(value) => {
                                                const nextValue = value as CheckoutSenderMode;
                                                setSenderMode(nextValue);
                                                if (nextValue === "custom" && !senderName.trim()) {
                                                    setSenderName(customerCompany.trim() || customerName.trim());
                                                }
                                            }}
                                            className="space-y-2"
                                        >
                                            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                                                <RadioGroupItem value="standard" id="sender-standard" className="mt-1" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">Standard</p>
                                                    <p className="text-xs text-muted-foreground">WebPrinter står som normal afsender.</p>
                                                </div>
                                            </label>
                                            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                                                <RadioGroupItem value="blind" id="sender-blind" className="mt-1" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">Blind forsendelse</p>
                                                    <p className="text-xs text-muted-foreground">Modtageren ser ikke WebPrinter som afsender.</p>
                                                </div>
                                            </label>
                                            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                                                <RadioGroupItem value="custom" id="sender-custom" className="mt-1" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">Brug eget navn/firma</p>
                                                    <p className="text-xs text-muted-foreground">Pakken sendes med dit navn eller firmanavn som afsender.</p>
                                                </div>
                                            </label>
                                        </RadioGroup>
                                        {senderMode === "custom" && (
                                            <div className="space-y-2">
                                                <Label htmlFor="sender-name">Afsendernavn</Label>
                                                <Input
                                                    id="sender-name"
                                                    value={senderName}
                                                    onChange={(event) => setSenderName(event.target.value)}
                                                    placeholder="Dit navn eller firmanavn"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {checkoutUserId && (
                                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                                            <label className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 h-4 w-4 rounded border-slate-300"
                                                    checked={saveAddressForLater}
                                                    onChange={(event) => setSaveAddressForLater(event.target.checked)}
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">Gem modtager i adressebank</p>
                                                    <p className="text-xs text-muted-foreground">Så kan du hurtigt vælge adressen igen næste gang.</p>
                                                </div>
                                            </label>
                                            {saveAddressForLater && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="address-label">Adresselabel</Label>
                                                    <Input
                                                        id="address-label"
                                                        value={addressLabel}
                                                        onChange={(event) => setAddressLabel(event.target.value)}
                                                        placeholder="Fx Kunde Aarhus eller Studio kunde 3"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                                        <label className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 rounded border-slate-300"
                                                checked={useSeparateBillingAddress}
                                                onChange={(event) => setUseSeparateBillingAddress(event.target.checked)}
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">Brug separat faktureringsadresse</p>
                                                <p className="text-xs text-muted-foreground">Hvis fakturaen skal gå til en anden adresse end leveringen.</p>
                                            </div>
                                        </label>

                                        {useSeparateBillingAddress && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="billing-name">Faktura navn</Label>
                                                        <Input
                                                            id="billing-name"
                                                            value={billingName}
                                                            onChange={(event) => setBillingName(event.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="billing-company">Faktura firma</Label>
                                                        <Input
                                                            id="billing-company"
                                                            value={billingCompany}
                                                            onChange={(event) => setBillingCompany(event.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="billing-address">Faktura adresse</Label>
                                                    <Input
                                                        id="billing-address"
                                                        value={billingAddress}
                                                        onChange={(event) => setBillingAddress(event.target.value)}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="billing-zip">Faktura postnr.</Label>
                                                        <Input
                                                            id="billing-zip"
                                                            value={billingZip}
                                                            onChange={(event) => setBillingZip(event.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="billing-city">Faktura by</Label>
                                                        <Input
                                                            id="billing-city"
                                                            value={billingCity}
                                                            onChange={(event) => setBillingCity(event.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div>
                                            <h3 className="text-sm font-semibold">Leveringsmetode</h3>
                                            <p className="text-xs text-muted-foreground">
                                                Vælg levering her i checkout. Deadline og nedtælling opdateres live.
                                            </p>
                                        </div>

                                        <RadioGroup value={shippingSelected} onValueChange={setShippingSelected} className="space-y-2">
                                            {activeDeliveryMethods.map((method) => {
                                                const methodCost = resolveDeliveryMethodCost(orderPrice, method);
                                                const deadline = getNextCutoffDate(method, deliveryNow);
                                                const countdown = deadline ? formatCountdown(deadline.getTime() - deliveryNow.getTime()) : null;
                                                const estimatedDelivery = getEstimatedDeliveryDate(method, deliveryNow);
                                                const isSelected = shippingSelected === method.id;

                                                return (
                                                    <label
                                                        key={method.id}
                                                        htmlFor={`delivery-${method.id}`}
                                                        className={`block cursor-pointer rounded-lg border px-3 py-3 shadow-sm transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <RadioGroupItem id={`delivery-${method.id}`} value={method.id} className="mt-1" />
                                                            <div className="flex-1 space-y-2">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-900">{method.name}</p>
                                                                        {method.description && (
                                                                            <p className="text-xs text-muted-foreground">{method.description}</p>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-semibold text-slate-900">{methodCost} kr</p>
                                                                        <p className="text-[11px] text-muted-foreground">ex. moms</p>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                        <span className="font-medium text-slate-700">
                                                                            {method.cutoff_label === "latest" ? "Seneste bestilling:" : "Bestil inden:"}
                                                                        </span>
                                                                        <span>{deadline ? deliveryDateTimeFormatter.format(deadline) : "Ingen deadline angivet"}</span>
                                                                        {countdown && (
                                                                            <span className="inline-flex items-center gap-1 text-primary">
                                                                                <Clock3 className="h-3 w-3" />
                                                                                {countdown} tilbage
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                        <span className="font-medium text-slate-700">Forventet levering:</span>
                                                                        <span>{estimatedDelivery ? deliveryDateFormatter.format(estimatedDelivery) : "Beregnes ved ordre"}</span>
                                                                        {typeof method.lead_time_days === "number" && method.lead_time_days > 0 && (
                                                                            <span>Ca. {method.lead_time_days} hverdage</span>
                                                                        )}
                                                                    </div>

                                                                    {method.cutoff_text && (
                                                                        <p className="text-[11px] text-muted-foreground">{method.cutoff_text}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </RadioGroup>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        <div className="space-y-6">
                            <Card className="overflow-hidden shadow-sm">
                                <CardHeader className="bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Fil Upload</CardTitle>
                                            <CardDescription>Trykklar PDF</CardDescription>
                                        </div>
                                        {uploading ? (
                                            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
                                        ) : (
                                            <FileText className="h-8 w-8 text-primary opacity-20" />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    {!uploadedFile ? (
                                        <div
                                            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all group shadow-sm ${
                                                uploadDropActive
                                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                                    : "border-primary/20 hover:bg-primary/5"
                                            }`}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleUploadDragOver}
                                            onDragEnter={handleUploadDragOver}
                                            onDragLeave={handleUploadDragLeave}
                                            onDrop={handleUploadDrop}
                                        >
                                            <div className="flex flex-col items-center">
                                                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-transform ${
                                                    uploadDropActive ? "bg-primary/20 scale-110" : "bg-primary/10 group-hover:scale-110"
                                                }`}>
                                                    <Upload className="h-6 w-6 text-primary" />
                                                </div>
                                                <h3 className="mb-1 text-base font-semibold">
                                                    {uploadDropActive ? "Slip filen her" : "Klik eller træk fil hertil"}
                                                </h3>
                                                <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                                                    PDF, JPG eller TIFF. Maksimal filstørrelse 50MB. Vi anbefaler 300 DPI for bedste resultat.
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                accept=".pdf,.jpg,.jpeg,.png,.tiff"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50 p-4 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                                    <div>
                                                        <p className="font-semibold text-green-900">{uploadedFile.name}</p>
                                                        <p className="text-xs text-green-700">
                                                            {proofingApproved ? "Filen er godkendt til ordre" : "Filen er klar til korrektur"}
                                                        </p>
                                                    </div>
                                                </div>
                                            <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setUploadedFile(null);
                                                            setPreviewUrl(null);
                                                            setProofingPreview(null);
                                                            setProofingApproved(false);
                                                            setProofingOpen(false);
                                                            setPreflightResults(null);
                                                            setPlatformPreflight(null);
                                                            resetProofingAdjustments();
                                                        }}
                                                    >
                                                        Skift fil
                                                    </Button>
                                                </div>
                                            </div>

                                            {previewUrl && (
                                                <div className="relative border bg-white shadow-inner p-4">
                                                    <div className="absolute top-2 right-2 flex gap-2">
                                                        <Badge className="bg-white/90 text-primary border-primary/20 backdrop-blur-sm">Visuel Preview</Badge>
                                                    </div>
                                                    <div className="mx-auto flex w-full max-w-md justify-center">
                                                        <div
                                                            className="relative w-full overflow-hidden border border-slate-300 bg-white"
                                                            style={{ aspectRatio: targetWidth > 0 && targetHeight > 0 ? `${targetWidth} / ${targetHeight}` : "1 / 1" }}
                                                        >
                                                            {proofingPreview && (
                                                                <div
                                                                    className="absolute left-1/2 top-1/2"
                                                                    style={{
                                                                        width: `${proofingBaseWidthPercent}%`,
                                                                        height: `${proofingBaseHeightPercent}%`,
                                                                        transform: `translate(calc(-50% + ${proofingOffset.x}%), calc(-50% + ${proofingOffset.y}%)) scale(${proofingScaleFactor})`,
                                                                        transformOrigin: "center center",
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={proofingPreview.previewUrl}
                                                                        alt="Preview"
                                                                        className="h-full w-full object-contain select-none"
                                                                        draggable={false}
                                                                    />
                                                                </div>
                                                            )}
                                                            {specs && (
                                                                <>
                                                                    <div
                                                                        className="absolute inset-0 border-2 border-dashed border-red-500/90 pointer-events-none z-20"
                                                                        style={{
                                                                            top: `${bleedYPercent}%`,
                                                                            bottom: `${bleedYPercent}%`,
                                                                            left: `${bleedXPercent}%`,
                                                                            right: `${bleedXPercent}%`,
                                                                        }}
                                                                    />
                                                                    <div
                                                                        className="absolute inset-0 border border-emerald-500/90 pointer-events-none z-20"
                                                                        style={{
                                                                            top: `${safeYPercent}%`,
                                                                            bottom: `${safeYPercent}%`,
                                                                            left: `${safeXPercent}%`,
                                                                            right: `${safeXPercent}%`,
                                                                        }}
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex justify-center">
                                                        <Button variant="outline" size="sm" onClick={() => setProofingOpen(true)}>
                                                            Åbn korrektur
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {preflightResults && (
                                                <div className={`rounded-xl border-2 p-6 shadow-sm ${preflightResults.issues.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        {preflightResults.issues.length === 0 ? (
                                                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                                                        ) : (
                                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                                        )}
                                                        <h3 className="text-base font-semibold">
                                                            {preflightResults.issues.length === 0 ? 'Perfekt! Din fil er klar til tryk' : 'Vi har fundet nogle potentielle problemer'}
                                                        </h3>
                                                    </div>

                                                    {preflightResults.issues.length > 0 && (
                                                        <ul className="space-y-2 mb-4">
                                                            {preflightResults.issues.map((issue, idx) => (
                                                                <li key={idx} className="flex gap-2 text-sm text-amber-900">
                                                                    <span className="shrink-0">•</span>
                                                                    <span>{issue}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}

                                                    <div className="mt-4 grid grid-cols-1 gap-3">
                                                        <div className="rounded-lg border border-black/5 bg-white/50 p-3 shadow-sm">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Opløsning</p>
                                                            <p className={`text-sm font-semibold ${preflightResults.dpiOk ? 'text-green-600' : 'text-amber-600'}`}>
                                                                {preflightResults.dpi ? `${preflightResults.dpi} DPI` : 'PDF (Tjekkes manuelt)'}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg border border-black/5 bg-white/50 p-3 shadow-sm">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Target Størrelse</p>
                                                            <p className="text-sm font-semibold text-slate-700">
                                                                {targetWidth} x {targetHeight} mm
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {preflightResults.issues.length > 0 && (
                                                        <div className="mt-5 flex flex-wrap items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="bg-white px-3 text-xs sm:text-sm"
                                                                onClick={() => fileInputRef.current?.click()}
                                                            >
                                                                Upload ny fil
                                                            </Button>
                                                            <Button size="sm" className="px-3 text-xs sm:text-sm">
                                                                Fortsæt alligevel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {(platformPreflightLoading || platformPreflight) && (
                                                <div className={`rounded-xl border-2 p-6 shadow-sm ${platformPreflight?.status === 'FAILED' || (platformPreflight?.errors?.length ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        {platformPreflightLoading || platformPreflight?.status === 'PROCESSING' ? (
                                                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                                        ) : platformPreflight?.errors?.length ? (
                                                            <AlertCircle className="h-5 w-5 text-red-600" />
                                                        ) : (
                                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                        )}
                                                        <h3 className="font-bold text-base">
                                                            {platformPreflightLoading || platformPreflight?.status === 'PROCESSING'
                                                                ? 'Print.com preflight kører...'
                                                                : platformPreflight?.errors?.length
                                                                    ? 'Print.com preflight fandt fejl'
                                                                    : 'Print.com preflight gennemført'}
                                                        </h3>
                                                    </div>

                                                    {platformPreflight?.errors?.length > 0 && (
                                                        <div className="mb-3">
                                                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Fejl</p>
                                                            <ul className="space-y-1 mt-1">
                                                                {platformPreflight.errors.map((issue, idx) => (
                                                                    <li key={`pf-error-${idx}`} className="text-sm text-red-900">• {issue}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {platformPreflight?.warnings?.length > 0 && (
                                                        <div className="mb-3">
                                                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Advarsler</p>
                                                            <ul className="space-y-1 mt-1">
                                                                {platformPreflight.warnings.map((issue, idx) => (
                                                                    <li key={`pf-warn-${idx}`} className="text-sm text-amber-900">• {issue}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {platformPreflight?.fixes?.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Auto-fix</p>
                                                            <ul className="space-y-1 mt-1">
                                                                {platformPreflight.fixes.map((fix, idx) => (
                                                                    <li key={`pf-fix-${idx}`} className="text-sm text-green-900">• {fix}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="border-t border-slate-200 pt-6">
                                        <div className="mb-4 flex items-center gap-2">
                                            <Info className="h-5 w-5 text-primary" />
                                            <h3 className="text-base font-semibold text-slate-900">Tekniske Specifikationer</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="rounded-lg bg-muted/50 p-4 shadow-sm">
                                                <h4 className="mb-2 text-sm font-semibold">Mål for {state.productName} ({resolvedFormatLabel})</h4>
                                                <ul className="space-y-1 text-xs text-muted-foreground">
                                                    <li>Nettoformat: {specs?.width_mm} x {specs?.height_mm} mm</li>
                                                    <li>Bruttoformat (+beskæring): {targetWidth} x {targetHeight} mm</li>
                                                    <li>Beskæring (Bleed): {specs?.bleed_mm} mm på alle sider</li>
                                                    <li>Minimum opløsning: {specs?.min_dpi} DPI</li>
                                                </ul>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-4 shadow-sm">
                                                <h4 className="mb-2 text-sm font-semibold">Download skabeloner</h4>
                                                <div className="space-y-2">
                                                    {product?.template_files?.map((template: TemplateFile, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={template.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            {template.name} ({template.format || 'Standard'})
                                                        </a>
                                                    ))}
                                                    {(!product?.template_files || product.template_files.length === 0) && (
                                                        <p className="text-xs italic text-muted-foreground">Ingen skabeloner tilgængelige lige nu.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Best Deal Upgrades - Redesigned & Moved up */}
                            {upsellOptions.length > 0 && (
                                <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-white/80 p-6 shadow-sm backdrop-blur-md transition-all">
                                    <div className="flex flex-col gap-6">
                                        <div className="max-w-none">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                </div>
                                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">SPAR MERE</Badge>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-1">Få mere værdi</h3>
                                            <p className="text-sm text-slate-600 leading-relaxed">Vi har fundet bedre priser ved at købe større ind.</p>
                                        </div>

                                        <div className="grid w-full grid-cols-1 gap-4">
                                            {upsellOptions.map((opt, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col justify-between items-stretch hover:border-primary/30 transition-colors shadow-sm"
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-500">Mængde</p>
                                                            <p className="text-2xl font-black text-slate-900">{opt.quantity.toLocaleString()} <span className="text-xs font-normal text-slate-400">stk</span></p>
                                                            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/15 border-none mt-1 text-[10px] font-bold">
                                                                SPAR {opt.savingPercent}%
                                                            </Badge>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-400 line-through">
                                                                {orderQuantity > 0 ? (orderPrice * (opt.quantity / orderQuantity)).toFixed(0) : 0} kr
                                                            </p>
                                                            <p className="text-xl font-bold text-primary">{opt.price} kr</p>
                                                            <p className="text-[9px] text-slate-400">ex. moms</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full border-primary/20 text-primary hover:bg-primary hover:text-white transition-all font-bold group/btn"
                                                        onClick={() => handleUpgrade(opt.quantity, opt.price)}
                                                    >
                                                        Vælg {opt.quantity.toLocaleString()} stk
                                                        <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            <Dialog open={proofingOpen} onOpenChange={setProofingOpen}>
                <DialogContent className="max-w-6xl p-0 overflow-hidden">
                    <DialogHeader className="border-b border-slate-200 px-6 py-4">
                        <DialogTitle>Filkorrektur</DialogTitle>
                        <DialogDescription>
                            Kontrollér filens størrelse, bleed og placering før du fortsætter til betaling.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="bg-white p-6">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white/80">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {proofingPreview?.fileType === "pdf" ? "PDF korrektur" : "Billedkorrektur"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Træk motivet for at justere placering. Brug hjørnehåndtagene til at tilpasse størrelsen.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={resetProofingAdjustments}>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Nulstil
                                    </Button>
                                </div>
                            </div>

                            <div className="mx-auto flex w-full max-w-3xl justify-center">
                                <div
                                    ref={proofingArtboardRef}
                                    className="relative w-full overflow-hidden border border-slate-300 bg-white shadow-2xl"
                                    style={{ aspectRatio: targetWidth > 0 && targetHeight > 0 ? `${targetWidth} / ${targetHeight}` : "1 / 1" }}
                                >
                                    {proofingPreview && (
                                        <div
                                            ref={proofingArtworkRef}
                                            className="absolute left-1/2 top-1/2 cursor-grab active:cursor-grabbing"
                                            onMouseDown={handleProofingPointerDown}
                                            style={{
                                                width: `${proofingBaseWidthPercent}%`,
                                                height: `${proofingBaseHeightPercent}%`,
                                                transform: `translate(calc(-50% + ${proofingOffset.x}%), calc(-50% + ${proofingOffset.y}%)) scale(${proofingScaleFactor})`,
                                                transformOrigin: "center center",
                                            }}
                                        >
                                                <img
                                                    src={proofingPreview.previewUrl}
                                                    alt="Korrektur preview"
                                                    className="h-full w-full select-none object-contain"
                                                    draggable={false}
                                                />
                                                {[
                                                    "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                                                    "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                                                    "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                                                    "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                                                ].map((positionClass, index) => (
                                                    <button
                                                        key={positionClass}
                                                        type="button"
                                                        aria-label={`Skaler motiv ${index + 1}`}
                                                        onMouseDown={handleProofingResizeStart}
                                                        className={`absolute h-4 w-4 border border-white bg-primary shadow-sm ${positionClass}`}
                                                    />
                                                ))}
                                            </div>
                                    )}

                                    <div
                                        className="absolute inset-0 border-2 border-dashed border-red-400/90 pointer-events-none z-20"
                                        style={{
                                            top: `${bleedYPercent}%`,
                                            bottom: `${bleedYPercent}%`,
                                            left: `${bleedXPercent}%`,
                                            right: `${bleedXPercent}%`,
                                        }}
                                    >
                                        <div className="absolute -top-6 left-0 bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm whitespace-nowrap">
                                            BESKÆRINGSLINJE ({specs?.bleed_mm || 0}mm)
                                        </div>
                                    </div>
                                    <div
                                        className="absolute inset-0 border border-emerald-300/95 pointer-events-none z-20"
                                        style={{
                                            top: `${safeYPercent}%`,
                                            bottom: `${safeYPercent}%`,
                                            left: `${safeXPercent}%`,
                                            right: `${safeXPercent}%`,
                                        }}
                                    >
                                        <div className="absolute -top-6 right-0 bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm whitespace-nowrap">
                                            SIKKERHEDSZONE ({safeAreaMm}mm)
                                        </div>
                                    </div>

                                    <div className="absolute bottom-3 left-3 bg-black/55 px-3 py-2 text-[11px] text-white/90 backdrop-blur-sm">
                                        Artboard: {Math.round(targetWidth)} × {Math.round(targetHeight)} mm
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 bg-white p-6">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-900">Filstatus</p>
                                <div className={`rounded-lg border px-3 py-3 text-sm ${proofingPrimaryIssue ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
                                    <p className="font-medium">
                                        {proofingPrimaryIssue ? "Filen kræver kontrol" : "Filen ser klar ud"}
                                    </p>
                                    <p className="mt-1 text-xs">
                                        {proofingPrimaryIssue || "Placering, størrelse og bleed er klar til godkendelse."}
                                    </p>
                                </div>
                                {proofingDpiWarning && (
                                    <p className="text-xs text-amber-700">
                                        Opløsningen er under {specs?.min_dpi} DPI. Filen vises mindre for at bevare trykkvaliteten.
                                    </p>
                                )}
                                {proofingPhysicalMismatch && (
                                    <p className="text-xs text-amber-700">
                                        Filen er fysisk mindre end det bestilte layout. Den vises proportionelt i artboardet, så du kan se den reelle dækning.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produktformat</p>
                                    <p className="text-sm font-medium text-slate-900">{Math.round(targetWidth)} × {Math.round(targetHeight)} mm inkl. bleed</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploadet fil</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {proofingPreview ? `${Math.round(proofingPreview.physicalWidthMm)} × ${Math.round(proofingPreview.physicalHeightMm)} mm` : "Beregnede mål"}
                                    </p>
                                    {proofingPreview?.pageCount && (
                                        <p className="text-xs text-slate-500">PDF preview viser side 1 af {proofingPreview.pageCount}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opløsning</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {preflightResults?.dpi ? `${preflightResults.dpi} DPI` : "PDF / vektorbaseret preview"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sikkerhedszone</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {safeAreaMm} mm inden for beskæringslinjen
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Brug fuld designer for nøjagtig soft proof og finjustering. Denne korrektur viser størrelse, bleed og sikkerhedszone.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button type="button" onClick={handleApproveProofing}>
                                    Godkend fil og fortsæt
                                </Button>
                                <Button type="button" variant="outline" onClick={handleOpenFullDesigner}>
                                    Åbn fuld designer
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setProofingOpen(false)}>
                                    Luk korrektur
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Modal Overlay */}
            {showPaymentModal && paymentClientSecret && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={handlePaymentCancel}
                            className="absolute -top-12 right-0 text-white hover:text-white/80 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <StripePaymentForm
                            clientSecret={paymentClientSecret}
                            amount={checkoutTotal}
                            currency="dkk"
                            onSuccess={handlePaymentSuccess}
                            onCancel={handlePaymentCancel}
                            connectedAccountId={paymentConnectedAccountId}
                        />
                    </div>
                </div>
            )}

            {/* Payment Success Overlay */}
            {paymentSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <CardContent className="pt-8 pb-8 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-12 h-12 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-green-800 mb-2">
                                Tak for din ordre!
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                Vi har modtaget din betaling og begynder at behandle din ordre.
                                Du modtager snart en bekræftelse på email.
                            </p>
                            {createdOrderNumber && (
                                <p className="text-sm font-medium text-slate-700 mb-3">
                                    Ordrenummer: {createdOrderNumber}
                                </p>
                            )}
                            {sizeDistributionSummary && (
                                <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-3 text-left">
                                    <p className="text-xs font-semibold text-primary">Størrelsesfordeling</p>
                                    <p className="text-sm text-muted-foreground">{sizeDistributionSummary}</p>
                                </div>
                            )}
                            {orderPersistWarning && (
                                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                                    <p className="text-xs font-semibold text-amber-800">Bemærk</p>
                                    <p className="text-sm text-amber-700">{orderPersistWarning}</p>
                                </div>
                            )}
                            <Button onClick={() => navigate("/")} className="w-full">
                                Tilbage til forsiden
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default FileUploadConfiguration;
