import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut, User, Menu, MessageCircle, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link, useLocation } from "react-router-dom";
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
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'webprinter.dk';
const PLATFORM_LEAD_PREFIX = '[PLATFORM LEAD]';
const PLATFORM_LEAD_THREAD_PATH = `/admin/beskeder?tenantId=${MASTER_TENANT_ID}`;

export function AdminHeader() {
    const [userEmail, setUserEmail] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadPlatformLeadCount, setUnreadPlatformLeadCount] = useState(0);
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
    const location = useLocation();
    const { toggleSidebar } = useSidebar();
    const withAdminContext = (path: string) => {
        const forceDomain = new URLSearchParams(location.search).get("force_domain");
        if (!forceDomain || !path.startsWith("/admin")) return path;
        const existingParams = new URLSearchParams(path.split("?")[1] || "");
        if (existingParams.has("force_domain")) return path;
        return `${path}${path.includes("?") ? "&" : "?"}force_domain=${encodeURIComponent(forceDomain)}`;
    };

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

                const { count: platformLeadCount } = isMaster
                    ? await supabase
                        .from('platform_messages' as any)
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', MASTER_TENANT_ID)
                        .eq('is_read', false)
                        .ilike('content', `${PLATFORM_LEAD_PREFIX}%`)
                    : { count: 0 };

                const total = (customerCount || 0) + (supportCount || 0);
                setUnreadCount(total);
                setUnreadPlatformLeadCount(platformLeadCount || 0);
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
            const isOnlyPlatformLeads = adminContext.tenantId === MASTER_TENANT_ID
                && unreadPlatformLeadCount > 0
                && unreadPlatformLeadCount === unreadCount;
            toast.success("Ny besked modtaget!", {
                description: isOnlyPlatformLeads
                    ? "Du har en ny ulæst platformhenvendelse."
                    : "Du har en ny ulæst besked fra en kunde.",
                action: {
                    label: "Se besked",
                    onClick: () => navigate(withAdminContext(isOnlyPlatformLeads ? PLATFORM_LEAD_THREAD_PATH : "/admin/beskeder"))
                },
                duration: 5000,
            });
        }
        previousCountRef.current = unreadCount;
    }, [adminContext.tenantId, unreadCount, unreadPlatformLeadCount, navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
        toast.success("Du er nu logget ud");
    };

    const handleVisitShop = () => {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isCentralRootHost = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;
        const masterDemoUrl = isLocalhost || isCentralRootHost
            ? `${window.location.origin}/shop?tenantId=${MASTER_TENANT_ID}`
            : `https://${ROOT_DOMAIN}/shop?tenantId=${MASTER_TENANT_ID}`;

        if (adminContext.tenantId === MASTER_TENANT_ID) {
            window.open(masterDemoUrl, '_blank');
            return;
        }

        if (adminContext.domain && !isLocalhost) {
            window.open(`https://${adminContext.domain}`, '_blank');
            return;
        }

        window.open(`${window.location.origin}/shop`, '_blank');
    };

    const displayTenantName = adminContext.tenantName;
    const contextBadge = adminContext.tenantId === MASTER_TENANT_ID ? "Master" : "Tenant";

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="shrink-0 rounded-xl md:hidden"
                    aria-label="Åbn menu"
                >
                    <Menu className="h-5 w-5" />
                </Button>
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <h1 className="truncate text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-xl">{displayTenantName} Panel</h1>
                    <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {contextBadge}
                    </span>
                </div>
                <div className="hidden xl:block">
                    <VisitorStatsWidget />
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                {/* Dark Mode Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleDarkMode}
                    className="rounded-xl"
                    title={isDarkMode ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
                    aria-label={isDarkMode ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
                >
                    {isDarkMode ? (
                        <Sun className="h-5 w-5 text-yellow-500" />
                    ) : (
                        <Moon className="h-5 w-5" />
                    )}
                </Button>

                {/* Message notification */}
                <Link
                    to={withAdminContext(
                        adminContext.tenantId === MASTER_TENANT_ID
                        && unreadPlatformLeadCount > 0
                        && unreadPlatformLeadCount === unreadCount
                            ? PLATFORM_LEAD_THREAD_PATH
                            : "/admin/beskeder"
                    )}
                    aria-label={unreadPlatformLeadCount > 0 ? "Åbn platformhenvendelser" : "Åbn beskeder"}
                >
                    <div className={`
                        relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-200
                        ${unreadCount > 0
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
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

                <Button variant="outline" size="sm" onClick={handleVisitShop} className="hidden rounded-xl sm:flex">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Se min shop
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Åbn konto-menu">
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
