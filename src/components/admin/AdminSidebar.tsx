
import { useState, useEffect } from "react";
import { Package, Plus, FolderOpen, Globe, Search, ChevronDown, ChevronRight, Users, MessageCircle, ShoppingCart, Building2, Palette, CreditCard, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [productsOpen, setProductsOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [kunderOpen, setKunderOpen] = useState(false);
  const [minKontoOpen, setMinKontoOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name, slug')
        .order('name');
      if (data) {
        setProducts(data);
      }
    }
    fetchProducts();
  }, []);

  // Fetch unread message count from customers
  useEffect(() => {
    async function fetchUnreadMessages() {
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
    }

    fetchUnreadMessages();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => currentPath === path;
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      className={`${collapsed ? "w-14" : "w-64"} border-0`}
    >
      <SidebarContent className="pt-16">
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
                      to="/admin"
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {!collapsed && <span>Oversigt</span>}
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
                      <MessageCircle className="h-4 w-4" />
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
                      {!collapsed && <span>Branding</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
      </SidebarContent>
    </Sidebar>
  );
}
