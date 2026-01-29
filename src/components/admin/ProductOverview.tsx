import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

import { useNavigate, Link } from "react-router-dom";
import { Package, Trash2, Copy, Search, X, ImageIcon, Building2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveAdminTenant } from "@/lib/adminTenant";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  pricing_type: string;
  is_published: boolean;
  is_available_to_tenants?: boolean;
  image_url?: string | null;
};

type CompanyAccount = {
  id: string;
  name: string;
  logo_url?: string | null;
};

type CompanyHubItem = {
  id: string;
  company_id: string;
  product_id: string;
  title: string;
  sort_order: number;
};

export function ProductOverview() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const { isMasterAdmin: roleIsMasterAdmin } = useUserRole();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Alle");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [companyHubItems, setCompanyHubItems] = useState<CompanyHubItem[]>([]);

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

  useEffect(() => {
    if (roleIsMasterAdmin) {
      setIsMasterAdmin(true);
    }
  }, [roleIsMasterAdmin]);

  useEffect(() => {
    checkMasterAdmin();
    fetchProducts();
    fetchCompanyHubs();
  }, [roleIsMasterAdmin]);

  useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkMasterAdmin = async () => {
    if (roleIsMasterAdmin) {
      setIsMasterAdmin(true);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if user owns the Master tenant
      const { data } = await supabase
        .from('tenants' as any)
        .select('id')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (data) setIsMasterAdmin(true);
    }
  };

  const fetchProducts = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
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

  const fetchCompanyHubs = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const [{ data: accounts }, { data: items }] = await Promise.all([
        supabase.from('company_accounts' as any).select('id, name, logo_url').eq('tenant_id', tenantId),
        supabase.from('company_hub_items' as any).select('id, company_id, product_id, title, sort_order').eq('tenant_id', tenantId).order('sort_order')
      ]);

      setCompanyAccounts(accounts || []);
      setCompanyHubItems(items || []);
    } catch (error) {
      console.error('Error fetching company hubs:', error);
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
      // Delete related data first to avoid foreign key constraints
      // 1. Delete generic prices
      await supabase.from('generic_product_prices').delete().eq('product_id', id);

      // 2. Delete product attribute values
      const { data: groups } = await supabase.from('product_attribute_groups' as any).select('id').eq('product_id', id);
      if (groups && groups.length > 0) {
        const groupIds = groups.map((g: any) => g.id);
        await supabase.from('product_attribute_values' as any).delete().in('group_id', groupIds);
        await supabase.from('product_attribute_groups' as any).delete().eq('product_id', id);
      }

      // 3. Delete product pricing configs
      await supabase.from('product_pricing_configs' as any).delete().eq('product_id', id);

      // 4. Delete company hub items
      await supabase.from('company_hub_items' as any).delete().eq('product_id', id);

      // 4. Now delete the product itself
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Produkt "${name}" slettet`);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(`Kunne ikke slette produkt: ${error.message || 'Ukendt fejl'}`);
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

  // Extract unique categories for filter chips
  const categories = ["Alle", ...Array.from(new Set(products.map(p => p.category || "Øvrige")))];

  // Filter products by search query and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Alle" ||
      (product.category || "Øvrige") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group filtered products by category dynamically
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const category = product.category || 'Ukategoriseret';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Handle search open/close
  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchQuery("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Produktoversigt</h1>
          <p className="text-muted-foreground">Administrer alle produkter og deres priser</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/admin/create-product")}>
            <Package className="mr-2 h-4 w-4" />
            Opret Nyt Produkt
          </Button>
        </div>
      </div>

      {loading ? (
        <div>Henter produkter...</div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar: Category chips + Search */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 hover:bg-muted border-transparent"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Expanding Search Control */}
            <div className="flex items-center">
              <div
                className={`flex items-center overflow-hidden transition-all duration-200 ease-in-out ${searchOpen ? "w-64" : "w-10"
                  }`}
              >
                {searchOpen ? (
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Søg produkter..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-9 pr-8 h-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={handleSearchToggle}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {searchOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={handleSearchToggle}
                >
                  Luk
                </Button>
              )}
            </div>
          </div>

          {/* Products Section */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produkter
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredProducts.length} af {products.length})
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">Administrer dine produkter og priser</p>
            </div>
            <CardContent className="p-0">
              {Object.entries(groupedProducts).length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery || selectedCategory !== "Alle"
                    ? "Ingen produkter matcher din søgning."
                    : "Ingen produkter fundet."}
                </div>
              )}
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <details key={category} className="group" open>
                  <summary className="cursor-pointer px-6 py-3 bg-muted/30 border-b hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize">{category.replace('_', ' ')}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {categoryProducts.length} produkter
                      </span>
                    </div>
                    <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {categoryProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="hover:border-primary transition-colors overflow-hidden"
                      >
                        <CardContent className="p-0">
                          {/* Thumbnail + Name */}
                          <div
                            className="cursor-pointer flex items-center gap-3 p-3 border-b"
                            onClick={() => navigate(`/admin/product/${product.slug}`)}
                          >
                            <div className="w-10 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" title={product.name}>
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {getPricingTypeLabel(product.pricing_type)}
                              </p>
                            </div>
                          </div>

                          {/* Actions Row */}
                          <div className="flex items-center justify-between px-3 py-2">
                            {/* Publish toggle with tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    checked={product.is_published}
                                    onCheckedChange={() => togglePublish(product.id, product.is_published)}
                                    className="scale-90"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {product.is_published ? "Publiceret" : "Ikke publiceret"}
                              </TooltipContent>
                            </Tooltip>

                            <div className="flex items-center gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateProduct(product);
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplikér produkt</TooltipContent>
                              </Tooltip>

                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>Slet produkt</TooltipContent>
                                </Tooltip>
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

                          {/* Release to Tenants Toggle (Master only) */}
                          {isMasterAdmin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-between px-3 py-2 border-t border-dashed bg-blue-50/50">
                                  <span className="text-xs font-medium text-blue-600">
                                    {product.is_available_to_tenants ? 'Frigivet' : 'Privat'}
                                  </span>
                                  <Switch
                                    className="data-[state=checked]:bg-blue-600 scale-90"
                                    checked={!!product.is_available_to_tenants}
                                    onCheckedChange={() => toggleAvailableToTenants(product.id, !!product.is_available_to_tenants)}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {product.is_available_to_tenants
                                  ? "Frigivet til lejere"
                                  : "Kun synlig for Master"
                                }
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>

          {/* Company Hub Section */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 px-6 py-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Hub
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({companyAccounts.length} virksomheder)
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">Produkter tilknyttet virksomheder</p>
            </div>
            <CardContent className="p-0">
              {companyAccounts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Ingen virksomheder oprettet endnu.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate("/admin/companyhub")}
                  >
                    Opret ny virksomhed
                  </Button>
                </div>
              ) : (
                companyAccounts.map((company) => {
                  const hubItems = companyHubItems.filter(item => item.company_id === company.id);
                  const hubProducts = hubItems
                    .map(item => products.find(p => p.id === item.product_id))
                    .filter((p): p is Product => p !== undefined);

                  return (
                    <details key={company.id} className="group">
                      <summary className="cursor-pointer px-6 py-3 bg-muted/30 border-b hover:bg-muted/50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                          <span className="font-semibold">{company.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {hubProducts.length} produkter
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/admin/companyhub");
                            }}
                          >
                            Administrer
                          </Button>
                          <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {hubProducts.length === 0 ? (
                          <div className="col-span-full text-center text-muted-foreground py-4">
                            Ingen produkter tilknyttet denne virksomhed endnu.
                          </div>
                        ) : (
                          hubProducts.map((product) => (
                            <Card
                              key={product.id}
                              className="hover:border-blue-500 transition-colors overflow-hidden cursor-pointer"
                              onClick={() => navigate(`/admin/product/${product.slug}`)}
                            >
                              <CardContent className="p-0">
                                <div className="flex items-center gap-3 p-3">
                                  <div className="w-10 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {product.image_url ? (
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate" title={product.name}>
                                      {product.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {getPricingTypeLabel(product.pricing_type)}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </details>
                  );
                })
              )}
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
    'custom-dimensions': 'Brugerdefinerede dimensioner',
    'MACHINE_PRICED': 'Maskin-beregning (MPA)',
    'STORFORMAT': 'Storformat'
  };
  return labels[type] || type;
}
