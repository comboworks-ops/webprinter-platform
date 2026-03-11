import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut, User, Menu, MessageCircle, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "sonner";
import { VisitorStatsWidget } from "./VisitorStatsWidget";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ADMIN_DARK_MODE_KEY = 'admin_dark_mode';

export function AdminHeader() {
    const [userEmail, setUserEmail] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [adminContext, setAdminContext] = useState<{
        tenantId: string | null;
        tenantName: string;
        domain: string | null;
        isMasterAdmin: boolean;
    }>({
        tenantId: null,
        tenantName: "Panel",
        domain: null,
        isMasterAdmin: false,
    });
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Initialize from localStorage
        if (typeof window !== 'undefined') {
            return localStorage.getItem(ADMIN_DARK_MODE_KEY) === 'true';
        }
        return false;
    });
    const previousCountRef = useRef(0);
    const navigate = useNavigate();
    const { toggleSidebar } = useSidebar();

    // Apply dark mode class to document
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(ADMIN_DARK_MODE_KEY, String(isDarkMode));
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    // Load user email
    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || "");
            }
        };
        loadUser();
    }, []);

    useEffect(() => {
        let active = true;

        const loadAdminContext = async () => {
            const resolution = await resolveAdminTenant();
            if (!active) return;

            if (!resolution.tenantId) {
                setAdminContext({
                    tenantId: null,
                    tenantName: "Panel",
                    domain: null,
                    isMasterAdmin: resolution.isMasterAdmin,
                });
                return;
            }

            const { data: tenant } = await (supabase
                .from("tenants") as any)
                .select("id, name, domain")
                .eq("id", resolution.tenantId)
                .maybeSingle();

            if (!active) return;

            setAdminContext({
                tenantId: resolution.tenantId,
                tenantName: resolution.tenantId === MASTER_TENANT_ID
                    ? "Webprinter Master"
                    : (tenant?.name || "Tenant"),
                domain: tenant?.domain || null,
                isMasterAdmin: resolution.isMasterAdmin,
            });
        };

        loadAdminContext();

        return () => {
            active = false;
        };
    }, [navigate]);

    // Fetch messages logic
    useEffect(() => {
        if (!adminContext.tenantId) return;

        const fetchMessages = async () => {
            try {
                // 1. Customer Messages (Unread)
                const { count: customerCount } = await supabase
                    .from('order_messages' as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('is_read', false)
                    .eq('sender_type', 'customer');

                // 2. Support Messages (Unread)
                const isMaster = adminContext.tenantId === MASTER_TENANT_ID;

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

        fetchMessages();
        const interval = setInterval(fetchMessages, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [adminContext.tenantId]);

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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
        toast.success("Du er nu logget ud");
    };

    const handleVisitShop = () => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const masterDemoUrl = `${window.location.origin}/shop?tenantId=${MASTER_TENANT_ID}`;

        // Use domain from settings hook
        if (adminContext.domain && !isLocalhost) {
            window.open(`https://${adminContext.domain}`, '_blank');
        } else if (isLocalhost && adminContext.tenantId === MASTER_TENANT_ID) {
            window.open(masterDemoUrl, '_blank');
        } else {
            window.open(`${window.location.origin}/shop`, '_blank');
        }
    };

    const displayTenantName = adminContext.tenantName;
    const contextBadge = adminContext.tenantId === MASTER_TENANT_ID ? "Master" : "Tenant";

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background px-6 shadow-sm">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-foreground">{displayTenantName} Panel</h1>
                    <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                        {contextBadge}
                    </span>
                </div>
                <VisitorStatsWidget />
            </div>

            <div className="ml-auto flex items-center gap-4">
                {/* Dark Mode Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleDarkMode}
                    className="rounded-full"
                    title={isDarkMode ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
                >
                    {isDarkMode ? (
                        <Sun className="h-5 w-5 text-yellow-500" />
                    ) : (
                        <Moon className="h-5 w-5" />
                    )}
                </Button>

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
