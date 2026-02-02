/**
 * PlatformHeader - Header component for the Platform marketing site
 * 
 * This header is ONLY used on webprinter.dk / www.webprinter.dk (Platform pages).
 * It is completely independent of tenant branding and demo shop settings.
 * 
 * Key differences from shop Header:
 * - Brand name is static "Webprinter.dk" and NOT clickable
 * - No product queries or tenant data dependencies
 * - Simplified navigation for marketing pages
 * - ALWAYS white background (never transparent)
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, Shield, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// Platform feature pages for Funktioner dropdown
const FUNKTIONER_PAGES = [
    { label: "White Label Webshop", path: "/white-label" },
    { label: "Smart Prisberegning", path: "/beregning" },
    { label: "Ordre Workflow", path: "/order-flow" },
    { label: "Online Designer", path: "/online-designer" },
];

const PlatformHeader = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const location = useLocation();
    const { toast } = useToast();
    const { isAdmin } = useUserRole();
    const headerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast({
                title: "Fejl",
                description: "Kunne ikke logge ud",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Succes",
                description: "Du er nu logget ud",
            });
        }
    };

    const isActive = (path: string) => location.pathname === path;

    // DK Blue color used across the platform
    const DK_BLUE = "#0EA5E9";

    return (
        <header
            ref={headerRef}
            className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100"
            style={{
                height: '72px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
        >
            <div className="container mx-auto px-4 h-full">
                <div className="flex items-center justify-between h-full">
                    {/* Brand Name - Static "Webprinter.dk", NOT clickable */}
                    {/* Uses font-heading (Poppins) to match the main title */}
                    <span className="text-2xl md:text-3xl font-heading font-bold tracking-tight select-none">
                        <span className="text-gray-900">Web</span>
                        <span style={{ color: DK_BLUE }}>printer.dk</span>
                    </span>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-8">
                        <Link
                            to="/platform"
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/platform') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Platform
                        </Link>

                        {/* Funktioner Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="text-sm font-medium text-gray-700 hover:text-primary transition-colors duration-200 inline-flex items-center gap-1">
                                    Funktioner
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 z-[51]">
                                {FUNKTIONER_PAGES.map((page) => (
                                    <DropdownMenuItem key={page.path} asChild>
                                        <Link to={page.path} className="cursor-pointer">
                                            {page.label}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Link
                            to="/priser"
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/priser') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Priser
                        </Link>

                        <Link
                            to="/kontakt"
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/kontakt') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Kontakt
                        </Link>
                    </nav>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3">
                        {/* CTA Button */}
                        <Link to="/opret-shop">
                            <Button size="sm" className="hidden md:flex">
                                Start gratis
                            </Button>
                        </Link>

                        {/* User Menu */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-gray-700">
                                        <User className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 z-[51]">
                                    <DropdownMenuItem asChild>
                                        <Link to="/profil" className="cursor-pointer">
                                            <User className="mr-2 h-4 w-4" />
                                            Min profil
                                        </Link>
                                    </DropdownMenuItem>
                                    {isAdmin && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild>
                                                <Link to="/admin" className="cursor-pointer">
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    Admin
                                                </Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Log ud
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link to="/auth">
                                <Button variant="ghost" size="sm" className="hidden md:flex text-gray-700">
                                    Log ind
                                </Button>
                            </Link>
                        )}

                        {/* Mobile Menu Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden text-gray-700"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg">
                    <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
                        <Link
                            to="/platform"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/platform') ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Platform
                        </Link>

                        {/* Funktioner items in mobile */}
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Funktioner</div>
                        {FUNKTIONER_PAGES.map((page) => (
                            <Link
                                key={page.path}
                                to={page.path}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(page.path) ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {page.label}
                            </Link>
                        ))}

                        <Link
                            to="/priser"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/priser') ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Priser
                        </Link>

                        <Link
                            to="/kontakt"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/kontakt') ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Kontakt
                        </Link>

                        <div className="border-t my-2" />
                        <Link to="/opret-shop" onClick={() => setMobileMenuOpen(false)}>
                            <Button className="w-full">Start gratis</Button>
                        </Link>
                        {!user && (
                            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                                <Button variant="outline" className="w-full">Log ind</Button>
                            </Link>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default PlatformHeader;
