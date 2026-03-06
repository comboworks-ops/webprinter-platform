/**
 * Featured Product Quick Configurator
 *
 * Frontpage-only highlighted product block with:
 * - live matrix price lookup based on active option selections
 * - quantity presets
 * - optional picture-based option buttons
 * - optional side banner or side product
 *
 * This component is additive. It reads existing product/price data and
 * never mutates pricing logic or product schemas.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getProductImage } from "@/utils/productImages";
import { getGenericMatrixDataFromDB } from "@/utils/pricingDatabase";
import { getProductDisplayPrice } from "@/utils/productPriceDisplay";
import {
    calculateStorformatPrice,
    type StorformatConfig,
    type StorformatMaterial,
} from "@/utils/storformatPricing";
import { cn } from "@/lib/utils";
import type { FeaturedProductConfig, HeroTextAnimation } from "@/hooks/useBrandingDraft";

interface FeaturedProductConfiguratorProps {
    config: FeaturedProductConfig;
    branding: any;
    className?: string;
}

interface ProductData {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    pricing_type?: string | null;
    default_variant?: string | null;
    default_quantity?: number | null;
    banner_config?: any;
}

interface OptionGroup {
    id: string;
    name: string;
    label: string;
    display_type: string;
    kind?: string | null;
}

interface ProductOption {
    id: string;
    group_id: string;
    name: string;
    label: string;
    extra_price: number;
    price_mode: "fixed" | "per_quantity" | "per_area";
    icon_url: string | null;
}

interface MatrixData {
    rows: string[];
    columns: number[];
    cells: Record<string, Record<number, number>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_RE.test(value);
}

function normalizeLabel(value: string | null | undefined): string {
    return (value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function getBannerTextAnimationClass(animation: HeroTextAnimation | string | undefined): string {
    switch (animation) {
        case "fade":
            return "animate-in fade-in duration-500";
        case "slide-up":
            return "animate-in slide-in-from-bottom-6 duration-500";
        case "slide-down":
            return "animate-in slide-in-from-top-6 duration-500";
        case "scale":
            return "animate-in zoom-in-95 duration-500";
        case "blur":
            return "animate-in fade-in duration-500";
        default:
            return "";
    }
}

function hexToRgba(hex: string, opacity: number): string {
    if (!hex || !hex.startsWith("#")) return `rgba(0, 0, 0, ${opacity})`;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getHref(href?: string | null): string {
    if (!href) return "#";
    return href;
}

function isExternalHref(href?: string | null): boolean {
    return Boolean(href && /^https?:\/\//i.test(href));
}

function scoreLabelAgainstSelections(candidate: string, selectedLabels: string[]): number {
    const normalizedCandidate = normalizeLabel(candidate);
    if (!normalizedCandidate) return 0;

    let bestScore = 0;
    const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);

    selectedLabels.forEach((selectedLabel) => {
        const normalizedSelected = normalizeLabel(selectedLabel);
        if (!normalizedSelected) return;

        if (normalizedCandidate === normalizedSelected) {
            bestScore = Math.max(bestScore, 6);
            return;
        }

        if (
            normalizedCandidate.includes(normalizedSelected) ||
            normalizedSelected.includes(normalizedCandidate)
        ) {
            bestScore = Math.max(bestScore, 4);
        }

        const selectedTokens = normalizedSelected.split(" ").filter(Boolean);
        const overlap = candidateTokens.filter((token) => selectedTokens.includes(token)).length;
        if (overlap > 0) {
            bestScore = Math.max(bestScore, 1 + overlap);
        }
    });

    return bestScore;
}

function getClosestQuantity(columns: number[], target: number): number | null {
    if (!columns.length) return null;
    return columns.reduce((prev, curr) =>
        Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );
}

function getNearestPriceForRow(
    rowPrices: Record<number, number> | undefined,
    columns: number[],
    targetQuantity: number
): number {
    if (!rowPrices) return 0;

    const availableEntries = columns
        .map((column) => ({ column, price: Number(rowPrices[column]) || 0 }))
        .filter((entry) => entry.price > 0);

    if (!availableEntries.length) return 0;

    const nearest = availableEntries.reduce((prev, curr) =>
        Math.abs(curr.column - targetQuantity) < Math.abs(prev.column - targetQuantity) ? curr : prev
    );

    return nearest.price;
}

function useCrossfadeImage(
    targetSrc: string | null,
    enabled: boolean,
    durationMs: number
) {
    const [currentSrc, setCurrentSrc] = useState<string | null>(targetSrc);
    const [previousSrc, setPreviousSrc] = useState<string | null>(null);
    const [currentVisible, setCurrentVisible] = useState(true);

    useEffect(() => {
        if (!enabled) {
            setCurrentSrc(targetSrc);
            setPreviousSrc(null);
            setCurrentVisible(true);
            return;
        }

        if (targetSrc === currentSrc) return;

        setPreviousSrc(currentSrc);
        setCurrentSrc(targetSrc);
        setCurrentVisible(false);

        const raf = window.requestAnimationFrame(() => {
            setCurrentVisible(true);
        });
        const timer = window.setTimeout(() => {
            setPreviousSrc(null);
        }, durationMs);

        return () => {
            window.cancelAnimationFrame(raf);
            window.clearTimeout(timer);
        };
    }, [durationMs, enabled, targetSrc]);

    return { currentSrc, previousSrc, currentVisible };
}

function useFadeTransition(
    transitionKey: string | number | null,
    enabled: boolean
) {
    const [visible, setVisible] = useState(true);
    const hasMountedRef = useRef(false);

    useEffect(() => {
        if (!enabled || transitionKey == null) {
            setVisible(true);
            hasMountedRef.current = false;
            return;
        }

        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            setVisible(true);
            return;
        }

        setVisible(false);
        const raf = window.requestAnimationFrame(() => {
            setVisible(true);
        });

        return () => {
            window.cancelAnimationFrame(raf);
        };
    }, [enabled, transitionKey]);

    return visible;
}

const DEFAULT_STORFORMAT_CONFIG: StorformatConfig = {
    rounding_step: 1,
    global_markup_pct: 0,
    quantities: [1],
};

export function FeaturedProductConfigurator({
    config,
    branding,
    className,
}: FeaturedProductConfiguratorProps) {
    const [product, setProduct] = useState<ProductData | null>(null);
    const [sideProduct, setSideProduct] = useState<ProductData | null>(null);
    const [groups, setGroups] = useState<OptionGroup[]>([]);
    const [options, setOptions] = useState<Record<string, ProductOption[]>>({});
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [selectedQuantity, setSelectedQuantity] = useState<number>(
        config.quantityPresets?.[0] || 500
    );
    const [basePrice, setBasePrice] = useState<number>(0);
    const [availableQuantities, setAvailableQuantities] = useState<number[]>([]);
    const [genericVariantNames, setGenericVariantNames] = useState<string[]>([]);
    const [defaultMatrixData, setDefaultMatrixData] = useState<MatrixData>({ rows: [], columns: [], cells: {} });
    const [matrixData, setMatrixData] = useState<MatrixData>({ rows: [], columns: [], cells: {} });
    const [valueNameById, setValueNameById] = useState<Record<string, string>>({});
    const [fallbackPriceLabel, setFallbackPriceLabel] = useState<string | null>(null);
    const [featuredStorformatConfig, setFeaturedStorformatConfig] = useState<StorformatConfig>(DEFAULT_STORFORMAT_CONFIG);
    const [featuredStorformatMaterials, setFeaturedStorformatMaterials] = useState<StorformatMaterial[]>([]);
    const [featuredStorformatMaterialId, setFeaturedStorformatMaterialId] = useState<string>("");
    const [featuredStorformatWidthCm, setFeaturedStorformatWidthCm] = useState<number>(100);
    const [featuredStorformatHeightCm, setFeaturedStorformatHeightCm] = useState<number>(100);
    const [sideProductPriceLabel, setSideProductPriceLabel] = useState<string | null>(null);
    const [sidePanelProductsById, setSidePanelProductsById] = useState<Record<string, ProductData>>({});
    const [sideStorformatConfig, setSideStorformatConfig] = useState<StorformatConfig>(DEFAULT_STORFORMAT_CONFIG);
    const [sideStorformatMaterials, setSideStorformatMaterials] = useState<StorformatMaterial[]>([]);
    const [sideStorformatMaterialId, setSideStorformatMaterialId] = useState<string>("");
    const [sideStorformatQuantity, setSideStorformatQuantity] = useState<number>(1);
    const [sideStorformatWidthCm, setSideStorformatWidthCm] = useState<number>(100);
    const [sideStorformatHeightCm, setSideStorformatHeightCm] = useState<number>(100);
    const [sideBannerIndex, setSideBannerIndex] = useState<number>(0);
    const [featuredGalleryIndex, setFeaturedGalleryIndex] = useState<number>(0);
    const [sidePanelItemIndex, setSidePanelItemIndex] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    const primaryColor = branding?.colors?.primary || "#0EA5E9";
    const sidePanel = config.sidePanel;
    const sidePanelEnabled = Boolean(sidePanel?.enabled);
    const productFirst = (config.productSide || "left") === "left";
    const cardRadius = config.borderRadiusPx ?? 24;
    const boxScale = Math.min(Math.max((config.boxScalePct ?? 80) / 100, 0.6), 1.4);
    const featuredImageHeightPct = Math.min(
        Math.max((config.imageScalePct ?? 100) - 20, 40),
        100
    );
    const featuredBoxMinHeightPx = Math.round(420 * boxScale);
    const featuredBoxPaddingPx = 24;
    const featuredBoxGapPx = 24;
    const featuredMediaHeightPx = Math.round(192 * boxScale);
    const sidePanelRadius = sidePanel?.borderRadiusPx ?? cardRadius;
    const sidePanelScale = Math.min(
        Math.max((sidePanel?.boxScalePct ?? 80) / 100, 0.6),
        1.4
    );
    const sidePanelImageScale = Math.min(
        Math.max((sidePanel?.imageScalePct ?? 100) / 100, 0.6),
        1.4
    );
    const sidePanelMinHeightPx = Math.round(420 * sidePanelScale);
    const sidePanelPaddingPx = 20;
    const sidePanelGapPx = 12;
    const sidePanelMediaHeightPx = Math.round(192 * sidePanelScale);
    const sidePanelFadeEnabled = sidePanel?.fadeTransition ?? true;
    const sidePanelTransitionDurationMs = Math.min(
        Math.max(sidePanel?.transitionDurationMs ?? 700, 150),
        1800
    );
    const sidePanelOverlayBaseOpacity = sidePanel?.overlayOpacity ?? 0.35;
    const featuredCardStyle = {
        borderRadius: `${cardRadius}px`,
        minHeight: `${featuredBoxMinHeightPx}px`,
        backgroundColor: config.backgroundColor || undefined,
    };
    const sidePanelCardStyle = {
        borderRadius: `${sidePanelRadius}px`,
        minHeight: `${sidePanelMinHeightPx}px`,
    };
    const featuredGalleryImages = useMemo(() => {
        return (config.galleryImages || []).filter(Boolean).slice(0, 8);
    }, [config.galleryImages]);
    const featuredUsesGallery = Boolean(config.galleryEnabled && featuredGalleryImages.length > 0);
    const sideBannerImages = useMemo(() => {
        const uploadedImages = (sidePanel?.images || []).filter(Boolean);
        if (sidePanel?.imageUrl && !uploadedImages.includes(sidePanel.imageUrl)) {
            return [sidePanel.imageUrl, ...uploadedImages].slice(0, 5);
        }
        return uploadedImages.slice(0, 5);
    }, [sidePanel?.imageUrl, sidePanel?.images]);
    const sidePanelCarouselItems = useMemo(() => {
        return ((sidePanel?.items || []) as Array<{
            id?: string;
            mode?: "banner" | "product";
            productId?: string;
            imageUrl?: string | null;
            title?: string;
            subtitle?: string;
            ctaLabel?: string;
            ctaHref?: string;
        }>)
            .filter(Boolean)
            .slice(0, 5)
            .map((item, index) => ({
                id: item.id || `side-panel-item-${index + 1}`,
                mode: item.mode === "product" ? "product" : "banner",
                productId: item.productId,
                imageUrl: item.imageUrl || null,
                title: item.title || "",
                subtitle: item.subtitle || "",
                ctaLabel: item.ctaLabel || "",
                ctaHref: item.ctaHref || "",
            }));
    }, [sidePanel?.items]);
    const hasSidePanelCarousel = sidePanelCarouselItems.length > 0;
    const activeSidePanelItem = hasSidePanelCarousel
        ? sidePanelCarouselItems[Math.min(sidePanelItemIndex, sidePanelCarouselItems.length - 1)]
        : null;
    const activeSideProduct = hasSidePanelCarousel && activeSidePanelItem?.mode === "product" && activeSidePanelItem.productId
        ? sidePanelProductsById[activeSidePanelItem.productId] || null
        : sideProduct;
    const activeSideBannerItem = hasSidePanelCarousel && activeSidePanelItem?.mode === "banner"
        ? activeSidePanelItem
        : null;
    const sidePanelCarouselImageTarget = activeSideBannerItem?.imageUrl || sidePanel?.imageUrl || null;
    const sidePanelBannerImageTarget = sideBannerImages[sideBannerIndex] || sidePanel?.imageUrl || null;
    const sidePanelCarouselImageTransition = useCrossfadeImage(
        sidePanelCarouselImageTarget,
        sidePanelFadeEnabled,
        sidePanelTransitionDurationMs
    );
    const sidePanelBannerImageTransition = useCrossfadeImage(
        sidePanelBannerImageTarget,
        sidePanelFadeEnabled,
        sidePanelTransitionDurationMs
    );
    const sidePanelCarouselTransitionVisible = useFadeTransition(
        hasSidePanelCarousel ? `${sidePanelItemIndex}:${activeSidePanelItem?.id || ""}` : null,
        sidePanelFadeEnabled && hasSidePanelCarousel
    );
    const sidePanelBannerTransitionVisible = useFadeTransition(
        !hasSidePanelCarousel && sidePanel?.mode === "banner" ? sideBannerIndex : null,
        sidePanelFadeEnabled && !hasSidePanelCarousel && sidePanel?.mode === "banner"
    );

    const resolveValueName = useCallback((value: string) => {
        return valueNameById[value] || value;
    }, [valueNameById]);

    useEffect(() => {
        if (!config.productId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchProductData() {
            setLoading(true);
            const productRes = await supabase
                .from("products")
                .select("id, name, slug, description, image_url, pricing_type, default_variant, default_quantity, banner_config")
                .eq("id", config.productId)
                .single();

            if (cancelled) return;

            setProduct((productRes.data as ProductData) || null);
            setLoading(false);
        }

        fetchProductData();

        return () => {
            cancelled = true;
        };
    }, [config.productId]);

    useEffect(() => {
        if (hasSidePanelCarousel) {
            setSideProduct(null);
            const productIds = Array.from(new Set(
                sidePanelCarouselItems
                    .filter((item) => item.mode === "product" && item.productId)
                    .map((item) => item.productId as string)
            ));

            if (productIds.length === 0) {
                setSidePanelProductsById({});
                return;
            }

            let cancelled = false;

            async function fetchSidePanelProducts() {
                const { data } = await supabase
                    .from("products")
                    .select("id, name, slug, description, image_url, pricing_type, default_variant, default_quantity, banner_config")
                    .in("id", productIds);

                if (cancelled) return;

                const map: Record<string, ProductData> = {};
                ((data || []) as ProductData[]).forEach((entry) => {
                    map[entry.id] = entry;
                });
                setSidePanelProductsById(map);
            }

            fetchSidePanelProducts();

            return () => {
                cancelled = true;
            };
        }

        setSidePanelProductsById({});
    }, [hasSidePanelCarousel, sidePanelCarouselItems]);

    useEffect(() => {
        if (!hasSidePanelCarousel) {
            setSidePanelItemIndex(0);
            return;
        }
        if (sidePanelItemIndex >= sidePanelCarouselItems.length) {
            setSidePanelItemIndex(0);
        }
    }, [hasSidePanelCarousel, sidePanelCarouselItems.length, sidePanelItemIndex]);

    useEffect(() => {
        if (!hasSidePanelCarousel || sidePanelCarouselItems.length < 2) return;

        const intervalMs = Math.max(2000, sidePanel?.slideshowIntervalMs || 6000);
        const timer = window.setInterval(() => {
            setSidePanelItemIndex((current) => (current + 1) % sidePanelCarouselItems.length);
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [hasSidePanelCarousel, sidePanel?.slideshowIntervalMs, sidePanelCarouselItems.length]);

    useEffect(() => {
        let cancelled = false;

        async function fetchFallbackPrice() {
            if (!product) {
                setFallbackPriceLabel(null);
                return;
            }

            try {
                const label = await getProductDisplayPrice(product as any);
                if (!cancelled) setFallbackPriceLabel(label);
            } catch (error) {
                console.error("Error loading featured fallback price:", error);
                if (!cancelled) setFallbackPriceLabel(null);
            }
        }

        fetchFallbackPrice();

        return () => {
            cancelled = true;
        };
    }, [product]);

    useEffect(() => {
        if (product?.pricing_type !== "STORFORMAT") {
            setFeaturedStorformatConfig(DEFAULT_STORFORMAT_CONFIG);
            setFeaturedStorformatMaterials([]);
            setFeaturedStorformatMaterialId("");
            return;
        }

        let cancelled = false;

        async function fetchFeaturedStorformatPreview() {
            try {
                const [
                    { data: cfg },
                    { data: materialRows },
                    { data: materialTiers },
                ] = await Promise.all([
                    supabase
                        .from("storformat_configs" as any)
                        .select("*")
                        .eq("product_id", product.id)
                        .maybeSingle(),
                    supabase
                        .from("storformat_materials" as any)
                        .select("*")
                        .eq("product_id", product.id)
                        .order("sort_order"),
                    supabase
                        .from("storformat_material_price_tiers" as any)
                        .select("*")
                        .eq("product_id", product.id)
                        .order("sort_order"),
                ]);

                if (cancelled) return;

                const materialsWithTiers = ((materialRows || []) as any[]).map((material) => ({
                    ...material,
                    tiers: ((materialTiers || []) as any[]).filter((tier) => tier.material_id === material.id),
                })) as StorformatMaterial[];

                const nextConfig: StorformatConfig = {
                    rounding_step: cfg?.rounding_step || 1,
                    global_markup_pct: cfg?.global_markup_pct || 0,
                    quantities: cfg?.quantities?.length ? cfg.quantities : [1],
                };

                setFeaturedStorformatConfig(nextConfig);
                setFeaturedStorformatMaterials(materialsWithTiers);
                setFeaturedStorformatMaterialId((prev) => {
                    if (prev && materialsWithTiers.some((material) => material.id === prev)) return prev;
                    return materialsWithTiers[0]?.id || "";
                });
            } catch (error) {
                console.error("Error loading featured storformat preview:", error);
                if (!cancelled) {
                    setFeaturedStorformatConfig(DEFAULT_STORFORMAT_CONFIG);
                    setFeaturedStorformatMaterials([]);
                    setFeaturedStorformatMaterialId("");
                }
            }
        }

        fetchFeaturedStorformatPreview();

        return () => {
            cancelled = true;
        };
    }, [product]);

    useEffect(() => {
        if (!activeSideProduct) {
            setSideProductPriceLabel(null);
            return;
        }

        let cancelled = false;

        async function fetchSideProductPreviewPrice() {
            try {
                if (activeSideProduct.pricing_type === "STORFORMAT") {
                    if (!cancelled) setSideProductPriceLabel(null);
                    return;
                }

                const label = await getProductDisplayPrice(activeSideProduct as any);
                if (!cancelled) setSideProductPriceLabel(label);
            } catch (error) {
                console.error("Error loading side product preview price:", error);
                if (!cancelled) setSideProductPriceLabel(null);
            }
        }

        fetchSideProductPreviewPrice();

        return () => {
            cancelled = true;
        };
    }, [activeSideProduct]);

    useEffect(() => {
        if (activeSideProduct?.pricing_type !== "STORFORMAT") {
            setSideStorformatConfig(DEFAULT_STORFORMAT_CONFIG);
            setSideStorformatMaterials([]);
            setSideStorformatMaterialId("");
            setSideStorformatQuantity(1);
            return;
        }

        let cancelled = false;

        async function fetchSideStorformatPreview() {
            try {
                const [
                    { data: cfg },
                    { data: materialRows },
                    { data: materialTiers },
                ] = await Promise.all([
                    supabase
                        .from("storformat_configs" as any)
                        .select("*")
                        .eq("product_id", activeSideProduct.id)
                        .maybeSingle(),
                    supabase
                        .from("storformat_materials" as any)
                        .select("*")
                        .eq("product_id", activeSideProduct.id)
                        .order("sort_order"),
                    supabase
                        .from("storformat_material_price_tiers" as any)
                        .select("*")
                        .eq("product_id", activeSideProduct.id)
                        .order("sort_order"),
                ]);

                if (cancelled) return;

                const materialsWithTiers = ((materialRows || []) as any[]).map((material) => ({
                    ...material,
                    tiers: ((materialTiers || []) as any[]).filter((tier) => tier.material_id === material.id),
                })) as StorformatMaterial[];

                const nextConfig: StorformatConfig = {
                    rounding_step: cfg?.rounding_step || 1,
                    global_markup_pct: cfg?.global_markup_pct || 0,
                    quantities: cfg?.quantities?.length ? cfg.quantities : [1],
                };

                setSideStorformatConfig(nextConfig);
                setSideStorformatMaterials(materialsWithTiers);
                setSideStorformatMaterialId(materialsWithTiers[0]?.id || "");
                setSideStorformatQuantity(nextConfig.quantities[0] || 1);
            } catch (error) {
                console.error("Error loading side storformat preview:", error);
                if (!cancelled) {
                    setSideStorformatConfig(DEFAULT_STORFORMAT_CONFIG);
                    setSideStorformatMaterials([]);
                    setSideStorformatMaterialId("");
                }
            }
        }

        fetchSideStorformatPreview();

        return () => {
            cancelled = true;
        };
    }, [activeSideProduct]);

    useEffect(() => {
        if (!config.productId || !config.showOptions) {
            setGroups([]);
            setOptions({});
            setSelections({});
            return;
        }

        let cancelled = false;

        async function fetchOptions() {
            const { data: assignments } = await supabase
                .from("product_option_group_assignments")
                .select("option_group_id, sort_order")
                .eq("product_id", config.productId)
                .order("sort_order")
                .limit(4);

            if (!assignments || assignments.length === 0 || cancelled) return;

            const groupIds = assignments.map((assignment) => assignment.option_group_id);

            const { data: groupsData } = await supabase
                .from("product_option_groups")
                .select("*")
                .in("id", groupIds);

            if (!groupsData || cancelled) return;

            const sortedGroups = groupsData.sort((a, b) => {
                const aOrder = assignments.find((item) => item.option_group_id === a.id)?.sort_order || 0;
                const bOrder = assignments.find((item) => item.option_group_id === b.id)?.sort_order || 0;
                return aOrder - bOrder;
            }) as OptionGroup[];

            const optionsMap: Record<string, ProductOption[]> = {};
            const initialSelections: Record<string, string> = {};

            for (const group of sortedGroups) {
                const { data: optionsData } = await supabase
                    .from("product_options")
                    .select("*")
                    .eq("group_id", group.id)
                    .order("sort_order");

                if (optionsData && optionsData.length > 0) {
                    optionsMap[group.id] = optionsData as ProductOption[];
                    initialSelections[group.id] = optionsData[0].id;
                }
            }

            if (cancelled) return;

            setGroups(sortedGroups);
            setOptions(optionsMap);
            setSelections(initialSelections);
        }

        fetchOptions();

        return () => {
            cancelled = true;
        };
    }, [config.productId, config.showOptions]);

    useEffect(() => {
        if (!config.productId) return;

        let cancelled = false;

        async function fetchGenericStructure() {
            const { matrixData: initialMatrixData, variantNames } = await getGenericMatrixDataFromDB(config.productId!, undefined);

            if (cancelled) return;

            setGenericVariantNames(variantNames);
            setDefaultMatrixData(initialMatrixData);
            setMatrixData(initialMatrixData);
        }

        fetchGenericStructure();

        return () => {
            cancelled = true;
        };
    }, [config.productId]);

    useEffect(() => {
        if (!config.productId) return;

        const ids = new Set<string>();
        genericVariantNames.forEach((variantName) => {
            variantName.split("|").forEach((part) => {
                if (isUuid(part)) ids.add(part);
            });
        });
        matrixData.rows.forEach((row) => {
            if (isUuid(row)) ids.add(row);
        });

        if (ids.size === 0) return;

        let cancelled = false;

        async function fetchValueNames() {
            const { data } = await supabase
                .from("product_attribute_values" as any)
                .select("id, name")
                .in("id", Array.from(ids));

            if (!data || cancelled) return;

            const nextMap: Record<string, string> = {};
            (data as any[]).forEach((value) => {
                nextMap[value.id] = value.name;
            });
            setValueNameById((prev) => ({ ...prev, ...nextMap }));
        }

        fetchValueNames();

        return () => {
            cancelled = true;
        };
    }, [config.productId, genericVariantNames, matrixData.rows]);

    const selectedOptionLabels = useMemo(() => {
        return Object.entries(selections)
            .map(([groupId, optionId]) => options[groupId]?.find((option) => option.id === optionId)?.label || "")
            .filter(Boolean);
    }, [selections, options]);

    const selectedVariantName = useMemo(() => {
        if (genericVariantNames.length === 0) return undefined;
        if (selectedOptionLabels.length === 0) return genericVariantNames[0];

        let fallback = genericVariantNames[0];
        let bestMatch = genericVariantNames[0];
        let bestScore = -1;

        genericVariantNames.forEach((variantName) => {
            if (variantName === "none") {
                if (bestScore < 0) {
                    bestMatch = variantName;
                    bestScore = 0;
                }
                return;
            }

            const labels = variantName
                .split("|")
                .filter(Boolean)
                .map((part) => normalizeLabel(resolveValueName(part)));

            if (labels.length === 0) return;

            const score = labels.reduce((sum, label) => {
                return sum + scoreLabelAgainstSelections(label, selectedOptionLabels);
            }, 0);
            const isFullMatch = labels.every((label) => scoreLabelAgainstSelections(label, selectedOptionLabels) > 0);

            if (isFullMatch && score >= bestScore) {
                bestMatch = variantName;
                bestScore = score;
            } else if (bestScore < 0 && score > 0) {
                fallback = variantName;
            }
        });

        return bestScore >= 0 ? bestMatch : fallback;
    }, [genericVariantNames, selectedOptionLabels, resolveValueName]);

    useEffect(() => {
        if (!config.productId || !selectedVariantName) return;

        let cancelled = false;

        async function fetchMatrixData() {
            const { matrixData: nextMatrixData } = await getGenericMatrixDataFromDB(config.productId!, selectedVariantName);

            if (cancelled) return;
            if (nextMatrixData.rows.length === 0 || nextMatrixData.columns.length === 0) {
                setMatrixData(defaultMatrixData);
                return;
            }
            setMatrixData(nextMatrixData);
        }

        fetchMatrixData();

        return () => {
            cancelled = true;
        };
    }, [config.productId, selectedVariantName, defaultMatrixData]);

    const activeRowId = useMemo(() => {
        if (matrixData.rows.length === 0) return null;
        if (selectedOptionLabels.length === 0) return matrixData.rows[0];

        let bestRow = matrixData.rows[0];
        let bestScore = -1;

        matrixData.rows.forEach((row) => {
            const rowLabel = resolveValueName(row);
            const score = scoreLabelAgainstSelections(rowLabel, selectedOptionLabels);

            if (score > bestScore) {
                bestScore = score;
                bestRow = row;
            }
        });

        return bestRow;
    }, [matrixData.rows, selectedOptionLabels, resolveValueName]);

    useEffect(() => {
        if (matrixData.columns.length === 0) return;
        setAvailableQuantities(matrixData.columns);

        if (!matrixData.columns.includes(selectedQuantity)) {
            const nextQuantity = matrixData.columns.includes(config.quantityPresets?.[0] || 0)
                ? (config.quantityPresets?.[0] || matrixData.columns[0])
                : matrixData.columns[0];
            setSelectedQuantity(nextQuantity);
        }
    }, [config.quantityPresets, matrixData.columns, selectedQuantity]);

    useEffect(() => {
        if (product?.pricing_type !== "STORFORMAT") return;
        const storformatQuantities = featuredStorformatConfig.quantities || [];
        if (storformatQuantities.length === 0) return;

        if (!storformatQuantities.includes(selectedQuantity)) {
            const nextQuantity = storformatQuantities.includes(config.quantityPresets?.[0] || 0)
                ? (config.quantityPresets?.[0] || storformatQuantities[0])
                : storformatQuantities[0];
            setSelectedQuantity(nextQuantity);
        }
    }, [config.quantityPresets, featuredStorformatConfig.quantities, product?.pricing_type, selectedQuantity]);

    useEffect(() => {
        if (!activeRowId || matrixData.columns.length === 0) {
            setBasePrice(0);
            return;
        }

        const closestQty = getClosestQuantity(matrixData.columns, selectedQuantity) || selectedQuantity;
        let price = Number(matrixData.cells[activeRowId]?.[closestQty]) || 0;

        if (!price) {
            price = getNearestPriceForRow(matrixData.cells[activeRowId], matrixData.columns, selectedQuantity);
        }

        if (!price) {
            const fallbackPrice = matrixData.rows.reduce((found, row) => {
                if (found > 0) return found;
                return getNearestPriceForRow(matrixData.cells[row], matrixData.columns, selectedQuantity);
            }, 0);
            price = fallbackPrice;
        }

        setBasePrice(price);
    }, [activeRowId, matrixData, selectedQuantity]);

    const totalPrice = useMemo(() => {
        let price = basePrice;

        Object.entries(selections).forEach(([groupId, optionId]) => {
            const option = options[groupId]?.find((item) => item.id === optionId);
            if (option && option.extra_price > 0) {
                if (option.price_mode === "per_quantity") {
                    price += option.extra_price * selectedQuantity;
                } else {
                    price += option.extra_price;
                }
            }
        });

        return Math.round(price);
    }, [basePrice, selections, options, selectedQuantity]);

    const featuredStorformatMaterial = useMemo(() => {
        return featuredStorformatMaterials.find((material) => material.id === featuredStorformatMaterialId) || null;
    }, [featuredStorformatMaterials, featuredStorformatMaterialId]);

    const getOptionExtrasForQuantity = useCallback((quantity: number) => {
        return Object.entries(selections).reduce((sum, [groupId, optionId]) => {
            const option = options[groupId]?.find((item) => item.id === optionId);
            if (!option || option.extra_price <= 0) return sum;
            if (option.price_mode === "per_quantity") {
                return sum + (option.extra_price * quantity);
            }
            return sum + option.extra_price;
        }, 0);
    }, [options, selections]);

    const getFeaturedPriceForQuantity = useCallback((quantity: number) => {
        if (product?.pricing_type === "STORFORMAT") {
            if (!featuredStorformatMaterial) return 0;
            const selection = calculateStorformatPrice({
                widthMm: featuredStorformatWidthCm * 10,
                heightMm: featuredStorformatHeightCm * 10,
                quantity,
                material: featuredStorformatMaterial,
                config: featuredStorformatConfig,
            });
            return Math.round(selection.totalPrice + getOptionExtrasForQuantity(quantity));
        }

        if (!activeRowId || matrixData.columns.length === 0) {
            return 0;
        }

        const closestQty = getClosestQuantity(matrixData.columns, quantity) || quantity;
        let price = Number(matrixData.cells[activeRowId]?.[closestQty]) || 0;

        if (!price) {
            price = getNearestPriceForRow(matrixData.cells[activeRowId], matrixData.columns, quantity);
        }

        if (!price) return 0;
        return Math.round(price + getOptionExtrasForQuantity(quantity));
    }, [
        product?.pricing_type,
        featuredStorformatMaterial,
        featuredStorformatWidthCm,
        featuredStorformatHeightCm,
        featuredStorformatConfig,
        getOptionExtrasForQuantity,
        activeRowId,
        matrixData.columns,
        matrixData.cells,
    ]);

    const handleOptionSelect = useCallback((groupId: string, optionId: string) => {
        setSelections((prev) => ({ ...prev, [groupId]: optionId }));
    }, []);

    const handlePrevSidePanelItem = useCallback(() => {
        if (!hasSidePanelCarousel || sidePanelCarouselItems.length < 2) return;
        setSidePanelItemIndex((current) =>
            (current - 1 + sidePanelCarouselItems.length) % sidePanelCarouselItems.length
        );
    }, [hasSidePanelCarousel, sidePanelCarouselItems.length]);

    const handleNextSidePanelItem = useCallback(() => {
        if (!hasSidePanelCarousel || sidePanelCarouselItems.length < 2) return;
        setSidePanelItemIndex((current) => (current + 1) % sidePanelCarouselItems.length);
    }, [hasSidePanelCarousel, sidePanelCarouselItems.length]);

    const handlePrevSideBannerImage = useCallback(() => {
        if (sideBannerImages.length < 2) return;
        setSideBannerIndex((current) =>
            (current - 1 + sideBannerImages.length) % sideBannerImages.length
        );
    }, [sideBannerImages.length]);

    const handleNextSideBannerImage = useCallback(() => {
        if (sideBannerImages.length < 2) return;
        setSideBannerIndex((current) => (current + 1) % sideBannerImages.length);
    }, [sideBannerImages.length]);

    const displayQuantities = useMemo(() => {
        if (product?.pricing_type === "STORFORMAT") {
            const storformatQuantities = featuredStorformatConfig.quantities || [];
            const source = storformatQuantities.length > 0
                ? storformatQuantities
                : (config.quantityPresets || [1, 2, 3, 4, 5]);
            return source.slice(0, 4);
        }
        if (availableQuantities.length === 0) {
            return (config.quantityPresets || [200, 500, 1000, 2500, 5000]).slice(0, 8);
        }
        const validPresets = (config.quantityPresets || []).filter((quantity) =>
            availableQuantities.includes(quantity)
        );
        const source = validPresets.length > 0 ? validPresets : availableQuantities;
        return source.slice(0, 8);
    }, [availableQuantities, config.quantityPresets, featuredStorformatConfig.quantities, product?.pricing_type]);

    useEffect(() => {
        if (displayQuantities.length === 0) return;
        if (!displayQuantities.includes(selectedQuantity)) {
            setSelectedQuantity(displayQuantities[0]);
        }
    }, [displayQuantities, selectedQuantity]);

    const sideStorformatMaterial = useMemo(() => {
        return sideStorformatMaterials.find((material) => material.id === sideStorformatMaterialId) || null;
    }, [sideStorformatMaterials, sideStorformatMaterialId]);

    const sideStorformatSelection = useMemo(() => {
        if (!(sidePanel?.enabled && sidePanel.mode === "product" && sideProduct?.pricing_type === "STORFORMAT")) {
            return null;
        }
        if (!sideStorformatMaterial) return null;

        return calculateStorformatPrice({
            widthMm: sideStorformatWidthCm * 10,
            heightMm: sideStorformatHeightCm * 10,
            quantity: sideStorformatQuantity,
            material: sideStorformatMaterial,
            config: sideStorformatConfig,
        });
    }, [
        sidePanel?.enabled,
        sidePanel?.mode,
        sideProduct?.pricing_type,
        sideStorformatConfig,
        sideStorformatHeightCm,
        sideStorformatMaterial,
        sideStorformatQuantity,
        sideStorformatWidthCm,
    ]);

    useEffect(() => {
        setSideBannerIndex(0);
    }, [sidePanel?.mode, sideBannerImages]);

    useEffect(() => {
        if (!featuredUsesGallery) {
            setFeaturedGalleryIndex(0);
            return;
        }
        if (featuredGalleryIndex >= featuredGalleryImages.length) {
            setFeaturedGalleryIndex(0);
        }
    }, [featuredGalleryImages.length, featuredGalleryIndex, featuredUsesGallery]);

    useEffect(() => {
        if (!featuredUsesGallery || featuredGalleryImages.length < 2) {
            return;
        }

        const intervalMs = Math.max(3000, config.galleryIntervalMs || 6000);
        const timer = window.setInterval(() => {
            setFeaturedGalleryIndex((current) => (current + 1) % featuredGalleryImages.length);
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [config.galleryIntervalMs, featuredGalleryImages.length, featuredUsesGallery]);

    useEffect(() => {
        if (!(sidePanel?.enabled && sidePanel.mode === "banner") || sideBannerImages.length < 2) {
            return;
        }

        const intervalMs = Math.max(2000, sidePanel?.slideshowIntervalMs || 6000);
        const timer = window.setInterval(() => {
            setSideBannerIndex((current) => (current + 1) % sideBannerImages.length);
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [sidePanel?.enabled, sidePanel?.mode, sidePanel?.slideshowIntervalMs, sideBannerImages]);

    if (!config.productId) return null;

    if (loading) {
        return (
            <div className={cn("animate-pulse", className)}>
                <div className="h-64 bg-muted rounded-2xl" />
            </div>
        );
    }

    if (!product) return null;

    const selectedFeaturedPrice = getFeaturedPriceForQuantity(selectedQuantity);
    const displayPriceLabel = selectedFeaturedPrice > 0
        ? `${selectedFeaturedPrice.toLocaleString("da-DK")} kr`
        : fallbackPriceLabel;
    const isShadowless = config.cardStyle === "glass";
    const currentRowLabel = activeRowId ? resolveValueName(activeRowId) : "";
    const featuredPriceContextLabel = product.pricing_type === "STORFORMAT"
        ? `${featuredStorformatWidthCm} x ${featuredStorformatHeightCm} cm`
        : currentRowLabel;
    const sideBannerTitle = activeSideBannerItem?.title || sidePanel?.title;
    const sideBannerSubtitle = activeSideBannerItem?.subtitle || sidePanel?.subtitle;
    const sideBannerCtaLabel = activeSideBannerItem?.ctaLabel || sidePanel?.ctaLabel;
    const sideBannerHrefValue = activeSideBannerItem?.ctaHref || sidePanel?.ctaHref;
    const sideBannerImage = sidePanelCarouselImageTransition.currentSrc;
    const sideBannerPreviousImage = sidePanelCarouselImageTransition.previousSrc;
    const sideBannerCurrentVisible = sidePanelCarouselImageTransition.currentVisible;
    const sideBannerHref = getHref(sidePanel?.ctaHref);
    const activeSideBannerImage = sidePanelBannerImageTransition.currentSrc;
    const activeSideBannerPreviousImage = sidePanelBannerImageTransition.previousSrc;
    const activeSideBannerCurrentVisible = sidePanelBannerImageTransition.currentVisible;
    const sideCarouselVisualVisible = sidePanelFadeEnabled
        ? (sideBannerCurrentVisible && sidePanelCarouselTransitionVisible)
        : true;
    const sideImageListVisualVisible = sidePanelFadeEnabled
        ? (activeSideBannerCurrentVisible && sidePanelBannerTransitionVisible)
        : true;
    const sharedOffsetStyle = config.position === "above" && config.overlapPx
        ? { marginTop: `-${config.overlapPx}px` }
        : undefined;
    const featuredTitle = (config.customTitle || "").trim() || product.name;
    const featuredDescription = (config.customDescription || "").trim() || product.description;
    const featuredImageSrc = featuredUsesGallery
        ? (featuredGalleryImages[featuredGalleryIndex] || featuredGalleryImages[0] || getProductImage(product.slug, product.image_url))
        : getProductImage(product.slug, product.image_url);
    const renderSidePanelNavArrows = (
        onPrev: () => void,
        onNext: () => void,
        visible: boolean
    ) => {
        if (!visible || !(sidePanel?.showNavigationArrows ?? false)) return null;
        return (
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onPrev}
                    aria-label="Forrige banner"
                    className="h-8 w-8 rounded-full bg-black/45 text-white transition hover:bg-black/60"
                >
                    ‹
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    aria-label="Næste banner"
                    className="h-8 w-8 rounded-full bg-black/45 text-white transition hover:bg-black/60"
                >
                    ›
                </button>
            </div>
        );
    };

    const productBlock = (
        <div
            className={cn(
                "relative overflow-hidden h-full w-full flex-1 border",
                isShadowless
                    ? "bg-card shadow-none"
                    : "bg-card shadow-sm"
            )}
            style={featuredCardStyle}
        >
            <div
                className={cn("flex h-full flex-col lg:flex-row")}
                style={config.imageMode === "full"
                    ? undefined
                    : {
                        gap: `${featuredBoxGapPx}px`,
                        padding: `${featuredBoxPaddingPx}px`,
                    }}
            >
                <div
                    className={cn(
                        "flex-shrink-0",
                        config.imageMode === "full"
                            ? "relative min-h-[280px] lg:min-h-[100%] lg:w-[40%]"
                            : "relative flex items-end justify-center overflow-hidden lg:w-2/5"
                    )}
                >
                    <img
                        src={featuredImageSrc}
                        alt={featuredTitle}
                        className={cn(
                            config.imageMode === "full"
                                ? "absolute inset-0 h-full w-full object-cover"
                                : "absolute bottom-0 left-1/2 w-full -translate-x-1/2 object-contain object-bottom rounded-lg"
                        )}
                        style={config.imageMode === "full"
                            ? undefined
                            : {
                                height: `${featuredImageHeightPct}%`,
                                borderRadius: `${Math.max(cardRadius - 8, 8)}px`,
                                maxHeight: `${featuredMediaHeightPx * 2}px`,
                            }}
                    />
                    {featuredUsesGallery && featuredGalleryImages.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1">
                            {featuredGalleryImages.map((_, index) => (
                                <button
                                    key={`featured-gallery-dot-${index}`}
                                    type="button"
                                    aria-label={`Vis billede ${index + 1}`}
                                    onClick={() => setFeaturedGalleryIndex(index)}
                                    className={cn(
                                        "h-2 w-2 rounded-full transition-all",
                                        index === featuredGalleryIndex
                                            ? "bg-white"
                                            : "bg-white/45 hover:bg-white/70"
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className={cn(
                        "flex flex-1 flex-col gap-4",
                        config.imageMode === "full" ? "p-6 lg:w-[60%]" : "lg:w-3/5"
                    )}
                >
                    <div>
                        <h3 className="text-3xl lg:text-4xl font-bold mb-2">{featuredTitle}</h3>
                        {featuredDescription && (
                            <p className="text-muted-foreground text-sm line-clamp-2">
                                {featuredDescription}
                            </p>
                        )}
                    </div>

                    {product.pricing_type === "STORFORMAT" && (
                        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Bredde (cm)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={featuredStorformatWidthCm}
                                    onChange={(event) => setFeaturedStorformatWidthCm(Math.max(1, Number(event.target.value) || 1))}
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Højde (cm)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={featuredStorformatHeightCm}
                                    onChange={(event) => setFeaturedStorformatHeightCm(Math.max(1, Number(event.target.value) || 1))}
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Antal</label>
                        <div className={cn(
                            "gap-2",
                            product.pricing_type === "STORFORMAT"
                                ? "flex flex-wrap"
                                : "grid grid-cols-2 xl:grid-cols-4"
                        )}>
                            {displayQuantities.map((qty) => (
                                (() => {
                                    const quantityPrice = getFeaturedPriceForQuantity(qty);
                                    const isSelected = selectedQuantity === qty;

                                    return (
                                        <button
                                            key={qty}
                                            onClick={() => setSelectedQuantity(qty)}
                                            className={cn(
                                                "rounded-lg px-4 py-2 text-left transition-all",
                                                product.pricing_type === "STORFORMAT" ? "min-w-[110px]" : "w-full",
                                                isSelected
                                                    ? "shadow-md"
                                                    : "bg-muted hover:bg-muted/80"
                                            )}
                                            style={isSelected ? {
                                                backgroundColor: primaryColor,
                                                color: "#FFFFFF",
                                            } : undefined}
                                        >
                                            <div className="text-sm font-semibold">
                                                {qty.toLocaleString("da-DK")} stk
                                            </div>
                                            {quantityPrice > 0 && (
                                                <div className={cn(
                                                    "text-xs mt-0.5",
                                                    isSelected ? "text-white/90" : "text-muted-foreground"
                                                )}>
                                                    {quantityPrice.toLocaleString("da-DK")} kr
                                                </div>
                                            )}
                                        </button>
                                    );
                                })()
                            ))}
                        </div>
                    </div>

                    {config.showOptions && groups.length > 0 && product.pricing_type !== "STORFORMAT" && (
                        <div className="grid gap-4 md:grid-cols-2">
                            {groups.map((group) => {
                                const displayType = group.display_type || "buttons";
                                const groupOptions = options[group.id] || [];

                                return (
                                    <div key={group.id} className="space-y-2">
                                        <label className="text-sm font-medium">{group.label}</label>

                                        {displayType === "icon_grid" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {groupOptions.slice(0, 6).map((option) => {
                                                    const isSelected = selections[group.id] === option.id;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => handleOptionSelect(group.id, option.id)}
                                                            className={cn(
                                                                "flex flex-col items-center gap-2 rounded-lg border p-2 text-center transition-all",
                                                                isSelected
                                                                    ? "bg-card shadow-md ring-2 ring-primary/20"
                                                                    : "bg-muted hover:shadow"
                                                            )}
                                                        >
                                                            {option.icon_url ? (
                                                                <img
                                                                    src={option.icon_url}
                                                                    alt={option.label}
                                                                    className="h-24 w-full object-contain"
                                                                />
                                                            ) : (
                                                                <div className="flex h-24 w-full items-center justify-center rounded bg-background text-xs text-muted-foreground">
                                                                    Intet billede
                                                                </div>
                                                            )}
                                                            <span className="text-sm font-medium">{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {groupOptions.slice(0, 6).map((option) => {
                                                    const isSelected = selections[group.id] === option.id;
                                                    const hasIcon = Boolean(option.icon_url);
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => handleOptionSelect(group.id, option.id)}
                                                            className={cn(
                                                                "rounded-lg font-medium transition-all flex items-center gap-2",
                                                                hasIcon ? "p-2" : "px-3 py-1.5",
                                                                isSelected
                                                                    ? "ring-2 shadow-sm"
                                                                    : "bg-muted hover:bg-muted/80"
                                                            )}
                                                            style={isSelected ? {
                                                                backgroundColor: `${primaryColor}15`,
                                                                color: primaryColor,
                                                            } : undefined}
                                                        >
                                                            {hasIcon && (
                                                                <img
                                                                    src={option.icon_url!}
                                                                    alt={option.label}
                                                                    className="w-8 h-8 object-contain rounded"
                                                                />
                                                            )}
                                                            <span className="text-sm">{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-end justify-end gap-4 pt-4">
                        {config.showPrice && displayPriceLabel && (
                            <div className="text-right">
                                {selectedFeaturedPrice > 0 && featuredPriceContextLabel ? (
                                    <div className="text-xs text-muted-foreground mb-1">
                                        {featuredPriceContextLabel}
                                    </div>
                                ) : null}
                                <div
                                    className="text-3xl lg:text-4xl font-bold leading-none"
                                    style={{ color: primaryColor }}
                                >
                                    {displayPriceLabel}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ekskl. moms og levering
                                </p>
                            </div>
                        )}

                        <Button
                            size="lg"
                            style={{
                                backgroundColor: config.ctaColor || primaryColor,
                                color: config.ctaTextColor || "#FFFFFF",
                            }}
                            asChild
                        >
                            <Link to={`/produkt/${product.slug}`}>
                                {config.ctaLabel || "Bestil nu"}
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    const sidePanelContent = !sidePanelEnabled ? null : (
        hasSidePanelCarousel ? (
            activeSidePanelItem?.mode === "product" && activeSideProduct ? (
                <div
                    className="border bg-card overflow-hidden h-full shadow-sm"
                    style={{
                        ...sidePanelCardStyle,
                        opacity: sidePanelFadeEnabled
                            ? (sidePanelCarouselTransitionVisible ? 1 : 0)
                            : 1,
                        transition: sidePanelFadeEnabled
                            ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                            : undefined,
                    }}
                >
                    <img
                        src={getProductImage(activeSideProduct.slug, activeSideProduct.image_url)}
                        alt={activeSideProduct.name}
                        className="w-full object-cover"
                        style={{
                            height: `${sidePanelMediaHeightPx}px`,
                            transform: `scale(${sidePanelImageScale})`,
                            transformOrigin: "center center",
                        }}
                    />
                    <div
                        className="flex flex-col"
                        style={{ padding: `${sidePanelPaddingPx}px`, gap: `${sidePanelGapPx}px` }}
                    >
                        <h4 className="text-xl font-semibold">{activeSideProduct.name}</h4>
                        {activeSideProduct.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                                {activeSideProduct.description}
                            </p>
                        )}
                        {activeSideProduct.pricing_type === "STORFORMAT" && (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Bredde (cm)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sideStorformatWidthCm}
                                        onChange={(event) => setSideStorformatWidthCm(Math.max(1, Number(event.target.value) || 1))}
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Højde (cm)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sideStorformatHeightCm}
                                        onChange={(event) => setSideStorformatHeightCm(Math.max(1, Number(event.target.value) || 1))}
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="mt-auto flex items-end justify-between gap-3">
                            {(sideProductPriceLabel || sideStorformatSelection) && (
                                <div className="text-right">
                                    <div
                                        className="text-2xl font-bold leading-none"
                                        style={{ color: primaryColor }}
                                    >
                                        {activeSideProduct.pricing_type === "STORFORMAT" && sideStorformatSelection
                                            ? `${sideStorformatSelection.totalPrice.toLocaleString("da-DK")} kr`
                                            : sideProductPriceLabel}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {activeSideProduct.pricing_type === "STORFORMAT" && sideStorformatSelection
                                            ? `${sideStorformatWidthCm} x ${sideStorformatHeightCm} cm`
                                            : "Fra pris"}
                                    </p>
                                </div>
                            )}
                            <Button
                                asChild
                                style={{
                                    backgroundColor: config.ctaColor || primaryColor,
                                    color: config.ctaTextColor || "#FFFFFF",
                                }}
                            >
                                <Link
                                    to={`/produkt/${activeSideProduct.slug}`}
                                    style={{ color: config.ctaTextColor || "#FFFFFF" }}
                                >
                                    Bestil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className="relative overflow-hidden min-h-[320px] h-full shadow-sm"
                    style={sidePanelCardStyle}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
                    {sideBannerPreviousImage && (
                        <img
                            src={sideBannerPreviousImage}
                            alt={sideBannerTitle || "Kampagnebanner"}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                                transform: `scale(${sidePanelImageScale})`,
                                transformOrigin: "center center",
                                opacity: sidePanelFadeEnabled
                                    ? (sideCarouselVisualVisible ? 0 : 1)
                                    : 1,
                                transition: sidePanelFadeEnabled
                                    ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                    : undefined,
                            }}
                        />
                    )}
                    {sideBannerImage && (
                        <img
                            src={sideBannerImage}
                            alt={sideBannerTitle || "Kampagnebanner"}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                                transform: `scale(${sidePanelImageScale})`,
                                transformOrigin: "center center",
                                opacity: sidePanelFadeEnabled
                                    ? (sideCarouselVisualVisible ? 1 : 0)
                                    : 1,
                                transition: sidePanelFadeEnabled
                                    ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                    : undefined,
                            }}
                        />
                    )}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundColor: sidePanel?.overlayColor
                                ? hexToRgba(sidePanel.overlayColor, sidePanelOverlayBaseOpacity)
                                : `rgba(0, 0, 0, ${sidePanelOverlayBaseOpacity})`,
                            opacity: sidePanelFadeEnabled
                                ? (sideCarouselVisualVisible ? 1 : 0)
                                : 1,
                            transition: sidePanelFadeEnabled
                                ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                : undefined,
                        }}
                    />
                    {renderSidePanelNavArrows(
                        handlePrevSidePanelItem,
                        handleNextSidePanelItem,
                        sidePanelCarouselItems.length > 1
                    )}
                    <div
                        className="relative z-10 flex h-full flex-col justify-start items-start"
                        style={{
                            gap: `${sidePanelGapPx}px`,
                            padding: `${sidePanelPaddingPx}px`,
                            opacity: sidePanelFadeEnabled
                                ? (sidePanelCarouselTransitionVisible ? 1 : 0)
                                : 1,
                            transition: sidePanelFadeEnabled
                                ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                : undefined,
                        }}
                    >
                        {sideBannerTitle && (
                            <h4
                                className={cn("text-3xl font-bold", getBannerTextAnimationClass(sidePanel?.textAnimation))}
                                style={{ color: sidePanel?.titleColor || "#FFFFFF" }}
                            >
                                {sideBannerTitle}
                            </h4>
                        )}
                        {sideBannerSubtitle && (
                            <p
                                className={cn("text-sm md:text-base", getBannerTextAnimationClass(sidePanel?.textAnimation))}
                                style={{ color: sidePanel?.subtitleColor || "rgba(255,255,255,0.9)" }}
                            >
                                {sideBannerSubtitle}
                            </p>
                        )}
                        {sideBannerCtaLabel && getHref(sideBannerHrefValue) !== "#" && (
                            isExternalHref(getHref(sideBannerHrefValue)) ? (
                                <Button
                                    asChild
                                    size="lg"
                                    style={{
                                        backgroundColor: config.ctaColor || primaryColor,
                                        color: config.ctaTextColor || "#FFFFFF",
                                    }}
                                    className="w-fit"
                                >
                                    <a href={getHref(sideBannerHrefValue)} target="_blank" rel="noreferrer">
                                        {sideBannerCtaLabel}
                                    </a>
                                </Button>
                            ) : (
                                <Button
                                    asChild
                                    size="lg"
                                    style={{
                                        backgroundColor: config.ctaColor || primaryColor,
                                        color: config.ctaTextColor || "#FFFFFF",
                                    }}
                                    className="w-fit"
                                >
                                    <Link to={getHref(sideBannerHrefValue)}>
                                        {sideBannerCtaLabel}
                                    </Link>
                                </Button>
                            )
                        )}
                    </div>
                </div>
            )
        ) : (
            sidePanel?.mode === "product" && activeSideProduct ? (
                <div
                    className="border bg-card overflow-hidden h-full shadow-sm"
                    style={sidePanelCardStyle}
                >
                    <img
                        src={getProductImage(activeSideProduct.slug, activeSideProduct.image_url)}
                        alt={activeSideProduct.name}
                        className="w-full object-cover"
                        style={{
                            height: `${sidePanelMediaHeightPx}px`,
                            transform: `scale(${sidePanelImageScale})`,
                            transformOrigin: "center center",
                        }}
                    />
                    <div
                        className="flex flex-col"
                        style={{ padding: `${sidePanelPaddingPx}px`, gap: `${sidePanelGapPx}px` }}
                    >
                        <h4 className="text-xl font-semibold">{activeSideProduct.name}</h4>
                        {activeSideProduct.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                                {activeSideProduct.description}
                            </p>
                        )}
                        {activeSideProduct.pricing_type === "STORFORMAT" && (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Bredde (cm)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sideStorformatWidthCm}
                                        onChange={(event) => setSideStorformatWidthCm(Math.max(1, Number(event.target.value) || 1))}
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Højde (cm)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sideStorformatHeightCm}
                                        onChange={(event) => setSideStorformatHeightCm(Math.max(1, Number(event.target.value) || 1))}
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="mt-auto flex items-end justify-between gap-3">
                            {(sideProductPriceLabel || sideStorformatSelection) && (
                                <div className="text-right">
                                    <div
                                        className="text-2xl font-bold leading-none"
                                        style={{ color: primaryColor }}
                                    >
                                        {activeSideProduct.pricing_type === "STORFORMAT" && sideStorformatSelection
                                            ? `${sideStorformatSelection.totalPrice.toLocaleString("da-DK")} kr`
                                            : sideProductPriceLabel}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {activeSideProduct.pricing_type === "STORFORMAT" && sideStorformatSelection
                                            ? `${sideStorformatWidthCm} x ${sideStorformatHeightCm} cm`
                                            : "Fra pris"}
                                    </p>
                                </div>
                            )}
                            <Button
                                asChild
                                style={{
                                    backgroundColor: config.ctaColor || primaryColor,
                                    color: config.ctaTextColor || "#FFFFFF",
                                }}
                            >
                                <Link
                                    to={`/produkt/${activeSideProduct.slug}`}
                                    style={{ color: config.ctaTextColor || "#FFFFFF" }}
                                >
                                    Bestil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className="relative overflow-hidden min-h-[320px] h-full shadow-sm"
                    style={sidePanelCardStyle}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
                    {activeSideBannerPreviousImage && (
                        <img
                            src={activeSideBannerPreviousImage}
                            alt={sidePanel.title || "Kampagnebanner"}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                                transform: `scale(${sidePanelImageScale})`,
                                transformOrigin: "center center",
                                opacity: sidePanelFadeEnabled
                                    ? (sideImageListVisualVisible ? 0 : 1)
                                    : 1,
                                transition: sidePanelFadeEnabled
                                    ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                    : undefined,
                            }}
                        />
                    )}
                    {activeSideBannerImage && (
                        <img
                            src={activeSideBannerImage}
                            alt={sidePanel.title || "Kampagnebanner"}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                                transform: `scale(${sidePanelImageScale})`,
                                transformOrigin: "center center",
                                opacity: sidePanelFadeEnabled
                                    ? (sideImageListVisualVisible ? 1 : 0)
                                    : 1,
                                transition: sidePanelFadeEnabled
                                    ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                    : undefined,
                            }}
                        />
                    )}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundColor: sidePanel?.overlayColor
                                ? hexToRgba(sidePanel.overlayColor, sidePanelOverlayBaseOpacity)
                                : `rgba(0, 0, 0, ${sidePanelOverlayBaseOpacity})`,
                            opacity: sidePanelFadeEnabled
                                ? (sideImageListVisualVisible ? 1 : 0)
                                : 1,
                            transition: sidePanelFadeEnabled
                                ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                : undefined,
                        }}
                    />
                    {renderSidePanelNavArrows(
                        handlePrevSideBannerImage,
                        handleNextSideBannerImage,
                        sideBannerImages.length > 1
                    )}
                    <div
                        className="relative z-10 flex h-full flex-col justify-start items-start"
                        style={{
                            gap: `${sidePanelGapPx}px`,
                            padding: `${sidePanelPaddingPx}px`,
                            opacity: sidePanelFadeEnabled
                                ? (sidePanelBannerTransitionVisible ? 1 : 0)
                                : 1,
                            transition: sidePanelFadeEnabled
                                ? `opacity ${sidePanelTransitionDurationMs}ms ease`
                                : undefined,
                        }}
                    >
                        {sidePanel?.title && (
                            <h4
                                className={cn("text-3xl font-bold", getBannerTextAnimationClass(sidePanel.textAnimation))}
                                style={{ color: sidePanel.titleColor || "#FFFFFF" }}
                            >
                                {sidePanel.title}
                            </h4>
                        )}
                        {sidePanel?.subtitle && (
                            <p
                                className={cn("text-sm md:text-base", getBannerTextAnimationClass(sidePanel.textAnimation))}
                                style={{ color: sidePanel.subtitleColor || "rgba(255,255,255,0.9)" }}
                            >
                                {sidePanel.subtitle}
                            </p>
                        )}
                        {sidePanel?.ctaLabel && sideBannerHref !== "#" && (
                            isExternalHref(sideBannerHref) ? (
                                <Button
                                    asChild
                                    size="lg"
                                    style={{
                                        backgroundColor: config.ctaColor || primaryColor,
                                        color: config.ctaTextColor || "#FFFFFF",
                                    }}
                                    className="w-fit"
                                >
                                    <a href={sideBannerHref} target="_blank" rel="noreferrer">
                                        {sidePanel.ctaLabel}
                                    </a>
                                </Button>
                            ) : (
                                <Button
                                    asChild
                                    size="lg"
                                    style={{
                                        backgroundColor: config.ctaColor || primaryColor,
                                        color: config.ctaTextColor || "#FFFFFF",
                                    }}
                                    className="w-fit"
                                >
                                    <Link to={sideBannerHref}>
                                        {sidePanel.ctaLabel}
                                    </Link>
                                </Button>
                            )
                        )}
                    </div>
                </div>
            )
        )
    );

    const sidePanelBlock = sidePanelEnabled && sidePanelContent ? (
        <div className="flex h-full w-full min-w-0 flex-col gap-3">
            <div className="flex-1">
                {sidePanelContent}
            </div>
        </div>
    ) : null;

    return (
        <div className={cn(className)}>
            <div
                className={cn(
                    "grid",
                    sidePanelEnabled
                        ? "items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
                        : "gap-6"
                )}
                style={sharedOffsetStyle}
            >
                <div
                    className={cn(
                        "flex h-full w-full",
                        productFirst ? "order-1" : "order-2 lg:order-2"
                    )}
                >
                    <div className="flex h-full min-w-0 w-full">
                        {productBlock}
                    </div>
                </div>
                {sidePanelBlock && (
                    <div
                        className={cn(
                            "flex h-full w-full",
                            productFirst ? "order-2" : "order-1 lg:order-1"
                        )}
                    >
                        <div className="flex h-full min-w-0 w-full">
                            {sidePanelBlock}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
