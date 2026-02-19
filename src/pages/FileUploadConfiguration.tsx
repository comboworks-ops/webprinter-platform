import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopSettings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, AlertCircle, CheckCircle2, FileText, ArrowRight, Download, Info, Zap, Sparkles, Package, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { StripePaymentForm } from "@/components/checkout/StripePaymentForm";
import { getPageBackgroundStyle } from "@/lib/branding/background";
import { ptToMm } from "@/utils/unitConversions";
import { getImageDpi } from "@/utils/imageMetadata";
import {
    clearSiteCheckoutSession,
    readSiteCheckoutSession,
} from "@/lib/checkout/siteCheckoutSession";
import {
    cloneStandardDeliveryMethods,
    resolveDeliveryMethodCost,
} from "@/lib/delivery/defaults";
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
}

interface TemplateFile {
    name: string;
    url: string;
    path: string;
    format?: string;
    uploadedAt: string;
}

interface CheckoutDeliveryMethod {
    id: string;
    name: string;
    description?: string;
    lead_time_days?: number;
    cutoff_time?: string;
    cutoff_label?: "deadline" | "latest";
    submission?: string;
    delivery_date?: string;
    price: number;
}

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

const A3_SHORT_MM = 297;
const A3_LONG_MM = 420;
const MM_PER_INCH = 25.4;
const SIZE_TOLERANCE_MM = 1.5;
const ASPECT_RATIO_TOLERANCE = 0.03;
const PDF_PREVIEW_MAX_PX = 1400;
const DEFAULT_CHECKOUT_DELIVERY_METHODS: CheckoutDeliveryMethod[] =
    cloneStandardDeliveryMethods().map((method) => ({
        id: method.id,
        name: method.name,
        description: method.description,
        lead_time_days: method.lead_time_days,
        cutoff_time: method.cutoff_time,
        cutoff_label: method.cutoff_label,
        price: method.price,
    }));

const DEFAULT_CHECKOUT_DELIVERY_METHODS_BY_ID = new Map(
    DEFAULT_CHECKOUT_DELIVERY_METHODS.map((method) => [method.id.toLowerCase(), method]),
);

const toNumberOrNull = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDeliveryMethods = (rawMethods: unknown): CheckoutDeliveryMethod[] => {
    if (!Array.isArray(rawMethods)) return [];

    const normalized = rawMethods
        .map((raw, index) => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const name = typeof row.name === "string" ? row.name.trim() : "";
            if (!name) return null;
            const rawId = typeof row.id === "string" ? row.id.trim() : "";
            const id = rawId || `method-${index + 1}`;
            const fallback = DEFAULT_CHECKOUT_DELIVERY_METHODS_BY_ID.get(id.toLowerCase());
            return {
                id,
                name,
                description: typeof row.description === "string" ? row.description : (fallback?.description || ""),
                lead_time_days: toNumberOrNull(row.lead_time_days) ?? fallback?.lead_time_days ?? undefined,
                cutoff_time:
                    (typeof row.cutoff_time === "string" ? row.cutoff_time : "")
                    || (typeof row.cutoffTime === "string" ? row.cutoffTime : "")
                    || fallback?.cutoff_time
                    || "",
                cutoff_label:
                    ((typeof row.cutoff_label === "string" ? row.cutoff_label : "")
                        || (typeof row.cutoffLabel === "string" ? row.cutoffLabel : "")
                        || fallback?.cutoff_label
                        || "deadline") as "deadline" | "latest",
                submission: typeof row.submission === "string" ? row.submission : "",
                delivery_date:
                    (typeof row.delivery_date === "string" ? row.delivery_date : "")
                    || (typeof row.deliveryDate === "string" ? row.deliveryDate : ""),
                price: toNumberOrNull(row.price)
                    ?? resolveDeliveryMethodCost(1, { id, price: null }),
            } as CheckoutDeliveryMethod;
        })
        .filter((value): value is CheckoutDeliveryMethod => !!value);

    const unique = new Map<string, CheckoutDeliveryMethod>();
    normalized.forEach((method) => {
        if (!unique.has(method.id)) {
            unique.set(method.id, method);
        }
    });

    return Array.from(unique.values());
};

const parseDateValue = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseCutoffTimeValue = (value?: string): { hours: number; minutes: number } | null => {
    if (!value) return null;
    const [hoursRaw, minutesRaw] = value.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
};

const getNextCutoffDate = (method: CheckoutDeliveryMethod, now: Date): Date | null => {
    const parsed = parseCutoffTimeValue(method.cutoff_time);
    if (!parsed) return null;
    const cutoff = new Date(now);
    cutoff.setHours(parsed.hours, parsed.minutes, 0, 0);
    if (cutoff.getTime() <= now.getTime()) {
        cutoff.setDate(cutoff.getDate() + 1);
    }
    return cutoff;
};

const formatCountdown = (targetDate: Date, now: Date): string => {
    const diffMs = targetDate.getTime() - now.getTime();
    if (diffMs <= 0) return "0m";
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}t`;
    if (hours > 0) return `${hours}t ${minutes}m`;
    return `${minutes}m`;
};

const formatDeliveryMetaText = (method: CheckoutDeliveryMethod, now: Date): string => {
    const cutoffDate = getNextCutoffDate(method, now);
    if (cutoffDate && method.cutoff_time) {
        const label = method.cutoff_label === "latest" ? "Senest bestilling" : "Deadline";
        return `${label} kl. ${method.cutoff_time} (${formatCountdown(cutoffDate, now)})`;
    }
    const submissionDate = parseDateValue(method.submission);
    if (submissionDate) {
        return `Bestil senest: ${new Intl.DateTimeFormat("da-DK", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        }).format(submissionDate)}`;
    }
    if (typeof method.lead_time_days === "number" && method.lead_time_days > 0) {
        return `Leveringstid: ca. ${Math.round(method.lead_time_days)} dage`;
    }
    const deliveryDate = parseDateValue(method.delivery_date);
    if (deliveryDate) {
        return `Forventet levering: ${new Intl.DateTimeFormat("da-DK", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        }).format(deliveryDate)}`;
    }
    return "";
};

const isAtMostA3 = (widthMm: number, heightMm: number): boolean => {
    const shortSide = Math.min(widthMm, heightMm);
    const longSide = Math.max(widthMm, heightMm);
    return shortSide <= A3_SHORT_MM && longSide <= A3_LONG_MM;
};

const getSizeBasedMinDpi = (widthMm: number, heightMm: number): number => (
    isAtMostA3(widthMm, heightMm) ? 300 : 150
);

const FileUploadConfiguration = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = (location.state as any) || null;
    const sessionState = useMemo(
        () => (locationState ? null : readSiteCheckoutSession()),
        [location.key, locationState]
    );
    const state = (locationState || sessionState) as any;
    const shopSettings = useShopSettings();
    const pageBackgroundStyle = getPageBackgroundStyle(shopSettings.data?.branding);

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; path: string } | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [tenantPaymentStatus, setTenantPaymentStatus] = useState<{
        status: string;
        charges_enabled: boolean;
        stripe_account_id: string | null;
    } | null>(null);
    const [paymentStatusLoaded, setPaymentStatusLoaded] = useState(false);
    const [preflightResults, setPreflightResults] = useState<{
        fileType: "image" | "pdf";
        dpi?: number;
        width_px?: number;
        height_px?: number;
        file_width_mm?: number;
        file_height_mm?: number;
        target_width_mm?: number;
        target_height_mm?: number;
        required_dpi: number;
        source_dpi?: number;
        aspectRatioMatch: boolean;
        sizeMatch: boolean;
        dpiOk: boolean;
        issues: string[];
        warnings: string[];
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
    const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
    const [softProofEnabled, setSoftProofEnabled] = useState(false);
    const [previewFitToTarget, setPreviewFitToTarget] = useState(false);
    const [isDropZoneActive, setIsDropZoneActive] = useState(false);

    // Local Order Configuration (to allow for Best Deal upgrades)
    const [orderQuantity, setOrderQuantity] = useState<number>(state?.quantity || 0);
    const initialOrderPrice = toNumberOrNull(state?.productPrice) ?? toNumberOrNull(state?.totalPrice) ?? 0;
    const [orderPrice, setOrderPrice] = useState<number>(initialOrderPrice);
    const [deliveryMethods, setDeliveryMethods] = useState<CheckoutDeliveryMethod[]>([]);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(
        typeof state?.shippingSelected === "string" ? state.shippingSelected : null
    );
    const [shippingCost, setShippingCost] = useState<number>(toNumberOrNull(state?.shippingCost) || 0);
    const [deliveryNow, setDeliveryNow] = useState<Date>(() => new Date());
    const [matrix, setMatrix] = useState<{ rows: string[], columns: number[], cells: any } | null>(null);
    const [upsellOptions, setUpsellOptions] = useState<{ quantity: number, price: number, savingPercent: number }[]>([]);

    // Stripe payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
    const [paymentConnectedAccountId, setPaymentConnectedAccountId] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewBlobUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setDeliveryNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!locationState && sessionState) {
            clearSiteCheckoutSession();
        }
    }, [locationState, sessionState]);

    const clearPreview = () => {
        if (previewBlobUrlRef.current) {
            URL.revokeObjectURL(previewBlobUrlRef.current);
            previewBlobUrlRef.current = null;
        }
        setPreviewUrl(null);
        setPreviewType(null);
    };

    const setPreview = (url: string, type: "image" | "pdf", isObjectUrl = false) => {
        clearPreview();
        if (isObjectUrl) {
            previewBlobUrlRef.current = url;
        }
        setPreviewUrl(url);
        setPreviewType(type);
    };

    const clearUploadedFileState = () => {
        setUploadedFile(null);
        setPreflightResults(null);
        setPlatformPreflight(null);
        setSoftProofEnabled(false);
        setPreviewFitToTarget(false);
        clearPreview();
    };

    useEffect(() => {
        return () => {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }
        };
    }, []);
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
        const tenantId = shopSettings.data?.id;
        if (!tenantId) {
            toast.error("Kunne ikke finde shop-id til betaling.");
            return;
        }

        setPaymentLoading(true);
        try {
            const totalPrice = orderPrice + shippingCost;
            const amountOre = Math.round(totalPrice * 100);

            const { data, error } = await supabase.functions.invoke("stripe-create-payment-intent", {
                body: {
                    tenant_id: tenantId,
                    amount_ore: amountOre,
                    currency: "dkk",
                    metadata: {
                        product_id: state?.productId || "",
                        product_slug: state?.productSlug || "",
                        uploaded_file: uploadedFile?.path || "",
                        source_site_id: state?.sourceSiteId || "",
                        source_site_upload_name: state?.siteUpload?.name || "",
                        shipping_method_id: selectedDeliveryId || "",
                        shipping_cost: shippingCost,
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

    const handlePaymentSuccess = (paymentIntentId: string) => {
        setPaymentSuccess(true);
        setShowPaymentModal(false);
        toast.success("Din ordre er modtaget! Vi sender en bekræftelse på email.");
        // TODO: Create order record in database
        console.log("Payment successful:", paymentIntentId);
    };

    const handlePaymentCancel = () => {
        setShowPaymentModal(false);
        setPaymentClientSecret(null);
    };

    // Resolve specs in this order:
    // 1) explicit design dimensions from ProductPrice (most accurate)
    // 2) known standard format lookup
    // 3) product technical specs fallback
    const getResolvedSpecs = (): TechnicalSpecs | null => {
        const bleedDefault = 3;
        const designWidthMm = toNumberOrNull(state?.designWidthMm);
        const designHeightMm = toNumberOrNull(state?.designHeightMm);
        const designBleedMm = toNumberOrNull(state?.designBleedMm);
        const productBleedMm = toNumberOrNull(product?.technical_specs?.bleed_mm);

        if (designWidthMm && designWidthMm > 0 && designHeightMm && designHeightMm > 0) {
            return {
                width_mm: designWidthMm,
                height_mm: designHeightMm,
                bleed_mm: designBleedMm !== null && designBleedMm >= 0
                    ? designBleedMm
                    : (productBleedMm !== null && productBleedMm >= 0 ? productBleedMm : bleedDefault),
                min_dpi: getSizeBasedMinDpi(designWidthMm, designHeightMm),
            };
        }

        if (state?.selectedFormat && STANDARD_SPECS[state.selectedFormat]) {
            const std = STANDARD_SPECS[state.selectedFormat];
            return {
                ...std,
                bleed_mm: bleedDefault,
                min_dpi: getSizeBasedMinDpi(std.width_mm, std.height_mm),
            };
        }

        if (product?.technical_specs) {
            const widthMm = toNumberOrNull(product.technical_specs.width_mm);
            const heightMm = toNumberOrNull(product.technical_specs.height_mm);
            if (widthMm && widthMm > 0 && heightMm && heightMm > 0) {
                return {
                    width_mm: widthMm,
                    height_mm: heightMm,
                    bleed_mm: productBleedMm !== null && productBleedMm >= 0 ? productBleedMm : bleedDefault,
                    min_dpi: getSizeBasedMinDpi(widthMm, heightMm),
                };
            }
        }

        return null;
    };

    useEffect(() => {
        const siteUpload = state?.siteUpload;
        if (!siteUpload || uploadedFile || preflightResults) return;

        const widthPx = Math.max(1, Math.round(toNumberOrNull(siteUpload.widthPx) || 0));
        const heightPx = Math.max(1, Math.round(toNumberOrNull(siteUpload.heightPx) || 0));
        const previewDataUrl = typeof siteUpload.previewDataUrl === "string" ? siteUpload.previewDataUrl : null;
        const sourceDpi = toNumberOrNull(siteUpload.estimatedDpi);
        const specs = getResolvedSpecs();
        const requiredDpi = specs?.min_dpi || 150;
        const fallbackFileWidthMm = toNumberOrNull(state?.designWidthMm) || specs?.width_mm || 0;
        const fallbackFileHeightMm = toNumberOrNull(state?.designHeightMm) || specs?.height_mm || 0;
        const fileWidthMm = sourceDpi
            ? (widthPx / sourceDpi) * MM_PER_INCH
            : fallbackFileWidthMm;
        const fileHeightMm = sourceDpi
            ? (heightPx / sourceDpi) * MM_PER_INCH
            : fallbackFileHeightMm;
        const targetWidthMm = specs?.width_mm || fallbackFileWidthMm;
        const targetHeightMm = specs?.height_mm || fallbackFileHeightMm;
        const aspectRatioDiff = targetWidthMm > 0 && targetHeightMm > 0 && fileWidthMm > 0 && fileHeightMm > 0
            ? Math.abs((fileWidthMm / fileHeightMm) - (targetWidthMm / targetHeightMm))
            : 0;

        const warnings: string[] = [];
        if (!sourceDpi) {
            warnings.push("DPI kunne ikke fastlaes automatisk fra site-preview filen.");
        } else if (sourceDpi < requiredDpi) {
            warnings.push(`Filen er ca. ${Math.round(sourceDpi)} DPI. Anbefalet minimum er ${requiredDpi} DPI.`);
        }

        if (aspectRatioDiff > ASPECT_RATIO_TOLERANCE) {
            warnings.push("Filens proportioner matcher ikke helt den valgte bannerstørrelse.");
        }

        const fileName = (siteUpload.name || "site-preview-upload").toString();
        if (previewDataUrl) {
            setUploadedFile({
                name: fileName,
                url: previewDataUrl,
                path: "",
            });
            setPreview(previewDataUrl, "image");
        }

        setPreflightResults({
            fileType: "image",
            dpi: sourceDpi || undefined,
            width_px: widthPx || undefined,
            height_px: heightPx || undefined,
            file_width_mm: fileWidthMm || undefined,
            file_height_mm: fileHeightMm || undefined,
            target_width_mm: targetWidthMm || undefined,
            target_height_mm: targetHeightMm || undefined,
            required_dpi: requiredDpi,
            source_dpi: sourceDpi || undefined,
            aspectRatioMatch: aspectRatioDiff <= ASPECT_RATIO_TOLERANCE,
            sizeMatch: true,
            dpiOk: sourceDpi ? sourceDpi >= requiredDpi : true,
            issues: [],
            warnings,
        });
    }, [state, uploadedFile, preflightResults, product]);

    const isPodProduct = Boolean(product?.technical_specs?.is_pod || product?.technical_specs?.is_pod_v2);
    const podPreflightEnabled = Boolean(product?.technical_specs?.pod_preflight_enabled);
    const podPreflightAutoFix = (product?.technical_specs as any)?.pod_preflight_auto_fix ?? true;
    const platformPreflightBlocking = isPodProduct
        && podPreflightEnabled
        && (platformPreflightLoading
            || platformPreflight?.status === "PROCESSING"
            || platformPreflight?.status === "FAILED"
            || (platformPreflight?.errors?.length ?? 0) > 0);

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

                    // Fetch Matrix for Upsell logic (wrapped in try/catch to not block the main product load)
                    try {
                        let matrixData: any = null;
                        const slug = (state.productSlug || productData.slug)?.toLowerCase();
                        const format = state.selectedFormat || "A4";

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
        if (!product) return;
        const rawMethods = (product as any)?.banner_config?.order_delivery?.delivery?.methods;
        const configuredMethods = normalizeDeliveryMethods(rawMethods);
        const nextMethods = configuredMethods.length > 0 ? configuredMethods : DEFAULT_CHECKOUT_DELIVERY_METHODS;
        setDeliveryMethods(nextMethods);

        const stateSelectedId =
            typeof state?.shippingSelected === "string" && state.shippingSelected.trim()
                ? state.shippingSelected.trim()
                : null;
        const fallbackId = nextMethods[0]?.id || null;
        const nextSelectedId =
            stateSelectedId && nextMethods.some((method) => method.id === stateSelectedId)
                ? stateSelectedId
                : fallbackId;
        setSelectedDeliveryId(nextSelectedId);

        const stateShippingCost = toNumberOrNull(state?.shippingCost);
        const selectedMethod = nextMethods.find((method) => method.id === nextSelectedId) || null;
        if (stateShippingCost !== null && stateSelectedId && stateSelectedId === nextSelectedId) {
            setShippingCost(stateShippingCost);
        } else {
            setShippingCost(resolveDeliveryMethodCost(orderPrice, selectedMethod));
        }
    }, [product, state?.shippingSelected, state?.shippingCost, orderPrice]);

    useEffect(() => {
        if (!selectedDeliveryId || deliveryMethods.length === 0) return;
        const selectedMethod = deliveryMethods.find((method) => method.id === selectedDeliveryId);
        if (!selectedMethod) return;
        setShippingCost(resolveDeliveryMethodCost(orderPrice, selectedMethod));
    }, [selectedDeliveryId, deliveryMethods, orderPrice]);

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

    const isSupportedUploadFile = (file: File) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (allowedTypes.includes(file.type)) return true;
        const lowerName = file.name.toLowerCase();
        return (
            lowerName.endsWith('.pdf') ||
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg') ||
            lowerName.endsWith('.png') ||
            lowerName.endsWith('.tif') ||
            lowerName.endsWith('.tiff')
        );
    };

    const processSelectedFile = async (file: File) => {
        if (!isSupportedUploadFile(file)) {
            toast.error("Venligst upload en PDF eller et billede (JPG, PNG, TIFF)");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setPreflightResults(null);
        setPlatformPreflight(null);
        setSoftProofEnabled(false);
        setPreviewFitToTarget(false);
        clearPreview();

        try {
            const fileExt = file.name.split('.').pop();
            const productRef = state.productId || state.productSlug || 'unknown';
            const fileName = `${productRef}-order-${Date.now()}.${fileExt}`;
            const filePath = `order-files/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('order-files')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('order-files')
                .getPublicUrl(filePath);

            setUploadedFile({ name: file.name, url: publicUrl, path: filePath });
            if (file.type.startsWith('image/')) {
                const objectUrl = URL.createObjectURL(file);
                setPreview(objectUrl, "image", true);
            }

            await runPreflight(file, { filePath, publicUrl });
            toast.success("Fil uploadet og tjekket");
        } catch (err) {
            console.error("Error uploading file:", err);
            toast.error("Kunne ikke uploade fil");
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processSelectedFile(file);
        event.target.value = "";
    };

    const handleDropZoneDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDropZoneActive) setIsDropZoneActive(true);
    };

    const handleDropZoneDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        setIsDropZoneActive(false);
    };

    const handleDropZoneDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDropZoneActive(false);

        const getFileFromDrop = async (): Promise<File | null> => {
            if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                return event.dataTransfer.files[0];
            }

            const uriList = event.dataTransfer.getData('text/uri-list');
            const textPlain = event.dataTransfer.getData('text/plain');
            const htmlData = event.dataTransfer.getData('text/html');
            const directUrl = (uriList || textPlain || "").trim();

            let candidateUrl = directUrl;
            if (!candidateUrl && htmlData) {
                const srcMatch = htmlData.match(/src=["']([^"']+)["']/i);
                if (srcMatch?.[1]) {
                    candidateUrl = srcMatch[1];
                }
            }

            if (!candidateUrl || !/^https?:\/\//i.test(candidateUrl)) {
                return null;
            }

            try {
                const response = await fetch(candidateUrl);
                if (!response.ok) return null;
                const blob = await response.blob();
                const contentType = blob.type || "";
                const extFromMime = contentType.includes("pdf")
                    ? "pdf"
                    : contentType.includes("jpeg")
                        ? "jpg"
                        : contentType.includes("png")
                            ? "png"
                            : contentType.includes("tiff")
                                ? "tiff"
                                : "";
                const urlName = candidateUrl.split("/").pop()?.split("?")[0] || "";
                const baseName = urlName || `dropped-image.${extFromMime || "bin"}`;
                const fileName = /\.[a-z0-9]+$/i.test(baseName)
                    ? baseName
                    : `${baseName}.${extFromMime || "bin"}`;
                return new File([blob], fileName, { type: contentType || undefined });
            } catch (error) {
                console.error("Could not fetch dropped URL:", error);
                return null;
            }
        };

        const file = await getFileFromDrop();
        if (!file) {
            toast.error("Kunne ikke læse den droppede fil. Prøv at trække en lokal fil fra din computer.");
            return;
        }
        await processSelectedFile(file);
    };

    const runPreflight = async (file: File, uploadInfo?: { filePath: string; publicUrl: string }) => {
        const specs = getResolvedSpecs();
        if (!specs) return;

        const issues: string[] = [];
        const warnings: string[] = [];
        let dpi = 0;
        let width_px = 0;
        let height_px = 0;
        let fileWidthMm = 0;
        let fileHeightMm = 0;
        let sourceDpi: number | undefined;
        let aspectRatioMatch = true;
        let sizeMatch = true;
        let dpiOk = true;
        const targetWidthMm = specs.width_mm + (specs.bleed_mm * 2);
        const targetHeightMm = specs.height_mm + (specs.bleed_mm * 2);
        const requiredDpi = specs.min_dpi;

        const ratioDelta = (aWidth: number, aHeight: number, bWidth: number, bHeight: number): number => {
            const ratioA = aWidth / aHeight;
            const ratioB = bWidth / bHeight;
            return Math.abs(ratioA - ratioB);
        };

        const isSizeMatch = (aWidthMm: number, aHeightMm: number, bWidthMm: number, bHeightMm: number, toleranceMm = SIZE_TOLERANCE_MM): boolean => {
            const directMatch = Math.abs(aWidthMm - bWidthMm) <= toleranceMm && Math.abs(aHeightMm - bHeightMm) <= toleranceMm;
            const rotatedMatch = Math.abs(aHeightMm - bWidthMm) <= toleranceMm && Math.abs(aWidthMm - bHeightMm) <= toleranceMm;
            return directMatch || rotatedMatch;
        };

        if (file.type.startsWith('image/')) {
            try {
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);
                img.src = objectUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                URL.revokeObjectURL(objectUrl);

                width_px = img.width;
                height_px = img.height;
                const extractedDpi = await getImageDpi(file);
                sourceDpi = extractedDpi && extractedDpi > 0 ? extractedDpi : 72;
                if (!extractedDpi) {
                    warnings.push("Billedet har ingen indlejret DPI metadata. Forhåndsvisning bruger 72 DPI som antagelse.");
                }

                const dpiW = width_px / (targetWidthMm / 25.4);
                const dpiH = height_px / (targetHeightMm / 25.4);
                dpi = Math.min(dpiW, dpiH);
                fileWidthMm = (width_px / sourceDpi) * MM_PER_INCH;
                fileHeightMm = (height_px / sourceDpi) * MM_PER_INCH;

                if (dpi < requiredDpi) {
                    dpiOk = false;
                    issues.push(`Opløsningen er for lav: ${Math.round(dpi)} DPI (minimum ${requiredDpi} DPI for dette format).`);
                }

                const directRatioDelta = ratioDelta(width_px, height_px, targetWidthMm, targetHeightMm);
                const rotatedRatioDelta = ratioDelta(width_px, height_px, targetHeightMm, targetWidthMm);
                aspectRatioMatch = Math.min(directRatioDelta, rotatedRatioDelta) <= ASPECT_RATIO_TOLERANCE;
                if (!aspectRatioMatch) {
                    aspectRatioMatch = false;
                    issues.push("Størrelsesforholdet matcher ikke produktet. Filen kan blive beskåret uhensigtsmæssigt.");
                }

                const requiredWidthPx = (targetWidthMm / MM_PER_INCH) * requiredDpi;
                const requiredHeightPx = (targetHeightMm / MM_PER_INCH) * requiredDpi;
                const directFit = width_px >= requiredWidthPx && height_px >= requiredHeightPx;
                const rotatedFit = width_px >= requiredHeightPx && height_px >= requiredWidthPx;
                sizeMatch = directFit || rotatedFit;
                if (!sizeMatch) {
                    issues.push(
                        `Dokumentet er fysisk for lille: kræver mindst ${Math.round(requiredWidthPx)} x ${Math.round(requiredHeightPx)} px ved ${requiredDpi} DPI.`
                    );
                }
            } catch (imgErr) {
                console.error("Image browser preflight failed:", imgErr);
                dpiOk = false;
                sizeMatch = false;
                aspectRatioMatch = false;
                issues.push("Kunne ikke læse billedfilens dimensioner i browseren.");
            }
        } else if (file.type === 'application/pdf') {
            try {
                const pdfjs = await import("pdfjs-dist");
                pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
                const buffer = await file.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: buffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1 });

                fileWidthMm = ptToMm(viewport.width);
                fileHeightMm = ptToMm(viewport.height);

                const directRatioDelta = ratioDelta(fileWidthMm, fileHeightMm, targetWidthMm, targetHeightMm);
                const rotatedRatioDelta = ratioDelta(fileWidthMm, fileHeightMm, targetHeightMm, targetWidthMm);
                aspectRatioMatch = Math.min(directRatioDelta, rotatedRatioDelta) <= ASPECT_RATIO_TOLERANCE;
                sizeMatch = isSizeMatch(fileWidthMm, fileHeightMm, targetWidthMm, targetHeightMm);

                if (!aspectRatioMatch) {
                    issues.push("PDF-sidens forhold matcher ikke produktformatet.");
                }
                if (!sizeMatch) {
                    issues.push(
                        `PDF-størrelse matcher ikke formatet: ${fileWidthMm.toFixed(1)} x ${fileHeightMm.toFixed(1)} mm mod forventet ${targetWidthMm.toFixed(1)} x ${targetHeightMm.toFixed(1)} mm.`
                    );
                }

                const previewScale = Math.min(1.5, PDF_PREVIEW_MAX_PX / Math.max(viewport.width, viewport.height));
                const previewViewport = page.getViewport({ scale: previewScale });
                const previewCanvas = document.createElement("canvas");
                previewCanvas.width = Math.round(previewViewport.width);
                previewCanvas.height = Math.round(previewViewport.height);
                const previewCtx = previewCanvas.getContext("2d");
                if (previewCtx) {
                    previewCtx.fillStyle = "#ffffff";
                    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    await page.render({
                        canvasContext: previewCtx,
                        viewport: previewViewport,
                    }).promise;
                    setPreview(previewCanvas.toDataURL("image/png"), "pdf");
                }
            } catch (pdfErr) {
                console.error("PDF browser preflight failed:", pdfErr);
                issues.push("Kunne ikke læse PDF i browseren. Upload en ny fil eller fortsæt med platform preflight.");
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
                warnings.push("PDF indhold (interne billeder/fonts) valideres bedst i platform preflight.");
            }
        }

        setPreflightResults({
            fileType: file.type.startsWith("image/") ? "image" : "pdf",
            dpi: dpi > 0 ? Math.round(dpi) : undefined,
            width_px,
            height_px,
            file_width_mm: fileWidthMm || undefined,
            file_height_mm: fileHeightMm || undefined,
            target_width_mm: targetWidthMm,
            target_height_mm: targetHeightMm,
            required_dpi: requiredDpi,
            source_dpi: sourceDpi,
            aspectRatioMatch,
            sizeMatch,
            dpiOk,
            issues,
            warnings,
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

    const specs = getResolvedSpecs();
    const targetWidth = specs ? specs.width_mm + (specs.bleed_mm * 2) : 0;
    const targetHeight = specs ? specs.height_mm + (specs.bleed_mm * 2) : 0;
    const previewMaxLongSidePx = 420;
    const previewPaddingPx = 64;
    const previewScalePxPerMm = targetWidth > 0 && targetHeight > 0
        ? Math.min(previewMaxLongSidePx / Math.max(targetWidth, targetHeight), 1)
        : 1;
    const previewTargetWidthPx = Math.max(1, targetWidth * previewScalePxPerMm);
    const previewTargetHeightPx = Math.max(1, targetHeight * previewScalePxPerMm);
    const previewFileWidthMm = preflightResults?.file_width_mm ?? targetWidth;
    const previewFileHeightMm = preflightResults?.file_height_mm ?? targetHeight;
    const previewImageBaseWidthPx = Math.max(1, previewFileWidthMm * previewScalePxPerMm);
    const previewImageBaseHeightPx = Math.max(1, previewFileHeightMm * previewScalePxPerMm);
    const fitScale = previewImageBaseWidthPx > 0 && previewImageBaseHeightPx > 0
        ? Math.min(previewTargetWidthPx / previewImageBaseWidthPx, previewTargetHeightPx / previewImageBaseHeightPx)
        : 1;
    const previewImageScale = previewFitToTarget ? Math.max(0.01, Math.min(fitScale, 10)) : 1;
    const previewImageWidthPx = previewImageBaseWidthPx * previewImageScale;
    const previewImageHeightPx = previewImageBaseHeightPx * previewImageScale;
    const previewTrimInsetPx = specs ? specs.bleed_mm * previewScalePxPerMm : 0;
    const previewStageWidthPx = previewTargetWidthPx + previewPaddingPx * 2;
    const previewStageHeightPx = previewTargetHeightPx + previewPaddingPx * 2;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-12" style={pageBackgroundStyle}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-heading font-bold">Konfigurer dit design</h1>
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleBackToConfiguration}
                                className="px-3 py-1 bg-white rounded-full h-auto text-xs font-semibold"
                            >
                                1. Bestilling
                            </Button>
                            <Badge className="px-3 py-1">2. Fil-tjek</Badge>
                            <Badge variant="outline" className="px-3 py-1 bg-white opacity-50">3. Betaling</Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="overflow-hidden border-2 border-primary/10 shadow-lg">
                                <CardHeader className="bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Upload dit trykklare design</CardTitle>
                                            <CardDescription>Upload din PDF eller billedfil i høj opløsning</CardDescription>
                                        </div>
                                        <FileText className="h-8 w-8 text-primary opacity-20" />
                                    </div>
                                </CardHeader>
                                <CardContent
                                    className={`pt-6 space-y-6 transition-colors ${isDropZoneActive ? "bg-primary/5" : ""}`}
                                    onDragOver={handleDropZoneDragOver}
                                    onDragEnter={handleDropZoneDragOver}
                                    onDragLeave={handleDropZoneDragLeave}
                                    onDrop={handleDropZoneDrop}
                                >
                                    {!uploadedFile ? (
                                        <div
                                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group ${isDropZoneActive
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-primary/20 hover:bg-primary/5'
                                                }`}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleDropZoneDragOver}
                                            onDragEnter={handleDropZoneDragOver}
                                            onDragLeave={handleDropZoneDragLeave}
                                            onDrop={handleDropZoneDrop}
                                        >
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                    <Upload className="h-8 w-8 text-primary" />
                                                </div>
                                                <h3 className="text-lg font-semibold mb-2">Klik eller træk fil hertil</h3>
                                                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
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
                                            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                                    <div>
                                                        <p className="font-semibold text-green-900">{uploadedFile.name}</p>
                                                        <p className="text-xs text-green-700">Filen er klar til tjek</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={clearUploadedFileState}>Skift fil</Button>
                                            </div>

                                            {previewUrl && (
                                                <div className="relative border rounded-lg overflow-hidden bg-white shadow-inner p-4 md:p-6">
                                                    <div
                                                        className="relative mx-auto rounded-md border border-slate-200 bg-slate-50/70 overflow-hidden"
                                                        style={{
                                                            width: `${previewStageWidthPx}px`,
                                                            maxWidth: "100%",
                                                            height: `${previewStageHeightPx}px`,
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute bg-white border-2 border-slate-300 shadow-md"
                                                            style={{
                                                                width: `${previewTargetWidthPx}px`,
                                                                height: `${previewTargetHeightPx}px`,
                                                                left: "50%",
                                                                top: "50%",
                                                                transform: "translate(-50%, -50%)",
                                                            }}
                                                        />
                                                        <img
                                                            src={previewUrl}
                                                            alt="Preview"
                                                            className="absolute object-contain shadow-2xl"
                                                            style={{
                                                                width: `${previewImageWidthPx}px`,
                                                                height: `${previewImageHeightPx}px`,
                                                                left: "50%",
                                                                top: "50%",
                                                                transform: "translate(-50%, -50%)",
                                                                filter: softProofEnabled
                                                                    ? "saturate(0.88) contrast(0.96) brightness(0.98)"
                                                                    : "none",
                                                            }}
                                                        />
                                                        {specs && (
                                                            <div
                                                                className="absolute border-2 border-red-500 border-dashed pointer-events-none opacity-90"
                                                                style={{
                                                                    width: `${Math.max(1, previewTargetWidthPx - (previewTrimInsetPx * 2))}px`,
                                                                    height: `${Math.max(1, previewTargetHeightPx - (previewTrimInsetPx * 2))}px`,
                                                                    left: "50%",
                                                                    top: "50%",
                                                                    transform: "translate(-50%, -50%)",
                                                                }}
                                                            >
                                                                <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-2 py-0.5 font-bold rounded shadow-sm whitespace-nowrap z-10">
                                                                    BESKÆRINGSLINJE ({specs.bleed_mm}mm)
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute top-2 right-2 flex flex-wrap items-center justify-end gap-2">
                                                        <Badge className="bg-white/90 text-primary border-primary/20 backdrop-blur-sm">
                                                            {previewType === "pdf" ? "PDF Preview (side 1)" : "Visuel Preview"}
                                                        </Badge>
                                                        <div className="bg-white/90 border border-primary/20 rounded-md px-2 py-1 flex items-center gap-2 backdrop-blur-sm">
                                                            <Label htmlFor="preflight-soft-proof" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                                                Soft proof
                                                            </Label>
                                                            <Switch
                                                                id="preflight-soft-proof"
                                                                checked={softProofEnabled}
                                                                onCheckedChange={setSoftProofEnabled}
                                                            />
                                                        </div>
                                                        <div className="bg-white/90 border border-primary/20 rounded-md px-2 py-1 flex items-center gap-2 backdrop-blur-sm">
                                                            <Label htmlFor="preflight-fit-target" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                                                Fit til format
                                                            </Label>
                                                            <Switch
                                                                id="preflight-fit-target"
                                                                checked={previewFitToTarget}
                                                                onCheckedChange={setPreviewFitToTarget}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="absolute left-2 bottom-2 bg-white/90 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700">
                                                        1:1 fysisk visning: {previewFileWidthMm.toFixed(1)} x {previewFileHeightMm.toFixed(1)} mm
                                                    </div>
                                                </div>
                                            )}

                                            {preflightResults && (
                                                <div className={`p-6 rounded-xl border-2 ${preflightResults.issues.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        {preflightResults.issues.length === 0 ? (
                                                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                                                        ) : (
                                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                                        )}
                                                        <h3 className="font-bold text-lg">
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

                                                    {preflightResults.warnings.length > 0 && (
                                                        <ul className="space-y-2 mb-4">
                                                            {preflightResults.warnings.map((warning, idx) => (
                                                                <li key={`warn-${idx}`} className="flex gap-2 text-sm text-blue-900">
                                                                    <span className="shrink-0">•</span>
                                                                    <span>{warning}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                                        <div className="bg-white/50 p-3 rounded-lg border border-black/5">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Opløsning</p>
                                                            <p className={`text-xl font-bold ${preflightResults.dpiOk ? 'text-green-600' : 'text-amber-600'}`}>
                                                                {preflightResults.fileType === "image"
                                                                    ? `${preflightResults.dpi || 0} DPI`
                                                                    : 'PDF (format tjekket)'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">Krav: {preflightResults.required_dpi} DPI</p>
                                                            {preflightResults.fileType === "image" && preflightResults.source_dpi && (
                                                                <p className="text-xs text-slate-500 mt-1">Kilde-DPI: {preflightResults.source_dpi}</p>
                                                            )}
                                                        </div>
                                                        <div className="bg-white/50 p-3 rounded-lg border border-black/5">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Target Størrelse</p>
                                                            <p className="text-xl font-bold text-slate-700">
                                                                {targetWidth.toFixed(1)} x {targetHeight.toFixed(1)} mm
                                                            </p>
                                                        </div>
                                                        <div className="bg-white/50 p-3 rounded-lg border border-black/5">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Filstørrelse</p>
                                                            <p className="text-xl font-bold text-slate-700">
                                                                {preflightResults.file_width_mm && preflightResults.file_height_mm
                                                                    ? `${preflightResults.file_width_mm.toFixed(1)} x ${preflightResults.file_height_mm.toFixed(1)} mm`
                                                                    : preflightResults.width_px && preflightResults.height_px
                                                                        ? `${preflightResults.width_px} x ${preflightResults.height_px} px`
                                                                        : 'Ukendt'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {preflightResults.issues.length > 0 && (
                                                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                                            <Button variant="outline" className="flex-1 bg-white" onClick={() => fileInputRef.current?.click()}>
                                                                Upload ny fil
                                                            </Button>
                                                            <Button className="flex-1">
                                                                Fortsæt alligevel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {(platformPreflightLoading || platformPreflight) && (
                                                <div className={`p-6 rounded-xl border-2 ${platformPreflight?.status === 'FAILED' || (platformPreflight?.errors?.length ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
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
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Info className="h-5 w-5 text-primary" />
                                        Tekniske Specifikationer
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <h4 className="font-semibold mb-2">Mål for {state.productName} ({state.selectedFormat})</h4>
                                            <ul className="text-sm space-y-1 text-muted-foreground">
                                                <li>Nettoformat: {specs?.width_mm} x {specs?.height_mm} mm</li>
                                                <li>Bruttoformat (+beskæring): {targetWidth} x {targetHeight} mm</li>
                                                <li>Beskæring (Bleed): {specs?.bleed_mm} mm på alle sider</li>
                                                <li>Minimum opløsning: {specs?.min_dpi} DPI ({specs ? (isAtMostA3(specs.width_mm, specs.height_mm) ? "A3 eller mindre" : "over A3") : "format ikke valgt"})</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <h4 className="font-semibold mb-2">Download skabeloner</h4>
                                            <div className="space-y-2">
                                                {product?.template_files?.map((template: TemplateFile, idx: number) => (
                                                    <a
                                                        key={idx}
                                                        href={template.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        {template.name} ({template.format || 'Standard'})
                                                    </a>
                                                ))}
                                                {(!product?.template_files || product.template_files.length === 0) && (
                                                    <p className="text-sm text-muted-foreground italic">Ingen skabeloner tilgængelige lige nu.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Best Deal Upgrades - Redesigned & Moved up */}
                            {upsellOptions.length > 0 && (
                                <div className="bg-white/80 backdrop-blur-md border border-primary/20 rounded-2xl p-6 shadow-sm overflow-hidden relative group transition-all hover:shadow-md">
                                    <div className="flex flex-col lg:flex-row gap-8 items-center">
                                        <div className="flex-none lg:max-w-[200px]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                </div>
                                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">SPAR MERE</Badge>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-1">Få mere værdi</h3>
                                            <p className="text-sm text-slate-600 leading-relaxed">Vi har fundet bedre priser ved at købe større ind.</p>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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

                        <div className="space-y-6">
                            <Card className="shadow-lg border-2 border-primary/5">
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
                                            {state.optionSelections && Object.values(state.optionSelections).map((opt: any, idx: number) => (
                                                <p key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                                                    {opt.name}
                                                </p>
                                            ))}
                                        </div>
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
                                            <span className="text-muted-foreground">Levering:</span>
                                            <span className="font-medium">{shippingCost} kr</span>
                                        </div>
                                    </div>

                                    {deliveryMethods.length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-black/5">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Leveringsmetode
                                            </p>
                                            <div className="space-y-2">
                                                {deliveryMethods.map((method) => {
                                                    const isSelected = selectedDeliveryId === method.id;
                                                    const methodCost = resolveDeliveryMethodCost(orderPrice, method);
                                                    const methodMeta = formatDeliveryMetaText(method, deliveryNow);
                                                    return (
                                                        <button
                                                            key={method.id}
                                                            type="button"
                                                            onClick={() => setSelectedDeliveryId(method.id)}
                                                            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                                                isSelected
                                                                    ? "border-primary bg-primary/5"
                                                                    : "border-slate-200 hover:border-primary/40 hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-medium">{method.name}</span>
                                                                <span className="text-sm font-semibold">{methodCost} kr</span>
                                                            </div>
                                                            {method.description && (
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {method.description}
                                                                </p>
                                                            )}
                                                            {methodMeta && (
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {methodMeta}
                                                                </p>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t-2 border-primary/10 flex justify-between items-end">
                                        <span className="font-bold">Total (ex. moms):</span>
                                        <span className="text-2xl font-bold text-primary">{orderPrice + shippingCost} kr</span>
                                    </div>

                                    {paymentStatusLoaded &&
                                        !shopSettings.data?.is_platform_owned &&
                                        (!tenantPaymentStatus ||
                                            !tenantPaymentStatus.stripe_account_id ||
                                            !tenantPaymentStatus.charges_enabled ||
                                            tenantPaymentStatus.status === "disabled") && (
                                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
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
                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <p className="font-medium">Print.com preflight mangler</p>
                                                <p className="text-xs text-red-700">
                                                    Filen skal godkendes eller fixes før betaling kan fortsætte.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full h-12 text-lg font-bold mt-4 group shadow-md"
                                        onClick={handleProceedToPayment}
                                        disabled={!uploadedFile || paymentLoading || platformPreflightBlocking}
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
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

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
                            amount={orderPrice + shippingCost}
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
