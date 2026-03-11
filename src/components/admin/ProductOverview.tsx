
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Package, Trash2, Copy, Search, X, ImageIcon, Building2, Loader2, Settings2, Plus, ChevronUp, ChevronDown, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductCloneDialog } from "./ProductCloneDialog";
import { AdminInlineHelp } from "./AdminInlineHelp";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  pricing_type: string;
  is_published: boolean;
  is_available_to_tenants?: boolean;
  is_ready?: boolean;
  image_url?: string | null;
};

type ProductCategory = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  sort_order: number | null;
  overview_id?: string | null;
  parent_category_id?: string | null;
  navigation_mode?: "all_in_one" | "submenu" | null;
  frontend_product_id?: string | null;
};

type ProductOverviewGroup = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  sort_order: number | null;
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

type TenantOption = {
  id: string;
  name: string;
  domain?: string | null;
};

type DeliveryMode = "price_list" | "pod_price_list";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const FALLBACK_OVERVIEW_ID = "__default_overview__";
const FALLBACK_OVERVIEW_NAME = "Produkter";
const DELIVERY_MODES: { id: DeliveryMode; label: string; description: string }[] = [
  {
    id: "price_list",
    label: "Standard pris",
    description: "Der oprettes en uafhængig kopi hos lejeren, som kan redigeres frit.",
  },
  {
    id: "pod_price_list",
    label: "POD-pris",
    description: "Produktet sendes til tenantens indbakke som en master-styret import.",
  },
];

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCategoryKey(categoryName?: string | null): string {
  const normalized = String(categoryName || "").trim();
  if (!normalized) return "ukategoriseret";
  return toSlug(normalized) || normalized.toLowerCase();
}

function getProductCardShellClass(product: Pick<Product, "is_published" | "is_ready">): string {
  if (product.is_ready) {
    return "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400";
  }
  if (product.is_published) {
    return "border-orange-300 bg-orange-50/70 hover:border-orange-400";
  }
  return "hover:border-primary bg-background";
}

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const isMissingProductOverviewsTable = (error: unknown) => {
  const e = (error || {}) as DbErrorLike;
  const text = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return e.code === '42P01' || e.code === 'PGRST205' || text.includes('product_overviews');
};

const isMissingOverviewColumn = (error: unknown) => {
  const e = (error || {}) as DbErrorLike;
  const text = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return e.code === '42703' || e.code === 'PGRST204' || text.includes('overview_id');
};

const isMissingHierarchyColumn = (error: unknown) => {
  const e = (error || {}) as DbErrorLike;
  const text = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return e.code === '42703' || e.code === 'PGRST204' || text.includes('parent_category_id') || text.includes('navigation_mode');
};

const isMissingFrontendCardColumn = (error: unknown) => {
  const e = (error || {}) as DbErrorLike;
  const text = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return e.code === '42703' || e.code === 'PGRST204' || text.includes('frontend_product_id');
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
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [tenantFilter, setTenantFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("price_list");

  // Clone Dialog State
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneProduct, setCloneProduct] = useState<Product | null>(null);

  // Admin Categories State
  const [adminCategories, setAdminCategories] = useState<ProductCategory[]>([]);
  const [adminOverviews, setAdminOverviews] = useState<ProductOverviewGroup[]>([
    {
      id: FALLBACK_OVERVIEW_ID,
      tenant_id: MASTER_TENANT_ID,
      name: FALLBACK_OVERVIEW_NAME,
      slug: "produkter",
      sort_order: 0,
    },
  ]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedOverviewId, setSelectedOverviewId] = useState<string>(FALLBACK_OVERVIEW_ID);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOverviewId, setNewCategoryOverviewId] = useState<string>(FALLBACK_OVERVIEW_ID);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>("none");
  const [newCategoryNavigationMode, setNewCategoryNavigationMode] = useState<"all_in_one" | "submenu">("all_in_one");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newOverviewName, setNewOverviewName] = useState("");
  const [editingOverviewId, setEditingOverviewId] = useState<string | null>(null);
  const [editingOverviewName, setEditingOverviewName] = useState("");
  const [overviewsLoaded, setOverviewsLoaded] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('admin-product-categories-collapsed');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [productsTenantId, setProductsTenantId] = useState<string | null>(null);
  // LOCK LF-005: Distribution actions are only valid in Master tenant context.
  const canDistributeToTenants = isMasterAdmin && productsTenantId === MASTER_TENANT_ID;

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
    fetchAdminOverviews();
    fetchAdminCategories();
  }, [roleIsMasterAdmin]);

  useEffect(() => {
    if (canDistributeToTenants) {
      fetchTenantsForRelease();
    } else {
      setTenants([]);
    }
  }, [canDistributeToTenants]);

  useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adminOverviews.length === 0) return;
    const hasCurrent = adminOverviews.some((overview) => overview.id === newCategoryOverviewId);
    if (!newCategoryOverviewId || !hasCurrent) {
      setNewCategoryOverviewId(adminOverviews[0].id);
    }
  }, [adminOverviews, newCategoryOverviewId]);

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
        .eq('id', '00000000-0000-0000-0000-000000000000') // Master ID
        .eq('owner_id', user.id)
        .maybeSingle();
      if (data) setIsMasterAdmin(true);
    }
  };

  const fetchProducts = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("No tenant found");
      setProductsTenantId(tenantId);

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

  const fetchAdminOverviews = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('product_overviews' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (error) {
        if (isMissingProductOverviewsTable(error)) {
          // Migration not applied yet. Keep backward-compatible fallback.
          setAdminOverviews([
            {
              id: FALLBACK_OVERVIEW_ID,
              tenant_id: tenantId,
              name: FALLBACK_OVERVIEW_NAME,
              slug: "produkter",
              sort_order: 0,
            },
          ]);
          return;
        }
        throw error;
      }

      const rows = (data as ProductOverviewGroup[]) || [];
      if (rows.length === 0) {
        // Seed one default overview for this tenant if table exists but empty.
        const { data: created } = await supabase
          .from('product_overviews' as any)
          .insert({
            tenant_id: tenantId,
            name: FALLBACK_OVERVIEW_NAME,
            slug: "produkter",
            sort_order: 0,
          })
          .select('*')
          .single();

        if (created) {
          setAdminOverviews([created as ProductOverviewGroup]);
          return;
        }
      }

      setAdminOverviews(
        rows.length > 0
          ? rows
          : [
              {
                id: FALLBACK_OVERVIEW_ID,
                tenant_id: tenantId,
                name: FALLBACK_OVERVIEW_NAME,
                slug: "produkter",
                sort_order: 0,
              },
            ]
      );
    } catch (error) {
      console.error('Error fetching product overviews:', error);
    } finally {
      setOverviewsLoaded(true);
    }
  };

  const fetchAdminCategories = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('product_categories' as any)
        .select('id, tenant_id, name, slug, sort_order, overview_id, parent_category_id, navigation_mode, frontend_product_id')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (error) {
        if (isMissingOverviewColumn(error) || isMissingHierarchyColumn(error) || isMissingFrontendCardColumn(error)) {
          const fallback = await supabase
            .from('product_categories' as any)
            .select('id, tenant_id, name, slug, sort_order')
            .eq('tenant_id', tenantId)
            .order('sort_order');

          if (fallback.error) throw fallback.error;
          setAdminCategories(
            ((fallback.data as ProductCategory[]) || []).map((row) => ({
              ...row,
              overview_id: FALLBACK_OVERVIEW_ID,
              parent_category_id: null,
              navigation_mode: 'all_in_one',
              frontend_product_id: null,
            }))
          );
          return;
        }
        throw error;
      }

      const rows = (data as ProductCategory[]) || [];
      setAdminCategories(
        rows.map((row) => ({
          ...row,
          overview_id: row.overview_id ?? FALLBACK_OVERVIEW_ID,
          parent_category_id: row.parent_category_id ?? null,
          navigation_mode: row.navigation_mode ?? 'all_in_one',
          frontend_product_id: row.frontend_product_id ?? null,
        }))
      );
    } catch (error) {
      console.error('Error fetching admin categories:', error);
    } finally {
      setCategoriesLoaded(true);
    }
  };

  const fetchTenantsForRelease = async () => {
    if (!canDistributeToTenants) return;
    setTenantLoading(true);

    try {
      const { data, error } = await supabase
        .from('tenants' as any)
        .select("id, name, domain")
        .neq("id", MASTER_TENANT_ID)
        .order('name');

      if (error) throw error;
      setTenants((data as TenantOption[]) || []);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setTenantLoading(false);
    }
  };

  const toggleAvailableToTenants = async (id: string, currentStatus: boolean) => {
    // LOCK LF-004: Scope every mutation by tenant_id.
    if (!productsTenantId) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available_to_tenants: !currentStatus })
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;

      toast.success(!currentStatus ? 'Produkt frigivet til netværk' : 'Produkt fjernet fra netværk');
      fetchProducts();
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('Kunne ikke opdatere status');
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    // LOCK LF-004: Scope every mutation by tenant_id.
    if (!productsTenantId) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_published: !currentStatus })
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;

      toast.success(currentStatus ? 'Produkt skjult' : 'Produkt publiceret');
      fetchProducts();
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast.error('Kunne ikke opdatere produkt');
    }
  };

  const toggleReady = async (id: string, currentStatus: boolean) => {
    // LOCK LF-004: Scope every mutation by tenant_id.
    if (!productsTenantId) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_ready: !currentStatus })
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;

      toast.success(!currentStatus ? 'Produkt markeret som færdig' : 'Produkt markeret som ikke færdig');
      fetchProducts();
    } catch (error) {
      console.error('Error toggling ready status:', error);
      toast.error('Kunne ikke opdatere status');
    }
  };

  // Category management functions
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { tenantId } = await resolveAdminTenant();
      const slug = toSlug(newCategoryName.trim());
      const maxSortOrder = Math.max(0, ...adminCategories.map(c => c.sort_order || 0));
      const selectedOverviewId =
        newCategoryOverviewId && newCategoryOverviewId !== FALLBACK_OVERVIEW_ID
          ? newCategoryOverviewId
          : null;
      const parentCategoryId = newCategoryParentId !== "none" ? newCategoryParentId : null;

      const { error } = await supabase
        .from('product_categories' as any)
        .insert({
          tenant_id: tenantId,
          name: newCategoryName.trim(),
          slug,
          sort_order: maxSortOrder + 1,
          overview_id: selectedOverviewId,
          parent_category_id: parentCategoryId,
          navigation_mode: newCategoryNavigationMode,
        });

      if (error) {
        if (isMissingOverviewColumn(error) || isMissingHierarchyColumn(error)) {
          const fallbackInsert = await supabase
            .from('product_categories' as any)
            .insert({
              tenant_id: tenantId,
              name: newCategoryName.trim(),
              slug,
              sort_order: maxSortOrder + 1,
            });
          if (fallbackInsert.error) throw fallbackInsert.error;
        } else {
          throw error;
        }
      }
      toast.success('Kategori oprettet');
      setNewCategoryName('');
      setNewCategoryParentId('none');
      setNewCategoryNavigationMode('all_in_one');
      if (adminOverviews.length > 0) {
        setNewCategoryOverviewId(adminOverviews[0].id);
      }
      await fetchAdminOverviews();
      fetchAdminCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Kunne ikke oprette kategori');
    }
  };

  const updateCategory = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    if (!productsTenantId) return;
    try {
      const slug = toSlug(newName.trim());
      const { error } = await supabase
        .from('product_categories' as any)
        .update({ name: newName.trim(), slug })
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;

      // Update products that had the old category name
      const oldCategory = adminCategories.find(c => c.id === id);
      if (oldCategory && oldCategory.name !== newName.trim()) {
        await supabase
          .from('products')
          .update({ category: newName.trim() })
          .eq('category', oldCategory.name)
          .eq('tenant_id', productsTenantId);
        fetchProducts();
      }

      toast.success('Kategori opdateret');
      setEditingCategoryId(null);
      fetchAdminCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Kunne ikke opdatere kategori');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!productsTenantId) return;
    try {
      const category = adminCategories.find(c => c.id === id);
      const productsInCategory = products.filter(
        (p) => normalizeCategoryKey(p.category) === normalizeCategoryKey(category?.name)
      );
      const childCategories = adminCategories.filter((c) => c.parent_category_id === id);

      if (productsInCategory.length > 0) {
        toast.error(`Kan ikke slette - ${productsInCategory.length} produkter bruger denne kategori`);
        return;
      }
      if (childCategories.length > 0) {
        toast.error(`Kan ikke slette - ${childCategories.length} underkategorier ligger under denne kategori`);
        return;
      }

      const { error } = await supabase
        .from('product_categories' as any)
        .delete()
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;
      toast.success('Kategori slettet');
      fetchAdminCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Kunne ikke slette kategori');
    }
  };

  const moveCategoryOrder = async (id: string, direction: 'up' | 'down') => {
    if (!productsTenantId) return;
    const currentIndex = adminCategories.findIndex(c => c.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= adminCategories.length) return;

    const current = adminCategories[currentIndex];
    const target = adminCategories[targetIndex];

    try {
      await Promise.all([
        supabase.from('product_categories' as any).update({ sort_order: target.sort_order }).eq('id', current.id).eq('tenant_id', productsTenantId),
        supabase.from('product_categories' as any).update({ sort_order: current.sort_order }).eq('id', target.id).eq('tenant_id', productsTenantId),
      ]);
      fetchAdminCategories();
    } catch (error) {
      console.error('Error reordering categories:', error);
      toast.error('Kunne ikke ændre rækkefølge');
    }
  };

  const updateCategoryOverview = async (categoryId: string, overviewId: string) => {
    if (!productsTenantId) return;
    const nextOverviewId = overviewId === FALLBACK_OVERVIEW_ID ? null : overviewId;
    try {
      const { error } = await supabase
        .from('product_categories' as any)
        .update({ overview_id: nextOverviewId })
        .eq('id', categoryId)
        .eq('tenant_id', productsTenantId);

      if (error) {
        if (isMissingOverviewColumn(error)) {
          toast.error('Overblik-funktionen kræver nyeste database migration.');
          return;
        }
        throw error;
      }

      toast.success('Kategori flyttet til nyt overblik');
      fetchAdminCategories();
    } catch (error) {
      console.error('Error updating category overview:', error);
      toast.error('Kunne ikke flytte kategori til overblik');
    }
  };

  const updateCategoryParent = async (categoryId: string, parentCategoryId: string) => {
    if (!productsTenantId) return;
    const nextParentId = parentCategoryId === "none" ? null : parentCategoryId;
    if (nextParentId === categoryId) {
      toast.error('En kategori kan ikke være sin egen overkategori');
      return;
    }
    try {
      const { error } = await supabase
        .from('product_categories' as any)
        .update({ parent_category_id: nextParentId })
        .eq('id', categoryId)
        .eq('tenant_id', productsTenantId);

      if (error) {
        if (isMissingHierarchyColumn(error)) {
          toast.error('Underkategori-funktionen kræver nyeste database migration.');
          return;
        }
        throw error;
      }

      toast.success('Kategoriens placering opdateret');
      fetchAdminCategories();
    } catch (error) {
      console.error('Error updating category parent:', error);
      toast.error('Kunne ikke opdatere kategoriens placering');
    }
  };

  const updateCategoryNavigationMode = async (categoryId: string, navigationMode: "all_in_one" | "submenu") => {
    if (!productsTenantId) return;
    try {
      const { error } = await supabase
        .from('product_categories' as any)
        .update({ navigation_mode: navigationMode })
        .eq('id', categoryId)
        .eq('tenant_id', productsTenantId);

      if (error) {
        if (isMissingHierarchyColumn(error)) {
          toast.error('Visnings-tilstanden kræver nyeste database migration.');
          return;
        }
        throw error;
      }

      toast.success('Kategoriens visning er opdateret');
      fetchAdminCategories();
    } catch (error) {
      console.error('Error updating category navigation mode:', error);
      toast.error('Kunne ikke opdatere visnings-tilstanden');
    }
  };

  const updateCategoryFrontendProduct = async (categoryId: string, productId: string) => {
    if (!productsTenantId) return;
    const nextProductId = productId === "none" ? null : productId;
    try {
      const { error } = await supabase
        .from('product_categories' as any)
        .update({ frontend_product_id: nextProductId })
        .eq('id', categoryId)
        .eq('tenant_id', productsTenantId);

      if (error) {
        if (isMissingFrontendCardColumn(error)) {
          toast.error('Frontend-kort kræver nyeste database migration.');
          return;
        }
        throw error;
      }

      toast.success(nextProductId ? 'Kategoriens frontkort er opdateret' : 'Kategoriens frontkort er fjernet');
      fetchAdminCategories();
    } catch (error) {
      console.error('Error updating category frontend product:', error);
      toast.error('Kunne ikke opdatere kategoriens frontkort');
    }
  };

  const addOverview = async () => {
    if (!newOverviewName.trim()) return;
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const slug = toSlug(newOverviewName.trim());
      const maxSortOrder = Math.max(0, ...adminOverviews.map((o) => o.sort_order || 0));

      const { error } = await supabase
        .from('product_overviews' as any)
        .insert({
          tenant_id: tenantId,
          name: newOverviewName.trim(),
          slug,
          sort_order: maxSortOrder + 1,
        });

      if (error) {
        if (isMissingProductOverviewsTable(error)) {
          toast.error('Overblik-funktionen kræver nyeste database migration.');
          return;
        }
        throw error;
      }

      toast.success('Overblik oprettet');
      setNewOverviewName('');
      fetchAdminOverviews();
    } catch (error) {
      console.error('Error adding overview:', error);
      toast.error('Kunne ikke oprette overblik');
    }
  };

  const updateOverview = async (id: string, newName: string) => {
    if (!productsTenantId || !newName.trim()) return;
    try {
      const slug = toSlug(newName.trim());
      const { error } = await supabase
        .from('product_overviews' as any)
        .update({ name: newName.trim(), slug })
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;
      toast.success('Overblik opdateret');
      setEditingOverviewId(null);
      fetchAdminOverviews();
    } catch (error) {
      if (isMissingProductOverviewsTable(error)) {
        toast.error('Overblik-funktionen kræver nyeste database migration.');
        return;
      }
      console.error('Error updating overview:', error);
      toast.error('Kunne ikke opdatere overblik');
    }
  };

  const deleteOverview = async (id: string) => {
    if (!productsTenantId) return;
    const categoriesInOverview = adminCategories.filter((cat) => (cat.overview_id || FALLBACK_OVERVIEW_ID) === id);
    if (categoriesInOverview.length > 0) {
      toast.error(`Kan ikke slette - ${categoriesInOverview.length} kategorier ligger i dette overblik`);
      return;
    }

    try {
      const { error } = await supabase
        .from('product_overviews' as any)
        .delete()
        .eq('id', id)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;
      toast.success('Overblik slettet');
      fetchAdminOverviews();
    } catch (error) {
      if (isMissingProductOverviewsTable(error)) {
        toast.error('Overblik-funktionen kræver nyeste database migration.');
        return;
      }
      console.error('Error deleting overview:', error);
      toast.error('Kunne ikke slette overblik');
    }
  };

  const moveOverviewOrder = async (id: string, direction: 'up' | 'down') => {
    if (!productsTenantId) return;
    const currentIndex = adminOverviews.findIndex((o) => o.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= adminOverviews.length) return;

    const current = adminOverviews[currentIndex];
    const target = adminOverviews[targetIndex];

    try {
      await Promise.all([
        supabase.from('product_overviews' as any).update({ sort_order: target.sort_order }).eq('id', current.id).eq('tenant_id', productsTenantId),
        supabase.from('product_overviews' as any).update({ sort_order: current.sort_order }).eq('id', target.id).eq('tenant_id', productsTenantId),
      ]);
      fetchAdminOverviews();
    } catch (error) {
      if (isMissingProductOverviewsTable(error)) {
        toast.error('Overblik-funktionen kræver nyeste database migration.');
        return;
      }
      console.error('Error reordering overviews:', error);
      toast.error('Kunne ikke ændre overbliks-rækkefølge');
    }
  };

  const updateProductCategory = async (productId: string, newCategory: string) => {
    if (!newCategory || !productId) return;
    if (!productsTenantId) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ category: newCategory })
        .eq('id', productId)
        .eq('tenant_id', productsTenantId);

      if (error) throw error;
      toast.success('Produkt flyttet til ny kategori');
      fetchProducts();
    } catch (error: any) {
      console.error('Error updating product category:', error);
      toast.error('Kunne ikke opdatere kategori: ' + (error?.message || 'Ukendt fejl'));
    }
  };

  const toggleCategoryCollapsed = (categoryName: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      localStorage.setItem('admin-product-categories-collapsed', JSON.stringify([...next]));
      return next;
    });
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!productsTenantId) return;
    try {
      const { error } = await supabase.rpc('delete_product_with_payload' as any, {
        target_product_id: id,
      });

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
      const { error } = await supabase.rpc('duplicate_product_with_payload' as any, {
        source_product_id: product.id,
      });

      if (error) throw error;

      toast.success(`Produkt duplikeret som "${product.name} (kopi)"`);
      fetchProducts();
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Kunne ikke duplikere produkt');
    }
  };

  const openSendDialog = (product: Product) => {
    if (!canDistributeToTenants) {
      toast.error("Denne handling kræver Master-tenant kontekst.");
      return;
    }
    setDialogProduct(product);
    setSelectedTenantIds([]);
    setTenantFilter("");
    setSendDialogOpen(true);
  };

  const closeSendDialog = () => {
    setSendDialogOpen(false);
    setDialogProduct(null);
    setSelectedTenantIds([]);
    setTenantFilter("");
  };

  const openCloneDialog = (product: Product) => {
    if (!canDistributeToTenants) {
      toast.error("Denne handling kræver Master-tenant kontekst.");
      return;
    }
    setCloneProduct(product);
    setCloneDialogOpen(true);
  };

  const handleTenantToggle = (tenantId: string) => {
    setSelectedTenantIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId],
    );
  };

  const handleSendToTenants = async () => {
    if (!canDistributeToTenants) {
      toast.error("Denne handling kræver Master-tenant kontekst.");
      return;
    }
    if (!dialogProduct) return;
    if (selectedTenantIds.length === 0) {
      toast.error("Vælg mindst én lejer.");
      return;
    }

    setSending(true);
    try {
      const { error, data } = await supabase.rpc("send_product_to_tenants" as any, {
        master_product_id: dialogProduct.id,
        tenant_ids: selectedTenantIds,
        delivery_mode: deliveryMode,
      });

      if (error) throw error;

      const copied = Number((data as any)?.copied || 0);
      const notified = Number((data as any)?.notified || 0);
      const skippedExisting = Number((data as any)?.skipped_existing || 0);

      if (copied > 0 && notified === 0 && skippedExisting === 0) {
        toast.success(`${copied} produktkopier sendt til lejere.`);
      } else if (copied === 0 && notified === 0 && skippedExisting > 0) {
        toast.success(`${skippedExisting} lejere har allerede produktet.`);
      } else if (copied > 0 && skippedExisting > 0 && notified === 0) {
        toast.success(`${copied} nye produktkopier sendt. ${skippedExisting} lejere havde allerede produktet.`);
      } else if (notified > 0 && copied === 0) {
        toast.success(`${notified} notifikationer sendt til lejere.`);
      } else {
        const total = Number((data as any)?.sent || selectedTenantIds.length);
        toast.success(`${total} leveringer udført til lejere.`);
      }
      closeSendDialog();
    } catch (error) {
      console.error("Error sending product notifications:", error);
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      toast.error(`Kunne ikke sende produkt til lejere: ${message}`);
    } finally {
      setSending(false);
    }
  };

  // Filter products by search query
  const searchFilteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const allOverviewOptions = useMemo(() => {
    if (adminOverviews.length > 0) return adminOverviews;
    return [
      {
        id: FALLBACK_OVERVIEW_ID,
        tenant_id: productsTenantId || MASTER_TENANT_ID,
        name: FALLBACK_OVERVIEW_NAME,
        slug: 'produkter',
        sort_order: 0,
      } satisfies ProductOverviewGroup,
    ];
  }, [adminOverviews, productsTenantId]);

  useEffect(() => {
    if (allOverviewOptions.length === 0) return;
    const hasCurrent = allOverviewOptions.some((overview) => overview.id === selectedOverviewId);
    if (!hasCurrent) {
      setSelectedOverviewId(allOverviewOptions[0].id);
      setSelectedCategory("Alle");
    }
  }, [allOverviewOptions, selectedOverviewId]);

  const sortedAdminCategories = useMemo(() => {
    return [...adminCategories].sort((a, b) => {
      const orderA = a.sort_order ?? 999;
      const orderB = b.sort_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'da');
    });
  }, [adminCategories]);

  const categoryChildrenByParentId = useMemo(() => {
    const map = new Map<string, ProductCategory[]>();
    sortedAdminCategories.forEach((category) => {
      const parentId = category.parent_category_id || '__root__';
      const existing = map.get(parentId) || [];
      existing.push(category);
      map.set(parentId, existing);
    });
    return map;
  }, [sortedAdminCategories]);

  const categoryOptions = useMemo(() => {
    const options: Array<{ id: string; name: string; label: string; overviewId: string }> = [];

    const walk = (parentId: string | null, depth: number, overviewId: string) => {
      const rows = (categoryChildrenByParentId.get(parentId || '__root__') || [])
        .filter((row) => (row.overview_id || FALLBACK_OVERVIEW_ID) === overviewId)
        .sort((a, b) => {
          const orderA = a.sort_order ?? 999;
          const orderB = b.sort_order ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'da');
        });

      rows.forEach((row) => {
        options.push({
          id: row.id,
          name: row.name,
          label: `${'— '.repeat(depth)}${row.name}`,
          overviewId,
        });
        walk(row.id, depth + 1, overviewId);
      });
    };

    allOverviewOptions.forEach((overview) => {
      walk(null, 0, overview.id);
    });

    return options;
  }, [allOverviewOptions, categoryChildrenByParentId]);

  const categoryOverviewByKey = useMemo(() => {
    return new Map(
      sortedAdminCategories.map((category) => [
        normalizeCategoryKey(category.name),
        category.overview_id || FALLBACK_OVERVIEW_ID,
      ])
    );
  }, [sortedAdminCategories]);

  const canonicalCategoryNameByKey = useMemo(() => {
    return new Map(
      sortedAdminCategories.map((category) => [normalizeCategoryKey(category.name), category.name])
    );
  }, [sortedAdminCategories]);

  const getCanonicalCategoryName = useMemo(() => {
    return (categoryName?: string | null) => {
      const raw = String(categoryName || "").trim();
      if (!raw) return 'Ukategoriseret';
      return canonicalCategoryNameByKey.get(normalizeCategoryKey(raw)) || raw;
    };
  }, [canonicalCategoryNameByKey]);

  const overviewAllProducts = useMemo(() => {
    return searchFilteredProducts.filter((product) => {
      const category = getCanonicalCategoryName(product.category);
      const overviewId = categoryOverviewByKey.get(normalizeCategoryKey(category)) || FALLBACK_OVERVIEW_ID;
      return overviewId === selectedOverviewId;
    });
  }, [searchFilteredProducts, categoryOverviewByKey, getCanonicalCategoryName, selectedOverviewId]);

  const overviewFilteredProducts = useMemo(() => {
    return overviewAllProducts.filter((product) => {
      const category = getCanonicalCategoryName(product.category);
      return selectedCategory === "Alle" || category === selectedCategory;
    });
  }, [overviewAllProducts, selectedCategory, getCanonicalCategoryName]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    overviewFilteredProducts.forEach((product) => {
      const category = getCanonicalCategoryName(product.category);
      const existing = map.get(category) || [];
      existing.push(product);
      map.set(category, existing);
    });
    return map;
  }, [overviewFilteredProducts, getCanonicalCategoryName]);

  const categories = useMemo(() => {
    const overviewCategoryNames = sortedAdminCategories
      .filter((cat) => (cat.overview_id || FALLBACK_OVERVIEW_ID) === selectedOverviewId)
      .map((cat) => cat.name);

    const orphanNames = selectedOverviewId === FALLBACK_OVERVIEW_ID
      ? Array.from(new Set(searchFilteredProducts
          .map((product) => getCanonicalCategoryName(product.category))
          .filter((categoryName) => !categoryOverviewByKey.has(normalizeCategoryKey(categoryName)))))
      : [];

    const allNames = new Set([...overviewCategoryNames, ...orphanNames]);
    return [
      "Alle",
      ...Array.from(allNames).sort((a, b) => {
        const orderA = sortedAdminCategories.find(c => c.name === a)?.sort_order ?? 999;
        const orderB = sortedAdminCategories.find(c => c.name === b)?.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b, 'da');
      }),
    ];
  }, [selectedOverviewId, sortedAdminCategories, searchFilteredProducts, categoryOverviewByKey, getCanonicalCategoryName]);

  useEffect(() => {
    if (categories.includes(selectedCategory)) return;
    setSelectedCategory("Alle");
  }, [categories, selectedCategory]);

  const isFilteringProducts = searchQuery !== "" || selectedCategory !== "Alle";

  const categoriesByOverview = useMemo(() => {
    const map = new Map<string, ProductCategory[]>();
    sortedAdminCategories.forEach((category) => {
      const overviewId = category.overview_id || FALLBACK_OVERVIEW_ID;
      const existing = map.get(overviewId) || [];
      existing.push(category);
      map.set(overviewId, existing);
    });
    return map;
  }, [sortedAdminCategories]);

  const overviewSections = useMemo(() => {
    const sortedOverviews = [...allOverviewOptions]
      .sort((a, b) => {
      const orderA = a.sort_order ?? 999;
      const orderB = b.sort_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'da');
      })
      .filter((overview) => overview.id === selectedOverviewId);

    const sections = sortedOverviews.map((overview) => {
      const categories = sortedAdminCategories
        .filter((cat) => (cat.overview_id || FALLBACK_OVERVIEW_ID) === overview.id)
        .map((cat) => ({
          categoryName: cat.name,
          categoryOrder: cat.sort_order ?? 999,
          products: productsByCategory.get(cat.name) || [],
        }));

      return {
        overviewId: overview.id,
        overviewName: overview.name,
        categories,
      };
    });

    // Show categories that exist on products but are not in admin_categories yet.
    const knownCategoryNames = new Set(sortedAdminCategories.map((cat) => cat.name));
    const orphanCategoryNames = Array.from(productsByCategory.keys())
      .filter((categoryName) => !knownCategoryNames.has(categoryName))
      .sort((a, b) => a.localeCompare(b, 'da'));

    if (orphanCategoryNames.length > 0) {
      const fallbackOverviewIndex = sections.findIndex((s) => s.overviewId === FALLBACK_OVERVIEW_ID);
      const fallbackTarget = fallbackOverviewIndex >= 0
        ? sections[fallbackOverviewIndex]
        : {
            overviewId: FALLBACK_OVERVIEW_ID,
            overviewName: FALLBACK_OVERVIEW_NAME,
            categories: [] as { categoryName: string; categoryOrder: number; products: Product[] }[],
          };

      orphanCategoryNames.forEach((categoryName, idx) => {
        fallbackTarget.categories.push({
          categoryName,
          categoryOrder: 1000 + idx,
          products: productsByCategory.get(categoryName) || [],
        });
      });

      if (fallbackOverviewIndex < 0) {
        sections.push(fallbackTarget);
      }
    }

    return sections
      .map((section) => ({
        ...section,
        categories: section.categories
          .sort((a, b) => {
            if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
            return a.categoryName.localeCompare(b.categoryName, 'da');
          })
          .filter((category) => !isFilteringProducts || category.products.length > 0),
      }))
      .filter((section) => section.categories.length > 0 || !isFilteringProducts);
  }, [allOverviewOptions, selectedOverviewId, sortedAdminCategories, productsByCategory, isFilteringProducts]);

  // Get all category names for the dropdown (from adminCategories + existing product categories)
  const allCategoryNames = useMemo(() => {
    const names = new Set([
      ...adminCategories.map(c => c.name),
      ...products.map(p => getCanonicalCategoryName(p.category)).filter(Boolean) as string[],
    ]);
    return Array.from(names).sort((a, b) => {
      const orderA = adminCategories.find(c => c.name === a)?.sort_order ?? 999;
      const orderB = adminCategories.find(c => c.name === b)?.sort_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'da');
    });
  }, [adminCategories, products, getCanonicalCategoryName]);

  const getOverviewIdForCategory = (categoryName?: string | null) => {
    if (!categoryName) return FALLBACK_OVERVIEW_ID;
    return categoryOverviewByKey.get(normalizeCategoryKey(categoryName)) || FALLBACK_OVERVIEW_ID;
  };

  const updateProductOverview = async (product: Product, targetOverviewId: string) => {
    const currentOverviewId = getOverviewIdForCategory(product.category);
    if (currentOverviewId === targetOverviewId) return;

    const targetCategories = categoriesByOverview.get(targetOverviewId) || [];
    if (targetCategories.length === 0) {
      toast.error('Opret først en kategori i det valgte overblik');
      return;
    }

    const preferredCategory =
      targetCategories.find((category) => normalizeCategoryKey(category.name) === normalizeCategoryKey(product.category)) ||
      [...targetCategories].sort((a, b) => {
        const orderA = a.sort_order ?? 999;
        const orderB = b.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'da');
      })[0];

    await updateProductCategory(product.id, preferredCategory.name);
    toast.success(`Produkt flyttet til overblik "${allOverviewOptions.find((o) => o.id === targetOverviewId)?.name || ''}"`);
  };

  const filteredTenants = tenants.filter((tenant) => {
    const search = tenantFilter.trim().toLowerCase();
    if (!search) return true;
    return (
      tenant.name.toLowerCase().includes(search) ||
      (tenant.domain || "").toLowerCase().includes(search)
    );
  });
  const tenantCount = tenants.length;
  const taxonomyLoading = !overviewsLoaded || !categoriesLoaded;

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
      <ProductCloneDialog
        isOpen={cloneDialogOpen}
        onClose={() => setCloneDialogOpen(false)}
        product={cloneProduct}
      />

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Administrer Kategorier
            </DialogTitle>
            <DialogDescription>
              Opret, omdøb og sorter hovedoverblik og produktkategorier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Hovedoversigter</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nyt overblik navn..."
                  value={newOverviewName}
                  onChange={(e) => setNewOverviewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addOverview()}
                />
                <Button onClick={addOverview} size="icon" disabled={!newOverviewName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {allOverviewOptions.map((overview, index) => {
                  const categoryCount = adminCategories.filter(
                    (cat) => (cat.overview_id || FALLBACK_OVERVIEW_ID) === overview.id
                  ).length;
                  return (
                    <div
                      key={overview.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50"
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveOverviewOrder(overview.id, 'up')}
                          disabled={index === 0 || overview.id === FALLBACK_OVERVIEW_ID}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveOverviewOrder(overview.id, 'down')}
                          disabled={index === allOverviewOptions.length - 1 || overview.id === FALLBACK_OVERVIEW_ID}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingOverviewId === overview.id ? (
                          <Input
                            value={editingOverviewName}
                            onChange={(e) => setEditingOverviewName(e.target.value)}
                            onBlur={() => {
                              if (editingOverviewName.trim()) updateOverview(overview.id, editingOverviewName);
                              setEditingOverviewId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateOverview(overview.id, editingOverviewName);
                              if (e.key === 'Escape') setEditingOverviewId(null);
                            }}
                            autoFocus
                            className="h-7 text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              if (overview.id === FALLBACK_OVERVIEW_ID) return;
                              setEditingOverviewId(overview.id);
                              setEditingOverviewName(overview.name);
                            }}
                            className="text-sm font-medium truncate w-full text-left hover:text-primary"
                          >
                            {overview.name}
                          </button>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {categoryCount}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteOverview(overview.id)}
                        disabled={overview.id === FALLBACK_OVERVIEW_ID}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Kategorier</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ny kategori navn..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  />
                  <Button onClick={addCategory} size="icon" disabled={!newCategoryName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Select value={newCategoryOverviewId} onValueChange={setNewCategoryOverviewId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Vælg overblik" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOverviewOptions.map((overview) => (
                      <SelectItem key={overview.id} value={overview.id}>
                        {overview.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Overkategori (valgfri)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen overkategori</SelectItem>
                    {categoryOptions
                      .filter((category) => category.overviewId === newCategoryOverviewId)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={newCategoryNavigationMode} onValueChange={(value: "all_in_one" | "submenu") => setNewCategoryNavigationMode(value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Visning" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_in_one">Alt på én side</SelectItem>
                    <SelectItem value="submenu">Vis underkategorier først</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto">
                {adminCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ingen kategorier oprettet endnu
                  </p>
                ) : (
                  adminCategories.map((cat, index) => {
                    const productCount = products.filter(
                      (p) => normalizeCategoryKey(p.category) === normalizeCategoryKey(cat.name)
                    ).length;
                    const overviewId = cat.overview_id || FALLBACK_OVERVIEW_ID;
                    const currentParentId = cat.parent_category_id || 'none';
                    const frontendCardOptions = products
                      .filter((product) => getOverviewIdForCategory(product.category) === overviewId)
                      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50"
                      >
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveCategoryOrder(cat.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveCategoryOrder(cat.id, 'down')}
                            disabled={index === adminCategories.length - 1}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          {editingCategoryId === cat.id ? (
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              onBlur={() => {
                                if (editingCategoryName.trim()) {
                                  updateCategory(cat.id, editingCategoryName);
                                }
                                setEditingCategoryId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCategory(cat.id, editingCategoryName);
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryId(null);
                                }
                              }}
                              autoFocus
                              className="h-7 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                              }}
                              className="text-sm font-medium truncate w-full text-left hover:text-primary"
                            >
                              {cat.name}
                            </button>
                          )}
                          <Select
                            value={overviewId}
                            onValueChange={(value) => updateCategoryOverview(cat.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Vælg overblik" />
                            </SelectTrigger>
                            <SelectContent>
                              {allOverviewOptions.map((overview) => (
                                <SelectItem key={overview.id} value={overview.id} className="text-xs">
                                  {overview.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={currentParentId}
                            onValueChange={(value) => updateCategoryParent(cat.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Overkategori" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen overkategori</SelectItem>
                              {categoryOptions
                                .filter((category) => category.overviewId === overviewId && category.id !== cat.id)
                                .map((category) => (
                                  <SelectItem key={category.id} value={category.id} className="text-xs">
                                    {category.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={cat.navigation_mode || 'all_in_one'}
                            onValueChange={(value: "all_in_one" | "submenu") => updateCategoryNavigationMode(cat.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Visning" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_in_one" className="text-xs">Alt på én side</SelectItem>
                              <SelectItem value="submenu" className="text-xs">Vis underkategorier først</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={cat.frontend_product_id || 'none'}
                            onValueChange={(value) => updateCategoryFrontendProduct(cat.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Vælg frontkort" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Ingen frontkort</SelectItem>
                              {frontendCardOptions.map((product) => (
                                <SelectItem key={product.id} value={product.id} className="text-xs">
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Badge variant="secondary" className="text-xs">
                          {productCount}
                        </Badge>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Luk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCategoryDialogOpen(true)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                <TooltipContent>Administrer overblik og kategorier</TooltipContent>
                </Tooltip>
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
                  ({overviewFilteredProducts.length} af {overviewAllProducts.length})
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">Administrer dine produkter og priser</p>
              {!taxonomyLoading && allOverviewOptions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {allOverviewOptions
                    .slice()
                    .sort((a, b) => {
                      const orderA = a.sort_order ?? 999;
                      const orderB = b.sort_order ?? 999;
                      if (orderA !== orderB) return orderA - orderB;
                      return a.name.localeCompare(b.name, 'da');
                    })
                    .map((overview) => (
                      <button
                        key={overview.id}
                        type="button"
                        onClick={() => {
                          setSelectedOverviewId(overview.id);
                          setSelectedCategory("Alle");
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          selectedOverviewId === overview.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {overview.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <CardContent className="p-0">
              {taxonomyLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Henter overblik...
                </div>
              ) : overviewSections.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery || selectedCategory !== "Alle"
                    ? "Ingen produkter matcher din søgning."
                    : "Ingen produkter fundet."}
                </div>
              )}
              {!taxonomyLoading && overviewSections.map((overviewSection) => {
                return (
                <div key={overviewSection.overviewId} className="group border-b last:border-b-0">
                  <div className="px-6 py-2 bg-primary/5 border-b">
                    <p className="text-sm font-semibold text-primary">{overviewSection.overviewName}</p>
                  </div>

                  {overviewSection.categories.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-muted-foreground">
                      Ingen kategorier i denne oversigt endnu.
                    </div>
                  ) : (
                    overviewSection.categories.map((group) => {
                      const category = group.categoryName;
                      const categoryProducts = group.products;
                      const collapseKey = `${overviewSection.overviewId}::${category}`;
                      const isCollapsed = collapsedCategories.has(collapseKey);
                      return (
                      <div key={collapseKey}>
                        <button
                          onClick={() => toggleCategoryCollapsed(collapseKey)}
                          className="w-full cursor-pointer px-6 py-3 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize">{category.replace('_', ' ')}</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {categoryProducts.length} produkter
                            </span>
                          </div>
                          <span className={`text-muted-foreground text-sm transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▼</span>
                        </button>
                        {!isCollapsed && (
                        <>
                        {categoryProducts.length === 0 ? (
                          <div className="px-6 py-4 text-sm text-muted-foreground">
                            Ingen produkter i denne kategori endnu.
                          </div>
                        ) : (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {categoryProducts.map((product) => (
                      (() => {
                        const productOverviewId = getOverviewIdForCategory(product.category);
                        const productCategoryNames = (
                          categoriesByOverview.get(productOverviewId) || []
                        ).map((category) => category.name);

                        return (
                      <Card
                        key={product.id}
                        className={`transition-colors overflow-hidden relative ${getProductCardShellClass(product)}`}
                      >
                        {/* Ready Status Dot */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={`absolute top-2 right-2 z-10 w-3 h-3 rounded-full cursor-pointer transition-colors ${
                                product.is_ready
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : 'bg-red-500 hover:bg-red-600'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReady(product.id, !!product.is_ready);
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {product.is_ready
                              ? 'Klik for at markere som ikke færdig'
                              : 'Klik for at markere som færdig'}
                          </TooltipContent>
                        </Tooltip>
                        {product.is_ready && (
                          <div className="absolute left-2 top-2 z-10">
                            <Badge
                              variant="secondary"
                              className="border border-emerald-300 bg-emerald-100 text-emerald-800"
                            >
                              Klar
                            </Badge>
                          </div>
                        )}
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

                          {/* Overview + Category Controls */}
                          <div className="px-3 py-1.5 border-b space-y-1.5">
                            <Select
                              value={productOverviewId}
                              onValueChange={(value) => updateProductOverview(product, value)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Vælg overblik" />
                              </SelectTrigger>
                              <SelectContent>
                                {allOverviewOptions.map((overview) => (
                                  <SelectItem key={overview.id} value={overview.id} className="text-xs">
                                    {overview.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={getCanonicalCategoryName(product.category) || ''}
                              onValueChange={(value) => updateProductCategory(product.id, value)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Vælg kategori" />
                              </SelectTrigger>
                              <SelectContent>
                                {(productCategoryNames.length > 0
                                  ? categoryOptions.filter((option) => option.overviewId === productOverviewId && productCategoryNames.includes(option.name))
                                  : categoryOptions.filter((option) => option.overviewId === productOverviewId)
                                ).map((categoryOption) => (
                                  <SelectItem key={categoryOption.id} value={categoryOption.name} className="text-xs">
                                    {categoryOption.label}
                                  </SelectItem>
                                ))}
                                {(productCategoryNames.length === 0 && categoryOptions.filter((option) => option.overviewId === productOverviewId).length === 0) &&
                                  allCategoryNames.map((catName) => (
                                    <SelectItem key={catName} value={catName} className="text-xs">
                                      {catName}
                                    </SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
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
                                {product.is_published
                                  ? "Produktet er synligt i webshoppen."
                                  : "Produktet er skjult i webshoppen. Priser og opsætning bevares."}
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

                              {/* Clone to Tenant (Master Only) */}
                              {canDistributeToTenants && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCloneDialog(product);
                                      }}
                                    >
                                      <Building2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Kopier til Lejer</TooltipContent>
                                </Tooltip>
                              )}

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
                          {canDistributeToTenants && (
                            <div className="border-t border-dashed bg-blue-50/30 px-3 py-2 space-y-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium text-blue-600">
                                        {product.is_available_to_tenants ? "Frigivet" : "Privat"}
                                      </span>
                                      <AdminInlineHelp content="Gør masterproduktet tilgængeligt for deling til andre lejere. Det påvirker ikke om produktet vises i webshoppen." />
                                    </div>
                                    <Switch
                                      className="data-[state=checked]:bg-blue-600 scale-90"
                                      checked={!!product.is_available_to_tenants}
                                      onCheckedChange={() =>
                                        toggleAvailableToTenants(
                                          product.id,
                                          !!product.is_available_to_tenants,
                                        )
                                      }
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {product.is_available_to_tenants
                                    ? "Frigivet til lejere"
                                    : "Kun synlig for Master"}
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                variant="outline"
                                className="w-full justify-center gap-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSendDialog(product);
                                }}
                                disabled={tenantLoading || tenantCount === 0}
                              >
                                <Building2 className="h-3.5 w-3.5" />
                                Send til lejere
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                        );
                      })()
                    ))}
                        </div>
                        )}
                        </>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
                );
              })}
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
      <Dialog open={sendDialogOpen} onOpenChange={(open) => !open && closeSendDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send{" "}
              <span className="font-semibold">
                {dialogProduct ? `"${dialogProduct.name}"` : "produkt"}
              </span>{" "}
              til lejere
            </DialogTitle>
            <DialogDescription>
              Vælg de lejere, der skal modtage produktet som en systemopdatering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Søg efter lejer..."
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
              disabled={tenantLoading || tenantCount === 0}
            />

            <div className="border rounded-lg border-input/60 bg-background/80 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">Leverings-type</p>
                <AdminInlineHelp content="Standard pris opretter en uafhængig kopi direkte i lejerens Produkter. POD-pris sender produktet til System Updates som en master-styret import." />
              </div>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_MODES.map((mode) => (
                  <div key={mode.id} className="flex items-center gap-1">
                    <Button
                      variant={deliveryMode === mode.id ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setDeliveryMode(mode.id)}
                      className="gap-2 rounded-lg"
                    >
                      <span className="text-xs font-semibold leading-none">{mode.label}</span>
                    </Button>
                    <AdminInlineHelp content={mode.description} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {DELIVERY_MODES.find((mode) => mode.id === deliveryMode)?.description}
              </p>
            </div>

            {tenantLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Henter lejere...
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {filteredTenants.map((tenant) => {
                  const isChecked = selectedTenantIds.includes(tenant.id);
                  return (
                    <label
                      key={tenant.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:border-primary transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleTenantToggle(tenant.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium leading-none">{tenant.name}</p>
                        {tenant.domain && (
                          <p className="text-xs text-muted-foreground">{tenant.domain}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
                {!filteredTenants.length && (
                  <p className="text-sm text-muted-foreground">
                    {tenantFilter ? "Ingen lejere matcher din søgning." : "Ingen lejere fundet."}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeSendDialog} disabled={sending}>
              Annuller
            </Button>
            <Button
              onClick={handleSendToTenants}
              disabled={sending || selectedTenantIds.length === 0 || tenantLoading}
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send til {selectedTenantIds.length} {selectedTenantIds.length === 1 ? "lejer" : "lejere"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
