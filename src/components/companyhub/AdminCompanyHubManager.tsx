import { useState } from "react";
import { useCompanyHub } from "@/hooks/useCompanyHub";
import { toast } from "sonner";
import { CompanyAccount, HubItem, CompanyMember } from "./types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Building2,
    Users,
    Package,
    Plus,
    Trash2,
    Edit2,
    ExternalLink,
    GripVertical,
    Upload,
    Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AdminCompanyHubManagerProps {
    tenantId: string;
}

export function AdminCompanyHubManager({ tenantId }: AdminCompanyHubManagerProps) {
    console.log("AdminCompanyHubManager: Initializing with tenantId:", tenantId);
    const {
        companiesQuery,
        createCompanyMutation,
        updateCompanyMutation,
        deleteCompanyMutation,
        hubItemsQuery,
        createHubItemMutation,
        updateHubItemMutation,
        deleteHubItemMutation,
        membersQuery,
        addMemberMutation,
        removeMemberMutation,
        tenantUsersQuery,
    } = useCompanyHub(tenantId);

    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Partial<CompanyAccount> | null>(null);

    const [isHubItemDialogOpen, setIsHubItemDialogOpen] = useState(false);
    const [editingHubItem, setEditingHubItem] = useState<Partial<HubItem> | null>(null);

    const [newMemberUserId, setNewMemberUserId] = useState("");

    const selectedCompany = companiesQuery.data?.find(c => c.id === selectedCompanyId);
    const { data: hubItems } = hubItemsQuery(selectedCompanyId || undefined);
    const { data: members } = membersQuery(selectedCompanyId || undefined);

    // Fetch products for THIS tenant
    const productsQuery = useQuery({
        queryKey: ["admin_products", tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products" as any)
                .select("id, name, slug")
                .eq("tenant_id", tenantId)
                .order("name");
            if (error) throw error;
            return data;
        },
        enabled: !!tenantId,
    });

    const handleSaveCompany = async () => {
        if (!editingCompany?.name) return;
        if (editingCompany.id) {
            await updateCompanyMutation.mutateAsync(editingCompany as any);
        } else {
            await createCompanyMutation.mutateAsync(editingCompany);
        }
        setIsCompanyDialogOpen(false);
        setEditingCompany(null);
    };

    const handleSaveHubItem = async () => {
        if (!selectedCompanyId || !editingHubItem?.title) return;
        const payload = { ...editingHubItem, company_id: selectedCompanyId };
        if (editingHubItem.id) {
            await updateHubItemMutation.mutateAsync(editingHubItem as any);
        } else {
            await createHubItemMutation.mutateAsync(payload);
        }
        setIsHubItemDialogOpen(false);
        setEditingHubItem(null);
    };

    const handleAddMember = async () => {
        if (!selectedCompanyId || !newMemberUserId) return;
        await addMemberMutation.mutateAsync({
            company_id: selectedCompanyId,
            user_id: newMemberUserId,
            role: 'company_user'
        });
        setNewMemberUserId("");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Companies List */}
            <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Firmaer</CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => companiesQuery.refetch()}>
                            <Loader2 className={`h-3 w-3 ${companiesQuery.isRefetching ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                            setEditingCompany({});
                            setIsCompanyDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        {companiesQuery.isLoading ? (
                            <p className="text-xs text-muted-foreground">Indlæser...</p>
                        ) : (
                            companiesQuery.data?.map(company => (
                                <button
                                    key={company.id}
                                    onClick={() => setSelectedCompanyId(company.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${selectedCompanyId === company.id
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted"
                                        }`}
                                >
                                    <Building2 className="h-4 w-4" />
                                    <span className="truncate">{company.name}</span>
                                </button>
                            ))
                        )}
                        {companiesQuery.data?.length === 0 && (
                            <p className="text-xs text-muted-foreground p-3 text-center">Ingen firmaer endnu.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Selected Company Details */}
            <div className="lg:col-span-3 space-y-6">
                {selectedCompany ? (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                                    {selectedCompany.logo_url ? (
                                        <img src={selectedCompany.logo_url} alt={selectedCompany.name} className="object-cover w-full h-full" />
                                    ) : (
                                        <Building2 className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedCompany.name}</h2>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        Firma konto administration
                                        <span className="text-muted-foreground/30">|</span>
                                        <a
                                            href="/company"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Besøg Portal
                                        </a>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => {
                                    setEditingCompany(selectedCompany);
                                    setIsCompanyDialogOpen(true);
                                }}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Rediger
                                </Button>
                                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                    if (confirm("Er du sikker på du vil slette dette firma?")) {
                                        deleteCompanyMutation.mutate(selectedCompany.id);
                                        setSelectedCompanyId(null);
                                    }
                                }}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Slet
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Hub Items Manager */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-base font-semibold">Hub Items</CardTitle>
                                        <CardDescription>Produkter kunden kan se og genbestille</CardDescription>
                                    </div>
                                    <Button size="sm" onClick={() => {
                                        setEditingHubItem({ default_quantity: 100, default_options: {}, sort_order: (hubItems?.length || 0) * 10 });
                                        setIsHubItemDialogOpen(true);
                                    }}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Tilføj
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]"></TableHead>
                                                <TableHead>Titel</TableHead>
                                                <TableHead>Produkt</TableHead>
                                                <TableHead className="text-right">Aktion</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hubItems?.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{item.title}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{item.product_name || "Ukendt produkt"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="sm" onClick={() => {
                                                                setEditingHubItem(item);
                                                                setIsHubItemDialogOpen(true);
                                                            }}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                                                                if (confirm("Slet dette item?")) {
                                                                    deleteHubItemMutation.mutate({ id: item.id, companyId: item.company_id });
                                                                }
                                                            }}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {hubItems?.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                                                        Ingen hub items tilføjet.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Members Manager */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">Medlemmer</CardTitle>
                                    <CardDescription>Brugere der har adgang til denne hub</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Vælg bruger..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(tenantUsersQuery.data as any[])?.map(user => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            <div className="flex flex-col">
                                                                <span>{user.name}</span>
                                                                {user.email && <span className="text-[10px] text-muted-foreground opacity-70">{user.email}</span>}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleAddMember}>Tilføj</Button>
                                    </div>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Bruger ID</TableHead>
                                                    <TableHead>Rolle</TableHead>
                                                    <TableHead className="text-right"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {members?.map((member: any) => (
                                                    <TableRow key={member.user_id}>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-xs">{member.user_name || "Ukendt"}</span>
                                                                {member.user_email && <span className="text-[10px] text-blue-600">{member.user_email}</span>}
                                                                <span className="text-[10px] text-muted-foreground font-mono">{member.user_id.slice(0, 8)}...</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs">{member.role}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                                                                if (confirm("Fjern dette medlem?")) {
                                                                    removeMemberMutation.mutate({ company_id: member.company_id, user_id: member.user_id });
                                                                }
                                                            }}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {members?.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                                                            Ingen medlemmer.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 bg-muted/20 border border-dashed rounded-lg">
                        <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-muted-foreground">Vælg et firma til venstre for at se detaljer</h3>
                    </div>
                )}
            </div>

            {/* Company Dialog */}
            <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCompany?.id ? "Rediger Firma" : "Opret Firma"}</DialogTitle>
                        <DialogDescription>
                            Angiv navn og upload et logo til firma-shoppen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Firma Navn</Label>
                            <Input
                                id="name"
                                value={editingCompany?.name || ""}
                                onChange={(e) => setEditingCompany(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Firma Logo</Label>
                            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                                <div className="h-16 w-16 rounded border bg-white flex items-center justify-center overflow-hidden">
                                    {editingCompany?.logo_url ? (
                                        <img src={editingCompany.logo_url} className="object-contain w-full h-full" />
                                    ) : (
                                        <Building2 className="h-8 w-8 text-muted-foreground opacity-20" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="file"
                                        id="logo-upload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            try {
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `company-${Date.now()}.${fileExt}`;
                                                const filePath = `company-logos/${tenantId}/${fileName}`;

                                                const { error: uploadError } = await supabase.storage
                                                    .from('product-images')
                                                    .upload(filePath, file);

                                                if (uploadError) throw uploadError;

                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('product-images')
                                                    .getPublicUrl(filePath);

                                                setEditingCompany(prev => ({ ...prev, logo_url: publicUrl }));
                                                toast.success("Logo uploadet");
                                            } catch (err) {
                                                console.error(err);
                                                toast.error("Kunne ikke uploade logo");
                                            }
                                        }}
                                    />
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <label htmlFor="logo-upload" className="cursor-pointer">
                                                <Upload className="h-4 w-4 mr-2" />
                                                Upload
                                            </label>
                                        </Button>
                                        {editingCompany?.logo_url && (
                                            <Button variant="ghost" size="sm" onClick={() => setEditingCompany(prev => ({ ...prev, logo_url: "" }))}>
                                                Fjern
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">PNG, JPG eller SVG anbefales.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>Annuller</Button>
                        <Button onClick={handleSaveCompany}>Gem Firma</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hub Item Dialog */}
            <Dialog open={isHubItemDialogOpen} onOpenChange={setIsHubItemDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingHubItem?.id ? "Rediger Hub Item" : "Tilføj Hub Item"}</DialogTitle>
                        <DialogDescription>
                            Vælg produkt og standardindstillinger for denne skabelon.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Titel (Vises til kunden)</Label>
                            <Input
                                id="title"
                                value={editingHubItem?.title || ""}
                                onChange={(e) => setEditingHubItem(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g. Visitkort - Standard"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Produkt</Label>
                            <Select
                                value={editingHubItem?.product_id || ""}
                                onValueChange={(val) => setEditingHubItem(prev => ({ ...prev, product_id: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg produkt" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(productsQuery.data as any[])?.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="qty">Standard Antal</Label>
                                <Input
                                    id="qty"
                                    type="number"
                                    value={editingHubItem?.default_quantity || 100}
                                    onChange={(e) => setEditingHubItem(prev => ({ ...prev, default_quantity: parseInt(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sort">Sortering</Label>
                                <Input
                                    id="sort"
                                    type="number"
                                    value={editingHubItem?.sort_order || 0}
                                    onChange={(e) => setEditingHubItem(prev => ({ ...prev, sort_order: parseInt(e.target.value) }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="thumb">Thumbnail URL (valgfri)</Label>
                            <Input
                                id="thumb"
                                value={editingHubItem?.thumbnail_url || ""}
                                onChange={(e) => setEditingHubItem(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="design">Design ID (Reprint variant - valgfri)</Label>
                            <Input
                                id="design"
                                value={editingHubItem?.design_id || ""}
                                onChange={(e) => setEditingHubItem(prev => ({ ...prev, design_id: e.target.value }))}
                                placeholder="UUID fra gemte designs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsHubItemDialogOpen(false)}>Annuller</Button>
                        <Button onClick={handleSaveHubItem}>Gem Item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
