import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Index from "@/pages/Index";
import Shop from "@/pages/Shop"; // We will likely need a dedicated TenantShopLayout later
import { useShopSettings } from "@/hooks/useShopSettings";
import { Loader2 } from "lucide-react";

// Domains that should ALWAYS show the Landing Page (Marketing)
// Note: localhost is NOT included - developers see the Shop by default
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MARKETING_DOMAINS = [
    ROOT_DOMAIN,
    `www.${ROOT_DOMAIN}`,
    "webprinter-platform.vercel.app",
    // localhost now shows Shop for development convenience
];

export default function SubdomainRouter() {
    const settings = useShopSettings();
    const location = useLocation();
    const hostname = window.location.hostname;

    // Decide if we are on a Marketing Domain
    const isVercel = hostname.endsWith(".vercel.app");
    const isMarketing = MARKETING_DOMAINS.includes(hostname) || (isVercel && hostname === "webprinter-platform.vercel.app");

    // If we are on a marketing domain, render the Index (Landing Page)
    // BUT: If the user explicitly goes to /shop, /login, etc, we should allow it?
    // Our Router in App.tsx handles paths.
    // The issue is: On `shop1.webprinter.dk`, the root `/` should be the SHOP HOME, not the Landing Page.

    if (isMarketing) {
        return <Index />;
    }

    // --- TENANT MODE (also default for localhost development) ---
    // We are on a subdomain (e.g. shop1.webprinter.dk) or custom domain.
    // We should render the Shop view for the root path `/`.

    // Check if we are loading settings (Tenant lookup)
    if (settings.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If no tenant found, show 404
    if (!settings.data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold mb-2">Shop ikke fundet</h1>
                <p className="text-muted-foreground">Vi kunne ikke finde en shop på dette domæne.</p>
                <p className="text-xs text-muted-foreground mt-4">{hostname}</p>
            </div>
        );
    }

    // If tenant exists, render the Shop
    // Note: We might want to pass settings down or let Shop fetch them again.
    // Since settings is cached by React Query, it's efficient.
    return <Shop />;
}
