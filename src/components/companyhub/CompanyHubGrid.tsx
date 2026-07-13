import { HubItem, CompanyAccount } from "./types";
import { useCompanyHub } from "@/hooks/useCompanyHub";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CompanyHubGrid({ company }: { company: CompanyAccount }) {
    const navigate = useNavigate();
    const { hubItemsQuery } = useCompanyHub(company.tenant_id);
    const { data: items, isLoading } = hubItemsQuery(company.id);

    const handleBuy = (item: HubItem) => {
        if (!item.product_slug) return;
        const tenantQuery = typeof window !== "undefined" ? window.location.search : "";
        navigate(`/produkt/${encodeURIComponent(item.product_slug)}${tenantQuery}`, {
            state: {
                companyId: company.id,
                companyCatalogItemId: item.id,
                companyDefaultQuantity: item.default_quantity,
                companyDefaultOptions: item.default_options || {},
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
                            <p className="text-xs text-muted-foreground">
                                Antal og pris vælges på produktsiden.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                        <Button className="w-full gap-2" onClick={() => handleBuy(item)} disabled={!item.product_slug}>
                            <ShoppingCart className="h-4 w-4" />
                            Vælg og bestil
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
