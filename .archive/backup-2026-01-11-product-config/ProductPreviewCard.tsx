import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { getGoogleFontsUrl } from "./FontSelector";

interface ProductPreviewCardProps {
    name: string;
    priceFrom: string | null;
    description?: string;
    imageUrl?: string | null;
    priceColor?: string;
    priceBgColor?: string;
    priceBgEnabled?: boolean;
    priceFont?: string;
    hoverImageUrl?: string | null;
}

export function ProductPreviewCard({
    name,
    priceFrom,
    description,
    imageUrl,
    priceColor = "#000000",
    priceBgColor = "#FFFFFF",
    priceBgEnabled = false,
    priceFont = "inherit",
    hoverImageUrl
}: ProductPreviewCardProps) {
    const fontUrl = priceFont && priceFont !== 'inherit' ? getGoogleFontsUrl([priceFont]) : '';

    return (
        <>
            {fontUrl && <link rel="stylesheet" href={fontUrl} />}
            <div className="w-full max-w-[300px] mx-auto opacity-100 transition-opacity">
                <div className="mb-2 text-xs font-medium text-muted-foreground text-center uppercase tracking-wider">
                    Preview (Forside)
                </div>

                {/* Mimic ProductGrid.tsx card styles */}
                <Card className="hover:shadow-lg transition-shadow cursor-default overflow-hidden border-2 border-dashed border-primary/20 bg-white">
                    <CardHeader className="p-4">
                        <div className="block w-full h-48 rounded-lg flex items-center justify-center mb-1 overflow-hidden bg-white relative group">
                            {imageUrl ? (
                                <>
                                    <img
                                        src={imageUrl}
                                        alt={name}
                                        className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${hoverImageUrl ? 'group-hover:opacity-0' : ''}`}
                                        style={{ filter: 'var(--product-filter)' }}
                                    />
                                    {hoverImageUrl && (
                                        <img
                                            src={hoverImageUrl}
                                            alt={`${name} hover`}
                                            className="absolute inset-0 w-full h-full object-contain p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ filter: 'var(--product-filter)' }}
                                        />
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-muted-foreground text-xs">
                                    Intet billede
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg truncate">{name || "Produktnavn"}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p
                                    className={`text-2xl font-extrabold ${priceBgEnabled ? 'px-2 py-1 rounded-md' : ''}`}
                                    style={{
                                        color: priceColor,
                                        backgroundColor: priceBgEnabled ? priceBgColor : 'transparent',
                                        fontFamily: priceFont !== 'inherit' ? priceFont : undefined
                                    }}
                                >
                                    {priceFrom ? `Fra ${priceFrom},-` : "Se priser"}
                                </p>
                            </div>
                        </div>


                        {/* Show description in preview even if not in main grid, to let user see "hover" content or list text */}
                        {description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                {description}
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className="justify-end gap-2 px-4 pb-4">
                        <Button size="sm" variant="outline" className="pointer-events-none">
                            Priser
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
