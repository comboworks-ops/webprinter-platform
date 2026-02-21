import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { getProductDisplayPrice } from "@/utils/productPriceDisplay";
import { getProductImage } from "@/utils/productImages";
import { Info } from "lucide-react";
import { ProductBadge, type ProductBadgeConfig } from "@/components/ProductBadge";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  icon_text?: string | null;
  image_url: string | null;
  description: string | null;
  slug: string;
  category: "tryksager" | "storformat";
  pricing_type: string;
  default_variant: string | null;
  default_quantity: number | null;
  banner_config: any;
  tooltip_product: string | null;
  tooltip_price: string | null;
  displayPrice?: string;
}

interface ProductGridProps {
  category: "tryksager" | "storformat";
  columns?: 3 | 4 | 5;
  buttonConfig?: {
    style?: "default" | "bar" | "center" | "hidden";
    bgColor?: string;
    hoverBgColor?: string;
    textColor?: string;
    hoverTextColor?: string;
    font?: string;
    animation?: "none" | "lift" | "glow" | "pulse";
  };
  layoutStyle?: "cards" | "flat" | "grouped" | "slim";
  backgroundConfig?: {
    type?: "solid" | "gradient";
    color?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientAngle?: number;
    opacity?: number;
  };
}

import { useShopSettings } from "@/hooks/useShopSettings";

// ... (interfaces)

const PRODUCT_CACHE_KEY_PREFIX = "product-grid-cache-v1";
const PRODUCT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type ProductCachePayload = {
  at: number;
  tenantId: string;
  products: Product[];
};

const isTransportError = (error: unknown): boolean => {
  const anyError = error as any;
  const message = String(anyError?.message || "").toLowerCase();
  const details = String(anyError?.details || "").toLowerCase();
  const status = Number(anyError?.status || 0);
  return (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("aborterror")
    || details.includes("failed to fetch")
    || details.includes("aborterror")
    || status === 0
    || status === 522
    || status === 523
    || status === 524
    || status === 503
  );
};

const cacheKeyForTenant = (tenantId: string) => `${PRODUCT_CACHE_KEY_PREFIX}:tenant:${tenantId}`;
const cacheLastSuccessKey = `${PRODUCT_CACHE_KEY_PREFIX}:last-success`;

const readProductCache = (key: string): ProductCachePayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductCachePayload;
    if (!parsed?.at || !Array.isArray(parsed?.products)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeProductCache = (key: string, payload: ProductCachePayload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage errors
  }
};

const ProductGrid = ({ category, columns = 4, buttonConfig, backgroundConfig, layoutStyle = "cards" }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const settings = useShopSettings();

  useEffect(() => {
    const fetchAndLoadPrices = async () => {
      // Wait for settings to load
      if (settings.isLoading) return;
      setLoading(true);

      const tenantId = settings.data?.id || '00000000-0000-0000-0000-000000000000'; // Fallback to Master if critical failure
      const tenantCacheKey = cacheKeyForTenant(tenantId);

      try {
        setErrorMessage(null);
        setWarningMessage(null);
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, 
            name, 
            icon_text,
            description,
            slug, 
            image_url, 
            category,
            pricing_type,
            default_variant,
            default_quantity,
            banner_config,
            tooltip_product,
            tooltip_price
          `)
          .eq('is_published', true)
          // Temporary rollback: hide merged folder-project from storefront.
          .neq('slug', 'folder-project')
          .eq('tenant_id', tenantId) // Filter by resolved Tenant
          .order('name');

        if (error) throw error;

        const productsData = (data || []) as Product[];

        // Load prices for all products
        const productsWithPrices = await Promise.all(
          productsData.map(async (product) => ({
            ...product,
            displayPrice: await getProductDisplayPrice(product)
          }))
        );

        setProducts(productsWithPrices);
        const payload: ProductCachePayload = {
          at: Date.now(),
          tenantId,
          products: productsWithPrices,
        };
        writeProductCache(tenantCacheKey, payload);
        writeProductCache(cacheLastSuccessKey, payload);
      } catch (error) {
        console.error('Error fetching products:', error);
        if (isTransportError(error)) {
          const tenantCache = readProductCache(tenantCacheKey);
          const globalCache = readProductCache(cacheLastSuccessKey);
          const candidateCache = tenantCache || globalCache;
          const isFresh = !!candidateCache && (Date.now() - candidateCache.at) <= PRODUCT_CACHE_TTL_MS;
          if (isFresh && candidateCache) {
            setProducts(candidateCache.products);
            setWarningMessage('Viser senest gemte produkter, fordi backend-forbindelsen fejler midlertidigt.');
            setErrorMessage(null);
          } else {
            setProducts([]);
            setWarningMessage(null);
            setErrorMessage('Kunne ikke hente produkter lige nu. Backend-forbindelsen fejler midlertidigt.');
          }
        } else {
          setProducts([]);
          setWarningMessage(null);
          setErrorMessage('Kunne ikke hente produkter.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAndLoadPrices();
  }, [settings.data?.id, settings.isLoading]);

  const filteredProducts = products.filter((p) => p.category === category);

  if (loading) {
    return <div className="text-center py-8">Indlæser produkter...</div>;
  }

  if (errorMessage) {
    return <div className="text-center py-8 text-sm text-muted-foreground">{errorMessage}</div>;
  }

  const gridColumnsClass = columns === 5 ? "lg:grid-cols-5" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const cardWidthClass = layoutStyle === "slim"
    ? "max-w-none"
    : columns === 5
      ? "max-w-[240px]"
      : columns === 3
        ? "max-w-[320px]"
        : "max-w-[280px]";
  const buttonStyle = buttonConfig?.style ?? "default";
  const buttonStyles = {
    bgColor: buttonConfig?.bgColor ?? "#0EA5E9",
    hoverBgColor: buttonConfig?.hoverBgColor ?? "#0284C7",
    textColor: buttonConfig?.textColor ?? "#FFFFFF",
    hoverTextColor: buttonConfig?.hoverTextColor ?? "#FFFFFF",
    font: buttonConfig?.font ?? "Poppins",
    animation: buttonConfig?.animation ?? "none",
  };
  const backgroundStyles = {
    type: backgroundConfig?.type ?? "solid",
    color: backgroundConfig?.color ?? "#FFFFFF",
    gradientStart: backgroundConfig?.gradientStart ?? "#FFFFFF",
    gradientEnd: backgroundConfig?.gradientEnd ?? "#F1F5F9",
    gradientAngle: backgroundConfig?.gradientAngle ?? 135,
    opacity: backgroundConfig?.opacity ?? 1,
  };
  const buttonAnimationClass = buttonStyles.animation === "lift"
    ? "hover:-translate-y-0.5 hover:shadow-md"
    : buttonStyles.animation === "glow"
      ? "hover:shadow-lg"
      : buttonStyles.animation === "pulse"
        ? "hover:scale-[1.02]"
        : "";

  const toRgba = (hex: string, opacity: number) => {
    if (!hex || typeof hex !== "string") return hex;
    const normalized = hex.startsWith("#") ? hex : `#${hex}`;
    const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(normalized);
    const longMatch = /^#([0-9a-fA-F]{6})$/.exec(normalized);
    if (!shortMatch && !longMatch) return hex;

    const fullHex = shortMatch
      ? shortMatch[1].split("").map((c) => c + c).join("")
      : longMatch![1];
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const cardBackgroundStyle = backgroundStyles.type === "gradient"
    ? {
      backgroundImage: `linear-gradient(${backgroundStyles.gradientAngle}deg, ${toRgba(
        backgroundStyles.gradientStart,
        backgroundStyles.opacity
      )}, ${toRgba(backgroundStyles.gradientEnd, backgroundStyles.opacity)})`,
    }
    : { backgroundColor: toRgba(backgroundStyles.color, backgroundStyles.opacity) };

  const isGroupedLayout = layoutStyle === "grouped";
  const isFlatLayout = layoutStyle === "flat";
  const isSlimLayout = layoutStyle === "slim";
  const useCardBackground = layoutStyle === "cards" || layoutStyle === "slim";
  const cardFrameClass = (isGroupedLayout || isFlatLayout) ? "bg-transparent border-transparent shadow-none" : "";
  const cardStyle = useCardBackground ? cardBackgroundStyle : undefined;
  const wrapperStyle = isGroupedLayout ? cardBackgroundStyle : undefined;
  const effectiveButtonStyle = isSlimLayout && buttonStyle !== "hidden" ? "default" : buttonStyle;

  return (
    <TooltipProvider>
      <div
        className={cn(
          isGroupedLayout && "rounded-2xl border p-6",
          isSlimLayout && "px-4 py-2 sm:px-6",
        )}
        style={wrapperStyle}
      >
        {warningMessage && (
          <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {warningMessage}
          </div>
        )}
        <div className={cn(
          "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
          gridColumnsClass,
          isSlimLayout ? "gap-4 sm:gap-6" : "gap-6"
        )}>
          {filteredProducts.map((product) => {
            // Extract special badge config from banner_config
            const badgeConfig = (product.banner_config as any)?.special_badge as ProductBadgeConfig | undefined;
            const isHoverBadge = badgeConfig?.showOnHover;

            return (
              <Tooltip key={product.id}>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      "hover:shadow-lg transition-shadow cursor-pointer w-full mx-auto relative overflow-visible group flex flex-col h-full",
                      cardWidthClass,
                      isSlimLayout && "min-h-[150px]",
                      isFlatLayout && "shadow-none hover:shadow-none",
                      cardFrameClass,
                    )}
                    style={cardStyle}
                  >
                    {/* Special Badge - positioned in top-left corner */}
                    {badgeConfig?.enabled && (
                      <ProductBadge
                        config={badgeConfig}
                        className={isHoverBadge ? "opacity-0 group-hover:opacity-100 transition-opacity duration-300" : ""}
                      />
                    )}
                    <CardHeader className={cn("p-4", isSlimLayout && "relative pt-9 pb-2 pl-5 pr-26")}>
                      {(() => {
                        const hoverImageUrl = (product.banner_config as any)?.hover_image_url;
                        return (
                          <Link
                            to={`/produkt/${product.slug}`}
                            className={cn(
                              "block overflow-hidden relative group flex items-center justify-center",
                              isSlimLayout
                                ? "absolute -top-6 -right-3 w-32 h-32 rounded-lg"
                                : "w-full h-36 rounded-lg mb-1"
                            )}
                          >
                            <img
                              src={getProductImage(product.slug, product.image_url)}
                              alt={product.name}
                              className={`w-full h-full object-contain transition-all duration-300 ${!hoverImageUrl ? 'hover:scale-110' : 'group-hover:opacity-0'}`}
                              style={{ filter: 'var(--product-filter)' }}
                            />
                            {hoverImageUrl && (
                              <img
                                src={hoverImageUrl}
                                alt={`${product.name} hover`}
                                className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{ filter: 'var(--product-filter)' }}
                              />
                            )}
                          </Link>
                        );
                      })()}
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{product.icon_text || product.name}</CardTitle>
                        {product.tooltip_product && (
                          <Info className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className={cn("px-4 pb-3", isSlimLayout && "pt-0 px-5 pb-3")}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            const priceColor = (product.banner_config as any)?.price_color || 'var(--pricing-text)';
                            const priceBgColor = (product.banner_config as any)?.price_bg_color;
                            const bgEnabled = (product.banner_config as any)?.price_bg_enabled;
                            const priceFont = (product.banner_config as any)?.price_font || 'inherit';
                            const promoPrice = (product.banner_config as any)?.promo_price;
                            const originalPrice = (product.banner_config as any)?.original_price;
                            const showSavingsBadge = (product.banner_config as any)?.show_savings_badge;
                            const hasPromo = promoPrice && originalPrice && originalPrice > promoPrice;
                            const savingsPercent = hasPromo ? Math.round((1 - promoPrice / originalPrice) * 100) : 0;

                            return (
                              <>
                                {hasPromo ? (
                                  <>
                                    {/* Original price with strikethrough */}
                                    <span className="text-base text-muted-foreground line-through">
                                      {originalPrice} kr
                                    </span>
                                    {/* Promo price */}
                                    <p
                                      className={`text-2xl font-extrabold ${bgEnabled ? 'px-2 py-1 rounded-md' : ''}`}
                                      style={{
                                        color: priceColor,
                                        backgroundColor: bgEnabled ? priceBgColor : 'transparent',
                                        fontFamily: priceFont !== 'inherit' ? priceFont : undefined
                                      }}
                                    >
                                      {promoPrice} kr
                                    </p>
                                    {/* Savings badge */}
                                    {showSavingsBadge && (
                                      <span className="text-xs font-bold text-white bg-green-500 px-2 py-1 rounded-full animate-pulse">
                                        SPAR {savingsPercent}%
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <p
                                    className={`text-2xl font-extrabold ${bgEnabled ? 'px-2 py-1 rounded-md' : ''}`}
                                    style={{
                                      color: priceColor,
                                      backgroundColor: bgEnabled ? priceBgColor : 'transparent',
                                      fontFamily: priceFont !== 'inherit' ? priceFont : undefined
                                    }}
                                  >
                                    {product.displayPrice || "Se priser"}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                          {product.tooltip_price && (
                            <Info className="h-3 w-3 text-muted-foreground" />
                          )}

                        </div>
                        {product.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    {effectiveButtonStyle !== "hidden" && (
                      <CardFooter
                        className={cn(
                          "gap-2",
                          effectiveButtonStyle === "bar"
                            ? "px-0 pb-0 mt-auto w-full overflow-hidden rounded-b-lg"
                            : isSlimLayout
                              ? "px-5 pb-3 mt-auto"
                              : "px-4 pb-4 mt-auto",
                          isSlimLayout
                            ? "justify-end"
                            : effectiveButtonStyle === "center"
                              ? "justify-center mt-auto"
                              : "justify-end"
                        )}
                      >
                        <Button
                          size={effectiveButtonStyle === "center" ? "lg" : "sm"}
                          variant="ghost"
                          className={cn(
                            "transition-all font-semibold",
                            "bg-[var(--btn-bg)] text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                            effectiveButtonStyle === "bar" ? "w-full rounded-none py-5" : "px-4",
                            effectiveButtonStyle === "center" ? "min-w-[220px] py-5" : "",
                            isSlimLayout ? "h-8 px-3 text-xs" : "",
                            buttonAnimationClass
                          )}
                          style={{
                            ["--btn-bg" as any]: buttonStyles.bgColor,
                            ["--btn-hover-bg" as any]: buttonStyles.hoverBgColor,
                            ["--btn-text" as any]: buttonStyles.textColor,
                            ["--btn-hover-text" as any]: buttonStyles.hoverTextColor,
                            fontFamily: `'${buttonStyles.font}', sans-serif`,
                          }}
                          asChild
                        >
                          <Link to={`/produkt/${product.slug}`}>Priser</Link>
                        </Button>
                      </CardFooter>
                    )}

                  </Card>
                </TooltipTrigger>
                {(product.tooltip_product || product.tooltip_price) && (
                  <TooltipContent className="max-w-md p-4 bg-card/95 backdrop-blur-sm border-2 shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      {product.tooltip_product && (
                        <p className="text-sm leading-relaxed">{product.tooltip_product}</p>
                      )}
                      {product.tooltip_price && (
                        <p className="text-sm leading-relaxed">{product.tooltip_price}</p>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ProductGrid;
