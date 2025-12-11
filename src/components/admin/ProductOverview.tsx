import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Package, Trash2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { VisitorStatsWidget } from "./VisitorStatsWidget";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  pricing_type: string;
  is_published: boolean;
  is_available_to_tenants?: boolean; // New field
};

export function ProductOverview() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    checkMasterAdmin();
    fetchProducts();
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkMasterAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if user owns the Master tenant
      const { data } = await supabase
        .from('tenants' as any)
        .select('id')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .eq('owner_id', user.id)
        .maybeSingle();
      setIsMasterAdmin(!!data);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const { count } = await supabase
        .from('order_messages' as any)
        .select('*', { count: 'exact', head: true })
        .eq('sender_type', 'customer')
        .eq('is_read', false);

      setUnreadMessageCount(count || 0);
    } catch (e) {
      console.debug('Could not fetch unread messages');
    }
  };

  const fetchProducts = async () => {
    try {
      // Get user's tenant ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenant } = await supabase
        .from('tenants' as any)
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!tenant) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', (tenant as any).id)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Kunne ikke hente produkter');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailableToTenants = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available_to_tenants: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(!currentStatus ? 'Produkt frigivet til netværk' : 'Produkt fjernet fra netværk');
      fetchProducts();
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('Kunne ikke opdatere status');
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_published: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Produkt skjult' : 'Produkt publiceret');
      fetchProducts();
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast.error('Kunne ikke opdatere produkt');
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Produkt "${name}" slettet`);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Kunne ikke slette produkt');
    }
  };

  const duplicateProduct = async (product: Product) => {
    try {
      // First fetch full product data
      const { data: fullProduct, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single();

      if (fetchError) throw fetchError;

      // Generate unique slug
      let newSlug = `${product.slug}-kopi`;
      let slugExists = true;
      let counter = 1;

      while (slugExists) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('slug', newSlug)
          .maybeSingle();

        if (!existing) {
          slugExists = false;
        } else {
          counter++;
          newSlug = `${product.slug}-kopi-${counter}`;
        }
      }

      // Create duplicate product
      const { id, created_at, updated_at, created_by, updated_by, ...productData } = fullProduct;
      const { error: insertError } = await supabase
        .from('products')
        .insert({
          ...productData,
          name: `${product.name} (kopi)`,
          slug: newSlug,
          is_published: false,
        });

      if (insertError) throw insertError;

      toast.success(`Produkt duplikeret som "${product.name} (kopi)"`);
      fetchProducts();
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Kunne ikke duplikere produkt');
    }
  };

  const productsByCategory = {
    tryksager: products.filter(p => p.category === "tryksager"),
    storformat: products.filter(p => p.category === "storformat"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Produktoversigt</h1>
          <p className="text-muted-foreground">Administrer alle produkter og deres priser</p>
        </div>
        <div className="flex items-center gap-3">


          <VisitorStatsWidget />
          <Button onClick={() => navigate("/admin/create-product")}>
            <Package className="mr-2 h-4 w-4" />
            Opret Nyt Produkt
          </Button>
        </div>
      </div>

      {loading ? (
        <div>Henter produkter...</div>
      ) : (
        <div className="space-y-8">
          {/* Products Section */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produkter
              </h2>
              <p className="text-sm text-muted-foreground">Administrer dine produkter og priser</p>
            </div>
            <CardContent className="p-0">
              {/* Tryksager - Collapsible */}
              <details className="group" open>
                <summary className="cursor-pointer px-6 py-4 bg-muted/30 border-b hover:bg-muted/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Tryksager</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {productsByCategory.tryksager.length} produkter
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productsByCategory.tryksager.map((product) => (
                    <Card
                      key={product.id}
                      className="hover:border-primary transition-colors p-4"
                    >
                      <CardContent className="p-0 space-y-3">
                        <div
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/product/${product.slug}`)}
                        >
                          <p className="text-sm">
                            <span className="font-medium">{product.name}</span> · Pristype: {getPricingTypeLabel(product.pricing_type)}
                          </p>
                        </div>
                        <div className="pt-2 border-t space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {product.is_published ? 'Publiceret' : 'Kladde'}
                              </span>
                              <Switch
                                checked={product.is_published}
                                onCheckedChange={() => togglePublish(product.id, product.is_published)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateProduct(product);
                                }}
                                title="Duplikér produkt"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Slet produkt</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Er du sikker på at du vil slette "{product.name}"? Denne handling kan ikke fortrydes.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteProduct(product.id, product.name)}
                                    >
                                      Slet
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {/* Release to Tenants Toggle */}
                          {isMasterAdmin && (
                            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                              <span className="text-xs font-medium text-blue-600">
                                {product.is_available_to_tenants ? 'Frigivet til lejere' : 'Privat (Master)'}
                              </span>
                              <Switch
                                className="data-[state=checked]:bg-blue-600"
                                checked={!!product.is_available_to_tenants}
                                onCheckedChange={() => toggleAvailableToTenants(product.id, !!product.is_available_to_tenants)}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </details>

              {/* Storformat - Collapsible */}
              <details className="group">
                <summary className="cursor-pointer px-6 py-4 bg-muted/30 border-b hover:bg-muted/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Storformat</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {productsByCategory.storformat.length} produkter
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productsByCategory.storformat.map((product) => (
                    <Card
                      key={product.id}
                      className="hover:border-primary transition-colors p-4"
                    >
                      <CardContent className="p-0 space-y-3">
                        <div
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/product/${product.slug}`)}
                        >
                          <p className="text-sm">
                            <span className="font-medium">{product.name}</span> · Pristype: {getPricingTypeLabel(product.pricing_type)}
                          </p>
                        </div>
                        <div className="pt-2 border-t space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {product.is_published ? 'Publiceret' : 'Kladde'}
                              </span>
                              <Switch
                                checked={product.is_published}
                                onCheckedChange={() => togglePublish(product.id, product.is_published)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateProduct(product);
                                }}
                                title="Duplikér produkt"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Slet produkt</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Er du sikker på at du vil slette "{product.name}"? Denne handling kan ikke fortrydes.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteProduct(product.id, product.name)}
                                    >
                                      Slet
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {/* Release to Tenants Toggle */}
                          {isMasterAdmin && (
                            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                              <span className="text-xs font-medium text-blue-600">
                                {product.is_available_to_tenants ? 'Frigivet til lejere' : 'Privat (Master)'}
                              </span>
                              <Switch
                                className="data-[state=checked]:bg-blue-600"
                                checked={!!product.is_available_to_tenants}
                                onCheckedChange={() => toggleAvailableToTenants(product.id, !!product.is_available_to_tenants)}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>

          {/* SEO & Marketing Section */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 px-6 py-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                🔍 SEO & Marketing
              </h2>
              <p className="text-sm text-muted-foreground">Optimer din synlighed i søgemaskiner</p>
            </div>
            <CardContent className="p-6">
              <Card
                className="p-4 hover:border-primary transition-colors cursor-pointer max-w-md"
                onClick={() => navigate('/admin/seo')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-xl">
                    🌐
                  </div>
                  <div>
                    <p className="font-medium">SEO Manager</p>
                    <p className="text-sm text-muted-foreground">Rediger meta titler, beskrivelser og billeder</p>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function getPricingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'matrix': 'Matrix',
    'rate': 'Takst',
    'formula': 'Formel',
    'fixed': 'Fast pris',
    'custom-dimensions': 'Brugerdefinerede dimensioner'
  };
  return labels[type] || type;
}
