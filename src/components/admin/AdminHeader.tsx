import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut, User, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
    const navigate = useNavigate();
    const { toggleSidebar } = useSidebar();

    useEffect(() => {
        fetchTenantInfo();
    }, []);

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
        // Check if we are in development/localhost
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (tenantDomain && !isLocalhost) {
            // Production: Go to custom domain
            window.open(`https://${tenantDomain}`, '_blank');
        } else {
            // Localhost/Dev: Open root on same origin
            window.open(window.location.origin, '_blank');
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
