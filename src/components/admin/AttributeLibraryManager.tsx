import { useState, useMemo } from "react";
import { useAttributeLibrary, LibraryGroup, LibraryValue } from "@/hooks/useAttributeLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Pencil, GripVertical, Check, X, FolderOpen, Save, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AttributeLibraryManager({ tenantId }: { tenantId: string }) {
    const { groups, loading, createGroup, updateGroup, deleteGroup, addValue, updateValue, deleteValue } = useAttributeLibrary(tenantId);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // Create Group State
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupKind, setNewGroupKind] = useState<'material' | 'finish' | 'other'>('material');

    // Create Value State
    const [showAddValue, setShowAddValue] = useState(false);
    const [newValueName, setNewValueName] = useState("");

    const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId), [groups, selectedGroupId]);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        const res = await createGroup({
            name: newGroupName,
            kind: newGroupKind,
            default_ui_mode: 'buttons',
            sort_order: groups.length
        });
        if (res) {
            setShowCreateGroup(false);
            setNewGroupName("");
            setSelectedGroupId(res.id);
        }
    };

    const handleAddValue = async () => {
        if (!selectedGroupId || !newValueName.trim()) return;

        await addValue(selectedGroupId, {
            name: newValueName,
            key: newValueName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            sort_order: (selectedGroup?.values?.length || 0),
            enabled: true,
            width_mm: null,
            height_mm: null,
            meta: {}
        });
        setNewValueName("");
        setShowAddValue(false);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            {/* Sidebar: Group List */}
            <Card className="col-span-1 flex flex-col h-full">
                <CardHeader className="pb-3 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">Attribut Grupper</CardTitle>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowCreateGroup(true)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {groups.map(group => (
                        <div
                            key={group.id}
                            onClick={() => setSelectedGroupId(group.id)}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors",
                                selectedGroupId === group.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                            )}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Badge variant="outline" className="text-[10px] h-5 px-1 py-0 uppercase tracking-tighter w-14 justify-center">
                                    {group.kind}
                                </Badge>
                                <span className="truncate">{group.name}</span>
                            </div>
                            {selectedGroupId === group.id && <Settings2 className="h-3 w-3 opacity-50" />}
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">Ingen grupper</p>
                    )}
                </div>
            </Card>

            {/* Main Area: Group Details */}
            <Card className="col-span-2 flex flex-col h-full">
                {selectedGroup ? (
                    <>
                        <CardHeader className="pb-3 border-b bg-muted/20">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">{selectedGroup.name}</CardTitle>
                                        <Badge>{selectedGroup.kind}</Badge>
                                    </div>
                                    <CardDescription className="text-xs mt-1">
                                        {selectedGroup.values?.length || 0} værdier i biblioteket
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        if (confirm("Er du sikker på at du vil slette denne gruppe?")) {
                                            deleteGroup(selectedGroup.id);
                                            setSelectedGroupId(null);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-3 w-3 mr-2" /> Slet gruppe
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">Værdier</Label>
                                <Button size="sm" onClick={() => setShowAddValue(true)}>
                                    <Plus className="h-3 w-3 mr-1" /> Tilføj værdi
                                </Button>
                            </div>

                            <div className="grid gap-2">
                                {selectedGroup.values?.sort((a, b) => a.sort_order - b.sort_order).map((value) => (
                                    <div key={value.id} className="flex items-center gap-2 bg-muted/40 p-2 rounded-md border group">
                                        <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-move" />
                                        <Input
                                            className="h-8 shadow-none border-transparent hover:border-input focus:border-ring bg-transparent"
                                            defaultValue={value.name}
                                            onBlur={(e) => {
                                                if (e.target.value !== value.name) {
                                                    updateValue(value.id, { name: e.target.value });
                                                }
                                            }}
                                        />
                                        <div className="flex-1" />
                                        <div className="flex items-center gap-1">
                                            <Switch
                                                checked={value.enabled}
                                                onCheckedChange={(checked) => updateValue(value.id, { enabled: checked })}
                                                className="scale-75"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => deleteValue(value.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {(selectedGroup.values?.length || 0) === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">Ingen værdier endnu</p>
                                        <Button variant="link" size="sm" onClick={() => setShowAddValue(true)}>
                                            Tilføj din første værdi
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                        <Settings2 className="h-12 w-12 opacity-10 mb-4" />
                        <p>Vælg en gruppe fra menuen til venstre for at redigere værdier.</p>
                    </div>
                )}
            </Card>

            {/* Create Group Dialog */}
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ny Attribut Gruppe</DialogTitle>
                        <DialogDescription>Opret en ny gruppe til materialer, finish eller andet.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Navn</Label>
                            <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="F.eks. Standard Papir" />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={newGroupKind} onValueChange={(v: any) => setNewGroupKind(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="material">Materiale</SelectItem>
                                    <SelectItem value="finish">Efterbehandling</SelectItem>
                                    <SelectItem value="other">Andet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Annuller</Button>
                        <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Opret</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Value Dialog */}
            <Dialog open={showAddValue} onOpenChange={setShowAddValue}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tilføj Værdi</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Navn</Label>
                            <Input
                                value={newValueName}
                                onChange={e => setNewValueName(e.target.value)}
                                placeholder="F.eks. 170g Silk"
                                onKeyDown={e => e.key === 'Enter' && handleAddValue()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddValue(false)}>Annuller</Button>
                        <Button onClick={handleAddValue} disabled={!newValueName.trim()}>Tilføj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
