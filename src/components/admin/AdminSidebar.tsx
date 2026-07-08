
import { useState, useEffect, type KeyboardEvent } from "react";
import { Package, Plus, FolderOpen, Globe, Search, ChevronDown, ChevronRight, Users, MessageCircle, ShoppingCart, Building2, Palette, CreditCard, Settings, LayoutGrid, UploadCloud, FileText, Calculator, Cpu, Paintbrush, Printer, Zap, PanelLeft, Sparkles, Database, ClipboardCheck } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useIconStudioAccess } from "@/hooks/useIconStudioAccess";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_TENANT_ID, resolveAdminTenant } from "@/lib/adminTenant";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Admin sidebar styles - modern professional design
const getAdminSidebarStyles = (isDark: boolean) => ({
  // Text colors
  textDefault: isDark ? '#e5e7eb' : '#334155',
  textActive: '#ffffff',
  textMuted: isDark ? '#94a3b8' : '#64748b',

  // Background colors
  bgHover: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
  bgActive: isDark ? '#0284c7' : '#0284c7',
  bgSidebar: isDark ? '#0f172a' : '#f8fafc',
  bgSection: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',

  // Borders and accents
  borderColor: isDark ? 'rgba(51, 65, 85, 0.75)' : 'rgba(226, 232, 240, 0.95)',
  accentBorder: isDark ? '#7dd3fc' : '#0ea5e9',
});

interface DbProduct {
  id: string;
  name: string;
  slug: string;
}

const PLATFORM_LEAD_PREFIX = '[PLATFORM LEAD]';
const PLATFORM_LEAD_THREAD_PATH = `/admin/beskeder?tenantId=${MASTER_TENANT_ID}`;

// Custom AdminNavLink with hard-coded styles (isolated from global branding)
import { NavLink as RouterNavLink, NavLinkProps } from 'react-router-dom';
interface AdminNavLinkProps extends Omit<NavLinkProps, 'className' | 'style'> {
  children: React.ReactNode;
  isSubItem?: boolean;
}

function AdminNavLink({ children, isSubItem, ...props }: AdminNavLinkProps) {
  // Check for dark mode dynamically
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const styles = getAdminSidebarStyles(isDark);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const forceDomain = new URLSearchParams(location.search).get("force_domain");
  const toWithTenantContext = (() => {
    if (!forceDomain || typeof props.to !== "string" || !props.to.startsWith("/admin")) {
      return props.to;
    }
    const existingParams = new URLSearchParams(props.to.split("?")[1] || "");
    if (existingParams.has("force_domain")) {
      return props.to;
    }
    return `${props.to}${props.to.includes("?") ? "&" : "?"}force_domain=${encodeURIComponent(forceDomain)}`;
  })();

  return (
    <RouterNavLink
      {...props}
      to={toWithTenantContext}
      style={({ isActive }) => {
        const active = isActive && !collapsed;
        return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.625rem',
        padding: collapsed ? '0.625rem' : isSubItem ? '0.5rem 0.75rem 0.5rem 1.75rem' : '0.625rem 0.75rem',
        borderRadius: '0.5rem',
        fontSize: isSubItem ? '0.8125rem' : '0.875rem',
        lineHeight: '1.25rem',
        fontWeight: active ? 600 : 500,
        letterSpacing: '-0.01em',
        color: active ? styles.textActive : styles.textDefault,
        backgroundColor: active ? styles.bgActive : 'transparent',
        border: active ? `1px solid ${styles.accentBorder}` : '1px solid transparent',
        boxShadow: active ? (isDark ? '0 10px 28px rgba(2, 132, 199, 0.22)' : '0 10px 24px rgba(2, 132, 199, 0.16)') : 'none',
        minHeight: collapsed ? '2.25rem' : isSubItem ? '2.25rem' : '2.5rem',
        width: collapsed ? '2.25rem' : '100%',
        transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        textDecoration: 'none',
        outline: 'none',
        };
      }}
      className="admin-nav-link"
    >
      {children}
    </RouterNavLink>
  );
}


export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { isMasterAdmin: roleIsMasterAdmin, isAdmin } = useUserRole();
  const iconStudioAccess = useIconStudioAccess();
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [productsOpen, setProductsOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [kunderOpen, setKunderOpen] = useState(false);
  const [minKontoOpen, setMinKontoOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [modulerOpen, setModulerOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadPlatformLeadCount, setUnreadPlatformLeadCount] = useState(0);
  const [unreadSystemCount, setUnreadSystemCount] = useState(0);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Get dynamic styles based on dark mode
  const sidebarStyles = getAdminSidebarStyles(isDarkMode);

  // Listen for dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkDarkMode();

    // Watch for class changes on documentElement
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function checkMasterStatus() {
      // FIX: Only show Master Admin UI if we are actually in the Master Tenant context.
      // Even if the user HAS the role, they shouldn't see Platform tools when managing a sub-tenant (Salgsmapper).

      const { tenantId, isMasterAdmin: resolvedMasterStatus } = await resolveAdminTenant();

      // We only toggle the UI mode if we are effectively acting as Master Admin on the Master Tenant
      if (resolvedMasterStatus && tenantId === '00000000-0000-0000-0000-000000000000') {
        setIsMasterAdmin(true);
        setPlatformOpen(true);
      } else {
        setIsMasterAdmin(false);
        setPlatformOpen(false);
      }
    }
    checkMasterStatus();
  }, [roleIsMasterAdmin, location.pathname, location.search]); // Re-run on route/query change in case context switches
  useEffect(() => {
    async function fetchProducts() {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId || !isAdmin) {
        setProducts([]);
        return;
      }

      // Fetch products for THIS tenant
      const { data } = await (supabase
        .from('products') as any)
        .select('id, name, slug')
        .eq('tenant_id', tenantId)
        .order('name');

      if (data) {
        setProducts(data as DbProduct[]);
      }
    }
    fetchProducts();
  }, [isAdmin, isMasterAdmin, location.pathname, location.search]);

  // Fetch unread message count from customers (for Orders) AND System Updates
  useEffect(() => {
    async function fetchUnreadCounts() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Order Messages (Customer Support)
        // 1. Customer Messages (Unread)
        const { count: customerCount } = await supabase
          .from('order_messages' as any)
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('sender_type', 'customer');

        // 2. Support Messages (Unread)
        const { count: supportCount } = await supabase
          .from('platform_messages' as any)
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('sender_role', isMasterAdmin ? 'tenant' : 'master');

        const { count: platformLeadCount } = isMasterAdmin
          ? await supabase
            .from('platform_messages' as any)
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', MASTER_TENANT_ID)
            .eq('is_read', false)
            .ilike('content', `${PLATFORM_LEAD_PREFIX}%`)
          : { count: 0 };

        setUnreadMessageCount((customerCount || 0) + (supportCount || 0));
        setUnreadPlatformLeadCount(platformLeadCount || 0);

        // 2. System Notifications (Tenant Updates) - Only if NOT master admin
        if (!isMasterAdmin) {
          const { tenantId } = await resolveAdminTenant();

          if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
            const { data: notiRows } = await supabase
              .from('tenant_notifications' as any)
              .select('id, type, data, is_read')
              .eq('tenant_id', tenantId)
              .eq('is_read', false);

            const notiCount = ((notiRows as any[]) || []).filter((row) => {
              if (row.type !== 'product_update') return true;
              return row.data?.delivery_mode === 'pod_price_list';
            }).length;

            setUnreadSystemCount(notiCount);
          }
        }

      } catch (e) {
        console.debug('Could not fetch unread counts');
      }
    }

    fetchUnreadCounts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);

    // Subscribe to realtime changes for immediate updates
    const channel = supabase
      .channel('sidebar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_notifications'
        },
        () => {
          fetchUnreadCounts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_messages'
        },
        () => {
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isMasterAdmin]);

  const isActive = (path: string) => currentPath === path;
  const collapsed = state === "collapsed";
  const showIconStudio = iconStudioAccess.hasAccess;
  const messageTargetPath = isMasterAdmin
    && unreadPlatformLeadCount > 0
    && unreadPlatformLeadCount === unreadMessageCount
    ? PLATFORM_LEAD_THREAD_PATH
    : "/admin/beskeder";
  const createSectionKeyHandler = (toggle: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  // Scoped CSS for admin sidebar - modern professional design
  const scopedStyles = `
    .admin-sidebar {
      backdrop-filter: blur(8px);
    }
    
    .admin-sidebar .admin-nav-link {
      position: relative;
    }
    
    .admin-sidebar .admin-nav-link:hover {
      background-color: ${sidebarStyles.bgHover} !important;
    }

    .admin-sidebar .admin-nav-link:focus-visible,
    .admin-sidebar .admin-section-header:focus-visible {
      outline: 2px solid ${sidebarStyles.accentBorder};
      outline-offset: 2px;
    }
    
    .admin-sidebar .admin-nav-link:active {
      transform: scale(0.995);
    }
    
    .admin-sidebar .admin-nav-link svg {
      transition: transform 0.2s ease;
    }
    
    .admin-sidebar .admin-nav-link:hover svg {
      transform: scale(1.04);
    }
    
    .admin-sidebar .admin-section-header {
      color: ${sidebarStyles.textDefault};
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    
    .admin-sidebar .admin-section-header:hover {
      background-color: ${sidebarStyles.bgHover};
    }
    
    .admin-sidebar .admin-section-header svg {
      transition: transform 0.2s ease;
    }
    
    .admin-sidebar .admin-section-header:hover svg:first-child {
      transform: scale(1.04);
    }
  `;

  return (
    <>
      <style>{scopedStyles}</style>
      <Sidebar
        collapsible="icon"
        className="admin-sidebar"
        style={{
          backgroundColor: sidebarStyles.bgSidebar,
          borderRight: `1px solid ${sidebarStyles.borderColor}`,
          boxShadow: isDarkMode ? 'none' : '2px 0 18px rgba(15, 23, 42, 0.04)',
        }}
      >
        <SidebarContent className="pt-16 px-3 space-y-1">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-1 pb-2`}>
            {!collapsed && (
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: sidebarStyles.textMuted }}>
                Menu
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSidebar}
              title={collapsed ? "Vis menu" : "Skjul menu"}
              aria-label={collapsed ? "Vis menu" : "Skjul menu"}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
          {!collapsed && (
            <>
              {/* Dashboard Link - Top Level */}
              <SidebarMenu className="pb-3">
                <SidebarMenuItem>
                  <AdminNavLink to="/admin" end>
                    <LayoutGrid className="h-4 w-4" />
                    <span>Dashboard</span>
                  </AdminNavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <AdminNavLink to="/admin/commercial-readiness">
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Driftsklarhed</span>
                  </AdminNavLink>
                </SidebarMenuItem>
              </SidebarMenu>

          {/* Visual Divider */}
          <div className="px-2 pb-2">
            <div style={{ height: '1px', background: sidebarStyles.borderColor, opacity: 0.6 }} />
          </div>

          {/* Products Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: sidebarStyles.textDefault }}
              onClick={() => setProductsOpen(!productsOpen)}
              onKeyDown={createSectionKeyHandler(() => setProductsOpen(!productsOpen))}
              role="button"
              tabIndex={0}
              aria-expanded={productsOpen}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>Produkter</span>
              </div>
              {productsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>

            {(productsOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/products" end>
                      <FolderOpen className="h-4 w-4" />
                      {!collapsed && <span>Alle Produkter</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/create-product">
                      <Plus className="h-4 w-4" />
                      {!collapsed && <span>Opret Produkt</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {products.map((product) => (
                    <SidebarMenuItem key={product.id}>
                      <AdminNavLink to={`/admin/product/${product.slug}`} isSubItem>
                        <Package className="h-3 w-3" />
                        {!collapsed && <span>{product.name}</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* Shop Moduler Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: sidebarStyles.textDefault }}
              onClick={() => setModulerOpen(!modulerOpen)}
              onKeyDown={createSectionKeyHandler(() => setModulerOpen(!modulerOpen))}
              role="button"
              tabIndex={0}
              aria-expanded={modulerOpen}
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Shop Moduler</span>
              </div>
              {modulerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>

            {(modulerOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Overview */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/moduler">
                      <LayoutGrid className="h-4 w-4" />
                      {!collapsed && <span>Modul Oversigt</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Print Designer */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/print-designer">
                      <Paintbrush className="h-4 w-4" />
                      {!collapsed && <span>Print Designer</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Site Design */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/branding-v2">
                      <Palette className="h-4 w-4" />
                      {!collapsed && <span>Site Design</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/site-design-v2">
                      <Palette className="h-4 w-4" />
                      {!collapsed && <span>Site Design V2</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {showIconStudio && (
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/icon-studio">
                        <Sparkles className="h-4 w-4" />
                        {!collapsed && <span>Icon Studio</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                  )}

                  {/* Sites */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/sites">
                      <Globe className="h-4 w-4" />
                      {!collapsed && <span>Sites</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Maskin-beregning */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/machine-pricing">
                      <Cpu className="h-4 w-4" />
                      {!collapsed && <span>Maskin-beregning</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Print on Demand */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/pod-katalog">
                      <Printer className="h-4 w-4" />
                      {!collapsed && <span>Print on Demand</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Company Hub */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/companyhub">
                      <Building2 className="h-4 w-4" />
                      {!collapsed && <span>Company Hub</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Design Bibliotek */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/ressourcer/designs">
                      <FolderOpen className="h-4 w-4" />
                      {!collapsed && <span>Design Bibliotek</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  {/* Farveprofiler */}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/farveprofiler">
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Farveprofiler</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* Marketing Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: sidebarStyles.textDefault }}
              onClick={() => setMarketingOpen(!marketingOpen)}
              onKeyDown={createSectionKeyHandler(() => setMarketingOpen(!marketingOpen))}
              role="button"
              tabIndex={0}
              aria-expanded={marketingOpen}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Marketing</span>
              </div>
              {marketingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>

            {(marketingOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/seo">
                      <Search className="h-4 w-4" />
                      {!collapsed && <span>SEO Manager</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/ai-seo">
                      <Sparkles className="h-4 w-4" />
                      {!collapsed && <span>AI SEO</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* Kunder Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: sidebarStyles.textDefault }}
              onClick={() => setKunderOpen(!kunderOpen)}
              onKeyDown={createSectionKeyHandler(() => setKunderOpen(!kunderOpen))}
              role="button"
              tabIndex={0}
              aria-expanded={kunderOpen}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Kunder</span>
                {unreadMessageCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </div>
              {kunderOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>

            {(kunderOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/kunder">
                      <ShoppingCart className="h-4 w-4" />
                      {!collapsed && <span>Ordrer</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to={messageTargetPath}>
                      <MessageCircle className="h-4 w-4" />
                      {!collapsed && <span>Beskeder</span>}
                      {!collapsed && unreadPlatformLeadCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[48px] h-[18px] px-1.5 rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
                          {unreadPlatformLeadCount > 9 ? '9+' : unreadPlatformLeadCount} henv.
                        </span>
                      )}
                      {unreadMessageCount > 0 && (
                        <span className={`${!collapsed && unreadPlatformLeadCount > 0 ? '' : 'ml-auto'} flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm`}>
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      )}
                    </AdminNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* Min Konto Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: sidebarStyles.textDefault }}
              onClick={() => setMinKontoOpen(!minKontoOpen)}
              onKeyDown={createSectionKeyHandler(() => setMinKontoOpen(!minKontoOpen))}
              role="button"
              tabIndex={0}
              aria-expanded={minKontoOpen}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Min Konto</span>
              </div>
              {minKontoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>

            {(minKontoOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/domaene">
                      <Globe className="h-4 w-4" />
                      {!collapsed && <span>Domæne</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/skabeloner">
                      <FileText className="h-4 w-4" />
                      {!collapsed && <span>Skabeloner</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  {!isMasterAdmin && (
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/abonnement">
                        <CreditCard className="h-4 w-4" />
                        {!collapsed && <span>Abonnement</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/indstillinger" end>
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Indstillinger</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/indstillinger/betaling">
                      <Calculator className="h-4 w-4" />
                      {!collapsed && <span>Betaling</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* Platform Section - Only visible to Master Admin */}
          {isMasterAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel
                className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
                style={{ color: sidebarStyles.textDefault }}
                onClick={() => setPlatformOpen(!platformOpen)}
                onKeyDown={createSectionKeyHandler(() => setPlatformOpen(!platformOpen))}
                role="button"
                tabIndex={0}
                aria-expanded={platformOpen}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>Platform</span>
                </div>
                {platformOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </SidebarGroupLabel>

              {(platformOpen || collapsed) && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/tenants">
                        <Users className="h-4 w-4" />
                        {!collapsed && <span>Lejere</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/resources">
                        <FolderOpen className="h-4 w-4" />
                        {!collapsed && <span>Ressourcer</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/ressourcer/designs">
                        <LayoutGrid className="h-4 w-4" />
                        {!collapsed && <span>Design Bibliotek</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/branding-template">
                        <Palette className="h-4 w-4" />
                        {!collapsed && <span>Platform Master Design</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/updates">
                        <UploadCloud className="h-4 w-4" />
                        {!collapsed && <span>System Updates</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/master-skabeloner">
                        <FileText className="h-4 w-4" />
                        {!collapsed && <span>Skabeloner</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/platform-seo">
                        <Globe className="h-4 w-4" />
                        {!collapsed && <span>Platform SEO</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/supplier-bank">
                        <Database className="h-4 w-4" />
                        {!collapsed && <span>Supplier Bank</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/pod">
                        <Printer className="h-4 w-4" />
                        {!collapsed && <span>Print on Demand</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/pod2">
                        <Printer className="h-4 w-4" />
                        {!collapsed && <span>Print on Demand v2</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/pod3">
                        <Printer className="h-4 w-4" />
                        {!collapsed && <span>Flyer Alarm (POD3)</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AdminNavLink to="/admin/pod2-ordrer">
                        <ShoppingCart className="h-4 w-4" />
                        {!collapsed && <span>POD v2 Ordrer</span>}
                      </AdminNavLink>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          ) : (
            /* Tenant Updates - Only visible to Tenants */
            <SidebarGroup>
              <SidebarGroupLabel
                className="admin-section-header px-2 py-2 text-sm font-medium"
                style={{ color: sidebarStyles.textDefault }}
              >
                System
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/tenant-updates">
                      <UploadCloud className="h-4 w-4" />
                      {!collapsed && <span>System Opdateringer</span>}
                      {unreadSystemCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                          {unreadSystemCount > 9 ? '9+' : unreadSystemCount}
                        </span>
                      )}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/pod2-ordrer">
                      <ShoppingCart className="h-4 w-4" />
                      {!collapsed && <span>POD v2 Ordrer</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/pod2-betaling">
                      <CreditCard className="h-4 w-4" />
                      {!collapsed && <span>POD v2 Betaling</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/pod3">
                      <Printer className="h-4 w-4" />
                      {!collapsed && <span>Flyer Alarm (POD3)</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
            </>
          )}
        </SidebarContent>
      </Sidebar>
    </>
  );
}
