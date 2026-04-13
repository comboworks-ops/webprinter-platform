import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductBadge, type ProductBadgeConfig } from "@/components/ProductBadge";

interface ProductPreviewCardProps {
    name: string;
    priceFrom: string | null;
    description?: string;
    imageUrl?: string | null;
    imageScalePct?: number;
    priceColor?: string;
    priceBgColor?: string;
    priceBgEnabled?: boolean;
    priceFont?: string;
    hoverImageUrl?: string | null;
    specialBadge?: ProductBadgeConfig;
    promoPrice?: string;
    originalPrice?: string;
    showSavingsBadge?: boolean;
    actionLabel?: string;
}

function normalizeCardCopy(value?: string | null): string {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim();
}

export function ProductPreviewCard({
    name,
    priceFrom,
    description,
    imageUrl,
    imageScalePct = 100,
    priceColor = "#000000",
    priceBgColor = "#FFFFFF",
    priceBgEnabled = false,
    priceFont = "inherit",
    hoverImageUrl,
    specialBadge,
    promoPrice,
    originalPrice,
    showSavingsBadge,
    actionLabel = "Priser",
}: ProductPreviewCardProps) {
    const normalizedImageScalePct = Math.max(60, Math.min(140, Number(imageScalePct) || 100));
    const normalizedName = normalizeCardCopy(name);
    const normalizedDescription = normalizeCardCopy(description);
    const normalizedPriceFrom = normalizeCardCopy(priceFrom);
    const normalizedPromoPrice = Number(promoPrice);
    const normalizedOriginalPrice = Number(originalPrice);
    const hasPromo =
        Number.isFinite(normalizedPromoPrice)
        && Number.isFinite(normalizedOriginalPrice)
        && normalizedOriginalPrice > normalizedPromoPrice;
    const savingsPercent = hasPromo
        ? Math.round((1 - normalizedPromoPrice / normalizedOriginalPrice) * 100)
        : 0;
    const displayPriceLabel = normalizedPriceFrom ? `Fra ${normalizedPriceFrom} kr` : "Se priser";
    void priceColor;
    void priceBgColor;
    void priceBgEnabled;
    void priceFont;

    return (
        <>
            <div className="w-full max-w-[300px] mx-auto opacity-100 transition-opacity">
                <div className="mb-2 text-xs font-medium text-muted-foreground text-center uppercase tracking-wider">
                    Preview (Forside)
                </div>

                {/* Mimic ProductGrid.tsx card styles */}
                <Card className="hover:shadow-lg transition-shadow cursor-default w-full mx-auto relative overflow-visible border-2 border-dashed border-primary/20 bg-white flex flex-col h-full max-w-[280px]">
                    {/* Special Badge */}
                    {specialBadge?.enabled && (
                        <ProductBadge config={specialBadge} />
                    )}
                    <CardHeader className="p-4 pb-2">
                        <div className="block w-full h-36 rounded-lg flex items-center justify-center mb-1 overflow-hidden bg-white relative group p-2">
                            {imageUrl ? (
                                <>
                                    <img
                                        src={imageUrl}
                                        alt={name}
                                        className={`w-full h-full object-contain transition-opacity duration-300 ${hoverImageUrl ? 'group-hover:opacity-0' : ''}`}
                                        style={{
                                            filter: 'var(--product-filter)',
                                            width: `${normalizedImageScalePct}%`,
                                            height: `${normalizedImageScalePct}%`
                                        }}
                                    />
                                    {hoverImageUrl && (
                                        <img
                                            src={hoverImageUrl}
                                            alt={`${name} hover`}
                                            className="absolute inset-0 m-auto w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{
                                                filter: 'var(--product-filter)',
                                                width: `${normalizedImageScalePct}%`,
                                                height: `${normalizedImageScalePct}%`
                                            }}
                                        />
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-muted-foreground text-xs">
                                    Intet billede
                                </div>
                            )}
                        </div>
                        <div className="flex items-start gap-1.5">
                            <CardTitle className="line-clamp-2 text-base font-semibold leading-tight sm:text-lg">
                                {normalizedName || "Produktnavn"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-1.5">
                            <div className="flex items-start gap-1.5 flex-wrap">
                                {hasPromo ? (
                                    <>
                                        <span className="text-sm text-muted-foreground line-through">
                                            {normalizedOriginalPrice} kr
                                        </span>
                                        <p
                                            className="text-2xl font-extrabold leading-none"
                                            style={{
                                                color: "#0EA5E9",
                                                fontFamily: "'Roboto Mono', sans-serif",
                                            }}
                                        >
                                            {normalizedPromoPrice} kr
                                        </p>
                                        {showSavingsBadge && (
                                            <span className="text-xs font-bold text-white bg-green-500 px-2 py-1 rounded-full animate-pulse">
                                                SPAR {savingsPercent}%
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <p
                                        className="text-2xl font-extrabold leading-none"
                                        style={{
                                            color: "#0EA5E9",
                                            fontFamily: "'Roboto Mono', sans-serif",
                                        }}
                                    >
                                        {displayPriceLabel}
                                    </p>
                                )}
                            </div>
                        </div>
                        {normalizedDescription && (
                            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                                {normalizedDescription}
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className="justify-end gap-2 px-4 pb-4">
                        <Button size="sm" variant="outline" className="pointer-events-none">
                            {actionLabel}
                        </Button>
                    </CardFooter>
                </Card>

                <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Bemærk: Design kan variere lidt afhængigt af skærmstørrelse.
                </p>
            </div >
        </>
    );
}
