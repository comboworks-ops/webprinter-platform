import { useState } from "react";
import { HubItem, CompanyAccount } from "./types";
import { useCompanyHub } from "@/hooks/useCompanyHub";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Loader2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CompanyHubGrid({ company }: { company: CompanyAccount }) {
    const navigate = useNavigate();
    const { hubItemsQuery } = useCompanyHub(company.tenant_id);
    const { data: items, isLoading } = hubItemsQuery(company.id);

    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const handleBuy = (item: HubItem) => {
        const qty = quantities[item.id] || item.default_quantity;

        // Navigate to existing checkout configuration
        // We pass minimal required state. FileUploadConfiguration will fetch the product details.
        navigate("/checkout/konfigurer", {
            state: {
                productId: item.product_id,
                quantity: qty,
                productSlug: item.product_slug,
                productName: item.product_name,
                optionSelections: item.default_options || {},
                selectedVariant: item.variant_id, // Or name if available
                designId: item.design_id,
                // Since we don't calculate price here, we pass 0 or a placeholder.
                // The user will see the price in the configuration step or checkout.
                productPrice: 0,
                totalPrice: 0,
                summary: item.title,
                shippingSelected: "standard",
                shippingCost: 0
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="text-center p-12 bg-muted/20 rounded-lg border border-dashed">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Ingen produkter tilgængelige</h3>
                <p className="text-sm text-muted-foreground">Der er endnu ikke tilføjet produkter til jeres hub.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
                <Card key={item.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="aspect-video relative bg-muted flex items-center justify-center border-b">
                        {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt={item.title} className="object-cover w-full h-full" />
                        ) : (
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                        )}
                    </div>
                    <CardHeader className="p-4">
                        <CardTitle className="text-base font-bold line-clamp-1">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex-1">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-medium">Produkt:</span>
                                <span className="text-foreground">{item.product_name || "Tryksag"}</span>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Antal</label>
                                <Input
                                    type="number"
                                    value={quantities[item.id] ?? item.default_quantity}
                                    onChange={(e) => setQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                        <Button className="w-full gap-2" onClick={() => handleBuy(item)}>
                            <ShoppingCart className="h-4 w-4" />
                            Bestil nu
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
