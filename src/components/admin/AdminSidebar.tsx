
import { useState, useEffect } from "react";
import { Package, Plus, FolderOpen, Globe, Search, ChevronDown, ChevronRight, Users, MessageCircle, ShoppingCart, Building2, Palette, CreditCard, Settings, LayoutGrid, UploadCloud, FileText, Calculator, Cpu, Paintbrush } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";

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


// Hard-coded admin sidebar styles - completely isolated from global branding
const ADMIN_SIDEBAR_STYLES = {
  // Colors - hard-coded, not from CSS variables
  textDefault: '#1f2937',      // Black/dark gray for default text
  textActive: '#0ea5e9',       // Blue for active/selected items
  textMuted: '#6b7280',        // Muted gray for section headers
  bgHover: 'rgba(0, 0, 0, 0.04)',  // Subtle hover background
  bgActive: 'rgba(14, 165, 233, 0.08)', // Light blue background for active
  bgSidebar: '#ffffff',        // White sidebar background
  borderColor: '#e5e7eb',      // Light gray border
} as const;

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
  return (
    <RouterNavLink
      {...props}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: isSubItem ? '0.5rem 0.5rem 0.5rem 1.5rem' : '0.5rem',
        borderRadius: '0.375rem',
        fontSize: isSubItem ? '0.875rem' : '0.875rem',
        fontWeight: isActive ? 500 : 400,
        color: isActive ? ADMIN_SIDEBAR_STYLES.textActive : ADMIN_SIDEBAR_STYLES.textDefault,
        backgroundColor: isActive ? ADMIN_SIDEBAR_STYLES.bgActive : 'transparent',
        transition: 'all 0.15s ease-in-out',
        textDecoration: 'none',
      })}
      className="admin-nav-link"
    >
      {children}
    </RouterNavLink>
  );
}


export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { isMasterAdmin: roleIsMasterAdmin, isAdmin } = useUserRole();
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [productsOpen, setProductsOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [kunderOpen, setKunderOpen] = useState(false);
  const [minKontoOpen, setMinKontoOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadSystemCount, setUnreadSystemCount] = useState(0);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    async function checkMasterStatus() {
      // If hook says yes, we are good
      if (roleIsMasterAdmin) {
        setIsMasterAdmin(true);
        return;
      }

      // Fallback: Check ownership of master tenant
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('tenants' as any)
          .select('id')
          .eq('id', '00000000-0000-0000-0000-000000000000')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (data) {
          setIsMasterAdmin(true);
          setPlatformOpen(true); // Open platform menu by default for master admin
        }
      } catch (e) {
        console.error('Could not check master admin status', e);
      }
    }
    checkMasterStatus();
  }, [roleIsMasterAdmin]);
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

  // Scoped CSS for admin sidebar hover effects (isolated from global styles)
  const scopedStyles = `
    .admin-sidebar .admin-nav-link:hover {
      background-color: ${ADMIN_SIDEBAR_STYLES.bgHover} !important;
    }
    .admin-sidebar .admin-nav-link:active {
      transform: scale(0.98);
    }
    .admin-sidebar .admin-section-header {
      color: ${ADMIN_SIDEBAR_STYLES.textDefault};
      transition: background-color 0.15s ease;
    }
    .admin-sidebar .admin-section-header:hover {
      background-color: ${ADMIN_SIDEBAR_STYLES.bgHover};
    }
  `;

  return (
    <>
      <style>{scopedStyles}</style>
      <Sidebar
        collapsible="icon"
        className="admin-sidebar"
        style={{
          backgroundColor: ADMIN_SIDEBAR_STYLES.bgSidebar,
          borderRight: `1px solid ${ADMIN_SIDEBAR_STYLES.borderColor}`,
        }}
      >
        <SidebarContent className="pt-16 px-2">
          {/* Dashboard Link - Top Level */}
          <SidebarMenu className="pb-2">
            <SidebarMenuItem>
              <AdminNavLink to="/admin" end>
                <LayoutGrid className="h-4 w-4" style={{ color: isActive("/admin") ? ADMIN_SIDEBAR_STYLES.textActive : ADMIN_SIDEBAR_STYLES.textDefault }} />
                {!collapsed && <span>Dashboard</span>}
              </AdminNavLink>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Products Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/prismoduler">
                      <Calculator className="h-4 w-4" />
                      {!collapsed && <span>Prismoduler</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/machine-pricing">
                      <Cpu className="h-4 w-4" />
                      {!collapsed && <span>Maskin-beregning</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/designer-templates">
                      <Paintbrush className="h-4 w-4" />
                      {!collapsed && <span>Print Designer</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/ressourcer/designs">
                      <LayoutGrid className="h-4 w-4" />
                      {!collapsed && <span>Design Bibliotek</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/farveprofiler">
                      <Palette className="h-4 w-4" />
                      {!collapsed && <span>Farveprofiler</span>}
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

          {/* Marketing Section - Collapsible */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="admin-section-header flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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
              style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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
              style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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
                    <AdminNavLink to="/admin/branding">
                      <Palette className="h-4 w-4" />
                      {!collapsed && <span>Site Design</span>}
                    </AdminNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <AdminNavLink to="/admin/branding-v2">
                      <LayoutGrid className="h-4 w-4" />
                      {!collapsed && <span>{isMasterAdmin ? 'Eget Shop Design' : 'Site Design V2'}</span>}
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
                    <AdminNavLink to="/admin/indstillinger">
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Indstillinger</span>}
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
                style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          ) : (
            /* Tenant Updates - Only visible to Tenants */
            <SidebarGroup>
              <SidebarGroupLabel
                className="admin-section-header px-2 py-2 text-sm font-medium"
                style={{ color: ADMIN_SIDEBAR_STYLES.textDefault }}
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
