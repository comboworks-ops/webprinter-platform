import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  icon_text?: string | null;
  slug: string;
  image_url: string | null;
  category: 'tryksager' | 'storformat';
}

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [allProducts, setAllProducts] = useState<DbProduct[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
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

  // Track which menu item is selected (clicked)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  // Use centralized settings hook
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const tenantName = settings.data?.tenant_name || "Webprinter.dk";
  // Don't fallback to master - wait for settings to resolve the correct tenant
  const tenantId = settings.data?.id;

  // Get header branding settings - prioritize preview branding if in preview mode
  const rawHeader = isPreviewMode && previewBranding?.header
    ? previewBranding.header
    : settings.data?.branding?.header;

  // Map height setting (sm/md/lg) to pixel values
  const heightMap: Record<string, number> = {
    'sm': 56,
    'md': 72,
    'lg': 96,
  };

  // Deep merge with defaults to prevent crashes on partial data
  const headerSettings = {
    fontId: 'Inter',
    height: 'md' as const, // sm | md | lg
    bgColor: '#FFFFFF',
    bgOpacity: 0.95, // 95% opacity - shows color clearly while allowing slight transparency
    textColor: '#1F2937',
    hoverTextColor: '#0EA5E9',
    activeTextColor: '#0284C7',
    actionHoverTextColor: '#0EA5E9',
    actionHoverBgColor: 'rgba(0,0,0,0.05)',
    autoContrastText: true,
    dropdownMode: 'IMAGE_AND_TEXT' as const,
    dropdownImageSize: 'normal' as const,  // Size of product images in dropdown (normal, large, xl)
    transparentOverHero: true, // Default to true for standard template
    // Logo defaults
    logoType: 'text' as const,
    logoText: 'WebPrinter',
    logoFont: 'Poppins',
    logoTextColor: '#1F2937',
    logoImageUrl: null as string | null,
    ...rawHeader,
    scroll: {
      sticky: true,
      hideOnScroll: false,
      fadeOnScroll: false,
      ...rawHeader?.scroll,
      // Calculate heightPx from height setting (must be after spread to override)
      heightPx: heightMap[rawHeader?.height || 'md'] || 72,
    },
    cta: {
      enabled: false,
      label: 'Kontakt os',
      href: '/kontakt',
      bgColor: '#0EA5E9',
      textColor: '#FFFFFF',
      hoverBgColor: '#0284C7',
      ...rawHeader?.cta,
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

  // Always use the configured text color
  const effectiveTextColor = headerSettings.textColor;

  const getHeaderStyles = useCallback(() => {
    const styles: React.CSSProperties = {};
    const { scroll, bgColor, bgOpacity } = headerSettings;

    const r = parseInt(bgColor.slice(1, 3), 16) || 255;
    const g = parseInt(bgColor.slice(3, 5), 16) || 255;
    const b = parseInt(bgColor.slice(5, 7), 16) || 255;

    // Position logic based on transparentOverHero and sticky settings
    if (isHome && headerSettings.transparentOverHero) {
      // Transparent over hero: float on top of hero
      if (headerSettings.scroll.sticky) {
        styles.position = 'fixed';
        styles.top = 0;
        styles.left = 0;
        styles.right = 0;
        styles.zIndex = 50;
      } else {
        // Non-sticky but transparent: absolute position over hero, scrolls away
        styles.position = 'absolute';
        styles.top = 0;
        styles.left = 0;
        styles.right = 0;
        styles.zIndex = 50;
      }
    } else if (headerSettings.scroll.sticky) {
      // Not transparent over hero OR not on home - use sticky positioning
      styles.position = 'sticky';
      styles.top = 0;
      styles.zIndex = 50;
    }
    // Else: normal flow (relative) - header sits above content

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
      '--dropdown-hover-bg': headerSettings.dropdownHoverColor || '#F3F4F6',
    } as React.CSSProperties;
  }, [headerSettings.dropdownBgColor, headerSettings.dropdownBgOpacity, headerSettings.dropdownHoverColor]);

  // Dropdown styling variables for direct use in child elements
  const categoryFont = headerSettings.dropdownCategoryFontId || 'Inter';
  const categoryColor = headerSettings.dropdownCategoryColor || '#6B7280';
  const productFont = headerSettings.dropdownProductFontId || 'Inter';
  const productColor = headerSettings.dropdownProductColor || '#1F2937';

  // Dropdown image size mapping (normal = 56px, large = 80px, xl = 112px)
  const dropdownImageSizeMap = {
    normal: 'w-14 h-14',   // 56px
    large: 'w-20 h-20',    // 80px
    xl: 'w-28 h-28',       // 112px
  };
  const dropdownImageClass = dropdownImageSizeMap[headerSettings.dropdownImageSize || 'normal'] || 'w-14 h-14';

  // Build position class - Ensure it reacts to sticky changes
  // When isHome is true, we use manual styles (fixed/absolute). 
  // When isHome is false, we try to use Tailwind classes, but we should make sure they update.
  const positionClass = isHome ? '' : (headerSettings.scroll.sticky ? 'sticky top-0' : 'relative');
  const getProductLabel = (product: DbProduct) => product.icon_text || product.name;

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
      // Wait for settings to fully load and provide a valid tenant ID
      if (settings.isLoading || !tenantId) return;

      const { data } = await (supabase
        .from('products') as any)
        .select('id, name, icon_text, slug, image_url, category')
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

  const handleNavClick = useCallback((href: string, id: string) => (e: React.MouseEvent) => {
    // Force navigation to work even if the current page is in a bad render loop
    e.preventDefault();
    setSelectedMenuId(id);
    if (location.pathname === href) return;
    try {
      navigate(href);
    } catch {
      window.location.assign(href);
    }
  }, [location.pathname, navigate]);

  // Search functionality
  const filteredProducts = allProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.icon_text || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      data-branding-id="header"
      className={`${positionClass} z-[1000] transition-all duration-300 ease-in-out`}
      style={{
        ...getHeaderStyles(),
        zIndex: 1000,
        fontFamily: `'${headerSettings.fontId}', sans-serif`,
        '--header-text-color': effectiveTextColor,
        '--header-hover-color': headerSettings.hoverTextColor || '#0EA5E9',
        '--header-active-color': headerSettings.activeTextColor || '#0284C7',
        '--header-action-hover-text': headerSettings.actionHoverTextColor || '#0EA5E9',
        '--header-action-hover-bg': headerSettings.actionHoverBgColor || 'rgba(0,0,0,0.05)',
        '--dropdown-hover-bg': headerSettings.dropdownHoverColor || '#F3F4F6',
        '--header-cta-bg': headerSettings.cta.bgColor || '#0EA5E9',
        '--header-cta-hover': headerSettings.cta.hoverBgColor || '#0284C7',
      } as React.CSSProperties}
    >
      {/* Dynamic styles for hover/active states using CSS custom properties */}
      <style>{`
        .header-nav-link {
          color: var(--header-text-color) !important;
          transition: color 0.15s ease-in-out;
        }
        .header-nav-link:hover:not(.active) {
          color: var(--header-hover-color) !important;
        }
        .header-nav-link.active,
        .header-nav-link.active:hover {
          color: var(--header-active-color) !important;
        }
        .header-action-link {
          color: var(--header-text-color) !important;
          transition: all 0.2s ease-in-out;
          border-radius: 9999px;
        }
        .header-action-link:hover {
          color: var(--header-action-hover-text) !important;
          background-color: var(--header-action-hover-bg) !important;
        }
        /* Custom hover/selection color for dropdown items - target focus and data-highlighted for Radix UI */
        .dropdown-product-link:hover,
        .dropdown-product-link:focus,
        .dropdown-product-link[data-highlighted] {
          background-color: var(--dropdown-hover-bg) !important;
          outline: none;
        }
        .header-cta-button {
          background-color: var(--header-cta-bg) !important;
          border-color: var(--header-cta-bg) !important;
          transition: all 0.2s ease-in-out;
        }
        .header-cta-button:hover {
          background-color: var(--header-cta-hover) !important;
          border-color: var(--header-cta-hover) !important;
          transform: translateY(-1px);
        }
      `}</style>
      <div className="container mx-auto px-4 h-full">
        {/* Flex layout based on alignment: left = logo-menu-actions | center = logo-menu(centered)-actions | right = logo-spacer-menu-actions */}
        <div className={`flex items-center h-full relative ${headerSettings.alignment === 'center'
          ? 'justify-between'
          : headerSettings.alignment === 'right'
            ? 'justify-between'
            : 'justify-between'
          }`}>
          {/* Logo - with improved auto-fit/scale */}
          <Link to="/" className="hover:opacity-90 transition-opacity flex items-center" data-branding-id="header.logo">
            {/* Text Logo - when logoType is 'text' */}
            {headerSettings.logoType === 'text' ? (
              <span
                className="text-xl md:text-2xl font-extrabold"
                style={{
                  color: headerSettings.logoTextColor || '#1F2937',
                  fontFamily: `'${headerSettings.logoFont || 'Inter'}', sans-serif`,
                }}
              >
                {headerSettings.logoText || 'WebPrinter'}
              </span>
            ) : settings.data?.id === '00000000-0000-0000-0000-000000000000' && !headerSettings.logoImageUrl ? (
              // Master tenant with no image - show WebprinterLogo
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
            ) : headerSettings.logoImageUrl ? (
              <img
                src={headerSettings.logoImageUrl}
                alt={tenantName}
                className="h-10 w-auto max-w-[180px] object-contain"
                style={{
                  maxHeight: `${headerSettings.scroll.heightPx - 16}px`,
                }}
              />
            ) : (
              // Fallback to text when no image
              <span className="text-xl md:text-2xl font-heading font-extrabold" style={{ color: effectiveTextColor }}>
                {tenantName}
              </span>
            )}
          </Link>

          {/* Desktop Navigation - alignment based positioning */}
          <nav className={`hidden lg:flex items-center gap-8 ${headerSettings.alignment === 'center'
            ? 'absolute left-1/2 -translate-x-1/2'
            : headerSettings.alignment === 'right'
              ? 'ml-auto mr-8'
              : 'ml-8'
            }`}
            data-branding-id="header.menu"
          >
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
                          className="header-nav-link text-sm font-medium inline-flex items-center gap-1"
                          style={{
                            color: selectedMenuId === item.id
                              ? (headerSettings.activeTextColor || '#0284C7')
                              : (headerSettings.textColor || '#1F2937')
                          }}
                          onClick={() => setSelectedMenuId(item.id)}
                        >
                          {item.label}
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={`backdrop-blur-sm z-[1001] ${headerSettings.dropdownShowBorder !== false ? 'border shadow-xl' : 'border-0 shadow-none'} ${(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT')
                          ? 'p-3'
                          : 'min-w-[200px] p-2'
                          } animate-in fade-in-0 slide-in-from-top-2 duration-200`}
                        style={getDropdownStyles()}
                      >
                        {/* Tryksager Section */}
                        {allProducts.filter(p => (p.category as string) === 'tryksager').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-3' : 'mb-2'}>
                            <h3 className="text-sm font-semibold mb-2 px-2" style={{ color: categoryColor, fontFamily: `'${categoryFont}', sans-serif`, opacity: 0.7 }}>Tryksager</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div className="flex flex-wrap gap-1">
                                {allProducts.filter(p => (p.category as string) === 'tryksager').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="dropdown-product-link cursor-pointer flex flex-col items-center gap-1 p-1 transition-all hover:scale-105 rounded"
                                    >
                                      {product.image_url && (
                                        <img
                                          src={product.image_url}
                                          alt={product.name}
                                          className={`${dropdownImageClass} object-contain`}
                                          style={{ filter: 'var(--product-filter)' }}
                                        />
                                      )}
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center max-w-[80px] truncate" style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}>{getProductLabel(product)}</span>
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
                                      className="dropdown-product-link cursor-pointer px-2 py-1.5 text-sm transition-colors rounded"
                                      style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}
                                    >
                                      {getProductLabel(product)}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Storformat Section */}
                        {allProducts.filter(p => (p.category as string) === 'storformat').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-3' : 'mb-2'}>
                            <h3 className="text-sm font-semibold mb-2 px-2" style={{ color: categoryColor, fontFamily: `'${categoryFont}', sans-serif`, opacity: 0.7 }}>Storformat</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div className="flex flex-wrap gap-1">
                                {allProducts.filter(p => (p.category as string) === 'storformat').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="dropdown-product-link cursor-pointer flex flex-col items-center gap-1 p-1 transition-all hover:scale-105 rounded"
                                    >
                                      {product.image_url && (
                                        <img
                                          src={product.image_url}
                                          alt={product.name}
                                          className={`${dropdownImageClass} object-contain`}
                                          style={{ filter: 'var(--product-filter)' }}
                                        />
                                      )}
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center max-w-[80px] truncate" style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}>{getProductLabel(product)}</span>
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
                                      className="dropdown-product-link cursor-pointer px-2 py-1.5 text-sm transition-colors rounded"
                                      style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}
                                    >
                                      {getProductLabel(product)}
                                    </Link>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tekstil Section */}
                        {allProducts.filter(p => (p.category as string) === 'tekstiltryk').length > 0 && (
                          <div className={(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? 'mb-3' : 'mb-2'}>
                            <h3 className="text-sm font-semibold mb-2 px-2" style={{ color: categoryColor, fontFamily: `'${categoryFont}', sans-serif`, opacity: 0.7 }}>Tøj & Tekstil</h3>
                            {(headerSettings.dropdownMode === 'IMAGE_ONLY' || headerSettings.dropdownMode === 'IMAGE_AND_TEXT') ? (
                              <div className="flex flex-wrap gap-1">
                                {allProducts.filter(p => (p.category as string) === 'tekstiltryk').map((product) => (
                                  <DropdownMenuItem key={product.id} asChild>
                                    <Link
                                      to={`/produkt/${product.slug}`}
                                      className="dropdown-product-link cursor-pointer flex flex-col items-center gap-1 p-1 transition-all hover:scale-105 rounded"
                                    >
                                      {product.image_url && (
                                        <img
                                          src={product.image_url}
                                          alt={product.name}
                                          className={`${dropdownImageClass} object-contain`}
                                          style={{ filter: 'var(--product-filter)' }}
                                        />
                                      )}
                                      {headerSettings.dropdownMode === 'IMAGE_AND_TEXT' && (
                                        <span className="text-xs text-center max-w-[80px] truncate" style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}>{getProductLabel(product)}</span>
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
                                      className="dropdown-product-link cursor-pointer px-2 py-1.5 text-sm transition-colors rounded"
                                      style={{ color: productColor, fontFamily: `'${productFont}', sans-serif` }}
                                    >
                                      {getProductLabel(product)}
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
                    className="header-nav-link text-sm font-medium"
                    style={{
                      color: selectedMenuId === item.id
                        ? (headerSettings.activeTextColor || '#0284C7')
                        : (headerSettings.textColor || '#1F2937')
                    }}
                    onClick={handleNavClick(item.href, item.id)}
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground header-action-link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results Dropdown */}
              {searchOpen && searchQuery && (
                <div className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-card rounded-lg shadow-lg border border-border z-[1001]">
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
                              style={{ filter: 'var(--product-filter)' }}
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
                className="header-action-link"
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </Button>
            </div>

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex header-action-link">
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
              <DropdownMenuContent align="end" className="w-36 bg-card z-[1001]">
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

            {/* CTA Button - only show when enabled in settings */}
            {headerSettings.cta?.enabled && (
              <Button
                asChild
                className={`hidden md:flex header-cta-button`}
                style={{
                  color: headerSettings.cta.textColor || '#FFFFFF',
                }}
              >
                <Link to={headerSettings.cta.href || '/kontakt'} className="no-link-color">{headerSettings.cta.label || t("orderNow")}</Link>
              </Button>
            )}

            {/* Auth Buttons - Desktop */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2 header-action-link">
                    <User className="h-4 w-4" />
                    {user.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card z-[1001]">
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
              <Button asChild variant="outline" size="sm" className="header-action-link" style={{ borderColor: effectiveTextColor }}>
                <Link to="/auth">{t("login")}</Link>
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden header-action-link"
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
                      style={{ filter: 'var(--product-filter)' }}
                    />
                  )}
                  {getProductLabel(product)}
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

            {/* CTA Button - Mobile - only show when enabled */}
            {headerSettings.cta?.enabled && (
              <Button
                asChild
                className={`w-full mt-4 header-cta-button ${headerSettings.cta.shimmer ? 'btn-shimmer' : ''}`}
                style={{
                  color: headerSettings.cta.textColor || '#FFFFFF',
                }}
              >
                <Link to={headerSettings.cta.href || '/kontakt'} onClick={() => setMobileMenuOpen(false)} className="no-link-color">
                  {headerSettings.cta.label || t("orderNow")}
                </Link>
              </Button>
            )}

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
