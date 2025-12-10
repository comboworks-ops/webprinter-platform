import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { getProductDisplayPrice } from "@/utils/productPriceDisplay";
import { getProductImage } from "@/utils/productImages";
import { Info } from "lucide-react";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
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
}

const ProductGrid = ({ category }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndLoadPrices = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, 
            name, 
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
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndLoadPrices();
  }, []);

  const filteredProducts = products.filter((p) => p.category === category);

  if (loading) {
    return <div className="text-center py-8">Indlæser produkter...</div>;
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          return (
            <Tooltip key={product.id}>
              <TooltipTrigger asChild>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="p-4">
                    <Link to={`/produkt/${product.slug}`} className="block w-full h-48 rounded-lg flex items-center justify-center mb-1 overflow-hidden">
                      <img
                        src={getProductImage(product.slug, product.image_url)}
                        alt={product.name}
                        className="w-full h-full object-contain p-2 transition-transform duration-300 hover:scale-110"
                      />
                    </Link>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {product.tooltip_product && (
                        <Info className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-primary">
                          {product.displayPrice || "Se priser"}
                        </p>
                        {product.tooltip_price && (
                          <Info className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">ex. moms</p>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end gap-2 px-4 pb-4">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/produkt/${product.slug}`}>Priser</Link>
                    </Button>
                  </CardFooter>
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
    </TooltipProvider>
  );
};

export default ProductGrid;
