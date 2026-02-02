// POD v2 Catalog - Tenant view of published POD v2 products for import

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Package, Download, Check, Search, GitMerge, ArrowUpRight, ListFilter, Layers } from "lucide-react";
import { usePodCatalogProducts, usePodImportProduct, usePodTenantImports, usePodRemoveImport, usePodMergeProducts } from "@/lib/pod2/hooks";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const normalizeMatrixMapping = (raw: any, groupKeys: string[]) => {
    const rows = Array.isArray(raw?.rows)
        ? raw.rows.map((row: any, index: number) => ({
            id: String(row?.id || `row-${index + 1}`),
            title: String(row?.title || `Række ${index + 1}`),
            groupKeys: Array.isArray(row?.groupKeys)
                ? row.groupKeys.filter((key: string) => groupKeys.includes(key))
                : [],
        }))
        : [];
    const fixed = Array.isArray(raw?.fixed)
        ? raw.fixed.filter((key: string) => groupKeys.includes(key))
        : [];
    let verticalAxis = typeof raw?.verticalAxis === "string" && groupKeys.includes(raw.verticalAxis)
        ? raw.verticalAxis
        : null;

    if (!verticalAxis && groupKeys.length > 0) {
        verticalAxis = groupKeys.find((key) => key === "size" || key.includes("size") || key.includes("format"))
            || groupKeys[0];
    }

    if (rows.length === 0) {
        rows.push({ id: "row-1", title: "Række 1", groupKeys: [] });
    }

    if (verticalAxis) {
        rows.forEach((row) => {
            row.groupKeys = row.groupKeys.filter((key) => key !== verticalAxis);
        });
    }

    const cleanedFixed = verticalAxis ? fixed.filter((key) => key !== verticalAxis) : fixed;
    const used = new Set<string>([
        ...(verticalAxis ? [verticalAxis] : []),
        ...cleanedFixed,
        ...rows.flatMap((row) => row.groupKeys),
    ]);
    const missing = groupKeys.filter((key) => !used.has(key));
    if (missing.length > 0) {
        rows[0].groupKeys = [...rows[0].groupKeys, ...missing];
    }

    return {
        version: 1,
        verticalAxis,
        rows,
        fixed: cleanedFixed,
    };
};

const extractAvailableQuantities = (product: any) => {
    const set = new Set<number>();
    const priceMatrix = product?.pod2_catalog_price_matrix || [];
    for (const matrix of priceMatrix) {
        const quantities = matrix?.quantities || [];
        for (const qty of quantities) {
            const value = Number(qty);
            if (Number.isFinite(value) && value > 0) {
                set.add(value);
            }
        }
    }
    return Array.from(set).sort((a, b) => a - b);
};

export function Pod2Katalog() {
    const navigate = useNavigate();
    const [tenantInfo, setTenantInfo] = useState<{ tenantId: string | null; role: string | null; isMasterAdmin: boolean }>({
        tenantId: null,
        role: null,
        isMasterAdmin: false,
    });

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId, role, isMasterAdmin }) => setTenantInfo({ tenantId, role, isMasterAdmin }));
    }, []);

    const { data: catalog, isLoading: loadingCatalog } = usePodCatalogProducts();
    const effectiveTenantId = tenantInfo.isMasterAdmin ? MASTER_TENANT_ID : tenantInfo.tenantId;
    const { data: imports, isLoading: loadingImports } = usePodTenantImports(effectiveTenantId || undefined);
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
    const [onlyImported, setOnlyImported] = useState(false);
    const [onlyPriced, setOnlyPriced] = useState(false);
    const [sortMode, setSortMode] = useState("recent");
    const [importDialog, setImportDialog] = useState<{ open: boolean; product: any | null }>({
        open: false,
        product: null,
    });
    const [customName, setCustomName] = useState("");
    const [customCategory, setCustomCategory] = useState("tryksager");
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [matrixDraft, setMatrixDraft] = useState<{
        verticalAxis: string | null;
        rows: { id: string; title: string; groupKeys: string[] }[];
        fixed: string[];
        quantities: number[];
    } | null>(null);
    const [savingMapping, setSavingMapping] = useState(false);

    const CATEGORY_OPTIONS = [
        { value: "tryksager", label: "Tryksager" },
        { value: "storformat", label: "Storformat" },
    ];

    const importByCatalogId = useMemo(() => new Map((imports || []).map((item: any) => [item.catalog_product_id, item])), [imports]);
    const importedIds = useMemo(() => new Set(imports?.map((i: any) => i.catalog_product_id) || []), [imports]);
    const importedProductById = useMemo(() => new Map(importedProducts.map((item: any) => [item.id, item])), [importedProducts]);

    const publishedCatalog = useMemo(() => {
        return (catalog || []).filter((product) => {
            if (!product.status) return true;
            return product.status === 'published';
        });
    }, [catalog]);

    const availableQuantities = useMemo(() => {
        if (!importDialog.product) return [];
        return extractAvailableQuantities(importDialog.product);
    }, [importDialog.product]);

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
        if (!confirm('Sammenflet valgte POD v2 produkter ind i målproduktet?')) return;
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
        setWizardStep(1);
        setMatrixDraft(null);
        setImportDialog({ open: true, product });
    };

    const handleImport = async () => {
        if (!importDialog.product) return;

        try {
            await importProduct.mutateAsync({
                catalogProductId: importDialog.product.id,
                customName: customName,
                customCategory: customCategory,
                tenantId: effectiveTenantId || undefined,
            });
            setImportDialog({ open: false, product: null });
            setWizardStep(1);
            setMatrixDraft(null);
        } catch (e) {
            // Error handled by hook
        }
    };

    const buildMatrixDraft = (product: any) => {
        const groupKeys = (product?.pod2_catalog_attributes || []).map((attr: any) => attr.group_key);
        const raw = product?.supplier_product_data?.matrix_mapping;
        const normalized = normalizeMatrixMapping(raw, groupKeys);
        const availableQuantities = extractAvailableQuantities(product);
        const quantities = Array.isArray(product?.supplier_product_data?.matrix_quantities)
            ? product.supplier_product_data.matrix_quantities.filter((value: any) => availableQuantities.includes(Number(value)))
            : availableQuantities;
        return {
            verticalAxis: normalized.verticalAxis,
            rows: normalized.rows.map((row: any) => ({
                id: row.id,
                title: row.title,
                groupKeys: [...row.groupKeys],
            })),
            fixed: [...normalized.fixed],
            quantities: quantities.filter((value: any) => typeof value === "number" && Number.isFinite(value)),
        };
    };

    const ensureMatrixDraft = (product: any) => {
        if (matrixDraft) return matrixDraft;
        const draft = buildMatrixDraft(product);
        setMatrixDraft(draft);
        return draft;
    };

    const updateAssignment = (groupKey: string, target: string) => {
        if (!matrixDraft) return;
        setMatrixDraft((prev) => {
            if (!prev) return prev;
            const next = {
                ...prev,
                rows: prev.rows.map((row) => ({ ...row, groupKeys: row.groupKeys.filter((key) => key !== groupKey) })),
                fixed: prev.fixed.filter((key) => key !== groupKey),
                verticalAxis: prev.verticalAxis === groupKey ? null : prev.verticalAxis,
            };
            if (target === "vertical") {
                next.verticalAxis = groupKey;
            } else if (target === "fixed") {
                next.fixed = [...next.fixed, groupKey];
            } else if (target.startsWith("row:")) {
                const rowId = target.replace("row:", "");
                next.rows = next.rows.map((row) =>
                    row.id === rowId ? { ...row, groupKeys: [...row.groupKeys, groupKey] } : row
                );
            }
            return next;
        });
    };

    const addRow = () => {
        if (!matrixDraft) return;
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `row-${Date.now()}`;
        setMatrixDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                rows: [...prev.rows, { id, title: `Række ${prev.rows.length + 1}`, groupKeys: [] }],
            };
        });
    };

    const updateRowTitle = (rowId: string, title: string) => {
        setMatrixDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                rows: prev.rows.map((row) => (row.id === rowId ? { ...row, title } : row)),
            };
        });
    };

    const handleSaveMapping = async () => {
        if (!importDialog.product || !matrixDraft) return false;
        setSavingMapping(true);
        try {
            const existing = importDialog.product?.supplier_product_data || {};
            const updated = {
                ...existing,
                matrix_mapping: {
                    version: 1,
                    verticalAxis: matrixDraft.verticalAxis,
                    rows: matrixDraft.rows.map((row) => ({
                        id: row.id,
                        title: row.title,
                        groupKeys: row.groupKeys,
                    })),
                    fixed: matrixDraft.fixed,
                },
                matrix_quantities: matrixDraft.quantities,
            };

            const { error } = await supabase
                .from("pod2_catalog_products" as any)
                .update({ supplier_product_data: updated })
                .eq("id", importDialog.product.id);

            if (error) throw error;
            toast.success("Matrix-layout gemt");
            return true;
        } catch (e: any) {
            toast.error(`Kunne ikke gemme mapping: ${e.message || "ukendt fejl"}`);
            return false;
        } finally {
            setSavingMapping(false);
        }
    };

    const getGroupLabel = (product: any, groupKey: string) => {
        const group = (product?.pod2_catalog_attributes || []).find((attr: any) => attr.group_key === groupKey);
        return group?.group_label?.da || group?.group_label?.en || groupKey;
    };

    const formatPrice = (amount: number, currency?: string) => {
        if (!currency) return `${amount.toFixed(2)}`;
        try {
            return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(amount);
        } catch {
            return `${amount.toFixed(2)} ${currency}`;
        }
    };

    const getMinPrice = (product: any) => {
        const matrices = product?.pod2_catalog_price_matrix || [];
        const values = matrices.flatMap((row: any) => row.recommended_retail || []);
        const numericValues = values.filter((value: any) => typeof value === "number" && Number.isFinite(value));
        if (numericValues.length === 0) return null;
        const minValue = Math.min(...numericValues);
        const currency = matrices.find((row: any) => row.currency)?.currency;
        return { value: minValue, currency };
    };

    const filteredCatalog = useMemo(() => {
        const base = publishedCatalog.filter((product) => {
            const title = product.public_title?.da || product.public_title?.en || "";
            const match = title.toLowerCase().includes(searchQuery.toLowerCase());
            if (!match) return false;
            if (onlyImported && !importedIds.has(product.id)) return false;
            if (onlyPriced && !(product.pod2_catalog_price_matrix || []).length) return false;
            return true;
        });

        const sorted = [...base];
        if (sortMode === "title") {
            sorted.sort((a, b) => {
                const titleA = (a.public_title?.da || a.public_title?.en || "").toLowerCase();
                const titleB = (b.public_title?.da || b.public_title?.en || "").toLowerCase();
                return titleA.localeCompare(titleB);
            });
        } else if (sortMode === "price") {
            sorted.sort((a, b) => {
                const priceA = getMinPrice(a)?.value ?? Number.POSITIVE_INFINITY;
                const priceB = getMinPrice(b)?.value ?? Number.POSITIVE_INFINITY;
                return priceA - priceB;
            });
        } else {
            sorted.sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at).getTime();
                const dateB = new Date(b.updated_at || b.created_at).getTime();
                return dateB - dateA;
            });
        }

        return sorted;
    }, [publishedCatalog, searchQuery, onlyImported, onlyPriced, importedIds, sortMode]);

    const totalCount = publishedCatalog.length;
    const importedCount = importedIds.size;
    const pricedCount = publishedCatalog.filter((product) => (product.pod2_catalog_price_matrix || []).length > 0).length;

    const tenantResolved = tenantInfo.role !== null || tenantInfo.tenantId !== null;
    if (tenantResolved && !tenantInfo.isMasterAdmin) {
        return (
            <div className="space-y-6 max-w-3xl">
                <h1 className="text-3xl font-bold">POD v2 Katalog</h1>
                <p className="text-muted-foreground">
                    POD v2 er i øjeblikket kun tilgængelig for master‑tenant.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <Badge variant="outline" className="w-fit">POD v2</Badge>
                        <div>
                            <h1 className="text-3xl font-bold">Katalog & import</h1>
                            <p className="text-muted-foreground">
                                Vælg Print.com produkter, importér dem, og arbejd videre i pris‑ og konfigurationsflowet.
                            </p>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Aktiv tenant: {tenantInfo.isMasterAdmin ? "Master" : tenantInfo.tenantId || "Ukendt"}{tenantInfo.role ? ` (${tenantInfo.role})` : ""}
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Tilgængelige produkter</CardDescription>
                            <CardTitle className="text-2xl">{totalCount}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Importeret</CardDescription>
                            <CardTitle className="text-2xl">{importedCount}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Med prisrækker</CardDescription>
                            <CardTitle className="text-2xl">{pricedCount}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full lg:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Søg i katalog..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={onlyImported} onCheckedChange={(value) => setOnlyImported(Boolean(value))} />
                                Kun importeret
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={onlyPriced} onCheckedChange={(value) => setOnlyPriced(Boolean(value))} />
                                Har priser
                            </label>
                            <div className="flex items-center gap-2">
                                <ListFilter className="h-4 w-4 text-muted-foreground" />
                                <Select value={sortMode} onValueChange={setSortMode}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Sorter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recent">Senest opdateret</SelectItem>
                                        <SelectItem value="title">Navn (A‑Å)</SelectItem>
                                        <SelectItem value="price">Laveste pris</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {canMerge && (
                <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <GitMerge className="h-4 w-4" />
                            Sammenflet POD v2 imports (master)
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

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Hjælp til import & sammenfletning</CardTitle>
                    <CardDescription>
                        Kort forklaring på chunk‑import og hvorfor sammenfletning findes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible>
                        <AccordionItem value="chunk-help">
                            <AccordionTrigger>Hvordan virker chunk‑import?</AccordionTrigger>
                            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                                <p>
                                    Store POD‑produkter kan have tusindvis af prispunkter (format × materiale × finish × oplag).
                                    For at holde importen stabil gemmer systemet priser i batches på ca. 500 rækker ad gangen.
                                </p>
                                <p>
                                    Hvis et produkt er meget stort, er det tryggest at importere i flere dele og derefter bruge
                                    “Sammenflet” til at samle det hele i ét produkt.
                                </p>
                                <p>
                                    I pris‑preview i konfiguratoren vises maks. 500 kombinationer ad gangen. Det er kun en visuel grænse,
                                    ikke en teknisk lås, men store kombinationer kan gøre browseren langsom.
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="merge-help">
                            <AccordionTrigger>Hvad samler “Sammenflet”?</AccordionTrigger>
                            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                                <p>
                                    Sammenfletning samler valgte prisrækker og variantvalg i målproduktet og opdaterer
                                    matrix‑layoutet. Brug det når en import er delt i flere chunks.
                                </p>
                                <p>
                                    Tip: Hvis du rammer meget store kombinationer (fx &gt; 10.000 prisfelter), så del importen op
                                    i mindre dele og saml bagefter.
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            {loadingCatalog || loadingImports ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredCatalog && filteredCatalog.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredCatalog.map((product) => {
                        const isImported = importedIds.has(product.id);
                        const importRow = importByCatalogId.get(product.id);
                        const importedProduct = importRow ? importedProductById.get(importRow.product_id) : null;
                        const title = product.public_title?.da || product.public_title?.en || "Ukendt produkt";
                        const description = product.public_description?.da || product.public_description?.en || "";
                        const attributeGroups = product.pod2_catalog_attributes?.length || 0;
                        const attributeValues = (product.pod2_catalog_attributes || []).reduce((sum: number, attr: any) => {
                            return sum + (attr.pod2_catalog_attribute_values?.length || 0);
                        }, 0);
                        const priceRows = product.pod2_catalog_price_matrix?.length || 0;
                        const minPrice = getMinPrice(product);
                        const needsQuote = (product.pod2_catalog_price_matrix || []).some((row: any) => row.needs_quote);

                        return (
                            <Card key={product.id} className={isImported ? "border-emerald-500/40" : ""}>
                                <div className="relative">
                                    {product.public_images && product.public_images.length > 0 ? (
                                        <div className="aspect-[16/9] bg-muted overflow-hidden rounded-t-lg">
                                            <img
                                                src={product.public_images[0]}
                                                alt={title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-24 bg-muted rounded-t-lg flex items-center justify-center gap-2 text-muted-foreground text-sm">
                                            <Package className="h-5 w-5" />
                                            Intet billede
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                                        {isImported && (
                                            <Badge variant="default" className="bg-emerald-600">
                                                <Check className="h-3 w-3 mr-1" />
                                                Importeret
                                            </Badge>
                                        )}
                                        {needsQuote && (
                                            <Badge variant="secondary">Kræver tilbud</Badge>
                                        )}
                                    </div>
                                </div>

                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg leading-tight">{title}</CardTitle>
                                    {description && (
                                        <CardDescription className="line-clamp-2">{description}</CardDescription>
                                    )}
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            <Layers className="h-3 w-3" />
                                            {attributeGroups} grupper
                                        </Badge>
                                        <Badge variant="outline">{attributeValues} muligheder</Badge>
                                        <Badge variant="outline">{priceRows} prisrækker</Badge>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            {minPrice ? (
                                                <div className="text-sm font-semibold">Fra {formatPrice(minPrice.value, minPrice.currency)}</div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">Ingen priser</div>
                                            )}
                                            <div className="text-xs text-muted-foreground">Opdateret {new Date(product.updated_at || product.created_at).toLocaleDateString("da-DK")}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isImported && importedProduct?.slug && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(`/admin/product/${importedProduct.slug}`)}
                                                >
                                                    Åbn
                                                    <ArrowUpRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant={isImported ? "outline" : "default"}
                                                disabled={isImported || importProduct.isPending}
                                                onClick={() => handleOpenImport(product)}
                                            >
                                                {isImported ? (
                                                    <>Importeret</>
                                                ) : (
                                                    <>
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Importér
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {isImported && importRow?.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => {
                                                if (!confirm("Vil du slette dette POD v2 produkt?")) return;
                                                removeImport.mutate({ importId: importRow.id });
                                            }}
                                        >
                                            Fjern import
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg">Ingen POD v2 produkter tilgængelige</h3>
                        <p className="text-muted-foreground mt-2">
                            Der er ingen Print on Demand produkter tilgængelige for import endnu.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Import Dialog */}
            <Dialog
                open={importDialog.open}
                onOpenChange={(open) => {
                    setImportDialog({ ...importDialog, open });
                    if (!open) {
                        setWizardStep(1);
                        setMatrixDraft(null);
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Importér POD v2 Produkt</DialogTitle>
                        <DialogDescription>
                            Produktet oprettes i din produktliste og kan derefter publiceres til din butik.
                        </DialogDescription>
                    </DialogHeader>

                    {wizardStep === 1 && (
                        <>
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
                                <Button
                                    onClick={() => {
                                        if (!importDialog.product) return;
                                        ensureMatrixDraft(importDialog.product);
                                        setWizardStep(2);
                                    }}
                                >
                                    Næste
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {wizardStep === 2 && importDialog.product && (
                        <>
                            <div className="space-y-6 py-4 overflow-y-auto flex-1">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Matrix‑layout</CardDescription>
                                            <CardTitle className="text-base">Placér grupper</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                                            <p>Vælg en vertikal akse og fordel resten i rækker. Skjulte grupper vises ikke.</p>
                                            <p>Gemmer layoutet på katalogproduktet, så fremtidige imports bruger samme struktur.</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Oplag</CardDescription>
                                            <CardTitle className="text-base">Vælg mængder</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="flex flex-wrap gap-2">
                                                {availableQuantities.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">Ingen oplag fundet.</span>
                                                )}
                                                {availableQuantities.map((qty) => {
                                                    const checked = matrixDraft?.quantities.includes(qty);
                                                    return (
                                                        <label key={qty} className="flex items-center gap-2 text-xs">
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(value) => {
                                                                    setMatrixDraft((prev) => {
                                                                        if (!prev) return prev;
                                                                        if (value) {
                                                                            return { ...prev, quantities: Array.from(new Set([...prev.quantities, qty])).sort((a, b) => a - b) };
                                                                        }
                                                                        return { ...prev, quantities: prev.quantities.filter((q) => q !== qty) };
                                                                    });
                                                                }}
                                                            />
                                                            {qty}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Rækker</CardDescription>
                                            <CardTitle className="text-base">Navne</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="space-y-2">
                                                {(matrixDraft?.rows || []).map((row) => (
                                                    <div key={row.id} className="flex items-center gap-2">
                                                        <Input
                                                            value={row.title}
                                                            onChange={(e) => updateRowTitle(row.id, e.target.value)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={addRow}>
                                                Tilføj række
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    {(importDialog.product.pod2_catalog_attributes || []).map((attr: any) => {
                                        const groupKey = attr.group_key;
                                        const label = getGroupLabel(importDialog.product, groupKey);
                                        const assignment = matrixDraft?.verticalAxis === groupKey
                                            ? "vertical"
                                            : matrixDraft?.fixed.includes(groupKey)
                                                ? "fixed"
                                                : matrixDraft?.rows.find((row) => row.groupKeys.includes(groupKey))
                                                    ? `row:${matrixDraft?.rows.find((row) => row.groupKeys.includes(groupKey))?.id}`
                                                    : "hidden";

                                        return (
                                            <Card key={groupKey}>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">{label}</CardTitle>
                                                    <CardDescription>{attr.pod2_catalog_attribute_values?.length || 0} værdier</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <Select
                                                        value={assignment}
                                                        onValueChange={(value) => updateAssignment(groupKey, value)}
                                                    >
                                                        <SelectTrigger className="h-8 text-sm">
                                                            <SelectValue placeholder="Placering" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="vertical">Vertikal akse</SelectItem>
                                                            <SelectItem value="fixed">Fast (vises altid)</SelectItem>
                                                            {(matrixDraft?.rows || []).map((row) => (
                                                                <SelectItem key={row.id} value={`row:${row.id}`}>
                                                                    {row.title || "Række"}
                                                                </SelectItem>
                                                            ))}
                                                            <SelectItem value="hidden">Skjul</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                {!matrixDraft?.verticalAxis && "Vælg en vertikal akse før du gemmer layoutet."}
                            </div>

                            <DialogFooter className="flex items-center justify-between gap-3">
                                <Button variant="outline" onClick={() => setWizardStep(1)}>
                                    Tilbage
                                </Button>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            void handleSaveMapping();
                                        }}
                                        disabled={savingMapping || !matrixDraft?.verticalAxis}
                                    >
                                        {savingMapping && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Gem layout
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            const ok = await handleSaveMapping();
                                            if (ok) {
                                                await handleImport();
                                            }
                                        }}
                                        disabled={importProduct.isPending || savingMapping || !matrixDraft?.verticalAxis}
                                    >
                                        {(importProduct.isPending || savingMapping) ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Download className="h-4 w-4 mr-2" />
                                        )}
                                        Gem & importér
                                    </Button>
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default Pod2Katalog;
