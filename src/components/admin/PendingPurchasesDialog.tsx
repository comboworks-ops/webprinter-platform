/**
 * PendingPurchasesDialog Component
 * 
 * Shows a summary of unpaid design elements that need to be purchased
 * before publishing. Blocks publish until payment is completed.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
    Loader2, CreditCard, ShoppingCart, Trash2, Check,
    LayoutTemplate, Palette, Type, Sparkles, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import type { PaidItem, PaidItemType } from "@/hooks/usePaidItems";

interface PendingPurchasesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingItems: PaidItem[];
    totalCost: number;
    onRemoveItem: (itemType: PaidItemType, itemId: string) => Promise<void>;
    onConfirmPurchase: () => Promise<boolean>;
    onPublish: () => Promise<void>;
    isPublishing?: boolean;
}

function getItemIcon(type: PaidItemType) {
    switch (type) {
        case 'premade_design':
            return <LayoutTemplate className="h-5 w-5" />;
        case 'icon_pack':
            return <Palette className="h-5 w-5" />;
        case 'font_pack':
            return <Type className="h-5 w-5" />;
        case 'template_feature':
            return <Sparkles className="h-5 w-5" />;
        default:
            return <ShoppingCart className="h-5 w-5" />;
    }
}

function getItemTypeLabel(type: PaidItemType): string {
    switch (type) {
        case 'premade_design':
            return 'Design skabelon';
        case 'icon_pack':
            return 'Ikon pakke';
        case 'font_pack':
            return 'Font pakke';
        case 'template_feature':
            return 'Premium funktion';
        default:
            return 'Produkt';
    }
}

export function PendingPurchasesDialog({
    open,
    onOpenChange,
    pendingItems,
    totalCost,
    onRemoveItem,
    onConfirmPurchase,
    onPublish,
    isPublishing = false,
}: PendingPurchasesDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConfirmRemove, setShowConfirmRemove] = useState<{ type: PaidItemType; id: string; name: string } | null>(null);
    const [purchaseComplete, setPurchaseComplete] = useState(false);

    const handleConfirmPurchase = async () => {
        setIsProcessing(true);
        try {
            toast.loading('Behandler betaling...', { id: 'purchase' });
            const success = await onConfirmPurchase();

            if (success) {
                toast.success('Betaling gennemført!', { id: 'purchase' });
                setPurchaseComplete(true);
            } else {
                toast.error('Betaling fejlede. Prøv igen.', { id: 'purchase' });
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error('Der opstod en fejl under betalingen', { id: 'purchase' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePublishAfterPurchase = async () => {
        setIsProcessing(true);
        try {
            await onPublish();
            onOpenChange(false);
            setPurchaseComplete(false);
        } catch (error) {
            console.error('Publish error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveItem = async () => {
        if (!showConfirmRemove) return;

        try {
            await onRemoveItem(showConfirmRemove.type, showConfirmRemove.id);
            toast.success(`${showConfirmRemove.name} fjernet fra kurven`);
        } catch (error) {
            toast.error('Kunne ikke fjerne element');
        } finally {
            setShowConfirmRemove(null);
        }
    };

    // If no pending items, don't show the dialog
    if (pendingItems.length === 0 && !purchaseComplete) {
        return null;
    }

    return (
        <>
            <Dialog open={open} onOpenChange={(o) => {
                if (!isProcessing) {
                    onOpenChange(o);
                    if (!o) setPurchaseComplete(false);
                }
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {purchaseComplete ? (
                                <>
                                    <Check className="h-5 w-5 text-green-600" />
                                    Betaling gennemført
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                    Afventende køb
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {purchaseComplete
                                ? 'Dine design elementer er nu købt og klar til at blive publiceret.'
                                : 'Du har valgt betalte design elementer. Disse skal købes før du kan publicere dit design.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {!purchaseComplete ? (
                        <>
                            {/* Pending Items List */}
                            <div className="space-y-3 my-4 max-h-[300px] overflow-auto">
                                {pendingItems.map((item) => (
                                    <Card key={`${item.type}-${item.itemId}`} className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                {getItemIcon(item.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{getItemTypeLabel(item.type)}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="font-mono">
                                                    {item.price} kr
                                                </Badge>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => setShowConfirmRemove({ type: item.type, id: item.itemId, name: item.name })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            <Separator />

                            {/* Total */}
                            <div className="flex items-center justify-between py-3">
                                <span className="text-lg font-semibold">Total</span>
                                <span className="text-2xl font-bold text-primary">{totalCost} kr</span>
                            </div>

                            {/* Warning */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-medium">Betaling krævet</p>
                                    <p className="text-amber-700 mt-1">
                                        Du kan fortsætte med at redigere dit design, men må betale disse elementer før du kan publicere.
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <Check className="h-8 w-8 text-green-600" />
                            </div>
                            <p className="text-lg font-medium text-green-700">Alle elementer er betalt!</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Klik på "Publicér nu" for at offentliggøre dit design.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        {!purchaseComplete ? (
                            <>
                                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                                    Fortsæt med at redigere
                                </Button>
                                <Button
                                    onClick={handleConfirmPurchase}
                                    disabled={isProcessing || pendingItems.length === 0}
                                    className="gap-2"
                                >
                                    {isProcessing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="h-4 w-4" />
                                    )}
                                    Betal {totalCost} kr
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={handlePublishAfterPurchase}
                                disabled={isProcessing || isPublishing}
                                className="w-full gap-2"
                            >
                                {(isProcessing || isPublishing) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                Publicér nu
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Remove Dialog */}
            <AlertDialog open={!!showConfirmRemove} onOpenChange={(open) => !open && setShowConfirmRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Fjern fra kurven?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Er du sikker på at du vil fjerne "{showConfirmRemove?.name}" fra din kurv?
                            Du kan altid tilføje det igen senere.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveItem}>
                            Fjern
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Small indicator badge to show pending purchase count
 */
export function PendingPurchasesBadge({
    count,
    totalCost,
    onClick,
}: {
    count: number;
    totalCost: number;
    onClick?: () => void;
}) {
    if (count === 0) return null;

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className="gap-2 bg-gradient-to-r from-rose-50 to-red-50 border-rose-300 text-rose-700 hover:from-rose-100 hover:to-red-100 hover:border-rose-400 shadow-sm transition-all duration-200"
        >
            <ShoppingCart className="h-4 w-4 text-rose-600" />
            <span className="font-medium">{count} {count === 1 ? 'element' : 'elementer'}</span>
            <Badge className="font-mono bg-rose-600 text-white hover:bg-rose-700 border-0">
                {totalCost} kr
            </Badge>
        </Button>
    );
}
