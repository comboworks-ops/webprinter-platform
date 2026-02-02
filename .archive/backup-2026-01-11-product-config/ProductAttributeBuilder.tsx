import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Plus, Trash2, GripVertical, Library, ChevronDown, ChevronUp, Settings2, Loader2, Search, Package, Copy, Pencil, Check, X } from "lucide-react";
import { useAttributeLibrary, LibraryGroup } from "@/hooks/useAttributeLibrary";
import { useProductAttributes, ProductAttributeGroup } from "@/hooks/useProductAttributes";
import { cn } from "@/lib/utils";
import { PriceListTemplateBuilder } from "./PriceListTemplateBuilder";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProductAttributeBuilderProps {
    productId: string;
    tenantId: string;
}

const KIND_LABELS: Record<string, string> = {
    format: 'Format',
    material: 'Materiale',
    finish: 'Efterbehandling',
    other: 'Øvrige',
    custom: 'Tilpasset'
};

const KIND_COLORS: Record<string, string> = {
    format: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    material: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    finish: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    custom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
};

// Props for the sortable group item
interface SortableGroupItemProps {
    group: ProductAttributeGroup;
    isExpanded: boolean;
    isEditing: boolean;
    editName: string;
    onToggleExpand: () => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onEditNameChange: (name: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onUpdateValue: (valueId: string, data: { enabled: boolean }) => void;
    onDeleteValue: (valueId: string) => void;
    addingValueToGroup: string | null;
    setAddingValueToGroup: (id: string | null) => void;
    newValueName: string;
    setNewValueName: (name: string) => void;
    newValueWidth: string;
    setNewValueWidth: (width: string) => void;
    newValueHeight: string;
    setNewValueHeight: (height: string) => void;
    onAddValue: (groupId: string, kind: string) => void;
}

function SortableGroupItem({
    group,
    isExpanded,
    isEditing,
    editName,
    onToggleExpand,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditNameChange,
    onDuplicate,
    onDelete,
    onUpdateValue,
    onDeleteValue,
    addingValueToGroup,
    setAddingValueToGroup,
    newValueName,
    setNewValueName,
    newValueWidth,
    setNewValueWidth,
    newValueHeight,
    setNewValueHeight,
    onAddValue
}: SortableGroupItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto'
    };

    return (
        <div ref={setNodeRef} style={style} className="border rounded-lg">
            {/* Group Header */}
            <div
                className="flex items-center justify-between p-3 hover:bg-muted/30"
            >
                <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-1 -m-1 rounded hover:bg-muted"
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div
                        className="cursor-pointer flex-1"
                        onClick={() => !isEditing && onToggleExpand()}
                    >
                        {isEditing ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    value={editName}
                                    onChange={(e) => onEditNameChange(e.target.value)}
                                    className="h-7 text-sm w-48"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onSaveEdit();
                                        } else if (e.key === 'Escape') {
                                            onCancelEdit();
                                        }
                                    }}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={onSaveEdit}
                                >
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={onCancelEdit}
                                >
                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{group.name}</span>
                                <Badge className={cn("text-xs", KIND_COLORS[group.kind])}>
                                    {KIND_LABELS[group.kind]}
                                </Badge>
                                {group.source === 'library' && (
                                    <Badge variant="outline" className="text-xs">Bibliotek</Badge>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {group.values?.length || 0} værdier · {group.ui_mode === 'buttons' ? 'Knapper' : 'Dropdown'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Edit Name */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartEdit();
                                    }}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rediger navn</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Copy/Duplicate */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDuplicate();
                                    }}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Dupliker gruppe</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Delete */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Slet gruppe</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div
                        className="cursor-pointer p-1"
                        onClick={onToggleExpand}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Values */}
            {isExpanded && (
                <div className="border-t p-3 space-y-2 bg-muted/20">
                    {group.values?.map(value => (
                        <div key={value.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-background">
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={value.enabled}
                                    onCheckedChange={(enabled) => onUpdateValue(value.id, { enabled })}
                                />
                                <span className="text-sm">{value.name}</span>
                                {group.kind === 'format' && value.width_mm && value.height_mm && (
                                    <span className="text-xs text-muted-foreground">
                                        {value.width_mm} x {value.height_mm} mm
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onDeleteValue(value.id)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}

                    {/* Add Value */}
                    {addingValueToGroup === group.id ? (
                        <div className="flex items-center gap-2 pt-2">
                            <Input
                                placeholder="Navn"
                                value={newValueName}
                                onChange={(e) => setNewValueName(e.target.value)}
                                className="h-8 text-sm flex-1"
                            />
                            {group.kind === 'format' && (
                                <>
                                    <Input
                                        placeholder="B (mm)"
                                        type="number"
                                        value={newValueWidth}
                                        onChange={(e) => setNewValueWidth(e.target.value)}
                                        className="h-8 text-sm w-20"
                                    />
                                    <Input
                                        placeholder="H (mm)"
                                        type="number"
                                        value={newValueHeight}
                                        onChange={(e) => setNewValueHeight(e.target.value)}
                                        className="h-8 text-sm w-20"
                                    />
                                </>
                            )}
                            <Button size="sm" className="h-8" onClick={() => onAddValue(group.id, group.kind)}>
                                Tilføj
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingValueToGroup(null)}>
                                Annuller
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setAddingValueToGroup(group.id)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Tilføj værdi
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export function ProductAttributeBuilder({
    productId,
    tenantId
}: ProductAttributeBuilderProps) {
    const library = useAttributeLibrary(tenantId);
    const productAttrs = useProductAttributes(productId, tenantId);

    const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupKind, setNewGroupKind] = useState<string>('other');
    const [newGroupUiMode, setNewGroupUiMode] = useState<string>('buttons');
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // New value state
    const [addingValueToGroup, setAddingValueToGroup] = useState<string | null>(null);
    const [newValueName, setNewValueName] = useState('');
    const [newValueWidth, setNewValueWidth] = useState('');
    const [newValueHeight, setNewValueHeight] = useState('');

    // Edit group name state
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState('');

    const filteredLibraryGroups = library.groups.filter(g =>
        g.name.toLowerCase().includes(librarySearch.toLowerCase())
    );

    const toggleGroupExpand = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const handleAddFromLibrary = async (group: LibraryGroup) => {
        await productAttrs.addFromLibrary(group);
        setLibraryPickerOpen(false);
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;

        // Create for product
        const created = await productAttrs.createGroup({
            name: newGroupName.trim(),
            kind: newGroupKind as any,
            ui_mode: newGroupUiMode as any,
            source: 'product',
            sort_order: productAttrs.groups.length,
            enabled: true,
            library_group_id: null
        });

        // Optionally save to library
        if (saveToLibrary && created) {
            await library.createGroup({
                name: newGroupName.trim(),
                kind: newGroupKind as any,
                default_ui_mode: newGroupUiMode as any,
                sort_order: library.groups.length
            });
        }

        setNewGroupName('');
        setNewGroupKind('other');
        setNewGroupUiMode('buttons');
        setSaveToLibrary(false);
        setNewGroupDialogOpen(false);
    };

    const handleAddValue = async (groupId: string, kind: string) => {
        if (!newValueName.trim()) return;

        const group = productAttrs.groups.find(g => g.id === groupId);
        const valueCount = group?.values?.length || 0;

        await productAttrs.addValue(groupId, {
            name: newValueName.trim(),
            key: null,
            sort_order: valueCount,
            enabled: true,
            width_mm: kind === 'format' && newValueWidth ? parseFloat(newValueWidth) : null,
            height_mm: kind === 'format' && newValueHeight ? parseFloat(newValueHeight) : null,
            meta: null
        });

        setNewValueName('');
        setNewValueWidth('');
        setNewValueHeight('');
        setAddingValueToGroup(null);
    };

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = productAttrs.groups.findIndex(g => g.id === active.id);
            const newIndex = productAttrs.groups.findIndex(g => g.id === over.id);

            const newOrder = arrayMove(productAttrs.groups, oldIndex, newIndex);
            const newOrderIds = newOrder.map(g => g.id);

            productAttrs.reorderGroups(newOrderIds);
        }
    };

    if (productAttrs.loading || library.loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Library Picker */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Library className="h-4 w-4" />
                        Attributter
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Tilføj eksisterende grupper fra biblioteket eller opret nye
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Dialog open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Library className="mr-2 h-4 w-4" />
                                    Tilføj fra bibliotek
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Vælg fra bibliotek</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Søg i bibliotek..."
                                            value={librarySearch}
                                            onChange={(e) => setLibrarySearch(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {filteredLibraryGroups.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                {library.groups.length === 0
                                                    ? 'Ingen grupper i biblioteket endnu'
                                                    : 'Ingen resultater'}
                                            </p>
                                        ) : (
                                            filteredLibraryGroups.map(group => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => handleAddFromLibrary(group)}
                                                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                                                >
                                                    <div>
                                                        <p className="font-medium text-sm">{group.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {group.values?.length || 0} værdier
                                                        </p>
                                                    </div>
                                                    <Badge className={cn("text-xs", KIND_COLORS[group.kind])}>
                                                        {KIND_LABELS[group.kind]}
                                                    </Badge>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ny gruppe
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Opret ny gruppe</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Gruppenavn</Label>
                                        <Input
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            placeholder="F.eks. Papirtyper, Størrelser..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Type</Label>
                                            <Select value={newGroupKind} onValueChange={setNewGroupKind}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="format">Format</SelectItem>
                                                    <SelectItem value="material">Materiale</SelectItem>
                                                    <SelectItem value="finish">Efterbehandling</SelectItem>
                                                    <SelectItem value="other">Øvrige</SelectItem>
                                                    <SelectItem value="custom">Tilpasset</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Visning</Label>
                                            <Select value={newGroupUiMode} onValueChange={setNewGroupUiMode}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="buttons">Knapper</SelectItem>
                                                    <SelectItem value="dropdown">Dropdown</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <Label>Gem i bibliotek</Label>
                                            <p className="text-xs text-muted-foreground">Gør gruppen tilgængelig for andre produkter</p>
                                        </div>
                                        <Switch checked={saveToLibrary} onCheckedChange={setSaveToLibrary} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setNewGroupDialogOpen(false)}>
                                        Annuller
                                    </Button>
                                    <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                                        Opret
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {/* Product Groups */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Produktets grupper
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {productAttrs.groups.length} gruppe{productAttrs.groups.length !== 1 ? 'r' : ''} tilknyttet
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {productAttrs.groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            Ingen grupper tilføjet endnu. Brug biblioteket eller opret en ny gruppe.
                        </p>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={productAttrs.groups.map(g => g.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {productAttrs.groups.map(group => (
                                        <SortableGroupItem
                                            key={group.id}
                                            group={group}
                                            isExpanded={expandedGroups.has(group.id)}
                                            isEditing={editingGroupId === group.id}
                                            editName={editGroupName}
                                            onToggleExpand={() => toggleGroupExpand(group.id)}
                                            onStartEdit={() => {
                                                setEditGroupName(group.name);
                                                setEditingGroupId(group.id);
                                            }}
                                            onSaveEdit={() => {
                                                productAttrs.updateGroup(group.id, { name: editGroupName });
                                                setEditingGroupId(null);
                                            }}
                                            onCancelEdit={() => setEditingGroupId(null)}
                                            onEditNameChange={setEditGroupName}
                                            onDuplicate={() => productAttrs.duplicateGroup(group.id)}
                                            onDelete={() => productAttrs.deleteGroup(group.id)}
                                            onUpdateValue={(valueId, data) => productAttrs.updateValue(valueId, data)}
                                            onDeleteValue={(valueId) => productAttrs.deleteValue(valueId)}
                                            addingValueToGroup={addingValueToGroup}
                                            setAddingValueToGroup={setAddingValueToGroup}
                                            newValueName={newValueName}
                                            setNewValueName={setNewValueName}
                                            newValueWidth={newValueWidth}
                                            setNewValueWidth={setNewValueWidth}
                                            newValueHeight={newValueHeight}
                                            setNewValueHeight={setNewValueHeight}
                                            onAddValue={handleAddValue}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </CardContent>
            </Card>

            {/* Price List Template Builder */}
            <PriceListTemplateBuilder
                productId={productId}
                tenantId={tenantId}
                groups={productAttrs.groups.map(g => ({ id: g.id, name: g.name, label: g.name }))}
                options={
                    Object.fromEntries(
                        productAttrs.groups.map(g => [
                            g.id,
                            (g.values || []).map(v => ({ id: v.id, group_id: g.id, name: v.name, label: v.name }))
                        ])
                    )
                }
            />
        </div>
    );
}
