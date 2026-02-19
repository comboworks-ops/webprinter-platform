import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
    Upload, Trash2, LayoutGrid, Search,
    Eye, EyeOff, Loader2, Plus, RefreshCw, FileText, Image as ImageIcon, ExternalLink,
    FolderOpen, User, Layers, Copy, Check, Pencil, Settings2,
    Package, Scroll, Sparkles, X
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DesignLibraryItem } from "@/hooks/useDesignLibrary";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { CreateAttributeLibraryItemDialog, EditAttributeLibraryItemDialog, ATTRIBUTE_TYPE_LABELS, AttributeType } from "@/components/admin/ProductAttributeBuilder";
import { CategorySelector } from "./CategorySelector";

interface SavedDesign {
    id: string;
    name: string;
    preview_thumbnail_url: string | null;
    updated_at: string;
    width_mm: number;
    height_mm: number;
    product_id: string | null;
}

interface StorformatMaterialLibraryItem {
    id: string;
    name: string;
    max_width_mm: number | null;
    max_height_mm: number | null;
    tags?: string[] | null;
    created_at?: string | null;
}

interface StorformatFinishLibraryItem {
    id: string;
    name: string;
    tags?: string[] | null;
    created_at?: string | null;
}

interface StorformatProductLibraryItem {
    id: string;
    name: string;
    tags?: string[] | null;
    created_at?: string | null;
}

export default function DesignResources() {
    const [items, setItems] = useState<DesignLibraryItem[]>([]);
    const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [storformatLoading, setStorformatLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'mine' | 'skabeloner' | 'ressourcer' | 'materialer' | 'efterbehandling' | 'produkter' | 'storformat'>('mine');
    const [tenantId, setTenantId] = useState<string>();

    // Upload dialog state
    const [showUpload, setShowUpload] = useState(false);

    const [showCreateTemplate, setShowCreateTemplate] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

    // Materials, Finishes, Products state
    const [materials, setMaterials] = useState<any[]>([]);
    const [finishes, setFinishes] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [storformatMaterials, setStorformatMaterials] = useState<StorformatMaterialLibraryItem[]>([]);
    const [storformatFinishes, setStorformatFinishes] = useState<StorformatFinishLibraryItem[]>([]);
    const [storformatProducts, setStorformatProducts] = useState<StorformatProductLibraryItem[]>([]);
    const [showStorformatDialog, setShowStorformatDialog] = useState(false);
    const [showStorformatFinishDialog, setShowStorformatFinishDialog] = useState(false);
    const [showStorformatProductDialog, setShowStorformatProductDialog] = useState(false);
    const [editingStorformatMaterial, setEditingStorformatMaterial] = useState<StorformatMaterialLibraryItem | null>(null);
    const [editingStorformatFinish, setEditingStorformatFinish] = useState<StorformatFinishLibraryItem | null>(null);
    const [editingStorformatProduct, setEditingStorformatProduct] = useState<StorformatProductLibraryItem | null>(null);
    const [storformatDraft, setStorformatDraft] = useState({
        name: "",
        maxWidthCm: "",
        maxHeightCm: "",
        tags: ""
    });
    const [storformatFinishDraft, setStorformatFinishDraft] = useState({
        name: "",
        tags: ""
    });
    const [storformatProductDraft, setStorformatProductDraft] = useState({
        name: "",
        tags: ""
    });
    const [showCreateMaterial, setShowCreateMaterial] = useState(false);
    const [showCreateFinish, setShowCreateFinish] = useState(false);
    const [showCreateProduct, setShowCreateProduct] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
    const [editingFinish, setEditingFinish] = useState<any | null>(null);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [materialFilterCategory, setMaterialFilterCategory] = useState<string | null>(null);
    const [finishFilterCategory, setFinishFilterCategory] = useState<string | null>(null);
    const [productFilterCategory, setProductFilterCategory] = useState<string | null>(null);

    // Derived categories for selector
    const materialCategories = useMemo(() => Array.from(new Set(materials.map(m => m.category).filter(Boolean))).sort(), [materials]);
    const finishCategories = useMemo(() => Array.from(new Set(finishes.map(f => f.category).filter(Boolean))).sort(), [finishes]);
    const productCategories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);
    const templateCategories = useMemo(() => Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort(), [templates]);
    const [newItem, setNewItem] = useState<{
        name: string;
        description: string;
        kind: 'fabric_json' | 'svg' | 'pdf' | 'image';
        visibility: 'tenant' | 'public';
        productId?: string;
        tags: string;
    }>({
        name: "",
        description: "",
        kind: 'svg',
        visibility: 'public',
        tags: ""
    });

    // Fetch user's saved designs
    const fetchSavedDesigns = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedDesigns([]);
                return;
            }

            const { data, error } = await supabase
                .from('designer_saved_designs' as any)
                .select('id, name, preview_thumbnail_url, updated_at, width_mm, height_mm, product_id')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setSavedDesigns((data as unknown as SavedDesign[]) || []);
        } catch (error) {
            console.error('Error fetching saved designs:', error);
        }
    };

    // Fetch library items (skabeloner and ressourcer)
    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const { tenantId: resTenantId } = await resolveAdminTenant();
            if (resTenantId) setTenantId(resTenantId);

            if (!resTenantId) {
                setItems([]);
                return;
            }

            const { data, error } = await supabase
                .from('design_library_items' as any)
                .select('*')
                .or(`tenant_id.eq.${resTenantId},visibility.eq.public`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems((data as unknown as DesignLibraryItem[]) || []);
        } catch (error) {
            console.error('Error fetching design items:', error);
            toast.error('Kunne ikke hente designs');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStorformatMaterials = async (overrideTenantId?: string) => {
        const targetTenantId = overrideTenantId || tenantId;
        if (!targetTenantId) return;
        setStorformatLoading(true);
        try {
            const [materialsRes, finishesRes, productsRes, materialTemplatesRes, finishTemplatesRes, productTemplatesRes] = await Promise.all([
                supabase
                    .from('storformat_material_library' as any)
                    .select('*')
                    .eq('tenant_id', targetTenantId)
                    .order('name'),
                supabase
                    .from('storformat_finish_library' as any)
                    .select('*')
                    .eq('tenant_id', targetTenantId)
                    .order('name'),
                supabase
                    .from('storformat_product_library' as any)
                    .select('*')
                    .eq('tenant_id', targetTenantId)
                    .order('name'),
                supabase
                    .from('designer_templates' as any)
                    .select('id, name, category, width_mm, height_mm')
                    .eq('tenant_id', targetTenantId)
                    .eq('is_active', true)
                    .eq('template_type', 'material')
                    .order('name'),
                supabase
                    .from('designer_templates' as any)
                    .select('id, name, category')
                    .eq('tenant_id', targetTenantId)
                    .eq('is_active', true)
                    .eq('template_type', 'finish')
                    .order('name'),
                supabase
                    .from('designer_templates' as any)
                    .select('id, name, category')
                    .eq('tenant_id', targetTenantId)
                    .eq('is_active', true)
                    .eq('template_type', 'product')
                    .order('name'),
            ]);
            if (materialsRes.error) throw materialsRes.error;
            if (finishesRes.error) throw finishesRes.error;
            if (productsRes.error) throw productsRes.error;
            if (materialTemplatesRes.error) throw materialTemplatesRes.error;
            if (finishTemplatesRes.error) throw finishTemplatesRes.error;
            if (productTemplatesRes.error) throw productTemplatesRes.error;

            const normalizeName = (value: string) => value.trim().toLowerCase();

            const materialMap = new Map<string, StorformatMaterialLibraryItem>();
            ((materialsRes.data as StorformatMaterialLibraryItem[]) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    materialMap.set(normalizeName(item.name), item);
                });
            ((materialTemplatesRes.data as Array<any>) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    const key = normalizeName(item.name);
                    if (!key || materialMap.has(key)) return;
                    materialMap.set(key, {
                        id: `template-${item.id}`,
                        name: item.name,
                        max_width_mm: typeof item.width_mm === 'number' && item.width_mm > 0 ? item.width_mm : null,
                        max_height_mm: typeof item.height_mm === 'number' && item.height_mm > 0 ? item.height_mm : null,
                        tags: item.category ? [item.category] : [],
                        created_at: null,
                    });
                });

            const finishMap = new Map<string, StorformatFinishLibraryItem>();
            ((finishesRes.data as StorformatFinishLibraryItem[]) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    finishMap.set(normalizeName(item.name), item);
                });
            ((finishTemplatesRes.data as Array<any>) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    const key = normalizeName(item.name);
                    if (!key || finishMap.has(key)) return;
                    finishMap.set(key, {
                        id: `template-${item.id}`,
                        name: item.name,
                        tags: item.category ? [item.category] : [],
                        created_at: null,
                    });
                });

            const productMap = new Map<string, StorformatProductLibraryItem>();
            ((productsRes.data as StorformatProductLibraryItem[]) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    productMap.set(normalizeName(item.name), item);
                });
            ((productTemplatesRes.data as Array<any>) || [])
                .filter((item) => !!item?.name)
                .forEach((item) => {
                    const key = normalizeName(item.name);
                    if (!key || productMap.has(key)) return;
                    productMap.set(key, {
                        id: `template-${item.id}`,
                        name: item.name,
                        tags: item.category ? [item.category] : [],
                        created_at: null,
                    });
                });

            setStorformatMaterials(Array.from(materialMap.values()));
            setStorformatFinishes(Array.from(finishMap.values()));
            setStorformatProducts(Array.from(productMap.values()));
        } catch (error) {
            console.error('Error fetching storformat libraries:', error);
        } finally {
            setStorformatLoading(false);
        }
    };

    const openCreateStorformat = () => {
        setEditingStorformatMaterial(null);
        setStorformatDraft({
            name: "",
            maxWidthCm: "",
            maxHeightCm: "",
            tags: ""
        });
        setShowStorformatDialog(true);
    };

    const openEditStorformat = (item: StorformatMaterialLibraryItem) => {
        setEditingStorformatMaterial(item);
        setStorformatDraft({
            name: item.name || "",
            maxWidthCm: item.max_width_mm ? String(item.max_width_mm / 10) : "",
            maxHeightCm: item.max_height_mm ? String(item.max_height_mm / 10) : "",
            tags: (item.tags || []).join(", ")
        });
        setShowStorformatDialog(true);
    };

    const handleSaveStorformatMaterial = async () => {
        if (!tenantId) {
            toast.error("Tenant mangler");
            return;
        }
        const name = storformatDraft.name.trim();
        if (!name) {
            toast.error("Indtast et navn");
            return;
        }
        const payload = {
            tenant_id: tenantId,
            name,
            max_width_mm: storformatDraft.maxWidthCm ? Number(storformatDraft.maxWidthCm) * 10 : null,
            max_height_mm: storformatDraft.maxHeightCm ? Number(storformatDraft.maxHeightCm) * 10 : null,
            tags: storformatDraft.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
        };
        try {
            if (editingStorformatMaterial?.id) {
                const { error } = await supabase
                    .from("storformat_material_library" as any)
                    .update({
                        name: payload.name,
                        max_width_mm: payload.max_width_mm,
                        max_height_mm: payload.max_height_mm,
                        tags: payload.tags
                    })
                    .eq("id", editingStorformatMaterial.id);
                if (error) throw error;
                toast.success("Storformat materiale opdateret");
            } else {
                const { error } = await supabase
                    .from("storformat_material_library" as any)
                    .insert(payload);
                if (error) throw error;
                toast.success("Storformat materiale oprettet");
            }
            setShowStorformatDialog(false);
            setEditingStorformatMaterial(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error saving storformat material:", error);
            toast.error("Kunne ikke gemme storformat materiale");
        }
    };

    const handleDeleteStorformatMaterial = async () => {
        if (!editingStorformatMaterial?.id) return;
        if (!confirm("Slet dette storformat materiale?")) return;
        try {
            const { error } = await supabase
                .from("storformat_material_library" as any)
                .delete()
                .eq("id", editingStorformatMaterial.id);
            if (error) throw error;
            toast.success("Storformat materiale slettet");
            setShowStorformatDialog(false);
            setEditingStorformatMaterial(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error deleting storformat material:", error);
            toast.error("Kunne ikke slette storformat materiale");
        }
    };

    const openCreateStorformatFinish = () => {
        setEditingStorformatFinish(null);
        setStorformatFinishDraft({
            name: "",
            tags: ""
        });
        setShowStorformatFinishDialog(true);
    };

    const openEditStorformatFinish = (item: StorformatFinishLibraryItem) => {
        setEditingStorformatFinish(item);
        setStorformatFinishDraft({
            name: item.name || "",
            tags: (item.tags || []).join(", ")
        });
        setShowStorformatFinishDialog(true);
    };

    const handleSaveStorformatFinish = async () => {
        if (!tenantId) {
            toast.error("Tenant mangler");
            return;
        }
        const name = storformatFinishDraft.name.trim();
        if (!name) {
            toast.error("Indtast et navn");
            return;
        }
        const payload = {
            tenant_id: tenantId,
            name,
            tags: storformatFinishDraft.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
        };
        try {
            if (editingStorformatFinish?.id) {
                const { error } = await supabase
                    .from("storformat_finish_library" as any)
                    .update({
                        name: payload.name,
                        tags: payload.tags
                    })
                    .eq("id", editingStorformatFinish.id);
                if (error) throw error;
                toast.success("Storformat efterbehandling opdateret");
            } else {
                const { error } = await supabase
                    .from("storformat_finish_library" as any)
                    .insert(payload);
                if (error) throw error;
                toast.success("Storformat efterbehandling oprettet");
            }
            setShowStorformatFinishDialog(false);
            setEditingStorformatFinish(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error saving storformat finish:", error);
            toast.error("Kunne ikke gemme efterbehandling");
        }
    };

    const handleDeleteStorformatFinish = async () => {
        if (!editingStorformatFinish?.id) return;
        if (!confirm("Slet denne efterbehandling?")) return;
        try {
            const { error } = await supabase
                .from("storformat_finish_library" as any)
                .delete()
                .eq("id", editingStorformatFinish.id);
            if (error) throw error;
            toast.success("Efterbehandling slettet");
            setShowStorformatFinishDialog(false);
            setEditingStorformatFinish(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error deleting storformat finish:", error);
            toast.error("Kunne ikke slette efterbehandling");
        }
    };

    const openCreateStorformatProduct = () => {
        setEditingStorformatProduct(null);
        setStorformatProductDraft({
            name: "",
            tags: ""
        });
        setShowStorformatProductDialog(true);
    };

    const openEditStorformatProduct = (item: StorformatProductLibraryItem) => {
        setEditingStorformatProduct(item);
        setStorformatProductDraft({
            name: item.name || "",
            tags: (item.tags || []).join(", ")
        });
        setShowStorformatProductDialog(true);
    };

    const handleSaveStorformatProduct = async () => {
        if (!tenantId) {
            toast.error("Tenant mangler");
            return;
        }
        const name = storformatProductDraft.name.trim();
        if (!name) {
            toast.error("Indtast et navn");
            return;
        }
        const payload = {
            tenant_id: tenantId,
            name,
            tags: storformatProductDraft.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
        };
        try {
            if (editingStorformatProduct?.id) {
                const { error } = await supabase
                    .from("storformat_product_library" as any)
                    .update({
                        name: payload.name,
                        tags: payload.tags
                    })
                    .eq("id", editingStorformatProduct.id);
                if (error) throw error;
                toast.success("Storformat produkt opdateret");
            } else {
                const { error } = await supabase
                    .from("storformat_product_library" as any)
                    .insert(payload);
                if (error) throw error;
                toast.success("Storformat produkt oprettet");
            }
            setShowStorformatProductDialog(false);
            setEditingStorformatProduct(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error saving storformat product:", error);
            toast.error("Kunne ikke gemme produkt");
        }
    };

    const handleDeleteStorformatProduct = async () => {
        if (!editingStorformatProduct?.id) return;
        if (!confirm("Slet dette produkt?")) return;
        try {
            const { error } = await supabase
                .from("storformat_product_library" as any)
                .delete()
                .eq("id", editingStorformatProduct.id);
            if (error) throw error;
            toast.success("Produkt slettet");
            setShowStorformatProductDialog(false);
            setEditingStorformatProduct(null);
            fetchStorformatMaterials();
        } catch (error) {
            console.error("Error deleting storformat product:", error);
            toast.error("Kunne ikke slette produkt");
        }
    };

    // Fetch format templates (excluding materials, finishes, and products)
    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .order('category')
                .order('name');

            if (error) throw error;

            // Filter out materials, finishes, and products - keep only format templates
            const formatTemplates = (data || []).filter((t: any) =>
                !t.template_type || !['material', 'finish', 'product'].includes(t.template_type)
            );
            setTemplates(formatTemplates);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    // Fetch attribute library items
    const fetchAttributes = async () => {
        try {
            // Fetch Materials
            const { data: matData } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .eq('template_type', 'material')
                .order('category')
                .order('name');
            setMaterials(matData || []);

            // Fetch Finishes
            const { data: finData } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .eq('template_type', 'finish')
                .order('category')
                .order('name');
            setFinishes(finData || []);

            // Fetch Products
            const { data: prodData } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .eq('template_type', 'product')
                .order('category')
                .order('name');
            setProducts(prodData || []);
        } catch (error) {
            console.error('Error fetching attributes:', error);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchSavedDesigns();
        fetchTemplates();
        fetchAttributes();
    }, []);

    useEffect(() => {
        if (tenantId) {
            fetchStorformatMaterials(tenantId);
        }
    }, [tenantId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple kind detection based on extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        let kind: 'svg' | 'pdf' | 'image' | 'fabric_json' = 'image';
        if (ext === 'svg') kind = 'svg';
        else if (ext === 'pdf') kind = 'pdf';

        setNewItem(prev => ({ ...prev, name: file.name.split('.')[0], kind }));

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { tenantId } = await resolveAdminTenant();

            if (!tenantId) throw new Error("No tenant found");

            const itemId = crypto.randomUUID();
            const filePath = `${tenantId}/${itemId}/source.${ext}`;

            // 1. Upload source file
            const { error: uploadError } = await supabase.storage
                .from('design-library')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Create database record (without preview for now, or use same as source if image)
            const { error: insertError } = await supabase
                .from('design_library_items' as any)
                .insert({
                    id: itemId,
                    tenant_id: tenantId,
                    name: newItem.name || file.name.split('.')[0],
                    description: newItem.description,
                    kind,
                    visibility: newItem.visibility,
                    storage_path: filePath,
                    tags: newItem.tags.split(',').map(t => t.trim()).filter(Boolean),
                    created_by: user?.id
                });

            if (insertError) throw insertError;

            toast.success('Design uploadet');
            setShowUpload(false);
            fetchItems();
        } catch (error) {
            console.error('Error uploading design:', error);
            toast.error('Kunne ikke uploade design');
        } finally {
            setUploading(false);
        }
    };

    const toggleVisibility = async (item: DesignLibraryItem) => {
        try {
            const newVisibility = item.visibility === 'public' ? 'tenant' : 'public';
            const { error } = await supabase
                .from('design_library_items' as any)
                .update({ visibility: newVisibility })
                .eq('id', item.id);

            if (error) throw error;
            toast.success(`Synlighed ændret til ${newVisibility}`);
            fetchItems();
        } catch (error) {
            console.error('Error toggling visibility:', error);
            toast.error('Kunne ikke ændre synlighed');
        }
    };

    const deleteItem = async (item: DesignLibraryItem) => {
        try {
            // Remove from storage
            if (item.storage_path) {
                await supabase.storage.from('design-library').remove([item.storage_path]);
            }
            if (item.preview_path) {
                await supabase.storage.from('design-library').remove([item.preview_path]);
            }

            const { error } = await supabase
                .from('design_library_items' as any)
                .delete()
                .eq('id', item.id);

            if (error) throw error;
            toast.success('Design slettet');
            fetchItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error('Kunne ikke slette design');
        }
    };

    const deleteSavedDesign = async (design: SavedDesign) => {
        try {
            const { error } = await supabase
                .from('designer_saved_designs' as any)
                .delete()
                .eq('id', design.id);

            if (error) throw error;
            toast.success('Design slettet');
            fetchSavedDesigns();
        } catch (error) {
            console.error('Error deleting saved design:', error);
            toast.error('Kunne ikke slette design');
        }
    };

    const openDesignInEditor = (designId: string) => {
        window.open(`/designer?designId=${designId}`, '_blank');
    };

    const handleCopyTemplate = async (template: any) => {
        try {
            const { id, created_at, updated_at, ...rest } = template;
            const { error } = await supabase
                .from('designer_templates' as any)
                .insert({
                    ...rest,
                    name: `${template.name} (Kopi)`,
                    category: 'User Format'
                });

            if (error) throw error;
            toast.success('Skabelon kopieret');
            fetchTemplates();
        } catch (error) {
            console.error('Error copying template:', error);
            toast.error('Kunne ikke kopiere skabelon');
        }
    };

    const handleDeleteTemplate = async (template: any) => {
        try {
            const { error } = await supabase
                .from('designer_templates' as any)
                .delete()
                .eq('id', template.id);

            if (error) throw error;
            toast.success('Skabelon slettet');
            fetchTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
            toast.error('Kunne ikke slette skabelon');
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSavedDesigns = savedDesigns.filter(design =>
        design.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort();

    const filteredTemplates = templates.filter(template => {
        if (filterCategory && template.category !== filterCategory) return false;
        return true;
    });

    const filteredStorformatMaterials = storformatMaterials.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const filteredStorformatFinishes = storformatFinishes.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const filteredStorformatProducts = storformatProducts.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Design Bibliotek</h1>
                    <p className="text-muted-foreground">
                        Administrer dine gemte designs, skabeloner, materialer, produkter og ressourcer
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={showUpload} onOpenChange={setShowUpload}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Nyt design
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload nyt design</DialogTitle>
                                <DialogDescription>
                                    Understøtter SVG, PDF (enkelt side) og billeder.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Synlighed</Label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={newItem.visibility === 'public'}
                                                onChange={() => setNewItem(prev => ({ ...prev, visibility: 'public' }))}
                                            />
                                            Offentlig (alle lejere)
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={newItem.visibility === 'tenant'}
                                                onChange={() => setNewItem(prev => ({ ...prev, visibility: 'tenant' }))}
                                            />
                                            Kun denne tenant
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="design-name">Navn (valgfrit - udfyldes automatisk)</Label>
                                    <Input
                                        id="design-name"
                                        placeholder="F.eks. Sommerhus Ikon"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="design-tags">Tags (komma-separeret)</Label>
                                    <Input
                                        id="design-tags"
                                        placeholder="ikon, retro, sommer, ..."
                                        value={newItem.tags}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, tags: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <label className="flex-1">
                                    <div className="flex items-center justify-center w-full px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors">
                                        {uploading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 mr-2" />
                                        )}
                                        Vælg fil og upload
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".svg,.pdf,image/*"
                                        onChange={handleUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={() => { fetchItems(); fetchSavedDesigns(); fetchStorformatMaterials(); }} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Opdater
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-7 h-auto">
                    <TabsTrigger value="mine" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <User className="w-4 h-4" />
                        <span className="hidden sm:inline">Mine</span> <span className="text-xs opacity-70">({savedDesigns.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="skabeloner" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <Layers className="w-4 h-4" />
                        <span className="hidden sm:inline">Skabeloner</span> <span className="text-xs opacity-70">({templates.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="materialer" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <Scroll className="w-4 h-4" />
                        <span className="hidden sm:inline">Materialer</span> <span className="text-xs opacity-70">({materials.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="storformat" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <LayoutGrid className="w-4 h-4" />
                        <span className="hidden sm:inline">Storformat</span> <span className="text-xs opacity-70">({storformatMaterials.length + storformatFinishes.length + storformatProducts.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="efterbehandling" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">Efterbehandling</span> <span className="text-xs opacity-70">({finishes.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="produkter" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <Package className="w-4 h-4" />
                        <span className="hidden sm:inline">Produkter</span> <span className="text-xs opacity-70">({products.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="ressourcer" className="gap-2 py-2 data-[state=inactive]:hover:text-muted-foreground data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground">
                        <FolderOpen className="w-4 h-4" />
                        <span className="hidden sm:inline">Ressourcer</span>
                    </TabsTrigger>
                </TabsList>


                <Card>
                    <CardHeader>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Søg i designs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Mine Tab - User's Saved Designs */}
                        <TabsContent value="mine" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredSavedDesigns.length === 0 ? (
                                <div className="py-24 text-center">
                                    <User className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen gemte designs</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Dine gemte designs fra Print Designer vises her.
                                    </p>
                                    <Button onClick={() => window.open('/designer?format=A4', '_blank')}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret nyt design
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredSavedDesigns.map((design) => (
                                        <Card key={design.id} className="overflow-hidden group cursor-pointer" onClick={() => openDesignInEditor(design.id)}>
                                            <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center border-b overflow-hidden">
                                                {design.preview_thumbnail_url ? (
                                                    <img
                                                        src={design.preview_thumbnail_url}
                                                        alt={design.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <div className="text-center">
                                                        <Layers className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                                                        <p className="text-xs text-muted-foreground font-mono">
                                                            {design.width_mm}×{design.height_mm}mm
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Overlay Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={(e) => { e.stopPropagation(); openDesignInEditor(design.id); }}
                                                    >
                                                        <ExternalLink className="h-4 w-4 mr-1" />
                                                        Åbn
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Slet design?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dette sletter designet permanent. Denne handling kan ikke fortrydes.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteSavedDesign(design); }}>Slet</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                            <CardContent className="p-3">
                                                <h4 className="font-medium text-sm truncate" title={design.name}>{design.name}</h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(design.updated_at).toLocaleDateString('da-DK')}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Skabeloner Tab */}
                        <TabsContent value="skabeloner" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="py-24 text-center">
                                    <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen format-skabeloner</h3>

                                    <p className="text-muted-foreground mb-4">
                                        Opret skabeloner her.
                                    </p>
                                    <Button variant="outline" onClick={() => setShowCreateTemplate(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret skabelon
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end items-center gap-2">
                                        {categories.length > 0 && (
                                            <div className="flex gap-2 mr-auto overflow-x-auto pb-1 max-w-[60%]">
                                                <Badge
                                                    variant={filterCategory === null ? "default" : "outline"}
                                                    className="cursor-pointer whitespace-nowrap"
                                                    onClick={() => setFilterCategory(null)}
                                                >
                                                    Alle
                                                </Badge>
                                                {categories.map(cat => (
                                                    <Badge
                                                        key={cat}
                                                        variant={filterCategory === cat ? "default" : "outline"}
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => setFilterCategory(cat)}
                                                    >
                                                        {cat}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => setShowCreateTemplate(true)}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Opret ny skabelon
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {filteredTemplates.map((template) => (
                                            <Card key={template.id} className="overflow-hidden group cursor-pointer" onClick={() => window.open(`/designer?templateId=${template.id}`, '_blank')}>
                                                <div className="aspect-[2/1] bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center border-b px-2 py-3">
                                                    <div className="text-center">
                                                        <Layers className="w-8 h-8 text-primary/40 mx-auto" />
                                                        <p className="text-[10px] font-mono text-muted-foreground/60">
                                                            {template.width_mm}×{template.height_mm} mm
                                                        </p>
                                                    </div>

                                                    {/* Overlay Actions */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/designer?templateId=${template.id}`, '_blank'); }}
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-1" />
                                                            Åbn i Designer
                                                        </Button>
                                                    </div>
                                                </div>
                                                <CardContent className="p-3">
                                                    <h4 className="font-medium text-sm truncate" title={template.name}>{template.name}</h4>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="outline" className="text-[10px] py-0 px-1">
                                                            {template.category}
                                                        </Badge>
                                                        {template.bleed_mm > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                                                +{template.bleed_mm}mm bleed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardContent>
                                                <div className="flex justify-end p-2 pt-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopyTemplate(template); }}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); }}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Slet skabelon?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dette sletter skabelonen permanent.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Annuller</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }}>Slet</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Materialer Tab */}
                        <TabsContent value="materialer" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : materials.length === 0 ? (
                                <div className="py-24 text-center">
                                    <Scroll className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen materialer fundet</h3>
                                    <p className="text-muted-foreground mb-4">Opret materialer som Papir, Karton, mm.</p>
                                    <Button variant="outline" onClick={() => setShowCreateMaterial(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret materiale
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end items-center gap-2">
                                        {(() => {
                                            const materialCategories = Array.from(new Set(materials.map(m => m.category).filter(Boolean))).sort();
                                            return materialCategories.length > 0 && (
                                                <div className="flex gap-2 mr-auto overflow-x-auto pb-1 max-w-[60%]">
                                                    <Badge
                                                        variant={materialFilterCategory === null ? "default" : "outline"}
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => setMaterialFilterCategory(null)}
                                                    >
                                                        Alle
                                                    </Badge>
                                                    {materialCategories.map(cat => (
                                                        <Badge
                                                            key={cat}
                                                            variant={materialFilterCategory === cat ? "default" : "outline"}
                                                            className="cursor-pointer whitespace-nowrap"
                                                            onClick={() => setMaterialFilterCategory(cat)}
                                                        >
                                                            {cat}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                        <Button variant="outline" size="sm" onClick={() => setShowCreateMaterial(true)}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Opret nyt materiale
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {materials
                                            .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .filter(m => !materialFilterCategory || m.category === materialFilterCategory)
                                            .map((item) => (
                                                <Card key={item.id} className="overflow-hidden group cursor-pointer" onClick={() => setEditingMaterial(item)}>
                                                    <div className="aspect-[2/1] bg-gradient-to-br from-blue-500/5 to-blue-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                        <div className="text-center">
                                                            {item.weight_gsm ? (
                                                                <p className="text-2xl font-bold text-blue-600/70">{item.weight_gsm}g</p>
                                                            ) : (
                                                                <Scroll className="w-8 h-8 text-blue-500/40 mx-auto" />
                                                            )}
                                                            <p className="text-[10px] font-mono text-muted-foreground/60 px-2 truncate max-w-[100px]">
                                                                {item.category}
                                                            </p>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditingMaterial(item); }}>
                                                                <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardContent className="p-3">
                                                        <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Badge variant="outline" className="text-[10px] py-0 px-1">{item.category}</Badge>
                                                            {item.weight_gsm && (
                                                                <Badge variant="secondary" className="text-[10px] py-0 px-1">{item.weight_gsm} g/m²</Badge>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Storformat Bibliotek */}
                        <TabsContent value="storformat" className="mt-0">
                            {storformatLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                                        Storformat biblioteket bruges til genbrug af materialer, efterbehandlinger og produkter i prislister.
                                    </div>

                                    {/* Materialer */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">Materialer</Label>
                                            <Button variant="outline" size="sm" onClick={openCreateStorformat}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Opret materiale
                                            </Button>
                                        </div>
                                        {filteredStorformatMaterials.length === 0 ? (
                                            <div className="text-xs text-muted-foreground italic">Ingen materialer gemt</div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                {filteredStorformatMaterials.map((item) => {
                                                    const maxLabel = item.max_width_mm || item.max_height_mm
                                                        ? `Max ${item.max_width_mm ? `${item.max_width_mm / 10} cm` : "—"} × ${item.max_height_mm ? `${item.max_height_mm / 10} cm` : "—"}`
                                                        : "Ingen max størrelse";
                                                    return (
                                                        <Card key={item.id} className="overflow-hidden group">
                                                            <div className="aspect-[2/1] bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                                <div className="text-center">
                                                                    <LayoutGrid className="w-8 h-8 text-emerald-500/40 mx-auto" />
                                                                    <p className="text-[10px] font-mono text-muted-foreground/60 px-2 truncate max-w-[120px]">
                                                                        {maxLabel}
                                                                    </p>
                                                                </div>
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <Button size="sm" variant="secondary" onClick={() => openEditStorformat(item)}>
                                                                        <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <CardContent className="p-3">
                                                                <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                                <div className="text-[10px] text-muted-foreground mt-1">{maxLabel}</div>
                                                                {(item.tags || []).length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {(item.tags || []).slice(0, 3).map(tag => (
                                                                            <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                                {tag}
                                                                            </span>
                                                                        ))}
                                                                        {(item.tags || []).length > 3 && (
                                                                            <span className="text-[10px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Efterbehandling */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">Efterbehandlinger</Label>
                                            <Button variant="outline" size="sm" onClick={openCreateStorformatFinish}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Opret efterbehandling
                                            </Button>
                                        </div>
                                        {filteredStorformatFinishes.length === 0 ? (
                                            <div className="text-xs text-muted-foreground italic">Ingen efterbehandlinger gemt</div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                {filteredStorformatFinishes.map((item) => (
                                                    <Card key={item.id} className="overflow-hidden group">
                                                        <div className="aspect-[2/1] bg-gradient-to-br from-purple-500/5 to-purple-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                            <div className="text-center">
                                                                <Sparkles className="w-8 h-8 text-purple-500/40 mx-auto" />
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Button size="sm" variant="secondary" onClick={() => openEditStorformatFinish(item)}>
                                                                    <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <CardContent className="p-3">
                                                            <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                            {(item.tags || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {(item.tags || []).slice(0, 3).map(tag => (
                                                                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                    {(item.tags || []).length > 3 && (
                                                                        <span className="text-[10px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Produkter */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">Produkter</Label>
                                            <Button variant="outline" size="sm" onClick={openCreateStorformatProduct}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Opret produkt
                                            </Button>
                                        </div>
                                        {filteredStorformatProducts.length === 0 ? (
                                            <div className="text-xs text-muted-foreground italic">Ingen produkter gemt</div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                {filteredStorformatProducts.map((item) => (
                                                    <Card key={item.id} className="overflow-hidden group">
                                                        <div className="aspect-[2/1] bg-gradient-to-br from-blue-500/5 to-blue-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                            <div className="text-center">
                                                                <Package className="w-8 h-8 text-blue-500/40 mx-auto" />
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Button size="sm" variant="secondary" onClick={() => openEditStorformatProduct(item)}>
                                                                    <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <CardContent className="p-3">
                                                            <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                            {(item.tags || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {(item.tags || []).slice(0, 3).map(tag => (
                                                                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                    {(item.tags || []).length > 3 && (
                                                                        <span className="text-[10px] text-muted-foreground">+{(item.tags || []).length - 3}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Efterbehandling Tab */}
                        <TabsContent value="efterbehandling" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : finishes.length === 0 ? (
                                <div className="py-24 text-center">
                                    <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen efterbehandling fundet</h3>
                                    <p className="text-muted-foreground mb-4">Opret efterbehandling som Laminering, Lakering, mm.</p>
                                    <Button variant="outline" onClick={() => setShowCreateFinish(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret efterbehandling
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end items-center gap-2">
                                        {(() => {
                                            const finishCategories = Array.from(new Set(finishes.map(f => f.category).filter(Boolean))).sort();
                                            return finishCategories.length > 0 && (
                                                <div className="flex gap-2 mr-auto overflow-x-auto pb-1 max-w-[60%]">
                                                    <Badge
                                                        variant={finishFilterCategory === null ? "default" : "outline"}
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => setFinishFilterCategory(null)}
                                                    >
                                                        Alle
                                                    </Badge>
                                                    {finishCategories.map(cat => (
                                                        <Badge
                                                            key={cat}
                                                            variant={finishFilterCategory === cat ? "default" : "outline"}
                                                            className="cursor-pointer whitespace-nowrap"
                                                            onClick={() => setFinishFilterCategory(cat)}
                                                        >
                                                            {cat}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                        <Button variant="outline" size="sm" onClick={() => setShowCreateFinish(true)}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Opret ny efterbehandling
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {finishes
                                            .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .filter(f => !finishFilterCategory || f.category === finishFilterCategory)
                                            .map((item) => (
                                                <Card key={item.id} className="overflow-hidden group cursor-pointer" onClick={() => setEditingFinish(item)}>
                                                    <div className="aspect-[2/1] bg-gradient-to-br from-purple-500/5 to-purple-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                        <div className="text-center">
                                                            <Sparkles className="w-8 h-8 text-purple-500/40 mx-auto" />
                                                            <p className="text-[10px] font-mono text-muted-foreground/60 px-2 truncate max-w-[100px]">
                                                                {item.category}
                                                            </p>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditingFinish(item); }}>
                                                                <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardContent className="p-3">
                                                        <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Badge variant="outline" className="text-[10px] py-0 px-1">{item.category}</Badge>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Produkter Tab */}
                        <TabsContent value="produkter" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : products.length === 0 ? (
                                <div className="py-24 text-center">
                                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen produkter fundet</h3>
                                    <p className="text-muted-foreground mb-4">Opret produkter og produktvarianter.</p>
                                    <Button variant="outline" onClick={() => setShowCreateProduct(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret produkt
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end items-center gap-2">
                                        {(() => {
                                            const productCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
                                            return productCategories.length > 0 && (
                                                <div className="flex gap-2 mr-auto overflow-x-auto pb-1 max-w-[60%]">
                                                    <Badge
                                                        variant={productFilterCategory === null ? "default" : "outline"}
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => setProductFilterCategory(null)}
                                                    >
                                                        Alle
                                                    </Badge>
                                                    {productCategories.map(cat => (
                                                        <Badge
                                                            key={cat}
                                                            variant={productFilterCategory === cat ? "default" : "outline"}
                                                            className="cursor-pointer whitespace-nowrap"
                                                            onClick={() => setProductFilterCategory(cat)}
                                                        >
                                                            {cat}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                        <Button variant="outline" size="sm" onClick={() => setShowCreateProduct(true)}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Opret nyt produkt
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {products
                                            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .filter(p => !productFilterCategory || p.category === productFilterCategory)
                                            .map((item) => (
                                                <Card key={item.id} className="overflow-hidden group cursor-pointer" onClick={() => setEditingProduct(item)}>
                                                    <div className="aspect-[2/1] bg-gradient-to-br from-orange-500/5 to-orange-500/10 relative flex items-center justify-center border-b px-2 py-4">
                                                        <div className="text-center">
                                                            <Package className="w-8 h-8 text-orange-500/40 mx-auto" />
                                                            <p className="text-[10px] font-mono text-muted-foreground/60 px-2 truncate max-w-[100px]">
                                                                {item.category}
                                                            </p>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditingProduct(item); }}>
                                                                <Pencil className="h-4 w-4 mr-1" /> Rediger
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardContent className="p-3">
                                                        <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Badge variant="outline" className="text-[10px] py-0 px-1">{item.category}</Badge>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Ressourcer Tab */}
                        <TabsContent value="ressourcer" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="py-24 text-center">
                                    <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen ressourcer fundet</h3>
                                    <p className="text-muted-foreground">
                                        Upload dit første design for at komme i gang.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredItems.map((item) => (
                                        <Card key={item.id} className="overflow-hidden group">
                                            <div className="aspect-square bg-muted relative flex items-center justify-center border-b">
                                                {item.kind === 'svg' ? (
                                                    <FileText className="w-12 h-12 text-muted-foreground/40" />
                                                ) : item.kind === 'pdf' ? (
                                                    <FileText className="w-12 h-12 text-red-400" />
                                                ) : (
                                                    <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
                                                )}

                                                {/* Overlay Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="secondary"
                                                        className="h-8 w-8"
                                                        onClick={() => toggleVisibility(item)}
                                                        title={item.visibility === 'public' ? 'Gør privat' : 'Gør offentlig'}
                                                    >
                                                        {item.visibility === 'public' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="destructive" className="h-8 w-8">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Slet design?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dette sletter filen permanent fra biblioteket.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>Slet</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>

                                                <Badge className="absolute top-2 right-2" variant={item.visibility === 'public' ? 'default' : 'outline'}>
                                                    {item.visibility === 'public' ? 'Offentlig' : 'Privat'}
                                                </Badge>
                                                <Badge className="absolute top-2 left-2 bg-white/80 text-black border-none" variant="secondary">
                                                    {item.kind.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <CardContent className="p-3">
                                                <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {item.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {item.tags.length > 3 && (
                                                        <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/30 py-3">
                        <p className="text-xs text-muted-foreground">
                            {activeTab === 'mine'
                                ? `Viser ${filteredSavedDesigns.length} gemte designs`
                                : activeTab === 'skabeloner'
                                    ? `Viser ${filteredTemplates.length} skabeloner`
                                : activeTab === 'materialer'
                                    ? `Viser ${materials.length} materialer`
                                    : activeTab === 'storformat'
                                        ? `Viser ${filteredStorformatMaterials.length + filteredStorformatFinishes.length + filteredStorformatProducts.length} storformat-elementer`
                                    : activeTab === 'efterbehandling'
                                        ? `Viser ${finishes.length} efterbehandlinger`
                                            : activeTab === 'produkter'
                                                ? `Viser ${products.length} produkter`
                                                : `Viser ${filteredItems.length} af ${items.length} designs`
                            }
                        </p>
                    </CardFooter>
                </Card>

            </Tabs>

            <CreateTemplateDialog
                open={showCreateTemplate}
                onOpenChange={setShowCreateTemplate}
                onSuccess={() => { fetchTemplates(); }}
                existingCategories={templateCategories}
            />

            <EditTemplateDialog
                open={!!editingTemplate}
                template={editingTemplate}
                onOpenChange={(open) => !open && setEditingTemplate(null)}
                onSuccess={() => { fetchTemplates(); setEditingTemplate(null); }}
                existingCategories={templateCategories}
            />

            <Dialog open={showStorformatDialog} onOpenChange={setShowStorformatDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStorformatMaterial ? "Rediger storformat materiale" : "Opret storformat materiale"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Navn</Label>
                            <Input
                                value={storformatDraft.name}
                                onChange={(e) => setStorformatDraft((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="F.eks. PVC banner"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Maks længde (cm)</Label>
                                <Input
                                    type="number"
                                    value={storformatDraft.maxWidthCm}
                                    onChange={(e) => setStorformatDraft((prev) => ({ ...prev, maxWidthCm: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Maks højde (cm)</Label>
                                <Input
                                    type="number"
                                    value={storformatDraft.maxHeightCm}
                                    onChange={(e) => setStorformatDraft((prev) => ({ ...prev, maxHeightCm: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Tags (komma-separeret)</Label>
                            <Input
                                value={storformatDraft.tags}
                                onChange={(e) => setStorformatDraft((prev) => ({ ...prev, tags: e.target.value }))}
                                placeholder="banner, pvc, udendørs"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                        <div>
                            {editingStorformatMaterial && (
                                <Button variant="destructive" onClick={handleDeleteStorformatMaterial}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Slet
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowStorformatDialog(false)}>Annuller</Button>
                            <Button onClick={handleSaveStorformatMaterial}>
                                {editingStorformatMaterial ? "Gem ændringer" : "Opret"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showStorformatFinishDialog} onOpenChange={setShowStorformatFinishDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStorformatFinish ? "Rediger efterbehandling" : "Opret efterbehandling"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Navn</Label>
                            <Input
                                value={storformatFinishDraft.name}
                                onChange={(e) => setStorformatFinishDraft((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="F.eks. Lamineret"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tags (komma-separeret)</Label>
                            <Input
                                value={storformatFinishDraft.tags}
                                onChange={(e) => setStorformatFinishDraft((prev) => ({ ...prev, tags: e.target.value }))}
                                placeholder="finish, mat, glans"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                        <div>
                            {editingStorformatFinish && (
                                <Button variant="destructive" onClick={handleDeleteStorformatFinish}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Slet
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowStorformatFinishDialog(false)}>Annuller</Button>
                            <Button onClick={handleSaveStorformatFinish}>
                                {editingStorformatFinish ? "Gem ændringer" : "Opret"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showStorformatProductDialog} onOpenChange={setShowStorformatProductDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStorformatProduct ? "Rediger produkt" : "Opret produkt"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Navn</Label>
                            <Input
                                value={storformatProductDraft.name}
                                onChange={(e) => setStorformatProductDraft((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="F.eks. Banner"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tags (komma-separeret)</Label>
                            <Input
                                value={storformatProductDraft.tags}
                                onChange={(e) => setStorformatProductDraft((prev) => ({ ...prev, tags: e.target.value }))}
                                placeholder="produkt, banner"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                        <div>
                            {editingStorformatProduct && (
                                <Button variant="destructive" onClick={handleDeleteStorformatProduct}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Slet
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowStorformatProductDialog(false)}>Annuller</Button>
                            <Button onClick={handleSaveStorformatProduct}>
                                {editingStorformatProduct ? "Gem ændringer" : "Opret"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Dialogs for Attributes */}
            <CreateAttributeLibraryItemDialog
                open={showCreateMaterial}
                onOpenChange={setShowCreateMaterial}
                type="material"
                onSuccess={() => fetchAttributes()}
                existingCategories={materialCategories}
            />
            <CreateAttributeLibraryItemDialog
                open={showCreateFinish}
                onOpenChange={setShowCreateFinish}
                type="finish"
                onSuccess={() => fetchAttributes()}
                existingCategories={finishCategories}
            />
            <CreateAttributeLibraryItemDialog
                open={showCreateProduct}
                onOpenChange={setShowCreateProduct}
                type="product"
                onSuccess={() => fetchAttributes()}
                existingCategories={productCategories}
            />

            {/* Edit Dialogs for Attributes */}
            <EditAttributeLibraryItemDialog
                open={!!editingMaterial}
                item={editingMaterial}
                type="material"
                onOpenChange={(open) => !open && setEditingMaterial(null)}
                onSuccess={() => { fetchAttributes(); setEditingMaterial(null); }}
                existingCategories={materialCategories}
            />
            <EditAttributeLibraryItemDialog
                open={!!editingFinish}
                item={editingFinish}
                type="finish"
                onOpenChange={(open) => !open && setEditingFinish(null)}
                onSuccess={() => { fetchAttributes(); setEditingFinish(null); }}
                existingCategories={finishCategories}
            />
            <EditAttributeLibraryItemDialog
                open={!!editingProduct}
                item={editingProduct}
                type="product"
                onOpenChange={(open) => !open && setEditingProduct(null)}
                onSuccess={() => { fetchAttributes(); setEditingProduct(null); }}
                existingCategories={productCategories}
            />
        </div >
    );
}

function CreateTemplateDialog({ open, onOpenChange, onSuccess, existingCategories = [] }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void, existingCategories?: string[] }) {
    const [name, setName] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [category, setCategory] = useState('');
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const [loading, setLoading] = useState(false);
    const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // PDF upload handler
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            toast.error('Kun PDF-filer understøttes');
            return;
        }
        setUploadingPdf(true);
        try {
            const fileName = `template-pdfs/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('design-library')
                .upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
                .from('design-library')
                .getPublicUrl(fileName);
            setTemplatePdfUrl(publicUrl);
            toast.success('PDF-skabelon uploadet');
        } catch (err: any) {
            toast.error('Upload fejlede: ' + err.message);
        } finally {
            setUploadingPdf(false);
        }
    };

    // Reset when opening
    useEffect(() => {
        if (open) {
            setName('');
            setWidth('');
            setHeight('');
            setCategory('');
            setBleed('3');
            setSafeArea('3');
            setTemplatePdfUrl(null);
        }
    }, [open]);

    const handleCreate = async () => {
        if (!name || !width || !height) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('designer_templates' as any).insert({
                name,
                width_mm: parseInt(width),
                height_mm: parseInt(height),
                bleed_mm: parseFloat(bleed) || 3,
                safe_area_mm: parseFloat(safeArea) || 3,
                is_active: true,
                category: category || 'User Format',
                description: 'Oprettet fra Design Bibliotek',
                template_type: 'format',
                is_public: false,
                template_pdf_url: templatePdfUrl
            });

            if (error) throw error;
            toast.success('Skabelon oprettet');
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            toast.error('Kunne ikke oprette skabelon');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Opret ny format-skabelon</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Navn</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="F.eks. Visitkort Standard" />
                    </div>
                    <div className="space-y-2">
                        <Label>Kategori (Tag)</Label>
                        <CategorySelector
                            value={category}
                            onValueChange={setCategory}
                            existingCategories={existingCategories}
                            placeholder="F.eks. Visitkort"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bredde (mm)</Label>
                            <Input type="number" value={width} onChange={e => setWidth(e.target.value)} placeholder="85" />
                        </div>
                        <div className="space-y-2">
                            <Label>Højde (mm)</Label>
                            <Input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="55" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bleed (mm)</Label>
                            <Input type="number" value={bleed} onChange={e => setBleed(e.target.value)} placeholder="3" />
                        </div>
                        <div className="space-y-2">
                            <Label>Safe zone (mm)</Label>
                            <Input type="number" value={safeArea} onChange={e => setSafeArea(e.target.value)} placeholder="3" />
                        </div>
                    </div>

                    {/* Template PDF Upload */}
                    <div className="space-y-2 border-t pt-4">
                        <Label>Format-skabelon PDF (valgfri)</Label>
                        <p className="text-xs text-muted-foreground">
                            Upload PDF med fold/skære-linier fra dit trykkeri.
                        </p>
                        {templatePdfUrl ? (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm truncate flex-1">{templatePdfUrl.split('/').pop()}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePdfUrl(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={handlePdfUpload}
                                    disabled={uploadingPdf}
                                    className="flex-1"
                                />
                                {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button onClick={handleCreate} disabled={loading || !name || !width || !height}>
                        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                        Opret format
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditTemplateDialog({ open, template, onOpenChange, onSuccess, existingCategories = [] }: { open: boolean, template: any, onOpenChange: (open: boolean) => void, onSuccess: () => void, existingCategories?: string[] }) {
    const [name, setName] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [category, setCategory] = useState('');
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const [loading, setLoading] = useState(false);
    const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // PDF upload handler
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            toast.error('Kun PDF-filer understøttes');
            return;
        }
        setUploadingPdf(true);
        try {
            const fileName = `template-pdfs/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('design-library')
                .upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
                .from('design-library')
                .getPublicUrl(fileName);
            setTemplatePdfUrl(publicUrl);
            toast.success('PDF-skabelon uploadet');
        } catch (err: any) {
            toast.error('Upload fejlede: ' + err.message);
        } finally {
            setUploadingPdf(false);
        }
    };

    useEffect(() => {
        if (template) {
            setName(template.name || '');
            setWidth(template.width_mm || '');
            setHeight(template.height_mm || '');
            setCategory(template.category || '');
            setBleed(String(template.bleed_mm ?? 3));
            setSafeArea(String(template.safe_area_mm ?? 3));
            setTemplatePdfUrl(template.template_pdf_url || null);
        }
    }, [template]);

    const handleUpdate = async () => {
        if (!template || !name || !width || !height) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('designer_templates' as any).update({
                name,
                width_mm: parseInt(toString(width)),
                height_mm: parseInt(toString(height)),
                bleed_mm: parseFloat(toString(bleed)) || 3,
                safe_area_mm: parseFloat(toString(safeArea)) || 3,
                category: category || 'General',
                template_pdf_url: templatePdfUrl
            }).eq('id', template.id);

            if (error) throw error;
            toast.success('Skabelon opdateret');
            onSuccess();
        } catch (err: any) {
            toast.error('Kunne ikke opdatere skabelon');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to safely stringify
    const toString = (v: any) => v + "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rediger format</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Navn</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Kategori (Tag)</Label>
                        <Input value={category} onChange={e => setCategory(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bredde (mm)</Label>
                            <Input type="number" value={width} onChange={e => setWidth(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Højde (mm)</Label>
                            <Input type="number" value={height} onChange={e => setHeight(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bleed (mm)</Label>
                            <Input type="number" value={bleed} onChange={e => setBleed(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Safe zone (mm)</Label>
                            <Input type="number" value={safeArea} onChange={e => setSafeArea(e.target.value)} />
                        </div>
                    </div>

                    {/* Template PDF Upload */}
                    <div className="space-y-2 border-t pt-4">
                        <Label>Format-skabelon PDF</Label>
                        <p className="text-xs text-muted-foreground">
                            Upload PDF med fold/skære-linier fra dit trykkeri.
                        </p>
                        {templatePdfUrl ? (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm truncate flex-1">{templatePdfUrl.split('/').pop()}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePdfUrl(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={handlePdfUpload}
                                    disabled={uploadingPdf}
                                    className="flex-1"
                                />
                                {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button onClick={handleUpdate} disabled={loading || !name || !width || !height}>
                        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                        Gem ændringer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
