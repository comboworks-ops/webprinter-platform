import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, X, Check, Eye } from "lucide-react";
import { PreflightWarning, getWarningColor } from "@/utils/preflightChecks";

interface PreflightPanelProps {
    warnings: PreflightWarning[];
    errors: PreflightWarning[];
    infos: PreflightWarning[];
    onAcceptAll: () => void;
    onHighlightObject: (objectId: string) => void;
    onDismiss: (id: string) => void;
    dismissed: Set<string>;
}

export function PreflightPanel({
    warnings,
    errors,
    infos,
    onAcceptAll,
    onHighlightObject,
    onDismiss,
    dismissed,
}: PreflightPanelProps) {
    const allItems = [...errors, ...warnings, ...infos];
    const visibleItems = allItems.filter(item => !dismissed.has(item.id));

    if (visibleItems.length === 0) {
        return (
            <div className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-medium text-green-700">Alt ser godt ud!</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Ingen problemer fundet i dit design
                </p>
            </div>
        );
    }

    const getIcon = (type: 'error' | 'warning' | 'info') => {
        switch (type) {
            case 'error':
                return AlertCircle;
            case 'warning':
                return AlertTriangle;
            case 'info':
            default:
                return Info;
        }
    };

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Preflight kontrol</h3>
                {errors.length === 0 && visibleItems.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onAcceptAll}
                        className="text-xs"
                    >
                        Accepter alle
                    </Button>
                )}
            </div>

            {/* Summary */}
            <div className="flex gap-3 text-xs">
                {errors.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {errors.length} fejl
                    </span>
                )}
                {warnings.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {warnings.length} advarsler
                    </span>
                )}
                {infos.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                        <Info className="h-3 w-3" />
                        {infos.length} info
                    </span>
                )}
            </div>

            {/* Items */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {visibleItems.map((item) => {
                    const Icon = getIcon(item.type);
                    const colorClasses = getWarningColor(item.type);

                    return (
                        <div
                            key={item.id}
                            className={`p-3 rounded-lg border ${colorClasses}`}
                        >
                            <div className="flex items-start gap-2">
                                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{item.message}</p>
                                    {item.details && (
                                        <p className="text-xs mt-1 opacity-80">{item.details}</p>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    {item.objectId && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => onHighlightObject(item.objectId!)}
                                            title="Vis objekt"
                                        >
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                    )}
                                    {item.canIgnore && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => onDismiss(item.id)}
                                            title="Ignorer"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Export warning for errors */}
            {errors.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 rounded p-2 border border-red-200">
                    <strong>OBS:</strong> Dit design har fejl, der bør rettes før eksport for at sikre kvalitet.
                </div>
            )}
        </div>
    );
}

export default PreflightPanel;
