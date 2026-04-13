import { useShopSettings } from "@/hooks/useShopSettings";
import { FlyerAlarmProductCard } from "./FlyerAlarmProductCard";
import { useFlyerAlarmProducts } from "./useFlyerAlarmProducts";
import { Loader2, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Flyer Alarm Product Showcase
 * 
 * VIEW-ONLY DEMO COMPONENT
 * - Displays Flyer Alarm products on homepage
 * - No pricing, no checkout, no purchase functionality
 * - "Contact for quote" button links to contact page
 * - Feature toggle controlled via branding settings
 * 
 * SAFETY: This component is completely isolated from:
 * - Existing product system
 * - Pricing calculations
 * - Checkout flow
 * - Order management
 * 
 * REMOVAL: Simply remove this component from Shop.tsx
 */

export function FlyerAlarmShowcase() {
  // Check if feature is enabled in branding settings
  const { data: settings } = useShopSettings();
  const branding = settings?.branding;
  
  // Feature toggle - OFF by default
  const isEnabled = branding?.pod3?.showOnHomepage === true;
  
  const { products, loading, error } = useFlyerAlarmProducts({
    enabled: isEnabled,
    limit: 3,
    filterWorking: true, // Only show products with working configurators
  });

  // Don't render if feature is disabled
  if (!isEnabled) return null;

  // Don't render if no products loaded
  if (!loading && !error && products.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-orange-50/50 to-transparent">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold">Udvidet sortiment</h2>
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                <Package className="h-3 w-3 mr-1" />
                Demo
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Produkter fra Flyer Alarm PRO - kontakt os for tilbud
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              Powered by Flyer Alarm
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://startnow.flyeralarm.com', '_blank')}
            >
              Se katalog
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="ml-2 text-muted-foreground">Finder tilgængelige produkter...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Kunne ikke hente produkter fra Flyer Alarm</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <FlyerAlarmProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 p-4 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-sm text-orange-800 text-center">
            <strong>Konfigurerbare produkter:</strong> Disse produkter har live prisberegning. 
            Se resten af sortimentet på Flyer Alarm.
            <button 
              onClick={() => window.location.href = '/kontakt'}
              className="underline hover:no-underline ml-1"
            >
              Kontakt os for tilbud
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
