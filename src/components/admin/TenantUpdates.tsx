import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, CheckCircle, Loader2, Bell, Trash2, Box, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Notification {
    id: string;
    type: 'message' | 'product_update' | 'system_alert';
    title: string;
    content: string;
    data: any;
    is_read: boolean;
    created_at: string;
    status: string;
}

export function TenantUpdates() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (!tenant) return;

            // Cast table name to any to avoid type errors since it's a new table
            const { data, error } = await supabase
                .from('tenant_notifications' as any)
                .select('*')
                .eq('tenant_id', (tenant as any).id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications((data as any[]) || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImportProduct = async (notification: Notification) => {
        setProcessingId(notification.id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id')
                .eq('owner_id', user!.id)
                .maybeSingle();

            const slug = notification.data?.slug;
            if (!slug) throw new Error("Product slug missing");

            // Call the sync specific function
            const { error } = await supabase.rpc('sync_specific_product' as any, {
                target_tenant_id: (tenant as any).id,
                product_slug: slug
            });

            if (error) throw error;

            toast.success("Produkt importeret succesfuldt!");

            // Update notification status
            await supabase
                .from('tenant_notifications' as any)
                .update({ status: 'accepted', is_read: true })
                .eq('id', notification.id);

            fetchNotifications();
        } catch (error) {
            console.error('Error importing product:', error);
            toast.error('Kunne ikke importere produkt');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tenant_notifications' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Besked slettet");
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            toast.error("Kunne ikke slette besked");
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Indbakke</h1>
                <p className="text-muted-foreground">Beskeder og opdateringer fra Webprinter</p>
            </div>

            <div className="space-y-4">
                {notifications.length === 0 ? (
                    <Card className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <Bell className="h-12 w-12 opacity-20" />
                            <p>Du har ingen nye beskeder</p>
                        </div>
                    </Card>
                ) : (
                    notifications.map((notification) => (
                        <Card key={notification.id} className={`transition-all ${!notification.is_read ? 'border-primary/50 bg-primary/5' : ''}`}>
                            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${notification.type === 'product_update' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {notification.type === 'product_update' ? <Box className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            {notification.title}
                                            {!notification.is_read && <Badge variant="default" className="text-[10px] h-5">Ny</Badge>}
                                        </CardTitle>
                                        <CardDescription className="text-sm mt-1">
                                            {format(new Date(notification.created_at), "d. MMMM yyyy HH:mm", { locale: da })}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteNotification(notification.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{notification.content}</p>
                            </CardContent>
                            {notification.type === 'product_update' && notification.status !== 'accepted' && (
                                <CardFooter className="pt-0 border-t bg-muted/20 p-4">
                                    <Button
                                        onClick={() => handleImportProduct(notification)}
                                        disabled={processingId === notification.id}
                                        className="w-full sm:w-auto"
                                    >
                                        {processingId === notification.id ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importerer...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" /> Importer Produkt
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            )}
                            {notification.status === 'accepted' && (
                                <CardFooter className="pt-0 p-4">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Importeret
                                    </Badge>
                                </CardFooter>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
