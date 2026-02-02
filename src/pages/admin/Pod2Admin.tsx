// POD v2 Admin - Master Tenant Print on Demand Management
// Includes Explorer, Browse, Curate, Pricing, and Publish tabs

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Save, Trash2, Plus, RefreshCw, Globe, Key, Zap, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
    usePodConnections,
    usePodApiPresets,
    usePodExplorer,
    useSavePodConnection,
    useDeletePodConnection,
    useSavePodPreset,
    useDeletePodPreset,
    usePodCatalogProducts,
} from "@/lib/pod2/hooks";
import { POD_DEFAULT_QUANTITIES } from "@/lib/pod2/types";
import type { PodExplorerRequest } from "@/lib/pod2/types";
import { Pod2Katalog } from "@/pages/admin/Pod2Katalog";

// Default presets for Print.com API exploration
const DEFAULT_PRESETS = [
    { name: "List Products", method: "GET", path: "/products", query: {} },
    { name: "Product Details", method: "GET", path: "/products/{sku}", query: {} },
    { name: "Get Price", method: "POST", path: "/products/{sku}/price", query: {} },
];

export function Pod2Admin() {
    const [activeTab, setActiveTab] = useState("explorer");

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Print on Demand v2</h1>
                    <p className="text-muted-foreground">
                        Administrer POD v2-leverandører, katalog og priser (kun Master)
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="explorer">API Explorer</TabsTrigger>
                    <TabsTrigger value="browse">Vælg produkt</TabsTrigger>
                    <TabsTrigger value="curate">Konfigurer</TabsTrigger>
                    <TabsTrigger value="catalog">Katalog</TabsTrigger>
                </TabsList>

                <TabsContent value="explorer">
                    <ExplorerTab />
                </TabsContent>

                <TabsContent value="browse">
                    <BrowseTab />
                </TabsContent>

                <TabsContent value="curate">
                    <CurateTab />
                </TabsContent>

                <TabsContent value="catalog">
                    <Pod2Katalog />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ============================================================
// Explorer Tab - API Connection & Request Runner
// ============================================================

function ExplorerTab() {
    const { data: connections, isLoading: loadingConnections } = usePodConnections();
    const { data: presets, isLoading: loadingPresets } = usePodApiPresets();
    const { execute, loading: executing, response, error } = usePodExplorer();
    const saveConnection = useSavePodConnection();
    const savePreset = useSavePodPreset();
    const deletePreset = useDeletePodPreset();
    const deleteConnection = useDeletePodConnection();

    const [showNewConnection, setShowNewConnection] = useState(false);
    const [connectionForm, setConnectionForm] = useState<{
        id?: string;
        provider_key: string;
        base_url: string;
        auth_header_mode: "authorization_bearer" | "x_api_key" | "custom";
        auth_header_name: string;
        auth_header_prefix: string;
        api_key: string;
    }>({
        provider_key: "printcom",
        base_url: "https://api.print.com",
        auth_header_mode: "custom",
        auth_header_name: "authorization",
        auth_header_prefix: "PrintApiKey",
        api_key: "",
    });

    const [request, setRequest] = useState<PodExplorerRequest>({
        method: "GET",
        path: "/products",
        query: {},
        requestBody: undefined,
    });

    const [queryString, setQueryString] = useState("");
    const [bodyString, setBodyString] = useState("");

    const activeConnection = connections?.find((connection) => connection.is_active) || connections?.[0];
    const isEditingConnection = Boolean(connectionForm.id);

    const handleExecute = async () => {
        const query = queryString ? JSON.parse(queryString) : {};
        const body = bodyString ? JSON.parse(bodyString) : undefined;

        try {
            await execute({
                ...request,
                query,
                requestBody: body,
            });
        } catch (e) {
            // Error handled by hook
        }
    };

    const handleTestAuth = async () => {
        if (!activeConnection) return;

        try {
            const result = await execute({
                method: "GET",
                path: "/products",
                query: {},
                connectionId: activeConnection.id,
            });

            const status = result?.status;
            if (status && status >= 200 && status < 300) {
                toast.success("Auth OK");
            } else {
                toast.error(`Auth fejl (${status || "ukendt"})`);
            }
        } catch (e) {
            // Error handled by hook
        }
    };

    const handleSaveConnection = async () => {
        await saveConnection.mutateAsync({ ...connectionForm, is_active: true });
        setShowNewConnection(false);
        setConnectionForm({
            id: undefined,
            provider_key: "printcom",
            base_url: "https://api.print.com",
            auth_header_mode: "custom",
            auth_header_name: "authorization",
            auth_header_prefix: "PrintApiKey",
            api_key: "",
        });
    };

    const handleLoadPreset = (preset: typeof presets[number]) => {
        setRequest({
            method: preset.method as any,
            path: preset.path,
            query: preset.query,
            requestBody: preset.body,
        });
        setQueryString(preset.query ? JSON.stringify(preset.query, null, 2) : "");
        setBodyString(preset.body ? JSON.stringify(preset.body, null, 2) : "");
    };

    const handleSaveAsPreset = async () => {
        const name = prompt("Preset navn:");
        if (!name) return;

        await savePreset.mutateAsync({
            name,
            method: request.method,
            path: request.path,
            query: queryString ? JSON.parse(queryString) : {},
            body: bodyString ? JSON.parse(bodyString) : null,
        });
    };

    return (
        <div className="grid grid-cols-3 gap-6">
            {/* Left: Connection & Presets */}
            <div className="space-y-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            API Forbindelse
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loadingConnections ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : activeConnection ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{activeConnection.provider_key}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default" className="text-[10px] h-5">Aktiv</Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-[10px] px-2"
                                            onClick={() => {
                                                setShowNewConnection(true);
                                                setConnectionForm({
                                                    id: activeConnection.id,
                                                    provider_key: activeConnection.provider_key,
                                                    base_url: activeConnection.base_url,
                                                    auth_header_mode: activeConnection.auth_header_mode,
                                                    auth_header_name: activeConnection.auth_header_name || "",
                                                    auth_header_prefix: activeConnection.auth_header_prefix || "",
                                                    api_key: "",
                                                });
                                            }}
                                        >
                                            Rediger
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                if (confirm('Slet forbindelse?')) {
                                                    deleteConnection.mutate(activeConnection.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground truncate" title={activeConnection.base_url}>{activeConnection.base_url}</p>
                                <p className="text-xs text-muted-foreground">Aktiv forbindelse bruges til alle requests</p>
                                <div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-2"
                                        onClick={handleTestAuth}
                                        disabled={executing}
                                    >
                                        {executing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                        Test auth
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Ingen aktiv forbindelse</p>
                        )}

                        {!showNewConnection ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowNewConnection(true);
                                    setConnectionForm({
                                        id: undefined,
                                        provider_key: "printcom",
                                        base_url: "https://api.print.com",
                                        auth_header_mode: "custom",
                                        auth_header_name: "authorization",
                                        auth_header_prefix: "PrintApiKey",
                                        api_key: "",
                                    });
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                {activeConnection ? "Ny forbindelse" : "Tilføj forbindelse"}
                            </Button>
                        ) : (
                            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                                <div className="space-y-2">
                                    <Label>Leverandør</Label>
                                    <Input
                                        value={connectionForm.provider_key}
                                        onChange={(e) => setConnectionForm({ ...connectionForm, provider_key: e.target.value })}
                                        placeholder="printcom"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Base URL</Label>
                                    <Input
                                        value={connectionForm.base_url}
                                        onChange={(e) => setConnectionForm({ ...connectionForm, base_url: e.target.value })}
                                        placeholder="https://api.print.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Auth Mode</Label>
                                    <Select
                                        value={connectionForm.auth_header_mode}
                                        onValueChange={(v: any) => setConnectionForm({ ...connectionForm, auth_header_mode: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="authorization_bearer">Authorization: Bearer</SelectItem>
                                            <SelectItem value="x_api_key">X-API-Key</SelectItem>
                                            <SelectItem value="custom">Custom Header</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => setConnectionForm({
                                            ...connectionForm,
                                            auth_header_mode: "custom",
                                            auth_header_name: "authorization",
                                            auth_header_prefix: "PrintApiKey",
                                        })}
                                    >
                                        Brug Print.com API key header
                                    </Button>
                                </div>
                                {connectionForm.auth_header_mode === "custom" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Header Name</Label>
                                            <Input
                                                value={connectionForm.auth_header_name}
                                                onChange={(e) => setConnectionForm({ ...connectionForm, auth_header_name: e.target.value })}
                                                placeholder="X-Custom-Auth"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Prefix</Label>
                                            <Input
                                                value={connectionForm.auth_header_prefix}
                                                onChange={(e) => setConnectionForm({ ...connectionForm, auth_header_prefix: e.target.value })}
                                                placeholder="Token"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="space-y-2">
                                    <Label>API Key</Label>
                                    <Input
                                        type="password"
                                        value={connectionForm.api_key}
                                        onChange={(e) => setConnectionForm({ ...connectionForm, api_key: e.target.value })}
                                        placeholder={isEditingConnection ? "Lad være tom for at beholde eksisterende nøgle" : "••••••••"}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Print.com bruger headeren <span className="font-mono">authorization: PrintApiKey &lt;key&gt;</span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveConnection} disabled={saveConnection.isPending}>
                                        {saveConnection.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                                        {isEditingConnection ? "Opdater" : "Gem"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => {
                                        setShowNewConnection(false);
                                        setConnectionForm({
                                            id: undefined,
                                            provider_key: "printcom",
                                            base_url: "https://api.print.com",
                                            auth_header_mode: "custom",
                                            auth_header_name: "authorization",
                                            auth_header_prefix: "PrintApiKey",
                                            api_key: "",
                                        });
                                    }}>
                                        Annuller
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Bibliotek
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loadingPresets ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                {/* Saved Connections Section */}
                                {connections && connections.filter(c => !c.is_active).length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gemte Forbindelser</Label>
                                        {connections.filter(c => !c.is_active).map(conn => (
                                            <div key={conn.id} className="flex items-center justify-between p-2 rounded-md border text-sm hover:bg-muted/50 transition-colors">
                                                <div className="flex flex-col overflow-hidden mr-2">
                                                    <span className="font-medium truncate">{conn.provider_key}</span>
                                                    <span className="text-xs text-muted-foreground truncate">{conn.base_url}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2"
                                                        onClick={() => saveConnection.mutate({ id: conn.id, is_active: true })}
                                                    >
                                                        Aktiver
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            if (confirm('Slet forbindelse?')) {
                                                                deleteConnection.mutate(conn.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Presets Section */}
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requests</Label>
                                {presets?.map((preset) => (
                                    <div key={preset.id} className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 justify-start text-left"
                                            onClick={() => handleLoadPreset(preset)}
                                        >
                                            <Badge variant="outline" className="mr-2 text-xs">
                                                {preset.method}
                                            </Badge>
                                            {preset.name}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                            onClick={() => deletePreset.mutate(preset.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                {(!presets || presets.length === 0) && (
                                    <p className="text-sm text-muted-foreground">Ingen presets gemt</p>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Center: Request Builder */}
            <div className="space-y-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Request
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Select
                                value={request.method}
                                onValueChange={(v: any) => setRequest({ ...request, method: v })}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                value={request.path}
                                onChange={(e) => setRequest({ ...request, path: e.target.value })}
                                placeholder="/products"
                                className="flex-1"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Query Parameters (JSON)</Label>
                            <Textarea
                                value={queryString}
                                onChange={(e) => setQueryString(e.target.value)}
                                placeholder='{}'
                                rows={3}
                                className="font-mono text-sm"
                            />
                        </div>

                        {["POST", "PUT"].includes(request.method) && (
                            <div className="space-y-2">
                                <Label>Request Body (JSON)</Label>
                                <Textarea
                                    value={bodyString}
                                    onChange={(e) => setBodyString(e.target.value)}
                                    placeholder='{}'
                                    rows={6}
                                    className="font-mono text-sm"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button onClick={handleExecute} disabled={executing || !activeConnection}>
                                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                Kør
                            </Button>
                            <Button variant="outline" onClick={() => {
                                const name = prompt("Navngiv preset:");
                                if (name) {
                                    savePreset.mutate({
                                        name,
                                        method: request.method,
                                        path: request.path,
                                        query: JSON.parse(queryString || '{}'),
                                        body: bodyString ? JSON.parse(bodyString) : undefined
                                    });
                                }
                            }}>
                                <Save className="h-4 w-4 mr-2" />
                                Gem Preset
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Right: Response */}
            <div>
                <Card className="h-full">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            Response
                            {response && (
                                <Badge variant={response.status < 400 ? "default" : "destructive"}>
                                    {response.status} {response.statusText}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {executing ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        ) : response ? (
                            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[600px] whitespace-pre-wrap">
                                {typeof response.data === "string"
                                    ? response.data
                                    : JSON.stringify(response.data, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-12">
                                Kør en request for at se resultatet
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}

// ============================================================
// Browse Tab - View supplier products
// ============================================================

function BrowseTab() {
    type PodImportPreset = {
        id: string;
        name: string;
        sku?: string;
        selections: Record<string, string[]>;
        optionLabels: Record<string, Record<string, string>>;
        groupLabels: Record<string, string>;
        quantities: number[];
        deliveryPromise: number;
        markupMode: "percent" | "fixed";
        markupValue: number;
        region: string;
        currency: string;
        useBatch: boolean;
        autoPublish: boolean;
        maxVariants: number;
        maxRequests: number;
    };

    type MatrixRow = {
        id: string;
        title: string;
        groupKeys: string[];
    };

    type PodMatrixMapping = {
        version: number;
        verticalAxis: string | null;
        rows: MatrixRow[];
        fixed: string[];
    };

    const PRESET_STORAGE_KEY = "pod2_import_presets_v1";
    const DEFAULT_MAX_VARIANTS = 24;
    const DEFAULT_MAX_REQUESTS = 120;
    const createDefaultMatrixRows = (): MatrixRow[] => ([
        { id: "row-1", title: "Række 1", groupKeys: [] },
        { id: "row-2", title: "Række 2", groupKeys: [] },
    ]);

    const { execute, loading, response } = usePodExplorer();
    const { data: catalogProducts, refetch: refetchCatalog } = usePodCatalogProducts();
    const [products, setProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [importingSku, setImportingSku] = useState<string | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [wizardLoading, setWizardLoading] = useState(false);
    const [wizardProduct, setWizardProduct] = useState<any | null>(null);
    const [wizardDetails, setWizardDetails] = useState<any | null>(null);
    const [wizardTitle, setWizardTitle] = useState("");
    const [wizardDescription, setWizardDescription] = useState("");
    const [wizardQuantities, setWizardQuantities] = useState(POD_DEFAULT_QUANTITIES.join(", "));
    const [wizardDeliveryPromise, setWizardDeliveryPromise] = useState("0");
    const [wizardMarkupMode, setWizardMarkupMode] = useState<"percent" | "fixed">("percent");
    const [wizardMarkupValue, setWizardMarkupValue] = useState("20");
    const [wizardPricingType, setWizardPricingType] = useState<"matrix" | "storformat">("matrix");
    const [wizardSelections, setWizardSelections] = useState<Record<string, string[]>>({});
    const [wizardOptionLabels, setWizardOptionLabels] = useState<Record<string, Record<string, string>>>({});
    const [wizardGroupLabels, setWizardGroupLabels] = useState<Record<string, string>>({});
    const [wizardRegion, setWizardRegion] = useState("DK");
    const [wizardCurrency, setWizardCurrency] = useState("DKK");
    const [wizardUseBatch, setWizardUseBatch] = useState(true);
    const [wizardAutoPublish, setWizardAutoPublish] = useState(false);
    const [wizardMaxVariants, setWizardMaxVariants] = useState(String(DEFAULT_MAX_VARIANTS));
    const [wizardMaxRequests, setWizardMaxRequests] = useState(String(DEFAULT_MAX_REQUESTS));
    const [wizardPresetId, setWizardPresetId] = useState("");
    const [wizardPresetName, setWizardPresetName] = useState("");
    const [wizardPresets, setWizardPresets] = useState<PodImportPreset[]>([]);
    const [wizardPresetsReady, setWizardPresetsReady] = useState(false);
    const [wizardError, setWizardError] = useState<string | null>(null);
    const [wizardProbeLoading, setWizardProbeLoading] = useState(false);
    const [wizardMatrixMapping, setWizardMatrixMapping] = useState<PodMatrixMapping>({
        version: 1,
        verticalAxis: null,
        rows: createDefaultMatrixRows(),
        fixed: [],
    });
    const [wizardMatrixMappingReady, setWizardMatrixMappingReady] = useState(false);

    const sheetSizeProbeCache = useRef(new Map<string, string | null>());
    const sheetSizeProbeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const importedSkus = new Set((catalogProducts || []).map((product) => product.supplier_product_ref));
    const filteredProducts = products.filter((product) => {
        if (!productSearch.trim()) return true;
        const needle = productSearch.trim().toLowerCase();
        const sku = String(product?.sku || product?.id || product?.productId || product?.product_id || "");
        const title = String(product?.titleSingle || product?.title || product?.name || product?.titlePlural || "");
        return sku.toLowerCase().includes(needle) || title.toLowerCase().includes(needle);
    });
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setWizardPresets(parsed);
                }
            }
        } catch (e) {
            // Ignore storage errors
        } finally {
            setWizardPresetsReady(true);
        }
    }, []);

    useEffect(() => {
        if (!wizardPresetsReady) return;
        try {
            window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(wizardPresets));
        } catch (e) {
            // Ignore storage errors
        }
    }, [wizardPresets, wizardPresetsReady]);

    useEffect(() => {
        if (!wizardMatrixMappingReady) return;
        if (!wizardDetails) return;
        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const groupKeys = properties
            .filter((property: any) => {
                if (!property?.slug || property?.locked) return false;
                if (!Array.isArray(property?.options) || property.options.length === 0) return false;
                return property.slug !== "copies" && property.slug !== "bundle";
            })
            .map((property: any) => String(property.slug));

        if (groupKeys.length === 0) return;

        setWizardMatrixMapping((prev) => {
            const next = syncMatrixMapping(prev, groupKeys);
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
    }, [wizardMatrixMappingReady, wizardDetails, wizardSelections]);

    const handleFetchProducts = async () => {
        try {
            const result = await execute({
                method: "GET",
                path: "/products",
                query: {},
            });

            if (result?.data) {
                // Adapt based on actual API response structure
                const items = Array.isArray(result.data)
                    ? result.data
                    : Array.isArray(result.data.items)
                        ? result.data.items
                        : result.data.products || result.data.items || [];
                setProducts(items);
            }
        } catch (e) {
            // Error handled by hook
        }
    };

    const normalizeOptionValue = (value: any) => {
        if (value === "true") return true;
        if (value === "false") return false;
        if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
            return Number(value);
        }
        return value;
    };

    const pickOptionSlug = (property: any) => {
        const options = Array.isArray(property?.options) ? property.options : [];
        const slug = String(property?.slug || "");

        const findBySlug = (candidates: string[]) => {
            for (const candidate of candidates) {
                const match = options.find((option: any) => String(option?.slug) === candidate);
                if (match) return match;
            }
            return null;
        };

        if (slug === "size") {
            const preferred = findBySlug(["a5", "a4", "a6"]);
            if (preferred) return preferred.slug;
            const fallback = options.find((option: any) => String(option?.slug) !== "custom");
            return fallback?.slug;
        }

        if (slug === "material") {
            const preferred = findBySlug(["135gr_gesatineerd_mc", "170gr_gesatineerd_mc", "135gr_silk_mc"]);
            if (preferred) return preferred.slug;
        }

        if (slug === "printtype") {
            const preferred = findBySlug(["40"]);
            if (preferred) return preferred.slug;
        }

        if (slug === "printingmethod") {
            const preferred = findBySlug(["digital"]);
            if (preferred) return preferred.slug;
        }

        if (slug === "flexibleprintingmethod") {
            const preferred = findBySlug(["false"]);
            if (preferred) return preferred.slug;
        }

        if (slug === "urgency") {
            const preferred = findBySlug(["standard", "moderate", "quick"]);
            if (preferred) return preferred.slug;
        }

        if (slug === "delivery") {
            const preferred = findBySlug(["box_max_weight_15_kg"]);
            if (preferred) return preferred.slug;
        }

        if (!property?.required) {
            const preferred = findBySlug(["none", "geen", "no", "false"]);
            if (preferred) return preferred.slug;
        }

        const fallback = options.find((option: any) => String(option?.slug) !== "custom");
        return fallback?.slug ?? options[0]?.slug;
    };

    const buildPriceTemplate = (properties: any[]) => {
        const baseOptions: Record<string, any> = {};
        const copiesProperty = properties.find((property) => property?.slug === "copies");
        const bundleProperty = properties.find((property) => property?.slug === "bundle");

        for (const property of properties) {
            if (!property?.slug || property?.locked) continue;
            if (property.slug === "copies") continue;
            const optionSlug = pickOptionSlug(property);
            if (optionSlug === undefined) continue;
            baseOptions[property.slug] = normalizeOptionValue(optionSlug);
        }

        let quantities = POD_DEFAULT_QUANTITIES.slice();
        if (copiesProperty?.options?.length) {
            const copyValues = copiesProperty.options
                .map((option: any) => normalizeOptionValue(option?.slug))
                .filter((value: any) => typeof value === "number" && Number.isFinite(value));
            if (copyValues.length > 0) {
                quantities = Array.from(new Set(copyValues)).sort((a, b) => a - b);
            }
        }

        const bundleOptions = Array.isArray(bundleProperty?.options) ? bundleProperty.options : [];
        const bundleByQuantity = new Map<number, any>();
        for (const option of bundleOptions) {
            const match = String(option?.slug || "").match(/(\\d+)/);
            if (match) {
                bundleByQuantity.set(Number(match[1]), option);
            }
        }

        return { baseOptions, quantities, bundleByQuantity };
    };

    const parseQuantities = (input: string) => {
        const values = input
            .split(/[,;\s]+/)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0);
        return Array.from(new Set(values)).sort((a, b) => a - b);
    };

    const formatQuantities = (values: number[]) => values.join(", ");

    const roundCurrency = (value: number) => Math.round(value * 100) / 100;

    const normalizeSelectionMap = (map: Record<string, string[]> | null | undefined) => {
        const source = map || {};
        const normalized: Record<string, string[]> = {};
        for (const key of Object.keys(source).sort()) {
            const values = Array.isArray(source[key]) ? source[key] : [];
            normalized[key] = values.map((value) => String(value)).sort();
        }
        return JSON.stringify(normalized);
    };

    const normalizeQuantities = (values: any) => {
        const list = Array.isArray(values) ? values : [];
        const normalized = list
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
        return JSON.stringify(normalized);
    };

    const buildVariantSignature = (options: Record<string, any>) => {
        const signature = Object.keys(options)
            .sort()
            .map((key) => `${key}:${String(options[key])}`)
            .join("|");
        return signature || "default";
    };

    const MATRIX_CONTAINER_VERTICAL = "matrix:vertical";
    const MATRIX_CONTAINER_FIXED = "matrix:fixed";
    const MATRIX_GROUP_PREFIX = "matrix:group:";

    const toMatrixItemId = (groupKey: string) => `${MATRIX_GROUP_PREFIX}${groupKey}`;
    const fromMatrixItemId = (itemId: string) => itemId.replace(MATRIX_GROUP_PREFIX, "");
    const matrixRowContainerId = (rowId: string) => `matrix:row:${rowId}`;

    const isFormatGroupKey = (slug: string) => {
        const value = slug.toLowerCase();
        return value.includes("size") || value.includes("format");
    };

    const isMaterialGroupKey = (slug: string) => {
        const value = slug.toLowerCase();
        return value.includes("material") || value.includes("paper") || value.includes("stock") || value.includes("substrate") || value.includes("media");
    };

    const isAllowedVerticalKey = (slug: string) => isFormatGroupKey(slug) || isMaterialGroupKey(slug);

    const isFinishGroupKey = (slug: string) => {
        const value = slug.toLowerCase();
        return value.includes("finish") || value.includes("lamination") || value.includes("spot") || value.includes("foil");
    };

    const suggestPricingType = (properties: any[]) => {
        const sizeProperty = properties.find((property) => String(property?.slug) === "size");
        const options = Array.isArray(sizeProperty?.options) ? sizeProperty.options : [];
        const hasCustom = options.some((option: any) => String(option?.slug || "").toLowerCase().includes("custom"));
        const hasLarge = options.some((option: any) => isLargeSizeSlug(String(option?.slug || "")));
        if (hasCustom || hasLarge) return "storformat";
        return "matrix";
    };

    const buildDefaultMatrixMapping = (properties: any[], selections: Record<string, string[]>) => {
        const groupKeys = properties
            .map((property) => String(property?.slug || ""))
            .filter((slug) => slug);
        if (groupKeys.length === 0) {
            return {
                version: 1,
                verticalAxis: null,
                rows: createDefaultMatrixRows(),
                fixed: [],
            } as PodMatrixMapping;
        }

        const verticalAxis = null;
        const rows = createDefaultMatrixRows();
        const fixed: string[] = [];

        for (const groupKey of groupKeys) {
            if (groupKey === verticalAxis) continue;
            const valueCount = selections[groupKey]?.length || 0;
            if (valueCount <= 1) {
                fixed.push(groupKey);
                continue;
            }
            if (isMaterialGroupKey(groupKey)) {
                rows[0].groupKeys.push(groupKey);
            } else if (isFinishGroupKey(groupKey)) {
                rows[Math.min(1, rows.length - 1)].groupKeys.push(groupKey);
            } else {
                rows[0].groupKeys.push(groupKey);
            }
        }

        return {
            version: 1,
            verticalAxis,
            rows,
            fixed,
        };
    };

    const syncMatrixMapping = (mapping: PodMatrixMapping, groupKeys: string[]) => {
        const cleanedRows = mapping.rows.map((row) => ({
            ...row,
            groupKeys: row.groupKeys.filter((key) => groupKeys.includes(key)),
        }));
        const cleanedFixed = mapping.fixed.filter((key) => groupKeys.includes(key));
        let verticalAxis = mapping.verticalAxis && groupKeys.includes(mapping.verticalAxis) ? mapping.verticalAxis : null;
        if (verticalAxis && !isAllowedVerticalKey(verticalAxis)) {
            verticalAxis = null;
        }

        const usedKeys = new Set<string>([
            ...(verticalAxis ? [verticalAxis] : []),
            ...cleanedFixed,
            ...cleanedRows.flatMap((row) => row.groupKeys),
        ]);

        const missingKeys = groupKeys.filter((key) => !usedKeys.has(key));
        if (missingKeys.length > 0) {
            if (cleanedRows.length === 0) {
                cleanedRows.push(...createDefaultMatrixRows());
            }
            cleanedRows[0].groupKeys = [...cleanedRows[0].groupKeys, ...missingKeys];
        }

        if (verticalAxis) {
            for (const row of cleanedRows) {
                row.groupKeys = row.groupKeys.filter((key) => key !== verticalAxis);
            }
            const fixedWithout = cleanedFixed.filter((key) => key !== verticalAxis);
            return {
                ...mapping,
                verticalAxis,
                rows: cleanedRows,
                fixed: fixedWithout,
            };
        }

        return {
            ...mapping,
            verticalAxis,
            rows: cleanedRows,
            fixed: cleanedFixed,
        };
    };


    const buildVariantCombos = (
        properties: any[],
        selections: Record<string, string[]>,
    ) => {
        const entries = properties.map((property) => ({
            slug: String(property.slug),
            values: (selections[property.slug] || []).map((value) => String(value)),
        }));

        let combos: Record<string, string>[] = [{}];
        for (const entry of entries) {
            const next: Record<string, string>[] = [];
            for (const combo of combos) {
                for (const value of entry.values) {
                    next.push({ ...combo, [entry.slug]: value });
                }
            }
            combos = next;
        }

        return combos;
    };

    const extractBatchCost = (item: any, deliveryPromise: number) => {
        if (!item || typeof item !== "object") return null;
        const price = item.price || {};
        if (deliveryPromise === 1 && typeof price.delivery_promise_insured_price === "number") {
            return price.delivery_promise_insured_price;
        }
        if (deliveryPromise === 2 && typeof price.delivery_promise_premium_price === "number") {
            return price.delivery_promise_premium_price;
        }
        if (typeof price.delivery_promise_standard_price === "number") {
            return price.delivery_promise_standard_price;
        }
        if (typeof price.price === "number") {
            return price.price;
        }
        return null;
    };

    const isLargeSizeSlug = (slug: string) => {
        const value = slug.toLowerCase();
        if (value.startsWith("a2") || value.startsWith("a3") || value.startsWith("a4")) return true;
        if (value.includes("large") || value.includes("plus") || value.includes("custom")) return true;
        if (value.includes("300_x_400")) return true;
        return false;
    };

    const resolveWizardSku = () => {
        return String(
            wizardProduct?.sku
            || wizardProduct?.id
            || wizardProduct?.productId
            || wizardProduct?.product_id
            || wizardDetails?.sku
            || wizardDetails?.id
            || "",
        );
    };

    const resolveProbeQuantity = () => {
        const quantities = parseQuantities(wizardQuantities);
        if (quantities.length > 0) return quantities[0];
        return POD_DEFAULT_QUANTITIES[0] || 1;
    };

    const resolveBundleOption = (properties: any[], quantity: number) => {
        const bundleProperty = properties.find((property) => property?.slug === "bundle");
        const bundleOptions = Array.isArray(bundleProperty?.options) ? bundleProperty.options : [];
        if (bundleOptions.length === 0) return null;

        const bundleByQuantity = new Map<number, any>();
        for (const option of bundleOptions) {
            const match = String(option?.slug || "").match(/(\\d+)/);
            if (match) {
                bundleByQuantity.set(Number(match[1]), option);
            }
        }

        const bundleOption = bundleByQuantity.get(quantity) || bundleByQuantity.values().next().value;
        if (bundleOption?.slug) return String(bundleOption.slug);
        return null;
    };

    const buildBaseOptionsFromSelections = (selections: Record<string, string[]>) => {
        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const options: Record<string, any> = {};

        for (const property of properties) {
            if (!property?.slug || property?.locked) continue;
            if (!Array.isArray(property?.options) || property.options.length === 0) continue;
            if (property.slug === "copies" || property.slug === "bundle") continue;

            const selectedValues = selections[property.slug] || [];
            let value = selectedValues[0];
            if (!value) {
                const fallback = pickOptionSlug(property);
                if (fallback === undefined) continue;
                value = String(fallback);
            }
            options[property.slug] = normalizeOptionValue(value);
        }

        return options;
    };

    const buildSheetSizeProbeKey = (
        sku: string,
        sizeSelections: string[],
        baseOptions: Record<string, any>,
        quantity: number,
        bundle: string | null,
    ) => {
        const sortedSizes = sizeSelections.slice().sort();
        const keyOptions = { ...baseOptions };
        delete keyOptions.sheet_size;
        const key = {
            sku,
            sizes: sortedSizes,
            options: keyOptions,
            quantity,
            bundle,
        };
        return JSON.stringify(key);
    };

    const scheduleSheetSizeProbe = (
        selections: Record<string, string[]>,
        sizeSelections: string[],
    ) => {
        const sku = resolveWizardSku();
        if (!sku) return;
        if (!wizardDetails) return;

        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const sheetProperty = properties.find((property: any) => String(property?.slug) === "sheet_size");
        if (!sheetProperty || !Array.isArray(sheetProperty.options) || sheetProperty.options.length === 0) {
            return;
        }

        const options = sheetProperty.options;
        const smallOption = options.find((option: any) => String(option?.slug) === "small_indigo_sheet")
            || options.find((option: any) => String(option?.name || "").toLowerCase().includes("small"));
        const largeOption = options.find((option: any) => String(option?.slug) === "large_indigo_sheet")
            || options.find((option: any) => String(option?.name || "").toLowerCase().includes("large"));

        if (!smallOption?.slug || !largeOption?.slug) return;
        if (sizeSelections.length === 0) return;

        const hasLargeSizes = sizeSelections.some((value) => isLargeSizeSlug(value));
        const hasSmallSizes = sizeSelections.some((value) => !isLargeSizeSlug(value));
        if (hasLargeSizes && hasSmallSizes) return;

        const quantity = resolveProbeQuantity();
        const baseOptions = buildBaseOptionsFromSelections(selections);
        const bundle = resolveBundleOption(properties, quantity);
        const probeKey = buildSheetSizeProbeKey(sku, sizeSelections, baseOptions, quantity, bundle);
        if (sheetSizeProbeCache.current.has(probeKey)) {
            const cached = sheetSizeProbeCache.current.get(probeKey);
            if (cached && (selections.sheet_size || [])[0] !== cached) {
                setWizardSelections((prev) => ({ ...prev, sheet_size: [cached] }));
                const label = String(options.find((option: any) => String(option?.slug) === cached)?.name || cached);
                ensureOptionLabel("sheet_size", cached, label);
            }
            return;
        }

        if (sheetSizeProbeTimer.current) {
            clearTimeout(sheetSizeProbeTimer.current);
        }

        sheetSizeProbeTimer.current = setTimeout(async () => {
            const order = hasLargeSizes
                ? [String(largeOption.slug), String(smallOption.slug)]
                : [String(smallOption.slug), String(largeOption.slug)];

            const deliveryPromise = Number(wizardDeliveryPromise) || 0;
            const baseRequestOptions = { ...baseOptions };
            if (bundle) {
                baseRequestOptions.bundle = normalizeOptionValue(bundle);
            }
            baseRequestOptions.copies = quantity;

            for (const candidate of order) {
                try {
                    const requestOptions = {
                        ...baseRequestOptions,
                        sheet_size: normalizeOptionValue(candidate),
                    };
                    const priceResponse = await execute({
                        method: "POST",
                        path: `/products/${sku}/price`,
                        query: {},
                        requestBody: {
                            sku,
                            deliveryPromise,
                            options: requestOptions,
                        },
                    });

                    const prices = priceResponse?.data?.prices;
                    const cost = typeof prices?.productPrice === "number" ? prices.productPrice : null;
                    if (typeof cost === "number") {
                        sheetSizeProbeCache.current.set(probeKey, candidate);
                        setWizardSelections((prev) => ({ ...prev, sheet_size: [candidate] }));
                        const label = String(options.find((option: any) => String(option?.slug) === candidate)?.name || candidate);
                        ensureOptionLabel("sheet_size", candidate, label);
                        toast.message(candidate === String(largeOption.slug) ? "Indigo Large aktiveret" : "Indigo Small aktiveret");
                        return;
                    }
                } catch (e) {
                    // Try next candidate
                }
            }

            sheetSizeProbeCache.current.set(probeKey, null);
        }, 700);
    };

    const applyAutoSheetSize = (selections: Record<string, string[]>, sizeSelections: string[]) => {
        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const sheetProperty = properties.find((property: any) => String(property?.slug) === "sheet_size");
        if (!sheetProperty || !Array.isArray(sheetProperty.options) || sheetProperty.options.length === 0) {
            return { selections, toastMessage: null, labels: [] as Array<{ value: string; label: string }> };
        }

        const sheetSlug = "sheet_size";
        const options = sheetProperty.options;
        const smallOption = options.find((option: any) => String(option?.slug) === "small_indigo_sheet")
            || options.find((option: any) => String(option?.name || "").toLowerCase().includes("small"));
        const largeOption = options.find((option: any) => String(option?.slug) === "large_indigo_sheet")
            || options.find((option: any) => String(option?.name || "").toLowerCase().includes("large"));

        const hasLargeSizes = sizeSelections.some((value) => isLargeSizeSlug(value));
        const hasSmallSizes = sizeSelections.some((value) => !isLargeSizeSlug(value));
        const currentSheets = selections[sheetSlug] || [];

        let nextSheets = currentSheets;
        let toastMessage: string | null = null;

        if (hasLargeSizes && !hasSmallSizes && largeOption?.slug) {
            const largeSlug = String(largeOption.slug);
            if (currentSheets.length !== 1 || currentSheets[0] !== largeSlug) {
                nextSheets = [largeSlug];
                toastMessage = "Indigo Large aktiveret";
            }
        } else if (!hasLargeSizes && hasSmallSizes && smallOption?.slug) {
            const smallSlug = String(smallOption.slug);
            if (currentSheets.length !== 1 || currentSheets[0] !== smallSlug) {
                nextSheets = [smallSlug];
                toastMessage = "Indigo Small aktiveret";
            }
        } else if (hasLargeSizes && hasSmallSizes) {
            const nextSet = new Set(currentSheets);
            if (smallOption?.slug) nextSet.add(String(smallOption.slug));
            if (largeOption?.slug) nextSet.add(String(largeOption.slug));
            const merged = Array.from(nextSet);
            if (merged.length !== currentSheets.length) {
                nextSheets = merged;
                toastMessage = "Både small og large størrelser valgt – aktiverer begge sheet sizes.";
            }
        }

        if (nextSheets === currentSheets) {
            return { selections, toastMessage: null, labels: [] as Array<{ value: string; label: string }> };
        }

        const labels = nextSheets.map((value) => {
            const match = options.find((option: any) => String(option?.slug) === value);
            return { value, label: String(match?.name || value) };
        });

        return {
            selections: { ...selections, [sheetSlug]: nextSheets },
            toastMessage,
            labels,
        };
    };

    const applySizePreset = (property: any, includeLandscape: boolean) => {
        const baseSizes = ["a4", "a5", "a7", "a8"];
        const options = Array.isArray(property?.options) ? property.options : [];
        const available = new Set(options.map((option: any) => String(option?.slug)));

        const selected: string[] = [];
        const missing: string[] = [];

        for (const size of baseSizes) {
            if (available.has(size)) {
                selected.push(size);
            } else {
                missing.push(size);
            }
            if (includeLandscape) {
                const landscape = `${size}_landscape`;
                if (available.has(landscape)) {
                    selected.push(landscape);
                } else if (!missing.includes(landscape)) {
                    missing.push(landscape);
                }
            }
        }

        setWizardSelections((prev) => ({
            ...prev,
            [property.slug]: selected,
        }));

        if (missing.length > 0) {
            toast.message(`Nogle størrelser findes ikke: ${missing.join(", ")}`);
        }
    };

    const clearPropertySelection = (slug: string) => {
        setWizardSelections((prev) => ({
            ...prev,
            [slug]: [],
        }));
    };

    const buildCandidateValues = (property: any, currentValue: string | undefined) => {
        const options = Array.isArray(property?.options) ? property.options : [];
        const values = options
            .map((option: any, index: number) => String(option?.slug ?? option?.name ?? index))
            .filter((value: string) => value);

        const ordered: string[] = [];
        const seen = new Set<string>();
        if (currentValue) {
            ordered.push(currentValue);
            seen.add(currentValue);
        }
        for (const value of values) {
            if (seen.has(value)) continue;
            ordered.push(value);
            seen.add(value);
        }
        return ordered;
    };

    const handleProbeSelection = async () => {
        if (wizardProbeLoading) return;
        const sku = resolveWizardSku();
        if (!sku) {
            toast.error("Produktet mangler en SKU");
            return;
        }
        if (!wizardDetails) {
            toast.error("Produktdetaljer er ikke indlæst endnu");
            return;
        }

        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const baseOptions = buildBaseOptionsFromSelections(wizardSelections);
        const quantity = resolveProbeQuantity();
        const bundle = resolveBundleOption(properties, quantity);
        const deliveryPromise = Number(wizardDeliveryPromise) || 0;

        if (bundle) {
            baseOptions.bundle = normalizeOptionValue(bundle);
        }
        baseOptions.copies = quantity;

        const printingProperty = properties.find((property) => property?.slug === "printingmethod");
        const deliveryProperty = properties.find((property) => property?.slug === "delivery");

        const printingCandidates = printingProperty
            ? buildCandidateValues(printingProperty, wizardSelections.printingmethod?.[0])
            : [""];
        const deliveryCandidates = deliveryProperty
            ? buildCandidateValues(deliveryProperty, wizardSelections.delivery?.[0])
            : [""];

        const combos: Array<{ printingmethod?: string; delivery?: string }> = [];
        for (const printing of printingCandidates) {
            for (const delivery of deliveryCandidates) {
                combos.push({
                    printingmethod: printing || undefined,
                    delivery: delivery || undefined,
                });
            }
        }

        const MAX_PROBE_REQUESTS = 6;
        const candidates = combos.slice(0, MAX_PROBE_REQUESTS);

        setWizardProbeLoading(true);
        try {
            let selected: { printingmethod?: string; delivery?: string } | null = null;
            for (const candidate of candidates) {
                const requestOptions = { ...baseOptions };
                if (candidate.printingmethod) {
                    requestOptions.printingmethod = normalizeOptionValue(candidate.printingmethod);
                }
                if (candidate.delivery) {
                    requestOptions.delivery = normalizeOptionValue(candidate.delivery);
                }

                try {
                    const priceResponse = await execute({
                        method: "POST",
                        path: `/products/${sku}/price`,
                        query: {},
                        requestBody: {
                            sku,
                            deliveryPromise,
                            options: requestOptions,
                        },
                    });

                    const prices = priceResponse?.data?.prices;
                    const cost = typeof prices?.productPrice === "number" ? prices.productPrice : null;
                    if (typeof cost === "number") {
                        selected = candidate;
                        break;
                    }
                } catch (e) {
                    // Try next candidate
                }
            }

            if (!selected) {
                toast.error("Ingen gyldig kombination fundet. Prøv at justere valg.");
                return;
            }

            const nextSelections = { ...wizardSelections };
            const updates: string[] = [];

            if (selected.printingmethod) {
                const current = wizardSelections.printingmethod?.[0];
                if (current !== selected.printingmethod) {
                    nextSelections.printingmethod = [selected.printingmethod];
                    const label = String(printingProperty?.options?.find((option: any) => String(option?.slug) === selected.printingmethod)?.name || selected.printingmethod);
                    ensureOptionLabel("printingmethod", selected.printingmethod, label);
                    updates.push(`print: ${label}`);
                }
            }

            if (selected.delivery) {
                const current = wizardSelections.delivery?.[0];
                if (current !== selected.delivery) {
                    nextSelections.delivery = [selected.delivery];
                    const label = String(deliveryProperty?.options?.find((option: any) => String(option?.slug) === selected.delivery)?.name || selected.delivery);
                    ensureOptionLabel("delivery", selected.delivery, label);
                    updates.push(`levering: ${label}`);
                }
            }

            setWizardSelections(nextSelections);

            if (updates.length > 0) {
                toast.message(`Aktiveret: ${updates.join(", ")}`);
            } else {
                toast.message("Valget er gyldigt");
            }
        } finally {
            setWizardProbeLoading(false);
        }
    };

    const clearWizardState = () => {
        setWizardProduct(null);
        setWizardDetails(null);
        setWizardTitle("");
        setWizardDescription("");
        setWizardQuantities(POD_DEFAULT_QUANTITIES.join(", "));
        setWizardDeliveryPromise("0");
        setWizardMarkupMode("percent");
        setWizardMarkupValue("20");
        setWizardPricingType("matrix");
        setWizardSelections({});
        setWizardOptionLabels({});
        setWizardGroupLabels({});
        setWizardRegion("DK");
        setWizardCurrency("DKK");
        setWizardUseBatch(true);
        setWizardAutoPublish(false);
        setWizardMaxVariants(String(DEFAULT_MAX_VARIANTS));
        setWizardMaxRequests(String(DEFAULT_MAX_REQUESTS));
        setWizardPresetId("");
        setWizardPresetName("");
        setWizardError(null);
        setWizardLoading(false);
        setWizardProbeLoading(false);
        setWizardMatrixMapping({
            version: 1,
            verticalAxis: null,
            rows: createDefaultMatrixRows(),
            fixed: [],
        });
        setWizardMatrixMappingReady(false);
        setWizardStep(1);
        if (sheetSizeProbeTimer.current) {
            clearTimeout(sheetSizeProbeTimer.current);
            sheetSizeProbeTimer.current = null;
        }
    };

    const handleWizardOpenChange = (open: boolean) => {
        if (!open && importingSku) return;
        setWizardOpen(open);
        if (!open) {
            clearWizardState();
        }
    };

    const openImportWizard = async (product: any) => {
        const sku = String(product?.sku || product?.id || product?.productId || product?.product_id || "");
        if (!sku) {
            toast.error("Produktet mangler en SKU");
            return;
        }

        if (importedSkus.has(sku)) {
            const shouldContinue = confirm(
                "Produktet er allerede i POD v2-kataloget. Vil du importere en ny variant som et separat produkt?",
            );
            if (!shouldContinue) {
                return;
            }
        }

        setWizardError(null);
        setWizardOpen(true);
        setWizardStep(1);
        setWizardLoading(true);
        setWizardProduct(product);
        setWizardDetails(null);
        setWizardTitle(product?.titleSingle || product?.title || product?.name || product?.titlePlural || sku);
        setWizardDescription(product?.description || "");
        setWizardQuantities(POD_DEFAULT_QUANTITIES.join(", "));
        setWizardDeliveryPromise("0");
        setWizardMarkupMode("percent");
        setWizardMarkupValue("20");
        setWizardSelections({});
        setWizardOptionLabels({});
        setWizardGroupLabels({});
        setWizardRegion("DK");
        setWizardCurrency("DKK");
        setWizardUseBatch(true);
        setWizardAutoPublish(false);
        setWizardMaxVariants(String(DEFAULT_MAX_VARIANTS));
        setWizardMaxRequests(String(DEFAULT_MAX_REQUESTS));
        setWizardPresetId("");
        setWizardPresetName("");

        try {
            const detailResponse = await execute({
                method: "GET",
                path: `/products/${sku}`,
                query: {},
            });
            const details = detailResponse?.data || null;
            setWizardDetails(details);

            const properties = Array.isArray(details?.properties) ? details.properties : [];
            const { quantities } = buildPriceTemplate(properties);
            setWizardQuantities(formatQuantities(quantities));
            setWizardPricingType(suggestPricingType(properties));

            const defaults: Record<string, string[]> = {};
            const defaultLabels: Record<string, Record<string, string>> = {};
            const defaultGroups: Record<string, string> = {};
            for (const property of properties) {
                if (!property?.slug || property?.locked) continue;
                if (!Array.isArray(property?.options) || property.options.length === 0) continue;
                if (property.slug === "copies" || property.slug === "bundle") continue;
                defaultGroups[property.slug] = property.title || property.slug;
                const optionSlug = pickOptionSlug(property);
                if (optionSlug !== undefined) {
                    const value = String(optionSlug);
                    defaults[property.slug] = [value];
                    defaultLabels[property.slug] = { [value]: String(property.options.find((option: any) => String(option?.slug) === value)?.name || value) };
                }
            }
            setWizardSelections(defaults);
            setWizardOptionLabels(defaultLabels);
            setWizardGroupLabels(defaultGroups);
            setWizardMatrixMapping(buildDefaultMatrixMapping(properties, defaults));
            setWizardMatrixMappingReady(true);

            const detailTitle = details?.titleSingle || details?.title || details?.name || details?.titlePlural;
            const detailDescription = details?.description || "";
            if (detailTitle) {
                setWizardTitle(detailTitle);
            }
            if (detailDescription) {
                setWizardDescription(detailDescription);
            }
        } catch (e) {
            toast.error("Kunne ikke hente produktdetaljer");
        } finally {
            setWizardLoading(false);
        }
    };

    const ensureOptionLabel = (propertySlug: string, value: string, fallbackLabel: string) => {
        setWizardOptionLabels((prev) => {
            const propertyLabels = prev[propertySlug] || {};
            if (propertyLabels[value]) return prev;
            return {
                ...prev,
                [propertySlug]: {
                    ...propertyLabels,
                    [value]: fallbackLabel,
                },
            };
        });
    };

    const handleToggleSelection = (property: any, option: any, checked: boolean) => {
        const propertySlug = String(property.slug);
        const value = String(option?.slug ?? option?.name ?? "");
        if (!value) return;

        const currentSelections = wizardSelections[propertySlug] || [];
        const nextValues = checked
            ? Array.from(new Set([...currentSelections, value]))
            : currentSelections.filter((item) => item !== value);
        let nextSelections = { ...wizardSelections, [propertySlug]: nextValues };
        let autoLabels: Array<{ value: string; label: string }> = [];
        let autoMessage: string | null = null;

        if (propertySlug === "size") {
            const auto = applyAutoSheetSize(nextSelections, nextValues);
            nextSelections = auto.selections;
            autoLabels = auto.labels;
            autoMessage = auto.toastMessage;
        }

        setWizardSelections(nextSelections);

        if (checked) {
            const fallbackLabel = String(option?.name || value);
            ensureOptionLabel(propertySlug, value, fallbackLabel);
        }

        for (const label of autoLabels) {
            ensureOptionLabel("sheet_size", label.value, label.label);
        }
        if (autoMessage) {
            toast.message(autoMessage);
        }

        if (propertySlug === "size") {
            scheduleSheetSizeProbe(nextSelections, nextValues);
        }
    };

    const handleOptionLabelChange = (propertySlug: string, value: string, label: string) => {
        setWizardOptionLabels((prev) => ({
            ...prev,
            [propertySlug]: {
                ...(prev[propertySlug] || {}),
                [value]: label,
            },
        }));
    };

    const addMatrixRow = () => {
        setWizardMatrixMapping((prev) => {
            const nextIndex = prev.rows.length + 1;
            const nextId = `row-${Date.now().toString(36)}`;
            return {
                ...prev,
                rows: [
                    ...prev.rows,
                    { id: nextId, title: `Række ${nextIndex}`, groupKeys: [] },
                ],
            };
        });
    };

    const updateMatrixRowTitle = (rowId: string, title: string) => {
        setWizardMatrixMapping((prev) => ({
            ...prev,
            rows: prev.rows.map((row) => (row.id === rowId ? { ...row, title } : row)),
        }));
    };

    const removeMatrixRow = (rowId: string) => {
        setWizardMatrixMapping((prev) => {
            const row = prev.rows.find((item) => item.id === rowId);
            if (!row) return prev;
            const remaining = prev.rows.filter((item) => item.id !== rowId);
            const fixed = [...prev.fixed, ...(row.groupKeys || [])];
            return {
                ...prev,
                rows: remaining.length > 0 ? remaining : createDefaultMatrixRows(),
                fixed,
            };
        });
    };

    const removeGroupFromMapping = (mapping: PodMatrixMapping, groupKey: string) => {
        const rows = mapping.rows.map((row) => ({
            ...row,
            groupKeys: row.groupKeys.filter((key) => key !== groupKey),
        }));
        const fixed = mapping.fixed.filter((key) => key !== groupKey);
        const verticalAxis = mapping.verticalAxis === groupKey ? null : mapping.verticalAxis;
        return { ...mapping, rows, fixed, verticalAxis };
    };

    const getMatrixContainerKeys = (mapping: PodMatrixMapping, containerId: string) => {
        if (containerId === MATRIX_CONTAINER_VERTICAL) {
            return mapping.verticalAxis ? [mapping.verticalAxis] : [];
        }
        if (containerId === MATRIX_CONTAINER_FIXED) {
            return mapping.fixed;
        }
        const rowId = containerId.replace("matrix:row:", "");
        const row = mapping.rows.find((item) => item.id === rowId);
        return row?.groupKeys || [];
    };

    const setMatrixContainerKeys = (mapping: PodMatrixMapping, containerId: string, keys: string[]) => {
        if (containerId === MATRIX_CONTAINER_VERTICAL) {
            return { ...mapping, verticalAxis: keys[0] || null };
        }
        if (containerId === MATRIX_CONTAINER_FIXED) {
            return { ...mapping, fixed: keys };
        }
        const rowId = containerId.replace("matrix:row:", "");
        return {
            ...mapping,
            rows: mapping.rows.map((row) => (row.id === rowId ? { ...row, groupKeys: keys } : row)),
        };
    };

    const addGroupToContainer = (
        mapping: PodMatrixMapping,
        containerId: string,
        groupKey: string,
        index?: number,
    ) => {
        if (containerId === MATRIX_CONTAINER_VERTICAL) {
            return { ...mapping, verticalAxis: groupKey };
        }
        const list = getMatrixContainerKeys(mapping, containerId);
        const next = list.filter((key) => key !== groupKey);
        const insertAt = index === undefined ? next.length : Math.max(0, Math.min(index, next.length));
        next.splice(insertAt, 0, groupKey);
        return setMatrixContainerKeys(mapping, containerId, next);
    };

    const findMatrixContainer = (mapping: PodMatrixMapping, id: string, containerIds: string[]) => {
        if (containerIds.includes(id)) return id;
        const key = fromMatrixItemId(id);
        if (mapping.verticalAxis === key) return MATRIX_CONTAINER_VERTICAL;
        const row = mapping.rows.find((item) => item.groupKeys.includes(key));
        if (row) return matrixRowContainerId(row.id);
        if (mapping.fixed.includes(key)) return MATRIX_CONTAINER_FIXED;
        return null;
    };

    const handleMatrixDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        setWizardMatrixMapping((prev) => {
            const containerIds = [
                MATRIX_CONTAINER_VERTICAL,
                ...prev.rows.map((row) => matrixRowContainerId(row.id)),
                MATRIX_CONTAINER_FIXED,
            ];
            const activeContainer = findMatrixContainer(prev, activeId, containerIds);
            const overContainer = findMatrixContainer(prev, overId, containerIds);
            if (!activeContainer || !overContainer) return prev;

            const activeKey = fromMatrixItemId(activeId);
            const overKey = overId.startsWith(MATRIX_GROUP_PREFIX) ? fromMatrixItemId(overId) : null;

            if (activeContainer === overContainer) {
                const current = getMatrixContainerKeys(prev, activeContainer);
                const activeIndex = current.indexOf(activeKey);
                const overIndex = overKey ? current.indexOf(overKey) : -1;
                if (activeIndex === -1 || overIndex === -1) return prev;
                const nextOrder = arrayMove(current, activeIndex, overIndex);
                return setMatrixContainerKeys(prev, activeContainer, nextOrder);
            }

            let next = removeGroupFromMapping(prev, activeKey);

            if (overContainer === MATRIX_CONTAINER_VERTICAL) {
                if (!isAllowedVerticalKey(activeKey)) {
                    toast.error("Lodret akse kan kun være format eller materiale.");
                    return prev;
                }
                const previousVertical = prev.verticalAxis;
                next = addGroupToContainer(next, MATRIX_CONTAINER_VERTICAL, activeKey);
                if (previousVertical && previousVertical !== activeKey) {
                    next = addGroupToContainer(next, activeContainer, previousVertical);
                }
                return next;
            }

            const insertIndex = overKey ? getMatrixContainerKeys(next, overContainer).indexOf(overKey) : undefined;
            next = addGroupToContainer(next, overContainer, activeKey, insertIndex);
            return next;
        });
    };

    const MatrixDropZone = ({
        id,
        children,
        isEmpty,
    }: {
        id: string;
        children: ReactNode;
        isEmpty: boolean;
    }) => {
        const { setNodeRef, isOver } = useDroppable({ id });
        return (
            <div
                ref={setNodeRef}
                className={`rounded-lg border border-dashed p-2 min-h-[56px] ${isOver ? "border-primary bg-primary/5" : "border-muted"}`}
            >
                {children}
                {isEmpty && (
                    <div className="text-xs text-muted-foreground">Træk grupper hertil</div>
                )}
            </div>
        );
    };

    const SortableMatrixItem = ({
        groupKey,
        label,
        count,
    }: {
        groupKey: string;
        label: string;
        count: number;
    }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({ id: toMatrixItemId(groupKey) });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm"
            >
                <span
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground"
                >
                    <GripVertical className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate">{label}</span>
                <Badge variant="secondary" className="text-[10px]">
                    {count}
                </Badge>
            </div>
        );
    };

    const sanitizeSelectionsForDetails = (selections: Record<string, string[]>) => {
        if (!wizardDetails) return selections;
        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const allowed = new Map<string, Set<string>>();
        for (const property of properties) {
            if (!property?.slug || property?.locked) continue;
            if (!Array.isArray(property?.options) || property.options.length === 0) continue;
            const values = new Set(property.options.map((option: any, index: number) => String(option?.slug ?? option?.name ?? index)));
            allowed.set(property.slug, values);
        }

        const sanitized: Record<string, string[]> = {};
        for (const [slug, values] of Object.entries(selections)) {
            const allowedValues = allowed.get(slug);
            if (!allowedValues) continue;
            const filtered = values.filter((value) => allowedValues.has(String(value)));
            if (filtered.length > 0) {
                sanitized[slug] = filtered;
            }
        }
        return sanitized;
    };

    const buildCurrentPreset = (): PodImportPreset | null => {
        const quantities = parseQuantities(wizardQuantities);
        if (quantities.length === 0) return null;
        return {
            id: crypto.randomUUID(),
            name: wizardPresetName.trim() || "Preset",
            sku: String(wizardProduct?.sku || wizardProduct?.id || wizardProduct?.productId || wizardProduct?.product_id || ""),
            selections: wizardSelections,
            optionLabels: wizardOptionLabels,
            groupLabels: wizardGroupLabels,
            quantities,
            deliveryPromise: Number(wizardDeliveryPromise) || 0,
            markupMode: wizardMarkupMode,
            markupValue: Number(wizardMarkupValue) || 0,
            region: wizardRegion.trim().toUpperCase(),
            currency: wizardCurrency.trim().toUpperCase(),
            useBatch: wizardUseBatch,
            autoPublish: wizardAutoPublish,
            maxVariants: Number(wizardMaxVariants) || DEFAULT_MAX_VARIANTS,
            maxRequests: Number(wizardMaxRequests) || DEFAULT_MAX_REQUESTS,
        };
    };

    const handleSavePreset = () => {
        const preset = buildCurrentPreset();
        if (!preset) {
            setWizardError("Udfyld mængder før du gemmer preset.");
            return;
        }

        if (!preset.name.trim()) {
            setWizardError("Angiv et preset-navn.");
            return;
        }

        setWizardPresets((prev) => [...prev.filter((item) => item.id !== preset.id), preset]);
        setWizardPresetId(preset.id);
        setWizardPresetName("");
        setWizardError(null);
        toast.success("Preset gemt");
    };

    const handleApplyPreset = () => {
        const preset = wizardPresets.find((item) => item.id === wizardPresetId);
        if (!preset) {
            setWizardError("Vælg et preset");
            return;
        }

        const sanitizedSelections = sanitizeSelectionsForDetails(preset.selections);
        setWizardSelections(sanitizedSelections);
        setWizardOptionLabels(preset.optionLabels || {});
        setWizardGroupLabels(preset.groupLabels || {});
        setWizardQuantities((preset.quantities || []).join(", "));
        setWizardDeliveryPromise(String(preset.deliveryPromise ?? 0));
        setWizardMarkupMode(preset.markupMode || "percent");
        setWizardMarkupValue(String(preset.markupValue ?? 0));
        setWizardRegion(preset.region || "DK");
        setWizardCurrency(preset.currency || "DKK");
        setWizardUseBatch(Boolean(preset.useBatch));
        setWizardAutoPublish(Boolean(preset.autoPublish));
        setWizardMaxVariants(String(preset.maxVariants || DEFAULT_MAX_VARIANTS));
        setWizardMaxRequests(String(preset.maxRequests || DEFAULT_MAX_REQUESTS));
        setWizardError(null);
    };

    const handleDeletePreset = () => {
        if (!wizardPresetId) {
            setWizardError("Vælg et preset");
            return;
        }
        setWizardPresets((prev) => prev.filter((item) => item.id !== wizardPresetId));
        setWizardPresetId("");
        setWizardError(null);
        toast.success("Preset slettet");
    };

    const handleWizardImport = async () => {
        const sku = String(wizardProduct?.sku || wizardProduct?.id || wizardProduct?.productId || wizardProduct?.product_id || "");
        if (!sku || !wizardDetails) {
            toast.error("Produktdetaljer mangler");
            return;
        }

        const quantities = parseQuantities(wizardQuantities);
        if (quantities.length === 0) {
            setWizardError("Angiv mindst én mængde (f.eks. 10, 25, 50)");
            return;
        }

        const properties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
        const selectable = properties.filter((property) => {
            if (!property?.slug || property?.locked) return false;
            if (!Array.isArray(property?.options) || property.options.length === 0) return false;
            return property.slug !== "copies" && property.slug !== "bundle";
        });

        const selectionMap: Record<string, string[]> = {};
        for (const property of selectable) {
            const selectedValues = (wizardSelections[property.slug] || []).filter(Boolean);
            if (selectedValues.length === 0) {
                const noneOption = (property.options || []).find((option: any) => {
                    const slug = String(option?.slug || "").toLowerCase();
                    return ["none", "geen", "no", "false"].includes(slug);
                });
                const fallback = noneOption?.slug ?? pickOptionSlug(property);

                if (fallback === undefined) {
                    setWizardError(`Mangler et standardvalg for ${property.title || property.slug}`);
                    return;
                }

                const fallbackValue = String(fallback);
                selectionMap[property.slug] = [fallbackValue];
            } else {
                selectionMap[property.slug] = selectedValues;
            }
        }

        const matrixGroupKeys = selectable.map((property) => String(property.slug));
        const matrixMapping = syncMatrixMapping(wizardMatrixMapping, matrixGroupKeys);
        const fixedConflicts = matrixMapping.fixed.filter((key) => (selectionMap[key] || []).length > 1);
        if (fixedConflicts.length > 0) {
            setWizardError(`Faste valg har flere værdier: ${fixedConflicts.join(", ")}. Flyt dem til en række.`);
            return;
        }
        if (!matrixMapping.verticalAxis) {
            setWizardError("Vælg en lodret akse for prismatrixen.");
            return;
        }

        const maxVariants = Math.max(1, Number(wizardMaxVariants) || DEFAULT_MAX_VARIANTS);
        const maxRequests = Math.max(1, Number(wizardMaxRequests) || DEFAULT_MAX_REQUESTS);

        const variantCombos = buildVariantCombos(selectable, selectionMap);
        if (variantCombos.length === 0) {
            setWizardError("Ingen varianter valgt.");
            return;
        }
        if (variantCombos.length > maxVariants) {
            setWizardError(`For mange varianter (${variantCombos.length}). Maks er ${maxVariants}.`);
            return;
        }

        const totalRequests = variantCombos.length * quantities.length;
        if (totalRequests > maxRequests) {
            setWizardError(`For mange prisopslag (${totalRequests}). Maks er ${maxRequests}.`);
            return;
        }

        const selectionSignature = normalizeSelectionMap(selectionMap);
        const quantitiesSignature = normalizeQuantities(quantities);
        const existingWithSameSku = (catalogProducts || []).filter(
            (product) => product?.supplier_product_ref === sku,
        );
        if (existingWithSameSku.length > 0) {
            const matches = existingWithSameSku.filter((product) => {
                const supplierData = (product as any)?.supplier_product_data || {};
                const existingSelection = normalizeSelectionMap(supplierData.selection_map);
                return existingSelection === selectionSignature;
            });
            if (matches.length > 0) {
                const hasSameQuantities = matches.some((product) => {
                    const supplierData = (product as any)?.supplier_product_data || {};
                    const existingQuantities = normalizeQuantities(
                        supplierData.quantities
                            ?? product?.pod2_catalog_price_matrix?.[0]?.quantities
                            ?? [],
                    );
                    return existingQuantities === quantitiesSignature;
                });
                const message = hasSameQuantities
                    ? "Der findes allerede et POD v2 produkt med samme attributter og mængder. Vil du importere det igen?"
                    : "Der findes allerede et POD v2 produkt med samme attributter. Vil du importere med disse mængder?";
                if (!confirm(message)) {
                    return;
                }
            }
        }

        const bundleProperty = properties.find((property) => property?.slug === "bundle");
        const bundleOptions = Array.isArray(bundleProperty?.options) ? bundleProperty.options : [];
        const bundleByQuantity = new Map<number, any>();
        for (const option of bundleOptions) {
            const match = String(option?.slug || "").match(/(\\d+)/);
            if (match) {
                bundleByQuantity.set(Number(match[1]), option);
            }
        }

        const title = wizardTitle || sku;
        const description = wizardDescription || "";
        const images = Array.isArray(wizardDetails?.images)
            ? wizardDetails.images
            : Array.isArray(wizardProduct?.images)
                ? wizardProduct.images
                : wizardProduct?.image
                    ? [wizardProduct.image]
                    : [];

        setImportingSku(sku);
        setWizardError(null);

        const deliveryPromise = Number(wizardDeliveryPromise) || 0;
        const markupValue = Number(wizardMarkupValue);
        const safeMarkupValue = Number.isFinite(markupValue) ? markupValue : 0;
        const region = wizardRegion.trim().toUpperCase();
        const currency = wizardCurrency.trim().toUpperCase();

        if (wizardUseBatch && (!region || !currency)) {
            setWizardError("Region og valuta er påkrævet for batch-priser.");
            setImportingSku(null);
            return;
        }

        const variantEntries = variantCombos.map((combo) => {
            const normalized: Record<string, any> = {};
            for (const [key, value] of Object.entries(combo)) {
                normalized[key] = normalizeOptionValue(value);
            }
            return {
                options: normalized,
                signature: buildVariantSignature(normalized),
            };
        });

        try {
            const { data: catalogInsert, error: catalogError } = await supabase
                .from("pod2_catalog_products" as any)
                .insert({
                    public_title: { da: title, en: title },
                    public_description: { da: description, en: description },
                    public_images: images,
                    supplier_product_ref: sku,
                    status: wizardAutoPublish ? "published" : "draft",
                    supplier_product_data: {
                        list: wizardProduct,
                        details: wizardDetails,
                        price_template: variantEntries[0]?.options || {},
                        selection_map: selectionMap,
                        matrix_mapping: matrixMapping,
                        pricing_type: wizardPricingType,
                        delivery_promise: deliveryPromise,
                        quantities,
                        markup: { mode: wizardMarkupMode, value: safeMarkupValue },
                        region,
                        currency,
                        batch_pricing: wizardUseBatch,
                    },
                })
                .select("id")
                .single();

            if (catalogError || !catalogInsert?.id) {
                toast.error("Kunne ikke importere produkt: " + (catalogError?.message || "ukendt fejl"));
                return;
            }

            const catalogProductId = catalogInsert.id;

            for (let index = 0; index < selectable.length; index += 1) {
                const property = selectable[index];
                const selectedValues = selectionMap[property.slug] || [];
                const groupLabel = wizardGroupLabels[property.slug] || property.title || property.slug;

                const { data: attributeRow } = await supabase
                    .from("pod2_catalog_attributes" as any)
                    .insert({
                        catalog_product_id: catalogProductId,
                        group_key: String(property.slug),
                        group_label: { da: groupLabel, en: groupLabel },
                        sort_order: index,
                    })
                    .select("id")
                    .single();

                if (!attributeRow?.id) {
                    continue;
                }

                const valuesPayload = selectedValues.map((value, valueIndex) => {
                    const option = property.options.find((opt: any) => String(opt?.slug) === value);
                    const fallbackLabel = option?.name || value;
                    const labelOverride = wizardOptionLabels[property.slug]?.[value];
                    return {
                        attribute_id: attributeRow.id,
                        value_key: String(value),
                        value_label: { da: labelOverride || fallbackLabel, en: labelOverride || fallbackLabel },
                        supplier_value_ref: option || null,
                        is_default: valueIndex === 0,
                        sort_order: valueIndex,
                    };
                });

                if (valuesPayload.length > 0) {
                    await supabase
                        .from("pod2_catalog_attribute_values" as any)
                        .insert(valuesPayload);
                }
            }

            const matrices = new Map<string, { baseCosts: (number | null)[]; recommended: (number | null)[] }>();
            for (const variant of variantEntries) {
                matrices.set(variant.signature, {
                    baseCosts: Array(quantities.length).fill(null),
                    recommended: Array(quantities.length).fill(null),
                });
            }

            const priceRequests = variantEntries.flatMap((variant, variantIndex) =>
                quantities.map((quantity, quantityIndex) => {
                    const optionsForQuantity: Record<string, any> = {
                        ...variant.options,
                        copies: quantity,
                    };

                    if (bundleByQuantity.size > 0) {
                        const bundleOption = bundleByQuantity.get(quantity) || bundleByQuantity.get(quantities[0]);
                        if (bundleOption?.slug) {
                            optionsForQuantity.bundle = normalizeOptionValue(bundleOption.slug);
                        }
                    }

                    return {
                        variantIndex,
                        quantityIndex,
                        options: optionsForQuantity,
                    };
                }),
            );

            let usedBatch = false;
            if (wizardUseBatch && priceRequests.length > 0) {
                try {
                    const batchResponse = await execute({
                        method: "POST",
                        path: "/products/batch/prices",
                        query: {},
                        requestBody: {
                            requests: priceRequests.map((request) => ({
                                sku,
                                options: request.options,
                                region,
                                currency,
                                delivery_promise: deliveryPromise,
                            })),
                        },
                        baseUrlOverride: "https://platform.print.com",
                    });

                    const responses = batchResponse?.data?.responses;
                    if (Array.isArray(responses) && responses.length === priceRequests.length) {
                        usedBatch = true;
                        responses.forEach((item: any, index: number) => {
                            const request = priceRequests[index];
                            const variant = variantEntries[request.variantIndex];
                            const matrix = matrices.get(variant.signature);
                            if (!matrix) return;
                            const cost = extractBatchCost(item, deliveryPromise);
                            matrix.baseCosts[request.quantityIndex] = typeof cost === "number" ? cost : null;
                        });
                    }
                } catch (e) {
                    usedBatch = false;
                }
            }

            if (!usedBatch) {
                for (const request of priceRequests) {
                    try {
                        const priceResponse = await execute({
                            method: "POST",
                            path: `/products/${sku}/price`,
                            query: {},
                            requestBody: {
                                sku,
                                deliveryPromise,
                                options: request.options,
                            },
                        });

                        const prices = priceResponse?.data?.prices;
                        const cost = typeof prices?.productPrice === "number" ? prices.productPrice : null;
                        const variant = variantEntries[request.variantIndex];
                        const matrix = matrices.get(variant.signature);
                        if (matrix) {
                            matrix.baseCosts[request.quantityIndex] = cost;
                        }
                    } catch (e) {
                        // Leave as null
                    }
                }
            }

            for (const matrix of matrices.values()) {
                matrix.recommended = matrix.baseCosts.map((cost) => {
                    if (typeof cost !== "number") return null;
                    if (wizardMarkupMode === "fixed") {
                        return roundCurrency(cost + safeMarkupValue);
                    }
                    return roundCurrency(cost * (1 + safeMarkupValue / 100));
                });
            }

            const matrixPayload = variantEntries.map((variant) => {
                const matrix = matrices.get(variant.signature);
                const baseCosts = matrix?.baseCosts || Array(quantities.length).fill(null);
                const recommended = matrix?.recommended || Array(quantities.length).fill(null);
                const needsQuote = baseCosts.some((cost) => cost === null);
                return {
                    catalog_product_id: catalogProductId,
                    variant_signature: variant.signature,
                    quantities,
                    base_costs: baseCosts,
                    recommended_retail: recommended,
                    currency: usedBatch ? currency : (wizardCurrency.trim().toUpperCase() || "DKK"),
                    needs_quote: needsQuote,
                };
            });

            if (matrixPayload.length > 0) {
                await supabase
                    .from("pod2_catalog_price_matrix" as any)
                    .insert(matrixPayload);
            }

            toast.success("Produkt importeret med priser");
            refetchCatalog();
            handleWizardOpenChange(false);
        } catch (e: any) {
            toast.error("Import fejlede: " + (e?.message || "ukendt fejl"));
        } finally {
            setImportingSku(null);
        }
    };

    const wizardProperties = Array.isArray(wizardDetails?.properties) ? wizardDetails.properties : [];
    const selectableProperties = wizardProperties.filter((property) => {
        if (!property?.slug || property?.locked) return false;
        if (!Array.isArray(property?.options) || property.options.length === 0) return false;
        return property.slug !== "copies" && property.slug !== "bundle";
    });
    const selectedPreset = wizardPresets.find((preset) => preset.id === wizardPresetId);
    const previewQuantities = parseQuantities(wizardQuantities);
    const previewVariantCount = selectableProperties.reduce((count, property) => {
        const selectedCount = (wizardSelections[property.slug] || []).length;
        return count * Math.max(1, selectedCount);
    }, 1);
    const previewPriceRequests = previewVariantCount * (previewQuantities.length || 1);
    const selectableGroupKeys = selectableProperties.map((property) => String(property.slug));
    const matrixMappingForUi = wizardMatrixMappingReady
        ? syncMatrixMapping(wizardMatrixMapping, selectableGroupKeys)
        : wizardMatrixMapping;
    const fixedMappingConflicts = matrixMappingForUi.fixed.filter(
        (key) => (wizardSelections[key] || []).length > 1,
    );
    const groupLabelByKey = selectableProperties.reduce<Record<string, string>>((acc, property: any) => {
        const key = String(property.slug);
        acc[key] = wizardGroupLabels[key] || property.title || key;
        return acc;
    }, {});

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Vælg produkt</CardTitle>
                        <CardDescription>Find og vælg produkter fra den tilsluttede leverandør</CardDescription>
                    </div>
                    <Button onClick={handleFetchProducts} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Hent produkter
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {products.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Ingen produkter hentet endnu.</p>
                        <p className="text-sm mt-2">Klik "Hent produkter" for at indlæse fra leverandør API.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Input
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Søg efter SKU eller navn (fx flyer)"
                        />

                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>Ingen produkter matcher din søgning.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredProducts.map((product: any, idx: number) => {
                                    const sku = String(product?.sku || product?.id || product?.productId || product?.product_id || "");
                                    const isImported = sku ? importedSkus.has(sku) : false;
                                    const displayTitle = product?.titleSingle || product?.title || product?.name || product?.titlePlural || `Product ${idx + 1}`;

                                    return (
                                        <Card key={sku || product.id || idx} className="overflow-hidden">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h3 className="font-medium truncate">{displayTitle}</h3>
                                                        <p className="text-sm text-muted-foreground truncate">{sku || product.id || "-"}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isImported ? "secondary" : "default"}
                                                        disabled={importingSku === sku}
                                                        onClick={() => openImportWizard(product)}
                                                    >
                                                        {importingSku === sku ? <Loader2 className="h-3 w-3 animate-spin" /> : isImported ? "Importer igen" : "Konfigurer"}
                                                    </Button>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {product.category && (
                                                        <Badge variant="secondary">{product.category}</Badge>
                                                    )}
                                                    {product.active !== undefined && (
                                                        <Badge variant={product.active ? "default" : "secondary"}>
                                                            {product.active ? "Aktiv" : "Inaktiv"}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {response?.data && (
                    <details className="mt-6">
                        <summary className="cursor-pointer text-sm text-muted-foreground">Vis rå API respons</summary>
                        <pre className="mt-2 text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                            {JSON.stringify(response.data, null, 2)}
                        </pre>
                    </details>
                )}

                {wizardOpen && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Konfigurer POD v2 produkt</CardTitle>
                            <CardDescription>
                                Vælg variant, mængder og markup. Vi importerer kun de valgte værdier.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={wizardStep === 1 ? "text-foreground font-semibold" : ""}>Trin 1: Vælg</span>
                                <span>→</span>
                                <span className={wizardStep === 2 ? "text-foreground font-semibold" : ""}>Trin 2: Layout</span>
                            </div>
                            {wizardLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                {wizardStep === 1 && (
                                    <>
                                <div className="space-y-3 border rounded-lg p-3">
                                    <Label>Presets</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <Select value={wizardPresetId} onValueChange={setWizardPresetId}>
                                            <SelectTrigger className="md:col-span-2">
                                                <SelectValue placeholder="Vælg preset" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {wizardPresets.length === 0 ? (
                                                    <SelectItem value="__none" disabled>
                                                        Ingen presets endnu
                                                    </SelectItem>
                                                ) : (
                                                    wizardPresets.map((preset) => (
                                                        <SelectItem key={preset.id} value={preset.id}>
                                                            {preset.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={handleApplyPreset}>
                                                Anvend
                                            </Button>
                                            <Button type="button" variant="outline" onClick={handleDeletePreset}>
                                                Slet
                                            </Button>
                                        </div>
                                    </div>
                                    {selectedPreset?.sku && wizardProduct && selectedPreset.sku !== String(wizardProduct?.sku || wizardProduct?.id || "") && (
                                        <p className="text-xs text-muted-foreground">
                                            Preset er gemt til et andet SKU ({selectedPreset.sku}). Tjek valgene.
                                        </p>
                                    )}
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <Input
                                            value={wizardPresetName}
                                            onChange={(e) => setWizardPresetName(e.target.value)}
                                            placeholder="Preset navn"
                                        />
                                        <Button type="button" variant="outline" onClick={handleSavePreset}>
                                            Gem preset
                                        </Button>
                                    </div>
                                </div>

                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Grunddata
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Produktnavn</Label>
                                        <Input
                                            value={wizardTitle}
                                            onChange={(e) => setWizardTitle(e.target.value)}
                                            placeholder="Indtast navn"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Levering (deliveryPromise)</Label>
                                        <Select value={wizardDeliveryPromise} onValueChange={setWizardDeliveryPromise}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Vælg levering" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">Standard (0)</SelectItem>
                                                <SelectItem value="1">Insured (1)</SelectItem>
                                                <SelectItem value="2">Premium (2)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Beskrivelse</Label>
                                    <Textarea
                                        value={wizardDescription}
                                        onChange={(e) => setWizardDescription(e.target.value)}
                                        placeholder="Kort beskrivelse"
                                        rows={3}
                                    />
                                </div>

                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Prisparametre
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mængder (copies)</Label>
                                        <Input
                                            value={wizardQuantities}
                                            onChange={(e) => setWizardQuantities(e.target.value)}
                                            placeholder="10, 25, 50, 100"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Kommasepareret liste. Disse bruges til prisberegning.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Markup</Label>
                                        <div className="flex gap-2">
                                            <Select value={wizardMarkupMode} onValueChange={(value) => setWizardMarkupMode(value as "percent" | "fixed")}>
                                                <SelectTrigger className="w-[140px]">
                                                    <SelectValue placeholder="Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percent">Procent</SelectItem>
                                                    <SelectItem value="fixed">Fast beløb</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                value={wizardMarkupValue}
                                                onChange={(e) => setWizardMarkupValue(e.target.value)}
                                                placeholder={wizardMarkupMode === "fixed" ? "DKK" : "%"}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Brug markup til at beregne din udsalgspris ud fra Print.com's pris.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Produkttype</Label>
                                        <Select value={wizardPricingType} onValueChange={(value) => setWizardPricingType(value as "matrix" | "storformat")}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Vælg type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="matrix">Standard (matrix)</SelectItem>
                                                <SelectItem value="storformat">Storformat (custom størrelser)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Storformat bruger eget prisflow og viser ikke matrix-priser.
                                        </p>
                                    </div>
                                </div>

                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Batch & publicering
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Region (batch)</Label>
                                        <Input
                                            value={wizardRegion}
                                            onChange={(e) => setWizardRegion(e.target.value)}
                                            placeholder="DK"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Bruges til batch-priser fra Print.com.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Valuta (batch)</Label>
                                        <Input
                                            value={wizardCurrency}
                                            onChange={(e) => setWizardCurrency(e.target.value)}
                                            placeholder="DKK"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Bruges til batch-priser fra Print.com.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <div>
                                        <p className="text-sm font-medium">Batch prisberegning</p>
                                        <p className="text-xs text-muted-foreground">
                                            Hurtigere ved mange varianter og mængder.
                                        </p>
                                    </div>
                                    <Switch checked={wizardUseBatch} onCheckedChange={setWizardUseBatch} />
                                </div>

                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <div>
                                        <p className="text-sm font-medium">Auto-publicer til POD v2 katalog</p>
                                        <p className="text-xs text-muted-foreground">
                                            Produktet bliver publiceret automatisk efter import.
                                        </p>
                                    </div>
                                    <Switch checked={wizardAutoPublish} onCheckedChange={setWizardAutoPublish} />
                                </div>

                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Teknisk styring
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Maks varianter</Label>
                                        <Input
                                            type="number"
                                            value={wizardMaxVariants}
                                            onChange={(e) => setWizardMaxVariants(e.target.value)}
                                            min="1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Maks prisopslag</Label>
                                        <Input
                                            type="number"
                                            value={wizardMaxRequests}
                                            onChange={(e) => setWizardMaxRequests(e.target.value)}
                                            min="1"
                                        />
                                    </div>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Variantvalg</CardTitle>
                                        <CardDescription>
                                            Varianter: {previewVariantCount} · Mængder: {previewQuantities.length || 0} · Prisopslag: {previewPriceRequests}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={handleProbeSelection}
                                                disabled={wizardProbeLoading || !wizardDetails}
                                            >
                                                {wizardProbeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                                                Test valg
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                Tester kombinationen mod Print.com
                                            </span>
                                        </div>
                                        {(Number(wizardMaxVariants) || DEFAULT_MAX_VARIANTS) < previewVariantCount && (
                                            <div className="text-xs text-destructive">
                                                Varianter overstiger max ({wizardMaxVariants}).
                                            </div>
                                        )}
                                        {(Number(wizardMaxRequests) || DEFAULT_MAX_REQUESTS) < previewPriceRequests && (
                                            <div className="text-xs text-destructive">
                                                Prisopslag overstiger max ({wizardMaxRequests}).
                                            </div>
                                        )}
                                        {selectableProperties.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Ingen valgmuligheder fundet for dette produkt.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Tomme felter bliver automatisk sat til \"none\" eller standardvalg ved import.
                                                </p>
                                                {selectableProperties.map((property: any) => {
                                                    const options = Array.isArray(property.options) ? property.options : [];

                                                    return (
                                                        <div key={property.slug} className="space-y-2 border rounded-lg p-3">
                                                            <div className="flex flex-col gap-1">
                                                                <Label className="text-sm">{property.title || property.slug}</Label>
                                                                <Input
                                                                    value={wizardGroupLabels[property.slug] ?? property.title ?? property.slug}
                                                                    onChange={(e) => setWizardGroupLabels((prev) => ({ ...prev, [property.slug]: e.target.value }))}
                                                                    placeholder={property.title || property.slug}
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    Navnet kunderne ser for denne option-gruppe.
                                                                </p>
                                                            </div>
                                                            {property.slug === "size" && (
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => applySizePreset(property, false)}
                                                                    >
                                                                        A4/A5/A7/A8
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => applySizePreset(property, true)}
                                                                    >
                                                                        A4/A5/A7/A8 + liggende
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => clearPropertySelection(property.slug)}
                                                                    >
                                                                        Ryd
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                {options.map((option: any, index: number) => {
                                                                    const value = String(option?.slug ?? option?.name ?? index);
                                                                    const label = option?.name || value;
                                                                    const selected = (wizardSelections[property.slug] || []).includes(value);
                                                                    const displayLabel = wizardOptionLabels[property.slug]?.[value] || label;

                                                                    return (
                                                                        <div key={`${property.slug}-${value}`} className="flex items-start gap-2 border rounded-md p-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="mt-1 h-4 w-4"
                                                                                checked={selected}
                                                                                onChange={(e) => handleToggleSelection(property, option, e.target.checked)}
                                                                            />
                                                                            <div className="flex-1 space-y-1">
                                                                                <p className="text-sm font-medium">{label}</p>
                                                                                {selected && (
                                                                                    <Input
                                                                                        value={displayLabel}
                                                                                        onChange={(e) => handleOptionLabelChange(property.slug, value, e.target.value)}
                                                                                        placeholder="Visningsnavn"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {options.length === 0 && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Ingen muligheder tilgængelige.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                    <div className="flex items-center justify-end">
                                        <Button onClick={() => setWizardStep(2)} disabled={!wizardDetails}>
                                            Næste
                                        </Button>
                                    </div>
                                    </>
                                )}

                                {wizardStep === 2 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <Button variant="outline" onClick={() => setWizardStep(1)}>
                                                Tilbage
                                            </Button>
                                            <span className="text-xs text-muted-foreground">Matrix layout</span>
                                        </div>
                                        {selectableProperties.length > 0 ? (
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <div>
                                                        <CardTitle>Matrix layout</CardTitle>
                                                        <CardDescription>
                                                            Træk grupper ind i lodret akse og rækker. Faste valg skjules.
                                                        </CardDescription>
                                                    </div>
                                                    <Button type="button" size="sm" variant="outline" onClick={addMatrixRow}>
                                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                                        Ny række
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleMatrixDragEnd}
                                                    >
                                                        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Lodret akse</Label>
                                                                <div className="rounded-lg border bg-muted/20 p-2">
                                                                    <SortableContext
                                                                        items={matrixMappingForUi.verticalAxis ? [toMatrixItemId(matrixMappingForUi.verticalAxis)] : []}
                                                                        strategy={verticalListSortingStrategy}
                                                                    >
                                                                        <MatrixDropZone
                                                                            id={MATRIX_CONTAINER_VERTICAL}
                                                                            isEmpty={!matrixMappingForUi.verticalAxis}
                                                                        >
                                                                            {matrixMappingForUi.verticalAxis && (
                                                                                <SortableMatrixItem
                                                                                    groupKey={matrixMappingForUi.verticalAxis}
                                                                                    label={groupLabelByKey[matrixMappingForUi.verticalAxis] || matrixMappingForUi.verticalAxis}
                                                                                    count={(wizardSelections[matrixMappingForUi.verticalAxis] || []).length}
                                                                                />
                                                                            )}
                                                                        </MatrixDropZone>
                                                                    </SortableContext>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Lodret akse accepterer format eller materiale.
                                                                </p>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {matrixMappingForUi.rows.map((row) => (
                                                                    <div key={row.id} className="rounded-lg border bg-muted/10 p-3 space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Input
                                                                                value={row.title}
                                                                                onChange={(e) => updateMatrixRowTitle(row.id, e.target.value)}
                                                                                placeholder="Række titel"
                                                                            />
                                                                            {matrixMappingForUi.rows.length > 1 && (
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => removeMatrixRow(row.id)}
                                                                                >
                                                                                    Slet
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <SortableContext
                                                                            items={row.groupKeys.map(toMatrixItemId)}
                                                                            strategy={verticalListSortingStrategy}
                                                                        >
                                                                            <MatrixDropZone
                                                                                id={matrixRowContainerId(row.id)}
                                                                                isEmpty={row.groupKeys.length === 0}
                                                                            >
                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                                                    {row.groupKeys.map((groupKey) => (
                                                                                        <SortableMatrixItem
                                                                                            key={groupKey}
                                                                                            groupKey={groupKey}
                                                                                            label={groupLabelByKey[groupKey] || groupKey}
                                                                                            count={(wizardSelections[groupKey] || []).length}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            </MatrixDropZone>
                                                                        </SortableContext>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Faste valg (skjules)</Label>
                                                            <div className="rounded-lg border bg-muted/20 p-2">
                                                                <SortableContext
                                                                    items={matrixMappingForUi.fixed.map(toMatrixItemId)}
                                                                    strategy={verticalListSortingStrategy}
                                                                >
                                                                    <MatrixDropZone
                                                                        id={MATRIX_CONTAINER_FIXED}
                                                                        isEmpty={matrixMappingForUi.fixed.length === 0}
                                                                    >
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                                            {matrixMappingForUi.fixed.map((groupKey) => (
                                                                                <SortableMatrixItem
                                                                                    key={groupKey}
                                                                                    groupKey={groupKey}
                                                                                    label={groupLabelByKey[groupKey] || groupKey}
                                                                                    count={(wizardSelections[groupKey] || []).length}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </MatrixDropZone>
                                                                </SortableContext>
                                                            </div>
                                                        </div>
                                                    </DndContext>
                                                    {fixedMappingConflicts.length > 0 && (
                                                        <div className="text-xs text-destructive">
                                                            Faste valg har flere værdier: {fixedMappingConflicts.join(", ")}.
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Ingen valgmuligheder fundet for dette produkt.
                                            </p>
                                        )}
                                    </>
                                )}

                                {wizardError && (
                                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                                        {wizardError}
                                    </div>
                                )}
                            </div>
                        )}

                            <div className="flex items-center justify-between gap-3 pt-4 border-t">
                                <Button variant="outline" onClick={() => handleWizardOpenChange(false)} disabled={importingSku !== null}>
                                    Luk konfiguration
                                </Button>
                                <Button onClick={handleWizardImport} disabled={wizardLoading || importingSku !== null || !wizardDetails}>
                                    {importingSku ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                                    Importér med priser
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Curate Tab - Select and rename products
// ============================================================

function CurateTab() {
    const { data: catalogProducts, isLoading, refetch } = usePodCatalogProducts();

    const handleTogglePublish = async (productId: string, currentStatus: string) => {
        const newStatus = currentStatus === "published" ? "draft" : "published";

        const { error } = await supabase
            .from("pod2_catalog_products" as any)
            .update({ status: newStatus })
            .eq("id", productId);

        if (error) {
            toast.error("Kunne ikke opdatere status: " + error.message);
            return;
        }

        toast.success(newStatus === "published" ? "Produkt publiceret" : "Produkt sat til kladde");
        refetch();
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm("Slet katalogproduktet og alle tilknyttede imports/ordrer? Dette kan ikke fortrydes.")) {
            return;
        }

        const { error: jobsError } = await supabase
            .from("pod2_fulfillment_jobs" as any)
            .delete()
            .eq("catalog_product_id", productId);

        if (jobsError) {
            toast.error("Kunne ikke slette tilknyttede jobs: " + jobsError.message);
            return;
        }

        const { error: importsError } = await supabase
            .from("pod2_tenant_imports" as any)
            .delete()
            .eq("catalog_product_id", productId);

        if (importsError) {
            toast.error("Kunne ikke slette imports: " + importsError.message);
            return;
        }

        const { error } = await supabase
            .from("pod2_catalog_products" as any)
            .delete()
            .eq("id", productId);

        if (error) {
            toast.error("Kunne ikke slette produkt: " + error.message);
            return;
        }

        toast.success("POD v2 produkt slettet");
        refetch();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Konfigurer Katalog</CardTitle>
                <CardDescription>
                    Tilpas navne, layout og publiceringsstatus for POD v2 kataloget
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : catalogProducts && catalogProducts.length > 0 ? (
                    <div className="space-y-4">
                        {catalogProducts.map((product) => (
                            <Card key={product.id} className="p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-medium">{product.public_title?.da || product.public_title?.en}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {product.pod2_catalog_attributes?.length || 0} attributter,{" "}
                                            {product.pod2_catalog_price_matrix?.length || 0} priser
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={product.status === "published" ? "default" : "secondary"}>
                                            {product.status === "published" ? "Publiceret" : "Kladde"}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTogglePublish(product.id, product.status)}
                                        >
                                            {product.status === "published" ? "Afpublicér" : "Publicér"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteProduct(product.id)}
                                        >
                                            Slet
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Ingen konfigurerede produkter endnu.</p>
                        <p className="text-sm mt-2">
                            Brug API Explorer eller Vælg produkt til at hente produkter, og tilføj dem til kataloget.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Pricing Tab - Build price matrices
// ============================================================

function PricingTab() {
    const { data: catalogProducts, isLoading } = usePodCatalogProducts();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Prismatrix</CardTitle>
                <CardDescription>
                    Konfigurer priser for hvert produkt og variant-kombination
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : catalogProducts && catalogProducts.length > 0 ? (
                    <div className="space-y-6">
                        {catalogProducts.map((product) => (
                            <div key={product.id} className="border rounded-lg p-4">
                                <h3 className="font-medium mb-4">{product.public_title?.da || product.public_title?.en}</h3>

                                {product.pod2_catalog_price_matrix && product.pod2_catalog_price_matrix.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left p-2">Variant</th>
                                                    {product.pod2_catalog_price_matrix[0]?.quantities?.map((qty) => (
                                                        <th key={qty} className="text-right p-2">{qty} stk</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {product.pod2_catalog_price_matrix.map((matrix) => (
                                                    <tr key={matrix.id} className="border-b">
                                                        <td className="p-2 font-mono text-xs">{matrix.variant_signature}</td>
                                                        {matrix.recommended_retail?.map((price, idx) => (
                                                            <td key={idx} className="text-right p-2">
                                                                {price ? `${price} DKK` : "-"}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Ingen priser konfigureret</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-12 text-muted-foreground">
                        Ingen produkter i kataloget. Opret produkter i Kuratér-fanen først.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Publish Tab - Publish to tenant catalog
// ============================================================

function PublishTab() {
    const { data: catalogProducts, isLoading, refetch } = usePodCatalogProducts();

    const handleTogglePublish = async (productId: string, currentStatus: string) => {
        const newStatus = currentStatus === "published" ? "draft" : "published";

        const { error } = await (await import("@/integrations/supabase/client")).supabase
            .from("pod2_catalog_products" as any)
            .update({ status: newStatus })
            .eq("id", productId);

        if (error) {
            toast.error("Kunne ikke opdatere status");
        } else {
            toast.success(newStatus === "published" ? "Produkt publiceret" : "Produkt afpubliceret");
            refetch();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Publicér til Lejere</CardTitle>
                <CardDescription>
                    Gør kuraterede produkter tilgængelige for lejere at importere
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : catalogProducts && catalogProducts.length > 0 ? (
                    <div className="space-y-4">
                        {catalogProducts.map((product) => (
                            <div
                                key={product.id}
                                className="flex items-center justify-between p-4 border rounded-lg"
                            >
                                <div>
                                    <h3 className="font-medium">{product.public_title?.da || product.public_title?.en}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Oprettet: {new Date(product.created_at).toLocaleDateString("da-DK")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant={product.status === "published" ? "default" : "secondary"}>
                                        {product.status === "published" ? "Publiceret" : "Kladde"}
                                    </Badge>
                                    <Switch
                                        checked={product.status === "published"}
                                        onCheckedChange={() => handleTogglePublish(product.id, product.status)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-12 text-muted-foreground">
                        Ingen produkter i kataloget.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default Pod2Admin;
