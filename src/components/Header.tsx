import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Search, ChevronDown, LogOut, User, Shield, Package, MapPin } from "lucide-react";
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
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
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

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Scroll state for header behaviors
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  // Use centralized settings hook
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const tenantName = settings.data?.tenant_name || "Webprinter.dk";
  const tenantId = settings.data?.id || '00000000-0000-0000-0000-000000000000'; // Default to Master

  // Get header branding settings - prioritize preview branding if in preview mode
  const rawHeader = isPreviewMode && previewBranding?.header
    ? previewBranding.header
    : settings.data?.branding?.header;

  // Deep merge with defaults to prevent crashes on partial data
  const headerSettings = {
    fontId: 'Inter',
    bgColor: '#FFFFFF',
    bgOpacity: 0.8, // 80% opacity = 20% transparent, allowing hero to show through
    textColor: '#1F2937',
    autoContrastText: true,
    dropdownMode: 'IMAGE_AND_TEXT' as const,
    transparentOverHero: true, // Default to true for standard template
    ...rawHeader,
    scroll: {
      sticky: true,
      hideOnScroll: false,
      fadeOnScroll: false,
      heightPx: 80,
      ...rawHeader?.scroll,
    },
    // Ensure navItems exists (fallback to defaults if missing)
    navItems: rawHeader?.navItems || [
      { id: 'home', label: t("home"), href: "/", isVisible: true, order: 0 },
      { id: 'products', label: t("products"), href: "/produkter", isVisible: true, order: 1 },
      { id: 'grafisk', label: 'Grafisk vejledning', href: "/grafisk-vejledning", isVisible: true, order: 2 },
      { id: 'contact', label: t("contact"), href: "/kontakt", isVisible: true, order: 3 },
      { id: 'about', label: t("about"), href: "/om-os", isVisible: true, order: 4 },
    ]
  };

  // Handle scroll behaviors
  useEffect(() => {
    if (!headerSettings.scroll.sticky && !headerSettings.transparentOverHero) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';

      setScrollY(currentScrollY);
      setScrollDirection(direction);

      // Hide on scroll down / show on scroll up
      if (headerSettings.scroll.hideOnScroll) {
        if (direction === 'down' && currentScrollY > 100) {
          setIsVisible(false);
        } else if (direction === 'up') {
          setIsVisible(true);
        }
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headerSettings.scroll.sticky, headerSettings.scroll.hideOnScroll, headerSettings.transparentOverHero]);

  // Calculate header styles based on scroll
  // Consider all shop frontpage variants as "homepage" (they all have hero banners)
  // Treat preview routes like the storefront so sticky/transparent behavior matches what customers see
  const homePaths = ['/', '/shop', '/produkter', '/local-tenant', '/prisberegner', '/preview-shop'];
  const isHome = homePaths.includes(location.pathname);
  // Check if we should be transparent over hero (only at top of homepage)
  // Auto-enable overlay if transparentOverHero is set OR if background is not fully opaque
  // At top of page = transparent overlay, after scroll = solid background
  const isAtTop = scrollY < 20;
  const isTransparent = (headerSettings.transparentOverHero || headerSettings.bgOpacity < 0.99) && isHome && isAtTop;

  // Use White text if overlay is mostly transparent (assuming dark hero), otherwise standard text
  const effectiveTextColor = (isTransparent && headerSettings.bgOpacity < 0.6) ? '#FFFFFF' : headerSettings.textColor;

  const getHeaderStyles = useCallback(() => {
    const styles: React.CSSProperties = {};
    const { scroll, bgColor, bgOpacity } = headerSettings;

    const r = parseInt(bgColor.slice(1, 3), 16) || 255;
    const g = parseInt(bgColor.slice(3, 5), 16) || 255;
    const b = parseInt(bgColor.slice(5, 7), 16) || 255;

    // On hero pages, use fixed positioning to prevent layout shifts
    // BUT only if sticky is enabled. If not sticky, it should just be at the top (absolute over hero)
    if (isHome) {
      if (headerSettings.scroll.sticky) {
        styles.position = 'fixed';
        styles.top = 0;
        styles.left = 0;
        styles.right = 0;
        styles.zIndex = 50;
      } else {
        // Non-sticky on home: Absolute position to sit on top of hero, but scroll away
        styles.position = 'absolute';
        styles.top = 0;
        styles.left = 0;
        styles.right = 0;
        styles.zIndex = 50;
        // Ensure it has background if we scroll past (though unrelated if absolute)
      }
    }

    // Smooth opacity transition based on scroll
    let opacity = bgOpacity;
    if (isHome) {
      // On hero pages: always use configured opacity (keeps transparency on scroll)
      opacity = bgOpacity;

      // No shadow/border when transparent to maintain clean look
      if (opacity < 0.95) {
        styles.boxShadow = 'none';
        styles.borderBottom = 'none';
      } else {
        styles.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        styles.borderBottom = '1px solid rgba(0,0,0,0.1)';
      }
    } else {
      // Non-hero pages: standard behavior with border
      styles.borderBottom = '1px solid rgba(0,0,0,0.1)';
      styles.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      if (scroll.fadeOnScroll && scrollY > 0) {
        const fadeAmount = Math.min(scrollY / 200, 0.3);
        opacity = Math.max(bgOpacity - fadeAmount, 0.7);
      }
    }

    styles.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    styles.height = `${scroll.heightPx}px`;

    // Hide on scroll transform
    if (scroll.hideOnScroll && !isVisible) {
      styles.transform = 'translateY(-100%)';
    } else {
      styles.transform = 'translateY(0)';
    }

    return styles;
  }, [headerSettings, scrollY, isVisible, isHome, isAtTop]);

  // Calculate dropdown background styles
  const getDropdownStyles = useCallback((): React.CSSProperties => {
    const bgColor = headerSettings.dropdownBgColor || '#FFFFFF';
    const opacity = headerSettings.dropdownBgOpacity ?? 0.95;

    const r = parseInt(bgColor.slice(1, 3), 16) || 255;
    const g = parseInt(bgColor.slice(3, 5), 16) || 255;
    const b = parseInt(bgColor.slice(5, 7), 16) || 255;

    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
    };
  }, [headerSettings.dropdownBgColor, headerSettings.dropdownBgOpacity]);

  // Build position class - Ensure it reacts to sticky changes
  // When isHome is true, we use manual styles (fixed/absolute). 
  // When isHome is false, we try to use Tailwind classes, but we should make sure they update.
  const positionClass = isHome ? '' : (headerSettings.scroll.sticky ? 'sticky top-0' : 'relative');

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

      const { data } = await (supabase
        .from('products') as any)
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

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the search area
      if (searchOpen && !target.closest('.search-container')) {
        handleSearchClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen]);

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

  // Search functionality
  const filteredProducts = allProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSearchToggle = () => {
    setSearchOpen(!searchOpen);
    setSearchQuery('');
    // Focus input when opening
    if (!searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  };

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Build position class - let inline styles control position for hero pages
  // const positionClass = isHome ? '' : (headerSettings.scroll.sticky ? 'sticky top-0' : 'relative');
  // MOVED UP to avoid re-declaration

  return (
    <header
      ref={headerRef}
      className={`${positionClass} z-50 transition-all duration-300 ease-in-out`}
      style={{
        ...getHeaderStyles(),
        fontFamily: `'${headerSettings.fontId}', sans-serif`,
      }}
    >
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo - with improved auto-fit/scale */}
          <Link to="/" className="hover:opacity-90 transition-opacity flex items-center">
            {settings.data?.id === '00000000-0000-0000-0000-000000000000' ? (
              <WebprinterLogo />
            ) : (isPreviewMode && previewBranding?.logo_url) ? (
              <img
                src={previewBranding.logo_url}
                alt={tenantName}
                className="h-10 w-auto max-w-[180px] object-contain"
                style={{
                  maxHeight: `${headerSettings.scroll.heightPx - 16}px`,
                }}
              />
            ) : (isPreviewMode && headerSettings.logoImageUrl) ? (
              <img
                src={headerSettings.logoImageUrl}
                alt={tenantName}
                className="h-10 w-auto max-w-[180px] object-contain"
                style={{
                  maxHeight: `${headerSettings.scroll.heightPx - 16}px`,
                }}
              />
            ) : settings.data?.branding?.logo_url ? (
              <img
                src={settings.data.branding.logo_url}
                alt={tenantName}
                className="h-10 w-auto max-w-[180px] object-contain"
                style={{
                  maxHeight: `${headerSettings.scroll.heightPx - 16}px`,
                }}
              />
            ) : (
              <span className="text-xl md:text-2xl font-heading font-bold" style={{ color: effectiveTextColor }}>
                {tenantName}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {headerSettings.navItems
              .filter(item => item.isVisible)
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const isProductLink = item.href === '/produkter' || item.href === '/shop';

                if (isProductLink) {
                  return (
                    <DropdownMenu key={item.id}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`text-sm font-medium transition-colors hover:text-primary inline-flex items-center gap-1 ${location.pathname.startsWith("/produkt") ? "text-primary" : "text-foreground"
                            }`}
                          style={{
                            color: location.pathname.startsWith("/produkt") ? undefined : effectiveTextColor
                          }}
                        >
                          {item.label}
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={`backdrop-blur-sm z-50 border shadow-xl ${(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT')
                          ? 'min-w-[600px] max-w-4xl p-4'
                          : 'min-w-[200px] p-2'
                          } animate-in fade-in-0 slide-in-from-top-2 duration-200`}
                        style={getDropdownStyles()}
                      >
                        {/* Tryksager Section */}
                        {allProducts.filter(p => (p.category as string) === 'tryksager').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-6' : 'mb-2'}>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">Tryksager</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div
                                className="grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.ceil(allProducts.filter(p => (p.category as string) === 'tryksager').length / 2)}, 1fr)`,
                                  gridTemplateRows: 'repeat(2, 1fr)'
                                }}
                              >
                                {allProducts.filter(p => (p.category as string) === 'tryksager').map((product) => (
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
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center">{product.name}</span>
                                      )}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                {allProducts.filter(p => (p.category as string) === 'tryksager').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors rounded"
                                    >
                                      {product.name}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Storformat Section */}
                        {allProducts.filter(p => (p.category as string) === 'storformat').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-6' : 'mb-2'}>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">Storformat</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div
                                className="grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.ceil(allProducts.filter(p => (p.category as string) === 'storformat').length / 2)}, 1fr)`,
                                  gridTemplateRows: 'repeat(2, 1fr)'
                                }}
                              >
                                {allProducts.filter(p => (p.category as string) === 'storformat').map((product) => (
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
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center">{product.name}</span>
                                      )}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                {allProducts.filter(p => (p.category as string) === 'storformat').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors rounded"
                                    >
                                      {product.name}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tekstil Section */}
                        {allProducts.filter(p => (p.category as string) === 'tekstiltryk').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-6' : 'mb-2'}>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">Tøj & Tekstil</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div
                                className="grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.ceil(allProducts.filter(p => (p.category as string) === 'tekstiltryk').length / 2)}, 1fr)`,
                                  gridTemplateRows: 'repeat(2, 1fr)'
                                }}
                              >
                                {allProducts.filter(p => (p.category as string) === 'tekstiltryk').map((product) => (
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
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center">{product.name}</span>
                                      )}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                {allProducts.filter(p => (p.category as string) === 'tekstiltryk').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors rounded"
                                    >
                                      {product.name}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className={`text-sm font-medium transition-colors hover:text-primary ${isActive(item.href) ? "text-primary" : "text-foreground"
                      }`}
                    style={{
                      color: isActive(item.href) ? undefined : effectiveTextColor
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Animated Search Bar */}
            <div className="hidden md:flex items-center relative search-container">
              {/* Search Input - Animated */}
              <div
                className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out ${searchOpen
                  ? 'w-64 opacity-100 mr-2'
                  : 'w-0 opacity-0'
                  }`}
              >
                <div className="relative w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Søg produkter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleSearchClose();
                    }}
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-border bg-background/80 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    style={{ color: '#1F2937' }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results Dropdown */}
              {searchOpen && searchQuery && (
                <div className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-card rounded-lg shadow-lg border border-border z-50">
                  {filteredProducts.length > 0 ? (
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        {filteredProducts.length} produkt{filteredProducts.length !== 1 ? 'er' : ''} fundet
                      </p>
                      {filteredProducts.map((product) => (
                        <Link
                          key={product.id}
                          to={`/produkt/${product.slug}`}
                          onClick={handleSearchClose}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                        >
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Ingen produkter fundet for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}

              {/* Search Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSearchToggle}
                style={{ color: effectiveTextColor }}
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </Button>
            </div>

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex" style={{ color: effectiveTextColor }}>
                  {/* Danish Flag (Dannebrog) or current language flag */}
                  {language === 'da' ? (
                    <svg className="h-5 w-5 rounded-sm" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="20" height="14" fill="#C8102E" />
                      <rect x="6" width="2" height="14" fill="white" />
                      <rect y="6" width="20" height="2" fill="white" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 rounded-sm" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="20" height="14" fill="#012169" />
                      <path d="M0 0L20 14M20 0L0 14" stroke="white" strokeWidth="2.5" />
                      <path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.5" />
                      <path d="M10 0V14M0 7H20" stroke="white" strokeWidth="4" />
                      <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2" />
                    </svg>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 bg-card z-50">
                <DropdownMenuItem
                  onClick={() => setLanguage("da")}
                  className={`flex items-center gap-2 ${language === "da" ? "bg-muted" : ""}`}
                >
                  <svg className="h-4 w-4 rounded-sm shrink-0" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="20" height="14" fill="#C8102E" />
                    <rect x="6" width="2" height="14" fill="white" />
                    <rect y="6" width="20" height="2" fill="white" />
                  </svg>
                  Dansk
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage("en")}
                  className={`flex items-center gap-2 ${language === "en" ? "bg-muted" : ""}`}
                >
                  <svg className="h-4 w-4 rounded-sm shrink-0" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="20" height="14" fill="#012169" />
                    <path d="M0 0L20 14M20 0L0 14" stroke="white" strokeWidth="2.5" />
                    <path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.5" />
                    <path d="M10 0V14M0 7H20" stroke="white" strokeWidth="4" />
                    <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2" />
                  </svg>
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
                  <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2" style={{ color: effectiveTextColor }}>
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
              <Button asChild variant="outline" size="sm" style={{ color: effectiveTextColor, borderColor: effectiveTextColor }}>
                <Link to="/auth">{t("login")}</Link>
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              style={{ color: effectiveTextColor }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-border bg-background">
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
              <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <svg className="h-4 w-4 rounded-sm" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="20" height="14" fill="#C8102E" />
                  <rect x="6" width="2" height="14" fill="white" />
                  <rect y="6" width="20" height="2" fill="white" />
                </svg>
                Sprog / Language
              </p>
              <Button
                variant={language === "da" ? "secondary" : "ghost"}
                className="w-full justify-start mb-2 gap-2"
                onClick={() => setLanguage("da")}
              >
                <svg className="h-4 w-4 rounded-sm shrink-0" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="20" height="14" fill="#C8102E" />
                  <rect x="6" width="2" height="14" fill="white" />
                  <rect y="6" width="20" height="2" fill="white" />
                </svg>
                Dansk
              </Button>
              <Button
                variant={language === "en" ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setLanguage("en")}
              >
                <svg className="h-4 w-4 rounded-sm shrink-0" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="20" height="14" fill="#012169" />
                  <path d="M0 0L20 14M20 0L0 14" stroke="white" strokeWidth="2.5" />
                  <path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.5" />
                  <path d="M10 0V14M0 7H20" stroke="white" strokeWidth="4" />
                  <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2" />
                </svg>
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
