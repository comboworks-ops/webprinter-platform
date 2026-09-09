import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut, User, ChevronDown, MessageCircle, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { AdminWorkspaceNavigation } from "./AdminWorkspaceNavigation";
import { useIconStudioAccess } from "@/hooks/useIconStudioAccess";
import { withAdminWorkspaceContext } from "@/lib/admin/workspaceNavigation";
import { requestAdminWorkspaceExit } from "@/lib/admin/workspaceExit";
import { toast } from "sonner";
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
        contextKey: string;
        tenantId: string | null;
        tenantName: string;
        domain: string | null;
        isMasterAdmin: boolean;
    }>({
        contextKey: "",
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
    const previousCountRef = useRef<number | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const iconStudio = useIconStudioAccess();
    const contextKey = new URLSearchParams(location.search).get("force_domain") || "default";
    const withAdminContext = (path: string) => withAdminWorkspaceContext(path, location.search);

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
                    contextKey,
                    tenantId: null,
                    tenantName: "Panel",
                    domain: null,
                    isMasterAdmin: resolution.isMasterAdmin,
                });
                return;
            }

            const { data: tenant } = await (supabase as any)
                .from("tenants")
                .select("id, name, domain")
                .eq("id", resolution.tenantId)
                .maybeSingle();

            if (!active) return;

            setAdminContext({
                contextKey,
                tenantId: resolution.tenantId,
                tenantName: resolution.tenantId === MASTER_TENANT_ID
                    ? "Webprinter Master"
                    : (tenant?.name || "Tenant"),
                domain: tenant?.domain || null,
                isMasterAdmin: resolution.isMasterAdmin,
            });
        };

        loadAdminContext().catch(() => {
            if (active) setAdminContext({ contextKey, tenantId: null, tenantName: "Shop kunne ikke hentes", domain: null, isMasterAdmin: false });
        });

        return () => {
            active = false;
        };
    }, [contextKey]);

    // Fetch messages logic
    useEffect(() => {
        previousCountRef.current = null;
        setUnreadCount(0);
        setUnreadPlatformLeadCount(0);
        if (!adminContext.tenantId) return;
        let active = true;
        let fetching = false;

        const fetchMessages = async () => {
            if (fetching) return;
            fetching = true;
            try {
                // 1. Customer Messages (Unread)
                const { count: customerCount, error: customerError } = await supabase
                    .from('order_messages' as any)
                    .select('id, orders!inner(tenant_id)', { count: 'exact', head: true })
                    .eq('orders.tenant_id', adminContext.tenantId)
                    .eq('is_read', false)
                    .eq('sender_type', 'customer');
                if (customerError) throw customerError;

                // 2. Support Messages (Unread)
                const isMaster = adminContext.tenantId === MASTER_TENANT_ID;

                const supportQuery = supabase
                    .from('platform_messages' as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('is_read', false)
                    .eq('sender_role', isMaster ? 'tenant' : 'master');
                const { count: supportCount, error: supportError } = await (isMaster ? supportQuery : supportQuery.eq('tenant_id', adminContext.tenantId));
                if (supportError) throw supportError;

                const { count: platformLeadCount, error: leadError } = isMaster
                    ? await supabase
                        .from('platform_messages' as any)
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', MASTER_TENANT_ID)
                        .eq('is_read', false)
                        .ilike('content', `${PLATFORM_LEAD_PREFIX}%`)
                    : { count: 0, error: null };
                if (leadError) throw leadError;
                if (customerCount === null || supportCount === null || platformLeadCount === null) return;

                const total = (customerCount || 0) + (supportCount || 0);
                if (!active) return;
                const previousCount = previousCountRef.current;
                previousCountRef.current = total;
                setUnreadCount(total);
                setUnreadPlatformLeadCount(platformLeadCount || 0);

                // The first successful observation is existing backlog, not a newly received message.
                if (previousCount !== null && total > previousCount) {
                    const isOnlyPlatformLeads = isMaster && platformLeadCount > 0 && platformLeadCount === total;
                    toast.success('Ny besked modtaget!', {
                        description: isOnlyPlatformLeads
                            ? 'Du har en ny ulæst platformhenvendelse.'
                            : 'Du har en ny ulæst besked fra en kunde.',
                        action: {
                            label: 'Se besked',
                            onClick: () => {
                                if (requestAdminWorkspaceExit()) navigate(withAdminContext(isOnlyPlatformLeads ? PLATFORM_LEAD_THREAD_PATH : '/admin/beskeder'));
                            },
                        },
                        duration: 5000,
                    });
                }
            } catch (e) {
                console.error("Error fetching messages", e);
            } finally {
                fetching = false;
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 30000); // Poll every 30s
        return () => { active = false; clearInterval(interval); };
    }, [adminContext.tenantId]);

    const handleLogout = async () => {
        if (loggingOut) return;
        if (!requestAdminWorkspaceExit()) return;
        setLoggingOut(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate('/');
            toast.success('Du er nu logget ud');
        } catch (error) {
            console.error('Could not sign out:', error);
            toast.error('Du kunne ikke logges ud. Prøv igen.');
        } finally {
            setLoggingOut(false);
        }
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

        const shopParams = new URLSearchParams();
        if (adminContext.tenantId) shopParams.set('tenantId', adminContext.tenantId);
        const forceDomain = new URLSearchParams(location.search).get('force_domain');
        if (forceDomain) shopParams.set('force_domain', forceDomain);
        window.open(`${window.location.origin}/shop?${shopParams}`, '_blank', 'noopener,noreferrer');
    };

    const contextResolved = adminContext.contextKey === contextKey;
    const contextReady = contextResolved && Boolean(adminContext.tenantId);
    const displayTenantName = contextResolved ? adminContext.tenantName : "Indlæser…";
    const isMasterContext = contextReady && adminContext.isMasterAdmin && adminContext.tenantId === MASTER_TENANT_ID;

    return (
        <div className="admin-workspace-chrome">
        <header className="admin-workspace-header">
            <div className="admin-workspace-identity">
                <Link to={withAdminContext('/admin')} className="admin-workspace-wordmark no-link-color" aria-label="Webprinter overblik">webprinter</Link>
                <div className="admin-workspace-tenant">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="admin-workspace-tenant-trigger" aria-label="Åbn shopmenu">
                            <span>{displayTenantName}</span><ChevronDown size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="admin-workspace-menu">
                            <DropdownMenuLabel>{displayTenantName}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild><Link to={withAdminContext('/admin/indstillinger')}>Shopindstillinger</Link></DropdownMenuItem>
                            {isMasterContext && <DropdownMenuItem asChild><Link to={withAdminContext('/admin/tenants')}>Administrér lejere</Link></DropdownMenuItem>}
                            <DropdownMenuItem onClick={handleVisitShop} disabled={!contextReady}>Se webshop</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
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

                <Button variant="outline" size="sm" onClick={handleVisitShop} className="admin-workspace-visit-shop" disabled={!contextReady}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Se webshop
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="admin-workspace-avatar" aria-label="Åbn konto-menu">
                            {userEmail ? <span aria-hidden="true">{userEmail.slice(0, 2).toUpperCase()}</span> : <User className="h-5 w-5" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="admin-workspace-menu">
                        <DropdownMenuLabel>Min Konto</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            {userEmail}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={toggleDarkMode}>
                            {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                            {isDarkMode ? 'Lys tilstand' : 'Mørk tilstand'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleVisitShop} disabled={!contextReady}><ExternalLink className="mr-2 h-4 w-4" />Se webshop</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout} disabled={loggingOut} className="text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            {loggingOut ? 'Logger ud…' : 'Log ud'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        <AdminWorkspaceNavigation isMasterContext={isMasterContext} hasIconStudio={!iconStudio.isLoading && iconStudio.hasAccess} />
        </div>
    );
}
