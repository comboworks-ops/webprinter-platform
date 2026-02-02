// POD Catalog - Tenant view of published POD products for import

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Download, Check, Search, GitMerge } from "lucide-react";
import { usePodPublishedCatalog, usePodImportProduct, usePodTenantImports, usePodRemoveImport, usePodMergeProducts } from "@/lib/pod/hooks";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export function PodKatalog() {
    const [tenantInfo, setTenantInfo] = useState<{ tenantId: string | null; role: string | null; isMasterAdmin: boolean }>({
        tenantId: null,
        role: null,
        isMasterAdmin: false,
    });

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId, role, isMasterAdmin }) => setTenantInfo({ tenantId, role, isMasterAdmin }));
    }, []);

    const { data: catalog, isLoading: loadingCatalog } = usePodPublishedCatalog();
    const { data: imports, isLoading: loadingImports } = usePodTenantImports(tenantInfo.tenantId || undefined);
    const importProduct = usePodImportProduct();
    const removeImport = usePodRemoveImport();
    const mergeProducts = usePodMergeProducts();

    const [importedProducts, setImportedProducts] = useState<any[]>([]);
    const [mergeTargetId, setMergeTargetId] = useState("");
    const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);

    useEffect(() => {
        if (!tenantInfo.isMasterAdmin) return;
        const productIds = Array.from(new Set((imports || []).map((item: any) => item.product_id).filter(Boolean)));
        if (productIds.length === 0) {
            setImportedProducts([]);
            setMergeTargetId("");
            setMergeSourceIds([]);
            return;
        }

        let active = true;
        const loadProducts = async () => {
            const { data, error } = await supabase
                .from('products' as any)
                .select('id, name, slug, pricing_structure, pricing_type, technical_specs')
                .in('id', productIds);
            if (!active) return;
            if (error) {
                toast.error('Kunne ikke hente importerede produkter');
                setImportedProducts([]);
                return;
            }
            const products = data || [];
            setImportedProducts(products);
            if (!mergeTargetId && products.length > 0) {
                setMergeTargetId(products[0].id);
            }
        };

        loadProducts();
        return () => {
            active = false;
        };
    }, [tenantInfo.isMasterAdmin, imports, mergeTargetId]);

    useEffect(() => {
        if (!mergeTargetId) return;
        setMergeSourceIds((prev) => prev.filter((id) => id !== mergeTargetId));
    }, [mergeTargetId]);

    const toggleMergeSource = (id: string) => {
        setMergeSourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [importDialog, setImportDialog] = useState<{ open: boolean; product: any | null }>({
        open: false,
        product: null,
    });
    const [customName, setCustomName] = useState("");
    const [customCategory, setCustomCategory] = useState("tryksager");

    const CATEGORY_OPTIONS = [
        { value: "tryksager", label: "Tryksager" },
        { value: "storformat", label: "Storformat" },
    ];

    const importByCatalogId = new Map((imports || []).map((item: any) => [item.catalog_product_id, item]));
    const importedIds = new Set(imports?.map((i: any) => i.catalog_product_id) || []);

    const filteredCatalog = catalog?.filter((product) => {
        if (!searchQuery) return true;
        const title = product.public_title?.da || product.public_title?.en || "";
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const getPricingMode = (product: any) => {
        const structure = product?.pricing_structure;
        if (!structure) return undefined;
        if (typeof structure === "string") {
            try {
                return JSON.parse(structure)?.mode;
            } catch {
                return undefined;
            }
        }
        return structure?.mode;
    };

    const mergeCandidates = importedProducts.filter((p) => getPricingMode(p) === 'matrix_layout_v1');
    const canMerge = tenantInfo.isMasterAdmin && mergeCandidates.length > 1;
    const mergeSources = mergeCandidates.filter((p) => p.id !== mergeTargetId);

    const handleMerge = async () => {
        if (!mergeTargetId || mergeSourceIds.length === 0) {
            toast.error('Vælg målprodukt og mindst ét kildeprodukt');
            return;
        }
        if (!confirm('Sammenflet valgte POD produkter ind i målproduktet?')) return;
        try {
            await mergeProducts.mutateAsync({
                targetProductId: mergeTargetId,
                sourceProductIds: mergeSourceIds,
            });
        } catch {
            // Errors handled in hook
        }
    };

    const handleOpenImport = (product: any) => {
        setCustomName(product.public_title?.da || product.public_title?.en || "");
        setCustomCategory("tryksager");
        setImportDialog({ open: true, product });
    };

    const handleImport = async () => {
        if (!importDialog.product) return;

        try {
            await importProduct.mutateAsync({
                catalogProductId: importDialog.product.id,
                customName: customName,
                customCategory: customCategory,
                tenantId: tenantInfo.tenantId || undefined,
            });
            setImportDialog({ open: false, product: null });
        } catch (e) {
            // Error handled by hook
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">POD Katalog</h1>
                <p className="text-muted-foreground">
                    Importér Print on Demand produkter til din butik
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    Aktiv tenant: {tenantInfo.isMasterAdmin ? "Master" : tenantInfo.tenantId || "Ukendt"}{tenantInfo.role ? ` (${tenantInfo.role})` : ""}
                </p>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Søg i katalog..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Badge variant="outline">
                    {filteredCatalog?.length || 0} produkter tilgængelige
                </Badge>
            </div>

            {canMerge && (
                <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <GitMerge className="h-4 w-4" />
                            Sammenflet POD imports (master)
                        </CardTitle>
                        <CardDescription>
                            Brug dette når store imports deles op i mindre chunks.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Målprodukt</Label>
                                <Select
                                    value={mergeTargetId || undefined}
                                    onValueChange={(value) => setMergeTargetId(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vælg målprodukt" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mergeCandidates.map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                {product.name || product.slug || product.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Kildeprodukter</Label>
                                <div className="max-h-44 overflow-auto rounded-md border p-2 space-y-2">
                                    {mergeSources.length === 0 && (
                                        <p className="text-xs text-muted-foreground">Vælg et målprodukt først.</p>
                                    )}
                                    {mergeSources.map((product) => {
                                        const checked = mergeSourceIds.includes(product.id);
                                        return (
                                            <label key={product.id} className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={checked} onCheckedChange={() => toggleMergeSource(product.id)} />
                                                <span className="truncate">{product.name || product.slug || product.id}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                                Sammenfletning kopierer priser og udvider matrixen på målproduktet.
                            </p>
                            <Button onClick={handleMerge} disabled={mergeProducts.isPending || !mergeTargetId || mergeSourceIds.length === 0}>
                                {mergeProducts.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Sammenflet
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredCatalog && filteredCatalog.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCatalog.map((product) => {
                        const isImported = importedIds.has(product.id);
                        const importRow = importByCatalogId.get(product.id);
                        const title = product.public_title?.da || product.public_title?.en || "Ukendt produkt";
                        const description = product.public_description?.da || product.public_description?.en || "";

                        return (
                            <Card key={product.id} className={isImported ? "border-green-500/50" : ""}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-lg truncate">{title}</CardTitle>
                                            {description && (
                                                <CardDescription className="line-clamp-2 mt-1">{description}</CardDescription>
                                            )}
                                        </div>
                                        {isImported && (
                                            <Badge variant="default" className="bg-green-600 shrink-0">
                                                <Check className="h-3 w-3 mr-1" />
                                                Importeret
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {product.public_images && product.public_images.length > 0 && (
                                        <div className="aspect-video bg-muted rounded-lg mb-4 overflow-hidden">
                                            <img
                                                src={product.public_images[0]}
                                                alt={title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            className="w-full"
                                            variant={isImported ? "outline" : "default"}
                                            disabled={isImported || importProduct.isPending}
                                            onClick={() => handleOpenImport(product)}
                                        >
                                            {isImported ? (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Allerede importeret
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Importér til butik
                                                </>
                                            )}
                                        </Button>
                                        {isImported && importRow?.id && (
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    if (!confirm("Vil du slette dette POD produkt?")) return;
                                                    removeImport.mutate({ importId: importRow.id });
                                                }}
                                            >
                                                Slet
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg">Ingen POD produkter tilgængelige</h3>
                        <p className="text-muted-foreground mt-2">
                            Der er ingen Print on Demand produkter tilgængelige for import endnu.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Import Dialog */}
            <Dialog open={importDialog.open} onOpenChange={(open) => setImportDialog({ ...importDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importér POD Produkt</DialogTitle>
                        <DialogDescription>
                            Produktet oprettes i din produktliste og kan derefter publiceres til din butik.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Produktnavn</Label>
                            <Input
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="Indtast produktnavn"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <Select value={customCategory} onValueChange={setCustomCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setImportDialog({ open: false, product: null })}
                        >
                            Annuller
                        </Button>
                        <Button onClick={handleImport} disabled={importProduct.isPending}>
                            {importProduct.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Importér
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default PodKatalog;
