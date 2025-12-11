import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut, User, Menu, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminHeader() {
    const [tenantName, setTenantName] = useState("Webprinter");
    const [tenantDomain, setTenantDomain] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const previousCountRef = useRef(0);
    const navigate = useNavigate();
    const { toggleSidebar } = useSidebar();

    useEffect(() => {
        fetchTenantInfo();
        fetchMessages();
        const interval = setInterval(fetchMessages, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Notify on new messages
    useEffect(() => {
        if (unreadCount > previousCountRef.current) {
            toast.success("Ny besked modtaget!", {
                description: "Du har en ny ulæst besked fra en kunde.",
                action: {
                    label: "Se besked",
                    onClick: () => navigate("/admin/beskeder")
                },
                duration: 5000,
            });
        }
        previousCountRef.current = unreadCount;
    }, [unreadCount, navigate]);

    const fetchMessages = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Customer Messages (Unread)
            const { count: customerCount } = await supabase
                .from('order_messages' as any)
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .eq('sender_type', 'customer');

            // 2. Support Messages (Unread)
            // If I am Tenant: Count messages from 'master'
            // If I am Master: Count messages from 'tenant'

            // Check if master (quick check)
            const { data: masterTenant } = await supabase
                .from('tenants' as any)
                .select('id')
                .eq('id', '00000000-0000-0000-0000-000000000000')
                .eq('owner_id', user.id)
                .maybeSingle();

            const isMaster = !!masterTenant;

            const { count: supportCount } = await supabase
                .from('platform_messages' as any)
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .eq('sender_role', isMaster ? 'tenant' : 'master');

            const total = (customerCount || 0) + (supportCount || 0);
            setUnreadCount(total);
        } catch (e) {
            console.error("Error fetching messages", e);
        }
    };

    const fetchTenantInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || "");

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('name, domain')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant) {
                setTenantName((tenant as any).name);
                setTenantDomain((tenant as any).domain || "");
            }
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
        toast.success("Du er nu logget ud");
    };

    const handleVisitShop = () => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (tenantDomain && !isLocalhost) {
            window.open(`https://${tenantDomain}`, '_blank');
        } else {
            window.open(`${window.location.origin}/shop`, '_blank');
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background px-6 shadow-sm">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold text-foreground">{tenantName} Panel</h1>
            </div>

            <div className="ml-auto flex items-center gap-4">
                {/* Green Message Box Notification */}
                <Link to="/admin/beskeder">
                    <div className={`
                        relative flex items-center justify-center p-2 rounded-xl transition-all duration-300
                        ${unreadCount > 0
                            ? "bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-600 scale-100"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }
                    `}>
                        <MessageCircle className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                </Link>

                <Button variant="outline" size="sm" onClick={handleVisitShop} className="hidden sm:flex">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Se min shop
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <User className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Min Konto</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            {userEmail}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log ud
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
