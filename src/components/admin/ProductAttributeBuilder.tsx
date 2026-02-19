import { useState, useEffect, useMemo, useTransition, useCallback, memo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, GripVertical, Library, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Settings2, Loader2, Search, Package, Copy, Pencil, Check, X, Wand2, LayoutGrid, Save, Download, AlertTriangle, Lock, Unlock, Upload, FolderOpen, Image as ImageIcon, CloudUpload, FileInput, RotateCcw, MoveRight } from "lucide-react";
import { toast } from "sonner";
import { useAttributeLibrary, LibraryGroup } from "@/hooks/useAttributeLibrary";
import { useProductAttributes, ProductAttributeGroup } from "@/hooks/useProductAttributes";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from "@/integrations/supabase/client";

import { Slider } from "@/components/ui/slider";
import { CenterSlider } from "@/components/ui/center-slider";
import { STANDARD_FORMATS, FormatDimension } from "@/utils/formatStandards";
import { CategorySelector } from "./CategorySelector";
import { Checkbox } from "@/components/ui/checkbox";
import { PICTURE_SIZES, type PictureSizeMode } from "@/lib/storformat-pricing/types";

// Size mode type
type SizeMode = 'format' | 'free_size';
type FormatDisplayMode = 'buttons' | 'dropdown' | 'checkboxes' | 'small' | 'medium' | 'large' | 'xl';

interface ValueSetting {
    showThumbnail: boolean;
    customImage?: string;
}



// Config storage key
const CONFIG_STORAGE_KEY = 'product_config_';
const MAX_PERSISTED_GENERATOR_PRICE_ENTRIES = 1500;

// Preset quantities for oplag
const PRESET_QUANTITIES = [10, 25, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const MAX_PREVIEW_ROWS = 500;

function isQuotaExceededError(error: unknown): boolean {
    if (!(error instanceof DOMException)) return false;
    return (
        error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error.code === 22
        || error.code === 1014
    );
}

function trimGeneratorPricesForStorage(
    prices: Record<string, { price: number; markup: number; isLocked?: boolean; excludeFromCurve?: boolean }>
) {
    const entries = Object.entries(prices || {});
    if (entries.length <= MAX_PERSISTED_GENERATOR_PRICE_ENTRIES) {
        return prices;
    }
    return Object.fromEntries(entries.slice(0, MAX_PERSISTED_GENERATOR_PRICE_ENTRIES));
}

interface ProductAttributeBuilderProps {
    productId: string;
    tenantId: string;
    productName?: string;
    tableName?: string;
    productSlug?: string;
    onPricesUpdated?: () => void;
    sizeMode?: SizeMode;
    onSizeModeChange?: (mode: SizeMode) => void;
    maxWidthMm?: string;
    onMaxWidthMmChange?: (value: string) => void;
    maxHeightMm?: string;
    onMaxHeightMmChange?: (value: string) => void;
}

// Helper to map Group Labels to Database Columns
function mapGroupLabelToColumn(label: string, tableName: string): string | null {
    const l = label.toLowerCase();

    // Universal mapping
    if (l === 'format' || l === 'formater' || l === 'størrelser' || l === 'størrelse') return 'format';
    if (l === 'papir' || l === 'materiale') {
        if (tableName.includes('poster_rates') || tableName.includes('banner') || tableName.includes('sign') || tableName.includes('foil') || tableName.includes('sticker')) return 'material';
        return 'paper';
    }

    // Specifics
    if (tableName.includes('folder')) {
        if (l === 'falsetype' || l === 'foldning') return 'fold_type';
    }
    if (tableName.includes('booklet') || tableName.includes('hæfter') || tableName.includes('haefter')) {
        if (l === 'antal sider' || l === 'sider' || l === 'pages') return 'pages';
    }
    if (tableName.includes('salesfolder')) {
        if (l === 'sidetype' || l === 'type') return 'side_type';
    }
    if (tableName.includes('beachflag')) {
        if (l === 'størrelse' || l === 'size') return 'size';
        if (l === 'system') return 'system';
    }

    return null;
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
    newValueBleed: string;
    setNewValueBleed: (bleed: string) => void;
    newValueSafeArea: string;
    setNewValueSafeArea: (safeArea: string) => void;
    onAddValue: (groupId: string, kind: string) => void;
    onEditValue: (valueId: string) => void;
}

// Draggable Layout Row Component
interface DraggableLayoutRowProps {
    row: LayoutRow;
    rowIndex: number;
    isOver: boolean;
    isColumnDragging: boolean;
    activeDragRowId?: string | null;
    children: React.ReactNode;
}

function DraggableLayoutRow({ row, rowIndex, isOver, isColumnDragging, activeDragRowId, children }: DraggableLayoutRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: row.id,
        data: { type: 'row' }
    });

    // Drop zone for columns being dragged from other rows
    const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
        id: `drop-${row.id}`,
        data: { type: 'row-drop-zone', rowId: row.id }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 150ms ease',
        opacity: isDragging ? 0.3 : 1,
    };

    // Show drop indicator only if a column from another row is being dragged over this row
    const showDropIndicator = isColumnDragging && isDropOver && activeDragRowId !== row.id && row.sections.length < 6;

    return (
        <div
            ref={(node) => {
                setNodeRef(node);
                setDropRef(node);
            }}
            style={style}
            className={cn(
                "space-y-2 relative transition-all duration-150",
                isOver && !isDragging && "ring-2 ring-primary ring-offset-2 rounded-lg"
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute -left-7 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Træk række"
            >
                <GripVertical className="h-4 w-4" />
            </div>
            {/* Drop indicator badge */}
            {showDropIndicator && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 animate-pulse">
                    <div className="bg-primary text-primary-foreground text-[10px] font-medium px-2 py-1 rounded-full shadow-lg">
                        + Tilføj her
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}

// Draggable Column Component (for sections within a row)
// Uses useDraggable instead of useSortable to prevent layout shifts
interface DraggableColumnProps {
    section: LayoutSection;
    sectionIndex: number;
    rowId: string;
    canDrag: boolean;
    isDragging: boolean;
    children: React.ReactNode;
}

function DraggableColumn({ section, sectionIndex, rowId, canDrag, isDragging, children }: DraggableColumnProps) {
    const { attributes, listeners, setNodeRef } = useSortable({
        id: section.id,
        data: { type: 'column', rowId, sectionIndex },
        disabled: !canDrag
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "relative group/column transition-opacity duration-150",
                isDragging && "opacity-30"
            )}
        >
            {/* Column Drag Handle */}
            {canDrag && (
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "absolute -top-2.5 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing",
                        "px-2 py-0.5 flex items-center justify-center gap-1",
                        "bg-background border border-border rounded-full shadow-sm",
                        "opacity-60 group-hover/column:opacity-100 hover:bg-muted transition-all z-10",
                        "text-[10px] text-muted-foreground"
                    )}
                    title="Træk kolonne til anden række"
                >
                    <GripVertical className="h-3 w-3 rotate-90" />
                </div>
            )}
            {children}
        </div>
    );
}

// Column drag overlay preview
function ColumnDragPreview({ sectionType }: { sectionType: string }) {
    const label = sectionType === 'products' ? 'Produkter'
        : sectionType === 'formats' ? 'Formater'
        : sectionType === 'materials' ? 'Materialer'
        : 'Efterbehandling';

    return (
        <div className="w-32 p-3 bg-background border-2 border-primary rounded-lg shadow-xl opacity-90">
            <div className="text-xs font-medium text-center text-primary">{label}</div>
            <div className="text-[10px] text-muted-foreground text-center mt-1">Slip i en række</div>
        </div>
    );
}

// Sortable Value Component (for items within a section)
interface SortableValueProps {
    value: { id: string; name: string };
    rowId: string;
    sectionId: string;
    settings?: ValueSetting;
    onEdit: () => void;
    onToggleThumbnail: () => void;
    onUpload: () => void;
    onRemove: () => void;
}

function SortableValue({ value, rowId, sectionId, settings, onEdit, onToggleThumbnail, onUpload, onRemove }: SortableValueProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: value.id,
        data: { type: 'value', rowId, sectionId }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center justify-between p-1 rounded border bg-card/50 text-[10px]",
                isDragging && "shadow-md ring-1 ring-primary"
            )}
        >
            <div className="flex items-center gap-1 truncate">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                >
                    <GripVertical className="h-3 w-3" />
                </div>
                <span className="truncate">{value.name}</span>
                {settings?.showThumbnail && <ImageIcon className="h-3 w-3 text-primary" />}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    title="Rediger"
                >
                    <Pencil className="h-2.5 w-2.5" />
                </Button>
                <Button
                    variant={settings?.showThumbnail ? "default" : "ghost"}
                    size="icon"
                    className="h-4 w-4"
                    onClick={(e) => { e.stopPropagation(); onToggleThumbnail(); }}
                >
                    <ImageIcon className="h-2.5 w-2.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={(e) => { e.stopPropagation(); onUpload(); }}
                >
                    <CloudUpload className="h-2.5 w-2.5" />
                </Button>
                <div
                    className="h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                >
                    <X className="h-2.5 w-2.5" />
                </div>
            </div>
        </div>
    );
}

interface LayoutRow {
    id: string;
    title?: string;
    description?: string;
    sections: LayoutSection[];
}

interface LayoutSection {
    id: string;
    groupId: string;
    sectionType: AttributeType;
    valueIds?: string[];
    ui_mode: DisplayMode;
    selection_mode: SelectionMode;
    valueSettings?: Record<string, ValueSetting>;
    thumbnailsEnabled?: boolean;
    title?: string;
    description?: string;
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
    newValueBleed,
    setNewValueBleed,
    newValueSafeArea,
    setNewValueSafeArea,
    onAddValue,
    onEditValue
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
        <div ref={setNodeRef} style={style} className="border rounded-lg bg-card text-card-foreground shadow-sm">
            {/* Group Header */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 text-muted-foreground"
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>

                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={editName}
                                onChange={(e) => onEditNameChange(e.target.value)}
                                className="h-7 text-sm w-48 shadow-none"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSaveEdit();
                                    else if (e.key === 'Escape') onCancelEdit();
                                }}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSaveEdit}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{group.name}</span>
                            <Badge variant="outline" className="text-[10px] font-normal">{group.ui_mode === 'buttons' ? 'Knapper' : 'Dropdown'}</Badge>
                            {group.source === 'library' && <Badge variant="secondary" className="text-[10px]">Library</Badge>}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onStartEdit}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <div
                        className="h-8 w-8 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={onToggleExpand}
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {isExpanded && (
                <div className="p-4 bg-card">
                    {group.ui_mode === 'buttons' ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {group.values?.map(value => (
                                    <div
                                        key={value.id}
                                        className={cn(
                                            "group relative flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-all cursor-pointer select-none",
                                            value.enabled
                                                ? "bg-primary/10 border-primary text-primary font-medium"
                                                : "bg-muted/30 border-dashed hover:bg-muted text-muted-foreground"
                                        )}
                                        onClick={() => onUpdateValue(value.id, { enabled: !value.enabled })}
                                    >
                                        <div className={cn("w-3 h-3 rounded-full border flex items-center justify-center", value.enabled ? "border-primary bg-primary" : "border-muted-foreground")}>
                                            {value.enabled && <Check className="h-2 w-2 text-white" />}
                                        </div>
                                        {value.name}
                                        {/* Hover Actions */}
                                        <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 z-10">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-5 w-5 rounded-full shadow-sm bg-background border hover:bg-muted"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditValue(value.id);
                                                }}
                                                title="Indstillinger"
                                            >
                                                <Settings2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-5 w-5 rounded-full shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteValue(value.id);
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-[34px] border-dashed text-muted-foreground"
                                    onClick={() => setAddingValueToGroup(group.id)}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Tilføj
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="w-full max-w-sm">
                                <Select disabled>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Vælg ${group.name.toLowerCase()}...`} />
                                    </SelectTrigger>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">Dropdown preview</p>
                            </div>
                            <div className="border-t pt-2 mt-2 space-y-1">
                                {group.values?.map(value => (
                                    <div key={value.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Switch checked={value.enabled} onCheckedChange={(c) => onUpdateValue(value.id, { enabled: c })} className="scale-75" />
                                            <span>{value.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDeleteValue(value.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                <Button size="sm" variant="ghost" className="w-full justify-start text-muted-foreground text-xs" onClick={() => setAddingValueToGroup(group.id)}>
                                    <Plus className="h-3 w-3 mr-2" /> Tilføj værdi til dropdown
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Add Value Input Area */}
                    {addingValueToGroup === group.id && (
                        <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder="Navn på ny værdi"
                                    value={newValueName}
                                    onChange={(e) => setNewValueName(e.target.value)}
                                    className="h-8 text-sm min-w-[220px] flex-1"
                                    onKeyDown={(e) => e.key === 'Enter' && onAddValue(group.id, group.kind)}
                                    autoFocus
                                />
                                <Button size="sm" className="h-8" onClick={() => onAddValue(group.id, group.kind)}>Tilføj</Button>
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingValueToGroup(null)}>Annuller</Button>
                            </div>
                            {group.kind === 'format' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Bredde (mm)"
                                        value={newValueWidth}
                                        onChange={(e) => setNewValueWidth(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Højde (mm)"
                                        value={newValueHeight}
                                        onChange={(e) => setNewValueHeight(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Bleed (mm)"
                                        value={newValueBleed}
                                        onChange={(e) => setNewValueBleed(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Safe zone (mm)"
                                        value={newValueSafeArea}
                                        onChange={(e) => setNewValueSafeArea(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function ProductAttributeBuilder({
    productId,
    tenantId,
    productName = 'Produkt',
    tableName,
    productSlug,
    onPricesUpdated,
    sizeMode: sizeModeProp,
    onSizeModeChange,
    maxWidthMm: maxWidthMmProp,
    onMaxWidthMmChange,
    maxHeightMm: maxHeightMmProp,
    onMaxHeightMmChange
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
    const [newValueBleed, setNewValueBleed] = useState('3');
    const [newValueSafeArea, setNewValueSafeArea] = useState('3');
    const [editingValueId, setEditingValueId] = useState<string | null>(null);

    // Edit group name state
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [showCreateValueDialog, setShowCreateValueDialog] = useState(false);

    // ============ NEW: Size Mode & Config State ============
    const [internalSizeMode, setInternalSizeMode] = useState<SizeMode>('format');
    const [formatDisplayMode, setFormatDisplayMode] = useState<FormatDisplayMode>('buttons');
    const [internalMaxWidthMm, setInternalMaxWidthMm] = useState<string>('');
    const [internalMaxHeightMm, setInternalMaxHeightMm] = useState<string>('');

    const sizeMode = sizeModeProp ?? internalSizeMode;
    const setSizeMode = onSizeModeChange ?? setInternalSizeMode;
    const maxWidthMm = maxWidthMmProp ?? internalMaxWidthMm;
    const setMaxWidthMm = onMaxWidthMmChange ?? setInternalMaxWidthMm;
    const maxHeightMm = maxHeightMmProp ?? internalMaxHeightMm;
    const setMaxHeightMm = onMaxHeightMmChange ?? setInternalMaxHeightMm;

    // Layout configuration for rows and sections
    // Each row can have 1-3 sections, each section contains product group IDs
    // Layout configuration
    type AttributeType = 'products' | 'formats' | 'materials' | 'finishes';
    type DisplayMode = 'buttons' | 'dropdown' | 'checkboxes' | 'hidden' | 'small' | 'medium' | 'large' | 'xl';
    type SelectionMode = 'required' | 'optional';

    interface LayoutSection {
        id: string;
        sectionType: AttributeType;
        ui_mode?: DisplayMode;
        selection_mode?: SelectionMode;
        groupId: string;
        valueIds?: string[];
        valueSettings?: Record<string, ValueSetting>;
        thumbnailsEnabled?: boolean;
        title?: string;
        description?: string;
    }

    interface LayoutRow {
        id: string;
        sections: LayoutSection[];
        title?: string;
        description?: string;
    }

    interface VerticalAxisConfig {
        sectionId: string;
        sectionType: AttributeType;
        ui_mode?: DisplayMode;
        groupId: string;
        valueIds?: string[];
        valueSettings?: Record<string, ValueSetting>;
        thumbnailsEnabled?: boolean;
        title?: string;
        description?: string;
    }

    const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([
        { id: 'row-1', sections: [{ id: 'section-1', groupId: '', sectionType: 'formats', ui_mode: 'buttons', selection_mode: 'required' }] }
    ]);

    // Unified drag and drop state
    const [activeDragItem, setActiveDragItem] = useState<{ id: string; type: 'row' | 'column' | 'value'; data?: any } | null>(null);
    const [overTargetId, setOverTargetId] = useState<string | null>(null);

    const unifiedSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Unified drag start handler
    const handleUnifiedDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const data = active.data.current as { type: 'row' | 'column' | 'value'; rowId?: string; sectionId?: string } | undefined;
        setActiveDragItem({
            id: active.id as string,
            type: data?.type || 'row',
            data
        });
    };

    // Unified drag over handler
    const handleUnifiedDragOver = (event: DragOverEvent) => {
        const { over, active } = event;
        if (!over) {
            setOverTargetId(null);
            return;
        }

        const activeData = active.data.current as { type: string; rowId?: string } | undefined;
        const overData = over.data.current as { type: string; rowId?: string } | undefined;

        // Column being dragged over another row
        if (activeData?.type === 'column' && overData?.type === 'row-drop-zone') {
            setOverTargetId(over.id as string);
        } else if (activeData?.type === 'row') {
            setOverTargetId(over.id as string);
        } else {
            setOverTargetId(over.id as string);
        }
    };

    // Unified drag end handler
    const handleUnifiedDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);
        setOverTargetId(null);

        if (!over || active.id === over.id) return;

        const activeData = active.data.current as { type: 'row' | 'column' | 'value'; rowId?: string; sectionId?: string } | undefined;
        const overData = over.data.current as { type: 'row' | 'column' | 'value' | 'row-drop-zone'; rowId?: string; sectionId?: string } | undefined;

        // Handle ROW drag
        if (activeData?.type === 'row') {
            const activeIndex = layoutRows.findIndex(r => r.id === active.id);
            const overIndex = layoutRows.findIndex(r => r.id === over.id);

            if (activeIndex !== -1 && overIndex !== -1) {
                const activeRow = layoutRows[activeIndex];
                const overRow = layoutRows[overIndex];
                const totalSectionsAfterMerge = activeRow.sections.length + overRow.sections.length;

                if (totalSectionsAfterMerge <= 6) {
                    setLayoutRows(prev => {
                        const newRows = prev.map(r => {
                            if (r.id === over.id) {
                                return { ...r, sections: [...r.sections, ...activeRow.sections] };
                            }
                            return r;
                        }).filter(r => r.id !== active.id);
                        return newRows;
                    });
                    toast.success(`Rækker sammenlagt til ${totalSectionsAfterMerge} kolonner`);
                } else {
                    setLayoutRows(prev => arrayMove(prev, activeIndex, overIndex));
                }
            }
            return;
        }

        // Handle COLUMN drag
        if (activeData?.type === 'column') {
            const fromRowId = activeData.rowId;

            // Check if dropping onto a row drop zone (different row)
            if (overData?.type === 'row-drop-zone' || overData?.type === 'row') {
                const toRowId = over.id as string;
                if (fromRowId && toRowId && fromRowId !== toRowId) {
                    handleMoveColumnToRow(active.id as string, fromRowId, toRowId);
                    return;
                }
            }

            // Check if dropping onto another column in a different row
            if (overData?.type === 'column' && overData.rowId && fromRowId !== overData.rowId) {
                handleMoveColumnToRow(active.id as string, fromRowId!, overData.rowId);
                return;
            }

            // Same row - reorder columns
            if (overData?.type === 'column' && fromRowId === overData.rowId) {
                setLayoutRows(prev => prev.map(r => {
                    if (r.id === fromRowId) {
                        const oldIndex = r.sections.findIndex(s => s.id === active.id);
                        const newIndex = r.sections.findIndex(s => s.id === over.id);
                        if (oldIndex !== -1 && newIndex !== -1) {
                            return { ...r, sections: arrayMove(r.sections, oldIndex, newIndex) };
                        }
                    }
                    return r;
                }));
            }
            return;
        }

        // Handle VALUE drag (within same section)
        if (activeData?.type === 'value' && overData?.type === 'value') {
            if (activeData.rowId === overData.rowId && activeData.sectionId === overData.sectionId) {
                handleValueReorder(activeData.rowId!, activeData.sectionId!, active.id as string, over.id as string);
            }
        }
    };

    // Move column to a different row
    const handleMoveColumnToRow = (sectionId: string, fromRowId: string, toRowId: string) => {
        // Handle drop zone IDs (they have "drop-" prefix)
        const actualToRowId = toRowId.startsWith('drop-') ? toRowId.replace('drop-', '') : toRowId;

        setLayoutRows(prev => {
            const fromRow = prev.find(r => r.id === fromRowId);
            const toRow = prev.find(r => r.id === actualToRowId);
            if (!fromRow || !toRow) return prev;

            const section = fromRow.sections.find(s => s.id === sectionId);
            if (!section) return prev;

            if (toRow.sections.length >= 6) {
                toast.error('Mål-rækken har allerede 6 kolonner');
                return prev;
            }

            // If moving the last column from a row, delete the empty row
            if (fromRow.sections.length === 1) {
                return prev
                    .map(r => {
                        if (r.id === actualToRowId) {
                            return { ...r, sections: [...r.sections, section] };
                        }
                        return r;
                    })
                    .filter(r => r.id !== fromRowId); // Remove the now-empty row
            }

            return prev.map(r => {
                if (r.id === fromRowId) {
                    return { ...r, sections: r.sections.filter(s => s.id !== sectionId) };
                }
                if (r.id === actualToRowId) {
                    return { ...r, sections: [...r.sections, section] };
                }
                return r;
            });
        });
        toast.success('Kolonne flyttet');
    };

    // Value reorder handler
    const handleValueReorder = (rowId: string, sectionId: string, activeId: string, overId: string) => {
        setLayoutRows(prev => prev.map(r => {
            if (r.id === rowId) {
                return {
                    ...r,
                    sections: r.sections.map(s => {
                        if (s.id === sectionId && s.valueIds) {
                            const oldIndex = s.valueIds.indexOf(activeId);
                            const newIndex = s.valueIds.indexOf(overId);
                            if (oldIndex !== -1 && newIndex !== -1) {
                                return { ...s, valueIds: arrayMove(s.valueIds, oldIndex, newIndex) };
                            }
                        }
                        return s;
                    })
                };
            }
            return r;
        }));
    };

    // Vertical Axis Configuration
    const [verticalAxisConfig, setVerticalAxisConfig] = useState<VerticalAxisConfig>({
        sectionId: 'vertical-axis',
        sectionType: 'materials',
        groupId: '',
        ui_mode: 'buttons',
        valueIds: [],
        valueSettings: {},
        thumbnailsEnabled: false
    });

    // Image Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTarget, setUploadingTarget] = useState<{ sectionId: string, valueId: string } | null>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingTarget) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${productId}-layout-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;

            // Update State
            if (uploadingTarget.sectionId === 'vertical-axis') {
                setVerticalAxisConfig(prev => ({
                    ...prev,
                    valueSettings: {
                        ...prev.valueSettings,
                        [uploadingTarget.valueId]: {
                            ...(prev.valueSettings?.[uploadingTarget.valueId] || { showThumbnail: true }),
                            customImage: publicUrl,
                            showThumbnail: true // Auto-enable on upload
                        }
                    }
                }));
            } else {
                setLayoutRows(prev => prev.map(row => ({
                    ...row,
                    sections: row.sections.map(section => {
                        if (section.id === uploadingTarget.sectionId) {
                            return {
                                ...section,
                                valueSettings: {
                                    ...section.valueSettings,
                                    [uploadingTarget.valueId]: {
                                        ...(section.valueSettings?.[uploadingTarget.valueId] || { showThumbnail: true }),
                                        customImage: publicUrl,
                                        showThumbnail: true
                                    }
                                }
                            };
                        }
                        return section;
                    })
                })));
            }

            toast.success("Billede uploadet");
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Upload fejlede");
        } finally {
            setUploadingTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const triggerUpload = (sectionId: string, valueId: string) => {
        setUploadingTarget({ sectionId, valueId });
        fileInputRef.current?.click();
    };
    // Selection Targeting
    const [selectedTarget, setSelectedTarget] = useState<{ type: 'vertical' | 'section', id: string } | null>(null);

    // Variant pricing group (only one can be active for pricing)
    const [pricingVariantGroupId, setPricingVariantGroupId] = useState<string | null>(null);

    // Oplag state
    const [selectedOplag, setSelectedOplag] = useState<number[]>([]);
    const [customOplag, setCustomOplag] = useState('');

    // Smart generator state
    const [showGenerator, setShowGenerator] = useState(false);
    const [genSelectedFormat, setGenSelectedFormat] = useState<string>('');
    const [genSelectedMaterial, setGenSelectedMaterial] = useState<string>('');
    const [genSelectedVariant, setGenSelectedVariant] = useState<string>('');
    // NEW: Per-section selection state (sectionId -> valueId) - collision-proof
    // This replaces the single genSelectedVariant for multi-section layouts
    const [selectedSectionValues, setSelectedSectionValues] = useState<Record<string, string>>({});
    // Generator prices keyed by "formatId-materialId-qty" for full price list building
    const [generatorPrices, setGeneratorPrices] = useState<Record<string, { price: number; markup: number; isLocked?: boolean; excludeFromCurve?: boolean }>>({});
    const [anchorPage, setAnchorPage] = useState(0);
    const [previewAmountPage, setPreviewAmountPage] = useState(0);
    const [genRounding, setGenRounding] = useState(1);
    const [productMarkups, setProductMarkups] = useState<Record<string, number>>({});
    const [generatedPreview, setGeneratedPreview] = useState<{ quantity: number; price: number }[]>([]);
    const [matrixEditMode, setMatrixEditMode] = useState(false);
    const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState('');

    // Generator display mode (buttons, dropdown, checkboxes)
    const [generatorDisplayMode, setGeneratorDisplayMode] = useState<FormatDisplayMode>('buttons');
    // Combination status tracking: key = "formatId-materialId-variantId", value = 'pristine' | 'in_progress' | 'done'
    const [combinationStatus, setCombinationStatus] = useState<Record<string, 'pristine' | 'in_progress' | 'done'>>({});
    const [copySourceKey, setCopySourceKey] = useState<string>('');

    const [importedData, setImportedData] = useState<any[]>([]);
    const [importHeaders, setImportHeaders] = useState<string[]>([]);
    const importHeadersRef = useRef<string[]>([]);
    const importedDataRef = useRef<string[][]>([]);

    useEffect(() => {
        importHeadersRef.current = importHeaders;
    }, [importHeaders]);

    useEffect(() => {
        importedDataRef.current = importedData;
    }, [importedData]);

    useEffect(() => {
        if (!matrixEditMode) {
            setEditingPriceKey(null);
            setEditingPriceValue('');
        }
    }, [matrixEditMode]);

    const verticalSectionId = verticalAxisConfig.sectionId || 'vertical-axis';

    useEffect(() => {
        setSelectedSectionValues(prev => {
            let changed = false;
            const next = { ...prev };

            if (verticalAxisConfig.valueIds && verticalAxisConfig.valueIds.length > 0) {
                const current = next[verticalSectionId];
                if (!current || !verticalAxisConfig.valueIds.includes(current)) {
                    next[verticalSectionId] = verticalAxisConfig.valueIds[0];
                    changed = true;
                }
            }

            layoutRows.forEach(row => {
                row.sections.forEach(section => {
                    if (!section.valueIds || section.valueIds.length === 0) return;
                    const current = next[section.id];
                    const isOptional = section.selection_mode === 'optional';
                    const isValid = !!current && section.valueIds.includes(current);

                    if (!isValid) {
                        if (isOptional) {
                            if (current) {
                                delete next[section.id];
                                changed = true;
                            }
                        } else {
                            next[section.id] = section.valueIds[0];
                            changed = true;
                        }
                    }
                });
            });

            // Keep optional finish rows mutually exclusive (at most one selected).
            const optionalFinishSectionIds = layoutRows
                .flatMap(row => row.sections)
                .filter(section => section.sectionType === 'finishes' && section.selection_mode === 'optional')
                .map(section => section.id);
            const selectedOptionalFinishIds = optionalFinishSectionIds.filter(sectionId => !!next[sectionId]);
            if (selectedOptionalFinishIds.length > 1) {
                selectedOptionalFinishIds.slice(1).forEach(sectionId => {
                    delete next[sectionId];
                    changed = true;
                });
            }

            const validSectionIds = new Set<string>([verticalSectionId]);
            layoutRows.forEach(row => {
                row.sections.forEach(section => validSectionIds.add(section.id));
            });
            Object.keys(next).forEach(sectionId => {
                if (!validSectionIds.has(sectionId)) {
                    delete next[sectionId];
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [layoutRows, verticalAxisConfig.sectionId, verticalAxisConfig.valueIds, verticalAxisConfig.sectionType, verticalSectionId]);

    const getVariantKeyFromSelections = (selections: Record<string, string>) => {
        const ids: string[] = [];
        const finishSections = layoutRows
            .flatMap(row => row.sections)
            .filter(section => section.sectionType === 'finishes' && section.ui_mode !== 'hidden');

        let activeFinish: string | null = null;
        const optionalFinishSections = finishSections.filter(section => section.selection_mode === 'optional');
        for (const section of optionalFinishSections) {
            const selected = selections[section.id];
            if (selected) {
                activeFinish = selected;
                break;
            }
        }
        if (!activeFinish) {
            const requiredFinish = finishSections.find(section => section.selection_mode !== 'optional');
            if (requiredFinish && selections[requiredFinish.id]) {
                activeFinish = selections[requiredFinish.id];
            } else {
                for (const section of finishSections) {
                    if (selections[section.id]) {
                        activeFinish = selections[section.id];
                        break;
                    }
                }
            }
        }

        layoutRows.forEach(row => {
            row.sections.forEach(section => {
                if (section.sectionType === 'formats' || section.sectionType === 'materials' || section.sectionType === 'finishes') return;
                const selected = selections[section.id];
                if (selected) ids.push(selected);
            });
        });

        if (activeFinish) ids.push(activeFinish);
        if (ids.length === 0) return genSelectedVariant || 'none';
        return ids.sort().join('|');
    };

    const getFirstSelectionByType = (sectionType: string, selections: Record<string, string>) => {
        for (const row of layoutRows) {
            for (const section of row.sections) {
                if (section.sectionType !== sectionType) continue;
                if (section.ui_mode === 'hidden') continue;
                const selected = selections[section.id];
                if (selected) return selected;
                if (section.valueIds && section.valueIds.length > 0) return section.valueIds[0];
                const group = productAttrs.groups.find(g => g.id === section.groupId);
                const fallback = group?.values?.find(v => v.enabled)?.id;
                if (fallback) return fallback;
            }
        }
        return '';
    };

    const getDefaultValueId = (kind: 'format' | 'material' | 'finish') => {
        const groupKind = kind === 'finish' ? 'finish' : kind;
        for (const group of productAttrs.groups) {
            if (group.kind !== groupKind) continue;
            const val = group.values?.find(v => v.enabled);
            if (val) return val.id;
        }
        return '';
    };

    const getValueNameById = (valueId: string) => {
        for (const group of productAttrs.groups) {
            const match = group.values?.find(v => v.id === valueId);
            if (match) return match.name;
        }
        return '';
    };

    const buildCombinationLabel = (formatId: string, materialId: string, variantId: string) => {
        const formatName = getValueNameById(formatId) || 'Format';
        const materialName = getValueNameById(materialId) || 'Materiale';
        if (!variantId || variantId === 'none') {
            return `${formatName} · ${materialName}`;
        }
        const variantNames = variantId.split('|')
            .map(id => getValueNameById(id))
            .filter(Boolean);
        const variantLabel = variantNames.length ? variantNames.join(' + ') : variantId;
        return `${formatName} · ${materialName} · ${variantLabel}`;
    };

    const getActiveFormatId = (selections: Record<string, string>) => {
        if (verticalAxisConfig.sectionType === 'formats') {
            return selections[verticalSectionId] || getDefaultValueId('format');
        }
        return getFirstSelectionByType('formats', selections) || getDefaultValueId('format');
    };

    const getActiveMaterialId = (selections: Record<string, string>) => {
        if (verticalAxisConfig.sectionType === 'materials') {
            return selections[verticalSectionId] || getDefaultValueId('material');
        }
        return getFirstSelectionByType('materials', selections) || getDefaultValueId('material');
    };

    // Helper to get current combination key
    const getCurrentCombinationKey = () => {
        const activeFormat = getActiveFormatId(selectedSectionValues);
        const activeMaterial = getActiveMaterialId(selectedSectionValues);
        const activeVariant = getVariantKeyFromSelections(selectedSectionValues);
        return `${activeFormat || 'none'}-${activeMaterial || 'none'}-${activeVariant || 'none'}`;
    };

    // Cycle combination status: pristine → in_progress → done → pristine
    const cycleCombinationStatus = () => {
        const key = getCurrentCombinationKey();
        const currentStatus = combinationStatus[key] || 'pristine';

        let newStatus: 'pristine' | 'in_progress' | 'done';
        if (currentStatus === 'pristine') {
            newStatus = 'in_progress';
        } else if (currentStatus === 'in_progress') {
            newStatus = 'done';
        } else {
            newStatus = 'pristine';
        }

        setCombinationStatus(prev => ({ ...prev, [key]: newStatus }));
    };

    // Get status for a specific combination
    const getCombinationStatus = (formatId: string, materialId: string, variantId: string = 'none') => {
        const key = `${formatId}-${materialId}-${variantId}`;
        return combinationStatus[key] || 'pristine';
    };

    // Get current status for the active combination
    const getCurrentCombinationStatusValue = () => {
        const activeFormat = getActiveFormatId(selectedSectionValues);
        const activeMaterial = getActiveMaterialId(selectedSectionValues);
        const activeVariant = getVariantKeyFromSelections(selectedSectionValues);
        return getCombinationStatus(activeFormat || 'none', activeMaterial || 'none', activeVariant || 'none');
    };



    // Save/Bank State
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDialog, setShowLoadDialog] = useState(false);

    // Icon Picker State
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [pickingForValueId, setPickingForValueId] = useState<string | null>(null);

    // Template Library State
    const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);

    // Attribute Library State (Materials, Finishes, Products)
    const [showCreateMaterialDialog, setShowCreateMaterialDialog] = useState(false);
    const [showCreateFinishDialog, setShowCreateFinishDialog] = useState(false);
    const [showCreateProductDialog, setShowCreateProductDialog] = useState(false);
    const [libraryPanel, setLibraryPanel] = useState<'material' | 'finish' | 'product' | 'format'>('material');
    // Key used to force re-fetch of library browsers
    const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
    const hasLoadedStructureRef = useRef(false);
    const hasLoadedPublishedPricesRef = useRef(false);
    const storageTrimWarnedRef = useRef(false);
    const storageQuotaWarnedRef = useRef(false);
    const [savingMaterialLibrary, setSavingMaterialLibrary] = useState(false);
    const [savingFormatLibrary, setSavingFormatLibrary] = useState(false);



    const [saveName, setSaveName] = useState('');
    const [saveIsBank, setSaveIsBank] = useState(false);
    const [bankTemplates, setBankTemplates] = useState<any[]>([]);
    const [allTemplates, setAllTemplates] = useState<any[]>([]);
    const [showAllTemplates, setShowAllTemplates] = useState(false);
    const lastImportedPricesRef = useRef<Record<string, any>>({});
    const lastImportedOplagRef = useRef<number[]>([]);

    const fetchAllGenericProductPrices = useCallback(async () => {
        if (!productId) return [] as any[];
        const pageSize = 1000;
        let offset = 0;
        const allRows: any[] = [];

        while (true) {
            const { data, error } = await supabase
                .from('generic_product_prices')
                .select('quantity, price_dkk, extra_data')
                .eq('product_id', productId)
                .range(offset, offset + pageSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allRows.push(...data);
            if (data.length < pageSize) break;
            offset += pageSize;
        }

        return allRows;
    }, [productId]);

    const fetchTemplates = async () => {
        if (!productId) return;
        const { data } = await supabase.from('price_list_templates' as any).select('*').eq('product_id', productId).order('created_at', { ascending: false });
        setBankTemplates(data || []);
    };

    const fetchAllTemplates = async () => {
        if (!tenantId) return;
        const { data } = await supabase
            .from('price_list_templates' as any)
            .select('*, product:products(name)' as any)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
        setAllTemplates(data || []);
    };

    const getMaterialKey = (name: string, category?: string | null) =>
        `${name.trim().toLowerCase()}|${(category || '').trim().toLowerCase()}`;

    const getFormatKey = (name: string, width?: number | null, height?: number | null, category?: string | null) =>
        `${name.trim().toLowerCase()}|${width ?? 'null'}|${height ?? 'null'}|${(category || '').trim().toLowerCase()}`;

    const handleSaveMaterialsToLibrary = async () => {
        const materialGroups = productAttrs.groups.filter(g => g.kind === 'material');
        const candidates = materialGroups.flatMap(group =>
            (group.values || []).map(value => ({
                name: value.name?.trim() || '',
                category: group.name || 'Materialer',
                template_type: 'material',
                width_mm: 0,
                height_mm: 0,
                is_active: true,
                is_public: false,
                description: null,
                weight_gsm: value.meta?.weight_gsm ?? null
            }))
        ).filter(item => item.name.length > 0);

        if (candidates.length === 0) {
            toast.error('Ingen materialer med navn at gemme');
            return;
        }

        setSavingMaterialLibrary(true);
        try {
            const { data: existing, error } = await supabase
                .from('designer_templates' as any)
                .select('id,name,category')
                .eq('template_type', 'material')
                .eq('is_active', true);

            if (error) throw error;

            const existingMap = new Map(
                (existing || []).map((row: any) => [getMaterialKey(row.name, row.category), row])
            );
            const uniqueCandidates = new Map<string, any>();
            candidates.forEach(item => {
                const key = getMaterialKey(item.name, item.category);
                if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, item);
            });

            const rows = Array.from(uniqueCandidates.values());
            const updates = rows
                .filter(row => existingMap.has(getMaterialKey(row.name, row.category)))
                .map(row => ({ ...row, id: existingMap.get(getMaterialKey(row.name, row.category)).id }));
            const inserts = rows.filter(row => !existingMap.has(getMaterialKey(row.name, row.category)));

            if (updates.length) {
                const { error: updateError } = await supabase
                    .from('designer_templates' as any)
                    .upsert(updates, { onConflict: 'id' });
                if (updateError) throw updateError;
            }
            if (inserts.length) {
                const { error: insertError } = await supabase
                    .from('designer_templates' as any)
                    .insert(inserts);
                if (insertError) throw insertError;
            }

            const newCount = inserts.length;
            const updateCount = updates.length;
            if (newCount && updateCount) {
                toast.success(`Gemt ${newCount} og opdateret ${updateCount} materiale(r)`);
            } else if (updateCount) {
                toast.success(`Opdateret ${updateCount} materiale(r) i biblioteket`);
            } else {
                toast.success(`Gemt ${newCount} materiale(r) i biblioteket`);
            }
            setLibraryRefreshKey(k => k + 1);
        } catch (err: any) {
            console.error('Error saving materials to library:', err);
            toast.error(err.message || 'Kunne ikke gemme materialer');
        } finally {
            setSavingMaterialLibrary(false);
        }
    };

    const handleSaveFormatsToLibrary = async () => {
        const formatGroups = productAttrs.groups.filter(g => g.kind === 'format');
        const candidates = formatGroups.flatMap(group =>
            (group.values || []).map(value => ({
                name: value.name?.trim() || '',
                category: group.name || 'Format',
                template_type: 'format',
                width_mm: value.width_mm ?? null,
                height_mm: value.height_mm ?? null,
                bleed_mm: value.meta?.bleed_mm ?? 3,
                safe_area_mm: value.meta?.safe_area_mm ?? 3,
                is_active: true,
                is_public: false,
                description: 'Oprettet fra Produktbygger'
            }))
        ).filter(item => item.name.length > 0 && item.width_mm && item.height_mm);

        if (candidates.length === 0) {
            toast.error('Ingen formater med størrelse at gemme');
            return;
        }

        setSavingFormatLibrary(true);
        try {
            const { data: existing, error } = await supabase
                .from('designer_templates' as any)
                .select('id,name,category,width_mm,height_mm')
                .eq('template_type', 'format')
                .eq('is_active', true);

            if (error) throw error;

            const existingMap = new Map(
                (existing || []).map((row: any) => [getFormatKey(row.name, row.width_mm, row.height_mm, row.category), row])
            );
            const uniqueCandidates = new Map<string, any>();
            candidates.forEach(item => {
                const key = getFormatKey(item.name, item.width_mm, item.height_mm, item.category);
                if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, item);
            });

            const rows = Array.from(uniqueCandidates.values());
            const updates = rows
                .filter(row => existingMap.has(getFormatKey(row.name, row.width_mm, row.height_mm, row.category)))
                .map(row => ({ ...row, id: existingMap.get(getFormatKey(row.name, row.width_mm, row.height_mm, row.category)).id }));
            const inserts = rows.filter(row => !existingMap.has(getFormatKey(row.name, row.width_mm, row.height_mm, row.category)));

            if (updates.length) {
                const { error: updateError } = await supabase
                    .from('designer_templates' as any)
                    .upsert(updates, { onConflict: 'id' });
                if (updateError) throw updateError;
            }
            if (inserts.length) {
                const { error: insertError } = await supabase
                    .from('designer_templates' as any)
                    .insert(inserts);
                if (insertError) throw insertError;
            }

            const newCount = inserts.length;
            const updateCount = updates.length;
            if (newCount && updateCount) {
                toast.success(`Gemt ${newCount} og opdateret ${updateCount} format(er)`);
            } else if (updateCount) {
                toast.success(`Opdateret ${updateCount} format(er) i biblioteket`);
            } else {
                toast.success(`Gemt ${newCount} format(er) i biblioteket`);
            }
            setLibraryRefreshKey(k => k + 1);
        } catch (err: any) {
            console.error('Error saving formats to library:', err);
            toast.error(err.message || 'Kunne ikke gemme formater');
        } finally {
            setSavingFormatLibrary(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [productId]);

    useEffect(() => {
        if (showAllTemplates) {
            fetchAllTemplates();
        }
    }, [showAllTemplates, tenantId]);


    const [savingTemplate, setSavingTemplate] = useState(false);
    const [masterMarkup, setMasterMarkup] = useState(0);

    // Price list preview state (frontend-style)
    const [previewSelectedFormat, setPreviewSelectedFormat] = useState<string | null>(null);

    // Load persisted config on mount (includes generator prices for persistence)
    useEffect(() => {
        const storageKey = CONFIG_STORAGE_KEY + productId;
        let stored: string | null = null;
        try {
            stored = localStorage.getItem(storageKey);
        } catch (error) {
            console.warn('[ProductAttributeBuilder] Could not read localStorage config', error);
            return;
        }

        if (stored) {
            try {
                const cfg = JSON.parse(stored);
                if (cfg.sizeMode) setSizeMode(cfg.sizeMode);
                if (cfg.formatDisplayMode) setFormatDisplayMode(cfg.formatDisplayMode);
                if (cfg.maxWidthMm) setMaxWidthMm(cfg.maxWidthMm);
                if (cfg.maxHeightMm) setMaxHeightMm(cfg.maxHeightMm);
                if (cfg.pricingVariantGroupId) setPricingVariantGroupId(cfg.pricingVariantGroupId);
                // Layout is now restored for better persistence
                if (cfg.layoutRows) setLayoutRows(cfg.layoutRows);
                if (cfg.verticalAxisConfig) setVerticalAxisConfig(cfg.verticalAxisConfig);
                // Restore generator state (prices, oplag) for persistence
                if (cfg.selectedOplag) setSelectedOplag(cfg.selectedOplag);
                if (cfg.generatorPrices) setGeneratorPrices(cfg.generatorPrices);
                if (cfg.productMarkups) setProductMarkups(cfg.productMarkups);
                if (cfg.masterMarkup !== undefined) setMasterMarkup(cfg.masterMarkup);
                if (cfg.genRounding) setGenRounding(cfg.genRounding);
            } catch { }
        }
    }, [productId]);

    // Persist config changes (including generator state for full persistence)
    useEffect(() => {
        if (!hasLoadedStructureRef.current) return;
        const trimmedGeneratorPrices = trimGeneratorPricesForStorage(generatorPrices);
        const generatorWasTrimmed = Object.keys(trimmedGeneratorPrices).length < Object.keys(generatorPrices).length;

        const cfg = {
            sizeMode,
            formatDisplayMode,
            maxWidthMm,
            maxHeightMm,
            pricingVariantGroupId,
            verticalAxisConfig,
            layoutRows,
            // Generator state for persistence
            selectedOplag,
            generatorPrices: trimmedGeneratorPrices,
            productMarkups,
            masterMarkup,
            genRounding,
        };
        const storageKey = CONFIG_STORAGE_KEY + productId;
        try {
            localStorage.setItem(storageKey, JSON.stringify(cfg));
            if (generatorWasTrimmed && !storageTrimWarnedRef.current) {
                storageTrimWarnedRef.current = true;
                console.info('[ProductAttributeBuilder] Local product cache was trimmed to stay within browser limits.');
            }
        } catch (error) {
            if (!isQuotaExceededError(error)) {
                console.warn('[ProductAttributeBuilder] Failed to persist local config', error);
                return;
            }

            // Quota fallback: persist a compact config instead of crashing render.
            const compactCfg = {
                sizeMode,
                formatDisplayMode,
                maxWidthMm,
                maxHeightMm,
                pricingVariantGroupId,
                verticalAxisConfig,
                layoutRows,
                selectedOplag,
                masterMarkup,
                genRounding,
            };

            try {
                localStorage.setItem(storageKey, JSON.stringify(compactCfg));
            } catch (fallbackError) {
                console.warn('[ProductAttributeBuilder] Failed to persist compact local config', fallbackError);
            }

            if (!storageQuotaWarnedRef.current) {
                storageQuotaWarnedRef.current = true;
                toast.warning('Browser-lager er næsten fuldt. Lokal cache blev gjort mindre for dette produkt.');
            }
        }
    }, [sizeMode, formatDisplayMode, maxWidthMm, maxHeightMm, pricingVariantGroupId, verticalAxisConfig, layoutRows, productId, selectedOplag, generatorPrices, productMarkups, masterMarkup, genRounding]);

    const buildPricingStructure = useCallback(() => {
        const verticalGroup = productAttrs.groups.find(g => {
            if (verticalAxisConfig.sectionType === 'formats') return g.kind === 'format';
            if (verticalAxisConfig.sectionType === 'materials') return g.kind === 'material';
            if (verticalAxisConfig.sectionType === 'finishes') return g.kind === 'finish';
            return false;
        });

        return {
            mode: 'matrix_layout_v1' as const,
            version: 1,
            vertical_axis: {
                sectionId: verticalAxisConfig.sectionId || 'vertical-axis',
                sectionType: verticalAxisConfig.sectionType,
                groupId: verticalGroup?.id || verticalAxisConfig.groupId || '',
                valueIds: verticalAxisConfig.valueIds || [],
                ui_mode: verticalAxisConfig.ui_mode || 'buttons',
                valueSettings: verticalAxisConfig.valueSettings || {},
                title: verticalAxisConfig.title || '',
                description: verticalAxisConfig.description || ''
            },
            layout_rows: layoutRows.map(row => ({
                id: row.id,
                title: row.title || '',
                description: row.description || '',
                columns: row.sections.map(sec => {
                    const secKind = sec.sectionType === 'formats' ? 'format' :
                        sec.sectionType === 'materials' ? 'material' :
                            sec.sectionType === 'finishes' ? 'finish' : 'other';
                    const grp = productAttrs.groups.find(g =>
                        g.kind === secKind &&
                        (sec.groupId === g.id || sec.valueIds?.some(vId => g.values?.some(v => v.id === vId)))
                    );
                    return {
                        id: sec.id,
                        sectionType: sec.sectionType,
                        groupId: grp?.id || sec.groupId || '',
                        valueIds: sec.valueIds || [],
                        ui_mode: sec.ui_mode || 'buttons',
                        selection_mode: sec.selection_mode || 'required',
                        valueSettings: sec.valueSettings || {},
                        title: sec.title || '',
                        description: sec.description || ''
                    };
                })
            })),
            quantities: selectedOplag.sort((a, b) => a - b)
        };
    }, [layoutRows, productAttrs.groups, selectedOplag, verticalAxisConfig]);

    const buildFallbackStructureFromTemplate = useCallback((spec: any) => {
        const generatorState = spec?.generator_state;
        const generatorPricesFromSpec = generatorState?.generatorPrices;
        if (!generatorPricesFromSpec) return null;

        const formatIds = new Set<string>();
        const materialIds = new Set<string>();
        const variantIds = new Set<string>();

        Object.keys(generatorPricesFromSpec).forEach((key) => {
            const parts = key.split('::');
            if (parts.length < 3) return;
            const formatId = parts[0];
            const materialId = parts[1];
            const variantId = parts.length >= 4 ? parts[2] : 'none';

            if (formatId) formatIds.add(formatId);
            if (materialId) materialIds.add(materialId);
            if (variantId && variantId !== 'none') variantIds.add(variantId);
        });

        if (formatIds.size === 0 || materialIds.size === 0) return null;

        const findGroupByValueIds = (kind: string, ids: Set<string>) => {
            const idSet = new Set(ids);
            return productAttrs.groups.find(g =>
                g.kind === kind && (g.values || []).some(v => idSet.has(v.id))
            );
        };

        const materialGroup = findGroupByValueIds('material', materialIds);
        const formatGroup = findGroupByValueIds('format', formatIds);
        const variantGroup = variantIds.size > 0
            ? productAttrs.groups.find(g => (g.values || []).some(v => variantIds.has(v.id)))
            : null;

        const variantSectionType: AttributeType | null = variantGroup
            ? (variantGroup.kind === 'finish' ? 'finishes' : 'products')
            : null;

        if (variantGroup?.id) {
            setPricingVariantGroupId(variantGroup.id);
        }

        return {
            mode: 'matrix_layout_v1' as const,
            version: 1,
            vertical_axis: {
                sectionId: 'vertical-axis',
                sectionType: 'materials',
                groupId: materialGroup?.id || '',
                valueIds: Array.from(materialIds),
                ui_mode: 'buttons',
                valueSettings: {},
                title: '',
                description: ''
            },
            layout_rows: [
                {
                    id: 'row-1',
                    title: '',
                    description: '',
                    columns: [
                        {
                            id: 'section-1',
                            sectionType: 'formats',
                            groupId: formatGroup?.id || '',
                            valueIds: Array.from(formatIds),
                            ui_mode: 'buttons',
                            selection_mode: 'required',
                            valueSettings: {},
                            title: '',
                            description: ''
                        },
                        ...(variantSectionType && variantGroup
                            ? [{
                                id: 'section-2',
                                sectionType: variantSectionType,
                                groupId: variantGroup.id,
                                valueIds: Array.from(variantIds),
                                ui_mode: 'buttons',
                                selection_mode: 'optional',
                                valueSettings: {},
                                title: '',
                                description: ''
                            }]
                            : [])
                    ]
                }
            ],
            quantities: (spec?.oplag || generatorState?.selectedOplag || []).sort((a: number, b: number) => a - b)
        };
    }, [productAttrs.groups]);

    const normalizeGeneratorPrices = useCallback((prices: Record<string, any>) => {
        if (!prices || Object.keys(prices).length === 0) return prices;
        const normalized: Record<string, any> = {};
        Object.entries(prices).forEach(([key, value]) => {
            if (typeof value === 'number') {
                normalized[key] = { price: value, markup: 0, isLocked: false };
                return;
            }
            if (!value || typeof value !== 'object') {
                normalized[key] = value;
                return;
            }
            const priceValue = typeof value.price === 'number' ? value.price : 0;
            const markupValue = typeof value.markup === 'number' ? value.markup : 0;
            const isLocked = typeof value.isLocked === 'boolean' ? value.isLocked : false;
            normalized[key] = { ...value, price: priceValue, markup: markupValue, isLocked };
        });
        return normalized;
    }, []);

    const buildGeneratorPricesFromMap = useCallback((priceMap: Record<string, any>) => {
        if (!priceMap || Object.keys(priceMap).length === 0) return null;
        const prices: Record<string, any> = {};
        const quantities = new Set<number>();

        Object.entries(priceMap).forEach(([key, value]) => {
            if (!key.includes('::')) return;
            const parts = key.split('::');
            if (parts.length < 3) return;
            const qtyStr = parts.length >= 4 ? parts[3] : parts[2];
            const qty = Number(qtyStr);
            const price = typeof value === 'number' ? value : (value?.price ?? value?.value);
            if (!qty || !price) return;
            const normalizedKey = parts.length >= 4 ? key : `${parts[0]}::${parts[1]}::none::${qty}`;
            prices[normalizedKey] = { price, markup: 0, isLocked: true };
            quantities.add(qty);
        });

        if (Object.keys(prices).length === 0) return null;

        return {
            prices: normalizeGeneratorPrices(prices),
            quantities: Array.from(quantities).sort((a, b) => a - b)
        };
    }, [normalizeGeneratorPrices]);

    const buildGeneratorPricesFromRows = useCallback((rows: any[], spec?: any) => {
        if (!rows || rows.length === 0) return null;
        const prices: Record<string, any> = {};
        const quantities = new Set<number>();

        const parseNumber = (value: any) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value !== 'string') return null;
            const cleaned = value
                .replace(/\s+/g, '')
                .replace(/kr|dkk/gi, '')
                .replace(/\./g, '')
                .replace(',', '.')
                .replace(/[^\d.-]/g, '');
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : null;
        };

        const buildNameLookup = (kind: string) => {
            const map = new Map<string, string>();
            productAttrs.groups
                .filter(g => g.kind === kind)
                .flatMap(g => g.values || [])
                .forEach(v => map.set(v.name.toLowerCase(), v.id));
            return map;
        };

        const formatNameLookup = buildNameLookup('format');
        const materialNameLookup = buildNameLookup('material');
        const variantNameLookup = new Map<string, string>();
        productAttrs.groups
            .filter(g => g.kind === 'finish' || g.kind === 'custom')
            .flatMap(g => g.values || [])
            .forEach(v => variantNameLookup.set(v.name.toLowerCase(), v.id));

        const resolveIdFromRow = (row: any, kind: 'format' | 'material' | 'variant') => {
            const idKeys = kind === 'format'
                ? ['formatId', 'format_id']
                : kind === 'material'
                    ? ['materialId', 'material_id']
                    : ['variantId', 'variant_id'];
            const nameKeys = kind === 'format'
                ? ['formatName', 'format_name', 'format']
                : kind === 'material'
                    ? ['materialName', 'material_name', 'material']
                    : ['variantName', 'variant_name', 'variant'];

            for (const key of idKeys) {
                const val = row?.[key];
                if (typeof val === 'string' && val) return val;
                if (val?.id) return val.id;
            }

            for (const key of nameKeys) {
                const val = row?.[key];
                if (typeof val === 'string' && val) {
                    const lookup = kind === 'format' ? formatNameLookup : kind === 'material' ? materialNameLookup : variantNameLookup;
                    return lookup.get(val.toLowerCase()) || '';
                }
                if (val?.name) {
                    const lookup = kind === 'format' ? formatNameLookup : kind === 'material' ? materialNameLookup : variantNameLookup;
                    return lookup.get(val.name.toLowerCase()) || '';
                }
            }

            const valueEntries = row?.values || row?.options || row?.variants || [];
            if (Array.isArray(valueEntries)) {
                for (const entry of valueEntries) {
                    const entryId = entry?.id;
                    const entryName = entry?.name;
                    const groupId = entry?.group_id || entry?.groupId;
                    if (groupId) {
                        const group = productAttrs.groups.find(g => g.id === groupId);
                        if (!group) continue;
                        if (kind === 'format' && group.kind === 'format') return entryId || '';
                        if (kind === 'material' && group.kind === 'material') return entryId || '';
                        if (kind === 'variant' && (group.kind === 'finish' || group.kind === 'custom')) return entryId || '';
                    }
                    if (entryName && typeof entryName === 'string') {
                        const lookup = kind === 'format' ? formatNameLookup : kind === 'material' ? materialNameLookup : variantNameLookup;
                        const found = lookup.get(entryName.toLowerCase());
                        if (found) return found;
                    }
                }
            }

            return '';
        };

        rows.forEach((row) => {
            const formatId = resolveIdFromRow(row, 'format');
            const materialId = resolveIdFromRow(row, 'material');
            const variantKey = resolveIdFromRow(row, 'variant') || 'none';
            if (!formatId || !materialId) return;

            const rawPrices = row.prices ?? row.price_by_quantity ?? row.priceByQuantity ?? row.pricesByQty ?? row.price_table;
            const rowQuantities = row.quantities || row.oplag || spec?.oplag || spec?.quantities;

            if (Array.isArray(rawPrices)) {
                rawPrices.forEach((entry: any, idx: number) => {
                    if (entry && typeof entry === 'object' && ('quantity' in entry || 'qty' in entry)) {
                        const qty = parseNumber(entry.quantity ?? entry.qty);
                        const price = parseNumber(entry.price ?? entry.value ?? entry.amount);
                        if (!qty || !price) return;
                        const key = `${formatId}::${materialId}::${variantKey || 'none'}::${qty}`;
                        prices[key] = { price, markup: 0, isLocked: true };
                        quantities.add(qty);
                        return;
                    }

                    const qty = Array.isArray(rowQuantities) ? Number(rowQuantities[idx]) : null;
                    const price = parseNumber(entry);
                    if (!qty || !price) return;
                    const key = `${formatId}::${materialId}::${variantKey || 'none'}::${qty}`;
                    prices[key] = { price, markup: 0, isLocked: true };
                    quantities.add(qty);
                });
            } else if (rawPrices && typeof rawPrices === 'object') {
                Object.entries(rawPrices).forEach(([qtyKey, priceVal]) => {
                    const qty = parseNumber(qtyKey);
                    const price = parseNumber((priceVal as any)?.price ?? priceVal);
                    if (!qty || !price) return;
                    const key = `${formatId}::${materialId}::${variantKey || 'none'}::${qty}`;
                    prices[key] = { price, markup: 0, isLocked: true };
                    quantities.add(qty);
                });
            }
        });

        if (Object.keys(prices).length === 0) return null;

        return {
            prices: normalizeGeneratorPrices(prices),
            quantities: Array.from(quantities).sort((a, b) => a - b)
        };
    }, [normalizeGeneratorPrices, productAttrs.groups]);

    const applyPricingStructure = useCallback((structure: any) => {
        if (!structure || structure.mode !== 'matrix_layout_v1') return;
        const vertical = structure.vertical_axis || {};
        const layoutRowsFromStructure = (structure.layout_rows || []).map((row: any, rowIndex: number) => {
            const columns = row.columns || row.sections || [];
            return {
                id: row.id || `row-${rowIndex + 1}`,
                title: row.title || '',
                description: row.description || '',
                sections: columns.map((col: any, colIndex: number) => ({
                    id: col.id || `${row.id || `row-${rowIndex + 1}`}-section-${colIndex + 1}`,
                    sectionType: col.sectionType || 'materials',
                    ui_mode: col.ui_mode || col.uiMode || (col.hidden ? 'hidden' : 'buttons'),
                    selection_mode: col.selection_mode || 'required',
                    groupId: col.groupId || '',
                    valueIds: col.valueIds || [],
                    valueSettings: col.valueSettings || {},
                    thumbnailsEnabled: col.thumbnailsEnabled || false,
                    title: col.title || '',
                    description: col.description || ''
                }))
            };
        });

        setVerticalAxisConfig({
            sectionId: vertical.sectionId || 'vertical-axis',
            sectionType: vertical.sectionType || 'materials',
            groupId: vertical.groupId || '',
            ui_mode: vertical.ui_mode || 'buttons',
            valueIds: vertical.valueIds || [],
            valueSettings: vertical.valueSettings || {},
            thumbnailsEnabled: vertical.thumbnailsEnabled || false,
            title: vertical.title || '',
            description: vertical.description || ''
        });

        if (layoutRowsFromStructure.length > 0) {
            setLayoutRows(layoutRowsFromStructure);
        }

        if (structure.quantities?.length) {
            setSelectedOplag(structure.quantities);
        }

        const hasFormatSection = vertical.sectionType === 'formats' ||
            (structure.layout_rows || []).some((row: any) =>
                (row.columns || row.sections || []).some((col: any) => col.sectionType === 'formats')
            );
        if (hasFormatSection) {
            setSizeMode('format');
        }
    }, [setLayoutRows, setSelectedOplag, setSizeMode, setVerticalAxisConfig]);

    useEffect(() => {
        if (!productId || hasLoadedStructureRef.current) return;

        const loadStructure = async () => {
            const { data } = await supabase
                .from('products')
                .select('pricing_structure' as any)
                .eq('id', productId)
                .maybeSingle();

            const structure = (data as any)?.pricing_structure;
            // Always prefer persisted DB structure over local draft snapshot.
            // This avoids empty/broken layouts when stale localStorage points to removed group/value IDs.
            if (structure?.mode === 'matrix_layout_v1') {
                applyPricingStructure(structure);
            }
            hasLoadedStructureRef.current = true;
        };
        loadStructure();
    }, [applyPricingStructure, productId]);

    // Keep vertical axis values aligned with its section type (avoid mixed formats/materials/products)
    useEffect(() => {
        const kind = verticalAxisConfig.sectionType === 'formats'
            ? 'format'
            : verticalAxisConfig.sectionType === 'materials'
                ? 'material'
                : verticalAxisConfig.sectionType === 'finishes'
                    ? 'finish'
                    : '';

        if (!kind || !verticalAxisConfig.valueIds?.length || productAttrs.groups.length === 0) return;

        const allowedIds = new Set<string>();
        productAttrs.groups
            .filter(g => g.kind === kind)
            .forEach(g => (g.values || []).forEach(v => allowedIds.add(v.id)));

        const nextValueIds = verticalAxisConfig.valueIds.filter(id => allowedIds.has(id));
        if (nextValueIds.length !== verticalAxisConfig.valueIds.length) {
            setVerticalAxisConfig(prev => ({ ...prev, valueIds: nextValueIds }));
        }
    }, [verticalAxisConfig.sectionType, verticalAxisConfig.valueIds, productAttrs.groups]);

    const hasUsableLocalGeneratorPrices = useMemo(() => {
        const keys = Object.keys(generatorPrices || {});
        if (keys.length === 0) return false;

        const formatValueIds = new Set<string>();
        const materialValueIds = new Set<string>();
        const nonAxisValueIds = new Set<string>();
        const seenFormatIds = new Set<string>();
        const seenMaterialIds = new Set<string>();

        productAttrs.groups.forEach(group => {
            (group.values || []).forEach(value => {
                if (group.kind === 'format') {
                    formatValueIds.add(value.id);
                    return;
                }
                if (group.kind === 'material') {
                    materialValueIds.add(value.id);
                    return;
                }
                nonAxisValueIds.add(value.id);
            });
        });

        let validCount = 0;
        let invalidCount = 0;

        keys.forEach((key) => {
            const parts = key.split('::');
            if (parts.length < 4) {
                invalidCount += 1;
                return;
            }

            const [formatId, materialId, variantId, qtyStr] = parts;
            const qty = Number(qtyStr);
            const row = generatorPrices[key] as any;
            const price = typeof row === 'number' ? row : Number(row?.price || 0);

            // Ignore empty/non-price entries; we only validate real price rows.
            if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
                return;
            }

            let valid = true;
            if (!formatValueIds.has(formatId) || !materialValueIds.has(materialId)) {
                valid = false;
            }

            if (variantId && variantId !== 'none') {
                const variantIds = variantId.split('|').filter(Boolean);
                if (variantIds.length === 0 || variantIds.some(id => !nonAxisValueIds.has(id))) {
                    valid = false;
                }
            }

            if (valid) validCount += 1;
            else invalidCount += 1;

            if (valid) {
                seenFormatIds.add(formatId);
                seenMaterialIds.add(materialId);
            }
        });

        // Local cache must cover all known formats/materials or it is likely stale/partial.
        if (formatValueIds.size > 0 && seenFormatIds.size < formatValueIds.size) {
            return false;
        }
        if (materialValueIds.size > 0 && seenMaterialIds.size < materialValueIds.size) {
            return false;
        }

        // If we have at least one valid mapped price row, keep local cache.
        if (validCount > 0) return true;

        // If no valid rows exist, this cache is stale for current layout/IDs.
        return false;
    }, [generatorPrices, productAttrs.groups]);

    useEffect(() => {
        if (!productId || productAttrs.loading) return;
        if (hasLoadedPublishedPricesRef.current) return;

        if (Object.keys(generatorPrices).length > 0 && !hasUsableLocalGeneratorPrices) {
            console.warn('[ProductAttributeBuilder] Ignoring stale local generator cache and reloading published prices');
        }

        const loadPublishedPrices = async () => {
            let data: any[] = [];
            try {
                data = await fetchAllGenericProductPrices();
            } catch {
                hasLoadedPublishedPricesRef.current = true;
                return;
            }

            if (!data || data.length === 0) {
                hasLoadedPublishedPricesRef.current = true;
                return;
            }

            const formatValueIds = new Set<string>();
            const materialValueIds = new Set<string>();
            productAttrs.groups.forEach(group => {
                if (group.kind === 'format') {
                    (group.values || []).forEach(value => formatValueIds.add(value.id));
                }
                if (group.kind === 'material') {
                    (group.values || []).forEach(value => materialValueIds.add(value.id));
                }
            });

            const fallbackPrices: Record<string, any> = {};
            const fallbackOplag = new Set<number>();
            data.forEach((row: any) => {
                const extra = row.extra_data || {};
                const formatId = extra.formatId || extra.selectionMap?.format;
                const materialId = extra.materialId || extra.selectionMap?.material;
                const rawVariantValueIds = Array.isArray(extra.variantValueIds)
                    ? extra.variantValueIds
                    : Array.isArray(extra.selectionMap?.variantValueIds)
                        ? extra.selectionMap.variantValueIds
                        : [];
                const filteredVariantValueIds = rawVariantValueIds
                    .filter((id: string) => !formatValueIds.has(id) && !materialValueIds.has(id));
                const variantId = extra.variantId
                    || extra.selectionMap?.variant
                    || (filteredVariantValueIds.length > 0 ? filteredVariantValueIds.slice().sort().join('|') : 'none');
                if (!formatId || !materialId) return;
                const qty = Number(row.quantity);
                const price = Number(row.price_dkk);
                if (!qty || !price) return;
                const key = `${formatId}::${materialId}::${variantId || 'none'}::${qty}`;
                fallbackPrices[key] = { price, markup: 0, isLocked: false };
                fallbackOplag.add(qty);
            });

            if (Object.keys(fallbackPrices).length > 0) {
                // Merge published prices into local draft cache so missing combinations
                // are restored without overwriting in-progress local edits.
                setGeneratorPrices(prev => {
                    const merged = {
                        ...fallbackPrices,
                        ...(prev || {}),
                    };
                    return normalizeGeneratorPrices(merged);
                });
                if (selectedOplag.length === 0) {
                    setSelectedOplag(Array.from(fallbackOplag).sort((a, b) => a - b));
                }
            }
            hasLoadedPublishedPricesRef.current = true;
        };

        loadPublishedPrices();
    }, [fetchAllGenericProductPrices, productId, productAttrs.loading, generatorPrices, hasUsableLocalGeneratorPrices, normalizeGeneratorPrices, selectedOplag.length]);

    // Transition for non-blocking updates (prevents UI blinking)
    const [isPending, startTransition] = useTransition();

    // ============ CSV Logic ============
    const [importing, setImporting] = useState(false);
    const [pushing, setPushing] = useState(false);

    // Generate CSV Rows (All Combinations currently in Layout)
    const getAllRows = useCallback(() => {
        // Collect all whitelisted value IDs from layout
        const whitelistedIds = new Set<string>();

        // Vertical Axis
        (verticalAxisConfig.valueIds || []).forEach(id => whitelistedIds.add(id));

        // Layout Rows
        layoutRows.forEach(row => {
            row.sections.forEach(section => {
                (section.valueIds || []).forEach(id => whitelistedIds.add(id));
            });
        });

        // 1. Resolve Vertical Axis Groups
        const verticalGroups = productAttrs.groups.filter(g => {
            // Map type ('formats' -> 'format', etc.)
            let kind = '';
            if (verticalAxisConfig.sectionType === 'formats') kind = 'format';
            else if (verticalAxisConfig.sectionType === 'materials') kind = 'material';
            else if (verticalAxisConfig.sectionType === 'finishes') kind = 'finish';
            // Only include if it has whitelisted values
            return g.kind === kind && (g.values || []).some(v => whitelistedIds.has(v.id));
        });

        // 2. Resolve Layout Row Groups (in order)
        const rowGroups: ProductAttributeGroup[] = [];
        layoutRows.forEach(row => {
            row.sections.forEach(section => {
                const sectionKind = section.sectionType === 'formats' ? 'format' :
                    section.sectionType === 'materials' ? 'material' :
                        section.sectionType === 'finishes' ? 'finish' : 'other';

                const groups = productAttrs.groups.filter(g =>
                    g.kind === sectionKind &&
                    (section.groupId === g.id || (g.values || []).some(v => whitelistedIds.has(v.id)))
                );

                groups.forEach(g => {
                    if (!rowGroups.find(rg => rg.id === g.id)) {
                        rowGroups.push(g);
                    }
                });
            });
        });

        // Combine and dedup
        const orderedGroups = [...verticalGroups];
        rowGroups.forEach(g => {
            if (!orderedGroups.find(og => og.id === g.id)) {
                orderedGroups.push(g);
            }
        });

        // Filter groups to only those that have enabled AND whitelisted values
        const activeGroups = orderedGroups
            .map(g => ({
                ...g,
                values: (g.values || []).filter(v => v.enabled && whitelistedIds.has(v.id))
            }))
            .filter(g => g.values.length > 0);

        if (activeGroups.length === 0 || selectedOplag.length === 0) return [];

        const groupValues = activeGroups.map(g => g.values);

        const rows: { values: { label: string; group: string }[] }[] = [];
        const indices = new Array(groupValues.length).fill(0);

        while (true) {
            rows.push({
                values: indices.map((idx, gi) => ({
                    label: groupValues[gi][idx].name,
                    group: activeGroups[gi].name
                }))
            });

            let carry = 1;
            for (let i = indices.length - 1; i >= 0 && carry; i--) {
                indices[i] += carry;
                if (indices[i] >= groupValues[i].length) {
                    indices[i] = 0;
                } else {
                    carry = 0;
                }
            }
            if (carry) break;

            if (rows.length > 50000) {
                toast.error('For mange kombinationer til eksport (>50.000)');
                return [];
            }
        }
        return { rows, groups: activeGroups };
    }, [productAttrs.groups, selectedOplag, layoutRows, verticalAxisConfig]);

    const handleExportCSV = () => {
        // Build meta from current layout configuration
        // This creates a stable, collision-proof CSV format

        // Check for oplag first
        if (selectedOplag.length === 0) {
            toast.error('Vælg mindst ét oplag først.');
            return;
        }

        // 1. Collect vertical axis info
        const verticalGroup = productAttrs.groups.find(g => {
            if (verticalAxisConfig.sectionType === 'formats') return g.kind === 'format';
            if (verticalAxisConfig.sectionType === 'materials') return g.kind === 'material';
            if (verticalAxisConfig.sectionType === 'finishes') return g.kind === 'finish';
            return false;
        });

        // Helper to find any value by ID across all groups
        const findValueById = (valueId: string) => {
            for (const group of productAttrs.groups) {
                const val = group.values?.find(v => v.id === valueId);
                if (val) return val;
            }
            return null;
        };

        // Get vertical axis values - use valueIds if specified, otherwise use all values from matching group
        let verticalValues: any[] = [];
        if (verticalAxisConfig.valueIds && verticalAxisConfig.valueIds.length > 0) {
            // Use explicitly selected valueIds
            verticalValues = verticalAxisConfig.valueIds
                .map(id => findValueById(id))
                .filter(v => v && v.enabled);
        } else if (verticalGroup) {
            // Fallback: use all enabled values from the matching group
            verticalValues = verticalGroup.values.filter(v => v.enabled) || [];
        }

        // If no values exist yet, we'll export a template with placeholder rows
        const noValuesYet = verticalValues.length === 0;

        // 2. Collect all horizontal sections from layout rows
        const sections: Array<{
            sectionId: string;
            groupId: string;
            sectionType: string;
            ui_mode: string;
            selection_mode: SelectionMode;
            name: string;
            values: any[];
        }> = [];

        for (const row of layoutRows) {
            for (const section of row.sections) {
                const sectionKind = section.sectionType === 'formats' ? 'format' :
                    section.sectionType === 'materials' ? 'material' :
                        section.sectionType === 'finishes' ? 'finish' : 'other';

                // Try to find group by explicit reference first
                let group = productAttrs.groups.find(g =>
                    g.kind === sectionKind &&
                    (section.groupId.includes(g.id) || section.valueIds?.some(vId => g.values?.some(v => v.id === vId)))
                );

                // Fallback: if no specific group referenced, use first group of matching kind
                if (!group && sectionKind !== 'other') {
                    group = productAttrs.groups.find(g => g.kind === sectionKind);
                }

                // Get section values - use valueIds directly if specified
                let sectionValues: any[] = [];
                if (section.valueIds && section.valueIds.length > 0) {
                    // Use explicitly selected valueIds - find each value across all groups
                    sectionValues = section.valueIds
                        .map(id => findValueById(id))
                        .filter(v => v && v.enabled);
                } else if (group) {
                    // Fallback: use all enabled values from the matching group
                    sectionValues = group.values.filter(v => v.enabled) || [];
                }

                if (sectionValues.length > 0) {
                    sections.push({
                        sectionId: section.id,
                        groupId: group?.id || '',
                        sectionType: section.sectionType,
                        ui_mode: section.ui_mode || 'buttons',
                        selection_mode: section.selection_mode || 'required',
                        name: section.title || group?.name || section.sectionType,
                        values: sectionValues
                    });
                }
            }
        }

        // 3. Build human-readable headers (disambiguated)
        const nameCounts: Record<string, number> = {};
        sections.forEach(s => { nameCounts[s.name] = (nameCounts[s.name] || 0) + 1; });

        const verticalLabel = verticalAxisConfig.title || verticalGroup?.name ||
            (verticalAxisConfig.sectionType === 'formats' ? 'Format' :
                verticalAxisConfig.sectionType === 'materials' ? 'Materiale' : 'Værdi');

        // 4. Build meta header (used for stable import/multi-row layouts)
        const meta = {
            version: 2,
            vertical_axis: {
                sectionId: verticalAxisConfig.sectionId || 'vertical-axis',
                sectionType: verticalAxisConfig.sectionType,
                groupId: verticalGroup?.id || '',
                label: verticalLabel,
                valueSettings: verticalAxisConfig.valueSettings || {}
            },
            layout_rows: layoutRows.map(row => ({
                id: row.id,
                title: row.title || '',
                description: row.description || '',
                columns: row.sections.map(sec => ({
                    id: sec.id,
                    sectionType: sec.sectionType,
                    groupId: sec.groupId || '',
                    ui_mode: sec.ui_mode || 'buttons',
                    selection_mode: sec.selection_mode || 'required',
                    valueSettings: sec.valueSettings || {},
                    title: sec.title || '',
                    description: sec.description || ''
                }))
            })),
            quantities: selectedOplag.sort((a, b) => a - b)
        };

        let sectionHeaders: string[];

        if (sections.length > 0) {
            // Use actual section names
            sectionHeaders = sections.map(s => {
                if (nameCounts[s.name] > 1) {
                    return `${s.name}__sec_${s.sectionId.substring(0, 8)}`;
                }
                return s.name;
            });
        } else if (noValuesYet && layoutRows.length > 0) {
            // Template mode: generate headers from layout structure
            sectionHeaders = [];
            for (const row of layoutRows) {
                for (const section of row.sections) {
                    // Generate header based on section type
                    const typeLabel = section.title || (section.sectionType === 'formats' ? 'Format' :
                        section.sectionType === 'materials' ? 'Materiale' :
                            section.sectionType === 'finishes' ? 'Efterbehandling' : 'Valgmulighed');
                    sectionHeaders.push(typeLabel);
                }
            }
        } else {
            sectionHeaders = [];
        }

        const humanHeaders = [verticalLabel, ...sectionHeaders, ...selectedOplag.map(q => String(q))];

        // 5. Generate all row combinations
        const csvRows: string[] = [];

        // Row 1: Meta header (stable mapping for layout rows/sections)
        csvRows.push(`#meta;${JSON.stringify(meta)}`);

        // Row 2: Human headers
        csvRows.push(humanHeaders.join(';'));

        // Generate data rows
        if (noValuesYet) {
            // TEMPLATE MODE: No values exist yet, generate placeholder rows
            const verticalPlaceholder = verticalAxisConfig.sectionType === 'formats' ? 'A4' :
                verticalAxisConfig.sectionType === 'materials' ? '135g papir.' : 'Værdi 1';

            // Generate a few placeholder rows
            const placeholderCount = 3;
            for (let i = 1; i <= placeholderCount; i++) {
                const vertLabel = verticalAxisConfig.sectionType === 'formats' ? `Format ${i}` :
                    verticalAxisConfig.sectionType === 'materials' ? `Materiale ${i}` : `Værdi ${i}`;

                const sectionPlaceholders = sections.map((s, idx) => {
                    if (s.sectionType === 'formats') return `Format ${idx + 1}`;
                    if (s.sectionType === 'materials') return `Materiale ${idx + 1}`;
                    if (s.sectionType === 'finishes') return `Efterbehandling ${idx + 1}`;
                    return `Valgmulighed ${idx + 1}`;
                });

                // If no sections, just vertical + quantities
                const cells = sectionPlaceholders.length > 0
                    ? [vertLabel, ...sectionPlaceholders, ...selectedOplag.map(() => '')]
                    : [vertLabel, ...selectedOplag.map(() => '')];

                csvRows.push(cells.join(';'));
            }

            toast.info('Eksporterer skabelon med pladsholdere. Erstat med dine egne værdier.');
        } else {
            // NORMAL MODE: Values exist, generate cartesian product
            const allSectionValues = sections.map(s => {
                if (s.selection_mode === 'optional') {
                    return [{ name: '' }, ...s.values];
                }
                return s.values;
            });

            if (allSectionValues.length === 0 || allSectionValues.every(arr => arr.length === 0)) {
                // No horizontal sections - just vertical axis
                for (const vertVal of verticalValues) {
                    const cells = [vertVal.name, ...selectedOplag.map(() => '')];
                    csvRows.push(cells.join(';'));
                }
            } else {
                // Generate cartesian product
                const cartesian = (arrays: any[][]): any[][] => {
                    if (arrays.length === 0) return [[]];
                    const [first, ...rest] = arrays;
                    if (!first || first.length === 0) return cartesian(rest);
                    const restCombinations = cartesian(rest);
                    return first.flatMap(item => restCombinations.map(combo => [item, ...combo]));
                };

                const sectionCombinations = cartesian(allSectionValues);

                for (const vertVal of verticalValues) {
                    for (const combo of sectionCombinations) {
                        const cells = [
                            vertVal.name,
                            ...combo.map((v: any) => v.name),
                            ...selectedOplag.map(() => '')
                        ];
                        csvRows.push(cells.join(';'));
                    }
                }
            }
        }

        // 6. Export
        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${productSlug || 'produkt'}_prisliste_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(noValuesYet ? 'CSV skabelon eksporteret (udfyld værdierne)' : 'CSV skabelon eksporteret med layout metadata');
    };

    const handleExportCSVWithPrices = () => {
        if (selectedOplag.length === 0) {
            toast.error('Vælg mindst ét oplag først.');
            return;
        }

        // 1. Collect vertical axis info
        const verticalGroup = productAttrs.groups.find(g => {
            if (verticalAxisConfig.sectionType === 'formats') return g.kind === 'format';
            if (verticalAxisConfig.sectionType === 'materials') return g.kind === 'material';
            if (verticalAxisConfig.sectionType === 'finishes') return g.kind === 'finish';
            return false;
        });

        const findValueById = (valueId: string) => {
            for (const group of productAttrs.groups) {
                const val = group.values?.find(v => v.id === valueId);
                if (val) return val;
            }
            return null;
        };

        let verticalValues: any[] = [];
        if (verticalAxisConfig.valueIds && verticalAxisConfig.valueIds.length > 0) {
            verticalValues = verticalAxisConfig.valueIds
                .map(id => findValueById(id))
                .filter(v => v && v.enabled);
        } else if (verticalGroup) {
            verticalValues = verticalGroup.values.filter(v => v.enabled) || [];
        }

        const noValuesYet = verticalValues.length === 0;
        if (noValuesYet) {
            toast.error('Ingen værdier fundet til eksport');
            return;
        }

        // 2. Collect horizontal sections from layout rows
        const sections: Array<{
            sectionId: string;
            groupId: string;
            sectionType: string;
            ui_mode: string;
            selection_mode: SelectionMode;
            name: string;
            values: any[];
        }> = [];

        for (const row of layoutRows) {
            for (const section of row.sections) {
                const sectionKind = section.sectionType === 'formats' ? 'format' :
                    section.sectionType === 'materials' ? 'material' :
                        section.sectionType === 'finishes' ? 'finish' : 'other';

                let group = productAttrs.groups.find(g =>
                    g.kind === sectionKind &&
                    (section.groupId.includes(g.id) || section.valueIds?.some(vId => g.values?.some(v => v.id === vId)))
                );

                if (!group && sectionKind !== 'other') {
                    group = productAttrs.groups.find(g => g.kind === sectionKind);
                }

                let sectionValues: any[] = [];
                if (section.valueIds && section.valueIds.length > 0) {
                    sectionValues = section.valueIds
                        .map(id => findValueById(id))
                        .filter(v => v && v.enabled);
                } else if (group) {
                    sectionValues = group.values.filter(v => v.enabled) || [];
                }

                if (sectionValues.length > 0) {
                    sections.push({
                        sectionId: section.id,
                        groupId: group?.id || '',
                        sectionType: section.sectionType,
                        ui_mode: section.ui_mode || 'buttons',
                        selection_mode: section.selection_mode || 'required',
                        name: section.title || group?.name || section.sectionType,
                        values: sectionValues
                    });
                }
            }
        }

        // 3. Build headers and meta
        const nameCounts: Record<string, number> = {};
        sections.forEach(s => { nameCounts[s.name] = (nameCounts[s.name] || 0) + 1; });

        const verticalLabel = verticalAxisConfig.title || verticalGroup?.name ||
            (verticalAxisConfig.sectionType === 'formats' ? 'Format' :
                verticalAxisConfig.sectionType === 'materials' ? 'Materiale' : 'Værdi');

        const meta = {
            version: 2,
            vertical_axis: {
                sectionId: verticalAxisConfig.sectionId || 'vertical-axis',
                sectionType: verticalAxisConfig.sectionType,
                groupId: verticalGroup?.id || '',
                label: verticalLabel,
                valueSettings: verticalAxisConfig.valueSettings || {}
            },
            layout_rows: layoutRows.map(row => ({
                id: row.id,
                title: row.title || '',
                description: row.description || '',
                columns: row.sections.map(sec => ({
                    id: sec.id,
                    sectionType: sec.sectionType,
                    groupId: sec.groupId || '',
                    ui_mode: sec.ui_mode || 'buttons',
                    selection_mode: sec.selection_mode || 'required',
                    valueSettings: sec.valueSettings || {},
                    title: sec.title || '',
                    description: sec.description || ''
                }))
            })),
            quantities: selectedOplag.sort((a, b) => a - b)
        };

        const sectionHeaders = sections.map(s => {
            if (nameCounts[s.name] > 1) {
                return `${s.name}__sec_${s.sectionId.substring(0, 8)}`;
            }
            return s.name;
        });

        const humanHeaders = [verticalLabel, ...sectionHeaders, ...selectedOplag.map(q => String(q))];

        const csvRows: string[] = [];
        csvRows.push(`#meta;${JSON.stringify(meta)}`);
        csvRows.push(humanHeaders.join(';'));

        const allSectionValues = sections.map(s => {
            if (s.selection_mode === 'optional') {
                return [{ id: '', name: '' }, ...s.values];
            }
            return s.values;
        });

        const cartesian = (arrays: any[][]): any[][] => {
            if (arrays.length === 0) return [[]];
            const [first, ...rest] = arrays;
            if (!first || first.length === 0) return cartesian(rest);
            const restCombinations = cartesian(rest);
            return first.flatMap(item => restCombinations.map(combo => [item, ...combo]));
        };

        const sectionCombinations = allSectionValues.length > 0 ? cartesian(allSectionValues) : [[]];

        const computeExportPrice = (formatId: string, materialId: string, variantId: string, qty: number) => {
            const computed = computeFinalPriceForContext(formatId, materialId, variantId, qty);
            return computed?.price ? String(computed.price) : '';
        };

        for (const vertVal of verticalValues) {
            for (const combo of sectionCombinations) {
                const selectionBySection: Record<string, string> = {
                    [verticalSectionId]: vertVal.id
                };
                combo.forEach((val: any, idx: number) => {
                    const section = sections[idx];
                    if (!section) return;
                    if (val?.id) selectionBySection[section.sectionId] = val.id;
                });

                const formatId = getActiveFormatId(selectionBySection);
                const materialId = getActiveMaterialId(selectionBySection);
                const variantIds: string[] = [];
                layoutRows.forEach(row => {
                    row.sections.forEach(section => {
                        if (section.sectionType === 'formats' || section.sectionType === 'materials') return;
                        const selected = selectionBySection[section.id];
                        if (selected) variantIds.push(selected);
                    });
                });
                const variantId = variantIds.length > 0 ? variantIds.sort().join('|') : 'none';

                const priceCells = selectedOplag.map(qty => computeExportPrice(formatId, materialId, variantId, qty));
                const cells = [
                    vertVal.name,
                    ...combo.map((v: any) => v?.name || ''),
                    ...priceCells
                ];
                csvRows.push(cells.join(';'));
            }
        }

        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${productSlug || 'produkt'}_prisliste_med_priser_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV eksporteret med priser');
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportedData([]);
        setImportHeaders([]);

        try {
            const text = await file.text();
            const lines = text.trim().split(/\r\n|\n|\r/);
            if (lines.length > 0) {
                lines[0] = lines[0].replace(/^\uFEFF/, '');
            }
            if (lines.length < 2) throw new Error('CSV skal indeholde mindst en header og en datarække');

            // Simple, robust detection: Prefer semicolon if header uses it (Danish/EU standard)
            const delimiter = lines[0].indexOf(';') !== -1 ? ';' : ',';

            // Robust Line Parser (Handles quotes)
            const parseLine = (line: string) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === delimiter && !inQuotes) {
                        result.push(current.trim().replace(/^"|"$/g, ''));
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim().replace(/^"|"$/g, ''));
                return result;
            };

            // Check for #meta header
            let csvMeta: any = null;
            let headerLineIndex = 0;
            let dataStartIndex = 1;

            if (lines[0].startsWith('#meta;')) {
                try {
                    const metaJson = lines[0].substring(6); // Remove "#meta;"
                    csvMeta = JSON.parse(metaJson);
                    headerLineIndex = 1;
                    dataStartIndex = 2;
                    toast.info('Layout metadata fundet - bruger stabil kolonne-mapping');
                } catch (e) {
                    console.warn('Failed to parse CSV meta, treating as legacy format');
                }
            }

            const headers = parseLine(lines[headerLineIndex]).map((h, idx) =>
                idx === 0 ? h.replace(/^\uFEFF/, '') : h
            );
            setImportHeaders(headers);

            // Store meta in a ref or state for use by handleApplyImportedPrices
            // We'll pass it via a temporary storage pattern
            (window as any).__csvImportMeta = csvMeta;

            const parsedData = [];
            for (let i = dataStartIndex; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = parseLine(lines[i]);
                if (values.length >= 1) parsedData.push(values);
            }
            setImportedData(parsedData);

            if (parsedData.length > 0) {
                const metaStatus = csvMeta ? ' (med layout metadata)' : ' (legacy format)';
                toast.success(`Importeret ${parsedData.length} rækker${metaStatus}. Behandler data...`);

                // Auto-trigger price processing with explicit data (avoid state races)
                handleApplyImportedPricesWithData(headers, parsedData, csvMeta);
            }
        } catch (error: any) {
            console.error('Import error:', error);
            toast.error('Fejl ved import: ' + error.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    // Helper function to apply prices with explicit data (for auto-trigger after import)
    const handleApplyImportedPricesWithData = async (headers: string[], data: string[][], csvMeta: any) => {
        if (data.length === 0) return;
        console.log('[CSV Import] Processing with headers:', headers);
        console.log('[CSV Import] Data rows:', data.length);
        console.log('[CSV Import] Meta:', csvMeta);

        // Keep UI state in sync, but pass explicit data to avoid async state timing issues
        setImportHeaders(headers);
        setImportedData(data);
        importHeadersRef.current = headers;
        importedDataRef.current = data;

        await handleApplyImportedPrices(headers, data, csvMeta);
    };

    const handlePushLive = async () => {
        if (!tableName || importedData.length === 0) return;
        setPushing(true);
        try {
            const quantityIndices: number[] = [];
            const attributeIndices: number[] = [];

            importHeaders.forEach((h, idx) => {
                if (!isNaN(parseInt(h))) quantityIndices.push(idx);
                else attributeIndices.push(idx);
            });

            if (quantityIndices.length === 0) throw new Error("Ingen oplags-kolonner fundet");

            const inserts = [];
            const columnMappings = attributeIndices.map(idx => {
                const header = importHeaders[idx];
                const dbCol = mapGroupLabelToColumn(header, tableName);
                return { idx, header, dbCol };
            });

            for (const rowValues of importedData) {
                const baseRow: any = { product_id: productId, tenant_id: tenantId };
                // Map attributes
                let variantNameParts = [];
                let variantValueParts = [];

                for (const mapping of columnMappings) {
                    const value = rowValues[mapping.idx]?.replace(/^"|"$/g, '');
                    if (mapping.dbCol) {
                        baseRow[mapping.dbCol] = value;
                    } else if (tableName === 'generic_product_prices') {
                        // Build generic variant
                        variantNameParts.push(mapping.header);
                        variantValueParts.push(value);
                    }
                }

                if (tableName === 'generic_product_prices' && variantNameParts.length > 0) {
                    baseRow.variant_name = variantNameParts.join(', ');
                    baseRow.variant_value = variantValueParts.join(', ');
                }

                for (const qtyIdx of quantityIndices) {
                    const priceRaw = rowValues[qtyIdx]?.replace(/^"|"$/g, '').replace(',', '.').replace(/[^\d.]/g, '');
                    if (priceRaw) {
                        const price = parseFloat(priceRaw);
                        if (!isNaN(price) && price > 0) {
                            inserts.push({
                                ...baseRow,
                                quantity: parseInt(importHeaders[qtyIdx]),
                                price_dkk: price
                            });
                        }
                    }
                }
            }

            if (inserts.length === 0) throw new Error("Ingen gyldige priser fundet");

            // Deduplicate inserts - keep last value for each unique key
            const uniqueInserts = new Map();
            for (const row of inserts) {
                const key = tableName === 'generic_product_prices'
                    ? `${row.product_id}-${row.variant_name || ''}-${row.variant_value || ''}-${row.quantity}`
                    : `${row.product_id}-${row.quantity}`;
                uniqueInserts.set(key, row);
            }
            const dedupedInserts = Array.from(uniqueInserts.values());

            // Upsert with conflict handling based on table type
            const conflictColumns = tableName === 'generic_product_prices'
                ? 'product_id,variant_name,variant_value,quantity'
                : 'product_id,quantity'; // Default for specific product tables

            const { error } = await supabase.from(tableName as any).upsert(dedupedInserts, { onConflict: conflictColumns });
            if (error) throw error;

            toast.success(`Succes! ${dedupedInserts.length} priser udgivet.`);
            setImportedData([]);
            setImportHeaders([]);
            if (onPricesUpdated) onPricesUpdated();
        } catch (error: any) {
            console.error('Push error:', error);
            toast.error('Kunne ikke udgive: ' + error.message);
        } finally {
            setPushing(false);
        }
    };

    /**
     * NEW: Push Live using matrix_layout_v1 format
     * - Saves pricing_structure to product
     * - Writes prices to generic_product_prices with stable variant keys
     */
    const handlePushMatrixLayoutV1 = async () => {
        if (!productId || Object.keys(generatorPrices).length === 0) {
            toast.error('Ingen priser at gemme.');
            return;
        }
        setPushing(true);

        try {
            const generatorKeys = Object.keys(generatorPrices);
            const quantities = selectedOplag.length > 0
                ? selectedOplag
                : Array.from(new Set(generatorKeys.map(key => {
                    const qtyStr = key.split('::').pop() || '';
                    const qty = parseInt(qtyStr, 10);
                    return Number.isNaN(qty) ? null : qty;
                }).filter((qty): qty is number => qty !== null))).sort((a, b) => a - b);

            const verticalGroup = productAttrs.groups.find(g => {
                if (verticalAxisConfig.sectionType === 'formats') return g.kind === 'format';
                if (verticalAxisConfig.sectionType === 'materials') return g.kind === 'material';
                if (verticalAxisConfig.sectionType === 'finishes') return g.kind === 'finish';
                return false;
            });

            const pricingStructure = buildPricingStructure();
            if (pricingStructure) {
                pricingStructure.quantities = quantities;
            }

            // 2. Update product with pricing_structure
            // We use 'as any' because pricing_structure is missing from the Supabase types
            const { error: productError } = await supabase
                .from('products')
                .update({
                    pricing_structure: pricingStructure,
                    pricing_type: 'matrix'
                } as any)
                .eq('id', productId);

            if (productError) throw productError;

            // 3. Convert generator prices to generic_product_prices format (with interpolation)
            // Price keys are: formatId::materialId::variantId::qty
            const inserts: any[] = [];
            const comboMap = new Map<string, { formatId: string; materialId: string; variantId: string }>();
            generatorKeys.forEach(key => {
                const parts = key.split('::');
                if (parts.length < 3) return;
                const [formatId, materialId, variantIdOrNone] = parts;
                const variantId = variantIdOrNone === 'none' ? 'none' : variantIdOrNone;
                const comboKey = `${formatId}::${materialId}::${variantId}`;
                if (!comboMap.has(comboKey)) {
                    comboMap.set(comboKey, { formatId, materialId, variantId });
                }
            });

            comboMap.forEach(({ formatId, materialId, variantId }) => {
                const variantKey = variantId === 'none' ? '' : variantId;
                const variantValueIds = variantKey ? variantKey.split('|').filter(Boolean) : [];
                // LOCK FIX (2026-02-09): keep variant_name stable across saves by including
                // all non-vertical selections. Do not simplify this to variant-only keys.
                // This prevents collisions when only one axis is stored in variant_value.
                const variantNameParts: string[] = [...variantValueIds];
                if (verticalAxisConfig.sectionType !== 'formats') variantNameParts.push(formatId);
                if (verticalAxisConfig.sectionType !== 'materials') variantNameParts.push(materialId);
                const variantName = Array.from(new Set(variantNameParts.filter(Boolean))).sort().join('|') || 'none';

                const verticalValueId = verticalAxisConfig.sectionType === 'formats' ? formatId :
                    verticalAxisConfig.sectionType === 'materials' ? materialId : formatId;

                quantities.forEach(qty => {
                    const computed = computeFinalPriceForContext(formatId, materialId, variantId, qty);
                    if (!computed || !computed.price || computed.price <= 0) return;

                    inserts.push({
                        product_id: productId,
                        tenant_id: tenantId,
                        variant_name: variantName,
                        variant_value: verticalValueId,
                        quantity: qty,
                        price_dkk: computed.price,
                        extra_data: {
                            verticalAxisGroupId: verticalGroup?.id,
                            verticalAxisValueId: verticalValueId,
                            formatId,
                            materialId,
                            variantId: variantKey || null,
                            variantValueIds,
                            selectionMap: {
                                format: formatId,
                                material: materialId,
                                ...(variantKey ? { variant: variantKey, variantValueIds } : {})
                            },
                            priceKey: getGenPriceKey(formatId, materialId, variantId, qty),
                            markup: computed.localMarkup || 0,
                            productMarkup: computed.prodMarkup || 0,
                            masterMarkup: Number(masterMarkup) || 0,
                            priceSource: computed.source,
                            basePrice: computed.basePrice
                        }
                    });
                });
            });

            console.log('[Matrix V1 Push] generatorPrices entries:', generatorKeys.length);
            console.log('[Matrix V1 Push] Valid inserts:', inserts.length);

            if (inserts.length === 0) {
                toast.error('Ingen gyldige priser at gemme. Har du importeret eller genereret priser først?');
                setPushing(false);
                return;
            }

            // Deduplicate inserts based on conflict key to prevent "ON CONFLICT DO UPDATE cannot affect row a second time" error
            const seen = new Map<string, typeof inserts[0]>();
            const deduplicatedInserts = inserts.filter(insert => {
                const key = `${insert.product_id}|${insert.variant_name}|${insert.variant_value}|${insert.quantity}`;
                if (seen.has(key)) {
                    console.warn('[Matrix V1 Push] Skipping duplicate:', key);
                    return false;
                }
                seen.set(key, insert);
                return true;
            });

            if (deduplicatedInserts.length < inserts.length) {
                const duplicateCount = inserts.length - deduplicatedInserts.length;
                console.warn(`[Matrix V1 Push] Removed ${duplicateCount} duplicate(s)`);
                toast.warning(`Fjernede ${duplicateCount} duplikat(er) før gem`);
            }

            // LOCK FIX (2026-02-09): delete then upsert for this product.
            // Old rows from previous key schemas can otherwise shadow new prices in frontend lookups.
            // 4. Upsert to generic_product_prices
            // Use product_id + variant_name + variant_value + quantity as conflict key
            const { error: deleteExistingPricesError } = await supabase
                .from('generic_product_prices')
                .delete()
                .eq('product_id', productId);

            if (deleteExistingPricesError) throw deleteExistingPricesError;

            console.log('[Matrix V1 Push] Upserting to generic_product_prices...');
            const { error: priceError } = await supabase
                .from('generic_product_prices')
                .upsert(deduplicatedInserts, {
                    onConflict: 'product_id,variant_name,variant_value,quantity'
                });

            if (priceError) throw priceError;

            // 5. Auto-backup to Price List Bank (safe fallback)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const stamp = new Date().toISOString().slice(0, 10);
                const time = new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                const backupName = `AUTO BACKUP - ${productName} - ${stamp} ${time}`;

                const spec = {
                    pricing_structure: pricingStructure,
                    generator_state: {
                        generatorPrices,
                        productMarkups,
                        masterMarkup,
                        genRounding,
                        selectedOplag,
                        sizeMode
                    },
                    meta: {
                        auto_backup: true,
                        saved_prices: deduplicatedInserts.length
                    }
                };

                await supabase
                    .from('price_list_templates' as any)
                    .insert({
                        tenant_id: tenantId,
                        product_id: productId,
                        name: backupName,
                        spec,
                        created_by: user?.id
                    });
            } catch (backupError) {
                console.warn('[Matrix V1 Push] Auto-backup failed:', backupError);
            }

            toast.success(`Succes! ${deduplicatedInserts.length} priser gemt med matrix_layout_v1 format.`);
            if (onPricesUpdated) onPricesUpdated();

        } catch (error: any) {
            console.error('Push Matrix V1 error:', error);
            toast.error('Kunne ikke gemme: ' + error.message);
        } finally {
            setPushing(false);
        }
    };

    const handleApplyImportedPrices = async (overrideHeaders?: string[], overrideData?: string[][], overrideMeta?: any) => {
        const headers = overrideHeaders || importHeadersRef.current || importHeaders;
        const data = overrideData || importedDataRef.current || importedData;
        const csvMeta = overrideMeta || (window as any).__csvImportMeta || null;
        if (data.length === 0) return;
        setPushing(true);
        toast.info(`Starting Import. Rows: ${data.length}. Headers: ${headers.length}`);

        try {
            // 0. Provision Attributes (Create missing Groups/Values)
            // Identify Headers -> Desired Kinds
            const missingValues: { groupId: string, name: string }[] = [];
            let headerGroupMap: Record<number, string> = {}; // colIdx -> groupId

            // Helper to match headers to kinds
            const getDistilledKind = (h: string): 'format' | 'material' | 'finish' | 'price' | 'qty' | 'ignore' | null => {
                const n = h.trim().toLowerCase();

                // 1. Format (Aggressive)
                if (n.includes('format') || n.includes('bredde') || ['størrelse', 'størrelser', 'size', 'dim', 'dimensioner', 'formater'].includes(n)) return 'format';

                // 2. Material (Aggressive includes)
                if (n.includes('material') || ['materiale', 'media', 'stof', 'medie', 'type', 'kvalitet', 'papirvægt', 'vægt', 'gsm', 'gram'].includes(n)) return 'material';

                // 3. Finish
                if (['finish', 'variant', 'behandling', 'efterbehandling', 'option', 'tilvalg', 'kachering', 'kashering', 'cashing', 'laminering', 'coating', 'papir-finish', 'papirfinish'].includes(n)) return 'finish';
                if (n.includes('kacher') || n.includes('kasher') || n.includes('cash') || n.includes('lamin') || n.includes('coat') || n.includes('finish') || n.includes('efterbehandl')) return 'finish';

                // 4. Quantity (Explicit)
                if (['antal', 'stk', 'oplag', 'quantity', 'qty', 'count', 'pieces', 'pcs'].includes(n)) return 'qty';

                // 5. Price (Explicit)
                if (['price', 'pris', 'beløb', 'amount', 'netto', 'brutto', 'kostpris', 'salgspris'].includes(n)) return null;

                // 6. Ignore (Rest of ignores)
                if (['kommentar', 'note', 'description', 'tags', 'tag', 'sort', 'sorting', 'sortering', 'order', 'tax', 'moms', 'vat', 'currency', 'valuta'].includes(n)) return 'ignore';

                // 7. Papir fallback
                if (n.includes('papir')) return 'material';

                return null;
            };

            // First pass: Ensure Groups Exist
            for (let i = 0; i < headers.length; i++) {
                const h = headers[i];
                if (!isNaN(parseInt(h))) continue; // Quantity column

                // Try to find existing group
                let group = productAttrs.groups.find(g => g.name.toLowerCase() === h.toLowerCase());

                // If not found by name, try to find by kind if we can imply it
                if (!group) {
                    const kind = getDistilledKind(h);
                    if (kind && kind !== 'ignore') {
                        // Check if we have a group of this kind (prioritize exact name match if multiple?)
                        // Actually, if we are in an empty project, we create it.
                        // Only use existing if singular?
                        group = productAttrs.groups.find(g => g.kind === kind);

                        if (!group) {
                            // Create Group
                            const newGroup = await productAttrs.createGroup({
                                name: h.charAt(0).toUpperCase() + h.slice(1).toLowerCase(), // Capitalize
                                kind: kind,
                                ui_mode: 'buttons',
                                sort_order: productAttrs.groups.length + i,
                                enabled: true,
                                source: 'product',
                                library_group_id: null
                            });
                            if (newGroup) group = newGroup;
                        }
                    }
                }

                if (group) {
                    headerGroupMap[i] = group.id;
                    // Scan column for missing values
                    const uniqueNames = new Set(data.map(r => r[i]?.trim()).filter(Boolean));
                    uniqueNames.forEach(valName => {
                        // Note: group here might be stale if we just created it using internal hook mechanism
                        // But createGroup returns the NEW object.
                        // But if we use 'productAttrs.groups' later...

                        // We will rely on checking 'group.values' (which might be empty for new group)
                        // But wait, createGroup return value doesn't strictly include 'values' array populated.

                        // We'll just Assume we need to add values if the group is new OR checks against DB.
                        // Let's use a simpler heuristic: Add all values to 'missingValues' list, 
                        // and we'll filter duplicates or existing ones carefully.
                        // Actually, checking against STALE values is dangerous.

                        // Better: We'll defer Value creation to after we re-fetch everything? 
                        // No, we need to insert them.

                        // Strategy: If group was just created, ALL values are missing.
                        // If group existed, check against its values.
                        const existingVal = group?.values?.find(v => v.name.toLowerCase() === valName?.toLowerCase());
                        if (!existingVal) {
                            missingValues.push({ groupId: group!.id, name: valName! });
                        }
                    });
                }
            }

            // Bulk Insert Missing Values


            // Actually, my filter logic above is broken syntax. Fix:
            const uniqueInserts: typeof missingValues = [];
            const seen = new Set<string>();
            missingValues.forEach(v => {
                const key = `${v.groupId}-${v.name.toLowerCase()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueInserts.push(v);
                }
            });

            if (uniqueInserts.length > 0) {
                const { error } = await supabase.from('product_attribute_values' as any).insert(
                    uniqueInserts.map(v => ({
                        tenant_id: tenantId,
                        product_id: productId,
                        group_id: v.groupId,
                        name: v.name,
                        enabled: true,
                        sort_order: 0 // Simplification
                    }))
                );
                if (error) throw error;
            }

            // CRITICAL: Re-fetch Fresh Data
            const { data: freshGroupsData } = await supabase
                .from('product_attribute_groups' as any)
                .select('*, values:product_attribute_values(*)')
                .eq('product_id', productId)
                .order('sort_order');

            const freshGroups = (freshGroupsData as unknown as ProductAttributeGroup[]) || [];

            // 2. Logic to Auto-Update Layout Config based on CSV Structure (STRICT MODE REWRITE)
            const hasMetaLayout = csvMeta?.layout_rows?.length && csvMeta?.vertical_axis;
            if (hasMetaLayout) {
                const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[.,\-\s_]/g, '');
                const isQtyHeader = (h: string) => {
                    const cleaned = h.replace(/\./g, '');
                    return /^\d+$/.test(cleaned);
                };

                const quantityIndices: number[] = [];
                const attributeIndices: number[] = [];
                headers.forEach((h, idx) => {
                    if (isQtyHeader(h)) quantityIndices.push(idx);
                    else attributeIndices.push(idx);
                });

                if (attributeIndices.length === 0 || quantityIndices.length === 0) {
                    throw new Error('CSV mangler kolonner for valgmuligheder eller oplag.');
                }

                const metaColumns = [
                    { role: 'vertical', ...(csvMeta.vertical_axis || {}) },
                    ...(csvMeta.layout_rows || []).flatMap((row: any) =>
                        (row.columns || []).map((col: any) => ({
                            role: 'section',
                            rowId: row.id,
                            ...col
                        }))
                    )
                ];

                if (metaColumns.length !== attributeIndices.length) {
                    throw new Error(`CSV meta matcher ikke antal kolonner (meta: ${metaColumns.length}, csv: ${attributeIndices.length}).`);
                }

                const resolveKind = (sectionType: string) => {
                    if (sectionType === 'formats') return 'format';
                    if (sectionType === 'materials') return 'material';
                    if (sectionType === 'finishes') return 'finish';
                    return 'custom';
                };

                const resolveGroup = async (metaCol: any, fallbackLabel: string) => {
                    let group = freshGroups.find(g => g.id === metaCol.groupId);
                    if (!group && fallbackLabel) {
                        group = freshGroups.find(g => g.name.toLowerCase() === fallbackLabel.toLowerCase());
                    }
                    if (!group) {
                        const kind = resolveKind(metaCol.sectionType);
                        const newGroup = await productAttrs.createGroup({
                            name: fallbackLabel || metaCol.sectionType || 'Valgmulighed',
                            kind: kind as any,
                            ui_mode: 'buttons',
                            sort_order: freshGroups.length + 1,
                            enabled: true,
                            source: 'product',
                            library_group_id: null
                        });
                        if (newGroup) {
                            group = newGroup;
                            freshGroups.push(newGroup);
                        }
                    }
                    return group;
                };

                const missingValues: { groupId: string, name: string }[] = [];
                const columnGroups: Record<number, ProductAttributeGroup> = {};

                for (let i = 0; i < metaColumns.length; i++) {
                    const colIndex = attributeIndices[i];
                    const metaCol: any = metaColumns[i];
                    const fallbackLabel = metaCol.title || metaCol.label || headers[colIndex] || metaCol.sectionType;
                    const group = await resolveGroup(metaCol, fallbackLabel);
                    if (!group) continue;
                    columnGroups[colIndex] = group;

                    const uniqueNames = new Set(data.map(r => r[colIndex]?.trim()).filter(Boolean));
                    uniqueNames.forEach(valName => {
                        const existingVal = group?.values?.find(v => v.name.toLowerCase() === valName.toLowerCase());
                        if (!existingVal) {
                            missingValues.push({ groupId: group.id, name: valName });
                        }
                    });
                }

                const uniqueInserts: typeof missingValues = [];
                const seen = new Set<string>();
                missingValues.forEach(v => {
                    const key = `${v.groupId}-${v.name.toLowerCase()}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueInserts.push(v);
                    }
                });

                if (uniqueInserts.length > 0) {
                    const { error } = await supabase.from('product_attribute_values' as any).insert(
                        uniqueInserts.map(v => ({
                            tenant_id: tenantId,
                            product_id: productId,
                            group_id: v.groupId,
                            name: v.name,
                            enabled: true,
                            sort_order: 0
                        }))
                    );
                    if (error) throw error;
                }

                const { data: refreshedGroupsData } = await supabase
                    .from('product_attribute_groups' as any)
                    .select('*, values:product_attribute_values(*)')
                    .eq('product_id', productId)
                    .order('sort_order');

                const refreshedGroups = (refreshedGroupsData as unknown as ProductAttributeGroup[]) || [];

                const findGroupFromMeta = (metaCol: any, fallbackLabel: string) => {
                    let group = refreshedGroups.find(g => g.id === metaCol.groupId);
                    if (!group && fallbackLabel) {
                        group = refreshedGroups.find(g => g.name.toLowerCase() === fallbackLabel.toLowerCase());
                    }
                    return group;
                };

                const collectValueIds = (group: ProductAttributeGroup | undefined, colIndex: number) => {
                    if (!group) return [];
                    const ids: string[] = [];
                    const seenIds = new Set<string>();
                    for (const row of data) {
                        const valName = row[colIndex]?.trim();
                        if (!valName) continue;
                        const match = group.values?.find(v => normalizeForMatch(v.name) === normalizeForMatch(valName));
                        if (match && !seenIds.has(match.id)) {
                            seenIds.add(match.id);
                            ids.push(match.id);
                        }
                    }
                    return ids;
                };

                const metaColumnMap = metaColumns.map((metaCol: any, idx: number) => {
                    const colIndex = attributeIndices[idx];
                    const sectionId = metaCol.sectionId || metaCol.id || `section-${idx}`;
                    const sectionType = metaCol.sectionType;
                    const label = metaCol.title || metaCol.label || headers[colIndex];
                    const group = findGroupFromMeta(metaCol, label);
                    return { colIndex, sectionId, sectionType, label, group };
                });

                const verticalSectionId = csvMeta.vertical_axis.sectionId || 'vertical-axis';
                const verticalMeta = metaColumnMap.find(m => m.sectionId === verticalSectionId) || metaColumnMap[0];
                const verticalGroup = verticalMeta?.group;
                const verticalValueIds = verticalMeta ? collectValueIds(verticalGroup, verticalMeta.colIndex) : [];

                let newVerticalConfig: any = {
                    ...verticalAxisConfig,
                    sectionId: verticalSectionId,
                    sectionType: csvMeta.vertical_axis.sectionType,
                    groupId: verticalGroup?.id || '',
                    valueIds: verticalValueIds,
                    valueSettings: csvMeta.vertical_axis.valueSettings || {}
                };

                const sectionIdToColIndex: Record<string, number> = {};
                const sectionTypeById: Record<string, string> = {};
                metaColumnMap.forEach(col => {
                    sectionIdToColIndex[col.sectionId] = col.colIndex;
                    sectionTypeById[col.sectionId] = col.sectionType;
                });

                const newLayoutRows: any[] = (csvMeta.layout_rows || []).map((row: any) => ({
                    id: row.id || `row-${Date.now()}`,
                    title: row.title || '',
                    description: row.description || '',
                    sections: (row.columns || []).map((col: any) => {
                        const sectionId = col.id;
                        const colIndex = sectionIdToColIndex[sectionId];
                        const label = col.title || col.label || (colIndex !== undefined ? headers[colIndex] : '');
                        const group = findGroupFromMeta(col, label);
                        return {
                            id: sectionId,
                            sectionType: col.sectionType,
                            groupId: group?.id || '',
                            valueIds: colIndex !== undefined ? collectValueIds(group, colIndex) : [],
                            ui_mode: col.ui_mode || 'buttons',
                            selection_mode: col.selection_mode || 'required',
                            valueSettings: col.valueSettings || {},
                            title: col.title || '',
                            description: col.description || ''
                        };
                    })
                }));

                const getLayoutDefaultId = (kind: 'format' | 'material' | 'finish') => {
                    if (newVerticalConfig) {
                        const type = newVerticalConfig.sectionType === 'formats' ? 'format' :
                            newVerticalConfig.sectionType === 'materials' ? 'material' :
                                newVerticalConfig.sectionType === 'finishes' ? 'finish' : '';
                        if (type === kind && newVerticalConfig.valueIds?.length > 0) return newVerticalConfig.valueIds[0];
                    }
                    for (const row of newLayoutRows) {
                        for (const sec of row.sections) {
                            const type = sec.sectionType === 'formats' ? 'format' :
                                sec.sectionType === 'materials' ? 'material' :
                                    sec.sectionType === 'finishes' ? 'finish' : '';
                            if (type === kind && sec.valueIds?.length > 0) return sec.valueIds[0];
                        }
                    }
                    return '';
                };

                const newPrices: Record<string, any> = { ...generatorPrices };
                let updatesCount = 0;
                const newOplag = new Set<number>();

                const quantities = quantityIndices.map(idx => {
                    const cleaned = headers[idx].replace(/\./g, '');
                    const qty = parseInt(cleaned);
                    if (!isNaN(qty)) newOplag.add(qty);
                    return qty;
                }).filter(q => !isNaN(q));

                data.forEach((row, rowIdx) => {
                    const selectionBySection: Record<string, string> = {};
                    metaColumnMap.forEach(col => {
                        const raw = row[col.colIndex]?.trim();
                        if (!raw || !col.group) return;
                        const match = col.group.values?.find(v => normalizeForMatch(v.name) === normalizeForMatch(raw));
                        if (match) selectionBySection[col.sectionId] = match.id;
                        if (rowIdx === 0) {
                            console.log('[CSV Import] Row 0 matching:', {
                                sectionId: col.sectionId,
                                sectionType: col.sectionType,
                                raw,
                                groupId: col.group?.id,
                                groupValues: col.group?.values?.map(v => v.name).slice(0, 5),
                                matchFound: !!match,
                                matchId: match?.id
                            });
                        }
                    });

                    const verticalValueId = selectionBySection[verticalSectionId];
                    if (!verticalValueId) {
                        if (rowIdx === 0) console.log('[CSV Import] Row 0: No verticalValueId, skipping');
                        return;
                    }

                    const variantValueIds = Object.entries(selectionBySection)
                        .filter(([secId]) => secId !== verticalSectionId)
                        .map(([, valId]) => valId)
                        .filter(Boolean);

                    const variantKey = variantValueIds.length > 0 ? [...variantValueIds].sort().join('|') : 'none';

                    let formatId = '';
                    let materialId = '';
                    Object.entries(selectionBySection).forEach(([secId, valId]) => {
                        const type = sectionTypeById[secId];
                        if (!formatId && type === 'formats') formatId = valId;
                        if (!materialId && type === 'materials') materialId = valId;
                    });

                    if (!formatId) formatId = getLayoutDefaultId('format');
                    if (!materialId) materialId = getLayoutDefaultId('material');

                    quantityIndices.forEach(qIdx => {
                        const cleaned = headers[qIdx].replace(/\./g, '');
                        const headerQtyVal = parseInt(cleaned);
                        if (isNaN(headerQtyVal)) return;
                        const cellPriceStr = row[qIdx];
                        if (!cellPriceStr) return;
                        const cellPrice = parseFloat(cellPriceStr.replace(/\./g, '').replace(',', '.'));
                        if (isNaN(cellPrice)) return;
                        const key = `${formatId}::${materialId}::${variantKey}::${headerQtyVal}`;
                        newPrices[key] = { price: cellPrice, markup: 0, isLocked: false };
                        updatesCount++;
                    });
                });

                const nextOplag = Array.from(newOplag).sort((a, b) => a - b);
                lastImportedPricesRef.current = newPrices;
                lastImportedOplagRef.current = nextOplag;

                setLayoutRows(newLayoutRows);
                setVerticalAxisConfig(newVerticalConfig);
                setGeneratorPrices(newPrices);
                setSelectedOplag(nextOplag);
                productAttrs.refresh();

                if (updatesCount > 0) {
                    toast.success(`Succes! ${updatesCount} priser importeret med layout metadata.`);
                } else {
                    toast.error('Ingen priser blev importeret. Tjek at CSV matcher layoutet.');
                }
                return;
            }
            // We assume the FIRST non-quantity column is the Vertical Axis
            // And subsequent columns are Horizontal Rows/Sections

            // 2. Pre-calculate Roles (Promoted to top for consistency between Layout and Pricing)
            // 2. Pre-calculate Roles (Promoted to top for consistency)
            const colRoles: Record<number, 'format' | 'material' | 'variant' | 'finish' | 'qty' | 'price' | 'ignore'> = {};
            const attributeCols: number[] = [];
            const newOplag = new Set(selectedOplag);

            // SCOPE FIX: Define suffix merge logic here at the top
            // New Request: Merge Papirfinish (Col 2) into Kashering (Col 3) to form "Efterbehandling"
            // Vertical Axis (Col 0) remains clean Material.
            const vertHeader = headers[0];
            const vertColIdx = 0;
            const papirFinishIdx = headers.findIndex(h => {
                const n = h.toLowerCase();
                return n.includes('papirfinish') || n.includes('papir-finish');
            });
            const kasheringIdx = headers.findIndex(h => {
                const n = h.toLowerCase();
                return n.includes('kashering') || n.includes('kachering');
            });

            // Merge into Kashering if both exist
            // Merge into Kashering if both exist (DISABLED - Treating as distinct)
            const shouldMergeFinish = false; // logic kept generic but disabled

            headers.forEach((h, idx) => {
                const kind = getDistilledKind(h);
                if (kind === 'ignore') { colRoles[idx] = 'ignore'; return; }
                if (kind === 'price') { colRoles[idx] = 'price'; return; }
                if (kind === 'qty') {
                    colRoles[idx] = 'qty';
                    return;
                }

                // If this is Papirfinish, Ignore it (it will be pulled into Kashering)
                if (shouldMergeFinish && idx === papirFinishIdx) {
                    colRoles[idx] = 'ignore';
                    return;
                }

                // If this is Kashering, Mark as Finish
                if (shouldMergeFinish && idx === kasheringIdx) {
                    colRoles[idx] = 'finish';
                    attributeCols.push(idx); // Ensure it's treated as an attribute column
                    return;
                }

                const cleanH = h.replace(/\./g, '');
                const qty = parseInt(cleanH);
                if (!isNaN(qty) && qty > 0 && /^\d/.test(cleanH)) {
                    colRoles[idx] = 'qty';
                    newOplag.add(qty);
                } else {
                    // Fix: Assign role for Attributes (Format, Material, Finish)
                    if (kind) colRoles[idx] = kind as any;
                    attributeCols.push(idx);
                }
            });

            // [REMOVED INFERENCE LOGIC] - Using strict positional mapping below.

            let newVerticalConfig: any = { ...verticalAxisConfig };
            let newLayoutRows: any[] = [];
            let layoutChanged = false;

            // Map Column Index -> Group
            const colGroups: Record<number, ProductAttributeGroup> = {};
            const colSections: Record<number, { title: string, type: string }> = {};

            // Helper to find group by name or kind
            const findGroupForHeader = (h: string) => {
                let g = freshGroups.find(group => group.name.toLowerCase() === h.toLowerCase());
                if (!g) {
                    const kind = getDistilledKind(h);
                    if (kind) g = freshGroups.find(group => group.kind === kind);
                }
                return g;
            };

            const attributeHeaders = headers.filter(h => isNaN(parseInt(h)) && getDistilledKind(h) !== 'ignore');

            if (attributeHeaders.length > 0) {
                // --- Vertical Axis Setup (Column 0) ---
                // --- Vertical Axis Setup (Column 0) ---
                // Header is already defined as 'vertHeader' above
                // Indicies defined above

                // Find or Create Vertical Group
                let vertGroup = findGroupForHeader(vertHeader);
                if (!vertGroup) {
                    // Determine Kind
                    const k = getDistilledKind(vertHeader);
                    if (k === 'ignore') {
                        // Vertical cannot be ignore.
                        toast.error(`Vertical axis "${vertHeader}" detected as ignored. Import failed.`);
                        setPushing(false);
                        return;
                    }
                    const newGroup = await productAttrs.createGroup({
                        name: vertHeader,
                        kind: (k === 'material' || k === 'finish' || k === 'format') ? k : 'material', // Default to material
                        ui_mode: 'buttons',
                        source: 'product',
                        sort_order: 0,
                        enabled: true,
                        library_group_id: null
                    });
                    if (newGroup) {
                        vertGroup = newGroup;
                        // Refresh groups logic skipped for brevity, assumes state update eventually
                        freshGroups.push(newGroup);
                    }
                }

                if (vertColIdx >= 0 && vertGroup) {
                    // 2b. Collect Vertical Values (with Merge) & Create if missing
                    const verticalValues: string[] = []; // IDs
                    const seenVertValues = new Set<string>();

                    // Pre-scan to create missing Vertical Values
                    for (const row of data) {
                        let valName = row[vertColIdx]?.trim();
                        // No Vertical Merge here anymore.
                        // if (shouldMergeSuffix) ... REMOVED

                        if (!valName || seenVertValues.has(valName)) continue;
                        seenVertValues.add(valName);

                        // Check existence
                        let val = vertGroup?.values?.find(v => v.name.toLowerCase() === valName.toLowerCase());
                        if (!val) {
                            val = await productAttrs.addValue(vertGroup!.id, {
                                name: valName,
                                enabled: true,
                                sort_order: vertGroup!.values?.length || 0,
                                key: valName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                width_mm: null,
                                height_mm: null,
                                meta: null
                            });
                        }
                        if (val) verticalValues.push(val.id);
                    }

                    // Determine Type (Format/Material/Finish) based on Group or Header
                    let vertType: 'products' | 'formats' | 'materials' | 'finishes' = 'materials'; // Default
                    if (vertGroup?.kind) {
                        if (vertGroup.kind === 'format') vertType = 'formats';
                        else if (vertGroup.kind === 'material') vertType = 'materials';
                        else if (vertGroup.kind === 'finish') vertType = 'finishes';
                    } else {
                        const k = getDistilledKind(vertHeader);
                        if (k === 'format') vertType = 'formats';
                        else if (k === 'finish') vertType = 'finishes';
                    }

                    newVerticalConfig = {
                        ...verticalAxisConfig,
                        sectionType: vertType,
                        groupId: vertGroup ? vertGroup.id : '',
                        valueIds: verticalValues
                    };
                    layoutChanged = true;

                    colSections[vertColIdx] = { title: vertHeader, type: vertType };
                }

                // --- Horizontal Sections Setup (Columns 1..N) ---
                // Iterate all headers. Skip Vertical Axis.
                // Strict Rule: One Column = One Layout Row.

                headers.forEach((h, idx) => {
                    if (idx === vertColIdx) return;
                    if (colRoles[idx] === 'qty') return;
                    if (colRoles[idx] === 'price') return;
                    // Removed merge skips - verify logic holds

                    // Double check ignore logic
                    const distilled = getDistilledKind(h);
                    if (distilled === 'ignore') return;

                    // Match Group
                    const group = findGroupForHeader(h);

                    // Determine Type
                    let secType: 'formats' | 'materials' | 'finishes' | 'products' = 'products';
                    if (group?.kind) {
                        if (group.kind === 'format') secType = 'formats';
                        else if (group.kind === 'material') secType = 'materials';
                        else if (group.kind === 'finish') secType = 'finishes';
                    } else {
                        if (distilled === 'format') secType = 'formats';
                        else if (distilled === 'material') secType = 'materials';
                        else if (distilled === 'finish') secType = 'finishes';
                    }

                    // Extract Values (Specific to this column)
                    const foundValueIds = new Set<string>();
                    const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[.,\-\s_]/g, '');

                    data.forEach(row => {
                        const valName = row[idx]?.trim();
                        if (valName) {
                            const searchNorm = normalizeForMatch(valName);
                            // Try Group Values First
                            let val = group?.values?.find(v => normalizeForMatch(v.name) === searchNorm);

                            // Try All Groups (Fuzzy Fallback)
                            if (!val) {
                                for (const g of freshGroups) {
                                    const candidate = g.values?.find(v => normalizeForMatch(v.name) === searchNorm);
                                    if (candidate) { val = candidate; break; }
                                }
                            }
                            if (val) foundValueIds.add(val.id);
                        }
                    });

                    // Create Layout Row with ONE Section
                    // Safety Check: Ensure 'group' exists before accessing properties
                    if (!group) return;

                    const newSection = {
                        id: `section-${Date.now()}-${idx}`,
                        groupId: group.id,
                        sectionType: secType,
                        valueIds: Array.from(foundValueIds),
                        ui_mode: 'buttons' as const
                    };
                    newLayoutRows.push({
                        id: `row-${Date.now()}-${idx}`,
                        title: h,
                        sections: [{
                            ...newSection,
                            title: h,
                            description: ''
                        }]
                    });
                    // Populate Metadata for Pricing Loop
                    colSections[idx] = { title: h, type: secType };
                    layoutChanged = true;
                });
            }

            // 3. Map Headers (Using Fresh Groups) & Apply Prices
            const newPrices: Record<string, any> = { ...generatorPrices };
            let updatesCount = 0;
            // Helper to resolve default IDs from the NEW layout (Vertical + Horizontal)
            const getLayoutDefaultId = (kind: 'format' | 'material' | 'finish') => {
                // Check Vertical
                if (newVerticalConfig) {
                    const type = newVerticalConfig.sectionType === 'formats' ? 'format' :
                        newVerticalConfig.sectionType === 'materials' ? 'material' :
                            newVerticalConfig.sectionType === 'finishes' ? 'finish' : '';
                    if (type === kind && newVerticalConfig.valueIds?.length > 0) return newVerticalConfig.valueIds[0];
                }
                // Check Horizontal
                for (const row of newLayoutRows) {
                    for (const sec of row.sections) {
                        const type = sec.sectionType === 'formats' ? 'format' :
                            sec.sectionType === 'materials' ? 'material' :
                                sec.sectionType === 'finishes' ? 'finish' : '';
                        if (type === kind && sec.valueIds?.length > 0) return sec.valueIds[0];
                    }
                }
                return null;
            };

            // Fix: Define qtyColIdx explicitly from colRoles
            const qtyColIdx = headers.findIndex((_, i) => colRoles[i] === 'qty');

            data.forEach(row => {
                const rowIds: Record<string, string> = {};
                const variantValueIds: string[] = [];
                const rowQtyStr = (row[qtyColIdx]?.toString() || '').replace(/\./g, '');
                let rowQty = parseInt(rowQtyStr);
                if (isNaN(rowQty)) {
                    // Fallback: If no explicit Qty column, and this is a List format, default to 1?
                    // User might have 'Format, Material, Price'. No Qty.
                    if (qtyColIdx === -1) rowQty = 1;
                    else return;
                }

                // 1. Identify Attributes from Layout Columns (colSections)
                const vertColIdx = headers.findIndex(h => h === attributeHeaders[0]); // Re-find vertical column index
                Object.entries(colSections).forEach(([idxStr, meta]) => {
                    const idx = parseInt(idxStr);
                    let valName = row[idx]?.trim();



                    // Handle Finish Merge (Kashering + Papirfinish)
                    // DISABLED - Treating as distinct columns now.
                    // if (shouldMergeFinish && idx === kasheringIdx) { ... }

                    if (!valName) return;

                    const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[.,\-\s_]/g, '');
                    const searchNorm = normalizeForMatch(valName);

                    let foundValId = '';

                    // Try finding specific group
                    let group = freshGroups.find(g => g.name.toLowerCase() === meta.title.toLowerCase());
                    if (group) {
                        const val = group.values?.find(v => normalizeForMatch(v.name) === searchNorm);
                        if (val) foundValId = val.id;
                    }

                    if (!foundValId) {
                        // Fallback global search
                        for (const g of freshGroups) {
                            const val = g.values?.find(v => normalizeForMatch(v.name) === searchNorm);
                            if (val) { foundValId = val.id; break; }
                        }
                    }

                    if (foundValId) {
                        if (idx !== vertColIdx) {
                            variantValueIds.push(foundValId);
                        }
                        else if (meta.type === 'formats') rowIds['formats'] = foundValId;
                        else if (meta.type === 'materials') rowIds['materials'] = foundValId;
                    }


                    if (isNaN(rowQty)) return;

                    // 2. Construct Key from new Layout
                    // Key Structure: format::material::variant::qty
                    const keyFormatId = rowIds['formats'] || getLayoutDefaultId('format') || '';
                    const keyMaterialId = rowIds['materials'] || getLayoutDefaultId('material') || '';

                    // Finishes: We might have multiple finishIds (Papirfinish + Kashering).
                    // We need a composite key for the Price Generator.
                    // Join all finishIds with '_' or similar to form a Composite Variant ID?
                    // Or relies on 'rowVariantId' matching just one?
                    // To make uniqueness work, we construct a COMPOSITE KEY matching the order they appear.
                    // sort() to ensure consistency.
                    let keyVariantId = 'none';
                    const uniqueVariantIds = Array.from(new Set(variantValueIds));
                    if (uniqueVariantIds.length > 0) {
                        // Use sorted pipe-delimited IDs to match MatrixLayoutV1Renderer variant key logic
                        keyVariantId = uniqueVariantIds.slice().sort().join('|');
                    }

                    // Price
                    // Identify price column (last one that is not qty?)
                    // Or specific?
                    // Assumption: Last column is price?
                    // Wait, Import Logic identifies Price Column?
                    // Matrix Style Logic (Iterate Qty Columns where Header is the Quantity)
                    // Matrix Style Logic (Iterate Qty Columns where Header is the Quantity)
                    headers.forEach((h, idx) => {
                        if (colRoles[idx] === 'qty') {
                            // Header is Qty, Cell is Price
                            const cleanedH = h.replace(/\./g, '');
                            // Only process if Header looks like a number (Matrix column)
                            if (/^\d/.test(cleanedH)) {
                                const headerQtyVal = parseInt(cleanedH);
                                const cellPriceStr = row[idx];
                                if (cellPriceStr && !isNaN(headerQtyVal)) {
                                    const cellPrice = parseFloat(cellPriceStr.replace(/\./g, '').replace(',', '.'));
                                    if (!isNaN(cellPrice)) {
                                        // FIX: Use headerQtyVal here, not rowQty!
                                        const key = `${keyFormatId}::${keyMaterialId}::${keyVariantId}::${headerQtyVal}`;
                                        newPrices[key] = { price: cellPrice, markup: 0, isLocked: false };
                                        updatesCount++;
                                    }
                                }
                            }
                        }
                    });

                    // List Style Price Logic (Single Price Column)
                    // Fix: colRoles is Record<number, string>, not Array. Use Object.keys.
                    const priceColIdx = parseInt(Object.keys(colRoles).find(k => colRoles[parseInt(k)] === 'price') || '-1');
                    if (priceColIdx >= 0) {
                        const priceValStr = row[priceColIdx];
                        if (priceValStr) {
                            const priceVal = parseFloat(priceValStr.replace(/\./g, '').replace(',', '.'));
                            if (!isNaN(priceVal)) {
                                // Fix: Use rowQty template var correctly if variable name changed
                                const key = `${keyFormatId}::${keyMaterialId}::${keyVariantId}::${rowQty}`;
                                newPrices[key] = { price: priceVal, markup: 0, isLocked: false };
                                updatesCount++;
                            }
                        }
                    }
                });

                if (layoutChanged) {
                    setLayoutRows(newLayoutRows);
                    setVerticalAxisConfig(newVerticalConfig);
                    // Force refresh groups via productAttrs?
                    // productAttrs is likely stale until next render.
                    // But we used freshGroups for ID lookup which updates productAttrs.groups immediately via mutation?
                    // No, `freshGroups` is a local clone.
                    // `productAttrs.groups` isn't updated unless we refetched?
                    // The start of function (lines 1300+) handles creation.
                    // Assuming existing logic handles it.
                }

                const nextOplag = Array.from(newOplag).sort((a, b) => a - b);
                lastImportedPricesRef.current = newPrices;
                lastImportedOplagRef.current = nextOplag;

                setGeneratorPrices(newPrices);
                setSelectedOplag(nextOplag);
                productAttrs.refresh();

                if (updatesCount > 0) {
                    toast.success(`Succes! ${updatesCount} priser. LayoutCols: ${Object.keys(colSections).length}`);
                } else {
                    const debugInfo = Object.keys(colSections).map(k => colSections[parseInt(k)].title).join('|');
                    toast.error(`Import Fail: Zero prices. Sections: ${debugInfo}`, { duration: 20000 });
                }
            });

        } catch (e) {
            console.error(e);
            toast.error("CRITICAL EXCEPTION: " + (e as any).message);
        } finally {
            setPushing(false);
        }
    };

    const formatGroups = productAttrs.groups.filter(g => g.kind === 'format');
    const materialGroups = productAttrs.groups.filter(g => g.kind === 'material');
    const variantGroups = productAttrs.groups.filter(g => g.kind === 'finish' || g.kind === 'custom');
    const activeVariantGroup = variantGroups.find(g => g.id === pricingVariantGroupId);

    // Active generator context (multi-section safe)
    const activeGenFormat = getActiveFormatId(selectedSectionValues);
    const activeGenMaterial = getActiveMaterialId(selectedSectionValues);
    const activeGenVariant = getVariantKeyFromSelections(selectedSectionValues);
    const hiddenSectionIds = useMemo(() => {
        const ids = new Set<string>();
        layoutRows.forEach(row => {
            row.sections.forEach(section => {
                if (section.ui_mode === 'hidden') {
                    ids.add(section.id);
                }
            });
        });
        return ids;
    }, [layoutRows]);

    const activeNonVerticalSelections = Object.entries(selectedSectionValues)
        .filter(([secId, valId]) => secId !== verticalSectionId && valId)
        .filter(([secId, valId]) => !hiddenSectionIds.has(secId) && valId !== activeGenFormat && valId !== activeGenMaterial);

    const getVisibleValueIdsByType = useCallback((sectionType: AttributeType) => {
        const ids = new Set<string>();
        if (verticalAxisConfig.sectionType === sectionType) {
            (verticalAxisConfig.valueIds || []).forEach(id => ids.add(id));
        }
        layoutRows.forEach(row => {
            row.sections.forEach(section => {
                if (section.sectionType !== sectionType) return;
                if (section.ui_mode === 'hidden') return;
                (section.valueIds || []).forEach(id => ids.add(id));
            });
        });
        return ids;
    }, [layoutRows, verticalAxisConfig.sectionType, verticalAxisConfig.valueIds]);

    useEffect(() => {
        if (genSelectedFormat !== activeGenFormat) setGenSelectedFormat(activeGenFormat);
        if (genSelectedMaterial !== activeGenMaterial) setGenSelectedMaterial(activeGenMaterial);
    }, [activeGenFormat, activeGenMaterial, genSelectedFormat, genSelectedMaterial]);

    // Memoize existing format identifiers to prevent re-render flashing
    const existingFormatIds = useMemo(() => {
        const ids = new Set<string>();
        formatGroups.flatMap(g => g.values || []).forEach(v => {
            // Add lowercase name parts for matching
            ids.add(v.name.toLowerCase());
            // Add dimension key if available
            if (v.width_mm && v.height_mm) {
                ids.add(`${v.width_mm}x${v.height_mm}`);
            }
        });
        return ids;
    }, [formatGroups]);

    const filteredLibraryGroups = library.groups.filter(g =>
        g.name.toLowerCase().includes(librarySearch.toLowerCase())
    );

    // Toggle oplag selection
    const toggleOplag = (qty: number) => {
        setSelectedOplag(prev =>
            prev.includes(qty)
                ? prev.filter(q => q !== qty)
                : [...prev, qty].sort((a, b) => a - b)
        );
    };

    // Add custom oplag
    const addCustomOplag = () => {
        const qty = parseInt(customOplag);
        if (qty > 0 && !selectedOplag.includes(qty)) {
            setSelectedOplag(prev => [...prev, qty].sort((a, b) => a - b));
            setCustomOplag('');
        }
    };

    // Helper to get compound key for generator prices (using :: to avoid UUID conflicts)
    const getGenPriceKey = (formatId: string, materialId: string, variantKey: string, qty: number) =>
        `${formatId}::${materialId}::${variantKey || 'none'}::${qty}`;

    // Get anchor data for current format+material+variant at a specific qty
    const getAnchorData = (qty: number) => {
        const key = getGenPriceKey(activeGenFormat, activeGenMaterial, activeGenVariant, qty);
        return generatorPrices[key] || { price: 0, markup: 0, isLocked: false };
    };

    // Set anchor data for current format+material+variant at a specific qty
    const setAnchorData = (qty: number, data: { price?: number; markup?: number; isLocked?: boolean; excludeFromCurve?: boolean }) => {
        const key = getGenPriceKey(activeGenFormat, activeGenMaterial, activeGenVariant, qty);

        setGeneratorPrices(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { price: 0, markup: 0 }), ...data }
        }));
    };

    const applyManualPriceForKey = (priceKey: string, finalPrice: number | null) => {
        const parts = priceKey.split('::');
        if (parts.length < 4) return;
        const [formatId, materialId, variantId] = parts;
        const existing = generatorPrices[priceKey] || { price: 0, markup: 0 };

        if (!finalPrice || finalPrice <= 0) {
            setGeneratorPrices(prev => ({
                ...prev,
                [priceKey]: { ...(prev[priceKey] || existing), price: 0, excludeFromCurve: true }
            }));
            return;
        }

        const localMarkup = Number(existing.markup) || 0;
        const markupKey = `${formatId}::${materialId}${variantId && variantId !== 'none' ? `::${variantId}` : ''}`;
        const prodMarkup = productMarkups[markupKey] || 0;
        const gm = Number(masterMarkup) || 0;
        const totalMultiplier = (1 + localMarkup / 100) * (1 + prodMarkup / 100) * (1 + gm / 100);
        const basePrice = totalMultiplier !== 0 ? finalPrice / totalMultiplier : finalPrice;

        setGeneratorPrices(prev => ({
            ...prev,
            [priceKey]: { ...(prev[priceKey] || existing), price: basePrice, excludeFromCurve: false }
        }));
    };

    const commitEditingPrice = (priceKey: string) => {
        const raw = editingPriceValue.trim();
        const normalized = raw.replace(',', '.');
        const parsed = normalized ? parseFloat(normalized) : NaN;
        const finalPrice = !raw || Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
        applyManualPriceForKey(priceKey, finalPrice);
        setEditingPriceKey(null);
    };

    function computeFinalPriceForContext(formatId: string, materialId: string, variantId: string, qty: number): {
        price: number;
        basePrice: number | null;
        localMarkup: number;
        prodMarkup: number;
        source: 'manual' | 'interpolated';
    } | null {
        const priceKey = getGenPriceKey(formatId, materialId, variantId, qty);
        const data = generatorPrices[priceKey];
        if (data?.excludeFromCurve && (!data.price || data.price <= 0)) return null;

        const localMarkup = Number(data?.markup) || 0;
        const markupKey = `${formatId}::${materialId}${variantId !== 'none' ? `::${variantId}` : ''}`;
        const prodMarkup = productMarkups[markupKey] || 0;
        const gm = Number(masterMarkup) || 0;
        const rnd = Number(genRounding) || 1;

        if (data?.price && data.price > 0) {
            const finalPrice = Math.round(
                data.price * (1 + localMarkup / 100) * (1 + prodMarkup / 100) * (1 + gm / 100) / rnd
            ) * rnd;
            return {
                price: finalPrice,
                basePrice: data.price,
                localMarkup,
                prodMarkup,
                source: 'manual'
            };
        }

        const anchors = getAnchorsForContext(formatId, materialId, variantId);
        if (anchors.length >= 2) {
            const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
            const afterAnchor = anchors.find(a => a.quantity > qty);
            if (beforeAnchor && afterAnchor) {
                let interpolated = interpolatePrice(qty, anchors);
                interpolated = interpolated * (1 + prodMarkup / 100) * (1 + gm / 100);
                const finalPrice = Math.round(interpolated / rnd) * rnd;
                if (finalPrice > 0) {
                    return {
                        price: finalPrice,
                        basePrice: null,
                        localMarkup: 0,
                        prodMarkup,
                        source: 'interpolated'
                    };
                }
            }
        }

        return null;
    }

    function computeFinalPriceForContextFromSource(
        sourcePrices: Record<string, any>,
        formatId: string,
        materialId: string,
        variantId: string,
        qty: number
    ): {
        price: number;
        basePrice: number | null;
        localMarkup: number;
        prodMarkup: number;
        source: 'manual' | 'interpolated';
    } | null {
        const priceKey = getGenPriceKey(formatId, materialId, variantId, qty);
        const data = sourcePrices[priceKey];
        if (data?.excludeFromCurve && (!data.price || data.price <= 0)) return null;

        const localMarkup = Number(data?.markup) || 0;
        const markupKey = `${formatId}::${materialId}${variantId !== 'none' ? `::${variantId}` : ''}`;
        const prodMarkup = productMarkups[markupKey] || 0;
        const gm = Number(masterMarkup) || 0;
        const rnd = Number(genRounding) || 1;

        if (data?.price && data.price > 0) {
            const finalPrice = Math.round(
                data.price * (1 + localMarkup / 100) * (1 + prodMarkup / 100) * (1 + gm / 100) / rnd
            ) * rnd;
            return {
                price: finalPrice,
                basePrice: data.price,
                localMarkup,
                prodMarkup,
                source: 'manual'
            };
        }

        if (typeof data === 'number' && data > 0) {
            const finalPrice = Math.round(data * (1 + prodMarkup / 100) * (1 + gm / 100) / rnd) * rnd;
            return {
                price: finalPrice,
                basePrice: data,
                localMarkup: 0,
                prodMarkup,
                source: 'manual'
            };
        }

        const anchors: { quantity: number; price: number; markup: number }[] = [];
        Object.entries(sourcePrices).forEach(([key, value]) => {
            const parts = key.split('::');
            if (parts.length < 4) return;
            const [fId, mId, vId, qtyStr] = parts;
            if (fId !== formatId || mId !== materialId || (vId || 'none') !== (variantId || 'none')) return;
            const q = parseInt(qtyStr, 10);
            if (Number.isNaN(q)) return;
            if (value && typeof value !== 'number' && value.isLocked && value.price > 0 && !value.excludeFromCurve) {
                anchors.push({ quantity: q, price: value.price, markup: value.markup || 0 });
                return;
            }
            if (typeof value === 'number' && value > 0) {
                anchors.push({ quantity: q, price: value, markup: 0 });
            }
        });

        if (anchors.length >= 2) {
            const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
            const afterAnchor = anchors.find(a => a.quantity > qty);
            if (beforeAnchor && afterAnchor) {
                let interpolated = interpolatePrice(qty, anchors);
                interpolated = interpolated * (1 + prodMarkup / 100) * (1 + gm / 100);
                const finalPrice = Math.round(interpolated / rnd) * rnd;
                if (finalPrice > 0) {
                    return {
                        price: finalPrice,
                        basePrice: null,
                        localMarkup: 0,
                        prodMarkup,
                        source: 'interpolated'
                    };
                }
            }
        }

        return null;
    }

    const getAnchorsForContext = (formatId: string, materialId: string, variantId: string): { quantity: number; price: number; markup: number }[] => {
        return selectedOplag
            .filter(qty => {
                const key = getGenPriceKey(formatId, materialId, variantId, qty);
                const data = generatorPrices[key];
                return data?.isLocked && !data?.excludeFromCurve && data?.price != null && data?.price > 0;
            })
            .map(qty => {
                const key = getGenPriceKey(formatId, materialId, variantId, qty);
                const data = generatorPrices[key] || { price: 0, markup: 0 };
                return {
                    quantity: qty,
                    price: data.price || 0,
                    markup: data.markup || 0
                };
            })
            .sort((a, b) => a.quantity - b.quantity);
    };

    const generatorCombinationOptions = useMemo(() => {
        const combos = new Map<string, { formatId: string; materialId: string; variantId: string; priceCount: number }>();
        Object.entries(generatorPrices).forEach(([key, data]) => {
            const parts = key.split('::');
            if (parts.length < 4) return;
            const [formatId, materialId, variantId] = parts;
            if (!formatId || !materialId) return;
            const comboKey = `${formatId}::${materialId}::${variantId || 'none'}`;
            const priceVal = typeof data === 'number' ? data : Number((data as any)?.price || 0);
            const entry = combos.get(comboKey) || { formatId, materialId, variantId: variantId || 'none', priceCount: 0 };
            if (priceVal > 0) entry.priceCount += 1;
            combos.set(comboKey, entry);
        });

        return Array.from(combos.values())
            .filter(entry => entry.priceCount > 0)
            .map(entry => ({
                ...entry,
                key: `${entry.formatId}::${entry.materialId}::${entry.variantId || 'none'}`,
                label: buildCombinationLabel(entry.formatId, entry.materialId, entry.variantId || 'none')
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [generatorPrices, productAttrs.groups]);

    const currentCombinationKey = activeGenFormat && activeGenMaterial
        ? `${activeGenFormat}::${activeGenMaterial}::${activeGenVariant || 'none'}`
        : '';

    const copyOptions = useMemo(
        () => generatorCombinationOptions.filter(opt => opt.key !== currentCombinationKey),
        [generatorCombinationOptions, currentCombinationKey]
    );

    const handleCopyPricesFrom = useCallback((sourceKey: string) => {
        if (!activeGenFormat || !activeGenMaterial) {
            toast.error('Vælg format og materiale først');
            return;
        }

        const [sourceFormatId, sourceMaterialId, sourceVariantId] = sourceKey.split('::');
        if (!sourceFormatId || !sourceMaterialId) {
            toast.error('Ugyldig kombination');
            return;
        }

        const targetVariantId = activeGenVariant || 'none';
        let copied = 0;

        setGeneratorPrices(prev => {
            const next = { ...prev };
            const quantityFilter = selectedOplag.length > 0 ? new Set(selectedOplag) : null;
            Object.entries(prev).forEach(([key, data]) => {
                const parts = key.split('::');
                if (parts.length < 4) return;
                const [formatId, materialId, variantId, qtyStr] = parts;
                if (formatId !== sourceFormatId || materialId !== sourceMaterialId) return;
                if ((variantId || 'none') !== (sourceVariantId || 'none')) return;
                const qty = Number(qtyStr);
                if (quantityFilter && !quantityFilter.has(qty)) return;
                const targetKey = getGenPriceKey(activeGenFormat, activeGenMaterial, targetVariantId, qty);
                const normalized = typeof data === 'number' ? { price: data, markup: 0 } : { ...data };
                next[targetKey] = normalized;
                copied += 1;
            });
            return next;
        });

        setProductMarkups(prev => {
            const sourceMarkupKey = `${sourceFormatId}::${sourceMaterialId}`;
            if (prev[sourceMarkupKey] == null) return prev;
            const targetMarkupKey = `${activeGenFormat}::${activeGenMaterial}`;
            return { ...prev, [targetMarkupKey]: prev[sourceMarkupKey] };
        });

        if (copied > 0) {
            toast.success(`Priser kopieret (${copied})`);
        } else {
            toast.error('Ingen priser at kopiere');
        }
    }, [activeGenFormat, activeGenMaterial, activeGenVariant, selectedOplag]);

    // ==========================================
    // PROTECTED CORE LOGIC: PRICE INTERPOLATION
    // Any changes to this logic affects the entire pricing engine.
    // ==========================================
    // Interpolation for price generation (includes per-anchor markup)
    const interpolatePrice = (quantity: number, anchors: { quantity: number; price: number; markup?: number }[]): number => {
        if (anchors.length === 0) return 0;
        if (anchors.length === 1) {
            const anchor = anchors[0];
            const priceWithMarkup = anchor.price * (1 + (anchor.markup || 0) / 100);
            return priceWithMarkup;
        }

        // Sort anchors by quantity
        const sorted = [...anchors].sort((a, b) => a.quantity - b.quantity);

        // Find surrounding anchors
        const before = sorted.filter(a => a.quantity <= quantity).pop();
        const after = sorted.find(a => a.quantity >= quantity);

        if (!before) { // Extrapolate backwards from first two
            const p1 = sorted[0];
            const p2 = sorted[1];
            if (!p2) return p1.price * (1 + (p1.markup || 0) / 100); // define fallback

            const m = (p2.price - p1.price) / (p2.quantity - p1.quantity); // slope
            const linearP = p1.price + m * (quantity - p1.quantity);
            return Math.max(0, linearP * (1 + (p1.markup || 0) / 100)); // Use p1 markup?
        }
        if (!after) { // Extrapolate forwards
            const p1 = sorted[sorted.length - 2];
            const p2 = sorted[sorted.length - 1];
            if (!p1) return p2.price * (1 + (p2.markup || 0) / 100);

            const m = (p2.price - p1.price) / (p2.quantity - p1.quantity);
            const linearP = p2.price + m * (quantity - p2.quantity);
            return Math.max(0, linearP * (1 + (p2.markup || 0) / 100));
        }

        // Interpolate between before and after
        const t = (quantity - before.quantity) / (after.quantity - before.quantity);
        const interpolatedBase = before.price + t * (after.price - before.price);

        // Interpolate markup
        const markupBefore = before.markup || 0;
        const markupAfter = after.markup || 0;
        const interpolatedMarkup = markupBefore + t * (markupAfter - markupBefore);

        return interpolatedBase * (1 + interpolatedMarkup / 100);
    };

    const roundPrice = (price: number, rounding: number): number => {
        return Math.round(price / rounding) * rounding;
    };

    // Generate preview prices
    const handleGeneratePreview = () => {
        if (selectedOplag.length === 0) {
            toast.error('Vælg mindst ét oplag');
            return;
        }
        const anchors = getAnchorsForContext(activeGenFormat, activeGenMaterial, activeGenVariant);
        if (anchors.length < 1) {
            toast.error('Definer mindst ét ankerpunkt med pris for denne kombination');
            return;
        }

        const preview = selectedOplag.map(qty => {
            let price = interpolatePrice(qty, anchors);
            // Apply local markup from the specific row (even if interpolated)
            const localMarkup = getAnchorData(qty).markup || 0;
            price = price * (1 + localMarkup / 100);

            // Updated key for product markup to include variant
            const prodMarkupKey = `${activeGenFormat}::${activeGenMaterial}${activeGenVariant !== 'none' ? `::${activeGenVariant}` : ''}`;
            const prodMarkup = productMarkups[prodMarkupKey] || 0;

            price = price * (1 + prodMarkup / 100);
            price = roundPrice(price, genRounding);
            return { quantity: qty, price };
        });
        setGeneratedPreview(preview);
    };

    const handleResetPriceListConfig = () => {
        if (!confirm('Nulstil prisliste-opsætning? Ugemte ændringer går tabt.')) return;
        setGeneratorPrices({});
        setProductMarkups({});
        setMasterMarkup(0);
        setGenRounding(1);
        setSelectedOplag([]);
        setGeneratedPreview([]);
        setImportedData([]);
        setImportHeaders([]);
        importHeadersRef.current = [];
        importedDataRef.current = [];
        lastImportedPricesRef.current = {};
        lastImportedOplagRef.current = [];
        toast.success('Prisliste-opsætning nulstillet');
    };

    const handleResetLayoutConfig = () => {
        if (!confirm('Nulstil prisliste-layout? Ugemte ændringer går tabt.')) return;
        setLayoutRows([
            { id: 'row-1', sections: [{ id: 'section-1', groupId: '', sectionType: 'formats', ui_mode: 'buttons', selection_mode: 'required' }] }
        ]);
        setVerticalAxisConfig({
            sectionId: 'vertical-axis',
            sectionType: 'materials',
            groupId: '',
            ui_mode: 'buttons',
            valueIds: [],
            valueSettings: {},
            thumbnailsEnabled: false
        });
        setSelectedSectionValues({});
        setSelectedTarget(null);
        setPreviewSelectedFormat(null);
        toast.success('Prisliste-layout nulstillet');
    };



    const getSuggestedName = () => {
        const formats = formatGroups.flatMap(g => g.values || []).filter(v => v.enabled);
        const materials = materialGroups.flatMap(g => g.values || []).filter(v => v.enabled);
        const uniqueFormats = [...new Set(formats.map(r => r.name))];
        const uniqueMaterials = [...new Set(materials.map(r => r.name))];
        const formatPart = uniqueFormats.length <= 3 ? uniqueFormats.join(', ') : `${uniqueFormats.length} formater`;
        const materialPart = uniqueMaterials.length <= 3 ? uniqueMaterials.join(', ') : `${uniqueMaterials.length} materialer`;
        return `${productName} - ${formatPart} × ${materialPart}`;
    };

    // Save prices directly from preview table
    const handleSavePriceList = async (customName?: string, keepState = false, overwriteId?: string) => {
        // Trigger dialog if no name provided (unless explicitly skipped?)
        // Actually this function is called BY the dialog now.

        let sourcePrices = Object.keys(generatorPrices).length > 0
            ? generatorPrices
            : lastImportedPricesRef.current;
        let sourceKeys = Object.keys(sourcePrices);

        if (sourceKeys.length === 0 && importedDataRef.current.length > 0 && importHeadersRef.current.length > 0) {
            await handleApplyImportedPrices(importHeadersRef.current, importedDataRef.current, (window as any).__csvImportMeta || null);
            sourcePrices = lastImportedPricesRef.current;
            sourceKeys = Object.keys(sourcePrices);
        }

        if (sourceKeys.length === 0 && productId) {
            try {
                const data = await fetchAllGenericProductPrices();

                if (data && data.length > 0) {
                    const formatValueIds = new Set<string>();
                    const materialValueIds = new Set<string>();
                    productAttrs.groups.forEach(group => {
                        if (group.kind === 'format') {
                            (group.values || []).forEach(value => formatValueIds.add(value.id));
                        }
                        if (group.kind === 'material') {
                            (group.values || []).forEach(value => materialValueIds.add(value.id));
                        }
                    });

                    const fallbackPrices: Record<string, any> = {};
                    const fallbackOplag = new Set<number>();
                    data.forEach((row: any) => {
                        const extra = row.extra_data || {};
                        const formatId = extra.formatId || extra.selectionMap?.format;
                        const materialId = extra.materialId || extra.selectionMap?.material;
                        const rawVariantValueIds = Array.isArray(extra.variantValueIds)
                            ? extra.variantValueIds
                            : Array.isArray(extra.selectionMap?.variantValueIds)
                                ? extra.selectionMap.variantValueIds
                                : [];
                        const filteredVariantValueIds = rawVariantValueIds
                            .filter((id: string) => !formatValueIds.has(id) && !materialValueIds.has(id));
                        const variantId = extra.variantId
                            || extra.selectionMap?.variant
                            || (filteredVariantValueIds.length > 0 ? filteredVariantValueIds.slice().sort().join('|') : 'none');
                        if (!formatId || !materialId) return;
                        const qty = Number(row.quantity);
                        const price = Number(row.price_dkk);
                        if (!qty || !price) return;
                        const key = `${formatId}::${materialId}::${variantId || 'none'}::${qty}`;
                        fallbackPrices[key] = { price, markup: 0, isLocked: false };
                        fallbackOplag.add(qty);
                    });

                    if (Object.keys(fallbackPrices).length > 0) {
                        sourcePrices = normalizeGeneratorPrices(fallbackPrices);
                        sourceKeys = Object.keys(sourcePrices);
                        if (selectedOplag.length === 0 && fallbackOplag.size > 0) {
                            setSelectedOplag(Array.from(fallbackOplag).sort((a, b) => a - b));
                        }
                    }
                }
            } catch (e) {
                // Ignore fetch fallback failures and let the normal error message handle it
            }
        }

        const effectiveOplag = selectedOplag.length > 0
            ? selectedOplag
            : (lastImportedOplagRef.current.length > 0
                ? lastImportedOplagRef.current
                : Array.from(new Set(sourceKeys.map(key => {
                    const qtyStr = key.split('::').pop() || '';
                    const qty = parseInt(qtyStr, 10);
                    return Number.isNaN(qty) ? null : qty;
                }).filter((qty): qty is number => qty !== null))).sort((a, b) => a - b));

        // Use generator prices
        const allPrices: Record<string, number> = {};
        if (sourceKeys.length === 0) {
            toast.error('Ingen priser at gemme. Udfyld priserne først.');
            return;
        }

        // Helper to Identify Unique Combinations {Format, Material, Variant}
        // from the keys available in sourcePrices (Anchors)
        const uniqueCombinations = new Set<string>();
        sourceKeys.forEach(key => {
            const parts = key.split('::');
            if (parts.length >= 3) {
                // Reconstruct the combo key formatId::materialId::variantId
                let formatId, materialId, variantId, qtyStr;
                if (parts.length === 4) {
                    [formatId, materialId, variantId] = parts;
                } else {
                    [formatId, materialId] = parts;
                    variantId = 'none';
                }
                uniqueCombinations.add(`${formatId}::${materialId}::${variantId}`);
            }
        });

        // Generate Price for each Combination + Oplag using shared calculation
        uniqueCombinations.forEach(comboKey => {
            const [formatId, materialId, variantId] = comboKey.split('::');

            effectiveOplag.forEach(qty => {
                const fullKey = getGenPriceKey(formatId, materialId, variantId, qty);
                const computed = computeFinalPriceForContextFromSource(sourcePrices, formatId, materialId, variantId, qty);
                if (!computed || !computed.price || computed.price <= 0) return;
                allPrices[fullKey] = computed.price;
            });
        });

        if (Object.keys(allPrices).length === 0) {
            toast.error('Ingen priser at gemme. Udfyld priserne først.');
            return;
        }

        const valueNameById = new Map<string, string>();
        productAttrs.groups.forEach(g => {
            (g.values || []).forEach(v => valueNameById.set(v.id, v.name));
        });

        setSavingTemplate(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Build rows grouped by format+material
            // Build rows grouped by format+material+variant
            const groupedRows = new Map<string, { formatId: string; formatName: string; materialId: string; materialName: string; variantId?: string; variantName?: string; prices: { quantity: number; price: number }[] }>();

            Object.entries(allPrices).forEach(([key, price]) => {
                const parts = key.split('::');
                let formatId, materialId, variantId, qtyStr;

                // Handle new 4-part key (F::M::V::Q)
                if (parts.length === 4) {
                    [formatId, materialId, variantId, qtyStr] = parts;
                } else {
                    // Fallback for older 3-part key (F::M::Q) if needed, though current getGenPriceKey is 4-part
                    [formatId, materialId, qtyStr] = parts;
                    variantId = 'none';
                }

                const qty = parseInt(qtyStr);
                const groupKey = `${formatId}::${materialId}::${variantId}`;

                if (!groupedRows.has(groupKey)) {
                    groupedRows.set(groupKey, {
                        formatId,
                        formatName: valueNameById.get(formatId) || '',
                        materialId,
                        materialName: valueNameById.get(materialId) || '',
                        variantId: variantId !== 'none' ? variantId : undefined,
                        variantName: variantId !== 'none' ? (valueNameById.get(variantId) || '') : undefined,
                        prices: []
                    });
                }

                groupedRows.get(groupKey)!.prices.push({ quantity: qty, price });
            });


            const rows = Array.from(groupedRows.values()).map(row => ({
                ...row,
                prices: row.prices.sort((a, b) => a.quantity - b.quantity)
            }));

            // Auto-generate name from product + formats + materials
            const uniqueFormats = [...new Set(rows.map(r => r.formatName).filter(Boolean))];
            const uniqueMaterials = [...new Set(rows.map(r => r.materialName).filter(Boolean))];
            const formatPart = uniqueFormats.length <= 3 ? uniqueFormats.join(', ') : `${uniqueFormats.length} formater`;
            const materialPart = uniqueMaterials.length <= 3 ? uniqueMaterials.join(', ') : `${uniqueMaterials.length} materialer`;
            const autoName = `${productName} - ${formatPart} × ${materialPart}`;

            const finalName = customName || autoName;

            const pricingStructure = buildPricingStructure();

            const spec = {
                sizeMode,
                formatDisplayMode,
                maxWidthMm: sizeMode === 'free_size' ? maxWidthMm : null,
                maxHeightMm: sizeMode === 'free_size' ? maxHeightMm : null,
                pricingVariantGroupId,
                oplag: effectiveOplag,
                pricing_structure: pricingStructure,
                rows,
                // Save generator state for Bank restoration
                generator_state: {
                    generatorPrices,
                    productMarkups,
                    masterMarkup,
                    genRounding,
                    selectedOplag: effectiveOplag,
                    sizeMode
                }
            };

            const payload = {
                tenant_id: tenantId,
                product_id: productId,
                name: finalName,
                spec,
            };

            let error;
            if (overwriteId) {
                const res = await supabase
                    .from('price_list_templates' as any)
                    .update(payload)
                    .eq('id', overwriteId);
                error = res.error;
            } else {
                const res = await supabase
                    .from('price_list_templates' as any)
                    .insert({ ...payload, created_by: user?.id });
                error = res.error;
            }

            if (error) throw error;
            toast.success(`Prisliste "${finalName}" gemt med ${rows.length} kombinationer!`);

            await fetchTemplates(); // Refresh Bank
            if (showAllTemplates) {
                await fetchAllTemplates();
            }

            // Clear prices only if standard save (not saving to bank while working)
            if (!keepState && !customName) {
                setGeneratorPrices({});
                setProductMarkups({});
                setMasterMarkup(0);
            }
        } catch (e: any) {
            toast.error(e.message || 'Kunne ikke gemme prisliste');
        } finally {
            setSavingTemplate(false);
            setShowSaveDialog(false);
        }
    };

    const handleLoadTemplate = async (t: any) => {
        if (!confirm('Dette vil overskrive din nuværende generator. Er du sikker?')) return;
        const spec = t.spec || {};
        const s = spec.generator_state;
        let derivedOplag: number[] | null = null;
        let resolvedPrices: Record<string, any> | null = null;

        if (spec.sizeMode) setSizeMode(spec.sizeMode);
        if (spec.formatDisplayMode) setFormatDisplayMode(spec.formatDisplayMode);
        if ('maxWidthMm' in spec) setMaxWidthMm(spec.maxWidthMm || '');
        if ('maxHeightMm' in spec) setMaxHeightMm(spec.maxHeightMm || '');
        if ('pricingVariantGroupId' in spec) setPricingVariantGroupId(spec.pricingVariantGroupId || null);

        if (spec.pricing_structure?.mode === 'matrix_layout_v1') {
            applyPricingStructure(spec.pricing_structure);
        } else {
            const fallback = buildFallbackStructureFromTemplate(spec);
            if (fallback) {
                applyPricingStructure(fallback);
            }
        }
        setSelectedSectionValues({});
        setPreviewSelectedFormat(null);

        if (s?.generatorPrices && Object.keys(s.generatorPrices).length > 0) {
            const normalized = normalizeGeneratorPrices(s.generatorPrices);
            resolvedPrices = normalized;
            if (!s.selectedOplag || s.selectedOplag.length === 0) {
                derivedOplag = Array.from(new Set(Object.keys(normalized).map(key => {
                    const qtyStr = key.split('::').pop() || '';
                    const qty = parseInt(qtyStr, 10);
                    return Number.isNaN(qty) ? null : qty;
                }).filter((qty): qty is number => qty !== null))).sort((a, b) => a - b);
            }
        } else if (spec?.prices && typeof spec.prices === 'object') {
            const rebuilt = buildGeneratorPricesFromMap(spec.prices);
            if (rebuilt) {
                resolvedPrices = rebuilt.prices;
                derivedOplag = rebuilt.quantities;
            }
        } else if (spec.rows?.length) {
            const rebuilt = buildGeneratorPricesFromRows(spec.rows, spec);
            if (rebuilt) {
                resolvedPrices = rebuilt.prices;
                derivedOplag = rebuilt.quantities;
            }
        }

        if (s) {
            if (s.productMarkups) setProductMarkups(s.productMarkups);
            if (s.masterMarkup !== undefined) setMasterMarkup(s.masterMarkup);
            if (s.genRounding) setGenRounding(s.genRounding);
            if (s.selectedOplag) setSelectedOplag(s.selectedOplag);
            if (!s.selectedOplag && spec.oplag) setSelectedOplag(spec.oplag);
            if (!s.selectedOplag && !spec.oplag && derivedOplag?.length) setSelectedOplag(derivedOplag);
            toast.success('Skabelon indlæst i generator');
        } else {
            if (spec.oplag) setSelectedOplag(spec.oplag);
            if (!spec.oplag && derivedOplag?.length) setSelectedOplag(derivedOplag);
            if (spec.rows?.length) {
                toast.success('Skabelon indlæst fra prisrækker (gammelt format)');
            } else {
                toast.error('Denne skabelon indeholder ikke generator-data (gammelt format)');
            }
        }

        if (resolvedPrices) {
            setGeneratorPrices(resolvedPrices);
            return;
        }

        if (productId) {
            let data: any[] = [];
            try {
                data = await fetchAllGenericProductPrices();
            } catch {
                data = [];
            }
            if (data && data.length > 0) {
                const fallbackPrices: Record<string, any> = {};
                const fallbackOplag = new Set<number>();
                data.forEach((row: any) => {
                    const extra = row.extra_data || {};
                    const formatId = extra.formatId || extra.selectionMap?.format;
                    const materialId = extra.materialId || extra.selectionMap?.material;
                    const variantId = extra.variantId || extra.selectionMap?.variant || 'none';
                    if (!formatId || !materialId) return;
                    const qty = Number(row.quantity);
                    const price = Number(row.price_dkk);
                    if (!qty || !price) return;
                    const key = `${formatId}::${materialId}::${variantId || 'none'}::${qty}`;
                    fallbackPrices[key] = { price, markup: 0, isLocked: true };
                    fallbackOplag.add(qty);
                });
                if (Object.keys(fallbackPrices).length > 0) {
                    setGeneratorPrices(normalizeGeneratorPrices(fallbackPrices));
                    if (!s?.selectedOplag && !spec.oplag) {
                        setSelectedOplag(Array.from(fallbackOplag).sort((a, b) => a - b));
                    }
                    toast.success('Priser hentet fra udgivne priser');
                    return;
                }
            }
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Slet denne skabelon?')) return;
        const { error } = await supabase.from('price_list_templates' as any).delete().eq('id', id);
        if (!error) {
            toast.success('Skabelon slettet');
            fetchTemplates();
            if (showAllTemplates) {
                fetchAllTemplates();
            }
        } else {
            toast.error('Fejl ved sletning');
        }
    };

    // Preview row count (for combinatorics warning)
    const previewData = useMemo(() => {
        const visibleFormatIds = getVisibleValueIdsByType('formats');
        const visibleMaterialIds = getVisibleValueIdsByType('materials');
        const formats = sizeMode === 'format'
            ? formatGroups
                .flatMap(g => (g.values || []).filter(v => v.enabled))
                .filter(v => visibleFormatIds.size === 0 || visibleFormatIds.has(v.id))
            : [{ id: 'free', name: 'Fri størrelse' }];
        const materials = materialGroups
            .flatMap(g => (g.values || []).filter(v => v.enabled))
            .filter(v => visibleMaterialIds.size === 0 || visibleMaterialIds.has(v.id));
        const variants = activeVariantGroup?.values?.filter(v => v.enabled) || [{ id: 'default', name: 'Standard' }];

        const totalCombinations = formats.length * materials.length * variants.length;
        return {
            formats,
            materials,
            variants,
            total: totalCombinations,
            overflow: totalCombinations > MAX_PREVIEW_ROWS
        };
    }, [sizeMode, formatGroups, materialGroups, activeVariantGroup, getVisibleValueIdsByType]);

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
        const meta = kind === 'format'
            ? {
                bleed_mm: parseFloat(newValueBleed) || 3,
                safe_area_mm: parseFloat(newValueSafeArea) || 3
            }
            : null;

        await productAttrs.addValue(groupId, {
            name: newValueName.trim(),
            key: null,
            sort_order: valueCount,
            enabled: true,
            width_mm: kind === 'format' && newValueWidth ? parseFloat(newValueWidth) : null,
            height_mm: kind === 'format' && newValueHeight ? parseFloat(newValueHeight) : null,
            meta
        });

        setNewValueName('');
        setNewValueWidth('');
        setNewValueHeight('');
        setNewValueBleed('3');
        setNewValueSafeArea('3');
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

    // Derived state for preview pagination
    const sortedOplag = [...selectedOplag].sort((a, b) => a - b);
    const previewCols = 10;
    const startCol = previewAmountPage * previewCols;
    const visibleOplag = sortedOplag.slice(startCol, startCol + previewCols);
    const totalOplag = sortedOplag.length;

    // Reset page if out of bounds
    useEffect(() => {
        if (startCol >= totalOplag && totalOplag > 0) {
            setPreviewAmountPage(0);
        }
    }, [totalOplag, startCol]);

    if (productAttrs.loading || library.loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }



    return (
        <>
            <div className="space-y-6">
                {/* Product Groups - TABBED UI with Library Browsers */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Formater, Materiale, Efterbehandling & Produkter
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Tilføj formater, materialer, efterbehandlinger og produkter fra biblioteket
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveMaterialsToLibrary}
                                disabled={savingMaterialLibrary}
                            >
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {savingMaterialLibrary ? 'Gemmer...' : 'Gem materialer til bibliotek'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveFormatsToLibrary}
                                disabled={savingFormatLibrary}
                            >
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {savingFormatLibrary ? 'Gemmer...' : 'Gem formater til bibliotek'}
                            </Button>
                        </div>

                        {/* Tab Toggle */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Button
                                variant={libraryPanel === 'material' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setLibraryPanel('material')}
                            >
                                Materialer
                            </Button>
                            <Button
                                variant={libraryPanel === 'finish' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setLibraryPanel('finish')}
                            >
                                Efterbehandling
                            </Button>
                            <Button
                                variant={libraryPanel === 'product' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setLibraryPanel('product')}
                            >
                                Produkter
                            </Button>
                            <Button
                                variant={libraryPanel === 'format' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setLibraryPanel('format');
                                    setSizeMode('format');
                                }}
                            >
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                Formater
                            </Button>
                        </div>

                        {/* Library Browser based on tab */}
                        {(libraryPanel === 'material' || libraryPanel === 'finish' || libraryPanel === 'product') && (
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="text-sm font-medium">
                                        Tilføj {libraryPanel === 'material' ? 'materialer' : libraryPanel === 'finish' ? 'efterbehandlinger' : 'produkter'} fra bibliotek
                                    </Label>
                                </div>

                                <AttributeLibraryBrowser
                                    key={`${libraryPanel}-${libraryRefreshKey}`}
                                    type={libraryPanel as 'material' | 'finish' | 'product'}
                                    onCreateNew={() => {
                                        if (libraryPanel === 'material') setShowCreateMaterialDialog(true);
                                        else if (libraryPanel === 'finish') setShowCreateFinishDialog(true);
                                        else setShowCreateProductDialog(true);
                                    }}
                                    onSelect={async (item: any) => {
                                        const scrollY = window.scrollY;

                                        // 1. Validate Target
                                        if (!selectedTarget) {
                                            toast.error("Klik på en boks i 'Prisliste Layout' for at vælge hvor elementet skal tilføjes.");
                                            return;
                                        }

                                        const typeMap: Record<string, string> = { 'material': 'materials', 'finish': 'finishes', 'product': 'products' };
                                        const expectedType = typeMap[libraryPanel];

                                        const targetIsVertical = selectedTarget.type === 'vertical';
                                        if (targetIsVertical && expectedType !== verticalAxisConfig.sectionType) {
                                            toast.error(`Lodret akse er sat til ${verticalAxisConfig.sectionType === 'materials' ? 'Materialer' : 'Formater'}. Skift typen før du tilføjer ${expectedType === 'materials' ? 'materialer' : expectedType === 'finishes' ? 'efterbehandlinger' : 'produkter'}.`);
                                            return;
                                        }

                                        // 2. Get/Create Global Group
                                        const kindMapping: Record<string, string> = {
                                            'material': 'material',
                                            'finish': 'finish',
                                            'product': 'other'
                                        };
                                        const kind = kindMapping[libraryPanel];

                                        let targetGroup = productAttrs.groups.find(g =>
                                            g.kind === kind && g.name.toLowerCase() === (item.category || libraryPanel).toLowerCase()
                                        );

                                        if (!targetGroup) {
                                            const created = await productAttrs.createGroup({
                                                name: item.category || (libraryPanel === 'material' ? 'Materialer' : libraryPanel === 'finish' ? 'Efterbehandling' : 'Produkter'),
                                                kind: kind as any,
                                                ui_mode: 'buttons',
                                                source: 'product',
                                                sort_order: productAttrs.groups.length,
                                                enabled: true,
                                                library_group_id: null
                                            });
                                            if (created) targetGroup = created;
                                            else return;
                                        }

                                        // 3. Add Value
                                        const addedValue = await productAttrs.addValue(targetGroup.id, {
                                            name: item.name,
                                            enabled: true,
                                            sort_order: 0,
                                            key: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                            width_mm: null,
                                            height_mm: null,
                                            meta: item.image_url ? { image: item.image_url } : undefined
                                        });

                                        // 4. Update Target Whitelist
                                        if (addedValue) {
                                            if (targetIsVertical) {
                                                setVerticalAxisConfig(prev => ({
                                                    ...prev,
                                                    valueIds: [...(prev.valueIds || []), addedValue.id]
                                                }));
                                            } else {
                                                setLayoutRows(prev => prev.map(r => ({
                                                    ...r,
                                                    sections: r.sections.map(s => s.id === selectedTarget.id
                                                        ? { ...s, valueIds: [...(s.valueIds || []), addedValue.id], groupId: targetGroup!.id }
                                                        : s
                                                    )
                                                })));
                                            }
                                            toast.success(`Tilføjet ${item.name}`);
                                        }
                                        requestAnimationFrame(() => window.scrollTo(0, scrollY));
                                    }}
                                />
                            </div>
                        )}

                        {libraryPanel === 'format' && (
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="text-sm font-medium">Tilføj formater fra bibliotek</Label>
                                </div>

                                <TemplateLibraryBrowser
                                    key={`format-${libraryRefreshKey}`}
                                    onCreateNew={() => setShowCreateTemplateDialog(true)}
                                    onSelect={async (template: any) => {
                                        const scrollY = window.scrollY;

                                        // 1. Validate Target
                                        if (!selectedTarget) {
                                            toast.error("Klik på en boks i 'Prisliste Layout' for at vælge hvor formatet skal tilføjes.");
                                            return;
                                        }
                                        const targetIsVertical = selectedTarget.type === 'vertical';
                                        if (targetIsVertical && verticalAxisConfig.sectionType !== 'formats') {
                                            toast.error('Lodret akse er ikke sat til Formater. Skift typen før du tilføjer formater.');
                                            return;
                                        }

                                        // 2. Add to Global Group (Ensure group exists)
                                        let targetGroupId = formatGroups[0]?.id;
                                        if (!targetGroupId) {
                                            const created = await productAttrs.createGroup({
                                                name: 'Formater',
                                                kind: 'format',
                                                ui_mode: 'buttons',
                                                source: 'product',
                                                sort_order: productAttrs.groups.length,
                                                enabled: true,
                                                library_group_id: null
                                            });
                                            if (created) targetGroupId = created.id;
                                            else return;
                                        }

                                        // 3. Add Value to Group
                                        const addedValue = await productAttrs.addValue(targetGroupId, {
                                            name: template.name,
                                            width_mm: template.width_mm,
                                            height_mm: template.height_mm,
                                            enabled: true,
                                            sort_order: 0,
                                            key: template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                            meta: {
                                                ...(template.icon_name ? { icon: template.icon_name } : {}),
                                                bleed_mm: template.bleed_mm ?? 3,
                                                safe_area_mm: template.safe_area_mm ?? 3
                                            }
                                        });

                                        // 4. Update Target Whitelist (valueIds)
                                        if (addedValue) {
                                            if (targetIsVertical) {
                                                setVerticalAxisConfig(prev => ({
                                                    ...prev,
                                                    valueIds: [...(prev.valueIds || []), addedValue.id]
                                                }));
                                            } else {
                                                setLayoutRows(prev => prev.map(r => ({
                                                    ...r,
                                                    sections: r.sections.map(s => s.id === selectedTarget.id
                                                        ? { ...s, valueIds: [...(s.valueIds || []), addedValue.id], groupId: targetGroupId }
                                                        : s
                                                    )
                                                })));
                                            }
                                            toast.success(`Tilføjet ${template.name}`);
                                        }
                                        requestAnimationFrame(() => window.scrollTo(0, scrollY));
                                    }}
                                />
                            </div>
                        )}


                        {/* Active items on this product removed - managed in Prisliste Layout */}
                    </CardContent>

                    {/* Create Library Item Dialogs */}
                    <CreateAttributeLibraryItemDialog
                        open={showCreateMaterialDialog}
                        onOpenChange={setShowCreateMaterialDialog}
                        type="material"
                        onSuccess={() => setLibraryRefreshKey(k => k + 1)}
                    />
                    <CreateAttributeLibraryItemDialog
                        open={showCreateFinishDialog}
                        onOpenChange={setShowCreateFinishDialog}
                        type="finish"
                        onSuccess={() => setLibraryRefreshKey(k => k + 1)}
                    />
                    <CreateAttributeLibraryItemDialog
                        open={showCreateProductDialog}
                        onOpenChange={setShowCreateProductDialog}
                        type="product"
                        onSuccess={() => setLibraryRefreshKey(k => k + 1)}
                    />
                </Card>

                {/* ============ LAYOUT BUILDER - Rows & Sections ============ */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                Prisliste Layout
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetLayoutConfig}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                Nulstil layout
                            </Button>
                        </div>
                        <CardDescription className="text-xs">
                            Organiser formater og produkter i rækker og sektioner (maks. 3 kolonner per række)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />

                        <div className="flex gap-4 min-h-[400px]">
                            {/* Left: Vertical Axis Box */}
                            <div
                                className={cn(
                                    "w-1/4 min-w-[240px] p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col gap-3",
                                    selectedTarget?.type === 'vertical' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-muted bg-muted/10 hover:border-primary/50"
                                )}
                                onClick={() => setSelectedTarget({ type: 'vertical', id: 'vertical-axis' })}
                            >
                                <div>
                                    <Label className="text-sm font-bold block">Lodret akse</Label>
                                    <span className="text-[10px] text-muted-foreground uppercase">Rækkeprodukt</span>
                                </div>

                                <Select
                                    value={verticalAxisConfig.sectionType}
                                    onValueChange={(v: AttributeType) => {
                                        // 1. Update Vertical Axis
                                        setVerticalAxisConfig(prev => ({ ...prev, sectionType: v, valueIds: [] }));

                                        // 2. Force valid defaults on Rows (exclude new vertical type)
                                        setLayoutRows(prev => prev.map(row => ({
                                            ...row,
                                            sections: row.sections.map(sec => {
                                                if (sec.sectionType === v) {
                                                    // Find a safe default
                                                    const safeType = ['formats', 'materials', 'products', 'finishes'].find(t => t !== v) as AttributeType;
                                                    return { ...sec, sectionType: safeType, valueIds: [] };
                                                }
                                                return sec;
                                            })
                                        })));
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="materials">Materialer</SelectItem>
                                        <SelectItem value="formats">Formater</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="space-y-1 my-2">
                                    <Input
                                        placeholder="Titel (f.eks. Materiale)"
                                        value={verticalAxisConfig.title || ''}
                                        onChange={(e) => setVerticalAxisConfig(prev => ({ ...prev, title: e.target.value }))}
                                        className="h-7 text-xs"
                                    />
                                    <Input
                                        placeholder="Beskrivelse (valgfri)"
                                        value={verticalAxisConfig.description || ''}
                                        onChange={(e) => setVerticalAxisConfig(prev => ({ ...prev, description: e.target.value }))}
                                        className="h-7 text-xs text-muted-foreground"
                                    />
                                </div>

                                <div className="flex-1 min-h-[100px] bg-background rounded border p-2 flex flex-col gap-1">
                                    {(productAttrs.groups || [])
                                        .flatMap(g => (g.values || []))
                                        .filter(v => verticalAxisConfig.valueIds?.includes(v.id))
                                        .map(v => {
                                            const settings = verticalAxisConfig.valueSettings?.[v.id];
                                            return (
                                                <div key={v.id} className="group flex items-center justify-between p-1.5 rounded border bg-card text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{v.name}</span>
                                                        {settings?.showThumbnail && <Badge variant="outline" className="text-[9px] px-1 h-4">Img</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingValueId(v.id);
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">Rediger</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant={settings?.showThumbnail ? "default" : "ghost"}
                                                                        size="icon"
                                                                        className="h-5 w-5"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setVerticalAxisConfig(prev => ({
                                                                                ...prev,
                                                                                valueSettings: {
                                                                                    ...prev.valueSettings,
                                                                                    [v.id]: { ...settings, showThumbnail: !settings?.showThumbnail }
                                                                                }
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <ImageIcon className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">Vis billede</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            triggerUpload('vertical-axis', v.id);
                                                                        }}
                                                                    >
                                                                        <CloudUpload className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">Upload billede</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <div className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setVerticalAxisConfig(prev => ({
                                                                    ...prev,
                                                                    valueIds: prev.valueIds?.filter(id => id !== v.id)
                                                                }));
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                    {(!verticalAxisConfig.valueIds || verticalAxisConfig.valueIds.length === 0) && (
                                        <div className="flex flex-col items-center justify-center p-4 text-muted-foreground h-full">
                                            <span className="text-[10px] italic text-center">
                                                Valgte værdier vises her
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* === RIGHT: HORIZONTAL ROWS === */}
                            <DndContext
                                sensors={unifiedSensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleUnifiedDragStart}
                                onDragOver={handleUnifiedDragOver}
                                onDragEnd={handleUnifiedDragEnd}
                            >
                            <SortableContext items={layoutRows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                            {/* Drag overlay for smooth column dragging */}
                            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
                                {activeDragItem?.type === 'column' && (
                                    <ColumnDragPreview sectionType={
                                        layoutRows.flatMap(r => r.sections).find(s => s.id === activeDragItem.id)?.sectionType || 'materials'
                                    } />
                                )}
                            </DragOverlay>
                            <div className="flex-1 space-y-6 pl-8">
                                {layoutRows.map((row, rowIndex) => (
                                    <DraggableLayoutRow
                                        key={row.id}
                                        row={row}
                                        rowIndex={rowIndex}
                                        isOver={overTargetId === row.id && activeDragItem?.type === 'row' && activeDragItem?.id !== row.id}
                                        isColumnDragging={activeDragItem?.type === 'column'}
                                        activeDragRowId={activeDragItem?.type === 'column' ? activeDragItem?.data?.rowId : null}
                                    >
                                        <div className="flex flex-col gap-2 mb-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Række {rowIndex + 1}</Label>
                                                {row.sections.length > 1 && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {row.sections.length} kolonner
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Række Titel (f.eks. Efterbehandling)"
                                                    value={row.title || ''}
                                                    onChange={e => setLayoutRows(prev => prev.map(r => r.id === row.id ? { ...r, title: e.target.value } : r))}
                                                    className="h-7 text-xs flex-1"
                                                />
                                                <Input
                                                    placeholder="Beskrivelse (valgfri)"
                                                    value={row.description || ''}
                                                    onChange={e => setLayoutRows(prev => prev.map(r => r.id === row.id ? { ...r, description: e.target.value } : r))}
                                                    className="h-7 text-xs flex-1 text-muted-foreground"
                                                />
                                            </div>
                                            <div className="flex gap-1">
                                                {row.sections.length < 6 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs"
                                                        onClick={() => {
                                                            setLayoutRows(prev => prev.map(r =>
                                                                r.id === row.id
                                                                    ? { ...r, sections: [...r.sections, { id: `section-${Date.now()}`, groupId: '', sectionType: 'materials', valueIds: [], ui_mode: 'buttons', selection_mode: 'required' }] }
                                                                    : r
                                                            ));
                                                        }}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Kolonne
                                                    </Button>
                                                )}
                                                {layoutRows.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs text-red-500 hover:text-red-600"
                                                        onClick={() => setLayoutRows(prev => prev.filter(r => r.id !== row.id))}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className={cn(
                                            "grid gap-3 p-3 pt-5 bg-muted/30 rounded-lg border-2 border-dashed",
                                            row.sections.length === 1 && "grid-cols-1",
                                            row.sections.length === 2 && "grid-cols-2",
                                            row.sections.length === 3 && "grid-cols-3",
                                            row.sections.length === 4 && "grid-cols-4",
                                            row.sections.length === 5 && "grid-cols-5",
                                            row.sections.length >= 6 && "grid-cols-6"
                                        )}>
                                            {row.sections.map((section, sectionIndex) => (
                                                <DraggableColumn
                                                    key={section.id}
                                                    section={section}
                                                    sectionIndex={sectionIndex}
                                                    rowId={row.id}
                                                    canDrag={layoutRows.length > 1 || row.sections.length > 1}
                                                    isDragging={activeDragItem?.id === section.id}
                                                >
                                                <div
                                                    className={cn(
                                                        "min-h-[120px] p-2 bg-background rounded border flex flex-col gap-2 transition-all cursor-pointer",
                                                        sectionIndex > 0 && "border-l-4 border-l-muted",
                                                        selectedTarget?.id === section.id ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/50"
                                                    )}
                                                    onClick={() => setSelectedTarget({ type: 'section', id: section.id })}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <Select
                                                            value={section.sectionType}
                                                            onValueChange={(v: AttributeType) => {
                                                                setLayoutRows(prev => prev.map(r =>
                                                                    r.id === row.id
                                                                        ? { ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, sectionType: v, valueIds: [] } : s) }
                                                                        : r
                                                                ));
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {['products', 'formats', 'materials', 'finishes']
                                                                    .filter(t => t !== verticalAxisConfig.sectionType) // Exclude vertical type
                                                                    .map(t => (
                                                                        <SelectItem key={t} value={t}>
                                                                            {t === 'products' ? 'Produkter' : t === 'formats' ? 'Formater' : t === 'materials' ? 'Materialer' : 'Efterbehandling'}
                                                                        </SelectItem>
                                                                    ))
                                                                }
                                                            </SelectContent>
                                                        </Select>

                                                        {/* Move column to another row */}
                                                        {row.sections.length > 1 && layoutRows.length > 1 && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => e.stopPropagation()}>
                                                                        <MoveRight className="h-3 w-3" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                                                                    <DropdownMenuLabel className="text-xs">Flyt til række</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {layoutRows.filter(r => r.id !== row.id && r.sections.length < 6).map((targetRow, idx) => (
                                                                        <DropdownMenuItem
                                                                            key={targetRow.id}
                                                                            onClick={() => handleMoveColumnToRow(section.id, row.id, targetRow.id)}
                                                                        >
                                                                            Række {layoutRows.findIndex(r => r.id === targetRow.id) + 1}
                                                                            {targetRow.title && ` - ${targetRow.title}`}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                        {row.sections.length > 1 && (
                                                            <Button
                                                                variant="ghost" size="icon" className="h-5 w-5"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLayoutRows(prev => prev.map(r =>
                                                                        r.id === row.id
                                                                            ? { ...r, sections: r.sections.filter(s => s.id !== section.id) }
                                                                            : r
                                                                    ));
                                                                }}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <Input
                                                            placeholder="Sektion Titel"
                                                            value={section.title || ''}
                                                            onChange={e => setLayoutRows(prev => prev.map(r => r.id === row.id ? { ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s) } : r))}
                                                            onClick={e => e.stopPropagation()}
                                                            className="h-6 text-xs"
                                                        />
                                                        <Input
                                                            placeholder="Beskrivelse"
                                                            value={section.description || ''}
                                                            onChange={e => setLayoutRows(prev => prev.map(r => r.id === row.id ? { ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, description: e.target.value } : s) } : r))}
                                                            onClick={e => e.stopPropagation()}
                                                            className="h-6 text-xs text-muted-foreground"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="outline" className={cn("text-[10px]", KIND_COLORS[section.sectionType] || 'bg-gray-100')}>
                                                            {KIND_LABELS[section.sectionType]}
                                                        </Badge>
                                                        <span className="text-xs font-medium truncate">{section.title}</span>
                                                        <Label className="text-[10px] text-muted-foreground">Regel:</Label>
                                                        <Select
                                                            value={section.selection_mode || 'required'}
                                                            onValueChange={(v: SelectionMode) => {
                                                                setLayoutRows(prev => prev.map(r =>
                                                                    r.id === row.id
                                                                        ? { ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, selection_mode: v } : s) }
                                                                        : r
                                                                ));
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-6 text-xs w-24"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="required">Påkrævet</SelectItem>
                                                                <SelectItem value="optional">Valgfri</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Label className="text-[10px] text-muted-foreground">Visning:</Label>
                                                        <Select
                                                            value={section.ui_mode || 'buttons'}
                                                            onValueChange={(v: DisplayMode) => {
                                                                setLayoutRows(prev => prev.map(r =>
                                                                    r.id === row.id
                                                                        ? { ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, ui_mode: v } : s) }
                                                                        : r
                                                                ));
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="buttons">Knapper</SelectItem>
                                                                <SelectItem value="dropdown">Dropdown</SelectItem>
                                                                <SelectItem value="checkboxes">Checkboxes</SelectItem>
                                                                <SelectItem value="hidden">Skjul</SelectItem>
                                                                <SelectItem value="small">Billeder S (40px)</SelectItem>
                                                                <SelectItem value="medium">Billeder M (64px)</SelectItem>
                                                                <SelectItem value="large">Billeder L (96px)</SelectItem>
                                                                <SelectItem value="xl">Billeder XL (128px)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Values - Sortable */}
                                                    <SortableContext items={section.valueIds || []} strategy={verticalListSortingStrategy}>
                                                    <div className="flex-1 flex flex-col gap-1 p-1 min-h-[60px]">
                                                        {/* Render values in the order of valueIds */}
                                                        {(section.valueIds || []).map(valueId => {
                                                            const v = (productAttrs.groups || [])
                                                                .flatMap(g => (g.values || []))
                                                                .find(val => val.id === valueId);
                                                            if (!v) return null;
                                                            const settings = section.valueSettings?.[v.id];
                                                            return (
                                                                <SortableValue
                                                                    key={v.id}
                                                                    value={v}
                                                                    rowId={row.id}
                                                                    sectionId={section.id}
                                                                    settings={settings}
                                                                    onEdit={() => setEditingValueId(v.id)}
                                                                    onToggleThumbnail={() => {
                                                                        setLayoutRows(prev => prev.map(r =>
                                                                            r.id === row.id
                                                                                ? {
                                                                                    ...r, sections: r.sections.map(s => s.id === section.id
                                                                                        ? {
                                                                                            ...s,
                                                                                            valueSettings: {
                                                                                                ...s.valueSettings,
                                                                                                [v.id]: { ...settings, showThumbnail: !settings?.showThumbnail }
                                                                                            }
                                                                                        }
                                                                                        : s)
                                                                                }
                                                                                : r
                                                                        ));
                                                                    }}
                                                                    onUpload={() => triggerUpload(section.id, v.id)}
                                                                    onRemove={() => {
                                                                        setLayoutRows(prev => prev.map(r =>
                                                                            r.id === row.id
                                                                                ? {
                                                                                    ...r, sections: r.sections.map(s => s.id === section.id
                                                                                        ? { ...s, valueIds: s.valueIds?.filter(id => id !== v.id) }
                                                                                        : s)
                                                                                }
                                                                                : r
                                                                        ));
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                        {(!section.valueIds || section.valueIds.length === 0) && (
                                                            <span className="text-[10px] text-muted-foreground italic p-1 text-center mt-2">
                                                                Klik for at vælg
                                                            </span>
                                                        )}
                                                    </div>
                                                    </SortableContext>
                                                </div>
                                                </DraggableColumn>
                                            ))}
                                        </div>
                                    </DraggableLayoutRow>
                                ))}

                                {/* Add new row button */}
                                {layoutRows.length < 10 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                            setLayoutRows(prev => [...prev, {
                                                id: `row-${Date.now()}`,
                                                sections: [{ id: `section-${Date.now()}`, groupId: '', sectionType: 'materials', valueIds: [], ui_mode: 'buttons', selection_mode: 'required' }]
                                            }]);
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Tilføj ny række
                                    </Button>
                                )}
                            </div>
                            </SortableContext>
                            </DndContext>
                        </div>
                    </CardContent>
                </Card>

                {/* ============ E) OPLAG BUILDER ============ */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Antal</CardTitle>
                        <CardDescription className="text-xs">
                            Vælg hvilke oplag/mængder der skal inkluderes i prislisten
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {PRESET_QUANTITIES.map(qty => (
                                <button
                                    key={qty}
                                    onClick={() => toggleOplag(qty)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                        selectedOplag.includes(qty)
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    )}
                                >
                                    {qty.toLocaleString()}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-xs">
                            <Input
                                type="number"
                                placeholder="Brugerdefineret oplag"
                                value={customOplag}
                                onChange={(e) => setCustomOplag(e.target.value)}
                                className="h-9"
                                onKeyDown={(e) => e.key === 'Enter' && addCustomOplag()}
                            />
                            <Button size="sm" variant="outline" onClick={addCustomOplag}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {selectedOplag.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {selectedOplag.map(qty => (
                                    <Badge key={qty} variant="secondary" className="gap-1">
                                        {qty.toLocaleString()}
                                        <button onClick={() => toggleOplag(qty)} className="hover:text-destructive">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ============ G) SMART PRICE GENERATOR ============ */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Wand2 className="h-4 w-4" />
                                    SmartPriceGenerator
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Generér priser for én kombination ad gangen, tilføj til kladde
                                </CardDescription>
                            </div>
                            <Button
                                variant={showGenerator ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setShowGenerator(!showGenerator)}
                            >
                                {showGenerator ? 'Skjul' : 'Åbn generator'}
                            </Button>
                        </div>
                    </CardHeader>
                    {showGenerator && (
                        <CardContent className="space-y-4">
                            {/* Status controls */}
                            <div className="flex items-center justify-end bg-muted/30 p-2 rounded-lg">
                                {/* Current status indicator */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Aktuel status:</span>
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        getCurrentCombinationStatusValue() === 'pristine' && "bg-muted text-muted-foreground",
                                        getCurrentCombinationStatusValue() === 'in_progress' && "bg-yellow-100 text-yellow-700 border border-yellow-400",
                                        getCurrentCombinationStatusValue() === 'done' && "bg-green-100 text-green-700 border border-green-500"
                                    )}>
                                        {getCurrentCombinationStatusValue() === 'pristine' && 'Ikke startet'}
                                        {getCurrentCombinationStatusValue() === 'in_progress' && 'I gang'}
                                        {getCurrentCombinationStatusValue() === 'done' && 'Færdig ✓'}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={cycleCombinationStatus}
                                        className="h-6 text-xs px-2"
                                    >
                                        Skift status
                                    </Button>
                                </div>
                            </div>

                            {/* Status legend with cycling instruction */}
                            <div className="flex items-center gap-4 p-2 bg-muted/20 rounded-lg">
                                <span className="text-[10px] text-muted-foreground font-medium">Klik gentagne gange på en kombination for at skifte status:</span>
                                <div className="flex items-center gap-3 text-[10px]">
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded border bg-muted/50" />
                                        <span className="text-muted-foreground">Ikke startet</span>
                                    </div>
                                    <span className="text-muted-foreground">→</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded border border-yellow-400 bg-yellow-100" />
                                        <span className="text-yellow-700">I gang</span>
                                    </div>
                                    <span className="text-muted-foreground">→</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded border border-green-500 bg-green-100" />
                                        <span className="text-green-700">Færdig</span>
                                    </div>
                                </div>
                            </div>

                            {/* Selection row - Preview */}
                            <div className="space-y-6">
                                {/* Preview Header - No Admin noise */}
                                <div className="flex flex-col gap-6">

                                    {/* Vertical Axis (Left Column Headers) - Interactive Selection for Generator */}
                                    {verticalAxisConfig.valueIds && verticalAxisConfig.valueIds.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                {verticalAxisConfig.sectionType === 'formats' ? 'Format' : verticalAxisConfig.sectionType === 'materials' ? 'Materiale' : 'Produkt'}
                                                <span className="text-xs ml-2 text-muted-foreground font-normal">(Fra Lodret Akse)</span>
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {(productAttrs.groups || [])
                                                    .flatMap(g => (g.values || []))
                                                    .filter(v => verticalAxisConfig.valueIds?.includes(v.id))
                                                    .map(v => {
                                                        const selectedValue = selectedSectionValues[verticalSectionId] || verticalAxisConfig.valueIds?.[0] || '';
                                                        const setSelectedValue = (val: string) => {
                                                            setSelectedSectionValues(prev => ({ ...prev, [verticalSectionId]: val }));
                                                        };

                                                        const isSelected = selectedValue === v.id;
                                                        const settings = verticalAxisConfig.valueSettings?.[v.id];

                                                        return (
                                                            <button
                                                                key={v.id}
                                                                onClick={() => setSelectedValue(v.id)}
                                                                className={cn(
                                                                    "h-10 px-4 rounded-md text-sm font-medium transition-all flex items-center gap-2 border",
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                                        : "bg-background hover:bg-muted text-foreground border-input"
                                                                )}
                                                            >
                                                                {settings?.showThumbnail && settings.customImage && (
                                                                    <img src={settings.customImage} className="w-5 h-5 object-cover rounded" />
                                                                )}
                                                                {v.name}
                                                            </button>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {/* Horizontal Rows */}
                                    <div className="space-y-4">
                                        {layoutRows.map((row) => {
                                            const visibleSections = row.sections.filter(section => section.ui_mode !== 'hidden');
                                            if (visibleSections.length === 0) return null;

                                            return (
                                                <div key={row.id} className={cn(
                                                    "grid gap-6",
                                                    visibleSections.length === 1 && "grid-cols-1",
                                                    visibleSections.length === 2 && "grid-cols-1 md:grid-cols-2",
                                                    visibleSections.length >= 3 && "grid-cols-1 md:grid-cols-3"
                                                )}>
                                                    {visibleSections.map((section) => {
                                                        const values = (productAttrs.groups || [])
                                                            .flatMap(g => (g.values || []))
                                                            .filter(v => section.valueIds?.includes(v.id));
                                                        const isOptional = section.selection_mode === 'optional';
                                                        const selectedValue = isOptional
                                                            ? (selectedSectionValues[section.id] || '')
                                                            : (selectedSectionValues[section.id] || values[0]?.id || '');
                                                        const setSelectedValue = (val: string) => {
                                                            setSelectedSectionValues(prev => {
                                                                const next = { ...prev };
                                                                const current = prev[section.id];
                                                                if (isOptional && current === val) {
                                                                    delete next[section.id];
                                                                } else {
                                                                    next[section.id] = val;
                                                                    if (section.sectionType === 'finishes') {
                                                                        const allFinishSections = layoutRows.flatMap(r => r.sections).filter(s => s.sectionType === 'finishes');
                                                                        if (isOptional) {
                                                                            allFinishSections.forEach(finishSection => {
                                                                                if (finishSection.id !== section.id && finishSection.selection_mode === 'optional') {
                                                                                    delete next[finishSection.id];
                                                                                }
                                                                            });
                                                                        } else {
                                                                            allFinishSections.forEach(finishSection => {
                                                                                if (finishSection.selection_mode === 'optional') {
                                                                                    delete next[finishSection.id];
                                                                                }
                                                                            });
                                                                        }

                                                                        // Two-sided finishes require 4+4 print.
                                                                        const selectedName = (values.find(v => v.id === val)?.name || '').toLowerCase();
                                                                        const requiresFourFour = selectedName.includes('2 sider') || selectedName.includes('2 side');
                                                                        if (requiresFourFour) {
                                                                            const printSection = layoutRows
                                                                                .flatMap(r => r.sections)
                                                                                .find(s => s.sectionType === 'products' && s.ui_mode !== 'hidden');
                                                                            if (printSection) {
                                                                                const printValues = (productAttrs.groups || [])
                                                                                    .flatMap(g => g.values || [])
                                                                                    .filter(v => printSection.valueIds?.includes(v.id));
                                                                                const fourFourValue = printValues.find(v => {
                                                                                    const n = (v.name || '').toLowerCase();
                                                                                    return n.includes('4+4') || n.includes('4/4');
                                                                                });
                                                                                if (fourFourValue) {
                                                                                    next[printSection.id] = fourFourValue.id;
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                return next;
                                                            });
                                                        };

                                                        const displayMode = section.ui_mode || 'buttons';

                                                        if (values.length === 0) return null;

                                                        return (
                                                            <div key={section.id} className="space-y-1.5">
                                                                <Label className="text-sm font-medium">
                                                                    {section.sectionType === 'formats' ? 'Format' : section.sectionType === 'materials' ? 'Materiale' : section.sectionType === 'finishes' ? 'Efterbehandling' : 'Produkt'}
                                                                </Label>

                                                                {displayMode === 'dropdown' ? (
                                                                    <Select
                                                                        value={selectedValue || (isOptional ? '__none__' : '')}
                                                                        onValueChange={(val) => {
                                                                            if (isOptional && val === '__none__') {
                                                                                setSelectedSectionValues(prev => {
                                                                                    const next = { ...prev };
                                                                                    delete next[section.id];
                                                                                    return next;
                                                                                });
                                                                                return;
                                                                            }
                                                                            setSelectedValue(val);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue placeholder="Vælg..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {isOptional && (
                                                                                <SelectItem value="__none__">Ingen</SelectItem>
                                                                            )}
                                                                            {values.map(v => {
                                                                                const settings = section.valueSettings?.[v.id];
                                                                                return (
                                                                                    <SelectItem key={v.id} value={v.id}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {settings?.showThumbnail && settings.customImage && (
                                                                                                <img src={settings.customImage} className="w-6 h-6 object-cover rounded" />
                                                                                            )}
                                                                                            {v.name}
                                                                                        </div>
                                                                                    </SelectItem>
                                                                                );
                                                                            })}
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : displayMode === 'checkboxes' ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {values.map(v => {
                                                                            const isSelected = selectedValue === v.id;
                                                                            const settings = section.valueSettings?.[v.id];
                                                                            return (
                                                                                <div key={v.id} className="flex items-center space-x-2 border p-2 rounded cursor-pointer hover:bg-muted/50" onClick={() => setSelectedValue(v.id)}>
                                                                                    <Checkbox checked={isSelected} />
                                                                                    <div className="flex items-center gap-2">
                                                                                        {settings?.showThumbnail && settings.customImage && (
                                                                                            <img src={settings.customImage} className="w-6 h-6 object-cover rounded" />
                                                                                        )}
                                                                                        <span className="text-sm">{v.name}</span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : ['small', 'medium', 'large', 'xl'].includes(displayMode) ? (
                                                                    /* Picture grid display */
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {values.map(v => {
                                                                            const isSelected = selectedValue === v.id;
                                                                            const settings = section.valueSettings?.[v.id];
                                                                            const thumbUrl = settings?.customImage;
                                                                            const size = PICTURE_SIZES[displayMode as PictureSizeMode] || PICTURE_SIZES.medium;
                                                                            return (
                                                                                <button
                                                                                    key={v.id}
                                                                                    onClick={() => setSelectedValue(v.id)}
                                                                                    className={cn(
                                                                                        "relative rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden",
                                                                                        isSelected
                                                                                            ? "border-primary ring-2 ring-primary/20"
                                                                                            : "border-muted hover:border-muted-foreground/50"
                                                                                    )}
                                                                                    style={{ width: size.width, minHeight: size.height + (displayMode !== 'small' ? 22 : 0) }}
                                                                                >
                                                                                    {thumbUrl ? (
                                                                                        <img src={thumbUrl} alt={v.name} className="w-full object-cover rounded-t-md" style={{ height: size.height }} />
                                                                                    ) : (
                                                                                        <div
                                                                                            className={cn(
                                                                                                "w-full flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground rounded-t-md",
                                                                                                isSelected && "bg-primary/10 text-primary"
                                                                                            )}
                                                                                            style={{ height: size.height }}
                                                                                        >
                                                                                            {(v.name || '?').slice(0, 3).toUpperCase()}
                                                                                        </div>
                                                                                    )}
                                                                                    {displayMode !== 'small' && (
                                                                                        <span className="text-[10px] leading-tight text-center truncate w-full px-1 py-0.5">
                                                                                            {v.name}
                                                                                        </span>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    /* Default: buttons */
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {values.map(v => {
                                                                            const isSelected = selectedValue === v.id;
                                                                            const settings = section.valueSettings?.[v.id];
                                                                            return (
                                                                                <button
                                                                                    key={v.id}
                                                                                    onClick={() => setSelectedValue(v.id)}
                                                                                    className={cn(
                                                                                        "h-10 px-4 rounded-md text-sm font-medium transition-all flex items-center gap-2 border",
                                                                                        isSelected
                                                                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                                                            : "bg-background hover:bg-muted text-foreground border-input"
                                                                                    )}
                                                                                >
                                                                                    {settings?.showThumbnail && settings.customImage && (
                                                                                        <img src={settings.customImage} className="w-5 h-5 object-cover rounded" />
                                                                                    )}
                                                                                    {v.name}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {(verticalAxisConfig.valueIds?.length === 0 || !verticalAxisConfig.valueIds) && layoutRows.every(r => r.sections.every(s => !s.valueIds || s.valueIds.length === 0)) && (
                                        <div className="p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                                            <p className="text-muted-foreground mb-2">Ingen konfiguration tilgængelig</p>
                                            <p className="text-xs text-muted-foreground">
                                                Tilføj formater, materialer eller andre attributter i layout-sektionerne ovenfor for at bruge prisgeneratoren.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Variant selection (if active pricing group) - always shown */}
                            {activeVariantGroup && (
                                <div className="space-y-1 pt-4 border-t mt-4">
                                    <Label className="text-sm font-medium">{activeVariantGroup.name}</Label>
                                    <Select value={genSelectedVariant} onValueChange={setGenSelectedVariant}>
                                        <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="Vælg variant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(activeVariantGroup.values || []).filter(v => v.enabled).map(v => (
                                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {activeGenFormat && activeGenMaterial && copyOptions.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-3">
                                    <span className="text-xs text-muted-foreground">Kopier priser fra:</span>
                                    <Select
                                        value={copySourceKey}
                                        onValueChange={(value) => {
                                            setCopySourceKey(value);
                                            handleCopyPricesFrom(value);
                                            requestAnimationFrame(() => setCopySourceKey(''));
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-full md:w-[320px] text-xs">
                                            <SelectValue placeholder="Vælg kombination..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {copyOptions.map(option => (
                                                <SelectItem key={option.key} value={option.key}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Anchor points - auto-generated from selected oplag */}
                            < div className="space-y-2" >
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium">
                                        Ankerpunkter ({selectedOplag.length} mængder)
                                    </Label>
                                    {selectedOplag.length > 5 && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setAnchorPage(p => Math.max(0, p - 1))}
                                                disabled={anchorPage === 0}
                                                className="h-6 w-6 p-0"
                                            >
                                                <ChevronUp className="h-3 w-3 rotate-[-90deg]" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                {anchorPage * 5 + 1}-{Math.min((anchorPage + 1) * 5, selectedOplag.length)} af {selectedOplag.length}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setAnchorPage(p => Math.min(Math.ceil(selectedOplag.length / 5) - 1, p + 1))}
                                                disabled={(anchorPage + 1) * 5 >= selectedOplag.length}
                                                className="h-6 w-6 p-0"
                                            >
                                                <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {
                                    selectedOplag.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-2">
                                            Vælg oplag mængder først for at definere ankerpunkter
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* ========================================== */}
                                            {/* PROTECTED CORE LOGIC: GENERATOR RENDER LOOP */}
                                            {/* Handles Manual Anchors vs Slider Overrides  */}
                                            {/* ========================================== */}
                                            {selectedOplag.slice(anchorPage * 5, (anchorPage + 1) * 5).map(qty => {
                                                const anchorData = getAnchorData(qty);
                                                const isLocked = !!anchorData.isLocked;
                                                let rawInterpolatedBase = 0;

                                                // Defensive calculations
                                                const localMarkup = Number(anchorData.markup) || 0;
                                                const prodMarkup = productMarkups[`${activeGenFormat}::${activeGenMaterial}`] || 0;
                                                const master = Number(masterMarkup) || 0;
                                                const rnd = Number(genRounding) || 1;
                                                const totalMultiplier = (1 + localMarkup / 100) * (1 + prodMarkup / 100) * (1 + master / 100);

                                                // Calculate interpolated price safely - ONLY if between two anchors
                                                let interpolatedPrice: number | null = null;
                                                let isBetweenAnchors = false;

                                                if (!isLocked) {
                                                    try {
                                                        const anchors = getAnchorsForContext(activeGenFormat, activeGenMaterial, activeGenVariant);
                                                        if (anchors.length >= 2) {
                                                            // Check if this qty is BETWEEN two anchors (not outside the range)
                                                            const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
                                                            const afterAnchor = anchors.find(a => a.quantity > qty);
                                                            isBetweenAnchors = !!(beforeAnchor && afterAnchor);

                                                            if (isBetweenAnchors) {
                                                                let price = interpolatePrice(qty, anchors);
                                                                rawInterpolatedBase = price;
                                                                price = price * (1 + localMarkup / 100);
                                                                price = price * (1 + prodMarkup / 100);
                                                                price = price * (1 + master / 100);
                                                                interpolatedPrice = Math.round(price / rnd) * rnd;
                                                            }
                                                        }
                                                    } catch (e) { }
                                                }

                                                // Calculate display price
                                                let displayPrice: number | string = '';
                                                if (isLocked && typeof anchorData.price === 'number') {
                                                    const val = anchorData.price * totalMultiplier;
                                                    if (!isNaN(val)) {
                                                        displayPrice = Math.round(val / rnd) * rnd;
                                                    }
                                                }

                                                return (
                                                    <div key={qty} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                                                        {/* Quantity - static label */}
                                                        <div className="w-24 font-medium text-sm">
                                                            {qty.toLocaleString()} stk
                                                        </div>

                                                        {/* Anchor Checkbox or Lock Icon */}
                                                        {isLocked && anchorData.excludeFromCurve ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 p-0 mr-1 hover:bg-transparent"
                                                                onClick={() => setAnchorData(qty, { isLocked: false, excludeFromCurve: false })}
                                                                title="Locked override (click to remove)"
                                                            >
                                                                <Lock className="h-4 w-4 text-primary" />
                                                            </Button>
                                                        ) : (
                                                            <Checkbox
                                                                checked={isLocked}
                                                                onCheckedChange={(checked) => {
                                                                    setAnchorData(qty, { isLocked: !!checked, excludeFromCurve: false });
                                                                }}
                                                                className="mr-1"
                                                            />
                                                        )}

                                                        {/* Price input - shows FINAL price (base × individual markup × product markup) */}
                                                        <div className="relative w-28">
                                                            <Input
                                                                type="number"
                                                                placeholder={interpolatedPrice ? String(interpolatedPrice) : "Pris"}
                                                                value={
                                                                    // If locked (anchor) or excluded (individual override), show manual value
                                                                    (isLocked || anchorData.excludeFromCurve) && anchorData.price
                                                                        ? Math.round(anchorData.price * (1 + (anchorData.markup || 0) / 100) * (1 + prodMarkup / 100) * (1 + master / 100) / rnd) * rnd
                                                                        // If there's an interpolated value, show that instead
                                                                        : interpolatedPrice
                                                                            ? interpolatedPrice
                                                                            // Otherwise show manual value if exists, or empty
                                                                            : anchorData.price
                                                                                ? Math.round(anchorData.price * (1 + (anchorData.markup || 0) / 100) * (1 + prodMarkup / 100) * (1 + master / 100) / rnd) * rnd
                                                                                : ''
                                                                }
                                                                onChange={(e) => {
                                                                    const finalPrice = parseFloat(e.target.value) || 0;
                                                                    const localMarkup = anchorData.markup || 0;
                                                                    const prodMarkup = productMarkups[`${activeGenFormat}::${activeGenMaterial}`] || 0;
                                                                    const master = Number(masterMarkup) || 0;
                                                                    // Reverse-calculate base price from final price
                                                                    const totalMultiplier = (1 + localMarkup / 100) * (1 + prodMarkup / 100) * (1 + master / 100);
                                                                    const basePrice = totalMultiplier !== 0 ? finalPrice / totalMultiplier : 0;
                                                                    setAnchorData(qty, { price: basePrice, markup: localMarkup, excludeFromCurve: false, isLocked: false });
                                                                }}
                                                                className="pr-8 h-9"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kr</span>
                                                        </div>
                                                        {/* Per-anchor markup slider (-100% to +100%) */}
                                                        <div className="flex-1 flex items-center gap-2 min-w-[160px]">
                                                            <span className="text-[10px] text-muted-foreground">-100%</span>
                                                            <CenterSlider
                                                                value={[anchorData.markup || 0]}
                                                                onValueChange={([v]) => {
                                                                    const updates: any = { markup: v };

                                                                    // Check if this point is between two anchors (has interpolated value)
                                                                    const anchors = getAnchorsForContext(activeGenFormat, activeGenMaterial, activeGenVariant);
                                                                    const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
                                                                    const afterAnchor = anchors.find(a => a.quantity > qty);
                                                                    const isBetweenAnchors = beforeAnchor && afterAnchor;

                                                                    if (!isLocked && v !== 0 && isBetweenAnchors) {
                                                                        // Overriding an interpolated value - lock it and exclude from curve
                                                                        updates.isLocked = true;
                                                                        updates.excludeFromCurve = true;
                                                                        updates.price = rawInterpolatedBase;
                                                                    } else if (isLocked && v === 0 && anchorData.excludeFromCurve) {
                                                                        // Resetting a locked override back to interpolated
                                                                        updates.isLocked = false;
                                                                        updates.excludeFromCurve = false;
                                                                        updates.price = 0;
                                                                    }
                                                                    // Otherwise just update the markup without changing lock state
                                                                    setAnchorData(qty, updates);
                                                                }}
                                                                min={-100}
                                                                max={100}
                                                                step={1}
                                                                className="flex-1"
                                                            />
                                                            <span className="text-[10px] text-muted-foreground">+100%</span>
                                                            <span className="text-xs font-medium w-14 text-right">
                                                                {anchorData.markup && anchorData.markup > 0 ? '+' : ''}
                                                                {anchorData.markup || 0}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                }

                                <div className="space-y-1 text-[10px] text-muted-foreground bg-muted/50 p-2 rounded">
                                    <p><strong>Sådan fungerer ankerpunkter:</strong></p>
                                    <p>• Indtast basispriser i felterne for de mængder du kender.</p>
                                    <p>• Marker fluebenet (✓) for at gøre prisen til et <strong>ankerpunkt</strong>.</p>
                                    <p>• Priser mellem to ankerpunkter beregnes automatisk (interpolation).</p>
                                    <p>• <strong>Slider på ankerpunkt:</strong> Justér % for at ændre ankerpriset - dette påvirker alle priser imellem!</p>
                                    <p>• <strong>Slider på andre rækker:</strong> Justér kun den enkelte række.</p>
                                </div>
                            </div >

                            {/* Rounding & markup */}
                            < div className="grid grid-cols-2 gap-4" >
                                <div className="space-y-1">
                                    <Label className="text-xs">Afrunding</Label>
                                    <Select value={String(genRounding)} onValueChange={(v) => setGenRounding(parseInt(v))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Nærmeste 1 kr</SelectItem>
                                            <SelectItem value="5">Nærmeste 5 kr</SelectItem>
                                            <SelectItem value="10">Nærmeste 10 kr</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Produkt Markup (%)</Label>
                                    <div className="flex items-center gap-2">
                                        <CenterSlider
                                            value={[productMarkups[`${activeGenFormat}::${activeGenMaterial}`] || 0]}
                                            onValueChange={([v]) => setProductMarkups(prev => ({ ...prev, [`${activeGenFormat}::${activeGenMaterial}`]: v }))}
                                            min={-100}
                                            max={100}
                                            step={1}
                                            className="flex-1"
                                        />
                                        <span className="text-sm w-16 text-right">
                                            {(productMarkups[`${activeGenFormat}::${activeGenMaterial}`] || 0) > 0 ? '+' : ''}{productMarkups[`${activeGenFormat}::${activeGenMaterial}`] || 0}%
                                        </span>
                                    </div>
                                </div>
                            </div >

                            {/* Generated preview removed: prices are already live in the matrix */}

                            {/* Price List Progress */}
                            {
                                (() => {
                                    const visibleFormatIds = getVisibleValueIdsByType('formats');
                                    const visibleMaterialIds = getVisibleValueIdsByType('materials');
                                    const formats = formatGroups
                                        .flatMap(g => g.values || [])
                                        .filter(v => v.enabled)
                                        .filter(v => visibleFormatIds.size === 0 || visibleFormatIds.has(v.id));
                                    const materials = materialGroups
                                        .flatMap(g => g.values || [])
                                        .filter(v => v.enabled)
                                        .filter(v => visibleMaterialIds.size === 0 || visibleMaterialIds.has(v.id));
                                    const totalCombinations = formats.length * materials.length;
                                    const filledCombinations = new Set<string>();
                                    Object.keys(generatorPrices).forEach(key => {
                                        const [formatId, materialId] = key.split('::');
                                        if (generatorPrices[key]?.price > 0) {
                                            filledCombinations.add(`${formatId}::${materialId}`);
                                        }
                                    });
                                    const filledCount = filledCombinations.size;
                                    const percentage = totalCombinations > 0 ? Math.round((filledCount / totalCombinations) * 100) : 0;

                                    return totalCombinations > 0 ? (
                                        <div className="space-y-2 pt-4 border-t">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Prisliste fremskridt</span>
                                                <span className="font-medium">{filledCount} / {totalCombinations} kombinationer ({percentage}%)</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#00a8e8] transition-all duration-300"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>

                                        </div>
                                    ) : null;
                                })()
                            }
                        </CardContent >
                    )
                    }
                </Card >

                {/* ============ FRONTEND-STYLE PRICE LIST PREVIEW ============ */}
                {
                    (sizeMode === 'format') && (<>
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4" />
                                        Prisliste forhåndsvisning
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={matrixEditMode ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setMatrixEditMode(prev => !prev)}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            {matrixEditMode ? "Redigering aktiv" : "Rediger priser"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleResetPriceListConfig}
                                        >
                                            <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                            Nulstil prisliste
                                        </Button>
                                    </div>
                                </div>
                                <CardDescription className="text-xs">
                                    {showGenerator
                                        ? 'Priser opdateres live fra generatoren. Klik på format/materiale for at vælge.'
                                        : 'Indtast priser manuelt, eller åbn generatoren for automatisk beregning.'}
                                    {matrixEditMode && (
                                        <span className="ml-2 text-muted-foreground">Klik på en pris for at redigere.</span>
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Master Markup Slider */}
                                <div className="bg-muted/30 p-3 rounded-md flex items-center gap-4 border border-border/50">
                                    <Label className="text-sm font-medium whitespace-nowrap">Master Markup:</Label>
                                    <CenterSlider
                                        value={[masterMarkup]}
                                        onValueChange={([v]) => setMasterMarkup(v)}
                                        min={-100}
                                        max={100}
                                        step={1}
                                        className="flex-1 max-w-xs"
                                    />
                                    <span className="text-sm w-16 text-right font-medium">
                                        {masterMarkup > 0 ? '+' : ''}{masterMarkup}%
                                    </span>
                                    <div className="text-xs text-muted-foreground ml-auto">
                                        Påvirker hele prislisten
                                    </div>
                                </div>
                                {/* Format/Product selection based on layout rows */}
                                {layoutRows.map((row, rowIndex) => {
                                    const visibleSections = row.sections.filter(section => section.ui_mode !== 'hidden');
                                    if (visibleSections.length === 0) return null;

                                    return (
                                        <div key={row.id} className="space-y-2 pb-3 border-b last:border-b-0">
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="h-3 w-3 text-muted-foreground cursor-move" />
                                                <Label className="text-xs text-muted-foreground">Række {rowIndex + 1}</Label>
                                            </div>
                                            <div className={cn(
                                                "grid gap-3",
                                                visibleSections.length === 1 && "grid-cols-1",
                                                visibleSections.length === 2 && "grid-cols-2",
                                                visibleSections.length === 3 && "grid-cols-3"
                                            )}>
                                                {visibleSections.map((section, sectionIndex) => (
                                                    <div
                                                        key={section.id}
                                                        className={cn(
                                                            "space-y-1.5 p-2 rounded bg-muted/20",
                                                            sectionIndex > 0 && "border-l-2 border-primary/20 pl-3"
                                                        )}
                                                    >
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                                            {section.sectionType === 'formats' ? 'Formater' :
                                                                section.sectionType === 'materials' ? 'Materialer' :
                                                                    section.sectionType === 'finishes' ? 'Efterbehandling' : 'Produkter'}
                                                        </span>

                                                        {section.sectionType === 'formats' ? (
                                                            // Format rendering based on section.valueIds whitelist
                                                            <>
                                                                {(() => {
                                                                    // Only show formats that are in this section's valueIds whitelist
                                                                    const sectionFormats = formatGroups
                                                                        .flatMap(g => g.values || [])
                                                                        .filter(v => section.valueIds?.includes(v.id));

                                                                    const uiMode = section.ui_mode || formatDisplayMode || 'buttons';

                                                                    // If no formats added to this section, show empty state
                                                                    if (sectionFormats.length === 0) {
                                                                        return <span className="text-[10px] text-muted-foreground italic">Ingen formater tilføjet</span>;
                                                                    }

                                                                    const selectedFormatId = selectedSectionValues[section.id] || sectionFormats[0]?.id;

                                                                    if (uiMode === 'dropdown') {
                                                                        return (
                                                                            <Select
                                                                                value={selectedFormatId}
                                                                                onValueChange={(val) => {
                                                                                    setPreviewSelectedFormat(val);
                                                                                    setSelectedSectionValues(prev => ({ ...prev, [section.id]: val }));
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-xs">
                                                                                    <SelectValue placeholder="Vælg format" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {sectionFormats.map(format => (
                                                                                        <SelectItem key={format.id} value={format.id}>{format.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        );
                                                                    }

                                                                    if (uiMode === 'checkboxes') {
                                                                        return (
                                                                            <div className="space-y-1">
                                                                                {sectionFormats.map((format) => {
                                                                                    const isSelected = selectedFormatId === format.id;
                                                                                    return (
                                                                                        <label
                                                                                            key={format.id}
                                                                                            className={cn(
                                                                                                "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                                                                                isSelected ? "bg-[#00a8e8]/10 border-[#00a8e8]" : "bg-background border-muted hover:border-muted-foreground/30"
                                                                                            )}
                                                                                            onClick={() => {
                                                                                                setPreviewSelectedFormat(format.id);
                                                                                                setSelectedSectionValues(prev => ({ ...prev, [section.id]: format.id }));
                                                                                            }}
                                                                                        >
                                                                                            <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                                                                            <span className="font-medium flex-1">{format.name}</span>
                                                                                            {format.width_mm && format.height_mm && (
                                                                                                <span className="text-muted-foreground">{format.width_mm}×{format.height_mm}</span>
                                                                                            )}
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Default: buttons
                                                                    return (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {sectionFormats.map((format) => {
                                                                                const isSelected = selectedFormatId === format.id;
                                                                                return (
                                                                                    <Button
                                                                                        key={format.id}
                                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                                        size="sm"
                                                                                        onClick={() => {
                                                                                            setPreviewSelectedFormat(format.id);
                                                                                            setSelectedSectionValues(prev => ({ ...prev, [section.id]: format.id }));
                                                                                        }}
                                                                                        className={cn(
                                                                                            "h-7 text-xs",
                                                                                            isSelected && "bg-[#00a8e8] hover:bg-[#0090c8]"
                                                                                        )}
                                                                                    >
                                                                                        {format.name}
                                                                                    </Button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </>
                                                        ) : (
                                                            // Section rendering based on type and valueIds whitelist
                                                            <>
                                                                {(() => {
                                                                    // Only show values that are in this section's valueIds whitelist
                                                                    const sectionValues = (productAttrs.groups || [])
                                                                        .flatMap(g => (g.values || []))
                                                                        .filter(v => section.valueIds?.includes(v.id));
                                                                    const uiMode = section.ui_mode || 'buttons';

                                                                    const isOptional = section.selection_mode === 'optional';
                                                                    const selectedValueId = isOptional
                                                                        ? (selectedSectionValues[section.id] || '')
                                                                        : (selectedSectionValues[section.id] || sectionValues[0]?.id);

                                                                    if (sectionValues.length === 0) {
                                                                        return <span className="text-[10px] text-muted-foreground italic">Ingen værdier tilføjet til denne sektion</span>;
                                                                    }

                                                                    const handleValueSelect = (valueId: string) => {
                                                                        setSelectedSectionValues(prev => {
                                                                            const next = { ...prev };
                                                                            const current = prev[section.id];
                                                                            if (isOptional && current === valueId) {
                                                                                delete next[section.id];
                                                                            } else {
                                                                                next[section.id] = valueId;
                                                                                if (section.sectionType === 'finishes') {
                                                                                    const allFinishSections = layoutRows.flatMap(r => r.sections).filter(s => s.sectionType === 'finishes');
                                                                                    if (isOptional) {
                                                                                        allFinishSections.forEach(finishSection => {
                                                                                            if (finishSection.id !== section.id && finishSection.selection_mode === 'optional') {
                                                                                                delete next[finishSection.id];
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        allFinishSections.forEach(finishSection => {
                                                                                            if (finishSection.selection_mode === 'optional') {
                                                                                                delete next[finishSection.id];
                                                                                            }
                                                                                        });
                                                                                    }

                                                                                    // Two-sided finishes require 4+4 print.
                                                                                    const selectedName = (sectionValues.find(v => v.id === valueId)?.name || '').toLowerCase();
                                                                                    const requiresFourFour = selectedName.includes('2 sider') || selectedName.includes('2 side');
                                                                                    if (requiresFourFour) {
                                                                                        const printSection = layoutRows
                                                                                            .flatMap(r => r.sections)
                                                                                            .find(s => s.sectionType === 'products' && s.ui_mode !== 'hidden');
                                                                                        if (printSection) {
                                                                                            const printValues = (productAttrs.groups || [])
                                                                                                .flatMap(g => g.values || [])
                                                                                                .filter(v => printSection.valueIds?.includes(v.id));
                                                                                            const fourFourValue = printValues.find(v => {
                                                                                                const n = (v.name || '').toLowerCase();
                                                                                                return n.includes('4+4') || n.includes('4/4');
                                                                                            });
                                                                                            if (fourFourValue) {
                                                                                                next[printSection.id] = fourFourValue.id;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            return next;
                                                                        });
                                                                    };

                                                                    if (uiMode === 'dropdown') {
                                                                        return (
                                                                            <Select
                                                                                value={selectedValueId || (isOptional ? '__none__' : '')}
                                                                                onValueChange={(val) => {
                                                                                    if (isOptional && val === '__none__') {
                                                                                        setSelectedSectionValues(prev => {
                                                                                            const next = { ...prev };
                                                                                            delete next[section.id];
                                                                                            return next;
                                                                                        });
                                                                                        return;
                                                                                    }
                                                                                    handleValueSelect(val);
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-xs">
                                                                                    <SelectValue placeholder="Vælg værdi" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {isOptional && (
                                                                                        <SelectItem value="__none__">Ingen</SelectItem>
                                                                                    )}
                                                                                    {sectionValues.map((v: any) => (
                                                                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        );
                                                                    }

                                                                    if (uiMode === 'checkboxes') {
                                                                        return (
                                                                            <div className="space-y-1">
                                                                                {sectionValues.map((v: any) => {
                                                                                    const isSelected = selectedValueId === v.id;
                                                                                    return (
                                                                                        <label
                                                                                            key={v.id}
                                                                                            className={cn(
                                                                                                "flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all",
                                                                                                isSelected ? "bg-primary/10 border-primary" : "bg-background border-muted hover:border-muted-foreground/30"
                                                                                            )}
                                                                                            onClick={() => handleValueSelect(v.id)}
                                                                                        >
                                                                                            <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                                                                            <span className="font-medium">{v.name}</span>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Default: buttons - SELECTABLE
                                                                    return (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {sectionValues.map((v: any) => {
                                                                                const isSelected = selectedValueId === v.id;
                                                                                return (
                                                                                    <Button
                                                                                        key={v.id}
                                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                                        size="sm"
                                                                                        className={cn(
                                                                                            "h-7 text-xs",
                                                                                            isSelected && "bg-primary hover:bg-primary/90"
                                                                                        )}
                                                                                        onClick={() => handleValueSelect(v.id)}
                                                                                    >
                                                                                        {v.name}
                                                                                    </Button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Current selection indicator */}
                                <div className="flex items-center gap-2 py-2 px-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <span className="text-xs font-medium text-muted-foreground">Viser priser for:</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {activeGenFormat && (
                                            <Badge variant="secondary" className="text-xs">
                                                {getValueNameById(activeGenFormat) || 'Vælg format'}
                                            </Badge>
                                        )}
                                        {activeGenMaterial && (
                                            <Badge variant="secondary" className="text-xs">
                                                {getValueNameById(activeGenMaterial) || 'Vælg produkt'}
                                            </Badge>
                                        )}
                                        {activeNonVerticalSelections.map(([secId, valueId]) => (
                                            <Badge key={secId} variant="secondary" className="text-xs">
                                                {getValueNameById(valueId) || 'Vælg tilvalg'}
                                            </Badge>
                                        ))}
                                        {!activeGenFormat && !activeGenMaterial && activeNonVerticalSelections.length === 0 && (
                                            <span className="text-xs text-muted-foreground italic">Vælg format og produkt ovenfor</span>
                                        )}
                                    </div>
                                </div>

                                {/* Price table with live calculations */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-muted-foreground">
                                        Viser {startCol + 1}-{Math.min(startCol + previewCols, totalOplag)} af {totalOplag} antal
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setPreviewAmountPage(p => Math.max(0, p - 1))}
                                            disabled={previewAmountPage === 0}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setPreviewAmountPage(p => p + 1)}
                                            disabled={startCol + previewCols >= totalOplag}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="font-semibold">
                                                    {verticalAxisConfig.sectionType === 'formats' ? 'Format' :
                                                        verticalAxisConfig.sectionType === 'materials' ? 'Materiale' :
                                                            verticalAxisConfig.sectionType === 'finishes' ? 'Efterbehandling' : 'Produkt'} / Antal
                                                </TableHead>
                                                {visibleOplag.map(qty => (
                                                    <TableHead key={qty} className="text-center font-medium">
                                                        {qty.toLocaleString()} stk
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* Show rows based on verticalAxisConfig (Lodret akse) */}
                                            {(() => {
                                                // Get values from verticalAxisConfig.valueIds
                                                const verticalValues = (productAttrs.groups || [])
                                                    .flatMap(g => (g.values || []))
                                                    .filter(v => verticalAxisConfig.valueIds?.includes(v.id));

                                                // If Lodret akse is empty, show empty state
                                                if (verticalValues.length === 0) {
                                                    return (
                                                        <TableRow>
                                                            <TableCell colSpan={visibleOplag.length + 1} className="text-center text-muted-foreground py-8">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span className="text-sm italic">Lodret akse er tom</span>
                                                                    <span className="text-xs">Tilføj værdier til "Lodret akse" i layoutet ovenfor for at se rækker her</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }

                                                // Render rows from verticalAxisConfig values
                                                return verticalValues.map(verticalValue => {
                                                    const isSelected = selectedSectionValues[verticalSectionId] === verticalValue.id;
                                                    const setSelection = (id: string) => {
                                                        setSelectedSectionValues(prev => ({ ...prev, [verticalSectionId]: id }));
                                                    };

                                                    const rowSelections = {
                                                        ...selectedSectionValues,
                                                        [verticalSectionId]: verticalValue.id
                                                    };

                                                    const rowFormatId = getActiveFormatId(rowSelections);
                                                    const rowMaterialId = getActiveMaterialId(rowSelections);
                                                    const rowVariantId = getVariantKeyFromSelections(rowSelections);
                                                    const settings = verticalAxisConfig.valueSettings?.[verticalValue.id];

                                                    return (
                                                        <TableRow
                                                            key={verticalValue.id}
                                                            className={cn(
                                                                "hover:bg-muted/20 cursor-pointer transition-colors",
                                                                isSelected && "bg-blue-50 dark:bg-blue-950/30"
                                                            )}
                                                            onClick={() => setSelection(verticalValue.id)}
                                                        >
                                                            <TableCell className={cn(
                                                                "font-medium",
                                                                isSelected && "text-[#00a8e8]"
                                                            )}>
                                                                <div className="flex items-center gap-2">
                                                                    {settings?.showThumbnail && settings.customImage && (
                                                                        <img src={settings.customImage} className="w-5 h-5 object-cover rounded" />
                                                                    )}
                                                                    <span>{verticalValue.name}</span>
                                                                    {isSelected && <span className="text-xs">(valgt)</span>}
                                                                </div>
                                                            </TableCell>
                                                            {visibleOplag.map((qty) => {
                                                                const priceKey = getGenPriceKey(rowFormatId, rowMaterialId, rowVariantId, qty);
                                                                const isEditing = matrixEditMode && editingPriceKey === priceKey;
                                                                const computed = computeFinalPriceForContext(rowFormatId, rowMaterialId, rowVariantId, qty);
                                                                const priceValue = computed?.price ?? null;

                                                                return (
                                                                    <TableCell
                                                                        key={qty}
                                                                        className={cn(
                                                                            "text-center p-1 text-sm font-medium",
                                                                            matrixEditMode && "cursor-pointer hover:bg-muted/40"
                                                                        )}
                                                                        onClick={(e) => {
                                                                            if (!matrixEditMode) return;
                                                                            e.stopPropagation();
                                                                            setSelection(verticalValue.id);
                                                                            setEditingPriceKey(priceKey);
                                                                            setEditingPriceValue(priceValue ? String(priceValue) : '');
                                                                        }}
                                                                    >
                                                                        {isEditing ? (
                                                                            <Input
                                                                                type="number"
                                                                                value={editingPriceValue}
                                                                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                                                                onBlur={() => commitEditingPrice(priceKey)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') commitEditingPrice(priceKey);
                                                                                    if (e.key === 'Escape') {
                                                                                        setEditingPriceKey(null);
                                                                                        setEditingPriceValue('');
                                                                                    }
                                                                                }}
                                                                                className="h-7 text-xs text-center"
                                                                                autoFocus
                                                                            />
                                                                        ) : (
                                                                            priceValue ? `${priceValue.toLocaleString()} kr` : '—'
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                        </TableRow>
                                                    );
                                                });
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>



                                {/* Stats and Save */}
                                <div className="flex items-center justify-between pt-3 border-t">
                                    <div className="text-xs text-muted-foreground">
                                        <span>
                                            {(() => {
                                                const visibleFormatIds = getVisibleValueIdsByType('formats');
                                                const visibleMaterialIds = getVisibleValueIdsByType('materials');
                                                const formatCount = formatGroups
                                                    .flatMap(g => g.values || [])
                                                    .filter(v => v.enabled)
                                                    .filter(v => visibleFormatIds.size === 0 || visibleFormatIds.has(v.id)).length;
                                                const materialCount = materialGroups
                                                    .flatMap(g => g.values || [])
                                                    .filter(v => v.enabled)
                                                    .filter(v => visibleMaterialIds.size === 0 || visibleMaterialIds.has(v.id)).length;
                                                return `${formatCount} formater × ${materialCount} materialer × ${selectedOplag.length} oplag`;
                                            })()}
                                        </span>
                                        <span className="font-medium ml-2">
                                            {(() => {
                                                const visibleFormatIds = getVisibleValueIdsByType('formats');
                                                const visibleMaterialIds = getVisibleValueIdsByType('materials');
                                                const formatCount = formatGroups
                                                    .flatMap(g => g.values || [])
                                                    .filter(v => v.enabled)
                                                    .filter(v => visibleFormatIds.size === 0 || visibleFormatIds.has(v.id)).length;
                                                const materialCount = materialGroups
                                                    .flatMap(g => g.values || [])
                                                    .filter(v => v.enabled)
                                                    .filter(v => visibleMaterialIds.size === 0 || visibleMaterialIds.has(v.id)).length;
                                                return `= ${formatCount * materialCount * selectedOplag.length} prisfelter`;
                                            })()}
                                        </span>
                                    </div>
                                    {(() => {
                                        return null;
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </>)
                }

                {/* Prisliste Handlinger (CSV) SECTION */}
                <div className="mt-8 border-t pt-8">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <CloudUpload className="h-5 w-5" />
                            Prisliste Handlinger & CSV
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Eksporter den aktuelle struktur til CSV, udfyld priser i Excel, importer og udgiv direkte.
                        </p>
                    </div>

                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="p-6">
                            <div className="flex flex-wrap items-center gap-4">
                                {/* 1. Export */}
                                <Button variant="outline" onClick={handleExportCSV} className="bg-background">
                                    <Download className="h-4 w-4 mr-2" />
                                    1. Eksporter Skabelon (CSV)
                                </Button>
                                <Button variant="outline" onClick={handleExportCSVWithPrices} className="bg-background">
                                    <Download className="h-4 w-4 mr-2" />
                                    Eksporter med priser (CSV)
                                </Button>

                                <div className="h-8 w-px bg-border hidden sm:block"></div>

                                {/* 2. Import */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleImportCSV}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={importing}
                                    />
                                    <Button variant={importedData.length > 0 ? "secondary" : "outline"} disabled={importing} className={importedData.length > 0 ? "bg-background border-green-500 text-green-700 hover:bg-green-50" : "bg-background"}>
                                        {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                        2. Importer Udfyldt CSV
                                    </Button>
                                </div>

                                {/* 3. Push Live - Show if we have IMPORTED CSV data */}
                                {importedData.length > 0 && (
                                    <>
                                        <Button onClick={handlePushMatrixLayoutV1} disabled={pushing} className="bg-green-600 hover:bg-green-700 text-white shadow-md animate-in fade-in zoom-in-95">
                                            {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CloudUpload className="h-4 w-4 mr-2" />}
                                            Gem Prisliste (Matrix V1)
                                        </Button>
                                    </>
                                )}

                                {/* 4. Push Live - Show if we have MANUAL prices in generator (no CSV needed) */}
                                {importedData.length === 0 && Object.keys(generatorPrices).length > 0 && (
                                    <Button
                                        onClick={handlePushMatrixLayoutV1}
                                        disabled={pushing}
                                        className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                                    >
                                        {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CloudUpload className="h-4 w-4 mr-2" />}
                                        Udgiv Priser til Webshop
                                    </Button>
                                )}
                            </div>

                            {/* Import Feedback */}
                            {importedData.length > 0 && (
                                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                                    <Check className="h-5 w-5 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800 dark:text-green-200">CSV importeret!</p>
                                        <p className="text-xs text-green-700 dark:text-green-300">
                                            Indlæst {importedData.length} datalinjer fra CSV. Klik på "Gem Prisliste" for at gemme i databasen.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Manual Price Feedback */}
                            {importedData.length === 0 && Object.keys(generatorPrices).length > 0 && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
                                    <Check className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="font-medium text-blue-800 dark:text-blue-200">Priser klar til udgivelse!</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            {Object.keys(generatorPrices).filter(k => generatorPrices[k]?.price > 0).length} priser er konfigureret. Klik på "Udgiv Priser til Webshop" for at gemme.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 text-xs text-muted-foreground flex gap-4">
                                <p>Eksport inkluderer alle {formatGroups.flatMap(g => g.values || []).filter(v => v.enabled).length} formater og kombinationer.</p>
                                <p>Bemærk: Udgivelse indsætter priser direkte i databasen.</p>
                            </div>
                        </CardContent>
                    </Card >
                </div >



                {/* ============ PRICE LIST BANK ============ */}
                <Card className="mt-8 border-slate-200 bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                            <Library className="h-5 w-5 text-blue-600" />
                            Prisliste Bank
                        </CardTitle>
                        <CardDescription>
                            Banken fungerer som dit arkiv før publicering. Her kan du gemme forskellige opsætninger (f.eks. Sæsonlister, Tilbud), som du kan arbejde videre på senere, før de gemmes som den aktive prisliste.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                            <div className="space-y-1">
                                <h4 className="font-medium">Prisliste handlinger</h4>
                                <p className="text-sm text-muted-foreground">Gem nuværende opsætning eller indlæs en tidligere.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => {
                                        setSaveName('');
                                        setSaveIsBank(true);
                                        setShowSaveDialog(true);
                                    }}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Gem prisliste
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowLoadDialog(true)}
                                >
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    Indlæs prisliste
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>


            </div >

            {/* Import Manual Prices Dialog */}
            {/* Import Manual Prices Dialog */}
            <SaveDialog
                open={showSaveDialog}
                onOpenChange={setShowSaveDialog}
                name={saveName}
                onNameChange={setSaveName}
                isBank={saveIsBank}
                templates={bankTemplates}
                onSave={(overwriteId: string) => handleSavePriceList(saveName, saveIsBank, overwriteId)}
            />

            <LoadTemplateDialog
                open={showLoadDialog}
                onOpenChange={setShowLoadDialog}
                templates={showAllTemplates ? allTemplates : bankTemplates}
                showAll={showAllTemplates}
                onShowAllChange={(next: boolean) => {
                    setShowAllTemplates(next);
                    if (next) fetchAllTemplates();
                }}
                currentProductId={productId}
                currentProductName={productName}
                onLoad={(t: any) => {
                    handleLoadTemplate(t);
                    setShowLoadDialog(false);
                }}
                onDelete={async (id: string) => {
                    await handleDeleteTemplate(id);
                }}
            />

            <IconPickerDialog
                open={showIconPicker}
                onOpenChange={setShowIconPicker}
                onSelect={async (url: string) => {
                    if (pickingForValueId) {
                        const vals = formatGroups.flatMap(g => g.values).find(v => v.id === pickingForValueId);
                        if (vals) {
                            const scrollY = window.scrollY;
                            await productAttrs.updateValue(pickingForValueId, {
                                meta: { ...vals.meta, icon: url }
                            });
                            requestAnimationFrame(() => window.scrollTo(0, scrollY));
                            toast.success('Ikon opdateret');
                        }
                    }
                    setShowIconPicker(false);
                }}
            />

            {
                editingValueId && (
                    <EditValueDialog
                        value={productAttrs.groups.flatMap(g => g.values || []).find(v => v.id === editingValueId)}
                        open={!!editingValueId}
                        onOpenChange={(open) => !open && setEditingValueId(null)}
                        onUpdate={(id, data) => productAttrs.updateValue(id, data)}
                        libraryGroups={library.groups.map(g => ({ id: g.id, name: g.name, kind: g.kind }))}
                        libraryValues={library.groups.flatMap(g =>
                            (g.values || []).map(v => ({ id: v.id, name: v.name, groupName: g.name }))
                        )}
                        onSaveToLibrary={async (valueData, groupId) => {
                            await library.addValue(groupId, {
                                name: valueData.name,
                                key: valueData.key,
                                sort_order: 999,
                                enabled: true,
                                width_mm: valueData.width_mm,
                                height_mm: valueData.height_mm,
                                meta: valueData.meta
                            });
                        }}
                    />
                )
            }

            {/* Library Picker Dialog */}
            <Dialog open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen}>
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

            {/* New Group Dialog */}
            <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
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

            <CreateTemplateDialog
                open={showCreateTemplateDialog}
                onOpenChange={setShowCreateTemplateDialog}
                onSuccess={() => { fetchTemplates(); }}
            />
        </>
    );
}

function SaveDialog({ open, onOpenChange, name, onNameChange, isBank, onSave, templates = [] }: any) {
    const [mode, setMode] = useState<'new' | 'overwrite'>('new');
    const [selectedId, setSelectedId] = useState<string>('');

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setMode('new');
            setSelectedId('');
        }
    }, [open]);

    // When selecting a template to overwrite, populate name
    useEffect(() => {
        if (mode === 'overwrite' && selectedId) {
            const t = templates.find((t: any) => t.id === selectedId);
            if (t) onNameChange(t.name);
        }
    }, [selectedId, mode, templates, onNameChange]);

    const handleConfirm = () => {
        onSave(mode === 'overwrite' ? selectedId : undefined);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isBank ? 'Gem i Prisliste Bank' : 'Gem og udgiv prisliste'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {isBank && templates.length > 0 && (
                        <div className="flex gap-2 p-1 bg-muted rounded-lg">
                            <Button
                                variant={mode === 'new' ? 'default' : 'ghost'}
                                size="sm"
                                className="flex-1 shadow-none"
                                onClick={() => setMode('new')}
                            >
                                Ny prisliste
                            </Button>
                            <Button
                                variant={mode === 'overwrite' ? 'default' : 'ghost'}
                                size="sm"
                                className="flex-1 shadow-none"
                                onClick={() => setMode('overwrite')}
                            >
                                Overskriv eksisterende
                            </Button>
                        </div>
                    )}

                    {mode === 'overwrite' ? (
                        <div className="space-y-2">
                            <Label>Vælg prisliste at overskrive</Label>
                            <Select value={selectedId} onValueChange={setSelectedId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg prisliste..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map((t: any) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Dette vil erstatte indholdet i den valgte prisliste med dine nuværende indstillinger.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Navngivning</Label>
                            <Input
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder={isBank ? "F.eks. Sommer 2025" : "Automatisk navn..."}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                                {isBank
                                    ? 'Dette navn bruges til at finde skabelonen i banken.'
                                    : 'Dette navn vises i oversigten over prislister.'}
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={mode === 'new' ? !name : !selectedId}
                    >
                        {mode === 'overwrite' ? 'Overskriv' : (isBank ? 'Gem i bank' : 'Gem prisliste')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LoadTemplateDialog({ open, onOpenChange, templates = [], showAll, onShowAllChange, currentProductId, currentProductName, onLoad, onDelete }: any) {
    const [search, setSearch] = useState('');

    // Filter templates
    const normalizedSearch = search.toLowerCase();
    const filtered = templates.filter((t: any) => {
        const nameMatch = t.name?.toLowerCase().includes(normalizedSearch);
        const productMatch = t.product?.name?.toLowerCase().includes(normalizedSearch);
        return nameMatch || productMatch;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Indlæs prisliste</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Søg..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="all-price-lists" className="text-xs text-muted-foreground">Alle prislister</Label>
                        <Switch
                            id="all-price-lists"
                            checked={!!showAll}
                            onCheckedChange={onShowAllChange}
                        />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    {showAll ? 'Viser alle prislister i systemet.' : `Viser kun prislister for ${currentProductName}.`}
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Ingen prislister fundet.
                        </div>
                    ) : (
                        filtered.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                                <div>
                                    <div className="font-medium">{t.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(t.created_at).toLocaleDateString()} • {t.spec?.rows?.length || 0} priser
                                        {showAll && t.product?.name ? ` • ${t.product.name}` : ''}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onLoad(t)}
                                        disabled={showAll && t.product_id && currentProductId && t.product_id !== currentProductId}
                                    >
                                        Indlæs
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-muted-foreground hover:text-red-500"
                                        onClick={() => onDelete(t.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function IconPickerDialog({ open, onOpenChange, onSelect }: any) {
    const [packs, setPacks] = useState<any[]>([]);
    const [selectedPack, setSelectedPack] = useState<any>(null);
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchPacks();
        }
    }, [open]);

    useEffect(() => {
        if (selectedPack) {
            fetchAssets(selectedPack.id);
        } else {
            setAssets([]);
        }
    }, [selectedPack]);

    const fetchPacks = async () => {
        setLoading(true);
        const { data } = await supabase.from('icon_packs' as any).select('*').eq('is_active', true).order('name');
        if (data) {
            setPacks(data);
            if (data.length > 0 && !selectedPack) setSelectedPack(data[0]);
        }
        setLoading(false);
    };

    const fetchAssets = async (packId: string) => {
        const { data } = await supabase.from('icon_assets' as any).select('*').eq('pack_id', packId).order('created_at', { ascending: false });
        if (data) setAssets(data);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedPack || !e.target.files?.length) return;
        setIsUploading(true);
        try {
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop()?.toLowerCase();
            if (!['svg', 'png', 'webp'].includes(fileExt || '')) {
                toast.error("Kun SVG, PNG og WebP filer");
                return;
            }
            const fileName = `${selectedPack.id}/${Date.now()}-${file.name}`;
            const { error: upErr } = await supabase.storage.from('icon-assets').upload(fileName, file);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage.from('icon-assets').getPublicUrl(fileName);

            const { data: newAsset, error: dbErr } = await supabase
                .from('icon_assets' as any)
                .insert({
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    file_url: publicUrl,
                    pack_id: selectedPack.id,
                })
                .select().single();

            if (dbErr) throw dbErr;
            setAssets(prev => [newAsset, ...prev]);
            toast.success("Ikon uploadet");
        } catch (err) {
            toast.error("Upload fejlede");
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <DialogTitle>Vælg Ikon fra Bibliotek</DialogTitle>
                </div>
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Packs */}
                    <div className="w-64 border-r bg-muted/10 flex flex-col">
                        <div className="p-3 border-b text-xs font-medium text-muted-foreground uppercase">
                            Ikon Pakker
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {packs.map(pack => (
                                <button
                                    key={pack.id}
                                    onClick={() => setSelectedPack(pack)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                                        selectedPack?.id === pack.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                    )}
                                >
                                    <div className="font-medium truncate">{pack.name}</div>
                                    <div className={cn("text-xs truncate", selectedPack?.id === pack.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                        {pack.description || 'Ingen beskrivelse'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main: Assets */}
                    <div className="flex-1 flex flex-col bg-slate-50">
                        {/* Toolbar */}
                        <div className="p-3 border-b bg-white flex items-center justify-between">
                            <div className="text-sm font-medium">
                                {selectedPack ? selectedPack.name : 'Vælg en pakke'}
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-8 gap-2" asChild disabled={!selectedPack || isUploading}>
                                    <label className="cursor-pointer">
                                        <Upload className="w-3 h-3" />
                                        Upload
                                        <input type="file" className="hidden" accept=".svg,.png,.webp" onChange={handleUpload} />
                                    </label>
                                </Button>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {!selectedPack ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Package className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Vælg en ikon pakke til venstre</p>
                                </div>
                            ) : assets.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <FolderOpen className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Ingen ikoner i denne pakke</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-4">
                                    {assets.map((asset: any) => (
                                        <button
                                            key={asset.id}
                                            onClick={() => onSelect(asset.file_url)}
                                            className="group aspect-square rounded-lg border bg-white p-4 hover:border-primary hover:shadow-md transition-all flex items-center justify-center relative"
                                        >
                                            <img src={asset.file_url} alt={asset.name} className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ===================== ATTRIBUTE LIBRARY BROWSER (Materials, Products, Finishes) =====================
// This mirrors the TemplateLibraryBrowser but for materials/products/finishes stored in designer_templates

export type AttributeType = 'material' | 'finish' | 'product';

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, { singular: string; plural: string; description: string }> = {
    material: { singular: 'Materiale', plural: 'Materialer', description: 'Papir, karton, og andre trykmaterialer' },
    finish: { singular: 'Efterbehandling', plural: 'Efterbehandlinger', description: 'Laminering, lakering, og andre finish' },
    product: { singular: 'Produkt', plural: 'Produkter', description: 'Produktvarianter og tilvalg' }
};

function AttributeLibraryBrowser({
    type,
    onSelect,
    onCreateNew
}: {
    type: AttributeType;
    onSelect: (item: any) => void;
    onCreateNew: () => void;
}) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [copyingItemId, setCopyingItemId] = useState<string | null>(null);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

    const labels = ATTRIBUTE_TYPE_LABELS[type];

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .eq('template_type', type)
                .order('category')
                .order('name');

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error(`Error fetching ${type} library:`, err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyItem = async (item: any) => {
        setCopyingItemId(item.id);
        try {
            const { data, error } = await supabase
                .from('designer_templates' as any)
                .insert({
                    name: `${item.name} (kopi)`,
                    description: item.description,
                    category: item.category,
                    template_type: item.template_type,
                    weight_gsm: item.weight_gsm,
                    image_url: item.image_url,
                    is_active: true
                })
                .select()
                .single();
            if (error) throw error;
            toast.success(`${labels.singular} kopieret`);
            fetchItems();
        } catch (err) {
            console.error('Copy error:', err);
            toast.error(`Kunne ikke kopiere ${labels.singular.toLowerCase()}`);
        } finally {
            setCopyingItemId(null);
        }
    };

    const handleDeleteItem = async (item: any) => {
        if (!confirm(`Er du sikker på at du vil slette "${item.name}"?`)) return;
        setDeletingItemId(item.id);
        try {
            const { error } = await supabase
                .from('designer_templates' as any)
                .update({ is_active: false })
                .eq('id', item.id);
            if (error) throw error;
            toast.success(`${labels.singular} slettet`);
            fetchItems();
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(`Kunne ikke slette ${labels.singular.toLowerCase()}`);
        } finally {
            setDeletingItemId(null);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [type]);

    const categories = Array.from(new Set(items.map(t => t.category).filter(Boolean))).sort();
    const filtered = items.filter(item => {
        if (filterCategory && item.category !== filterCategory) return false;
        return true;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <Button variant="default" size="sm" className="w-auto self-start" onClick={onCreateNew}>
                    <Plus className="h-3 w-3 mr-1" />
                    Opret ny {labels.singular.toLowerCase()}
                </Button>

                {categories.length > 0 && (
                    <div className="flex gap-2 flex-wrap pb-1">
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
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto p-1">
                {loading && <Loader2 className="h-6 w-6 animate-spin mx-auto col-span-full" />}
                {!loading && filtered.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground col-span-full py-4">
                        Ingen {labels.plural.toLowerCase()} fundet
                    </p>
                )}

                {filtered.map(item => (
                    <div key={item.id} className="relative group border rounded-md p-2 hover:bg-muted/50 transition-colors">
                        <div className="cursor-pointer" onClick={() => onSelect(item)}>
                            <div className="flex items-center gap-2">
                                {item.category && <Badge variant="secondary" className="text-[10px] h-4 px-1">{item.category}</Badge>}
                                <span className="font-medium text-sm truncate flex-1">
                                    {item.name}
                                    {item.description && (
                                        <span className="text-muted-foreground font-normal ml-1 text-xs">
                                            ({item.description})
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => { e.stopPropagation(); handleCopyItem(item); }}
                                disabled={copyingItemId === item.id}
                                title="Kopier"
                            >
                                {copyingItemId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                                title="Rediger"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                                disabled={deletingItemId === item.id}
                                title="Slet"
                            >
                                {deletingItemId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3 w-3" />
                                )}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Dialog */}
            <EditAttributeLibraryItemDialog
                open={!!editingItem}
                item={editingItem}
                type={type}
                onOpenChange={(open) => !open && setEditingItem(null)}
                onSuccess={() => { fetchItems(); setEditingItem(null); }}
            />
        </div>
    );
}

export function CreateAttributeLibraryItemDialog({
    open,
    onOpenChange,
    type,
    onSuccess,
    existingCategories = []
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: AttributeType;
    onSuccess: () => void;
    existingCategories?: string[];
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [weightGsm, setWeightGsm] = useState('');
    const [loading, setLoading] = useState(false);

    const labels = ATTRIBUTE_TYPE_LABELS[type];

    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setCategory('');
            setWeightGsm('');
        }
    }, [open]);

    const handleCreate = async () => {
        if (!name) return;
        setLoading(true);
        try {
            // Note: width_mm and height_mm are required in the table, but for materials/finishes
            // we use 0 as placeholder since they don't have physical dimensions
            const { error } = await supabase.from('designer_templates' as any).insert({
                name,
                description: description || null,
                is_active: true,
                category: category || labels.singular,
                template_type: type,
                is_public: false,
                width_mm: 0,  // Not applicable for materials/finishes
                height_mm: 0, // Not applicable for materials/finishes
                weight_gsm: type === 'material' && weightGsm ? parseFloat(weightGsm) : null,
            });

            if (error) throw error;
            toast.success(`${labels.singular} oprettet i biblioteket`);
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            toast.error(`Kunne ikke oprette ${labels.singular.toLowerCase()}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Opret ny {labels.singular.toLowerCase()}</DialogTitle>
                    <DialogDescription>{labels.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Navn</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={type === 'material' ? 'F.eks. 350g papir' : type === 'finish' ? 'F.eks. Mat Laminering' : 'F.eks. Visitkort'}
                        />
                    </div>
                    {type === 'material' && (
                        <div className="space-y-2">
                            <Label>Vægt (g/m²)</Label>
                            <Input
                                type="number"
                                value={weightGsm}
                                onChange={e => setWeightGsm(e.target.value)}
                                placeholder="F.eks. 350"
                            />
                            <p className="text-xs text-muted-foreground">
                                Papirvægt i gram per kvadratmeter (GSM). Bruges til at beregne produktvægt.
                            </p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Kategori (Tag)</Label>
                        <CategorySelector
                            value={category}
                            onValueChange={setCategory}
                            existingCategories={existingCategories}
                            placeholder={type === 'material' ? 'F.eks. Papir' : type === 'finish' ? 'F.eks. Laminering' : 'F.eks. Tryksager'}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Beskrivelse (valgfri)</Label>
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Kort beskrivelse..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button onClick={handleCreate} disabled={loading || !name}>
                        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                        Opret {labels.singular.toLowerCase()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function EditAttributeLibraryItemDialog({
    open,
    item,
    type,
    onOpenChange,
    onSuccess,
    existingCategories = []
}: {
    open: boolean;
    item: any;
    type: AttributeType;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    existingCategories?: string[];
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [weightGsm, setWeightGsm] = useState('');
    const [loading, setLoading] = useState(false);

    const labels = ATTRIBUTE_TYPE_LABELS[type];

    useEffect(() => {
        if (item) {
            setName(item.name || '');
            setDescription(item.description || '');
            setCategory(item.category || '');
            setWeightGsm(item.weight_gsm?.toString() || '');
        }
    }, [item]);

    const handleUpdate = async () => {
        if (!item || !name) return;
        setLoading(true);
        try {
            const updateData: any = {
                name,
                description: description || null,
                category: category || labels.singular
            };

            // Only include weight_gsm for materials
            if (type === 'material') {
                updateData.weight_gsm = weightGsm ? parseFloat(weightGsm) : null;
            }

            const { error } = await supabase.from('designer_templates' as any).update(updateData).eq('id', item.id);

            if (error) throw error;
            toast.success(`${labels.singular} opdateret`);
            onSuccess();
        } catch (err: any) {
            toast.error(`Kunne ikke opdatere ${labels.singular.toLowerCase()}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!item) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('designer_templates' as any).update({
                is_active: false
            }).eq('id', item.id);

            if (error) throw error;
            toast.success(`${labels.singular} slettet`);
            onSuccess();
        } catch (err: any) {
            toast.error(`Kunne ikke slette ${labels.singular.toLowerCase()}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rediger {labels.singular.toLowerCase()}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Navn</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    {type === 'material' && (
                        <div className="space-y-2">
                            <Label>Vægt (g/m²)</Label>
                            <Input
                                type="number"
                                value={weightGsm}
                                onChange={e => setWeightGsm(e.target.value)}
                                placeholder="F.eks. 350"
                            />
                            <p className="text-xs text-muted-foreground">
                                Papirvægt i gram per kvadratmeter (GSM). Bruges til at beregne produktvægt.
                            </p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Kategori (Tag)</Label>
                        <CategorySelector
                            value={category}
                            onValueChange={setCategory}
                            existingCategories={existingCategories}
                            placeholder="Vælg eller opret kategori"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Beskrivelse</Label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </div>
                <DialogFooter className="flex justify-between">
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                        Slet
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                        <Button onClick={handleUpdate} disabled={loading || !name}>
                            {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Gem ændringer
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function TemplateLibraryBrowser({ onSelect, onCreateNew }: { onSelect: (t: any) => void, onCreateNew: () => void }) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .eq('template_type', 'format')
                .order('category')
                .order('name');

            if (error) throw error;
            const formats = data.filter((t: any) => t.width_mm && t.height_mm);
            setTemplates(formats);
        } catch (err) {
            console.error("Error fetching library templates:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch library items on mount
    useEffect(() => {
        fetchTemplates();
    }, []);

    // Derived statistics
    const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort();

    const filtered = templates.filter(template => {
        if (filterCategory && template.category !== filterCategory) return false;
        return true;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <Button variant="default" size="sm" className="w-auto self-start" onClick={onCreateNew}>
                    <Plus className="h-3 w-3 mr-1" />
                    Opret nyt format
                </Button>

                {categories.length > 0 && (
                    <div className="flex gap-2 flex-wrap pb-1">
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
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto p-1">
                {loading && <Loader2 className="h-6 w-6 animate-spin mx-auto col-span-full" />}
                {!loading && filtered.length === 0 && <p className="text-center text-xs text-muted-foreground col-span-full py-4">Ingen formater fundet</p>}

                {filtered.map(template => (
                    <div key={template.id} className="relative group border rounded-md p-2 hover:bg-muted/50 transition-colors">
                        <div className="cursor-pointer" onClick={() => onSelect(template)}>
                            <div className="flex items-center gap-2">
                                {template.category && <Badge variant="secondary" className="text-[10px] h-4 px-1">{template.category}</Badge>}
                                <span className="font-medium text-sm truncate flex-1">
                                    {template.name}
                                    <span className="text-muted-foreground font-normal ml-1">
                                        ({template.width_mm}x{template.height_mm}mm)
                                    </span>
                                </span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); }}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>

            {/* Edit Dialog */}
            <EditTemplateDialog
                open={!!editingTemplate}
                template={editingTemplate}
                onOpenChange={(open) => !open && setEditingTemplate(null)}
                onSuccess={() => { fetchTemplates(); setEditingTemplate(null); }}
            />
        </div>
    );
}

function CreateTemplateDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [category, setCategory] = useState('');
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const [loading, setLoading] = useState(false);

    // Reset when opening
    useEffect(() => {
        if (open) {
            setName('');
            setWidth('');
            setHeight('');
            setCategory('');
            setBleed('3');
            setSafeArea('3');
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
                description: 'Oprettet fra Produktbygger',
                template_type: 'format',
                is_public: false
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
                        <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="F.eks. Visitkort" />
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

function EditTemplateDialog({ open, template, onOpenChange, onSuccess }: { open: boolean, template: any, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [category, setCategory] = useState('');
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (template) {
            setName(template.name || '');
            setWidth(template.width_mm || '');
            setHeight(template.height_mm || '');
            setCategory(template.category || '');
            setBleed(String(template.bleed_mm ?? 3));
            setSafeArea(String(template.safe_area_mm ?? 3));
        }
    }, [template]);

    const handleUpdate = async () => {
        if (!template || !name || !width || !height) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('designer_templates' as any).update({
                name,
                width_mm: parseInt(toString(width)), // ensure string then int? width is string state
                height_mm: parseInt(toString(height)),
                bleed_mm: parseFloat(toString(bleed)) || 3,
                safe_area_mm: parseFloat(toString(safeArea)) || 3,
                category: category || 'General'
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

function EditValueDialog({
    value,
    open,
    onOpenChange,
    onUpdate,
    onSaveToLibrary,
    libraryGroups,
    libraryValues
}: {
    value: any,
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onUpdate: (id: string, data: any) => void,
    onSaveToLibrary?: (value: any, groupId: string) => Promise<void>,
    libraryGroups?: { id: string; name: string; kind: string; values?: { id: string; name: string }[] }[],
    libraryValues?: { id: string; name: string; groupName: string }[]
}) {
    const [name, setName] = useState('');
    const [priceType, setPriceType] = useState<'free' | 'fixed' | 'calculated' | 'multiplier'>('free');
    const [fixedPrice, setFixedPrice] = useState('');
    const [multiplier, setMultiplier] = useState('1');
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const [showSaveToLibrary, setShowSaveToLibrary] = useState(false);
    const [selectedLibraryGroupId, setSelectedLibraryGroupId] = useState<string>('');
    const [savingToLibrary, setSavingToLibrary] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [showSwapFromLibrary, setShowSwapFromLibrary] = useState(false);

    // Filter library values based on search
    const filteredLibraryValues = useMemo(() => {
        if (!libraryValues || !librarySearch.trim()) return libraryValues || [];
        const search = librarySearch.toLowerCase();
        return libraryValues.filter(v =>
            v.name.toLowerCase().includes(search) ||
            v.groupName.toLowerCase().includes(search)
        );
    }, [libraryValues, librarySearch]);

    useEffect(() => {
        if (value) {
            setName(value.name || '');
            setPriceType(value.meta?.price_type || 'free');
            setFixedPrice(value.meta?.fixed_price || '');
            setMultiplier(value.meta?.multiplier || '1');
            setBleed(String(value.meta?.bleed_mm ?? 3));
            setSafeArea(String(value.meta?.safe_area_mm ?? 3));
            setShowSaveToLibrary(false);
            setSelectedLibraryGroupId('');
            setLibrarySearch('');
            setShowSwapFromLibrary(false);
        }
    }, [value]);

    const handleSave = () => {
        if (!value) return;
        const isFormatValue = !!value.width_mm && !!value.height_mm;
        onUpdate(value.id, {
            name: name.trim() || value.name,
            meta: {
                ...value.meta,
                price_type: priceType,
                fixed_price: priceType === 'fixed' ? parseFloat(fixedPrice) : undefined,
                multiplier: priceType === 'multiplier' ? parseFloat(multiplier) : undefined,
                bleed_mm: isFormatValue ? parseFloat(bleed) || 3 : value.meta?.bleed_mm,
                safe_area_mm: isFormatValue ? parseFloat(safeArea) || 3 : value.meta?.safe_area_mm
            }
        });
        toast.success("Værdi opdateret");
        onOpenChange(false);
    };

    const handleSaveToLibrary = async () => {
        if (!value || !onSaveToLibrary || !selectedLibraryGroupId) return;
        setSavingToLibrary(true);
        try {
            await onSaveToLibrary({
                ...value,
                name: name.trim() || value.name
            }, selectedLibraryGroupId);
            toast.success("Gemt til bibliotek");
            setShowSaveToLibrary(false);
        } catch (error) {
            toast.error("Kunne ikke gemme til bibliotek");
        } finally {
            setSavingToLibrary(false);
        }
    };

    if (!value) return null;
    const isFormatValue = !!value.width_mm && !!value.height_mm;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rediger værdi</DialogTitle>
                    <DialogDescription>Rediger navn og indstillinger for denne valgmulighed.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Name field with swap option */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Navn</Label>
                            {libraryValues && libraryValues.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => setShowSwapFromLibrary(!showSwapFromLibrary)}
                                >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    {showSwapFromLibrary ? 'Skjul bibliotek' : 'Byt fra bibliotek'}
                                </Button>
                            )}
                        </div>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Indtast navn..."
                        />

                        {/* Swap from library picker */}
                        {showSwapFromLibrary && libraryValues && (
                            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Søg i bibliotek..."
                                        value={librarySearch}
                                        onChange={e => setLibrarySearch(e.target.value)}
                                        className="pl-8 h-8 text-sm"
                                    />
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {filteredLibraryValues.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            {librarySearch ? 'Ingen resultater' : 'Ingen værdier i biblioteket'}
                                        </p>
                                    ) : (
                                        filteredLibraryValues.slice(0, 20).map(lv => (
                                            <button
                                                key={lv.id}
                                                type="button"
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-primary/10 transition-colors",
                                                    name === lv.name && "bg-primary/20 font-medium"
                                                )}
                                                onClick={() => {
                                                    setName(lv.name);
                                                    setShowSwapFromLibrary(false);
                                                    setLibrarySearch('');
                                                }}
                                            >
                                                <span>{lv.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({lv.groupName})</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Pris type</Label>
                        <Select value={priceType} onValueChange={(v: any) => setPriceType(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="free">Gratis (Standard)</SelectItem>
                                <SelectItem value="fixed">Fast Pris (Tillæg)</SelectItem>
                                <SelectItem value="multiplier">Multiplikator (×antal)</SelectItem>
                                <SelectItem value="calculated">Beregnet (via matrix)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {priceType === 'fixed' && (
                        <div className="space-y-2">
                            <Label>Fast pris (kr)</Label>
                            <Input
                                type="number"
                                value={fixedPrice}
                                onChange={e => setFixedPrice(e.target.value)}
                                placeholder="0.00"
                            />
                            <p className="text-xs text-muted-foreground">Tilføjes som et fast tillæg til prisen.</p>
                        </div>
                    )}
                    {priceType === 'multiplier' && (
                        <div className="space-y-2">
                            <Label>Multiplikator</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={multiplier}
                                onChange={e => setMultiplier(e.target.value)}
                                placeholder="1.0"
                            />
                            <p className="text-xs text-muted-foreground">Prisen ganges med denne værdi (f.eks. 1.5 = +50%).</p>
                        </div>
                    )}
                    {priceType === 'calculated' && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            Prisen beregnes automatisk via prismatrixen baseret på produktets konfiguration.
                        </p>
                    )}
                    {isFormatValue && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label>Bleed (mm)</Label>
                                <Input
                                    type="number"
                                    value={bleed}
                                    onChange={e => setBleed(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Safe zone (mm)</Label>
                                <Input
                                    type="number"
                                    value={safeArea}
                                    onChange={e => setSafeArea(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Save to Library section */}
                    {onSaveToLibrary && libraryGroups && libraryGroups.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                            {!showSaveToLibrary ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setShowSaveToLibrary(true)}
                                >
                                    <Library className="h-4 w-4 mr-2" />
                                    Gem til bibliotek
                                </Button>
                            ) : (
                                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                                    <Label className="text-sm font-medium">Vælg biblioteksgruppe</Label>
                                    <Select value={selectedLibraryGroupId} onValueChange={setSelectedLibraryGroupId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vælg gruppe..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {libraryGroups.map(g => (
                                                <SelectItem key={g.id} value={g.id}>
                                                    {g.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowSaveToLibrary(false)}
                                        >
                                            Annuller
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveToLibrary}
                                            disabled={!selectedLibraryGroupId || savingToLibrary}
                                        >
                                            {savingToLibrary && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Gem til bibliotek
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button onClick={handleSave}>Gem ændringer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Dialog for creating new attribute values
function CreateAttributeValueDialog({
    open,
    onOpenChange,
    groups,
    activeGroupId,
    onCreateGroup,
    onCreateValue
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups: any[];
    activeGroupId: string | null;
    onCreateGroup: (data: any) => Promise<any>;
    onCreateValue: (groupId: string, valueData: any) => Promise<void>;
}) {
    const [name, setName] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [createNewGroup, setCreateNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupKind, setNewGroupKind] = useState<string>('material');
    const [loading, setLoading] = useState(false);
    const [bleed, setBleed] = useState('3');
    const [safeArea, setSafeArea] = useState('3');
    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const effectiveKind = createNewGroup ? newGroupKind : selectedGroup?.kind;
    const isFormatValue = effectiveKind === 'format';

    // Reset when opening
    useEffect(() => {
        if (open) {
            setName('');
            setSelectedGroupId(activeGroupId || groups[0]?.id || '');
            setCreateNewGroup(groups.length === 0);
            setNewGroupName('');
            setNewGroupKind('material');
            setBleed('3');
            setSafeArea('3');
        }
    }, [open, activeGroupId, groups]);

    const handleCreate = async () => {
        if (!name.trim()) return;

        setLoading(true);
        try {
            let targetGroupId = selectedGroupId;

            // If creating a new group first
            if (createNewGroup && newGroupName.trim()) {
                const created = await onCreateGroup({
                    name: newGroupName.trim(),
                    kind: newGroupKind,
                    ui_mode: 'buttons',
                    source: 'product',
                    sort_order: groups.length,
                    enabled: true,
                    library_group_id: null
                });
                if (created) {
                    targetGroupId = created.id;
                } else {
                    toast.error('Kunne ikke oprette gruppe');
                    return;
                }
            }

            if (!targetGroupId) {
                toast.error('Vælg eller opret en gruppe først');
                return;
            }

            await onCreateValue(targetGroupId, {
                name: name.trim(),
                key: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                enabled: true,
                sort_order: 0,
                meta: isFormatValue ? {
                    bleed_mm: parseFloat(bleed) || 3,
                    safe_area_mm: parseFloat(safeArea) || 3
                } : null
            });

            toast.success(`"${name}" oprettet`);
            onOpenChange(false);
        } catch (err: any) {
            toast.error('Kunne ikke oprette værdi');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Opret ny attribut-værdi</DialogTitle>
                    <DialogDescription>
                        Tilføj en ny valgmulighed som kunden kan vælge.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Navn</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="F.eks. 170g Silk, Mat Laminering..."
                            autoFocus
                        />
                    </div>

                    {groups.length > 0 && !createNewGroup && (
                        <div className="space-y-2">
                            <Label>Gruppe</Label>
                            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg gruppe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => setCreateNewGroup(true)}
                            >
                                + Opret ny gruppe i stedet
                            </Button>
                        </div>
                    )}

                    {isFormatValue && (
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
                    )}

                    {(groups.length === 0 || createNewGroup) && (
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Ny gruppe</Label>
                                {groups.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => setCreateNewGroup(false)}
                                    >
                                        Annuller
                                    </Button>
                                )}
                            </div>
                            <Input
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                placeholder="Gruppenavn (f.eks. Papir, Finish)"
                            />
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Type</Label>
                                <Select value={newGroupKind} onValueChange={setNewGroupKind}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="material">Materiale</SelectItem>
                                        <SelectItem value="finish">Efterbehandling</SelectItem>
                                        <SelectItem value="other">Øvrige</SelectItem>
                                        <SelectItem value="custom">Tilpasset</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={loading || !name.trim() || (createNewGroup && !newGroupName.trim())}
                    >
                        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                        Opret
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
