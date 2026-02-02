
import { useState, useEffect } from "react";
import { Package, Plus, FolderOpen, Globe, Search, ChevronDown, ChevronRight, Users, MessageCircle, ShoppingCart, Building2, Palette, CreditCard, Settings, LayoutGrid, UploadCloud, FileText, Calculator, Cpu, Paintbrush, Printer, Zap, PanelLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
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
  textDefault: isDark ? '#f3f4f6' : '#374151',
  textActive: isDark ? '#38bdf8' : '#0284c7',
  textMuted: isDark ? '#9ca3af' : '#6b7280',

  // Background colors
  bgHover: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)',
  bgActive: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
  bgSidebar: isDark ? '#111827' : '#fafafa',
  bgSection: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',

  // Borders and accents
  borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
  accentBorder: isDark ? '#38bdf8' : '#0284c7',
});

interface DbProduct {
  id: string;
  name: string;
  slug: string;
}

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

  return (
    <RouterNavLink
      {...props}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: isSubItem ? '0.5rem 0.75rem 0.5rem 1.75rem' : '0.625rem 0.75rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: isActive ? 500 : 400,
        letterSpacing: '-0.01em',
        color: isActive ? styles.textActive : styles.textDefault,
        backgroundColor: isActive ? styles.bgActive : 'transparent',
        borderLeft: isActive ? `2px solid ${styles.accentBorder}` : '2px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        textDecoration: 'none',
        marginLeft: isActive ? '-2px' : '0',
      })}
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
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [productsOpen, setProductsOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [kunderOpen, setKunderOpen] = useState(false);
  const [minKontoOpen, setMinKontoOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [modulerOpen, setModulerOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
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
  }, [roleIsMasterAdmin, location.pathname]); // Re-run on route change in case context switches
  useEffect(() => {
    async function fetchProducts() {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId || !isAdmin) return;

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
  }, []);

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

        setUnreadMessageCount((customerCount || 0) + (supportCount || 0));

        // 2. System Notifications (Tenant Updates) - Only if NOT master admin
        if (!isMasterAdmin) {
          const { data: tenant } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();

          if (tenant) {
            const { count: notiCount } = await supabase
              .from('tenant_notifications' as any)
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', (tenant as any).id)
              .eq('is_read', false);

            setUnreadSystemCount(notiCount || 0);
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
      transform: translateX(2px);
    }
    
    .admin-sidebar .admin-nav-link:active {
      transform: scale(0.98) translateX(2px);
    }
    
    .admin-sidebar .admin-nav-link svg {
      transition: transform 0.2s ease;
    }
    
    .admin-sidebar .admin-nav-link:hover svg {
      transform: scale(1.1);
    }
    
    .admin-sidebar .admin-section-header {
      color: ${sidebarStyles.textDefault};
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    
    .admin-sidebar .admin-section-header:hover {
      background-color: ${sidebarStyles.bgHover};
      transform: translateX(2px);
    }
    
    .admin-sidebar .admin-section-header svg {
      transition: transform 0.2s ease;
    }
    
    .admin-sidebar .admin-section-header:hover svg:first-child {
      transform: scale(1.1);
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
          boxShadow: isDarkMode ? 'none' : '2px 0 8px rgba(0, 0, 0, 0.03)',
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
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
          {/* Dashboard Link - Top Level */}
          <SidebarMenu className="pb-3">
            <SidebarMenuItem>
              <AdminNavLink to="/admin" end>
                <LayoutGrid className="h-4 w-4" style={{ color: isActive("/admin") ? sidebarStyles.textActive : sidebarStyles.textDefault }} />
                {!collapsed && <span>Dashboard</span>}
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
                    <AdminNavLink to="/admin/designer-templates">
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
                    <AdminNavLink to="/admin/beskeder">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${unreadMessageCount > 0 ? 'bg-green-500 text-white' : ''}`}>
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      {!collapsed && <span>Beskeder</span>}
                      {unreadMessageCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>
    </>
  );
}
