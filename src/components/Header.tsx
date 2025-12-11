import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Search, ChevronDown, LogOut, User, Shield, Languages, Package, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useShopSettings } from "@/hooks/useShopSettings";
import { WebprinterLogo } from "@/components/WebprinterLogo";

interface DbProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  category: 'tryksager' | 'storformat';
}

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [allProducts, setAllProducts] = useState<DbProduct[]>([]);
  const location = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { language, setLanguage, t } = useLanguage();

  // Use centralized settings hook
  const settings = useShopSettings();
  const tenantName = settings.data?.tenant_name || "Webprinter.dk";
  const tenantId = settings.data?.id || '00000000-0000-0000-0000-000000000000'; // Default to Master

  const navItems = [
    { label: t("home"), path: "/" },
    // Show "Shop Demo" only if fallback/master? Or just hide it for tenants?
    // For now keep it if not production tenant?
    // Let's hide it for specific tenants
    ...(settings.data?.id !== '00000000-0000-0000-0000-000000000000' && settings.data?.id ? [] : [{ label: "Shop Demo", path: "/shop" }]),
    { label: t("contact"), path: "/kontakt" },
    { label: t("about"), path: "/om-os" },
  ];

  useEffect(() => {
    // Fetch published products from database based on RESOLVED TENANT ID
    async function fetchProducts() {
      if (settings.isLoading) return;

      const { data } = await supabase
        .from('products')
        .select('id, name, slug, image_url, category')
        .eq('is_published', true)
        .eq('tenant_id', tenantId) // Filter by resolved tenant ID (Domain or User or Master)
        .order('category', { ascending: true })
        .order('name');

      if (data) {
        setAllProducts(data as DbProduct[]);
      }
    }
    fetchProducts();
  }, [tenantId, settings.isLoading]); // Re-run when tenantId changes

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: t("error"),
        description: t("failedToLoad"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("success"),
        description: t("loggedOut"),
      });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-card shadow-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="hover:opacity-90 transition-opacity">
            {settings.data?.id === '00000000-0000-0000-0000-000000000000' ? (
              <WebprinterLogo />
            ) : settings.data?.branding?.logo_url ? (
              <img
                src={settings.data.branding.logo_url}
                alt={tenantName}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <span className="text-xl md:text-2xl font-heading font-bold text-primary">
                {tenantName}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {/* Home link */}
            <Link
              to="/"
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive("/") ? "text-primary" : "text-foreground"
                }`}
            >
              {t("home")}
            </Link>

            {/* Products Dropdown - right after Home */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`text-sm font-medium transition-colors hover:text-primary inline-flex items-center gap-1 ${location.pathname.startsWith("/produkt") ? "text-primary" : "text-foreground"
                    }`}
                >
                  {t("products")}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="bg-card/95 backdrop-blur-sm z-50 border shadow-xl min-w-[600px] max-w-4xl p-4 animate-in fade-in-0 slide-in-from-top-2 duration-200"
              >
                {/* Tryksager Section */}
                {allProducts.filter(p => p.category === 'tryksager').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Tryksager</h3>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${Math.ceil(allProducts.filter(p => p.category === 'tryksager').length / 2)}, 1fr)`,
                        gridTemplateRows: 'repeat(2, 1fr)'
                      }}
                    >
                      {allProducts.filter(p => p.category === 'tryksager').map((product) => (
                        <DropdownMenuItem key={product.id} asChild>
                          <Link
                            to={`/produkt/${product.slug}`}
                            className="cursor-pointer flex flex-col items-center gap-2 p-3 hover:bg-accent/50 transition-all hover:scale-105"
                          >
                            {product.image_url && (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-14 h-14 object-contain"
                              />
                            )}
                            <span className="text-xs text-center">{product.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                )}

                {/* Størrelse Print Section */}
                {allProducts.filter(p => p.category === 'storformat').length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Storformat print</h3>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${Math.ceil(allProducts.filter(p => p.category === 'storformat').length / 2)}, 1fr)`,
                        gridTemplateRows: 'repeat(2, 1fr)'
                      }}
                    >
                      {allProducts.filter(p => p.category === 'storformat').map((product) => (
                        <DropdownMenuItem key={product.id} asChild>
                          <Link
                            to={`/produkt/${product.slug}`}
                            className="cursor-pointer flex flex-col items-center gap-2 p-3 hover:bg-accent/50 transition-all hover:scale-105"
                          >
                            {product.image_url && (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-14 h-14 object-contain"
                              />
                            )}
                            <span className="text-xs text-center">{product.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Other nav items (contact, about) */}
            {navItems.filter(item => item.path !== "/").map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${isActive(item.path) ? "text-primary" : "text-foreground"
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Search className="h-5 w-5" />
            </Button>

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 bg-card z-50">
                <DropdownMenuItem
                  onClick={() => setLanguage("da")}
                  className={language === "da" ? "bg-muted" : ""}
                >
                  Dansk
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage("en")}
                  className={language === "en" ? "bg-muted" : ""}
                >
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button asChild className="hidden md:flex">
              <Link to="/kontakt">{t("orderNow")}</Link>
            </Button>

            {/* Auth Buttons - Desktop */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {user.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card">
                  <DropdownMenuItem asChild>
                    <Link to="/min-konto" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Min Konto
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/min-konto/ordrer" className="cursor-pointer">
                      <Package className="h-4 w-4 mr-2" />
                      Mine Ordrer
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/min-konto/adresser" className="cursor-pointer">
                      <MapPin className="h-4 w-4 mr-2" />
                      Adresser
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <Shield className="h-4 w-4 mr-2" />
                          {t("adminPanel")}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth">{t("login")}</Link>
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-border">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-3 text-base font-medium transition-colors hover:text-primary ${isActive(item.path) ? "text-primary" : "text-foreground"
                  }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile Products Section */}
            <div className="py-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">{t("products")}</p>
              {allProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/produkt/${product.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-2 pl-4 text-base transition-colors hover:text-primary"
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  {product.name}
                </Link>
              ))}
            </div>

            {/* Language Switcher Mobile */}
            <div className="py-3 border-t border-border">
              <p className="text-sm font-semibold text-muted-foreground mb-2">
                <Languages className="h-4 w-4 inline mr-2" />
                Sprog / Language
              </p>
              <Button
                variant={language === "da" ? "secondary" : "ghost"}
                className="w-full justify-start mb-2"
                onClick={() => setLanguage("da")}
              >
                Dansk
              </Button>
              <Button
                variant={language === "en" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setLanguage("en")}
              >
                English
              </Button>
            </div>

            <Button asChild className="w-full mt-4">
              <Link to="/kontakt" onClick={() => setMobileMenuOpen(false)}>
                {t("orderNow")}
              </Link>
            </Button>

            {/* Auth Buttons - Mobile */}
            {user ? (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {user.email}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link to="/min-konto" onClick={() => setMobileMenuOpen(false)}>
                    <User className="h-4 w-4 mr-2" />
                    Min Konto
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link to="/min-konto/ordrer" onClick={() => setMobileMenuOpen(false)}>
                    <Package className="h-4 w-4 mr-2" />
                    Mine Ordrer
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link to="/min-konto/adresser" onClick={() => setMobileMenuOpen(false)}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Adresser
                  </Link>
                </Button>
                {isAdmin && (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                  >
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Shield className="h-4 w-4 mr-2" />
                      {t("adminPanel")}
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("logout")}
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  {t("login")}
                </Link>
              </Button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
