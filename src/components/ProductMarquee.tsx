import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

interface Product {
    id: string;
    name: string;
    image_url: string | null;
}

export function ProductMarquee() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            // Fetch products from Master Tenant to show system capabilities
            const { data } = await supabase
                .from("products" as any)
                .select("id, name, image_url")
                .eq("tenant_id", "00000000-0000-0000-0000-000000000000") // Master Tenant
                .eq("is_published", true);

            if (data) {
                setProducts(data as any[]);
            }
            setLoading(false);
        };

        fetchProducts();
    }, []);

    if (loading || products.length === 0) return null;

    // Duplicate list for seamless loop
    const displayProducts = [...products, ...products, ...products];

    return (
        <div className="w-full overflow-hidden py-0 mb-12">
            <div className="flex animate-marquee hover:animate-marquee-pause w-max">
                {displayProducts.map((product, index) => (
                    <div
                        key={`${product.id}-${index}`}
                        className="flex flex-col items-center justify-center mx-12 w-40 group"
                    >
                        <div className="w-24 h-24 mb-2 flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
                            {product.image_url ? (
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-contain drop-shadow-sm"
                                />
                            ) : (
                                <Package className="w-16 h-16 text-primary/40" />
                            )}
                        </div>
                        <span className="text-lg font-medium text-muted-foreground whitespace-nowrap group-hover:text-primary transition-colors">
                            {product.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
