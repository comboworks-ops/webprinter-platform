import { Button } from "@/components/ui/button";
import { LayerInfo } from "./EditorCanvas";
import {
    Layers,
    Eye,
    EyeOff,
    ChevronUp,
    ChevronDown,
    Type,
    Image,
    Square,
    Circle,
    Minus,
    MousePointer2
} from "lucide-react";

interface LayerPanelProps {
    layers: LayerInfo[];
    selectedLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onToggleVisibility: (id: string) => void;
}

const getLayerIcon = (type: string) => {
    switch (type) {
        case 'i-text':
        case 'text':
        case 'textbox':
            return Type;
        case 'image':
            return Image;
        case 'rect':
            return Square;
        case 'circle':
            return Circle;
        case 'line':
            return Minus;
        default:
            return MousePointer2;
    }
};

export function LayerPanel({
    layers,
    selectedLayerId,
    onSelectLayer,
    onMoveUp,
    onMoveDown,
    onToggleVisibility,
}: LayerPanelProps) {
    if (layers.length === 0) {
        return (
            <div className="p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Lag
                </h3>
                <div className="p-3 rounded border bg-muted/30 text-sm text-muted-foreground text-center">
                    Tilføj elementer for at se lag her
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Lag ({layers.length})
            </h3>

            <div className="space-y-1 max-h-60 overflow-y-auto">
                {layers.map((layer, index) => {
                    const Icon = getLayerIcon(layer.type);
                    const isSelected = layer.id === selectedLayerId;

                    return (
                        <div
                            key={layer.id}
                            className={`
                flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
                ${isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 hover:bg-muted/50 border border-transparent'}
                ${!layer.visible ? 'opacity-50' : ''}
              `}
                            onClick={() => onSelectLayer(layer.id)}
                        >
                            {/* Icon */}
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

                            {/* Name */}
                            <span className="flex-1 text-sm truncate">
                                {layer.name || `Objekt ${index + 1}`}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5">
                                {/* Move up */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveUp(layer.id);
                                    }}
                                    disabled={index === 0}
                                    title="Flyt op"
                                >
                                    <ChevronUp className="h-3 w-3" />
                                </Button>

                                {/* Move down */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveDown(layer.id);
                                    }}
                                    disabled={index === layers.length - 1}
                                    title="Flyt ned"
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>

                                {/* Visibility toggle */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleVisibility(layer.id);
                                    }}
                                    title={layer.visible ? 'Skjul' : 'Vis'}
                                >
                                    {layer.visible ? (
                                        <Eye className="h-3 w-3" />
                                    ) : (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tips */}
            <div className="mt-3 text-xs text-muted-foreground">
                Klik på et lag for at vælge
            </div>
        </div>
    );
}

export default LayerPanel;
