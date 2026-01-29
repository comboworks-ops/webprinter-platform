import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopSettings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, AlertCircle, CheckCircle2, FileText, ArrowRight, Download, Info, Zap, Sparkles, Package, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { PreflightGuide } from "@/components/product-price-page/PreflightGuide";
import { StripePaymentForm } from "@/components/checkout/StripePaymentForm";
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

const FileUploadConfiguration = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location;
    const shopSettings = useShopSettings();

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

    // Local Order Configuration (to allow for Best Deal upgrades)
    const [orderQuantity, setOrderQuantity] = useState<number>(state?.quantity || 0);
    const [orderPrice, setOrderPrice] = useState<number>(state?.totalPrice || 0);
    const [matrix, setMatrix] = useState<{ rows: string[], columns: number[], cells: any } | null>(null);
    const [upsellOptions, setUpsellOptions] = useState<{ quantity: number, price: number, savingPercent: number }[]>([]);

    // Stripe payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
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
            const totalPrice = orderPrice + (state?.shippingCost || 0);
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
                    },
                },
            });

            if (error) throw error;

            if (data?.client_secret) {
                setPaymentClientSecret(data.client_secret);
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

    // Resolve specs: prefer standard lookup if state.selectedFormat exists, otherwise use product metadata
    const getResolvedSpecs = (): TechnicalSpecs | null => {
        const bleedDefault = 3;
        if (state?.selectedFormat && STANDARD_SPECS[state.selectedFormat]) {
            const std = STANDARD_SPECS[state.selectedFormat];
            return { ...std, bleed_mm: bleedDefault };
        }
        if (product?.technical_specs) {
            return product.technical_specs as TechnicalSpecs;
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
                    .select("id, slug, name, description, image_url, technical_specs");

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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
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
            setPreviewUrl(URL.createObjectURL(file));

            await runPreflight(file, { filePath, publicUrl });

            toast.success("Fil uploadet og tjekket");
        } catch (err) {
            console.error("Error uploading file:", err);
            toast.error("Kunne ikke uploade fil");
        } finally {
            setUploading(false);
        }
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

    const specs = getResolvedSpecs();
    const targetWidth = specs ? specs.width_mm + (specs.bleed_mm * 2) : 0;
    const targetHeight = specs ? specs.height_mm + (specs.bleed_mm * 2) : 0;

    const bleedXPercent = specs ? (specs.bleed_mm / targetWidth) * 100 : 0;
    const bleedYPercent = specs ? (specs.bleed_mm / targetHeight) * 100 : 0;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-12">
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
                                <CardContent className="pt-6 space-y-6">
                                    {!uploadedFile ? (
                                        <div
                                            className="border-2 border-dashed border-primary/20 rounded-xl p-12 text-center hover:bg-primary/5 transition-all cursor-pointer group"
                                            onClick={() => fileInputRef.current?.click()}
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
                                                <Button variant="ghost" size="sm" onClick={() => setUploadedFile(null)}>Skift fil</Button>
                                            </div>

                                            {previewUrl && (
                                                <div className="relative aspect-auto max-h-[500px] border rounded-lg overflow-hidden bg-white shadow-inner flex items-center justify-center p-8">
                                                    <div className="relative">
                                                        <img
                                                            src={previewUrl}
                                                            alt="Preview"
                                                            className="max-w-full max-h-[400px] object-contain shadow-2xl"
                                                        />
                                                        {specs && (
                                                            <div
                                                                className="absolute border-2 border-red-500 border-dashed pointer-events-none opacity-80"
                                                                style={{
                                                                    top: `${bleedYPercent}%`,
                                                                    bottom: `${bleedYPercent}%`,
                                                                    left: `${bleedXPercent}%`,
                                                                    right: `${bleedXPercent}%`,
                                                                }}
                                                            >
                                                                <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-2 py-0.5 font-bold rounded shadow-sm whitespace-nowrap">
                                                                    BESKÆRINGSLINJE (3mm)
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute top-2 right-2 flex gap-2">
                                                        <Badge className="bg-white/90 text-primary border-primary/20 backdrop-blur-sm">Visuel Preview</Badge>
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

                                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                                        <div className="bg-white/50 p-3 rounded-lg border border-black/5">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Opløsning</p>
                                                            <p className={`text-xl font-bold ${preflightResults.dpiOk ? 'text-green-600' : 'text-amber-600'}`}>
                                                                {preflightResults.dpi ? `${preflightResults.dpi} DPI` : 'PDF (Tjekkes manuelt)'}
                                                            </p>
                                                        </div>
                                                        <div className="bg-white/50 p-3 rounded-lg border border-black/5">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Target Størrelse</p>
                                                            <p className="text-xl font-bold text-slate-700">
                                                                {targetWidth} x {targetHeight} mm
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
                                                <li>Minimum opløsning: {specs?.min_dpi} DPI</li>
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
                            {specs && (
                                <PreflightGuide
                                    width={specs.width_mm}
                                    height={specs.height_mm}
                                    bleed={specs.bleed_mm}
                                    minDpi={specs.min_dpi}
                                />
                            )}
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
                                            <span className="font-medium">{state.shippingCost} kr</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-primary/10 flex justify-between items-end">
                                        <span className="font-bold">Total (ex. moms):</span>
                                        <span className="text-2xl font-bold text-primary">{orderPrice + (state?.shippingCost || 0)} kr</span>
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
                            amount={orderPrice + (state?.shippingCost || 0)}
                            currency="dkk"
                            onSuccess={handlePaymentSuccess}
                            onCancel={handlePaymentCancel}
                            connectedAccountId={tenantPaymentStatus?.stripe_account_id}
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
