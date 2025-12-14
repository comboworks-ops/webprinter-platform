
import { useState, useEffect } from "react";
import { Package, Plus, FolderOpen, Globe, Search, ChevronDown, ChevronRight, Users, MessageCircle, ShoppingCart, Building2, Palette, CreditCard, Settings, LayoutGrid, UploadCloud, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface DbProduct {
  id: string;
  name: string;
  slug: string;
}

// ... existing imports ...

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

  return (
    <Sidebar
      collapsible="icon"
      className="border-0 bg-sidebar"
    >
      <SidebarContent className="pt-16">
        {/* Dashboard Link - Top Level */}
        <SidebarMenu className="px-2 pb-2">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/admin")}>
              <NavLink to="/admin" end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                <LayoutGrid className="h-4 w-4" />
                {!collapsed && <span>Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Products Section - Collapsible */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-sm font-medium"
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
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/products"
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {!collapsed && <span>Alle Produkter</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/create-product"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      {!collapsed && <span>Opret Produkt</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {products.map((product) => (
                  <SidebarMenuItem key={product.id}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/admin/product/${product.slug}`}
                        className="hover:bg-muted/50 pl-6 text-sm"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <Package className="h-3 w-3" />
                        {!collapsed && <span>{product.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Marketing Section - Collapsible */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-sm font-medium"
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
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/seo"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Search className="h-4 w-4" />
                      {!collapsed && <span>SEO Manager</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Kunder Section - Collapsible */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-sm font-medium"
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
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/kunder"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {!collapsed && <span>Ordrer</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/beskeder"
                      className="hover:bg-muted/50 relative"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${unreadMessageCount > 0 ? 'bg-green-500 text-white' : ''}`}>
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      {!collapsed && <span>Beskeder</span>}
                      {unreadMessageCount > 0 && (
                        <span className="absolute right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Min Konto Section - Collapsible */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-sm font-medium"
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
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/domaene"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Globe className="h-4 w-4" />
                      {!collapsed && <span>Domæne</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/branding"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Palette className="h-4 w-4" />
                      {!collapsed && <span>Site Design</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/skabeloner"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <FileText className="h-4 w-4" />
                      {!collapsed && <span>Skabeloner</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {!isMasterAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/abonnement"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <CreditCard className="h-4 w-4" />
                        {!collapsed && <span>Abonnement</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/indstillinger"
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Indstillinger</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Platform Section - Only visible to Master Admin */}
        {isMasterAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel
              className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-sm font-medium"
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
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/tenants"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <Users className="h-4 w-4" />
                        {!collapsed && <span>Lejere</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/resources"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <FolderOpen className="h-4 w-4" />
                        {!collapsed && <span>Ressourcer</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/branding-template"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <Palette className="h-4 w-4" />
                        {!collapsed && <span>Site Design Skabelon</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/updates"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {!collapsed && <span>System Updates</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin/master-skabeloner"
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <FileText className="h-4 w-4" />
                        {!collapsed && <span>Skabeloner</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ) : (
          /* Tenant Updates - Only visible to Tenants */
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 py-2 text-sm font-medium">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/tenant-updates"
                      className="hover:bg-muted/50 relative pr-6"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {!collapsed && <span>System Opdateringer</span>}
                      {unreadSystemCount > 0 && (
                        <span className="absolute right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                          {unreadSystemCount > 9 ? '9+' : unreadSystemCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar >
  );
}
