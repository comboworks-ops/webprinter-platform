import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductImage } from "@/utils/productImages";
import { Info } from "lucide-react";
import { ProductBadge, type ProductBadgeConfig } from "@/components/ProductBadge";
import {
  buildStorefrontProductHref,
  getStorefrontProductButtonLabel,
} from "@/lib/catalog/categoryLanding";
import { cn } from "@/lib/utils";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { useStorefrontCatalog, type StorefrontProduct } from "@/hooks/useStorefrontCatalog";
import { normalizeProductCategoryKey } from "@/utils/productCategories";
import { useShopSettings } from "@/hooks/useShopSettings";

interface ProductGridProps {
  category: string;
  products?: StorefrontProduct[];
  loadingOverride?: boolean;
  errorMessageOverride?: string | null;
  warningMessageOverride?: string | null;
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

function normalizeCardCopy(value?: string | null): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

const ProductGrid = ({
  category,
  products: productsOverride,
  loadingOverride,
  errorMessageOverride,
  warningMessageOverride,
  columns = 4,
  buttonConfig,
  backgroundConfig,
  layoutStyle = "cards",
}: ProductGridProps) => {
  const catalog = useStorefrontCatalog({ enabled: !productsOverride });
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const activeBranding = (isPreviewMode && previewBranding)
    ? previewBranding
    : settings.data?.branding;
  const selectedIconPackId = activeBranding?.selectedIconPackId || "classic";
  const products = productsOverride ?? catalog.products;
  const loading = loadingOverride ?? catalog.loading;
  const errorMessage = errorMessageOverride ?? catalog.errorMessage;
  const warningMessage = warningMessageOverride ?? catalog.warningMessage;
  const categoryRecords = catalog.categoryRecords;
  const overviews = catalog.overviews;

  const filteredProducts = category === "__all__"
    ? products
    : products.filter((product) => {
      const productCategory = product.categoryKey || normalizeProductCategoryKey(product.category);
      return productCategory === normalizeProductCategoryKey(category);
    });

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
  const productCardConfig = activeBranding?.forside?.productsSection?.card;
  const productCardStyles = {
    titleFont: productCardConfig?.titleFont || activeBranding?.fonts?.heading || "Poppins",
    titleColor: productCardConfig?.titleColor || activeBranding?.colors?.headingText || "#1F2937",
    bodyFont: productCardConfig?.bodyFont || activeBranding?.fonts?.body || "Inter",
    bodyColor: productCardConfig?.bodyColor || activeBranding?.colors?.bodyText || "#4B5563",
    priceFont: productCardConfig?.priceFont || activeBranding?.fonts?.pricing || "Roboto Mono",
    priceColor: productCardConfig?.priceColor || activeBranding?.colors?.pricingText || "#0EA5E9",
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
  const isCardLayout = layoutStyle === "cards";
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
            const productHref = buildStorefrontProductHref(product, categoryRecords, overviews);
            const productButtonLabel = getStorefrontProductButtonLabel(product);
            const bannerConfig = (product.banner_config as any) || {};
            const productTitle = normalizeCardCopy(product.icon_text || product.name);
            const productDescription = normalizeCardCopy(product.description);
            const displayPriceLabel = normalizeCardCopy(product.displayPrice) || "Se priser";
            // Extract special badge config from banner_config
            const badgeConfig = bannerConfig.special_badge as ProductBadgeConfig | undefined;
            const isHoverBadge = badgeConfig?.showOnHover;
            const imageScalePct = Math.max(60, Math.min(140, Number(bannerConfig.image_scale_pct) || 100));
            const hoverImageUrl = bannerConfig.hover_image_url;
            const promoPrice = Number(bannerConfig.promo_price);
            const originalPrice = Number(bannerConfig.original_price);
            const showSavingsBadge = bannerConfig.show_savings_badge === true;
            const hasPromo =
              Number.isFinite(promoPrice)
              && Number.isFinite(originalPrice)
              && originalPrice > promoPrice;
            const savingsPercent = hasPromo ? Math.round((1 - promoPrice / originalPrice) * 100) : 0;

            const productImage = (
              <Link
                to={productHref}
                data-branding-id="icons.product-images"
                className={cn(
                  "block overflow-hidden relative group flex items-center justify-center",
                  !isFlatLayout && !isSlimLayout && "p-2",
                  !isFlatLayout && !isSlimLayout && !isCardLayout && "bg-white",
                  isSlimLayout
                    ? "absolute -top-5 -right-3 w-36 h-36 z-0"
                    : "w-full h-36 rounded-lg mb-1"
                )}
              >
                <img
                  src={getProductImage(product.slug, product.image_url)}
                  alt={product.name}
                  className={`w-full h-full object-contain transition-all duration-300 ${!hoverImageUrl ? 'hover:scale-110' : 'group-hover:opacity-0'}`}
                  style={{
                    filter: 'var(--product-filter)',
                    width: `${imageScalePct}%`,
                    height: `${imageScalePct}%`
                  }}
                />
                {hoverImageUrl && (
                  <img
                    src={hoverImageUrl}
                    alt={`${product.name} hover`}
                    className="absolute inset-0 m-auto w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      filter: 'var(--product-filter)',
                      width: `${imageScalePct}%`,
                      height: `${imageScalePct}%`
                    }}
                  />
                )}
              </Link>
            );

            return (
              <Tooltip key={product.id}>
                <TooltipTrigger asChild>
                  <Card
                    data-branding-id="forside.products.background"
                    className={cn(
                      "hover:shadow-lg transition-shadow cursor-pointer w-full mx-auto relative overflow-visible group flex flex-col h-full",
                      cardWidthClass,
                      isSlimLayout && "min-h-[165px]",
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
                    <CardHeader className={cn("p-4 pb-2", isSlimLayout && "relative z-10 pt-5 pb-2 pl-5 pr-28")}>
                      {productImage}
                      <div className="flex items-start gap-1.5">
                        <CardTitle
                          data-branding-id="forside.products.card.title"
                          className="line-clamp-2 text-base font-semibold leading-tight sm:text-lg"
                          style={{
                            color: productCardStyles.titleColor,
                            fontFamily: `'${productCardStyles.titleFont}', sans-serif`,
                          }}
                        >
                          {productTitle}
                        </CardTitle>
                        {product.tooltip_product && (
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className={cn("px-4 pb-4 pt-0", isSlimLayout && "relative z-10 px-5 pb-3 pt-0 pr-28")}>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-1.5 flex-wrap">
                          {hasPromo ? (
                            <>
                              <span className="text-sm text-muted-foreground line-through">
                                {originalPrice} kr
                              </span>
                              <p
                                data-branding-id="forside.products.card.price"
                                className="text-2xl font-extrabold leading-none"
                                style={{
                                  color: productCardStyles.priceColor,
                                  fontFamily: `'${productCardStyles.priceFont}', sans-serif`,
                                }}
                              >
                                {promoPrice} kr
                              </p>
                              {showSavingsBadge && (
                                <span className="text-xs font-bold text-white bg-green-500 px-2 py-1 rounded-full animate-pulse">
                                  SPAR {savingsPercent}%
                                </span>
                              )}
                            </>
                          ) : (
                            <p
                              data-branding-id="forside.products.card.price"
                              className="text-2xl font-extrabold leading-none"
                              style={{
                                color: productCardStyles.priceColor,
                                fontFamily: `'${productCardStyles.priceFont}', sans-serif`,
                              }}
                            >
                              {displayPriceLabel}
                            </p>
                          )}
                          {product.tooltip_price && (
                            <Info className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
                          )}

                        </div>
                        {productDescription && (
                          <p
                            data-branding-id="forside.products.card.body"
                            className="line-clamp-2 text-sm leading-5 text-muted-foreground"
                            style={{
                              color: productCardStyles.bodyColor,
                              fontFamily: `'${productCardStyles.bodyFont}', sans-serif`,
                            }}
                          >
                            {productDescription}
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
                          data-branding-id="forside.products.button"
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
                          <Link to={productHref}>{productButtonLabel}</Link>
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
